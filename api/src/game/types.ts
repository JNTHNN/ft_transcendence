export interface Vec2 {
  x: number;
  y: number;
}

export interface Ball {
  position: Vec2;
  velocity: Vec2;
  radius: number;
}

export interface Paddle {
  y: number;      
  height: number;
  speed: number;   
}

export interface PlayerInput {
  up: boolean;
  down: boolean;
}

export type ControllerType = 'human-arrows' | 'human-ws' | 'ai' | 'local-player2';

export interface AIController {
  /** 
   * @param gameState 
   * @param side 
   * @returns 
   */
  decide(gameState: GameState, side: 'left' | 'right'): PlayerInput;
}

export interface PlayerConfig {
  id: string;                     
  side: 'left' | 'right';          
  controllerType: ControllerType;  
  aiController?: AIController;   
  socket?: any;                   
}

export type GameMode = 'solo-vs-ai' | 'local-2p' | 'online-2p' | 'tournament';

export interface GameState {
  matchId: string;
  mode: GameMode;
  status: 'waiting' | 'playing' | 'finished';
  
  ball: Ball;
  
  paddles: {
    left: Paddle;
    right: Paddle;
  };
  
  score: {
    left: number;
    right: number;
  };
  
  players?: {
    left?: { id: string; name: string; type: 'human' | 'ai' };
    right?: { id: string; name: string; type: 'human' | 'ai' };
  };
  
  timestamp: number;
}


export interface GameConfig {
  courtWidth: number;
  courtHeight: number;
  maxScore: number;
  ballSpeed: number;
  paddleSpeed: number;
}

export interface MatchResult {
  matchId: string;
  mode: GameMode;
  
  players: {
    left: { id: string; score: number; type: 'human' | 'ai' };
    right: { id: string; score: number; type: 'human' | 'ai' };
  };
  
  winner: 'left' | 'right';
  duration: number; 
  
  startedAt: Date;
  endedAt: Date;
  
  finalScore: {
    left: number;
    right: number;
  };
}