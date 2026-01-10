// points.js - Système de gestion des points
const fs = require('fs');
const path = require('path');
// const { log, logToFile } = require('../logger.js');

// Chemins des fichiers
const USERS_PATH = path.join(__dirname, '..', 'public', 'api', 'users.json');
const ALL_PATH = path.join(__dirname, '..', 'public', 'api', 'all.json');
const GLOBAL_PATH = path.join(__dirname, '..', 'public', 'api', 'community', 'global.json');

// Définitions simples des badges (affichage via emoji côté front)
const BADGE_DEFINITIONS = {
    delegue: { id: 'delegue', emoji: '🎖️' },
    sociable: { id: 'sociable', emoji: '💬' },
    rank1: { id: 'rank1', emoji: '🏆' },
    rank2: { id: 'rank2', emoji: '🥈' },
    rank3: { id: 'rank3', emoji: '🥉' },
    robot: { id: 'robot', emoji: '🤖' },
    actif: { id: 'actif', emoji: '⚡' },
    inactif: { id: 'inactif', emoji: '😴' },
    nouveau: { id: 'nouveau', emoji: '🆕' },
    depenseur: { id: 'depenseur', emoji: '💸' },
    fantome: { id: 'fantome', emoji: '👻' },
    ecolo: { id: 'ecolo', emoji: '🌱' },
    lent: { id: 'lent', emoji: '🐢' },
    sauveur: { id: 'sauveur', emoji: '🦸' },
    leveTot: { id: 'leveTot', emoji: '🌅' },
    nocturne: { id: 'nocturne', emoji: '🌙' },
    ami: { id: 'ami', emoji: '💕' },
    puni: { id: 'puni', emoji: '⚠️' },
    banni: { id: 'banni', emoji: '🚫' },
    police: { id: 'police', emoji: '👮' }
};
const DELEGATE_USERS = ['Antoine', 'Juliette'];

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

// Fonction pour synchroniser les points vers all.json
function syncPointsToAllJson() {
    try {
        const usersData = readUsers();
        const allRaw = fs.readFileSync(ALL_PATH, 'utf8') || '{}';
        const allData = JSON.parse(allRaw);
        
        const userRanking = usersData.map(user => ({
            username: user.username,
            points: user.pt || 0,
            connexions: user.connexions || 0,
            last_connexion: user.last_connexion || null,
            active: user.active || false
        }));
        
        const collectivePoints = usersData.reduce((sum, user) => sum + (user.pt || 0), 0);
        
        allData.user_ranking = userRanking;
        allData.collective_data = {
            collective_points_pc: collectivePoints,
            last_updated: new Date().toISOString()
        };
        
        fs.writeFileSync(ALL_PATH, JSON.stringify(allData, null, 2), 'utf8');
    } catch (e) {
        console.error("Erreur syncPointsToAllJson:", e);
    }
}

// Fonction pour écrire users.json et synchroniser vers all.json
function writeUsers(users) {
    try {
        fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2), 'utf8');
        // 🔥 Synchroniser immédiatement les points vers all.json
        syncPointsToAllJson();
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

