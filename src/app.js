const socket = io(window.location.origin.includes('localhost') ? 'http://localhost:3000' : window.location.origin);
// State
let currentUser = null;
let currentChatUser = null;
let peer = null;
let localStream = null;
let currentCallData = null;
let callStartTime = null;
let callEndTime = null;
let callDuration = null;

// DOM Elements
const authScreen = document.getElementById('auth-screen');
const chatScreen = document.getElementById('chat-screen');
const callScreen = document.getElementById('call-screen');

// Auth forms
const registerForm = document.getElementById('register-form');
const loginForm = document.getElementById('login-form');

// Auth inputs
const regName = document.getElementById('reg-name');
const regUsername = document.getElementById('reg-username');
const regPassword = document.getElementById('reg-password');
const regCaptcha = document.getElementById('reg-captcha');
const captchaQuestion = document.getElementById('captcha-question');
const captchaRefresh = document.getElementById('captcha-refresh');

const loginUsername = document.getElementById('login-username');
const loginPassword = document.getElementById('login-password');
const loginCaptcha = document.getElementById('login-captcha');
const captchaQuestionLogin = document.getElementById('captcha-question-login');
const captchaRefreshLogin = document.getElementById('captcha-refresh-login');

// Auth buttons
const registerBtn = document.getElementById('register-btn');
const loginBtn = document.getElementById('login-btn');
const showLoginLink = document.getElementById('show-login');
const showRegisterLink = document.getElementById('show-register');
const backToWelcome = document.getElementById('back-to-welcome');

// ===== Captcha helpers =====
function requestCaptcha(forLogin = false) {
  socket.emit('captcha:get');
}

socket.on('captcha:question', ({ question }) => {
  // Always display on both forms so user can switch without missing it
  if (captchaQuestionLogin) captchaQuestionLogin.textContent = question;
  if (captchaQuestion) captchaQuestion.textContent = question;
});

if (captchaRefresh) captchaRefresh.addEventListener('click', (e) => { e.preventDefault(); requestCaptcha(false); });
if (captchaRefreshLogin) captchaRefreshLogin.addEventListener('click', (e) => { e.preventDefault(); requestCaptcha(true); });

// Error message
const authError = document.getElementById('auth-error');

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

// Call buttons
const voiceCallBtn = document.getElementById('voice-call-btn');
const videoCallBtn = document.getElementById('video-call-btn');
const endCallBtn = document.getElementById('end-call-btn');
const muteBtn = document.getElementById('mute-btn');
const cameraBtn = document.getElementById('camera-btn');

// Call elements
const callUserName = document.getElementById('call-user-name');
const callAvatar = document.getElementById('call-avatar');
const callStatus = document.getElementById('call-status');
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');

// Call control elements
const incomingCallControls = document.getElementById('incoming-call-controls');
const activeCallControls = document.getElementById('active-call-controls');
const acceptCallBtn = document.getElementById('accept-call-btn');
const declineCallBtn = document.getElementById('decline-call-btn');

// Audio visualization elements removed

// ===== AUTH LOGIC =====

// Show error message
function showError(message) {
  authError.textContent = message;
  authError.classList.add('show');
  setTimeout(() => authError.classList.remove('show'), 10000);
}

// Switch between auth forms
function switchForm(hideForm, showForm) {
  hideForm.classList.remove('active');
  setTimeout(() => showForm.classList.add('active'), 100);
}

// Registration (username + password + captcha)
registerBtn.addEventListener('click', () => {
  const name = regName.value.trim();
  const username = regUsername.value.trim();
  const password = regPassword.value.trim();
  const captchaAnswer = regCaptcha.value.trim();

  if (!name || !username || !password || !captchaAnswer) {
    showError('Please fill in all fields');
    return;
  }

  socket.emit('register', { name, username, password, captchaAnswer });
});

socket.on('register:error', (data) => {
  showError(data.message);
});

socket.on('register:success', (data) => {
  currentUser = data.user;
  initializeChat();
});

// Login (username + password + captcha)
loginBtn.addEventListener('click', () => {
  const username = loginUsername.value.trim();
  const password = loginPassword.value.trim();
  const captchaAnswer = loginCaptcha.value.trim();

  if (!username || !password || !captchaAnswer) {
    showError('Please fill in all fields');
    return;
  }

  socket.emit('login', { username, password, captchaAnswer });
});
// Persist token and auto-login
socket.on('login:success', (data) => {
  if (data.token) {
    localStorage.setItem('authToken', data.token);
    localStorage.setItem('userData', JSON.stringify(data.user));
  }
  currentUser = data.user;
  initializeChat();
});

