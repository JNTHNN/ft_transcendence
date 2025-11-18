export type Language = 'fr' | 'en' | 'es' | 'de';

import frTranslations from './translations/fr.js';
import enTranslations from './translations/en.js';
import esTranslations from './translations/es.js';
import deTranslations from './translations/de.js';

export interface TranslationMessages {
  [key: string]: any;
}

class I18nManager {
  private currentLanguage: Language = 'fr';
  private translations: Record<Language, TranslationMessages> = {} as Record<Language, TranslationMessages>;
  private initialized = false;
  private listeners: Array<(lang: Language) => void> = [];

  constructor() {
    this.currentLanguage = 'fr';

    const stored = localStorage.getItem('language') as Language;
    if (stored && this.isValidLanguage(stored)) {
      this.currentLanguage = stored;
    }

    this.loadAllTranslationsSync();
  }

  private loadAllTranslationsSync() {
    this.setTranslations('fr', frTranslations);
    this.setTranslations('en', enTranslations);
    this.setTranslations('es', esTranslations);
    this.setTranslations('de', deTranslations);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

  }

  private isValidLanguage(lang: string): lang is Language {
    return ['fr', 'en', 'es', 'de'].includes(lang);
  }

  public setTranslations(lang: Language, translations: TranslationMessages) {
    this.translations[lang] = translations;
  }

  public setLanguage(lang: Language) {
    if (!this.isValidLanguage(lang)) return;

    this.currentLanguage = lang;
    localStorage.setItem('language', lang);

    this.listeners.forEach(listener => listener(lang));

    window.dispatchEvent(new CustomEvent('languageChanged', { detail: lang }));
  }

  public getCurrentLanguage(): Language {
    return this.currentLanguage;
  }

  public getAvailableLanguages(): Array<{code: Language, name: string, flag: string}> {
    return [
      { code: 'fr', name: 'Français', flag: '🇫🇷' },
      { code: 'en', name: 'English', flag: '🇬🇧' },
      { code: 'es', name: 'Español', flag: '🇪🇸' },
      { code: 'de', name: 'Deutsch', flag: '🇩🇪' }
    ];
  }

  public translate(key: string, params?: Record<string, string | number>): string {
    const currentTranslations = this.translations[this.currentLanguage];
    const translation = currentTranslations ? this.getNestedValue(currentTranslations, key) : undefined;

    if (!translation) {
      const englishTranslations = this.translations.en;
      const fallback = englishTranslations ? this.getNestedValue(englishTranslations, key) : undefined;
      if (!fallback) {
        const frenchTranslations = this.translations.fr;
        const frenchFallback = frenchTranslations ? this.getNestedValue(frenchTranslations, key) : undefined;
        if (!frenchFallback) {
          return `[${key}]`;
        }
        return this.interpolate(frenchFallback, params);
      }
      return this.interpolate(fallback, params);
    }

    return this.interpolate(translation, params);
  }

  private getNestedValue(obj: TranslationMessages, path: string): string | undefined {
    const keys = path.split('.');
    let current: any = obj;

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return undefined;
      }
    }

    return typeof current === 'string' ? current : undefined;
  }

  private interpolate(template: string, params?: Record<string, string | number>): string {
    if (!params) return template;

    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return params[key] !== undefined ? String(params[key]) : match;
    });
  }

  public addLanguageChangeListener(callback: (lang: Language) => void): void {
    this.listeners.push(callback);
  }

  public removeLanguageChangeListener(callback: (lang: Language) => void): void {
    this.listeners = this.listeners.filter(listener => listener !== callback);
  }
}

export const i18n = new I18nManager();

export const t = (key: string, params?: Record<string, string | number>): string => {
  return i18n.translate(key, params);
};
