"""
Monthy Bot SDK for Python
A simple SDK for creating bots in the Sontha messenger
"""

import requests
import json
import time
from typing import Optional, List, Dict, Any
from datetime import datetime

class MonthlyBot:
    """Main bot class for interacting with Sontha messenger"""
    
    def __init__(self, bot_id: str, token: str, api_url: str = "http://localhost:3001"):
        """
        Initialize the bot
        
        Args:
            bot_id: Bot ID
            token: Bot authentication token
            api_url: API server URL
        """
        self.bot_id = bot_id
        self.token = token
        self.api_url = api_url.rstrip('/')
        self.headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
        
    def _make_request(self, method: str, endpoint: str, data: Optional[Dict] = None) -> Dict:
        """Make HTTP request to the API"""
        url = f"{self.api_url}{endpoint}"
        
        try:
            if method.upper() == 'GET':
                response = requests.get(url, headers=self.headers, params=data)
            elif method.upper() == 'POST':
                response = requests.post(url, headers=self.headers, json=data)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
                
            response.raise_for_status()
            return response.json()
            
        except requests.exceptions.RequestException as e:
            print(f"API request failed: {e}")
            return {"error": str(e)}
    
    def get_info(self) -> Dict:
        """Get bot information"""
        return self._make_request('GET', '/api/bots/me')
    
    def send_message(self, to: str, text: str, reply_to: Optional[str] = None) -> Dict:
        """
        Send a message to a user
        
        Args:
            to: User ID to send message to
            text: Message text
            reply_to: Optional message ID to reply to
            
        Returns:
            Dict with message details
        """
        data = {
            'to': to,
            'text': text,
            'replyTo': reply_to
        }
        return self._make_request('POST', '/api/bots/messages', data)
    
    def get_messages(self, limit: int = 50, offset: int = 0) -> Dict:
        """
        Get bot's message history
        
        Args:
            limit: Maximum number of messages to return
            offset: Number of messages to skip
            
        Returns:
            Dict with messages and pagination info
        """
        params = {'limit': limit, 'offset': offset}
        return self._make_request('GET', '/api/bots/messages', params)
    
    def react_to_message(self, message_id: str, emoji: str) -> Dict:
        """
        React to a message with an emoji
        
        Args:
            message_id: ID of the message to react to
            emoji: Emoji to react with
            
        Returns:
            Dict with reaction status
        """
        data = {
            'messageId': message_id,
            'emoji': emoji
        }
        return self._make_request('POST', '/api/bots/reactions', data)
    
    def pin_message(self, message_id: str, chat_id: str) -> Dict:
        """
        Pin a message in a chat
        
        Args:
            message_id: ID of the message to pin
            chat_id: ID of the chat
            
        Returns:
            Dict with pin status
        """
        data = {
            'messageId': message_id,
            'chatId': chat_id
        }
        return self._make_request('POST', '/api/bots/pin', data)
    
    def create_channel(self, name: str, description: Optional[str] = None) -> Dict:
        """
        Create a new channel
        
        Args:
            name: Channel name
            description: Optional channel description
            
        Returns:
            Dict with channel details
        """
        data = {
            'name': name,
            'description': description
        }
        return self._make_request('POST', '/api/bots/channels', data)
    
    def join_channel(self, channel_id: str) -> Dict:
        """
        Join a channel
        
        Args:
            channel_id: ID of the channel to join
            
        Returns:
            Dict with join status
        """
        data = {'channelId': channel_id}
        return self._make_request('POST', '/api/bots/channels/join', data)
    
    def send_channel_message(self, channel_id: str, text: str, reply_to: Optional[str] = None) -> Dict:
        """
        Send a message to a channel
        
        Args:
            channel_id: ID of the channel
            text: Message text
            reply_to: Optional message ID to reply to
            
        Returns:
            Dict with message details
        """
        data = {
            'channelId': channel_id,
            'text': text,
            'replyTo': reply_to
        }
        return self._make_request('POST', '/api/bots/channels/messages', data)
    
    def deactivate(self) -> Dict:
        """Deactivate the bot"""
        return self._make_request('POST', '/api/bots/deactivate')
    
    def activate(self) -> Dict:
        """Activate the bot"""
        return self._make_request('POST', '/api/bots/activate')