socket.on('register:success', (data) => {
  if (data.token) {
    localStorage.setItem('authToken', data.token);
    localStorage.setItem('userData', JSON.stringify(data.user));
  }
  currentUser = data.user;
  initializeChat();
});

window.addEventListener('load', () => {
  const token = localStorage.getItem('authToken');
  const userData = localStorage.getItem('userData');
  
  if (token && userData) {
    try {
      const user = JSON.parse(userData);
      currentUser = user;
      socket.emit('auth:token', token);
    } catch (error) {
      console.error('Error parsing user data:', error);
      localStorage.removeItem('authToken');
      localStorage.removeItem('userData');
      requestCaptcha(false);
    }
  } else {
    // Ensure captcha is ready on initial load
    requestCaptcha(false);
  }
});

socket.on('auth:success', (data) => {
  currentUser = data.user;
  localStorage.setItem('userData', JSON.stringify(data.user));
  authScreen.classList.remove('active');
  chatScreen.classList.add('active');
  updateUserDisplay(data.user);
});

socket.on('auth:error', () => {
  localStorage.removeItem('authToken');
  localStorage.removeItem('userData');
  authScreen.classList.add('active');
  chatScreen.classList.remove('active');
  requestCaptcha(false);
});

socket.on('login:error', (data) => {
  showError(data.message);
});

// Form switching
showLoginLink.addEventListener('click', (e) => {
  e.preventDefault();
  switchForm(registerForm, loginForm);
  requestCaptcha(true);
});

showRegisterLink.addEventListener('click', (e) => {
  e.preventDefault();
  switchForm(loginForm, registerForm);
  requestCaptcha(false);
});

backToWelcome.addEventListener('click', () => {
  switchForm(loginForm, registerForm);
  requestCaptcha(false);
});

// ===== CHAT LOGIC =====

function initializeChat() {
  authScreen.classList.remove('active');
  chatScreen.classList.add('active');

  // Update current user display
  updateUserDisplay(currentUser);
}

// Load users list
socket.on('users:list', (users) => {
  chatsList.innerHTML = '';
  
  users.forEach(user => {
    if (user.id !== currentUser.id) {
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
    }
  });
});

// Open chat with user
function openChat(user) {
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

  // Load messages
  messagesContainer.innerHTML = '';
  socket.emit('messages:get', { userId: user.id });
  
  // Mark messages as read
  socket.emit('messages:mark-read', { userId: user.id });
}

// Display messages history
socket.on('messages:history', (messages) => {
  messagesContainer.innerHTML = '';
  messages.forEach(msg => displayMessage(msg));
  scrollToBottom();
});

// Send message
function sendMessage() {
  const text = messageInput.value.trim();
  
  if (!text || !currentChatUser) return;

  socket.emit('message:send', {
    to: currentChatUser.id,
    text
  });

  messageInput.value = '';
}

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

// Display message
function displayMessage(message) {
  const isSent = message.from === currentUser.id;
  const messageEl = document.createElement('div');
  messageEl.className = `message ${isSent ? 'sent' : ''}`;

  const time = new Date(message.timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const senderName = isSent ? currentUser.name : currentChatUser.name;

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

  messageEl.innerHTML = `
    <div class="message-avatar">${senderName.charAt(0).toUpperCase()}</div>
    <div class="message-content">
      <div class="message-bubble">${escapeHtml(message.text)}</div>
      <div class="message-meta">
        <div class="message-time">${time}</div>
        ${readReceipts}
      </div>
    </div>
  `;

  messagesContainer.appendChild(messageEl);
}

// Receive new message
socket.on('message:received', (message) => {
  if (currentChatUser && message.from === currentChatUser.id) {
    displayMessage(message);
    scrollToBottom();
  }
});

// Message sent confirmation
socket.on('message:sent', (message) => {
  displayMessage(message);
  scrollToBottom();
});

// Message read confirmation
socket.on('messages:read', (data) => {
  // Update read status for messages from the current chat user
  if (currentChatUser && data.from === currentChatUser.id) {
    // Re-render messages to show updated read status
    messagesContainer.innerHTML = '';
    socket.emit('messages:get', { userId: currentChatUser.id });
  }
});

function scrollToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Call history functions
function createCallHistoryMessage(callType, status, duration = null) {
  const timestamp = Date.now();
  let messageText = '';
  
  if (status === 'accepted') {
    if (duration) {
      const minutes = Math.floor(duration / 60);
      const seconds = Math.floor(duration % 60);
      const durationText = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
      messageText = ` ${callType} Сall accepted - Duration: ${durationText}`;
    } else {
      messageText = ` ${callType} Сall accepted`;
    }
  } else if (status === 'rejected') {
    messageText = ` ${callType} Сall rejected`;
  } else if (status === 'missed') {
    messageText = ` Missed ${callType} Сall`;
  }
  
  return {
    id: `call_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
    from: currentUser.id,
    to: currentChatUser.id,
    text: messageText,
    timestamp: timestamp,
    isCallHistory: true
  };
}

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`;
}

// ===== WEBRTC CALL LOGIC =====

// Voice call
voiceCallBtn.addEventListener('click', () => {
  if (!currentChatUser) return;
  initiateCall(false);
});

// Video call
videoCallBtn.addEventListener('click', () => {
  if (!currentChatUser) return;
  initiateCall(true);
});

async function initiateCall(video) {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video
    });

    localVideo.srcObject = localStream;
    if (!video) localVideo.style.display = 'none';

    peer = new SimplePeer({
      initiator: true,
      stream: localStream,
      trickle: false
    });

    peer.on('signal', (signal) => {
      socket.emit('call:initiate', {
        to: currentChatUser.id,
        signal,
        callType: video ? 'video' : 'voice'
      });
    });

    peer.on('stream', (remoteStream) => {
      remoteVideo.srcObject = remoteStream;
      startAudioVisualization(remoteStream, null);
    });

    showCallScreen(currentChatUser.name, 'Calling...', false);
    startAudioVisualization(localStream, null);
    
    // Track call start time
    callStartTime = Date.now();
  } catch (error) {
    console.error('Error accessing media devices:', error);
    alert('Unable to access camera/microphone');
  }
}

