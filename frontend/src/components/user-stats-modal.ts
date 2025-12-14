import { api } from "../api-client";
import { t } from "../i18n/index.js";

function getLocalTime(dateString: string): string {
  let dateStr = dateString;
  if (!dateStr.endsWith('Z') && !dateStr.includes('+')) {
    dateStr = dateStr.replace(' ', 'T') + 'Z';
  }
  const date = new Date(dateStr);
  const fullDate = date.toLocaleDateString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  const parts = fullDate.split(/[,\s]+/);
  return parts[parts.length - 1];
}

function getLocalDate(dateString: string): string {
  let dateStr = dateString;
  if (!dateStr.endsWith('Z') && !dateStr.includes('+')) {
    dateStr = dateStr.replace(' ', 'T') + 'Z';
  }
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

interface UserStats {
  totalGames: number;
  wins: number;
  losses: number;
  winRate: string;
  avgScore: string;
  bestScore: number;
}

interface MatchHistoryItem {
  id: number;
  player1Name: string;
  player2Name: string;
  player1_score: number;
  player2_score: number;
  result: 'win' | 'loss';
  match_type: string;
  duration: number | null;
  created_at: string;
}

export async function createUserStatsModal(userId: number, userName: string, avatarUrl?: string): Promise<HTMLElement> {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4';
  modal.id = 'user-stats-modal';

  const apiBaseUrl = (import.meta as any).env?.VITE_API_BASE_URL || "https://api.localhost:8443";
  if (avatarUrl && avatarUrl.startsWith('/uploads/')) {
    avatarUrl = `${apiBaseUrl}${avatarUrl}`;
  }

  const avatarHtml = avatarUrl 
    ? `<img src="${avatarUrl}" alt="${userName}" class="w-16 h-16 rounded-full object-cover ring-2 ring-sec/50" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
       <div class="w-16 h-16 bg-gradient-to-br from-sec to-sec/60 rounded-full flex items-center justify-center ring-2 ring-sec/50" style="display:none">
         <span class="text-white text-2xl font-bold">${userName.charAt(0).toUpperCase()}</span>
       </div>`
    : `<div class="w-16 h-16 bg-gradient-to-br from-sec to-sec/60 rounded-full flex items-center justify-center ring-2 ring-sec/50">
         <span class="text-white text-2xl font-bold">${userName.charAt(0).toUpperCase()}</span>
       </div>`;

  modal.innerHTML = `
    <div class="bg-prem rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
      <div class="p-6">
        <!-- En-tête -->
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-4 min-w-0 flex-1">
            ${avatarHtml}
            <h2 class="font-display text-3xl font-bold text-text truncate">${t('stats.title')} - ${userName}</h2>
          </div>
          <button id="close-stats-modal" class="text-text/70 hover:text-text">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        <!-- Statistiques -->
        <div id="stats-content">
          <div class="flex items-center justify-center py-8">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-sec"></div>
          </div>
        </div>

        <!-- Historique des matchs -->
        <div class="mt-8">
          <h3 class="font-display text-2xl font-bold text-text mb-4">${t('stats.matchHistory')}</h3>
          <div id="match-history-content">
            <div class="flex items-center justify-center py-8">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-sec"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const closeBtn = modal.querySelector('#close-stats-modal') as HTMLButtonElement;
  const statsContent = modal.querySelector('#stats-content') as HTMLDivElement;
  const matchHistoryContent = modal.querySelector('#match-history-content') as HTMLDivElement;

  closeBtn.addEventListener('click', () => {
    modal.remove();
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });

  async function loadStats() {
    try {
      const response = await api(`/users/${userId}/stats`);
      const stats: UserStats = response.stats;

      statsContent.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div class="bg-gray-700 p-4 rounded-lg text-center">
            <div class="font-display text-3xl font-bold text-sec">${stats.totalGames}</div>
            <div class="font-sans text-gray-400">${t('stats.gamesPlayed')}</div>
          </div>
          <div class="bg-gray-700 p-4 rounded-lg text-center">
            <div class="font-display text-3xl font-bold text-green-400">${stats.wins}</div>
            <div class="font-sans text-gray-400">${t('stats.victories')}</div>
          </div>
          <div class="bg-gray-700 p-4 rounded-lg text-center">
            <div class="font-display text-3xl font-bold text-red-400">${stats.losses}</div>
            <div class="font-sans text-gray-400">${t('stats.defeats')}</div>
          </div>
          <div class="bg-gray-700 p-4 rounded-lg text-center">
            <div class="font-display text-3xl font-bold text-blue-400">${stats.winRate}%</div>
            <div class="font-sans text-gray-400">${t('stats.winRate')}</div>
          </div>
          <div class="bg-gray-700 p-4 rounded-lg text-center">
            <div class="font-display text-3xl font-bold text-purple-400">${stats.avgScore}</div>
            <div class="font-sans text-gray-400">${t('stats.avgScore')}</div>
          </div>
          <div class="bg-gray-700 p-4 rounded-lg text-center">
            <div class="font-display text-3xl font-bold text-yellow-400">${stats.bestScore}</div>
            <div class="font-sans text-gray-400">${t('stats.bestScore')}</div>
          </div>
        </div>
      `;
    } catch (error) {
      statsContent.innerHTML = `
        <div class="text-center py-8">
          <p class="text-red-400">${t('stats.loadError')}</p>
        </div>
      `;
    }
  }

  async function loadMatchHistory() {
    try {
      const endpoint = userId ? `/users/${userId}/match-history` : '/users/match-history';
      const response = await api(endpoint);
      const matches: MatchHistoryItem[] = response.matches;

      if (matches.length === 0) {
        matchHistoryContent.innerHTML = `
          <div class="text-center py-8">
            <p class="text-gray-400">${t('stats.noMatches')}</p>
          </div>
        `;
        return;
      }

      matchHistoryContent.innerHTML = `
        <div class="space-y-2 max-h-96 overflow-y-auto">
          ${matches.map(match => `
            <div class="flex items-center justify-between p-3 bg-sec bg-opacity-20 rounded-lg">
              <div class="flex items-center space-x-3">
                <div class="w-3 h-3 rounded-full ${match.result === 'win' ? 'bg-green-500' : 'bg-red-500'}"></div>
                <div>
                  <p class="font-semibold text-text">
                    ${match.player1Name} vs ${match.player2Name}
                  </p>
                  <p class="text-sm text-gray-400">
                    ${match.match_type === 'solo' ? 'Tournament' : match.match_type} • ${getLocalDate(match.created_at)} • ${getLocalTime(match.created_at)}
                  </p>
                </div>
              </div>
              <div class="text-right">
                <p class="font-bold text-text">${match.player1_score} - ${match.player2_score}</p>
                <p class="text-sm ${match.result === 'win' ? 'text-green-400' : 'text-red-400'}">
                  ${match.result === 'win' ? t('stats.victory') : t('stats.defeat')}
                </p>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } catch (error) {
      matchHistoryContent.innerHTML = `
        <div class="text-center py-8">
          <p class="text-red-400">${t('stats.historyLoadError')}</p>
        </div>
      `;
    }
  }

  loadStats();
  loadMatchHistory();

  return modal;
}

(window as any).viewUserStats = async (userId: number, userName: string, avatarUrl?: string) => {
  const modal = await createUserStatsModal(userId, userName, avatarUrl);
  document.body.appendChild(modal);
};