// ===== CORE MODULE =====
// Основная логика инициализации и общие утилиты

// Socket connection
const socket = io(window.location.origin.includes('localhost') ? 'http://localhost:3000' : window.location.origin);

// Global state
let currentUser = null;
let currentChatUser = null;
let peer = null;
let localStream = null;
let currentCallData = null;
let callStartTime = null;
let callEndTime = null;
let callDuration = null;

// DOM Elements - Core
const authScreen = document.getElementById('auth-screen');
const chatScreen = document.getElementById('chat-screen');
const callScreen = document.getElementById('call-screen');

// Chat elements
const chatsList = document.getElementById('chats-list');
const emptyState = document.getElementById('empty-state');
const chatContainer = document.getElementById('chat-container');
const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');

// Current user display
const currentUserName = document.getElementById('current-user-name');
const currentUserUsername = document.getElementById('current-user-username');
const currentUserAvatar = document.getElementById('current-user-avatar');

// Chat header
const chatAvatar = document.getElementById('chat-avatar');
const chatName = document.getElementById('chat-name');
const chatStatus = document.getElementById('chat-status');

// ===== UTILITY FUNCTIONS =====

// Handle URL routing
function handleRouting() {
  const path = window.location.pathname;
  
  if (path === '/chats' || path === '/') {
    // Show chats list
    showChatsList();
  } else if (path.startsWith('/chat/')) {
    const userId = path.split('/chat/')[1];
    if (userId && currentUser) {
      // Find user and open chat
      const user = Array.from(window.Core.users || []).find(u => u.id === userId);
      if (user) {
        openChat(user);
      } else {
        // User not found, redirect to chats
        window.history.pushState({}, '', '/chats');
        showChatsList();
      }
    }
  }
}

// Show chats list
function showChatsList() {
  if (chatScreen && chatScreen.classList.contains('active')) {
    // Hide any open chat
    chatContainer.style.display = 'none';
    emptyState.style.display = 'block';
    chatsList.style.display = 'block';
    
    // Update URL
    window.history.pushState({}, '', '/chats');
    
    // Clear current chat user
    currentChatUser = null;
  }
}


