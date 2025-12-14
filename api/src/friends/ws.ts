import type { FastifyInstance, FastifyRequest } from "fastify";
import "@fastify/websocket";

import { markUserOnline, markUserOffline } from '../middleware/presence.js';
import db from '../db/db.js';



const activeFriendsConnections = new Map<number, any>();
let database: any = null;

export async function registerFriendsWS(app: FastifyInstance, db?: any) {
  database = db;
  app.get("/ws/friends", { websocket: true }, async (connection: any, req: FastifyRequest) => {
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

    activeFriendsConnections.set(userId, connection.socket);
    
    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip;

    markUserOnline(userId, token, userAgent, ipAddress);
    
    connection.socket.send(JSON.stringify({
      type: 'connected',
      message: 'WebSocket friends connecté avec succès'
    }));


    setTimeout(() => {
      notifyFriendsStatusChange(userId, true, database);
    }, 100); 
    connection.socket.on("close", () => {

      activeFriendsConnections.delete(userId);
      
      markUserOffline(userId, token);
      
      setTimeout(() => {
        notifyFriendsStatusChange(userId, false, database);
      }, 100);
    });

    connection.socket.on("error", (_error: Error) => {

      activeFriendsConnections.delete(userId);
    });

    connection.socket.on("message", (raw: Buffer) => {
      try {
        const message = JSON.parse(raw.toString());
        
        if (message.type === 'ping') {
          connection.socket.send(JSON.stringify({ type: 'pong' }));
        }
      } catch (_error) {

      }
    });
  });
}

export function notifyFriendsUsers(userIds: number[], event: any) {

  
  userIds.forEach(userId => {
    const socket = activeFriendsConnections.get(userId);
    if (socket && socket.readyState === 1) { 
      try {
        socket.send(JSON.stringify(event));

      } catch (error) {

        activeFriendsConnections.delete(userId);
      }
    } else {

    }
  });
}


export async function notifyFriendsStatusChange(userId: number, isOnline: boolean, dbParam?: any) {
  try {
    const dbInstance = dbParam || database || db;
    

    
    if (!dbInstance) {

      return;
    }

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

export function getFriendsConnectionsStatus() {
  return {
    activeConnections: activeFriendsConnections.size,
    connectedUsers: Array.from(activeFriendsConnections.keys())
  };
}