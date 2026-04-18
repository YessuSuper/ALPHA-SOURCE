'use strict';
const express = require('express');
const router = express.Router();
const { Vibrant } = require('node-vibrant/node');
const {
    fs, path,
    PUBLIC_API_DIR, UPLOADS_DIR,
    uploadCourse, uploadProfilePic,
    readAllCoursesFromJSON, writeAllCoursesToJSON,
    getFilteredActiveCourses, deleteCourseFromJSON,
    ensureCourseEvalFields, userHasVoted, safeLower,
    computeStarsFromCourseServer, computeMajorityVoteKey,
    getCourseEvalStartMs, getVoteKeyFromNumeric, finalizeCourseIfNeeded,
    INITIAL_DELETE_TIMER_SECONDS, COURSE_EVAL_WINDOW_MS,
    contributeToChallenge,
    db, stmts, buildUserObject, saveUserFromObject
} = require('./shared');
const { addPoints } = require('../js/points');

function applyCourseAgingAndPersistIfNeeded() {
    try {
        const nowMs = Date.now();
        const courses = readAllCoursesFromJSON();
        let changed = false;
        for (const c of courses) {
            if (!c || typeof c !== 'object') continue;
            if (c.supprime === true) continue;
            ensureCourseEvalFields(c);
            const startMs = getCourseEvalStartMs(c);
            const inWindow = (nowMs - startMs) < COURSE_EVAL_WINDOW_MS;
            if (inWindow) {
                if (c.status !== 'waiting') { c.status = 'waiting'; changed = true; }
            } else {
                if (Number(c.votes_total || 0) <= 0) {
                    if (c.status !== 'suspension') { c.status = 'suspension'; changed = true; }
                }
            }
            if (finalizeCourseIfNeeded(c, nowMs, addPoints)) changed = true;
        }
        if (changed) writeAllCoursesToJSON(courses);
    } catch (e) {
        console.warn('[COURS] applyCourseAgingAndPersistIfNeeded failed:', e.message);
    }
}

// --- POST : Uploader un cours ---
router.post('/public/api/course/upload', uploadCourse.single('course-file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'Fichier manquant, espÃ¨ce de petite frappe.' });

    const { title, subject, description, uploaderName } = req.body;
    const uploadedAt = new Date().toISOString();
    const newCourse = {
        id: Date.now(),
        title: title || req.file.originalname,
        subject: subject || "Inconnu",
        description: description || "Pas de description",
        uploaderName: uploaderName || "Anonyme",
        filePath: `/uploads/${req.file.filename}`,
        uploadedAt,
        deleteTimer: INITIAL_DELETE_TIMER_SECONDS,
        supprime: false,
        score_sum: 0,
        votes_total: 0,
        stars: 0,
        status: 'waiting',
        evaluationStartAt: uploadedAt,
        evaluationFinalizedAt: null,
        votes_by: [],
        uploaderRewardAppliedAt: null,
        uploaderRewardPoints: 0
    };

    try {
        const allCourses = readAllCoursesFromJSON();
        allCourses.push(newCourse);
        writeAllCoursesToJSON(allCourses);
        contributeToChallenge(newCourse.uploaderName || 'Anonyme', 'cours');
        console.log(`[COURS] Nouveau cours uploadÃ© : ${newCourse.title} (ID: ${newCourse.id})`);
        return res.status(201).json({ success: true, course: newCourse, message: 'Cours uploadé et enregistré !' });
    } catch (e) {
        console.error("[COURS] Erreur lors de l'enregistrement du cours :", e);
        fs.unlink(req.file.path, () => console.log(`[Cleanup] Fichier ${req.file.filename} supprimÃ© suite Ã  l'Ã©chec JSON.`));
        return res.status(500).json({ success: false, message: "Erreur serveur lors de l'enregistrement dans cours.json." });
    }
});

