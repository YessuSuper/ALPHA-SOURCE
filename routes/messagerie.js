'use strict';
const express = require('express');
const router = express.Router();
const {
    fs, path,
    readAllMessagesFromJSON, writeAllMessagesToJSON,
    readRescues, writeRescues, readFillJoinRequests, writeFillJoinRequests,
    normalizeUsername, clampText, sanitizeAttachments,
    USERS_PATH, ALL_PATH,
    getUserNameById, getUserIdByName, buildSimulatedUsers,
    CLASS_NAMES,
    contributeToChallenge
} = require('./shared');
const { addPoints, deductPoints, spendPoints, checkPointsForAction } = require('../js/points');
const { ai, model, groqCall } = require('./ai-client');

// =================================================================
// ðŸ”¥ GESTION DE LA MESSAGERIE ðŸ”¥
// =================================================================

function parseRescueTargets(aiText) {
    if (!aiText) return { names: [], instruction: '' };
    const cleaned = aiText.replace(/\n/g, ' ').trim();
    const [left, right] = cleaned.split(':');
    const names = (left || '')
        .split('/')
        .map(n => n.trim())
        .filter(Boolean);
    return { names, instruction: (right || '').trim() };
}

async function generateRescueTargets(promptPayload) {
    if (!ai) return { names: [], instruction: '', raw: '' };
    const { studentMessage, requesterName, classContext } = promptPayload;
    const prompt = `Tu es Source AI et tu dois router un 'Sauvetage'.\n` +
        `Message reÃ§u (cours manquant ou ratÃ©) : "${studentMessage}".\n` +
        `Demandeur : ${requesterName}.\n` +
        `Dans la base ci-dessous (all.json) tu trouveras le caractÃ¨re des Ã©lÃ¨ves.\n` +
        `RÃ©ponds en UNE LIGNE strictement au format suivant :\n` +
        `prenom1/prenom2/prenom3/...:Phrase ultra courte qui dÃ©crit quoi envoyer et rappelle la rÃ©compense de 15 points.\n` +
        `RÃ¨gles : 1) Les prÃ©noms doivent appartenir Ã  la classe et Ãªtre sÃ©parÃ©s par '/'. 2) Ne mentionne jamais le nom du demandeur. 3) Maximum 8 prÃ©noms, triÃ©s du plus probable au moins probable. 4) Pas d'autres phrases, pas de listes.\n` +
        `all.json (extrait) :\n${classContext}`;

    try {
        const result = await groqCall(client => client.chat.completions.create({
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.35,
            max_tokens: 220
        }));
        const raw = (result.choices?.[0]?.message?.content || '').trim();
        const parsed = parseRescueTargets(raw);
        return { ...parsed, raw };
    } catch (e) {
        console.error('[RESCUE] Échec appel Groq:', e.message);
        return { names: [], instruction: '', raw: '' };
    }
}

/**
 * Route POST /api/messagerie/send : GÃ¨re l'envoi d'un nouveau message.
 */
