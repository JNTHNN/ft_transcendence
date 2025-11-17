import { t } from "../i18n/index.js";

export default async function View() {
  const wrap = document.createElement("div");
  wrap.className = "max-w-4xl mx-auto mt-8";

  wrap.innerHTML = `
    <h1 class="text-3xl font-bold text-text mb-6">${t('game.gameInProgress')}</h1>
    <div class="bg-prem rounded-lg shadow-xl p-6">
      <div class="grid grid-cols-2 gap-8 mb-8">
        <div class="text-center">
          <h2 class="text-2xl font-bold text-text mb-2">${t('common.player')} 1</h2>
          <div class="text-6xl font-bold text-sec">0</div>
        </div>
        <div class="text-center">
          <h2 class="text-2xl font-bold text-text mb-2">${t('common.player')} 2</h2>
          <div class="text-6xl font-bold text-sec">0</div>
        </div>
      </div>

      <div class="bg-sec rounded-lg p-4 h-96 flex items-center justify-center">
        <canvas id="gameCanvas" width="800" height="400" class="border border-sec rounded">
        </canvas>
      </div>

      <div class="mt-6 text-center">
        <p class="text-text/50">${t('game.instructions')}</p>
      </div>
    </div>
    <p class="mt-4 text-center">
      <a href="/" class="text-sec hover:underline">← ${t('common.back')}</a>
    </p>
  `;

  const canvas = wrap.querySelector("#gameCanvas") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "#16213e";
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 5]);
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();

    ctx.fillStyle = "#0f3460";
    ctx.fillRect(20, canvas.height / 2 - 50, 10, 100);
    ctx.fillRect(canvas.width - 30, canvas.height / 2 - 50, 10, 100);

    ctx.fillStyle = "#e94560";
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, 10, 0, Math.PI * 2);
    ctx.fill();
  }

  return wrap;
}
