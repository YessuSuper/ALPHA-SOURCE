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

function edTodayYmd(){ return new Date().toISOString().slice(0,10); }
function edAddDaysYmd(ymd, days){ const d=new Date(ymd + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate()+days); return d.toISOString().slice(0,10); }
async function edParseJson(res){ try { return await res.json(); } catch { return null; } }
// Utilisation de localStorage pour persistance accrue (Instant Load)
function edSaveCache(key, val){ 
    try { 
        const k = edCacheKey(key);
        if (!k) return;
        const payload = { timestamp: Date.now(), data: val };
        localStorage.setItem(k, JSON.stringify(payload)); 
    } catch {} 
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
    } catch {}
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
        console.log(`PUTAIN LOG : Titre mis à jour pour l'utilisateur ${username}.`);
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
        console.error("PUTAIN LOG : #page-content-wrapper introuvable.");
        return;
    }

    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
        currentMessages = [];
        console.log("PUTAIN LOG : Polling arrêté (changement de page).");
    }

    let contentFile = '';
﻿    if (page === 'home' || page === 'chat') contentFile = '/pages/chat.html';
﻿    else if (page === 'cours') contentFile = '/pages/cours.html';
﻿    else if (page === 'communaute') contentFile = '/pages/communaute.html';
﻿    else if (page === 'messagerie') contentFile = '/pages/mess.html'; // 🚨 AJOUT MESSAGERIE 🚨
﻿    else if (page === 'accueil') contentFile = '/pages/home.html';
﻿    else if (page === 'cartable') contentFile = '/pages/cartable.html';
﻿    else if (page === 'info') contentFile = '/pages/info.html';
﻿    else if (page === 'moncompte') contentFile = '/pages/moncompte.html';
    else {
        pageContentWrapper.innerHTML = '<h2>Page non trouvée.</h2>';
        updateActiveMenuClass(page);
        return;
    }

    try {
        const response = await fetch(contentFile);
        if (!response.ok) {
            pageContentWrapper.innerHTML = `<h2>Erreur de chargement ${contentFile} (${response.status})</h2>`;
            return;
        }

        let contentHtml = await response.text();

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
    } catch (err) {
        pageContentWrapper.innerHTML = `<h2>Erreur de réseau : ${err.message}</h2>`;
        console.error("PUTAIN LOG : Erreur fetch page :", err);
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
                        console.log("PUTAIN LOG : #file-grid layout appliqué via MutationObserver (cours)");
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
        console.warn("PUTAIN LOG : #main-menu introuvable, menu non créé.");
        return;
    }

    const pages = [
﻿        { name: '-Accueil', id: 'accueil', iconFile: '/ressources/homemenuicon.png' },
﻿        { name: '-SOURCE AI', id: 'home', iconFile: '/ressources/kiraaimenuicon.png' },
﻿        { name: '-Mes Cours', id: 'cours', iconFile: '/ressources/coursmenuicon.png' },
﻿        { name: '-Communauté', id: 'communaute', iconFile: '/ressources/communautemenuicon.png' },
﻿        { name: '-Messagerie', id: 'messagerie', iconFile: '/ressources/messageriemenuicon.png' }, // 🚨 AJOUT MESSAGERIE 🚨
﻿        { name: '-Cartable', id: 'cartable', iconFile: '/ressources/cartablemenuicon.png' },
﻿        { name: '-Info', id: 'info', iconFile: '/ressources/infomenuicon.png' },
﻿        { name: '-Mon Compte', id: 'moncompte', iconFile: '/ressources/comptemenuicon.png' }
﻿    ];

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
            } catch {}

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
            } catch {}
        } catch (e) {
            // silencieux
        }
    })();

    createMenu();
    renderPage(currentPage);
    
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
                })
                .catch(err => console.error('[SKINS] Failed to load active skin:', err));
        }
    } catch(e) { console.error(e); }
});

// Allow other modules to apply theme after changes
window.applySkinTheme = function(skinName){
    const name = (skinName||'bleu basique').toLowerCase();
    
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
        'jaune basique': 'skin-jaune',
        'bleu basique': '' // default, no data-skin
    };
    
    const dataSkinValue = skinMap[name] || '';
    
    if (dataSkinValue) {
        document.documentElement.setAttribute('data-skin', dataSkinValue);
    } else {
        document.documentElement.removeAttribute('data-skin');
    }
}

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
            }).catch(() => {});
        }
    } catch {}

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
    } catch {}

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

    console.log(`PUTAIN LOG (PROGRESSION) : Mise à jour barre semaine pour ${actualDayName} ${now.getHours()}h.`);
}

window.initInfoPage = (displayUsernameElement) => {
    // Ne jamais forcer un username par défaut : ça crée une "fausse" connexion
    const username = currentUsername || localStorage.getItem('source_username');
    const displayUsername = displayUsernameElement || document.getElementById('user-name-placeholder');
    if (displayUsername) {
        displayUsername.textContent = username || "UTILISATEUR INCONNU";
        console.log("PUTAIN LOG (SUCCESS) : Nom affiché : " + username);
    } else {
        console.error("PUTAIN LOG : #user-name-placeholder introuvable dans initInfoPage.");
    }

    // Si pas d'utilisateur, on laisse la redirection globale gérer (/pages/login.html)
    if (!username) {
        try { updateTitleWithUsername(); } catch {}
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
window.showModal = function(message, options = {}) {
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

