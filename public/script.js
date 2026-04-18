// public/script.js (Logique principale d'initialisation - Version originale avec fix home)

// 🚨 ÉLÉMENTS DE BASE (peuvent être null si le DOM change)
const sidebar = document.getElementById('sidebar');
const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const mainMenu = document.getElementById('main-menu');
const pageContentWrapper = document.getElementById('page-content-wrapper');
const depositModal = document.getElementById('deposit-modal');
const mainTitle = document.querySelector('#main-content-wrapper h1');

// Cache keys partagés avec cartable.js pour préchauffage silencieux
const ED_CACHE_KEYS = {
    notes: 'ED_NOTES',
    devoirs: 'ED_DEVOIRS',
    devRange: 'ED_DEV_RANGE'
};

function edGetSiteUser() {
    try { return (localStorage.getItem('source_username') || '').trim(); } catch { return ''; }
}

function edCacheKey(base) {
    const u = edGetSiteUser().toLowerCase();
    if (!u) return '';
    return base + ':' + u;
}

// =================================================================
// Notifications de points (toast discret en haut)
// =================================================================
(function installPointsToastAndAutoDetect() {
    if (window.__pointsToastInstalled) return;
    window.__pointsToastInstalled = true;

    const HOST_ID = 'points-toast-host';
    let activeToastEl = null;
    let hideDelayTimer = null;
    let hideAnimTimer = null;

    function getUser() {
        try { return String(localStorage.getItem('source_username') || '').trim(); } catch { return ''; }
    }

    function getLastPointsKey(username) {
        const u = String(username || '').trim().toLowerCase();
        if (!u) return '';
        return `source_last_points:${u}`;
    }

    function getLastPoints(username) {
        try {
            const k = getLastPointsKey(username);
            if (!k) return null;
            const v = localStorage.getItem(k);
            if (v == null) return null;
            const n = Number(v);
            return Number.isFinite(n) ? n : null;
        } catch {
            return null;
        }
    }

    function setLastPoints(username, points) {
        try {
            const k = getLastPointsKey(username);
            if (!k) return;
            const n = Number(points);
            if (!Number.isFinite(n)) return;
            localStorage.setItem(k, String(n));
        } catch { }
    }

    function ensureHost() {
        let host = document.getElementById(HOST_ID);
        if (host) return host;
        host = document.createElement('div');
        host.id = HOST_ID;
        document.body.appendChild(host);
        return host;
    }

    function clearTimers() {
        if (hideDelayTimer) clearTimeout(hideDelayTimer);
        if (hideAnimTimer) clearTimeout(hideAnimTimer);
        hideDelayTimer = null;
        hideAnimTimer = null;
    }

    function hideToast(immediate) {
        if (!activeToastEl) return;
        clearTimers();

        const el = activeToastEl;
        el.classList.add('is-hiding');
        el.classList.remove('is-visible');

        const removeAfter = immediate ? 180 : 1100;
        hideAnimTimer = setTimeout(() => {
            try { el.remove(); } catch { }
            if (activeToastEl === el) activeToastEl = null;
        }, removeAfter);
    }

    function showPointsToast(delta, reason) {
        const d = Number(delta);
        if (!Number.isFinite(d) || d === 0) return;

        // Crée le host même si la page a été injectée dynamiquement
        if (!document.body) return;
        const host = ensureHost();
        clearTimers();

        const abs = Math.abs(d);
        const ptsLabel = abs === 1 ? 'point' : 'points';
        const verb = d > 0 ? 'gagner' : 'perdre';
        const amountStr = d > 0 ? `+${abs}` : `${abs}`;
        const msg = `Tu viens de ${verb} ${amountStr} ${ptsLabel}${reason ? ` (${reason})` : ''}`;

        if (!activeToastEl) {
            const el = document.createElement('div');
            el.className = 'points-toast';
            el.setAttribute('role', 'status');
            el.setAttribute('aria-live', 'polite');
            el.innerHTML = `
                <div class="points-toast__text"></div>
                <button class="points-toast__close" type="button" aria-label="Fermer">×</button>
            `;
            const closeBtn = el.querySelector('.points-toast__close');
            if (closeBtn) closeBtn.addEventListener('click', () => hideToast(true));
            host.appendChild(el);
            activeToastEl = el;
        }

        const textEl = activeToastEl.querySelector('.points-toast__text');
        if (textEl) textEl.textContent = msg;
        activeToastEl.classList.remove('is-hiding');

        // Trigger animation
        requestAnimationFrame(() => {
            if (activeToastEl) activeToastEl.classList.add('is-visible');
        });

        // Auto hide: 2s d'affichage puis 1s de fade (géré par CSS)
        hideDelayTimer = setTimeout(() => hideToast(false), 2000);
    }

    function recordPointsTotal(newTotal, reason) {
        const username = getUser();
        if (!username) return;
        const next = Number(newTotal);
        if (!Number.isFinite(next)) return;

        const prev = getLastPoints(username);
        setLastPoints(username, next);

        // Ne pas notifier au tout premier enregistrement
        if (prev == null) return;
        const delta = next - prev;
        if (delta !== 0) showPointsToast(delta, reason);
    }

    function applyPointsDelta(delta, reason) {
        const username = getUser();
        if (!username) {
            showPointsToast(delta, reason);
            return;
        }
        const prev = getLastPoints(username);
        if (prev != null) setLastPoints(username, prev + Number(delta));
        showPointsToast(delta, reason);
    }

    // Expose utilitaires (optionnel)
    window.showPointsToast = showPointsToast;
    window.__recordPointsTotal = recordPointsTotal;
    window.__applyPointsDelta = applyPointsDelta;

    function handlePointsPayload(payload) {
        if (!payload || typeof payload !== 'object') return;

        // Deltas explicites
        if (typeof payload.pointsDelta === 'number') return applyPointsDelta(payload.pointsDelta);
        if (typeof payload.deltaPoints === 'number') return applyPointsDelta(payload.deltaPoints);
        if (typeof payload.pointsAwarded === 'number') return applyPointsDelta(payload.pointsAwarded, 'vote');
        if (typeof payload.pointsSpent === 'number') return applyPointsDelta(-Math.abs(payload.pointsSpent));
        if (typeof payload.pointsCost === 'number') return applyPointsDelta(-Math.abs(payload.pointsCost));

        // Totaux connus => calc delta via last_points
        if (typeof payload.newIndividualPoints === 'number') return recordPointsTotal(payload.newIndividualPoints);
        if (typeof payload.individualPoints === 'number') return recordPointsTotal(payload.individualPoints);
        if (payload.user && typeof payload.user.points === 'number') return recordPointsTotal(payload.user.points);
        if (typeof payload.newPoints === 'number') return recordPointsTotal(payload.newPoints);
    }

    // Intercepteur global de fetch: détecte automatiquement les changements de points
    try {
        const originalFetch = window.fetch ? window.fetch.bind(window) : null;
        if (originalFetch) {
            window.fetch = function patchedFetch(...args) {
                const p = originalFetch(...args);
                Promise.resolve(p).then(res => {
                    try {
                        const clone = res.clone();
                        const ct = (clone.headers && clone.headers.get && clone.headers.get('content-type')) || '';
                        if (String(ct).includes('application/json')) {
                            clone.json().then(handlePointsPayload).catch(() => { });
                        }
                    } catch { }
                }).catch(() => { });
                return p;
            };
        }
    } catch { }
})();

// =================================================================
// UI: rendu d'étoiles (quart par quart) réutilisable
// =================================================================
(function installGlobalStarsRenderer() {
    if (window.renderQuarterStarsHtml) return;

    let uid = 0;
    function roundedQuarter(value) {
        return Math.max(0, Math.min(5, Math.round(value * 4) / 4));
    }

    window.renderQuarterStarsHtml = function renderQuarterStarsHtml(rating, variant) {
        const clamped = Math.max(0, Math.min(5, Number(rating) || 0));
        const rounded = roundedQuarter(clamped);
        const totalQuarters = Math.round(rounded * 4);
        const klass = variant === 'modal' ? 'sstars sstars--modal' : 'sstars sstars--badge';
        const fillRank = { tl: 1, bl: 2, br: 3, tr: 4 }; // TL=0.25, BL=0.50, BR=0.75, TR=1.0
        const stars = [];

        const starPath = 'M12 2.1l2.93 6.4 6.92.6-5.24 4.54 1.56 6.76L12 16.98 5.83 20.4l1.56-6.76L2.15 9.1l6.92-.6L12 2.1z';

        for (let starIndex = 0; starIndex < 5; starIndex++) {
            const maskId = `gstar-mask-${variant || 'badge'}-${++uid}`;
            const starQuarters = Math.max(0, Math.min(4, totalQuarters - starIndex * 4));
            const rect = (pos, x, y) => {
                const filled = starQuarters >= fillRank[pos];
                return `<rect class="sstar-q ${filled ? 'filled' : ''} sstar-q--${pos}" x="${x}" y="${y}" width="12" height="12" />`;
            };

            stars.push(
                `<span class="sstar" aria-hidden="true">
                    <svg class="sstar-svg" viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                        <defs>
                            <mask id="${maskId}">
                                <rect x="0" y="0" width="24" height="24" fill="black" />
                                <path d="${starPath}" fill="white" />
                            </mask>
                        </defs>
                        <path class="sstar-bg" d="${starPath}" />
                        <g mask="url(#${maskId})">
                            ${rect('tl', 0, 0)}
                            ${rect('tr', 12, 0)}
                            ${rect('bl', 0, 12)}
                            ${rect('br', 12, 12)}
                        </g>
                        <path class="sstar-outline" d="${starPath}" />
                    </svg>
                </span>`
            );
        }

        return `<span class="${klass}" aria-label="Note ${rounded.toFixed(2)} sur 5">${stars.join('')}</span>`;
    };
})();

