# Utiliser une image Node.js comme base
FROM node:20-alpine

# Définir le répertoire de travail
WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances
RUN npm install

# Copier tous les fichiers du projet
COPY . .

# Exposer le port 3000
EXPOSE 3000

# Démarrer l'application en mode développement
CMD ["npm", "run", "dev"]
