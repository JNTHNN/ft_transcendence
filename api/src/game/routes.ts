import type { FastifyInstance } from 'fastify';
import { gameManager } from './GameManager.js';
import { PredictiveAI } from './IA/DummyAI.js'; 
import type { GameMode } from './types.js';

/**
 * Enregistre les routes REST pour le jeu
 */
export async function registerGameRoutes(app: FastifyInstance) {
  
  /**
   * POST /game/create
   * CrÃ©e une nouvelle partie
   */
  app.post<{
    Body: { mode: GameMode; matchId?: string };
  }>('/game/create', async (request, reply) => {
    const { mode, matchId } = request.body;

    if (!mode) {
      return reply.code(400).send({ error: 'Missing mode' });
    }

    try {
      const id = gameManager.createGame(mode, matchId);

      // Si mode solo-vs-ai, ajouter automatiquement l'IA
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

  /**
   * GET /game/list
   * Liste toutes les parties actives
   */
  app.get('/game/list', async (_request, reply) => {
    const games = gameManager.listGames();
    return reply.send({ games });
  });

  /**
   * GET /game/:matchId
   * RÃ©cupÃ¨re l'Ã©tat d'une partie
   */
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

  /**
   * DELETE /game/:matchId
   * Supprime une partie
   */
	app.delete<{
	Params: { matchId: string };
	}>('/game/:matchId', async (request, reply) => {
	const { matchId } = request.params;
	
	
	const game = gameManager.getGame(matchId);
	if (game) {
		game.stop();  // âœ… ArrÃªter le jeu avant de le supprimer
	}
	
	gameManager.removeGame(matchId);
	
	return reply.send({ ok: true });
	});

  /**
   * GET /game/stats
   * Statistiques globales
   */
  app.get('/game/stats', async (_request, reply) => {
    const stats = gameManager.getStats();
    return reply.send(stats);
  });

  /**
   * POST /game/local/create
   * CrÃ©e une partie locale 2 joueurs
   */
  app.post<{
    Body: { player1Id?: string; player2Id?: string };
  }>('/game/local/create', async (request, reply) => {
    const { player1Id = 'player-1', player2Id = 'player-2' } = request.body;

    try {
      // CrÃ©er la partie
      const matchId = gameManager.createGame('local-2p');

    //   // Ajouter les deux joueurs
    //   gameManager.addPlayerToGame(matchId, {
    //     id: player1Id,
    //     side: 'left',
    //     controllerType: 'human-arrows',
    //   });

    //   gameManager.addPlayerToGame(matchId, {
    //     id: player2Id,
    //     side: 'right',
    //     controllerType: 'local-player2',
    //   });

      return reply.code(201).send({
        matchId,
        mode: 'local-2p',
        player1Id,
        player2Id,
        wsUrl: `/ws/game`,
      });
    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  });

  /**
   * POST /game/:matchId/input
   * Envoie un input sans WebSocket (pour mode local)
   */
  app.post<{
    Params: { matchId: string };
    Body: { playerId: string; input: { up: boolean; down: boolean } };
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

	// ðŸ†• Route pour l'historique global
	app.get('/game/history', async (_request, reply) => {
	const history = gameManager.getMatchHistory();
	return reply.send({ history });
	});
}