// --- GET : Lister les cours actifs ---
router.get('/public/api/course/list', (req, res) => {
    try {
        const username = req.query && req.query.username ? String(req.query.username) : '';
        applyCourseAgingAndPersistIfNeeded();

        const activeCourses = getFilteredActiveCourses();
        const courses = activeCourses.map(c => {
            const course = ensureCourseEvalFields({ ...c });

            const hasVoted = userHasVoted(course, username);
            const isWaiting = course.status === 'waiting';
            const isSuspension = course.status === 'suspension' && Number(course.votes_total || 0) <= 0;

            const hideStars = (isWaiting || isSuspension) && !hasVoted;

            if (hideStars) {
                course.stars = null;
            }

            course.hide_stars = hideStars;
            course.has_voted = hasVoted;
            course.can_vote = Boolean(username) && !hasVoted && safeLower(username) !== safeLower(course.uploaderName);

            return course;
        });

        return res.json({ success: true, courses });
    } catch (e) {
        console.error("Erreur listage cours:", e);
        return res.status(500).json({ success: false, message: "Erreur serveur lors du listage des cours." });
    }
});

// --- POST : Voter pour un cours (bon/moyen/mauvais) ---
router.post('/public/api/course/vote', express.json(), (req, res) => {
    const { courseId, vote, username } = req.body || {};
    const numericVote = Number(vote);
    const allowed = [1, 0.5, -1];
    if (!courseId || !allowed.includes(numericVote)) {
        return res.status(400).json({ success: false, message: 'ParamÃ¨tres vote invalides' });
    }
    const voterName = String(username || '').trim();
    if (!voterName) {
        return res.status(401).json({ success: false, message: "Nom d'utilisateur manquant" });
    }

    try {
        const courses = readAllCoursesFromJSON();
        const idx = courses.findIndex(c => String(c.id) === String(courseId) && c.supprime !== true);
        if (idx === -1) return res.status(404).json({ success: false, message: 'Cours introuvable ou supprimÃ©' });

        const course = courses[idx];
        ensureCourseEvalFields(course);

        if (safeLower(course.uploaderName) === safeLower(voterName)) {
            return res.status(403).json({ success: false, message: "L'uploader ne peut pas voter pour son propre cours" });
        }
        if (userHasVoted(course, voterName)) {
            return res.status(409).json({ success: false, message: "Tu as dÃ©jÃ  votÃ© pour ce cours" });
        }

        if (course.status === 'suspension') {
            course.status = 'waiting';
            course.evaluationStartAt = new Date().toISOString();
            course.evaluationFinalizedAt = null;
        }

        const beforeVotes = Number(course.votes_total || 0);
        course.score_sum = Number(course.score_sum || 0) + numericVote;
        course.votes_total = Number(course.votes_total || 0) + 1;

        course.votes_by = Array.isArray(course.votes_by) ? course.votes_by : [];
        course.votes_by.push({
            username: voterName,
            vote: numericVote,
            at: new Date().toISOString()
        });

        course.stars = computeStarsFromCourseServer(course);

        let pointsAwarded = 0;
        const nowMs = Date.now();
        const startMs = getCourseEvalStartMs(course);
        const inWindow = (nowMs - startMs) < COURSE_EVAL_WINDOW_MS;
        const afterVoteIndex = beforeVotes + 1;

        const voterVoteKey = getVoteKeyFromNumeric(numericVote);
        const majorityKeyAfter = computeMajorityVoteKey(course);

        if (inWindow) {
            if (afterVoteIndex === 1 || afterVoteIndex === 2) {
                pointsAwarded = 5;
            } else {
                if (majorityKeyAfter && voterVoteKey === majorityKeyAfter) pointsAwarded = 3;
            }
        } else {
            if (majorityKeyAfter && voterVoteKey === majorityKeyAfter) pointsAwarded = 2;
        }

        if (pointsAwarded > 0) {
            try {
                addPoints(voterName, pointsAwarded);
            } catch (e) {
                console.warn('[COURS] addPoints voter failed:', e.message);
            }
        }

        courses[idx] = course;
        writeAllCoursesToJSON(courses);

        try {
            finalizeCourseIfNeeded(course, Date.now(), addPoints);
            courses[idx] = course;
            writeAllCoursesToJSON(courses);
        } catch (e) {
            console.warn('[COURS] finalize after vote failed:', e.message);
        }

        const hideStars = (course.status === 'waiting') && !userHasVoted(course, voterName);

        return res.json({
            success: true,
            stars: hideStars ? null : course.stars,
            votes: course.votes_total,
            pointsAwarded,
            course: {
                ...course,
                stars: hideStars ? null : course.stars,
                hide_stars: hideStars,
                has_voted: true,
                can_vote: false
            }
        });
    } catch (e) {
        console.error('Erreur vote cours:', e);
        return res.status(500).json({ success: false, message: 'Erreur serveur lors du vote.' });
    }
});

