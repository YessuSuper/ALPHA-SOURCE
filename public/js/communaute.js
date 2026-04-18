// public/js/communaute.js

let activeChannelId = null;
let activeChannelType = null;
let avatarsCache = {}; // Cache pour les avatars 
let usersColorsCache = {}; // Cache couleurs utilisateurs (anneau)
let lastGlobalData = null;
const topicOpenState = new Map(); // topicId -> boolean (par défaut fermé)
const conversationMeta = new Map(); // key => { lastTs }
let resortTimer = null;
// Système de réponse aux messages
let replyingToMessage = null; // Message auquel on répond
let currentMessages = [];
// Auto-refresh pour messages en temps réel
let autoRefreshInterval = null;
let lastMessageId = null;
// Tooltip pour badges (système copié de moncompte.js)
let communauteTooltipTimeout;
// Variables pour l'autocomplétion (MOVED UP to prevent ReferenceError)
let allUsers = [];
let selectedFillMembers = [];

// Arrêter l'auto-refresh quand on quitte la page
window.addEventListener('beforeunload', () => {
    if (typeof stopAutoRefresh === 'function') {
        stopAutoRefresh();
    }
});

// Fonction globale pour afficher le tooltip de badge
window.showBadgeTooltipCommunaute = function (event, badgeInfo, isObtained) {
    const tooltip = document.getElementById('badge-tooltip');
    if (!tooltip) return;

    if (communauteTooltipTimeout) clearTimeout(communauteTooltipTimeout);

    document.getElementById('badge-tooltip-name').textContent = badgeInfo.name;
    document.getElementById('badge-tooltip-description').textContent = badgeInfo.description;

    // Réinitialiser
    tooltip.classList.remove('show', 'unobtained');
    if (!isObtained) {
        tooltip.classList.add('unobtained');
    }

    tooltip.style.opacity = '0';
    tooltip.style.display = 'block';
    tooltip.style.visibility = 'visible';

    const x = event.clientX || event.pageX;
    const y = event.clientY || event.pageY;

    const padding = 12;
    const tooltipWidth = tooltip.offsetWidth || 250;
    const tooltipHeight = tooltip.offsetHeight || 80;
    const left = Math.max(padding, Math.min(x + padding, window.innerWidth - tooltipWidth - padding));
    const top = Math.max(padding, Math.min(y + padding, window.innerHeight - tooltipHeight - padding));

    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';

    requestAnimationFrame(() => {
        tooltip.classList.add('show');
        tooltip.style.opacity = isObtained ? '1' : '0.7';
    });

    communauteTooltipTimeout = setTimeout(() => {
        tooltip.style.opacity = '0';
        setTimeout(() => {
            tooltip.style.display = 'none';
        }, 300);
    }, 3000);
};

