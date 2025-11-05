import type { FastifyInstance } from "fastify";
import helmet from "@fastify/helmet";

export async function attachSecurity(app: FastifyInstance) {
  await app.register(helmet, {
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "img-src": ["'self'", "data:"],
        "script-src": ["'self'"],
        "style-src": ["'self'", "'unsafe-inline'"]
      }
    }
  });
  app.addHook("onRequest", async (_req, reply) => {
    reply.header("Cross-Origin-Opener-Policy", "same-origin");
    reply.header("Cross-Origin-Embedder-Policy", "require-corp");
  });
}