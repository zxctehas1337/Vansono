// ===== CHAT MODULE =====
// Управление чатами и сообщениями

// Call buttons
const voiceCallBtn = document.getElementById('voice-call-btn');
const videoCallBtn = document.getElementById('video-call-btn');

// ===== MESSAGE MANAGEMENT =====

// Send message
function sendMessage() {
  const text = document.getElementById('message-input').value.trim();
  
  if (!text || !window.Core.currentChatUser || !window.Core.currentUser) return;

  // Check if current user is null (which was the root issue)
  if (!window.Core.currentUser) {
    window.Core.showNotification('Please log in first', 'error');
    return;
  }

  // Handle different chat types
  if (window.Core.currentChatUser.isGroup) {
    // Group message
    if (window.Features && window.Features.sendGroupMessage) {
      return window.Features.sendGroupMessage();
    }
  } else if (window.Core.currentChatUser.isChannel) {
    // Channel message
    if (window.Features && window.Features.sendChannelMessage) {
      return window.Features.sendChannelMessage();
    }
  } else if (window.Core.currentChatUser.isSecret) {
    // Secret chat message
    if (window.Features && window.Features.sendSecretMessage) {
      return window.Features.sendSecretMessage();
    }
  } else {
    // Regular private message
    window.Core.socket.emit('message:send', {
      to: window.Core.currentChatUser.id,
      text
    });
  }

  document.getElementById('message-input').value = '';
}

