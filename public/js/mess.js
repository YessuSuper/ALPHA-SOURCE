/* public/js/mess.js - Logique Front-end de la Messagerie (Version Email/Pro) */

// 🚨 VARIABLES ET DONNÉES 🚨

const classList = [
    'Even', 'Alexandre', 'Calixte', 'Noé', 'Julia', 'Joan', 'Juliette', 'Jezzy',
    'Inès', 'Timéo', 'Tyméo', 'Clautilde', 'Loanne', 'Lucie', 'Camille', 'Sofia',
    'Lilia', 'Amir', 'Robin', 'Arthur', 'Maxime', 'Gaultier', 'Antoine', 'Louis',
    'Anne-Victoria', 'Léa', 'Sarah', 'Ema', 'Jade', 'Alicia', 'Claire'
];

const CORE_USERS = [
    { id: '1', name: 'Source AI (Bot)' },
    { id: '2', name: 'Source Admin (Ancien ID Courant)' }, 
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
    [welcome, compose, detail].forEach(el => el?.classList.add('hidden'));
    if (screen === 'welcome') welcome?.classList.remove('hidden');
    else if (screen === 'compose') compose?.classList.remove('hidden');
    else if (screen === 'detail') detail?.classList.remove('hidden');
    
    if (screen !== 'welcome') {
        showMainContent();
    }
}

function renderMessageList() {
    const list = document.getElementById('message-list-inbox');
    if (!list) return;
    list.innerHTML = '';
    
    messages.sort((a, b) => b.id.localeCompare(a.id)); 
    
    const countElement = document.getElementById('message-count');
    if (countElement) countElement.textContent = `(${messages.length})`;
    
    messages.forEach(msg => {
        const item = document.createElement('div');
        item.classList.add('message-item');
        item.setAttribute('data-message-id', msg.id);
        if (msg.status === 'unread' || msg.unread) item.classList.add('unread');
        if (msg.id === activeMessageId) item.classList.add('active');
        if (msg.parentMessageId) item.classList.add('is-reply');
        
        const senderDisplay = msg.senderId === MY_USER_ID ? 'Moi' : msg.senderName;
        
        item.innerHTML = `
            <span class="message-sender-preview">${senderDisplay}</span>
            <span class="message-subject-preview">${msg.subject}</span>
            <span class="message-date">${msg.date}</span>
        `;
        list.appendChild(item);
    });
}

function renderMessageDetail(messageId) {
    const msg = messages.find(m => m.id === messageId);
    if (!msg) return;
    
    // Afficher le contenu principal sur mobile
    showMainContent();
    
    activeMessageId = messageId; 
    document.getElementById('detail-subject').textContent = msg.subject;
    
    const senderDisplay = msg.senderId === MY_USER_ID ? 'Moi' : msg.senderName;
    document.querySelector('#detail-sender .sender-name-detail').textContent = senderDisplay;
    
    document.querySelector('#detail-recipients .recipients-list-detail').textContent =
        Array.isArray(msg.recipients) ? msg.recipients.join(', ') : ''; 
    document.getElementById('detail-body-content').innerHTML = msg.body.replace(/\n/g, '<br>');
    
    const attachmentsContainer = document.getElementById('detail-attachments');
    if (!attachmentsContainer) {
        console.error("PUTAIN LOG (MESS): Conteneur 'detail-attachments' non trouvé dans le DOM.");
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

    msg.unread = false; 
    msg.status = 'read';

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

    renderMessageList(); 
    showScreen('detail');
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
        
        const recipientIds = Array.isArray(msg.recipients) ? msg.recipients.map(String) : [];
        const recipientNames = recipientIds
            .map(id => usersData.find(u => u.id === id)?.name)
            .filter(name => name); 
        
        const senderNameDisplay = (msg.isAnonymous || msg.senderId === 'anon') ? 'Anonyme' : (sender ? sender.name : 'Inconnu');
        
        return {
            ...msg,
            senderName: senderNameDisplay,
            recipients: recipientNames,
            date: dateDisplay,
            unread: msg.status === 'unread'
        };
    });
}

