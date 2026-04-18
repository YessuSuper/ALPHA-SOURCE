'use strict';
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const {
    normalizeUsername, checkAndApplyBan,
    readAllCoursesFromJSON, writeAllCoursesToJSON,
    readAllMessagesFromJSON, readRescues, readFillJoinRequests,
    db, stmts, buildUserObject, saveUserFromObject, readUsers, writeUsers
} = require('./shared');
const { recalculateBadges } = require('../js/points');

// ============================================================
// CONFIG
// ============================================================
const ADMIN_USERNAMES = ['even', 'admin'];
const TOKEN_EXPIRY_MS = 12 * 60 * 60 * 1000; // 12h
const activeTokens = new Map();

setInterval(() => {
    const now = Date.now();
    for (const [token, data] of activeTokens) {
        if (data.expiresAt < now) activeTokens.delete(token);
    }
}, 30 * 60 * 1000);

// ============================================================
// HELPERS
// ============================================================
function generateToken() {
    return crypto.randomBytes(48).toString('hex');
}

function buildCommunityGlobalFromSQL() {
    const groups = stmts.allGroups.all().map(g => ({
        id: g.id, name: g.name, type: g.type, description: g.description || '',
        isPrivate: !!g.is_private, createdAt: g.created_at,
        members: stmts.groupMembers.all(g.id).map(m => m.username),
        message_count: (stmts.messagesByDiscussion.all('group', g.id) || []).length
    }));
    const topics = stmts.allTopics.all().map(t => ({
        id: t.id, title: t.title, author: t.author, content: t.content,
        tags: t.tags ? JSON.parse(t.tags) : [], createdAt: t.created_at,
        reactions: stmts.reactionsByDiscussion.all('topic', t.id).map(r => ({
            username: r.username, type: r.type, createdAt: r.created_at
        }))
    }));
    const fills = stmts.allFills.all().map(f => ({
        id: f.id, name: f.name, parentType: f.parent_type, parentId: f.parent_id,
        admin: f.admin, expiresAt: f.expires_at, createdAt: f.created_at,
        penalized_low_activity: !!f.penalized_low_activity,
        members: stmts.fillMembers.all(f.id).map(m => ({ username: m.username, joinedAt: m.joined_at })),
        message_count: (stmts.messagesByDiscussion.all('fill', f.id) || []).length
    }));
    const mps = stmts.allMps.all().map(mp => ({
        id: mp.id, createdAt: mp.created_at,
        participants: stmts.mpParticipants.all(mp.id).map(p => p.username),
        message_count: (stmts.messagesByDiscussion.all('mp', mp.id) || []).length
    }));
    return { groups, topics, fills, mps };
}

// ============================================================
// AUTH MIDDLEWARE
// ============================================================
function requireAdmin(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Token manquant.' });
    }
    const token = authHeader.slice(7);
    const session = activeTokens.get(token);
    if (!session) return res.status(401).json({ success: false, message: 'Token invalide ou expir\u00E9.' });
    if (session.expiresAt < Date.now()) {
        activeTokens.delete(token);
        return res.status(401).json({ success: false, message: 'Token expir\u00E9. Reconnectez-vous.' });
    }
    req.adminUser = session.username;
    next();
}

// ============================================================
// AUTH
// ============================================================
router.post('/login', express.json(), async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, message: 'Username et password requis.' });

    const clean = normalizeUsername(username).toLowerCase();
    if (!ADMIN_USERNAMES.includes(clean)) return res.status(403).json({ success: false, message: "Tu n'es pas admin." });

    const targetUsername = clean === 'admin' ? 'even' : clean;
    const userRow = stmts.getUserLower.get(targetUsername);
    if (!userRow) return res.status(401).json({ success: false, message: 'Utilisateur non trouv\u00E9.' });
    const user = buildUserObject(userRow);

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Mot de passe incorrect.' });

    const token = generateToken();
    activeTokens.set(token, { username: user.username, expiresAt: Date.now() + TOKEN_EXPIRY_MS });
    return res.json({ success: true, token, expiresIn: TOKEN_EXPIRY_MS / 1000, message: `Connect\u00E9 en tant qu'admin (${user.username}).` });
});

