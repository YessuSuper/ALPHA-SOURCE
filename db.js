// db.js — Module SQLite central (better-sqlite3)
'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'data', 'source.db');

// Créer le dossier data/ s'il n'existe pas
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(DB_PATH);

// Performances
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

// ============================================================
// SCHEMA
// ============================================================
db.exec(`
-- Utilisateurs
CREATE TABLE IF NOT EXISTS users (
    username         TEXT PRIMARY KEY,
    password_hash    TEXT NOT NULL,
    pt               INTEGER DEFAULT 0,
    connexions       INTEGER DEFAULT 0,
    last_connexion   INTEGER,
    active           INTEGER DEFAULT 0,
    banned           INTEGER DEFAULT 0,
    ban_until        INTEGER,
    ban_reason       TEXT,
    birth_date       TEXT,
    messages_total   INTEGER DEFAULT 0,
    messages_fill_count INTEGER DEFAULT 0,
    messages_ai_count INTEGER DEFAULT 0,
    pm_messages_count INTEGER DEFAULT 0,
    pm_response_count INTEGER DEFAULT 0,
    avg_pm_response_time REAL DEFAULT 0,
    validated_rescues INTEGER DEFAULT 0,
    login_streak     INTEGER DEFAULT 0,
    last_daily_login INTEGER,
    last_ranking_reward INTEGER,
    last_daily_star_reward TEXT,
    last_depenses_reset INTEGER,
    depenses         INTEGER DEFAULT 0,
    course_stars_avg REAL DEFAULT 0,
    active_skin      TEXT DEFAULT 'bleu basique',
    active_fond      TEXT DEFAULT 'Vagues',
    color            TEXT,
    penalized_inactive INTEGER DEFAULT 0,
    social_banner    TEXT DEFAULT 'bleu basique',
    social_status    TEXT DEFAULT '',
    created_at       TEXT DEFAULT (datetime('now'))
);

-- Historique de points (graph_pt)
CREATE TABLE IF NOT EXISTS user_points_history (
    username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    date     TEXT NOT NULL,
    points   INTEGER NOT NULL,
    PRIMARY KEY (username, date)
);

-- Badges actuels (en cours)
CREATE TABLE IF NOT EXISTS user_badges_current (
    username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    badge_id TEXT NOT NULL,
    PRIMARY KEY (username, badge_id)
);

-- Badges obtenus (historique)
CREATE TABLE IF NOT EXISTS user_badges_obtained (
    username   TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    badge_id   TEXT NOT NULL,
    obtained_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (username, badge_id)
);

-- Skins obtenus
CREATE TABLE IF NOT EXISTS user_skins (
    username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    skin_id  TEXT NOT NULL,
    PRIMARY KEY (username, skin_id)
);

-- Fonds obtenus
CREATE TABLE IF NOT EXISTS user_fonds (
    username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    fond_id  TEXT NOT NULL,
    PRIMARY KEY (username, fond_id)
);

-- Badge showcase (social profile)
CREATE TABLE IF NOT EXISTS user_badge_showcase (
    username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    badge_id TEXT NOT NULL,
    position INTEGER DEFAULT 0,
    PRIMARY KEY (username, badge_id)
);

-- Heures de connexion (pour badges lève-tôt / nocturne)
CREATE TABLE IF NOT EXISTS user_connection_hours (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    hour     INTEGER NOT NULL,
    logged_at TEXT DEFAULT (datetime('now'))
);

-- Pages visitées
CREATE TABLE IF NOT EXISTS user_pages_visited (
    username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    page     TEXT NOT NULL,
    PRIMARY KEY (username, page)
);

-- Reports reçus
CREATE TABLE IF NOT EXISTS user_reports (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    username    TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    reported_by TEXT,
    reason      TEXT,
    timestamp   INTEGER,
    resolved    INTEGER DEFAULT 0
);

-- Warnings
CREATE TABLE IF NOT EXISTS user_warnings (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    username  TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    reason    TEXT,
    timestamp INTEGER,
    expires_at INTEGER,
    issued_by TEXT
);

-- Historique d'achats
CREATE TABLE IF NOT EXISTS user_purchases (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    type     TEXT,
    item_id  TEXT,
    price    INTEGER,
    purchased_at TEXT DEFAULT (datetime('now'))
);

-- Cours
CREATE TABLE IF NOT EXISTS courses (
    id                       INTEGER PRIMARY KEY,
    title                    TEXT NOT NULL,
    subject                  TEXT DEFAULT 'Inconnu',
    description              TEXT DEFAULT '',
    uploader_name            TEXT,
    file_path                TEXT,
    uploaded_at              TEXT,
    delete_timer             INTEGER DEFAULT 300,
    supprime                 INTEGER DEFAULT 0,
    deleted_at               TEXT,
    score_sum                REAL DEFAULT 0,
    votes_total              INTEGER DEFAULT 0,
    stars                    REAL DEFAULT 0,
    status                   TEXT DEFAULT 'waiting',
    evaluation_start_at      TEXT,
    evaluation_finalized_at  TEXT,
    uploader_reward_applied_at TEXT,
    uploader_reward_points   INTEGER DEFAULT 0
);

-- Votes sur les cours
CREATE TABLE IF NOT EXISTS course_votes (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    username  TEXT NOT NULL,
    vote      REAL NOT NULL,
    voted_at  TEXT DEFAULT (datetime('now')),
    UNIQUE(course_id, username)
);

-- Messages (messagerie interne)
CREATE TABLE IF NOT EXISTS messages (
    id         TEXT PRIMARY KEY,
    sender_id  TEXT NOT NULL,
    subject    TEXT,
    body       TEXT,
    timestamp  TEXT,
    type       TEXT DEFAULT 'normal',
    -- Champs spéciaux pour fill_join_request
    fill_join_request_id TEXT,
    fill_id              TEXT,
    fill_name            TEXT,
    requester_username   TEXT,
    requester_id         TEXT,
    fill_join_admin_username TEXT,
    fill_join_admin_id      TEXT,
    fill_join_status        TEXT
);

-- Destinataires de messages
CREATE TABLE IF NOT EXISTS message_recipients (
    message_id   TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    recipient_id TEXT NOT NULL,
    read         INTEGER DEFAULT 0,
    PRIMARY KEY (message_id, recipient_id)
);

-- Pièces jointes de messages
CREATE TABLE IF NOT EXISTS message_attachments (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    name       TEXT,
    size       INTEGER,
    data       TEXT
);

-- Sauvetages (rescues)
CREATE TABLE IF NOT EXISTS rescues (
    id                TEXT PRIMARY KEY,
    requester_name    TEXT,
    requester_id      TEXT,
    subject           TEXT,
    description       TEXT,
    status            TEXT DEFAULT 'pending',
    created_at        TEXT,
    resolved_at       TEXT,
    ai_targets        TEXT,
    ai_instruction    TEXT,
    reward_points     INTEGER DEFAULT 15,
    responder_name    TEXT
);

-- Communauté : Groupes
CREATE TABLE IF NOT EXISTS community_groups (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT DEFAULT '',
    type        TEXT DEFAULT 'group',
    admin       TEXT,
    created_at  TEXT,
    is_private  INTEGER DEFAULT 1,
    cost        INTEGER DEFAULT 0,
    photo_url   TEXT DEFAULT ''
);

-- Membres de groupes
CREATE TABLE IF NOT EXISTS community_group_members (
    group_id TEXT NOT NULL REFERENCES community_groups(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    PRIMARY KEY (group_id, username)
);

-- Communauté : Sujets (topics)
CREATE TABLE IF NOT EXISTS community_topics (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT DEFAULT '',
    created_by  TEXT,
    created_at  TEXT,
    duration    INTEGER,
    expires_at  TEXT
);

-- Communauté : Fills
CREATE TABLE IF NOT EXISTS community_fills (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT DEFAULT '',
    parent_type TEXT,
    parent_id   TEXT,
    admin       TEXT,
    created_by  TEXT,
    created_at  TEXT,
    duration    INTEGER,
    expires_at  TEXT,
    penalized_low_activity INTEGER DEFAULT 0
);

-- Membres de fills
CREATE TABLE IF NOT EXISTS community_fill_members (
    fill_id  TEXT NOT NULL REFERENCES community_fills(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    PRIMARY KEY (fill_id, username)
);

-- Communauté : Messages privés (MP)
CREATE TABLE IF NOT EXISTS community_mps (
    id         TEXT PRIMARY KEY,
    created_by TEXT,
    created_at TEXT
);

-- Participants MP
CREATE TABLE IF NOT EXISTS community_mp_participants (
    mp_id    TEXT NOT NULL REFERENCES community_mps(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    PRIMARY KEY (mp_id, username)
);

-- Messages dans les discussions communautaires (groupes, fills, mp)
CREATE TABLE IF NOT EXISTS community_messages (
    id              TEXT PRIMARY KEY,
    discussion_id   TEXT NOT NULL,
    discussion_type TEXT NOT NULL,
    sender          TEXT NOT NULL,
    content         TEXT DEFAULT '',
    timestamp       TEXT,
    type            TEXT DEFAULT 'text',
    replies_to      TEXT,
    file_filename     TEXT,
    file_original_name TEXT,
    file_type         TEXT,
    file_size         INTEGER
);

-- Réactions sur messages communautaires
CREATE TABLE IF NOT EXISTS community_message_reactions (
    message_id TEXT NOT NULL REFERENCES community_messages(id) ON DELETE CASCADE,
    emoji      TEXT NOT NULL,
    username   TEXT NOT NULL,
    PRIMARY KEY (message_id, emoji, username)
);

-- Demandes de rejoindre un fill
CREATE TABLE IF NOT EXISTS fill_join_requests (
    id                  TEXT PRIMARY KEY,
    fill_id             TEXT NOT NULL,
    fill_name           TEXT,
    requester_username  TEXT NOT NULL,
    requester_id        TEXT,
    admin_username      TEXT,
    admin_id            TEXT,
    day_key             TEXT,
    created_at          TEXT,
    status              TEXT DEFAULT 'pending',
    resolved_at         TEXT
);

-- Timestamps de lecture (communauté)
CREATE TABLE IF NOT EXISTS read_timestamps (
    username      TEXT NOT NULL,
    discussion_id TEXT NOT NULL,
    timestamp     INTEGER,
    PRIMARY KEY (username, discussion_id)
);

-- Photos de profil
CREATE TABLE IF NOT EXISTS profile_pictures (
    username TEXT PRIMARY KEY,
    url      TEXT NOT NULL
);

-- BDD évolutive (IA)
CREATE TABLE IF NOT EXISTS bdd_evolving (
    id              INTEGER PRIMARY KEY CHECK (id = 1),
    derniere_maj    TEXT,
    bdd_text        TEXT,
    historiques     TEXT DEFAULT '[]',
    nouvelles_infos TEXT DEFAULT '[]'
);

-- Challenge hebdomadaire
CREATE TABLE IF NOT EXISTS challenge (
    id           INTEGER PRIMARY KEY CHECK (id = 1),
    title        TEXT DEFAULT '',
    description  TEXT DEFAULT '',
    metric       TEXT,
    target       INTEGER DEFAULT 0,
    current      INTEGER DEFAULT 0,
    reward       INTEGER DEFAULT 0,
    contributors TEXT DEFAULT '[]',
    starts_at    TEXT,
    ends_at      TEXT,
    rewarded     INTEGER DEFAULT 0
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_user_points_history_user ON user_points_history(username);
CREATE INDEX IF NOT EXISTS idx_course_votes_course ON course_votes(course_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_message_recipients_msg ON message_recipients(message_id);
CREATE INDEX IF NOT EXISTS idx_community_messages_discussion ON community_messages(discussion_id, discussion_type);
CREATE INDEX IF NOT EXISTS idx_fill_join_requests_fill ON fill_join_requests(fill_id);
CREATE INDEX IF NOT EXISTS idx_community_fills_parent ON community_fills(parent_type, parent_id);
CREATE INDEX IF NOT EXISTS idx_user_connection_hours_user ON user_connection_hours(username);

-- Fiches de révision
CREATE TABLE IF NOT EXISTS fiches (
    id          TEXT PRIMARY KEY,
    username    TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT DEFAULT '',
    matiere     TEXT DEFAULT '',
    content     TEXT NOT NULL,
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_fiches_username ON fiches(username);
`);

