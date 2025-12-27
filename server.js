// server.js (Version corrigée avec POINTS GÉRÉS PAR all.json - FIN DU SQLITE)
const express = require('express');
const { GoogleGenAI } = require('@google/genai');
const dotenv = require('dotenv');
const path = require('path');
const multer = require('multer');
const fsPromises = require('fs').promises;
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { spawn } = require('child_process');
const { checkAndApplyDailyLogin, incrementMessageCount, rewardTopicCreatorForFill, checkPointsForAction, deductPoints } = require('./js/points.js');
// const { log, logToFile } = require('./logger.js');

// ----------------------------------------
console.log("JS chargé");
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// === Gemini (si clé fournie) ===
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
let ai = null;
if (GEMINI_API_KEY) {
    try {
        ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    } catch (e) {
        console.warn("Impossible d'initialiser GoogleGenAI :", e.message);
    }
}
const model = "gemini-2.5-flash";

// === Chemins et dossiers nécessaires ===
const IMAGES_DIR = path.join(__dirname, 'images');
const PUBLIC_API_DIR = path.join(__dirname, 'public', 'api');
const MESSAGES_PATH = path.join(PUBLIC_API_DIR, 'messagerie/messages.json'); // Reste pour la Messagerie Pro
const USERS_PATH = path.join(PUBLIC_API_DIR, 'users.json');



// 🚨 CORRIGÉ 🚨 : COURS_PATH est bien ici
const COURS_PATH = path.join(PUBLIC_API_DIR, 'cours.json');

// 🚨 CORRIGÉ 🚨 : ANCIEN USERS_PATH DEVIENT ALL_PATH
const ALL_PATH = path.join(PUBLIC_API_DIR, 'all.json');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
const DATA_DIR = path.join(__dirname, 'data');
const COURS_FILE_PATH = path.join(PUBLIC_API_DIR, 'cours.json');
const BDD_FILE_PATH = path.join(PUBLIC_API_DIR, 'bdd.json');

console.log(`🗿 Le fichier BDD va être créé/lu à l'emplacement exact : ${BDD_FILE_PATH}`);

// ---------------------------------------------
[IMAGES_DIR, PUBLIC_API_DIR, UPLOADS_DIR, DATA_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Création du dossier manquant : ${dir}`);
    }
});

// Initialisation des fichiers JSON/TXT
function ensureMessagesFile() {
    try {
        if (!fs.existsSync(MESSAGES_PATH)) {
            fs.writeFileSync(MESSAGES_PATH, JSON.stringify([], null, 2), 'utf8');
            return;
        }
        const raw = fs.readFileSync(MESSAGES_PATH, 'utf8').trim();
        if (!raw) {
            fs.writeFileSync(MESSAGES_PATH, JSON.stringify([], null, 2), 'utf8');
            return;
        }
        JSON.parse(raw);
    } catch (e) {
        console.warn("messages.json invalide, réinitialisation en tableau vide.");
        fs.writeFileSync(MESSAGES_PATH, JSON.stringify([], null, 2), 'utf8');
    }
}
ensureMessagesFile();

function ensureCoursFile() {
    try {
        if (!fs.existsSync(COURS_FILE_PATH)) {
            fs.writeFileSync(COURS_FILE_PATH, JSON.stringify([], null, 2), 'utf8');
            console.log(`Fichier cours.json créé à : ${COURS_FILE_PATH}`);
            return;
        }
        JSON.parse(fs.readFileSync(COURS_FILE_PATH, 'utf8').trim() || '[]');
    } catch (e) {
        console.warn("PUTAIN AVERTISSEMENT : cours.json invalide, réinitialisation en tableau vide.");
        fs.writeFileSync(COURS_FILE_PATH, JSON.stringify([], null, 2), 'utf8');
    }
}
ensureCoursFile();

// 🚨 CORRIGÉ 🚨 : ASSURER L'EXISTENCE DE ALL.JSON (anciennement ensureUsersFile)
function ensureAllFile() {
    try {
        if (!fs.existsSync(ALL_PATH)) {
            // all.json contient l'array des utilisateurs (comme users.json le faisait)
            fs.writeFileSync(ALL_PATH, JSON.stringify([], null, 2), 'utf8');
            console.log(`Fichier all.json créé à : ${ALL_PATH}. Structure : Tableau vide.`);
            return;
        }
        JSON.parse(fs.readFileSync(ALL_PATH, 'utf8').trim() || '[]');
    } catch (e) {
        console.warn("PUTAIN AVERTISSEMENT : all.json invalide, réinitialisation en tableau vide.");
        fs.writeFileSync(ALL_PATH, JSON.stringify([], null, 2), 'utf8');
    }
}
ensureAllFile();

// =================================================================
// GESTION DE LA BDD ÉVOLUTIVE (bdd.json en TEXTE UNIQUE)
// ... (Fonctions inchangées) ...
function ensureBddFile() {
    try {
        const dir = path.dirname(BDD_FILE_PATH); // Récupère le dossier cible

        // 🚨 CRITIQUE : Crée le dossier (/public/api) s'il n'existe pas !
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`Dossier BDD créé : ${dir}`);
        }
        
        // Lire le contenu du fichier s'il existe
        let rawContent = '';
        if (fs.existsSync(BDD_FILE_PATH)) {
            rawContent = fs.readFileSync(BDD_FILE_PATH, 'utf8').trim();
        }

        let shouldInitialize = !fs.existsSync(BDD_FILE_PATH) || rawContent === '';
        
        // Vérifie si le contenu est l'ancienne structure vide (celle que tu m'as montrée)
        if (!shouldInitialize && rawContent) {
            try {
                const currentData = JSON.parse(rawContent);
                if (currentData.bdd === "Base de donnée vide" && currentData.historiques.length === 0) {
                    shouldInitialize = true; // Écraser l'ancienne structure vide
                }
            } catch (e) {
                // Fichier corrompu, on doit l'écraser
                shouldInitialize = true;
                console.warn("PUTAIN AVERTISSEMENT : bdd.json corrompu, réinitialisation forcée.", e);
            }
        }

        if (shouldInitialize) {
            const initialData = {
                derniere_maj: `Date exacte: Dimanche 14 décembre 2025 à 16:53:15`,
                historiques: [],
                nouvelles_infos: [],
                bdd: "Base de donnée évolutive de l'IA. Prête à enregistrer les infos dans le répertoire cible."
            };
            fs.writeFileSync(BDD_FILE_PATH, JSON.stringify(initialData, null, 2), 'utf8');
            console.log(`BDD OK : Fichier bdd.json créé/réinitialisé dans ${dir}.`);
        } else {
             // Si le fichier n'a pas été écrasé, on vérifie juste qu'il est parsable pour le catch
             JSON.parse(rawContent); 
        }

    } catch (e) {
        // Cette erreur attrape les cas où le JSON était corrompu et non pris par le catch interne
        console.error("PUTAIN ERREUR FATALE dans ensureBddFile :", e);
        // On réinitialise quand même en cas d'erreur fatale
        const initialData = {
             derniere_maj: `Date exacte: Dimanche 14 décembre 2025 à 16:53:15 (Réinitialisation d'urgence)`,
             historiques: [],
             nouvelles_infos: [],
             bdd: "Base de donnée réinitialisée suite à une erreur de parsing."
         };
         fs.writeFileSync(BDD_FILE_PATH, JSON.stringify(initialData, null, 2), 'utf8');
    }
}
ensureBddFile();

// =================================================================
// 🔥 GESTION DE LA MESSAGERIE DANS messages.json 🔥
// =================================================================

/**
 * Lit et parse tous les messages du fichier messages.json.
 * @returns {Array<Object>} Le tableau des messages.
 */
