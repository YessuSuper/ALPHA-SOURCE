// points.js - Système de gestion des points
const fs = require('fs');
const path = require('path');
// const { log, logToFile } = require('../logger.js');

// Chemins des fichiers
const USERS_PATH = path.join(__dirname, '..', 'public', 'api', 'users.json');
const ALL_PATH = path.join(__dirname, '..', 'public', 'api', 'all.json');
const GLOBAL_PATH = path.join(__dirname, '..', 'public', 'api', 'community', 'global.json');

// Fonction pour lire users.json
function readUsers() {
    try {
        const rawData = fs.readFileSync(USERS_PATH, 'utf8') || '[]';
        return JSON.parse(rawData);
    } catch (e) {
        console.error("Erreur lecture users.json:", e);
        return [];
    }
}

// Fonction pour écrire users.json
function writeUsers(users) {
    try {
        fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2), 'utf8');
    } catch (e) {
        console.error("Erreur écriture users.json:", e);
    }
}

// Ajouter des points à un utilisateur
function addPoints(username, points) {
    const users = readUsers();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (user) {
        user.pt = (user.pt || 0) + points;
        writeUsers(users);
    }
}

// Vérifier et appliquer la connexion quotidienne (+3, une fois par jour)
function checkAndApplyDailyLogin(username) {
    const users = readUsers();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (user) {
        const now = Date.now();
        const lastClaim = user.last_daily_login || 0;
        const oneDay = 24 * 60 * 60 * 1000;
        if (now - lastClaim >= oneDay) {
            addPoints(username, 3);
            user.last_daily_login = now;
            writeUsers(users);
        }
    }
}

// Incrémenter le compteur de messages
function incrementMessageCount(username, type) {
    const users = readUsers();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (user) {
        if (type === 'fill') {
            user.messages_fill_count = (user.messages_fill_count || 0) + 1;
        } else if (type === 'ai') {
            user.messages_ai_count = (user.messages_ai_count || 0) + 1;
        }
        writeUsers(users);
    }
}

// Vérifier et appliquer les récompenses de messages (périodique)
function checkAndApplyMessageRewards() {
    console.log("[POINTS] Vérification des récompenses de messages...");
    const users = readUsers();
    let updated = false;
    users.forEach(user => {
        // Messages dans fills/groupes : +2 tous les 20
        if (user.messages_fill_count >= 20) {
            const rewards = Math.floor(user.messages_fill_count / 20) * 2;
            console.log(`[POINTS] Récompense pour ${user.username}: +${rewards} points pour ${user.messages_fill_count} messages fills`);
            user.pt = (user.pt || 0) + rewards;
            user.messages_fill_count = user.messages_fill_count % 20;
            updated = true;
        }
        // Messages à AI : +3 tous les 15
        if (user.messages_ai_count >= 15) {
            const rewards = Math.floor(user.messages_ai_count / 15) * 3;
            console.log(`[POINTS] Récompense pour ${user.username}: +${rewards} points pour ${user.messages_ai_count} messages AI`);
            user.pt = (user.pt || 0) + rewards;
            user.messages_ai_count = user.messages_ai_count % 15;
            updated = true;
        }
    });
    if (updated) {
        console.log("[POINTS] Mise à jour des utilisateurs après récompenses messages");
        writeUsers(users);
    } else {
        console.log("[POINTS] Aucune récompense de messages à appliquer");
    }
}

// Vérifier et appliquer les récompenses de classement (périodique)
function checkAndApplyRankingRewards() {
    try {
        const raw = fs.readFileSync(ALL_PATH, 'utf8') || '{}';
        const fileContent = JSON.parse(raw);
        let ranking = [];
        if (Array.isArray(fileContent.user_ranking)) {
            ranking = fileContent.user_ranking.sort((a, b) => (b.points || 0) - (a.points || 0));
        } else if (Array.isArray(fileContent)) {
            ranking = fileContent.sort((a, b) => (b.points || 0) - (a.points || 0));
        }

        const users = readUsers();
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;
        let updated = false;

        // Récompenses pour top 3 si pas récompensé récemment
        for (let i = 0; i < Math.min(3, ranking.length); i++) {
            const username = ranking[i].username;
            const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
            if (user && (!user.last_ranking_reward || now - user.last_ranking_reward >= oneDay)) {
                let points = 0;
                if (i === 0) points = 10;
                else if (i === 1) points = 5;
                else if (i === 2) points = 2;
                console.log(`[POINTS] Récompense classement pour ${username}: +${points} points (position ${i+1})`);
                user.pt = (user.pt || 0) + points;
                user.last_ranking_reward = now;
                updated = true;
            }
        }
        if (updated) {
            writeUsers(users);
        }
    } catch (e) {
        console.error("Erreur checkAndApplyRankingRewards:", e);
    }
}

