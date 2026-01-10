# Client EcoleDirecte API

Client Node.js pour accéder à l'API d'EcoleDirecte et récupérer vos données (notes, devoirs, emploi du temps, etc.).

## 📋 Fichiers inclus

### 1. **ecoledirecte-api.js** (Principal)
Classe `EcoleDirecteAPI` qui gère la connexion et les requêtes API.

**Méthodes principales:**
- `login()` - Connexion
- `getAccount()` - Infos du compte
- `getNotes()` - Notes par matière
- `getTimeline()` - Activité récente
- `getEmploiDuTemps(dateDebut, dateFin)` - Emploi du temps
- `getCahierDeTexte(date)` - Devoirs
- `getVieScolaire()` - Absences, sanctions
- `getDocuments()` - Documents administratifs
- `getEspacesTravail()` - Espaces de travail

### 2. **exemple-basic.js**
Exemple simple: connexion et récupération basique de données.

```bash
npm start
```

### 3. **exemple-avance.js**
Exemple avancé avec affichage détaillé des notes, cahier de texte, etc.

```bash
npm run advanced
```

### 4. **gestion-qcm.js**
Gestion complète de la double authentification (QCM).
Exécutez ceci si une réponse QCM est requise lors de la connexion.

```bash
npm run qcm
```

### 5. **api-web-server.js**
Serveur Express qui expose les données EcoleDirecte via une API REST.

```bash
npm run server
```
Puis ouvrez `http://localhost:3000` dans votre navigateur.

Note: dans ce projet, le serveur est configuré sur le port 3001.
Si vous aviez un service qui occupe déjà 3000, utilisez `http://localhost:3001`.

---

## 🚀 Démarrage rapide

### Installation

```bash
# Installer les dépendances
npm install
```

### Utilisation basique

```bash
# Exécution simple
npm start
```

### Utilisation avancée

```bash
# Données détaillées
npm run advanced

# Avec gestion QCM
npm run qcm

# Serveur web
npm run server
```

---

## 📝 Exemple de code

```javascript
const EcoleDirecteAPI = require('./ecoledirecte-api');

const api = new EcoleDirecteAPI('even.henri', 'Superpitchu_8');

async function main() {
  try {
    // Connexion
    const account = await api.login();
    console.log(`Connecté: ${account.prenom} ${account.nom}`);

    // Récupérer les notes
    const notes = await api.getNotes();
    console.log('Notes:', notes);

    // Emploi du temps
    const edt = await api.getEmploiDuTemps('2024-12-29', '2024-12-29');
    console.log('Cours:', edt);

  } catch (error) {
    console.error('Erreur:', error.message);
  }
}

main();
```

---

## 🔐 Sécurité

⚠️ **IMPORTANT**: Les identifiants sont actuellement stockés en dur dans les fichiers.
En production, utilisez:
- Variables d'environnement (`.env`)
- Sessions sécurisées
- Authentification OAuth/JWT

```javascript
// Meilleure pratique
require('dotenv').config();

const api = new EcoleDirecteAPI(
  process.env.ED_USERNAME,
  process.env.ED_PASSWORD
);
```

---

## ⚠️ Double authentification (QCM)

Si vous recevez l'erreur `requireQCM: true`, cela signifie qu'un nouvel appareil a été détecté.
Exécutez:

```bash
npm run qcm
```

Et répondez aux questions posées.

---

## 🌐 Intégration avec votre site

Pour intégrer avec votre site HTML/CSS, utilisez le serveur Web:

```bash
npm run server
```

Puis appelez les APIs depuis votre front-end:

```javascript
// Connexion
fetch('http://localhost:3001/api/login')
  .then(r => r.json())
  .then(data => console.log(data));

// Notes
fetch('http://localhost:3001/api/notes')
  .then(r => r.json())
  .then(data => console.log('Notes:', data));

// Emploi du temps
fetch('http://localhost:3001/api/emploidutemps/2024-12-29/2024-12-29')
  .then(r => r.json())
  .then(data => console.log('EDT:', data));
```

---

## 📚 Documentation API EcoleDirecte

La documentation complète se trouve ici:
https://github.com/EduWireApps/EcoleDirecte-API-Documentation

Endpoints supportés:
- `POST /v3/login.awp` - Connexion
- `GET /v3/eleves/{id}/timeline.awp` - Timeline
- `GET /v3/E/{id}/emploidutemps.awp` - Emploi du temps
- `GET /v3/eleves/{id}/notes.awp` - Notes
- `GET /v3/Eleves/{id}/cahierdetexte/{date}.awp` - Cahier de texte
- `GET /v3/eleves/{id}/viescolaire.awp` - Vie scolaire
- `GET /v3/elevesDocuments.awp` - Documents
- Et bien d'autres...

---

## 🐛 Dépannage

### "Code erreur: 505"
Identifiants incorrects. Vérifiez username et password.

### "Code erreur: 520 ou 525"
Token invalide ou expiré. Reconnectez-vous.

### "Code erreur: 250"
QCM requis. Exécutez `npm run qcm`.

### CORS errors
Si vous utilisez le serveur web depuis un autre domaine, vérifiez les en-têtes CORS dans `api-web-server.js`.

---

## 📄 Licence

MIT

---

## ⚡ Améliorations futures

- [ ] Persistance de session
- [ ] Cache des données
- [ ] Pagination
- [ ] WebSocket pour les mises à jour en temps réel
- [ ] Support des fichiers (upload/download)
- [ ] Tests automatisés
