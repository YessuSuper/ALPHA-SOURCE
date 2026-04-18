'use strict';
const express = require('express');
const router = express.Router();
const {
    fs: _fs, fsPromises, path,
    buildAllSummaryFromUsers,
    ALL_PATH,
    readEvolvingDB, getActiveCoursesForAI, normalizeUsername,
    db, stmts, buildUserObject, saveUserFromObject, readUsers, writeUsers, getUserByName,
    contributeToChallenge
} = require('./shared');
const { addPoints, spendPoints, checkPointsForAction } = require('../js/points');

// --- API : Donner des points (Community) ---
router.post('/api/community/give-points', express.json(), async (req, res) => {
    const { sender, receiver, amount } = req.body;
    if (!sender || !receiver || !amount) return res.status(400).json({ success: false, message: 'Param\u00E8tres manquants' });
    const pointsToSend = parseInt(amount, 10);
    if (isNaN(pointsToSend) || pointsToSend <= 0) return res.status(400).json({ success: false, message: 'Le montant doit \u00EAtre un entier positif' });
    if (normalizeUsername(sender) === normalizeUsername(receiver)) return res.status(400).json({ success: false, message: 'On ne peut pas envoyer des points \u00E0 soi-m\u00EAme' });
    try {
        const hasPoints = checkPointsForAction(sender, pointsToSend);
        if (!hasPoints) return res.status(400).json({ success: false, message: 'Points insuffisants' });

        const receiverRow = stmts.getUserLower.get(normalizeUsername(receiver).toLowerCase());
        if (!receiverRow) return res.status(404).json({ success: false, message: 'Destinataire introuvable' });

        const spent = spendPoints(sender, pointsToSend);
        if (!spent) return res.status(400).json({ success: false, message: 'Erreur lors du retrait des points (fonds insuffisants ?)' });
        addPoints(receiver, pointsToSend);

        const senderRow = stmts.getUserLower.get(normalizeUsername(sender).toLowerCase());
        const senderPts = senderRow ? (buildUserObject(senderRow).pt || 0) : 0;
        console.log(`[ECO] Transfert : ${sender} a donn\u00E9 ${pointsToSend} pts \u00E0 ${receiver}`);
        res.json({ success: true, newBalance: senderPts, message: `Vous avez donn\u00E9 ${pointsToSend} points \u00E0 ${receiver} !` });
    } catch (e) {
        console.error('Erreur API give-points:', e);
        res.status(500).json({ success: false, message: 'Erreur interne serveur' });
    }
});

