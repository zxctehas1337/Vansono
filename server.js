const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Хранение данных в памяти
const rooms = new Map();
const users = new Map();

// Статические файлы
app.use(express.static(path.join(__dirname, 'public')));

// Маршрут для главной страницы
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket.io обработчики
io.on('connection', (socket) => {
    console.log('Пользователь подключился:', socket.id);

    // Присоединение к комнате
    socket.on('join-room', (data) => {
        const { username, roomId, nickname } = data;
        
        // Создать комнату если ID пустой
        const actualRoomId = roomId || uuidv4();
        
        // Сохранить информацию о пользователе
        users.set(socket.id, {
            username,
            nickname,
            roomId: actualRoomId
        });
        
        // Присоединить к комнате
        socket.join(actualRoomId);
        
        // Добавить комнату в список если её нет
        if (!rooms.has(actualRoomId)) {
            rooms.set(actualRoomId, {
                id: actualRoomId,
                users: new Map(),
                messages: []
            });
        }
        
        const room = rooms.get(actualRoomId);
        room.users.set(socket.id, { username, nickname });
        
        // Уведомить всех в комнате о новом пользователе
        socket.to(actualRoomId).emit('user-joined', { 
            username, 
            nickname, 
            userId: socket.id,
            roomId: actualRoomId 
        });
        
        // Отправить историю сообщений новому пользователю
        socket.emit('room-history', {
            roomId: actualRoomId,
            messages: room.messages,
            users: Array.from(room.users.values())
        });
        
        console.log(`${username} присоединился к комнате ${actualRoomId}`);
    });

    // Отправка сообщения
    socket.on('send-message', (data) => {
        const user = users.get(socket.id);
        if (!user) return;
        
        const room = rooms.get(user.roomId);
        if (!room) return;
        
        const message = {
            id: uuidv4(),
            text: data.text,
            username: user.username,
            nickname: user.nickname,
            timestamp: new Date().toISOString(),
            userId: socket.id
        };
        
        room.messages.push(message);
        
        // Отправить сообщение всем в комнате
        io.to(user.roomId).emit('new-message', message);
    });

    // WebRTC сигналинг
    socket.on('webrtc-offer', (data) => {
        socket.to(user.roomId).emit('webrtc-offer', {
            offer: data.offer,
            from: socket.id
        });
    });

    socket.on('webrtc-answer', (data) => {
        socket.to(data.to).emit('webrtc-answer', {
            answer: data.answer,
            from: socket.id
        });
    });

    socket.on('webrtc-ice-candidate', (data) => {
        socket.to(data.to).emit('webrtc-ice-candidate', {
            candidate: data.candidate,
            from: socket.id
        });
    });

    // Инициация звонка
    socket.on('start-call', () => {
        const user = users.get(socket.id);
        if (!user) return;
        
        socket.to(user.roomId).emit('incoming-call', {
            from: socket.id,
            fromUser: user
        });
    });

    // Отклонение звонка
    socket.on('reject-call', (data) => {
        socket.to(data.to).emit('call-rejected', {
            from: socket.id
        });
    });

    // Завершение звонка
    socket.on('end-call', () => {
        const user = users.get(socket.id);
        if (!user) return;
        
        socket.to(user.roomId).emit('call-ended', {
            from: socket.id
        });
    });

    // Отключение пользователя
    socket.on('disconnect', () => {
        const user = users.get(socket.id);
        if (user) {
            const room = rooms.get(user.roomId);
            if (room) {
                room.users.delete(socket.id);
                
                // Уведомить остальных пользователей
                socket.to(user.roomId).emit('user-left', {
                    userId: socket.id,
                    username: user.username
                });
                
                // Удалить комнату если она пустая
                if (room.users.size === 0) {
                    rooms.delete(user.roomId);
                }
            }
            
            users.delete(socket.id);
        }
        
        console.log('Пользователь отключился:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
    console.log(`Откройте http://localhost:${PORT} в браузере`);
});
