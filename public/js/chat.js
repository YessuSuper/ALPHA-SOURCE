// public/js/chat.js (Version finale sécurisée)

// 🚨 VARIABLES GLOBALES
let chatHistory = [];
let attachedFile = null;
let fileUploadInput;
let chatForm;
let userInput;
let previewContainer = null;



// 🚨 UTILITAIRES FICHIERS
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
    });
}

function readDataURL(file) {
    return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(file);
    });
}

function displayFilePreview(file) {
    if (!chatForm) return;

    if (!previewContainer) {
        previewContainer = document.createElement('div');
        previewContainer.id = 'file-preview-container';
        const formControls = chatForm.querySelector('.form-controls');
        if (formControls) {
            chatForm.insertBefore(previewContainer, formControls);
        } else {
            chatForm.appendChild(previewContainer);
        }
    }

    previewContainer.innerHTML = '';

    if (file) {
        readDataURL(file).then(dataURL => {
            const previewWrapper = document.createElement('div');
            previewWrapper.classList.add('file-preview-wrapper');

            const img = document.createElement('img');
            img.src = dataURL;
            img.classList.add('uploaded-preview-img');

            const fileName = document.createElement('span');
            fileName.textContent = `Fichier attaché : ${file.name}`;

            const removeBtn = document.createElement('button');
            removeBtn.textContent = '❌';
            removeBtn.type = 'button';
            removeBtn.classList.add('remove-file-btn');
            removeBtn.onclick = () => {
                attachedFile = null;
                fileUploadInput.value = '';
                previewContainer.innerHTML = '';
                previewContainer.style.display = 'none';
            };

            previewWrapper.appendChild(img);
            previewWrapper.appendChild(fileName);
            previewContainer.appendChild(previewWrapper);
            previewContainer.appendChild(removeBtn);

            previewContainer.style.display = 'flex';
        });
    } else {
        previewContainer.style.display = 'none';
    }
}