function readAllMessagesFromJSON() {
    try {
        const rawData = fs.readFileSync(MESSAGES_PATH, 'utf8').trim();
        const messages = JSON.parse(rawData || '[]');
        return Array.isArray(messages) ? messages : [];
    } catch (e) {
        console.error("PUTAIN ERREUR FATALE : Problème lors de la lecture/parsing de messages.json:", e);
        return [];
    }
}



/**
 * Sauvegarde le tableau de messages dans messages.json.
 * @param {Array<Object>} messages
 */
function writeAllMessagesToJSON(messages) {
    try {
        fs.writeFileSync(MESSAGES_PATH, JSON.stringify(messages, null, 2), 'utf8');
    } catch (e) {
        console.error("PUTAIN ÉCHEC : Problème lors de l'écriture dans messages.json:", e);
    }
}

/**
 * Route POST /api/messagerie/send : Gère l'envoi d'un nouveau message.
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
        console.error(`PUTAIN LOG (BACKEND) : Champ manquant : ${missingField}`);
        return res.status(400).json({
            success: false,
            message: `Putain, le champ '${missingField}' est manquant ou vide.`,
            missingField
        });
    }

    // Vérifier points pour message anonyme
    if (isAnonymous && !checkPointsForAction(senderId, 3)) {
        return res.status(400).json({
            success: false,
            message: "Pas assez de points pour envoyer un message anonyme (-3 points requis)."
        });
    }

    // 🔒 Sécurisation des pièces jointes (Base64)
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
        status: "unread",
    };

    try {
        const existingMessages = readAllMessagesFromJSON();
        existingMessages.push(newMessage);
        writeAllMessagesToJSON(existingMessages);

        // Déduire points pour anonyme
        if (isAnonymous) {
            deductPoints(senderId, 3);
        }

        console.log(
            `[MESSAGERIE] Message stocké (ID: ${newMessage.id}, PJ: ${safeAttachments.length}, Anonyme: ${isAnonymous})`
        );

        return res.status(200).json({
            success: true,
            message: "Message enregistré.",
            messageId: newMessage.id
        });

    } catch (error) {
        console.error("PUTAIN LOG (BACKEND) : Erreur de sauvegarde JSON Messagerie:", error);
        return res.status(500).json({
            success: false,
            message: "Erreur serveur lors de l'enregistrement du message."
        });
    }
}

/**
 * Route GET /api/messagerie/messages : Lit les messages de l'utilisateur courant (ID '2' pour 'User Sigma' / 'Moi').
 */
function handleMessagesRead(req, res) {
    // 🚨 CORRECTION : Récupérer l'ID de l'utilisateur courant depuis l'URL (ex: /messages?userId=5)
    // Sinon, on garde '2' par défaut pour ne pas tout casser si le paramètre est absent.
    const CURRENT_USER_ID = req.query.userId || '2'; 
    
    // Tu peux mettre cette liste en dur ici pour le test, mais idéalement elle vient aussi d'un fichier JSON
    const USERS_DATA_SIMULATED = [
        { id: '1', name: 'Kira AI (Bot)' },
        { id: '2', name: 'Moi (Yessu)' },
        { id: '3', name: 'Even' },
        { id: '5', name: 'Calixte' },
        { id: 'anon', name: 'Anonyme' },
        // On continue avec la suite des IDs...
        { id: '6', name: 'Alexandre' },
        { id: '7', name: 'Noé' },
        { id: '8', name: 'Julia' },
        { id: '9', name: 'Joan' },
        { id: '10', name: 'Juliette' },
        { id: '11', name: 'Jezzy' },
        { id: '12', name: 'Inès' },
        { id: '13', name: 'Timéo' },
        { id: '14', name: 'Tyméo' },
        { id: '15', name: 'Clautilde' },
        { id: '16', name: 'Loanne' },
        { id: '17', name: 'Lucie' },
        { id: '18', name: 'Camille' },
        { id: '19', name: 'Sofia' },
        { id: '20', name: 'Lilia' },
        { id: '21', name: 'Amir' },
        { id: '22', name: 'Robin' },
        { id: '23', name: 'Arthur' },
        { id: '24', name: 'Maxime' },
        { id: '25', name: 'Gaultier' },
        { id: '26', name: 'Antoine' },
        { id: '27', name: 'Louis' },
        { id: '28', name: 'Anne-Victoria' },
        { id: '29', name: 'Léa' },
        { id: '30', name: 'Sarah' },
        { id: '31', name: 'Ema' },
        { id: '32', name: 'Jade' },
        { id: '33', name: 'Alicia' },
        { id: '34', name: 'Claire' },
    ];
    
    try {
        const allMessages = readAllMessagesFromJSON();
        
        // 🚨 ATTENTION : Utilise .toString() pour les comparaisons sécurisées (les IDs JSON sont des chaînes)
        const filteredMessages = allMessages.filter(msg => {
            // Est l'expéditeur du message
            if (msg.senderId.toString() === CURRENT_USER_ID.toString()) {
                return true;
            }
            // Est un des destinataires du message
            if (Array.isArray(msg.recipients) && msg.recipients.includes(CURRENT_USER_ID.toString())) {
                return true;
            }
            // Cas spécial : si le message est anonyme et qu'on veut le lier à un user précis, 
            // c'est compliqué, on va donc garder le comportement par défaut (pour l'instant).
            
            return false;
        });
        
        const finalMessages = filteredMessages.map(msg => {
            const senderInfo = USERS_DATA_SIMULATED.find(u => u.id === msg.senderId);
            const senderName = senderInfo ? senderInfo.name : (msg.senderId === 'anon' ? 'Anonyme' : 'Inconnu');
            
            // Mappe les IDs des destinataires vers leurs noms
            const recipientNames = Array.isArray(msg.recipients) ? msg.recipients.map(id => {
                const recipientInfo = USERS_DATA_SIMULATED.find(u => u.id === id);
                return recipientInfo ? recipientInfo.name : id;
            }) : [];
            
            return {
                ...msg,
                senderName: senderName,
                recipients: recipientNames, // Retourne les noms des destinataires
                date: new Date(msg.timestamp).toLocaleDateString('fr-FR', { month: '2-digit', day: '2-digit' }),
                unread: msg.status === "unread"
            };
        }).sort((a, b) => b.id.localeCompare(a.id));
        
        console.log(`[MESSAGERIE] ${finalMessages.length} messages envoyés à l'utilisateur ID '${CURRENT_USER_ID}'.`);
        return res.status(200).json(finalMessages);
        
    } catch (error) {
        console.error("PUTAIN LOG (BACKEND) : Erreur de lecture JSON Messagerie:", error);
        return res.status(500).json({ success: false, message: "Erreur serveur lors de la lecture des messages." });
    }
}


// =================================================================
// 🔥 GESTION DE LA BDD ÉVOLUTIVE 🔥
// =================================================================

/**
 * Ajoute une interaction dans la BDD évolutive.
 * @param {string} username - Nom de l'utilisateur
 * @param {string} userMessage - Message envoyé par l'utilisateur
 * @param {string} aiResponse - Réponse de l'IA
 * @returns {boolean} true si succès, false sinon
 */

/**
 * Lit la BDD évolutive complète
 * @returns {Object} { bdd: string, historiques: Array }
 */
function readEvolvingDB() {
    try {
        if (!fs.existsSync(BDD_FILE_PATH)) return { bdd: "Base de donnée vide", historiques: [] };
        const rawData = fs.readFileSync(BDD_FILE_PATH, 'utf8');
        const data = rawData.trim() ? JSON.parse(rawData) : { bdd: "Base de donnée vide", historiques: [] };
        return data;
    } catch (e) {
        console.error("Erreur readEvolvingDB :", e);
        return { bdd: "Base de donnée vide (Erreur de lecture)", historiques: [] };
    }
}

