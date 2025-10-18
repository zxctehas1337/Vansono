// ===== UI MODULE =====
// Управление интерфейсом, темами и меню

// ===== THEME CONFIGURATIONS =====

const themes = {
  dark: {
    '--bg-primary': '#1a1a1a',
    '--bg-secondary': '#242424',
    '--bg-tertiary': '#2f2f2f',
    '--text-primary': '#ffffff',
    '--text-secondary': '#a0a0a0',
    '--text-tertiary': '#666666',
    '--accent-primary': '#667eea',
    '--accent-secondary': '#764ba2',
    '--border-color': '#333333',
    '--success': '#10B981',
    '--error': '#EF4444'
  },
  light: {
    '--bg-primary': '#ffffff',
    '--bg-secondary': '#f5f5f5',
    '--bg-tertiary': '#e5e5e5',
    '--text-primary': '#1a1a1a',
    '--text-secondary': '#666666',
    '--text-tertiary': '#999999',
    '--accent-primary': '#667eea',
    '--accent-secondary': '#764ba2',
    '--border-color': '#e0e0e0',
    '--success': '#10B981',
    '--error': '#EF4444'
  },
  monokai: {
    '--bg-primary': '#272822',
    '--bg-secondary': '#3e3d32',
    '--bg-tertiary': '#49483e',
    '--text-primary': '#f8f8f2',
    '--text-secondary': '#a6e22e',
    '--text-tertiary': '#75715e',
    '--accent-primary': '#fd971f',
    '--accent-secondary': '#ae81ff',
    '--border-color': '#49483e',
    '--success': '#a6e22e',
    '--error': '#f92672'
  },
  blue: {
    '--bg-primary': '#0f172a',
    '--bg-secondary': '#1e293b',
    '--bg-tertiary': '#334155',
    '--text-primary': '#f1f5f9',
    '--text-secondary': '#94a3b8',
    '--text-tertiary': '#64748b',
    '--accent-primary': '#3b82f6',
    '--accent-secondary': '#1d4ed8',
    '--border-color': '#334155',
    '--success': '#10B981',
    '--error': '#EF4444'
  },
  purple: {
    '--bg-primary': '#1e1b2e',
    '--bg-secondary': '#2d1b69',
    '--bg-tertiary': '#3d2a8a',
    '--text-primary': '#f3e8ff',
    '--text-secondary': '#c4b5fd',
    '--text-tertiary': '#a78bfa',
    '--accent-primary': '#8b5cf6',
    '--accent-secondary': '#7c3aed',
    '--border-color': '#3d2a8a',
    '--success': '#10B981',
    '--error': '#EF4444'
  },
  green: {
    '--bg-primary': '#0f1b0f',
    '--bg-secondary': '#1a2e1a',
    '--bg-tertiary': '#2d4a2d',
    '--text-primary': '#f0fff0',
    '--text-secondary': '#a7f3d0',
    '--text-tertiary': '#6ee7b7',
    '--accent-primary': '#10b981',
    '--accent-secondary': '#059669',
    '--border-color': '#2d4a2d',
    '--success': '#10B981',
    '--error': '#EF4444'
  }
};

// ===== THEME MANAGEMENT =====

// Theme switching function
function switchTheme() {
  const themeNames = Object.keys(themes);
  const currentTheme = localStorage.getItem('theme') || 'dark';
  const currentIndex = themeNames.indexOf(currentTheme);
  const nextIndex = (currentIndex + 1) % themeNames.length;
  const nextTheme = themeNames[nextIndex];
  
  applyTheme(nextTheme);
  localStorage.setItem('theme', nextTheme);
}

// Apply theme function
function applyTheme(themeName) {
  const theme = themes[themeName];
  if (theme) {
    Object.entries(theme).forEach(([property, value]) => {
      document.documentElement.style.setProperty(property, value);
    });
  }
}

// ===== MENU SYSTEM =====

