// server.js — Orchestrateur principal (découplé en modules routes/)
'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const dotenv = require('dotenv');
dotenv.config();

const { addPoints } = require('./js/points.js');
const cors = require('cors');

const {
    ensureMessagesFile, ensureCoursFile, ensureRescuesFile,
    ensureFillJoinRequestsFile, ensureBddFile, ensureSkinFieldsOnAllUsers,
    IMAGES_DIR, PUBLIC_API_DIR, UPLOADS_DIR, DATA_DIR,
    readAllCoursesFromJSON, writeAllCoursesToJSON, finalizeCourseIfNeeded,
    readUsers, writeUsers
} = require('./routes/shared');

const app = express();
const port = process.env.PORT || 3000;

// ── Rate Limiter simple (en mémoire) ──
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 600;

function rateLimiter(req, res, next) {
    if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/ed') && !req.path.startsWith('/admin-api')) {
        return next();
    }
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    let entry = rateLimitMap.get(ip);
    if (!entry || now - entry.start > RATE_LIMIT_WINDOW_MS) {
        entry = { start: now, count: 1 };
        rateLimitMap.set(ip, entry);
    } else {
        entry.count++;
    }
    if (entry.count > RATE_LIMIT_MAX) {
        return res.status(429).json({ success: false, message: 'Trop de requ\u00EAtes. R\u00E9essayez dans une minute.' });
    }
    next();
}
setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of rateLimitMap) {
        if (now - entry.start > RATE_LIMIT_WINDOW_MS) rateLimitMap.delete(ip);
    }
}, 5 * 60 * 1000);

// ── Middleware JSON / formulaires ──
app.use(rateLimiter);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ── CORS pour l'Admin API ──
app.use('/admin-api', cors({
    origin: function(origin, callback) {
        if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
            callback(null, true);
        } else {
            callback(new Error('CORS non autoris\u00E9'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

// ── Montage du routeur EcoleDirecte externe ──
const edRouter = require('./API ED/api-web-server');
app.use('/ed', edRouter);

// ── Admin API ──
const adminApiRouter = require('./routes/admin-api');
app.use('/admin-api', adminApiRouter);

// ── Routes communauté (avant static pour que les routes dynamiques priment sur global.json) ──
app.use(require('./routes/community'));

// ── Fichiers statiques ──
const staticOpts = { etag: false, lastModified: false, setHeaders: (res) => { res.setHeader('Cache-Control', 'no-store'); } };
app.use(express.static(path.join(__dirname, 'public'), staticOpts));
app.use('/public', express.static(path.join(__dirname, 'public'), staticOpts));
app.use('/pictures_documents', express.static(path.join(__dirname, 'pictures_documents')));

// ── Création des dossiers nécessaires ──
[IMAGES_DIR, PUBLIC_API_DIR, UPLOADS_DIR, DATA_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ── Initialisation (no-ops - schema handled by db.js) ──
ensureMessagesFile();
ensureCoursFile();
ensureRescuesFile();
ensureFillJoinRequestsFile();
ensureBddFile();
ensureSkinFieldsOnAllUsers();

// ── Routes modulaires ──
app.use(require('./routes/misc'));
app.use(require('./routes/users'));
app.use(require('./routes/messagerie'));
app.use(require('./routes/cours'));
app.use(require('./routes/chat'));
app.use(require('./routes/shop'));
app.use(require('./routes/fiches'));
app.use(require('./routes/cartes-mentales'));
app.use(require('./routes/ed-server'));

// ── Récompense quotidienne : +3pts si cours_stars_avg > 3.5 ──
const DAILY_STAR_REWARD = 3;
const DAILY_STAR_THRESHOLD = 3.5;
const DAILY_STAR_INTERVAL_MS = 1000 * 60 * 60 * 6; // 6h

async function applyDailyStarReward() {
    try {
        const users = readUsers();
        const today = new Date().toISOString().slice(0, 10);
        let changed = false;
        for (const user of users) {
            if (typeof user.course_stars_avg === 'number' && user.course_stars_avg > DAILY_STAR_THRESHOLD) {
                const last = user.last_daily_star_reward ? String(user.last_daily_star_reward).slice(0, 10) : '';
                if (last !== today) {
                    user.pt = (user.pt || 0) + DAILY_STAR_REWARD;
                    user.last_daily_star_reward = new Date().toISOString();
                    changed = true;
                    console.log(`[ECO] +${DAILY_STAR_REWARD}pts \u00E0 ${user.username} (avg \u00E9toiles : ${user.course_stars_avg})`);
                }
            }
        }
        if (changed) writeUsers(users);
    } catch (e) {
        console.error('[ECO] Erreur routine daily star reward:', e);
    }
}

// ── Job périodique : finalisation évaluations cours ──
async function applyCourseAgingAndPersistIfNeeded() {
    try {
        const allCourses = readAllCoursesFromJSON();
        const nowMs = Date.now();
        let changed = false;
        for (const course of allCourses) {
            if (!course || course.supprime === true) continue;
            const didChange = finalizeCourseIfNeeded(course, nowMs, addPoints);
            if (didChange) changed = true;
        }
        if (changed) {
            writeAllCoursesToJSON(allCourses);
            console.log('[COURS] \u00C9valuations mises \u00E0 jour et persist\u00E9es.');
        }
    } catch (e) {
        console.error('[COURS] Erreur applyCourseAgingAndPersistIfNeeded:', e);
    }
}

// Lance les jobs périodiques
setInterval(applyDailyStarReward, DAILY_STAR_INTERVAL_MS);
applyDailyStarReward();
setInterval(applyCourseAgingAndPersistIfNeeded, 2 * 60 * 1000);

// ── Service de vérifications (processus fils) ──
const verificationsProcess = spawn('node', ['verifications.js'], {
    stdio: 'inherit',
    cwd: __dirname
});
console.log('[SERVER] Service de v\u00E9rifications d\u00E9marr\u00E9.');

process.on('exit', () => { try { verificationsProcess.kill(); } catch {} });
process.on('SIGINT', () => { try { verificationsProcess.kill(); } catch {} process.exit(0); });
process.on('uncaughtException', (err) => {
    console.error('[SERVER] uncaughtException:', err);
});
process.on('unhandledRejection', (reason) => {
    console.error('[SERVER] unhandledRejection:', reason);
});

// ── Démarrage du serveur ──
function startServer(preferredPort, attempt = 0) {
    const p = Number(preferredPort) || 3000;
    const server = app.listen(p, () => {
        console.log(`[SERVER] HTTP d\u00E9marr\u00E9 sur http://localhost:${p}`);
    });
    server.on('error', (err) => {
        if (err && err.code === 'EADDRINUSE' && attempt < 5) {
            const next = p + 1;
            console.warn(`[SERVER] Port ${p} d\u00E9j\u00E0 utilis\u00E9, tentative sur ${next}.`);
            try { server.close(); } catch {}
            return startServer(next, attempt + 1);
        }
        console.error('[SERVER] Erreur au bind HTTP:', err);
        process.exit(1);
    });
}

startServer(port, 0);