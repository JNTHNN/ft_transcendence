# FT_TRANSCENDENCE — État d’avancement (équipe)  
_MAJ: 05-11-2025 22:46._

## 👥 TEAM
- **jgasparo** — Front-end (TypeScript, Tailwind CSS)
- **mleonet** — Backend/Infra + Blockchain (Solidity/Avalanche) + AI
- **abolor-e** — (en réflexion / doit rendre Inception)

---

## 🎯 Modules (rappel de la roadmap 42 + ajouts)
- **Web**
  - _Minor_: Framework / toolkit front-end
  - _Major_: Stocker les scores de tournois **on-chain**
- **User Management**
  - _Major_: Auth standard, gestion d’utilisateurs multi-tournois
- **Gameplay & UX**
  - _Major_: Joueurs distants (temps réel)
  - _Major_: Second jeu + historique + matchmaking
  - _Major_: **Live chat**
- **AI-Algo**
  - _Major_: Adversaire IA
- **Accessibilité**
  - _Minor_: Support multi-devices, compatibilité navigateurs, i18n
- **Ajouts techniques réalisés** : Fastify, Docker, Traefik, TLS, CORS, cookies sécurisés

---

## ✅ Avancement par domaine

| Domaine | Objectif | Responsable | Statut | Commentaire |
|---|---|---|---|---|
| **Infrastructure (Docker + Traefik + HTTPS)** | Stack complète (frontend, backend, proxy), certs `mkcert`, CORS/cookies | **mleonet** | ✅ **100%** | Infra propre, modulaire, persistante, HTTPS local OK |
| **Backend (Fastify API)** | API REST (auth, users, health), Argon2, JWT, cookies `HttpOnly`, SQLite | **mleonet** | ✅ **100%** | Auth complète, rotation refresh, CORS maîtrisé |
| **Frontend (TS + Tailwind)** | UI responsive, pages Login/Signup, intégration API, routing | **jgasparo** | ✅ **60%** | Auth OK, page profil et session/refresh auto à finaliser |
| **Auth & Sessions (front)** | Refresh silencieux + logout + session stable | **jgasparo** | ⚙️ **En cours** | Refresh API OK, logique front à automatiser |
| **User Management étendu** | Historique, stats, avatars, amis, matchmaking | **team** | 🕓 **10%** | Back prêt, endpoints métier à ajouter |
| **Gameplay (Pong temps réel)** | WebSocket/Socket.io, matchmaking, collisions, scores | **team** | 🕓 **0%** | Prochain gros jalon |
| **Live Chat** | WS multi-room | **team** | 🕓 **0%** | À faire après base temps réel du jeu |
| **OAuth 42** | Login via API 42 | **mleonet** | 🕓 **0%** | Simple à brancher sur base actuelle |
| **AI (Pong bot)** | IA adversaire (difficulté adaptative) | **mleonet** | 🕓 **0%** | Après jeu temps réel |
| **Blockchain (Avalanche)** | Smart contract scores finaux + intégration | **mleonet** | 🕓 **0%** | Module web3 en fin de parcours |
| **Accessibilité & i18n** | Multi-device, compatibilité navigateurs, i18n | **jgasparo** | 🕓 **30%** | Tailwind OK, reste textes & breakpoints |
| **Bonus UI/UX** | Transitions, animations, scoreboards | **jgasparo** | 🕓 **10%** | À polir après gameplay |

---

## 📊 Progression pondérée

| Module | Poids | Avancement | Pondéré |
|---|---:|---:|---:|
| **Infra + Backend Core** | 25% | 100% | **25%** |
| **Auth + User Management** | 20% | 80% | **16%** |
| **Frontend / UI / UX** | 15% | 60% | **9%** |
| **Pong + WebSockets** | 25% | 0% | **0%** |
| **Blockchain + AI + Chat + Bonus** | 15% | 0% | **0%** |

**Total estimé : ~50–55%** (socle technique complet, features “fun” à venir).