function edTodayYmd() { return new Date().toISOString().slice(0, 10); }
function edAddDaysYmd(ymd, days) { const d = new Date(ymd + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
async function edParseJson(res) { try { return await res.json(); } catch { return null; } }
// Utilisation de localStorage pour persistance accrue (Instant Load)
function edSaveCache(key, val) {
    try {
        const k = edCacheKey(key);
        if (!k) return;
        const payload = { timestamp: Date.now(), data: val };
        localStorage.setItem(k, JSON.stringify(payload));
    } catch { }
}
function edLoadCache(key) {
    try {
        const k = edCacheKey(key);
        if (!k) return null;
        const s = localStorage.getItem(k);
        if (!s) return null;
        const p = JSON.parse(s);
        return p; // Retourne l'objet {timestamp, data}
    } catch { return null; }
}

// devRange est stocké brut dans cartable.js => on fait pareil ici
function edSaveDevRangeRaw(range) {
    try {
        const k = edCacheKey(ED_CACHE_KEYS.devRange);
        if (!k) return;
        localStorage.setItem(k, JSON.stringify(range));
    } catch { }
}

function edLoadDevRangeRaw() {
    try {
        const k = edCacheKey(ED_CACHE_KEYS.devRange);
        if (!k) return null;
        const s = localStorage.getItem(k);
        if (!s) return null;
        return JSON.parse(s);
    } catch { return null; }
}

// 🚨 VARIABLES GLOBALES
let currentPage = 'accueil';
let pollingInterval = null;  // Pour la communauté
let currentUsername = null;  // Nom d'utilisateur courant (mis par updateTitleWithUsername)

/* ------------------------------------------------------------------
   updateTitleWithUsername : vérifie la présence d'un username en localStorage
   et le stocke dans currentUsername. Si pas d'user -> redirection.
   ------------------------------------------------------------------ */
function updateTitleWithUsername() {
    const username = localStorage.getItem('source_username');

    if (username) {
        currentUsername = username;
        // Auto increment connexions if eligible
        fetch('/api/auto_increment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: username })
        }).catch(err => console.error('Auto increment failed:', err));
        // Check if banned
        fetch('/api/check_ban', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: username })
        }).then(res => res.json()).then(data => {
            if (data.banned) {
                // Stocker les infos du ban
                if (data.ban_until) {
                    localStorage.setItem('ban_until', data.ban_until);
                }
                if (data.ban_reason) {
                    localStorage.setItem('ban_reason', data.ban_reason);
                }
                window.location.href = '/pages/ban.html';
            }
        }).catch(err => console.error('Ban check failed:', err));
        document.title = `ALPHA SOURCE - ${username}`;
        console.log(`[LOG] : Titre mis à jour pour l'utilisateur ${username}.`);

        // Bootstrap du "dernier total" pour que les deltas soient détectés dès la 1ère action
        // (silencieux: ne déclenche pas de notif à ce moment)
        try {
            fetch('/api/all.json', { headers: { 'Accept': 'application/json' } })
                .then(r => r.ok ? r.json() : null)
                .then(data => {
                    const ranking = Array.isArray(data?.user_ranking) ? data.user_ranking : [];
                    const me = ranking.find(u => String(u?.username || '') === String(username));
                    const pts = me?.points;
                    if (typeof pts === 'number' && typeof window.__recordPointsTotal === 'function') {
                        window.__recordPointsTotal(pts, 'sync');
                    }
                })
                .catch(() => { });
        } catch { }

        return true;
    } else {
        document.title = "SOURCE AI - Bienvenue (Redirection)";
        const currentPath = window.location.pathname;
        if (currentPath !== '/pages/login.html') {
            window.location.href = '/pages/login.html';
        }
        return false;
    }
}

/* ------------------------------------------------------------------
   Gestion de la sidebar (toggle)
   ------------------------------------------------------------------ */
if (toggleSidebarBtn && sidebar) {
    toggleSidebarBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });
}

// Gestion de l'overlay pour fermer la sidebar sur mobile
if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
    });
}

// Gestion du hamburger menu mobile
const mobileHamburgerBtn = document.getElementById('mobile-hamburger-btn');
if (mobileHamburgerBtn && sidebar) {
    mobileHamburgerBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });
}

/* ------------------------------------------------------------------
   renderPage(page) : charge dynamiquement la page et initialise
   les scripts spécifiques après injection.
   ------------------------------------------------------------------ */
async function renderPage(page) {
    currentPage = page;
    window.__alphaCurrentPage = page;
    try { document.body.setAttribute('data-page', page); } catch { }
    window.scrollTo(0, 0);

    // Dynamic page title for accessibility
    const PAGE_TITLES = {
        accueil: 'Accueil', home: 'SOURCE AI', chat: 'SOURCE AI',
        cours: 'Mes Cours', communaute: 'Communauté', messagerie: 'Messagerie',
        cartable: 'Cartable', info: 'Info', moncompte: 'Mon Compte'
    };
    const user = currentUsername || '';
    document.title = `${PAGE_TITLES[page] || 'ALPHA SOURCE'}${user ? ' - ' + user : ''}`;

    const rightSidebarControls = document.getElementById('right-sidebar-controls');
    const depositCourseButton = document.getElementById('deposit-course-button');
    const localMainTitle = document.querySelector('#main-content-wrapper h1');

    // Gérer le titre du header mobile
    const mobileHeaderTitle = document.querySelector('#mobile-header-title');
    if (mobileHeaderTitle) {
        if (page === 'home' || page === 'chat') {
            mobileHeaderTitle.textContent = '';
        } else {
            mobileHeaderTitle.textContent = 'ALPHA SOURCE';
        }
    }

    if (!pageContentWrapper) {
        console.error("[LOG] : #page-content-wrapper introuvable.");
        return;
    }

    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
        currentMessages = [];
        console.log("[LOG] : Polling arrêté (changement de page).");
    }

    let contentFile = '';
    if (page === 'home' || page === 'chat') contentFile = '/pages/chat.html';
    else if (page === 'cours') contentFile = '/pages/cours.html';
    else if (page === 'communaute') contentFile = '/pages/communaute.html';
    else if (page === 'messagerie') contentFile = '/pages/mess.html'; // 🚨 AJOUT MESSAGERIE 🚨
    else if (page === 'accueil') contentFile = '/pages/home.html';
    else if (page === 'cartable') contentFile = '/pages/cartable.html';
    else if (page === 'info') contentFile = '/pages/info.html';
    else if (page === 'moncompte') contentFile = '/pages/moncompte.html';
    else {
        pageContentWrapper.innerHTML = '<h2>Page non trouvée.</h2>';
        updateActiveMenuClass(page);
        return;
    }

    try {
        const response = await fetch(contentFile);

        // Show skeleton while loading
        if (typeof window.getSkeletonHtml === 'function') {
            pageContentWrapper.innerHTML = window.getSkeletonHtml(page);
            pageContentWrapper.classList.remove('page-exit');
            void pageContentWrapper.offsetWidth;
        }

        if (!response.ok) {
            pageContentWrapper.innerHTML = `<h2>Erreur de chargement ${contentFile} (${response.status})</h2>`;
            return;
        }

        let contentHtml = await response.text();

        // --- Page transition: fade-out then inject + fade-in ---
        pageContentWrapper.classList.remove('page-enter');
        pageContentWrapper.classList.add('page-exit');
        await new Promise(r => setTimeout(r, 120));

        if (page === 'cours') {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = contentHtml;
            const courseContent = tempDiv.querySelector('#course-content-layout');
            const modalContent = tempDiv.querySelector('#deposit-modal-content');
            pageContentWrapper.innerHTML = courseContent ? courseContent.outerHTML : 'Erreur de chargement cours.';
            if (depositModal && modalContent) depositModal.innerHTML = modalContent.innerHTML;
        } else {
            pageContentWrapper.innerHTML = contentHtml;
        }

        pageContentWrapper.classList.remove('page-exit');
        void pageContentWrapper.offsetWidth; // force reflow
        pageContentWrapper.classList.add('page-enter');
    } catch (err) {
        pageContentWrapper.innerHTML = `<h2>Erreur de réseau : ${err.message}</h2>`;
        console.error("[LOG] : Erreur fetch page :", err);
        return;
    }

    // --- INITIALISATIONS SPECIFIQUES POST-INJECTION ---
    setTimeout(() => {
        if (page === 'home' || page === 'chat') {
            if (rightSidebarControls) {
                // Don't force desktop controls on mobile; let responsive CSS handle it
                rightSidebarControls.style.display = (window.innerWidth <= 768) ? 'none' : 'block';
            }
            if (depositCourseButton) depositCourseButton.style.display = 'none';
            // Masquer le titre principal sur mobile pour la page chat
            if (localMainTitle) {
                if (window.innerWidth <= 768 && (page === 'home' || page === 'chat')) {
                    localMainTitle.style.display = 'none';
                } else {
                    localMainTitle.style.display = 'block';
                }
            }
            if (typeof window.initChatPage === 'function') window.initChatPage();
        } else if (page === 'accueil') { // <-- init home
            if (rightSidebarControls) rightSidebarControls.style.display = 'block';
            if (depositCourseButton) depositCourseButton.style.display = 'none';

            // --- Cacher le h1 "The Source" uniquement pour home
            if (localMainTitle) localMainTitle.style.display = 'none';

            if (typeof window.initHomePage === 'function') {
                try { window.initHomePage(); } catch (e) { console.error(e); }
            }
        } else if (page === 'cours') {
            if (rightSidebarControls) rightSidebarControls.style.display = 'none';
            if (depositCourseButton) depositCourseButton.style.display = 'block';
            if (localMainTitle) localMainTitle.style.display = 'none';

            const courseContentLayout = document.getElementById('course-content-layout');
            if (courseContentLayout) {
                const observer = new MutationObserver((mutations, obs) => {
                    const fileGrid = document.getElementById('file-grid');
                    if (fileGrid) {
                        fileGrid.style.display = 'grid';
                        fileGrid.style.placeItems = 'center';
                        console.log("[LOG] : #file-grid layout appliqué via MutationObserver (cours)");
                        obs.disconnect();
                    }
                });
                observer.observe(courseContentLayout, { childList: true, subtree: true });
            }

            if (typeof window.__CourseModuleInit === 'function') {
                try { window.__CourseModuleInit(); }
                catch (e) { console.error("Erreur init Cours :", e); }
            }
        } else if (page === 'communaute') {
            if (rightSidebarControls) rightSidebarControls.style.display = 'none';
            if (depositCourseButton) depositCourseButton.style.display = 'none';
            if (localMainTitle) localMainTitle.style.display = 'none';

            setTimeout(() => {
                if (typeof window.initCommunityChat === 'function') {
                    try { window.initCommunityChat(); } catch (e) { console.error(e); }
                } else if (typeof window.initCommunautePage === 'function') {
                    try { window.initCommunautePage(); } catch (e) { console.error(e); }
                }
            }, 60);

        } else if (page === 'messagerie') { // 🚨 NOUVELLE INITIALISATION MESSAGERIE 🚨
            if (rightSidebarControls) rightSidebarControls.style.display = 'none';
            if (depositCourseButton) depositCourseButton.style.display = 'none';
            if (localMainTitle) localMainTitle.style.display = 'none'; // Cache le h1

            // Appelle la fonction d'initialisation de mess.js si elle existe
            if (typeof window.initMessageriePage === 'function') {
                try { window.initMessageriePage(); }
                catch (e) { console.error("Erreur init Messagerie :", e); }
            }
        } else if (page === 'cartable') {
            if (rightSidebarControls) rightSidebarControls.style.display = 'none';
            if (depositCourseButton) depositCourseButton.style.display = 'none';
            if (localMainTitle) localMainTitle.style.display = 'none';

            if (typeof window.initCartablePage === 'function') {
                try { window.initCartablePage(); } catch (e) { console.error('Erreur init Cartable :', e); }
            }
        } else if (page === 'info') {
            if (rightSidebarControls) rightSidebarControls.style.display = 'none';
            if (depositCourseButton) depositCourseButton.style.display = 'none';
            if (localMainTitle) localMainTitle.style.display = 'none';

            const displayUsernameElement = document.getElementById('user-name-placeholder');
            if (typeof window.initInfoPage === 'function' && displayUsernameElement) {
                try { window.initInfoPage(displayUsernameElement); } catch (e) { console.error(e); }
            }
        } else if (page === 'moncompte') {
            if (rightSidebarControls) rightSidebarControls.style.display = 'none';
            if (depositCourseButton) depositCourseButton.style.display = 'none';
            if (localMainTitle) localMainTitle.style.display = 'none';

            // Appelle la fonction d'initialisation de moncompte.js si elle existe
            if (typeof window.initMonComptePage === 'function') {
                try { window.initMonComptePage(); }
                catch (e) { console.error("Erreur init Mon Compte :", e); }
            }
        }

        try {
            window.dispatchEvent(new CustomEvent('alpha:page-rendered', { detail: { page } }));
        } catch { }
    }, 60);

    updateActiveMenuClass(page);
}

