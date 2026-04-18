'use strict';
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const {
    fs: _fs, path,
    normalizeUsername,
    readAllCoursesFromJSON, computeUserCourseStars,
    checkAndApplyBan,
    uploadProfilePic,
    contributeToChallenge,
    db, stmts, buildUserObject, saveUserFromObject, readUsers, writeUsers, getUserByName
} = require('./shared');
const { addPoints, checkAndApplyDailyLogin, recalculateBadges } = require('../js/points');

function computeCommunityLikeStats(username) {
    const stats = { likesReceived: 0, likesGiven: 0, contributionsCount: 0 };
    if (!username) return stats;
    try {
        const contribs = stmts.countContributionsByUser.get(username);
        stats.contributionsCount = contribs ? contribs.count : 0;
        const received = stmts.countReactionsReceivedByUser.get(username);
        stats.likesReceived = received ? received.count : 0;
        const given = stmts.countReactionsGivenByUser.get(username);
        stats.likesGiven = given ? given.count : 0;
    } catch (e) {
        console.warn('[COMMUNITY_STATS] Error:', e.message);
    }
    return stats;
}

const LEGACY_SOCIAL_BANNERS = {
    oceanic: 'skin-ocean',
    sunset: 'skin-sunset',
    'neon-grid': 'skin-neon',
    forest: 'skin-foret'
};

const SOCIAL_BANNER_THEME_IDS = new Set([
    'bleu basique', 'jaune basique',
    'skin-verdure', 'skin-obsidienne', 'skin-sunset',
    'skin-grenat', 'skin-rose', 'skin-neon',
    'skin-chocolat', 'skin-indigo', 'skin-marbre',
    'skin-aurore', 'skin-pastel', 'skin-cyberpunk',
    'skin-foret', 'skin-sable', 'skin-minuit',
    'skin-ocean', 'skin-lavande', 'skin-cerise', 'skin-arctique'
]);

function normalizeSocialBannerThemeId(rawThemeId) {
    const candidate = String(rawThemeId || '').trim().toLowerCase();
    if (!candidate) return '';
    if (LEGACY_SOCIAL_BANNERS[candidate]) return LEGACY_SOCIAL_BANNERS[candidate];
    if (candidate === 'bleu-basique') return 'bleu basique';
    if (candidate === 'skin-jaune') return 'jaune basique';
    if (SOCIAL_BANNER_THEME_IDS.has(candidate)) return candidate;
    return '';
}

function getUserOwnedBannerThemes(user) {
    const skins = Array.isArray(user && user.skins_obtenus) ? user.skins_obtenus : [];
    const normalized = skins.map(normalizeSocialBannerThemeId).filter(Boolean);
    const unique = Array.from(new Set(normalized));
    if (!unique.includes('bleu basique')) unique.unshift('bleu basique');
    return unique;
}

function getSafeBannerThemeForUser(rawThemeId, user) {
    const owned = getUserOwnedBannerThemes(user);
    const normalized = normalizeSocialBannerThemeId(rawThemeId);
    if (normalized && owned.includes(normalized)) return normalized;
    return owned[0] || 'bleu basique';
}

// --- Login ---
router.post('/api/login', express.json(), async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username et password requis.' });
    }
    try {
        const cleanUsername = normalizeUsername(username).toLowerCase();
        const userRow = stmts.getUserLower.get(cleanUsername);
        if (!userRow) {
            return res.status(401).json({ success: false, message: 'Utilisateur non trouv\u00E9.' });
        }
        const user = buildUserObject(userRow);

        const now = Date.now();
        if (user.ban_until && user.ban_until > now) {
            const remainingHours = Math.ceil((user.ban_until - now) / (60 * 60 * 1000));
            return res.status(403).json({
                success: false, redirect: '/pages/ban.html',
                ban_until: user.ban_until, ban_reason: 'Avertissements accumul\u00E9s',
                message: `Vous \u00EAtes banni pour encore ${remainingHours}h.`
            });
        } else if (user.ban_until && user.ban_until <= now) {
            user.ban_until = null;
            user.banned = false;
            saveUserFromObject(user);
            recalculateBadges();
        }

        if (user.banned) {
            return res.status(403).json({
                success: false, redirect: '/pages/ban.html',
                ban_until: user.ban_until || (now + 48 * 60 * 60 * 1000),
                ban_reason: 'Comportement inappropri\u00E9',
                message: 'Utilisateur banni.'
            });
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Mot de passe incorrect.' });
        }

        user.connexions += 1;
        user.last_connexion = Date.now();
        user.active = true;
        saveUserFromObject(user);
        checkAndApplyDailyLogin(username);
        contributeToChallenge(username, 'connexions');
        contributeToChallenge(username, 'unique_logins');

        const isFirstLogin = user.connexions === 1;
        return res.json({ success: true, redirect: '/index.html', first_login: isFirstLogin, user: { username: user.username, points: user.pt, connexions: user.connexions } });
    } catch (e) {
        console.error("Erreur serveur login :", e);
        return res.status(500).json({ success: false, message: 'Erreur interne serveur.' });
    }
});

