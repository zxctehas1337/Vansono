const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), 'config.env') });

const databaseUrl = process.env.DATABASE_URL || process.env.DB_URL;

const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl && databaseUrl.includes('render.com') ? { rejectUnauthorized: false } : undefined,
});

async function runMigrations() {
    const schemaPath = path.resolve(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(schemaSql);
}

async function initDb() {
    await runMigrations();
}

module.exports = {
    pool,
    initDb,
};


