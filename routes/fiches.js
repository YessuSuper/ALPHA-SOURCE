'use strict';
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { db, stmts } = require('./shared');
const { model, visionModel, groqCall } = require('./ai-client');

// POST /api/fiches/save — create or update a fiche
router.post('/api/fiches/save', (req, res) => {
    const { username, id, name, content, description, matiere } = req.body;
    if (!username || !name || !content) {
        return res.json({ success: false, error: 'Champs requis manquants.' });
    }
    // Verify user exists
    const user = stmts.getUserLower.get(username);
    if (!user) return res.json({ success: false, error: 'Utilisateur introuvable.' });

    const now = new Date().toISOString();

    if (id) {
        // Update existing
        const existing = stmts.getFiche.get(id);
        if (!existing || existing.username.toLowerCase() !== username.toLowerCase()) {
            return res.json({ success: false, error: 'Fiche introuvable.' });
        }
        stmts.updateFiche.run({
            id, username: existing.username,
            name: name.trim(),
            description: (description || '').trim(),
            matiere: (matiere || '').trim(),
            content, updated_at: now
        });
        return res.json({ success: true, id });
    }

    // Create new
    const ficheId = crypto.randomUUID();
    stmts.insertFiche.run({
        id: ficheId, username: user.username,
        name: name.trim(),
        description: (description || '').trim(),
        matiere: (matiere || '').trim(),
        content, created_at: now, updated_at: now
    });
    return res.json({ success: true, id: ficheId });
});

// GET /api/fiches/list?username=...&q=...&matiere=...
router.get('/api/fiches/list', (req, res) => {
    const { username, q, matiere } = req.query;
    if (!username) return res.json({ success: false, error: 'Username requis.' });

    let fiches;
    if (q && q.trim()) {
        const like = '%' + q.trim().toLowerCase() + '%';
        fiches = stmts.searchFichesByUser.all(username, like, like);
    } else {
        fiches = stmts.getFichesByUser.all(username);
    }

    // Filter by matiere if provided
    if (matiere && matiere.trim()) {
        const m = matiere.trim().toLowerCase();
        fiches = fiches.filter(f => f.matiere && f.matiere.toLowerCase() === m);
    }

    return res.json({ success: true, fiches });
});

// GET /api/fiches/get?id=...&username=...
router.get('/api/fiches/get', (req, res) => {
    const { id, username } = req.query;
    if (!id || !username) return res.json({ success: false, error: 'Paramètres manquants.' });

    const fiche = stmts.getFiche.get(id);
    if (!fiche || fiche.username.toLowerCase() !== username.toLowerCase()) {
        return res.json({ success: false, error: 'Fiche introuvable.' });
    }
    return res.json({ success: true, fiche });
});

// POST /api/fiches/delete
router.post('/api/fiches/delete', (req, res) => {
    const { id, username } = req.body;
    if (!id || !username) return res.json({ success: false, error: 'Paramètres manquants.' });

    const fiche = stmts.getFiche.get(id);
    if (!fiche || fiche.username.toLowerCase() !== username.toLowerCase()) {
        return res.json({ success: false, error: 'Fiche introuvable.' });
    }
    stmts.deleteFiche.run(id, fiche.username);
    return res.json({ success: true });
});

