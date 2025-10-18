const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../config.env') });
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const axios = require('axios');

const JWT_SECRET = process.env.JWT_SECRET || 'cat909';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '260775726499-60afbdiha77eig1qsphoktihdhe99f14.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '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';
const YANDEX_CLIENT_ID = process.env.YANDEX_CLIENT_ID || '8217fc55c26e4c35bf819d35f47072a3';
const YANDEX_CLIENT_SECRET = process.env.YANDEX_CLIENT_SECRET || 'a191e38d1bc44f53bb3140a3c2ad5542';

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Хранилище данных в памяти (для быстрого доступа)
const users = new Map(); // userId -> {id, name, username, passwordHash, createdAt}
// Простая капча в памяти: socketId -> { question, answer, expiresAt }
const captchaChallenges = new Map();
const onlineUsers = new Map(); // socketId -> userId
const messages = []; // История сообщений
const chats = new Map(); // chatId -> {participants, messages}
const channels = new Map(); // channelId -> {id, name, description, members, createdAt}
const pinnedMessages = new Map(); // chatId -> [messageId1, messageId2, ...]

// Initialize database tables
async function initializeDatabase() {
  try {
    // Drop existing tables with foreign key constraints first (in reverse dependency order)
    await pool.query('DROP TABLE IF EXISTS chat_participants CASCADE');
    await pool.query('DROP TABLE IF EXISTS messages CASCADE');
    await pool.query('DROP TABLE IF EXISTS chats CASCADE');
    await pool.query('DROP TABLE IF EXISTS users CASCADE');
    
    // Create tables with consistent schema
    await pool.query(`
      CREATE TABLE users (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        username VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255),
        provider VARCHAR(50),
        provider_id VARCHAR(255),
        avatar_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(provider, provider_id)
      )
    `);
    
    await pool.query(`
      CREATE TABLE chats (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        chat_type VARCHAR(50) DEFAULT 'private',
        created_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    
    await pool.query(`
      CREATE TABLE messages (
        id VARCHAR(255) PRIMARY KEY,
        content TEXT NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        chat_id VARCHAR(255) NOT NULL,
        message_type VARCHAR(50) DEFAULT 'text',
        audio_url TEXT,
        duration INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
      )
    `);
    
    await pool.query(`
      CREATE TABLE chat_participants (
        id SERIAL PRIMARY KEY,
        chat_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(chat_id, user_id)
      )
    `);
    
    console.log('Database tables initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    // If database initialization fails, continue without database
    console.log('Continuing without database - using in-memory storage only');
  }
}

// Load users from database on startup
async function loadUsersFromDatabase() {
  try {
    const result = await pool.query('SELECT * FROM users');
    result.rows.forEach(user => {
      users.set(user.id, {
        id: user.id,
        name: user.name,
        username: user.username,
        passwordHash: user.password_hash,
        provider: user.provider,
        providerId: user.provider_id,
        avatarUrl: user.avatar_url,
        createdAt: user.created_at
      });
    });
    console.log(`Loaded ${users.size} users from database`);
    console.log('Users in memory:', Array.from(users.keys()));
  } catch (error) {
    console.error('Error loading users from database:', error);
    console.log('Continuing without loading users from database');
  }
}

// Initialize database
initializeDatabase().then(() => {
  loadUsersFromDatabase();
});

// Google OAuth helper functions
async function verifyGoogleToken(idToken) {
  try {
    // Decode the JWT token to get user info
    const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64').toString());
    
    // Verify the token signature (simplified - in production use proper JWT verification)
    if (!payload.sub || !payload.email) {
      throw new Error('Invalid Google token');
    }
    
    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      given_name: payload.given_name,
      family_name: payload.family_name
    };
  } catch (error) {
    console.error('Google token verification error:', error);
    throw error;
  }
}

// Yandex OAuth helper functions
async function exchangeYandexCode(code, redirectUri) {
  try {
    const response = await axios.post('https://oauth.yandex.ru/token', {
      grant_type: 'authorization_code',
      code: code,
      client_id: YANDEX_CLIENT_ID,
      client_secret: YANDEX_CLIENT_SECRET,
      redirect_uri: redirectUri
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    return response.data;
  } catch (error) {
    console.error('Yandex token exchange error:', error);
    throw error;
  }
}

async function getYandexUserInfo(accessToken) {
  try {
    const response = await axios.get('https://login.yandex.ru/info', {
      headers: {
        'Authorization': `OAuth ${accessToken}`
      }
    });

    return response.data;
  } catch (error) {
    console.error('Yandex user info error:', error);
    throw error;
  }
}

async function getOrCreateSocialUser(provider, providerId, userInfo) {
  try {
    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE provider = $1 AND provider_id = $2',
      [provider, providerId]
    );

    if (existingUser.rows.length > 0) {
      return existingUser.rows[0];
    }

    // Create new user
    const userId = uuidv4();
    let username, name, avatarUrl;
    
    if (provider === 'google') {
      username = userInfo.email ? userInfo.email.split('@')[0] : `user_${providerId}`;
      name = userInfo.name || `${userInfo.given_name || ''} ${userInfo.family_name || ''}`.trim() || username;
      avatarUrl = userInfo.picture;
    } else if (provider === 'yandex') {
      username = userInfo.login || `user_${providerId}`;
      name = userInfo.real_name || userInfo.display_name || username;
      avatarUrl = userInfo.default_avatar_id ? `https://avatars.yandex.net/get-yapic/${userInfo.default_avatar_id}/islands-200` : null;
    } else {
      username = userInfo.screen_name || `user_${providerId}`;
      name = `${userInfo.first_name || ''} ${userInfo.last_name || ''}`.trim() || username;
      avatarUrl = userInfo.photo_200;
    }

    await pool.query(
      'INSERT INTO users (id, name, username, password_hash, provider, provider_id, avatar_url) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [userId, name, username, null, provider, providerId, avatarUrl]
    );

    return {
      id: userId,
      name,
      username,
      provider,
      provider_id: providerId,
      avatar_url: avatarUrl
    };
  } catch (error) {
    console.error('Error creating social user:', error);
    throw error;
  }
}

