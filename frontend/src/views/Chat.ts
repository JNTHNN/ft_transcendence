import { connectWS } from "../wsClient";

export default async function View() {
  const wrap = document.createElement("div");
  wrap.className = "max-w-4xl mx-auto mt-8";
  
  wrap.innerHTML = `
    <h1 class="text-3xl font-bold text-text mb-6">Chat en direct</h1>
    <div class="bg-prem rounded-lg shadow-xl p-6">
      <div id="messages" class="h-96 overflow-y-auto mb-4 p-4 bg-sec rounded-lg">
        <p class="text-text/50">Connexion au chat...</p>
      </div>
      <form id="chatForm" class="flex gap-2">
        <input type="text" name="message" placeholder="Votre message..." required
          class="flex-1 px-4 py-2 bg-gray-700 text-text border border-sec rounded-lg focus:outline-none focus:border-text" />
        <button class="bg-sec hover:bg-opacity-80 text-prem font-bold py-2 px-6 rounded-lg transition">
          Envoyer
        </button>
      </form>
    </div>
  `;
  
  const messages = wrap.querySelector("#messages") as HTMLDivElement;
  const chatForm = wrap.querySelector("#chatForm") as HTMLFormElement;
  
  try {
    const ws = connectWS("/chat", (msg) => {
      const p = document.createElement("p");
      p.className = "mb-2 text-text";
      p.textContent = `${msg.username || "Anonyme"}: ${msg.text || JSON.stringify(msg)}`;
      messages.appendChild(p);
      messages.scrollTop = messages.scrollHeight;
    });
    
    chatForm.onsubmit = (e) => {
      e.preventDefault();
      const input = chatForm.message as HTMLInputElement;
      ws.send(JSON.stringify({ text: input.value }));
      input.value = "";
    };
    
    ws.onopen = () => {
      messages.innerHTML = '<p class="text-sec">✓ Connecté au chat</p>';
    };
    
    ws.onerror = () => {
      messages.innerHTML = '<p class="text-red-500">✗ Erreur de connexion</p>';
    };
  } catch (err) {
    messages.innerHTML = '<p class="text-red-500">✗ Impossible de se connecter au chat</p>';
  }
  
  return wrap;
}
