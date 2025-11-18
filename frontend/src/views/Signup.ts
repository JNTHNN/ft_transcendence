import { authManager } from "../auth";
import { router } from "../router";
import { oauth42Manager } from "../oauth42";
import { t } from "../i18n/index.js";

export default async function View() {
  if (authManager.isAuthenticated()) {
    router.navigate("/");
    return document.createElement("div");
  }

  const container = document.createElement("div");
  container.className = "max-w-md mx-auto mt-8";

  const form = document.createElement("form");
  form.className = "p-8 bg-prem rounded-lg shadow-xl";

  form.innerHTML = `
    <h1 class="font-display font-black text-4xl font-bold text-text mb-6">${t('auth.signup')}</h1>
    <div class="mb-4">
      <label class="block font-sans text-text mb-2">${t('auth.displayName')}</label>
      <input name="displayName" type="text" placeholder="${t('auth.displayNamePlaceholder')}" required
        class="w-full px-4 py-2 bg-gray-700 text-text border border-sec rounded-lg focus:outline-none focus:border-text font-sans" />
    </div>
    <div class="mb-4">
      <label class="block font-sans text-text mb-2">${t('auth.email')}</label>
      <input name="email" type="email" placeholder="${t('auth.emailPlaceholder')}" required
        class="w-full px-4 py-2 bg-gray-700 text-text border border-sec rounded-lg focus:outline-none focus:border-text font-sans" />
    </div>
    <div class="mb-4">
      <label class="block font-sans text-text mb-2">${t('auth.password')}</label>
      <input name="password" type="password" placeholder="••••••••" required minlength="6"
        class="w-full px-4 py-2 bg-gray-700 text-text border border-sec rounded-lg focus:outline-none focus:border-text font-sans" />
    </div>
    <button type="submit" id="signupBtn" class="w-full bg-sec hover:bg-opacity-80 text-text font-sans font-bold py-2 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed">
      ${t('auth.signup')}
    </button>

    ${oauth42Manager.isConfigured() ? `
    <div class="mt-4 relative">
      <div class="absolute inset-0 flex items-center">
        <div class="w-full border-t border-gray-600"></div>
      </div>
      <div class="relative flex justify-center text-sm">
        <span class="px-2 bg-prem text-gray-400 font-sans">${t('common.or')}</span>
      </div>
    </div>

    <button type="button" id="oauth42Btn" class="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-sans font-bold py-2 px-4 rounded-lg transition flex items-center justify-center space-x-2">
      <span class="text-xl">🚀</span>
      <span>${t('auth.signupWith42')}</span>
    </button>` : ''}

    <div id="error" class="mt-4 p-3 bg-red-900 text-red-200 rounded-lg text-sm font-sans hidden"></div>
    <div id="success" class="mt-4 p-3 bg-green-900 text-green-200 rounded-lg text-sm font-sans hidden"></div>
    <p class="mt-4 text-center font-sans text-text">
      ${t('auth.alreadyHaveAccount')} <a href="/login" class="text-sec hover:underline">${t('auth.login')}</a>
    </p>
  `;

  const signupBtn = form.querySelector("#signupBtn") as HTMLButtonElement;
  const oauth42Btn = form.querySelector("#oauth42Btn") as HTMLButtonElement | null;
  const errorDiv = form.querySelector("#error") as HTMLDivElement;
  const successDiv = form.querySelector("#success") as HTMLDivElement;

  const showError = (message: string) => {
    errorDiv.textContent = message;
    errorDiv.classList.remove("hidden");
    successDiv.classList.add("hidden");
  };

  const showSuccess = (message: string) => {
    successDiv.textContent = message;
    successDiv.classList.remove("hidden");
    errorDiv.classList.add("hidden");
  };

  if (oauth42Btn) {
    oauth42Btn.addEventListener("click", async () => {
      try {
        oauth42Btn.disabled = true;
        oauth42Btn.textContent = t('auth.loggingIn');

        const state = crypto.randomUUID();
        localStorage.setItem('oauth_state', state);
        window.location.href = oauth42Manager.generateAuthUrl(state);
      } catch (error) {
        showError(error instanceof Error ? error.message : t('errors.oauthError'));
        oauth42Btn.disabled = false;
        oauth42Btn.innerHTML = `
          <span class="text-xl">🚀</span>
          <span>${t('auth.signupWith42')}</span>
        `;
      }
    });
  }

  form.onsubmit = async (e) => {
    e.preventDefault();

    const fd = new FormData(form);
    const displayName = fd.get("displayName") as string;
    const email = fd.get("email") as string;
    const password = fd.get("password") as string;

    if (!displayName || !email || !password) {
      showError(t('errors.fillAllFields'));
      return;
    }

    if (password.length < 6) {
      showError(t('errors.passwordTooShort'));
      return;
    }

    signupBtn.disabled = true;
    signupBtn.textContent = t('auth.signingUp');
    errorDiv.classList.add("hidden");
    successDiv.classList.add("hidden");

    try {
      const result = await authManager.signup(email, password, displayName);

      if (result.success) {
        showSuccess(t('messages.signupSuccess'));
        setTimeout(() => {
          router.navigate("/");
        }, 1000);
      } else {
        showError(result.error || t('errors.signupFailed'));
      }
    } catch (error: any) {
      showError(`${t('errors.networkError')}: ${error.message}`);
    } finally {
      signupBtn.disabled = false;
      signupBtn.textContent = t('auth.signup');
    }
  };

  container.appendChild(form);
  return container;
}