// Function to get or create a private chat between two users
async function getOrCreatePrivateChat(user1Id, user2Id) {
  try {
    // Sort user IDs to ensure consistent chat lookup
    const [userId1, userId2] = [user1Id, user2Id].sort();
    
    // First, try to find existing private chat
    const existingChat = await pool.query(`
      SELECT c.id FROM chats c
      JOIN chat_participants cp1 ON c.id = cp1.chat_id AND cp1.user_id = $1
      JOIN chat_participants cp2 ON c.id = cp2.chat_id AND cp2.user_id = $2
      WHERE c.chat_type = 'private'
      AND (SELECT COUNT(*) FROM chat_participants WHERE chat_id = c.id) = 2
    `, [userId1, userId2]);
    
    if (existingChat.rows.length > 0) {
      return existingChat.rows[0].id;
    }
    
    // Create new private chat
    const chatId = uuidv4();
    const chatName = `Private chat between ${userId1} and ${userId2}`;
    
    await pool.query(
      'INSERT INTO chats (id, name, chat_type, created_by) VALUES ($1, $2, $3, $4)',
      [chatId, chatName, 'private', userId1]
    );
    
    // Add both participants
    await pool.query(
      'INSERT INTO chat_participants (chat_id, user_id) VALUES ($1, $2), ($1, $3)',
      [chatId, userId1, userId2]
    );
    
    return chatId;
  } catch (error) {
    console.error('Error getting/creating private chat:', error);
    // Fallback: use a deterministic chat ID based on user IDs
    const [userId1, userId2] = [user1Id, user2Id].sort();
    return `private_${userId1}_${userId2}`;
  }
}