/* ------------------------------------------------------------------
   updateActiveMenuClass : met la classe active sur le menu
   ------------------------------------------------------------------ */
function updateActiveMenuClass(page) {
    // Mettre à jour le menu principal (sidebar)
    if (mainMenu) {
        mainMenu.querySelectorAll('a').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('data-page') === page) link.classList.add('active');
        });
    }

    // Mettre à jour la navigation mobile
    const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');
    mobileNavLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('data-page') === page) link.classList.add('active');
    });
}

/* ------------------------------------------------------------------
   createMenu : crée le menu principal (safe si #main-menu manquant)
   ------------------------------------------------------------------ */
function createMenu() {
    if (!mainMenu) {
        console.warn("[LOG] : #main-menu introuvable, menu non créé.");
        return;
    }

    const pages = [
        { name: '-Accueil', id: 'accueil', iconFile: '/ressources/homemenuicon.png' },
        { name: '-SOURCE AI', id: 'home', iconFile: '/ressources/kiraaimenuicon.png' },
        { name: '-Mes Cours', id: 'cours', iconFile: '/ressources/coursmenuicon.png' },
        { name: '-Communauté', id: 'communaute', iconFile: '/ressources/communautemenuicon.png' },
        { name: '-Messagerie', id: 'messagerie', iconFile: '/ressources/messageriemenuicon.png' }, // 🚨 AJOUT MESSAGERIE 🚨
        { name: '-Cartable', id: 'cartable', iconFile: '/ressources/cartablemenuicon.png' },
        { name: '-Info', id: 'info', iconFile: '/ressources/infomenuicon.png' },
        { name: '-Mon Compte', id: 'moncompte', iconFile: '/ressources/comptemenuicon.png' }
    ];

    mainMenu.innerHTML = '';
    pages.forEach(p => {
        const a = document.createElement('a');
        a.href = '#';
        a.classList.add('nav-link');
        a.setAttribute('data-page', p.id);
        a.innerHTML = `<img src="${p.iconFile}" alt="${p.name} icon"><span>${p.name}</span>`;
        a.addEventListener('click', (e) => {
            e.preventDefault();
            renderPage(p.id);
        });
        mainMenu.appendChild(a);
    });
}

