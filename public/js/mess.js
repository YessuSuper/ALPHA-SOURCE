/* public/js/mess.js - Logique Front-end de la Messagerie (Version Email/Pro) */

// 🚨 VARIABLES ET DONNÉES 🚨

const classList = [
    'Even', 'Alexandre', 'Calixte', 'Noé', 'Julia', 'Joan', 'Juliette', 'Jezy',
    'Inès', 'Timéo', 'Tyméo', 'Clautilde', 'Loanne', 'Lucie', 'Camille', 'Sofia',
    'Lilia', 'Amir', 'Robin', 'Arthur', 'Maxime', 'Gaultier', 'Antoine', 'Louis',
    'Anne-Victoria', 'Léa', 'Sarah', 'Ema', 'Jade', 'Alicia', 'Claire'
];

const CORE_USERS = [
    { id: '1', name: 'Source AI (Bot)' },
    { id: '2', name: 'Source Admin' },
];

let usersData = [
    ...CORE_USERS,
    ...classList.map((name, index) => ({ id: (index + 3).toString(), name: name }))
];

let messages = [];
let activeMessageId = null;
let MY_USERNAME = null;
let MY_USER_ID = null;
let selectedRecipients = [];
let attachedFiles = [];
let composeMode = 'standard';

function normalizeNameKey(s) {
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

function normalizeNameKeyLoose(s) {
    // Version plus tolérante: "Even HENRI" => "even henri", "Anne-Victoria" => "anne victoria"
    return normalizeNameKey(s)
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// ==================================================================
// --- Cours links inside messages ---
// ==================================================================

const COURSE_ID_TOKEN_REGEX = /\b(\d{10,16})\b/g; // IDs cours = timestamps (ex: 1767369259987)
const COURSE_FILTER_STORAGE_KEY = 'alpha_course_filter_id';

function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function buildMessageBodyHtmlWithCourseLinks(bodyText) {
    const raw = escapeHtml(bodyText || '');
    const withPills = raw.replace(COURSE_ID_TOKEN_REGEX, (_m, id) => {
        const safeId = String(id);
        return `<button type="button" class="course-id-pill" data-course-id="${safeId}" aria-label="Ouvrir le cours ${safeId}">${safeId}</button>`;
    });
    return withPills.replace(/\n/g, '<br>');
}

function navigateToCourseById(courseId) {
    const id = String(courseId || '').trim();
    if (!id) return;
    try { localStorage.setItem(COURSE_FILTER_STORAGE_KEY, id); } catch (_) { }

    if (typeof window.renderPage === 'function') {
        window.renderPage('cours');
        return;
    }
    console.warn('renderPage introuvable: navigation vers cours impossible.');
}

// ==================================================================
// --- FONCTIONS DE GESTION DU DOM ET DU RENDU ---
// ==================================================================

function isMobileView() {
    return window.innerWidth <= 768;
}

function showMainContent() {
    if (isMobileView()) {
        document.getElementById('messaging-main-content')?.classList.add('show-mobile');
    }
}

function hideMainContent() {
    if (isMobileView()) {
        document.getElementById('messaging-main-content')?.classList.remove('show-mobile');
    }
}

function showScreen(screen) {
    const welcome = document.getElementById('messaging-welcome-screen');
    const compose = document.getElementById('compose-form-container');
    const detail = document.getElementById('message-detail-view');
    const rescue = document.getElementById('rescue-form-container');
    [welcome, compose, detail, rescue].forEach(el => el?.classList.add('hidden'));
    if (screen === 'welcome') welcome?.classList.remove('hidden');
    else if (screen === 'compose') compose?.classList.remove('hidden');
    else if (screen === 'detail') detail?.classList.remove('hidden');
    else if (screen === 'rescue') rescue?.classList.remove('hidden');

    if (screen !== 'welcome') {
        showMainContent();
    }
}

function setInboxStatus(text, kind = 'info') {
    const sidebar = document.getElementById('inbox-sidebar');
    if (!sidebar) return;

    let el = document.getElementById('mess-inbox-status');
    if (!el) {
        el = document.createElement('div');
        el.id = 'mess-inbox-status';
        el.style.padding = '8px 12px';
        el.style.margin = '0 0 10px 0';
        el.style.borderBottom = '1px solid #333';
        el.style.fontSize = '12px';
        el.style.color = '#aaa';

        // Place juste après le titre "Messages" si possible
        const h2 = sidebar.querySelector('h2');
        if (h2 && h2.nextSibling) sidebar.insertBefore(el, h2.nextSibling);
        else sidebar.insertBefore(el, sidebar.firstChild);
    }

    el.textContent = String(text || '');
    if (kind === 'error') el.style.color = '#ffb3b3';
    else if (kind === 'ok') el.style.color = '#b6fcb6';
    else el.style.color = '#aaa';
}

function renderMessageList() {
    const list = document.getElementById('message-list-inbox');
    if (!list) return;
    list.innerHTML = '';

    messages.sort((a, b) => b.id.localeCompare(a.id));

    const countElement = document.getElementById('message-count');
    if (countElement) countElement.textContent = `(${messages.length})`;

    if (!Array.isArray(messages) || messages.length === 0) {
        list.innerHTML = '<p style="padding:12px;color:#aaa;">Aucun message.</p>';
        return;
    }

    messages.forEach(msg => {
        const item = document.createElement('div');
        item.classList.add('message-item');
        item.setAttribute('data-message-id', msg.id);
        if (msg.unread === true) item.classList.add('unread');
        if (msg.id === activeMessageId) item.classList.add('active');
        if (msg.parentMessageId) item.classList.add('is-reply');
        if (msg.subject === 'Urgent' || msg.type === 'rescue_alert') item.classList.add('urgent');

        const senderDisplay = msg.senderId === MY_USER_ID ? 'Moi' : msg.senderName;
        const relDate = typeof window.timeAgo === 'function' ? window.timeAgo(msg.date || msg.timestamp) : escapeHtml(msg.date);

        item.innerHTML = `
            <span class="message-sender-preview">${escapeHtml(senderDisplay)}</span>
            <span class="message-subject-preview">${escapeHtml(msg.subject)}</span>
            <span class="message-date relative-time" title="${escapeHtml(msg.date)}">${relDate}</span>
        `;
        list.appendChild(item);
    });
}

async function markMessageAsRead(messageId) {
    const id = String(messageId || '').trim();
    if (!id || !MY_USER_ID) return;
    try {
        await fetch('/api/messagerie/mark-read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: MY_USER_ID, messageId: id })
        });
        // Signal au widget Accueil que les messages ont changé
        try { sessionStorage.setItem('alpha_messages_dirty', 'true'); } catch { }
    } catch (e) {
        console.warn('[MESS] mark-read failed', e);
    }
}

function renderReadStatus(msg) {
    const detail = document.getElementById('message-detail-view');
    if (!detail) return;

    let readP = document.getElementById('detail-readby');
    if (!readP) {
        readP = document.createElement('p');
        readP.id = 'detail-readby';
        const anchor = document.getElementById('detail-recipients');
        if (anchor) anchor.after(readP);
        else detail.insertBefore(readP, detail.querySelector('hr') || null);
    }

    let unreadP = document.getElementById('detail-unreadby');
    if (!unreadP) {
        unreadP = document.createElement('p');
        unreadP.id = 'detail-unreadby';
        readP.after(unreadP);
    }

    const lus = Array.isArray(msg.lusPar) ? msg.lusPar : [];
    const non = Array.isArray(msg.nonLus) ? msg.nonLus : [];
    readP.textContent = `Lus par : ${lus.length ? lus.join(', ') : 'Personne'}`;
    unreadP.textContent = `Non lus : ${non.length ? non.join(', ') : 'Personne'}`;
}

function renderMessageDetail(messageId) {
    const msg = messages.find(m => m.id === messageId);
    if (!msg) return;

    // Afficher le contenu principal sur mobile
    showMainContent();

    activeMessageId = messageId;
    const subjectEl = document.getElementById('detail-subject');
    if (subjectEl) {
        subjectEl.textContent = msg.subject;
        let badge = document.getElementById('detail-urgent-badge');
        if (!badge) {
            badge = document.createElement('span');
            badge.id = 'detail-urgent-badge';
            subjectEl.after(badge);
        }
        if (msg.subject === 'Urgent' || msg.type === 'rescue_alert') {
            badge.textContent = 'URGENT';
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    }

    const senderDisplay = msg.senderId === MY_USER_ID ? 'Moi' : msg.senderName;
    const senderNameEl = document.querySelector('#detail-sender .sender-name-detail');
    if (senderNameEl) senderNameEl.textContent = senderDisplay;

    const recipientsEl = document.querySelector('#detail-recipients .recipients-list-detail');
    if (recipientsEl) {
        recipientsEl.textContent = Array.isArray(msg.recipients) ? msg.recipients.join(', ') : '';
    }

    renderReadStatus(msg);

    const bodyContainer = document.getElementById('detail-body-content');
    if (bodyContainer) {
        bodyContainer.innerHTML = buildMessageBodyHtmlWithCourseLinks(msg.body);
    }

    const attachmentsContainer = document.getElementById('detail-attachments');
    if (!attachmentsContainer) {
        console.error("[LOG] (MESS): Conteneur 'detail-attachments' non trouvé dans le DOM.");
    }

    if (attachmentsContainer) {
        attachmentsContainer.innerHTML = '';
        if (msg.attachments && msg.attachments.length > 0) {
            const title = document.createElement('h2');
            title.textContent = 'Pièces Jointes :';
            attachmentsContainer.appendChild(title);

            msg.attachments.forEach(att => {
                const link = document.createElement('a');
                link.href = att.data || att.url; // Base64 ou URL
                link.target = '_blank';
                link.download = att.name;
                link.textContent = `📎 ${att.name} (${Math.round(att.size / 1024)} Ko)`;
                const p = document.createElement('p');
                p.appendChild(link);
                attachmentsContainer.appendChild(p);
            });
        }
    }

    // Marquer lu pour l'utilisateur courant (persisté côté serveur)
    if (msg.unread === true) {
        msg.unread = false;
        markMessageAsRead(messageId);
        // Rafraîchit la liste après un court délai (pour récupérer lusPar/nonLus à jour)
        setTimeout(() => { fetchMessages().catch(() => { }); }, 250);
    }

    const replyBtn = document.getElementById('reply-to-message-btn');
    if (replyBtn) {
        if (msg.senderName === 'Anonyme' || msg.senderId === 'anon') {
            replyBtn.disabled = true;
            replyBtn.style.opacity = 0.5;
        } else {
            replyBtn.disabled = false;
            replyBtn.style.opacity = 1.0;
        }
    }

    renderRescueActions(msg);

    renderMessageList();
    showScreen('detail');
}

function renderRescueActions(msg) {
    const panel = document.getElementById('rescue-actions');
    if (!panel) return;
    panel.innerHTML = '';
    panel.classList.add('hidden');

    // Actions pour le demandeur sur les réponses
    if (msg.type === 'rescue_submission' && msg.rescueOwnerId === MY_USER_ID) {
        const status = msg.rescueStatus || 'open';
        const info = document.createElement('p');
        info.textContent = status === 'closed'
            ? 'Sauvetage déjà clôturé. Réponse validée.'
            : 'Valide ou refuse ce cours. Un vote vert clôture le sauvetage (+15 points pour l\'auteur).';
        panel.appendChild(info);

        if (status !== 'closed') {
            const buttons = document.createElement('div');
            buttons.classList.add('vote-buttons');

            const approveBtn = document.createElement('button');
            approveBtn.classList.add('action-button', 'primary');
            approveBtn.textContent = 'Valider (+15 points)';
            approveBtn.addEventListener('click', () => submitRescueVote(msg.rescueId, msg.id, 'up'));

            const rejectBtn = document.createElement('button');
            rejectBtn.classList.add('action-button', 'secondary');
            rejectBtn.textContent = 'Refuser';
            rejectBtn.addEventListener('click', () => submitRescueVote(msg.rescueId, msg.id, 'down'));

            buttons.appendChild(approveBtn);
            buttons.appendChild(rejectBtn);
            panel.appendChild(buttons);
        }

        panel.classList.remove('hidden');
    }

    // Actions pour une demande de rejoindre un fill (admin)
    if (msg.type === 'fill_join_request') {
        const status = msg.fillJoinStatus || 'pending';

        const info = document.createElement('p');
        if (status === 'accepted') {
            info.textContent = 'Demande déjà acceptée.';
        } else if (status === 'refused') {
            info.textContent = 'Demande déjà refusée.';
        } else {
            const fillName = msg.fillName ? String(msg.fillName) : 'un fill';
            const requester = msg.requesterUsername ? String(msg.requesterUsername) : 'un utilisateur';
            info.textContent = `Demande de ${requester} pour rejoindre ${fillName}.`;
        }
        panel.appendChild(info);

        if (status !== 'accepted' && status !== 'refused') {
            const buttons = document.createElement('div');
            buttons.classList.add('vote-buttons');

            const acceptBtn = document.createElement('button');
            acceptBtn.classList.add('action-button', 'primary');
            acceptBtn.textContent = 'Accepter';
            acceptBtn.addEventListener('click', () => submitFillJoinResponse(msg.fillJoinRequestId, msg.id, 'accepted'));

            const refuseBtn = document.createElement('button');
            refuseBtn.classList.add('action-button', 'secondary');
            refuseBtn.textContent = 'Refuser';
            refuseBtn.addEventListener('click', () => submitFillJoinResponse(msg.fillJoinRequestId, msg.id, 'refused'));

            buttons.appendChild(acceptBtn);
            buttons.appendChild(refuseBtn);
            panel.appendChild(buttons);
        }

        panel.classList.remove('hidden');
    }
}

async function submitRescueVote(rescueId, messageId, vote) {
    try {
        const response = await fetch('/api/messagerie/rescue/vote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rescueId, messageId, voterId: MY_USER_ID, vote })
        });
        const result = await response.json();
        if (response.ok && result.success) {
            await showModal(vote === 'up' ? 'Réponse validée, sauvetage clôturé.' : 'Réponse refusée.');
            await fetchMessages();
            if (messageId) renderMessageDetail(messageId);
        } else {
            await showModal(`Vote impossible : ${result.message || 'Erreur serveur.'}`);
        }
    } catch (error) {
        console.error('ERREUR VOTE SAUVETAGE:', error);
        await showModal(`Erreur réseau/serveur pendant le vote. ${error.message}`);
    }
}

async function submitFillJoinResponse(fillJoinRequestId, messageId, response) {
    if (!fillJoinRequestId) {
        await showModal('Demande invalide (id manquant).');
        return;
    }

    try {
        const action = response === 'accepted' ? 'accept' : (response === 'refused' ? 'refuse' : response);
        const res = await fetch('/public/api/community/fill-join-respond', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requestId: fillJoinRequestId, action, adminUsername: MY_USERNAME })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            await showModal(response === 'accepted' ? 'Demande acceptée.' : 'Demande refusée.');
            await fetchMessages();
            if (messageId) renderMessageDetail(messageId);
        } else {
            await showModal(`Action impossible : ${data.message || 'Erreur serveur.'}`);
        }
    } catch (error) {
        console.error('ERREUR REPONSE FILL JOIN:', error);
        await showModal(`Erreur réseau/serveur. ${error.message}`);
    }
}

