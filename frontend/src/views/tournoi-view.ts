import { api } from "../api-client";
import { t } from "../i18n/index.js";

export async function TournoiView() {
  const wrap = document.createElement("div");
  wrap.className = "max-w-6xl mx-auto mt-8";

  wrap.innerHTML = `
    <h1 class="font-display font-black text-4xl font-bold text-text mb-6">${t('tournament.title')}</h1>

    <div id="tournament-content"></div>
  `;

  const content = wrap.querySelector("#tournament-content") as HTMLDivElement;

  try {
    await api("/auth/me");
    
    content.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="bg-prem rounded-lg shadow-xl p-6">
          <h2 class="font-display font-black text-3xl font-black text-text mb-4">${t('tournament.availableTournaments')}</h2>
          <ul class="space-y-2 font-sans text-text mb-4">
            <li class="p-3 bg-sec rounded-lg">🏆 ${t('tournament.weekly')} - 128 ${t('tournament.participants')}</li>
            <li class="p-3 bg-sec rounded-lg">🏆 ${t('tournament.monthly')} - 256 ${t('tournament.participants')}</li>
            <li class="p-3 bg-sec rounded-lg">🏆 ${t('tournament.beginners')} - 64 ${t('tournament.participants')}</li>
          </ul>
          <button class="w-full bg-sec hover:bg-opacity-80 text-text font-sans font-bold py-2 px-4 rounded-lg transition">
            ${t('tournament.joinTournament')}
          </button>
        </div>

        <div class="bg-prem rounded-lg shadow-xl p-6">
          <h2 class="font-display font-black text-3xl font-black text-text mb-4">${t('tournament.myTournaments')}</h2>
          <p class="text-center font-sans text-text/50 py-8">
            ${t('messages.noData')}
          </p>
        </div>
      </div>

      <div class="mt-6 bg-prem rounded-lg shadow-xl p-6">
        <h2 class="font-display font-black text-3xl font-black text-text mb-4">${t('tournament.globalRanking')}</h2>
        <div class="overflow-x-auto">
          <table class="w-full font-sans text-text">
            <thead class="border-b border-sec">
              <tr>
                <th class="py-3 text-left">${t('stats.rank')}</th>
                <th class="py-3 text-left">${t('common.player')}</th>
                <th class="py-3 text-right">${t('stats.gamesWon')}</th>
                <th class="py-3 text-right">${t('stats.points')}</th>
              </tr>
            </thead>
            <tbody>
              <tr class="border-b border-sec/50">
                <td class="py-3">1</td>
                <td class="py-3">mleonet</td>
                <td class="py-3 text-right">99</td>
                <td class="py-3 text-right">1250</td>
              </tr>
              <tr class="border-b border-sec/50">
                <td class="py-3">2</td>
                <td class="py-3">abolor-e</td>
                <td class="py-3 text-right">67</td>
                <td class="py-3 text-right">1180</td>
              </tr>
              <tr class="border-b border-sec/50">
                <td class="py-3">3</td>
                <td class="py-3">lboumahd</td>
                <td class="py-3 text-right">42</td>
                <td class="py-3 text-right">1080</td>
              </tr>              <tr class="border-b border-sec/50">
                <td class="py-3">4</td>
                <td class="py-3">jbourgoi</td>
                <td class="py-3 text-right">35</td>
                <td class="py-3 text-right">1050</td>
              </tr>              <tr class="border-b border-sec/50">
                <td class="py-3">5</td>
                <td class="py-3">jgasparo</td>
                <td class="py-3 text-right">1</td>
                <td class="py-3 text-right">19</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

  } catch (error) {
    content.innerHTML = `
      <div class="bg-prem rounded-lg shadow-xl p-6 text-center">
        <p class="font-sans text-text mb-4">${t('auth.loginRequiredTournaments')}</p>
        <a href="/login" class="inline-block bg-sec hover:bg-opacity-80 text-text font-sans font-bold py-2 px-6 rounded-lg transition">
          ${t('auth.login')}
        </a>
      </div>
    `;
  }

  return wrap;
}
