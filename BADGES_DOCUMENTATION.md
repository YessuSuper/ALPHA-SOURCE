# Système des Nouveaux Badges

## 6 nouveaux badges ajoutés au système

### 1. 🌱 **Écolo** 
- **Critère:** Celui qui parle le **moins à l'IA**
- **Champ utilisateur:** `messages_ai_count` (minimum = badge)
- **Fonction:** Récompense les utilisateurs respectueux du règlement ou préférant les interactions humaines

### 2. 🐢 **Lent**
- **Critère:** Celui qui voit les messages privés le **moins vite** (temps de réponse moyen le plus élevé)
- **Champs utilisateur:** 
  - `avg_pm_response_time` (temps moyen en ms)
  - `pm_response_count` (pour calcul de moyenne mobile)
- **Fonction:** Utiliser `trackPrivateMessage(sender, receiver, responseTimeMs)` au serveur pour tracker

### 3. 🦸 **Sauveur**
- **Critère:** Celui qui a répondu et été **validé au plus de sauvetages**
- **Champ utilisateur:** `validated_rescues` (compteur)
- **Fonction:** Appeler `trackValidatedRescue(username)` quand un sauvetage est validé
- **Cas d'usage:** Pour les systèmes de Q&A, tutoring, ou aide entre pairs

### 4. 🌅 **Lève Tôt**
- **Critère:** Celui avec les **heures de connexion les plus basses** (moyenne closest to 00:00)
- **Champ utilisateur:** `connection_hours` (array de 0-23)
- **Fonction:** Appeler `trackConnectionHour(username)` à chaque connexion
- **Limite:** Garde les 100 dernières connexions pour éviter les données obsolètes

### 5. 🌙 **Nocturne**
- **Critère:** Celui avec les **heures de connexion les plus tard** (moyenne closest to 23:59)
- **Champ utilisateur:** `connection_hours` (même array que Lève Tôt)
- **Fonction:** Même tracking que Lève Tôt, mais inverse le calcul de classement

### 6. 💕 **Ami**
- **Critère:** Celui avec le **plus de messages privés en tout**
- **Champ utilisateur:** `pm_messages_count` (compteur total)
- **Fonction:** Appeler `trackPrivateMessage(username, otherUsername, 0)` pour incrémenter
- **Cas d'usage:** Récompense les utilisateurs sociables et engagés dans les conversations privées

---

## Intégration au serveur

### Fonctions disponibles (exportées de `js/points.js`):

```javascript
// Tracker une connexion (pour badges lève tôt/nocturne)
trackConnectionHour(username)

// Tracker un message privé envoyé
// - incremente pm_messages_count du sender
// - calcule avg_pm_response_time du receiver
trackPrivateMessage(senderUsername, receiverUsername, responseTimeMs)

// Tracker un sauvetage validé
trackValidatedRescue(username)

// Initialiser les champs manuellement (appelé par recalculateBadges)
ensureNewBadgeFields(user)
```

### Exemple d'intégration dans server.js:

```javascript
const { trackConnectionHour, trackPrivateMessage, trackValidatedRescue } = require('./js/points.js');

// Au login:
app.post('/api/login', (req, res) => {
    // ... logique de login ...
    trackConnectionHour(username); // Pour lève tôt/nocturne
    // ...
});

// À l'envoi de message privé:
app.post('/api/send-pm', (req, res) => {
    const { from, to, message } = req.body;
    const sentAt = Date.now();
    
    // ... sauvegarder le message ...
    
    trackPrivateMessage(from, to, 0); // Sender + increment counter
    // ...
});

// Quand un sauvetage est validé:
app.post('/api/validate-rescue', (req, res) => {
    const { username, rescueId } = req.body;
    
    // ... validation logique ...
    
    trackValidatedRescue(username); // Increment counter
    // ...
});
```

---

## Structure JSON utilisateur

```json
{
    "username": "Jean",
    "pt": 150,
    "messages_ai_count": 5,
    "messages_fill_count": 25,
    "messages_total": 30,
    "avg_pm_response_time": 3600000,
    "pm_response_count": 8,
    "validated_rescues": 3,
    "connection_hours": [9, 14, 16, 10, 22, 13],
    "pm_messages_count": 42,
    "badges_current": ["ami", "sociable", "leve_tot"],
    "badges_obtained": ["ami", "sociable", "leve_tot", "nouveau"]
}
```

---

## Recalcul des badges

Les badges sont recalculés automatiquement par:
- La fonction `recalculateBadges()` (appelée périodiquement via `verifications.js`)
- Ou manuellement: `require('./js/points.js').recalculateBadges()`

Les 11 anciens badges + 6 nouveaux = **17 badges totaux** dans le système.
