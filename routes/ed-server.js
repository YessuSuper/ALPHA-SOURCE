'use strict';
const express = require('express');
const router = express.Router();
const path = require('path');
const { fsPromises, path: sharedPath, PUBLIC_API_DIR, MDPED_PATH, normalizeUsername } = require('./shared');
const EcoleDirecteAPI = require('../API ED/ecoledirecte-api');

// =====================================================================
//  ED State Management
// =====================================================================
const edStateByUser = new Map(); // key -> { api, lastError }
const MAX_ED_STATE_USERS = 100;

function getEdUserKeyFromReq(req) {
    try {
        const fromHeader = (req.get && (req.get('x-source-user') || req.get('x-alpha-user'))) || '';
        const fromQuery = (req.query && (req.query.username || req.query.user)) || '';
        const fromBody = (req.body && (req.body.username || req.body.user)) || '';
        const raw = String(fromHeader || fromQuery || fromBody || '').trim();
        const normalized = normalizeUsername(raw).toLowerCase();
        if (normalized) return normalized;
    } catch { }
    // Pas de fallback IP: sinon deux comptes du mÃªme navigateur/foyer se partagent la session ED.
    return '';
}

function getEdState(userKey) {
    if (!edStateByUser.has(userKey)) {
        // Evict oldest user if too many
        if (edStateByUser.size >= MAX_ED_STATE_USERS) {
            const firstKey = edStateByUser.keys().next().value;
            if (firstKey) edStateByUser.delete(firstKey);
        }
        edStateByUser.set(userKey, { api: null, lastError: null });
    }
    return edStateByUser.get(userKey);
}

function clearEdStateForUser(userKey) {
    edStateByUser.delete(userKey);
}

function resetAllEdState() {
    try { edStateByUser.clear(); } catch { }
    try { cahierDeTexteCacheByUser.clear(); } catch { }
}

// Cache cahier de texte (par date) pour accÃ©lÃ©rer /ed/devoirs
const CAHIER_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_ENTRIES_PER_USER = 30;
const MAX_CACHED_USERS = 50;
const cahierDeTexteCacheByUser = new Map(); // key: userKey -> Map(ymd -> { ts:number, data:any })

function getUserCahierCache(userKey) {
    if (!cahierDeTexteCacheByUser.has(userKey)) cahierDeTexteCacheByUser.set(userKey, new Map());
    return cahierDeTexteCacheByUser.get(userKey);
}

function clearUserCahierCache(userKey) {
    try { cahierDeTexteCacheByUser.delete(userKey); } catch { }
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
    // Evict oldest entry if cache full
    if (cache.size >= MAX_CACHE_ENTRIES_PER_USER) {
        let oldestKey = null, oldestTs = Infinity;
        for (const [k, v] of cache) {
            if (v.ts < oldestTs) { oldestTs = v.ts; oldestKey = k; }
        }
        if (oldestKey) cache.delete(oldestKey);
    }
    // Evict oldest user if too many users
    if (cahierDeTexteCacheByUser.size > MAX_CACHED_USERS && !cahierDeTexteCacheByUser.has(userKey)) {
        const firstKey = cahierDeTexteCacheByUser.keys().next().value;
        if (firstKey) cahierDeTexteCacheByUser.delete(firstKey);
    }
    cache.set(ymd, { ts: Date.now(), data });
}

// =====================================================================
//  Utility helpers
// =====================================================================
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

function toYmd(d) { return d.toISOString().slice(0, 10); }
function parseYmdToUtcDate(s) { return new Date(s + 'T00:00:00.000Z'); }
function isYmd(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }
function decodeB64ToUtf8(b64) { try { return Buffer.from(String(b64 || ''), 'base64').toString('utf-8'); } catch { return ''; } }
function truthy(v) { if (v === true) return true; if (!v) return false; const s = String(v).trim().toLowerCase(); return ['true', '1', 'oui', 'o', 'y', 'yes'].includes(s) || (!!v); }

