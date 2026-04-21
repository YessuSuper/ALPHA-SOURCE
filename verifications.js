// verifications.js - Vérifications périodiques pour le système de points
const fs = require('fs');
const path = require('path');
const https = require('https');
const { checkAndApplyMessageRewards, checkAndApplyRankingRewards, checkInactiveUsers, checkFillActivity, recalculateBadges } = require('./js/points.js');
const { log, logToFile } = require('./logger.js');
const { readUsers, writeUsers } = require('./routes/shared');
const { stmts, db } = require('./db');
const { groqCall, routerModel } = require('./routes/ai-client');

// Variable pour suivre le dernier enregistrement de graphique
let lastGraphUpdate = null;

// Fonction pour enregistrer les points du jour dans graph_pt
function recordDailyPoints() {
    try {
        const now = new Date();
        const today = now.toISOString().split('T')[0]; // Format: YYYY-MM-DD
        
        // VÃ©rifier si on a dÃ©jÃ  enregistrÃ© aujourd'hui
        if (lastGraphUpdate === today) {
            return; // DÃ©jÃ  fait aujourd'hui
        }
        
        console.log(`[GRAPH] Enregistrement des points du jour : ${today}`);
        
        // Lire users depuis SQL
        const users = readUsers();
        let updated = false;
        
        users.forEach(user => {
            // Initialiser graph_pt si nÃ©cessaire
            if (!Array.isArray(user.graph_pt)) {
                user.graph_pt = [];
            }
            
            // VÃ©rifier si on a dÃ©jÃ  un enregistrement pour aujourd'hui
            const existingEntry = user.graph_pt.find(entry => entry.date === today);
            
            if (!existingEntry) {
                // Ajouter les points du jour
                user.graph_pt.push({
                    date: today,
                    points: user.pt || 0
                });
                updated = true;
                console.log(`[GRAPH] ${user.username}: ${user.pt || 0} points enregistrÃ©s`);
            }
        });
        
        // Sauvegarder si modifié
        if (updated) {
            writeUsers(users);
            lastGraphUpdate = today;
            console.log(`[GRAPH] Enregistrement terminÃ© pour ${today}`);
        }
        
    } catch (e) {
        console.error("[GRAPH] Erreur lors de l'enregistrement des points du jour :", e);
    }
}
// ============================================================
// RÉSUMÉ HORAIRE DES CONVERSATIONS IA (via Gemini)
// ============================================================
const GEMINI_KEY = 'AIzaSyBRsrKSat9x6z4NfXm_sPlsDHPlRshKtN0';
let lastHourlySummary = null;

/**
 * Appelle Gemini generateContent via HTTPS (pas de SDK nécessaire)
 */
