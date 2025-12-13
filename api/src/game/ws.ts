import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { SocketStream } from '@fastify/websocket';
import { gameManager } from './GameManager.js';
import type { PlayerInput } from './types.js';

/**
 * Structure des messages WebSocket reçus du client
 */
interface GameMessage {
  type: 'join' | 'input' | 'ping' | 'pause' | 'resume' | 'start' | 'getState';
  matchId?: string;
  playerId?: string;
  side?: 'left' | 'right';
  input?: Partial<PlayerInput>;
}

/**
 * Enregistre le WebSocket pour le jeu
 */
export async function registerGameWS(app: FastifyInstance) {
  
  // ═══════════════════════════════════════════════════════════════
  // WebSocket endpoint : /ws/game
  // ═══════════════════════════════════════════════════════════════
  
  app.get('/ws/game', { websocket: true }, (connection: SocketStream, _request: FastifyRequest) => {
      
      const socket = connection.socket;
      
      // Variable pour tracker le joueur connecté
      let currentPlayerId: string | null = null;
      
      
      // ═════════════════════════════════════════════════════════════
      // ÉVÉNEMENT : Message reçu du client (ecoute en continu)
      // ═════════════════════════════════════════════════════════════
      
      socket.on('message', (rawData: Buffer) => {
        
        try {
          // Parse le message JSON
          const message = JSON.parse(rawData.toString()) as GameMessage;
          
          // Router selon le type de message
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
            
            case 'start':
              handleStart(message);
              break;
            
            case 'getState':
              handleGetState(message);
              break;
            
            case 'pause':
              handlePause(message);
              break;
            
            case 'resume':
              handleResume(message);
              break;
            
            default:
              // Type de message inconnu
              socket.send(JSON.stringify({
                type: 'error',
                message: 'Unknown message type'
              }));
          }
          
        } catch (error) {
          // Erreur de parsing JSON
          socket.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message format',
          }));
        }
      });
      
      
      // ═════════════════════════════════════════════════════════════
      // ÉVÉNEMENT : Déconnexion du client
      // ═════════════════════════════════════════════════════════════
      
      socket.on('close', () => {
        if (currentPlayerId) {
          handleDisconnect(currentPlayerId);
        }
      });
      
      
      // ═════════════════════════════════════════════════════════════
      // HANDLER : JOIN - Rejoindre une partie
      // ═════════════════════════════════════════════════════════════
      
      function handleJoin(message: GameMessage) {
        const { matchId, playerId, side } = message;
        
        // Validation des paramètres requis
        if (!matchId || !playerId || !side) {
          socket.send(JSON.stringify({
            type: 'error',
            message: 'Missing matchId, playerId, or side',
          }));
          return;
        }
        
        try {
          // Récupérer le jeu
          const game = gameManager.getGame(matchId);
          
          if (!game) {
            socket.send(JSON.stringify({
              type: 'error',
              message: 'Game not found',
            }));
            return;
          }
          
          // Déterminer le type de contrôleur selon le mode du jeu
          let controllerType: 'human-ws' | 'human-arrows' | 'local-player2';
          
          if (game.mode === 'local-2p' || game.mode === 'tournament') {
            // Mode local : clavier direct (pas WebSocket)
            controllerType = side === 'left' ? 'human-arrows' : 'local-player2';
          } else {
            // Mode online : WebSocket
            controllerType = 'human-ws';
          }
          
          // Ajouter le joueur à la partie
          const added = gameManager.addPlayerToGame(matchId, {
            id: playerId,
            side,
            controllerType,
            socket,
          });
          
          if (!added) {
            socket.send(JSON.stringify({
              type: 'error',
              message: 'Failed to join game (already full?)',
            }));
            return;
          }
          
          // Sauvegarder l'ID du joueur
          currentPlayerId = playerId;
          
          // Envoyer confirmation au client
          socket.send(JSON.stringify({
            type: 'joined',
            matchId,
            playerId,
            side,
          }));
          
        } catch (error: any) {
          socket.send(JSON.stringify({
            type: 'error',
            message: error.message,
          }));
        }
      }
      
      
      // ═════════════════════════════════════════════════════════════
      // HANDLER : INPUT - Recevoir input clavier du joueur
      // ═════════════════════════════════════════════════════════════
      
      function handleInput(message: GameMessage) {
        const { playerId, matchId, input } = message;
        
        // Validation
        if (!playerId || !matchId || !input) {
          return;
        }
        
        // Récupérer le jeu
        const game = gameManager.getGame(matchId);
        
        if (game) {
          // Mettre à jour l'input du joueur
          game.setPlayerInput(playerId, input);
        }
      }
      
      
      // ═════════════════════════════════════════════════════════════
      // HANDLER : START - Démarrer la partie
      // ═════════════════════════════════════════════════════════════
      
      function handleStart(message: GameMessage) {
        const { matchId } = message;
        
        if (!matchId) {
          socket.send(JSON.stringify({
            type: 'error',
            message: 'Missing matchId for start'
          }));
          return;
        }
        
        const game = gameManager.getGame(matchId);
        
        if (game) {
          game.start();
          console.log(`▶️ Game ${matchId} started by player request`);
        } else {
          console.warn(`⚠️ Game ${matchId} not found for start`);
          socket.send(JSON.stringify({
            type: 'error',
            message: 'Game not found'
          }));
        }
      }
      
      
      // ═════════════════════════════════════════════════════════════
      // HANDLER : GET STATE - Récupérer l'état actuel du jeu
      // ═════════════════════════════════════════════════════════════
      
      function handleGetState(message: GameMessage) {
        const { matchId } = message;
        
        if (!matchId) {
          socket.send(JSON.stringify({
            type: 'error',
            message: 'Missing matchId for getState'
          }));
          return;
        }
        
        const game = gameManager.getGame(matchId);
        
        if (game) {
          const state = game.getState();
          socket.send(JSON.stringify({
            type: 'game/state',
            data: state
          }));
        } else {
          socket.send(JSON.stringify({
            type: 'error',
            message: 'Game not found'
          }));
        }
      }
      
      
      // ═════════════════════════════════════════════════════════════
      // HANDLER : PAUSE - Mettre en pause
      // ═════════════════════════════════════════════════════════════
      
      function handlePause(message: GameMessage) {
        const { matchId } = message;
        
        if (!matchId) {
          socket.send(JSON.stringify({
            type: 'error',
            message: 'Missing matchId for pause'
          }));
          return;
        }
        
        const game = gameManager.getGame(matchId);
        
        if (game) {
          game.stop();
          console.log(`⏸️ Game ${matchId} paused`);
        }
      }
      
      
      // ═════════════════════════════════════════════════════════════
      // HANDLER : RESUME - Reprendre la partie
      // ═════════════════════════════════════════════════════════════
      
      function handleResume(message: GameMessage) {
        const { matchId } = message;
        
        if (!matchId) {
          socket.send(JSON.stringify({
            type: 'error',
            message: 'Missing matchId for resume'
          }));
          return;
        }
        
        const game = gameManager.getGame(matchId);
        
        if (game) {
          game.start();
          console.log(`▶️ Game ${matchId} resumed`);
        }
      }
      
      
      // ═════════════════════════════════════════════════════════════
      // HANDLER : DISCONNECT - Gérer la déconnexion
      // ═════════════════════════════════════════════════════════════
      
      function handleDisconnect(playerId: string) {
        const game = gameManager.getGameByPlayer(playerId);
        
        if (!game) {
          return;
        }
        
        const matchId = game.id;
        const state = game.getState();
        
        // Si la partie n'est pas terminée, la supprimer immédiatement
        if (state.status !== 'finished') {
          console.log(`🔌 Player ${playerId} disconnected, stopping game ${matchId}`);
          game.stop();
          gameManager.removeGame(matchId);
        } else {
          // Si terminée, supprimer immédiatement pour permettre de relancer une nouvelle partie
          console.log(`🔌 Player ${playerId} disconnected from finished game ${matchId}, removing immediately`);
          gameManager.removeGame(matchId);
        }
      }
      
    }
  );
}