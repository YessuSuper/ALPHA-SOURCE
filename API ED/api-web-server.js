/**
 * API Web simple pour intÃ©grer EcoleDirecte avec votre site
 * Serveur Express qui expose les donnÃ©es EcoleDirecte
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const EcoleDirecteAPI = require('./ecoledirecte-api');

const router = express.Router();
const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const MDPED_PATH = path.join(__dirname, '..', 'public', 'api', 'mdped.json');

// Gestion des sessions multiples (clÃ© = username local normalisÃ©)
const sessions = new Map(); // key -> { api: EcoleDirecteAPI, lastError: string }

// Cache simple en mÃ©moire par utilisateur
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
// Structure des caches : Map<userKey, Map<cacheKey, { ts, data }>>
const caches = {
    devoirs: new Map(),
    cahier: new Map(),
    messages: new Map()
};

function getCacheStore(type, userKey) {
    if (!caches[type]) return null;
    if (!caches[type].has(userKey)) caches[type].set(userKey, new Map());
    return caches[type].get(userKey);
}

function normalizeUserKey(key) {
    return String(key || '').trim().toLowerCase();
}

function getUserKeyFromReq(req) {
    // 1. Header spÃ©cifique
    const h = req.get('x-source-user') || req.get('x-alpha-user');
    if (h) return normalizeUserKey(h);
    
    // 2. Query param (pour les GET faciles)
    if (req.query.user || req.query.username) return normalizeUserKey(req.query.user || req.query.username);

    // 3. Body (pour login)
    if (req.body && (req.body.localUser || req.body.username)) return normalizeUserKey(req.body.localUser || req.body.username);

    return '';
}

function getSession(req) {
    const key = getUserKeyFromReq(req);
    // Si pas de clÃ© et serveur unique dev local, on peut tenter une session par dÃ©faut "default"
    // ou "even" pour rÃ©trocompatibilitÃ©, mais mieux vaut Ãªtre strict.
    // Fallback temporaire pour index.html non modifiÃ© : si 1 seule session active, on la prend.
    if (!key) {
        if (sessions.size === 1) return sessions.values().next().value;
        return null; 
    }
    return sessions.get(key);
}

function defaultAnneeMessages(apiInstance) {
  const v = apiInstance && apiInstance.account && apiInstance.account.anneeScolaireCourante;
  if (typeof v === 'string' && /^\d{4}-\d{4}$/.test(v)) {
    return v;
  }
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const start = (m >= 9) ? y : (y - 1);
  return String(start) + '-' + String(start + 1);
}

function nowMs() {
  return Date.now();
}

function getCache(map, key) {
  const entry = map.get(key);
  if (!entry) return null;
  if ((nowMs() - entry.ts) > CACHE_TTL_MS) {
    map.delete(key);
    return null;
  }
  return entry;
}

function setCache(map, key, value) {
  map.set(key, { ts: nowMs(), ...value });
}

async function promisePool(items, limit, worker) {
  const results = [];
  let index = 0;

  async function runOne() {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  const runners = [];
  const n = Math.min(limit, items.length);
  for (let i = 0; i < n; i++) {
    runners.push(runOne());
  }

  await Promise.all(runners);
  return results;
}

function isTruthyFlag(v) {
  if (v === true) return true;
  if (v === false || v === null || v === undefined) return false;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (!s) return false;
    if (s === 'true' || s === '1' || s === 'oui' || s === 'o' || s === 'y' || s === 'yes') return true;
    if (s === 'false' || s === '0' || s === 'non' || s === 'n' || s === 'no') return false;
  }
  return !!v;
}

// Middleware
router.use(cors());
router.use(express.json());

// --- Fonctions utilitaires mdped.json ---
function readMdped() {
    try {
        if (!fs.existsSync(MDPED_PATH)) return {};
        return JSON.parse(fs.readFileSync(MDPED_PATH, 'utf8'));
    } catch(e) {
        console.error("Erreur lecture mdped.json", e);
        return {};
    }
}

function writeMdped(data) {
    try {
        fs.writeFileSync(MDPED_PATH, JSON.stringify(data, null, 2), 'utf8');
    } catch(e) {
        console.error("Erreur Ã©criture mdped.json", e);
    }
}

/**
 * POST /api/login
 * Body: { identifiant, motdepasse, localUser? }
 * Si identifiant/motdepasse fournis : tente connexion ED -> succes -> sauvegarde dans mdped.json
 * Si localUser seul : tente connexion via mdped.json
 */
