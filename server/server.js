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

// Socket.IO обработчики
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

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
    if (String(captchaAnswer).trim() !== String(challenge.answer)) {
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

    socket.emit('register:success', {
      user: users.get(userId),
      message: 'Registration successful'
    });

    // After successful registration, broadcast to all users
    socket.on('register', async (data) => {
      // ... existing registration code ...
    
    // After successful registration
    const userList = Array.from(users.values()).map(u => ({
      id: u.id,
      name: u.name,
      username: u.username,
      online: Array.from(onlineUsers.values()).includes(u.id)
    }));
    
    // Broadcast to all connected clients
    io.emit('users:list', userList);
    });
    
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
      console.log('Client disconnected:', socket.id);
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
    if (String(captchaAnswer).trim() !== String(challenge.answer)) {
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

  // WebRTC сигналинг
  socket.on('call:initiate', (data) => {
    const { to, signal } = data;
    const fromUserId = onlineUsers.get(socket.id);

    const recipientSocket = Array.from(onlineUsers.entries()).find(([_, userId]) => userId === to);
    if (recipientSocket) {
      io.to(recipientSocket[0]).emit('call:incoming', {
        from: fromUserId,
        signal,
        caller: users.get(fromUserId)
      });
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
    console.log('Client disconnected:', socket.id);
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
  // Ensure a is always larger than b for subtraction
  const a = Math.floor(5 + Math.random() * 5); // 5-9
  const b = Math.floor(1 + Math.random() * 4); // 1-4
  const op = Math.random() > 0.5 ? '+' : '-';
  const answer = op === '+' ? a + b : a - b;
  return {
    question: `${a} ${op} ${b} = ?`,
    answer,
    expiresAt: Date.now() + 2 * 60 * 1000 // 2 minutes
  };
}

// In the register and login handlers, modify the captcha validation:
if (parseInt(captchaAnswer) !== challenge.answer) {
  socket.emit('register:error', { message: 'Invalid captcha' });
  return;
}
