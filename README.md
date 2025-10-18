# Sontha Messenger - Enhanced Edition

A modern, secure messenger with advanced features including message editing, reactions, channels, bot automation, and more.

## ✨ New Features Added

### 🔧 Message Management
- **Edit Messages**: Edit your sent messages with visual indicators
- **Delete Messages**: Delete messages with confirmation
- **Message Reactions**: React to messages with emojis (👍, ❤️, 😂, etc.)
- **Message Replies**: Reply to specific messages with threading
- **Pinned Messages**: Pin important messages in chats

### 📢 Channels & Broadcasting
- **Public Channels**: Create and manage public channels
- **Channel Messages**: Send messages to multiple users
- **Channel Management**: Join/leave channels, manage members

### 🤖 Bot API (Monthy)
- **Python SDK**: Easy-to-use Python SDK for bot development
- **Auto-Reply Bots**: Create intelligent auto-reply systems
- **Echo Bots**: Simple echo functionality
- **Custom Bots**: Build your own bot logic
- **REST API**: Full REST API for bot management

### 🔔 Notifications
- **Desktop Notifications**: Native desktop notifications
- **Push Notifications**: Browser push notifications
- **Sound Alerts**: Audio notifications for new messages

### 🎨 Enhanced UI
- **Message Actions**: Right-click context menus
- **Reaction Picker**: Easy emoji selection
- **Reply Indicators**: Visual reply threading
- **Channel UI**: Dedicated channel interface
- **Responsive Design**: Mobile-friendly interface

## 🚀 Quick Start

### 1. Install Dependencies

```bash
# Main application
npm install

# Bot API (optional)
cd bot-api
npm install
```

### 2. Start the Main Server

```bash
npm start
```

The messenger will be available at `http://localhost:3000`

### 3. Start Bot API (Optional)

```bash
cd bot-api
npm start
```

The Bot API will be available at `http://localhost:3001`

### 4. Install Python SDK (Optional)

```bash
cd bot-api/python-sdk
pip install -r requirements.txt
```

## 🤖 Bot Development

### Create Your First Bot

```python
from monthy_bot import BotManager, EchoBot

# Create bot manager
manager = BotManager("http://localhost:3001")

# Create a new bot
bot = manager.create_bot("MyBot", "your_user_id")

# Create echo bot
echo_bot = EchoBot(bot.bot_id, bot.token)
echo_bot.start_echo_service()
```

### Run Example Bots

```bash
# Echo Bot
cd bot-api/examples
python echo_bot.py

# Auto-Reply Bot
python auto_reply_bot.py
```

## 📱 Features Overview

### Message Features
- ✅ Edit messages with "edited" indicator
- ✅ Delete messages with confirmation
- ✅ React with emojis (👍, ❤️, 😂, 😮, 😢, 😡, 🎉)
- ✅ Reply to specific messages
- ✅ Pin important messages
- ✅ Message forwarding
- ✅ Voice messages
- ✅ Secret chats with encryption

### Channel Features
- ✅ Create public channels
- ✅ Join/leave channels
- ✅ Send messages to channels
- ✅ Channel member management
- ✅ Channel descriptions

### Bot API Features
- ✅ REST API for bot management
- ✅ Python SDK with examples
- ✅ Auto-reply functionality
- ✅ Message reactions via API
- ✅ Channel management via API
- ✅ Bot authentication
- ✅ Message history

### UI/UX Features
- ✅ Dark/Light themes
- ✅ Responsive design
- ✅ Desktop notifications
- ✅ Sound alerts
- ✅ Message context menus
- ✅ Reaction picker
- ✅ Reply indicators
- ✅ Channel interface

## 🛠️ Development

### Project Structure

```
Vansono/
├── src/                    # Frontend source
│   ├── app.js             # Main application logic
│   ├── index.html         # HTML structure
│   └── styles.css         # CSS styles
├── server/                # Backend server
│   └── server.js          # Socket.IO server
├── bot-api/               # Bot API server
│   ├── server.js          # Bot API server
│   ├── python-sdk/        # Python SDK
│   └── examples/          # Bot examples
└── package.json           # Dependencies
```

### API Endpoints

#### Main Server (Port 3000)
- WebSocket connection for real-time messaging
- User authentication
- Message handling
- Channel management

#### Bot API (Port 3001)
- `POST /api/bots` - Create bot
- `GET /api/bots/me` - Get bot info
- `POST /api/bots/messages` - Send message
- `POST /api/bots/reactions` - React to message
- `POST /api/bots/channels` - Create channel
- `POST /api/bots/channels/join` - Join channel

## 🎯 Usage Examples

### Message Reactions
1. Click the "+" button on any message
2. Select an emoji from the picker
3. See the reaction count update in real-time

### Message Replies
1. Right-click on a message
2. Select "Reply"
3. Type your response
4. The original message is quoted

### Channel Creation
1. Click "Create Channel" in the sidebar
2. Enter channel name and description
3. Start broadcasting to all members

### Bot Development
```python
# Custom bot example
class WeatherBot(MonthlyBot):
    def get_weather(self, city):
        return f"Weather in {city}: Sunny, 25°C"
    
    def handle_weather_request(self, message):
        if "weather" in message['text'].lower():
            city = message['text'].split()[-1]
            weather = self.get_weather(city)
            self.send_message(message['from'], weather)
```

## 🔧 Configuration

### Environment Variables
```bash
# Main server
PORT=3000
JWT_SECRET=your_secret_key

# Bot API
BOT_API_PORT=3001
```

### Bot Configuration
```python
# Bot settings
BOT_CHECK_INTERVAL=5  # seconds
BOT_MAX_MESSAGES=50
BOT_AUTO_REPLY=True
```

## 📚 Documentation

- [Bot API Documentation](bot-api/README.md)
- [Python SDK Guide](bot-api/python-sdk/)
- [API Reference](bot-api/README.md#api-endpoints)
- [Example Bots](bot-api/examples/)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

- GitHub Issues: [Create an issue](https://github.com/your-repo/issues)
- Documentation: [Read the docs](bot-api/README.md)
- Examples: [Check examples](bot-api/examples/)

## 🎉 What's New

### Version 2.0 - Enhanced Features
- ✅ Message editing and deletion
- ✅ Emoji reactions system
- ✅ Message reply threading
- ✅ Public channels
- ✅ Bot API with Python SDK
- ✅ Desktop notifications
- ✅ Pinned messages
- ✅ Enhanced UI/UX

### Upcoming Features
- 🔄 Message search
- 🔄 File sharing
- 🔄 Video calls
- 🔄 Message encryption
- 🔄 Bot marketplace
- 🔄 Advanced analytics

---

**Sontha Messenger** - Secure, Modern, Feature-Rich Communication Platform