// --- Auto increment connexions ---
router.post('/api/auto_increment', express.json(), async (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ success: false, message: 'Username requis.' });
    try {
        const userRow = stmts.getUserLower.get(username.toLowerCase());
        if (!userRow) return res.status(404).json({ success: false, message: 'Utilisateur non trouv\u00E9.' });
        const user = buildUserObject(userRow);
        if (user.connexions >= 1 && (!user.last_connexion || Date.now() - user.last_connexion >= 3600000)) {
            user.connexions += 1;
            user.last_connexion = Date.now();
            saveUserFromObject(user);
        }
        return res.json({ success: true });
    } catch (e) {
        console.error("Erreur serveur auto_increment :", e);
        return res.status(500).json({ success: false, message: 'Erreur interne serveur.' });
    }
});

// --- Check if user is banned ---
router.post('/api/check_ban', express.json(), async (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ banned: false });
    try {
        const userRow = stmts.getUserLower.get(username.toLowerCase());
        if (!userRow) return res.json({ banned: false });
        const user = buildUserObject(userRow);

        const now = Date.now();
        if (user.ban_until && user.ban_until <= now) {
            user.ban_until = null;
            user.banned = false;
            saveUserFromObject(user);
            recalculateBadges();
        }

        if (user.banned || (user.ban_until && user.ban_until > now)) {
            return res.json({ banned: true, ban_until: user.ban_until, ban_reason: 'Avertissements accumul\u00E9s' });
        }
        return res.json({ banned: false });
    } catch (e) {
        console.error("Erreur serveur check_ban :", e);
        return res.status(500).json({ banned: false });
    }
});