// Incoming call
socket.on('call:incoming', (data) => {
  showIncomingCall(data.caller.name, data.callType);
  currentCallData = data;
});

function showIncomingCall(callerName, callType) {
  chatScreen.classList.remove('active');
  callScreen.classList.add('active');
  
  callUserName.textContent = callerName;
  callAvatar.textContent = callerName.charAt(0).toUpperCase();
  callStatus.textContent = `Incoming ${callType} call...`;
  
  // Show incoming call controls
  incomingCallControls.style.display = 'flex';
  activeCallControls.style.display = 'none';
  
  // Add ringing animation
  document.querySelector('.call-info').classList.add('ringing');
}

// Accept call
acceptCallBtn.addEventListener('click', async () => {
  if (!currentCallData) return;
  
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: currentCallData.callType === 'video'
    });

    localVideo.srcObject = localStream;
    if (currentCallData.callType !== 'video') localVideo.style.display = 'none';

    peer = new SimplePeer({
      initiator: false,
      stream: localStream,
      trickle: false
    });

    peer.on('signal', (answerSignal) => {
      socket.emit('call:accept', {
        to: currentCallData.from,
        signal: answerSignal
      });
    });

    peer.on('stream', (remoteStream) => {
      remoteVideo.srcObject = remoteStream;
      startAudioVisualization(remoteStream, null);
    });

    peer.signal(currentCallData.signal);
    
    // Switch to active call controls
    incomingCallControls.style.display = 'none';
    activeCallControls.style.display = 'flex';
    document.querySelector('.call-info').classList.remove('ringing');
    
    callStatus.textContent = 'Connected';
    startAudioVisualization(localStream, null);
    
    // Track call start time for accepted calls
    callStartTime = Date.now();
  } catch (error) {
    console.error('Error answering call:', error);
    endCall();
  }
});

// Decline call
declineCallBtn.addEventListener('click', () => {
  if (currentCallData) {
    socket.emit('call:decline', { to: currentCallData.from });
    
    // Create call history message for rejected call
    const callHistoryMessage = createCallHistoryMessage(currentCallData.callType, 'rejected');
    displayMessage(callHistoryMessage);
    scrollToBottom();
    
    // Send call history message to server
    socket.emit('message:send', {
      to: currentChatUser.id,
      text: callHistoryMessage.text,
      isCallHistory: true
    });
  }
  endCall();
});

// Call accepted
socket.on('call:accepted', (data) => {
  peer.signal(data.signal);
  callStatus.textContent = 'Connected';
});

// Call declined
socket.on('call:declined', () => {
  callStatus.textContent = 'Call declined';
  
  // Create call history message for declined call
  const callHistoryMessage = createCallHistoryMessage('voice', 'rejected');
  displayMessage(callHistoryMessage);
  scrollToBottom();
  
  // Send call history message to server
  socket.emit('message:send', {
    to: currentChatUser.id,
    text: callHistoryMessage.text,
    isCallHistory: true
  });
  
  setTimeout(() => endCall(), 2000);
});

