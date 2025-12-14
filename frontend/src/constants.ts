
export const WEBSOCKET_PATHS = {
  FRIENDS: '/ws/friends',
  GAME: '/ws/game',
  CHAT: '/ws/chat'
} as const;

export const TIMEOUTS = {
  SEARCH_DELAY: 300,         
  STATUS_UPDATE: 60000,       
  NOTIFICATION_DURATION: 3000,  
  WEBSOCKET_RETRY: 5000      
} as const;


export const API_ENDPOINTS = {
  FRIENDS: '/users/friends',
  FRIEND_REQUESTS: '/users/friend-requests',
  SENT_REQUESTS: '/users/sent-requests',
  ONLINE_STATUS: '/users/online-status',
  USER_SEARCH: '/users/search'
} as const;


export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error occurred',
  AUTH_REQUIRED: 'Authentication required',
  WEBSOCKET_ERROR: 'WebSocket connection failed'
} as const;