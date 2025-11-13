// Interface pour les routes
export interface Route {
  path: string;
  component: () => Promise<string>;
}

// Classe Router pour gérer la navigation SPA
export class Router {
  private routes: Route[] = [];
  private currentPath: string = '/';

  constructor() {
    // Écouter les changements d'historique (boutons précédent/suivant)
    window.addEventListener('popstate', () => {
      this.loadRoute(window.location.pathname);
    });
  }

  // Ajouter une route
  addRoute(path: string, component: () => Promise<string>): void {
    this.routes.push({ path, component });
  }

  // Naviguer vers une route
  async navigate(path: string): Promise<void> {
    if (this.currentPath !== path) {
      this.currentPath = path;
      window.history.pushState({}, '', path);
      await this.loadRoute(path);
    }
  }

  // Charger une route
  private async loadRoute(path: string): Promise<void> {
    const route = this.routes.find(r => r.path === path);
    
    if (route) {
      const content = await route.component();
      const appElement = document.getElementById('app-content');
      
      if (appElement) {
        appElement.innerHTML = content;
      }
    } else {
      // Route par défaut (404)
      this.navigate('/');
    }
  }

  // Initialiser le router
  async init(): Promise<void> {
    const path = window.location.pathname;
    this.currentPath = path;
    await this.loadRoute(path);
  }
}

// Instance unique du router
export const router = new Router();