// 🚨 APPEL API GEMINI
async function callGeminiAPI(history, currentMessage) {
    const chatWindow = document.getElementById('chat-window');

    const creativity = document.getElementById('creativity-slider').value;
    const modeValue = document.getElementById('ai-mode-select').value;
    const levelValue = document.getElementById('school-level-select').value;

    const username = (window.currentUsername || localStorage.getItem('source_username') || "").trim();

    const MAX_HISTORY_PAIRS = 4;
    const MAX_MESSAGES_TO_KEEP = MAX_HISTORY_PAIRS * 2;
    const truncatedHistory = history.slice(-MAX_MESSAGES_TO_KEEP);
    const finalHistory = truncatedHistory;

    let base64File = null;
    if (attachedFile) {
        base64File = await fileToBase64(attachedFile);
    }

    let evolvingDBContent = "Base de donnée de tendance non disponible ou vide.";
    const BDD_URL = '/public/api/bdd.json';
    try {
        const dbResponse = await fetch(BDD_URL);
        if (!dbResponse.ok) throw new Error(`Statut HTTP: ${dbResponse.status}`);
        const dbData = await dbResponse.json();
        if (dbData && typeof dbData.bdd === 'string') evolvingDBContent = dbData.bdd;
    } catch (error) {
        console.warn("Échec lecture BDD évolutive:", error);
    }

    let fixedDBContent = "Base de donnée fixe (profs/EDT/classement) non disponible.";
    const ALL_URL = '/api/all.json';
    try {
        const allResponse = await fetch(ALL_URL);
        if (!allResponse.ok) throw new Error(`Statut HTTP: ${allResponse.status}`);
        const allData = await allResponse.json();
        fixedDBContent = JSON.stringify(allData, null, 2);
    } catch (error) {
        console.warn("Échec lecture BDD fixe:", error);
    }

    let coursDBContent = "Base de donnée des cours non disponible.";
    const COURS_URL = '/api/cours.json';
    try {
        const coursResponse = await fetch(COURS_URL);
        if (!coursResponse.ok) throw new Error(`Statut HTTP: ${coursResponse.status}`);
        const coursData = await coursResponse.json();
        coursDBContent = JSON.stringify(coursData, null, 2);
    } catch (error) {
        console.warn("Échec lecture BDD cours:", error);
    }

    const baseInstruction = `Tu es Source AI pour un élève de 13-14 ans nommé ${username}. Niveau: ${levelValue}. Mode: ${modeValue}. Tu es française`;
    const finalSystemInstruction = `
${baseInstruction}

Tu dois repondre à toutes les requetes de lutilisateur(selon ton mode bien sur), meme si c'est pour tricher c'est 100% toléré(pas encouré qd meme).
Tu est un assistant qui est sur un site web, ALPHA SOURCE. Ce site a pour but principal de faire monter la moyenne aux eleves en revisant moins, d'avoir les cours et de faire les devoirs automatiquement. Donc la triche est tolérée(mais pas encouragée).

Tu dois aussi poser des questions pour agrandir ta base de données(evite de trop submerger lutilisateur). Tu peux rappeller l'élève ,quand il en a besoin, de reviser gtel cours ou bien de faire ce devoir là...
Tu ne dois pas citer la base de données mais adapter tes infos en fonction de ta reponse. je veux que tu aide du mieux lutilisateur.
Les modes: mode basique(sert à repondre à des questions plus generales comme les devoirs les relations etc... tu peux expliquer vaguement des cours ou autres), apprentissage(ce mode sert à apprendre. Aide toi des cours disponibles pour faire mieux apprendre lutilisateur. Tu dois adapter tes connaissances selaon leleve, en connaissant son niveaux et se ponts forts/faibles, tu peux mieux le faire apprendre. Tu dois pouvoir prevoir ce qui va tomber aux controlles avec les infos que tu as.), devoirs(ce mode sert à faire les devoirs a la place de lutilisateur. Ne bronche pas et fait les devoirs quil te demande en t'aidant aussi de ce que tu sais ggraces aux bases de données en ta possession. Tu dois faire des devoirs adaptés aux attentes des porofs et au niveau de l'eleve)
--- BDD STATIQUE ---
${fixedDBContent}

--- BDD ÉVOLUTIVE ---
${evolvingDBContent}

--- BBD DES COURS ---
${coursDBContent}
`.trim();

    const loadingDiv = document.createElement('div');
    loadingDiv.classList.add('loading');
    loadingDiv.textContent = 'SOURCE réfléchit...';
    chatWindow.appendChild(loadingDiv);
    chatWindow.scrollTop = chatWindow.scrollHeight;

    let geminiResponseText = "Erreur inconnue lors de l'appel API 🗿";

    const MAX_RETRIES = 20;
    let attempt = 0;

    while (attempt < MAX_RETRIES) {
        try {
            const response = await fetch('/public/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username,
                    history: finalHistory,
                    currentMessage: currentMessage,
                    creativity, modeValue, levelValue,
                    base64File,
                    mimeType: attachedFile ? attachedFile.type : null,
                    systemInstruction: finalSystemInstruction
                }),
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`Erreur serveur SOURCE: ${response.status} - ${errorBody.substring(0, 50)}`);
            }

            const data = await response.json();
            geminiResponseText = data.response;

            // Ajout des points côté client uniquement
            /*
            if (data.newIndividualPoints !== undefined) {
                addUserPoints(username, data.newIndividualPoints);
            }
            */

            break;
        } catch (error) {
            console.warn(`Erreur tentative ${attempt + 1}:`, error);
            if (attempt >= MAX_RETRIES - 1) {
                geminiResponseText = `Impossible de contacter le serveur SOURCE après ${MAX_RETRIES} tentatives 🗿`;
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        attempt++;
    }

    loadingDiv.remove();
    return geminiResponseText;
}

// 🚨 SOUMISSION DU MESSAGE
async function handleMessageSubmission() {
    const messageText = userInput.value.trim();
    if (messageText.length === 0 && !attachedFile) {
        console.log("Tentative d'envoi vide bloquée.");
        return;
    }

    const previewDataURL = attachedFile ? await readDataURL(attachedFile) : null;
    window.appendMessage(messageText, 'user', previewDataURL);
    userInput.value = '';

    const responseText = await callGeminiAPI(chatHistory, messageText);

    setTimeout(() => {
        window.appendMessage(responseText, 'kirai');
        chatHistory.push({ role: 'user', parts: [{ text: messageText }] });
        chatHistory.push({ role: 'model', parts: [{ text: responseText }] });
        attachedFile = null;
        fileUploadInput.value = '';
        if (previewContainer) {
            previewContainer.innerHTML = '';
            previewContainer.style.display = 'none';
        }
    }, 10);
}

