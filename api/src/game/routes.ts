import type { FastifyInstance } from 'fastify';
import { gameManager } from './GameManager.js';
import { PredictiveAI } from './PredictiveAI.js';
import type { GameMode } from './types.js';

export async function registerGameRoutes(app: FastifyInstance) {

  app.post<{
    Body: { mode: GameMode; matchId?: string };
  }>('/game/create', async (request, reply) => {
    
    const { mode, matchId } = request.body;
    
    if (!mode) {
      return reply.code(400).send({ error: 'Missing mode' });
    }
    
    try {
      const id = gameManager.createGame(mode, matchId);
      
      if (mode === 'solo-vs-ai') {
        gameManager.addPlayerToGame(id, {
          id: `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          side: 'right',
          controllerType: 'ai',
          aiController: new PredictiveAI(),
        });
      }
      
      return reply.code(201).send({
        matchId: id,
        mode,
        wsUrl: `/ws/game`,
      });
      
    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  });
  

  app.get('/game/list', async (_request, reply) => {
    const games = gameManager.listGames();
    return reply.send({ games });
  });
  

  app.get<{
    Params: { matchId: string };
  }>('/game/:matchId', async (request, reply) => {
    
    const { matchId } = request.params;
    const game = gameManager.getGame(matchId);
    
    if (!game) {
      return reply.code(404).send({ error: 'Game not found' });
    }
    
    return reply.send({
      state: game.getState(),
      active: game.isActive(),
    });
  });

  app.delete<{
    Params: { matchId: string };
  }>('/game/:matchId', async (request, reply) => {
    
    const { matchId } = request.params;
    
    const game = gameManager.getGame(matchId);
    
    if (game) {
      game.stop();
    }
    
    gameManager.removeGame(matchId);
    
    return reply.send({ ok: true });
  });
  

  app.get('/game/stats', async (_request, reply) => {
    const stats = gameManager.getStats();
    return reply.send(stats);
  });

  app.post<{
    Body: {
      player1Id?: string;
      player2Id?: string;
      mode?: 'local-2p' | 'tournament';
    };
  }>('/game/local/create', async (request, reply) => {
    
    const {
      player1Id = 'player-1',
      player2Id = 'player-2',
      mode = 'local-2p'
    } = request.body;
    
    try {
      const matchId = gameManager.createGame(mode);
      
      return reply.code(201).send({
        matchId,
        mode,
        player1Id,
        player2Id,
        wsUrl: `/ws/game`,
      });
      
    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  });
  

  app.post<{
    Params: { matchId: string };
    Body: {
      playerId: string;
      input: { up: boolean; down: boolean };
    };
  }>('/game/:matchId/input', async (request, reply) => {
    
    const { matchId } = request.params;
    const { playerId, input } = request.body;
    
    const game = gameManager.getGame(matchId);
    
    if (!game) {
      return reply.code(404).send({ error: 'Game not found' });
    }
    
    game.setPlayerInput(playerId, input);
    
    return reply.send({ ok: true });
  });
  

  app.get<{
    Params: { playerId: string };
  }>('/game/stats/:playerId', async (request, reply) => {
    
    const { playerId } = request.params;
    const stats = gameManager.getPlayerStats(playerId);
    const history = gameManager.getMatchHistory(playerId);
    
    return reply.send({ stats, history });
  });

  app.get('/game/history', async (_request, reply) => {
    const history = gameManager.getMatchHistory();
    return reply.send({ history });
  });
  
}