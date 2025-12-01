import { connectWS } from "../ws-client";
import { api } from "../api-client";

// 📦 TYPES (depuis ton backend)
interface GameState {
  matchId: string;
  ball: {
    position: { x: number; y: number };
    velocity: { x: number; y: number };
    radius: number;
  };
  paddles: {
    left: { y: number; height: number; speed: number };
    right: { y: number; height: number; speed: number };
  };
  score: {
    left: number;
    right: number;
  };
  timestamp: number;
}

// 🎮 CLASSE PRINCIPALE DU JEU
class PongGame {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private mode: string;
  private ws: WebSocket | null = null;
  private matchId: string = "";
  private gameState: GameState | null = null;
  private keys: { [key: string]: boolean } = {};
  private animationId: number | null = null;
  public allowNavigation: boolean = false;
  private scoreLeftDiv: HTMLDivElement;
  private scoreRightDiv: HTMLDivElement;
  private player1Id: string = "";
  private player2Id: string = "";

  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private keyupHandler: ((e: KeyboardEvent) => void) | null = null;
  private hashchangeHandler: (() => void) | null = null;
  // Constantes (depuis ton backend constants.ts)
  private readonly COURT_WIDTH = 800;
  private readonly COURT_HEIGHT = 600;
  private readonly PADDLE_WIDTH = 10;

  constructor(canvas: HTMLCanvasElement, mode: string, scoreLeftDiv: HTMLDivElement, scoreRightDiv: HTMLDivElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.mode = mode;
    this.scoreLeftDiv = scoreLeftDiv;
    this.scoreRightDiv = scoreRightDiv;

    // Configure le canvas
    this.canvas.width = this.COURT_WIDTH;
    this.canvas.height = this.COURT_HEIGHT;

	window.addEventListener('beforeunload', () => {
	// Fermer proprement le WebSocket pour déclencher le cleanup backend
	if (this.ws && this.ws.readyState === WebSocket.OPEN) {
    this.ws.close(1000, 'Page unload');
	} else {
  }
	
	// Ne pas afficher de message de confirmation
	// (la partie sera nettoyée automatiquement côté serveur)
	});
	window.addEventListener('hashchange', () => {
  this.destroy();
}, { once: true }); // ✅ Se déclenche UNE SEULE FOIS

// 🔧 INTERCEPTER aussi les clics sur la sidebar
document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  const link = target.closest('a[href^="/"]');
  if (link) {
    this.destroy();
  }
}, { once: true });
  }

  // 🔌 CONNEXION AU BACKEND