function callGemini(prompt, maxTokens = 1024) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: maxTokens, temperature: 0.4 }
        });

        const url = new URL(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`);

        const req = https.request({
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text) resolve(text);
                    else reject(new Error('Gemini: réponse vide — ' + data.slice(0, 200)));
                } catch (e) { reject(e); }
            });
        });
        req.on('error', reject);
        req.setTimeout(30000, () => { req.destroy(); reject(new Error('Gemini timeout')); });
        req.write(body);
        req.end();
    });
}

/**
 * Fallback Groq si Gemini est indisponible (quota, timeout, etc.)
 */
async function callGroqSummary(prompt, maxTokens = 1024) {
    const result = await groqCall(client => client.chat.completions.create({
        model: routerModel,
        messages: [
            { role: 'system', content: 'Tu es un assistant de synthèse. Réponds uniquement en JSON valide.' },
            { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        max_completion_tokens: maxTokens
    }));
    const text = result?.choices?.[0]?.message?.content;
    if (!text) {
        throw new Error('Groq: réponse vide');
    }
    return text;
}

/**
 * Fallback local sans IA pour ne jamais bloquer la mémoire collective.
 */
function buildLocalSummary(pending) {
    const stopwords = new Set([
        'de', 'la', 'le', 'les', 'un', 'une', 'des', 'du', 'et', 'ou', 'a', 'au', 'aux', 'en', 'dans', 'pour', 'sur',
        'avec', 'que', 'qui', 'quoi', 'comment', 'quand', 'est', 'sont', 'je', 'tu', 'il', 'elle', 'nous', 'vous', 'ils',
        'elles', 'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'son', 'sa', 'ses', 'ce', 'cet', 'cette', 'ces', 'pas', 'plus'
    ]);

    const counts = new Map();
    for (const c of pending) {
        const text = `${c.user_message || ''} ${c.ai_response || ''}`.toLowerCase();
        const words = text
            .replace(/[^a-zàâäéèêëïîôùûüç0-9\s-]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length >= 4 && !stopwords.has(w));
        for (const w of words) counts.set(w, (counts.get(w) || 0) + 1);
    }

    const topKeywords = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([w]) => w);

    const topFive = topKeywords.slice(0, 5);
    return {
        resume: `Résumé automatique local: ${pending.length} conversation(s) traitée(s). Les demandes ont principalement porté sur: ${topFive.join(', ') || 'sujets variés'}.`,
        themes: [
            {
                titre: 'demandes des élèves',
                description: `Synthèse locale basée sur ${pending.length} conversation(s) en attente.`,
                mots_cles: [
                    topFive[0] || 'devoirs',
                    topFive[1] || 'aide',
                    topFive[2] || 'cours',
                    topFive[3] || 'questions',
                    topFive[4] || 'classe'
                ]
            }
        ]
    };
}

/**
 * Traitement horaire: résume les conversations en attente puis les supprime
 */
async function processHourlySummary() {
    try {
        const now = new Date();
        const nowStr = now.toLocaleString('fr-FR');

        // Empêcher double exécution dans la même heure
        const currentHour = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`;
        if (lastHourlySummary === currentHour) return;

        const pending = stmts.getAllChatPending.all();
        if (!pending || pending.length === 0) {
            console.log(`[KNOWLEDGE] ${nowStr} — Aucune conversation en attente.`);
            lastHourlySummary = currentHour;
            return;
        }

        console.log(`[KNOWLEDGE] ${nowStr} — ${pending.length} conversation(s) à résumer...`);

        // Construire le texte des conversations pour l'IA
        const conversationsText = pending.map((c, i) => {
            return `[Conv ${i + 1}] ${c.username} (${c.mode}) à ${c.created_at}:\n  Élève: ${c.user_message.slice(0, 500)}\n  IA: ${c.ai_response.slice(0, 500)}`;
        }).join('\n\n');

        const prompt = `Tu es un assistant d'analyse pour un site scolaire (AlphaSource). Voici les conversations IA des élèves de la dernière heure.

CONVERSATIONS:
${conversationsText.slice(0, 8000)}

TÂCHE: Génère un résumé structuré en JSON STRICT (pas de markdown, pas de \`\`\`):
{
  "resume": "Résumé global de ce qui s'est passé (2-4 phrases): quelles demandes, quels sujets, quels besoins des élèves",
  "themes": [
    {
      "titre": "Titre du thème (ex: Devoirs de maths)",
      "description": "Détail en 1-2 phrases",
      "mots_cles": ["mot1", "mot2", "mot3", "mot4", "mot5"]
    }
  ]
}

RÈGLES:
- Chaque thème doit avoir EXACTEMENT 5 mots-clés pertinents (noms d'élèves, matières, types de demande, etc.)
- Les mots-clés doivent être en minuscule, simples, et utiles pour une recherche future
- Regroupe les conversations similaires en un seul thème
- Maximum 6 thèmes
- Réponds UNIQUEMENT avec le JSON, rien d'autre`;

        let aiResponseText = '';
        try {
            aiResponseText = await callGemini(prompt, 1500);
        } catch (geminiError) {
            console.warn(`[KNOWLEDGE] Gemini indisponible (${geminiError.message}) → fallback Groq`);
            try {
                aiResponseText = await callGroqSummary(prompt, 1200);
            } catch (groqError) {
                console.warn(`[KNOWLEDGE] Groq indisponible (${groqError.message}) → fallback local`);
                const local = buildLocalSummary(pending);
                aiResponseText = JSON.stringify(local);
            }
        }

        // Parser le JSON (nettoyer d'éventuels backticks)
        const cleaned = String(aiResponseText).replace(/```json\s*|```\s*/g, '').trim();
        let parsed;
        try {
            const jsonMatch = cleaned.match(/\{[\s\S]*\}$/);
            parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
        } catch (e) {
            console.error('[KNOWLEDGE] Erreur parsing JSON résumé:', e.message, '\nRéponse brute:', cleaned.slice(0, 300));
            const local = buildLocalSummary(pending);
            parsed = local;
        }

        // Extraire tous les mots-clés de tous les thèmes
        const allKeywords = [];
        if (Array.isArray(parsed.themes)) {
            parsed.themes.forEach(t => {
                if (Array.isArray(t.mots_cles)) {
                    allKeywords.push(...t.mots_cles.map(k => String(k).toLowerCase().trim()));
                }
            });
        }

        // Stocker le résumé
        const periodEnd = now.toISOString();
        const periodStart = new Date(now.getTime() - 3600000).toISOString();

        const fullSummary = JSON.stringify({
            resume: parsed.resume || '',
            themes: parsed.themes || []
        });

        stmts.insertKnowledgeSummary.run({
            summary: fullSummary,
            keywords: JSON.stringify([...new Set(allKeywords)]),
            period_start: periodStart,
            period_end: periodEnd,
            conversation_count: pending.length
        });

        // Supprimer les conversations traitées
        stmts.clearChatPending.run();

        console.log(`[KNOWLEDGE] Résumé stocké: ${pending.length} conv → ${allKeywords.length} mots-clés, ${(parsed.themes || []).length} thèmes`);
        lastHourlySummary = currentHour;

    } catch (e) {
        console.error('[KNOWLEDGE] Erreur traitement horaire:', e.message);
    }
}
// Fonction principale de vÃ©rifications
function startVerifications() {
    log('info', 'Démarrage du service de vérifications de points...', 'verifications');

    // Enregistrer les points immÃ©diatement au dÃ©marrage
    recordDailyPoints();
    
    // VÃ©rifications immÃ©diates au dÃ©marrage
    performVerifications();

    // VÃ©rifications toutes les 5 minutes
    setInterval(() => {
        console.log("[VERIFICATIONS] VÃ©rifications pÃ©riodiques en cours...");
        performVerifications();
        
        // Enregistrer les points du jour (sera ignorÃ© si dÃ©jÃ  fait aujourd'hui)
        recordDailyPoints();
    }, 300000); // 5 minutes

    // Résumé horaire des conversations IA (toutes les heures)
    processHourlySummary(); // exécuter au démarrage aussi
    setInterval(() => {
        processHourlySummary();
    }, 3600000); // 1 heure

    // Garder le processus en vie
    process.on('SIGINT', () => {
        console.log("[VERIFICATIONS] ArrÃªt du service de vÃ©rifications...");
        process.exit(0);
    });
}

// Fonction qui effectue toutes les vÃ©rifications
function performVerifications() {
    try {
        checkAndApplyMessageRewards();
        checkAndApplyRankingRewards();
        checkInactiveUsers();
        checkFillActivity();
        recalculateBadges();
    } catch (e) {
        console.error('[VERIFICATIONS] Erreur lors des vérifications :', e);
        logToFile('error', `Erreur vérifications : ${e.message}`, 'verifications');
    }
}

// DÃ©marrer les vÃ©rifications
startVerifications();
