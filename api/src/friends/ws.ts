import type { FastifyInstance, FastifyRequest } from "fastify";
import "@fastify/websocket";
import { getPresenceService } from '../core/presence.js';
import { markUserOnline, markUserOffline } from '../middleware/presence.js';
import db from '../db/db.js';

interface FriendsConnection {
  userId: number;
  socket: any;
}

// Map pour stocker les connexions actives : userId -> socket
const activeFriendsConnections = new Map<number, any>();
let database: any = null;

export async function registerFriendsWS(app: FastifyInstance, db?: any) {
  // Stocker la référence à la base de données
  database = db;
  app.get("/ws/friends", { websocket: true }, async (connection: any, req: FastifyRequest) => {
    // Authentifier via le token dans l'Authorization header ou les query params
    let userId: number;
    let token: string;
    try {
      const authHeader = req.headers.authorization;
      token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : (req.query as any)?.token;
      
      if (!token) {

        connection.socket.close();
        return;
      }

      const decoded: any = app.jwt.verify(token);
      userId = decoded?.uid;
      
      if (!userId) {

        connection.socket.close();
        return;
      }
    } catch (error) {

      connection.socket.close();
      return;
    }
    
    if (!userId) {

      connection.socket.close();
      return;
    }


    
    // Stocker la connexion
    activeFriendsConnections.set(userId, connection.socket);
    
    // Marquer l'utilisateur comme en ligne dans le système de présence
    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip;

    markUserOnline(userId, token, userAgent, ipAddress);
    
    // Envoyer un message de confirmation
    connection.socket.send(JSON.stringify({
      type: 'connected',
      message: 'WebSocket friends connecté avec succès'
    }));

    // Notifier les amis du changement de statut (connexion) 

    setTimeout(() => {
      notifyFriendsStatusChange(userId, true, database);
    }, 100); // Petit délai pour laisser le temps aux autres systèmes de se synchroniser
    // Gérer la fermeture de la connexion
    connection.socket.on("close", () => {

      activeFriendsConnections.delete(userId);
      
      // Marquer l'utilisateur comme hors ligne dans le système de présence

      markUserOffline(userId, token);
      
      // Notifier les amis du changement de statut (déconnexion)

      setTimeout(() => {
        notifyFriendsStatusChange(userId, false, database);
      }, 100);
    });

    // Gérer les erreurs
    connection.socket.on("error", (error: Error) => {

      activeFriendsConnections.delete(userId);
    });

    // Optionnel : gérer les messages entrants (ping/pong, etc.)
    connection.socket.on("message", (raw: Buffer) => {
      try {
        const message = JSON.parse(raw.toString());

        
        // Répondre aux pings pour maintenir la connexion
        if (message.type === 'ping') {
          connection.socket.send(JSON.stringify({ type: 'pong' }));
        }
      } catch (error) {

      }
    });
  });
}

// Fonction utilitaire pour notifier les amis
export function notifyFriendsUsers(userIds: number[], event: any) {

  
  userIds.forEach(userId => {
    const socket = activeFriendsConnections.get(userId);
    if (socket && socket.readyState === 1) { // WebSocket.OPEN = 1
      try {
        socket.send(JSON.stringify(event));

      } catch (error) {

        // Nettoyer la connexion fermée
        activeFriendsConnections.delete(userId);
      }
    } else {

    }
  });
}

/**
 * Notifier les amis d'un utilisateur d'un changement de statut de présence
 */
export async function notifyFriendsStatusChange(userId: number, isOnline: boolean, dbParam?: any) {
  try {
    // Utiliser la DB passée en paramètre, celle stockée ou l'import direct
    const dbInstance = dbParam || database || db;
    

    
    if (!dbInstance) {

      return;
    }

    // Récupérer les amis de cet utilisateur
    const friends = dbInstance.prepare(`
      SELECT 
        CASE 
          WHEN f.requester_id = ? THEN f.receiver_id
          ELSE f.requester_id
        END as friend_id
      FROM friendships f
      WHERE (f.requester_id = ? OR f.receiver_id = ?) 
      AND f.status = 'accepted'
    `).all(userId, userId, userId) as Array<{ friend_id: number }>;

    const friendIds = friends.map(f => f.friend_id);
    
    if (friendIds.length > 0) {

      
      // Envoyer la notification de changement de statut aux amis connectés
      notifyFriendsUsers(friendIds, {
        type: 'friend_status_changed',
        data: {
          userId: userId,
          isOnline: isOnline,
          timestamp: new Date().toISOString()
        }
      });
    } else {

    }
  } catch (error) {

  }
}

// Fonction pour obtenir le statut des connexions (pour debug)
export function getFriendsConnectionsStatus() {
  return {
    activeConnections: activeFriendsConnections.size,
    connectedUsers: Array.from(activeFriendsConnections.keys())
  };
}