const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../config.env') });
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Хранилище данных (в продакшене использовать БД)
const users = new Map(); // userId -> {id, name, username, passwordHash, createdAt}
// Простая капча в памяти: socketId -> { question, answer, expiresAt }
const captchaChallenges = new Map();
const onlineUsers = new Map(); // socketId -> userId
const messages = []; // История сообщений
const chats = new Map(); // chatId -> {participants, messages}

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

  // Поиск пользователей (в памяти)
  socket.on('search_users', async (query) => {
    const q = String(query || '').trim().toLowerCase();
    if (!q) {
      socket.emit('search_results', []);
      return;
    }
    const results = Array.from(users.values())
      .filter(u => (u.username && u.username.toLowerCase().includes(q)) || (u.name && u.name.toLowerCase().includes(q)))
      .map(u => ({ id: u.id, name: u.name, username: u.username }));
    const onlineSet = new Set(Array.from(onlineUsers.values()));
    const enriched = results.map(u => ({ ...u, online: onlineSet.has(u.id) }));
    socket.emit('search_results', enriched);
  });

  // Отправка сообщения
  socket.on('message:send', (data) => {
    const { to, text } = data;
    const fromUserId = onlineUsers.get(socket.id);

    if (!fromUserId) return;

    const message = {
      id: uuidv4(),
      from: fromUserId,
      to,
      text,
      timestamp: Date.now()
    };

    messages.push(message);

    // Отправка получателю
    const recipientSocket = Array.from(onlineUsers.entries()).find(([_, userId]) => userId === to);
    if (recipientSocket) {
      io.to(recipientSocket[0]).emit('message:received', message);
    }

    socket.emit('message:sent', message);
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
        callType: callType || 'voice',
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