function updateFileButtonText() {
    const btn = document.getElementById('attach-file-btn');
    if (btn) btn.textContent = `Joindre Fichier (${attachedFiles.length})`;
}

// ==================================================================
// 🚨 GESTION DE L'API (JSON LOCAL) 🚨
// ==================================================================

function processMessages(rawMessages) {
    return rawMessages.map(msg => {
        const sender = usersData.find(u => u.id === String(msg.senderId));
        const dateObj = new Date(msg.timestamp);
        const dateDisplay = dateObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

        const rawRecipients = Array.isArray(msg.recipients) ? msg.recipients.map(String) : [];
        const recipientNames = rawRecipients
            .map(r => {
                const byId = usersData.find(u => u.id === r);
                if (byId) return byId.name;
                const byName = usersData.find(u => normalizeNameKey(u.name) === normalizeNameKey(r));
                if (byName) return byName.name;
                return r;
            })
            .filter(Boolean);

        const shouldMask = Array.isArray(msg.maskSenderFor) && MY_USER_ID && msg.maskSenderFor.includes(MY_USER_ID);
        const senderNameDisplay = msg.senderName
            ? msg.senderName
            : ((msg.isAnonymous || msg.senderId === 'anon' || shouldMask) ? 'Anonyme' : (sender ? sender.name : 'Inconnu'));

        return {
            ...msg,
            senderName: senderNameDisplay,
            recipients: recipientNames,
            date: dateDisplay,
            unread: (typeof msg.unread === 'boolean') ? msg.unread : false,
            lusPar: Array.isArray(msg.lusPar) ? msg.lusPar : undefined,
            nonLus: Array.isArray(msg.nonLus) ? msg.nonLus : undefined
        };
    });
}

