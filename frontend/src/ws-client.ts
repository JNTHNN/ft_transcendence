import { authManager } from "./auth.js";

export function connectWS(path: string, onMessage: (m: any) => void, needsAuth = false) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  
  // 🔧 CHANGEMENT : Force api.localhost au lieu d'app.localhost
  const port = window.location.port ? `:${window.location.port}` : '';
  let wsUrl = `${protocol}//api.localhost${port}${path}`;
  
  // Ajouter le token d'auth si nécessaire
  if (needsAuth) {
    const token = authManager.getToken();

    if (token) {
      wsUrl += `?token=${encodeURIComponent(token)}`;

    } else {

    }
  }
  

  
  const ws = new WebSocket(wsUrl);
  
  ws.onopen = () => {

  };
  
  ws.onmessage = (e) => {
    try {
      onMessage(JSON.parse(e.data));
    } catch (error) {

    }
  };
  
  ws.onerror = () => {

  };
  
  ws.onclose = () => {

  };
  
  return ws;
}
