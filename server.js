// server.js (Version corrigée et robuste)
// - Création automatique des dossiers nécessaires
// - Lecture/écriture safe de public/api/messages.json
// - Upload images pour la communauté, stockage dans /images
// - Retourne le "post" complet après POST pour que le front puisse remplacer l'optimistic UI

const express = require('express');
const { GoogleGenAI } = require('@google/genai');
const dotenv = require('dotenv');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const bcrypt = require('bcryptjs');

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
const MESSAGES_PATH = path.join(PUBLIC_API_DIR, 'messages.json');
const USERS_PATH = path.join(PUBLIC_API_DIR, 'users.json');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');

// Ensure folders exist
[IMAGES_DIR, PUBLIC_API_DIR, UPLOADS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Création du dossier manquant : ${dir}`);
    }
});

// If messages.json doesn't exist or is invalid, create a valid empty array
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
        JSON.parse(raw); // test parse
    } catch (e) {
        console.warn("messages.json invalide, réinitialisation en tableau vide.");
        fs.writeFileSync(MESSAGES_PATH, JSON.stringify([], null, 2), 'utf8');
    }
}
ensureMessagesFile();

// === Multer config ===

// Storage pour les cours (public/uploads/)
const courseStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + '-' + uniqueSuffix + '-' + file.originalname);
    }
});
const uploadCourse = multer({ storage: courseStorage });

// Storage pour la communauté (images/)
const communityStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, IMAGES_DIR),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const uploadCommunity = multer({ storage: communityStorage });

// === Middlewares ===
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir dossiers statiques
app.use('/images', express.static(IMAGES_DIR));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(path.join(__dirname, 'public')));

// =================================================================
// ROUTES
// =================================================================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'pages', 'login.html'));
});

// --- Login (existant) ---
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (!fs.existsSync(USERS_PATH)) {
        return res.status(500).json({ success: false, message: 'Fichier users.json manquant.' });
    }

    try {
        const usersData = JSON.parse(fs.readFileSync(USERS_PATH, 'utf8') || '[]');
        const user = usersData.find(u => u.username === username);
        if (!user) return res.status(401).json({ success: false, message: 'Identifiant non trouvé.' });

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) return res.status(401).json({ success: false, message: 'Mot de passe incorrect.' });

        return res.json({ success: true, redirect: '/app.html', user: { username: user.username } });
    } catch (e) {
        console.error("Erreur login :", e);
        return res.status(500).json({ success: false, message: 'Erreur interne serveur (login).' });
    }
});

// --- POST : nouveau message communautaire ---
app.post('/api/community/post', uploadCommunity.single('community-file'), (req, res) => {
    try {
        ensureMessagesFile(); // s'assure que messages.json est valide

        const { username, message, tempId } = req.body || {};

        if (!username || (!message && !req.file)) {
            return res.status(400).json({ success: false, message: "Nom d'utilisateur et message/image requis." });
        }

        let imagePath = null;
        let imageMimeType = null;
        if (req.file) {
            // Serveur expose /images/<filename>
            imagePath = `/images/${req.file.filename}`;
            imageMimeType = req.file.mimetype;
        }

        const newMessage = {
            id: Date.now(),
            username: username,
            message: message || '',
            timestamp: new Date().toISOString(),
            image_path: imagePath,
            image_mime_type: imageMimeType
        };

        // Lire messages existants
        const raw = fs.readFileSync(MESSAGES_PATH, 'utf8') || '[]';
        let messages = [];
        try {
            messages = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(messages)) messages = [];
        } catch (e) {
            console.warn("messages.json corrompu, réinitialisation.");
            messages = [];
        }

        messages.push(newMessage);
        fs.writeFileSync(MESSAGES_PATH, JSON.stringify(messages, null, 2), 'utf8');

        console.log(`Message posté par ${username} (image: ${imagePath ? 'OUI' : 'NON'})`);
        return res.status(201).json({ success: true, message: "Message posté avec succès !", post: newMessage, tempId: tempId || null });
    } catch (e) {
        console.error("Erreur POST /api/community/post :", e);
        return res.status(500).json({ success: false, message: "Erreur serveur lors de la sauvegarde du message." });
    }
});

// --- GET : récupérer tous les messages communautaires ---
app.get('/api/community/messages', (req, res) => {
    try {
        ensureMessagesFile();
        const raw = fs.readFileSync(MESSAGES_PATH, 'utf8') || '[]';
        let messages = [];
        try {
            messages = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(messages)) messages = [];
        } catch (e) {
            console.warn("messages.json invalide à la lecture, renvoi tableau vide.");
            messages = [];
        }
        return res.json(messages);
    } catch (e) {
        console.error("Erreur GET /api/community/messages :", e);
        return res.status(500).json({ success: false, message: "Erreur serveur lors de la lecture des messages." });
    }
});

// --- app.html ---
app.get('/app.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'app.html'));
});

// --- API Chat Gemini (inchangé mais safe) ---
app.post('/api/chat', async (req, res) => {
    try {
        const { history, currentMessage, creativity, lengthValue, modeValue, levelValue, base64File, mimeType } = req.body || {};

        if (!currentMessage && !base64File) {
            return res.status(400).json({ error: "Message ou image manquant." });
        }

        const systemInstruction = `Tu es SOURCE AI...
- Mode IA: ${modeValue}.
- Niveau scolaire: ${levelValue}.
- Longueur: ${lengthValue} mots.
Réponds en français.`;

        const cleanedHistory = (history || [])
            .filter(msg => msg && msg.role && ['user', 'model'].includes(msg.role))
            .map(msg => ({ role: msg.role, parts: msg.parts }));

        const userParts = [];
        if (currentMessage) userParts.push({ text: currentMessage });
        if (base64File && mimeType) userParts.push({ inlineData: { data: base64File, mimeType } });

        const contents = [...cleanedHistory, { role: "user", parts: userParts }];

        if (!ai) {
            return res.status(500).json({ error: "AI non configurée sur le serveur." });
        }

        const result = await ai.models.generateContent({
            model,
            contents,
            config: {
                temperature: parseFloat(creativity) || 0.7,
                systemInstruction,
                maxOutputTokens: (parseInt(lengthValue) * 4) || 2048
            }
        });

        const responseText = result.candidates && result.candidates[0] && result.candidates[0].content && result.candidates[0].content.parts && result.candidates[0].content.parts[0] && result.candidates[0].content.parts[0].text
            ? result.candidates[0].content.parts[0].text
            : "Désolé, pas de réponse.";

        return res.json({ response: responseText });
    } catch (error) {
        console.error("Erreur /api/chat :", error);
        return res.status(500).json({ error: "Erreur interne Gemini." });
    }
});

// --- Upload de cours (inchangé) ---
const storedCourses = [];
app.post('/api/deposit-course', uploadCourse.single('course-file'), (req, res) => {
    if (!req.file) {
        return res.status(400).send({ message: "Pas de fichier fourni !" });
    }

    const { title, subject, description } = req.body;

    const newCourse = {
        id: storedCourses.length + 1,
        title: title || 'Titre Inconnu',
        subject: subject || 'Non spécifié',
        description: description || 'Pas de description',
        filePath: '/uploads/' + req.file.filename,
        uploadedAt: new Date().toISOString()
    };

    storedCourses.push(newCourse);
    console.log(`Nouveau cours déposé: ${newCourse.title} - Chemin: ${newCourse.filePath}`);

    return res.status(200).send({ message: "Cours déposé avec succès !", course: newCourse });
});

app.get('/api/courses', (req, res) => res.status(200).json(storedCourses));

// === Lancer le serveur ===
app.listen(port, () => {
    console.log(`ALPHA SOURCE est en ligne sur http://localhost:${port}`);
});