// Menu elements
const menuBtn = document.getElementById('menu-btn');
const menuOverlay = document.getElementById('menu-overlay');
const closeMenuBtn = document.getElementById('close-menu-btn');
const favoritesBtn = document.getElementById('favorites-btn');
const profileBtn = document.getElementById('profile-btn');
const settingsBtn = document.getElementById('settings-btn');
const exitBtn = document.getElementById('exit-btn');

// Screen elements
const profileScreen = document.getElementById('profile-screen');
const settingsScreen = document.getElementById('settings-screen');
const favoritesChat = document.getElementById('favorites-chat');

// Back buttons
const backFromProfile = document.getElementById('back-from-profile');
const backFromSettings = document.getElementById('back-from-settings');
const backFromFavorites = document.getElementById('back-from-favorites');

// Profile elements
const profileAvatar = document.getElementById('profile-avatar');
const profileName = document.getElementById('profile-name');
const profileUsername = document.getElementById('profile-username');
const avatarLetter = document.getElementById('avatar-letter');
const colorOptions = document.querySelectorAll('.color-option');
const saveProfileBtn = document.getElementById('save-profile-btn');

// Settings elements
const themeSelect = document.getElementById('theme-select');
const messageSizeSelect = document.getElementById('message-size-select');

// Favorites elements
const favoritesMessages = document.getElementById('favorites-messages');
const favoritesInput = document.getElementById('favorites-input');
const favoritesSendBtn = document.getElementById('favorites-send-btn');

// ===== MENU FUNCTIONALITY =====

// Menu functionality
if (menuBtn) {
  menuBtn.addEventListener('click', () => {
    menuOverlay.classList.add('active');
  });
}
if (closeMenuBtn) {
  closeMenuBtn.addEventListener('click', () => {
    menuOverlay.classList.remove('active');
  });
}
// Close menu when clicking outside
if (menuOverlay) {
  menuOverlay.addEventListener('click', (e) => {
    if (e.target === menuOverlay) {
      menuOverlay.classList.remove('active');
    }
  });
}

// Menu item handlers
if (favoritesBtn) {
  favoritesBtn.addEventListener('click', () => {
    menuOverlay.classList.remove('active');
    showFavorites();
  });
}
if (profileBtn) {
  profileBtn.addEventListener('click', () => {
    menuOverlay.classList.remove('active');
    showProfile();
  });
}
if (settingsBtn) {
  settingsBtn.addEventListener('click', () => {
    menuOverlay.classList.remove('active');
    showSettings();
  });
}
if (exitBtn) {
  exitBtn.addEventListener('click', () => {
    menuOverlay.classList.remove('active');
    window.Auth.logout();
  });
}

// Back button handlers
if (backFromProfile) {
  backFromProfile.addEventListener('click', () => {
    profileScreen.classList.remove('active');
    document.getElementById('chat-screen').classList.add('active');
  });
}
if (backFromSettings) {
  backFromSettings.addEventListener('click', () => {
    settingsScreen.classList.remove('active');
    document.getElementById('chat-screen').classList.add('active');
  });
}
if (backFromFavorites) {
  backFromFavorites.addEventListener('click', () => {
    favoritesChat.style.display = 'none';
    document.getElementById('chat-screen').classList.add('active');
  });
}

// ===== FAVORITES FUNCTIONALITY =====

function showFavorites() {
  document.getElementById('chat-screen').classList.remove('active');
  favoritesChat.style.display = 'flex';
  loadFavoritesMessages();
}