router.post('/logout', requireAdmin, (req, res) => {
    const token = req.headers.authorization.slice(7);
    activeTokens.delete(token);
    return res.json({ success: true, message: 'D\u00E9connect\u00E9.' });
});

// ============================================================
// UTILISATEURS
// ============================================================
router.get('/users', requireAdmin, (req, res) => {
    const users = readUsers();
    const now = Date.now();
    const result = users.map(u => ({
        username: u.username,
        points: u.pt || 0,
        connexions: u.connexions || 0,
        last_connexion: u.last_connexion || null,
        active: u.active || false,
        banned: u.banned || false,
        ban_until: u.ban_until || null,
        warnings: (u.warnings || []).filter(w => w.expiresAt > now),
        warnings_total: (u.warnings || []).length,
        reports_received: (u.reports || []).length,
        reports_made: (u.reports_made || []).length,
        badges_current: u.badges_current || [],
        badges_obtained: u.badges_obtained || [],
        birth_date: u.birth_date || null,
        messages_total: u.messages_total || 0,
        messages_fill_count: u.messages_fill_count || 0,
        messages_ai_count: u.messages_ai_count || 0,
        pm_messages_count: u.pm_messages_count || 0,
        login_streak: u.login_streak || 0,
        course_stars_avg: u.course_stars_avg || 0,
        active_skin: u.active_skin || null,
        skins_obtenus: u.skins_obtenus || [],
        depenses: u.depenses || 0,
        graph_pt: u.graph_pt || []
    }));
    return res.json({ success: true, count: result.length, users: result });
});

router.get('/users/:username', requireAdmin, (req, res) => {
    const clean = normalizeUsername(req.params.username).toLowerCase();
    const userRow = stmts.getUserLower.get(clean);
    if (!userRow) return res.status(404).json({ success: false, message: 'Utilisateur non trouv\u00E9.' });
    const user = buildUserObject(userRow);
    const { passwordHash, ...safe } = user;
    return res.json({ success: true, user: safe });
});

// ============================================================
// MOD\u00C9RATION : BANS
// ============================================================
router.post('/ban', requireAdmin, express.json(), (req, res) => {
    const { username, duration_hours, reason } = req.body;
    if (!username) return res.status(400).json({ success: false, message: 'Username requis.' });
    const clean = normalizeUsername(username).toLowerCase();
    const userRow = stmts.getUserLower.get(clean);
    if (!userRow) return res.status(404).json({ success: false, message: 'Utilisateur non trouv\u00E9.' });
    const user = buildUserObject(userRow);
    const hours = Number(duration_hours) || 48;
    user.banned = true;
    user.ban_until = Date.now() + hours * 60 * 60 * 1000;
    user.ban_reason = reason || 'D\u00E9cision administrative';
    saveUserFromObject(user);
    recalculateBadges();
    return res.json({ success: true, message: `${user.username} banni pour ${hours}h.`, ban_until: user.ban_until });
});

router.post('/unban', requireAdmin, express.json(), (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ success: false, message: 'Username requis.' });
    const clean = normalizeUsername(username).toLowerCase();
    const userRow = stmts.getUserLower.get(clean);
    if (!userRow) return res.status(404).json({ success: false, message: 'Utilisateur non trouv\u00E9.' });
    const user = buildUserObject(userRow);
    user.banned = false;
    user.ban_until = null;
    user.ban_reason = null;
    saveUserFromObject(user);
    recalculateBadges();
    return res.json({ success: true, message: `${user.username} d\u00E9banni.` });
});

// ============================================================
// MOD\u00C9RATION : AVERTISSEMENTS
// ============================================================
router.post('/warn', requireAdmin, express.json(), (req, res) => {
    const { username, reason } = req.body;
    if (!username) return res.status(400).json({ success: false, message: 'Username requis.' });
    const clean = normalizeUsername(username).toLowerCase();
    const userRow = stmts.getUserLower.get(clean);
    if (!userRow) return res.status(404).json({ success: false, message: 'Utilisateur non trouv\u00E9.' });
    const user = buildUserObject(userRow);
    if (!user.warnings) user.warnings = [];
    const warning = {
        timestamp: Date.now(),
        reason: reason || 'Avertissement administratif',
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000
    };
    user.warnings.push(warning);
    checkAndApplyBan(user, Date.now());
    saveUserFromObject(user);
    recalculateBadges();
    return res.json({
        success: true,
        message: `Avertissement ajout\u00E9 \u00E0 ${user.username}.`,
        warning,
        active_warnings: user.warnings.filter(w => w.expiresAt > Date.now()).length,
        is_now_banned: user.banned
    });
});

