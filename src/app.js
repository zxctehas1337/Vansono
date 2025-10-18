// ===== MAIN APP INITIALIZATION =====
// Главный файл для инициализации всех модулей

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('Sontha messenger initializing...');
  
  // Initialize all modules in correct order
  try {
    // Core module must be initialized first
    if (window.Core && window.Core.initializeCore) {
      window.Core.initializeCore();
    }
    
    // Auth module
    if (window.Auth && window.Auth.initializeAuth) {
      window.Auth.initializeAuth();
    }
    
    // Chat module
    if (window.Chat && window.Chat.initializeChat) {
      window.Chat.initializeChat();
    }
    
    // Call module
    if (window.Call && window.Call.initializeCall) {
      window.Call.initializeCall();
    }
    
    // UI module
    if (window.UI && window.UI.initializeUI) {
      window.UI.initializeUI();
    }
    
    // Features module
    if (window.Features && window.Features.initializeFeatures) {
      window.Features.initializeFeatures();
    }
    
    console.log('Sontha messenger initialized successfully');
    
  } catch (error) {
    console.error('Error initializing Sontha messenger:', error);
  }
});

// Global error handler
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

// Unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

console.log('Sontha messenger main script loaded');