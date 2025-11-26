// import type { FastifyInstance, FastifyRequest } from "fastify";
// import "@fastify/websocket";

// const room = new Set<any>();

// export async function registerGameWS(app: FastifyInstance) {
//   app.get("/ws/game", { websocket: true }, (conn: any, _req: FastifyRequest) => {
//     room.add(conn);
//     conn.socket.on("close", () => room.delete(conn));
//   });

//   setInterval(() => {
//     const msg = JSON.stringify({
//       type: "game/state",
//       v: 1,
//       data: {
//         matchId: "m1",
//         ball: { x: Math.random(), y: Math.random(), vx: 0.1, vy: 0.1 },
//         paddles: { A: 0.5, B: 0.5 },
//         score: { A: 0, B: 0 },
//         t: Date.now()
//       }
//     });
//     for (const c of room) c.socket.send(msg);
//   }, 1000);
// }

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
      console.log('🔌 WebSocket connecté');

      let currentPlayerId: string | null = null;

      // Message reçu du client
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

	  

      // Déconnexion
      socket.on('close', () => {
        console.log('🔌 WebSocket déconnecté');
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
			console.log(`👤 Player ${playerId} attempting to join ${matchId} as ${side}`);
			// Ajouter le joueur à la partie
			const added = gameManager.addPlayerToGame(matchId, {
			id: playerId,
			side,
			controllerType: 'human-ws',
			socket,
			});

			if (!added) {
			console.error(`❌ Failed to add player ${playerId}`);
			socket.send(
				JSON.stringify({
				type: 'error',
				message: 'Failed to join game (already full?)',
				})
			);
			return;
			}

			currentPlayerId = playerId;
			console.log(`✅ Player ${playerId} joined ${matchId} as ${side}`);

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
			console.error(`❌ Error joining: ${error.message}`);
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
		// ✅ Utilise message.playerId au lieu de currentPlayerId !
		if (!message.playerId || !message.matchId || !message.input) {
			console.warn(`⚠️ INPUT REJECTED:`, { 
			playerId: message.playerId, 
			matchId: message.matchId, 
			hasInput: !!message.input 
			});
			return;
		}

		console.log(`🟢 INPUT RECEIVED from ${message.playerId}:`, message.input);  // ✅ message.playerId

		const game = gameManager.getGame(message.matchId);
		if (game) {
			game.setPlayerInput(message.playerId, message.input);  // ✅ message.playerId
		} else {
			console.warn(`⚠️ GAME NOT FOUND: ${message.matchId}`);
		}
		}

      // Gestion de la déconnexion
		function handleDisconnect(playerId: string) {
		const game = gameManager.getGameByPlayer(playerId);
		if (!game) {
			console.log(`⚠️ No game found for disconnected player ${playerId}`);
			return;
		}

		console.log(`🔌 Player ${playerId} disconnected from game ${game.id}`);
		
		const state = game.getState();
		
		// 🧹 Si la partie n'est pas terminée, la supprimer immédiatement
		if (state.status !== 'finished') {
			console.log(`🧹 Game ${game.id} not finished, cleaning up immediately`);
			
			// Arrêter le jeu
			game.stop();
			
			// Supprimer la partie tout de suite (pas de délai)
			gameManager.removeGame(game.id);
			console.log(`✅ Game ${game.id} removed`);
		} else {
			// Si déjà terminée, nettoyer après 5 secondes
			console.log(`⏱️ Game ${game.id} already finished, delayed cleanup`);
			setTimeout(() => {
			gameManager.removeGame(game.id);
			console.log(`🧹 Game ${game.id} cleaned up after end`);
			}, 5000);
		}
		}
	}
  );
}