/* ------------------------------------------------------------------
   Initialisation globale : au DOMContentLoaded on démarre l'app
   ------------------------------------------------------------------ */
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM chargé → démarrage de l'app.");
    const isAuth = updateTitleWithUsername();
    if (!isAuth) return;

    // Tentative d'auto-login ED + préchargement des données (notes/devoirs) en arrière-plan
    (async () => {
        try {
            const ensureEdLogged = async () => {
                const siteUser = edGetSiteUser();
                if (!siteUser) return false;
                const check = await fetch('/ed/notes', { method: 'GET', headers: { 'x-source-user': siteUser } });
                if (check && check.ok) {
                    const cached = await edParseJson(check);
                    if (cached) edSaveCache(ED_CACHE_KEYS.notes, cached);
                    return true;
                }
                const cfgRes = await fetch('/api/mdped?username=' + encodeURIComponent(siteUser), {
                    method: 'GET',
                    headers: { 'x-source-user': siteUser }
                });
                if (!cfgRes.ok) return false;
                const cfg = await cfgRes.json();
                if (!(cfg && cfg.id && cfg.mdp)) return false;
                const lr = await fetch('/ed/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ identifiant: cfg.id, motdepasse: cfg.mdp, username: siteUser })
                });
                const ljson = await edParseJson(lr);
                return lr.ok && ljson && ljson.success;
            };

            if (!(await ensureEdLogged())) return;

            const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

            // Précharge notes
            try {
                const cachedNotes = edLoadCache(ED_CACHE_KEYS.notes);
                const notesAge = cachedNotes ? (Date.now() - (cachedNotes.timestamp || 0)) : Infinity;

                if (!cachedNotes || notesAge > CACHE_TTL) {
                    console.log('[Script] Refreshing Notes cache...');
                    const siteUser = edGetSiteUser();
                    const notesRes = await fetch('/ed/notes', { method: 'GET', headers: siteUser ? { 'x-source-user': siteUser } : undefined });
                    const notesJson = await edParseJson(notesRes);
                    if (notesRes.ok && notesJson) edSaveCache(ED_CACHE_KEYS.notes, notesJson);
                } else {
                    console.log('[Script] Notes cache is fresh.');
                }
            } catch { }

            // Précharge devoirs sur 30 jours
            try {
                const cachedDev = edLoadCache(ED_CACHE_KEYS.devoirs);
                const devAge = cachedDev ? (Date.now() - (cachedDev.timestamp || 0)) : Infinity;

                if (!cachedDev || devAge > CACHE_TTL) {
                    console.log('[Script] Refreshing Devoirs cache...');
                    const start = edTodayYmd();
                    const end = edAddDaysYmd(start, 30);
                    const siteUser = edGetSiteUser();
                    const devRes = await fetch(`/ed/devoirs?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
                        { method: 'GET', headers: siteUser ? { 'x-source-user': siteUser } : undefined }
                    );
                    const devJson = await edParseJson(devRes);
                    if (devRes.ok && devJson) {
                        edSaveCache(ED_CACHE_KEYS.devoirs, devJson);
                        edSaveDevRangeRaw({ start, end });
                    }
                } else {
                    console.log('[Script] Devoirs cache is fresh.');
                }
            } catch { }
        } catch (e) {
            // silencieux
        }
    })();

    createMenu();
    renderPage(currentPage);

    // === Notification red dots ===
    (function initNotificationDots() {
        function setDot(pageId, count) {
            // Desktop sidebar
            const desktopLink = document.querySelector(`.nav-link[data-page="${pageId}"]`);
            if (desktopLink) {
                let dot = desktopLink.querySelector('.notif-dot');
                if (count > 0) {
                    if (!dot) {
                        dot = document.createElement('span');
                        dot.className = 'notif-dot';
                        desktopLink.style.position = 'relative';
                        // Force inline styles to guarantee visibility
                        Object.assign(dot.style, {
                            position: 'absolute',
                            top: '2px',
                            left: '30px',
                            minWidth: '16px',
                            height: '16px',
                            background: '#e74c3c',
                            color: '#fff',
                            fontSize: '10px',
                            fontWeight: '800',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '0 3px',
                            lineHeight: '1',
                            zIndex: '9999',
                            pointerEvents: 'none'
                        });
                        desktopLink.appendChild(dot);
                    }
                    dot.textContent = count > 9 ? '9+' : count;
                } else if (dot) {
                    dot.remove();
                }
            }
            // Mobile nav
            const mobileLink = document.querySelector(`.mobile-nav-link[data-page="${pageId}"]`);
            if (mobileLink) {
                let dot = mobileLink.querySelector('.notif-dot');
                if (count > 0) {
                    if (!dot) {
                        dot = document.createElement('span');
                        dot.className = 'notif-dot';
                        mobileLink.style.position = 'relative';
                        mobileLink.appendChild(dot);
                    }
                    dot.textContent = count > 9 ? '9+' : count;
                } else if (dot) {
                    dot.remove();
                }
            }
        }

        async function checkNotifications() {
            const username = (localStorage.getItem('source_username') || '').trim();
            if (!username) return;

            // Check unread messagerie
            try {
                // Inline user ID resolution (same as home.js MESS_CLASS_NAMES)
                const CLASS_NAMES = [
                    'Even','Alexandre','Calixte','Noé','Julia','Joan','Juliette','Jezy',
                    'Inès','Timéo','Tyméo','Clautilde','Loanne','Lucie','Camille','Sofia',
                    'Lilia','Amir','Robin','Arthur','Maxime','Gaultier','Antoine','Louis',
                    'Anne-Victoria','Léa','Sarah','Ema','Jade','Alicia','Claire'
                ];
                const lower = username.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
                let uid = null;
                if (lower.includes('source ai')) uid = '1';
                else if (lower.includes('source admin')) uid = '2';
                else {
                    const idx = CLASS_NAMES.findIndex(n => n.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === lower);
                    if (idx >= 0) uid = String(idx + 3);
                }
                if (uid) {
                    const res = await fetch(`/api/messagerie/messages?userId=${encodeURIComponent(uid)}`);
                    if (res.ok) {
                        const msgs = await res.json();
                        if (Array.isArray(msgs)) {
                            const unread = msgs.filter(m => m && m.unread === true).length;
                            setDot('messagerie', unread);
                        }
                    }
                }
            } catch {}

            // Check unread community
            try {
                const cRes = await fetch(`/public/api/community/unread-count?username=${encodeURIComponent(username)}`);
                if (cRes.ok) {
                    const cData = await cRes.json();
                    if (cData.success && cData.count > 0) {
                        setDot('communaute', cData.count);
                    } else if (cData.success) {
                        setDot('communaute', 0);
                    }
                }
            } catch (e) { console.error('[NOTIF] Community error:', e); }
        }

        // Run immediately then every 30 seconds
        setTimeout(checkNotifications, 2000);
        setInterval(checkNotifications, 30000);
        // Expose so other modules can trigger a refresh
        window.__checkNotifications = checkNotifications;
    })();

    // === Random shine effect on buttons ===
    (function initRandomShine() {
        const RAINBOW_CHANCE = 0.08; // 8% chance of multicolor
        const MIN_DELAY = 4000;  // min 4s between shines
        const MAX_DELAY = 12000; // max 12s

        function doShine() {
            const btns = Array.from(document.querySelectorAll(
                '#page-content-wrapper button, #page-content-wrapper .nav-link, .mobile-nav-link, #main-menu a, .widget-box h3'
            )).filter(el => {
                const r = el.getBoundingClientRect();
                return r.width > 0 && r.height > 0;
            });
            if (!btns.length) return scheduleNext();

            const target = btns[Math.floor(Math.random() * btns.length)];
            const isRainbow = Math.random() < RAINBOW_CHANCE;

            // Prepare the element
            target.classList.add('btn-shine-wrap');
            const streak = document.createElement('span');
            streak.className = 'shine-streak' + (isRainbow ? ' rainbow' : '');
            target.appendChild(streak);

            // Clean up after animation
            streak.addEventListener('animationend', () => {
                streak.remove();
                target.classList.remove('btn-shine-wrap');
            });

            scheduleNext();
        }

        function scheduleNext() {
            const delay = MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY);
            setTimeout(doShine, delay);
        }

        // Start after page loads
        setTimeout(doShine, 3000);
    })();

    // Ajouter les event listeners pour la navigation mobile
    const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');
    mobileNavLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.getAttribute('data-page');
            renderPage(page);
        });
    });

    // Load active skin and apply theme site-wide
    try {
        const username = localStorage.getItem('source_username');
        if (username) {
            fetch(`/api/user-info/${username}`)
                .then(res => res.json())
                .then(data => {
                    const skin = (data && data.user && data.user.active_skin) || 'bleu basique';
                    if (typeof window.applySkinTheme === 'function') {
                        window.applySkinTheme(skin);
                    }

                    const fond = (data && data.user && data.user.active_fond) || 'Vagues';
                    if (typeof window.applyFondTheme === 'function') {
                        window.applyFondTheme(fond);
                    }
                })
                .catch(err => console.error('[SKINS] Failed to load active skin:', err));
        }
    } catch (e) { console.error(e); }
});

// Allow other modules to apply theme after changes
window.applySkinTheme = function (skinName) {
    const name = (skinName || 'bleu basique').toLowerCase();

    // Map skin names to data-skin values
    const skinMap = {
        'verdure': 'skin-verdure',
        'skin-verdure': 'skin-verdure',
        'obsidienne': 'skin-obsidienne',
        'skin-obsidienne': 'skin-obsidienne',
        'sunset': 'skin-sunset',
        'skin-sunset': 'skin-sunset',
        'grenat': 'skin-grenat',
        'skin-grenat': 'skin-grenat',
        'rose': 'skin-rose',
        'skin-rose': 'skin-rose',
        'neon': 'skin-neon',
        'skin-neon': 'skin-neon',
        'chocolat': 'skin-chocolat',
        'skin-chocolat': 'skin-chocolat',
        'indigo': 'skin-indigo',
        'skin-indigo': 'skin-indigo',
        'jaune': 'skin-jaune',
        'skin-jaune': 'skin-jaune',
        'marbre': 'skin-marbre',
        'skin-marbre': 'skin-marbre',
        'aurore': 'skin-aurore',
        'skin-aurore': 'skin-aurore',
        'pastel': 'skin-pastel',
        'skin-pastel': 'skin-pastel',
        'cyberpunk': 'skin-cyberpunk',
        'skin-cyberpunk': 'skin-cyberpunk',
        'foret': 'skin-foret',
        'forêt': 'skin-foret',
        'skin-foret': 'skin-foret',
        'skin-forêt': 'skin-foret',
        'sable': 'skin-sable',
        'sable chaud': 'skin-sable',
        'skin-sable': 'skin-sable',
        'minuit': 'skin-minuit',
        'skin-minuit': 'skin-minuit',
        'ocean': 'skin-ocean',
        'océan': 'skin-ocean',
        'skin-ocean': 'skin-ocean',
        'lavande': 'skin-lavande',
        'skin-lavande': 'skin-lavande',
        'cerise': 'skin-cerise',
        'skin-cerise': 'skin-cerise',
        'arctique': 'skin-arctique',
        'skin-arctique': 'skin-arctique',
        'jaune basique': 'skin-jaune',
        'bleu basique': 'bleu-basique' // dark blue theme
    };

    const dataSkinValue = skinMap[name] || '';

    if (dataSkinValue) {
        document.documentElement.setAttribute('data-skin', dataSkinValue);
    } else {
        document.documentElement.removeAttribute('data-skin');
    }
}

// Allow other modules to apply background (fond)
window.applyFondTheme = function (fondId) {
    const raw = String(fondId || 'Vagues').trim();
    const key = raw.toLowerCase();

    // Default = bottom waves (no attribute)
    if (!raw || key === 'vagues') {
        document.documentElement.removeAttribute('data-fond');
        try {
            if (typeof window.__setFondCanvasMode === 'function') {
                window.__setFondCanvasMode('');
            }
        } catch { }
        return;
    }

    // Support both id and display name

    const map = {
        'vagues-inversees': 'vagues-inversees',
        'vagues inversées': 'vagues-inversees',
        'lineaire': 'lineaire',
        'linéaire': 'lineaire',
        'duel': 'duel',
        'ondes': 'ondes',
        'pixelart': 'pixel-art',
        'pixel-art': 'pixel-art',
        'pixel art': 'pixel-art',
        'aurore': 'aurora',
        'aurora': 'aurora',
        'papier': 'crumpled-paper',
        'papier froissé': 'crumpled-paper',
        'crumpled-paper': 'crumpled-paper',
        'papier-froisse': 'crumpled-paper',
        'papier-froissé': 'crumpled-paper'
    };

    const dataFondValue = map[key] || '';
    if (dataFondValue) {
        document.documentElement.setAttribute('data-fond', dataFondValue);
    } else {
        document.documentElement.removeAttribute('data-fond');
    }

    // Synchroniser le rendu canvas global (si installé)
    try {
        if (typeof window.__setFondCanvasMode === 'function') {
            window.__setFondCanvasMode(dataFondValue);
        }
    } catch { }
};

// =================================================================
// Fonds animés (canvas overlay): Linéaire / Duel / Ondes
// =================================================================
(function installFondCanvasRenderer() {
    if (window.__fondCanvasInstalled) return;
    window.__fondCanvasInstalled = true;

    let canvas = null;
    let ctx = null;
    let rafId = 0;
    let mode = '';
    let w = 0;
    let h = 0;
    let dpr = 1;
    let lastTs = 0;
    let lineOffset = 0;
    let rings = [];
    let nextRingAt = 0;

    // Duel state (2 orbs)
    let duel = null;

    function clamp01(v) { return Math.max(0, Math.min(1, v)); }
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
    function lerp(a, b, t) { return a + (b - a) * t; }
    function rand(min, max) { return min + Math.random() * (max - min); }

    function parseCssColorToRgb(input) {
        const s = String(input || '').trim();
        if (!s) return { r: 77, g: 124, b: 255 };
        if (s.startsWith('#')) {
            const hex = s.slice(1);
            if (hex.length === 3) {
                const r = parseInt(hex[0] + hex[0], 16);
                const g = parseInt(hex[1] + hex[1], 16);
                const b = parseInt(hex[2] + hex[2], 16);
                if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) return { r, g, b };
            }
            if (hex.length === 6) {
                const r = parseInt(hex.slice(0, 2), 16);
                const g = parseInt(hex.slice(2, 4), 16);
                const b = parseInt(hex.slice(4, 6), 16);
                if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) return { r, g, b };
            }
        }
        const m = s.match(/rgba?\((\s*\d+\s*),\s*(\d+)\s*,\s*(\d+)/i);
        if (m) {
            const r = Number(m[1]);
            const g = Number(m[2]);
            const b = Number(m[3]);
            if ([r, g, b].every(n => Number.isFinite(n))) return { r, g, b };
        }
        return { r: 77, g: 124, b: 255 };
    }

    function getThemeRgb() {
        try {
            const styles = getComputedStyle(document.documentElement);
            const accent = (styles.getPropertyValue('--accent') || '').trim();
            const primary = (styles.getPropertyValue('--color-primary') || '').trim();
            return parseCssColorToRgb(accent || primary || '#4d7cff');
        } catch {
            return { r: 77, g: 124, b: 255 };
        }
    }

    function applyBrightness(rgb, factor) {
        const f = Number(factor);
        return {
            r: Math.round(clamp(rgb.r * f, 0, 255)),
            g: Math.round(clamp(rgb.g * f, 0, 255)),
            b: Math.round(clamp(rgb.b * f, 0, 255))
        };
    }

    function rgba(rgb, a) {
        const alpha = clamp01(Number(a) || 0);
        return `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
    }

    function ensureCanvas() {
        if (canvas && ctx) return;
        canvas = document.createElement('canvas');
        canvas.id = 'fond-canvas';
        canvas.setAttribute('aria-hidden', 'true');
        canvas.className = 'pixel-art-bg-canvas';
        canvas.style.zIndex = '2';
        // Ajoute le flou si onglet communauté
        if (document.body.getAttribute('data-page') === 'communaute') {
            canvas.style.backdropFilter = 'blur(12px)';
            canvas.style.webkitBackdropFilter = 'blur(12px)';
        } else {
            canvas.style.backdropFilter = '';
            canvas.style.webkitBackdropFilter = '';
        }

        document.body.appendChild(canvas);
        ctx = canvas.getContext('2d', { alpha: true });
        resize();
    }

    function removeCanvas() {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = 0;
        lastTs = 0;
        rings = [];
        nextRingAt = 0;
        lineOffset = 0;
        if (canvas) {
            try { canvas.remove(); } catch { }
        }
        canvas = null;
        ctx = null;
        w = 0;
        h = 0;
    }

    function resize() {
        if (!canvas) return;
        dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
        w = Math.floor(window.innerWidth);
        h = Math.floor(window.innerHeight);
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        const c = canvas.getContext('2d');
        if (c) {
            ctx = c;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
    }

    function startLoop() {
        if (rafId) return;
        lastTs = performance.now();
        rafId = requestAnimationFrame(loop);
    }

    function stopLoop() {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = 0;
        lastTs = 0;
    }

    function tri(x) {
        const t = x - Math.floor(x);
        return 1 - Math.abs(2 * t - 1);
    }

    function fade(alpha) {
        if (!ctx) return;
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = `rgba(0,0,0,${alpha})`;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
    }

    function drawLineaire(dt, t) {
        if (!ctx) return;
        ctx.clearRect(0, 0, w, h);

        const angle = Math.PI * 0.66; // diagonale
        const dirx = Math.cos(angle);
        const diry = Math.sin(angle);
        const perpx = -diry;
        const perpy = dirx;

        // Plus espacé + plus gros
        const spacing = Math.max(42, Math.min(w, h) / 16);
        lineOffset += dt * 10;
        const shiftBase = (lineOffset % spacing);

        const cx = w / 2;
        const cy = h / 2;
        const len = Math.hypot(w, h) * 1.6;
        const count = Math.ceil((Math.hypot(w, h) + spacing * 6) / spacing);

        ctx.save();
        ctx.globalAlpha = 0.42;
        ctx.lineCap = 'round';

        const baseRgb = getThemeRgb();

        for (let i = -count; i <= count; i++) {
            const p = tri((i + 1000) / 12);
            // Bandes beaucoup plus épaisses
            const lw = 10.0 + p * 34.0;

            const bright = 0.75 + p * 0.55;
            const rgb = applyBrightness(baseRgb, bright);
            ctx.lineWidth = lw;
            ctx.strokeStyle = rgba(rgb, 0.20 + p * 0.26);

            const off = i * spacing + shiftBase;
            const px = cx + perpx * off;
            const py = cy + perpy * off;

            ctx.beginPath();
            ctx.moveTo(px - dirx * len, py - diry * len);
            ctx.lineTo(px + dirx * len, py + diry * len);
            ctx.stroke();
        }

        ctx.restore();
    }

    function drawDuel(dt, t) {
        if (!ctx) return;
        // Deux GROSSES boules, gros dégradé estompé, déplacement lent vers les coins,
        // couleur = thème, variations aléatoires (clair/foncé + taille)
        ctx.clearRect(0, 0, w, h);

        const baseRgb = getThemeRgb();
        const baseRadius = Math.max(120, Math.min(w, h) * 0.18);
        const pad = Math.max(10, Math.min(140, baseRadius * 0.30));

        // Chaque boule reste dans "son coin" mais bouge doucement (cibles pseudo-aléatoires)
        function cornerZone(cornerId, r) {
            const safe = Math.max(pad, r * 0.9);
            const zx = Math.max(180, w * 0.38);
            const zy = Math.max(180, h * 0.38);

            if (cornerId === 'tl') return { minX: safe, maxX: Math.min(w - safe, zx), minY: safe, maxY: Math.min(h - safe, zy) };
            if (cornerId === 'tr') return { minX: Math.max(safe, w - zx), maxX: w - safe, minY: safe, maxY: Math.min(h - safe, zy) };
            if (cornerId === 'bl') return { minX: safe, maxX: Math.min(w - safe, zx), minY: Math.max(safe, h - zy), maxY: h - safe };
            return { minX: Math.max(safe, w - zx), maxX: w - safe, minY: Math.max(safe, h - zy), maxY: h - safe };
        }

        function pickTargetInZone(zone) {
            return {
                x: rand(zone.minX, zone.maxX),
                y: rand(zone.minY, zone.maxY)
            };
        }

        function ensureDuelInit(now) {
            if (duel) return;
            const zoneA = cornerZone('tl', baseRadius);
            const zoneB = cornerZone('br', baseRadius);
            const ta = pickTargetInZone(zoneA);
            const tb = pickTargetInZone(zoneB);
            duel = {
                a: {
                    corner: 'tl',
                    x: zoneA.minX, y: zoneA.minY,
                    tx: ta.x, ty: ta.y,
                    vx: 0, vy: 0,
                    size: 1.0, sizeTarget: 1.0,
                    bright: 1.0, brightTarget: 1.0,
                    nextStyleAt: now + rand(1.2, 2.4),
                    nextTargetAt: now + rand(1.6, 3.2)
                },
                b: {
                    corner: 'br',
                    x: zoneB.maxX, y: zoneB.maxY,
                    tx: tb.x, ty: tb.y,
                    vx: 0, vy: 0,
                    size: 1.0, sizeTarget: 1.0,
                    bright: 0.85, brightTarget: 0.85,
                    nextStyleAt: now + rand(1.2, 2.6),
                    nextTargetAt: now + rand(1.7, 3.4)
                }
            };
        }

        function smoothToward(current, target, halfLifeSeconds) {
            const hl = Math.max(0.05, Number(halfLifeSeconds) || 0.35);
            const k = 1 - Math.pow(0.5, dt / hl);
            return current + (target - current) * k;
        }

        function updateOrb(orb, now) {
            const r = baseRadius * orb.size;

            // Choix de nouveaux objectifs (pseudo-aléatoire) dans la zone du coin
            if (now >= orb.nextTargetAt) {
                const zone = cornerZone(orb.corner, r);
                const nt = pickTargetInZone(zone);
                orb.tx = nt.x;
                orb.ty = nt.y;
                // Beaucoup moins de changements de direction => impression "vivante" mais lente
                orb.nextTargetAt = now + rand(22.0, 38.0);
            }

            // Style: changements progressifs (pas d'un coup)
            if (now >= orb.nextStyleAt) {
                orb.sizeTarget = rand(0.85, 1.15);
                orb.brightTarget = rand(0.70, 1.18);
                orb.nextStyleAt = now + rand(2.0, 4.2);
            }

            orb.size = smoothToward(orb.size, orb.sizeTarget, 0.65);
            orb.bright = smoothToward(orb.bright, orb.brightTarget, 0.90);

            // Mouvement doux: steering vers la cible + friction
            // Mouvement BEAUCOUP plus lent (flotte dans le coin)
            const steer = 0.002; // force (quasi immobile)
            orb.vx += (orb.tx - orb.x) * steer * dt;
            orb.vy += (orb.ty - orb.y) * steer * dt;

            const drag = Math.pow(0.004, dt); // damping (quasi figé)
            orb.vx *= drag;
            orb.vy *= drag;

            const maxV = 0.22; // limite vitesse (presque figé)
            const vlen = Math.hypot(orb.vx, orb.vy) || 1;
            if (vlen > maxV) {
                orb.vx = (orb.vx / vlen) * maxV;
                orb.vy = (orb.vy / vlen) * maxV;
            }

            orb.x += orb.vx;
            orb.y += orb.vy;

            // Keep inside zone
            const zone = cornerZone(orb.corner, baseRadius * orb.size);
            orb.x = clamp(orb.x, zone.minX, zone.maxX);
            orb.y = clamp(orb.y, zone.minY, zone.maxY);
        }

        function drawOrb(orb) {
            const r = baseRadius * orb.size;
            const glowR = r * 2.6;
            const rgb = applyBrightness(baseRgb, orb.bright);

            const g = ctx.createRadialGradient(orb.x, orb.y, r * 0.08, orb.x, orb.y, glowR);
            g.addColorStop(0, rgba(rgb, 0.62));
            g.addColorStop(0.28, rgba(rgb, 0.30));
            g.addColorStop(0.65, rgba(rgb, 0.12));
            g.addColorStop(1, rgba(rgb, 0));
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(orb.x, orb.y, glowR, 0, Math.PI * 2);
            ctx.fill();

            const g2 = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, r);
            g2.addColorStop(0, rgba(rgb, 0.42));
            g2.addColorStop(1, rgba(rgb, 0));
            ctx.fillStyle = g2;
            ctx.beginPath();
            ctx.arc(orb.x, orb.y, r, 0, Math.PI * 2);
            ctx.fill();
        }

        ensureDuelInit(t);
        if (!duel) return;

        updateOrb(duel.a, t);
        updateOrb(duel.b, t);

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        drawOrb(duel.a);
        drawOrb(duel.b);
        ctx.restore();
    }

    function spawnRing(now) {
        // Beaucoup plus lent + beaucoup plus gros (style "bandes" comme les vagues)
        const speed = 18 + Math.random() * 22; // px/s (beaucoup plus lent)
        const width = 26 + Math.random() * 54; // beaucoup plus épais
        const alpha = 0.06 + Math.random() * 0.14;
        const bright = 0.55 + Math.random() * 0.75;
        rings.push({ r: 0, speed, width, alpha, bright });
        nextRingAt = now + 2.6 + Math.random() * 1.6;
    }

    function drawOndes(dt, t) {
        if (!ctx) return;
        ctx.clearRect(0, 0, w, h);

        const baseRgb = getThemeRgb();

        if (t >= nextRingAt) spawnRing(t);
        const cx = w / 2;
        const cy = h / 2;
        const maxR = Math.hypot(w, h) * 0.95;

        ctx.save();
        ctx.globalCompositeOperation = 'source-over';

        for (let i = rings.length - 1; i >= 0; i--) {
            const ring = rings[i];
            ring.r += ring.speed * dt;
            const p = ring.r / maxR;
            const a = ring.alpha * (1 - p);

            if (ring.r > maxR || a <= 0.001) {
                rings.splice(i, 1);
                continue;
            }

            const rgb = applyBrightness(baseRgb, ring.bright);

            // Bande épaisse (comme une "vague") + une sur-couche plus fine
            ctx.strokeStyle = rgba(rgb, a);
            ctx.lineWidth = ring.width;
            ctx.beginPath();
            ctx.arc(cx, cy, ring.r, 0, Math.PI * 2);
            ctx.stroke();

            ctx.strokeStyle = rgba(rgb, a * 0.75);
            ctx.lineWidth = Math.max(2, ring.width * 0.32);
            ctx.beginPath();
            ctx.arc(cx, cy, ring.r, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.restore();
    }

    function drawAurora(dt, t) {
        if (!ctx) return;
        ctx.clearRect(0, 0, w, h);
        const bands = 5;
        for (let i = 0; i < bands; i++) {
            const phase = t * (0.12 + 0.07 * i) + i * 1.7;
            const x = w * (0.15 + 0.7 * i / (bands - 1));
            const y = h * (0.35 + 0.18 * Math.sin(phase + i));
            const width = w * (0.18 + 0.09 * Math.sin(phase * 0.7 + i));
            const height = h * (0.45 + 0.12 * Math.cos(phase * 0.9 - i));
            const grad = ctx.createLinearGradient(x, y, x, y + height);
            // Couleurs typiques d'aurore boréale
            if (i % 2 === 0) {
                grad.addColorStop(0, 'rgba(0,255,128,0.18)');
                grad.addColorStop(0.5, 'rgba(0,200,255,0.13)');
                grad.addColorStop(1, 'rgba(128,0,255,0.10)');
            } else {
                grad.addColorStop(0, 'rgba(255,0,200,0.13)');
                grad.addColorStop(0.5, 'rgba(0,255,255,0.10)');
                grad.addColorStop(1, 'rgba(0,255,128,0.15)');
            }
            ctx.save();
            ctx.globalAlpha = 0.7 + 0.2 * Math.sin(phase * 0.8);
            ctx.globalCompositeOperation = 'lighter';
            ctx.filter = 'blur(32px)';
            ctx.beginPath();
            ctx.ellipse(x, y, width, height, Math.sin(phase) * 0.7, 0, 2 * Math.PI);
            ctx.closePath();
            ctx.fillStyle = grad;
            ctx.fill();
            ctx.restore();
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.filter = 'none';
    }

    function drawPixelArt(dt, t) {
        if (!ctx) return;
        ctx.clearRect(0, 0, w, h);
        // Paramètres de la grille : pixels carrés
        let idealPx = 10; // beaucoup moins de colonnes (pixels plus gros)
        // Sur mobile, pixels encore plus gros
        if (window.innerWidth < 600) {
            idealPx = 6;
        }
        const cellSize = Math.ceil(w / idealPx); // taille carrée
        const px = Math.floor(w / cellSize);
        const py = Math.floor(h / cellSize);
        const cellW = Math.ceil(w / px);
        const cellH = Math.ceil(h / py);
        // Récupère la couleur principale du thème
        // Utilise la couleur de fond (--bg) comme pour Vagues
        let bgColor = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
        // Convertit hex ou rgb en tableau [r,g,b]
        function parseCssColorToRgb(input) {
            const s = String(input || '').trim();
            if (!s) return [77, 124, 255];
            if (s.startsWith('#')) {
                const hex = s.slice(1);
                if (hex.length === 3) {
                    const r = parseInt(hex[0] + hex[0], 16);
                    const g = parseInt(hex[1] + hex[1], 16);
                    const b = parseInt(hex[2] + hex[2], 16);
                    if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) return [r, g, b];
                }
                if (hex.length === 6) {
                    const r = parseInt(hex.slice(0, 2), 16);
                    const g = parseInt(hex.slice(2, 4), 16);
                    const b = parseInt(hex.slice(4, 6), 16);
                    if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) return [r, g, b];
                }
            }
            const m = s.match(/rgba?\((\s*\d+\s*),\s*(\d+),\s*(\d+)/i);
            if (m) {
                const r = Number(m[1]);
                const g = Number(m[2]);
                const b = Number(m[3]);
                if ([r, g, b].every(n => Number.isFinite(n))) return [r, g, b];
            }
            return [77, 124, 255];
        }
        let base = parseCssColorToRgb(bgColor);
        // Convertit RGB en HSL pour variations
        function rgbToHsl(r, g, b) {
            r /= 255; g /= 255; b /= 255;
            const max = Math.max(r, g, b), min = Math.min(r, g, b);
            let h, s, l = (max + min) / 2;
            if (max === min) { h = s = 0; }
            else {
                const d = max - min;
                s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                switch (max) {
                    case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                    case g: h = (b - r) / d + 2; break;
                    case b: h = (r - g) / d + 4; break;
                }
                h /= 6;
            }
            return [h * 360, s * 100, l * 100];
        }
        let [baseH, baseS, baseL] = rgbToHsl(base[0], base[1], base[2]);
        // Si la couleur principale est trop sombre ET trop peu saturée, utilise une couleur d'accent ou par défaut
        if ((baseL < 30 && baseS < 20) || (base[0] === 0 && base[1] === 0 && base[2] === 0)) {
            // Essaie de récupérer la couleur d'accent CSS
            let accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
            if (accent) {
                // Accent peut être en hex ou rgb
                let m = accent.match(/#([0-9a-f]{3,8})/i);
                if (m) {
                    // Hex -> rgb
                    let hex = m[1];
                    if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
                    let n = parseInt(hex, 16);
                    base = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
                } else {
                    m = accent.match(/rgb\s*\((\d+),\s*(\d+),\s*(\d+)/);
                    if (m) base = [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])];
                }
                [baseH, baseS, baseL] = rgbToHsl(base[0], base[1], base[2]);
            } else {
                // Couleur vive par défaut (bleu)
                baseH = 210; baseS = 80; baseL = 75;
            }
        }
        // DIAGNOSTIC : affiche la couleur utilisée
        if (window.__debugPixelArt !== false) {
            console.log('[PIXELART] RGB:', base, 'HSL:', baseH, baseS, baseL);
            window.__debugPixelArt = false;
        }
        // FORCAGE TEMPORAIRE : pixels bleu clair pour test
        // baseH = 210; baseS = 80; baseL = 75;
        // Pixels plus sombres
        const minL = Math.max(20, baseL - 20);
        const maxL = Math.max(baseL + 10, minL + 10);
        // Ralentir l'animation : t est divisé par 2
        // Animation encore plus lente
        const slowT = t / 6;
        for (let ix = 0; ix < px; ix++) {
            for (let iy = 0; iy < py; iy++) {
                const phase = Math.sin(slowT * 1.2 + ix * 0.7 + iy * 1.3 + Math.sin(ix + iy)) * 0.5 + 0.5;
                const appear = Math.sin(slowT * 0.8 + ix * 1.1 - iy * 0.9) * 0.5 + 0.5;
                if (phase * appear < 0.25) continue;
                const sat = Math.max(30, baseS + 10 * Math.sin(slowT + ix));
                let lum = baseL + 15 * Math.cos(slowT * 0.7 + iy);
                lum = Math.max(minL, Math.min(maxL, lum));
                ctx.fillStyle = `hsl(${baseH},${sat}%,${lum}%)`;
                ctx.globalAlpha = 0.45 + 0.25 * phase;
                ctx.fillRect(ix * cellW, iy * cellH, cellW, cellH);
            }
        }
        ctx.globalAlpha = 1;
    }

    function loop(ts) {
        if (!ctx) {
            rafId = 0;
            return;
        }
        const dt = Math.min(0.05, Math.max(0, (ts - lastTs) / 1000));
        lastTs = ts;
        const t = ts / 1000;

        if (mode === 'lineaire') drawLineaire(dt, t);
        else if (mode === 'duel') drawDuel(dt, t);
        else if (mode === 'ondes') drawOndes(dt, t);
        else if (mode === 'aurora') drawAurora(dt, t);
        else if (mode === 'pixel-art') drawPixelArt(dt, t);
        else {
            // mode inconnu => stop
            stopLoop();
            return;
        }

        rafId = requestAnimationFrame(loop);
    }

    window.__setFondCanvasMode = function (nextMode) {
        const m = String(nextMode || '').trim().toLowerCase();

        // Pas de canvas pour Vagues (default) ni Vagues inversées (CSS)
        if (!m || m === 'vagues-inversees') {
            mode = '';
            stopLoop();
            removeCanvas();
            return;
        }

        // Ajout du mode aurore boréale
        if (m === 'aurora') {
            mode = 'aurora';
            ensureCanvas();
            startLoop();
            return;
        }
        // Ajout du mode pixel art
        if (m === 'pixel-art') {
            mode = 'pixel-art';
            ensureCanvas();
            startLoop();
            return;
        }
        if (!['lineaire', 'duel', 'ondes'].includes(m)) {
            mode = '';
            stopLoop();
            removeCanvas();
            return;
        }

        if (mode !== m) {
            mode = m;
            rings = [];
            nextRingAt = 0;
            lineOffset = 0;
            duel = null;
            ensureCanvas();
            if (ctx) ctx.clearRect(0, 0, w, h);
        } else {
            ensureCanvas();
        }

        startLoop();
    };

    // Resize handler
    window.addEventListener('resize', () => {
        try {
            if (!canvas) return;
            resize();
        } catch { }
    }, { passive: true });
})();

/* ==================================================================
   Fonctions "Communauté" utiles (helpers)
   ================================================================== */

/* Formatage date */
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleDateString('fr-FR', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
    });
}

/* ------------------------------------------------------------------
   logout helper
   ------------------------------------------------------------------ */
function logoutAndRedirect() {
    const prevUser = (localStorage.getItem('source_username') || '').trim();
    const prevUserKey = prevUser.toLowerCase();

    // Best-effort: informer le serveur (champ active=false) sans bloquer l'UI
    try {
        if (prevUser) {
            fetch('/api/logout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: prevUser })
            }).catch(() => { });
        }
    } catch { }

    // Nettoyage caches Cartable (ED) pour éviter la fuite inter-comptes
    try {
        // Legacy keys
        localStorage.removeItem('ED_NOTES');
        localStorage.removeItem('ED_DEVOIRS');
        localStorage.removeItem('ED_DEV_RANGE');
        // Per-user keys
        if (prevUserKey) {
            localStorage.removeItem('ED_NOTES:' + prevUserKey);
            localStorage.removeItem('ED_DEVOIRS:' + prevUserKey);
            localStorage.removeItem('ED_DEV_RANGE:' + prevUserKey);
        }
    } catch { }

    localStorage.removeItem('source_username');
    // Vider la session de chat au logout
    sessionStorage.removeItem('SOURCE_CHAT_HISTORY');
    sessionStorage.removeItem('SOURCE_CHAT_DOM');
    window.location.href = '/pages/login.html'; // <-- chemin exact de ta page de connexion
}

/* ==================================================================
   Page INFO helpers (progress bar...) 
   ================================================================== */
const WEEK_DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const PASSED_COLOR = '#a38d2b';
const WEEKEND_COLOR = '#714747ab';
const GREY_COLOR = '#333333b7';
const CURRENT_DAY_COLOR = '#90ee90';

function updateWeekProgress() {
    const container = document.getElementById('week-progress-bar');
    if (!container) return;
    container.innerHTML = '';

    const now = new Date();
    let todayIndex = now.getDay();
    const currentHour = now.getHours();
    let actualDayIndex = todayIndex === 0 ? 7 : todayIndex;
    const actualDayName = WEEK_DAYS[todayIndex];

    for (let i = 1; i <= 7; i++) {
        const segment = document.createElement('div');
        segment.classList.add('day-segment');

        const dayOfWeek = i;
        const displayDayName = WEEK_DAYS[dayOfWeek === 7 ? 0 : dayOfWeek];

        if (dayOfWeek < actualDayIndex) {
            segment.classList.add('passed-day');
        } else if (dayOfWeek === actualDayIndex) {
            if (dayOfWeek === 3 && currentHour >= 13) {
                segment.style.background = `linear-gradient(to right, ${PASSED_COLOR} 50%, ${WEEKEND_COLOR} 50%)`;
            } else if (currentHour < 13 || dayOfWeek === 6 || dayOfWeek === 7) {
                segment.style.backgroundColor = CURRENT_DAY_COLOR;
            } else {
                segment.classList.add('passed-day');
            }
        } else if (dayOfWeek > actualDayIndex) {
            if (dayOfWeek === 6 || dayOfWeek === 7) {
                segment.classList.add('weekend-day');
            } else if (dayOfWeek === 3) {
                segment.style.background = `linear-gradient(to right, ${GREY_COLOR} 50%, ${WEEKEND_COLOR} 50%)`;
            } else {
                segment.style.backgroundColor = GREY_COLOR;
            }
        }

        container.appendChild(segment);
    }

    console.log(`[LOG] (PROGRESSION) : Mise à jour barre semaine pour ${actualDayName} ${now.getHours()}h.`);
}

window.initInfoPage = (displayUsernameElement) => {
    // Ne jamais forcer un username par défaut : ça crée une "fausse" connexion
    const username = currentUsername || localStorage.getItem('source_username');
    const displayUsername = displayUsernameElement || document.getElementById('user-name-placeholder');
    if (displayUsername) {
        displayUsername.textContent = username || "UTILISATEUR INCONNU";
        console.log("[LOG] (SUCCESS) : Nom affiché : " + username);
    } else {
        console.error("[LOG] : #user-name-placeholder introuvable dans initInfoPage.");
    }

    // Si pas d'utilisateur, on laisse la redirection globale gérer (/pages/login.html)
    if (!username) {
        try { updateTitleWithUsername(); } catch { }
        return;
    }
    updateWeekProgress();
    if (typeof window.loadInfoData === 'function') {
        try { window.loadInfoData(); } catch (e) { console.error(e); }
    }
    // 🔥 CHARGER LE GRAPHIQUE DES POINTS
    if (typeof window.loadPointsChart === 'function') {
        try { window.loadPointsChart(); } catch (e) { console.error("Erreur chargement graphique:", e); }
    }
};

/* ------------------------------------------------------------------
   Intercepteur global de submit (sécurité)
   ------------------------------------------------------------------ */
document.addEventListener('submit', function (e) {
    const formId = e.target?.id;

    if (formId === 'login-form' || formId === 'chat-form' || formId === 'deposit-form' || formId === 'cartable-login-form') {
        return;
    }

    console.warn(`Blocage formulaire non géré (ID: ${formId}).`);
    e.preventDefault();
    e.stopImmediatePropagation();
});

/* ------------------------------------------------------------------
   Custom Modal Logic (Replacement for alert/confirm)
   ------------------------------------------------------------------ */
window.showModal = function (message, options = {}) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('custom-modal-overlay');
        const modal = document.getElementById('custom-modal');
        const titleEl = document.getElementById('custom-modal-title');
        const messageEl = document.getElementById('custom-modal-message');
        const confirmBtn = document.getElementById('custom-modal-confirm');
        const cancelBtn = document.getElementById('custom-modal-cancel');

        if (!overlay) {
            console.error('Modal overlay not found!');
            // Fallback to native alert/confirm if modal is missing
            if (options.type === 'confirm') {
                resolve(confirm(message));
            } else {
                alert(message);
                resolve(true);
            }
            return;
        }

        // Set content
        titleEl.textContent = options.title || 'Notification';
        messageEl.textContent = message;

        // Configure buttons
        const type = options.type || 'alert'; // 'alert' or 'confirm'

        // Reset buttons
        confirmBtn.onclick = null;
        cancelBtn.onclick = null;

        // Remove old event listeners to prevent stacking (cloning is a quick way)
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        const newCancelBtn = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

        if (type === 'alert') {
            newCancelBtn.style.display = 'none';
            newConfirmBtn.textContent = 'OK';
            newConfirmBtn.onclick = () => {
                closeModal();
                resolve(true);
            };
        } else if (type === 'confirm') {
            newCancelBtn.style.display = 'inline-block';
            newConfirmBtn.textContent = options.confirmText || 'Confirmer';
            newCancelBtn.textContent = options.cancelText || 'Annuler';

            newConfirmBtn.onclick = () => {
                closeModal();
                resolve(true);
            };
            newCancelBtn.onclick = () => {
                closeModal();
                resolve(false);
            };
        }

        // Show modal
        overlay.style.display = 'flex';
        // Force reflow
        overlay.offsetHeight;
        overlay.classList.add('visible');

        function closeModal() {
            overlay.classList.remove('visible');
            setTimeout(() => {
                overlay.style.display = 'none';
            }, 300);
        }
    });
};

