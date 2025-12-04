// 🔧 TYPES GLOBAUX
declare global {
  interface Window {
    currentGameInstance?: {
      destroy: () => void;
      allowNavigation?: boolean;
    };
  }
}

const routes: Record<string, () => Promise<HTMLElement>> = {
  "/": async () => (await import("./views/menu-view")).MenuView(),
  "/login": async () => (await import("./views/Login")).default(),
  "/signup": async () => (await import("./views/Signup")).default(),
  "/2fa-login": async () => (await import("./views/TwoFactorLogin")).default(),
  "/2fa-settings": async () => (await import("./views/TwoFactorAuth")).default(),
  "/profile": async () => (await import("./views/profile")).default(),
  "/chat": async () => (await import("./views/Chat")).default(),
  "/match": async () => (await import("./views/Match")).default(),
  "/partie": async () => (await import("./views/partie-view")).PartieView(),
  "/tournoi": async () => (await import("./views/tournoi-view")).TournoiView(),
  "/tournois": async () => (await import("./views/tournoi-view")).TournoiView(),
  "/friends": async () => (await import("./views/friends-view")).FriendsView(),
  "/amis": async () => (await import("./views/friends-view")).FriendsView(),
  "/auth/oauth42/callback": async () => (await import("./views/oauth42-callback")).default()
};

// Route dynamique pour les détails de tournoi
function getDynamicRoute(path: string): (() => Promise<HTMLElement>) | null {
  if (path.startsWith('/tournament/')) {
    return async () => (await import("./views/tournament-detail-view")).TournamentDetailView();
  }
  return null;
}

// 🧹 CLEANUP AVANT NAVIGATION
function cleanupBeforeNavigation() {
  // Si une instance de jeu existe dans le contexte global
  if (window.currentGameInstance) {

    
    try {
      // Appeler la méthode destroy() de l'instance
      window.currentGameInstance.destroy();
    } catch (error) {

    }
    
    // Nettoyer la référence globale
    window.currentGameInstance = undefined;
  }
}

// 🧭 NAVIGATION AVEC CLEANUP AUTOMATIQUE
function navigate(path: string) {
  // ✅ ÉTAPE 1 : Cleanup AVANT de changer de route
  cleanupBeforeNavigation();
  
  // ✅ ÉTAPE 2 : Changer l'URL dans l'historique
  history.pushState({}, "", path);
  
  // ✅ ÉTAPE 3 : Rendre la nouvelle vue
  render();
}

// 🎨 RENDU DE LA VUE
async function render() {
  const root = document.getElementById("app")!;
  const path = location.pathname;
  
  // Cleanup avant de changer de vue (important pour popstate)
  cleanupBeforeNavigation();
  
  // Vérifier d'abord les routes statiques
  let routeHandler: (() => Promise<HTMLElement>) | null = routes[path] || null;
  
  // Si pas de route statique, vérifier les routes dynamiques
  if (!routeHandler) {
    routeHandler = getDynamicRoute(path);
  }
  
  // Si toujours pas de route, utiliser la route par défaut
  if (!routeHandler) {
    routeHandler = routes["/"];
  }
  
  // Charger et afficher la vue
  root.replaceChildren(await routeHandler());
}

// 📡 EXPORT DU ROUTER
export const router = {
  start() {
    // Bouton précédent/suivant du navigateur
    window.addEventListener("popstate", render);
    
    // Interception des clics sur les liens <a href>
    document.body.addEventListener("click", (e) => {
      const a = (e.target as HTMLElement).closest("a[href]");
      if (a && a.getAttribute("href")?.startsWith("/")) {
        e.preventDefault();
        navigate(a.getAttribute("href")!);
      }
    });

    // 🆕 Interception des clics sur [data-navigate] (optionnel)
    document.body.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest("[data-navigate]");
      if (btn) {
        e.preventDefault();
        const path = btn.getAttribute("data-navigate");
        if (path) {
          navigate(path);
        }
      }
    });

    // Changement de langue
    window.addEventListener("languageChanged", () => {
      render();
    });
    
    // Rendu initial
    render();
  },
  navigate,
  forceRender: render
};