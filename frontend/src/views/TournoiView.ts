import { api } from "../apiClient";

export async function TournoiView() {
  const wrap = document.createElement("div");
  wrap.className = "max-w-6xl mx-auto mt-8";
  
  wrap.innerHTML = `
    <h1 class="font-display font-black text-4xl font-bold text-text mb-6">Tournois</h1>
    
    <div id="tournament-content"></div>
  `;
  
  const content = wrap.querySelector("#tournament-content") as HTMLDivElement;
  
  try {
    // Vérifier si l'utilisateur est connecté
    await api("/auth/me");
    
    content.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="bg-prem rounded-lg shadow-xl p-6">
          <h2 class="font-display font-black text-3xl font-black text-text mb-4">Tournois Actifs</h2>
          <ul class="space-y-2 font-sans text-text mb-4">
            <li class="p-3 bg-sec rounded-lg">🏆 Tournoi Hebdomadaire - 128 joueurs</li>
            <li class="p-3 bg-sec rounded-lg">🏆 Championnat du Mois - 256 joueurs</li>
            <li class="p-3 bg-sec rounded-lg">🏆 Coupe des Débutants - 64 joueurs</li>
          </ul>
          <button class="w-full bg-sec hover:bg-opacity-80 text-text font-sans font-bold py-2 px-4 rounded-lg transition">
            Rejoindre un tournoi
          </button>
        </div>
        
        <div class="bg-prem rounded-lg shadow-xl p-6">
          <h2 class="font-display font-black text-3xl font-black text-text mb-4">Mes Inscriptions</h2>
          <p class="text-center font-sans text-text/50 py-8">
            Vous n'êtes inscrit à aucun tournoi pour le moment.
          </p>
        </div>
      </div>
      
      <div class="mt-6 bg-prem rounded-lg shadow-xl p-6">
        <h2 class="font-display font-black text-3xl font-black text-text mb-4">Classement Global</h2>
        <div class="overflow-x-auto">
          <table class="w-full font-sans text-text">
            <thead class="border-b border-sec">
              <tr>
                <th class="py-3 text-left">Rang</th>
                <th class="py-3 text-left">Joueur</th>
                <th class="py-3 text-right">Victoires</th>
                <th class="py-3 text-right">Points</th>
              </tr>
            </thead>
            <tbody>
              <tr class="border-b border-sec/50">
                <td class="py-3">1</td>
                <td class="py-3">mleonet</td>
                <td class="py-3 text-right">99</td>
                <td class="py-3 text-right">1250</td>
              </tr>
              <tr class="border-b border-sec/50">
                <td class="py-3">2</td>
                <td class="py-3">abolor-e</td>
                <td class="py-3 text-right">67</td>
                <td class="py-3 text-right">1180</td>
              </tr>
              <tr class="border-b border-sec/50">
                <td class="py-3">3</td>
                <td class="py-3">lboumahd</td>
                <td class="py-3 text-right">42</td>
                <td class="py-3 text-right">1080</td>
              </tr>              <tr class="border-b border-sec/50">
                <td class="py-3">4</td>
                <td class="py-3">jbourgoi</td>
                <td class="py-3 text-right">35</td>
                <td class="py-3 text-right">1050</td>
              </tr>              <tr class="border-b border-sec/50">
                <td class="py-3">5</td>
                <td class="py-3">jgasparo</td>
                <td class="py-3 text-right">1</td>
                <td class="py-3 text-right">19</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
    
  } catch (err) {
    content.innerHTML = `
      <div class="bg-prem rounded-lg shadow-xl p-6 text-center">
        <p class="font-sans text-text mb-4">Vous devez être connecté pour participer aux tournois.</p>
        <a href="/login" class="inline-block bg-sec hover:bg-opacity-80 text-text font-sans font-bold py-2 px-6 rounded-lg transition">
          Se connecter
        </a>
      </div>
    `;
  }
  
  return wrap;
}
