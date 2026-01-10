// moncompte.js - Gestion de la page Mon Compte
console.log('moncompte.js est chargé!');

function getUserColorStorageKey(username) {
    return `AS_USER_COLOR_${username}`;
}

function applyHeaderColor(color) {
    const headerEl = document.getElementById('user-profile-header');
    if (!headerEl || !color) return;
    headerEl.style.background = color;
    headerEl.style.backgroundImage = 'none';

    // Forcer un rendu lisible (texte blanc + éclat noir) quel que soit le fond
    headerEl.style.setProperty('--header-text', '#ffffff');
    headerEl.style.setProperty('--header-muted', 'rgba(255,255,255,0.85)');
    headerEl.style.setProperty('--header-text-shadow', '0 0 2px rgba(0,0,0,0.95), 0 0 10px rgba(0,0,0,0.65), 0 2px 14px rgba(0,0,0,0.55)');
}

// Fonction d'initialisation appelée depuis script.js quand la page se charge
function initMonComptePage() {
    console.log('Mon Compte - Initialisation');
    console.log('=== INIT MONCOMPTE PAGE ===');

    // Charger les informations utilisateur
    loadUserInfo();

    // Initialiser le modal des infos du compte
    initAccountInfoModal();

    // Initialiser le modal des badges
    initBadgesModal();

    // Initialiser le modal de l'inventaire
    initInventoryModal();

    // Initialiser le modal de la boutique
    initShopModal();

    // Éléments du DOM
    // const changeAvatarBtn = document.getElementById('change-avatar-btn'); // Supprimé
    const userAvatarWrapper = document.getElementById('user-avatar-wrapper'); // Nouvelle cible (wrapper)
    const avatarModal = document.getElementById('avatar-modal');
    const closeModalBtn = avatarModal.querySelector('.close-modal-btn');
    const selectAvatarBtn = document.getElementById('select-avatar-btn');
    const validateAvatarBtn = document.getElementById('validate-avatar-btn');
    const avatarFileInput = document.getElementById('avatar-file-input');
    const avatarPreview = document.getElementById('avatar-preview');

    // Variable pour stocker le fichier sélectionné
    let selectedFile = null;

    // Gestionnaire pour ouvrir le modal avatar (au clic sur l'image de profil)
    if (userAvatarWrapper) {
        userAvatarWrapper.addEventListener('click', function() {
            // Recharger l'aperçu actuel avant d'ouvrir
            loadCurrentAvatarPreview();
            avatarModal.classList.add('active');
        });
    }

    // Gestionnaire pour fermer le modal
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', function() {
            avatarModal.classList.remove('active');
            // Reset du fichier sélectionné
            selectedFile = null;
            avatarFileInput.value = '';
            loadCurrentAvatarPreview();
        });
    }

    // Fermer le modal en cliquant sur l'overlay
    if (avatarModal) {
        avatarModal.addEventListener('click', function(e) {
            if (e.target === avatarModal) {
                avatarModal.classList.remove('active');
                // Reset du fichier sélectionné
                selectedFile = null;
                avatarFileInput.value = '';
                loadCurrentAvatarPreview();
            }
        });
    }

    // Gestionnaire pour le bouton "Sélectionner une photo"
    if (selectAvatarBtn) {
        selectAvatarBtn.addEventListener('click', function() {
            avatarFileInput.click();
        });
    }

    // Gestionnaire pour la sélection de fichier
    if (avatarFileInput) {
        avatarFileInput.addEventListener('change', async function(e) {
            const file = e.target.files[0];
            if (file) {
                // Vérifier que c'est une image
                if (!file.type.startsWith('image/')) {
                    await showModal('Veuillez sélectionner une image valide.');
                    return;
                }

                // Vérifier la taille (max 5MB)
                if (file.size > 5 * 1024 * 1024) {
                    await showModal('L\'image ne doit pas dépasser 5MB.');
                    return;
                }

                selectedFile = file;

                // Prévisualiser l'image sélectionnée
                const reader = new FileReader();
                reader.onload = function(e) {
                    avatarPreview.src = e.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Gestionnaire pour le bouton "Valider"
    if (validateAvatarBtn) {
        validateAvatarBtn.addEventListener('click', async function() {
            console.log('Bouton Valider cliqué');
            
            if (!selectedFile) {
                await showModal('Veuillez d\'abord sélectionner une photo.');
                return;
            }

            console.log('Fichier sélectionné:', selectedFile);

            // Désactiver le bouton pendant l'upload
            validateAvatarBtn.disabled = true;
            validateAvatarBtn.textContent = 'Upload en cours...';

            try {
                const username = localStorage.getItem('source_username') || 'testuser'; // Username de test
                console.log('Username utilisé:', username);

                // Créer FormData pour l'upload
                const formData = new FormData();
                formData.append('username', username);
                formData.append('avatar', selectedFile);

                console.log('Envoi de la requête...');

                // Envoyer au serveur
                const response = await fetch('/public/api/profile/upload-avatar', {
                    method: 'POST',
                    body: formData
                });

                console.log('Réponse brute:', response);
                console.log('Status:', response.status);
                console.log('StatusText:', response.statusText);
                console.log('Headers:', [...response.headers.entries()]);

                const result = await response.json();
                console.log('Résultat parsé:', result);

                if (result.success) {
                    await showModal('Photo de profil mise à jour avec succès !');
                    avatarModal.classList.remove('active');

                    // Recharger la photo de profil dans la page
                    loadUserAvatar();

                    // Mettre à jour le cache des avatars dans toutes les pages
                    if (window.updateAvatarsCache) {
                        window.updateAvatarsCache({ [username]: result.avatarPath });
                    }
                    
                    // Mettre à jour le cache des couleurs si une nouvelle couleur a été extraite
                    if (result.color && window.updateUsersColorsCache) {
                        window.updateUsersColorsCache({ [username]: result.color });
                    }

                    // Appliquer la nouvelle couleur au header si disponible
                    if (result.color) {
                        applyHeaderColor(result.color);
                        try {
                            localStorage.setItem(getUserColorStorageKey(username), result.color);
                        } catch (e) {
                            // ignore storage errors
                        }
                    }

                    // Reset
                    selectedFile = null;
                    avatarFileInput.value = '';

                } else {
                    await showModal('Erreur lors de la mise à jour: ' + result.message);
                }

            } catch (error) {
                console.error('Erreur upload:', error);
                await showModal('Erreur réseau lors de l\'upload.');
            } finally {
                // Réactiver le bouton
                validateAvatarBtn.disabled = false;
                validateAvatarBtn.textContent = 'Valider';
            }
        });
    }

    // Gestionnaire pour le bouton de déconnexion
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', async function() {
            if (await showModal('Êtes-vous sûr de vouloir vous déconnecter ?', { type: 'confirm' })) {
                if (window.logoutAndRedirect) {
                    window.logoutAndRedirect();
                } else {
                    console.error('Fonction logoutAndRedirect non trouvée');
                    // Fallback manuel
                    localStorage.removeItem('source_username');
                    window.location.href = '/pages/login.html';
                }
            }
        });
    }

    // Gestionnaire pour le bouton de déconnexion EcoleDirecte
    const logoutEdButton = document.getElementById('logout-ed-btn');
    if (logoutEdButton) {
        logoutEdButton.addEventListener('click', async function() {
            if (await showModal('Êtes-vous sûr de vouloir vous déconnecter d\'EcoleDirecte ?', { type: 'confirm' })) {
                try {
                    const siteUser = (localStorage.getItem('source_username') || '').trim().toLowerCase();
                    // Vide les caches Cartable (ils sont en localStorage)
                    try {
                        // Legacy
                        localStorage.removeItem('ED_NOTES');
                        localStorage.removeItem('ED_DEVOIRS');
                        localStorage.removeItem('ED_DEV_RANGE');
                        // Par user
                        if (siteUser) {
                            localStorage.removeItem('ED_NOTES:' + siteUser);
                            localStorage.removeItem('ED_DEVOIRS:' + siteUser);
                            localStorage.removeItem('ED_DEV_RANGE:' + siteUser);
                        }
                    } catch {}
                    
                    // Appelle la route de logout ED
                    const siteUserHeader = localStorage.getItem('source_username') || '';
                    await fetch('/ed/logout', {
                        method: 'GET',
                        headers: siteUserHeader ? { 'x-source-user': siteUserHeader } : undefined
                    });
                    
                    await showModal('Déconnecté d\'EcoleDirecte avec succès. Rechargez la page Cartable pour vous reconnecter.');
                } catch (error) {
                    console.error('Erreur lors de la déconnexion ED:', error);
                    await showModal('Erreur lors de la déconnexion');
                }
            }
        });
    }

    // Gestion du modal mot de passe
    const changePasswordBtn = document.getElementById('change-password-btn');
    const passwordModal = document.getElementById('password-modal');
    const passwordCloseModalBtn = passwordModal.querySelector('.close-modal-btn');
    const validatePasswordBtn = document.getElementById('validate-password-btn');

    // Gestionnaire pour ouvrir le modal mot de passe
    if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', function() {
            passwordModal.classList.add('active');
        });
    }

    // Gestionnaire pour fermer le modal mot de passe
    if (passwordCloseModalBtn) {
        passwordCloseModalBtn.addEventListener('click', function() {
            passwordModal.classList.remove('active');
        });
    }

    // Fermer le modal en cliquant sur l'overlay
    if (passwordModal) {
        passwordModal.addEventListener('click', function(e) {
            if (e.target === passwordModal) {
                passwordModal.classList.remove('active');
            }
        });
    }

    // Gestionnaire pour le bouton valider
    if (validatePasswordBtn) {
        validatePasswordBtn.addEventListener('click', async function() {
            const newPassword = document.getElementById('new-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;

            if (!newPassword || !confirmPassword) {
                await showModal('Veuillez remplir tous les champs.');
                return;
            }

            if (newPassword !== confirmPassword) {
                await showModal('Les mots de passe ne correspondent pas.');
                return;
            }

            if (newPassword.length < 3) {
                await showModal('Le mot de passe doit contenir au moins 3 caractères.');
                return;
            }

            // Désactiver le bouton pendant la requête
            validatePasswordBtn.disabled = true;
            validatePasswordBtn.textContent = 'Changement en cours...';

            try {
                const username = localStorage.getItem('source_username');
                if (!username) {
                    await showModal('Utilisateur non connecté.');
                    return;
                }

                const response = await fetch('/api/change-password', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        username: username,
                        newPassword: newPassword
                    })
                });

                const result = await response.json();

                if (result.success) {
                    await showModal('Mot de passe changé avec succès !');
                    passwordModal.classList.remove('active');
                    // Reset des champs
                    document.getElementById('new-password').value = '';
                    document.getElementById('confirm-password').value = '';
                } else {
                    await showModal('Erreur: ' + result.message);
                }

            } catch (error) {
                console.error('Erreur:', error);
                await showModal('Erreur réseau lors du changement de mot de passe.');
            } finally {
                // Réactiver le bouton
                validatePasswordBtn.disabled = false;
                validatePasswordBtn.textContent = 'Valider';
            }
        });
    }

    // Charger les informations utilisateur
    loadUserInfo();
}

