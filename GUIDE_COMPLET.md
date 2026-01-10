# 📖 GUIDE COMPLET - ALPHA SOURCE

## 🔐 PAGE LOGIN

### Boutons & Actions
- **Bouton "Se connecter"** : Authentification avec identifiant + mot de passe
- **Lien "Première connexion ?"** : Redirection vers onboarding

### Fonctionnalités
- Normalisation automatique des identifiants (suppression espaces invisibles)
- Vérification bannissement
- Redirection onboarding si première connexion
- Déconnexion automatique à chaque visite
- Validation mot de passe bcrypt

---

## 🎓 ONBOARDING (4 ÉTAPES)

### Étape 1 : Photo de profil
- **Bouton "Choisir une photo"** : Upload image profil
- **Bouton "Suivant"** : Passer à l'étape 2
- Extraction automatique couleur dominante (node-vibrant)

### Étape 2 : Date de naissance
- **Input date** : Saisie date de naissance
- **Bouton "Suivant"** : Passer à l'étape 3

### Étape 3 : Mot de passe
- **Input mot de passe** : Premier champ
- **Input confirmation** : Deuxième champ
- **Bouton "Suivant"** : Passer à l'étape 4
- Vérification correspondance des deux champs

### Étape 4 : Guide d'accueil
- **Bouton "Terminer"** : Accès au site
- Affichage guide interactif chargé depuis guide.json

---

## 🏠 PAGE ACCUEIL

### Header
- **Message d'accueil dynamique** : Change selon l'heure (matin/après-midi/soir/nuit) et jour (semaine/weekend)

### Widget Classement (Top 3)
- **Affichage Top 1** : Nom + score avec médaille 🥇
- **Affichage Top 2** : Nom + score avec médaille 🥈
- **Affichage Top 3** : Nom + score avec médaille 🥉
- **Rang personnel** : Position de l'utilisateur dans le classement

### Widget Sac à Dos
- **Onglet "Sac à Dos"** : 
  - Matières d'aujourd'hui
  - Matières de demain
- **Onglet "Emploi du Temps"** :
  - Liste des cours de la journée (synchro École Directe)

### Actions
- **Bouton "Télécharger NOTICE"** : Download du fichier NOTICE.txt

---

## 🤖 PAGE CHAT IA (SOURCE AI)

### Sélecteur de Mode (3 modes)
- **Mode Basique** (gratuit) :
  - Aide générale devoirs
  - Contexte : BDD + cours actifs + EDT simple
- **Mode Apprentissage** (gratuit) :
  - Mode pédagogique avancé
  - Contexte : BDD + cours + notes & moyennes
- **Mode Devoirs** (3 points/message) :
  - Assistance complète devoirs
  - Contexte : BDD + cours + notes + EDT + devoirs à faire/en retard

### Zone de Chat
- **Input message** : Saisie question/message
- **Bouton upload image** 📎 : Joindre photo/document pour analyse IA
- **Bouton envoyer** ✉️ : Envoyer message

### Paramètres IA
- **Slider créativité** : Ajuster température IA (0-1)
- **Sélecteur niveau** : Choisir 4ème / 3ème / 2nde
- **Bouton "Nouvelle discussion"** 🔄 : Reset historique chat

### Fonctionnalités
- Persistance historique (SessionStorage)
- Timeout 12 secondes max
- BDD évolutive qui s'enrichit automatiquement
- Affichage messages avec markdown
- Déduction automatique 3 points en mode Devoirs

---

## 📚 PAGE COURS

### Dépôt de cours
- **Bouton "Déposer un cours"** ➕ : Ouvrir formulaire
- **Formulaire** :
  - Input titre
  - Select matière (Maths, Histoire, Français, Physique-Chimie, Anglais)
  - Textarea description
  - Upload fichier (tous formats)
  - Bouton "Déposer"
- Timer de suppression : 5 minutes (300 secondes)

### Recherche & Filtres
- **Input recherche par titre** : Filtre dynamique
- **Input recherche par ID** : Recherche par numéro
- **Select matière** : Filtre par matière
- **Bouton "Réinitialiser"** 🔄 : Reset tous les filtres