router.post('/api/login', async (req, res) => {
  try {
    const identifiant = (req.body.identifiant || '').trim();
    const motdepasse = (req.body.motdepasse || '');
    let localUser = normalizeUserKey(req.body.localUser || 'invitÃ©');
    
    // Si pas de localUser spÃ©cifiÃ© mais 'even' est hardcodÃ© avant, on gÃ©rait Ã§a comment ?
    // Pour compatibilitÃ©, si on login sans user, on prÃ©sume 'default'
    if (!localUser && !identifiant) return res.status(400).json({ error: 'localUser ou identifiant requis' });

    let api = null;
    let savedEntry = null;

    // A) Cas Connexion explicite (nouveaux credentials)
    if (identifiant && motdepasse) {
        api = new EcoleDirecteAPI(identifiant, motdepasse);
        const account = await api.login();
        
        if (account && account.requireQCM) {
             return res.status(200).json({ success: false, requireQCM: true, message: 'QCM required' });
        }
        
        // SUCCÃˆS : On sauvegarde si un nom local est fourni
        if (localUser && localUser !== 'invitÃ©') {
            const data = readMdped();
            // On met Ã  jour ou crÃ©e l'entrÃ©e
            data[localUser] = {
                username: req.body.localUser, // garder la casse originale pour l'affichage si voulu
                id: identifiant,
                mdp: motdepasse,
                accountId: account.id
            };
            writeMdped(data);
            console.log(`[API ED] Identifiants sauvegardÃ©s pour ${localUser}`);
        }
    } 
    // B) Cas Connexion automatique via fichier
    else if (localUser) {
        const data = readMdped();
        const entry = data[localUser];
        if (!entry || !entry.id || !entry.mdp) {
            return res.status(401).json({ error: `Aucun identifiant connu pour ${localUser}` });
        }
        api = new EcoleDirecteAPI(entry.id, entry.mdp);
        const account = await api.login();
        if (account && account.requireQCM) {
             return res.status(200).json({ success: false, requireQCM: true, message: 'QCM required' });
        }
        savedEntry = entry;
    }

    if (!api || !api.token) {
        return res.status(401).json({ error: 'Echec connexion' });
    }

    // Enregistrer la session
    const finalUserKey = localUser || 'default';
    sessions.set(finalUserKey, { api, lastError: null });

    const account = await api.getAccount();
    const safeClasse = account?.profile?.classe?.libelle || account?.classe?.libelle || account?.classe || '-';

    res.json({
      success: true,
      account: {
        id: account.id,
        identifiant: account.identifiant,
        prenom: account.prenom,
        nom: account.nom,
        email: account.email,
        nomEtablissement: account.nomEtablissement,
        classe: safeClasse,
        anneeScolaireCourante: account.anneeScolaireCourante
      },
      localUser: finalUserKey
    });

  } catch (error) {
    console.error("Login error:", error);
    res.status(401).json({ success: false, error: error.message });
  }
});

// GET Legacy login (dev local hardcoded Even) - A SUPPRIMER A TERME
// On le garde pour ne pas casser si des scripts l'appellent encore sans args
router.get('/api/login', async (req, res) => {
    // Tente de connecter 'even' par dÃ©faut si prÃ©sent dans mdped
    try {
        const data = readMdped();
        if (data['even'] && data['even'].id) {
            const api = new EcoleDirecteAPI(data['even'].id, data['even'].mdp);
            await api.login();
            sessions.set('even', { api, lastError: null });
            const account = await api.getAccount();
            return res.json({ success: true, account });
        }
    } catch(e) {}
    res.status(401).json({ error: 'Utilisez POST /api/login avec identifiants' });
});

/**
 * GET /api/notes
 */
