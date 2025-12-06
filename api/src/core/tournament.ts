import db from '../db/db.js';

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
   * Cleanup stale active matches (called on startup)
   */
  static cleanupStaleMatches(): void {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const result = db.prepare(`
      UPDATE tournament_matches 
      SET status = 'pending', start_time = NULL
      WHERE status = 'active' 
      AND start_time < ?
    `).run(oneHourAgo);

    if (result.changes > 0) {
      console.log(`🧹 Cleaned up ${result.changes} stale active matches older than 1 hour`);
    }
  }

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
      end_time: tournament.end_time || undefined
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
      ...result
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
      ...result
    }));
  }

  /**
   * Get tournament participants
   */
  static getTournamentParticipants(tournamentId: string): TournamentParticipant[] {
    console.log(`🔍 Looking for participants in tournament: ${tournamentId}`);
    
    const stmt = db.prepare(`
      SELECT tp.*, u.display_name as user_display_name 
      FROM tournament_participants tp 
      JOIN users u ON tp.user_id = u.id 
      WHERE tp.tournament_id = ? 
      ORDER BY tp.seed ASC, tp.created_at ASC
    `);
    
    const participants = stmt.all(tournamentId) as TournamentParticipant[];
    console.log(`🔍 Found ${participants.length} participants:`, participants.map(p => ({ id: p.id, user_id: p.user_id, display_name: p.display_name })));
    
    return participants;
  }

  /**
   * Start tournament (generate bracket)
   */
  static startTournament(tournamentId: string, userId: number, fastify?: any): Tournament {
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

    // Get participants
    const participants = this.getTournamentParticipants(tournamentId);
    console.log(`🎯 Tournament ${tournamentId} has ${participants.length} actual participants:`, participants);
    
    if (participants.length < 2) {
      throw new Error('Need at least 2 players to start tournament');
    }
    
    // Generate bracket for elimination tournament
    if (tournament.tournament_type === 'elimination') {
      this.generateEliminationBracket(tournamentId, participants, fastify);
    }

    // Update tournament status
    const now = new Date().toISOString();
    db.prepare('UPDATE tournaments SET status = ?, start_time = ?, updated_at = ? WHERE id = ?')
      .run('active', now, now, tournamentId);

    // Try to create on blockchain
    // Tournament-level blockchain storage removed - only individual matches are stored

    return this.getTournament(tournamentId)!;
  }

  /**
   * Generate elimination bracket
   */
  private static generateEliminationBracket(tournamentId: string, participants: TournamentParticipant[], fastify?: any): void {
    const playerCount = participants.length;
    console.log(`🎲 Generating elimination bracket for tournament ${tournamentId} with ${playerCount} participants:`, participants);
    
    // Get tournament info for notifications
    const tournament = db.prepare('SELECT name FROM tournaments WHERE id = ?').get(tournamentId) as { name: string };
    
    // Calculate number of rounds needed
    // const rounds = Math.ceil(Math.log2(playerCount));
    
    // Assign seeds
    participants.forEach((participant, index) => {
      db.prepare('UPDATE tournament_participants SET seed = ? WHERE id = ?')
        .run(index + 1, participant.id);
    });

    // Generate first round matches
    const matchesPerRound = Math.floor(playerCount / 2);
    console.log(`🏆 Creating ${matchesPerRound} matches for first round`);
    
    for (let i = 0; i < matchesPerRound; i++) {
      const player1 = participants[i * 2];
      const player2 = participants[i * 2 + 1] || null; // Handle odd number of players

      const matchId = randomUUID();
      
      console.log(`⚡ Creating match ${i + 1}: Player ${player1.user_id} vs Player ${player2?.user_id || 'BYE'}`);
      
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

      console.log(`✅ Match ${matchId} created successfully`);

      // If odd number and this is the last match with only one player, auto-advance
      if (!player2) {
        console.log(`🏃 Auto-advancing player ${player1.user_id} (BYE)`);
        db.prepare(`
          UPDATE tournament_matches 
          SET winner_id = ?, status = ?, end_time = ? 
          WHERE match_id = ?
        `).run(player1.user_id, 'completed', new Date().toISOString(), matchId);
      } else {
        // Both players present, match is ready to play - send notification
        if (fastify && fastify.sendTournamentNotification && tournament) {
          fastify.sendTournamentNotification(
            tournamentId,
            tournament.name,
            matchId,
            player1.display_name,
            player2.display_name
          );
          console.log(`💬 Tournament notification sent for match ${matchId}`);
        }
      }
    }
  }

  /**
   * Complete a tournament match
   */
  /**
   * Start a tournament match by setting it to active status
   */
  static startMatch(matchId: string, userId: number, _fastify?: any): void {
    const match = db.prepare('SELECT * FROM tournament_matches WHERE match_id = ?').get(matchId) as TournamentMatch;
    
    if (!match) {
      throw new Error('Match not found');
    }

    if (match.status !== 'pending') {
      throw new Error('Match is not available to start');
    }

    // Validate that both players are present
    if (!match.player1_id || !match.player2_id) {
      throw new Error('Cannot start match: waiting for second player');
    }

    // Validate that the user is one of the players
    if (userId !== match.player1_id && userId !== match.player2_id) {
      throw new Error('You are not a participant in this match');
    }

    // Check if the user already has an active match in this tournament
    const activeMatch = db.prepare(`
      SELECT match_id FROM tournament_matches 
      WHERE tournament_id = ? AND status = 'active'
      AND (player1_id = ? OR player2_id = ?)
    `).get(match.tournament_id, userId, userId) as any;

    if (activeMatch) {
      throw new Error('You already have an active match in this tournament');
    }

    // Note: Player and tournament info retrieved when notifications are needed

    const now = new Date().toISOString();
    
    // Mark match as active
    db.prepare(`
      UPDATE tournament_matches 
      SET status = 'active', start_time = ?
      WHERE match_id = ?
    `).run(now, matchId);

    // Note: Tournament notifications are sent when matches become available, not when they start
  }

  static completeMatch(matchId: string, winnerId: number, player1Score: number, player2Score: number, fastify?: any): void {
    const match = db.prepare('SELECT * FROM tournament_matches WHERE match_id = ?').get(matchId) as TournamentMatch;
    
    if (!match) {
      throw new Error('Match not found');
    }

    if (match.status !== 'pending' && match.status !== 'active') {
      throw new Error('Match is not active');
    }

    // Validate that both players are present
    if (!match.player1_id || !match.player2_id) {
      throw new Error('Cannot complete match: waiting for second player');
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

    // Advance winner to next round first (creates next match if needed)
    this.advanceWinner(match.tournament_id, winnerId, match.round_number, match.match_order, fastify);

    // Then check if tournament is complete (after potential next match creation)
    this.checkTournamentCompletion(match.tournament_id, fastify);
  }

  /**
   * Advance winner to next round
   */
  private static advanceWinner(tournamentId: string, winnerId: number, currentRound: number, currentOrder: number, fastify?: any): void {
    // Check how many matches are left in current round
    const remainingMatchesInRound = db.prepare(`
      SELECT COUNT(*) as count FROM tournament_matches 
      WHERE tournament_id = ? AND round_number = ? AND status IN ('pending', 'active')
    `).get(tournamentId, currentRound) as { count: number };

    // Check how many matches exist in current round total
    const totalMatchesInRound = db.prepare(`
      SELECT COUNT(*) as count FROM tournament_matches 
      WHERE tournament_id = ? AND round_number = ?
    `).get(tournamentId, currentRound) as { count: number };

    console.log(`🎯 Round ${currentRound}: ${totalMatchesInRound.count} total matches, ${remainingMatchesInRound.count} still pending`);

    // If this is the only match in this round AND it's completed, this is the final
    if (totalMatchesInRound.count === 1 && remainingMatchesInRound.count === 0) {
      console.log(`🏆 This was the final match (only 1 match in round ${currentRound}), tournament should be complete`);
      return;
    }

    const nextRound = currentRound + 1;
    const nextMatchOrder = Math.ceil(currentOrder / 2);
    
    console.log(`🏆 Advancing winner ${winnerId} from Round ${currentRound} Match ${currentOrder} to Round ${nextRound} Match ${nextMatchOrder}`);

    // Check if there's already a winner waiting for this next round match
    const existingWinner = db.prepare(`
      SELECT * FROM tournament_matches 
      WHERE tournament_id = ? AND round_number = ? AND match_order = ?
    `).get(tournamentId, nextRound, nextMatchOrder) as TournamentMatch;

    if (!existingWinner) {
      // Create new match but only with player1 (wait for player2)
      const nextMatchId = randomUUID();
      
      console.log(`⚡ Creating new match in Round ${nextRound}: Winner ${winnerId} waiting for opponent`);
      
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
      // Update existing match with second player and make it ready
      console.log(`⚡ Updating existing match in Round ${nextRound}: Adding second player ${winnerId}`);
      
      if (!existingWinner.player2_id && existingWinner.player1_id !== winnerId) {
        console.log(`⚡ Setting ${winnerId} as player2, match is now ready`);
        db.prepare('UPDATE tournament_matches SET player2_id = ? WHERE match_id = ?')
          .run(winnerId, existingWinner.match_id);
        
        // Send notification about new match ready to play (simplified - same format as initial matches)
        if (fastify && fastify.sendTournamentNotification) {
          const player1 = db.prepare('SELECT display_name FROM users WHERE id = ?').get(existingWinner.player1_id) as { display_name: string };
          const player2 = db.prepare('SELECT display_name FROM users WHERE id = ?').get(winnerId) as { display_name: string };
          const tournament = db.prepare('SELECT name FROM tournaments WHERE id = ?').get(tournamentId) as { name: string };
          
          // Use the same simple notification format as initial matches
          fastify.sendTournamentNotification(
            tournamentId,
            tournament.name,
            existingWinner.match_id,
            player1.display_name,
            player2.display_name
          );
          console.log(`💬 Tournament notification sent for next round match ${existingWinner.match_id}`);
        }
      } else {
        console.log(`❌ Cannot add winner ${winnerId} - match already complete or duplicate`);
      }
    }
  }

  /**
   * Check if tournament is complete
   */
  private static checkTournamentCompletion(tournamentId: string, _fastify?: any): void {
    const pendingMatches = db.prepare(`
      SELECT COUNT(*) as count FROM tournament_matches 
      WHERE tournament_id = ? AND status IN ('pending', 'active')
    `).get(tournamentId) as { count: number };

    console.log(`🎯 Checking tournament completion: ${pendingMatches.count} pending matches remaining`);

    if (pendingMatches.count === 0) {
      // Tournament is complete, find winner
      const finalMatch = db.prepare(`
        SELECT * FROM tournament_matches 
        WHERE tournament_id = ? 
        ORDER BY round_number DESC, match_order ASC 
        LIMIT 1
      `).get(tournamentId) as TournamentMatch;

      console.log(`🏆 Tournament completed! Final match:`, { 
        round: finalMatch?.round_number, 
        winner: finalMatch?.winner_id,
        player1: finalMatch?.player1_id,
        player2: finalMatch?.player2_id
      });

      if (finalMatch && finalMatch.winner_id) {
        const now = new Date().toISOString();
        
        // Update tournament
        db.prepare(`
          UPDATE tournaments 
          SET status = ?, winner_id = ?, end_time = ?, updated_at = ? 
          WHERE id = ?
        `).run('completed', finalMatch.winner_id, now, now, tournamentId);

        console.log(`✅ Tournament ${tournamentId} marked as completed with winner ${finalMatch.winner_id}`);

        // Note: Blockchain storage is now handled at individual match level, not tournament level
        console.log(`ℹ️ Tournament completed. Individual matches already stored on blockchain.`);
      }
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