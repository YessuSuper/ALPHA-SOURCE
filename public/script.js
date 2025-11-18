// public/script.js (Logique principale d'initialisation - Version corrigée pour Communauté)

// 🚨 ÉLÉMENTS DE BASE (peuvent être null si le DOM change)
const sidebar = document.getElementById('sidebar');
const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
const mainMenu = document.getElementById('main-menu');
const pageContentWrapper = document.getElementById('page-content-wrapper');
const depositModal = document.getElementById('deposit-modal');
const mainTitle = document.querySelector('#main-content-wrapper h1');

// 🚨 VARIABLES GLOBALES
let currentPage = 'home';
let currentMessages = [];    // Pour la communauté
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
        document.title = `SOURCE AI - ${username}`;
        console.log(`PUTAIN LOG : Titre mis à jour pour l'utilisateur ${username}.`);
        return true;
    } else {
        document.title = "SOURCE AI - Bienvenue (Redirection)";
        // Si la page doit être protégée, on redirige
        window.location.href = '/';
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

/* ------------------------------------------------------------------
   renderPage(page) : charge dynamiquement la page et initialise
   les scripts spécifiques après injection.
   ------------------------------------------------------------------ */
async function renderPage(page) {
    currentPage = page;

    // éléments dépendants du layout (peuvent être absents selon la page)
    const rightSidebarControls = document.getElementById('right-sidebar-controls');
    const depositCourseButton = document.getElementById('deposit-course-button');
    const localMainTitle = document.querySelector('#main-content-wrapper h1');

    if (!pageContentWrapper) {
        console.error("PUTAIN LOG : #page-content-wrapper introuvable.");
        return;
    }

    // Si on quittait la communauté, arrêter son polling proprement
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
        currentMessages = [];
        console.log("PUTAIN LOG : Polling arrêté (changement de page).");
    }

    // Choix du fichier à charger
    let contentFile = '';
    if (page === 'home' || page === 'chat') contentFile = '/pages/chat.html';
    else if (page === 'cours') contentFile = '/pages/cours.html';
    else if (page === 'communaute') contentFile = '/pages/communaute.html';
    else if (page === 'info') contentFile = '/pages/info.html';
    else {
        pageContentWrapper.innerHTML = '<h2>Page non trouvée.</h2>';
        updateActiveMenuClass(page);
        return;
    }

    // Chargement via fetch
    try {
        const response = await fetch(contentFile);
        if (!response.ok) {
            pageContentWrapper.innerHTML = `<h2>Erreur de chargement ${contentFile} (${response.status})</h2>`;
            return;
        }

        let contentHtml = await response.text();

        // Cas particulier pour cours qui injecte aussi une modale
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

    // Petit délai pour que le DOM injecté soit disponible (50-150ms selon besoin)
    setTimeout(() => {
        // Gestion visuelle/contrôles selon page
        if (page === 'home' || page === 'chat') {
            if (rightSidebarControls) rightSidebarControls.style.display = 'block';
            if (depositCourseButton) depositCourseButton.style.display = 'none';
            if (localMainTitle) localMainTitle.style.display = 'block';
            if (typeof window.initChatPage === 'function') window.initChatPage();
        } else if (page === 'cours') {
            if (rightSidebarControls) rightSidebarControls.style.display = 'none';
            if (depositCourseButton) depositCourseButton.style.display = 'block';
            if (localMainTitle) localMainTitle.style.display = 'none';
            if (typeof window.initCoursPage === 'function') window.initCoursPage();
        } else if (page === 'communaute') {
            if (rightSidebarControls) rightSidebarControls.style.display = 'none';
            if (depositCourseButton) depositCourseButton.style.display = 'none';
            if (localMainTitle) localMainTitle.style.display = 'none';

            // Ici on appelle l'initialisateur de communauté **le plus approprié**
            // 1) initCommunityChat() (si tu utilises la version longue que je t'ai fournie)
            // 2) sinon initCommunautePage() (si ton ancien code l'attend)
            // On essaye les deux, avec un léger délai pour être sûr que tout est dans le DOM.
            setTimeout(() => {
                if (typeof window.initCommunityChat === 'function') {
                    console.log("PUTAIN LOG : Appel initCommunityChat()");
                    try { window.initCommunityChat(); } catch (e) { console.error(e); }
                } else if (typeof window.initCommunautePage === 'function') {
                    console.log("PUTAIN LOG : Appel initCommunautePage()");
                    try { window.initCommunautePage(); } catch (e) { console.error(e); }
                } else {
                    console.warn("PUTAIN LOG : Aucun initCommunity*() trouvé (initCommunityChat/initCommunautePage absents).");
                }
            }, 60);
        } else if (page === 'info') {
            if (rightSidebarControls) rightSidebarControls.style.display = 'none';
            if (depositCourseButton) depositCourseButton.style.display = 'none';
            if (localMainTitle) localMainTitle.style.display = 'none';

            const displayUsernameElement = document.getElementById('user-name-placeholder');
            if (typeof window.initInfoPage === 'function' && displayUsernameElement) {
                try { window.initInfoPage(displayUsernameElement); } catch (e) { console.error(e); }
            } else if (!displayUsernameElement) {
                console.error("PUTAIN LOG : #user-name-placeholder introuvable après injection.");
            }
        }
    }, 60); // 60ms fonctionne bien ; augmente à 100-150ms si ton injection est plus lente

    updateActiveMenuClass(page);
}

/* ------------------------------------------------------------------
   updateActiveMenuClass : met la classe active sur le menu
   ------------------------------------------------------------------ */
function updateActiveMenuClass(page) {
    if (!mainMenu) return;
    mainMenu.querySelectorAll('a').forEach(link => {
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
        { name: '-SOURCE AI', id: 'home', iconFile: '/ressources/kiraaimenuicon.png' },
        { name: '-Mes Cours', id: 'cours', iconFile: '/ressources/coursmenuicon.png' },
        { name: '-Communauté', id: 'communaute', iconFile: '/ressources/communautemenuicon.png' },
        { name: '-Info', id: 'info', iconFile: '/ressources/infomenuicon.png' }
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

    createMenu();
    renderPage(currentPage);
});

/* ==================================================================
   Fonctions "Communauté" utiles (elles sont here juste pour être
   disponibles globalement si tu veux les utiliser/overrider)
   - Note : la logique lourde (upload, preview, etc.) peut rester dans
     public/js/communaute.js (initCommunityChat / initCommunautePage).
   ================================================================== */

/* Formatage date */
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleDateString('fr-FR', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
    });
}

