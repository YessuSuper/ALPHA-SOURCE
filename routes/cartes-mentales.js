'use strict';
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { db, stmts } = require('./shared');
const { model, visionModel, groqCall } = require('./ai-client');

// POST /api/cartes/save — create or update a carte mentale
router.post('/api/cartes/save', (req, res) => {
    const { username, id, name, content, description, matiere } = req.body;
    if (!username || !name || !content) {
        return res.json({ success: false, error: 'Champs requis manquants.' });
    }
    const user = stmts.getUserLower.get(username);
    if (!user) return res.json({ success: false, error: 'Utilisateur introuvable.' });

    const now = new Date().toISOString();

    if (id) {
        const existing = stmts.getCarte.get(id);
        if (!existing || existing.username.toLowerCase() !== username.toLowerCase()) {
            return res.json({ success: false, error: 'Carte introuvable.' });
        }
        stmts.updateCarte.run({
            id, username: existing.username,
            name: name.trim(),
            description: (description || '').trim(),
            matiere: (matiere || '').trim(),
            content, updated_at: now
        });
        return res.json({ success: true, id });
    }

    const carteId = crypto.randomUUID();
    stmts.insertCarte.run({
        id: carteId, username: user.username,
        name: name.trim(),
        description: (description || '').trim(),
        matiere: (matiere || '').trim(),
        content, created_at: now, updated_at: now
    });
    return res.json({ success: true, id: carteId });
});

// GET /api/cartes/list?username=...&q=...&matiere=...
router.get('/api/cartes/list', (req, res) => {
    const { username, q, matiere } = req.query;
    if (!username) return res.json({ success: false, error: 'Username requis.' });

    let cartes;
    if (q && q.trim()) {
        const like = '%' + q.trim().toLowerCase() + '%';
        cartes = stmts.searchCartesByUser.all(username, like, like);
    } else {
        cartes = stmts.getCartesByUser.all(username);
    }

    if (matiere && matiere.trim()) {
        const m = matiere.trim().toLowerCase();
        cartes = cartes.filter(c => c.matiere && c.matiere.toLowerCase() === m);
    }

    return res.json({ success: true, cartes });
});

// GET /api/cartes/get?id=...&username=...
router.get('/api/cartes/get', (req, res) => {
    const { id, username } = req.query;
    if (!id || !username) return res.json({ success: false, error: 'Paramètres manquants.' });

    const carte = stmts.getCarte.get(id);
    if (!carte || carte.username.toLowerCase() !== username.toLowerCase()) {
        return res.json({ success: false, error: 'Carte introuvable.' });
    }
    return res.json({ success: true, carte });
});