/* ==================================================================
   FEATURE: Relative Timestamps
   ================================================================== */
window.timeAgo = function(dateInput) {
    const date = new Date(dateInput);
    if (isNaN(date)) return '';
    const now = Date.now();
    const diff = now - date.getTime();
    const sec = Math.floor(diff / 1000);
    if (sec < 60)  return "à l'instant";
    const min = Math.floor(sec / 60);
    if (min < 60) return `il y a ${min} min`;
    const hrs = Math.floor(min / 60);
    if (hrs < 24)  return `il y a ${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days === 1) return 'hier';
    if (days < 7)   return `il y a ${days}j`;
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

/* ==================================================================
   FEATURE: Skeleton Loading Templates
   ================================================================== */
window.getSkeletonHtml = function(page) {
    const sk = (cls) => `<div class="skeleton ${cls}"></div>`;
    const row = `<div class="skeleton-row">${sk('skeleton-avatar')} <div style="flex:1">${sk('skeleton-text')}${sk('skeleton-text short')}</div></div>`;
    if (page === 'accueil') {
        return `<div style="padding:20px;max-width:800px;margin:auto">
            ${sk('skeleton-title')}
            <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:20px">
                <div class="skeleton-card" style="flex:1;min-width:220px">${sk('skeleton-title')}${row}${row}${sk('skeleton-text')}</div>
                <div class="skeleton-card" style="flex:1;min-width:220px">${sk('skeleton-title')}${row}${row}${sk('skeleton-text')}</div>
                <div class="skeleton-card" style="flex:1;min-width:220px">${sk('skeleton-title')}${row}${sk('skeleton-text')}${sk('skeleton-text short')}</div>
            </div>
        </div>`;
    }
    if (page === 'communaute') {
        return `<div style="display:flex;gap:16px;padding:20px;height:70vh">
            <div style="width:300px;flex-shrink:0" class="skeleton-card">${sk('skeleton-title')}${row}${row}${row}${row}${row}</div>
            <div style="flex:1" class="skeleton-card">${sk('skeleton-title')}<div style="flex:1"></div>${sk('skeleton-text')}${sk('skeleton-text short')}</div>
        </div>`;
    }
    if (page === 'messagerie') {
        return `<div style="display:flex;gap:16px;padding:20px;height:70vh">
            <div style="width:280px;flex-shrink:0" class="skeleton-card">${sk('skeleton-title')}${row}${row}${row}${row}</div>
            <div style="flex:1" class="skeleton-card">${sk('skeleton-title')}${sk('skeleton-text')}${sk('skeleton-text')}${sk('skeleton-text short')}</div>
        </div>`;
    }
    if (page === 'cours') {
        const card = `<div class="skeleton-card" style="min-height:180px">${sk('skeleton-title')}${sk('skeleton-text')}${sk('skeleton-text short')}</div>`;
        return `<div style="padding:20px"><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px">${card}${card}${card}${card}${card}${card}</div></div>`;
    }
    if (page === 'cartable') {
        return `<div style="padding:20px;max-width:900px;margin:auto">${sk('skeleton-title')}
            <div class="skeleton-card" style="margin-bottom:16px">${row}${sk('skeleton-text')}${sk('skeleton-text short')}</div>
            <div class="skeleton-card">${row}${row}${sk('skeleton-text')}</div>
        </div>`;
    }
    if (page === 'moncompte') {
        return `<div style="padding:20px;max-width:600px;margin:auto;text-align:center">
            <div class="skeleton skeleton-avatar" style="width:80px;height:80px;margin:0 auto 16px"></div>
            ${sk('skeleton-title')}${sk('skeleton-text')}${sk('skeleton-text short')}
        </div>`;
    }
    // Fallback
    return `<div style="padding:40px;text-align:center">${sk('skeleton-title')}${sk('skeleton-text')}${sk('skeleton-text short')}</div>`;
};

