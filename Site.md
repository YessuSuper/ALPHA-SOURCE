# 📘 ALPHA SOURCE — Documentation Complète du Site

---

## Table des Matières

1. [Présentation Générale](#1-présentation-générale)
2. [Public Cible & Objectifs](#2-public-cible--objectifs)
3. [Stack Technique](#3-stack-technique)
4. [Architecture du Projet](#4-architecture-du-projet)
5. [Systèmes Principaux](#5-systèmes-principaux)
   - 5.1 [Authentification & Onboarding](#51-authentification--onboarding)
   - 5.2 [Système de Points & Gamification](#52-système-de-points--gamification)
   - 5.3 [Système de Badges](#53-système-de-badges)
   - 5.4 [Intelligence Artificielle (Gemini)](#54-intelligence-artificielle-gemini)
   - 5.5 [Communauté](#55-communauté)
   - 5.6 [Messagerie Interne & Rescues](#56-messagerie-interne--rescues)
   - 5.7 [Cours (Dépôt & Évaluation)](#57-cours-dépôt--évaluation)
   - 5.8 [Boutique & Cosmétiques](#58-boutique--cosmétiques)
   - 5.9 [Intégration École Directe](#59-intégration-école-directe)
   - 5.10 [Modération & Administration](#510-modération--administration)
   - 5.11 [Défis Hebdomadaires](#511-défis-hebdomadaires)
6. [Pages du Site (Vue d'ensemble)](#6-pages-du-site-vue-densemble)
7. [Données & Fichiers JSON](#7-données--fichiers-json)
8. [Sécurité & Performance](#8-sécurité--performance)

---

## 1. Présentation Générale

**Alpha Source** est une plateforme web scolaire tout-en-un destinée aux élèves d'une classe (collège/lycée). Elle combine :

- Un **tableau de bord** personnalisé avec classement, devoirs et messages
- Un **chat IA** propulsé par Google Gemini, contextualisé avec les données scolaires de l'élève (notes, emploi du temps, devoirs)
- Un système de **communauté** complet (groupes, sujets, fils de discussion, messages privés)
- Un espace de **partage de cours** avec vote et évaluation par les pairs
- Une **messagerie interne** avec un système de "Rescue" (SOS cours)
- Une **boutique** de cosmétiques (thèmes visuels, fonds d'écran) achetables avec des points
- Une intégration avec **École Directe** (plateforme scolaire française) pour synchroniser notes, devoirs et emploi du temps
- Un système complet de **gamification** : points, badges (35+), streaks, défis collectifs, classement

Le site fonctionne comme un **réseau social scolaire gamifié** où chaque action (se connecter, poster un message, partager un cours, aider un camarade) rapporte des points et débloque des badges.

---

## 2. Public Cible & Objectifs

### Public
- **Élèves** d'une même classe (collège/lycée français)
- **Administrateurs** (2 comptes : "even" et "admin") pour la modération

### Objectifs
- **Entraide scolaire** : Permettre aux élèves de s'entraider via le partage de cours, les rescues et le chat IA
- **Engagement** : Motiver les élèves par la gamification (points, badges, classement, défis)
- **Centralisation** : Regrouper notes, devoirs, emploi du temps (via École Directe) et outils communautaires en un seul endroit
- **Autonomie** : Offrir un assistant IA capable de répondre aux questions scolaires en tenant compte du contexte réel de l'élève

---

## 3. Stack Technique

| Composant | Technologie |
|-----------|------------|
| **Backend** | Node.js + Express.js |
| **Frontend** | HTML5, CSS3, JavaScript vanilla |
| **IA** | Google Gemini 2.5 Flash (API) |
| **Graphiques** | Chart.js |
| **Upload fichiers** | Multer |
| **Base de données** | Fichiers JSON (pas de BDD relationnelle) |
| **Hashage mots de passe** | bcryptjs |
| **Authentification admin** | Tokens JWT-like en mémoire (expiration 12h) |
| **Limitation de débit** | 600 requêtes/minute par IP |

---

## 4. Architecture du Projet

```
ALPHA_SOURCE/
├── server.js                  # Serveur Express principal (port 3000)
├── verifications.js           # Processus de calcul des points en arrière-plan
├── logger.js                  # Système de logs
├── package.json               # Dépendances Node.js
│
├── routes/                    # Routes Express (API backend)
│   ├── admin-api.js           # API d'administration (bans, warnings, stats)
│   ├── ai-client.js           # Proxy vers Gemini AI
│   ├── chat.js                # Endpoint chat IA (/api/chat)
│   ├── community.js           # API communauté (groupes, sujets, fills, MPs)
│   ├── cours.js               # API cours (upload, vote, suppression)
│   ├── ed-server.js           # Proxy École Directe (notes, EDT, devoirs)
│   ├── messagerie.js          # Messagerie interne + Rescues
│   ├── misc.js                # Défis hebdomadaires + divers
│   ├── shared.js              # Fonctions partagées (lecture/écriture JSON, warn)
│   ├── shop.js                # Boutique cosmétiques
│   └── users.js               # Gestion utilisateurs (login, profil, skins)
│
├── public/                    # Frontend (servi en statique)
│   ├── index.html             # Page principale (SPA-like, charge les sous-pages)
│   ├── script.js              # Orchestrateur principal (navigation, sidebar)
│   ├── style.css              # Styles globaux (sidebar, modals, animations)
│   │
│   ├── pages/                 # Pages HTML individuelles
│   │   ├── login.html         # Connexion + onboarding
│   │   ├── home.html          # Tableau de bord
│   │   ├── chat.html          # Chat IA
│   │   ├── communaute.html    # Communauté
│   │   ├── cours.html         # Partage de cours
│   │   ├── mess.html          # Messagerie
│   │   ├── cartable.html      # Notes & devoirs (École Directe)
│   │   ├── moncompte.html     # Mon compte (profil, boutique, inventaire)
│   │   ├── info.html          # Statistiques & classement
│   │   └── ban.html           # Page de bannissement
│   │
│   ├── css/                   # Feuilles de style par page
│   │   ├── theme.css          # Variables de thème (20+ skins)
│   │   ├── home.css, chat.css, communaute.css, cours.css, ...
│   │   └── ban.css
│   │
│   ├── js/                    # Scripts JavaScript par page
│   │   ├── badge-config.js    # Configuration des 35+ badges
│   │   ├── site-tutorial.js   # Système de tutoriel guidé
│   │   ├── home.js, chat.js, communaute.js, cours.js, ...
│   │   └── ban.js
│   │
│   └── api/                   # Fichiers de données JSON
│       ├── users.json         # Tous les profils utilisateurs
│       ├── cours.json         # Catalogue de cours
│       ├── challenge.json     # Défi hebdomadaire en cours
│       ├── bdd.json           # Base de données IA évolutive
│       ├── messages.json      # Messages internes
│       └── community/         # Données communautaires
│           ├── global.json    # Registre global (groupes, sujets, fills, MPs)
│           ├── groupes/       # Fichiers JSON par groupe
│           ├── sujets/        # Fichiers JSON par sujet
│           ├── fills/         # Fichiers JSON par fil
│           └── mp/            # Fichiers JSON par conversation privée
│
├── API ED/                    # Module École Directe standalone
├── python admin/              # Panel admin Python (logs)
└── data/, images/, uploads/   # Stockage de fichiers
```

---

## 5. Systèmes Principaux

### 5.1 Authentification & Onboarding

**Connexion** : L'utilisateur entre son nom d'utilisateur et mot de passe. Le serveur vérifie le hash bcrypt, contrôle si l'utilisateur est banni, et incrémente le compteur de connexions.

**Onboarding (première connexion)** : Si l'utilisateur n'a pas encore configuré son compte, il passe par un processus en 3 étapes :
1. **Photo de profil** : Upload d'une image (stockée dans `community/ressources/pp/`)
2. **Date de naissance** : Saisie obligatoire
3. **Mot de passe** : Création du mot de passe (hashé en bcrypt)

**Vérifications au login** :
- Si banni → redirection vers `/pages/ban.html`
- Si première connexion → déclenchement de l'onboarding
- Sinon → connexion normale, attribution des points journaliers (+3 pts/jour), mise à jour du streak

---

### 5.2 Système de Points & Gamification

Les points sont la monnaie centrale du site. Ils se gagnent et se dépensent de multiples façons :

#### Gagner des points
| Action | Points |
|--------|--------|
| Connexion quotidienne | +3 pts/jour |
| Envoyer 20 messages en communauté (fill/groupe) | +2 pts |
| Envoyer 15 messages à l'IA | +3 pts |
| Être #1 au classement (quotidien) | +10 pts |
| Être #2 au classement | +5 pts |
| Être #3 au classement | +2 pts |
| Cours bien noté (≥3.5 étoiles, quotidien) | +3 pts |
| Upload d'un cours évalué positivement | 0 à +15 pts (selon étoiles) |
| Voter sur un cours (2 premiers votes) | +5 pts |
| Voter dans la majorité | +3 pts |
| Répondre à un rescue | +15 pts (si sélectionné) |
| Compléter un défi hebdomadaire | +8 à +15 pts |

#### Dépenser des points
| Action | Coût |
|--------|------|
| Acheter un skin | 24-45 pts |
| Acheter un fond | 0-38 pts |
| Créer un groupe communautaire | 30 pts |
| Créer un sujet communautaire | 5 pts |
| Envoyer un message anonyme | 3 pts |
| Envoyer un rescue (SOS cours) | 5 pts |
| Utiliser le mode "devoirs" du chat IA | 3 pts/message |

#### Pénalités
| Situation | Pénalité |
|-----------|----------|
| Inactivité 7+ jours | -15 pts |
| Créateur de fill avec <5 messages en 24h | -5 pts |

Le serveur exécute des vérifications périodiques (via `verifications.js`) pour calculer et appliquer ces récompenses/pénalités automatiquement.

---

### 5.3 Système de Badges

Le site comporte **35+ badges** avec chacun un emoji, un nom et un critère de déblocage. Les badges sont recalculés périodiquement côté serveur.

#### Badges principaux

| Badge | Emoji | Critère |
|-------|-------|---------|
| Délégué | 🎖️ | Liste fixe (Antoine, Juliette) |
| Rang 1 / 2 / 3 | 🏆🥈🥉 | Top 3 au classement |
| Marathonien | 🏃 | 30+ jours de connexion consécutifs |
| Collectionneur | 🎯 | 10+ badges obtenus |
| Pilier | 🪨 | 100+ messages en communauté |
| Explorateur | 🧭 | Avoir visité les 10 types de pages |
| Vestimentaire | 👗 | 6+ skins possédés |
| Sauveur | 🦸 | 5+ réponses à des rescues |
| Ami | 💕 | 30+ messages privés envoyés |
| Sociable | 💬 | 50+ messages total |
| Actif | ⚡ | Activité récente |
| Inactif | 😴 | Aucune activité récente |
| Nuevo | 🆕 | Première connexion |
| Dépenseur | 💸 | 50+ points dépensés |
| Fantôme | 👻 | Ne s'est jamais connecté |
| + ~20 autres | ... | Badges thématiques et comportementaux |

Chaque utilisateur peut mettre en avant **3 badges** dans sa vitrine de profil social.

---

### 5.4 Intelligence Artificielle (Gemini)

Le chat IA est propulsé par **Google Gemini 2.5 Flash**. Il est contextualisé avec les données scolaires réelles de l'élève.

#### Modes de conversation
| Mode | Description | Coût |
|------|-------------|------|
| **Basique** | Questions libres + emploi du temps du jour | Gratuit |
| **Apprentissage** | Inclut les notes et moyennes de l'élève | Gratuit |
| **Devoirs** | Inclut la liste des devoirs à faire | -3 pts/message |

#### Fonctionnalités
- **Historique de conversation** : Les messages précédents sont envoyés à chaque requête
- **Support d'images** : L'utilisateur peut joindre une image (base64) à sa question
- **Curseur de créativité** : Réglable (temperature du modèle)
- **Contexte scolaire** : L'IA reçoit l'emploi du temps des 14 prochains jours, les notes, les devoirs
- **Base de données évolutive** (`bdd.json`) : Après chaque conversation, un job en arrière-plan fait analyser la conversation par l'IA pour en extraire des faits pertinents à mémoriser

---

### 5.5 Communauté

La communauté est le cœur social du site. Elle comprend 4 types d'espaces de discussion :

#### Groupes
- **Coût de création** : 30 points
- **Membres** : Liste de membres, un admin
- **Privé/Public** : Option lors de la création
- **Photo de groupe** : Uploadable
- **Messages** : Texte + fichiers joints + réactions
- **Gestion** : L'admin peut supprimer, quitter (successeur obligatoire)

#### Sujets (Topics)
- **Coût de création** : 5 points
- **Durée de vie** : 12h à 5 jours (configurable)
- **Expiration** : Suppression automatique à la fin de la durée

#### Fills (Fils temporaires)
- **Coût** : Gratuit
- **Durée de vie** : 12h (expiration automatique)
- **Rattachement** : Créés à l'intérieur d'un sujet ou d'un groupe
- **Demandes d'accès** : Les utilisateurs peuvent demander à rejoindre (max 3 demandes/jour)

#### Messages Privés (MPs)
- **Coût** : Gratuit
- **Participants** : 2 personnes uniquement
- **Messages** : Texte + fichiers + réactions

#### Fonctionnalités communes
- **Envoi de messages** avec texte et fichier joint (images, documents)
- **Réactions** sur les messages (emojis)
- **Profils utilisateurs** consultables via clic sur un avatar (modal avec badges, stats, profil social)
- **Vérification de ban** à l'envoi de message

---

### 5.6 Messagerie Interne & Rescues

#### Messagerie classique
- **Destinataires** : Identifiés par ID (1=Bot Source IA, 2=Admin, 3+=noms de classe)
- **Champs** : Sujet, corps, pièces jointes, lu/non lu
- **Messages anonymes** : Possible moyennant 3 pts (le nom est remplacé par "[ANONYME]")

#### Système de Rescue (SOS Cours)
Un mécanisme d'urgence pour obtenir rapidement un cours manquant :

1. **L'élève envoie un rescue** (-5 pts) : Il décrit la matière et le sujet dont il a besoin
2. **L'IA analyse** qui peut aider (via Gemini) : Elle identifie 3 à 8 camarades susceptibles d'avoir le cours
3. **Notification** : Les élèves identifiés reçoivent un message d'alerte
4. **Réponses** : Les candidats soumettent leur cours avec pièces jointes
5. **Vote** : Le demandeur vote (pouce en l'air) pour la meilleure réponse
6. **Récompense** : Le gagnant reçoit +15 pts

---

### 5.7 Cours (Dépôt & Évaluation)

#### Cycle de vie d'un cours
1. **Dépôt** : Un élève uploade un cours (fichier + titre + matière + description)
2. **Période d'évaluation** (24h) : Les autres élèves votent (1=bon, 0.5=moyen, -1=mauvais)
3. **Finalisation** : Après 24h, le score est calculé avec un lissage bayésien
4. **Récompenses** :
   - Le déposant reçoit 0 à 15 pts selon la note finale (≥3.5 étoiles = 15 pts)
   - Les votants reçoivent 5 pts (2 premiers votes) ou 3 pts (vote dans la majorité)
5. **Statut** : Le cours peut être en "waiting", "normal", ou "suspension"
6. **Suppression douce** : Un cours peut être marqué `supprime=true` sans être effacé

---

### 5.8 Boutique & Cosmétiques

#### Skins (Thèmes visuels)
- **20+ skins** disponibles avec des niveaux de rareté : commun, rare, épique, légendaire, mythique
- **Prix** : 24 à 45 points
- **Effet** : Change les couleurs principales de l'interface (variables CSS --color-primary, --color-secondary, etc.)
- **Skins gratuits de base** : "bleu basique", "jaune basique", "Vagues"

#### Fonds (Arrière-plans)
- **8 fonds** disponibles : pixel-art, aurora, papier froissé, vagues SVG animées, etc.
- **Prix** : 0 à 38 points

#### Offres du jour
- 3 articles aléatoires par jour avec 10-21% de réduction
- Sélection basée sur un seed utilisateur/date (déterministe)

#### Bundles
- Packs d'articles avec 10-15% de réduction sur le total

#### Historique d'achat
- Les 100 derniers achats consultables

---

### 5.9 Intégration École Directe

Le site fait office de pont avec **École Directe**, la plateforme scolaire française :

- **Connexion ED** : L'élève peut lier son compte École Directe
- **Notes** : Récupération des notes par période et matière, avec moyennes
- **Emploi du temps** : Affichage du planning sur 14 jours
- **Devoirs** : Liste des devoirs à faire (contenu décodé depuis base64)
- **Cache** : Le cahier de texte est mis en cache 5 minutes par date pour limiter les appels API
- **QCM** : Support de la gestion des questions de sécurité ED

Les données ED sont stockées dans `users_detailed_data.json` et servent de contexte au chat IA.

---

### 5.10 Modération & Administration

#### Système d'avertissements (Warnings)
- Chaque warning expire après 7 jours
- **Ban automatique** : 2 warnings en 3 jours OU 3+ warnings en 7 jours → 48h de ban
- Un admin peut ajouter/supprimer des warnings manuellement

#### Système de signalement (Reports)
- Les utilisateurs peuvent signaler des messages (max 2 utilisateurs différents/jour)
- **3 signalements en 2 jours** sur un même utilisateur → Warning automatique

#### Ban
- L'utilisateur banni est redirigé vers `/pages/ban.html`
- La page affiche un compte à rebours, la raison, et un contact d'appel
- Vérification du ban à la connexion ET à l'envoi de messages communautaires

#### Panel Admin
- **Authentification** : Token Bearer (12h d'expiration)
- **Comptes admin** : "even" et "admin"
- **Fonctionnalités** :
  - Voir tous les utilisateurs et leurs stats
  - Bannir / Débannir un utilisateur
  - Ajouter / Supprimer des warnings
  - Voir les statistiques globales de la plateforme
  - Gérer la communauté (groupes, fills, sujets, MPs)
  - Voir les messages, rescues, demandes d'accès aux fills
  - Voir le catalogue de cours

---

### 5.11 Défis Hebdomadaires

Chaque semaine, un défi collectif est proposé à l'ensemble de la classe :

| Template | Objectif | Récompense |
|----------|----------|------------|
| Marathon | 50 messages collectifs | 8-15 pts |
| Rush | 30 connexions uniques | 8-15 pts |
| Partage | 3 cours uploadés | 8-15 pts |
| Unique | 10 connexions uniques | 8-15 pts |
| Rescue | 5 réponses à des rescues | 8-15 pts |

- La progression est suivie dans `challenge.json`
- La récompense est distribuée à **tous les contributeurs** quand l'objectif est atteint
- Rotation automatique chaque semaine

---

## 6. Pages du Site (Vue d'ensemble)

| Page | Fichier | Rôle principal |
|------|---------|----------------|
| **Login** | `login.html` | Connexion + onboarding (photo, date de naissance, mot de passe) |
| **Accueil** | `home.html` | Tableau de bord : classement, streak, devoirs, messages non lus, résumé des notes |
| **Chat IA** | `chat.html` | Conversation avec Gemini : historique, upload d'image, slider créativité, sélection de mode |
| **Communauté** | `communaute.html` | Groupes, sujets, fills, MPs : liste, zone de messages, profils, création, partage de fichiers |
| **Cours** | `cours.html` | Bibliothèque de cours : recherche, grille, vote, détails, dépôt |
| **Messagerie** | `mess.html` | Boîte de réception, composition, rescue, détail des messages, pièces jointes |
| **Cartable** | `cartable.html` | Notes & devoirs (via École Directe) : sélecteur de période, tableau de notes, graphiques, simulation |
| **Mon Compte** | `moncompte.html` | Profil, inventaire, boutique, badges, changement de mot de passe |
| **Infos** | `info.html` | Statistiques : graphique d'évolution des points, camembert, défi hebdo, classement |
| **Ban** | `ban.html` | Page de bannissement : compte à rebours, raison, contact |

---

## 7. Données & Fichiers JSON

Le site n'utilise pas de base de données traditionnelle. Toutes les données sont stockées dans des fichiers JSON :

| Fichier | Contenu |
|---------|---------|
| `users.json` | Tous les profils (points, badges, skins, connexions, stats, profil social) |
| `cours.json` | Catalogue de cours avec votes et évaluations |
| `messages.json` | Messages internes (boîte de réception) |
| `challenge.json` | État du défi hebdomadaire en cours |
| `bdd.json` | Base de connaissances IA évolutive |
| `all.json` | Classement agrégé + points collectifs |
| `mdped.json` | Identifiants École Directe (chiffrés) |
| `users_detailed_data.json` | Données École Directe (notes, EDT, devoirs) |
| `community/global.json` | Registre de tous les groupes, sujets, fills, MPs |
| `community/groupes/{id}.json` | Messages + membres d'un groupe |
| `community/sujets/{id}.json` | Métadonnées d'un sujet |
| `community/fills/{id}.json` | Messages + membres d'un fil |
| `community/mp/{id}.json` | Conversation privée |

---

## 8. Sécurité & Performance

### Sécurité
- **Mots de passe** : Hashés avec bcryptjs (jamais stockés en clair)
- **Tokens admin** : Expiration 12h, stockage en mémoire (pas dans les fichiers)
- **Limitation de débit** : 600 requêtes/minute par adresse IP
- **Ban** : Vérifié à la connexion ET à l'envoi de messages
- **Messages anonymes** : Coûtent 3 pts pour limiter le spam
- **Signalements** : Limités à 2 utilisateurs distincts/jour pour éviter les abus

### Performance
- **Fichiers statiques** avec headers de cache
- **Évaluations de cours** : Finalisation lazy après la fenêtre de 24h
- **Uploads communautaires** : Limites de taille (5-20 MB)
- **Chart.js** : Rendu côté client pour les graphiques
- **Cache École Directe** : Cahier de texte en cache 5 min par date
- **Port dynamique** : Si le port 3000 est occupé, le serveur essaie 3001, 3002... jusqu'à 3005

---

> **Note** : Ce document est une vue d'ensemble. Les sections suivantes seront approfondies avec le détail de chaque bouton, chaque modal, chaque interaction pour chacune des pages du site.
