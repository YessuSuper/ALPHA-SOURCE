// server.js (Version corrigée avec POINTS GÉRÉS PAR all.json - FIN DU SQLITE)
const express = require('express');
const { GoogleGenAI } = require('@google/genai');
const dotenv = require('dotenv');
const path = require('path');
const multer = require('multer');
const fsPromises = require('fs').promises;
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { spawn } = require('child_process');
const { addPoints, checkAndApplyDailyLogin, incrementMessageCount, rewardTopicCreatorForFill, checkPointsForAction, deductPoints, spendPoints, recalculateBadges } = require('./js/points.js');
const EcoleDirecteAPI = require(path.join(__dirname, 'API ED', 'ecoledirecte-api'));
const { Vibrant } = require('node-vibrant/node');
// const { log, logToFile } = require('./logger.js');

// ----------------------------------------
console.log("JS chargé");
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// === Gemini (si clé fournie) ===
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
let ai = null;
if (GEMINI_API_KEY) {
    try {
        ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    } catch (e) {
        console.warn("Impossible d'initialiser GoogleGenAI :", e.message);
    }
}
const model = "gemini-2.5-flash";

// === Chemins et dossiers nécessaires ===
const IMAGES_DIR = path.join(__dirname, 'images');
const PUBLIC_API_DIR = path.join(__dirname, 'public', 'api');
const MESSAGES_PATH = path.join(PUBLIC_API_DIR, 'messagerie/messages.json'); // Reste pour la Messagerie Pro
const USERS_PATH = path.join(PUBLIC_API_DIR, 'users.json');
const RESCUES_PATH = path.join(PUBLIC_API_DIR, 'messagerie/rescues.json');
const FILL_JOIN_REQUESTS_PATH = path.join(PUBLIC_API_DIR, 'community', 'fill_join_requests.json');



// 🚨 CORRIGÉ 🚨 : COURS_PATH est bien ici
const COURS_PATH = path.join(PUBLIC_API_DIR, 'cours.json');

// 🚨 CORRIGÉ 🚨 : ANCIEN USERS_PATH DEVIENT ALL_PATH
const ALL_PATH = path.join(PUBLIC_API_DIR, 'all.json');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
const DATA_DIR = path.join(__dirname, 'data');
const COURS_FILE_PATH = path.join(PUBLIC_API_DIR, 'cours.json');
const BDD_FILE_PATH = path.join(PUBLIC_API_DIR, 'bdd.json');
const MDPED_PATH = path.join(PUBLIC_API_DIR, 'mdped.json');

// Mapping classe pour conversions ID <-> prénom (aligné avec le front)
const CLASS_NAMES = [
    'Even', 'Alexandre', 'Calixte', 'Noé', 'Julia', 'Joan', 'Juliette', 'Jezzy',
    'Inès', 'Timéo', 'Tyméo', 'Clautilde', 'Loanne', 'Lucie', 'Camille', 'Sofia',
    'Lilia', 'Amir', 'Robin', 'Arthur', 'Maxime', 'Gaultier', 'Antoine', 'Louis',
    'Anne-Victoria', 'Léa', 'Sarah', 'Ema', 'Jade', 'Alicia', 'Claire'
];

console.log(`🗿 Le fichier BDD va être créé/lu à l'emplacement exact : ${BDD_FILE_PATH}`);

// === EcoleDirecte (Cartable) session state ===
// IMPORTANT: l'état ED ne doit jamais être global, sinon un utilisateur connecte tout le monde.
// On isole donc ED par compte AlphaSource (clé = username normalisé) avec fallback par IP.
const edStateByUser = new Map(); // key -> { api, lastError }

function getEdUserKeyFromReq(req) {
    try {
        const fromHeader = (req.get && (req.get('x-source-user') || req.get('x-alpha-user'))) || '';
        const fromQuery = (req.query && (req.query.username || req.query.user)) || '';
        const fromBody = (req.body && (req.body.username || req.body.user)) || '';
        const raw = String(fromHeader || fromQuery || fromBody || '').trim();
        const normalized = normalizeUsername(raw).toLowerCase();
        if (normalized) return normalized;
    } catch {}
    // Pas de fallback IP: sinon deux comptes du même navigateur/foyer se partagent la session ED.
    return '';
}

function getEdState(userKey) {
    if (!edStateByUser.has(userKey)) edStateByUser.set(userKey, { api: null, lastError: null });
    return edStateByUser.get(userKey);
}

function clearEdStateForUser(userKey) {
    edStateByUser.delete(userKey);
}

function resetAllEdState() {
    try { edStateByUser.clear(); } catch {}
    try { cahierDeTexteCacheByUser.clear(); } catch {}
}

// Cache cahier de texte (par date) pour accélérer /ed/devoirs
const CAHIER_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cahierDeTexteCacheByUser = new Map(); // key: userKey -> Map(ymd -> { ts:number, data:any })

function getUserCahierCache(userKey) {
    if (!cahierDeTexteCacheByUser.has(userKey)) cahierDeTexteCacheByUser.set(userKey, new Map());
    return cahierDeTexteCacheByUser.get(userKey);
}

function clearUserCahierCache(userKey) {
    try { cahierDeTexteCacheByUser.delete(userKey); } catch {}
}

function getCachedCahierDeTexte(userKey, ymd) {
    const cache = getUserCahierCache(userKey);
    const entry = cache.get(ymd);
    if (!entry) return null;
    if ((Date.now() - entry.ts) > CAHIER_CACHE_TTL_MS) {
        cache.delete(ymd);
        return null;
    }
    return entry.data;
}

function setCachedCahierDeTexte(userKey, ymd, data) {
    const cache = getUserCahierCache(userKey);
    cache.set(ymd, { ts: Date.now(), data });
}

async function mapWithConcurrency(items, limit, mapper) {
    const concurrency = Math.max(1, Math.min(limit || 1, 12));
    const results = new Array(items.length);
    let nextIndex = 0;

    async function worker() {
        while (true) {
            const idx = nextIndex++;
            if (idx >= items.length) return;
            results[idx] = await mapper(items[idx], idx);
        }
    }

    const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
    await Promise.all(workers);
    return results;
}

function toYmd(d) { return d.toISOString().slice(0,10); }
function parseYmdToUtcDate(s) { return new Date(s + 'T00:00:00.000Z'); }
function isYmd(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }
function decodeB64ToUtf8(b64){ try { return Buffer.from(String(b64||''), 'base64').toString('utf-8'); } catch { return ''; } }
function truthy(v){ if (v===true) return true; if(!v) return false; const s=String(v).trim().toLowerCase(); return ['true','1','oui','o','y','yes'].includes(s) || (!!v); }

function stripHtmlToText(html) {
    const s = String(html || '');
    const noTags = s.replace(/<[^>]*>/g, ' ');
    return noTags.replace(/\s+/g, ' ').trim();
}

function extractTitleFromHtml(html) {
    const text = stripHtmlToText(html);
    if (!text) return '';
    // “Titre” = première phrase/ligne courte
    const first = text.split(/\s*\n\s*|\s*\r\s*/).filter(Boolean)[0] || text;
    return first.length > 120 ? first.slice(0, 117) + '...' : first;
}

async function readMdpedConfig() {
    // Backward-compat: ancien format = { username, id, mdp }
    // Nouveau format = { "userkey": { username, id, mdp, accountId? }, ... }
    try {
        const buf = await fsPromises.readFile(MDPED_PATH);
        const parsed = JSON.parse(buf.toString('utf-8'));
        if (parsed && typeof parsed === 'object') {
            // Legacy payload
            if (parsed.id !== undefined && parsed.mdp !== undefined && typeof parsed.id === 'string') {
                const legacyUserKey = normalizeUsername(parsed.username || '').toLowerCase() || '_legacy';
                const store = {};
                store[legacyUserKey] = {
                    username: parsed.username || '',
                    id: parsed.id || '',
                    mdp: parsed.mdp || '',
                    accountId: parsed.accountId || parsed.edAccountId || ''
                };
                return store;
            }
            return parsed;
        }
    } catch {}
    return {};
}

async function ensureEdConnected(userKey) {
    const state = getEdState(userKey);
    if (state.api && state.api.account) return true;

    const store = await readMdpedConfig();
    const cfg = (store && typeof store === 'object') ? store[userKey] : null;
    if (cfg && cfg.id && cfg.mdp) {
        try {
            state.api = new EcoleDirecteAPI(cfg.id, cfg.mdp);
            const account = await state.api.login();
            if (account && account.requireQCM) {
                state.lastError = 'QCM required';
                state.api = null;
                return false;
            }
            state.lastError = null;
            return true;
        } catch (e) {
            state.lastError = e.message;
            state.api = null;
            return false;
        }
    }
    state.lastError = 'Not connected';
    return false;
}

// Ping léger pour éviter d'appeler /ed/notes juste pour tester la session
app.get('/ed/ping', async (req, res) => {
    const userKey = getEdUserKeyFromReq(req);
    if (!userKey) return res.status(401).json({ ok: false, error: 'Not authenticated' });
    const ok = await ensureEdConnected(userKey);
    const state = getEdState(userKey);
    if (!ok) return res.status(401).json({ ok: false, error: state.lastError || 'Not connected' });
    return res.json({ ok: true });
});

// ---------------------------------------------
[IMAGES_DIR, PUBLIC_API_DIR, UPLOADS_DIR, DATA_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Création du dossier manquant : ${dir}`);
    }
});

// Initialisation des fichiers JSON/TXT
function ensureMessagesFile() {
    try {
        if (!fs.existsSync(MESSAGES_PATH)) {
            fs.writeFileSync(MESSAGES_PATH, JSON.stringify([], null, 2), 'utf8');
            return;
        }
        const raw = fs.readFileSync(MESSAGES_PATH, 'utf8').trim();
        if (!raw) {
            fs.writeFileSync(MESSAGES_PATH, JSON.stringify([], null, 2), 'utf8');
            return;
        }
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            let changed = false;
            parsed.forEach(m => {
                if (!m || typeof m !== 'object') return;

                // Par défaut: personne n'a lu (et tous les destinataires sont non lus)
                const recips = Array.isArray(m.recipients) ? m.recipients.map(x => String(x)) : [];

                if (!Array.isArray(m.readBy)) {
                    m.readBy = [];
                    changed = true;
                }
                if (!Array.isArray(m.unreadBy)) {
                    m.unreadBy = recips.slice();
                    changed = true;
                }

                // Nettoyage + unicité
                m.readBy = Array.from(new Set(m.readBy.map(x => String(x))));
                m.unreadBy = Array.from(new Set(m.unreadBy.map(x => String(x))));

                // Option: retire le vieux champ global "status" (inutile et trompeur)
                if (Object.prototype.hasOwnProperty.call(m, 'status')) {
                    delete m.status;
                    changed = true;
                }

                // Si quelqu'un est dans readBy, il ne doit pas être dans unreadBy
                const beforeLen = m.unreadBy.length;
                m.unreadBy = m.unreadBy.filter(id => !m.readBy.includes(id));
                if (m.unreadBy.length !== beforeLen) changed = true;
            });
            if (changed) {
                fs.writeFileSync(MESSAGES_PATH, JSON.stringify(parsed, null, 2), 'utf8');
            }
        }
    } catch (e) {
        console.warn("messages.json invalide, réinitialisation en tableau vide.");
        fs.writeFileSync(MESSAGES_PATH, JSON.stringify([], null, 2), 'utf8');
    }
}
ensureMessagesFile();

function ensureCoursFile() {
    try {
        if (!fs.existsSync(COURS_FILE_PATH)) {
            fs.writeFileSync(COURS_FILE_PATH, JSON.stringify([], null, 2), 'utf8');
            console.log(`Fichier cours.json créé à : ${COURS_FILE_PATH}`);
            return;
        }
        JSON.parse(fs.readFileSync(COURS_FILE_PATH, 'utf8').trim() || '[]');
    } catch (e) {
        console.warn("PUTAIN AVERTISSEMENT : cours.json invalide, réinitialisation en tableau vide.");
        fs.writeFileSync(COURS_FILE_PATH, JSON.stringify([], null, 2), 'utf8');
    }
}
ensureCoursFile();

// Fichier de suivi des sauvetages
function ensureRescuesFile() {
    try {
        const dir = path.dirname(RESCUES_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        if (!fs.existsSync(RESCUES_PATH)) {
            fs.writeFileSync(RESCUES_PATH, JSON.stringify([], null, 2), 'utf8');
            return;
        }
        const raw = fs.readFileSync(RESCUES_PATH, 'utf8').trim();
        if (!raw) {
            fs.writeFileSync(RESCUES_PATH, JSON.stringify([], null, 2), 'utf8');
            return;
        }
        JSON.parse(raw);
    } catch (e) {
        console.warn("rescue.json invalide, réinitialisation.");
        fs.writeFileSync(RESCUES_PATH, JSON.stringify([], null, 2), 'utf8');
    }
}
ensureRescuesFile();

// Fichier de suivi des demandes pour rejoindre un fill (anti-spam)
function ensureFillJoinRequestsFile() {
    try {
        const dir = path.dirname(FILL_JOIN_REQUESTS_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        if (!fs.existsSync(FILL_JOIN_REQUESTS_PATH)) {
            fs.writeFileSync(FILL_JOIN_REQUESTS_PATH, JSON.stringify([], null, 2), 'utf8');
            return;
        }
        const raw = fs.readFileSync(FILL_JOIN_REQUESTS_PATH, 'utf8').trim();
        if (!raw) {
            fs.writeFileSync(FILL_JOIN_REQUESTS_PATH, JSON.stringify([], null, 2), 'utf8');
            return;
        }
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            fs.writeFileSync(FILL_JOIN_REQUESTS_PATH, JSON.stringify([], null, 2), 'utf8');
        }
    } catch (e) {
        console.warn('fill_join_requests.json invalide, réinitialisation.');
        try {
            fs.writeFileSync(FILL_JOIN_REQUESTS_PATH, JSON.stringify([], null, 2), 'utf8');
        } catch {}
    }
}

function readFillJoinRequests() {
    try {
        const raw = fs.readFileSync(FILL_JOIN_REQUESTS_PATH, 'utf8').trim();
        const parsed = JSON.parse(raw || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function writeFillJoinRequests(requests) {
    try {
        fs.writeFileSync(FILL_JOIN_REQUESTS_PATH, JSON.stringify(Array.isArray(requests) ? requests : [], null, 2), 'utf8');
    } catch (e) {
        console.error('Erreur écriture fill_join_requests.json:', e);
    }
}

ensureFillJoinRequestsFile();

function readRescues() {
    try {
        const raw = fs.readFileSync(RESCUES_PATH, 'utf8').trim();
        const parsed = JSON.parse(raw || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        console.error("PUTAIN ERREUR lecture rescues:", e);
        return [];
    }
}

function writeRescues(rescues) {
    try {
        fs.writeFileSync(RESCUES_PATH, JSON.stringify(rescues, null, 2), 'utf8');
    } catch (e) {
        console.error("PUTAIN ERREUR écriture rescues:", e);
    }
}

function getUserNameById(userId) {
    const id = String(userId);
    if (id === '1') return 'Source AI (Bot)';
    if (id === '2') return 'Source Admin';
    const idx = Number(id) - 3;
    if (!Number.isNaN(idx) && idx >= 0 && idx < CLASS_NAMES.length) {
        return CLASS_NAMES[idx];
    }
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
    const base = [
        { id: '1', name: 'Source AI (Bot)' },
        { id: '2', name: 'Source Admin' },
    ];
    const mapped = CLASS_NAMES.map((name, index) => ({ id: String(index + 3), name }));
    return [...base, ...mapped];
}

// Suppression de la gestion de all.json pour les données élèves.
// On ne crée plus ni n'initialise all.json pour les informations utilisateur.

// ============================
// Normalisation des identifiants
// ============================
function normalizeUsername(input) {
    if (typeof input !== 'string') return '';
    // Trim, remove zero-width/invisible spaces, and normalize unicode
    return input
        .trim()
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .normalize('NFKC');
}

// =============================================================
// Skins: ensure default fields on users (active_skin, skins_obtenus)
function ensureSkinFieldsOnAllUsers() {
    try {
        const raw = fs.readFileSync(USERS_PATH, 'utf8') || '[]';
        const users = JSON.parse(raw);
        let changed = false;
        users.forEach(u => {
            if (!u.active_skin) {
                u.active_skin = 'bleu basique';
                changed = true;
            }
            if (!u.skins_obtenus || !Array.isArray(u.skins_obtenus)) {
                u.skins_obtenus = ['bleu basique', 'jaune basique'];
                changed = true;
            } else if (!u.skins_obtenus.includes('bleu basique')) {
                // Ensure base skin exists
                u.skins_obtenus.unshift('bleu basique');
                changed = true;
            } else if (!u.skins_obtenus.includes('jaune basique')) {
                // Ensure free yellow skin exists
                u.skins_obtenus.push('jaune basique');
                changed = true;
            }
            // Migrate any legacy field shop_purchases -> skins_obtenus
            if (u.shop_purchases) {
                // Try to extract names from legacy items, else keep only base
                const legacyNames = Array.isArray(u.shop_purchases)
                    ? u.shop_purchases.map(it => (it && (it.name || it.itemId)) || null).filter(Boolean)
                    : [];
                u.skins_obtenus = Array.from(new Set(['bleu basique', 'jaune basique', ...legacyNames]));
                delete u.shop_purchases;
                changed = true;
            }
        });
        if (changed) {
            fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2), 'utf8');
            console.log('[SKINS] Defaults ensured and legacy migrated in users.json');
        }
    } catch (e) {
        console.error('[SKINS] Failed to ensure skin fields:', e);
    }
}

// Ensure on startup
ensureSkinFieldsOnAllUsers();

// =================================================================
// GESTION DE LA BDD ÉVOLUTIVE (bdd.json en TEXTE UNIQUE)
// ... (Fonctions inchangées) ...
function ensureBddFile() {
    try {
        const dir = path.dirname(BDD_FILE_PATH); // Récupère le dossier cible

        // 🚨 CRITIQUE : Crée le dossier (/public/api) s'il n'existe pas !
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`Dossier BDD créé : ${dir}`);
        }
        
        // Lire le contenu du fichier s'il existe
        let rawContent = '';
        if (fs.existsSync(BDD_FILE_PATH)) {
            rawContent = fs.readFileSync(BDD_FILE_PATH, 'utf8').trim();
        }

        let shouldInitialize = !fs.existsSync(BDD_FILE_PATH) || rawContent === '';
        
        // Vérifie si le contenu est l'ancienne structure vide (celle que tu m'as montrée)
        if (!shouldInitialize && rawContent) {
            try {
                const currentData = JSON.parse(rawContent);
                if (currentData.bdd === "Base de donnée vide" && currentData.historiques.length === 0) {
                    shouldInitialize = true; // Écraser l'ancienne structure vide
                }
            } catch (e) {
                // Fichier corrompu, on doit l'écraser
                shouldInitialize = true;
                console.warn("PUTAIN AVERTISSEMENT : bdd.json corrompu, réinitialisation forcée.", e);
            }
        }

        if (shouldInitialize) {
            const initialData = {
                derniere_maj: `Date exacte: Dimanche 14 décembre 2025 à 16:53:15`,
                historiques: [],
                nouvelles_infos: [],
                bdd: "Base de donnée évolutive de l'IA. Prête à enregistrer les infos dans le répertoire cible."
            };
            fs.writeFileSync(BDD_FILE_PATH, JSON.stringify(initialData, null, 2), 'utf8');
            console.log(`BDD OK : Fichier bdd.json créé/réinitialisé dans ${dir}.`);
        } else {
             // Si le fichier n'a pas été écrasé, on vérifie juste qu'il est parsable pour le catch
             JSON.parse(rawContent); 
        }

    } catch (e) {
        // Cette erreur attrape les cas où le JSON était corrompu et non pris par le catch interne
        console.error("PUTAIN ERREUR FATALE dans ensureBddFile :", e);
        // On réinitialise quand même en cas d'erreur fatale
        const initialData = {
             derniere_maj: `Date exacte: Dimanche 14 décembre 2025 à 16:53:15 (Réinitialisation d'urgence)`,
             historiques: [],
             nouvelles_infos: [],
             bdd: "Base de donnée réinitialisée suite à une erreur de parsing."
         };
         fs.writeFileSync(BDD_FILE_PATH, JSON.stringify(initialData, null, 2), 'utf8');
    }
}
ensureBddFile();

// =================================================================
// 🔥 FONCTION DE SYNCHRONISATION DES POINTS 🔥
// =================================================================

// Construit l'objet de synthèse (user_ranking, collective_data) à partir de users.json
function buildAllSummaryFromUsers() {
    try {
        const usersRaw = fs.readFileSync(USERS_PATH, 'utf8') || '[]';
        const usersData = JSON.parse(usersRaw);

        const userRanking = usersData.map(user => ({
            username: user.username,
            points: user.pt || 0,
            connexions: user.connexions || 0,
            last_connexion: user.last_connexion || null,
            active: user.active || false
        }));

        const collectivePoints = usersData.reduce((sum, user) => sum + (user.pt || 0), 0);

        return {
            user_ranking: userRanking,
            collective_data: {
                collective_points_pc: collectivePoints,
                last_updated: new Date().toISOString()
            }
        };
    } catch (e) {
        console.error("Erreur buildAllSummaryFromUsers :", e);
        return { user_ranking: [], collective_data: { collective_points_pc: 0, last_updated: new Date().toISOString() } };
    }
}

// =================================================================
// 🔥 GESTION DE LA MESSAGERIE DANS messages.json 🔥
// =================================================================

/**
 * Lit et parse tous les messages du fichier messages.json.
 * @returns {Array<Object>} Le tableau des messages.
 */
function readAllMessagesFromJSON() {
    try {
        const rawData = fs.readFileSync(MESSAGES_PATH, 'utf8').trim();
        const messages = JSON.parse(rawData || '[]');
        return Array.isArray(messages) ? messages : [];
    } catch (e) {
        console.error("PUTAIN ERREUR FATALE : Problème lors de la lecture/parsing de messages.json:", e);
        return [];
    }
}



