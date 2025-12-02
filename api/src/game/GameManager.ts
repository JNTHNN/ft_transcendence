import { PongGame } from './PongGame.js';
import type { GameMode, PlayerConfig,  MatchResult } from './types.js';
import { randomUUID } from 'crypto';
import type Database from 'better-sqlite3';

/**
 * Gestionnaire central de toutes les parties
 * 
 * Pattern Singleton : une seule instance pour tout le serveur
 */
export class GameManager {
  private static instance: GameManager;
  
  // Map<matchId, PongGame>
  private games: Map<string, PongGame>;
  
  // Map<playerId, matchId> pour retrouver rapidement la partie d'un joueur
  private playerToGame: Map<string, string>;
  private matchHistory: MatchResult[] = [];
  private db: Database.Database | null = null;

  private constructor() {
    this.games = new Map();
    this.playerToGame = new Map();
  }

  /**
   * Injecter la base de données
   */
  public setDatabase(db: Database.Database): void {
    this.db = db;
  }

  /**
   * Obtenir l'instance unique (Singleton pattern)
   */
  public static getInstance(): GameManager {
    if (!GameManager.instance) {
      GameManager.instance = new GameManager();
    }
    return GameManager.instance;
  }

  /**
   * CrÃ©e une nouvelle partie
   * 
   * @param mode - Mode de jeu (solo-vs-ai, local-2p, online-2p)
   * @param customId - ID personnalisÃ© (optionnel)
   * @returns L'ID de la partie crÃ©Ã©e
   */
  public createGame(mode: GameMode, customId?: string): string {
    const matchId = customId || `match-${randomUUID()}`;
    
    if (this.games.has(matchId)) {
      throw new Error(`Game ${matchId} already exists`);
    }
    
    const game = new PongGame(matchId, mode);
    this.games.set(matchId, game);
    
    return matchId;
  }

  /**
   * Ajoute un joueur Ã  une partie
   * 
   * @param matchId - ID de la partie
   * @param playerConfig - Configuration du joueur
   * @returns true si ajoutÃ© avec succÃ¨s
   */
  public addPlayerToGame(matchId: string, playerConfig: PlayerConfig): boolean {
    const game = this.games.get(matchId);
    if (!game) {
      throw new Error(`Game ${matchId} not found`);
    }
    
    // VÃ©rifier que le joueur n'est pas dÃ©jÃ  dans une autre partie
    if (this.playerToGame.has(playerConfig.id)) {
      throw new Error(`Player ${playerConfig.id} is already in a game`);
    }
    
    const added = game.addPlayer(playerConfig);
    
    if (added) {
      this.playerToGame.set(playerConfig.id, matchId);
    }
    
    return added;
  }

  /**
   * RÃ©cupÃ¨re une partie par son ID
   */
  public getGame(matchId: string): PongGame | undefined {
    return this.games.get(matchId);
  }

  /**
   * Trouve la partie d'un joueur
   */
  public getGameByPlayer(playerId: string): PongGame | undefined {
    const matchId = this.playerToGame.get(playerId);
    if (!matchId) return undefined;
    return this.games.get(matchId);
  }

  /**
   * Liste toutes les parties actives
   */
  public listGames(): Array<{ id: string; mode: GameMode; active: boolean }> {
    return Array.from(this.games.values()).map(game => ({
      id: game.id,
      mode: game.mode,
      active: game.isActive(),
    }));
  }

  /**
   * Supprime une partie terminÃ©e
   */
  public removeGame(matchId: string): void {

    const game = this.games.get(matchId);
    if (!game) {
		return;
	}
    
    // ArrÃªter le jeu si encore actif
    game.stop();
    
    // Retirer tous les joueurs de cette partie
	// let removedPlayers = 0;
    for (const [playerId, gameId] of this.playerToGame.entries()) {
      if (gameId === matchId) {
        this.playerToGame.delete(playerId);
      }
    }
    
    // Supprimer la partie
    this.games.delete(matchId);
  }

  /**
   * Nettoie les parties inactives (utile pour Ã©viter les fuites mÃ©moire)
   */
  public cleanup(): void {
    const now = Date.now();
    
    for (const [matchId, game] of this.games.entries()) {
      const state = game.getState();
      const inactive = !game.isActive() && (now - state.timestamp > 60000); // 1 minute
      
      if (inactive) {
        this.removeGame(matchId);
      }
    }
  }

  /**
   * Statistiques
   */
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
    
    // Sauvegarder en base de données SQLite
    if (this.db) {
      try {
        const stmt = this.db.prepare(`
          INSERT INTO match_history 
          (player1_id, player2_id, player1_score, player2_score, winner_id, match_type, duration)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        
        const player1Id = result.players.left.type === 'human' ? parseInt(result.players.left.id.replace('user-', '')) : null;
        const player2Id = result.players.right.type === 'human' ? parseInt(result.players.right.id.replace('user-', '')) : null;
        
        let winnerId = null;
        if (result.winner === 'left' && player1Id) winnerId = player1Id;
        if (result.winner === 'right' && player2Id) winnerId = player2Id;
        
        const matchType = result.mode === 'solo-vs-ai' ? 'solo' : 
                         result.mode === 'local-2p' ? 'local' :
                         result.mode === 'online-2p' ? 'online' : 'solo';
        
        if (player1Id || player2Id) { // Au moins un joueur humain
          stmt.run(
            player1Id || 0, // 0 pour l'IA
            player2Id || 0,
            result.finalScore.left,
            result.finalScore.right,
            winnerId,
            matchType,
            result.duration
          );
        }
        
      } catch (error) {
      }
    }
  }

  // ðŸ†• RÃ©cupÃ©rer l'historique
  public getMatchHistory(playerId?: string): MatchResult[] {
    if (playerId) {
      return this.matchHistory.filter(m => 
        m.players.left.id === playerId || m.players.right.id === playerId
      );
    }
    return this.matchHistory;
  }

  // ðŸ†• Stats d'un joueur
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

/**
 * Export d'une instance unique (facilite l'import)
 */
export const gameManager = GameManager.getInstance();