async function fetchMessages() {
    const endpoint = MY_USER_ID ? `/api/messagerie/messages?userId=${MY_USER_ID}` : '/api/messagerie/messages';
    console.log(`[LOG] (MESS) : Tentative de récupération des messages pour ID ${MY_USER_ID} depuis ${endpoint}...`);
    try {
        const response = await fetch(endpoint);
        if (!response.ok) throw new Error(`Erreur HTTP! Statut: ${response.status}`);

        let rawMessages = await response.json();

        if (!Array.isArray(rawMessages)) {
            console.error('[MESS] Réponse API inattendue (pas un tableau):', rawMessages);
            const list = document.getElementById('message-list-inbox');
            if (list) list.innerHTML = '<p style="padding:12px;color:#ffb3b3;">Erreur: messages illisibles.</p>';
            return;
        }

        console.log(`[MESS] Messages reçus: ${rawMessages.length}`);

        rawMessages = rawMessages.map(msg => ({
            ...msg,
            senderId: String(msg.senderId),
            recipients: Array.isArray(msg.recipients) ? msg.recipients.map(String) : []
        }));

        messages = processMessages(rawMessages);
        renderMessageList();

    } catch (error) {
        console.error('[LOG] (MESS) : Échec de la récupération des messages:', error);
        const list = document.getElementById('message-list-inbox');
        if (list) list.innerHTML = '<p style="padding:12px;color:#ffb3b3;">Erreur réseau: messages non chargés.</p>';
        setInboxStatus('Erreur réseau: messages non chargés', 'error');
    }
}
// ==================================================================
// 🚨 GESTION DE LA COMPOSITION ET DES RÉPONSES 🚨
// ==================================================================

