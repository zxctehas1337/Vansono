const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { pool } = require('./db');
require('dotenv').config({ path: path.resolve(process.cwd(), 'config.env') });

const jwtSecret = process.env.JWT_SECRET || 'devsecret';

function signJwt(payload, expiresIn = '30d') {
    return jwt.sign(payload, jwtSecret, { expiresIn });
}

function authMiddleware(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    try {
        const data = jwt.verify(token, jwtSecret);
        req.user = data;
        next();
    } catch (e) {
        return res.status(401).json({ error: 'Invalid token' });
    }
}

function buildTransport() {
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: false,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
    return transporter;
}

async function sendEmailCode(toEmail, code) {
    const transporter = buildTransport();
    const from = process.env.SMTP_FROM || `Vansono <${process.env.SMTP_USER}>`;
    await transporter.sendMail({
        from,
        to: toEmail,
        subject: 'Your Vansono verification code',
        text: `Your verification code is: ${code}`,
        html: `<p>Your verification code is: <b>${code}</b></p>`,
    });
}

async function requestEmailCode(req, res) {
    const { email } = req.body || {};
    if (!email || typeof email !== 'string') return res.status(400).json({ error: 'Invalid email' });
    const code = (Math.floor(100000 + Math.random() * 900000)).toString();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await pool.query(
        'INSERT INTO verification_codes(email, code_hash, expires_at) VALUES ($1, $2, $3)',
        [email.toLowerCase(), codeHash, expiresAt]
    );
    try {
        await sendEmailCode(email, code);
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to send code' });
    }
}

async function verifyEmailCode(req, res) {
    const { email, code } = req.body || {};
    if (!email || !code) return res.status(400).json({ error: 'Invalid payload' });
    const { rows } = await pool.query(
        'SELECT * FROM verification_codes WHERE email=$1 ORDER BY created_at DESC LIMIT 5',
        [email.toLowerCase()]
    );
    const now = new Date();
    let ok = false;
    for (const row of rows) {
        if (new Date(row.expires_at) < now) continue;
        if (await bcrypt.compare(code, row.code_hash)) { ok = true; break; }
    }
    if (!ok) return res.status(400).json({ error: 'Invalid or expired code' });
    // Ensure user exists (without username yet)
    const userRes = await pool.query('SELECT id, email, username FROM users WHERE email=$1', [email.toLowerCase()]);
    let userId;
    let needsUsername = false;
    if (userRes.rowCount === 0) {
        const inserted = await pool.query(
            'INSERT INTO users(email, username) VALUES ($1, $2) RETURNING id, email, username',
            [email.toLowerCase(), `user_${crypto.randomBytes(3).toString('hex')}`]
        );
        userId = inserted.rows[0].id;
        // mark needs username change
        needsUsername = true;
    } else {
        userId = userRes.rows[0].id;
        needsUsername = !userRes.rows[0].username;
    }
    const token = signJwt({ userId, email: email.toLowerCase() });
    res.json({ token, needsUsername });
}

async function setUsername(req, res) {
    const { username } = req.body || {};
    if (!username || !/^\w{3,20}$/.test(username)) return res.status(400).json({ error: 'Invalid username' });
    try {
        const { rowCount } = await pool.query('UPDATE users SET username=$1 WHERE id=$2', [username.toLowerCase(), req.user.userId]);
        if (!rowCount) return res.status(404).json({ error: 'User not found' });
        return res.json({ ok: true });
    } catch (e) {
        if (e.code === '23505') return res.status(409).json({ error: 'Username taken' });
        return res.status(500).json({ error: 'Failed to set username' });
    }
}

module.exports = {
    authMiddleware,
    requestEmailCode,
    verifyEmailCode,
    setUsername,
    signJwt,
};


