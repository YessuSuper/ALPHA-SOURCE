# Admin API — Documentation

Base URL : `http://<ton-serveur>:3000/admin-api`

---

## Authentification

Toutes les routes (sauf `/login`) nécessitent un token Bearer.

### Se connecter

```
POST /admin-api/login
Content-Type: application/json

{
  "username": "Even",     // ou "admin"
  "password": "ton_mot_de_passe"
}
```

Réponse :
```json
{
  "success": true,
  "token": "abc123...hex96chars",
  "expiresIn": 43200,
  "message": "Connecté en tant qu'admin (Even)."
}
```

Le token expire après **12 heures**. Inclure le token dans toutes les requêtes :
```
Authorization: Bearer abc123...hex96chars
```

### Se déconnecter

```
POST /admin-api/logout
Authorization: Bearer <token>
```

---

## Utilisateurs

### Liste de tous les utilisateurs

```
GET /admin-api/users
```

Retourne pour chaque utilisateur :
- `username`, `points`, `connexions`, `last_connexion`, `active`
- `banned`, `ban_until`, `warnings` (actifs), `warnings_total`
- `reports_received`, `reports_made`
- `badges_current`, `badges_obtained`
- `birth_date`, `messages_total`, `messages_fill_count`, `messages_ai_count`
- `pm_messages_count`, `login_streak`, `course_stars_avg`
- `active_skin`, `skins_obtenus`, `depenses`, `graph_pt`

### Détail d'un utilisateur

```
GET /admin-api/users/:username
```

Retourne TOUTES les données de l'utilisateur (sauf le hash du mot de passe).

---

## Modération — Bans

### Bannir un utilisateur

```
POST /admin-api/ban
Content-Type: application/json

{
  "username": "Calixte",
  "duration_hours": 48,      // optionnel, défaut: 48
  "reason": "Spam répétitif"  // optionnel
}
```

### Débannir un utilisateur

```
POST /admin-api/unban
Content-Type: application/json

{
  "username": "Calixte"
}
```

---

## Modération — Avertissements

### Ajouter un avertissement

```
POST /admin-api/warn
Content-Type: application/json

{
  "username": "Calixte",
  "reason": "Contenu inapproprié"  // optionnel
}
```

Retourne si l'utilisateur a été auto-banni suite à l'accumulation.

### Retirer un avertissement spécifique

```
POST /admin-api/remove-warning
Content-Type: application/json

{
  "username": "Calixte",
  "warning_index": 0    // index dans la liste des avertissements actifs
}
```

### Supprimer tous les avertissements

```
POST /admin-api/clear-warnings
Content-Type: application/json

{
  "username": "Calixte"
}
```

---

## Signalements

### Voir tous les signalements

```
GET /admin-api/reports
```

Retourne la liste triée par date (plus récent en premier) :
```json
{
  "reported_user": "Calixte",
  "reported_by": "Alexandre",
  "message_id": "msg_123",
  "timestamp": 1773000000000
}
```

---

## Communauté

### Liste des groupes

```
GET /admin-api/community/groups
```

### Contenu d'un groupe (avec tous les messages)

```
GET /admin-api/community/groups/:id
```

### Liste des fills

```
GET /admin-api/community/fills
```

### Contenu d'un fill

```
GET /admin-api/community/fills/:id
```

### Liste des sujets

```
GET /admin-api/community/topics
```

### Liste des MPs

```
GET /admin-api/community/mps
```

### Contenu d'un MP

```
GET /admin-api/community/mps/:id
```

---

## Messagerie interne

### Tous les messages internes

```
GET /admin-api/messages
```

### Toutes les demandes de secours

```
GET /admin-api/rescues
```

### Demandes d'adhésion aux fills

```
GET /admin-api/fill-requests
```

---

## Cours

### Liste de tous les cours

```
GET /admin-api/courses
```

### Supprimer un cours

```
POST /admin-api/courses/delete
Content-Type: application/json

{
  "course_id": "course_123"
}
```

---

## Statistiques générales

```
GET /admin-api/stats
```

Retourne :
```json
{
  "stats": {
    "users_total": 25,
    "users_active": 20,
    "users_banned": 1,
    "users_warned": 2,
    "total_points": 1250,
    "total_community_messages": 340,
    "internal_messages": 45,
    "courses_total": 12,
    "courses_active": 10,
    "groups": 3,
    "topics": 1,
    "fills": 4,
    "mps": 8
  }
}
```

---

## Exemples d'utilisation

### Python

```python
import requests

BASE = "http://localhost:3000/admin-api"

# Login
r = requests.post(f"{BASE}/login", json={"username": "Even", "password": "monmdp"})
token = r.json()["token"]
headers = {"Authorization": f"Bearer {token}"}

# Lister les utilisateurs
users = requests.get(f"{BASE}/users", headers=headers).json()
print(users)

# Bannir quelqu'un
requests.post(f"{BASE}/ban", headers=headers, json={
    "username": "Calixte",
    "duration_hours": 24,
    "reason": "Spam"
})

# Voir les stats
stats = requests.get(f"{BASE}/stats", headers=headers).json()
print(stats)

# Voir les messages d'un groupe
group = requests.get(f"{BASE}/community/groups/classe3c", headers=headers).json()
print(group)
```

### JavaScript (Node.js)

```javascript
const BASE = "http://localhost:3000/admin-api";

// Login
const loginRes = await fetch(`${BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "Even", password: "monmdp" })
});
const { token } = await loginRes.json();
const headers = { Authorization: `Bearer ${token}` };

// Lister les utilisateurs
const usersRes = await fetch(`${BASE}/users`, { headers });
const users = await usersRes.json();
console.log(users);

// Avertir quelqu'un
await fetch(`${BASE}/warn`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ username: "Calixte", reason: "Contenu inapproprié" })
});
```

### JavaScript (navigateur / fetch)

```javascript
const BASE = "/admin-api";

async function adminLogin(username, password) {
    const res = await fetch(`${BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    });
    return (await res.json()).token;
}
```

---

## Sécurité

- Les tokens sont générés aléatoirement (48 bytes hex = 96 caractères)
- Expiration automatique après 12h
- Seuls les comptes "Even" et "admin" (qui utilise le mot de passe d'Even) peuvent se connecter
- Les mots de passe sont vérifiés via bcrypt (jamais stockés en clair)
- Les hash de mots de passe ne sont jamais renvoyés dans les réponses
- Les tokens expirés sont nettoyés automatiquement toutes les 30 minutes
- Si le username n'est pas admin, la réponse est : `"Tu n'es pas admin."`

---

## Codes d'erreur

| Code | Signification |
|------|--------------|
| 200  | Succès |
| 400  | Paramètre manquant |
| 401  | Token invalide / mot de passe incorrect |
| 403  | Pas admin |
| 404  | Ressource non trouvée |
| 500  | Erreur serveur |