function initCommunityChat() {

    function notify(message, options) {
        try {
            if (typeof window.showModal === 'function') {
                window.showModal(message, Object.assign({ type: 'alert', title: 'Notification' }, options || {}));
                return;
            }
        } catch (e) { }
        // fallback
        try { alert(message); } catch (e) { }
    }

    // Ouvrir automatiquement le sidebar sur mobile
    if (window.innerWidth <= 768) {
        document.body.classList.add('community-sidebar-open');
    }

    // Gestion du sidebar mobile
    const channelBrowserSidebar = document.getElementById('channel-browser-sidebar');
    if (channelBrowserSidebar) {
        // Plus d'overlay puisque le sidebar prend toute la largeur
        // Au lieu de cela, on ferme via le hamburger menu
    }

    // Gestion du hamburger menu pour la page communauté
    const mobileHamburgerBtn = document.getElementById('mobile-hamburger-btn');
    if (mobileHamburgerBtn) {
        mobileHamburgerBtn.addEventListener('click', function () {
            // Si on est sur mobile et qu'une conversation est ouverte, la fermer d'abord
            if (document.body.classList.contains('community-mobile-chat-open')) {
                closeMobileConversation();
            } else {
                // Ouvrir/fermer le sidebar des discussions
                document.body.classList.toggle('community-sidebar-open');
            }
        });
    }

    const currentUsername = (localStorage.getItem('source_username') || "").trim();
    const userDisplayNameElement = document.getElementById('current-user-display-name');
    if (userDisplayNameElement) {
        userDisplayNameElement.textContent = currentUsername || "Sigma_User";
    }

    // Précharger caches (PP + couleurs) pour le menu
    try { preloadAvatarsCache(); } catch (e) { }
    try { preloadUsersColors(); } catch (e) { }

    // Charger l'avatar de l'utilisateur actuel
    loadCurrentUserAvatar();

    // Charger la liste des utilisateurs pour les suggestions @
    try { loadAvailableUsers(); } catch (e) { }

    const channelListContainer = document.getElementById('channel-list');
    const chatTitleElement = document.getElementById('chat-title-pill');

    if (!channelListContainer) return;

    // Fonction pour charger les discussions
    function loadDiscussions() {
        fetch('/public/api/community/global.json')
            .then(response => response.json())
            .then(data => {
                lastGlobalData = data;
                renderDiscussions(data);
                try { updateChannelAvatarsFromCache(); } catch (e) { }
            })
            .catch(err => console.error('Erreur chargement discussions:', err));
    }

    function escapeHtml(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Handler global (delegation) pour les pills dans le chat
    const messagesContainerForLinks = document.getElementById('messages-container');
    if (messagesContainerForLinks && messagesContainerForLinks.dataset.linkDelegation !== 'true') {
        messagesContainerForLinks.dataset.linkDelegation = 'true';
        messagesContainerForLinks.addEventListener('click', (e) => {
            // Cours ID pill
            const pill = e.target.closest('.course-id-pill');
            if (pill) {
                const courseId = pill.getAttribute('data-course-id');
                if (courseId) {
                    e.preventDefault(); e.stopPropagation();
                    navigateToCourseById(courseId);
                    return;
                }
            }
            // @mention
            const mention = e.target.closest('.user-mention');
            if (mention) {
                const uname = mention.getAttribute('data-username');
                if (uname) { e.preventDefault(); e.stopPropagation(); openUserProfile(uname); return; }
            }
            // Plain name
            const nameToken = e.target.closest('.user-name-token');
            if (nameToken) {
                const uname = nameToken.getAttribute('data-username');
                if (uname) { e.preventDefault(); e.stopPropagation(); openUserProfile(uname); return; }
            }
        });
    }

    function normalizeUsername(u) {
        return String(u || '').trim().toLowerCase();
    }

    function truncatePreview(text, maxLen) {
        const normalized = String(text || '').replace(/\s+/g, ' ').trim();
        if (!normalized) return '';
        if (normalized.length <= maxLen) return normalized;
        return normalized.slice(0, maxLen) + '....';
    }

    // ------------------------------------------------------------------
    // Mentions & profils
    // ------------------------------------------------------------------
    const COURSE_ID_TOKEN_REGEX = /\b(\d{10,16})\b/g; // ex: 1767369259987
    const COURSE_FILTER_STORAGE_KEY = 'alpha_course_filter_id';
    let ppDataCache = null;

    function escapeRegex(str) {
        return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function getAllUsernames() {
        // Reutilise la liste construite pour les formulaires (groupes/fills)
        const unique = new Set();
        if (Array.isArray(allUsers)) {
            allUsers.forEach(u => { if (u) unique.add(String(u)); });
        }
        const cu = (localStorage.getItem('source_username') || '').trim();
        if (cu) unique.add(cu);
        return Array.from(unique);
    }

    function navigateToCourseById(courseId) {
        const id = String(courseId || '').trim();
        if (!id) return;
        try { localStorage.setItem(COURSE_FILTER_STORAGE_KEY, id); } catch (e) { }
        if (typeof window.renderPage === 'function') { window.renderPage('cours'); return; }
        const anyLink = document.querySelector('[data-page="cours"]');
        if (anyLink) { try { anyLink.click(); } catch (e) { } return; }
        console.warn('Navigation vers cours impossible');
    }

    function formatMessageContentWithLinks(content) {
        // 1) Sécurité
        let safe = escapeHtml(typeof content === 'string' ? content : '');
        // 2) IDs de cours (pills)
        safe = safe.replace(COURSE_ID_TOKEN_REGEX, (_m, id) => {
            const courseId = String(id);
            return `<button type="button" class="course-id-pill" data-course-id="${courseId}" aria-label="Ouvrir le cours ${courseId}">${courseId}</button>`;
        });

        const usernames = getAllUsernames();
        const lowerMap = new Map(usernames.map(n => [String(n).toLowerCase(), String(n)]));

        // 3) Mentions génériques @token (même sans connaître l'utilisateur)
        const genericAt = /(^|[\s.,;!?:()\[\]{}\"'])@([A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'_-]{0,30})(?=($|[\s.,;!?:()\[\]{}\"']))/g;
        safe = safe.replace(genericAt, (m, p1, token) => {
            const canonical = lowerMap.get(String(token).toLowerCase()) || token;
            return `${p1}<span class="user-mention" data-username="${escapeHtml(canonical)}">@${escapeHtml(canonical)}</span>`;
        });

        // 4) Noms simples (sans @) → cliquables; case-insensitive mapping à la liste connue
        usernames.forEach(name => {
            const rx = new RegExp(`(^|[\\s.,;!?:()\[\]{}\"'])(${escapeRegex(name)})(?=($|[\\s.,;!?:()\[\]{}\"']))`, 'gi');
            safe = safe.replace(rx, (match, p1, p2) => `${p1}<span class="user-name-token" data-username="${escapeHtml(name)}">${p2}</span>`);
        });
        return safe.replace(/\n/g, '<br>');
    }

    function formatLastMessagePreview(msg) {
        if (!msg || typeof msg !== 'object') return '';
        const senderRaw = String(msg.sender || msg.username || msg.from || '').trim() || '???';
        const sender = normalizeUsername(senderRaw) === normalizeUsername(currentUsername) ? 'Vous' : senderRaw;
        const type = String(msg.type || '').toLowerCase();
        const content = typeof msg.content === 'string' ? msg.content : '';
        const hasText = content.replace(/\s+/g, ' ').trim().length > 0;
        const hasFile = !!msg.file;

        if (type === 'image') {
            if (hasText) return sender + ': ' + truncatePreview(content, 34);
            return sender + ': [image]';
        }
        if (type === 'text') {
            return sender + ': ' + truncatePreview(content, 34);
        }
        if (hasText) {
            return sender + ': ' + truncatePreview(content, 34);
        }
        if (hasFile) {
            return sender + ': [fichier]';
        }
        return '';
    }

    function pickLastMessage(messages) {
        if (!Array.isArray(messages) || messages.length === 0) return null;
        let last = messages[messages.length - 1];
        let lastTs = Date.parse(last && last.timestamp ? last.timestamp : '');
        if (!Number.isFinite(lastTs)) lastTs = -Infinity;
        for (const m of messages) {
            const ts = Date.parse(m && m.timestamp ? m.timestamp : '');
            if (Number.isFinite(ts) && ts >= lastTs) {
                lastTs = ts;
                last = m;
            }
        }
        return last;
    }

    function scheduleResortConversationList() {
        if (resortTimer) clearTimeout(resortTimer);
        resortTimer = setTimeout(() => {
            try { resortConversationList(); } catch (e) { }
        }, 60);
    }

    function applyTopicVisibility(topicId) {
        const isOpen = topicOpenState.get(topicId) === true;

        const topicItem = document.querySelector(`.discussion-item.topic-item[data-id="${CSS.escape(topicId)}"]`);
        if (topicItem) {
            const btn = topicItem.querySelector('.topic-toggle');
            if (btn) btn.textContent = isOpen ? '▾' : '▸';
        }

        document.querySelectorAll(`.discussion-item.fill-item[data-topic-id="${CSS.escape(topicId)}"]`).forEach(li => {
            const isMember = li.getAttribute('data-is-member') === '1';
            // fermé: afficher seulement les fills où on est membre
            li.style.display = (!isOpen && !isMember) ? 'none' : '';
        });
    }

    function resortConversationList() {
        const channelList = document.getElementById('channel-list');
        if (!channelList) return;

        const nodes = Array.from(channelList.children).filter(n => n && n.classList && n.classList.contains('discussion-item'));
        const blocks = new Map();

        for (const node of nodes) {
            const blockId = node.getAttribute('data-block-id') || ('misc:' + (node.getAttribute('data-id') || ''));
            if (!blocks.has(blockId)) {
                blocks.set(blockId, {
                    id: blockId,
                    nodes: [],
                    maxTs: 0,
                    orig: Number(node.getAttribute('data-orig-order') || '0') || 0,
                    pinnedRank: blockId === 'group:classe3c' ? 0 : 1
                });
            }
            const block = blocks.get(blockId);
            block.nodes.push(node);

            const type = node.getAttribute('data-type') || '';
            const id = node.getAttribute('data-id') || '';
            const key = type + ':' + id;
            const meta = conversationMeta.get(key);
            const ts = meta && Number.isFinite(meta.lastTs) ? meta.lastTs : 0;
            if (ts > block.maxTs) block.maxTs = ts;
        }

        const sortedBlocks = Array.from(blocks.values()).sort((a, b) => {
            if (a.pinnedRank !== b.pinnedRank) return a.pinnedRank - b.pinnedRank;
            if (a.maxTs !== b.maxTs) return b.maxTs - a.maxTs;
            return a.orig - b.orig;
        });

        const frag = document.createDocumentFragment();
        for (const b of sortedBlocks) {
            for (const n of b.nodes) frag.appendChild(n);
        }
        channelList.appendChild(frag);
    }

    function applyLastMessageToItem(li, discussionId, discussionType, opts) {
        if (!li || !discussionId || !discussionType) return;
        const previewEl = li.querySelector('.discussion-preview');
        if (!previewEl) return;
        const options = opts || {};
        if (options.skipFetch) {
            previewEl.textContent = '';
            return;
        }

        fetch(`/public/api/community/messages/${encodeURIComponent(discussionId)}/${encodeURIComponent(discussionType)}?username=${encodeURIComponent(currentUsername)}`)
            .then(r => r.json())
            .then(payload => {
                if (!payload || !payload.success) return;
                const messages = Array.isArray(payload.messages) ? payload.messages : [];
                const lastMsg = pickLastMessage(messages);
                if (!lastMsg) {
                    previewEl.textContent = '';
                    conversationMeta.set(discussionType + ':' + discussionId, { lastTs: 0 });
                    scheduleResortConversationList();
                    return;
                }

                previewEl.textContent = formatLastMessagePreview(lastMsg);
                const ts = Date.parse(lastMsg.timestamp || '');
                const tsVal = Number.isFinite(ts) ? ts : Date.now();
                conversationMeta.set(discussionType + ':' + discussionId, { lastTs: tsVal });

                // Exception fills: si fill membre rattaché à un sujet, remonter le sujet+fills pour toi
                if (options.bumpBlockId) {
                    const prev = conversationMeta.get(options.bumpBlockId);
                    const prevTs = prev && Number.isFinite(prev.lastTs) ? prev.lastTs : 0;
                    if (tsVal > prevTs) conversationMeta.set(options.bumpBlockId, { lastTs: tsVal });
                }

                scheduleResortConversationList();
            })
            .catch(() => { });
    }

    // Fonction pour rendre les discussions dans la liste
    function renderDiscussions(data) {
        const channelList = document.getElementById('channel-list');
        if (!channelList) return;

        // Vider la liste actuelle
        channelList.innerHTML = '';

        const groups = Array.isArray(data.groups) ? data.groups : [];
        const topics = Array.isArray(data.topics) ? data.topics : [];
        const fills = Array.isArray(data.fills) ? data.fills : [];
        const mps = Array.isArray(data.mps) ? data.mps : [];

        const fillsByParent = new Map();
        for (const fill of fills) {
            const parentType = fill.parentType || '';
            const parentId = fill.parentId || '';
            const key = parentType + ':' + parentId;
            if (!fillsByParent.has(key)) fillsByParent.set(key, []);
            fillsByParent.get(key).push(fill);
        }

        let origOrder = 0;

        function makeAvatarForMp(username) {
            const wrap = document.createElement('span');
            wrap.className = 'channel-avatar-wrap';
            wrap.style.background = usersColorsCache[username] || 'rgba(255,255,255,0.4)';
            wrap.style.padding = '2px';

            const img = document.createElement('img');
            img.className = 'channel-avatar-img';
            img.setAttribute('data-username', username);
            img.alt = 'PP';
            img.src = avatarsCache[username] || '/ressources/user-icon.png';
            wrap.appendChild(img);
            return wrap;
        }

        function makeAvatarForGroup(group) {
            const wrap = document.createElement('span');
            wrap.className = 'channel-group-wrap' + (group && group.id === 'classe3c' ? ' class-group' : '');
            const img = document.createElement('img');
            img.className = 'channel-group-img';
            img.alt = 'Groupe';
            const photoUrl = group && typeof group.photoUrl === 'string' ? group.photoUrl : '';
            img.src = photoUrl ? (photoUrl + (photoUrl.includes('?') ? '&' : '?') + 'v=' + Date.now()) : '/ressources/communaute/grpicon.png';
            wrap.appendChild(img);
            return wrap;
        }

        function makeAvatarForTopic() {
            const img = document.createElement('img');
            img.className = 'channel-icon';
            img.alt = 'Topic Icon';
            img.src = '/ressources/communaute/sujeticon.png';
            return img;
        }

        function makeAvatarForFill() {
            const img = document.createElement('img');
            img.className = 'discussion-icon';
            img.alt = 'Fill Icon';
            img.src = '/ressources/communaute/fillicon.png';
            return img;
        }

        function makeTextBlock(titleText) {
            const wrap = document.createElement('div');
            wrap.className = 'discussion-text';

            const title = document.createElement('div');
            title.className = 'discussion-title';
            title.textContent = titleText;

            const preview = document.createElement('div');
            preview.className = 'discussion-preview';
            preview.textContent = '';

            wrap.appendChild(title);
            wrap.appendChild(preview);
            return wrap;
        }

        // Ajouter les groupes + leurs fills (block WhatsApp)
        groups.forEach(group => {
            const isGroupVisible = (group && group.id === 'classe3c') || (group && Array.isArray(group.members) && group.members.includes(currentUsername));
            if (!isGroupVisible) return;

            const li = document.createElement('li');
            li.className = 'discussion-item group-item parent-channel';
            li.setAttribute('data-id', group.id);
            li.setAttribute('data-type', 'group');
            li.setAttribute('data-block-id', 'group:' + group.id);
            li.setAttribute('data-orig-order', String(origOrder++));
            li.setAttribute('data-display-name', group.name);
            li.appendChild(makeAvatarForGroup(group));
            li.appendChild(makeTextBlock(group.name));
            channelList.appendChild(li);

            applyLastMessageToItem(li, group.id, 'group');

            const groupFills = fillsByParent.get('group:' + group.id) || [];
            for (const fill of groupFills) {
                const fillLi = document.createElement('li');
                fillLi.className = 'discussion-item fill-item child-channel';
                fillLi.setAttribute('data-id', fill.id);
                fillLi.setAttribute('data-type', 'fill');
                fillLi.setAttribute('data-parent-type', fill.parentType);
                fillLi.setAttribute('data-parent-id', fill.parentId);
                fillLi.setAttribute('data-block-id', 'group:' + group.id);
                fillLi.setAttribute('data-orig-order', String(origOrder++));

                const isMember = fill.members && fill.members.includes(currentUsername);
                fillLi.classList.add(isMember ? 'member' : 'non-member');
                fillLi.setAttribute('data-display-name', '# ' + fill.name);

                fillLi.appendChild(makeAvatarForFill());
                fillLi.appendChild(makeTextBlock('# ' + fill.name));

                // Indicateur de membre
                const memberBadge = document.createElement('span');
                if (isMember) {
                    memberBadge.className = 'member-indicator';
                    memberBadge.textContent = '✓';
                    memberBadge.title = 'Vous êtes membre';
                } else {
                    memberBadge.className = 'non-member-indicator';
                    memberBadge.textContent = '✗';
                    memberBadge.title = 'Vous n\'êtes pas membre';
                }
                fillLi.appendChild(memberBadge);

                // Pas de bouton "Demander à rejoindre" dans le menu conversations.

                channelList.appendChild(fillLi);

                applyLastMessageToItem(fillLi, fill.id, 'fill', { skipFetch: !isMember });
            }
        });

        // Ajouter les sujets + leurs fills (avec collapse/expand)
        topics.forEach(topic => {
            const li = document.createElement('li');
            li.className = 'discussion-item topic-item parent-channel';
            li.setAttribute('data-id', topic.id);
            li.setAttribute('data-type', 'topic');
            li.setAttribute('data-block-id', 'topic:' + topic.id);
            li.setAttribute('data-orig-order', String(origOrder++));
            li.setAttribute('data-display-name', topic.name);

            const isOpen = topicOpenState.get(topic.id) === true;
            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'topic-toggle';
            toggleBtn.type = 'button';
            toggleBtn.textContent = isOpen ? '▾' : '▸';
            toggleBtn.addEventListener('click', (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                topicOpenState.set(topic.id, !(topicOpenState.get(topic.id) === true));
                applyTopicVisibility(topic.id);
            });
            li.appendChild(toggleBtn);
            li.appendChild(makeAvatarForTopic());
            li.appendChild(makeTextBlock(topic.name));
            channelList.appendChild(li);

            // Topic: pas de chat direct, mais on veut pouvoir remonter le block via fills membres
            const topicFills = fillsByParent.get('topic:' + topic.id) || [];
            for (const fill of topicFills) {
                const isMember = fill.members && fill.members.includes(currentUsername);

                const fillLi = document.createElement('li');
                fillLi.className = 'discussion-item fill-item child-channel';
                fillLi.setAttribute('data-id', fill.id);
                fillLi.setAttribute('data-type', 'fill');
                fillLi.setAttribute('data-parent-type', fill.parentType);
                fillLi.setAttribute('data-parent-id', fill.parentId);
                fillLi.setAttribute('data-block-id', 'topic:' + topic.id);
                fillLi.setAttribute('data-topic-id', topic.id);
                fillLi.setAttribute('data-is-member', isMember ? '1' : '0');
                fillLi.setAttribute('data-orig-order', String(origOrder++));
                fillLi.classList.add(isMember ? 'member' : 'non-member');
                fillLi.setAttribute('data-display-name', '# ' + fill.name);

                fillLi.appendChild(makeAvatarForFill());
                fillLi.appendChild(makeTextBlock('# ' + fill.name));

                // Indicateur de membre
                const memberBadge = document.createElement('span');
                if (isMember) {
                    memberBadge.className = 'member-indicator';
                    memberBadge.textContent = '✓';
                    memberBadge.title = 'Vous êtes membre';
                } else {
                    memberBadge.className = 'non-member-indicator';
                    memberBadge.textContent = '✗';
                    memberBadge.title = 'Vous n\'êtes pas membre';
                }
                fillLi.appendChild(memberBadge);

                // Pas de bouton "Demander à rejoindre" dans le menu conversations.

                channelList.appendChild(fillLi);

                applyLastMessageToItem(fillLi, fill.id, 'fill', {
                    skipFetch: !isMember,
                    bumpBlockId: isMember ? ('topic:' + topic.id) : null
                });
            }

            // Appliquer l'état ouvert/fermé sans re-render
            applyTopicVisibility(topic.id);
        });

        // Ajouter les fills sans parent (fallback)
        const orphanFills = fills.filter(f => !(f && f.parentType && f.parentId) || !fillsByParent.has((f.parentType || '') + ':' + (f.parentId || '')));
        orphanFills.forEach(fill => {
            const li = document.createElement('li');
            li.className = 'discussion-item fill-item child-channel';
            li.setAttribute('data-id', fill.id);
            li.setAttribute('data-type', 'fill');
            li.setAttribute('data-parent-type', fill.parentType);
            li.setAttribute('data-parent-id', fill.parentId);
            li.setAttribute('data-block-id', 'misc:' + fill.id);
            li.setAttribute('data-orig-order', String(origOrder++));

            const isMember = fill.members && fill.members.includes(currentUsername);
            li.classList.add(isMember ? 'member' : 'non-member');
            li.setAttribute('data-display-name', '# ' + fill.name);

            li.appendChild(makeAvatarForFill());
            li.appendChild(makeTextBlock('# ' + fill.name));

            // Indicateur de membre
            const memberBadge = document.createElement('span');
            if (isMember) {
                memberBadge.className = 'member-indicator';
                memberBadge.textContent = '✓';
                memberBadge.title = 'Vous êtes membre';
            } else {
                memberBadge.className = 'non-member-indicator';
                memberBadge.textContent = '✗';
                memberBadge.title = 'Vous n\'êtes pas membre';
            }
            li.appendChild(memberBadge);

            // Pas de bouton "Demander à rejoindre" dans le menu conversations.

            channelList.appendChild(li);
            applyLastMessageToItem(li, fill.id, 'fill', { skipFetch: !isMember });
        });

        // Ajouter les MP (seulement ceux où l'utilisateur est participant)
        mps.forEach(mp => {
            if (!(mp.participants && mp.participants.includes(currentUsername))) return;
            const li = document.createElement('li');
            li.className = 'discussion-item mp-item';
            li.setAttribute('data-id', mp.id);
            li.setAttribute('data-type', 'mp');
            li.setAttribute('data-block-id', 'mp:' + mp.id);
            li.setAttribute('data-orig-order', String(origOrder++));

            const otherParticipant = mp.participants.find(p => p !== currentUsername);
            const displayName = otherParticipant || 'Message privé';
            li.setAttribute('data-display-name', displayName);

            li.appendChild(makeAvatarForMp(otherParticipant || ''));
            li.appendChild(makeTextBlock(displayName));
            channelList.appendChild(li);

            applyLastMessageToItem(li, mp.id, 'mp');
        });

        // Ordonner une première fois (classe en haut), puis resort avec les previews
        try { resortConversationList(); } catch (e) { }

        // Activer le premier élément par défaut (en évitant les topics)
        const first = channelList.querySelector('.discussion-item[data-type="group"], .discussion-item.fill-item.member, .discussion-item[data-type="mp"]');
        if (first) {
            first.classList.add('active');
            activeChannelId = first.getAttribute('data-id') || null;
            const firstType = first.getAttribute('data-type');
            activeChannelType = firstType;
            const titlePill = document.getElementById('chat-title-pill');
            if (titlePill) {
                titlePill.textContent = first.getAttribute('data-display-name') || first.innerText.trim();
                titlePill.onclick = openGroupDetailsOverlay;
            }
            // Charger les messages et configurer l'input
            loadMessages(activeChannelId, firstType);
            toggleMessageInput(firstType);
        } else {
            // Aucun élément, désactiver l'input
            toggleMessageInput(null);
        }
    }

    // Charger les discussions depuis global.json
    loadDiscussions();

    /* --- MOBILE: ouvrir conversation en plein écran comme WhatsApp --- */
    const channelListElem = document.getElementById('channel-list');

    function openMobileConversation(channelId, channelName, channelType) {
        // Fermer le sidebar et ouvrir la conversation
        document.body.classList.remove('community-sidebar-open');
        document.body.classList.add('community-mobile-chat-open');
        const chatTitlePill = document.getElementById('chat-title-pill');
        if (chatTitlePill) {
            chatTitlePill.textContent = '# ' + channelName;
            chatTitlePill.onclick = openGroupDetailsOverlay;
        }
        // charger messages (réutilise la fonction existante si définie)
        try { loadMessages(channelId, channelType); } catch (e) { console.warn('loadMessages non dispo', e); }
    }

    function closeMobileConversation() {
        document.body.classList.remove('community-mobile-chat-open');
        document.body.classList.add('community-sidebar-open');
    }

    // (click handler géré plus bas sur channelListContainer)

    // Créer un bouton croix mobile dans le header (si absent) et lier la fermeture
    (function ensureMobileCloseButton() {
        const activeChat = document.getElementById('active-chat-column');
        if (!activeChat) return;
        // créer header wrapper si inexistant
        let mobileHeader = activeChat.querySelector('.mobile-chat-header');
        if (!mobileHeader) {
            mobileHeader = document.createElement('div');
            mobileHeader.className = 'mobile-chat-header';
            // bouton close
            const closeBtn = document.createElement('button');
            closeBtn.className = 'mobile-close-btn';
            closeBtn.id = 'mobile-close-chat-btn';
            closeBtn.innerHTML = '✕';
            closeBtn.addEventListener('click', () => {
                closeMobileConversation();
            });
            // titre (déplacer l'existant si possible)
            const titleEl = document.getElementById('chat-title') || document.createElement('span');
            titleEl.id = 'chat-title';
            // clear and append
            mobileHeader.appendChild(closeBtn);
            mobileHeader.appendChild(titleEl);
            // insérer en haut de activeChat, avant messages
            const messagesContainer = document.getElementById('messages-container');
            activeChat.insertBefore(mobileHeader, messagesContainer);
        } else {
            // s'assurer que le bouton exist
            const btn = mobileHeader.querySelector('.mobile-close-btn');
            if (!btn) {
                const closeBtn = document.createElement('button');
                closeBtn.className = 'mobile-close-btn';
                closeBtn.id = 'mobile-close-chat-btn';
                closeBtn.innerHTML = '✕';
                closeBtn.addEventListener('click', () => closeMobileConversation());
                mobileHeader.insertBefore(closeBtn, mobileHeader.firstChild);
            }
        }
    })();

    // --- GESTION DU BOUTON "+" ET MENU FLOTTANT ---
    const createButton = document.getElementById('create-discussion-btn');
    const createMenuOverlay = document.getElementById('create-menu-overlay');
    const createMenuPanel = document.getElementById('create-menu-panel');

    if (createButton && createMenuOverlay) {
        // Fonction pour basculer le menu
        function toggleCreateMenu() {
            if (createMenuOverlay.style.display === 'block') {
                createMenuOverlay.style.display = 'none';
            } else {
                createMenuOverlay.style.display = 'block';
            }
        }

        // Événement sur le bouton '+'
        createButton.addEventListener('click', toggleCreateMenu);

        // Fermer si on clique sur l'overlay (extérieur du menu)
        createMenuOverlay.addEventListener('click', (e) => {
            if (e.target === createMenuOverlay) {
                toggleCreateMenu();
            }
        });

        // Gestion des clics sur les items du menu
        if (createMenuPanel) {
            createMenuPanel.addEventListener('click', (e) => {
                const item = e.target.closest('.menu-item');
                if (item) {
                    const action = item.getAttribute('data-action');
                    handleCreateAction(action);
                    toggleCreateMenu(); // Fermer le menu après sélection
                }
            });
        }
    }

    // --- GESTION DU DON DE POINTS ---
    const givePointsBtn = document.getElementById('give-points-btn');
    const givePointsOverlay = document.getElementById('give-points-overlay');
    const closeGivePointsBtn = document.getElementById('close-give-points-btn');
    const givePointsForm = document.getElementById('give-points-form');
    let givePointsSuggestions = document.getElementById('give-points-suggestions');

    if (givePointsBtn && givePointsOverlay) {
        function toggleGivePointsOverlay() {
            if (givePointsOverlay.style.display === 'flex') {
                givePointsOverlay.style.display = 'none';
            } else {
                givePointsOverlay.style.display = 'flex';
                // Reset form
                if (givePointsForm) givePointsForm.reset();
                if (givePointsSuggestions) givePointsSuggestions.style.display = 'none';

                // Fetch balance
                fetchCurrentBalance();
            }
        }

        givePointsBtn.addEventListener('click', toggleGivePointsOverlay);
        if (closeGivePointsBtn) closeGivePointsBtn.addEventListener('click', toggleGivePointsOverlay);
        givePointsOverlay.addEventListener('click', (e) => {
            if (e.target === givePointsOverlay) toggleGivePointsOverlay();
        });

        // Autocomplete
        const recipientInput = document.getElementById('give-points-recipient');
        if (recipientInput && givePointsSuggestions) {
            recipientInput.addEventListener('input', () => {
                const val = recipientInput.value.toLowerCase().trim();
                givePointsSuggestions.innerHTML = '';
                if (val.length < 1) {
                    givePointsSuggestions.style.display = 'none';
                    return;
                }

                const matches = (allUsers || []).filter(u =>
                    u.toLowerCase().includes(val) &&
                    u.toLowerCase() !== currentUsername.toLowerCase()
                );

                if (matches.length > 0) {
                    givePointsSuggestions.style.display = 'block';
                    matches.forEach(match => {
                        const div = document.createElement('div');
                        div.textContent = match;
                        div.style.padding = '8px';
                        div.style.cursor = 'pointer';
                        div.addEventListener('mouseenter', () => div.style.background = 'rgba(255,255,255,0.1)');
                        div.addEventListener('mouseleave', () => div.style.background = 'transparent');
                        div.addEventListener('click', () => {
                            recipientInput.value = match;
                            givePointsSuggestions.style.display = 'none';
                        });
                        givePointsSuggestions.appendChild(div);
                    });
                } else {
                    givePointsSuggestions.style.display = 'none';
                }
            });

            // Clic dehors pour fermer suggestions
            document.addEventListener('click', (e) => {
                if (e.target !== recipientInput && e.target !== givePointsSuggestions) {
                    givePointsSuggestions.style.display = 'none';
                }
            });
        }

        // Fetch Balance
        function fetchCurrentBalance() {
            if (!currentUsername) return;

            fetch(`/api/user/balance?username=${encodeURIComponent(currentUsername)}`)
                .then(r => r.json())
                .then(data => {
                    if (data.success) {
                        const balanceEl = document.getElementById('give-points-current-balance');
                        if (balanceEl) balanceEl.textContent = data.points + ' pts';
                    }
                })
                .catch(err => {
                    console.error("Error fetching balance:", err);
                    const balanceEl = document.getElementById('give-points-current-balance');
                    if (balanceEl) balanceEl.textContent = '--';
                });
        }

        // Submit Logic
        if (givePointsForm) {
            givePointsForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const recipient = document.getElementById('give-points-recipient').value.trim();
                const amount = parseInt(document.getElementById('give-points-amount').value, 10);

                if (!recipient || !amount || amount <= 0) {
                    notify("Veuillez remplir correctement les champs", { type: 'error' });
                    return;
                }

                if (typeof window.showModal === 'function') {
                    const confirmed = await window.showModal(`Confirmer l'envoi de ${amount} points à ${recipient} ?`, {
                        type: 'confirm',
                        title: 'Confirmation de don',
                        confirmText: 'Envoyer',
                        cancelText: 'Annuler'
                    });
                    if (!confirmed) return;
                } else {
                    if (!confirm(`Confirmer l'envoi de ${amount} points à ${recipient} ?`)) return;
                }

                const btn = givePointsForm.querySelector('button[type="submit"]');
                if (btn) btn.disabled = true;

                fetch('/api/community/give-points', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sender: currentUsername,
                        receiver: recipient,
                        amount: amount
                    })
                })
                    .then(async r => {
                        const data = await r.json();
                        if (r.ok && data.success) {
                            if (typeof window.showModal === 'function') {
                                await window.showModal(data.message, { type: 'alert', title: 'Succès' });
                            } else {
                                notify(data.message, { type: 'success' });
                            }
                            toggleGivePointsOverlay();
                            // Update balance visually (si on rouvre)
                            const balanceEl = document.getElementById('give-points-current-balance');
                            if (balanceEl) balanceEl.textContent = data.newBalance + ' pts';
                        } else {
                            notify(data.message || "Erreur lors de l'envoi", { type: 'error' });
                        }
                    })
                    .catch(err => {
                        console.error(err);
                        notify("Erreur de connexion", { type: 'error' });
                    })
                    .finally(() => {
                        if (btn) btn.disabled = false;
                    });
            });
        }
    }

    // Fonction pour gérer les actions de création
    function handleCreateAction(action) {
        openCreateModal(action);
    }

    // Fonction pour ouvrir le modal de création
    function openCreateModal(action) {
        const modalOverlay = document.getElementById('create-modal-overlay');
        const modalTitle = document.getElementById('modal-title');
        const createModal = document.getElementById('create-modal');
        const forms = createModal ? createModal.querySelectorAll('.modal-form') : [];

        // Masquer tous les formulaires
        forms.forEach(form => form.style.display = 'none');

        // Configurer selon l'action
        switch (action) {
            case 'newGroup':
                modalTitle.textContent = 'Créer un nouveau groupe';
                document.getElementById('group-form').style.display = 'flex';
                break;
            case 'newTopic':
                modalTitle.textContent = 'Créer un nouveau sujet';
                document.getElementById('topic-form').style.display = 'flex';
                break;
            case 'newFill':
                modalTitle.textContent = 'Créer un nouveau fill';
                document.getElementById('fill-form').style.display = 'flex';
                try { resetFillMembersSelection(); } catch (e) { }
                try { loadAvailableUsers(); } catch (e) { }
                loadParentOptions();
                break;
            case 'newMp':
                modalTitle.textContent = 'Créer une conversation privée';
                document.getElementById('mp-form').style.display = 'flex';
                loadAvailableUsers();
                break;
        }

        modalOverlay.style.display = 'flex';
    }

    // Utilisé par la bulle "Créer un fill" (sélection après chargement async des options)
    let pendingFillParentTopicId = null;

    // Fonction pour fermer le modal
    function closeCreateModal() {
        const modalOverlay = document.getElementById('create-modal-overlay');
        const createModal = document.getElementById('create-modal');
        const forms = createModal ? createModal.querySelectorAll('.modal-form') : [];

        modalOverlay.style.display = 'none';
        forms.forEach(form => form.style.display = 'none');

        // Réinitialiser les formulaires
        forms.forEach(form => form.reset());

        try { resetFillMembersSelection(); } catch (e) { }
    }

    // Fonction pour charger les options de parent pour les fills
    function loadParentOptions() {
        const parentTypeSelect = document.getElementById('fill-parent-type');
        const parentIdSelect = document.getElementById('fill-parent-id');
        const parentTopicSelect = document.getElementById('fill-parent-topic');

        const parentType = parentTypeSelect ? parentTypeSelect.value : 'topic';

        // Vider les options existantes (selon le markup)
        const targetSelect = parentTopicSelect || parentIdSelect;
        if (!targetSelect) return;
        targetSelect.innerHTML = '<option value="">Choisir un sujet...</option>';

        if (parentType === 'group') {
            // Charger les groupes
            fetch('/public/api/community/global.json')
                .then(response => response.json())
                .then(data => {
                    if (data.groups) {
                        data.groups.forEach(group => {
                            const option = document.createElement('option');
                            option.value = group.id;
                            option.textContent = group.name;
                            targetSelect.appendChild(option);
                        });
                    }

                    if (pendingFillParentTopicId) {
                        targetSelect.value = pendingFillParentTopicId;
                        pendingFillParentTopicId = null;
                    }
                })
                .catch(err => console.error('Erreur chargement groupes:', err));
        } else if (parentType === 'topic') {
            // Charger les sujets
            fetch('/public/api/community/global.json')
                .then(response => response.json())
                .then(data => {
                    if (data.topics) {
                        data.topics.forEach(topic => {
                            const option = document.createElement('option');
                            option.value = topic.id;
                            option.textContent = topic.name;
                            targetSelect.appendChild(option);
                        });
                    }

                    if (pendingFillParentTopicId) {
                        targetSelect.value = pendingFillParentTopicId;
                        pendingFillParentTopicId = null;
                    }
                })
                .catch(err => console.error('Erreur chargement sujets:', err));
        }
    }

    // Gestionnaire pour fermer le modal
    const closeModalBtn = document.getElementById('close-modal-btn');
    const modalOverlay = document.getElementById('create-modal-overlay');

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeCreateModal);
    }

    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                closeCreateModal();
            }
        });
    }

    // Gestionnaires de formulaires du modal
    const groupForm = document.getElementById('group-form');
    const topicForm = document.getElementById('topic-form');
    const fillForm = document.getElementById('fill-form');
    const mpForm = document.getElementById('mp-form');

    // Gestionnaire pour le formulaire de groupe
    if (groupForm) {
        groupForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('group-name').value.trim();
            const description = document.getElementById('group-description').value.trim();
            const isPrivate = document.getElementById('group-private').checked;

            if (!name) return;

            fetch('/public/api/community/create-group', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description, isPrivate, username: currentUsername })
            })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        console.log(`Groupe créé : ${name}`);
                        closeCreateModal();
                        loadDiscussions();
                    } else {
                        alert('Erreur création groupe: ' + data.message);
                    }
                })
                .catch(err => {
                    console.error('Erreur création groupe:', err);
                    alert('Erreur serveur');
                });
        });
    }

    // Gestionnaire pour le formulaire de sujet
    if (topicForm) {
        topicForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('topic-name').value.trim();
            const description = document.getElementById('topic-description').value.trim();

            if (!name) return;

            fetch('/public/api/community/create-topic', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description, username: currentUsername })
            })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        console.log(`Sujet créé : ${name}`);
                        closeCreateModal();
                        loadDiscussions();
                    } else {
                        alert('Erreur création sujet: ' + data.message);
                    }
                })
                .catch(err => {
                    console.error('Erreur création sujet:', err);
                    alert('Erreur serveur');
                });
        });
    }

    // Gestionnaire pour le formulaire de fill
    if (fillForm) {
        fillForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('fill-name').value.trim();
            const description = document.getElementById('fill-description').value.trim();
            const parentType = document.getElementById('fill-parent-type').value;
            const parentId = (document.getElementById('fill-parent-topic')?.value) || (document.getElementById('fill-parent-id')?.value) || '';

            if (!name || !parentId) return;

            const members = Array.from(new Set([currentUsername, ...(selectedFillMembers || [])]));

            fetch('/public/api/community/create-fill', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description, parentType, parentId, username: currentUsername, members })
            })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        console.log(`Fill créé : ${name}`);
                        closeCreateModal();
                        loadDiscussions();
                    } else {
                        alert('Erreur création fill: ' + data.message);
                    }
                })
                .catch(err => {
                    console.error('Erreur création fill:', err);
                    alert('Erreur serveur');
                });
        });
    }

    // Gestionnaire pour le formulaire de MP
    if (mpForm) {
        mpForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const recipient = document.getElementById('mp-recipient').value.trim();

            if (!recipient) return;

            fetch('/public/api/community/create-mp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recipient, username: currentUsername })
            })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        console.log(`MP créé avec ${recipient}`);
                        closeCreateModal();
                        loadDiscussions();
                    } else {
                        alert('Erreur création MP: ' + data.message);
                    }
                })
                .catch(err => {
                    console.error('Erreur création MP:', err);
                    alert('Erreur serveur');
                });
        });
    }

    // Variables pour l'autocomplétion
    // (supprimé: déjà déclaré en haut du fichier)

    // Fonction pour charger la liste des utilisateurs disponibles
    function loadAvailableUsers() {
        fetch('/public/api/community/global.json')
            .then(response => response.json())
            .then(data => {
                allUsers = [];
                // Collecter tous les utilisateurs des groupes
                if (data.groups) {
                    data.groups.forEach(group => {
                        if (group.members) {
                            allUsers = allUsers.concat(group.members);
                        }
                    });
                }
                // Collecter tous les utilisateurs des fills
                if (data.fills) {
                    data.fills.forEach(fill => {
                        if (fill.members) {
                            allUsers = allUsers.concat(fill.members);
                        }
                    });
                }
                // Supprimer les doublons et l'utilisateur actuel
                allUsers = [...new Set(allUsers)].filter(user => user !== currentUsername);
            })
            .catch(err => console.error('Erreur chargement utilisateurs:', err));
    }

    function resetFillMembersSelection() {
        selectedFillMembers = [];
        const list = document.getElementById('fill-members-list');
        if (list) list.innerHTML = '';
        const suggestions = document.getElementById('fill-members-suggestions');
        if (suggestions) {
            suggestions.innerHTML = '';
            suggestions.style.display = 'none';
        }
        const input = document.getElementById('fill-members-search');
        if (input) input.value = '';
    }

    function renderFillMembersSelection() {
        const list = document.getElementById('fill-members-list');
        if (!list) return;
        list.innerHTML = '';

        selectedFillMembers.forEach(username => {
            const row = document.createElement('div');
            row.className = 'group-member-row';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = true;
            checkbox.addEventListener('change', () => {
                if (!checkbox.checked) {
                    selectedFillMembers = selectedFillMembers.filter(u => u !== username);
                    renderFillMembersSelection();
                }
            });

            const label = document.createElement('span');
            label.textContent = username;

            row.appendChild(checkbox);
            row.appendChild(label);
            list.appendChild(row);
        });
    }

    function addFillMember(username) {
        const u = String(username || '').trim();
        if (!u) return;
        if (u === currentUsername) return;
        if (selectedFillMembers.includes(u)) return;
        selectedFillMembers.push(u);
        renderFillMembersSelection();
    }

    // Autocomplete membres (fill)
    const fillMembersInput = document.getElementById('fill-members-search');
    const fillMembersSuggestions = document.getElementById('fill-members-suggestions');
    if (fillMembersInput && fillMembersSuggestions) {
        fillMembersInput.addEventListener('input', (e) => {
            const query = String(e.target.value || '').toLowerCase().trim();
            if (query.length < 1) {
                fillMembersSuggestions.style.display = 'none';
                return;
            }

            const filtered = allUsers
                .filter(u => !selectedFillMembers.includes(u))
                .filter(u => u.toLowerCase().includes(query));

            if (filtered.length === 0) {
                fillMembersSuggestions.style.display = 'none';
                return;
            }

            fillMembersSuggestions.innerHTML = '';
            filtered.slice(0, 6).forEach(u => {
                const div = document.createElement('div');
                div.className = 'suggestion-item';
                div.textContent = u;
                div.addEventListener('click', () => {
                    addFillMember(u);
                    fillMembersInput.value = '';
                    fillMembersSuggestions.style.display = 'none';
                });
                fillMembersSuggestions.appendChild(div);
            });
            fillMembersSuggestions.style.display = 'block';
        });

        document.addEventListener('click', (e) => {
            if (!fillMembersInput.contains(e.target) && !fillMembersSuggestions.contains(e.target)) {
                fillMembersSuggestions.style.display = 'none';
            }
        });
    }

    // Gestionnaire pour les suggestions de destinataire
    const recipientInput = document.getElementById('mp-recipient');
    const suggestionsList = document.getElementById('recipient-suggestions');

    if (recipientInput && suggestionsList) {
        // Gestionnaire d'événement pour l'input
        recipientInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();

            if (query.length < 1) {
                suggestionsList.style.display = 'none';
                return;
            }

            const filteredUsers = allUsers.filter(user =>
                user.toLowerCase().includes(query)
            );

            if (filteredUsers.length > 0) {
                suggestionsList.innerHTML = '';
                filteredUsers.slice(0, 5).forEach(user => {
                    const div = document.createElement('div');
                    div.className = 'suggestion-item';
                    div.textContent = user;
                    div.addEventListener('click', () => {
                        recipientInput.value = user;
                        suggestionsList.style.display = 'none';
                    });
                    suggestionsList.appendChild(div);
                });
                suggestionsList.style.display = 'block';
            } else {
                suggestionsList.style.display = 'none';
            }
        });

        // Masquer les suggestions quand on clique ailleurs
        document.addEventListener('click', (e) => {
            if (!recipientInput.contains(e.target) && !suggestionsList.contains(e.target)) {
                suggestionsList.style.display = 'none';
            }
        });
    }

    // Gestionnaire pour le changement de type de parent dans le formulaire fill
    const parentTypeSelect = document.getElementById('fill-parent-type');
    if (parentTypeSelect) {
        parentTypeSelect.addEventListener('change', loadParentOptions);
    }

    // Fonction pour demander à rejoindre un fill (validation admin)
    function joinFill(fillId) {
        fetch('/public/api/community/fill-join-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fillId, username: currentUsername })
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    notify(data.message || 'Demande envoyée.', { title: 'Communauté' });
                    try { loadDiscussions(); } catch (e) { }
                } else {
                    notify('Erreur demander à rejoindre: ' + data.message, { title: 'Communauté' });
                }
            })
            .catch(err => {
                console.error('Erreur rejoindre fill:', err);
                notify('Erreur serveur', { title: 'Communauté' });
            });
    }

    // Vue infos fill pour non-membre
    function openFillInfoOverlay(fillId) {
        // Éviter d'avoir le panneau groupe ouvert en même temps
        const groupOverlay = document.getElementById('group-details-overlay');
        if (groupOverlay) groupOverlay.style.display = 'none';

        const data = lastGlobalData;
        const fills = Array.isArray(data && data.fills) ? data.fills : [];
        const fill = fills.find(f => f && f.id === fillId);
        if (!fill) return;

        const overlay = document.getElementById('fill-details-overlay');
        const closeBtn = document.getElementById('close-fill-details-btn');
        const nameEl = document.getElementById('fill-details-name');
        const descEl = document.getElementById('fill-details-description');
        const createdByEl = document.getElementById('fill-details-created-by');
        const parentEl = document.getElementById('fill-details-parent');
        const expiresEl = document.getElementById('fill-details-expires');
        const membersCountEl = document.getElementById('fill-details-members-count');
        const membersEl = document.getElementById('fill-details-members');
        const requestBtn = document.getElementById('fill-details-request-btn');
        const leaveBtn = document.getElementById('fill-details-leave-btn');
        const delBtn = document.getElementById('fill-details-delete-btn');

        if (nameEl) {
            nameEl.value = fill.name || '';
            nameEl.disabled = true;
        }
        if (descEl) {
            descEl.value = fill.description || '';
            descEl.disabled = true;
        }
        if (createdByEl) createdByEl.textContent = 'Créé par : ' + (fill.createdBy || fill.admin || '-');

        // Parent label
        let parentLabel = '-';
        if (fill.parentType === 'topic') {
            const topic = (Array.isArray(data && data.topics) ? data.topics : []).find(t => t && t.id === fill.parentId);
            parentLabel = 'Sujet : ' + (topic ? topic.name : fill.parentId);
        } else if (fill.parentType === 'group') {
            const group = (Array.isArray(data && data.groups) ? data.groups : []).find(g => g && g.id === fill.parentId);
            parentLabel = 'Groupe : ' + (group ? group.name : fill.parentId);
        }
        if (parentEl) parentEl.textContent = 'Parent : ' + parentLabel;

        if (expiresEl) {
            const exp = fill.expiresAt ? new Date(fill.expiresAt) : null;
            expiresEl.textContent = 'Expire : ' + (exp && !isNaN(exp.getTime()) ? exp.toLocaleString('fr-FR') : '-');
        }

        const members = Array.isArray(fill.members) ? fill.members : [];
        if (membersCountEl) membersCountEl.textContent = members.length + (members.length > 1 ? ' membres' : ' membre');
        if (membersEl) {
            membersEl.innerHTML = '';
            members.forEach(u => {
                const div = document.createElement('div');
                div.className = 'group-member-row';
                div.textContent = u;
                membersEl.appendChild(div);
            });
        }

        if (leaveBtn) leaveBtn.style.display = 'none';
        if (delBtn) delBtn.style.display = 'none';

        if (requestBtn) {
            requestBtn.style.display = 'block';
            requestBtn.textContent = 'Demander à rejoindre';
            requestBtn.onclick = () => {
                joinFill(fill.id);
                if (overlay) overlay.style.display = 'none';
            };
        }

        if (overlay) {
            overlay.style.display = 'flex';
            overlay.onclick = (e) => {
                if (e.target === overlay) overlay.style.display = 'none';
            };
        }
        if (closeBtn) {
            closeBtn.onclick = () => {
                if (overlay) overlay.style.display = 'none';
            };
        }
    }

    function renderFillDetailsInMessages(fillId) {
        const data = lastGlobalData;
        const fills = Array.isArray(data && data.fills) ? data.fills : [];
        const fill = fills.find(f => f && f.id === fillId);
        if (!fill) return;

        // Fermer les overlays si ouverts
        const fillOverlay = document.getElementById('fill-details-overlay');
        if (fillOverlay) fillOverlay.style.display = 'none';
        const groupOverlay = document.getElementById('group-details-overlay');
        if (groupOverlay) groupOverlay.style.display = 'none';

        // Parent label
        let parentLabel = '-';
        if (fill.parentType === 'topic') {
            const topic = (Array.isArray(data && data.topics) ? data.topics : []).find(t => t && t.id === fill.parentId);
            parentLabel = 'Sujet : ' + (topic ? topic.name : fill.parentId);
        } else if (fill.parentType === 'group') {
            const group = (Array.isArray(data && data.groups) ? data.groups : []).find(g => g && g.id === fill.parentId);
            parentLabel = 'Groupe : ' + (group ? group.name : fill.parentId);
        }

        const createdBy = fill.createdBy || fill.admin || '-';
        const exp = fill.expiresAt ? new Date(fill.expiresAt) : null;
        const expLabel = exp && !isNaN(exp.getTime()) ? exp.toLocaleString('fr-FR') : '-';
        const members = Array.isArray(fill.members) ? fill.members : [];

        const messagesContainer = document.getElementById('messages-container');
        if (!messagesContainer) return;

        messagesContainer.innerHTML = '';

        const wrap = document.createElement('div');
        wrap.className = 'topic-details';

        const card = document.createElement('div');
        card.className = 'topic-details-card';

        const title = document.createElement('h3');
        title.className = 'topic-details-title';
        title.textContent = '# ' + (fill.name || 'Fill');

        const meta = document.createElement('div');
        meta.className = 'topic-details-meta';
        meta.textContent = `Créé par : ${createdBy} • ${parentLabel} • Expire : ${expLabel}`;

        const desc = document.createElement('div');
        desc.style.color = 'rgba(255, 255, 255, 0.85)';
        desc.style.whiteSpace = 'pre-wrap';
        desc.textContent = (fill.description || '').trim() ? fill.description : 'Aucune description.';

        const note = document.createElement('div');
        note.className = 'topic-details-meta';
        note.textContent = "Vous n'êtes pas membre de ce fill.";

        const joinBtn = document.createElement('button');
        joinBtn.type = 'button';
        joinBtn.className = 'modal-submit-btn';
        joinBtn.textContent = 'Demander à rejoindre';
        joinBtn.addEventListener('click', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            joinFill(fill.id);
        });

        const membersTitle = document.createElement('div');
        membersTitle.className = 'topic-details-meta';
        membersTitle.textContent = `Membres : ${members.length}`;

        const membersList = document.createElement('div');
        membersList.className = 'topic-details-list';
        if (members.length === 0) {
            const row = document.createElement('div');
            row.className = 'topic-details-row';
            row.textContent = 'Aucun membre.';
            membersList.appendChild(row);
        } else {
            members.forEach(u => {
                const row = document.createElement('div');
                row.className = 'topic-details-row';
                row.textContent = u;
                membersList.appendChild(row);
            });
        }

        card.appendChild(title);
        card.appendChild(meta);
        card.appendChild(desc);
        card.appendChild(note);
        card.appendChild(joinBtn);

        wrap.appendChild(card);
        wrap.appendChild(membersTitle);
        wrap.appendChild(membersList);

        messagesContainer.appendChild(wrap);
    }

    channelListContainer.addEventListener('click', (e) => {
        // Gérer les boutons "Rejoindre" pour les fills
        if (e.target.classList.contains('join-fill-btn')) {
            e.stopPropagation(); // Empêcher la propagation pour éviter de sélectionner le fill
            const fillId = e.target.getAttribute('data-fill-id');
            joinFill(fillId);
            return;
        }

        // Toggle sujet: ne pas ouvrir de chat
        if (e.target.closest('.topic-toggle')) return;

        // On cherche l'élément li le plus proche
        const item = e.target.closest('.discussion-item');

        if (item) {
            const id = item.getAttribute('data-id');
            const type = item.getAttribute('data-type');

            if (type === 'topic') return; // pas de chat dans un sujet

            // Fill non-membre: afficher infos + bouton rejoindre, pas la discussion
            if (type === 'fill' && item.classList.contains('non-member')) {
                // Sélection visuelle du fill, sans ouvrir une discussion existante
                document.querySelectorAll('#channel-list .discussion-item').forEach(el => {
                    el.classList.remove('active');
                    el.classList.remove('active-fill');
                });
                item.classList.add('active');
                item.classList.add('active-fill');

                const titlePill = document.getElementById('chat-title-pill');
                if (titlePill) {
                    titlePill.textContent = item.getAttribute('data-display-name') || item.innerText.trim();
                    titlePill.onclick = openGroupDetailsOverlay;
                }

                // Ne pas laisser l'ancien canal (souvent le groupe de classe) actif
                activeChannelId = null;
                activeChannelType = null;

                const messagesContainer = document.getElementById('messages-container');
                if (messagesContainer) messagesContainer.innerHTML = '';
                toggleMessageInput(null);

                // Afficher les détails à la place de la conversation
                renderFillDetailsInMessages(id);
                return;
            }

            // 1. Reset de TOUS les items dans la liste
            document.querySelectorAll('#channel-list .discussion-item').forEach(el => {
                el.classList.remove('active');
                el.classList.remove('active-fill');
            });

            // 2. Activation de l'élément cliqué
            item.classList.add('active');
            if (type === 'fill') item.classList.add('active-fill');

            // 3. Maj Titre
            {
                const titleEl = document.getElementById('chat-title');
                if (titleEl) titleEl.textContent = item.getAttribute('data-display-name') || item.innerText.trim();
            }

            activeChannelId = id;
            activeChannelType = type;

            // Mobile: ouvrir plein écran
            if (window.innerWidth <= 768) {
                openMobileConversation(id, item.getAttribute('data-display-name') || item.innerText.trim(), type);
                toggleMessageInput(type);
                return;
            }

            // Charger les messages de la discussion sélectionnée (desktop)
            loadMessages(id, type);

            // Gérer l'affichage de l'input de message
            toggleMessageInput(type);
        }
    });

    // --- BULLE ACTION RAPIDE (sur sujet) ---
    const quickBubble = document.getElementById('quick-create-bubble');
    const quickCreateFillBtn = document.getElementById('quick-create-fill-btn');

    function closeQuickBubble() {
        if (!quickBubble) return;
        quickBubble.style.display = 'none';
        quickBubble.dataset.topicId = '';
    }

    function openQuickBubbleAt(x, y, topicId) {
        if (!quickBubble) return;
        const pad = 8;
        const vw = window.innerWidth || 0;
        const vh = window.innerHeight || 0;

        quickBubble.style.display = 'block';
        quickBubble.dataset.topicId = topicId;

        // position clamp
        const rect = quickBubble.getBoundingClientRect();
        const left = Math.max(pad, Math.min(x, vw - rect.width - pad));
        const top = Math.max(pad, Math.min(y, vh - rect.height - pad));
        quickBubble.style.left = left + 'px';
        quickBubble.style.top = top + 'px';
    }

    // Intercepter clic droit / appui prolongé (évite le menu Google)
    channelListContainer.addEventListener('contextmenu', (e) => {
        const topicItem = e.target.closest('.discussion-item.topic-item');
        if (!topicItem) return;

        e.preventDefault();
        e.stopPropagation();

        const topicId = topicItem.getAttribute('data-id');
        openQuickBubbleAt(e.clientX, e.clientY, topicId);
    });

    // fermer la bulle si clic ailleurs / scroll / escape
    document.addEventListener('click', (e) => {
        if (!quickBubble || quickBubble.style.display !== 'block') return;
        if (quickBubble.contains(e.target)) return;
        closeQuickBubble();
    });
    window.addEventListener('scroll', closeQuickBubble, true);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeQuickBubble();
    });

    if (quickCreateFillBtn) {
        quickCreateFillBtn.addEventListener('click', () => {
            const topicId = quickBubble?.dataset?.topicId;
            closeQuickBubble();
            if (!topicId) return;

            // Ouvre le modal "newFill" et pré-sélectionne le topic
            openCreateModal('newFill');
            const typeEl = document.getElementById('fill-parent-type');
            if (typeEl) typeEl.value = 'topic';

            // Set après chargement async des options
            pendingFillParentTopicId = topicId;
            try { loadParentOptions(); } catch (e) { }
        });
    }

    // Fonction pour activer/désactiver l'input de message selon le type de discussion
    function toggleMessageInput(discussionType) {
        const messageInput = document.getElementById('community-message-input');
        const sendButton = document.getElementById('send-community-message-btn');
        const inputArea = document.getElementById('message-input-area');

        if (!discussionType || discussionType === 'topic') {
            // Les sujets ne servent pas à discuter
            if (messageInput) messageInput.disabled = true;
            if (sendButton) sendButton.disabled = true;
            if (inputArea) inputArea.style.opacity = '0.5';
        } else {
            // Discussions normales
            if (messageInput) messageInput.disabled = false;
            if (sendButton) sendButton.disabled = false;
            if (inputArea) inputArea.style.opacity = '1';
        }
    }

    // Fonction pour charger les messages d'une discussion
    function loadMessages(discussionId, discussionType) {
        if (!discussionId || !discussionType) return;

        const messagesContainer = document.getElementById('messages-container');
        if (messagesContainer) {
            messagesContainer.innerHTML = '<p class="placeholder-message">Chargement...</p>';
        }

        // Arrêter l'auto-refresh de l'ancienne discussion
        stopAutoRefresh();
        lastMessageId = null;
        // Reset new-messages bubble & start typing poll
        hideNewMsgBubble();
        startTypingPoll();

        fetch(`/public/api/community/messages/${encodeURIComponent(discussionId)}/${encodeURIComponent(discussionType)}?username=${encodeURIComponent(currentUsername)}`)
            .then(response => {
                if (!response.ok) throw new Error('HTTP ' + response.status);
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    displayMessages(data.messages);

                    // Marquer la discussion comme lue
                    fetch('/public/api/community/mark-read', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username: currentUsername, discussionId, discussionType })
                    }).then(() => {
                        if (typeof window.__checkNotifications === 'function') window.__checkNotifications();
                    }).catch(() => {});

                    // Initialiser lastMessageId et démarrer l'auto-refresh
                    if (data.messages && data.messages.length > 0) {
                        lastMessageId = data.messages[data.messages.length - 1].id;
                    }
                    startAutoRefresh();
                } else {
                    console.error('Erreur chargement messages:', data.message);
                    if (messagesContainer) {
                        messagesContainer.innerHTML = '<p class="placeholder-message">Impossible de charger les messages.</p>';
                    }
                }
            })
            .catch(err => {
                console.error('Erreur chargement messages:', err);
                if (messagesContainer) {
                    messagesContainer.innerHTML = '<p class="placeholder-message">Erreur serveur lors du chargement.</p>';
                }
            });
    }

    // Initialiser le menu contextuel sur les messages
    function initializeMessageContextMenu() {
        const messagesContainer = document.getElementById('messages-container');
        const contextMenu = document.getElementById('message-context-menu');
        if (!messagesContainer || !contextMenu) {
            console.error('❌ Éléments manquants pour le menu contextuel');
            return;
        }

        let currentMessageElement = null;
        let longPressTimer = null;

        // Gérer le clic droit (PC)
        messagesContainer.addEventListener('contextmenu', (e) => {
            const messageEl = e.target.closest('.message-item');
            if (!messageEl) return;

            e.preventDefault();
            showContextMenu(messageEl, e.clientX, e.clientY);
        });

        // Gérer le clic prolongé (mobile)
        messagesContainer.addEventListener('touchstart', (e) => {
            const messageEl = e.target.closest('.message-item');
            if (!messageEl) return;

            currentMessageElement = messageEl;
            longPressTimer = setTimeout(() => {
                const touch = e.touches[0];
                showContextMenu(messageEl, touch.clientX, touch.clientY);
            }, 500); // 500ms pour le clic prolongé
        });

        messagesContainer.addEventListener('touchend', () => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        });

        messagesContainer.addEventListener('touchmove', () => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        });

        // Fonction pour afficher le menu
        function showContextMenu(messageEl, x, y) {
            const messageId = messageEl.getAttribute('data-message-id');
            if (!messageId) return;

            const message = currentMessages.find(m => m.id === messageId);
            if (!message) return;

            // Positionner le menu
            contextMenu.style.left = x + 'px';
            contextMenu.style.top = y + 'px';
            contextMenu.style.display = 'block';
            contextMenu.setAttribute('data-message-id', messageId);

            // Ajuster si le menu sort de l'écran
            setTimeout(() => {
                const rect = contextMenu.getBoundingClientRect();
                if (rect.right > window.innerWidth) {
                    contextMenu.style.left = (x - rect.width) + 'px';
                }
                if (rect.bottom > window.innerHeight) {
                    contextMenu.style.top = (y - rect.height) + 'px';
                }
            }, 10);
        }

        // Gérer les clics sur les options du menu
        contextMenu.addEventListener('click', async (e) => {
            // Gérer les boutons de réaction rapide
            const reactionBtn = e.target.closest('.context-reaction-btn');
            if (reactionBtn) {
                const emoji = reactionBtn.getAttribute('data-emoji');
                const messageId = contextMenu.getAttribute('data-message-id');
                contextMenu.style.display = 'none';
                if (emoji && messageId) toggleReaction(messageId, emoji);
                return;
            }

            const item = e.target.closest('.context-menu-item');
            if (!item) return;

            const action = item.getAttribute('data-action');
            const messageId = contextMenu.getAttribute('data-message-id');
            const message = currentMessages.find(m => m.id === messageId);

            contextMenu.style.display = 'none';

            if (!message) return;

            switch (action) {
                case 'reply':
                    setReplyingTo(message);
                    break;

                case 'copy':
                    if (message.content) {
                        try {
                            await navigator.clipboard.writeText(message.content);
                            if (typeof window.showModal === 'function') {
                                window.showModal('Message copié !', { type: 'alert', title: 'Succès' });
                            }
                        } catch (err) {
                            console.error('Erreur copie:', err);
                        }
                    }
                    break;

                case 'report':
                    reportMessage(messageId, message);
                    break;
            }
        });

        // Fermer le menu si on clique ailleurs
        document.addEventListener('click', (e) => {
            if (!contextMenu.contains(e.target)) {
                contextMenu.style.display = 'none';
            }
        });
    }

    // Fonction pour signaler un message
    async function reportMessage(messageId, message) {
        const result = await window.showModal(
            `Voulez-vous signaler ce message de ${message.sender} ?\n\n"${(message.content || '').substring(0, 100)}..."`,
            { type: 'confirm', title: 'Signaler un message' }
        );

        if (!result) return;

        const currentUsername = localStorage.getItem('source_username');
        if (!currentUsername) {
            window.showModal('Vous devez être connecté pour signaler.', {
                type: 'alert',
                title: 'Erreur'
            });
            return;
        }

        try {
            const response = await fetch('/api/report-message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messageId,
                    reportedUser: message.sender,
                    reportingUser: currentUsername
                })
            });

            const data = await response.json();

            if (data.success) {
                window.showModal(data.message || 'Message signalé avec succès.', {
                    type: 'alert',
                    title: 'Signalement envoyé'
                });
            } else {
                window.showModal(data.message || 'Erreur lors du signalement.', {
                    type: 'alert',
                    title: 'Erreur'
                });
            }
        } catch (err) {
            console.error('Erreur signalement:', err);
            window.showModal('Erreur réseau lors du signalement.', {
                type: 'alert',
                title: 'Erreur'
            });
        }
    }

    // Fonction pour détecter le swipe sur un message
    function initializeMessageSwipe() {
        const messagesContainer = document.getElementById('messages-container');
        if (!messagesContainer) return;

        let startX = 0;
        let startY = 0;
        let messageElement = null;

        messagesContainer.addEventListener('touchstart', (e) => {
            const msg = e.target.closest('.message-item');
            if (!msg) return;
            messageElement = msg;
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        }, false);

        messagesContainer.addEventListener('touchend', (e) => {
            if (!messageElement) return;

            const endX = e.changedTouches[0].clientX;
            const endY = e.changedTouches[0].clientY;
            const deltaX = endX - startX;
            const deltaY = endY - startY;

            // Vérifier que c'est un swipe horizontal (pas vertical)
            if (Math.abs(deltaX) < Math.abs(deltaY)) {
                messageElement = null;
                return;
            }

            // Vérifier si c'est un swipe suffisant (>50px)
            if (Math.abs(deltaX) < 50) {
                messageElement = null;
                return;
            }

            // Récupérer l'ID du message
            const messageId = messageElement.getAttribute('data-message-id');
            if (!messageId) {
                messageElement = null;
                return;
            }

            // Trouver le message dans le tableau
            const message = currentMessages.find(m => m.id === messageId);
            if (!message) {
                messageElement = null;
                return;
            }

            const isOwnMessage = messageElement.classList.contains('own-message');

            // Swipe right si message d'un autre
            if (deltaX > 0 && !isOwnMessage) {
                setReplyingTo(message);
            }
            // Swipe left si mon propre message
            else if (deltaX < 0 && isOwnMessage) {
                setReplyingTo(message);
            }

            messageElement = null;
        }, false);
    }

    // Fonction pour afficher les messages
    function displayMessages(messages) {
        const messagesContainer = document.getElementById('messages-container');
        if (!messagesContainer) return;

        // Sauvegarder les messages
        currentMessages = messages;

        // Vider le conteneur
        messagesContainer.innerHTML = '';

        if (messages.length === 0) {
            messagesContainer.innerHTML = '<p class="placeholder-message">Aucun message dans cette discussion. Soyez le premier à écrire !</p>';
            return;
        }

        // Afficher chaque message
        messages.forEach((message, index) => {
            // Générer un ID unique si pas présent
            if (!message.id) {
                message.id = `msg_${activeChannelId}_${index}_${message.timestamp}`;
            }
            const messageElement = document.createElement('div');
            const isOwnMessage = message.sender === currentUsername;
            messageElement.className = `message-item ${isOwnMessage ? 'own-message' : 'other-message'}`;
            messageElement.setAttribute('data-message-id', message.id);

            // Formater l'heure (relative + absolue en tooltip)
            const timestamp = new Date(message.timestamp);
            const timeString = timestamp.toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit'
            });
            const relTime = typeof window.timeAgo === 'function' ? window.timeAgo(timestamp) : timeString;
            const fullDate = timestamp.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

            if (isOwnMessage) {
                // Message de l'utilisateur actuel (à droite)
                let fileHtml = '';
                if (message.file) {
                    fileHtml = generateFileHtml(message.file);
                }
                let contentHtml = '';
                if (message.content && message.content.trim()) {
                    contentHtml = `<div class="message-content">${formatMessageContentWithLinks(message.content)}</div>`;
                }

                // Afficher le message auquel on répond
                let replyHtml = '';
                if (message.replies_to) {
                    const replyTo = currentMessages.find(m => m.id === message.replies_to);
                    if (replyTo) {
                        replyHtml = `
                            <div class="message-reply-to" onclick="scrollToMessage('${message.replies_to}')" style="cursor: pointer;">
                                <span class="reply-to-sender">${replyTo.sender}</span>: ${(replyTo.content || '').substring(0, 40)}${(replyTo.content || '').length > 40 ? '...' : ''}
                            </div>
                        `;
                    }
                }

                const reactionsHtml = buildReactionsHtml(message);
                const quickLikeHtml = buildQuickLikeButton(message);

                messageElement.innerHTML = `
                    ${replyHtml}
                    ${fileHtml}
                    ${contentHtml}
                    <div class="message-time relative-time" title="${fullDate}">${relTime}</div>
                    <div class="message-actions-row">${quickLikeHtml}</div>
                    ${reactionsHtml}
                `;

            } else {
                // Message des autres (à gauche)
                let fileHtml = '';
                if (message.file) {
                    fileHtml = generateFileHtml(message.file);
                }
                let contentHtml = '';
                if (message.content && message.content.trim()) {
                    contentHtml = `<div class="message-content">${formatMessageContentWithLinks(message.content)}</div>`;
                }

                // Construire les badges HTML
                let badgesHtml = '';
                if (Array.isArray(message.badges) && message.badges.length > 0) {
                    badgesHtml = '<div class="message-sender-badges">';
                    message.badges.forEach(badgeId => {
                        if (typeof BADGE_ICONS !== 'undefined' && BADGE_ICONS[badgeId]) {
                            const badge = BADGE_ICONS[badgeId];
                            const desc = BADGE_DESCRIPTIONS && BADGE_DESCRIPTIONS[badgeId] ? BADGE_DESCRIPTIONS[badgeId] : { name: badgeId, description: '' };
                            const title = `${desc.name}: ${desc.description}`;

                            if (badge.type === 'image') {
                                // Afficher comme image
                                badgesHtml += `<img src="${badge.src}" alt="${desc.name}" class="message-badge-image" title="${title}">`;
                            } else {
                                // Afficher comme emoji
                                badgesHtml += `<span class="message-badge" title="${title}">${badge.emoji}</span>`;
                            }
                        }
                    });
                    badgesHtml += '</div>';
                }

                // Afficher le message auquel on répond
                let replyHtml = '';
                if (message.replies_to) {
                    const replyTo = currentMessages.find(m => m.id === message.replies_to);
                    if (replyTo) {
                        replyHtml = `
                            <div class="message-reply-to" onclick="scrollToMessage('${message.replies_to}')" style="cursor: pointer;">
                                <span class="reply-to-sender">${replyTo.sender}</span>: ${(replyTo.content || '').substring(0, 40)}${(replyTo.content || '').length > 40 ? '...' : ''}
                            </div>
                        `;
                    }
                }

                const reactionsHtml2 = buildReactionsHtml(message);
                const quickLikeHtml2 = buildQuickLikeButton(message);

                messageElement.innerHTML = `
                    ${replyHtml}
                    <div class="message-sender">
                        <img src="/ressources/user-icon.png" alt="Avatar" class="message-avatar" data-username="${message.sender}" onclick="openUserProfile('${message.sender}')">
                        <span class="message-sender-name" onclick="openUserProfile('${message.sender}')" style="cursor: pointer;">${message.sender}</span>
                        ${badgesHtml}
                    </div>
                    ${fileHtml}
                    ${contentHtml}
                    <div class="message-time relative-time" title="${fullDate}">${relTime}</div>
                    <div class="message-actions-row">${quickLikeHtml2}</div>
                    ${reactionsHtml2}
                `;
            }

            messagesContainer.appendChild(messageElement);
        });

        // Initialiser la détection de swipe
        initializeMessageSwipe();

        // Initialiser le menu contextuel
        initializeMessageContextMenu();

        // Clic sur les badges de réaction inline (event delegation)
        messagesContainer.addEventListener('click', (e) => {
            const likeBtn = e.target.closest('.message-like-btn');
            if (likeBtn) {
                const msgId = likeBtn.getAttribute('data-msg-id');
                if (msgId) toggleReaction(msgId, '👍');
                return;
            }

            const badge = e.target.closest('.reaction-badge');
            if (!badge) return;
            const emoji = badge.getAttribute('data-emoji');
            const msgId = badge.getAttribute('data-msg-id');
            if (emoji && msgId) toggleReaction(msgId, emoji);
        });

        // Scroll vers le bas après l'ajout de tous les messages
        setTimeout(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, 100);

        // Charger les avatars après l'affichage des messages
        loadMessageAvatars();
    }

    // === SYSTÈME DE RAFRAÎCHISSEMENT AUTOMATIQUE DES MESSAGES ===

    function startAutoRefresh() {
        // Arrêter l'ancien interval si existant
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
        }

        // Vérifier les nouveaux messages toutes les 5s
        autoRefreshInterval = setInterval(() => {
            checkForNewMessages();
        }, 5000);
    }

    function stopAutoRefresh() {
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
            autoRefreshInterval = null;
        }
    }

    function checkForNewMessages() {
        if (!activeChannelId || !activeChannelType) {
            return;
        }

        fetch(`/public/api/community/messages/${encodeURIComponent(activeChannelId)}/${encodeURIComponent(activeChannelType)}?username=${encodeURIComponent(currentUsername)}`)
            .then(response => response.json())
            .then(data => {
                if (data.success && Array.isArray(data.messages)) {
                    const newMessages = data.messages;

                    // Si c'est le premier chargement, on initialise juste
                    if (!lastMessageId) {
                        if (newMessages.length > 0) {
                            lastMessageId = newMessages[newMessages.length - 1].id;
                        }
                        return;
                    }

                    // Trouver l'index du dernier message connu
                    const lastIndex = newMessages.findIndex(m => m.id === lastMessageId);

                    if (lastIndex === -1) {
                        // Le dernier message connu n'existe plus, recharger tout
                        currentMessages = newMessages;
                        displayMessages(newMessages);
                        if (newMessages.length > 0) {
                            lastMessageId = newMessages[newMessages.length - 1].id;
                        }
                    } else if (lastIndex < newMessages.length - 1) {
                        // Il y a de nouveaux messages après le dernier connu
                        const messagesToAdd = newMessages.slice(lastIndex + 1);

                        // Ajouter les nouveaux messages à currentMessages
                        currentMessages.push(...messagesToAdd);

                        // Afficher seulement les nouveaux messages
                        appendNewMessages(messagesToAdd);

                        // Mettre à jour le dernier ID
                        lastMessageId = newMessages[newMessages.length - 1].id;
                    }
                }
            })
            .catch(err => {
                console.error('Erreur rafraîchissement messages:', err);
            });
    }

    function appendNewMessages(newMessages) {
        const messagesContainer = document.getElementById('messages-container');
        if (!messagesContainer) return;

        // Vérifier si on était scrollé tout en bas avant d'ajouter les messages
        const wasAtBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop <= messagesContainer.clientHeight + 100;

        newMessages.forEach(message => {
            const messageElement = document.createElement('div');
            messageElement.className = 'message-item';
            messageElement.setAttribute('data-message-id', message.id);

            const isOwnMessage = message.sender === currentUsername;
            if (isOwnMessage) {
                messageElement.classList.add('own-message');
            } else {
                messageElement.classList.add('other-message');
            }

            const timestamp = new Date(message.timestamp);
            const timeString = timestamp.toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit'
            });
            const relTime = typeof window.timeAgo === 'function' ? window.timeAgo(timestamp) : timeString;
            const fullDate = timestamp.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

            if (isOwnMessage) {
                // Message de l'utilisateur actuel (à droite)
                let fileHtml = '';
                if (message.file) {
                    fileHtml = generateFileHtml(message.file);
                }
                let contentHtml = '';
                if (message.content && message.content.trim()) {
                    contentHtml = `<div class="message-content">${formatMessageContentWithLinks(message.content)}</div>`;
                }

                let replyHtml = '';
                if (message.replies_to) {
                    const replyTo = currentMessages.find(m => m.id === message.replies_to);
                    if (replyTo) {
                        replyHtml = `
                            <div class="message-reply-to" onclick="scrollToMessage('${message.replies_to}')" style="cursor: pointer;">
                                <span class="reply-to-sender">${replyTo.sender}</span>: ${(replyTo.content || '').substring(0, 40)}${(replyTo.content || '').length > 40 ? '...' : ''}
                            </div>
                        `;
                    }
                }

                const reactionsHtmlA = buildReactionsHtml(message);
                const quickLikeHtmlA = buildQuickLikeButton(message);

                messageElement.innerHTML = `
                    ${replyHtml}
                    ${fileHtml}
                    ${contentHtml}
                    <div class="message-time relative-time" title="${fullDate}">${relTime}</div>
                    <div class="message-actions-row">${quickLikeHtmlA}</div>
                    ${reactionsHtmlA}
                `;

            } else {
                // Message des autres (à gauche)
                let fileHtml = '';
                if (message.file) {
                    fileHtml = generateFileHtml(message.file);
                }
                let contentHtml = '';
                if (message.content && message.content.trim()) {
                    contentHtml = `<div class="message-content">${formatMessageContentWithLinks(message.content)}</div>`;
                }

                let badgesHtml = '';
                if (Array.isArray(message.badges) && message.badges.length > 0) {
                    badgesHtml = '<div class="message-sender-badges">';
                    message.badges.forEach(badgeId => {
                        if (typeof BADGE_ICONS !== 'undefined' && BADGE_ICONS[badgeId]) {
                            const badge = BADGE_ICONS[badgeId];
                            const desc = BADGE_DESCRIPTIONS && BADGE_DESCRIPTIONS[badgeId] ? BADGE_DESCRIPTIONS[badgeId] : { name: badgeId, description: '' };
                            const title = `${desc.name}: ${desc.description}`;

                            if (badge.type === 'image') {
                                badgesHtml += `<img src="${badge.src}" alt="${desc.name}" class="message-badge-image" title="${title}">`;
                            } else {
                                badgesHtml += `<span class="message-badge" title="${title}">${badge.emoji}</span>`;
                            }
                        }
                    });
                    badgesHtml += '</div>';
                }

                let replyHtml = '';
                if (message.replies_to) {
                    const replyTo = currentMessages.find(m => m.id === message.replies_to);
                    if (replyTo) {
                        replyHtml = `
                            <div class="message-reply-to" onclick="scrollToMessage('${message.replies_to}')" style="cursor: pointer;">
                                <span class="reply-to-sender">${replyTo.sender}</span>: ${(replyTo.content || '').substring(0, 40)}${(replyTo.content || '').length > 40 ? '...' : ''}
                            </div>
                        `;
                    }
                }

                const reactionsHtmlB = buildReactionsHtml(message);
                const quickLikeHtmlB = buildQuickLikeButton(message);

                messageElement.innerHTML = `
                    ${replyHtml}
                    <div class="message-sender">
                        <img src="/ressources/user-icon.png" alt="Avatar" class="message-avatar" data-username="${message.sender}" onclick="openUserProfile('${message.sender}')">
                        <span class="message-sender-name" onclick="openUserProfile('${message.sender}')" style="cursor: pointer;">${message.sender}</span>
                        ${badgesHtml}
                    </div>
                    ${fileHtml}
                    ${contentHtml}
                    <div class="message-time relative-time" title="${fullDate}">${relTime}</div>
                    <div class="message-actions-row">${quickLikeHtmlB}</div>
                    ${reactionsHtmlB}
                `;
            }

            messagesContainer.appendChild(messageElement);
        });

        // Charger les avatars pour les nouveaux messages
        loadMessageAvatars();

        // Auto-scroll si on était en bas, sinon montrer la bulle
        if (wasAtBottom) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            hideNewMsgBubble();
        } else if (newMessages.length > 0) {
            unreadNewCount += newMessages.length;
            showNewMsgBubble(unreadNewCount);
        }
    }

    function buildQuickLikeButton(message) {
        const likes = message && message.reactions && Array.isArray(message.reactions['👍'])
            ? message.reactions['👍']
            : [];
        const likeCount = likes.length;
        const likedByMe = likes.includes(currentUsername);
        if (likeCount === 0 && !likedByMe) return '';
        const cls = 'message-like-btn' + (likedByMe ? ' liked' : '');
        return `<button type="button" class="${cls}" data-msg-id="${message.id}" aria-label="Like du message">👍 <span>${likeCount}</span></button>`;
    }

    // Génère le HTML des réactions d'un message
    function buildReactionsHtml(message) {
        if (!message.reactions || typeof message.reactions !== 'object') return '';
        const entries = Object.entries(message.reactions).filter(([, users]) => Array.isArray(users) && users.length > 0);
        if (entries.length === 0) return '';
        let html = '<div class="message-reactions">';
        entries.forEach(([emoji, users]) => {
            const isMine = users.includes(currentUsername);
            const cls = 'reaction-badge' + (isMine ? ' reaction-mine' : '');
            const title = users.join(', ');
            html += `<button class="${cls}" data-emoji="${emoji}" data-msg-id="${message.id}" title="${title}">${emoji} <span class="reaction-count">${users.length}</span></button>`;
        });
        html += '</div>';
        return html;
    }

    // Appelle l'API pour toggler une réaction
    async function toggleReaction(messageId, emoji) {
        if (!activeChannelId || !activeChannelType || !currentUsername) return;
        try {
            const res = await fetch('/public/api/community/react-message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    discussionId: activeChannelId,
                    discussionType: activeChannelType,
                    messageId,
                    emoji,
                    username: currentUsername
                })
            });
            const data = await res.json();
            if (data.success) {
                // Met à jour le message local
                const msg = currentMessages.find(m => m.id === messageId);
                if (msg) msg.reactions = data.reactions;
                // Re-render les réactions du message dans le DOM
                const el = document.querySelector(`.message-item[data-message-id="${messageId}"]`);
                if (el) {
                    const old = el.querySelector('.message-reactions');
                    if (old) old.remove();
                    const fakeMsg = { id: messageId, reactions: data.reactions };
                    const newHtml = buildReactionsHtml(fakeMsg);
                    if (newHtml) el.insertAdjacentHTML('beforeend', newHtml);

                    const oldActionRow = el.querySelector('.message-actions-row');
                    if (oldActionRow) oldActionRow.remove();
                    el.insertAdjacentHTML('beforeend', `<div class="message-actions-row">${buildQuickLikeButton(fakeMsg)}</div>`);
                }
            }
        } catch (e) {
            console.error('Erreur réaction:', e);
        }
    }

    // Fonction pour générer le HTML d'un fichier
    function generateFileHtml(file) {
        if (file.type && file.type.startsWith('image/')) {
            return `<div class="message-file">
                <img src="/pictures_documents/${file.filename}" alt="${file.originalName}" class="message-image" onclick="window.open('/pictures_documents/${file.filename}', '_blank')">
            </div>`;
        } else if (file.type && file.type.startsWith('video/')) {
            return `<div class="message-file">
                <video controls class="message-video">
                    <source src="/pictures_documents/${file.filename}" type="${file.type}">
                    Votre navigateur ne supporte pas la lecture de vidéos.
                </video>
            </div>`;
        } else {
            // Document
            return `<div class="message-file">
                <a href="/pictures_documents/${file.filename}" target="_blank" class="message-document">
                    📄 ${file.originalName}
                </a>
            </div>`;
        }
    }

    // Gestionnaire d'envoi de message
    const sendButton = document.getElementById('send-community-message-btn');
    const messageInput = document.getElementById('community-message-input');

    // Variables pour la gestion des fichiers
    let selectedFile = null;

    // --- Suggestions de mentions (@) ---
    (function setupMentionSuggestions() {
        const inputWrapper = document.getElementById('input-controls-wrapper');
        if (!inputWrapper) return;
        let suggest = document.getElementById('mention-suggestions');
        if (!suggest) {
            suggest = document.createElement('div');
            suggest.id = 'mention-suggestions';
            suggest.className = 'suggestions-list';
            suggest.style.display = 'none';
            inputWrapper.insertBefore(suggest, inputWrapper.firstChild); // au-dessus de la barre
        }

        function hideSuggest() { suggest.style.display = 'none'; suggest.innerHTML = ''; }

        function renderSuggest(items) {
            if (!Array.isArray(items) || items.length === 0) { hideSuggest(); return; }
            const frag = document.createDocumentFragment();
            items.slice(0, 8).forEach(name => {
                const div = document.createElement('div');
                div.className = 'suggestion-item';
                div.textContent = '@' + name;
                div.setAttribute('data-username', name);
                frag.appendChild(div);
            });
            suggest.innerHTML = '';
            suggest.appendChild(frag);
            suggest.style.display = 'block';
        }

        function currentMentionPrefix(value, caret) {
            const upto = String(value || '').slice(0, caret);
            const m = upto.match(/@([^\s@]{0,30})$/);
            return m ? m[1] : null;
        }

        messageInput && messageInput.addEventListener('input', (e) => {
            const val = e.target.value;
            const caret = e.target.selectionStart || val.length;
            const prefix = currentMentionPrefix(val, caret);
            if (!prefix && prefix !== '') { hideSuggest(); return; } // pas de @ → rien
            const q = String(prefix || '').toLowerCase();
            const list = getAllUsernames().filter(n => n && n.toLowerCase().startsWith(q));
            renderSuggest(list);
        });

        suggest.addEventListener('click', (e) => {
            const item = e.target.closest('.suggestion-item');
            if (!item || !messageInput) return;
            const name = item.getAttribute('data-username');
            const val = messageInput.value;
            const caret = messageInput.selectionStart || val.length;
            const upto = val.slice(0, caret);
            const after = val.slice(caret);
            const replaced = upto.replace(/@([^\s@]{0,30})$/, '@' + name + ' ');
            messageInput.value = replaced + after;
            hideSuggest();
            messageInput.focus();
        });

        document.addEventListener('click', (e) => {
            if (!suggest.contains(e.target) && e.target !== messageInput) hideSuggest();
        });
    })();

    // Gestionnaire pour le bouton trombone
    const fileButton = document.getElementById('community-file-button');
    const fileInput = document.getElementById('community-file-input');
    const filePreviewContainer = document.getElementById('community-file-preview-container');
    const filePreviewImg = document.getElementById('community-file-preview-img');
    const fileNameSpan = document.getElementById('community-file-name');
    const removeFileBtn = document.getElementById('community-remove-file-btn');

    if (fileButton && fileInput) {
        fileButton.addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                selectedFile = file;
                showFilePreview(file);
            }
        });
    }

    if (removeFileBtn) {
        removeFileBtn.addEventListener('click', () => {
            selectedFile = null;
            hideFilePreview();
        });
    }

    // Fonction pour afficher l'aperçu du fichier
    function showFilePreview(file) {
        if (!filePreviewContainer || !filePreviewImg || !fileNameSpan) return;

        fileNameSpan.textContent = file.name;

        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                filePreviewImg.src = e.target.result;
                filePreviewImg.style.display = 'block';
            };
            reader.readAsDataURL(file);
        } else {
            filePreviewImg.style.display = 'none';
        }

        filePreviewContainer.style.display = 'flex';
    }

    // Fonction pour cacher l'aperçu du fichier
    function hideFilePreview() {
        if (filePreviewContainer) {
            filePreviewContainer.style.display = 'none';
        }
        if (fileInput) {
            fileInput.value = '';
        }
    }

    if (sendButton && messageInput) {
        sendButton.addEventListener('click', () => {
            sendMessage();
        });

        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }

    // === TYPING INDICATOR ===
    let typingTimer = null;
    let typingPollInterval = null;

    function sendTypingSignal() {
        if (!activeChannelId || !activeChannelType) return;
        fetch('/public/api/community/typing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUsername, discussionId: activeChannelId, discussionType: activeChannelType })
        }).catch(() => {});
    }

    if (messageInput) {
        messageInput.addEventListener('input', () => {
            if (!activeChannelId) return;
            clearTimeout(typingTimer);
            sendTypingSignal();
            typingTimer = setTimeout(() => {}, 3000);
        }, false);
    }

    function ensureTypingIndicator() {
        const inputWrapper = document.getElementById('input-controls-wrapper');
        if (!inputWrapper) return null;
        let el = document.getElementById('typing-indicator');
        if (!el) {
            el = document.createElement('div');
            el.id = 'typing-indicator';
            el.className = 'typing-indicator';
            el.innerHTML = '<span class="typing-text"></span> <span class="typing-dots"><span></span><span></span><span></span></span>';
            inputWrapper.insertBefore(el, inputWrapper.firstChild);
        }
        return el;
    }

    function pollTyping() {
        if (!activeChannelId || !activeChannelType) return;
        fetch(`/public/api/community/typing?discussionId=${encodeURIComponent(activeChannelId)}&discussionType=${encodeURIComponent(activeChannelType)}&username=${encodeURIComponent(currentUsername)}`)
            .then(r => r.json())
            .then(data => {
                const el = ensureTypingIndicator();
                if (!el) return;
                if (data.success && data.users && data.users.length > 0) {
                    const names = data.users.slice(0, 3);
                    const text = names.length === 1
                        ? `${names[0]} est en train d'écrire`
                        : `${names.join(', ')} sont en train d'écrire`;
                    el.querySelector('.typing-text').textContent = text;
                    el.classList.add('visible');
                } else {
                    el.classList.remove('visible');
                }
            })
            .catch(() => {});
    }

    // Start/restart typing poll when channel changes
    function startTypingPoll() {
        clearInterval(typingPollInterval);
        typingPollInterval = setInterval(pollTyping, 2000);
    }

    // === NEW MESSAGES FLOATING BUBBLE ===
    let newMsgBubble = null;
    let unreadNewCount = 0;

    function ensureNewMsgBubble() {
        if (newMsgBubble) return newMsgBubble;
        const chatCol = document.getElementById('active-chat-column');
        if (!chatCol) return null;
        newMsgBubble = document.createElement('div');
        newMsgBubble.className = 'new-messages-bubble';
        newMsgBubble.addEventListener('click', () => {
            const mc = document.getElementById('messages-container');
            if (mc) mc.scrollTop = mc.scrollHeight;
            hideNewMsgBubble();
        });
        chatCol.style.position = 'relative';
        chatCol.appendChild(newMsgBubble);
        // Auto-hide when scrolled to bottom
        const mc = document.getElementById('messages-container');
        if (mc) {
            mc.addEventListener('scroll', () => {
                if (mc.scrollHeight - mc.scrollTop <= mc.clientHeight + 120) {
                    hideNewMsgBubble();
                }
            });
        }
        return newMsgBubble;
    }

    function showNewMsgBubble(count) {
        const bubble = ensureNewMsgBubble();
        if (!bubble) return;
        unreadNewCount = count;
        bubble.textContent = `↓ ${count} nouveau${count > 1 ? 'x' : ''} message${count > 1 ? 's' : ''}`;
        bubble.classList.add('visible');
    }

    function hideNewMsgBubble() {
        unreadNewCount = 0;
        if (newMsgBubble) newMsgBubble.classList.remove('visible');
    }

    // Fonction pour envoyer un message
    function sendMessage() {
        if (!activeChannelId || !messageInput) return;

        const message = messageInput.value.trim();
        if (!message && !selectedFile) return;

        // Trouver le type de la discussion active
        const activeItem = document.querySelector('.discussion-item.active');
        if (!activeItem) return;

        const discussionType = activeItem.getAttribute('data-type');
        if (!discussionType || discussionType === 'topic') return; // Les sujets ne servent pas à discuter

        // Créer FormData pour l'upload
        const formData = new FormData();
        formData.append('discussionId', activeChannelId);
        formData.append('discussionType', discussionType);
        formData.append('message', message);
        formData.append('username', currentUsername);

        // Ajouter la réponse si elle existe
        if (replyingToMessage) {
            formData.append('repliesTo', replyingToMessage.id);
        }

        if (selectedFile) {
            formData.append('file', selectedFile);
        }

        fetch('/public/api/community/send-message', {
            method: 'POST',
            body: formData
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    messageInput.value = '';
                    selectedFile = null;
                    hideFilePreview();
                    clearReply(); // Nettoyer la réponse
                    // Recharger les messages
                    loadMessages(activeChannelId, discussionType);
                } else {
                    alert('Erreur envoi message: ' + data.message);
                }
            })
            .catch(err => {
                console.error('Erreur envoi message:', err);
                alert('Erreur serveur');
            });
    }
}

