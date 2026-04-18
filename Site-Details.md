# 📘 ALPHA SOURCE — Documentation Détaillée Page par Page

> Ce document décrit **chaque page, chaque bouton, chaque modal, chaque élément interactif** du site Alpha Source.
> Il complète le fichier `Site.md` qui couvre la vue d'ensemble et les systèmes principaux.

---

## Table des Matières

- [1. Structure Globale (index.html)](#1-structure-globale-indexhtml)
  - [1.1 Fond animé dynamique](#11-fond-animé-dynamique)
  - [1.2 Header Mobile](#12-header-mobile)
  - [1.3 Sidebar Desktop](#13-sidebar-desktop)
  - [1.4 Zone de contenu principal](#14-zone-de-contenu-principal)
  - [1.5 Modals globaux](#15-modals-globaux)
  - [1.6 Système de notifications de points (Toast)](#16-système-de-notifications-de-points-toast)
  - [1.7 Navigation SPA](#17-navigation-spa)
  - [1.8 Scripts chargés](#18-scripts-chargés)
- [2. Page Login (login.html)](#2-page-login-loginhtml)
  - [2.1 Formulaire de connexion](#21-formulaire-de-connexion)
  - [2.2 Onboarding — Étape 1 : Photo de profil](#22-onboarding--étape-1--photo-de-profil)
  - [2.3 Onboarding — Étape 2 : Date de naissance](#23-onboarding--étape-2--date-de-naissance)
  - [2.4 Onboarding — Étape 3 : Mot de passe](#24-onboarding--étape-3--mot-de-passe)
- [3. Page Accueil / Dashboard (home.html)](#3-page-accueil--dashboard-homehtml)
  - [3.1 Message d'accueil](#31-message-daccueil)
  - [3.2 Widget Streak (Flamme)](#32-widget-streak-flamme)
  - [3.3 Widget Défi de la semaine](#33-widget-défi-de-la-semaine)
  - [3.4 Widget Classement](#34-widget-classement)
  - [3.5 Widget Sac à Dos / Emploi du Temps](#35-widget-sac-à-dos--emploi-du-temps)
  - [3.6 Widget Contrôles à venir](#36-widget-contrôles-à-venir)
  - [3.7 Widget Devoirs à faire](#37-widget-devoirs-à-faire)
  - [3.8 Widget Moyenne & Notes récentes](#38-widget-moyenne--notes-récentes)
  - [3.9 Widget Messages non lus](#39-widget-messages-non-lus)
  - [3.10 Widget Derniers messages communautaires](#310-widget-derniers-messages-communautaires)
- [4. Page Chat IA (chat.html)](#4-page-chat-ia-chathtml)
  - [4.1 Zone de conversation](#41-zone-de-conversation)
  - [4.2 Barre de saisie](#42-barre-de-saisie)
  - [4.3 Boutons d'action](#43-boutons-daction)
  - [4.4 Panneau paramètres Desktop](#44-panneau-paramètres-desktop)
  - [4.5 Menu déroulant paramètres Mobile](#45-menu-déroulant-paramètres-mobile)
- [5. Page Communauté (communaute.html)](#5-page-communauté-communautehtml)
  - [5.1 Sidebar des discussions](#51-sidebar-des-discussions)
  - [5.2 Zone de chat active](#52-zone-de-chat-active)
  - [5.3 Menu de création (+)](#53-menu-de-création-)
  - [5.4 Modal Donner des Points](#54-modal-donner-des-points)
  - [5.5 Modal de création : Groupe](#55-modal-de-création--groupe)
  - [5.6 Modal de création : Sujet](#56-modal-de-création--sujet)
  - [5.7 Modal de création : Fill](#57-modal-de-création--fill)
  - [5.8 Modal de création : Message Privé](#58-modal-de-création--message-privé)
  - [5.9 Modal Profil Utilisateur](#59-modal-profil-utilisateur)
  - [5.10 Menu contextuel de message](#510-menu-contextuel-de-message)
  - [5.11 Visionneuse d'images](#511-visionneuse-dimages)
  - [5.12 Panneau Détails de Groupe](#512-panneau-détails-de-groupe)
  - [5.13 Panneau Détails de Fill](#513-panneau-détails-de-fill)
  - [5.14 Bulle action rapide (Créer un fill)](#514-bulle-action-rapide-créer-un-fill)
  - [5.15 Tooltip Badge](#515-tooltip-badge)
- [6. Page Cours (cours.html)](#6-page-cours-courshtml)
  - [6.1 Barre de recherche et filtres](#61-barre-de-recherche-et-filtres)
  - [6.2 Grille de cours](#62-grille-de-cours)
  - [6.3 Modal Détails d'un cours](#63-modal-détails-dun-cours)
  - [6.4 Modal Dépôt d'un cours](#64-modal-dépôt-dun-cours)
  - [6.5 Modal Vote / Étoiles](#65-modal-vote--étoiles)
  - [6.6 Bouton flottant "Déposer un cours"](#66-bouton-flottant-déposer-un-cours)
- [7. Page Messagerie (mess.html)](#7-page-messagerie-messhtml)
  - [7.1 Onglets de navigation](#71-onglets-de-navigation)
  - [7.2 Sidebar Boîte de réception](#72-sidebar-boîte-de-réception)
  - [7.3 Écran d'accueil messagerie](#73-écran-daccueil-messagerie)
  - [7.4 Formulaire "Nouveau Message"](#74-formulaire-nouveau-message)
  - [7.5 Formulaire "Sauvetage" (Rescue)](#75-formulaire-sauvetage-rescue)
  - [7.6 Vue détail d'un message](#76-vue-détail-dun-message)
- [8. Page Cartable (cartable.html)](#8-page-cartable-cartablehtml)
  - [8.1 Panneau de connexion École Directe](#81-panneau-de-connexion-école-directe)
  - [8.2 Écran de chargement](#82-écran-de-chargement)
  - [8.3 Onglets Notes / Devoirs](#83-onglets-notes--devoirs)
  - [8.4 Panneau Notes](#84-panneau-notes)
  - [8.5 Panneau Devoirs](#85-panneau-devoirs)
  - [8.6 Modal Notes par matière](#86-modal-notes-par-matière)
  - [8.7 Modal Graphique des notes](#87-modal-graphique-des-notes)
  - [8.8 Modal Simulation de note](#88-modal-simulation-de-note)
  - [8.9 Modal Détail d'un devoir](#89-modal-détail-dun-devoir)
- [9. Page Mon Compte (moncompte.html)](#9-page-mon-compte-moncomptehtml)
  - [9.1 Header de profil](#91-header-de-profil)
  - [9.2 Actions rapides](#92-actions-rapides)
  - [9.3 Section gauche : Boutique, Inventaire, Badges](#93-section-gauche--boutique-inventaire-badges)
  - [9.4 Section droite : Mot de passe, Infos compte](#94-section-droite--mot-de-passe-infos-compte)
  - [9.5 Footer : Déconnexion](#95-footer--déconnexion)
  - [9.6 Modal Éditeur de profil social](#96-modal-éditeur-de-profil-social)
  - [9.7 Modal Photo de profil](#97-modal-photo-de-profil)
  - [9.8 Modal Mot de passe](#98-modal-mot-de-passe)
  - [9.9 Modal Informations du compte](#99-modal-informations-du-compte)
  - [9.10 Modal Badges](#910-modal-badges)
  - [9.11 Modal Inventaire](#911-modal-inventaire)
  - [9.12 Modal Boutique](#912-modal-boutique)
- [10. Page Infos & Statistiques (info.html)](#10-page-infos--statistiques-infohtml)
  - [10.1 En-tête statistiques](#101-en-tête-statistiques)
  - [10.2 Barre de progression hebdomadaire](#102-barre-de-progression-hebdomadaire)
  - [10.3 Graphique d'évolution des points](#103-graphique-dévolution-des-points)
  - [10.4 Camembert "Comment tu gagnes tes points"](#104-camembert-comment-tu-gagnes-tes-points)
  - [10.5 Widget Classement (version Infos)](#105-widget-classement-version-infos)
- [11. Page Ban (ban.html)](#11-page-ban-banhtml)
- [12. Système de Thèmes & Skins (theme.css)](#12-système-de-thèmes--skins-themecss)
- [13. Configuration des Badges (badge-config.js)](#13-configuration-des-badges-badge-configjs)
- [14. Tutoriel du site (site-tutorial.js)](#14-tutoriel-du-site-site-tutorialjs)

---

## 1. Structure Globale (index.html)

Le fichier `index.html` est la page maîtresse. Le site fonctionne en mode **SPA (Single Page Application)** : les sous-pages sont chargées dynamiquement dans un conteneur via `fetch()`, sans rechargement complet du navigateur.

### 1.1 Fond animé dynamique

L'arrière-plan du site est dynamique et change selon le fond équipé par l'utilisateur :

- **`#dynamic-bg-root`** : Conteneur racine du fond animé. Vidé et repeuplé à chaque changement de fond.
- **`.waves` (`#waves-bg`)** : Fond par défaut — vagues SVG animées. Composé de 2 groupes de 4 vagues chacun (`wave-group` et `wave-group-back`), totalisant 8 couches de vagues avec des animations CSS indépendantes.
- **`pixel-art`** : Un `<div class="pixel-art-bg">` injecté dynamiquement. Effet mosaïque pixelisée.
- **`aurora`** : Un `<div class="aurora-bg">` injecté dynamiquement. Dégradés mouvants imitant des aurores boréales.
- **`crumpled-paper`** : Un `<div class="crumpled-paper-bg">` injecté dynamiquement. Texture de papier froissé animée.
- **`vagues-inversees`** : Les mêmes vagues SVG mais retournées (en haut de l'écran).

Un `MutationObserver` surveille l'attribut `data-fond` de `<html>` pour mettre à jour le fond automatiquement.

### 1.2 Header Mobile

Visible uniquement sur petit écran (≤768px). Contient :

| Élément | ID/Classe | Rôle |
|---------|-----------|------|
| **Bouton Hamburger** | `#mobile-hamburger-btn` | Ouvre/ferme la sidebar en overlay sur mobile. 3 barres horizontales animées. |
| **Titre** | `#mobile-header-title` | Affiche "ALPHA SOURCE" (masqué sur les pages Chat et Home). |
| **Navigation horizontale** | `#mobile-nav` | 8 icônes de navigation (une par page) sous forme de liens `<a>` avec attribut `data-page`. Chaque icône est une image PNG spécifique : |

**Icônes de navigation mobile :**
| Icône | Cible (`data-page`) | Image |
|-------|---------------------|-------|
| 🏠 | `accueil` | `homemenuicon.png` |
| 🤖 | `home` (=Chat IA) | `kiraaimenuicon.png` |
| 📚 | `cours` | `coursmenuicon.png` |
| 👥 | `communaute` | `communautemenuicon.png` |
| ✉️ | `messagerie` | `messageriemenuicon.png` |
| 🎒 | `cartable` | `cartablemenuicon.png` |
| ℹ️ | `info` | `infomenuicon.png` |
| 👤 | `moncompte` | `comptemenuicon.png` |

### 1.3 Sidebar Desktop

La sidebar est visible en permanence sur desktop et s'ouvre en overlay sur mobile.

| Élément | ID | Rôle |
|---------|----|------|
| **Sidebar container** | `#sidebar` | Conteneur principal de la sidebar. Classe `.open` pour l'afficher sur mobile. |
| **Bouton Toggle** | `#toggle-sidebar-btn` | Icône hamburger (☰) qui bascule la visibilité de la sidebar. |
| **Titre** | `.sidebar-title` | Affiche "MENU". |
| **Menu de navigation** | `#main-menu` | Liste de liens `<a>` avec classe `.active` pour la page courante. Généré dynamiquement par `script.js`. |
| **Overlay** | `#sidebar-overlay` | Fond semi-transparent qui apparaît derrière la sidebar sur mobile. Clic dessus ferme la sidebar. |

### 1.4 Zone de contenu principal

| Élément | ID | Rôle |
|---------|----|------|
| **Wrapper global** | `#main-content-wrapper` | Contient tout le layout (sidebar + contenu). |
| **Container app** | `#app-container` | Zone centrale de l'application. |
| **Wrapper de page** | `#page-content-wrapper` | Conteneur où le HTML de chaque sous-page est injecté dynamiquement par `renderPage()`. |

### 1.5 Modals globaux

Ces modals sont définis dans `index.html` et partagés par toutes les pages :

| Modal | ID | Rôle |
|-------|----|------|
| **Modal Dépôt de cours** | `#deposit-modal` | Formulaire d'upload de cours (titre, matière, description, fichier). Contient un sélecteur de matière avec 13 options : Mathématiques, Histoire, Français, Physique-Chimie, Anglais, Espagnol, SVT, Technologie, Musique, Arts Plastiques, Latin, Grec, Brevet. |
| **Bouton Déposer** | `#deposit-course-button` | Bouton flottant (masqué par défaut, visible uniquement sur la page Cours) qui ouvre `#deposit-modal`. |
| **Modal Détails cours** | `#details-modal` | Affiche le détail d'un cours sélectionné (titre, contenu). |
| **Modal Vote étoiles** | `#star-vote-modal` | Interface de vote pour noter un cours. Affiche les étoiles actuelles, le nombre de votes, et 3 boutons de vote : "Bon" (1), "Moyen" (0.5), "Mauvais" (-1). |
| **Modal personnalisé** | `#custom-modal-overlay` | Modal de notification/confirmation générique. Titre (`#custom-modal-title`), message (`#custom-modal-message`), boutons "Annuler" et "OK". |

### 1.6 Système de notifications de points (Toast)

Un système de toast automatique est installé par `script.js` :

- **Détection automatique** : Un intercepteur (`patched fetch`) analyse automatiquement toutes les réponses JSON du serveur pour détecter les changements de points.
- **Champs détectés** : `pointsDelta`, `deltaPoints`, `pointsAwarded`, `pointsSpent`, `pointsCost`, `newIndividualPoints`, `individualPoints`, `user.points`, `newPoints`.
- **Comportement** : Quand un delta de points est détecté, un toast apparaît en haut de l'écran avec le message "Tu viens de gagner/perdre X point(s)" puis disparaît après 2 secondes.
- **Élément DOM** : `#points-toast-host` (créé dynamiquement au premier appel).
- **Classes CSS** : `.points-toast`, `.is-visible` (apparition), `.is-hiding` (disparition), `.points-toast__text`, `.points-toast__close` (bouton ×).
- **Stockage** : Le dernier total de points est enregistré dans `localStorage` clé `source_last_points:{username}` pour calculer les deltas.

### 1.7 Navigation SPA

La fonction `renderPage(page)` est le cœur de la navigation :

1. Définit `currentPage` et `window.__alphaCurrentPage`
2. Met l'attribut `data-page` sur `<body>` (utilisé par le CSS pour adapter les styles)
3. Scroll en haut de page
4. Arrête le polling communautaire si actif
5. Charge le HTML de la sous-page via `fetch()`
6. Injecte le HTML dans `#page-content-wrapper`
7. Appelle la fonction d'initialisation du module JS correspondant (ex: `initChatPage()`, `initHomePage()`, etc.)
8. Met à jour la classe `.active` sur le menu

**Mapping des pages :**
| Valeur `page` | Fichier chargé | Fonction init |
|---------------|----------------|---------------|
| `accueil` | `/pages/home.html` | `initHomePage()` |
| `home` ou `chat` | `/pages/chat.html` | `initChatPage()` |
| `cours` | `/pages/cours.html` | `__CourseModuleInit()` |
| `communaute` | `/pages/communaute.html` | `initCommunityChat()` ou `initCommunautePage()` |
| `messagerie` | `/pages/mess.html` | `initMessageriePage()` |
| `cartable` | `/pages/cartable.html` | `initCartablePage()` |
| `info` | `/pages/info.html` | `initInfoPage()` |
| `moncompte` | `/pages/moncompte.html` | `initMonComptePage()` |

### 1.8 Scripts chargés

Tous chargés avec `defer` dans `index.html` :

| Script | Rôle |
|--------|------|
| `marked.min.js` (CDN) | Parser Markdown → HTML (pour le chat IA) |
| `dompurify` (CDN) | Nettoyage HTML pour prévenir le XSS |
| `chart.js` (CDN) | Bibliothèque de graphiques (notes, points, camembert) |
| `/js/badge-config.js` | Configuration des 26+ badges (icônes, descriptions, fonctions de rendu) |
| `/js/communaute.js` | Logique communauté |
| `/script.js` | Orchestrateur principal |
| `/js/home.js` | Logique dashboard |
| `/js/chat.js` | Logique chat IA |
| `/js/info.js` | Logique statistiques |
| `/js/moncompte.js` | Logique mon compte |
| `/js/cours.js` | Logique cours |
| `/js/mess.js` | Logique messagerie |
| `/js/cartable.js` | Logique cartable (École Directe) |
| `/js/site-tutorial.js` | Système de tutoriel guidé |

---

## 2. Page Login (login.html)

Page autonome (pas chargée dans le SPA, a son propre `<html>`). Accessible à `/pages/login.html`.

### 2.1 Formulaire de connexion

**Container** : `#login-container`

| Élément | ID/Type | Détails |
|---------|---------|---------|
| **Titre** | `<h1>` | "Connexion a Alpha Source" |
| **Champ Identifiant** | `#username` | `<input type="text">`, `autocapitalize="none"`, `autocorrect="off"`, `autocomplete="username"` |
| **Champ Mot de passe** | `#password` | `<input type="password">`, `autocomplete` non spécifié |
| **Bouton Connexion** | `#login-submit-btn` | `<button type="submit">` texte "Se Connecter" |
| **Message d'erreur** | `#error-message` | `<p>` rouge, texte "Identifiants incorrects.", masqué par défaut |

**Comportement** :
- Envoie `POST /api/login` avec `{ username, password }`
- Si banni → stocke `ban_until` et `ban_reason` dans `localStorage` → redirection `/pages/ban.html`
- Si première connexion (pas de mot de passe hash) → affiche l'onboarding
- Sinon → stocke `source_username` dans `localStorage` → redirection vers `/`

### 2.2 Onboarding — Étape 1 : Photo de profil

**Container** : `#onboarding-container > #step-1`

| Élément | ID | Détails |
|---------|----|---------|
| **Titre** | `<h1>` | "Salut `<span id="user-name">`{nom}!" |
| **Sous-titre** | `.onboarding-subtitle` | "Choisis ta photo de profil" |
| **Indication** | `.onboarding-hint` | "(optionnel, modifiable plus tard)" |
| **Aperçu image** | `#profile-preview` | `<img>` masqué tant qu'aucune image n'est sélectionnée |
| **Input fichier** | `#profile-pic-input` | `<input type="file" accept="image/*">` masqué |
| **Bouton "Choisir une photo"** | `#choose-pic-btn` | Déclenche le clic sur `#profile-pic-input` |
| **Bouton "Valider"** | `#validate-pic-btn` | Upload la photo vers le serveur via `POST` (multipart) puis passe à l'étape 2 |
| **Bouton "Passer cette étape"** | `#skip-pic-btn` | Saute directement à l'étape 2 sans upload |

### 2.3 Onboarding — Étape 2 : Date de naissance

**Container** : `#step-2`

| Élément | ID | Détails |
|---------|----|---------|
| **Titre** | `<h1>` | "Date d'anniversaire" |
| **Sélecteur Jour** | `#birth-day` | `<select>` avec options de 1 à 31 |
| **Sélecteur Mois** | `#birth-month` | `<select>` avec options de Janvier à Décembre |
| **Sélecteur Année** | `#birth-year` | `<select>` avec années disponibles |
| **Bouton "Valider"** | `#validate-birth-btn` | Initialement désactivé (`disabled`). S'active quand les 3 selects sont remplis. Envoie la date au serveur puis passe à l'étape 3. |

### 2.4 Onboarding — Étape 3 : Mot de passe

**Container** : `#step-3`

| Élément | ID | Détails |
|---------|----|---------|
| **Titre** | `<h1>` | "Choisis ton mot de passe" |
| **Champ Nouveau MDP** | `#new-password` | `<input type="password">` |
| **Champ Confirmation** | `#confirm-password` | `<input type="password">` |
| **Bouton "Valider"** | `#validate-password-btn` | Initialement désactivé. S'active quand les 2 champs correspondent. Hash le mot de passe (côté serveur en bcrypt) → sauvegarde → redirection vers `/`. |

---

## 3. Page Accueil / Dashboard (home.html)

Page chargée quand `page === 'accueil'`. Affiche un tableau de bord avec plusieurs widgets.

### 3.1 Message d'accueil

| Élément | ID | Détails |
|---------|----|---------|
| **Titre d'accueil** | `#home-greeting` | `<h4>` rempli dynamiquement avec un message personnalisé (ex: "Bonjour {username} !") |

### 3.2 Widget Streak (Flamme)

**Container** : `#streak-display` (masqué par défaut, affiché si streak > 0)

Affiche une flamme SVG animée représentant le streak de connexion de l'utilisateur.

| Élément | ID | Détails |
|---------|----|---------|
| **Flamme SVG** | `#streak-flame-svg` | Flamme composée de 3 couches (outer/mid/inner) avec des dégradés de couleurs (rouge → orange → doré). 4 "braises" (cercles animés). Filtre de lueur (`feGaussianBlur`). |
| **Compteur** | `#streak-count` | Nombre de jours consécutifs de connexion |
| **Label** | `#streak-label` | Texte descriptif du streak (ex: "jours consécutifs") |

**Animation** : Les 3 couches de flamme ont des classes `.flame-outer`, `.flame-mid`, `.flame-inner` avec des animations CSS indépendantes. Les braises (`.ember`) oscillent.

### 3.3 Widget Défi de la semaine

**Container** : `#challenge-widget` (masqué par défaut, affiché si un défi est actif)

| Élément | ID | Détails |
|---------|----|---------|
| **Titre** | `#challenge-title` | "⚡ Défi de la semaine" |
| **Description** | `#challenge-desc` | Texte du défi en cours (ex: "Envoyer 50 messages collectivement") |
| **Barre de progression** | `#challenge-bar-wrapper` > `#challenge-bar-fill` | Barre visuelle qui se remplit en fonction de la progression |
| **Chiffres** | `#challenge-numbers` | "X / Y" (progression / objectif) |
| **Récompense** | `#challenge-reward` | Points à gagner en cas de succès |
| **Compte à rebours** | `#challenge-countdown` | Temps restant avant la fin du défi |

### 3.4 Widget Classement

**Container** : `#leaderboard-display` (classe `.widget-box`)

| Élément | ID | Détails |
|---------|----|---------|
| **Titre** | `<h3>` | "🏆 Classement général" |
| **Nom du leader** | `#leader-username` | Nom du #1 avec classe `.leader-name` |
| **Points du leader** | `#leader-points` | Score du #1 avec classe `.leader-score` |
| **#2** | `#second-username` / `#second-points` | Nom et score du 2ème |
| **#3** | `#third-username` / `#third-points` | Nom et score du 3ème |
| **Rang de l'utilisateur** | `#user-rank` | Position actuelle de l'utilisateur |
| **Score de l'utilisateur** | `#user-score` | Points actuels de l'utilisateur |

### 3.5 Widget Sac à Dos / Emploi du Temps

**Container** : `#backpack-display` (classe `.widget-box`)

Deux onglets internes :

| Bouton onglet | ID | Détails |
|---------------|-----|---------|
| **🎒 Sac à Dos** | `#tab-backpack` | Onglet actif par défaut. Affiche les devoirs du jour et du lendemain. |
| **📅 Emploi du Temps** | `#tab-edt` | Affiche l'emploi du temps du jour. |

**Vue Sac à Dos** (`#view-backpack`) :
| Élément | ID | Détails |
|---------|----|---------|
| **Titre Aujourd'hui** | `#backpack-title-today` | "Aujourd'hui ({date})" |
| **Liste matières aujourd'hui** | `#backpack-today-subjects` | `<ul>` avec les matières et devoirs du jour |
| **Titre Demain** | `#backpack-title-tomorrow` | "Demain ({date})" |
| **Liste matières demain** | `#backpack-tomorrow-subjects` | `<ul>` avec les matières et devoirs du lendemain |

**Vue Emploi du Temps** (`#view-edt`) :
| Élément | ID | Détails |
|---------|----|---------|
| **Titre** | `#edt-title-today` | "Emploi du temps" |
| **Liste EDT** | `#edt-today-list` | `<ul class="edt-list">` avec les créneaux horaires |

### 3.6 Widget Contrôles à venir

**Container** : `#controls-widget` (masqué par défaut, affiché si données ED disponibles)

| Élément | ID | Détails |
|---------|----|---------|
| **Titre** | `<h3>` | "🧪 Contrôles à venir" |
| **Liste** | `#controls-list` | `<ul>` des prochains contrôles/évaluations |

### 3.7 Widget Devoirs à faire

**Container** : `#pending-homework-widget` (masqué par défaut)

| Élément | ID | Détails |
|---------|----|---------|
| **Titre** | `<h3>` | "📚 Devoirs à faire" |
| **Liste** | `#pending-homework-list` | `<ul>` des devoirs non terminés |

### 3.8 Widget Moyenne & Notes récentes

**Container** : `#notes-widget` (masqué par défaut)

| Élément | ID | Détails |
|---------|----|---------|
| **Titre** | `<h3>` | "📈 Moyenne & notes récentes" |
| **Moyenne** | `#notes-current-avg` | Moyenne actuelle suivie de "/20" |
| **Notes récentes** | `#notes-recent-list` | `<ul>` des dernières notes reçues |

### 3.9 Widget Messages non lus

**Container** : `#unread-messages-widget` (masqué par défaut)

| Élément | ID | Détails |
|---------|----|---------|
| **Titre** | `<h3>` | "📨 Messages non lus" |
| **Liste** | `#unread-messages-list` | `<ul>` des messages non lus |

### 3.10 Widget Derniers messages communautaires

**Container** : `#recent-conversations-widget` (masqué par défaut)

| Élément | ID | Détails |
|---------|----|---------|
| **Titre** | `<h3>` | "💬 Derniers messages" |
| **Liste** | `#recent-conversations-list` | `<ul>` des derniers messages dans les groupes/fills |

---

## 4. Page Chat IA (chat.html)

Page principale du chat avec l'IA Gemini. Chargée pour `page === 'home'` ou `page === 'chat'`.

### 4.1 Zone de conversation

**Container** : `#chat-layout-container` > `#main-chat-area` > `#chat-box`

| Élément | ID | Détails |
|---------|----|---------|
| **Fenêtre de chat** | `#chat-window` | Zone scrollable où les messages (bulles utilisateur et IA) sont affichés. Les réponses de l'IA sont rendues en Markdown via `marked.js` et nettoyées par `DOMPurify`. |

### 4.2 Barre de saisie

**Container** : `#chat-form`

| Élément | ID | Détails |
|---------|----|---------|
| **Zone de texte** | `#user-input` | `<textarea>` avec placeholder "Ton message...", auto-resize (1 ligne de base). |
| **Input fichier** | `#file-upload` | `<input type="file" accept="image/*">` masqué. Déclenché par le bouton fichier. |

### 4.3 Boutons d'action

Dans `.form-controls` :

| Bouton | ID/Classe | Détails |
|--------|-----------|---------|
| **Joindre une image** | `label.file-button` (pour `#file-upload`) | Icône dossier (`dossiericon.png`). Ouvre le sélecteur de fichier pour joindre une image à la question. L'image sera envoyée en base64. |
| **Nouvelle Discussion** | `#new-chat-button` | Efface l'historique de conversation et commence un nouveau fil. |
| **Envoyer** | `#send-button-fixed` | Envoie le message courant (texte + image optionnelle) à l'API Gemini. |

### 4.4 Panneau paramètres Desktop

**Container** : `#right-sidebar-controls` (classe `.desktop-controls`)

Visible uniquement sur écrans > 768px.

| Élément | ID | Détails |
|---------|----|---------|
| **Titre** | `<h3>` | "Paramètres The Source" |
| **Slider Créativité** | `#creativity-slider` | `<input type="range">` min=0 max=1 step=0.1 valeur par défaut=0.7. Contrôle la `temperature` du modèle Gemini. |
| **Valeur créativité** | `#creativity-value` | `<span>` affichant la valeur actuelle (ex: "0.7") |
| **Sélecteur Mode IA** | `#ai-mode-select` | `<select>` avec 3 options : |
|  |  | - **Basique** (défaut) : Questions libres |
|  |  | - **Apprentissage** : Inclut notes et moyennes |
|  |  | - **Devoirs** : Inclut la liste des devoirs (coût 3 pts/msg) |
| **Avertissement mode Devoirs** | `#mode-warning` | `<p>` rouge "Mode Devoirs : coût de 3 points par message.", masqué sauf en mode Devoirs |
| **Sélecteur Niveau scolaire** | `#school-level-select` | `<select>` avec 3 options : 3ème (défaut), 4ème, 2nde |

### 4.5 Menu déroulant paramètres Mobile

**Container** : `#mobile-params-dropdown` (accroché sous la barre de saisie)

Visible uniquement sur écrans ≤ 768px.

| Élément | ID | Détails |
|---------|----|---------|
| **Bouton toggle** | `#params-toggle-btn` | Bouton avec flèche `▲` pour ouvrir/fermer le panneau paramètres |
| **Conteneur déplié** | `#mobile-params-content` | Panel avec titre "Paramètres Source AI" |
| **Slider Créativité** | `#creativity-slider-mobile` | Même comportement que la version desktop |
| **Valeur créativité** | `#creativity-value-mobile` | Affichage de la valeur |
| **Sélecteur Mode** | `#ai-mode-select-mobile` | Même options que desktop |
| **Avertissement** | `#mode-warning-mobile` | "3 pts/msg" en rouge, masqué sauf mode Devoirs |
| **Sélecteur Niveau** | `#school-level-select-mobile` | Même options que desktop |

---

## 5. Page Communauté (communaute.html)

Page la plus complexe du site. Layout à 2 colonnes : sidebar des discussions + zone de chat.

### 5.1 Sidebar des discussions

**Container** : `#channel-browser-sidebar`

**Header** (`#sidebar-header`) :

| Élément | ID | Détails |
|---------|----|---------|
| **Photo de profil** | `#user-pp` | Avatar de l'utilisateur connecté dans un cercle. |
| **Nom d'utilisateur** | `#current-user-display-name` | Nom affiché à côté de la photo. |
| **Bouton "Donner des points"** | `#give-points-btn` | Icône 💰. Ouvre le modal de don de points. |
| **Bouton "Créer (+)"** | `#create-discussion-btn` | Icône ➕. Ouvre le menu de création. |

**Liste des discussions** (`#channel-list`) :
- `<ul>` remplie dynamiquement depuis `global.json`.
- Chaque item affiche : icône de type (groupe/sujet/fill/MP), nom, dernier message, badge non lu.
- Clic sur un item → charge les messages dans la zone de chat.

### 5.2 Zone de chat active

**Container** : `#active-chat-column`

| Élément | ID | Détails |
|---------|----|---------|
| **Titre de la discussion** | `#chat-title-pill` | Bouton-pilule cliquable affichant le nom de la discussion. Clic → ouvre le panneau de détails (groupe ou fill). |
| **Zone de messages** | `#messages-container` | Zone scrollable avec les messages. Par défaut affiche "Sélectionnez une discussion pour commencer..." |
| **Aperçu fichier joint** | `#community-file-preview-container` | Masqué par défaut. Apparaît quand un fichier est sélectionné avant envoi. Contient une preview image (`#community-file-preview-img`), le nom du fichier (`#community-file-name`) et un bouton de suppression (`#community-remove-file-btn`). |
| **Zone de réponse** | `#reply-preview-area` | Masqué par défaut. Apparaît quand l'utilisateur répond à un message spécifique. |
| **Zone de saisie** | `#message-input-area` | Contient le textarea, le bouton fichier et le bouton envoyer. |
| **Textarea** | `#community-message-input` | Zone de saisie du message. |
| **Bouton fichier** | `#community-file-button` | Icône dossier. Déclenche `#community-file-input`. Accepte : `image/*, video/*, .pdf, .doc, .docx, .txt, .zip, .rar`. |
| **Input fichier** | `#community-file-input` | Input masqué pour la sélection de fichier. |
| **Bouton envoyer** | `#send-community-message-btn` | Icône ➤. Envoie le message (texte + fichier optionnel) via `POST /public/api/community/send-message`. |

### 5.3 Menu de création (+)

**Container** : `#create-menu-overlay` (masqué par défaut)

Menu contextuel qui apparaît en cliquant sur le bouton ➕.

| Bouton | `data-action` | Détails |
|--------|---------------|---------|
| **"Nouveau groupe"** | `newGroup` | Ouvre le modal de création de groupe |
| **"Nouveau sujet"** | `newTopic` | Ouvre le modal de création de sujet |
| **"Nouveau fill"** | `newFill` | Ouvre le modal de création de fill |
| **"Message privé"** | `newMp` | Ouvre le modal de création de MP |

### 5.4 Modal Donner des Points

**Container** : `#give-points-overlay`

| Élément | ID | Détails |
|---------|----|---------|
| **Titre** | `<h3>` | "Donner des points" |
| **Bouton fermer** | `#close-give-points-btn` | Bouton × |
| **Solde actuel** | `#give-points-current-balance` | Affiche les points actuels de l'utilisateur dans une carte visuelle |
| **Champ Destinataire** | `#give-points-recipient` | Input texte avec autocomplétion. Les suggestions apparaissent dans `#give-points-suggestions`. |
| **Champ Montant** | `#give-points-amount` | Input nombre (`min="1"`). |
| **Bouton Envoyer** | `<button type="submit">` | "Envoyer les points". Appelle l'API pour transférer les points. |

### 5.5 Modal de création : Groupe

**Container** : `#create-modal-overlay` > `#group-form`

Assistant en 2 étapes :

**Étape 1** (`#group-step-1`) — Informations :
| Élément | ID | Détails |
|---------|----|---------|
| **Nom du groupe** | `#group-name` | Input texte, requis |
| **Description** | `#group-description` | Textarea, 3 lignes |
| **Photo** | `#group-photo` | Input fichier (`accept="image/*"`), facultatif |
| **Avertissement coût** | `#group-cost-warning` | "⚠️ Créer un groupe coûte 30 pt." |
| **Bouton suivant** | `#group-next-btn` | "Étape suivante" |

**Étape 2** (`#group-step-2`) — Membres :
| Élément | ID | Détails |
|---------|----|---------|
| **Recherche de membres** | `#group-members-search` | Input texte avec autocomplétion (`#group-members-suggestions`) |
| **Liste de membres ajoutés** | `#group-members-list` | Affiche les membres sélectionnés avec possibilité de retirer |
| **Bouton "Retour"** | `#group-back-btn` | Revient à l'étape 1 |
| **Bouton "Créer le groupe"** | `#group-create-btn` | Soumet le formulaire. Envoie `POST /public/api/community/create-group`. Déduit 30 points. |

### 5.6 Modal de création : Sujet

**Container** : `#topic-form`

Assistant en 3 étapes :

**Étape 1** (`#topic-step-1`) — Informations :
| Élément | ID | Détails |
|---------|----|---------|
| **Nom du sujet** | `#topic-name` | Input texte, requis |
| **Description** | `#topic-description` | Textarea, 3 lignes |
| **Bouton suivant** | `#topic-next-btn` | "Étape suivante" |

**Étape 2** (`#topic-step-2`) — Durée :
| Élément | ID | Détails |
|---------|----|---------|
| **Durée** | `#topic-duration` | `<select>` avec 4 options : 12h, 24h (défaut), 48h, 5j |
| **Bouton "Retour"** | `#topic-back-btn` | Revient à l'étape 1 |
| **Bouton suivant** | `#topic-next-btn-2` | "Étape suivante" |

**Étape 3** (`#topic-step-3`) — Confirmation :
| Élément | Détails |
|---------|---------|
| **Avertissement coût** | "⚠️ Créer un sujet coûte 5 pt." |
| **Bouton "Retour"** | Revient à l'étape 2 |
| **Bouton "Créer le sujet"** | Soumet le formulaire. Déduit 5 points. |

### 5.7 Modal de création : Fill

**Container** : `#fill-form`

Formulaire en une seule étape :

| Élément | ID | Détails |
|---------|----|---------|
| **Nom du fill** | `#fill-name` | Input texte, requis |
| **Description** | `#fill-description` | Textarea, 3 lignes |
| **Type parent** | `#fill-parent-type` | Input hidden, valeur "topic" |
| **Sélecteur Sujet parent** | `#fill-parent-topic` | `<select>` populé dynamiquement avec les sujets existants |
| **Recherche de membres** | `#fill-members-search` | Input texte avec autocomplétion (`#fill-members-suggestions`) |
| **Liste de membres** | `#fill-members-list` | Membres ajoutés |
| **Bouton "Créer le fill"** | `<button type="submit">` | Crée le fill (gratuit). |

### 5.8 Modal de création : Message Privé

**Container** : `#mp-form`

| Élément | ID | Détails |
|---------|----|---------|
| **Destinataire** | `#mp-recipient` | Input texte avec autocomplétion (`#recipient-suggestions`). Recherche parmi tous les utilisateurs. |
| **Bouton "Créer la conversation"** | `<button type="submit">` | Crée la conversation privée (gratuit). |

### 5.9 Modal Profil Utilisateur

**Container** : `#user-profile-modal`

S'ouvre en cliquant sur l'avatar d'un utilisateur dans un message.

| Élément | ID | Détails |
|---------|----|---------|
| **Titre** | `.modal-title` | "Profil Utilisateur" |
| **Bouton fermer** | `#close-user-profile-btn` | Bouton × |
| **Bannière** | `#profile-modal-banner` | Div avec classe dynamique selon le thème choisi par l'utilisateur (ex: `.social-banner-oceanic`) |
| **Avatar** | `#profile-modal-avatar` | Photo de profil de l'utilisateur |
| **Nom** | `#profile-modal-username` | Nom d'utilisateur |
| **Étoiles des cours** | `#profile-modal-stars` | Note moyenne des cours déposés par cet utilisateur (rendu en étoiles quart par quart) |
| **Date de naissance** | `#profile-modal-birthdate` | "Date de naissance : JJ/MM/AAAA" |
| **Vitrine badges** | `#profile-showcase-badges` | 3 badges mis en avant par l'utilisateur |
| **Badges actuels** | `#profile-current-badges` | Tous les badges actuellement actifs |
| **Badges possédés** | `#profile-obtained-badges` | Historique de tous les badges débloqués |
| **Bouton MP** | `#start-private-conversation-btn` | "Démarrer une conversation privée" — crée un MP avec cet utilisateur |

### 5.10 Menu contextuel de message

**Container** : `#message-context-menu` (masqué, apparaît au clic droit ou long press sur un message)

**Réactions rapides** (`.context-menu-reactions`) :
| Emoji | `data-emoji` |
|-------|-------------|
| 👍 | `👍` |
| ❤️ | `❤️` |
| 😂 | `😂` |
| 😮 | `😮` |
| 😢 | `😢` |
| 🔥 | `🔥` |

**Actions** :
| Action | `data-action` | Icône | Détails |
|--------|---------------|-------|---------|
| **Répondre** | `reply` | ↩ | Cite le message dans la zone de réponse |
| **Signaler** | `report` | ⚠ | Signale le message (max 2 signalements/jour, 3 signalements → warning) |
| **Copier** | `copy` | 📋 | Copie le texte du message dans le presse-papiers |

### 5.11 Visionneuse d'images

**Container** : `#image-viewer-overlay` (masqué)

S'ouvre en cliquant sur une image dans un message.

| Élément | ID | Détails |
|---------|----|---------|
| **Bouton fermer** | `#close-image-viewer-btn` | Bouton × |
| **Image** | `#image-viewer-img` | Image en taille réelle |
| **Bouton télécharger** | `#download-image-btn` | Lien `<a>` avec attribut `download`. "Télécharger" |

### 5.12 Panneau Détails de Groupe

**Container** : `#group-details-overlay`

S'ouvre en cliquant sur le titre de la discussion (pour un groupe).

| Élément | ID | Détails |
|---------|----|---------|
| **Titre** | `.group-details-title` | "Détails du groupe" |
| **Bouton fermer** | `#close-group-details-btn` | Bouton × |
| **Photo du groupe** | `#group-details-photo` | Image du groupe (défaut: `grpicon.png`) |
| **Bouton "Changer l'icône"** | `#group-details-change-photo-btn` | Déclenche `#group-details-photo-input` |
| **Input photo** | `#group-details-photo-input` | Input fichier masqué |
| **Nom modifiable** | `#group-details-name` | Input texte éditable |
| **Sauver le nom** | `#group-details-save-name` | Bouton "Enregistrer le nom" (masqué jusqu'à modification) |
| **Description modifiable** | `#group-details-description` | Textarea éditable |
| **Sauver la description** | `#group-details-save-description` | Bouton "Enregistrer la description" |
| **Nombre de membres** | `#group-details-members-count` | Ex: "5 membres" |
| **Nombre de messages** | `#group-details-messages-count` | Ex: "42 messages" |
| **Liste des membres** | `#group-details-members` | Affiche chaque membre avec son avatar |
| **Bouton "Quitter"** | `#group-details-leave-btn` | "Quitter le groupe" — si l'utilisateur est admin, affiche le transfert d'admin |
| **Transfert d'admin** | `#group-admin-transfer` | Masqué. Apparaît quand un admin veut quitter : sélecteur de successeur (`#group-admin-successor`) + boutons Annuler/Confirmer |
| **Bouton "Supprimer"** | `#group-details-delete-btn` | Masqué. Visible uniquement si le groupe est vide. |

### 5.13 Panneau Détails de Fill

**Container** : `#fill-details-overlay`

S'ouvre en cliquant sur le titre de la discussion (pour un fill).

| Élément | ID | Détails |
|---------|----|---------|
| **Titre** | `.group-details-title` | "Détails du fill" |
| **Bouton fermer** | `#close-fill-details-btn` | Bouton × |
| **Nom** | `#fill-details-name` | Input texte (désactivé, lecture seule) |
| **Description** | `#fill-details-description` | Textarea (désactivé, lecture seule) |
| **Créateur** | `#fill-details-created-by` | "Créé par : {username}" |
| **Parent** | `#fill-details-parent` | "Parent : {sujet ou groupe}" |
| **Expiration** | `#fill-details-expires` | "Expire : {date}" |
| **Messages** | `#fill-details-messages-count` | "X messages" |
| **Membres** | `#fill-details-members-count` + `#fill-details-members` | Nombre et liste des membres |
| **Bouton "Demander à rejoindre"** | `#fill-details-request-btn` | Masqué. Visible si l'utilisateur n'est pas membre. Max 3 demandes/jour. |
| **Bouton "Quitter"** | `#fill-details-leave-btn` | Masqué. Visible si l'utilisateur est membre. |
| **Transfert d'admin** | `#fill-admin-transfer` | Même principe que pour les groupes |
| **Bouton "Supprimer"** | `#fill-details-delete-btn` | Masqué. Visible uniquement pour l'admin si le fill est vide. |

### 5.14 Bulle action rapide (Créer un fill)

**Container** : `#quick-create-bubble` (masqué)

| Élément | ID | Détails |
|---------|----|---------|
| **Bouton** | `#quick-create-fill-btn` | "Créer un fill" — Raccourci pour créer un fill dans le sujet actuellement ouvert |

### 5.15 Tooltip Badge

**Container** : `#badge-tooltip` (masqué, suit la souris)

| Élément | ID | Détails |
|---------|----|---------|
| **Nom du badge** | `#badge-tooltip-name` | Titre du badge au survol |
| **Description** | `#badge-tooltip-description` | Description détaillée du badge |

---

## 6. Page Cours (cours.html)

Page de gestion des cours partagés par les élèves.

### 6.1 Barre de recherche et filtres

**Container** : `#course-filters`

| Élément | ID | Détails |
|---------|----|---------|
| **Recherche par titre** | `#search-title-input` | Input texte, placeholder "Rechercher par titre..." |
| **Recherche par ID** | `#search-id-input` | Input nombre (`min="1"`), placeholder "Rechercher par ID..." |
| **Filtre par matière** | `#filter-subject-select` | `<select>` avec : "Toutes les matières", Mathématiques, Histoire, Français, Physique-Chimie, Anglais |
| **Bouton réinitialiser** | `#reset-filters-btn` | "Réinitialiser" — Efface tous les filtres |
| **Compteur** | `#course-counter-box` | "Cours : X" — Nombre de cours affichés |

### 6.2 Grille de cours

**Container** : `#file-grid`

Grille CSS grid (`display: grid; place-items: center;`) générée dynamiquement.

Chaque carte de cours contient :
- Titre du cours
- Matière (badge coloré)
- Auteur (nom du déposant)
- Étoiles (note moyenne en quarts d'étoile via `renderQuarterStarsHtml()`)
- Nombre de votes
- Statut (waiting/normal/suspension)
- Bouton pour voir les détails
- Bouton pour voter

### 6.3 Modal Détails d'un cours

**Container** : `#details-modal` (défini dans `index.html`)

| Élément | ID | Détails |
|---------|----|---------|
| **Titre** | `#details-title` | Titre du cours |
| **Bouton fermer** | `#close-details-btn` | Bouton × |
| **Contenu** | `#details-content` | Description, fichier joint (lien de téléchargement ou preview), informations sur l'auteur, date de dépôt, statut d'évaluation |

### 6.4 Modal Dépôt d'un cours

**Container** : `#deposit-modal` (défini dans `index.html`)

| Élément | ID | Détails |
|---------|----|---------|
| **Titre du cours** | `#deposit-title` | Input texte, requis, placeholder "Ex: Algèbre Avancée" |
| **Matière** | `#deposit-subject` | `<select>` avec 13 matières : Mathématiques, Histoire, Français, Physique-Chimie, Anglais, Espagnol, SVT, Technologie, Musique, Arts Plastiques, Latin, Grec, Brevet |
| **Description** | `#deposit-description` | Textarea, placeholder "Courte description du contenu..." |
| **Fichier** | `#deposit-file-upload` | Input file avec label personnalisé "Sélectionner le Fichier". Affiche le statut "Aucun fichier sélectionné." |
| **Preview** | `#file-preview-thumbnail` | Masqué. Affiche un aperçu de l'image si le fichier est une image. |
| **Bouton soumettre** | `#submit-deposit-btn` | "Déposer le cours" — Envoie via `POST /api/deposit-course` (multipart/form-data) |

### 6.5 Modal Vote / Étoiles

**Container** : `#star-vote-modal` (défini dans `index.html`)

| Élément | ID | Détails |
|---------|----|---------|
| **Titre** | `<h2>` | "Noter ce cours" |
| **Bouton fermer** | `#close-star-vote-btn` | Bouton × |
| **Étoiles actuelles** | `#vote-modal-stars` | Rendu visuel des étoiles actuelles du cours |
| **Note numérique** | `#vote-modal-rating` | "X.X/5" |
| **Nombre de votes** | `#vote-modal-count` | "X vote(s)" |
| **Bouton "Bon"** | `.vote-good` (`data-value="1"`) | Vote positif. Couleur verte. |
| **Bouton "Moyen"** | `.vote-medium` (`data-value="0.5"`) | Vote neutre. Couleur jaune/orange. |
| **Bouton "Mauvais"** | `.vote-bad` (`data-value="-1"`) | Vote négatif. Couleur rouge. |

### 6.6 Bouton flottant "Déposer un cours"

| Élément | ID | Détails |
|---------|----|---------|
| **Bouton** | `#deposit-course-button` | Bouton fixe visible uniquement sur la page Cours. Ouvre `#deposit-modal`. |

---

## 7. Page Messagerie (mess.html)

Système de messagerie interne avec support des Rescues (SOS Cours).

### 7.1 Onglets de navigation

**Container** : `#mess-tabs-header`

| Onglet | `data-target` | Détails |
|--------|---------------|---------|
| **Messagerie** | `messagerie-wrapper` | Vue messagerie interne (actif par défaut) |
| **ED** | `ed-wrapper` | Vue messagerie École Directe (si connecté) |

### 7.2 Sidebar Boîte de réception

**Container** : `#inbox-sidebar`

| Élément | ID | Détails |
|---------|----|---------|
| **Bouton "Nouveau"** | `#compose-message-btn` | Classe `primary`. Icône stylo. Ouvre le formulaire de composition. |
| **Bouton "Sauvetage"** | `#rescue-message-btn` | Classe `warning`. Icône drapeau. Ouvre le formulaire de rescue. |
| **Liste des messages** | `#message-list-inbox` | Messages reçus, triés par date. Chaque message affiche : sujet, expéditeur, date, badge "non lu" si applicable. |

### 7.3 Écran d'accueil messagerie

**Container** : `#messaging-welcome-screen` (actif par défaut)

| Élément | Détails |
|---------|---------|
| **Titre** | "Source de Messages" |
| **Description** | "Cliquez sur "Nouveau" pour envoyer un nouveau message ou sélectionnez un message dans la liste." |

### 7.4 Formulaire "Nouveau Message"

**Container** : `#compose-form-container` (masqué par défaut)

| Élément | ID | Détails |
|---------|----|---------|
| **Titre** | `<h2>` | "Nouveau Message" |
| **Destinataire(s)** | `#recipient-input-field` | Input texte avec autocomplétion (`#autocomplete-list`). Recherche parmi tous les utilisateurs. |
| **IDs cachés** | `#selected-recipients-ids` | Input hidden stockant les IDs des destinataires sélectionnés |
| **Bouton "Ajouter toute la classe"** | `#add-all-class-btn` | Ajoute tous les élèves comme destinataires |
| **Objet** | `#message-subject` | Input texte, requis, placeholder "Objet du message" |
| **Corps** | `#message-body` | Textarea (12 lignes), requis, placeholder "Tape ton message ici..." |
| **Checkbox anonyme** | `#is-anonymous-checkbox` | Si coché, le message est envoyé anonymement (coût : 3 points) |
| **Bouton "Joindre Fichier"** | `#attach-file-btn` | Ouvre un sélecteur de fichier. Affiche le compteur entre parenthèses (ex: "(2)") |
| **Bouton "Envoyer"** | `<button type="submit">` | Classe `primary`. Envoie le message via l'API. |
| **Bouton "Annuler/Effacer"** | `<button type="reset">` | Classe `secondary`. Remet le formulaire à zéro. |

### 7.5 Formulaire "Sauvetage" (Rescue)

**Container** : `#rescue-form-container` (masqué par défaut)

| Élément | ID | Détails |
|---------|----|---------|
| **Titre** | `<h2>` | "Sauvetage" |
| **Info coût** | `<p class="hint">` | "Coût : 5 points. Destinataire unique : Source AI. Le premier cours validé gagne 15 points." |
| **Objet** | `#rescue-subject` | Input texte, requis, placeholder "Ex: Cours de maths manqué" |
| **Demande** | `#rescue-body` | Textarea (10 lignes), requis, placeholder "Explique ce qu'il te manque, le chapitre, les consignes, la date, etc." |
| **Bouton "Lancer le sauvetage"** | `<button type="submit">` | Classe `warning`. Texte "Lancer le sauvetage (-5 pts)". Envoie la demande à l'IA qui identifie les candidats. |
| **Bouton "Annuler"** | `#cancel-rescue-btn` | Classe `secondary`. Ferme le formulaire. |

### 7.6 Vue détail d'un message

**Container** : `#message-detail-view` (masqué par défaut)

Apparaît quand on clique sur un message dans la boîte de réception.

| Élément | ID | Détails |
|---------|----|---------|
| **Objet** | `#detail-subject` | Objet du message |
| **Expéditeur** | `#detail-sender` > `.sender-name-detail` | "De : {nom}" |
| **Destinataires** | `#detail-recipients` > `.recipients-list-detail` | "À : {liste}" |
| **Corps** | `#detail-body-content` | Contenu du message (HTML nettoyé) |
| **Pièces jointes** | `#detail-attachments` | Liste des fichiers joints (liens de téléchargement) |
| **Actions Rescue** | `#rescue-actions` | Masqué. Visible si c'est un rescue : affiche les réponses et bouton de vote (pouce en l'air). |
| **Bouton "Répondre"** | `#reply-to-message-btn` | Classe `primary`. Ouvre le formulaire de composition pré-rempli avec le destinataire et "Re: {objet}". |

**Navigation mobile** : Un bouton `#mobile-message-close-btn` (×) permet de revenir à la liste sur petit écran.

---

## 8. Page Cartable (cartable.html)

Intégration avec École Directe pour les notes et devoirs.

### 8.1 Panneau de connexion École Directe

**Container** : `#cartable-login-panel` (affiché par défaut)

| Élément | ID | Détails |
|---------|----|---------|
| **Titre** | `<h2>` | "Connexion École Directe" |
| **Description** | `<p>` + `<ul>` | Liste des avantages : accès aux notes, emploi du temps, devoirs, IA personnalisée |
| **Identifiant ED** | `#ed-identifiant` | Input texte, `autocomplete="username"`, placeholder "Identifiant ED" |
| **Mot de passe ED** | `#ed-motdepasse` | Input mot de passe, `autocomplete="current-password"`, placeholder "Mot de passe ED" |
| **Bouton "Se connecter"** | `<button type="submit">` | Envoie les identifiants via `POST /ed/login` |
| **Note sécurité** | `.form-hint` | "Tes identifiants sont chiffrés." |
| **Statut** | `#cartable-login-status` | Message de statut (masqué par défaut) |
| **Erreur** | `#cartable-login-error` | Message d'erreur (masqué par défaut) |

### 8.2 Écran de chargement

**Container** : `#cartable-connecting` (masqué par défaut)

| Élément | Détails |
|---------|---------|
| **Spinner** | `.connecting-spinner` — animation CSS de chargement |
| **Titre** | "Connexion en cours..." |
| **Message** | "Veuillez patienter pendant que nous vous connectons à École Directe" |

### 8.3 Onglets Notes / Devoirs

**Container** : `#cartable-content` > `.cartable-tabs` (masqué avant connexion ED)

| Onglet | `data-tab` | Détails |
|--------|-----------|---------|
| **Notes** | `notes` | Onglet actif par défaut |
| **Devoirs** | `devoirs` | Onglet secondaire |

### 8.4 Panneau Notes

**Container** : `#panel-notes`

| Élément | ID | Détails |
|---------|----|---------|
| **Titre** | `<h2>` | "Mes Notes" (visible desktop uniquement) |
| **Sélecteur Période** | `#notes-periode` | `<select>` populé dynamiquement avec les périodes scolaires (Trimestre 1/2/3 etc.) |
| **Conteneur notes** | `#notes-container` | Tableau de notes par matière, généré dynamiquement. Chaque matière est cliquable et ouvre le modal de détail. |

### 8.5 Panneau Devoirs

**Container** : `#panel-devoirs`

| Élément | ID | Détails |
|---------|----|---------|
| **Titre** | `<h2>` | "Cahier de texte" (visible desktop uniquement) |
| **Conteneur devoirs** | `#devoirs-container` | Liste des devoirs par date, générée dynamiquement. Chaque devoir est cliquable et ouvre le modal de détail. |

### 8.6 Modal Notes par matière

**Container** : `#notes-modal`

| Élément | ID | Détails |
|---------|----|---------|
| **Nom de la matière** | `#modal-matiere-name` | "Notes de {Matière}" |
| **Bouton graphique** | `#modal-graph-btn` | Icône adaptative (classe `.adaptive-icon`). Ouvre le modal graphique. |
| **Bouton simulation** | `#modal-sim-btn` | Icône "∑". Ouvre le modal de simulation de note. |
| **Bouton fermer** | `#modal-close-btn` | Bouton ✕ |
| **Liste des notes** | `#modal-notes-list` | Toutes les notes de la matière avec : valeur/barème, coefficient, date, commentaire. |

### 8.7 Modal Graphique des notes

**Container** : `#graph-modal`

| Élément | ID | Détails |
|---------|----|---------|
| **Titre** | `#graph-modal-title` | "Graphique" |
| **Bouton fermer** | `#graph-modal-close` | Bouton ✕ |
| **Canvas** | `#notes-chart` | Graphique Chart.js (courbe d'évolution des notes dans la matière) |

### 8.8 Modal Simulation de note

**Container** : `#sim-modal`

| Élément | ID | Détails |
|---------|----|---------|
| **Titre** | `#sim-modal-title` | "Simulation" |
| **Bouton fermer** | `#sim-modal-close` | Bouton ✕ |
| **Corps** | `#sim-modal-body` | Interface de simulation permettant d'ajouter une note fictive et de voir l'impact sur la moyenne. Contenu généré dynamiquement. |

### 8.9 Modal Détail d'un devoir

**Container** : `#devoir-modal`

| Élément | ID | Détails |
|---------|----|---------|
| **Titre** | `#devoir-modal-title` | "Devoir" |
| **Bouton fermer** | `#devoir-modal-close` | Bouton ✕ |
| **Corps** | `#devoir-modal-body` | Contenu du devoir : matière, date, consignes, pièces jointes. Contenu HTML décodé depuis base64 (format École Directe). |

---

## 9. Page Mon Compte (moncompte.html)

Page de gestion du profil, de la boutique et de l'inventaire.

### 9.1 Header de profil

**Container** : `#user-profile-header`

| Élément | ID | Détails |
|---------|----|---------|
| **Avatar** | `#user-avatar` | Photo de profil dans un wrapper cliquable (`#user-avatar-wrapper`). Overlay avec icône de modification au survol. Clic → ouvre le modal photo. |
| **Nom** | `#user-name` | Nom d'utilisateur |
| **Badges actuels** | `#user-current-badges` | Badges affichés à côté du nom |
| **Étoiles des cours** | `#user-course-stars` + `#user-course-stars-value` | Note moyenne des cours déposés par l'utilisateur |
| **Âge** | `#user-age` | "X ans" |

### 9.2 Actions rapides

**Container** : `#profile-quick-actions`

| Bouton | ID | Détails |
|--------|----|---------|
| **"Modifier profil"** | `#open-profile-editor-btn` | Ouvre le modal éditeur de profil social |

### 9.3 Section gauche : Boutique, Inventaire, Badges

**Container** : `#account-left-section`

| Bouton | ID | Détails |
|--------|----|---------|
| **Boutique** | `#shop-btn` | Ouvre le modal Boutique (`#shop-modal`) |
| **Inventaire** | `#inventory-btn` | Ouvre le modal Inventaire (`#inventory-modal`) |
| **Badges** | `#badges-btn` | Ouvre le modal Badges (`#badges-modal`) |

### 9.4 Section droite : Mot de passe, Infos compte

**Container** : `#account-right-section`

| Bouton | ID | Détails |
|--------|----|---------|
| **Changer de mot de passe** | `#change-password-btn` | Ouvre le modal Mot de passe (`#password-modal`) |
| **Informations du compte** | `#account-info-btn` | Ouvre le modal Informations (`#account-info-modal`) |

### 9.5 Footer : Déconnexion

**Container** : `#account-footer-section`

| Bouton | ID | Détails |
|--------|----|---------|
| **Déconnexion** | `#logout-button` | Supprime `source_username` du `localStorage` → redirection vers `/pages/login.html` |
| **Déconnexion École Directe** | `#logout-ed-btn` | Déconnecte uniquement la session École Directe (efface les caches ED du `localStorage`) |

### 9.6 Modal Éditeur de profil social

**Container** : `#profile-editor-modal`

| Élément | ID | Détails |
|---------|----|---------|
| **Titre** | `#profile-editor-modal-title` | "Modifier profil" |
| **Bouton fermer** | `#close-profile-editor-btn` | Bouton × |

**Aperçu bannière** (`#social-banner-preview`) : Preview en temps réel de la bannière choisie.

**Carte Bannière** :
| Élément | ID | Détails |
|---------|----|---------|
| **Sélecteur thème** | `#social-banner-select` | `<select>` avec les thèmes de bannière disponibles (ex: oceanic, sunset, forest, etc.) |
| **Bouton "Appliquer"** | `#save-social-banner-btn` | Sauvegarde le choix de bannière via `POST /api/user-social-profile` |

**Carte Vitrine de badges** :
| Élément | ID | Détails |
|---------|----|---------|
| **Preview vitrine** | `#social-badge-showcase` | Affiche les 3 badges actuellement mis en avant |
| **Slot 1** | `#social-badge-slot-1` | `<select>` pour choisir le badge de l'emplacement 1 |
| **Slot 2** | `#social-badge-slot-2` | `<select>` pour choisir le badge de l'emplacement 2 |
| **Slot 3** | `#social-badge-slot-3` | `<select>` pour choisir le badge de l'emplacement 3 |
| **Bouton "Sauver"** | `#save-social-showcase-btn` | Sauvegarde les 3 badges choisis |

**Carte Contributions** :
| Élément | ID | Détails |
|---------|----|---------|
| **Contributions** | `#stat-contributions` | Nombre total de contributions |
| **Likes reçus** | `#stat-likes-received` | Nombre de likes reçus |
| **Likes donnés** | `#stat-likes-given` | Nombre de likes donnés |

### 9.7 Modal Photo de profil

**Container** : `#avatar-modal`

| Élément | ID | Détails |
|---------|----|---------|
| **Titre** | `#avatar-modal-title` | "Changer la photo de profil" |
| **Aperçu** | `#avatar-preview` | Image actuelle |
| **Input fichier** | `#avatar-file-input` | Input file masqué (`accept="image/*"`) |
| **Bouton "Sélectionner"** | `#select-avatar-btn` | Déclenche le sélecteur de fichier |
| **Bouton "Valider"** | `#validate-avatar-btn` | Upload la nouvelle photo via l'API |

### 9.8 Modal Mot de passe

**Container** : `#password-modal`

| Élément | ID | Détails |
|---------|----|---------|
| **Titre** | `#password-modal-title` | "CHANGER LE MOT DE PASSE" |
| **Nouveau mot de passe** | `#new-password` | Input password |
| **Confirmation** | `#confirm-password` | Input password |
| **Bouton "Valider"** | `#validate-password-btn` | Envoie le nouveau mot de passe au serveur (hashé en bcrypt côté serveur) |

### 9.9 Modal Informations du compte

**Container** : `#account-info-modal`

Affiche en lecture seule :

| Élément | ID | Détails |
|---------|----|---------|
| **Nom d'utilisateur** | `#info-username` | Nom du compte |
| **Date de naissance** | `#info-birthdate` | JJ/MM/AAAA |
| **Nombre de connexions** | `#info-connexions` | Total de connexions |
| **Dernière connexion** | `#info-last-connexion` | Date/heure de la dernière connexion |
| **Chemin photo** | `#info-profile-pic` | Chemin du fichier photo de profil sur le serveur |

### 9.10 Modal Badges

**Container** : `#badges-modal`

3 sections :

| Section | ID | Détails |
|---------|----|---------|
| **Badges actuels** | `#current-badges-list` | Grille (`.badges-grid`) des badges actuellement actifs. Chaque badge est un `<div class="badge-item">` avec emoji et tooltip. |
| **Badges déjà obtenus** | `#obtained-badges-list` | Historique de tous les badges débloqués par le passé. |
| **Tous les badges** | `#all-badges-list` | Catalogue complet des 26+ badges existants. Les badges non débloqués apparaissent grisés. |

### 9.11 Modal Inventaire

**Container** : `#inventory-modal`

**Onglets** (`.inventory-tabs`) :

| Onglet | `data-inventory-tab` | Détails |
|--------|---------------------|---------|
| **Thèmes** | `themes` | Actif par défaut |
| **Fonds** | `fonds` | Fonds d'écran |

**Panel Thèmes** (`data-inventory-tab-panel="themes"`) :
| Élément | ID | Détails |
|---------|----|---------|
| **Thème équipé** | `#current-skin-card` | Carte du thème actuellement actif (icône 🎨, nom, statut "Actuellement équipé") |
| **Grille des thèmes** | `#inventory-skins-grid` | Tous les thèmes achetés. Chaque item a un bouton "Équiper" pour changer de skin. |

**Panel Fonds** (`data-inventory-tab-panel="fonds"`) :
| Élément | ID | Détails |
|---------|----|---------|
| **Fond équipé** | `#current-fond-card` | Carte du fond actuellement actif (icône 🖼️, nom, statut) |
| **Grille des fonds** | `#inventory-fonds-grid` | Tous les fonds achetés avec bouton "Équiper". |

### 9.12 Modal Boutique

**Container** : `#shop-modal`

**Header** :
| Élément | ID | Détails |
|---------|----|---------|
| **Points** | `#shop-user-points` | "Mes points: X pts" |

**Onglets** (`.shop-tabs`) :

| Onglet | `data-shop-tab` | Détails |
|--------|-----------------|---------|
| **Thèmes** | `themes` | Actif par défaut |
| **Fonds** | `fonds` | Fonds d'écran |

**Panel Thèmes** — Section "Thèmes de page" (`#skins-grid`) :

Chaque article est un `<div class="shop-item">` avec :
- **Tag de rareté** (`.shop-item-tag`) : Basique, Doux, Futuriste, Nature, Chaleur, Élégant, Exotique, Rétro, Gratuit
- **Icône** (`.shop-item-icon`) : Emoji représentatif
- **Nom** (`.shop-item-name`)
- **Description** (`.shop-item-description`)
- **Prix** (`.shop-item-price`) : en points
- **Bouton "Acheter"** (`.shop-buy-btn`) : Appelle `POST /api/shop-purchase` avec vérification du solde côté serveur

**Catalogue complet des skins** :

| Skin | Emoji | Tag | Prix | Description |
|------|-------|-----|------|-------------|
| Verdure | 🎨 | Basique | 28 pts | Un thème naturel et apaisant |
| Pastel | 🩰 | Doux | 32 pts | Couleurs douces et ambiance légère |
| Cyberpunk | 🤖 | Futuriste | 38 pts | Violet, bleu néon, rose flashy, effet lumineux |
| Forêt | 🌲 | Nature | 30 pts | Tons verts et bruns, ambiance nature |
| Sable chaud | 🏖️ | Chaleur | 28 pts | Jaune doré, orange, effet granuleux |
| Minuit | 🌙 | Élégant | 36 pts | Bleu nuit profond, touches argentées |
| Océan | 🌊 | Nature | 32 pts | Profondeurs marines et lueurs bioluminescentes |
| Lavande | 💜 | Doux | 30 pts | Violet doux et apaisant, ambiance zen |
| Cerise | 🌸 | Exotique | 34 pts | Fleurs de cerisier, esthétique japonaise |
| Arctique | ❄️ | Élégant | 36 pts | Bleu glacé et givre, froid élégant |
| Obsidienne Royale | 🎨 | Exotique | 35 pts | L'élégance des profondeurs |
| Sunset Lofi | 🎨 | Exotique | 40 pts | Ambiance crépusculaire relaxante |
| Grenat | 🎨 | Basique | 26 pts | Rouge profond et chaleureux |
| Rose Pâle | 🎨 | Basique | 30 pts | Douceur et délicatesse |
| Néon | 🎨 | Exotique | 38 pts | Vivacité électrique et moderne |
| Chocolat Velours | 🎨 | Basique | 24 pts | Douceur riche et enveloppante du chocolat pur |
| Rêve Indigo | 🎨 | Exotique | 36 pts | Profondeur mystérieuse des rêves nocturnes |
| Jaune Basique | ☀️ | Gratuit | 0 pts | Chaleur ensoleillée et rayonnante |
| Marbre Anthracite | 🪨 | Basique | 34 pts | Élégance minimaliste et sophistiquée |
| Aurore Boréale | ✨ | Exotique | 45 pts | Magie fluorescente des lumières célestes |

**Section "Pass"** (`#pass-grid`) :
- Bundles/packs d'articles avec réduction (chargés dynamiquement depuis l'API).

**Panel Fonds** — Section "Fonds" (`#backgrounds-grid`) :

| Fond | Emoji | Tag | Prix | Description |
|------|-------|-----|------|-------------|
| Vagues (par défaut) | — | — | Gratuit | Vagues SVG animées (fond par défaut) |
| Vagues inversées | 🖼️ | Basique | 30 pts | Les vagues en haut, retournées |
| Pixel Art | 🟪 | Rétro | 34 pts | Effet mosaïque animée façon pixels rétro |
| Aurore | 🌌 | Boréale | 38 pts | Dégradés mouvants façon aurores boréales |
| Papier froissé | 📄 | Texture | 26 pts | Texture animée de papier froissé |
| Linéaire | 📐 | Basique | 28 pts | Lignes diagonales qui grossissent puis rétrécissent |
| Ondes | 🫧 | Basique | 22 pts | Cercles qui partent du centre et s'agrandissent |
| Duel | ⚔️ | Exotique | 35 pts | Deux points qui se déplacent et changent de couleur |

---

## 10. Page Infos & Statistiques (info.html)

Page de visualisation des statistiques personnelles et du classement.

### 10.1 En-tête statistiques

**Container** : `#stats-header`

| Élément | ID | Détails |
|---------|----|---------|
| **Nom utilisateur** | `#user-name-placeholder` | Nom de l'utilisateur connecté |
| **Points individuels** | `#individual-points` | Score personnel |
| **Points collectifs** | `#collective-points` | Points accumulés par la classe entière |

### 10.2 Barre de progression hebdomadaire

**Container** : `#progress-bar-container` > `#week-progress-bar`

Barre visuelle indiquant la progression du défi de la semaine. Remplie dynamiquement.

### 10.3 Graphique d'évolution des points

**Container** : `#points-chart-container`

| Élément | ID | Détails |
|---------|----|---------|
| **Titre** | `<h3>` | Icône graphique + "Évolution de tes points" |
| **Canvas** | `#points-chart` | Graphique Chart.js en courbe (line chart). Historique de l'évolution des points dans le temps (données depuis `graph_pt[]` dans le profil utilisateur). |

### 10.4 Camembert "Comment tu gagnes tes points"

**Container** : `#points-pie-widget`

| Élément | ID | Détails |
|---------|----|---------|
| **Titre** | `<h3>` | "Comment tu gagnes tes points ?" |
| **Canvas** | `#points-pie-chart` | Graphique Chart.js en camembert (pie chart). Répartition des sources de points (connexions, messages, votes, rescues, etc.). |
| **Légende** | `#points-pie-legend` | Légende du camembert |

### 10.5 Widget Classement (version Infos)

**Container** : `#leaderboard-display-infos`

IDs suffixés `-infos` pour éviter les conflits avec le classement de la page Accueil.

| Élément | ID | Détails |
|---------|----|---------|
| **Titre** | `<h3>` | "🏆 Classement général" |
| **Leader** | `#leader-username-infos` / `#leader-points-infos` | #1 |
| **#2** | `#second-username-infos` / `#second-points-infos` | 2ème |
| **#3** | `#third-username-infos` / `#third-points-infos` | 3ème |
| **Rang utilisateur** | `#user-rank-infos` | Position actuelle |
| **Score utilisateur** | `#user-score-infos` | Points actuels |

---

## 11. Page Ban (ban.html)

Page autonome (pas dans le SPA). Affichée quand un utilisateur est banni.

| Élément | ID/Classe | Détails |
|---------|-----------|---------|
| **Overlay** | `.banned-overlay` | Fond sombre couvrant toute la page |
| **Image** | `.banned-image` | Image "BANNED" (`banned.png`) |
| **Titre** | `.banned-title` | "TU AS ÉTÉ BANNI" |
| **Séparateur** | `.banned-separator` | Ligne décorative |
| **Raison** | `.banned-reason` | "Violations graves des règles de la communauté" |
| **Durée** | `#ban-duration` | Compte à rebours dynamique jusqu'à la fin du ban (calculé depuis `localStorage.ban_until`) |
| **Motif** | `#ban-motif` | Raison spécifique du ban (depuis `localStorage.ban_reason`) |
| **Contact** | `.banned-contact` | Informations de contact pour contester : email (`vrai.alpha.source@gmail.com`) + téléphone (`0626568662`) |
| **Bouton "Réessayer"** | `.banned-button` | "↻ Réessayer de se connecter" — redirige vers `/pages/login.html` |

---

## 12. Système de Thèmes & Skins (theme.css)

Le fichier `theme.css` définit des variables CSS pour chaque skin. Chaque skin est activé via l'attribut `data-skin` sur `<html>`.

**Variables CSS modifiées par les skins** :
```css
--color-primary          /* Couleur principale */
--color-secondary        /* Couleur secondaire */
--color-accent           /* Couleur d'accentuation */
--color-background       /* Fond de page */
--color-surface          /* Fond des cartes/widgets */
--color-text             /* Couleur du texte */
--color-text-secondary   /* Texte secondaire */
--sidebar-bg             /* Fond de la sidebar */
--sidebar-text           /* Texte de la sidebar */
/* ... et d'autres variables selon le thème */
```

Chaque skin est identifié par un sélecteur comme `[data-skin="skin-verdure"]`, `[data-skin="skin-cyberpunk"]`, etc.

**Fonds animés** activés par `data-fond` :
- `vagues` / `vagues-inversees` : SVG waves
- `pixel-art` : Canvas/CSS mosaïque
- `aurora` : Dégradés CSS animés
- `crumpled-paper` : Texture CSS

---

## 13. Configuration des Badges (badge-config.js)

Fichier de configuration globale des badges, chargé sur toutes les pages.

### Icônes (`BADGE_ICONS`)

Chaque badge a une configuration :
```javascript
{
    type: 'image' | 'emoji',  // image PNG ou emoji Unicode
    src: '/ressources/badges/...png',  // si type='image'
    emoji: '🏆',              // emoji de fallback ou principal
    large: true | false       // si le badge doit être affiché en grand
}
```

**Liste complète des badges configurés** :

| ID | Type | Emoji | Image |
|----|------|-------|-------|
| `delegue` | image | 🎖️ | `délégué.png` |
| `sociable` | image | 💬 | `sociable.png` |
| `rank1` | image | 🏆 | `1rank.png` (large) |
| `rank2` | image | 🥈 | `2rank.png` (large) |
| `rank3` | image | 🥉 | `3rank.png` (large) |
| `robot` | image | 🤖 | `robot.png` |
| `actif` | image | ⚡ | `actif.png` |
| `inactif` | image | 😴 | `inactif.png` |
| `nouveau` | image | 🆕 | `nouveau.png` |
| `depenseur` | image | 💸 | `dépenseur.png` |
| `fantome` | image | 👻 | `fantome.png` |
| `ecolo` | image | 🌱 | `ecolo.png` |
| `lent` | image | 🐢 | `lent.png` |
| `sauveur` | emoji | 🦸 | — |
| `leveTot` | emoji | 🌅 | — |
| `nocturne` | emoji | 🌙 | — |
| `ami` | image | 💕 | `ami.png` |
| `puni` | image | ⚠️ | `puni.png` |
| `banni` | image | 🚫 | `banned.png` |
| `police` | image | 👮 | `police.png` |
| `chefEtoile` | emoji | ⭐ | — |
| `juge` | image | ⚖️ | `juge.png` |
| `marathonien` | image | 🏅 | `Marathonien.png` |
| `collectionneur` | image | 🎯 | `collectionneur.png` |
| `pilier` | emoji | 🪨 | — |
| `explorateur` | emoji | 🧭 | — |
| `vestimentaire` | emoji | 👗 | — |

### Descriptions (`BADGE_DESCRIPTIONS`)

| ID | Nom affiché | Description |
|----|-------------|-------------|
| `delegue` | Délégué | Tu es délégué de classe. Les modos ont confiance en toi! |
| `sociable` | Sociable | Top 3 des utilisateurs les plus bavards |
| `rank1` | Champion | N°1 au classement des points 👑 |
| `rank2` | Finaliste | N°2 au classement des points |
| `rank3` | Podium | N°3 au classement des points |
| `robot` | Robot | Tu fais partie des 2 plus gros utilisateurs de l'IA |
| `actif` | Hyperactif | Tu es le plus actif en ce moment |
| `inactif` | Fantôme discret | Tu es le moins actif en ce moment |
| `nouveau` | Nouveau | Bienvenue! Tu es nouveau sur la plateforme |
| `depenseur` | Dépensier | Tu dépenses le plus de points cette semaine |
| `fantome` | Fantôme | Tu es discret, moins de messages ces 5 derniers jours |
| `ecolo` | Écolo | Tu parles le moins à l'IA |
| `lent` | Lent | Tu réponds lentement aux messages privés 🐢 |
| `sauveur` | Sauveur | Plus de sauvetages validés |
| `leveTot` | Lève-Tôt | Tu te connectes très tôt le matin |
| `nocturne` | Nocturne | Tu es actif tard la nuit 🌙 |
| `ami` | Ami | Plus de messages privés |
| `puni` | Puni | Tu as reçu des avertissements |
| `banni` | Banni | Tu es actuellement banni |
| `police` | Police | Tu signales le plus de messages |
| `chefEtoile` | Chef étoilé | Meilleure note moyenne sur les cours postés |
| `juge` | Juge | Tu notes le plus de cours |
| `marathonien` | Marathonien | Tu te connectes et participes régulièrement |
| `collectionneur` | Collectionneur | Ta collection est impressionnante ! |
| `pilier` | Pilier | Pilier de la communauté |
| `explorateur` | Explorateur | Tu découvres souvent de nouvelles fonctionnalités |
| `vestimentaire` | Vestimentaire | Tu as débloqué plusieurs skins/thèmes |

### Fonctions utilitaires

| Fonction | Paramètres | Retour |
|----------|------------|--------|
| `getBadgeEmoji(badgeId)` | ID du badge | Emoji correspondant (ou '❓' si inconnu) |
| `getBadgeDescription(badgeId)` | ID du badge | `{ name, description }` |
| `renderBadgeHtml(badgeId, large)` | ID + booléen taille | HTML d'un badge (`<div class="badge-item">` avec emoji et tooltip) |

---

## 14. Tutoriel du site (site-tutorial.js)

Système de tutoriel guidé qui accompagne les nouveaux utilisateurs à travers les fonctionnalités du site.

- Déclenché automatiquement à la première visite ou manuellement.
- Met en surbrillance les éléments importants avec des tooltips explicatifs.
- Navigue l'utilisateur page par page en expliquant chaque section.

---

## Rendu des étoiles (Fonction globale)

Le site utilise un système de rendu d'étoiles par quarts (`renderQuarterStarsHtml(rating, variant)`), défini dans `script.js` :

- Chaque étoile est un SVG avec 4 quadrants (TL, BL, BR, TR) remplis individuellement.
- Résolution : 0.25 étoile (quart par quart).
- Variantes : `'badge'` (petit) ou `'modal'` (grand).
- Utilisé pour : les notes de cours, le profil utilisateur, les modals de vote.

---

## Résumé des Endpoints API

### API Utilisateurs (`/api/`)
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/login` | Connexion |
| POST | `/api/auto_increment` | Incrément connexion |
| POST | `/api/check_ban` | Vérifier si banni |
| GET | `/api/user-info/:username` | Infos utilisateur |
| POST | `/api/user-social-profile` | Modifier profil social |
| POST | `/api/report-message` | Signaler un message |
| GET | `/api/badge-progress/:username` | Progression badges |
| GET | `/api/all.json` | Classement général |

### API Chat (`/api/`)
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/public/api/chat` | Envoyer un message à Gemini |

### API Communauté (`/public/api/community/`)
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/public/api/community/create-group` | Créer groupe (-30 pts) |
| POST | `/public/api/community/create-topic` | Créer sujet (-5 pts) |
| POST | `/public/api/community/create-fill` | Créer fill (gratuit) |
| POST | `/public/api/community/create-mp` | Créer MP (gratuit) |
| POST | `/public/api/community/send-message` | Envoyer message |
| GET | `/public/api/community/global.json` | Registre global |

### API Cours (`/public/api/course/`)
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/public/api/course/upload` | Upload cours |
| POST | `/public/api/course/vote` | Voter sur un cours |
| DELETE | `/public/api/course/delete/:id` | Supprimer cours |

### API Messagerie
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/send-message` | Envoyer message interne |
| POST | `/api/send-rescue` | Lancer un rescue (-5 pts) |
| GET | `/api/messages/:username` | Messages reçus |
| GET | `/api/rescues` | Liste des rescues |

### API Boutique (`/api/`)
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/shop-meta/:username` | Bundles + offres du jour |
| POST | `/api/shop-purchase` | Acheter un article |
| POST | `/api/shop-purchase-bundle` | Acheter un bundle |
| POST | `/api/equip-skin` | Équiper un skin |
| POST | `/api/equip-fond` | Équiper un fond |
| GET | `/api/shop-history/:username` | Historique achats |

### API École Directe (`/ed/`)
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/ed/login` | Connexion ED |
| GET | `/ed/notes` | Notes |
| GET | `/ed/edt` | Emploi du temps |
| GET | `/ed/devoirs` | Devoirs |

### API Admin (`/admin-api/`)
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/admin-api/login` | Connexion admin |
| GET | `/admin-api/users` | Liste utilisateurs |
| POST | `/admin-api/ban` | Bannir |
| POST | `/admin-api/unban` | Débannir |
| POST | `/admin-api/warn` | Avertir |
| GET | `/admin-api/stats` | Statistiques globales |
