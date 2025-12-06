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
  blockchain_tx_hash?: string;
  blockchain_match_id?: string;
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
    
    // Blockchain verification now handled at individual match level
    updateHeader(wrap, tournament, userMe, participants);
    updateContent(wrap, tournament, participants, matches, userMe);
    
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

    </div>
  `;

  // Actions selon le statut et l'utilisateur
  let actionsHtml = '';
  

  if (userMe) {
    if (tournament.status === 'waiting') {
      if (tournament.creator_id === userMe.id) {
        const isPowerOfTwo = (n: number) => n > 0 && (n & (n - 1)) === 0;
        const canStart = participants.length >= 2 && (tournament.tournament_type !== 'elimination' || isPowerOfTwo(participants.length));
        const startButtonClass = canStart ? "bg-green-500 hover:bg-green-600" : "bg-gray-500 cursor-not-allowed";
        const startButtonText = canStart ? "🚀 Démarrer le tournoi" : 
          (participants.length < 2 ? "⏳ Besoin de plus de joueurs" :
           (!isPowerOfTwo(participants.length) ? "⚠️ Besoin de 2, 4 ou 8 joueurs" : "🚀 Démarrer le tournoi"));

        actionsHtml += `
          <button onclick="${canStart ? `startTournament('${tournament.id}')` : 'showTournamentStartError()'}" 
                  class="${startButtonClass} text-white font-bold px-6 py-2 rounded-lg" 
                  ${!canStart ? 'disabled' : ''}>
            ${startButtonText}
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
          <button onclick="resetStaleMatch('${tournament.id}')" class="bg-yellow-500 hover:bg-yellow-600 text-white font-bold px-4 py-2 rounded-lg" title="Réinitialiser un match bloqué">
            🔄 Reset match
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
    

    
    // Le bouton "Preuve blockchain" est maintenant affiché au niveau de chaque match dans l'historique

  }

  actions.innerHTML = actionsHtml;
}

