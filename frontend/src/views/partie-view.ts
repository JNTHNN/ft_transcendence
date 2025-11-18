import { api } from "../api-client";
import { t } from "../i18n/index.js";

export async function PartieView() {
  const wrap = document.createElement("div");
  wrap.className = "max-w-6xl mx-auto mt-8";

  wrap.innerHTML = `
    <h1 class="font-display font-black text-4xl font-bold text-text mb-6">${t('game.title')}</h1>

    <div id="game-content"></div>
  `;

  const content = wrap.querySelector("#game-content") as HTMLDivElement;

  try {
    await api("/auth/me");
    
    content.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="bg-prem rounded-lg shadow-xl p-6 flex flex-col justify-between">
          <div>
            <h2 class="font-display font-black text-2xl font-black text-text mb-4">${t('game.newGame')}</h2>
            <p class="font-sans text-text mb-4">${t('game.quickGameDesc')}</p>
          </div>
          <button class="w-full bg-sec hover:bg-opacity-80 text-text font-sans font-bold py-2 px-4 rounded-lg transition">
            ${t('game.play')}
          </button>
        </div>

        <div class="bg-prem rounded-lg shadow-xl p-6 flex flex-col justify-between">
          <div>
            <h2 class="font-display font-black text-2xl font-black text-text mb-4">${t('game.multiplayer')}</h2>
            <p class="font-sans text-text mb-4">${t('game.multiplayerDesc')}</p>
          </div>
          <button class="w-full bg-sec hover:bg-opacity-80 text-text font-sans font-bold py-2 px-4 rounded-lg transition">
            ${t('game.findOpponent')}
          </button>
        </div>

        <div class="bg-prem rounded-lg shadow-xl p-6 flex flex-col justify-between">
          <div>
            <h2 class="font-display font-black text-2xl font-black text-text mb-4">${t('game.customGame')}</h2>
            <p class="font-sans text-text mb-4">${t('game.customGameDesc')}</p>
          </div>
          <button class="w-full bg-sec hover:bg-opacity-80 text-text font-sans font-bold py-2 px-4 rounded-lg transition">
${t('common.create')}
          </button>
        </div>
      </div>

      <div class="mt-6 text-center">
        <a href="/match" class="font-sans text-sec hover:underline">${t('game.spectate')} →</a>
      </div>
    `;

  } catch (error) {
    content.innerHTML = `
      <div class="bg-prem rounded-lg shadow-xl p-6 text-center">
        <p class="font-sans text-text mb-4">${t('auth.loginRequired')}</p>
        <a href="/login" class="inline-block bg-sec hover:bg-opacity-80 text-text font-sans font-bold py-2 px-6 rounded-lg transition">
          ${t('auth.login')}
        </a>
      </div>
    `;
  }

  return wrap;
}