function loadFavoritesMessages() {
  const savedMessages = JSON.parse(localStorage.getItem('favoritesMessages') || '[]');
  favoritesMessages.innerHTML = '';
  
  if (savedMessages.length === 0) {
    favoritesMessages.innerHTML = `
      <div class="favorites-welcome">
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
          <path d="M40 4L48 16L62 18L52 28L56 42L40 36L24 42L28 28L18 18L32 16L40 4Z" stroke="url(#gradient3)" stroke-width="2" stroke-linejoin="round"/>
          <defs>
            <linearGradient id="gradient3" x1="0" y1="0" x2="80" y2="80">
              <stop offset="0%" stop-color="#667eea"/>
              <stop offset="100%" stop-color="#764ba2"/>
            </linearGradient>
          </defs>
        </svg>
        <h3>Welcome to Favorites!</h3>
        <p>This is your personal space to save important messages, notes, and thoughts.</p>
      </div>
    `;
  } else {
    savedMessages.forEach(message => {
      displayFavoritesMessage(message);
    });
  }
}

function displayFavoritesMessage(message) {
  const messageEl = document.createElement('div');
  messageEl.className = 'favorites-message';
  
  const time = new Date(message.timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  messageEl.innerHTML = `
    <div class="favorites-message-content">
      <div class="favorites-message-bubble">${window.Core.escapeHtml(message.text)}</div>
      <div class="favorites-message-meta">
        <div class="favorites-message-time">${time}</div>
      </div>
    </div>
  `;

  favoritesMessages.appendChild(messageEl);
}

function saveFavoritesMessage(text) {
  const message = {
    id: Date.now(),
    text: text,
    timestamp: Date.now()
  };
  
  const savedMessages = JSON.parse(localStorage.getItem('favoritesMessages') || '[]');
  savedMessages.push(message);
  localStorage.setItem('favoritesMessages', JSON.stringify(savedMessages));
  
  displayFavoritesMessage(message);
  favoritesMessages.scrollTop = favoritesMessages.scrollHeight;
}

// Favorites input handling
favoritesSendBtn.addEventListener('click', () => {
  const text = favoritesInput.value.trim();
  if (text) {
    saveFavoritesMessage(text);
    favoritesInput.value = '';
  }
});

favoritesInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    const text = favoritesInput.value.trim();
    if (text) {
      saveFavoritesMessage(text);
      favoritesInput.value = '';
    }
  }
});

// ===== PROFILE FUNCTIONALITY =====

function showProfile() {
  document.getElementById('chat-screen').classList.remove('active');
  profileScreen.classList.add('active');
  
  // Load current user data
  if (window.Core.currentUser) {
    profileName.value = window.Core.currentUser.name;
    profileUsername.value = window.Core.currentUser.username;
    profileAvatar.textContent = window.Core.currentUser.name.charAt(0).toUpperCase();
    avatarLetter.value = window.Core.currentUser.name.charAt(0).toUpperCase();
  }
}

// Avatar customization
colorOptions.forEach(option => {
  option.addEventListener('click', () => {
    colorOptions.forEach(opt => opt.classList.remove('selected'));
    option.classList.add('selected');
    
    const color = option.dataset.color;
    profileAvatar.style.background = color;
    // Update main avatar too
    document.getElementById('current-user-avatar').style.background = color;
  });
});

avatarLetter.addEventListener('input', (e) => {
  const letter = e.target.value.toUpperCase();
  profileAvatar.textContent = letter;
  document.getElementById('current-user-avatar').textContent = letter;
});

saveProfileBtn.addEventListener('click', () => {
  const newName = profileName.value.trim();
  const newUsername = profileUsername.value.trim();
  
  if (!newName || !newUsername) {
    window.Core.showNotification('Please fill in all fields', 'error');
    return;
  }
  
  // Check if username is valid
  if (!newUsername.startsWith('@')) {
    window.Core.showNotification('Username must start with @', 'error');
    return;
  }
  
  // Update current user
  if (window.Core.currentUser) {
    window.Core.currentUser.name = newName;
    window.Core.currentUser.username = newUsername;
    
    // Update avatar letter if changed
    const newLetter = avatarLetter.value.toUpperCase();
    if (newLetter) {
      window.Core.currentUser.avatarLetter = newLetter;
    }
    
    // Update avatar color if selected
    const selectedColor = document.querySelector('.color-option.selected')?.dataset.color;
    if (selectedColor) {
      window.Core.currentUser.avatarColor = selectedColor;
    }
    
    // Update display
    window.Core.updateUserDisplay(window.Core.currentUser);
    
    // Save to localStorage
    localStorage.setItem('userData', JSON.stringify(window.Core.currentUser));
    
    window.Core.showNotification('Profile updated successfully', 'success');
  }
});

