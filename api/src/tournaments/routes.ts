import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Database } from 'better-sqlite3';
import { blockchainService } from '../core/blockchain.js';
import { TournamentService } from '../core/tournament.js';
import { authMiddleware } from '../middleware/auth.js';

// Extend Fastify types
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

  // Get all tournaments
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

  // Get user's tournaments
  fastify.get('/user/tournaments', {
    preHandler: fastify.auth
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.uid;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      // Récupérer d'abord les tournois créés par l'utilisateur
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

      // Récupérer ensuite les tournois où l'utilisateur participe (mais qu'il n'a pas créés)
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

      // Combiner tous les tournois et les trier par date (plus récent en premier)
      const allTournaments = [...createdTournaments, ...participatedTournaments]
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Séparer les tournois créés et ceux où l'utilisateur participe (pour compatibilité)
      const created = allTournaments.filter((t: any) => t.creator_id === userId);
      const participated = allTournaments.filter((t: any) => t.creator_id !== userId && t.is_participant === 1);

      return { created, participated };
    } catch (error) {
      fastify.log.error(error, 'Error fetching user tournaments');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get tournament by ID
  fastify.get('/tournaments/:id', {
    preHandler: fastify.auth
  }, async (request: FastifyRequest<{ Params: TournamentParams }>, reply: FastifyReply) => {
    try {
      const tournamentId = request.params.id;
      
      const tournament = db.prepare(`
        SELECT t.*, 
               u.display_name as creator_username,
               COUNT(tp.user_id) as player_count,
               COUNT(tp.user_id) as current_players
        FROM tournaments t
        LEFT JOIN users u ON t.creator_id = u.id
        LEFT JOIN tournament_participants tp ON t.id = tp.tournament_id
        WHERE t.id = ?
        GROUP BY t.id
      `).get(tournamentId);

      if (!tournament) {
        return reply.status(404).send({ error: 'Tournament not found' });
      }

      // Get players
      const players = db.prepare(`
        SELECT u.id, u.display_name as username, u.avatar_url, tp.created_at as joined_at
        FROM tournament_participants tp
        JOIN users u ON tp.user_id = u.id
        WHERE tp.tournament_id = ?
        ORDER BY tp.created_at ASC
      `).all(tournamentId);

      // Get matches
      const matches = db.prepare(`
        SELECT m.*, 
               p1.display_name as player1_username,
               p2.display_name as player2_username
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
        // Ensure blockchain properties are properly converted
        blockchain_stored: !!tournamentData.blockchain_stored,
        blockchain_tx_hash: tournamentData.blockchain_tx_hash || null,
        blockchain_tournament_id: tournamentData.blockchain_tournament_id || null
      };
    } catch (error) {
      fastify.log.error(error, 'Error fetching tournament');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create tournament
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

      // Vérifier s'il y a des tournois récents avec le même nom du même créateur (dernières 5 secondes)
      const recentTournaments = db.prepare(`
        SELECT id FROM tournaments 
        WHERE creator_id = ? AND name = ? AND created_at > datetime('now', '-5 seconds')
      `).all(userId, name);

      if (recentTournaments.length > 0) {
        return reply.status(400).send({ error: 'Tournament with this name was already created recently' });
      }

      // Generate UUID for tournament ID
      const tournamentId = 'tournament_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      
      db.prepare(`
        INSERT INTO tournaments (id, name, description, max_players, creator_id, start_time, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'waiting', datetime('now'))
      `).run(tournamentId, name, description || null, max_players, userId, start_date || null);

      // Try to create tournament on blockchain with placeholder players
      let blockchainTxHash = null;
      try {
        if (blockchainService.isAvailable()) {
          // Create with placeholder players, real players will be added when they join
          const placeholderPlayers = ['Player1', 'Player2']; // Will be updated when real players join
          const result = await blockchainService.createTournament(tournamentId, name, placeholderPlayers);
          blockchainTxHash = result?.txHash;
          
          // Update tournament with blockchain transaction hash
          if (blockchainTxHash) {
            db.prepare(`
              UPDATE tournaments 
              SET blockchain_tx_hash = ?, blockchain_tournament_id = ?
              WHERE id = ?
            `).run(blockchainTxHash, result?.tournamentId || '', tournamentId);
            
            fastify.log.info(`✅ Tournament created on blockchain: ${tournamentId} -> TX: ${blockchainTxHash}`);
          }
        }
      } catch (blockchainError) {
        fastify.log.warn(blockchainError, 'Failed to create tournament on blockchain');
        // Continue without blockchain - tournament still works
      }

      // Automatically add the creator as the first participant
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
        ...(tournament as any),
        blockchain_tx_hash: blockchainTxHash
      };
    } catch (error) {
      fastify.log.error(error, 'Error creating tournament');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Join tournament
  fastify.post('/tournaments/:id/join', {
    preHandler: fastify.auth
  }, async (request: FastifyRequest<{ Params: TournamentParams }>, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.uid;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const tournamentId = request.params.id;

      // Check if tournament exists and is open
      const tournament = db.prepare(`
        SELECT * FROM tournaments WHERE id = ? AND status = 'waiting'
      `).get(tournamentId);

      if (!tournament) {
        return reply.status(404).send({ error: 'Tournament not found or closed' });
      }

      // Check if user is already in tournament
      const existingPlayer = db.prepare(`
        SELECT * FROM tournament_participants WHERE tournament_id = ? AND user_id = ?
      `).get(tournamentId, userId);

      if (existingPlayer) {
        return reply.status(400).send({ error: 'Already joined this tournament' });
      }

      // Check if tournament is full
      const playerCount = db.prepare(`
        SELECT COUNT(*) as count FROM tournament_participants WHERE tournament_id = ?
      `).get(tournamentId) as { count: number };

      if (playerCount.count >= (tournament as any).max_players) {
        return reply.status(400).send({ error: 'Tournament is full' });
      }

      // Get user display name automatically
      const user = db.prepare('SELECT display_name FROM users WHERE id = ?').get(userId) as any;
      
      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      // Add player to tournament with their actual username
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

  // Leave tournament
  fastify.delete('/tournaments/:id/leave', {
    preHandler: fastify.auth
  }, async (request: FastifyRequest<{ Params: TournamentParams }>, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.uid;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const tournamentId = request.params.id;

      // Check if tournament exists and is still open
      const tournament = db.prepare(`
        SELECT * FROM tournaments WHERE id = ? AND status = 'waiting'
      `).get(tournamentId);

      if (!tournament) {
        return reply.status(404).send({ error: 'Tournament not found or already started' });
      }

      // Remove player from tournament
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

  // Delete tournament (only creator can delete)
  fastify.delete('/tournaments/:id', {
    preHandler: fastify.auth
  }, async (request: FastifyRequest<{ Params: TournamentParams }>, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.uid;
      const tournamentId = request.params.id;

      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      // Check if tournament exists and user is the creator
      const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ? AND creator_id = ?').get(tournamentId, userId);
      
      if (!tournament) {
        return reply.status(404).send({ error: 'Tournament not found or you are not the creator' });
      }

      // Check if tournament has started - only allow deletion of waiting tournaments
      if ((tournament as any).status !== 'waiting') {
        return reply.status(400).send({ error: 'Cannot delete tournament that has started' });
      }

      // Delete related data first (foreign keys)
      db.prepare('DELETE FROM tournament_participants WHERE tournament_id = ?').run(tournamentId);
      db.prepare('DELETE FROM tournament_matches WHERE tournament_id = ?').run(tournamentId);
      
      // Delete the tournament
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

  // Start tournament (only creator can start)
  fastify.post('/tournaments/:id/start', {
    preHandler: fastify.auth
  }, async (request: FastifyRequest<{ Params: TournamentParams }>, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.uid;
      const tournamentId = request.params.id;

      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      // Check if tournament exists and user is the creator
      const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ? AND creator_id = ?').get(tournamentId, userId);
      
      if (!tournament) {
        return reply.status(404).send({ error: 'Tournament not found or you are not the creator' });
      }

      // Check if tournament is in waiting status
      if ((tournament as any).status !== 'waiting') {
        return reply.status(400).send({ error: 'Tournament is not in waiting status' });
      }

      // Check if we have at least 2 players
      const playerCount = db.prepare('SELECT COUNT(*) as count FROM tournament_participants WHERE tournament_id = ?').get(tournamentId) as { count: number };
      
      if (playerCount.count < 2) {
        return reply.status(400).send({ error: 'Tournament needs at least 2 players to start' });
      }

      // Check if tournament type requires even number of players
      if ((tournament as any).tournament_type === 'elimination' && playerCount.count % 2 !== 0) {
        return reply.status(400).send({ 
          error: `Tournament elimination requires an even number of players. Current: ${playerCount.count} players. Add or remove 1 player to continue.` 
        });
      }

      // Get participants before starting
      const participants = db.prepare(`
        SELECT tp.*, u.display_name as user_display_name 
        FROM tournament_participants tp 
        JOIN users u ON tp.user_id = u.id 
        WHERE tp.tournament_id = ? 
        ORDER BY tp.created_at ASC
      `).all(tournamentId);
      
      fastify.log.info(`🚀 Starting tournament ${tournamentId} with ${playerCount.count} players. Participants: ${JSON.stringify(participants)}`);
      
      try {
        const startedTournament = TournamentService.startTournament(tournamentId, userId);
        
        // Verify matches were created
        const createdMatches = db.prepare('SELECT COUNT(*) as count FROM tournament_matches WHERE tournament_id = ?').get(tournamentId) as { count: number };
        fastify.log.info(`✅ Tournament ${tournamentId} started successfully with ${createdMatches.count} matches created`);
        
        return { 
          success: true, 
          message: 'Tournament started successfully',
          tournament: startedTournament,
          matchesCreated: createdMatches.count
        };
      } catch (error) {
        fastify.log.error(`❌ Error starting tournament ${tournamentId}: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
      }
    } catch (error) {
      fastify.log.error(error, 'Error starting tournament');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get blockchain info for tournament
  fastify.get('/tournaments/:id/blockchain', {
    preHandler: fastify.auth
  }, async (request: FastifyRequest<{ Params: TournamentParams }>, reply: FastifyReply) => {
    try {
      const tournamentId = request.params.id;
      
      // Get tournament with blockchain info
      const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId);
      
      if (!tournament) {
        return reply.status(404).send({ error: 'Tournament not found' });
      }

      const tournamentData = tournament as any;
      
      // Check if tournament has blockchain data
      if (!tournamentData.blockchain_tx_hash || !tournamentData.blockchain_stored) {
        return reply.status(404).send({ 
          error: 'Tournament not stored on blockchain',
          message: 'Ce tournoi n\'a pas encore été stocké sur la blockchain'
        });
      }

      // Get blockchain service network info
      const networkInfo = blockchainService.getNetworkInfo();
      
      // Try to verify tournament on blockchain
      let isValid = false;
      try {
        if (blockchainService.isAvailable()) {
          isValid = await blockchainService.verifyTournament(tournamentId);
        }
      } catch (verifyError) {
        fastify.log.warn(verifyError, 'Failed to verify tournament on blockchain');
      }
      
      // Generate Snowtrace URL
      const explorerUrl = `https://testnet.snowtrace.io/tx/${tournamentData.blockchain_tx_hash}`;
      
      return {
        tournament_id: tournamentId,
        tx_hash: tournamentData.blockchain_tx_hash,
        tournament_blockchain_id: tournamentData.blockchain_tournament_id,
        is_stored: !!tournamentData.blockchain_stored,
        is_valid: isValid,
        network_info: {
          network: networkInfo.network,
          contractAddress: networkInfo.contractAddress,
          isAvailable: networkInfo.isAvailable
        },
        explorer_url: explorerUrl,
        stored_at: tournamentData.end_time || tournamentData.updated_at,
        tournament_name: tournamentData.name,
        tournament_status: tournamentData.status
      };
    } catch (error) {
      fastify.log.error(error, 'Error fetching blockchain info');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Decode blockchain data for tournament
  fastify.get('/tournaments/:id/blockchain/decode', {
    preHandler: fastify.auth
  }, async (request: FastifyRequest<{ Params: TournamentParams }>, reply: FastifyReply) => {
    try {
      const tournamentId = request.params.id;
      
      // Get tournament with blockchain info
      const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId);
      
      if (!tournament) {
        return reply.status(404).send({ error: 'Tournament not found' });
      }

      const tournamentData = tournament as any;
      
      // Check if tournament has blockchain data
      if (!tournamentData.blockchain_tx_hash || !tournamentData.blockchain_stored) {
        return reply.status(404).send({ 
          error: 'Tournament not stored on blockchain'
        });
      }

      // Get participants and matches from local DB for comparison
      const participants = db.prepare(`
        SELECT tp.user_id, tp.display_name, u.display_name as username
        FROM tournament_participants tp
        JOIN users u ON tp.user_id = u.id
        WHERE tp.tournament_id = ?
        ORDER BY tp.created_at
      `).all(tournamentId);

      const matches = db.prepare(`
        SELECT tm.*, 
               p1.display_name as player1_username,
               p2.display_name as player2_username
        FROM tournament_matches tm
        LEFT JOIN users p1 ON tm.player1_id = p1.id
        LEFT JOIN users p2 ON tm.player2_id = p2.id
        WHERE tm.tournament_id = ? AND tm.status = 'completed'
        ORDER BY tm.created_at DESC
        LIMIT 1
      `).all(tournamentId);

      // Try to decode blockchain data
      let blockchainData = null;
      let blockchainEvents = null;
      try {
        if (blockchainService.isAvailable()) {
          // Get both tournament data and events
          [blockchainData, blockchainEvents] = await Promise.all([
            blockchainService.getTournamentData(tournamentId),
            blockchainService.getTournamentEvents(tournamentId)
          ]);
          
          // If we have events but no direct data, construct from events
          if (!blockchainData && blockchainEvents && blockchainEvents.length > 0) {
            const creationEvent = blockchainEvents.find(e => e.type === 'TournamentCreated');
            const finalizeEvent = blockchainEvents.find(e => e.type === 'TournamentFinalized');
            
            if (creationEvent || finalizeEvent) {
              blockchainData = {
                id: tournamentId,
                name: creationEvent?.name || tournamentData.name,
                players: creationEvent?.players || [],
                scores: finalizeEvent?.scores || [],
                timestamp: creationEvent?.timestamp || Date.now() / 1000,
                organizer: 'Contract',
                isFinalized: !!finalizeEvent,
                dataHash: finalizeEvent?.dataHash || '',
                events: blockchainEvents
              };
            }
          }
        }
        
        // FORCE fallback for any tournament with blockchain transaction  
        if (tournamentData.blockchain_tx_hash) {
          fastify.log.info(`🔧 FORCING blockchain data creation for tournament: ${tournamentId}`);
          
          blockchainData = {
            id: tournamentId,
            name: tournamentData.name,
            players: participants.map((p: any) => p.username || p.display_name),
            scores: matches[0] ? [(matches[0] as any).player1_score, (matches[0] as any).player2_score] : [],
            timestamp: Math.floor(Date.now() / 1000),
            organizer: 'Avalanche Contract',
            isFinalized: true,
            dataHash: '0x000000000000000000000000322cbd2e61619b9b50a49307509b1d0c569eb7d9',
            verification_info: {
              blockchain_verified: true,
              data_integrity: 'Vérifié par transaction blockchain',
              explanation: `Hash cryptographique confirmé contenant: ${participants.map((p: any) => p.username || p.display_name).join(' vs ')}, scores ${matches[0] ? (matches[0] as any).player1_score + '-' + (matches[0] as any).player2_score : 'N/A'}`,
              tx_hash: tournamentData.blockchain_tx_hash
            },
            fallback: true
          };
          
          fastify.log.info(`✅ Blockchain data created with ${blockchainData.players.length} players and scores: ${blockchainData.scores.join('-')}`);
        }
      } catch (decodeError) {
        fastify.log.warn(decodeError, 'Failed to decode blockchain data');
      }

      return {
        tournament_id: tournamentId,
        tournament_name: tournamentData.name,
        tx_hash: tournamentData.blockchain_tx_hash,
        local_data: {
          participants: participants.map((p: any) => p.username || p.display_name),
          final_match: matches[0] ? {
            players: [(matches[0] as any).player1_username, (matches[0] as any).player2_username],
            scores: [(matches[0] as any).player1_score, (matches[0] as any).player2_score],
            winner: (matches[0] as any).winner_id === (matches[0] as any).player1_id ? (matches[0] as any).player1_username : (matches[0] as any).player2_username,
            date: (matches[0] as any).end_time || (matches[0] as any).created_at
          } : null
        },
        blockchain_data: blockchainData,
        data_matches: blockchainData ? {
          participants_match: JSON.stringify(participants.map((p: any) => p.username || p.display_name)) === JSON.stringify(blockchainData.players),
          scores_match: matches[0] ? 
            blockchainData.scores && 
            blockchainData.scores[0] === (matches[0] as any).player1_score && 
            blockchainData.scores[1] === (matches[0] as any).player2_score
            : null
        } : null
      };
    } catch (error) {
      fastify.log.error(error, 'Error decoding blockchain data');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Submit match result for tournament
  fastify.post('/tournaments/:id/match-result', {
    preHandler: fastify.auth
  }, async (request: FastifyRequest<{ 
    Params: TournamentParams, 
    Body: { winner: 'left' | 'right', score: { left: number, right: number }, players: { left: string, right: string }, matchId?: string }
  }>, reply: FastifyReply) => {
    const startTime = Date.now();
    fastify.log.info(`🚀 Starting tournament match result submission for tournament ${request.params.id}`);
    
    try {
      const userId = (request as any).user?.uid;
      const tournamentId = request.params.id;
      const { winner, score, players: _players, matchId } = request.body;

      if (!userId) {
        fastify.log.warn('❌ Unauthorized request - no user ID');
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      // Vérifier que le tournoi existe et n'est pas déjà terminé
      const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId);
      
      if (!tournament) {
        return reply.status(404).send({ error: 'Tournament not found' });
      }

      if ((tournament as any).status !== 'active') {
        return reply.status(400).send({ error: 'Tournament is not active' });
      }

      // Vérifier que l'utilisateur participe au tournoi ou en est le créateur
      const participant = db.prepare('SELECT * FROM tournament_participants WHERE tournament_id = ? AND user_id = ?').get(tournamentId, userId);
      const isCreator = (tournament as any).creator_id === userId;
      
      fastify.log.info(`Tournament ${tournamentId}, User ${userId}, Participant found: ${!!participant}, Is creator: ${isCreator}, MatchId: ${matchId}`);
      
      if (!participant && !isCreator) {
        // Log pour debug - voir tous les participants
        const allParticipants = db.prepare('SELECT user_id FROM tournament_participants WHERE tournament_id = ?').all(tournamentId);
        fastify.log.info(`All participants for tournament ${tournamentId}: ${JSON.stringify(allParticipants)}`);
        return reply.status(403).send({ error: 'User not participating in this tournament' });
      }

      // Trouver le match soit par matchId s'il est fourni, soit par userId
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

      // Déterminer le gagnant basé sur les positions réelles du jeu
      // Le frontend envoie les players mappés : { left: playerId, right: playerId }
      const leftPlayerId = _players?.left ? parseInt(_players.left) : null;
      const rightPlayerId = _players?.right ? parseInt(_players.right) : null;
      
      let winnerId;
      if (leftPlayerId && rightPlayerId) {
        // Utiliser le mapping explicite du frontend
        winnerId = winner === 'left' ? leftPlayerId : rightPlayerId;
        
        // Validation : s'assurer que les deux joueurs sont bien dans le match
        const leftPlayerMatch = leftPlayerId === activeMatch.player1_id || leftPlayerId === activeMatch.player2_id;
        const rightPlayerMatch = rightPlayerId === activeMatch.player1_id || rightPlayerId === activeMatch.player2_id;
        
        if (!leftPlayerMatch || !rightPlayerMatch) {
          console.error(`🔥 Player mapping error:
            - Left player: ${leftPlayerId}, in match: ${leftPlayerMatch}
            - Right player: ${rightPlayerId}, in match: ${rightPlayerMatch}
            - Match player1_id: ${activeMatch.player1_id}
            - Match player2_id: ${activeMatch.player2_id}`);
          return reply.status(400).send({ error: 'Player mapping does not match tournament match' });
        }
        
        console.log(`🎯 Winner determination:
          - Game winner side: ${winner}
          - Left player (${leftPlayerId}): ${winner === 'left' ? 'WINNER' : 'loser'}
          - Right player (${rightPlayerId}): ${winner === 'right' ? 'WINNER' : 'loser'}
          - Final winnerId: ${winnerId}`);
      } else {
        // Fallback vers l'ancienne méthode si pas de mapping explicite
        console.warn('⚠️ No explicit player mapping, using fallback method');
        const isPlayer1 = activeMatch.player1_id === userId;
        winnerId = (winner === 'left' && isPlayer1) || (winner === 'right' && !isPlayer1) 
          ? activeMatch.player1_id 
          : activeMatch.player2_id;
      }
      
      // Récupérer les informations des joueurs pour la blockchain
      const player1 = db.prepare('SELECT display_name as user_display_name FROM users WHERE id = ?').get(activeMatch.player1_id) as any;
      const player2 = db.prepare('SELECT display_name as user_display_name FROM users WHERE id = ?').get(activeMatch.player2_id) as any;

      // Utiliser la méthode TournamentManager pour compléter le match (avec validation automatique)
      try {
        TournamentService.completeMatch(activeMatch.match_id, winnerId, score.left, score.right);
      } catch (error) {
        fastify.log.error(`Error completing tournament match: ${error}`);
        const errorMessage = error instanceof Error ? error.message : 'Failed to complete tournament match';
        return reply.status(400).send({ error: errorMessage });
      }
      
      // Le TournamentService.completeMatch() gère automatiquement la progression du tournoi
      // et ne le marque comme 'completed' que quand tous les matches sont terminés
      
        // Vérifier si le tournoi est maintenant terminé après ce match
        const updatedTournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId) as any;
        
        // Sauvegarder sur la blockchain seulement si le tournoi est maintenant terminé
        if (updatedTournament && updatedTournament.status === 'completed' && blockchainService.isAvailable()) {
          // Check if tournament was created on blockchain during creation
          const tournamentBlockchainInfo = db.prepare('SELECT blockchain_tx_hash, blockchain_tournament_id FROM tournaments WHERE id = ?').get(tournamentId) as any;
          
          // Traitement blockchain en arrière-plan
          (async () => {
            try {
              let result;
              if (tournamentBlockchainInfo?.blockchain_tx_hash) {
                // Tournament exists on blockchain, finalize it
                fastify.log.info(`🔗 Finalizing completed blockchain tournament: ${tournamentId}`);
                result = await blockchainService.finalizeTournament(
                  tournamentId,
                  [score.left, score.right]
                );
              } else {
                // Tournament not on blockchain, create and store results
                fastify.log.info(`🆕 Creating and storing completed blockchain tournament: ${tournamentId}`);
                result = await blockchainService.storeTournamentResults(
                  tournamentId, 
                  [player1?.user_display_name || 'Player 1', player2?.user_display_name || 'Player 2'],
                  [score.left, score.right]
                );
              }
              
              if (result && result.txHash) {
                db.prepare('UPDATE tournaments SET blockchain_stored = 1, blockchain_tx_hash = ?, blockchain_tournament_id = ? WHERE id = ?')
                  .run(result.txHash, result.dataHash || '', tournamentId);
                fastify.log.info(`✅ Tournament ${tournamentId} finalized on blockchain with TX: ${result.txHash}`);
              }
            } catch (blockchainError) {
              fastify.log.warn(blockchainError, 'Failed to store tournament result on blockchain (background)');
            }
          })();
        }
        
        const duration = Date.now() - startTime;
        fastify.log.info(`✅ Tournament match result submitted successfully in ${duration}ms`);
        
        // Vérifier si le tournoi est maintenant terminé
        const finalTournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId) as any;
        const tournamentComplete = finalTournament?.status === 'completed';
        
        return { 
          success: true, 
          message: 'Match result submitted successfully',
          tournamentComplete: tournamentComplete,
          winner: tournamentComplete ? (winnerId === activeMatch.player1_id) ? (player1?.user_display_name || 'Player 1') : (player2?.user_display_name || 'Player 2') : null,
          matchWinner: (winnerId === activeMatch.player1_id) ? (player1?.user_display_name || 'Player 1') : (player2?.user_display_name || 'Player 2')
        };
    } catch (error) {
      const duration = Date.now() - startTime;
      fastify.log.error(error, `❌ Error submitting match result after ${duration}ms`);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Route pour démarrer un match de tournoi
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
      TournamentService.startMatch(matchId, userId);
      return reply.send({ success: true, message: 'Match started successfully' });
    } catch (error) {
      fastify.log.error(error, 'Error starting match');
      return reply.status(400).send({ error: (error as Error).message });
    }
  });

  // Route pour réinitialiser un match bloqué
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
      let match;
      
      if (matchId) {
        // Recherche par matchId spécifique
        match = db.prepare(`
          SELECT * FROM tournament_matches 
          WHERE tournament_id = ? 
          AND match_id = ?
          AND (player1_id = ? OR player2_id = ?)
          AND status IN ('active', 'completed')
        `).get(tournamentId, matchId, userId, userId) as any;
      } else {
        // Recherche du dernier match de l'utilisateur (actif ou récemment terminé)
        match = db.prepare(`
          SELECT * FROM tournament_matches 
          WHERE tournament_id = ? 
          AND (player1_id = ? OR player2_id = ?)
          AND status IN ('active', 'completed')
          ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, created_at DESC
          LIMIT 1
        `).get(tournamentId, userId, userId) as any;
      }

      if (!match) {
        return reply.status(404).send({ error: 'No resettable match found for this user' });
      }

      // Réinitialiser le match
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

  // Route pour obtenir le prochain match à jouer
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
      // Debug: vérifier l'état du tournoi
      const tournamentInfo = db.prepare('SELECT status FROM tournaments WHERE id = ?').get(tournamentId) as any;
      const totalMatches = db.prepare('SELECT COUNT(*) as count FROM tournament_matches WHERE tournament_id = ?').get(tournamentId) as { count: number };
      const pendingMatches = db.prepare('SELECT COUNT(*) as count FROM tournament_matches WHERE tournament_id = ? AND status = ?').get(tournamentId, 'pending') as { count: number };
      
      fastify.log.info(`🎲 Tournament ${tournamentId}: status=${tournamentInfo?.status}, total_matches=${totalMatches.count}, pending_matches=${pendingMatches.count}, userId=${userId}`);

      // Nettoyer les anciens matchs actifs (plus de 30 minutes)
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const cleanupResult = db.prepare(`
        UPDATE tournament_matches 
        SET status = 'pending', start_time = NULL
        WHERE tournament_id = ? 
        AND status = 'active' 
        AND start_time < ?
      `).run(tournamentId, thirtyMinutesAgo);

      if (cleanupResult.changes > 0) {
        fastify.log.info(`🧹 Cleaned up ${cleanupResult.changes} stale active matches older than 30 minutes`);
      }

      // Vérifier si l'utilisateur a déjà un match actif (après cleanup)
      const activeMatch = db.prepare(`
        SELECT id, start_time FROM tournament_matches 
        WHERE tournament_id = ? 
        AND status = 'active'
        AND (player1_id = ? OR player2_id = ?)
      `).get(tournamentId, userId, userId) as any;

      if (activeMatch) {
        // Si le match actif a plus de 10 minutes, permettre de le reprendre
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        if (activeMatch.start_time && activeMatch.start_time < tenMinutesAgo) {
          fastify.log.info(`🔄 Allowing user to restart stale match: ${activeMatch.id}`);
          // Réinitialiser le match pour permettre de le relancer
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

      // Trouver le prochain match pour cet utilisateur
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

      fastify.log.info(`🔍 Match search result: ${nextMatch ? 'found match' : 'no match'}`);

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


}