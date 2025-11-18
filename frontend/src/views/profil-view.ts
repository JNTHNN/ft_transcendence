import { api } from "../api-client";
import { router } from "../router";
import { t } from "../i18n/index.js";

export async function ProfilView() {
  const wrap = document.createElement("div");
  wrap.className = "max-w-4xl mx-auto mt-8";

  wrap.innerHTML = `
    <h1 class="font-display font-black text-4xl font-bold text-text mb-6">${t('profile.title')}</h1>
    <div id="profile-content"></div>
  `;

  const content = wrap.querySelector("#profile-content") as HTMLDivElement;

  try {
    const user = await api("/auth/me");
    
    content.innerHTML = `
      <div class="bg-prem rounded-lg shadow-xl p-6 mb-6">
        <h2 class="font-display font-black text-3xl font-black text-text mb-4">${t('common.accountInfo')}</h2>
        <div class="space-y-2 font-sans text-text">
          <p><strong>${t('auth.displayName')}:</strong> ${user.displayName || user.username || t('messages.noData')}</p>
          <p><strong>${t('auth.email')}:</strong> ${user.email || t('messages.noData')}</p>
          <p><strong>ID:</strong> ${user.id || t('messages.noData')}</p>
        </div>
        <div class="mt-6">
          <button id="logout" class="bg-red-500 hover:bg-red-600 text-white font-sans font-bold py-2 px-6 rounded-lg transition">
            ${t('auth.logout')}
          </button>
        </div>
      </div>

      <div class="bg-prem rounded-lg shadow-xl p-6">
        <h2 class="font-display font-black text-3xl font-black text-text mb-4">${t('stats.title')}</h2>
        <div class="grid grid-cols-3 gap-4 text-center">
          <div class="bg-sec p-4 rounded-lg">
            <div class="font-display font-black text-3xl font-bold text-text">0</div>
            <div class="font-sans text-sm text-text">${t('stats.gamesPlayed')}</div>
          </div>
          <div class="bg-sec p-4 rounded-lg">
            <div class="font-display font-black text-3xl font-bold text-text">0</div>
            <div class="font-sans text-sm text-text">${t('stats.victories')}</div>
          </div>
          <div class="bg-sec p-4 rounded-lg">
            <div class="font-display font-black text-3xl font-bold text-text">0</div>
            <div class="font-sans text-sm text-text">${t('stats.defeats')}</div>
          </div>
        </div>
      </div>
    `;

    const logoutBtn = content.querySelector("#logout") as HTMLButtonElement;
    logoutBtn.onclick = async () => {
      try {
        await api("/auth/logout", { method: "POST" });
        router.navigate("/");
      } catch (error) {
        router.navigate("/");
      };
    };

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
