// Système de templates pour éviter le HTML hard-codé
export interface TemplateData {
  [key: string]: string | number | boolean;
}

export class Template {
  // Créer un template avec des variables dynamiques
  static render(template: string, data: TemplateData = {}): string {
    let result = template;
    
    // Remplacer les variables {{variable}} par leurs valeurs
    Object.keys(data).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, String(data[key]));
    });
    
    return result;
  }

  // Template pour une carte
  static card(title: string, content: string, classes: string = ''): string {
    return `
      <div class="bg-prem rounded-lg shadow-lg p-6 ${classes}">
        <h2 class="text-2xl font-bold text-text mb-4">${title}</h2>
        <div class="text-text">${content}</div>
      </div>
    `;
  }

  // Template pour un bouton
  static button(text: string, onClick: string = '', classes: string = ''): string {
    return `
      <button 
        onclick="${onClick}" 
        class="bg-second hover:bg-opacity-80 text-text font-bold py-2 px-4 rounded transition-colors ${classes}"
      >
        ${text}
      </button>
    `;
  }

  // Template pour un conteneur de grille
  static grid(items: string[], columns: number = 2): string {
    return `
      <div class="grid grid-cols-1 md:grid-cols-${columns} gap-6">
        ${items.join('')}
      </div>
    `;
  }

  // Template pour une liste
  static list(items: string[], ordered: boolean = false): string {
    const tag = ordered ? 'ol' : 'ul';
    const listItems = items.map(item => `<li class="mb-2">${item}</li>`).join('');
    
    return `
      <${tag} class="text-text list-disc list-inside">
        ${listItems}
      </${tag}>
    `;
  }
}
