const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const router = express.Router();

const MESSAGES_PATH = path.join(__dirname, '../public/api/messagerie/messages.json');
const upload = multer({ dest: 'uploads/' });

// Middleware pour parser le body même si c'est FormData
router.post('/send', upload.single('file'), (req, res) => {
    try {
        // Affichage debug
        console.log('req.body =', req.body);
        console.log('req.file =', req.file);

        // Récupération des champs
        let { senderId, recipientIds, subject, body, isAnonymous } = req.body;

        // Parsing nécessaire si c'est du FormData
        if (typeof recipientIds === 'string') {
            try { recipientIds = JSON.parse(recipientIds); } catch(e) { recipientIds = []; }
        }
        if (typeof isAnonymous === 'string') {
            isAnonymous = isAnonymous === 'true';
        }

        // Validation
        if (!senderId || !recipientIds || recipientIds.length === 0 || !subject || !body) {
            return res.status(400).json({ success: false, message: 'Champs manquants !' });
        }

        // Lecture messages.json
        let messages = [];
        try {
            const raw = fs.readFileSync(MESSAGES_PATH, 'utf8') || '[]';
            messages = JSON.parse(raw);
            if (!Array.isArray(messages)) messages = [];
        } catch (e) {
            console.warn("messages.json corrompu, réinitialisation.");
            messages = [];
        }

        // Construction du message
        const newMessage = {
            id: 'm' + Date.now(),
            senderId: isAnonymous ? 'anon' : senderId,
            recipients: recipientIds,
            subject: isAnonymous ? `[ANONYME] ${subject}` : subject,
            body,
            timestamp: new Date().toISOString(),
            attachments: []
        };

        if (req.file) {
            newMessage.attachments.push({
                filename: req.file.originalname,
                path: `/uploads/${req.file.filename}`,
                mimeType: req.file.mimetype
            });
        }

        // Ajout et écriture
        messages.push(newMessage);
        fs.writeFileSync(MESSAGES_PATH, JSON.stringify(messages, null, 2), 'utf8');

        console.log("Message ajouté :", newMessage);

        return res.json({ success: true, message: 'Message enregistré !', messageId: newMessage.id });

    } catch (e) {
        console.error("Erreur route send :", e);
        return res.status(500).json({ success: false, message: 'Erreur serveur !' });
    }
});

module.exports = router;