// Display message
function displayMessage(message) {
  const isSent = message.from === window.Core.currentUser.id;
  const messageEl = document.createElement('div');
  messageEl.className = `message ${isSent ? 'sent' : ''} ${message.deleted ? 'deleted' : ''} ${message.type === 'voice' ? 'voice-message' : ''}`;
  messageEl.dataset.messageId = message.id;

  const time = new Date(message.timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const senderName = isSent ? window.Core.currentUser.name : window.Core.currentChatUser.name;

  // Handle voice messages
  if (message.type === 'voice') {
    const duration = window.Core.formatDuration(message.duration);
    
    // Use audioData (base64) instead of audioUrl (blob)
    const audioSource = message.audioData || message.audioUrl;
    
    messageEl.innerHTML = `
      <div class="message-avatar">${senderName.charAt(0).toUpperCase()}</div>
      <div class="message-content">
        <div class="voice-message">
          <div class="voice-message-icon">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 1C6.34 1 5 2.34 5 4V8C5 9.66 6.34 11 8 11C9.66 11 11 9.66 11 8V4C11 2.34 9.66 1 8 1Z" stroke="currentColor" stroke-width="1.5"/>
              <path d="M6 6V8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              <path d="M10 6V8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              <path d="M8 6V8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="voice-message-info">
            <div class="voice-message-duration">${duration}</div>
            <div class="voice-message-waveform" id="waveform-${message.id}">
              ${generateWaveform()}
            </div>
          </div>
          <button class="voice-message-play-btn" onclick="playVoiceMessage('${message.id}', '${audioSource}')">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3 2L9 6L3 10V2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
        <div class="message-meta">
          <div class="message-time">${time}</div>
        </div>
      </div>
    `;

    document.getElementById('messages-container').appendChild(messageEl);
    window.Core.scrollToBottom();
    return;
  }


  // Read receipt icons
  let readReceipts = '';
  if (isSent) {
    if (message.read) {
      readReceipts = `
        <div class="read-receipts">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 8L6 11L13 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M3 8L6 11L13 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" transform="translate(0, 2)"/>
          </svg>
        </div>
      `;
    } else {
      readReceipts = `
        <div class="read-receipts">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 8L6 11L13 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
      `;
    }
  }

  // Reply indicator
  let replyIndicator = '';
  if (message.replyTo) {
    const messagesHistory = JSON.parse(localStorage.getItem(`messages_${window.Core.currentChatUser.id}`) || '[]');
    const repliedMessage = messagesHistory.find(m => m.id === message.replyTo);
    if (repliedMessage) {
      replyIndicator = `
        <div class="reply-indicator">
          <div class="reply-line"></div>
          <div class="reply-content">
            <div class="reply-sender">${repliedMessage.from === window.Core.currentUser.id ? window.Core.currentUser.name : window.Core.currentChatUser.name}</div>
            <div class="reply-text">${window.Core.escapeHtml(repliedMessage.text.substring(0, 50))}${repliedMessage.text.length > 50 ? '...' : ''}</div>
          </div>
        </div>
      `;
    }
  }

  // Edited indicator
  let editedIndicator = '';
  if (message.edited) {
    editedIndicator = '<span class="edited-indicator">edited</span>';
  }

  // Reactions
  let reactionsHtml = '';
  if (message.reactions && Object.keys(message.reactions).length > 0) {
    reactionsHtml = `
      <div class="message-reactions">
        ${Object.entries(message.reactions).map(([emoji, userIds]) => `
          <button class="reaction-btn" onclick="toggleReaction('${message.id}', '${emoji}')">
            <span class="reaction-emoji">${emoji}</span>
            <span class="reaction-count">${userIds.length}</span>
          </button>
        `).join('')}
      </div>
    `;
  }

  // Message actions
  let messageActions = '';
  if (isSent && !message.deleted) {
    messageActions = `
      <div class="message-actions">
        <button class="message-action-btn" onclick="editMessage('${message.id}')" title="Edit">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M11 1L15 5L4.5 15.5H0.5V11.5L11 1Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <button class="message-action-btn" onclick="deleteMessage('${message.id}')" title="Delete">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M11 3.5L8.5 6L11 8.5M3 3.5L5.5 6L3 8.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <button class="message-action-btn" onclick="pinMessage('${message.id}')" title="Pin">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1L9 5L13 5L10 8L11 12L7 10L3 12L4 8L1 5L5 5L7 1Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    `;
  }

  // Add reaction button
  const addReactionBtn = `
    <button class="add-reaction-btn" onclick="showReactionPicker('${message.id}')" title="Add reaction">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.5"/>
        <path d="M7 4V10M4 7H10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    </button>
  `;

  messageEl.innerHTML = `
    <div class="message-avatar">${senderName.charAt(0).toUpperCase()}</div>
    <div class="message-content">
      ${replyIndicator}
      <div class="message-bubble ${message.deleted ? 'deleted-message' : ''}">
        ${message.deleted ? 'This message was deleted' : window.Core.escapeHtml(message.text)}
      </div>
      <div class="message-meta">
        <div class="message-time">
          ${time}
          ${editedIndicator}
        </div>
        ${readReceipts}
        ${messageActions}
      </div>
      ${reactionsHtml}
      ${addReactionBtn}
    </div>
  `;

  document.getElementById('messages-container').appendChild(messageEl);
}

// Generate waveform visualization
function generateWaveform() {
  let waveform = '';
  for (let i = 0; i < 20; i++) {
    const height = Math.random() * 20 + 4;
    waveform += `<div class="waveform-bar" style="height: ${height}px;"></div>`;
  }
  return waveform;
}

// ===== SOCKET EVENT HANDLERS =====

function getCoreSocketSafe() {
  return (window.Core && window.Core.socket) ? window.Core.socket : null;
}

// Display messages history
const coreSocket = getCoreSocketSafe();
if (coreSocket) {
  coreSocket.on('messages:history', (messages) => {
    document.getElementById('messages-container').innerHTML = '';
    messages.forEach(msg => displayMessage(msg));
    window.Core.scrollToBottom();
  });

  // Receive new message
  coreSocket.on('message:received', (message) => {
    // Only handle messages from other users to avoid duplication
    if (message.from === (window.Core && window.Core.currentUser ? window.Core.currentUser.id : null)) {
      return; // Skip messages from current user as they're handled by message:sent
    }
  });
} else {
  // Socket not available, optionally log for debugging
  console.warn('Core.socket not available for registering chat event listeners');
}
  
  if (window.Core.currentChatUser && message.from === window.Core.currentChatUser.id) {
    displayMessage(message);
    window.Core.scrollToBottom();
    
    // Play notification sound for incoming messages
    if (window.Call && window.Call.playNotificationSound) {
      window.Call.playNotificationSound('notification');
    }
  } else {
    // Show desktop notification for messages from other users
    window.Core.showDesktopNotification(
      'New Message',
      `${message.from === window.Core.currentUser.id ? 'You' : 'Someone'} sent a message`,
      '/favicon.ico'
    );
    
    // Play notification sound for messages from other chats
    if (window.Call && window.Call.playNotificationSound) {
      window.Call.playNotificationSound('notification');
    }
  }

// Message sent confirmation
window.Core.socket.on('message:sent', (message) => {
  // Display all sent messages, including voice messages
  displayMessage(message);
  window.Core.scrollToBottom();
});

// Message read confirmation
window.Core.socket.on('messages:read', (data) => {
  // Update read status for messages from the current chat user
  if (window.Core.currentChatUser && data.from === window.Core.currentChatUser.id) {
    // Re-render messages to show updated read status
    document.getElementById('messages-container').innerHTML = '';
    window.Core.socket.emit('messages:get', { userId: window.Core.currentChatUser.id });
  }
});

// ===== MESSAGE ACTIONS =====

// Edit message
function editMessage(messageId) {
  const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
  const messageBubble = messageEl.querySelector('.message-bubble');
  const originalText = messageBubble.textContent;
  
  // Create edit input
  const editInput = document.createElement('input');
  editInput.type = 'text';
  editInput.value = originalText;
  editInput.className = 'edit-input';
  
  // Replace message bubble with input
  messageBubble.style.display = 'none';
  messageBubble.parentNode.insertBefore(editInput, messageBubble);
  editInput.focus();
  editInput.select();
  
  // Handle edit completion
  editInput.addEventListener('blur', () => {
    const newText = editInput.value.trim();
    if (newText && newText !== originalText) {
      window.Core.socket.emit('message:edit', { messageId, newText });
      messageBubble.textContent = newText;
      messageBubble.style.display = 'block';
      editInput.remove();
    } else {
      messageBubble.style.display = 'block';
      editInput.remove();
    }
  });
  
  editInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      editInput.blur();
    }
  });
}

