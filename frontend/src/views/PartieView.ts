import { api } from "../apiClient";

export async function PartieView() {
  const wrap = document.createElement("div");
  wrap.className = "max-w-6xl mx-auto mt-8";
  
  wrap.innerHTML = `
    <h1 class="text-3xl font-bold text-text mb-6">Modes de Jeu</h1>
    
    <div id="game-content"></div>
  `;
  
  const content = wrap.querySelector("#game-content") as HTMLDivElement;
  
  try {
    // Vérifier si l'utilisateur est connecté
    await api("/auth/me");
    
    content.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="bg-prem rounded-lg shadow-xl p-6">
          <h2 class="text-2xl font-bold text-text mb-4">Partie Rapide</h2>
          <p class="text-text mb-4">Commencez une partie rapide contre l'ordinateur.</p>
          <button class="w-full bg-sec hover:bg-opacity-80 text-prem font-bold py-2 px-4 rounded-lg transition">
            Jouer
          </button>
        </div>
        
        <div class="bg-prem rounded-lg shadow-xl p-6">
          <h2 class="text-2xl font-bold text-text mb-4">Multijoueur</h2>
          <p class="text-text mb-4">Jouez contre un autre joueur en ligne.</p>
          <button class="w-full bg-sec hover:bg-opacity-80 text-prem font-bold py-2 px-4 rounded-lg transition">
            Chercher un adversaire
          </button>
        </div>
        
        <div class="bg-prem rounded-lg shadow-xl p-6">
          <h2 class="text-2xl font-bold text-text mb-4">Partie Personnalisée</h2>
          <p class="text-text mb-4">Créez une partie avec vos propres règles.</p>
          <button class="w-full bg-sec hover:bg-opacity-80 text-prem font-bold py-2 px-4 rounded-lg transition">
            Créer
          </button>
        </div>
      </div>
      
      <div class="mt-6 text-center">
        <a href="/match" class="text-sec hover:underline">Voir un match de démonstration →</a>
      </div>
    `;
    
  } catch (err) {
    content.innerHTML = `
      <div class="bg-prem rounded-lg shadow-xl p-6 text-center">
        <p class="text-text mb-4">Vous devez être connecté pour jouer une partie.</p>
        <a href="/login" class="inline-block bg-sec hover:bg-opacity-80 text-prem font-bold py-2 px-6 rounded-lg transition">
          Se connecter
        </a>
      </div>
    `;
  }
  
  return wrap;
}
