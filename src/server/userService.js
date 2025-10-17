const prisma = require('./database');

async function searchUsers(query) {
  return prisma.user.findMany({
    where: {
      OR: [
        { username: { contains: query, mode: 'insensitive' } },
        { name: { contains: query, mode: 'insensitive' } }
      ]
    },
    select: {
      id: true,
      username: true,
      name: true,
      online: true
    }
  });
}

module.exports = { searchUsers };