// ===== SOCIAL AUTH MODULE =====
// Интеграция с VK ID, OK, Mail.ru

// VK ID Configuration
const VK_CONFIG = {
  app: 54249385,
  redirectUrl: window.location.origin + '/',
  responseMode: 'callback',
  source: 'lowcode',
  scope: ''
};

// Initialize VK ID SDK
function initializeVKID() {
  if ('VKIDSDK' in window) {
    const VKID = window.VKIDSDK;
    
    try {
      VKID.Config.init({
        app: VK_CONFIG.app,
        redirectUrl: VK_CONFIG.redirectUrl,
        responseMode: VKID.ConfigResponseMode.Callback,
        source: VKID.ConfigSource.LOWCODE,
        scope: VK_CONFIG.scope
      });

      const oneTap = new VKID.OneTap();

      oneTap.render({
        container: document.getElementById('vk-auth-widget'),
        scheme: 'dark',
        showAlternativeLogin: true,
        styles: {
          borderRadius: 50,
          width: 415
        },
        oauthList: [
          'mail_ru',
          'ok_ru'
        ]
      })
      .on(VKID.WidgetEvents.ERROR, handleVKIDError)
      .on(VKID.OneTapInternalEvents.LOGIN_SUCCESS, function (payload) {
        const code = payload.code;
        const deviceId = payload.device_id;

        VKID.Auth.exchangeCode(code, deviceId)
          .then(handleVKIDSuccess)
          .catch(handleVKIDError);
      });

      console.log('VK ID SDK initialized successfully');
    } catch (error) {
      console.error('Error initializing VK ID SDK:', error);
      showVKIDError('Failed to initialize VK ID. Please refresh the page.');
    }
  } else {
    console.error('VK ID SDK not loaded');
    showVKIDError('VK ID SDK not loaded. Please check your internet connection.');
  }
}

// Handle successful VK ID authentication
function handleVKIDSuccess(data) {
  console.log('VK ID authentication successful:', data);
  
  if (data.access_token) {
    // Send token to server for verification and user creation/login
    window.Core.socket.emit('social:auth', {
      provider: 'vk',
      accessToken: data.access_token,
      userInfo: data.user
    });
  } else {
    showVKIDError('No access token received from VK ID');
  }
}

// Handle VK ID authentication error
function handleVKIDError(error) {
  console.error('VK ID authentication error:', error);
  
  let errorMessage = 'Authentication failed';
  
  if (error && error.error) {
    switch (error.error) {
      case 'access_denied':
        errorMessage = 'Access denied by user';
        break;
      case 'invalid_request':
        errorMessage = 'Invalid authentication request';
        break;
      case 'server_error':
        errorMessage = 'VK server error. Please try again later';
        break;
      default:
        errorMessage = error.error_description || errorMessage;
    }
  }
  
  showVKIDError(errorMessage);
}

// Show VK ID error message
function showVKIDError(message) {
  const errorElement = document.getElementById('auth-error');
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.classList.add('show');
    setTimeout(() => errorElement.classList.remove('show'), 10000);
  }
}

// Handle social authentication response from server
window.Core.socket.on('social:auth:success', (data) => {
  console.log('Social authentication successful:', data);
  
  if (data.token) {
    localStorage.setItem('authToken', data.token);
    localStorage.setItem('userData', JSON.stringify(data.user));
  }
  
  window.Core.currentUser = data.user;
  window.Core.updateUserDisplay(data.user);
  window.Core.initializeChat();
});

window.Core.socket.on('social:auth:error', (data) => {
  console.error('Social authentication error:', data);
  showVKIDError(data.message || 'Authentication failed');
});

// Initialize social auth when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Wait for VK ID SDK to load
  setTimeout(initializeVKID, 1000);
});

// Export functions for other modules
window.SocialAuth = {
  initializeVKID,
  handleVKIDSuccess,
  handleVKIDError,
  showVKIDError
};
