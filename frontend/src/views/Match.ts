import { connectWS } from "../ws-client";
import { api } from "../api-client";
import { t } from "../i18n/index.js";
import { authManager } from "../auth";
import { router } from "../router";

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

class PongGame {

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animationId: number | null = null;
  
  private mode: string;
  private matchId: string = "";
  private gameState: GameState | null = null;
  private gameEnded: boolean = false;
  private gameStarted: boolean = false;
  
  private player1Id: string = "";
  private player2Id: string = "";
  private player1Ready: boolean = false;
  private player2Ready: boolean = false;
  private playerNameElements: NodeListOf<HTMLElement> | null = null;
  
  private ws: WebSocket | null = null;
  private keys: { [key: string]: boolean } = {};
  
  private scoreLeftDiv: HTMLDivElement;
  private scoreRightDiv: HTMLDivElement;
  public allowNavigation: boolean = false;
  
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private keyupHandler: ((e: KeyboardEvent) => void) | null = null;
  private beforeUnloadHandler: (() => void) | null = null;
  
  private readonly COURT_WIDTH = 800;
  private readonly COURT_HEIGHT = 600;
  private readonly PADDLE_WIDTH = 10;
  
  constructor(
    canvas: HTMLCanvasElement,
    mode: string,
    scoreLeftDiv: HTMLDivElement,
    scoreRightDiv: HTMLDivElement
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.mode = mode;
    this.scoreLeftDiv = scoreLeftDiv;
    this.scoreRightDiv = scoreRightDiv;
    
    this.canvas.width = this.COURT_WIDTH;
    this.canvas.height = this.COURT_HEIGHT;
    
    this.beforeUnloadHandler = () => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.close();
      }
    };
    
    window.addEventListener('beforeunload', this.beforeUnloadHandler);
  }
  
  public setPlayerNameElements(
    player1Element: HTMLElement,
    player2Element: HTMLElement
  ): void {
    this.playerNameElements = [player1Element, player2Element] as any;
  }
  
  public setMatchId(matchId: string): void {
    this.matchId = matchId;
    console.log("🎮 Match ID défini:", matchId);
  }
  
  private updatePlayerNames(): void {
    if (!this.playerNameElements || !this.gameState?.players) return;
    
    if (this.mode !== "tournament") return;
    
    if (this.gameState.players.left && this.playerNameElements[0]) {
      this.playerNameElements[0].textContent = this.gameState.players.left.name;
    }
    
    if (this.gameState.players.right && this.playerNameElements[1]) {
      this.playerNameElements[1].textContent = this.gameState.players.right.name;
    }
  }
  
  public setPlayerReady(player: 1 | 2): void {
    if (player === 1) {
      this.player1Ready = true;
      console.log(" Joueur 1 prêt!");
    } else {
      this.player2Ready = true;
      console.log(" Joueur 2 prêt!");
    }
    
    this.checkStartGame();
  }
  
  private checkStartGame(): void {
    if (this.gameStarted) return;
    
    const canStart = (this.mode === "local" || this.mode === "tournament") 
      ? (this.player1Ready && this.player2Ready)
      : this.player1Ready;
    
    if (canStart && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.gameStarted = true;
      console.log(" Démarrage du jeu!");
      
      this.ws.send(JSON.stringify({
        type: "start",
        matchId: this.matchId
      }));
      
      const startOverlay = document.getElementById('start-overlay');
      if (startOverlay) {
        startOverlay.classList.add('hidden');
      }
      
      this.startGame();
    }
  }
  
  async connect() {
    try {
      let player1Id, player2Id;
      
      if (this.mode === "tournament") {
        const params = new URLSearchParams(window.location.search);
        const rawPlayer1Id = params.get("player1");
        const rawPlayer2Id = params.get("player2");
        
        if (!rawPlayer1Id || !rawPlayer2Id) {
          throw new Error("IDs des joueurs manquants pour le match de tournoi");
        }
        
        player1Id = rawPlayer1Id.startsWith('user-') ? rawPlayer1Id : `user-${rawPlayer1Id}`;
        player2Id = rawPlayer2Id.startsWith('user-') ? rawPlayer2Id : `user-${rawPlayer2Id}`;
      }
      
      else if (this.mode === "local") {
        const params = new URLSearchParams(window.location.search);
        const fromChat = params.get("fromChat");
        const rawPlayer1Id = params.get("player1");
        const rawPlayer2Id = params.get("player2");
        
        if (fromChat === "true" && rawPlayer1Id && rawPlayer2Id) {
          player1Id = rawPlayer1Id.startsWith('user-') ? rawPlayer1Id : `user-${rawPlayer1Id}`;
          player2Id = rawPlayer2Id.startsWith('user-') ? rawPlayer2Id : `user-${rawPlayer2Id}`;
        } else {
          const currentUser = authManager.getState().user;
          if (!currentUser?.id) {
            throw new Error("User not authenticated");
          }
          player1Id = `user-${currentUser.id}`;
          player2Id = `local-player2-${Date.now()}`;
        }
      }
      
      else {
        const currentUser = authManager.getState().user;
        if (!currentUser?.id) {
          throw new Error("User not authenticated");
        }
        
        player1Id = `user-${currentUser.id}`;
        player2Id = `ai-${Date.now()}`;
      }
      
      this.player1Id = player1Id;
      this.player2Id = player2Id;
      
      let response;
      
      if (this.mode === "solo") {
        response = await api("/game/create", {
          method: "POST",
          body: JSON.stringify({ mode: "solo-vs-ai" })
        });
      }
      
      else if (this.mode === "local") {
        response = await api("/game/local/create", {
          method: "POST",
          body: JSON.stringify({
            player1Id: player1Id,
            player2Id: player2Id
          })
        });
      }
      
      else if (this.mode === "tournament") {
        response = await api("/game/local/create", {
          method: "POST",
          body: JSON.stringify({
            player1Id: player1Id,
            player2Id: player2Id,
            mode: "tournament"
          })
        });
      }
      
      else if (this.mode === "multiplayer") {
        if (this.matchId) {
          response = { matchId: this.matchId };
        } else {
          response = await api("/game/create", {
            method: "POST",
            body: JSON.stringify({ mode: "online-2p" })
          });
        }
      }
      
      else {
        return;
      }
      
      this.matchId = response.matchId;
      
      this.ws = connectWS('/ws/game', (msg: any) => {
        this.handleServerMessage(msg);
      });
      
      this.ws.onopen = () => {
        
        let playerSide = "left";
        if (this.mode === "multiplayer") {
          const currentUserId = authManager.getState().user?.id;
          const params = new URLSearchParams(window.location.search);
          const inviteId = params.get("invite");
          
          playerSide = (currentUserId?.toString() === inviteId) ? "left" : "right";
        }
        
        this.ws?.send(JSON.stringify({
          type: "join",
          matchId: this.matchId,
          playerId: this.player1Id,
          side: playerSide
        }));
        
        if (this.mode === "local" || this.mode === "tournament") {
          setTimeout(() => {
            this.ws?.send(JSON.stringify({
              type: "join",
              matchId: this.matchId,
              playerId: this.player2Id,
              side: "right"
            }));
            
            setTimeout(() => {
              this.ws?.send(JSON.stringify({
                type: "getState",
                matchId: this.matchId
              }));
            }, 200);
          }, 100);
        }
        
        else if (this.mode === "multiplayer") {
          setTimeout(() => {
            this.ws?.send(JSON.stringify({
              type: "getState",
              matchId: this.matchId
            }));
          }, 200);
        }
      };
      
      this.ws.onerror = () => {
        console.error(" Erreur WebSocket");
      };
      
    } catch (error) {
      console.error(" Erreur lors de la connexion:", error);
    }
  }
  
  private handleServerMessage(msg: any) {
    if (msg.type === "game/state") {
      this.gameState = msg.data;
      
      if (this.gameState) {
        this.scoreLeftDiv.textContent = this.gameState.score.left.toString();
        this.scoreRightDiv.textContent = this.gameState.score.right.toString();
        this.updatePlayerNames();
      }
    }
    
    else if (msg.type === "game/end") {
      this.endGame(msg.data);
    }
  }
  
  private render() {
    if (!this.gameState) return;
    
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    
    ctx.fillStyle = "#C95A3F";
    ctx.fillRect(0, 0, w, h);
    
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 4;
    ctx.setLineDash([]);
    
    const marginX = 40;
    const marginY = 30;
    ctx.strokeRect(marginX, marginY, w - 2 * marginX, h - 2 * marginY);
    
    const innerMarginY = 80;
    ctx.strokeRect(marginX, innerMarginY, w - 2 * marginX, h - 2 * innerMarginY);
    
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w / 2, marginY);
    ctx.lineTo(w / 2, h - marginY);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(w * 0.30, innerMarginY);
    ctx.lineTo(w * 0.30, h - innerMarginY);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(w * 0.70, innerMarginY);
    ctx.lineTo(w * 0.70, h - innerMarginY);
    ctx.stroke();
    
    ctx.lineWidth = 2;
    
    ctx.beginPath();
    ctx.moveTo(w / 2, h / 2);
    ctx.lineTo(w * 0.30, h / 2);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(w / 2, h / 2);
    ctx.lineTo(w * 0.70, h / 2);
    ctx.stroke();
    
    ctx.fillStyle = "#2C2C2C";
    const netWidth = 6;
    ctx.fillRect(w / 2 - netWidth / 2, marginY, netWidth, h - 2 * marginY);
    
    ctx.fillStyle = "#1A1A1A";
    ctx.fillRect(w / 2 - 12, marginY - 5, 24, 10);
    ctx.fillRect(w / 2 - 12, h - marginY - 5, 24, 10);
    
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
    
    const leftPaddleY = this.gameState.paddles.left.y * this.COURT_HEIGHT;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(
      20,
      leftPaddleY - this.gameState.paddles.left.height / 2,
      this.PADDLE_WIDTH,
      this.gameState.paddles.left.height
    );
    
    const rightPaddleY = this.gameState.paddles.right.y * this.COURT_HEIGHT;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(
      this.COURT_WIDTH - 20 - this.PADDLE_WIDTH,
      rightPaddleY - this.gameState.paddles.right.height / 2,
      this.PADDLE_WIDTH,
      this.gameState.paddles.right.height
    );
    
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
  
  private setupInput() {
    this.keydownHandler = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'w', 'W', 's', 'S', ' '].includes(e.key)) {
        e.preventDefault();
      }
      this.keys[e.key] = true;
    };
    
    this.keyupHandler = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'w', 'W', 's', 'S', ' '].includes(e.key)) {
        e.preventDefault();
      }
      this.keys[e.key] = false;
    };
    
    window.addEventListener("keydown", this.keydownHandler);
    window.addEventListener("keyup", this.keyupHandler);
    
    setInterval(() => {
      this.sendInputs();
    }, 1000 / 60);
  }
  
  private sendInputs() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    
    if (this.mode === "local" || this.mode === "tournament") {
      
      const player1Input = {
        up: this.keys["w"] || this.keys["W"] || false,
        down: this.keys["s"] || this.keys["S"] || false
      };
      
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
      
      this.ws.send(JSON.stringify({
        type: "input",
        matchId: this.matchId,
        playerId: this.player2Id,
        input: player2Input
      }));
    }
    
    else {
      const soloInput = {
        up: this.keys["w"] || this.keys["W"] || this.keys["ArrowUp"] || false,
        down: this.keys["s"] || this.keys["S"] || this.keys["ArrowDown"] || false
      };
      
      this.ws.send(JSON.stringify({
        type: "input",
        matchId: this.matchId,
        playerId: this.player1Id,
        input: soloInput
      }));
    }
  }
  
  private gameLoop = () => {
    this.render();
    this.animationId = requestAnimationFrame(this.gameLoop);
  };

  start() {
    this.gameLoop();
    console.log(" Rendu visuel démarré!");
  }
  
  startGame() {
    if (!this.gameStarted) return;
    this.setupInput();
    console.log(" Jeu et contrôles démarrés!");
  }
  
  public pause(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: "pause",
        matchId: this.matchId
      }));
    }
  }
  
  public resume(): void {
    if (!this.animationId) {
      this.gameLoop();
    }
    
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
      await api(`/game/${this.matchId}`, { method: 'DELETE' });
      
      
	  this.destroy();
	  const { router } = await import('../router.js');
	  router.navigate('/partie');
    } catch (error) {
      console.error(" Erreur lors de l'abandon:", error);
    }
  }
  
  private async endGame(data: any) {
    if (this.gameEnded) {
      console.log('Game already ended, ignoring duplicate call');
      return;
    }
    this.gameEnded = true;
    
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    
    const overlay = document.getElementById('game-over-overlay');
    const winnerText = document.getElementById('winner-text');
    const finalScore = document.getElementById('final-score');
    const gameControls = document.getElementById('game-controls');
    
    if (overlay && winnerText && finalScore && gameControls) {
      
      gameControls.classList.add('hidden');
      
      overlay.classList.remove('hidden');
      
      let winner: string;
      
      if (this.playerNameElements && this.playerNameElements.length >= 2) {
        const leftPlayerName = this.playerNameElements[0]?.textContent || t('game.player1');
        const rightPlayerName = this.playerNameElements[1]?.textContent || t('game.player2');
        
        winner = data.winner === 'left' ? leftPlayerName : rightPlayerName;
      } else {
        winner = data.winner === 'left' ? t('game.player1') : 
                  this.mode === 'solo' ? t('game.ai') : t('game.player2');
      }
      
      winnerText.textContent = ` ${winner} ${t('game.wins')}`;
      
      finalScore.textContent = `${data.score.left} - ${data.score.right}`;
      
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
      
      const urlParams = new URLSearchParams(window.location.search);
      const matchId = urlParams.get("matchId");
      
      const leftPlayerId = this.player1Id.startsWith('user-') 
        ? this.player1Id.substring(5) 
        : this.player1Id;
      const rightPlayerId = this.player2Id.startsWith('user-') 
        ? this.player2Id.substring(5) 
        : this.player2Id;
      
      console.log(` Submitting tournament result:
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
        const winnerText = document.getElementById('winner-text');
        if (winnerText) {
          winnerText.innerHTML = `
             ${winnerText.textContent}<br>
            <span class="text-lg text-green-400"> ${t('game.tournamentCompleted')}</span><br>
            <span class="text-sm text-text/70"> ${t('game.tournamentBlockchainInfo')}</span>
          `;
        }
      }
      
      console.log('Tournament result submitted successfully', response);
    } catch (error) {
      console.error('Error submitting tournament result:', error);
      
      const winnerText = document.getElementById('winner-text');
      if (winnerText) {
        winnerText.innerHTML = winnerText.innerHTML + 
          '<br><span class="text-sm text-red-400"> Erreur sauvegarde blockchain</span>';
      }
    }
  }
  
  destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    
    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }
    
    if (this.keydownHandler) {
      window.removeEventListener("keydown", this.keydownHandler);
      this.keydownHandler = null;
    }
    
    if (this.keyupHandler) {
      window.removeEventListener("keyup", this.keyupHandler);
      this.keyupHandler = null;
    }
    
    if (this.beforeUnloadHandler) {
      window.removeEventListener("beforeunload", this.beforeUnloadHandler);
      this.beforeUnloadHandler = null;
    }
    
    this.keys = {};
  }
}

export default async function View() {
  if (!authManager.isAuthenticated()) {
    router.navigate("/login");
    return document.createElement("div");
  }
  
  const createMobileMessage = () => {
    const mobileMessage = document.createElement("div");
    mobileMessage.className = "max-w-2xl mx-auto mt-8 p-6 md:p-8";
    mobileMessage.innerHTML = `
      <div class="bg-prem rounded-lg shadow-xl p-6 md:p-8 text-center">
        <div class="text-6xl mb-4">🎮</div>
        <h1 class="font-display text-2xl md:text-3xl font-bold text-text mb-4">${t('game.desktopOnly') || 'Jeu disponible sur ordinateur'}</h1>
        <p class="text-text/70 text-base md:text-lg mb-6">
          ${t('game.desktopOnlyMessage') || 'Le jeu Pong nécessite un écran plus large et un clavier pour une expérience optimale. Veuillez utiliser un ordinateur de bureau ou un ordinateur portable.'}
        </p>
        <button 
          id="btn-back-home"
          class="bg-sec hover:bg-sec/80 text-white font-bold py-3 px-6 rounded-lg transition"
        >
          ${t('nav.home') || 'Retour à l\'accueil'}
        </button>
      </div>
    `;
    
    setTimeout(() => {
      const btn = mobileMessage.querySelector('#btn-back-home');
      if (btn) {
        btn.addEventListener('click', async () => {
          const { router } = await import('../router.js');
          router.navigate('/');
        });
      }
    }, 0);
    
    return mobileMessage;
  };

  if (window.innerWidth < 1024) {
    return createMobileMessage();
  }
  
  const params = new URLSearchParams(window.location.search);
  let mode = params.get("mode") || "solo";
  const inviteId = params.get("invite");
  const gameId = params.get("gameId");
  const targetId = params.get("target");
  
  const wrap = document.createElement("div");
  wrap.className = "max-w-4xl mx-auto mt-8";
  
  let titleText = "🎮 ";
  let subtitleText = "";
  let player1Label = t('game.player1');
  let player2Label = t('game.player2');
  
  if (inviteId && gameId) {
    mode = "multiplayer";
    titleText += t('game.invitedGame');
    subtitleText = '<p class="text-center text-text/70 mb-4">🎮 Partie multijoueur en ligne depuis une invitation chat</p>';
    
    const currentUserId = authManager.getState().user?.id;
    try {
      if (targetId && currentUserId) {
        const [inviterResponse, targetResponse] = await Promise.all([
          api(`/users/${inviteId}`).catch(() => null),
          api(`/users/${targetId}`).catch(() => null)
        ]);
        
        if (currentUserId.toString() === inviteId) {
          player1Label = inviterResponse?.displayName || t('game.player1');
          player2Label = targetResponse?.displayName || t('game.player2');
        } else {
          player1Label = targetResponse?.displayName || t('game.player1');
          player2Label = inviterResponse?.displayName || t('game.player2');
        }
      }
    } catch (error) {
      console.warn("Impossible de récupérer les infos des joueurs:", error);
    }
  }
  
  else if (inviteId) {
    titleText += t('game.invitedGame');
    subtitleText = '<p class="text-center text-text/70 mb-4">🎮 Partie lancée depuis une invitation chat</p>';
    
    try {
      const inviterResponse = await api(`/users/${inviteId}`).catch(() => null);
      if (inviterResponse?.displayName) {
        player2Label = inviterResponse.displayName;
      }
    } catch (error) {
      console.warn("Impossible de récupérer les infos de l'inviteur:", error);
    }
  }
  
  else if (mode === "solo") {
    titleText += `${t('game.quickGame')} vs ${t('game.ai')}`;
    
    const currentUser = authManager.getState().user;
    if (currentUser?.displayName) {
      player1Label = currentUser.displayName;
    }
    player2Label = t('game.ai');
  }
  
  else if (mode === "local") {
    const fromChat = params.get("fromChat");
    const rawPlayer1Id = params.get("player1");
    const rawPlayer2Id = params.get("player2");
    
    if (fromChat === "true" && rawPlayer1Id && rawPlayer2Id) {
      titleText += `${t('game.localGame')} - ${t('chat.fromInvitation') || 'Depuis une invitation'}`;
      
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
    } else {
      titleText += t('game.localGame');
      
      const currentUser = authManager.getState().user;
      if (currentUser?.displayName) {
        player1Label = currentUser.displayName;
      }
      player2Label = t('game.player2');
    }
  }
  
  else if (mode === "tournament") {
    titleText += t('game.tournamentMatch');
    subtitleText = `<p class="text-center text-text/70 mb-4"> ${t('game.tournamentMatchDesc')}</p>`;
    
    const rawPlayer1Id = params.get("player1");
    const rawPlayer2Id = params.get("player2");
    
    if (rawPlayer1Id && rawPlayer2Id) {
      try {
        const player1Id = rawPlayer1Id.startsWith('user-') 
          ? rawPlayer1Id.replace('user-', '') 
          : rawPlayer1Id;
        const player2Id = rawPlayer2Id.startsWith('user-') 
          ? rawPlayer2Id.replace('user-', '') 
          : rawPlayer2Id;
        
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
  }
  
  else {
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
              <button id="btn-quit" class="bg-sec hover:bg-sec/80 text-white px-8 py-3 rounded-lg font-bold text-xl">
                ${t('game.quit')}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div class="mt-4 text-center text-text/70 text-sm">
        ${mode === "local" 
          ? `👥 ${t('game.controls.local')}` 
          : `⌨️ ${t('game.controls.solo')}`}
      </div>
      
      <div id="game-controls" class="mt-4 text-center">
        <button id="btn-abandon" class="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded font-bold">
          ${t('game.abandon')}
        </button>
      </div>
    </div>
    
    <p class="mt-4 text-center">
      <a href="#" id="btn-back-to-games" class="text-text hover:text-sec transition-colors">← ${t('common.back')}</a>
    </p>
  `;
  
  const canvas = wrap.querySelector("#gameCanvas") as HTMLCanvasElement;
  const scoreLeft = wrap.querySelector("#score-left") as HTMLDivElement;
  const scoreRight = wrap.querySelector("#score-right") as HTMLDivElement;
  const btnAbandon = wrap.querySelector("#btn-abandon") as HTMLButtonElement;
  const btnQuit = wrap.querySelector("#btn-quit") as HTMLButtonElement;
  
  const player1NameElement = wrap.querySelector('#player1-name') as HTMLElement;
  const player2NameElement = wrap.querySelector('#player2-name') as HTMLElement;
  
  const btnStart = wrap.querySelector("#btn-start") as HTMLButtonElement | null;
  const btnPlayer1Ready = wrap.querySelector("#btn-player1-ready") as HTMLButtonElement | null;
  const btnPlayer2Ready = wrap.querySelector("#btn-player2-ready") as HTMLButtonElement | null;
  
  if ((window as any).currentGameInstance) {
    console.log(" Destruction de l'ancienne instance de jeu...");
    try {
      (window as any).currentGameInstance.destroy();
    } catch (error) {
      console.warn(" Erreur lors de la destruction de l'ancienne instance:", error);
    }
    (window as any).currentGameInstance = null;
  }
  
  const game = new PongGame(canvas, mode, scoreLeft, scoreRight);
  game.setPlayerNameElements(player1NameElement, player2NameElement);
  
  if (gameId) {
    game.setMatchId(gameId);
  }
  
  await game.connect();
  game.start();
  
  (window as any).currentGameInstance = game;
  console.log(" Instance PongGame exposée dans window.currentGameInstance");
  
  if (mode === "solo" && btnStart) {
    btnStart.addEventListener("click", () => {
      game.setPlayerReady(1);
    });
  }
  
  else if ((mode === "local" || mode === "tournament") && btnPlayer1Ready && btnPlayer2Ready) {
    
    btnPlayer1Ready.addEventListener("click", () => {
      game.setPlayerReady(1);
      btnPlayer1Ready.disabled = true;
      btnPlayer1Ready.classList.add("opacity-50", "cursor-not-allowed");
      btnPlayer1Ready.innerHTML = ` ${t('game.ready')}`;
    });
    
    btnPlayer2Ready.addEventListener("click", () => {
      game.setPlayerReady(2);
      btnPlayer2Ready.disabled = true;
      btnPlayer2Ready.classList.add("opacity-50", "cursor-not-allowed");
      btnPlayer2Ready.innerHTML = ` ${t('game.ready')}`;
    });
  }
  
  btnAbandon.addEventListener("click", () => {
    game.pause();
    
    const modal = document.createElement('div');
    modal.className = 'absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 rounded';
    modal.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%;';
    modal.innerHTML = `
      <div class="bg-prem rounded-xl shadow-2xl p-8 max-w-md mx-4 border-2 border-red-500">
        <div class="flex justify-center mb-6">
          <div class="bg-red-500 bg-opacity-20 rounded-full p-4">
            <svg class="w-16 h-16 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
            </svg>
          </div>
        </div>
        
        <h2 class="text-3xl font-bold text-text text-center mb-4">${t('game.abandonGame')}</h2>
        
        <p class="text-text/70 text-center mb-8">${t('game.abandonMessage')}</p>
        
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
    
    const canvasContainer = canvas.parentElement;
    if (canvasContainer) {
      canvasContainer.appendChild(modal);
    }
    
    modal.querySelector('#modal-cancel')?.addEventListener('click', () => {
      modal.remove();
      game.resume();
    });
    
    modal.querySelector('#modal-confirm')?.addEventListener('click', () => {
      modal.remove();
      game.abandon();
    });
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
        game.resume();
      }
    });
  });
  
  const getRedirectPath = () => {
    if (mode === "tournament") {
      const tournamentId = params.get("tournamentId");
      if (tournamentId) {
        return `/tournament/${tournamentId}`;
      }
    }
    
    if (params.get("fromChat") === "true") {
      return '/chat';
    }
    
    if (mode === "multiplayer" && (inviteId || gameId)) {
      return '/chat';
    }
    
    if (inviteId || gameId) {
      return '/chat';
    }
    
    return '/partie';
  };
  
  btnQuit.addEventListener("click", async () => {
    game.allowNavigation = true;
    game.destroy();
    const { router } = await import('../router.js');
    router.navigate(getRedirectPath());
  });
  
  const btnBackToGames = wrap.querySelector("#btn-back-to-games") as HTMLAnchorElement;
  if (btnBackToGames) {
    btnBackToGames.addEventListener("click", async (e) => {
      e.preventDefault();
      game.allowNavigation = true;
      game.destroy();
      const { router } = await import('../router.js');
      router.navigate(getRedirectPath());
    });
  }
  
  let resizeHandler: (() => void) | null = null;
  
  const setupResizeListener = () => {
    resizeHandler = () => {
      const currentPath = window.location.pathname;
      if (window.innerWidth < 1024 && currentPath === '/match') {
        console.log(' Passage en mode mobile détecté, destruction du jeu...');
        
        if (game) {
          game.allowNavigation = true;
          game.destroy();
        }
        const appContainer = document.getElementById('app');
        if (appContainer) {
          appContainer.innerHTML = '';
          appContainer.appendChild(createMobileMessage());
        }
        if (resizeHandler) {
          window.removeEventListener('resize', resizeHandler);
          resizeHandler = null;
        }
      }
    };
    window.addEventListener('resize', resizeHandler);
  };
  setupResizeListener();
  return wrap;
}