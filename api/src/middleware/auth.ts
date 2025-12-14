import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import { trackUserActivity } from './presence.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

export default fp(async (app) => {
  app.register(jwt, { 
    secret: JWT_SECRET,
    sign: {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    }
  });

  app.decorate('auth', async (req: any) => {
    await req.jwtVerify();
    await trackUserActivity(req, null as any);
  });
});

declare module 'fastify' {
  interface FastifyInstance {
    auth: (req: any) => Promise<void>;
  }
}

export async function authMiddleware(req: any, reply: any) {
  try {
    await req.jwtVerify();
    await trackUserActivity(req, reply);
  } catch (error) {
    reply.status(401).send({ error: 'Unauthorized' });
  }
}