// Delete message
function deleteMessage(messageId) {
  window.Core.showConfirmationDialog(
    'Delete Message',
    'Are you sure you want to delete this message? This action cannot be undone.',
    () => {
      // Update local storage
      const messages = JSON.parse(localStorage.getItem(`messages_${window.Core.currentChatUser.id}`) || '[]');
      const messageIndex = messages.findIndex(msg => msg.id === messageId);
      if (messageIndex !== -1) {
        messages[messageIndex].deleted = true;
        localStorage.setItem(`messages_${window.Core.currentChatUser.id}`, JSON.stringify(messages));
        
        // Update UI
        const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageEl) {
          const messageBubble = messageEl.querySelector('.message-bubble');
          messageBubble.textContent = 'This message was deleted';
          messageBubble.classList.add('deleted-message');
          messageEl.classList.add('deleted');
          
          // Hide message actions
          const messageActions = messageEl.querySelector('.message-actions');
          if (messageActions) {
            messageActions.style.display = 'none';
          }
        }
      }
      
      // Send to server
      if (window.Core.socket && window.Core.socket.connected) {
        window.Core.socket.emit('message:delete', { messageId });
      }
      
      window.Core.showNotification('Message deleted', 'success');
    }
  );
}

// Pin message
function pinMessage(messageId) {
  window.Core.socket.emit('message:pin', { messageId, chatId: window.Core.currentChatUser.id });
  window.Core.showNotification('Message pinned', 'success');
}

// ===== MESSAGE REACTIONS =====

// Show reaction picker
function showReactionPicker(messageId) {
  const emojis = ['👍', '👎', '❤️', '😂', '😮', '😢', '😡', '🎉'];
  
  const picker = document.createElement('div');
  picker.className = 'reaction-picker';
  picker.innerHTML = emojis.map(emoji => `
    <button class="emoji-btn" onclick="addReaction('${messageId}', '${emoji}')">${emoji}</button>
  `).join('');
  
  // Position picker
  const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
  if (messageEl) {
    const rect = messageEl.getBoundingClientRect();
    picker.style.position = 'absolute';
    picker.style.left = `${rect.left}px`;
    picker.style.top = `${rect.top - 50}px`;
    
    document.body.appendChild(picker);
    
    // Remove picker when clicking outside
    setTimeout(() => {
      document.addEventListener('click', function removePicker() {
        picker.remove();
        document.removeEventListener('click', removePicker);
      });
    }, 100);
  }
}

