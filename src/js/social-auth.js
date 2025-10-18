// ===== SOCIAL AUTH MODULE =====
// Интеграция с Google OAuth и Yandex OAuth

// Google OAuth Configuration
const GOOGLE_CONFIG = {
  clientId: '260775726499-60afbdiha77eig1qsphoktihdhe99f14.apps.googleusercontent.com', // Замените на ваш Google Client ID из config.env
  redirectUri: window.location.origin + '/chats'
};

// Yandex OAuth Configuration
const YANDEX_CONFIG = {
  clientId: '8217fc55c26e4c35bf819d35f47072a3', // Замените на ваш Yandex Client ID из config.env
  redirectUri: window.location.origin + '/oauth/yandex/callback'
};

// Initialize Google OAuth
function initializeGoogleAuth() {
  if (typeof google !== 'undefined' && google.accounts) {
    console.log('Initializing Google OAuth...');
    
    try {
      google.accounts.id.initialize({
        client_id: GOOGLE_CONFIG.clientId,
        callback: handleGoogleResponse,
        auto_select: false,
        cancel_on_tap_outside: true
      });
      
      console.log('Google OAuth initialized successfully');
    } catch (error) {
      console.error('Error initializing Google OAuth:', error);
      showSocialAuthError('Failed to initialize Google authentication');
    }
  } else {
    console.error('Google OAuth SDK not loaded');
    showSocialAuthError('Google OAuth SDK not loaded');
  }
}

// Handle Google OAuth response
function handleGoogleResponse(response) {
  console.log('Google OAuth response received:', response);
  
  try {
    // Decode the JWT token
    const payload = JSON.parse(atob(response.credential.split('.')[1]));
    
    const userInfo = {
      id: payload.sub,
      name: payload.name,
      email: payload.email,
      picture: payload.picture,
      given_name: payload.given_name,
      family_name: payload.family_name
    };
    
    console.log('Sending Google auth to server:', {
      provider: 'google',
      userInfo: userInfo
    });
    
    // Send to server for verification and user creation/login
    if (window.Core && window.Core.socket) {
      window.Core.socket.emit('social:auth', {
        provider: 'google',
        accessToken: response.credential,
        userInfo: userInfo
      });
    } else {
      console.error('Core.socket not available');
      showSocialAuthError('Connection error. Please refresh the page.');
    }
  } catch (error) {
    console.error('Error processing Google response:', error);
    showSocialAuthError('Failed to process Google authentication');
  }
}

// Handle Google authentication error
function handleGoogleError(error) {
  console.error('Google authentication error:', error);
  showSocialAuthError('Google authentication failed');
}

// Initialize Yandex OAuth
function initializeYandexAuth() {
  console.log('Yandex OAuth will be handled via popup window');
}

// Handle Yandex OAuth login
function handleYandexLogin() {
  console.log('Starting Yandex OAuth flow...');
  
  const yandexAuthUrl = `https://oauth.yandex.ru/authorize?response_type=code&client_id=${YANDEX_CONFIG.clientId}&redirect_uri=${encodeURIComponent(YANDEX_CONFIG.redirectUri)}&scope=login:email+login:info`;
  
  // Open popup window
  const popup = window.open(
    yandexAuthUrl,
    'yandex-auth',
    'width=500,height=600,scrollbars=yes,resizable=yes'
  );
  
  // Listen for popup messages
  const messageListener = (event) => {
    if (event.origin !== window.location.origin) return;
    
    if (event.data.type === 'YANDEX_AUTH_SUCCESS') {
      console.log('Yandex auth success:', event.data);
      handleYandexSuccess(event.data);
      popup.close();
      window.removeEventListener('message', messageListener);
    } else if (event.data.type === 'YANDEX_AUTH_ERROR') {
      console.error('Yandex auth error:', event.data);
      handleYandexError(event.data.error);
      popup.close();
      window.removeEventListener('message', messageListener);
    }
  };
  
  window.addEventListener('message', messageListener);
  
  // Check if popup was closed manually
  const checkClosed = setInterval(() => {
    if (popup.closed) {
      clearInterval(checkClosed);
      window.removeEventListener('message', messageListener);
      console.log('Yandex auth popup was closed');
    }
  }, 1000);
}

// Handle successful Yandex authentication
function handleYandexSuccess(data) {
  console.log('Yandex authentication successful:', data);
  
  const userInfo = {
    id: data.user_id,
    name: data.real_name || data.display_name,
    email: data.default_email,
    picture: data.default_avatar_id ? `https://avatars.yandex.net/get-yapic/${data.default_avatar_id}/islands-200` : null,
    login: data.login
  };
  
  console.log('Sending Yandex auth to server:', {
    provider: 'yandex',
    userInfo: userInfo
  });
  
  // Send to server for verification and user creation/login
  if (window.Core && window.Core.socket) {
    window.Core.socket.emit('social:auth', {
      provider: 'yandex',
      accessToken: data.access_token,
      userInfo: userInfo
    });
  } else {
    console.error('Core.socket not available');
    showSocialAuthError('Connection error. Please refresh the page.');
  }
}

