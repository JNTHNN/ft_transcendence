# 🎨 Guide des Couleurs

## Palette de couleurs du projet

### Couleurs principales

- **Couleur principale (mainColor)** : `#06492D` 
  - Vert foncé
  - Utilisée pour : fond principal, sidebar, cartes
  
- **Couleur secondColoraire (secondColorary)** : `#BB5522`
  - Orange/Cuivre
  - Utilisée pour : boutons, bordures, accents, titres
  
- **Couleur de texte (Text)** : `#FFFFFF`
  - Blanc
  - Utilisée pour : tout le texte de l'application

## Utilisation dans Tailwind

Les couleurs sont configurées dans `tailwind.config.js` et peuvent être utilisées avec les classes :

```html
<!-- Fond -->
<div class="bg-mainColor">...</div>
<div class="bg-secondColorary">...</div>

<!-- Texte -->
<p class="text-text">...</p>
<h1 class="text-secondColorary">...</h1>

<!-- Bordures -->
<div class="border-secondColorary">...</div>
<div class="border-text">...</div>

<!-- Hover -->
<button class="hover:bg-secondColorary">...</button>
```

## Exemples d'utilisation

### Carte
```typescript
Template.card('Titre', 'Contenu')
// Génère une carte avec:
// - Fond: #06492D (mainColor)
// - Bordure: #BB5522 (secondColorary)
// - Titre: #BB5522 (secondColorary)
// - Texte: #FFFFFF (text)
```

### Bouton
```typescript
Template.button('Cliquez-moi')
// Génère un bouton avec:
// - Fond: #BB5522 (secondColorary)
// - Texte: #FFFFFF (text)
// - Hover: orange plus clair
```

### Menu
```typescript
// Menu avec:
// - Fond: #06492D (mainColor)
// - Texte: #FFFFFF (text)
// - Hover: #BB5522 (secondColorary)
// - Bordure active: #FFFFFF (text)
```
