import { api } from "../api-client";
import { t } from "../i18n/index.js";

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
  player1Score: number;
  player2Score: number;
  result: 'win' | 'loss';
  matchType: string;
  duration: number | null;
  created_at: string;
}

export async function createUserStatsModal(userId: number, userName: string): Promise<HTMLElement> {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4';
  modal.id = 'user-stats-modal';

  modal.innerHTML = `
    <div class="bg-prem rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
      <div class="p-6">
        <!-- En-tête -->
        <div class="flex items-center justify-between mb-6">
          <h2 class="font-display text-3xl font-bold text-text">${t('stats.title')} - ${userName}</h2>
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
      const response = await api('/users/match-history');
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
                    ${match.matchType} • ${new Date(match.created_at).toLocaleDateString()}
                    ${match.duration ? ` • ${Math.floor(match.duration / 60)}:${String(match.duration % 60).padStart(2, '0')}` : ''}
                  </p>
                </div>
              </div>
              <div class="text-right">
                <p class="font-bold text-text">${match.player1Score} - ${match.player2Score}</p>
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

(window as any).viewUserStats = async (userId: number, userName: string) => {
  const modal = await createUserStatsModal(userId, userName);
  document.body.appendChild(modal);
};