// Migrate: add columns that may not exist in older DBs
try { db.exec("ALTER TABLE challenge ADD COLUMN title TEXT DEFAULT ''"); } catch {}
try { db.exec("ALTER TABLE challenge ADD COLUMN description TEXT DEFAULT ''"); } catch {}
try { db.exec("ALTER TABLE challenge ADD COLUMN rewarded INTEGER DEFAULT 0"); } catch {}

// ============================================================
// PREPARED STATEMENTS
// ============================================================

// --- Users ---
const stmts = {
    // Users CRUD
    getUser: db.prepare('SELECT * FROM users WHERE username = ?'),
    getUserLower: db.prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?)'),
    getAllUsers: db.prepare('SELECT * FROM users'),
    insertUser: db.prepare(`INSERT INTO users (username, password_hash, pt, connexions, last_connexion, active, banned,
        ban_until, ban_reason, birth_date, messages_total, messages_fill_count, messages_ai_count,
        pm_messages_count, pm_response_count, avg_pm_response_time, validated_rescues,
        login_streak, last_daily_login, last_ranking_reward, last_daily_star_reward, last_depenses_reset,
        depenses, course_stars_avg, active_skin, active_fond, color, penalized_inactive,
        social_banner, social_status)
        VALUES (@username, @password_hash, @pt, @connexions, @last_connexion, @active, @banned,
        @ban_until, @ban_reason, @birth_date, @messages_total, @messages_fill_count, @messages_ai_count,
        @pm_messages_count, @pm_response_count, @avg_pm_response_time, @validated_rescues,
        @login_streak, @last_daily_login, @last_ranking_reward, @last_daily_star_reward, @last_depenses_reset,
        @depenses, @course_stars_avg, @active_skin, @active_fond, @color, @penalized_inactive,
        @social_banner, @social_status)`),
    updateUser: db.prepare(`UPDATE users SET
        password_hash=@password_hash, pt=@pt, connexions=@connexions, last_connexion=@last_connexion,
        active=@active, banned=@banned, ban_until=@ban_until, ban_reason=@ban_reason,
        birth_date=@birth_date, messages_total=@messages_total, messages_fill_count=@messages_fill_count,
        messages_ai_count=@messages_ai_count, pm_messages_count=@pm_messages_count,
        pm_response_count=@pm_response_count, avg_pm_response_time=@avg_pm_response_time,
        validated_rescues=@validated_rescues, login_streak=@login_streak,
        last_daily_login=@last_daily_login, last_ranking_reward=@last_ranking_reward,
        last_daily_star_reward=@last_daily_star_reward, last_depenses_reset=@last_depenses_reset,
        depenses=@depenses, course_stars_avg=@course_stars_avg, active_skin=@active_skin,
        active_fond=@active_fond, color=@color, penalized_inactive=@penalized_inactive,
        social_banner=@social_banner, social_status=@social_status
        WHERE username=@username`),
    addPoints: db.prepare('UPDATE users SET pt = pt + ? WHERE LOWER(username) = LOWER(?)'),
    spendPoints: db.prepare('UPDATE users SET pt = pt - ?, depenses = depenses + ? WHERE LOWER(username) = LOWER(?) AND pt >= ?'),
    getUserPoints: db.prepare('SELECT pt FROM users WHERE LOWER(username) = LOWER(?)'),
    updateConnexion: db.prepare('UPDATE users SET connexions = connexions + 1, last_connexion = ?, active = 1 WHERE LOWER(username) = LOWER(?)'),

    // Points history
    upsertPointsHistory: db.prepare('INSERT OR REPLACE INTO user_points_history (username, date, points) VALUES (?, ?, ?)'),
    getPointsHistory: db.prepare('SELECT date, points FROM user_points_history WHERE username = ? ORDER BY date'),

    // Badges
    addBadgeCurrent: db.prepare('INSERT OR IGNORE INTO user_badges_current (username, badge_id) VALUES (?, ?)'),
    removeBadgeCurrent: db.prepare('DELETE FROM user_badges_current WHERE username = ? AND badge_id = ?'),
    addBadgeObtained: db.prepare('INSERT OR IGNORE INTO user_badges_obtained (username, badge_id) VALUES (?, ?)'),
    getBadgesCurrent: db.prepare('SELECT badge_id FROM user_badges_current WHERE username = ?'),
    getBadgesObtained: db.prepare('SELECT badge_id FROM user_badges_obtained WHERE username = ?'),
    clearBadgesCurrent: db.prepare('DELETE FROM user_badges_current WHERE username = ?'),

    // Skins & Fonds
    addSkin: db.prepare('INSERT OR IGNORE INTO user_skins (username, skin_id) VALUES (?, ?)'),
    getSkins: db.prepare('SELECT skin_id FROM user_skins WHERE username = ?'),
    addFond: db.prepare('INSERT OR IGNORE INTO user_fonds (username, fond_id) VALUES (?, ?)'),
    getFonds: db.prepare('SELECT fond_id FROM user_fonds WHERE username = ?'),

    // Badge showcase
    setBadgeShowcase: db.prepare('INSERT OR REPLACE INTO user_badge_showcase (username, badge_id, position) VALUES (?, ?, ?)'),
    getBadgeShowcase: db.prepare('SELECT badge_id FROM user_badge_showcase WHERE username = ? ORDER BY position'),
    clearBadgeShowcase: db.prepare('DELETE FROM user_badge_showcase WHERE username = ?'),

    // Connection hours
    addConnectionHour: db.prepare('INSERT INTO user_connection_hours (username, hour) VALUES (?, ?)'),
    getConnectionHours: db.prepare('SELECT hour FROM user_connection_hours WHERE username = ? ORDER BY id DESC LIMIT 100'),
    trimConnectionHours: db.prepare('DELETE FROM user_connection_hours WHERE username = ? AND id NOT IN (SELECT id FROM user_connection_hours WHERE username = ? ORDER BY id DESC LIMIT 100)'),

    // Pages visited
    addPageVisited: db.prepare('INSERT OR IGNORE INTO user_pages_visited (username, page) VALUES (?, ?)'),
    getPagesVisited: db.prepare('SELECT page FROM user_pages_visited WHERE username = ?'),

    // Reports & Warnings
    addReport: db.prepare('INSERT INTO user_reports (username, reported_by, reason, timestamp) VALUES (?, ?, ?, ?)'),
    getReports: db.prepare('SELECT * FROM user_reports WHERE username = ?'),
    addWarning: db.prepare('INSERT INTO user_warnings (username, reason, timestamp, expires_at, issued_by) VALUES (?, ?, ?, ?, ?)'),
    getActiveWarnings: db.prepare('SELECT * FROM user_warnings WHERE username = ? AND expires_at > ?'),
    getAllWarnings: db.prepare('SELECT * FROM user_warnings WHERE username = ?'),
    deleteExpiredWarnings: db.prepare('DELETE FROM user_warnings WHERE expires_at <= ?'),

    // Purchases
    addPurchase: db.prepare('INSERT INTO user_purchases (username, type, item_id, price) VALUES (?, ?, ?, ?)'),
    getPurchases: db.prepare('SELECT * FROM user_purchases WHERE username = ? ORDER BY id DESC LIMIT 100'),

    // Courses
    insertCourse: db.prepare(`INSERT INTO courses (id, title, subject, description, uploader_name, file_path,
        uploaded_at, delete_timer, supprime, score_sum, votes_total, stars, status,
        evaluation_start_at, evaluation_finalized_at, uploader_reward_applied_at, uploader_reward_points)
        VALUES (@id, @title, @subject, @description, @uploader_name, @file_path,
        @uploaded_at, @delete_timer, @supprime, @score_sum, @votes_total, @stars, @status,
        @evaluation_start_at, @evaluation_finalized_at, @uploader_reward_applied_at, @uploader_reward_points)`),
    getCourse: db.prepare('SELECT * FROM courses WHERE id = ?'),
    getAllCourses: db.prepare('SELECT * FROM courses ORDER BY id DESC'),
    getActiveCourses: db.prepare('SELECT * FROM courses WHERE supprime = 0 ORDER BY id DESC'),
    updateCourse: db.prepare(`UPDATE courses SET title=@title, subject=@subject, description=@description,
        uploader_name=@uploader_name, file_path=@file_path, uploaded_at=@uploaded_at,
        delete_timer=@delete_timer, supprime=@supprime, deleted_at=@deleted_at,
        score_sum=@score_sum, votes_total=@votes_total, stars=@stars, status=@status,
        evaluation_start_at=@evaluation_start_at, evaluation_finalized_at=@evaluation_finalized_at,
        uploader_reward_applied_at=@uploader_reward_applied_at, uploader_reward_points=@uploader_reward_points
        WHERE id=@id`),
    softDeleteCourse: db.prepare('UPDATE courses SET supprime = 1, deleted_at = ? WHERE id = ?'),

    // Course votes
    addCourseVote: db.prepare('INSERT OR IGNORE INTO course_votes (course_id, username, vote) VALUES (?, ?, ?)'),
    getCourseVotes: db.prepare('SELECT username, vote, voted_at FROM course_votes WHERE course_id = ?'),
    hasVoted: db.prepare('SELECT 1 FROM course_votes WHERE course_id = ? AND LOWER(username) = LOWER(?)'),

    // Messages (messagerie)
    insertMessage: db.prepare(`INSERT INTO messages (id, sender_id, subject, body, timestamp, type,
        fill_join_request_id, fill_id, fill_name, requester_username, requester_id,
        fill_join_admin_username, fill_join_admin_id, fill_join_status)
        VALUES (@id, @sender_id, @subject, @body, @timestamp, @type,
        @fill_join_request_id, @fill_id, @fill_name, @requester_username, @requester_id,
        @fill_join_admin_username, @fill_join_admin_id, @fill_join_status)`),
    getMessage: db.prepare('SELECT * FROM messages WHERE id = ?'),
    getAllMessages: db.prepare('SELECT * FROM messages ORDER BY timestamp DESC'),
    getMessagesForUser: db.prepare(`SELECT m.* FROM messages m
        LEFT JOIN message_recipients mr ON m.id = mr.message_id
        WHERE m.sender_id = ? OR mr.recipient_id = ?
        GROUP BY m.id ORDER BY m.timestamp DESC`),
    updateMessageFillJoinStatus: db.prepare('UPDATE messages SET fill_join_status = ? WHERE fill_join_request_id = ?'),
    addRecipient: db.prepare('INSERT OR IGNORE INTO message_recipients (message_id, recipient_id) VALUES (?, ?)'),
    markRead: db.prepare('UPDATE message_recipients SET read = 1 WHERE message_id = ? AND recipient_id = ?'),
    getRecipients: db.prepare('SELECT recipient_id, read FROM message_recipients WHERE message_id = ?'),
    addAttachment: db.prepare('INSERT INTO message_attachments (message_id, name, size, data) VALUES (?, ?, ?, ?)'),
    getAttachments: db.prepare('SELECT name, size, data FROM message_attachments WHERE message_id = ?'),

    // Rescues
    insertRescue: db.prepare(`INSERT INTO rescues (id, requester_name, requester_id, subject, description,
        status, created_at, ai_targets, ai_instruction, reward_points)
        VALUES (@id, @requester_name, @requester_id, @subject, @description,
        @status, @created_at, @ai_targets, @ai_instruction, @reward_points)`),
    getRescue: db.prepare('SELECT * FROM rescues WHERE id = ?'),
    getAllRescues: db.prepare('SELECT * FROM rescues ORDER BY created_at DESC'),
    updateRescueStatus: db.prepare('UPDATE rescues SET status = ?, resolved_at = ?, responder_name = ? WHERE id = ?'),

    // Community groups
    insertGroup: db.prepare(`INSERT INTO community_groups (id, name, description, type, admin, created_at, is_private, cost, photo_url)
        VALUES (@id, @name, @description, @type, @admin, @created_at, @is_private, @cost, @photo_url)`),
    getGroup: db.prepare('SELECT * FROM community_groups WHERE id = ?'),
    getAllGroups: db.prepare('SELECT * FROM community_groups'),
    updateGroup: db.prepare('UPDATE community_groups SET name=@name, description=@description, admin=@admin, photo_url=@photo_url WHERE id=@id'),
    deleteGroup: db.prepare('DELETE FROM community_groups WHERE id = ?'),
    deleteGroupMembersByGroup: db.prepare('DELETE FROM community_group_members WHERE group_id = ?'),
    addGroupMember: db.prepare('INSERT OR IGNORE INTO community_group_members (group_id, username) VALUES (?, ?)'),

    removeGroupMember: db.prepare('DELETE FROM community_group_members WHERE group_id = ? AND username = ?'),
    getGroupMembers: db.prepare('SELECT username FROM community_group_members WHERE group_id = ?'),
    isGroupMember: db.prepare('SELECT 1 FROM community_group_members WHERE group_id = ? AND username = ?'),

    // Community topics
    insertTopic: db.prepare(`INSERT INTO community_topics (id, name, description, created_by, created_at, duration, expires_at)
        VALUES (@id, @name, @description, @created_by, @created_at, @duration, @expires_at)`),
    getTopic: db.prepare('SELECT * FROM community_topics WHERE id = ?'),
    getAllTopics: db.prepare('SELECT * FROM community_topics'),
    updateTopic: db.prepare('UPDATE community_topics SET name=@name, description=@description, duration=@duration, expires_at=@expires_at WHERE id=@id'),
    deleteTopic: db.prepare('DELETE FROM community_topics WHERE id = ?'),

    // Community fills
    insertFill: db.prepare(`INSERT INTO community_fills (id, name, description, parent_type, parent_id, admin, created_by, created_at, duration, expires_at)
        VALUES (@id, @name, @description, @parent_type, @parent_id, @admin, @created_by, @created_at, @duration, @expires_at)`),
    getFill: db.prepare('SELECT * FROM community_fills WHERE id = ?'),
    getAllFills: db.prepare('SELECT * FROM community_fills'),
    getFillsByParent: db.prepare('SELECT * FROM community_fills WHERE parent_type = ? AND parent_id = ?'),
    updateFill: db.prepare('UPDATE community_fills SET name=@name, description=@description, admin=@admin, duration=@duration, expires_at=@expires_at, penalized_low_activity=@penalized_low_activity WHERE id=@id'),
    deleteFill: db.prepare('DELETE FROM community_fills WHERE id = ?'),
    deleteFillMembersByFill: db.prepare('DELETE FROM community_fill_members WHERE fill_id = ?'),
    addFillMember: db.prepare('INSERT OR IGNORE INTO community_fill_members (fill_id, username) VALUES (?, ?)'),
    removeFillMember: db.prepare('DELETE FROM community_fill_members WHERE fill_id = ? AND username = ?'),
    getFillMembers: db.prepare('SELECT username FROM community_fill_members WHERE fill_id = ?'),
    isFillMember: db.prepare('SELECT 1 FROM community_fill_members WHERE fill_id = ? AND username = ?'),

    // Community MPs
    insertMp: db.prepare('INSERT INTO community_mps (id, created_by, created_at) VALUES (?, ?, ?)'),
    getMp: db.prepare('SELECT * FROM community_mps WHERE id = ?'),
    getAllMps: db.prepare('SELECT * FROM community_mps'),
    deleteMp: db.prepare('DELETE FROM community_mps WHERE id = ?'),
    deleteMpParticipantsByMp: db.prepare('DELETE FROM community_mp_participants WHERE mp_id = ?'),
    addMpParticipant: db.prepare('INSERT OR IGNORE INTO community_mp_participants (mp_id, username) VALUES (?, ?)'),

    getMpParticipants: db.prepare('SELECT username FROM community_mp_participants WHERE mp_id = ?'),
    isMpParticipant: db.prepare('SELECT 1 FROM community_mp_participants WHERE mp_id = ? AND username = ?'),
    findMpByParticipants: db.prepare(`SELECT mp.* FROM community_mps mp
        JOIN community_mp_participants p1 ON mp.id = p1.mp_id
        JOIN community_mp_participants p2 ON mp.id = p2.mp_id
        WHERE p1.username = ? AND p2.username = ?`),

    // Community messages
    insertCommunityMessage: db.prepare(`INSERT INTO community_messages
        (id, discussion_id, discussion_type, sender, content, timestamp, type, replies_to,
         file_filename, file_original_name, file_type, file_size)
        VALUES (@id, @discussion_id, @discussion_type, @sender, @content, @timestamp, @type, @replies_to,
         @file_filename, @file_original_name, @file_type, @file_size)`),
    getCommunityMessages: db.prepare('SELECT * FROM community_messages WHERE discussion_id = ? AND discussion_type = ? ORDER BY timestamp ASC'),
    getCommunityMessage: db.prepare('SELECT * FROM community_messages WHERE id = ?'),
    countCommunityMessages: db.prepare('SELECT COUNT(*) as count FROM community_messages WHERE discussion_id = ? AND discussion_type = ?'),
    getLastCommunityMessage: db.prepare('SELECT * FROM community_messages WHERE discussion_id = ? AND discussion_type = ? ORDER BY timestamp DESC LIMIT 1'),
    deleteCommunityMessages: db.prepare('DELETE FROM community_messages WHERE discussion_id = ? AND discussion_type = ?'),
    deleteReactionsByDiscussion: db.prepare('DELETE FROM community_message_reactions WHERE message_id IN (SELECT id FROM community_messages WHERE discussion_id = ? AND discussion_type = ?)'),
    countRecentMessagesBySender: db.prepare('SELECT sender, COUNT(*) as count FROM community_messages WHERE timestamp >= ? GROUP BY sender'),
    countFillMessagesByOthers: db.prepare('SELECT COUNT(*) as count FROM community_messages WHERE discussion_id = ? AND discussion_type = \'fill\' AND sender != ?'),

    // Community stats (for user profiles)
    countContributionsByUser: db.prepare('SELECT COUNT(*) as count FROM community_messages WHERE LOWER(sender) = LOWER(?)'),
    countReactionsReceivedByUser: db.prepare('SELECT COUNT(*) as count FROM community_message_reactions r JOIN community_messages m ON r.message_id = m.id WHERE LOWER(m.sender) = LOWER(?)'),
    countReactionsGivenByUser: db.prepare('SELECT COUNT(*) as count FROM community_message_reactions WHERE LOWER(username) = LOWER(?)'),

    // Reactions
    addReaction: db.prepare('INSERT OR IGNORE INTO community_message_reactions (message_id, emoji, username) VALUES (?, ?, ?)'),
    removeReaction: db.prepare('DELETE FROM community_message_reactions WHERE message_id = ? AND emoji = ? AND username = ?'),
    getReactions: db.prepare('SELECT emoji, username FROM community_message_reactions WHERE message_id = ?'),

    // Fill join requests
    insertFillJoinRequest: db.prepare(`INSERT INTO fill_join_requests (id, fill_id, fill_name, requester_username, requester_id, admin_username, admin_id, day_key, created_at, status)
        VALUES (@id, @fill_id, @fill_name, @requester_username, @requester_id, @admin_username, @admin_id, @day_key, @created_at, @status)`),
    getFillJoinRequest: db.prepare('SELECT * FROM fill_join_requests WHERE id = ?'),
    getAllFillJoinRequests: db.prepare('SELECT * FROM fill_join_requests'),
    countTodayFillJoinRequests: db.prepare('SELECT COUNT(*) as count FROM fill_join_requests WHERE fill_id = ? AND requester_username = ? AND day_key = ?'),
    updateFillJoinRequestStatus: db.prepare('UPDATE fill_join_requests SET status = ?, resolved_at = ? WHERE id = ?'),

    // Read timestamps
    upsertReadTimestamp: db.prepare('INSERT OR REPLACE INTO read_timestamps (username, discussion_id, timestamp) VALUES (?, ?, ?)'),
    getReadTimestamp: db.prepare('SELECT timestamp FROM read_timestamps WHERE username = ? AND discussion_id = ?'),
    getAllReadTimestamps: db.prepare('SELECT * FROM read_timestamps WHERE username = ?'),

    // Profile pictures
    upsertProfilePic: db.prepare('INSERT OR REPLACE INTO profile_pictures (username, url) VALUES (?, ?)'),
    getProfilePic: db.prepare('SELECT url FROM profile_pictures WHERE username = ?'),
    getAllProfilePics: db.prepare('SELECT * FROM profile_pictures'),

    // BDD évolutive
    getBddEvolving: db.prepare('SELECT * FROM bdd_evolving WHERE id = 1'),
    upsertBddEvolving: db.prepare(`INSERT OR REPLACE INTO bdd_evolving (id, derniere_maj, bdd_text, historiques, nouvelles_infos)
        VALUES (1, @derniere_maj, @bdd_text, @historiques, @nouvelles_infos)`),

    // Challenge
    getChallenge: db.prepare('SELECT * FROM challenge WHERE id = 1'),
    upsertChallenge: db.prepare(`INSERT OR REPLACE INTO challenge (id, title, description, metric, target, current, reward, contributors, starts_at, ends_at, rewarded)
        VALUES (1, @title, @description, @metric, @target, @current, @reward, @contributors, @starts_at, @ends_at, @rewarded)`),

    // Fiches
    insertFiche: db.prepare(`INSERT INTO fiches (id, username, name, description, matiere, content, created_at, updated_at)
        VALUES (@id, @username, @name, @description, @matiere, @content, @created_at, @updated_at)`),
    updateFiche: db.prepare(`UPDATE fiches SET name=@name, description=@description, matiere=@matiere, content=@content, updated_at=@updated_at WHERE id=@id AND username=@username`),
    deleteFiche: db.prepare('DELETE FROM fiches WHERE id = ? AND username = ?'),
    getFiche: db.prepare('SELECT * FROM fiches WHERE id = ?'),
    getFichesByUser: db.prepare('SELECT id, name, description, matiere, content, created_at, updated_at FROM fiches WHERE LOWER(username) = LOWER(?) ORDER BY updated_at DESC'),
    searchFichesByUser: db.prepare(`SELECT id, name, description, matiere, content, created_at, updated_at FROM fiches
        WHERE LOWER(username) = LOWER(?) AND (LOWER(name) LIKE ? OR LOWER(description) LIKE ?)
        ORDER BY updated_at DESC`)
};

