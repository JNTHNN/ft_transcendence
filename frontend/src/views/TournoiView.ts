import { Template } from '../template';
import { menu } from '../menu';

// Vue pour la page de tournoi
export async function TournoiView(): Promise<string> {
  const isLoggedIn = menu.getLoggedIn();

  if (!isLoggedIn) {
    return `
      <div class="max-w-4xl mx-auto">
        ${Template.card(
          'Tournoi',
          '<p class="text-center">Vous devez être connecté pour participer aux tournois.</p>'
        )}
      </div>
    `;
  }

  const tournoiActifs = [
    'Tournoi Hebdomadaire - 128 joueurs',
    'Championnat du Mois - 256 joueurs',
    'Coupe des Débutants - 64 joueurs'
  ];

  const tournoisCard = Template.card(
    'Tournois Actifs',
    Template.list(tournoiActifs) + '<div class="mt-4">' + Template.button('Rejoindre un tournoi', '', 'w-full') + '</div>'
  );

  const mesInscriptions = Template.card(
    'Mes Inscriptions',
    '<p class="text-center text-gray-300">Vous n\'êtes inscrit à aucun tournoi pour le moment.</p>'
  );

  return `
    <div class="max-w-6xl mx-auto">
      <div class="mb-8">
        ${Template.card(
          'Tournois',
          '<p>Participez à des tournois et grimpez dans le classement !</p>'
        )}
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        ${tournoisCard}
        ${mesInscriptions}
      </div>
    </div>
  `;
}