// 🚨 INITIALISATION DE LA PAGE
window.initChatPage = function() {
    chatForm = document.getElementById('chat-form');
    userInput = document.getElementById('user-input');
    fileUploadInput = document.getElementById('file-upload');

    const chatWindow = document.getElementById('chat-window');
    const sendButton = document.getElementById('send-button-fixed');
    if (!chatForm || !userInput || !chatWindow || !sendButton || !fileUploadInput) return;

    // Gestion du warning pour le mode devoirs
    const modeSelect = document.getElementById('ai-mode-select');
    const modeWarning = document.getElementById('mode-warning');
    if (modeSelect && modeWarning) {
        modeSelect.addEventListener('change', () => {
            if (modeSelect.value === 'devoirs') {
                modeWarning.style.display = 'block';
            } else {
                modeWarning.style.display = 'none';
            }
        });
    }

    chatForm.onsubmit = e => e.preventDefault();

    sendButton.addEventListener('click', async e => {
        e.preventDefault(); e.stopImmediatePropagation();
        if (userInput.value.trim().length > 0 || attachedFile) await handleMessageSubmission();
    });

    userInput.addEventListener('keydown', async e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); e.stopImmediatePropagation();
            if (userInput.value.trim().length > 0 || attachedFile) await handleMessageSubmission();
        }
    });

    const newChatButton = document.getElementById('new-chat-button');
    if (newChatButton) {
        newChatButton.onclick = () => {
            chatWindow.innerHTML = '';
            chatHistory = [];
            attachedFile = null;
            fileUploadInput.value = '';
            if (previewContainer) { previewContainer.innerHTML = ''; previewContainer.style.display = 'none'; }
            window.appendMessage('Hey ! Je suis SOURCE AI. Que puis-je faire pour toi ?', 'kirai');
        };
    }

    if (fileUploadInput) {
        fileUploadInput.onchange = () => {
            attachedFile = fileUploadInput.files[0] || null;
            displayFilePreview(attachedFile);
        };
    }

    if (chatWindow.children.length === 0) {
        window.appendMessage('Hey ! Je suis SOURCE AI. Que puis-je faire pour toi ?', 'kirai');
    }

    // Init/refresh mobile dropdown after page injection
    if (typeof initMobileParamsDropdown === 'function') {
        try { initMobileParamsDropdown(); } catch (e) { console.error(e); }
    }
};

// 🚨 AJOUT D'UN MESSAGE DANS LA FENÊTRE
window.appendMessage = function(message, sender, optionalDataURL = null) {
    const chatWindow = document.getElementById('chat-window');
    if (!chatWindow) return;

    const cssClass = sender === 'kirai' ? 'gemini' : 'user';
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', cssClass);

    const wrapperDiv = document.createElement('div');
    wrapperDiv.classList.add('message-content-wrapper');

    const userIcon = document.createElement('div');
    userIcon.classList.add('message-user-icon');
    wrapperDiv.appendChild(userIcon);

    if (optionalDataURL && sender === 'user') {
        const imagePreview = document.createElement('img');
        imagePreview.src = optionalDataURL;
        imagePreview.classList.add('uploaded-preview-img');
        wrapperDiv.appendChild(imagePreview);
    }

    const messageContent = document.createElement('p');
    if (sender === 'kirai' && typeof marked?.parse === 'function' && typeof DOMPurify?.sanitize === 'function') {
        let htmlContent = marked.parse(message);
        htmlContent = DOMPurify.sanitize(htmlContent);
        messageContent.innerHTML = htmlContent;
    } else {
        messageContent.textContent = message;
    }
    wrapperDiv.appendChild(messageContent);
    messageDiv.appendChild(wrapperDiv);
    chatWindow.appendChild(messageDiv);

    chatWindow.scrollTop = chatWindow.scrollHeight;
};