// =================================================================
// ROUTE GET pour récupérer la BDD évolutive
// =================================================================
app.get('/public/api/bdd.json', (req, res) => {
    try {
        const data = readEvolvingDB();
        res.json(data);
    } catch (e) {
        console.error("Erreur GET /api/bdd :", e);
        res.status(500).json({ success: false, message: "Erreur serveur lors de la lecture de la BDD" });
    }
});


// =================================================================
// --------------------------------------------------------------------------------------------------
// 🚨 NOUVELLE FONCTION : AJOUT DE POINT DIRECTEMENT DANS ALL.JSON 🚨
// --------------------------------------------------------------------------------------------------
/*function addPointToAllJSON(username) {
    if (!username) return 0;

    ensureAllFile();

    let fileContent = {};
    let usersArray = []; // C'est ici qu'on va stocker le tableau des utilisateurs à modifier

    try {
        const rawData = fs.readFileSync(ALL_PATH, 'utf8') || '[]';
        const parsedData = JSON.parse(rawData);

        // 🚨 Logique de vérification de la structure du fichier all.json
        if (Array.isArray(parsedData)) {
            // Cas 1 : Le fichier est un simple tableau d'utilisateurs (comme la fonction ensureAllFile le crée)
            fileContent = parsedData; // Pour l'écriture, on utilisera directement le tableau
            usersArray = parsedData;
        } else if (typeof parsedData === 'object' && parsedData !== null) {
            // Cas 2 : Le fichier est un objet complexe (avec user_ranking, profs, edt, etc.)
            fileContent = parsedData;
            // On s'assure que 'user_ranking' est un tableau, ou on le crée
            if (!Array.isArray(fileContent.user_ranking)) {
                fileContent.user_ranking = [];
            }
            usersArray = fileContent.user_ranking;
        }
        
    } catch {
        // Si le parsing échoue, on réinitialise à un tableau vide
        usersArray = [];
        fileContent = usersArray;
    }

    // 2. Chercher ou créer l'utilisateur
    let user = usersArray.find(u => u.username === username);
    if (!user) {
        user = { username, points: 0 };
        usersArray.push(user);
    }

    // 3. Ajouter le point
    user.points += 1;

    // 4. Écrire le contenu complet (fileContent)
    // Si fileContent est l'objet complet (Cas 2), il inclut maintenant le usersArray mis à jour.
    // Si fileContent est le usersArray (Cas 1), on écrira juste le tableau.
    fs.writeFileSync(ALL_PATH, JSON.stringify(fileContent, null, 2), 'utf8'); 
    
    return user.points;
}
    */

// =================================================================
// 🔥 GESTION DES COURS DANS COURS.JSON 🔥
// ... (Fonctions inchangées) ...
const INITIAL_DELETE_TIMER_SECONDS = 5 * 60;

function readAllCoursesFromJSON() {
    ensureCoursFile();
    try {
        const rawData = fs.readFileSync(COURS_FILE_PATH, 'utf8').trim();
        const courses = JSON.parse(rawData || '[]');
        return Array.isArray(courses) ? courses : [];
    } catch (e) {
        console.error("PUTAIN ERREUR FATALE : Problème lors de la lecture/parsing de cours.json:", e);
        return [];
    }
}

function writeAllCoursesToJSON(courses) {
    try {
        fs.writeFileSync(COURS_FILE_PATH, JSON.stringify(courses, null, 2), 'utf8');
    } catch (e) {
        console.error("PUTAIN ÉCHEC : Problème lors de l'écriture dans cours.json:", e);
    }
}

function getActiveCoursesForAI() {
    let allCourses = readAllCoursesFromJSON();
    const coursesWithUpdatedTimer = allCourses.map(course => {
        if (course.supprime === true) return { ...course, deleteTimer: 0 };
        if (!course.uploadedAt) return { ...course, deleteTimer: INITIAL_DELETE_TIMER_SECONDS };
        const uploadedDate = new Date(course.uploadedAt);
        const now = new Date();
        const elapsedTimeSeconds = Math.floor((now - uploadedDate) / 1000);
        let remainingTime = Math.max(0, INITIAL_DELETE_TIMER_SECONDS - elapsedTimeSeconds);
        return { ...course, deleteTimer: remainingTime };
    });
    allCourses = coursesWithUpdatedTimer;
    const activeCourses = allCourses.filter(course => course.supprime !== true);
    return activeCourses.map(c => ({ id: c.id, title: c.title, subject: c.subject, description: c.description }));
}

function getFilteredActiveCourses() {
    let allCourses = readAllCoursesFromJSON();
    const coursesWithUpdatedTimer = allCourses.map(course => {
        if (course.supprime === true) return { ...course, deleteTimer: 0 };
        if (!course.uploadedAt) return { ...course, deleteTimer: INITIAL_DELETE_TIMER_SECONDS };
        const uploadedDate = new Date(course.uploadedAt);
        const now = new Date();
        const elapsedTimeSeconds = Math.floor((now - uploadedDate) / 1000);
        let remainingTime = Math.max(0, INITIAL_DELETE_TIMER_SECONDS - elapsedTimeSeconds);
        return { ...course, deleteTimer: remainingTime };
    });
    allCourses = coursesWithUpdatedTimer;
    const activeCourses = allCourses.filter(course => course.supprime !== true);
    activeCourses.sort((a, b) => Number(b.id) - Number(a.id));
    return activeCourses;
}

function deleteCourseFromJSON(courseId) {
    const allCourses = readAllCoursesFromJSON();
    let courseFoundAndDeleted = false;
    const idToDelete = Number(courseId);
    const updatedCourses = allCourses.map(course => {
        if (Number(course.id) === idToDelete && course.supprime !== true) {
            courseFoundAndDeleted = true;
            console.log(`PUTAIN, suppression LOGIQUE appliquée pour le cours ID ${courseId}.`);
            return { ...course, supprime: true, deletedAt: new Date().toISOString() };
        }
        return course;
    });
    if (courseFoundAndDeleted) {
        writeAllCoursesToJSON(updatedCourses);
    }
    return courseFoundAndDeleted;
}

// =================================================================
// 🛑 SUPPRESSION DU CODE SQLITE ET DES FONCTIONS ASSOCIÉES 🛑
// =================================================================

// =================================================================
// MULTER ET MIDDLEWARES
// ... (Code inchangé) ...
// =================================================================
const courseStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + '-' + uniqueSuffix + '-' + file.originalname);
    }
});
const uploadCourse = multer({ storage: courseStorage });

const communityStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const communityDir = path.join(__dirname, 'pictures_documents');
        if (!fs.existsSync(communityDir)) {
            fs.mkdirSync(communityDir, { recursive: true });
        }
        cb(null, communityDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, 'community-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const uploadCommunity = multer({ storage: communityStorage });

const profilePicStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const ppDir = path.join(__dirname, 'public', 'api', 'community', 'ressources', 'pp');
        if (!fs.existsSync(ppDir)) {
            fs.mkdirSync(ppDir, { recursive: true });
        }
        cb(null, ppDir);
    },
    filename: (req, file, cb) => {
        const username = req.body.username || 'unknown';
        const timestamp = Date.now();
        const ext = path.extname(file.originalname);
        cb(null, `${username}_${timestamp}${ext}`);
    }
});
const uploadProfilePic = multer({ storage: profilePicStorage });

