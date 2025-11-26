export function connectWS(path: string, onMessage: (m: any) => void) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  
  // 🔧 CHANGEMENT : Force api.localhost au lieu d'app.localhost
  const port = window.location.port ? `:${window.location.port}` : '';
  const wsUrl = `${protocol}//api.localhost${port}${path}`;
  
  console.log('🔌 Connexion WebSocket à:', wsUrl);
  
  const ws = new WebSocket(wsUrl);
  
  ws.onopen = () => {
    console.log('✅ WebSocket connecté');
  };
  
  ws.onmessage = (e) => {
    try {
      onMessage(JSON.parse(e.data));
    } catch (error) {
      console.warn('WebSocket message parse error:', error);
    }
  };
  
  ws.onerror = (error) => {
    console.error('❌ Erreur WebSocket:', error);
  };
  
  ws.onclose = () => {
    console.log('🔌 WebSocket fermé');
  };
  
  return ws;
}