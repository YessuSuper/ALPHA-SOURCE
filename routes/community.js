'use strict';
const express = require('express');
const router = express.Router();
const {
    fs: _fs, path,
    PUBLIC_API_DIR,
    uploadCommunity,
    readAllMessagesFromJSON, writeAllMessagesToJSON,
    readFillJoinRequests, writeFillJoinRequests,
    getUserNameById, getUserIdByName,
    contributeToChallenge,
    db, stmts, buildUserObject, readUsers, writeUsers
} = require('./shared');
const {
    addPoints, incrementMessageCount, rewardTopicCreatorForFill,
    checkPointsForAction, deductPoints, spendPoints
} = require('../js/points');

const checkPts = checkPointsForAction;
const spend = spendPoints;
const deduct = deductPoints;

// === In-memory typing indicator store ===
const typingUsers = new Map();

router.post('/public/api/community/typing', (req, res) => {
    const { username, discussionId, discussionType } = req.body || {};
    if (!username || !discussionId || !discussionType) return res.json({ success: false });
    const key = `${discussionType}:${discussionId}`;
    if (!typingUsers.has(key)) typingUsers.set(key, new Map());
    typingUsers.get(key).set(username, Date.now());
    res.json({ success: true });
});

router.get('/public/api/community/typing', (req, res) => {
    const { discussionId, discussionType, username } = req.query || {};
    if (!discussionId || !discussionType) return res.json({ success: true, users: [] });
    const key = `${discussionType}:${discussionId}`;
    const map = typingUsers.get(key);
    if (!map) return res.json({ success: true, users: [] });
    const now = Date.now();
    const active = [];
    for (const [user, ts] of map.entries()) {
        if (now - ts > 5000) { map.delete(user); continue; }
        if (user !== username) active.push(user);
    }
    res.json({ success: true, users: active });
});

function ymdUtcKey() {
    return new Date().toISOString().slice(0, 10);
}

const SAFE_ID_RE = /^[a-zA-Z0-9_-]+$/;
function isSafeId(id) {
    return typeof id === 'string' && id.length > 0 && id.length < 200 && SAFE_ID_RE.test(id);
}

// Helper: build a community message object from a SQL row
function buildCommunityMsgObj(row) {
    if (!row) return null;
    const obj = {
        id: row.id,
        sender: row.sender,
        content: row.content || '',
        timestamp: row.timestamp,
        type: row.type || 'text'
    };
    if (row.replies_to) obj.replies_to = row.replies_to;
    if (row.file_filename) {
        obj.file = {
            filename: row.file_filename,
            originalName: row.file_original_name,
            type: row.file_type,
            size: row.file_size
        };
    }
    // Load reactions from SQL
    const reactionRows = stmts.getReactions.all(row.id);
    if (reactionRows.length > 0) {
        const reactions = {};
        for (const r of reactionRows) {
            if (!reactions[r.emoji]) reactions[r.emoji] = [];
            reactions[r.emoji].push(r.username);
        }
        obj.reactions = reactions;
    }
    return obj;
}

// Helper: build group summary for global response
function buildGroupSummary(row) {
    const members = stmts.getGroupMembers.all(row.id).map(m => m.username);
    const lastMsg = stmts.getLastCommunityMessage.get(row.id, 'group');
    let lastMessagePreview = '';
    if (lastMsg) {
        const sender = String(lastMsg.sender || '').trim() || '???';
        const content = lastMsg.content || '';
        const hasText = content.replace(/\s+/g, ' ').trim().length > 0;
        if (lastMsg.type === 'image') {
            lastMessagePreview = hasText ? `${sender}: ${content.slice(0, 34)}` : `${sender}: [image]`;
        } else if (hasText) {
            const preview = content.replace(/\s+/g, ' ').trim();
            lastMessagePreview = `${sender}: ${preview.length > 34 ? preview.slice(0, 34) + '....' : preview}`;
        } else if (lastMsg.file_filename) {
            lastMessagePreview = `${sender}: [fichier]`;
        }
    }
    return {
        id: row.id,
        name: row.name,
        description: row.description || '',
        type: row.type || 'group',
        members,
        admin: row.admin,
        createdAt: row.created_at,
        isPrivate: !!row.is_private,
        cost: row.cost || 0,
        photoUrl: row.photo_url || '',
        lastMessagePreview
    };
}