// POST /api/cartes/delete
router.post('/api/cartes/delete', (req, res) => {
    const { id, username } = req.body;
    if (!id || !username) return res.json({ success: false, error: 'Paramètres manquants.' });

    const carte = stmts.getCarte.get(id);
    if (!carte || carte.username.toLowerCase() !== username.toLowerCase()) {
        return res.json({ success: false, error: 'Carte introuvable.' });
    }
    stmts.deleteCarte.run(id, carte.username);
    return res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AI-POWERED MIND MAP GENERATION — 3-step pipeline
// ═══════════════════════════════════════════════════════════════════════════════

// Step 1 (after OCR): generate a plain revision text with 2-4 main ideas
const CARTE_RESUME_PROMPT = `Tu es un assistant scolaire. À partir du contenu extrait de cours, génère un RÉSUMÉ STRUCTURÉ en texte brut.

RÈGLES :
- Identifie 2 à 4 grandes idées / thèmes principaux (PAS PLUS de 4)
- Pour chaque grande idée, écris 2 à 5 points clés (phrases courtes, pas de pavés)
- Les points clés peuvent contenir des formules, exemples, définitions
- Utilise ce format EXACT :

THEME: <titre concis de la matière>
# <Grande idée 1>
- <point clé>
- <point clé>
- <point clé>
# <Grande idée 2>
- <point clé>
- <point clé>

- NE génère que ce format. Pas de \`\`\`, pas de commentaires.
- Sois synthétique mais complet : c'est pour une carte mentale, pas un cours.`;

// Step 2: convert the revision text into a mind map tree (indented text)
const CARTE_STRUCTURE_PROMPT = `Tu reçois un résumé structuré de cours. Transforme-le en arbre de carte mentale au format indenté.

FORMAT :
Ligne 1 : thème visuel (sobre, blocnote, rose, vert, bleu)
Puis l'arbre indenté (2 espaces = 1 niveau) :

Niveau 0 : titre central (1 seul, le sujet global)
  Niveau 1 : grande idée (2-4 max)
    Niveau 2 : point clé ou sous-idée (2-4 par branche)
      Niveau 3 : détail/exemple (optionnel, 1-3 max)

RÈGLES IMPORTANTES :
- Maximum 3 niveaux de profondeur (racine = 0, donc niveaux 0-3)
- 2 à 4 branches niveau 1 (les grandes idées)
- 2 à 4 éléments par branche niveau 2
- Le texte de chaque bulle peut faire 2 à 10 mots. Ne fais PAS de bulles d'un seul mot.
- Regroupe les informations pour avoir MOINS de bulles mais plus riches
- Le thème : sobre (maths), blocnote (histoire/géo), rose (langues), vert (SVT), bleu (physique/chimie)
- PAS de tirets, puces, numéros au début des lignes. Juste le texte.
- NE génère que le texte indenté. Pas de \`\`\`, pas de commentaires.

EXEMPLE :
sobre
Addition et Soustraction
  Règles de l'addition
    Même signe : garder le signe
    Signes contraires : soustraire, garder le plus grand
  Nombres opposés
    Somme vaut zéro : (-16) + 16 = 0
  Règle de soustraction
    Soustraire = additionner l'opposé
    a − b = a + (−b)`;

// Step 3: assign colors — each branch level 1 gets a distinct colorIdx
const BUBBLE_COUNT = 8; // number of available colors

router.post('/api/cartes/generate', async (req, res) => {
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

        // ── Step 2: Generate summary with main ideas ──
        let resumePrompt = `Voici le contenu extrait de mes cours :\n\n${extractedText}\n\nFais un résumé structuré.`;
        if (instructions) {
            resumePrompt += `\n\nInstructions de l'élève : ${instructions}`;
        }

        const resumeResult = await groqCall(client => client.chat.completions.create({
            model,
            messages: [
                { role: 'system', content: CARTE_RESUME_PROMPT },
                { role: 'user', content: resumePrompt }
            ],
            temperature: 0.4,
            max_completion_tokens: 2048
        }));

        let resume = resumeResult.choices?.[0]?.message?.content;
        if (!resume) {
            return res.json({ success: false, error: 'Erreur lors du résumé.' });
        }
        resume = resume.replace(/^```[a-z]*\n?/gm, '').replace(/\n?```$/gm, '').trim();

        // ── Step 3: Convert summary → mind map tree structure ──
        const structResult = await groqCall(client => client.chat.completions.create({
            model,
            messages: [
                { role: 'system', content: CARTE_STRUCTURE_PROMPT },
                { role: 'user', content: `Voici le résumé à transformer en carte mentale :\n\n${resume}` }
            ],
            temperature: 0.3,
            max_completion_tokens: 2048
        }));

        let rawMap = structResult.choices?.[0]?.message?.content;
        if (!rawMap) {
            return res.json({ success: false, error: 'Erreur lors de la structuration.' });
        }
        rawMap = rawMap.replace(/^```[a-z]*\n?/gm, '').replace(/\n?```$/gm, '').trim();

        // ── Parse indented text → serialized JSON ──
        const lines = rawMap.split('\n').filter(l => l.trim());
        if (lines.length < 2) {
            return res.json({ success: false, error: 'Génération insuffisante, réessaie.' });
        }

        // First line is theme
        const themeRaw = lines[0].trim().toLowerCase().replace('@bg:', '');
        const validThemes = ['sobre', 'blocnote', 'rose', 'vert', 'bleu'];
        const theme = validThemes.includes(themeRaw) ? themeRaw : 'sobre';

        // Parse tree from indented lines
        const treeNodes = [];
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            const match = line.match(/^(\s*)/);
            const indent = match ? match[1].length : 0;
            const depth = Math.min(Math.floor(indent / 2), 3);
            const text = line.replace(/^[\s]*[-•*]\s*/, '').trim();
            if (!text) continue;
            treeNodes.push({ depth, text });
        }

        if (!treeNodes.length) {
            return res.json({ success: false, error: 'Impossible de construire la carte.' });
        }

        // Normalize: first node = depth 0
        const minDepth = Math.min(...treeNodes.map(n => n.depth));
        treeNodes.forEach(n => { n.depth -= minDepth; });

        // Build parent relationships via stack
        const nodesOut = [];
        const stack = [];
        let nextId = 0;
        let branchColorIdx = 0; // track which color for each level-1 branch

        for (const tn of treeNodes) {
            const id = nextId++;
            while (stack.length > 0 && stack[stack.length - 1].depth >= tn.depth) {
                stack.pop();
            }
            const parentId = stack.length > 0 ? stack[stack.length - 1].id : null;

            // Color assignment: root=0, each level-1 branch gets next color, children inherit parent color
            let colorIdx = 0;
            if (tn.depth === 0) {
                colorIdx = 0;
            } else if (tn.depth === 1) {
                branchColorIdx = (branchColorIdx % (BUBBLE_COUNT - 1)) + 1; // skip 0 (root color)
                colorIdx = branchColorIdx;
            } else if (parentId !== null) {
                const parentNode = nodesOut.find(n => n.id === parentId);
                colorIdx = parentNode ? parentNode.colorIdx : 0;
            }

            nodesOut.push({
                id, parentId,
                depth: tn.depth,
                colorIdx,
                x: 0, y: 0,
                isRoot: tn.depth === 0,
                html: tn.text,
                childIds: []
            });
            stack.push({ id, depth: tn.depth });
        }

        // Rebuild childIds
        for (const n of nodesOut) {
            if (n.parentId !== null) {
                const parent = nodesOut.find(p => p.id === n.parentId);
                if (parent) parent.childIds.push(n.id);
            }
        }

        // ── Radial layout ──
        layoutRadial(nodesOut);

        const content = JSON.stringify({ theme, nodes: nodesOut });
        return res.json({ success: true, content });

    } catch (e) {
        console.error('[cartes/generate] AI error:', e.message || e);
        return res.json({ success: false, error: 'Erreur du service IA. Réessaie dans quelques instants.' });
    }
});

