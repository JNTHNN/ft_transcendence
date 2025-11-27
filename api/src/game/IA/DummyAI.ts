import type { AIController, GameState, PlayerInput } from '../types.js';
import { GAME_CONFIG as CFG } from '../constants.js';

/**
 * IA d'exemple : suit bêtement la balle
 * 
 * ⚠️ CETTE IA EST VOLONTAIREMENT SIMPLE
 * C'est un exemple pour montrer l'interface
 */
// export class DummyAI implements AIController {
//   decide(gameState: GameState, side: 'left' | 'right'): PlayerInput {
//     const { ball, paddles } = gameState;
    
//     // Position du paddle en pixels
//     const myPaddle = side === 'left' ? paddles.left : paddles.right;
//     const paddleY = myPaddle.y * CFG.COURT_HEIGHT;
    
//     // Zone morte pour éviter les micro-mouvements
//     const deadZone = 20;
    
//     if (ball.position.y > paddleY + deadZone) {
//       return { up: false, down: true };  // Descendre
//     } else if (ball.position.y < paddleY - deadZone) {
//       return { up: true, down: false };  // Monter
//     } else {
//       return { up: false, down: false };  // Rester
//     }
//   }
// }

export class PredictiveAI implements AIController {
  private prevBallSample: { x: number, y: number } | null = null;
  private lastBallSample: { x: number, y: number } | null = null;
  private lastSampleTime = 0; // in ms
  decide(gameState: GameState, side: 'left' | 'right'): PlayerInput {
    const { ball, paddles } = gameState;
    const now = performance.now(); // current time in ms
    const currentBall = {
      x: ball.position.x,
      y: ball.position.y
    };
    // --- SAMPLE THE BALL POSITION ONCE PER SECOND ---
    if (now - this.lastSampleTime >= 1000) {
      this.prevBallSample = this.lastBallSample;
      this.lastBallSample = currentBall;
      this.lastSampleTime = now;
    }
    // If we don't have two samples yet, do nothing
    if (!this.prevBallSample || !this.lastBallSample) {
      return { up: false, down: false };
    }
    // --- Predict impact point ---
    const aiX = side === 'left' ? 0 : CFG.COURT_WIDTH;
    const predictedY = this.predictBallLanding(
      this.prevBallSample,
      this.lastBallSample,
      aiX
    );
    // --- Move paddle toward predicted Y ---
    const myPaddle = side === 'left' ? paddles.left : paddles.right;
    const paddleY = myPaddle.y * CFG.COURT_HEIGHT;
    const deadZone = 12;
    if (predictedY > paddleY + deadZone) {
      return { up: false, down: true };
    }
    if (predictedY < paddleY - deadZone) {
      return { up: true, down: false };
    }
    return { up: false, down: false };
  }
  // prediction function (same as before)
  private predictBallLanding(first: { x: number, y: number },
                             second: { x: number, y: number },
                             aiX: number): number
  {
    const dx = second.x - first.x;
    const dy = second.y - first.y;
    if (dx === 0) return second.y;
    const slope = dy / dx;
    let predictedY = second.y + slope * (aiX - second.x);
    const tableHeight = CFG.COURT_HEIGHT;
    while (predictedY < 0 || predictedY > tableHeight) {
      if (predictedY < 0) predictedY = -predictedY;
      if (predictedY > tableHeight) predictedY = 2 * tableHeight - predictedY;
    }
    return predictedY;
  }
}
