// public/js/chat.js (Version finale sécurisée)

// 🚨 VARIABLES GLOBALES
let chatHistory = [];
let attachedFile = null;
let fileUploadInput;
let chatForm;
let userInput;
let previewContainer = null;

// Contexte réduit pour limiter les tokens envoyés à l'IA
function summarizeText(text, max = 1200) {
    if (!text || typeof text !== 'string') return '';
    return text.length > max ? text.slice(-max) : text;
}

function summarizeAllData(allData) {
    if (!allData || typeof allData !== 'object') return 'Contexte fixe indisponible.';

    const classe = allData.classe ? `${allData.classe.nom || ''} ${allData.classe.niveau || ''}`.trim() : '';

    const eleves = Array.isArray(allData.eleves)
        ? allData.eleves.map(e => {
            const forces = e?.niveau_scolaire?.points_forts || '';
            const diffs = e?.niveau_scolaire?.difficultes || '';
            return `${e.nom || 'Inconnu'} | forces:${forces} | diff:${diffs}`;
        }).join('\n- ')
        : '';

    const profs = allData.professeurs && typeof allData.professeurs === 'object'
        ? Object.entries(allData.professeurs).map(([matiere, info]) => {
            const nom = info?.nom || matiere;
            const perso = info?.personnalite || '';
            const ctrl = info?.exigences?.controles || '';
            return `${matiere}: ${nom} | perso:${perso} | controles:${ctrl}`;
        }).join('\n- ')
        : '';

    return [
        classe ? `Classe: ${classe}` : 'Classe: n/c',
        eleves ? `Élèves:\n- ${eleves}` : 'Élèves: n/c',
        profs ? `Profs:\n- ${profs}` : 'Profs: n/c',
        'EDT complet disponible sur demande.'
    ].join('\n');
}

function summarizeBdd(bddData) {
    if (!bddData) return 'BDD évolutive indisponible.';
    if (bddData.core) return summarizeText(bddData.core, 800);
    if (typeof bddData.bdd === 'string') return summarizeText(bddData.bdd, 800);
    return 'BDD évolutive vide.';
}

function summarizeCours(coursData) {
    if (!Array.isArray(coursData) || coursData.length === 0) return 'Aucun cours actif.';
    const sample = coursData.slice(0, 6).map(c => `${c.title || 'Sans titre'} (${c.subject || 'n/c'})`).join('\n- ');
    return `Cours actifs (échantillon):\n- ${sample}`;
}

// ================================================
// 🔥 PERSISTENCE SESSION STORAGE 🔥
// ================================================
const CHAT_HISTORY_STORAGE_KEY = 'SOURCE_CHAT_HISTORY';
const CHAT_MESSAGES_DOM_STORAGE_KEY = 'SOURCE_CHAT_DOM';

/**
 * Sauvegarde l'historique de chat dans sessionStorage
 */
function saveChatHistoryToSession() {
    try {
        sessionStorage.setItem(CHAT_HISTORY_STORAGE_KEY, JSON.stringify(chatHistory));
    } catch (e) {
        console.warn('[CHAT] Erreur sauvegarde sessionStorage:', e.message);
    }
}

/**
 * Charge l'historique de chat depuis sessionStorage
 */
function loadChatHistoryFromSession() {
    try {
        const saved = sessionStorage.getItem(CHAT_HISTORY_STORAGE_KEY);
        if (saved) {
            chatHistory = JSON.parse(saved);
            console.log('[CHAT] Historique restauré:', chatHistory.length / 2, 'messages');
            return true;
        }
    } catch (e) {
        console.warn('[CHAT] Erreur chargement sessionStorage:', e.message);
    }
    return false;
}

/**
 * Sauvegarde le DOM des messages dans sessionStorage (pour restauration rapide)
 */
function saveChatDOMToSession(chatWindow) {
    try {
        if (chatWindow) {
            sessionStorage.setItem(CHAT_MESSAGES_DOM_STORAGE_KEY, chatWindow.innerHTML);
        }
    } catch (e) {
        console.warn('[CHAT] Erreur sauvegarde DOM sessionStorage:', e.message);
    }
}

/**
 * Reconstruit les messages visuels à partir de chatHistory
 * (au lieu de restaurer le HTML brut, on recréé les éléments avec le bon style)
 */
function rebuildChatMessagesFromHistory(chatWindow) {
    try {
        if (!chatWindow || !chatHistory || chatHistory.length === 0) return false;
        
        chatWindow.innerHTML = ''; // Vider d'abord
        
        // Itérer sur l'historique et recréer les messages
        for (let i = 0; i < chatHistory.length; i++) {
            const msg = chatHistory[i];
            const sender = msg.role === 'model' ? 'kirai' : 'user';
            const text = msg.parts && msg.parts[0] && msg.parts[0].text ? msg.parts[0].text : '';
            
            if (text) {
                window.appendMessage(text, sender); // Recréé avec tous les styles
            }
        }
        
        console.log('[CHAT] Messages reconstruits depuis chatHistory');
        return true;
    } catch (e) {
        console.warn('[CHAT] Erreur reconstruction messages:', e.message);
    }
    return false;
}

