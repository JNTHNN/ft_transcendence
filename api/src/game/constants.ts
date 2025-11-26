export const GAME_CONFIG = {
  // Dimensions du terrain (pixels virtuels)
  COURT_WIDTH: 800,
  COURT_HEIGHT: 600,
  
  // Balle
  BALL_RADIUS: 8,
  BALL_SPEED: 300,  // pixels/seconde
  
  // Paddles
  PADDLE_WIDTH: 10,
  PADDLE_HEIGHT: 80,
  PADDLE_SPEED: 400,  // pixels/seconde
  PADDLE_OFFSET: 20,  // Distance du bord
  
  // Jeu
  MAX_SCORE: 5,
  TICK_RATE: 60,  // FPS du serveur
  
  // WebSocket
  WS_UPDATE_RATE: 60,  // Envois/seconde aux clients
} as const;

// Delta time pour la physique (fixe à 60 FPS)
export const DT = 1 / GAME_CONFIG.TICK_RATE;