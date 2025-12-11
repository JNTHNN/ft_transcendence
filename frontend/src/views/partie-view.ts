import { authManager } from "../auth";
import { router } from "../router";
import { t } from "../i18n/index.js";

export async function PartieView() {
  // Check authentication
  if (!authManager.isAuthenticated()) {
    router.navigate("/login");
    return document.createElement("div");
  }
  
  const wrap = document.createElement("div");
  wrap.className = "max-w-6xl mx-auto mt-8";

  wrap.innerHTML = `
    <h1 class="font-display font-black text-4xl font-bold text-text mb-6">${t('game.title')}</h1>

    <div id="game-content"></div>
  `;

  const content = wrap.querySelector("#game-content") as HTMLDivElement;

  content.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <!-- SOLO VS IA -->
        <div class="bg-prem rounded-lg shadow-xl p-6 flex flex-col justify-between">
          <div>
            <h2 class="font-display font-black text-2xl font-black text-text mb-4">${t('game.newGame')}</h2>
            <p class="font-sans text-text mb-4">${t('game.quickGameDesc')}</p>
          </div>
          <button id="btn-solo" class="w-full bg-sec hover:bg-opacity-80 text-text font-sans font-bold py-2 px-4 rounded-lg transition">
            ${t('game.play')} vs IA
          </button>
        </div>

        <!-- MULTIJOUEUR EN LIGNE -->
        <div class="bg-prem rounded-lg shadow-xl p-6 flex flex-col justify-between">
          <div>
            <h2 class="font-display font-black text-2xl font-black text-text mb-4">${t('game.multiplayer')}</h2>
            <p class="font-sans text-text mb-4">${t('game.multiplayerDesc')}</p>
          </div>
          <button id="btn-online" class="w-full bg-sec hover:bg-opacity-80 text-text font-sans font-bold py-2 px-4 rounded-lg transition">
            ${t('game.findOpponent')}
          </button>
        </div>

        <!-- LOCAL 2 JOUEURS -->
        <div class="bg-prem rounded-lg shadow-xl p-6 flex flex-col justify-between">
          <div>
            <h2 class="font-display font-black text-2xl font-black text-text mb-4">${t('game.localGame')}</h2>
            <p class="font-sans text-text mb-4">${t('game.localGameDesc')}</p>
          </div>
          <button id="btn-local" class="w-full bg-sec hover:bg-opacity-80 text-text font-sans font-bold py-2 px-4 rounded-lg transition">
            ${t('common.create')}
          </button>
        </div>
      </div>

      <div class="mt-6 text-center">
        <a href="/" class="font-sans text-sec hover:underline">← ${t('common.back')}</a>
      </div>
    `;

    // 🎯 ÉVÉNEMENTS DES BOUTONS
    const btnSolo = content.querySelector("#btn-solo") as HTMLButtonElement;
    const btnOnline = content.querySelector("#btn-online") as HTMLButtonElement;
    const btnLocal = content.querySelector("#btn-local") as HTMLButtonElement;

    // Solo vs IA
    btnSolo.onclick = () => {
      router.navigate("/match?mode=solo");
    };

    // En ligne (Remote)
    btnOnline.onclick = () => {
      router.navigate("/match?mode=online");
    };

    // Local 2 joueurs
    btnLocal.onclick = () => {
      router.navigate("/match?mode=local");
    };

  return wrap;
}