/**
 * Charge le DOM des messages depuis sessionStorage (DEPRECATED - utiliser rebuildChatMessagesFromHistory)
 */
function loadChatDOMFromSession(chatWindow) {
    try {
        if (!chatWindow) return false;
        const saved = sessionStorage.getItem(CHAT_MESSAGES_DOM_STORAGE_KEY);
        if (saved) {
            chatWindow.innerHTML = saved;
            console.log('[CHAT] DOM restauré depuis sessionStorage');
            return true;
        }
    } catch (e) {
        console.warn('[CHAT] Erreur chargement DOM sessionStorage:', e.message);
    }
    return false;
}

/**
 * Vide l'historique et le DOM du chat (au logout ou reset)
 */
function clearChatSession() {
    try {
        chatHistory = [];
        sessionStorage.removeItem(CHAT_HISTORY_STORAGE_KEY);
        sessionStorage.removeItem(CHAT_MESSAGES_DOM_STORAGE_KEY);
        console.log('[CHAT] Session vidée');
    } catch (e) {
        console.warn('[CHAT] Erreur clear sessionStorage:', e.message);
    }
}



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
    const wantsExtended = /\b(\/extended|extended|contexte complet|context complet|full context|full data)\b/i.test(currentMessage || '');

    const MAX_HISTORY_PAIRS = 3; // Réduit de 4 à 3 pour plus de vitesse
    const MAX_MESSAGES_TO_KEEP = MAX_HISTORY_PAIRS * 2;
    const truncatedHistory = history.slice(-MAX_MESSAGES_TO_KEEP);
    const finalHistory = truncatedHistory;

    let base64File = null;
    if (attachedFile) {
        base64File = await fileToBase64(attachedFile);
    }

    // Paralléliser les 3 fetch BDD pour plus de vitesse
    let evolvingDBContent = "Base de donnée de tendance non disponible ou vide.";
    let fixedDBContent = "Base de donnée fixe (profs/EDT/classement) non disponible.";
    let coursDBContent = "Base de donnée des cours non disponible.";
    let extendedContext = '';
    
    try {
        const [dbRes, allRes, coursRes] = await Promise.all([
            fetch('/public/api/bdd.json'),
            fetch('/api/all.json'),
            fetch('/api/cours.json')
        ]);
        
        if (dbRes.ok) {
            const dbData = await dbRes.json();
            evolvingDBContent = summarizeBdd(dbData);
            if (wantsExtended) {
                extendedContext += `\n[BDD évolutive étendue]\n${summarizeText(JSON.stringify(dbData, null, 2), 5000)}`;
            }
        }
        
        if (allRes.ok) {
            const allData = await allRes.json();
            fixedDBContent = summarizeAllData(allData);
            if (wantsExtended) {
                extendedContext += `\n[BDD fixe étendue]\n${summarizeText(JSON.stringify(allData, null, 2), 5000)}`;
            }
        }
        
        if (coursRes.ok) {
            const coursData = await coursRes.json();
            coursDBContent = summarizeCours(coursData);
            if (wantsExtended) {
                extendedContext += `\n[Cours étendus]\n${summarizeText(JSON.stringify(coursData, null, 2), 5000)}`;
            }
        }
    } catch (error) {
        console.warn("Avertissement: Impossible de charger les BDD:", error);
    }

    const extendedBlock = wantsExtended && extendedContext
        ? "\nContexte étendu (demandé par l'utilisateur):\n" + extendedContext.trim()
        : '';

    const finalSystemInstruction = `Tu es Source AI pour ${username || "l'élève"} (${levelValue}). Mode: ${modeValue}. Parle français simple, concis, adapté ado.
Tu aides pour réviser, apprendre, prévoir les contrôles (via traits profs) et faire les devoirs au niveau de l'élève.
Utilise UNIQUEMENT le contexte ci-dessous. Si une info manque (profil prof, détail élève, emploi du temps), pose d'abord une question courte avant de deviner ou demander l'extended.

Contexte core:
${fixedDBContent}

Tendance récente (résumé):
${evolvingDBContent}

Cours actifs déposés par les eleves (résumé):
${coursDBContent}
${extendedBlock}
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

            // Ajout des points côté client uniquement (si la fonction est dispo)
            if (data.newIndividualPoints !== undefined && typeof addUserPoints === 'function') {
                addUserPoints(username, data.newIndividualPoints);
            }

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
        
        // Sauvegarder après chaque message
        const chatWindow = document.getElementById('chat-window');
        saveChatHistoryToSession();
        if (chatWindow) saveChatDOMToSession(chatWindow);
        
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
            clearChatSession();  // Vide sessionStorage aussi
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

    // Restaurer la conversation depuis sessionStorage si elle existe
    const hasRestoredHistory = loadChatHistoryFromSession();
    
    // Reconstruire les messages visuels à partir de chatHistory (avec les bons styles)
    const hasRebuiltMessages = rebuildChatMessagesFromHistory(chatWindow);
    
    if (!hasRebuiltMessages && chatWindow.children.length === 0) {
        // Aucune historique sauvegardée, afficher le message d'accueil
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