---

## 🚀 Prochaines étapes (priorisées)

1. **Front — refresh automatique du token** (intercepter 401, appeler `/auth/refresh`, rejouer la requête).
2. **Page “Profil”** : `/auth/me` + bouton **Logout** + statut connecté/déconnecté.
3. **Pong temps réel** : serveur WS (matchmaking), canvas front, collisions, scoreboard.
4. **Live Chat** (réutilise l’infra WS du jeu).
5. **OAuth 42** (flow complet + mapping user local).
6. **AI Pong** (IA adversaire) — module AI-Algo.
7. **Blockchain Avalanche** (scores on-chain) — module Web3.

---

## 🔐 Sécurité & bonnes pratiques (déjà en place)

- Hashing **Argon2id** (m=64MiB, t=3, p=4), JWT 15 min, refresh 7 jours (rotation), cookies `HttpOnly` `Secure` `SameSite=None` `Partitioned`.
- CORS strict (`Origin: app.localhost`) et HTTPS via Traefik (`mkcert`).
- DB SQLite persistante via volume Docker, migrations auto.

---

## 🧭 Récap express
- **Socle terminé** (infra + auth + API) → ✅ prêt pour fonctionnalités temps réel.
- **À faire** : refresh auto front, profil, **Pong**, **Chat**, **OAuth 42**, **AI**, **Blockchain**.
- Objectif sprint prochain : **Pong jouable en ligne + profil user**.

---

## 🗂️ Structure du projet et rôle de chaque fichier

### 🏠 Racine
- **README.md** — Documentation d’installation et d’usage du projet.
- **app.sqlite** — Base SQLite locale (ne pas versionner).
- **docker-compose.yml** — Lance `api`, `frontend`, et `traefik`.
- **roadmap.md** — Plan général du projet.
- **state.md** — État d’avancement (ce fichier).

### ⚙️ API (Backend)
- **Dockerfile** — Image Node pour Fastify + SQLite.
- **package.json** — Dépendances et scripts.
- **src/index.ts** — Point d’entrée du serveur Fastify (CORS, JWT, cookies, routes).
- **src/auth/routes.ts** — Auth complète (signup/login/me/refresh/logout).
- **src/users/routes.ts** — Gestion des utilisateurs (`GET /users`, `PATCH /users/me`).
- **src/middleware/auth.ts** — Middleware de vérification JWT.
- **src/db/** — Connexion SQLite, migrations, schéma SQL (`users`, `refresh_tokens`).
- **src/chat/ws.ts** — Base WebSocket pour futur chat temps réel.
- **src/game/ws.ts** — Base WebSocket pour futur jeu Pong.
- **src/core/security.ts** — Helpers de sécurité et CORS.

### 🌐 Frontend
- **Dockerfile** — Build Vite → Nginx.
- **index.html** — Entrée de l’app (mount Vite).
- **nginx.conf** — Conf Nginx SPA.
- **src/apiClient.ts** — Client HTTP (fetch + credentials, gestion CORS/cookies).
- **src/router.ts** — Routes SPA.
- **src/views/** — Pages Login, Signup, Chat, Tournaments, Match.
- **src/wsClient.ts** — Connexion WebSocket (chat/jeu).

### 🧱 Traefik
- **traefik.yml** — Entrypoints + providers statiques.
- **dynamic.yml** — Certificats TLS dynamiques (mkcert).
- **certs/** — Certificats `app.localhost` / `api.localhost` (ignore Git).

### ⛓️ Blockchain
- **contracts/Scores.sol** — Smart contract scores de tournoi.
- **scripts/deploy.ts** — Script Hardhat de déploiement.
- **hardhat.config.ts** — Configuration compiler + réseaux.
- **.env.example** — Modèle variables d’environnement (clé privée, RPC).

### 🧩 Fixtures
- **users.json / tournaments.json / matches.json** — Données de test.
- **snapshots/sample_match.json** — Exemple de match sauvegardé.