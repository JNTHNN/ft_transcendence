import type { FastifyInstance } from 'fastify';
import Database from 'better-sqlite3';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createI18nForRequest } from '../i18n/translations.js';
import { notifyFriendsUsers } from '../friends/ws.js';
import { getPresenceService } from '../core/presence.js';

const updateSchema = z.object({
  displayName: z.string().min(2).max(50).optional(),
  email: z.string().email().optional(),
});

export async function registerUserRoutes(app: FastifyInstance, db: Database.Database) {
  app.get('/users', { preHandler: app.auth }, async (_req, res) => {
    const rows = db.prepare("SELECT id, email, display_name AS displayName, created_at AS createdAt FROM users").all();
    return res.send(rows);
  });

  app.patch('/users/me', { preHandler: app.auth }, async (req: any, res) => {
    const reqI18n = createI18nForRequest(req.headers);
    try {
      const uid = req.user?.uid;
      if (!uid) return res.status(401).send({ error: reqI18n.t('unauthorized') });

      const body = updateSchema.parse(req.body);
      if (!body.displayName) return res.status(400).send({ error: reqI18n.t('nothingToUpdate') });

      db.prepare("UPDATE users SET display_name = ? WHERE id = ?").run(body.displayName, uid);
      const row = db.prepare("SELECT id, email, display_name AS displayName, created_at AS createdAt FROM users WHERE id = ?").get(uid);
      return res.send(row);
    } catch (e) {
      app.log.error(e);
      return res.status(500).send({ error: reqI18n.t('updateFailed') });
    }
  });

  app.patch('/users/profile', async (req: any, res) => {
    const reqI18n = createI18nForRequest(req.headers);
    try {
      const auth = req.headers.authorization;
      if (!auth?.startsWith('Bearer ')) {
        return res.status(401).send({ error: reqI18n.t('missingToken') });
      }
      const token = auth.slice(7);
      const decoded: any = app.jwt.verify(token);
      const uid = decoded?.uid;
      if (!uid) return res.status(400).send({ error: reqI18n.t('invalidTokenPayload') });

      const body = updateSchema.parse(req.body);
      if (!body.displayName && !body.email) return res.status(400).send({ error: reqI18n.t('nothingToUpdate') });

      if (body.email) {
        const existingUser = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(body.email, uid) as any;
        if (existingUser) {
          return res.status(409).send({ error: reqI18n.t('emailAlreadyExists') });
        }
      }

      const updates: string[] = [];
      const params: any[] = [];
      
      if (body.displayName) {
        updates.push('display_name = ?');
        params.push(body.displayName);
      }
      
      if (body.email) {
        updates.push('email = ?');
        params.push(body.email);
      }
      
      params.push(uid);
      
      const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
      db.prepare(query).run(...params);
      
      const row = db.prepare("SELECT id, email, display_name AS displayName, created_at AS createdAt FROM users WHERE id = ?").get(uid);
      return res.send(row);
    } catch (e) {
      app.log.error(e);
      return res.status(500).send({ error: reqI18n.t('updateFailed') });
    }
  });

  app.post('/users/avatar', async (req: any, res: any) => {
    const reqI18n = createI18nForRequest(req.headers);
    
    try {
      const auth = req.headers.authorization;
      if (!auth?.startsWith('Bearer ')) {
        return res.status(401).send({ error: reqI18n.t('missingToken') });
      }
      const token = auth.slice(7);
      const decoded: any = app.jwt.verify(token);
      const uid = decoded?.uid;
      if (!uid) return res.status(400).send({ error: reqI18n.t('invalidTokenPayload') });

      if (!req.headers['content-type']?.includes('multipart/form-data')) {
        return res.status(400).send({ error: reqI18n.t('multipartRequired') });
      }

      const data = await req.file();
      if (!data) {
        return res.status(400).send({ error: reqI18n.t('noFileUploaded') });
      }

      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(data.mimetype)) {
        return res.status(400).send({ error: reqI18n.t('invalidFileType') });
      }

      const maxSize = 5 * 1024 * 1024;
      const buffer = await data.toBuffer();
      if (buffer.length > maxSize) {
        return res.status(400).send({ error: reqI18n.t('fileTooLarge') });
      }

      const uploadsDir = '/data/uploads';
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const fileExt = path.extname(data.filename || '.jpg');
      const fileName = `avatar_${uid}_${crypto.randomBytes(8).toString('hex')}${fileExt}`;
      const filePath = path.join(uploadsDir, fileName);

      const user = db.prepare('SELECT avatar_url FROM users WHERE id = ?').get(uid) as any;
      if (user?.avatar_url && user.avatar_url.startsWith('/uploads/')) {
        const oldFilePath = `/data${user.avatar_url}`;
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      }

      fs.writeFileSync(filePath, buffer);

      const avatarUrl = `/uploads/${fileName}`;
      db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(avatarUrl, uid);

      return res.send({ 
        success: true, 
        avatarUrl: avatarUrl,
        message: reqI18n.t('avatarUploadSuccess') 
      });
    } catch (e) {
      app.log.error(e);
      return res.status(500).send({ error: reqI18n.t('avatarUploadFailed') });
    }
  });

  app.delete('/users/avatar', async (req: any, res: any) => {
    const reqI18n = createI18nForRequest(req.headers);
    
    try {
      const auth = req.headers.authorization;
      if (!auth?.startsWith('Bearer ')) {
        return res.status(401).send({ error: reqI18n.t('missingToken') });
      }
      const token = auth.slice(7);
      const decoded: any = app.jwt.verify(token);
      const uid = decoded?.uid;
      if (!uid) return res.status(400).send({ error: reqI18n.t('invalidTokenPayload') });

      const user = db.prepare('SELECT avatar_url, account_type FROM users WHERE id = ?').get(uid) as any;
      if (!user) {
        return res.status(404).send({ error: reqI18n.t('userNotFound') });
      }

      if (user.avatar_url) {

        if (user.avatar_url.startsWith('/uploads/')) {
          const filePath = `/data${user.avatar_url}`;
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }

        db.prepare("UPDATE users SET avatar_url = NULL WHERE id = ?").run(uid);
      }

      return res.send({ 
        success: true, 
        message: reqI18n.t('avatarDeleteSuccess') 
      });
    } catch (e) {
      app.log.error(e);
      return res.status(500).send({ error: reqI18n.t('avatarDeleteFailed') });
    }
  });

  app.post('/users/sync-42-avatar', async (req: any, res: any) => {
    const reqI18n = createI18nForRequest(req.headers);
    
    try {
      const auth = req.headers.authorization;
      if (!auth?.startsWith('Bearer ')) {
        return res.status(401).send({ error: reqI18n.t('missingToken') });
      }
      const token = auth.slice(7);
      const decoded: any = app.jwt.verify(token);
      const uid = decoded?.uid;
      if (!uid) return res.status(400).send({ error: reqI18n.t('invalidTokenPayload') });

      const user = db.prepare('SELECT avatar_url, account_type, oauth42_data FROM users WHERE id = ?').get(uid) as any;
      if (!user) {
        return res.status(404).send({ error: reqI18n.t('userNotFound') });
      }

      if (user.account_type !== 'oauth42' || !user.oauth42_data) {
        return res.status(400).send({ error: reqI18n.t('oauth42Only') });
      }

      const oauth42Data = JSON.parse(user.oauth42_data);
      

      app.log.info(`OAuth42 data keys for user ${uid}: ${Object.keys(oauth42Data).join(', ')}`);
      
      const oauth42Avatar = oauth42Data.image?.versions?.medium || oauth42Data.image?.link;

      if (!oauth42Avatar) {
        app.log.warn(`No 42 avatar found for user ${uid}. Available data keys: ${Object.keys(oauth42Data).join(', ')}`);
        return res.status(400).send({ 
          error: reqI18n.t('no42Avatar') 
        });
      }

      if (user.avatar_url && user.avatar_url.startsWith('/uploads/')) {
        const oldFilePath = `/data${user.avatar_url}`;
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      }

      db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(oauth42Avatar, uid);

      return res.send({ 
        success: true, 
        avatarUrl: oauth42Avatar,
        message: reqI18n.t('avatar42SyncSuccess') 
      });
    } catch (e) {
      app.log.error(e);
      return res.status(500).send({ error: reqI18n.t('avatar42SyncFailed') });
    }
  });

  // ===============================
  // ROUTES POUR LE SYSTÈME D'AMIS
  // ===============================

  // Récupérer la liste des amis
  app.get('/users/friends', { preHandler: app.auth }, async (req: any, res) => {
    const reqI18n = createI18nForRequest(req.headers);
    try {
      const uid = req.user?.uid;
      if (!uid) return res.status(401).send({ error: reqI18n.t('unauthorized') });

      const friendsData = db.prepare(`
        SELECT 
          u.id,
          u.display_name as displayName,
          u.avatar_url as avatarUrl,
          f.status,
          f.created_at as friendsSince
        FROM friendships f
        JOIN users u ON (
          CASE 
            WHEN f.requester_id = ? THEN u.id = f.receiver_id
            ELSE u.id = f.requester_id
          END
        )
        WHERE (f.requester_id = ? OR f.receiver_id = ?) AND f.status = 'accepted'
        ORDER BY u.display_name
      `).all(uid, uid, uid) as any[];

      // Obtenir le statut en ligne réel pour chaque ami
      const presenceService = getPresenceService();
      const userIds = friendsData.map(friend => friend.id);
      const onlineStatus = presenceService.getUsersOnlineStatus(userIds);
      
      const friends = friendsData.map((friend: any) => ({
        ...friend,
        status: onlineStatus.get(friend.id) ? 'online' : 'offline'
      }));

      return res.send({ friends });
    } catch (e) {
      app.log.error(e);
      return res.status(500).send({ error: 'Friends load failed' });
    }
  });

  // Récupérer les demandes d'amis en attente
  app.get('/users/friend-requests', { preHandler: app.auth }, async (req: any, res) => {
    const reqI18n = createI18nForRequest(req.headers);
    try {
      const uid = req.user?.uid;
      if (!uid) return res.status(401).send({ error: reqI18n.t('unauthorized') });

      const requests = db.prepare(`
        SELECT 
          u.id,
          u.display_name as displayName,
          u.avatar_url as avatarUrl,
          f.created_at as requestDate,
          f.id as requestId
        FROM friendships f
        JOIN users u ON u.id = f.requester_id
        WHERE f.receiver_id = ? AND f.status = 'pending'
        ORDER BY f.created_at DESC
      `).all(uid);

      return res.send({ requests });
    } catch (e) {
      app.log.error(e);
      return res.status(500).send({ error: 'Friend requests load failed' });
    }
  });

  // Récupérer les demandes d'amis envoyées (en attente)
  app.get('/users/sent-requests', { preHandler: app.auth }, async (req: any, res) => {
    const reqI18n = createI18nForRequest(req.headers);
    try {
      const uid = req.user?.uid;
      if (!uid) return res.status(401).send({ error: reqI18n.t('unauthorized') });

      const sentRequests = db.prepare(`
        SELECT 
          f.id,
          f.created_at as createdAt,
          u.id as userId,
          u.display_name as displayName,
          u.avatar_url as avatarUrl
        FROM friendships f
        JOIN users u ON u.id = f.receiver_id
        WHERE f.requester_id = ? AND f.status = 'pending'
        ORDER BY f.created_at DESC
      `).all(uid);

      return res.send({ sentRequests });
    } catch (e) {
      app.log.error(e);
      return res.status(500).send({ error: 'Sent requests load failed' });
    }
  });

  // Envoyer une demande d'ami
  app.post('/users/:userId/friend-request', { preHandler: app.auth }, async (req: any, res) => {
    const reqI18n = createI18nForRequest(req.headers);
    try {
      const uid = req.user?.uid;
      const targetUserId = parseInt(req.params.userId);
      
      if (!uid) return res.status(401).send({ error: reqI18n.t('unauthorized') });
      if (uid === targetUserId) return res.status(400).send({ error: reqI18n.tFriends('cannotAddYourself') });

      // Vérifier que l'utilisateur cible existe
      const targetUser = db.prepare('SELECT id FROM users WHERE id = ?').get(targetUserId);
      if (!targetUser) {
        return res.status(404).send({ error: reqI18n.t('userNotFound') });
      }

      // Vérifier qu'il n'y a pas déjà une relation
      const existingFriendship = db.prepare(`
        SELECT id, status, requester_id, receiver_id FROM friendships 
        WHERE (requester_id = ? AND receiver_id = ?) OR (requester_id = ? AND receiver_id = ?)
      `).get(uid, targetUserId, targetUserId, uid) as any;

      if (existingFriendship) {
        if (existingFriendship.status === 'accepted') {
          return res.status(409).send({ error: reqI18n.tFriends('alreadyFriends') });
        } else if (existingFriendship.status === 'pending') {
          // Si l'autre personne nous a déjà envoyé une demande, l'accepter automatiquement
          if (existingFriendship.requester_id === targetUserId && existingFriendship.receiver_id === uid) {
            // Accepter la demande existante au lieu d'en créer une nouvelle
            db.prepare(`
              UPDATE friendships SET status = 'accepted' WHERE id = ?
            `).run(existingFriendship.id);
            
            // Notifier les deux utilisateurs via WebSocket
            notifyFriendsUsers([uid, targetUserId], {
              type: 'friend_accepted',
              data: {
                friendshipId: existingFriendship.id,
                userId1: uid,
                userId2: targetUserId,
                autoAccepted: true
              }
            });
            
            return res.send({ 
              success: true, 
              message: reqI18n.tFriends('mutualFriendship'),
              autoAccepted: true 
            });
          } else {
            // Si c'est nous qui avons déjà envoyé une demande
            return res.status(409).send({ error: reqI18n.tFriends('requestAlreadySent') });
          }
        } else if (existingFriendship.status === 'blocked') {
          return res.status(403).send({ error: reqI18n.tFriends('cannotSendRequest') });
        }
      }

      // Créer la demande d'ami
      const result = db.prepare(`
        INSERT INTO friendships (requester_id, receiver_id, status)
        VALUES (?, ?, 'pending')
      `).run(uid, targetUserId);

      // Notifier le receveur de la nouvelle demande reçue
      notifyFriendsUsers([targetUserId], {
        type: 'friend_request_received',
        data: {
          requestId: result.lastInsertRowid,
          requesterId: uid,
          receiverId: targetUserId
        }
      });
      
      // Notifier l'expéditeur de la demande envoyée
      notifyFriendsUsers([uid], {
        type: 'friend_request_sent',
        data: {
          requestId: result.lastInsertRowid,
          requesterId: uid,
          receiverId: targetUserId
        }
      });

      return res.send({ success: true, message: reqI18n.tFriends('requestSent') });
    } catch (e) {
      app.log.error(e);
      return res.status(500).send({ error: reqI18n.tFriends('requestFailed') });
    }
  });

  // Accepter une demande d'ami
  app.put('/users/friend-requests/:requestId/accept', { preHandler: app.auth }, async (req: any, res) => {
    const reqI18n = createI18nForRequest(req.headers);
    try {
      const uid = req.user?.uid;
      const requestId = parseInt(req.params.requestId);
      
      if (!uid) return res.status(401).send({ error: reqI18n.t('unauthorized') });

      const request = db.prepare(`
        SELECT id, requester_id, receiver_id, status 
        FROM friendships 
        WHERE id = ? AND receiver_id = ? AND status = 'pending'
      `).get(requestId, uid);

      if (!request) {
        return res.status(404).send({ error: 'Friend request not found' });
      }

      db.prepare(`
        UPDATE friendships 
        SET status = 'accepted', updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(requestId);

      // Notifier les deux utilisateurs via WebSocket
      notifyFriendsUsers([uid, (request as any).requester_id], {
        type: 'friend_accepted',
        data: {
          requestId: requestId,
          accepterId: uid,
          requesterId: (request as any).requester_id
        }
      });

      return res.send({ success: true, message: reqI18n.tFriends('requestAccepted') });
    } catch (e) {
      app.log.error(e);
      return res.status(500).send({ error: 'Friend accept failed' });
    }
  });

  // Refuser une demande d'ami
  app.delete('/users/friend-requests/:requestId', { preHandler: app.auth }, async (req: any, res) => {
    const reqI18n = createI18nForRequest(req.headers);
    try {
      const uid = req.user?.uid;
      const requestId = parseInt(req.params.requestId);
      
      if (!uid) return res.status(401).send({ error: reqI18n.t('unauthorized') });

      const request = db.prepare(`
        SELECT id, requester_id, receiver_id FROM friendships 
        WHERE id = ? AND receiver_id = ? AND status = 'pending'
      `).get(requestId, uid);

      if (!request) {
        return res.status(404).send({ error: 'Friend request not found' });
      }

      db.prepare('DELETE FROM friendships WHERE id = ?').run(requestId);

      // Notifier les deux utilisateurs du refus
      notifyFriendsUsers([uid, (request as any).requester_id], {
        type: 'friend_request_declined',
        data: {
          requestId: requestId,
          declinerId: uid,
          requesterId: (request as any).requester_id
        }
      });

      return res.send({ success: true, message: reqI18n.tFriends('requestDeclined') });
    } catch (e) {
      app.log.error(e);
      return res.status(500).send({ error: 'Friend decline failed' });
    }
  });

  // Annuler une demande d'ami envoyée
  app.delete('/users/sent-requests/:requestId', { preHandler: app.auth }, async (req: any, res) => {
    const reqI18n = createI18nForRequest(req.headers);
    try {
      const uid = req.user?.uid;
      const requestId = parseInt(req.params.requestId);
      
      if (!uid) return res.status(401).send({ error: reqI18n.t('unauthorized') });

      // Vérifier que la demande existe et appartient à l'utilisateur connecté
      const request = db.prepare(`
        SELECT id, requester_id, receiver_id FROM friendships 
        WHERE id = ? AND requester_id = ? AND status = 'pending'
      `).get(requestId, uid);

      if (!request) {
        return res.status(404).send({ error: 'Sent request not found' });
      }

      db.prepare('DELETE FROM friendships WHERE id = ?').run(requestId);

      // Notifier les deux utilisateurs de l'annulation
      notifyFriendsUsers([uid, (request as any).receiver_id], {
        type: 'friend_request_cancelled',
        data: {
          requestId: requestId,
          cancellerId: uid,
          receiverId: (request as any).receiver_id
        }
      });

      return res.send({ success: true, message: 'Request cancelled successfully' });
    } catch (e) {
      app.log.error(e);
      return res.status(500).send({ error: 'Cancel request failed' });
    }
  });

  // Supprimer un ami
  app.delete('/users/:userId/friend', { preHandler: app.auth }, async (req: any, res) => {
    const reqI18n = createI18nForRequest(req.headers);
    try {
      const uid = req.user?.uid;
      const friendUserId = parseInt(req.params.userId);
      
      if (!uid) return res.status(401).send({ error: reqI18n.t('unauthorized') });

      const friendship = db.prepare(`
        SELECT id FROM friendships 
        WHERE ((requester_id = ? AND receiver_id = ?) OR (requester_id = ? AND receiver_id = ?)) 
        AND status = 'accepted'
      `).get(uid, friendUserId, friendUserId, uid) as any;

      if (!friendship) {
        return res.status(404).send({ error: 'Friendship not found' });
      }

      db.prepare('DELETE FROM friendships WHERE id = ?').run(friendship.id);

      // Notifier les deux utilisateurs de la suppression
      notifyFriendsUsers([uid, friendUserId], {
        type: 'friend_removed',
        data: {
          friendshipId: friendship.id,
          removerId: uid,
          removedUserId: friendUserId
        }
      });

      return res.send({ success: true, message: reqI18n.tFriends('friendRemoved') });
    } catch (e) {
      app.log.error(e);
      return res.status(500).send({ error: 'Friend remove failed' });
    }
  });

  // Rechercher des utilisateurs pour les ajouter en ami
  app.get('/users/search', { preHandler: app.auth }, async (req: any, res) => {
    const reqI18n = createI18nForRequest(req.headers);
    try {
      const uid = req.user?.uid;
      const query = req.query.q;
      
      if (!uid) return res.status(401).send({ error: reqI18n.t('unauthorized') });
      if (!query || query.length < 2) {
        return res.status(400).send({ error: 'Search query too short' });
      }

      const users = db.prepare(`
        SELECT 
          u.id,
          u.display_name as displayName,
          u.avatar_url as avatarUrl,
          CASE 
            WHEN f.id IS NOT NULL THEN f.status
            ELSE 'none'
          END as friendshipStatus
        FROM users u
        LEFT JOIN friendships f ON (
          (f.requester_id = ? AND f.receiver_id = u.id) OR 
          (f.receiver_id = ? AND f.requester_id = u.id)
        )
        WHERE u.id != ? AND u.display_name LIKE ?
        ORDER BY u.display_name
        LIMIT 20
      `).all(uid, uid, uid, `%${query}%`);

      return res.send({ users });
    } catch (e) {
      app.log.error(e);
      return res.status(500).send({ error: 'User search failed' });
    }
  });

  // Route pour obtenir le statut en ligne d'utilisateurs spécifiques
  app.post('/users/online-status', { preHandler: app.auth }, async (req: any, res) => {
    const reqI18n = createI18nForRequest(req.headers);
    try {
      const uid = req.user?.uid;
      const { userIds } = req.body;
      
      if (!uid) return res.status(401).send({ error: reqI18n.t('unauthorized') });
      if (!Array.isArray(userIds)) {
        return res.status(400).send({ error: 'userIds must be an array' });
      }

      const presenceService = getPresenceService();
      const onlineStatus = presenceService.getUsersOnlineStatus(userIds);
      
      // Convertir la Map en objet pour la réponse JSON
      const statusObject: Record<number, boolean> = {};
      onlineStatus.forEach((status: boolean, userId: number) => {
        statusObject[userId] = status;
      });

      return res.send({ status: statusObject });
    } catch (e) {
      app.log.error(e);
      return res.status(500).send({ error: 'Failed to get online status' });
    }
  });

  // Route pour obtenir les statistiques de présence
  app.get('/users/presence-stats', { preHandler: app.auth }, async (req: any, res) => {
    try {
      const presenceService = getPresenceService();
      const stats = presenceService.getPresenceStats();
      return res.send(stats);
    } catch (e) {
      app.log.error(e);
      return res.status(500).send({ error: 'Failed to get presence stats' });
    }
  });

  // ===============================
  // ROUTES POUR L'HISTORIQUE DES MATCHS
  // ===============================

  // Récupérer l'historique des matchs
  app.get('/users/match-history', { preHandler: app.auth }, async (req: any, res) => {
    const reqI18n = createI18nForRequest(req.headers);
    try {
      const uid = req.user?.uid;
      if (!uid) return res.status(401).send({ error: reqI18n.t('unauthorized') });

      const matches = db.prepare(`
        SELECT 
          m.id,
          m.player1_score,
          m.player2_score,
          m.winner_id,
          m.match_type,
          m.duration,
          m.created_at,
          p1.display_name as player1Name,
          p1.avatar_url as player1Avatar,
          p2.display_name as player2Name,
          p2.avatar_url as player2Avatar,
          CASE WHEN m.winner_id = ? THEN 'win' ELSE 'loss' END as result
        FROM match_history m
        JOIN users p1 ON p1.id = m.player1_id
        JOIN users p2 ON p2.id = m.player2_id
        WHERE m.player1_id = ? OR m.player2_id = ?
        ORDER BY m.created_at DESC
        LIMIT 50
      `).all(uid, uid, uid);

      return res.send({ matches });
    } catch (e) {
      app.log.error(e);
      return res.status(500).send({ error: 'Match history load failed' });
    }
  });

  // Récupérer les statistiques d'un utilisateur
  app.get('/users/:userId/stats', { preHandler: app.auth }, async (req: any, res) => {
    const reqI18n = createI18nForRequest(req.headers);
    try {
      const uid = req.user?.uid;
      const targetUserId = parseInt(req.params.userId) || uid;
      
      if (!uid) return res.status(401).send({ error: reqI18n.t('unauthorized') });

      const stats = db.prepare(`
        SELECT 
          COUNT(*) as totalGames,
          SUM(CASE WHEN winner_id = ? THEN 1 ELSE 0 END) as wins,
          SUM(CASE WHEN winner_id != ? THEN 1 ELSE 0 END) as losses,
          AVG(CASE WHEN player1_id = ? THEN player1_score ELSE player2_score END) as avgScore,
          MAX(CASE WHEN player1_id = ? THEN player1_score ELSE player2_score END) as bestScore
        FROM match_history 
        WHERE (player1_id = ? OR player2_id = ?) AND winner_id IS NOT NULL
      `).get(targetUserId, targetUserId, targetUserId, targetUserId, targetUserId, targetUserId) as any;

      return res.send({ 
        stats: {
          totalGames: stats.totalGames || 0,
          wins: stats.wins || 0,
          losses: stats.losses || 0,
          winRate: stats.totalGames ? ((stats.wins || 0) / stats.totalGames * 100).toFixed(1) : '0.0',
          avgScore: stats.avgScore ? parseFloat(stats.avgScore).toFixed(1) : '0.0',
          bestScore: stats.bestScore || 0
        }
      });
    } catch (e) {
      app.log.error(e);
      return res.status(500).send({ error: 'Stats load failed' });
    }
  });
}