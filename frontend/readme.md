# SPA - TypeScript & Tailwind CSS

## 📋 Description du projet

Application SPA (Single Page Application) développée avec TypeScript et Tailwind CSS uniquement.

### Fonctionnalités

- ✅ **SPA** avec système de routing personnalisé
- ✅ **Navigation par historique** - Support des boutons Précédent/Suivant du navigateur
- ✅ **Menu vertical** avec 5 sections : Menu, Profil, Partie, Tournoi, Se Connecter/Déconnexion
- ✅ **Système de templates** pour éviter le HTML hard-codé
- ✅ **Docker** pour conteneuriser l'application
- ✅ **Palette de couleurs personnalisée** :
  - Couleur principale : `#06492D`
  - Couleur secondColoraire : `#BB5522`
  - Couleur d'écriture : `#FFFFFF`

## 🚀 Installation et démarrage

### Option 1 : Avec Docker (Recommandé)

```bash
# Construire et démarrer l'application
docker-compose up --build

# L'application sera accessible sur http://localhost:3000
```

### Option 2 : Sans Docker

```bash
# Installer les dépendances
npm install

# Démarrer le serveur de développement
npm run dev

# L'application sera accessible sur http://localhost:3000
```

## 📁 Structure du projet

```
frontend/
├── src/
│   ├── views/           # Vues de l'application
│   │   ├── MenuView.ts
│   │   ├── ProfilView.ts
│   │   ├── PartieView.ts
│   │   └── TournoiView.ts
│   ├── router.ts        # Système de routing SPA
│   ├── menu.ts          # Gestion du menu vertical
│   ├── template.ts      # Système de templates
│   ├── main.ts          # Point d'entrée de l'application
│   └── style.css        # Styles CSS personnalisés
├── index.html           # Page HTML principale
├── Dockerfile           # Configuration Docker
├── docker-compose.yml   # Orchestration Docker
├── package.json         # Dépendances npm
├── tsconfig.json        # Configuration TypeScript
├── tailwind.config.js   # Configuration Tailwind CSS
└── vite.config.ts       # Configuration Vite
```

## 🛠️ Technologies utilisées

- **TypeScript** - Langage de programmation
- **Tailwind CSS** - Framework CSS
- **Vite** - Build tool et serveur de développement
- **Docker** - Conteneurisation

## 🎨 Architecture

### Router
Le système de routing personnalisé permet :
- Navigation sans rechargement de page
- Support de l'API History pour les boutons Précédent/Suivant
- Routes dynamiques avec composants asynchrones

### Templates
Système de templates modulaire pour :
- Éviter le HTML hard-codé
- Réutilisation de composants
- Génération dynamique de contenu

### Menu
Menu vertical avec :
- Navigation entre les sections
- État de connexion dynamique
- Animations de transition

## 📝 Scripts disponibles

```bash
npm run dev      # Démarrer le serveur de développement
npm run build    # Compiler l'application pour la production
npm run preview  # Prévisualiser la version de production
```

## 🐳 Commandes Docker

```bash
docker-compose up          # Démarrer l'application
docker-compose up --build  # Reconstruire et démarrer
docker-compose down        # Arrêter l'application
```

## 🔄 Navigation

L'application supporte la navigation via :
- Menu latéral gauche
- Boutons Précédent/Suivant du navigateur
- Barre d'adresse du navigateur

## 🔐 Authentification

Le système de connexion/déconnexion est simulé. Certaines pages nécessitent d'être "connecté" pour y accéder (Profil, Partie, Tournoi).

---

**Développé avec TypeScript et Tailwind CSS** 🚀