// Handle Yandex authentication error
function handleYandexError(error) {
  console.error('Yandex authentication error:', error);
  showSocialAuthError('Yandex authentication failed');
}

// Show social authentication error message
function showSocialAuthError(message) {
  const errorElement = document.getElementById('auth-error');
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.classList.add('show');
    setTimeout(() => errorElement.classList.remove('show'), 10000);
  }
}

// Handle social authentication response from server
let socketHandlersRegistered = false;

function registerSocketHandlers() {
  if (window.Core && window.Core.socket && !socketHandlersRegistered) {
    console.log('Registering socket handlers for social auth...');
    socketHandlersRegistered = true;
    
    window.Core.socket.on('social:auth:success', (data) => {
      console.log('Social authentication successful:', data);
      
      if (data.token) {
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('userData', JSON.stringify(data.user));
      }
      
      window.Core.currentUser = data.user;
      window.Core.updateUserDisplay(data.user);
      
      // Switch to chat screen
      const authScreen = document.getElementById('auth-screen');
      const chatScreen = document.getElementById('chat-screen');
      
      console.log('Switching screens:', { authScreen: !!authScreen, chatScreen: !!chatScreen });
      
      if (authScreen) {
        authScreen.classList.remove('active');
        console.log('Auth screen deactivated');
      }
      if (chatScreen) {
        chatScreen.classList.add('active');
        console.log('Chat screen activated');
      }
      
      // Initialize chat interface
      if (window.Core && window.Core.initializeChat) {
        window.Core.initializeChat();
        console.log('Chat interface initialized');
      } else {
        console.warn('Core.initializeChat not available');
      }
      
      console.log('User interface switched to chat screen successfully');
    });

    window.Core.socket.on('social:auth:error', (data) => {
      console.error('Social authentication error:', data);
      showSocialAuthError(data.message || 'Authentication failed');
    });

    // Handle token-based authentication success (for already logged in users)
    window.Core.socket.on('auth:success', (data) => {
      console.log('Token authentication successful:', data);
      
      window.Core.currentUser = data.user;
      localStorage.setItem('userData', JSON.stringify(data.user));
      
      // Switch to chat screen
      const authScreen = document.getElementById('auth-screen');
      const chatScreen = document.getElementById('chat-screen');
      
      if (authScreen) {
        authScreen.classList.remove('active');
      }
      if (chatScreen) {
        chatScreen.classList.add('active');
      }
      
      // Initialize chat interface
      if (window.Core && window.Core.initializeChat) {
        window.Core.initializeChat();
        console.log('Chat interface initialized from token auth');
      }
    });
  } else {
    setTimeout(registerSocketHandlers, 1000);
  }
}

// Initialize social auth (handled by app.js)
function initializeSocialAuth() {
  console.log('Initializing social auth...');
  
  // Register socket handlers
  registerSocketHandlers();
  
  // Initialize Google OAuth
  setTimeout(() => {
    if (typeof google !== 'undefined' && google.accounts) {
      initializeGoogleAuth();
    } else {
      console.log('Google OAuth SDK not found, retrying...');
      setTimeout(() => {
        if (typeof google !== 'undefined' && google.accounts) {
          initializeGoogleAuth();
        } else {
          console.error('Google OAuth SDK failed to load');
          showSocialAuthError('Google OAuth SDK failed to load');
        }
      }, 2000);
    }
  }, 1000);
  
  // Initialize Yandex OAuth
  initializeYandexAuth();
  
  // Add event listeners for social login buttons
  const googleBtn = document.getElementById('google-login-btn');
  const yandexBtn = document.getElementById('yandex-login-btn');
  
  if (googleBtn) {
    googleBtn.addEventListener('click', () => {
      console.log('Google login button clicked');
      if (typeof google !== 'undefined' && google.accounts) {
        google.accounts.id.prompt();
      } else {
        showSocialAuthError('Google OAuth not available');
      }
    });
  }
  
  if (yandexBtn) {
    yandexBtn.addEventListener('click', () => {
      console.log('Yandex login button clicked');
      handleYandexLogin();
    });
  }
}

// OAuth callback handling is now done on the server side

// Export functions for other modules
window.SocialAuth = {
  initializeGoogleAuth,
  initializeYandexAuth,
  handleGoogleResponse,
  handleYandexLogin,
  handleYandexSuccess,
  handleYandexError,
  showSocialAuthError,
  registerSocketHandlers,
  initializeSocialAuth
};

// Register handlers if Core is already available
if (window.Core && window.Core.socket) {
  console.log('Core.socket already available, registering handlers immediately');
  registerSocketHandlers();
} else {
  console.log('Core.socket not yet available, will register handlers when ready');
}