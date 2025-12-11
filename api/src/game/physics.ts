import type { Vec2, Ball, Paddle } from './types.js';
import { GAME_CONFIG as CFG } from './constants.js';

/**
 * Déplace la balle selon sa vélocité (ligne droite simple)
 * (Comme en C++ : position += velocity * dt)
 */
export function moveBall(ball: Ball, dt: number): Ball {
  return {
    ...ball,
    position: {
      x: ball.position.x + ball.velocity.x * dt,
      y: ball.position.y + ball.velocity.y * dt,
    },
  };
}

/**
 * Vérifie collision balle/murs haut et bas
 * Retourne la vélocité modifiée si collision
 */
export function checkWallCollision(ball: Ball): Vec2 {
  const { y } = ball.position;
  const { radius } = ball;
  let { x: vx, y: vy } = ball.velocity;
  
  // Mur du haut
  if (y - radius <= 0) {
    vy = Math.abs(vy);  // Force vers le bas
  }
  // Mur du bas
  else if (y + radius >= CFG.COURT_HEIGHT) {
    vy = -Math.abs(vy);  // Force vers le haut
  }
  
  return { x: vx, y: vy };
}

/**
 * Vérifie collision balle/paddle
 * Retourne true si collision détectée
 */
export function checkPaddleCollision(
  ball: Ball,
  paddle: Paddle,
  side: 'left' | 'right'
): boolean {
  const { x, y } = ball.position;
  const { radius } = ball;
  
  // Position X du paddle selon le côté
  const paddleX = side === 'left' 
    ? CFG.PADDLE_OFFSET 
    : CFG.COURT_WIDTH - CFG.PADDLE_OFFSET;
  
  // Convertir la position normalisée (0-1) en pixels
  const paddleY = paddle.y * CFG.COURT_HEIGHT;
  
  // Bounding box du paddle
  const paddleLeft = paddleX - CFG.PADDLE_WIDTH / 2;
  const paddleRight = paddleX + CFG.PADDLE_WIDTH / 2;
  const paddleTop = paddleY - paddle.height / 2;
  const paddleBottom = paddleY + paddle.height / 2;
  
  if (side === 'left') {
    // Paddle gauche : balle doit venir de la DROITE (vx < 0)
    if (ball.velocity.x >= 0) return false;
    if (x < paddleX) return false;
  } else {
    // Paddle droit : balle doit venir de la GAUCHE (vx > 0)
    if (ball.velocity.x <= 0) return false;
    if (x > paddleX) return false;
  }
  
  // Vérifier si la balle touche le paddle
  return (
    x - radius <= paddleRight &&
    x + radius >= paddleLeft &&
    y >= paddleTop &&
    y <= paddleBottom
  );
}

/**
 * Calcule la nouvelle vélocité après rebond sur paddle (rebond simple)
 * L'angle dépend de où la balle touche (effet)
 */
export function reflectBall(ball: Ball, paddle: Paddle): Vec2 {
  // Position relative sur le paddle (-1 à +1)
  const paddleY = paddle.y * CFG.COURT_HEIGHT;
  const relativeY = (ball.position.y - paddleY) / (paddle.height / 2);
  
  // Angle de rebond (max ±60°)
  const angle = relativeY * (Math.PI / 3);  // 60° en radians
  
  // Nouvelle vélocité (conserve la vitesse, change l'angle)
  const speed = Math.hypot(ball.velocity.x, ball.velocity.y);
  const direction = ball.velocity.x > 0 ? -1 : 1;  // Inverse direction X
  
  return {
    x: direction * speed * Math.cos(angle),
    y: speed * Math.sin(angle),
  };
}

/**
 * Vérifie si la balle est sortie du terrain (point marqué)
 * Retourne 'left', 'right', ou null
 */
export function checkGoal(ball: Ball): 'left' | 'right' | null {
  if (ball.position.x < 0) return 'left';  // Gauche a perdu
  if (ball.position.x > CFG.COURT_WIDTH) return 'right';  // Droite a perdu
  return null;
}

/**
 * Réinitialise la balle au centre (après un point)
 * Direction aléatoire
 */
export function resetBall(): Ball {
  const angle = (Math.random() * Math.PI / 3) - Math.PI / 6;  // ±30°
  const direction = Math.random() > 0.5 ? 1 : -1;
  
  return {
    position: {
      x: CFG.COURT_WIDTH / 2,
      y: CFG.COURT_HEIGHT / 2,
    },
    velocity: {
      x: direction * CFG.BALL_SPEED * Math.cos(angle),
      y: CFG.BALL_SPEED * Math.sin(angle),
    },
    radius: CFG.BALL_RADIUS,
  };
}