import type { AIController, GameState, PlayerInput } from '../types.js';
import { GAME_CONFIG as CFG } from '../constants.js';

/**
 * IA d'exemple : suit bêtement la balle
 * 
 * ⚠️ CETTE IA EST VOLONTAIREMENT SIMPLE
 * C'est un exemple pour montrer l'interface
 */
export class DummyAI implements AIController {
  decide(gameState: GameState, side: 'left' | 'right'): PlayerInput {
    const { ball, paddles } = gameState;
    
    // Position du paddle en pixels
    const myPaddle = side === 'left' ? paddles.left : paddles.right;
    const paddleY = myPaddle.y * CFG.COURT_HEIGHT;
    
    // Zone morte pour éviter les micro-mouvements
    const deadZone = 20;
    
    if (ball.position.y > paddleY + deadZone) {
      return { up: false, down: true };  // Descendre
    } else if (ball.position.y < paddleY - deadZone) {
      return { up: true, down: false };  // Monter
    } else {
      return { up: false, down: false };  // Rester
    }
  }
}