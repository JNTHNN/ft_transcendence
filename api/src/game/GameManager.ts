import { PongGame } from './PongGame.js';
import type { GameMode, PlayerConfig, MatchResult } from './types.js';
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
  
  
  // ═══════════════════════════════════════════════════════════════
  // Injecter la base de données
  // ═══════════════════════════════════════════════════════════════
  
  public setDatabase(db: Database.Database): void {
    this.db = db;
  }
  
  
  // ═══════════════════════════════════════════════════════════════
  // Obtenir l'instance unique (Singleton pattern)
  // ═══════════════════════════════════════════════════════════════
  
  public static getInstance(): GameManager {
    if (!GameManager.instance) {
      GameManager.instance = new GameManager();
    }
    return GameManager.instance;
  }
  
  
  // ═══════════════════════════════════════════════════════════════
  // Crée une nouvelle partie
  // ═══════════════════════════════════════════════════════════════
  
  public createGame(mode: GameMode, customId?: string): string {
    const matchId = customId || `match-${randomUUID()}`;
    
    if (this.games.has(matchId)) {
      throw new Error(`Game ${matchId} already exists`);
    }
    
    const game = new PongGame(matchId, mode, this.db || undefined);
    this.games.set(matchId, game);
    
    return matchId;
  }
  
  
  // ═══════════════════════════════════════════════════════════════
  // Ajoute un joueur à une partie
  // ═══════════════════════════════════════════════════════════════
  
  public addPlayerToGame(matchId: string, playerConfig: PlayerConfig): boolean {
    const game = this.games.get(matchId);
    
    if (!game) {
      throw new Error(`Game ${matchId} not found`);
    }
    
    // Vérifier que le joueur n'est pas déjà dans une autre partie active
    const existingMatchId = this.playerToGame.get(playerConfig.id);
    if (existingMatchId && existingMatchId !== matchId) {
      const existingGame = this.games.get(existingMatchId);
      
      // Si l'ancienne partie existe et est terminée, nettoyer le mapping
      if (existingGame) {
        const state = existingGame.getState();
        if (state.status === 'finished') {
          console.log(`🧹 Cleaning up finished game ${existingMatchId} for player ${playerConfig.id}`);
          this.playerToGame.delete(playerConfig.id);
        } else {
          throw new Error(`Player ${playerConfig.id} is already in an active game`);
        }
      } else {
        // L'ancienne partie n'existe plus, nettoyer le mapping orphelin
        console.log(`🧹 Cleaning up orphaned mapping for player ${playerConfig.id}`);
        this.playerToGame.delete(playerConfig.id);
      }
    }
    
    const added = game.addPlayer(playerConfig);
    
    if (added) {
      this.playerToGame.set(playerConfig.id, matchId);
    }
    
    return added;
  }
  
  
  // ═══════════════════════════════════════════════════════════════
  // Récupère une partie par son ID
  // ═══════════════════════════════════════════════════════════════
  
  public getGame(matchId: string): PongGame | undefined {
    return this.games.get(matchId);
  }
  
  
  // ═══════════════════════════════════════════════════════════════
  // Trouve la partie d'un joueur
  // ═══════════════════════════════════════════════════════════════
  
  public getGameByPlayer(playerId: string): PongGame | undefined {
    const matchId = this.playerToGame.get(playerId);
    if (!matchId) return undefined;
    return this.games.get(matchId);
  }
  
  
  // ═══════════════════════════════════════════════════════════════
  // Liste toutes les parties actives
  // ═══════════════════════════════════════════════════════════════
  
  public listGames(): Array<{ id: string; mode: GameMode; active: boolean }> {
    return Array.from(this.games.values()).map(game => ({
      id: game.id,
      mode: game.mode,
      active: game.isActive(),
    }));
  }
  
  
  // ═══════════════════════════════════════════════════════════════
  // Supprime une partie terminée
  // ═══════════════════════════════════════════════════════════════
  
  public removeGame(matchId: string): void {
    const game = this.games.get(matchId);
    
    if (!game) {
      return;
    }
    
    // Arrêter le jeu si encore actif
    game.stop();
    
    // Retirer tous les joueurs de cette partie
    for (const [playerId, gameId] of this.playerToGame.entries()) {
      if (gameId === matchId) {
        this.playerToGame.delete(playerId);
      }
    }
    
    // Supprimer la partie
    this.games.delete(matchId);
  }
  
  
  // ═══════════════════════════════════════════════════════════════
  // Nettoie les parties inactives (évite fuites mémoire)
  // ═══════════════════════════════════════════════════════════════
  
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
  
  
  // ═══════════════════════════════════════════════════════════════
  // Statistiques globales
  // ═══════════════════════════════════════════════════════════════
  
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
  
  
  // ═══════════════════════════════════════════════════════════════
  // Sauvegarde un résultat de match
  // ═══════════════════════════════════════════════════════════════
  
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
        
        // Extraire les IDs utilisateurs
        let player1Id: number | null = null;
        let player2Id: number | null = null;
        
        // Player 1 (gauche)
        if (result.players.left.type === 'human' && result.players.left.id.startsWith('user-')) {
          const id = parseInt(result.players.left.id.replace('user-', ''));
          if (!isNaN(id)) player1Id = id;
        }
        
        // Player 2 (droite)
        if (result.players.right.type === 'human' && result.players.right.id.startsWith('user-')) {
          const id = parseInt(result.players.right.id.replace('user-', ''));
          if (!isNaN(id)) player2Id = id;
        }
        // Si c'est l'IA, player2Id reste null
        
        let winnerId = null;
        if (result.winner === 'left' && player1Id) winnerId = player1Id;
        if (result.winner === 'right' && player2Id) winnerId = player2Id;
        
        const matchType = result.mode === 'solo-vs-ai' ? 'solo' : 
                         result.mode === 'local-2p' ? 'local' :
                         result.mode === 'online-2p' ? 'online' :
                         result.mode === 'tournament' ? 'tournament' : 'solo';
        
        if (player1Id) { // Au moins le joueur 1 doit être humain
          stmt.run(
            player1Id,
            player2Id, // peut être null pour l'IA
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
  
  
  // ═══════════════════════════════════════════════════════════════
  // Récupère l'historique des matchs
  // ═══════════════════════════════════════════════════════════════
  
  public getMatchHistory(playerId?: string): MatchResult[] {
    if (playerId) {
      return this.matchHistory.filter(m => 
        m.players.left.id === playerId || m.players.right.id === playerId
      );
    }
    return this.matchHistory;
  }
  
  
  // ═══════════════════════════════════════════════════════════════
  // Stats d'un joueur
  // ═══════════════════════════════════════════════════════════════
  
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