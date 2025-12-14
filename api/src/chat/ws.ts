import type { FastifyInstance } from 'fastify';
import type { Database } from 'better-sqlite3';

interface ChatMessage {
  id?: string;
  type: 'user' | 'system' | 'tournament_notification' | 'tournament_start' | 'tournament_end' | 'game_invite' | 'game_invite_declined' | 'online_users_update' | 'typing_indicator' | 'read_receipt';
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
  isTyping?: boolean;
  messageId?: string;
  readBy?: number[];
}

const chatConnections = new Map<number, any>();
const typingTimeouts = new Map<number, NodeJS.Timeout>();

function saveMessage(db: Database, userId: number, username: string, text: string): string | null {
  try {
    const id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO chat_messages (id, type, user_id, username, text, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, 'message', userId, username, text, now);
    return id;
  } catch (error) {
    console.error('Error saving chat message:', error);
    return null;
  }
}

function getMessageReadReceipts(db: Database, messageId: string): number[] {
  try {
    const stmt = db.prepare(`
      SELECT user_id FROM message_read_receipts WHERE message_id = ?
    `);
    const receipts = stmt.all(messageId) as any[];
    return receipts.map(r => r.user_id);
  } catch (error) {
    console.error('Error loading read receipts:', error);
    return [];
  }
}

function loadRecentMessages(db: Database, limit: number = 50): ChatMessage[] {
  try {
    const stmt = db.prepare(`
      SELECT cm.id, cm.type, cm.user_id as userId, cm.username, cm.text, cm.tournament_id,
             u.avatar_url as avatarUrl,
             CAST((julianday(cm.created_at) - 2440587.5) * 86400000 AS INTEGER) as timestamp
      FROM chat_messages cm
      LEFT JOIN users u ON cm.user_id = u.id
      WHERE cm.type IN ('message', 'tournament_notification', 'tournament_start', 'tournament_end')
      ORDER BY cm.created_at DESC
      LIMIT ?
    `);
    const messages = stmt.all(limit) as any[];
    return messages.reverse().map(msg => {
      if (msg.type === 'tournament_notification') {
        const parts = msg.text.split(': ');
        const tournamentName = parts[0];
        const players = parts[1]?.split(' 🆚 ') || ['', ''];
        return {
          id: msg.id,
          type: 'tournament_notification' as const,
          tournamentNotification: {
            tournamentId: msg.tournament_id,
            tournamentName,
            matchId: 0,
            player1: players[0],
            player2: players[1]
          },
          timestamp: msg.timestamp
        };
      }
      if (msg.type === 'tournament_start') {
        const tournamentName = msg.text.replace('TOURNAMENT_START:', '');
        return {
          id: msg.id,
          type: 'tournament_start' as const,
          tournamentNotification: {
            tournamentId: msg.tournament_id,
            tournamentName,
            matchId: 0,
            player1: '',
            player2: ''
          },
          timestamp: msg.timestamp
        };
      }
      if (msg.type === 'tournament_end') {
        const parts = msg.text.replace('TOURNAMENT_END:', '').split(':');
        const tournamentName = parts[0];
        const winnerName = parts[1] || '';
        return {
          id: msg.id,
          type: 'tournament_end' as const,
          tournamentNotification: {
            tournamentId: msg.tournament_id,
            tournamentName,
            matchId: 0,
            player1: winnerName,
            player2: ''
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
        timestamp: msg.timestamp,
        readBy: getMessageReadReceipts(db, msg.id)
      };
    });
  } catch (error) {
    console.error('Error loading recent messages:', error);
    return [];
  }
}

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
      tournamentId: tournamentId,
      tournamentName,
      matchId: parseInt(matchId),
      player1,
      player2
    },
    timestamp: Date.now()
  };

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

