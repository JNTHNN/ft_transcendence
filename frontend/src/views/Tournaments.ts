import { api } from "../apiClient";
export default async function View() {
  const wrap = document.createElement("div");
  wrap.innerHTML = `<h1>Tournaments</h1><pre id="out"></pre><p><a href="/match">Open Match viewer</a></p>`;
  const pre = wrap.querySelector("#out") as HTMLPreElement;
  try { pre.textContent = JSON.stringify(await api("/health"),null,2); }
  catch { pre.textContent = "API offline"; }
  return wrap;
}
