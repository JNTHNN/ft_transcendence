import { i18n } from "./i18n";

const DEMO_USER = {
  id: 999,
  email: "demo@ft_transcendence.com",
  get displayName() { return i18n.translate('auth.demoUser'); },
  createdAt: "2024-01-01T00:00:00Z",
  isDemo: true
};

class DemoAuth {
  private isDemoMode = false;

  constructor() {
    const stored = localStorage.getItem('demo_mode');
    this.isDemoMode = stored === 'true';
  }

  enableDemoMode() {
    this.isDemoMode = true;
    localStorage.setItem('demo_mode', 'true');
    localStorage.setItem('demo_user', JSON.stringify(DEMO_USER));
    console.log('🎭 Mode démo activé');
  }

  disableDemoMode() {
    this.isDemoMode = false;
    localStorage.removeItem('demo_mode');
    localStorage.removeItem('demo_user');
    console.log('🎭 Mode démo désactivé');
  }

  isActive(): boolean {
    return this.isDemoMode;
  }

  getDemoUser() {
    return DEMO_USER;
  }
}

export const demoAuth = new DemoAuth();
