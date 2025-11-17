import { demoAuth } from "./demo-auth";
import { authManager } from "./auth";
import { i18n } from "./i18n";

const API = (import.meta as any).env?.VITE_API_BASE_URL || "https://api.localhost";

export async function api(path: string, init: RequestInit = {}) {
  if (demoAuth.isActive()) {
    return handleDemoAPI(path, init);
  }

  const token = authManager.getToken();
  const headers: Record<string, string> = {
    "content-type": "application/json"
  };

  if (init.headers) {
    Object.assign(headers, init.headers);
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const doFetch = () =>
    fetch(`${API}${path}`, {
      ...init,
      headers,
      credentials: "include",
    });

  let res = await doFetch();

  if (res.status === 401 && path !== "/auth/refresh" && authManager.isAuthenticated()) {
    console.log('🔑 Token expired, attempting refresh...');
    const refreshed = await authManager['refreshToken']?.() || false;
    if (refreshed) {
      const newToken = authManager.getToken();
      if (newToken) {
        const retryHeaders: Record<string, string> = {
          "content-type": "application/json",
          "Authorization": `Bearer ${newToken}`
        };
        if (init.headers) {
          Object.assign(retryHeaders, init.headers);
        }
        res = await fetch(`${API}${path}`, {
          ...init,
          headers: retryHeaders,
          credentials: "include",
        });
      }
    } else {
      throw new Error('Authentication expired');
    }
  }  if (!res.ok) {
    const errorData = await res.text();
    let errorMessage;
    try {
      const parsed = JSON.parse(errorData);
      errorMessage = parsed.error || parsed.message || `HTTP ${res.status}`;
    } catch {
      errorMessage = `HTTP ${res.status}: ${res.statusText}`;
    }
    throw new Error(errorMessage);
  }

  try {
    return await res.json();
  } catch {
    return {};
  }
}

const DEMO_NETWORK_DELAY = 100;

function handleDemoAPI(path: string, init: RequestInit = {}) {
  console.log('🎭 Mode démo - API call:', path, init.method || 'GET');

  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        if (path === "/auth/me") {
          resolve(demoAuth.getDemoUser());
        } else if (path === "/health") {
          resolve({
            ok: true,
            mode: "demo",
            message: "Mode démo activé - API simulée"
          });
        } else if (path === "/auth/logout") {
          demoAuth.disableDemoMode();
          resolve({ message: i18n.translate('auth.demoLogout') });
        } else if (path === "/auth/login" && init.method === "POST") {
          resolve({
            token: "demo_token_" + Date.now(),
            user: demoAuth.getDemoUser()
          });
        } else if (path === "/auth/signup" && init.method === "POST") {
          resolve({
            token: "demo_token_" + Date.now(),
            user: demoAuth.getDemoUser()
          });
        } else {
          resolve({
            success: true,
            mode: "demo",
            message: i18n.translate('auth.demoResponse')
          });
        }
      } catch (error) {
        reject(new Error('Demo API error: ' + error));
      }
    }, DEMO_NETWORK_DELAY);
  });
}