router.post('/remove-warning', requireAdmin, express.json(), (req, res) => {
    const { username, warning_index } = req.body;
    if (!username) return res.status(400).json({ success: false, message: 'Username requis.' });
    const clean = normalizeUsername(username).toLowerCase();
    const userRow = stmts.getUserLower.get(clean);
    if (!userRow) return res.status(404).json({ success: false, message: 'Utilisateur non trouv\u00E9.' });
    const user = buildUserObject(userRow);
    const active = (user.warnings || []).filter(w => w.expiresAt > Date.now());
    const idx = Number(warning_index);
    if (isNaN(idx) || idx < 0 || idx >= active.length) {
        return res.status(400).json({ success: false, message: `Index invalide. ${active.length} avertissements actifs (0-${active.length - 1}).` });
    }
    const target = active[idx];
    user.warnings = user.warnings.filter(w => w !== target);
    saveUserFromObject(user);
    recalculateBadges();
    return res.json({ success: true, message: `Avertissement retir\u00E9 de ${user.username}.`, remaining: user.warnings.filter(w => w.expiresAt > Date.now()).length });
});

router.post('/clear-warnings', requireAdmin, express.json(), (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ success: false, message: 'Username requis.' });
    const clean = normalizeUsername(username).toLowerCase();
    const userRow = stmts.getUserLower.get(clean);
    if (!userRow) return res.status(404).json({ success: false, message: 'Utilisateur non trouv\u00E9.' });
    const user = buildUserObject(userRow);
    const count = (user.warnings || []).length;
    user.warnings = [];
    saveUserFromObject(user);
    recalculateBadges();
    return res.json({ success: true, message: `${count} avertissements supprim\u00E9s pour ${user.username}.` });
});

// ============================================================
// SIGNALEMENTS
// ============================================================
router.get('/reports', requireAdmin, (req, res) => {
    const users = readUsers();
    const allReports = [];
    for (const u of users) {
        for (const r of (u.reports || [])) {
            allReports.push({
                reported_user: u.username,
                reported_by: r.reportedBy,
                message_id: r.messageId,
                timestamp: r.timestamp
            });
        }
    }
    allReports.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    return res.json({ success: true, count: allReports.length, reports: allReports });
});

// ============================================================
// COMMUNAUT\u00C9
// ============================================================
router.get('/community/groups', requireAdmin, (req, res) => {
    const global = buildCommunityGlobalFromSQL();
    return res.json({ success: true, count: global.groups.length, groups: global.groups });
});

router.get('/community/groups/:id', requireAdmin, (req, res) => {
    const row = stmts.getGroup.get(req.params.id);
    if (!row) return res.status(404).json({ success: false, message: 'Groupe non trouv\u00E9.' });
    const members = stmts.groupMembers.all(row.id).map(m => m.username);
    const messages = stmts.messagesByDiscussion.all('group', row.id).map(m => ({
        id: m.id, author: m.author, content: m.content, createdAt: m.created_at,
        attachments: m.attachments ? JSON.parse(m.attachments) : []
    }));
    return res.json({ success: true, group: { ...row, members, messages } });
});

router.get('/community/fills', requireAdmin, (req, res) => {
    const global = buildCommunityGlobalFromSQL();
    return res.json({ success: true, count: global.fills.length, fills: global.fills });
});

router.get('/community/fills/:id', requireAdmin, (req, res) => {
    const row = stmts.getFill.get(req.params.id);
    if (!row) return res.status(404).json({ success: false, message: 'Fill non trouv\u00E9.' });
    const members = stmts.fillMembers.all(row.id).map(m => ({ username: m.username, joinedAt: m.joined_at }));
    const messages = stmts.messagesByDiscussion.all('fill', row.id).map(m => ({
        id: m.id, author: m.author, content: m.content, createdAt: m.created_at,
        attachments: m.attachments ? JSON.parse(m.attachments) : []
    }));
    return res.json({ success: true, fill: { ...row, members, messages } });
});

