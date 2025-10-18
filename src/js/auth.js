// ===== AUTH MODULE =====
// Аутентификация и управление пользователями

// Auth forms
const registerForm = document.getElementById('register-form');
const loginForm = document.getElementById('login-form');

// Auth inputs (only login form now)
const captchaQuestion = document.getElementById('captcha-question');
const captchaRefresh = document.getElementById('captcha-refresh');

const loginUsername = document.getElementById('login-username');
const loginPassword = document.getElementById('login-password');
const loginCaptcha = document.getElementById('login-captcha');
const captchaQuestionLogin = document.getElementById('captcha-question-login');
const captchaRefreshLogin = document.getElementById('captcha-refresh-login');

// Auth buttons (only login form now)
const loginBtn = document.getElementById('login-btn');
const showLoginLink = document.getElementById('show-login');
const backToWelcome = document.getElementById('back-to-welcome');

// Error message
const authError = document.getElementById('auth-error');

// ===== CAPTCHA HELPERS =====

// Helper to safely get Core and Core.socket
function getCoreSocket() {
  if (
    typeof window !== "undefined" &&
    window.Core &&
    window.Core.socket
  ) {
    return window.Core.socket;
  }
  return null;
}

function requestCaptcha(forLogin = false) {
  const socket = getCoreSocket();
  if (socket) {
    socket.emit('captcha:get');
  } else {
    // Optional: log or show error for developers
    console.error('Core.socket not available when requesting captcha');
  }
}

// Register captcha question handler when socket is available
function registerCaptchaHandler() {
  const socket = getCoreSocket();
  if (socket) {
    socket.on('captcha:question', ({ question }) => {
      // Always display on both forms so user can switch without missing it
      if (captchaQuestionLogin) captchaQuestionLogin.textContent = question;
      if (captchaQuestion) captchaQuestion.textContent = question;
    });
  } else {
    // We do NOT throw here; if UI loads before socket, handler can be registered later in an init function.
    // Optional: Add a warning for developers
    console.warn('Core.socket not available to register captcha:question listener');
  }
}

// Call the handler registration
registerCaptchaHandler();

if (captchaRefresh) captchaRefresh.addEventListener('click', (e) => { e.preventDefault(); requestCaptcha(false); });
if (captchaRefreshLogin) captchaRefreshLogin.addEventListener('click', (e) => { e.preventDefault(); requestCaptcha(true); });

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

// Registration is now handled by social auth only

// Login (username + password + captcha)
if (loginBtn) {
  loginBtn.addEventListener('click', () => {
  let username = loginUsername.value.trim();
  const password = loginPassword.value.trim();
  const captchaAnswer = loginCaptcha.value.trim();

  if (!username || !password || !captchaAnswer) {
    showError('Please fill in all fields');
    return;
  }

  // Auto-add @ if not present
  if (!username.startsWith('@')) {
    username = '@' + username;
    loginUsername.value = username;
  }

  const socket = getCoreSocket();
  if (socket) {
    socket.emit('login', { username, password, captchaAnswer });
  } else {
    showError('Connection not available. Please try again.');
  }
  });
}

