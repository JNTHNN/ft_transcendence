import db from '../db/db.js';
import { blockchainService } from './blockchain.js';
import { randomUUID } from 'crypto';

export interface Tournament {
  id: string;
  name: string;
  description?: string;
  max_players: number;
  current_players: number;
  status: 'waiting' | 'active' | 'completed' | 'cancelled';
  tournament_type: 'elimination' | 'round_robin';
  creator_id: number;
  winner_id?: number;
  start_time?: string;
  end_time?: string;
  blockchain_tx_hash?: string;
  blockchain_tournament_id?: string;
  blockchain_stored: boolean;
  created_at: string;
  updated_at: string;
}

export interface TournamentParticipant {
  id: number;
  tournament_id: string;
  user_id: number;
  display_name: string;
  seed?: number;
  eliminated_at?: string;
  created_at: string;
}

export interface TournamentMatch {
  id: number;
  tournament_id: string;
  match_id: string;
  round_number: number;
  match_order: number;
  player1_id?: number;
  player2_id?: number;
  player1_score: number;
  player2_score: number;
  winner_id?: number;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  start_time?: string;
  end_time?: string;
  created_at: string;
}

export class TournamentService {
  /**
   * Create a new tournament
   */
  static createTournament(params: {
    name: string;
    description?: string;
    max_players?: number;
    tournament_type?: 'elimination' | 'round_robin';
    creator_id: number;
  }): Tournament {
    const tournamentId = randomUUID();
    const now = new Date().toISOString();

    const tournament = {
      id: tournamentId,
      name: params.name,
      description: params.description || '',
      max_players: params.max_players || 8,
      current_players: 0,
      status: 'waiting' as const,
      tournament_type: params.tournament_type || 'elimination' as const,
      creator_id: params.creator_id,
      winner_id: undefined,
      start_time: null,
      end_time: null,
      blockchain_tx_hash: null,
      blockchain_tournament_id: null,
      blockchain_stored: 0,
      created_at: now,
      updated_at: now
    };

    const stmt = db.prepare(`
      INSERT INTO tournaments (
        id, name, description, max_players, current_players, status, 
        tournament_type, creator_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      tournament.id,
      tournament.name,
      tournament.description,
      tournament.max_players,
      tournament.current_players,
      tournament.status,
      tournament.tournament_type,
      tournament.creator_id,
      tournament.created_at,
      tournament.updated_at
    );

    return {
      ...tournament,
      start_time: tournament.start_time || undefined,
      end_time: tournament.end_time || undefined,
      blockchain_tx_hash: tournament.blockchain_tx_hash || undefined,
      blockchain_tournament_id: tournament.blockchain_tournament_id || undefined,
      blockchain_stored: false
    } as Tournament;
  }

  /**
   * Join a tournament
   */
  static joinTournament(tournamentId: string, userId: number, displayName: string): boolean {
    const tournament = this.getTournament(tournamentId);
    if (!tournament) {
      throw new Error('Tournament not found');
    }

    if (tournament.status !== 'waiting') {
      throw new Error('Tournament is not accepting new players');
    }

    if (tournament.current_players >= tournament.max_players) {
      throw new Error('Tournament is full');
    }

    // Check if already joined
    const existing = db.prepare(
      'SELECT id FROM tournament_participants WHERE tournament_id = ? AND user_id = ?'
    ).get(tournamentId, userId);

    if (existing) {
      throw new Error('Already joined this tournament');
    }

    // Add participant
    const stmt = db.prepare(`
      INSERT INTO tournament_participants (tournament_id, user_id, display_name, created_at)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(tournamentId, userId, displayName, new Date().toISOString());

    // Update player count
    db.prepare('UPDATE tournaments SET current_players = current_players + 1, updated_at = ? WHERE id = ?')
      .run(new Date().toISOString(), tournamentId);

    return true;
  }

  /**
   * Get tournament by ID
   */
  static getTournament(id: string): Tournament | null {
    const stmt = db.prepare('SELECT * FROM tournaments WHERE id = ?');
    const result = stmt.get(id) as any;
    
    if (!result) return null;

    return {
      ...result,
      blockchain_stored: Boolean(result.blockchain_stored)
    };
  }

  /**
   * Get all tournaments with filters
   */
  static getTournaments(filters: {
    status?: string;
    creator_id?: number;
    limit?: number;
    offset?: number;
  } = {}): Tournament[] {
    let query = 'SELECT * FROM tournaments';
    const params: any[] = [];
    const conditions: string[] = [];

    if (filters.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }

    if (filters.creator_id) {
      conditions.push('creator_id = ?');
      params.push(filters.creator_id);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
      
      if (filters.offset) {
        query += ' OFFSET ?';
        params.push(filters.offset);
      }
    }

    const stmt = db.prepare(query);
    const results = stmt.all(...params) as any[];

    return results.map(result => ({
      ...result,
      blockchain_stored: Boolean(result.blockchain_stored)
    }));
  }

  /**
   * Get tournament participants
   */
  static getTournamentParticipants(tournamentId: string): TournamentParticipant[] {
    const stmt = db.prepare(`
      SELECT tp.*, u.display_name as user_display_name 
      FROM tournament_participants tp 
      JOIN users u ON tp.user_id = u.id 
      WHERE tp.tournament_id = ? 
      ORDER BY tp.seed ASC, tp.created_at ASC
    `);
    
    return stmt.all(tournamentId) as TournamentParticipant[];
  }

  /**
   * Start tournament (generate bracket)
   */
  static startTournament(tournamentId: string, userId: number): Tournament {
    const tournament = this.getTournament(tournamentId);
    if (!tournament) {
      throw new Error('Tournament not found');
    }

    if (tournament.creator_id !== userId) {
      throw new Error('Only tournament creator can start the tournament');
    }

    if (tournament.status !== 'waiting') {
      throw new Error('Tournament cannot be started');
    }

    if (tournament.current_players < 2) {
      throw new Error('Need at least 2 players to start tournament');
    }

    // Get participants
    const participants = this.getTournamentParticipants(tournamentId);
    
    // Generate bracket for elimination tournament
    if (tournament.tournament_type === 'elimination') {
      this.generateEliminationBracket(tournamentId, participants);
    }

    // Update tournament status
    const now = new Date().toISOString();
    db.prepare('UPDATE tournaments SET status = ?, start_time = ?, updated_at = ? WHERE id = ?')
      .run('active', now, now, tournamentId);

    // Try to create on blockchain
    this.createTournamentOnBlockchain(tournamentId);

    return this.getTournament(tournamentId)!;
  }

  /**
   * Generate elimination bracket
   */
  private static generateEliminationBracket(tournamentId: string, participants: TournamentParticipant[]): void {
    const playerCount = participants.length;
    
    // Calculate number of rounds needed
    // const rounds = Math.ceil(Math.log2(playerCount));
    
    // Assign seeds
    participants.forEach((participant, index) => {
      db.prepare('UPDATE tournament_participants SET seed = ? WHERE id = ?')
        .run(index + 1, participant.id);
    });

    // Generate first round matches
    const matchesPerRound = Math.floor(playerCount / 2);
    
    for (let i = 0; i < matchesPerRound; i++) {
      const player1 = participants[i * 2];
      const player2 = participants[i * 2 + 1] || null; // Handle odd number of players

      const matchId = randomUUID();
      
      db.prepare(`
        INSERT INTO tournament_matches (
          tournament_id, match_id, round_number, match_order,
          player1_id, player2_id, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        tournamentId,
        matchId,
        1, // First round
        i + 1,
        player1.user_id,
        player2?.user_id || null,
        'pending',
        new Date().toISOString()
      );

      // If odd number and this is the last match with only one player, auto-advance
      if (!player2) {
        db.prepare(`
          UPDATE tournament_matches 
          SET winner_id = ?, status = ?, end_time = ? 
          WHERE match_id = ?
        `).run(player1.user_id, 'completed', new Date().toISOString(), matchId);
      }
    }
  }

  /**
   * Complete a tournament match
   */
  static completeMatch(matchId: string, winnerId: number, player1Score: number, player2Score: number): void {
    const match = db.prepare('SELECT * FROM tournament_matches WHERE match_id = ?').get(matchId) as TournamentMatch;
    
    if (!match) {
      throw new Error('Match not found');
    }

    if (match.status !== 'pending' && match.status !== 'active') {
      throw new Error('Match is not active');
    }

    // Validate winner
    if (winnerId !== match.player1_id && winnerId !== match.player2_id) {
      throw new Error('Invalid winner');
    }

    const now = new Date().toISOString();

    // Update match
    db.prepare(`
      UPDATE tournament_matches 
      SET winner_id = ?, player1_score = ?, player2_score = ?, 
          status = ?, end_time = ?
      WHERE match_id = ?
    `).run(winnerId, player1Score, player2Score, 'completed', now, matchId);

    // Check if tournament is complete
    this.checkTournamentCompletion(match.tournament_id);

    // Advance winner to next round if not final
    this.advanceWinner(match.tournament_id, winnerId, match.round_number, match.match_order);
  }

  /**
   * Advance winner to next round
   */
  private static advanceWinner(tournamentId: string, winnerId: number, currentRound: number, currentOrder: number): void {
    const nextRound = currentRound + 1;
    const nextMatchOrder = Math.ceil(currentOrder / 2);

    // Check if next round match exists
    let nextMatch = db.prepare(`
      SELECT * FROM tournament_matches 
      WHERE tournament_id = ? AND round_number = ? AND match_order = ?
    `).get(tournamentId, nextRound, nextMatchOrder) as TournamentMatch;

    // Create next round match if it doesn't exist
    if (!nextMatch) {
      const nextMatchId = randomUUID();
      
      db.prepare(`
        INSERT INTO tournament_matches (
          tournament_id, match_id, round_number, match_order,
          player1_id, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        tournamentId,
        nextMatchId,
        nextRound,
        nextMatchOrder,
        winnerId,
        'pending',
        new Date().toISOString()
      );
    } else {
      // Update existing match with second player
      if (!nextMatch.player1_id) {
        db.prepare('UPDATE tournament_matches SET player1_id = ? WHERE match_id = ?')
          .run(winnerId, nextMatch.match_id);
      } else if (!nextMatch.player2_id) {
        db.prepare('UPDATE tournament_matches SET player2_id = ? WHERE match_id = ?')
          .run(winnerId, nextMatch.match_id);
      }
    }
  }

  /**
   * Check if tournament is complete
   */
  private static checkTournamentCompletion(tournamentId: string): void {
    const pendingMatches = db.prepare(`
      SELECT COUNT(*) as count FROM tournament_matches 
      WHERE tournament_id = ? AND status IN ('pending', 'active')
    `).get(tournamentId) as { count: number };

    if (pendingMatches.count === 0) {
      // Tournament is complete, find winner
      const finalMatch = db.prepare(`
        SELECT * FROM tournament_matches 
        WHERE tournament_id = ? 
        ORDER BY round_number DESC, match_order ASC 
        LIMIT 1
      `).get(tournamentId) as TournamentMatch;

      if (finalMatch && finalMatch.winner_id) {
        const now = new Date().toISOString();
        
        // Update tournament
        db.prepare(`
          UPDATE tournaments 
          SET status = ?, winner_id = ?, end_time = ?, updated_at = ? 
          WHERE id = ?
        `).run('completed', finalMatch.winner_id, now, now, tournamentId);

        // Store on blockchain
        this.storeTournamentOnBlockchain(tournamentId);
      }
    }
  }

  /**
   * Create tournament on blockchain
   */
  private static async createTournamentOnBlockchain(tournamentId: string): Promise<void> {
    if (!blockchainService.isAvailable()) {
      console.warn('⚠️  Blockchain service not available, skipping tournament creation');
      return;
    }

    try {
      const tournament = this.getTournament(tournamentId);
      const participants = this.getTournamentParticipants(tournamentId);
      
      if (!tournament || participants.length === 0) return;

      // Use placeholder addresses for participants (in real app, these would be user wallet addresses)
      const playerAddresses = participants.map(p => `0x${p.user_id.toString().padStart(40, '0')}`);
      
      const result = await blockchainService.createTournament(
        tournamentId,
        tournament.name,
        playerAddresses
      );

      if (result) {
        db.prepare(`
          UPDATE tournaments 
          SET blockchain_tournament_id = ?, updated_at = ? 
          WHERE id = ?
        `).run(result.tournamentId, new Date().toISOString(), tournamentId);

        console.log(`✅ Tournament ${tournamentId} created on blockchain: ${result.txHash}`);
      }
    } catch (error) {
      console.error(`❌ Failed to create tournament ${tournamentId} on blockchain:`, (error as Error).message);
    }
  }

  /**
   * Store tournament results on blockchain
   */
  private static async storeTournamentOnBlockchain(tournamentId: string): Promise<void> {
    if (!blockchainService.isAvailable()) {
      console.warn('⚠️  Blockchain service not available, skipping tournament storage');
      return;
    }

    try {
      const tournament = this.getTournament(tournamentId);
      const participants = this.getTournamentParticipants(tournamentId);
      
      if (!tournament || participants.length === 0) return;

      // Calculate final scores (wins in tournament)
      const scores = participants.map(p => {
        const wins = db.prepare(`
          SELECT COUNT(*) as wins FROM tournament_matches 
          WHERE tournament_id = ? AND winner_id = ? AND status = 'completed'
        `).get(tournamentId, p.user_id) as { wins: number };
        
        return wins.wins;
      });

      const playerAddresses = participants.map(p => `0x${p.user_id.toString().padStart(40, '0')}`);
      
      const result = await blockchainService.storeTournamentResults(
        tournamentId,
        playerAddresses,
        scores
      );

      if (result) {
        db.prepare(`
          UPDATE tournaments 
          SET blockchain_tx_hash = ?, blockchain_stored = 1, updated_at = ? 
          WHERE id = ?
        `).run(result.txHash, new Date().toISOString(), tournamentId);

        console.log(`✅ Tournament ${tournamentId} results stored on blockchain: ${result.txHash}`);
      }
    } catch (error) {
      console.error(`❌ Failed to store tournament ${tournamentId} on blockchain:`, (error as Error).message);
    }
  }

  /**
   * Get tournament matches
   */
  static getTournamentMatches(tournamentId: string): TournamentMatch[] {
    const stmt = db.prepare(`
      SELECT tm.*, 
             u1.display_name as player1_name,
             u2.display_name as player2_name
      FROM tournament_matches tm
      LEFT JOIN users u1 ON tm.player1_id = u1.id
      LEFT JOIN users u2 ON tm.player2_id = u2.id
      WHERE tm.tournament_id = ?
      ORDER BY tm.round_number ASC, tm.match_order ASC
    `);
    
    return stmt.all(tournamentId) as TournamentMatch[];
  }

  /**
   * Get next pending match for a tournament
   */
  static getNextPendingMatch(tournamentId: string): TournamentMatch | null {
    const stmt = db.prepare(`
      SELECT * FROM tournament_matches 
      WHERE tournament_id = ? AND status = 'pending'
      ORDER BY round_number ASC, match_order ASC
      LIMIT 1
    `);
    
    return stmt.get(tournamentId) as TournamentMatch || null;
  }
}