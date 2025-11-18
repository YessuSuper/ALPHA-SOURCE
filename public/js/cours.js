// public/js/cours.js (Version Finale SANS ERREURS D'INITIALISATION)

// Variables globales pour les éléments DOM
let fileGrid;
let courseCounterBox;
let depositModalOverlay;
let depositForm;

// 🚨 FIX : Déclaration des modales de détails ici pour la cohérence globale
let detailsModal; 
let detailsContent;
let detailsTitle;

// Variable pour stocker les cours récupérés du serveur
let coursesData = [];


// --- Logique d'affichage d'un seul cours (FIX du bouton détail) ---
function createCourseCard(course) {
    const card = document.createElement('div');
    card.classList.add('course-file-card');
    
    const fileUrl = course.filePath; 
    const extensionMatch = fileUrl.match(/\.([0-9a-z]+)(?=[?#])|(\.)([0-9a-z]+)$/i);
    const extension = extensionMatch ? extensionMatch[3] || extensionMatch[1] : 'file';

    const isImage = ['jpg', 'jpeg', 'png', 'gif'].includes(extension.toLowerCase());
    
    // --- 1. Contenu de l'aperçu ---
    let previewContent;
    if (isImage) {
        previewContent = `<img src="${fileUrl}" alt="Aperçu du fichier" class="file-image-preview">`;
    } else {
        previewContent = `
            <div class="no-image-placeholder">
                <p>📂 ${course.subject}</p>
                <p>Title: ${course.title}</p>
                <p>Type: .${extension.toUpperCase()}</p>
            </div>
        `;
    }
    
    // Conteneur principal de l'aperçu
    const previewArea = document.createElement('div');
    previewArea.classList.add('file-preview-area');
    previewArea.innerHTML = previewContent;
    card.appendChild(previewArea);

    // --- 2. Construction du bandeau d'info (Action overlay) ---
    const infoOverlay = document.createElement('div');
    infoOverlay.classList.add('file-info-overlay');
    
    const downloadFileName = `${course.title.replace(/[^a-zA-Z0-9]/g, '_')}.${extension}`;

    // Le HTML de l'overlay (titres et boutons)
    infoOverlay.innerHTML = `
        <div class="file-info-header">
            <span class="file-title">${course.title}</span>
            <span class="file-subject">${course.subject}</span>
        </div>
        <div class="file-actions">
            <button class="detail-button" id="detail-btn-${course.id}">DÉTAILS</button>
            <a href="${fileUrl}" download="${downloadFileName}" class="download-button">TÉLÉCHARGER</a>
        </div>
    `;
    
    // Ajout de l'overlay à la carte
    card.appendChild(infoOverlay); 

    // --- 3. Attacher l'événement au bouton après l'insertion dans la carte ---
    const detailButton = card.querySelector(`#detail-btn-${course.id}`);
    
    if (detailButton) {
        detailButton.onclick = (e) => {
            e.stopPropagation(); // Empêche le clic sur la carte de faire une action non désirée
            showCourseDetails(course);
        };
    } else {
        console.error(`BORDEL, bouton détail #${course.id} introuvable après création.`);
    }

    return card;
}


// --- FONCTION PRINCIPALE DE RENDU DES COURS ---
function displayCourses() {
    fileGrid = document.getElementById('file-grid');
    courseCounterBox = document.getElementById('course-counter-box');

    if (!fileGrid) return; 

    // 1. Mise à jour du compteur
    if (courseCounterBox) {
        courseCounterBox.textContent = `Cours : ${coursesData.length}`;
    }

    // 2. Rendu de la grille
    fileGrid.innerHTML = ''; 
    
    if (coursesData.length === 0) {
        fileGrid.innerHTML = '<p class="no-course-message">Aucun cours de disponible pour le moment. Dépêche-toi d\'en uploader !</p>';
        return;
    }

    coursesData.forEach(course => {
        fileGrid.appendChild(createCourseCard(course));
    });
}


// --- Fonction de Fetching des données ---
async function fetchCoursesAndDisplay() {
    try {
        const response = await fetch('/api/courses');
        if (response.ok) {
            coursesData = await response.json(); 
            displayCourses(); 
        } else {
            console.error("BORDEL, Impossible de récupérer la liste des cours.", response.statusText);
        }
    } catch (e) {
        console.error("Erreur réseau lors de la récupération des cours:", e);
    }
}


// --- Logique d'ouverture/fermeture de la Modale de Dépôt ---
function setupModalListeners() {
    depositModalOverlay = document.getElementById('deposit-modal');
    const openModalButton = document.getElementById('deposit-course-button');
    const closeModalButton = document.querySelector('.close-modal-btn');
    
    if (openModalButton && depositModalOverlay) {
        openModalButton.onclick = () => {
            depositModalOverlay.classList.add('active');
        };
    }
    
    if (closeModalButton) closeModalButton.onclick = () => depositModalOverlay.classList.remove('active');
    if (depositModalOverlay) depositModalOverlay.onclick = (event) => {
        if (event.target === depositModalOverlay) depositModalOverlay.classList.remove('active');
    };
}


// --- Logique de soumission du formulaire (AJAX) ---
function setupFormSubmission() {
    depositForm = document.getElementById('deposit-form'); 

    if (depositForm) {
        depositForm.onsubmit = async function(event) {
            event.preventDefault(); 
            
            const formData = new FormData(depositForm);
            
            const submitButton = document.getElementById('submit-deposit-btn');
            submitButton.textContent = "Chargement... (Zinzin)";
            submitButton.disabled = true;

            try {
                const response = await fetch('/api/deposit-course', {
                    method: 'POST',
                    body: formData 
                });

                if (response.ok) {
                    await response.json();
                    
                    await fetchCoursesAndDisplay(); 
                    
                    if (depositModalOverlay) depositModalOverlay.classList.remove('active');

                } else {
                    const error = await response.json();
                    alert(`"PUTAIN", Erreur de dépôt: ${error.message || response.statusText}`);
                }
            } catch (error) {
                console.error("Erreur de réseau ou de serveur:", error);
                alert('"GROS ZINZIN", Erreur de connexion au serveur.');
            } finally {
                submitButton.textContent = "Déposer le cours";
                submitButton.disabled = false;
                depositForm.reset();
            }
        };
    } else {
        console.error("BORDEL, le formulaire avec l'ID 'deposit-form' est introuvable !");
    }
}


// --- Gérer l'aperçu du fichier dans la Modale de Dépôt ---
function setupFilePreview() {
    const fileInput = document.getElementById('deposit-file-upload');
    const previewContainer = document.getElementById('file-preview-thumbnail');
    
    if (!fileInput || !previewContainer) return;

    fileInput.onchange = (event) => {
        const file = event.target.files[0];
        previewContainer.innerHTML = '';
        previewContainer.style.display = 'none';

        if (file) {
            document.querySelector('.file-status-text').textContent = `Fichier sélectionné : ${file.name}`;

            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    previewContainer.style.display = 'block';
                    previewContainer.innerHTML = `<img src="${e.target.result}" alt="Aperçu du fichier" style="width: 100%; height: auto; border-radius: 8px;">`;
                };
                reader.readAsDataURL(file);
            } else {
                previewContainer.style.display = 'block';
                previewContainer.innerHTML = `<p style="color: #bbb; text-align: center; padding: 10px;">Aperçu non disponible. Fichier : ${file.type}</p>`;
            }
        } else {
            document.querySelector('.file-status-text').textContent = "Aucun fichier sélectionné.";
        }
    };
}


// --- AFFICHAGE DES DÉTAILS DU COURS (Méthode 100% Locale et Sûre) ---
function showCourseDetails(course) {
    // 🚨 On utilise les variables globales initialisées dans initCoursPage 🚨
    if (!detailsModal || !detailsContent || !detailsTitle) {
        console.error("BORDEL! La modale ou ses éléments internes sont introuvables. Problème d'IDs HTML manquants.");
        // On ne fait rien si les éléments ne sont pas là.
        return; 
    }

    // --- À partir d'ici, on sait que les éléments existent ---
    
    // Formattage de la date 
    const uploadedDate = new Date(course.uploadedAt).toLocaleDateString('fr-FR', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    // Détermination du contenu de l'aperçu
    const extensionMatch = course.filePath.match(/\.([0-9a-z]+)$/i);
    const fileExtension = extensionMatch ? extensionMatch[1] : '';

    const isImage = ['jpg', 'jpeg', 'png', 'gif'].includes(fileExtension.toLowerCase());

    const previewHtml = isImage 
        ? `<img src="${course.filePath}" alt="Aperçu du fichier" style="max-width: 100%; max-height: 250px; display: block; margin: 15px auto; border-radius: 10px;">`
        : `<div style="background-color: #444; padding: 20px; text-align: center; border-radius: 10px;">Aperçu non disponible pour ce type de fichier (.${fileExtension}).</div>`;
    
    detailsTitle.textContent = course.title;

    const downloadFileName = `${course.title.replace(/[^a-zA-Z0-9]/g, '_')}.${fileExtension}`;

    detailsContent.innerHTML = `
        <div class="course-detail-group">
            <h3 style="color: var(--color-primary); margin-top: 0;">${course.subject}</h3>
            <p><strong>Déposé le :</strong> ${uploadedDate}</p>
            <p><strong>Description :</strong> ${course.description || '— Aucune description fournie —'}</p>
        </div>
        <hr style="border-color: #444; margin: 15px 0;">
        <h4>Aperçu du Fichier :</h4>
        ${previewHtml}
        <a href="${course.filePath}" download="${downloadFileName}" 
            style="display: block; text-align: center; background-color: var(--color-primary); color: white; padding: 10px; border-radius: 8px; text-decoration: none; margin-top: 20px;">
            TÉLÉCHARGER LE FICHIER COMPLET
        </a>
    `;

    detailsModal.classList.add('active'); 
}


// --- FONCTION D'INITIALISATION GLOBALE (APPELÉE PAR script.js) ---
window.initCoursPage = function() {
    console.log("Initialisation de la page Cours...");
    
    // 🚨 FIX CRUCIAL : Initialisation des références globales ici 🚨
    detailsModal = document.getElementById('details-modal'); 
    detailsContent = document.getElementById('details-content');
    detailsTitle = document.getElementById('details-title');

    setupModalListeners(); // Modale de Dépôt
    setupFormSubmission();
    setupFilePreview();

    // GESTION ROBUSTE DE LA FERMETURE DE LA MODALE DÉTAILS
    const closeDetailsBtn = document.getElementById('close-details-btn');
    
    if (detailsModal) {
        if (closeDetailsBtn) {
            closeDetailsBtn.onclick = () => detailsModal.classList.remove('active');
        }
        
        detailsModal.onclick = (event) => {
            if (event.target === detailsModal) detailsModal.classList.remove('active');
        };
    }

    fetchCoursesAndDisplay(); 
};