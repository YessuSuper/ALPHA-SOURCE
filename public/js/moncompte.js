// moncompte.js - Gestion de la page Mon Compte

// Fonction d'initialisation appelée depuis script.js quand la page se charge
function initMonComptePage() {
    console.log('Mon Compte - Initialisation');

    // Charger les informations utilisateur
    loadUserInfo();

    // Initialiser le modal des infos du compte
    initAccountInfoModal();

    // Éléments du DOM
    const changeAvatarBtn = document.getElementById('change-avatar-btn');
    const avatarModal = document.getElementById('avatar-modal');
    const closeModalBtn = avatarModal.querySelector('.close-modal-btn');
    const selectAvatarBtn = document.getElementById('select-avatar-btn');
    const validateAvatarBtn = document.getElementById('validate-avatar-btn');
    const avatarFileInput = document.getElementById('avatar-file-input');
    const avatarPreview = document.getElementById('avatar-preview');

    // Variable pour stocker le fichier sélectionné
    let selectedFile = null;

    // Gestionnaire pour ouvrir le modal avatar
    if (changeAvatarBtn) {
        changeAvatarBtn.addEventListener('click', function() {
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
        avatarFileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                // Vérifier que c'est une image
                if (!file.type.startsWith('image/')) {
                    alert('Veuillez sélectionner une image valide.');
                    return;
                }

                // Vérifier la taille (max 5MB)
                if (file.size > 5 * 1024 * 1024) {
                    alert('L\'image ne doit pas dépasser 5MB.');
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
                alert('Veuillez d\'abord sélectionner une photo.');
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
                    alert('Photo de profil mise à jour avec succès !');
                    avatarModal.classList.remove('active');

                    // Recharger la photo de profil dans la page
                    loadUserAvatar();

                    // Mettre à jour le cache des avatars dans toutes les pages
                    if (window.updateAvatarsCache) {
                        window.updateAvatarsCache({ [username]: result.avatarPath });
                    }

                    // Reset
                    selectedFile = null;
                    avatarFileInput.value = '';

                } else {
                    alert('Erreur lors de la mise à jour: ' + result.message);
                }

            } catch (error) {
                console.error('Erreur upload:', error);
                alert('Erreur réseau lors de l\'upload.');
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
        logoutButton.addEventListener('click', function() {
            if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
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
                alert('Veuillez remplir tous les champs.');
                return;
            }

            if (newPassword !== confirmPassword) {
                alert('Les mots de passe ne correspondent pas.');
                return;
            }

            if (newPassword.length < 3) {
                alert('Le mot de passe doit contenir au moins 3 caractères.');
                return;
            }

            // Désactiver le bouton pendant la requête
            validatePasswordBtn.disabled = true;
            validatePasswordBtn.textContent = 'Changement en cours...';

            try {
                const username = localStorage.getItem('source_username');
                if (!username) {
                    alert('Utilisateur non connecté.');
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
                    alert('Mot de passe changé avec succès !');
                    passwordModal.classList.remove('active');
                    // Reset des champs
                    document.getElementById('new-password').value = '';
                    document.getElementById('confirm-password').value = '';
                } else {
                    alert('Erreur: ' + result.message);
                }

            } catch (error) {
                console.error('Erreur:', error);
                alert('Erreur réseau lors du changement de mot de passe.');
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