(function () {
    const FORCE_TUTORIAL_EVERY_VISIT = false;
    const TUTORIAL_SEEN_KEY = 'alpha_site_tutorial_seen';
    const RULES_ACCEPTED_KEY = 'alpha_rules_accepted';
    const WELCOME_POST_KEY_PREFIX = 'alpha_site_tutorial_welcome_posted:';
    const WELCOME_MESSAGE = "Salut je viens d'arriver !";
    const OVERLAY_GAP = 12;

    let root = null;
    let card = null;
    let focusRing = null;
    let progressEl = null;
    let titleEl = null;
    let textEl = null;
    let nextBtn = null;
    let skipBtn = null;
    let shadeTop = null;
    let shadeLeft = null;
    let shadeRight = null;
    let shadeBottom = null;
    let activeTarget = null;
    let activeStepIndex = -1;
    let running = false;
    let runningStartedAt = 0;

    function getUsername() {
        try {
            return String(localStorage.getItem('source_username') || '').trim();
        } catch {
            return '';
        }
    }

    function getWelcomePostKey() {
        const username = getUsername().toLowerCase();
        return WELCOME_POST_KEY_PREFIX + (username || 'anonymous');
    }

    function hasPostedWelcomeMessage() {
        try {
            const key = getWelcomePostKey();
            return localStorage.getItem(key) === '1';
        } catch {
            return false;
        }
    }

    function markWelcomeMessagePosted() {
        try {
            const key = getWelcomePostKey();
            localStorage.setItem(key, '1');
        } catch { }
    }

    function canSendWelcomeMessage() {
        return Boolean(getUsername());
    }

    function isMobile() {
        return window.matchMedia('(max-width: 768px)').matches;
    }

    function wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function shouldAutoStart() {
        if (FORCE_TUTORIAL_EVERY_VISIT) return true;
        try {
            return localStorage.getItem(TUTORIAL_SEEN_KEY) !== '1';
        } catch {
            return true;
        }
    }

    function markSeen() {
        try {
            localStorage.setItem(TUTORIAL_SEEN_KEY, '1');
        } catch { }
    }

    function bySelector(selector) {
        if (!selector) return null;
        try {
            return document.querySelector(selector);
        } catch {
            return null;
        }
    }

    function resolveTarget(step) {
        if (!step) return null;
        const target = isMobile() ? (step.mobileTarget || step.target) : (step.desktopTarget || step.target);
        if (typeof target === 'function') return target();
        return bySelector(target);
    }

    async function waitForTarget(step, timeoutMs) {
        const timeout = Date.now() + (timeoutMs || 5000);
        while (Date.now() < timeout) {
            const target = resolveTarget(step);
            if (target) return target;
            await wait(70);
        }
        return resolveTarget(step);
    }

    function waitForPageRendered(page, timeoutMs) {
        return new Promise(resolve => {
            const current = (window.__alphaCurrentPage || document.body.getAttribute('data-page') || '').trim();
            if (!page || current === page) {
                resolve();
                return;
            }

            let done = false;
            const timer = setTimeout(() => {
                if (done) return;
                done = true;
                window.removeEventListener('alpha:page-rendered', onRendered);
                resolve();
            }, timeoutMs || 5000);

            function onRendered(event) {
                if (done) return;
                if (event && event.detail && event.detail.page === page) {
                    done = true;
                    clearTimeout(timer);
                    window.removeEventListener('alpha:page-rendered', onRendered);
                    resolve();
                }
            }

            window.addEventListener('alpha:page-rendered', onRendered);
        });
    }

    async function navigateToPage(page) {
        if (!page) return;
        const current = (window.__alphaCurrentPage || document.body.getAttribute('data-page') || '').trim();
        if (current === page) {
            await wait(140);
            return;
        }

        if (typeof renderPage === 'function') {
            const rendered = waitForPageRendered(page, 6000);
            await renderPage(page);
            await rendered;
            await wait(160);
            return;
        }

        const link = bySelector(`a[data-page="${page}"], .mobile-nav-link[data-page="${page}"]`);
        if (link) {
            link.click();
            await wait(240);
        }
    }

    function injectTutorialStyles() {
        if (document.getElementById('site-tutorial-injected-styles')) return;
        const s = document.createElement('style');
        s.id = 'site-tutorial-injected-styles';
        s.textContent = [
            '#site-tutorial-root{position:fixed!important;inset:0!important;z-index:2147483000!important;pointer-events:none!important;font-family:inherit}',
            '#site-tutorial-root[hidden]{display:none!important}',
            '.site-tutorial-shade{position:fixed!important;background:rgba(6,10,18,.72);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);pointer-events:auto}',
            '#site-tutorial-focus-ring{position:fixed!important;border:2px solid rgba(255,255,255,.92);border-radius:18px;box-shadow:0 0 0 6px rgba(77,124,255,.24),0 18px 50px rgba(0,0,0,.35);pointer-events:none;transition:top .2s ease,left .2s ease,width .2s ease,height .2s ease}',
            '#site-tutorial-card{position:fixed!important;max-width:380px!important;width:min(380px,calc(100vw - 32px))!important;background:rgba(12,18,30,.96);color:#f4f7fb;border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:18px 18px 16px;box-shadow:0 24px 60px rgba(0,0,0,.42);pointer-events:auto}',
            '@media(max-width:768px){#site-tutorial-card{left:12px!important;right:12px!important;max-width:none!important;width:auto!important}}'
        ].join('');
        document.head.appendChild(s);
    }

    function ensureRoot() {
        if (root) return;
        injectTutorialStyles();
        root = document.createElement('div');
        root.id = 'site-tutorial-root';
        root.hidden = true;
        root.innerHTML = `
            <div class="site-tutorial-shade" data-shade="top"></div>
            <div class="site-tutorial-shade" data-shade="left"></div>
            <div class="site-tutorial-shade" data-shade="right"></div>
            <div class="site-tutorial-shade" data-shade="bottom"></div>
            <div id="site-tutorial-focus-ring"></div>
            <div id="site-tutorial-card" role="dialog" aria-modal="true" aria-live="polite">
                <div id="site-tutorial-progress"></div>
                <h3 id="site-tutorial-title"></h3>
                <p id="site-tutorial-text"></p>
                <div id="site-tutorial-actions">
                    <button id="site-tutorial-skip" class="site-tutorial-btn" type="button">Passer</button>
                    <button id="site-tutorial-next" class="site-tutorial-btn" type="button">Suivant</button>
                </div>
            </div>
        `;
        document.body.appendChild(root);

        shadeTop = root.querySelector('[data-shade="top"]');
        shadeLeft = root.querySelector('[data-shade="left"]');
        shadeRight = root.querySelector('[data-shade="right"]');
        shadeBottom = root.querySelector('[data-shade="bottom"]');
        focusRing = document.getElementById('site-tutorial-focus-ring');
        card = document.getElementById('site-tutorial-card');
        progressEl = document.getElementById('site-tutorial-progress');
        titleEl = document.getElementById('site-tutorial-title');
        textEl = document.getElementById('site-tutorial-text');
        nextBtn = document.getElementById('site-tutorial-next');
        skipBtn = document.getElementById('site-tutorial-skip');

        skipBtn.addEventListener('click', () => finishTutorial());
        nextBtn.addEventListener('click', async () => {
            if (!running) return;
            nextBtn.disabled = true;

            try {
                const step = TUTORIAL_STEPS[activeStepIndex];
                if (step && typeof step.onNext === 'function') {
                    await step.onNext();
                }

                if (activeStepIndex >= TUTORIAL_STEPS.length - 1) {
                    finishTutorial();
                    return;
                }

                await showStep(activeStepIndex + 1);
            } finally {
                if (running) nextBtn.disabled = false;
            }
        });

        window.addEventListener('resize', positionOverlay, { passive: true });
        window.addEventListener('scroll', positionOverlay, { passive: true, capture: true });
    }

    function setShadeBox(el, top, left, width, height) {
        if (!el) return;
        el.style.top = `${Math.max(0, top)}px`;
        el.style.left = `${Math.max(0, left)}px`;
        el.style.width = `${Math.max(0, width)}px`;
        el.style.height = `${Math.max(0, height)}px`;
    }

    function positionCard(rect) {
        if (!card) return;

        // Toujours réinitialiser les styles conflictuels d'une étape précédente
        card.style.transform = 'none';
        card.style.right = 'auto';
        card.style.bottom = 'auto';

        if (!rect || rect.width <= 0 || rect.height <= 0) {
            card.style.top = '50%';
            card.style.left = '50%';
            card.style.transform = 'translate(-50%, -50%)';
            return;
        }

        if (isMobile()) {
            card.style.left = '12px';
            card.style.right = '12px';
            // Si la cible est dans la moitié basse de l'écran, placer la card en haut
            const targetInLowerHalf = rect.top > window.innerHeight * 0.45;
            if (targetInLowerHalf) {
                card.style.top = '12px';
                card.style.bottom = 'auto';
            } else {
                card.style.top = 'auto';
                card.style.bottom = '12px';
            }
            return;
        }

        const margin = 16;
        const cardWidth = Math.min(card.offsetWidth || 380, 380);
        const cardHeight = card.offsetHeight || 220;

        // Choisir au-dessus ou en-dessous selon l'espace disponible
        const spaceBelow = window.innerHeight - rect.bottom - margin;
        const spaceAbove = rect.top - margin;

        let top;
        if (spaceBelow >= cardHeight) {
            top = rect.bottom + 14;
        } else if (spaceAbove >= cardHeight) {
            top = rect.top - cardHeight - 14;
        } else {
            top = spaceBelow >= spaceAbove
                ? window.innerHeight - cardHeight - margin
                : margin;
        }

        top = clamp(top, margin, Math.max(margin, window.innerHeight - cardHeight - margin));
        const left = clamp(rect.left, margin, Math.max(margin, window.innerWidth - cardWidth - margin));

        card.style.top = `${top}px`;
        card.style.left = `${left}px`;
    }

    function positionOverlay() {
        if (!running || !root || root.hidden) return;

        const target = activeTarget;
        const rect = target ? target.getBoundingClientRect() : null;
        const validRect = rect && rect.width > 0 && rect.height > 0;

        if (!validRect) {
            setShadeBox(shadeTop, 0, 0, window.innerWidth, window.innerHeight);
            setShadeBox(shadeLeft, 0, 0, 0, 0);
            setShadeBox(shadeRight, 0, 0, 0, 0);
            setShadeBox(shadeBottom, 0, 0, 0, 0);
            focusRing.style.top = '-9999px';
            focusRing.style.left = '-9999px';
            focusRing.style.width = '0';
            focusRing.style.height = '0';
            positionCard(null);
            return;
        }

        const top = clamp(rect.top - OVERLAY_GAP, 0, window.innerHeight);
        const left = clamp(rect.left - OVERLAY_GAP, 0, window.innerWidth);
        const right = clamp(rect.right + OVERLAY_GAP, 0, window.innerWidth);
        const bottom = clamp(rect.bottom + OVERLAY_GAP, 0, window.innerHeight);
        const width = Math.max(0, right - left);
        const height = Math.max(0, bottom - top);

        setShadeBox(shadeTop, 0, 0, window.innerWidth, top);
        setShadeBox(shadeLeft, top, 0, left, height);
        setShadeBox(shadeRight, top, right, window.innerWidth - right, height);
        setShadeBox(shadeBottom, bottom, 0, window.innerWidth, window.innerHeight - bottom);

        const radius = parseFloat(window.getComputedStyle(target).borderRadius || '18') || 18;
        focusRing.style.top = `${top}px`;
        focusRing.style.left = `${left}px`;
        focusRing.style.width = `${width}px`;
        focusRing.style.height = `${height}px`;
        focusRing.style.borderRadius = `${Math.max(12, radius + 6)}px`;

        positionCard({ top, left, bottom, right, width, height });
    }

    async function selectClassGroup() {
        const classGroup = await waitForTarget({ target: '#channel-list .discussion-item.group-item[data-id="classe3c"]' }, 5000);
        if (classGroup) {
            classGroup.click();
            await wait(220);
        }
    }

    async function prepareDepositModal() {
        const openBtn = bySelector('#deposit-course-button');
        const modal = bySelector('#deposit-modal');
        if (openBtn && modal && !modal.classList.contains('active')) {
            openBtn.click();
            await wait(180);
        }
    }

    async function closeDepositModal() {
        const modal = bySelector('#deposit-modal');
        if (modal && modal.classList.contains('active')) {
            modal.classList.remove('active');
        }
    }

    async function ensureChatMobileParamsOpen() {
        if (!isMobile()) return;
        const mobileContent = bySelector('#mobile-params-content');
        const toggleBtn = bySelector('#params-toggle-btn');
        if (mobileContent && toggleBtn && !mobileContent.classList.contains('open')) {
            toggleBtn.click();
            await wait(160);
        }
    }

    async function ensureMessagerieComposeOpen() {
        const internalTab = bySelector('.mess-tab-btn[data-target="messagerie-wrapper"]');
        if (internalTab && !internalTab.classList.contains('active')) {
            internalTab.click();
            await wait(180);
        }
        const composeBtn = bySelector('#compose-message-btn');
        if (composeBtn) {
            composeBtn.click();
            await wait(180);
        }
    }

    function getCartableTarget() {
        const content = bySelector('#cartable-content');
        if (content && content.style.display !== 'none' && content.offsetParent !== null) return content;
        return bySelector('#cartable-login-panel') || bySelector('#cartable-layout');
    }

    function setCommunityWelcomeDraft() {
        if (hasPostedWelcomeMessage()) return;
        const input = bySelector('#community-message-input');
        if (!input) return;
        input.value = WELCOME_MESSAGE;
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    async function sendCommunityWelcomeMessage() {
        if (!canSendWelcomeMessage() || hasPostedWelcomeMessage()) return;
        const input = bySelector('#community-message-input');
        const sendBtn = bySelector('#send-community-message-btn');
        if (!input || !sendBtn) return;
        if (!input.value.trim()) {
            input.value = WELCOME_MESSAGE;
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        sendBtn.click();
        markWelcomeMessagePosted();
        await wait(500);
    }

    const TUTORIAL_STEPS = [
        {
            page: 'accueil',
            target: '#home-content',
            title: 'Accueil',
            text: () => "Ici, tu retrouves l'essentiel du site: ton classement, ton sac a dos, tes devoirs recents et tes messages utiles. C'est la page de repere pour savoir quoi faire en arrivant."
        },
        {
            page: 'accueil',
            mobileTarget: '#mobile-nav',
            desktopTarget: '#sidebar',
            title: 'Changer d\u2019onglet',
            text: () => isMobile()
                ? "Sur telephone, tu changes d'onglet avec cette barre d'icones. Chaque icone ouvre une partie du site."
                : "Sur PC, tu navigues avec ce menu lateral. Chaque onglet te fait passer d'une partie du site a l'autre."
        },
        {
            page: 'home',
            target: '#chat-form',
            title: 'Discuter avec l\u2019IA',
            text: () => "Dans Source AI, tu poses tes questions ici, tu peux joindre une image et lancer une nouvelle discussion quand tu veux repartir de zero."
        },
        {
            page: 'home',
            mobileTarget: '#mobile-params-dropdown',
            desktopTarget: '#controls-container',
            title: 'Changer les modes de l\u2019IA',
            onBeforeShow: ensureChatMobileParamsOpen,
            text: () => isMobile()
                ? "Sur telephone, ouvre ce panneau pour changer le mode, le niveau scolaire et les parametres du chat."
                : "Ici, tu changes le mode de l'IA, le niveau scolaire et les parametres du chat selon le type d'aide que tu veux."
        },
        {
            page: 'cours',
            target: '#deposit-modal .modal-content',
            onBeforeShow: prepareDepositModal,
            onNext: closeDepositModal,
            title: 'D\u00e9poser un cours',
            text: () => "Tu deposes tes cours ici. Tu ajoutes un titre, une matiere, un fichier, puis tu publies. Ensuite, les autres pourront aussi ouvrir la grille des cours et telecharger ce qui a ete partage."
        },
        {
            page: 'communaute',
            desktopTarget: '#channel-list .discussion-item.group-item[data-id="classe3c"]',
            mobileTarget: '#messages-container',
            onBeforeShow: selectClassGroup,
            title: 'Le groupe de classe',
            text: () => isMobile()
                ? "Voici le fil de discussion du groupe de classe. C'est ici que tu peux discuter avec tout le monde rapidement."
                : "Voici le groupe de classe. C'est ici que tu peux discuter avec tout le monde rapidement. On l'ouvre d'abord, puis on envoie ton premier message."
        },
        {
            page: 'communaute',
            target: '#community-message-input',
            onBeforeShow: async () => {
                await selectClassGroup();
                setCommunityWelcomeDraft();
            },
            onNext: sendCommunityWelcomeMessage,
            title: 'Envoyer ton premier message',
            text: () => hasPostedWelcomeMessage()
                ? "La zone de message est ici. Tu peux ecrire, joindre un fichier et envoyer dans le groupe de classe."
                : canSendWelcomeMessage()
                    ? "Le message est deja prepare ici. En cliquant sur Suivant, le site enverra automatiquement : \"Salut je viens d'arriver !\" dans le groupe de classe."
                    : "La zone de message est ici. Tu peux ecrire, joindre un fichier et envoyer dans le groupe de classe."
        },
        {
            page: 'messagerie',
            target: '#messaging-app-container',
            onBeforeShow: ensureMessagerieComposeOpen,
            title: 'Messagerie',
            text: () => "La messagerie sert pour les messages plus propres et plus organises: nouveau message, reponses, pieces jointes, sauvetages et meme l'onglet ED juste a cote."
        },
        {
            page: 'cartable',
            target: getCartableTarget,
            title: 'Cartable',
            text: () => {
                const content = bySelector('#cartable-content');
                const isConnected = content && content.style.display !== 'none' && content.offsetParent !== null;
                return isConnected
                    ? "Ici, tu consultes tes notes et tes devoirs. Utilise les onglets pour passer de l'un a l'autre, puis ouvre les details quand tu veux approfondir."
                    : "Ici, tu relies ton compte Ecole Directe. Une fois connecte, tu verras tes notes, tes devoirs et les infos utiles dans le cartable."
            }
        },
        {
            page: 'info',
            target: '#info-layout',
            title: 'Onglet points',
            text: () => "Cet onglet te montre tes points individuels, les points de la classe, ta progression et les graphiques. C'est la vue d'ensemble pour suivre ton activite."
        },
        {
            page: 'moncompte',
            target: '#user-avatar-wrapper',
            title: 'Changer ta photo de profil',
            text: () => "Dans Mon Compte, clique sur ta photo pour ouvrir la fenetre de changement de photo de profil."
        },
        {
            page: 'moncompte',
            target: '#change-password-btn',
            title: 'Changer ton mot de passe',
            text: () => "Ce bouton ouvre la fenetre pour modifier ton mot de passe en quelques secondes."
        },
        {
            page: 'moncompte',
            target: '#account-left-section',
            title: 'Th\u00e8mes et badges',
            text: () => "Toujours ici, tu ouvres la Boutique, l'Inventaire et les Badges. C'est la partie ou tu retrouves tes themes, tes fonds et toutes tes distinctions."
        }
    ];

    async function showStep(index) {
        ensureRoot();
        running = true;
        runningStartedAt = Date.now();
        root.hidden = false;
        activeStepIndex = index;

        const step = TUTORIAL_STEPS[index];
        await navigateToPage(step.page);

        if (typeof step.onBeforeShow === 'function') {
            await step.onBeforeShow();
        }

        activeTarget = await waitForTarget(step, 5000);

        if (!activeTarget && index === 0) {
            running = false;
            root.hidden = true;
            return;
        }

        if (activeTarget && typeof activeTarget.scrollIntoView === 'function') {
            activeTarget.scrollIntoView({ behavior: 'smooth', block: isMobile() ? 'center' : 'nearest', inline: 'nearest' });
            await wait(220);
        }

        progressEl.textContent = `Etape ${index + 1} / ${TUTORIAL_STEPS.length}`;
        titleEl.textContent = typeof step.title === 'function' ? step.title() : step.title;
        textEl.textContent = typeof step.text === 'function' ? step.text() : step.text;
        nextBtn.textContent = index === TUTORIAL_STEPS.length - 1 ? 'Terminer' : 'Suivant';
        nextBtn.disabled = false;

        await wait(60);
        positionOverlay();
    }

    function finishTutorial() {
        if (!root) return;
        running = false;
        runningStartedAt = 0;
        activeTarget = null;
        activeStepIndex = -1;
        root.hidden = true;
        markSeen();
        showRulesPanel();
    }

    function showRulesPanel() {
        try { if (localStorage.getItem(RULES_ACCEPTED_KEY) === '1') return; } catch {}

        const overlay = document.createElement('div');
        overlay.id = 'rules-overlay';
        Object.assign(overlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.92)', zIndex: '999999',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            padding: '20px', boxSizing: 'border-box'
        });

        const panel = document.createElement('div');
        Object.assign(panel.style, {
            background: 'linear-gradient(145deg, #1a0000, #2a0a0a)',
            border: '2px solid #cc3333',
            borderRadius: '15px',
            padding: '30px 25px',
            maxWidth: '520px',
            width: '100%',
            maxHeight: '85vh',
            overflowY: 'auto',
            boxShadow: '0 0 40px rgba(200, 30, 30, 0.4), 0 0 80px rgba(200, 30, 30, 0.15)',
            color: '#e0e0e0',
            fontFamily: 'inherit',
            animation: 'fadeInSlide 0.5s ease-out'
        });

        panel.innerHTML = `
            <div style="text-align:center; margin-bottom: 20px;">
                <h2 style="color: #ff4444; font-size: 1.6em; margin: 10px 0 5px;">R\u00e8gles et conditions d'utilisation</h2>
                <p style="color: #cc6666; font-size: 0.95em;">Vous devez accepter ces r\u00e8gles avant de pouvoir acc\u00e9der \u00e0 Alpha Source.</p>
            </div>
            <div style="background: rgba(255,50,50,0.08); border: 1px solid #551111; border-radius: 10px; padding: 20px; margin-bottom: 20px;">
                <h3 style="color: #ff6666; margin: 0 0 12px; font-size: 1.15em;">Comportements interdits</h3>
                <ul style="list-style: none; padding: 0; margin: 0; line-height: 2;">
                    <li style="margin-bottom: 4px;">- <strong>Harc\u00e8lement, menaces ou intimidation</strong> envers d'autres utilisateurs</li>
                    <li style="margin-bottom: 4px;">- <strong>Incitation \u00e0 la haine</strong> : racisme, homophobie, sexisme ou toute forme de discrimination</li>
                    <li style="margin-bottom: 4px;">- <strong>Contenu inappropri\u00e9</strong> : images ou messages \u00e0 caract\u00e8re pornographique, violent ou choquant</li>
                    <li style="margin-bottom: 4px;">- <strong>Spam et flood</strong> : publications r\u00e9p\u00e9titives ou sans int\u00e9r\u00eat</li>
                    <li style="margin-bottom: 4px;">- <strong>Usurpation d'identit\u00e9</strong> ou cr\u00e9ation de faux comptes</li>
                    <li style="margin-bottom: 4px;">- <strong>Triche ou exploitation de failles</strong> pour obtenir des avantages</li>
                    <li style="margin-bottom: 4px;">- <strong>Diffusion d'informations personnelles</strong> d'autrui sans consentement</li>
                </ul>
            </div>
            <div style="background: rgba(255,165,0,0.08); border: 1px solid #553311; border-radius: 10px; padding: 20px; margin-bottom: 20px;">
                <h3 style="color: #ffaa44; margin: 0 0 12px; font-size: 1.15em;">Mod\u00e9ration et signalements</h3>
                <ul style="list-style: none; padding: 0; margin: 0; line-height: 2;">
                    <li style="margin-bottom: 4px;">- Un <strong>syst\u00e8me automatique</strong> analyse les contenus publi\u00e9s sur la plateforme</li>
                    <li style="margin-bottom: 4px;">- Chaque utilisateur peut <strong>signaler un contenu ou un comportement</strong> qu'il juge inappropri\u00e9</li>
                    <li style="margin-bottom: 4px;">- Les <strong>signalements abusifs</strong> (sans motif valable) seront sanctionn\u00e9s</li>
                    <li style="margin-bottom: 4px;">- Toute infraction peut entra\u00eener un <strong>avertissement, un bannissement temporaire ou d\u00e9finitif</strong></li>
                </ul>
            </div>
            <div style="background: rgba(200,200,200,0.04); border: 1px solid #333; border-radius: 10px; padding: 20px; margin-bottom: 25px;">
                <h3 style="color: #aaa; margin: 0 0 12px; font-size: 1.15em;">Respect et bienveillance</h3>
                <p style="line-height: 1.7; margin: 0; color: #bbb;">
                    Alpha Source est un espace d'\u00e9change entre \u00e9l\u00e8ves. Chacun est libre de s'exprimer, 
                    de d\u00e9battre et de partager dans le <strong>respect des autres</strong>. 
                    Toute forme de communication doit rester dans un cadre respectueux et constructif.
                </p>
            </div>
            <div style="text-align: center;">
                <label id="rules-check-label" style="display: inline-flex; align-items: center; gap: 8px; cursor: pointer; color: #ccc; margin-bottom: 15px; font-size: 0.95em;">
                    <input type="checkbox" id="rules-checkbox" style="width: 18px; height: 18px; accent-color: #cc3333; cursor: pointer;">
                    J'ai lu et j'accepte les r\u00e8gles d'utilisation
                </label>
                <br>
                <button id="rules-accept-btn" disabled style="
                    width: 100%; padding: 15px; border: none; border-radius: 8px;
                    font-size: 1.2em; font-weight: 700; cursor: not-allowed;
                    background: #441111; color: #664444;
                    text-transform: uppercase; transition: all 0.3s;
                ">Accepter et continuer</button>
            </div>
        `;

        overlay.appendChild(panel);
        document.body.appendChild(overlay);

        const cb = panel.querySelector('#rules-checkbox');
        const btn = panel.querySelector('#rules-accept-btn');
        cb.addEventListener('change', () => {
            if (cb.checked) {
                btn.disabled = false;
                btn.style.cursor = 'pointer';
                btn.style.background = '#cc3333';
                btn.style.color = '#ffffff';
                btn.style.boxShadow = '0 4px 15px rgba(200,30,30,0.5)';
            } else {
                btn.disabled = true;
                btn.style.cursor = 'not-allowed';
                btn.style.background = '#441111';
                btn.style.color = '#664444';
                btn.style.boxShadow = 'none';
            }
        });
        btn.addEventListener('click', () => {
            try { localStorage.setItem(RULES_ACCEPTED_KEY, '1'); } catch {}
            overlay.remove();
            if (typeof renderPage === 'function') renderPage('accueil');
        });
    }

    function isStuckRunning() {
        return running && activeStepIndex === -1 && runningStartedAt > 0 && (Date.now() - runningStartedAt) > 12000;
    }

    async function startTutorial() {
        if (isStuckRunning()) {
            running = false;
            runningStartedAt = 0;
        }
        if (running || !shouldAutoStart()) return;
        ensureRoot();
        await showStep(0);
    }

    window.startSiteTutorial = startTutorial;
    window.finishSiteTutorial = finishTutorial;

    document.addEventListener('keydown', (event) => {
        if (!running) return;
        if (event.key === 'Escape') {
            finishTutorial();
        } else if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            nextBtn?.click();
        }
    });

    function tryStartIfHome() {
        if (running) return;
        if (!document.getElementById('home-content')) return;
        startTutorial().catch(e => console.error('[Tutorial]', e));
    }

    // MutationObserver : réagit dès que renderPage injecte home.html dans le wrapper
    document.addEventListener('DOMContentLoaded', () => {
        const wrapper = document.getElementById('page-content-wrapper');
        if (wrapper) {
            const obs = new MutationObserver(() => {
                if (document.getElementById('home-content') && !running) {
                    setTimeout(tryStartIfHome, 500);
                }
            });
            obs.observe(wrapper, { childList: true });
            setTimeout(() => obs.disconnect(), 20000);
        }

        // Démarrages de secours
        setTimeout(tryStartIfHome, 1500);
        setTimeout(tryStartIfHome, 3500);
    });

    // Pour les navigations ultérieures vers l'accueil
    window.addEventListener('alpha:page-rendered', (event) => {
        const page = event && event.detail && event.detail.page;
        if (!running && page === 'accueil') {
            setTimeout(tryStartIfHome, 500);
        }
    });
})();
