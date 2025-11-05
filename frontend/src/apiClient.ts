const API = (import.meta as any).env?.VITE_API_URL || "https://api.localhost";
export async function api(path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    headers: { "content-type": "application/json", ...(init?.headers||{}) }, ...init
  });
  if (!res.ok) throw new Error(`${res.status}`);
  try { return await res.json(); } catch { return {}; }
}