// Register auth socket handlers
function registerAuthHandlers() {
  const socket = getCoreSocket();
  if (socket) {
    // Persist token and auto-login
    socket.on('login:success', (data) => {
      if (data.token) {
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('userData', JSON.stringify(data.user));
      }
      window.Core.currentUser = data.user;
      
      // Use router for screen switching
      if (window.Router) {
        window.Router.setAuthenticated(true);
      } else {
        // Fallback for manual screen switching
        const authScreen = document.getElementById('auth-screen');
        const chatScreen = document.getElementById('chat-screen');
        
        if (authScreen) {
          authScreen.classList.remove('active');
          authScreen.style.display = 'none';
        }
        
        if (chatScreen) {
          chatScreen.classList.add('active');
          chatScreen.style.display = 'flex';
        }
      }
      
      window.Core.updateUserDisplay(data.user);
      window.Core.initializeChat();
    });

    socket.on('auth:success', (data) => {
      window.Core.currentUser = data.user;
      localStorage.setItem('userData', JSON.stringify(data.user));
      
      // Use router for screen switching
      if (window.Router) {
        window.Router.setAuthenticated(true);
      } else {
        // Fallback for manual screen switching
        const authScreen = document.getElementById('auth-screen');
        const chatScreen = document.getElementById('chat-screen');
        
        if (authScreen) {
          authScreen.classList.remove('active');
          authScreen.style.display = 'none';
        }
        
        if (chatScreen) {
          chatScreen.classList.add('active');
          chatScreen.style.display = 'flex';
        }
      }
      
      window.Core.updateUserDisplay(data.user);
      
      // Initialize chat interface
      if (window.Core && window.Core.initializeChat) {
        window.Core.initializeChat();
      }
    });

    socket.on('auth:error', () => {
      localStorage.removeItem('authToken');
      localStorage.removeItem('userData');
      
      // Use router for screen switching
      if (window.Router) {
        window.Router.setAuthenticated(false);
      } else {
        // Fallback for manual screen switching
        document.getElementById('auth-screen').classList.add('active');
        document.getElementById('chat-screen').classList.remove('active');
      }
      requestCaptcha(false);
    });

    socket.on('login:error', (data) => {
      showError(data.message);
    });
  }
}

// Auto-login on page load
window.addEventListener('load', () => {
  const token = localStorage.getItem('authToken');
  const userData = localStorage.getItem('userData');
  
  if (token && userData) {
    try {
      const user = JSON.parse(userData);
      window.Core.currentUser = user;
      const socket = getCoreSocket();
      if (socket) {
        socket.emit('auth:token', token);
      }
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

// Register auth handlers
registerAuthHandlers();

// Form switching
showLoginLink.addEventListener('click', (e) => {
  e.preventDefault();
  switchForm(registerForm, loginForm);
  requestCaptcha(true);
});

backToWelcome.addEventListener('click', () => {
  switchForm(loginForm, registerForm);
});

// ===== LOGOUT FUNCTIONALITY =====

function logout() {
  localStorage.removeItem('authToken');
  localStorage.removeItem('userData');
  localStorage.removeItem('favoritesMessages');
  
  // Reset state
  window.Core.currentUser = null;
  window.Core.currentChatUser = null;
  
  // Use router for screen switching
  if (window.Router) {
    window.Router.setAuthenticated(false);
  } else {
    // Fallback for manual screen switching
    document.getElementById('chat-screen').classList.remove('active');
    document.getElementById('auth-screen').classList.add('active');
  }
  
  // Reset forms
  const registerForm = document.getElementById('register-form');
  const loginForm = document.getElementById('login-form');
  if (registerForm) registerForm.classList.add('active');
  if (loginForm) loginForm.classList.remove('active');
  
  // Clear form fields
  const loginUsername = document.getElementById('login-username');
  const loginPassword = document.getElementById('login-password');
  const loginCaptcha = document.getElementById('login-captcha');
  if (loginUsername) loginUsername.value = '';
  if (loginPassword) loginPassword.value = '';
  if (loginCaptcha) loginCaptcha.value = '';
  
  requestCaptcha(false);
}

// ===== KEYBOARD NAVIGATION =====

// Handle Enter key in login inputs
if (loginUsername) {
  loginUsername.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') loginPassword.focus();
  });
}

if (loginPassword) {
  loginPassword.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') loginCaptcha.focus();
  });
}

if (loginCaptcha) {
  loginCaptcha.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') loginBtn.click();
  });
}

// ===== INITIALIZATION =====

function initializeAuth() {
  requestCaptcha(false);
  console.log('Auth module initialized');
}

// Export functions for other modules
window.Auth = {
  showError,
  switchForm,
  requestCaptcha,
  logout,
  initializeAuth
};

// Initialize on DOM load (handled by app.js)
// document.addEventListener('DOMContentLoaded', initializeAuth);
