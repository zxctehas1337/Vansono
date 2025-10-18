// ===== MAIN APP INITIALIZATION =====
// Главный файл для инициализации всех модулей

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('Sontha messenger initializing...');
  
  // Initialize all modules in correct order
  try {
    // Core module must be initialized first
    if (typeof initializeCore === 'function') {
      initializeCore();
      console.log('Core module initialized');
    } else {
      console.error('Core module initializeCore function not found');
    }
    
    // Router module (after core)
    if (window.Router && window.Router.initializeRouter) {
      window.Router.initializeRouter();
      console.log('Router module initialized');
    } else {
      console.warn('Router module initializeRouter function not found');
    }
    
    // Auth module
    if (window.Auth && window.Auth.initializeAuth) {
      window.Auth.initializeAuth();
      console.log('Auth module initialized');
    } else {
      console.warn('Auth module initializeAuth function not found');
    }
    
    // Chat module initialization is handled by Core module after authentication
    
    // Social Auth module
    if (window.SocialAuth && window.SocialAuth.initializeSocialAuth) {
      window.SocialAuth.initializeSocialAuth();
      console.log('Social Auth module initialized');
    } else {
      console.warn('Social Auth module initializeSocialAuth function not found');
    }
    
    // UI module (if exists)
    if (window.UI && window.UI.initializeUI) {
      window.UI.initializeUI();
      console.log('UI module initialized');
    }
    
    // Features module (if exists)
    if (window.Features && window.Features.initializeFeatures) {
      window.Features.initializeFeatures();
      console.log('Features module initialized');
    }
    
    // Call module (if exists)
    if (window.Call && window.Call.initializeCall) {
      window.Call.initializeCall();
      console.log('Call module initialized');
    }
    
  } catch (error) {
    console.error('Error during app initialization:', error);
  }
});

// Global error handler
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});