function updateContent(wrap: HTMLDivElement, tournament: Tournament, participants: any[], matches: TournamentMatch[], _userMe: any) {
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
          <p class="text-text">${new Date(tournament.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
          
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
          <div class="bg-gray-800 rounded-lg p-3 border border-gray-700" data-participant-id="${participant.id}">
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
    contentHtml += generateBracket(tournament, participants, matches);
    contentHtml += generateMatchHistory(matches);
  }

  // Note: Blockchain verification is now handled at individual match level
  // Each completed match has its own blockchain proof button in the match history

  content.innerHTML = contentHtml;
}

function generateBracket(tournament: Tournament, participants: any[], matches: TournamentMatch[]): string {
  // Grouper les matchs par round
  const matchesByRound = matches.reduce((acc, match) => {
    if (!acc[match.round_number]) {
      acc[match.round_number] = [];
    }
    acc[match.round_number].push(match);
    return acc;
  }, {} as Record<number, TournamentMatch[]>);

  const rounds = Object.keys(matchesByRound).map(Number).sort((a, b) => a - b);

  // Calculate total expected rounds based on actual number of participants
  // For 4 players: 2 rounds (demi-finales -> finale)
  // For 8 players: 3 rounds (quart -> demi -> finale)
  // For 16 players: 4 rounds (8ème -> quart -> demi -> finale)
  const actualParticipants = participants.length || tournament.max_players;
  const totalExpectedRounds = Math.log2(actualParticipants);

  let bracketHtml = `
    <div class="bg-prem rounded-lg shadow-xl p-6">
      <h2 class="text-2xl font-bold text-text mb-6">🏆 Bracket</h2>
      <div class="overflow-x-auto">
        <div class="flex gap-8 min-w-fit">
  `;

  rounds.forEach((roundNumber, _roundIndex) => {
    const roundMatches = matchesByRound[roundNumber];
    
    // Determine round name based on position from the end
    let roundName = `Round ${roundNumber}`;
    if (roundNumber === totalExpectedRounds) {
      roundName = 'Finale';
    } else if (roundNumber === totalExpectedRounds - 1) {
      roundName = 'Demi-finales';
    } else if (roundNumber === totalExpectedRounds - 2) {
      roundName = 'Quart de finale';
    }

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
  const player1 = match.player1_username || (match.player1_id ? `Joueur #${match.player1_id}` : '...');
  const player2 = match.player2_username || (match.player2_id ? `Joueur #${match.player2_id}` : '...');
  
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

  // Ne pas afficher l'overlay vert si le match n'a qu'un seul joueur ou n'est pas terminé
  const isIncompleteMatch = !match.player2_id;
  const isMatchCompleted = match.status === 'completed';
  
  return `
    <div class="space-y-2">
      <div class="flex justify-between items-center gap-3 p-2 ${!isIncompleteMatch && isMatchCompleted && match.winner_id === match.player1_id ? 'bg-green-600/20 border-l-2 border-green-500' : 'bg-gray-700'} rounded">
        <span class="text-text truncate flex-1">${player1}</span>
        <span class="text-text font-mono whitespace-nowrap">${match.player1_score}</span>
      </div>
      <div class="flex justify-between items-center gap-3 p-2 ${!isIncompleteMatch && isMatchCompleted && match.winner_id === match.player2_id ? 'bg-green-600/20 border-l-2 border-green-500' : 'bg-gray-700'} rounded">
        <span class="text-text truncate flex-1">${player2}</span>
        <span class="text-text font-mono whitespace-nowrap">${match.player2_score}</span>
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
      const player1 = match.player1_username || (match.player1_id ? `Joueur #${match.player1_id}` : '...');
      const player2 = match.player2_username || (match.player2_id ? `Joueur #${match.player2_id}` : '...');
      
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

      // Formater les dates seulement pour les matchs commencés/terminés
      let matchDateHtml = '';
      if (match.status !== 'pending' && (match.end_time || match.start_time)) {
        const dateValue = match.end_time || match.start_time || match.created_at;
        const matchDate = new Date(dateValue).toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        matchDateHtml = `<p class="text-text/60 text-sm">${matchDate}</p>`;
      }

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
              ${matchDateHtml}
            </div>
            <div class="text-right flex items-center gap-2">
              <span class="${statusClass} px-3 py-1 rounded-full text-sm font-medium border">
                ${statusIcon} ${statusText}
              </span>
              ${match.status === 'completed' && match.blockchain_tx_hash ? `
                <button onclick="viewMatchBlockchainProof('${match.match_id}')" 
                        class="bg-yellow-500 hover:bg-yellow-600 text-white text-xs px-2 py-1 rounded-lg transition-colors"
                        title="Voir la preuve blockchain de ce match">
                  ⛓️ Preuve
                </button>
              ` : ''}
            </div>
          </div>

          <div class="bg-gray-900 rounded-lg p-4">
            <div class="grid grid-cols-3 items-center gap-4">
              <!-- Joueur 1 -->
              <div class="text-center">
                <div class="flex flex-col items-center">
                  <span class="text-text font-medium mb-2">${player1}</span>
                  <div class="w-12 h-12 bg-sec/20 rounded-full flex items-center justify-center ${match.status === 'completed' && match.winner_id === match.player1_id ? 'ring-2 ring-green-500' : ''}">
                    <span class="text-text font-bold text-lg">${player1.charAt(0).toUpperCase()}</span>
                  </div>
                  ${match.status === 'completed' && match.winner_id === match.player1_id && match.player2_id ? '<div class="text-green-400 text-xs mt-1">🏆 Gagnant</div>' : ''}
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
                  <div class="w-12 h-12 bg-sec/20 rounded-full flex items-center justify-center ${match.status === 'completed' && match.winner_id === match.player2_id ? 'ring-2 ring-green-500' : ''}">
                    <span class="text-text font-bold text-lg">${player2.charAt(0).toUpperCase()}</span>
                  </div>
                  ${match.status === 'completed' && match.winner_id === match.player2_id && match.player2_id ? '<div class="text-green-400 text-xs mt-1">🏆 Gagnant</div>' : ''}
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
    
    // Récupérer le prochain match de l'utilisateur dans ce tournoi
    const nextMatch = await api(`/tournaments/${tournamentId}/next-match`);
    
    if (!nextMatch || !nextMatch.match) {
      // Vérifier s'il y a un match actif bloqué
      if (nextMatch.activeMatchId && nextMatch.canRestart) {
        if (confirm("Vous avez un match en cours qui semble bloqué. Voulez-vous le réinitialiser et recommencer ?")) {
          try {
            await api(`/tournaments/${tournamentId}/reset-match`, {
              method: "POST",
              body: JSON.stringify({ matchId: nextMatch.activeMatchId })
            });
            // Réessayer après reset
            return (window as any).playTournamentMatch(tournamentId);
          } catch (resetError: any) {
            alert("Erreur lors de la réinitialisation: " + resetError.message);
            return;
          }
        }
      }
      alert(nextMatch.message || "Aucun match en attente pour vous dans ce tournoi");
      return;
    }

    const match = nextMatch.match;
    
    // Démarrer le match côté serveur pour validation
    try {
      await api(`/tournaments/${tournamentId}/start-match`, {
        method: "POST",
        body: JSON.stringify({ matchId: match.match_id })
      });
    } catch (startError: any) {
      alert("Impossible de démarrer le match: " + startError.message);
      return;
    }
    
    // Rediriger vers le match avec les IDs des joueurs
    const url = `/match?mode=tournament&tournamentId=${tournamentId}&matchId=${match.match_id}&player1=${match.player1_id}&player2=${match.player2_id}`;
    
    console.log('🎮 Lancement du match:', {
      tournamentId,
      matchId: match.match_id,
      player1: match.player1_id,
      player2: match.player2_id,
      url
    });

    window.location.href = url;
  } catch (error) {
    console.error('Erreur playTournamentMatch:', error);
    alert("Erreur lors du lancement du match: " + (error as Error).message);
  }
};

(window as any).resetStaleMatch = async (tournamentId: string) => {
  try {
    if (!confirm("Réinitialiser votre dernier match ? Ceci annulera la partie en cours ou récente.")) {
      return;
    }

    // Appeler reset-match sans matchId pour qu'il trouve automatiquement le bon match
    const result = await api(`/tournaments/${tournamentId}/reset-match`, {
      method: "POST",
      body: JSON.stringify({})
    });
    
    if (result.success) {
      alert(`Match réinitialisé avec succès ! (était en statut: ${result.previousStatus})\nVous pouvez maintenant relancer une partie.`);
      window.location.reload();
    } else {
      alert("Erreur lors de la réinitialisation du match.");
    }
  } catch (error: any) {
    console.error('Erreur resetStaleMatch:', error);
    
    // Messages d'erreur plus utiles
    let errorMessage = "Erreur lors de la réinitialisation";
    if (error.message.includes("No resettable match found")) {
      errorMessage = "Aucun match à réinitialiser trouvé. Le match est peut-être déjà terminé ou vous n'y participez pas.";
    } else if (error.message.includes("not a participant")) {
      errorMessage = "Vous ne participez pas à ce match.";
    } else {
      errorMessage += ": " + error.message;
    }
    
    alert(errorMessage);
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

(window as any).viewMatchBlockchainProof = async (matchId: string) => {
  try {
    const response = await api(`/tournaments/match/${matchId}/blockchain`);
    
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4';
    
    const localData = response.local_data;
    const blockchainData = response.blockchain_data;
    const dataMatches = response.data_matches;
    const isVerified = response.verification_status === 'VERIFIED';
    
    let explorerLink = '';
    if (response.network_info?.explorer_url) {
      explorerLink = `
        <div class="mt-3">
          <a href="${response.network_info.explorer_url}" target="_blank" 
             class="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            🔗 Voir sur Snowtrace
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
            </svg>
          </a>
        </div>
      `;
    }
    
    modal.innerHTML = `
      <div class="bg-prem rounded-xl p-6 max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-2xl font-bold text-text">⛓️ Preuve Blockchain - ${response.match_name}</h2>
          <div class="flex items-center gap-2">
            ${isVerified ? `
              <span class="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm font-medium">
                ✅ VÉRIFIÉ
              </span>
            ` : response.blockchain_data ? `
              <span class="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-sm font-medium">
                ❌ INCOHÉRENCE
              </span>
            ` : `
              <span class="bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-full text-sm font-medium">
                ⏳ NON STOCKÉ
              </span>
            `}
          </div>
        </div>
        

        
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <!-- Informations Blockchain -->
          <div class="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <h3 class="text-blue-400 font-bold mb-3 flex items-center gap-2">
              <span class="text-xl">⛓️</span> Informations Blockchain
            </h3>
            <div class="space-y-3 text-sm">
              <div>
                <span class="text-text/70 block mb-1">Transaction Hash:</span>
                <code class="text-text bg-gray-800 px-2 py-1 rounded block break-all text-xs">
                  ${response.tx_hash || 'Non disponible'}
                </code>
              </div>
              <div>
                <span class="text-text/70 block mb-1">Match ID Blockchain:</span>
                <code class="text-text bg-gray-800 px-2 py-1 rounded block break-all text-xs">
                  ${response.blockchain_match_id || 'Non disponible'}
                </code>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <span class="text-text/70 block mb-1">Réseau:</span>
                  <div class="text-text">${response.network_info?.network || 'Avalanche Fuji'}</div>
                </div>
                <div>
                  <span class="text-text/70 block mb-1">Statut:</span>
                  <div class="text-text">${response.is_stored ? '✅ Stocké' : '❌ Non stocké'}</div>
                </div>
              </div>
              <div>
                <span class="text-text/70 block mb-1">Contrat Smart Contract:</span>
                <code class="text-text bg-gray-800 px-2 py-1 rounded block break-all text-xs">
                  ${response.network_info?.contractAddress || 'Non disponible'}
                </code>
              </div>
              ${explorerLink}
            </div>
          </div>
          
          <!-- État du Match -->
          <div class="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
            <h3 class="text-green-400 font-bold mb-3 flex items-center gap-2">
              <span class="text-xl">🏆</span> État du Match
            </h3>
            <div class="space-y-3 text-sm">
              <div>
                <span class="text-text/70 block mb-1">Participants:</span>
                <div class="text-text">
                  <div class="flex items-center gap-2">
                    <span class="w-2 h-2 bg-blue-400 rounded-full"></span>
                    ${localData?.players?.[0] || 'Joueur 1'}
                  </div>
                  <div class="flex items-center gap-2 mt-1">
                    <span class="w-2 h-2 bg-red-400 rounded-full"></span>
                    ${localData?.players?.[1] || 'Joueur 2'}
                  </div>
                </div>
              </div>
              <div>
                <span class="text-text/70 block mb-1">Score Final:</span>
                <div class="text-text text-lg font-bold">
                  ${localData?.scores?.[0] || 0} - ${localData?.scores?.[1] || 0}
                </div>
              </div>
              <div>
                <span class="text-text/70 block mb-1">Gagnant:</span>
                <div class="text-text font-semibold text-yellow-400">
                  🏆 ${localData?.winner || 'Non déterminé'}
                </div>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <span class="text-text/70 block mb-1">Round:</span>
                  <div class="text-text">${localData?.round || 'N/A'}</div>
                </div>
                <div>
                  <span class="text-text/70 block mb-1">Stocké le:</span>
                  <div class="text-text text-xs">${response.stored_at ? new Date(response.stored_at).toLocaleString('fr-FR') : 'N/A'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Comparaison Détaillée des Données -->
        ${blockchainData ? `
          <div class="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
            <h3 class="text-yellow-400 font-bold mb-3 flex items-center gap-2">
              <span class="text-xl">🔍</span> Vérification d'Intégrité des Données
            </h3>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <!-- Données Locales -->
              <div class="bg-gray-800/50 rounded-lg p-4">
                <h4 class="text-text font-semibold mb-3 flex items-center gap-2">
                  <span class="w-3 h-3 bg-blue-400 rounded-full"></span>
                  Base de Données Locale
                </h4>
                <div class="space-y-2 text-sm">
                  <div class="flex justify-between">
                    <span class="text-text/70">Joueur 1:</span>
                    <span class="text-text font-mono">${localData.players[0]}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-text/70">Joueur 2:</span>
                    <span class="text-text font-mono">${localData.players[1]}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-text/70">Score J1:</span>
                    <span class="text-text font-mono">${localData.scores[0]}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-text/70">Score J2:</span>
                    <span class="text-text font-mono">${localData.scores[1]}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-text/70">Gagnant:</span>
                    <span class="text-text font-mono">${localData.winner}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-text/70">Round:</span>
                    <span class="text-text font-mono">${localData.round}</span>
                  </div>
                </div>
              </div>
              
              <!-- Données Blockchain -->
              <div class="bg-gray-800/50 rounded-lg p-4">
                <h4 class="text-text font-semibold mb-3 flex items-center gap-2">
                  <span class="w-3 h-3 bg-purple-400 rounded-full"></span>
                  Données Blockchain
                </h4>
                <div class="space-y-2 text-sm">
                  <div class="flex justify-between">
                    <span class="text-text/70">Joueur 1:</span>
                    <span class="text-text font-mono">${blockchainData.player1Name} (${blockchainData.player1Score} pts)</span>
                    ${dataMatches?.scores_match && blockchainData.player1Name === localData?.players?.[0] ? '<span class="text-green-400 ml-2">✓</span>' : '<span class="text-red-400 ml-2">✗</span>'}
                  </div>
                  <div class="flex justify-between">
                    <span class="text-text/70">Joueur 2:</span>
                    <span class="text-text font-mono">${blockchainData.player2Name} (${blockchainData.player2Score} pts)</span>
                    ${dataMatches?.scores_match && blockchainData.player2Name === localData?.players?.[1] ? '<span class="text-green-400 ml-2">✓</span>' : '<span class="text-red-400 ml-2">✗</span>'}
                  </div>
                  <div class="flex justify-between">
                    <span class="text-text/70">Score J1:</span>
                    <span class="text-text font-mono">${blockchainData.player1Score}</span>
                    ${dataMatches?.scores_match ? '<span class="text-green-400 ml-2">✓</span>' : '<span class="text-red-400 ml-2">✗</span>'}
                  </div>
                  <div class="flex justify-between">
                    <span class="text-text/70">Score J2:</span>
                    <span class="text-text font-mono">${blockchainData.player2Score}</span>
                    ${dataMatches?.scores_match ? '<span class="text-green-400 ml-2">✓</span>' : '<span class="text-red-400 ml-2">✗</span>'}
                  </div>
                  <div class="flex justify-between">
                    <span class="text-text/70">Gagnant:</span>
                    <span class="text-text font-mono">${blockchainData.winner}</span>
                    ${dataMatches?.winner_match ? '<span class="text-green-400 ml-2">✓</span>' : '<span class="text-red-400 ml-2">✗</span>'}
                  </div>
                  <div class="flex justify-between">
                    <span class="text-text/70">Round:</span>
                    <span class="text-text font-mono">${blockchainData.round}</span>
                    ${dataMatches?.round_match ? '<span class="text-green-400 ml-2">✓</span>' : '<span class="text-red-400 ml-2">✗</span>'}
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Résultat de la Vérification -->
            <div class="bg-gray-900 rounded-lg p-4">
              <h4 class="text-text font-semibold mb-2">Résultat de la Vérification</h4>
              ${dataMatches?.all_verified ? `
                <div class="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/30 rounded">
                  <span class="text-green-400 text-2xl">✅</span>
                  <div>
                    <div class="text-green-400 font-semibold">INTÉGRITÉ VÉRIFIÉE</div>
                    <div class="text-text/70 text-sm">Toutes les statistiques correspondent parfaitement entre la base locale et la blockchain</div>
                  </div>
                </div>
              ` : `
                <div class="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/30 rounded">
                  <span class="text-red-400 text-2xl">❌</span>
                  <div>
                    <div class="text-red-400 font-semibold">INCOHÉRENCE DÉTECTÉE</div>
                    <div class="text-text/70 text-sm">Une ou plusieurs statistiques ne correspondent pas entre la base locale et la blockchain</div>
                  </div>
                </div>
              `}
            </div>
          </div>
        ` : `
          <div class="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
            <h3 class="text-red-400 font-bold mb-2">❌ Données Blockchain Indisponibles</h3>
            <p class="text-text/70 text-sm">Les données blockchain pour ce match ne sont pas disponibles ou n'ont pas pu être récupérées.</p>
          </div>
        `}
        
        <!-- Informations Techniques -->
        ${blockchainData && (blockchainData.verification_info || blockchainData.dataHash) ? `
          <div class="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 mb-6">
            <h3 class="text-purple-400 font-bold mb-3 flex items-center gap-2">
              <span class="text-xl">🔐</span> Preuve Cryptographique
            </h3>
            <div class="space-y-3 text-sm">
              <div>
                <span class="text-text/70 block mb-1">Hash de Données:</span>
                <code class="text-text bg-gray-800 px-2 py-1 rounded block break-all text-xs">
                  ${blockchainData.dataHash || response.blockchain_match_id || 'Non disponible'}
                </code>
              </div>
              ${blockchainData.verification_info ? `
                <div class="bg-gray-900 rounded p-3">
                  <div class="text-green-400 text-xs mb-2">
                    <strong>🔒 ${blockchainData.verification_info.data_integrity}</strong>
                  </div>
                  <div class="text-text/70 text-xs">
                    ${blockchainData.verification_info.explanation}
                  </div>
                  <div class="text-purple-400 text-xs mt-2">
                    <strong>Contenu du hash:</strong> ${blockchainData.verification_info.match_represents}
                  </div>
                </div>
              ` : `
                <div class="bg-gray-900 rounded p-3">
                  <div class="text-green-400 text-xs mb-2">
                    <strong>🔒 Hash cryptographique vérifié</strong>
                  </div>
                  <div class="text-text/70 text-xs">
                    Ce hash Keccak256 contient les statistiques du match stockées de manière immuable sur la blockchain Avalanche Fuji.
                  </div>
                  <div class="text-purple-400 text-xs mt-2">
                    <strong>Données incluses:</strong> Scores des joueurs, index du gagnant, round, timestamp du match
                  </div>
                </div>
              `}
            </div>
          </div>
        ` : ''}
        
        <!-- Actions -->
        <div class="flex gap-3 pt-4 border-t border-gray-700">
          <button onclick="viewRawMatchBlockchainData('${matchId}')" 
                  class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            📋 Données Brutes JSON
          </button>
          <button onclick="this.parentElement.parentElement.parentElement.remove()" 
                  class="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">
            Fermer
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  } catch (error) {
    console.error('Erreur blockchain match:', error);
    alert("Erreur lors de la récupération des informations blockchain du match");
  }
};

(window as any).viewRawMatchBlockchainData = async (matchId: string) => {
  try {
    const response = await api(`/tournaments/match/${matchId}/blockchain`);
    
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
      <div class="bg-prem rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <h2 class="text-2xl font-bold text-text mb-4">📋 Données Blockchain Brutes - Match</h2>
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
    alert("Erreur lors de la récupération des données brutes du match");
  }
};

(window as any).showTournamentStartError = () => {
  const currentParticipants = document.querySelectorAll('[data-participant-id]').length;
  const isPowerOfTwo = (n: number) => n > 0 && (n & (n - 1)) === 0;
  
  if (currentParticipants < 2) {
    alert(`Le tournoi a besoin d'au moins 2 joueurs pour commencer.\n\nActuellement: ${currentParticipants} joueur(s)\nManquant: ${2 - currentParticipants} joueur(s)`);
  } else if (!isPowerOfTwo(currentParticipants)) {
    const validCounts = [2, 4, 8].filter(n => n >= currentParticipants);
    const nextValid = validCounts[0] || 8;
    alert(`Les tournois d'élimination nécessitent exactement 2, 4 ou 8 joueurs.\n\nActuellement: ${currentParticipants} joueur(s)\nProchain nombre valide: ${nextValid} joueurs\n\nAjoutez ${nextValid - currentParticipants} joueur(s) ou supprimez-en pour atteindre 2 ou 4.`);
  }
};;