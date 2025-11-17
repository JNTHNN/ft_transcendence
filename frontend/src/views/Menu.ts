import { router } from '../router';
import { demoAuth } from '../demo-auth';
import { authManager, type AuthState } from '../auth';
import { api } from '../api-client';
import { i18n, t } from '../i18n/index.js';
import { createLanguageButton, createLanguageModal } from '../components/language-selector.js';

interface FullUser {
  id: number;
  email: string;
  displayName: string;
  avatarUrl?: string;
  accountType: 'local' | 'oauth42';
}

export class MenuManager {
  private demoBtn: HTMLButtonElement | null = null;
  private demoStatus: HTMLParagraphElement | null = null;
  private authState: AuthState = authManager.getState();
  private unsubscribeAuth: (() => void) | null = null;
  private unsubscribeI18n: (() => void) | null = null;
  private fullUser: FullUser | null = null;

  constructor() {
    this.initializeMenu();
    this.setupDemoMode();
    this.setupAuthListener();
    this.setupLanguageListener();
  }

  private setupLanguageListener() {
    const callback = () => {
      this.updateMenuForAuthState();
    };
    i18n.addLanguageChangeListener(callback);
    this.unsubscribeI18n = () => i18n.removeLanguageChangeListener(callback);
  }

  private setupAuthListener() {
    this.unsubscribeAuth = authManager.onAuthChange(async (state) => {
      this.authState = state;
      if (state.isAuthenticated) {
        await this.loadFullUserData();
      } else {
        this.fullUser = null;
      }
      this.updateMenuForAuthState();
    });
  }

  private async loadFullUserData() {
    try {
      if (this.authState.isAuthenticated) {
        this.fullUser = await api('/auth/me');
      }
    } catch (error) {
      console.error('Failed to load full user data:', error);
      this.fullUser = null;
    }
  }

  private async initializeMenu() {
    if (this.authState.isAuthenticated) {
      await this.loadFullUserData();
    }
    this.updateMenuForAuthState();
    this.setupNavigation();
  }

  private updateMenuForAuthState() {
    const isAuthenticated = this.authState.isAuthenticated;
    const user = this.authState.user;

    const menuHTML = `
      <nav class="font-display text-2xl font-black flex flex-col p-4 space-y-2">
        <a href="/" class="menu-link px-4 py-3 text-text hover:bg-sec rounded-lg transition-colors">
          ${t('nav.home')}
        </a>
        ${isAuthenticated ? `
          <a href="/tournoi" class="menu-link px-4 py-3 text-text hover:bg-sec rounded-lg transition-colors">
            ${t('nav.tournaments')}
          </a>
          <a href="/partie" class="menu-link px-4 py-3 text-text hover:bg-sec rounded-lg transition-colors">
            ${t('nav.play')}
          </a>
          <a href="/chat" class="menu-link px-4 py-3 text-text hover:bg-sec rounded-lg transition-colors">
            ${t('nav.chat')}
          </a>
          <a href="/profile" class="menu-link px-4 py-3 text-text hover:bg-sec rounded-lg transition-colors">
            ${t('nav.profile')}
          </a>
        ` : `
          <a href="/login" class="menu-link px-4 py-3 text-text hover:bg-sec rounded-lg transition-colors">
            ${t('nav.login')}
          </a>
          <a href="/signup" class="menu-link px-4 py-3 text-text hover:bg-sec rounded-lg transition-colors">
            ${t('nav.signup')}
          </a>
        `}

        ${isAuthenticated ? `
          <div class="pt-4 border-t border-sec mt-4">
            <div class="px-4 py-2 text-sm">
              <div class="flex items-center space-x-2 mb-2">
                ${this.fullUser?.avatarUrl ? `
                  <img src="${this.fullUser.avatarUrl}" alt="Avatar" class="w-8 h-8 rounded-full object-cover" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                  <div class="w-8 h-8 bg-sec rounded-full flex items-center justify-center" style="display:none;">
                    <span class="text-sm font-bold text-text">${this.fullUser?.displayName?.charAt(0).toUpperCase() || user?.displayName?.charAt(0).toUpperCase() || 'U'}</span>
                  </div>
                ` : `
                  <div class="w-8 h-8 bg-sec rounded-full flex items-center justify-center">
                    <span class="text-sm font-bold text-text">${this.fullUser?.displayName?.charAt(0).toUpperCase() || user?.displayName?.charAt(0).toUpperCase() || 'U'}</span>
                  </div>
                `}
                <div>
                  <div class="text-text font-bold text-base">${this.fullUser?.displayName || user?.displayName || t('common.user')}</div>
                  <div class="text-text/70 text-xs">${this.fullUser?.email || user?.email || ''}</div>
                  ${this.fullUser?.accountType === 'oauth42' ? '<div class="text-blue-400 text-xs">👤 42</div>' : ''}
                </div>
              </div>
            </div>
            <div class="space-y-2">
              ${createLanguageButton()}
              <button id="logout-btn" class="w-full px-4 py-3 text-text bg-red-600 hover:bg-red-700 rounded-lg transition-colors font-black">
                🔓 ${t('auth.logout')}
              </button>
            </div>
          </div>
        ` : `
          <div class="pt-4 border-t border-sec mt-4">
            <div class="space-y-2">
              ${createLanguageButton()}
              <button id="demo-mode-btn" class="w-full px-4 py-3 text-text bg-sec hover:bg-opacity-80 rounded-lg transition-colors font-black">
                🎭 ${t('auth.demoMode')}
              </button>
            </div>
            <p id="demo-status" class="text-xs text-text/50 mt-2 px-4 hidden">${t('auth.demoModeActive')}</p>
          </div>
        `}
      </nav>
    `;

    const sidebar = document.querySelector('aside');
    if (sidebar) {
      const existingNav = sidebar.querySelector('nav');
      if (existingNav) {
        existingNav.outerHTML = menuHTML;
      } else {
        sidebar.insertAdjacentHTML('beforeend', menuHTML);
      }
    }

    this.demoBtn = document.getElementById('demo-mode-btn') as HTMLButtonElement;
    this.demoStatus = document.getElementById('demo-status') as HTMLParagraphElement;

    this.setupEventHandlers();
  }