// --- API : R\u00E9cup\u00E9rer le solde de points ---
router.get('/api/user/balance', async (req, res) => {
    const username = req.query.username;
    if (!username) return res.status(400).json({ error: 'username required' });
    try {
        const userRow = stmts.getUserLower.get(normalizeUsername(username).toLowerCase());
        if (!userRow) return res.status(404).json({ success: false, message: 'User not found' });
        const user = buildUserObject(userRow);
        res.json({ success: true, points: user.pt || 0 });
    } catch (e) {
        console.error('Erreur API balance:', e);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// --- API : Enregistrer une page visit\u00E9e (Explorateur) ---
router.post('/api/user/visit-page', express.json(), async (req, res) => {
    const { username, page } = req.body;
    if (!username || !page) return res.status(400).json({ error: 'username et page requis' });
    try {
        const userRow = stmts.getUserLower.get(username.toLowerCase());
        if (!userRow) return res.status(404).json({ error: 'user not found' });
        const user = buildUserObject(userRow);
        if (!Array.isArray(user.pages_visited)) user.pages_visited = [];
        if (!user.pages_visited.includes(page)) {
            user.pages_visited.push(page);
            saveUserFromObject(user);
        }
        res.json({ success: true, pages_visited: user.pages_visited });
    } catch (e) {
        res.status(500).json({ error: 'internal error' });
    }
});

// --- API : Enregistrer un skin/fond/th\u00E8me d\u00E9bloqu\u00E9 ---
router.post('/api/user/unlock-skin', express.json(), async (req, res) => {
    const { username, skinId } = req.body;
    if (!username || !skinId) return res.status(400).json({ error: 'username et skinId requis' });
    try {
        const userRow = stmts.getUserLower.get(username.toLowerCase());
        if (!userRow) return res.status(404).json({ error: 'user not found' });
        const user = buildUserObject(userRow);
        if (!Array.isArray(user.skins_obtenus)) user.skins_obtenus = [];
        if (!user.skins_obtenus.includes(skinId)) {
            user.skins_obtenus.push(skinId);
            saveUserFromObject(user);
        }
        res.json({ success: true, skins_obtenus: user.skins_obtenus });
    } catch (e) {
        res.status(500).json({ error: 'internal error' });
    }
});

// --- GET : BDD \u00E9volutive ---
router.get('/public/api/bdd.json', (req, res) => {
    try {
        const data = readEvolvingDB();
        res.json(data);
    } catch (e) {
        console.error('Erreur GET /api/bdd :', e);
        res.status(500).json({ success: false, message: 'Erreur serveur lors de la lecture de la BDD' });
    }
});

// --- GET : all.json ---
router.get('/api/all.json', (req, res) => {
    try {
        let otherData = {};
        try {
            if (_fs.existsSync(ALL_PATH)) {
                const allRaw = _fs.readFileSync(ALL_PATH, 'utf8') || '{}';
                const parsed = JSON.parse(allRaw);
                delete parsed.user_ranking;
                delete parsed.collective_data;
                otherData = parsed;
            }
        } catch (e) { console.warn('Lecture partielle de all.json \u00E9chou\u00E9e, on continue.'); }
        const summary = buildAllSummaryFromUsers();
        res.json({ ...otherData, ...summary });
    } catch (e) {
        console.error('Erreur GET /api/all.json :', e);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// --- GET : users.json (pour le graphique des points) ---
router.get('/api/users.json', (req, res) => {
    try {
        const users = readUsers();
        const safe = users.map(u => {
            const { passwordHash, ...rest } = u;
            return rest;
        });
        res.json(safe);
    } catch (e) {
        console.error('Erreur GET /api/users.json :', e);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// --- GET : cours (pour l'IA) ---
router.get('/api/cours', (req, res) => {
    try {
        const filteredCourses = getActiveCoursesForAI();
        res.json(filteredCourses);
        console.log(`[COURS] Liste de ${filteredCourses.length} cours actifs envoy\u00E9e.`);
    } catch (e) {
        console.error('ERREUR FATALE LORS DE LA LECTURE DE COURS.JSON :', e.message);
        res.status(500).json({ success: false, message: 'Erreur interne serveur lors de la lecture des cours.' });
    }
});

// Route qui force le nettoyage \u00E0 l'arriv\u00E9e sur le site
router.get('/login', (req, res) => {
    console.log('Logout forc\u00E9 et redirection...');
    res.send(`
        <script>
            localStorage.clear();
            sessionStorage.clear();
            document.cookie.split(';').forEach(function(c) {
                document.cookie = c.replace(/^ +/, '').replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/');
            });
            window.location.href = '/pages/login.html';
        </script>
    `);
});

// ----------------------------------------
// --- D\u00E9fi Collectif Hebdomadaire ---
// ----------------------------------------

const CHALLENGE_TEMPLATES = [
    { title: 'Marathon de messages', description: 'Envoyez 50 messages en communaut\u00E9 cette semaine !', target: 50, metric: 'messages', reward: 10 },
    { title: 'Rush de connexions', description: 'Connectez-vous 30 fois au total cette semaine !', target: 30, metric: 'connexions', reward: 8 },
    { title: 'Partage de savoir', description: 'D\u00E9posez 3 cours cette semaine !', target: 3, metric: 'cours', reward: 15 },
    { title: 'Tous connect\u00E9s', description: '10 \u00E9l\u00E8ves diff\u00E9rents doivent se connecter cette semaine !', target: 10, metric: 'unique_logins', reward: 10 },
    { title: 'Entraide maximale', description: '5 r\u00E9ponses de sauvetage envoy\u00E9es cette semaine !', target: 5, metric: 'rescues', reward: 12 }
];

function getOrCreateChallenge() {
    let data = null;
    try {
        const row = stmts.getChallenge.get();
        if (row) {
            data = {
                id: row.id,
                metric: row.metric,
                target: row.target,
                current: row.current,
                reward: row.reward,
                title: row.title || '',
                description: row.description || '',
                contributors: row.contributors ? JSON.parse(row.contributors) : [],
                starts_at: row.starts_at,
                ends_at: row.ends_at,
                rewarded: row.rewarded || 0
            };
        }
    } catch {}

    const now = Date.now();
    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

    if (data && data.starts_at && (now - data.starts_at < WEEK_MS)) {
        return data;
    }

    // Award previous challenge if completed
    if (data && data.current >= data.target && !data.rewarded) {
        try {
            const allUsers = readUsers();
            const contributors = Array.isArray(data.contributors) ? data.contributors : [];
            let changed = false;
            allUsers.forEach(u => {
                if (contributors.includes(u.username)) {
                    u.pt = (u.pt || 0) + (data.reward || 10);
                    changed = true;
                }
            });
            if (changed) writeUsers(allUsers);
            // Mark as rewarded
            stmts.upsertChallenge.run({
                title: data.title || '', description: data.description || '',
                metric: data.metric, target: data.target, current: data.current,
                reward: data.reward, contributors: JSON.stringify(data.contributors),
                starts_at: data.starts_at, ends_at: data.ends_at, rewarded: 1
            });
        } catch (e) { console.error('[CHALLENGE] reward error:', e); }
    }

    // Pick a new random challenge
    let idx = Math.floor(Math.random() * CHALLENGE_TEMPLATES.length);
    if (data && data.title === CHALLENGE_TEMPLATES[idx].title) {
        idx = (idx + 1) % CHALLENGE_TEMPLATES.length;
    }
    const tpl = CHALLENGE_TEMPLATES[idx];

    const newChallenge = {
        id: 'weekly',
        metric: tpl.metric,
        target: tpl.target,
        current: 0,
        reward: tpl.reward,
        title: tpl.title,
        description: tpl.description,
        contributors: [],
        starts_at: now,
        ends_at: now + WEEK_MS,
        rewarded: 0
    };

    stmts.upsertChallenge.run({
        title: newChallenge.title, description: newChallenge.description,
        metric: newChallenge.metric, target: newChallenge.target,
        current: newChallenge.current, reward: newChallenge.reward,
        contributors: JSON.stringify(newChallenge.contributors),
        starts_at: newChallenge.starts_at, ends_at: newChallenge.ends_at, rewarded: 0
    });

    return newChallenge;
}

router.get('/api/challenge', (req, res) => {
    try {
        const challenge = getOrCreateChallenge();
        const pct = Math.min(100, Math.round((challenge.current / challenge.target) * 100));
        return res.json({
            success: true,
            challenge: {
                title: challenge.title,
                description: challenge.description,
                target: challenge.target,
                current: challenge.current,
                reward: challenge.reward,
                pct,
                contributors_count: (challenge.contributors || []).length,
                completed: challenge.current >= challenge.target,
                ends_at: challenge.starts_at + 7 * 24 * 60 * 60 * 1000
            }
        });
    } catch (e) {
        return res.status(500).json({ success: false });
    }
});

// Increment challenge progress
router.post('/api/challenge/contribute', express.json(), (req, res) => {
    const { username, metric, amount } = req.body;
    if (!username || !metric) return res.status(400).json({ success: false });
    try {
        const challenge = getOrCreateChallenge();
        if (challenge.metric !== metric) return res.json({ success: true, matched: false });
        if (challenge.current >= challenge.target) return res.json({ success: true, matched: true, already_complete: true });

        challenge.current = Math.min(challenge.target, challenge.current + (amount || 1));
        if (!challenge.contributors.includes(username)) {
            challenge.contributors.push(username);
        }

        stmts.upsertChallenge.run({
            title: challenge.title || '', description: challenge.description || '',
            metric: challenge.metric, target: challenge.target,
            current: challenge.current, reward: challenge.reward,
            contributors: JSON.stringify(challenge.contributors),
            starts_at: challenge.starts_at, ends_at: challenge.ends_at,
            rewarded: challenge.rewarded ? 1 : 0
        });

        return res.json({ success: true, matched: true, current: challenge.current });
    } catch (e) {
        return res.status(500).json({ success: false });
    }
});

module.exports = router;