import type { GameState, PlayerConfig, PlayerInput, Paddle, GameMode,  MatchResult } from './types.js';
import { GAME_CONFIG as CFG, DT } from './constants.js';
import * as Physics from './physics.js';
import { gameManager } from './GameManager.js';

export class PongGame {
  public readonly id: string;
  public readonly mode: GameMode;
  
  private state: GameState;
  private players: Map<string, PlayerConfig>;
  private inputs: Map<string, PlayerInput>;
  private gameLoop: NodeJS.Timeout | null = null;
  private isRunning = false;
  private startedAt: Date | null = null;

  constructor(matchId: string, mode: GameMode) {
    this.id = matchId;
    this.mode = mode;
    this.players = new Map();
    this.inputs = new Map();
    
	this.state = {
	matchId,
	mode,
	status: 'waiting',
	ball: Physics.resetBall(),
	paddles: {
		left: this.createPaddle(),
		right: this.createPaddle(),
	},
	score: { left: 0, right: 0 },
	timestamp: Date.now(),
};
  }

  /**
   * Ajoute un joueur/IA Ã  la partie
   */
  public addPlayer(config: PlayerConfig): boolean {
    if (this.players.size >= 2) {
		console.warn(`âš ï¸ Game ${this.id} already has 2 players`);
		return false;
	}
    
    this.players.set(config.id, config);
    this.inputs.set(config.id, { up: false, down: false });
    
    // DÃ©marre si on a 2 joueurs
    if (this.players.size === 2 && !this.isRunning) {
		console.log(`ðŸš€ Starting game ${this.id} with 2 players`);
      this.start();
    }
    
    return true;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.startedAt = new Date();
	this.state.status = 'playing';

    this.gameLoop = setInterval(() => {
      this.update(DT);
      this.broadcastState();
    }, 1000 / CFG.TICK_RATE);
  }

  private update(dt: number): void {
    // 1. Mettre Ã  jour les inputs IA
    this.updateAIInputs();
    
    // 2. Update paddles
    this.updatePaddles(dt);
    
    // 3. Update balle
    this.state.ball = Physics.moveBall(this.state.ball, dt);
    
    // 4. Check collisions murs
    this.state.ball.velocity = Physics.checkWallCollision(this.state.ball);
    
    // 5. Check collisions paddles
    if (Physics.checkPaddleCollision(this.state.ball, this.state.paddles.left, 'left')) {
      this.state.ball.velocity = Physics.reflectBall(this.state.ball, this.state.paddles.left);
    }
    if (Physics.checkPaddleCollision(this.state.ball, this.state.paddles.right, 'right')) {
      this.state.ball.velocity = Physics.reflectBall(this.state.ball, this.state.paddles.right);
    }
    
    // 6. Check goal
    const goal = Physics.checkGoal(this.state.ball);
    if (goal) {
      this.handleGoal(goal);
    }
    
    this.state.timestamp = Date.now();
  }

  /**
   * ðŸ¤– Appelle les IA pour obtenir leurs inputs
   */
  private updateAIInputs(): void {
    for (const [playerId, player] of this.players) {
      if (player.controllerType === 'ai' && player.aiController) {
        const input = player.aiController.decide(this.state, player.side);
        this.inputs.set(playerId, input);
      }
    }
  }

  private updatePaddles(dt: number): void {
    for (const [playerId, player] of this.players) {
      const input = this.inputs.get(playerId)!;
      const paddle = player.side === 'left' 
        ? this.state.paddles.left 
        : this.state.paddles.right;
      
	  console.log(`ðŸŽ¯ Update paddle ${player.side} for ${playerId}:`, { input, paddleY: paddle.y });
	  
      if (input.up) {
        paddle.y = Math.max(0, paddle.y - (paddle.speed * dt) / CFG.COURT_HEIGHT);
      }
      if (input.down) {
        paddle.y = Math.min(1, paddle.y + (paddle.speed * dt) / CFG.COURT_HEIGHT);
      }
    }
  }

  private handleGoal(winner: 'left' | 'right'): void {
    if (winner === 'left') {
      this.state.score.right++;
    } else {
      this.state.score.left++;
    }
    
    this.state.ball = Physics.resetBall();
    
    if (this.state.score.left >= CFG.MAX_SCORE || this.state.score.right >= CFG.MAX_SCORE) {
      this.end();
    }
  }

  private broadcastState(): void {
    const message = JSON.stringify({
      type: 'game/state',
      data: this.state,
    });
    
    for (const player of this.players.values()) {
      if (player.socket) {
        player.socket.send(message);
      }
    }
  }

  /**
   * Met Ã  jour les inputs d'un joueur humain
   * (appelÃ© depuis WebSocket ou clavier local)
   */
  public setPlayerInput(playerId: string, input: Partial<PlayerInput>): void {
    const current = this.inputs.get(playerId);
    if (current) {
      this.inputs.set(playerId, { ...current, ...input });
	  console.log(`ðŸŽ® Input set for ${playerId}:`, { ...current, ...input }); 
	  } else {
    	console.warn(`âš ï¸ Player ${playerId} not found in game ${this.id}`);
    }
  }

  public stop(): void {
    if (this.gameLoop) {
      clearInterval(this.gameLoop);
      this.gameLoop = null;
    }
    this.isRunning = false;
  }

  private end(): void {
    this.stop();
    
	this.state.status = 'finished';
	
    const winner = this.state.score.left > this.state.score.right ? 'left' : 'right';
	const endedAt = new Date();
    const duration = this.startedAt 
      ? (endedAt.getTime() - this.startedAt.getTime()) / 1000 
      : 0;
	const playerIds = Array.from(this.players.values());
    const leftPlayer = playerIds.find(p => p.side === 'left');
    const rightPlayer = playerIds.find(p => p.side === 'right');
    
    if (leftPlayer && rightPlayer) {
      const result: MatchResult = {
        matchId: this.id,
        mode: this.mode,
        players: {
          left: { id: leftPlayer.id, score: this.state.score.left },
          right: { id: rightPlayer.id, score: this.state.score.right },
        },
        winner,
        duration,
        startedAt: this.startedAt!,
        endedAt,
      };
      
      // ðŸ†• Sauvegarder
      gameManager.saveMatchResult(result);
    }

    const message = JSON.stringify({
      type: 'game/end',
      data: { winner, score: this.state.score },
    });
    
    for (const player of this.players.values()) {
      if (player.socket) {
        player.socket.send(message);
      }
    }

	setTimeout(() => {
      gameManager.removeGame(this.id);
      console.log(`ðŸ§¹ Game ${this.id} auto-cleaned after end`);
  	}, 5000); // 5 secondes pour laisser le temps d'afficher le rÃ©sultat

  }

  public getState(): GameState {
    return this.state;
  }

  public isActive(): boolean {
    return this.isRunning;
  }

  private createPaddle(): Paddle {
    return {
      y: 0.5,
      height: CFG.PADDLE_HEIGHT,
      speed: CFG.PADDLE_SPEED,
    };
  }
}