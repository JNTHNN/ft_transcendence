import Database from 'better-sqlite3';

// Import pour les notifications WebSocket (import dynamique pour éviter les dépendances circulaires)
let notifyFriendsStatusChange: ((userId: number, isOnline: boolean) => Promise<void>) | null = null;

/**
 * Service pour gérer la présence et le statut en ligne des utilisateurs
 */
export class PresenceService {
  private db: Database.Database;
  private cleanupInterval: NodeJS.Timeout;

  constructor(db: Database.Database) {
    this.db = db;
    
    // Nettoyer les sessions inactives toutes les minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveSessions();
    }, 60000);
  }

  /**
   * Marquer un utilisateur comme en ligne
   */
  setUserOnline(userId: number, sessionToken: string, userAgent?: string, ipAddress?: string): void {
    try {
      // Vérifier si l'utilisateur était déjà en ligne
      const wasOnline = this.isUserOnline(userId);
      
      // Supprimer les anciennes sessions pour ce token
      this.db.prepare('DELETE FROM user_sessions WHERE session_token = ?').run(sessionToken);
      
      // Créer ou mettre à jour la session
      this.db.prepare(`
        INSERT INTO user_sessions (user_id, session_token, last_activity, is_online, user_agent, ip_address)
        VALUES (?, ?, CURRENT_TIMESTAMP, 1, ?, ?)
      `).run(userId, sessionToken, userAgent, ipAddress);
      
      // Notifier les amis si l'utilisateur vient de se connecter
      if (!wasOnline && notifyFriendsStatusChange) {

        notifyFriendsStatusChange(userId, true).catch(error => {

        });
      } else if (!wasOnline) {

      }
    } catch (error) {

    }
  }

  /**
   * Marquer un utilisateur comme hors ligne
   */
  setUserOffline(userId: number, sessionToken?: string): void {
    try {
      // Vérifier si l'utilisateur était en ligne
      const wasOnline = this.isUserOnline(userId);
      
      if (sessionToken) {
        // Supprimer cette session spécifique
        this.db.prepare('DELETE FROM user_sessions WHERE user_id = ? AND session_token = ?').run(userId, sessionToken);
      } else {
        // Supprimer toutes les sessions de cet utilisateur
        this.db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(userId);
      }
      
      // Vérifier si l'utilisateur est maintenant hors ligne
      const isStillOnline = this.isUserOnline(userId);
      
      // Notifier les amis si l'utilisateur vient de se déconnecter
      if (wasOnline && !isStillOnline && notifyFriendsStatusChange) {

        notifyFriendsStatusChange(userId, false).catch(error => {

        });
      } else if (wasOnline && !isStillOnline) {

      }
    } catch (error) {

    }
  }

  /**
   * Mettre à jour l'activité d'un utilisateur
   */
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

  /**
   * Vérifier si un utilisateur est en ligne
   */
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

  /**
   * Obtenir le statut de plusieurs utilisateurs
   */
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

      // Initialiser tous comme hors ligne
      userIds.forEach(id => statusMap.set(id, false));
      
      // Marquer les utilisateurs en ligne
      onlineUsers.forEach(user => statusMap.set(user.user_id, true));
      
    } catch (error) {

      // En cas d'erreur, marquer tous comme hors ligne
      userIds.forEach(id => statusMap.set(id, false));
    }

    return statusMap;
  }

  /**
   * Nettoyer les sessions inactives (plus de 5 minutes)
   */
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

  /**
   * Obtenir les statistiques de présence
   */
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

  /**
   * Nettoyer les ressources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

let presenceService: PresenceService;

export function initPresenceService(db: Database.Database): void {
  presenceService = new PresenceService(db);
  
  // Initialiser la fonction de notification WebSocket (import dynamique)
  import('../friends/ws.js').then(wsModule => {
    notifyFriendsStatusChange = wsModule.notifyFriendsStatusChange;

  }).catch(error => {

  });
}

export function getPresenceService(): PresenceService {
  if (!presenceService) {
    throw new Error('PresenceService not initialized. Call initPresenceService first.');
  }
  return presenceService;
}