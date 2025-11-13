import { router } from './router';

export interface MenuItem {
  label: string;
  path: string;
  icon?: string; // Pour une future implémentation avec des icônes
}

export class Menu {
  private items: MenuItem[] = [
    { label: 'Menu', path: '/' },
    { label: 'Profil', path: '/profil' },
    { label: 'Partie', path: '/partie' },
    { label: 'Tournoi', path: '/tournoi' },
  ];
  
  private isLoggedIn: boolean = false;

  constructor() {
    this.render();
  }

  // Mettre à jour l'état de connexion
  setLoggedIn(status: boolean): void {
    this.isLoggedIn = status;
    this.render();
  }

  // Obtenir l'état de connexion
  getLoggedIn(): boolean {
    return this.isLoggedIn;
  }

  // Basculer l'état de connexion
  toggleLogin(): void {
    this.isLoggedIn = !this.isLoggedIn;
    this.render();
    
    // Rediriger vers l'accueil après déconnexion
    if (!this.isLoggedIn) {
      router.navigate('/');
    }
  }

  // Rendre le menu
  render(): void {
    const menuElement = document.getElementById('sidebar-menu');
    
    if (!menuElement) return;

    const menuItemsHTML = this.items.map(item => `
      <li>
        <button 
          data-route="${item.path}"
          class="menu-item w-full text-left px-6 py-4 text-text hover:bg-secondColorary transition-colors border-l-4 border-transparent hover:border-text"
        >
          ${item.label}
        </button>
      </li>
    `).join('');

    const loginButton = `
      <li class="mt-auto">
        <button 
          id="login-toggle"
          class="menu-item w-full text-left px-6 py-4 text-text hover:bg-secondColorary transition-colors border-l-4 border-transparent hover:border-text font-bold"
        >
          ${this.isLoggedIn ? 'Déconnexion' : 'Se Connecter'}
        </button>
      </li>
    `;

    menuElement.innerHTML = `
      <ul class="flex flex-col h-full">
        ${menuItemsHTML}
        ${loginButton}
      </ul>
    `;

    // Ajouter les écouteurs d'événements
    this.attachEventListeners();
  }

  // Attacher les écouteurs d'événements
  private attachEventListeners(): void {
    // Navigation
    const menuItems = document.querySelectorAll('[data-route]');
    menuItems.forEach(item => {
      item.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const route = target.getAttribute('data-route');
        if (route) {
          router.navigate(route);
        }
      });
    });

    // Connexion/Déconnexion
    const loginToggle = document.getElementById('login-toggle');
    if (loginToggle) {
      loginToggle.addEventListener('click', () => {
        this.toggleLogin();
      });
    }
  }
}

// Instance unique du menu
export const menu = new Menu();
