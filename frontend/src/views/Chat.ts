import { authManager } from "../auth";
import { router } from "../router";
import { connectWS } from "../ws-client";
import { api } from "../api-client";
import { t } from "../i18n/index.js";
import "../components/user-stats-modal";

interface ChatMessage {
  id?: string;
  type: 'user' | 'system' | 'tournament_notification' | 'tournament_start' | 'tournament_end' | 'game_invite' | 'game_invite_declined' | 'online_users_update' | 'typing_indicator' | 'read_receipt' | 'history';
  username?: string;
  userId?: number;
  avatarUrl?: string;
  text?: string;
  timestamp?: number;
  tournamentNotification?: {
    tournamentId: string | number;
    tournamentName: string;
    matchId: number;
    player1: string;
    player2: string;
  };
  gameInvite?: {
    inviterId: number;
    inviterName: string;
    targetId: number;
    targetName: string;
    gameId: string;
  };
  users?: any[];
  isTyping?: boolean;
  messageId?: string;
  readBy?: number[];
  messages?: ChatMessage[];
}

export default async function View() {
  if (!authManager.isAuthenticated()) {
    router.navigate("/login");
    return document.createElement("div");
  }

  const wrap = document.createElement("div");
  wrap.className = "max-w-6xl mx-auto mt-8";
  
  // Variable pour la fonction de mise à jour des utilisateurs en ligne
  let updateOnlineUsersFromWS: ((users: any[]) => void) | null = null;

  wrap.innerHTML = `
    <h1 class="text-4xl font-bold text-text mb-8">${t('chat.title') || 'Chat en direct'}</h1>
    
    <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <!-- Zone de chat principale -->
      <div class="lg:col-span-3 bg-prem rounded-lg shadow-xl p-6 flex flex-col" style="height: 600px;">
        <div id="messages-container" class="flex-1 overflow-y-auto mb-4 space-y-3 pr-2 pl-1"></div>
        
        <!-- Indicateur de saisie -->
        <div id="typing-indicator" class="mb-2 text-sm text-text/60 italic h-5"></div>
        
        <div class="flex gap-2">
          <input 
            type="text" 
            id="message-input" 
            placeholder="${t('chat.typeMessage') || 'Tapez votre message...'}" 
            class="flex-1 px-4 py-2 bg-sec text-text rounded-lg border border-text/20 focus:outline-none focus:border-sec"
          />
          <button 
            id="send-btn" 
            class="px-6 py-2 bg-sec text-white rounded-lg hover:bg-sec/80 transition-colors font-bold"
          >
            ${t('chat.send') || 'Envoyer'}
          </button>
        </div>
      </div>

      <!-- Sidebar -->
      <div class="bg-prem rounded-lg shadow-xl p-4">
        <!-- Utilisateurs en ligne -->
        <div class="mb-6">
          <h3 class="text-lg font-bold text-text mb-3 flex items-center gap-2">
            <span class="w-2 h-2 bg-green-400 rounded-full"></span>
            ${t('chat.onlineUsers') || 'Utilisateurs en ligne'}
          </h3>
          <div id="online-users-container" class="space-y-2"></div>
        </div>

        <!-- Utilisateurs bloqués -->
        <div>
          <h3 class="text-lg font-bold text-text mb-3 flex items-center gap-2">
            <span class="w-2 h-2 bg-red-400 rounded-full"></span>
            ${t('chat.blockedUsers') || 'Utilisateurs bloqués'}
          </h3>
          <div id="blocked-users-container" class="space-y-2"></div>
        </div>
      </div>
    </div>

    <!-- Modal pour le profil utilisateur -->
    <div id="user-modal" class="hidden fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-prem rounded-lg shadow-2xl p-6 max-w-md w-full mx-4">
        <div id="modal-content"></div>
      </div>
    </div>
  `;

  const messagesContainer = wrap.querySelector("#messages-container") as HTMLDivElement;
  const messageInput = wrap.querySelector("#message-input") as HTMLInputElement;
  const sendBtn = wrap.querySelector("#send-btn") as HTMLButtonElement;
  const onlineUsersContainer = wrap.querySelector("#online-users-container") as HTMLDivElement;
  const blockedUsersContainer = wrap.querySelector("#blocked-users-container") as HTMLDivElement;
  const userModal = wrap.querySelector("#user-modal") as HTMLDivElement;
  const modalContent = wrap.querySelector("#modal-content") as HTMLDivElement;
  const typingIndicator = wrap.querySelector("#typing-indicator") as HTMLDivElement;

  let chatSocket: WebSocket | null = null;
  let blockedUsers: Set<number> = new Set();
  let typingUsers: Map<number, string> = new Map();
  let typingTimeout: NodeJS.Timeout | null = null;
  const readReceipts: Map<string, Set<number>> = new Map();

  // Formater la date et l'heure comme : 06/12/2025 · 13:18
  const formatDateTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const dateStr = date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    const timeStr = date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
    return `${dateStr} · ${timeStr}`;
  };

  // Mettre à jour l'indicateur de saisie
  const updateTypingIndicator = () => {
    if (typingUsers.size === 0) {
      typingIndicator.textContent = '';
      return;
    }

    const names = Array.from(typingUsers.values());
    if (names.length === 1) {
      typingIndicator.textContent = `${names[0]} ${t('chat.isTyping') || 'est en train d\'écrire...'}`;
    } else if (names.length === 2) {
      typingIndicator.textContent = `${names[0]} ${t('chat.and') || 'et'} ${names[1]} ${t('chat.areTyping') || 'sont en train d\'écrire...'}`;
    } else {
      typingIndicator.textContent = `${names.length} ${t('chat.peopleTyping') || 'personnes écrivent...'}`;
    }
  };

  // Envoyer un indicateur de saisie
  const sendTypingIndicator = (isTyping: boolean) => {
    if (chatSocket && chatSocket.readyState === WebSocket.OPEN) {
      chatSocket.send(JSON.stringify({
        type: 'typing_indicator',
        isTyping: isTyping
      }));
    }
  };

  // Envoyer un accusé de lecture
  const sendReadReceipt = (messageId: string) => {
    if (chatSocket && chatSocket.readyState === WebSocket.OPEN) {
      chatSocket.send(JSON.stringify({
        type: 'read_receipt',
        messageId: messageId
      }));
    }
  };

  const createMessageElement = (msg: ChatMessage): HTMLElement => {
    const messageDiv = document.createElement("div");
    messageDiv.className = "mb-3";
    
    if (msg.type === 'system') {
      messageDiv.innerHTML = `
        <div class="text-center">
          <span class="text-xs bg-yellow-600/20 text-yellow-400 px-2 py-1 rounded-full">
            ${msg.text}
          </span>
        </div>
      `;
    }
    else if (msg.type === 'tournament_notification' && msg.tournamentNotification) {
      messageDiv.innerHTML = `
        <div class="bg-blue-600/20 border-l-4 border-blue-500 p-4 rounded-r-lg">
          <div class="flex items-start gap-3">
            <div class="text-3xl">🏆</div>
            <div class="flex-1">
              <div class="font-bold text-blue-400 mb-1">${t('chat.tournamentUpdate')}</div>
              <div class="text-sm text-text/90 mb-2">
                <strong>${msg.tournamentNotification.tournamentName}</strong>
              </div>
              <div class="text-sm text-text/70 mb-3">
                ${msg.tournamentNotification.player1} 🆚 ${msg.tournamentNotification.player2}
              </div>
              <a 
                href="/tournament/${msg.tournamentNotification.tournamentId}"
                class="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors"
              >
                ${t('chat.viewTournament') || 'Voir le tournoi'} →
              </a>
            </div>
          </div>
        </div>
      `;
    }
    else if (msg.type === 'tournament_start' && msg.tournamentNotification) {
      const translatedText = t('chat.tournamentStarted', { name: msg.tournamentNotification.tournamentName });
      messageDiv.innerHTML = `
        <div class="bg-green-600/20 border-l-4 border-green-500 p-4 rounded-r-lg">
          <div class="flex items-start gap-3">
            <div class="text-3xl">🚀</div>
            <div class="flex-1">
              <div class="text-sm text-text/90 mb-2">
                ${translatedText}
              </div>
              <a 
                href="/tournament/${msg.tournamentNotification.tournamentId}"
                class="inline-block bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors"
              >
                ${t('chat.viewTournament') || 'Voir le tournoi'} →
              </a>
            </div>
          </div>
        </div>
      `;
    }
    else if (msg.type === 'tournament_end' && msg.tournamentNotification) {
      const translatedText = t('chat.tournamentEnded', { 
        name: msg.tournamentNotification.tournamentName, 
        winner: msg.tournamentNotification.player1 
      });
      messageDiv.innerHTML = `
        <div class="bg-purple-600/20 border-l-4 border-purple-500 p-4 rounded-r-lg">
          <div class="flex items-start gap-3">
            <div class="text-3xl">🏆</div>
            <div class="flex-1">
              <div class="text-sm text-text/90 mb-2">
                ${translatedText}
              </div>
              <a 
                href="/tournament/${msg.tournamentNotification.tournamentId}"
                class="inline-block bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors"
              >
                ${t('chat.viewTournament') || 'Voir le tournoi'} →
              </a>
            </div>
          </div>
        </div>
      `;
    }
    else if (msg.type === 'online_users_update' && msg.users) {
      // Mise à jour en temps réel des utilisateurs en ligne
      if (updateOnlineUsersFromWS) {
        updateOnlineUsersFromWS(msg.users);
      }
      // Ne pas afficher ce message dans le chat - retourner un élément vide
      return document.createElement("div");
    }
    else if (msg.type === 'game_invite_declined' && msg.gameInvite) {
      const currentUserId = authManager.getState().user?.id;
      const isForMe = currentUserId === msg.gameInvite.inviterId;
      
      if (isForMe) {
        messageDiv.innerHTML = `
          <div class="bg-red-600/20 border-l-4 border-red-500 p-3 rounded-r-lg">
            <div class="flex items-start gap-3">
              <div class="text-2xl">❌</div>
              <div class="text-sm text-text/90">
                <strong>${msg.gameInvite.targetName}</strong> ${t('chat.hasDeclinedInvite') || 'a refusé votre invitation'}
              </div>
            </div>
          </div>
        `;
      }
    }
    else if (msg.type === 'game_invite' && msg.gameInvite) {
      const currentUserId = authManager.getState().user?.id;
      const isForMe = currentUserId === msg.gameInvite.targetId;
      
      if (isForMe) {
        messageDiv.innerHTML = `
          <div class="bg-green-600/20 border-l-4 border-green-500 p-4 rounded-r-lg">
            <div class="flex items-start gap-3">
              <div class="text-3xl">🎮</div>
              <div class="flex-1">
                <div class="font-bold text-green-400 mb-1">${t('chat.gameInviteReceived')}</div>
                <div class="text-sm text-text/90 mb-3">
                  <strong>${msg.gameInvite.inviterName}</strong> ${t('chat.invitesYouToPlay')}
                </div>
                <div class="flex gap-2">
                  <a 
                    href="/match?mode=local"
                    class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors"
                  >
                    ${t('chat.accept')} ✓
                  </a>
                  <button 
                    onclick="declineGameInvite(${msg.gameInvite.inviterId}, '${msg.gameInvite.inviterName}', '${msg.gameInvite.gameId}', this)"
                    class="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors"
                  >
                    ${t('chat.decline')} ✗
                  </button>
                </div>
              </div>
            </div>
          </div>
        `;
      } else {
        const translatedText = t('chat.gameInviteNotification', { 
          inviter: msg.gameInvite.inviterName, 
          target: msg.gameInvite.targetName 
        });
        const withStrongTags = translatedText
          .replace(msg.gameInvite.inviterName, `<strong>${msg.gameInvite.inviterName}</strong>`)
          .replace(msg.gameInvite.targetName, `<strong>${msg.gameInvite.targetName}</strong>`);
        
        messageDiv.innerHTML = `
          <div class="bg-gray-600/20 border-l-4 border-gray-500 p-3 rounded-r-lg">
            <div class="text-sm text-text/70">
              ${withStrongTags}
            </div>
          </div>
        `;
      }
    }
    else {
      const currentUserId = authManager.getState().user?.id;
      const isMyMessage = msg.userId === currentUserId;
      const messageId = msg.id || `msg_${msg.timestamp}`;
      
      // Déterminer l'état de lecture
      const readers = readReceipts.get(messageId);
      const readCount = readers ? readers.size : 0;
      const hasReadBy = msg.readBy && msg.readBy.length > 0;
      const isRead = readCount > 0 || hasReadBy;
      
      // ✓ gris si non lu, ✓✓ vert si lu (seulement pour mes messages)
      const readIndicator = isMyMessage 
        ? isRead 
          ? `<span class="text-xs text-green-400" title="${readCount || msg.readBy?.length || 0} personne(s) ont lu">✓✓</span>`
          : `<span class="text-xs text-gray-400">✓</span>`
        : '';
      
      messageDiv.innerHTML = `
        <div class="flex ${isMyMessage ? 'justify-end' : 'justify-start'} gap-2" data-message-id="${messageId}">
          ${!isMyMessage ? `
            <div class="flex-shrink-0 cursor-pointer relative z-10" onclick="showUserProfile(${msg.userId}, '${msg.username}', '${msg.avatarUrl || ''}')">
              ${msg.avatarUrl 
                ? `<img src="${msg.avatarUrl}" alt="${msg.username}" class="w-8 h-8 rounded-full object-cover ring-2 ring-sec/30 hover:ring-sec hover:scale-110 transition-all" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
                   <div class="w-8 h-8 bg-gradient-to-br from-sec to-sec/60 rounded-full flex items-center justify-center ring-2 ring-sec/30 hover:ring-sec hover:scale-110 transition-all" style="display:none">
                     <span class="text-white text-xs font-bold">${msg.username?.charAt(0).toUpperCase() || '?'}</span>
                   </div>`
                : `<div class="w-8 h-8 bg-gradient-to-br from-sec to-sec/60 rounded-full flex items-center justify-center ring-2 ring-sec/30 hover:ring-sec hover:scale-110 transition-all">
                     <span class="text-white text-xs font-bold">${msg.username?.charAt(0).toUpperCase() || '?'}</span>
                   </div>`
              }
            </div>
          ` : ''}
          <div class="flex flex-col ${isMyMessage ? 'items-end' : 'items-start'} max-w-[70%]">
            <span class="text-xs text-white font-semibold cursor-pointer hover:underline mb-1" onclick="${!isMyMessage ? `showUserProfile(${msg.userId}, '${msg.username}', '${msg.avatarUrl || ''}')` : ''}">${msg.username}</span>
            <span class="text-xs text-text/50 mb-2">${formatDateTime(msg.timestamp || Date.now())}</span>
            <div class="${isMyMessage ? 'bg-sec text-white border-2 border-sec/50' : 'bg-prem border-2 border-text/20 text-text'} px-4 py-2 rounded-lg shadow-md inline-block">
              ${msg.text}
            </div>
            ${readIndicator}
          </div>
          ${isMyMessage ? `
            <div class="flex-shrink-0">
              ${msg.avatarUrl 
                ? `<img src="${msg.avatarUrl}" alt="${msg.username}" class="w-8 h-8 rounded-full object-cover ring-2 ring-sec/30" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
                   <div class="w-8 h-8 bg-gradient-to-br from-sec to-sec/60 rounded-full flex items-center justify-center ring-2 ring-sec/30" style="display:none">
                     <span class="text-white text-xs font-bold">${msg.username?.charAt(0).toUpperCase() || '?'}</span>
                   </div>`
                : `<div class="w-8 h-8 bg-gradient-to-br from-sec to-sec/60 rounded-full flex items-center justify-center ring-2 ring-sec/30">
                     <span class="text-white text-xs font-bold">${msg.username?.charAt(0).toUpperCase() || '?'}</span>
                   </div>`
              }
            </div>
          ` : ''}
        </div>
      `;
    }
    
    return messageDiv;
  };

  const addMessage = (msg: ChatMessage, sendReceipt: boolean = false) => {
    // Initialiser les readReceipts depuis le message si disponible (seulement pour MES messages)
    const currentUserId = authManager.getState().user?.id;
    if (msg.id && msg.readBy && msg.userId === currentUserId) {
      const messageId = msg.id;
      if (!readReceipts.has(messageId)) {
        readReceipts.set(messageId, new Set());
      }
      msg.readBy.forEach(userId => {
        readReceipts.get(messageId)!.add(userId);
      });
    }
    
    const messageElement = createMessageElement(msg);
    // Ne pas ajouter d'éléments vides pour les messages système
    if (msg.type === 'online_users_update') {
      return;
    }
    messagesContainer.appendChild(messageElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Envoyer un read receipt pour les messages des autres (seulement si demandé)
    if (sendReceipt) {
      if (msg.type === 'user' && msg.userId !== currentUserId && msg.id) {
        sendReadReceipt(msg.id);
      }
    }
  };

  // Fonctions globales pour les boutons
  (window as any).showUserProfile = (userId: number, username: string, avatarUrl?: string) => {
    const currentUserId = authManager.getState().user?.id;
    
    // Ne pas permettre d'ouvrir son propre profil depuis le chat
    if (currentUserId === userId) {
      return;
    }
    
    const avatarHtml = avatarUrl 
      ? `<img src="${avatarUrl}" alt="${username}" class="w-16 h-16 rounded-full object-cover ring-4 ring-sec/30" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
         <div class="w-16 h-16 bg-gradient-to-br from-sec to-sec/60 rounded-full flex items-center justify-center ring-4 ring-sec/30" style="display:none">
           <span class="text-white text-2xl font-bold">${username.charAt(0).toUpperCase()}</span>
         </div>`
      : `<div class="w-16 h-16 bg-gradient-to-br from-sec to-sec/60 rounded-full flex items-center justify-center ring-4 ring-sec/30">
           <span class="text-white text-2xl font-bold">${username.charAt(0).toUpperCase()}</span>
         </div>`;
    
    modalContent.innerHTML = `
      <div class="flex items-center gap-4 mb-6">
        ${avatarHtml}
        <div>
          <h2 class="text-2xl font-bold text-text">${username}</h2>
          <p class="text-text/60 text-sm">${t('chat.clickToInteract') || 'Cliquez pour interagir'}</p>
        </div>
      </div>
      <div class="space-y-3">
        <button 
          onclick="inviteToGame(${userId}, '${username}')"
          class="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white px-4 py-3 rounded-lg font-bold transition-all shadow-lg hover:shadow-xl"
        >
          <span class="text-xl mr-2">🎮</span> ${t('chat.inviteToGame')}
        </button>
        <button 
          onclick="viewProfile(${userId}, '${username}', '${avatarUrl || ''}')"
          class="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-4 py-3 rounded-lg font-bold transition-all shadow-lg hover:shadow-xl"
        >
          <span class="text-xl mr-2">👤</span> ${t('chat.viewProfile')}
        </button>
        <button 
          onclick="blockUser(${userId}, '${username}')"
          class="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-4 py-3 rounded-lg font-bold transition-all shadow-lg hover:shadow-xl"
        >
          <span class="text-xl mr-2">🚫</span> ${t('chat.blockUser')}
        </button>
        <button 
          onclick="closeModal()"
          class="w-full bg-gray-600 hover:bg-gray-700 text-white px-4 py-3 rounded-lg font-bold transition-colors"
        >
          ${t('common.cancel')}
        </button>
      </div>
    `;
    
    userModal.classList.remove("hidden");
  };

  (window as any).closeModal = () => {
    userModal.classList.add("hidden");
  };

  (window as any).inviteToGame = async (userId: number, username: string) => {
    try {
      const currentUser = authManager.getState().user;
      if (!currentUser) return;

      // Générer un ID unique pour la partie
      const gameId = `game-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Envoyer l'invitation via WebSocket
      if (chatSocket && chatSocket.readyState === WebSocket.OPEN) {
        chatSocket.send(JSON.stringify({
          type: 'game_invite',
          inviterId: currentUser.id,
          inviterName: currentUser.displayName,
          targetId: userId,
          targetName: username,
          gameId: gameId
        }));
      }

      (window as any).closeModal();
      
      // Afficher un message de confirmation
      addMessage({
        type: 'system',
        text: `${t('chat.invitationSent') || 'Invitation envoyée à'} ${username}`,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error("Erreur lors de l'invitation:", error);
    }
  };

  (window as any).declineGameInvite = (inviterId: number, inviterName: string, gameId: string, buttonElement: HTMLElement) => {
    const currentUser = authManager.getState().user;
    if (!currentUser) return;

    // Envoyer le refus via WebSocket
    if (chatSocket && chatSocket.readyState === WebSocket.OPEN) {
      chatSocket.send(JSON.stringify({
        type: 'game_invite_declined',
        inviterId: inviterId,
        inviterName: inviterName,
        targetId: currentUser.id,
        targetName: currentUser.displayName,
        gameId: gameId
      }));
    }

    // Supprimer le message d'invitation
    const inviteContainer = buttonElement.closest('.bg-green-600\\/20');
    if (inviteContainer) {
      inviteContainer.remove();
    }

    // Afficher un message de confirmation locale
    addMessage({
      type: 'system',
      text: `${t('chat.inviteDeclined') || 'Invitation refusée'}`,
      timestamp: Date.now()
    });
  };

  (window as any).viewProfile = async (userId: number, username: string, avatarUrl?: string) => {
    // Fermer la modale du chat d'abord
    (window as any).closeModal();
    
    // Petit délai pour s'assurer que la modale du chat est bien fermée
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Utiliser la fonction globale définie dans user-stats-modal.ts
    if ((window as any).viewUserStats) {
      await (window as any).viewUserStats(userId, username, avatarUrl);
    }
  };

  (window as any).blockUser = async (userId: number, username: string) => {
    try {
      await api('/chat/block', {
        method: 'POST',
        body: JSON.stringify({ blockedUserId: userId })
      });
      
      blockedUsers.add(userId);
      updateBlockedUsers();
      updateOnlineUsers();
      (window as any).closeModal();
      
      addMessage({
        type: 'system',
        text: `${username} ${t('chat.hasBeenBlocked') || 'a été bloqué'}`,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error("Erreur lors du blocage:", error);
    }
  };

  (window as any).unblockUser = async (userId: number, username: string) => {
    if (!confirm(`${t('chat.confirmUnblock')} ${username} ?`)) {
      return;
    }
    
    try {
      await api('/chat/unblock', {
        method: 'POST',
        body: JSON.stringify({ blockedUserId: userId })
      });
      
      blockedUsers.delete(userId);
      updateBlockedUsers();
      updateOnlineUsers();
      
      addMessage({
        type: 'system',
        text: `${username} ${t('chat.hasBeenUnblocked') || 'a été débloqué'}`,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error("Erreur lors du déblocage:", error);
    }
  };

  // Assigner la fonction pour la mise à jour des utilisateurs en ligne depuis WebSocket
  updateOnlineUsersFromWS = (users: any[]) => {
    const currentUserId = authManager.getState().user?.id;
    
    // Formater les avatars avec l'API base URL pour les uploads locaux
    const apiBaseUrl = (import.meta as any).env?.VITE_API_BASE_URL || "https://api.localhost:8443";
    users.forEach(user => {
      if (user.avatarUrl && user.avatarUrl.startsWith('/uploads/')) {
        user.avatarUrl = `${apiBaseUrl}${user.avatarUrl}`;
      }
    });
    
    // Filtrer les utilisateurs bloqués
    const filteredUsers = users.filter((user: any) => !blockedUsers.has(user.userId));
    
    if (filteredUsers.length === 0) {
      onlineUsersContainer.innerHTML = `<p class="text-text/50 text-sm text-center py-4">${t('chat.noOnlineUsers') || 'Aucun utilisateur connecté'}</p>`;
      return;
    }
    
    onlineUsersContainer.innerHTML = filteredUsers.map((user: any) => {
      const isCurrentUser = currentUserId === user.userId;
      const avatarHtml = user.avatarUrl 
        ? `<img src="${user.avatarUrl}" alt="${user.username}" class="w-8 h-8 rounded-full object-cover ring-2 ring-green-400/50" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
           <div class="w-8 h-8 bg-gradient-to-br from-sec to-sec/60 rounded-full flex items-center justify-center ring-2 ring-green-400/50" style="display:none">
             <span class="text-white text-sm font-bold">${user.username.charAt(0).toUpperCase()}</span>
           </div>`
        : `<div class="w-8 h-8 bg-gradient-to-br from-sec to-sec/60 rounded-full flex items-center justify-center ring-2 ring-green-400/50">
             <span class="text-white text-sm font-bold">${user.username.charAt(0).toUpperCase()}</span>
           </div>`;
      
      return `
        <div class="flex items-center gap-3 p-2 ${
          isCurrentUser ? 'opacity-50' : 'hover:bg-sec/20 cursor-pointer'
        } rounded-lg transition-colors"
             ${isCurrentUser ? '' : `onclick="showUserProfile(${user.userId}, '${user.username}', '${user.avatarUrl || ''}')" `}>
          ${avatarHtml}
          <div class="flex-1">
            <span class="text-white text-sm font-semibold">${user.username}${isCurrentUser ? ' (Vous)' : ''}</span>
          </div>
          <span class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
        </div>
      `;
    }).join('');
  };

  // Gestion des utilisateurs en ligne (charge initiale)
  const updateOnlineUsers = async () => {
    try {
      const response = await api('/chat/online-users');
      const currentUserId = authManager.getState().user?.id;
      
      // Gérer à la fois {users: []} et [] comme format de réponse
      const onlineUsers = Array.isArray(response) ? response : (response.users || []);
      
      // Formater les avatars avec l'API base URL pour les uploads locaux
      const apiBaseUrl = (import.meta as any).env?.VITE_API_BASE_URL || "https://api.localhost:8443";
      onlineUsers.forEach((user: any) => {
        if (user.avatarUrl && user.avatarUrl.startsWith('/uploads/')) {
          user.avatarUrl = `${apiBaseUrl}${user.avatarUrl}`;
        }
      });
      
      // Filtrer les utilisateurs bloqués
      const filteredUsers = onlineUsers.filter((user: any) => !blockedUsers.has(user.userId));
      
      if (filteredUsers.length === 0) {
        onlineUsersContainer.innerHTML = `<p class="text-text/50 text-sm text-center py-4">${t('chat.noOnlineUsers') || 'Aucun utilisateur connecté'}</p>`;
        return;
      }
      
      onlineUsersContainer.innerHTML = filteredUsers
        .map((user: any) => {
          const isCurrentUser = currentUserId === user.userId;
          const avatarHtml = user.avatarUrl 
            ? `<img src="${user.avatarUrl}" alt="${user.username}" class="w-8 h-8 rounded-full object-cover ring-2 ring-green-400/50" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
               <div class="w-8 h-8 bg-gradient-to-br from-sec to-sec/60 rounded-full flex items-center justify-center ring-2 ring-green-400/50" style="display:none">
                 <span class="text-white text-sm font-bold">${user.username.charAt(0).toUpperCase()}</span>
               </div>`
            : `<div class="w-8 h-8 bg-gradient-to-br from-sec to-sec/60 rounded-full flex items-center justify-center ring-2 ring-green-400/50">
                 <span class="text-white text-sm font-bold">${user.username.charAt(0).toUpperCase()}</span>
               </div>`;
          
          return `
            <div class="flex items-center gap-3 p-2 ${
              isCurrentUser ? 'opacity-50' : 'hover:bg-sec/20 cursor-pointer'
            } rounded-lg transition-colors"
                 ${isCurrentUser ? '' : `onclick="showUserProfile(${user.userId}, '${user.username}', '${user.avatarUrl || ''}')" `}>
              ${avatarHtml}
              <div class="flex-1">
                <span class="text-white text-sm font-semibold">${user.username}${isCurrentUser ? ' (Vous)' : ''}</span>
              </div>
              <span class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            </div>
          `;
        })
        .join('');
    } catch (error) {
      console.error("Erreur lors de la récupération des utilisateurs en ligne:", error);
    }
  };

  // Gestion des utilisateurs bloqués
  const updateBlockedUsers = async () => {
    try {
      const blocked = await api('/chat/blocked');
      blockedUsers = new Set(blocked.map((b: any) => b.blockedUserId));
      
      // Formater les avatars avec l'API base URL pour les uploads locaux
      const apiBaseUrl = (import.meta as any).env?.VITE_API_BASE_URL || "https://api.localhost:8443";
      blocked.forEach((user: any) => {
        if (user.blockedUserAvatar && user.blockedUserAvatar.startsWith('/uploads/')) {
          user.blockedUserAvatar = `${apiBaseUrl}${user.blockedUserAvatar}`;
        }
      });
      
      if (blocked.length === 0) {
        blockedUsersContainer.innerHTML = `<p class="text-text/50 text-sm text-center py-4">${t('chat.noBlockedUsers') || 'Aucun utilisateur bloqué'}</p>`;
        return;
      }
      
      blockedUsersContainer.innerHTML = blocked.map((user: any) => {
        const avatarHtml = user.blockedUserAvatar 
          ? `<img src="${user.blockedUserAvatar}" alt="${user.blockedUsername}" class="w-8 h-8 rounded-full object-cover ring-2 ring-red-400/50" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
             <div class="w-8 h-8 bg-gradient-to-br from-red-600 to-red-800 rounded-full flex items-center justify-center ring-2 ring-red-400/50" style="display:none">
               <span class="text-white text-sm font-bold">${user.blockedUsername.charAt(0).toUpperCase()}</span>
             </div>`
          : `<div class="w-8 h-8 bg-gradient-to-br from-red-600 to-red-800 rounded-full flex items-center justify-center ring-2 ring-red-400/50">
               <span class="text-white text-sm font-bold">${user.blockedUsername.charAt(0).toUpperCase()}</span>
             </div>`;
        
        return `
        <div class="flex items-center gap-3 p-2 hover:bg-sec/20 rounded-lg transition-colors">
          ${avatarHtml}
          <span class="text-white text-sm flex-1 font-semibold">${user.blockedUsername}</span>
          <button 
            onclick="unblockUser(${user.blockedUserId}, '${user.blockedUsername}')"
            class="text-xs bg-red-600/20 hover:bg-red-600/30 text-red-400 px-2 py-1 rounded transition-colors"
          >
            ${t('chat.unblock') || 'Débloquer'}
          </button>
        </div>
      `;
      }).join('');
    } catch (error) {
      console.error("Erreur lors de la récupération des utilisateurs bloqués:", error);
    }
  };

  // Charger les messages récents et l'état initial
  const loadInitialData = async () => {
    try {
      // Charger les utilisateurs bloqués en premier
      await updateBlockedUsers();
      
      // Les messages seront chargés automatiquement via le WebSocket (type 'history')
      
      // Charger les utilisateurs en ligne (charge initiale uniquement)
      await updateOnlineUsers();
      
      // Scroll automatique vers le bas après chargement
      setTimeout(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }, 100);
    } catch (error) {
      console.error("Erreur lors du chargement des données:", error);
    }
  };

  // Connexion WebSocket avec authentification
  chatSocket = connectWS('/ws/chat', (msg: any) => {
    // Gérer l'historique initial
    if (msg.type === 'history' && msg.messages) {
      messagesContainer.innerHTML = '';
      
      // Formater les avatars avec l'API base URL pour les uploads locaux
      const apiBaseUrl = (import.meta as any).env?.VITE_API_BASE_URL || "https://api.localhost:8443";
      msg.messages.forEach((historyMsg: ChatMessage) => {
        if (historyMsg.avatarUrl && historyMsg.avatarUrl.startsWith('/uploads/')) {
          historyMsg.avatarUrl = `${apiBaseUrl}${historyMsg.avatarUrl}`;
        }
      });
      
      msg.messages.forEach((historyMsg: ChatMessage) => {
        // Filtrer les messages des utilisateurs bloqués
        if (historyMsg.type === 'user' && historyMsg.userId && blockedUsers.has(historyMsg.userId)) {
          return;
        }
        addMessage(historyMsg);
      });
      return;
    }
    
    if (msg.type === 'typing_indicator') {
      // Gérer l'indicateur de saisie
      if (msg.isTyping) {
        typingUsers.set(msg.userId, msg.username);
      } else {
        typingUsers.delete(msg.userId);
      }
      updateTypingIndicator();
    } else if (msg.type === 'read_receipt' && msg.messageId) {
      // Gérer l'accusé de lecture - seulement pour mes messages
      const messageElement = messagesContainer.querySelector(`[data-message-id="${msg.messageId}"]`);
      if (messageElement) {
        // Vérifier si c'est mon message en regardant si l'élément contient un indicateur de lecture
        const hasReadIndicator = messageElement.querySelector('.text-green-400, .text-gray-400');
        if (hasReadIndicator) {
          // C'est mon message, mettre à jour le read receipt
          if (!readReceipts.has(msg.messageId)) {
            readReceipts.set(msg.messageId, new Set());
          }
          readReceipts.get(msg.messageId)!.add(msg.userId);
          
          const readers = readReceipts.get(msg.messageId);
          const readCount = readers ? readers.size : 0;
          
          // Mettre à jour l'indicateur de lecture (✓ gris vers ✓✓ vert)
          let existingIndicator = messageElement.querySelector('.text-green-400, .text-gray-400');
          if (existingIndicator) {
            existingIndicator.className = 'text-xs text-green-400';
            existingIndicator.textContent = '✓✓';
            existingIndicator.setAttribute('title', `${readCount} personne(s) ont lu`);
          }
        }
      }
    } else if (msg.type === 'user' || msg.type === 'system' || msg.type === 'tournament_notification' || msg.type === 'tournament_start' || msg.type === 'tournament_end' || msg.type === 'game_invite' || msg.type === 'game_invite_declined' || msg.type === 'online_users_update') {
      // Filtrer les messages des utilisateurs bloqués
      if (msg.type === 'user' && msg.userId && blockedUsers.has(msg.userId)) {
        return;
      }
      
      // Formater l'avatar avec l'API base URL pour les uploads locaux
      const apiBaseUrl = (import.meta as any).env?.VITE_API_BASE_URL || "https://api.localhost:8443";
      if (msg.avatarUrl && msg.avatarUrl.startsWith('/uploads/')) {
        msg.avatarUrl = `${apiBaseUrl}${msg.avatarUrl}`;
      }
      
      // Ajouter le message et envoyer un read receipt pour les messages des autres utilisateurs
      const currentUserId = authManager.getState().user?.id;
      const shouldSendReceipt = msg.type === 'user' && msg.userId !== currentUserId && msg.id;
      addMessage(msg, shouldSendReceipt);
    }
  }, true); // 🔧 Passer needsAuth=true pour envoyer le token

  // Envoyer un message
  const sendMessage = () => {
    const message = messageInput.value.trim();
    if (!message || !chatSocket) return;

    chatSocket.send(JSON.stringify({
      type: 'message',
      text: message
    }));

    messageInput.value = "";
    
    // Arrêter l'indicateur de saisie
    sendTypingIndicator(false);
  };

  sendBtn.addEventListener("click", sendMessage);
  
  messageInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      sendMessage();
    }
  });

  // Gérer l'indicateur de saisie
  messageInput.addEventListener("input", () => {
    const hasText = messageInput.value.trim().length > 0;
    
    if (hasText) {
      // Envoyer typing = true
      sendTypingIndicator(true);
      
      // Réinitialiser le timeout
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
      
      // Arrêter automatiquement après 3 secondes d'inactivité
      typingTimeout = setTimeout(() => {
        sendTypingIndicator(false);
      }, 3000);
    } else {
      // Arrêter l'indicateur si le champ est vide
      sendTypingIndicator(false);
      if (typingTimeout) {
        clearTimeout(typingTimeout);
        typingTimeout = null;
      }
    }
  });

  // Fermer le modal en cliquant à l'extérieur
  userModal.addEventListener("click", (e) => {
    if (e.target === userModal) {
      (window as any).closeModal();
    }
  });

  // Charger les données initiales
  await loadInitialData();

  // Cleanup quand on quitte la vue
  const cleanup = () => {
    if (chatSocket && chatSocket.readyState === WebSocket.OPEN) {
      chatSocket.close();
    }
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }
  };

  // Nettoyer lors de la navigation ou fermeture de la page
  window.addEventListener('beforeunload', cleanup);
  
  // Observer quand l'élément est retiré du DOM (navigation)
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.removedNodes.forEach((node) => {
        if (node === wrap || (node as HTMLElement).contains?.(wrap)) {
          cleanup();
          observer.disconnect();
          window.removeEventListener('beforeunload', cleanup);
        }
      });
    });
  });
  
  // Observer le parent du wrap
  if (wrap.parentElement) {
    observer.observe(wrap.parentElement, { childList: true });
  } else {
    // Si pas encore dans le DOM, observer après insertion
    setTimeout(() => {
      if (wrap.parentElement) {
        observer.observe(wrap.parentElement, { childList: true });
      }
    }, 0);
  }

  return wrap;
}
