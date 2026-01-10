// /js/home.js

function getSiteUser(){
    try { return (localStorage.getItem('source_username') || '').trim(); } catch { return ''; }
}

function homeCacheKey(){
    const u = getSiteUser().toLowerCase();
    if (!u) return '';
    return 'HOME_WIDGETS:' + u;
}

function saveHomeWidgetsCache(payload){
    try {
        const key = homeCacheKey();
        if (!key) return;
        localStorage.setItem(key, JSON.stringify({ ts: Date.now(), payload }));
    } catch {}
}

function loadHomeWidgetsCache(maxAgeMs){
    try {
        const key = homeCacheKey();
        if (!key) return null;
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        const ts = parsed.ts || 0;
        if (maxAgeMs && ts && (Date.now() - ts) > maxAgeMs) return { stale: true, payload: parsed.payload || null };
        return { stale: false, payload: parsed.payload || null };
    } catch { return null; }
}

function mulberry32(a) {
    return function() {
        let t = a += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function hashStringToSeed(str){
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

function normalizeNumber(val){
    if (val === null || val === undefined) return null;
    const s = String(val).replace(/[^\d.,\-]/g, '').replace(',', '.');
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : null;
}

function fmt2(n){
    if (n === null || n === undefined || Number.isNaN(n)) return '-';
    return (Math.round(n * 100) / 100).toFixed(2).replace(/\.00$/, '');
}

function truncateText(s, maxLen){
    const t = String(s || '').replace(/\s+/g, ' ').trim();
    const m = Math.max(8, maxLen || 80);
    if (!t) return '';
    return t.length > m ? (t.slice(0, m - 1) + '…') : t;
}

// Mapping Messagerie: doit rester aligné avec server.js (CLASS_NAMES + offset)
const MESS_CLASS_NAMES = [
    'Even', 'Alexandre', 'Calixte', 'Noé', 'Julia', 'Joan', 'Juliette', 'Jezzy',
    'Inès', 'Timéo', 'Tyméo', 'Clautilde', 'Loanne', 'Lucie', 'Camille', 'Sofia',
    'Lilia', 'Amir', 'Robin', 'Arthur', 'Maxime', 'Gaultier', 'Antoine', 'Louis',
    'Anne-Victoria', 'Léa', 'Sarah', 'Ema', 'Jade', 'Alicia', 'Claire'
];

function normalizeNameKey(s){
    try {
        return String(s || '')
            .trim()
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
    } catch {
        return String(s || '').trim().toLowerCase();
    }
}

function getMessagerieUserIdFromUsername(username){
    const u = String(username || '').trim();
    if (!u) return null;
    const lower = normalizeNameKey(u);
    if (lower.includes('source ai')) return '1';
    if (lower.includes('source admin')) return '2';
    const idx = MESS_CLASS_NAMES.findIndex(n => normalizeNameKey(n) === lower);
    return idx >= 0 ? String(idx + 3) : null;
}

function goToMessagerieWithFocus(focus){
    try {
        sessionStorage.setItem('alpha_messagerie_focus', JSON.stringify(focus || {}));
    } catch {}
    const link = document.querySelector('a[data-page="messagerie"], .mobile-nav-link[data-page="messagerie"]');
    if (link) {
        link.click();
        return;
    }
    window.location.href = '/pages/mess.html';
}

function normalizeConversationSubject(subject){
    let s = String(subject || '').trim();
    if (!s) return '';
    // Retire tags connus: [ANONYME], [Sauvetage], etc.
    for (let i = 0; i < 3; i++) {
        const next = s.replace(/^\[[^\]]+\]\s*/i, '');
        if (next === s) break;
        s = next;
    }
    s = s.replace(/^\s*(re\s*:\s*)+/i, '');
    return s.trim().toLowerCase();
}

async function fetchMessagerieMessages(){
    const username = getSiteUser();
    const userId = getMessagerieUserIdFromUsername(username);
    if (!userId) return { ok: false, messages: [], userId: null, username };
    const res = await fetch(`/api/messagerie/messages?userId=${encodeURIComponent(userId)}`);
    if (!res.ok) return { ok: false, messages: [], userId, username };
    const arr = await res.json();
    if (!Array.isArray(arr)) return { ok: false, messages: [], userId, username };

    // IMPORTANT: on ne cache pas body/attachments (peut être énorme). On garde juste le nécessaire.
    const safe = arr
        .map(m => ({
            id: m?.id,
            senderId: m?.senderId,
            senderName: m?.senderName,
            recipients: Array.isArray(m?.recipients) ? m.recipients : [],
            subject: m?.subject,
            timestamp: m?.timestamp,
            date: m?.date,
            unread: m?.unread === true,
            rescueId: m?.rescueId,
            parentMessageId: m?.parentMessageId,
            type: m?.type
        }))
        .filter(m => m && m.id)
        .sort((a, b) => {
            const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
            const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
            return tb - ta;
        })
        .slice(0, 80);

    return { ok: true, messages: safe, userId, username };
}

function ymdToday(){ return new Date().toISOString().slice(0,10); }
function addDaysYmd(ymd, days){
    const d = new Date(ymd + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0,10);
}

function formatFrenchDate(dateStr){
    const raw = String(dateStr || '').trim();
    if (!raw) return '';

    // YYYY-MM-DD => date locale (évite le décalage de jour)
    const isYmd = /^\d{4}-\d{2}-\d{2}$/.test(raw);
    const d = isYmd ? new Date(raw + 'T00:00:00') : new Date(raw);
    if (isNaN(d.getTime())) return raw;

    try {
        // ex: "vendredi 16 janv." (selon locale)
        return new Intl.DateTimeFormat('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'short'
        }).format(d);
    } catch {
        return raw;
    }
}

function pickCurrentPeriode(periodes){
    const list = Array.isArray(periodes) ? periodes : [];
    if (!list.length) return null;

    // 1) Flag "courante" si présent
    const flagged = list.find(p => p && (p.periodeCourante === true || p.isCurrent === true || p.active === true));
    if (flagged) return flagged;

    // 2) Période contenant la date du jour (si dates dispo)
    const now = new Date();
    const byDate = list.find(p => {
        if (!p || !p.dateDebut || !p.dateFin) return false;
        const start = new Date(p.dateDebut);
        const end = new Date(p.dateFin);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;
        return now >= start && now <= end;
    });
    if (byDate) return byDate;

    // 3) Fallback: dernière période (souvent la plus récente)
    return list[list.length - 1];
}

function goToCartableWithFocus(focus){
    try {
        sessionStorage.setItem('alpha_cartable_focus', JSON.stringify(focus || {}));
    } catch {}
    const link = document.querySelector('a[data-page="cartable"], .mobile-nav-link[data-page="cartable"]');
    if (link) {
        link.click();
        return;
    }
    // Fallback: charge directement la page (sans SPA)
    window.location.href = '/pages/cartable.html';
}

async function fetchEdJson(path){
    const siteUser = getSiteUser();
    const headers = siteUser ? { 'x-source-user': siteUser, 'x-alpha-user': siteUser } : {};
    const res = await fetch(path, { headers });
    if (!res.ok) {
        const err = new Error('HTTP ' + res.status);
        err.status = res.status;
        throw err;
    }
    return await res.json();
}

function setHomeList(el, items){
    if (!el) return;
    el.innerHTML = '';
    if (!items || items.length === 0) {
        const li = document.createElement('li');
        li.className = 'is-empty';
        li.textContent = 'Rien à afficher';
        el.appendChild(li);
        return;
    }
    items.forEach(node => el.appendChild(node));
}

function makeHomeListItem(label, subLabel, onClick){
    const li = document.createElement('li');
    li.innerHTML = `
        <div class="home-item-title">${label}</div>
        ${subLabel ? `<div class="home-item-sub">${subLabel}</div>` : ''}
    `;
    if (typeof onClick === 'function') {
        li.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            onClick();
        });
    }
    return li;
}

