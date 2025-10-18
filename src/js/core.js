// ===== CORE MODULE =====
// Основная логика инициализации и общие утилиты

// Socket connection
const socket = io(window.location.origin.includes('localhost') ? 'http://localhost:3000' : window.location.origin);

// Global state
let currentUser = null;
let currentChatUser = null;
let users = [];
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
  console.log('handleRouting called with path:', path);
  
  if (path === '/chats' || path === '/') {
    // Show chats list
    console.log('Routing to chats list');
    showChatsList();
  } else if (path.startsWith('/chat/')) {
    const userId = path.split('/chat/')[1];
    console.log('Routing to chat with userId:', userId);
    if (userId && currentUser) {
      // Find user and open chat
      const user = users.find(u => u.id === userId);
      if (user) {
        openChat(user);
      } else {
        // User not found, redirect to chats
        console.log('User not found, redirecting to chats');
        window.history.pushState({}, '', '/chats');
        showChatsList();
      }
    }
  }
}

// Show chats list
function showChatsList() {
  console.log('showChatsList called, chatScreen active:', chatScreen && chatScreen.classList.contains('active'));
  console.log('DOM elements check:', {
    chatScreen: !!chatScreen,
    chatContainer: !!chatContainer,
    emptyState: !!emptyState,
    chatsList: !!chatsList
  });
  
  if (chatScreen && chatScreen.classList.contains('active')) {
    // Show the empty state and hide any open chat
    if (chatContainer) {
      chatContainer.style.display = 'none';
      console.log('Chat container hidden');
    }
    if (emptyState) {
      emptyState.style.display = 'block';
      console.log('Empty state shown');
    }
    
    // Ensure chats list is visible
    if (chatsList) {
      chatsList.style.display = 'block';
      console.log('Chats list shown');
    }
    
    // Clear active chat selection
    document.querySelectorAll('.chat-item').forEach(item => {
      item.classList.remove('active');
    });
    
    console.log('Chat list view activated');
  } else {
    console.log('Chat screen not active, skipping DOM manipulation');
  }
  
  // Update URL
  window.history.pushState({}, '', '/chats');
  
  // Clear current chat user
  currentChatUser = null;
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
  console.log('initializeChat called, currentUser:', currentUser);
  console.log('DOM elements before switching:', {
    authScreen: !!authScreen,
    chatScreen: !!chatScreen,
    authScreenActive: authScreen && authScreen.classList.contains('active'),
    chatScreenActive: chatScreen && chatScreen.classList.contains('active')
  });
  
  // Transition from auth to chat screen
  if (authScreen) {
    authScreen.classList.remove('active');
    // Aggressively hide auth screen
    authScreen.style.cssText = `
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
      z-index: -999 !important;
      position: absolute !important;
      left: -9999px !important;
    `;
    console.log('Auth screen aggressively hidden');
  }
  
  if (chatScreen) {
    chatScreen.classList.add('active');
    console.log('Chat screen activated');
  }
  
  console.log('DOM elements after switching:', {
    authScreenActive: authScreen && authScreen.classList.contains('active'),
    chatScreenActive: chatScreen && chatScreen.classList.contains('active')
  });
  
  // Force visibility of chat screen and its components with maximum priority
  if (chatScreen) {
    chatScreen.style.cssText = `
      display: flex !important;
      visibility: visible !important;
      opacity: 1 !important;
      width: 100% !important;
      height: 100vh !important;
      background: #0f0f0f !important;
      position: relative !important;
      z-index: 1 !important;
    `;
    
    // Force visibility of chat layout
    const chatLayout = chatScreen.querySelector('.chat-layout');
    if (chatLayout) {
      chatLayout.style.cssText = `
        display: flex !important;
        visibility: visible !important;
        opacity: 1 !important;
        width: 100% !important;
        height: 100vh !important;
        flex-direction: row !important;
      `;
    }
    
    // Force visibility of sidebar
    const sidebar = chatScreen.querySelector('.sidebar');
    if (sidebar) {
      sidebar.style.cssText = `
        display: flex !important;
        visibility: visible !important;
        opacity: 1 !important;
        width: 360px !important;
        height: 100vh !important;
        background: #1a1a1a !important;
        flex-direction: column !important;
        border-right: 1px solid #333333 !important;
      `;
    }
    
    // Force visibility of main chat area
    const chatMain = chatScreen.querySelector('.chat-main');
    if (chatMain) {
      chatMain.style.cssText = `
        display: flex !important;
        visibility: visible !important;
        opacity: 1 !important;
        flex: 1 !important;
        height: 100vh !important;
        background: #0f0f0f !important;
        flex-direction: column !important;
      `;
    }
    
    console.log('Emergency visibility styles applied to chat screen with maximum priority');
    
    // Force body and html styles
    document.documentElement.style.cssText = `
      height: 100% !important;
      overflow: hidden !important;
    `;
    
    document.body.style.cssText = `
      margin: 0 !important;
      padding: 0 !important;
      height: 100vh !important;
      overflow: hidden !important;
      background: #0f0f0f !important;
      color: #ffffff !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
    `;
    
    // Detailed DOM debugging
    setTimeout(() => {
      console.log('=== DOM STATE AFTER INITIALIZATION ===');
      console.log('Body styles:', {
        background: getComputedStyle(document.body).backgroundColor,
        height: getComputedStyle(document.body).height,
        overflow: getComputedStyle(document.body).overflow
      });
      console.log('Auth screen:', {
        exists: !!authScreen,
        display: authScreen ? getComputedStyle(authScreen).display : 'N/A',
        visibility: authScreen ? getComputedStyle(authScreen).visibility : 'N/A',
        opacity: authScreen ? getComputedStyle(authScreen).opacity : 'N/A',
        zIndex: authScreen ? getComputedStyle(authScreen).zIndex : 'N/A'
      });
      console.log('Chat screen:', {
        exists: !!chatScreen,
        display: chatScreen ? getComputedStyle(chatScreen).display : 'N/A',
        visibility: chatScreen ? getComputedStyle(chatScreen).visibility : 'N/A',
        opacity: chatScreen ? getComputedStyle(chatScreen).opacity : 'N/A',
        zIndex: chatScreen ? getComputedStyle(chatScreen).zIndex : 'N/A',
        background: chatScreen ? getComputedStyle(chatScreen).backgroundColor : 'N/A',
        width: chatScreen ? getComputedStyle(chatScreen).width : 'N/A',
        height: chatScreen ? getComputedStyle(chatScreen).height : 'N/A'
      });
      if (chatScreen) {
        const layout = chatScreen.querySelector('.chat-layout');
        const sidebar = chatScreen.querySelector('.sidebar');
        const main = chatScreen.querySelector('.chat-main');
        const emptyState = chatScreen.querySelector('#empty-state');
        console.log('Chat layout:', {
          exists: !!layout,
          display: layout ? getComputedStyle(layout).display : 'N/A',
          visibility: layout ? getComputedStyle(layout).visibility : 'N/A',
          width: layout ? getComputedStyle(layout).width : 'N/A',
          height: layout ? getComputedStyle(layout).height : 'N/A'
        });
        console.log('Sidebar:', {
          exists: !!sidebar,
          display: sidebar ? getComputedStyle(sidebar).display : 'N/A',
          visibility: sidebar ? getComputedStyle(sidebar).visibility : 'N/A',
          width: sidebar ? getComputedStyle(sidebar).width : 'N/A'
        });
        console.log('Main chat:', {
          exists: !!main,
          display: main ? getComputedStyle(main).display : 'N/A',
          visibility: main ? getComputedStyle(main).visibility : 'N/A',
          width: main ? getComputedStyle(main).width : 'N/A'
        });
        console.log('Empty state:', {
          exists: !!emptyState,
          display: emptyState ? getComputedStyle(emptyState).display : 'N/A',
          visibility: emptyState ? getComputedStyle(emptyState).visibility : 'N/A'
        });
      }
      console.log('=== END DOM STATE DEBUG ===');
      
      // Emergency fallback - if chat screen is still not visible, create a new one
      if (chatScreen && getComputedStyle(chatScreen).display === 'none') {
        console.log('EMERGENCY: Chat screen is still not visible, creating fallback');
        
        // Create emergency chat interface
        const emergencyChatDiv = document.createElement('div');
        emergencyChatDiv.id = 'emergency-chat';
        emergencyChatDiv.style.cssText = `
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          background: #0f0f0f !important;
          color: #ffffff !important;
          display: flex !important;
          z-index: 9999 !important;
          font-family: Arial, sans-serif !important;
        `;
        
        emergencyChatDiv.innerHTML = `
          <div style="width: 300px; background: #1a1a1a; border-right: 1px solid #333; display: flex; flex-direction: column;">
            <div style="padding: 20px; border-bottom: 1px solid #333;">
              <div style="display: flex; align-items: center; gap: 12px;">
                <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #667eea, #764ba2); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold;">
                  ${currentUser ? currentUser.name.charAt(0) : 'U'}
                </div>
                <div>
                  <div style="font-weight: 600;">${currentUser ? currentUser.name : 'User'}</div>
                  <div style="color: #a0a0a0; font-size: 14px;">${currentUser ? (currentUser.username.startsWith('@') ? currentUser.username : '@' + currentUser.username) : '@user'}</div>
                </div>
              </div>
            </div>
            <div style="flex: 1; padding: 20px;">
              <div style="text-align: center; color: #a0a0a0; padding: 40px 20px;">
                <h3 style="margin-bottom: 8px; color: #ffffff;">Chat List</h3>
                <p style="margin: 0;">Your chats will appear here</p>
                <div id="emergency-users-list" style="margin-top: 20px;"></div>
              </div>
            </div>
          </div>
          <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;">
            <div style="text-align: center; color: #a0a0a0;">
              <div style="width: 80px; height: 80px; margin: 0 auto 20px; border: 3px solid #667eea; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 32px;">💬</div>
              <h2 style="margin-bottom: 8px; color: #ffffff;">Select a chat to start messaging</h2>
              <p style="margin: 0;">Choose from your existing conversations or start a new one</p>
              <div style="margin-top: 20px; padding: 12px 20px; background: #1a1a1a; border-radius: 8px; border: 1px solid #333;">✅ Emergency chat interface loaded successfully</div>
            </div>
          </div>
        `;
        
        document.body.appendChild(emergencyChatDiv);
        console.log('Emergency chat interface created and added to DOM');
        
        // Add users to emergency list
        const emergencyUsersList = emergencyChatDiv.querySelector('#emergency-users-list');
        if (users && users.length > 0) {
          users.forEach(user => {
            if (currentUser && user.id !== currentUser.id) {
              const userDiv = document.createElement('div');
              userDiv.style.cssText = `
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px;
                margin-bottom: 8px;
                background: #252525;
                border-radius: 8px;
                cursor: pointer;
                transition: background 0.3s ease;
              `;
              userDiv.innerHTML = `
                <div style="width: 32px; height: 32px; background: linear-gradient(135deg, #667eea, #764ba2); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px;">
                  ${user.name.charAt(0)}
                </div>
                <div>
                  <div style="font-weight: 500; font-size: 14px;">${user.name}</div>
                  <div style="color: #a0a0a0; font-size: 12px;">${user.username}</div>
                </div>
              `;
              userDiv.addEventListener('mouseover', () => {
                userDiv.style.background = '#2a2a2a';
              });
              userDiv.addEventListener('mouseout', () => {
                userDiv.style.background = '#252525';
              });
              emergencyUsersList.appendChild(userDiv);
            }
          });
        }
      }
    }, 1000);
  }
  
  // Update user display
  if (currentUser) {
    updateUserDisplay(currentUser);
    console.log('User display updated for:', currentUser.name);
  } else {
    console.warn('No current user available for display');
  }
  
  // Request the users list from server
  console.log('Requesting users list from server');
  socket.emit('users:get');
  
  // Handle routing after authentication
  handleRouting();
}

// ===== SOCKET EVENT HANDLERS =====

// Users list
socket.on('users:list', (usersList) => {
  console.log('Received users:list event:', usersList);
  
  if (!chatsList) {
    console.warn('Chats list element not found');
    return;
  }
  
  // Store users globally
  users = usersList || [];
  
  // Save the favorites element before clearing
  const favoritesElement = chatsList.querySelector('.favorites-chat-item');
  chatsList.innerHTML = '';
  
  // Restore the favorites element
  if (favoritesElement) {
    chatsList.appendChild(favoritesElement);
  }
  
  if (!usersList || !Array.isArray(usersList)) {
    console.warn('Invalid users array received');
    return;
  }
  
  console.log('Processing users list, count:', usersList.length);
  
  usersList.forEach(user => {
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
  
  console.log('Added chat items to DOM, total:', chatsList.children.length);
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
  get users() { return users; },
  set users(value) { users = value; },
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

// Initialize on DOM load (handled by app.js)
// document.addEventListener('DOMContentLoaded', initializeCore);
