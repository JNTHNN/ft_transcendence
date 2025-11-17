import { router } from '../router';
import { demoAuth } from '../demoAuth';

export class MenuManager {
  private demoBtn: HTMLButtonElement | null = null;
  private demoStatus: HTMLParagraphElement | null = null;

  constructor() {
    this.initializeMenu();
    this.setupDemoMode();
  }

  private initializeMenu() {
    // Créer la structure du menu
    const menuHTML = `
      <nav class="font-display text-2xl font-black flex flex-col p-4 space-y-2">
        <a href="/" class="menu-link px-4 py-3 text-text hover:bg-sec rounded-lg transition-colors">
          ACCUEIL
        </a>
        <a href="/tournoi" class="menu-link px-4 py-3 text-text hover:bg-sec rounded-lg transition-colors">
          TOURNOIS
        </a>
        <a href="/partie" class="menu-link px-4 py-3 text-text hover:bg-sec rounded-lg transition-colors">
          JOUER
        </a>
        <a href="/chat" class="menu-link px-4 py-3 text-text hover:bg-sec rounded-lg transition-colors">
          CHAT
        </a>
        <a href="/profil" class="menu-link px-4 py-3 text-text hover:bg-sec rounded-lg transition-colors">
          PROFIL
        </a>
        <a href="/login" class="menu-link px-4 py-3 text-text hover:bg-sec rounded-lg transition-colors">
          CONNEXION
        </a>
        
        <div class="pt-4 border-t border-sec mt-4">
          <button id="demo-mode-btn" class="w-full px-4 py-3 text-text bg-sec hover:bg-opacity-80 rounded-lg transition-colors font-black">
            🎭 Mode Démo
          </button>
          <p id="demo-status" class="text-xs text-text/50 mt-2 px-4 hidden">Connecté en mode démo</p>
        </div>
      </nav>
    `;

    // Injecter dans le DOM
    const sidebar = document.querySelector('aside');
    if (sidebar) {
      const existingNav = sidebar.querySelector('nav');
      if (existingNav) {
        existingNav.outerHTML = menuHTML;
      } else {
        sidebar.insertAdjacentHTML('beforeend', menuHTML);
      }
    }

    // Configurer les liens pour utiliser le router
    this.setupNavigation();
  }

  private setupNavigation() {
    // Intercepter les clics sur les liens du menu
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

  private setupDemoMode() {
    // Attendre que le DOM soit prêt
    setTimeout(() => {
      this.demoBtn = document.getElementById('demo-mode-btn') as HTMLButtonElement;
      this.demoStatus = document.getElementById('demo-status') as HTMLParagraphElement;

      if (!this.demoBtn || !this.demoStatus) {
        console.warn('Éléments du mode démo non trouvés');
        return;
      }

      // Gestionnaire du bouton démo
      this.demoBtn.addEventListener('click', () => {
        if (demoAuth.isActive()) {
          // Désactivation
          demoAuth.disableDemoMode();
          this.updateDemoUI(false);
          router.navigate('/');
        } else {
          // Activation
          demoAuth.enableDemoMode();
          this.updateDemoUI(true);
          router.navigate('/profil');
        }
      });

      // État initial
      const initialState = demoAuth.isActive();
      this.updateDemoUI(initialState);
    }, 100);
  }

  private updateDemoUI(isActive: boolean) {
    if (!this.demoBtn || !this.demoStatus) return;

    if (isActive) {
      this.demoBtn.textContent = '🔓 Quitter le mode démo';
      this.demoBtn.className = 'w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-black';
      this.demoStatus.classList.remove('hidden');
    } else {
      this.demoBtn.textContent = '🎭 Mode Démo';
      this.demoBtn.className = 'w-full px-4 py-3 text-text bg-sec hover:bg-opacity-80 rounded-lg transition-colors font-black';
      this.demoStatus.classList.add('hidden');
    }
  }

  // Méthode pour mettre à jour l'état actif du menu
  public setActiveLink(path: string) {
    // Retirer la classe active de tous les liens
    document.querySelectorAll('.menu-link').forEach(link => {
      link.classList.remove('bg-sec', 'text-prem');
      link.classList.add('text-text');
    });

    // Ajouter la classe active au lien correspondant
    const activeLink = document.querySelector(`.menu-link[href="${path}"]`) as HTMLElement;
    if (activeLink) {
      activeLink.classList.add('bg-sec', 'text-prem');
      activeLink.classList.remove('text-text');
    }
  }
}

// Instance globale
export const menuManager = new MenuManager();