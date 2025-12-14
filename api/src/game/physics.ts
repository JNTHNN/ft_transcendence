import type { Vec2, Ball, Paddle } from './types.js';
import { GAME_CONFIG as CFG } from './constants.js';

export function moveBall(ball: Ball, dt: number): Ball {
  return {
    ...ball,
    position: {
      x: ball.position.x + ball.velocity.x * dt,
      y: ball.position.y + ball.velocity.y * dt,
    },
  };
}

export function checkWallCollision(ball: Ball): Vec2 {
  const { y } = ball.position;
  const { radius } = ball;
  let { x: vx, y: vy } = ball.velocity;
  
  if (y - radius <= 0) {
    vy = Math.abs(vy);
  }
  else if (y + radius >= CFG.COURT_HEIGHT) {
    vy = -Math.abs(vy);
  }
  
  return { x: vx, y: vy };
}

export function checkPaddleCollision(
  ball: Ball,
  paddle: Paddle,
  side: 'left' | 'right'
): boolean {
  const { x, y } = ball.position;
  const { radius } = ball;
  
  const paddleX = side === 'left' 
    ? CFG.PADDLE_OFFSET 
    : CFG.COURT_WIDTH - CFG.PADDLE_OFFSET;
  
  const paddleY = paddle.y * CFG.COURT_HEIGHT;
  
  const paddleLeft = paddleX - CFG.PADDLE_WIDTH / 2;
  const paddleRight = paddleX + CFG.PADDLE_WIDTH / 2;
  const paddleTop = paddleY - paddle.height / 2;
  const paddleBottom = paddleY + paddle.height / 2;
  
  if (side === 'left') {
    if (ball.velocity.x >= 0) return false;
    if (x < paddleX) return false;
  } else {
    if (ball.velocity.x <= 0) return false;
    if (x > paddleX) return false;
  }
  
  return (
    x - radius <= paddleRight &&
    x + radius >= paddleLeft &&
    y >= paddleTop &&
    y <= paddleBottom
  );
}

export function reflectBall(ball: Ball, paddle: Paddle): Vec2 {
  const paddleY = paddle.y * CFG.COURT_HEIGHT;
  const relativeY = (ball.position.y - paddleY) / (paddle.height / 2);
  
  const angle = relativeY * (Math.PI / 3);
  
  const speed = Math.hypot(ball.velocity.x, ball.velocity.y);
  const direction = ball.velocity.x > 0 ? -1 : 1;
  
  return {
    x: direction * speed * Math.cos(angle),
    y: speed * Math.sin(angle),
  };
}

export function checkGoal(ball: Ball): 'left' | 'right' | null {
  if (ball.position.x < 0) return 'left';
  if (ball.position.x > CFG.COURT_WIDTH) return 'right';
  return null;
}

export function resetBall(): Ball {
  const angle = (Math.random() * Math.PI / 3) - Math.PI / 6;
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