// --- DELETE : Supprimer un cours (supprime logique) ---
router.delete('/public/api/course/delete/:id', (req, res) => {
    const courseId = req.params.id;
    if (!courseId) return res.status(400).json({ success: false, message: 'ID de cours manquant.' });

    try {
        const wasDeleted = deleteCourseFromJSON(courseId);
        if (wasDeleted) {
            console.log(`[COURS] Suppression logique rÃ©ussie pour ID : ${courseId}`);
            return res.json({ success: true, message: `Cours ID ${courseId} marquÃ© comme supprimÃ©.` });
        } else {
            console.log(`[COURS] ID non trouvÃ© ou dÃ©jÃ  supprimÃ© : ${courseId}`);
            return res.status(404).json({ success: false, message: `Cours ID ${courseId} non trouvÃ© ou dÃ©jÃ  supprimÃ©.` });
        }
    } catch (e) {
        console.error("[COURS] Erreur suppression logique :", e);
        return res.status(500).json({ success: false, message: "Erreur serveur lors de la suppression logique." });
    }
});

// --- POST : Upload photo de profil ---
router.post('/public/api/profile/upload-avatar', uploadProfilePic.single('avatar'), async (req, res) => {
    try {
        const username = req.body.username;

        if (!username) {
            return res.status(400).json({ success: false, message: 'Nom d\'utilisateur manquant' });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Aucun fichier uploadé' });
        }

        const avatarPath = `/api/community/ressources/pp/${req.file.filename}`;

        const imagePath = path.join(__dirname, '..', 'public', 'api', 'community', 'ressources', 'pp', req.file.filename);
        let dominantColor = 'red';

        try {
            const v = new Vibrant(imagePath);
            const palette = await v.getPalette();
            if (palette.LightVibrant) {
                dominantColor = palette.LightVibrant.hex;
            } else if (palette.LightMuted) {
                dominantColor = palette.LightMuted.hex;
            } else if (palette.Vibrant) {
                dominantColor = palette.Vibrant.hex;
            } else if (palette.Muted) {
                dominantColor = palette.Muted.hex;
            } else if (palette.DarkVibrant) {
                dominantColor = palette.DarkVibrant.hex;
            } else if (palette.DarkMuted) {
                dominantColor = palette.DarkMuted.hex;
            }
        } catch (colorError) {
            console.warn('[PROFILE] Erreur extraction couleur:', colorError.message);
        }

        // Update user color in SQL
        try {
            const userRow = stmts.getUserLower.get(username.toLowerCase());
            if (userRow) {
                const user = buildUserObject(userRow);
                user.color = dominantColor;
                saveUserFromObject(user);
            }
        } catch (e) { console.warn('[PROFILE] SQL user color update failed:', e.message); }

        // Update profile pic in SQL + pp.json for frontend compat
        stmts.upsertProfilePic.run(username, avatarPath);

        const ppJsonPath = path.join(__dirname, '..', 'public', 'api', 'community', 'ressources', 'pp', 'pp.json');
        let ppData = {};
        try { ppData = JSON.parse(fs.readFileSync(ppJsonPath, 'utf8')); } catch {}
        ppData[username] = avatarPath;
        fs.writeFileSync(ppJsonPath, JSON.stringify(ppData, null, 2));

        console.log(`[PROFILE] Avatar mis à jour pour ${username}`);

        res.json({
            success: true,
            message: 'Photo de profil mise à jour avec succès',
            avatarPath: avatarPath,
            color: dominantColor
        });

    } catch (error) {
        console.error('[PROFILE] Erreur:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur lors de l\'upload' });
    }
});

module.exports = router;
module.exports.applyCourseAgingAndPersistIfNeeded = applyCourseAgingAndPersistIfNeeded;