/* ==================================================================
   FEATURE: User Hover Card
   ================================================================== */
(function initUserHoverCard() {
    let card = null;
    let hoverTimeout = null;
    let leaveTimeout = null;
    let currentTarget = null;
    const userCache = {};

    function ensureCard() {
        if (card) return card;
        card = document.createElement('div');
        card.className = 'user-hover-card';
        card.innerHTML = `
            <div class="user-hover-card-header">
                <img class="user-hover-card-avatar" src="/ressources/user-icon.png" alt="">
                <div>
                    <div class="user-hover-card-name"></div>
                    <div class="user-hover-card-rank"></div>
                </div>
            </div>
            <div class="user-hover-card-badges"></div>
            <div class="user-hover-card-points"></div>
        `;
        document.body.appendChild(card);
        card.addEventListener('mouseenter', () => clearTimeout(leaveTimeout));
        card.addEventListener('mouseleave', () => hide());
        return card;
    }

    function hide() {
        clearTimeout(hoverTimeout);
        if (card) card.classList.remove('visible');
        currentTarget = null;
    }

    async function fetchUser(username) {
        if (userCache[username]) return userCache[username];
        try {
            const [infoRes, allRes] = await Promise.all([
                fetch(`/api/user-info/${encodeURIComponent(username)}`),
                fetch('/api/all.json')
            ]);
            const info = infoRes.ok ? await infoRes.json() : {};
            const all = allRes.ok ? await allRes.json() : {};
            const ranking = Array.isArray(all.user_ranking) ? all.user_ranking : [];
            const me = ranking.find(u => u.username === username);
            const rank = me ? ranking.indexOf(me) + 1 : null;
            const data = {
                username,
                avatar: info.user?.avatar || null,
                badges: (info.user?.badges_current || []).slice(0, 3),
                points: me?.points ?? null,
                rank,
                color: info.user?.color || null
            };
            userCache[username] = data;
            return data;
        } catch { return null; }
    }

    function position(el) {
        const r = el.getBoundingClientRect();
        const c = ensureCard();
        let left = r.left;
        let top = r.bottom + 8;
        if (left + 280 > window.innerWidth) left = window.innerWidth - 290;
        if (top + 200 > window.innerHeight) top = r.top - 8 - (c.offsetHeight || 150);
        c.style.left = Math.max(4, left) + 'px';
        c.style.top = Math.max(4, top) + 'px';
    }

    async function show(el, username) {
        if (window.innerWidth <= 768) return; // No hover card on mobile
        const c = ensureCard();
        position(el);
        const data = await fetchUser(username);
        if (!data || currentTarget !== el) return;
        c.querySelector('.user-hover-card-name').textContent = data.username;
        c.querySelector('.user-hover-card-rank').textContent = data.rank ? `#${data.rank}` : '';
        const avatarEl = c.querySelector('.user-hover-card-avatar');
        avatarEl.src = data.avatar ? data.avatar : '/ressources/user-icon.png';
        if (data.color) avatarEl.style.borderColor = data.color;
        // Badges
        const badgesEl = c.querySelector('.user-hover-card-badges');
        badgesEl.innerHTML = '';
        data.badges.forEach(bid => {
            if (typeof BADGE_ICONS !== 'undefined' && BADGE_ICONS[bid]) {
                const b = BADGE_ICONS[bid];
                if (b.type === 'image') {
                    badgesEl.innerHTML += `<img src="${b.src}" class="message-badge-image" style="width:22px;height:22px" alt="">`;
                } else {
                    badgesEl.innerHTML += `<span class="message-badge" style="font-size:18px">${b.emoji}</span>`;
                }
            }
        });
        c.querySelector('.user-hover-card-points').textContent = data.points != null ? `${data.points} pts` : '';
        position(el);
        c.classList.add('visible');
    }

    document.addEventListener('mouseenter', (e) => {
        if (!e.target || !e.target.closest) return;
        const target = e.target.closest('.message-sender-name, .user-mention, .user-name-token, .leader-name');
        if (!target) return;
        const username = target.dataset?.username || target.textContent?.trim();
        if (!username) return;
        clearTimeout(leaveTimeout);
        currentTarget = target;
        hoverTimeout = setTimeout(() => show(target, username), 400);
    }, true);

    document.addEventListener('mouseleave', (e) => {
        if (!e.target || !e.target.closest) return;
        const target = e.target.closest('.message-sender-name, .user-mention, .user-name-token, .leader-name');
        if (!target) return;
        clearTimeout(hoverTimeout);
        leaveTimeout = setTimeout(hide, 200);
    }, true);
})();

