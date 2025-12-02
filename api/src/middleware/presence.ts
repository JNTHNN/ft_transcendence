import { FastifyRequest, FastifyReply } from 'fastify';
import { getPresenceService } from '../core/presence.js';

/**
 * Middleware pour tracker l'activité des utilisateurs authentifiés
 */
export async function trackUserActivity(request: FastifyRequest, _reply: FastifyReply) {
  try {
    // Vérifier si l'utilisateur est authentifié
    const user = (request as any).user;
    if (!user?.uid) {
      return;
    }

    // Extraire le token de session
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return;
    }
    
    const sessionToken = authHeader.slice(7);
    // const userAgent = request.headers['user-agent'];
    // const ipAddress = request.ip;

    // Mettre à jour l'activité de l'utilisateur
    const presenceService = getPresenceService();
    presenceService.updateUserActivity(user.uid, sessionToken);
    
  } catch (error) {
    // Ne pas faire échouer la requête si le tracking échoue

  }
}

/**
 * Hook pour marquer un utilisateur en ligne lors de l'authentification
 */
export function markUserOnline(userId: number, sessionToken: string, userAgent?: string, ipAddress?: string) {
  try {
    const presenceService = getPresenceService();
    presenceService.setUserOnline(userId, sessionToken, userAgent, ipAddress);
  } catch (error) {

  }
}

/**
 * Hook pour marquer un utilisateur hors ligne
 */
export function markUserOffline(userId: number, sessionToken?: string) {
  try {
    const presenceService = getPresenceService();
    presenceService.setUserOffline(userId, sessionToken);
  } catch (error) {

  }
}