// === Middlewares ===
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true }));
app.use('/images', express.static(IMAGES_DIR));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/pictures_documents', express.static(path.join(__dirname, 'pictures_documents')));
app.use('/api/community/ressources/pp', express.static(path.join(__dirname, 'public', 'api', 'community', 'ressources', 'pp')));
app.use(express.static(path.join(__dirname, 'public')));

// =================================================================
// ROUTES
// =================================================================
// Route qui force le nettoyage à l'arrivée sur le site
app.get('/login', (req, res) => {
    console.log("Logout forcé et redirection... 🗿");
    res.send(`
        <script>
            localStorage.clear();
            sessionStorage.clear();
            // On peut même supprimer les cookies si tu en as
            document.cookie.split(";").forEach(function(c) { 
                document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
            });
            window.location.href = '/pages/login.html';
        </script>
    `);
});

// 🚨 NOUVELLE ROUTE COURS (pour l'IA et le Listing) 🚨
app.get('/api/cours', (req, res) => {
    try {
        const filteredCourses = getActiveCoursesForAI();
        res.json(filteredCourses);
        console.log(`[COURS] Liste de ${filteredCourses.length} cours actifs envoyée.`);
    } catch (e) {
        console.error("PUTAIN ERREUR FATALE LORS DE LA LECTURE DE COURS.JSON :", e.message);
        res.status(500).json({ success: false, message: 'Erreur interne serveur lors de la lecture des cours.' });
    }
});

app.post('/api/messagerie/send', handleMessageSave);
console.log("Route POST /api/messagerie/send configurée.");
app.get('/api/messagerie/messages', handleMessagesRead);
console.log("Route GET /api/messagerie/messages configurée.");

// ----------------------------------------------------
// 🚨 ATTENTION : CETTE ROUTE (update-all-db) GÈRE DÉJÀ UNE STRUCTURE SPÉCIFIQUE (user_ranking)
const ALL_DB_PATH = ALL_PATH;

// --- Login ---
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!fs.existsSync(ALL_PATH)) {
        return res.status(500).json({ success: false, message: 'Fichier users.json manquant !' });
    }
    try {
        const rawData = fs.readFileSync(USERS_PATH, 'utf8') || '[]';
        const usersData = JSON.parse(rawData);
        const user = usersData.find(u => u.username.toLowerCase() === username.toLowerCase());
        if (!user) {
            return res.status(401).json({ success: false, message: 'Utilisateur non trouvé.' });
        }
        if (user.banned) {
            return res.status(403).json({ success: false, redirect: '/pages/ban.html', message: 'Utilisateur banni.' });
        }
        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Mot de passe incorrect.' });
        }
        // Check if first login
        const isFirstLogin = user.connexions === 0;
        // Increment connexions
        user.connexions += 1;
        user.last_connexion = Date.now();
        user.active = true;
        // Save updated users data
        fs.writeFileSync(USERS_PATH, JSON.stringify(usersData, null, 2));
        // Check daily login reward
        checkAndApplyDailyLogin(username);
        return res.json({ success: true, redirect: '/index.html', first_login: isFirstLogin, user: { username: user.username, points: user.pt, connexions: user.connexions } });
    } catch (e) {
        console.error("Erreur serveur login :", e);
        return res.status(500).json({ success: false, message: 'Erreur interne serveur.' });
    }
});

// --- Auto increment connexions ---
app.post('/api/auto_increment', async (req, res) => {
    const { username } = req.body;
    if (!username) {
        return res.status(400).json({ success: false, message: 'Username requis.' });
    }
    try {
        const rawData = fs.readFileSync(USERS_PATH, 'utf8') || '[]';
        const usersData = JSON.parse(rawData);
        const user = usersData.find(u => u.username.toLowerCase() === username.toLowerCase());
        if (!user) {
            return res.status(404).json({ success: false, message: 'Utilisateur non trouvé.' });
        }
        if (user.connexions >= 1 && (!user.last_connexion || Date.now() - user.last_connexion >= 3600000)) {
            user.connexions += 1;
            user.last_connexion = Date.now();
            fs.writeFileSync(USERS_PATH, JSON.stringify(usersData, null, 2));
        }
        return res.json({ success: true });
    } catch (e) {
        console.error("Erreur serveur auto_increment :", e);
        return res.status(500).json({ success: false, message: 'Erreur interne serveur.' });
    }
});

// --- Check if user is banned ---
app.post('/api/check_ban', async (req, res) => {
    const { username } = req.body;
    if (!username) {
        return res.status(400).json({ banned: false });
    }
    try {
        const rawData = fs.readFileSync(USERS_PATH, 'utf8') || '[]';
        const usersData = JSON.parse(rawData);
        const user = usersData.find(u => u.username.toLowerCase() === username.toLowerCase());
        if (!user) {
            return res.json({ banned: false });
        }
        return res.json({ banned: user.banned || false });
    } catch (e) {
        console.error("Erreur serveur check_ban :", e);
        return res.status(500).json({ banned: false });
    }
});

// --- GET : Récupérer les infos utilisateur (incluant date de naissance) ---
app.get('/api/user-info/:username', async (req, res) => {
    const username = req.params.username;
    if (!username) {
        return res.status(400).json({ success: false, message: 'Nom d\'utilisateur requis.' });
    }
    try {
        const rawData = fs.readFileSync(USERS_PATH, 'utf8') || '[]';
        const usersData = JSON.parse(rawData);
        const user = usersData.find(u => u.username.toLowerCase() === username.toLowerCase());
        if (!user) {
            return res.status(404).json({ success: false, message: 'Utilisateur non trouvé.' });
        }
        return res.json({
            success: true,
            user: {
                username: user.username,
                birth_date: user.birth_date || null,
                connexions: user.connexions || 0,
                last_connexion: user.last_connexion || null
            }
        });
    } catch (e) {
        console.error("Erreur serveur user-info :", e);
        return res.status(500).json({ success: false, message: 'Erreur interne serveur.' });
    }
});

// Endpoint pour changer le mot de passe
app.post('/api/change-password', async (req, res) => {
    const { username, newPassword } = req.body;
    if (!username || !newPassword) {
        return res.status(400).json({ success: false, message: 'Nom d\'utilisateur et nouveau mot de passe requis.' });
    }
    if (newPassword.length < 3) {
        return res.status(400).json({ success: false, message: 'Le mot de passe doit contenir au moins 3 caractères.' });
    }
    try {
        const rawData = fs.readFileSync(USERS_PATH, 'utf8') || '[]';
        const usersData = JSON.parse(rawData);
        const userIndex = usersData.findIndex(u => u.username.toLowerCase() === username.toLowerCase());
        if (userIndex === -1) {
            return res.status(404).json({ success: false, message: 'Utilisateur non trouvé.' });
        }
        // Générer le nouveau hash
        const saltRounds = 10;
        const newHash = await bcrypt.hash(newPassword, saltRounds);
        usersData[userIndex].passwordHash = newHash;
        // Sauvegarder le fichier
        fs.writeFileSync(USERS_PATH, JSON.stringify(usersData, null, 2), 'utf8');
        return res.json({ success: true, message: 'Mot de passe changé avec succès.' });
    } catch (e) {
        console.error("Erreur serveur change-password :", e);
        return res.status(500).json({ success: false, message: 'Erreur interne serveur.' });
    }
});