io.on('connection', (socket) => {
  console.log('', socket.id);

  // Капча: выдача задачи
  socket.on('captcha:get', () => {
    const challenge = generateCaptcha();
    captchaChallenges.set(socket.id, challenge);
    socket.emit('captcha:question', { question: challenge.question });
  });

  // Регистрация по нику/паролю/имени + капча
  socket.on('register', async (data) => {
    const { username, password, name, captchaAnswer } = data || {};

    if (!username || !password || !name) {
      socket.emit('register:error', { message: 'Заполните имя, ник и пароль' });
      return;
    }

    // Проверка капчи
    const challenge = captchaChallenges.get(socket.id);
    if (!challenge || Date.now() > challenge.expiresAt) {
      socket.emit('register:error', { message: 'Капча истекла, обновите' });
      return;
    }
    if (Number.parseInt(String(captchaAnswer).trim(), 10) !== Number(challenge.answer)) {
      socket.emit('register:error', { message: 'Неверная капча' });
      return;
    }

    const normalized = username.startsWith('@') ? username.slice(1) : username;
    const usernameExists = Array.from(users.values()).some(u => u.username === normalized);
    if (usernameExists) {
      socket.emit('register:error', { message: 'Username already taken' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = uuidv4();
    
    // Save to database (only for non-social users)
    await pool.query(
      'INSERT INTO users (id, name, username, password_hash, provider, provider_id) VALUES ($1, $2, $3, $4, $5, $6)',
      [userId, name, normalized, passwordHash, 'local', null]
    );
    
    // Save to memory for quick access
    users.set(userId, {
      id: userId,
      name,
      username: normalized,
      passwordHash,
      provider: 'local',
      providerId: null,
      avatarUrl: null,
      createdAt: Date.now()
    });

    captchaChallenges.delete(socket.id);
    onlineUsers.set(socket.id, userId);

    const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
    socket.emit('register:success', {
      user: users.get(userId),
      token,
      message: 'Registration successful'
    });
    // Broadcast updated users list after registration
    const userListAfterRegister = Array.from(users.values()).map(u => ({
      id: u.id,
      name: u.name,
      username: u.username,
      online: Array.from(onlineUsers.values()).includes(u.id)
    }));
    io.emit('users:list', userListAfterRegister);
    
    // Update the disconnect handler
    socket.on('disconnect', () => {
      const userId = onlineUsers.get(socket.id);
      onlineUsers.delete(socket.id);
      
      // Broadcast updated user list
      const userList = Array.from(users.values()).map(u => ({
        id: u.id,
        name: u.name,
        username: u.username,
        online: Array.from(onlineUsers.values()).includes(u.id)
      }));

    io.emit('users:list', userList);
    console.log('')
  });
});

  // Логин с паролем и капчей
  // After successful login, generate and send token
  socket.on('login', async (data) => {
    const { username, password, captchaAnswer } = data || {};
    if (!username || !password) {
      socket.emit('login:error', { message: 'Введите ник и пароль' });
      return;
    }

    // Проверка капчи
    const challenge = captchaChallenges.get(socket.id);
    if (!challenge || Date.now() > challenge.expiresAt) {
      socket.emit('login:error', { message: 'Капча истекла, обновите' });
      return;
    }
    if (Number.parseInt(String(captchaAnswer).trim(), 10) !== Number(challenge.answer)) {
      socket.emit('login:error', { message: 'Неверная капча' });
      return;
    }

    const normalized = username.startsWith('@') ? username.slice(1) : username;
    const user = Array.from(users.values()).find(u => u.username === normalized && u.provider === 'local');
    if (!user) {
      socket.emit('login:error', { message: 'User not found or social login required' });
      return;
    }

    const ok = await bcrypt.compare(password, user.passwordHash || '');
    if (!ok) {
      socket.emit('login:error', { message: 'Invalid password' });
      return;
    }

    if (ok) {
      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
      captchaChallenges.delete(socket.id);
      onlineUsers.set(socket.id, user.id);
      socket.emit('login:success', { user, token });
      // Send users list to the logged-in user and broadcast updated list to all
      const userListAfterLogin = Array.from(users.values()).map(u => ({
        id: u.id,
        name: u.name,
        username: u.username,
        online: Array.from(onlineUsers.values()).includes(u.id)
      }));
      socket.emit('users:list', userListAfterLogin);
      io.emit('users:list', userListAfterLogin);
    }
  });
  
  // Social authentication handler
  socket.on('social:auth', async (data) => {
    const { provider, accessToken, userInfo } = data;
    
    try {
      let verifiedUserInfo;
      
      if (provider === 'google') {
        try {
          verifiedUserInfo = await verifyGoogleToken(accessToken);
        } catch (error) {
          console.error('Google token verification failed:', error);
          throw new Error('Google authentication failed');
        }
      } else if (provider === 'yandex') {
        try {
          verifiedUserInfo = await getYandexUserInfo(accessToken);
        } catch (error) {
          console.error('Yandex token verification failed:', error);
          throw new Error('Yandex authentication failed');
        }
      } else {
        socket.emit('social:auth:error', { message: 'Unsupported provider' });
        return;
      }

      const user = await getOrCreateSocialUser(provider, verifiedUserInfo.id, verifiedUserInfo);
      
      // Update in-memory storage
      users.set(user.id, {
        id: user.id,
        name: user.name,
        username: user.username,
        provider: user.provider,
        providerId: user.provider_id,
        avatarUrl: user.avatar_url,
        createdAt: user.created_at
      });
      console.log('Added user to memory storage:', user.id, user.name);

      onlineUsers.set(socket.id, user.id);
      
      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
      
      socket.emit('social:auth:success', {
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          avatarUrl: user.avatar_url,
          provider: user.provider
        },
        token
      });

      // Send updated user list
      const userList = Array.from(users.values()).map(u => ({
        id: u.id,
        name: u.name,
        username: u.username,
        online: Array.from(onlineUsers.values()).includes(u.id)
      }));
      console.log('Sending users:list to client, count:', userList.length);
      socket.emit('users:list', userList);
      io.emit('users:list', userList);
      
    } catch (error) {
      console.error('Social auth error:', error);
      socket.emit('social:auth:error', { 
        message: error.message || 'Authentication failed' 
      });
    }
  });

  // Add new handler for token authentication
  socket.on('auth:token', async (token) => {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = users.get(decoded.userId);
      
      if (user) {
        onlineUsers.set(socket.id, user.id);
        socket.emit('auth:success', { user });
        
        // Send updated user list
        const userList = Array.from(users.values()).map(u => ({
          id: u.id,
          name: u.name,
          username: u.username,
          online: Array.from(onlineUsers.values()).includes(u.id)
        }));
        socket.emit('users:list', userList);
      }
    } catch (err) {
      socket.emit('auth:error', { message: 'Invalid token' });
    }
  });

  // Поиск пользователей (из базы данных)
  socket.on('search_users', async (query) => {
    const q = String(query || '').trim().toLowerCase();
    if (!q) {
      socket.emit('search_results', []);
      return;
    }
    
    try {
      // Search in database
      const result = await pool.query(
        'SELECT id, name, username, provider, avatar_url FROM users WHERE LOWER(username) LIKE $1 OR LOWER(name) LIKE $1',
        [`%${q}%`]
      );
      
      const results = result.rows.map(u => ({ 
        id: u.id, 
        name: u.name, 
        username: u.username,
        provider: u.provider,
        avatarUrl: u.avatar_url
      }));
      
      const onlineSet = new Set(Array.from(onlineUsers.values()));
      const enriched = results.map(u => ({ ...u, online: onlineSet.has(u.id) }));
      socket.emit('search_results', enriched);
    } catch (error) {
      console.error('Error searching users:', error);
      // Fallback to memory search
      const results = Array.from(users.values())
        .filter(u => (u.username && u.username.toLowerCase().includes(q)) || (u.name && u.name.toLowerCase().includes(q)))
        .map(u => ({ 
          id: u.id, 
          name: u.name, 
          username: u.username,
          provider: u.provider,
          avatarUrl: u.avatarUrl
        }));
      const onlineSet = new Set(Array.from(onlineUsers.values()));
      const enriched = results.map(u => ({ ...u, online: onlineSet.has(u.id) }));
      socket.emit('search_results', enriched);
    }
  });

  // Отправка сообщения
  socket.on('message:send', async (data) => {
    const { to, text, replyTo, type, audioUrl, audioData, duration } = data;
    const fromUserId = onlineUsers.get(socket.id);

    if (!fromUserId) return;

    // Get or create the chat for this conversation
    const chatId = await getOrCreatePrivateChat(fromUserId, to);

    const message = {
      id: uuidv4(),
      from: fromUserId,
      to,
      text,
      timestamp: Date.now(),
      edited: false,
      deleted: false,
      replyTo: replyTo || null,
      type: type || 'text',
      audioUrl: audioUrl || null,
      audioData: audioData || null,
      duration: duration || null,
      chatId // Add chatId to the message object
    };

    // Save to database - use audioData (base64) instead of audioUrl for voice messages
    try {
      const audioFieldValue = type === 'voice' ? audioData : audioUrl;
      await pool.query(
        'INSERT INTO messages (id, content, user_id, chat_id, message_type, audio_url, duration) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [message.id, message.text, fromUserId, chatId, message.type, audioFieldValue, message.duration]
      );
    } catch (error) {
      console.error('Error saving message to database:', error);
      // Continue without database if it fails
    }

    messages.push(message);

    // Отправка получателю
    const recipientSocket = Array.from(onlineUsers.entries()).find(([_, userId]) => userId === to);
    if (recipientSocket) {
      io.to(recipientSocket[0]).emit('message:received', message);
    }

    // Always send back to sender via message:sent to avoid duplication
    // The client will handle displaying the message correctly
    socket.emit('message:sent', message);
  });

  // Редактирование сообщения
  socket.on('message:edit', (data) => {
    const { messageId, newText } = data;
    const fromUserId = onlineUsers.get(socket.id);

    if (!fromUserId) return;

    const message = messages.find(m => m.id === messageId && m.from === fromUserId);
    if (message) {
      message.text = newText;
      message.edited = true;
      message.editedAt = Date.now();

      // Уведомить всех участников чата об изменении
      const recipientSocket = Array.from(onlineUsers.entries()).find(([_, userId]) => userId === message.to);
      if (recipientSocket) {
        io.to(recipientSocket[0]).emit('message:edited', message);
      }
      socket.emit('message:edited', message);
    }
  });

  // Удаление сообщения
  socket.on('message:delete', (data) => {
    const { messageId } = data;
    const fromUserId = onlineUsers.get(socket.id);

    if (!fromUserId) return;

    const message = messages.find(m => m.id === messageId && m.from === fromUserId);
    if (message) {
      message.deleted = true;
      message.deletedAt = Date.now();

      // Уведомить всех участников чата об удалении
      const recipientSocket = Array.from(onlineUsers.entries()).find(([_, userId]) => userId === message.to);
      if (recipientSocket) {
        io.to(recipientSocket[0]).emit('message:deleted', message);
      }
      socket.emit('message:deleted', message);
    }
  });

  // Реакции на сообщения
  socket.on('message:react', (data) => {
    const { messageId, emoji } = data;
    const fromUserId = onlineUsers.get(socket.id);

    if (!fromUserId) return;

    const message = messages.find(m => m.id === messageId);
    if (message) {
      if (!message.reactions) {
        message.reactions = {};
      }
      
      if (!message.reactions[emoji]) {
        message.reactions[emoji] = [];
      }

      // Удаляем предыдущую реакцию пользователя на это сообщение
      Object.keys(message.reactions).forEach(emojiKey => {
        message.reactions[emojiKey] = message.reactions[emojiKey].filter(userId => userId !== fromUserId);
        if (message.reactions[emojiKey].length === 0) {
          delete message.reactions[emojiKey];
        }
      });

      // Добавляем новую реакцию (проверяем, что emoji ключ еще существует)
      if (!message.reactions[emoji]) {
        message.reactions[emoji] = [];
      }
      message.reactions[emoji].push(fromUserId);

      // Уведомить всех участников чата о реакции
      const recipientSocket = Array.from(onlineUsers.entries()).find(([_, userId]) => userId === message.to);
      if (recipientSocket) {
        io.to(recipientSocket[0]).emit('message:reacted', { messageId, reactions: message.reactions });
      }
      socket.emit('message:reacted', { messageId, reactions: message.reactions });
    }
  });

  // Получение истории сообщений
  socket.on('messages:get', async (data) => {
    const { userId } = data;
    const currentUserId = onlineUsers.get(socket.id);

    if (!currentUserId) return;

    // Get the chat ID for this conversation
    const chatId = await getOrCreatePrivateChat(currentUserId, userId);

    // Try to load from database first
    try {
      const result = await pool.query(
        'SELECT * FROM messages WHERE chat_id = $1 ORDER BY created_at ASC',
        [chatId]
      );
      
      if (result.rows.length > 0) {
        const chatMessages = result.rows.map(row => {
          // Determine the 'to' field based on who sent the message
          const to = row.user_id === currentUserId ? userId : currentUserId;
          
          const message = {
            id: row.id,
            from: row.user_id,
            to: to,
            text: row.content,
            timestamp: new Date(row.created_at).getTime(),
            type: row.message_type || 'text',
            duration: row.duration,
            edited: false,
            deleted: false,
            chatId: row.chat_id
          };
          
          // For voice messages, use audioData field instead of audioUrl
          if (row.message_type === 'voice') {
            message.audioData = row.audio_url; // Base64 data stored in audio_url field
          } else {
            message.audioUrl = row.audio_url;
          }
          
          return message;
        });
        socket.emit('messages:history', chatMessages);
        return;
      }
    } catch (error) {
      console.error('Error loading messages from database:', error);
    }

    // Fallback to in-memory storage
    const chatMessages = messages.filter(m =>
      (m.from === currentUserId && m.to === userId) ||
      (m.from === userId && m.to === currentUserId)
    );

    socket.emit('messages:history', chatMessages);
  });

  // Mark messages as read
  socket.on('messages:mark-read', (data) => {
    const { userId } = data;
    const currentUserId = onlineUsers.get(socket.id);

    if (!currentUserId) return;

    // Mark messages as read
    messages.forEach(message => {
      if (message.from === userId && message.to === currentUserId && !message.read) {
        message.read = true;
        message.readAt = Date.now();
      }
    });

    // Notify sender that messages were read
    const senderSocket = Array.from(onlineUsers.entries()).find(([_, userId]) => userId === data.userId);
    if (senderSocket) {
      io.to(senderSocket[0]).emit('messages:read', { 
        from: currentUserId,
        readAt: Date.now()
      });
    }
  });

  // WebRTC сигналинг
  socket.on('call:initiate', (data) => {
    const { to, signal, callType } = data;
    const fromUserId = onlineUsers.get(socket.id);

    const recipientSocket = Array.from(onlineUsers.entries()).find(([_, userId]) => userId === to);
    if (recipientSocket) {
      io.to(recipientSocket[0]).emit('call:incoming', {
        from: fromUserId,
        signal,
        callType: callType || 'Voice call',
        caller: users.get(fromUserId)
      });
    }
  });

  socket.on('call:accept', (data) => {
    const { to, signal } = data;
    const fromUserId = onlineUsers.get(socket.id);
    const recipientSocket = Array.from(onlineUsers.entries()).find(([_, userId]) => userId === to);
    if (recipientSocket) {
      io.to(recipientSocket[0]).emit('call:accepted', { 
        signal,
        caller: users.get(fromUserId)
      });
    }
  });

  socket.on('call:decline', (data) => {
    const { to } = data;
    const recipientSocket = Array.from(onlineUsers.entries()).find(([_, userId]) => userId === to);
    if (recipientSocket) {
      io.to(recipientSocket[0]).emit('call:declined');
    }
  });

  socket.on('call:answer', (data) => {
    const { to, signal } = data;
    const recipientSocket = Array.from(onlineUsers.entries()).find(([_, userId]) => userId === to);
    if (recipientSocket) {
      io.to(recipientSocket[0]).emit('call:answered', { signal });
    }
  });

  socket.on('call:end', (data) => {
    const { to } = data;
    const recipientSocket = Array.from(onlineUsers.entries()).find(([_, userId]) => userId === to);
    if (recipientSocket) {
      io.to(recipientSocket[0]).emit('call:ended');
    }
  });

  // Создание канала
  socket.on('channel:create', (data) => {
    const { name, description } = data;
    const fromUserId = onlineUsers.get(socket.id);

    if (!fromUserId) return;

    const channelId = uuidv4();
    const channel = {
      id: channelId,
      name,
      description,
      members: [fromUserId],
      createdAt: Date.now(),
      createdBy: fromUserId
    };

    channels.set(channelId, channel);
    socket.emit('channel:created', channel);
  });

  // Присоединение к каналу
  socket.on('channel:join', (data) => {
    const { channelId } = data;
    const fromUserId = onlineUsers.get(socket.id);

    if (!fromUserId) return;

    const channel = channels.get(channelId);
    if (channel && !channel.members.includes(fromUserId)) {
      channel.members.push(fromUserId);
      socket.emit('channel:joined', channel);
    }
  });

  // Отправка сообщения в канал
  socket.on('channel:message', (data) => {
    const { channelId, text, replyTo } = data;
    const fromUserId = onlineUsers.get(socket.id);

    if (!fromUserId) return;

    const channel = channels.get(channelId);
    if (channel && channel.members.includes(fromUserId)) {
      const message = {
        id: uuidv4(),
        from: fromUserId,
        channelId,
        text,
        timestamp: Date.now(),
        replyTo: replyTo || null,
        edited: false,
        deleted: false
      };

      messages.push(message);

      // Отправка всем участникам канала
      channel.members.forEach(memberId => {
        const memberSocket = Array.from(onlineUsers.entries()).find(([_, userId]) => userId === memberId);
        if (memberSocket) {
          io.to(memberSocket[0]).emit('channel:message:received', message);
        }
      });
    }
  });

  // Закрепление сообщения
  socket.on('message:pin', (data) => {
    const { messageId, chatId } = data;
    const fromUserId = onlineUsers.get(socket.id);

    if (!fromUserId) return;

    const message = messages.find(m => m.id === messageId);
    if (message && (message.from === fromUserId || message.to === fromUserId)) {
      if (!pinnedMessages.has(chatId)) {
        pinnedMessages.set(chatId, []);
      }
      
      const pinned = pinnedMessages.get(chatId);
      if (!pinned.includes(messageId)) {
        pinned.push(messageId);
        socket.emit('message:pinned', { messageId, chatId });
      }
    }
  });

  // Открепление сообщения
  socket.on('message:unpin', (data) => {
    const { messageId, chatId } = data;
    const fromUserId = onlineUsers.get(socket.id);

    if (!fromUserId) return;

    const pinned = pinnedMessages.get(chatId);
    if (pinned) {
      const index = pinned.indexOf(messageId);
      if (index > -1) {
        pinned.splice(index, 1);
        socket.emit('message:unpinned', { messageId, chatId });
      }
    }
  });

  // Получение закрепленных сообщений
  socket.on('messages:pinned:get', (data) => {
    const { chatId } = data;
    const fromUserId = onlineUsers.get(socket.id);

    if (!fromUserId) return;

    const pinned = pinnedMessages.get(chatId) || [];
    const pinnedMessagesList = pinned.map(messageId => 
      messages.find(m => m.id === messageId)
    ).filter(Boolean);

    socket.emit('messages:pinned:list', pinnedMessagesList);
  });

  // Отключение
  socket.on('disconnect', () => {
    onlineUsers.delete(socket.id);
    // Broadcast updated user list on disconnect
    const userListOnDisconnect = Array.from(users.values()).map(u => ({
      id: u.id,
      name: u.name,
      username: u.username,
      online: Array.from(onlineUsers.values()).includes(u.id)
    }));
    io.emit('users:list', userListOnDisconnect);
    console.log('')
  });
});

// Middleware to prevent caching issues and add debug logging
app.use((req, res, next) => {
  if (req.url.endsWith('.css') || req.url.endsWith('.js') || req.url.endsWith('.html')) {
    console.log('Static file request:', req.url);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// Обработка статических файлов и SPA
// API endpoints for OAuth callbacks
app.use(express.json());

// Yandex OAuth token exchange endpoint
app.post('/api/yandex/token', async (req, res) => {
  try {
    const { code, redirect_uri } = req.body;
    
    if (!code || !redirect_uri) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const tokenData = await exchangeYandexCode(code, redirect_uri);
    res.json(tokenData);
  } catch (error) {
    console.error('Yandex token exchange error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Yandex user info endpoint
app.post('/api/yandex/user', async (req, res) => {
  try {
    const { access_token } = req.body;
    
    if (!access_token) {
      return res.status(400).json({ error: 'Missing access token' });
    }
    
    const userInfo = await getYandexUserInfo(access_token);
    res.json({ access_token, ...userInfo });
  } catch (error) {
    console.error('Yandex user info error:', error);
    res.status(400).json({ error: error.message });
  }
});

// OAuth callback handler for Yandex
app.get('/oauth/yandex/callback', (req, res) => {
  const { code, error } = req.query;
  
  if (error) {
    return res.send(`
      <script>
        window.opener?.postMessage({
          type: 'YANDEX_AUTH_ERROR',
          error: '${error}'
        }, window.location.origin);
        window.close();
      </script>
    `);
  }
  
  if (code) {
    return res.send(`
      <script>
        // Exchange code for token
        fetch('/api/yandex/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code: '${code}',
            redirect_uri: '${req.protocol}://${req.get('host')}/oauth/yandex/callback'
          })
        })
        .then(response => response.json())
        .then(data => {
          if (data.error) {
            throw new Error(data.error);
          }
          
          // Get user info
          return fetch('/api/yandex/user', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              access_token: data.access_token
            })
          });
        })
        .then(response => response.json())
        .then(userData => {
          window.opener?.postMessage({
            type: 'YANDEX_AUTH_SUCCESS',
            access_token: userData.access_token,
            ...userData
          }, window.location.origin);
          window.close();
        })
        .catch(error => {
          console.error('OAuth token exchange error:', error);
          window.opener?.postMessage({
            type: 'YANDEX_AUTH_ERROR',
            error: error.message
          }, window.location.origin);
          window.close();
        });
      </script>
    `);
  }
  
  res.status(400).send('Invalid OAuth callback');
});

// SPA routes MUST come before static files
app.get('/chats', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../src/index.html'));
});

app.get('/chat/:userId', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../src/index.html'));
});

// Serve static files with proper MIME types and caching
app.use(express.static(path.resolve(__dirname, '../src'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : '0',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
    } else if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
    } else if (filePath.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

// SPA fallback middleware - must be last
app.use((req, res, next) => {
  // Only handle GET requests that don't start with /api
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    console.log('Serving index.html for SPA route:', req.path);
    res.sendFile(path.resolve(__dirname, '../src/index.html'));
  } else {
    next();
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Sontha server running on port ${PORT}`);
});

// Helpers
function generateCaptcha() {
  // Генерирует только сложение, без вычитания
  const a = Math.floor(3 + Math.random() * 7); 
  const b = Math.floor(4 + Math.random() * 6); 
  const answer = a + b;
  return {
    question: `${a} + ${b} = ?`,
    answer,
    expiresAt: Date.now() + 2 * 60 * 1000 
  };
}

