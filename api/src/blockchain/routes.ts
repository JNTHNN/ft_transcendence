import type { FastifyInstance } from 'fastify';
import { blockchainService } from '../core/blockchain.js';

export default async function blockchainRoutes(fastify: FastifyInstance) {
  
  // Get blockchain status
  fastify.get('/blockchain/status', async (_request, reply) => {
    try {
      const isAvailable = blockchainService.isAvailable();
      const networkInfo = blockchainService.getNetworkInfo();
      
      return {
        available: isAvailable,
        network: networkInfo.network,
        chainId: '43113',
        contract_address: process.env.SCORES_CONTRACT_ADDRESS || 'Not configured',
        rpc_url: process.env.AVALANCHE_RPC_URL || 'Not configured'
      };
    } catch (error) {
      console.error('Error fetching blockchain status:', error);
      return reply.status(500).send({ error: 'Failed to fetch blockchain status' });
    }
  });

  // Test blockchain connection
  fastify.get('/blockchain/test', async (_request, reply) => {
    try {
      const totalTournaments = await blockchainService.getAllTournaments(0, 10);
      return {
        success: true,
        total_tournaments_on_chain: totalTournaments?.length || 0,
        message: 'Blockchain connection successful'
      };
    } catch (error) {
      console.error('Error testing blockchain connection:', error);
      return reply.status(500).send({ 
        error: 'Failed to connect to blockchain',
        details: (error as Error).message 
      });
    }
  });
}