/**
 * Sauvegarde le tableau de messages dans messages.json.
 * @param {Array<Object>} messages
 */
function writeAllMessagesToJSON(messages) {
    try {
        fs.writeFileSync(MESSAGES_PATH, JSON.stringify(messages, null, 2), 'utf8');
    } catch (e) {
        console.error("PUTAIN ÉCHEC : Problème lors de l'écriture dans messages.json:", e);
    }
}

/**
 * Route POST /api/messagerie/send : Gère l'envoi d'un nouveau message.
 */
function handleMessageSave(req, res) {
    const { senderId, recipientIds, subject, body, isAnonymous, attachments } = req.body;

    let missingField = null;
    if (!senderId) {
        missingField = 'senderId';
    } else if (!recipientIds || !Array.isArray(recipientIds) || recipientIds.length === 0) {
        missingField = 'recipientIds';
    } else if (!subject || subject.trim().length === 0) {
        missingField = 'subject';
    } else if (!body || body.trim().length === 0) {
        missingField = 'body';
    }

    if (missingField) {
        console.error(`PUTAIN LOG (BACKEND) : Champ manquant : ${missingField}`);
        return res.status(400).json({
            success: false,
            message: `Putain, le champ '${missingField}' est manquant ou vide.`,
            missingField
        });
    }

    // Vérifier points pour message anonyme
    if (isAnonymous && !checkPointsForAction(senderId, 3)) {
        return res.status(400).json({
            success: false,
            message: "Pas assez de points pour envoyer un message anonyme (-3 points requis)."
        });
    }

    // 🔒 Sécurisation des pièces jointes (Base64)
    let safeAttachments = [];
    if (Array.isArray(attachments)) {
        safeAttachments = attachments.map(att => ({
            name: att.name,
            size: att.size,
            data: att.data
        }));
    }

    const finalSenderId = isAnonymous ? "anon" : senderId;
    const finalSubject = isAnonymous ? `[ANONYME] ${subject}` : subject;

    const newMessage = {
        id: 'm' + Date.now(),
        senderId: finalSenderId,
        recipients: recipientIds,
        subject: finalSubject,
        body: body,
        timestamp: new Date().toISOString(),
        attachments: safeAttachments,
        readBy: [],
        unreadBy: recipientIds.map(x => String(x))
    };

    try {
        const existingMessages = readAllMessagesFromJSON();
        existingMessages.push(newMessage);
        writeAllMessagesToJSON(existingMessages);

        // Déduire points pour anonyme
        if (isAnonymous) {
            deductPoints(senderId, 3);
        }

        console.log(
            `[MESSAGERIE] Message stocké (ID: ${newMessage.id}, PJ: ${safeAttachments.length}, Anonyme: ${isAnonymous})`
        );

        return res.status(200).json({
            success: true,
            message: "Message enregistré.",
            messageId: newMessage.id
        });

    } catch (error) {
        console.error("PUTAIN LOG (BACKEND) : Erreur de sauvegarde JSON Messagerie:", error);
        return res.status(500).json({
            success: false,
            message: "Erreur serveur lors de l'enregistrement du message."
        });
    }
}

/**
 * Route GET /api/messagerie/messages : Lit les messages de l'utilisateur courant (ID '2' pour 'User Sigma' / 'Moi').
 */
function handleMessagesRead(req, res) {
    // 🚨 CORRECTION : Récupérer l'ID de l'utilisateur courant depuis l'URL (ex: /messages?userId=5)
    // Sinon, on garde '2' par défaut pour ne pas tout casser si le paramètre est absent.
    const CURRENT_USER_ID = req.query.userId || '2'; 
    const USERS_DATA_SIMULATED = buildSimulatedUsers();
    const rescues = readRescues();
    
    try {
        const allMessages = readAllMessagesFromJSON();
        
        // 🚨 ATTENTION : Utilise .toString() pour les comparaisons sécurisées (les IDs JSON sont des chaînes)
        const filteredMessages = allMessages.filter(msg => {
            // Est l'expéditeur du message
            if (msg.senderId.toString() === CURRENT_USER_ID.toString()) {
                return true;
            }
            // Est un des destinataires du message
            if (Array.isArray(msg.recipients) && msg.recipients.includes(CURRENT_USER_ID.toString())) {
                return true;
            }
            // Cas spécial : si le message est anonyme et qu'on veut le lier à un user précis, 
            // c'est compliqué, on va donc garder le comportement par défaut (pour l'instant).
            
            return false;
        });
        
        const finalMessages = filteredMessages.map(msg => {
            const senderInfo = USERS_DATA_SIMULATED.find(u => u.id === String(msg.senderId));
            const shouldMask = Array.isArray(msg.maskSenderFor) && msg.maskSenderFor.includes(String(CURRENT_USER_ID));
            let senderName = senderInfo ? senderInfo.name : (msg.senderId === 'anon' ? 'Anonyme' : 'Inconnu');
            if (shouldMask) senderName = 'Anonyme';
            
            // Mappe les IDs des destinataires vers leurs noms
            const recipientIds = Array.isArray(msg.recipients) ? msg.recipients.map(id => String(id)) : [];
            const recipientNames = recipientIds.map(id => {
                const recipientInfo = USERS_DATA_SIMULATED.find(u => u.id === String(id));
                return recipientInfo ? recipientInfo.name : id;
            });

            const readByIds = Array.isArray(msg.readBy) ? msg.readBy.map(x => String(x)) : [];
            const unreadByIds = Array.isArray(msg.unreadBy) ? msg.unreadBy.map(x => String(x)) : recipientIds;

            // Champs "lus par" / "non lus" basés sur les destinataires uniquement
            const lusParIds = recipientIds.filter(id => readByIds.includes(id));
            const nonLusIds = recipientIds.filter(id => unreadByIds.includes(id));
            const lusPar = lusParIds.map(id => {
                const u = USERS_DATA_SIMULATED.find(x => x.id === id);
                return u ? u.name : id;
            });
            const nonLus = nonLusIds.map(id => {
                const u = USERS_DATA_SIMULATED.find(x => x.id === id);
                return u ? u.name : id;
            });

            // Non lu pour l'utilisateur courant = destinataire et dans unreadBy
            const unreadForCurrent = recipientIds.includes(String(CURRENT_USER_ID)) && unreadByIds.includes(String(CURRENT_USER_ID));

            const rescueInfo = msg.rescueId ? rescues.find(r => r.rescueId === msg.rescueId) : null;
            
            return {
                ...msg,
                senderName: senderName,
                recipients: recipientNames, // Retourne les noms des destinataires
                date: new Date(msg.timestamp).toLocaleDateString('fr-FR', { month: '2-digit', day: '2-digit' }),
                unread: unreadForCurrent,
                lusPar,
                nonLus,
                lusParIds,
                nonLusIds,
                readByIds,
                unreadByIds,
                rescueStatus: rescueInfo ? rescueInfo.status : null,
                rescueWinningSenderId: rescueInfo ? rescueInfo.winningSenderId : null,
                rescueWinningMessageId: rescueInfo ? rescueInfo.winningMessageId : null
            };
        }).sort((a, b) => b.id.localeCompare(a.id));
        
        console.log(`[MESSAGERIE] ${finalMessages.length} messages envoyés à l'utilisateur ID '${CURRENT_USER_ID}'.`);
        return res.status(200).json(finalMessages);
        
    } catch (error) {
        console.error("PUTAIN LOG (BACKEND) : Erreur de lecture JSON Messagerie:", error);
        return res.status(500).json({ success: false, message: "Erreur serveur lors de la lecture des messages." });
    }
}

// POST /api/messagerie/mark-read { userId, messageId }
app.post('/api/messagerie/mark-read', express.json(), (req, res) => {
    try {
        const userId = req.body && req.body.userId ? String(req.body.userId) : '';
        const messageId = req.body && req.body.messageId ? String(req.body.messageId) : '';
        if (!userId || !messageId) {
            return res.status(400).json({ success: false, message: 'userId et messageId requis.' });
        }

        const all = readAllMessagesFromJSON();
        const idx = all.findIndex(m => m && String(m.id) === messageId);
        if (idx === -1) {
            return res.status(404).json({ success: false, message: 'Message introuvable.' });
        }

        const msg = all[idx];
        if (!Array.isArray(msg.readBy)) msg.readBy = [];
        if (!Array.isArray(msg.unreadBy)) {
            const recips = Array.isArray(msg.recipients) ? msg.recipients.map(x => String(x)) : [];
            msg.unreadBy = recips;
        }

        const readBySet = new Set(msg.readBy.map(String));
        const unreadBySet = new Set(msg.unreadBy.map(String));

        // On ne marque lu que si l'utilisateur est concerné
        const recipientIds = Array.isArray(msg.recipients) ? msg.recipients.map(x => String(x)) : [];
        if (!recipientIds.includes(userId)) {
            return res.json({ success: true, messageId, userId, readBy: Array.from(readBySet), unreadBy: Array.from(unreadBySet) });
        }

        unreadBySet.delete(userId);
        readBySet.add(userId);

        msg.readBy = Array.from(readBySet);
        msg.unreadBy = Array.from(unreadBySet);

        writeAllMessagesToJSON(all);

        return res.json({ success: true, messageId, userId, readBy: msg.readBy, unreadBy: msg.unreadBy });
    } catch (e) {
        console.error('[MESSAGERIE] mark-read error:', e);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

function sanitizeAttachments(attachments) {
    if (!Array.isArray(attachments)) return [];
    return attachments.map(att => ({
        name: att.name,
        size: att.size,
        data: att.data
    })).filter(att => att.name && att.data);
}

function parseRescueTargets(aiText) {
    if (!aiText) return { names: [], instruction: '' };
    const cleaned = aiText.replace(/\n/g, ' ').trim();
    const [left, right] = cleaned.split(':');
    const names = (left || '')
        .split('/')
        .map(n => n.trim())
        .filter(Boolean);
    return { names, instruction: (right || '').trim() };
}

async function generateRescueTargets(promptPayload) {
    if (!ai) return { names: [], instruction: '', raw: '' };
    const { studentMessage, requesterName, classContext } = promptPayload;
    const prompt = `Tu es Source AI et tu dois router un 'Sauvetage'.\n` +
        `Message reçu (cours manquant ou raté) : "${studentMessage}".\n` +
        `Demandeur : ${requesterName}.\n` +
        `Dans la base ci-dessous (all.json) tu trouveras le caractère des élèves.\n` +
        `Réponds en UNE LIGNE strictement au format suivant :\n` +
        `prenom1/prenom2/prenom3/...:Phrase ultra courte qui décrit quoi envoyer et rappelle la récompense de 15 points.\n` +
        `Règles : 1) Les prénoms doivent appartenir à la classe et être séparés par '/'. 2) Ne mentionne jamais le nom du demandeur. 3) Maximum 8 prénoms, triés du plus probable au moins probable. 4) Pas d'autres phrases, pas de listes.\n` +
        `all.json (extrait) :\n${classContext}`;

    try {
        const result = await ai.models.generateContent({
            model,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.35, maxOutputTokens: 220 }
        });
        const raw = (result.text || '').trim();
        const parsed = parseRescueTargets(raw);
        return { ...parsed, raw };
    } catch (e) {
        console.error('[RESCUE] Échec appel Gemini:', e.message);
        return { names: [], instruction: '', raw: '' };
    }
}


// =================================================================
// 🔥 GESTION DE LA BDD ÉVOLUTIVE 🔥
// =================================================================

/**
 * Ajoute une interaction dans la BDD évolutive.
 * @param {string} username - Nom de l'utilisateur
 * @param {string} userMessage - Message envoyé par l'utilisateur
 * @param {string} aiResponse - Réponse de l'IA
 * @returns {boolean} true si succès, false sinon
 */

/**
 * Lit la BDD évolutive complète
 * @returns {Object} { bdd: string, historiques: Array }
 */
function readEvolvingDB() {
    try {
        if (!fs.existsSync(BDD_FILE_PATH)) return { bdd: "Base de donnée vide", historiques: [] };
        const rawData = fs.readFileSync(BDD_FILE_PATH, 'utf8');
        const data = rawData.trim() ? JSON.parse(rawData) : { bdd: "Base de donnée vide", historiques: [] };
        return data;
    } catch (e) {
        console.error("Erreur readEvolvingDB :", e);
        return { bdd: "Base de donnée vide (Erreur de lecture)", historiques: [] };
    }
}

// =================================================================
// ROUTE GET pour récupérer la BDD évolutive
// =================================================================
app.get('/public/api/bdd.json', (req, res) => {
    try {
        const data = readEvolvingDB();
        res.json(data);
    } catch (e) {
        console.error("Erreur GET /api/bdd :", e);
        res.status(500).json({ success: false, message: "Erreur serveur lors de la lecture de la BDD" });
    }
});

// --- GET : Récupérer all.json (avec user_ranking et collective_data synchronisés)
app.get('/api/all.json', (req, res) => {
    try {
        // Lire all.json pour les données non liées aux élèves (ex: weekly_schedule), si présent
        let otherData = {};
        try {
            if (fs.existsSync(ALL_PATH)) {
                const allRaw = fs.readFileSync(ALL_PATH, 'utf8') || '{}';
                const parsed = JSON.parse(allRaw);
                // Retirer les champs liés aux élèves s'ils existent
                delete parsed.user_ranking;
                delete parsed.collective_data;
                otherData = parsed;
            }
        } catch (e) {
            console.warn("Lecture partielle de all.json échouée, on continue avec users.json seulement.");
        }

        // Construire le résumé depuis users.json
        const summary = buildAllSummaryFromUsers();

        // Fusionner et renvoyer
        res.json({ ...otherData, ...summary });
    } catch (e) {
        console.error("Erreur GET /api/all.json :", e);
        res.status(500).json({ success: false, message: "Erreur serveur lors de la construction des données" });
    }
});

// --- GET : Récupérer users.json (pour le graphique des points)
app.get('/api/users.json', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(USERS_PATH, 'utf8'));
        res.json(data);
    } catch (e) {
        console.error("Erreur GET /api/users.json :", e);
        res.status(500).json({ success: false, message: "Erreur serveur lors de la lecture de users.json" });
    }
});


// =================================================================
// --------------------------------------------------------------------------------------------------
// 🚨 NOUVELLE FONCTION : AJOUT DE POINT DIRECTEMENT DANS ALL.JSON 🚨
// --------------------------------------------------------------------------------------------------
/*function addPointToAllJSON(username) {
    if (!username) return 0;

    ensureAllFile();

    let fileContent = {};
    let usersArray = []; // C'est ici qu'on va stocker le tableau des utilisateurs à modifier

    try {
        const rawData = fs.readFileSync(ALL_PATH, 'utf8') || '[]';
        const parsedData = JSON.parse(rawData);

        // 🚨 Logique de vérification de la structure du fichier all.json
        if (Array.isArray(parsedData)) {
            // Cas 1 : Le fichier est un simple tableau d'utilisateurs (comme la fonction ensureAllFile le crée)
            fileContent = parsedData; // Pour l'écriture, on utilisera directement le tableau
            usersArray = parsedData;
        } else if (typeof parsedData === 'object' && parsedData !== null) {
            // Cas 2 : Le fichier est un objet complexe (avec user_ranking, profs, edt, etc.)
            fileContent = parsedData;
            // On s'assure que 'user_ranking' est un tableau, ou on le crée
            if (!Array.isArray(fileContent.user_ranking)) {
                fileContent.user_ranking = [];
            }
            usersArray = fileContent.user_ranking;
        }
        
    } catch {
        // Si le parsing échoue, on réinitialise à un tableau vide
        usersArray = [];
        fileContent = usersArray;
    }

    // 2. Chercher ou créer l'utilisateur
    let user = usersArray.find(u => u.username === username);
    if (!user) {
        user = { username, points: 0 };
        usersArray.push(user);
    }

    // 3. Ajouter le point
    user.points += 1;

    // 4. Écrire le contenu complet (fileContent)
    // Si fileContent est l'objet complet (Cas 2), il inclut maintenant le usersArray mis à jour.
    // Si fileContent est le usersArray (Cas 1), on écrira juste le tableau.
    fs.writeFileSync(ALL_PATH, JSON.stringify(fileContent, null, 2), 'utf8'); 
    
    return user.points;
}
    */

// =================================================================
// 🔥 GESTION DES COURS DANS COURS.JSON 🔥
// ... (Fonctions inchangées) ...
const INITIAL_DELETE_TIMER_SECONDS = 5 * 60;

function readAllCoursesFromJSON() {
    ensureCoursFile();
    try {
        const rawData = fs.readFileSync(COURS_FILE_PATH, 'utf8').trim();
        const courses = JSON.parse(rawData || '[]');
        return Array.isArray(courses) ? courses : [];
    } catch (e) {
        console.error("PUTAIN ERREUR FATALE : Problème lors de la lecture/parsing de cours.json:", e);
        return [];
    }
}

function writeAllCoursesToJSON(courses) {
    try {
        fs.writeFileSync(COURS_FILE_PATH, JSON.stringify(courses, null, 2), 'utf8');
    } catch (e) {
        console.error("PUTAIN ÉCHEC : Problème lors de l'écriture dans cours.json:", e);
    }
}

function getActiveCoursesForAI() {
    let allCourses = readAllCoursesFromJSON();
    const coursesWithUpdatedTimer = allCourses.map(course => {
        if (course.supprime === true) return { ...course, deleteTimer: 0 };
        if (!course.uploadedAt) return { ...course, deleteTimer: INITIAL_DELETE_TIMER_SECONDS };
        const uploadedDate = new Date(course.uploadedAt);
        const now = new Date();
        const elapsedTimeSeconds = Math.floor((now - uploadedDate) / 1000);
        let remainingTime = Math.max(0, INITIAL_DELETE_TIMER_SECONDS - elapsedTimeSeconds);
        return { ...course, deleteTimer: remainingTime };
    });
    allCourses = coursesWithUpdatedTimer;
    const activeCourses = allCourses.filter(course => course.supprime !== true);
    return activeCourses.map(c => ({ id: c.id, title: c.title, subject: c.subject, description: c.description }));
}

function getFilteredActiveCourses() {
    let allCourses = readAllCoursesFromJSON();
    const coursesWithUpdatedTimer = allCourses.map(course => {
        if (course.supprime === true) return { ...course, deleteTimer: 0 };
        if (!course.uploadedAt) return { ...course, deleteTimer: INITIAL_DELETE_TIMER_SECONDS };
        const uploadedDate = new Date(course.uploadedAt);
        const now = new Date();
        const elapsedTimeSeconds = Math.floor((now - uploadedDate) / 1000);
        let remainingTime = Math.max(0, INITIAL_DELETE_TIMER_SECONDS - elapsedTimeSeconds);
        return { ...course, deleteTimer: remainingTime };
    });
    allCourses = coursesWithUpdatedTimer;
    const activeCourses = allCourses.filter(course => course.supprime !== true);
    activeCourses.sort((a, b) => Number(b.id) - Number(a.id));
    return activeCourses;
}

function deleteCourseFromJSON(courseId) {
    const allCourses = readAllCoursesFromJSON();
    let courseFoundAndDeleted = false;
    const idToDelete = Number(courseId);
    const updatedCourses = allCourses.map(course => {
        if (Number(course.id) === idToDelete && course.supprime !== true) {
            courseFoundAndDeleted = true;
            console.log(`PUTAIN, suppression LOGIQUE appliquée pour le cours ID ${courseId}.`);
            return { ...course, supprime: true, deletedAt: new Date().toISOString() };
        }
        return course;
    });
    if (courseFoundAndDeleted) {
        writeAllCoursesToJSON(updatedCourses);
    }
    return courseFoundAndDeleted;
}

// =================================================================
// 🛑 SUPPRESSION DU CODE SQLITE ET DES FONCTIONS ASSOCIÉES 🛑
// =================================================================

// =================================================================
// MULTER ET MIDDLEWARES
// ... (Code inchangé) ...
// =================================================================
const courseStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + '-' + uniqueSuffix + '-' + file.originalname);
    }
});
const uploadCourse = multer({ storage: courseStorage });

const communityStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const communityDir = path.join(__dirname, 'pictures_documents');
        if (!fs.existsSync(communityDir)) {
            fs.mkdirSync(communityDir, { recursive: true });
        }
        cb(null, communityDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, 'community-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const uploadCommunity = multer({ storage: communityStorage });

const profilePicStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const ppDir = path.join(__dirname, 'public', 'api', 'community', 'ressources', 'pp');
        if (!fs.existsSync(ppDir)) {
            fs.mkdirSync(ppDir, { recursive: true });
        }
        cb(null, ppDir);
    },
    filename: (req, file, cb) => {
        const username = req.body.username || 'unknown';
        const timestamp = Date.now();
        const ext = path.extname(file.originalname);
        cb(null, `${username}_${timestamp}${ext}`);
    }
});
const uploadProfilePic = multer({ storage: profilePicStorage });

// === Middlewares ===
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true }));
app.use('/images', express.static(IMAGES_DIR));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/pictures_documents', express.static(path.join(__dirname, 'pictures_documents')));
app.use('/api/community/ressources/pp', express.static(path.join(__dirname, 'public', 'api', 'community', 'ressources', 'pp')));
app.use(express.static(path.join(__dirname, 'public')));

