import type { FastifyInstance } from 'fastify';
import type { Database } from 'better-sqlite3';

interface ChatMessage {
  id?: number;
  type: 'user' | 'system' | 'tournament_notification' | 'game_invite' | 'game_invite_declined' | 'online_users_update';
  username?: string;
  userId?: number;
  avatarUrl?: string;
  text?: string;
  timestamp?: number;
  tournamentNotification?: {
    tournamentId: string | number;
    tournamentName: string;
    matchId: number;
    player1: string;
    player2: string;
  };
  gameInvite?: {
    inviterId: number;
    inviterName: string;
    targetId: number;
    targetName: string;
    gameId: string;
  };
  users?: any[];
}

const chatConnections = new Map<number, any>();

// Fonction pour sauvegarder un message dans la base de données
function saveMessage(db: Database, userId: number, username: string, text: string) {
  try {
    const id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO chat_messages (id, type, user_id, username, text, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, 'message', userId, username, text, now);
  } catch (error) {
    console.error('Error saving chat message:', error);
  }
}

// Fonction pour charger les messages récents
function loadRecentMessages(db: Database, limit: number = 50): ChatMessage[] {
  try {
    // Récupérer les N derniers messages dans l'ordre décroissant, puis les inverser
    const stmt = db.prepare(`
      SELECT cm.id, cm.type, cm.user_id as userId, cm.username, cm.text, cm.tournament_id,
             u.avatar_url as avatarUrl,
             CAST((julianday(cm.created_at) - 2440587.5) * 86400000 AS INTEGER) as timestamp
      FROM chat_messages cm
      LEFT JOIN users u ON cm.user_id = u.id
      WHERE cm.type IN ('message', 'tournament_notification')
      ORDER BY cm.created_at DESC
      LIMIT ?
    `);
    const messages = stmt.all(limit) as any[];
    // Inverser pour avoir l'ordre chronologique (du plus ancien au plus récent)
    return messages.reverse().map(msg => {
      if (msg.type === 'tournament_notification') {
        // Parser le texte pour extraire les infos
        const parts = msg.text.split(': ');
        const tournamentName = parts[0];
        const players = parts[1]?.split(' 🆚 ') || ['', ''];
        return {
          id: msg.id,
          type: 'tournament_notification' as const,
          tournamentNotification: {
            tournamentId: msg.tournament_id, // Garder comme string
            tournamentName,
            matchId: 0, // Non utilisé
            player1: players[0],
            player2: players[1]
          },
          timestamp: msg.timestamp
        };
      }
      return {
        id: msg.id,
        type: 'user' as const,
        userId: msg.userId,
        username: msg.username,
        avatarUrl: msg.avatarUrl,
        text: msg.text,
        timestamp: msg.timestamp
      };
    });
  } catch (error) {
    console.error('Error loading recent messages:', error);
    return [];
  }
}

// Fonction pour diffuser la liste des utilisateurs en ligne
export function broadcastOnlineUsers(db: Database) {
  const onlineUsers: any[] = [];
  
  chatConnections.forEach((_connection, userId) => {
    try {
      const user = db.prepare('SELECT id, display_name, avatar_url FROM users WHERE id = ?').get(userId) as any;
      if (user) {
        onlineUsers.push({
          userId: user.id,
          username: user.display_name,
          avatarUrl: user.avatar_url
        });
      }
    } catch (error) {
      console.error('Error getting user info:', error);
    }
  });

  const message = JSON.stringify({
    type: 'online_users_update',
    users: onlineUsers
  });

  chatConnections.forEach((connection) => {
    try {
      if (connection.socket.readyState === 1) {
        connection.socket.send(message);
      }
    } catch (error) {
      console.error('Error broadcasting online users:', error);
    }
  });
}

// Fonction pour déconnecter un utilisateur du chat
export function disconnectUserFromChat(userId: number, db: Database) {
  const conn = chatConnections.get(userId);
  if (conn) {
    try {
      if (conn.socket.readyState === 1 || conn.socket.readyState === 0) {
        conn.socket.close();
      }
    } catch (error) {
      console.error('Error closing socket:', error);
    }
    chatConnections.delete(userId);
    broadcastOnlineUsers(db);
  }
}

