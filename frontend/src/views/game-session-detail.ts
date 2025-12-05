import { authManager } from "../auth";
import { router } from "../router";
import { api } from "../api-client";
import { t } from "../i18n/index.js";

interface MatchDetail {
  id: number;
  player1Name: string;
  player2Name: string;
  player1Avatar: string | null;
  player2Avatar: string | null;
  player1_score: number;
  player2_score: number;
  result: 'win' | 'loss' | 'draw';
  match_type: string;
  duration: number | null;
  created_at: string;
  winner_id: number | null;
  player1_id: number;
  player2_id: number;
  // Blockchain data si disponible
  blockchain_tx_hash?: string;
  blockchain_match_id?: string;
}

export async function GameSessionDetailView() {
  if (!authManager.isAuthenticated()) {
    router.navigate("/login");
    return document.createElement("div");
  }

  // Récupérer l'ID du match depuis l'URL
  const path = window.location.pathname;
  const matchId = path.split('/').pop();
  
  if (!matchId || isNaN(parseInt(matchId))) {
    router.navigate("/dashboard");
    return document.createElement("div");
  }

  const container = document.createElement("div");
  container.className = "max-w-4xl mx-auto p-6";

  // Header avec bouton retour
  const header = document.createElement("div");
  header.className = "mb-8 flex items-center space-x-4";
  header.innerHTML = `
    <button id="back-btn" class="p-2 bg-prem hover:bg-sec rounded-lg transition-colors">
      <svg class="w-6 h-6 text-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
      </svg>
    </button>
    <div>
      <h1 class="font-display text-4xl font-bold text-text">${t('matchDetails.title')}</h1>
      <p class="text-text/70 text-lg" id="match-subtitle">${t('matchDetails.loading')}</p>
    </div>
  `;

  // Loading state
  const loadingDiv = document.createElement("div");
  loadingDiv.className = "flex items-center justify-center py-16";
  loadingDiv.innerHTML = `
    <div class="text-center">
      <div class="animate-spin rounded-full h-16 w-16 border-b-2 border-sec mx-auto mb-4"></div>
      <p class="text-text/70">${t('matchDetails.loading')}</p>
    </div>
  `;

  // Content container
  const content = document.createElement("div");
  content.id = "match-content";
  content.appendChild(loadingDiv);

  container.appendChild(header);
  container.appendChild(content);

  // Event listeners
  const backBtn = header.querySelector('#back-btn');
  backBtn?.addEventListener('click', () => {
    router.navigate("/dashboard");
  });

  // Load match details
  setTimeout(() => loadMatchDetails(parseInt(matchId)), 100);

  return container;

  async function loadMatchDetails(matchId: number) {
    try {
      // Récupérer les détails du match via l'historique
      const historyResponse = await api('/users/match-history');
      const matches = historyResponse.matches;
      
      const match = matches.find((m: any) => m.id === matchId);
      
      if (!match) {
        showError(t('matchDetails.notFoundError'));
        return;
      }

      // Blockchain data temporairement désactivée (route non implémentée)
      let blockchainData = null;
      // TODO: Réactiver quand la route /tournaments/matches/:id/blockchain sera implémentée
      /*
      try {
        const blockchainResponse = await api(`/tournaments/matches/${matchId}/blockchain`);
        blockchainData = blockchainResponse;
      } catch (e) {
        // Blockchain data pas disponible, pas grave
      }
      */

      renderMatchDetails(match, blockchainData);
      
    } catch (error) {
      console.error('Failed to load match details:', error);
      showError(t('matchDetails.loadingError'));
    }
  }

  function showError(message: string) {
    const content = document.getElementById('match-content');
    if (!content) return;
    
    content.innerHTML = `
      <div class="text-center py-16">
        <div class="text-red-400 text-6xl mb-4">⚠️</div>
        <h2 class="text-2xl font-bold text-text mb-2">Error</h2>
        <p class="text-text/70">${message}</p>
        <button onclick="history.back()" class="mt-4 px-6 py-3 bg-sec hover:bg-sec/80 text-text rounded-lg transition-colors">
          Go Back
        </button>
      </div>
    `;
  }

  function renderMatchDetails(match: MatchDetail, blockchainData: any) {
    const content = document.getElementById('match-content');
    if (!content) return;

    // Update subtitle
    const subtitle = document.getElementById('match-subtitle');
    if (subtitle) {
      subtitle.textContent = `${match.player1Name} vs ${match.player2Name} • ${new Date(match.created_at).toLocaleDateString()}`;
    }

    const apiBaseUrl = (import.meta as any).env?.VITE_API_BASE_URL || "https://api.localhost:8443";
    const player1AvatarUrl = match.player1Avatar && match.player1Avatar.startsWith('/uploads/') ? 
      `${apiBaseUrl}${match.player1Avatar}` : match.player1Avatar;
    const player2AvatarUrl = match.player2Avatar && match.player2Avatar.startsWith('/uploads/') ? 
      `${apiBaseUrl}${match.player2Avatar}` : match.player2Avatar;

    const currentUserId = authManager.getState().user?.id;
    const currentUser = authManager.getState().user;
    
    // Utiliser les IDs s'ils sont disponibles, sinon utiliser le nom du joueur
    let isPlayer1: boolean;
    if (match.player1_id !== undefined && match.player2_id !== undefined) {
      isPlayer1 = currentUserId === match.player1_id;
    } else {
      // Fallback: utiliser le nom d'affichage pour identifier le joueur
      isPlayer1 = currentUser?.displayName === match.player1Name;
    }
    
    const myScore = isPlayer1 ? match.player1_score : match.player2_score;
    const opponentScore = isPlayer1 ? match.player2_score : match.player1_score;

    content.innerHTML = `
      <!-- Match Overview -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        
        <!-- Match Result Card -->
        <div class="bg-prem rounded-lg p-8 shadow-xl">
          <div class="text-center">
            <div class="text-6xl mb-4">
              ${match.result === 'win' ? '🏆' : match.result === 'loss' ? '😔' : '🤝'}
            </div>
            <h2 class="font-display text-3xl font-bold mb-2 ${
              match.result === 'win' ? 'text-green-400' : 
              match.result === 'loss' ? 'text-red-400' : 'text-yellow-400'
            }">
              ${match.result === 'win' ? t('matchDetails.victory') : 
                match.result === 'loss' ? t('matchDetails.defeat') : 
                t('matchDetails.draw')}
            </h2>
            <div class="text-6xl font-bold text-text mb-4">
              ${myScore} - ${opponentScore}
            </div>
            <p class="text-text/70">
              ${t('matchDetails.yourScoreVsOpponent')}
            </p>
          </div>
        </div>

        <!-- Match Info Card -->
        <div class="bg-prem rounded-lg p-8 shadow-xl">
          <h3 class="font-display text-2xl font-bold text-text mb-6">${t('matchDetails.matchInformation')}</h3>
          <div class="space-y-4">
            <div class="flex justify-between">
              <span class="text-text/70">${t('matchDetails.gameMode')}</span>
              <span class="font-semibold text-text capitalize">${match.match_type}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-text/70">${t('matchDetails.date')}</span>
              <span class="font-semibold text-text">${new Date(match.created_at).toLocaleDateString()}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-text/70">${t('matchDetails.time')}</span>
              <span class="font-semibold text-text">${new Date(match.created_at).toLocaleTimeString()}</span>
            </div>
            ${match.duration ? `
              <div class="flex justify-between">
                <span class="text-text/70">${t('matchDetails.duration')}</span>
                <span class="font-semibold text-text">${formatDuration(match.duration)}</span>
              </div>
            ` : ''}
            <div class="flex justify-between">
              <span class="text-text/70">${t('matchDetails.matchId')}</span>
              <span class="font-semibold text-text font-mono">#${match.id}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Players Comparison -->
      <div class="bg-prem rounded-lg p-8 shadow-xl mb-8">
        <h3 class="font-display text-2xl font-bold text-text mb-6">${t('matchDetails.playersComparison')}</h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          
          <!-- Player 1 -->
          <div class="text-center">
            <div class="mb-4">
              ${player1AvatarUrl ? `
                <img src="${player1AvatarUrl}" alt="${match.player1Name}" class="w-20 h-20 rounded-full mx-auto object-cover" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <div class="w-20 h-20 bg-sec rounded-full flex items-center justify-center mx-auto" style="display:none;">
                  <span class="text-2xl font-bold text-text">${match.player1Name.charAt(0).toUpperCase()}</span>
                </div>
              ` : `
                <div class="w-20 h-20 bg-sec rounded-full flex items-center justify-center mx-auto">
                  <span class="text-2xl font-bold text-text">${match.player1Name.charAt(0).toUpperCase()}</span>
                </div>
              `}
            </div>
            <h4 class="font-bold text-text text-xl mb-2">${match.player1Name}</h4>
            <div class="text-4xl font-bold ${match.winner_id === match.player1_id ? 'text-green-400' : 'text-text'} mb-2">
              ${match.player1_score}
            </div>
            ${match.winner_id === match.player1_id ? `<div class="text-green-400 text-sm font-semibold">${t('matchDetails.winner')}</div>` : ''}
          </div>

          <!-- VS -->
          <div class="text-center">
            <div class="text-4xl font-bold text-text/50 mb-2">VS</div>
            <div class="text-sm text-text/70">${t('matchDetails.finalScore')}</div>
          </div>

          <!-- Player 2 -->
          <div class="text-center">
            <div class="mb-4">
              ${player2AvatarUrl ? `
                <img src="${player2AvatarUrl}" alt="${match.player2Name}" class="w-20 h-20 rounded-full mx-auto object-cover" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <div class="w-20 h-20 bg-sec rounded-full flex items-center justify-center mx-auto" style="display:none;">
                  <span class="text-2xl font-bold text-text">${match.player2Name.charAt(0).toUpperCase()}</span>
                </div>
              ` : `
                <div class="w-20 h-20 bg-sec rounded-full flex items-center justify-center mx-auto">
                  <span class="text-2xl font-bold text-text">${match.player2Name.charAt(0).toUpperCase()}</span>
                </div>
              `}
            </div>
            <h4 class="font-bold text-text text-xl mb-2">${match.player2Name}</h4>
            <div class="text-4xl font-bold ${match.winner_id === match.player2_id ? 'text-green-400' : 'text-text'} mb-2">
              ${match.player2_score}
            </div>
            ${match.winner_id === match.player2_id ? `<div class="text-green-400 text-sm font-semibold">${t('matchDetails.winner')}</div>` : ''}
          </div>
        </div>
      </div>

      <!-- Performance Analysis -->
      <div class="bg-prem rounded-lg p-8 shadow-xl mb-8">
        <h3 class="font-display text-2xl font-bold text-text mb-6">${t('matchDetails.performanceAnalysis')}</h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="text-center p-4 bg-sec/20 rounded-lg">
            <div class="text-2xl font-bold text-text">${Math.abs(myScore - opponentScore)}</div>
            <div class="text-sm text-text/70">${t('matchDetails.scoreDifference')}</div>
          </div>
          <div class="text-center p-4 bg-sec/20 rounded-lg">
            <div class="text-2xl font-bold text-text">${myScore + opponentScore}</div>
            <div class="text-sm text-text/70">${t('matchDetails.totalPoints')}</div>
          </div>
          <div class="text-center p-4 bg-sec/20 rounded-lg">
            <div class="text-2xl font-bold ${myScore > opponentScore ? 'text-green-400' : 'text-red-400'}">
              ${myScore > opponentScore ? '+' : ''}${myScore - opponentScore}
            </div>
            <div class="text-sm text-text/70">${t('matchDetails.scoreMargin')}</div>
          </div>
          <div class="text-center p-4 bg-sec/20 rounded-lg">
            <div class="text-2xl font-bold text-purple-400">
              ${Math.max(myScore, opponentScore) === 0 ? '0' : ((Math.min(myScore, opponentScore) / Math.max(myScore, opponentScore)) * 100).toFixed(0)}%
            </div>
            <div class="text-sm text-text/70">${t('matchDetails.matchBalance')}</div>
          </div>
        </div>
      </div>

      ${blockchainData && blockchainData.is_stored ? `
        <!-- Blockchain Verification -->
        <div class="bg-prem rounded-lg p-8 shadow-xl">
          <h3 class="font-display text-2xl font-bold text-text mb-6">
            🔗 Blockchain Verification
          </h3>
          <div class="bg-green-500/20 border border-green-500/30 rounded-lg p-4 mb-4">
            <div class="flex items-center space-x-2 mb-2">
              <span class="text-green-400">✅</span>
              <span class="font-semibold text-green-400">Verified on Blockchain</span>
            </div>
            <p class="text-sm text-text/70">This match result has been permanently stored on the Avalanche blockchain for integrity and verification.</p>
          </div>
          
          <div class="space-y-3">
            <div class="flex justify-between items-center">
              <span class="text-text/70">Transaction Hash</span>
              <a href="${blockchainData.explorer_url}" target="_blank" class="font-mono text-sm text-blue-400 hover:text-blue-300 break-all">
                ${blockchainData.tx_hash ? `${blockchainData.tx_hash.substring(0, 20)}...` : 'N/A'}
              </a>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-text/70">Network</span>
              <span class="text-text font-semibold">Avalanche Fuji Testnet</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-text/70">Stored Data</span>
              <span class="text-text font-semibold">Match Result + Player Names</span>
            </div>
          </div>
        </div>
      ` : ''}
    `;
  }

  function formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${remainingSeconds}s`;
  }
}