class BotManager:
    """Manager class for creating and managing bots"""
    
    def __init__(self, api_url: str = "http://localhost:3001"):
        """
        Initialize the bot manager
        
        Args:
            api_url: API server URL
        """
        self.api_url = api_url.rstrip('/')
        self.headers = {'Content-Type': 'application/json'}
    
    def create_bot(self, name: str, user_id: str) -> MonthlyBot:
        """
        Create a new bot
        
        Args:
            name: Bot name
            user_id: User ID to associate the bot with
            
        Returns:
            MonthlyBot instance
        """
        data = {
            'name': name,
            'userId': user_id
        }
        
        try:
            response = requests.post(
                f"{self.api_url}/api/bots",
                headers=self.headers,
                json=data
            )
            response.raise_for_status()
            result = response.json()
            
            return MonthlyBot(
                bot_id=result['botId'],
                token=result['token'],
                api_url=self.api_url
            )
            
        except requests.exceptions.RequestException as e:
            print(f"Failed to create bot: {e}")
            raise


# Example usage and bot templates
class EchoBot(MonthlyBot):
    """Example echo bot that repeats messages"""
    
    def __init__(self, bot_id: str, token: str, api_url: str = "http://localhost:3001"):
        super().__init__(bot_id, token, api_url)
        self.running = False
    
    def start_echo_service(self, check_interval: int = 5):
        """
        Start the echo service
        
        Args:
            check_interval: Seconds between message checks
        """
        self.running = True
        print(f"Echo bot started. Checking for messages every {check_interval} seconds...")
        
        while self.running:
            try:
                messages = self.get_messages(limit=10)
                if 'messages' in messages:
                    for message in messages['messages']:
                        if not message.get('isBotMessage', False):
                            # Echo the message back
                            echo_text = f"Echo: {message['text']}"
                            self.send_message(
                                to=message['from'],
                                text=echo_text,
                                reply_to=message['id']
                            )
                            print(f"Echoed message: {message['text']}")
                
                time.sleep(check_interval)
                
            except KeyboardInterrupt:
                print("Echo bot stopped by user")
                self.running = False
            except Exception as e:
                print(f"Error in echo service: {e}")
                time.sleep(check_interval)


class AutoReplyBot(MonthlyBot):
    """Example auto-reply bot"""
    
    def __init__(self, bot_id: str, token: str, api_url: str = "http://localhost:3001"):
        super().__init__(bot_id, token, api_url)
        self.auto_replies = {
            'hello': 'Hi there! How can I help you?',
            'help': 'I can help you with various tasks. Just ask!',
            'time': f'Current time: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}',
            'weather': 'I cannot check weather, but I can help with other things!'
        }
        self.running = False
    
    def start_auto_reply_service(self, check_interval: int = 5):
        """
        Start the auto-reply service
        
        Args:
            check_interval: Seconds between message checks
        """
        self.running = True
        print(f"Auto-reply bot started. Checking for messages every {check_interval} seconds...")
        
        while self.running:
            try:
                messages = self.get_messages(limit=10)
                if 'messages' in messages:
                    for message in messages['messages']:
                        if not message.get('isBotMessage', False):
                            text_lower = message['text'].lower()
                            
                            # Check for keywords
                            reply_text = None
                            for keyword, reply in self.auto_replies.items():
                                if keyword in text_lower:
                                    reply_text = reply
                                    break
                            
                            if not reply_text:
                                reply_text = "I didn't understand that. Try 'help' for assistance."
                            
                            self.send_message(
                                to=message['from'],
                                text=reply_text,
                                reply_to=message['id']
                            )
                            print(f"Auto-replied to: {message['text']}")
                
                time.sleep(check_interval)
                
            except KeyboardInterrupt:
                print("Auto-reply bot stopped by user")
                self.running = False
            except Exception as e:
                print(f"Error in auto-reply service: {e}")
                time.sleep(check_interval)


# Example usage
if __name__ == "__main__":
    # Example of creating and using a bot
    manager = BotManager()
    
    # Create a bot (you need to provide a valid user_id)
    try:
        bot = manager.create_bot("MyBot", "user123")
        print(f"Bot created: {bot.get_info()}")
        
        # Send a test message
        result = bot.send_message("user456", "Hello from my bot!")
        print(f"Message sent: {result}")
        
    except Exception as e:
        print(f"Error: {e}")
