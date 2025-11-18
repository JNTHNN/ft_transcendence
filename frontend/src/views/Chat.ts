import { connectWS } from "../ws-client";
import { t } from "../i18n/index.js";

export default async function View() {
  const wrap = document.createElement("div");
  wrap.className = "max-w-4xl mx-auto mt-8";

  wrap.innerHTML = `
    <h1 class="font-display font-black text-4xl font-bold text-text mb-6">${t('chat.title')}</h1>
    <div class="bg-prem rounded-lg shadow-xl p-6">
      <div id="messages" class="h-96 overflow-y-auto mb-4 p-4 bg-text/70 rounded-lg">
        <p class="font-sans text-text/50">${t('chat.connecting')}</p>
      </div>
      <form id="chatForm" class="flex gap-2">
        <input type="text" name="message" placeholder="${t('chat.typeMessage')}" required
          class="flex-1 px-4 py-2 bg-gray-700 text-text border border-sec rounded-lg focus:outline-none focus:border-text font-sans" />
        <button class="bg-sec hover:bg-opacity-80 text-text font-sans font-bold py-2 px-6 rounded-lg transition">
          ${t('chat.send')}
        </button>
      </form>
    </div>
  `;

  const messages = wrap.querySelector("#messages") as HTMLDivElement;
  const chatForm = wrap.querySelector("#chatForm") as HTMLFormElement;

  try {
    const ws = connectWS('/chat', (msg: any) => {
      const p = document.createElement("p");
      p.className = "mb-2 font-sans text-text";
      p.textContent = `${msg.username || t('common.anonymous')}: ${msg.text || JSON.stringify(msg)}`;
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
      messages.innerHTML = `<p class="font-sans text-sec">✓ ${t('chat.online')}</p>`;
    };

    ws.onerror = () => {
      messages.innerHTML = `<p class="font-sans text-red-500">✗ ${t('chat.disconnected')}</p>`;
    };
  } catch (error) {
    messages.innerHTML = `<p class="font-sans text-red-500">✗ ${t('chat.disconnected')}</p>`;
  }

  return wrap;
}
