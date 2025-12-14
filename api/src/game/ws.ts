import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { SocketStream } from '@fastify/websocket';
import { gameManager } from './GameManager.js';
import type { PlayerInput } from './types.js';


interface GameMessage {
  type: 'join' | 'input' | 'ping' | 'pause' | 'resume' | 'start' | 'getState';
  matchId?: string;
  playerId?: string;
  side?: 'left' | 'right';
  input?: Partial<PlayerInput>;
}

export async function registerGameWS(app: FastifyInstance) {

  app.get('/ws/game', { websocket: true }, (connection: SocketStream, _request: FastifyRequest) => {
      
      const socket = connection.socket;
      
      let currentPlayerId: string | null = null;

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
              socket.send(JSON.stringify({
                type: 'error',
                message: 'Unknown message type'
              }));
          }
          
        } catch (error) {
          socket.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message format',
          }));
        }
      });
      

      socket.on('close', () => {
        if (currentPlayerId) {
          handleDisconnect(currentPlayerId);
        }
      });
      

      function handleJoin(message: GameMessage) {
        const { matchId, playerId, side } = message;
        
        if (!matchId || !playerId || !side) {
          socket.send(JSON.stringify({
            type: 'error',
            message: 'Missing matchId, playerId, or side',
          }));
          return;
        }
        
        try {
          const game = gameManager.getGame(matchId);
          
          if (!game) {
            socket.send(JSON.stringify({
              type: 'error',
              message: 'Game not found',
            }));
            return;
          }
          
          let controllerType: 'human-ws' | 'human-arrows' | 'local-player2';
          
          if (game.mode === 'local-2p' || game.mode === 'tournament') {
            controllerType = side === 'left' ? 'human-arrows' : 'local-player2';
          } else {
            controllerType = 'human-ws';
          }
          
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
          
          currentPlayerId = playerId;
          
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
      
      function handleInput(message: GameMessage) {
        const { playerId, matchId, input } = message;
        
        if (!playerId || !matchId || !input) {
          return;
        }
        
        const game = gameManager.getGame(matchId);
        
        if (game) {
          game.setPlayerInput(playerId, input);
        }
      }
      
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
          console.log(` Game ${matchId} started by player request`);
        } else {
          console.warn(` Game ${matchId} not found for start`);
          socket.send(JSON.stringify({
            type: 'error',
            message: 'Game not found'
          }));
        }
      }

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
          console.log(` Game ${matchId} paused`);
        }
      }
 
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
          console.log(`Game ${matchId} resumed`);
        }
      }

      function handleDisconnect(playerId: string) {
        const game = gameManager.getGameByPlayer(playerId);
        
        if (!game) {
          return;
        }
        
        const matchId = game.id;
        const state = game.getState();
        
        if (state.status !== 'finished') {
          console.log(`Player ${playerId} disconnected, stopping game ${matchId}`);
          game.stop();
          gameManager.removeGame(matchId);
        } else {
          console.log(` Player ${playerId} disconnected from finished game ${matchId}, removing immediately`);
          gameManager.removeGame(matchId);
        }
      }
      
    }
  );
}