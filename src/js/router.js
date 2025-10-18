// ===== ROUTER MODULE =====
// Client-side routing for SPA navigation

// Router state
let currentRoute = '/';
let isAuthenticated = false;

// Route handlers
const routes = {
  '/': handleHome,
  '/chats': handleChats,
  '/chat/:userId': handleChatWithUser
};

// Initialize router
function initializeRouter() {
  console.log('Initializing router...');
  
  // Check authentication status
  const token = localStorage.getItem('authToken');
  const userData = localStorage.getItem('userData');
  isAuthenticated = !!(token && userData);
  
  // Get current path and handle it
  const path = window.location.pathname;
  console.log('Current path:', path, 'Authenticated:', isAuthenticated);
  
  // Handle initial route
  handleRoute(path);
  
  // Listen for browser back/forward
  window.addEventListener('popstate', (event) => {
    console.log('Popstate event:', event.state);
    handleRoute(window.location.pathname);
  });
}

// Handle route changes
function handleRoute(path) {
  console.log('Handling route:', path, 'Authenticated:', isAuthenticated);
  currentRoute = path;
  
  // If not authenticated and trying to access protected route
  if (!isAuthenticated && (path === '/chats' || path.startsWith('/chat/'))) {
    console.log('Redirecting to home - not authenticated');
    navigateTo('/');
    return;
  }
  
  // If authenticated and on home page, redirect to chats
  if (isAuthenticated && path === '/') {
    console.log('Redirecting to chats - already authenticated');
    navigateTo('/chats');
    return;
  }
  
  // Match route pattern
  for (const [pattern, handler] of Object.entries(routes)) {
    const match = matchRoute(pattern, path);
    if (match) {
      console.log('Route matched:', pattern, 'with params:', match.params);
      handler(match.params);
      return;
    }
  }
  
  // Default fallback
  console.log('No route matched, using default handler');
  handleHome();
}

// Match route pattern against path
function matchRoute(pattern, path) {
  // Convert pattern to regex
  const paramNames = [];
  const regexPattern = pattern.replace(/:([^/]+)/g, (match, paramName) => {
    paramNames.push(paramName);
    return '([^/]+)';
  });
  
  const regex = new RegExp(`^${regexPattern}$`);
  const match = path.match(regex);
  
  if (!match) return null;
  
  // Extract parameters
  const params = {};
  for (let i = 0; i < paramNames.length; i++) {
    params[paramNames[i]] = match[i + 1];
  }
  
  return { params };
}

// Navigate to new route
function navigateTo(path, replace = false) {
  console.log('Navigating to:', path, 'Replace:', replace);
  
  if (replace) {
    window.history.replaceState(null, '', path);
  } else {
    window.history.pushState(null, '', path);
  }
  
  handleRoute(path);
}

// Update authentication status
function setAuthenticated(authenticated) {
  console.log('Authentication status changed:', authenticated);
  isAuthenticated = authenticated;
  
  // Handle current route based on new auth status
  handleRoute(window.location.pathname);
}

// Route handlers
function handleHome() {
  console.log('Handling home route');
  
  if (isAuthenticated) {
    // Redirect authenticated users to chats
    navigateTo('/chats', true);
    return;
  }
  
  // Show auth screen
  showAuthScreen();
}

function handleChats() {
  console.log('Handling chats route');
  
  if (!isAuthenticated) {
    // Redirect unauthenticated users to home
    navigateTo('/', true);
    return;
  }
  
  // Show chat screen with empty state
  showChatScreen();
  clearCurrentChat();
}

function handleChatWithUser(params) {
  console.log('Handling chat with user:', params.userId);
  
  if (!isAuthenticated) {
    // Redirect unauthenticated users to home
    navigateTo('/', true);
    return;
  }
  
  // Show chat screen and load specific chat
  showChatScreen();
  loadChatWithUser(params.userId);
}

// Screen switching helpers
function showAuthScreen() {
  console.log('Showing auth screen');
  const authScreen = document.getElementById('auth-screen');
  const chatScreen = document.getElementById('chat-screen');
  
  if (authScreen) {
    authScreen.classList.add('active');
    authScreen.style.display = 'flex';
  }
  
  if (chatScreen) {
    chatScreen.classList.remove('active');
    chatScreen.style.display = 'none';
  }
}

function showChatScreen() {
  console.log('Showing chat screen');
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

// Chat helpers
function clearCurrentChat() {
  console.log('Clearing current chat');
  // Clear current chat state
  if (window.Core) {
    window.Core.currentChatUser = null;
  }
  
  // Hide chat container, show empty state
  const chatContainer = document.getElementById('chat-container');
  const emptyState = document.getElementById('empty-state');
  
  if (chatContainer) {
    chatContainer.style.display = 'none';
  }
  
  if (emptyState) {
    emptyState.style.display = 'flex';
  }
}

function loadChatWithUser(userId) {
  console.log('Loading chat with user:', userId);
  
  // Find user in the users list
  if (window.Core && window.Core.socket) {
    // Request user search to get user info
    window.Core.socket.emit('search_users', userId);
    
    // Listen for search results to identify the user
    const handleSearchResults = (results) => {
      const user = results.find(u => u.id === userId);
      if (user) {
        console.log('Found user for chat:', user);
        // Use existing chat opening logic
        if (window.Core.openChat) {
          window.Core.openChat(user);
        }
      } else {
        console.warn('User not found:', userId);
        // Fallback to chats list
        navigateTo('/chats', true);
      }
      // Remove this specific listener
      window.Core.socket.off('search_results', handleSearchResults);
    };
    
    window.Core.socket.on('search_results', handleSearchResults);
  }
}

// Export functions
window.Router = {
  initializeRouter,
  navigateTo,
  setAuthenticated,
  handleRoute,
  currentRoute: () => currentRoute
};