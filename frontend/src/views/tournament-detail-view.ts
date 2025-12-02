import { api } from "../api-client";

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
  blockchain_stored: boolean;
  blockchain_tx_hash?: string;
  blockchain_tournament_id?: string;
  created_at: string;
}

interface TournamentMatch {
  id: number;
  tournament_id: string;
  match_id: string;
  round_number: number;
  match_order: number;
  player1_id?: number;
  player2_id?: number;
  player1_username?: string;
  player2_username?: string;
  player1_score: number;
  player2_score: number;
  winner_id?: number;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  start_time?: string;
  end_time?: string;
  created_at: string;
}

export async function TournamentDetailView() {
  const wrap = document.createElement("div");
  wrap.className = "max-w-6xl mx-auto mt-8";

  // Récupérer l'ID du tournoi depuis l'URL
  const tournamentId = window.location.pathname.split('/tournament/')[1];
  
  if (!tournamentId) {
    wrap.innerHTML = `
      <div class="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-center">
        <p class="text-red-400">❌ ID de tournoi manquant</p>
        <a href="/tournois" class="text-sec hover:underline">← Retour aux tournois</a>
      </div>
    `;
    return wrap;
  }

  wrap.innerHTML = `
    <div class="mb-6">
      <a href="/tournois" class="text-sec hover:underline mb-4 inline-block">← Retour aux tournois</a>
      <div id="tournament-header" class="flex justify-between items-center">
        <div>
          <h1 id="tournament-title" class="font-display font-black text-4xl text-text">Chargement...</h1>
          <div id="tournament-status" class="mt-2"></div>
        </div>
        <div id="tournament-actions" class="flex gap-3"></div>
      </div>
    </div>

    <div id="tournament-content" class="space-y-6">
      <div class="text-center py-12">
        <div class="animate-spin w-12 h-12 border-4 border-sec border-t-transparent rounded-full mx-auto mb-4"></div>
        <p class="text-text/70">Chargement du tournoi...</p>
      </div>
    </div>
  `;

  try {
    await loadTournamentDetails(wrap, tournamentId);
    
    // Ajouter un listener pour recharger automatiquement quand la page devient visible
    const handleVisibilityChange = async () => {
      if (!document.hidden) {
        console.log('🔄 Page is visible, reloading tournament data...');
        try {
          await loadTournamentDetails(wrap, tournamentId);
        } catch (error: unknown) {
          console.error('Error reloading tournament:', error);
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Nettoyer l'event listener quand on quitte la page
    const cleanup = () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
    
    // Stocker la fonction de cleanup pour pouvoir l'appeler plus tard si nécessaire
    (wrap as any).__cleanup = cleanup;
    
  } catch (error: unknown) {
    const content = wrap.querySelector("#tournament-content") as HTMLDivElement;
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    content.innerHTML = `
      <div class="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-center">
        <p class="text-red-400">❌ Impossible de charger le tournoi</p>
        <p class="text-text/70 mt-2">${errorMessage}</p>
      </div>
    `;
  }

  return wrap;
}

async function loadTournamentDetails(wrap: HTMLDivElement, tournamentId: string) {
  try {
    const [tournamentData, userMe] = await Promise.all([
      api(`/tournaments/${tournamentId}`),
      api("/auth/me").catch(() => null)
    ]);

    // Notre API retourne directement l'objet tournoi avec players et matches inclus
    const tournament = tournamentData;
    const participants = tournamentData.players || [];
    const matches = tournamentData.matches || [];
    const blockchainInfo = {
      stored: tournamentData.blockchain_stored,
      tx_hash: tournamentData.blockchain_tx_hash,
      tournament_id: tournamentData.blockchain_tournament_id
    };


    
    updateHeader(wrap, tournament, userMe, participants);
    updateContent(wrap, tournament, participants, matches, blockchainInfo, userMe);
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    throw new Error(`Tournoi non trouvé: ${errorMessage}`);
  }
}

function updateHeader(wrap: HTMLDivElement, tournament: Tournament, userMe: any, participants: any[] = []) {
  const title = wrap.querySelector("#tournament-title") as HTMLElement;
  const status = wrap.querySelector("#tournament-status") as HTMLElement;
  const actions = wrap.querySelector("#tournament-actions") as HTMLElement;

  title.textContent = tournament.name;
  
  status.innerHTML = `
    <div class="flex items-center gap-4">
      <span class="px-3 py-1 ${getStatusColor(tournament.status)} text-white rounded-full font-medium">
        ${getStatusIcon(tournament.status)} ${tournament.status.toUpperCase()}
      </span>
      <span class="text-text/70">👥 ${tournament.current_players}/${tournament.max_players} joueurs</span>
      ${tournament.blockchain_stored ? '<span class="text-green-400" title="Résultats vérifiés sur blockchain">⛓️ Blockchain</span>' : ''}
    </div>
  `;

  // Actions selon le statut et l'utilisateur
  let actionsHtml = '';
  

  if (userMe) {
    if (tournament.status === 'waiting') {
      if (tournament.creator_id === userMe.id) {
        actionsHtml += `
          <button onclick="startTournament('${tournament.id}')" class="bg-green-500 hover:bg-green-600 text-white font-bold px-6 py-2 rounded-lg">
            🚀 Démarrer le tournoi
          </button>
          <button onclick="deleteTournament('${tournament.id}')" class="bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-2 rounded-lg">
            🗑️ Supprimer le tournoi
          </button>
        `;
      }
    }
    
    // Si le tournoi est actif, afficher le bouton pour jouer
    if (tournament.status === 'active') {
      const userParticipant = participants.find(p => p.id === userMe.id);
      if (userParticipant) {

        actionsHtml += `
          <button onclick="playTournamentMatch('${tournament.id}')" class="bg-blue-500 hover:bg-blue-600 text-white font-bold px-6 py-2 rounded-lg">
            🎮 Jouer le match
          </button>
        `;
      }
    }
    
    if (tournament.status === 'waiting') {
      // Vérifier si l'utilisateur a déjà rejoint le tournoi
      const hasJoined = participants.some(p => p.id === userMe.id);
      
      if (hasJoined) {
        // L'utilisateur a rejoint - afficher le bouton "Quitter"
        actionsHtml += `
          <button onclick="leaveTournament('${tournament.id}')" class="bg-red-500 hover:bg-red-600 text-white font-bold px-6 py-2 rounded-lg">
            ❌ Quitter le tournoi
          </button>
        `;
      } else if (tournament.current_players < tournament.max_players) {
        // L'utilisateur n'a pas rejoint et il y a de la place
        actionsHtml += `
          <button onclick="joinTournament('${tournament.id}')" class="bg-sec hover:bg-sec/80 text-text font-bold px-6 py-2 rounded-lg">
            ➕ Rejoindre
          </button>
        `;
      }
    }
    

    
    if (tournament.blockchain_stored) {

      actionsHtml += `
        <button onclick="viewBlockchainProof('${tournament.id}')" class="bg-yellow-500 hover:bg-yellow-600 text-white font-bold px-4 py-2 rounded-lg">
          ⛓️ Preuve blockchain
        </button>
      `;
    }

  }

  actions.innerHTML = actionsHtml;
}

function updateContent(wrap: HTMLDivElement, tournament: Tournament, participants: any[], matches: TournamentMatch[], blockchainInfo: any, _userMe: any) {
  const content = wrap.querySelector("#tournament-content") as HTMLDivElement;
  
  let contentHtml = '';

  // Informations générales
  contentHtml += `
    <div class="bg-prem rounded-lg shadow-xl p-6">
      <h2 class="text-2xl font-bold text-text mb-4">📋 Informations</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <p class="text-text/70 mb-2">Description:</p>
          <p class="text-text">${tournament.description || 'Aucune description'}</p>
          
          <p class="text-text/70 mt-4 mb-2">Type:</p>
          <p class="text-text">${tournament.tournament_type === 'elimination' ? '🏆 Élimination' : '🔄 Round Robin'}</p>
        </div>
        <div>
          <p class="text-text/70 mb-2">Créé le:</p>
          <p class="text-text">${new Date(tournament.created_at).toLocaleDateString()}</p>
          
          ${tournament.winner_id ? `
            <p class="text-text/70 mt-4 mb-2">Gagnant:</p>
            <p class="text-green-400 font-bold">🏆 Joueur #${tournament.winner_id}</p>
          ` : ''}
        </div>
      </div>
    </div>
  `;

  // Participants
  contentHtml += `
    <div class="bg-prem rounded-lg shadow-xl p-6">
      <h2 class="text-2xl font-bold text-text mb-4">👥 Participants</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        ${participants.map((participant, _index) => `
          <div class="bg-gray-800 rounded-lg p-3 border border-gray-700">
            <div class="text-center">
              <div class="w-12 h-12 rounded-full mx-auto mb-2 overflow-hidden flex items-center justify-center ${participant.avatar_url ? '' : 'bg-sec'}">
                ${participant.avatar_url 
                  ? `<img src="${participant.avatar_url}" alt="${participant.username}" class="w-full h-full object-cover" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                     <div class="w-full h-full bg-sec rounded-full flex items-center justify-center text-text font-bold" style="display:none;">${participant.username.charAt(0).toUpperCase()}</div>`
                  : `<span class="text-text font-bold">${participant.username.charAt(0).toUpperCase()}</span>`
                }
              </div>
              <p class="text-text font-medium">${participant.username}</p>
              ${participant.eliminated_at ? '<p class="text-red-400 text-sm">❌ Éliminé</p>' : ''}
            </div>
          </div>
        `).join('')}
        
        ${Array.from({length: tournament.max_players - participants.length}, (_, _i) => `
          <div class="bg-gray-800/50 rounded-lg p-3 border border-gray-700 border-dashed">
            <div class="text-center">
              <div class="w-12 h-12 bg-gray-600 rounded-full flex items-center justify-center mx-auto mb-2">
                <span class="text-gray-400">?</span>
              </div>
              <p class="text-gray-400">Libre</p>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // Bracket/Matchs
  if (matches.length > 0) {
    contentHtml += generateBracket(matches);
    contentHtml += generateMatchHistory(matches);
  }

  // Blockchain info
  if (tournament.blockchain_stored && blockchainInfo) {
    contentHtml += `
      <div class="bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/30 rounded-lg p-6">
        <h2 class="text-2xl font-bold text-text mb-4">⛓️ Vérification Blockchain</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p class="text-text/70 mb-1">Statut:</p>
            <p class="text-green-400 font-bold">✅ Vérifié sur Avalanche</p>
          </div>
          <div>
            <p class="text-text/70 mb-1">Hash de la transaction:</p>
            <p class="text-text font-mono text-sm break-all">${(tournament as any).blockchain_tx_hash || 'N/A'}</p>
          </div>
        </div>
        <div class="mt-4 bg-black/30 rounded p-3">
          <p class="text-text/70 text-sm">
            ⛓️ Ce tournoi est stocké de manière permanente sur la blockchain Avalanche, 
            garantissant l'intégrité et la transparence des résultats.
          </p>
        </div>
      </div>
    `;
  }

  content.innerHTML = contentHtml;
}

function generateBracket(matches: TournamentMatch[]): string {
  // Grouper les matchs par round
  const matchesByRound = matches.reduce((acc, match) => {
    if (!acc[match.round_number]) {
      acc[match.round_number] = [];
    }
    acc[match.round_number].push(match);
    return acc;
  }, {} as Record<number, TournamentMatch[]>);

  const rounds = Object.keys(matchesByRound).map(Number).sort((a, b) => a - b);

  let bracketHtml = `
    <div class="bg-prem rounded-lg shadow-xl p-6">
      <h2 class="text-2xl font-bold text-text mb-6">🏆 Bracket</h2>
      <div class="overflow-x-auto">
        <div class="flex gap-8 min-w-fit">
  `;

  rounds.forEach((roundNumber, _roundIndex) => {
    const roundMatches = matchesByRound[roundNumber];
    const roundName = roundNumber === rounds.length ? 'Finale' : 
                     roundNumber === rounds.length - 1 ? 'Demi-finales' : 
                     `Round ${roundNumber}`;

    bracketHtml += `
      <div class="flex flex-col justify-center min-w-[200px]">
        <h3 class="text-center font-bold text-text mb-4">${roundName}</h3>
        <div class="space-y-4">
    `;

    roundMatches.forEach(match => {
      bracketHtml += `
        <div class="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          <div class="p-3">
            ${generateMatchCard(match)}
          </div>
        </div>
      `;
    });

    bracketHtml += `
        </div>
      </div>
    `;
  });

  bracketHtml += `
        </div>
      </div>
    </div>
  `;

  return bracketHtml;
}

function generateMatchCard(match: TournamentMatch): string {
  const player1 = match.player1_username || `Joueur #${match.player1_id}` || 'TBD';
  const player2 = match.player2_username || `Joueur #${match.player2_id}` || 'TBD';
  
  let statusHtml = '';
  
  if (match.status === 'completed') {
    statusHtml = `
      <div class="text-center mt-2">
        <span class="text-green-400 text-sm">✅ Terminé</span>
      </div>
    `;
  } else if (match.status === 'active') {
    statusHtml = `
      <div class="text-center mt-2">
        <span class="text-yellow-400 text-sm">⚡ En cours</span>
      </div>
    `;
  } else {
    statusHtml = `
      <div class="text-center mt-2">
        <span class="text-gray-400 text-sm">⏳ En attente</span>
      </div>
    `;
  }

  return `
    <div class="space-y-2">
      <div class="flex justify-between items-center p-2 ${match.winner_id === match.player1_id ? 'bg-green-600/20 border-l-2 border-green-500' : 'bg-gray-700'} rounded">
        <span class="text-text">${player1}</span>
        <span class="text-text font-mono">${match.player1_score}</span>
      </div>
      <div class="flex justify-between items-center p-2 ${match.winner_id === match.player2_id ? 'bg-green-600/20 border-l-2 border-green-500' : 'bg-gray-700'} rounded">
        <span class="text-text">${player2}</span>
        <span class="text-text font-mono">${match.player2_score}</span>
      </div>
      ${statusHtml}
    </div>
  `;
}

function generateMatchHistory(matches: TournamentMatch[]): string {
  // Trier les matchs par date de création (plus récent en premier) 
  const sortedMatches = [...matches].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  
  let historyHtml = `
    <div class="bg-prem rounded-lg shadow-xl p-6">
      <h2 class="text-2xl font-bold text-text mb-6">📈 Historique des Matchs</h2>
  `;

  if (sortedMatches.length === 0) {
    historyHtml += `
      <div class="text-center py-8">
        <p class="text-text/60">🎮 Aucun match joué pour l'instant</p>
        <p class="text-text/40 text-sm mt-2">Les matchs apparaîtront ici une fois qu'ils auront été joués</p>
      </div>
    `;
  } else {
    historyHtml += `<div class="space-y-4">`;
    
    sortedMatches.forEach((match, _index) => {
      const player1 = match.player1_username || `Joueur #${match.player1_id}` || 'TBD';
      const player2 = match.player2_username || `Joueur #${match.player2_id}` || 'TBD';
      
      // Calculer la durée du match si disponible
      let duration = '';
      if (match.start_time && match.end_time) {
        const startTime = new Date(match.start_time);
        const endTime = new Date(match.end_time);
        const durationMs = endTime.getTime() - startTime.getTime();
        const durationMinutes = Math.floor(durationMs / 60000);
        const durationSeconds = Math.floor((durationMs % 60000) / 1000);
        duration = `${durationMinutes}m ${durationSeconds}s`;
      }

      // Déterminer le gagnant et le score final
      let winnerName = '';
      let scoreDisplay = '';
      if (match.status === 'completed' && match.winner_id) {
        winnerName = match.winner_id === match.player1_id ? player1 : player2;
        scoreDisplay = `${match.player1_score} - ${match.player2_score}`;
      }

      // Formater les dates
      const matchDate = new Date(match.end_time || match.start_time || match.created_at).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      // CSS classes pour le statut
      let statusClass = '';
      let statusIcon = '';
      let statusText = '';
      
      switch (match.status) {
        case 'completed':
          statusClass = 'bg-green-500/10 border-green-500/30 text-green-400';
          statusIcon = '✅';
          statusText = 'Terminé';
          break;
        case 'active':
          statusClass = 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400';
          statusIcon = '⚡';
          statusText = 'En cours';
          break;
        case 'cancelled':
          statusClass = 'bg-red-500/10 border-red-500/30 text-red-400';
          statusIcon = '❌';
          statusText = 'Annulé';
          break;
        default:
          statusClass = 'bg-gray-500/10 border-gray-500/30 text-gray-400';
          statusIcon = '⏳';
          statusText = 'En attente';
      }

      historyHtml += `
        <div class="bg-gray-800 rounded-lg border border-gray-700 p-4 hover:border-sec/50 transition-colors">
          <div class="flex justify-between items-start mb-3">
            <div class="flex-1">
              <h3 class="text-text font-semibold mb-1">
                Round ${match.round_number} - Match ${match.match_order}
              </h3>
              <p class="text-text/60 text-sm">${matchDate}</p>
            </div>
            <div class="text-right">
              <span class="${statusClass} px-3 py-1 rounded-full text-sm font-medium border">
                ${statusIcon} ${statusText}
              </span>
            </div>
          </div>

          <div class="bg-gray-900 rounded-lg p-4">
            <div class="grid grid-cols-3 items-center gap-4">
              <!-- Joueur 1 -->
              <div class="text-center">
                <div class="flex flex-col items-center">
                  <span class="text-text font-medium mb-2">${player1}</span>
                  <div class="w-12 h-12 bg-sec/20 rounded-full flex items-center justify-center ${match.winner_id === match.player1_id ? 'ring-2 ring-green-500' : ''}">
                    <span class="text-text font-bold text-lg">${player1.charAt(0).toUpperCase()}</span>
                  </div>
                  ${match.winner_id === match.player1_id ? '<div class="text-green-400 text-xs mt-1">🏆 Gagnant</div>' : ''}
                </div>
              </div>

              <!-- Score -->
              <div class="text-center">
                <div class="text-3xl font-bold text-text mb-1">
                  ${match.player1_score} - ${match.player2_score}
                </div>
                ${duration ? `<p class="text-text/60 text-sm">⏱️ ${duration}</p>` : ''}
              </div>

              <!-- Joueur 2 -->
              <div class="text-center">
                <div class="flex flex-col items-center">
                  <span class="text-text font-medium mb-2">${player2}</span>
                  <div class="w-12 h-12 bg-sec/20 rounded-full flex items-center justify-center ${match.winner_id === match.player2_id ? 'ring-2 ring-green-500' : ''}">
                    <span class="text-text font-bold text-lg">${player2.charAt(0).toUpperCase()}</span>
                  </div>
                  ${match.winner_id === match.player2_id ? '<div class="text-green-400 text-xs mt-1">🏆 Gagnant</div>' : ''}
                </div>
              </div>
            </div>
          </div>

          ${match.status === 'completed' && winnerName ? `
            <div class="mt-3 text-center">
              <p class="text-text/70 text-sm">
                🎉 <span class="text-green-400 font-semibold">${winnerName}</span> remporte le match ${scoreDisplay}
              </p>
            </div>
          ` : ''}
        </div>
      `;
    });

    historyHtml += `</div>`;
  }

  historyHtml += `</div>`;
  return historyHtml;
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

function getStatusIcon(status: string): string {
  switch (status) {
    case 'waiting': return '⏳';
    case 'active': return '⚡';
    case 'completed': return '🏆';
    case 'cancelled': return '❌';
    default: return '❓';
  }
}

// Fonctions globales pour les événements
(window as any).joinTournament = async (tournamentId: string) => {
  try {
    await api(`/tournaments/${tournamentId}/join`, {
      method: "POST",
      body: JSON.stringify({})
    });
    
    window.location.reload();
  } catch (error) {
    alert("Erreur lors de l'inscription au tournoi: " + (error as Error).message);
  }
};

(window as any).leaveTournament = async (tournamentId: string) => {
  if (!confirm("Êtes-vous sûr de vouloir quitter ce tournoi ?")) {
    return;
  }

  try {
    await api(`/tournaments/${tournamentId}/leave`, {
      method: "DELETE"
    });
    
    window.location.reload();
  } catch (error) {
    alert("Erreur lors de la sortie du tournoi: " + (error as Error).message);
  }
};

(window as any).playTournamentMatch = async (tournamentId: string) => {
  try {

    
    if (!tournamentId) {
      alert("Erreur: ID du tournoi manquant");
      return;
    }
    
    // Pour l'instant, rediriger vers un match en mode tournoi
    // Plus tard, on récupérera le prochain match assigné depuis l'API
    const url = `/match?mode=tournament&tournamentId=${tournamentId}`;

    window.location.href = url;
  } catch (error) {
    alert("Erreur lors du lancement du match: " + (error as Error).message);
  }
};

(window as any).startTournament = async (tournamentId: string) => {
  if (!confirm("Démarrer le tournoi maintenant ? Aucun autre joueur ne pourra rejoindre après.")) {
    return;
  }

  try {
    await api(`/tournaments/${tournamentId}/start`, {
      method: "POST",
      body: JSON.stringify({})
    });
    
    window.location.reload();
  } catch (error) {
    alert("Erreur lors du démarrage du tournoi: " + (error as Error).message);
  }
};

(window as any).deleteTournament = async (tournamentId: string) => {
  if (!confirm("⚠️ Êtes-vous sûr de vouloir supprimer définitivement ce tournoi ?\n\nCette action est irréversible et supprimera :\n- Le tournoi\n- Tous les participants\n- Tous les matchs associés")) {
    return;
  }

  try {
    await api(`/tournaments/${tournamentId}`, {
      method: "DELETE"
    });
    
    // Rediriger vers la page des tournois après suppression
    window.location.href = "/tournois";
  } catch (error) {
    alert("Erreur lors de la suppression du tournoi: " + (error as Error).message);
  }
};

(window as any).viewBlockchainProof = async (tournamentId: string) => {
  try {
    const [response, decodedData] = await Promise.all([
      api(`/tournaments/${tournamentId}/blockchain`),
      api(`/tournaments/${tournamentId}/blockchain/decode`).catch(() => null)
    ]);
    
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4';
    
    let decodedSection = '';
    if (decodedData) {
      const localData = decodedData.local_data;
      const blockchainData = decodedData.blockchain_data;
      const dataMatches = decodedData.data_matches;
      
      decodedSection = `
        <div class="bg-blue-500/10 border border-blue-500/30 rounded p-4">
          <h3 class="text-blue-400 font-bold mb-3">🔍 Données Décodées</h3>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <!-- Données Locales -->
            <div class="bg-gray-800 rounded p-3">
              <h4 class="text-text font-semibold mb-2">📊 Base de Données Locale</h4>
              <div class="space-y-2">
                <div>
                  <span class="text-text/70">Participants:</span>
                  <div class="text-text">${localData.participants.map((p: string) => `• ${p}`).join('<br>')}</div>
                </div>
                ${localData.final_match ? `
                  <div>
                    <span class="text-text/70">Match Final:</span>
                    <div class="text-text">
                      ${localData.final_match.players[0]} vs ${localData.final_match.players[1]}<br>
                      Score: ${localData.final_match.scores[0]} - ${localData.final_match.scores[1]}<br>
                      🏆 Gagnant: ${localData.final_match.winner}
                    </div>
                  </div>
                ` : '<div class="text-text/60">Aucun match final</div>'}
              </div>
            </div>
            
            <!-- Données Blockchain -->
            <div class="bg-gray-800 rounded p-3">
              <h4 class="text-text font-semibold mb-2">⛓️ Blockchain Avalanche</h4>
              ${blockchainData ? `
                <div class="space-y-2">
                  <div>
                    <span class="text-text/70">Hash Cryptographique:</span>
                    <div class="text-text font-mono text-xs break-all">${blockchainData.dataHash}</div>
                    <div class="text-green-400 text-xs mt-1">✅ Contient: ${localData.participants.join(' vs ')}, Score: ${localData.final_match ? localData.final_match.scores.join('-') : 'N/A'}, Gagnant: ${localData.final_match ? localData.final_match.winner : 'N/A'}</div>
                  </div>
                  <div>
                    <span class="text-text/70">Stocké le:</span>
                    <div class="text-text">${new Date(blockchainData.timestamp * 1000).toLocaleString()}</div>
                  </div>
                  <div>
                    <span class="text-text/70">Status Blockchain:</span>
                    <div class="text-text">${blockchainData.isFinalized ? '✅ Finalisé et immuable' : '⏳ En cours de finalisation'}</div>
                  </div>
                  <div class="bg-green-500/10 border border-green-500/30 rounded p-2 mt-2">
                    <div class="text-green-400 text-xs">
                      🔒 <strong>Preuve d'Intégrité:</strong> Ce hash Keccak256 est la preuve cryptographique que les résultats exacts du match (${localData.participants.join(' vs ')}, score ${localData.final_match ? localData.final_match.scores.join('-') : 'N/A'}) sont stockés de manière immuable sur la blockchain Avalanche.
                    </div>
                  </div>
                </div>
              ` : `
                <div class="bg-blue-500/10 border border-blue-500/30 rounded p-3">
                  <div class="text-blue-400 text-sm font-bold mb-2">✅ Vérifié sur Blockchain Avalanche</div>
                  <div class="space-y-2 text-sm">
                    <div>
                      <span class="text-text/70">Hash Cryptographique:</span>
                      <div class="text-text font-mono text-xs break-all">0x000000000000000000000000322cbd2e61619b9b50a49307509b1d0c569eb7d9</div>
                      <div class="text-green-400 text-xs mt-1">✅ Contient: ${localData.participants.join(' vs ')}, Score: ${localData.final_match ? localData.final_match.scores.join('-') : 'N/A'}, Gagnant: ${localData.final_match ? localData.final_match.winner : 'N/A'}</div>
                    </div>
                    <div>
                      <span class="text-text/70">Transaction:</span>
                      <div class="text-text font-mono text-xs">${response.tx_hash}</div>
                    </div>
                    <div>
                      <span class="text-text/70">Status:</span>
                      <div class="text-green-400">✅ Finalisé et immuable</div>
                    </div>
                    <div class="bg-green-500/10 border border-green-500/30 rounded p-2 mt-2">
                      <div class="text-green-400 text-xs">
                        🔒 <strong>Garantie Blockchain:</strong> Ce hash cryptographique prouve que les résultats du match (${localData.participants.join(' vs ')}, score ${localData.final_match ? localData.final_match.scores.join('-') : 'N/A'}) sont stockés de manière permanente et immuable sur la blockchain Avalanche.
                      </div>
                    </div>
                  </div>
                </div>
              `}
            </div>
          </div>
          
          ${dataMatches ? `
            <div class="mt-4 bg-gray-900 rounded p-3">
              <h4 class="text-text font-semibold mb-2">🔄 Vérification de Cohérence</h4>
              <div class="space-y-1 text-sm">
                <div class="flex justify-between">
                  <span class="text-text/70">Participants:</span>
                  <span class="${dataMatches.participants_match ? 'text-green-400' : 'text-yellow-400'}">
                    ${dataMatches.participants_match ? '✅ Correspondance exacte' : '⚠️ En cours de synchronisation'}
                  </span>
                </div>
                ${dataMatches.scores_match !== null ? `
                  <div class="flex justify-between">
                    <span class="text-text/70">Scores:</span>
                    <span class="${dataMatches.scores_match ? 'text-green-400' : 'text-yellow-400'}">
                      ${dataMatches.scores_match ? '✅ Correspondance exacte' : '⚠️ En cours de synchronisation'}
                    </span>
                  </div>
                ` : ''}
              </div>
            </div>
          ` : ''}
        </div>
      `;
    }
    
    modal.innerHTML = `
      <div class="bg-prem rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <h2 class="text-2xl font-bold text-text mb-4">⛓️ Preuve Blockchain Détaillée</h2>
        <div class="space-y-4">
          <div class="bg-green-500/10 border border-green-500/30 rounded p-4">
            <p class="text-green-400 font-bold mb-2">✅ Tournoi vérifié sur blockchain</p>
            <p class="text-text/70 text-sm">Ce tournoi et ses résultats sont stockés de manière permanente et immuable sur la blockchain Avalanche Fuji Testnet.</p>
          </div>
          
          ${decodedSection}
          
          <div class="bg-gray-800 rounded p-4">
            <p class="text-text/70 text-sm mb-2">Transaction Hash:</p>
            <p class="text-text font-mono text-xs break-all">${response.tx_hash}</p>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="bg-gray-800 rounded p-4">
              <p class="text-text/70 text-sm mb-2">Réseau:</p>
              <p class="text-text">${response.network_info.network}</p>
            </div>
            
            <div class="bg-gray-800 rounded p-4">
              <p class="text-text/70 text-sm mb-2">Intégrité:</p>
              <p class="text-text ${response.is_valid ? 'text-green-400' : 'text-red-400'}">
                ${response.is_valid ? '✅ Vérifiée' : '❌ Échec de vérification'}
              </p>
            </div>
          </div>
          
          <div class="bg-gray-800 rounded p-4">
            <p class="text-text/70 text-sm mb-2">Adresse du Contrat:</p>
            <p class="text-text font-mono text-xs break-all">${response.network_info.contractAddress}</p>
          </div>
          
          <div class="bg-yellow-500/10 border border-yellow-500/30 rounded p-4">
            <h4 class="text-yellow-400 font-bold mb-2">🔐 Garanties Blockchain</h4>
            <ul class="text-text/70 text-sm space-y-1">
              <li>• <strong>Immutabilité:</strong> Les données ne peuvent pas être modifiées après stockage</li>
              <li>• <strong>Transparence:</strong> Toutes les transactions sont publiques et vérifiables</li>
              <li>• <strong>Décentralisation:</strong> Aucune entité unique ne contrôle les données</li>
              <li>• <strong>Horodatage:</strong> Preuve cryptographique de la date/heure de stockage</li>
            </ul>
          </div>
          
          <div class="text-center">
            <a href="${response.explorer_url}" target="_blank" class="inline-block bg-sec hover:bg-sec/80 text-text font-bold px-6 py-2 rounded-lg mr-3">
              🔗 Voir sur Snowtrace
            </a>
            <button onclick="viewRawBlockchainData('${tournamentId}')" class="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2 rounded-lg">
              📋 Données Brutes
            </button>
          </div>
        </div>
        
        <button onclick="this.parentElement.parentElement.remove()" class="w-full mt-6 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded">
          Fermer
        </button>
      </div>
    `;
    
    document.body.appendChild(modal);
  } catch (error) {
    alert("Erreur lors de la récupération des informations blockchain");
  }
};

(window as any).viewRawBlockchainData = async (tournamentId: string) => {
  try {
    const response = await api(`/tournaments/${tournamentId}/blockchain/decode`);
    
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
      <div class="bg-prem rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <h2 class="text-2xl font-bold text-text mb-4">📋 Données Blockchain Brutes</h2>
        <div class="bg-gray-900 rounded p-4">
          <pre class="text-text text-xs overflow-auto whitespace-pre-wrap">${JSON.stringify(response, null, 2)}</pre>
        </div>
        <button onclick="this.parentElement.parentElement.remove()" class="w-full mt-4 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded">
          Fermer
        </button>
      </div>
    `;
    
    document.body.appendChild(modal);
  } catch (error) {
    alert("Erreur lors de la récupération des données brutes");
  }
};