// === Fonction de sauvegarde des données utilisateur ===
async function saveUserData(account, api) {
    if (!api) return;

    try {
        console.log(`💾 Sauvegarde des données détaillées pour ${account.prenom} ${account.nom}...`);
        
        // 1. Notes
        let notesData = null;
        try {
            notesData = await api.getNotes('');
        } catch (e) {
            console.error('Erreur sauvegarde notes:', e.message);
        }

        // 2. Emploi du temps (Next 14 days)
        let edtData = null;
        try {
            const start = new Date();
            const end = new Date();
            end.setDate(end.getDate() + 14);
            
            const fmt = d => d.toISOString().split('T')[0];
            edtData = await api.getEmploiDuTemps(fmt(start), fmt(end));
        } catch (e) {
             console.error('Erreur sauvegarde EDT:', e.message);
        }

        // 3. Devoirs (Global + enrichissement détaillé si vide)
        let homeworkData = [];
        try {
            // Utilisation de la nouvelle méthode globale
            const globalWork = await api.getTravailAFaire();
            const missingContentDates = new Set();
            
            // globalWork est un objet { "YYYY-MM-DD": [ ... ] }
            if (globalWork && typeof globalWork === 'object') {
                for (const [date, items] of Object.entries(globalWork)) {
                    if (Array.isArray(items)) {
                        for (const item of items) {
                            if (item.aFaire !== undefined && item.aFaire !== null) {
                                const isObject = typeof item.aFaire === 'object';
                                const hasContent = isObject && item.aFaire.contenu;
                                const decodedContent = hasContent ? decodeB64ToUtf8(item.aFaire.contenu) : '';
                                const effectueFlag = (typeof item.effectue === 'boolean') ? item.effectue : (isObject && item.aFaire.effectue === true);

                                // Flag pour enrichir plus tard si contenu vide ou booléen
                                if (!hasContent) missingContentDates.add(date);

                                homeworkData.push({
                                    date: date,
                                    idDevoir: item.idDevoir,
                                    matiere: item.matiere || item.codeMatiere || 'Matière inconnue',
                                    aFaire: {
                                        effectue: !!effectueFlag,
                                        contenu: hasContent ? item.aFaire.contenu : undefined,
                                        contenuDecoded: decodedContent || '[Aucun détail fourni]',
                                        donneLe: item.donneLe || undefined
                                    },
                                    interrogation: item.interrogation || false
                                });
                            }
                        }
                    }
                }
            }

            // Enrichissement: si certains devoirs n'ont pas de contenu, on va chercher le détail de la journée concernée
            if (missingContentDates.size > 0) {
                const datesToFetch = Array.from(missingContentDates).slice(0, 10); // sécurité
                for (const ymd of datesToFetch) {
                    try {
                        const detailedDay = await api.getCahierDeTexte(ymd);
                        const matieres = (detailedDay && Array.isArray(detailedDay.matieres)) ? detailedDay.matieres : [];
                        for (const m of matieres) {
                            const af = m && m.aFaire ? m.aFaire : null;
                            if (!af) continue;
                            const decoded = decodeB64ToUtf8(af.contenu);
                            // Match par idDevoir si présent, sinon par matière/date
                            const candidate = homeworkData.find(h => h.date === ymd && ((h.idDevoir && af.idDevoir && h.idDevoir === af.idDevoir) || (!h.idDevoir && h.matiere === (m.matiere || h.matiere))));
                            if (candidate) {
                                candidate.aFaire.contenu = af.contenu || candidate.aFaire.contenu;
                                candidate.aFaire.contenuDecoded = decoded || candidate.aFaire.contenuDecoded;
                                candidate.aFaire.effectue = (typeof af.effectue === 'boolean') ? af.effectue : candidate.aFaire.effectue;
                            }
                        }
                    } catch (enrichErr) {
                        console.warn('Enrichissement devoirs échoué pour', ymd, enrichErr.message);
                    }
                }
            }
            
            // Tri par date
            homeworkData.sort((a, b) => a.date.localeCompare(b.date));
            
        } catch (e) {
             console.error('Erreur sauvegarde Devoirs (Global):', e.message);
             // Fallback: Si l'endpoint global échoue, on garde l'ancienne méthode (mais réduite à 7 jours pour pas bloquer)
             try {
                 console.log('⚠️ Fallback sur la méthode itérative (7 jours)...');
                 const start = new Date();
                 const days = 7;
                 const dates = Array.from({length:days}, (_,i)=> {
                     const d = new Date(start);
                     d.setDate(d.getDate() + i);
                     return d.toISOString().split('T')[0];
                 });
                 
                 const cahiers = await mapWithConcurrency(dates, 4, async (ymd) => {
                    try {
                        const data = await api.getCahierDeTexte(ymd);
                        return { ymd, data };
                    } catch (e) {
                        return { ymd, data: null };
                    }
                });
                
                for (const entry of cahiers) {
                    if(entry.data && entry.data.matieres) {
                         for (const m of entry.data.matieres) {
                            if (m.aFaire) {
                                const decodedContent = decodeB64ToUtf8(m.aFaire.contenu);
                                homeworkData.push({
                                    date: entry.ymd,
                                    matiere: m.matiere,
                                    aFaire: {
                                        ...m.aFaire,
                                        contenuDecoded: decodedContent
                                    }
                                });
                            }
                         }
                    }
                }
             } catch (e2) {
                 console.error('Erreur sauvegarde Devoirs (Fallback):', e2.message);
             }
        }

        // 4. Construct Data
        const userData = {
            lastUpdated: new Date().toISOString(),
            account: {
                id: account.id,
                nom: account.nom,
                prenom: account.prenom,
                classe: account.profile?.classe?.libelle || account.classe?.libelle || account.classe
            },
            notes: notesData,
            edt: edtData,
            devoirs: homeworkData
        };

        // 5. Read/Write File
        const filePath = path.join(PUBLIC_API_DIR, 'users_detailed_data.json');
        let allData = {};
        try {
            const content = await fsPromises.readFile(filePath, 'utf8');
            allData = JSON.parse(content);
        } catch (e) {
            allData = {};
        }

        allData[account.id] = userData;

        await fsPromises.writeFile(filePath, JSON.stringify(allData, null, 2), 'utf8');
        console.log('✅ Données détaillées sauvegardées dans users_detailed_data.json');

    } catch (e) {
        console.error('❌ Erreur globale sauvegarde données utilisateur:', e.message);
    }
}

// =========================
// EcoleDirecte proxy routes
// Same-origin endpoints for Cartable UI (/ed/*)
// =========================

// POST /ed/login
app.post('/ed/login', express.json(), async (req, res) => {
    try {
        const userKey = getEdUserKeyFromReq(req);
        if (!userKey) {
            return res.status(400).json({ success:false, error: 'username AlphaSource requis' });
        }
        const identifiant = (req.body && typeof req.body.identifiant === 'string') ? req.body.identifiant.trim() : '';
        const motdepasse = (req.body && typeof req.body.motdepasse === 'string') ? req.body.motdepasse : '';
        if (!identifiant || !motdepasse) {
            return res.status(400).json({ success:false, error: 'identifiant et motdepasse requis' });
        }

        const state = getEdState(userKey);
        state.api = new EcoleDirecteAPI(identifiant, motdepasse);
        const account = await state.api.login();
        if (account && account.requireQCM) {
            state.lastError = 'QCM required';
            state.api = null;
            return res.status(200).json({ success:false, requireQCM:true, message:'QCM required - manual input needed' });
        }
        const safeClasse = account?.profile?.classe?.libelle || account?.classe?.libelle || account?.classe || '-';
        
        // Sauvegarde des données complètes (Notes, EDT, Devoirs)
        // On ne bloque pas la réponse pour l'utilisateur, on lance en background
        // ou on attend si c'est critique. Ici on attend pour être sûr.
        // Sauvegarde des données (isolée de tout autre utilisateur)
        await saveUserData(account, state.api);

        state.lastError = null;

        return res.json({ success:true, account:{
            id: account.id,
            identifiant: account.identifiant,
            prenom: account.prenom,
            nom: account.nom,
            email: account.email,
            nomEtablissement: account.nomEtablissement,
            classe: safeClasse,
            anneeScolaireCourante: account.anneeScolaireCourante
        }});
    } catch (e) {
        const userKey = getEdUserKeyFromReq(req);
        const state = getEdState(userKey);
        state.lastError = e.message;
        state.api = null;
        return res.status(401).json({ success:false, error: e.message });
    }
});

// GET /ed/logout
app.get('/ed/logout', async (req, res) => {
    const userKey = getEdUserKeyFromReq(req);
    if (!userKey) return res.status(401).json({ success:false, error: 'Not authenticated' });
    const state = getEdState(userKey);

    // Déterminer l'accountId ED de cet utilisateur (si connu)
    let accountId = '';
    try {
        accountId = String(state?.api?.account?.id || '');
    } catch {}
    if (!accountId) {
        try {
            const store = await readMdpedConfig();
            const cfg = store && store[userKey] ? store[userKey] : null;
            accountId = String((cfg && (cfg.accountId || cfg.edAccountId)) || '');
        } catch {}
    }

    // 1) Supprime uniquement les données détaillées de CET utilisateur
    if (accountId) {
        try {
            const detailedDataPath = path.join(PUBLIC_API_DIR, 'users_detailed_data.json');
            let allData = {};
            try {
                const content = await fsPromises.readFile(detailedDataPath, 'utf8');
                allData = JSON.parse(content || '{}') || {};
            } catch { allData = {}; }
            if (allData && typeof allData === 'object' && allData[accountId] !== undefined) {
                delete allData[accountId];
                await fsPromises.writeFile(detailedDataPath, JSON.stringify(allData, null, 2), 'utf8');
                console.log('[ED LOGOUT] Données élève supprimées pour accountId:', accountId);
            }
        } catch (e) {
            console.warn('[ED LOGOUT] Impossible de supprimer users_detailed_data.json pour cet utilisateur:', e.message);
        }
    }

    // 2) Supprime uniquement les identifiants auto-login de CET utilisateur
    try {
        const store = await readMdpedConfig();
        if (store && typeof store === 'object' && store[userKey]) {
            delete store[userKey];
            await fsPromises.mkdir(path.dirname(MDPED_PATH), { recursive: true });
            await fsPromises.writeFile(MDPED_PATH, JSON.stringify(store, null, 2), 'utf-8');
            console.log('[ED LOGOUT] Identifiants supprimés pour userKey:', userKey);
        }
    } catch (e) {
        console.warn('[ED LOGOUT] Impossible de mettre à jour mdped.json:', e.message);
    }

    // 3) État mémoire + cache (uniquement cet utilisateur)
    clearUserCahierCache(userKey);
    clearEdStateForUser(userKey);
    res.json({ success:true });
});