function updateRecipientTags() {
    const container = document.getElementById('recipient-input-container');
    const hiddenInput = document.getElementById('selected-recipients-ids');
    const inputField = document.getElementById('recipient-input-field');
    const isReplyMode = document.getElementById('parent-message-id')?.value !== '';
    if (!container || !hiddenInput || !inputField) return;

    container.querySelectorAll('.recipient-tag').forEach(tag => tag.remove());

    selectedRecipients.forEach(user => {
        const tag = document.createElement('span');
        tag.classList.add('recipient-tag');
        tag.setAttribute('data-user-id', user.id);

        let removeButtonHtml = '';
        if (!isReplyMode) {
            removeButtonHtml = `<button type="button" class="remove-tag-btn" data-user-id="${user.id}">×</button>`;
        }

        tag.innerHTML = `${user.name} ${removeButtonHtml}`;
        container.insertBefore(tag, inputField);
    });

    hiddenInput.value = selectedRecipients.map(u => u.id).join(',');
    if (selectedRecipients.length > 0) hiddenInput.removeAttribute('required');
    else hiddenInput.setAttribute('required', 'required');
}

function addRecipient(user) {
    const isReplyMode = document.getElementById('parent-message-id')?.value !== '';
    if (isReplyMode && selectedRecipients.length > 0) return;
    if (!selectedRecipients.find(u => u.id === user.id)) {
        selectedRecipients.push(user);
        updateRecipientTags();
        document.getElementById('recipient-input-field').value = '';
        document.getElementById('autocomplete-list').classList.add('hidden');
    }
}

function removeRecipient(userId) {
    const isReplyMode = document.getElementById('parent-message-id')?.value !== '';
    if (isReplyMode) return;
    selectedRecipients = selectedRecipients.filter(u => u.id !== userId);
    updateRecipientTags();
}

function renderAutocomplete(query) {
    const list = document.getElementById('autocomplete-list');
    if (!list) return;
    list.innerHTML = '';

    const inputField = document.getElementById('recipient-input-field');
    if (query.length < 2 || inputField.disabled) { list.classList.add('hidden'); return; }

    const filteredUsers = usersData.filter(user =>
        classList.includes(user.name) &&
        user.name.toLowerCase().startsWith(query.toLowerCase()) &&
        !selectedRecipients.find(u => u.id === user.id)
    );

    if (filteredUsers.length === 0) { list.classList.add('hidden'); return; }

    filteredUsers.forEach(user => {
        const item = document.createElement('li');
        item.textContent = user.name;
        item.setAttribute('data-user-id', user.id);
        item.addEventListener('click', () => addRecipient(user));
        list.appendChild(item);
    });
    list.classList.remove('hidden');
}

function addAllClass() {
    if (document.getElementById('add-all-class-btn')?.disabled) return;

    selectedRecipients = [];
    let classRecipients = usersData.filter(user => classList.includes(user.name));
    const userWithId2 = usersData.find(u => u.id === '2');

    if (userWithId2 && !classRecipients.some(u => u.id === '2')) {
        selectedRecipients = [userWithId2, ...classRecipients];
    } else {
        selectedRecipients = classRecipients;
    }
    updateRecipientTags();
}

function showRescueForm() {
    const form = document.getElementById('rescue-message-form');
    if (!form) return;
    composeMode = 'rescue-request';
    form.reset();
    showScreen('rescue');
}

