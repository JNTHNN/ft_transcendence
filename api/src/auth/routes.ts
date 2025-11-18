import type { FastifyInstance } from 'fastify';
import { signupSchema, loginSchema } from './schemas.js';
import Database from 'better-sqlite3';
import argon2 from 'argon2';
import crypto from 'crypto';
import { createI18nForRequest } from '../i18n/translations.js';

declare const process: any;

const ACCESS_TTL = '15m';
const REFRESH_DAYS = 7;
const COOKIE_NAME = 'rt';

function nowPlusDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}
function toSqliteDate(d: Date) {
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

function setRefreshCookie(reply: any, token: string) {
  reply.setCookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/auth',
    maxAge: REFRESH_DAYS * 24 * 60 * 60,
    partitioned: true
  });
}

function clearRefreshCookie(reply: any) {
  reply.clearCookie(COOKIE_NAME, {
    path: '/auth'
  });
}

function createRefreshToken(db: Database.Database, userId: number) {
  const token = crypto.randomBytes(32).toString('base64url');
  const exp = nowPlusDays(REFRESH_DAYS);
  db.prepare(
    'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)'
  ).run(userId, token, toSqliteDate(exp));
  return token;
}

function rotateRefreshToken(db: Database.Database, oldToken: string, userId: number) {
  db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE token = ?').run(oldToken);
  return createRefreshToken(db, userId);
}

