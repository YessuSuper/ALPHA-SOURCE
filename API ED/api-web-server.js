/**
 * API Web simple pour intégrer EcoleDirecte avec votre site
 * Serveur Express qui expose les données EcoleDirecte
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const EcoleDirecteAPI = require('./ecoledirecte-api');

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

// État courant de la session côté serveur
let apiInstance = null;
let lastError = null;

// Cache simple en mémoire pour réduire le temps de chargement (devoirs/cahier de texte)
// TTL court pour limiter les données obsolètes.
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
const devoirsCache = new Map(); // key: start|end -> { ts, payload }
const cahierCache = new Map(); // key: ymd -> { ts, data }
const messagesCache = new Map(); // key: annee|mode -> { ts, payload }

function defaultAnneeMessages() {
  // Prefer the year provided by the account if available.
  const v = apiInstance && apiInstance.account && apiInstance.account.anneeScolaireCourante;
  if (typeof v === 'string' && /^\d{4}-\d{4}$/.test(v)) {
    return v;
  }
  // Fallback: infer from current date (school year starting around Sep).
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
  // Fallback: any other non-empty value.
  return !!v;
}

// Middleware
app.use(cors());
app.use(express.json());

app.get('/api/login', async (req, res) => {
  try {
    apiInstance = new EcoleDirecteAPI('even.henri', 'Superpitchu_8');
    const account = await apiInstance.login();

    if (account && account.requireQCM) {
      return res.status(200).json({
        success: false,
        requireQCM: true,
        message: 'QCM required - manual input needed'
      });
    }

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
      }
    });
  } catch (error) {
    lastError = error.message;
    res.status(401).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/login
 * Connexion avec identifiant et mot de passe fournis par le client.
 * Body JSON: { identifiant: string, motdepasse: string }
 */