// ============================================================
// HELPER: Build user object matching old JSON shape
// ============================================================
function buildUserObject(row) {
    if (!row) return null;
    return {
        username: row.username,
        passwordHash: row.password_hash,
        pt: row.pt || 0,
        connexions: row.connexions || 0,
        last_connexion: row.last_connexion || null,
        active: !!row.active,
        banned: !!row.banned,
        ban_until: row.ban_until || null,
        ban_reason: row.ban_reason || null,
        birth_date: row.birth_date || null,
        messages_total: row.messages_total || 0,
        messages_fill_count: row.messages_fill_count || 0,
        messages_ai_count: row.messages_ai_count || 0,
        pm_messages_count: row.pm_messages_count || 0,
        pm_response_count: row.pm_response_count || 0,
        avg_pm_response_time: row.avg_pm_response_time || 0,
        validated_rescues: row.validated_rescues || 0,
        login_streak: row.login_streak || 0,
        last_daily_login: row.last_daily_login || 0,
        last_ranking_reward: row.last_ranking_reward || null,
        last_daily_star_reward: row.last_daily_star_reward || null,
        last_depenses_reset: row.last_depenses_reset || null,
        depenses: row.depenses || 0,
        course_stars_avg: row.course_stars_avg || 0,
        active_skin: row.active_skin || 'bleu basique',
        active_fond: row.active_fond || 'Vagues',
        color: row.color || null,
        penalized_inactive: !!row.penalized_inactive,
        graph_pt: stmts.getPointsHistory.all(row.username).map(r => ({ date: r.date, points: r.points })),
        badges_current: stmts.getBadgesCurrent.all(row.username).map(r => r.badge_id),
        badges_obtained: stmts.getBadgesObtained.all(row.username).map(r => r.badge_id),
        skins_obtenus: stmts.getSkins.all(row.username).map(r => r.skin_id),
        fonds_obtenus: stmts.getFonds.all(row.username).map(r => r.fond_id),
        connection_hours: stmts.getConnectionHours.all(row.username).map(r => r.hour),
        pages_visited: stmts.getPagesVisited.all(row.username).map(r => r.page),
        reports: stmts.getReports.all(row.username),
        warnings: stmts.getAllWarnings.all(row.username).map(w => ({
            reason: w.reason, timestamp: w.timestamp, expiresAt: w.expires_at, issuedBy: w.issued_by
        })),
        social_profile: {
            banner: row.social_banner || 'bleu basique',
            status: row.social_status || '',
            badge_showcase: stmts.getBadgeShowcase.all(row.username).map(r => r.badge_id)
        },
        purchase_history: stmts.getPurchases.all(row.username).map(p => ({
            at: p.purchased_at, type: p.type, itemId: p.item_id, price: p.price
        }))
    };
}