function makeHomeNoteListItem(title, noteLine, dateLine, onClick){
    const li = document.createElement('li');
    li.innerHTML = `
        <div class="home-item-title">${title}</div>
        ${noteLine ? `<div class="home-item-mid">${noteLine}</div>` : ''}
        ${dateLine ? `<div class="home-item-sub">${dateLine}</div>` : ''}
    `;
    if (typeof onClick === 'function') {
        li.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            onClick();
        });
    }
    return li;
}

async function initPrioritizedWidgets(){
    const container = document.getElementById('widgets-container');
    if (!container) return;

    const widgets = {
        leaderboard: document.getElementById('leaderboard-display'),
        backpack: document.getElementById('backpack-display'),
        controls: document.getElementById('controls-widget'),
        pending: document.getElementById('pending-homework-widget'),
        notes: document.getElementById('notes-widget'),
        unreadMessages: document.getElementById('unread-messages-widget'),
        conversations: document.getElementById('recent-conversations-widget')
    };

    const CACHE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes
    const cached = loadHomeWidgetsCache(CACHE_MAX_AGE_MS);

    // Invalider le cache si la messagerie a changé
    let isDirty = false;
    try {
        if (sessionStorage.getItem('alpha_messages_dirty')) {
            isDirty = true;
            sessionStorage.removeItem('alpha_messages_dirty');
        }
    } catch {}

    // Default: placeholders immédiats uniquement si pas de cache utilisable.
    // Si cache présent, on affiche direct les valeurs déjà vues.
    const shouldShowLoading = !(cached && cached.payload);

    if (widgets.backpack) widgets.backpack.style.display = '';
    if (widgets.pending) widgets.pending.style.display = '';
    if (widgets.notes) widgets.notes.style.display = '';
    if (widgets.leaderboard) widgets.leaderboard.style.display = 'none';
    if (widgets.controls) widgets.controls.style.display = 'none';

    if (shouldShowLoading) {
        ['controls-list','pending-homework-list','notes-recent-list','unread-messages-list','recent-conversations-list'].forEach(id => {
            const ul = document.getElementById(id);
            const li = ul && ul.firstElementChild;
            if (li && li.tagName === 'LI' && (li.textContent || '').toLowerCase().includes('chargement')) {
                li.classList.add('is-loading');
            }
        });
    }

    const today = ymdToday();
    // 3 prochains jours dont aujourd'hui => today + 2 jours
    const end2 = addDaysYmd(today, 2);
    let devoirs = [];
    let notesStructure = null;
    let messagesData = [];
    let messagesFetchOk = false;
    let messUserId = null;
    let messUsername = '';

    // Pendant le chargement ED, on considère ces widgets éligibles (ils affichent "Chargement...")
    let hasControls = false;
    let hasPending = !!widgets.pending;
    let hasNotesWidget = !!widgets.notes;
    let edFetchOk = false;

    function renderFromData(devoirsArr, notesStructOrNull, okEd, messagesArr, okMessages, mUserId, mUsername){
        devoirs = Array.isArray(devoirsArr) ? devoirsArr : [];
        notesStructure = notesStructOrNull;
        edFetchOk = !!okEd;
        messagesData = Array.isArray(messagesArr) ? messagesArr : [];
        messagesFetchOk = !!okMessages;
        messUserId = mUserId ? String(mUserId) : null;
        messUsername = String(mUsername || '').trim();

        // --- Render Contrôles (pr1) ---
        if (widgets.controls) {
            const list = document.getElementById('controls-list');
            const end3 = end2;
            const controls = devoirs
                .filter(d => (d && (d.isControle || d.interrogation)) && d.date && d.date >= today && d.date <= end3)
                .sort((a,b) => String(a.date).localeCompare(String(b.date)))
                .slice(0, 4);
            hasControls = controls.length > 0;
            if (hasControls) {
                const nodes = controls.map(d => {
                    const title = truncateText(d.titre || 'Contrôle', 90);
                    const label = `${d.matiere || 'Matière'} — ${title}`;
                    const sub = `${formatFrenchDate(d.date || '')}${d.nomProf ? ' · ' + d.nomProf : ''}`;
                    return makeHomeListItem(label, sub, () => {
                        goToCartableWithFocus({ type: 'devoir', idDevoir: d.idDevoir || d.id, date: d.date, matiere: d.matiere || '' });
                    });
                });
                setHomeList(list, nodes);
            } else if (!okEd && list) {
                // Pas connecté: on garde le widget contrôles caché (pr1 optionnel)
                setHomeList(list, []);
            }
        }

        // --- Render Devoirs non faits (pr2) ---
        if (widgets.pending) {
            const list = document.getElementById('pending-homework-list');
            if (!okEd) {
                const li = document.createElement('li');
                li.className = 'is-empty';
                li.textContent = 'Connecte-toi dans l’onglet « Cartable » pour voir tes devoirs.';
                setHomeList(list, [li]);
                hasPending = true;
            } else {
                const pending = devoirs
                    .filter(d => d && d.date && d.date >= today && d.date <= end2 && !d.effectue)
                    .sort((a,b) => String(a.date).localeCompare(String(b.date)))
                    .slice(0, 5);
                hasPending = pending.length > 0;
                if (hasPending) {
                    const nodes = pending.map(d => {
                        const title = truncateText(d.titre || 'Devoir', 90);
                        const label = `${d.matiere || 'Matière'} — ${title}`;
                        const badges = (d.isControle || d.interrogation) ? ' · CONTRÔLE' : '';
                        const sub = `${formatFrenchDate(d.date || '')}${badges}`;
                        return makeHomeListItem(label, sub, () => {
                            goToCartableWithFocus({ type: 'devoir', idDevoir: d.idDevoir || d.id, date: d.date, matiere: d.matiere || '' });
                        });
                    });
                    setHomeList(list, nodes);
                } else {
                    setHomeList(list, []);
                }
            }
        }

        // --- Render Moyenne + Notes récentes (pr3) ---
        if (widgets.notes && !notesStructOrNull) {
            const list = document.getElementById('notes-recent-list');
            const avgEl = document.getElementById('notes-current-avg');
            if (avgEl) avgEl.textContent = '-';
            if (!okEd) {
                const li = document.createElement('li');
                li.className = 'is-empty';
                li.textContent = 'Connecte-toi dans l’onglet « Cartable » pour voir tes notes.';
                setHomeList(list, [li]);
                hasNotesWidget = true;
            }
        }

        if (widgets.notes && notesStructOrNull) {
            const avgEl = document.getElementById('notes-current-avg');
            const list = document.getElementById('notes-recent-list');

            let moy = null;
            const periodes = Array.isArray(notesStructOrNull?.periodes) ? notesStructOrNull.periodes : [];
            const currentPeriode = pickCurrentPeriode(periodes);
            const ensemble = currentPeriode?.ensembleMatieres;
            if (ensemble && ensemble.moyenneGenerale !== undefined) {
                moy = normalizeNumber(ensemble.moyenneGenerale);
            }
            if (avgEl) avgEl.textContent = moy !== null ? fmt2(moy) : '-';

            const currentCodePeriode = currentPeriode?.codePeriode ? String(currentPeriode.codePeriode) : '';

            const now = new Date();
            const since = new Date(now);
            since.setDate(now.getDate() - 2);
            const allNotes = Array.isArray(notesStructOrNull?.notes) ? notesStructOrNull.notes : [];
            const recent = allNotes
                .map(n => {
                    const dateStr = n?.date || n?.dateSaisie || n?.dateDevoir || '';
                    const dt = new Date(dateStr);
                    return { raw: n, date: dt, dateStr };
                })
                .filter(x => {
                    if (!x.raw) return false;
                    if (!(x.date instanceof Date) || isNaN(x.date.getTime())) return false;
                    if (x.date < since) return false;
                    if (currentCodePeriode) {
                        const noteCode = x.raw.codePeriode ? String(x.raw.codePeriode) : '';
                        if (noteCode && noteCode !== currentCodePeriode) return false;
                    }
                    return true;
                })
                .sort((a,b) => b.date.getTime() - a.date.getTime())
                .slice(0, 5);

            const nodes = recent.map(x => {
                const n = x.raw;
                const mat = n.libelleMatiere || n.matiere || 'Matière';
                const noteVal = normalizeNumber(n.valeur ?? n.note ?? n.value);
                const noteSur = normalizeNumber(n.noteSur ?? n.max ?? 20) || 20;
                const title = `${truncateText(mat, 40)}`;
                const noteLine = `${noteVal !== null ? fmt2(noteVal) : 'Abs'} / ${fmt2(noteSur)}`;
                const dateLine = x.dateStr ? formatFrenchDate(String(x.dateStr)) : '';
                return makeHomeNoteListItem(title, noteLine, dateLine, () => {
                    goToCartableWithFocus({ type: 'notes', libelleMatiere: mat, codeMatiere: n.codeMatiere || '', date: x.dateStr || '' });
                });
            });

            hasNotesWidget = (moy !== null) || (nodes.length > 0);
            setHomeList(list, nodes);
        }

        // --- Render Messages non lus (pr2) ---
        let hasUnreadMessages = false;
        if (widgets.unreadMessages) {
            const list = document.getElementById('unread-messages-list');
            if (!okMessages || !messUserId || !messUsername) {
                setHomeList(list, []);
                hasUnreadMessages = false;
            } else {
                const unread = messagesData
                    .filter(m => m && m.unread === true)
                    .slice(0, 4);

                hasUnreadMessages = unread.length > 0;
                const nodes = unread.map(m => {
                    const senderName = m.senderName || 'Inconnu';
                    const subj = truncateText(m.subject || '(Sans sujet)', 70);
                    const label = `${senderName} — ${subj}`;
                    const sub = m.date ? String(m.date) : '';
                    return makeHomeListItem(label, sub, () => {
                        goToMessagerieWithFocus({ messageId: m.id || '' });
                    });
                });
                setHomeList(list, nodes);
            }
        }

        // --- Render Derniers messages par conversation (prio très faible) ---
        let hasConversationRecents = false;
        if (widgets.conversations) {
            const list = document.getElementById('recent-conversations-list');
            if (!okMessages || !messUserId || !messUsername) {
                setHomeList(list, []);
                hasConversationRecents = false;
            } else {
                const bestByKey = new Map();
                messagesData.forEach(m => {
                    if (!m) return;
                    const ts = m.timestamp ? new Date(m.timestamp) : null;
                    const t = ts && !isNaN(ts.getTime()) ? ts.getTime() : 0;

                    const senderId = String(m.senderId || '');
                    const rec = Array.isArray(m.recipients) ? m.recipients : [];
                    const peer = (senderId === messUserId)
                        ? (rec[0] || 'Conversation')
                        : (m.senderName || 'Inconnu');

                    const subjectKey = normalizeConversationSubject(m.subject);
                    const key = m.rescueId
                        ? `rescue:${String(m.rescueId)}`
                        : (m.parentMessageId
                            ? `thread:${String(m.parentMessageId)}`
                            : `p:${normalizeNameKey(peer)}|s:${subjectKey}`);

                    const prev = bestByKey.get(key);
                    if (!prev || (t > prev._t)) {
                        bestByKey.set(key, { ...m, _t: t, _peer: peer });
                    }
                });

                const recents = Array.from(bestByKey.values())
                    .sort((a,b) => (b._t - a._t))
                    .slice(0, 4);

                hasConversationRecents = recents.length > 0;
                const nodes = recents.map(m => {
                    const peer = m._peer || 'Conversation';
                    const subj = truncateText(m.subject || '(Sans sujet)', 70);
                    const label = `${peer} — ${subj}`;
                    const sub = m.date ? String(m.date) : '';
                    return makeHomeListItem(label, sub, () => {
                        goToMessagerieWithFocus({ messageId: m.id || '' });
                    });
                });
                setHomeList(list, nodes);
            }
        }

        // --- Widget selection / ordering (max 3) ---
        const candidates = [
            { key: 'controls', el: widgets.controls, priority: 1, eligible: !!hasControls },
            { key: 'backpack', el: widgets.backpack, priority: 1, eligible: !!widgets.backpack },
            { key: 'pending', el: widgets.pending, priority: 2, eligible: !!hasPending },
            { key: 'unreadMessages', el: widgets.unreadMessages, priority: 2.5, eligible: !!hasUnreadMessages },
            { key: 'notes', el: widgets.notes, priority: 3, eligible: !!hasNotesWidget },
            { key: 'leaderboard', el: widgets.leaderboard, priority: 3, eligible: !!widgets.leaderboard },
            { key: 'conversations', el: widgets.conversations, priority: 6, eligible: !!hasConversationRecents }
        ].filter(w => w.el);

        const siteUser = getSiteUser();
        const seedStr = `${today}|${siteUser || 'anon'}|home-widgets`;
        const rand = mulberry32(hashStringToSeed(seedStr));
        candidates.forEach(w => { w._r = rand(); });

        const selected = candidates
            .filter(w => w.eligible)
            .sort((a,b) => (a.priority - b.priority) || (a._r - b._r))
            .slice(0, 3);

        candidates.forEach(w => { w.el.style.display = 'none'; });
        selected.forEach(w => {
            w.el.style.display = '';
            container.appendChild(w.el);
        });
    }

    // 1) Si on a un cache, on rend immédiatement à partir du cache.
    if (cached && cached.payload && !isDirty) {
        renderFromData(
            cached.payload.devoirs || [],
            cached.payload.notesStructure || null,
            !!cached.payload.edFetchOk,
            cached.payload.messagesData || [],
            !!cached.payload.messagesFetchOk,
            cached.payload.messUserId || null,
            cached.payload.messUsername || ''
        );
        // Si cache stale, on rafraîchit en arrière-plan sans bloquer l'affichage.
        if (cached.stale) {
            (async () => {
                try {
                    const [devoirsData, notesData, messRes] = await Promise.all([
                        fetchEdJson(`/ed/devoirs?start=${encodeURIComponent(today)}&end=${encodeURIComponent(end2)}`),
                        fetchEdJson('/ed/notes'),
                        fetchMessagerieMessages()
                    ]);
                    const freshDevoirs = Array.isArray(devoirsData?.devoirs) ? devoirsData.devoirs : [];
                    const freshNotes = (notesData && typeof notesData === 'object' && notesData.data) ? notesData.data : notesData;
                    saveHomeWidgetsCache({
                        devoirs: freshDevoirs,
                        notesStructure: freshNotes,
                        edFetchOk: true,
                        messagesData: messRes.messages || [],
                        messagesFetchOk: !!messRes.ok,
                        messUserId: messRes.userId || null,
                        messUsername: messRes.username || ''
                    });
                    renderFromData(freshDevoirs, freshNotes, true, messRes.messages || [], !!messRes.ok, messRes.userId || null, messRes.username || '');
                } catch {
                    // Même si ED plante, on tente quand même la messagerie.
                    const messRes = await fetchMessagerieMessages().catch(() => ({ ok: false, messages: [], userId: null, username: '' }));
                    saveHomeWidgetsCache({
                        devoirs: [],
                        notesStructure: null,
                        edFetchOk: false,
                        messagesData: messRes.messages || [],
                        messagesFetchOk: !!messRes.ok,
                        messUserId: messRes.userId || null,
                        messUsername: messRes.username || ''
                    });
                    renderFromData([], null, false, messRes.messages || [], !!messRes.ok, messRes.userId || null, messRes.username || '');
                }
            })();
        }
        return;
    }

    // Si les messages ont été marqués lus, on recharge même si cache est encore frais
    if (isDirty) {
        try {
            const messRes = await fetchMessagerieMessages();
            if (cached && cached.payload) {
                saveHomeWidgetsCache({
                    devoirs: cached.payload.devoirs || [],
                    notesStructure: cached.payload.notesStructure || null,
                    edFetchOk: !!cached.payload.edFetchOk,
                    messagesData: messRes.messages || [],
                    messagesFetchOk: !!messRes.ok,
                    messUserId: messRes.userId || null,
                    messUsername: messRes.username || ''
                });
                renderFromData(
                    cached.payload.devoirs || [],
                    cached.payload.notesStructure || null,
                    !!cached.payload.edFetchOk,
                    messRes.messages || [],
                    !!messRes.ok,
                    messRes.userId || null,
                    messRes.username || ''
                );
            } else {
                renderFromData([], null, false, messRes.messages || [], !!messRes.ok, messRes.userId || null, messRes.username || '');
            }
        } catch {}
        return;
    }

    try {
        const [devoirsData, notesData, messRes] = await Promise.all([
            fetchEdJson(`/ed/devoirs?start=${encodeURIComponent(today)}&end=${encodeURIComponent(end2)}`),
            fetchEdJson('/ed/notes'),
            fetchMessagerieMessages()
        ]);
        const freshDevoirs = Array.isArray(devoirsData?.devoirs) ? devoirsData.devoirs : [];
        const freshNotes = (notesData && typeof notesData === 'object' && notesData.data) ? notesData.data : notesData;
        saveHomeWidgetsCache({
            devoirs: freshDevoirs,
            notesStructure: freshNotes,
            edFetchOk: true,
            messagesData: messRes.messages || [],
            messagesFetchOk: !!messRes.ok,
            messUserId: messRes.userId || null,
            messUsername: messRes.username || ''
        });
        renderFromData(freshDevoirs, freshNotes, true, messRes.messages || [], !!messRes.ok, messRes.userId || null, messRes.username || '');
    } catch (e) {
        // Pas connecté ED ou erreur
        const messRes = await fetchMessagerieMessages().catch(() => ({ ok: false, messages: [], userId: null, username: '' }));
        saveHomeWidgetsCache({
            devoirs: [],
            notesStructure: null,
            edFetchOk: false,
            messagesData: messRes.messages || [],
            messagesFetchOk: !!messRes.ok,
            messUserId: messRes.userId || null,
            messUsername: messRes.username || ''
        });
        renderFromData([], null, false, messRes.messages || [], !!messRes.ok, messRes.userId || null, messRes.username || '');
    }
}