// Précharger cache PP (pour le menu)
function preloadAvatarsCache() {
    if (avatarsCache && Object.keys(avatarsCache).length > 0) return;
    fetch('/api/community/ressources/pp/pp.json')
        .then(r => (r && r.ok) ? r.json() : {})
        .then(ppData => {
            avatarsCache = ppData || {};
            try { updateChannelAvatarsFromCache(); } catch (e) { }
        })
        .catch(() => { });
}

// Précharger cache couleurs utilisateurs (anneau)
function preloadUsersColors() {
    if (usersColorsCache && Object.keys(usersColorsCache).length > 0) return;
    fetch('/api/users.json')
        .then(r => (r && r.ok) ? r.json() : [])
        .then(users => {
            const map = {};
            if (Array.isArray(users)) {
                for (const u of users) {
                    if (u && u.username) map[u.username] = u.color || map[u.username];
                }
            }
            usersColorsCache = map;
            try { updateChannelAvatarsFromCache(); } catch (e) { }
        })
        .catch(() => { });
}

function updateChannelAvatarsFromCache() {
    // MP avatars
    document.querySelectorAll('.channel-avatar-img').forEach(img => {
        const username = img.getAttribute('data-username') || '';
        if (username && avatarsCache[username]) {
            img.src = avatarsCache[username];
        }
    });

    // MP rings
    document.querySelectorAll('.channel-avatar-wrap').forEach(wrap => {
        const img = wrap.querySelector('.channel-avatar-img');
        const username = img ? (img.getAttribute('data-username') || '') : '';
        if (username && usersColorsCache[username]) {
            wrap.style.background = usersColorsCache[username];
        }
    });
}