// ============================================================
// HELPER: Save full user object to DB (from JSON-shaped object)
// ============================================================
const saveUserFromObject = db.transaction((u) => {
    const params = {
        username: u.username,
        password_hash: u.passwordHash || u.password_hash || '',
        pt: u.pt || 0,
        connexions: u.connexions || 0,
        last_connexion: u.last_connexion || null,
        active: u.active ? 1 : 0,
        banned: u.banned ? 1 : 0,
        ban_until: u.ban_until || null,
        ban_reason: u.ban_reason || null,
        birth_date: u.birth_date || null,
        messages_total: u.messages_total || 0,
        messages_fill_count: u.messages_fill_count || 0,
        messages_ai_count: u.messages_ai_count || 0,
        pm_messages_count: u.pm_messages_count || 0,
        pm_response_count: u.pm_response_count || 0,
        avg_pm_response_time: u.avg_pm_response_time || 0,
        validated_rescues: u.validated_rescues || 0,
        login_streak: u.login_streak || 0,
        last_daily_login: u.last_daily_login || 0,
        last_ranking_reward: u.last_ranking_reward || null,
        last_daily_star_reward: u.last_daily_star_reward || null,
        last_depenses_reset: u.last_depenses_reset || null,
        depenses: u.depenses || 0,
        course_stars_avg: u.course_stars_avg || 0,
        active_skin: u.active_skin || 'bleu basique',
        active_fond: u.active_fond || 'Vagues',
        color: u.color || null,
        penalized_inactive: u.penalized_inactive ? 1 : 0,
        social_banner: (u.social_profile && u.social_profile.banner) || 'bleu basique',
        social_status: (u.social_profile && u.social_profile.status) || ''
    };

    // Upsert user row
    const existing = stmts.getUser.get(u.username);
    if (existing) {
        stmts.updateUser.run(params);
    } else {
        stmts.insertUser.run(params);
    }

    // graph_pt
    if (Array.isArray(u.graph_pt)) {
        for (const entry of u.graph_pt) {
            stmts.upsertPointsHistory.run(u.username, entry.date, entry.points);
        }
    }

    // badges_current
    stmts.clearBadgesCurrent.run(u.username);
    if (Array.isArray(u.badges_current)) {
        for (const b of u.badges_current) stmts.addBadgeCurrent.run(u.username, b);
    }

    // badges_obtained
    if (Array.isArray(u.badges_obtained)) {
        for (const b of u.badges_obtained) stmts.addBadgeObtained.run(u.username, b);
    }

    // skins
    if (Array.isArray(u.skins_obtenus)) {
        for (const s of u.skins_obtenus) stmts.addSkin.run(u.username, s);
    }

    // fonds
    if (Array.isArray(u.fonds_obtenus)) {
        for (const f of u.fonds_obtenus) stmts.addFond.run(u.username, f);
    }

    // connection_hours
    if (Array.isArray(u.connection_hours)) {
        for (const h of u.connection_hours) stmts.addConnectionHour.run(u.username, h);
    }

    // pages_visited
    if (Array.isArray(u.pages_visited)) {
        for (const p of u.pages_visited) stmts.addPageVisited.run(u.username, p);
    }

    // reports
    if (Array.isArray(u.reports)) {
        for (const r of u.reports) {
            stmts.addReport.run(u.username, r.reported_by || r.reportedBy || null, r.reason || null, r.timestamp || null);
        }
    }

    // warnings
    if (Array.isArray(u.warnings)) {
        for (const w of u.warnings) {
            stmts.addWarning.run(u.username, w.reason || null, w.timestamp || null, w.expiresAt || w.expires_at || null, w.issuedBy || w.issued_by || null);
        }
    }

    // badge_showcase
    stmts.clearBadgeShowcase.run(u.username);
    if (u.social_profile && Array.isArray(u.social_profile.badge_showcase)) {
        u.social_profile.badge_showcase.forEach((b, i) => {
            stmts.setBadgeShowcase.run(u.username, b, i);
        });
    }

    // purchase_history
    if (Array.isArray(u.purchase_history)) {
        for (const p of u.purchase_history) {
            stmts.addPurchase.run(u.username, p.type || null, p.itemId || p.item_id || null, p.price || 0);
        }
    }
});