  private setupNavigation() {
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('menu-link')) {
        e.preventDefault();
        const href = target.getAttribute('href');
        if (href) {
          router.navigate(href);
        }
      }
    });
  }

  private setupEventHandlers() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        if (confirm(t('messages.confirmLogout'))) {
          await authManager.logout();
          router.navigate('/');
        }
      });
    }

    const languageBtn = document.getElementById('language-btn');
    if (languageBtn) {
      languageBtn.addEventListener('click', () => {
        const modal = createLanguageModal();
        document.body.appendChild(modal);
      });
    }

    if (this.demoBtn && this.demoStatus) {
      this.demoBtn.addEventListener('click', () => {
        if (demoAuth.isActive()) {
          demoAuth.disableDemoMode();
          this.updateDemoUI(false);
          router.navigate('/');
        } else {
          demoAuth.enableDemoMode();
          this.updateDemoUI(true);
          router.navigate('/profile');
        }
      });

      const initialState = demoAuth.isActive();
      this.updateDemoUI(initialState);
    }
  }

  private setupDemoMode() {
  }

  private updateDemoUI(isActive: boolean) {
    if (!this.demoBtn || !this.demoStatus) return;

    if (isActive) {
      this.demoBtn.textContent = `🔓 ${t('auth.exitDemoMode')}`;
      this.demoBtn.className = 'w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-black';
      this.demoStatus.classList.remove('hidden');
    } else {
      this.demoBtn.textContent = `🎭 ${t('auth.demoMode')}`;
      this.demoBtn.className = 'w-full px-4 py-3 text-text bg-sec hover:bg-opacity-80 rounded-lg transition-colors font-black';
      this.demoStatus.classList.add('hidden');
    }
  }

  public setActiveLink(path: string) {

    document.querySelectorAll('.menu-link').forEach(link => {
      link.classList.remove('bg-sec', 'text-prem');
      link.classList.add('text-text');
    });

    const activeLink = document.querySelector(`.menu-link[href="${path}"]`) as HTMLElement;
    if (activeLink) {
      activeLink.classList.add('bg-sec', 'text-prem');
      activeLink.classList.remove('text-text');
    }
  }

  public destroy() {
    if (this.unsubscribeAuth) {
      this.unsubscribeAuth();
      this.unsubscribeAuth = null;
    }
    if (this.unsubscribeI18n) {
      this.unsubscribeI18n();
      this.unsubscribeI18n = null;
    }
  }
}

export const menuManager = new MenuManager();
