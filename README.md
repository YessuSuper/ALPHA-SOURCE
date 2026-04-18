# 🎓 Alpha Source

**Plateforme web scolaire tout-en-un** — réseau social gamifié pour les élèves d'une même classe.

![Node.js](https://img.shields.io/badge/Node.js-Express-green?logo=node.js)
![JavaScript](https://img.shields.io/badge/Frontend-Vanilla%20JS-yellow?logo=javascript)
![License](https://img.shields.io/badge/License-ISC-blue)

---

## 🚀 Fonctionnalités

| Module | Description |
|--------|-------------|
| 🏠 **Tableau de bord** | Classement, devoirs du jour, messages récents |
| 🤖 **Chat IA** | Assistant propulsé par Groq, contextualisé avec les données scolaires |
| 👥 **Communauté** | Groupes, sujets de discussion, fils, messages privés |
| 📚 **Partage de cours** | Upload, vote et évaluation par les pairs |
| 💬 **Messagerie** | Messages internes + système de "Rescue" (SOS cours) |
| 🛒 **Boutique** | Thèmes visuels et cosmétiques achetables avec des points |
| 📊 **École Directe** | Synchronisation notes, devoirs et emploi du temps |
| 🏆 **Gamification** | Points, 35+ badges, streaks, défis hebdomadaires, classement |
| 🛡️ **Administration** | Panel admin, bans, warnings, statistiques |

---

## 🛠️ Stack technique

- **Backend** : Node.js + Express.js
- **Frontend** : HTML5, CSS3, JavaScript vanilla
- **IA** : Groq API (rotation de clés)
- **Base de données** : Fichiers JSON + SQLite (better-sqlite3)
- **Auth** : bcryptjs + tokens JWT-like
- **Uploads** : Multer
- **Temps réel** : WebSockets (ws)

---

## 📁 Structure du projet

```
├── server.js              # Serveur Express (port 3000)
├── verifications.js       # Calcul des points en arrière-plan
├── db.js                  # Base de données SQLite
├── routes/
│   ├── users.js           # Auth, profils, skins
│   ├── chat.js            # Chat IA
│   ├── community.js       # Groupes, sujets, MPs
│   ├── cours.js           # Partage de cours
│   ├── messagerie.js      # Messagerie + Rescues
│   ├── shop.js            # Boutique cosmétiques
│   ├── ed-server.js       # Proxy École Directe
│   ├── admin-api.js       # API administration
│   └── ai-client.js       # Client Groq avec rotation de clés
├── public/
│   ├── pages/             # Pages HTML (home, chat, communaute, cours...)
│   ├── js/                # Scripts par page
│   └── css/               # Styles par page
└── .env                   # Variables d'environnement (non versionné)
```

---

## ⚡ Installation

```bash
# Cloner le repo
git clone https://github.com/YessuSuper/ALPHA-SOURCE.git
cd ALPHA-SOURCE

# Installer les dépendances
npm install

# Configurer les variables d'environnement
cp .env.example .env
# Remplir les clés API dans .env

# Lancer le serveur
npm start
```

Le serveur démarre sur `http://localhost:3000`.

---

## 🔑 Variables d'environnement

Créer un fichier `.env` à la racine :

```env
GROQ_API_KEY=gsk_...
GROQ_API_KEY_2=gsk_...
GROQ_API_KEY_3=gsk_...
GROQ_API_KEY_4=gsk_...
```

---

## 📸 Aperçu

Le site fonctionne comme un **réseau social scolaire gamifié** où chaque action (se connecter, poster un message, partager un cours, aider un camarade) rapporte des points et débloque des badges.

---

## 👤 Auteur

Développé par [YessuSuper](https://github.com/YessuSuper)
