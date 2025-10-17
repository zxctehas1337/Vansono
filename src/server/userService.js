const prisma = require('../server/database'); //prisma client

async function searchUsers(query) {
  const users = await prisma.user.findMany({
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
  return users;
}

module.exports = { searchUsers }; //schema.sql users table