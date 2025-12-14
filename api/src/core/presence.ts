import Database from 'better-sqlite3';

let notifyFriendsStatusChange: ((userId: number, isOnline: boolean) => Promise<void>) | null = null;


export class PresenceService {
  private db: Database.Database;
  private cleanupInterval: any;

  constructor(db: Database.Database) {
    this.db = db;
    
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveSessions();
    }, 60000);
  }

  setUserOnline(userId: number, sessionToken: string, userAgent?: string, ipAddress?: string): void {
    try {
      const wasOnline = this.isUserOnline(userId);
      
      this.db.prepare('DELETE FROM user_sessions WHERE session_token = ?').run(sessionToken);
      
      this.db.prepare(`
        INSERT INTO user_sessions (user_id, session_token, last_activity, is_online, user_agent, ip_address)
        VALUES (?, ?, CURRENT_TIMESTAMP, 1, ?, ?)
      `).run(userId, sessionToken, userAgent, ipAddress);
      
      if (!wasOnline && notifyFriendsStatusChange) {

        notifyFriendsStatusChange(userId, true).catch(_error => {

        });
      } else if (!wasOnline) {

      }
    } catch (error) {

    }
  }

  setUserOffline(userId: number, sessionToken?: string): void {
    try {
      const wasOnline = this.isUserOnline(userId);
      
      if (sessionToken) {
        this.db.prepare('DELETE FROM user_sessions WHERE user_id = ? AND session_token = ?').run(userId, sessionToken);
      } else {
        this.db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(userId);
      }
      
      const isStillOnline = this.isUserOnline(userId);
      
      if (wasOnline && !isStillOnline && notifyFriendsStatusChange) {

        notifyFriendsStatusChange(userId, false).catch(_error => {

        });
      } else if (wasOnline && !isStillOnline) {

      }
    } catch (error) {

    }
  }

  updateUserActivity(userId: number, sessionToken: string): void {
    try {
      this.db.prepare(`
        UPDATE user_sessions 
        SET last_activity = CURRENT_TIMESTAMP 
        WHERE user_id = ? AND session_token = ?
      `).run(userId, sessionToken);
    } catch (error) {

    }
  }

  isUserOnline(userId: number): boolean {
    try {
      const session = this.db.prepare(`
        SELECT id FROM user_sessions 
        WHERE user_id = ? AND is_online = 1 
        AND datetime(last_activity, '+5 minutes') > CURRENT_TIMESTAMP
      `).get(userId);
      return !!session;
    } catch (error) {

      return false;
    }
  }


  getUsersOnlineStatus(userIds: number[]): Map<number, boolean> {
    const statusMap = new Map<number, boolean>();
    
    if (userIds.length === 0) return statusMap;

    try {
      const placeholders = userIds.map(() => '?').join(',');
      const onlineUsers = this.db.prepare(`
        SELECT DISTINCT user_id FROM user_sessions 
        WHERE user_id IN (${placeholders}) AND is_online = 1
        AND datetime(last_activity, '+5 minutes') > CURRENT_TIMESTAMP
      `).all(...userIds) as Array<{ user_id: number }>;

      userIds.forEach(id => statusMap.set(id, false));
      
      onlineUsers.forEach(user => statusMap.set(user.user_id, true));
      
    } catch (error) {

      userIds.forEach(id => statusMap.set(id, false));
    }

    return statusMap;
  }

  private cleanupInactiveSessions(): void {
    try {
      const result = this.db.prepare(`
        DELETE FROM user_sessions 
        WHERE datetime(last_activity, '+5 minutes') < CURRENT_TIMESTAMP
      `).run();
      
      if (result.changes > 0) {

      }
    } catch (error) {

    }
  }

  getPresenceStats(): { totalOnline: number; totalSessions: number } {
    try {
      const stats = this.db.prepare(`
        SELECT 
          COUNT(DISTINCT user_id) as totalOnline,
          COUNT(*) as totalSessions
        FROM user_sessions 
        WHERE is_online = 1 AND datetime(last_activity, '+5 minutes') > CURRENT_TIMESTAMP
      `).get() as any;
      
      return {
        totalOnline: stats.totalOnline || 0,
        totalSessions: stats.totalSessions || 0
      };
    } catch (error) {

      return { totalOnline: 0, totalSessions: 0 };
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

let presenceService: PresenceService;

export function initPresenceService(db: Database.Database): void {
  presenceService = new PresenceService(db);
  
  import('../friends/ws.js').then(wsModule => {
    notifyFriendsStatusChange = wsModule.notifyFriendsStatusChange;

  }).catch(_error => {

  });
}

export function getPresenceService(): PresenceService {
  if (!presenceService) {
    throw new Error('PresenceService not initialized. Call initPresenceService first.');
  }
  return presenceService;
}