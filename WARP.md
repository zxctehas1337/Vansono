# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Development Commands

### Main Application
```bash
# Install dependencies
npm install

# Run the web server (main messenger backend)
npm start                 # Production mode
npm run dev              # Development mode with nodemon

# Build and run desktop app (Electron)
npm run desktop          # Run Electron app
npm run build            # Build all platforms
npm run build:win        # Build Windows installer
```

### Bot API Server
```bash
# Bot API development
cd bot-api
npm install
npm start                # Production mode
npm run dev              # Development mode with nodemon
```

### Testing
Note: No formal test suite is currently configured. Manual testing is done through the web interface and Electron app.

## Project Architecture

### High-Level Structure
Sontha is a modern messenger application with a **modular client-side architecture** and multiple deployment targets:

- **Web Application**: Express.js server with Socket.IO for real-time communication
- **Desktop Application**: Electron wrapper for cross-platform desktop deployment  
- **Bot API**: Separate Express.js server for automated bot interactions
- **Database**: PostgreSQL schema (see `data/db.sql`)

### Client-Side Modular Architecture
The frontend has been refactored from a monolithic `app.js` (130k lines) into 6 specialized modules:

1. **`core.js`** - Socket connections, global state, utilities, notifications
2. **`auth.js`** - Registration, login, token management, CAPTCHA system  
3. **`chat.js`** - Messaging, message editing/deletion, reactions, call history
4. **`call.js`** - WebRTC voice/video calls, media management
5. **`ui.js`** - Theme system, navigation, user profiles, settings, favorites
6. **`features.js`** - Group chats, voice messages, channels, secret chats

**Module Loading Order**: Core → Auth → Chat → Call → UI → Features → App initialization

### Server Architecture
- **Main Server** (`server/server.js`): Single-file Express + Socket.IO server handling authentication, messaging, WebRTC signaling
- **Bot API Server** (`bot-api/server.js`): Separate service for bot automation with JWT authentication
- **Data Storage**: In-memory Maps for development (users, messages, chats, channels)
- **Authentication**: JWT tokens with bcrypt password hashing, CAPTCHA verification

### Key Technologies
- **Backend**: Node.js, Express, Socket.IO, PostgreSQL, JWT, bcrypt
- **Frontend**: Vanilla JavaScript (modular), WebRTC, Socket.IO client
- **Desktop**: Electron (Node integration enabled)
- **Bot SDK**: Python SDK with HTTP API client
- **Deployment**: Render.com (see `render.yaml`)

### Database Schema
Located in `data/db.sql` - includes tables for:
- `users` (authentication, profiles)
- `chats` (chat rooms)  
- `messages` (chat content)
- `chat_participants` (many-to-many relationships)

### Bot API Integration
The Bot API (`bot-api/`) allows Python automation:
- HTTP REST API on port 3001
- JWT-based bot authentication
- Message sending/receiving, reactions, channel management
- Python SDK with templates (EchoBot, AutoReplyBot, custom bots)

## Development Notes

### Environment Setup
- Main server uses `config.env` for configuration
- JWT secret defaults to 'cat909' if not set
- PostgreSQL connection required for production

### Security Considerations
- All passwords are bcrypt hashed
- JWT tokens expire after 7 days
- CAPTCHA verification for registration/login
- Bot API uses separate authentication system

### Performance Optimizations
- Modular frontend architecture allows lazy loading
- Socket.IO for real-time updates
- In-memory storage for development speed

### Deployment
- **Web**: Configured for Render.com deployment
- **Desktop**: Electron Builder with Windows/Linux/Mac targets  
- **Bot API**: Separate deployment from main application