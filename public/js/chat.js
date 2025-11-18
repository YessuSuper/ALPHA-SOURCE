// public/js/chat.js (Logique Spécifique à la page Chat - Version SÉCURISÉE FINALE)

// 🚨 1. L'HISTORIQUE ET LES VARIABLES GLOBALES (Initialisées à null pour le DOM) 🚨
// Ces variables ne seront affectées qu'au chargement du DOM, dans initChatPage()
let chatHistory = []; 
let attachedFile = null; 
let fileUploadInput; // <--- CORRIGÉ
let chatForm;		 // <--- CORRIGÉ
let userInput;		 // <--- CORRIGÉ
let previewContainer = null;


// 🚨 FONCTIONS UTILITAIRES (Inchangées) 🚨
function fileToBase64(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.readAsDataURL(file);
		// On extrait la partie base64 après la virgule
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

// 🚨 GÈRE L'AFFICHAGE DE L'APERCU (Inchangée) 🚨
function displayFilePreview(file) {
	// Vérification nécessaire car previewContainer est initialisé dans cette fonction
	if (!chatForm) return; 

	if (!previewContainer) {
		previewContainer = document.createElement('div');
		previewContainer.id = 'file-preview-container';
		// S'assurer que le conteneur est créé après la zone de texte mais avant les boutons
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
				// fileUploadInput est maintenant disponible globalement
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


// 🚨 FONCTION: APPEL API AVEC RÉESSAIS AUTOMATIQUES (PATCHÉE) 🚨
async function callGeminiAPI(history, currentMessage) {
	const chatWindow = document.getElementById('chat-window');
	const creativity = document.getElementById('creativity-slider').value;
	const lengthValue = document.getElementById('response-length-slider').value;
	const modeValue = document.getElementById('ai-mode-select').value;
	const levelValue = document.getElementById('school-level-select').value;

	let base64File = null;
	if (attachedFile) {
		base64File = await fileToBase64(attachedFile);
	}

	// Affichage du loader (1 seul, même si on réessaie plusieurs fois)
	const loadingDiv = document.createElement('div');
	loadingDiv.classList.add('loading');
	loadingDiv.textContent = 'SOURCE réfléchit...';
	chatWindow.appendChild(loadingDiv);
	chatWindow.scrollTop = chatWindow.scrollHeight;

	let geminiResponseText = `Erreur inconnue lors de l'appel API 🗿`;

	// 🔥 PATCH: RÉESSAI AUTOMATIQUE
	const MAX_RETRIES = 5;
	let attempt = 0;

	while (attempt < MAX_RETRIES) {
		try {
			console.log(`Tentative API ${attempt + 1}/${MAX_RETRIES}...`);

			const response = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					history: history,
					currentMessage: currentMessage,
					creativity: creativity,
					lengthValue: lengthValue,
					modeValue: modeValue,
					levelValue: levelValue,
					base64File: base64File,
					mimeType: attachedFile ? attachedFile.type : null
				}),
			});

			if (!response.ok) {
				throw new Error(`Erreur du serveur SOURCE: ${response.status}`);
			}

			const data = await response.json();
			geminiResponseText = data.response;

			// API OK → on sort de la boucle
			break;

		} catch (error) {

			console.warn(`⚠ Erreur tentative ${attempt + 1}:`, error);

			if (attempt >= MAX_RETRIES - 1) {
				// Dernier essai → message final
				geminiResponseText =
					`RAHHH Impossible de contacter le serveur SOURCE : Erreur permanente après ${MAX_RETRIES} tentatives (reesaie)`;
				break;
			}

			// Attente avant prochain essai
			await new Promise(resolve => setTimeout(resolve, 500));
		}

		attempt++;
	}

	loadingDiv.remove();
	return geminiResponseText;
}


// 🚨 FONCTION: GESTION DE LA SOUMISSION (Version Finale Propre avec logs console) 🚨
async function handleMessageSubmission() {
	// userInput est maintenant disponible globalement
	const messageText = userInput.value.trim(); 
	
	if (messageText.length > 0 || attachedFile !== null) { 
		
		console.log("DEBUG: Envoi détecté. Préparation de l'appel API. Message:", messageText.substring(0, 50) + '...');
		
		const previewDataURL = attachedFile ? await readDataURL(attachedFile) : null;
		
		// 1. Affichage du message utilisateur AVEC PRÉVISUALISATION
		appendMessage(messageText, 'user', previewDataURL);
		userInput.value = ''; 
		
		// 2. Appel au serveur
		const responseText = await callGeminiAPI(chatHistory, messageText);
		
		console.log("DEBUG: Réponse de l'API reçue ! Affichage en cours.");
		
		// 3. Affichage de la réponse et mise à jour de l'historique
		setTimeout(() => {
			appendMessage(responseText, 'kirai');
			
			// Mise à jour de l'historique : ajout du message utilisateur et de la réponse IA
			let userParts = [{ text: messageText }];
			if (attachedFile) {
				// On ne met PAS la base64 dans l'historique pour ne pas saturer la session !
				// On peut mettre un placeholder ou juste s'en passer. Ici, on s'en passe.
			}
			chatHistory.push({ role: 'user', parts: userParts });
			chatHistory.push({ role: 'model', parts: [{ text: responseText }] });
			
			// 4. NETTOYAGE DU FICHIER APRÈS L'ENVOI 
			attachedFile = null; 
			fileUploadInput.value = ''; 
			if (previewContainer) {
				previewContainer.innerHTML = '';
				previewContainer.style.display = 'none';
			}
			
		}, 10); 
	} else {
		console.log("Tentative d'envoi vide bloquée."); 
	}
}


