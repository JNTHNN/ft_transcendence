import { connectWS } from "../ws-client";
import { api } from "../api-client";
import { t } from "../i18n/index.js";

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
  players?: {
    left?: { id: string; name: string; type: 'human' | 'ai' };
    right?: { id: string; name: string; type: 'human' | 'ai' };
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
  private gameEnded: boolean = false;
  private playerNameElements: NodeListOf<HTMLElement> | null = null;
  
  // 🆕 Références aux callbacks pour pouvoir les nettoyer
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private keyupHandler: ((e: KeyboardEvent) => void) | null = null;
  private beforeUnloadHandler: (() => void) | null = null;
  
  // Constantes (depuis ton backend constants.ts)
  private readonly COURT_WIDTH = 800;
  private readonly COURT_HEIGHT = 600;
  private readonly PADDLE_WIDTH = 10;
  
  // 🆕 État de prêt des joueurs
  private player1Ready: boolean = false;
  private player2Ready: boolean = false;
  private gameStarted: boolean = false;

  constructor(canvas: HTMLCanvasElement, mode: string, scoreLeftDiv: HTMLDivElement, scoreRightDiv: HTMLDivElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.mode = mode;
    this.scoreLeftDiv = scoreLeftDiv;
    this.scoreRightDiv = scoreRightDiv;

    // Configure le canvas
    this.canvas.width = this.COURT_WIDTH;
    this.canvas.height = this.COURT_HEIGHT;

    // 🧹 Créer et stocker le handler beforeunload
    this.beforeUnloadHandler = () => {
      // Fermer proprement le WebSocket pour déclencher le cleanup backend
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.close();
      }
    };
    
    window.addEventListener('beforeunload', this.beforeUnloadHandler);
    
  }

  // 🆕 Définir les références aux éléments des noms des joueurs
  public setPlayerNameElements(player1Element: HTMLElement, player2Element: HTMLElement): void {
    this.playerNameElements = [player1Element, player2Element] as any;
  }

  // 🆕 Mettre à jour les noms des joueurs (seulement en mode tournoi)
  private updatePlayerNames(): void {
    if (!this.playerNameElements || !this.gameState?.players) return;
    
    // Ne mettre à jour les noms que en mode tournoi
    if (this.mode !== "tournament") return;
    
    if (this.gameState.players.left && this.playerNameElements[0]) {
      this.playerNameElements[0].textContent = this.gameState.players.left.name;
    }
    
    if (this.gameState.players.right && this.playerNameElements[1]) {
      this.playerNameElements[1].textContent = this.gameState.players.right.name;
    }
  }

  // 🆕 Marquer un joueur comme prêt
  public setPlayerReady(player: 1 | 2): void {
    if (player === 1) {
      this.player1Ready = true;
      console.log("✅ Joueur 1 prêt!");
    } else {
      this.player2Ready = true;
      console.log("✅ Joueur 2 prêt!");
    }
    
    // Démarrer si les conditions sont remplies
    this.checkStartGame();
  }
  
  // 🆕 Vérifier si on peut démarrer
  private checkStartGame(): void {
    if (this.gameStarted) return;
    
    const canStart = (this.mode === "local" || this.mode === "tournament") 
      ? (this.player1Ready && this.player2Ready)
      : this.player1Ready;
    
    if (canStart && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.gameStarted = true;
      console.log("🚀 Démarrage du jeu!");
      
      // Envoyer le signal de démarrage au serveur
      this.ws.send(JSON.stringify({
        type: "start",
        matchId: this.matchId
      }));
      
      // Masquer l'overlay de démarrage
      const startOverlay = document.getElementById('start-overlay');
      if (startOverlay) {
        startOverlay.classList.add('hidden');
      }
      
      // Démarrer les contrôles
      this.startGame();
    }
  }

  // 🔌 CONNEXION AU BACKEND
