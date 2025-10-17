const path = require('path');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { pool } = require('./db');
const { signJwt } = require('./auth');
require('dotenv').config({ path: path.resolve(process.cwd(), 'config.env') });

const CLIENT_ID = process.env.CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;

function configureGoogle(passportInstance){
    passportInstance.use(new GoogleStrategy({
        clientID: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        callbackURL: '/api/auth/google/callback'
    }, async (accessToken, refreshToken, profile, done) => {
        try{
            const email = (profile.emails && profile.emails[0] && profile.emails[0].value || '').toLowerCase();
            if(!email) return done(null, false);
            let user = await pool.query('SELECT id, email, username FROM users WHERE email=$1', [email]);
            let userId; let needsUsername = false;
            if(user.rowCount===0){
                const username = (profile.username || (profile.displayName||'').split(' ')[0] || 'user').toLowerCase().replace(/[^a-z0-9_]/g,'').slice(0,20) || `user_${Date.now()}`;
                const inserted = await pool.query('INSERT INTO users(email, username) VALUES ($1,$2) RETURNING id, username', [email, username]);
                userId = inserted.rows[0].id;
                needsUsername = false; // we attempted to set one; allow user to change later via settings
            } else {
                userId = user.rows[0].id;
                needsUsername = !user.rows[0].username;
            }
            const token = signJwt({ userId, email });
            return done(null, { token, needsUsername });
        }catch(err){ return done(err); }
    }));
}

module.exports = { configureGoogle };


