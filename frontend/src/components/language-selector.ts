import { i18n, t, type Language } from '../i18n/index.js';

export class LanguageSelector {
  private container: HTMLElement;
  private isOpen: boolean = false;
  private unsubscribe: (() => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.render();
    this.setupEventListeners();

    const callback = () => {
      this.render();
    };
    i18n.addLanguageChangeListener(callback);
    this.unsubscribe = () => i18n.removeLanguageChangeListener(callback);
  }

  private render() {
    const currentLang = i18n.getCurrentLanguage();
    const languages = i18n.getAvailableLanguages();
    const currentLanguageInfo = languages.find(lang => lang.code === currentLang);

    this.container.innerHTML = `
      <div class="language-selector relative">
        <button id="language-toggle" class="flex items-center space-x-2 px-3 py-2 bg-sec hover:bg-opacity-80 rounded-lg transition-colors text-text">
          <span class="text-lg">${currentLanguageInfo?.flag || '🌐'}</span>
          <span class="font-sans text-sm">${currentLanguageInfo?.name || currentLang.toUpperCase()}</span>
          <svg class="w-4 h-4 transition-transform ${this.isOpen ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
          </svg>
        </button>

        <div id="language-dropdown" class="absolute right-0 mt-2 w-48 bg-prem border border-sec rounded-lg shadow-xl z-50 ${this.isOpen ? 'block' : 'hidden'}">
          <div class="p-2">
            <div class="text-xs text-text/70 font-sans mb-2 px-2">${t('language.selectLanguage')}</div>
            ${languages.map(lang => `
              <button
                class="language-option w-full flex items-center space-x-2 px-2 py-2 hover:bg-sec rounded-lg transition-colors text-left ${lang.code === currentLang ? 'bg-sec/50' : ''}"
                data-lang="${lang.code}"
              >
                <span class="text-lg">${lang.flag}</span>
                <span class="font-sans text-sm text-text">${lang.name}</span>
                ${lang.code === currentLang ? '<span class="ml-auto text-xs text-green-400">✓</span>' : ''}
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  private setupEventListeners() {
    this.container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      if (target.closest('#language-toggle')) {
        e.stopPropagation();
        this.toggleDropdown();
        return;
      }

      const langOption = target.closest('.language-option') as HTMLElement;
      if (langOption) {
        e.stopPropagation();
        const lang = langOption.dataset.lang as Language;
        if (lang) {
          i18n.setLanguage(lang);
          this.closeDropdown();
        }
        return;
      }
    });

    document.addEventListener('click', (e) => {
      if (!this.container.contains(e.target as Node)) {
        this.closeDropdown();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.closeDropdown();
      }
    });
  }

  private toggleDropdown() {
    this.isOpen = !this.isOpen;
    this.render();
  }

  private closeDropdown() {
    this.isOpen = false;
    this.render();
  }

  public destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }
}

export function createLanguageButton(): string {
  const currentLang = i18n.getCurrentLanguage();
  const languages = i18n.getAvailableLanguages();
  const currentLanguageInfo = languages.find(lang => lang.code === currentLang);

  return `
    <button id="language-btn" class="flex items-center space-x-2 px-3 py-2 bg-sec hover:bg-opacity-80 rounded-lg transition-colors text-text w-full">
      <span class="text-lg">${currentLanguageInfo?.flag || '🌐'}</span>
      <span class="font-sans text-sm">${t('language.title')}</span>
    </button>
  `;
}

export function createLanguageModal(): HTMLElement {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-[100]';
  modal.id = 'language-modal';

  const currentLang = i18n.getCurrentLanguage();
  const languages = i18n.getAvailableLanguages();

  modal.innerHTML = `
    <div class="bg-prem rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
      <div class="flex items-center justify-between mb-4">
        <h2 class="font-display text-2xl font-bold text-text">${t('language.title')}</h2>
        <button id="close-language-modal" class="text-text/70 hover:text-text">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <div class="space-y-2">
        ${languages.map(lang => `
          <button
            class="modal-language-option w-full flex items-center space-x-3 px-4 py-3 hover:bg-sec rounded-lg transition-colors text-left ${lang.code === currentLang ? 'bg-sec/50' : ''}"
            data-lang="${lang.code}"
          >
            <span class="text-2xl">${lang.flag}</span>
            <span class="font-sans text-base text-text">${lang.name}</span>
            ${lang.code === currentLang ? '<span class="ml-auto text-green-400">✓</span>' : ''}
          </button>
        `).join('')}
      </div>
    </div>
  `;

  modal.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    if (target.id === 'close-language-modal' || target === modal) {
      modal.remove();
      return;
    }

    const langOption = target.closest('.modal-language-option') as HTMLElement;
    if (langOption) {
      const lang = langOption.dataset.lang as Language;
      if (lang) {
        i18n.setLanguage(lang);
        modal.remove();
      }
    }
  });

  return modal;
}
