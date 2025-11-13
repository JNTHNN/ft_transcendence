import { Template } from '../template';

// Vue pour la page d'accueil / Menu
export async function MenuView(): Promise<string> {
  const content = `
    <p class="text-lg mb-4">
      Bienvenue dans l'application SPA ! Cette application est construite avec TypeScript et Tailwind CSS.
    </p>
    <p class="mb-4">
      Utilisez le menu à gauche pour naviguer entre les différentes sections.
    </p>
  `;

  return `
    <div class="max-w-4xl mx-auto">
      ${Template.card('Accueil', content)}
      
      <div class="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        ${Template.card(
          'Navigation SPA',
          '<p>Cette application utilise un système de routing personnalisé qui supporte les boutons Précédent et Suivant du navigateur.</p>'
        )}
        ${Template.card(
          'Style',
          '<p>Design avec Tailwind CSS et palette de couleurs personnalisée.</p>'
        )}
      </div>
    </div>
  `;
}