/**
 * Radial layout: position nodes in a fan around their parent.
 * Root centered, level-1 branches spaced equally, sub-branches fan out.
 */
function layoutRadial(nodes) {
    const byId = new Map(nodes.map(n => [n.id, n]));
    const root = nodes.find(n => n.isRoot);
    if (!root) return;

    const CX = 600, CY = 400;
    root.x = CX;
    root.y = CY;

    function subtreeSize(id) {
        const n = byId.get(id);
        if (!n || !n.childIds.length) return 1;
        return n.childIds.reduce((s, cid) => s + subtreeSize(cid), 0);
    }

    function layoutChildren(parentId, angleStart, angleEnd, radius) {
        const parent = byId.get(parentId);
        if (!parent || !parent.childIds.length) return;

        const totalWeight = parent.childIds.reduce((s, cid) => s + subtreeSize(cid), 0);
        let currentAngle = angleStart;

        for (const cid of parent.childIds) {
            const child = byId.get(cid);
            if (!child) continue;

            const weight = subtreeSize(cid);
            const sweep = (angleEnd - angleStart) * (weight / totalWeight);
            const midAngle = currentAngle + sweep / 2;

            child.x = Math.round(parent.x + Math.cos(midAngle) * radius);
            child.y = Math.round(parent.y + Math.sin(midAngle) * radius);

            // Sub-branches get a tighter radius and narrower angle
            const nextRadius = Math.max(140, radius * 0.8);
            layoutChildren(cid, midAngle - sweep * 0.4, midAngle + sweep * 0.4, nextRadius);

            currentAngle += sweep;
        }
    }

    // Full circle, 240px initial radius for level-1 branches
    layoutChildren(root.id, 0, 2 * Math.PI, 240);

    // Shift so no negative coords
    let minX = Infinity, minY = Infinity;
    for (const n of nodes) { minX = Math.min(minX, n.x); minY = Math.min(minY, n.y); }
    const padX = Math.max(0, 100 - minX);
    const padY = Math.max(0, 100 - minY);
    for (const n of nodes) { n.x += padX; n.y += padY; }
}

module.exports = router;