/**
 * Fonction principale pour initialiser la page d'accueil (message d'accueil et classement).
 */
window.initHomePage = async function() {
    // ... (Reste de la fonction initHomePage inchangé) ...
    const greetingEl = document.getElementById('home-greeting');
    if (!greetingEl) return; 

    const username = localStorage.getItem('source_username') || "Utilisateur";

    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();
    const minutes = now.getMinutes();
    let messages = [];
    const timeString = `${hour}h${minutes < 10 ? '0' : ''}${minutes}`;
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

    // --- LOGIQUE DU MESSAGE D'ACCUEIL ---
    // ... (Logique du message d'accueil inchangée) ...
    if (hour >= 5 && hour < 12) { // Matin (5h - 11h59)
        messages = [
            `Bonne matinée ${username}`,
            `Salut ${username}, c'est le matin`,
            `La forme ${username} ?`,
            `Hey ${username} ! Il est exactement ${timeString}. Bonne journée !`,
            `Le soleil est levé. Prêt à commencer, ${username} ?`,
            `Déjà sur le pont, ${username} ? Belle énergie !`,
            `C'est une belle ${isWeekend ? 'matinée de week-end' : 'matinée de travail'} ! Courage, ${username}.`,
            `Bonjour ${username}. Quel est le programme de ce ${dayOfWeek === 1 ? 'Lundi' : 'jour'} ?`,
            `Bien réveillé, ${username} ? Le monde t'attend.`,
            `Un excellent début de journée à toi, ${username}.`
        ];
    } else if (hour >= 12 && hour < 17) { // Après-midi (12h - 16h59)
        messages = [
            `Bon après-midi ${username}`,
            `Ravi de te revoir ${username}`,
            `Bonjour ${username}, quoi de neuf?`,
            `C'est la mi-journée ! Bientôt l'heure du thé ou du café, ${username}.`,
            `Il est ${timeString}. Comment se passe ton après-midi, ${username} ?`,
            `Plein de réussite pour cette deuxième partie de journée, ${username}.`,
            `J'espère que ta pause déjeuner a été bonne, ${username}.`,
            `${username}, on tient bon jusqu'au soir. Moins de ${17 - hour} heures avant de souffler !`,
            `Un bel après-midi de ${isWeekend ? 'détente' : 'concentration'} à toi, ${username}.`,
            `Salut ${username}. L'après-midi, c'est le moment d'accélérer !`
        ];
    } else if (hour >= 17 && hour < 23) { // Soir (17h - 22h59)
        messages = [
            `Bonsoir ${username}`,
            `Bonne soirée ${username}`,
            `Quelque chose de prévu ce soir ${username} ?`,
            `Il est déjà ${timeString} ! Le travail est fini pour aujourd'hui, ${username} ?`,
            `Le crépuscule arrive... Profite bien de ta soirée, ${username}.`,
            `C'est le moment de décompresser, ${username}. Bonne fin de journée.`,
            `Que ce ${dayOfWeek === 5 ? 'vendredi soir' : 'soir'} t'apporte le repos mérité, ${username}.`,
            `Bonne soirée, ${username}. J'espère que tout s'est bien passé.`,
            `Tu as mérité cette soirée de repos, ${username}.`,
            `Salut ${username}. Quel plaisir de te revoir à cette heure !`
        ];
    } else { // Nuit (23h - 4h59)
        messages = [
            `Bonne nuit ${username}`,
            `Tu ne dors pas ${username} ?`,
            `Salut ${username}, il est tard`,
            `Attention, il est ${timeString} ! L'heure de la concentration (ou du sommeil), ${username}.`,
            `Hé ${username}, même les lève-tôt sont couchés à cette heure !`,
            `Veille tardive, ${username} ? N'oublie pas de te reposer.`,
            `C'est la nuit, ${username}. Prends soin de toi.`,
            `Le monde dort, mais pas toi ${username} ?`,
            `Il est très tard, ${username}. Pense à mettre ton téléphone en mode NPD !`,
            `Bonne nuit à toi, ${username}. J'espère que tu travailles sur quelque chose de cool.`
        ];
    }

    // Affiche le message d'accueil
    const message = messages[Math.floor(Math.random() * messages.length)];
    greetingEl.textContent = message;

    // Orchestrateur (priorités + max 3 + ordre "vivant")
    try { await initPrioritizedWidgets(); } catch (e) { console.warn('[Home] widgets init failed', e); }

    // Lancement des widgets existants (ils peuvent être masqués si non sélectionnés)
    try { await window.loadLeaderboardData(); } catch {}
    try { await window.loadBackpackData(); } catch {}

    // 💥 NOUVEL AJOUT : Initialisation du bouton de déconnexion
    window.initLogoutButton(); 
};


