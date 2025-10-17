const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');

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

// Настройка email (в продакшене использовать настоящий SMTP)
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: 'your-email@gmail.com', // Заменить на реальный email
    pass: 'your-app-password' // Заменить на app password
  }
});

// Socket.IO обработчики
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Регистрация: отправка кода верификации
  socket.on('register:request', async (data) => {
    const { email, name, username } = data;
    
    // Проверка уникальности email и username
    const emailExists = Array.from(users.values()).some(u => u.email === email);
    const usernameExists = Array.from(users.values()).some(u => u.username === username);
    
    if (emailExists) {
      socket.emit('register:error', { message: 'Email already registered' });
      return;
    }
    
    if (usernameExists) {
      socket.emit('register:error', { message: 'Username already taken' });
      return;
    }

    // Генерация 6-значного кода
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    verificationCodes.set(email, { code, name, username, timestamp: Date.now() });

    // Отправка email (закомментировано для демо)
    /*
    try {
      await transporter.sendMail({
        from: '"Sontha" <your-email@gmail.com>',
        to: email,
        subject: 'Verification Code - Sontha',
        html: `<h2>Your verification code is: ${code}</h2><p>Valid for 10 minutes.</p>`
      });
    } catch (error) {
      console.error('Email send error:', error);
    }
    */

    console.log(`Verification code for ${email}: ${code}`);
    socket.emit('register:code-sent', { message: 'Verification code sent to email' });
  });

  // Верификация кода
  socket.on('register:verify', (data) => {
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

    // Создание пользователя
    const userId = uuidv4();
    users.set(userId, {
      id: userId,
      email,
      name: storedData.name,
      username: storedData.username,
      createdAt: Date.now()
    });

    verificationCodes.delete(email);
    onlineUsers.set(socket.id, userId);

    socket.emit('register:success', {
      user: users.get(userId),
      message: 'Registration successful'
    });
  });

  // Логин
  socket.on('login', (data) => {
    const { username } = data;
    const user = Array.from(users.values()).find(u => u.username === username);

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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Sontha server running on port ${PORT}`);
});
