import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { SocketStream } from '@fastify/websocket';
import { gameManager } from './GameManager.js';
import type { PlayerInput } from './types.js';

interface GameMessage {
  type: 'join' | 'input' | 'ping';
  matchId?: string;
  playerId?: string;
  side?: 'left' | 'right';
  input?: Partial<PlayerInput>;
}

/**
 * Enregistre le WebSocket pour le jeu
 */
export async function registerGameWS(app: FastifyInstance) {
  app.get(
    '/ws/game',
    { websocket: true },
    (connection: SocketStream, request: FastifyRequest) => {
      const socket = connection.socket;
      console.log('ðŸ”Œ WebSocket connectÃ©');

      let currentPlayerId: string | null = null;

      // Message reÃ§u du client
      socket.on('message', (rawData: Buffer) => {
        try {
          const message = JSON.parse(rawData.toString()) as GameMessage;

          switch (message.type) {
            case 'join':
              handleJoin(message);
              break;

            case 'input':
              handleInput(message);
              break;

            case 'ping':
              socket.send(JSON.stringify({ type: 'pong' }));
              break;

            default:
              console.warn('Unknown message type:', message);
          }
        } catch (error) {
          console.error('WebSocket message error:', error);
          socket.send(
            JSON.stringify({
              type: 'error',
              message: 'Invalid message format',
            })
          );
        }
      });

	  

      // DÃ©connexion
      socket.on('close', () => {
        console.log('ðŸ”Œ WebSocket dÃ©connectÃ©');
        if (currentPlayerId) {
          handleDisconnect(currentPlayerId);
        }
      });

      // Gestion de la connexion
      function handleJoin(message: GameMessage) {
        const { matchId, playerId, side } = message;

        if (!matchId || !playerId || !side) {
          socket.send(
            JSON.stringify({
              type: 'error',
              message: 'Missing matchId, playerId, or side',
            })
          );
          return;
        }

        try {
			console.log(`ðŸ‘¤ Player ${playerId} attempting to join ${matchId} as ${side}`);
			// Ajouter le joueur Ã  la partie
			const added = gameManager.addPlayerToGame(matchId, {
			id: playerId,
			side,
			controllerType: 'human-ws',
			socket,
			});

			if (!added) {
			console.error(`âŒ Failed to add player ${playerId}`);
			socket.send(
				JSON.stringify({
				type: 'error',
				message: 'Failed to join game (already full?)',
				})
			);
			return;
			}

			currentPlayerId = playerId;
			console.log(`âœ… Player ${playerId} joined ${matchId} as ${side}`);

			// Confirmation
			socket.send(
			JSON.stringify({
				type: 'joined',
				matchId,
				playerId,
				side,
			})
			);
		} catch (error: any) {
			console.error(`âŒ Error joining: ${error.message}`);
			socket.send(
			JSON.stringify({
				type: 'error',
				message: error.message,
			})
			);
		}
      }

      // Gestion des inputs
		function handleInput(message: GameMessage) {
		// âœ… Utilise message.playerId au lieu de currentPlayerId !
		if (!message.playerId || !message.matchId || !message.input) {
			console.warn(`âš ï¸ INPUT REJECTED:`, { 
			playerId: message.playerId, 
			matchId: message.matchId, 
			hasInput: !!message.input 
			});
			return;
		}

		console.log(`ðŸŸ¢ INPUT RECEIVED from ${message.playerId}:`, message.input);  // âœ… message.playerId

		const game = gameManager.getGame(message.matchId);
		if (game) {
			game.setPlayerInput(message.playerId, message.input);  // âœ… message.playerId
		} else {
			console.warn(`âš ï¸ GAME NOT FOUND: ${message.matchId}`);
		}
		}

      // Gestion de la dÃ©connexion
		function handleDisconnect(playerId: string) {
		console.log(`ðŸ”Œ ===== DISCONNECT START ===== Player: ${playerId}`);
		
		const game = gameManager.getGameByPlayer(playerId);
		if (!game) {
			console.log(`âŒ No game found for disconnected player ${playerId}`);
			return;
		}

		const matchId = game.id;
		const state = game.getState();
		
		console.log(`ðŸ“Š Game ${matchId} state:`, {
			status: state.status,
			score: `${state.score.left}-${state.score.right}`,
			isRunning: game.isActive(),
		});
		
		// ðŸ§¹ Si la partie n'est pas terminÃ©e, la supprimer immÃ©diatement
		if (state.status !== 'finished') {
			console.log(`ðŸ§¹ Game ${matchId} NOT FINISHED - Cleaning up immediately`);
			console.log(`â¹ï¸ Stopping game ${matchId}...`);
			game.stop();
			
			console.log(`ðŸ—‘ï¸ Removing game ${matchId} from manager...`);
			gameManager.removeGame(matchId);
			console.log(`âœ… Game ${matchId} REMOVED`);
		} else {
			console.log(`â° Game ${matchId} ALREADY FINISHED - Delayed cleanup`);
			setTimeout(() => {
			console.log(`ðŸ§¹ Delayed cleanup executing for ${matchId}`);
			gameManager.removeGame(matchId);
			}, 5000);
		}
		
		console.log(`ðŸ”Œ ===== DISCONNECT END =====`);
		}
	}
  );
}