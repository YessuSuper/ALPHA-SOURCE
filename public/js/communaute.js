// public/js/communaute.js
let activeChannelId = null;
let avatarsCache = {}; // Cache pour les avatars 

function initCommunityChat() {
    console.log("INIT communaute.js : Mode Navigation Active 🗿");

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
        mobileHamburgerBtn.addEventListener('click', function() {
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

    // Charger l'avatar de l'utilisateur actuel
    loadCurrentUserAvatar();

    const channelListContainer = document.getElementById('channel-list');
    const chatTitleElement = document.getElementById('chat-title');

    if (!channelListContainer) return;

    // Fonction pour charger les discussions
    function loadDiscussions() {
        fetch('/public/api/community/global.json')
            .then(response => response.json())
            .then(data => {
                renderDiscussions(data);
            })
            .catch(err => console.error('Erreur chargement discussions:', err));
    }

    // Fonction pour rendre les discussions dans la liste
    function renderDiscussions(data) {
        const channelList = document.getElementById('channel-list');
        if (!channelList) return;

        // Vider la liste actuelle
        channelList.innerHTML = '';

        // Ajouter les groupes
        data.groups.forEach(group => {
            const li = document.createElement('li');
            li.className = 'discussion-item group-item parent-channel';
            li.setAttribute('data-id', group.id);
            li.setAttribute('data-type', 'group');
            li.innerHTML = `
                <img class="channel-icon" src="ressources/communaute/grpicon.png" alt="Groupe Icon"> ${group.name}
            `;
            channelList.appendChild(li);
        });

        // Ajouter les sujets
        data.topics.forEach(topic => {
            const li = document.createElement('li');
            li.className = 'discussion-item topic-item parent-channel';
            li.setAttribute('data-id', topic.id);
            li.setAttribute('data-type', 'topic');
            li.innerHTML = `
                <img class="channel-icon" src="/ressources/communaute/sujeticon.png" alt="Topic Icon"> ${topic.name}
            `;
            channelList.appendChild(li);
        });

        // Ajouter les fills
        data.fills.forEach(fill => {
            const li = document.createElement('li');
            li.className = 'discussion-item fill-item child-channel';
            li.setAttribute('data-id', fill.id);
            li.setAttribute('data-type', 'fill');
            li.setAttribute('data-parent-type', fill.parentType);
            li.setAttribute('data-parent-id', fill.parentId);

            // Vérifier si l'utilisateur est membre du fill
            const isMember = fill.members && fill.members.includes(currentUsername);
            const memberClass = isMember ? 'member' : 'non-member';

            li.innerHTML = `
                <img class="discussion-icon" src="/ressources/communaute/fillicon.png" alt="Fill Icon"> # ${fill.name}
                <span class="duration">12h</span>
                ${!isMember ? '<button class="join-fill-btn" data-fill-id="' + fill.id + '">Rejoindre</button>' : ''}
            `;
            li.classList.add(memberClass);
            channelList.appendChild(li);
        });

        // Ajouter les MP (seulement ceux où l'utilisateur est participant)
        if (data.mps) {
            data.mps.forEach(mp => {
                // Vérifier si l'utilisateur actuel est participant à ce MP
                if (mp.participants && mp.participants.includes(currentUsername)) {
                    const li = document.createElement('li');
                    li.className = 'discussion-item mp-item';
                    li.setAttribute('data-id', mp.id);
                    li.setAttribute('data-type', 'mp');

                    // Afficher le nom de l'autre participant
                    const otherParticipant = mp.participants.find(p => p !== currentUsername);
                    li.innerHTML = `
                        <img class="discussion-icon" src="/ressources/communaute/mpicon.png" alt="MP Icon"> ${otherParticipant || 'Message privé'}
                    `;
                    channelList.appendChild(li);
                }
            });
        }

        // Activer le premier élément par défaut
        const first = channelList.querySelector('.discussion-item');
        if (first) {
            first.classList.add('active');
            activeChannelId = first.getAttribute('data-id') || null;
            const firstType = first.getAttribute('data-type');
            if (chatTitleElement) {
                const durationEl = first.querySelector('.duration');
                const durText = durationEl ? durationEl.textContent : '';
                const name = first.innerText.replace(durText, '').trim();
                chatTitleElement.textContent = name;
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
        const chatTitle = document.getElementById('chat-title');
        if (chatTitle) chatTitle.textContent = channelName;
        // charger messages (réutilise la fonction existante si définie)
        try { loadMessages(channelId, channelType); } catch (e) { console.warn('loadMessages non dispo', e); }
    }

    function closeMobileConversation() {
        document.body.classList.remove('community-mobile-chat-open');
        document.body.classList.add('community-sidebar-open');
    }

    // Attacher délégation d'événement pour ouvrir conversation au clic (mobile)
    if (channelListElem) {
        channelListElem.addEventListener('click', (e) => {
            const li = e.target.closest('.discussion-item');
            if (!li) return;
            const id = li.getAttribute('data-id');
            const type = li.getAttribute('data-type') || '';
            // Nom lisible
            const durationEl = li.querySelector('.duration');
            const durText = durationEl ? durationEl.textContent : '';
            const name = li.innerText.replace(durText, '').trim();

            // Sur petits écrans on ouvre en plein écran
            if (window.innerWidth <= 768) {
                openMobileConversation(id, name, type);
            } else {
                // Desktop: comportement existant - selectionner l'item
                const prev = channelListElem.querySelector('.discussion-item.active');
                if (prev) prev.classList.remove('active');
                li.classList.add('active');
                activeChannelId = id;
                try { loadMessages(id, type); } catch (e) { console.warn('loadMessages non dispo', e); }
            }
        });
    }

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

    // Fonction pour gérer les actions de création
    function handleCreateAction(action) {
        openCreateModal(action);
    }

    // Fonction pour ouvrir le modal de création
    function openCreateModal(action) {
        const modalOverlay = document.getElementById('create-modal-overlay');
        const modalTitle = document.getElementById('modal-title');
        const forms = document.querySelectorAll('.modal-form');

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

    // Fonction pour fermer le modal
    function closeCreateModal() {
        const modalOverlay = document.getElementById('create-modal-overlay');
        const forms = document.querySelectorAll('.modal-form');

        modalOverlay.style.display = 'none';
        forms.forEach(form => form.style.display = 'none');

        // Réinitialiser les formulaires
        forms.forEach(form => form.reset());
    }

    // Fonction pour charger les options de parent pour les fills
    function loadParentOptions() {
        const parentTypeSelect = document.getElementById('fill-parent-type');
        const parentIdSelect = document.getElementById('fill-parent-id');

        // Vider les options existantes
        parentIdSelect.innerHTML = '<option value="">Sélectionnez un parent</option>';

        const parentType = parentTypeSelect.value;

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
                            parentIdSelect.appendChild(option);
                        });
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
                            parentIdSelect.appendChild(option);
                        });
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
            const parentId = document.getElementById('fill-parent-id').value;

            if (!name || !parentId) return;

            fetch('/public/api/community/create-fill', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description, parentType, parentId, username: currentUsername })
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
    let allUsers = [];

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

    // Fonction pour rejoindre un fill
    function joinFill(fillId) {
        fetch('/public/api/community/join-fill', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fillId, username: currentUsername })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                console.log(`Rejoint le fill : ${fillId}`);
                loadDiscussions(); // Recharger la liste pour mettre à jour l'affichage
            } else {
                alert('Erreur rejoindre fill: ' + data.message);
            }
        })
        .catch(err => {
            console.error('Erreur rejoindre fill:', err);
            alert('Erreur serveur');
        });
    }

    channelListContainer.addEventListener('click', (e) => {
        // Gérer les boutons "Rejoindre" pour les fills
        if (e.target.classList.contains('join-fill-btn')) {
            e.stopPropagation(); // Empêcher la propagation pour éviter de sélectionner le fill
            const fillId = e.target.getAttribute('data-fill-id');
            joinFill(fillId);
            return;
        }

        // On cherche l'élément li le plus proche
        const item = e.target.closest('.discussion-item');
        
        if (item) {
            const id = item.getAttribute('data-id');
            const type = item.getAttribute('data-type');

            // 1. Reset de TOUS les items dans la liste
            document.querySelectorAll('#channel-list .discussion-item').forEach(el => {
                el.classList.remove('active');
                el.classList.remove('active-fill');
            });

            // 2. Activation de l'élément cliqué
            item.classList.add('active');
            if (type === 'fill') item.classList.add('active-fill');

            // 3. Maj Titre
            if (chatTitleElement) {
                const durationEl = item.querySelector('.duration');
                const durText = durationEl ? durationEl.textContent : '';
                const cleanName = item.innerText.replace(durText, '').trim();
                chatTitleElement.textContent = cleanName;
            }

            activeChannelId = id;
            console.log(`Sélection : ${id} en VERT 🗿`);

            // Charger les messages de la discussion sélectionnée
            loadMessages(id, type);

            // Gérer l'affichage de l'input de message
            toggleMessageInput(type);
        }
    });

    // Fonction pour activer/désactiver l'input de message selon le type de discussion
    function toggleMessageInput(discussionType) {
        const messageInput = document.getElementById('community-message-input');
        const sendButton = document.getElementById('send-community-message-btn');
        const inputArea = document.getElementById('message-input-area');

        if (discussionType === 'topic') {
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

        fetch(`/public/api/community/messages/${discussionId}/${discussionType}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    displayMessages(data.messages);
                } else {
                    console.error('Erreur chargement messages:', data.message);
                }
            })
            .catch(err => console.error('Erreur chargement messages:', err));
    }

    // Fonction pour afficher les messages
    function displayMessages(messages) {
        const messagesContainer = document.getElementById('messages-container');
        if (!messagesContainer) return;

        // Vider le conteneur
        messagesContainer.innerHTML = '';

        if (messages.length === 0) {
            messagesContainer.innerHTML = '<p class="placeholder-message">Aucun message dans cette discussion. Soyez le premier à écrire !</p>';
            return;
        }

        // Afficher chaque message
        messages.forEach(message => {
            const messageElement = document.createElement('div');
            const isOwnMessage = message.sender === currentUsername;
            messageElement.className = `message-item ${isOwnMessage ? 'own-message' : 'other-message'}`;

            // Formater l'heure
            const timestamp = new Date(message.timestamp);
            const timeString = timestamp.toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit'
            });

            if (isOwnMessage) {
                // Message de l'utilisateur actuel (à droite)
                let fileHtml = '';
                if (message.file) {
                    fileHtml = generateFileHtml(message.file);
                }
                let contentHtml = '';
                if (message.content && message.content.trim()) {
                    contentHtml = `<div class="message-content">${message.content}</div>`;
                }
                messageElement.innerHTML = `
                    ${fileHtml}
                    ${contentHtml}
                    <div class="message-time">${timeString}</div>
                `;
            } else {
                // Message des autres (à gauche)
                let fileHtml = '';
                if (message.file) {
                    fileHtml = generateFileHtml(message.file);
                }
                let contentHtml = '';
                if (message.content && message.content.trim()) {
                    contentHtml = `<div class="message-content">${message.content}</div>`;
                }
                messageElement.innerHTML = `
                    <div class="message-sender">
                        <img src="/ressources/user-icon.png" alt="Avatar" class="message-avatar" data-username="${message.sender}">
                        ${message.sender}
                    </div>
                    ${fileHtml}
                    ${contentHtml}
                    <div class="message-time">${timeString}</div>
                `;
            }

            messagesContainer.appendChild(messageElement);
        });

        // Scroll vers le bas après l'ajout de tous les messages
        setTimeout(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, 100);

        // Charger les avatars après l'affichage des messages
        loadMessageAvatars();
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
window.updateAvatarsCache = function(newPpData) {
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