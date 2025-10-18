#!/usr/bin/env python3
"""
Echo Bot Example
A simple bot that echoes back all received messages
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'python-sdk'))

from monthy_bot import BotManager, EchoBot

def main():
    print("🤖 Sontha Echo Bot Example")
    print("=" * 40)
    
    # Bot API server URL
    api_url = "http://localhost:3001"
    
    # Create bot manager
    manager = BotManager(api_url)
    
    try:
        # Create a new bot
        print("Creating bot...")
        bot = manager.create_bot("EchoBot", "user123")  # Replace with actual user ID
        print(f"✅ Bot created successfully!")
        print(f"   Bot ID: {bot.bot_id}")
        print(f"   Token: {bot.token[:20]}...")
        
        # Create echo bot instance
        echo_bot = EchoBot(bot.bot_id, bot.token, api_url)
        
        print("\n🔄 Starting echo service...")
        print("   The bot will echo back all received messages")
        print("   Press Ctrl+C to stop")
        print("-" * 40)
        
        # Start the echo service
        echo_bot.start_echo_service(check_interval=3)
        
    except KeyboardInterrupt:
        print("\n👋 Echo bot stopped by user")
    except Exception as e:
        print(f"❌ Error: {e}")
        print("\nMake sure the Bot API server is running on port 3001")

if __name__ == "__main__":
    main()
