'use strict';
const express = require('express');
const router = express.Router();
const {
    fs, path, fsPromises,
    PUBLIC_API_DIR,
    getEvolvingDBContent, updateEvolvingDBWithNewData,
    clampText
} = require('./shared');
const { ai, model, visionModel, routerModel, groqCall } = require('./ai-client');
const { incrementMessageCount, spendPoints } = require('../js/points');

// ── Cache mémoire pour users_detailed_data.json ──────────────────────────────
let _detailedDataCache = { data: null, ts: 0, path: '' };
const DETAILED_DATA_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

async function getDetailedUsersData() {
    const filePath = path.join(PUBLIC_API_DIR, 'users_detailed_data.json');
    const now = Date.now();
    if (_detailedDataCache.data && _detailedDataCache.path === filePath && (now - _detailedDataCache.ts < DETAILED_DATA_CACHE_TTL)) {
        return _detailedDataCache.data;
    }
    const fileContent = await fsPromises.readFile(filePath, 'utf8');
    const parsed = JSON.parse(fileContent);
    _detailedDataCache = { data: parsed, ts: Date.now(), path: filePath };
    return parsed;
}

// =================================================================
// API Chat Gemini (DOUBLE GEMINI + BDD ÉVOLUTIVE TEXTE)
// =================================================================
router.post('/public/api/chat', async (req, res) => {
    let newTotalPoints = 0;

    try {
        const {
            history,
            currentMessage,
            creativity,
            base64File,
            mimeType,
            systemInstruction,
            username,
            modeValue
        } = req.body;

        console.log(`[CHAT] Requête reçue: user="${username}", mode="${modeValue}", msg="${(currentMessage||'').slice(0,30)}", hasFile=${!!base64File}, mime=${mimeType||'none'}`);

        if (!currentMessage && !base64File) {
            return res.status(400).json({
                success: false,
                response: "Message vide.",
                newIndividualPoints: 0
            });
        }

        // Validation longueur message (max 10KB)
        if (currentMessage && currentMessage.length > 10000) {
            return res.status(400).json({
                success: false,
                response: "Message trop long (max ~10 000 caractères).",
                newIndividualPoints: 0
            });
        }

        // === ROUTAGE : FAUT-IL LES DONNÉES ÉLÈVE ? ===
        const isScolaireMode = (modeValue || '').toLowerCase() === 'scolaire';
        let studentContext = "";

        // En mode Scolaire, toujours charger les données élève.
        // Le coût en tokens est acceptable vu la vitesse de Groq,
        // et ça évite que le router rate des questions implicites.

        // === RÉCUPÉRATION DONNÉES ÉLÈVE (seulement en mode Scolaire) ===
        if (isScolaireMode) {
          try {
            console.log(`[SCOLAIRE] Mode scolaire activé pour user="${username}", chargement des données...`);
            const allUsersData = await getDetailedUsersData();

            const normalizedUsername = (username || '').trim().toLowerCase();
            const usersArray = Object.values(allUsersData || {});
            let userEntry = null;

            if (usersArray.length === 1) {
                userEntry = usersArray[0];
            }

            if (!userEntry) {
                userEntry = usersArray.find(u => {
                    const acc = u.account || {};
                    const prenom = (acc.prenom || '').trim().toLowerCase();
                    const nom = (acc.nom || '').trim().toLowerCase();
                    const full = `${prenom} ${nom}`.trim();
                    const identifiant = (acc.identifiant || '').trim().toLowerCase();
                    const idStr = (acc.id !== undefined && acc.id !== null) ? String(acc.id).trim().toLowerCase() : '';

                    if (!normalizedUsername) return false;

                    const matchPrenom = prenom && normalizedUsername === prenom;
                    const matchNom = nom && normalizedUsername === nom;
                    const matchFull = full && normalizedUsername === full;
                    const matchIdent = identifiant && normalizedUsername === identifiant;
                    const matchId = idStr && normalizedUsername === idStr;
                    const containsPrenom = prenom && normalizedUsername.includes(prenom);
                    const containsFull = full && normalizedUsername.includes(full);

                    return matchPrenom || matchNom || matchFull || matchIdent || matchId || containsFull || containsPrenom;
                });
            }

            if (userEntry) {
                const parts = [];

                // 1. EDT (toujours inclus)
                if (userEntry.edt && Array.isArray(userEntry.edt)) {
                    const now = new Date();
                    const upcomingEdt = userEntry.edt
                        .filter(c => c && c.start_date && new Date(c.start_date) >= now)
                        .slice(0, 15);

                    const simpleEdt = upcomingEdt.map(c => {
                        const isCancelled = c.isAnnule || (c.statut && c.statut.includes('Annul')) || (c.text && c.text.match(/annul|absent/i));
                        const statusStr = isCancelled ? " [⚠️ COURS ANNULÉ / PROF ABSENT]" : "";
                        const startLabel = (c.start_date || '').substring(0, 16) || 'Date inconnue';
                        const matiere = c.matiere || 'Cours';
                        const salle = c.salle ? `(${c.salle})` : '';
                        return `${startLabel}: ${matiere} ${salle}${statusStr}`.trim();
                    }).join('\n');
                    parts.push(`[EDT PROCHAIN (Date YYYY-MM-DD HH:MM)]\n${simpleEdt || 'Aucun cours prochainement.'}`);
                }

                // 2. NOTES (TOUTES les périodes)
                if (userEntry.notes && userEntry.notes.periodes) {
                    const allPeriodes = userEntry.notes.periodes;
                    const allNotesParts = [];

                    // Ne garder que les 2 périodes les plus récentes pour limiter les tokens
                    const recentPeriodes = allPeriodes.slice(-2);
                    for (const periode of recentPeriodes) {
                        const periodeName = periode.periode || periode.libelle || `Période`;
                        const isClosed = periode.cloture !== false;
                        const statusLabel = isClosed ? '(clôturé)' : '(en cours)';

                        const em = periode.ensembleMatieres;
                        if (em) {
                            // Moyenne générale de la période
                            const headerLines = [];
                            if (em.moyenneGenerale) headerLines.push(`Moyenne générale: ${em.moyenneGenerale}`);
                            if (em.moyenneClasse) headerLines.push(`Moyenne classe: ${em.moyenneClasse}`);
                            if (em.moyenneMin) headerLines.push(`Min classe: ${em.moyenneMin}`);
                            if (em.moyenneMax) headerLines.push(`Max classe: ${em.moyenneMax}`);
                            const headerBlock = headerLines.length > 0 ? headerLines.join(' | ') + '\n' : '';

                            // Détail par matière
                            const matieresRaw = Array.isArray(em)
                                ? em
                                : (em.disciplines && Array.isArray(em.disciplines)
                                    ? em.disciplines
                                    : []);

                            const notesSummary = matieresRaw.map(m => {
                                const label = m.matiere || m.discipline || 'Matière';
                                const moy = m.moyenneGenerale || m.moyenne || '';
                                const moyTxt = moy ? `Moy: ${moy}` : '';
                                const lastNotes = Array.isArray(m.devoirs) ? m.devoirs.slice(0, 2).map(d => d.noteSur20).join(', ') : '';
                                return `${label}: ${moyTxt} ${lastNotes ? `(Dernières: ${lastNotes})` : ''}`.trim();
                            }).join('\n');

                            if (headerBlock || notesSummary) {
                                allNotesParts.push(`--- ${periodeName} ${statusLabel} ---\n${headerBlock}${notesSummary}`);
                            }
                        }
                    }

                    parts.push(`[NOTES & MOYENNES — TOUTES PÉRIODES]\n${allNotesParts.join('\n\n') || 'Notes non trouvées.'}`);
                }

                // 3. DEVOIRS (toujours inclus)
                if (userEntry.devoirs && Array.isArray(userEntry.devoirs)) {
                        const now = new Date();
                        const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

                        const upcomingHw = userEntry.devoirs
                            .filter(d => {
                                const isDone = d.aFaire && d.aFaire.effectue;
                                const dueDate = new Date(d.date);
                                return (!isDone) || (dueDate >= todayMidnight);
                            })
                            .slice(0, 10);

                        const simpleHw = upcomingHw.map(d => {
                            const rawContent = (d.aFaire && (d.aFaire.contenuDecoded || d.aFaire.contenu)) || '';
                            const content = (typeof rawContent === 'string' ? rawContent : '').trim();
                            const preview = content ? `${content.substring(0, 80)}${content.length > 80 ? '...' : ''}` : 'Aucun détail';

                            const isDone = !!(d.aFaire && d.aFaire.effectue);
                            const dueDate = d.date ? new Date(d.date) : todayMidnight;

                            let status = isDone ? "✅ Fait" : "❌ À FAIRE";
                            if (!isDone && dueDate < todayMidnight) {
                                status = "⚠️ EN RETARD";
                            }

                            const dateLabel = d.date || 'Date inconnue';
                            const matiere = d.matiere || 'Matière inconnue';
                            return `${dateLabel}: ${matiere} - ${preview} [${status}]`;
                        }).join('\n');
                        parts.push(`[LISTE DES DEVOIRS (À FAIRE / EN RETARD / PROCHAINS)]\n${simpleHw || 'Aucun devoir à afficher.'}`);
                }

                if (parts.length > 0) {
                    studentContext = `\n=== DONNÉES ÉLÈVE (${userEntry.account.prenom}) ===\n${parts.join('\n\n')}\n==============================\n`;
                    console.log(`[SCOLAIRE] Données chargées pour ${userEntry.account.prenom}: EDT=${parts.some(p=>p.includes('[EDT'))}, Notes=${parts.some(p=>p.includes('[NOTES'))}, Devoirs=${parts.some(p=>p.includes('[DEVOIRS'))}`);
                }
            } else {
                console.log(`[SCOLAIRE] Aucun userEntry trouvé pour "${username}"`);
            }
          } catch (e) {
            console.warn("Impossible de charger le contexte élève:", e.message);
          }
        } // fin if (isScolaireMode)

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
                .map(m => ({
                    role: m.role === 'model' ? 'assistant' : m.role,
                    content: m.parts.map(p => p.text || '').join('')
                }))
            : [];

        const contextFromClient = systemInstruction || "";

        const now = new Date();
        const dateOptions = { timeZone: 'Europe/Paris', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        const dateStr = now.toLocaleString('fr-FR', dateOptions);

        const finalSystemPrompt = (() => {
            const base = `DATE ET HEURE ACTUELLE : ${dateStr}\n${contextFromClient.trim()}\n\nRÈGLES D'AGENT :\n-Tu dois etre respectueux et amical(n'hesite pas à taquiner un peulutilisateur ou bien à lui parler comme son pote)`;

            if (isScolaireMode && studentContext) {
                // Mode Scolaire AVEC données élève injectées
                return `${base}\n\n[MODE SCOLAIRE — DONNÉES ÉLÈVE RÉELLES DISPONIBLES]\nIMPORTANT : Les données ci-dessous sont les VRAIES données de l'élève extraites d'EcoleDirecte. Utilise UNIQUEMENT ces données pour répondre aux questions sur les notes, l'EDT et les devoirs. Ne devine JAMAIS et n'invente JAMAIS de données.\n${studentContext}\nSi une donnée n'apparaît pas ci-dessus (par ex. aucun devoir listé), dis clairement qu'il n'y a pas de données disponibles pour cette catégorie — ne fabrique pas de réponse.`.trim();
            } else if (isScolaireMode) {
                // Mode Scolaire mais aucune donnée trouvée pour cet élève
                return `${base}\n\n[MODE SCOLAIRE — AUCUNE DONNÉE ÉLÈVE TROUVÉE]\nTu es en mode Scolaire mais aucune donnée scolaire n'a pu être chargée pour cet utilisateur. Dis-lui que ses données ne sont pas disponibles et qu'il doit vérifier qu'il est bien connecté.`.trim();
            } else {
                // Modes basique / apprentissage / devoirs — PAS d'accès aux données élève
                return `${base}\n\n[MODE ${(modeValue || 'basique').toUpperCase()}]\nTu n'as PAS accès aux données scolaires de l'élève (notes, emploi du temps, devoirs). Si l'utilisateur te demande ses notes, son emploi du temps, ses devoirs ou toute info scolaire personnelle, réponds-lui amicalement qu'il doit passer en mode "Scolaire" (dans les paramètres) pour que tu puisses accéder à ces informations.`.trim();
            }
        })();

        const hasImage = base64File && mimeType && typeof base64File === 'string';
        const MAX_INLINE_BASE64 = 4 * 1024 * 1024; // 4MB max
        const canAttachImage = hasImage && base64File.length <= MAX_INLINE_BASE64;

        if (hasImage) {
            console.log(`[CHAT] Image détectée: mime=${mimeType}, taille=${(base64File.length / 1024).toFixed(0)}KB, canAttach=${canAttachImage}`);
        }

        let userMessage;
        if (canAttachImage) {
            // Format multimodal OpenAI-compatible pour Groq Vision
            const contentParts = [];
            if (currentMessage) contentParts.push({ type: 'text', text: currentMessage });
            contentParts.push({
                type: 'image_url',
                image_url: { url: `data:${mimeType};base64,${base64File}` }
            });
            userMessage = { role: 'user', content: contentParts };
            console.log(`[CHAT] Mode vision activé: modèle=${visionModel}, ${contentParts.length} parts`);
        } else {
            userMessage = { role: 'user', content: currentMessage || '' };
        }

        // Choisir le modèle : vision si image, texte sinon
        const activeModel = canAttachImage ? visionModel : model;

        const messages = [
            { role: "system", content: finalSystemPrompt },
            ...cleanedHistory,
            userMessage
        ];

        // =========================
        // 2️⃣ APPEL IA PRINCIPALE
        // =========================
        const withTimeout = (promise, ms) => {
            return new Promise((resolve, reject) => {
                const t = setTimeout(() => reject(new Error('IA timeout')), ms);
                promise.then(v => { clearTimeout(t); resolve(v); }, err => { clearTimeout(t); reject(err); });
            });
        };

        let aiResponse = "Réponse vide.";
        try {
            const mainResult = await withTimeout(
                groqCall(client => client.chat.completions.create({
                    model: activeModel,
                    messages,
                    temperature: Number(creativity) || 0.6,
                    max_completion_tokens: 1024
                })),
                canAttachImage ? 30000 : (isScolaireMode ? 25000 : 15000)
            );
            aiResponse = mainResult.choices?.[0]?.message?.content || aiResponse;
        } catch (e) {
            const isRateLimit = e.status === 429 || (e.message && e.message.includes('rate_limit'));
            console.warn(`[CHAT] IA erreur (${isRateLimit ? 'RATE LIMIT' : 'timeout/autre'}):`, e.message);
            if (isRateLimit) {
                aiResponse = "⏳ Toutes les clés API sont en rate-limit. Attends ~1 minute et réessaie.";
            } else {
                aiResponse = "Désolé, la réponse a pris trop de temps. Réessaie ou reformule ta question.";
            }
        }

        if (currentMessage && currentMessage.length > 15) {
            incrementMessageCount(username, 'ai');
        }

        if (systemInstruction && systemInstruction.toLowerCase().includes("devoirs")) {
            spendPoints(username, 3);
        }

        // =========================
        // 3️⃣ RÉPONSE IMMÉDIATE AU CLIENT
        // =========================
        res.json({ success: true, response: aiResponse, newIndividualPoints: newTotalPoints });

        // =========================
        // 4️⃣ ANALYSE BDD EN ARRIÈRE-PLAN (NON BLOQUANTE) — EN PAUSE pour économiser les tokens
        // =========================
        const BDD_EVOLVING_ENABLED = false;
        if (BDD_EVOLVING_ENABLED) setImmediate(async () => {
            try {
                const currentDB = getEvolvingDBContent();
                const safeCurrentDB = typeof currentDB === 'string' ? currentDB.slice(-4000) : "";
                const shortUserMsg = clampText(currentMessage || '', 280);
                const shortAiMsg = clampText(aiResponse || '', 320);

                const analysisPrompt = `
Tu es l'IA d'analyse de la BDD évolutive. Retourne uniquement du JSON valide.
- Repars de la BDD fournie sans supprimer les champs existants.
- Ajoute l'échange du jour dans "historiques" en restant concis (user: 1 ligne, ia: 2 phrases max).
- Optionnel: ajoute 1-2 faits utiles dans "nouvelles_infos" (<=200 caractères chacun) seulement s'ils aident l'IA principale.
- Ne réécris pas de longs blocs, ne change pas les autres champs.
- Si rien à ajouter, renvoie la BDD telle quelle.

BDD (tronquée si besoin):
${safeCurrentDB || "Aucune donnée"}

Dernière interaction:
user (${username || 'inconnu'}) : "${shortUserMsg}"
ia : "${shortAiMsg}"
`;

                const dbResult = await groqCall(client => client.chat.completions.create({
                    model,
                    messages: [{ role: 'user', content: analysisPrompt }],
                    temperature: 0.1,
                    max_tokens: 400
                }));

                const cleanedJSON = (dbResult.choices?.[0]?.message?.content || "").replace(/```json|```/g, '').trim();
                if (cleanedJSON) updateEvolvingDBWithNewData(username, cleanedJSON);
            } catch (e) {
                console.error("[BDD] Échec mise à jour (background) :", e.message);
            }
        });

        return;

    } catch (error) {
        console.error("ERREUR /public/api/chat :", error);
        return res.status(500).json({
            success: false,
            response: "Erreur serveur IA.",
            newIndividualPoints: newTotalPoints
        });
    }
});

module.exports = router;