// ============================================================
// HIGH-LEVEL API (drop-in replacements for JSON read/write)
// ============================================================

function readUsers() {
    return stmts.getAllUsers.all().map(buildUserObject);
}

function writeUsers(users) {
    const tx = db.transaction(() => {
        for (const u of users) saveUserFromObject(u);
    });
    tx();
}

function getUserByName(username) {
    const row = stmts.getUserLower.get(username);
    return row ? buildUserObject(row) : null;
}

function addPointsToUser(username, points) {
    stmts.addPoints.run(points, username);
}

function spendUserPoints(username, points) {
    const info = stmts.spendPoints.run(points, points, username, points);
    return info.changes > 0;
}

function checkUserPoints(username, amount) {
    const row = stmts.getUserPoints.get(username);
    return row ? row.pt >= amount : false;
}

// Course helpers
function buildCourseObject(row) {
    if (!row) return null;
    const votes_by = stmts.getCourseVotes.all(row.id).map(v => ({
        username: v.username, vote: v.vote, at: v.voted_at
    }));
    return {
        id: row.id,
        title: row.title,
        subject: row.subject,
        description: row.description,
        uploaderName: row.uploader_name,
        filePath: row.file_path,
        uploadedAt: row.uploaded_at,
        deleteTimer: row.delete_timer,
        supprime: !!row.supprime,
        deletedAt: row.deleted_at || null,
        score_sum: row.score_sum || 0,
        votes_total: row.votes_total || 0,
        stars: row.stars || 0,
        status: row.status || 'waiting',
        evaluationStartAt: row.evaluation_start_at,
        evaluationFinalizedAt: row.evaluation_finalized_at || null,
        votes_by,
        uploaderRewardAppliedAt: row.uploader_reward_applied_at || null,
        uploaderRewardPoints: row.uploader_reward_points || 0
    };
}