// Fonction pour charger les informations utilisateur
function loadUserInfo() {
    // Charger le nom d'utilisateur depuis localStorage
    const userName = localStorage.getItem('source_username') || 'Utilisateur';
    const userNameElement = document.getElementById('user-name');
    if (userNameElement) {
        userNameElement.textContent = userName;
    }

    // Appliquer immédiatement la couleur en cache (persistance au rechargement)
    try {
        const cachedColor = localStorage.getItem(getUserColorStorageKey(userName));
        if (cachedColor) applyHeaderColor(cachedColor);
    } catch (e) {
        // ignore storage errors
    }

    // Charger la photo de profil
    loadUserAvatar();

    // Charger l'âge depuis le serveur
    loadUserAge();
}

// Fonction pour charger et calculer l'âge de l'utilisateur
async function loadUserAge() {
    try {
        const username = localStorage.getItem('source_username');
        if (!username) return;

        const response = await fetch(`/api/user-info/${username}`);
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.user.birth_date) {
                const birthDate = new Date(data.user.birth_date);
                const today = new Date();
                let age = today.getFullYear() - birthDate.getFullYear();
                const monthDiff = today.getMonth() - birthDate.getMonth();
                
                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                    age--;
                }
                
                const userAgeElement = document.getElementById('user-age');
                if (userAgeElement) {
                    userAgeElement.textContent = `${age} ans`;
                }
            }

            // Appliquer la couleur utilisateur au header
            const userColor = data?.user?.color;
            if (userColor) {
                applyHeaderColor(userColor);
                try {
                    localStorage.setItem(getUserColorStorageKey(username), userColor);
                } catch (e) {
                    // ignore storage errors
                }
            }

            // Afficher les badges actuels à côté du nom
            const badgesContainer = document.getElementById('user-current-badges');
            const badgesCurrent = data?.user?.badges_current;
            if (badgesContainer) {
                badgesContainer.innerHTML = '';
                if (Array.isArray(badgesCurrent) && badgesCurrent.length > 0) {
                    badgesCurrent.forEach((badgeId) => {
                        try {
                            const badgeIcons = (typeof BADGE_ICONS !== 'undefined')
                                ? BADGE_ICONS
                                : (window.BADGE_ICONS || null);
                            const badge = badgeIcons ? badgeIcons[badgeId] : null;
                            if (!badge) return;

                            if (badge.type === 'image') {
                                const img = document.createElement('img');
                                img.src = badge.src;
                                img.alt = badge.alt || badgeId;
                                img.className = 'user-badge-icon';
                                badgesContainer.appendChild(img);
                            } else if (badge.type === 'emoji') {
                                const span = document.createElement('span');
                                span.className = 'user-badge-emoji';
                                span.textContent = badge.emoji || '';
                                badgesContainer.appendChild(span);
                            }
                        } catch (e) {
                            // ignore badge render errors
                        }
                    });
                }
            }
        }
    } catch (error) {
        console.warn('Erreur chargement âge:', error);
    }
}

