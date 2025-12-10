import './style.css';
import { router } from './router';
import { menuManager } from './views/Menu';
import { authManager } from './auth';
import { i18n, t } from './i18n/index.js';
import { connectWS } from './ws-client.js';
import { WEBSOCKET_PATHS } from './constants.js';
import { renderFooter } from './views/footer';

const initApp = async () => {
  i18n.initialize().then(() => {
    window.dispatchEvent(new CustomEvent('i18nReady'));
  });

  if (authManager.isLoading()) {
    const loadingElement = document.createElement('div');
    loadingElement.className = 'flex items-center justify-center min-h-screen bg-bg text-text';
    loadingElement.innerHTML = `
      <div class="text-center">
        <div class="animate-spin rounded-full h-16 w-16 border-b-2 border-sec mx-auto mb-4"></div>
        <p class="font-sans text-lg">${t('common.loading')}</p>
      </div>
    `;
    document.body.appendChild(loadingElement);

    setTimeout(initApp, 100);
    return;
  }

  const loadingElements = document.querySelectorAll('.flex.items-center.justify-center.min-h-screen');
  loadingElements.forEach(el => el.remove());

  menuManager;
  addFooterToPage();


  // Démarrer le WebSocket friends global si l'utilisateur est connecté
  if (authManager.isAuthenticated()) {
    startGlobalFriendsWebSocket();
  }

  router.start();
};

function addFooterToPage() {
  // Vérifier si le footer existe déjà
  const footerContainer = document.getElementById('footer-container');
  
  if (footerContainer) {
	footerContainer.innerHTML = renderFooter();
  }
}

window.addEventListener('languageChanged', () => {
  addFooterToPage();
});


// WebSocket friends global
let globalFriendsWebSocket: WebSocket | null = null;

function startGlobalFriendsWebSocket() {
  
  globalFriendsWebSocket = connectWS(WEBSOCKET_PATHS.FRIENDS, (message) => {
    
    // Dispatcher TOUS les événements friends globalement
    const event = new CustomEvent('friendsWebSocketMessage', {
      detail: message
    });
    window.dispatchEvent(event);
    
    // Dispatcher aussi les événements de changement de statut spécifiquement
    if (message.type === 'friend_status_changed') {
      const statusEvent = new CustomEvent('friendStatusChanged', {
        detail: {
          userId: message.data.userId,
          isOnline: message.data.isOnline,
          timestamp: message.data.timestamp
        }
      });
      window.dispatchEvent(statusEvent);
    }
  }, true);
}

function stopGlobalFriendsWebSocket() {
  if (globalFriendsWebSocket) {
    globalFriendsWebSocket.close();
    globalFriendsWebSocket = null;
  }
}

// Écouter les changements d'authentification pour démarrer/arrêter le WebSocket
window.addEventListener('authChanged', (event: any) => {
  if (event.detail.isAuthenticated) {
    startGlobalFriendsWebSocket();
  } else {
    stopGlobalFriendsWebSocket();
  }
});

// Nettoyer lors de la fermeture de la page
window.addEventListener('beforeunload', () => {
  stopGlobalFriendsWebSocket();
});

initApp();