window.initChatPage = function() {
	console.log("Logique du chat (chat.js) ré-initialisée, BORDEL. Déplacement de la lecture du DOM.");

	// 🚨 2. LECTURE DU DOM DÉPLACÉE ICI (APRÈS LE CHARGEMENT DE LA PAGE) 🚨
	// Les variables globales sont assignées seulement maintenant.
	chatForm = document.getElementById('chat-form');
	userInput = document.getElementById('user-input');
	fileUploadInput = document.getElementById('file-upload');
	
	const chatWindow = document.getElementById('chat-window');
	const sendButton = document.getElementById('send-button-fixed'); 

	// Le test d'existence devrait réussir maintenant !
	if (chatForm && userInput && chatWindow && sendButton && fileUploadInput) {
		
		// 1. Neutraliser l'événement SUBMIT du formulaire (nécessaire si le bouton n'est pas type="button")
		// On va utiliser le submit pour l'envoi par Entrée, et le clic pour le bouton.
		chatForm.onsubmit = function(e) { 
			e.preventDefault(); 
		};
		
		// 2. Gérer le clic direct sur le bouton (LA SOURCE D'ENVOI)
		sendButton.addEventListener('click', async function(e) {
			e.preventDefault(); 
			e.stopImmediatePropagation(); 
			
			const messageText = userInput.value.trim();
			if (messageText.length > 0 || attachedFile !== null) {
				console.log("DEBUG: Clic détecté et non vide. Appel de soumission."); 
				await handleMessageSubmission(); 
			} else {
				console.log("Tentative d'envoi via clic bloquée : champ vide.");
			}
		});
		
		// 3. GESTION DE L'ENVOI PAR LA TOUCHE ENTREE DANS LA TEXTAREA 
		userInput.addEventListener('keydown', async function(e) {
			if (e.key === 'Enter' && !e.shiftKey) { 
				e.preventDefault(); 
				e.stopImmediatePropagation(); 
				
				const messageText = userInput.value.trim();
				if (messageText.length > 0 || attachedFile !== null) {
					await handleMessageSubmission();
				} else {
					console.log("Tentative d'envoi via Enter bloquée : champ vide.");
				}
			}
		});
	}

	// --- GESTION DU BOUTON "NOUVELLE DISCUSSION" ---
	const newChatButton = document.getElementById('new-chat-button');

	if (newChatButton && chatWindow) {
		newChatButton.onclick = () => {
			console.log("Nouvelle discussion lancée. Historique vidé.");
			chatWindow.innerHTML = ''; 
			chatHistory = []; 
			attachedFile = null;
			// fileUploadInput est maintenant disponible globalement
			if (fileUploadInput) {
				fileUploadInput.value = ''; 
			}
			if (previewContainer) {
				previewContainer.innerHTML = '';
				previewContainer.style.display = 'none';
			}
			appendMessage('Hey ! Je suis SOURCE AI. Que puis-je faire pour toi ?', 'kirai');
		};
	}
	
	// --- GESTION DU BOUTON D'ENVOI DE FICHIER (Affichage de l'aperçu) ---
	// fileUploadInput est maintenant disponible globalement
	if (fileUploadInput) {
		fileUploadInput.onchange = () => {
			if (fileUploadInput.files.length > 0) {
				attachedFile = fileUploadInput.files[0];
				console.log(`Fichier sélectionné : ${attachedFile.name}`);
				displayFilePreview(attachedFile);
			} else {
				attachedFile = null;
				displayFilePreview(null);
			}
		};
	}
	
	// --- GESTION DES CONTROLES DE LA SIDEBAR (Sliders/Options - Inchagée) ---
	const creativitySlider = document.getElementById('creativity-slider');
	const creativityValue = document.getElementById('creativity-value');
	if (creativitySlider && creativityValue) {
		creativityValue.textContent = creativitySlider.value;
		creativitySlider.oninput = () => {
			creativityValue.textContent = creativitySlider.value;
		};
	}
	
	const lengthSlider = document.getElementById('response-length-slider');
	const lengthValueDisplay = document.getElementById('response-length-value');
	if (lengthSlider && lengthValueDisplay) {
		lengthValueDisplay.textContent = `${lengthSlider.value} mots`;
		lengthSlider.oninput = () => {
			lengthValueDisplay.textContent = `${lengthSlider.value} mots`;
		};
	}
	
	// INIT : AJOUT DU MESSAGE DE BIENVENUE AU CHARGEMENT DE LA PAGE 
	if (chatWindow && chatWindow.children.length === 0) {
		appendMessage('Hey ! Je suis SOURCE AI. Que puis-je faire pour toi ?', 'kirai');
	}
};


// --- FONCTION UTILITAIRE (Inchagée) ---
function appendMessage(message, sender, optionalDataURL = null) {
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
	
	// Assure-toi que marked.js et DOMPurify sont chargés dans le HTML
	if (sender === 'kirai' && typeof marked.parse === 'function' && typeof DOMPurify.sanitize === 'function') {
		let htmlContent = marked.parse(message);
		htmlContent = DOMPurify.sanitize(htmlContent);
		messageContent.innerHTML = htmlContent;
	} else {
		messageContent.textContent = message;
	}
	
	wrapperDiv.appendChild(messageContent); 
	messageDiv.appendChild(wrapperDiv);

	chatWindow.appendChild(messageDiv);
	
	chatWindow.setAttribute('data-update', Date.now());
	chatWindow.removeAttribute('data-update');
	
	chatWindow.scrollTop = chatWindow.scrollHeight;
}