// Fonction pour charger les avatars des messages
function loadMessageAvatars() {
    // Utiliser le cache si disponible
    if (Object.keys(avatarsCache).length > 0) {
        updateMessageAvatarsFromCache();
        return;
    }

    // Charger depuis le serveur si cache vide
    fetch('/api/community/ressources/pp/pp.json')
        .then(response => response.ok ? response.json() : {})
        .then(ppData => {
            avatarsCache = ppData; // Mettre à jour le cache
            updateMessageAvatarsFromCache();
        })
        .catch(err => console.warn('Erreur chargement avatars:', err));
}

function updateMessageAvatarsFromCache() {
    // Mettre à jour tous les avatars dans les messages
    const avatars = document.querySelectorAll('.message-avatar');
    avatars.forEach(avatar => {
        const username = avatar.getAttribute('data-username');
        const avatarPath = avatarsCache[username];
        if (avatarPath) {
            avatar.src = avatarPath;
        } else {
            avatar.src = '/ressources/user-icon.png';
        }
    });
}

// Fonction pour charger l'avatar de l'utilisateur actuel dans le sidebar
function loadCurrentUserAvatar() {
    const currentUsername = localStorage.getItem('source_username');
    if (!currentUsername) return;

    const userAvatarElement = document.getElementById('user-pp');
    if (!userAvatarElement) return;

    // Utiliser le cache si disponible
    if (avatarsCache[currentUsername]) {
        userAvatarElement.src = avatarsCache[currentUsername];
        return;
    }

    // Charger depuis le serveur si pas en cache
    fetch('/api/community/ressources/pp/pp.json')
        .then(response => response.ok ? response.json() : {})
        .then(ppData => {
            avatarsCache = ppData; // Mettre à jour le cache complet
            const avatarPath = ppData[currentUsername];
            if (avatarPath) {
                userAvatarElement.src = avatarPath;
            } else {
                userAvatarElement.src = '/ressources/user-icon.png';
            }
        })
        .catch(err => console.warn('Erreur chargement avatar utilisateur:', err));
}

