import './style.css';
import { router } from './router';
import { demoAuth } from './demoAuth';

// Démarrer le router
router.start();

// Initialiser le bouton mode démo
function initDemoMode() {
  const demoBtn = document.getElementById('demo-mode-btn');
  const demoStatus = document.getElementById('demo-status');
  
  if (!demoBtn || !demoStatus) return;
  
  // Mettre à jour l'UI au chargement
  updateDemoUI();
  
  demoBtn.addEventListener('click', () => {
    if (demoAuth.isActive()) {
      demoAuth.disableDemoMode();
      alert('Mode démo désactivé. Vous devez vous connecter avec un vrai compte.');
      router.navigate('/login');
    } else {
      demoAuth.enableDemoMode();
      alert('Mode démo activé ! Vous pouvez maintenant accéder à toutes les fonctionnalités.');
      router.navigate('/profil');
    }
    updateDemoUI();
  });
  
  function updateDemoUI() {
    if (demoAuth.isActive()) {
      demoBtn.textContent = '🔓 Quitter le mode démo';
      demoBtn.classList.remove('bg-sec');
      demoBtn.classList.add('bg-green-600');
      demoStatus.classList.remove('hidden');
    } else {
      demoBtn.textContent = '🎭 Mode Démo';
      demoBtn.classList.remove('bg-green-600');
      demoBtn.classList.add('bg-sec');
      demoStatus.classList.add('hidden');
    }
  }
}

// Initialiser après le chargement du DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDemoMode);
} else {
  initDemoMode();
}