// --- Update birth date ---
app.post('/api/update-birth-date', async (req, res) => {
    const { username, birthDate } = req.body;
    if (!username || !birthDate) {
        return res.status(400).json({ success: false, message: 'Nom d\'utilisateur et date de naissance requis.' });
    }
    try {
        const rawData = fs.readFileSync(USERS_PATH, 'utf8') || '[]';
        const usersData = JSON.parse(rawData);
        const userIndex = usersData.findIndex(u => u.username.toLowerCase() === username.toLowerCase());
        if (userIndex === -1) {
            return res.status(404).json({ success: false, message: 'Utilisateur non trouvé.' });
        }
        usersData[userIndex].birth_date = birthDate;
        fs.writeFileSync(USERS_PATH, JSON.stringify(usersData, null, 2));
        return res.json({ success: true, message: 'Date de naissance mise à jour.' });
    } catch (e) {
        console.error("Erreur serveur update-birth-date :", e);
        return res.status(500).json({ success: false, message: 'Erreur interne serveur.' });
    }
});

// --- Update profile pic ---
app.post('/api/update-profile-pic', uploadProfilePic.single('profilePic'), async (req, res) => {
    const { username } = req.body;
    if (!username) {
        return res.status(400).json({ success: false, message: 'Nom d\'utilisateur requis.' });
    }
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'Aucun fichier uploadé.' });
    }
    try {
        const picPath = `/api/community/ressources/pp/${req.file.filename}`;
        
        // Enregistrer UNIQUEMENT dans pp.json
        const ppJsonPath = path.join(__dirname, 'public', 'api', 'community', 'ressources', 'pp', 'pp.json');
        let ppData = {};
        if (fs.existsSync(ppJsonPath)) {
            ppData = JSON.parse(fs.readFileSync(ppJsonPath, 'utf8'));
        }
        ppData[username] = picPath;
        fs.writeFileSync(ppJsonPath, JSON.stringify(ppData, null, 2));
        
        return res.json({ success: true, message: 'Photo de profil mise à jour.', picPath });
    } catch (e) {
        console.error("Erreur serveur update-profile-pic :", e);
        return res.status(500).json({ success: false, message: 'Erreur interne serveur.' });
    }
});



// --- GET : Récupérer les points individuels et collectifs (Ajusté pour JSON)
app.get('/public/api/points/:username', (req, res) => {
    const username = req.params.username;
    try {
        ensureAllFile();
        const raw = fs.readFileSync(ALL_PATH, 'utf8') || '{}';
        const fileContent = JSON.parse(raw);

        let userRanking = [];
        if (fileContent && Array.isArray(fileContent.user_ranking)) {
            userRanking = fileContent.user_ranking;
        } else if (Array.isArray(fileContent)) {
            userRanking = fileContent;
        }

        const allUsersPoints = userRanking.map(u => ({ username: u.username, points: u.points && typeof u.points === 'number' ? u.points : 0 }));
        const currentUserData = allUsersPoints.find(u => u.username === username);
        const collectivePoints = allUsersPoints.reduce((sum, user) => sum + user.points, 0);
        const ranking = allUsersPoints.sort((a, b) => b.points - a.points);

        return res.json({ individualPoints: currentUserData ? currentUserData.points : 0, collectivePoints: collectivePoints, ranking: ranking });
    } catch (e) {
        console.error("PUTAIN JSON : Erreur à la récupération des points via all.json", e.message);
        return res.status(500).json({ error: "Erreur serveur lors de la lecture des points via JSON." });
    }
});

// --- Get guide ---
app.get('/api/guide', (req, res) => {
    try {
        const guidePath = path.join(__dirname, 'guide.json');
        if (!fs.existsSync(guidePath)) {
            return res.json({ pages: [] });
        }
        const rawData = fs.readFileSync(guidePath, 'utf8');
        const guideData = JSON.parse(rawData);
        // Process pages to include images
        const processedPages = guideData.pages.map(page => {
            let content = page.content || '';
            if (page.image) {
                content += `<img src="${page.image}" alt="Guide image" style="max-width: 100%; margin-top: 20px;">`;
            }
            return { content };
        });
        return res.json({ pages: processedPages });
    } catch (e) {
        console.error("Erreur serveur guide :", e);
        return res.status(500).json({ error: "Erreur interne serveur." });
    }
});

// --- NOUVELLES CONSTANTES ET UTILITAIRES BDD (à mettre en haut de server.js) ---

/**
 * Lit la BDD évolutive complète (pour l'IA d'Analyse)
 * @returns {string | null} Le contenu de bdd.json en JSON stringifié
 */
function getEvolvingDBContent() {
    try {
        if (!fs.existsSync(BDD_FILE_PATH)) {
            ensureBddFile();
        }
        return fs.readFileSync(BDD_FILE_PATH, 'utf8');
    } catch (e) {
        console.error("ERREUR Lecture BDD :", e);
        return null;
    }
}

/**
 * Écrit le nouveau JSON généré par l'IA d'Analyse dans le fichier.
 * @param {string} username - Nom de l'utilisateur qui a généré la donnée.
 * @param {string} newJsonText - Le JSON complet généré par l'IA.
 * @returns {boolean} true si succès, false sinon
 */
function updateEvolvingDBWithNewData(username, newJsonText) {
    try {
        // Nettoyage des triple backticks que l'IA ajoute souvent (```json ... ```)
        const cleanedJsonText = newJsonText.replace(/```json|```/g, '').trim(); 
        
        // Tentative de parsing
        const parsedData = JSON.parse(cleanedJsonText);

        // Ajout de la date de la maj
        parsedData.derniere_maj = `Date exacte: Dimanche 14 décembre 2025 à 16:55:01, Utilisateur: ${username}`;

        // Sauvegarde du fichier
        fs.writeFileSync(BDD_FILE_PATH, JSON.stringify(parsedData, null, 2), 'utf8');
        console.log(`[BDD ÉVOLUTIVE] MISE À JOUR PAR L'IA D'ANALYSE !`);
        return true;
    } catch (e) {
        // Si l'IA a généré un JSON invalide
        console.error("PUTAIN ERREUR FATALE DE PARSING JSON ou d'écriture dans la BDD :", e);
        console.error("Contenu JSON invalide de l'IA (regarde ça !):", newJsonText);
        return false;
    }
}

