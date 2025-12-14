import type { GameState, PlayerConfig, PlayerInput, Paddle, GameMode,  MatchResult } from './types.js';
import { GAME_CONFIG as CFG, DT } from './constants.js';
import * as Physics from './physics.js';
import { gameManager } from './GameManager.js';
import type Database from 'better-sqlite3';

export class PongGame {
  public readonly id: string;
  public readonly mode: GameMode;
  
  private state: GameState;
  private players: Map<string, PlayerConfig>;
  private inputs: Map<string, PlayerInput>;
  private gameLoop: NodeJS.Timeout | null = null;
  private isRunning = false;
  private startedAt: Date | null = null;
  private db: Database.Database | null = null;
  
  constructor(matchId: string, mode: GameMode, db?: Database.Database) {
    this.id = matchId;
    this.mode = mode;
    this.db = db || null;
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

  public addPlayer(config: PlayerConfig): boolean {
    if (this.players.size >= 2) {
      return false;
    }
    
    this.players.set(config.id, config);
    this.inputs.set(config.id, { up: false, down: false });
    
    console.log(` Player ${config.id} added to game ${this.id} (${this.players.size}/2)`);
    
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
    this.updateAIInputs();
    
    this.updatePaddles(dt);
    
    this.state.ball = Physics.moveBall(this.state.ball, dt);
    
    this.state.ball.velocity = Physics.checkWallCollision(this.state.ball);
    
    if (Physics.checkPaddleCollision(this.state.ball, this.state.paddles.left, 'left')) {
      this.state.ball.velocity = Physics.reflectBall(this.state.ball, this.state.paddles.left);
    }
    if (Physics.checkPaddleCollision(this.state.ball, this.state.paddles.right, 'right')) {
      this.state.ball.velocity = Physics.reflectBall(this.state.ball, this.state.paddles.right);
    }
    
    const goal = Physics.checkGoal(this.state.ball);
    if (goal) {
      this.handleGoal(goal);
    }
    
    this.state.timestamp = Date.now();
  }
  
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
  
  
  public setPlayerInput(playerId: string, input: Partial<PlayerInput>): void {
    const current = this.inputs.get(playerId);
    
    if (current) {
      this.inputs.set(playerId, { ...current, ...input });
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
    console.log(` Game end - Score: ${this.state.score.left}-${this.state.score.right}, Winner: ${winner}`);
    
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
          left: { 
            id: leftPlayer.id, 
            score: this.state.score.left,
            type: leftPlayer.controllerType === 'ai' ? 'ai' : 'human'
          },
          right: { 
            id: rightPlayer.id, 
            score: this.state.score.right,
            type: rightPlayer.controllerType === 'ai' ? 'ai' : 'human'
          },
        },
        winner,
        duration,
        startedAt: this.startedAt!,
        endedAt,
        finalScore: {
          left: this.state.score.left,
          right: this.state.score.right,
        },
      };
      
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
    }, 5000);
  }
  

  public getState(): GameState {
    const playerArray = Array.from(this.players.values());
    const leftPlayer = playerArray.find(p => p.side === 'left');
    const rightPlayer = playerArray.find(p => p.side === 'right');
    
    return {
      ...this.state,
      players: {
        left: leftPlayer ? {
          id: leftPlayer.id,
          name: leftPlayer.controllerType === 'ai' ? 'IA' : this.getPlayerName(leftPlayer.id),
          type: leftPlayer.controllerType === 'ai' ? 'ai' : 'human'
        } : undefined,
        right: rightPlayer ? {
          id: rightPlayer.id,
          name: rightPlayer.controllerType === 'ai' ? 'IA' : this.getPlayerName(rightPlayer.id),
          type: rightPlayer.controllerType === 'ai' ? 'ai' : 'human'
        } : undefined,
      }
    };
  }
  
  private getPlayerName(playerId: string): string {
    if (this.db && playerId.startsWith('user-')) {
      try {
        const userId = parseInt(playerId.replace('user-', ''));
        const stmt = this.db.prepare('SELECT display_name FROM users WHERE id = ?');
        const result = stmt.get(userId) as { display_name: string } | undefined;
        
        if (result?.display_name) {
          return result.display_name;
        }
      } catch (error) {
        console.warn(`Failed to get player name for ${playerId}:`, error);
      }
    }
    
    if (playerId.startsWith('user-')) {
      return `Joueur ${playerId.replace('user-', '')}`;
    }
    return playerId === 'player-1' ? 'Joueur 1' : 'Joueur 2';
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