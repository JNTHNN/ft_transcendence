import './style.css';
import { router } from './router';
import { menuManager } from './views/Menu';

// Initialiser le menu (se fait automatiquement via l'import)
menuManager;

// Démarrer le router
router.start();

