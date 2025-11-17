export function connectWS(path: string, onMessage: (m:any)=>void) {
  const base = "wss://api.localhost";
  const ws = new WebSocket(new URL(path, base));
  ws.onmessage = (e) => { try { onMessage(JSON.parse(e.data)); } catch {} };
  return ws;
}