// --- GET : Lire global.json (rebuilt from SQL) ---
router.get('/public/api/community/global.json', (req, res) => {
    try {
        const groups = stmts.getAllGroups.all().map(buildGroupSummary);

        const topics = stmts.getAllTopics.all().map(row => ({
            id: row.id,
            name: row.name,
            description: row.description || '',
            createdBy: row.created_by,
            createdAt: row.created_at,
            duration: row.duration,
            expiresAt: row.expires_at
        }));

        const fills = stmts.getAllFills.all().map(row => {
            const members = stmts.getFillMembers.all(row.id).map(m => m.username);
            return {
                id: row.id,
                name: row.name,
                description: row.description || '',
                parentType: row.parent_type,
                parentId: row.parent_id,
                members,
                admin: row.admin,
                createdBy: row.created_by,
                createdAt: row.created_at,
                duration: row.duration,
                expiresAt: row.expires_at,
                penalized_low_activity: !!row.penalized_low_activity
            };
        });

        const mps = stmts.getAllMps.all().map(row => {
            const participants = stmts.getMpParticipants.all(row.id).map(p => p.username);
            return {
                id: row.id,
                participants,
                createdBy: row.created_by,
                createdAt: row.created_at
            };
        });

        res.json({ groups, topics, fills, mps });
    } catch (e) {
        console.error("Erreur lecture global:", e);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// --- PUT : Écrire dans global.json (no-op for SQL, kept for compat) ---
router.put('/public/api/community/global.json', express.json(), (req, res) => {
    // With SQL backend, direct writes to global are not supported
    res.json({ success: true });
});

// --- POST : Créer un nouveau groupe ---
router.post('/public/api/community/create-group', uploadCommunity.single('photo'), (req, res) => {
    const name = (req.body.name || '').trim().slice(0, 100);
    const description = (req.body.description || '').trim().slice(0, 500);
    const username = (req.body.username || '').trim();

    if (!name || !username) return res.status(400).json({ success: false, message: "Nom et username requis" });

    const cost = 30;
    if (!checkPts(username, cost)) {
        return res.status(400).json({ success: false, message: "Pas assez de points (-30 requis)" });
    }

    let requestedMembers = [];
    if (req.body.members) {
        try {
            const parsed = JSON.parse(req.body.members);
            if (Array.isArray(parsed)) requestedMembers = parsed;
        } catch (e) { requestedMembers = []; }
    }
    const members = Array.from(new Set([username, ...requestedMembers.filter(Boolean).map(String)]));
    const photoUrl = req.file ? `/pictures_documents/${req.file.filename}` : '';

    const groupId = 'group_' + Date.now();
    try {
        const tx = db.transaction(() => {
            stmts.insertGroup.run({
                id: groupId,
                name,
                description,
                type: 'group',
                admin: username,
                created_at: new Date().toISOString(),
                is_private: 1,
                cost,
                photo_url: photoUrl
            });
            for (const m of members) {
                stmts.addGroupMember.run(groupId, m);
            }
        });
        tx();

        spend(username, cost);

        const newGroup = {
            id: groupId, name, description, type: 'group', members,
            admin: username, createdAt: new Date().toISOString(),
            isPrivate: true, cost, photoUrl
        };
        res.json({ success: true, group: newGroup });
    } catch (e) {
        console.error("Erreur création groupe:", e);
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
});

// --- POST : Créer un nouveau sujet ---
router.post('/public/api/community/create-topic', express.json(), (req, res) => {
    const { name, description, username, durationMs } = req.body;
    if (!name || !username) return res.status(400).json({ success: false, message: "Nom et username requis" });

    const cost = 5;
    const allowedDurations = [
        12 * 60 * 60 * 1000, 24 * 60 * 60 * 1000,
        48 * 60 * 60 * 1000, 5 * 24 * 60 * 60 * 1000
    ];
    const selectedDuration = allowedDurations.includes(Number(durationMs)) ? Number(durationMs) : 24 * 60 * 60 * 1000;

    if (!checkPts(username, cost)) {
        return res.status(400).json({ success: false, message: "Pas assez de points (-5 requis)" });
    }

    const topicId = 'topic_' + Date.now();
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + selectedDuration).toISOString();

    try {
        stmts.insertTopic.run({
            id: topicId, name, description: description || '',
            created_by: username, created_at: createdAt,
            duration: selectedDuration, expires_at: expiresAt
        });

        deduct(username, cost);

        const newTopic = { id: topicId, name, description: description || '', createdBy: username, createdAt, duration: selectedDuration, expiresAt };
        res.json({ success: true, topic: newTopic });
    } catch (e) {
        console.error("Erreur création sujet:", e);
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
});

// --- POST : Créer un nouveau fill ---
router.post('/public/api/community/create-fill', express.json(), (req, res) => {
    const { name, description, parentType, parentId, username, members } = req.body;
    if (!name || !parentType || !parentId || !username) {
        return res.status(400).json({ success: false, message: "Paramètres requis manquants" });
    }

    const requestedMembers = Array.isArray(members) ? members : [];
    const finalMembers = Array.from(new Set([username, ...requestedMembers.filter(Boolean).map(String)]));

    const fillId = 'fill_' + Date.now();
    const createdAt = new Date().toISOString();
    const duration = 12 * 60 * 60 * 1000;
    const expiresAt = new Date(Date.now() + duration).toISOString();

    try {
        const tx = db.transaction(() => {
            stmts.insertFill.run({
                id: fillId, name, description: description || '',
                parent_type: parentType, parent_id: parentId,
                admin: username, created_by: username,
                created_at: createdAt, duration, expires_at: expiresAt
            });
            for (const m of finalMembers) {
                stmts.addFillMember.run(fillId, m);
            }
        });
        tx();

        const newFill = {
            id: fillId, name, description: description || '',
            parentType, parentId, members: finalMembers,
            admin: username, createdBy: username, createdAt, duration, expiresAt
        };
        res.json({ success: true, fill: newFill });

        rewardTopicCreatorForFill(newFill);
    } catch (e) {
        console.error("Erreur création fill:", e);
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
});

// --- POST : Créer un nouveau MP ---
router.post('/public/api/community/create-mp', express.json(), (req, res) => {
    const { recipient, username } = req.body;
    if (!recipient || !username) return res.status(400).json({ success: false, message: "Destinataire et username requis" });
    if (recipient === username) return res.status(400).json({ success: false, message: "MP avec vous-même impossible" });

    try {
        // Check if MP already exists between these two users
        const existing = stmts.findMpByParticipants.get(username, recipient);
        if (existing) {
            const participants = stmts.getMpParticipants.all(existing.id).map(p => p.username);
            return res.json({ success: true, mp: { id: existing.id, participants, createdBy: existing.created_by, createdAt: existing.created_at }, existed: true });
        }

        const mpId = 'mp_' + Date.now();
        const createdAt = new Date().toISOString();
        const tx = db.transaction(() => {
            stmts.insertMp.run(mpId, username, createdAt);
            stmts.addMpParticipant.run(mpId, username);
            stmts.addMpParticipant.run(mpId, recipient);
        });
        tx();

        const newMp = { id: mpId, participants: [username, recipient], createdBy: username, createdAt };
        res.json({ success: true, mp: newMp });
    } catch (e) {
        console.error("Erreur création MP:", e);
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
});

// --- POST : Rejoindre un fill ---
router.post('/public/api/community/join-fill', express.json(), (req, res) => {
    return res.status(403).json({ success: false, message: 'Accès sur demande : utilisez "Demander à rejoindre".' });
});

// --- POST : Demander à rejoindre un fill (anti-spam 3/jour) ---
router.post('/public/api/community/fill-join-request', express.json(), (req, res) => {
    const fillId = (req.body.fillId || '').trim();
    const username = (req.body.username || '').trim();
    if (!fillId || !username) {
        return res.status(400).json({ success: false, message: 'fillId et username requis' });
    }

    try {
        const fill = stmts.getFill.get(fillId);
        if (!fill) return res.status(404).json({ success: false, message: 'Fill introuvable' });

        const isMember = stmts.isFillMember.get(fillId, username);
        if (isMember) {
            return res.status(400).json({ success: false, message: 'Tu es déjà membre de ce fill.' });
        }

        const adminUsername = (fill.admin || fill.created_by || '').trim();
        if (!adminUsername) {
            return res.status(500).json({ success: false, message: 'Admin du fill introuvable.' });
        }

        const adminId = getUserIdByName(adminUsername);
        const requesterId = getUserIdByName(username);
        if (!adminId || !requesterId) {
            return res.status(400).json({ success: false, message: 'Utilisateur introuvable.' });
        }

        const dayKey = ymdUtcKey();
        const countToday = stmts.countTodayFillJoinRequests.get(fillId, username, dayKey);
        if (countToday && countToday.count >= 3) {
            return res.status(429).json({ success: false, message: 'Limite atteinte : 3 demandes par jour pour ce fill.' });
        }

        const requestId = `fjr_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

        stmts.insertFillJoinRequest.run({
            id: requestId, fill_id: fillId, fill_name: fill.name || '',
            requester_username: username, requester_id: String(requesterId),
            admin_username: adminUsername, admin_id: String(adminId),
            day_key: dayKey, created_at: new Date().toISOString(), status: 'pending'
        });

        const subject = `Demande rejoindre fill : ${fill.name || fillId}`;
        const body = `Cet utilisateur veut rejoindre le fill "${fill.name || fillId}" : ${username}`;

        const newMessage = {
            id: 'm' + Date.now(),
            senderId: '1',
            recipients: [String(adminId)],
            subject, body,
            timestamp: new Date().toISOString(),
            attachments: [], readBy: [], unreadBy: [String(adminId)],
            type: 'fill_join_request',
            fillJoinRequestId: requestId, fillId,
            fillName: fill.name || '',
            requesterUsername: username, requesterId: String(requesterId),
            fillJoinAdminUsername: adminUsername, fillJoinAdminId: String(adminId),
            fillJoinStatus: 'pending'
        };

        const existingMessages = readAllMessagesFromJSON();
        existingMessages.push(newMessage);
        writeAllMessagesToJSON(existingMessages);

        return res.json({ success: true, requestId, message: 'Demande envoyée.' });
    } catch (e) {
        console.error('Erreur fill-join-request:', e);
        return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// --- POST : Répondre à une demande (admin) ---
router.post('/public/api/community/fill-join-respond', express.json(), (req, res) => {
    const requestId = String(req.body.requestId || req.body.fillJoinRequestId || '').trim();
    let action = String(req.body.action || req.body.response || '').trim();
    if (action === 'accepted') action = 'accept';
    if (action === 'refused') action = 'refuse';
    const adminUsername = (req.body.adminUsername || '').trim();
    if (!requestId || !action || !adminUsername) {
        return res.status(400).json({ success: false, message: 'requestId, action, adminUsername requis' });
    }
    if (action !== 'accept' && action !== 'refuse') {
        return res.status(400).json({ success: false, message: 'Action invalide' });
    }

    try {
        const reqObj = stmts.getFillJoinRequest.get(requestId);
        if (!reqObj) return res.status(404).json({ success: false, message: 'Demande introuvable' });

        if (reqObj.status !== 'pending') {
            return res.status(400).json({ success: false, message: 'Demande déjà traitée.' });
        }

        if (adminUsername !== 'ADMIN' && adminUsername !== reqObj.admin_username) {
            return res.status(403).json({ success: false, message: 'Accès refusé' });
        }

        const fill = stmts.getFill.get(reqObj.fill_id);
        if (!fill) return res.status(404).json({ success: false, message: 'Fill introuvable' });

        const fillAdmin = (fill.admin || fill.created_by || '').trim();
        if (adminUsername !== 'ADMIN' && adminUsername !== fillAdmin) {
            return res.status(403).json({ success: false, message: 'Accès refusé' });
        }

        if (action === 'accept') {
            stmts.addFillMember.run(reqObj.fill_id, reqObj.requester_username);
        }

        const newStatus = action === 'accept' ? 'accepted' : 'refused';
        stmts.updateFillJoinRequestStatus.run(newStatus, new Date().toISOString(), requestId);

        // Update message status
        try {
            stmts.updateMessageFillJoinStatus.run(newStatus, requestId);
        } catch {}

        // Send notification
        const notifySubject = action === 'accept'
            ? `Demande acceptée : ${reqObj.fill_name || reqObj.fill_id}`
            : `Demande refusée : ${reqObj.fill_name || reqObj.fill_id}`;
        const notifyBody = action === 'accept'
            ? `Ta demande a été acceptée. Tu peux accéder au fill "${reqObj.fill_name || reqObj.fill_id}".`
            : `Ta demande a été refusée pour le fill "${reqObj.fill_name || reqObj.fill_id}".`;

        const notifyMessage = {
            id: 'm' + Date.now(),
            senderId: '1',
            recipients: [String(reqObj.requester_id)],
            subject: notifySubject, body: notifyBody,
            timestamp: new Date().toISOString(),
            attachments: [], readBy: [], unreadBy: [String(reqObj.requester_id)],
            type: 'fill_join_notice',
            fillId: reqObj.fill_id, fillName: reqObj.fill_name || ''
        };
        const existingMessages2 = readAllMessagesFromJSON();
        existingMessages2.push(notifyMessage);
        writeAllMessagesToJSON(existingMessages2);

        return res.json({ success: true, status: newStatus });
    } catch (e) {
        console.error('Erreur fill-join-respond:', e);
        return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// --- POST : Quitter un groupe ---
router.post('/public/api/community/leave-group', express.json(), (req, res) => {
    const groupId = (req.body.groupId || '').trim();
    const username = (req.body.username || '').trim();
    const successor = (req.body.successor || '').trim();

    if (!groupId || !username) return res.status(400).json({ success: false, message: 'groupId et username requis' });
    if (!isSafeId(groupId)) return res.status(400).json({ success: false, message: 'groupId invalide' });
    if (groupId === 'classe3c') return res.status(400).json({ success: false, message: 'Impossible de quitter ce groupe' });

    try {
        const group = stmts.getGroup.get(groupId);
        if (!group) return res.status(404).json({ success: false, message: 'Groupe introuvable' });

        const isMember = stmts.isGroupMember.get(groupId, username);
        if (!isMember) return res.status(403).json({ success: false, message: "Tu n'es pas membre." });

        const isAdmin = (group.admin || '').trim() === username;
        const members = stmts.getGroupMembers.all(groupId).map(m => m.username).filter(m => m !== username);

        if (isAdmin) {
            if (!successor) return res.status(400).json({ success: false, message: 'Successeur requis' });
            if (!members.includes(successor)) return res.status(400).json({ success: false, message: 'Successeur invalide' });
        }

        const tx = db.transaction(() => {
            stmts.removeGroupMember.run(groupId, username);

            if (members.length === 0) {
                // Delete group + cascading fills
                const fillsToDelete = stmts.getFillsByParent.all('group', groupId);
                for (const f of fillsToDelete) {
                    stmts.deleteReactionsByDiscussion.run(f.id, 'fill');
                    stmts.deleteCommunityMessages.run(f.id, 'fill');
                    stmts.deleteFillMembersByFill.run(f.id);
                    stmts.deleteFill.run(f.id);
                }
                stmts.deleteReactionsByDiscussion.run(groupId, 'group');
                stmts.deleteCommunityMessages.run(groupId, 'group');
                stmts.deleteGroupMembersByGroup.run(groupId);
                stmts.deleteGroup.run(groupId);
            } else if (isAdmin) {
                stmts.updateGroup.run({ name: group.name, description: group.description, admin: successor, photo_url: group.photo_url, id: groupId });
            }
        });
        tx();

        return res.json({ success: true, deleted: members.length === 0 });
    } catch (e) {
        console.error('Erreur leave-group:', e);
        return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// --- POST : Quitter un fill ---
router.post('/public/api/community/leave-fill', express.json(), (req, res) => {
    const fillId = (req.body.fillId || '').trim();
    const username = (req.body.username || '').trim();
    const successor = (req.body.successor || '').trim();

    if (!fillId || !username) return res.status(400).json({ success: false, message: 'fillId et username requis' });

    try {
        const fill = stmts.getFill.get(fillId);
        if (!fill) return res.status(404).json({ success: false, message: 'Fill introuvable' });

        const isMember = stmts.isFillMember.get(fillId, username);
        if (!isMember) return res.status(403).json({ success: false, message: "Tu n'es pas membre." });

        const fillAdmin = (fill.admin || fill.created_by || '').trim();
        const isAdmin = fillAdmin === username;
        const members = stmts.getFillMembers.all(fillId).map(m => m.username).filter(m => m !== username);

        if (isAdmin) {
            if (!successor) return res.status(400).json({ success: false, message: 'Successeur requis' });
            if (!members.includes(successor)) return res.status(400).json({ success: false, message: 'Successeur invalide' });
        }

        const tx = db.transaction(() => {
            stmts.removeFillMember.run(fillId, username);

            if (members.length === 0) {
                stmts.deleteReactionsByDiscussion.run(fillId, 'fill');
                stmts.deleteCommunityMessages.run(fillId, 'fill');
                stmts.deleteFillMembersByFill.run(fillId);
                stmts.deleteFill.run(fillId);
            } else if (isAdmin) {
                stmts.updateFill.run({
                    name: fill.name, description: fill.description, admin: successor,
                    duration: fill.duration, expires_at: fill.expires_at,
                    penalized_low_activity: fill.penalized_low_activity || 0, id: fillId
                });
            }
        });
        tx();

        return res.json({ success: true, deleted: members.length === 0 });
    } catch (e) {
        console.error('Erreur leave-fill:', e);
        return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// --- POST : Envoyer un message dans une discussion ---
router.post('/public/api/community/send-message', uploadCommunity.single('file'), (req, res) => {
    const { discussionId, discussionType, message, username, repliesTo } = req.body;
    if (!discussionId || !discussionType || !username) {
        return res.status(400).json({ success: false, message: "Paramètres requis manquants" });
    }

    // Ban check
    try {
        const userRow = stmts.getUserLower.get(username);
        if (userRow) {
            const now = Date.now();
            if (userRow.ban_until && userRow.ban_until > now) {
                const remainingHours = Math.ceil((userRow.ban_until - now) / (60 * 60 * 1000));
                return res.status(403).json({ success: false, message: `Vous êtes banni pour encore ${remainingHours}h.` });
            } else if (userRow.ban_until && userRow.ban_until <= now) {
                stmts.updateUser.run({
                    ...userRow,
                    password_hash: userRow.password_hash,
                    ban_until: null,
                    banned: 0
                });
            }
        }
    } catch (e) {
        console.error('Erreur vérification ban:', e);
    }

    // Access check
    if (discussionType === 'group') {
        if (!stmts.isGroupMember.get(discussionId, username)) {
            return res.status(403).json({ success: false, message: "Accès refusé: pas membre" });
        }
    } else if (discussionType === 'fill') {
        if (!stmts.isFillMember.get(discussionId, username)) {
            return res.status(403).json({ success: false, message: "Accès refusé: pas membre" });
        }
    } else if (discussionType === 'mp') {
        if (!stmts.isMpParticipant.get(discussionId, username)) {
            return res.status(403).json({ success: false, message: "Accès refusé: pas participant" });
        }
    } else {
        return res.status(400).json({ success: false, message: "Type de discussion invalide" });
    }

    const msgId = 'msg_' + Date.now();
    let msgType = 'text';
    let fileFilename = null, fileOriginalName = null, fileType = null, fileSize = null;

    if (req.file) {
        fileFilename = req.file.filename;
        fileOriginalName = req.file.originalname;
        fileType = req.file.mimetype;
        fileSize = req.file.size;
        msgType = req.file.mimetype.startsWith('image/') ? 'image' :
            req.file.mimetype.startsWith('video/') ? 'video' : 'document';
    }

    try {
        stmts.insertCommunityMessage.run({
            id: msgId,
            discussion_id: discussionId,
            discussion_type: discussionType,
            sender: username,
            content: message || '',
            timestamp: new Date().toISOString(),
            type: msgType,
            replies_to: repliesTo || null,
            file_filename: fileFilename,
            file_original_name: fileOriginalName,
            file_type: fileType,
            file_size: fileSize
        });

        const newMessage = {
            id: msgId, sender: username, content: message || '',
            timestamp: new Date().toISOString(), type: msgType
        };
        if (repliesTo) newMessage.replies_to = repliesTo;
        if (req.file) {
            newMessage.file = { filename: fileFilename, originalName: fileOriginalName, type: fileType, size: fileSize };
        }

        if (discussionType === 'group' || discussionType === 'fill') {
            incrementMessageCount(username, 'fill');
        } else {
            incrementMessageCount(username, 'total');
        }

        contributeToChallenge(username, 'messages');
        res.json({ success: true, message: newMessage });
    } catch (e) {
        console.error("Erreur envoi message:", e);
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
});

// --- GET : Récupérer les messages d'une discussion ---
router.get('/public/api/community/messages/:discussionId/:discussionType', (req, res) => {
    const { discussionId, discussionType } = req.params;
    const username = (req.query.username || '').trim();

    if (!username) return res.status(400).json({ success: false, message: "username requis" });
    if (!isSafeId(discussionId)) return res.status(400).json({ success: false, message: "ID de discussion invalide" });
    if (!['group', 'fill', 'mp'].includes(discussionType)) return res.status(400).json({ success: false, message: "Type invalide" });

    // Access check
    if (discussionType === 'group' && !stmts.isGroupMember.get(discussionId, username)) {
        return res.status(403).json({ success: false, message: "Accès refusé" });
    }
    if (discussionType === 'fill' && !stmts.isFillMember.get(discussionId, username)) {
        return res.status(403).json({ success: false, message: "Accès refusé" });
    }
    if (discussionType === 'mp' && !stmts.isMpParticipant.get(discussionId, username)) {
        return res.status(403).json({ success: false, message: "Accès refusé" });
    }

    try {
        const rows = stmts.getCommunityMessages.all(discussionId, discussionType);
        const messages = rows.map(buildCommunityMsgObj);

        // Add badges to messages
        const allUsers = readUsers();
        const badgeMap = new Map();
        allUsers.forEach(u => { badgeMap.set(u.username, u.badges_current || []); });

        const messagesWithBadges = messages.map(msg => ({
            ...msg,
            badges: badgeMap.get(msg.sender) || []
        }));

        res.json({ success: true, messages: messagesWithBadges });
    } catch (e) {
        console.error("Erreur récupération messages:", e);
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
});

// --- GET : Détails d'un groupe ---
router.get('/public/api/community/group-details/:groupId', (req, res) => {
    const { groupId } = req.params;
    const username = (req.query.username || '').trim();
    if (!groupId || !username) return res.status(400).json({ success: false, message: 'groupId et username requis' });

    try {
        const group = stmts.getGroup.get(groupId);
        if (!group) return res.status(404).json({ success: false, message: 'Groupe introuvable' });

        const members = stmts.getGroupMembers.all(groupId).map(m => m.username);
        if (!members.includes(username)) return res.status(403).json({ success: false, message: 'Accès refusé' });

        const msgCount = stmts.countCommunityMessages.get(groupId, 'group');
        return res.json({
            success: true,
            group: {
                id: group.id, name: group.name || '', description: group.description || '',
                photoUrl: group.photo_url || '', admin: group.admin || null,
                members, messagesCount: msgCount ? msgCount.count : 0
            }
        });
    } catch (e) {
        console.error('Erreur détails groupe:', e);
        return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// --- PUT : Mettre à jour nom/description d'un groupe ---
router.put('/public/api/community/group-details/:groupId', express.json(), (req, res) => {
    const { groupId } = req.params;
    const username = (req.body.username || '').trim();
    const name = (typeof req.body.name === 'string') ? req.body.name.trim() : undefined;
    const description = (typeof req.body.description === 'string') ? req.body.description.trim() : undefined;

    if (!groupId || !username) return res.status(400).json({ success: false, message: 'groupId et username requis' });
    if (name === undefined && description === undefined) return res.status(400).json({ success: false, message: 'Aucune modification' });

    try {
        const group = stmts.getGroup.get(groupId);
        if (!group) return res.status(404).json({ success: false, message: 'Groupe introuvable' });

        if (!stmts.isGroupMember.get(groupId, username)) return res.status(403).json({ success: false, message: 'Accès refusé' });

        if (name !== undefined) {
            if (group.admin !== username) return res.status(403).json({ success: false, message: "Seul l'admin peut modifier le nom" });
            if (!name) return res.status(400).json({ success: false, message: 'Nom invalide' });
        }

        stmts.updateGroup.run({
            name: name !== undefined ? name : group.name,
            description: description !== undefined ? description : group.description,
            admin: group.admin,
            photo_url: group.photo_url || '',
            id: groupId
        });

        return res.json({ success: true });
    } catch (e) {
        console.error('Erreur update groupe:', e);
        return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// --- GET : Détails d'un sujet ---
router.get('/public/api/community/topic-details/:topicId', (req, res) => {
    const { topicId } = req.params;
    const username = (req.query.username || '').trim();
    if (!topicId || !username) return res.status(400).json({ success: false, message: 'topicId et username requis' });

    try {
        const topic = stmts.getTopic.get(topicId);
        if (!topic) return res.status(404).json({ success: false, message: 'Sujet introuvable' });

        const fillsInTopic = stmts.getFillsByParent.all('topic', topicId);
        const membersSet = new Set();
        let totalMessages = 0;

        const fillsDetailed = fillsInTopic.map(f => {
            const fillMembers = stmts.getFillMembers.all(f.id).map(m => m.username);
            fillMembers.forEach(m => membersSet.add(m));
            const msgCount = stmts.countCommunityMessages.get(f.id, 'fill');
            const messagesCount = msgCount ? msgCount.count : 0;
            totalMessages += messagesCount;
            return { id: f.id, name: f.name || '', messagesCount };
        });

        return res.json({
            success: true,
            topic: {
                id: topic.id, name: topic.name || '', description: topic.description || '',
                createdBy: topic.created_by || '', createdAt: topic.created_at || null,
                duration: topic.duration || null, expiresAt: topic.expires_at || null
            },
            fills: fillsDetailed,
            members: Array.from(membersSet),
            totalMessages
        });
    } catch (e) {
        console.error('Erreur topic details:', e);
        return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// --- POST : Rallonger la durée d'un sujet ---
router.post('/public/api/community/extend-topic', express.json(), (req, res) => {
    const { topicId, username, extraDurationMs } = req.body;
    if (!topicId || !username || !extraDurationMs) {
        return res.status(400).json({ success: false, message: 'Paramètres requis manquants' });
    }

    const allowedExtras = [
        12 * 60 * 60 * 1000, 24 * 60 * 60 * 1000,
        48 * 60 * 60 * 1000, 5 * 24 * 60 * 60 * 1000
    ];
    const extra = Number(extraDurationMs);
    if (!allowedExtras.includes(extra)) return res.status(400).json({ success: false, message: 'Durée invalide' });

    const block = 12 * 60 * 60 * 1000;
    const blocks = Math.max(1, Math.round(extra / block));
    const cost = blocks * 5;

    if (!checkPts(username, cost)) {
        return res.status(400).json({ success: false, message: `Pas assez de points (-${cost} requis)` });
    }

    try {
        const topic = stmts.getTopic.get(topicId);
        if (!topic) return res.status(404).json({ success: false, message: 'Sujet introuvable' });
        if (topic.created_by !== username) return res.status(403).json({ success: false, message: 'Seul le créateur peut rallonger' });

        const now = Date.now();
        const currentExpires = topic.expires_at ? Date.parse(topic.expires_at) : now;
        const base = Number.isFinite(currentExpires) ? Math.max(currentExpires, now) : now;
        const newExpires = new Date(base + extra).toISOString();
        const newDuration = Number(topic.duration || 0) + extra;

        stmts.updateTopic.run({
            name: topic.name, description: topic.description,
            duration: newDuration, expires_at: newExpires, id: topicId
        });

        deduct(username, cost);
        return res.json({ success: true, expiresAt: newExpires, duration: newDuration, cost });
    } catch (e) {
        console.error('Erreur extend topic:', e);
        return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// --- GET : Détails d'un fill ---
router.get('/public/api/community/fill-details/:fillId', (req, res) => {
    const { fillId } = req.params;
    const username = (req.query.username || '').trim();
    if (!fillId || !username) return res.status(400).json({ success: false, message: 'fillId et username requis' });

    try {
        const fill = stmts.getFill.get(fillId);
        if (!fill) return res.status(404).json({ success: false, message: 'Fill introuvable' });

        const members = stmts.getFillMembers.all(fillId).map(m => m.username);
        const isMember = members.includes(username);
        const msgCount = stmts.countCommunityMessages.get(fillId, 'fill');

        return res.json({
            success: true,
            fill: {
                id: fill.id, name: fill.name || '', description: fill.description || '',
                parentType: fill.parent_type || '', parentId: fill.parent_id || '',
                createdBy: fill.created_by || '', admin: fill.admin || fill.created_by || '',
                createdAt: fill.created_at || null, duration: fill.duration || null,
                expiresAt: fill.expires_at || null, members,
                messagesCount: msgCount ? msgCount.count : 0, isMember
            }
        });
    } catch (e) {
        console.error('Erreur détails fill:', e);
        return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// --- POST : Supprimer un groupe ---
router.post('/public/api/community/delete-group', express.json(), (req, res) => {
    const groupId = (req.body.groupId || '').trim();
    const username = (req.body.username || '').trim();

    if (!groupId || !username) return res.status(400).json({ success: false, message: 'groupId et username requis' });
    if (!isSafeId(groupId)) return res.status(400).json({ success: false, message: 'groupId invalide' });
    if (groupId === 'classe3c') return res.status(400).json({ success: false, message: 'Impossible de supprimer ce groupe' });

    try {
        const group = stmts.getGroup.get(groupId);
        if (!group) return res.status(404).json({ success: false, message: 'Groupe introuvable' });

        if (username !== 'ADMIN' && username !== group.admin) {
            return res.status(403).json({ success: false, message: 'Accès refusé' });
        }

        const fillsToDelete = stmts.getFillsByParent.all('group', groupId);

        const tx = db.transaction(() => {
            for (const f of fillsToDelete) {
                stmts.deleteReactionsByDiscussion.run(f.id, 'fill');
                stmts.deleteCommunityMessages.run(f.id, 'fill');
                stmts.deleteFillMembersByFill.run(f.id);
                stmts.deleteFill.run(f.id);
            }
            stmts.deleteReactionsByDiscussion.run(groupId, 'group');
            stmts.deleteCommunityMessages.run(groupId, 'group');
            stmts.deleteGroupMembersByGroup.run(groupId);
            stmts.deleteGroup.run(groupId);
        });
        tx();

        return res.json({
            success: true, deletedGroup: groupId,
            deletedFills: fillsToDelete.map(f => f.id),
            deletedFillFiles: fillsToDelete.length
        });
    } catch (e) {
        console.error('Erreur suppression groupe:', e);
        return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// --- POST : Supprimer un sujet + cascade fills ---
router.post('/public/api/community/delete-topic', express.json(), (req, res) => {
    const topicId = (req.body.topicId || '').trim();
    const username = (req.body.username || '').trim();

    if (!topicId || !username) return res.status(400).json({ success: false, message: 'topicId et username requis' });

    try {
        const topic = stmts.getTopic.get(topicId);
        if (!topic) return res.status(404).json({ success: false, message: 'Sujet introuvable' });

        if (username !== 'ADMIN' && username !== topic.created_by) {
            return res.status(403).json({ success: false, message: 'Accès refusé' });
        }

        const fillsToDelete = stmts.getFillsByParent.all('topic', topicId);

        const tx = db.transaction(() => {
            for (const f of fillsToDelete) {
                stmts.deleteReactionsByDiscussion.run(f.id, 'fill');
                stmts.deleteCommunityMessages.run(f.id, 'fill');
                stmts.deleteFillMembersByFill.run(f.id);
                stmts.deleteFill.run(f.id);
            }
            stmts.deleteTopic.run(topicId);
        });
        tx();

        return res.json({
            success: true, deletedTopic: topicId,
            deletedFills: fillsToDelete.map(f => f.id),
            deletedFillFiles: fillsToDelete.length
        });
    } catch (e) {
        console.error('Erreur suppression sujet:', e);
        return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// --- POST : Supprimer un fill ---
router.post('/public/api/community/delete-fill', express.json(), (req, res) => {
    const fillId = (req.body.fillId || '').trim();
    const username = (req.body.username || '').trim();

    if (!fillId || !username) return res.status(400).json({ success: false, message: 'fillId et username requis' });
    if (!isSafeId(fillId)) return res.status(400).json({ success: false, message: 'fillId invalide' });

    try {
        const fill = stmts.getFill.get(fillId);
        if (!fill) return res.status(404).json({ success: false, message: 'Fill introuvable' });

        const fillCreator = (fill.created_by || '').trim();
        const fillAdmin = (fill.admin || fill.created_by || '').trim();
        if (username !== 'ADMIN' && username !== fillCreator && username !== fillAdmin) {
            return res.status(403).json({ success: false, message: 'Accès refusé' });
        }

        const tx = db.transaction(() => {
            stmts.deleteReactionsByDiscussion.run(fillId, 'fill');
            stmts.deleteCommunityMessages.run(fillId, 'fill');
            stmts.deleteFillMembersByFill.run(fillId);
            stmts.deleteFill.run(fillId);
        });
        tx();

        return res.json({ success: true, deletedFill: fillId });
    } catch (e) {
        console.error('Erreur suppression fill:', e);
        return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// --- POST : Mettre à jour la photo d'un groupe ---
router.post('/public/api/community/group-photo/:groupId', uploadCommunity.single('photo'), (req, res) => {
    const { groupId } = req.params;
    const username = (req.body.username || '').trim();

    if (!groupId || !username) return res.status(400).json({ success: false, message: 'groupId et username requis' });
    if (!req.file) return res.status(400).json({ success: false, message: 'photo requise' });

    try {
        const group = stmts.getGroup.get(groupId);
        if (!group) return res.status(404).json({ success: false, message: 'Groupe introuvable' });

        if (!stmts.isGroupMember.get(groupId, username)) {
            return res.status(403).json({ success: false, message: 'Accès refusé' });
        }

        const photoUrl = `/pictures_documents/${req.file.filename}`;
        stmts.updateGroup.run({ name: group.name, description: group.description, admin: group.admin, photo_url: photoUrl, id: groupId });

        return res.json({ success: true, photoUrl });
    } catch (e) {
        console.error('Erreur update photo groupe:', e);
        return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// --- POST : Toggler une réaction sur un message ---
router.post('/public/api/community/react-message', express.json(), (req, res) => {
    const { discussionId, discussionType, messageId, emoji, username } = req.body;
    if (!discussionId || !discussionType || !messageId || !emoji || !username) {
        return res.status(400).json({ success: false, message: "Paramètres requis manquants" });
    }

    const ALLOWED_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];
    if (!ALLOWED_REACTIONS.includes(emoji)) {
        return res.status(400).json({ success: false, message: "Réaction non autorisée" });
    }

    try {
        const msgRow = stmts.getCommunityMessage.get(messageId);
        if (!msgRow || msgRow.discussion_id !== discussionId || msgRow.discussion_type !== discussionType) {
            return res.status(404).json({ success: false, message: "Message introuvable" });
        }

        // Check if reaction already exists
        const existing = stmts.getReactions.all(messageId);
        const hasReaction = existing.some(r => r.emoji === emoji && r.username === username);

        if (hasReaction) {
            stmts.removeReaction.run(messageId, emoji, username);
        } else {
            stmts.addReaction.run(messageId, emoji, username);
        }

        // Return updated reactions
        const updatedReactions = stmts.getReactions.all(messageId);
        const reactions = {};
        for (const r of updatedReactions) {
            if (!reactions[r.emoji]) reactions[r.emoji] = [];
            reactions[r.emoji].push(r.username);
        }

        return res.json({ success: true, reactions });
    } catch (e) {
        console.error("Erreur react-message:", e);
        return res.status(500).json({ success: false, message: "Erreur serveur" });
    }
});

// --- POST : Mark discussion as read ---
router.post('/public/api/community/mark-read', (req, res) => {
    const username = (req.body.username || '').trim();
    const discussionId = (req.body.discussionId || '').trim();
    const discussionType = (req.body.discussionType || '').trim();

    if (!username || !discussionId || !discussionType) {
        return res.status(400).json({ success: false, message: 'Paramètres manquants' });
    }
    if (!isSafeId(discussionId)) {
        return res.status(400).json({ success: false, message: 'ID invalide' });
    }

    try {
        const key = `${discussionType}:${discussionId}`;
        stmts.upsertReadTimestamp.run(username, key, new Date().toISOString());
        return res.json({ success: true });
    } catch (e) {
        console.error('mark-read error:', e);
        return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// --- GET : Total unread messages ---
router.get('/public/api/community/unread-count', (req, res) => {
    const username = (req.query.username || '').trim();
    if (!username) return res.status(400).json({ success: false, message: 'username requis' });

    try {
        const userTimestamps = stmts.getAllReadTimestamps.all(username);
        const tsMap = {};
        for (const t of userTimestamps) {
            tsMap[t.discussion_id] = new Date(t.timestamp).getTime();
        }

        let total = 0;

        // Count unread in groups user belongs to
        const groups = stmts.getAllGroups.all();
        for (const g of groups) {
            if (!stmts.isGroupMember.get(g.id, username)) continue;
            const key = `group:${g.id}`;
            const lastRead = tsMap[key] || 0;
            const msgs = stmts.getCommunityMessages.all(g.id, 'group');
            total += msgs.filter(m => m.sender !== username && new Date(m.timestamp).getTime() > lastRead).length;
        }

        // Count unread in fills user belongs to
        const fills = stmts.getAllFills.all();
        for (const f of fills) {
            if (!stmts.isFillMember.get(f.id, username)) continue;
            const key = `fill:${f.id}`;
            const lastRead = tsMap[key] || 0;
            const msgs = stmts.getCommunityMessages.all(f.id, 'fill');
            total += msgs.filter(m => m.sender !== username && new Date(m.timestamp).getTime() > lastRead).length;
        }

        // Count unread in MPs user participates in
        const mps = stmts.getAllMps.all();
        for (const mp of mps) {
            if (!stmts.isMpParticipant.get(mp.id, username)) continue;
            const key = `mp:${mp.id}`;
            const lastRead = tsMap[key] || 0;
            const msgs = stmts.getCommunityMessages.all(mp.id, 'mp');
            total += msgs.filter(m => m.sender !== username && new Date(m.timestamp).getTime() > lastRead).length;
        }

        return res.json({ success: true, count: total });
    } catch (e) {
        console.error('unread-count error:', e);
        return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

module.exports = router;
