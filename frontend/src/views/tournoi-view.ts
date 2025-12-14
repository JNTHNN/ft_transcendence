import { api } from "../api-client";
import { authManager } from "../auth";
import { router } from "../router";
import { t } from "../i18n/index.js";

interface Tournament {
  id: string;
  name: string;
  description?: string;
  max_players: number;
  current_players: number;
  status: 'waiting' | 'active' | 'completed' | 'cancelled';
  tournament_type: 'elimination' | 'round_robin';
  creator_id: number;
  winner_id?: number;
  created_at: string;
}

export async function TournoiView() {
  if (!authManager.isAuthenticated()) {
    router.navigate("/login");
    return document.createElement("div");
  }
  
  const wrap = document.createElement("div");
  wrap.className = "max-w-6xl mx-auto mt-4 md:mt-8 p-4 md:p-0";

  wrap.innerHTML = `
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 md:mb-6 gap-4">
      <h1 class="font-display font-black text-2xl md:text-3xl lg:text-4xl font-bold text-text">${t('tournament.title')}</h1>
      <div class="flex gap-2 md:gap-3 w-full sm:w-auto">
        <button id="btn-create-tournament" class="flex-1 sm:flex-none bg-sec hover:bg-sec/80 text-text font-bold px-4 md:px-6 py-2 rounded-lg text-sm md:text-base">
          ➕ ${t('tournament.createTournament')}
        </button>
      </div>
    </div>

    <div id="tournament-content" class="space-y-4 md:space-y-6"></div>

    <!-- Modal pour créer un tournoi -->
    <div id="create-tournament-modal" class="hidden fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div class="bg-prem rounded-xl p-4 md:p-6 max-w-md w-full relative max-h-[90vh] overflow-y-auto">
        <button id="btn-close-create-modal" class="absolute top-4 right-4 text-text/60 hover:text-text text-2xl">×</button>
        <h2 class="text-xl md:text-2xl font-bold text-text mb-4">${t('tournament.createTournament')}</h2>
        <form id="create-tournament-form" class="space-y-4">
          <div>
            <label class="block text-text font-medium mb-2 text-sm md:text-base">${t('tournament.tournamentName')}</label>
            <input id="tournament-name" type="text" required class="w-full bg-gray-700 text-text px-3 py-2 rounded border border-gray-600 focus:border-sec text-sm md:text-base" placeholder="Nom du tournoi">
          </div>
          <div>
            <label class="block text-text font-medium mb-2 text-sm md:text-base">Description</label>
            <textarea id="tournament-description" class="w-full bg-gray-700 text-text px-3 py-2 rounded border border-gray-600 focus:border-sec text-sm md:text-base" rows="3" placeholder="Description optionnelle"></textarea>
          </div>
          <div>
            <label class="block text-text font-medium mb-2 text-sm md:text-base">Nombre max de joueurs</label>
            <select id="tournament-max-players" class="w-full bg-gray-700 text-text px-3 py-2 rounded border border-gray-600 focus:border-sec text-sm md:text-base">
              <option value="2">2 joueurs</option>
              <option value="4">4 joueurs</option>
              <option value="8" selected>8 joueurs</option>
            </select>
          </div>
          <div class="flex pt-4">
            <button type="submit" class="w-full bg-sec hover:bg-sec/80 text-text font-bold py-2 px-4 rounded text-sm md:text-base">
              Créer
            </button>
          </div>
        </form>
      </div>
    </div>


  `;

  const content = wrap.querySelector("#tournament-content") as HTMLDivElement;
  const createModal = wrap.querySelector("#create-tournament-modal") as HTMLDivElement;

  setupModalHandlers(wrap, createModal);

  try {
    await api("/auth/me");
    await loadTournaments(content);
  } catch (error) {
    content.innerHTML = `
      <div class="bg-prem rounded-lg shadow-xl p-6 text-center">
        <p class="font-sans text-text mb-4">${t('auth.loginRequiredTournaments')}</p>
        <a href="/login" class="inline-block bg-sec hover:bg-opacity-80 text-text font-sans font-bold py-2 px-6 rounded-lg transition">
          ${t('auth.login')}
        </a>
      </div>
    `;
  }

  return wrap;
}

const playerNameCache = new Map<number, string>();