// ⭐ FONCTION : Charge, trie et affiche le Top 3 et le rang de l'utilisateur actuel
window.loadLeaderboardData = async function() {
    // ... (Fonction loadLeaderboardData inchangée) ...
    // Éléments du TOP 1
    const leaderEl = document.getElementById('leader-username');
    const leaderPointsEl = document.getElementById('leader-points');

    // Nouveaux éléments du TOP 2 & 3
    const secondEl = document.getElementById('second-username');
    const secondPointsEl = document.getElementById('second-points');
    const thirdEl = document.getElementById('third-username');
    const thirdPointsEl = document.getElementById('third-points');

    // Nouveaux éléments du rang utilisateur
    const userRankEl = document.getElementById('user-rank');
    const userScoreEl = document.getElementById('user-score');
    
    // Utilisateur actuel (pour trouver son rang)
    const currentUsername = localStorage.getItem('source_username'); 

    if (!leaderEl || !leaderPointsEl) {
        console.error("PUTAIN LOG : Éléments du classement (TOP 1) introuvables. Vérifiez vos ID HTML.");
        return;
    }

    try {
        const API_URL = `/api/all.json`; 
        const response = await fetch(API_URL); 
        
        if (!response.ok) {
            leaderEl.textContent = 'ERR_API';
            [leaderPointsEl, secondEl, secondPointsEl, thirdEl, thirdPointsEl, userRankEl, userScoreEl].forEach(el => {
                if (el) el.textContent = 'N/A';
            });
            return;
        }

        const data = await response.json(); 
        let userRanking = data.user_ranking;

        if (!userRanking || userRanking.length === 0) {
            [leaderEl, secondEl, thirdEl, userRankEl].forEach(el => {
                if (el) el.textContent = 'Aucun user';
            });
            return;
        }

        // 1. Trier le tableau par 'points' en ordre décroissant
        userRanking.sort((a, b) => b.points - a.points);
        
        // --- 2. AFFICHAGE DU TOP 3 ---
        
        const top1 = userRanking[0];
        leaderEl.textContent = top1.username || 'Inconnu';
        leaderPointsEl.textContent = `${top1.points || 0} pts`;

        const top2 = userRanking[1];
        if (secondEl && secondPointsEl) {
            secondEl.textContent = top2 ? (top2.username || 'Inconnu') : 'N/A';
            secondPointsEl.textContent = top2 ? (`${top2.points || 0} pts`) : '';
        }

        const top3 = userRanking[2];
        if (thirdEl && thirdPointsEl) {
            thirdEl.textContent = top3 ? (top3.username || 'Inconnu') : 'N/A';
            thirdPointsEl.textContent = top3 ? (`${top3.points || 0} pts`) : '';
        }

        // --- 3. AFFICHAGE DU RANG DE L'UTILISATEUR ACTUEL ---
        
        if (currentUsername && userRankEl && userScoreEl) {
            const userIndex = userRanking.findIndex(user => user.username === currentUsername);

            if (userIndex !== -1) {
                const userRank = userIndex + 1;
                const userScore = userRanking[userIndex].points || 0;
                
                userRankEl.textContent = `#${userRank}`;
                userScoreEl.textContent = `${userScore} pts`;
            } else {
                userRankEl.textContent = 'N/A (Non trouvé)';
                userScoreEl.textContent = '';
            }
        }
        
    } catch (error) {
        console.error("PUTAIN LOG : Erreur fatale lors du traitement du classement:", error);
        leaderEl.textContent = 'ERR_NET';
        [leaderPointsEl, secondEl, secondPointsEl, thirdEl, thirdPointsEl, userRankEl, userScoreEl].forEach(el => {
            if (el) el.textContent = 'ERR_NET';
        });
    }
};