// Fonction pour charger la photo de profil de l'utilisateur
async function loadUserAvatar() {
    try {
        const username = localStorage.getItem('source_username');
        if (!username) return;

        // Charger pp.json pour trouver la photo de l'utilisateur
        const response = await fetch('/api/community/ressources/pp/pp.json');
        if (response.ok) {
            const ppData = await response.json();
            const avatarPath = ppData[username];

            if (avatarPath) {
                const avatarImg = document.getElementById('user-avatar');
                if (avatarImg) {
                    avatarImg.src = avatarPath;
                }
            }
        }
    } catch (error) {
        console.warn('Erreur chargement avatar:', error);
    }
}

// Fonction pour charger l'aperçu actuel dans le modal
async function loadCurrentAvatarPreview() {
    try {
        const username = localStorage.getItem('source_username');
        if (!username) return;

        const avatarPreview = document.getElementById('avatar-preview');
        if (!avatarPreview) return;

        // Charger pp.json pour trouver la photo actuelle
        const response = await fetch('/api/community/ressources/pp/pp.json');
        if (response.ok) {
            const ppData = await response.json();
            const avatarPath = ppData[username];

            if (avatarPath) {
                avatarPreview.src = avatarPath;
            } else {
                // Photo par défaut
                avatarPreview.src = '/ressources/user-icon.png';
            }
        } else {
            // Photo par défaut
            avatarPreview.src = '/ressources/user-icon.png';
        }
    } catch (error) {
        console.warn('Erreur chargement aperçu avatar:', error);
        // Photo par défaut
        const avatarPreview = document.getElementById('avatar-preview');
        if (avatarPreview) {
            avatarPreview.src = '/ressources/user-icon.png';
        }
    }
}

