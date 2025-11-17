import { demoAuth } from "./demoAuth";

const API = (import.meta as any).env?.VITE_API_URL || "https://api.localhost";

export async function api(path: string, init: RequestInit = {}) {
  // Mode démo : intercepter les appels API
  if (demoAuth.isActive()) {
    return handleDemoAPI(path, init);
  }

  const doFetch = () =>
    fetch(`${API}${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...(init.headers || {}) },
      credentials: "include",
    });

  let res = await doFetch();

  // Optional token refresh
  if (res.status === 401 && path !== "/auth/refresh") {
    const r = await fetch(`${API}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
    });
    if (r.ok) res = await doFetch();
  }

  if (!res.ok) throw new Error(`${res.status}`);
  try { return await res.json(); } catch { return {}; }
}

// Simuler les réponses API en mode démo
function handleDemoAPI(path: string, init: RequestInit = {}) {
  console.log('🎭 Mode démo - API call:', path);
  
  // Simule un délai réseau
  return new Promise((resolve) => {
    setTimeout(() => {
      if (path === "/auth/me") {
        resolve(demoAuth.getDemoUser());
      } else if (path === "/health") {
        resolve({ 
          status: "ok", 
          mode: "demo",
          message: "Mode démo activé - API simulée" 
        });
      } else if (path === "/auth/logout") {
        demoAuth.disableDemoMode();
        resolve({ message: "Déconnexion du mode démo" });
      } else {
        // Réponse générique pour les autres endpoints
        resolve({ 
          success: true, 
          mode: "demo",
          message: "Réponse simulée en mode démo" 
        });
      }
    }, 100); // Délai de 100ms pour simuler le réseau
  });
}