async connect() {
  try {
    let player1Id, player2Id;
    
    if (this.mode === "tournament") {
      // Mode tournoi : récupérer les IDs depuis l'URL (format user-X)
      const params = new URLSearchParams(window.location.search);
      const rawPlayer1Id = params.get("player1");
      const rawPlayer2Id = params.get("player2");
      
      if (!rawPlayer1Id || !rawPlayer2Id) {
        throw new Error("IDs des joueurs manquants pour le match de tournoi");
      }
      
      // S'assurer que les IDs sont au format user-X pour la base de données
      player1Id = rawPlayer1Id.startsWith('user-') ? rawPlayer1Id : `user-${rawPlayer1Id}`;
      player2Id = rawPlayer2Id.startsWith('user-') ? rawPlayer2Id : `user-${rawPlayer2Id}`;
    } else {
      // Modes local/solo : génèrer des IDs uniques
      const uniqueId = () => `player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      player1Id = uniqueId();
      player2Id = uniqueId();
    }
    
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
    } else if (this.mode === "tournament") {
      // Mode tournoi - créer un match local 2 joueurs sur le même PC
      response = await api("/game/local/create", {
        method: "POST",
        body: JSON.stringify({
          player1Id: player1Id,
          player2Id: player2Id,
          mode: "tournament"
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

		if (this.mode === "local" || this.mode === "tournament") {
			setTimeout(() => {
			this.ws?.send(JSON.stringify({
				type: "join",
				matchId: this.matchId,
				playerId: this.player2Id,
				side: "right"
			}));
			
			// Demander l'état initial après que les deux joueurs soient connectés
			setTimeout(() => {
				this.ws?.send(JSON.stringify({
					type: "getState",
					matchId: this.matchId
				}));
			}, 200);
			}, 100);
		}
      };

      this.ws.onerror = () => {
      };

    } catch (error) {
    }
  }

  // 📨 GESTION DES MESSAGES DU SERVEUR
  private handleServerMessage(msg: any) {
    if (msg.type === "game/state") {
      this.gameState = msg.data;
      // Mettre à jour le score et les noms
      if (this.gameState) {
        this.scoreLeftDiv.textContent = this.gameState.score.left.toString();
        this.scoreRightDiv.textContent = this.gameState.score.right.toString();
        this.updatePlayerNames();
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
    Math.PI * 0.2,
    Math.PI * 0.8
  );
  ctx.stroke();
}

  // ⌨️ GESTION DES INPUTS CLAVIER
  private setupInput() {
    // 🧹 Créer et stocker les handlers
    this.keydownHandler = (e: KeyboardEvent) => {
      this.keys[e.key] = true;
    };
    
    this.keyupHandler = (e: KeyboardEvent) => {
      this.keys[e.key] = false;
    };

    // Ajouter les listeners
    window.addEventListener("keydown", this.keydownHandler);
    window.addEventListener("keyup", this.keyupHandler);

    // Envoyer les inputs au serveur à 60 FPS
    setInterval(() => {
      this.sendInputs();
    }, 1000 / 60);
  }

  private sendInputs() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    if (this.mode === "local" || this.mode === "tournament") {
      // Joueur 1 (gauche) = W/S
      const player1Input = {
        up: this.keys["w"] || this.keys["W"] || false,
        down: this.keys["s"] || this.keys["S"] || false
      };

      // Joueur 2 (droite) = Flèches
      const player2Input = {
        up: this.keys["ArrowUp"] || false,
        down: this.keys["ArrowDown"] || false
      };

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
    // Commence le rendu visuel seulement (sans inputs)
    this.gameLoop();
    console.log("🎨 Rendu visuel démarré!");
  }
  
  // 🚀 DÉMARRER LA PARTIE (appelé quand les joueurs sont prêts)
  startGame() {
    if (!this.gameStarted) return;
    this.setupInput();
    console.log("🚀 Jeu et contrôles démarrés !");
  }

  // ⏹️ TERMINER LE JEU
  private async endGame(data: any) {
    // Éviter les appels multiples
    if (this.gameEnded) {
      console.log('Game already ended, ignoring duplicate call');
      return;
    }
    this.gameEnded = true;
    
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
		let winner: string;
		if (this.mode === 'tournament' && this.playerNameElements) {
			// En mode tournoi, récupérer les noms depuis les éléments HTML qui les affichent
			const leftPlayerName = this.playerNameElements[0]?.textContent || t('game.player1');
			const rightPlayerName = this.playerNameElements[1]?.textContent || t('game.player2');
			
			winner = data.winner === 'left' ? leftPlayerName : rightPlayerName;
		} else {
			// Pour les autres modes, utiliser les traductions génériques
			winner = data.winner === 'left' ? t('game.player1') : 
						this.mode === 'solo' ? t('game.ai') : t('game.player2');
		}
		winnerText.textContent = `🏆 ${winner} ${t('game.wins')}`;
		
		// Score final
		finalScore.textContent = `${data.score.left} - ${data.score.right}`;

		// 🏆 Si c'est un match de tournoi, envoyer les résultats
		if (this.mode === 'tournament') {
			await this.submitTournamentResult(data);
		}
	}
  }

  private async submitTournamentResult(data: any) {
    try {
      const params = new URLSearchParams(window.location.search);
      const tournamentId = params.get("tournamentId");
      
      console.log('Current URL:', window.location.href);
      console.log('Tournament ID from URL:', tournamentId);
      console.log('Match data:', data);
      
      if (!tournamentId) {
        console.error('Tournament ID not found');
        return;
      }

      // Récupérer le matchId depuis l'URL
      const urlParams = new URLSearchParams(window.location.search);
      const matchId = urlParams.get("matchId");

      // Extraire les IDs numériques pour correspondre à la base de données
      const leftPlayerId = this.player1Id.startsWith('user-') ? this.player1Id.substring(5) : this.player1Id;
      const rightPlayerId = this.player2Id.startsWith('user-') ? this.player2Id.substring(5) : this.player2Id;

      console.log(`🎯 Submitting tournament result:
        - Winner: ${data.winner} 
        - Score: ${data.score.left}-${data.score.right}
        - Player1ID (left): ${this.player1Id} → ${leftPlayerId}
        - Player2ID (right): ${this.player2Id} → ${rightPlayerId}
        - URL player1: ${params.get("player1")}
        - URL player2: ${params.get("player2")}`);

      const response = await api(`/tournaments/${tournamentId}/match-result`, {
        method: "POST",
        body: JSON.stringify({
          winner: data.winner,
          score: data.score,
          players: {
            left: leftPlayerId,
            right: rightPlayerId
          },
          matchId: matchId
        })
      });

      if (response.tournamentComplete) {
        // Afficher un message spécial pour la fin du tournoi
        const winnerText = document.getElementById('winner-text');
        if (winnerText) {
          winnerText.innerHTML = `
            🏆 ${winnerText.textContent}<br>
            <span class="text-lg text-green-400">🎉 Tournoi terminé !</span><br>
            <span class="text-sm text-text/70">⛓️ Résultat sauvegardé sur blockchain</span>
          `;
        }
      }

      console.log('Tournament result submitted successfully', response);
    } catch (error) {
      console.error('Error submitting tournament result:', error);
      // Afficher une notification d'erreur mais ne pas empêcher la fin du jeu
      const winnerText = document.getElementById('winner-text');
      if (winnerText) {
        winnerText.innerHTML = winnerText.innerHTML + '<br><span class="text-sm text-red-400">⚠️ Erreur sauvegarde blockchain</span>';
      }
    }
  }


  // 🧹 NETTOYER (MÉTHODE AMÉLIORÉE)
  destroy() {
    
    // 1️⃣ Stopper l'animation
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    
    // 2️⃣ Fermer le WebSocket
    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }
    
    // 3️⃣ Nettoyer les event listeners clavier
    if (this.keydownHandler) {
      window.removeEventListener("keydown", this.keydownHandler);
      this.keydownHandler = null;
    }
    
    if (this.keyupHandler) {
      window.removeEventListener("keyup", this.keyupHandler);
      this.keyupHandler = null;
    }
    
    // 4️⃣ Nettoyer le listener beforeunload
    if (this.beforeUnloadHandler) {
      window.removeEventListener("beforeunload", this.beforeUnloadHandler);
      this.beforeUnloadHandler = null;
    }
    
    // 5️⃣ Vider les touches pressées
    this.keys = {};
    
  }

  public pause(): void {
  if (this.animationId) {
    cancelAnimationFrame(this.animationId);
    this.animationId = null;
  }
  
  // Envoyer un message au serveur pour arrêter le game loop
  if (this.ws && this.ws.readyState === WebSocket.OPEN) {
    this.ws.send(JSON.stringify({
      type: "pause",
      matchId: this.matchId
    }));
  }
}

// ▶️ REPRENDRE
public resume(): void {
  
  // Relancer le game loop frontend
  if (!this.animationId) {
    this.gameLoop();
  }
  
  // Envoyer un message au serveur pour relancer le game loop
  if (this.ws && this.ws.readyState === WebSocket.OPEN) {
    this.ws.send(JSON.stringify({
      type: "resume",
      matchId: this.matchId
    }));
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
export default async function View() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode") || "solo";

  const wrap = document.createElement("div");
  wrap.className = "max-w-4xl mx-auto mt-8";

  let titleText = "🎮 ";
  let subtitleText = "";
  let player1Label = t('game.player1');
  let player2Label = t('game.player2');
  
  if (mode === "solo") {
    titleText += `${t('game.quickGame')} vs ${t('game.ai')}`;
    player2Label = t('game.ai');
  } else if (mode === "local") {
    titleText += t('game.localGame');
    // Garder les labels par défaut : player1Label = "Joueur 1", player2Label = "Joueur 2"
  } else if (mode === "tournament") {
    titleText += "Match de Tournoi";
    subtitleText = '<p class="text-center text-text/70 mb-4">🏆 Match local à 2 joueurs sur le même ordinateur</p>';
    
    // Récupérer les noms des joueurs uniquement en mode tournoi
    const rawPlayer1Id = params.get("player1");
    const rawPlayer2Id = params.get("player2");
    
    if (rawPlayer1Id && rawPlayer2Id) {
      try {
        const player1Id = rawPlayer1Id.startsWith('user-') ? rawPlayer1Id.replace('user-', '') : rawPlayer1Id;
        const player2Id = rawPlayer2Id.startsWith('user-') ? rawPlayer2Id.replace('user-', '') : rawPlayer2Id;
        
        const [player1Response, player2Response] = await Promise.all([
          api(`/users/${player1Id}`).catch(() => null),
          api(`/users/${player2Id}`).catch(() => null)
        ]);
        
        if (player1Response?.displayName) player1Label = player1Response.displayName;
        if (player2Response?.displayName) player2Label = player2Response.displayName;
      } catch (error) {
        console.warn("Impossible de récupérer les noms des joueurs:", error);
      }
    }
  } else {
    titleText += t('game.multiplayer');
  }

		wrap.innerHTML = `
		<h1 class="text-3xl font-bold text-text mb-6">
			${titleText}
		</h1>
		${subtitleText}
		<div class="bg-prem rounded-lg shadow-xl p-6">
			<!-- Score -->
			<div class="grid grid-cols-2 gap-8 mb-4">
			<div class="text-center">
				<h2 id="player1-name" class="text-xl font-bold text-text mb-2">${player1Label}</h2>
				<div id="score-left" class="text-5xl font-bold text-sec">0</div>
			</div>
			<div class="text-center">
				<h2 id="player2-name" class="text-xl font-bold text-text mb-2">${player2Label}</h2>
				<div id="score-right" class="text-5xl font-bold text-sec">0</div>
			</div>
			</div>

			<!-- Canvas -->
			<div class="flex justify-center relative">
			<canvas id="gameCanvas" class="border-2 border-sec rounded bg-black"></canvas>
			
			<!-- Overlay de démarrage (visible au début) -->
			<div id="start-overlay" class="absolute inset-0 flex flex-col items-center justify-center bg-black/90 rounded">
				<div class="text-center">
				<h2 class="text-4xl font-bold text-sec mb-8">${t('game.readyToPlay')}</h2>
				${mode === "local" || mode === "tournament" ? `
					<div class="flex gap-8 mb-6">
					<div class="text-center">
						<p class="text-2xl text-text mb-4">${player1Label}</p>
						<button id="btn-player1-ready" class="bg-sec hover:bg-sec/80 text-white px-12 py-6 rounded-lg font-bold text-2xl transition-all">
						${t('game.ready')}
						</button>
						<p class="text-sm text-text/70 mt-2">W/S</p>
					</div>
					<div class="text-center">
						<p class="text-2xl text-text mb-4">${player2Label}</p>
						<button id="btn-player2-ready" class="bg-sec hover:bg-sec/80 text-white px-12 py-6 rounded-lg font-bold text-2xl transition-all">
						${t('game.ready')}
						</button>
						<p class="text-sm text-text/70 mt-2">↑/↓</p>
					</div>
					</div>
					<p class="text-text/60 text-sm">${t('game.bothPlayersReady')}</p>
				` : `
					<button id="btn-start" class="bg-sec hover:bg-sec/80 text-white px-16 py-8 rounded-lg font-bold text-3xl transition-all">
					${t('game.start')}
					</button>
					<p class="text-sm text-text/70 mt-4">${t('game.instructions')}</p>
				`}
				</div>
			</div>
			
			<!-- Overlay de fin de partie (caché par défaut) -->
			<div id="game-over-overlay" class="hidden absolute inset-0 flex flex-col items-center justify-center bg-black/90 rounded">
				<div class="text-center">
				<h2 id="winner-text" class="text-5xl font-bold text-sec mb-4">🏆</h2>
				<p id="final-score" class="text-3xl text-text mb-8">5 - 3</p>
				<div class="flex gap-4 justify-center">
					<button id="btn-replay" class="bg-sec hover:bg-sec/80 text-white px-8 py-3 rounded-lg font-bold text-xl">
					${t('game.replay')}
					</button>
					<button id="btn-quit" class="bg-gray-600 hover:bg-gray-700 text-white px-8 py-3 rounded-lg font-bold text-xl">
					${t('game.quit')}
					</button>
				</div>
				</div>
			</div>
			</div>

			<!-- Instructions -->
			<div class="mt-4 text-center text-text/70 text-sm">
			${mode === "local" 
				? `👥 ${t('game.controls.local')}` 
				: `⌨️ ${t('game.controls.solo')}`}
			</div>
			
			<!-- Bouton abandon (seulement pendant la partie) -->
			<div id="game-controls" class="mt-4 text-center">
			<button id="btn-abandon" class="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded font-bold">
				${t('game.abandon')}
			</button>
			</div>
		</div>
		<p class="mt-4 text-center">
			<a href="/partie" class="text-sec hover:underline">← ${t('common.back')}</a>
		</p>
		`;

  const canvas = wrap.querySelector("#gameCanvas") as HTMLCanvasElement;
  const scoreLeft = wrap.querySelector("#score-left") as HTMLDivElement;
  const scoreRight = wrap.querySelector("#score-right") as HTMLDivElement;
  const btnAbandon = wrap.querySelector("#btn-abandon") as HTMLButtonElement;
  const btnReplay = wrap.querySelector("#btn-replay") as HTMLButtonElement;
  const btnQuit = wrap.querySelector("#btn-quit") as HTMLButtonElement;
  
  // Références aux noms des joueurs avec IDs spécifiques
  const player1NameElement = wrap.querySelector('#player1-name') as HTMLElement;
  const player2NameElement = wrap.querySelector('#player2-name') as HTMLElement;
  
  // 🆕 Boutons de démarrage
  const btnStart = wrap.querySelector("#btn-start") as HTMLButtonElement | null;
  const btnPlayer1Ready = wrap.querySelector("#btn-player1-ready") as HTMLButtonElement | null;
  const btnPlayer2Ready = wrap.querySelector("#btn-player2-ready") as HTMLButtonElement | null;

  // Créer et démarrer le jeu
  const game = new PongGame(canvas, mode, scoreLeft, scoreRight);
  game.setPlayerNameElements(player1NameElement, player2NameElement);
  await game.connect();
  game.start();
  
  // 🆕 EXPOSER L'INSTANCE DANS LE CONTEXTE GLOBAL
  window.currentGameInstance = game;
  console.log("🌍 Instance PongGame exposée dans window.currentGameInstance");
  
  // 🆕 Gestion des boutons de démarrage
  if (mode === "solo" && btnStart) {
    btnStart.addEventListener("click", () => {
      game.setPlayerReady(1);
    });
  } else if ((mode === "local" || mode === "tournament") && btnPlayer1Ready && btnPlayer2Ready) {
    btnPlayer1Ready.addEventListener("click", () => {
      game.setPlayerReady(1);
      btnPlayer1Ready.disabled = true;
      btnPlayer1Ready.classList.add("opacity-50", "cursor-not-allowed");
      btnPlayer1Ready.innerHTML = `✅ ${t('game.ready')}`;
    });
    
    btnPlayer2Ready.addEventListener("click", () => {
      game.setPlayerReady(2);
      btnPlayer2Ready.disabled = true;
      btnPlayer2Ready.classList.add("opacity-50", "cursor-not-allowed");
      btnPlayer2Ready.innerHTML = `✅ ${t('game.ready')}`;
    });
  }

	// Bouton Abandon (pendant la partie)
	btnAbandon.addEventListener("click", () => {
		game.pause();
	// Créer un modal personnalisé centré sur le canvas
	const modal = document.createElement('div');
	modal.className = 'absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 rounded';
	modal.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%;';
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
		<h2 class="text-3xl font-bold text-text text-center mb-4">${t('game.abandonGame')}</h2>
		
		<!-- Message -->
		<p class="text-text/70 text-center mb-8">${t('game.abandonMessage')}</p>
		
		<!-- Boutons -->
		<div class="flex gap-4">
			<button id="modal-cancel" class="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-lg">
			${t('game.continue')}
			</button>
			<button id="modal-confirm" class="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg">
			${t('game.abandon')}
			</button>
		</div>
		</div>
	`;
	
	// Insérer le modal dans le conteneur du canvas au lieu du body
	const canvasContainer = canvas.parentElement;
	if (canvasContainer) {
		canvasContainer.appendChild(modal);
	}
	
	// Annuler
	modal.querySelector('#modal-cancel')?.addEventListener('click', () => {
		modal.remove();
		game.resume();
	});
	
	// Confirmer
	modal.querySelector('#modal-confirm')?.addEventListener('click', () => {
		modal.remove();
		game.abandon();
	});
	
	// Fermer si clic en dehors
	modal.addEventListener('click', (e) => {
		if (e.target === modal) {
		modal.remove();
		game.resume();
		}
	});
	});

	// 🆕 Bouton Rejouer (fin de partie)
	btnReplay.addEventListener("click", async () => {
	// ✅ Autoriser la navigation
	game.allowNavigation = true;
	
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
	// ✅ Autoriser la navigation
	game.allowNavigation = true;
	
	game.destroy();
	window.location.href = '/partie';
	});

  return wrap;
}