async connect() {
  try {
    // 🆕 Génère des IDs uniques
    const uniqueId = () => `player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const player1Id = uniqueId();
    const player2Id = uniqueId();
    
    // Stocke les IDs pour les utiliser plus tard
    this.player1Id = player1Id;
    this.player2Id = player2Id;
    
    let response;
    
    if (this.mode === "solo") {
      response = await api("/game/create", {
        method: "POST",
        body: JSON.stringify({ mode: "solo-vs-ai" })
      });
    } else if (this.mode === "local") {
      response = await api("/game/local/create", {
        method: "POST",
        body: JSON.stringify({
          player1Id: player1Id,    // 🔧 IDs uniques
          player2Id: player2Id     // 🔧 IDs uniques
        })
      });
    } else {
        // Mode online (à implémenter plus tard)
        return;
      }

      this.matchId = response.matchId;

      // 2️⃣ Connexion WebSocket
      this.ws = connectWS('/ws/game', (msg: any) => {
        this.handleServerMessage(msg);
      });

      this.ws.onopen = () => {
        // Rejoindre la partie
        this.ws?.send(JSON.stringify({
          type: "join",
          matchId: this.matchId,
          playerId: this.player1Id,
          side: "left"
        }));

		if (this.mode === "local") {
			setTimeout(() => {
			this.ws?.send(JSON.stringify({
				type: "join",
				matchId: this.matchId,
				playerId: this.player2Id,
				side: "right"
			}));
			}, 100);
		}
      };

      this.ws.onerror = (error) => {
      };

    } catch (error) {
    }
  }

  // 📨 GESTION DES MESSAGES DU SERVEUR
  private handleServerMessage(msg: any) {
    if (msg.type === "game/state") {
      this.gameState = msg.data;
      // Mettre à jour le score
      if (this.gameState) {
        this.scoreLeftDiv.textContent = this.gameState.score.left.toString();
        this.scoreRightDiv.textContent = this.gameState.score.right.toString();
      }
    } else if (msg.type === "game/end") {
      this.endGame(msg.data);
    }
  }

  // 🎨 DESSINER LE JEU
private render() {
  if (!this.gameState) return;

  const ctx = this.ctx;
  const w = this.canvas.width;
  const h = this.canvas.height;

  // 🟠 TERRE BATTUE (Roland-Garros style)
  ctx.fillStyle = "#C95A3F";  // Orange terre battue
  ctx.fillRect(0, 0, w, h);

  // ⚪ LIGNES BLANCHES DU TERRAIN
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 4;
  ctx.setLineDash([]);

  // Rectangle extérieur (limites du terrain - double)
  const marginX = 40;
  const marginY = 30;
  ctx.strokeRect(marginX, marginY, w - 2 * marginX, h - 2 * marginY);

  // Rectangle intérieur (terrain de simple)
  const innerMarginY = 80;
  ctx.strokeRect(marginX, innerMarginY, w - 2 * marginX, h - 2 * innerMarginY);

  // 🎾 LIGNE CENTRALE VERTICALE (le filet)
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(w / 2, marginY);
  ctx.lineTo(w / 2, h - marginY);
  ctx.stroke();

// 🎾 LIGNE VERTICALE GAUCHE (carré de service)
ctx.beginPath();
ctx.moveTo(w * 0.30, innerMarginY);        // Départ : haut (ligne intérieure)
ctx.lineTo(w * 0.30, h - innerMarginY);    // Arrivée : bas (ligne intérieure)
ctx.stroke();

// 🎾 LIGNE VERTICALE DROITE (carré de service)
ctx.beginPath();
ctx.moveTo(w * 0.70, innerMarginY);        // Départ : haut (ligne intérieure)
ctx.lineTo(w * 0.70, h - innerMarginY);    // Arrivée : bas (ligne intérieure)
ctx.stroke();

  // 🎾 PETIT CARRÉ CENTRAL (ligne médiane verticale - zone de service)
  ctx.lineWidth = 2;
  // Côté gauche
  ctx.beginPath();
  ctx.moveTo(w / 2, h / 2);
  ctx.lineTo(w * 0.30, h / 2);
  ctx.stroke();


  // Côté droit
  ctx.beginPath();
  ctx.moveTo(w / 2, h / 2);
  ctx.lineTo(w * 0.70, h / 2);
  ctx.stroke();


  // 🎾 FILET (au centre VERTICAL)
  ctx.fillStyle = "#2C2C2C";
  const netWidth = 6;
  ctx.fillRect(w / 2 - netWidth / 2, marginY, netWidth, h - 2 * marginY);

  // Poteaux du filet
  ctx.fillStyle = "#1A1A1A";
  ctx.fillRect(w / 2 - 12, marginY - 5, 24, 10);
  ctx.fillRect(w / 2 - 12, h - marginY - 5, 24, 10);

  // Maillage du filet (effet visuel)
  ctx.strokeStyle = "#555555";
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);
  for (let y = marginY; y < h - marginY; y += 20) {
    ctx.beginPath();
    ctx.moveTo(w / 2 - 10, y);
    ctx.lineTo(w / 2 + 10, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // 🏓 PADDLE GAUCHE (simple blanc)
  const leftPaddleY = this.gameState.paddles.left.y * this.COURT_HEIGHT;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(
    20,
    leftPaddleY - this.gameState.paddles.left.height / 2,
    this.PADDLE_WIDTH,
    this.gameState.paddles.left.height
  );

  // 🏓 PADDLE DROIT (simple blanc)
  const rightPaddleY = this.gameState.paddles.right.y * this.COURT_HEIGHT;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(
    this.COURT_WIDTH - 20 - this.PADDLE_WIDTH,
    rightPaddleY - this.gameState.paddles.right.height / 2,
    this.PADDLE_WIDTH,
    this.gameState.paddles.right.height
  );

  // 🎾 BALLE DE TENNIS (jaune fluo)
  ctx.fillStyle = "#CCFF00";
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(
    this.gameState.ball.position.x,
    this.gameState.ball.position.y,
    this.gameState.ball.radius,
    0,
    Math.PI * 2
  );
  ctx.fill();
  ctx.stroke();

  // Ligne courbe sur la balle (détail réaliste)
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(
    this.gameState.ball.position.x,
    this.gameState.ball.position.y,
    this.gameState.ball.radius * 0.7,
    Math.PI * 0.3,
    Math.PI * 1.7
  );
  ctx.stroke();
}

  // ⌨️ CAPTURER LES TOUCHES
private setupInput(): void {
  // 🆕 Créer et stocker les handlers
  this.keydownHandler = (e: KeyboardEvent) => {
    // Mode local : 2 joueurs (W/S et ↑/↓)
    if (this.mode === "local") {
      const localInput: any = {
        player1: { up: false, down: false },
        player2: { up: false, down: false }
      };

      // Joueur 1 (gauche) : W/S
      if (e.key.toLowerCase() === "w") localInput.player1.up = true;
      if (e.key.toLowerCase() === "s") localInput.player1.down = true;

      // Joueur 2 (droit) : ↑/↓
      if (e.key === "ArrowUp") localInput.player2.up = true;
      if (e.key === "ArrowDown") localInput.player2.down = true;

      // Envoyer les deux inputs
      if (Object.values(localInput.player1).some(Boolean) || Object.values(localInput.player2).some(Boolean)) {
        if (this.ws && this.matchId) {
          // Player 1 (gauche)
          this.ws.send(JSON.stringify({
            type: "input",
            matchId: this.matchId,
            playerId: this.player1Id,
            input: localInput.player1
          }));

          // Player 2 (droit)
          this.ws.send(JSON.stringify({
            type: "input",
            matchId: this.matchId,
            playerId: this.player2Id,
            input: localInput.player2
          }));
        }
      }
    } else {
      // Mode solo : un seul joueur
      const soloInput: any = { up: false, down: false };

      if (e.key === "ArrowUp") soloInput.up = true;
      if (e.key === "ArrowDown") soloInput.down = true;

      if (soloInput.up || soloInput.down) {
        if (this.ws && this.matchId) {
          this.ws.send(JSON.stringify({
            type: "input",
            matchId: this.matchId,
            playerId: this.player1Id,
            input: soloInput
          }));
        }
      }
    }
  };

  this.keyupHandler = (e: KeyboardEvent) => {
    // Mode local : 2 joueurs
    if (this.mode === "local") {
      const localInput: any = {
        player1: { up: false, down: false },
        player2: { up: false, down: false }
      };

      // Joueur 1 (gauche) : W/S
      if (e.key.toLowerCase() === "w") localInput.player1.up = false;
      if (e.key.toLowerCase() === "s") localInput.player1.down = false;

      // Joueur 2 (droit) : ↑/↓
      if (e.key === "ArrowUp") localInput.player2.up = false;
      if (e.key === "ArrowDown") localInput.player2.down = false;

      if (this.ws && this.matchId) {
        // Player 1 (gauche)
        this.ws.send(JSON.stringify({
          type: "input",
          matchId: this.matchId,
          playerId: this.player1Id,
          input: localInput.player1
        }));

        // Player 2 (droit)
        this.ws.send(JSON.stringify({
          type: "input",
          matchId: this.matchId,
          playerId: this.player2Id,
          input: localInput.player2
        }));
      }
    } else {
      // Mode solo : un seul joueur
      const soloInput: any = { up: false, down: false };

      if (e.key === "ArrowUp") soloInput.up = false;
      if (e.key === "ArrowDown") soloInput.down = false;

      if (this.ws && this.matchId) {
        this.ws.send(JSON.stringify({
          type: "input",
          matchId: this.matchId,
          playerId: this.player1Id,
          input: soloInput
        }));
      }
    }
  };

  // 🆕 Attacher les handlers
  document.addEventListener("keydown", this.keydownHandler);
  document.addEventListener("keyup", this.keyupHandler);
}

  // 📤 ENVOYER LES INPUTS AU SERVEUR
  private sendInput() {
    if (!this.ws || !this.matchId) {
		return;
	}

    // Mode local : 2 joueurs sur le même clavier

	if (this.mode === "local") {
		const player1Input = {
		up: this.keys["w"] || this.keys["W"] || false,
		down: this.keys["s"] || this.keys["S"] || false
		};
		
		const player2Input = {
		up: this.keys["ArrowUp"] || false,
		down: this.keys["ArrowDown"] || false
		};
		
		
		// Joueur 1 (gauche) = W/S
		this.ws.send(JSON.stringify({
		type: "input",
		matchId: this.matchId,
		playerId: this.player1Id,
		input: player1Input
		}));

    // Joueur 2 (droite) = Flèches
    this.ws.send(JSON.stringify({
      type: "input",
      matchId: this.matchId,
      playerId: this.player2Id,
      input: player2Input
      }));
    } else {
		const soloInput = {
      up: this.keys["w"] || this.keys["W"] || this.keys["ArrowUp"] || false,     // 🔧 W OU ↑
      down: this.keys["s"] || this.keys["S"] || this.keys["ArrowDown"] || false  // 🔧 S OU ↓
    };


      // Mode solo : un seul joueur
      this.ws.send(JSON.stringify({
        type: "input",
        matchId: this.matchId,
        playerId: this.player1Id,
        input: soloInput
      }));
    }
  }

  // 🔄 BOUCLE DE RENDU
  private gameLoop = () => {
    this.render();
    this.animationId = requestAnimationFrame(this.gameLoop);
  };

  // ▶️ DÉMARRER LE JEU
  start() {
    this.setupInput();
    this.gameLoop();
  }

  // ⏹️ TERMINER LE JEU
  private endGame(data: any) {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
		// 🆕 Affiche l'écran de fin
	const overlay = document.getElementById('game-over-overlay');
	const winnerText = document.getElementById('winner-text');
	const finalScore = document.getElementById('final-score');
	const gameControls = document.getElementById('game-controls');
	
	if (overlay && winnerText && finalScore && gameControls) {
		// Masquer les contrôles de jeu
		gameControls.classList.add('hidden');
		
		// Afficher l'overlay
		overlay.classList.remove('hidden');
		
		// Texte du gagnant
		const winner = data.winner === 'left' ? 'Joueur 1' : 
					this.mode === 'solo' ? 'IA' : 'Joueur 2';
		winnerText.textContent = `🏆 ${winner} gagne !`;
		
		// Score final
		finalScore.textContent = `${data.score.left} - ${data.score.right}`;
	}
  }


	// 🧹 NETTOYER
// 🧹 NETTOYER (VERSION COMPLÈTE)
public destroy(): void {
  
  // 1. Arrêter l'animation
  if (this.animationId) {
    cancelAnimationFrame(this.animationId);
    this.animationId = null;
  }
  
  // 2. ✅ NETTOYER les event listeners
  if (this.keydownHandler) {
    document.removeEventListener("keydown", this.keydownHandler);
    this.keydownHandler = null;
  }
  
  if (this.keyupHandler) {
    document.removeEventListener("keyup", this.keyupHandler);
    this.keyupHandler = null;
  }
  
  if (this.hashchangeHandler) {
    window.removeEventListener("hashchange", this.hashchangeHandler);
    this.hashchangeHandler = null;
  }
  
  // 3. Fermer le WebSocket
  if (this.ws) {
    if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
      this.ws.close(1000, 'Navigation');
    }
    this.ws.onopen = null;
    this.ws.onmessage = null;
    this.ws.onerror = null;
    this.ws.onclose = null;
    this.ws = null;
  }
  
  // 4. Vider le canvas
  if (this.ctx && this.canvas) {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
  
}

  async abandon() {
	if (!this.matchId) return;
	
	this.allowNavigation = true;
	
	try {
		// Appelle l'API pour supprimer la partie
		await api(`/game/${this.matchId}`, { method: 'DELETE' });
		
		// Nettoie et retourne au menu
		this.destroy();
		window.location.href = '/partie';
	} catch (error) {
	}
  }
}

// 🎬 FONCTION PRINCIPALE DE LA VUE
let currentGameInstance: PongGame | null = null;
export default async function View() {
	  // 🧹 CLEANUP automatique de l'ancienne instance
  if (currentGameInstance) {
    currentGameInstance.destroy();
    currentGameInstance = null;
  }

  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode") || "solo";

  const wrap = document.createElement("div");
  wrap.className = "max-w-4xl mx-auto mt-8";

		wrap.innerHTML = `
		<h1 class="text-3xl font-bold text-text mb-6">
			🎮 ${mode === "solo" ? "Solo vs IA" : mode === "local" ? "2 Joueurs Local" : "En ligne"}
		</h1>
		<div class="bg-prem rounded-lg shadow-xl p-6">
			<!-- Score -->
			<div class="grid grid-cols-2 gap-8 mb-4">
			<div class="text-center">
				<h2 class="text-xl font-bold text-text mb-2">Joueur 1</h2>
				<div id="score-left" class="text-5xl font-bold text-sec">0</div>
			</div>
			<div class="text-center">
				<h2 class="text-xl font-bold text-text mb-2">${mode === "local" ? "Joueur 2" : "IA"}</h2>
				<div id="score-right" class="text-5xl font-bold text-sec">0</div>
			</div>
			</div>

			<!-- Canvas -->
			<div class="flex justify-center relative">
			<canvas id="gameCanvas" class="border-2 border-sec rounded bg-black"></canvas>
			
			<!-- 🆕 Overlay de fin de partie (caché par défaut) -->
			<div id="game-over-overlay" class="hidden absolute inset-0 flex flex-col items-center justify-center bg-black/90 rounded">
				<div class="text-center">
				<h2 id="winner-text" class="text-5xl font-bold text-sec mb-4">🏆</h2>
				<p id="final-score" class="text-3xl text-text mb-8">5 - 3</p>
				<div class="flex gap-4">
					<button id="btn-replay" class="bg-sec hover:bg-sec/80 text-white px-8 py-3 rounded-lg font-bold text-xl">
					🔄 Rejouer
					</button>
					<button id="btn-quit" class="bg-gray-600 hover:bg-gray-700 text-white px-8 py-3 rounded-lg font-bold text-xl">
					🚪 Quitter
					</button>
				</div>
				</div>
			</div>
			</div>

			<!-- Instructions -->
			<div class="mt-4 text-center text-text/70 text-sm">
			${mode === "local" 
				? " W/S Joueur 1 | ↑/↓ Joueur 2" 
				: "↑/↓ Pour déplacer votre paddle"}
			</div>
			
			<!-- 🔧 Bouton abandon (seulement pendant la partie) -->
			<div id="game-controls" class="mt-4 text-center">
			<button id="btn-abandon" class="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded font-bold">
				🏳️ Abandonner
			</button>
			</div>
		</div>
		<p class="mt-4 text-center">
			<a href="/partie" class="text-sec hover:underline">← Retour</a>
		</p>
		`;

  const canvas = wrap.querySelector("#gameCanvas") as HTMLCanvasElement;
  const scoreLeft = wrap.querySelector("#score-left") as HTMLDivElement;
  const scoreRight = wrap.querySelector("#score-right") as HTMLDivElement;
  const btnAbandon = wrap.querySelector("#btn-abandon") as HTMLButtonElement;
  const btnReplay = wrap.querySelector("#btn-replay") as HTMLButtonElement;
  const btnQuit = wrap.querySelector("#btn-quit") as HTMLButtonElement;

  // Créer et démarrer le jeu
  currentGameInstance = new PongGame(canvas, mode, scoreLeft, scoreRight);
  await currentGameInstance.connect();
  currentGameInstance.start();

	// Bouton Abandon (pendant la partie)
	btnAbandon.addEventListener("click", () => {
	// Créer un modal personnalisé
	const modal = document.createElement('div');
	modal.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50';
	modal.innerHTML = `
		<div class="bg-prem rounded-xl shadow-2xl p-8 max-w-md mx-4 border-2 border-red-500">
		<!-- Icône -->
		<div class="flex justify-center mb-6">
			<div class="bg-red-500 bg-opacity-20 rounded-full p-4">
			<svg class="w-16 h-16 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
			</svg>
			</div>
		</div>
		
		<!-- Titre -->
		<h2 class="text-3xl font-bold text-text text-center mb-4">Abandonner la partie ?</h2>
		
		<!-- Message -->
		<p class="text-text/70 text-center mb-8">La partie sera comptée comme une défaite.</p>
		
		<!-- Boutons -->
		<div class="flex gap-4">
			<button id="modal-cancel" class="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-lg">
			✋ Continuer
			</button>
			<button id="modal-confirm" class="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg">
			🚪 Abandonner
			</button>
		</div>
		</div>
	`;
	
	document.body.appendChild(modal);
	
	// Annuler
	modal.querySelector('#modal-cancel')?.addEventListener('click', () => {
		modal.remove();
	});
	
	// Confirmer
	modal.querySelector('#modal-confirm')?.addEventListener('click', () => {
		modal.remove();
		currentGameInstance?.abandon();
	});
	
	// Fermer si clic en dehors
	modal.addEventListener('click', (e) => {
		if (e.target === modal) {
		modal.remove();
		}
	});
	});

	// 🆕 Bouton Rejouer (fin de partie)
	btnReplay.addEventListener("click", async () => {
	// ✅ Autoriser la navigation
	if (currentGameInstance) {
      currentGameInstance.allowNavigation = true;
    }
	
	try {
		// Créer une nouvelle partie
		const response = await api("/game/local/create", {
		method: "POST",
		body: JSON.stringify({})
		});
		
		if (response.matchId) {
		// Recharger la page avec le nouveau match
		window.location.href = `/match?mode=${mode}`;
		} else {
		window.location.reload();
		}
	} catch (error) {
		window.location.reload();
	}
	});

	// 🆕 Bouton Quitter (fin de partie)
	btnQuit.addEventListener("click", () => {
		if (currentGameInstance) {
		currentGameInstance.allowNavigation = true;
		currentGameInstance.destroy();
		}
		window.location.href = '/partie';
	});

  return wrap;
}