app.post('/api/login', async (req, res) => {
  try {
    const identifiant = (req.body && typeof req.body.identifiant === 'string') ? req.body.identifiant.trim() : '';
    const motdepasse = (req.body && typeof req.body.motdepasse === 'string') ? req.body.motdepasse : '';

    if (!identifiant || !motdepasse) {
      return res.status(400).json({ success: false, error: 'identifiant et motdepasse requis' });
    }

    apiInstance = new EcoleDirecteAPI(identifiant, motdepasse);
    const account = await apiInstance.login();

    if (account && account.requireQCM) {
      return res.status(200).json({
        success: false,
        requireQCM: true,
        message: 'QCM required - manual input needed'
      });
    }

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
      }
    });
  } catch (error) {
    lastError = error.message;
    res.status(401).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/notes
 * Récupère les notes
 */
app.get('/api/notes', async (req, res) => {
  if (!apiInstance) {
    return res.status(401).json({ error: 'Not connected' });
  }

  try {
    const notes = await apiInstance.getNotes();
    res.json(notes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/messages
 * Récupère les messages (messagerie) en lecture seule.
 */
app.get('/api/messages', async (req, res) => {
  if (!apiInstance) {
    return res.status(401).json({ error: 'Not connected' });
  }

  try {
    const annee = (
      (typeof req.query.anneeMessages === 'string' && req.query.anneeMessages.trim())
        ? req.query.anneeMessages.trim()
        : ((typeof req.query.annee === 'string' && req.query.annee.trim()) ? req.query.annee.trim() : defaultAnneeMessages())
    );
    // mode: all|destinataire|expediteur
    const mode = (typeof req.query.mode === 'string' && req.query.mode.trim()) ? req.query.mode.trim() : 'all';

    const cacheKey = annee + '|' + mode;
    const cached = getCache(messagesCache, cacheKey);
    if (cached && cached.payload) {
      return res.json(cached.payload);
    }

    function pickList(data) {
      // EcoleDirecte varie pas mal selon les endpoints/versions.
      // On cherche une liste de messages de manière tolérante.
      if (!data) return [];
      if (Array.isArray(data)) return data;

      const directKeys = [
        'messages',
        'items',
        'received',
        'sent',
        'mails',
        'listeMessages',
        'liste',
        'boiteReception',
        'boiteEnvoi'
      ];
      for (let i = 0; i < directKeys.length; i++) {
        const k = directKeys[i];
        if (data && Array.isArray(data[k])) return data[k];
      }

      // Structures imbriquées fréquentes
      const nestedKeys = ['data', 'messages', 'result', 'payload'];
      for (let j = 0; j < nestedKeys.length; j++) {
        const nk = nestedKeys[j];
        if (data && data[nk] && data[nk] !== data) {
          const found = pickList(data[nk]);
          if (found && found.length) return found;
        }
      }

      // Parfois: { messages: { destinataire: [...], expediteur: [...] } }
      if (data && data.messages && typeof data.messages === 'object') {
        const candidates = ['destinataire', 'expediteur', 'inbox', 'outbox'];
        for (let c = 0; c < candidates.length; c++) {
          const ck = candidates[c];
          if (Array.isArray(data.messages[ck])) return data.messages[ck];
        }
      }

      return [];
    }

    async function fetchMode(oneMode) {
      const listData = await apiInstance.getMessagesList(oneMode, annee);
      const list = pickList(listData);
      // Normalize ids
      const ids = [];
      for (let i = 0; i < list.length; i++) {
        const m = list[i] || {};
        const id = parseInt(m.id || m.idMessage || m.messageId, 10);
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

    // De-duplicate by id (keep first occurrence)
    const seen = new Set();
    const unique = [];
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      unique.push(t);
    }

    // Fetch details in parallel (limited) so we can display content.
    const concurrency = 6;
    const detailed = await promisePool(unique, concurrency, async (t) => {
      const detail = await apiInstance.getMessageById(t.id, t.mode, annee);
      // keep a few useful summary fields if detail lacks them
      const merged = Object.assign({}, t.summary || {}, detail || {});
      merged._mode = t.mode;
      merged.id = merged.id || t.id;
      return merged;
    });

    // Sort newest first if date is present.
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
 * GET /api/messages/:idMessage/files/:idFile?mode=destinataire|expediteur&annee=YYYY-YYYY
 * Proxy de téléchargement des pièces jointes.
 */
app.get('/api/messages/:idMessage/files/:idFile', async (req, res) => {
  if (!apiInstance) {
    return res.status(401).json({ error: 'Not connected' });
  }

  try {
    const idMessage = parseInt(req.params.idMessage, 10);
    const idFile = parseInt(req.params.idFile, 10);
    if (isNaN(idMessage) || !isFinite(idMessage) || idMessage <= 0) {
      return res.status(400).json({ error: 'Invalid idMessage' });
    }
    if (isNaN(idFile) || !isFinite(idFile) || idFile <= 0) {
      return res.status(400).json({ error: 'Invalid idFile' });
    }

    const mode = (typeof req.query.mode === 'string' && req.query.mode.trim()) ? req.query.mode.trim() : 'destinataire';
    const annee = (
      (typeof req.query.anneeMessages === 'string' && req.query.anneeMessages.trim())
        ? req.query.anneeMessages.trim()
        : ((typeof req.query.annee === 'string' && req.query.annee.trim()) ? req.query.annee.trim() : defaultAnneeMessages())
    );

    // Optional filename from query to improve Content-Disposition.
    const filename = (typeof req.query.name === 'string' && req.query.name.trim()) ? req.query.name.trim() : ('piece-jointe-' + idFile);

    const r = await apiInstance.downloadMessageAttachment(idMessage, idFile, mode, annee);

    // Pass-through content-type if present.
    const ct = (r.headers && (r.headers['content-type'] || r.headers['Content-Type'])) || 'application/octet-stream';
    res.setHeader('Content-Type', ct);
    // Force download.
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
 * Récupère la timeline
 */
app.get('/api/timeline', async (req, res) => {
  if (!apiInstance) {
    return res.status(401).json({ error: 'Not connected' });
  }

  try {
    const timeline = await apiInstance.getTimeline();
    res.json(timeline);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/emploidutemps/:dateDebut/:dateFin
 * Récupère l'emploi du temps
 */
app.get('/api/emploidutemps/:dateDebut/:dateFin', async (req, res) => {
  if (!apiInstance) {
    return res.status(401).json({ error: 'Not connected' });
  }

  try {
    const { dateDebut, dateFin } = req.params;
    const edt = await apiInstance.getEmploiDuTemps(dateDebut, dateFin);
    res.json(edt);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/cahierdetexte/:date
 * Récupère le cahier de texte
 */
app.get('/api/cahierdetexte/:date', async (req, res) => {
  if (!apiInstance) {
    return res.status(401).json({ error: 'Not connected' });
  }

  try {
    const { date } = req.params;
    const cahier = await apiInstance.getCahierDeTexte(date);
    res.json(cahier);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/devoirs?start=YYYY-MM-DD&end=YYYY-MM-DD
 * Agrège le cahier de texte sur une plage de dates et renvoie une liste de devoirs.
 *
 * Réponse:
 * {
 *   start: 'YYYY-MM-DD',
 *   end: 'YYYY-MM-DD',
 *   count: <number>,
 *   devoirs: [ { date, matiere, nomProf, contenu } ]
 * }
 */
app.get('/api/devoirs', async (req, res) => {
  if (!apiInstance) {
    return res.status(401).json({ error: 'Not connected' });
  }

  function isYmd(s) {
    return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
  }

  function toYmd(d) {
    return d.toISOString().slice(0, 10);
  }

  function parseYmdToUtcDate(s) {
    // Force UTC midnight to avoid timezone shifts.
    return new Date(s + 'T00:00:00.000Z');
  }

  try {
    const today = new Date();
    const defaultStart = toYmd(today);
    const defaultEnd = toYmd(new Date(today.getTime() + 30 * 86400000));

    const start = isYmd(req.query.start) ? req.query.start : defaultStart;
    const end = isYmd(req.query.end) ? req.query.end : defaultEnd;

    if (!isYmd(start) || !isYmd(end)) {
      return res.status(400).json({ error: 'Invalid date format. Use start=YYYY-MM-DD&end=YYYY-MM-DD' });
    }

    const startDate = parseYmdToUtcDate(start);
    const endDate = parseYmdToUtcDate(end);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date value' });
    }
    if (startDate.getTime() > endDate.getTime()) {
      return res.status(400).json({ error: 'start must be <= end' });
    }

    // Hard limit to avoid hammering the upstream.
    const maxDays = 62;
    const days = Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
    if (days > maxDays) {
      return res.status(400).json({ error: 'Date range too large (max ' + maxDays + ' days)' });
    }

    const rangeKey = start + '|' + end;
    const cachedRange = getCache(devoirsCache, rangeKey);
    if (cachedRange && cachedRange.payload) {
      return res.json(cachedRange.payload);
    }

    // Build list of dates
    const dateList = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate.getTime() + i * 86400000);
      dateList.push(toYmd(d));
    }

    const devoirs = [];

    // Fetch days in parallel with a small concurrency limit.
    const concurrency = 6;
    const perDayLists = await promisePool(dateList, concurrency, async (ymd) => {
      const cachedDay = getCache(cahierCache, ymd);
      const cahier = cachedDay ? cachedDay.data : await apiInstance.getCahierDeTexte(ymd);
      if (!cachedDay) {
        setCache(cahierCache, ymd, { data: cahier });
      }

      const out = [];
      const matieres = cahier && cahier.matieres ? cahier.matieres : [];
      for (let j = 0; j < matieres.length; j++) {
        const m = matieres[j] || {};
        const af = (m.aFaire && typeof m.aFaire === 'object') ? m.aFaire : {};

        // Pièces jointes / documents (les schémas ED varient, on agrège plusieurs sources)
        const docs = Array.isArray(af.documents) ? af.documents : [];
        const resDocs = Array.isArray(af.ressourceDocuments) ? af.ressourceDocuments : [];
        const seanceDocs = (af.contenuDeSeance && Array.isArray(af.contenuDeSeance.documents)) ? af.contenuDeSeance.documents : [];
        const pjCount = docs.length + resDocs.length + seanceDocs.length;
        const hasPJ = (pjCount > 0) || isTruthyFlag(m.documentsAFaire) || isTruthyFlag(af.documentsAFaire);

        // Questionnaire / évaluation : côté ED c'est souvent le flag "interrogation"
        // Certains établissements renvoient aussi rendreEnLigne pour des devoirs/quiz à faire en ligne.
        const hasQuestionnaire = isTruthyFlag(m.interrogation)
          || isTruthyFlag(af.interrogation)
          || isTruthyFlag(m.questionnaire)
          || isTruthyFlag(af.questionnaire)
          || isTruthyFlag(m.rendreEnLigne)
          || isTruthyFlag(af.rendreEnLigne);

        // Contenu du devoir (souvent base64 HTML)
        const b64 = af.contenu;
        let contenu = '';
        if (b64) {
          try {
            contenu = Buffer.from(String(b64), 'base64').toString('utf-8');
          } catch (e) {
            contenu = '';
          }
          contenu = (contenu || '').trim();
        }

        // Si pas de contenu ET pas d'indices (PJ / questionnaire), ne pas inclure.
        if (!contenu && !hasPJ && !hasQuestionnaire) {
          continue;
        }

        // ED fournit souvent un booléen aFaire.effectue (devoir fait/pas fait)
        const effectue = (af.effectue !== undefined) ? !!af.effectue : (m.effectue !== undefined ? !!m.effectue : false);
        const parsedIdDevoir = (af && af.idDevoir !== undefined && af.idDevoir !== null)
          ? parseInt(af.idDevoir, 10)
          : ((m && m.idDevoir !== undefined && m.idDevoir !== null)
            ? parseInt(m.idDevoir, 10)
            : ((m && m.id !== undefined && m.id !== null) ? parseInt(m.id, 10) : null));
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
      const arr = perDayLists[i] || [];
      for (let j = 0; j < arr.length; j++) {
        devoirs.push(arr[j]);
      }
    }

    // Sort by date asc then subject.
    devoirs.sort(function (a, b) {
      if (a.date < b.date) { return -1; }
      if (a.date > b.date) { return 1; }
      var am = (a.matiere || '').toLowerCase();
      var bm = (b.matiere || '').toLowerCase();
      if (am < bm) { return -1; }
      if (am > bm) { return 1; }
      return 0;
    });

    res.json({
      start,
      end,
      count: devoirs.length,
      devoirs
    });

    setCache(devoirsCache, rangeKey, {
      payload: {
        start,
        end,
        count: devoirs.length,
        devoirs
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/devoirs/effectue
 * Body JSON:
 *  - { idDevoir: number, effectue: boolean }
 *  - ou { idDevoirsEffectues: number[], idDevoirsNonEffectues: number[] }
 *
 * Reproduit la requête web:
 *  POST /v3/Eleves/<id>/cahierdetexte.awp?verbe=put
 *  data={ idDevoirsEffectues: [...], idDevoirsNonEffectues: [...] }
 */
app.post('/api/devoirs/effectue', async (req, res) => {
  if (!apiInstance) {
    return res.status(401).json({ error: 'Not connected' });
  }

  const body = req.body || {};

  function toIdList(v) {
    const arr = Array.isArray(v) ? v : [];
    const out = [];
    for (let i = 0; i < arr.length; i++) {
      const n = parseInt(arr[i], 10);
      if (!isNaN(n) && isFinite(n)) out.push(n);
    }
    return out;
  }

  let idDevoirsEffectues = [];
  let idDevoirsNonEffectues = [];

  if (body.idDevoir !== undefined && body.idDevoir !== null) {
    const id = parseInt(body.idDevoir, 10);
    const eff = !!body.effectue;
    if (isNaN(id) || !isFinite(id)) {
      return res.status(400).json({ error: 'Invalid idDevoir' });
    }
    idDevoirsEffectues = eff ? [id] : [];
    idDevoirsNonEffectues = eff ? [] : [id];
  } else {
    idDevoirsEffectues = toIdList(body.idDevoirsEffectues);
    idDevoirsNonEffectues = toIdList(body.idDevoirsNonEffectues);
  }

  // Avoid empty update calls.
  if (idDevoirsEffectues.length === 0 && idDevoirsNonEffectues.length === 0) {
    return res.status(400).json({ error: 'No ids provided' });
  }

  try {
    await apiInstance.setDevoirsEffectues(idDevoirsEffectues, idDevoirsNonEffectues);

    // Invalidate caches since effectue status has changed upstream.
    devoirsCache.clear();
    cahierCache.clear();

    res.json({
      success: true,
      effectues: idDevoirsEffectues,
      nonEffectues: idDevoirsNonEffectues
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/viescolaire
 * Récupère la vie scolaire
 */
app.get('/api/viescolaire', async (req, res) => {
  if (!apiInstance) {
    return res.status(401).json({ error: 'Not connected' });
  }

  try {
    const vieScolaire = await apiInstance.getVieScolaire();
    res.json(vieScolaire);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/documents
 * Récupère les documents administratifs
 */
app.get('/api/documents', async (req, res) => {
  if (!apiInstance) {
    return res.status(401).json({ error: 'Not connected' });
  }

  try {
    const archive = req.query.archive || '';
    const documents = await apiInstance.getDocuments(archive);
    res.json(documents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/espacestravail
 * Récupère les espaces de travail
 */
app.get('/api/espacestravail', async (req, res) => {
  if (!apiInstance) {
    return res.status(401).json({ error: 'Not connected' });
  }

  try {
    const espacestravail = await apiInstance.getEspacesTravail();
    res.json(espacestravail);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/status
 * Statut de connexion
 */
app.get('/api/status', (req, res) => {
  if (apiInstance && apiInstance.account) {
    res.json({
      connected: true,
      user: `${apiInstance.account.prenom} ${apiInstance.account.nom}`
    });
  } else {
    res.json({
      connected: false,
      lastError: lastError
    });
  }
});

/**
 * GET /api/logout
 * Déconnecte
 */
app.get('/api/logout', (req, res) => {
  apiInstance = null;
  lastError = null;
  res.json({ success: true });
});

// Servir une page de test simple
app.get('/', (req, res) => {
  // Servir l'UI complète (onglets Notes / Devoirs / Messagerie / Emploi du temps)
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Garder l'ancienne page de test minimale accessible
app.get('/root', (req, res) => {
  res.sendFile(path.join(__dirname, 'root.html'));
});

// Petite page web: emploi du temps sur 1 semaine à partir du 5 janvier
app.get('/edt', (req, res) => {
  // Par défaut: semaine du 5 janvier 2026
  const start = req.query.start || '2026-01-05';
  // Fin 6 jours après (7 jours total)
  const end = req.query.end || '2026-01-11';

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>Emploi du temps (semaine du ${start})</title>
    </head>
    <body>
      <h1>Emploi du temps</h1>
      <p>Semaine: du ${start} au ${end}</p>
      <div id="status">Connexion en cours...</div>
      <div id="content"></div>
      <script>
        const api = 'http://localhost:${PORT}/api';

        async function main() {
          try {
            const loginRes = await fetch(api + '/login');
            const login = await loginRes.json();
            if (!login.success) {
              document.getElementById('status').innerText = 'Connexion requise (2FA) ou échec: ' + (login.message || login.error || '');
              return;
            }
            document.getElementById('status').innerText = 'Connecté: ' + login.account.prenom + ' ' + login.account.nom;

            const edtRes = await fetch(api + '/emploidutemps/${start}/${end}');
            const edt = await edtRes.json();
            const container = document.getElementById('content');

            if (!Array.isArray(edt)) {
              container.innerText = 'Aucun cours trouvé ou erreur.';
              return;
            }

            let currentDate = '';
            edt.forEach(item => {
              const date = item.date;
              if (date !== currentDate) {
                const h2 = document.createElement('h2');
                h2.textContent = date;
                container.appendChild(h2);
                currentDate = date;
              }
              const p = document.createElement('p');
              const heureDebut = (item.start || item.start_date || '').toString().slice(11,16) || (item.hde || '');
              const heureFin = (item.end || item.end_date || '').toString().slice(11,16) || (item.hfin || '');
              p.textContent = (heureDebut ? heureDebut : '') + (heureFin ? ' - ' + heureFin : '') + ' : ' + (item.matiere || item.text || item.remarque || item.libelle || 'Cours');
              container.appendChild(p);
            });
          } catch (e) {
            document.getElementById('status').innerText = 'Erreur: ' + e.message;
          }
        }

        main();
      </script>
    </body>
    </html>
  `);
});

// Démarrer le serveur
const server = app.listen(PORT, () => {
  console.log(`🚀 Serveur EcoleDirecte API démarré sur http://localhost:${PORT}`);
  console.log(`Ouvrez http://localhost:${PORT} dans votre navigateur`);
});

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} déjà utilisé (EADDRINUSE).`);
    console.error('➡️  Fermez l\'ancien node.exe ou lancez avec un autre port:');
    console.error('    PowerShell:  $env:PORT=3002; node .\\api-web-server.js');
    process.exitCode = 1;
    return;
  }
  console.error('❌ Erreur serveur:', err);
  process.exitCode = 1;
});
