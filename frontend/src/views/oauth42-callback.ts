import { authManager } from '../auth';
import { router } from '../router';
import { t } from '../i18n/index.js';

export default async function View() {
  const container = document.createElement("div");
  container.className = "min-h-screen bg-bg flex items-center justify-center";

  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const state = urlParams.get('state');
  const error = urlParams.get('error');

  if (error) {
    container.innerHTML = `
      <div class="bg-prem rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
        <div class="text-center">
          <div class="text-6xl mb-4">❌</div>
          <h1 class="font-display text-2xl font-bold text-text mb-4">${t('errors.oauthCallbackFailed')}</h1>
          <p class="font-sans text-gray-400 mb-6">
            ${error === 'access_denied' ? t('errors.accessDenied') : t('errors.oauthCallbackFailed')}
          </p>
          <button id="backBtn" class="bg-sec hover:bg-opacity-80 text-text font-sans font-bold py-2 px-6 rounded-lg transition">
            ${t('common.back')}
          </button>
        </div>
      </div>
    `;

    const backBtn = container.querySelector('#backBtn') as HTMLButtonElement;
    backBtn.onclick = () => router.navigate('/');

    return container;
  }

  if (!code) {
    container.innerHTML = `
      <div class="bg-prem rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
        <div class="text-center">
          <div class="text-6xl mb-4">⚠️</div>
          <h1 class="font-display text-2xl font-bold text-text mb-4">${t('errors.missingToken')}</h1>
          <p class="font-sans text-gray-400 mb-6">${t('errors.oauthCallbackFailed')}</p>
          <button id="retryBtn" class="bg-sec hover:bg-opacity-80 text-text font-sans font-bold py-2 px-6 rounded-lg transition">
            ${t('common.retry')}
          </button>
        </div>
      </div>
    `;

    const retryBtn = container.querySelector('#retryBtn') as HTMLButtonElement;
    if (retryBtn) retryBtn.onclick = () => router.navigate('/login');

    return container;
  }

  container.innerHTML = `
    <div class="bg-prem rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
      <div class="text-center">
        <div class="animate-spin rounded-full h-16 w-16 border-b-2 border-sec mx-auto mb-4"></div>
        <h1 class="font-display text-2xl font-bold text-text mb-4">${t('auth.loggingIn')}</h1>
        <p class="font-sans text-gray-400" id="status">${t('chat.connecting')}</p>
      </div>
    </div>
  `;

  const statusElement = container.querySelector('#status') as HTMLParagraphElement;

  try {
    statusElement.textContent = t('chat.connecting');
    const result = await authManager.loginWithOAuth42(code, state || undefined);

    if (result.success) {
      statusElement.textContent = t('messages.loginSuccess');
      setTimeout(() => {
        router.navigate('/profile');
      }, 1000);
    } else if (result.requires2FA && result.tempToken) {
      sessionStorage.setItem('2fa_temp_token', result.tempToken);
      statusElement.textContent = t('twoFactorAuthRequired');
      setTimeout(() => {
        router.navigate('/2fa-login');
      }, 1500);
    } else {
      container.innerHTML = `
        <div class="bg-prem rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
          <div class="text-center">
            <div class="text-6xl mb-4">❌</div>
            <h1 class="font-display text-2xl font-bold text-text mb-4">${t('errors.loginFailed')}</h1>
            <p class="font-sans text-gray-400 mb-6">${result.error || t('errors.internalError')}</p>
            <div class="space-y-3">
              <button id="retryBtn" class="w-full bg-sec hover:bg-opacity-80 text-text font-sans font-bold py-2 px-6 rounded-lg transition">
                ${t('common.retry')}
              </button>
              <button id="backBtn" class="w-full bg-gray-600 hover:bg-gray-700 text-text font-sans font-bold py-2 px-6 rounded-lg transition">
                ${t('common.back')}
              </button>
            </div>
          </div>
        </div>
      `;

      const retryBtn = container.querySelector('#retryBtn') as HTMLButtonElement;
      const backBtn = container.querySelector('#backBtn') as HTMLButtonElement;

      if (retryBtn) retryBtn.onclick = () => router.navigate('/login');
      if (backBtn) backBtn.onclick = () => router.navigate('/');
    }
  } catch (error: any) {
    container.innerHTML = `
      <div class="bg-prem rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
        <div class="text-center">
          <div class="text-6xl mb-4">🔌</div>
          <h1 class="font-display text-2xl font-bold text-text mb-4">${t('errors.networkError')}</h1>
          <p class="font-sans text-gray-400 mb-6">${t('errors.networkError')}</p>
          <button id="backBtn" class="bg-gray-600 hover:bg-gray-700 text-text font-sans font-bold py-2 px-6 rounded-lg transition">
            ${t('common.back')}
          </button>
        </div>
      </div>
    `;

    const backBtn = container.querySelector('#backBtn') as HTMLButtonElement;
    if (backBtn) backBtn.onclick = () => router.navigate('/');
  }

  return container;
}
