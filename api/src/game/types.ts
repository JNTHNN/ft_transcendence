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

/**
 * Inputs possibles 
 */
export interface PlayerInput {
  up: boolean;
  down: boolean;
}

/**
 * Type de contrôleur pour un paddle
 */
export type ControllerType = 'human-arrows' | 'human-ws' | 'ai' | 'local-player2';

/**
 * Interface que l'IA doit implémenter
 * 
 * 📌 L'IMPLÉMENTEUR DE L'IA DOIT CRÉER UNE CLASSE QUI RESPECTE CETTE INTERFACE
 * 
 * Exemple d'implémentation :
 * 
 * ```typescript
 * import type { AIController, GameState } from './types.js';
 * 
 * export class MyPongAI implements AIController {
 *   decide(gameState: GameState, side: 'left' | 'right'): PlayerInput {
 *     // Votre logique ici
 *     return { up: false, down: true };
 *   }
 * }
 * ```
 */
export interface AIController {
  /**
   * Appelé 60 fois par seconde par le moteur
   * 
   * @param gameState - État complet du jeu
   * @param side - Quel côté l'IA contrôle ('left' ou 'right')
   * @returns Les inputs à appliquer (up/down)
   */
  decide(gameState: GameState, side: 'left' | 'right'): PlayerInput;
}

/**
 * Configuration d'un joueur dans la partie
 */
export interface PlayerConfig {
  id: string;
  side: 'left' | 'right';
  controllerType: ControllerType;
  aiController?: AIController;  // Obligatoire si controllerType === 'ai'
  socket?: any;                 // Obligatoire si controllerType === 'human-ws'
}

/**
 * Mode de jeu
 */
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
  duration: number; // en secondes
  startedAt: Date;
  endedAt: Date;
  finalScore: {
    left: number;
    right: number;
  };
}