function handleMessageSave(req, res) {
    const { senderId, recipientIds, subject, body, isAnonymous, attachments } = req.body;

    let missingField = null;
    if (!senderId) {
        missingField = 'senderId';
    } else if (!recipientIds || !Array.isArray(recipientIds) || recipientIds.length === 0) {
        missingField = 'recipientIds';
    } else if (!subject || subject.trim().length === 0) {
        missingField = 'subject';
    } else if (!body || body.trim().length === 0) {
        missingField = 'body';
    }

    if (missingField) {
        console.error(`[MESSAGERIE] Champ manquant : ${missingField}`);
        return res.status(400).json({
            success: false,
            message: `Le champ '${missingField}' est manquant ou vide.`,
            missingField
        });
    }

    // Limites de longueur
    if (subject.length > 200) {
        return res.status(400).json({ success: false, message: 'Sujet trop long (max 200 caract\u00e8res).' });
    }
    if (body.length > 10000) {
        return res.status(400).json({ success: false, message: 'Message trop long (max 10000 caract\u00e8res).' });
    }
    if (recipientIds.length > 50) {
        return res.status(400).json({ success: false, message: 'Trop de destinataires (max 50).' });
    }

    if (isAnonymous && !checkPointsForAction(senderId, 3)) {
        return res.status(400).json({
            success: false,
            message: "Pas assez de points pour envoyer un message anonyme (-3 points requis)."
        });
    }

    let safeAttachments = [];
    if (Array.isArray(attachments)) {
        safeAttachments = attachments.map(att => ({
            name: att.name,
            size: att.size,
            data: att.data
        }));
    }

    const finalSenderId = isAnonymous ? "anon" : senderId;
    const finalSubject = isAnonymous ? `[ANONYME] ${subject}` : subject;

    const newMessage = {
        id: 'm' + Date.now(),
        senderId: finalSenderId,
        recipients: recipientIds,
        subject: finalSubject,
        body: body,
        timestamp: new Date().toISOString(),
        attachments: safeAttachments,
        readBy: [],
        unreadBy: recipientIds.map(x => String(x))
    };

    try {
        const existingMessages = readAllMessagesFromJSON();
        existingMessages.push(newMessage);
        writeAllMessagesToJSON(existingMessages);

        if (isAnonymous) {
            deductPoints(senderId, 3);
        }

        console.log(
            `[MESSAGERIE] Message stockÃ© (ID: ${newMessage.id}, PJ: ${safeAttachments.length}, Anonyme: ${isAnonymous})`
        );

        return res.status(200).json({
            success: true,
            message: "Message enregistrÃ©.",
            messageId: newMessage.id
        });

    } catch (error) {
        console.error("[MESSAGERIE] Erreur de sauvegarde JSON :", error);
        return res.status(500).json({
            success: false,
            message: "Erreur serveur lors de l'enregistrement du message."
        });
    }
}

/**
 * Route GET /api/messagerie/messages : Lit les messages de l'utilisateur courant.
 */
function handleMessagesRead(req, res) {
    const CURRENT_USER_ID = req.query.userId || '2';
    const USERS_DATA_SIMULATED = buildSimulatedUsers();
    const rescues = readRescues();

    try {
        const allMessages = readAllMessagesFromJSON();

        const filteredMessages = allMessages.filter(msg => {
            if (msg.senderId.toString() === CURRENT_USER_ID.toString()) {
                return true;
            }
            if (Array.isArray(msg.recipients) && msg.recipients.includes(CURRENT_USER_ID.toString())) {
                return true;
            }
            return false;
        });

        const finalMessages = filteredMessages.map(msg => {
            const senderInfo = USERS_DATA_SIMULATED.find(u => u.id === String(msg.senderId));
            const shouldMask = Array.isArray(msg.maskSenderFor) && msg.maskSenderFor.includes(String(CURRENT_USER_ID));
            let senderName = senderInfo ? senderInfo.name : (msg.senderId === 'anon' ? 'Anonyme' : 'Inconnu');
            if (shouldMask) senderName = 'Anonyme';

            const recipientIds = Array.isArray(msg.recipients) ? msg.recipients.map(id => String(id)) : [];
            const recipientNames = recipientIds.map(id => {
                const recipientInfo = USERS_DATA_SIMULATED.find(u => u.id === String(id));
                return recipientInfo ? recipientInfo.name : id;
            });

            const readByIds = Array.isArray(msg.readBy) ? msg.readBy.map(x => String(x)) : [];
            const unreadByIds = Array.isArray(msg.unreadBy) ? msg.unreadBy.map(x => String(x)) : recipientIds;

            const lusParIds = recipientIds.filter(id => readByIds.includes(id));
            const nonLusIds = recipientIds.filter(id => unreadByIds.includes(id));
            const lusPar = lusParIds.map(id => {
                const u = USERS_DATA_SIMULATED.find(x => x.id === id);
                return u ? u.name : id;
            });
            const nonLus = nonLusIds.map(id => {
                const u = USERS_DATA_SIMULATED.find(x => x.id === id);
                return u ? u.name : id;
            });

            const unreadForCurrent = recipientIds.includes(String(CURRENT_USER_ID)) && unreadByIds.includes(String(CURRENT_USER_ID));

            const rescueInfo = msg.rescueId ? rescues.find(r => r.rescueId === msg.rescueId) : null;

            return {
                ...msg,
                senderName: senderName,
                recipients: recipientNames,
                date: new Date(msg.timestamp).toLocaleDateString('fr-FR', { month: '2-digit', day: '2-digit' }),
                unread: unreadForCurrent,
                lusPar,
                nonLus,
                lusParIds,
                nonLusIds,
                readByIds,
                unreadByIds,
                rescueStatus: rescueInfo ? rescueInfo.status : null,
                rescueWinningSenderId: rescueInfo ? rescueInfo.winningSenderId : null,
                rescueWinningMessageId: rescueInfo ? rescueInfo.winningMessageId : null
            };
        }).sort((a, b) => b.id.localeCompare(a.id));

        console.log(`[MESSAGERIE] ${finalMessages.length} messages envoyÃ©s Ã  l'utilisateur ID '${CURRENT_USER_ID}'.`);
        return res.status(200).json(finalMessages);

    } catch (error) {
        console.error("[MESSAGERIE] Erreur de lecture JSON :", error);
        return res.status(500).json({ success: false, message: "Erreur serveur lors de la lecture des messages." });
    }
}