// =================================================================
// API Chat Gemini (DOUBLE GEMINI + BDD ÉVOLUTIVE TEXTE)
// =================================================================
// =================================================================
// 🔥 ROUTE CHAT IA (CORRIGÉE, STABLE, BDD APRÈS RÉPONSE) 🔥
// =================================================================
app.post('/public/api/chat', async (req, res) => {
    let newTotalPoints = 0;

    try {
        const {
            history,
            currentMessage,
            creativity,
            base64File,
            mimeType,
            systemInstruction, 
            username
        } = req.body;

        if (!currentMessage && !base64File) {
            return res.status(400).json({
                success: false,
                response: "Message vide.",
                newIndividualPoints: 0
            });
        }

        // === AJOUT POINT ===
        /*
        if (username) {
            newTotalPoints = addPointToAllJSON(username);
        }
            */

        if (!ai) {
            return res.status(500).json({
                success: false,
                response: "IA non initialisée.",
                newIndividualPoints: newTotalPoints
            });
        }

        // =========================
        // 1️⃣ PRÉPARATION CONTENU
        // =========================
        const cleanedHistory = Array.isArray(history)
            ? history.filter(m => m?.role && Array.isArray(m.parts))
            : [];

        // 🚨 NOUVEAU CONTEXTE FORT : On injecte ici les instructions du chat.js (BDD + Personnalité)
        const contextFromClient = systemInstruction || ""; // Prend la systemInstruction envoyée par le client
        const finalSystemPrompt = `
${contextFromClient.trim()}

RÈGLES D'AGENT : 
-Tu dois etre respectueux et amical(n'hesite pas à taquiner un peulutilisateur ou bien à lui parler comme son pote)

`.trim();

        const userParts = [];
        if (currentMessage) userParts.push({ text: currentMessage });
        if (base64File && mimeType) {
            userParts.push({ inlineData: { data: base64File, mimeType } });
        }

        // 🚨 MODIFICATION CRITIQUE : Ajout du contexte strict comme premier message utilisateur
        const contents = [
            { role: "user", parts: [{ text: finalSystemPrompt }] }, // Contexte strict forcé
            ...cleanedHistory,
            { role: "user", parts: userParts }
        ];

        // =========================
        // 2️⃣ APPEL IA PRINCIPALE
        // =========================
        const mainResult = await ai.models.generateContent({
            model,
            contents,
            generationConfig: {
                temperature: Number(creativity) || 0.6,
                maxOutputTokens: 8000
            },
            // systemInstruction est retiré car tout est dans contents
        });

        const aiResponse = mainResult.text || "Réponse vide.";

        // Incrémenter compteur de messages AI si >15 chars
        if (currentMessage && currentMessage.length > 15) {
            incrementMessageCount(username, 'ai');
        }

        // Déduire points pour mode Devoirs
        if (systemInstruction && systemInstruction.toLowerCase().includes("devoirs")) {
            deductPoints(username, 3);
        }

        // =========================
        // 3️⃣ ANALYSE BDD (APRÈS)
        // =========================
        try {
            const currentDB = getEvolvingDBContent();

            const analysisPrompt = `
Tu es un moteur d'analyse de données.

BDD ACTUELLE :
${currentDB || "Aucune donnée"}

DERNIÈRE INTERACTION :
Utilisateur (${username}) : "${currentMessage}"
IA : "${aiResponse}"

RÈGLES :
- Retourne UNIQUEMENT le JSON
- Conserve tout l'existant
- Ajoute l'entrée dans "historiques"
- Ajoute des infos pertinentes dans "nouvelles_infos" si nécessaire
`;

            const dbResult = await ai.models.generateContent({
                model,
                contents: [{ role: "user", parts: [{ text: analysisPrompt }] }],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 3000
                }
            });

            const cleanedJSON = dbResult.text.replace(/```json|```/g, '').trim();
            updateEvolvingDBWithNewData(username, cleanedJSON);

        } catch (e) {
            console.error("[BDD] Échec mise à jour :", e.message);
        }

        // =========================
        // 4️⃣ RÉPONSE CLIENT
        // =========================
        return res.json({
            success: true,
            response: aiResponse,
            newIndividualPoints: newTotalPoints
        });

    } catch (error) {
        console.error("ERREUR /public/api/chat :", error);
        return res.status(500).json({
            success: false,
            response: "Erreur serveur IA.",
            newIndividualPoints: newTotalPoints
        });
    }
});


// -------------------------------------------------------------------------------------------------
// --- GET : récupérer tous les messages communautaires ---




// --- POST : Uploader un cours (Ajout d'une entrée dans cours.json) ---
app.post('/public/api/course/upload', uploadCourse.single('course-file'), async (req,res) => {
    if (!req.file) return res.status(400).json({ success:false, message:'Fichier manquant, espèce de petite frappe.' });

    const { title, subject, description } = req.body;
    const newCourse = {
        id: Date.now(),
        title: title || req.file.originalname,
        subject: subject || "Inconnu",
        description: description || "Pas de description",
        filePath: `/uploads/${req.file.filename}`,
        uploadedAt: new Date().toISOString(),
        deleteTimer: INITIAL_DELETE_TIMER_SECONDS,
        supprime: false
    };

    try {
        const allCourses = readAllCoursesFromJSON();
        allCourses.push(newCourse);
        writeAllCoursesToJSON(allCourses);
        console.log(`[COURS] Nouveau cours uploadé : ${newCourse.title} (ID: ${newCourse.id})`);
        return res.status(201).json({ success:true, course:newCourse, message:'Cours uploadé et enregistré, gros zinzin !' });
    } catch(e) {
        console.error("PUTAIN ERREUR LORS DE L'ENREGISTREMENT DU COURS :", e);
        // Nettoyage du fichier uploadé en cas d'échec d'écriture JSON
        fs.unlink(req.file.path, () => console.log(`[Cleanup] Fichier ${req.file.filename} supprimé suite à l'échec JSON.`));
        return res.status(500).json({ success:false, message:"Erreur serveur lors de l'enregistrement dans cours.json." });
    }
});

// --- GET : Lister les cours actifs ---
app.get('/public/api/course/list', (req,res) => {
    try {
        const activeCourses = getFilteredActiveCourses();
        return res.json({ success:true, courses:activeCourses });
    } catch(e) {
        console.error("Erreur listage cours:", e);
        return res.status(500).json({ success:false, message:"Erreur serveur lors du listage des cours." });
    }
});

// --- DELETE : Supprimer un cours (supprime logique) ---
app.delete('/public/api/course/delete/:id', (req,res) => {
    const courseId = req.params.id;
    if(!courseId) return res.status(400).json({ success:false, message:'ID de cours manquant, bordel !' });

    try {
        const wasDeleted = deleteCourseFromJSON(courseId);
        if(wasDeleted){
            console.log(`[COURS] Suppression logique réussie pour ID : ${courseId}`);
            return res.json({ success:true, message:`Cours ID ${courseId} marqué comme supprimé.` });
        } else {
            console.log(`[COURS] ID non trouvé ou déjà supprimé : ${courseId}`);
            return res.status(404).json({ success:false, message:`Cours ID ${courseId} non trouvé ou déjà supprimé.` });
        }
    } catch(e){
        console.error("PUTAIN ÉCHEC suppression logique :", e);
        return res.status(500).json({ success:false, message:"Erreur serveur lors de la suppression logique." });
    }
});

// --- POST : Upload photo de profil ---
app.post('/public/api/profile/upload-avatar', uploadProfilePic.single('avatar'), async (req, res) => {
    logToFile('debug', '[PROFILE] ===== UPLOAD AVATAR REQUEST RECEIVED =====');
    logToFile('debug', `[PROFILE] File: ${JSON.stringify(req.file)}`);
    logToFile('debug', `[PROFILE] Body: ${JSON.stringify(req.body)}`);

    try {
        const username = req.body.username;
        console.log('[PROFILE] Username:', username);

        if (!username) {
            console.log('[PROFILE] ❌ Username manquant');
            return res.status(400).json({ success: false, message: 'Nom d\'utilisateur manquant' });
        }

        if (!req.file) {
            console.log('[PROFILE] ❌ Aucun fichier');
            return res.status(400).json({ success: false, message: 'Aucun fichier uploadé' });
        }

        const avatarPath = `/api/community/ressources/pp/${req.file.filename}`;
        console.log('[PROFILE] Avatar path:', avatarPath);

        // Mettre à jour pp.json
        const ppJsonPath = path.join(__dirname, 'public', 'api', 'community', 'ressources', 'pp', 'pp.json');

        let ppData = {};
        if (fs.existsSync(ppJsonPath)) {
            ppData = JSON.parse(fs.readFileSync(ppJsonPath, 'utf8'));
        }

        ppData[username] = avatarPath;
        fs.writeFileSync(ppJsonPath, JSON.stringify(ppData, null, 2));

        console.log('[PROFILE] ✅ PP JSON mis à jour pour', username);

        res.json({
            success: true,
            message: 'Photo de profil mise à jour avec succès',
            avatarPath: avatarPath
        });

    } catch (error) {
        console.error('[PROFILE] ❌ Erreur:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur lors de l\'upload' });
    }
});



