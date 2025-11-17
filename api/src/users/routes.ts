import type { FastifyInstance } from 'fastify';
import Database from 'better-sqlite3';
import { z } from 'zod';

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
    try {
      const uid = req.user?.uid;
      if (!uid) return res.status(401).send({ error: "Unauthorized" });

      const body = updateSchema.parse(req.body);
      if (!body.displayName) return res.status(400).send({ error: "Nothing to update" });

      db.prepare("UPDATE users SET display_name = ? WHERE id = ?").run(body.displayName, uid);
      const row = db.prepare("SELECT id, email, display_name AS displayName, created_at AS createdAt FROM users WHERE id = ?").get(uid);
      return res.send(row);
    } catch (e) {
      app.log.error(e);
      return res.status(500).send({ error: "Update failed" });
    }
  });

  app.patch('/users/profile', async (req: any, res) => {
    try {
      const auth = req.headers.authorization;
      if (!auth?.startsWith('Bearer ')) {
        return res.status(401).send({ error: 'Missing token' });
      }
      const token = auth.slice(7);
      const decoded: any = app.jwt.verify(token);
      const uid = decoded?.uid;
      if (!uid) return res.status(400).send({ error: 'Invalid token payload' });

      const body = updateSchema.parse(req.body);
      if (!body.displayName && !body.email) return res.status(400).send({ error: "Nothing to update" });

      if (body.email) {
        const existingUser = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(body.email, uid) as any;
        if (existingUser) {
          return res.status(409).send({ error: 'Email already exists' });
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
      return res.status(500).send({ error: "Update failed" });
    }
  });
}