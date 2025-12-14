import { PongGame } from './PongGame.js';
import type { GameMode, PlayerConfig, MatchResult } from './types.js';
import { randomUUID } from 'crypto';
import type Database from 'better-sqlite3';

export class GameManager {
  private static instance: GameManager;
  
  private games: Map<string, PongGame>;
  
  private playerToGame: Map<string, string>;
  private matchHistory: MatchResult[] = [];
  private db: Database.Database | null = null;
  
  
  private constructor() {
    this.games = new Map();
    this.playerToGame = new Map();
  }
  

  public setDatabase(db: Database.Database): void {
    this.db = db;
  }
  

  public static getInstance(): GameManager {
    if (!GameManager.instance) {
      GameManager.instance = new GameManager();
    }
    return GameManager.instance;
  }
  
  
  public createGame(mode: GameMode, customId?: string): string {
    const matchId = customId || `match-${randomUUID()}`;
    
    if (this.games.has(matchId)) {
      throw new Error(`Game ${matchId} already exists`);
    }
    
    const game = new PongGame(matchId, mode, this.db || undefined);
    this.games.set(matchId, game);
    
    return matchId;
  }

  public addPlayerToGame(matchId: string, playerConfig: PlayerConfig): boolean {
    const game = this.games.get(matchId);
    
    if (!game) {
      throw new Error(`Game ${matchId} not found`);
    }
    
    const existingMatchId = this.playerToGame.get(playerConfig.id);
    if (existingMatchId && existingMatchId !== matchId) {
      const existingGame = this.games.get(existingMatchId);
      
      if (existingGame) {
        const state = existingGame.getState();
        if (state.status === 'finished') {
          console.log(` Cleaning up finished game ${existingMatchId} for player ${playerConfig.id}`);
          this.playerToGame.delete(playerConfig.id);
        } else {
          throw new Error(`Player ${playerConfig.id} is already in an active game`);
        }
      } else {
        console.log(` Cleaning up orphaned mapping for player ${playerConfig.id}`);
        this.playerToGame.delete(playerConfig.id);
      }
    }
    
    const added = game.addPlayer(playerConfig);
    
    if (added) {
      this.playerToGame.set(playerConfig.id, matchId);
    }
    
    return added;
  }

  public getGame(matchId: string): PongGame | undefined {
    return this.games.get(matchId);
  }

  public getGameByPlayer(playerId: string): PongGame | undefined {
    const matchId = this.playerToGame.get(playerId);
    if (!matchId) return undefined;
    return this.games.get(matchId);
  }
  

  public listGames(): Array<{ id: string; mode: GameMode; active: boolean }> {
    return Array.from(this.games.values()).map(game => ({
      id: game.id,
      mode: game.mode,
      active: game.isActive(),
    }));
  }
  
  public removeGame(matchId: string): void {
    const game = this.games.get(matchId);
    
    if (!game) {
      return;
    }
    
    game.stop();
    
    for (const [playerId, gameId] of this.playerToGame.entries()) {
      if (gameId === matchId) {
        this.playerToGame.delete(playerId);
      }
    }
    
    this.games.delete(matchId);
  }
  

  public cleanup(): void {
    const now = Date.now();
    
    for (const [matchId, game] of this.games.entries()) {
      const state = game.getState();
      const inactive = !game.isActive() && (now - state.timestamp > 60000);
      
      if (inactive) {
        this.removeGame(matchId);
      }
    }
  }
  

  public getStats(): {
    totalGames: number;
    activeGames: number;
    totalPlayers: number;
  } {
    const activeGames = Array.from(this.games.values()).filter(g => g.isActive()).length;
    
    return {
      totalGames: this.games.size,
      activeGames,
      totalPlayers: this.playerToGame.size,
    };
  }

  public saveMatchResult(result: MatchResult): void {
    this.matchHistory.push(result);
    
    if (this.db) {
      try {
        const stmt = this.db.prepare(`
          INSERT INTO match_history 
          (player1_id, player2_id, player1_score, player2_score, winner_id, match_type, duration)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        
        let player1Id: number | null = null;
        let player2Id: number | null = null;
        
        if (result.players.left.type === 'human' && result.players.left.id.startsWith('user-')) {
          const id = parseInt(result.players.left.id.replace('user-', ''));
          if (!isNaN(id)) player1Id = id;
        }
        
        if (result.players.right.type === 'human' && result.players.right.id.startsWith('user-')) {
          const id = parseInt(result.players.right.id.replace('user-', ''));
          if (!isNaN(id)) player2Id = id;
        }
        
        let winnerId = null;
        if (result.winner === 'left' && player1Id) winnerId = player1Id;
        if (result.winner === 'right' && player2Id) winnerId = player2Id;
        
        const matchType = result.mode === 'solo-vs-ai' ? 'solo' : 
                         result.mode === 'local-2p' ? 'local' :
                         result.mode === 'online-2p' ? 'online' :
                         result.mode === 'tournament' ? 'tournament' : 'solo';
        
        if (player1Id) {
          stmt.run(
            player1Id,
            player2Id,
            result.finalScore.left,
            result.finalScore.right,
            winnerId,
            matchType,
            result.duration
          );
        }
        
      } catch (error) {
        console.error('Failed to save match result to DB:', error);
      }
    }
  }
  

  public getMatchHistory(playerId?: string): MatchResult[] {
    if (playerId) {
      return this.matchHistory.filter(m => 
        m.players.left.id === playerId || m.players.right.id === playerId
      );
    }
    return this.matchHistory;
  }
  

  public getPlayerStats(playerId: string) {
    const matches = this.getMatchHistory(playerId);
    const wins = matches.filter(m => 
      (m.players.left.id === playerId && m.winner === 'left') ||
      (m.players.right.id === playerId && m.winner === 'right')
    ).length;
    
    return {
      totalGames: matches.length,
      wins,
      losses: matches.length - wins,
      winRate: matches.length > 0 ? (wins / matches.length) * 100 : 0,
    };
  }
}

export const gameManager = GameManager.getInstance();