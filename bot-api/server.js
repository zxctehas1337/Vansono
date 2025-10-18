const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.BOT_API_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Bot storage (in production, use database)
const bots = new Map(); // botId -> {id, name, token, userId, createdAt, isActive}
const botMessages = new Map(); // botId -> [messages]

// Bot authentication middleware
function authenticateBot(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Bot token required' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'cat909');
    const bot = bots.get(decoded.botId);
    
    if (!bot || !bot.isActive) {
      return res.status(401).json({ error: 'Invalid or inactive bot' });
    }
    
    req.bot = bot;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid bot token' });
  }
}

// Create bot
app.post('/api/bots', (req, res) => {
  const { name, userId } = req.body;
  
  if (!name || !userId) {
    return res.status(400).json({ error: 'Name and userId are required' });
  }
  
  const botId = uuidv4();
  const token = jwt.sign({ botId }, process.env.JWT_SECRET || 'cat909', { expiresIn: '365d' });
  
  const bot = {
    id: botId,
    name,
    userId,
    token,
    createdAt: Date.now(),
    isActive: true
  };
  
  bots.set(botId, bot);
  botMessages.set(botId, []);
  
  res.json({
    botId,
    token,
    name: bot.name,
    createdAt: bot.createdAt
  });
});

// Get bot info
app.get('/api/bots/me', authenticateBot, (req, res) => {
  const { id, name, userId, createdAt, isActive } = req.bot;
  res.json({
    id,
    name,
    userId,
    createdAt,
    isActive
  });
});

// Send message
app.post('/api/bots/messages', authenticateBot, (req, res) => {
  const { to, text, replyTo } = req.body;
  const bot = req.bot;
  
  if (!to || !text) {
    return res.status(400).json({ error: 'To and text are required' });
  }
  
  const message = {
    id: uuidv4(),
    from: bot.userId,
    to,
    text,
    timestamp: Date.now(),
    replyTo: replyTo || null,
    isBotMessage: true,
    botId: bot.id
  };
  
  // Store message
  const messages = botMessages.get(bot.id) || [];
  messages.push(message);
  botMessages.set(bot.id, messages);
  
  // In production, this would send to the main server
  // For now, we'll just store it locally
  console.log(`Bot ${bot.name} sent message to ${to}: ${text}`);
  
  res.json({
    messageId: message.id,
    timestamp: message.timestamp,
    status: 'sent'
  });
});

// Get bot messages
app.get('/api/bots/messages', authenticateBot, (req, res) => {
  const { limit = 50, offset = 0 } = req.query;
  const messages = botMessages.get(req.bot.id) || [];
  
  const paginatedMessages = messages
    .slice(offset, offset + parseInt(limit))
    .reverse();
  
  res.json({
    messages: paginatedMessages,
    total: messages.length,
    hasMore: offset + parseInt(limit) < messages.length
  });
});

// React to message
app.post('/api/bots/reactions', authenticateBot, (req, res) => {
  const { messageId, emoji } = req.body;
  
  if (!messageId || !emoji) {
    return res.status(400).json({ error: 'MessageId and emoji are required' });
  }
  
  // In production, this would send to the main server
  console.log(`Bot ${req.bot.name} reacted to message ${messageId} with ${emoji}`);
  
  res.json({
    messageId,
    emoji,
    status: 'reacted'
  });
});

// Pin message
app.post('/api/bots/pin', authenticateBot, (req, res) => {
  const { messageId, chatId } = req.body;
  
  if (!messageId || !chatId) {
    return res.status(400).json({ error: 'MessageId and chatId are required' });
  }
  
  // In production, this would send to the main server
  console.log(`Bot ${req.bot.name} pinned message ${messageId} in chat ${chatId}`);
  
  res.json({
    messageId,
    chatId,
    status: 'pinned'
  });
});

// Create channel
app.post('/api/bots/channels', authenticateBot, (req, res) => {
  const { name, description } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Channel name is required' });
  }
  
  const channelId = uuidv4();
  
  // In production, this would send to the main server
  console.log(`Bot ${req.bot.name} created channel: ${name}`);
  
  res.json({
    channelId,
    name,
    description,
    status: 'created'
  });
});

// Join channel
app.post('/api/bots/channels/join', authenticateBot, (req, res) => {
  const { channelId } = req.body;
  
  if (!channelId) {
    return res.status(400).json({ error: 'ChannelId is required' });
  }
  
  // In production, this would send to the main server
  console.log(`Bot ${req.bot.name} joined channel ${channelId}`);
  
  res.json({
    channelId,
    status: 'joined'
  });
});

// Send channel message
app.post('/api/bots/channels/messages', authenticateBot, (req, res) => {
  const { channelId, text, replyTo } = req.body;
  
  if (!channelId || !text) {
    return res.status(400).json({ error: 'ChannelId and text are required' });
  }
  
  const message = {
    id: uuidv4(),
    from: req.bot.userId,
    channelId,
    text,
    timestamp: Date.now(),
    replyTo: replyTo || null,
    isBotMessage: true,
    botId: req.bot.id
  };
  
  // Store message
  const messages = botMessages.get(req.bot.id) || [];
  messages.push(message);
  botMessages.set(req.bot.id, messages);
  
  // In production, this would send to the main server
  console.log(`Bot ${req.bot.name} sent message to channel ${channelId}: ${text}`);
  
  res.json({
    messageId: message.id,
    timestamp: message.timestamp,
    status: 'sent'
  });
});

// Deactivate bot
app.post('/api/bots/deactivate', authenticateBot, (req, res) => {
  req.bot.isActive = false;
  res.json({
    message: 'Bot deactivated successfully'
  });
});

// Reactivate bot
app.post('/api/bots/activate', authenticateBot, (req, res) => {
  req.bot.isActive = true;
  res.json({
    message: 'Bot activated successfully'
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`Bot API server running on port ${PORT}`);
  console.log(`API Documentation: http://localhost:${PORT}/api/docs`);
});

module.exports = app;
