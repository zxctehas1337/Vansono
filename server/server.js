const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../config.env') });
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

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
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        username VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id VARCHAR(255) PRIMARY KEY,
        content TEXT NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        chat_id VARCHAR(255) NOT NULL,
        message_type VARCHAR(50) DEFAULT 'text',
        audio_url TEXT,
        duration INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chats (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        chat_type VARCHAR(50) DEFAULT 'private',
        created_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_participants (
        id SERIAL PRIMARY KEY,
        chat_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chat_id) REFERENCES chats(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE(chat_id, user_id)
      )
    `);
    
    console.log('Database tables initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
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
        createdAt: user.created_at
      });
    });
    console.log(`Loaded ${users.size} users from database`);
  } catch (error) {
    console.error('Error loading users from database:', error);
  }
}

// Initialize database
initializeDatabase().then(() => {
  loadUsersFromDatabase();
});

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
    
    // Save to database
    await pool.query(
      'INSERT INTO users (id, name, username, password_hash) VALUES ($1, $2, $3, $4)',
      [userId, name, normalized, passwordHash]
    );
    
    // Save to memory for quick access
    users.set(userId, {
      id: userId,
      name,
      username: normalized,
      passwordHash,
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
  const JWT_SECRET = process.env.JWT_SECRET || 'cat909';
  
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
    const user = Array.from(users.values()).find(u => u.username === normalized);
    if (!user) {
      socket.emit('login:error', { message: 'User not found' });
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
        'SELECT id, name, username FROM users WHERE LOWER(username) LIKE $1 OR LOWER(name) LIKE $1',
        [`%${q}%`]
      );
      
      const results = result.rows.map(u => ({ 
        id: u.id, 
        name: u.name, 
        username: u.username 
      }));
      
      const onlineSet = new Set(Array.from(onlineUsers.values()));
      const enriched = results.map(u => ({ ...u, online: onlineSet.has(u.id) }));
      socket.emit('search_results', enriched);
    } catch (error) {
      console.error('Error searching users:', error);
      // Fallback to memory search
      const results = Array.from(users.values())
        .filter(u => (u.username && u.username.toLowerCase().includes(q)) || (u.name && u.name.toLowerCase().includes(q)))
        .map(u => ({ id: u.id, name: u.name, username: u.username }));
      const onlineSet = new Set(Array.from(onlineUsers.values()));
      const enriched = results.map(u => ({ ...u, online: onlineSet.has(u.id) }));
      socket.emit('search_results', enriched);
    }
  });

  // Отправка сообщения
  socket.on('message:send', async (data) => {
    const { to, text, isCallHistory, replyTo, type, audioUrl, duration } = data;
    const fromUserId = onlineUsers.get(socket.id);

    if (!fromUserId) return;

    const message = {
      id: uuidv4(),
      from: fromUserId,
      to,
      text,
      timestamp: Date.now(),
      isCallHistory: isCallHistory || false,
      edited: false,
      deleted: false,
      replyTo: replyTo || null,
      type: type || 'text',
      audioUrl: audioUrl || null,
      duration: duration || null
    };

    // Save to database
    try {
      await pool.query(
        'INSERT INTO messages (id, content, user_id, chat_id, message_type, audio_url, duration) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [message.id, message.text, fromUserId, to, message.type, message.audioUrl, message.duration]
      );
    } catch (error) {
      console.error('Error saving message to database:', error);
    }

    messages.push(message);

    // Отправка получателю
    const recipientSocket = Array.from(onlineUsers.entries()).find(([_, userId]) => userId === to);
    if (recipientSocket) {
      io.to(recipientSocket[0]).emit('message:received', message);
    }

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

      // Добавляем новую реакцию
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
  socket.on('messages:get', (data) => {
    const { userId } = data;
    const currentUserId = onlineUsers.get(socket.id);

    if (!currentUserId) return;

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

// Обработка статических файлов и SPA
app.use(express.static(path.resolve(__dirname, '../src')));
app.use((_, res) => res.sendFile(path.resolve(__dirname, '../src/index.html')));

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