// Gestion du modal des informations du compte
async function initAccountInfoModal() {
    const accountInfoBtn = document.getElementById('account-info-btn');
    const accountInfoModal = document.getElementById('account-info-modal');
    const closeModalBtn = accountInfoModal.querySelector('.close-modal-btn');

    // Ouvrir le modal
    if (accountInfoBtn) {
        accountInfoBtn.addEventListener('click', async function() {
            await loadAccountInfo();
            accountInfoModal.classList.add('active');
        });
    }

    // Fermer le modal
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', function() {
            accountInfoModal.classList.remove('active');
        });
    }

    // Fermer le modal en cliquant sur l'overlay
    if (accountInfoModal) {
        accountInfoModal.addEventListener('click', function(e) {
            if (e.target === accountInfoModal) {
                accountInfoModal.classList.remove('active');
            }
        });
    }
}

// Charger et afficher les informations du compte
async function loadAccountInfo() {
    try {
        const username = localStorage.getItem('source_username');
        if (!username) return;

        const response = await fetch(`/api/user-info/${username}`);
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.user) {
                // Remplir les champs
                document.getElementById('info-username').textContent = data.user.username || 'N/A';
                document.getElementById('info-birthdate').textContent = data.user.birth_date || 'Non définie';
                document.getElementById('info-connexions').textContent = data.user.connexions || 0;
                
                // Formater la dernière connexion
                let lastConnexionText = 'Jamais';
                if (data.user.last_connexion) {
                    const date = new Date(data.user.last_connexion);
                    lastConnexionText = date.toLocaleString('fr-FR');
                }
                document.getElementById('info-last-connexion').textContent = lastConnexionText;

                // Charger le chemin de la photo depuis pp.json
                const ppResponse = await fetch('/api/community/ressources/pp/pp.json');
                if (ppResponse.ok) {
                    const ppData = await ppResponse.json();
                    const profilePicPath = ppData[username] || 'Aucune photo définie';
                    document.getElementById('info-profile-pic').textContent = profilePicPath;
                }
            }
        }
    } catch (error) {
        console.warn('Erreur chargement infos compte:', error);
    }
}

