const routes: Record<string, () => Promise<HTMLElement>> = {
  "/": async () => (await import("./views/menu-view")).MenuView(),
  "/login": async () => (await import("./views/Login")).default(),
  "/signup": async () => (await import("./views/Signup")).default(),
  "/profile": async () => (await import("./views/profile")).default(),
  "/profil": async () => (await import("./views/profil-view")).ProfilView(),
  "/chat": async () => (await import("./views/Chat")).default(),
  "/match": async () => (await import("./views/Match")).default(),
  "/partie": async () => (await import("./views/partie-view")).PartieView(),
  "/tournoi": async () => (await import("./views/tournoi-view")).TournoiView(),
  "/auth/oauth42/callback": async () => (await import("./views/oauth42-callback")).default()
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