// GET /ed/periodes - retourne la liste des périodes disponibles
app.get('/ed/periodes', async (req, res) => {
    const userKey = getEdUserKeyFromReq(req);
    if (!userKey) return res.status(401).json({ error:'Not authenticated' });
    const state = getEdState(userKey);
    if (!state.api) {
        const ok = await ensureEdConnected(userKey);
        if (!ok) return res.status(401).json({ error:'Not connected' });
    }
    try {
        const notes = await state.api.getNotes('');
        // Les périodes sont dans la réponse de notes
        const periodes = notes.periodes || [];
        res.json(periodes);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /ed/notes?anneeScolaire=<id>
app.get('/ed/notes', async (req, res) => {
    const userKey = getEdUserKeyFromReq(req);
    if (!userKey) return res.status(401).json({ error:'Not authenticated' });
    const state = getEdState(userKey);
    if (!state.api) {
        const ok = await ensureEdConnected(userKey);
        if (!ok) return res.status(401).json({ error:'Not connected' });
    }
    try {
        const anneeScolaire = req.query.anneeScolaire || '';
        const notes = await state.api.getNotes(anneeScolaire);
        res.json(notes);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /ed/devoirs?start=YYYY-MM-DD&end=YYYY-MM-DD
app.get('/ed/devoirs', async (req, res) => {
    const userKey = getEdUserKeyFromReq(req);
    if (!userKey) return res.status(401).json({ error:'Not authenticated' });
    const state = getEdState(userKey);
    if (!state.api) {
        const ok = await ensureEdConnected(userKey);
        if (!ok) return res.status(401).json({ error:'Not connected' });
    }
    try {
        const today = new Date();
        const defaultStart = toYmd(today);
        const defaultEnd = toYmd(new Date(today.getTime() + 30*86400000)); // 30 jours au lieu de 14
        const start = isYmd(req.query.start) ? req.query.start : defaultStart;
        const end = isYmd(req.query.end) ? req.query.end : defaultEnd;
        const startDate = parseYmdToUtcDate(start);
        const endDate = parseYmdToUtcDate(end);
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return res.status(400).json({ error:'Invalid date value' });
        if (startDate.getTime() > endDate.getTime()) return res.status(400).json({ error:'start must be <= end' });
        const days = Math.floor((endDate.getTime() - startDate.getTime())/86400000) + 1;
        if (days > 62) return res.status(400).json({ error:'Date range too large (max 62 days)' });

        const dates = Array.from({length:days}, (_,i)=> toYmd(new Date(startDate.getTime() + i*86400000)));

        // Récupère les cahiers en parallèle (avec limite) + cache court
        const cahiers = await mapWithConcurrency(dates, 4, async (ymd) => {
            const cached = getCachedCahierDeTexte(userKey, ymd);
            if (cached) return { ymd, data: cached };
            try {
                const data = await state.api.getCahierDeTexte(ymd);
                setCachedCahierDeTexte(userKey, ymd, data);
                return { ymd, data };
            } catch (e) {
                // Ne bloque pas toute la plage si une journée échoue
                return { ymd, data: null, error: e.message };
            }
        });

        const devoirs = [];
        for (const entry of cahiers) {
            const ymd = entry.ymd;
            const cahier = entry.data;
            const matieres = (cahier && Array.isArray(cahier.matieres)) ? cahier.matieres : [];
            for (const m of matieres) {
                const af = (m && m.aFaire) ? m.aFaire : null;
                if (!af) continue;
                const interrogation = truthy(m.interrogation) || truthy(af.interrogation);
                const decoded = decodeB64ToUtf8(af.contenu);
                const docs = [].concat(
                    Array.isArray(af.documents) ? af.documents : [],
                    Array.isArray(af.ressourceDocuments) ? af.ressourceDocuments : [],
                    Array.isArray(af.documentsRendus) ? af.documentsRendus : [],
                    Array.isArray(af.documentsRendusDeposes) ? af.documentsRendusDeposes : [],
                    (af.contenuDeSeance && Array.isArray(af.contenuDeSeance.documents)) ? af.contenuDeSeance.documents : []
                );

                const piecesJointes = docs
                    .filter(Boolean)
                    .map(d => ({
                        id: d.id ?? d.idDocument ?? d.idFichier ?? null,
                        libelle: d.libelle || d.nom || d.fichier || d.name || '',
                        url: d.url || d.lien || d.href || ''
                    }))
                    .filter(d => d.libelle || d.url || d.id);

                const titre = extractTitleFromHtml(decoded) || 'Devoir';
                devoirs.push({
                    date: ymd,
                    donneLe: af.donneLe || '',
                    matiere: m.matiere || m.discipline || m.libelle || 'Matière',
                    nomProf: m.nomProf || '',
                    titre,
                    contenu: decoded || '',
                    idDevoir: af.idDevoir || null,
                    effectue: !!af.effectue,
                    interrogation: !!interrogation,
                    isControle: !!interrogation,
                    piecesJointes,
                    hasPiecesJointes: docs.length > 0 || truthy(m.documentsAFaire) || truthy(af.documentsAFaire)
                });
            }
        }
        res.json({ start, end, count: devoirs.length, devoirs });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /ed/edt?start=YYYY-MM-DD&end=YYYY-MM-DD
app.get('/ed/edt', async (req, res) => {
    const userKey = getEdUserKeyFromReq(req);
    if (!userKey) return res.status(401).json({ error:'Not authenticated' });
    const state = getEdState(userKey);
    // Helper pour tenter l'appel API avec retry sur erreur auth
    const tryGetEdt = async (forceLogin = false) => {
        if (forceLogin || !state.api) {
            const ok = await ensureEdConnected(userKey);
            if (!ok) throw new Error('Not connected');
        }
        const today = new Date();
        const defaultStart = toYmd(today);
        const defaultEnd = toYmd(new Date(today.getTime() + 7*86400000)); 
        
        const start = isYmd(req.query.start) ? req.query.start : defaultStart;
        const end = isYmd(req.query.end) ? req.query.end : defaultEnd;
        
        return await state.api.getEmploiDuTemps(start, end);
    };

    try {
        const edt = await tryGetEdt(false);
        res.json(edt);
    } catch (err) {
        console.error("ED EDT Error (first attempt):", err.message);
        // Si erreur d'auth ou token invalide, on retente une fois avec login forcé
        if (err.message.includes('Code 520') || err.message.includes('Code 403') || err.message.includes('Code 401') || err.message.includes('Non connecté')) {
            console.log("🔄 Tentative de reconnexion ED pour EDT...");
            state.api = null; // Force reset (uniquement cet utilisateur)
            try {
                const edtRetry = await tryGetEdt(true);
                res.json(edtRetry);
            } catch (retryErr) {
                console.error("ED EDT Error (retry):", retryErr);
                res.status(500).json({ error: retryErr.message });
            }
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

// POST /ed/devoirs/effectue
app.post('/ed/devoirs/effectue', async (req, res) => {
    const userKey = getEdUserKeyFromReq(req);
    if (!userKey) return res.status(401).json({ error:'Not authenticated' });
    const state = getEdState(userKey);
    if (!state.api) {
        const ok = await ensureEdConnected(userKey);
        if (!ok) return res.status(401).json({ error:'Not connected' });
    }
    try {
        const body = req.body;
        let idDevoirsEffectues = [];
        let idDevoirsNonEffectues = [];
        
        // Forme simple : { idDevoir: 6237, effectue: true }
        if (body.idDevoir !== undefined) {
            const id = parseInt(body.idDevoir, 10);
            if (isNaN(id)) return res.status(400).json({ error: 'idDevoir must be a number' });
            if (body.effectue === undefined) return res.status(400).json({ error: 'effectue is required' });
            const isDone = truthy(body.effectue);
            if (isDone) {
                idDevoirsEffectues.push(id);
            } else {
                idDevoirsNonEffectues.push(id);
            }
        }
        // Forme avancée : { idDevoirsEffectues: [], idDevoirsNonEffectues: [] }
        else if (body.idDevoirsEffectues !== undefined || body.idDevoirsNonEffectues !== undefined) {
            idDevoirsEffectues = Array.isArray(body.idDevoirsEffectues) ? body.idDevoirsEffectues : [];
            idDevoirsNonEffectues = Array.isArray(body.idDevoirsNonEffectues) ? body.idDevoirsNonEffectues : [];
        } else {
            return res.status(400).json({ error: 'Invalid body format' });
        }
        
        // Appel à l'API ED pour mettre à jour
        const result = await state.api.setDevoirsEffectues(idDevoirsEffectues, idDevoirsNonEffectues);

        // Invalide le cache cahier de texte (l'état effectue a changé côté ED)
        try { clearUserCahierCache(userKey); } catch {}
        res.json({ success: true, result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /ed/devoir/download/:idDevoir/:fileId
// Télécharge une pièce jointe d'un devoir via l'API ED
app.get('/ed/devoir/download/:idDevoir/:fileId', async (req, res) => {
    const userKey = getEdUserKeyFromReq(req);
    if (!userKey) return res.status(401).json({ error: 'Not authenticated' });
    const state = getEdState(userKey);
    if (!state.api) {
        const ok = await ensureEdConnected(userKey);
        if (!ok) return res.status(401).json({ error: 'Not connected' });
    }
    try {
        const { idDevoir, fileId } = req.params;
        const devoirId = parseInt(idDevoir, 10);
        const fId = parseInt(fileId, 10);
        
        if (isNaN(devoirId) || isNaN(fId)) {
            return res.status(400).json({ error: 'Invalid devoir or file ID' });
        }

        // Les pièces jointes des devoirs utilisent le même système que les messages
        // On utilise downloadMessageAttachment en passant l'idDevoir comme idMessage
        // et en utilisant le mode 'TRAVAIL'
        const result = await state.api.downloadMessageAttachment(devoirId, fId, 'TRAVAIL', '');
        
        if (!result || !result.buffer || result.buffer.length === 0) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Envoie le fichier avec le header approprié
        res.set('Content-Type', result.headers && result.headers['content-type'] ? result.headers['content-type'] : 'application/octet-stream');
        res.set('Content-Disposition', `attachment; filename="devoir_${devoirId}_${fId}"`);
        res.send(result.buffer);
    } catch (e) {
        console.error('[Devoir Download Error]', e.message);
        res.status(500).json({ error: e.message });
    }
});

// =========================
// Config stockage identifiants ED (mdped.json)
// =========================

// GET /api/mdped
app.get('/api/mdped', async (req, res) => {
    try {
        const userKey = getEdUserKeyFromReq(req);
        if (!userKey) return res.status(401).json({ error: 'Not authenticated' });
        const store = await readMdpedConfig();
        const entry = (store && typeof store === 'object' && store[userKey]) ? store[userKey] : null;
        const data = {
            username: (entry && entry.username) ? entry.username : '',
            id: (entry && entry.id) ? entry.id : '',
            mdp: (entry && entry.mdp) ? entry.mdp : '',
            accountId: (entry && (entry.accountId || entry.edAccountId)) ? (entry.accountId || entry.edAccountId) : ''
        };
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/mdped  { username, id, mdp, accountId? }
app.post('/api/mdped', express.json(), async (req, res) => {
    try {
        const username = (req.body && typeof req.body.username === 'string') ? req.body.username.trim() : '';
        const id = (req.body && typeof req.body.id === 'string') ? req.body.id.trim() : '';
        const mdp = (req.body && typeof req.body.mdp === 'string') ? req.body.mdp : '';
        const accountId = (req.body && (typeof req.body.accountId === 'string' || typeof req.body.accountId === 'number')) ? String(req.body.accountId) : '';
        const userKey = normalizeUsername(username).toLowerCase();
        if (!userKey) return res.status(400).json({ success: false, error: 'username requis' });

        const store = await readMdpedConfig();
        const safeStore = (store && typeof store === 'object') ? store : {};

        // Si on envoie vide, on supprime l'entrée
        if (!id || !mdp) {
            if (safeStore[userKey]) delete safeStore[userKey];
        } else {
            safeStore[userKey] = { username, id, mdp, accountId };
        }
        await fsPromises.mkdir(path.dirname(MDPED_PATH), { recursive: true });
        await fsPromises.writeFile(MDPED_PATH, JSON.stringify(safeStore, null, 2), 'utf-8');
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// =================================================================
// ROUTES
// =================================================================
// Route qui force le nettoyage à l'arrivée sur le site
app.get('/login', (req, res) => {
    console.log("Logout forcé et redirection... 🗿");
    res.send(`
        <script>
            localStorage.clear();
            sessionStorage.clear();
            // On peut même supprimer les cookies si tu en as
            document.cookie.split(";").forEach(function(c) { 
                document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
            });
            window.location.href = '/pages/login.html';
        </script>
    `);
});

// 🚨 NOUVELLE ROUTE COURS (pour l'IA et le Listing) 🚨
app.get('/api/cours', (req, res) => {
    try {
        const filteredCourses = getActiveCoursesForAI();
        res.json(filteredCourses);
        console.log(`[COURS] Liste de ${filteredCourses.length} cours actifs envoyée.`);
    } catch (e) {
        console.error("PUTAIN ERREUR FATALE LORS DE LA LECTURE DE COURS.JSON :", e.message);
        res.status(500).json({ success: false, message: 'Erreur interne serveur lors de la lecture des cours.' });
    }
});

app.post('/api/messagerie/send', handleMessageSave);
console.log("Route POST /api/messagerie/send configurée.");
app.get('/api/messagerie/messages', handleMessagesRead);
console.log("Route GET /api/messagerie/messages configurée.");

// --- POST : Sauvetage (demande vers Source AI, diffusion aux élèves) ---
app.post('/api/messagerie/rescue', async (req, res) => {
    const { senderId, senderUsername, subject, body } = req.body || {};

    const cleanSenderId = String(senderId || '').trim();
    const cleanSenderUsername = (senderUsername || getUserNameById(cleanSenderId) || '').trim();
    if (!cleanSenderId || !cleanSenderUsername || !body) {
        return res.status(400).json({ success: false, message: "Champs manquants pour le sauvetage." });
    }
    if (!ai) {
        return res.status(500).json({ success: false, message: "IA indisponible pour le sauvetage." });
    }

    // Vérifier et déduire les 5 points (s'il manque, échec)
    const canSpend = spendPoints(cleanSenderUsername, 5);
    if (!canSpend) {
        return res.status(400).json({ success: false, message: "Pas assez de points (5 requis) pour lancer un sauvetage." });
    }

    const now = new Date().toISOString();
    const rescueId = 'r' + Date.now();
    const finalSubject = subject && subject.trim() ? subject.trim() : 'Demande de cours';

    // Enregistrer le message initial (trace pour l'utilisateur)
    const firstMessage = {
        id: 'm' + Date.now(),
        senderId: cleanSenderId,
        recipients: ['1'],
        subject: `[Sauvetage] ${finalSubject}`,
        body,
        timestamp: now,
        attachments: [],
        readBy: [],
        unreadBy: ['1'],
        type: 'rescue_request',
        rescueId
    };

    const startMessages = readAllMessagesFromJSON();
    startMessages.push(firstMessage);
    writeAllMessagesToJSON(startMessages);

    // Construire le prompt Gemini
    const classContext = clampText(fs.readFileSync(ALL_PATH, 'utf8') || '', 7000);
    const aiResult = await generateRescueTargets({
        studentMessage: body,
        requesterName: cleanSenderUsername,
        classContext
    });

    let candidateIds = aiResult.names
        .map(name => getUserIdByName(name))
        .filter(Boolean)
        .filter(id => id !== cleanSenderId);

    // Fallback si l'IA ne renvoie personne
    if (candidateIds.length === 0) {
        candidateIds = CLASS_NAMES
            .map(name => getUserIdByName(name))
            .filter(Boolean)
            .filter(id => id !== cleanSenderId)
            .slice(0, 3);
    }

    const instruction = aiResult.instruction || "Envoyez le cours demandé (photos lisibles). Récompense : 15 points au premier cours validé.";
    const dispatchBody = `${instruction}\n\nDemande de l'élève : ${body}`;

    // Générer les messages d'alerte
    const broadcastMessages = candidateIds.map((id, index) => ({
        id: 'm' + (Date.now() + index + 1),
        senderId: '1',
        recipients: [id],
        subject: 'Urgent',
        body: dispatchBody,
        timestamp: now,
        attachments: [],
        readBy: [],
        unreadBy: [String(id)],
        type: 'rescue_alert',
        rescueId,
        rescueOwnerId: cleanSenderId,
        rescueOwnerUsername: cleanSenderUsername,
        aiSuggestion: aiResult.raw || instruction
    }));

    // Message de confirmation pour le demandeur
    const ackMessage = {
        id: 'm' + (Date.now() + candidateIds.length + 5),
        senderId: '1',
        recipients: [cleanSenderId],
        subject: 'Sauvetage lancé',
        body: `J'ai sollicité ${candidateIds.length} élèves : ${candidateIds.map(getUserNameById).filter(Boolean).join(', ')}. Récompense : 15 points pour le premier cours validé.`,
        timestamp: now,
        attachments: [],
        readBy: [],
        unreadBy: [String(cleanSenderId)],
        type: 'rescue_status',
        rescueId
    };

    const finalMessages = readAllMessagesFromJSON();
    finalMessages.push(...broadcastMessages, ackMessage);
    writeAllMessagesToJSON(finalMessages);

    // Stockage dans rescues.json
    const rescues = readRescues();
    rescues.push({
        rescueId,
        requesterId: cleanSenderId,
        requesterUsername: cleanSenderUsername,
        subject: finalSubject,
        body,
        createdAt: now,
        status: 'open',
        responses: [],
        winningSenderId: null,
        winningMessageId: null,
        instruction: aiResult.raw || instruction
    });
    writeRescues(rescues);

    return res.json({
        success: true,
        rescueId,
        notified: candidateIds.length,
        suggestion: aiResult.raw || instruction
    });
});

// --- POST : Réponse à un sauvetage (élève -> demandeur, anonyme côté demandeur) ---
app.post('/api/messagerie/rescue/respond', (req, res) => {
    const { rescueId, senderId, senderUsername, body, subject, attachments, parentMessageId } = req.body || {};
    const cleanRescueId = (rescueId || '').trim();
    const cleanSenderId = String(senderId || '').trim();
    if (!cleanRescueId || !cleanSenderId || !body) {
        return res.status(400).json({ success: false, message: "Champs manquants pour la réponse." });
    }

    const rescues = readRescues();
    const target = rescues.find(r => r.rescueId === cleanRescueId);
    if (!target) return res.status(404).json({ success: false, message: "Sauvetage introuvable." });
    if (target.status === 'closed') return res.status(400).json({ success: false, message: "Ce sauvetage est déjà clôturé." });

    const safeAttachments = sanitizeAttachments(attachments);
    const now = new Date().toISOString();
    const msgId = 'm' + Date.now();
    const responseMessage = {
        id: msgId,
        senderId: cleanSenderId,
        recipients: [target.requesterId],
        subject: subject && subject.trim() ? subject.trim() : 'Réponse Sauvetage',
        body,
        timestamp: now,
        attachments: safeAttachments,
        readBy: [],
        unreadBy: [String(target.requesterId)],
        type: 'rescue_submission',
        rescueId: cleanRescueId,
        rescueOwnerId: target.requesterId,
        rescueOwnerUsername: target.requesterUsername,
        rescueOriginalSenderId: cleanSenderId,
        maskSenderFor: [target.requesterId],
        parentMessageId: parentMessageId || null
    };

    const messages = readAllMessagesFromJSON();
    messages.push(responseMessage);
    writeAllMessagesToJSON(messages);

    target.responses = Array.isArray(target.responses) ? target.responses : [];
    target.responses.push({
        messageId: msgId,
        senderId: cleanSenderId,
        senderUsername: senderUsername || getUserNameById(cleanSenderId) || 'Inconnu',
        createdAt: now
    });
    writeRescues(rescues);

    return res.json({ success: true, messageId: msgId });
});

// --- POST : Vote du demandeur sur une réponse ---
app.post('/api/messagerie/rescue/vote', (req, res) => {
    const { rescueId, messageId, voterId, vote } = req.body || {};
    const cleanRescueId = (rescueId || '').trim();
    const cleanMessageId = (messageId || '').trim();
    const cleanVoterId = String(voterId || '').trim();
    if (!cleanRescueId || !cleanMessageId || !cleanVoterId || !vote) {
        return res.status(400).json({ success: false, message: "Champs manquants pour le vote." });
    }

    const rescues = readRescues();
    const target = rescues.find(r => r.rescueId === cleanRescueId);
    if (!target) return res.status(404).json({ success: false, message: "Sauvetage introuvable." });
    if (target.requesterId !== cleanVoterId) return res.status(403).json({ success: false, message: "Seul le demandeur peut voter." });

    const messages = readAllMessagesFromJSON();
    const responseMsg = messages.find(m => m.id === cleanMessageId && m.rescueId === cleanRescueId);
    if (!responseMsg) return res.status(404).json({ success: false, message: "Réponse introuvable pour ce sauvetage." });

    // Vote
    target.lastVote = {
        messageId: cleanMessageId,
        voterId: cleanVoterId,
        vote,
        at: new Date().toISOString()
    };

    if (vote === 'up') {
        target.status = 'closed';
        target.winningSenderId = responseMsg.rescueOriginalSenderId || responseMsg.senderId;
        target.winningMessageId = cleanMessageId;
        const winnerName = getUserNameById(target.winningSenderId) || responseMsg.senderUsername || responseMsg.senderName;
        if (winnerName) addPoints(winnerName, 15);
    }

    writeRescues(rescues);
    return res.json({ success: true, status: target.status || 'open' });
});

// ----------------------------------------------------
// 🚨 ATTENTION : CETTE ROUTE (update-all-db) GÈRE DÉJÀ UNE STRUCTURE SPÉCIFIQUE (user_ranking)
const ALL_DB_PATH = ALL_PATH;

// --- Login ---
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!fs.existsSync(USERS_PATH)) {
        return res.status(500).json({ success: false, message: 'Fichier users.json manquant !' });
    }
    try {
        const rawData = fs.readFileSync(USERS_PATH, 'utf8') || '[]';
        const usersData = JSON.parse(rawData);
        const cleanUsername = normalizeUsername(username).toLowerCase();
        const user = usersData.find(u => normalizeUsername(u.username).toLowerCase() === cleanUsername);
        if (!user) {
            return res.status(401).json({ success: false, message: 'Utilisateur non trouvé.' });
        }
        
        // Vérifier le ban et le lever si expiré
        const now = Date.now();
        if (user.ban_until && user.ban_until > now) {
            const remainingHours = Math.ceil((user.ban_until - now) / (60 * 60 * 1000));
            return res.status(403).json({ 
                success: false, 
                redirect: '/pages/ban.html',
                ban_until: user.ban_until,
                ban_reason: 'Avertissements accumulés',
                message: `Vous êtes banni pour encore ${remainingHours}h.` 
            });
        } else if (user.ban_until && user.ban_until <= now) {
            // Lever le ban
            user.ban_until = null;
            user.banned = false;
            fs.writeFileSync(USERS_PATH, JSON.stringify(usersData, null, 2), 'utf8');
            // Recalculer les badges (enlever badge banni)
            recalculateBadges();
        }
        
        if (user.banned) {
            return res.status(403).json({ 
                success: false, 
                redirect: '/pages/ban.html',
                ban_until: user.ban_until || (now + 48 * 60 * 60 * 1000),
                ban_reason: 'Comportement inapproprié',
                message: 'Utilisateur banni.' 
            });
        }
        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Mot de passe incorrect.' });
        }
        // Check if first login
        const isFirstLogin = user.connexions === 0;
        // Increment connexions
        user.connexions += 1;
        user.last_connexion = Date.now();
        user.active = true;
        // Save updated users data
        fs.writeFileSync(USERS_PATH, JSON.stringify(usersData, null, 2));
        // Check daily login reward
        checkAndApplyDailyLogin(username);
        return res.json({ success: true, redirect: '/index.html', first_login: isFirstLogin, user: { username: user.username, points: user.pt, connexions: user.connexions } });
    } catch (e) {
        console.error("Erreur serveur login :", e);
        return res.status(500).json({ success: false, message: 'Erreur interne serveur.' });
    }
});

// --- Auto increment connexions ---
app.post('/api/auto_increment', async (req, res) => {
    const { username } = req.body;
    if (!username) {
        return res.status(400).json({ success: false, message: 'Username requis.' });
    }
    try {
        const rawData = fs.readFileSync(USERS_PATH, 'utf8') || '[]';
        const usersData = JSON.parse(rawData);
        const user = usersData.find(u => u.username.toLowerCase() === username.toLowerCase());
        if (!user) {
            return res.status(404).json({ success: false, message: 'Utilisateur non trouvé.' });
        }
        if (user.connexions >= 1 && (!user.last_connexion || Date.now() - user.last_connexion >= 3600000)) {
            user.connexions += 1;
            user.last_connexion = Date.now();
            fs.writeFileSync(USERS_PATH, JSON.stringify(usersData, null, 2));
        }
        return res.json({ success: true });
    } catch (e) {
        console.error("Erreur serveur auto_increment :", e);
        return res.status(500).json({ success: false, message: 'Erreur interne serveur.' });
    }
});

// --- Check if user is banned ---
app.post('/api/check_ban', async (req, res) => {
    const { username } = req.body;
    if (!username) {
        return res.status(400).json({ banned: false });
    }
    try {
        const rawData = fs.readFileSync(USERS_PATH, 'utf8') || '[]';
        const usersData = JSON.parse(rawData);
        const user = usersData.find(u => u.username.toLowerCase() === username.toLowerCase());
        if (!user) {
            return res.json({ banned: false });
        }
        
        const now = Date.now();
        // Vérifier et lever le ban si expiré
        if (user.ban_until && user.ban_until <= now) {
            user.ban_until = null;
            user.banned = false;
            fs.writeFileSync(USERS_PATH, JSON.stringify(usersData, null, 2), 'utf8');
            // Recalculer les badges
            recalculateBadges();
        }
        
        if (user.banned || (user.ban_until && user.ban_until > now)) {
            return res.json({ 
                banned: true,
                ban_until: user.ban_until,
                ban_reason: 'Avertissements accumulés'
            });
        }
        
        return res.json({ banned: false });
    } catch (e) {
        console.error("Erreur serveur check_ban :", e);
        return res.status(500).json({ banned: false });
    }
});

// --- GET : Récupérer les infos utilisateur (incluant date de naissance) ---
app.get('/api/user-info/:username', async (req, res) => {
    const username = req.params.username;
    if (!username) {
        return res.status(400).json({ success: false, message: 'Nom d\'utilisateur requis.' });
    }
    try {
        const rawData = fs.readFileSync(USERS_PATH, 'utf8') || '[]';
        const usersData = JSON.parse(rawData);
        const user = usersData.find(u => u.username.toLowerCase() === username.toLowerCase());
        if (!user) {
            return res.status(404).json({ success: false, message: 'Utilisateur non trouvé.' });
        }
        // Ensure default skin fields on this user
        let changed = false;
        if (!user.active_skin) { user.active_skin = 'bleu basique'; changed = true; }
        if (!user.skins_obtenus || !Array.isArray(user.skins_obtenus)) { user.skins_obtenus = ['bleu basique', 'jaune basique']; changed = true; } else if (!user.skins_obtenus.includes('jaune basique')) { user.skins_obtenus.push('jaune basique'); changed = true; }
        if (changed) {
            fs.writeFileSync(USERS_PATH, JSON.stringify(usersData, null, 2), 'utf8');
        }
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
                active_skin: user.active_skin || 'bleu basique',
                skins_obtenus: user.skins_obtenus || ['bleu basique', 'jaune basique'],
                reports_count: (user.reports || []).length,
                warnings_count: (user.warnings || []).filter(w => w.expiresAt > Date.now()).length
            }
        });
    } catch (e) {
        console.error("Erreur serveur user-info :", e);
        return res.status(500).json({ success: false, message: 'Erreur interne serveur.' });
    }
});

// Endpoint pour signaler un message
app.post('/api/report-message', async (req, res) => {
    const { messageId, reportedUser, reportingUser } = req.body;
    
    console.log('[REPORT] Signalement reçu:', { messageId, reportedUser, reportingUser });
    
    if (!reportingUser) {
        return res.status(401).json({ success: false, message: 'Non connecté.' });
    }
    
    if (!messageId || !reportedUser) {
        return res.status(400).json({ success: false, message: 'Données invalides.' });
    }
    
    try {
        const rawData = fs.readFileSync(USERS_PATH, 'utf8') || '[]';
        const usersData = JSON.parse(rawData);
        const user = usersData.find(u => u.username.toLowerCase() === reportedUser.toLowerCase());
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'Utilisateur non trouvé.' });
        }
        
        // Vérifier la limite de signalements par jour (2 personnes différentes max)
        const reportingUserObj = usersData.find(u => u.username.toLowerCase() === reportingUser.toLowerCase());
        if (!reportingUserObj) {
            return res.status(404).json({ success: false, message: 'Utilisateur signaleur non trouvé.' });
        }
        
        if (!reportingUserObj.reports_made) reportingUserObj.reports_made = [];
        
        const now = Date.now();
        const oneDayAgo = now - (24 * 60 * 60 * 1000);
        
        // Nettoyer les signalements de plus de 24h
        reportingUserObj.reports_made = reportingUserObj.reports_made.filter(r => r.timestamp > oneDayAgo);
        
        // Compter le nombre de personnes différentes signalées aujourd'hui
        const reportedUsersToday = new Set(reportingUserObj.reports_made.map(r => r.reportedUser.toLowerCase()));
        
        // Si l'utilisateur n'a pas déjà signalé cette personne aujourd'hui
        if (!reportedUsersToday.has(reportedUser.toLowerCase())) {
            // Vérifier s'il a déjà signalé 2 personnes différentes
            if (reportedUsersToday.size >= 2) {
                return res.status(429).json({ 
                    success: false, 
                    message: 'Tu ne peux signaler que 2 personnes différentes par jour.' 
                });
            }
        }
        
        // Ajouter le signalement fait par l'utilisateur
        reportingUserObj.reports_made.push({
            timestamp: now,
            reportedUser: reportedUser
        });
        
        // Initialiser les champs si nécessaire
        if (!user.reports) user.reports = [];
        if (!user.warnings) user.warnings = [];
        if (!user.ban_until) user.ban_until = null;
        
        // Ajouter le signalement
        user.reports.push({
            timestamp: now,
            reportedBy: reportingUser,
            messageId: messageId
        });
        
        console.log(`[REPORT] Signalement ajouté pour ${reportedUser}. Total: ${user.reports.length}`);
        
        // Vérifier si 3 signalements en 2 jours → avertissement
        const twoDaysAgo = now - (2 * 24 * 60 * 60 * 1000);
        const recentReports = user.reports.filter(r => r.timestamp > twoDaysAgo);
        
        if (recentReports.length >= 3) {
            // Donner un avertissement
            user.warnings.push({
                timestamp: now,
                reason: '3 signalements en 2 jours',
                expiresAt: now + (7 * 24 * 60 * 60 * 1000) // Expire dans 7 jours
            });
            
            // Les signalements restent à vie - pas de nettoyage
            
            // Vérifier les conditions de ban
            checkAndApplyBan(user, now);
            
            fs.writeFileSync(USERS_PATH, JSON.stringify(usersData, null, 2), 'utf8');
            
            // Recalculer les badges (puni, banni, police)
            recalculateBadges();
            
            return res.json({ 
                success: true, 
                message: 'Message signalé. L\'utilisateur a reçu un avertissement.',
                warning: true
            });
        }
        
        fs.writeFileSync(USERS_PATH, JSON.stringify(usersData, null, 2), 'utf8');
        
        // Recalculer les badges (police)
        recalculateBadges();
        
        return res.json({ 
            success: true, 
            message: `Message signalé avec succès. (${recentReports.length}/3 signalements en 2 jours)`
        });
        
    } catch (e) {
        console.error("Erreur serveur report-message :", e);
        return res.status(500).json({ success: false, message: 'Erreur interne serveur.' });
    }
});

// Fonction pour vérifier et appliquer un ban si nécessaire
function checkAndApplyBan(user, now) {
    // Nettoyer les avertissements expirés
    user.warnings = user.warnings.filter(w => w.expiresAt > now);
    
    const threeDaysAgo = now - (3 * 24 * 60 * 60 * 1000);
    const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
    
    const warningsLast3Days = user.warnings.filter(w => w.timestamp > threeDaysAgo);
    const warningsLastWeek = user.warnings.filter(w => w.timestamp > oneWeekAgo);
    
    // 2 avertissements en 3 jours OU 3 avertissements en 1 semaine = ban 48h
    if (warningsLast3Days.length >= 2 || warningsLastWeek.length >= 3) {
        user.ban_until = now + (48 * 60 * 60 * 1000); // Ban 48h
        user.banned = true;
        console.log(`[BAN] ${user.username} banni jusqu'au ${new Date(user.ban_until).toLocaleString()}`);
    }
}

// Endpoint pour changer le mot de passe
app.post('/api/change-password', async (req, res) => {
    const { username, newPassword } = req.body;
    if (!username || !newPassword) {
        return res.status(400).json({ success: false, message: 'Nom d\'utilisateur et nouveau mot de passe requis.' });
    }
    if (newPassword.length < 3) {
        return res.status(400).json({ success: false, message: 'Le mot de passe doit contenir au moins 3 caractères.' });
    }
    try {
        const rawData = fs.readFileSync(USERS_PATH, 'utf8') || '[]';
        const usersData = JSON.parse(rawData);
        const userIndex = usersData.findIndex(u => u.username.toLowerCase() === username.toLowerCase());
        if (userIndex === -1) {
            return res.status(404).json({ success: false, message: 'Utilisateur non trouvé.' });
        }
        // Générer le nouveau hash
        const saltRounds = 10;
        const newHash = await bcrypt.hash(newPassword, saltRounds);
        usersData[userIndex].passwordHash = newHash;
        // Sauvegarder le fichier
        fs.writeFileSync(USERS_PATH, JSON.stringify(usersData, null, 2), 'utf8');
        return res.json({ success: true, message: 'Mot de passe changé avec succès.' });
    } catch (e) {
        console.error("Erreur serveur change-password :", e);
        return res.status(500).json({ success: false, message: 'Erreur interne serveur.' });
    }
});

// --- Update birth date ---
app.post('/api/update-birth-date', async (req, res) => {
    const { username, birthDate } = req.body;
    if (!username || !birthDate) {
        return res.status(400).json({ success: false, message: 'Nom d\'utilisateur et date de naissance requis.' });
    }
    try {
        const rawData = fs.readFileSync(USERS_PATH, 'utf8') || '[]';
        const usersData = JSON.parse(rawData);
        const userIndex = usersData.findIndex(u => u.username.toLowerCase() === username.toLowerCase());
        if (userIndex === -1) {
            return res.status(404).json({ success: false, message: 'Utilisateur non trouvé.' });
        }
        usersData[userIndex].birth_date = birthDate;
        fs.writeFileSync(USERS_PATH, JSON.stringify(usersData, null, 2));
        return res.json({ success: true, message: 'Date de naissance mise à jour.' });
    } catch (e) {
        console.error("Erreur serveur update-birth-date :", e);
        return res.status(500).json({ success: false, message: 'Erreur interne serveur.' });
    }
});

// --- Update profile pic ---
app.post('/api/update-profile-pic', uploadProfilePic.single('profilePic'), async (req, res) => {
    const { username } = req.body;
    if (!username) {
        return res.status(400).json({ success: false, message: 'Nom d\'utilisateur requis.' });
    }
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'Aucun fichier uploadé.' });
    }
    try {
        const picPath = `/api/community/ressources/pp/${req.file.filename}`;
        
        // Enregistrer UNIQUEMENT dans pp.json
        const ppJsonPath = path.join(__dirname, 'public', 'api', 'community', 'ressources', 'pp', 'pp.json');
        let ppData = {};
        if (fs.existsSync(ppJsonPath)) {
            ppData = JSON.parse(fs.readFileSync(ppJsonPath, 'utf8'));
        }
        ppData[username] = picPath;
        fs.writeFileSync(ppJsonPath, JSON.stringify(ppData, null, 2));
        
        return res.json({ success: true, message: 'Photo de profil mise à jour.', picPath });
    } catch (e) {
        console.error("Erreur serveur update-profile-pic :", e);
        return res.status(500).json({ success: false, message: 'Erreur interne serveur.' });
    }
});



// --- GET : Récupérer les points individuels et collectifs (Ajusté pour JSON)
app.get('/public/api/points/:username', (req, res) => {
    const username = req.params.username;
    try {
        const usersRaw = fs.readFileSync(USERS_PATH, 'utf8') || '[]';
        const usersData = JSON.parse(usersRaw);
        const allUsersPoints = usersData.map(u => ({ username: u.username, points: typeof u.pt === 'number' ? u.pt : 0 }));
        const currentUserData = allUsersPoints.find(u => u.username === username);
        const collectivePoints = allUsersPoints.reduce((sum, user) => sum + user.points, 0);
        const ranking = allUsersPoints.sort((a, b) => b.points - a.points);

        return res.json({ individualPoints: currentUserData ? currentUserData.points : 0, collectivePoints: collectivePoints, ranking: ranking });
    } catch (e) {
        console.error("Erreur à la récupération des points via users.json", e.message);
        return res.status(500).json({ error: "Erreur serveur lors de la lecture des points via JSON." });
    }
});

// --- Get guide ---
app.get('/api/guide', (req, res) => {
    try {
        const guidePath = path.join(__dirname, 'guide.json');
        if (!fs.existsSync(guidePath)) {
            return res.json({ pages: [] });
        }
        const rawData = fs.readFileSync(guidePath, 'utf8');
        const guideData = JSON.parse(rawData);
        // Process pages to include images
        const processedPages = guideData.pages.map(page => {
            let content = page.content || '';
            if (page.image) {
                content += `<img src="${page.image}" alt="Guide image" style="max-width: 100%; margin-top: 20px;">`;
            }
            return { content };
        });
        return res.json({ pages: processedPages });
    } catch (e) {
        console.error("Erreur serveur guide :", e);
        return res.status(500).json({ error: "Erreur interne serveur." });
    }
});

// --- NOUVELLES CONSTANTES ET UTILITAIRES BDD (à mettre en haut de server.js) ---

/**
 * Lit la BDD évolutive complète (pour l'IA d'Analyse)
 * @returns {string | null} Le contenu de bdd.json en JSON stringifié
 */
function getEvolvingDBContent() {
    try {
        if (!fs.existsSync(BDD_FILE_PATH)) {
            ensureBddFile();
        }
        return fs.readFileSync(BDD_FILE_PATH, 'utf8');
    } catch (e) {
        console.error("ERREUR Lecture BDD :", e);
        return null;
    }
}

function clampText(str, max = 280) {
    if (!str || typeof str !== 'string') return '';
    return str.length > max ? `${str.slice(0, max)}...` : str;
}

/**
 * Écrit le nouveau JSON généré par l'IA d'Analyse dans le fichier.
 * @param {string} username - Nom de l'utilisateur qui a généré la donnée.
 * @param {string} newJsonText - Le JSON complet généré par l'IA.
 * @returns {boolean} true si succès, false sinon
 */
function updateEvolvingDBWithNewData(username, newJsonText) {
    try {
        // Nettoyage des triple backticks que l'IA ajoute souvent (```json ... ```)
        const cleanedJsonText = newJsonText.replace(/```json|```/g, '').trim(); 
        
        // Tentative de parsing
        const parsedData = JSON.parse(cleanedJsonText);

        // Ajout de la date de la maj
        parsedData.derniere_maj = `Date exacte: Dimanche 14 décembre 2025 à 16:55:01, Utilisateur: ${username}`;

        // Limiter la taille des historiques pour garder la BDD légère
        if (Array.isArray(parsedData.historiques)) {
            parsedData.historiques = parsedData.historiques
                .map(entry => ({
                    ...entry,
                    utilisateur: clampText(entry?.utilisateur || '', 220),
                    ia: clampText(entry?.ia || '', 520)
                }))
                .slice(-40);
        }

        if (Array.isArray(parsedData.nouvelles_infos)) {
            parsedData.nouvelles_infos = parsedData.nouvelles_infos
                .map(info => clampText(typeof info === 'string' ? info : JSON.stringify(info), 220))
                .slice(-40);
        }

        // Sauvegarde du fichier
        fs.writeFileSync(BDD_FILE_PATH, JSON.stringify(parsedData, null, 2), 'utf8');
        console.log(`[BDD ÉVOLUTIVE] MISE À JOUR PAR L'IA D'ANALYSE !`);
        return true;
    } catch (e) {
        // Si l'IA a généré un JSON invalide
        console.error("PUTAIN ERREUR FATALE DE PARSING JSON ou d'écriture dans la BDD :", e);
        console.error("Contenu JSON invalide de l'IA (regarde ça !):", newJsonText);
        return false;
    }
}

// =================================================================
// API Chat Gemini (DOUBLE GEMINI + BDD ÉVOLUTIVE TEXTE)
// =================================================================
// =================================================================
// 🔥 ROUTE CHAT IA (CORRIGÉE, STABLE, BDD APRÈS RÉPONSE) 🔥
// =================================================================
app.post('/public/api/chat', async (req, res) => {
    let newTotalPoints = 0;

    try {
        const {
            history,
            currentMessage,
            creativity,
            base64File,
            mimeType,
            systemInstruction, 
            username,
            modeValue // Récupération du mode
        } = req.body;

        if (!currentMessage && !base64File) {
            return res.status(400).json({
                success: false,
                response: "Message vide.",
                newIndividualPoints: 0
            });
        }

        // === RÉCUPÉRATION DONNÉES ÉLÈVE (EDT, NOTES, DEVOIRS) ===
        let studentContext = "";
        try {
            const detailedDataPath = path.join(PUBLIC_API_DIR, 'users_detailed_data.json');
            const fileContent = await fsPromises.readFile(detailedDataPath, 'utf8');
            const allUsersData = JSON.parse(fileContent);

            // Trouver l'utilisateur (tolérant : prénom, nom, id, identifiant ou full name)
            const normalizedUsername = (username || '').trim().toLowerCase();
            const usersArray = Object.values(allUsersData || {});
            let userEntry = null;

            if (usersArray.length === 1) {
                userEntry = usersArray[0];
            }

            if (!userEntry) {
                userEntry = usersArray.find(u => {
                    const acc = u.account || {};
                    const prenom = (acc.prenom || '').trim().toLowerCase();
                    const nom = (acc.nom || '').trim().toLowerCase();
                    const full = `${prenom} ${nom}`.trim();
                    const identifiant = (acc.identifiant || '').trim().toLowerCase();
                    const idStr = (acc.id !== undefined && acc.id !== null) ? String(acc.id).trim().toLowerCase() : '';

                    if (!normalizedUsername) return false;

                    const matchPrenom = prenom && normalizedUsername === prenom;
                    const matchNom = nom && normalizedUsername === nom;
                    const matchFull = full && normalizedUsername === full;
                    const matchIdent = identifiant && normalizedUsername === identifiant;
                    const matchId = idStr && normalizedUsername === idStr;
                    const containsPrenom = prenom && normalizedUsername.includes(prenom);
                    const containsFull = full && normalizedUsername.includes(full);

                    return matchPrenom || matchNom || matchFull || matchIdent || matchId || containsFull || containsPrenom;
                });
            }

            if (userEntry) {
                const mode = (modeValue || '').toLowerCase();
                const parts = [];

                // 1. EDT (Basique)
                if (mode === 'basique' || mode === 'basic') {
                    if (userEntry.edt && Array.isArray(userEntry.edt)) {
                        // On ne garde que les cours futurs proches
                        const now = new Date();
                        // On augmente la limite pour couvrir environ une semaine (ex: 40 cours)
                        const upcomingEdt = userEntry.edt
                            .filter(c => c && c.start_date && new Date(c.start_date) >= now)
                            .slice(0, 40); 
                        
                        const simpleEdt = upcomingEdt.map(c => {
                            const isCancelled = c.isAnnule || (c.statut && c.statut.includes('Annul')) || (c.text && c.text.match(/annul|absent/i));
                            const statusStr = isCancelled ? " [⚠️ COURS ANNULÉ / PROF ABSENT]" : "";
                            const startLabel = (c.start_date || '').substring(0, 16) || 'Date inconnue';
                            const matiere = c.matiere || 'Cours';
                            const salle = c.salle ? `(${c.salle})` : '';
                            return `${startLabel}: ${matiere} ${salle}${statusStr}`.trim();
                        }).join('\n');
                        parts.push(`[EDT PROCHAIN (Date YYYY-MM-DD HH:MM)]\n${simpleEdt || 'Aucun cours prochainement.'}`);
                    }
                }

                // 2. NOTES (Apprentissage, Devoirs)
                if (mode === 'apprentissage' || mode === 'learning' || mode === 'devoirs' || mode === 'homework') {
                    if (userEntry.notes && userEntry.notes.periodes) {
                        const currentPeriod = userEntry.notes.periodes.find(p => p.cloture === false) || userEntry.notes.periodes[userEntry.notes.periodes.length - 1];
                        
                        if (currentPeriod && currentPeriod.ensembleMatieres) {
                            // Gère à la fois le format tableau et le format "disciplines" objet
                            const matieresRaw = Array.isArray(currentPeriod.ensembleMatieres)
                                ? currentPeriod.ensembleMatieres
                                : (currentPeriod.ensembleMatieres.disciplines && Array.isArray(currentPeriod.ensembleMatieres.disciplines)
                                    ? currentPeriod.ensembleMatieres.disciplines
                                    : []);

                            const notesSummary = matieresRaw.map(m => {
                                const label = m.matiere || m.discipline || 'Matière';
                                const moy = m.moyenneGenerale || m.moyenne || '';
                                const moyTxt = moy ? `Moy: ${moy}` : '';
                                const lastNotes = Array.isArray(m.devoirs) ? m.devoirs.slice(0, 3).map(d => d.noteSur20).join(', ') : '';
                                return `${label}: ${moyTxt} ${lastNotes ? `(Dernières: ${lastNotes})` : ''}`.trim();
                            }).join('\n');

                            parts.push(`[NOTES & MOYENNES]\n${notesSummary || 'Notes non trouvées.'}`);
                        }
                    }
                }

                // 3. DEVOIRS (Tous les modes pertinents)
                if (['basique', 'basic', 'apprentissage', 'learning', 'devoirs', 'homework'].includes(mode)) {
                    if (userEntry.devoirs && Array.isArray(userEntry.devoirs)) {
                        const now = new Date();
                        // On définit "aujourd'hui minuit" pour inclure les devoirs du jour même s'il est 23h
                        const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

                        const upcomingHw = userEntry.devoirs
                            .filter(d => {
                                const isDone = d.aFaire && d.aFaire.effectue;
                                const dueDate = new Date(d.date);
                                // On garde si :
                                // - Pas fait (même si c'est vieux, c'est "en retard")
                                // - OU si c'est pour aujourd'hui ou plus tard (même si fait, pour info)
                                return (!isDone) || (dueDate >= todayMidnight);
                            })
                            .slice(0, 15); // On augmente la limite pour voir les retards éventuels

                        const simpleHw = upcomingHw.map(d => {
                            const rawContent = (d.aFaire && (d.aFaire.contenuDecoded || d.aFaire.contenu)) || '';
                            const content = (typeof rawContent === 'string' ? rawContent : '').trim();
                            const preview = content ? `${content.substring(0, 120)}${content.length>120?'...':''}` : 'Aucun détail';

                            const isDone = !!(d.aFaire && d.aFaire.effectue);
                            const dueDate = d.date ? new Date(d.date) : todayMidnight;
                            
                            let status = isDone ? "✅ Fait" : "❌ À FAIRE";
                            if (!isDone && dueDate < todayMidnight) {
                                status = "⚠️ EN RETARD";
                            }

                            const dateLabel = d.date || 'Date inconnue';
                            const matiere = d.matiere || 'Matière inconnue';
                            return `${dateLabel}: ${matiere} - ${preview} [${status}]`;
                        }).join('\n');
                        parts.push(`[LISTE DES DEVOIRS (À FAIRE / EN RETARD / PROCHAINS)]\n${simpleHw || 'Aucun devoir à afficher.'}`);
                    }
                }

                if (parts.length > 0) {
                    studentContext = `\n=== DONNÉES ÉLÈVE (${userEntry.account.prenom}) ===\n${parts.join('\n\n')}\n==============================\n`;
                }
            }
        } catch (e) {
            console.warn("Impossible de charger le contexte élève:", e.message);
        }

        // === AJOUT POINT ===
        /*
        if (username) {
            newTotalPoints = addPointToAllJSON(username);
        }
            */

        if (!ai) {
            return res.status(500).json({
                success: false,
                response: "IA non initialisée.",
                newIndividualPoints: newTotalPoints
            });
        }

        // =========================
        // 1️⃣ PRÉPARATION CONTENU
        // =========================
        const cleanedHistory = Array.isArray(history)
            ? history.filter(m => m?.role && Array.isArray(m.parts))
            : [];

        // 🚨 NOUVEAU CONTEXTE FORT : On injecte ici les instructions du chat.js (BDD + Personnalité)
        const contextFromClient = systemInstruction || ""; // Prend la systemInstruction envoyée par le client
        
        const now = new Date();
        const dateOptions = { timeZone: 'Europe/Paris', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        const dateStr = now.toLocaleString('fr-FR', dateOptions);

        // On injecte le contexte élève (studentContext) AVANT les instructions système
        const finalSystemPrompt = `
DATE ET HEURE ACTUELLE : ${dateStr}
${studentContext}
${contextFromClient.trim()}

RÈGLES D'AGENT : 
-Tu dois etre respectueux et amical(n'hesite pas à taquiner un peulutilisateur ou bien à lui parler comme son pote)

`.trim();

        const userParts = [];
        if (currentMessage) userParts.push({ text: currentMessage });
        // Limiter l'impact des pièces jointes trop lourdes (éviter latences extrêmes)
        const MAX_INLINE_BASE64 = 2 * 1024 * 1024; // ~2MB en Base64
        const canAttachInline = base64File && mimeType && (typeof base64File === 'string') && base64File.length <= MAX_INLINE_BASE64;
        if (canAttachInline) {
            userParts.push({ inlineData: { data: base64File, mimeType } });
        }

        // 🚨 MODIFICATION CRITIQUE : Ajout du contexte strict comme premier message utilisateur
        const contents = [
            { role: "user", parts: [{ text: finalSystemPrompt }] }, // Contexte strict forcé
            ...cleanedHistory,
            { role: "user", parts: userParts }
        ];

        // =========================
        // 2️⃣ APPEL IA PRINCIPALE (avec timeout et tokens réduits)
        // =========================
        const withTimeout = (promise, ms) => {
            return new Promise((resolve, reject) => {
                const t = setTimeout(() => reject(new Error('IA timeout')), ms);
                promise.then(v => { clearTimeout(t); resolve(v); }, err => { clearTimeout(t); reject(err); });
            });
        };

        let aiResponse = "Réponse vide.";
        try {
            const mainResult = await withTimeout(
                ai.models.generateContent({
                    model,
                    contents,
                    generationConfig: {
                        temperature: Number(creativity) || 0.6,
                        maxOutputTokens: 768  // Réduit de 1024 à 768 pour plus de vitesse
                    }
                }),
                12000  // Réduit de 15s à 12s pour répondre plus vite
            );
            aiResponse = mainResult.text || aiResponse;
        } catch (e) {
            console.warn("[CHAT] IA principale lente ou en erreur:", e.message);
            aiResponse = "Désolé, la réponse a pris trop de temps. Réessaie ou reformule ta question.";
        }

        // Incrémenter compteur de messages AI si >15 chars
        if (currentMessage && currentMessage.length > 15) {
            incrementMessageCount(username, 'ai');
        }

        // Déduire points pour mode Devoirs (achat)
        if (systemInstruction && systemInstruction.toLowerCase().includes("devoirs")) {
            spendPoints(username, 3);
        }

        // =========================
        // 3️⃣ RÉPONSE IMMÉDIATE AU CLIENT
        // =========================
        res.json({ success: true, response: aiResponse, newIndividualPoints: newTotalPoints });

        // =========================
        // 4️⃣ ANALYSE BDD EN ARRIÈRE-PLAN (NON BLOQUANTE)
        // =========================
        setImmediate(async () => {
            try {
                const currentDB = getEvolvingDBContent();
                const safeCurrentDB = typeof currentDB === 'string' ? currentDB.slice(-4000) : "";
                const shortUserMsg = clampText(currentMessage || '', 280);
                const shortAiMsg = clampText(aiResponse || '', 320);

                const analysisPrompt = `
Tu es l'IA d'analyse de la BDD évolutive. Retourne uniquement du JSON valide.
- Repars de la BDD fournie sans supprimer les champs existants.
- Ajoute l'échange du jour dans "historiques" en restant concis (user: 1 ligne, ia: 2 phrases max).
- Optionnel: ajoute 1-2 faits utiles dans "nouvelles_infos" (<=200 caractères chacun) seulement s'ils aident l'IA principale.
- Ne réécris pas de longs blocs, ne change pas les autres champs.
- Si rien à ajouter, renvoie la BDD telle quelle.

BDD (tronquée si besoin):
${safeCurrentDB || "Aucune donnée"}

Dernière interaction:
user (${username || 'inconnu'}) : "${shortUserMsg}"
ia : "${shortAiMsg}"
`;

                const dbResult = await ai.models.generateContent({
                    model,
                    contents: [{ role: "user", parts: [{ text: analysisPrompt }] }],
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 400
                    }
                });

                const cleanedJSON = (dbResult.text || "").replace(/```json|```/g, '').trim();
                if (cleanedJSON) updateEvolvingDBWithNewData(username, cleanedJSON);
            } catch (e) {
                console.error("[BDD] Échec mise à jour (background) :", e.message);
            }
        });

        return; // réponse déjà envoyée

    } catch (error) {
        console.error("ERREUR /public/api/chat :", error);
        return res.status(500).json({
            success: false,
            response: "Erreur serveur IA.",
            newIndividualPoints: newTotalPoints
        });
    }
});


// -------------------------------------------------------------------------------------------------
// --- GET : récupérer tous les messages communautaires ---




// --- POST : Uploader un cours (Ajout d'une entrée dans cours.json) ---
app.post('/public/api/course/upload', uploadCourse.single('course-file'), async (req,res) => {
    if (!req.file) return res.status(400).json({ success:false, message:'Fichier manquant, espèce de petite frappe.' });

    const { title, subject, description, uploaderName } = req.body;
    const newCourse = {
        id: Date.now(),
        title: title || req.file.originalname,
        subject: subject || "Inconnu",
        description: description || "Pas de description",
        uploaderName: uploaderName || "Anonyme",
        filePath: `/uploads/${req.file.filename}`,
        uploadedAt: new Date().toISOString(),
        deleteTimer: INITIAL_DELETE_TIMER_SECONDS,
        supprime: false
    };

    try {
        const allCourses = readAllCoursesFromJSON();
        allCourses.push(newCourse);
        writeAllCoursesToJSON(allCourses);
        console.log(`[COURS] Nouveau cours uploadé : ${newCourse.title} (ID: ${newCourse.id})`);
        return res.status(201).json({ success:true, course:newCourse, message:'Cours uploadé et enregistré, gros zinzin !' });
    } catch(e) {
        console.error("PUTAIN ERREUR LORS DE L'ENREGISTREMENT DU COURS :", e);
        // Nettoyage du fichier uploadé en cas d'échec d'écriture JSON
        fs.unlink(req.file.path, () => console.log(`[Cleanup] Fichier ${req.file.filename} supprimé suite à l'échec JSON.`));
        return res.status(500).json({ success:false, message:"Erreur serveur lors de l'enregistrement dans cours.json." });
    }
});

// --- GET : Lister les cours actifs ---
app.get('/public/api/course/list', (req,res) => {
    try {
        const activeCourses = getFilteredActiveCourses();
        return res.json({ success:true, courses:activeCourses });
    } catch(e) {
        console.error("Erreur listage cours:", e);
        return res.status(500).json({ success:false, message:"Erreur serveur lors du listage des cours." });
    }
});

// --- DELETE : Supprimer un cours (supprime logique) ---
app.delete('/public/api/course/delete/:id', (req,res) => {
    const courseId = req.params.id;
    if(!courseId) return res.status(400).json({ success:false, message:'ID de cours manquant, bordel !' });

    try {
        const wasDeleted = deleteCourseFromJSON(courseId);
        if(wasDeleted){
            console.log(`[COURS] Suppression logique réussie pour ID : ${courseId}`);
            return res.json({ success:true, message:`Cours ID ${courseId} marqué comme supprimé.` });
        } else {
            console.log(`[COURS] ID non trouvé ou déjà supprimé : ${courseId}`);
            return res.status(404).json({ success:false, message:`Cours ID ${courseId} non trouvé ou déjà supprimé.` });
        }
    } catch(e){
        console.error("PUTAIN ÉCHEC suppression logique :", e);
        return res.status(500).json({ success:false, message:"Erreur serveur lors de la suppression logique." });
    }
});

// --- POST : Upload photo de profil ---
app.post('/public/api/profile/upload-avatar', uploadProfilePic.single('avatar'), async (req, res) => {
    console.log('[PROFILE] ===== UPLOAD AVATAR REQUEST RECEIVED =====');
    console.log('[PROFILE] File:', JSON.stringify(req.file));
    console.log('[PROFILE] Body:', JSON.stringify(req.body));

    try {
        const username = req.body.username;
        console.log('[PROFILE] Username:', username);

        if (!username) {
            console.log('[PROFILE] ❌ Username manquant');
            return res.status(400).json({ success: false, message: 'Nom d\'utilisateur manquant' });
        }

        if (!req.file) {
            console.log('[PROFILE] ❌ Aucun fichier');
            return res.status(400).json({ success: false, message: 'Aucun fichier uploadé' });
        }

        const avatarPath = `/api/community/ressources/pp/${req.file.filename}`;
        console.log('[PROFILE] Avatar path:', avatarPath);
        
        // Extraire la couleur dominante de l'image
        const imagePath = path.join(__dirname, 'public', 'api', 'community', 'ressources', 'pp', req.file.filename);
        let dominantColor = 'red'; // Couleur par défaut
        
        try {
            const v = new Vibrant(imagePath);
            const palette = await v.getPalette();
            // Préférer une teinte claire si l'avatar est clair (évite les couleurs trop sombres)
            if (palette.LightVibrant) {
                dominantColor = palette.LightVibrant.hex;
            } else if (palette.LightMuted) {
                dominantColor = palette.LightMuted.hex;
            } else if (palette.Vibrant) {
                dominantColor = palette.Vibrant.hex;
            } else if (palette.Muted) {
                dominantColor = palette.Muted.hex;
            } else if (palette.DarkVibrant) {
                dominantColor = palette.DarkVibrant.hex;
            } else if (palette.DarkMuted) {
                dominantColor = palette.DarkMuted.hex;
            }
            console.log('[PROFILE] ✅ Couleur dominante extraite:', dominantColor);
        } catch (colorError) {
            console.warn('[PROFILE] ⚠️ Erreur extraction couleur, utilisation de red:', colorError.message);
        }

        // Mettre à jour users.json avec la nouvelle couleur
        const usersJsonPath = path.join(__dirname, 'public', 'api', 'users.json');
        let usersData = [];
        if (fs.existsSync(usersJsonPath)) {
            usersData = JSON.parse(fs.readFileSync(usersJsonPath, 'utf8'));
        }
        
        const userIndex = usersData.findIndex(u => u.username === username);
        if (userIndex !== -1) {
            usersData[userIndex].color = dominantColor;
            fs.writeFileSync(usersJsonPath, JSON.stringify(usersData, null, 2));
            console.log('[PROFILE] ✅ Couleur mise à jour dans users.json:', dominantColor);
        }

        // Mettre à jour pp.json
        const ppJsonPath = path.join(__dirname, 'public', 'api', 'community', 'ressources', 'pp', 'pp.json');

        let ppData = {};
        if (fs.existsSync(ppJsonPath)) {
            ppData = JSON.parse(fs.readFileSync(ppJsonPath, 'utf8'));
        }

        ppData[username] = avatarPath;
        fs.writeFileSync(ppJsonPath, JSON.stringify(ppData, null, 2));

        console.log('[PROFILE] ✅ PP JSON mis à jour pour', username);

        res.json({
            success: true,
            message: 'Photo de profil mise à jour avec succès',
            avatarPath: avatarPath,
            color: dominantColor
        });

    } catch (error) {
        console.error('[PROFILE] ❌ Erreur:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur lors de l\'upload' });
    }
});



// --- GET : Lire global.json ---
app.get('/public/api/community/global.json', (req, res) => {
    const globalPath = path.join(PUBLIC_API_DIR, 'community/global.json');
    try {
        if (!fs.existsSync(globalPath)) {
            return res.json({ groups: [], topics: [], fills: [] });
        }

        const truncatePreview = (text, maxLen) => {
            const normalized = String(text || '').replace(/\s+/g, ' ').trim();
            if (!normalized) return '';
            if (normalized.length <= maxLen) return normalized;
            return normalized.slice(0, maxLen) + '....';
        };

        const formatLastMessagePreview = (msg) => {
            if (!msg || typeof msg !== 'object') return '';
            const sender = String(msg.sender || msg.username || msg.from || '').trim() || '???';
            const type = String(msg.type || '').toLowerCase();
            const content = typeof msg.content === 'string' ? msg.content : '';
            const hasText = content.replace(/\s+/g, ' ').trim().length > 0;
            const hasFile = !!msg.file;

            if (type === 'image') {
                if (hasText) return `${sender}: ${truncatePreview(content, 34)}`;
                return `${sender}: [image]`;
            }

            if (type === 'text') {
                return `${sender}: ${truncatePreview(content, 34)}`;
            }

            if (hasText) {
                return `${sender}: ${truncatePreview(content, 34)}`;
            }

            if (hasFile) {
                return `${sender}: [fichier]`;
            }

            return '';
        };

        const getGroupLastPreview = (groupId) => {
            if (!groupId) return '';
            try {
                const groupFile = path.join(PUBLIC_API_DIR, 'community', 'groupes', `${groupId}.json`);
                if (!fs.existsSync(groupFile)) return '';
                const group = JSON.parse(fs.readFileSync(groupFile, 'utf8'));
                const messages = Array.isArray(group.messages) ? group.messages : [];
                if (messages.length === 0) return '';

                let lastMsg = messages[messages.length - 1];
                let lastTs = Date.parse(lastMsg && lastMsg.timestamp ? lastMsg.timestamp : '');
                if (!Number.isFinite(lastTs)) lastTs = -Infinity;

                for (const m of messages) {
                    const ts = Date.parse(m && m.timestamp ? m.timestamp : '');
                    if (Number.isFinite(ts) && ts >= lastTs) {
                        lastTs = ts;
                        lastMsg = m;
                    }
                }

                return formatLastMessagePreview(lastMsg);
            } catch (e) {
                return '';
            }
        };

        const data = fs.readFileSync(globalPath, 'utf8');
        const parsed = JSON.parse(data);

        if (parsed && Array.isArray(parsed.groups)) {
            parsed.groups = parsed.groups.map(g => {
                if (!g || !g.id) return g;
                return {
                    ...g,
                    lastMessagePreview: getGroupLastPreview(g.id)
                };
            });
        }

        res.json(parsed);
    } catch (e) {
        console.error("Erreur lecture global.json:", e);
        res.status(500).json({ error: "Erreur serveur lors de la lecture de global.json" });
    }
});

// --- PUT : Écrire dans global.json ---
app.put('/public/api/community/global.json', express.json(), (req, res) => {
    const globalPath = path.join(PUBLIC_API_DIR, 'community/global.json');
    try {
        fs.writeFileSync(globalPath, JSON.stringify(req.body, null, 2), 'utf8');
        res.json({ success: true });
    } catch (e) {
        console.error("Erreur écriture global.json:", e);
        res.status(500).json({ error: "Erreur serveur lors de l'écriture de global.json" });
    }
});

// --- POST : Créer un nouveau groupe (coût fixe 30pt + photo optionnelle) ---
app.post('/public/api/community/create-group', uploadCommunity.single('photo'), (req, res) => {
    const name = (req.body.name || '').trim();
    const description = (req.body.description || '').trim();
    const username = (req.body.username || '').trim();

    if (!name || !username) return res.status(400).json({ success: false, message: "Nom et username requis" });

    const cost = 30;

    // Vérifier points
    if (!checkPointsForAction(username, cost)) {
        return res.status(400).json({ success: false, message: "Pas assez de points pour créer un groupe (-30 points requis)" });
    }

    let requestedMembers = [];
    if (req.body.members) {
        try {
            const parsed = JSON.parse(req.body.members);
            if (Array.isArray(parsed)) requestedMembers = parsed;
        } catch (e) {
            requestedMembers = [];
        }
    }

    const members = Array.from(new Set([username, ...requestedMembers.filter(Boolean).map(String)]));

    const photoUrl = req.file ? `/pictures_documents/${req.file.filename}` : '';

    const newGroup = {
        id: 'group_' + Date.now(),
        name,
        description,
        type: 'group',
        members,
        admin: username,
        createdAt: new Date().toISOString(),
        isPrivate: true,
        cost,
        photoUrl
    };

    try {
        // Créer fichier individuel
        const groupDir = path.join(PUBLIC_API_DIR, 'community', 'groupes');
        if (!fs.existsSync(groupDir)) fs.mkdirSync(groupDir, { recursive: true });
        fs.writeFileSync(path.join(groupDir, `${newGroup.id}.json`), JSON.stringify(newGroup, null, 2));

        // Mettre à jour global.json
        const globalPath = path.join(PUBLIC_API_DIR, 'community/global.json');
        let globalData = { groups: [], topics: [], fills: [], mps: [] };
        if (fs.existsSync(globalPath)) {
            globalData = JSON.parse(fs.readFileSync(globalPath, 'utf8'));
        }
        globalData.groups.push(newGroup);
        fs.writeFileSync(globalPath, JSON.stringify(globalData, null, 2));

        // Déduire points
        spendPoints(username, cost);

        res.json({ success: true, group: newGroup });
    } catch (e) {
        console.error("Erreur création groupe:", e);
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
});

// --- POST : Créer un nouveau sujet ---
app.post('/public/api/community/create-topic', express.json(), (req, res) => {
    const { name, description, username, durationMs } = req.body;
    if (!name || !username) return res.status(400).json({ success: false, message: "Nom et username requis" });

    const cost = 5;

    const allowedDurations = [
        12 * 60 * 60 * 1000,
        24 * 60 * 60 * 1000,
        48 * 60 * 60 * 1000,
        5 * 24 * 60 * 60 * 1000
    ];

    const selectedDuration = allowedDurations.includes(Number(durationMs))
        ? Number(durationMs)
        : 24 * 60 * 60 * 1000;

    // Vérifier points
    if (!checkPointsForAction(username, cost)) {
        return res.status(400).json({ success: false, message: "Pas assez de points pour créer un sujet (-5 points requis)" });
    }

    const newTopic = {
        id: 'topic_' + Date.now(),
        name: name,
        description: description || '',
        createdBy: username,
        createdAt: new Date().toISOString(),
        duration: selectedDuration,
        expiresAt: new Date(Date.now() + selectedDuration).toISOString()
    };

    try {
        // Créer fichier individuel
        const topicDir = path.join(PUBLIC_API_DIR, 'community', 'sujets');
        if (!fs.existsSync(topicDir)) fs.mkdirSync(topicDir, { recursive: true });
        fs.writeFileSync(path.join(topicDir, `${newTopic.id}.json`), JSON.stringify(newTopic, null, 2));

        // Mettre à jour global.json
        const globalPath = path.join(PUBLIC_API_DIR, 'community/global.json');
        let globalData = { groups: [], topics: [], fills: [], mps: [] };
        if (fs.existsSync(globalPath)) {
            globalData = JSON.parse(fs.readFileSync(globalPath, 'utf8'));
        }
        globalData.topics.push(newTopic);
        fs.writeFileSync(globalPath, JSON.stringify(globalData, null, 2));

        // Déduire points
        deductPoints(username, cost);

        res.json({ success: true, topic: newTopic });
    } catch (e) {
        console.error("Erreur création sujet:", e);
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
});

// --- POST : Créer un nouveau fill ---
app.post('/public/api/community/create-fill', express.json(), (req, res) => {
    const { name, description, parentType, parentId, username, members } = req.body;
    if (!name || !parentType || !parentId || !username) return res.status(400).json({ success: false, message: "Paramètres requis manquants" });

    const requestedMembers = Array.isArray(members) ? members : [];
    const finalMembers = Array.from(new Set([username, ...requestedMembers.filter(Boolean).map(String)]));

    const newFill = {
        id: 'fill_' + Date.now(),
        name: name,
        description: description || '',
        parentType: parentType,
        parentId: parentId,
        members: finalMembers,
        admin: username,
        createdBy: username,
        createdAt: new Date().toISOString(),
        duration: 12 * 60 * 60 * 1000,
        expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
    };

    try {
        // Créer fichier individuel
        const fillDir = path.join(PUBLIC_API_DIR, 'community', 'fills');
        if (!fs.existsSync(fillDir)) fs.mkdirSync(fillDir, { recursive: true });
        fs.writeFileSync(path.join(fillDir, `${newFill.id}.json`), JSON.stringify(newFill, null, 2));

        // Mettre à jour global.json
        const globalPath = path.join(PUBLIC_API_DIR, 'community/global.json');
        let globalData = { groups: [], topics: [], fills: [], mps: [] };
        if (fs.existsSync(globalPath)) {
            globalData = JSON.parse(fs.readFileSync(globalPath, 'utf8'));
        }
        globalData.fills.push(newFill);
        fs.writeFileSync(globalPath, JSON.stringify(globalData, null, 2));

        res.json({ success: true, fill: newFill });

        // Récompenser le créateur du sujet si applicable
        rewardTopicCreatorForFill(newFill);
    } catch (e) {
        console.error("Erreur création fill:", e);
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
});

// --- POST : Créer un nouveau MP ---
app.post('/public/api/community/create-mp', express.json(), (req, res) => {
    const { recipient, username } = req.body;
    if (!recipient || !username) return res.status(400).json({ success: false, message: "Destinataire et username requis" });

    // Vérifier si l'utilisateur n'essaie pas de se créer un MP avec lui-même
    if (recipient === username) return res.status(400).json({ success: false, message: "Vous ne pouvez pas créer un MP avec vous-même" });

    try {
        // Charger global.json pour vérifier les MPs existants
        const globalPath = path.join(PUBLIC_API_DIR, 'community/global.json');
        let globalData = { groups: [], topics: [], fills: [], mps: [] };
        if (fs.existsSync(globalPath)) {
            globalData = JSON.parse(fs.readFileSync(globalPath, 'utf8'));
        }

        // Vérifier si une conversation privée existe déjà entre ces deux utilisateurs
        const existingMp = globalData.mps.find(mp =>
            mp.participants && mp.participants.includes(username) && mp.participants.includes(recipient) && mp.participants.length === 2
        );

        if (existingMp) {
            return res.json({ success: true, mp: existingMp, existed: true });
        }

        const newMp = {
            id: 'mp_' + Date.now(),
            participants: [username, recipient],
            createdBy: username,
            createdAt: new Date().toISOString(),
            messages: []
        };

        // Créer fichier individuel
        const mpDir = path.join(PUBLIC_API_DIR, 'community', 'mp');
        if (!fs.existsSync(mpDir)) fs.mkdirSync(mpDir, { recursive: true });
        fs.writeFileSync(path.join(mpDir, `${newMp.id}.json`), JSON.stringify(newMp, null, 2));

        // Mettre à jour global.json
        globalData.mps.push(newMp);
        fs.writeFileSync(globalPath, JSON.stringify(globalData, null, 2));

        res.json({ success: true, mp: newMp });
    } catch (e) {
        console.error("Erreur création MP:", e);
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
});

// --- POST : Rejoindre un fill ---
app.post('/public/api/community/join-fill', express.json(), (req, res) => {
    const { fillId, username } = req.body;
    if (!fillId || !username) return res.status(400).json({ success: false, message: "fillId et username requis" });

    // Cette route est conservée pour compatibilité mais on empêche désormais le bypass.
    return res.status(403).json({ success: false, message: 'Accès sur demande : utilisez "Demander à rejoindre".' });
});

function ymdUtcKey() {
    return new Date().toISOString().slice(0, 10);
}

// --- POST : Demander à rejoindre un fill (anti-spam 3/jour) ---
app.post('/public/api/community/fill-join-request', express.json(), (req, res) => {
    const fillId = (req.body.fillId || '').trim();
    const username = (req.body.username || '').trim();
    if (!fillId || !username) {
        return res.status(400).json({ success: false, message: 'fillId et username requis' });
    }

    try {
        const globalPath = path.join(PUBLIC_API_DIR, 'community', 'global.json');
        if (!fs.existsSync(globalPath)) {
            return res.status(404).json({ success: false, message: 'Données non trouvées' });
        }
        const globalData = JSON.parse(fs.readFileSync(globalPath, 'utf8'));
        const fill = Array.isArray(globalData.fills) ? globalData.fills.find(f => f && f.id === fillId) : null;
        if (!fill) return res.status(404).json({ success: false, message: 'Fill introuvable' });

        const members = Array.isArray(fill.members) ? fill.members : [];
        if (members.includes(username)) {
            return res.status(400).json({ success: false, message: 'Tu es déjà membre de ce fill.' });
        }

        const adminUsername = (fill.admin || fill.createdBy || '').trim();
        if (!adminUsername) {
            return res.status(500).json({ success: false, message: 'Admin du fill introuvable.' });
        }

        const adminId = getUserIdByName(adminUsername);
        const requesterId = getUserIdByName(username);
        if (!adminId || !requesterId) {
            return res.status(400).json({ success: false, message: 'Utilisateur introuvable.' });
        }

        const dayKey = ymdUtcKey();
        const requests = readFillJoinRequests();
        const countToday = requests.filter(r => r && r.fillId === fillId && r.requesterUsername === username && r.dayKey === dayKey).length;
        if (countToday >= 3) {
            return res.status(429).json({ success: false, message: 'Limite atteinte : 3 demandes par jour pour ce fill.' });
        }

        const requestId = `fjr_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
        const reqObj = {
            id: requestId,
            fillId,
            fillName: fill.name || '',
            requesterUsername: username,
            requesterId: String(requesterId),
            adminUsername,
            adminId: String(adminId),
            dayKey,
            createdAt: new Date().toISOString(),
            status: 'pending'
        };
        requests.push(reqObj);
        writeFillJoinRequests(requests);

        // Message à l'admin via messagerie, envoyé par le bot
        const subject = `Demande rejoindre fill : ${fill.name || fillId}`;
        const body = `Cet utilisateur veut rejoindre le fill "${fill.name || fillId}" : ${username}`;

        const newMessage = {
            id: 'm' + Date.now(),
            senderId: '1',
            recipients: [String(adminId)],
            subject,
            body,
            timestamp: new Date().toISOString(),
            attachments: [],
            readBy: [],
            unreadBy: [String(adminId)],
            type: 'fill_join_request',
            fillJoinRequestId: requestId,
            fillId,
            fillName: fill.name || '',
            requesterUsername: username,
            requesterId: String(requesterId),
            fillJoinAdminUsername: adminUsername,
            fillJoinAdminId: String(adminId),
            fillJoinStatus: 'pending'
        };

        const existingMessages = readAllMessagesFromJSON();
        existingMessages.push(newMessage);
        writeAllMessagesToJSON(existingMessages);

        return res.json({ success: true, requestId, message: 'Demande envoyée.' });
    } catch (e) {
        console.error('Erreur fill-join-request:', e);
        return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// --- POST : Répondre à une demande (admin) ---
app.post('/public/api/community/fill-join-respond', express.json(), (req, res) => {
    const requestId = String(req.body.requestId || req.body.fillJoinRequestId || '').trim();
    let action = String(req.body.action || req.body.response || '').trim();
    if (action === 'accepted') action = 'accept';
    if (action === 'refused') action = 'refuse';
    const adminUsername = (req.body.adminUsername || '').trim();
    if (!requestId || !action || !adminUsername) {
        return res.status(400).json({ success: false, message: 'requestId, action, adminUsername requis' });
    }
    if (action !== 'accept' && action !== 'refuse') {
        return res.status(400).json({ success: false, message: 'Action invalide' });
    }

    try {
        const requests = readFillJoinRequests();
        const idx = requests.findIndex(r => r && r.id === requestId);
        if (idx === -1) return res.status(404).json({ success: false, message: 'Demande introuvable' });

        const reqObj = requests[idx];
        if (reqObj.status !== 'pending') {
            return res.status(400).json({ success: false, message: 'Demande déjà traitée.' });
        }

        // Vérifier admin
        if (adminUsername !== 'ADMIN' && adminUsername !== reqObj.adminUsername) {
            return res.status(403).json({ success: false, message: 'Accès refusé' });
        }

        const globalPath = path.join(PUBLIC_API_DIR, 'community', 'global.json');
        if (!fs.existsSync(globalPath)) {
            return res.status(404).json({ success: false, message: 'Données non trouvées' });
        }
        const globalData = JSON.parse(fs.readFileSync(globalPath, 'utf8'));
        const fillIndex = Array.isArray(globalData.fills) ? globalData.fills.findIndex(f => f && f.id === reqObj.fillId) : -1;
        if (fillIndex === -1) return res.status(404).json({ success: false, message: 'Fill introuvable' });

        const fill = globalData.fills[fillIndex];
        const fillAdmin = (fill.admin || fill.createdBy || '').trim();
        if (adminUsername !== 'ADMIN' && adminUsername !== fillAdmin) {
            return res.status(403).json({ success: false, message: 'Accès refusé' });
        }

        const requesterUsername = reqObj.requesterUsername;
        const requesterId = reqObj.requesterId;

        if (action === 'accept') {
            if (!Array.isArray(fill.members)) fill.members = [];
            if (!fill.members.includes(requesterUsername)) {
                fill.members.push(requesterUsername);
            }

            // Sync fichier individuel
            const fillFile = path.join(PUBLIC_API_DIR, 'community', 'fills', `${reqObj.fillId}.json`);
            if (fs.existsSync(fillFile)) {
                const fillFileData = JSON.parse(fs.readFileSync(fillFile, 'utf8'));
                if (!Array.isArray(fillFileData.members)) fillFileData.members = [];
                if (!fillFileData.members.includes(requesterUsername)) {
                    fillFileData.members.push(requesterUsername);
                }
                // Garder admin
                if (!fillFileData.admin) fillFileData.admin = fillAdmin || fillFileData.createdBy || '';
                fs.writeFileSync(fillFile, JSON.stringify(fillFileData, null, 2));
            }

            globalData.fills[fillIndex] = fill;
            fs.writeFileSync(globalPath, JSON.stringify(globalData, null, 2));
        }

        reqObj.status = action === 'accept' ? 'accepted' : 'refused';
        reqObj.resolvedAt = new Date().toISOString();
        requests[idx] = reqObj;
        writeFillJoinRequests(requests);

        // Mettre à jour le message admin correspondant (statut)
        try {
            const allMessages = readAllMessagesFromJSON();
            const msgIdx = allMessages.findIndex(m => m && m.type === 'fill_join_request' && m.fillJoinRequestId === requestId);
            if (msgIdx !== -1) {
                allMessages[msgIdx].fillJoinStatus = reqObj.status;
                writeAllMessagesToJSON(allMessages);
            }
        } catch {}

        // Notifier le demandeur
        const notifySubject = action === 'accept'
            ? `Demande acceptée : ${reqObj.fillName || reqObj.fillId}`
            : `Demande refusée : ${reqObj.fillName || reqObj.fillId}`;
        const notifyBody = action === 'accept'
            ? `Ta demande a été acceptée. Tu peux maintenant accéder au fill "${reqObj.fillName || reqObj.fillId}".`
            : `Ta demande a été refusée pour le fill "${reqObj.fillName || reqObj.fillId}".`;

        const notifyMessage = {
            id: 'm' + Date.now(),
            senderId: '1',
            recipients: [String(requesterId)],
            subject: notifySubject,
            body: notifyBody,
            timestamp: new Date().toISOString(),
            attachments: [],
            readBy: [],
            unreadBy: [String(requesterId)],
            type: 'fill_join_notice',
            fillId: reqObj.fillId,
            fillName: reqObj.fillName || ''
        };
        const existingMessages2 = readAllMessagesFromJSON();
        existingMessages2.push(notifyMessage);
        writeAllMessagesToJSON(existingMessages2);

        return res.json({ success: true, status: reqObj.status });
    } catch (e) {
        console.error('Erreur fill-join-respond:', e);
        return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// --- POST : Quitter un groupe (successeur requis si admin) ---
app.post('/public/api/community/leave-group', express.json(), (req, res) => {
    const groupId = (req.body.groupId || '').trim();
    const username = (req.body.username || '').trim();
    const successor = (req.body.successor || '').trim();

    if (!groupId || !username) {
        return res.status(400).json({ success: false, message: 'groupId et username requis' });
    }
    if (groupId === 'classe3c') {
        return res.status(400).json({ success: false, message: 'Impossible de quitter ce groupe' });
    }

    try {
        const globalPath = path.join(PUBLIC_API_DIR, 'community', 'global.json');
        if (!fs.existsSync(globalPath)) return res.status(404).json({ success: false, message: 'Données non trouvées' });
        const globalData = JSON.parse(fs.readFileSync(globalPath, 'utf8'));

        const groupIdx = Array.isArray(globalData.groups) ? globalData.groups.findIndex(g => g && g.id === groupId) : -1;
        if (groupIdx === -1) return res.status(404).json({ success: false, message: 'Groupe introuvable' });

        const groupFile = path.join(PUBLIC_API_DIR, 'community', 'groupes', `${groupId}.json`);
        if (!fs.existsSync(groupFile)) return res.status(404).json({ success: false, message: 'Groupe introuvable' });
        const group = JSON.parse(fs.readFileSync(groupFile, 'utf8'));
        if (!Array.isArray(group.members) || !group.members.includes(username)) {
            return res.status(403).json({ success: false, message: 'Tu n\'es pas membre.' });
        }

        const isAdmin = (group.admin || '').trim() === username;
        let members = group.members.filter(m => m !== username);

        if (isAdmin) {
            if (!successor) {
                return res.status(400).json({ success: false, message: 'Successeur requis' });
            }
            if (!members.includes(successor)) {
                return res.status(400).json({ success: false, message: 'Successeur invalide' });
            }
            group.admin = successor;
        }

        group.members = members;

        // Si vide: supprimer groupe + cascade fills
        if (group.members.length === 0) {
            // Retirer du global
            globalData.groups = Array.isArray(globalData.groups) ? globalData.groups.filter(g => g && g.id !== groupId) : [];

            // Cascade fills
            const fillsToDelete = Array.isArray(globalData.fills)
                ? globalData.fills.filter(f => f && f.parentType === 'group' && f.parentId === groupId)
                : [];
            globalData.fills = Array.isArray(globalData.fills)
                ? globalData.fills.filter(f => !(f && f.parentType === 'group' && f.parentId === groupId))
                : [];

            if (fs.existsSync(groupFile)) fs.unlinkSync(groupFile);
            fillsToDelete.forEach(f => {
                const ff = path.join(PUBLIC_API_DIR, 'community', 'fills', `${f.id}.json`);
                if (fs.existsSync(ff)) fs.unlinkSync(ff);
            });

            fs.writeFileSync(globalPath, JSON.stringify(globalData, null, 2));
            return res.json({ success: true, deleted: true });
        }

        // Persister
        fs.writeFileSync(groupFile, JSON.stringify(group, null, 2));
        globalData.groups[groupIdx] = { ...globalData.groups[groupIdx], members: group.members, admin: group.admin };
        fs.writeFileSync(globalPath, JSON.stringify(globalData, null, 2));
        return res.json({ success: true, deleted: false, group });
    } catch (e) {
        console.error('Erreur leave-group:', e);
        return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// --- POST : Quitter un fill (successeur requis si admin) ---
app.post('/public/api/community/leave-fill', express.json(), (req, res) => {
    const fillId = (req.body.fillId || '').trim();
    const username = (req.body.username || '').trim();
    const successor = (req.body.successor || '').trim();

    if (!fillId || !username) {
        return res.status(400).json({ success: false, message: 'fillId et username requis' });
    }

    try {
        const globalPath = path.join(PUBLIC_API_DIR, 'community', 'global.json');
        if (!fs.existsSync(globalPath)) return res.status(404).json({ success: false, message: 'Données non trouvées' });
        const globalData = JSON.parse(fs.readFileSync(globalPath, 'utf8'));

        const fillIdx = Array.isArray(globalData.fills) ? globalData.fills.findIndex(f => f && f.id === fillId) : -1;
        if (fillIdx === -1) return res.status(404).json({ success: false, message: 'Fill introuvable' });

        const fillFile = path.join(PUBLIC_API_DIR, 'community', 'fills', `${fillId}.json`);
        if (!fs.existsSync(fillFile)) return res.status(404).json({ success: false, message: 'Fill introuvable' });
        const fill = JSON.parse(fs.readFileSync(fillFile, 'utf8'));
        if (!Array.isArray(fill.members) || !fill.members.includes(username)) {
            return res.status(403).json({ success: false, message: 'Tu n\'es pas membre.' });
        }

        const fillAdmin = (fill.admin || fill.createdBy || '').trim();
        const isAdmin = fillAdmin === username;
        let members = fill.members.filter(m => m !== username);

        if (isAdmin) {
            if (!successor) {
                return res.status(400).json({ success: false, message: 'Successeur requis' });
            }
            if (!members.includes(successor)) {
                return res.status(400).json({ success: false, message: 'Successeur invalide' });
            }
            fill.admin = successor;
        }

        fill.members = members;

        if (fill.members.length === 0) {
            // Retirer du global + supprimer fichier
            globalData.fills = Array.isArray(globalData.fills) ? globalData.fills.filter(f => f && f.id !== fillId) : [];
            if (fs.existsSync(fillFile)) fs.unlinkSync(fillFile);
            fs.writeFileSync(globalPath, JSON.stringify(globalData, null, 2));
            return res.json({ success: true, deleted: true });
        }

        fs.writeFileSync(fillFile, JSON.stringify(fill, null, 2));
        globalData.fills[fillIdx] = { ...globalData.fills[fillIdx], members: fill.members, admin: fill.admin };
        fs.writeFileSync(globalPath, JSON.stringify(globalData, null, 2));
        return res.json({ success: true, deleted: false, fill });
    } catch (e) {
        console.error('Erreur leave-fill:', e);
        return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// --- POST : Envoyer un message dans une discussion ---
app.post('/public/api/community/send-message', uploadCommunity.single('file'), (req, res) => {
    const { discussionId, discussionType, message, username, repliesTo } = req.body;
    if (!discussionId || !discussionType || !username) {
        return res.status(400).json({ success: false, message: "Paramètres requis manquants" });
    }

    // Vérifier si l'utilisateur est banni
    try {
        const rawData = fs.readFileSync(USERS_PATH, 'utf8') || '[]';
        const usersData = JSON.parse(rawData);
        const user = usersData.find(u => u.username.toLowerCase() === username.toLowerCase());
        
        if (user) {
            const now = Date.now();
            if (user.ban_until && user.ban_until > now) {
                const remainingHours = Math.ceil((user.ban_until - now) / (60 * 60 * 1000));
                return res.status(403).json({ 
                    success: false, 
                    message: `Vous êtes banni pour encore ${remainingHours}h.` 
                });
            } else if (user.ban_until && user.ban_until <= now) {
                // Lever le ban
                user.ban_until = null;
                user.banned = false;
                fs.writeFileSync(USERS_PATH, JSON.stringify(usersData, null, 2), 'utf8');
            }
        }
    } catch (e) {
        console.error('Erreur vérification ban:', e);
    }

    const newMessage = {
        id: 'msg_' + Date.now(),
        sender: username,
        content: message || '',
        timestamp: new Date().toISOString(),
        type: 'text'
    };

    // Ajouter la relation de réponse si présente
    if (repliesTo) {
        newMessage.replies_to = repliesTo;
    }

    // Gérer le fichier si présent
    if (req.file) {
        const fileInfo = {
            filename: req.file.filename,
            originalName: req.file.originalname,
            type: req.file.mimetype,
            size: req.file.size
        };
        newMessage.file = fileInfo;
        newMessage.type = req.file.mimetype.startsWith('image/') ? 'image' : 
                          req.file.mimetype.startsWith('video/') ? 'video' : 'document';
    }

    try {
        // Déterminer le dossier selon le type
        let messagesDir;
        if (discussionType === 'group') {
            messagesDir = path.join(PUBLIC_API_DIR, 'community', 'groupes');
        } else if (discussionType === 'fill') {
            messagesDir = path.join(PUBLIC_API_DIR, 'community', 'fills');
        } else if (discussionType === 'mp') {
            messagesDir = path.join(PUBLIC_API_DIR, 'community', 'mp');
        } else {
            return res.status(400).json({ success: false, message: "Type de discussion invalide" });
        }

        const messagesFile = path.join(messagesDir, `${discussionId}.json`);
        
        // Charger ou créer le fichier de messages
        let discussionData = {};
        if (fs.existsSync(messagesFile)) {
            discussionData = JSON.parse(fs.readFileSync(messagesFile, 'utf8'));
        } else {
            // Si c'est un nouveau fichier, initialiser avec les données de base
            discussionData = JSON.parse(fs.readFileSync(path.join(PUBLIC_API_DIR, 'community', 'global.json'), 'utf8'));
            if (discussionType === 'group') {
                discussionData = discussionData.groups.find(g => g.id === discussionId);
            } else if (discussionType === 'fill') {
                discussionData = discussionData.fills.find(f => f.id === discussionId);
            } else if (discussionType === 'mp') {
                discussionData = discussionData.mps.find(m => m.id === discussionId);
            }
            discussionData.messages = [];
        }

        // Contrôle d'accès: seuls les membres/participants peuvent lire/écrire
        if (discussionType === 'group') {
            if (!Array.isArray(discussionData.members) || !discussionData.members.includes(username)) {
                return res.status(403).json({ success: false, message: "Accès refusé: vous n'êtes pas membre de ce groupe" });
            }
        }
        if (discussionType === 'fill') {
            if (!Array.isArray(discussionData.members) || !discussionData.members.includes(username)) {
                return res.status(403).json({ success: false, message: "Accès refusé: vous n'êtes pas membre de ce fill" });
            }
        }
        if (discussionType === 'mp') {
            if (!Array.isArray(discussionData.participants) || !discussionData.participants.includes(username)) {
                return res.status(403).json({ success: false, message: "Accès refusé: vous n'êtes pas participant à ce MP" });
            }
        }

        // Ajouter le message
        if (!discussionData.messages) discussionData.messages = [];
        discussionData.messages.push(newMessage);

        // Sauvegarder
        fs.writeFileSync(messagesFile, JSON.stringify(discussionData, null, 2));

        // Incrémenter compteur de messages pour récompenses (total + type)
        if (discussionType === 'group' || discussionType === 'fill') {
            incrementMessageCount(username, 'fill');
        } else {
            incrementMessageCount(username, 'total');
        }

        res.json({ success: true, message: newMessage });
    } catch (e) {
        console.error("Erreur envoi message:", e);
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
});

// --- GET : Récupérer les messages d'une discussion ---
app.get('/public/api/community/messages/:discussionId/:discussionType', (req, res) => {
    const { discussionId, discussionType } = req.params;
    const username = (req.query.username || '').trim();

    if (!username) {
        return res.status(400).json({ success: false, message: "username requis" });
    }

    try {
        // Déterminer le dossier selon le type
        let messagesDir;
        if (discussionType === 'group') {
            messagesDir = path.join(PUBLIC_API_DIR, 'community', 'groupes');
        } else if (discussionType === 'fill') {
            messagesDir = path.join(PUBLIC_API_DIR, 'community', 'fills');
        } else if (discussionType === 'mp') {
            messagesDir = path.join(PUBLIC_API_DIR, 'community', 'mp');
        } else {
            return res.status(400).json({ success: false, message: "Type de discussion invalide" });
        }

        const messagesFile = path.join(messagesDir, `${discussionId}.json`);
        
        if (!fs.existsSync(messagesFile)) {
            return res.json({ success: true, messages: [] });
        }

        const discussionData = JSON.parse(fs.readFileSync(messagesFile, 'utf8'));
        const messages = discussionData.messages || [];

        // Contrôle d'accès
        if (discussionType === 'group') {
            if (!Array.isArray(discussionData.members) || !discussionData.members.includes(username)) {
                return res.status(403).json({ success: false, message: "Accès refusé" });
            }
        }
        if (discussionType === 'fill') {
            if (!Array.isArray(discussionData.members) || !discussionData.members.includes(username)) {
                return res.status(403).json({ success: false, message: "Accès refusé" });
            }
        }
        if (discussionType === 'mp') {
            if (!Array.isArray(discussionData.participants) || !discussionData.participants.includes(username)) {
                return res.status(403).json({ success: false, message: "Accès refusé" });
            }
        }

        // Joindre les badges actifs pour chaque expéditeur
        let usersData = [];
        try {
            usersData = JSON.parse(fs.readFileSync(USERS_PATH, 'utf8') || '[]');
        } catch (e) {
            usersData = [];
        }
        const badgeMap = new Map();
        usersData.forEach(u => {
            badgeMap.set(u.username, Array.isArray(u.badges_current) ? u.badges_current : []);
        });

        const messagesWithBadges = messages.map(msg => ({
            ...msg,
            badges: badgeMap.get(msg.sender) || []
        }));

        res.json({ success: true, messages: messagesWithBadges });
    } catch (e) {
        console.error("Erreur récupération messages:", e);
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
});

// --- DÉMARRAGE DU SERVEUR ---
// Démarrer le service de vérifications
const verificationsProcess = spawn('node', ['verifications.js'], {
    stdio: 'inherit',
    cwd: __dirname
});

console.log("[SERVER] Service de vérifications démarré.");

// Gestion de l'arrêt propre
process.on('exit', () => {
    if (verificationsProcess) {
        console.log("[SERVER] Arrêt du service de vérifications...");
        verificationsProcess.kill();
    }
});

process.on('SIGINT', () => {
    if (verificationsProcess) {
        console.log("[SERVER] Arrêt du service de vérifications...");
        verificationsProcess.kill();
    }
    process.exit(0);
});

// --- Shop Purchase Route ---
app.post('/api/shop-purchase', express.json(), async (req, res) => {
    try {
        const { username, itemId, price, type } = req.body;
        
        if (!username || !itemId || !price || !type) {
            return res.status(400).json({ 
                success: false, 
                message: 'Paramètres manquants' 
            });
        }

        console.log(`[SHOP] Tentative d'achat par ${username}: ${itemId} (${price} pts)`);

        // Lire les données utilisateur
        const rawData = fs.readFileSync(USERS_PATH, 'utf8') || '[]';
        const usersData = JSON.parse(rawData);
        const user = usersData.find(u => u.username.toLowerCase() === username.toLowerCase());

        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'Utilisateur non trouvé' 
            });
        }

        // Vérifier si l'utilisateur a assez de points
        const currentPoints = user.pt || 0;
        if (currentPoints < price) {
            return res.status(400).json({ 
                success: false, 
                message: `Vous n'avez pas assez de points. Il vous faut ${price} pts mais vous n'en avez que ${currentPoints}.` 
            });
        }

        // Initialiser les champs skins si nécessaire
        if (!user.skins_obtenus || !Array.isArray(user.skins_obtenus)) {
            user.skins_obtenus = ['bleu basique', 'jaune basique'];
        }

        // Empêcher les doublons
        if (user.skins_obtenus.includes(itemId)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Vous avez déjà acheté cet item' 
            });
        }

        // Effectuer l'achat
        const success = spendPoints(username, price);
        
        if (success) {
            // Enregistrer l'achat dans skins_obtenus et activer le skin
            user.skins_obtenus.push(itemId);
            user.active_skin = itemId;

            // Sauvegarder les modifications
            fs.writeFileSync(USERS_PATH, JSON.stringify(usersData, null, 2));

            const newPoints = (user.pt || 0) - price;
            console.log(`[SHOP] ✅ Achat réussi pour ${username}: ${itemId}. Points restants: ${newPoints}`);

            return res.json({ 
                success: true, 
                message: 'Achat réussi !',
                newPoints: newPoints,
                active_skin: user.active_skin
            });
        } else {
            return res.status(500).json({ 
                success: false, 
                message: 'Erreur lors de la déduction des points' 
            });
        }

    } catch (error) {
        console.error('[SHOP] Erreur lors de l\'achat:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Erreur serveur lors de l\'achat' 
        });
    }
});

// === EQUIP SKIN ENDPOINT ===
app.post('/api/equip-skin', express.json(), async (req, res) => {
    try {
        const { username, skinId } = req.body;
        
        if (!username || !skinId) {
            return res.status(400).json({ 
                success: false, 
                message: 'Username ou Skin ID manquant' 
            });
        }

        console.log(`[EQUIP] ${username} équipe le skin: ${skinId}`);

        // Lire les données utilisateur
        const rawData = fs.readFileSync(USERS_PATH, 'utf8') || '[]';
        const usersData = JSON.parse(rawData);
        const user = usersData.find(u => u.username.toLowerCase() === username.toLowerCase());

        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'Utilisateur non trouvé' 
            });
        }

        // Initialiser les champs skins si nécessaire
        if (!user.skins_obtenus || !Array.isArray(user.skins_obtenus)) {
            user.skins_obtenus = ['bleu basique', 'jaune basique'];
        }

        // Vérifier que le skin appartient à l'utilisateur ou est un skin gratuit
        const isSkinAvailable = (skinId === 'bleu basique' || skinId === 'jaune basique') || user.skins_obtenus.includes(skinId);
        
        if (!isSkinAvailable) {
            return res.status(403).json({ 
                success: false, 
                message: 'Vous n\'avez pas ce skin' 
            });
        }

        // Équiper le skin
        user.active_skin = skinId;
        
        // Sauvegarder les modifications
        fs.writeFileSync(USERS_PATH, JSON.stringify(usersData, null, 2));

        console.log(`[EQUIP] ✅ Skin équipé pour ${username}: ${skinId}`);

        return res.json({ 
            success: true, 
            message: 'Skin équipé avec succès !',
            active_skin: skinId
        });

    } catch (error) {
        console.error('[EQUIP] Erreur lors de l\'équipement du skin:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Erreur serveur lors de l\'équipement du skin' 
        });
    }
});

// --- Logout Route ---
app.post('/api/logout', (req, res) => {
    const { username } = req.body;
    
    if (username) {
        try {
            const rawData = fs.readFileSync(USERS_PATH, 'utf8') || '[]';
            const usersData = JSON.parse(rawData);
            const user = usersData.find(u => u.username.toLowerCase() === username.toLowerCase());
            
            if (user) {
                user.active = false; // On le met en inactif
                fs.writeFileSync(USERS_PATH, JSON.stringify(usersData, null, 2));
                console.log(`[AUTH] Logout réussi pour : ${username} 🗿`);
            }
        } catch (e) {
            console.error("Erreur lors du logout côté serveur :", e);
        }
    }
    
    // On répond que c'est ok pour que le front redirige
    return res.json({ success: true, redirect: '/public/pages/login.html' });
});
app.listen(port, () => {
    console.log(`Le serveur de l'application Sigma tourne sur http://localhost:${port}, gros zinzin !`);
    // Ajout de la date exacte pour que tout soit compréhensible
    console.log(`Date de démarrage : Dimanche 07 décembre 2025.`); 
});

// --- GET : Détails d'un groupe (membres uniquement) ---
app.get('/public/api/community/group-details/:groupId', (req, res) => {
    const { groupId } = req.params;
    const username = (req.query.username || '').trim();

    if (!groupId) return res.status(400).json({ success: false, message: 'groupId requis' });
    if (!username) return res.status(400).json({ success: false, message: 'username requis' });

    try {
        const groupFile = path.join(PUBLIC_API_DIR, 'community', 'groupes', `${groupId}.json`);
        if (!fs.existsSync(groupFile)) {
            return res.status(404).json({ success: false, message: 'Groupe introuvable' });
        }

        const group = JSON.parse(fs.readFileSync(groupFile, 'utf8'));
        const members = Array.isArray(group.members) ? group.members : [];
        if (!members.includes(username)) {
            return res.status(403).json({ success: false, message: 'Accès refusé' });
        }

        const messagesCount = Array.isArray(group.messages) ? group.messages.length : 0;
        return res.json({
            success: true,
            group: {
                id: group.id,
                name: group.name || '',
                description: group.description || '',
                photoUrl: group.photoUrl || '',
                admin: group.admin || null,
                members,
                messagesCount
            }
        });
    } catch (e) {
        console.error('Erreur détails groupe:', e);
        return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// --- PUT : Mettre à jour le nom/description d'un groupe ---
app.put('/public/api/community/group-details/:groupId', express.json(), (req, res) => {
    const { groupId } = req.params;
    const username = (req.body.username || '').trim();
    const name = (typeof req.body.name === 'string') ? req.body.name.trim() : undefined;
    const description = (typeof req.body.description === 'string') ? req.body.description.trim() : undefined;

    if (!groupId) return res.status(400).json({ success: false, message: 'groupId requis' });
    if (!username) return res.status(400).json({ success: false, message: 'username requis' });
    if (name === undefined && description === undefined) {
        return res.status(400).json({ success: false, message: 'Aucune modification fournie' });
    }

    try {
        const groupFile = path.join(PUBLIC_API_DIR, 'community', 'groupes', `${groupId}.json`);
        if (!fs.existsSync(groupFile)) {
            return res.status(404).json({ success: false, message: 'Groupe introuvable' });
        }

        const group = JSON.parse(fs.readFileSync(groupFile, 'utf8'));
        const members = Array.isArray(group.members) ? group.members : [];
        if (!members.includes(username)) {
            return res.status(403).json({ success: false, message: 'Accès refusé' });
        }

        // Nom: modifiable uniquement par le créateur/admin
        if (name !== undefined) {
            if (!group.admin || group.admin !== username) {
                return res.status(403).json({ success: false, message: "Seul le créateur du groupe peut modifier le nom" });
            }
            if (!name) {
                return res.status(400).json({ success: false, message: 'Nom invalide' });
            }
            group.name = name;
        }

        // Description: modifiable par n'importe quel membre
        if (description !== undefined) {
            group.description = description;
        }

        fs.writeFileSync(groupFile, JSON.stringify(group, null, 2));

        // Sync dans global.json (pour la liste)
        const globalPath = path.join(PUBLIC_API_DIR, 'community', 'global.json');
        if (fs.existsSync(globalPath)) {
            const globalData = JSON.parse(fs.readFileSync(globalPath, 'utf8'));
            if (globalData && Array.isArray(globalData.groups)) {
                const idx = globalData.groups.findIndex(g => g && g.id === groupId);
                if (idx !== -1) {
                    globalData.groups[idx] = {
                        ...globalData.groups[idx],
                        name: group.name,
                        description: group.description,
                        photoUrl: group.photoUrl || globalData.groups[idx].photoUrl || ''
                    };
                    fs.writeFileSync(globalPath, JSON.stringify(globalData, null, 2));
                }
            }
        }

        return res.json({ success: true });
    } catch (e) {
        console.error('Erreur update groupe:', e);
        return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// --- GET : Détails d'un sujet (agrégation fills/membres/messages) ---
app.get('/public/api/community/topic-details/:topicId', (req, res) => {
    const { topicId } = req.params;
    const username = (req.query.username || '').trim();

    if (!topicId) return res.status(400).json({ success: false, message: 'topicId requis' });
    if (!username) return res.status(400).json({ success: false, message: 'username requis' });

    try {
        const topicFile = path.join(PUBLIC_API_DIR, 'community', 'sujets', `${topicId}.json`);
        if (!fs.existsSync(topicFile)) {
            return res.status(404).json({ success: false, message: 'Sujet introuvable' });
        }
        const topic = JSON.parse(fs.readFileSync(topicFile, 'utf8'));

        const globalPath = path.join(PUBLIC_API_DIR, 'community', 'global.json');
        let globalData = { groups: [], topics: [], fills: [], mps: [] };
        if (fs.existsSync(globalPath)) {
            globalData = JSON.parse(fs.readFileSync(globalPath, 'utf8'));
        }

        const fillsInTopic = Array.isArray(globalData.fills)
            ? globalData.fills.filter(f => f && f.parentType === 'topic' && f.parentId === topicId)
            : [];

        const membersSet = new Set();
        let totalMessages = 0;

        const fillsDetailed = fillsInTopic.map(f => {
            const fillId = f.id;
            const fillFile = path.join(PUBLIC_API_DIR, 'community', 'fills', `${fillId}.json`);
            let fillData = f;
            if (fs.existsSync(fillFile)) {
                fillData = JSON.parse(fs.readFileSync(fillFile, 'utf8'));
            }
            const fillMembers = Array.isArray(fillData.members) ? fillData.members : [];
            fillMembers.forEach(m => membersSet.add(m));
            const messagesCount = Array.isArray(fillData.messages) ? fillData.messages.length : 0;
            totalMessages += messagesCount;
            return {
                id: fillData.id,
                name: fillData.name || '',
                messagesCount
            };
        });

        return res.json({
            success: true,
            topic: {
                id: topic.id,
                name: topic.name || '',
                description: topic.description || '',
                createdBy: topic.createdBy || '',
                createdAt: topic.createdAt || null,
                duration: topic.duration || null,
                expiresAt: topic.expiresAt || null
            },
            fills: fillsDetailed,
            members: Array.from(membersSet),
            totalMessages
        });
    } catch (e) {
        console.error('Erreur topic details:', e);
        return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// --- POST : Rallonger la durée d'un sujet (créateur uniquement) ---
app.post('/public/api/community/extend-topic', express.json(), (req, res) => {
    const { topicId, username, extraDurationMs } = req.body;
    if (!topicId || !username || !extraDurationMs) {
        return res.status(400).json({ success: false, message: 'Paramètres requis manquants' });
    }

    const allowedExtras = [
        12 * 60 * 60 * 1000,
        24 * 60 * 60 * 1000,
        48 * 60 * 60 * 1000,
        5 * 24 * 60 * 60 * 1000
    ];
    const extra = Number(extraDurationMs);
    if (!allowedExtras.includes(extra)) {
        return res.status(400).json({ success: false, message: 'Durée invalide' });
    }

    // Pricing simple: 5 pts par tranche de 12h
    const block = 12 * 60 * 60 * 1000;
    const blocks = Math.max(1, Math.round(extra / block));
    const cost = blocks * 5;

    if (!checkPointsForAction(username, cost)) {
        return res.status(400).json({ success: false, message: `Pas assez de points pour rallonger (-${cost} points requis)` });
    }

    try {
        const topicFile = path.join(PUBLIC_API_DIR, 'community', 'sujets', `${topicId}.json`);
        if (!fs.existsSync(topicFile)) {
            return res.status(404).json({ success: false, message: 'Sujet introuvable' });
        }

        const topic = JSON.parse(fs.readFileSync(topicFile, 'utf8'));
        if (!topic.createdBy || topic.createdBy !== username) {
            return res.status(403).json({ success: false, message: 'Seul le créateur peut rallonger la durée' });
        }

        const now = Date.now();
        const currentExpires = topic.expiresAt ? Date.parse(topic.expiresAt) : now;
        const base = Number.isFinite(currentExpires) ? Math.max(currentExpires, now) : now;
        const newExpires = new Date(base + extra).toISOString();

        topic.expiresAt = newExpires;
        topic.duration = Number(topic.duration || 0) + extra;
        fs.writeFileSync(topicFile, JSON.stringify(topic, null, 2));

        // Sync global.json
        const globalPath = path.join(PUBLIC_API_DIR, 'community', 'global.json');
        if (fs.existsSync(globalPath)) {
            const globalData = JSON.parse(fs.readFileSync(globalPath, 'utf8'));
            if (globalData && Array.isArray(globalData.topics)) {
                const idx = globalData.topics.findIndex(t => t && t.id === topicId);
                if (idx !== -1) {
                    globalData.topics[idx] = {
                        ...globalData.topics[idx],
                        expiresAt: topic.expiresAt,
                        duration: topic.duration
                    };
                    fs.writeFileSync(globalPath, JSON.stringify(globalData, null, 2));
                }
            }
        }

        deductPoints(username, cost);
        return res.json({ success: true, expiresAt: topic.expiresAt, duration: topic.duration, cost });
    } catch (e) {
        console.error('Erreur extend topic:', e);
        return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// --- GET : Détails d'un fill (membres uniquement) ---
app.get('/public/api/community/fill-details/:fillId', (req, res) => {
    const { fillId } = req.params;
    const username = (req.query.username || '').trim();

    if (!fillId) return res.status(400).json({ success: false, message: 'fillId requis' });
    if (!username) return res.status(400).json({ success: false, message: 'username requis' });

    try {
        const fillFile = path.join(PUBLIC_API_DIR, 'community', 'fills', `${fillId}.json`);
        if (!fs.existsSync(fillFile)) {
            return res.status(404).json({ success: false, message: 'Fill introuvable' });
        }

        const fill = JSON.parse(fs.readFileSync(fillFile, 'utf8'));
        const members = Array.isArray(fill.members) ? fill.members : [];
        const isMember = members.includes(username);

        const messagesCount = Array.isArray(fill.messages) ? fill.messages.length : 0;
        return res.json({
            success: true,
            fill: {
                id: fill.id,
                name: fill.name || '',
                description: fill.description || '',
                parentType: fill.parentType || '',
                parentId: fill.parentId || '',
                createdBy: fill.createdBy || '',
                admin: fill.admin || fill.createdBy || '',
                createdAt: fill.createdAt || null,
                duration: fill.duration || null,
                expiresAt: fill.expiresAt || null,
                members,
                messagesCount,
                isMember
            }
        });
    } catch (e) {
        console.error('Erreur détails fill:', e);
        return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// --- POST : Supprimer un groupe (créateur ou ADMIN) ---
app.post('/public/api/community/delete-group', express.json(), (req, res) => {
    const groupId = (req.body.groupId || '').trim();
    const username = (req.body.username || '').trim();

    if (!groupId || !username) {
        return res.status(400).json({ success: false, message: 'groupId et username requis' });
    }
    if (groupId === 'classe3c') {
        return res.status(400).json({ success: false, message: 'Impossible de supprimer ce groupe' });
    }

    try {
        // Autorisation: ADMIN ou créateur du groupe (admin)
        const groupFileForAuth = path.join(PUBLIC_API_DIR, 'community', 'groupes', `${groupId}.json`);
        if (!fs.existsSync(groupFileForAuth)) {
            return res.status(404).json({ success: false, message: 'Groupe introuvable' });
        }
        const groupForAuth = JSON.parse(fs.readFileSync(groupFileForAuth, 'utf8'));
        const groupCreator = (groupForAuth.admin || '').trim();
        if (username !== 'ADMIN' && username !== groupCreator) {
            return res.status(403).json({ success: false, message: 'Accès refusé' });
        }

        const globalPath = path.join(PUBLIC_API_DIR, 'community', 'global.json');
        if (!fs.existsSync(globalPath)) {
            return res.status(404).json({ success: false, message: 'Données non trouvées' });
        }
        const globalData = JSON.parse(fs.readFileSync(globalPath, 'utf8'));

        const beforeGroups = Array.isArray(globalData.groups) ? globalData.groups.length : 0;
        globalData.groups = Array.isArray(globalData.groups) ? globalData.groups.filter(g => g && g.id !== groupId) : [];
        const deletedGroups = beforeGroups - globalData.groups.length;
        if (deletedGroups <= 0) {
            return res.status(404).json({ success: false, message: 'Groupe introuvable' });
        }

        // Cascade: supprimer fills rattachés au groupe (évite les orphelins)
        const fillsToDelete = Array.isArray(globalData.fills)
            ? globalData.fills.filter(f => f && f.parentType === 'group' && f.parentId === groupId)
            : [];

        globalData.fills = Array.isArray(globalData.fills)
            ? globalData.fills.filter(f => !(f && f.parentType === 'group' && f.parentId === groupId))
            : [];

        // Supprimer le fichier du groupe
        fs.unlinkSync(groupFileForAuth);

        // Supprimer les fichiers des fills rattachés
        let deletedFillFiles = 0;
        fillsToDelete.forEach(f => {
            const fillFile = path.join(PUBLIC_API_DIR, 'community', 'fills', `${f.id}.json`);
            if (fs.existsSync(fillFile)) {
                fs.unlinkSync(fillFile);
                deletedFillFiles++;
            }
        });

        fs.writeFileSync(globalPath, JSON.stringify(globalData, null, 2));

        return res.json({
            success: true,
            deletedGroup: groupId,
            deletedFills: fillsToDelete.map(f => f.id),
            deletedFillFiles
        });
    } catch (e) {
        console.error('Erreur suppression groupe:', e);
        return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// --- POST : Supprimer un sujet (créateur ou ADMIN) + cascade fills ---
app.post('/public/api/community/delete-topic', express.json(), (req, res) => {
    const topicId = (req.body.topicId || '').trim();
    const username = (req.body.username || '').trim();

    if (!topicId || !username) {
        return res.status(400).json({ success: false, message: 'topicId et username requis' });
    }
    try {
        // Autorisation: ADMIN ou créateur du sujet
        const topicFileForAuth = path.join(PUBLIC_API_DIR, 'community', 'sujets', `${topicId}.json`);
        if (!fs.existsSync(topicFileForAuth)) {
            return res.status(404).json({ success: false, message: 'Sujet introuvable' });
        }
        const topicForAuth = JSON.parse(fs.readFileSync(topicFileForAuth, 'utf8'));
        const topicCreator = (topicForAuth.createdBy || '').trim();
        if (username !== 'ADMIN' && username !== topicCreator) {
            return res.status(403).json({ success: false, message: 'Accès refusé' });
        }

        const globalPath = path.join(PUBLIC_API_DIR, 'community', 'global.json');
        if (!fs.existsSync(globalPath)) {
            return res.status(404).json({ success: false, message: 'Données non trouvées' });
        }
        const globalData = JSON.parse(fs.readFileSync(globalPath, 'utf8'));

        const beforeTopics = Array.isArray(globalData.topics) ? globalData.topics.length : 0;
        globalData.topics = Array.isArray(globalData.topics) ? globalData.topics.filter(t => t && t.id !== topicId) : [];
        const deletedTopics = beforeTopics - globalData.topics.length;
        if (deletedTopics <= 0) {
            return res.status(404).json({ success: false, message: 'Sujet introuvable' });
        }

        // Cascade: supprimer fills rattachés au sujet
        const fillsToDelete = Array.isArray(globalData.fills)
            ? globalData.fills.filter(f => f && f.parentType === 'topic' && f.parentId === topicId)
            : [];

        globalData.fills = Array.isArray(globalData.fills)
            ? globalData.fills.filter(f => !(f && f.parentType === 'topic' && f.parentId === topicId))
            : [];

        // Supprimer le fichier du sujet
        fs.unlinkSync(topicFileForAuth);

        // Supprimer les fichiers des fills rattachés
        let deletedFillFiles = 0;
        fillsToDelete.forEach(f => {
            const fillFile = path.join(PUBLIC_API_DIR, 'community', 'fills', `${f.id}.json`);
            if (fs.existsSync(fillFile)) {
                fs.unlinkSync(fillFile);
                deletedFillFiles++;
            }
        });

        fs.writeFileSync(globalPath, JSON.stringify(globalData, null, 2));

        return res.json({
            success: true,
            deletedTopic: topicId,
            deletedFills: fillsToDelete.map(f => f.id),
            deletedFillFiles
        });
    } catch (e) {
        console.error('Erreur suppression sujet:', e);
        return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// --- POST : Supprimer un fill (créateur ou ADMIN) ---
app.post('/public/api/community/delete-fill', express.json(), (req, res) => {
    const fillId = (req.body.fillId || '').trim();
    const username = (req.body.username || '').trim();

    if (!fillId || !username) {
        return res.status(400).json({ success: false, message: 'fillId et username requis' });
    }
    try {
        // Autorisation: ADMIN ou créateur du fill
        const fillFileForAuth = path.join(PUBLIC_API_DIR, 'community', 'fills', `${fillId}.json`);
        if (!fs.existsSync(fillFileForAuth)) {
            return res.status(404).json({ success: false, message: 'Fill introuvable' });
        }
        const fillForAuth = JSON.parse(fs.readFileSync(fillFileForAuth, 'utf8'));
        const fillCreator = (fillForAuth.createdBy || '').trim();
        const fillAdmin = (fillForAuth.admin || fillForAuth.createdBy || '').trim();
        if (username !== 'ADMIN' && username !== fillCreator && username !== fillAdmin) {
            return res.status(403).json({ success: false, message: 'Accès refusé' });
        }

        const globalPath = path.join(PUBLIC_API_DIR, 'community', 'global.json');
        if (!fs.existsSync(globalPath)) {
            return res.status(404).json({ success: false, message: 'Données non trouvées' });
        }
        const globalData = JSON.parse(fs.readFileSync(globalPath, 'utf8'));

        const beforeFills = Array.isArray(globalData.fills) ? globalData.fills.length : 0;
        globalData.fills = Array.isArray(globalData.fills) ? globalData.fills.filter(f => f && f.id !== fillId) : [];
        const deletedFills = beforeFills - globalData.fills.length;
        if (deletedFills <= 0) {
            return res.status(404).json({ success: false, message: 'Fill introuvable' });
        }

        fs.unlinkSync(fillFileForAuth);

        fs.writeFileSync(globalPath, JSON.stringify(globalData, null, 2));
        return res.json({ success: true, deletedFill: fillId });
    } catch (e) {
        console.error('Erreur suppression fill:', e);
        return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// --- POST : Mettre à jour la photo (icône) d'un groupe (membre du groupe) ---
app.post('/public/api/community/group-photo/:groupId', uploadCommunity.single('photo'), (req, res) => {
    const { groupId } = req.params;
    const username = (req.body.username || '').trim();

    if (!groupId) return res.status(400).json({ success: false, message: 'groupId requis' });
    if (!username) return res.status(400).json({ success: false, message: 'username requis' });
    if (!req.file) return res.status(400).json({ success: false, message: 'photo requise' });

    try {
        const groupFile = path.join(PUBLIC_API_DIR, 'community', 'groupes', `${groupId}.json`);
        if (!fs.existsSync(groupFile)) {
            return res.status(404).json({ success: false, message: 'Groupe introuvable' });
        }

        const group = JSON.parse(fs.readFileSync(groupFile, 'utf8'));
        const members = Array.isArray(group.members) ? group.members : [];
        if (!members.includes(username)) {
            return res.status(403).json({ success: false, message: 'Accès refusé' });
        }

        const photoUrl = `/pictures_documents/${req.file.filename}`;
        group.photoUrl = photoUrl;
        fs.writeFileSync(groupFile, JSON.stringify(group, null, 2));

        // Sync dans global.json (pour la liste)
        const globalPath = path.join(PUBLIC_API_DIR, 'community', 'global.json');
        if (fs.existsSync(globalPath)) {
            const globalData = JSON.parse(fs.readFileSync(globalPath, 'utf8'));
            if (globalData && Array.isArray(globalData.groups)) {
                const idx = globalData.groups.findIndex(g => g && g.id === groupId);
                if (idx !== -1) {
                    globalData.groups[idx] = {
                        ...globalData.groups[idx],
                        photoUrl
                    };
                    fs.writeFileSync(globalPath, JSON.stringify(globalData, null, 2));
                }
            }
        }

        return res.json({ success: true, photoUrl });
    } catch (e) {
        console.error('Erreur update photo groupe:', e);
        return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// Admin: reset global ED state (memory only)
// Protégé via token (env: ADMIN_RESET_TOKEN). Si absent, route désactivée.
app.post('/api/admin/ed-reset', express.json(), (req, res) => {
    const expected = String(process.env.ADMIN_RESET_TOKEN || '').trim();
    if (!expected) return res.status(404).json({ success: false, error: 'disabled' });
    const provided = String((req.get && req.get('x-admin-token')) || (req.body && req.body.token) || '').trim();
    if (!provided || provided !== expected) return res.status(403).json({ success: false, error: 'forbidden' });
    resetAllEdState();
    return res.json({ success: true });
});