async function showComposeForm(isReply = false, originalMsgId = null) {
    const form = document.getElementById('send-message-form');
    if (!form) return;

    // Afficher le contenu principal sur mobile
    showMainContent();

    composeMode = 'standard';
    form.dataset.mode = 'standard';
    form.dataset.rescueId = '';
    form.dataset.rescueOwnerId = '';
    form.dataset.parentId = '';
    form.reset();
    selectedRecipients = [];
    attachedFiles = [];
    activeMessageId = originalMsgId || null;
    updateFileButtonText();

    let parentIdInput = document.getElementById('parent-message-id');
    if (!parentIdInput) {
        parentIdInput = document.createElement('input');
        parentIdInput.type = 'hidden';
        parentIdInput.id = 'parent-message-id';
        parentIdInput.name = 'parentMessageId';
        form.appendChild(parentIdInput);
    }

    const recipientGroup = document.querySelector('.recipient-group');
    const inputField = document.getElementById('recipient-input-field');
    const addAllBtn = document.getElementById('add-all-class-btn');
    const subjectGroup = document.getElementById('subject-group');
    const subjectInput = document.getElementById('message-subject');
    const anonymousCheckbox = document.getElementById('is-anonymous-checkbox');
    const anonymousLabel = document.querySelector('label[for="is-anonymous-checkbox"]');

    if (isReply && activeMessageId) {
        const originalMsg = messages.find(m => m.id === activeMessageId);
        if (originalMsg) {
            if (originalMsg.type === 'rescue_alert' && originalMsg.rescueOwnerId) {
                composeMode = 'rescue-response';
                form.dataset.mode = 'rescue-response';
                form.dataset.rescueId = originalMsg.rescueId || '';
                form.dataset.rescueOwnerId = originalMsg.rescueOwnerId;
                form.dataset.parentId = originalMsgId;
                let ownerUser = usersData.find(u => u.id === String(originalMsg.rescueOwnerId));
                if (!ownerUser) ownerUser = usersData.find(u => u.id === '1');
                if (ownerUser) addRecipient(ownerUser);
                parentIdInput.value = originalMsgId;

                recipientGroup?.classList.add('disabled');
                inputField.disabled = true;
                addAllBtn.disabled = true;
                subjectGroup.classList.remove('hidden');
                subjectInput.value = `Réponse Sauvetage - ${originalMsg.subject || 'Urgent'}`;
                subjectInput.readOnly = true;
                anonymousCheckbox.checked = false;
                anonymousCheckbox.disabled = true;
                anonymousLabel.style.opacity = 0.5;
            } else {
                if (originalMsg.senderName === 'Anonyme' || originalMsg.senderId === 'anon') {
                    await showModal("Erreur : Tu ne peux pas répondre à un message Anonyme !");
                    renderMessageDetail(activeMessageId);
                    return;
                }

                let recipientUser = usersData.find(u => u.id === String(originalMsg.senderId));
                if (!recipientUser) recipientUser = usersData.find(u => u.id === '1');

                if (recipientUser) addRecipient(recipientUser);
                parentIdInput.value = originalMsgId;

                recipientGroup?.classList.add('disabled');
                inputField.disabled = true;
                addAllBtn.disabled = true;
                subjectGroup.classList.add('hidden');
                subjectInput.value = `RE: ${originalMsg.subject}`;
                subjectInput.readOnly = true;
                anonymousCheckbox.checked = false;
                anonymousCheckbox.disabled = true;
                anonymousLabel.style.opacity = 0.5;
            }
        }
    } else {
        parentIdInput.value = '';
        recipientGroup?.classList.remove('disabled');
        inputField.disabled = false;
        addAllBtn.disabled = false;
        subjectGroup.classList.remove('hidden');
        subjectInput.value = '';
        subjectInput.readOnly = false;
        anonymousCheckbox.disabled = false;
        anonymousLabel.style.opacity = 1;
    }

    updateRecipientTags();
    showScreen('compose');
}

// ==================================================================
// 🚨 GESTION DE L'ENVOI AVEC PJ EN BASE64 🚨
// ==================================================================

async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ name: file.name, size: file.size, data: reader.result });
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function handleMessageSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const mode = form.dataset.mode || 'standard';

    const recipientIds = selectedRecipients.map(u => u.id);
    if (!MY_USER_ID) { await showModal("ERREUR : ID utilisateur manquant."); return; }
    if (recipientIds.length === 0) { await showModal("Attention, tu dois sélectionner au moins un destinataire !"); return; }
    const subject =
        formData.get('subject') ||
        document.getElementById('message-subject')?.value ||
        '(Sans sujet)';

    if (!subject.trim()) {
        await showModal("Échec de l'envoi : champ 'subject' vide.");
        return;
    }

    const attachmentsData = await Promise.all(attachedFiles.map(fileToBase64));

    if (mode === 'rescue-response') {
        await submitRescueResponse(form, formData, attachmentsData);
        return;
    }

    const payload = {
        senderId: MY_USER_ID,
        recipientIds: recipientIds,
        subject: subject,
        body: formData.get('body'),
        isAnonymous: formData.get('isAnonymous') === 'on',
        parentMessageId: formData.get('parentMessageId') || null,
        attachments: attachmentsData
    };

    console.log("[LOG] (MESS) : Envoi du message avec payload:", payload);

    try {
        const response = await fetch('/api/messagerie/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (response.ok && result.success) {
            await showModal(`Message envoyé avec succès !`);
            form.reset();
            selectedRecipients = [];
            attachedFiles = [];
            updateRecipientTags();
            updateFileButtonText();
            hideMainContent();
            showScreen('welcome');
            await fetchMessages();
        } else {
            await showModal(`Échec de l'envoi : ${result.message || 'Erreur inconnue serveur.'}`);
        }
    } catch (error) {
        console.error('ERREUR FATALE LORS DE L\'ENVOI:', error);
        await showModal(`Erreur réseau ou serveur lors de l'envoi. ${error.message}`);
    }
}

