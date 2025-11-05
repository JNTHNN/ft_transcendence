import type { FastifyInstance, FastifyRequest } from "fastify";
import "@fastify/websocket"; // <— important: module d’augmentation de types

export async function registerChatWS(app: FastifyInstance) {
  app.get("/ws/chat", { websocket: true }, (connection: any, _req: FastifyRequest) => {
    connection.socket.on("message", (raw: Buffer) => {
      connection.socket.send(raw.toString());
    });
    connection.socket.on("close", () => {
      // cleanup si besoin
    });
  });
}