// POST /api/fiches/generate — AI-powered fiche generation from course images
const FICHE_FORMAT_PROMPT = `Tu es un assistant spécialisé dans la création de fiches de révision pour des collégiens/lycéens français.

Tu dois générer du contenu au format ".fiche". Voici la syntaxe :

PREMIÈRE LIGNE obligatoire : @bg:THEME
Thèmes disponibles : sobre, blocnote, rose, vert, bleu

CONTENU (une instruction par ligne) :
- {s:7}Texte{/s} → Titre (grand)
- {s:5}Texte{/s} → Sous-titre (moyen)
- Texte normal → Taille normale
- **texte** → Gras
- __texte__ → Italique
- ~~texte~~ → Souligné
- {c:#COULEUR}texte{/c} → Texte coloré (hex)
- --- → Séparateur horizontal

RÈGLES :
- Choisis le thème @bg: en VARIANT selon la matière :
  * sobre → matières générales, par défaut, maths
  * blocnote → histoire, géographie, EMC
  * rose → langues (français, anglais, espagnol, allemand)
  * vert → SVT, biologie, écologie
  * bleu → physique-chimie, technologie, sciences
  Si tu ne sais pas, alterne entre sobre, blocnote et vert. N'utilise PAS toujours le même thème.
- Structure bien : un titre principal, des sous-titres pour chaque section, du contenu clair et concis
- La MAJORITÉ du texte doit être SANS couleur (texte normal, sans {c:}). Le texte prend automatiquement la couleur du thème.
- Utilise {c:#COULEUR} UNIQUEMENT pour quelques mots-clés vraiment importants (2-3 par section MAX). Exemple : {c:#e53935}définition clé{/c}
- Ne colore JAMAIS les titres ni les sous-titres. Ne colore JAMAIS des phrases entières.
- Utilise le gras **...** pour les définitions et points essentiels (c'est mieux que la couleur pour mettre en valeur)
- Résume et synthétise : c'est une FICHE de révision, pas une copie du cours
- NE génère RIEN d'autre que le code .fiche (pas de commentaires, pas d'explications)
- NE mets PAS de bloc code (\`\`\`) autour du résultat`;

router.post('/api/fiches/generate', async (req, res) => {
    const { username, images, instructions } = req.body;

    if (!username || !images || !images.length) {
        return res.json({ success: false, error: 'Images requises.' });
    }

    if (images.length > 6) {
        return res.json({ success: false, error: 'Maximum 6 images.' });
    }

    // Validate image sizes (max 4MB base64 each)
    for (const img of images) {
        if (!img.base64 || !img.mimeType) {
            return res.json({ success: false, error: 'Image invalide.' });
        }
        if (img.base64.length > 4 * 1024 * 1024) {
            return res.json({ success: false, error: 'Image trop volumineuse (max 4 Mo).' });
        }
    }

    try {
        // Step 1: OCR — extract text from all images using vision model
        const ocrContent = [];
        for (const img of images) {
            ocrContent.push({
                type: 'image_url',
                image_url: { url: `data:${img.mimeType};base64,${img.base64}` }
            });
        }
        ocrContent.push({
            type: 'text',
            text: 'Extrais TOUT le texte visible sur ces images de cours. Transcris fidèlement le contenu, les titres, les formules, les schémas décrits en texte. Sépare chaque image par "---". Ne commente pas, donne uniquement le texte extrait.'
        });

        const ocrResult = await groqCall(client => client.chat.completions.create({
            model: visionModel,
            messages: [
                { role: 'user', content: ocrContent }
            ],
            temperature: 0.1,
            max_completion_tokens: 4096
        }));

        const extractedText = ocrResult.choices?.[0]?.message?.content;
        if (!extractedText) {
            return res.json({ success: false, error: 'Impossible d\'extraire le texte des images.' });
        }

        // Step 2: Generate fiche from extracted text using text model
        let userPrompt = `Voici le contenu extrait de mes cours :\n\n${extractedText}\n\nCrée une fiche de révision complète et bien structurée à partir de ce contenu.`;
        if (instructions) {
            userPrompt += `\n\nInstructions supplémentaires : ${instructions}`;
        }

        const ficheResult = await groqCall(client => client.chat.completions.create({
            model,
            messages: [
                { role: 'system', content: FICHE_FORMAT_PROMPT },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.5,
            max_completion_tokens: 4096
        }));

        let ficheContent = ficheResult.choices?.[0]?.message?.content;
        if (!ficheContent) {
            return res.json({ success: false, error: 'Erreur lors de la génération de la fiche.' });
        }

        // Clean up: remove potential code fences
        ficheContent = ficheContent.replace(/^```[a-z]*\n?/gm, '').replace(/\n?```$/gm, '').trim();

        // Ensure it starts with @bg:
        if (!ficheContent.startsWith('@bg:')) {
            ficheContent = '@bg:sobre\n' + ficheContent;
        }

        return res.json({ success: true, content: ficheContent });
    } catch (e) {
        console.error('[fiches/generate] AI error:', e.message || e);
        return res.json({ success: false, error: 'Erreur du service IA. Réessaie dans quelques instants.' });
    }
});

module.exports = router;
