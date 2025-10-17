const prisma = require('./database');

async function searchUsers(query) {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { username: { contains: query, mode: 'insensitive' } },
        { name: { contains: query, mode: 'insensitive' } }
      ]
    },
    select: {
      id: true,
      username: true,
      name: true
    }
  });
  // online computed at socket layer; return raw users
  return users;
}

module.exports = { searchUsers };