// --- GET : R\u00E9cup\u00E9rer les infos utilisateur ---
router.get('/api/user-info/:username', async (req, res) => {
    const username = req.params.username;
    if (!username) return res.status(400).json({ success: false, message: "Nom d'utilisateur requis." });
    try {
        const userRow = stmts.getUserLower.get(username.toLowerCase());
        if (!userRow) return res.status(404).json({ success: false, message: 'Utilisateur non trouv\u00E9.' });
        const user = buildUserObject(userRow);

        let courseAvg = null;
        let courseCount = 0;
        try {
            const courses = readAllCoursesFromJSON();
            const r = computeUserCourseStars(user.username, courses);
            courseAvg = r.avg;
            courseCount = r.count;
        } catch (e) {}

        let changed = false;
        if (!user.active_skin) { user.active_skin = 'bleu basique'; changed = true; }
        if (!user.skins_obtenus || !Array.isArray(user.skins_obtenus)) { user.skins_obtenus = ['bleu basique', 'jaune basique']; changed = true; }
        else if (!user.skins_obtenus.includes('jaune basique')) { user.skins_obtenus.push('jaune basique'); changed = true; }
        if (!user.active_fond) { user.active_fond = 'Vagues'; changed = true; }
        if (!user.fonds_obtenus || !Array.isArray(user.fonds_obtenus)) { user.fonds_obtenus = ['Vagues']; changed = true; }
        else if (!user.fonds_obtenus.includes('Vagues')) { user.fonds_obtenus.unshift('Vagues'); changed = true; }
        if (user.course_stars_avg === undefined) { user.course_stars_avg = 0; changed = true; }
        if (!user.social_profile || typeof user.social_profile !== 'object') {
            user.social_profile = { banner: 'bleu basique', status: '', badge_showcase: [] };
            changed = true;
        }
        const safeBanner = getSafeBannerThemeForUser(user.social_profile.banner, user);
        if (user.social_profile.banner !== safeBanner) { user.social_profile.banner = safeBanner; changed = true; }
        if (!Array.isArray(user.social_profile.badge_showcase)) { user.social_profile.badge_showcase = []; changed = true; }
        if (typeof courseAvg === 'number' && Number.isFinite(courseAvg) && user.course_stars_avg !== courseAvg) {
            user.course_stars_avg = courseAvg; changed = true;
        }

        if (changed) saveUserFromObject(user);

        const communityStats = computeCommunityLikeStats(user.username);

        return res.json({
            success: true,
            user: {
                username: user.username,
                color: user.color || null,
                birth_date: user.birth_date || null,
                connexions: user.connexions || 0,
                last_connexion: user.last_connexion || null,
                badges_current: user.badges_current || [],
                badges_obtained: user.badges_obtained || [],
                pt: user.pt || 0,
                login_streak: user.login_streak || 0,
                course_stars_avg: (typeof courseAvg === 'number' ? courseAvg : (typeof user.course_stars_avg === 'number' ? user.course_stars_avg : null)),
                course_stars_count: courseCount,
                active_skin: user.active_skin || 'bleu basique',
                skins_obtenus: user.skins_obtenus || ['bleu basique', 'jaune basique'],
                active_fond: user.active_fond || 'Vagues',
                fonds_obtenus: user.fonds_obtenus || ['Vagues'],
                social_profile: {
                    banner: getSafeBannerThemeForUser(user.social_profile.banner, user),
                    status: user.social_profile.status || '',
                    badge_showcase: Array.isArray(user.social_profile.badge_showcase) ? user.social_profile.badge_showcase : []
                },
                contributions_count: communityStats.contributionsCount,
                likes_received: communityStats.likesReceived,
                likes_given: communityStats.likesGiven,
                reports_count: (user.reports || []).length,
                warnings_count: (user.warnings || []).filter(w => w.expiresAt > Date.now()).length
            }
        });
    } catch (e) {
        console.error("Erreur serveur user-info :", e);
        return res.status(500).json({ success: false, message: 'Erreur interne serveur.' });
    }
});

router.post('/api/user-social-profile', express.json(), async (req, res) => {
    const username = String((req.body && req.body.username) || '').trim();
    const social = (req.body && req.body.socialProfile) || {};
    if (!username) return res.status(400).json({ success: false, message: 'Username requis.' });

    const cleanStatus = String(social.status || '').replace(/\s+/g, ' ').trim().slice(0, 100);
    const cleanShowcase = Array.isArray(social.badge_showcase)
        ? Array.from(new Set(social.badge_showcase.map(x => String(x || '').trim()).filter(Boolean))).slice(0, 3)
        : [];

    try {
        const userRow = stmts.getUserLower.get(username.toLowerCase());
        if (!userRow) return res.status(404).json({ success: false, message: 'Utilisateur non trouv\u00E9.' });
        const user = buildUserObject(userRow);

        const cleanBanner = getSafeBannerThemeForUser(social.banner, user);
        user.social_profile = { banner: cleanBanner, status: cleanStatus, badge_showcase: cleanShowcase };
        saveUserFromObject(user);

        return res.json({ success: true, social_profile: user.social_profile });
    } catch (e) {
        console.error('Erreur user-social-profile:', e);
        return res.status(500).json({ success: false, message: 'Erreur interne serveur.' });
    }
});