async function fetchMessages() {
    const endpoint = MY_USER_ID ? `/api/messagerie/messages?userId=${MY_USER_ID}` : '/api/messagerie/messages'; 
    console.log(`PUTAIN LOG (MESS) : Tentative de récupération des messages pour ID ${MY_USER_ID} depuis ${endpoint}...`);
    try {
        const response = await fetch(endpoint); 
        if (!response.ok) throw new Error(`Erreur HTTP! Statut: ${response.status}`);

        let rawMessages = await response.json();

        rawMessages = rawMessages.map(msg => ({
            ...msg,
            senderId: String(msg.senderId),
            recipients: Array.isArray(msg.recipients) ? msg.recipients.map(String) : []
        }));

        messages = processMessages(rawMessages);
        renderMessageList();

    } catch (error) {
        console.error('PUTAIN LOG (MESS) : Échec de la récupération des messages:', error);
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

function showComposeForm(isReply = false, originalMsgId = null) {
    const form = document.getElementById('send-message-form');
    if (!form) return;
    
    // Afficher le contenu principal sur mobile
    showMainContent();
    
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
            if (originalMsg.senderName === 'Anonyme' || originalMsg.senderId === 'anon') {
                alert("Putain! Tu ne peux pas répondre à un message Anonyme !");
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
    
    const recipientIds = selectedRecipients.map(u => u.id);
    if (!MY_USER_ID) { alert("PUTAIN ERREUR : ID utilisateur manquant."); return; }
    if (recipientIds.length === 0) { alert("Putain, tu dois sélectionner au moins un destinataire !"); return; }
    const subject =
        formData.get('subject') ||
        document.getElementById('message-subject')?.value ||
        '(Sans sujet)';

    if (!subject.trim()) {
        alert("PUTAIN ÉCHEC de l'envoi : champ 'subject' vide.");
        return;
    }

    const attachmentsData = await Promise.all(attachedFiles.map(fileToBase64));

    const payload = {
        senderId: MY_USER_ID,
        recipientIds: recipientIds,
        subject: subject,
        body: formData.get('body'),
        isAnonymous: formData.get('isAnonymous') === 'on',
        parentMessageId: formData.get('parentMessageId') || null,
        attachments: attachmentsData
    };

    console.log("PUTAIN LOG (MESS) : Envoi du message avec payload:", payload);
    
    try {
        const response = await fetch('/api/messagerie/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (response.ok && result.success) {
            alert(`Message envoyé avec succès !`);
            form.reset();
            selectedRecipients = [];
            attachedFiles = [];
            updateRecipientTags();
            updateFileButtonText();
            hideMainContent();
            showScreen('welcome');
            await fetchMessages();
        } else {
            alert(`PUTAIN ÉCHEC de l'envoi : ${result.message || 'Erreur inconnue serveur.'}`);
        }
    } catch (error) {
        console.error('ERREUR FATALE LORS DE L\'ENVOI:', error);
        alert(`RAHHH! Erreur réseau ou serveur lors de l'envoi. ${error.message}`);
    }
}

function handleFileSelection(e) {
    const files = e.target.files;
    if (files.length > 0) {
        attachedFiles = Array.from(files); 
        updateFileButtonText();
        console.log(`PUTAIN LOG (MESS): ${attachedFiles.length} fichiers sélectionnés.`);
    }
}

// ==================================================================
// 🚨 INITIALISATION PRINCIPALE 🚨
// ==================================================================

window.initMessageriePage = async () => { 
    const realName = (window.currentUsername || localStorage.getItem('source_username') || "NOM_DEFAUT_USER").trim();
    MY_USERNAME = realName;
    const currentUserEntry = usersData.find(u => u.name === MY_USERNAME);
    MY_USER_ID = currentUserEntry ? currentUserEntry.id : null;

    if (!MY_USER_ID) {
        console.error("PUTAIN : ID utilisateur non valide. Messagerie désactivée.");
        document.querySelector('.message-section').innerHTML = '<p class="error-msg">Putain! Connexion non reconnue.</p>';
        return;
    }

    await fetchMessages();

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
    document.getElementById('reply-to-message-btn')?.addEventListener('click', () => {
        if (activeMessageId) showComposeForm(true, activeMessageId);
    });
    document.getElementById('send-message-form')?.addEventListener('submit', handleMessageSubmit);
    document.getElementById('attach-file-btn')?.addEventListener('click', () => { fileInput?.click(); });
    
    document.getElementById('message-list-inbox')?.addEventListener('click', (e) => {
        const item = e.target.closest('.message-item');
        if (item) renderMessageDetail(item.getAttribute('data-message-id'));
    });
    
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
        renderMessageList();
        hideMainContent();
        showScreen('welcome');
    });

    // Bouton retour mobile
    document.getElementById('mobile-message-close-btn')?.addEventListener('click', () => {
        hideMainContent();
        showScreen('welcome');
        renderMessageList();
    });

    showScreen('welcome');
};