async function getPlayerName(userId: number): Promise<string> {
  if (playerNameCache.has(userId)) {
    return playerNameCache.get(userId)!;
  }
  
  try {
    const user = await api(`/users/${userId}`);
    const name = user.displayName || `Joueur #${userId}`;
    playerNameCache.set(userId, name);
    return name;
  } catch (error) {
    console.warn(`Failed to fetch player ${userId}:`, error);
    return `Joueur #${userId}`;
  }
}

async function loadTournaments(content: HTMLDivElement) {
  try {
    const [tournamentsResponse, userTournamentsResponse] = await Promise.all([
      api("/tournaments?limit=10"),
      api("/user/tournaments")
    ]);

    content.innerHTML = `
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Tournois disponibles -->
        <div class="bg-prem rounded-lg shadow-xl p-6">
          <h2 class="font-display font-black text-2xl text-text mb-4">🏆 ${t('tournament.availableTournaments')}</h2>
          <div id="available-tournaments" class="space-y-3">
            ${tournamentsResponse.tournaments.filter((t: Tournament) => t.status === 'waiting').map((tournament: Tournament) => `
              <div class="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-sec transition">
                <div class="flex justify-between items-start mb-2">
                  <h3 class="font-bold text-text">${tournament.name}</h3>
                  <span class="px-2 py-1 ${getStatusColor(tournament.status)} text-white text-xs rounded">${getStatusText(tournament.status)}</span>
                </div>
                <p class="text-text/70 text-sm mb-3">${tournament.description || t('tournament.noDescription')}</p>
                <div class="flex justify-between items-center">
                  <span class="text-text/60 text-sm">👥 ${tournament.current_players}/${tournament.max_players}</span>
                  <button onclick="joinTournament('${tournament.id}')" class="bg-sec hover:bg-sec/80 text-text px-4 py-1 rounded text-sm font-bold">
                    ${t('tournament.join')}
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Mes tournois -->
        <div class="bg-prem rounded-lg shadow-xl p-6">
          <h2 class="font-display font-black text-2xl text-text mb-4">📋 ${t('tournament.myTournaments')}</h2>
          <div id="my-tournaments" class="space-y-3">
            ${userTournamentsResponse.created.concat(userTournamentsResponse.participated)
              .sort((a: Tournament, b: Tournament) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .map((tournament: Tournament) => `
              <div class="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-sec transition cursor-pointer" onclick="viewTournament('${tournament.id}')">
                <div class="flex justify-between items-start mb-2">
                  <h3 class="font-bold text-text">${tournament.name}</h3>
                  <div class="flex items-center gap-2">

                    <span class="px-2 py-1 ${getStatusColor(tournament.status)} text-white text-xs rounded">${getStatusText(tournament.status)}</span>
                  </div>
                </div>
                <div class="flex justify-between items-center text-text/60 text-sm">
                  <span>👥 ${tournament.current_players}/${tournament.max_players}</span>
                  <span>${new Date(tournament.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- Tournois actifs -->
      <div class="bg-prem rounded-lg shadow-xl p-6">
        <h2 class="font-display font-black text-2xl text-text mb-4">⚡ ${t('tournament.activeTournaments')}</h2>
        <div id="active-tournaments" class="grid grid-cols-1 md:grid-cols-2 gap-4">
          ${tournamentsResponse.tournaments.filter((t: Tournament) => t.status === 'active').map((tournament: Tournament) => `
            <div class="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-lg p-4 cursor-pointer hover:border-yellow-500/50 transition" onclick="viewTournament('${tournament.id}')">
              <div class="flex justify-between items-start mb-3">
                <h3 class="font-bold text-text">${tournament.name}</h3>
                <span class="px-2 py-1 bg-yellow-500 text-black text-xs rounded font-bold">${t('tournament.active').toUpperCase()}</span>
              </div>
              <div class="text-text/70 text-sm">
                <p>👥 ${tournament.current_players} participants</p>
                <p>🏆 Type: ${tournament.tournament_type}</p>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Tournois terminés -->
      <div class="bg-prem rounded-lg shadow-xl p-6">
        <h2 class="font-display font-black text-2xl text-text mb-4">🏅 ${t('tournament.completedTournaments')}</h2>
        <div id="completed-tournaments" class="space-y-3">
          <!-- Will be populated with winner names -->
        </div>
      </div>
    `;
    
    const completedTournamentsDiv = content.querySelector('#completed-tournaments') as HTMLDivElement;
    const completedTournaments = tournamentsResponse.tournaments.filter((t: Tournament) => t.status === 'completed');
    
    if (completedTournaments.length === 0) {
      completedTournamentsDiv.innerHTML = '<p class="text-text/50 text-sm">Aucun tournoi terminé</p>';
    } else {
      const tournamentHTMLPromises = completedTournaments.map(async (tournament: Tournament) => {
        let winnerText = t('tournament.noWinner');
        if (tournament.winner_id) {
          const winnerName = await getPlayerName(tournament.winner_id);
          winnerText = ` ${t('tournamentDetail.winner')}: ${winnerName}`;
        }
        
        return `
          <div class="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-green-500/50 transition cursor-pointer" onclick="viewTournament('${tournament.id}')">
            <div class="flex justify-between items-start mb-2">
              <h3 class="font-bold text-text">${tournament.name}</h3>
              <div class="flex items-center gap-2">
                <span class="px-2 py-1 bg-green-600 text-white text-xs rounded">${t('tournament.completed').toUpperCase()}</span>
              </div>
            </div>
            <div class="text-text/70 text-sm">
              ${winnerText}
            </div>
          </div>
        `;
      });
      
      const tournamentHTMLs = await Promise.all(tournamentHTMLPromises);
      completedTournamentsDiv.innerHTML = tournamentHTMLs.join('');
    }

  } catch (error) {
    content.innerHTML = `
      <div class="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
        <p class="text-red-400"> Erreur lors du chargement des tournois</p>
      </div>
    `;
  }
}

function setupModalHandlers(wrap: HTMLDivElement, createModal: HTMLDivElement) {
  const btnCreateTournament = wrap.querySelector("#btn-create-tournament") as HTMLButtonElement;
  const btnCloseCreateModal = wrap.querySelector("#btn-close-create-modal") as HTMLButtonElement;
  const createForm = wrap.querySelector("#create-tournament-form") as HTMLFormElement;

  btnCreateTournament.addEventListener('click', () => {
    createModal.classList.remove('hidden');
  });

  btnCloseCreateModal.addEventListener('click', () => {
    createModal.classList.add('hidden');
    createForm.reset();
  });



  createForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = createForm.querySelector('button[type="submit"]') as HTMLButtonElement;
    if (submitBtn.disabled) return;
    
    const name = (wrap.querySelector("#tournament-name") as HTMLInputElement).value;
    const description = (wrap.querySelector("#tournament-description") as HTMLTextAreaElement).value;
    const maxPlayers = parseInt((wrap.querySelector("#tournament-max-players") as HTMLSelectElement).value);

    if (!name.trim()) {
      alert("Le nom du tournoi est requis");
      return;
    }

    const originalText = submitBtn.textContent || 'Créer';
    
    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<div class="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full inline-block mr-2"></div>Création...';

      await api("/tournaments", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          max_players: maxPlayers,
          tournament_type: "elimination"
        })
      });

      createModal.classList.add('hidden');
      
      const content = wrap.querySelector("#tournament-content") as HTMLDivElement;
      await loadTournaments(content);
      
      createForm.reset();
      
    } catch (error) {
      alert("Erreur lors de la création du tournoi: " + (error as Error).message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'waiting': return 'bg-blue-500';
    case 'active': return 'bg-yellow-500';
    case 'completed': return 'bg-green-500';
    case 'cancelled': return 'bg-red-500';
    default: return 'bg-gray-500';
  }
}

function getStatusText(status: string): string {
  switch (status) {
    case 'waiting': return t('tournament.pending').toUpperCase();
    case 'active': return t('tournament.active').toUpperCase();
    case 'completed': return t('tournament.completed').toUpperCase();
    case 'cancelled': return t('tournament.cancelled').toUpperCase();
    default: return status.toUpperCase();
  }
}

(window as any).joinTournament = async (tournamentId: string) => {
  try {
    await api(`/tournaments/${tournamentId}/join`, {
      method: "POST",
      body: JSON.stringify({})
    });
    
    const { router } = await import('../router.js');
    router.forceRender();
  } catch (error) {
    alert("Erreur lors de l'inscription au tournoi: " + (error as Error).message);
  }
};

(window as any).viewTournament = async (tournamentId: string) => {
  const { router } = await import('../router.js');
  router.navigate(`/tournament/${tournamentId}`);
};
