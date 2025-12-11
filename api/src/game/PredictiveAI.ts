import type { AIController, GameState, PlayerInput } from './types.js';
import { GAME_CONFIG as CFG } from './constants.js';

/**
 * IA prédictive pour Pong
 * 
 * STRATÉGIE :
 * - Échantillonne la position de la balle 1x par seconde
 * - Calcule la trajectoire linéaire entre 2 échantillons
 * - Prédit le point d'impact sur le mur du paddle
 * - Gère les rebonds sur murs haut/bas
 * - Déplace le paddle vers le point prédit
 * 
 * LIMITATION :
 * - Ne réagit qu'1x par seconde (simule un humain)
 * - Pas de prédiction en temps réel (plus réaliste)
 */
export class PredictiveAI implements AIController {
  
  private prevBallSample: { x: number; y: number } | null = null;
  private lastBallSample: { x: number; y: number } | null = null;
  private lastSampleTime = 0; // in ms
  
  decide(gameState: GameState, side: 'left' | 'right'): PlayerInput {
    const { ball, paddles } = gameState;
    const now = performance.now(); // current time in ms
    
    const currentBall = {
      x: ball.position.x,
      y: ball.position.y
    };
    
    if (now - this.lastSampleTime >= 1000) {
      this.prevBallSample = this.lastBallSample;
      this.lastBallSample = currentBall;
      this.lastSampleTime = now;
    }
    
    // If we don't have two samples yet, do nothing
    if (!this.prevBallSample || !this.lastBallSample) {
      return { up: false, down: false };
    }
    
    
    // ─────────────────────────────────────────────────────────────
    // PREDICT IMPACT POINT
    // ─────────────────────────────────────────────────────────────
    
    const aiX = side === 'left' ? 0 : CFG.COURT_WIDTH;
    const predictedY = this.predictBallLanding(
      this.prevBallSample,
      this.lastBallSample,
      aiX
    );
    
    // ─────────────────────────────────────────────────────────────
    // MOVE PADDLE TOWARD PREDICTED Y
    // ─────────────────────────────────────────────────────────────
    
    const myPaddle = side === 'left' ? paddles.left : paddles.right;
    const paddleY = myPaddle.y * CFG.COURT_HEIGHT;
    const deadZone = 12; // Tolérance en pixels
    
    if (predictedY > paddleY + deadZone) {
      return { up: false, down: true };
    }
    
    if (predictedY < paddleY - deadZone) {
      return { up: true, down: false };
    }
    
    // Paddle bien positionné, ne rien faire
    return { up: false, down: false };
  }
  
  // ═══════════════════════════════════════════════════════════════
  // Prédiction de trajectoire avec gestion des rebonds
  // ═══════════════════════════════════════════════════════════════
  
  private predictBallLanding(
    first: { x: number; y: number },
    second: { x: number; y: number },
    aiX: number
  ): number {
    
    // ─────────────────────────────────────────────────────────────
    // Calcul de la pente (slope) de la trajectoire
    // ─────────────────────────────────────────────────────────────
    
    const dx = second.x - first.x;
    const dy = second.y - first.y;
    
    // Si la balle ne bouge pas horizontalement, retourner Y actuel
    if (dx === 0) return second.y;
    
    const slope = dy / dx;
    
    
    // ─────────────────────────────────────────────────────────────
    // Prédiction linéaire : y = y0 + slope * (x - x0)
    // ─────────────────────────────────────────────────────────────
    
    let predictedY = second.y + slope * (aiX - second.x);
    
    
    // ─────────────────────────────────────────────────────────────
    // Gestion des rebonds sur murs haut/bas
    // (Réflexion en miroir)
    // ─────────────────────────────────────────────────────────────
    
    const tableHeight = CFG.COURT_HEIGHT;
    
    while (predictedY < 0 || predictedY > tableHeight) {
      if (predictedY < 0) {
        predictedY = -predictedY; // Rebond haut
      }
      if (predictedY > tableHeight) {
        predictedY = 2 * tableHeight - predictedY; // Rebond bas
      }
    }
    
    return predictedY;
  }
}