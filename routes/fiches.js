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

// Step 2: generate STRUCTURE only — text, bold, sizes, separators. NO colors/fonts/italic/underline.
const FICHE_STRUCTURE_PROMPT = `Tu génères des FICHES DE RÉVISION au format ".fiche".

FORMAT :
@bg:THEME (première ligne, thèmes : sobre, blocnote, rose, vert, bleu)
{s:7}Titre{/s} → titre principal
{s:5}Sous-titre{/s} → sous-titre de section
Texte normal → écrire directement
**gras** → mots importants
--- → séparateur horizontal

RÈGLES :
- Thème @bg: selon la matière : sobre (maths), blocnote (histoire/géo), rose (langues), vert (SVT), bleu (physique/chimie)
- C'est une FICHE DE RÉVISION : résume, synthétise, donne les règles et définitions clés
- NE GÉNÈRE JAMAIS d'exercices, de tableaux, de QCM, d'activités à compléter. Pas de | pour des tableaux.
- N'utilise PAS {c:}, {f:}, __ ni ~~ — UNIQUEMENT @bg, {s:}, **, --- et du texte
- NE génère que le code .fiche. Pas de \`\`\`, pas de commentaires.

EXEMPLE :
@bg:sobre
{s:7}Addition et Soustraction{/s}
---
{s:5}Règles de l'addition{/s}
Pour additionner deux nombres relatifs de **même signe**, on additionne les valeurs absolues et on garde le signe.
Pour deux nombres de **signes contraires**, on soustrait et on garde le signe du plus grand en **valeur absolue**.
---
{s:5}Nombres opposés{/s}
Deux nombres sont **opposés** quand leur somme vaut **zéro**.
Exemple : (-16) + (+16) = 0, donc 16 et -16 sont opposés.
---
{s:5}Règle de soustraction{/s}
Soustraire un nombre revient à additionner son **opposé**.
**a - b = a + (-b)**`;

// Step 3: FORMATTER AI — takes plain fiche, adds colors/fonts/italic/underline
const FICHE_FORMATTER_PROMPT = `Tu reçois une fiche .fiche brute. Tu dois y ajouter un MINIMUM de formatage visuel pour la rendre claire.

ATTENTION : la MAJORITÉ du texte reste NOIR sans aucune balise. Tu colores TRÈS PEU de mots.

TITRES ET SOUS-TITRES — RÈGLE OBLIGATOIRE :
- Titre {s:7} : TOUT le texte du titre en ROUGE. Transforme {s:7}Mon Titre{/s} en {s:7}{c:#e53935}Mon Titre{/c}{/s}
- Sous-titres {s:5} : TOUT le texte du sous-titre en VERT. Transforme {s:5}Ma Section{/s} en {s:5}{c:#43a047}Ma Section{/c}{/s}
- C'est le TEXTE ENTIER du titre/sous-titre qui est coloré, pas juste un mot.

COULEURS DANS LE CORPS DU TEXTE (les 3 seules autorisées) :
- {c:#e53935}...{/c} ROUGE → le mot-clé central d'une formule ou règle vitale. Maximum 1 par section.
- {c:#1e88e5}...{/c} BLEU → les exemples CONCRETS (les calculs comme (-7) + (+12) = +5). Colore TOUS les calculs d'exemple de la fiche, pas un seul. Chaque calcul = 1 balise bleue.
- {c:#43a047}...{/c} VERT → le NOM d'un concept quand il est DÉFINI pour la première fois. Maximum 1 par section.

NE COLORE JAMAIS : les mots "exemple", "attention", "définition", "règle", des articles, des verbes courants.

STYLES (très peu, seulement quand c'est vraiment pertinent) :
- __texte__ italique → pour UNE définition formelle par section (maximum)
- ~~texte~~ souligné → pour LE résultat final ou formule clé de la fiche (1-2 sur toute la fiche)

POLICES (optionnel, 0 à 3 utilisations sur toute la fiche) :
- {f:'Courier New', monospace}...{/f} → pour des formules mathématiques comme a - b = a + (-b)
- {f:Georgia, serif}...{/f} → pour un théorème ou propriété formelle

RÈGLES ABSOLUES :
1. NE MODIFIE PAS le texte lui-même. Tu ajoutes UNIQUEMENT des balises autour de mots existants.
2. NE touche PAS aux lignes @bg:, --- et **...**
3. La plupart des lignes doivent rester IDENTIQUES à l'entrée, sans aucune balise ajoutée.
4. Renvoie UNIQUEMENT la fiche. Pas de \`\`\`, pas de commentaires.`;

