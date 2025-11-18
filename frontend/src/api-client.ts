import { authManager } from "./auth";
import { i18n } from "./i18n";

const API = (import.meta as any).env?.VITE_API_BASE_URL || "https://api.localhost";

export async function api(path: string, init: RequestInit = {}) {

  const token = authManager.getToken();
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "Accept-Language": i18n.getCurrentLanguage()
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

  let res;
  try {
    res = await doFetch();
  } catch (error) {
    console.error('Network fetch error:', error);
    throw new Error(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  if (res.status === 401 && 
      path !== "/auth/refresh" && 
      path !== "/auth/delete-account" && 
      path !== "/auth/change-password" && 
      authManager.isAuthenticated()) {

    const refreshed = await authManager['refreshToken']?.() || false;
    if (refreshed) {
      const newToken = authManager.getToken();
      if (newToken) {
        const retryHeaders = {
          ...headers,
          "Authorization": `Bearer ${newToken}`
        };
        try {
          res = await fetch(`${API}${path}`, {
            ...init,
            headers: retryHeaders,
            credentials: "include",
          });
        } catch (error) {
          console.error('Network fetch error on retry:', error);
          throw new Error(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    } else {
      throw new Error('Authentication expired');
    }
  }

  if (!res.ok) {
    const errorData = await res.text();
    let errorMessage;
    try {
      const parsed = JSON.parse(errorData);

      errorMessage = parsed.error || parsed.message || `Erreur HTTP ${res.status}: ${res.statusText}`;
    } catch {

      errorMessage = errorData || `Erreur HTTP ${res.status}: ${res.statusText}`;
    }
    
    console.error(`API Error [${res.status}]:`, errorMessage);
    throw new Error(errorMessage);
  }

  try {
    return await res.json();
  } catch {
    return {};
  }
}
