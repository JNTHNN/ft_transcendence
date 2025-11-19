import type { FastifyInstance } from 'fastify';
import Database from 'better-sqlite3';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createI18nForRequest } from '../i18n/translations.js';

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
}