// Fonction pour diffuser une notification de tournoi
export function broadcastTournamentNotification(
  db: Database,
  tournamentId: string,
  tournamentName: string,
  matchId: string,
  player1: string,
  player2: string
) {
  const notification: ChatMessage = {
    type: 'tournament_notification',
    tournamentNotification: {
      tournamentId: tournamentId, // Garder comme string
      tournamentName,
      matchId: parseInt(matchId),
      player1,
      player2
    },
    timestamp: Date.now()
  };

  // Sauvegarder la notification en DB
  try {
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const stmt = db.prepare(`
      INSERT INTO chat_messages (id, type, tournament_id, text, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    const text = `${tournamentName}: ${player1} 🆚 ${player2}`;
    stmt.run(messageId, 'tournament_notification', tournamentId, text, new Date().toISOString());
  } catch (error) {
    console.error('Error saving tournament notification to DB:', error);
  }

  const message = JSON.stringify(notification);

  chatConnections.forEach((connection) => {
    try {
      if (connection.socket.readyState === 1) {
        connection.socket.send(message);
      }
    } catch (error) {
      console.error('Error broadcasting tournament notification:', error);
    }
  });

  console.log(`Tournament notification sent: ${tournamentName} - ${player1} vs ${player2}`);
}

export async function registerChatWS(app: FastifyInstance, db: Database) {
  app.get('/ws/chat', { websocket: true }, (connection, req: any) => {
    const { socket } = connection;
    let userId: number | undefined = undefined;
    let username: string | null = null;

    // Authentification via token dans l'URL (comme /ws/friends)
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : req.query?.token;
      
      if (!token) {
        console.error('No token provided for chat WebSocket');
        socket.close();
        return;
      }

      const decoded: any = app.jwt.verify(token);
      userId = decoded?.uid;
      
      if (!userId) {
        console.error('Invalid user ID from token');
        socket.close();
        return;
      }

      const user = db.prepare('SELECT display_name FROM users WHERE id = ?').get(userId) as any;
      if (!user) {
        console.error('User not found:', userId);
        socket.close();
        return;
      }

      username = user.display_name;
      chatConnections.set(userId, { socket, username });

      // Diffuser la liste mise à jour des utilisateurs en ligne
      broadcastOnlineUsers(db);

      console.log(`User ${username} (${userId}) connected to chat`);

    } catch (error) {
      console.error('Chat WebSocket authentication error:', error);
      socket.close();
      return;
    }

    socket.on('message', async (rawMessage: Buffer) => {
      try {
        const message = JSON.parse(rawMessage.toString());

        // Vérifier que l'utilisateur est authentifié
        if (!userId || !username) {
          socket.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
          return;
        }

        // Message normal
        if (message.type === 'message' && message.text) {
          // Récupérer l'avatar de l'utilisateur
          let avatarUrl = null;
          try {
            const user = db.prepare('SELECT avatar_url FROM users WHERE id = ?').get(userId) as any;
            avatarUrl = user?.avatar_url;
          } catch (error) {
            console.error('Error getting user avatar:', error);
          }

          const chatMessage: ChatMessage = {
            type: 'user',
            userId: userId,
            username: username,
            avatarUrl: avatarUrl,
            text: message.text,
            timestamp: Date.now()
          };

          // Sauvegarder dans la base de données
          saveMessage(db, userId, username, message.text);

          // Récupérer la liste des utilisateurs bloqués
          const blockedByUsers = db.prepare(`
            SELECT blocker_id FROM user_blocks WHERE blocked_id = ?
          `).all(userId) as any[];

          const blockedByIds = new Set(blockedByUsers.map(b => b.blocker_id));

          // Broadcast à tous sauf ceux qui ont bloqué cet utilisateur
          chatConnections.forEach((conn, connUserId) => {
            if (!blockedByIds.has(connUserId) && conn.socket.readyState === 1) {
              conn.socket.send(JSON.stringify(chatMessage));
            }
          });
        }

        // Invitation de jeu
        if (message.type === 'game_invite') {
          const inviteMessage: ChatMessage = {
            type: 'game_invite',
            gameInvite: {
              inviterId: message.inviterId,
              inviterName: message.inviterName,
              targetId: message.targetId,
              targetName: message.targetName,
              gameId: message.gameId
            },
            timestamp: Date.now()
          };

          // Envoyer à tous les utilisateurs connectés
          chatConnections.forEach((conn) => {
            if (conn.socket.readyState === 1) {
              conn.socket.send(JSON.stringify(inviteMessage));
            }
          });
        }

        // Refus d'invitation de jeu
        if (message.type === 'game_invite_declined') {
          const declineMessage: ChatMessage = {
            type: 'game_invite_declined',
            gameInvite: {
              inviterId: message.inviterId,
              inviterName: message.inviterName,
              targetId: message.targetId,
              targetName: message.targetName,
              gameId: message.gameId
            },
            timestamp: Date.now()
          };

          // Envoyer uniquement au joueur qui a invité
          const inviterConnection = chatConnections.get(message.inviterId);
          if (inviterConnection && inviterConnection.socket.readyState === 1) {
            inviterConnection.socket.send(JSON.stringify(declineMessage));
          }
        }

      } catch (error) {
        console.error('Error handling chat message:', error);
      }
    });

    socket.on('close', () => {
      if (userId !== undefined && username) {
        const userIdValue = userId; // Garantir que c'est un number
        chatConnections.delete(userIdValue);

        // Diffuser la liste mise à jour des utilisateurs en ligne
        broadcastOnlineUsers(db);
      }
    });
  });

  // Route pour récupérer les messages récents
  app.get('/chat/messages', { preHandler: app.auth }, async (_req: any, res: any) => {
    try {
      const messages = loadRecentMessages(db);
      return res.send(messages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      return res.status(500).send({ error: 'Internal server error' });
    }
  });

  // Route pour récupérer les utilisateurs en ligne
  app.get('/chat/online-users', { preHandler: app.auth }, async (_req: any, res: any) => {
    try {
      const onlineUsers: any[] = [];
      
      chatConnections.forEach((_connection, userId) => {
        try {
          const user = db.prepare('SELECT id, display_name, avatar_url FROM users WHERE id = ?').get(userId) as any;
          if (user) {
            onlineUsers.push({
              userId: user.id,
              username: user.display_name,
              avatarUrl: user.avatar_url
            });
          }
        } catch (error) {
          console.error('Error getting user info:', error);
        }
      });

      return res.send({ users: onlineUsers });
    } catch (error) {
      console.error('Error fetching online users:', error);
      return res.status(500).send({ error: 'Internal server error' });
    }
  });

  // Route pour bloquer un utilisateur
  app.post('/chat/block', { preHandler: app.auth }, async (req: any, res: any) => {
    try {
      const uid = req.user?.uid;
      if (!uid) return res.status(401).send({ error: 'Unauthorized' });

      const { blockedUserId } = req.body;
      if (!blockedUserId) return res.status(400).send({ error: 'Missing blockedUserId' });

      db.prepare(`
        INSERT OR IGNORE INTO user_blocks (blocker_id, blocked_id)
        VALUES (?, ?)
      `).run(uid, blockedUserId);

      return res.send({ success: true });
    } catch (error) {
      console.error('Error blocking user:', error);
      return res.status(500).send({ error: 'Internal server error' });
    }
  });

  // Route pour débloquer un utilisateur
  app.post('/chat/unblock', { preHandler: app.auth }, async (req: any, res: any) => {
    try {
      const uid = req.user?.uid;
      if (!uid) return res.status(401).send({ error: 'Unauthorized' });

      const { blockedUserId } = req.body;
      if (!blockedUserId) return res.status(400).send({ error: 'Missing blockedUserId' });

      db.prepare(`
        DELETE FROM user_blocks 
        WHERE blocker_id = ? AND blocked_id = ?
      `).run(uid, blockedUserId);

      return res.send({ success: true });
    } catch (error) {
      console.error('Error unblocking user:', error);
      return res.status(500).send({ error: 'Internal server error' });
    }
  });

  // Route pour récupérer la liste des utilisateurs bloqués
  app.get('/chat/blocked', { preHandler: app.auth }, async (req: any, res: any) => {
    try {
      const uid = req.user?.uid;
      if (!uid) return res.status(401).send({ error: 'Unauthorized' });

      const blocked = db.prepare(`
        SELECT 
          ub.blocked_id as blockedUserId,
          u.display_name as blockedUsername,
          u.avatar_url as blockedUserAvatar
        FROM user_blocks ub
        JOIN users u ON u.id = ub.blocked_id
        WHERE ub.blocker_id = ?
      `).all(uid);

      return res.send(blocked);
    } catch (error) {
      console.error('Error fetching blocked users:', error);
      return res.status(500).send({ error: 'Internal server error' });
    }
  });
}
