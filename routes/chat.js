'use strict';
const express = require('express');
const router = express.Router();
const https = require('https');
const {
    fs, path, fsPromises,
    PUBLIC_API_DIR
} = require('./shared');
const { ai, model, visionModel, routerModel, groqCall } = require('./ai-client');
const { incrementMessageCount } = require('../js/points');
const { stmts } = require('../db');

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
// DÉTECTION CONTEXTE SCOLAIRE — 500+ mots-clés (hybrid option 3)
// =================================================================
const SCHOOL_KEYWORDS = [
    // ── NOTES & ÉVALUATIONS ──
    'note','notes','moyenne','moyennes','bulletin','bulletins','relevé','releve','relevés','releves',
    'résultat','resultat','résultats','resultats','évaluation','evaluation','évaluations','evaluations',
    'interro','interrogation','interrogations','interros','contrôle','controle','contrôles','controles',
    'devoir surveillé','ds','dst','dm','brevet blanc','examen','examens','partiel','partiels',
    'coeff','coefficient','coefficients','barème','bareme','barèmes','baremes','notation','notations',
    'appréciation','appreciation','appréciations','appreciations','compétence','competence','compétences','competences',
    'acquis','non acquis','en cours d\'acquisition','insuffisant','fragile','satisfaisant','très satisfaisant',
    'a+','a','b','c','d','e','f','sur 20','sur 10','/20','/10','point','points','bonus',
    'meilleure note','pire note','dernière note','derniere note','première note','premiere note',
    'note max','note min','plus haute','plus basse','combien j\'ai eu','combien j ai eu',
    'ma note','mes notes','ma moyenne','mes moyennes','j\'ai eu combien','j ai eu combien',
    'quelle note','quelles notes','j\'ai combien','j ai combien','résultat du','resultat du',
    'correction','corrections','corrigé','corrige','corrigés','corriges','rendu','rendus',
    'rattrapé','rattrape','rattrapage','rattrapages','oral','oraux','écrit','ecrit','écrits','ecrits',
    'qcm','questionnaire','test','tests','bilan','bilans','diplôme','diplome','diplômes','diplomes',
    'brevet','dnb','mention','mentions','admis','refusé','refuse','ajourné','ajourne',

    // ── EMPLOI DU TEMPS & PLANNING ──
    'emploi du temps','edt','planning','calendrier','agenda','semaine','semaines',
    'lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche',
    'cours','heure','heures','horaire','horaires','créneau','creneau','créneaux','creneaux',
    'début','debut','fin','pause','récréation','recreation','récré','recre','récrée','recree',
    'midi','cantine','demi-pension','permanence','perm','perms','étude','etude','études','etudes',
    'salle','salles','bâtiment','batiment','bâtiments','batiments','gymnase','cdi','labo','laboratoire',
    'quand','à quelle heure','a quelle heure','commence','finit','termine','dure','durée','duree',
    'prochain cours','prochain','prochaine','prochains','prochaines','suivant','suivante',
    'aujourd\'hui','aujourd hui','demain','après-demain','apres-demain','hier','avant-hier',
    'ce matin','cet après-midi','cet apres-midi','ce soir','cette semaine','la semaine prochaine',
    'lundi prochain','mardi prochain','mercredi prochain','jeudi prochain','vendredi prochain',
    'premier cours','dernier cours','combien de cours','combien d\'heures','combien d heures',
    'journée','journee','matinée','matinee','après-midi','apres-midi','soirée','soiree',
    'rentrée','rentree','vacances','férié','ferie','fériés','feries','pont','ponts',
    'toussaint','noël','noel','pâques','paques','été','ete','printemps','hiver','automne',

    // ── DEVOIRS & TRAVAIL ──
    'devoir','devoirs','exercice','exercices','exo','exos','travail','travaux','homework',
    'à faire','a faire','à rendre','a rendre','date limite','deadline','échéance','echeance',
    'pour demain','pour lundi','pour mardi','pour mercredi','pour jeudi','pour vendredi',
    'pour la semaine','pour quand','c\'est pour quand','c est pour quand',
    'fait','pas fait','fini','pas fini','terminé','termine','pas terminé','pas termine',
    'en retard','retard','retards','oublié','oublie','oubliés','oublies',
    'rédaction','redaction','rédactions','redactions','dissertation','dissertations',
    'exposé','expose','exposés','exposes','présentation','presentation','présentations','presentations',
    'dossier','dossiers','projet','projets','rapport','rapports','compte-rendu','compte rendu',
    'fiche','fiches','résumé','resume','résumés','resumes','synthèse','synthese','synthèses','syntheses',
    'révision','revision','révisions','revisions','réviser','reviser','apprendre','mémoriser','memoriser',
    'leçon','lecon','leçons','lecons','chapitre','chapitres','page','pages','paragraphe',
    'cahier de texte','cahier de textes','agenda scolaire','carnet','carnets',

    // ── MATIÈRES SCOLAIRES ──
    'math','maths','mathématiques','mathematiques','algèbre','algebre','géométrie','geometrie',
    'calcul','calculs','équation','equation','équations','equations','fonction','fonctions',
    'théorème','theoreme','théorèmes','theoremes','pythagore','thalès','thales',
    'français','francais','grammaire','conjugaison','orthographe','vocabulaire','dictée','dictee',
    'rédac','redac','expression écrite','expression ecrite','compréhension','comprehension',
    'littérature','litterature','lecture','lectures','roman','romans','poésie','poesie',
    'histoire','géographie','geographie','géo','geo','hist-géo','hist-geo','histoire-géo','histoire-geo',
    'éducation civique','education civique','emc','enseignement moral','citoyen','citoyenneté','citoyennete',
    'anglais','english','espagnol','español','allemand','deutsch','italien','italiano',
    'lv1','lv2','lv3','langue','langues','langue vivante','langues vivantes',
    'svt','sciences','science','biologie','bio','physique','chimie','physique-chimie','physique chimie',
    'technologie','techno','informatique','info','numérique','numerique','nsi','isn','snt',
    'eps','sport','sports','éducation physique','education physique','athlétisme','athletisme',
    'musique','arts plastiques','arts','dessin','peinture','sculpture',
    'philosophie','philo','ses','économie','economie','sociologie',
    'latin','grec','ancien','langues anciennes','option','options','spécialité','specialite',

    // ── PROFESSEURS & PERSONNEL ──
    'prof','profs','professeur','professeurs','enseignant','enseignants','enseignante','enseignantes',
    'maître','maitre','maîtresse','maitresse','instit','instituteur','institutrice',
    'monsieur','madame','mme','m.','principal','principale','directeur','directrice',
    'cpe','conseiller','conseillère','conseillere','surveillant','surveillante','surveillants',
    'pion','pionne','aed','assistant','assistante','vie scolaire',
    'infirmier','infirmière','infirmiere','infirmerie','médecin','medecin','psychologue','psy',
    'documentaliste','bibliothécaire','bibliothecaire',
    'strict','sévère','severe','cool','sympa','gentil','gentille','méchant','mechant',
    'exigeant','exigeante','noté sévère','note severe','note bien','note mal',
    'absent','absente','absents','absentes','remplaçant','remplacant','remplaçante','remplacante',
    'remplacé','remplace','suppléant','suppleant',

    // ── VIE SCOLAIRE & DISCIPLINE ──
    'absence','absences','retard','retards','justification','justifier','justifié','justifie',
    'mot d\'absence','mot d absence','billet','billets','convocation','convocations',
    'punition','punitions','colle','colles','heure de colle','heures de colle',
    'retenue','retenues','sanction','sanctions','avertissement','avertissements',
    'exclusion','exclusions','renvoi','renvois','exclu','exclue',
    'comportement','comportements','conduite','discipline','indiscipline',
    'règlement','reglement','règle','regle','règles','regles','interdit','interdits',
    'autorisation','autorisations','sortie','sorties','permission','permissions',
    'carnet de correspondance','carnet de liaison','mot','mots','signature','signer',

    // ── ORIENTATION & PARCOURS ──
    'orientation','orienter','parcours','avenir','projet professionnel',
    'stage','stages','stagiaire','rapport de stage','convention','conventions',
    'lycée','lycee','lycées','lycees','collège','college','collèges','colleges',
    'seconde','première','premiere','terminale','bac','baccalauréat','baccalaureat',
    'sixième','sixieme','cinquième','cinquieme','quatrième','quatrieme','troisième','troisieme',
    '6ème','6eme','5ème','5eme','4ème','4eme','3ème','3eme','2nde','1ère','1ere','tle',
    'filière','filiere','filières','filieres','voie','voies','série','serie',
    'générale','generale','technologique','professionnel','professionnelle',
    'apprentissage','alternance','cap','bep','bts','dut','iut','prépa','prepa',
    'université','universite','fac','faculté','faculte','grande école','grande ecole',
    'parcoursup','admission','admissions','voeu','voeux','candidature','candidatures',
    'conseiller d\'orientation','conseiller d orientation','cop','psyen',
    'portes ouvertes','salon','salons','forum','forums',

    // ── CLASSE & CAMARADES ──
    'classe','classes','classement','classements','rang','rangs','place','places',
    'élève','eleve','élèves','eleves','camarade','camarades','copain','copine',
    'ami','amie','amis','amies','pote','potes','groupe','groupes','binôme','binome',
    'délégué','delegue','déléguée','deleguee','délégués','delegues',
    'conseil de classe','conseil','conseils','trimestre','trimestres','semestre','semestres',
    'période','periode','périodes','periodes','année','annee','années','annees',
    'effectif','effectifs','nombre d\'élèves','nombre d eleves',
    'redoublement','redoubler','redoublant','saut de classe','sauter',
    'premier','première','premiere','dernier','dernière','derniere','meilleur','pire',
    'moyenne de classe','moyenne classe','max classe','min classe',

    // ── ECOLE DIRECTE & OUTILS NUMÉRIQUES ──
    'ecole directe','ecoledirecte','école directe','pronote','ent','environnement numérique',
    'application','appli','site','portail','plateforme','connexion','connecter','connecté',
    'identifiant','mot de passe','mdp','login','compte','profil',
    'messagerie scolaire','message prof','mail prof','contacter',
    'cahier de texte numérique','cahier de texte numerique',

    // ── CONTEXTE TEMPOREL SCOLAIRE ──
    'cette année','cette annee','l\'année','l annee','année scolaire','annee scolaire',
    'ce trimestre','ce semestre','cette période','cette periode',
    'la rentrée','la rentree','fin d\'année','fin d annee',
    'prochain trimestre','prochain semestre','prochaine période','prochaine periode',
    'dernier trimestre','dernier semestre','dernière période','derniere periode',
    'septembre','octobre','novembre','décembre','decembre','janvier','février','fevrier',
    'mars','avril','mai','juin','juillet','août','aout',
    'premier trimestre','deuxième trimestre','deuxieme trimestre','troisième trimestre','troisieme trimestre',

    // ── QUESTIONS IMPLICITES SUR L'ÉCOLE ──
    'je suis en','je suis dans','ma classe','mon collège','mon college','mon lycée','mon lycee',
    'mon école','mon ecole','mon établissement','mon etablissement',
    'j\'ai cours','j ai cours','on a cours','on a quoi','qu\'est-ce qu\'on a','qu est-ce qu on a',
    'c\'est quoi le prochain','c est quoi le prochain','il y a quoi','y a quoi',
    'c\'est qui le prof','c est qui le prof','qui est le prof','quel prof',
    'j\'ai quoi','j ai quoi','qu\'est-ce que j\'ai','qu est-ce que j ai',
    'aide-moi pour','aide moi pour','aide pour le','aide pour la','aide pour les',
    'je comprends pas','je comprend pas','j\'arrive pas','j arrive pas',
    'c\'est dur','c est dur','c\'est difficile','c est difficile','c\'est compliqué','c est complique',
    'comment faire','comment on fait','explique-moi','explique moi',
    'tu peux m\'aider','tu peux m aider','aide-moi','aide moi',
    'faut que je','il faut que je','je dois','je dois faire','j\'ai pas fait','j ai pas fait',
    'je suis nul','je suis nulle','je suis mauvais','je suis mauvaise',
    'je galère','je galere','j\'y arrive pas','j y arrive pas',

    // ── EXPRESSIONS FAMILIÈRES / ARGOT SCOLAIRE ──
    'bac','brevet','exam','exams','galère','galere','colle','heures de colle',
    'perm','cdi','récré','recre','bahut','bahuts','rentrée','rentree',
    'sèche','seche','sécher','secher','bidon','planqué','planque',
    'gratter','copier','tricher','antisèche','antiseche','pompe','pompes',
    'taff','bosser','bûcher','bucher','potasser','bachoter','plancher',
    'piger','capter','comprendre','assimiler','retenir','apprendre par coeur',
    'bled','bescherelle','manuels','manuel','bouquin','bouquins','poly','polycopié','polycopie',
    'tableau','tbi','vidéoprojecteur','videoprojecteur','craie','stylo','cahier','classeur',
    'cartable','sac','trousse','calculatrice','compas','règle','equerre','rapporteur',
    'carré','carre','cube','triangle','cercle','angle','angles','droite','parallèle','parallele',
    'perpendiculaire','symétrie','symetrie','fraction','fractions','pourcentage','pourcentages',

    // ── VERBES / ACTIONS SCOLAIRES ──
    'étudier','etudier','travailler','préparer','preparer','revoir','relire',
    'rédiger','rediger','écrire','ecrire','lire','calculer','résoudre','resoudre',
    'démontrer','demontrer','analyser','commenter','expliquer','développer','developper',
    'argumenter','justifier','illustrer','citer','définir','definir','décrire','decrire',
    'comparer','opposer','distinguer','identifier','classer','ordonner','trier',
    'conjuguer','accorder','décliner','decliner','traduire','prononcer','réciter','reciter',
    'mesurer','peser','convertir','tracer','construire','schématiser','schematiser',
    'observer','expérimenter','experimenter','hypothèse','hypothese','conclusion',
    'progresser','améliorer','ameliorer','monter','baisser','chuter','remonter','stagner',
    'réussir','reussir','échouer','echouer','rater','louper','foirer',
    'passer','repasser','rattraper','compenser','valider','invalider'
];

