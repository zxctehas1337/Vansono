// ===== SOCIAL AUTH MODULE =====
// Интеграция с VK ID, OK, Mail.ru

// VK ID Configuration
const VK_CONFIG = {
  app: 54249385,
  redirectUrl: window.location.origin, // Убираем слеш в конце для совместимости с настройками VK
  responseMode: 'popup', // Переключаемся на popup режим для лучшей совместимости
  source: 'lowcode',
  scope: ''
};

// Initialize VK ID SDK
function initializeVKID() {
  if ('VKIDSDK' in window) {
    const VKID = window.VKIDSDK;
    
    console.log('Initializing VK ID with config:', VK_CONFIG);
    
    try {
      VKID.Config.init({
        app: VK_CONFIG.app,
        redirectUrl: VK_CONFIG.redirectUrl,
        responseMode: VKID.ConfigResponseMode.Popup, // Используем Popup режим
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
      .on(VKID.WidgetEvents.LOGIN_SUCCESS, function (payload) {
        console.log('VK ID Login Success Payload:', payload);
        
        // Проверяем наличие access_token
        if (payload.access_token) {
          handleVKIDSuccess(payload);
        } else if (payload.code) {
          // Если есть code, обмениваем его на токен
          const code = payload.code;
          const deviceId = payload.device_id;
          
          console.log('Exchanging code for token:', { code, deviceId });
          
          VKID.Auth.exchangeCode(code, deviceId)
            .then((tokenData) => {
              console.log('Token exchange successful:', tokenData);
              handleVKIDSuccess(tokenData);
            })
            .catch((error) => {
              console.error('Token exchange failed:', error);
              handleVKIDError(error);
            });
        } else {
          console.error('No access_token or code in payload:', payload);
          handleVKIDError({ error: 'invalid_response', error_description: 'No valid authentication data received' });
        }
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
  
  if (data.access_token || data.token) {
    const accessToken = data.access_token || data.token;
    
    // Получаем информацию о пользователе
    const userInfo = data.user || data.userInfo || {
      id: data.id || data.user_id,
      first_name: data.first_name,
      last_name: data.last_name,
      screen_name: data.screen_name,
      photo_200: data.photo_200
    };
    
    console.log('Sending to server:', {
      provider: 'vk',
      accessToken: accessToken,
      userInfo: userInfo
    });
    
    // Send token to server for verification and user creation/login
    window.Core.socket.emit('social:auth', {
      provider: 'vk',
      accessToken: accessToken,
      userInfo: userInfo
    });
  } else {
    console.error('No access token in VK ID response:', data);
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
      case 'popup_closed':
      case 'user_closed_popup':
        // Не показываем ошибку, если пользователь сам закрыл popup
        console.log('User closed the authentication popup');
        return;
      case 'invalid_redirect_uri':
        errorMessage = 'Redirect URL configuration error. Please contact support.';
        console.error('Redirect URI error - check VK app settings');
        break;
      default:
        errorMessage = error.error_description || errorMessage;
    }
  } else if (error && error.code === 2) {
    // Особая обработка ошибки "New tab has been closed"
    if (error.text && error.text.includes('closed')) {
      console.log('Authentication popup was closed by user');
      return; // Не показываем ошибку
    }
    errorMessage = 'Authentication window was closed unexpectedly. Please try again.';
  } else if (typeof error === 'string') {
    errorMessage = error;
  }
  
  // Показываем детальную ошибку в консоли для отладки
  console.error('Detailed error info:', {
    error: error,
    redirectUrl: VK_CONFIG.redirectUrl,
    appId: VK_CONFIG.app,
    responseMode: VK_CONFIG.responseMode
  });
  
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

// Функция для повторной попытки инициализации
let vkidInitAttempts = 0;
const MAX_VKID_INIT_ATTEMPTS = 3;

function retryVKIDInit() {
  vkidInitAttempts++;
  if (vkidInitAttempts <= MAX_VKID_INIT_ATTEMPTS) {
    console.log(`VK ID initialization attempt ${vkidInitAttempts}`);
    setTimeout(initializeVKID, 1000 * vkidInitAttempts);
  } else {
    console.error('Failed to initialize VK ID after maximum attempts');
    showVKIDError('Failed to load VK ID. Please refresh the page and try again.');
  }
}

// Initialize social auth when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing VK ID...');
  
  // Wait for VK ID SDK to load
  setTimeout(() => {
    if ('VKIDSDK' in window) {
      console.log('VK ID SDK found, initializing...');
      initializeVKID();
    } else {
      console.log('VK ID SDK not found, retrying...');
      retryVKIDInit();
    }
  }, 1000);
  
  // Дополнительная проверка через 3 секунды
  setTimeout(() => {
    if (!document.getElementById('vk-auth-widget').hasChildNodes()) {
      console.log('VK ID widget not rendered, trying alternative initialization...');
      retryVKIDInit();
    }
  }, 3000);
});

// Export functions for other modules
window.SocialAuth = {
  initializeVKID,
  handleVKIDSuccess,
  handleVKIDError,
  showVKIDError
};