function stripHtmlToText(html) {
    const s = String(html || '');
    const noTags = s.replace(/<[^>]*>/g, ' ');
    return noTags.replace(/\s+/g, ' ').trim();
}

function extractTitleFromHtml(html) {
    const text = stripHtmlToText(html);
    if (!text) return '';
    // "Titre" = premiÃ¨re phrase/ligne courte
    const first = text.split(/\s*\n\s*|\s*\r\s*/).filter(Boolean)[0] || text;
    return first.length > 120 ? first.slice(0, 117) + '...' : first;
}

// =====================================================================
//  Config ED (mdped.json)
// =====================================================================
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
    } catch { }
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
            // Rafraîchir les données détaillées (notes, EDT, devoirs)
            setImmediate(() => saveUserData(account, state.api).catch(e => console.warn('[ED] Refresh données échoué:', e.message)));
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

// =====================================================================
//  saveUserData helper
// =====================================================================
async function saveUserData(account, api) {
    if (!api) return;

    try {
        console.log(`ðŸ’¾ Sauvegarde des donnÃ©es dÃ©taillÃ©es pour ${account.prenom} ${account.nom}...`);

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

        // 3. Devoirs (Global + enrichissement dÃ©taillÃ© si vide)
        let homeworkData = [];
        try {
            // Utilisation de la nouvelle mÃ©thode globale
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

                                // Flag pour enrichir plus tard si contenu vide ou boolÃ©en
                                if (!hasContent) missingContentDates.add(date);

                                homeworkData.push({
                                    date: date,
                                    idDevoir: item.idDevoir,
                                    matiere: item.matiere || item.codeMatiere || 'MatiÃ¨re inconnue',
                                    aFaire: {
                                        effectue: !!effectueFlag,
                                        contenu: hasContent ? item.aFaire.contenu : undefined,
                                        contenuDecoded: decodedContent || '[Aucun dÃ©tail fourni]',
                                        donneLe: item.donneLe || undefined
                                    },
                                    interrogation: item.interrogation || false
                                });
                            }
                        }
                    }
                }
            }

            // Enrichissement: si certains devoirs n'ont pas de contenu, on va chercher le dÃ©tail de la journÃ©e concernÃ©e
            if (missingContentDates.size > 0) {
                const datesToFetch = Array.from(missingContentDates).slice(0, 10); // sÃ©curitÃ©
                for (const ymd of datesToFetch) {
                    try {
                        const detailedDay = await api.getCahierDeTexte(ymd);
                        const matieres = (detailedDay && Array.isArray(detailedDay.matieres)) ? detailedDay.matieres : [];
                        for (const m of matieres) {
                            const af = m && m.aFaire ? m.aFaire : null;
                            if (!af) continue;
                            const decoded = decodeB64ToUtf8(af.contenu);
                            // Match par idDevoir si prÃ©sent, sinon par matiÃ¨re/date
                            const candidate = homeworkData.find(h => h.date === ymd && ((h.idDevoir && af.idDevoir && h.idDevoir === af.idDevoir) || (!h.idDevoir && h.matiere === (m.matiere || h.matiere))));
                            if (candidate) {
                                candidate.aFaire.contenu = af.contenu || candidate.aFaire.contenu;
                                candidate.aFaire.contenuDecoded = decoded || candidate.aFaire.contenuDecoded;
                                candidate.aFaire.effectue = (typeof af.effectue === 'boolean') ? af.effectue : candidate.aFaire.effectue;
                            }
                        }
                    } catch (enrichErr) {
                        console.warn('Enrichissement devoirs Ã©chouÃ© pour', ymd, enrichErr.message);
                    }
                }
            }

            // Tri par date
            homeworkData.sort((a, b) => a.date.localeCompare(b.date));

        } catch (e) {
            console.error('Erreur sauvegarde Devoirs (Global):', e.message);
            // Fallback: Si l'endpoint global Ã©choue, on garde l'ancienne mÃ©thode (mais rÃ©duite Ã  7 jours pour pas bloquer)
            try {
                console.log('âš ï¸ Fallback sur la mÃ©thode itÃ©rative (7 jours)...');
                const start = new Date();
                const days = 7;
                const dates = Array.from({ length: days }, (_, i) => {
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
                    if (entry.data && entry.data.matieres) {
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
        console.log('âœ… DonnÃ©es dÃ©taillÃ©es sauvegardÃ©es dans users_detailed_data.json');

    } catch (e) {
        console.error('âŒ Erreur globale sauvegarde donnÃ©es utilisateur:', e.message);
    }
}

// =====================================================================
//  Routes
// =====================================================================

// Ping lÃ©ger pour Ã©viter d'appeler /ed/notes juste pour tester la session
router.get('/ed/ping', async (req, res) => {
    const userKey = getEdUserKeyFromReq(req);
    if (!userKey) return res.status(401).json({ ok: false, error: 'Not authenticated' });
    const ok = await ensureEdConnected(userKey);
    const state = getEdState(userKey);
    if (!ok) return res.status(401).json({ ok: false, error: state.lastError || 'Not connected' });
    return res.json({ ok: true });
});

// POST /ed/login
router.post('/ed/login', express.json(), async (req, res) => {
    try {
        const userKey = getEdUserKeyFromReq(req);
        if (!userKey) {
            return res.status(400).json({ success: false, error: 'username AlphaSource requis' });
        }
        const identifiant = (req.body && typeof req.body.identifiant === 'string') ? req.body.identifiant.trim() : '';
        const motdepasse = (req.body && typeof req.body.motdepasse === 'string') ? req.body.motdepasse : '';
        if (!identifiant || !motdepasse) {
            return res.status(400).json({ success: false, error: 'identifiant et motdepasse requis' });
        }

        const state = getEdState(userKey);
        state.api = new EcoleDirecteAPI(identifiant, motdepasse);
        const account = await state.api.login();
        if (account && account.requireQCM) {
            state.lastError = 'QCM required';
            state.api = null;
            return res.status(200).json({ success: false, requireQCM: true, message: 'QCM required - manual input needed' });
        }
        const safeClasse = account?.profile?.classe?.libelle || account?.classe?.libelle || account?.classe || '-';

        // Sauvegarde des donnÃ©es complÃ¨tes (Notes, EDT, Devoirs)
        await saveUserData(account, state.api);

        state.lastError = null;

        // Enregistrer automatiquement les identifiants ED pour cet utilisateur AlphaSource
        try {
            const usernameForStore = (req.body && typeof req.body.username === 'string' && req.body.username.trim()) ? req.body.username.trim() : (account && (account.prenom || account.identifiant) ? String(account.prenom || account.identifiant) : '');
            const store = await readMdpedConfig();
            const safeStore = (store && typeof store === 'object') ? store : {};
            const userKeyToStore = getEdUserKeyFromReq(req) || normalizeUsername(usernameForStore).toLowerCase() || '';
            if (userKeyToStore) {
                safeStore[userKeyToStore] = {
                    username: usernameForStore || userKeyToStore,
                    id: identifiant,
                    mdp: motdepasse,
                    accountId: account && account.id ? String(account.id) : ''
                };
                await fsPromises.mkdir(path.dirname(MDPED_PATH), { recursive: true });
                await fsPromises.writeFile(MDPED_PATH, JSON.stringify(safeStore, null, 2), 'utf-8');
                console.log('[ED LOGIN] Identifiants enregistrÃ©s pour', userKeyToStore);
            }
        } catch (e) {
            console.warn('[ED LOGIN] Impossible d\'enregistrer mdped.json:', e.message);
        }

        return res.json({
            success: true, account: {
                id: account.id,
                identifiant: account.identifiant,
                prenom: account.prenom,
                nom: account.nom,
                email: account.email,
                nomEtablissement: account.nomEtablissement,
                classe: safeClasse,
                anneeScolaireCourante: account.anneeScolaireCourante
            }
        });
    } catch (e) {
        const userKey = getEdUserKeyFromReq(req);
        const state = getEdState(userKey);
        state.lastError = e.message;
        state.api = null;
        return res.status(401).json({ success: false, error: e.message });
    }
});

// GET /ed/logout
router.get('/ed/logout', async (req, res) => {
    const userKey = getEdUserKeyFromReq(req);
    if (!userKey) return res.status(401).json({ success: false, error: 'Not authenticated' });
    const state = getEdState(userKey);

    // DÃ©terminer l'accountId ED de cet utilisateur (si connu)
    let accountId = '';
    try {
        accountId = String(state?.api?.account?.id || '');
    } catch { }
    if (!accountId) {
        try {
            const store = await readMdpedConfig();
            const cfg = store && store[userKey] ? store[userKey] : null;
            accountId = String((cfg && (cfg.accountId || cfg.edAccountId)) || '');
        } catch { }
    }

    // 1) Supprime uniquement les donnÃ©es dÃ©taillÃ©es de CET utilisateur
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
                console.log('[ED LOGOUT] DonnÃ©es Ã©lÃ¨ve supprimÃ©es pour accountId:', accountId);
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
            console.log('[ED LOGOUT] Identifiants supprimÃ©s pour userKey:', userKey);
        }
    } catch (e) {
        console.warn('[ED LOGOUT] Impossible de mettre Ã  jour mdped.json:', e.message);
    }

    // 3) Ã‰tat mÃ©moire + cache (uniquement cet utilisateur)
    clearUserCahierCache(userKey);
    clearEdStateForUser(userKey);
    res.json({ success: true });
});

/**
 * GET /ed/messages
 * RÃ©cupÃ¨re les messages (messagerie) en lecture seule.
 */
router.get('/ed/messages', async (req, res) => {
    const userKey = getEdUserKeyFromReq(req);
    const connected = await ensureEdConnected(userKey);
    const state = getEdState(userKey);
    if (!connected || !state.api) {
        return res.status(401).json({ error: state.lastError || 'Not connected' });
    }

    try {
        const apiInstance = state.api;
        function defaultAnneeMessages() {
            const v = apiInstance.account && apiInstance.account.anneeScolaireCourante;
            if (typeof v === 'string' && /^\d{4}-\d{4}$/.test(v)) return v;
            const d = new Date();
            const y = d.getFullYear();
            const m = d.getMonth() + 1;
            const start = (m >= 9) ? y : (y - 1);
            return String(start) + '-' + String(start + 1);
        }

        const annee = (typeof req.query.anneeMessages === 'string' && req.query.anneeMessages.trim())
            ? req.query.anneeMessages.trim()
            : defaultAnneeMessages();

        const mode = (typeof req.query.mode === 'string' && req.query.mode.trim()) ? req.query.mode.trim() : 'all';

        function pickList(data) {
            if (!data) return [];
            if (Array.isArray(data)) return data;
            const keys = ['messages', 'items', 'received', 'sent', 'mails', 'listeMessages', 'liste', 'boiteReception', 'boiteEnvoi'];
            for (const k of keys) { if (data && Array.isArray(data[k])) return data[k]; }
            const nested = ['data', 'messages', 'result', 'payload'];
            for (const nk of nested) {
                if (data && data[nk] && data[nk] !== data) {
                    const found = pickList(data[nk]);
                    if (found && found.length) return found;
                }
            }
            if (data && data.messages && typeof data.messages === 'object') {
                const candidates = ['destinataire', 'expediteur', 'inbox', 'outbox'];
                for (const c of candidates) { if (Array.isArray(data.messages[c])) return data.messages[c]; }
            }
            return [];
        }

        async function fetchMode(oneMode) {
            try {
                const listData = await apiInstance.getMessagesList(oneMode, annee);
                const list = pickList(listData);
                const ids = [];
                for (const m of list) {
                    const id = parseInt(m.id || m.idMessage || m.messageId, 10);
                    if (!isNaN(id) && isFinite(id) && id > 0) {
                        ids.push({ id, mode: oneMode, summary: m });
                    }
                }
                return ids;
            } catch (e) {
                console.warn(`[ED] Fetch mode ${oneMode} failed:`, e.message);
                return [];
            }
        }

        let targets = [];
        if (mode === 'destinataire' || mode === 'expediteur') {
            targets = await fetchMode(mode);
        } else {
            const both = await Promise.all([fetchMode('destinataire'), fetchMode('expediteur')]);
            targets = (both[0] || []).concat(both[1] || []);
        }

        const seen = new Set();
        const unique = [];
        for (const t of targets) {
            if (seen.has(t.id)) continue;
            seen.add(t.id);
            unique.push(t);
        }

        const detailed = await mapWithConcurrency(unique, 4, async (t) => {
            try {
                const detail = await apiInstance.getMessageById(t.id, t.mode, annee);
                const merged = Object.assign({}, t.summary || {}, detail || {});
                merged._mode = t.mode;
                merged.id = merged.id || t.id;
                return merged;
            } catch (e) {
                return { ...t.summary, id: t.id, _mode: t.mode, _error: e.message };
            }
        });

        detailed.sort((a, b) => {
            const da = String((a && (a.date || a.dateCreation || a.dateEnvoi || a.dateReception)) || '');
            const db = String((b && (b.date || b.dateCreation || b.dateEnvoi || b.dateReception)) || '');
            if (da < db) return 1;
            if (da > db) return -1;
            return 0;
        });

        res.json({
            annee: annee,
            mode: mode,
            count: detailed.length,
            messages: detailed
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /ed/messages/:idMessage/files/:idFile
 * Proxy de tÃ©lÃ©chargement des piÃ¨ces jointes.
 */
router.get('/ed/messages/:idMessage/files/:idFile', async (req, res) => {
    const userKey = getEdUserKeyFromReq(req);
    const connected = await ensureEdConnected(userKey);
    const state = getEdState(userKey);
    if (!connected || !state.api) {
        return res.status(401).json({ error: state.lastError || 'Not connected' });
    }

    try {
        const idMessage = parseInt(req.params.idMessage, 10);
        const idFile = parseInt(req.params.idFile, 10);
        const annee = (typeof req.query.annee === 'string') ? req.query.annee : '';
        const mode = 'destinataire';

        const r = await state.api.downloadMessageAttachment(idMessage, idFile, mode, annee);

        const ct = (r.headers && (r.headers['content-type'] || r.headers['Content-Type'])) || 'application/octet-stream';
        res.setHeader('Content-Type', ct);

        const filename = req.query.name || ('piece-jointe-' + idFile);
        const safeName = String(filename).replace(/[\r\n\\]/g, '_');
        res.setHeader('Content-Disposition', 'attachment; filename="' + safeName + '"');

        if (r.headers && r.headers['content-length']) {
            res.setHeader('Content-Length', r.headers['content-length']);
        }

        res.status(200).send(r.buffer);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /ed/periodes - retourne la liste des pÃ©riodes disponibles
router.get('/ed/periodes', async (req, res) => {
    const userKey = getEdUserKeyFromReq(req);
    if (!userKey) return res.status(401).json({ error: 'Not authenticated' });
    const state = getEdState(userKey);
    if (!state.api) {
        const ok = await ensureEdConnected(userKey);
        if (!ok) return res.status(401).json({ error: 'Not connected' });
    }
    try {
        const notes = await state.api.getNotes('');
        // Les pÃ©riodes sont dans la rÃ©ponse de notes
        const periodes = notes.periodes || [];
        res.json(periodes);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /ed/notes?anneeScolaire=<id>
router.get('/ed/notes', async (req, res) => {
    const userKey = getEdUserKeyFromReq(req);
    if (!userKey) return res.status(401).json({ error: 'Not authenticated' });
    const state = getEdState(userKey);
    if (!state.api) {
        const ok = await ensureEdConnected(userKey);
        if (!ok) return res.status(401).json({ error: 'Not connected' });
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
router.get('/ed/devoirs', async (req, res) => {
    const userKey = getEdUserKeyFromReq(req);
    if (!userKey) return res.status(401).json({ error: 'Not authenticated' });
    const state = getEdState(userKey);
    if (!state.api) {
        const ok = await ensureEdConnected(userKey);
        if (!ok) return res.status(401).json({ error: 'Not connected' });
    }
    try {
        const today = new Date();
        const defaultStart = toYmd(today);
        const defaultEnd = toYmd(new Date(today.getTime() + 30 * 86400000)); // 30 jours au lieu de 14
        const start = isYmd(req.query.start) ? req.query.start : defaultStart;
        const end = isYmd(req.query.end) ? req.query.end : defaultEnd;
        const startDate = parseYmdToUtcDate(start);
        const endDate = parseYmdToUtcDate(end);
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return res.status(400).json({ error: 'Invalid date value' });
        if (startDate.getTime() > endDate.getTime()) return res.status(400).json({ error: 'start must be <= end' });
        const days = Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
        if (days > 62) return res.status(400).json({ error: 'Date range too large (max 62 days)' });

        const dates = Array.from({ length: days }, (_, i) => toYmd(new Date(startDate.getTime() + i * 86400000)));

        // RÃ©cupÃ¨re les cahiers en parallÃ¨le (avec limite) + cache court
        const cahiers = await mapWithConcurrency(dates, 4, async (ymd) => {
            const cached = getCachedCahierDeTexte(userKey, ymd);
            if (cached) return { ymd, data: cached };
            try {
                const data = await state.api.getCahierDeTexte(ymd);
                setCachedCahierDeTexte(userKey, ymd, data);
                return { ymd, data };
            } catch (e) {
                // Ne bloque pas toute la plage si une journÃ©e Ã©choue
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
                    matiere: m.matiere || m.discipline || m.libelle || 'MatiÃ¨re',
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
router.get('/ed/edt', async (req, res) => {
    const userKey = getEdUserKeyFromReq(req);
    if (!userKey) return res.status(401).json({ error: 'Not authenticated' });
    const state = getEdState(userKey);
    // Helper pour tenter l'appel API avec retry sur erreur auth
    const tryGetEdt = async (forceLogin = false) => {
        if (forceLogin || !state.api) {
            const ok = await ensureEdConnected(userKey);
            if (!ok) throw new Error('Not connected');
        }
        const today = new Date();
        const defaultStart = toYmd(today);
        const defaultEnd = toYmd(new Date(today.getTime() + 7 * 86400000));

        const start = isYmd(req.query.start) ? req.query.start : defaultStart;
        const end = isYmd(req.query.end) ? req.query.end : defaultEnd;

        return await state.api.getEmploiDuTemps(start, end);
    };

    try {
        const edt = await tryGetEdt(false);
        res.json(edt);
    } catch (err) {
        console.error("ED EDT Error (first attempt):", err.message);
        // Si erreur d'auth ou token invalide, on retente une fois avec login forcÃ©
        if (err.message.includes('Code 520') || err.message.includes('Code 403') || err.message.includes('Code 401') || err.message.includes('Non connectÃ©')) {
            console.log("ðŸ”„ Tentative de reconnexion ED pour EDT...");
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
router.post('/ed/devoirs/effectue', express.json(), async (req, res) => {
    const userKey = getEdUserKeyFromReq(req);
    if (!userKey) return res.status(401).json({ error: 'Not authenticated' });
    const state = getEdState(userKey);
    if (!state.api) {
        const ok = await ensureEdConnected(userKey);
        if (!ok) return res.status(401).json({ error: 'Not connected' });
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
        // Forme avancÃ©e : { idDevoirsEffectues: [], idDevoirsNonEffectues: [] }
        else if (body.idDevoirsEffectues !== undefined || body.idDevoirsNonEffectues !== undefined) {
            idDevoirsEffectues = Array.isArray(body.idDevoirsEffectues) ? body.idDevoirsEffectues : [];
            idDevoirsNonEffectues = Array.isArray(body.idDevoirsNonEffectues) ? body.idDevoirsNonEffectues : [];
        } else {
            return res.status(400).json({ error: 'Invalid body format' });
        }

        // Appel Ã  l'API ED pour mettre Ã  jour
        const result = await state.api.setDevoirsEffectues(idDevoirsEffectues, idDevoirsNonEffectues);

        // Invalide le cache cahier de texte (l'Ã©tat effectue a changÃ© cÃ´tÃ© ED)
        try { clearUserCahierCache(userKey); } catch { }
        res.json({ success: true, result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /ed/devoir/download/:idDevoir/:fileId
// TÃ©lÃ©charge une piÃ¨ce jointe d'un devoir via l'API ED
router.get('/ed/devoir/download/:idDevoir/:fileId', async (req, res) => {
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

        // Les piÃ¨ces jointes des devoirs utilisent le mÃªme systÃ¨me que les messages
        // On utilise downloadMessageAttachment en passant l'idDevoir comme idMessage
        // et en utilisant le mode 'TRAVAIL'
        const result = await state.api.downloadMessageAttachment(devoirId, fId, 'TRAVAIL', '');

        if (!result || !result.buffer || result.buffer.length === 0) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Envoie le fichier avec le header appropriÃ©
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
router.get('/api/mdped', async (req, res) => {
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
router.post('/api/mdped', express.json(), async (req, res) => {
    try {
        const username = (req.body && typeof req.body.username === 'string') ? req.body.username.trim() : '';
        const id = (req.body && typeof req.body.id === 'string') ? req.body.id.trim() : '';
        const mdp = (req.body && typeof req.body.mdp === 'string') ? req.body.mdp : '';
        const accountId = (req.body && (typeof req.body.accountId === 'string' || typeof req.body.accountId === 'number')) ? String(req.body.accountId) : '';
        const userKey = normalizeUsername(username).toLowerCase();
        if (!userKey) return res.status(400).json({ success: false, error: 'username requis' });

        const store = await readMdpedConfig();
        const safeStore = (store && typeof store === 'object') ? store : {};

        // Si on envoie vide, on supprime l'entrÃ©e
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

// Admin: reset global ED state (memory only)
// ProtÃ©gÃ© via token (env: ADMIN_RESET_TOKEN). Si absent, route dÃ©sactivÃ©e.
router.post('/api/admin/ed-reset', express.json(), (req, res) => {
    const expected = String(process.env.ADMIN_RESET_TOKEN || '').trim();
    if (!expected) return res.status(404).json({ success: false, error: 'disabled' });
    const provided = String((req.get && req.get('x-admin-token')) || (req.body && req.body.token) || '').trim();
    if (!provided || provided !== expected) return res.status(403).json({ success: false, error: 'forbidden' });
    resetAllEdState();
    return res.json({ success: true });
});

// =====================================================================
//  Rafraîchissement automatique des données ED au démarrage
// =====================================================================
(async () => {
    try {
        const store = await readMdpedConfig();
        if (!store || typeof store !== 'object') return;
        for (const [userKey, cfg] of Object.entries(store)) {
            if (!cfg || !cfg.id || !cfg.mdp) continue;
            try {
                console.log(`[ED STARTUP] Reconnexion et rafraîchissement pour "${userKey}"...`);
                const state = getEdState(userKey);
                state.api = new EcoleDirecteAPI(cfg.id, cfg.mdp);
                const account = await state.api.login();
                if (account && !account.requireQCM) {
                    state.lastError = null;
                    await saveUserData(account, state.api);
                    console.log(`[ED STARTUP] ✅ Données rafraîchies pour ${account.prenom} ${account.nom}`);
                }
            } catch (e) {
                console.warn(`[ED STARTUP] ❌ Échec pour "${userKey}":`, e.message);
            }
        }
    } catch (e) {
        console.warn('[ED STARTUP] Erreur globale:', e.message);
    }
})();

module.exports = router;

