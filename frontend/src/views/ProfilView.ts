import { api } from "../apiClient";
import { router } from "../router";

export async function ProfilView() {
  const wrap = document.createElement("div");
  wrap.className = "max-w-4xl mx-auto mt-8";
  
  wrap.innerHTML = `
    <h1 class="text-3xl font-bold text-text mb-6">Mon Profil</h1>
    <div id="profile-content"></div>
  `;
  
  const content = wrap.querySelector("#profile-content") as HTMLDivElement;
  
  try {
    const user = await api("/auth/me");
    
    content.innerHTML = `
      <div class="bg-prem rounded-lg shadow-xl p-6 mb-6">
        <h2 class="text-2xl font-bold text-text mb-4">Informations du compte</h2>
        <div class="space-y-2 text-text">
          <p><strong>Nom d'utilisateur:</strong> ${user.username || "N/A"}</p>
          <p><strong>Email:</strong> ${user.email || "N/A"}</p>
          <p><strong>ID:</strong> ${user.id || "N/A"}</p>
        </div>
        <div class="mt-6">
          <button id="logout" class="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-6 rounded-lg transition">
            Se déconnecter
          </button>
        </div>
      </div>
      
      <div class="bg-prem rounded-lg shadow-xl p-6">
        <h2 class="text-2xl font-bold text-text mb-4">Statistiques</h2>
        <div class="grid grid-cols-3 gap-4 text-center">
          <div class="bg-sec p-4 rounded-lg">
            <div class="text-3xl font-bold text-sec">0</div>
            <div class="text-sm text-text">Parties</div>
          </div>
          <div class="bg-sec p-4 rounded-lg">
            <div class="text-3xl font-bold text-sec">0</div>
            <div class="text-sm text-text">Victoires</div>
          </div>
          <div class="bg-sec p-4 rounded-lg">
            <div class="text-3xl font-bold text-sec">0</div>
            <div class="text-sm text-text">Défaites</div>
          </div>
        </div>
      </div>
    `;
    
    const logoutBtn = content.querySelector("#logout") as HTMLButtonElement;
    logoutBtn.onclick = async () => {
      try {
        await api("/auth/logout", { method: "POST" });
        router.navigate("/");
      } catch (err) {
        alert("Erreur lors de la déconnexion");
      }
    };
    
  } catch (err: any) {
    content.innerHTML = `
      <div class="bg-prem rounded-lg shadow-xl p-6 text-center">
        <p class="text-text mb-4">Vous devez être connecté pour accéder à votre profil.</p>
        <a href="/login" class="inline-block bg-sec hover:bg-opacity-80 text-prem font-bold py-2 px-6 rounded-lg transition">
          Se connecter
        </a>
      </div>
    `;
  }
  
  return wrap;
}
