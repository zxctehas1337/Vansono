const socket = io(window.location.origin.includes('localhost') ? 'http://localhost:3000' : window.location.origin);
// State
let currentUser = null;
let currentChatUser = null;
let peer = null;
let localStream = null;

// DOM Elements
const authScreen = document.getElementById('auth-screen');
const chatScreen = document.getElementById('chat-screen');
const callScreen = document.getElementById('call-screen');

// Auth forms
const registerForm = document.getElementById('register-form');
const verificationForm = document.getElementById('verification-form');
const loginForm = document.getElementById('login-form');

// Auth inputs
const regEmail = document.getElementById('reg-email');
const regName = document.getElementById('reg-name');
const regUsername = document.getElementById('reg-username');
const loginUsername = document.getElementById('login-username');
const verifyEmailSpan = document.getElementById('verify-email');

// Auth buttons
const registerBtn = document.getElementById('register-btn');
const verifyBtn = document.getElementById('verify-btn');
const loginBtn = document.getElementById('login-btn');
const showLoginLink = document.getElementById('show-login');
const showRegisterLink = document.getElementById('show-register');
const backToRegister = document.getElementById('back-to-register');
const backToWelcome = document.getElementById('back-to-welcome');

// Code inputs
const codeInputs = document.querySelectorAll('.code-input');
const codeInputsContainer = document.querySelector('.code-inputs');

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

// Registration
registerBtn.addEventListener('click', () => {
  const email = regEmail.value.trim();
  const name = regName.value.trim();
  const username = regUsername.value.trim();

  if (!email || !name || !username) {
    showError('Please fill in all fields');
    return;
  }

  if (!email.includes('@')) {
    showError('Please enter a valid email');
    return;
  }

  socket.emit('register:request', { email, name, username });
});

socket.on('register:code-sent', () => {
  verifyEmailSpan.textContent = regEmail.value;
  switchForm(registerForm, verificationForm);
});

socket.on('register:error', (data) => {
  showError(data.message);
});

// Code input handling
codeInputs.forEach((input, index) => {
  input.addEventListener('input', (e) => {
    // Keep only digits and single char
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 1);
    if (e.target.value && index < codeInputs.length - 1) {
      codeInputs[index + 1].focus();
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && !e.target.value && index > 0) {
      codeInputs[index - 1].focus();
    }
    if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      codeInputs[index - 1].focus();
    }
    if (e.key === 'ArrowRight' && index < codeInputs.length - 1) {
      e.preventDefault();
      codeInputs[index + 1].focus();
    }
    if (e.key === 'Enter') {
      verifyBtn.click();
    }
  });
});

// Allow pasting full code (Ctrl+V)
if (codeInputsContainer) {
  codeInputsContainer.addEventListener('paste', (e) => {
    const clipboard = (e.clipboardData || window.clipboardData);
    if (!clipboard) return;
    e.preventDefault();
    const digits = clipboard.getData('text').replace(/\D/g, '').slice(0, codeInputs.length);
    codeInputs.forEach((input, i) => {
      input.value = digits[i] || '';
    });
    const nextIndex = digits.length < codeInputs.length ? digits.length : codeInputs.length - 1;
    codeInputs[nextIndex].focus();
    // Optionally focus Verify when complete
    if (digits.length === codeInputs.length) {
      verifyBtn.focus();
    }
  });
}

// Verification
verifyBtn.addEventListener('click', () => {
  const code = Array.from(codeInputs).map(input => input.value).join('');
  
  if (code.length !== 6) {
    showError('Please enter the complete verification code');
    return;
  }

  socket.emit('register:verify', {
    email: regEmail.value.trim(),
    code
  });
});

socket.on('register:success', (data) => {
  currentUser = data.user;
  initializeChat();
});

// Login
loginBtn.addEventListener('click', () => {
  const username = loginUsername.value.trim();

  if (!username) {
    showError('Please enter your username');
    return;
  }

  socket.emit('login', { username });
});

socket.on('login:success', (data) => {
  currentUser = data.user;
  initializeChat();
});

socket.on('login:error', (data) => {
  showError(data.message);
});

// Form switching
showLoginLink.addEventListener('click', (e) => {
  e.preventDefault();
  switchForm(registerForm, loginForm);
});

showRegisterLink.addEventListener('click', (e) => {
  e.preventDefault();
  switchForm(loginForm, registerForm);
});

backToRegister.addEventListener('click', () => {
  switchForm(verificationForm, registerForm);
  codeInputs.forEach(input => input.value = '');
});

backToWelcome.addEventListener('click', () => {
  switchForm(loginForm, registerForm);
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

  messageEl.innerHTML = `
    <div class="message-avatar">${senderName.charAt(0).toUpperCase()}</div>
    <div class="message-content">
      <div class="message-bubble">${escapeHtml(message.text)}</div>
      <div class="message-time">${time}</div>
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

function scrollToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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
        signal
      });
    });

    peer.on('stream', (remoteStream) => {
      remoteVideo.srcObject = remoteStream;
    });

    showCallScreen(currentChatUser.name, 'Calling...');
  } catch (error) {
    console.error('Error accessing media devices:', error);
    alert('Unable to access camera/microphone');
  }
}

// Incoming call
socket.on('call:incoming', (data) => {
  const accept = confirm(`Incoming call from ${data.caller.name}`);
  
  if (accept) {
    answerCall(data.signal, data.caller);
  } else {
    socket.emit('call:end', { to: data.from });
  }
});

async function answerCall(signal, caller) {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true
    });

    localVideo.srcObject = localStream;

    peer = new SimplePeer({
      initiator: false,
      stream: localStream,
      trickle: false
    });

    peer.on('signal', (answerSignal) => {
      socket.emit('call:answer', {
        to: caller.id,
        signal: answerSignal
      });
    });

    peer.on('stream', (remoteStream) => {
      remoteVideo.srcObject = remoteStream;
    });

    peer.signal(signal);
    showCallScreen(caller.name, 'Connected');
  } catch (error) {
    console.error('Error answering call:', error);
  }
}

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

function showCallScreen(name, status) {
  chatScreen.classList.remove('active');
  callScreen.classList.add('active');
  
  callUserName.textContent = name;
  callAvatar.textContent = name.charAt(0).toUpperCase();
  callStatus.textContent = status;
}

// ===== UTILITIES =====

// Handle Enter key in inputs
regEmail.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') regName.focus();
});

regName.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') regUsername.focus();
});

regUsername.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') registerBtn.click();
});

loginUsername.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') loginBtn.click();
});

// Update the user display function
function updateUserDisplay(user) {
  document.getElementById('current-user-name').textContent = user.name;
  // Fix: Remove extra @ from username display
  document.getElementById('current-user-username').textContent = user.username.startsWith('@') ? user.username : `@${user.username}`;
  document.getElementById('current-user-avatar').textContent = user.name.charAt(0);
}

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