export function broadcastTournamentStart(
  db: Database,
  tournamentId: string,
  tournamentName: string
) {
  const notification: ChatMessage = {
    type: 'tournament_start',
    tournamentNotification: {
      tournamentId: tournamentId,
      tournamentName,
      matchId: 0,
      player1: '',
      player2: ''
    },
    timestamp: Date.now()
  };

  try {
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const stmt = db.prepare(`
      INSERT INTO chat_messages (id, type, tournament_id, text, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    const text = `TOURNAMENT_START:${tournamentName}`;
    stmt.run(messageId, 'tournament_start', tournamentId, text, new Date().toISOString());
  } catch (error) {
    console.error('Error saving tournament start notification to DB:', error);
  }

  const message = JSON.stringify(notification);

  chatConnections.forEach((connection) => {
    try {
      if (connection.socket.readyState === 1) {
        connection.socket.send(message);
      }
    } catch (error) {
      console.error('Error broadcasting tournament start:', error);
    }
  });

  console.log(`Tournament start notification sent: ${tournamentName}`);
}

export function broadcastTournamentEnd(
  db: Database,
  tournamentId: string,
  tournamentName: string,
  winnerName: string
) {
  const notification: ChatMessage = {
    type: 'tournament_end',
    tournamentNotification: {
      tournamentId: tournamentId,
      tournamentName,
      matchId: 0,
      player1: winnerName,
      player2: ''
    },
    timestamp: Date.now()
  };

  try {
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const stmt = db.prepare(`
      INSERT INTO chat_messages (id, type, tournament_id, text, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    const text = `TOURNAMENT_END:${tournamentName}:${winnerName}`;
    stmt.run(messageId, 'tournament_end', tournamentId, text, new Date().toISOString());
  } catch (error) {
    console.error('Error saving tournament end notification to DB:', error);
  }

  const message = JSON.stringify(notification);

  chatConnections.forEach((connection) => {
    try {
      if (connection.socket.readyState === 1) {
        connection.socket.send(message);
      }
    } catch (error) {
      console.error('Error broadcasting tournament end:', error);
    }
  });

  console.log(`Tournament end notification sent: ${tournamentName} - Winner: ${winnerName}`);
}

export async function registerChatWS(app: FastifyInstance, db: Database) {
  app.get('/ws/chat', { websocket: true }, (connection, req: any) => {
    const { socket } = connection;
    let userId: number | undefined = undefined;
    let username: string | null = null;

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

      try {
        const markReadStmt = db.prepare(`
          INSERT OR IGNORE INTO message_read_receipts (message_id, user_id, read_at)
          SELECT cm.id, ?, CURRENT_TIMESTAMP
          FROM chat_messages cm
          WHERE cm.type = 'message' 
            AND cm.user_id != ?
            AND cm.user_id NOT IN (
              SELECT blocked_id FROM user_blocks WHERE blocker_id = ?
            )
        `);
        markReadStmt.run(userId, userId, userId);
        
        const messages = loadRecentMessages(db);
        socket.send(JSON.stringify({
          type: 'history',
          messages: messages
        }));
        
        const readMessages = db.prepare(`
          SELECT DISTINCT message_id FROM message_read_receipts WHERE user_id = ?
        `).all(userId) as any[];
        
        readMessages.forEach((row) => {
          const readReceiptMessage: ChatMessage = {
            type: 'read_receipt',
            userId: userId,
            username: username || '',
            messageId: row.message_id,
            timestamp: Date.now()
          };
          
          chatConnections.forEach((conn) => {
            if (conn.socket.readyState === 1) {
              conn.socket.send(JSON.stringify(readReceiptMessage));
            }
          });
        });
      } catch (error) {
        console.error('Error marking messages as read:', error);
      }

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

        if (!userId || !username) {
          socket.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
          return;
        }

        if (message.type === 'message' && message.text) {
          let avatarUrl = null;
          try {
            const user = db.prepare('SELECT avatar_url FROM users WHERE id = ?').get(userId) as any;
            avatarUrl = user?.avatar_url;
          } catch (error) {
            console.error('Error getting user avatar:', error);
          }

          const messageId = saveMessage(db, userId, username, message.text);

          const chatMessage: ChatMessage = {
            id: messageId || undefined,
            type: 'user',
            userId: userId,
            username: username,
            avatarUrl: avatarUrl,
            text: message.text,
            timestamp: Date.now()
          };

          const blockedByUsers = db.prepare(`
            SELECT blocker_id FROM user_blocks WHERE blocked_id = ?
          `).all(userId) as any[];

          const blockedByIds = new Set(blockedByUsers.map(b => b.blocker_id));

          chatConnections.forEach((conn, connUserId) => {
            if (!blockedByIds.has(connUserId) && conn.socket.readyState === 1) {
              conn.socket.send(JSON.stringify(chatMessage));
            }
          });
        }

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

          chatConnections.forEach((conn) => {
            if (conn.socket.readyState === 1) {
              conn.socket.send(JSON.stringify(inviteMessage));
            }
          });
        }

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

          const inviterConnection = chatConnections.get(message.inviterId);
          if (inviterConnection && inviterConnection.socket.readyState === 1) {
            inviterConnection.socket.send(JSON.stringify(declineMessage));
          }
        }

        if (message.type === 'typing_indicator') {
          const typingMessage: ChatMessage = {
            type: 'typing_indicator',
            userId: userId,
            username: username,
            isTyping: message.isTyping,
            timestamp: Date.now()
          };

          const blockedByUsers = db.prepare(`
            SELECT blocker_id FROM user_blocks WHERE blocked_id = ?
          `).all(userId) as any[];
          const blockedByIds = new Set(blockedByUsers.map(b => b.blocker_id));

          chatConnections.forEach((conn, connUserId) => {
            if (connUserId !== userId && !blockedByIds.has(connUserId) && conn.socket.readyState === 1) {
              conn.socket.send(JSON.stringify(typingMessage));
            }
          });

          if (message.isTyping) {
            const existingTimeout = typingTimeouts.get(userId);
            if (existingTimeout) {
              clearTimeout(existingTimeout);
            }
            
            const timeout = setTimeout(() => {
              const stopTypingMessage: ChatMessage = {
                type: 'typing_indicator',
                userId: userId,
                username: username,
                isTyping: false,
                timestamp: Date.now()
              };
              
              chatConnections.forEach((conn, connUserId) => {
                if (connUserId !== userId && !blockedByIds.has(connUserId) && conn.socket.readyState === 1) {
                  conn.socket.send(JSON.stringify(stopTypingMessage));
                }
              });
              
              typingTimeouts.delete(userId);
            }, 3000);
            
            typingTimeouts.set(userId, timeout);
          } else {
            const existingTimeout = typingTimeouts.get(userId);
            if (existingTimeout) {
              clearTimeout(existingTimeout);
              typingTimeouts.delete(userId);
            }
          }
        }

        if (message.type === 'read_receipt' && message.messageId) {
          try {
            const messageAuthor = db.prepare(`
              SELECT user_id FROM chat_messages WHERE id = ?
            `).get(message.messageId) as any;
            
            if (messageAuthor) {
              const isBlocked = db.prepare(`
                SELECT 1 FROM user_blocks 
                WHERE blocker_id = ? AND blocked_id = ?
              `).get(userId, messageAuthor.user_id);
              
              if (!isBlocked) {
                const stmt = db.prepare(`
                  INSERT OR IGNORE INTO message_read_receipts (message_id, user_id, read_at)
                  VALUES (?, ?, CURRENT_TIMESTAMP)
                `);
                stmt.run(message.messageId, userId);
                
                const readReceiptMessage: ChatMessage = {
                  type: 'read_receipt',
                  userId: userId,
                  username: username,
                  messageId: message.messageId,
                  timestamp: Date.now()
                };

                chatConnections.forEach((conn) => {
                  if (conn.socket.readyState === 1) {
                    conn.socket.send(JSON.stringify(readReceiptMessage));
                  }
                });
              }
            }
          } catch (error) {
            console.error('Error saving read receipt:', error);
          }
        }

      } catch (error) {
        console.error('Error handling chat message:', error);
      }
    });

    socket.on('close', () => {
      if (userId !== undefined && username) {
        const userIdValue = userId;
        
        const existingTimeout = typingTimeouts.get(userIdValue);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
          typingTimeouts.delete(userIdValue);
        }
        
        chatConnections.delete(userIdValue);

        broadcastOnlineUsers(db);
      }
    });
  });

  app.get('/chat/messages', { preHandler: app.auth }, async (_req: any, res: any) => {
    try {
      const messages = loadRecentMessages(db);
      return res.send(messages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      return res.status(500).send({ error: 'Internal server error' });
    }
  });

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