### Grille de cours
- **Cartes cours** : Clic pour voir détails
  - Prévisualisation image ou placeholder
  - Overlay titre + matière
- **Bouton "Détails"** 🔍 : Ouvrir modal
- **Bouton "Télécharger"** ⬇️ : Download fichier

### Modal Détails
- Affichage métadonnées complètes
- Timer de suppression en temps réel
- **Bouton "Supprimer"** 🗑️ : Suppression logique (animation 3s)
- **Bouton "Télécharger"** ⬇️ : Download fichier

### Compteur
- **Affichage nombre total** : Cours actifs

---

## 👥 PAGE COMMUNAUTÉ

### Bouton Création
- **Bouton "+"** : Menu contextuel avec 4 options
  - **Nouveau groupe** : Formulaire (nom, description, public/privé)
    - Public : gratuit
    - Privé : 30 points
  - **Nouveau sujet** : Formulaire (nom, description) - 5 points
  - **Nouveau fill** : Sélection parent (groupe ou sujet) - gratuit
  - **Message privé** : Autocomplete noms élèves - gratuit

### Liste des discussions
- **Groupes** : Cartes cliquables, durée 24h
- **Sujets** : Cartes cliquables, durée 24h
- **Fills** : Cartes cliquables, durée 12h
- **MPs** : Conversations privées

### Zone de messages
- **Container messages** : Affichage avec lazy loading (30 messages/chargement)
- **Scroll infini** : Auto-chargement messages anciens au scroll up

### Messages affichés
- **Avatar utilisateur** : Bordure couleur dominante
- **Badges** : Max 3 badges actifs (tooltip au survol)
- **Pseudo** : Background couleur utilisateur
- **Contenu message** : Texte + fichier joint éventuel
- **Bouton télécharger** ⬇️ : Si fichier joint
- **Bouton fullscreen** 🔍 : Si image jointe
- **Clic sur pseudo** : Ouvrir profil utilisateur

### Barre de saisie
- **Textarea** : Auto-resize, max 3 lignes
- **Bouton upload** 📎 : Joindre fichier (images, vidéos, PDF, docs, archives)
- **Bouton envoyer** ✉️ : Rond, envoi message
- **Preview fichier** : Si attaché, avec bouton suppression ❌

### Modal Profil Utilisateur
- Avatar + nom
- Date de naissance
- Badges actuels (3 max)
- Badges possédés (historique)
- **Bouton fermer** ❌

### Visualiseur d'images
- Modal fullscreen
- **Bouton télécharger** ⬇️
- **Bouton fermer** ❌

### Badges disponibles (11 badges)
- 🎖️ **delegue** : Délégué de classe
- 💬 **sociable** : Top 3 messages
- 🥇 **rank1** : N°1 classement
- 🥈 **rank2** : N°2 classement
- 🥉 **rank3** : N°3 classement
- 🤖 **robot** : Top 2 IA
- ✅ **actif** : Le plus actif
- 😴 **inactif** : Le moins actif
- 🆕 **nouveau** : Moins de 5 connexions
- 💸 **depenseur** : Plus gros dépensier semaine
- 👻 **fantome** : Moins actif messages (5 derniers jours)

---

## ✉️ PAGE MESSAGERIE

### Actions principales
- **Bouton "Nouveau"** ✏️ : Ouvrir formulaire composition
- **Bouton "Sauvetage"** 🚨 : Lancer demande sauvetage cours

### Liste messages (Inbox)
- Messages avec statut lu/non lu
- Badge "Urgent" pour sauvetages
- **Clic sur message** : Ouvrir détail

### Formulaire Nouveau Message
- **Input destinataires** : Autocomplete noms élèves
- **Bouton "Ajouter toute la classe"** : Ajout rapide 31 élèves
- **Input objet** : Titre du message
- **Textarea corps** : Contenu du message
- **Upload pièce jointe** 📎 : Joindre fichier
- **Checkbox anonymat** : Masquer identité (3 points)
- **Bouton "Envoyer"** ✉️ : Envoi message