// --- GET : Progression des badges ---
router.get('/api/badge-progress/:username', (req, res) => {
    const username = req.params.username;
    if (!username) return res.status(400).json({ success: false });
    try {
        const userRow = stmts.getUserLower.get(username.toLowerCase());
        if (!userRow) return res.status(404).json({ success: false });
        const user = buildUserObject(userRow);

        const ALL_PAGES = ['home','cartable','cours','communaute','mess','moncompte','ban','info','login','onboarding'];
        const pagesVisited = Array.isArray(user.pages_visited) ? user.pages_visited.filter(p => ALL_PAGES.includes(p)).length : 0;

        const progress = {
            marathonien:    { current: user.login_streak || 0, target: 30 },
            collectionneur: { current: (user.badges_obtained || []).length, target: 10 },
            pilier:         { current: user.messages_total || 0, target: 100 },
            explorateur:    { current: pagesVisited, target: ALL_PAGES.length },
            vestimentaire:  { current: (user.skins_obtenus || []).length, target: 6 },
            sociable:       { current: user.messages_total || 0, target: 50, label: 'messages' },
            sauveur:        { current: user.validated_rescues || 0, target: 5 },
            ami:            { current: user.pm_messages_count || 0, target: 30 }
        };

        return res.json({ success: true, progress });
    } catch (e) {
        console.error("Erreur badge-progress:", e);
        return res.status(500).json({ success: false });
    }
});

// --- Signaler un message ---
router.post('/api/report-message', express.json(), async (req, res) => {
    const { messageId, reportedUser, reportingUser } = req.body;
    console.log('[REPORT] Signalement re\u00E7u:', { messageId, reportedUser, reportingUser });
    if (!reportingUser) return res.status(401).json({ success: false, message: 'Non connect\u00E9.' });
    if (!messageId || !reportedUser) return res.status(400).json({ success: false, message: 'Donn\u00E9es invalides.' });

    try {
        const reportedRow = stmts.getUserLower.get(reportedUser.toLowerCase());
        if (!reportedRow) return res.status(404).json({ success: false, message: 'Utilisateur non trouv\u00E9.' });
        const user = buildUserObject(reportedRow);

        const reportingRow = stmts.getUserLower.get(reportingUser.toLowerCase());
        if (!reportingRow) return res.status(404).json({ success: false, message: 'Utilisateur signaleur non trouv\u00E9.' });
        const reportingUserObj = buildUserObject(reportingRow);

        if (!reportingUserObj.reports_made) reportingUserObj.reports_made = [];
        const now = Date.now();
        const oneDayAgo = now - (24 * 60 * 60 * 1000);
        reportingUserObj.reports_made = reportingUserObj.reports_made.filter(r => r.timestamp > oneDayAgo);
        const reportedUsersToday = new Set(reportingUserObj.reports_made.map(r => r.reportedUser.toLowerCase()));

        if (!reportedUsersToday.has(reportedUser.toLowerCase())) {
            if (reportedUsersToday.size >= 2) {
                return res.status(429).json({ success: false, message: 'Tu ne peux signaler que 2 personnes diff\u00E9rentes par jour.' });
            }
        }

        reportingUserObj.reports_made.push({ timestamp: now, reportedUser });
        saveUserFromObject(reportingUserObj);

        if (!user.reports) user.reports = [];
        if (!user.warnings) user.warnings = [];
        if (!user.ban_until) user.ban_until = null;

        user.reports.push({ timestamp: now, reportedBy: reportingUser, messageId });
        console.log(`[REPORT] Signalement ajout\u00E9 pour ${reportedUser}. Total: ${user.reports.length}`);

        const twoDaysAgo = now - (2 * 24 * 60 * 60 * 1000);
        const recentReports = user.reports.filter(r => r.timestamp > twoDaysAgo);

        if (recentReports.length >= 3) {
            user.warnings.push({
                timestamp: now,
                reason: '3 signalements en 2 jours',
                expiresAt: now + (7 * 24 * 60 * 60 * 1000)
            });
            checkAndApplyBan(user, now);
            saveUserFromObject(user);
            recalculateBadges();
            return res.json({ success: true, message: "Message signal\u00E9. L'utilisateur a re\u00E7u un avertissement.", warning: true });
        }

        saveUserFromObject(user);
        recalculateBadges();
        return res.json({ success: true, message: `Message signal\u00E9 avec succ\u00E8s. (${recentReports.length}/3 signalements en 2 jours)` });
    } catch (e) {
        console.error("Erreur serveur report-message :", e);
        return res.status(500).json({ success: false, message: 'Erreur interne serveur.' });
    }
});

