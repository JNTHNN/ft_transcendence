# 🚀 Démarrage Rapide

## Lancer l'application avec Docker

```bash
docker-compose up --build
```

Puis ouvrez votre navigateur sur : http://localhost:3000

## Lancer l'application sans Docker

```bash
# 1. Installer les dépendances
npm install

# 2. Démarrer le serveur de développement
npm run dev
```

Puis ouvrez votre navigateur sur : http://localhost:3000

## 📖 Navigation

- Utilisez le menu vertical à gauche pour naviguer
- Cliquez sur "Se Connecter" pour accéder aux fonctionnalités protégées
- Les boutons Précédent/Suivant du navigateur fonctionnent !

## ✨ Fonctionnalités testables

1. **Navigation SPA** : Naviguez entre les pages sans rechargement
2. **Historique** : Utilisez les boutons Précédent/Suivant du navigateur
3. **Authentification** : Connectez-vous pour accéder au Profil, Partie et Tournoi
4. **Templates dynamiques** : Tout le contenu est généré via TypeScript
5. **Design responsive** : Fonctionne sur mobile et desktop

Bon développement ! 🎉


tailwind dev :
npx tailwindcss -i ./src/style.css -o ./dist/tailwind.css --watch
npx tsc --watch
npm run dev