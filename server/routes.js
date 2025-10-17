const express = require('express');
const { pool } = require('./db');
const { authMiddleware, requestEmailCode, verifyEmailCode, setUsername } = require('./auth');

const router = express.Router();

// Auth endpoints
router.post('/auth/request-code', requestEmailCode);
router.post('/auth/verify-code', verifyEmailCode);
router.post('/auth/username', authMiddleware, setUsername);

// User search by username
router.get('/users/search', authMiddleware, async (req, res) => {
    const q = (req.query.q || '').toString().toLowerCase();
    if (!q || q.length < 2) return res.json({ users: [] });
    const { rows } = await pool.query(
        'SELECT id, username, avatar_url FROM users WHERE username ILIKE $1 ORDER BY username LIMIT 20',
        [q + '%']
    );
    res.json({ users: rows });
});

// Ensure chat exists between current user and target user
router.post('/chats/open', authMiddleware, async (req, res) => {
    const { userId: me } = req.user;
    const { targetUserId } = req.body || {};
    if (!targetUserId) return res.status(400).json({ error: 'targetUserId required' });
    // Check existing
    const existing = await pool.query(
        `SELECT c.id FROM chats c
         JOIN chat_participants p1 ON p1.chat_id=c.id AND p1.user_id=$1
         JOIN chat_participants p2 ON p2.chat_id=c.id AND p2.user_id=$2
         LIMIT 1`,
        [me, targetUserId]
    );
    let chatId;
    if (existing.rowCount) {
        chatId = existing.rows[0].id;
    } else {
        const created = await pool.query('INSERT INTO chats DEFAULT VALUES RETURNING id', []);
        chatId = created.rows[0].id;
        await pool.query('INSERT INTO chat_participants(chat_id, user_id) VALUES ($1,$2),($1,$3)', [chatId, me, targetUserId]);
    }
    res.json({ chatId });
});

// List chats for current user with last message
router.get('/chats', authMiddleware, async (req, res) => {
    const { userId } = req.user;
    const { rows } = await pool.query(
        `SELECT c.id as chat_id,
                (SELECT m.text FROM messages m WHERE m.chat_id=c.id ORDER BY m.sent_at DESC LIMIT 1) as last_text,
                (SELECT m.sent_at FROM messages m WHERE m.chat_id=c.id ORDER BY m.sent_at DESC LIMIT 1) as last_time,
                json_agg(json_build_object('id', u.id, 'username', u.username, 'avatar_url', u.avatar_url)) FILTER (WHERE u.id <> $1) as participants
         FROM chats c
         JOIN chat_participants cp ON cp.chat_id=c.id
         JOIN users u ON u.id=cp.user_id
         WHERE c.id IN (SELECT chat_id FROM chat_participants WHERE user_id=$1)
         GROUP BY c.id
         ORDER BY last_time DESC NULLS LAST`,
        [userId]
    );
    res.json({ chats: rows });
});

// Get messages in a chat
router.get('/chats/:chatId/messages', authMiddleware, async (req, res) => {
    const { userId } = req.user;
    const chatId = Number(req.params.chatId);
    const member = await pool.query('SELECT 1 FROM chat_participants WHERE chat_id=$1 AND user_id=$2', [chatId, userId]);
    if (!member.rowCount) return res.status(403).json({ error: 'Forbidden' });
    const { rows } = await pool.query('SELECT id, sender_id, text, sent_at FROM messages WHERE chat_id=$1 ORDER BY sent_at ASC LIMIT 500', [chatId]);
    res.json({ messages: rows });
});

// Send a message (REST fallback if socket not available)
router.post('/chats/:chatId/messages', authMiddleware, async (req, res) => {
    const { userId } = req.user;
    const chatId = Number(req.params.chatId);
    const { text } = req.body || {};
    if (!text || typeof text !== 'string') return res.status(400).json({ error: 'Invalid text' });
    const member = await pool.query('SELECT 1 FROM chat_participants WHERE chat_id=$1 AND user_id=$2', [chatId, userId]);
    if (!member.rowCount) return res.status(403).json({ error: 'Forbidden' });
    const { rows } = await pool.query(
        'INSERT INTO messages(chat_id, sender_id, text) VALUES ($1,$2,$3) RETURNING id, sender_id, text, sent_at',
        [chatId, userId, text]
    );
    res.json({ message: rows[0] });
});

module.exports = router;