// --- Changer le mot de passe ---
router.post('/api/change-password', express.json(), async (req, res) => {
    const { username, newPassword } = req.body;
    if (!username || !newPassword) return res.status(400).json({ success: false, message: "Nom d'utilisateur et nouveau mot de passe requis." });
    if (newPassword.length < 3) return res.status(400).json({ success: false, message: 'Le mot de passe doit contenir au moins 3 caract\u00E8res.' });
    try {
        const userRow = stmts.getUserLower.get(username.toLowerCase());
        if (!userRow) return res.status(404).json({ success: false, message: 'Utilisateur non trouv\u00E9.' });
        const user = buildUserObject(userRow);
        const newHash = await bcrypt.hash(newPassword, 10);
        user.passwordHash = newHash;
        saveUserFromObject(user);
        return res.json({ success: true, message: 'Mot de passe chang\u00E9 avec succ\u00E8s.' });
    } catch (e) {
        console.error("Erreur serveur change-password :", e);
        return res.status(500).json({ success: false, message: 'Erreur interne serveur.' });
    }
});

// --- Update birth date ---
router.post('/api/update-birth-date', express.json(), async (req, res) => {
    const { username, birthDate } = req.body;
    if (!username || !birthDate) return res.status(400).json({ success: false, message: "Nom d'utilisateur et date de naissance requis." });
    try {
        const userRow = stmts.getUserLower.get(username.toLowerCase());
        if (!userRow) return res.status(404).json({ success: false, message: 'Utilisateur non trouv\u00E9.' });
        const user = buildUserObject(userRow);
        user.birth_date = birthDate;
        saveUserFromObject(user);
        return res.json({ success: true, message: 'Date de naissance mise \u00E0 jour.' });
    } catch (e) {
        console.error("Erreur serveur update-birth-date :", e);
        return res.status(500).json({ success: false, message: 'Erreur interne serveur.' });
    }
});

// --- Update profile pic ---
router.post('/api/update-profile-pic', uploadProfilePic.single('profilePic'), async (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ success: false, message: "Nom d'utilisateur requis." });
    if (!req.file) return res.status(400).json({ success: false, message: 'Aucun fichier upload\u00E9.' });
    try {
        const picPath = `/api/community/ressources/pp/${req.file.filename}`;
        stmts.upsertProfilePic.run(username, picPath);

        // Keep pp.json synced for frontend
        const ppJsonPath = path.join(__dirname, '..', 'public', 'api', 'community', 'ressources', 'pp', 'pp.json');
        let ppData = {};
        try { ppData = JSON.parse(_fs.readFileSync(ppJsonPath, 'utf8')); } catch {}
        ppData[username] = picPath;
        _fs.writeFileSync(ppJsonPath, JSON.stringify(ppData, null, 2));

        return res.json({ success: true, message: 'Photo de profil mise \u00E0 jour.', picPath });
    } catch (e) {
        console.error("Erreur serveur update-profile-pic :", e);
        return res.status(500).json({ success: false, message: 'Erreur interne serveur.' });
    }
});

// --- GET : R\u00E9cup\u00E9rer les points ---
router.get('/public/api/points/:username', (req, res) => {
    const username = req.params.username;
    try {
        const usersData = readUsers();
        const allUsersPoints = usersData.map(u => ({ username: u.username, points: typeof u.pt === 'number' ? u.pt : 0 }));
        const currentUserData = allUsersPoints.find(u => u.username === username);
        const collectivePoints = allUsersPoints.reduce((sum, user) => sum + user.points, 0);
        const ranking = allUsersPoints.sort((a, b) => b.points - a.points);
        return res.json({ individualPoints: currentUserData ? currentUserData.points : 0, collectivePoints, ranking });
    } catch (e) {
        console.error("Erreur points:", e.message);
        return res.status(500).json({ error: "Erreur serveur lors de la lecture des points." });
    }
});

// --- Logout ---
router.post('/api/logout', express.json(), (req, res) => {
    const { username } = req.body;
    if (username) {
        try {
            const userRow = stmts.getUserLower.get(username.toLowerCase());
            if (userRow) {
                const user = buildUserObject(userRow);
                user.active = false;
                saveUserFromObject(user);
                console.log(`[AUTH] Logout r\u00E9ussi pour : ${username}`);
            }
        } catch (e) {
            console.error("Erreur lors du logout :", e);
        }
    }
    return res.json({ success: true, redirect: '/public/pages/login.html' });
});

module.exports = router;
