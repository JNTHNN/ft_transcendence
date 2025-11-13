import { Template } from '../template';
import { menu } from '../menu';

// Vue pour la page de partie
export async function PartieView(): Promise<string> {
  const isLoggedIn = menu.getLoggedIn();

  if (!isLoggedIn) {
    return `
      <div class="max-w-4xl mx-auto">
        ${Template.card(
          'Partie',
          '<p class="text-center">Vous devez être connecté pour jouer une partie.</p>'
        )}
      </div>
    `;
  }

  const parties = [
    Template.card('Partie Rapide', '<p>Commencez une partie rapide contre l\'ordinateur.</p><div class="mt-4">' + Template.button('Jouer', '', 'w-full') + '</div>'),
    Template.card('Partie Multijoueur', '<p>Jouez contre un autre joueur en ligne.</p><div class="mt-4">' + Template.button('Chercher un adversaire', '', 'w-full') + '</div>'),
    Template.card('Partie Personnalisée', '<p>Créez une partie avec vos propres règles.</p><div class="mt-4">' + Template.button('Créer', '', 'w-full') + '</div>')
  ];

  return `
    <div class="max-w-6xl mx-auto">
      <div class="mb-8">
        ${Template.card('Modes de Jeu', '<p>Choisissez votre mode de jeu préféré</p>')}
      </div>
      
      ${Template.grid(parties, 3)}
    </div>
  `;
}