// Compile en une seule regex pour performance (word-boundary quand possible)
const _schoolKeywordsRegex = new RegExp(
    SCHOOL_KEYWORDS
        .sort((a, b) => b.length - a.length) // plus longs d'abord pour éviter les faux positifs partiels
        .map(kw => kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) // escape regex chars
        .join('|'),
    'i'
);

/**
 * Détecte si un message nécessite le contexte scolaire.
 * Étape 1: regex mots-clés (instantané). Étape 2: si mode intelligent, fallback IA router.
 */
function needsSchoolContext(message) {
    if (!message) return false;
    return _schoolKeywordsRegex.test(message);
}

async function aiRouterNeedsSchoolContext(message, withTimeout) {
    try {
        const result = await withTimeout(
            groqCall(client => client.chat.completions.create({
                model: routerModel,
                messages: [
                    { role: 'system', content: 'Tu es un routeur. Réponds UNIQUEMENT par "OUI" ou "NON". La question de l\'utilisateur nécessite-t-elle des données scolaires personnelles (notes, emploi du temps, devoirs, classe, profs) pour être correctement traitée ?' },
                    { role: 'user', content: message.slice(0, 300) }
                ],
                temperature: 0,
                max_completion_tokens: 5
            })),
            5000
        );
        const answer = (result.choices?.[0]?.message?.content || '').trim().toUpperCase();
        console.log(`[ROUTER] IA router verdict: "${answer}" pour msg="${message.slice(0,40)}"`);
        return answer.startsWith('OUI');
    } catch (e) {
        console.warn('[ROUTER] IA router fallback échoué:', e.message);
        return false; // en cas d'erreur, on n'injecte pas
    }
}

