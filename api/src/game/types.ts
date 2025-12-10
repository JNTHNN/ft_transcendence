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
  y: number;        // Position normalisée (0-1)
  height: number;   // Hauteur en pixels
  speed: number;    // Vitesse en pixels/seconde
}

export interface PlayerInput {
  up: boolean;
  down: boolean;
}

/**
 * Type de contrôleur pour un paddle
 * 
 * - human-arrows : Joueur local (W/S ou flèches)
 * - human-ws     : Joueur distant via WebSocket
 * - ai           : Intelligence artificielle
 * - local-player2: Deuxième joueur local (flèches)
 */
export type ControllerType = 'human-arrows' | 'human-ws' | 'ai' | 'local-player2';

/**
 * Interface que l'IA doit implémenter
 * 
 * 📌 PATTERN : Strategy Pattern (Design Pattern)
 * 
 * L'implémenteur de l'IA doit créer une classe qui respecte cette interface.
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
   * Appelé 60 fois par seconde par le moteur de jeu
   * 
   * @param gameState - État complet du jeu (lecture seule)
   * @param side - Quel côté l'IA contrôle ('left' ou 'right')
   * @returns Les inputs à appliquer (up/down)
   */
  decide(gameState: GameState, side: 'left' | 'right'): PlayerInput;
}

/**
 * Configuration d'un joueur dans la partie
 */
export interface PlayerConfig {
  id: string;                       // Identifiant unique
  side: 'left' | 'right';           // Côté du terrain
  controllerType: ControllerType;   // Type de contrôle
  aiController?: AIController;      // Obligatoire si controllerType === 'ai'
  socket?: any;                     // Obligatoire si controllerType === 'human-ws'
}


/**
 * Mode de jeu disponibles
 */
export type GameMode = 'solo-vs-ai' | 'local-2p' | 'online-2p' | 'tournament';

/**
 * État complet d'une partie en cours
 * (Envoyé 60x par seconde aux clients via WebSocket)
 */
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
  
  timestamp: number; // Date.now()
}


export interface GameConfig {
  courtWidth: number;
  courtHeight: number;
  maxScore: number;
  ballSpeed: number;
  paddleSpeed: number;
}

/**
 * Résultat d'un match terminé
 * (Sauvegardé en DB et en mémoire)
 */
export interface MatchResult {
  matchId: string;
  mode: GameMode;
  
  players: {
    left: { id: string; score: number; type: 'human' | 'ai' };
    right: { id: string; score: number; type: 'human' | 'ai' };
  };
  
  winner: 'left' | 'right';
  duration: number;        // en secondes
  
  startedAt: Date;
  endedAt: Date;
  
  finalScore: {
    left: number;
    right: number;
  };
}