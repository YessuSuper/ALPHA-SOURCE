// public/js/communaute.js
// Gestion de la page et des interactions du chat communautaire.

// Variable pour suivre les messages déjà affichés
let displayedMessages = []; 

function initCommunityChat() {

    displayedMessages = [];

    const messagesContainer = document.getElementById('messages-container');
    const messageInput = document.getElementById('community-message-input');
    const sendButton = document.getElementById('send-community-message-btn');
    const fileInput = document.getElementById('community-file-input');
    const fileButton = document.getElementById('community-file-button');
    const previewContainer = document.getElementById('community-file-preview-container');
    const previewImg = document.getElementById('community-file-preview-img');
    const fileNameSpan = document.getElementById('community-file-name');
    const removeFileBtn = document.getElementById('community-remove-file-btn');

    // ✔ FIX : username FIABLE
    const currentUsername = (localStorage.getItem('source_username') || "").trim();

    console.log("INIT communaute.js :", { currentUsername });

    if (!messagesContainer || !currentUsername) {
        console.warn("❌ initCommunityChat : éléments HTML ou username absent.");
        return;
    }

    messagesContainer.innerHTML = '<p class="placeholder-message">Connexion au flux de messages...</p>';

    let attachedCommunityFile = null;
    const tempObjectURLs = new Set();

    function displayCommunityFilePreview(file) {
        if (!previewContainer) return;

        if (file) {
            attachedCommunityFile = file;
            fileNameSpan.textContent = file.name;

            if (file.type.startsWith("image/")) {
                const objUrl = URL.createObjectURL(file);
                previewImg.src = objUrl;
                previewImg.style.display = "block";
                tempObjectURLs.add(objUrl);
            } else {
                previewImg.src = "";
                previewImg.style.display = "none";
            }

            previewContainer.style.display = "flex";
        } else {
            attachedCommunityFile = null;
            previewContainer.style.display = "none";
            previewImg.src = "";
            previewImg.style.display = "none";
            fileNameSpan.textContent = "";
        }
    }

    // ⭐ FIX : Fonction d'affichage fiable avec lien de téléchargement
    function appendCommunityMessage(msg) {
        const { id, username, message, timestamp, image_path, image_mime_type } = msg;

        const userLower = (username || "").toLowerCase();
        const meLower = currentUsername.toLowerCase();

        const messageDiv = document.createElement("div");
        messageDiv.classList.add("community-message");

        const isUser = userLower === meLower;
        if (isUser) messageDiv.classList.add("user-message");

        if (typeof id === "string" && id.startsWith("temp-")) {
            messageDiv.setAttribute("data-temp-id", id);
        } else {
            messageDiv.setAttribute("data-id", id);
        }

        let timeStr = "";
        try {
            const d = new Date(timestamp);
            timeStr = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
        } catch {
            timeStr = "??:??";
        }

        let html = `
            <div class="message-header">
                <span class="message-user">${isUser ? "Toi" : escapeHtml(username)}</span>
                <span class="message-time">${timeStr}</span>
            </div>
        `;

        if (image_path && image_mime_type && image_mime_type.startsWith("image/")) {
            // FIX AJOUTÉ : Envelopper l'image dans un lien <a> pour le téléchargement
            html += `
                <a href="${image_path}" 
                   class="image-download-link" 
                   download="${image_path.split('/').pop()}" 
                   title="Télécharger l'image.">
                   <img src="${image_path}" class="uploaded-preview-img"
                        style="max-width:100%;height:auto;margin-bottom:10px;">
                   <span class="download-icon">↓</span> 
                </a>
            `;
        }

        html += `<p class="message-body">${escapeHtml(message || "")}</p>`;

        messageDiv.innerHTML = html;
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    async function loadCommunityMessages() {
        try {
            const res = await fetch("/api/community/messages");
            const list = res.ok ? await res.json() : [];

            const isInitial = displayedMessages.length === 0;

            if (isInitial) {
                messagesContainer.innerHTML = "";
                list.forEach(msg => appendCommunityMessage(msg));
                displayedMessages = list;
                return;
            }

            const known = new Set(displayedMessages.map(m => String(m.id)));
            const newOnes = list.filter(m => !known.has(String(m.id)));

            newOnes.forEach(msg => appendCommunityMessage(msg));
            displayedMessages.push(...newOnes);

        } catch (e) {
            console.error("Erreur de fetch messages:", e);
        }
    }

    function replaceOptimisticMessage(tempId, realMsg) {

        displayedMessages = displayedMessages.map(m =>
            String(m.id) === String(tempId) ? realMsg : m
        );

        const el = messagesContainer.querySelector(`[data-temp-id="${tempId}"]`);

        if (!el) {
            console.warn("Pas trouvé temp msg → reload via polling");
            return;
        }

        const newDiv = document.createElement("div");
        newDiv.classList.add("community-message");

        const isUser = realMsg.username.toLowerCase() === currentUsername.toLowerCase();

        if (isUser) newDiv.classList.add("user-message");

        let timeStr = "";
        try {
            const d = new Date(realMsg.timestamp);
            timeStr = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
        } catch {
            timeStr = "??:??";
        }

        let html = `
            <div class="message-header">
                <span class="message-user">${isUser ? "Toi" : escapeHtml(realMsg.username)}</span>
                <span class="message-time">${timeStr}</span>
            </div>
        `;

        if (realMsg.image_path && realMsg.image_mime_type.startsWith("image/")) {
            // FIX AJOUTÉ : Envelopper l'image dans un lien <a> pour le téléchargement
            html += `
                <a href="${realMsg.image_path}" 
                   class="image-download-link" 
                   download="${realMsg.image_path.split('/').pop()}" 
                   title="Télécharger l'image.">
                   <img src="${realMsg.image_path}" class="uploaded-preview-img"
                        style="max-width:100%;height:auto;margin-bottom:10px;">
                   <span class="download-icon">↓</span> 
                </a>
            `;
        }

        html += `<p class="message-body">${escapeHtml(realMsg.message || "")}</p>`;

        newDiv.innerHTML = html;

        // Revoker l'URL temporaire de l'objet si elle existe
        if (realMsg.image_path && realMsg.image_path.startsWith("blob:")) {
            URL.revokeObjectURL(realMsg.image_path);
        }

        el.replaceWith(newDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    async function sendMessageToCommunity() {
        const msgText = messageInput.value.trim();
        if (!msgText && !attachedCommunityFile) return;

        const tempId = "temp-" + Date.now();

        // Prévisualisation locale optimiste
        let previewURL = null;
        if (attachedCommunityFile) {
            previewURL = URL.createObjectURL(attachedCommunityFile);
            tempObjectURLs.add(previewURL);
        }

        const optimistic = {
            id: tempId,
            username: currentUsername,
            message: msgText,
            timestamp: new Date().toISOString(),
            image_path: previewURL,
            image_mime_type: attachedCommunityFile ? attachedCommunityFile.type : null
        };

        appendCommunityMessage(optimistic);
        displayedMessages.push(optimistic);

        // On NE supprime PAS l'image ici !
        messageInput.value = "";

        const fd = new FormData();
        fd.append("username", currentUsername);
        fd.append("message", msgText);
        fd.append("tempId", tempId);

        if (attachedCommunityFile) {
            fd.append("community-file", attachedCommunityFile);
            console.log("📤 Envoi image :", attachedCommunityFile.name);
        }

        try {
            const response = await fetch("/api/community/post", {
                method: "POST",
                body: fd
            });

            const data = await response.json();
            console.log("Réponse serveur POST :", data);

            if (data.success && data.post) {
                replaceOptimisticMessage(tempId, data.post);
            }

            // MAINTENANT SEULEMENT : effacer l’image (le fichier attaché et la prévisualisation)
            attachedCommunityFile = null;
            fileInput.value = "";
            displayCommunityFilePreview(null);

        } catch (e) {
            console.error("Erreur ENVOI :", e);
        }
    }

    fileButton.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', e => displayCommunityFilePreview(e.target.files[0] || null));
    removeFileBtn.addEventListener('click', () => displayCommunityFilePreview(null));
    sendButton.addEventListener('click', sendMessageToCommunity);

    messageInput.addEventListener("keydown", e => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessageToCommunity();
        }
    });

    loadCommunityMessages();
    window.pollingInterval && clearInterval(window.pollingInterval);
    window.pollingInterval = setInterval(loadCommunityMessages, 3000);
}

window.initCommunityChat = initCommunityChat;