// Add reaction
function addReaction(messageId, emoji) {
  // Update local storage
  const messages = JSON.parse(localStorage.getItem(`messages_${window.Core.currentChatUser.id}`) || '[]');
  const messageIndex = messages.findIndex(msg => msg.id === messageId);
  
  if (messageIndex !== -1) {
    if (!messages[messageIndex].reactions) {
      messages[messageIndex].reactions = {};
    }
    
    if (!messages[messageIndex].reactions[emoji]) {
      messages[messageIndex].reactions[emoji] = [];
    }
    
    // Add current user to reaction if not already there
    if (!messages[messageIndex].reactions[emoji].includes(window.Core.currentUser.id)) {
      messages[messageIndex].reactions[emoji].push(window.Core.currentUser.id);
    }
    
    localStorage.setItem(`messages_${window.Core.currentChatUser.id}`, JSON.stringify(messages));
    
    // Update UI
    updateMessageReactions(messageId, messages[messageIndex].reactions);
  }
  
  // Send to server
  if (window.Core.socket && window.Core.socket.connected) {
    window.Core.socket.emit('message:react', { messageId, emoji });
  }
}

// Toggle reaction
function toggleReaction(messageId, emoji) {
  // Update local storage
  const messages = JSON.parse(localStorage.getItem(`messages_${window.Core.currentChatUser.id}`) || '[]');
  const messageIndex = messages.findIndex(msg => msg.id === messageId);
  
  if (messageIndex !== -1) {
    if (!messages[messageIndex].reactions) {
      messages[messageIndex].reactions = {};
    }
    
    if (!messages[messageIndex].reactions[emoji]) {
      messages[messageIndex].reactions[emoji] = [];
    }
    
    const userIds = messages[messageIndex].reactions[emoji];
    const userIndex = userIds.indexOf(window.Core.currentUser.id);
    
    if (userIndex === -1) {
      // Add reaction
      userIds.push(window.Core.currentUser.id);
    } else {
      // Remove reaction
      userIds.splice(userIndex, 1);
      
      // Remove emoji if no users left
      if (userIds.length === 0) {
        delete messages[messageIndex].reactions[emoji];
      }
    }
    
    localStorage.setItem(`messages_${window.Core.currentChatUser.id}`, JSON.stringify(messages));
    
    // Update UI
    updateMessageReactions(messageId, messages[messageIndex].reactions);
  }
  
  // Send to server
  if (window.Core.socket && window.Core.socket.connected) {
    window.Core.socket.emit('message:react', { messageId, emoji });
  }
}

// Update message reactions in UI
function updateMessageReactions(messageId, reactions) {
  const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
  if (!messageEl) return;
  
  let reactionsContainer = messageEl.querySelector('.message-reactions');
  
  if (!reactionsContainer) {
    reactionsContainer = document.createElement('div');
    reactionsContainer.className = 'message-reactions';
    messageEl.querySelector('.message-content').appendChild(reactionsContainer);
  }
  
  if (Object.keys(reactions).length === 0) {
    reactionsContainer.innerHTML = '';
    return;
  }
  
  reactionsContainer.innerHTML = Object.entries(reactions).map(([emoji, userIds]) => `
    <button class="reaction-btn" onclick="toggleReaction('${messageId}', '${emoji}')">
      <span class="reaction-emoji">${emoji}</span>
      <span class="reaction-count">${userIds.length}</span>
    </button>
  `).join('');
}

// ===== EVENT LISTENERS =====

// Send message on button click and Enter key
document.getElementById('send-btn').addEventListener('click', sendMessage);
document.getElementById('message-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

// Call buttons
voiceCallBtn.addEventListener('click', () => {
  if (!window.Core.currentChatUser) return;
  window.Call.initiateCall(false);
});

videoCallBtn.addEventListener('click', () => {
  if (!window.Core.currentChatUser) return;
  window.Call.initiateCall(true);
});

// ===== INITIALIZATION =====

function initializeChat() {
  console.log('Chat module initialized');
}

// Export functions for other modules
window.Chat = {
  sendMessage,
  displayMessage,
  editMessage,
  deleteMessage,
  pinMessage,
  showReactionPicker,
  addReaction,
  toggleReaction,
  updateMessageReactions,
  initializeChat
};

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', initializeChat);