// Call answered
socket.on('call:answered', (data) => {
  peer.signal(data.signal);
  callStatus.textContent = 'Connected';
});

// End call
endCallBtn.addEventListener('click', () => {
  endCall();
  if (currentChatUser) {
    socket.emit('call:end', { to: currentChatUser.id });
  }
});

socket.on('call:ended', () => {
  endCall();
});

function endCall() {
  // Calculate call duration if call was active
  if (callStartTime && currentCallData) {
    callEndTime = Date.now();
    callDuration = Math.floor((callEndTime - callStartTime) / 1000);
    
    // Create call history message for ended call
    const callHistoryMessage = createCallHistoryMessage(currentCallData.callType, 'accepted', callDuration);
    displayMessage(callHistoryMessage);
    scrollToBottom();
    
    // Send call history message to server
    socket.emit('message:send', {
      to: currentChatUser.id,
      text: callHistoryMessage.text,
      isCallHistory: true
    });
  }
  
  if (peer) {
    peer.destroy();
    peer = null;
  }

  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }

  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
  
  // Stop audio visualization
  stopAudioVisualization();

  // Reset UI
  incomingCallControls.style.display = 'none';
  activeCallControls.style.display = 'flex';
  document.querySelector('.call-info').classList.remove('ringing');
  
  // Reset call tracking variables
  currentCallData = null;
  callStartTime = null;
  callEndTime = null;
  callDuration = null;

  callScreen.classList.remove('active');
  chatScreen.classList.add('active');
}

// Mute/unmute
let isMuted = false;
muteBtn.addEventListener('click', () => {
  if (localStream) {
    isMuted = !isMuted;
    localStream.getAudioTracks()[0].enabled = !isMuted;
    muteBtn.style.opacity = isMuted ? '0.5' : '1';
  }
});

// Camera on/off
let isCameraOn = true;
cameraBtn.addEventListener('click', () => {
  if (localStream) {
    isCameraOn = !isCameraOn;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !isCameraOn;
      cameraBtn.style.opacity = isCameraOn ? '1' : '0.5';
      localVideo.style.display = isCameraOn ? 'block' : 'none';
    }
  }
});

function showCallScreen(name, status, showControls = true) {
  chatScreen.classList.remove('active');
  callScreen.classList.add('active');
  
  callUserName.textContent = name;
  callAvatar.textContent = name.charAt(0).toUpperCase();
  callStatus.textContent = status;
  
  if (showControls) {
    incomingCallControls.style.display = 'none';
    activeCallControls.style.display = 'flex';
  }
}

// Audio visualization - DISABLED (pulsating circles removed)
let audioContext = null;
let localAnalyser = null;
let remoteAnalyser = null;
let animationId = null;

function startAudioVisualization(stream, circleElement) {
  // Audio visualization disabled - no pulsating circles
  return;
}

function stopAudioVisualization() {
  // Audio visualization disabled - no pulsating circles
  return;
}

function animateAudioVisualization() {
  // Audio visualization disabled - no pulsating circles
  return;
}

// ===== UTILITIES =====

// Handle Enter key in inputs
regName.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') regUsername.focus();
});

regUsername.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') regPassword.focus();
});

regPassword.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') regCaptcha.focus();
});

regCaptcha.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') registerBtn.click();
});

loginUsername.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') loginPassword.focus();
});

loginPassword.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') loginCaptcha.focus();
});

loginCaptcha.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') loginBtn.click();
});

// Update the user display function
function updateUserDisplay(user) {
  document.getElementById('current-user-name').textContent = user.name;
  // Fix: Remove extra @ from username display
  document.getElementById('current-user-username').textContent = user.username.startsWith('@') ? user.username : `@${user.username}`;
  document.getElementById('current-user-avatar').textContent = user.name.charAt(0);
}

requestCaptcha(false);
console.log('Sontha messenger initialized');

// Add to your existing socket events
const searchInput = document.getElementById('search-input');