// Exposer la fonction globalement pour que script.js puisse l'appeler
window.initMonComptePage = initMonComptePage;

// ========================================================================
// --- Modal Badges ---
// ========================================================================

// Initialiser le modal badges
function initBadgesModal() {
    console.log('initBadgesModal - Initialisation');
    const badgesBtn = document.getElementById('badges-btn');
    const badgesModal = document.getElementById('badges-modal');
    const closeBtn = document.getElementById('close-badges-modal');

    console.log('badgesBtn:', badgesBtn);
    console.log('badgesModal:', badgesModal);
    console.log('closeBtn:', closeBtn);

    if (badgesBtn) {
        badgesBtn.addEventListener('click', async () => {
            console.log('Clic sur bouton badges!');
            await loadBadgesData();
            console.log('Adding active class to modal');
            badgesModal.classList.add('active');
            console.log('Modal classes:', badgesModal.className);
        });
    } else {
        console.error('badgesBtn introuvable!');
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            console.log('Clic sur fermer badges');
            badgesModal.classList.remove('active');
        });
    }

    if (badgesModal) {
        badgesModal.addEventListener('click', (e) => {
            if (e.target === badgesModal) {
                console.log('Clic sur overlay badges');
                badgesModal.classList.remove('active');
            }
        });
    }
}

// Charger les données de badges de l'utilisateur
async function loadBadgesData() {
    try {
        console.log('Chargement des données badges');
        const username = localStorage.getItem('source_username');
        console.log('Username:', username);
        if (!username) {
            console.error('Username non trouvé');
            return;
        }

        const response = await fetch(`/api/user-info/${username}`);
        console.log('Response status:', response.status);
        if (!response.ok) {
            console.error('Response not ok');
            return;
        }

        const data = await response.json();
        console.log('User data:', data);
        if (!data.success || !data.user) {
            console.error('Data not success or no user');
            return;
        }

        const badgesCurrent = data.user.badges_current || [];
        const badgesObtained = data.user.badges_obtained || [];

        console.log('badgesCurrent:', badgesCurrent);
        console.log('badgesObtained:', badgesObtained);

        // Afficher les badges actuels
        renderBadgesList('current-badges-list', badgesCurrent, badgesCurrent);

        // Afficher les badges obtenus (historique)
        renderBadgesList('obtained-badges-list', badgesObtained, badgesObtained);

        // Afficher tous les badges
        const allBadgeIds = Object.keys(BADGE_ICONS);
        renderBadgesList('all-badges-list', allBadgeIds, badgesObtained);

    } catch (error) {
        console.error('Erreur chargement badges:', error);
    }
}

// Afficher une liste de badges
function renderBadgesList(containerId, badgeIds, obtainedBadges) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';

    if (badgeIds.length === 0) {
        container.innerHTML = '<p class="no-badges-text">Aucun badge</p>';
        return;
    }

    badgeIds.forEach(badgeId => {
        const badge = BADGE_ICONS[badgeId];
        const badgeInfo = BADGE_DESCRIPTIONS[badgeId];
        if (!badge || !badgeInfo) return;

        const isObtained = obtainedBadges.includes(badgeId);
        const card = document.createElement('div');
        card.className = 'badge-card' + (badge.large ? ' large-badge' : '') + (!isObtained ? ' unobtained' : '');
        card.setAttribute('data-badge-id', badgeId);
        card.setAttribute('data-obtained', isObtained);

        // Afficher soit l'image soit l'emoji
        if (badge.type === 'image' && badge.src) {
            const img = document.createElement('img');
            img.src = badge.src;
            img.alt = badgeInfo.name;
            card.appendChild(img);
        } else if (badge.type === 'emoji') {
            const emoji = document.createElement('span');
            emoji.className = 'badge-emoji-large';
            emoji.textContent = badge.emoji;
            card.appendChild(emoji);
        }

        const name = document.createElement('p');
        name.className = 'badge-card-name';
        name.textContent = badgeInfo.name;
        card.appendChild(name);

        // Événement clic pour afficher le tooltip
        card.addEventListener('click', (e) => {
            showBadgeTooltip(e, badgeInfo, isObtained);
        });

        container.appendChild(card);
    });
}