// Vérifier les utilisateurs inactifs (-15 si pas connecté 7j)
function checkInactiveUsers() {
    const users = readUsers();
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    let updated = false;
    users.forEach(user => {
        if (user.last_connexion && now - user.last_connexion >= sevenDays && !user.penalized_inactive) {
            console.log(`[POINTS] Pénalité inactivité pour ${user.username}: -15 points`);
            user.pt = (user.pt || 0) - 15;
            user.penalized_inactive = true;
            updated = true;
        }
    });
    if (updated) writeUsers(users);
}

// Vérifier l'activité des fills (-5 si <5 messages d'autres utilisateurs dans les 24h)
function checkFillActivity() {
    try {
        const globalData = JSON.parse(fs.readFileSync(GLOBAL_PATH, 'utf8'));
        const fills = globalData.fills || [];
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;
        const users = readUsers();
        let updated = false;

        fills.forEach(fill => {
            const createdAt = new Date(fill.createdAt).getTime();
            if (now - createdAt < oneDay) {
                // Compter les messages d'autres utilisateurs
                const fillFile = path.join(__dirname, '..', 'public', 'api', 'community', 'fills', `${fill.id}.json`);
                if (fs.existsSync(fillFile)) {
                    const fillData = JSON.parse(fs.readFileSync(fillFile, 'utf8'));
                    const messages = fillData.messages || [];
                    const otherMessages = messages.filter(m => m.sender !== fill.createdBy);
                    if (otherMessages.length < 5 && !fill.penalized_low_activity) {
                        const user = users.find(u => u.username.toLowerCase() === fill.createdBy.toLowerCase());
                        if (user) {
                            console.log(`[POINTS] Pénalité fill inactif pour ${fill.createdBy}: -5 points`);
                            user.pt = (user.pt || 0) - 5;
                            updated = true;
                        }
                        fill.penalized_low_activity = true;
                        // Mettre à jour global.json
                        fs.writeFileSync(GLOBAL_PATH, JSON.stringify(globalData, null, 2));
                    }
                }
            }
        });
        if (updated) writeUsers(users);
    } catch (e) {
        console.error("Erreur checkFillActivity:", e);
    }
}

// Récompenser le créateur du sujet quand un fill est créé sous son sujet (+3)
function rewardTopicCreatorForFill(fill) {
    if (fill.parentType === 'topic') {
        try {
            const topicFile = path.join(__dirname, '..', 'public', 'api', 'community', 'sujets', `${fill.parentId}.json`);
            if (fs.existsSync(topicFile)) {
                const topicData = JSON.parse(fs.readFileSync(topicFile, 'utf8'));
                const users = readUsers();
                const user = users.find(u => u.username.toLowerCase() === topicData.createdBy.toLowerCase());
                if (user) {
                    console.log(`[POINTS] Récompense sujet pour ${topicData.createdBy}: +3 points`);
                    user.pt = (user.pt || 0) + 3;
                    writeUsers(users);
                }
            }
        } catch (e) {
            console.error("Erreur rewardTopicCreatorForFill:", e);
        }
    }
}

// Vérifier les points pour une action payante
function checkPointsForAction(username, cost) {
    const users = readUsers();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    return user && (user.pt || 0) >= Math.abs(cost);
}

// Déduire les points pour une action
function deductPoints(username, points) {
    addPoints(username, -Math.abs(points));
}

module.exports = {
    addPoints,
    checkAndApplyDailyLogin,
    incrementMessageCount,
    checkAndApplyMessageRewards,
    checkAndApplyRankingRewards,
    checkInactiveUsers,
    checkFillActivity,
    rewardTopicCreatorForFill,
    checkPointsForAction,
    deductPoints
};