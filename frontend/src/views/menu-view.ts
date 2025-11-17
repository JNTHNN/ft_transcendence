import { api } from "../api-client";
import { i18n } from "../i18n";

export async function MenuView() {
  const wrap = document.createElement("div");
  wrap.className = "max-w-4xl mx-auto mt-8";

  wrap.innerHTML = `
    <h1 class="font-display font-black text-5xl font-bold text-text mb-8">Tournois de Pong</h1>
    <div class="bg-prem rounded-lg shadow-xl p-6 mb-6">
      <h2 class="font-display font-black text-3xl font-black text-text mb-4">Bienvenue sur ft_transcendence</h2>
      <p class="font-sans text-text mb-4">
        Participez à des tournois de Pong en ligne, affrontez d'autres joueurs et grimpez dans le classement !
      </p>
      <div class="flex gap-4">
        <a href="/login" class="bg-sec hover:bg-opacity-80 text-text font-sans font-bold py-2 px-6 rounded-lg transition">
          Se connecter
        </a>
        <a href="/signup" class="bg-gray-700 hover:bg-gray-600 text-text font-sans font-bold py-2 px-6 rounded-lg border border-sec transition">
          S'inscrire
        </a>
      </div>
    </div>

    <div class="bg-prem rounded-lg shadow-xl p-6">
      <h3 class="font-display font-black text-2xl font-black text-text mb-4">État du serveur</h3>
      <pre id="health" class="p-4 bg-gray-700 text-text rounded-lg text-sm overflow-auto font-sans"></pre>
    </div>

    <div class="mt-6">
      <p class="text-center font-sans">
        <a href="/match" class="text-sec hover:underline">Voir un match de démonstration →</a>
      </p>
    </div>
  `;

  const pre = wrap.querySelector("#health") as HTMLPreElement;
  try {
    pre.textContent = JSON.stringify(await api("/health"), null, 2);
  } catch {
    pre.textContent = i18n.translate('errors.apiOffline');
  }

  return wrap;
}
