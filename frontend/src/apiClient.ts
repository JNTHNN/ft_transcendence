const API = (import.meta as any).env?.VITE_API_URL || "https://api.localhost";

export async function api(path: string, init: RequestInit = {}) {
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