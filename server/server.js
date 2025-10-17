const path = require('path');
const express = require('express');
const http = require('http');
const cors = require('cors');
const dotenv = require('dotenv');
const { initDb, pool } = require('./db');
const apiRoutes = require('./routes');
const passport = require('passport');
const { configureGoogle } = require('./google');

dotenv.config({ path: path.resolve(process.cwd(), 'config.env') });

const app = express();
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.resolve(process.cwd(), 'public')));
app.use(passport.initialize());
configureGoogle(passport);
app.get('/api/auth/google', passport.authenticate('google', { scope: ['email', 'profile'] }));
app.get('/api/auth/google/callback', passport.authenticate('google', { session: false, failureRedirect: '/' }), (req, res) => {
    const { token, needsUsername } = req.user;
    const redirectUrl = `/#oauth=1&token=${encodeURIComponent(token)}&needs=${needsUsername?1:0}`;
    res.redirect(redirectUrl);
});
app.use('/api', apiRoutes);

app.get('/health', async (req, res) => {
    try {
        const r = await pool.query('SELECT 1 as ok');
        res.json({ status: 'ok', db: r.rows[0].ok === 1 });
    } catch (e) {
        res.status(500).json({ status: 'error', error: e.message });
    }
});

io.on('connection', (socket) => {
    // Basic rooms: user:USER_ID
    socket.on('auth', (userId) => {
        if (userId) socket.join(`user:${userId}`);
    });

    // Messaging via sockets
    socket.on('message:send', async ({ chatId, senderId, text }) => {
        if (!chatId || !senderId || !text) return;
        const member = await pool.query('SELECT 1 FROM chat_participants WHERE chat_id=$1 AND user_id=$2', [chatId, senderId]);
        if (!member.rowCount) return;
        const { rows } = await pool.query(
            'INSERT INTO messages(chat_id, sender_id, text) VALUES ($1,$2,$3) RETURNING id, sender_id, text, sent_at',
            [chatId, senderId, text]
        );
        // Notify all participants
        const participants = await pool.query('SELECT user_id FROM chat_participants WHERE chat_id=$1', [chatId]);
        for (const p of participants.rows) {
            io.to(`user:${p.user_id}`).emit('message:new', { chatId, message: rows[0] });
            io.to(`user:${p.user_id}`).emit('chats:update', { chatId });
        }
    });

    // Simple signaling for WebRTC
    socket.on('call:offer', ({ toUserId, fromUserId, sdp }) => {
        io.to(`user:${toUserId}`).emit('call:offer', { fromUserId, sdp });
    });
    socket.on('call:answer', ({ toUserId, fromUserId, sdp }) => {
        io.to(`user:${toUserId}`).emit('call:answer', { fromUserId, sdp });
    });
    socket.on('call:ice', ({ toUserId, fromUserId, candidate }) => {
        io.to(`user:${toUserId}`).emit('call:ice', { fromUserId, candidate });
    });
    socket.on('call:hangup', ({ toUserId, fromUserId }) => {
        io.to(`user:${toUserId}`).emit('call:hangup', { fromUserId });
    });
    socket.on('disconnect', () => {});
});

const PORT = process.env.PORT || 3000;

initDb()
    .then(() => {
        server.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
    })
    .catch((err) => {
        console.error('Failed to init DB', err);
        process.exit(1);
    });