// ---

// Old loadBackpackData removed (replaced by new version at end of file)

// ⭐ NOUVELLE FONCTION : Gestionnaire de l'action de déconnexion
window.initLogoutButton = function() {
    const logoutButton = document.getElementById('logout-button');
    
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            console.log("PUTAIN LOG : Bouton Déconnexion cliqué. Appel de 'logoutAndRedirect()'.");
            
            // On appelle ta fonction exactement comme elle est définie dans script.js
            if (window.logoutAndRedirect) {
                 window.logoutAndRedirect(); 
            } else {
                 console.error("PUTAIN LOG : La fonction 'logoutAndRedirect' est introuvable. Vérifiez que script.js est chargé AVANT home.js.");
            }
        });
    } else {
        console.error("PUTAIN LOG : Bouton de déconnexion introuvable (#logout-button).");
    }
};

// Lancement de l'initialisation quand le DOM est prêt
document.addEventListener('DOMContentLoaded', window.initHomePage);

// ⭐ FONCTION : Charge les données du Sac à Dos (Emploi du temps) - VERSION ECOLE DIRECTE
window.loadBackpackData = async function() {
    const backpackElToday = document.getElementById('backpack-today-subjects');
    const backpackElTomorrow = document.getElementById('backpack-tomorrow-subjects');
    const titleElToday = document.getElementById('backpack-title-today');
    const titleElTomorrow = document.getElementById('backpack-title-tomorrow');
    // const backpackElTitle = document.getElementById('backpack-title'); // Supprimé car remplacé par les tabs

    // Nouveaux éléments pour l'EDT et les Tabs
    const tabBackpack = document.getElementById('tab-backpack');
    const tabEdt = document.getElementById('tab-edt');
    const viewBackpack = document.getElementById('view-backpack');
    const viewEdt = document.getElementById('view-edt');
    const edtListEl = document.getElementById('edt-today-list');
    const edtTitleToday = document.getElementById('edt-title-today');

    if (!backpackElToday || !backpackElTomorrow) return;

    // --- Gestion des Tabs ---
    if (tabBackpack && tabEdt && viewBackpack && viewEdt) {
        tabBackpack.addEventListener('click', () => {
            tabBackpack.classList.add('active');
            tabEdt.classList.remove('active');
            viewBackpack.style.display = 'block';
            viewEdt.style.display = 'none';
        });

        tabEdt.addEventListener('click', () => {
            tabEdt.classList.add('active');
            tabBackpack.classList.remove('active');
            viewBackpack.style.display = 'none';
            viewEdt.style.display = 'block';
        });
    }

    try {
        // 1. Déterminer les dates (Aujourd'hui et Demain/Prochain jour)
        const now = new Date();
        const frenchDays = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
        let dayIndex = now.getDay();
        
        // Calcul de "Demain" (toujours le jour suivant, même si week-end)
        let nextDay = new Date(now);
        nextDay.setDate(now.getDate() + 1);

        const todayStr = now.toISOString().split('T')[0];
        const nextDayStr = nextDay.toISOString().split('T')[0];

        // Titres
        titleElToday.textContent = `Aujourd'hui`;
        titleElTomorrow.textContent = `Demain`;
        if (edtTitleToday) edtTitleToday.textContent = `Emploi du temps (${frenchDays[dayIndex]})`;
        // backpackElTitle.textContent = '🎒 Sac à Dos'; // Plus utilisé

        // 2. Récupérer l'emploi du temps via l'API
        // On vide d'abord les listes pour éviter l'effet "barre blanche" si ça plante
        const loadingStyle = 'background: transparent; color: rgba(255,255,255,0.7); text-align: center; font-size: 0.9em;';
        backpackElToday.innerHTML = `<li style="${loadingStyle}">Chargement...</li>`;
        backpackElTomorrow.innerHTML = `<li style="${loadingStyle}">Chargement...</li>`;
        if (edtListEl) edtListEl.innerHTML = `<li style="${loadingStyle}">Chargement...</li>`;

        const siteUser = (localStorage.getItem('source_username') || '').trim();
        const headers = siteUser ? { 'x-source-user': siteUser, 'x-alpha-user': siteUser } : {};
        const response = await fetch(`/ed/edt?start=${todayStr}&end=${nextDayStr}`, { headers });
        if (!response.ok) {
            // Si erreur (ex: 401 non connecté), on affiche le message demandé
            const msg = `<li style="background: transparent; color: rgba(255,255,255,0.6); text-align: center; padding: 10px; font-style: italic;">Connectez-vous dans l'onglet "Cartable" pour avoir accès à cette fonctionnalité</li>`;
            backpackElToday.innerHTML = msg;
            backpackElTomorrow.innerHTML = msg;
            if (edtListEl) edtListEl.innerHTML = msg;
            return;
        }
        const edtData = await response.json();
        console.log("PUTAIN LOG : EDT Data reçue:", edtData); // Debug

        // 3. Mapping des couleurs (basé sur l'image fournie)
        const subjectColors = {
            'HISTOIRE-GEOGRAPHIE': '#ffcc99', // Pêche
            'ESPAGNOL LV2': '#fff59d', // Jaune pâle
            'LCA LATIN': '#e0f7fa', // Cyan pâle
            'GREC': '#e0f7fa', // Cyan pâle (comme Latin)
            'ED.PHYSIQUE & SPORT.': '#d1c4e9', // Violet pâle
            'SCIENCES VIE & TERRE': '#a5d6a7', // Vert pâle
            'ANGLAIS LV1': '#ffab91', // Orange pâle
            'MATHEMATIQUES': '#ffccbc', // Saumon
            'FRANCAIS': '#90caf9', // Bleu pâle
            'VIE DE CLASSE': '#cfd8dc', // Gris
            'PHYSIQUE-CHIMIE': '#f48fb1', // Rose
            'EDUCATION MUSICALE': '#ce93d8', // Violet
            'ARTS PLASTIQUES': '#f8bbd0', // Rose pâle
            'TECHNOLOGIE': '#ef5350', // Rouge
            'CAMBRIDGE': '#2e7d32', // Vert foncé
            'DEVOIR SURVEILLE': '#b0bec5' // Gris bleu
        };

        // --- LOGIQUE SAC À DOS (Simplifié) ---
        const processDay = (dateStr) => {
            // Style pour les messages vides (pas de fond blanc, texte centré gris clair)
            const emptyStyle = 'background: transparent; color: rgba(255,255,255,0.5); text-align: center; font-style: italic; padding: 10px;';

            if (!edtData || !Array.isArray(edtData)) return [`<li style="${emptyStyle}">Aucun cours</li>`];

            // Filtre les cours du jour
            const courses = edtData.filter(c => c.start_date.startsWith(dateStr) && !c.isAnnule);
            
            if (courses.length === 0) return [`<li style="${emptyStyle}">Pas de cours</li>`];

            // Détection Vacances
            const isHoliday = courses.some(c => c.text === 'CONGÉS' || c.typeCours === 'CONGE');
            if (isHoliday) return [`<li style="${emptyStyle}">Vacances</li>`];

            // Extrait les matières uniques (en gardant l'ordre chronologique)
            const uniqueSubjects = [];
            const seen = new Set();

            courses.sort((a, b) => a.start_date.localeCompare(b.start_date));

            courses.forEach(c => {
                let name = (c.matiere || '').toUpperCase().trim();
                
                // Ignorer Repas, Permanence, ou matières vides
                if (!name || name === '' || name.includes('REPAS')) return;

                // Nettoyage du nom
                if (name.includes('HISTOIRE')) name = 'HISTOIRE-GEOGRAPHIE';
                else if (name.includes('ESPAGNOL')) name = 'ESPAGNOL LV2';
                else if (name.includes('LATIN')) name = 'LCA LATIN';
                else if (name.includes('GREC')) name = 'GREC';
                else if (name.includes('SPORT') || name.includes('EPS')) name = 'ED.PHYSIQUE & SPORT.';
                else if (name.includes('SVT') || name.includes('VIE & TERRE')) name = 'SCIENCES VIE & TERRE';
                else if (name.includes('ANGLAIS')) name = 'ANGLAIS LV1';
                else if (name.includes('MATH')) name = 'MATHEMATIQUES';
                else if (name.includes('FRANCAIS')) name = 'FRANCAIS';
                else if (name.includes('PHYSIQUE')) name = 'PHYSIQUE-CHIMIE';
                else if (name.includes('MUSIQUE')) name = 'EDUCATION MUSICALE';
                else if (name.includes('PLASTIQUE')) name = 'ARTS PLASTIQUES';
                else if (name.includes('TECHNO')) name = 'TECHNOLOGIE';
                else if (name.includes('CAMBRIDGE')) name = 'CAMBRIDGE';
                else if (name.includes('VIE DE CLASSE')) name = 'VIE DE CLASSE';

                // Gestion des doublons consécutifs (ex: 2h de maths)
                // On veut afficher chaque créneau ou juste les matières ? "Préparer son sac" -> juste les matières uniques
                if (!seen.has(name)) {
                    seen.add(name);
                    uniqueSubjects.push(name);
                }
            });

            // Gestion des jours sans cours (Weekend/Jours non renseignés)
            if (uniqueSubjects.length === 0) {
                 return [`<li style="${emptyStyle}">Pas de cours</li>`];
            }

            return uniqueSubjects.map(sub => {
                const color = subjectColors[sub] || '#e0e0e0'; // Gris par défaut
                const textColor = (sub === 'CAMBRIDGE' || sub === 'TECHNOLOGIE') ? '#fff' : '#000';
                // Nom affiché plus joli
                let displayName = sub.charAt(0) + sub.slice(1).toLowerCase();
                if (sub === 'SVT') displayName = 'SVT';
                if (sub === 'EPS') displayName = 'Sport';
                if (sub === 'LCA LATIN') displayName = 'Latin';
                if (sub === 'ED.PHYSIQUE & SPORT.') displayName = 'Sport';
                if (sub === 'SCIENCES VIE & TERRE') displayName = 'SVT';
                if (sub === 'ANGLAIS LV1') displayName = 'Anglais';
                if (sub === 'ESPAGNOL LV2') displayName = 'Espagnol';
                if (sub === 'HISTOIRE-GEOGRAPHIE') displayName = 'Histoire-Géo';

                return `<li style="background-color: ${color}; color: ${textColor}; padding: 4px 8px; border-radius: 4px; margin-bottom: 4px; font-weight: 600;">${displayName}</li>`;
            });
        };

        backpackElToday.innerHTML = processDay(todayStr).join('');
        backpackElTomorrow.innerHTML = processDay(nextDayStr).join('');

        // --- LOGIQUE EDT (Détaillé) ---
        if (edtListEl) {
            const processEdt = (dateStr) => {
                const emptyStyle = 'background: transparent; color: rgba(255,255,255,0.5); text-align: center; font-style: italic; padding: 10px;';
                
                if (!edtData || !Array.isArray(edtData)) return [`<li style="${emptyStyle}">Aucun cours</li>`];

                const courses = edtData.filter(c => c.start_date.startsWith(dateStr) && !c.isAnnule);
                
                if (courses.length === 0) return [`<li style="${emptyStyle}">Pas de cours aujourd'hui</li>`];

                // Détection Vacances
                const isHoliday = courses.some(c => c.text === 'CONGÉS' || c.typeCours === 'CONGE');
                if (isHoliday) return [`<li style="${emptyStyle}">Vacances</li>`];

                courses.sort((a, b) => a.start_date.localeCompare(b.start_date));

                return courses.map(c => {
                    // Heure
                    const start = c.start_date.split(' ')[1].substring(0, 5);
                    const end = c.end_date.split(' ')[1].substring(0, 5);
                    
                    // Matière & Prof
                    let matiere = c.matiere || c.text || 'Cours';
                    let prof = c.prof || '';
                    let salle = c.salle || '';

                    // Couleur
                    let cleanName = matiere.toUpperCase();
                    // ... (Même logique de nettoyage pour la couleur si on veut, ou juste mapping direct)
                    // On réutilise le mapping subjectColors si possible
                    let colorKey = Object.keys(subjectColors).find(k => cleanName.includes(k.split(' ')[0])); // Match partiel simple
                    let color = subjectColors[colorKey] || '#ccc';
                    if (cleanName.includes('CAMBRIDGE')) color = subjectColors['CAMBRIDGE']; // Force specific

                    return `
                    <li style="border-left-color: ${color};">
                        <div class="edt-time">${start} - ${end}</div>
                        <div class="edt-subject">${matiere}</div>
                        <div class="edt-details">${prof} ${salle ? '- ' + salle : ''}</div>
                    </li>
                    `;
                });
            };
            
            edtListEl.innerHTML = processEdt(todayStr).join('');
        }

    } catch (error) {
        console.error("Erreur Sac à Dos:", error);
        [backpackElToday, backpackElTomorrow].forEach(el => el.innerHTML = '<li style="color:red">Erreur chargement</li>');
        if (edtListEl) edtListEl.innerHTML = '<li style="color:red">Erreur chargement</li>';
    }
};