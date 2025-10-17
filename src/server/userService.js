const prisma = require('../server/database'); //prisma client

async function searchUsers(query) {
  let users = [];
  try {
    users = await prisma.user.findMany({
      where: {
        username: {
          contains: query,
          mode: 'insensitive'
        }
      },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        createdAt: true
      }
    });
  } catch (_e) {
    // Fallback if username column doesn't exist: search by name
    users = await prisma.user.findMany({
      where: {
        name: {
          contains: query,
          mode: 'insensitive'
        }
      },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        createdAt: true
      }
    });
  }
  return users;
}

module.exports = { searchUsers }; //schema.sql users table