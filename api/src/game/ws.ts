import type { FastifyInstance, FastifyRequest } from "fastify";
import "@fastify/websocket"; // <— important

const room = new Set<any>();

export async function registerGameWS(app: FastifyInstance) {
  app.get("/ws/game", { websocket: true }, (conn: any, _req: FastifyRequest) => {
    room.add(conn);
    conn.socket.on("close", () => room.delete(conn));
  });

  // Broadcast d'état fictif 1×/s
  setInterval(() => {
    const msg = JSON.stringify({
      type: "game/state",
      v: 1,
      data: {
        matchId: "m1",
        ball: { x: Math.random(), y: Math.random(), vx: 0.1, vy: 0.1 },
        paddles: { A: 0.5, B: 0.5 },
        score: { A: 0, B: 0 },
        t: Date.now()
      }
    });
    for (const c of room) c.socket.send(msg);
  }, 1000);
}