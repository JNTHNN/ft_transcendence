const routes: Record<string, () => Promise<HTMLElement>> = {
  "/": async () => (await import("./views/MenuView")).MenuView(),
  "/login": async () => (await import("./views/Login")).default(),
  "/signup": async () => (await import("./views/Signup")).default(),
  "/profil": async () => (await import("./views/ProfilView")).ProfilView(),
  "/chat": async () => (await import("./views/Chat")).default(),
  "/match": async () => (await import("./views/Match")).default(),
  "/partie": async () => (await import("./views/PartieView")).PartieView(),
  "/tournoi": async () => (await import("./views/TournoiView")).TournoiView()
};

function navigate(path: string) { 
  history.pushState({}, "", path); 
  render(); 
}

async function render() {
  const root = document.getElementById("app")!;
  const path = location.pathname in routes ? location.pathname : "/";
  root.replaceChildren(await routes[path]());
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
    render();
  }, 
  navigate
};
