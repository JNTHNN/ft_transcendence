import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';

export default fp(async (app) => {
  app.register(jwt, { secret: process.env.JWT_SECRET || 'dev-secret' });

  app.decorate('auth', async (req: any) => {
    await req.jwtVerify();
  });
});

declare module 'fastify' {
  interface FastifyInstance {
    auth: (req: any) => Promise<void>;
  }
}