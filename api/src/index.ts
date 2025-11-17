import Fastify from 'fastify';
import type { FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import websocket from '@fastify/websocket';
import cookie from '@fastify/cookie';

declare const process: any;

import authPlugin from './middleware/auth.js';
import { registerAuthRoutes } from './auth/routes.js';
import { registerUserRoutes } from './users/routes.js';
import db, { migrate } from './db/db.js';
import { registerChatWS } from './chat/ws.js';
import { registerGameWS } from './game/ws.js';

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info'
  }
});

await app.register(cors, {
  origin: process.env.CORS_ORIGIN || 'https://localhost',
  credentials: true
});
await app.register(helmet, { contentSecurityPolicy: false });
await app.register(websocket);
await app.register(cookie);
await app.register(authPlugin);

try {
  await migrate();
  app.log.info('✅ Database migrated successfully');
} catch (e) {
  app.log.error(e, '❌ Migration failed');
  process.exit(1);
}

app.get('/health', async () => ({ ok: true }));
app.get('/ready', async (_req: FastifyRequest, res: FastifyReply) => {
  try {
    db.prepare('SELECT 1').get();
    return { ok: true };
  } catch {
    return res.status(500).send({ ok: false });
  }
});

await registerAuthRoutes(app, db);
await registerUserRoutes(app, db);
registerChatWS(app);
registerGameWS(app);

const port = Number(process.env.PORT || 3000);
app.listen({ port, host: '0.0.0.0' })
  .then(() => app.log.info(`🚀 API running on port ${port}`))
  .catch((e: any) => { app.log.error(e); process.exit(1); });