// Afficher le tooltip
let tooltipTimeout = null;
function showBadgeTooltip(event, badgeInfo, isObtained) {
    const tooltip = document.getElementById('badge-tooltip-moncompte');
    if (!tooltip) return;

    if (tooltipTimeout) clearTimeout(tooltipTimeout);

    document.getElementById('badge-tooltip-name-moncompte').textContent = badgeInfo.name;
    document.getElementById('badge-tooltip-description-moncompte').textContent = badgeInfo.description;

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

    tooltipTimeout = setTimeout(() => {
        tooltip.style.opacity = '0';
        setTimeout(() => {
            tooltip.style.display = 'none';
        }, 300);
    }, 3000);
}

// Initialiser le modal de la boutique
function initShopModal() {
    console.log('initShopModal - Initialisation');
    const shopBtn = document.getElementById('shop-btn');
    const shopModal = document.getElementById('shop-modal');
    const closeBtn = document.getElementById('close-shop-modal');

    console.log('shopBtn:', shopBtn);
    console.log('shopModal:', shopModal);
    console.log('closeBtn:', closeBtn);

    if (shopBtn) {
        shopBtn.addEventListener('click', async () => {
            console.log('Clic sur bouton boutique!');
            await loadShopData();
            shopModal.classList.add('active');
            console.log('Modal classes:', shopModal.className);
        });
    } else {
        console.error('shopBtn introuvable!');
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            console.log('Clic sur fermer boutique');
            shopModal.classList.remove('active');
        });
    }

    if (shopModal) {
        shopModal.addEventListener('click', (e) => {
            if (e.target === shopModal) {
                console.log('Clic sur overlay boutique');
                shopModal.classList.remove('active');
            }
        });
    }

    // Gestionnaire pour les boutons d'achat
    shopModal.addEventListener('click', async (e) => {
        if (e.target.classList.contains('shop-buy-btn') && !e.target.classList.contains('purchased')) {
            const shopItem = e.target.closest('.shop-item');
            const itemId = shopItem.dataset.itemId;
            const itemPrice = parseInt(shopItem.dataset.itemPrice);
            const itemType = shopItem.dataset.itemType;
            
            await purchaseItem(itemId, itemPrice, itemType, e.target);
        }
    });
}

// Charger les données de la boutique
async function loadShopData() {
    try {
        console.log('Chargement des données boutique');
        const username = localStorage.getItem('source_username');
        console.log('Username:', username);
        
        if (!username) {
            console.error('Username non trouvé');
            return;
        }

        // Récupérer les informations utilisateur pour les points
        const response = await fetch(`/api/user-info/${username}`);
        if (!response.ok) {
            console.error('Erreur lors de la récupération des infos utilisateur');
            return;
        }

        const userData = await response.json();
        const userPoints = (userData && userData.user && userData.user.pt) || 0;
        
        // Afficher les points
        const pointsDisplay = document.getElementById('shop-user-points');
        if (pointsDisplay) {
            pointsDisplay.textContent = userPoints;
        }

        // Charger les items déjà achetés
        const purchasedItems = (userData && userData.user && userData.user.skins_obtenus) || [];
        console.log('Items achetés:', purchasedItems);

        // Marquer les items comme achetés dans l'interface
        purchasedItems.forEach(purchase => {
            const id = typeof purchase === 'string' ? purchase : purchase.itemId;
            const itemElement = document.querySelector(`[data-item-id="${id}"]`);
            if (itemElement) {
                const buyButton = itemElement.querySelector('.shop-buy-btn');
                if (buyButton) {
                    buyButton.textContent = 'Acheté';
                    buyButton.classList.add('purchased');
                }
            }
        });
        
    } catch (error) {
        console.error('Erreur lors du chargement de la boutique:', error);
    }
}