// --- GET : Lire global.json ---
app.get('/public/api/community/global.json', (req, res) => {
    const globalPath = path.join(PUBLIC_API_DIR, 'community/global.json');
    try {
        if (!fs.existsSync(globalPath)) {
            return res.json({ groups: [], topics: [], fills: [] });
        }
        const data = fs.readFileSync(globalPath, 'utf8');
        res.json(JSON.parse(data));
    } catch (e) {
        console.error("Erreur lecture global.json:", e);
        res.status(500).json({ error: "Erreur serveur lors de la lecture de global.json" });
    }
});

// --- PUT : Écrire dans global.json ---
app.put('/public/api/community/global.json', express.json(), (req, res) => {
    const globalPath = path.join(PUBLIC_API_DIR, 'community/global.json');
    try {
        fs.writeFileSync(globalPath, JSON.stringify(req.body, null, 2), 'utf8');
        res.json({ success: true });
    } catch (e) {
        console.error("Erreur écriture global.json:", e);
        res.status(500).json({ error: "Erreur serveur lors de l'écriture de global.json" });
    }
});

// --- POST : Créer un nouveau groupe ---
app.post('/public/api/community/create-group', express.json(), (req, res) => {
    const { name, description, isPrivate, username } = req.body;
    if (!name || !username) return res.status(400).json({ success: false, message: "Nom et username requis" });

    const cost = isPrivate ? 30 : 0;

    // Vérifier points pour groupe privé
    if (isPrivate && !checkPointsForAction(username, cost)) {
        return res.status(400).json({ success: false, message: "Pas assez de points pour créer un groupe privé (-30 points requis)" });
    }

    const newGroup = {
        id: 'group_' + Date.now(),
        name: name,
        description: description || '',
        type: isPrivate ? 'private' : 'public',
        members: [username],
        admin: username,
        createdAt: new Date().toISOString(),
        isPrivate: isPrivate,
        cost: cost
    };

    try {
        // Créer fichier individuel
        const groupDir = path.join(PUBLIC_API_DIR, 'community', 'groupes');
        if (!fs.existsSync(groupDir)) fs.mkdirSync(groupDir, { recursive: true });
        fs.writeFileSync(path.join(groupDir, `${newGroup.id}.json`), JSON.stringify(newGroup, null, 2));

        // Mettre à jour global.json
        const globalPath = path.join(PUBLIC_API_DIR, 'community/global.json');
        let globalData = { groups: [], topics: [], fills: [], mps: [] };
        if (fs.existsSync(globalPath)) {
            globalData = JSON.parse(fs.readFileSync(globalPath, 'utf8'));
        }
        globalData.groups.push(newGroup);
        fs.writeFileSync(globalPath, JSON.stringify(globalData, null, 2));

        // Déduire points si privé
        if (isPrivate) {
            deductPoints(username, cost);
        }

        res.json({ success: true, group: newGroup });
    } catch (e) {
        console.error("Erreur création groupe:", e);
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
});

// --- POST : Créer un nouveau sujet ---
app.post('/public/api/community/create-topic', express.json(), (req, res) => {
    const { name, description, username } = req.body;
    if (!name || !username) return res.status(400).json({ success: false, message: "Nom et username requis" });

    const cost = 5;

    // Vérifier points
    if (!checkPointsForAction(username, cost)) {
        return res.status(400).json({ success: false, message: "Pas assez de points pour créer un sujet (-5 points requis)" });
    }

    const newTopic = {
        id: 'topic_' + Date.now(),
        name: name,
        description: description || '',
        createdBy: username,
        createdAt: new Date().toISOString(),
        duration: 24 * 60 * 60 * 1000,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };

    try {
        // Créer fichier individuel
        const topicDir = path.join(PUBLIC_API_DIR, 'community', 'sujets');
        if (!fs.existsSync(topicDir)) fs.mkdirSync(topicDir, { recursive: true });
        fs.writeFileSync(path.join(topicDir, `${newTopic.id}.json`), JSON.stringify(newTopic, null, 2));

        // Mettre à jour global.json
        const globalPath = path.join(PUBLIC_API_DIR, 'community/global.json');
        let globalData = { groups: [], topics: [], fills: [], mps: [] };
        if (fs.existsSync(globalPath)) {
            globalData = JSON.parse(fs.readFileSync(globalPath, 'utf8'));
        }
        globalData.topics.push(newTopic);
        fs.writeFileSync(globalPath, JSON.stringify(globalData, null, 2));

        // Déduire points
        deductPoints(username, cost);

        res.json({ success: true, topic: newTopic });
    } catch (e) {
        console.error("Erreur création sujet:", e);
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
});

// --- POST : Créer un nouveau fill ---
app.post('/public/api/community/create-fill', express.json(), (req, res) => {
    const { name, description, parentType, parentId, username } = req.body;
    if (!name || !parentType || !parentId || !username) return res.status(400).json({ success: false, message: "Paramètres requis manquants" });

    const newFill = {
        id: 'fill_' + Date.now(),
        name: name,
        description: description || '',
        parentType: parentType,
        parentId: parentId,
        members: [username],
        createdBy: username,
        createdAt: new Date().toISOString(),
        duration: 12 * 60 * 60 * 1000,
        expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
    };

    try {
        // Créer fichier individuel
        const fillDir = path.join(PUBLIC_API_DIR, 'community', 'fills');
        if (!fs.existsSync(fillDir)) fs.mkdirSync(fillDir, { recursive: true });
        fs.writeFileSync(path.join(fillDir, `${newFill.id}.json`), JSON.stringify(newFill, null, 2));

        // Mettre à jour global.json
        const globalPath = path.join(PUBLIC_API_DIR, 'community/global.json');
        let globalData = { groups: [], topics: [], fills: [], mps: [] };
        if (fs.existsSync(globalPath)) {
            globalData = JSON.parse(fs.readFileSync(globalPath, 'utf8'));
        }
        globalData.fills.push(newFill);
        fs.writeFileSync(globalPath, JSON.stringify(globalData, null, 2));

        res.json({ success: true, fill: newFill });

        // Récompenser le créateur du sujet si applicable
        rewardTopicCreatorForFill(newFill);
    } catch (e) {
        console.error("Erreur création fill:", e);
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
});

// --- POST : Créer un nouveau MP ---
app.post('/public/api/community/create-mp', express.json(), (req, res) => {
    const { recipient, username } = req.body;
    if (!recipient || !username) return res.status(400).json({ success: false, message: "Destinataire et username requis" });

    // Vérifier si l'utilisateur n'essaie pas de se créer un MP avec lui-même
    if (recipient === username) return res.status(400).json({ success: false, message: "Vous ne pouvez pas créer un MP avec vous-même" });

    try {
        // Charger global.json pour vérifier les MPs existants
        const globalPath = path.join(PUBLIC_API_DIR, 'community/global.json');
        let globalData = { groups: [], topics: [], fills: [], mps: [] };
        if (fs.existsSync(globalPath)) {
            globalData = JSON.parse(fs.readFileSync(globalPath, 'utf8'));
        }

        // Vérifier si une conversation privée existe déjà entre ces deux utilisateurs
        const existingMp = globalData.mps.find(mp =>
            mp.participants && mp.participants.includes(username) && mp.participants.includes(recipient) && mp.participants.length === 2
        );

        if (existingMp) {
            return res.status(400).json({ success: false, message: "Une conversation privée existe déjà avec cet utilisateur" });
        }

        const newMp = {
            id: 'mp_' + Date.now(),
            participants: [username, recipient],
            createdBy: username,
            createdAt: new Date().toISOString(),
            messages: []
        };

        // Créer fichier individuel
        const mpDir = path.join(PUBLIC_API_DIR, 'community', 'mp');
        if (!fs.existsSync(mpDir)) fs.mkdirSync(mpDir, { recursive: true });
        fs.writeFileSync(path.join(mpDir, `${newMp.id}.json`), JSON.stringify(newMp, null, 2));

        // Mettre à jour global.json
        globalData.mps.push(newMp);
        fs.writeFileSync(globalPath, JSON.stringify(globalData, null, 2));

        res.json({ success: true, mp: newMp });
    } catch (e) {
        console.error("Erreur création MP:", e);
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
});

// --- POST : Rejoindre un fill ---
app.post('/public/api/community/join-fill', express.json(), (req, res) => {
    const { fillId, username } = req.body;
    if (!fillId || !username) return res.status(400).json({ success: false, message: "fillId et username requis" });

    try {
        // Charger global.json
        const globalPath = path.join(PUBLIC_API_DIR, 'community/global.json');
        if (!fs.existsSync(globalPath)) return res.status(404).json({ success: false, message: "Données non trouvées" });
        
        let globalData = JSON.parse(fs.readFileSync(globalPath, 'utf8'));
        const fillIndex = globalData.fills.findIndex(f => f.id === fillId);
        if (fillIndex === -1) return res.status(404).json({ success: false, message: "Fill non trouvé" });

        const fill = globalData.fills[fillIndex];
        
        // Vérifier si l'utilisateur n'est pas déjà membre
        if (fill.members.includes(username)) {
            return res.status(400).json({ success: false, message: "Déjà membre de ce fill" });
        }

        // Ajouter l'utilisateur aux membres
        fill.members.push(username);

        // Mettre à jour le fichier individuel
        const fillFilePath = path.join(PUBLIC_API_DIR, 'community', 'fills', `${fillId}.json`);
        fs.writeFileSync(fillFilePath, JSON.stringify(fill, null, 2));

        // Mettre à jour global.json
        fs.writeFileSync(globalPath, JSON.stringify(globalData, null, 2));

        res.json({ success: true, fill: fill });
    } catch (e) {
        console.error("Erreur rejoindre fill:", e);
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
});

// --- POST : Envoyer un message dans une discussion ---
app.post('/public/api/community/send-message', uploadCommunity.single('file'), (req, res) => {
    const { discussionId, discussionType, message, username } = req.body;
    if (!discussionId || !discussionType || !username) {
        return res.status(400).json({ success: false, message: "Paramètres requis manquants" });
    }

    const newMessage = {
        id: 'msg_' + Date.now(),
        sender: username,
        content: message || '',
        timestamp: new Date().toISOString(),
        type: 'text'
    };

    // Gérer le fichier si présent
    if (req.file) {
        const fileInfo = {
            filename: req.file.filename,
            originalName: req.file.originalname,
            type: req.file.mimetype,
            size: req.file.size
        };
        newMessage.file = fileInfo;
        newMessage.type = req.file.mimetype.startsWith('image/') ? 'image' : 
                          req.file.mimetype.startsWith('video/') ? 'video' : 'document';
    }

    try {
        // Déterminer le dossier selon le type
        let messagesDir;
        if (discussionType === 'group') {
            messagesDir = path.join(PUBLIC_API_DIR, 'community', 'groupes');
        } else if (discussionType === 'fill') {
            messagesDir = path.join(PUBLIC_API_DIR, 'community', 'fills');
        } else if (discussionType === 'mp') {
            messagesDir = path.join(PUBLIC_API_DIR, 'community', 'mp');
        } else {
            return res.status(400).json({ success: false, message: "Type de discussion invalide" });
        }

        const messagesFile = path.join(messagesDir, `${discussionId}.json`);
        
        // Charger ou créer le fichier de messages
        let discussionData = {};
        if (fs.existsSync(messagesFile)) {
            discussionData = JSON.parse(fs.readFileSync(messagesFile, 'utf8'));
        } else {
            // Si c'est un nouveau fichier, initialiser avec les données de base
            discussionData = JSON.parse(fs.readFileSync(path.join(PUBLIC_API_DIR, 'community', 'global.json'), 'utf8'));
            if (discussionType === 'group') {
                discussionData = discussionData.groups.find(g => g.id === discussionId);
            } else if (discussionType === 'fill') {
                discussionData = discussionData.fills.find(f => f.id === discussionId);
            } else if (discussionType === 'mp') {
                discussionData = discussionData.mps.find(m => m.id === discussionId);
            }
            discussionData.messages = [];
        }

        // Ajouter le message
        if (!discussionData.messages) discussionData.messages = [];
        discussionData.messages.push(newMessage);

        // Sauvegarder
        fs.writeFileSync(messagesFile, JSON.stringify(discussionData, null, 2));

        // Incrémenter compteur de messages pour récompenses
        if (discussionType === 'group' || discussionType === 'fill') {
            incrementMessageCount(username, 'fill');
        }

        res.json({ success: true, message: newMessage });
    } catch (e) {
        console.error("Erreur envoi message:", e);
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
});

// --- GET : Récupérer les messages d'une discussion ---
app.get('/public/api/community/messages/:discussionId/:discussionType', (req, res) => {
    const { discussionId, discussionType } = req.params;

    try {
        // Déterminer le dossier selon le type
        let messagesDir;
        if (discussionType === 'group') {
            messagesDir = path.join(PUBLIC_API_DIR, 'community', 'groupes');
        } else if (discussionType === 'fill') {
            messagesDir = path.join(PUBLIC_API_DIR, 'community', 'fills');
        } else if (discussionType === 'mp') {
            messagesDir = path.join(PUBLIC_API_DIR, 'community', 'mp');
        } else {
            return res.status(400).json({ success: false, message: "Type de discussion invalide" });
        }

        const messagesFile = path.join(messagesDir, `${discussionId}.json`);
        
        if (!fs.existsSync(messagesFile)) {
            return res.json({ success: true, messages: [] });
        }

        const discussionData = JSON.parse(fs.readFileSync(messagesFile, 'utf8'));
        const messages = discussionData.messages || [];

        res.json({ success: true, messages: messages });
    } catch (e) {
        console.error("Erreur récupération messages:", e);
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
});

// --- DÉMARRAGE DU SERVEUR ---
// Démarrer le service de vérifications
const verificationsProcess = spawn('node', ['verifications.js'], {
    stdio: 'inherit',
    cwd: __dirname
});

console.log("[SERVER] Service de vérifications démarré.");

// Gestion de l'arrêt propre
process.on('exit', () => {
    if (verificationsProcess) {
        console.log("[SERVER] Arrêt du service de vérifications...");
        verificationsProcess.kill();
    }
});

process.on('SIGINT', () => {
    if (verificationsProcess) {
        console.log("[SERVER] Arrêt du service de vérifications...");
        verificationsProcess.kill();
    }
    process.exit(0);
});
// --- Logout Route ---
app.post('/api/logout', (req, res) => {
    const { username } = req.body;
    
    if (username) {
        try {
            const rawData = fs.readFileSync(USERS_PATH, 'utf8') || '[]';
            const usersData = JSON.parse(rawData);
            const user = usersData.find(u => u.username.toLowerCase() === username.toLowerCase());
            
            if (user) {
                user.active = false; // On le met en inactif
                fs.writeFileSync(USERS_PATH, JSON.stringify(usersData, null, 2));
                console.log(`[AUTH] Logout réussi pour : ${username} 🗿`);
            }
        } catch (e) {
            console.error("Erreur lors du logout côté serveur :", e);
        }
    }
    
    // On répond que c'est ok pour que le front redirige
    return res.json({ success: true, redirect: '/public/pages/login.html' });
});
app.listen(port, () => {
    console.log(`Le serveur de l'application Sigma tourne sur http://localhost:${port}, gros zinzin !`);
    // Ajout de la date exacte pour que tout soit compréhensible
    console.log(`Date de démarrage : Dimanche 07 décembre 2025.`); 
});