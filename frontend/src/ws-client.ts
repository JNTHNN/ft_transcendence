export function connectWS(path: string, onMessage: (m:any)=>void) {
  const base = (import.meta as any).env?.VITE_WS_URL || "wss://api.localhost";
  const ws = new WebSocket(new URL(path, base));

  ws.onmessage = (e) => {
    try {
      onMessage(JSON.parse(e.data));
    } catch (error) {
      console.warn('WebSocket message parse error:', error);
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  return ws;
}