function readAllCourses() {
    return stmts.getAllCourses.all().map(buildCourseObject);
}

function writeAllCourses(courses) {
    const tx = db.transaction(() => {
        for (const c of courses) {
            const params = {
                id: c.id,
                title: c.title || '',
                subject: c.subject || 'Inconnu',
                description: c.description || '',
                uploader_name: c.uploaderName || c.uploader_name || '',
                file_path: c.filePath || c.file_path || '',
                uploaded_at: c.uploadedAt || c.uploaded_at || null,
                delete_timer: c.deleteTimer || c.delete_timer || 300,
                supprime: c.supprime ? 1 : 0,
                deleted_at: c.deletedAt || c.deleted_at || null,
                score_sum: c.score_sum || 0,
                votes_total: c.votes_total || 0,
                stars: c.stars || 0,
                status: c.status || 'waiting',
                evaluation_start_at: c.evaluationStartAt || c.evaluation_start_at || null,
                evaluation_finalized_at: c.evaluationFinalizedAt || c.evaluation_finalized_at || null,
                uploader_reward_applied_at: c.uploaderRewardAppliedAt || c.uploader_reward_applied_at || null,
                uploader_reward_points: c.uploaderRewardPoints || c.uploader_reward_points || 0
            };
            const existing = stmts.getCourse.get(c.id);
            if (existing) {
                stmts.updateCourse.run(params);
            } else {
                stmts.insertCourse.run(params);
            }
            // Sync votes
            if (Array.isArray(c.votes_by)) {
                for (const v of c.votes_by) {
                    stmts.addCourseVote.run(c.id, v.username, v.vote);
                }
            }
        }
    });
    tx();
}

// ============================================================
// EXPORT
// ============================================================
module.exports = {
    db,
    stmts,
    buildUserObject,
    saveUserFromObject,
    readUsers,
    writeUsers,
    getUserByName,
    addPointsToUser,
    spendUserPoints,
    checkUserPoints,
    buildCourseObject,
    readAllCourses,
    writeAllCourses
};