export async function registerAuthRoutes(app: FastifyInstance, db: Database.Database) {
  app.post('/auth/signup', async (req: any, res: any) => {
    const reqI18n = createI18nForRequest(req.headers);
    
    try {
      const body = signupSchema.parse(req.body);
      const hash = await argon2.hash(body.password);
      
      try {
        const stmt = db.prepare(
          'INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)'
        );
        const info = stmt.run(body.email, hash, body.displayName);

        const access = app.jwt.sign(
          { uid: info.lastInsertRowid, email: body.email },
          { expiresIn: ACCESS_TTL }
        );
        const rt = createRefreshToken(db, Number(info.lastInsertRowid));
        setRefreshCookie(res, rt);

        return res.send({ token: access, user: { id: info.lastInsertRowid, email: body.email, displayName: body.displayName } });
      } catch (e: any) {
        if (String(e?.message || '').includes('UNIQUE')) {
          return res.status(409).send({ error: reqI18n.t('emailAlreadyExists') });
        }
        app.log.error(e);
        return res.status(500).send({ error: reqI18n.t('signupFailed') });
      }
    } catch (e: any) {
      if (e.name === 'ZodError') {
        const firstError = e.errors[0];
        let errorMessage = reqI18n.t('validationError');
        
        if (firstError.path[0] === 'email' && firstError.code === 'invalid_string') {
          errorMessage = reqI18n.t('invalidEmail');
        } else if (firstError.path[0] === 'password' && firstError.code === 'too_small') {
          errorMessage = reqI18n.t('passwordMinLength');
        } else if (firstError.path[0] === 'displayName') {
          errorMessage = reqI18n.t('displayNameRequired');
        }
        
        return res.status(400).send({ error: errorMessage });
      }
      app.log.error(e);
      return res.status(500).send({ error: reqI18n.t('signupFailed') });
    }
  });

  app.post('/auth/login', async (req: any, res: any) => {
    const reqI18n = createI18nForRequest(req.headers);
    
    try {
      const body = loginSchema.parse(req.body);
      const row = db
        .prepare('SELECT id, password_hash, email, display_name FROM users WHERE email = ?')
        .get(body.email) as any;

      if (!row) return res.status(401).send({ error: reqI18n.t('invalidCredentials') });
      const ok = await argon2.verify(row.password_hash, body.password);
      if (!ok) return res.status(401).send({ error: reqI18n.t('invalidCredentials') });

    const access = app.jwt.sign(
      { uid: row.id, email: row.email },
      { expiresIn: ACCESS_TTL }
    );
    const rt = createRefreshToken(db, row.id);
    setRefreshCookie(res, rt);

      return res.send({
        token: access,
        user: { id: row.id, email: row.email, displayName: row.display_name }
      });
    } catch (e: any) {
      const reqI18n = createI18nForRequest(req.headers);
      if (e.name === 'ZodError') {
        const firstError = e.errors[0];
        let errorMessage = reqI18n.t('validationError');
        
        if (firstError.path[0] === 'email' && firstError.code === 'invalid_string') {
          errorMessage = reqI18n.t('invalidEmail');
        } else if (firstError.path[0] === 'password' && firstError.code === 'too_small') {
          errorMessage = reqI18n.t('passwordMinLength');
        }
        
        return res.status(400).send({ error: errorMessage });
      }
      app.log.error(e);
      return res.status(500).send({ error: reqI18n.t('invalidCredentials') });
    }
  });

  app.get('/auth/me', async (req: any, res: any) => {
    const reqI18n = createI18nForRequest(req.headers);
    try {
      const auth = req.headers.authorization;
      if (!auth?.startsWith('Bearer ')) {
        return res.status(401).send({ error: reqI18n.t('missingToken') });
      }
      const token = auth.slice(7);
      const decoded: any = app.jwt.verify(token);
      const uid = decoded?.uid;
      if (!uid) {
        return res.status(400).send({ error: reqI18n.t('invalidTokenPayload') });
      }
      const row = db
        .prepare('SELECT id, email, display_name, created_at, avatar_url, account_type, oauth42_login, oauth42_data, last_42_sync FROM users WHERE id = ?')
        .get(uid) as any;

      if (!row) return res.status(404).send({ error: reqI18n.t('userNotFound') });

      const oauth42Data = row.oauth42_data ? JSON.parse(row.oauth42_data) : null;

      return res.send({
        id: row.id,
        email: row.email,
        displayName: row.display_name,
        createdAt: row.created_at,
        avatarUrl: row.avatar_url,
        accountType: row.account_type,
        oauth42Login: row.oauth42_login,
        oauth42Data: oauth42Data,
        last42Sync: row.last_42_sync
      });
    } catch (e) {
      app.log.error(e);
      return res.status(401).send({ error: reqI18n.t('sessionExpired') });
    }
  });

  app.post('/auth/refresh', async (req: any, res: any) => {
    const reqI18n = createI18nForRequest(req.headers);
    try {
      const cookieRt = req.cookies?.[COOKIE_NAME];
      const bodyRt = (req.body && typeof req.body === 'object') ? (req.body.refreshToken as string | undefined) : undefined;
      const rt = cookieRt || bodyRt;
      if (!rt) return res.status(401).send({ error: reqI18n.t('missingRefreshToken') });

      const row = db.prepare(
        `SELECT rt.token, rt.expires_at, rt.revoked, u.id AS user_id, u.email, u.display_name
         FROM refresh_tokens rt
         JOIN users u ON u.id = rt.user_id
         WHERE rt.token = ?`
      ).get(rt) as any;

      if (!row) return res.status(401).send({ error: reqI18n.t('invalidRefreshToken') });
      if (row.revoked) return res.status(401).send({ error: reqI18n.t('refreshTokenRevoked') });
      if (new Date(row.expires_at).getTime() < Date.now()) {
        db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE token = ?').run(rt);
        return res.status(401).send({ error: reqI18n.t('refreshTokenExpired') });
      }

      const newRt = rotateRefreshToken(db, rt, row.user_id);
      setRefreshCookie(res, newRt);

      const access = app.jwt.sign({ uid: row.user_id, email: row.email }, { expiresIn: ACCESS_TTL });
      return res.send({ token: access });
    } catch (e) {
      app.log.error(e);
      return res.status(401).send({ error: reqI18n.t('sessionExpired') });
    }
  });

  app.post('/auth/logout', async (req: any, res: any) => {
    const reqI18n = createI18nForRequest(req.headers);
    try {
      const rt = req.cookies?.[COOKIE_NAME];
      if (rt) {
        db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE token = ?').run(rt);
      }
      clearRefreshCookie(res);
      return res.send({ ok: true });
    } catch (e) {
      app.log.error(e);
      return res.status(500).send({ error: 'Logout failed' });
    }
  });

  app.get('/auth/sessions', async (req: any, res: any) => {
    const reqI18n = createI18nForRequest(req.headers);
    try {
      const auth = req.headers.authorization;
      if (!auth?.startsWith('Bearer ')) {
        return res.status(401).send({ error: 'Missing token' });
      }
      const token = auth.slice(7);
      const decoded: any = app.jwt.verify(token);
      const uid = decoded?.uid;
      if (!uid) return res.status(400).send({ error: 'Invalid token payload' });

      db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ? AND revoked = 0').run(uid);
      clearRefreshCookie(res);
      return res.send({ ok: true });
    } catch (e) {
      app.log.error(e);
      return res.status(401).send({ error: 'Invalid token' });
    }
  });

  app.post('/auth/change-password', async (req: any, res: any) => {
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

      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).send({ error: reqI18n.t('currentPasswordRequired') });
      }

      if (newPassword.length < 6) {
        return res.status(400).send({ error: reqI18n.t('passwordTooShort') });
      }

      const user = db.prepare('SELECT id, password_hash FROM users WHERE id = ?').get(uid) as any;
      if (!user) {
        return res.status(404).send({ error: reqI18n.t('userNotFound') });
      }

      const isCurrentPasswordValid = await argon2.verify(user.password_hash, currentPassword);
      if (!isCurrentPasswordValid) {
        return res.status(401).send({ error: reqI18n.t('currentPasswordIncorrect') });
      }

      const newPasswordHash = await argon2.hash(newPassword);

      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newPasswordHash, uid);


      db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ? AND revoked = 0').run(uid);

      return res.send({ success: true, message: 'Password changed successfully' });
    } catch (e) {
      app.log.error(e);
      return res.status(500).send({ error: reqI18n.t('changePasswordFailed') });
    }
  });

  app.post('/auth/change-email', async (req: any, res: any) => {
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

      const { newEmail, password } = req.body;
      if (!newEmail || !password) {
        return res.status(400).send({ error: reqI18n.t('emailAndPasswordRequired') });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newEmail)) {
        return res.status(400).send({ error: reqI18n.t('invalidEmailFormat') });
      }

      const user = db.prepare('SELECT id, email, password_hash FROM users WHERE id = ?').get(uid) as any;
      if (!user) {
        return res.status(404).send({ error: 'User not found' });
      }

      if (user.email === newEmail) {
        return res.status(400).send({ error: reqI18n.t('emailMustBeDifferent') });
      }

      const isPasswordValid = await argon2.verify(user.password_hash, password);
      if (!isPasswordValid) {
        return res.status(401).send({ error: reqI18n.t('passwordIncorrect') });
      }

      const existingUser = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(newEmail, uid) as any;
      if (existingUser) {
        return res.status(409).send({ error: reqI18n.t('emailAlreadyExists') });
      }

      db.prepare('UPDATE users SET email = ? WHERE id = ?').run(newEmail, uid);

      return res.send({ success: true, message: 'Email changed successfully' });
    } catch (e) {
      app.log.error(e);
      return res.status(500).send({ error: reqI18n.t('changeEmailFailed') });
    }
  });

  app.delete('/auth/delete-account', async (req: any, res: any) => {
    const reqI18n = createI18nForRequest(req.headers);
    try {
      const auth = req.headers.authorization;
      if (!auth?.startsWith('Bearer ')) {
        return res.status(401).send({ error: 'Missing token' });
      }
      const token = auth.slice(7);
      const decoded: any = app.jwt.verify(token);
      const uid = decoded?.uid;
      if (!uid) return res.status(400).send({ error: 'Invalid token payload' });

      const user = db.prepare('SELECT id, password_hash, account_type, oauth42_login FROM users WHERE id = ?').get(uid) as any;
      if (!user) {
        return res.status(404).send({ error: reqI18n.t('userNotFound') });
      }

      if (user.account_type === 'oauth42') {
        const deleteTransaction = db.transaction(() => {
          db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?').run(uid);
          db.prepare('DELETE FROM users WHERE id = ?').run(uid);
        });

        deleteTransaction();
        clearRefreshCookie(res);
        
        app.log.info(`OAuth2 account deleted: ${uid} (${user.oauth42_login})`);
        return res.send({ 
          success: true, 
          message: 'OAuth2 account deleted successfully. Note: This only removes your account from our platform, not from 42.' 
        });
      } else {
        const { password } = req.body;
        if (!password) {
          return res.status(400).send({ error: reqI18n.t('passwordRequired') });
        }

        const isPasswordValid = await argon2.verify(user.password_hash, password);
        if (!isPasswordValid) {
          return res.status(401).send({ error: reqI18n.t('passwordIncorrect') });
        }

        const deleteTransaction = db.transaction(() => {
          db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?').run(uid);
          db.prepare('DELETE FROM users WHERE id = ?').run(uid);
        });

        deleteTransaction();
        clearRefreshCookie(res);
        
        app.log.info(`Local account deleted: ${uid}`);
        return res.send({ success: true, message: 'Account deleted successfully' });
      }
    } catch (e) {
      app.log.error(e);
      return res.status(500).send({ error: reqI18n.t('deleteAccountFailed') });
    }
  });

  app.put('/auth/profile', async (req: any, res: any) => {
    const reqI18n = createI18nForRequest(req.headers);
    try {
      const auth = req.headers.authorization;
      if (!auth?.startsWith('Bearer ')) {
        return res.status(401).send({ error: reqI18n.t('missingToken') });
      }
      const token = auth.slice(7);
      const decoded: any = app.jwt.verify(token);
      const uid = decoded?.uid;
      if (!uid) {
        return res.status(400).send({ error: reqI18n.t('invalidTokenPayload') });
      }

      const user = db
        .prepare('SELECT email, account_type, oauth42_login FROM users WHERE id = ?')
        .get(uid) as any;

      if (!user) return res.status(404).send({ error: reqI18n.t('userNotFound') });

      const { displayName, email } = req.body;

      if (user.account_type === 'oauth42') {
        if (email && email !== user.email) {
          return res.status(400).send({ 
            error: reqI18n.t('oauth42EmailRestriction') 
          });
        }
      }

      const updates: string[] = [];
      const params: any[] = [];

      if (displayName) {
        updates.push('display_name = ?');
        params.push(displayName);
      }

      if (email && user.account_type !== 'oauth42') {
        const existing = db
          .prepare('SELECT id FROM users WHERE email = ? AND id != ?')
          .get(email, uid);
        if (existing) {
          return res.status(400).send({ error: reqI18n.t('emailAlreadyInUse') });
        }
        updates.push('email = ?');
        params.push(email);
      }

      if (updates.length === 0) {
        return res.status(400).send({ error: reqI18n.t('noValidUpdates') });
      }

      params.push(uid);
      const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
      db.prepare(sql).run(...params);

      return res.send({ success: true });
    } catch (e) {
      app.log.error(e);
      return res.status(500).send({ error: 'Internal error' });
    }
  });

  app.post('/auth/oauth42/callback', async (req: any, res: any) => {
    const reqI18n = createI18nForRequest(req.headers);
    try {

      const { code, redirect_uri } = req.body;
      
      if (!code) {

        return res.status(400).send({ error: reqI18n.t('authCodeRequired') });
      }

      const tokenParams = {
        grant_type: 'authorization_code',
        client_id: process.env.OAUTH42_CLIENT_ID || '',
        client_secret: process.env.OAUTH42_CLIENT_SECRET || '',
        code,
          redirect_uri: process.env.OAUTH42_REDIRECT_URI || redirect_uri || 'https://app.localhost/auth/oauth42/callback'
      };
      

      
      const tokenResponse = await fetch('https://api.intra.42.fr/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams(tokenParams)
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();

        return res.status(400).send({ error: reqI18n.t('tokenExchangeFailed'), details: errorText });
      }

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;

      const userResponse = await fetch('https://api.intra.42.fr/v2/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!userResponse.ok) {
        return res.status(400).send({ error: reqI18n.t('userDataFetchFailed') });
      }

      const userData = await userResponse.json();

      
      const oauth42Data = JSON.stringify({
        campus: userData.campus?.[0]?.name,
        level: userData.cursus_users?.find((c: any) => c.cursus?.name === '42')?.level,
        grade: userData.cursus_users?.find((c: any) => c.cursus?.name === '42')?.grade,
        coalition: userData.coalitions?.[0]?.name,
        wallet: userData.wallet,
        correction_points: userData.correction_point
      });
      
      let user = db.prepare('SELECT * FROM users WHERE email = ? OR oauth42_id = ?').get(userData.email, userData.id) as any;
      
      if (!user) {
        const result = db.prepare(`
          INSERT INTO users (email, display_name, avatar_url, account_type, oauth42_id, oauth42_login, oauth42_data, last_42_sync) 
          VALUES (?, ?, ?, 'oauth42', ?, ?, ?, datetime('now'))
        `).run(
          userData.email, 
          userData.displayname || userData.login,
          userData.image?.versions?.medium || userData.image?.link,
          userData.id, 
          userData.login,
          oauth42Data
        );
        
        const userId = result.lastInsertRowid as number;
        user = { id: userId, email: userData.email, display_name: userData.displayname || userData.login, account_type: 'oauth42', avatar_url: userData.image?.versions?.medium || userData.image?.link };
      } else if (!user.oauth42_id) {
        db.prepare(`
          UPDATE users SET 
            oauth42_id = ?, oauth42_login = ?, oauth42_data = ?, 
            avatar_url = COALESCE(avatar_url, ?), 
            last_42_sync = datetime('now'), updated_at = datetime('now')
          WHERE id = ?
        `).run(userData.id, userData.login, oauth42Data, userData.image?.versions?.medium || userData.image?.link, user.id);
        
        user.oauth42_id = userData.id;
        user.oauth42_login = userData.login;
        user.avatar_url = user.avatar_url || userData.image?.versions?.medium || userData.image?.link;
      } else {
        db.prepare(`
          UPDATE users SET 
            display_name = ?, avatar_url = ?, oauth42_data = ?,
            last_42_sync = datetime('now'), updated_at = datetime('now')
          WHERE id = ?
        `).run(userData.displayname || userData.login, userData.image?.versions?.medium || userData.image?.link, oauth42Data, user.id);
        
        user.display_name = userData.displayname || userData.login;
        user.avatar_url = userData.image?.versions?.medium || userData.image?.link;
      }

      const jwtToken = app.jwt.sign(
        { uid: user.id, email: user.email },
        { expiresIn: ACCESS_TTL }
      );
      
      const refreshToken = createRefreshToken(db, user.id);
      setRefreshCookie(res, refreshToken);

      return res.send({
        token: jwtToken,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.display_name || userData.displayname || userData.login,
          login: userData.login,
          imageUrl: userData.image_url,
          isOAuth42: true
        }
      });
    } catch (e) {
      app.log.error(e);
      return res.status(500).send({ error: reqI18n.t('oauthCallbackFailed') });
    }
  });
}