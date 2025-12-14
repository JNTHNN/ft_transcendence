import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Database } from 'better-sqlite3';
import { blockchainService } from '../core/blockchain.js';
import { TournamentService } from '../core/tournament.js';
import { authMiddleware } from '../middleware/auth.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: Database;
  }
}

interface TournamentRequest {
  name: string;
  description?: string;
  max_players: number;
  start_date?: string;
}

interface TournamentParams {
  id: string;
}

export default async function tournamentRoutes(fastify: FastifyInstance) {
  const db: Database = fastify.db;

  fastify.get('/tournaments', {
    preHandler: fastify.auth
  }, async (request: FastifyRequest<{
    Querystring: {
      limit?: string;
      offset?: string;
    }
  }>, reply: FastifyReply) => {
    try {
      const limit = parseInt(request.query.limit || '10', 10);
      const offset = parseInt(request.query.offset || '0', 10);

      const tournaments = db.prepare(`
        SELECT t.*, 
               COUNT(tp.user_id) as player_count,
               COUNT(tp.user_id) as current_players,
               u.display_name as creator_username
        FROM tournaments t
        LEFT JOIN tournament_participants tp ON t.id = tp.tournament_id
        LEFT JOIN users u ON t.creator_id = u.id
        GROUP BY t.id
        ORDER BY t.created_at DESC
        LIMIT ? OFFSET ?
      `).all(limit, offset);

      const total = db.prepare('SELECT COUNT(*) as count FROM tournaments').get() as { count: number };

      return {
        tournaments,
        total: total.count,
        limit,
        offset
      };
    } catch (error) {
      fastify.log.error(error, 'Error fetching tournaments');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.get('/user/tournaments', {
    preHandler: fastify.auth
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.uid;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const createdTournaments = db.prepare(`
        SELECT t.*, 
               COUNT(tp.user_id) as player_count,
               COUNT(tp.user_id) as current_players,
               u.display_name as creator_username,
               0 as is_participant
        FROM tournaments t
        LEFT JOIN tournament_participants tp ON t.id = tp.tournament_id
        LEFT JOIN users u ON t.creator_id = u.id
        WHERE t.creator_id = ?
        GROUP BY t.id
        ORDER BY t.created_at DESC
      `).all(userId);

      const participatedTournaments = db.prepare(`
        SELECT t.*, 
               COUNT(tp_all.user_id) as player_count,
               COUNT(tp_all.user_id) as current_players,
               u.display_name as creator_username,
               1 as is_participant
        FROM tournaments t
        JOIN tournament_participants tp ON t.id = tp.tournament_id AND tp.user_id = ?
        LEFT JOIN tournament_participants tp_all ON t.id = tp_all.tournament_id
        LEFT JOIN users u ON t.creator_id = u.id
        WHERE t.creator_id != ?
        GROUP BY t.id
        ORDER BY t.created_at DESC
      `).all(userId, userId);

      const allTournaments = [...createdTournaments, ...participatedTournaments]
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const created = allTournaments.filter((t: any) => t.creator_id === userId);
      const participated = allTournaments.filter((t: any) => t.creator_id !== userId && t.is_participant === 1);

      return { created, participated };
    } catch (error) {
      fastify.log.error(error, 'Error fetching user tournaments');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.get('/tournaments/:id', {
    preHandler: fastify.auth
  }, async (request: FastifyRequest<{ Params: TournamentParams }>, reply: FastifyReply) => {
    try {
      const tournamentId = request.params.id;
      
      const tournament = db.prepare(`
        SELECT t.*, 
               u.display_name as creator_username,
               w.display_name as winner_username,
               COUNT(tp.user_id) as player_count,
               COUNT(tp.user_id) as current_players
        FROM tournaments t
        LEFT JOIN users u ON t.creator_id = u.id
        LEFT JOIN users w ON t.winner_id = w.id
        LEFT JOIN tournament_participants tp ON t.id = tp.tournament_id
        WHERE t.id = ?
        GROUP BY t.id
      `).get(tournamentId);

      if (!tournament) {
        return reply.status(404).send({ error: 'Tournament not found' });
      }

      const players = db.prepare(`
        SELECT u.id, u.display_name as username, u.avatar_url, tp.created_at as joined_at
        FROM tournament_participants tp
        JOIN users u ON tp.user_id = u.id
        WHERE tp.tournament_id = ?
        ORDER BY tp.created_at ASC
      `).all(tournamentId);

      const matches = db.prepare(`
        SELECT m.*, 
               p1.display_name as player1_username,
               p1.avatar_url as player1_avatar_url,
               p2.display_name as player2_username,
               p2.avatar_url as player2_avatar_url
        FROM tournament_matches m
        LEFT JOIN users p1 ON m.player1_id = p1.id
        LEFT JOIN users p2 ON m.player2_id = p2.id
        WHERE m.tournament_id = ?
        ORDER BY m.round_number, m.match_order
      `).all(tournamentId);

      const tournamentData = tournament as any;
      
      return {
        ...tournamentData,
        players,
        matches,
      };
    } catch (error) {
      fastify.log.error(error, 'Error fetching tournament');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.post('/tournaments', {
    preHandler: fastify.auth
  }, async (request: FastifyRequest<{ Body: TournamentRequest }>, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.uid;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { name, description, max_players, start_date } = request.body;

      if (!name || !max_players) {
        return reply.status(400).send({ error: 'Name and max_players are required' });
      }

      if (max_players > 8) {
        return reply.status(400).send({ error: 'Maximum 8 players allowed per tournament' });
      }
      
      if (![2, 4, 8].includes(max_players)) {
        return reply.status(400).send({ error: 'Only 2, 4, or 8 players allowed (power of 2)' });
      }

      const recentTournaments = db.prepare(`
        SELECT id FROM tournaments 
        WHERE creator_id = ? AND name = ? AND created_at > datetime('now', '-5 seconds')
      `).all(userId, name);

      if (recentTournaments.length > 0) {
        return reply.status(400).send({ error: 'Tournament with this name was already created recently' });
      }

      const tournamentId = 'tournament_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      
      db.prepare(`
        INSERT INTO tournaments (id, name, description, max_players, creator_id, start_time, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'waiting', datetime('now'))
      `).run(tournamentId, name, description || null, max_players, userId, start_date || null);

      console.log('Tournament created. Blockchain storage will occur for individual matches.');

      const creatorInfo = db.prepare('SELECT display_name FROM users WHERE id = ?').get(userId) as any;
      
      db.prepare(`
        INSERT INTO tournament_participants (tournament_id, user_id, display_name, created_at)
        VALUES (?, ?, ?, datetime('now'))
      `).run(tournamentId, userId, creatorInfo?.display_name || 'Creator');

      const tournament = db.prepare(`
        SELECT t.*, u.display_name as creator_username
        FROM tournaments t
        JOIN users u ON t.creator_id = u.id
        WHERE t.id = ?
      `).get(tournamentId);

      return {
        ...(tournament as any)
      };
    } catch (error) {
      fastify.log.error(error, 'Error creating tournament');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.post('/tournaments/:id/join', {
    preHandler: fastify.auth
  }, async (request: FastifyRequest<{ Params: TournamentParams }>, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.uid;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const tournamentId = request.params.id;

      const tournament = db.prepare(`
        SELECT * FROM tournaments WHERE id = ? AND status = 'waiting'
      `).get(tournamentId);

      if (!tournament) {
        return reply.status(404).send({ error: 'Tournament not found or closed' });
      }

      const existingPlayer = db.prepare(`
        SELECT * FROM tournament_participants WHERE tournament_id = ? AND user_id = ?
      `).get(tournamentId, userId);

      if (existingPlayer) {
        return reply.status(400).send({ error: 'Already joined this tournament' });
      }

      const playerCount = db.prepare(`
        SELECT COUNT(*) as count FROM tournament_participants WHERE tournament_id = ?
      `).get(tournamentId) as { count: number };

      if (playerCount.count >= (tournament as any).max_players) {
        return reply.status(400).send({ error: 'Tournament is full' });
      }

      const user = db.prepare('SELECT display_name FROM users WHERE id = ?').get(userId) as any;
      
      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      db.prepare(`
        INSERT INTO tournament_participants (tournament_id, user_id, display_name, created_at)
        VALUES (?, ?, ?, datetime('now'))
      `).run(tournamentId, userId, user.display_name);

      return { success: true, message: 'Successfully joined tournament' };
    } catch (error) {
      fastify.log.error(error, 'Error joining tournament');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.delete('/tournaments/:id/leave', {
    preHandler: fastify.auth
  }, async (request: FastifyRequest<{ Params: TournamentParams }>, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.uid;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const tournamentId = request.params.id;

      const tournament = db.prepare(`
        SELECT * FROM tournaments WHERE id = ? AND status = 'waiting'
      `).get(tournamentId);

      if (!tournament) {
        return reply.status(404).send({ error: 'Tournament not found or already started' });
      }

      const result = db.prepare(`
        DELETE FROM tournament_participants WHERE tournament_id = ? AND user_id = ?
      `).run(tournamentId, userId);

      if (result.changes === 0) {
        return reply.status(400).send({ error: 'Not in this tournament' });
      }

      return { success: true, message: 'Successfully left tournament' };
    } catch (error) {
      fastify.log.error(error, 'Error leaving tournament');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.delete('/tournaments/:id', {
    preHandler: fastify.auth
  }, async (request: FastifyRequest<{ Params: TournamentParams }>, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.uid;
      const tournamentId = request.params.id;

      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ? AND creator_id = ?').get(tournamentId, userId);
      
      if (!tournament) {
        return reply.status(404).send({ error: 'Tournament not found or you are not the creator' });
      }

      if ((tournament as any).status !== 'waiting') {
        return reply.status(400).send({ error: 'Cannot delete tournament that has started' });
      }

      db.prepare('DELETE FROM tournament_participants WHERE tournament_id = ?').run(tournamentId);
      db.prepare('DELETE FROM tournament_matches WHERE tournament_id = ?').run(tournamentId);
      
      const result = db.prepare('DELETE FROM tournaments WHERE id = ? AND creator_id = ?').run(tournamentId, userId);

      if (result.changes === 0) {
        return reply.status(400).send({ error: 'Failed to delete tournament' });
      }

      return { success: true, message: 'Tournament deleted successfully' };
    } catch (error) {
      fastify.log.error(error, 'Error deleting tournament');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.post('/tournaments/:id/start', {
    preHandler: fastify.auth
  }, async (request: FastifyRequest<{ Params: TournamentParams }>, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.uid;
      const tournamentId = request.params.id;

      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ? AND creator_id = ?').get(tournamentId, userId);
      
      if (!tournament) {
        return reply.status(404).send({ error: 'Tournament not found or you are not the creator' });
      }

      if ((tournament as any).status !== 'waiting') {
        return reply.status(400).send({ error: 'Tournament is not in waiting status' });
      }

      const playerCount = db.prepare('SELECT COUNT(*) as count FROM tournament_participants WHERE tournament_id = ?').get(tournamentId) as { count: number };
      
      if (playerCount.count < 2) {
        return reply.status(400).send({ error: 'Tournament needs at least 2 players to start' });
      }

      if ((tournament as any).tournament_type === 'elimination') {
        const isPowerOfTwo = (n: number) => n > 0 && (n & (n - 1)) === 0;
        
        if (!isPowerOfTwo(playerCount.count)) {
          return reply.status(400).send({ 
            error: `Tournament elimination requires a power of 2 number of players (2, 4, 8). Current: ${playerCount.count} players.` 
          });
        }
      }

      const participants = db.prepare(`
        SELECT tp.*, u.display_name as user_display_name 
        FROM tournament_participants tp 
        JOIN users u ON tp.user_id = u.id 
        WHERE tp.tournament_id = ? 
        ORDER BY tp.created_at ASC
      `).all(tournamentId);
      
      fastify.log.info(` Starting tournament ${tournamentId} with ${playerCount.count} players. Participants: ${JSON.stringify(participants)}`);
      
      try {
        const { broadcastTournamentStart } = await import('../chat/ws.js');
        broadcastTournamentStart(db, tournamentId, (tournament as any).name);
        
        const startedTournament = TournamentService.startTournament(tournamentId, userId, fastify);
        
        const createdMatches = db.prepare('SELECT COUNT(*) as count FROM tournament_matches WHERE tournament_id = ?').get(tournamentId) as { count: number };
        fastify.log.info(`Tournament ${tournamentId} started successfully with ${createdMatches.count} matches created`);
        
        return { 
          success: true, 
          message: 'Tournament started successfully',
          tournament: startedTournament,
          matchesCreated: createdMatches.count
        };
      } catch (error) {
        fastify.log.error(`Error starting tournament ${tournamentId}: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
      }
    } catch (error) {
      fastify.log.error(error, 'Error starting tournament');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.post('/tournaments/:id/match-result', {
    preHandler: fastify.auth
  }, async (request: FastifyRequest<{ 
    Params: TournamentParams, 
    Body: { winner: 'left' | 'right', score: { left: number, right: number }, players: { left: string, right: string }, matchId?: string }
  }>, reply: FastifyReply) => {
    const startTime = Date.now();
    fastify.log.info(`Starting tournament match result submission for tournament ${request.params.id}`);
    
    try {
      const userId = (request as any).user?.uid;
      const tournamentId = request.params.id;
      const { winner, score, players: _players, matchId } = request.body;

      if (!userId) {
        fastify.log.warn(' Unauthorized request - no user ID');
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId);
      
      if (!tournament) {
        return reply.status(404).send({ error: 'Tournament not found' });
      }

      if ((tournament as any).status !== 'active') {
        return reply.status(400).send({ error: 'Tournament is not active' });
      }

      const participant = db.prepare('SELECT * FROM tournament_participants WHERE tournament_id = ? AND user_id = ?').get(tournamentId, userId);
      const isCreator = (tournament as any).creator_id === userId;
      
      fastify.log.info(`Tournament ${tournamentId}, User ${userId}, Participant found: ${!!participant}, Is creator: ${isCreator}, MatchId: ${matchId}`);
      
      if (!participant && !isCreator) {
        const allParticipants = db.prepare('SELECT user_id FROM tournament_participants WHERE tournament_id = ?').all(tournamentId);
        fastify.log.info(`All participants for tournament ${tournamentId}: ${JSON.stringify(allParticipants)}`);
        return reply.status(403).send({ error: 'User not participating in this tournament' });
      }

      let activeMatch;
      if (matchId) {
        activeMatch = db.prepare(`
          SELECT tm.*, 
                 u1.display_name as player1_name, 
                 u2.display_name as player2_name
          FROM tournament_matches tm
          LEFT JOIN users u1 ON tm.player1_id = u1.id
          LEFT JOIN users u2 ON tm.player2_id = u2.id
          WHERE tm.tournament_id = ? 
          AND tm.match_id = ?
          AND tm.status IN ('pending', 'active')
          AND (tm.player1_id = ? OR tm.player2_id = ?)
        `).get(tournamentId, matchId, userId, userId) as any;
      } else {
        activeMatch = db.prepare(`
          SELECT tm.*, 
                 u1.display_name as player1_name, 
                 u2.display_name as player2_name
          FROM tournament_matches tm
          LEFT JOIN users u1 ON tm.player1_id = u1.id
          LEFT JOIN users u2 ON tm.player2_id = u2.id
          WHERE tm.tournament_id = ? 
          AND tm.status IN ('pending', 'active')
          AND (tm.player1_id = ? OR tm.player2_id = ?)
          ORDER BY tm.round_number, tm.match_order
          LIMIT 1
        `).get(tournamentId, userId, userId) as any;
      }

      if (!activeMatch) {
        return reply.status(400).send({ error: 'No active match found for this user' });
      }

      const leftPlayerId = _players?.left ? parseInt(_players.left) : null;
      const rightPlayerId = _players?.right ? parseInt(_players.right) : null;
      
      let winnerId;
      if (leftPlayerId && rightPlayerId) {
        winnerId = winner === 'left' ? leftPlayerId : rightPlayerId;
        
        const leftPlayerMatch = leftPlayerId === activeMatch.player1_id || leftPlayerId === activeMatch.player2_id;
        const rightPlayerMatch = rightPlayerId === activeMatch.player1_id || rightPlayerId === activeMatch.player2_id;
        
        if (!leftPlayerMatch || !rightPlayerMatch) {
          console.error(` Player mapping error:
            - Left player: ${leftPlayerId}, in match: ${leftPlayerMatch}
            - Right player: ${rightPlayerId}, in match: ${rightPlayerMatch}
            - Match player1_id: ${activeMatch.player1_id}
            - Match player2_id: ${activeMatch.player2_id}`);
          return reply.status(400).send({ error: 'Player mapping does not match tournament match' });
        }
        
        console.log(` Winner determination:
          - Game winner side: ${winner}
          - Left player (${leftPlayerId}): ${winner === 'left' ? 'WINNER' : 'loser'}
          - Right player (${rightPlayerId}): ${winner === 'right' ? 'WINNER' : 'loser'}
          - Final winnerId: ${winnerId}`);
      } else {
        console.warn(' No explicit player mapping, using fallback method');
        const isPlayer1 = activeMatch.player1_id === userId;
        winnerId = (winner === 'left' && isPlayer1) || (winner === 'right' && !isPlayer1) 
          ? activeMatch.player1_id 
          : activeMatch.player2_id;
      }
      
      const player1 = db.prepare('SELECT display_name as user_display_name FROM users WHERE id = ?').get(activeMatch.player1_id) as any;
      const player2 = db.prepare('SELECT display_name as user_display_name FROM users WHERE id = ?').get(activeMatch.player2_id) as any;

      try {
        const matchHistory = db.prepare('SELECT duration FROM match_history WHERE player1_id = ? AND player2_id = ? AND player1_score = ? AND player2_score = ? ORDER BY id DESC LIMIT 1')
          .get(activeMatch.player1_id, activeMatch.player2_id, score.left, score.right);
        let realDuration = 0;
        if (
          matchHistory &&
          typeof matchHistory === 'object' &&
          matchHistory !== null &&
          'duration' in matchHistory &&
          typeof (matchHistory as any).duration === 'number'
        ) {
          realDuration = (matchHistory as any).duration;
        }
        TournamentService.completeMatch(activeMatch.match_id, winnerId, score.left, score.right, realDuration, fastify);
      } catch (error) {
        fastify.log.error(`Error completing tournament match: ${error}`);
        const errorMessage = error instanceof Error ? error.message : 'Failed to complete tournament match';
        return reply.status(400).send({ error: errorMessage });
      }
      
      
      
      if (blockchainService.isAvailable()) {
        console.log(`Storing individual match result on blockchain for match ${activeMatch.match_id}`);
        
        
        (async () => {
          try {
            const matchResult = await blockchainService.storeMatchResult({
              matchId: activeMatch.match_id,
              tournamentId: tournamentId,
              player1Name: player1?.user_display_name || 'Joueur 1',
              player2Name: player2?.user_display_name || 'Joueur 2',
              player1Score: score.left,
              player2Score: score.right,
              winnerId: winnerId === activeMatch.player1_id ? 1 : 2,
              round: activeMatch.round_number
            });
            
            if (matchResult?.transactionHash) {
              
              db.prepare(`
                UPDATE tournament_matches 
                SET blockchain_tx_hash = ?, blockchain_match_id = ?
                WHERE match_id = ?
              `).run(matchResult.transactionHash, matchResult.dataHash || null, activeMatch.match_id);
              
              console.log(`Match ${activeMatch.match_id} stored on blockchain: ${matchResult.transactionHash}`);
            }
          } catch (error) {
            console.error(`Failed to store match ${activeMatch.match_id} on blockchain:`, error);
          }
        })();
      }
      
      console.log(`Tournament match completed. Individual match blockchain storage already handled above.`);
        
        const duration = Date.now() - startTime;
        fastify.log.info(`Tournament match result submitted successfully in ${duration}ms`);
        
        const finalTournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId) as any;
        const tournamentComplete = finalTournament?.status === 'completed';
        
        if (tournamentComplete && finalTournament?.winner_id) {
          const winnerUser = db.prepare('SELECT display_name FROM users WHERE id = ?').get(finalTournament.winner_id) as any;
          if (winnerUser) {
            const { broadcastTournamentEnd } = await import('../chat/ws.js');
            broadcastTournamentEnd(db, tournamentId, finalTournament.name, winnerUser.display_name);
          }
        }
        
        return { 
          success: true, 
          message: 'Match result submitted successfully',
          tournamentComplete: tournamentComplete,
          winner: tournamentComplete ? (winnerId === activeMatch.player1_id) ? (player1?.user_display_name || 'Player 1') : (player2?.user_display_name || 'Player 2') : null,
          matchWinner: (winnerId === activeMatch.player1_id) ? (player1?.user_display_name || 'Player 1') : (player2?.user_display_name || 'Player 2')
        };
    } catch (error) {
      const duration = Date.now() - startTime;
      fastify.log.error(error, ` Error submitting match result after ${duration}ms`);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.post<{
    Params: { id: string }
    Body: { matchId: string }
  }>('/tournaments/:id/start-match', {
    preHandler: [authMiddleware]
  }, async (request, reply) => {
    const { matchId } = request.body;
    const userId = (request as any).user?.uid;

    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    try {
      TournamentService.startMatch(matchId, userId, fastify);
      return reply.send({ success: true, message: 'Match started successfully' });
    } catch (error) {
      fastify.log.error(error, 'Error starting match');
      return reply.status(400).send({ error: (error as Error).message });
    }
  });

  fastify.post<{
    Params: { id: string }
    Body: { matchId?: string }
  }>('/tournaments/:id/reset-match', {
    preHandler: [authMiddleware]
  }, async (request, reply) => {
    const tournamentId = request.params.id;
    const { matchId } = request.body || {};
    const userId = (request as any).user?.uid;

    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    try {
      const tournament = db.prepare('SELECT status FROM tournaments WHERE id = ?').get(tournamentId) as any;
      
      if (!tournament) {
        return reply.status(404).send({ error: 'Tournament not found' });
      }

      if (tournament.status === 'completed') {
        return reply.status(400).send({ error: 'Cannot reset matches in a completed tournament' });
      }

      let match;
      
      if (matchId) {
        match = db.prepare(`
          SELECT * FROM tournament_matches 
          WHERE tournament_id = ? 
          AND match_id = ?
          AND (player1_id = ? OR player2_id = ?)
          AND status = 'active'
        `).get(tournamentId, matchId, userId, userId) as any;
      } else {
        match = db.prepare(`
          SELECT * FROM tournament_matches 
          WHERE tournament_id = ? 
          AND (player1_id = ? OR player2_id = ?)
          AND status = 'active'
          ORDER BY created_at DESC
          LIMIT 1
        `).get(tournamentId, userId, userId) as any;
      }

      if (!match) {
        return reply.status(404).send({ error: 'No active match found to reset' });
      }

      const { gameManager } = await import('../game/GameManager.js');
      if (gameManager.getGame(match.match_id)) {
        fastify.log.info(`🗑️ Removing existing game session for match ${match.match_id}`);
        gameManager.removeGame(match.match_id);
      }

      db.prepare(`
        UPDATE tournament_matches 
        SET status = 'pending', start_time = NULL, end_time = NULL, 
            winner_id = NULL, player1_score = 0, player2_score = 0
        WHERE match_id = ?
      `).run(match.match_id);

      fastify.log.info(`🔄 User ${userId} reset match ${match.match_id} (was ${match.status}) in tournament ${tournamentId}`);

      return reply.send({ 
        success: true, 
        message: 'Match reset successfully', 
        matchId: match.match_id,
        previousStatus: match.status 
      });
    } catch (error) {
      fastify.log.error(error, 'Error resetting match');
      return reply.status(500).send({ error: 'Failed to reset match' });
    }
  });

  fastify.get<{
    Params: { id: string }
  }>('/tournaments/:id/next-match', {
    preHandler: [authMiddleware]
  }, async (request, reply) => {
    const tournamentId = request.params.id;
    const userId = (request as any).user?.uid;

    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    try {
      const tournamentInfo = db.prepare('SELECT status FROM tournaments WHERE id = ?').get(tournamentId) as any;
      const totalMatches = db.prepare('SELECT COUNT(*) as count FROM tournament_matches WHERE tournament_id = ?').get(tournamentId) as { count: number };
      const pendingMatches = db.prepare('SELECT COUNT(*) as count FROM tournament_matches WHERE tournament_id = ? AND status = ?').get(tournamentId, 'pending') as { count: number };
      
      fastify.log.info(`Tournament ${tournamentId}: status=${tournamentInfo?.status}, total_matches=${totalMatches.count}, pending_matches=${pendingMatches.count}, userId=${userId}`);

      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const cleanupResult = db.prepare(`
        UPDATE tournament_matches 
        SET status = 'pending', start_time = NULL
        WHERE tournament_id = ? 
        AND status = 'active' 
        AND start_time < ?
      `).run(tournamentId, thirtyMinutesAgo);

      if (cleanupResult.changes > 0) {
        fastify.log.info(`Cleaned up ${cleanupResult.changes} stale active matches older than 30 minutes`);
      }

      const activeMatch = db.prepare(`
        SELECT id, start_time FROM tournament_matches 
        WHERE tournament_id = ? 
        AND status = 'active'
        AND (player1_id = ? OR player2_id = ?)
      `).get(tournamentId, userId, userId) as any;

      if (activeMatch) {
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        if (activeMatch.start_time && activeMatch.start_time < tenMinutesAgo) {
          fastify.log.info(`Allowing user to restart stale match: ${activeMatch.id}`);
          db.prepare(`
            UPDATE tournament_matches 
            SET status = 'pending', start_time = NULL
            WHERE id = ?
          `).run(activeMatch.id);
        } else {
          return reply.send({ 
            hasMatch: false, 
            message: 'Vous avez déjà un match en cours dans ce tournoi',
            canRestart: activeMatch.start_time && activeMatch.start_time < tenMinutesAgo,
            activeMatchId: activeMatch.id
          });
        }
      }

      const nextMatch = db.prepare(`
        SELECT tm.*, 
               u1.display_name as player1_name, 
               u2.display_name as player2_name
        FROM tournament_matches tm
        LEFT JOIN users u1 ON tm.player1_id = u1.id
        LEFT JOIN users u2 ON tm.player2_id = u2.id
        WHERE tm.tournament_id = ? 
        AND tm.status = 'pending'
        AND (tm.player1_id = ? OR tm.player2_id = ?)
        AND tm.player1_id IS NOT NULL
        AND tm.player2_id IS NOT NULL
        ORDER BY tm.round_number, tm.match_order
        LIMIT 1
      `).get(tournamentId, userId, userId) as any;

      fastify.log.info(` Match search result: ${nextMatch ? 'found match' : 'no match'}`);

      if (!nextMatch) {
        return reply.send({ 
          hasMatch: false, 
          message: 'Aucun match prêt à jouer - attendez que les autres matchs se terminent' 
        });
      }

      return reply.send({
        hasMatch: true,
        match: nextMatch,
        isReady: true
      });

    } catch (error) {
      fastify.log.error(error, 'Error fetching next match');
      return reply.status(500).send({ error: 'Failed to fetch next match' });
    }
  });

  fastify.get('/tournaments/match/:matchId/blockchain', {
    preHandler: fastify.auth
  }, async (request: FastifyRequest<{ 
    Params: { matchId: string } 
  }>, reply: FastifyReply) => {
    try {
      const { matchId } = request.params;
      
      const match = db.prepare(`
        SELECT tm.*, 
               u1.display_name as player1_name,
               u2.display_name as player2_name,
               winner.display_name as winner_name
        FROM tournament_matches tm
        LEFT JOIN users u1 ON tm.player1_id = u1.id
        LEFT JOIN users u2 ON tm.player2_id = u2.id
        LEFT JOIN users winner ON tm.winner_id = winner.id
        WHERE tm.match_id = ?
      `).get(matchId) as any;
      
      if (!match) {
        return reply.status(404).send({ error: 'Match not found' });
      }
      
      if (!match.blockchain_tx_hash) {
        return reply.status(404).send({ error: 'No blockchain data available for this match' });
      }
      
      const localData = {
        matchId: match.match_id,
        players: [
          match.player1_name || 'Joueur inconnu',
          match.player2_name || 'Joueur inconnu'
        ],
        scores: [match.player1_score, match.player2_score],
        winner: match.winner_name || 'Aucun gagnant',
        round: match.round_number,
        matchOrder: match.match_order,
        endTime: match.end_time,
        status: match.status
      };
      
      let blockchainData = null;
      let dataMatches: any = false;
      
      if (blockchainService.isAvailable() && match.blockchain_tx_hash && match.blockchain_match_id) {
        try {
          console.log(` Récupération des données blockchain pour le match ${matchId}`);
          console.log(` TX Hash: ${match.blockchain_tx_hash}`);
          console.log(` Data Hash: ${match.blockchain_match_id}`);
          
          try {
            blockchainData = await blockchainService.getMatch(match.match_id);
          } catch (getMatchError) {
            console.warn(` Erreur getMatch: ${(getMatchError as Error).message}`);
          }
          
          if (blockchainData) {
            console.log(`Données blockchain récupérées depuis le smart contract:`, blockchainData);
            
            const scoresMatch = blockchainData.player1Score === localData.scores[0] && blockchainData.player2Score === localData.scores[1];
            const roundMatch = blockchainData.round === localData.round;
            
            const localWinnerIndex = localData.scores[0] > localData.scores[1] ? 1 : 2;
            const winnerMatch = blockchainData.winnerIndex === localWinnerIndex;
            
            const player1NameMatch = blockchainData.player1Name === localData.players[0];
            const player2NameMatch = blockchainData.player2Name === localData.players[1];
            const participantsMatch = player1NameMatch && player2NameMatch;
            
            dataMatches = {
              scores_match: scoresMatch,
              winner_match: winnerMatch,
              round_match: roundMatch,
              participants_match: participantsMatch,
              player1_name_match: player1NameMatch,
              player2_name_match: player2NameMatch,
              all_verified: scoresMatch && roundMatch && winnerMatch && participantsMatch
            };
            
            const originalBlockchainData = blockchainData;
            blockchainData = {
              player1Name: originalBlockchainData.player1Name,
              player2Name: originalBlockchainData.player2Name,
              player1Score: originalBlockchainData.player1Score,
              player2Score: originalBlockchainData.player2Score,
              round: originalBlockchainData.round,
              winnerIndex: originalBlockchainData.winnerIndex,
              winner: originalBlockchainData.winnerIndex === 1 ? originalBlockchainData.player1Name : originalBlockchainData.player2Name,
              timestamp: originalBlockchainData.timestamp,
              dataHash: originalBlockchainData.dataHash
            };
              
            console.log(` Correspondance des données: ${dataMatches}`);
          } else {
            console.log(` Match non récupérable depuis le smart contract`);
            blockchainData = null;
            dataMatches = null;
          }
            
        } catch (error) {
          console.error('Erreur lors de la récupération des données blockchain:', error);
          blockchainData = null;
          dataMatches = null;
        }
      } else {
        console.log(` Pas de données blockchain pour ce match (service indisponible ou pas de hash)`);
      }
      
      const explorerUrl = match.blockchain_tx_hash ? 
        `${blockchainService.getNetworkInfo().explorerUrl}/tx/${match.blockchain_tx_hash}` : null;
      
      return reply.send({
        match_id: matchId,
        match_name: `Match Round ${localData.round} - ${localData.players[0]} vs ${localData.players[1]}`,
        tx_hash: match.blockchain_tx_hash,
        blockchain_match_id: match.blockchain_match_id,
        is_stored: !!match.blockchain_tx_hash,
        is_verified: dataMatches?.all_verified || false,
        local_data: {
          ...localData,
          tournament_id: match.tournament_id
        },
        blockchain_data: blockchainData,
        data_matches: dataMatches,
        network_info: {
          ...blockchainService.getNetworkInfo(),
          explorer_url: explorerUrl
        },
        stored_at: match.end_time,
        verification_status: dataMatches?.all_verified ? 'VERIFIED' : (blockchainData ? 'MISMATCH' : 'NOT_STORED')
      });
      
    } catch (error) {
      fastify.log.error(error, 'Error fetching match blockchain info');
      return reply.status(500).send({ error: 'Failed to fetch match blockchain information' });
    }
  });


}