const sql = require('mssql');

async function searchUsers(query) {
  const users = await sql.query`SELECT * FROM users WHERE username LIKE '%${query}%' OR name LIKE '%${query}%'`;
  return users.recordset;
}

module.exports = { searchUsers }; //schema.sql users table