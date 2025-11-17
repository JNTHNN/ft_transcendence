// Système de mode démo pour simuler une connexion

const DEMO_USER = {
  id: 999,
  username: "demo_user",
  email: "demo@ft_transcendence.com",
  isDemo: true
};

class DemoAuth {
  private isDemoMode = false;

  constructor() {
    // Vérifier si le mode démo est activé au chargement
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