router.post('/api/fiches/generate', async (req, res) => {
    const { username, images, instructions } = req.body;

    if (!username || !images || !images.length) {
        return res.json({ success: false, error: 'Images requises.' });
    }

    if (images.length > 6) {
        return res.json({ success: false, error: 'Maximum 6 images.' });
    }

    for (const img of images) {
        if (!img.base64 || !img.mimeType) {
            return res.json({ success: false, error: 'Image invalide.' });
        }
        if (img.base64.length > 4 * 1024 * 1024) {
            return res.json({ success: false, error: 'Image trop volumineuse (max 4 Mo).' });
        }
    }

    try {
        // ── Step 1: OCR — extract text from images ──
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
            messages: [{ role: 'user', content: ocrContent }],
            temperature: 0.1,
            max_completion_tokens: 4096
        }));

        const extractedText = ocrResult.choices?.[0]?.message?.content;
        if (!extractedText) {
            return res.json({ success: false, error: 'Impossible d\'extraire le texte des images.' });
        }

        // ── Step 2: Generate plain fiche (structure only, no colors/fonts) ──
        let userPrompt = `Voici le contenu extrait de mes cours :\n\n${extractedText}\n\nCrée une fiche de révision complète et bien structurée.`;
        if (instructions) {
            userPrompt += `\n\nInstructions supplémentaires : ${instructions}`;
        }

        const structResult = await groqCall(client => client.chat.completions.create({
            model,
            messages: [
                { role: 'system', content: FICHE_STRUCTURE_PROMPT },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.5,
            max_completion_tokens: 4096
        }));

        let plainFiche = structResult.choices?.[0]?.message?.content;
        if (!plainFiche) {
            return res.json({ success: false, error: 'Erreur lors de la génération.' });
        }

        // Clean step 2 output
        plainFiche = plainFiche.replace(/^```[a-z]*\n?/gm, '').replace(/\n?```$/gm, '').trim();
        plainFiche = plainFiche.split('\n').filter(l => !/^\|/.test(l.trim())).join('\n');
        // Strip any {c:}, {f:}, __, ~~ the AI may have sneaked in
        plainFiche = plainFiche.replace(/\{c:[^}]*\}/g, '').replace(/\{\/c\}/g, '');
        plainFiche = plainFiche.replace(/\{f:[^}]*\}/g, '').replace(/\{\/f\}/g, '');
        plainFiche = plainFiche.replace(/__([^_]+?)__/g, '$1');
        plainFiche = plainFiche.replace(/~~([^~]+?)~~/g, '$1');

        if (!plainFiche.startsWith('@bg:')) {
            plainFiche = '@bg:sobre\n' + plainFiche;
        }

        // ── Step 3: Formatter AI — add colors, fonts, italic, underline ──
        const formatResult = await groqCall(client => client.chat.completions.create({
            model,
            messages: [
                { role: 'system', content: FICHE_FORMATTER_PROMPT },
                { role: 'user', content: `Voici la fiche à formater :\n\n${plainFiche}` }
            ],
            temperature: 0.3,
            max_completion_tokens: 4096
        }));

        let ficheContent = formatResult.choices?.[0]?.message?.content;
        if (!ficheContent) {
            // Fallback to plain fiche if formatting fails
            return res.json({ success: true, content: plainFiche });
        }

        // Final cleanup
        ficheContent = ficheContent.replace(/^```[a-z]*\n?/gm, '').replace(/\n?```$/gm, '').trim();
        ficheContent = ficheContent.split('\n').filter(l => !/^\|/.test(l.trim())).join('\n');

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
