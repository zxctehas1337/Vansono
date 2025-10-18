#!/usr/bin/env python3
"""
Auto-Reply Bot Example
A bot that automatically responds to messages based on keywords
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'python-sdk'))

from monthy_bot import BotManager, AutoReplyBot

def main():
    print("🤖 Sontha Auto-Reply Bot Example")
    print("=" * 40)
    
    # Bot API server URL
    api_url = "http://localhost:3001"
    
    # Create bot manager
    manager = BotManager(api_url)
    
    try:
        # Create a new bot
        print("Creating bot...")
        bot = manager.create_bot("AutoReplyBot", "user123")  # Replace with actual user ID
        print(f"✅ Bot created successfully!")
        print(f"   Bot ID: {bot.bot_id}")
        print(f"   Token: {bot.token[:20]}...")
        
        # Create auto-reply bot instance
        auto_bot = AutoReplyBot(bot.bot_id, bot.token, api_url)
        
        # Add custom auto-replies
        auto_bot.auto_replies.update({
            'bot': 'I am a helpful bot! How can I assist you?',
            'python': 'Python is a great programming language!',
            'sontha': 'Sontha is an amazing messenger!',
            'thanks': 'You\'re welcome! Happy to help!',
            'bye': 'Goodbye! Have a great day!'
        })
        
        print("\n🔄 Starting auto-reply service...")
        print("   The bot will automatically respond to messages")
        print("   Keywords: hello, help, time, weather, bot, python, sontha, thanks, bye")
        print("   Press Ctrl+C to stop")
        print("-" * 40)
        
        # Start the auto-reply service
        auto_bot.start_auto_reply_service(check_interval=3)
        
    except KeyboardInterrupt:
        print("\n👋 Auto-reply bot stopped by user")
    except Exception as e:
        print(f"❌ Error: {e}")
        print("\nMake sure the Bot API server is running on port 3001")

if __name__ == "__main__":
    main()
