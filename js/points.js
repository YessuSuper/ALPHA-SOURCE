// points.js - Système de gestion des points (SQL)
const path = require('path');
const fs = require('fs');
const { db, stmts, buildUserObject, saveUserFromObject, readUsers, writeUsers, getUserByName, addPointsToUser, spendUserPoints, checkUserPoints, readAllCourses, buildCourseObject } = require('../db');

// Chemin all.json (fichier API public généré, pas une base de données)
const ALL_PATH = path.join(__dirname, '..', 'public', 'api', 'all.json');

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
    police: { id: 'police', emoji: '👮' },
    chefEtoile: { id: 'chefEtoile', emoji: '⭐' },
    juge: { id: 'juge', emoji: '⚖️' },
    marathonien: { id: 'marathonien', emoji: '🅰' },
    collectionneur: { id: 'collectionneur', emoji: '🎯' },
    pilier: { id: 'pilier', emoji: '🪨' },
    explorateur: { id: 'explorateur', emoji: '🧭' },
    vestimentaire: { id: 'vestimentaire', emoji: '👗' }
};
const DELEGATE_USERS = ['Antoine', 'Juliette'];

function safeLower(s) {
    return String(s || '').trim().toLowerCase();
}

// Fonction pour synchroniser les points vers all.json (fichier API public)
function syncPointsToAllJson() {
    try {
        const usersData = readUsers();
        let allData = {};
        try {
            const allRaw = fs.readFileSync(ALL_PATH, 'utf8') || '{}';
            allData = JSON.parse(allRaw);
        } catch (e) {
            allData = {};
        }

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

// Écrire les utilisateurs en SQL et synchroniser vers all.json
function writeUsersAndSync(users) {
    writeUsers(users);
    syncPointsToAllJson();
}

// Ajouter des points à un utilisateur
function addPoints(username, points) {
    addPointsToUser(username, points);
    syncPointsToAllJson();
}

// Retirer des points (dépense volontaire) - incrémente le compteur de dépenses
function spendPoints(username, points) {
    const result = spendUserPoints(username, points);
    if (result) syncPointsToAllJson();
    return result;
}

// Vérifier et appliquer la connexion quotidienne (+3, une fois par jour)
function checkAndApplyDailyLogin(username) {
    const users = readUsers();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (user) {
        const now = Date.now();
        const lastClaim = user.last_daily_login || 0;
        const oneDay = 24 * 60 * 60 * 1000;
        const yesterday = lastClaim + oneDay;
        if (now - lastClaim >= oneDay) {
            addPoints(username, 3);
            user.last_daily_login = now;
            // Gestion du login_streak (marathonien)
            if (now - yesterday < oneDay * 2 && lastClaim > 0) {
                user.login_streak = (user.login_streak || 0) + 1;
            } else {
                user.login_streak = 1;
            }
            writeUsersAndSync(users);
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
        writeUsersAndSync(users);
    }
}

// Vérifier et appliquer les récompenses de messages (périodique)
function checkAndApplyMessageRewards() {
    console.log("[POINTS] Vérification des récompenses de messages...");
    const users = readUsers();
    let updated = false;
    users.forEach(user => {
        if (user.messages_fill_count >= 20) {
            const rewards = Math.floor(user.messages_fill_count / 20) * 2;
            console.log(`[POINTS] Récompense pour ${user.username}: +${rewards} points pour ${user.messages_fill_count} messages fills`);
            user.pt = (user.pt || 0) + rewards;
            user.messages_fill_count = user.messages_fill_count % 20;
            updated = true;
        }
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
        writeUsersAndSync(users);
    } else {
        console.log("[POINTS] Aucune récompense de messages à appliquer");
    }
}

// Vérifier et appliquer les récompenses de classement (périodique)
function checkAndApplyRankingRewards() {
    try {
        const users = readUsers();
        const ranking = [...users].sort((a, b) => (b.pt || 0) - (a.pt || 0));
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;
        let updated = false;

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
            writeUsersAndSync(users);
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
    if (updated) writeUsersAndSync(users);
}

// Vérifier l'activité des fills (-5 si <5 messages d'autres utilisateurs dans les 24h)
function checkFillActivity() {
    try {
        const fills = stmts.getAllFills.all();
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;
        const users = readUsers();
        let updated = false;

        fills.forEach(fill => {
            const createdAt = new Date(fill.created_at).getTime();
            if (now - createdAt < oneDay) {
                const otherCount = stmts.countFillMessagesByOthers.get(fill.id, fill.created_by);
                if (otherCount && otherCount.count < 5 && !fill.penalized_low_activity) {
                    const user = users.find(u => u.username.toLowerCase() === (fill.created_by || '').toLowerCase());
                    if (user) {
                        console.log(`[POINTS] Pénalité fill inactif pour ${fill.created_by}: -5 points`);
                        user.pt = (user.pt || 0) - 5;
                        updated = true;
                    }
                    // Marquer le fill comme pénalisé
                    stmts.updateFill.run({
                        name: fill.name,
                        description: fill.description,
                        admin: fill.admin,
                        duration: fill.duration,
                        expires_at: fill.expires_at,
                        penalized_low_activity: 1,
                        id: fill.id
                    });
                }
            }
        });
        if (updated) writeUsersAndSync(users);
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
        user.pt = (user.pt || 0) + 5;
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

function ensureNewBadgeFields(user) {
    let updated = false;
    if (typeof user.messages_ai_count !== 'number') { user.messages_ai_count = 0; updated = true; }
    if (typeof user.avg_pm_response_time !== 'number') { user.avg_pm_response_time = 0; updated = true; }
    if (typeof user.validated_rescues !== 'number') { user.validated_rescues = 0; updated = true; }
    if (!Array.isArray(user.connection_hours)) { user.connection_hours = []; updated = true; }
    if (typeof user.pm_messages_count !== 'number') { user.pm_messages_count = 0; updated = true; }
    if (typeof user.login_streak !== 'number') { user.login_streak = 0; updated = true; }
    if (!Array.isArray(user.pages_visited)) { user.pages_visited = []; updated = true; }
    if (!Array.isArray(user.skins_obtenus)) { user.skins_obtenus = []; updated = true; }
    return updated;
}

// Tracker une connexion pour les badges lève tôt/nocturne
function trackConnectionHour(username) {
    const hour = new Date().getHours();
    stmts.addConnectionHour.run(username, hour);
    stmts.trimConnectionHours.run(username, username);
}

// Tracker un message privé envoyé (pour ami et lent)
function trackPrivateMessage(senderUsername, receiverUsername, responseTimeMs) {
    const users = readUsers();

    const sender = users.find(u => u.username.toLowerCase() === senderUsername.toLowerCase());
    if (sender) {
        sender.pm_messages_count = (sender.pm_messages_count || 0) + 1;
    }

    if (responseTimeMs && responseTimeMs > 0) {
        const receiver = users.find(u => u.username.toLowerCase() === receiverUsername.toLowerCase());
        if (receiver) {
            const avgCurrent = receiver.avg_pm_response_time || 0;
            const count = receiver.pm_response_count || 0;
            receiver.avg_pm_response_time = (avgCurrent * count + responseTimeMs) / (count + 1);
            receiver.pm_response_count = count + 1;
        }
    }

    writeUsersAndSync(users);
}

// Tracker un sauvetage réussi validé
function trackValidatedRescue(username) {
    const users = readUsers();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (user) {
        user.validated_rescues = (user.validated_rescues || 0) + 1;
        writeUsersAndSync(users);
    }
}

function recalculateBadges() {
    try {
        const users = readUsers();
        if (!Array.isArray(users) || users.length === 0) return;

        let changed = false;

        users.forEach(u => {
            if (ensureBadgeFields(u)) changed = true;
            if (ensureNewBadgeFields(u)) changed = true;
            if (typeof u.messages_total !== 'number') {
                u.messages_total = (u.messages_fill_count || 0) + (u.messages_ai_count || 0);
                changed = true;
            }
        });

        // Marathonien : 30 jours de connexion consécutifs
        users.forEach(u => {
            if (u.login_streak >= 30) {
                if (addBadge(u, BADGE_DEFINITIONS.marathonien.id)) changed = true;
            } else if (removeBadge(u, BADGE_DEFINITIONS.marathonien.id)) {
                changed = true;
            }
        });

        // Collectionneur : 10 badges différents obtenus
        users.forEach(u => {
            if (Array.isArray(u.badges_obtained) && u.badges_obtained.length >= 10) {
                if (addBadge(u, BADGE_DEFINITIONS.collectionneur.id)) changed = true;
            } else if (removeBadge(u, BADGE_DEFINITIONS.collectionneur.id)) {
                changed = true;
            }
        });

        // Pilier de la Source : 100 messages postés
        users.forEach(u => {
            if ((u.messages_total || 0) >= 100) {
                if (addBadge(u, BADGE_DEFINITIONS.pilier.id)) changed = true;
            } else if (removeBadge(u, BADGE_DEFINITIONS.pilier.id)) {
                changed = true;
            }
        });

        // Explorateur : toutes les pages visitées
        const ALL_PAGES = ['home','cartable','cours','communaute','mess','moncompte','ban','info','login','onboarding'];
        users.forEach(u => {
            if (Array.isArray(u.pages_visited) && ALL_PAGES.every(p => u.pages_visited.includes(p))) {
                if (addBadge(u, BADGE_DEFINITIONS.explorateur.id)) changed = true;
            } else if (removeBadge(u, BADGE_DEFINITIONS.explorateur.id)) {
                changed = true;
            }
        });

        // Vestimentaire : 6+ skins/themes/fonds obtenus
        users.forEach(u => {
            if (Array.isArray(u.skins_obtenus) && u.skins_obtenus.length >= 6) {
                if (addBadge(u, BADGE_DEFINITIONS.vestimentaire.id)) changed = true;
            } else if (removeBadge(u, BADGE_DEFINITIONS.vestimentaire.id)) {
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

        // Sociable : top 3 messages_total
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
            if (rank1Winner && u.username === rank1Winner.username) {
                if (addBadge(u, BADGE_DEFINITIONS.rank1.id)) changed = true;
            } else if (removeBadge(u, BADGE_DEFINITIONS.rank1.id)) {
                changed = true;
            }
            if (rank2Winner && u.username === rank2Winner.username) {
                if (addBadge(u, BADGE_DEFINITIONS.rank2.id)) changed = true;
            } else if (removeBadge(u, BADGE_DEFINITIONS.rank2.id)) {
                changed = true;
            }
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
            const connexions = u.connexions || 0;
            const lastConnexion = u.last_connexion || 0;
            const daysSinceLastConnexion = (now - lastConnexion) / (1000 * 60 * 60 * 24);
            const messageCount = (u.messages_total || 0);
            const freshnessFactor = Math.max(0, Math.exp(-daysSinceLastConnexion / 7));
            const activityScore = (connexions * freshnessFactor) + (messageCount * 0.5);
            return { user: u, activityScore };
        });

        const sortedByActivity = [...usersWithActivity].sort((a, b) => b.activityScore - a.activityScore);
        const mostActive = sortedByActivity[0];
        const eligibleInactive = sortedByActivity.filter(u => (u.user.connexions || 0) >= 1);
        const leastActive = eligibleInactive[eligibleInactive.length - 1];

        users.forEach(u => {
            if (mostActive && u.username === mostActive.user.username) {
                if (addBadge(u, BADGE_DEFINITIONS.actif.id)) changed = true;
            } else if (removeBadge(u, BADGE_DEFINITIONS.actif.id)) {
                changed = true;
            }
            if (leastActive && u.username === leastActive.user.username) {
                if (addBadge(u, BADGE_DEFINITIONS.inactif.id)) changed = true;
            } else if (removeBadge(u, BADGE_DEFINITIONS.inactif.id)) {
                changed = true;
            }
        });

        // Dépenseur : celui qui a dépensé le plus de points cette semaine
        const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
        users.forEach(u => {
            if (!u.depenses) u.depenses = 0;
            if (!u.last_depenses_reset) u.last_depenses_reset = now;
            if (now - u.last_depenses_reset >= WEEK_MS) {
                u.depenses = 0;
                u.last_depenses_reset = now;
                changed = true;
            }
        });

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

        // Fantôme : celui qui a envoyé le moins de messages community dans les 5 derniers jours
        try {
            const fiveDaysAgo = now - (5 * 24 * 60 * 60 * 1000);
            const recentRows = stmts.countRecentMessagesBySender.all(fiveDaysAgo);
            const recentMessageCounts = {};
            users.forEach(u => { recentMessageCounts[u.username] = 0; });
            recentRows.forEach(r => {
                if (recentMessageCounts.hasOwnProperty(r.sender)) {
                    recentMessageCounts[r.sender] = r.count;
                }
            });

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

        // LENT : celui qui voit les messages privés le moins vite
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

        // LÈVE TÔT : celui avec les heures de connexion les plus basses
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

        // NOCTURNE : celui avec les heures de connexion les plus tard
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

        // POLICE : celui qui a fait le plus de signalements
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

        // CHEF ÉTOILÉ / JUGE : badges basés sur les cours
        try {
            const courses = readAllCourses();
            const avgByUploader = new Map();
            const votesByUser = new Map();

            for (const c of courses) {
                if (!c || typeof c !== 'object') continue;
                if (c.supprime === true) continue;

                const uploader = safeLower(c.uploaderName);
                const stars = Number(c.stars);
                const votesTotal = Number(c.votes_total || 0);
                if (uploader && votesTotal > 0 && Number.isFinite(stars)) {
                    const prev = avgByUploader.get(uploader) || { sum: 0, count: 0 };
                    prev.sum += stars;
                    prev.count += 1;
                    avgByUploader.set(uploader, prev);
                }

                const votesBy = Array.isArray(c.votes_by) ? c.votes_by : [];
                for (const v of votesBy) {
                    const voter = safeLower(v && v.username);
                    if (!voter) continue;
                    votesByUser.set(voter, (votesByUser.get(voter) || 0) + 1);
                }
            }

            let chefWinnerUsername = null;
            let chefWinnerAvg = -Infinity;
            let chefWinnerCount = 0;
            for (const u of users) {
                const key = safeLower(u.username);
                const st = avgByUploader.get(key);
                if (!st || !st.count) continue;
                const avg = st.sum / st.count;
                if (
                    avg > chefWinnerAvg ||
                    (avg === chefWinnerAvg && st.count > chefWinnerCount) ||
                    (avg === chefWinnerAvg && st.count === chefWinnerCount && String(u.username).localeCompare(String(chefWinnerUsername || '')) < 0)
                ) {
                    chefWinnerUsername = u.username;
                    chefWinnerAvg = avg;
                    chefWinnerCount = st.count;
                }

                if (Number.isFinite(avg)) {
                    const rounded = Math.round(avg * 100) / 100;
                    if (typeof u.course_stars_avg !== 'number' || u.course_stars_avg !== rounded) {
                        u.course_stars_avg = rounded;
                        changed = true;
                    }
                }
            }

            users.forEach(u => {
                if (chefWinnerUsername && u.username === chefWinnerUsername) {
                    if (addBadge(u, BADGE_DEFINITIONS.chefEtoile.id)) changed = true;
                } else if (removeBadge(u, BADGE_DEFINITIONS.chefEtoile.id)) {
                    changed = true;
                }
            });

            let jugeWinnerUsername = null;
            let jugeWinnerVotes = 0;
            for (const u of users) {
                const key = safeLower(u.username);
                const votes = votesByUser.get(key) || 0;
                if (votes <= 0) continue;
                if (
                    votes > jugeWinnerVotes ||
                    (votes === jugeWinnerVotes && String(u.username).localeCompare(String(jugeWinnerUsername || '')) < 0)
                ) {
                    jugeWinnerUsername = u.username;
                    jugeWinnerVotes = votes;
                }
            }

            users.forEach(u => {
                if (jugeWinnerUsername && u.username === jugeWinnerUsername) {
                    if (addBadge(u, BADGE_DEFINITIONS.juge.id)) changed = true;
                } else if (removeBadge(u, BADGE_DEFINITIONS.juge.id)) {
                    changed = true;
                }
            });
        } catch (e) {
            // ignore
        }

        if (changed) {
            writeUsersAndSync(users);
        }
    } catch (e) {
        console.error('Erreur recalculateBadges:', e);
    }
}

// Récompenser le créateur du sujet quand un fill est créé sous son sujet (+3)
function rewardTopicCreatorForFill(fill) {
    if (fill.parentType === 'topic' || fill.parent_type === 'topic') {
        try {
            const parentId = fill.parentId || fill.parent_id;
            const topicRow = stmts.getTopic.get(parentId);
            if (topicRow) {
                const users = readUsers();
                const user = users.find(u => u.username.toLowerCase() === topicRow.created_by.toLowerCase());
                if (user) {
                    console.log(`[POINTS] Récompense sujet pour ${topicRow.created_by}: +3 points`);
                    user.pt = (user.pt || 0) + 3;
                    writeUsersAndSync(users);
                }
            }
        } catch (e) {
            console.error("Erreur rewardTopicCreatorForFill:", e);
        }
    }
}

// Vérifier les points pour une action payante
function checkPointsForAction(username, cost) {
    return checkUserPoints(username, Math.abs(cost));
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
