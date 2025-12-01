/**
 * Constantes partagées pour l'application frontend
 */

// WebSocket
export const WEBSOCKET_PATHS = {
  FRIENDS: '/ws/friends',
  GAME: '/ws/game',
  CHAT: '/ws/chat'
} as const;

// Timeouts et intervalles (en millisecondes)
export const TIMEOUTS = {
  SEARCH_DELAY: 300,           // Délai de recherche d'amis
  STATUS_UPDATE: 60000,        // Fallback mise à jour statut (1 minute)
  NOTIFICATION_DURATION: 3000,  // Duration des notifications
  WEBSOCKET_RETRY: 5000        // Retry WebSocket connexion
} as const;

// URLs API
export const API_ENDPOINTS = {
  FRIENDS: '/users/friends',
  FRIEND_REQUESTS: '/users/friend-requests',
  SENT_REQUESTS: '/users/sent-requests',
  ONLINE_STATUS: '/users/online-status',
  USER_SEARCH: '/users/search'
} as const;

// Messages d'erreur courants
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error occurred',
  AUTH_REQUIRED: 'Authentication required',
  WEBSOCKET_ERROR: 'WebSocket connection failed'
} as const;