window.initCommunityChat = initCommunityChat;

// Fonction globale pour mettre à jour le cache des avatars (appelée depuis d'autres pages)
window.updateAvatarsCache = function (newPpData) {
    if (newPpData) {
        avatarsCache = { ...avatarsCache, ...newPpData };
    } else {
        // Recharger depuis le serveur
        fetch('/api/community/ressources/pp/pp.json')
            .then(response => response.ok ? response.json() : {})
            .then(ppData => {
                avatarsCache = ppData;
                // Mettre à jour les avatars affichés
                updateMessageAvatarsFromCache();
                loadCurrentUserAvatar();
            })
            .catch(err => console.warn('Erreur rechargement avatars:', err));
    }
};

// Fonctions globales pour la gestion des réponses aux messages
function scrollToMessage(messageId) {
    const messageElement = document.querySelector(`.message-item[data-message-id="${CSS.escape(messageId)}"]`);
    if (messageElement) {
        messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        messageElement.classList.add('highlight-message');
        setTimeout(() => {
            messageElement.classList.remove('highlight-message');
        }, 2000);
    }
}

function clearReply() {
    replyingToMessage = null;
    updateReplyPreview();
}

function updateReplyPreview() {
    const replyPreviewArea = document.getElementById('reply-preview-area');
    if (!replyPreviewArea) return;

    if (replyingToMessage) {
        const preview = document.createElement('div');
        preview.className = 'reply-preview';
        preview.innerHTML = `
            <div class="reply-preview-content">
                <span class="reply-preview-to">Réponse à: <strong>${replyingToMessage.sender}</strong></span>
                <span class="reply-preview-text">${(replyingToMessage.content || '').substring(0, 50)}${(replyingToMessage.content || '').length > 50 ? '...' : ''}</span>
            </div>
            <button type="button" class="reply-preview-close" onclick="clearReply()">×</button>
        `;
        replyPreviewArea.innerHTML = '';
        replyPreviewArea.appendChild(preview);
        replyPreviewArea.style.display = 'block';
    } else {
        replyPreviewArea.style.display = 'none';
        replyPreviewArea.innerHTML = '';
    }
}