// =================================================================
// RECHERCHE WEB — Mode Intelligent uniquement
// =================================================================
const GEMINI_SEARCH_KEY = 'AIzaSyBRsrKSat9x6z4NfXm_sPlsDHPlRshKtN0';

function httpsGetJSON(url, headers = {}) {
    return new Promise((resolve) => {
        https.get(url, { headers: { 'User-Agent': 'AlphaSource/1.0', ...headers } }, (resp) => {
            let data = '';
            resp.on('data', chunk => data += chunk);
            resp.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch { resolve(null); }
            });
        }).on('error', () => resolve(null));
    });
}

function httpsPostJSON(hostname, path, body) {
    return new Promise((resolve) => {
        const bodyStr = JSON.stringify(body);
        const options = {
            hostname, path, method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }
        };
        const req = https.request(options, (resp) => {
            let data = '';
            resp.on('data', chunk => data += chunk);
            resp.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch { resolve(null); }
            });
        });
        req.on('error', () => resolve(null));
        req.write(bodyStr);
        req.end();
    });
}

/**
 * DuckDuckGo Instant Answer API — gratuit, pas de clé
 */
async function searchDuckDuckGo(query) {
    const json = await httpsGetJSON(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`);
    if (!json) return '';
    const results = [];
    if (json.AbstractText) results.push(json.AbstractText);
    if (json.Answer) results.push(json.Answer);
    if (json.Definition) results.push(`Définition: ${json.Definition}`);
    if (json.RelatedTopics) {
        json.RelatedTopics.slice(0, 5).forEach(t => {
            if (t.Text) results.push(t.Text);
            if (t.Topics) t.Topics.slice(0, 2).forEach(st => { if (st.Text) results.push(st.Text); });
        });
    }
    return results.join('\n').slice(0, 2000);
}

/**
 * Wikipedia FR API — excellent pour connaissances encyclopédiques
 */
async function searchWikipedia(query) {
    // D'abord chercher le bon titre via l'API search
    const searchJson = await httpsGetJSON(`https://fr.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=1&format=json`);
    const title = searchJson?.query?.search?.[0]?.title;
    if (!title) return '';
    const json = await httpsGetJSON(`https://fr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
    if (json?.extract) return `Wikipedia — ${title}: ${json.extract}`.slice(0, 1500);
    return '';
}

/**
 * Gemini avec Google Search grounding — fallback payant mais puissant
 */
async function searchWithGemini(query) {
    const json = await httpsPostJSON(
        'generativelanguage.googleapis.com',
        `/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_SEARCH_KEY}`,
        {
            contents: [{ parts: [{ text: `Recherche web et résume factuellement: ${query}` }] }],
            tools: [{ google_search: {} }]
        }
    );
    const text = json?.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join('') || '';
    return text.slice(0, 2000);
}

/**
 * Router IA: décide si une recherche web est nécessaire
 * Retourne { search: boolean, queries?: string[] }
 */
async function aiRouterNeedsWebSearch(message, conversationContext, withTimeout) {
    try {
        const result = await withTimeout(
            groqCall(client => client.chat.completions.create({
                model: routerModel,
                messages: [
                    {
                        role: 'system',
                        content: `Tu es un routeur de recherche web. Décide si la question nécessite une recherche internet.
Réponds UNIQUEMENT en JSON valide, rien d'autre.

RECHERCHE NÉCESSAIRE si:
- Question sur un sujet culturel, scientifique, historique, littéraire (ex: une œuvre, un auteur, un concept)
- La conversation mentionne un sujet spécifique qui mérite plus de contexte (ex: "Antigone" dans les devoirs)
- Question sur l'actualité ou des faits vérifiables
- L'utilisateur demande explicitement de chercher ou de vérifier quelque chose
- L'IA aurait besoin de connaissances précises pour bien répondre

PAS DE RECHERCHE si:
- Small talk / bavardage simple
- Question sur les données scolaires personnelles (notes, EDT, devoirs)
- Question très simple où l'IA peut répondre de mémoire
- L'utilisateur exprime juste un sentiment ou raconte sa journée

Réponds UNIQUEMENT:
{"search": false}
ou
{"search": true, "queries": ["requête 1", "optionnelle requête 2"]}`
                    },
                    {
                        role: 'user',
                        content: `Contexte récent: ${conversationContext.slice(0, 400)}\n\nMessage: "${message.slice(0, 400)}"`
                    }
                ],
                temperature: 0,
                max_completion_tokens: 120
            })),
            5000
        );
        const raw = (result.choices?.[0]?.message?.content || '').trim();
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            console.log(`[SEARCH ROUTER] Verdict: search=${parsed.search}, queries=${JSON.stringify(parsed.queries || [])}`);
            return parsed;
        }
        return { search: false };
    } catch (e) {
        console.warn('[SEARCH ROUTER] Erreur:', e.message);
        return { search: false };
    }
}

/**
 * Exécute la recherche web multi-sources
 * Stratégie: DuckDuckGo + Wikipedia en parallèle, puis Gemini si insuffisant
 */
async function executeWebSearch(queries, withTimeout) {
    const allResults = [];

    for (const query of queries.slice(0, 3)) {
        console.log(`[SEARCH] Recherche: "${query}"`);

        // Étape 1: DuckDuckGo + Wikipedia en parallèle
        const [ddg, wiki] = await Promise.all([
            withTimeout(searchDuckDuckGo(query), 5000).catch(() => ''),
            withTimeout(searchWikipedia(query), 5000).catch(() => '')
        ]);

        const combined = [ddg, wiki].filter(r => r && r.length > 10).join('\n---\n');

        if (combined.length > 80) {
            allResults.push(`🔍 "${query}":\n${combined}`);
            console.log(`[SEARCH] DDG+Wiki OK: ${combined.length} chars`);
        } else {
            // Étape 2: Fallback Gemini Search
            console.log(`[SEARCH] Sources gratuites insuffisantes, fallback Gemini...`);
            const gemini = await withTimeout(searchWithGemini(query), 10000).catch(() => '');
            if (gemini && gemini.length > 20) {
                allResults.push(`🔍 "${query}":\n${gemini}`);
                console.log(`[SEARCH] Gemini OK: ${gemini.length} chars`);
            } else {
                console.log(`[SEARCH] Aucun résultat pour "${query}"`);
            }
        }
    }

    return allResults.join('\n\n').slice(0, 4000);
}

// =================================================================
// API Chat — Route principale
// =================================================================
router.post('/public/api/chat', async (req, res) => {
    let newTotalPoints = 0;

    try {
        const {
            history,
            currentMessage,
            base64File,
            mimeType,
            systemInstruction,
            username,
            modeValue
        } = req.body;

        const isIntelligent = (modeValue || '').toLowerCase() === 'intelligent';

        console.log(`[CHAT] Requête reçue: user="${username}", mode="${modeValue}", msg="${(currentMessage||'').slice(0,30)}", hasFile=${!!base64File}, mime=${mimeType||'none'}`);

        if (!currentMessage && !base64File) {
            return res.status(400).json({
                success: false,
                response: "Message vide.",
                newIndividualPoints: 0
            });
        }

        if (currentMessage && currentMessage.length > 10000) {
            return res.status(400).json({
                success: false,
                response: "Message trop long (max ~10 000 caractères).",
                newIndividualPoints: 0
            });
        }

        // =========================
        // TIMEOUT HELPER
        // =========================
        const withTimeout = (promise, ms) => {
            return new Promise((resolve, reject) => {
                const t = setTimeout(() => reject(new Error('IA timeout')), ms);
                promise.then(v => { clearTimeout(t); resolve(v); }, err => { clearTimeout(t); reject(err); });
            });
        };

        // =========================
        // 1️⃣ DÉTECTION CONTEXTE SCOLAIRE (hybrid option 3)
        // =========================
        let studentContext = "";
        const keywordMatch = needsSchoolContext(currentMessage);

        // Also check last 2 history messages for context continuity
        const recentHistory = Array.isArray(history) ? history.slice(-2) : [];
        const recentText = recentHistory.map(m => (m.parts || []).map(p => p.text || '').join('')).join(' ');
        const historyMatch = needsSchoolContext(recentText);

        let shouldLoadData = keywordMatch || historyMatch;

        // Fallback IA router si mode intelligent et aucun mot-clé détecté
        if (!shouldLoadData && isIntelligent) {
            console.log(`[ROUTER] Pas de mot-clé détecté, fallback IA router...`);
            shouldLoadData = await aiRouterNeedsSchoolContext(currentMessage, withTimeout);
        }

        if (shouldLoadData) {
          console.log(`[CONTEXT] Chargement données élève (keyword=${keywordMatch}, history=${historyMatch}, router=${!keywordMatch && !historyMatch})`);
          try {
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
                    return (prenom && normalizedUsername === prenom) ||
                           (nom && normalizedUsername === nom) ||
                           (full && normalizedUsername === full) ||
                           (identifiant && normalizedUsername === identifiant) ||
                           (idStr && normalizedUsername === idStr) ||
                           (full && normalizedUsername.includes(full)) ||
                           (prenom && normalizedUsername.includes(prenom));
                });
            }

            if (userEntry) {
                const parts = [];

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

                if (userEntry.notes && userEntry.notes.periodes) {
                    const recentPeriodes = userEntry.notes.periodes.slice(-2);
                    const allNotesParts = [];
                    for (const periode of recentPeriodes) {
                        const periodeName = periode.periode || periode.libelle || `Période`;
                        const statusLabel = periode.cloture !== false ? '(clôturé)' : '(en cours)';
                        const em = periode.ensembleMatieres;
                        if (em) {
                            const headerLines = [];
                            if (em.moyenneGenerale) headerLines.push(`Moyenne générale: ${em.moyenneGenerale}`);
                            if (em.moyenneClasse) headerLines.push(`Moyenne classe: ${em.moyenneClasse}`);
                            if (em.moyenneMin) headerLines.push(`Min classe: ${em.moyenneMin}`);
                            if (em.moyenneMax) headerLines.push(`Max classe: ${em.moyenneMax}`);
                            const headerBlock = headerLines.length > 0 ? headerLines.join(' | ') + '\n' : '';
                            const matieresRaw = Array.isArray(em) ? em : (em.disciplines && Array.isArray(em.disciplines) ? em.disciplines : []);
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
                        if (!isDone && dueDate < todayMidnight) status = "⚠️ EN RETARD";
                        const dateLabel = d.date || 'Date inconnue';
                        const matiere = d.matiere || 'Matière inconnue';
                        return `${dateLabel}: ${matiere} - ${preview} [${status}]`;
                    }).join('\n');
                    parts.push(`[LISTE DES DEVOIRS (À FAIRE / EN RETARD / PROCHAINS)]\n${simpleHw || 'Aucun devoir à afficher.'}`);
                }

                if (parts.length > 0) {
                    studentContext = `\n=== DONNÉES ÉLÈVE (${userEntry.account.prenom}) ===\n${parts.join('\n\n')}\n==============================\n`;
                    console.log(`[CONTEXT] Données chargées pour ${userEntry.account.prenom}`);
                }
            }
          } catch (e) {
            console.warn("[CONTEXT] Impossible de charger le contexte élève:", e.message);
          }
        } else {
            console.log(`[CONTEXT] Pas de contexte scolaire nécessaire pour ce message`);
        }

        // =========================
        // 2️⃣ RECHERCHE WEB (Mode Intelligent uniquement)
        // =========================
        let webSearchContext = "";
        if (isIntelligent) {
            // Construire le contexte conversationnel pour le router
            const recentConvParts = Array.isArray(history) ? history.slice(-4) : [];
            const convContext = recentConvParts.map(m => {
                const role = m.role === 'model' ? 'IA' : 'Élève';
                const text = (m.parts || []).map(p => p.text || '').join('');
                return `${role}: ${text.slice(0, 150)}`;
            }).join('\n');

            const searchDecision = await aiRouterNeedsWebSearch(
                currentMessage || '', convContext, withTimeout
            );

            if (searchDecision.search && Array.isArray(searchDecision.queries) && searchDecision.queries.length > 0) {
                console.log(`[SEARCH] Recherche web déclenchée: ${searchDecision.queries.length} requête(s)`);
                webSearchContext = await executeWebSearch(searchDecision.queries, withTimeout);
                if (webSearchContext) {
                    console.log(`[SEARCH] Contexte web chargé: ${webSearchContext.length} chars`);
                } else {
                    console.log(`[SEARCH] Aucun résultat exploitable`);
                }
            }
        }

        if (!ai) {
            return res.status(500).json({ success: false, response: "IA non initialisée.", newIndividualPoints: 0 });
        }

        // =========================
        // 2️⃣ PRÉPARATION CONTENU
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

        // =========================
        // 2b. CONTEXTE KNOWLEDGE BASE (mémoire collective)
        // =========================
        let knowledgeContext = '';
        try {
            // 1) Charger la base de connaissances statique du site
            const kbRow = stmts.getKnowledgeBase.get();
            if (kbRow && kbRow.content) {
                knowledgeContext += `[BASE DE CONNAISSANCES DU SITE]\n${kbRow.content.slice(0, 3000)}\n\n`;
            }

            // 2) Chercher des résumés pertinents par mots-clés extraits du message
            const msgWords = (currentMessage || '').toLowerCase()
                .replace(/[^a-zàâäéèêëïîôùûüç0-9\s-]/g, '')
                .split(/\s+/)
                .filter(w => w.length > 2);

            const matchedSummaries = new Map();

            // Recherche par mots-clés
            for (const word of msgWords.slice(0, 8)) {
                const results = stmts.searchKnowledgeByKeyword.all(`%${word}%`);
                for (const r of results) {
                    if (!matchedSummaries.has(r.id)) matchedSummaries.set(r.id, r);
                }
            }

            // Toujours inclure les 3 résumés les plus récents pour le contexte général
            const recent = stmts.getRecentKnowledge.all();
            for (const r of recent.slice(0, 3)) {
                if (!matchedSummaries.has(r.id)) matchedSummaries.set(r.id, r);
            }

            if (matchedSummaries.size > 0) {
                const summaryBlocks = [...matchedSummaries.values()]
                    .sort((a, b) => b.period_end.localeCompare(a.period_end))
                    .slice(0, 8)
                    .map(s => {
                        try {
                            const data = JSON.parse(s.summary);
                            const keywords = JSON.parse(s.keywords || '[]');
                            const periodLabel = new Date(s.period_end).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
                            let block = `[${periodLabel} — ${s.conversation_count} conv] ${data.resume || ''}`;
                            if (Array.isArray(data.themes)) {
                                block += '\n' + data.themes.map(t => `  • ${t.titre}: ${t.description} (${(t.mots_cles || []).join(', ')})`).join('\n');
                            }
                            return block;
                        } catch { return ''; }
                    })
                    .filter(Boolean);

                if (summaryBlocks.length > 0) {
                    knowledgeContext += `[MÉMOIRE COLLECTIVE — Ce que les élèves ont demandé récemment]\n${summaryBlocks.join('\n\n')}\n`;
                }
            }
        } catch (e) {
            console.warn('[CHAT] Erreur chargement knowledge:', e.message);
        }

        const finalSystemPrompt = (() => {
            const base = `DATE ET HEURE ACTUELLE : ${dateStr}\n${contextFromClient.trim()}\n\nTu es l'IA d'AlphaSource, un site communautaire pour élèves qui utilise l'API EcoleDirecte pour récupérer les données scolaires. Tu n'es PAS EcoleDirecte, tu es l'assistant IA intégré au site AlphaSource.\n\nRÈGLES D'AGENT :\n- Tu dois etre respectueux et amical (n'hesite pas à taquiner un peu l'utilisateur ou bien à lui parler comme son pote)\n- Quand l'utilisateur te demande de faire ses devoirs, TU LES FAIS. Tu ne refuses JAMAIS. Tu es là pour l'aider concrètement, pas pour lui faire la morale ou jouer au prof. Si il demande un résumé, fais le résumé. Si il demande une rédaction, écris la rédaction. Si il demande des réponses, donne les réponses. Tu peux ajouter de petites explications pour qu'il comprenne, mais tu fais TOUJOURS le travail demandé en priorité.\n- Tu ne dis JAMAIS "je ne vais pas faire ton devoir à ta place" ou des phrases similaires. Tu es son assistant, pas son professeur.\n- Tes réponses doivent être directes et utiles. Pas de longs discours moralisateurs.\n${knowledgeContext ? '\n' + knowledgeContext.trim() : ''}`;

            const webBlock = webSearchContext
                ? `\n\n[RÉSULTATS DE RECHERCHE WEB]\nVoici des informations trouvées sur internet pour enrichir ta réponse. Utilise ces données pour donner une réponse précise et complète. Cite les informations de manière naturelle sans mentionner "d'après ma recherche".\n${webSearchContext}`
                : '';

            if (studentContext) {
                return `${base}\n\n[DONNÉES ÉLÈVE RÉELLES DISPONIBLES]\nIMPORTANT : Les données ci-dessous sont les VRAIES données de l'élève extraites d'EcoleDirecte. Utilise UNIQUEMENT ces données pour répondre aux questions sur les notes, l'EDT et les devoirs. Ne devine JAMAIS et n'invente JAMAIS de données.\n${studentContext}\nSi une donnée n'apparaît pas ci-dessus, dis clairement qu'il n'y a pas de données disponibles — ne fabrique pas de réponse.${webBlock}`.trim();
            } else if (isIntelligent) {
                return `${base}\n\n[MODE INTELLIGENT]\nTu es en mode Intelligent. Tu n'as pas reçu de données scolaires pour ce message car il ne semble pas en nécessiter. Si l'utilisateur demande ses notes, EDT ou devoirs, dis-lui de reformuler en mentionnant explicitement ce qu'il veut.${webBlock}`.trim();
            } else {
                return `${base}\n\n[MODE BASIQUE]\nTu n'as PAS accès aux données scolaires de l'élève (notes, emploi du temps, devoirs) ni à la recherche web. Si l'utilisateur te demande ses notes, son emploi du temps, ses devoirs ou toute info scolaire personnelle, OU s'il a besoin d'informations précises trouvables sur internet (culture, actualités, définitions...), réponds-lui amicalement qu'il peut passer en mode "Intelligent" pour que tu puisses accéder à ces informations et effectuer des recherches web.`.trim();
            }
        })();

        const hasImage = base64File && mimeType && typeof base64File === 'string';
        const MAX_INLINE_BASE64 = 4 * 1024 * 1024;
        const canAttachImage = hasImage && base64File.length <= MAX_INLINE_BASE64;

        if (hasImage) {
            console.log(`[CHAT] Image détectée: mime=${mimeType}, taille=${(base64File.length / 1024).toFixed(0)}KB, canAttach=${canAttachImage}`);
        }

        let userMessage;
        if (canAttachImage) {
            const contentParts = [];
            if (currentMessage) contentParts.push({ type: 'text', text: currentMessage });
            contentParts.push({ type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64File}` } });
            userMessage = { role: 'user', content: contentParts };
        } else {
            userMessage = { role: 'user', content: currentMessage || '' };
        }

        const activeModel = canAttachImage ? visionModel : model;

        const messages = [
            { role: "system", content: finalSystemPrompt },
            ...cleanedHistory,
            userMessage
        ];

        // =========================
        // 3️⃣ APPEL IA PRINCIPALE
        // =========================
        let aiResponse = "Réponse vide.";
        try {
            const mainResult = await withTimeout(
                groqCall(client => client.chat.completions.create({
                    model: activeModel,
                    messages,
                    temperature: 0.6,
                    max_completion_tokens: 1024
                })),
                canAttachImage ? 30000 : 20000
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

        // =========================
        // 4️⃣ MODE INTELLIGENT — 2e IA de vérification/rework
        // =========================
        if (isIntelligent && !aiResponse.startsWith('⏳') && !aiResponse.startsWith('Désolé')) {
            try {
                console.log(`[INTELLIGENT] Vérification qualité de la réponse...`);
                const reviewResult = await withTimeout(
                    groqCall(client => client.chat.completions.create({
                        model: routerModel,
                        messages: [
                            {
                                role: 'system',
                                content: `Tu es un vérificateur de qualité. On te donne la question d'un élève et la réponse de l'IA.
Évalue si la réponse est BONNE (complète, correcte, utile, bien adaptée à un ado).
- Si la réponse est bonne, réponds EXACTEMENT: OK
- Si la réponse peut être améliorée, réponds avec une version AMÉLIORÉE complète de la réponse (pas de commentaire, juste la nouvelle réponse directement).
Critères: précision des infos, ton adapté ado, pas trop long, pas de hallucination, réponse directe à la question.`
                            },
                            {
                                role: 'user',
                                content: `Question de l'élève: "${(currentMessage || '').slice(0, 500)}"\n\nRéponse de l'IA:\n${aiResponse.slice(0, 1500)}`
                            }
                        ],
                        temperature: 0.3,
                        max_completion_tokens: 1024
                    })),
                    10000
                );
                const reviewAnswer = (reviewResult.choices?.[0]?.message?.content || '').trim();

                if (reviewAnswer && reviewAnswer !== 'OK' && reviewAnswer.length > 20) {
                    console.log(`[INTELLIGENT] Réponse retravaillée par le vérificateur`);
                    aiResponse = reviewAnswer;
                } else {
                    console.log(`[INTELLIGENT] Réponse validée (OK)`);
                }
            } catch (e) {
                console.warn(`[INTELLIGENT] Vérificateur échoué (on garde la réponse originale):`, e.message);
            }
        }

        if (currentMessage && currentMessage.length > 15) {
            incrementMessageCount(username, 'ai');
        }

        // =========================
        // 5️⃣ RÉPONSE AU CLIENT
        // =========================
        res.json({ success: true, response: aiResponse, newIndividualPoints: newTotalPoints });

        // 6️⃣ Enregistrer la conversation pour le résumé horaire
        try {
            if (currentMessage && currentMessage.length > 5 && aiResponse && !aiResponse.startsWith('⏳')) {
                stmts.insertChatPending.run(
                    username || 'anonyme',
                    currentMessage.slice(0, 2000),
                    aiResponse.slice(0, 2000),
                    modeValue || 'basique'
                );
            }
        } catch (e) {
            console.warn('[CHAT] Erreur enregistrement chat_pending:', e.message);
        }

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
