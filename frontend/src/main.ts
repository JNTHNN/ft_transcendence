import './style.css';
import { router } from './router';
import { menuManager } from './views/Menu';
import { authManager } from './auth';
import { i18n, t } from './i18n/index.js';

const initApp = async () => {
  i18n.initialize().then(() => {
    window.dispatchEvent(new CustomEvent('i18nReady'));
  });

  if (authManager.isLoading()) {
    const loadingElement = document.createElement('div');
    loadingElement.className = 'flex items-center justify-center min-h-screen bg-bg text-text';
    loadingElement.innerHTML = `
      <div class="text-center">
        <div class="animate-spin rounded-full h-16 w-16 border-b-2 border-sec mx-auto mb-4"></div>
        <p class="font-sans text-lg">${t('common.loading')}</p>
      </div>
    `;
    document.body.appendChild(loadingElement);

    setTimeout(initApp, 100);
    return;
  }

  const loadingElements = document.querySelectorAll('.flex.items-center.justify-center.min-h-screen');
  loadingElements.forEach(el => el.remove());

  menuManager;

  router.start();
};

initApp();
