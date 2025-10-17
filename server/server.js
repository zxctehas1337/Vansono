const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../config.env') });
const { sendVerificationCode } = require('../src/server/emailService');
const prisma = require('../src/server/database');
const { searchUsers } = require('../src/server/userService');
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Хранилище данных (в продакшене использовать БД)
const users = new Map(); // userId -> {email, name, username, password}
const verificationCodes = new Map(); // email -> code
const onlineUsers = new Map(); // socketId -> userId
const messages = []; // История сообщений
const chats = new Map(); // chatId -> {participants, messages}

// Email now handled via src/server/emailService using SMTP envs

// Socket.IO обработчики
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Регистрация: отправка кода верификации
  socket.on('register:request', async (data) => {
    const { email, name, username } = data;
    
    // Проверка уникальности email и username (первично по памяти, затем в БД)
    const emailExists = Array.from(users.values()).some(u => u.email === email);
    const usernameExists = Array.from(users.values()).some(u => u.username === username);
    let dbEmailExists = false;
    let dbUsernameExists = false;
    try {
      const emailUser = await prisma.user.findUnique({ where: { email } });
      const usernameUser = await prisma.user.findUnique({ where: { username } });
      dbEmailExists = Boolean(emailUser);
      dbUsernameExists = Boolean(usernameUser);
    } catch (e) {
      console.error('DB check error:', e);
    }
    
    if (emailExists || dbEmailExists) {
      socket.emit('register:error', { message: 'Email already registered' });
      return;
    }
    
    if (usernameExists || dbUsernameExists) {
      socket.emit('register:error', { message: 'Username already taken' });
      return;
    }

    // Генерация 6-значного кода
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    verificationCodes.set(email, { code, name, username, timestamp: Date.now() });

    // Отправка кода на реальную почту
    try {
      await sendVerificationCode(email, code);
    } catch (error) {
      console.error('Email send error:', error);
    }

    socket.emit('register:code-sent', { message: 'Verification code sent to email' });
  });

  // Верификация кода
  socket.on('register:verify', async (data) => {
    const { email, code } = data;
    const storedData = verificationCodes.get(email);

    if (!storedData) {
      socket.emit('register:error', { message: 'No verification code found' });
      return;
    }

    // Проверка времени (10 минут)
    if (Date.now() - storedData.timestamp > 10 * 60 * 1000) {
      verificationCodes.delete(email);
      socket.emit('register:error', { message: 'Verification code expired' });
      return;
    }

    if (storedData.code !== code) {
      socket.emit('register:error', { message: 'Invalid verification code' });
      return;
    }

    // Создание пользователя (БД + память)
    let dbUser;
    try {
      dbUser = await prisma.user.create({
        data: {
          email,
          name: storedData.name,
          username: storedData.username
        },
        select: { id: true, email: true, name: true, username: true, createdAt: true }
      });
    } catch (e) {
      console.error('DB create user error:', e);
      socket.emit('register:error', { message: 'Failed to create user' });
      return;
    }

    const userId = dbUser.id || uuidv4();
    users.set(userId, {
      id: userId,
      email: dbUser.email,
      name: dbUser.name,
      username: dbUser.username,
      createdAt: dbUser.createdAt ? new Date(dbUser.createdAt).getTime() : Date.now()
    });

    verificationCodes.delete(email);
    onlineUsers.set(socket.id, userId);

    socket.emit('register:success', {
      user: users.get(userId),
      message: 'Registration successful'
    });
  });

  // Логин
  socket.on('login', async (data) => {
    const { username } = data;
    const normalized = username.startsWith('@') ? username.slice(1) : username;
    let user = Array.from(users.values()).find(u => u.username === normalized);

    if (!user) {
      try {
        const dbUser = await prisma.user.findUnique({ where: { username: normalized } });
        if (dbUser) {
          user = {
            id: dbUser.id,
            email: dbUser.email,
            name: dbUser.name,
            username: dbUser.username,
            createdAt: new Date(dbUser.createdAt).getTime()
          };
          users.set(dbUser.id, user);
        }
      } catch (e) {
        console.error('DB login find error:', e);
      }
    }

    if (!user) {
      socket.emit('login:error', { message: 'User not found' });
      return;
    }

    onlineUsers.set(socket.id, user.id);
    socket.emit('login:success', { user });
    
    // Отправка списка пользователей
    const userList = Array.from(users.values()).map(u => ({
      id: u.id,
      name: u.name,
      username: u.username,
      online: Array.from(onlineUsers.values()).includes(u.id)
    }));
    socket.emit('users:list', userList);
  });
  // Поиск пользователей
  socket.on('search_users', async (query) => {
    try {
      const results = await searchUsers(query);
      const onlineSet = new Set(Array.from(onlineUsers.values()));
      const enriched = results.map(u => ({
        id: u.id,
        name: u.name,
        username: u.username,
        online: onlineSet.has(u.id)
      }));
      socket.emit('search_results', enriched);
    } catch (e) {
      console.error('search_users error:', e);
      socket.emit('search_results', []);
    }
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
