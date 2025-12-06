import { api } from "../api-client";
import { t } from "../i18n/index.js";
import "../components/user-stats-modal.js";

interface Friend {
  id: number;
  displayName: string;
  avatarUrl: string | null;
  status: string;
  friendsSince: string;
}

interface FriendRequest {
  id: number;
  displayName: string;
  avatarUrl: string | null;
  requestDate: string;
  requestId: number;
}

interface SearchUser {
  id: number;
  displayName: string;
  avatarUrl: string | null;
  friendshipStatus: string;
}

interface SentRequest {
  id: number;
  userId: number;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
}

export async function FriendsView() {
  const wrap = document.createElement("div");
  wrap.className = "max-w-6xl mx-auto mt-8";

  wrap.innerHTML = `
    <div class="flex justify-between items-center mb-6">
      <h1 class="font-display font-black text-4xl font-bold text-text">${t('friends.title')}</h1>
    </div>

    <div id="friends-content">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Liste des amis -->
        <div class="bg-prem rounded-lg shadow-xl p-6">
          <h2 class="font-display text-2xl font-bold text-text mb-4">${t('friends.myFriends')}</h2>
          <div id="friends-list" class="space-y-3">
            <div class="flex items-center justify-center py-8">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-sec"></div>
            </div>
          </div>
        </div>

        <!-- Demandes reçues -->
        <div class="bg-prem rounded-lg shadow-xl p-6">
          <h2 class="font-display text-2xl font-bold text-text mb-4">${t('friends.friendRequests')}</h2>
          <div id="friend-requests-list" class="space-y-3">
            <div class="flex items-center justify-center py-8">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-sec"></div>
            </div>
          </div>
        </div>

        <!-- Demandes envoyées (en attente) -->
        <div class="bg-prem rounded-lg shadow-xl p-6">
          <h2 class="font-display text-2xl font-bold text-text mb-4">${t('friends.pendingRequests')}</h2>
          <div id="sent-requests-list" class="space-y-3">
            <div class="flex items-center justify-center py-8">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-sec"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Recherche d'amis -->
      <div class="bg-prem rounded-lg shadow-xl p-6 mt-6">
        <h2 class="font-display text-2xl font-bold text-text mb-4">${t('friends.findFriends')}</h2>
        <div class="flex gap-3 mb-4">
          <input 
            type="text" 
            id="search-input"
            placeholder="${t('friends.searchPlaceholder')}"
            class="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-text placeholder-gray-400 focus:outline-none focus:border-sec"
          >
          <button 
            id="search-button"
            class="bg-sec hover:bg-opacity-80 text-text px-6 py-2 rounded-lg font-bold transition"
          >
            ${t('friends.search')}
          </button>
        </div>
        <div id="search-results" class="space-y-3"></div>
      </div>
    </div>
  `;

  const content = wrap.querySelector("#friends-content") as HTMLDivElement;
  const friendsList = wrap.querySelector("#friends-list") as HTMLDivElement;
  const requestsList = wrap.querySelector("#friend-requests-list") as HTMLDivElement;
  const sentRequestsList = wrap.querySelector("#sent-requests-list") as HTMLDivElement;
  const searchInput = wrap.querySelector("#search-input") as HTMLInputElement;
  const searchButton = wrap.querySelector("#search-button") as HTMLButtonElement;
  const searchResults = wrap.querySelector("#search-results") as HTMLDivElement;

  // Variables pour gérer le délai de recherche 
  let searchTimeout: ReturnType<typeof setTimeout>;
  let isRefreshing = false;
  let lastSearchQuery = '';
  let globalStatusListener: ((event: Event) => void) | null = null;
  let globalFriendsListener: ((event: Event) => void) | null = null;

  // Fonction pour charger la liste des amis
  async function loadFriends() {
    try {
      const response = await api("/users/friends");
      const friends: Friend[] = response.friends;

      if (friends.length === 0) {
        friendsList.innerHTML = `
          <div class="text-center py-8">
            <p class="text-gray-400">${t('friends.noFriends')}</p>
          </div>
        `;
        return;
      }

      friendsList.innerHTML = friends.map(friend => `
        <div class="flex items-center justify-between p-4 bg-sec bg-opacity-20 rounded-lg hover:bg-opacity-30 transition-colors" data-friend-id="${friend.id}">
          <div class="flex items-center space-x-3 flex-1 min-w-0">
            <div class="w-12 h-12 rounded-full border-2 border-sec overflow-hidden bg-gray-600 flex items-center justify-center flex-shrink-0">
              ${friend.avatarUrl 
                ? `<img class="w-full h-full object-cover" src="${friend.avatarUrl}" alt="${friend.displayName}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
                   <div class="w-full h-full bg-sec flex items-center justify-center text-text font-bold" style="display:none">${friend.displayName[0].toUpperCase()}</div>`
                : `<div class="w-full h-full bg-sec flex items-center justify-center text-text font-bold">${friend.displayName[0].toUpperCase()}</div>`
              }
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-semibold text-text truncate">${friend.displayName}</p>
              <div class="flex items-center space-x-1 mt-1">
                <div class="w-2 h-2 rounded-full flex-shrink-0 ${friend.status === 'online' ? 'bg-green-400' : 'bg-gray-500'}"></div>
                <span class="text-xs ${friend.status === 'online' ? 'text-green-400' : 'text-gray-500'}">${friend.status === 'online' ? t('chat.online') : t('chat.offline')}</span>
              </div>
              <p class="text-xs text-gray-400 mt-1">${t('friends.friendsSince')} ${new Date(friend.friendsSince).toLocaleDateString()}</p>
            </div>
          </div>
          <div class="flex flex-col space-y-1 ml-3 flex-shrink-0">
            <button 
              onclick="viewProfile(${friend.id}, '${friend.displayName}', '${friend.avatarUrl || ''}')"
              class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-medium transition whitespace-nowrap"
            >
              ${t('friends.viewProfile')}
            </button>
            <button 
              onclick="removeFriend(${friend.id})"
              class="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded text-xs font-medium transition whitespace-nowrap"
            >
              ${t('friends.remove')}
            </button>
          </div>
        </div>
      `).join('');
    } catch (error) {
      friendsList.innerHTML = `
        <div class="text-center py-8">
          <p class="text-red-400">${t('friends.loadError')}</p>
        </div>
      `;
    }
  }

  // Fonction pour charger les demandes d'amis
  async function loadFriendRequests() {
    try {
      const response = await api("/users/friend-requests");
      const requests: FriendRequest[] = response.requests;

      if (requests.length === 0) {
        requestsList.innerHTML = `
          <div class="text-center py-8">
            <p class="text-gray-400">${t('friends.noRequests')}</p>
          </div>
        `;
        return;
      }

      requestsList.innerHTML = requests.map(request => `
        <div class="flex items-center justify-between p-3 bg-sec bg-opacity-20 rounded-lg">
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 rounded-full border-2 border-sec overflow-hidden bg-gray-600 flex items-center justify-center">
              ${request.avatarUrl 
                ? `<img class="w-full h-full object-cover" src="${request.avatarUrl}" alt="${request.displayName}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
                   <div class="w-full h-full bg-sec flex items-center justify-center text-text font-bold" style="display:none">${request.displayName[0].toUpperCase()}</div>`
                : `<div class="w-full h-full bg-sec flex items-center justify-center text-text font-bold">${request.displayName[0].toUpperCase()}</div>`
              }
            </div>
            <div>
              <p class="font-semibold text-text">${request.displayName}</p>
              <p class="text-sm text-gray-400">${new Date(request.requestDate).toLocaleDateString()}</p>
            </div>
          </div>
          <div class="flex space-x-2">
            <button 
              onclick="acceptFriendRequest(${request.requestId})"
              class="bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded text-sm transition"
            >
              ${t('friends.accept')}
            </button>
            <button 
              onclick="declineFriendRequest(${request.requestId})"
              class="bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded text-sm transition"
            >
              ${t('friends.decline')}
            </button>
          </div>
        </div>
      `).join('');
    } catch (error) {
      requestsList.innerHTML = `
        <div class="text-center py-8">
          <p class="text-red-400">${t('friends.loadError')}</p>
        </div>
      `;
    }
  }

  // Fonction pour charger les demandes envoyées
  async function loadSentRequests() {
    try {
      const response = await api("/users/sent-requests");
      const sentRequests: SentRequest[] = response.sentRequests;

      if (sentRequests.length === 0) {
        sentRequestsList.innerHTML = `
          <div class="text-center py-8">
            <p class="text-gray-400">${t('friends.noPendingRequests')}</p>
          </div>
        `;
        return;
      }

      sentRequestsList.innerHTML = sentRequests.map(request => `
        <div class="flex items-center justify-between p-3 bg-yellow-600 bg-opacity-20 rounded-lg border border-yellow-600 border-opacity-30">
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 rounded-full border-2 border-yellow-500 overflow-hidden bg-gray-600 flex items-center justify-center">
              ${request.avatarUrl 
                ? `<img class="w-full h-full object-cover" src="${request.avatarUrl}" alt="${request.displayName}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
                   <div class="w-full h-full bg-yellow-500 flex items-center justify-center text-text font-bold" style="display:none">${request.displayName[0].toUpperCase()}</div>`
                : `<div class="w-full h-full bg-yellow-500 flex items-center justify-center text-text font-bold">${request.displayName[0].toUpperCase()}</div>`
              }
            </div>
            <div>
              <p class="font-semibold text-text">${request.displayName}</p>
              <p class="text-sm text-yellow-300">${t('friends.pending')} • ${new Date(request.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
          <div class="flex space-x-2">
            <button 
              onclick="cancelFriendRequest(${request.id})"
              class="bg-gray-600 hover:bg-gray-500 text-white px-3 py-1 rounded text-sm transition"
            >
              ${t('friends.cancelRequest')}
            </button>
          </div>
        </div>
      `).join('');
    } catch (error) {

      sentRequestsList.innerHTML = `
        <div class="text-center py-4">
          <p class="text-red-400">${t('friends.loadError')}</p>
        </div>
      `;
    }
  }

  // Fonction de recherche
  async function searchUsers() {
    const query = searchInput.value.trim();
    if (query.length < 2) {
      searchResults.innerHTML = `
        <div class="text-center py-4">
          <p class="text-gray-400">${t('friends.searchTooShort')}</p>
        </div>
      `;
      lastSearchQuery = ''; // Réinitialiser la dernière recherche
      return;
    }

    lastSearchQuery = query; // Sauvegarder la requête de recherche

    try {
      const response = await api(`/users/search?q=${encodeURIComponent(query)}`);
      const users: SearchUser[] = response.users;

      if (users.length === 0) {
        searchResults.innerHTML = `
          <div class="text-center py-4">
            <p class="text-gray-400">${t('friends.noResults')}</p>
          </div>
        `;
        return;
      }

      searchResults.innerHTML = users.map(user => `
        <div class="flex items-center justify-between p-3 bg-sec bg-opacity-20 rounded-lg">
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 rounded-full border-2 border-sec overflow-hidden bg-gray-600 flex items-center justify-center">
              ${user.avatarUrl 
                ? `<img class="w-full h-full object-cover" src="${user.avatarUrl}" alt="${user.displayName}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
                   <div class="w-full h-full bg-sec flex items-center justify-center text-text font-bold" style="display:none">${user.displayName[0].toUpperCase()}</div>`
                : `<div class="w-full h-full bg-sec flex items-center justify-center text-text font-bold">${user.displayName[0].toUpperCase()}</div>`
              }
            </div>
            <div>
              <p class="font-semibold text-text">${user.displayName}</p>
              <p class="text-sm text-gray-400">
                ${user.friendshipStatus === 'accepted' ? t('friends.alreadyFriends') :
                  user.friendshipStatus === 'pending' ? t('friends.requestPending') :
                  t('friends.notFriends')}
              </p>
            </div>
          </div>
          <div>
            ${user.friendshipStatus === 'none' ? `
              <button 
                onclick="sendFriendRequest(${user.id})"
                class="bg-sec hover:bg-opacity-80 text-text px-4 py-2 rounded text-sm transition"
              >
                ${t('friends.addFriend')}
              </button>
            ` : user.friendshipStatus === 'accepted' ? `
              <span class="text-green-400 text-sm">✓ ${t('friends.friends')}</span>
            ` : `
              <span class="text-yellow-400 text-sm">⏳ ${t('friends.pending')}</span>
            `}
          </div>
        </div>
      `).join('');
    } catch (error) {
      searchResults.innerHTML = `
        <div class="text-center py-4">
          <p class="text-red-400">${t('friends.searchError')}</p>
        </div>
      `;
    }
  }

  // Event listeners
  searchButton.addEventListener('click', searchUsers);
  
  // Recherche en temps réel
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      const query = searchInput.value.trim();
      if (query.length >= 2) {
        searchUsers();
      } else if (query.length === 0) {
        searchResults.innerHTML = '';
      }
    }, 300); // Délai de 300ms pour éviter trop de requêtes
  });

  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      clearTimeout(searchTimeout);
      searchUsers();
    }
  });

  // Fonction pour refaire la dernière recherche si elle existe
  async function refreshSearchResults() {
    if (lastSearchQuery && lastSearchQuery.length >= 2) {

      await searchUsers();
    }
  }

  // Fonction pour recharger toutes les listes
  async function refreshAllLists() {
    // Éviter les appels multiples simultanés
    if (isRefreshing) {

      return;
    }
    
    isRefreshing = true;
    try {

      await Promise.all([
        loadFriends(),
        loadFriendRequests(),
        loadSentRequests()
      ]);
      // Rafraîchir aussi les résultats de recherche s'il y en a
      await refreshSearchResults();

    } catch (error) {

      // Continuez même en cas d'erreur pour éviter de bloquer l'interface
    } finally {
      isRefreshing = false;
    }
  }

  // Fonction pour écouter les événements WebSocket globaux
  function startGlobalListeners() {

    
    // Écouter les changements de statut
    globalStatusListener = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { userId, isOnline } = customEvent.detail || {};
      
      if (userId && typeof isOnline === 'boolean') {

        updateFriendStatus(userId, isOnline);
      } else {

      }
    };
    
    // Écouter tous les messages WebSocket friends
    globalFriendsListener = (event: Event) => {
      const customEvent = event as CustomEvent;
      const message = customEvent.detail;
      
      if (!message?.type) return;
      

      
      switch (message.type) {
        case 'connected':

          break;
          
        case 'friend_request_received':
          refreshAllLists();
          showNotification(t('friends.requestReceived'), 'info');
          break;
          
        case 'friend_request_sent':
          refreshAllLists();
          break;
          
        case 'friend_accepted':
          refreshAllLists();
          if (!message.data?.autoAccepted) {
            showNotification(t('friends.friendshipEstablished'), 'success');
          }
          break;
          
        case 'friend_request_declined':
        case 'friend_request_cancelled':
          refreshAllLists();
          break;
          
        case 'friend_removed':
          refreshAllLists();
          showNotification(t('friends.friendshipEnded'), 'info');
          break;
          
        case 'friend_status_changed':
          // Déjà géré par globalStatusListener
          break;
          
        default:
          refreshAllLists();
      }
    };
    
    window.addEventListener('friendStatusChanged', globalStatusListener);
    window.addEventListener('friendsWebSocketMessage', globalFriendsListener);
  }

  // Fonction pour arrêter l'écoute globale
  function stopGlobalListeners() {
    if (globalStatusListener) {
      window.removeEventListener('friendStatusChanged', globalStatusListener);
      globalStatusListener = null;
    }
    if (globalFriendsListener) {
      window.removeEventListener('friendsWebSocketMessage', globalFriendsListener);
      globalFriendsListener = null;
    }

  }

  // Fonctions globales pour les boutons
  (window as any).sendFriendRequest = async (userId: number) => {
    try {
      const response = await api(`/users/${userId}/friend-request`, { 
        method: 'POST',
        body: JSON.stringify({})
      });

      // Le WebSocket se chargera du refresh automatique
      
      if (response.autoAccepted) {
        showNotification(`🎉 ${t('friends.mutualRequestAccepted')}`, 'success');
      } else {
        showNotification(t('friends.requestSent'), 'success');
      }
    } catch (error) {
      showNotification(t('friends.requestError'), 'error');
    }
  };

  (window as any).acceptFriendRequest = async (requestId: number) => {
    try {

      await api(`/users/friend-requests/${requestId}/accept`, { 
        method: 'PUT',
        body: JSON.stringify({})
      });

      // Le WebSocket se chargera du refresh automatique
      showNotification(t('friends.requestAccepted'), 'success');
    } catch (error) {

      showNotification(t('friends.acceptError'), 'error');
    }
  };

  (window as any).declineFriendRequest = async (requestId: number) => {
    try {

      await api(`/users/friend-requests/${requestId}`, { 
        method: 'DELETE',
        body: JSON.stringify({})
      });

      // Le WebSocket se chargera du refresh automatique
      showNotification(t('friends.requestDeclined'), 'success');
    } catch (error) {

      showNotification(t('friends.declineError'), 'error');
    }
  };

  (window as any).removeFriend = async (userId: number) => {
    if (!confirm(t('friends.confirmRemove'))) return;
    
    try {
      await api(`/users/${userId}/friend`, { 
        method: 'DELETE',
        body: JSON.stringify({})
      });
      // Le WebSocket se chargera du refresh automatique
      showNotification(t('friends.friendRemoved'), 'success');
    } catch (error) {
      showNotification(t('friends.removeError'), 'error');
    }
  };

  (window as any).viewProfile = async (userId: number, userName: string, avatarUrl?: string) => {
    // Utiliser la fonction globale définie dans user-stats-modal.ts
    if ((window as any).viewUserStats) {
      (window as any).viewUserStats(userId, userName, avatarUrl);
    }
  };

  (window as any).cancelFriendRequest = async (requestId: number) => {
    if (!confirm(t('friends.confirmCancelRequest'))) return;
    
    try {

      await api(`/users/sent-requests/${requestId}`, { 
        method: 'DELETE',
        body: JSON.stringify({})
      });

      // Le WebSocket se chargera du refresh automatique
      showNotification(t('friends.requestCanceled'), 'success');
    } catch (error) {

      showNotification(t('friends.cancelError'), 'error');
    }
  };

  // Fonction pour afficher les notifications
  function showNotification(message: string, type: 'success' | 'error' | 'info') {
    // Implémentation simple de notification (peut être améliorée)
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 px-4 py-2 rounded-lg text-white z-50 ${
      type === 'success' ? 'bg-green-500' : 
      type === 'error' ? 'bg-red-500' : 'bg-blue-500'
    }`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  // Fonction pour mettre à jour le statut d'un ami spécifique (temps réel)
  function updateFriendStatus(userId: number, isOnline: boolean) {
    
    const friendElement = friendsList.querySelector(`[data-friend-id="${userId}"]`);
    
    if (friendElement) {
      const statusDot = friendElement.querySelector('.status-dot');
      const statusText = friendElement.querySelector('.status-text');
      
      
      if (statusDot && statusText) {
        statusDot.className = `w-2 h-2 rounded-full status-dot ${isOnline ? 'bg-green-400' : 'bg-gray-500'}`;
        statusText.className = `ml-1 text-xs status-text ${isOnline ? 'text-green-400' : 'text-gray-500'}`;
        statusText.textContent = isOnline ? t('chat.online') : t('chat.offline');
      } else {

      }
    } else {

    }
  }

  // Fonction pour mettre à jour le statut en ligne (fallback polling seulement)
  async function updateOnlineStatus() {
    // Ne faire le fallback que si le WebSocket n'est pas actif
    try {
      const friends = await api('/users/friends');
      const friendIds = friends.friends.map((f: any) => f.id);
      
      if (friendIds.length > 0) {
        const statusResponse = await api('/users/online-status', {
          method: 'POST',
          body: JSON.stringify({ userIds: friendIds }),
          headers: {
            'Content-Type': 'application/json'
          }
        });

        // Utiliser la fonction existante updateFriendStatus pour éviter la duplication
        Object.entries(statusResponse.status).forEach(([friendId, isOnline]) => {
          updateFriendStatus(parseInt(friendId), isOnline as boolean);
        });
      }
    } catch (error) {

    }
  }

  // Charger les données initiales
  try {
    await api("/auth/me");
    await refreshAllLists(); // Charger toutes les listes au démarrage
    startGlobalListeners(); // Écouter les événements WebSocket globaux
    
    // Fallback pour le statut en ligne (réduit car WebSocket est prioritaire)
    const statusUpdateInterval = setInterval(updateOnlineStatus, 60000);
    
    // Cleanup function centralisée
    const cleanup = () => {
      stopGlobalListeners();
      clearInterval(statusUpdateInterval);
      if (searchTimeout) clearTimeout(searchTimeout);

    };
    
    // Arrêter l'écoute quand l'utilisateur quitte la page ou change de vue
    window.addEventListener('beforeunload', cleanup);
    
    // Observer pour nettoyer si l'élément est supprimé du DOM
    const observer = new MutationObserver(() => {
      if (!document.contains(wrap)) {
        cleanup();
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    
  } catch (error) {
    content.innerHTML = `
      <div class="bg-prem rounded-lg shadow-xl p-6 text-center">
        <p class="font-sans text-text mb-4">${t('auth.loginRequired')}</p>
        <a href="/login" class="inline-block bg-sec hover:bg-opacity-80 text-text font-sans font-bold py-2 px-6 rounded-lg transition">
          ${t('auth.loginButton')}
        </a>
      </div>
    `;
  }

  return wrap;
}