// Acheter un item
async function purchaseItem(itemId, price, type, buttonElement) {
    try {
        const username = localStorage.getItem('source_username');
        if (!username) {
            await showModal('Erreur: utilisateur non connecté');
            return;
        }

        // Confirmer l'achat
        const confirmPurchase = await showModal(`Voulez-vous acheter cet item pour ${price} points ?`, { type: 'confirm' });
        if (!confirmPurchase) {
            return;
        }

        // Appeler l'API pour effectuer l'achat
        const response = await fetch('/api/shop-purchase', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: username,
                itemId: itemId,
                price: price,
                type: type
            })
        });

        const result = await response.json();

        if (response.ok && result.success) {
            // Achat réussi
            await showModal(`✅ Achat réussi ! Il vous reste ${result.newPoints} points.`);
            
            // Mettre à jour l'affichage des points
            const pointsDisplay = document.getElementById('shop-user-points');
            if (pointsDisplay) {
                pointsDisplay.textContent = result.newPoints;
            }

            // Marquer le bouton comme acheté
            buttonElement.textContent = 'Acheté';
            buttonElement.classList.add('purchased');
            
            // Appliquer le thème du skin actif
            if (typeof window.applySkinTheme === 'function' && result.active_skin) {
                window.applySkinTheme(result.active_skin);
            }
            
        } else {
            // Achat échoué
            await showModal(`❌ ${result.message || 'Erreur lors de l\'achat'}`);
        }

    } catch (error) {
        console.error('Erreur lors de l\'achat:', error);
        await showModal('❌ Erreur lors de l\'achat. Veuillez réessayer.');
    }
}

// === INVENTAIRE ===
function initInventoryModal() {
    console.log('Initialisation de l\'inventaire');
    
    const inventoryBtn = document.getElementById('inventory-btn');
    const inventoryModal = document.getElementById('inventory-modal');
    const closeInventoryModalBtn = document.getElementById('close-inventory-modal');
    
    // Ouvrir le modal
    if (inventoryBtn) {
        inventoryBtn.addEventListener('click', function() {
            loadInventory();
            inventoryModal.classList.add('active');
        });
    }
    
    // Fermer le modal
    if (closeInventoryModalBtn) {
        closeInventoryModalBtn.addEventListener('click', function() {
            inventoryModal.classList.remove('active');
        });
    }
    
    // Fermer en cliquant sur l'overlay
    if (inventoryModal) {
        inventoryModal.addEventListener('click', function(e) {
            if (e.target === inventoryModal) {
                inventoryModal.classList.remove('active');
            }
        });
    }
}

