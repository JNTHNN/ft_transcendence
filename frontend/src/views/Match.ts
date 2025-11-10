import { connectWS } from "../wsClient";
export default async function View() {
  const wrap = document.createElement("div");
  wrap.innerHTML = `<h1>Match</h1><pre id="state"></pre>`;
  const pre = wrap.querySelector("#state") as HTMLPreElement;
  connectWS("/ws/game", (m) => { if (m.type==="game/state") pre.textContent = JSON.stringify(m.data,null,2); });
  return wrap;
}