function setReplyingTo(message) {
    replyingToMessage = message;
    updateReplyPreview();
}

// Cache global pour les photos de profil
let globalPpDataCache = {};

// Fonction globale pour ouvrir le profil utilisateur
async function openUserProfile(username) {
    const name = String(username || '').trim();
    if (!name) return;
    const modal = document.getElementById('user-profile-modal');
    if (!modal) return;
    const avatarEl = document.getElementById('profile-modal-avatar');
    const usernameEl = document.getElementById('profile-modal-username');
    const birthdateEl = document.getElementById('profile-modal-birthdate');
    usernameEl && (usernameEl.textContent = name);

    try {
        if (Object.keys(globalPpDataCache).length === 0) {
            const resp = await fetch('/api/community/ressources/pp/pp.json');
            if (resp.ok) {
                globalPpDataCache = await resp.json();
            }
        }
    } catch (e) {
        console.warn('Erreur chargement photos profil:', e);
    }

    const ppPath = globalPpDataCache && globalPpDataCache[name] ? globalPpDataCache[name] : null;
    if (avatarEl) {
        avatarEl.src = ppPath ? ppPath : '/ressources/user-icon.png';
    }

    // Charger et afficher les badges actuels
    try {
        const resp = await fetch(`/api/user-info/${encodeURIComponent(name)}`);
        if (resp.ok) {
            const data = await resp.json();
            if (data.success && data.user) {
                // Afficher la date de naissance (birth_date avec underscore!)
                if (birthdateEl && data.user.birth_date) {
                    birthdateEl.textContent = `Date de naissance : ${data.user.birth_date}`;
                } else if (birthdateEl) {
                    birthdateEl.textContent = 'Date de naissance : Non disponible';
                }

                // Nettoyer l'ancien affichage de signalements
                const oldReportsInfo = document.querySelector('.profile-reports-info');
                if (oldReportsInfo) {
                    oldReportsInfo.remove();
                }

                // Afficher les signalements si présents
                const reportsCount = data.user.reports_count || 0;
                if (reportsCount > 0) {
                    const reportsInfo = document.createElement('p');
                    reportsInfo.className = 'profile-reports-info';
                    reportsInfo.style.fontSize = '0.85em';
                    reportsInfo.style.color = '#ff6b6b';
                    reportsInfo.style.marginTop = '5px';
                    reportsInfo.textContent = `${reportsCount} signalement${reportsCount > 1 ? 's' : ''}`;
                    if (birthdateEl && birthdateEl.parentElement) {
                        birthdateEl.parentElement.insertBefore(reportsInfo, birthdateEl.nextSibling);
                    }
                }

                // Appliquer la couleur de l'utilisateur au nom et au cercle
                if (data.user.color && usernameEl) {
                    usernameEl.style.color = data.user.color;
                }
                if (data.user.color && avatarEl) {
                    avatarEl.style.borderColor = data.user.color;
                    avatarEl.style.boxShadow = `0 0 0 3px ${data.user.color}`;
                }

                // Afficher la bannière du profil
                const bannerEl = document.getElementById('profile-modal-banner');
                if (bannerEl && typeof getSocialBannerBackground === 'function') {
                    const sp = data.user.social_profile || {};
                    const bannerBg = getSocialBannerBackground(sp.banner || 'bleu basique');
                    bannerEl.style.background = bannerBg;
                }

                // Afficher la vitrine de badges
                const showcaseEl = document.getElementById('profile-showcase-badges');
                if (showcaseEl) {
                    showcaseEl.innerHTML = '';
                    const sp = data.user.social_profile || {};
                    const showcaseBadges = Array.isArray(sp.badge_showcase) ? sp.badge_showcase : [];
                    if (showcaseBadges.length > 0) {
                        showcaseBadges.forEach(badgeId => {
                            if (typeof BADGE_ICONS !== 'undefined' && BADGE_ICONS[badgeId]) {
                                const badge = BADGE_ICONS[badgeId];
                                const desc = BADGE_DESCRIPTIONS && BADGE_DESCRIPTIONS[badgeId] ? BADGE_DESCRIPTIONS[badgeId] : { name: badgeId, description: '' };
                                const badgeContainer = document.createElement('div');
                                badgeContainer.className = 'badge-with-tooltip';
                                badgeContainer.style.position = 'relative';
                                badgeContainer.style.display = 'inline-block';
                                badgeContainer.style.cursor = 'pointer';

                                const span = document.createElement('span');
                                span.className = 'badge-item badge-clickable';
                                span.title = `${desc.name}: ${desc.description}`;

                                if (badge.type === 'image') {
                                    span.innerHTML = `<img src="${badge.src}" alt="${desc.name}" class="badge-icon-large">`;
                                } else {
                                    span.innerHTML = `<span class="badge-emoji-large">${badge.emoji}</span>`;
                                }

                                badgeContainer.addEventListener('click', (e) => {
                                    e.stopPropagation();
                                    if (typeof window.showBadgeTooltipCommunaute === 'function') {
                                        window.showBadgeTooltipCommunaute(e, { name: desc.name, description: desc.description }, true);
                                    }
                                });

                                badgeContainer.appendChild(span);
                                showcaseEl.appendChild(badgeContainer);
                            }
                        });
                    } else {
                        showcaseEl.innerHTML = '<p class="no-badges">Aucun badge en vitrine</p>';
                    }
                }

                // Afficher les badges actuels
                const badgesCurrentEl = document.getElementById('profile-current-badges');
                const badgesObtainedEl = document.getElementById('profile-obtained-badges');

                if (badgesCurrentEl) {
                    badgesCurrentEl.innerHTML = '';
                    const badgesCurrent = data.user.badges_current || [];
                    if (badgesCurrent.length > 0) {
                        badgesCurrent.forEach(badgeId => {
                            if (typeof BADGE_ICONS !== 'undefined' && BADGE_ICONS[badgeId]) {
                                const badge = BADGE_ICONS[badgeId];
                                const desc = BADGE_DESCRIPTIONS && BADGE_DESCRIPTIONS[badgeId] ? BADGE_DESCRIPTIONS[badgeId] : { name: badgeId, description: '' };
                                const badgeContainer = document.createElement('div');
                                badgeContainer.className = 'badge-with-tooltip';
                                badgeContainer.style.position = 'relative';
                                badgeContainer.style.display = 'inline-block';
                                badgeContainer.style.cursor = 'pointer';

                                const span = document.createElement('span');
                                span.className = 'badge-item badge-clickable';
                                span.title = `${desc.name}: ${desc.description}`;

                                if (badge.type === 'image') {
                                    span.innerHTML = `<img src="${badge.src}" alt="${desc.name}" class="badge-icon-large">`;
                                } else {
                                    span.innerHTML = `<span class="badge-emoji-large">${badge.emoji}</span>`;
                                }

                                // Utiliser le même système de tooltip que mon compte
                                badgeContainer.addEventListener('click', (e) => {
                                    e.stopPropagation();
                                    e.stopImmediatePropagation();
                                    e.preventDefault();
                                    window.showBadgeTooltipCommunaute(e, {
                                        name: desc.name,
                                        description: desc.description
                                    }, true);
                                });

                                badgeContainer.appendChild(span);
                                badgesCurrentEl.appendChild(badgeContainer);
                            }
                        });
                    } else {
                        badgesCurrentEl.innerHTML = '<p class="no-badges">Aucun badge</p>';
                    }
                }

                if (badgesObtainedEl) {
                    badgesObtainedEl.innerHTML = '';
                    const badgesObtained = data.user.badges_obtained || [];
                    if (badgesObtained.length > 0) {
                        badgesObtained.forEach(badgeId => {
                            if (typeof BADGE_ICONS !== 'undefined' && BADGE_ICONS[badgeId]) {
                                const badge = BADGE_ICONS[badgeId];
                                const desc = BADGE_DESCRIPTIONS && BADGE_DESCRIPTIONS[badgeId] ? BADGE_DESCRIPTIONS[badgeId] : { name: badgeId, description: '' };
                                const badgeContainer = document.createElement('div');
                                badgeContainer.className = 'badge-with-tooltip';
                                badgeContainer.style.position = 'relative';
                                badgeContainer.style.display = 'inline-block';
                                badgeContainer.style.cursor = 'pointer';

                                const span = document.createElement('span');
                                span.className = 'badge-item badge-clickable';
                                span.title = `${desc.name}: ${desc.description}`;

                                if (badge.type === 'image') {
                                    span.innerHTML = `<img src="${badge.src}" alt="${desc.name}" class="badge-icon-large">`;
                                } else {
                                    span.innerHTML = `<span class="badge-emoji-large">${badge.emoji}</span>`;
                                }

                                // Utiliser le même système de tooltip que mon compte
                                badgeContainer.addEventListener('click', (e) => {
                                    e.stopPropagation();
                                    window.showBadgeTooltipCommunaute(e, {
                                        name: desc.name,
                                        description: desc.description
                                    }, true); // true car badge obtenu
                                });

                                badgeContainer.appendChild(span);
                                badgesObtainedEl.appendChild(badgeContainer);
                            }
                        });
                    } else {
                        badgesObtainedEl.innerHTML = '<p class="no-badges">Aucun badge</p>';
                    }
                }
            }
        }
    } catch (e) {
        console.error('Erreur chargement badges profil:', e);
    }

    modal.style.display = 'flex';
    const closeBtn = document.getElementById('close-user-profile-btn');
    closeBtn && closeBtn.addEventListener('click', () => { modal.style.display = 'none'; }, { once: true });
}

