// routes/shared.js - Constantes, chemins et utilitaires partagés entre tous les fichiers de routes
// MIGRATED TO SQLITE — toutes les lectures/écritures passent par db.js
'use strict';

const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
const multer = require('multer');
const { db, stmts, buildUserObject, saveUserFromObject, readUsers, writeUsers,
    getUserByName, addPointsToUser, spendUserPoints, checkUserPoints,
    buildCourseObject, readAllCourses, writeAllCourses } = require('../db');

// ============================================================
// CHEMINS (conservés pour compatibilité — uploads restent sur disque)
// ============================================================
const ROOT_DIR = path.join(__dirname, '..');
const PUBLIC_API_DIR = path.join(ROOT_DIR, 'public', 'api');
const USERS_PATH = path.join(PUBLIC_API_DIR, 'users.json'); // legacy reference
const BDD_FILE_PATH = path.join(PUBLIC_API_DIR, 'bdd.json'); // legacy reference
const MDPED_PATH = path.join(PUBLIC_API_DIR, 'mdped.json');
const ALL_PATH = path.join(PUBLIC_API_DIR, 'all.json'); // legacy reference
const IMAGES_DIR = path.join(ROOT_DIR, 'images');
const UPLOADS_DIR = path.join(ROOT_DIR, 'public', 'uploads');
const DATA_DIR = path.join(ROOT_DIR, 'data');

// Legacy paths kept for reference but no longer used for data
const MESSAGES_PATH = path.join(PUBLIC_API_DIR, 'messagerie/messages.json');
const RESCUES_PATH = path.join(PUBLIC_API_DIR, 'messagerie/rescues.json');
const FILL_JOIN_REQUESTS_PATH = path.join(PUBLIC_API_DIR, 'community', 'fill_join_requests.json');
const COURS_FILE_PATH = path.join(PUBLIC_API_DIR, 'cours.json');

// ============================================================
// CLASSE
// ============================================================
const CLASS_NAMES = [
    'Even', 'Alexandre', 'Calixte', 'NoÃ©', 'Julia', 'Joan', 'Juliette', 'Jezy',
    'InÃ¨s', 'TimÃ©o', 'TymÃ©o', 'Clautilde', 'Loanne', 'Lucie', 'Camille', 'Sofia',
    'Lilia', 'Amir', 'Robin', 'Arthur', 'Maxime', 'Gaultier', 'Antoine', 'Louis',
    'Anne-Victoria', 'LÃ©a', 'Sarah', 'Ema', 'Jade', 'Alicia', 'Claire'
];

// ============================================================
// MULTER
// ============================================================
const ALLOWED_COURSE_TYPES = /pdf|doc|docx|ppt|pptx|xls|xlsx|txt|odt|png|jpg|jpeg|gif|webp|avif|svg/;
const ALLOWED_IMAGE_TYPES = /png|jpg|jpeg|gif|webp|avif|svg/;

function fileFilter(allowedExtRegex) {
    return (req, file, cb) => {
        const ext = path.extname(file.originalname).replace('.', '').toLowerCase();
        if (allowedExtRegex.test(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Type de fichier non autoris\u00e9 : .' + ext));
        }
    };
}

const courseStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + '-' + uniqueSuffix + '-' + file.originalname);
    }
});
const uploadCourse = multer({ storage: courseStorage, fileFilter: fileFilter(ALLOWED_COURSE_TYPES), limits: { fileSize: 20 * 1024 * 1024 } });

const communityStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const communityDir = path.join(ROOT_DIR, 'pictures_documents');
        if (!fs.existsSync(communityDir)) fs.mkdirSync(communityDir, { recursive: true });
        cb(null, communityDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, 'community-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const uploadCommunity = multer({ storage: communityStorage, fileFilter: fileFilter(ALLOWED_IMAGE_TYPES), limits: { fileSize: 10 * 1024 * 1024 } });

const profilePicStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const ppDir = path.join(ROOT_DIR, 'public', 'api', 'community', 'ressources', 'pp');
        if (!fs.existsSync(ppDir)) fs.mkdirSync(ppDir, { recursive: true });
        cb(null, ppDir);
    },
    filename: (req, file, cb) => {
        const username = req.body.username || 'unknown';
        const timestamp = Date.now();
        const ext = path.extname(file.originalname);
        cb(null, `${username}_${timestamp}${ext}`);
    }
});
const uploadProfilePic = multer({ storage: profilePicStorage, fileFilter: fileFilter(ALLOWED_IMAGE_TYPES), limits: { fileSize: 5 * 1024 * 1024 } });

