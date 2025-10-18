// ===== AUTH MODULE =====
// Аутентификация и управление пользователями

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

// Error message
const authError = document.getElementById('auth-error');

// ===== CAPTCHA HELPERS =====

function requestCaptcha(forLogin = false) {
  window.Core.socket.emit('captcha:get');
}

window.Core.socket.on('captcha:question', ({ question }) => {
  // Always display on both forms so user can switch without missing it
  if (captchaQuestionLogin) captchaQuestionLogin.textContent = question;
  if (captchaQuestion) captchaQuestion.textContent = question;
});

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

// Registration (username + password + captcha)
registerBtn.addEventListener('click', () => {
  const name = regName.value.trim();
  let username = regUsername.value.trim();
  const password = regPassword.value.trim();
  const captchaAnswer = regCaptcha.value.trim();

  if (!name || !username || !password || !captchaAnswer) {
    showError('Please fill in all fields');
    return;
  }

  // Auto-add @ if not present
  if (!username.startsWith('@')) {
    username = '@' + username;
    regUsername.value = username;
  }

  window.Core.socket.emit('register', { name, username, password, captchaAnswer });
});

window.Core.socket.on('register:error', (data) => {
  showError(data.message);
});

window.Core.socket.on('register:success', (data) => {
  if (data.token) {
    localStorage.setItem('authToken', data.token);
    localStorage.setItem('userData', JSON.stringify(data.user));
  }
  window.Core.currentUser = data.user;
  window.Core.updateUserDisplay(data.user);
  window.Core.initializeChat();
});

// Login (username + password + captcha)
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

  window.Core.socket.emit('login', { username, password, captchaAnswer });
});

// Persist token and auto-login
window.Core.socket.on('login:success', (data) => {
  if (data.token) {
    localStorage.setItem('authToken', data.token);
    localStorage.setItem('userData', JSON.stringify(data.user));
  }
  window.Core.currentUser = data.user;
  window.Core.updateUserDisplay(data.user);
  window.Core.initializeChat();
});

// Auto-login on page load
window.addEventListener('load', () => {
  const token = localStorage.getItem('authToken');
  const userData = localStorage.getItem('userData');
  
  if (token && userData) {
    try {
      const user = JSON.parse(userData);
      window.Core.currentUser = user;
      window.Core.socket.emit('auth:token', token);
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

window.Core.socket.on('auth:success', (data) => {
  window.Core.currentUser = data.user;
  localStorage.setItem('userData', JSON.stringify(data.user));
  document.getElementById('auth-screen').classList.remove('active');
  document.getElementById('chat-screen').classList.add('active');
  window.Core.updateUserDisplay(data.user);
});

window.Core.socket.on('auth:error', () => {
  localStorage.removeItem('authToken');
  localStorage.removeItem('userData');
  document.getElementById('auth-screen').classList.add('active');
  document.getElementById('chat-screen').classList.remove('active');
  requestCaptcha(false);
});

window.Core.socket.on('login:error', (data) => {
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

// ===== LOGOUT FUNCTIONALITY =====

function logout() {
  localStorage.removeItem('authToken');
  localStorage.removeItem('userData');
  localStorage.removeItem('favoritesMessages');
  
  // Reset state
  window.Core.currentUser = null;
  window.Core.currentChatUser = null;
  
  // Show auth screen
  document.getElementById('chat-screen').classList.remove('active');
  document.getElementById('auth-screen').classList.add('active');
  
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

// ===== KEYBOARD NAVIGATION =====

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

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', initializeAuth);