### Vue Détail Message
- Expéditeur + destinataires
- Objet + corps
- Pièces jointes téléchargeables
- **Bouton "Répondre"** ↩️ : Ouvrir formulaire réponse
- **Actions sauvetage** (si applicable) :
  - **Bouton Upvote** 👍 : Voter meilleure réponse (+15 points au gagnant)
  - **Bouton Downvote** 👎 : Rejeter réponse

### Système Sauvetage (feature unique)

#### Étape 1 : Lancement (5 points)
- **Formulaire sauvetage** :
  - Input objet
  - Textarea description besoin
  - Bouton "Lancer" (déduction 5 points)

#### Étape 2 : Routage IA
- IA analyse demande
- Sélectionne 3-8 élèves pertinents (basé sur caractères dans all.json)
- Envoie message "Urgent" aux élèves ciblés
- Message de confirmation au demandeur

#### Étape 3 : Réponses
- Élèves répondent avec cours (anonyme côté demandeur)
- Pièces jointes supportées

#### Étape 4 : Vote
- Demandeur vote sur réponses
- Premier upvote = 15 points au gagnant
- Fermeture automatique sauvetage

---

## 🎒 PAGE CARTABLE (ÉCOLE DIRECTE)

### Connexion
- **Bouton "Connexion École Directe"** : Ouvrir formulaire
- **Formulaire** :
  - Input identifiant ED
  - Input mot de passe ED
  - Bouton "Se connecter"
- **Bouton "Déconnexion"** : Supprimer identifiants + cache

### Onglet Notes

#### Sélection période
- **Dropdown périodes** : Choix trimestre/semestre

#### Moyenne générale
- Affichage proéminent de la moyenne

#### Pôles disciplinaires (3 pôles)
- **Pôle Littéraire** (bleu) :
  - Français, Anglais, Histoire-Géo, etc.
- **Pôle Scientifique** (vert) :
  - Maths, Physique-Chimie, SVT, Techno
- **Pôle Artistique** (orange) :
  - Arts plastiques, Musique, EPS

#### Cartes matières
- **Clic sur carte** : Ouvrir détails
- Affichage moyenne élève vs classe

#### Modal Détails Matière
- **Bouton graphique** 📊 : Ouvrir graphique évolution
- Liste complète des notes
- Moyenne + écart classe
- Coefficient
- **Bouton fermer** ❌

#### Modal Graphique
- Graphique linéaire (Chart.js)
- Évolution notes dans le temps
- Moyenne classe en pointillés
- **Bouton fermer** ❌

### Onglet Devoirs

#### Affichage par jour
- Date + jour de semaine
- **Cartes devoirs** :
  - Matière + nom prof
  - Titre auto-extrait
  - Contenu décodé
  - **Checkbox "Effectué"** : Toggle statut
  - Badge "Pièces jointes" si présentes
  - **Clic sur carte** : Ouvrir détail

#### Modal Détail Devoir
- Titre + matière + prof
- Contenu complet HTML décodé
- **Liste pièces jointes** : Téléchargeables
- **Checkbox "Effectué"** : Toggle statut
- **Bouton fermer** ❌

---

## ℹ️ PAGE INFO

### Affichage Points
- **Points individuels** : Score personnel
- **Points collectifs** : Total classe (31 élèves)

### Graphique Évolution
- **Chart.js** : Graphique linéaire points dans le temps
- Données depuis champ graph_pt (historique)
- Ligne bleue dégradée avec points marqués

### Barre Progression
- Indicateur visuel progrès hebdomadaire

---

## 👤 PAGE MON COMPTE

### Section Profil

#### Avatar
- **Clic sur avatar** : Ouvrir modal upload
- **Hover avatar** : Affichage icône modifier (ppicon.png)
- **Modal upload** :
  - Upload nouvelle photo
  - Extraction couleur dominante automatique
  - Bouton "Enregistrer"

#### Informations
- Username
- Date de naissance
- Nombre de connexions
- Dernière connexion
- Chemin photo de profil

#### Actions
- **Bouton "Changer mot de passe"** 🔑 : Ouvrir formulaire
  - Input nouveau mot de passe
  - Input confirmation
  - Bouton "Valider"

