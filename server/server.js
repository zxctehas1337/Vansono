const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname, '../public')));

// Store active rooms
const rooms = new Map();

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join room
  socket.on('join-room', (roomId, username) => {
    socket.join(roomId);
    socket.roomId = roomId;
    socket.username = username;

    // Initialize room if it doesn't exist
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        users: new Map(),
        messages: [],
        activeCall: null
      });
    }

    const room = rooms.get(roomId);
    room.users.set(socket.id, {
      id: socket.id,
      username: username,
      isInCall: false
    });

    // Notify others in the room
    socket.to(roomId).emit('user-joined', {
      id: socket.id,
      username: username
    });

    // Send room info to the user
    socket.emit('room-info', {
      users: Array.from(room.users.values()),
      messages: room.messages.slice(-50), // Last 50 messages
      activeCall: room.activeCall
    });

    console.log(`User ${username} joined room ${roomId}`);
  });

  // Handle chat messages
  socket.on('chat-message', (data) => {
    const room = rooms.get(socket.roomId);
    if (room) {
      const message = {
        id: Date.now(),
        username: socket.username,
        message: data.message,
        timestamp: new Date().toISOString()
      };

      room.messages.push(message);
      
      // Broadcast to all users in the room
      io.to(socket.roomId).emit('chat-message', message);
    }
  });

  // WebRTC signaling
  socket.on('offer', (data) => {
    socket.to(data.target).emit('offer', {
      offer: data.offer,
      sender: socket.id
    });
  });

  socket.on('answer', (data) => {
    socket.to(data.target).emit('answer', {
      answer: data.answer,
      sender: socket.id
    });
  });

  socket.on('ice-candidate', (data) => {
    socket.to(data.target).emit('ice-candidate', {
      candidate: data.candidate,
      sender: socket.id
    });
  });

  // Call management
  socket.on('start-call', (data) => {
    const room = rooms.get(socket.roomId);
    if (room && room.users.size > 1) {
      // Check if there's already an active call
      if (room.activeCall) {
        socket.emit('call-error', { message: 'В комнате уже идет звонок' });
        return;
      }
      
      room.activeCall = {
        caller: socket.id,
        callerName: socket.username,
        callType: data.callType,
        participants: [socket.id]
      };
      
      room.users.get(socket.id).isInCall = true;
      
      // Send call to other users in the room
      socket.to(socket.roomId).emit('call-started', {
        caller: socket.id,
        callerName: socket.username,
        callType: data.callType
      });
      
      console.log(`Call started by ${socket.username} in room ${socket.roomId}`);
    } else {
      socket.emit('call-error', { message: 'В комнате нет других пользователей' });
    }
  });

  socket.on('end-call', () => {
    const room = rooms.get(socket.roomId);
    if (room && room.activeCall) {
      // Reset all users' call status
      room.users.forEach(user => {
        user.isInCall = false;
      });
      
      // Clear active call
      room.activeCall = null;
      
      // Notify all users in the room
      io.to(socket.roomId).emit('call-ended', {
        caller: socket.id
      });
      
      console.log(`Call ended by ${socket.username} in room ${socket.roomId}`);
    }
  });

  socket.on('call-accepted', (data) => {
    const room = rooms.get(socket.roomId);
    if (room && room.activeCall) {
      room.activeCall.participants.push(socket.id);
      room.users.get(socket.id).isInCall = true;
      
      socket.to(data.target).emit('call-accepted', {
        acceptor: socket.id,
        acceptorName: socket.username
      });
      
      console.log(`Call accepted by ${socket.username}`);
    }
  });

  socket.on('call-rejected', (data) => {
    const room = rooms.get(socket.roomId);
    if (room && room.activeCall) {
      // Clear active call if rejected
      room.activeCall = null;
      room.users.get(data.target).isInCall = false;
      
      socket.to(data.target).emit('call-rejected', {
        rejector: socket.id,
        rejectorName: socket.username
      });
      
      console.log(`Call rejected by ${socket.username}`);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    if (socket.roomId) {
      const room = rooms.get(socket.roomId);
      if (room) {
        // If user was in a call, end the call
        if (room.activeCall && room.activeCall.participants.includes(socket.id)) {
          room.activeCall = null;
          room.users.forEach(user => {
            user.isInCall = false;
          });
          
          // Notify others about call end
          socket.to(socket.roomId).emit('call-ended', {
            caller: socket.id,
            reason: 'user-disconnected'
          });
        }
        
        room.users.delete(socket.id);
        
        // Notify others in the room
        socket.to(socket.roomId).emit('user-left', {
          id: socket.id,
          username: socket.username
        });

        // Clean up empty rooms
        if (room.users.size === 0) {
          rooms.delete(socket.roomId);
          console.log(`Room ${socket.roomId} deleted`);
        }
      }
    }
  });
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Generate random room ID
app.get('/api/room-id', (req, res) => {
  const roomId = Math.random().toString(36).substring(2, 15);
  res.json({ roomId });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