// ===== SETTINGS FUNCTIONALITY =====

function showSettings() {
  document.getElementById('chat-screen').classList.remove('active');
  settingsScreen.classList.add('active');
  
  // Load current settings
  const currentTheme = localStorage.getItem('theme') || 'dark';
  const currentMessageSize = localStorage.getItem('messageSize') || 'medium';
  
  themeSelect.value = currentTheme;
  messageSizeSelect.value = currentMessageSize;
}

// Theme selection
themeSelect.addEventListener('change', (e) => {
  const theme = e.target.value;
  applyTheme(theme);
  localStorage.setItem('theme', theme);
});

// Message size selection
messageSizeSelect.addEventListener('change', (e) => {
  const size = e.target.value;
  applyMessageSize(size);
  localStorage.setItem('messageSize', size);
});

function applyMessageSize(size) {
  const messagesContainer = document.getElementById('messages-container');
  const messageBubbles = document.querySelectorAll('.message-bubble');
  
  // Remove existing size classes
  messagesContainer.classList.remove('message-size-small', 'message-size-medium', 'message-size-large');
  
  // Add new size class
  messagesContainer.classList.add(`message-size-${size}`);
  
  // Apply size to message bubbles
  messageBubbles.forEach(bubble => {
    bubble.classList.remove('message-size-small', 'message-size-medium', 'message-size-large');
    bubble.classList.add(`message-size-${size}`);
  });
}

// ===== BACKGROUND CUSTOMIZATION =====

// Background customization
const backgroundOptions = document.querySelectorAll('.background-option');

// Setup background customization
function setupBackgroundCustomization() {
  backgroundOptions.forEach(option => {
    option.addEventListener('click', () => {
      // Remove selected class from all options
      backgroundOptions.forEach(opt => opt.classList.remove('selected'));
      
      // Add selected class to clicked option
      option.classList.add('selected');
      
      // Apply background
      const background = option.dataset.background;
      applyBackground(background);
      
      // Save preference
      localStorage.setItem('selectedBackground', background);
    });
  });
  
  // Load saved background
  const savedBackground = localStorage.getItem('selectedBackground') || 'default';
  const savedOption = document.querySelector(`[data-background="${savedBackground}"]`);
  if (savedOption) {
    savedOption.classList.add('selected');
    applyBackground(savedBackground);
  }
}

// Apply background
function applyBackground(background) {
  const body = document.body;
  
  switch (background) {
    case 'default':
      body.style.background = 'var(--bg-primary)';
      break;
    case 'gradient1':
      body.style.background = 'linear-gradient(135deg, #667eea, #764ba2)';
      break;
    case 'gradient2':
      body.style.background = 'linear-gradient(135deg, #10B981, #059669)';
      break;
    case 'gradient3':
      body.style.background = 'linear-gradient(135deg, #F59E0B, #D97706)';
      break;
    default:
      body.style.background = 'var(--bg-primary)';
  }
}

// ===== INITIALIZATION =====

function initializeUI() {
  // Initialize theme
  const savedTheme = localStorage.getItem('theme') || 'dark';
  applyTheme(savedTheme);
  
  // Initialize message size
  const savedMessageSize = localStorage.getItem('messageSize') || 'medium';
  applyMessageSize(savedMessageSize);
  
  // Setup background customization
  setupBackgroundCustomization();
  
  console.log('UI module initialized');
}

// Export functions for other modules
window.UI = {
  switchTheme,
  applyTheme,
  showFavorites,
  showProfile,
  showSettings,
  applyMessageSize,
  applyBackground,
  setupBackgroundCustomization,
  initializeUI
};

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', initializeUI);