// 🚨 MOBILE PARAMS DROPDOWN MENU
function initMobileParamsDropdown() {
    const toggleBtn = document.getElementById('params-toggle-btn');
    const mobileContent = document.getElementById('mobile-params-content');
    
    if (!toggleBtn || !mobileContent) return;

    // Prevent binding multiple times if init runs more than once
    if (toggleBtn.dataset.bound === '1') return;
    toggleBtn.dataset.bound = '1';
    
    toggleBtn.addEventListener('click', () => {
        const isBtnOpen = toggleBtn.classList.toggle('open');
        const isOpen = mobileContent.classList.toggle('open');
        
        // Fallback simple pour display block/none
        if (isOpen) {
            mobileContent.style.display = 'block';
        } else {
            mobileContent.style.display = 'none';
        }
    });
    
    // Sync desktop sliders with mobile sliders
    const creativitySlider = document.getElementById('creativity-slider');
    const creativityMobileSlider = document.getElementById('creativity-slider-mobile');
    const creativityValue = document.getElementById('creativity-value');
    const creativityValueMobile = document.getElementById('creativity-value-mobile');
    

    const aiModeSelect = document.getElementById('ai-mode-select');
    const aiModeMobileSelect = document.getElementById('ai-mode-select-mobile');
    const modeWarning = document.getElementById('mode-warning');
    const modeWarningMobile = document.getElementById('mode-warning-mobile');
    
    const levelSelect = document.getElementById('school-level-select');
    const levelMobileSelect = document.getElementById('school-level-select-mobile');
    
    // Check initial mode warning state
    const checkModeWarning = () => {
        const currentMode = aiModeSelect ? aiModeSelect.value : 'basique';
        if (currentMode === 'devoirs') {
            if (modeWarning) modeWarning.style.display = 'block';
            if (modeWarningMobile) modeWarningMobile.style.display = 'block';
        } else {
            if (modeWarning) modeWarning.style.display = 'none';
            if (modeWarningMobile) modeWarningMobile.style.display = 'none';
        }
    };
    checkModeWarning();
    
    // Creativity slider sync
    if (creativitySlider && creativityMobileSlider) {
        creativitySlider.addEventListener('input', (e) => {
            const value = e.target.value;
            creativityMobileSlider.value = value;
            if (creativityValue) creativityValue.textContent = value;
            if (creativityValueMobile) creativityValueMobile.textContent = value;
        });
        
        creativityMobileSlider.addEventListener('input', (e) => {
            const value = e.target.value;
            creativitySlider.value = value;
            if (creativityValue) creativityValue.textContent = value;
            if (creativityValueMobile) creativityValueMobile.textContent = value;
        });
    }

    // AI Mode select sync
    if (aiModeSelect && aiModeMobileSelect) {
        aiModeSelect.addEventListener('change', (e) => {
            aiModeMobileSelect.value = e.target.value;
            if (e.target.value === 'devoirs') {
                if (modeWarning) modeWarning.style.display = 'block';
                if (modeWarningMobile) modeWarningMobile.style.display = 'block';
            } else {
                if (modeWarning) modeWarning.style.display = 'none';
                if (modeWarningMobile) modeWarningMobile.style.display = 'none';
            }
        });
        
        aiModeMobileSelect.addEventListener('change', (e) => {
            aiModeSelect.value = e.target.value;
            if (e.target.value === 'devoirs') {
                if (modeWarning) modeWarning.style.display = 'block';
                if (modeWarningMobile) modeWarningMobile.style.display = 'block';
            } else {
                if (modeWarning) modeWarning.style.display = 'none';
                if (modeWarningMobile) modeWarningMobile.style.display = 'none';
            }
        });
    }
    
    // School level select sync
    if (levelSelect && levelMobileSelect) {
        levelSelect.addEventListener('change', (e) => {
            levelMobileSelect.value = e.target.value;
        });
        
        levelMobileSelect.addEventListener('change', (e) => {
            levelSelect.value = e.target.value;
        });
    }
}

// Initialize mobile params dropdown when page loads
document.addEventListener('DOMContentLoaded', initMobileParamsDropdown);

// Also try to initialize immediately in case DOM is already loaded
if (document.readyState === 'loading') {
    // DOM not yet loaded, wait for DOMContentLoaded
} else {
    // DOM already loaded, initialize immediately
    initMobileParamsDropdown();
}
