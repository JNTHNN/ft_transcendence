import type { FastifyInstance } from 'fastify';
import Database from 'better-sqlite3';
import { z } from 'zod';

const updateSchema = z.object({
  displayName: z.string().min(2).max(50).optional(),
});

export async function registerUserRoutes(app: FastifyInstance, db: Database.Database) {
  // --- GET /users ---
  app.get('/users', { preHandler: app.auth }, async (_req, res) => {
    const rows = db.prepare("SELECT id, email, display_name AS displayName, created_at AS createdAt FROM users").all();
    return res.send(rows);
  });

  // --- PATCH /users/me ---
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
}