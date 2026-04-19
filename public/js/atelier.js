/* ── Atelier Page + Sub-page Navigation ── */

(function () {
    // Map data-tool to sub-page config
    const SUB_PAGES = {
        fiches:            { html: '/Atelier/html/fiches.html',            css: '/Atelier/css/fiches.css',            js: '/Atelier/js/fiches.js',            cleanup: '__fichesCleanup' },
        'cartes-mentales': { html: '/Atelier/html/cartes-mentales.html',   css: '/Atelier/css/cartes-mentales.css',   js: '/Atelier/js/cartes-mentales.js',   cleanup: '__cartesMentalesCleanup' },
        slides:            { html: '/Atelier/html/presentations.html',     css: '/Atelier/css/presentations.css',     js: '/Atelier/js/presentations.js',     cleanup: '__presentationsCleanup' },
        oral:              { html: '/Atelier/html/simulateur-oral.html',   css: '/Atelier/css/simulateur-oral.css',   js: '/Atelier/js/simulateur-oral.js',   cleanup: '__oralCleanup' },
    };

    let activeSubCleanup = null;
    let loadedCSS = {};      // cache loaded <link> elements
    let atelierHTML = null;   // cache the atelier main page HTML

    // Shared sub-page CSS
    let sharedCSSLoaded = false;
    function ensureSharedCSS() {
        if (sharedCSSLoaded) return;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = '/Atelier/css/sub-pages.css';
        document.head.appendChild(link);
        sharedCSSLoaded = true;
    }

    function loadCSS(href) {
        if (loadedCSS[href]) return;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href + '?t=' + Date.now();
        document.head.appendChild(link);
        loadedCSS[href] = link;
    }

    function loadJS(src) {
        return new Promise((resolve) => {
            const s = document.createElement('script');
            s.src = src + '?t=' + Date.now(); // bust cache for dev
            s.onload = resolve;
            s.onerror = resolve;
            document.body.appendChild(s);
        });
    }

    function cleanupSub() {
        if (activeSubCleanup && typeof window[activeSubCleanup] === 'function') {
            try { window[activeSubCleanup](); } catch (e) { }
        }
        activeSubCleanup = null;
    }

    async function openSubPage(toolKey) {
        const cfg = SUB_PAGES[toolKey];
        if (!cfg) return;

        const wrapper = document.getElementById('page-content-wrapper');
        if (!wrapper) return;

        // Save current atelier HTML for the "back" button
        if (!atelierHTML) atelierHTML = wrapper.innerHTML;

        // Transition out
        wrapper.classList.remove('page-enter');
        wrapper.classList.add('page-exit');
        await new Promise(r => setTimeout(r, 120));

        // Load sub-page HTML
        try {
            const resp = await fetch(cfg.html);
            if (!resp.ok) throw new Error(resp.status);
            wrapper.innerHTML = await resp.text();
        } catch (e) {
            wrapper.innerHTML = '<p style="color:#fff;padding:40px">Erreur de chargement</p>';
            wrapper.classList.remove('page-exit');
            wrapper.classList.add('page-enter');
            return;
        }

        // Transition in
        wrapper.classList.remove('page-exit');
        void wrapper.offsetWidth;
        wrapper.classList.add('page-enter');
        // Remove class after animation so 'transform' doesn't break position:fixed
        setTimeout(() => wrapper.classList.remove('page-enter'), 250);

        // Load CSS + JS
        ensureSharedCSS();
        loadCSS(cfg.css);
        await loadJS(cfg.js);
        activeSubCleanup = cfg.cleanup;
    }

    // Return to Atelier main page
    window.returnToAtelier = async function () {
        cleanupSub();

        const wrapper = document.getElementById('page-content-wrapper');
        if (!wrapper) return;

        // Transition out
        wrapper.classList.remove('page-enter');
        wrapper.classList.add('page-exit');
        await new Promise(r => setTimeout(r, 120));

        if (atelierHTML) {
            wrapper.innerHTML = atelierHTML;
        } else {
            // Fallback: re-fetch the atelier page
            try {
                const resp = await fetch('/pages/atelier.html');
                wrapper.innerHTML = await resp.text();
            } catch (e) {
                wrapper.innerHTML = '<p style="color:#fff">Erreur</p>';
            }
        }

        // Transition in
        wrapper.classList.remove('page-exit');
        void wrapper.offsetWidth;
        wrapper.classList.add('page-enter');
        setTimeout(() => wrapper.classList.remove('page-enter'), 250);

        // Re-init atelier card listeners
        atelierHTML = null;
        bindCards();
    };

    function bindCards() {
        const cards = document.querySelectorAll('.atelier-card');
        cards.forEach(card => {
            card.addEventListener('click', () => {
                const tool = card.getAttribute('data-tool');
                if (tool) openSubPage(tool);
            });
        });
    }

    window.initAtelierPage = function () {
        cleanupSub();
        atelierHTML = null;
        bindCards();
    };
})();
