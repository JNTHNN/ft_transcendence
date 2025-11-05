import type { FastifyInstance } from 'fastify';
import { signupSchema, loginSchema } from './schemas.js';
import Database from 'better-sqlite3';
import argon2 from 'argon2';
import crypto from 'crypto';

const ACCESS_TTL = '15m';       // short JWT
const REFRESH_DAYS = 7;         // refresh duration
const COOKIE_NAME = 'rt';       // refresh cookie name

function nowPlusDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}
function toSqliteDate(d: Date) {
  // YYYY-MM-DD HH:MM:SS
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
  // --- POST /auth/signup ---
  app.post('/auth/signup', async (req, res) => {
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
        return res.status(409).send({ error: 'Email already exists' });
      }
      app.log.error(e);
      return res.status(500).send({ error: 'Signup failed' });
    }
  });

  // --- POST /auth/login ---
  app.post('/auth/login', async (req, res) => {
    const body = loginSchema.parse(req.body);
    const row = db
      .prepare('SELECT id, password_hash, email, display_name FROM users WHERE email = ?')
      .get(body.email) as any;

    if (!row) return res.status(401).send({ error: 'Invalid credentials' });
    const ok = await argon2.verify(row.password_hash, body.password);
    if (!ok) return res.status(401).send({ error: 'Invalid credentials' });

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
  });

  // --- GET /auth/me ---
  app.get('/auth/me', async (req: any, res) => {
    try {
      const auth = req.headers.authorization;
      if (!auth?.startsWith('Bearer ')) {
        return res.status(401).send({ error: 'Missing token' });
      }
      const token = auth.slice(7);
      const decoded: any = app.jwt.verify(token);
      const uid = decoded?.uid;
      if (!uid) {
        return res.status(400).send({ error: 'Invalid token payload' });
      }
      const row = db
        .prepare('SELECT id, email, display_name, created_at FROM users WHERE id = ?')
        .get(uid) as any;

      if (!row) return res.status(404).send({ error: 'User not found' });

      return res.send({
        id: row.id,
        email: row.email,
        displayName: row.display_name,
        createdAt: row.created_at
      });
    } catch (e) {
      app.log.error(e);
      return res.status(401).send({ error: 'Invalid token' });
    }
  });

  // --- POST /auth/refresh ---
  app.post('/auth/refresh', async (req: any, res) => {
    try {
      const cookieRt = req.cookies?.[COOKIE_NAME];
      const bodyRt = (req.body && typeof req.body === 'object') ? (req.body.refreshToken as string | undefined) : undefined;
      const rt = cookieRt || bodyRt;
      if (!rt) return res.status(401).send({ error: 'Missing refresh token' });

      const row = db.prepare(
        `SELECT rt.token, rt.expires_at, rt.revoked, u.id AS user_id, u.email, u.display_name
         FROM refresh_tokens rt
         JOIN users u ON u.id = rt.user_id
         WHERE rt.token = ?`
      ).get(rt) as any;

      if (!row) return res.status(401).send({ error: 'Invalid refresh token' });
      if (row.revoked) return res.status(401).send({ error: 'Refresh token revoked' });
      if (new Date(row.expires_at).getTime() < Date.now()) {
        db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE token = ?').run(rt);
        return res.status(401).send({ error: 'Refresh token expired' });
      }

      const newRt = rotateRefreshToken(db, rt, row.user_id);
      setRefreshCookie(res, newRt);

      const access = app.jwt.sign({ uid: row.user_id, email: row.email }, { expiresIn: ACCESS_TTL });
      return res.send({ token: access });
    } catch (e) {
      app.log.error(e);
      return res.status(401).send({ error: 'Invalid token' });
    }
  });

  // --- POST /auth/logout ---
  app.post('/auth/logout', async (req: any, res) => {
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

  // --- DELETE /auth/sessions (optionnel) ---
  app.delete('/auth/sessions', async (req: any, res) => {
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
}