function debounce(fn, delay = 300) {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

if (searchInput) {
  searchInput.addEventListener('input', debounce((e) => {
    const query = e.target.value.trim();
    if (query.length < 2) return;
    socket.emit('search_users', query);
  }, 300));
}

socket.on('search_results', (users) => {
  updateUsersList(users);
});

function updateUsersList(users) {
  const chatsList = document.getElementById('chats-list');
  chatsList.innerHTML = users.map(user => `
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

// Theme configurations
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
  }
};

// Add this after your other DOM element selections
// const settingsBtn = document.getElementById('settings-btn'); // Removed - now handled in menu system

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
  Object.entries(theme).forEach(([property, value]) => {
    document.documentElement.style.setProperty(property, value);
  });
}

// Initialize theme
document.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  applyTheme(savedTheme);
});

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

// Menu functionality
menuBtn.addEventListener('click', () => {
  menuOverlay.classList.add('active');
});

closeMenuBtn.addEventListener('click', () => {
  menuOverlay.classList.remove('active');
});

// Close menu when clicking outside
menuOverlay.addEventListener('click', (e) => {
  if (e.target === menuOverlay) {
    menuOverlay.classList.remove('active');
  }
});

// Menu item handlers
favoritesBtn.addEventListener('click', () => {
  menuOverlay.classList.remove('active');
  showFavorites();
});

profileBtn.addEventListener('click', () => {
  menuOverlay.classList.remove('active');
  showProfile();
});

settingsBtn.addEventListener('click', () => {
  menuOverlay.classList.remove('active');
  showSettings();
});

exitBtn.addEventListener('click', () => {
  menuOverlay.classList.remove('active');
  logout();
});

// Back button handlers
backFromProfile.addEventListener('click', () => {
  profileScreen.classList.remove('active');
  chatScreen.classList.add('active');
});

backFromSettings.addEventListener('click', () => {
  settingsScreen.classList.remove('active');
  chatScreen.classList.add('active');
});

backFromFavorites.addEventListener('click', () => {
  favoritesChat.style.display = 'none';
  chatScreen.classList.add('active');
});

// ===== FAVORITES FUNCTIONALITY =====

function showFavorites() {
  chatScreen.classList.remove('active');
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
      <div class="favorites-message-bubble">${escapeHtml(message.text)}</div>
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
  chatScreen.classList.remove('active');
  profileScreen.classList.add('active');
  
  // Load current user data
  if (currentUser) {
    profileName.value = currentUser.name;
    profileUsername.value = currentUser.username;
    profileAvatar.textContent = currentUser.name.charAt(0).toUpperCase();
    avatarLetter.value = currentUser.name.charAt(0).toUpperCase();
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
    currentUserAvatar.style.background = color;
  });
});

avatarLetter.addEventListener('input', (e) => {
  const letter = e.target.value.toUpperCase();
  profileAvatar.textContent = letter;
  currentUserAvatar.textContent = letter;
});

saveProfileBtn.addEventListener('click', () => {
  const newName = profileName.value.trim();
  const newUsername = profileUsername.value.trim();
  
  if (!newName || !newUsername) {
    alert('Please fill in all fields');
    return;
  }
  
  // Update current user
  if (currentUser) {
    currentUser.name = newName;
    currentUser.username = newUsername;
    
    // Update display
    updateUserDisplay(currentUser);
    
    // Save to localStorage
    localStorage.setItem('userData', JSON.stringify(currentUser));
    
    alert('Profile updated successfully!');
  }
});

// ===== SETTINGS FUNCTIONALITY =====

function showSettings() {
  chatScreen.classList.remove('active');
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

// ===== LOGOUT FUNCTIONALITY =====

function logout() {
  localStorage.removeItem('authToken');
  localStorage.removeItem('userData');
  localStorage.removeItem('favoritesMessages');
  
  // Reset state
  currentUser = null;
  currentChatUser = null;
  
  // Show auth screen
  chatScreen.classList.remove('active');
  authScreen.classList.add('active');
  
  // Reset forms
  document.getElementById('register-form').classList.add('active');
  document.getElementById('login-form').classList.remove('active');
  
  // Clear form fields
  document.getElementById('reg-name').value = '';
  document.getElementById('reg-username').value = '';
  document.getElementById('reg-password').value = '';
  document.getElementById('reg-captcha').value = '';
  document.getElementById('login-username').value = '';
  document.getElementById('login-password').value = '';
  document.getElementById('login-captcha').value = '';
  
  requestCaptcha(false);
}

// ===== ENHANCED THEMES =====

// Update themes object with new themes
const enhancedThemes = {
  ...themes,
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

// Update applyTheme function to use enhanced themes
function applyTheme(themeName) {
  const theme = enhancedThemes[themeName];
  if (theme) {
    Object.entries(theme).forEach(([property, value]) => {
      document.documentElement.style.setProperty(property, value);
    });
  }
}

// Initialize message size on load
document.addEventListener('DOMContentLoaded', () => {
  const savedMessageSize = localStorage.getItem('messageSize') || 'medium';
  applyMessageSize(savedMessageSize);
});

// Add this to your initialization code
// settingsBtn.addEventListener('click', switchTheme); // Remove this line since we now have menu system