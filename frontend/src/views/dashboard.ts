import { authManager } from "../auth";
import { router } from "../router";
import { api } from "../api-client";
import { t } from "../i18n/index.js";

// Rendre le router disponible globalement pour les onclick
(window as any).router = router;

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

export default async function DashboardView() {
  if (!authManager.isAuthenticated()) {
    router.navigate("/login");
    return document.createElement("div");
  }

  const container = document.createElement("div");
  container.className = "max-w-7xl mx-auto p-6";

  // Header
  const header = document.createElement("div");
  header.className = "mb-8";
  header.innerHTML = `
    <h1 class="font-display text-4xl font-bold text-text mb-2">${t('dashboard.title')}</h1>
    <p class="text-text/70 text-lg">${t('dashboard.subtitle')}</p>
  `;

  // Main grid layout
  const mainGrid = document.createElement("div");
  mainGrid.className = "grid grid-cols-1 lg:grid-cols-3 gap-6";

  // Stats Overview (1/3 width)
  const statsOverview = document.createElement("div");
  statsOverview.className = "lg:col-span-1 space-y-6";
  
  // Performance Chart (2/3 width)
  const chartSection = document.createElement("div");
  chartSection.className = "lg:col-span-2 space-y-6";

  // Stats cards
  const statsCards = document.createElement("div");
  statsCards.className = "bg-prem rounded-lg p-6 shadow-xl";
  statsCards.innerHTML = `
      <h2 class="font-display text-2xl font-bold text-text mb-6">${t('dashboard.overview')}</h2>
    <div id="stats-cards" class="space-y-4">
      <div class="flex items-center justify-center py-8">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-sec"></div>
      </div>
    </div>
  `;

  // Performance chart
  const performanceChart = document.createElement("div");
  performanceChart.className = "bg-prem rounded-lg p-6 shadow-xl";
  performanceChart.innerHTML = `
    <h2 class="font-display text-2xl font-bold text-text mb-4">${t('dashboard.performanceTrends')}</h2>
    <div id="performance-chart" class="h-80">
      <div class="flex items-center justify-center h-full">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-sec"></div>
      </div>
    </div>
  `;

  // Win/Loss distribution
  const distributionChart = document.createElement("div");
  distributionChart.className = "bg-prem rounded-lg p-6 shadow-xl";
  distributionChart.innerHTML = `
    <h2 class="font-display text-2xl font-bold text-text mb-4">${t('dashboard.winLossDistribution')}</h2>
    <div id="distribution-chart" class="h-64">
      <div class="flex items-center justify-center h-full">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-sec"></div>
      </div>
    </div>
  `;

  // Recent activity
  const recentActivity = document.createElement("div");
  recentActivity.className = "bg-prem rounded-lg p-6 shadow-xl";
  recentActivity.innerHTML = `
    <h2 class="font-display text-2xl font-bold text-text mb-4">${t('dashboard.recentActivity')}</h2>
    <div id="recent-matches" class="space-y-3 max-h-96 overflow-y-auto">
      <div class="flex items-center justify-center py-8">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-sec"></div>
      </div>
    </div>
  `;

  // Game mode stats
  const gameModeStats = document.createElement("div");
  gameModeStats.className = "bg-prem rounded-lg p-6 shadow-xl";
  gameModeStats.innerHTML = `
    <h2 class="font-display text-2xl font-bold text-text mb-4">${t('dashboard.performanceByGameMode')}</h2>
    <div id="gamemode-stats">
      <div class="flex items-center justify-center py-8">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-sec"></div>
      </div>
    </div>
  `;

  // Assemble layout
  statsOverview.appendChild(statsCards);
  statsOverview.appendChild(recentActivity);
  
  chartSection.appendChild(performanceChart);
  chartSection.appendChild(distributionChart);

  mainGrid.appendChild(statsOverview);
  mainGrid.appendChild(chartSection);

  // Full width sections
  const fullWidthSection = document.createElement("div");
  fullWidthSection.className = "mt-6";
  fullWidthSection.appendChild(gameModeStats);

  container.appendChild(header);
  container.appendChild(mainGrid);
  container.appendChild(fullWidthSection);

  // Load data after DOM is ready
  setTimeout(() => {
    loadDashboardData();
  }, 100);

  return container;

  async function loadDashboardData() {
    try {
      // Load basic stats
      const statsResponse = await api('/users/me/stats');
      const stats: UserStats = statsResponse.stats;
      renderStatsCards(stats);

      // Load match history for charts
      const historyResponse = await api('/users/match-history');
      const matches: MatchHistoryItem[] = historyResponse.matches;
      
      renderPerformanceChart(matches);
      renderDistributionChart(stats);
      renderRecentActivity(matches.slice(0, 8));
      renderGameModeStats(matches);
      
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  }

  function renderStatsCards(stats: UserStats) {
    const container = document.getElementById('stats-cards');
    if (!container) return;

    const winRate = parseFloat(stats.winRate);
    const winRateColor = winRate >= 70 ? 'text-green-400' : winRate >= 50 ? 'text-yellow-400' : 'text-red-400';

    container.innerHTML = `
      <!-- Main Stats -->
      <div class="grid grid-cols-2 gap-4 mb-4">
        <div class="bg-sec/20 p-4 rounded-lg text-center">
          <div class="font-display text-3xl font-bold text-sec">${stats.totalGames}</div>
          <div class="text-sm text-text/70">${t('dashboard.gamesPlayed')}</div>
        </div>
        <div class="bg-sec/20 p-4 rounded-lg text-center">
          <div class="font-display text-3xl font-bold ${winRateColor}">${stats.winRate}%</div>
          <div class="text-sm text-text/70">${t('dashboard.winRate')}</div>
        </div>
      </div>
      
      <!-- Secondary Stats -->
      <div class="space-y-3">
        <div class="flex justify-between items-center p-3 bg-sec/10 rounded">
          <span class="text-text/70">${t('dashboard.victories')}</span>
          <span class="font-bold text-green-400">${stats.wins}</span>
        </div>
        <div class="flex justify-between items-center p-3 bg-sec/10 rounded">
          <span class="text-text/70">${t('dashboard.defeats')}</span>
          <span class="font-bold text-red-400">${stats.losses}</span>
        </div>
        <div class="flex justify-between items-center p-3 bg-sec/10 rounded">
          <span class="text-text/70">${t('dashboard.avgScore')}</span>
          <span class="font-bold text-purple-400">${stats.avgScore}</span>
        </div>
        <div class="flex justify-between items-center p-3 bg-sec/10 rounded">
          <span class=\"text-text/70\">${t('dashboard.bestScore')}</span>
          <span class=\"font-bold text-yellow-400\">${stats.bestScore}</span>
        </div>
      </div>
    `;
  }

  function renderPerformanceChart(matches: MatchHistoryItem[]) {
    const container = document.getElementById('performance-chart');
    if (!container) return;

    // Create a simple line chart using Canvas
    container.innerHTML = `<canvas id="perf-canvas" class="w-full h-full"></canvas>`;
    const canvas = document.getElementById('perf-canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    // Prepare data - last 10 matches performance
    const recentMatches = matches.slice(0, 10).reverse();
    const winRate = recentMatches.map((_, index) => {
      const slice = recentMatches.slice(0, index + 1);
      const wins = slice.filter(m => m.result === 'win').length;
      return (wins / slice.length) * 100;
    });

    if (recentMatches.length === 0) {
      container.innerHTML = `<div class="flex items-center justify-center h-full text-text/50">No matches to display</div>`;
      return;
    }

    // Draw chart
    const width = canvas.width;
    const height = canvas.height;
    const padding = 40;
    const chartWidth = width - 2 * padding;
    const chartHeight = height - 2 * padding;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    
    // Horizontal lines
    for (let i = 0; i <= 4; i++) {
      const y = padding + (chartHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }

    // Vertical lines
    const stepX = chartWidth / Math.max(winRate.length - 1, 1);
    for (let i = 0; i < winRate.length; i++) {
      const x = padding + stepX * i;
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, height - padding);
      ctx.stroke();
    }

    // Draw line
    ctx.strokeStyle = '#22d3ee'; // sec color
    ctx.lineWidth = 3;
    ctx.beginPath();

    winRate.forEach((rate, index) => {
      const x = padding + stepX * index;
      const y = height - padding - (rate / 100) * chartHeight;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw points
    ctx.fillStyle = '#22d3ee';
    winRate.forEach((rate, index) => {
      const x = padding + stepX * index;
      const y = height - padding - (rate / 100) * chartHeight;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw labels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    
    // Y-axis labels
    for (let i = 0; i <= 4; i++) {
      const y = padding + (chartHeight / 4) * i;
      const value = 100 - (i * 25);
      ctx.fillText(`${value}%`, padding - 20, y + 4);
    }

    // Title
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Win Rate Progression (Last 10 Games)', width / 2, 20);
  }

  function renderDistributionChart(stats: UserStats) {
    const container = document.getElementById('distribution-chart');
    if (!container) return;

    container.innerHTML = `<canvas id="dist-canvas" class="w-full h-full"></canvas>`;
    const canvas = document.getElementById('dist-canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) / 3;

    const wins = stats.wins;
    const losses = stats.losses;
    const total = wins + losses;

    if (total === 0) {
      container.innerHTML = `<div class="flex items-center justify-center h-full text-text/50">${t('dashboard.noMatchesYet')}</div>`;
      return;
    }

    const winAngle = (wins / total) * 2 * Math.PI;

    // Draw pie chart
    // Wins slice
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, -Math.PI / 2, -Math.PI / 2 + winAngle);
    ctx.closePath();
    ctx.fill();

    // Losses slice
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, -Math.PI / 2 + winAngle, -Math.PI / 2 + 2 * Math.PI);
    ctx.closePath();
    ctx.fill();

    // Labels
    ctx.fillStyle = 'white';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';

    // Win percentage
    const winPercent = ((wins / total) * 100).toFixed(1);
    ctx.fillText(`${wins} Wins`, centerX, centerY - 30);
    ctx.fillText(`(${winPercent}%)`, centerX, centerY - 10);

    // Loss percentage  
    const lossPercent = ((losses / total) * 100).toFixed(1);
    ctx.fillText(`${losses} Losses`, centerX, centerY + 15);
    ctx.fillText(`(${lossPercent}%)`, centerX, centerY + 35);
  }

  function renderRecentActivity(matches: MatchHistoryItem[]) {
    const container = document.getElementById('recent-matches');
    if (!container) return;

    if (matches.length === 0) {
      container.innerHTML = `
        <div class="text-center py-8 text-text/50">
          No recent matches
        </div>
      `;
      return;
    }

    container.innerHTML = matches.map(match => `
      <div class="flex items-center justify-between p-3 bg-sec/10 rounded-lg hover:bg-sec/20 transition-colors cursor-pointer" onclick="router.navigate('/game-session/${match.id}')">
        <div class="flex items-center space-x-3">
          <div class="w-3 h-3 rounded-full ${match.result === 'win' ? 'bg-green-500' : 'bg-red-500'}"></div>
          <div>
            <p class="font-semibold text-text text-sm">
              ${match.player1Name} vs ${match.player2Name}
            </p>
            <p class="text-xs text-text/60">
              ${new Date(match.created_at).toLocaleDateString()} • ${t('dashboard.clickForDetails')}
            </p>
          </div>
        </div>
        <div class="text-right">
          <p class="font-bold text-text text-sm">${match.player1_score}-${match.player2_score}</p>
          <p class="text-xs ${match.result === 'win' ? 'text-green-400' : 'text-red-400'}">
            ${match.result === 'win' ? t('dashboard.wins') : t('dashboard.losses')}
          </p>
        </div>
      </div>
    `).join('');
  }

  function renderGameModeStats(matches: MatchHistoryItem[]) {
    const container = document.getElementById('gamemode-stats');
    if (!container) return;

    // Group matches by type
    const modeStats: { [mode: string]: { wins: number; losses: number; total: number } } = {};
    
    matches.forEach(match => {
      const mode = match.match_type || 'unknown';
      if (!modeStats[mode]) {
        modeStats[mode] = { wins: 0, losses: 0, total: 0 };
      }
      
      modeStats[mode].total++;
      if (match.result === 'win') {
        modeStats[mode].wins++;
      } else {
        modeStats[mode].losses++;
      }
    });

    if (Object.keys(modeStats).length === 0) {
      container.innerHTML = `
        <div class="text-center py-8 text-text/50">
          No game mode data available
        </div>
      `;
      return;
    }

    container.innerHTML = Object.entries(modeStats).map(([mode, stats]) => {
      const winRate = ((stats.wins / stats.total) * 100).toFixed(1);
      const winRateColor = parseFloat(winRate) >= 50 ? 'text-green-400' : 'text-red-400';
      
      return `
        <div class="mb-4 p-4 bg-sec/10 rounded-lg">
          <div class="flex justify-between items-center mb-2">
            <h3 class="font-semibold text-text capitalize">${mode}</h3>
            <span class="font-bold ${winRateColor}">${winRate}% WR</span>
          </div>
          <div class="flex justify-between text-sm text-text/70 mb-2">
            <span>${stats.total} ${t('dashboard.games')}</span>
            <span>${stats.wins}W / ${stats.losses}L</span>
          </div>
          <div class="w-full bg-gray-700 rounded-full h-2">
            <div class="h-2 rounded-full bg-green-500" style="width: ${winRate}%"></div>
          </div>
        </div>
      `;
    }).join('');
  }
}