/* ==================================================================
   FEATURE: Confetti
   ================================================================== */
window.launchConfetti = function(duration) {
    duration = duration || 2500;
    let container = document.getElementById('confetti-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'confetti-container';
        document.body.appendChild(container);
    }
    const colors = ['#ff4d6d','#ffd700','#4d7cff','#00e676','#ff6d00','#e040fb','#00bcd4','#ff1744'];
    const shapes = ['square','circle'];
    const count = 80;
    for (let i = 0; i < count; i++) {
        const el = document.createElement('div');
        el.className = 'confetti-piece';
        const color = colors[Math.floor(Math.random() * colors.length)];
        const shape = shapes[Math.floor(Math.random() * shapes.length)];
        const size = 6 + Math.random() * 8;
        const left = Math.random() * 100;
        const animDur = 1.5 + Math.random() * 2;
        const delay = Math.random() * (duration / 1000 * 0.6);
        el.style.cssText = `
            left:${left}%;width:${size}px;height:${size}px;
            background:${color};
            border-radius:${shape === 'circle' ? '50%' : '2px'};
            animation-duration:${animDur}s;animation-delay:${delay}s;
        `;
        container.appendChild(el);
    }
    setTimeout(() => { container.innerHTML = ''; }, duration + 3000);
};

/* ==================================================================
   FEATURE: Badge Unlock Animation
   ================================================================== */