function loadInventory() {
    console.log('Chargement de l\'inventaire');
    
    const skinsData = [
        { id: 'bleu basique', name: 'Bleu Basique', description: 'Thème classique et intemporel', price: 0 },
        { id: 'jaune basique', name: 'Jaune Basique', description: 'Chaleur ensoleillée et rayonnante', price: 0 },
        { id: 'skin-verdure', name: 'Verdure', description: 'Un thème naturel et apaisant', price: 28 },
        { id: 'skin-obsidienne', name: 'Obsidienne Royale', description: 'L\'élégance des profondeurs', price: 35 },
        { id: 'skin-sunset', name: 'Sunset Lofi', description: 'Ambiance crépusculaire relaxante', price: 40 },
        { id: 'skin-grenat', name: 'Grenat', description: 'Rouge profond et chaleureux', price: 26 },
        { id: 'skin-rose', name: 'Rose Pâle', description: 'Douceur et délicatesse', price: 30 },
        { id: 'skin-neon', name: 'Néon', description: 'Vivacité électrique et moderne', price: 38 },
        { id: 'skin-chocolat', name: 'Chocolat Velours', description: 'Douceur riche et enveloppante du chocolat pur', price: 24 },
        { id: 'skin-indigo', name: 'Rêve Indigo', description: 'Profondeur mystérieuse des rêves nocturnes', price: 36 },
        { id: 'skin-marbre', name: 'Marbre Anthracite', description: 'Élégance minimaliste et sophistiquée', price: 34 },
        { id: 'skin-aurore', name: 'Aurore Boréale', description: 'Magie fluorescente des lumières célestes', price: 45 }
    ];
    
    // Récupérer le username depuis localStorage
    const username = localStorage.getItem('source_username');
    if (!username) {
        console.error('Username non trouvé');
        return;
    }
    
    // Récupérer les données utilisateur
    fetch(`/api/user-info/${username}`)
        .then(response => response.json())
        .then(data => {
            if (!data.success || !data.user) {
                console.error('Erreur lors du chargement des données utilisateur');
                return;
            }
            
            const activeSkin = data.user.active_skin || 'bleu basique';
            const obtainedSkins = data.user.skins_obtenus || [];
            
            // Afficher le skin actuellement équipé
            const currentSkinCard = document.getElementById('current-skin-card');
            if (currentSkinCard) {
                currentSkinCard.innerHTML = '';
                
                let currentSkinName = 'Bleu Basique';
                let currentSkinId = 'bleu basique';
                
                const foundSkin = skinsData.find(s => s.id === activeSkin);
                if (foundSkin) {
                    currentSkinName = foundSkin.name;
                    currentSkinId = foundSkin.id;
                }
                
                currentSkinCard.innerHTML = `
                    <div class="inventory-item-icon">🍩</div>
                    <div class="inventory-item-info">
                        <p class="inventory-item-name">${currentSkinName}</p>
                        <p class="inventory-item-status">Actuellement équipé</p>
                    </div>
                `;
            }
            
            // Afficher les skins achetés
            const skinsGrid = document.getElementById('inventory-skins-grid');
            if (skinsGrid) {
                skinsGrid.innerHTML = '';
                
                // Afficher tous les skins obtenus (gratuits et achetés)
                skinsData.forEach(skin => {
                    if (obtainedSkins.includes(skin.id)) {
                        const isActive = activeSkin === skin.id;
                        const skinHTML = `
                            <div class="inventory-item ${isActive ? 'active' : ''}">
                                <div class="inventory-item-icon">🎨</div>
                                <p class="inventory-item-name">${skin.name}</p>
                                <button class="inventory-equip-btn ${isActive ? 'equipped' : ''}" 
                                        data-skin-id="${skin.id}">
                                    ${isActive ? '✓ Équipé' : 'Équiper'}
                                </button>
                            </div>
                        `;
                        skinsGrid.innerHTML += skinHTML;
                    }
                });
                
                // Ajouter les événements click aux boutons
                skinsGrid.querySelectorAll('.inventory-equip-btn').forEach(btn => {
                    console.log('🎨 [INVENTORY] Attachement event listener au bouton:', btn.dataset.skinId);
                    btn.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        const skinId = this.dataset.skinId;
                        console.log('🎨 [INVENTORY] Bouton cliqué pour skin:', skinId);
                        equipSkin(skinId);
                    });
                });
                console.log('🎨 [INVENTORY] Total de boutons trouvés:', skinsGrid.querySelectorAll('.inventory-equip-btn').length);
            }
        })
        .catch(error => console.error('Erreur lors du chargement de l\'inventaire:', error));
}

async function equipSkin(skinId) {
    console.log('🎨 [EQUIP] Équipement du skin:', skinId);
    
    // Récupérer le username depuis localStorage
    const username = localStorage.getItem('source_username');
    
    console.log('🎨 [EQUIP] Username:', username);
    
    if (!username) {
        console.error('❌ [EQUIP] Erreur: utilisateur non identifié');
        await showModal('❌ Erreur: utilisateur non identifié');
        return;
    }
    
    console.log('🎨 [EQUIP] Envoi de la requête avec:', { username, skinId });
    
    try {
        const response = await fetch('/api/equip-skin', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username: username, skinId: skinId })
        });

        console.log('🎨 [EQUIP] Réponse reçue:', response.status);
        const result = await response.json();
        console.log('🎨 [EQUIP] Résultat JSON:', result);
        
        if (result.success) {
            console.log('✅ [EQUIP] Skin équipé avec succès');
            
            // Recharger l'inventaire
            loadInventory();
            
            // Appliquer le thème
            if (typeof window.applySkinTheme === 'function') {
                console.log('🎨 [EQUIP] Application du thème:', skinId);
                window.applySkinTheme(skinId);
            } else {
                console.error('❌ [EQUIP] applySkinTheme non disponible');
            }
        } else {
            console.error('❌ [EQUIP] Erreur:', result.message);
            await showModal('❌ Erreur lors de l\'équipement du skin: ' + (result.message || 'Erreur inconnue'));
        }
    } catch (error) {
        console.error('❌ [EQUIP] Erreur de fetch:', error);
        await showModal('❌ Erreur lors de l\'équipement du skin. Veuillez réessayer.');
    }
}

// Exposer la fonction globalement
window.initMonComptePage = initMonComptePage;