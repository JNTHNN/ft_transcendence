import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { SocketStream } from '@fastify/websocket';
import { gameManager } from './GameManager.js';
import type { PlayerInput } from './types.js';

interface GameMessage {
  type: 'join' | 'input' | 'ping' | 'pause' | 'resume';
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
			
			case 'pause':
				if (!message.matchId) {
					socket.send(JSON.stringify({
					type: 'error',
					message: 'Missing matchId for pause'
					}));
					break;
				}
				
				const gameToPause = gameManager.getGame(message.matchId);
				if (gameToPause) {
					gameToPause.stop();

				}
				break;

			case 'resume':
				if (!message.matchId) {
					socket.send(JSON.stringify({
					type: 'error',
					message: 'Missing matchId for resume'
					}));
					break;
				}
				
				const gameToResume = gameManager.getGame(message.matchId);
				if (gameToResume) {
					gameToResume.start();
				}
				break;

            default:
          }
        } catch (error) {
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
			// Ajouter le joueur Ã  la partie
			const added = gameManager.addPlayerToGame(matchId, {
			id: playerId,
			side,
			controllerType: 'human-ws',
			socket,
			});

			if (!added) {
			socket.send(
				JSON.stringify({
				type: 'error',
				message: 'Failed to join game (already full?)',
				})
			);
			return;
			}

			currentPlayerId = playerId;

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
		if (!message.playerId || !message.matchId || !message.input) {
			return;
		}


		const game = gameManager.getGame(message.matchId);
		if (game) {
			game.setPlayerInput(message.playerId, message.input);  // âœ… message.playerId
		}
		}

      // Gestion de la dÃ©connexion
		function handleDisconnect(playerId: string) {
		
		const game = gameManager.getGameByPlayer(playerId);
		if (!game) {
			return;
		}

		const matchId = game.id;
		const state = game.getState();
		
		// ðŸ§¹ Si la partie n'est pas terminÃ©e, la supprimer immÃ©diatement
		if (state.status !== 'finished') {
			game.stop();
			
			gameManager.removeGame(matchId);
		} else {
			setTimeout(() => {
			gameManager.removeGame(matchId);
			}, 5000);
		}
		
		}
	}
  );
}