(function initBadgeUnlockSystem() {
    let overlay = null;
    function ensureOverlay() {
        if (overlay) return overlay;
        overlay = document.createElement('div');
        overlay.id = 'badge-unlock-overlay';
        overlay.innerHTML = `
            <div class="badge-unlock-card">
                <div class="badge-unlock-title">Nouveau Badge !</div>
                <div class="badge-unlock-icon"></div>
                <div class="badge-unlock-name"></div>
                <div class="badge-unlock-desc"></div>
                <button class="badge-unlock-dismiss">Super !</button>
            </div>
        `;
        document.body.appendChild(overlay);
        overlay.querySelector('.badge-unlock-dismiss').addEventListener('click', () => {
            overlay.classList.remove('visible');
        });
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.classList.remove('visible');
        });
        return overlay;
    }

    window.showBadgeUnlock = function(badgeId) {
        const ov = ensureOverlay();
        const badge = (typeof BADGE_ICONS !== 'undefined' && BADGE_ICONS[badgeId]) ? BADGE_ICONS[badgeId] : null;
        const desc = (typeof BADGE_DESCRIPTIONS !== 'undefined' && BADGE_DESCRIPTIONS[badgeId]) ? BADGE_DESCRIPTIONS[badgeId] : null;
        const iconEl = ov.querySelector('.badge-unlock-icon');
        if (badge && badge.type === 'image') {
            iconEl.innerHTML = `<img src="${badge.src}" alt="">`;
        } else {
            iconEl.textContent = badge ? badge.emoji : '🏅';
        }
        ov.querySelector('.badge-unlock-name').textContent = desc ? desc.name : badgeId;
        ov.querySelector('.badge-unlock-desc').textContent = desc ? desc.description : '';
        ov.classList.add('visible');
        // Confetti burst!
        if (typeof window.launchConfetti === 'function') window.launchConfetti(2000);
        // Auto-dismiss after 5s
        setTimeout(() => { ov.classList.remove('visible'); }, 5000);
    };

    // === Badge change detection ===
    const BADGE_STORAGE_KEY = 'alpha_last_badges';
    window.__checkBadgeChanges = async function() {
        try {
            const username = (localStorage.getItem('source_username') || '').trim();
            if (!username) return;
            const res = await fetch(`/api/user-info/${encodeURIComponent(username)}`);
            if (!res.ok) return;
            const data = await res.json();
            if (!data.success || !data.user) return;
            const current = data.user.badges_obtained || [];
            const stored = JSON.parse(localStorage.getItem(BADGE_STORAGE_KEY) || '[]');
            const newBadges = current.filter(b => !stored.includes(b));
            if (newBadges.length > 0) {
                // Show unlock animation for first new badge
                window.showBadgeUnlock(newBadges[0]);
                // Queue others
                for (let i = 1; i < newBadges.length; i++) {
                    setTimeout(() => window.showBadgeUnlock(newBadges[i]), i * 3500);
                }
            }
            localStorage.setItem(BADGE_STORAGE_KEY, JSON.stringify(current));
        } catch {}
    };
    // Check on page load with delay
    setTimeout(() => { if (typeof window.__checkBadgeChanges === 'function') window.__checkBadgeChanges(); }, 5000);
})();

