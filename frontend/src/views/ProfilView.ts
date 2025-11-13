import { Template } from '../template';
import { menu } from '../menu';

// Vue pour la page de profil
export async function ProfilView(): Promise<string> {
  const isLoggedIn = menu.getLoggedIn();

  if (!isLoggedIn) {
    return `
      <div class="max-w-4xl mx-auto">
        ${Template.card(
          'Profil',
          '<p class="text-center">Vous devez être connecté pour accéder à votre profil.</p>'
        )}
      </div>
    `;
  }

  const userInfo = [
    'Nom d\'utilisateur: Joueur123',
    'Email: joueur@example.com',
    'Parties jouées: 42',
    'Victoires: 28',
    'Ratio: 66.7%'
  ];

  return `
    <div class="max-w-4xl mx-auto">
      ${Template.card('Mon Profil', Template.list(userInfo))}
      
      <div class="mt-8">
        ${Template.card(
          'Statistiques',
          '<div class="grid grid-cols-3 gap-4 text-center"><div><div class="text-3xl font-bold">42</div><div class="text-sm">Parties</div></div><div><div class="text-3xl font-bold">28</div><div class="text-sm">Victoires</div></div><div><div class="text-3xl font-bold">14</div><div class="text-sm">Défaites</div></div></div>'
        )}
      </div>
    </div>
  `;
}