// POST /api/messagerie/mark-read { userId, messageId }
router.post('/api/messagerie/mark-read', express.json(), (req, res) => {
    try {
        const userId = req.body && req.body.userId ? String(req.body.userId) : '';
        const messageId = req.body && req.body.messageId ? String(req.body.messageId) : '';
        if (!userId || !messageId) {
            return res.status(400).json({ success: false, message: 'userId et messageId requis.' });
        }

        const all = readAllMessagesFromJSON();
        const idx = all.findIndex(m => m && String(m.id) === messageId);
        if (idx === -1) {
            return res.status(404).json({ success: false, message: 'Message introuvable.' });
        }

        const msg = all[idx];
        if (!Array.isArray(msg.readBy)) msg.readBy = [];
        if (!Array.isArray(msg.unreadBy)) {
            const recips = Array.isArray(msg.recipients) ? msg.recipients.map(x => String(x)) : [];
            msg.unreadBy = recips;
        }

        const readBySet = new Set(msg.readBy.map(String));
        const unreadBySet = new Set(msg.unreadBy.map(String));

        const recipientIds = Array.isArray(msg.recipients) ? msg.recipients.map(x => String(x)) : [];
        if (!recipientIds.includes(userId)) {
            return res.json({ success: true, messageId, userId, readBy: Array.from(readBySet), unreadBy: Array.from(unreadBySet) });
        }

        unreadBySet.delete(userId);
        readBySet.add(userId);

        msg.readBy = Array.from(readBySet);
        msg.unreadBy = Array.from(unreadBySet);

        writeAllMessagesToJSON(all);

        return res.json({ success: true, messageId, userId, readBy: msg.readBy, unreadBy: msg.unreadBy });
    } catch (e) {
        console.error('[MESSAGERIE] mark-read error:', e);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

router.post('/api/messagerie/send', express.json(), handleMessageSave);
console.log("Route POST /api/messagerie/send configurÃ©e.");
router.get('/api/messagerie/messages', handleMessagesRead);
console.log("Route GET /api/messagerie/messages configurÃ©e.");

// --- POST : Sauvetage (demande vers Source AI, diffusion aux Ã©lÃ¨ves) ---
router.post('/api/messagerie/rescue', express.json(), async (req, res) => {
    const { senderId, senderUsername, subject, body } = req.body || {};

    const cleanSenderId = String(senderId || '').trim();
    const cleanSenderUsername = (senderUsername || getUserNameById(cleanSenderId) || '').trim();
    if (!cleanSenderId || !cleanSenderUsername || !body) {
        return res.status(400).json({ success: false, message: "Champs manquants pour le sauvetage." });
    }
    if (!ai) {
        return res.status(500).json({ success: false, message: "IA indisponible pour le sauvetage." });
    }

    const canSpend = spendPoints(cleanSenderUsername, 5);
    if (!canSpend) {
        return res.status(400).json({ success: false, message: "Pas assez de points (5 requis) pour lancer un sauvetage." });
    }

    const now = new Date().toISOString();
    const rescueId = 'r' + Date.now();
    const finalSubject = subject && subject.trim() ? subject.trim() : 'Demande de cours';

    const firstMessage = {
        id: 'm' + Date.now(),
        senderId: cleanSenderId,
        recipients: ['1'],
        subject: `[Sauvetage] ${finalSubject}`,
        body,
        timestamp: now,
        attachments: [],
        readBy: [],
        unreadBy: ['1'],
        type: 'rescue_request',
        rescueId
    };

    const startMessages = readAllMessagesFromJSON();
    startMessages.push(firstMessage);
    writeAllMessagesToJSON(startMessages);

    const classContext = clampText(fs.readFileSync(ALL_PATH, 'utf8') || '', 7000);
    const aiResult = await generateRescueTargets({
        studentMessage: body,
        requesterName: cleanSenderUsername,
        classContext
    });

    let candidateIds = aiResult.names
        .map(name => getUserIdByName(name))
        .filter(Boolean)
        .filter(id => id !== cleanSenderId);

    if (candidateIds.length === 0) {
        candidateIds = CLASS_NAMES
            .map(name => getUserIdByName(name))
            .filter(Boolean)
            .filter(id => id !== cleanSenderId)
            .slice(0, 3);
    }

    const instruction = aiResult.instruction || "Envoyez le cours demandÃ© (photos lisibles). RÃ©compense : 15 points au premier cours validÃ©.";
    const dispatchBody = `${instruction}\n\nDemande de l'Ã©lÃ¨ve : ${body}`;

    const broadcastMessages = candidateIds.map((id, index) => ({
        id: 'm' + (Date.now() + index + 1),
        senderId: '1',
        recipients: [id],
        subject: 'Urgent',
        body: dispatchBody,
        timestamp: now,
        attachments: [],
        readBy: [],
        unreadBy: [String(id)],
        type: 'rescue_alert',
        rescueId,
        rescueOwnerId: cleanSenderId,
        rescueOwnerUsername: cleanSenderUsername,
        aiSuggestion: aiResult.raw || instruction
    }));

    const ackMessage = {
        id: 'm' + (Date.now() + candidateIds.length + 5),
        senderId: '1',
        recipients: [cleanSenderId],
        subject: 'Sauvetage lancÃ©',
        body: `J'ai sollicitÃ© ${candidateIds.length} Ã©lÃ¨ves : ${candidateIds.map(getUserNameById).filter(Boolean).join(', ')}. RÃ©compense : 15 points pour le premier cours validÃ©.`,
        timestamp: now,
        attachments: [],
        readBy: [],
        unreadBy: [String(cleanSenderId)],
        type: 'rescue_status',
        rescueId
    };

    const finalMessages = readAllMessagesFromJSON();
    finalMessages.push(...broadcastMessages, ackMessage);
    writeAllMessagesToJSON(finalMessages);

    const rescues = readRescues();
    rescues.push({
        rescueId,
        requesterId: cleanSenderId,
        requesterUsername: cleanSenderUsername,
        subject: finalSubject,
        body,
        createdAt: now,
        status: 'open',
        responses: [],
        winningSenderId: null,
        winningMessageId: null,
        instruction: aiResult.raw || instruction
    });
    writeRescues(rescues);

    return res.json({
        success: true,
        rescueId,
        notified: candidateIds.length,
        suggestion: aiResult.raw || instruction
    });
});

// --- POST : RÃ©ponse Ã  un sauvetage (Ã©lÃ¨ve -> demandeur, anonyme cÃ´tÃ© demandeur) ---
router.post('/api/messagerie/rescue/respond', express.json(), (req, res) => {
    const { rescueId, senderId, senderUsername, body, subject, attachments, parentMessageId } = req.body || {};
    const cleanRescueId = (rescueId || '').trim();
    const cleanSenderId = String(senderId || '').trim();
    if (!cleanRescueId || !cleanSenderId || !body) {
        return res.status(400).json({ success: false, message: "Champs manquants pour la rÃ©ponse." });
    }

    const rescues = readRescues();
    const target = rescues.find(r => r.rescueId === cleanRescueId);
    if (!target) return res.status(404).json({ success: false, message: "Sauvetage introuvable." });
    if (target.status === 'closed') return res.status(400).json({ success: false, message: "Ce sauvetage est dÃ©jÃ  clÃ´turÃ©." });

    const safeAttachments = sanitizeAttachments(attachments);
    const now = new Date().toISOString();
    const msgId = 'm' + Date.now();
    const responseMessage = {
        id: msgId,
        senderId: cleanSenderId,
        recipients: [target.requesterId],
        subject: subject && subject.trim() ? subject.trim() : 'RÃ©ponse Sauvetage',
        body,
        timestamp: now,
        attachments: safeAttachments,
        readBy: [],
        unreadBy: [String(target.requesterId)],
        type: 'rescue_submission',
        rescueId: cleanRescueId,
        rescueOwnerId: target.requesterId,
        rescueOwnerUsername: target.requesterUsername,
        rescueOriginalSenderId: cleanSenderId,
        maskSenderFor: [target.requesterId],
        parentMessageId: parentMessageId || null
    };

    const messages = readAllMessagesFromJSON();
    messages.push(responseMessage);
    writeAllMessagesToJSON(messages);

    target.responses = Array.isArray(target.responses) ? target.responses : [];
    target.responses.push({
        messageId: msgId,
        senderId: cleanSenderId,
        senderUsername: senderUsername || getUserNameById(cleanSenderId) || 'Inconnu',
        createdAt: now
    });
    writeRescues(rescues);
    contributeToChallenge(senderUsername || getUserNameById(cleanSenderId) || 'Inconnu', 'rescues');

    return res.json({ success: true, messageId: msgId });
});

// --- POST : Vote du demandeur sur une rÃ©ponse ---
router.post('/api/messagerie/rescue/vote', express.json(), (req, res) => {
    const { rescueId, messageId, voterId, vote } = req.body || {};
    const cleanRescueId = (rescueId || '').trim();
    const cleanMessageId = (messageId || '').trim();
    const cleanVoterId = String(voterId || '').trim();
    if (!cleanRescueId || !cleanMessageId || !cleanVoterId || !vote) {
        return res.status(400).json({ success: false, message: "Champs manquants pour le vote." });
    }

    const rescues = readRescues();
    const target = rescues.find(r => r.rescueId === cleanRescueId);
    if (!target) return res.status(404).json({ success: false, message: "Sauvetage introuvable." });
    if (target.requesterId !== cleanVoterId) return res.status(403).json({ success: false, message: "Seul le demandeur peut voter." });

    const messages = readAllMessagesFromJSON();
    const responseMsg = messages.find(m => m.id === cleanMessageId && m.rescueId === cleanRescueId);
    if (!responseMsg) return res.status(404).json({ success: false, message: "RÃ©ponse introuvable pour ce sauvetage." });

    target.lastVote = {
        messageId: cleanMessageId,
        voterId: cleanVoterId,
        vote,
        at: new Date().toISOString()
    };

    if (vote === 'up') {
        target.status = 'closed';
        target.winningSenderId = responseMsg.rescueOriginalSenderId || responseMsg.senderId;
        target.winningMessageId = cleanMessageId;
        const winnerName = getUserNameById(target.winningSenderId) || responseMsg.senderUsername || responseMsg.senderName;
        if (winnerName) addPoints(winnerName, 15);
    }

    writeRescues(rescues);
    return res.json({ success: true, status: target.status || 'open' });
});

module.exports = router;