// Scroll to bottom of messages container
function scrollToBottom() {
  const messagesContainer = document.getElementById('messages-container');
  if (messagesContainer) {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Format duration
function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`;
}

// Show notification
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// Custom confirmation dialog
function showConfirmationDialog(title, message, onConfirm, onCancel = null) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay active';
  overlay.style.zIndex = '10000';
  
  overlay.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="icon-btn" id="close-confirm-modal" title="Close">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      <div class="modal-body">
        <p style="color: var(--text-primary); font-size: 16px; line-height: 1.5;">${message}</p>
      </div>
      <div class="modal-footer">
        <button class="secondary-btn" id="cancel-confirm-btn">Cancel</button>
        <button class="primary-btn" id="confirm-btn" style="background: var(--error);">Confirm</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  // Event listeners
  const closeBtn = overlay.querySelector('#close-confirm-modal');
  const cancelBtn = overlay.querySelector('#cancel-confirm-btn');
  const confirmBtn = overlay.querySelector('#confirm-btn');
  
  const cleanup = () => {
    overlay.remove();
  };
  
  closeBtn.addEventListener('click', () => {
    cleanup();
    if (onCancel) onCancel();
  });
  
  cancelBtn.addEventListener('click', () => {
    cleanup();
    if (onCancel) onCancel();
  });
  
  confirmBtn.addEventListener('click', () => {
    cleanup();
    onConfirm();
  });
  
  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      cleanup();
      if (onCancel) onCancel();
    }
  });
}

// Debounce function
function debounce(fn, delay = 300) {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

// Update user display
function updateUserDisplay(user) {
  if (!user || !user.name) {
    console.warn('Invalid user object passed to updateUserDisplay');
    return;
  }
  
  const nameEl = document.getElementById('current-user-name');
  const usernameEl = document.getElementById('current-user-username');
  const avatarEl = document.getElementById('current-user-avatar');
  
  if (nameEl) nameEl.textContent = user.name;
  if (usernameEl) usernameEl.textContent = user.username ? (user.username.startsWith('@') ? user.username : `@${user.username}`) : '@unknown';
  if (avatarEl) avatarEl.textContent = user.name.charAt(0);
}

// Initialize chat
function initializeChat() {
  if (authScreen) authScreen.classList.remove('active');
  if (chatScreen) chatScreen.classList.add('active');
  
  if (currentUser) {
    updateUserDisplay(currentUser);
  } else {
    console.warn('No current user available for display');
  }
  
  // Handle routing after authentication
  handleRouting();
}

// ===== SOCKET EVENT HANDLERS =====

// Users list
socket.on('users:list', (users) => {
  if (!chatsList) {
    console.warn('Chats list element not found');
    return;
  }
  
  chatsList.innerHTML = '';
  
  if (!users || !Array.isArray(users)) {
    console.warn('Invalid users array received');
    return;
  }
  
  users.forEach(user => {
    if (!user || !user.id || !user.name) {
      console.warn('Invalid user object in users list:', user);
      return;
    }
    
    // Skip current user - they shouldn't see themselves in chat list
    if (currentUser && user.id === currentUser.id) {
      return;
    }
    
    const chatItem = document.createElement('div');
    chatItem.className = 'chat-item';
    chatItem.dataset.userId = user.id;
    
    chatItem.innerHTML = `
      <div style="position: relative;">
        <div class="avatar" style="width: 48px; height: 48px; font-size: 18px;">
          ${user.name.charAt(0).toUpperCase()}
        </div>
        ${user.online ? '<div class="online-indicator"></div>' : ''}
      </div>
      <div class="chat-item-info">
        <div class="chat-item-header">
          <span class="chat-item-name">${user.name}</span>
          <span class="chat-item-time">now</span>
        </div>
        <div class="chat-item-preview">${user.username.startsWith('@') ? user.username : `@${user.username}`}</div>
      </div>
    `;

    chatItem.addEventListener('click', () => openChat(user));
    chatsList.appendChild(chatItem);
  });
});

// Search results
socket.on('search_results', (users) => {
  updateUsersList(users);
});

// Update users list
function updateUsersList(users) {
  const chatsList = document.getElementById('chats-list');
  if (!chatsList) {
    console.warn('Chats list element not found');
    return;
  }
  
  if (!users || !Array.isArray(users)) {
    console.warn('Invalid users array received');
    return;
  }
  
  // Filter out current user and invalid users
  const filteredUsers = users.filter(user => {
    if (!user || !user.id || !user.name) return false;
    if (currentUser && user.id === currentUser.id) return false;
    return true;
  });
  
  chatsList.innerHTML = filteredUsers.map(user => `
    <div class="chat-item" data-user-id="${user.id}">
      <div class="avatar">${user.name.charAt(0)}</div>
      <div class="chat-item-info">
        <div class="chat-item-header">
          <span class="chat-item-name">${user.name}</span>
        </div>
        <div class="chat-item-preview">@${user.username}</div>
      </div>
      ${user.online ? '<div class="online-indicator"></div>' : ''}
    </div>
  `).join('');
}

// Open chat with user
function openChat(user) {
  // Check if we're already in this chat
  if (currentChatUser && currentChatUser.id === user.id) {
    return; // Already in this chat, no need to reload
  }
  
  currentChatUser = user;
  
  // Update active state
  document.querySelectorAll('.chat-item').forEach(item => {
    item.classList.remove('active');
  });
  document.querySelector(`[data-user-id="${user.id}"]`)?.classList.add('active');

  // Show chat container
  emptyState.style.display = 'none';
  chatContainer.style.display = 'flex';

  // Update chat header
  chatName.textContent = user.name;
  chatAvatar.textContent = user.name.charAt(0).toUpperCase();
  chatStatus.textContent = user.online ? 'Online' : 'Offline';
  chatStatus.style.color = user.online ? 'var(--success)' : 'var(--text-tertiary)';

  // Update URL
  window.history.pushState({}, '', `/chat/${user.id}`);

  // Load messages
  messagesContainer.innerHTML = '';
  socket.emit('messages:get', { userId: user.id });
  
  // Mark messages as read
  socket.emit('messages:mark-read', { userId: user.id });
}

// ===== NOTIFICATIONS =====

// Request notification permission
function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

// Show desktop notification
function showDesktopNotification(title, body, icon) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      body: body,
      icon: icon || '/favicon.ico'
    });
  }
}

// ===== INITIALIZATION =====

// Initialize core functionality
function initializeCore() {
  // Setup search functionality
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', debounce((e) => {
      const query = e.target.value.trim();
      if (query.length < 2) return;
      socket.emit('search_users', query);
    }, 300));
  }

  // Setup routing
  handleRouting();
  
  // Handle browser back/forward buttons
  window.addEventListener('popstate', handleRouting);
  
  // Setup back button in chat
  const backBtn = document.getElementById('back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', showChatsList);
  }

  // Request notification permission
  requestNotificationPermission();
  
  console.log('Core module initialized');
}

// Export functions for other modules
window.Core = {
  socket,
  get currentUser() { return currentUser; },
  set currentUser(value) { currentUser = value; },
  get currentChatUser() { return currentChatUser; },
  set currentChatUser(value) { currentChatUser = value; },
  get peer() { return peer; },
  set peer(value) { peer = value; },
  get localStream() { return localStream; },
  set localStream(value) { localStream = value; },
  get currentCallData() { return currentCallData; },
  set currentCallData(value) { currentCallData = value; },
  get callStartTime() { return callStartTime; },
  set callStartTime(value) { callStartTime = value; },
  get callEndTime() { return callEndTime; },
  set callEndTime(value) { callEndTime = value; },
  get callDuration() { return callDuration; },
  set callDuration(value) { callDuration = value; },
  scrollToBottom,
  escapeHtml,
  formatDuration,
  showNotification,
  showConfirmationDialog,
  debounce,
  updateUserDisplay,
  initializeChat,
  openChat,
  showChatsList,
  handleRouting,
  showDesktopNotification,
  initializeCore
};

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', initializeCore);