async function submitRescueResponse(form, formData, attachmentsData) {
    const rescueId = form.dataset.rescueId || '';
    const parentMessageId = form.dataset.parentId || '';
    if (!rescueId) {
        await showModal('Sauvetage introuvable.');
        return;
    }
    const payload = {
        rescueId,
        senderId: MY_USER_ID,
        senderUsername: MY_USERNAME,
        body: formData.get('body'),
        subject: formData.get('subject'),
        attachments: attachmentsData,
        parentMessageId
    };

    try {
        const response = await fetch('/api/messagerie/rescue/respond', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (response.ok && result.success) {
            await showModal('Réponse de sauvetage envoyée !');
            form.reset();
            selectedRecipients = [];
            attachedFiles = [];
            updateRecipientTags();
            updateFileButtonText();
            composeMode = 'standard';
            form.dataset.mode = 'standard';
            form.dataset.rescueId = '';
            form.dataset.parentId = '';
            hideMainContent();
            showScreen('welcome');
            await fetchMessages();
        } else {
            await showModal(`Échec de la réponse : ${result.message || 'Erreur inconnue serveur.'}`);
        }
    } catch (error) {
        console.error('ERREUR SAUVETAGE RÉPONSE:', error);
        await showModal(`Erreur réseau/serveur pendant la réponse. ${error.message}`);
    }
}

function handleFileSelection(e) {
    const files = e.target.files;
    if (files.length > 0) {
        attachedFiles = Array.from(files);
        updateFileButtonText();
        console.log(`[LOG] (MESS): ${attachedFiles.length} fichiers sélectionnés.`);
    }
}

async function handleRescueRequestSubmit(e) {
    e.preventDefault();
    if (!MY_USER_ID || !MY_USERNAME) {
        await showModal('ID utilisateur manquant, reconnecte-toi.');
        return;
    }
    const subject = (document.getElementById('rescue-subject')?.value || '').trim();
    const body = (document.getElementById('rescue-body')?.value || '').trim();
    if (!body) {
        await showModal('Explique ce qui te manque avant d\'envoyer.');
        return;
    }

    const payload = {
        senderId: MY_USER_ID,
        senderUsername: MY_USERNAME,
        subject: subject || 'Demande de cours',
        body
    };

    try {
        const response = await fetch('/api/messagerie/rescue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (response.ok && result.success) {
            await showModal(`Sauvetage lancé ! ${result.notified || 0} élèves sollicités.`);
            e.target.reset();
            composeMode = 'standard';
            hideMainContent();
            showScreen('welcome');
            await fetchMessages();
        } else {
            await showModal(`Échec du sauvetage : ${result.message || 'Erreur serveur.'}`);
        }
    } catch (error) {
        console.error('ERREUR SAUVETAGE DEMANDE:', error);
        await showModal(`Erreur réseau/serveur pendant le sauvetage. ${error.message}`);
    }
}

// ==================================================================
// 🚨 INITIALISATION PRINCIPALE 🚨
// ==================================================================

window.initMessageriePage = async () => {
    const realName = (window.currentUsername || localStorage.getItem('source_username') || "NOM_DEFAUT_USER").trim();
    MY_USERNAME = realName;
    const wanted = normalizeNameKey(MY_USERNAME);
    const wantedLoose = normalizeNameKeyLoose(MY_USERNAME);

    // 1) Match exact (ancien comportement)
    let currentUserEntry = usersData.find(u => normalizeNameKey(u.name) === wanted);

    // 2) Match tolérant: si le username contient prénom+nom (ex: "Even HENRI")
    if (!currentUserEntry && wantedLoose) {
        currentUserEntry = usersData.find(u => {
            const key = normalizeNameKeyLoose(u.name);
            if (!key) return false;
            return wantedLoose === key || wantedLoose.startsWith(key + ' ') || (' ' + wantedLoose + ' ').includes(' ' + key + ' ');
        });
    }

    // 3) Match préfixe (pseudos): "EvenPS" => "Even"
    if (!currentUserEntry && wantedLoose) {
        let best = null;
        let bestLen = 0;
        usersData.forEach(u => {
            if (!u || u.id === '1' || u.id === '2') return;
            const key = normalizeNameKeyLoose(u.name);
            if (!key) return;
            // On accepte un match par préfixe sans espace (ex: evenps startsWith even)
            if (wantedLoose.startsWith(key) && key.length > bestLen) {
                best = u;
                bestLen = key.length;
            }
        });
        if (best) currentUserEntry = best;
    }

    MY_USER_ID = currentUserEntry ? currentUserEntry.id : null;

    // Fallbacks: certains comptes utilisent des libellés variables.
    if (!MY_USER_ID) {
        if (wanted.includes('source admin')) MY_USER_ID = '2';
        else if (wanted.includes('source ai') || wanted.includes('bot')) MY_USER_ID = '1';
    }

    if (!MY_USER_ID) {
        console.error("ERREUR : ID utilisateur non valide. Messagerie désactivée.");
        const target = document.querySelector('.message-section') || document.getElementById('messaging-welcome-screen') || document.getElementById('message-list-inbox');
        if (target) target.innerHTML = '<p class="error-msg">Erreur : Connexion non reconnue.</p>';
        return;
    }

    await fetchMessages();

    // Focus depuis Accueil (clic sur widget)
    try {
        const raw = sessionStorage.getItem('alpha_messagerie_focus');
        if (raw) {
            sessionStorage.removeItem('alpha_messagerie_focus');
            const focus = JSON.parse(raw);
            const id = focus && focus.messageId ? String(focus.messageId) : '';
            if (id && Array.isArray(messages) && messages.some(m => String(m.id) === id)) {
                renderMessageDetail(id);
            }
        }
    } catch { }

    let fileInput = document.getElementById('file-attachment-input');
    if (!fileInput) {
        fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.id = 'file-attachment-input';
        fileInput.name = 'attachments';
        fileInput.multiple = true;
        fileInput.classList.add('hidden');
        document.getElementById('send-message-form')?.appendChild(fileInput);
    }
    fileInput.removeEventListener('change', handleFileSelection);
    fileInput.addEventListener('change', handleFileSelection);

    document.getElementById('compose-message-btn')?.addEventListener('click', () => showComposeForm(false));
    document.getElementById('rescue-message-btn')?.addEventListener('click', showRescueForm);
    document.getElementById('reply-to-message-btn')?.addEventListener('click', () => {
        if (activeMessageId) showComposeForm(true, activeMessageId);
    });
    document.getElementById('send-message-form')?.addEventListener('submit', handleMessageSubmit);
    document.getElementById('attach-file-btn')?.addEventListener('click', () => { fileInput?.click(); });
    document.getElementById('rescue-message-form')?.addEventListener('submit', handleRescueRequestSubmit);
    document.getElementById('cancel-rescue-btn')?.addEventListener('click', () => {
        hideMainContent();
        showScreen('welcome');
    });

    document.getElementById('message-list-inbox')?.addEventListener('click', (e) => {
        const item = e.target.closest('.message-item');
        if (item) renderMessageDetail(item.getAttribute('data-message-id'));
    });

    // --- GESTION DES ONGLETS (Messagerie / ED) ---
    const tabBtns = document.querySelectorAll('.mess-tab-btn');
    // Mode Single View : on réutilise les mêmes conteneurs
    let currentMessMode = 'internal'; // 'internal' | 'ed'

    function switchMessTab(targetId) {
        // targetId correspond au dataset du bouton (ex: 'ed-wrapper'), mais on s'en sert juste pour le mode
        const newMode = (targetId === 'ed-wrapper') ? 'ed' : 'internal';

        tabBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.target === targetId);
        });

        // 1. Nettoyer la vue actuelle
        const listContainer = document.getElementById('message-list-inbox');
        if (listContainer) listContainer.innerHTML = '';
        const detailView = document.getElementById('message-detail-view');
        if (detailView) detailView.classList.add('hidden');
        document.getElementById('messaging-welcome-screen')?.classList.remove('hidden');

        // 2. Gérer la visibilité des boutons spécifiques
        const internalActions = document.getElementById('compose-actions');
        if (internalActions) internalActions.style.display = (newMode === 'internal') ? 'flex' : 'none';

        // 3. Changer le mode et charger le contenu
        currentMessMode = newMode;
        if (newMode === 'ed') {
            // Afficher immédiatement si déjà chargé, sinon fetch
            if (edMessages && edMessages.length > 0) {
                renderEDMessageList();
            } else {
                fetchEDMessages(true); // true = visible loading
            }
        } else {
            fetchMessages();
        }
    }

    // --- LOGIQUE ECOLE DIRECTE (ED) ---
    const ED_API_URL = '/ed'; // Relatif
    let edMessages = [];
    let edLoading = false;

    // Fonction de récupération (peut être appelée en background au chargement)
    async function fetchEDMessages(isVisible = false) {
        if (edLoading) return;
        edLoading = true;

        const listContainer = document.getElementById('message-list-inbox');
        if (isVisible && listContainer) {
            listContainer.innerHTML = '<p style="padding:10px; color:#aaa;">Chargement Ecole Directe...</p>';
        }

        try {
            // Utilisation de la route proxy intégrée
            // Récupérer l'utilisateur courant du site (stocké en localStorage)
            const siteUser = (localStorage.getItem('source_username') || '').trim();
            if (!siteUser) {
                if (isVisible && listContainer) listContainer.innerHTML = `<p style="padding:10px; color:#ff5555;">Non connecté ED.<br><small>Connectez-vous à votre compte AlphaSource (en haut à droite) pour activer le Cartable.</small></p>`;
                return;
            }

            const headers = { 'x-alpha-user': siteUser };
            const msgResp = await fetch('/ed/messages', { headers });

            if (msgResp.status === 401) {
                if (isVisible && listContainer) listContainer.innerHTML = `<p style="padding:10px; color:#ff5555;">Non connecté ED.<br><small>Passez par l'onglet Notes pour vous connecter.</small></p>`;
                return;
            }

            const msgData = await msgResp.json();
            if (msgData.messages) {
                edMessages = msgData.messages;
                // Si l'utilisateur est toujours sur l'onglet ED, on affiche
                if (currentMessMode === 'ed') renderEDMessageList();
            } else {
                if (isVisible && listContainer) listContainer.innerHTML = '<p style="padding:10px; color:#aaa;">Erreur format.</p>';
            }

        } catch (error) {
            console.error("ED Fetch Error:", error);
            if (isVisible && listContainer) {
                listContainer.innerHTML = `<div style="padding:15px; color:#ff7b7b;">
                    <p>Erreur récupération.</p>
                    <small>${error.message}</small>
                    <br><button id="retry-ed-btn" class="action-button secondary small mt-10">Réessayer</button>
                </div>`;
                document.getElementById('retry-ed-btn')?.addEventListener('click', () => fetchEDMessages(true));
            }
        } finally {
            edLoading = false;
        }
    }

    // Préchargement au démarrage (background)
    setTimeout(() => {
        fetchEDMessages(false);
    }, 1000);

    function renderEDMessageList() {
        const listContainer = document.getElementById('message-list-inbox');
        // Sécurité : on n'affiche que si on est bien en mode ED
        if (!listContainer || currentMessMode !== 'ed') return;

        listContainer.innerHTML = '';

        if (!edMessages || edMessages.length === 0) {
            listContainer.innerHTML = '<p style="padding:15px; text-align:center; color:#666;">Aucun message Ecole Directe.</p>';
            return;
        }

        edMessages.forEach(msg => {
            const item = document.createElement('div');
            item.className = 'message-item';
            item.setAttribute('data-message-id', msg.id);
            item.style.borderLeft = '4px solid #4d7cff';

            // Gestion Lu/Non lu
            // L'API renvoie souvent 'read': boolean
            if (msg.read === false || (msg.summary && msg.summary.read === false)) {
                item.classList.add('unread');
                item.style.backgroundColor = '#2a2a35';
            }
            if (String(msg.id) === String(activeMessageId)) item.classList.add('active');

            const expediteur = (msg.from && (msg.from.prenom || msg.from.nom))
                ? `${msg.from.prenom || ''} ${msg.from.nom || ''}`.trim()
                : (msg.summary && msg.summary.expediteur) || 'Inconnu';

            const subject = msg.subject || (msg.summary && msg.summary.subject) || '(Sans objet)';
            const dateStr = msg.date || (msg.summary && msg.summary.date) || '';

            let displayDate = dateStr;
            try {
                if (dateStr) {
                    const d = new Date(dateStr);
                    if (!isNaN(d.getTime())) {
                        displayDate = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
                    }
                }
            } catch (e) { }

            item.innerHTML = `
                <span class="message-sender-preview" style="color:white;">${expediteur}</span>
                <span class="message-subject-preview" style="color:#aaa;">${subject}</span>
                <span class="message-date">${displayDate}</span>
            `;

            item.onclick = () => {
                activeMessageId = msg.id;
                // Update selection visual
                const allItems = listContainer.querySelectorAll('.message-item');
                allItems.forEach(el => el.classList.remove('active'));
                item.classList.add('active');
                renderEDMessageDetail(msg);
            };
            listContainer.appendChild(item);
        });
    }

    function renderEDMessageDetail(msg) {
        showScreen('detail');
        // Masquer les éléments spécifiques Interne
        const badge = document.getElementById('detail-urgent-badge');
        if (badge) badge.style.display = 'none';
        const readP = document.getElementById('detail-readby');
        if (readP) readP.style.display = 'none';
        const unreadP = document.getElementById('detail-unreadby');
        if (unreadP) unreadP.style.display = 'none';
        const rescuePanel = document.getElementById('rescue-actions');
        if (rescuePanel) rescuePanel.classList.add('hidden');
        const replyBtn = document.getElementById('reply-to-message-btn');
        if (replyBtn) replyBtn.style.display = 'none';

        const subjectEl = document.getElementById('detail-subject');
        if (subjectEl) subjectEl.textContent = msg.subject || '(Sans objet)';

        const expediteur = (msg.from && (msg.from.prenom || msg.from.nom))
            ? `${msg.from.prenom || ''} ${msg.from.nom || ''}`.trim()
            : (msg.summary && msg.summary.expediteur) || 'Inconnu';

        const senderNameEl = document.querySelector('#detail-sender .sender-name-detail');
        if (senderNameEl) senderNameEl.textContent = expediteur;

        const bodyContainer = document.getElementById('detail-body-content');
        if (bodyContainer) {
            let content = msg.content || (msg.summary && msg.summary.content) || '';

            // Tentative de décodage Base64 sommaire
            if (content && /^[A-Za-z0-9+/=]+$/.test(content.replace(/\s/g, ''))) {
                try {
                    content = atob(content);
                    content = new TextDecoder('utf-8').decode(new Uint8Array([...content].map(c => c.charCodeAt(0))));
                } catch (e) { }
            }
            bodyContainer.innerHTML = content;
        }

        const attachmentsContainer = document.getElementById('detail-attachments');
        if (attachmentsContainer) {
            attachmentsContainer.innerHTML = '';
            if (msg.files && msg.files.length > 0) {
                const title = document.createElement('h2');
                title.textContent = 'Pièces Jointes :';
                attachmentsContainer.appendChild(title);
                msg.files.forEach(f => {
                    const link = document.createElement('a');
                    link.href = `/ed/messages/${msg.id}/files/${f.id}`;
                    link.target = '_blank';
                    link.textContent = `📎 ${f.libelle}`;
                    const p = document.createElement('p');
                    p.appendChild(link);
                    attachmentsContainer.appendChild(p);
                });
            }
        }
    }

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.target;
            if (target) switchMessTab(target);
        });
    });

    // Clic sur un ID de cours dans le message (pill)
    const detailBody = document.getElementById('detail-body-content');
    if (detailBody && detailBody.dataset.courseLinkListener !== 'true') {
        detailBody.dataset.courseLinkListener = 'true';
        detailBody.addEventListener('click', (e) => {
            const pill = e.target.closest('.course-id-pill');
            if (!pill) return;
            const courseId = pill.getAttribute('data-course-id');
            if (!courseId) return;
            e.preventDefault();
            e.stopPropagation();
            navigateToCourseById(courseId);
        });
    }

    const inputField = document.getElementById('recipient-input-field');
    inputField?.addEventListener('input', (e) => renderAutocomplete(e.target.value));
    document.getElementById('add-all-class-btn')?.addEventListener('click', addAllClass);
    document.getElementById('recipient-input-container')?.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-tag-btn')) removeRecipient(e.target.getAttribute('data-user-id'));
    });
    document.getElementById('send-message-form')?.addEventListener('reset', (e) => {
        selectedRecipients = [];
        attachedFiles = [];
        updateFileButtonText();
        updateRecipientTags();
        activeMessageId = null;
        composeMode = 'standard';
        renderMessageList();
        hideMainContent();
        showScreen('welcome');
    });

    // Bouton retour mobile
    document.getElementById('mobile-message-close-btn')?.addEventListener('click', () => {
        hideMainContent();
        showScreen('welcome');
        if (currentMessMode === 'ed') {
            renderEDMessageList();
        } else {
            renderMessageList();
        }
    });

    showScreen('welcome');
};