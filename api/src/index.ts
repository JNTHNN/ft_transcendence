import Fastify from 'fastify';
import type { FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import websocket from '@fastify/websocket';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';

import fs from 'fs';
import path from 'path';

declare const process: any;

import authPlugin from './middleware/auth.js';
import { registerAuthRoutes } from './auth/routes.js';
import { register2FARoutes } from './auth/2fa-routes.js';
import { registerUserRoutes } from './users/routes.js';
import db, { migrate } from './db/db.js';
import { registerChatWS } from './chat/ws.js';
import { registerGameWS } from './game/ws.js';
import { registerFriendsWS } from './friends/ws.js';
import { initPresenceService } from './core/presence.js';
import { registerGameRoutes } from './game/routes.js';
import { gameManager } from './game/GameManager.js';
import tournamentRoutes from './tournaments/routes.js';
import blockchainRoutes from './blockchain/routes.js';
import { TournamentService } from './core/tournament.js';

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'warn'
  }
});

await app.register(cors, {
  origin: [
    process.env.CORS_ORIGIN || 'https://localhost',
    'https://localhost:8443',
    'https://app.localhost:8443'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept-Language']
});
await app.register(helmet, { 
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: false
});
await app.register(websocket);
await app.register(cookie);
await app.register(multipart, {
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max
  }
});
await app.register(authPlugin);

try {
  await migrate();
  
  // Initialiser le service de présence
  initPresenceService(db);
  
  // Injecter la base de données dans GameManager
  gameManager.setDatabase(db);
  
  // Décorer l'app avec la base de données pour les plugins
  app.decorate('db', db);

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
await register2FARoutes(app, db);
await registerUserRoutes(app, db);
await registerGameRoutes(app);
await registerGameWS(app);
await registerFriendsWS(app, db);
await app.register(tournamentRoutes);
await app.register(blockchainRoutes);

await registerChatWS(app);

app.get('/uploads/:filename', async (req: FastifyRequest<{Params: {filename: string}}>, res: FastifyReply) => {
  const { filename } = req.params;
  
  try {
    const filePath = path.join('/data/uploads', filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).send({ error: 'File not found' });
    }

    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp'
    };

    const mimeType = mimeTypes[ext];
    if (!mimeType) {
      return res.status(400).send({ error: 'Invalid file type' });
    }

    res.header('Cross-Origin-Resource-Policy', 'cross-origin');
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Cache-Control', 'public, max-age=86400');
    res.type(mimeType);
    
    return res.send(fs.readFileSync(filePath));
  } catch (e) {
    app.log.error(e);
    return res.status(500).send({ error: 'File serving failed' });
  }
});


// Cleanup stale matches on startup
TournamentService.cleanupStaleMatches();

const port = Number(process.env.PORT || 3000);
app.listen({ port, host: '0.0.0.0' })
  .then(() => {
    console.log(`🚀 Server ready at port ${port}`);
  })
  .catch((e: any) => { 
    app.log.error(e); 
    process.exit(1); 
  });