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
  "/dashboard": async () => (await import("./views/dashboard")).default(),
  "/stats": async () => (await import("./views/dashboard")).default(),
  "/chat": async () => (await import("./views/Chat")).default(),
  "/match": async () => (await import("./views/Match")).default(),
  "/partie": async () => (await import("./views/partie-view")).PartieView(),
  "/tournoi": async () => (await import("./views/tournoi-view")).TournoiView(),
  "/tournois": async () => (await import("./views/tournoi-view")).TournoiView(),
  "/friends": async () => (await import("./views/friends-view")).FriendsView(),
  "/amis": async () => (await import("./views/friends-view")).FriendsView(),
  "/auth/oauth42/callback": async () => (await import("./views/oauth42-callback")).default(),
  "/privacy": async () => (await import("./views/privacy")).default(),
  "/terms": async () => (await import("./views/terms")).default()
};


function getDynamicRoute(path: string): (() => Promise<HTMLElement>) | null {
  if (path.startsWith('/tournament/')) {
    return async () => (await import("./views/tournament-detail-view")).TournamentDetailView();
  }
  if (path.startsWith('/game-session/')) {
    return async () => (await import("./views/game-session-detail")).GameSessionDetailView();
  }
  return null;
}


function cleanupBeforeNavigation() {
  
  if (window.currentGameInstance) {

    
    try {
     
      window.currentGameInstance.destroy();
    } catch (error) {

    }
    
   
    window.currentGameInstance = undefined;
  }
}


function navigate(path: string) {
  
  cleanupBeforeNavigation();
  
 
  history.pushState({}, "", path);
  
  
  render();
}


async function render() {
  const root = document.getElementById("app")!;
  const path = location.pathname;
  
  
  cleanupBeforeNavigation();
  
 
  let routeHandler: (() => Promise<HTMLElement>) | null = routes[path] || null;
  
  
  if (!routeHandler) {
    routeHandler = getDynamicRoute(path);
  }
  
  
  if (!routeHandler) {
    routeHandler = routes["/"];
  }
  
  
  root.replaceChildren(await routeHandler());
}


export const router = {
  start() {
    
    window.addEventListener("popstate", render);
    
    
    document.body.addEventListener("click", (e) => {
      const a = (e.target as HTMLElement).closest("a[href]");
      if (a && a.getAttribute("href")?.startsWith("/")) {
        e.preventDefault();
        navigate(a.getAttribute("href")!);
      }
    });

    
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

    
    window.addEventListener("languageChanged", () => {
      render();
    });
    
    
    render();
  },
  navigate,
  forceRender: render
};