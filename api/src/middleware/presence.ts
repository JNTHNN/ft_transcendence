import { FastifyRequest, FastifyReply } from 'fastify';
import { getPresenceService } from '../core/presence.js';


export async function trackUserActivity(request: FastifyRequest, _reply: FastifyReply) {
  try {
    const user = (request as any).user;
    if (!user?.uid) {
      return;
    }

    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return;
    }
    
    const sessionToken = authHeader.slice(7);

    const presenceService = getPresenceService();
    presenceService.updateUserActivity(user.uid, sessionToken);
    
  } catch (error) {

  }
}

export function markUserOnline(userId: number, sessionToken: string, userAgent?: string, ipAddress?: string) {
  try {
    const presenceService = getPresenceService();
    presenceService.setUserOnline(userId, sessionToken, userAgent, ipAddress);
  } catch (error) {

  }
}

export function markUserOffline(userId: number, sessionToken?: string) {
  try {
    const presenceService = getPresenceService();
    presenceService.setUserOffline(userId, sessionToken);
  } catch (error) {

  }
}