/* createMessageElement, addNewMessagesToContainer, loadCommunityMessages,
   postCommunityMessage, window.initCommunautePage etc. sont supposés
   exister dans ton communaute.js complet. Ici on laisse des helpers
   utils si besoin. */

/* ------------------------------------------------------------------
   logout helper
   ------------------------------------------------------------------ */
function logoutAndRedirect() {
    localStorage.removeItem('source_username');
    window.location.href = '/';
}

/* ==================================================================
   Page INFO helpers (progress bar...) - inchangés sauf protection null
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
    if (!localStorage.getItem('source_username')) {
        localStorage.setItem('source_username', 'Yessu_Le_Sigma_Test');
    }
    const username = currentUsername || localStorage.getItem('source_username');
    const displayUsername = displayUsernameElement || document.getElementById('user-name-placeholder');
    if (displayUsername) {
        displayUsername.textContent = username || "UTILISATEUR INCONNU";
        console.log("PUTAIN LOG (SUCCESS) : Nom affiché : " + username);
    } else {
        console.error("PUTAIN LOG : #user-name-placeholder introuvable dans initInfoPage.");
    }
    updateWeekProgress();
    if (typeof window.loadInfoData === 'function') {
        try { window.loadInfoData(); } catch (e) { console.error(e); }
    }
};

/* ------------------------------------------------------------------
   Intercepteur global de submit (sécurité)
   ------------------------------------------------------------------ */
document.addEventListener('submit', function (e) {
    const formId = e.target?.id;

    // Formulaires autorisés
    if (formId === 'login-form' || formId === 'chat-form' || formId === 'deposit-form') {
        return;
    }

    // Tous les autres → bloqués
    console.warn(`Blocage formulaire non géré (ID: ${formId}).`);
    e.preventDefault();
    e.stopImmediatePropagation();
});
