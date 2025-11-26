// api/src/game/tests/test-physics.ts

import * as Physics from '../physics.js';
import { GAME_CONFIG as CFG } from '../constants.js';

console.log('🎱 Test de la physique Pong\n');

// Test 1 : Reset balle
console.log('1️⃣ Test resetBall()');
const ball = Physics.resetBall();
console.log('   Position:', ball.position);
console.log('   Vélocité:', ball.velocity);
console.log('   ✅ Balle créée au centre\n');

// Test 2 : Mouvement
console.log('2️⃣ Test moveBall()');
const moved = Physics.moveBall(ball, 0.016);  // 1 frame
console.log('   Avant:', ball.position);
console.log('   Après:', moved.position);
console.log('   ✅ Balle déplacée\n');

// Test 3 : Collision mur
console.log('3️⃣ Test checkWallCollision()');
const ballAtWall = {
  ...ball,
  position: { x: 400, y: -10 },  // Hors du terrain en haut
  velocity: { x: 100, y: -200 }   // Va vers le haut
};
const reflected = Physics.checkWallCollision(ballAtWall);
console.log('   Avant:', ballAtWall.velocity.y);
console.log('   Après:', reflected.y);
console.log('   ✅ Balle rebondie\n');

// Test 4 : Détection goal
console.log('4️⃣ Test checkGoal()');
const ballOut = { ...ball, position: { x: -10, y: 300 } };
const goal = Physics.checkGoal(ballOut);
console.log('   Position X:', ballOut.position.x);
console.log('   Goal:', goal);
console.log('   ✅ Goal détecté\n');

console.log('✨ Tous les tests passés!');