router.get('/community/topics', requireAdmin, (req, res) => {
    const global = buildCommunityGlobalFromSQL();
    return res.json({ success: true, count: global.topics.length, topics: global.topics });
});

router.get('/community/mps', requireAdmin, (req, res) => {
    const global = buildCommunityGlobalFromSQL();
    return res.json({ success: true, count: global.mps.length, mps: global.mps });
});

router.get('/community/mps/:id', requireAdmin, (req, res) => {
    const row = stmts.getMp.get(req.params.id);
    if (!row) return res.status(404).json({ success: false, message: 'MP non trouv\u00E9.' });
    const participants = stmts.mpParticipants.all(row.id).map(p => p.username);
    const messages = stmts.messagesByDiscussion.all('mp', row.id).map(m => ({
        id: m.id, author: m.author, content: m.content, createdAt: m.created_at,
        attachments: m.attachments ? JSON.parse(m.attachments) : []
    }));
    return res.json({ success: true, mp: { ...row, participants, messages } });
});

// ============================================================
// MESSAGERIE
// ============================================================
router.get('/messages', requireAdmin, (req, res) => {
    const messages = readAllMessagesFromJSON();
    return res.json({ success: true, count: messages.length, messages });
});

router.get('/rescues', requireAdmin, (req, res) => {
    const rescues = readRescues();
    return res.json({ success: true, count: rescues.length, rescues });
});

router.get('/fill-requests', requireAdmin, (req, res) => {
    const requests = readFillJoinRequests();
    return res.json({ success: true, count: requests.length, requests });
});

// ============================================================
// COURS
// ============================================================
router.get('/courses', requireAdmin, (req, res) => {
    const courses = readAllCoursesFromJSON();
    return res.json({ success: true, count: courses.length, courses });
});

router.post('/courses/delete', requireAdmin, express.json(), (req, res) => {
    const { course_id } = req.body;
    if (!course_id) return res.status(400).json({ success: false, message: 'course_id requis.' });
    const courses = readAllCoursesFromJSON();
    const course = courses.find(c => c.id === course_id);
    if (!course) return res.status(404).json({ success: false, message: 'Cours non trouv\u00E9.' });
    course.supprime = true;
    course.deletedAt = new Date().toISOString();
    writeAllCoursesToJSON(courses);
    return res.json({ success: true, message: `Cours "${course.title || course_id}" supprim\u00E9.` });
});

// ============================================================
// STATS G\u00C9N\u00C9RALES
// ============================================================
router.get('/stats', requireAdmin, (req, res) => {
    const users = readUsers();
    const messages = readAllMessagesFromJSON();
    const courses = readAllCoursesFromJSON();
    const global = buildCommunityGlobalFromSQL();
    const now = Date.now();

    const activeUsers = users.filter(u => u.active);
    const bannedUsers = users.filter(u => u.banned || (u.ban_until && u.ban_until > now));
    const warnedUsers = users.filter(u => (u.warnings || []).some(w => w.expiresAt > now));
    const totalPoints = users.reduce((s, u) => s + (u.pt || 0), 0);
    const totalMessages = users.reduce((s, u) => s + (u.messages_total || 0), 0);

    return res.json({
        success: true,
        stats: {
            users_total: users.length,
            users_active: activeUsers.length,
            users_banned: bannedUsers.length,
            users_warned: warnedUsers.length,
            total_points: totalPoints,
            total_community_messages: totalMessages,
            internal_messages: messages.length,
            courses_total: courses.length,
            courses_active: courses.filter(c => !c.supprime).length,
            groups: global.groups.length,
            topics: global.topics.length,
            fills: global.fills.length,
            mps: global.mps.length
        }
    });
});

// ============================================================
// CATCH-ALL
// ============================================================
router.all('*', (req, res) => {
    if (req.path === '/login') return;
    return res.status(403).json({ success: false, message: "Tu n'es pas admin." });
});

module.exports = router;