import './style.css';
import { router } from './router';
import { menu } from './menu';
import { MenuView } from './views/MenuView';
import { ProfilView } from './views/ProfilView';
import { PartieView } from './views/PartieView';
import { TournoiView } from './views/TournoiView';

// Configuration des routes
router.addRoute('/', MenuView);
router.addRoute('/profil', ProfilView);
router.addRoute('/partie', PartieView);
router.addRoute('/tournoi', TournoiView);

// Initialisation de l'application
async function initApp() {
  console.log('🚀 Application SPA initialisée');
  
  // Initialiser le menu
  menu.render();
  
  // Initialiser le router
  await router.init();
}

// Démarrer l'application quand le DOM est prêt
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