// ============================================================
// UTILITAIRES BASIQUES
// ============================================================
function normalizeUsername(input) {
    if (typeof input !== 'string') return '';
    return input.trim().replace(/[\u200B-\u200D\uFEFF]/g, '').normalize('NFKC');
}

function safeLower(s) { return String(s || '').trim().toLowerCase(); }
function parseIsoMs(iso) { const t = Date.parse(String(iso || '')); return Number.isFinite(t) ? t : null; }
function truthy(v) { if (v === true) return true; if (!v) return false; const s = String(v).trim().toLowerCase(); return ['true', '1', 'oui', 'o', 'y', 'yes'].includes(s); }
function clampText(str, max = 280) { if (!str || typeof str !== 'string') return ''; return str.length > max ? `${str.slice(0, max)}...` : str; }

function stripHtmlToText(html) {
    const s = String(html || '');
    return s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractTitleFromHtml(html) {
    const text = stripHtmlToText(html);
    if (!text) return '';
    const first = text.split(/\s*\n\s*|\s*\r\s*/).filter(Boolean)[0] || text;
    return first.length > 120 ? first.slice(0, 117) + '...' : first;
}

// ============================================================
// UTILISATEURS
// ============================================================
function getUserNameById(userId) {
    const id = String(userId);
    if (id === '1') return 'Source AI (Bot)';
    if (id === '2') return 'Source Admin';
    const idx = Number(id) - 3;
    if (!Number.isNaN(idx) && idx >= 0 && idx < CLASS_NAMES.length) return CLASS_NAMES[idx];
    return null;
}

function getUserIdByName(name) {
    if (!name) return null;
    const lower = name.toLowerCase();
    if (lower.includes('source ai')) return '1';
    if (lower.includes('source admin')) return '2';
    const idx = CLASS_NAMES.findIndex(n => n.toLowerCase() === lower);
    return idx >= 0 ? String(idx + 3) : null;
}

function buildSimulatedUsers() {
    const base = [{ id: '1', name: 'Source AI (Bot)' }, { id: '2', name: 'Source Admin' }];
    const mapped = CLASS_NAMES.map((name, index) => ({ id: String(index + 3), name }));
    return [...base, ...mapped];
}

function buildAllSummaryFromUsers() {
    try {
        const rows = stmts.getAllUsers.all();
        const userRanking = rows.map(r => ({
            username: r.username,
            points: r.pt || 0,
            connexions: r.connexions || 0,
            last_connexion: r.last_connexion || null,
            active: !!r.active
        }));
        const collectivePoints = rows.reduce((sum, r) => sum + (r.pt || 0), 0);
        return {
            user_ranking: userRanking,
            collective_data: { collective_points_pc: collectivePoints, last_updated: new Date().toISOString() }
        };
    } catch (e) {
        console.error("Erreur buildAllSummaryFromUsers :", e);
        return { user_ranking: [], collective_data: { collective_points_pc: 0, last_updated: new Date().toISOString() } };
    }
}

// ============================================================
// MESSAGERIE
// ============================================================
function readAllMessagesFromJSON() {
    try {
        const rows = stmts.getAllMessages.all();
        return rows.map(row => {
            const recipients = stmts.getRecipients.all(row.id);
            const attachments = stmts.getAttachments.all(row.id);
            return {
                id: row.id,
                senderId: row.sender_id,
                subject: row.subject,
                body: row.body,
                timestamp: row.timestamp,
                type: row.type || 'normal',
                recipients: recipients.map(r => r.recipient_id),
                readBy: recipients.filter(r => r.read).map(r => r.recipient_id),
                unreadBy: recipients.filter(r => !r.read).map(r => r.recipient_id),
                attachments: attachments.map(a => ({ name: a.name, size: a.size, data: a.data })),
                fill_join_request_id: row.fill_join_request_id || undefined,
                fillJoinRequestId: row.fill_join_request_id || undefined,
                fill_id: row.fill_id || undefined,
                fillId: row.fill_id || undefined,
                fill_name: row.fill_name || undefined,
                fillName: row.fill_name || undefined,
                requester_username: row.requester_username || undefined,
                requesterUsername: row.requester_username || undefined,
                requester_id: row.requester_id || undefined,
                requesterId: row.requester_id || undefined,
                fill_join_admin_username: row.fill_join_admin_username || undefined,
                fillJoinAdminUsername: row.fill_join_admin_username || undefined,
                fill_join_admin_id: row.fill_join_admin_id || undefined,
                fillJoinAdminId: row.fill_join_admin_id || undefined,
                fill_join_status: row.fill_join_status || undefined,
                fillJoinStatus: row.fill_join_status || undefined
            };
        });
    } catch (e) {
        console.error("Erreur lecture messages SQL:", e);
        return [];
    }
}

function writeAllMessagesToJSON(messages) {
    const tx = db.transaction(() => {
        for (const msg of messages) {
            const existing = stmts.getMessage.get(msg.id);
            if (existing) {
                if (msg.fillJoinStatus || msg.fill_join_status) {
                    stmts.updateMessageFillJoinStatus.run(
                        msg.fillJoinStatus || msg.fill_join_status,
                        msg.fillJoinRequestId || msg.fill_join_request_id || msg.id
                    );
                }
                const recipients = Array.isArray(msg.recipients) ? msg.recipients : [];
                const readBy = Array.isArray(msg.readBy) ? msg.readBy : [];
                for (const rid of recipients) {
                    stmts.addRecipient.run(msg.id, String(rid));
                    if (readBy.includes(String(rid))) {
                        stmts.markRead.run(msg.id, String(rid));
                    }
                }
            } else {
                stmts.insertMessage.run({
                    id: msg.id,
                    sender_id: msg.senderId || msg.sender_id || '',
                    subject: msg.subject || '',
                    body: msg.body || '',
                    timestamp: msg.timestamp || new Date().toISOString(),
                    type: msg.type || 'normal',
                    fill_join_request_id: msg.fillJoinRequestId || msg.fill_join_request_id || null,
                    fill_id: msg.fillId || msg.fill_id || null,
                    fill_name: msg.fillName || msg.fill_name || null,
                    requester_username: msg.requesterUsername || msg.requester_username || null,
                    requester_id: msg.requesterId || msg.requester_id || null,
                    fill_join_admin_username: msg.fillJoinAdminUsername || msg.fill_join_admin_username || null,
                    fill_join_admin_id: msg.fillJoinAdminId || msg.fill_join_admin_id || null,
                    fill_join_status: msg.fillJoinStatus || msg.fill_join_status || null
                });
                const recipients = Array.isArray(msg.recipients) ? msg.recipients : [];
                const readBy = Array.isArray(msg.readBy) ? msg.readBy : [];
                for (const rid of recipients) {
                    stmts.addRecipient.run(msg.id, String(rid));
                    if (readBy.includes(String(rid))) {
                        stmts.markRead.run(msg.id, String(rid));
                    }
                }
                const attachments = Array.isArray(msg.attachments) ? msg.attachments : [];
                for (const att of attachments) {
                    stmts.addAttachment.run(msg.id, att.name || '', att.size || 0, att.data || '');
                }
            }
        }
    });
    tx();
}

function sanitizeAttachments(attachments) {
    if (!Array.isArray(attachments)) return [];
    return attachments.map(att => ({ name: att.name, size: att.size, data: att.data })).filter(att => att.name && att.data);
}

// ============================================================
// SAUVETAGES (RESCUES)
// ============================================================
function readRescues() {
    try {
        return stmts.getAllRescues.all().map(r => ({
            id: r.id,
            requesterName: r.requester_name,
            requesterId: r.requester_id,
            subject: r.subject,
            description: r.description,
            status: r.status,
            createdAt: r.created_at,
            resolvedAt: r.resolved_at,
            aiTargets: r.ai_targets,
            aiInstruction: r.ai_instruction,
            rewardPoints: r.reward_points,
            responderName: r.responder_name
        }));
    } catch (e) {
        console.error("Erreur lecture rescues SQL:", e);
        return [];
    }
}

function writeRescues(rescues) {
    const tx = db.transaction(() => {
        for (const r of rescues) {
            const existing = stmts.getRescue.get(r.id);
            if (existing) {
                stmts.updateRescueStatus.run(r.status || 'pending', r.resolvedAt || null, r.responderName || null, r.id);
            } else {
                stmts.insertRescue.run({
                    id: r.id,
                    requester_name: r.requesterName || r.requester_name || '',
                    requester_id: r.requesterId || r.requester_id || '',
                    subject: r.subject || '',
                    description: r.description || '',
                    status: r.status || 'pending',
                    created_at: r.createdAt || r.created_at || new Date().toISOString(),
                    ai_targets: r.aiTargets || r.ai_targets || null,
                    ai_instruction: r.aiInstruction || r.ai_instruction || null,
                    reward_points: r.rewardPoints || r.reward_points || 15
                });
            }
        }
    });
    tx();
}

function readFillJoinRequests() {
    try {
        return stmts.getAllFillJoinRequests.all().map(r => ({
            id: r.id,
            fillId: r.fill_id,
            fillName: r.fill_name,
            requesterUsername: r.requester_username,
            requesterId: r.requester_id,
            adminUsername: r.admin_username,
            adminId: r.admin_id,
            dayKey: r.day_key,
            createdAt: r.created_at,
            status: r.status,
            resolvedAt: r.resolved_at
        }));
    } catch (e) {
        console.error("Erreur lecture fill_join_requests SQL:", e);
        return [];
    }
}

function writeFillJoinRequests(requests) {
    const tx = db.transaction(() => {
        for (const r of requests) {
            const existing = stmts.getFillJoinRequest.get(r.id);
            if (existing) {
                stmts.updateFillJoinRequestStatus.run(r.status || 'pending', r.resolvedAt || null, r.id);
            } else {
                stmts.insertFillJoinRequest.run({
                    id: r.id,
                    fill_id: r.fillId || r.fill_id || '',
                    fill_name: r.fillName || r.fill_name || '',
                    requester_username: r.requesterUsername || r.requester_username || '',
                    requester_id: r.requesterId || r.requester_id || '',
                    admin_username: r.adminUsername || r.admin_username || '',
                    admin_id: r.adminId || r.admin_id || '',
                    day_key: r.dayKey || r.day_key || '',
                    created_at: r.createdAt || r.created_at || new Date().toISOString(),
                    status: r.status || 'pending'
                });
            }
        }
    });
    tx();
}

// ============================================================
// COURS
// ============================================================
const INITIAL_DELETE_TIMER_SECONDS = 5 * 60;
const COURSE_EVAL_WINDOW_MS = 24 * 60 * 60 * 1000;

function readAllCoursesFromJSON() {
    return readAllCourses();
}

function writeAllCoursesToJSON(courses) {
    writeAllCourses(courses);
}

function computeUserCourseStars(username, courses) {
    const uname = safeLower(username);
    if (!uname) return { avg: null, count: 0 };
    const list = Array.isArray(courses) ? courses : readAllCoursesFromJSON();
    let sum = 0, count = 0;
    for (const c of list) {
        if (!c || typeof c !== 'object') continue;
        if (c.supprime === true) continue;
        if (safeLower(c.uploaderName) !== uname) continue;
        const stars = Number(c.stars);
        const votes = Number(c.votes_total || 0);
        if (!Number.isFinite(stars)) continue;
        if (votes <= 0) continue;
        sum += stars;
        count += 1;
    }
    if (count <= 0) return { avg: null, count: 0 };
    return { avg: Math.round((sum / count) * 100) / 100, count };
}

function getCourseEvalStartMs(course) {
    return parseIsoMs(course.evaluationStartAt) ?? parseIsoMs(course.uploadedAt) ?? Date.now();
}

function ensureCourseEvalFields(course) {
    if (!course || typeof course !== 'object') return course;
    if (!course.evaluationStartAt) course.evaluationStartAt = course.uploadedAt || new Date().toISOString();
    if (!course.status) course.status = 'waiting';
    if (!Array.isArray(course.votes_by)) course.votes_by = [];
    if (course.evaluationFinalizedAt === undefined) course.evaluationFinalizedAt = null;
    if (course.uploaderRewardAppliedAt === undefined) course.uploaderRewardAppliedAt = null;
    if (course.uploaderRewardPoints === undefined) course.uploaderRewardPoints = 0;
    return course;
}

function userHasVoted(course, username) {
    if (!username) return false;
    const key = safeLower(username);
    const votes = Array.isArray(course.votes_by) ? course.votes_by : [];
    return votes.some(v => safeLower(v && v.username) === key);
}

function computeMajorityVoteKey(course) {
    const votes = Array.isArray(course.votes_by) ? course.votes_by : [];
    const counts = { good: 0, medium: 0, bad: 0 };
    for (const v of votes) {
        const k = getVoteKeyFromNumeric(Number(v && v.vote));
        if (counts[k] !== undefined) counts[k] += 1;
    }
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const top = entries[0], second = entries[1];
    if (!top || top[1] <= 0) return null;
    if (second && second[1] === top[1]) return null;
    return top[0];
}

function computeStarsFromCourseServer(course) {
    const totalVotes = Number(course.votes_total || 0);
    const scoreSum = Number(course.score_sum || 0);
    if (!totalVotes) return 0;
    const average = scoreSum / totalVotes;
    const mapped = ((average + 1) / 2) * 5;
    const priorStars = 2.5, priorWeight = 4;
    const smoothed = (mapped * totalVotes + priorStars * priorWeight) / (totalVotes + priorWeight);
    return Math.max(0, Math.min(5, Math.round(smoothed * 4) / 4));
}

function getVoteKeyFromNumeric(v) {
    if (v === 1) return 'good';
    if (v === 0.5) return 'medium';
    if (v === -1) return 'bad';
    return 'unknown';
}

function getUploaderRewardPointsForStars(stars) {
    const s = Number(stars || 0);
    if (s < 0.5) return null;
    if (s < 2) return 0;
    if (s < 3) return 5;
    if (s < 3.75) return 8;
    return 15;
}

function finalizeCourseIfNeeded(course, nowMs, addPointsFn) {
    if (!course || course.supprime === true) return false;
    ensureCourseEvalFields(course);
    const startMs = getCourseEvalStartMs(course);
    const age = nowMs - startMs;
    if (course.status === 'waiting' && age >= COURSE_EVAL_WINDOW_MS) {
        if (Number(course.votes_total || 0) <= 0) { course.status = 'suspension'; return true; }
        if (!course.evaluationFinalizedAt) {
            course.stars = computeStarsFromCourseServer(course);
            const reward = getUploaderRewardPointsForStars(course.stars);
            course.evaluationFinalizedAt = new Date(nowMs).toISOString();
            if (reward === null) {
                course.supprime = true;
                course.deletedAt = new Date(nowMs).toISOString();
                return true;
            }
            course.status = 'normal';
            course.uploaderRewardPoints = Number(reward || 0);
            if (!course.uploaderRewardAppliedAt) {
                if (reward > 0 && course.uploaderName && safeLower(course.uploaderName) !== 'anonyme' && typeof addPointsFn === 'function') {
                    try { addPointsFn(course.uploaderName, reward); } catch (e) { console.warn('[COURS] Reward uploader failed:', e.message); }
                }
                course.uploaderRewardAppliedAt = new Date(nowMs).toISOString();
            }
            return true;
        }
        if (course.status !== 'normal') { course.status = 'normal'; return true; }
    }
    return false;
}

function getActiveCoursesForAI() {
    const allCourses = readAllCoursesFromJSON().map(course => {
        if (course.supprime === true) return { ...course, deleteTimer: 0 };
        if (!course.uploadedAt) return { ...course, deleteTimer: INITIAL_DELETE_TIMER_SECONDS };
        const elapsedSeconds = Math.floor((new Date() - new Date(course.uploadedAt)) / 1000);
        return { ...course, deleteTimer: Math.max(0, INITIAL_DELETE_TIMER_SECONDS - elapsedSeconds) };
    });
    return allCourses.filter(c => c.supprime !== true).map(c => ({ id: c.id, title: c.title, subject: c.subject, description: c.description }));
}

function getFilteredActiveCourses() {
    const allCourses = readAllCoursesFromJSON().map(course => {
        if (course.supprime === true) return { ...course, deleteTimer: 0 };
        if (!course.uploadedAt) return { ...course, deleteTimer: INITIAL_DELETE_TIMER_SECONDS };
        const elapsedSeconds = Math.floor((new Date() - new Date(course.uploadedAt)) / 1000);
        return { ...course, deleteTimer: Math.max(0, INITIAL_DELETE_TIMER_SECONDS - elapsedSeconds), score_sum: Number(course.score_sum || 0), votes_total: Number(course.votes_total || 0), stars: Number(course.stars || 0) };
    });
    return allCourses.filter(c => c.supprime !== true).sort((a, b) => Number(b.id) - Number(a.id));
}

function deleteCourseFromJSON(courseId) {
    const idToDelete = Number(courseId);
    const course = stmts.getCourse.get(idToDelete);
    if (course && !course.supprime) {
        stmts.softDeleteCourse.run(new Date().toISOString(), idToDelete);
        return true;
    }
    return false;
}

// ============================================================
// BDD Ã‰VOLUTIVE
// ============================================================
function readEvolvingDB() {
    try {
        const row = stmts.getBddEvolving.get();
        if (!row) return { bdd: "Base de donnée vide", historiques: [] };
        return {
            derniere_maj: row.derniere_maj,
            bdd: row.bdd_text || '',
            historiques: JSON.parse(row.historiques || '[]'),
            nouvelles_infos: JSON.parse(row.nouvelles_infos || '[]')
        };
    } catch (e) {
        return { bdd: "Base de donnée vide (Erreur)", historiques: [] };
    }
}

function getEvolvingDBContent() {
    try {
        const row = stmts.getBddEvolving.get();
        if (!row) return null;
        return JSON.stringify({
            derniere_maj: row.derniere_maj,
            bdd: row.bdd_text || '',
            historiques: JSON.parse(row.historiques || '[]'),
            nouvelles_infos: JSON.parse(row.nouvelles_infos || '[]')
        }, null, 2);
    } catch (e) {
        return null;
    }
}

function updateEvolvingDBWithNewData(username, newJsonText) {
    try {
        const cleanedJsonText = newJsonText.replace(/```json|```/g, '').trim();
        const parsedData = JSON.parse(cleanedJsonText);
        parsedData.derniere_maj = `Date exacte: ${new Date().toLocaleString('fr-FR')}, Utilisateur: ${username}`;
        if (Array.isArray(parsedData.historiques)) {
            parsedData.historiques = parsedData.historiques.map(entry => ({ ...entry, utilisateur: clampText(entry?.utilisateur || '', 220), ia: clampText(entry?.ia || '', 520) })).slice(-40);
        }
        if (Array.isArray(parsedData.nouvelles_infos)) {
            parsedData.nouvelles_infos = parsedData.nouvelles_infos.map(info => clampText(typeof info === 'string' ? info : JSON.stringify(info), 220)).slice(-40);
        }
        stmts.upsertBddEvolving.run({
            derniere_maj: parsedData.derniere_maj,
            bdd_text: parsedData.bdd || '',
            historiques: JSON.stringify(parsedData.historiques || []),
            nouvelles_infos: JSON.stringify(parsedData.nouvelles_infos || [])
        });
        return true;
    } catch (e) {
        console.error("Erreur mise à jour BDD évolutive:", e);
        return false;
    }
}

// ============================================================
// SÃ‰CURITÃ‰ / BANS
// ============================================================
function checkAndApplyBan(user, now) {
    user.warnings = user.warnings.filter(w => w.expiresAt > now);
    const threeDaysAgo = now - (3 * 24 * 60 * 60 * 1000);
    const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
    const warningsLast3Days = user.warnings.filter(w => w.timestamp > threeDaysAgo);
    const warningsLastWeek = user.warnings.filter(w => w.timestamp > oneWeekAgo);
    if (warningsLast3Days.length >= 2 || warningsLastWeek.length >= 3) {
        user.ban_until = now + (48 * 60 * 60 * 1000);
        user.banned = true;
        console.log(`[BAN] ${user.username} banni jusqu'au ${new Date(user.ban_until).toLocaleString()}`);
    }
}

// ============================================================
// INITIALISATION FICHIERS (appelÃ©es au dÃ©marrage depuis server.js)
// ============================================================
function ensureMessagesFile() {
    // No-op: SQLite table already exists
}

function ensureCoursFile() {
    // No-op: SQLite table already exists
}

function ensureRescuesFile() {
    // No-op: SQLite table already exists
}

function ensureFillJoinRequestsFile() {
    // No-op: SQLite table already exists
}

function ensureBddFile() {
    const row = stmts.getBddEvolving.get();
    if (!row) {
        stmts.upsertBddEvolving.run({
            derniere_maj: new Date().toISOString(),
            bdd_text: "Base de donnée évolutive de l'IA.",
            historiques: '[]',
            nouvelles_infos: '[]'
        });
    }
}

function ensureSkinFieldsOnAllUsers() {
    try {
        const rows = stmts.getAllUsers.all();
        for (const row of rows) {
            stmts.addSkin.run(row.username, 'bleu basique');
            stmts.addSkin.run(row.username, 'jaune basique');
            stmts.addFond.run(row.username, 'Vagues');
        }
        console.log('[COSMETICS] Defaults ensured in SQLite');
    } catch (e) {
        console.error('[COSMETICS] Failed to ensure cosmetic fields:', e);
    }
}

// ============================================================
// BADGE AVEC POINTS (via SQLite)
// ============================================================
async function addBadgeWithPoints(username, badgeId, addPointsFn) {
    try {
        const existing = stmts.getBadgesObtained.all(username).map(r => r.badge_id);
        if (existing.includes(badgeId)) return false;
        stmts.addBadgeObtained.run(username, badgeId);
        stmts.addBadgeCurrent.run(username, badgeId);
        stmts.addPoints.run(5, username);
        console.log(`[ECO] +5pts à ${username} pour le badge ${badgeId}`);
        return true;
    } catch (e) {
        console.error('[ECO] Erreur addBadgeWithPoints:', e);
        return false;
    }
}

// ============================================================
// CHALLENGE CONTRIBUTION (via SQLite)
// ============================================================
function contributeToChallenge(username, metric, amount = 1) {
    try {
        const data = stmts.getChallenge.get();
        if (!data) return;
        if (data.metric !== metric) return;
        if (data.current >= data.target) return;
        const newCurrent = Math.min(data.target, data.current + amount);
        let contributors = [];
        try { contributors = JSON.parse(data.contributors || '[]'); } catch { contributors = []; }
        if (!contributors.includes(username)) contributors.push(username);
        stmts.upsertChallenge.run({
            title: data.title || '',
            description: data.description || '',
            metric: data.metric,
            target: data.target,
            current: newCurrent,
            reward: data.reward,
            contributors: JSON.stringify(contributors),
            starts_at: data.starts_at,
            ends_at: data.ends_at,
            rewarded: data.rewarded || 0
        });
    } catch {}
}

module.exports = {
    // Chemins
    ROOT_DIR, PUBLIC_API_DIR, MESSAGES_PATH, RESCUES_PATH, FILL_JOIN_REQUESTS_PATH,
    COURS_FILE_PATH, ALL_PATH, USERS_PATH, BDD_FILE_PATH, MDPED_PATH,
    IMAGES_DIR, UPLOADS_DIR, DATA_DIR,
    // Classe
    CLASS_NAMES,
    // Multer
    uploadCourse, uploadCommunity, uploadProfilePic,
    // Utilitaires basiques
    normalizeUsername, safeLower, parseIsoMs, truthy, clampText,
    stripHtmlToText, extractTitleFromHtml,
    // Utilisateurs
    getUserNameById, getUserIdByName, buildSimulatedUsers, buildAllSummaryFromUsers,
    // Messagerie
    readAllMessagesFromJSON, writeAllMessagesToJSON, sanitizeAttachments,
    // Rescues
    readRescues, writeRescues, readFillJoinRequests, writeFillJoinRequests,
    // Cours
    INITIAL_DELETE_TIMER_SECONDS, COURSE_EVAL_WINDOW_MS,
    readAllCoursesFromJSON, writeAllCoursesToJSON, computeUserCourseStars,
    getCourseEvalStartMs, ensureCourseEvalFields, userHasVoted, computeMajorityVoteKey,
    computeStarsFromCourseServer, getVoteKeyFromNumeric, getUploaderRewardPointsForStars,
    finalizeCourseIfNeeded, getActiveCoursesForAI, getFilteredActiveCourses, deleteCourseFromJSON,
    // BDD
    readEvolvingDB, getEvolvingDBContent, updateEvolvingDBWithNewData,
    // Sécurité
    checkAndApplyBan,
    // Badges
    addBadgeWithPoints,
    // Challenge
    contributeToChallenge,
    // Initialisation (no-ops now, schema created by db.js)
    ensureMessagesFile, ensureCoursFile, ensureRescuesFile, ensureFillJoinRequestsFile,
    ensureBddFile, ensureSkinFieldsOnAllUsers,
    // SQLite access for routes that need direct DB access
    db, stmts, buildUserObject, saveUserFromObject, getUserByName,
    readUsers, writeUsers, addPointsToUser, spendUserPoints, checkUserPoints,
    // fs/path (pour usage dans les routes)
    fs, fsPromises, path
};
