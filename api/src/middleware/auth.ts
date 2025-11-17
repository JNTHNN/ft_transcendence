import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';

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
  });
});

declare module 'fastify' {
  interface FastifyInstance {
    auth: (req: any) => Promise<void>;
  }
}