// Appel de la fonction d'initialisation
initCommunityChat();

// === RESTORE: Chat title pill opens group info overlay ===
function openGroupDetailsOverlay() {
    const overlay = document.getElementById('group-details-overlay');
    if (!overlay) return;

    // Récupérer le groupe actif
    if (!lastGlobalData || !activeChannelId || activeChannelType !== 'group') {
        overlay.style.display = 'flex';
        return;
    }
    const group = (lastGlobalData.groups || []).find(g => g.id === activeChannelId);
    if (!group) {
        overlay.style.display = 'flex';
        return;
    }

    // Remplir les champs
    const nameEl = document.getElementById('group-details-name');
    if (nameEl) nameEl.value = group.name || '';
    const descEl = document.getElementById('group-details-description');
    if (descEl) descEl.value = group.description || '';
    const photoEl = document.getElementById('group-details-photo');
    if (photoEl) {
        photoEl.src = group.photo || group.photoUrl || '/ressources/communaute/grpicon.png';
        // Style bannière façon YouTube
        photoEl.style.width = '100%';
        photoEl.style.maxWidth = '420px';
        photoEl.style.height = '110px';
        photoEl.style.objectFit = 'cover';
        photoEl.style.borderRadius = '18px';
        photoEl.style.border = '2.5px solid #1de9b6';
        photoEl.style.marginBottom = '8px';
        photoEl.style.display = 'block';
        photoEl.style.boxShadow = '0 2px 12px rgba(0,0,0,0.18)';
    }
    const membersCountEl = document.getElementById('group-details-members-count');
    if (membersCountEl) membersCountEl.textContent = (group.members ? group.members.length : 0) + (group.members && group.members.length > 1 ? ' membres' : ' membre');
    const membersListEl = document.getElementById('group-details-members');
    if (membersListEl) {
        membersListEl.innerHTML = '';
        // Charger les infos utilisateurs depuis le cache (users.json)
        let usersData = window._usersDataCache;
        if (!usersData) {
            try {
                // Synchronous XHR (rare, mais pour garantir le cache)
                const req = new XMLHttpRequest();
                req.open('GET', '/public/api/users.json', false);
                req.send(null);
                if (req.status === 200) {
                    usersData = JSON.parse(req.responseText);
                    window._usersDataCache = usersData;
                } else {
                    usersData = [];
                }
            } catch (e) { usersData = []; }
        }
        (group.members || []).forEach(member => {
            const user = (usersData || []).find(u => u.username === member) || {};
            const color = user.color || usersColorsCache[member] || '#bcbcbc';
            const avatar = avatarsCache[member] || '/ressources/user-icon.png';
            const badges = (user.badges_current || []);
            // Crée le bloc membre
            const div = document.createElement('div');
            div.className = 'group-member-card';
            div.style.display = 'inline-flex';
            div.style.alignItems = 'center';
            div.style.gap = '6px';
            div.style.background = '#fff';
            div.style.border = '1.5px solid ' + color;
            div.style.borderRadius = '16px';
            div.style.padding = '3px 10px 3px 4px';
            div.style.margin = '3px 4px 3px 0';
            div.style.cursor = 'pointer';
            div.onclick = () => openUserProfile(member);

            // Avatar
            const img = document.createElement('img');
            img.src = avatar;
            img.alt = member;
            img.style.width = '24px';
            img.style.height = '24px';
            img.style.borderRadius = '50%';
            img.style.border = '2px solid ' + color;
            img.style.background = '#eee';
            div.appendChild(img);

            // Nom
            const nameSpan = document.createElement('span');
            nameSpan.textContent = member;
            nameSpan.style.fontWeight = '500';
            nameSpan.style.color = color;
            nameSpan.style.fontSize = '15px';
            div.appendChild(nameSpan);

            // Badges
            if (badges && badges.length > 0 && typeof BADGE_ICONS !== 'undefined') {
                const badgesWrap = document.createElement('span');
                badgesWrap.style.display = 'inline-flex';
                badgesWrap.style.gap = '2px';
                badges.forEach(badgeId => {
                    if (BADGE_ICONS[badgeId]) {
                        const badge = BADGE_ICONS[badgeId];
                        const desc = BADGE_DESCRIPTIONS && BADGE_DESCRIPTIONS[badgeId] ? BADGE_DESCRIPTIONS[badgeId] : { name: badgeId, description: '' };
                        const badgeSpan = document.createElement('span');
                        badgeSpan.className = 'badge-item';
                        badgeSpan.title = desc.name + ': ' + desc.description;
                        badgeSpan.style.fontSize = '15px';
                        badgeSpan.style.marginLeft = '2px';
                        badgeSpan.style.display = 'inline-block';
                        badgeSpan.style.verticalAlign = 'middle';
                        badgeSpan.style.cursor = 'pointer';
                        badgeSpan.onclick = (e) => { e.stopPropagation(); window.showBadgeTooltipCommunaute(e, desc, true); };
                        if (badge.type === 'image') {
                            badgeSpan.innerHTML = `<img src="${badge.src}" alt="${desc.name}" style="width:16px;height:16px;vertical-align:middle;">`;
                        } else {
                            badgeSpan.innerHTML = `<span style="font-size:16px;">${badge.emoji}</span>`;
                        }
                        badgesWrap.appendChild(badgeSpan);
                    }
                });
                div.appendChild(badgesWrap);
            }

            membersListEl.appendChild(div);
        });
    }
    // Calcul du nombre de messages :
    const messagesCountEl = document.getElementById('group-details-messages-count');
    let messagesCount = 0;
    try {
        // Toujours lire le fichier du groupe pour avoir le vrai nombre
        const req = new XMLHttpRequest();
        req.open('GET', `/api/community/groupes/${group.id}.json`, false);
        req.send(null);
        if (req.status === 200) {
            const groupFile = JSON.parse(req.responseText);
            if (Array.isArray(groupFile.messages)) {
                messagesCount = groupFile.messages.length;
            } else {
                messagesCount = 0;
            }
        } else {
            console.warn(`Fichier groupe non trouvé ou erreur HTTP pour ${group.id}`);
        }
    } catch (e) {
        messagesCount = 0;
        console.error('[COMMUNAUTE] Erreur lecture groupe:', e);
    }
    if (messagesCountEl) {
        messagesCountEl.textContent = messagesCount + (messagesCount === 1 ? ' message' : ' messages');
    }

    // Event listeners pour les boutons du panneau d'infos
    const closeBtn = document.getElementById('close-group-details-btn');
    if (closeBtn) closeBtn.onclick = () => { overlay.style.display = 'none'; };

    const saveDescBtn = document.getElementById('group-details-save-description');
    if (saveDescBtn && descEl) {
        saveDescBtn.onclick = () => {
            // Appel API pour sauvegarder la description (exemple POST)
            fetch('/public/api/community/update-group-description', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ groupId: group.id, description: descEl.value })
            })
                .then(r => r.json())
                .then(data => {
                    if (data.success) {
                        group.description = descEl.value;
                        alert('Description enregistrée !');
                    } else {
                        alert('Erreur: ' + (data.message || ''));
                    }
                })
                .catch(() => alert('Erreur réseau'));
        };
    }

    const changePhotoBtn = document.getElementById('group-details-change-photo-btn');
    const photoInput = document.getElementById('group-details-photo-input');
    if (changePhotoBtn && photoInput && photoEl) {
        // Style bouton plus petit
        changePhotoBtn.style.fontSize = '13px';
        changePhotoBtn.style.padding = '4px 12px';
        changePhotoBtn.style.marginLeft = '8px';
        changePhotoBtn.style.marginTop = '-18px';
        changePhotoBtn.style.height = '32px';
        changePhotoBtn.style.borderRadius = '10px';
        changePhotoBtn.style.background = '#1de9b6';
        changePhotoBtn.style.color = '#222';
        changePhotoBtn.style.fontWeight = 'bold';
        changePhotoBtn.style.boxShadow = '0 1px 6px rgba(0,0,0,0.10)';
        changePhotoBtn.onclick = () => photoInput.click();
        photoInput.onchange = () => {
            const file = photoInput.files && photoInput.files[0];
            if (!file) return;
            const formData = new FormData();
            formData.append('photo', file);
            formData.append('username', localStorage.getItem('source_username') || '');
            fetch(`/public/api/community/group-photo/${group.id}`, {
                method: 'POST',
                body: formData
            })
                .then(r => r.json())
                .then(data => {
                    if (data.success && data.photoUrl) {
                        photoEl.src = data.photoUrl;
                        group.photo = data.photoUrl;
                        group.photoUrl = data.photoUrl;
                        alert('Photo mise à jour !');
                        // Rafraîchir la liste globale (pour sidebar)
                        if (typeof loadDiscussions === 'function') loadDiscussions();
                    } else {
                        alert('Erreur: ' + (data.message || ''));
                    }
                })
                .catch(() => alert('Erreur réseau'));
        };
    }

    const leaveBtn = document.getElementById('group-details-leave-btn');
    if (leaveBtn) {
        // Masquer le bouton pour le groupe de classe (id: classe3c)
        if (group.id === 'classe3c') {
            leaveBtn.style.display = 'none';
        } else {
            leaveBtn.style.display = '';
            leaveBtn.onclick = () => {
                if (!confirm('Voulez-vous vraiment quitter ce groupe ?')) return;
                fetch('/public/api/community/leave-group', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ groupId: group.id, username: localStorage.getItem('source_username') })
                })
                    .then(r => r.json())
                    .then(data => {
                        if (data.success) {
                            alert('Vous avez quitté le groupe.');
                            overlay.style.display = 'none';
                            // Recharger la liste des discussions
                            if (typeof loadDiscussions === 'function') loadDiscussions();
                        } else {
                            alert('Erreur: ' + (data.message || ''));
                        }
                    })
                    .catch(() => alert('Erreur réseau'));
            };
        }
    }

    overlay.style.display = 'flex';
}

function attachChatTitlePillHandler() {
    const pill = document.getElementById('chat-title-pill');
    if (!pill) return;
    pill.onclick = openGroupDetailsOverlay;
}

// Attach on DOMContentLoaded and after chat switches
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachChatTitlePillHandler);
} else {
    attachChatTitlePillHandler();
}