router.get('/api/notes', async (req, res) => {
  const session = getSession(req);
  if (!session || !session.api) return res.status(401).json({ error: 'Not connected' });

  try {
    const notes = await session.api.getNotes();
    res.json(notes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/messages
 */
router.get('/api/messages', async (req, res) => {
  const session = getSession(req);
  if (!session || !session.api) return res.status(401).json({ error: 'Not connected' });

  const apiInstance = session.api;
  const userKey = getUserKeyFromReq(req) || 'default';
  const messagesCache = getCacheStore('messages', userKey);

  try {
    const annee = (
      (typeof req.query.anneeMessages === 'string' && req.query.anneeMessages.trim())
        ? req.query.anneeMessages.trim()
        : ((typeof req.query.annee === 'string' && req.query.annee.trim()) ? req.query.annee.trim() : defaultAnneeMessages(apiInstance))
    );
    const mode = (typeof req.query.mode === 'string' && req.query.mode.trim()) ? req.query.mode.trim() : 'all';

    const cacheKey = annee + '|' + mode;
    const cached = getCache(messagesCache, cacheKey);
    if (cached && cached.payload) {
      return res.json(cached.payload);
    }

    function pickList(data) {
      if (!data) return [];
      if (Array.isArray(data)) return data;
      const directKeys = ['messages', 'items', 'received', 'sent', 'mails', 'listeMessages', 'liste', 'boiteReception', 'boiteEnvoi'];
      for (let i = 0; i < directKeys.length; i++) {
        if (data && Array.isArray(data[directKeys[i]])) return data[directKeys[i]];
      }
      const nestedKeys = ['data', 'messages', 'result', 'payload'];
      for (let j = 0; j < nestedKeys.length; j++) {
        const nk = nestedKeys[j];
        if (data && data[nk] && data[nk] !== data) {
          const found = pickList(data[nk]);
          if (found && found.length) return found;
        }
      }
      if (data && data.messages && typeof data.messages === 'object') {
        const candidates = ['destinataire', 'expediteur', 'inbox', 'outbox'];
        for (let c = 0; c < candidates.length; c++) {
          if (Array.isArray(data.messages[candidates[c]])) return data.messages[candidates[c]];
        }
      }
      return [];
    }

    async function fetchMode(oneMode) {
      const listData = await apiInstance.getMessagesList(oneMode, annee);
      const list = pickList(listData);
      const ids = [];
      for (let i = 0; i < list.length; i++) {
        const m = list[i] || {};
        const id = parseInt(m.id || m.idMessage || m.messageId || m.id_message, 10);
        if (!isNaN(id) && isFinite(id) && id > 0) {
          ids.push({ id, mode: oneMode, summary: m });
        }
      }
      return ids;
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
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      unique.push(t);
    }

    const concurrency = 6;
    const detailed = await promisePool(unique, concurrency, async (t) => {
      const detail = await apiInstance.getMessageById(t.id, t.mode, annee);
      const merged = Object.assign({}, t.summary || {}, detail || {});
      merged._mode = t.mode;
      merged.id = merged.id || t.id;
      return merged;
    });

    detailed.sort(function (a, b) {
      const da = String((a && (a.date || a.dateCreation || a.dateEnvoi || a.dateReception)) || '');
      const db = String((b && (b.date || b.dateCreation || b.dateEnvoi || b.dateReception)) || '');
      if (da < db) return 1;
      if (da > db) return -1;
      return 0;
    });

    const payload = {
      annee: annee,
      mode: mode,
      count: detailed.length,
      messages: detailed
    };

    setCache(messagesCache, cacheKey, { payload });
    res.json(payload);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/messages/:idMessage/files/:idFile
 */
router.get('/api/messages/:idMessage/files/:idFile', async (req, res) => {
  const session = getSession(req);
  if (!session || !session.api) return res.status(401).json({ error: 'Not connected' });
  const apiInstance = session.api;

  try {
    const idMessage = parseInt(req.params.idMessage, 10);
    const idFile = parseInt(req.params.idFile, 10);
    if (isNaN(idMessage) || idMessage <= 0) return res.status(400).json({ error: 'Invalid idMessage' });
    if (isNaN(idFile) || idFile <= 0) return res.status(400).json({ error: 'Invalid idFile' });

    const mode = (req.query.mode || 'destinataire').trim();
    const annee = (req.query.anneeMessages || req.query.annee || defaultAnneeMessages(apiInstance)).trim();
    const filename = (req.query.name || ('piece-jointe-' + idFile)).trim();

    const r = await apiInstance.downloadMessageAttachment(idMessage, idFile, mode, annee);
    const ct = (r.headers && (r.headers['content-type'] || r.headers['Content-Type'])) || 'application/octet-stream';
    res.setHeader('Content-Type', ct);
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

/**
 * GET /api/timeline
 */
router.get('/api/timeline', async (req, res) => {
  const session = getSession(req);
    if (!session || !session.api) return res.status(401).json({ error: 'Not connected' });

  try {
    const timeline = await session.api.getTimeline();
    res.json(timeline);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/emploidutemps/:dateDebut/:dateFin
 */
router.get('/api/emploidutemps/:dateDebut/:dateFin', async (req, res) => {
  const session = getSession(req);
  if (!session || !session.api) return res.status(401).json({ error: 'Not connected' });

  try {
    const { dateDebut, dateFin } = req.params;
    const edt = await session.api.getEmploiDuTemps(dateDebut, dateFin);
    res.json(edt);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/cahierdetexte/:date
 */
router.get('/api/cahierdetexte/:date', async (req, res) => {
  const session = getSession(req);
  if (!session || !session.api) return res.status(401).json({ error: 'Not connected' });

  try {
    const { date } = req.params;
    // Utiliser cache cahier ?
    const cahier = await session.api.getCahierDeTexte(date);
    res.json(cahier);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/devoirs
 */
router.get('/api/devoirs', async (req, res) => {
  const session = getSession(req);
  if (!session || !session.api) return res.status(401).json({ error: 'Not connected' });
  const apiInstance = session.api;
  const userKey = getUserKeyFromReq(req) || 'default';
  
  const devoirsCache = getCacheStore('devoirs', userKey);
  const cahierCache = getCacheStore('cahier', userKey);

  function isYmd(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }
  function toYmd(d) { return d.toISOString().slice(0, 10); }
  function parseYmdToUtcDate(s) { return new Date(s + 'T00:00:00.000Z'); }

  try {
    const today = new Date();
    const defaultStart = toYmd(today);
    const defaultEnd = toYmd(new Date(today.getTime() + 30 * 86400000));
    const start = isYmd(req.query.start) ? req.query.start : defaultStart;
    const end = isYmd(req.query.end) ? req.query.end : defaultEnd;

    const startDate = parseYmdToUtcDate(start);
    const endDate = parseYmdToUtcDate(end);
    if (startDate.getTime() > endDate.getTime()) return res.status(400).json({ error: 'start must be <= end' });
    const maxDays = 62;
    const days = Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
    if (days > maxDays) return res.status(400).json({ error: 'Date range too large' });

    const rangeKey = start + '|' + end;
    const cachedRange = getCache(devoirsCache, rangeKey);
    if (cachedRange && cachedRange.payload) return res.json(cachedRange.payload);

    const dateList = [];
    for (let i = 0; i < days; i++) {
      dateList.push(toYmd(new Date(startDate.getTime() + i * 86400000)));
    }

    const devoirs = [];
    const concurrency = 6;
    const perDayLists = await promisePool(dateList, concurrency, async (ymd) => {
      const cachedDay = getCache(cahierCache, ymd);
      let cahier = cachedDay ? cachedDay.data : null;
      if (!cahier) {
          cahier = await apiInstance.getCahierDeTexte(ymd);
          setCache(cahierCache, ymd, { data: cahier });
      }

      const out = [];
      const matieres = cahier && cahier.matieres ? cahier.matieres : [];
      for (let j = 0; j < matieres.length; j++) {
        const m = matieres[j] || {};
        const af = (m.aFaire && typeof m.aFaire === 'object') ? m.aFaire : {};
        
        const docs = Array.isArray(af.documents) ? af.documents : [];
        const resDocs = Array.isArray(af.ressourceDocuments) ? af.ressourceDocuments : [];
        const seanceDocs = (af.contenuDeSeance && Array.isArray(af.contenuDeSeance.documents)) ? af.contenuDeSeance.documents : [];
        const pjCount = docs.length + resDocs.length + seanceDocs.length;
        const hasPJ = (pjCount > 0) || isTruthyFlag(m.documentsAFaire) || isTruthyFlag(af.documentsAFaire);

        const hasQuestionnaire = isTruthyFlag(m.interrogation) || isTruthyFlag(af.interrogation) || isTruthyFlag(m.questionnaire) || isTruthyFlag(af.questionnaire) || isTruthyFlag(m.rendreEnLigne) || isTruthyFlag(af.rendreEnLigne);

        let contenu = '';
        if (af.contenu) {
          try { contenu = Buffer.from(String(af.contenu), 'base64').toString('utf-8'); } catch (e) { contenu = ''; }
          contenu = (contenu || '').trim();
        }

        if (!contenu && !hasPJ && !hasQuestionnaire) continue;

        const effectue = (af.effectue !== undefined) ? !!af.effectue : (m.effectue !== undefined ? !!m.effectue : false);
        const parsedIdDevoir = (af && af.idDevoir !== undefined) ? parseInt(af.idDevoir, 10) : ((m && m.idDevoir !== undefined) ? parseInt(m.idDevoir, 10) : ((m && m.id !== undefined) ? parseInt(m.id, 10) : null));
        const idDevoir = (!isNaN(parsedIdDevoir) && isFinite(parsedIdDevoir)) ? parsedIdDevoir : null;
        
        out.push({
          date: ymd,
          matiere: m.matiere || '',
          nomProf: m.nomProf || '',
          contenu: contenu,
          idDevoir: idDevoir,
          effectue: effectue,
          hasPJ: hasPJ,
          pjCount: pjCount,
          hasQuestionnaire: hasQuestionnaire
        });
      }
      return out;
    });

    for (let i = 0; i < perDayLists.length; i++) {
        devoirs.push(...(perDayLists[i] || []));
    }

    devoirs.sort(function (a, b) {
      if (a.date < b.date) return -1;
      if (a.date > b.date) return 1;
      var am = (a.matiere || '').toLowerCase();
      var bm = (b.matiere || '').toLowerCase();
      if (am < bm) return -1;
      if (am > bm) return 1;
      return 0;
    });

    const payload = { start, end, count: devoirs.length, devoirs };
    setCache(devoirsCache, rangeKey, { payload });
    res.json(payload);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/devoirs/effectue
 */
router.post('/api/devoirs/effectue', async (req, res) => {
  const session = getSession(req);
  if (!session || !session.api) return res.status(401).json({ error: 'Not connected' });
  const apiInstance = session.api;
  const userKey = getUserKeyFromReq(req) || 'default';
  
  const devoirsCache = getCacheStore('devoirs', userKey);
  const cahierCache = getCacheStore('cahier', userKey);

  const body = req.body || {};
  function toIdList(v) {
    const arr = Array.isArray(v) ? v : [];
    return arr.map(x => parseInt(x, 10)).filter(n => !isNaN(n) && isFinite(n));
  }

  let idDevoirsEffectues = [];
  let idDevoirsNonEffectues = [];

  if (body.idDevoir !== undefined) {
    const id = parseInt(body.idDevoir, 10);
    const eff = !!body.effectue;
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid idDevoir' });
    idDevoirsEffectues = eff ? [id] : [];
    idDevoirsNonEffectues = eff ? [] : [id];
  } else {
    idDevoirsEffectues = toIdList(body.idDevoirsEffectues);
    idDevoirsNonEffectues = toIdList(body.idDevoirsNonEffectues);
  }

  if (!idDevoirsEffectues.length && !idDevoirsNonEffectues.length) return res.status(400).json({ error: 'No ids provided' });

  try {
    await apiInstance.setDevoirsEffectues(idDevoirsEffectues, idDevoirsNonEffectues);
    if (devoirsCache) devoirsCache.clear();
    if (cahierCache) cahierCache.clear();
    res.json({ success: true, effectues: idDevoirsEffectues, nonEffectues: idDevoirsNonEffectues });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/viescolaire
 */
router.get('/api/viescolaire', async (req, res) => {
  const session = getSession(req);
  if (!session || !session.api) return res.status(401).json({ error: 'Not connected' });
  try {
    const vie = await session.api.getVieScolaire();
    res.json(vie);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/documents
 */
router.get('/api/documents', async (req, res) => {
  const session = getSession(req);
  if (!session || !session.api) return res.status(401).json({ error: 'Not connected' });
  try {
    const docs = await session.api.getDocuments(req.query.archive || '');
    res.json(docs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/espacestravail
 */
router.get('/api/espacestravail', async (req, res) => {
  const session = getSession(req);
  if (!session || !session.api) return res.status(401).json({ error: 'Not connected' });
  try {
    const espaces = await session.api.getEspacesTravail();
    res.json(espaces);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/status
 */
router.get('/api/status', (req, res) => {
  const session = getSession(req);
  if (session && session.api && session.api.account) {
    res.json({
      connected: true,
      user: `${session.api.account.prenom} ${session.api.account.nom}`,
      localUser: getUserKeyFromReq(req)
    });
  } else {
    res.json({
      connected: false,
      lastError: session ? session.lastError : null
    });
  }
});

/**
 * GET /api/logout
 */
router.get('/api/logout', (req, res) => {
  const key = getUserKeyFromReq(req);
  if (key && sessions.has(key)) {
      sessions.delete(key);
  }
  res.json({ success: true });
});

// Serve UI
router.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });
router.get('/root', (req, res) => { res.sendFile(path.join(__dirname, 'root.html')); });

if (require.main === module) {
  app.use('/', router);
  const server = app.listen(PORT, () => {
    console.log(`ðŸš€ Serveur EcoleDirecte API dÃ©marrÃ© sur http://localhost:${PORT}`);
  });
  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
       console.error(`Port ${PORT} utilisÃ©.`);
    }
  });
} else {
  module.exports = router;
}