// Retirer des points (dépense volontaire) - incrémente le compteur de dépenses
function spendPoints(username, points) {
    const users = readUsers();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (user) {
        if ((user.pt || 0) >= points) {
            user.pt = (user.pt || 0) - points;
            user.depenses = (user.depenses || 0) + points;
            writeUsers(users);
            return true; // Dépense réussie
        }
        return false; // Pas assez de points
    }
    return false;
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
        user.messages_total = (user.messages_total || 0) + 1;
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

// ============================================================================
// --- Badges ---
// ============================================================================

function ensureBadgeFields(user) {
    let updated = false;
    if (!Array.isArray(user.badges_current)) {
        user.badges_current = [];
        updated = true;
    }
    if (!Array.isArray(user.badges_obtained)) {
        user.badges_obtained = [];
        updated = true;
    }
    return updated;
}

function addBadge(user, badgeId) {
    ensureBadgeFields(user);
    let updated = false;
    if (!user.badges_current.includes(badgeId)) {
        user.badges_current.push(badgeId);
        updated = true;
    }
    if (!user.badges_obtained.includes(badgeId)) {
        user.badges_obtained.push(badgeId);
        updated = true;
    }
    return updated;
}

function removeBadge(user, badgeId) {
    ensureBadgeFields(user);
    const before = user.badges_current.length;
    user.badges_current = user.badges_current.filter(b => b !== badgeId);
    return before !== user.badges_current.length;
}

// Initialiser les nouveaux champs utilisateur pour les badges
function ensureNewBadgeFields(user) {
    let updated = false;
    
    // Champs pour écolo
    if (typeof user.messages_ai_count !== 'number') {
        user.messages_ai_count = 0;
        updated = true;
    }
    
    // Champ pour lent (temps moyen de réponse aux messages privés en ms)
    if (typeof user.avg_pm_response_time !== 'number') {
        user.avg_pm_response_time = 0;
        updated = true;
    }
    
    // Champ pour sauveur (compteur de sauvetages validés)
    if (typeof user.validated_rescues !== 'number') {
        user.validated_rescues = 0;
        updated = true;
    }
    
    // Champs pour lève tôt/nocturne (heures de connexion: 0-23)
    if (!Array.isArray(user.connection_hours)) {
        user.connection_hours = [];
        updated = true;
    }
    
    // Champ pour ami (compteur total de messages privés)
    if (typeof user.pm_messages_count !== 'number') {
        user.pm_messages_count = 0;
        updated = true;
    }
    
    return updated;
}

// Tracker une connexion pour les badges lève tôt/nocturne
function trackConnectionHour(username) {
    const users = readUsers();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (user) {
        ensureNewBadgeFields(user);
        const now = new Date();
        const hour = now.getHours();
        
        // Garder les 100 dernières connexions
        if (!Array.isArray(user.connection_hours)) {
            user.connection_hours = [];
        }
        user.connection_hours.push(hour);
        if (user.connection_hours.length > 100) {
            user.connection_hours = user.connection_hours.slice(-100);
        }
        
        writeUsers(users);
    }
}

// Tracker un message privé envoyé (pour ami et lent)
function trackPrivateMessage(senderUsername, receiverUsername, responseTimeMs) {
    const users = readUsers();
    
    // Incrémenter le compteur de messages privés pour l'expéditeur
    const sender = users.find(u => u.username.toLowerCase() === senderUsername.toLowerCase());
    if (sender) {
        ensureNewBadgeFields(sender);
        sender.pm_messages_count = (sender.pm_messages_count || 0) + 1;
    }
    
    // Tracker le temps de réponse pour le récepteur
    if (responseTimeMs && responseTimeMs > 0) {
        const receiver = users.find(u => u.username.toLowerCase() === receiverUsername.toLowerCase());
        if (receiver) {
            ensureNewBadgeFields(receiver);
            // Calculer la moyenne mobile des temps de réponse
            const avgCurrent = receiver.avg_pm_response_time || 0;
            const count = receiver.pm_response_count || 0;
            receiver.avg_pm_response_time = (avgCurrent * count + responseTimeMs) / (count + 1);
            receiver.pm_response_count = count + 1;
        }
    }
    
    writeUsers(users);
}

// Tracker un sauvetage réussi validé
function trackValidatedRescue(username) {
    const users = readUsers();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (user) {
        ensureNewBadgeFields(user);
        user.validated_rescues = (user.validated_rescues || 0) + 1;
        writeUsers(users);
    }
}

function recalculateBadges() {
    try {
        const users = readUsers();
        if (!Array.isArray(users) || users.length === 0) return;

        let changed = false;

        // S'assurer que tout le monde a les champs et un compteur total
        users.forEach(u => {
            if (ensureBadgeFields(u)) changed = true;
            if (ensureNewBadgeFields(u)) changed = true;
            if (typeof u.messages_total !== 'number') {
                u.messages_total = (u.messages_fill_count || 0) + (u.messages_ai_count || 0);
                changed = true;
            }
        });

        // Délégués fixes
        users.forEach(u => {
            if (DELEGATE_USERS.includes(u.username)) {
                if (addBadge(u, BADGE_DEFINITIONS.delegue.id)) changed = true;
            } else if (removeBadge(u, BADGE_DEFINITIONS.delegue.id)) {
                changed = true;
            }
        });

        // Sociable : top 3 messages_total (dép. secondaire sur alpha pour stabilité)
        const sortedByMessages = [...users].sort((a, b) => {
            const diff = (b.messages_total || 0) - (a.messages_total || 0);
            if (diff !== 0) return diff;
            return a.username.localeCompare(b.username);
        });
        const sociableWinners = new Set(sortedByMessages.slice(0, 3).map(u => u.username));
        users.forEach(u => {
            if (sociableWinners.has(u.username)) {
                if (addBadge(u, BADGE_DEFINITIONS.sociable.id)) changed = true;
            } else if (removeBadge(u, BADGE_DEFINITIONS.sociable.id)) {
                changed = true;
            }
        });

        // Classement : top 3 points
        const sortedByPoints = [...users].sort((a, b) => {
            const diff = (b.pt || 0) - (a.pt || 0);
            if (diff !== 0) return diff;
            return a.username.localeCompare(b.username);
        });
        const rank1Winner = sortedByPoints[0];
        const rank2Winner = sortedByPoints[1];
        const rank3Winner = sortedByPoints[2];
        
        users.forEach(u => {
            // Rank 1
            if (rank1Winner && u.username === rank1Winner.username) {
                if (addBadge(u, BADGE_DEFINITIONS.rank1.id)) changed = true;
            } else if (removeBadge(u, BADGE_DEFINITIONS.rank1.id)) {
                changed = true;
            }
            // Rank 2
            if (rank2Winner && u.username === rank2Winner.username) {
                if (addBadge(u, BADGE_DEFINITIONS.rank2.id)) changed = true;
            } else if (removeBadge(u, BADGE_DEFINITIONS.rank2.id)) {
                changed = true;
            }
            // Rank 3
            if (rank3Winner && u.username === rank3Winner.username) {
                if (addBadge(u, BADGE_DEFINITIONS.rank3.id)) changed = true;
            } else if (removeBadge(u, BADGE_DEFINITIONS.rank3.id)) {
                changed = true;
            }
        });

        // Robot : top 2 messages à l'IA
        const sortedByAI = [...users].sort((a, b) => {
            const diff = (b.messages_ai_count || 0) - (a.messages_ai_count || 0);
            if (diff !== 0) return diff;
            return a.username.localeCompare(b.username);
        });
        const robotWinners = new Set(sortedByAI.slice(0, 2).map(u => u.username));
        users.forEach(u => {
            if (robotWinners.has(u.username)) {
                if (addBadge(u, BADGE_DEFINITIONS.robot.id)) changed = true;
            } else if (removeBadge(u, BADGE_DEFINITIONS.robot.id)) {
                changed = true;
            }
        });

        // Nouveau : moins de 5 connexions
        users.forEach(u => {
            const connexions = u.connexions || 0;
            if (connexions < 5) {
                if (addBadge(u, BADGE_DEFINITIONS.nouveau.id)) changed = true;
            } else if (removeBadge(u, BADGE_DEFINITIONS.nouveau.id)) {
                changed = true;
            }
        });

        // Actif / Inactif : calculer le score d'activité
        const now = Date.now();
        const usersWithActivity = users.map(u => {
            // Calculer le score d'activité basé sur :
            // 1. Nombre de connexions
            // 2. Fraîcheur de la dernière connexion (bonus si récent)
            // 3. Messages envoyés (fill + AI)
            
            const connexions = u.connexions || 0;
            const lastConnexion = u.last_connexion || 0;
            const daysSinceLastConnexion = (now - lastConnexion) / (1000 * 60 * 60 * 24);
            const messageCount = (u.messages_total || 0);
            
            // Facteur de fraîcheur : décroissance exponentielle (1.0 si connecté aujourd'hui, ~0 après 30 jours)
            const freshnessFactor = Math.max(0, Math.exp(-daysSinceLastConnexion / 7));
            
            // Score d'activité = connexions * fraîcheur + messages * 0.5
            const activityScore = (connexions * freshnessFactor) + (messageCount * 0.5);
            
            return { user: u, activityScore };
        });

        // Trier par score d'activité
        const sortedByActivity = [...usersWithActivity].sort((a, b) => b.activityScore - a.activityScore);
        
        // Le plus actif = score le plus élevé
        const mostActive = sortedByActivity[0];
        // Le moins actif = score le plus faible (mais doit avoir au moins 1 connexion pour être considéré)
        const eligibleInactive = sortedByActivity.filter(u => (u.user.connexions || 0) >= 1);
        const leastActive = eligibleInactive[eligibleInactive.length - 1];
        
        users.forEach(u => {
            // Badge Actif
            if (mostActive && u.username === mostActive.user.username) {
                if (addBadge(u, BADGE_DEFINITIONS.actif.id)) changed = true;
            } else if (removeBadge(u, BADGE_DEFINITIONS.actif.id)) {
                changed = true;
            }
            
            // Badge Inactif
            if (leastActive && u.username === leastActive.user.username) {
                if (addBadge(u, BADGE_DEFINITIONS.inactif.id)) changed = true;
            } else if (removeBadge(u, BADGE_DEFINITIONS.inactif.id)) {
                changed = true;
            }
        });

        // Dépenseur : celui qui a dépensé le plus de points cette semaine
        // Réinitialiser les dépenses chaque lundi à minuit
        const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
        users.forEach(u => {
            if (!u.depenses) u.depenses = 0;
            if (!u.last_depenses_reset) u.last_depenses_reset = now;
            
            // Vérifier si on doit réinitialiser (une semaine s'est écoulée)
            if (now - u.last_depenses_reset >= WEEK_MS) {
                u.depenses = 0;
                u.last_depenses_reset = now;
                changed = true;
            }
        });

        // Trouver le plus gros dépenseur
        const sortedByDepenses = [...users].sort((a, b) => {
            const diff = (b.depenses || 0) - (a.depenses || 0);
            if (diff !== 0) return diff;
            return a.username.localeCompare(b.username);
        });
        const depenseurWinner = sortedByDepenses[0];

        users.forEach(u => {
            if (depenseurWinner && u.username === depenseurWinner.username && (depenseurWinner.depenses || 0) > 0) {
                if (addBadge(u, BADGE_DEFINITIONS.depenseur.id)) changed = true;
            } else if (removeBadge(u, BADGE_DEFINITIONS.depenseur.id)) {
                changed = true;
            }
        });

        // Fantôme : celui qui a envoyé le moins de messages dans les 5 derniers jours
        // Pour cela, on va lire global.json et compter les messages récents
        try {
            const globalData = JSON.parse(fs.readFileSync(GLOBAL_PATH, 'utf8'));
            const fiveDaysAgo = now - (5 * 24 * 60 * 60 * 1000);
            
            // Compter les messages par utilisateur dans les 5 derniers jours
            const recentMessageCounts = {};
            users.forEach(u => {
                recentMessageCounts[u.username] = 0;
            });

            // Parcourir tous les messages dans global.json
            if (globalData.messages && Array.isArray(globalData.messages)) {
                globalData.messages.forEach(msg => {
                    if (msg.timestamp >= fiveDaysAgo && recentMessageCounts.hasOwnProperty(msg.sender)) {
                        recentMessageCounts[msg.sender]++;
                    }
                });
            }

            // Trouver celui avec le moins de messages (mais qui a au moins 1 connexion)
            const sortedByRecentMessages = [...users]
                .filter(u => (u.connexions || 0) >= 1)
                .map(u => ({ user: u, count: recentMessageCounts[u.username] || 0 }))
                .sort((a, b) => {
                    const diff = a.count - b.count;
                    if (diff !== 0) return diff;
                    return a.user.username.localeCompare(b.user.username);
                });
            
            const fantomeWinner = sortedByRecentMessages[0];

            users.forEach(u => {
                if (fantomeWinner && u.username === fantomeWinner.user.username) {
                    if (addBadge(u, BADGE_DEFINITIONS.fantome.id)) changed = true;
                } else if (removeBadge(u, BADGE_DEFINITIONS.fantome.id)) {
                    changed = true;
                }
            });
        } catch (e) {
            console.error('Erreur calcul badge fantome:', e);
        }

        // ===== NOUVEAUX BADGES =====

        // ÉCOLO : celui qui parle le moins à l'IA
        const sortedByAIAsc = [...users].sort((a, b) => {
            const diff = (a.messages_ai_count || 0) - (b.messages_ai_count || 0);
            if (diff !== 0) return diff;
            return a.username.localeCompare(b.username);
        });
        const ecoloWinner = sortedByAIAsc[0];
        users.forEach(u => {
            if (ecoloWinner && u.username === ecoloWinner.username) {
                if (addBadge(u, BADGE_DEFINITIONS.ecolo.id)) changed = true;
            } else if (removeBadge(u, BADGE_DEFINITIONS.ecolo.id)) {
                changed = true;
            }
        });

        // LENT : celui qui voit les messages privés le moins vite (avg response time le plus élevé)
        const sortedByPMResponseTime = [...users].sort((a, b) => {
            const avgA = a.avg_pm_response_time || 0;
            const avgB = b.avg_pm_response_time || 0;
            const diff = avgB - avgA;
            if (diff !== 0) return diff;
            return a.username.localeCompare(b.username);
        });
        const lentWinner = sortedByPMResponseTime[0];
        users.forEach(u => {
            if (lentWinner && u.username === lentWinner.username && (lentWinner.avg_pm_response_time || 0) > 0) {
                if (addBadge(u, BADGE_DEFINITIONS.lent.id)) changed = true;
            } else if (removeBadge(u, BADGE_DEFINITIONS.lent.id)) {
                changed = true;
            }
        });

        // SAUVEUR : celui qui a répondu et été validé au plus de sauvetages
        const sortedBySauvetages = [...users].sort((a, b) => {
            const diff = (b.validated_rescues || 0) - (a.validated_rescues || 0);
            if (diff !== 0) return diff;
            return a.username.localeCompare(b.username);
        });
        const sauveurWinner = sortedBySauvetages[0];
        users.forEach(u => {
            if (sauveurWinner && u.username === sauveurWinner.username && (sauveurWinner.validated_rescues || 0) > 0) {
                if (addBadge(u, BADGE_DEFINITIONS.sauveur.id)) changed = true;
            } else if (removeBadge(u, BADGE_DEFINITIONS.sauveur.id)) {
                changed = true;
            }
        });

        // LÈVE TÔT : celui avec les heures de connexion les plus basses (moyenne la plus proche de 00:00)
        const sortedByEarliestHour = [...users].sort((a, b) => {
            const hoursA = a.connection_hours || [];
            const hoursB = b.connection_hours || [];
            const avgA = hoursA.length > 0 ? hoursA.reduce((sum, h) => sum + h, 0) / hoursA.length : 12;
            const avgB = hoursB.length > 0 ? hoursB.reduce((sum, h) => sum + h, 0) / hoursB.length : 12;
            const diff = avgA - avgB;
            if (diff !== 0) return diff;
            return a.username.localeCompare(b.username);
        });
        const leveTotWinner = sortedByEarliestHour[0];
        users.forEach(u => {
            if (leveTotWinner && u.username === leveTotWinner.username && (leveTotWinner.connection_hours || []).length > 0) {
                if (addBadge(u, BADGE_DEFINITIONS.leveTot.id)) changed = true;
            } else if (removeBadge(u, BADGE_DEFINITIONS.leveTot.id)) {
                changed = true;
            }
        });

        // NOCTURNE : celui avec les heures de connexion les plus tard (moyenne la plus proche de 23:59)
        const sortedByLateHour = [...users].sort((a, b) => {
            const hoursA = a.connection_hours || [];
            const hoursB = b.connection_hours || [];
            const avgA = hoursA.length > 0 ? hoursA.reduce((sum, h) => sum + h, 0) / hoursA.length : 12;
            const avgB = hoursB.length > 0 ? hoursB.reduce((sum, h) => sum + h, 0) / hoursB.length : 12;
            const diff = avgB - avgA;
            if (diff !== 0) return diff;
            return a.username.localeCompare(b.username);
        });
        const nocturneWinner = sortedByLateHour[0];
        users.forEach(u => {
            if (nocturneWinner && u.username === nocturneWinner.username && (nocturneWinner.connection_hours || []).length > 0) {
                if (addBadge(u, BADGE_DEFINITIONS.nocturne.id)) changed = true;
            } else if (removeBadge(u, BADGE_DEFINITIONS.nocturne.id)) {
                changed = true;
            }
        });

        // AMI : celui avec le plus de messages privés en tout
        const sortedByPMMessages = [...users].sort((a, b) => {
            const diff = (b.pm_messages_count || 0) - (a.pm_messages_count || 0);
            if (diff !== 0) return diff;
            return a.username.localeCompare(b.username);
        });
        const amiWinner = sortedByPMMessages[0];
        users.forEach(u => {
            if (amiWinner && u.username === amiWinner.username && (amiWinner.pm_messages_count || 0) > 0) {
                if (addBadge(u, BADGE_DEFINITIONS.ami.id)) changed = true;
            } else if (removeBadge(u, BADGE_DEFINITIONS.ami.id)) {
                changed = true;
            }
        });

        // PUNI : si tu as un ou plusieurs avertissements actifs
        users.forEach(u => {
            const activeWarnings = (u.warnings || []).filter(w => w.expiresAt > now);
            if (activeWarnings.length > 0) {
                if (addBadge(u, BADGE_DEFINITIONS.puni.id)) changed = true;
            } else if (removeBadge(u, BADGE_DEFINITIONS.puni.id)) {
                changed = true;
            }
        });

        // BANNI : si tu es actuellement banni
        users.forEach(u => {
            const isBanned = u.banned || (u.ban_until && u.ban_until > now);
            if (isBanned) {
                if (addBadge(u, BADGE_DEFINITIONS.banni.id)) changed = true;
            } else if (removeBadge(u, BADGE_DEFINITIONS.banni.id)) {
                changed = true;
            }
        });

        // POLICE : celui qui a fait le plus de signalements (reports_made)
        const sortedByReports = [...users].sort((a, b) => {
            const reportsA = (a.reports_made || []).length;
            const reportsB = (b.reports_made || []).length;
            const diff = reportsB - reportsA;
            if (diff !== 0) return diff;
            return a.username.localeCompare(b.username);
        });
        const policeWinner = sortedByReports[0];
        users.forEach(u => {
            if (policeWinner && u.username === policeWinner.username && (policeWinner.reports_made || []).length > 0) {
                if (addBadge(u, BADGE_DEFINITIONS.police.id)) changed = true;
            } else if (removeBadge(u, BADGE_DEFINITIONS.police.id)) {
                changed = true;
            }
        });

        if (changed) {
            writeUsers(users);
        }
    } catch (e) {
        console.error('Erreur recalculateBadges:', e);
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
    spendPoints,
    checkAndApplyDailyLogin,
    incrementMessageCount,
    checkAndApplyMessageRewards,
    checkAndApplyRankingRewards,
    checkInactiveUsers,
    checkFillActivity,
    recalculateBadges,
    rewardTopicCreatorForFill,
    checkPointsForAction,
    deductPoints,
    trackConnectionHour,
    trackPrivateMessage,
    trackValidatedRescue,
    ensureNewBadgeFields
};