import { GameManager } from '../GameManager.js';
import { DummyAI } from '../IA/DummyAI.js';
import type { PlayerConfig } from '../types.js';

console.log('🎮 Test du GameManager\n');

const manager = GameManager.getInstance();

// Test 1 : Créer une partie
console.log('1️⃣ Création d\'une partie solo vs IA');
const matchId = manager.createGame('solo-vs-ai');
console.log(`   Match ID: ${matchId}`);
console.log('   ✅ Partie créée\n');

// Test 2 : Ajouter des joueurs
console.log('2️⃣ Ajout de joueurs');

const humanPlayer: PlayerConfig = {
  id: 'player-1',
  side: 'left',
  controllerType: 'human-arrows',
};

const aiPlayer: PlayerConfig = {
  id: 'ai-opponent',
  side: 'right',
  controllerType: 'ai',
  aiController: new DummyAI(),
};

manager.addPlayerToGame(matchId, humanPlayer);
console.log('   Joueur humain ajouté');

manager.addPlayerToGame(matchId, aiPlayer);
console.log('   IA ajoutée');
console.log('   ✅ Partie démarrée automatiquement\n');

// Test 3 : Récupérer la partie
console.log('3️⃣ Récupération de la partie');
const game = manager.getGame(matchId);
console.log(`   Partie trouvée: ${game?.id}`);
console.log(`   Active: ${game?.isActive()}`);
console.log('   ✅ Partie récupérée\n');

// Test 4 : Lister les parties
console.log('4️⃣ Liste des parties');
const games = manager.listGames();
console.log(`   Nombre de parties: ${games.length}`);
console.log('   ', games);
console.log('   ✅ Parties listées\n');

// Test 5 : Stats
console.log('5️⃣ Statistiques');
const stats = manager.getStats();
console.log('   ', stats);
console.log('   ✅ Stats récupérées\n');

// Attendre 3 secondes puis nettoyer
setTimeout(() => {
  console.log('6️⃣ Nettoyage');
  manager.removeGame(matchId);
  const statsAfter = manager.getStats();
  console.log('   Stats après nettoyage:', statsAfter);
  console.log('   ✅ Partie supprimée\n');
  
  console.log('✨ Tous les tests passés!');
  process.exit(0);
}, 3000);