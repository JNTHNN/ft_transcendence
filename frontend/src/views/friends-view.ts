import { api } from "../api-client";
import { authManager } from "../auth";
import { router } from "../router";
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
  if (!authManager.isAuthenticated()) {
    router.navigate("/login");
    return document.createElement("div");
  }
  
  const wrap = document.createElement("div");
  wrap.className = "max-w-6xl mx-auto mt-4 md:mt-8 p-4 md:p-0";

  wrap.innerHTML = `
    <div class="flex justify-between items-center mb-4 md:mb-6">
      <h1 class="font-display font-black text-2xl md:text-3xl lg:text-4xl font-bold text-text">${t('friends.title')}</h1>
    </div>

    <div id="friends-content">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        <!-- Liste des amis -->
        <div class="bg-prem rounded-lg shadow-xl p-4 md:p-6">
          <h2 class="font-display text-xl md:text-2xl font-bold text-text mb-4">${t('friends.myFriends')}</h2>
          <div id="friends-list" class="space-y-3">
            <div class="flex items-center justify-center py-8">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-sec"></div>
            </div>
          </div>
        </div>

        <!-- Demandes reçues -->
        <div class="bg-prem rounded-lg shadow-xl p-4 md:p-6">
          <h2 class="font-display text-xl md:text-2xl font-bold text-text mb-4">${t('friends.friendRequests')}</h2>
          <div id="friend-requests-list" class="space-y-3">
            <div class="flex items-center justify-center py-8">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-sec"></div>
            </div>
          </div>
        </div>

        <!-- Demandes envoyées (en attente) -->
        <div class="bg-prem rounded-lg shadow-xl p-4 md:p-6">
          <h2 class="font-display text-xl md:text-2xl font-bold text-text mb-4">${t('friends.pendingRequests')}</h2>
          <div id="sent-requests-list" class="space-y-3">
            <div class="flex items-center justify-center py-8">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-sec"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Recherche d'amis -->
      <div class="bg-prem rounded-lg shadow-xl p-4 md:p-6 mt-4 md:mt-6">
        <h2 class="font-display text-xl md:text-2xl font-bold text-text mb-4">${t('friends.findFriends')}</h2>
        <div class="flex flex-col sm:flex-row gap-3 mb-4">
          <input 
            type="text" 
            id="search-input"
            placeholder="${t('friends.searchPlaceholder')}"
            class="flex-1 px-3 md:px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-text placeholder-gray-400 focus:outline-none focus:border-sec text-sm md:text-base"
          >
          <button 
            id="search-button"
            class="bg-sec hover:bg-opacity-80 text-text px-4 md:px-6 py-2 rounded-lg font-bold transition text-sm md:text-base w-full sm:w-auto"
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

  let searchTimeout: ReturnType<typeof setTimeout>;
  let isRefreshing = false;
  let lastSearchQuery = '';
  let globalStatusListener: ((event: Event) => void) | null = null;
  let globalFriendsListener: ((event: Event) => void) | null = null;

  async function loadFriends() {
    try {
      const response = await api("/users/friends");
      const friends: Friend[] = response.friends;

      const apiBaseUrl = (import.meta as any).env?.VITE_API_BASE_URL || "https://api.localhost:8443";
      friends.forEach(friend => {
        if (friend.avatarUrl && friend.avatarUrl.startsWith('/uploads/')) {
          friend.avatarUrl = `${apiBaseUrl}${friend.avatarUrl}`;
        }
      });

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
                <div class="w-2 h-2 rounded-full flex-shrink-0 status-dot ${friend.status === 'online' ? 'bg-green-400' : 'bg-gray-500'}"></div>
                <span class="text-xs status-text ${friend.status === 'online' ? 'text-green-400' : 'text-gray-500'}">${friend.status === 'online' ? t('chat.online') : t('chat.offline')}</span>
              </div>
              <p class="text-xs text-gray-400 mt-1">${t('friends.friendsSince')} ${new Date(friend.friendsSince).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
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

  async function loadFriendRequests() {
    try {
      const response = await api("/users/friend-requests");
      const requests: FriendRequest[] = response.requests;

      const apiBaseUrl = (import.meta as any).env?.VITE_API_BASE_URL || "https://api.localhost:8443";
      requests.forEach(request => {
        if (request.avatarUrl && request.avatarUrl.startsWith('/uploads/')) {
          request.avatarUrl = `${apiBaseUrl}${request.avatarUrl}`;
        }
      });

      if (requests.length === 0) {
        requestsList.innerHTML = `
          <div class="text-center py-8">
            <p class="text-gray-400">${t('friends.noRequests')}</p>
          </div>
        `;
        return;
      }

      requestsList.innerHTML = requests.map(request => `
        <div class="flex items-center justify-between p-4 bg-sec bg-opacity-20 rounded-lg hover:bg-opacity-30 transition-colors" data-request-id="${request.requestId}">
          <div class="flex items-center space-x-3 flex-1 min-w-0">
            <div class="w-12 h-12 rounded-full border-2 border-sec overflow-hidden bg-gray-600 flex items-center justify-center flex-shrink-0">
              ${request.avatarUrl 
                ? `<img class="w-full h-full object-cover" src="${request.avatarUrl}" alt="${request.displayName}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
                   <div class="w-full h-full bg-sec flex items-center justify-center text-text font-bold" style="display:none">${request.displayName[0].toUpperCase()}</div>`
                : `<div class="w-full h-full bg-sec flex items-center justify-center text-text font-bold">${request.displayName[0].toUpperCase()}</div>`
              }
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-semibold text-text truncate">${request.displayName}</p>
              <p class="text-xs text-gray-400 mt-1">${new Date(request.requestDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
            </div>
          </div>
          <div class="flex flex-col space-y-1 ml-3 flex-shrink-0">
            <button 
              onclick="viewProfile(${request.id}, '${request.displayName}', '${request.avatarUrl || ''}')"
              class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-medium transition whitespace-nowrap"
            >
              ${t('friends.viewProfile')}
            </button>
            <button 
              onclick="acceptFriendRequest(${request.requestId})"
              class="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-xs font-medium transition whitespace-nowrap"
            >
              ${t('friends.accept')}
            </button>
            <button 
              onclick="declineFriendRequest(${request.requestId})"
              class="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded text-xs font-medium transition whitespace-nowrap"
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

  async function loadSentRequests() {
    try {
      const response = await api("/users/sent-requests");
      const sentRequests: SentRequest[] = response.sentRequests;

      const apiBaseUrl = (import.meta as any).env?.VITE_API_BASE_URL || "https://api.localhost:8443";
      sentRequests.forEach(request => {
        if (request.avatarUrl && request.avatarUrl.startsWith('/uploads/')) {
          request.avatarUrl = `${apiBaseUrl}${request.avatarUrl}`;
        }
      });

      if (sentRequests.length === 0) {
        sentRequestsList.innerHTML = `
          <div class="text-center py-8">
            <p class="text-gray-400">${t('friends.noPendingRequests')}</p>
          </div>
        `;
        return;
      }

      sentRequestsList.innerHTML = sentRequests.map(request => `
        <div class="flex items-center justify-between p-4 bg-sec bg-opacity-20 rounded-lg hover:bg-opacity-30 transition-colors" data-sent-request-id="${request.id}">
          <div class="flex items-center space-x-3 flex-1 min-w-0">
            <div class="w-12 h-12 rounded-full border-2 border-sec overflow-hidden bg-gray-600 flex items-center justify-center flex-shrink-0">
              ${request.avatarUrl 
                ? `<img class="w-full h-full object-cover" src="${request.avatarUrl}" alt="${request.displayName}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
                   <div class="w-full h-full bg-sec flex items-center justify-center text-text font-bold" style="display:none">${request.displayName[0].toUpperCase()}</div>`
                : `<div class="w-full h-full bg-sec flex items-center justify-center text-text font-bold">${request.displayName[0].toUpperCase()}</div>`
              }
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-semibold text-text truncate">${request.displayName}</p>
              <p class="text-xs text-yellow-300 mt-1">${t('friends.pending')} • ${new Date(request.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
            </div>
          </div>
          <div class="flex flex-col space-y-1 ml-3 flex-shrink-0">
            <button 
              onclick="viewProfile(${request.userId}, '${request.displayName}', '${request.avatarUrl || ''}')"
              class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-medium transition whitespace-nowrap"
            >
              ${t('friends.viewProfile')}
            </button>
            <button 
              onclick="cancelFriendRequest(${request.id})"
              class="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded text-xs font-medium transition whitespace-nowrap"
            >
              ${t('friends.cancelRequest')}
            </button>
          </div>
        </div>
      `).join('');
    } catch (error) {
      sentRequestsList.innerHTML = `
        <div class="text-center py-8">
          <p class="text-red-400">${t('friends.loadError')}</p>
        </div>
      `;
    }
  }

  async function searchUsers() {
    const query = searchInput.value.trim();
    if (query.length < 2) {
      searchResults.innerHTML = `
        <div class="text-center py-4">
          <p class="text-gray-400">${t('friends.searchTooShort')}</p>
        </div>
      `;
      lastSearchQuery = ''; 
      return;
    }

    lastSearchQuery = query; 

    try {
      const response = await api(`/users/search?q=${encodeURIComponent(query)}`);
      const users: SearchUser[] = response.users;

      const apiBaseUrl = (import.meta as any).env?.VITE_API_BASE_URL || "https://api.localhost:8443";
      users.forEach(user => {
        if (user.avatarUrl && user.avatarUrl.startsWith('/uploads/')) {
          user.avatarUrl = `${apiBaseUrl}${user.avatarUrl}`;
        }
      });

      if (users.length === 0) {
        searchResults.innerHTML = `
          <div class="text-center py-4">
            <p class="text-gray-400">${t('friends.noResults')}</p>
          </div>
        `;
        return;
      }

      searchResults.innerHTML = users.map(user => `
        <div class="flex items-center justify-between p-3 bg-sec bg-opacity-20 rounded-lg gap-3">
          <div class="flex items-center space-x-3 flex-1 min-w-0">
            <div class="w-10 h-10 rounded-full border-2 border-sec overflow-hidden bg-gray-600 flex items-center justify-center flex-shrink-0">
              ${user.avatarUrl 
                ? `<img class="w-full h-full object-cover" src="${user.avatarUrl}" alt="${user.displayName}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
                   <div class="w-full h-full bg-sec flex items-center justify-center text-text font-bold" style="display:none">${user.displayName[0].toUpperCase()}</div>`
                : `<div class="w-full h-full bg-sec flex items-center justify-center text-text font-bold">${user.displayName[0].toUpperCase()}</div>`
              }
            </div>
            <div class="min-w-0 flex-1">
              <p class="font-semibold text-text truncate">${user.displayName}</p>
              <p class="text-sm text-gray-400">
                ${user.friendshipStatus === 'accepted' ? t('friends.alreadyFriends') :
                  user.friendshipStatus === 'pending' ? t('friends.requestPending') :
                  t('friends.notFriends')}
              </p>
            </div>
          </div>
          <div class="flex-shrink-0">
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

  searchButton.addEventListener('click', searchUsers);
  
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      const query = searchInput.value.trim();
      if (query.length >= 2) {
        searchUsers();
      } else if (query.length === 0) {
        searchResults.innerHTML = '';
      }
    }, 300); 
  });

  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      clearTimeout(searchTimeout);
      searchUsers();
    }
  });

  async function refreshSearchResults() {
    if (lastSearchQuery && lastSearchQuery.length >= 2) {

      await searchUsers();
    }
  }

  async function refreshAllLists() {
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
      await refreshSearchResults();

    } catch (error) {

    } finally {
      isRefreshing = false;
    }
  }

  function startGlobalListeners() {

    
    globalStatusListener = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { userId, isOnline } = customEvent.detail || {};
      
      if (userId && typeof isOnline === 'boolean') {

        updateFriendStatus(userId, isOnline);
      } else {

      }
    };
    
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
          if (message.data?.userId && typeof message.data?.isOnline === 'boolean') {
            console.log('Notification friend_status_changed reçue:', message.data);
            updateFriendStatus(message.data.userId, message.data.isOnline);
          }
          break;
          
        default:
          refreshAllLists();
      }
    };
    
    window.addEventListener('friendStatusChanged', globalStatusListener);
    window.addEventListener('friendsWebSocketMessage', globalFriendsListener);
  }

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

  (window as any).sendFriendRequest = async (userId: number) => {
    try {
      const response = await api(`/users/${userId}/friend-request`, { 
        method: 'POST',
        body: JSON.stringify({})
      });

      
      if (response.autoAccepted) {
        showNotification(` ${t('friends.mutualRequestAccepted')}`, 'success');
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
      showNotification(t('friends.friendRemoved'), 'success');
    } catch (error) {
      showNotification(t('friends.removeError'), 'error');
    }
  };

  (window as any).viewProfile = async (userId: number, userName: string, avatarUrl?: string) => {
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

      showNotification(t('friends.requestCanceled'), 'success');
    } catch (error) {

      showNotification(t('friends.cancelError'), 'error');
    }
  };

  function showNotification(message: string, type: 'success' | 'error' | 'info') {
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

  function updateFriendStatus(userId: number, isOnline: boolean) {
    const friendElement = friendsList.querySelector(`[data-friend-id="${userId}"]`);
    
    if (friendElement) {
      const statusDot = friendElement.querySelector('.status-dot');
      const statusText = friendElement.querySelector('.status-text');
      
      if (statusDot && statusText) {
        statusDot.className = `w-2 h-2 rounded-full flex-shrink-0 status-dot ${isOnline ? 'bg-green-400' : 'bg-gray-500'}`;
        statusText.className = `text-xs status-text ${isOnline ? 'text-green-400' : 'text-gray-500'}`;
        statusText.textContent = isOnline ? t('chat.online') : t('chat.offline');
        console.log(`Statut mis à jour pour userId ${userId}: ${isOnline ? 'online' : 'offline'}`);
      } else {
        console.warn(`Éléments de statut introuvables pour userId ${userId}`);
      }
    } else {
      console.log(`Ami avec userId ${userId} non trouvé dans la liste (peut-être pas encore chargé)`);
    }
  }

  async function updateOnlineStatus() {
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

        Object.entries(statusResponse.status).forEach(([friendId, isOnline]) => {
          updateFriendStatus(parseInt(friendId), isOnline as boolean);
        });
      }
    } catch (error) {

    }
  }

  try {
    await api("/auth/me");
    await refreshAllLists();
    startGlobalListeners();
    
    const statusUpdateInterval = setInterval(updateOnlineStatus, 60000);
    
    const cleanup = () => {
      stopGlobalListeners();
      clearInterval(statusUpdateInterval);
      if (searchTimeout) clearTimeout(searchTimeout);

    };
    
    window.addEventListener('beforeunload', cleanup);
    
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