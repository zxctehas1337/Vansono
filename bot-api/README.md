# Sontha Bot API (Monthy)

A powerful Bot API for the Sontha messenger that allows you to create automated bots using Python.

## Features

- 🤖 **Easy Bot Creation**: Create bots with simple API calls
- 💬 **Message Handling**: Send and receive messages
- 😊 **Reactions**: React to messages with emojis
- 📌 **Message Pinning**: Pin important messages
- 📢 **Channels**: Create and manage public channels
- 🔄 **Auto-Reply**: Built-in auto-reply functionality
- 🐍 **Python SDK**: Easy-to-use Python SDK included

## Quick Start

### 1. Start the Bot API Server

```bash
cd bot-api
npm install
node server.js
```

The API server will run on `http://localhost:3001`

### 2. Install Python SDK

```bash
cd bot-api/python-sdk
pip install -r requirements.txt
```

### 3. Create Your First Bot

```python
from monthy_bot import BotManager, EchoBot

# Create a bot manager
manager = BotManager("http://localhost:3001")

# Create a new bot
bot = manager.create_bot("MyBot", "your_user_id")

# Create an echo bot
echo_bot = EchoBot(bot.bot_id, bot.token)
echo_bot.start_echo_service()
```

## API Endpoints

### Bot Management

- `POST /api/bots` - Create a new bot
- `GET /api/bots/me` - Get bot information
- `POST /api/bots/deactivate` - Deactivate bot
- `POST /api/bots/activate` - Activate bot

### Messaging

- `POST /api/bots/messages` - Send a message
- `GET /api/bots/messages` - Get message history
- `POST /api/bots/reactions` - React to a message
- `POST /api/bots/pin` - Pin a message

### Channels

- `POST /api/bots/channels` - Create a channel
- `POST /api/bots/channels/join` - Join a channel
- `POST /api/bots/channels/messages` - Send channel message

## Python SDK Usage

### Basic Bot

```python
from monthy_bot import MonthlyBot

# Initialize bot
bot = MonthlyBot("your_bot_id", "your_bot_token")

# Send a message
bot.send_message("user_id", "Hello from my bot!")

# Get messages
messages = bot.get_messages(limit=10)

# React to a message
bot.react_to_message("message_id", "👍")
```

### Echo Bot

```python
from monthy_bot import EchoBot

# Create echo bot
echo_bot = EchoBot("bot_id", "token")

# Start echoing messages
echo_bot.start_echo_service()
```

### Auto-Reply Bot

```python
from monthy_bot import AutoReplyBot

# Create auto-reply bot
auto_bot = AutoReplyBot("bot_id", "token")

# Add custom replies
auto_bot.auto_replies["custom"] = "This is a custom reply!"

# Start auto-reply service
auto_bot.start_auto_reply_service()
```

### Channel Management

```python
# Create a channel
channel = bot.create_channel("My Channel", "Channel description")

# Join a channel
bot.join_channel("channel_id")

# Send message to channel
bot.send_channel_message("channel_id", "Hello channel!")
```

## Bot Templates

### 1. Echo Bot
Repeats all received messages back to the sender.

### 2. Auto-Reply Bot
Automatically responds to messages based on keywords.

### 3. Custom Bot
Create your own bot by extending the `MonthlyBot` class.

## Authentication

All API requests require a bot token in the Authorization header:

```
Authorization: Bearer your_bot_token
```

## Error Handling

The SDK includes comprehensive error handling:

```python
try:
    result = bot.send_message("user_id", "Hello!")
    if "error" in result:
        print(f"Error: {result['error']}")
    else:
        print("Message sent successfully!")
except Exception as e:
    print(f"Request failed: {e}")
```

## Examples

### Weather Bot

```python
import requests
from monthy_bot import MonthlyBot

class WeatherBot(MonthlyBot):
    def get_weather(self, city):
        # Your weather API integration
        return f"Weather in {city}: Sunny, 25°C"
    
    def handle_weather_request(self, message):
        if "weather" in message['text'].lower():
            city = message['text'].split()[-1]  # Get last word as city
            weather = self.get_weather(city)
            self.send_message(message['from'], weather, message['id'])
```

### Notification Bot

```python
from monthy_bot import MonthlyBot
import schedule
import time

class NotificationBot(MonthlyBot):
    def send_daily_reminder(self):
        # Send daily reminder to all users
        users = ["user1", "user2", "user3"]
        for user in users:
            self.send_message(user, "Don't forget to check your tasks!")
    
    def start_scheduler(self):
        schedule.every().day.at("09:00").do(self.send_daily_reminder)
        
        while True:
            schedule.run_pending()
            time.sleep(60)
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For support and questions:
- Create an issue on GitHub
- Join our Discord server
- Email: support@sontha.com