### Section Badges

#### Badges Actuels
- **3 badges maximum** affichés
- Tooltip descriptif au survol

#### Historique
- **Liste tous badges obtenus** avec dates

#### Tous les Badges
- **Liste complète 11 badges disponibles** :
  - Nom + description + emoji
  - Indication si possédé

### Section Thèmes

#### Thème Équipé
- **Affichage thème actif** avec preview

#### Inventaire
- **Liste thèmes achetés** :
  - Nom + couleurs
  - **Bouton "Équiper"** 👕 : Activer thème

#### Boutique
- **Thèmes disponibles** (7 au total) :
  1. 🔵 Bleu Basique (gratuit, défaut)
  2. 🟡 Jaune Basique (gratuit)
  3. 🌿 Verdure (28 pts)
  4. 🌅 Sunset (35 pts)
  5. 🌊 Ocean (42 pts)
  6. ⬛ Noir (98 pts)
  7. 🌸 Rose (128 pts)
  8. 💜 Violet (150 pts)
- **Boutons "Acheter"** 🛒 : Achat thème (déduction points + activation auto)

### Actions Compte
- **Bouton "Déconnexion École Directe"** : Supprimer cache ED + identifiants
- **Bouton "Déconnexion"** 🚪 : Nettoyage session + redirection login

---

## 🎯 SYSTÈME DE POINTS (GLOBAL)

### Actions Récompensées
- 🔐 **Connexion quotidienne** : +2 points (une fois/jour)
- 💬 **Message communauté** : +1 point (fill/groupe)
- 🤖 **Message IA** : +0 point (mais compteur pour badges)
- 🏆 **Gagnant sauvetage** : +15 points (premier upvote)
- 📚 **Créateur de sujet** : +3 points bonus si fill créé dedans

### Actions Payantes
- 🕵️ **Message anonyme** : -3 points
- 🚨 **Sauvetage** : -5 points
- 🏢 **Groupe privé** : -30 points
- 📌 **Sujet** : -5 points
- 📝 **Mode Devoirs IA** : -3 points/message
- 🛒 **Thèmes boutique** : -28 à -150 points

---

## 📱 NAVIGATION GÉNÉRALE

### Sidebar Desktop
- **Bouton rétraction** ◀️ : Réduire/agrandir sidebar
- **8 liens navigation** :
  - 🏠 Accueil
  - 🤖 Chat IA
  - 📚 Cours
  - 👥 Communauté
  - ✉️ Messagerie
  - 🎒 Cartable
  - ℹ️ Info
  - 👤 Mon Compte

### Bottom Navigation Mobile
- **8 icônes** : Même navigation que sidebar

### Menu Hamburger Mobile
- **Bouton ☰** : Ouvrir/fermer menu
- **Overlay** : Navigation fullscreen

---

## ⚙️ FONCTIONNALITÉS TECHNIQUES

### Performance
- ⚡ Cache avatars : Chargement unique
- ⚡ Cache couleurs : Extraction une fois
- ⚡ Lazy loading : Messages communauté (30/chargement)
- ⚡ SessionStorage : Persistance chat IA
- ⚡ Debounce : Inputs recherche

### Sécurité
- 🔐 Bcrypt : Hachage mots de passe (10 rounds)
- 🔑 Normalisation identifiants
- 🚫 Protection bannissement
- ✅ Validation fichiers (taille max)
- ✅ Vérification points avant achat

### Synchronisation
- 🔄 Auto-reconnexion ED si token expire
- 💾 Sauvegarde complète données ED
- 🎯 Matching utilisateur tolérant
- ⚡ Cache cahier de texte (5 min)

### Animations
- ✨ Transitions CSS : 0.3s smooth
- 🌊 Effet vagues : Animation SVG background
- 🔄 Loaders : Indicateurs chargement
- 🎭 Modals : Overlay + fermeture ESC/clic extérieur

---

## 📊 RACCOURCIS CLAVIER

- **ESC** : Fermer modals
- **Enter** : Envoyer message (chat IA, communauté, messagerie)

---

**Guide généré le 3 janvier 2026**  
**Version : 1.0**
