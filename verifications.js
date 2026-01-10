// verifications.js - Vérifications périodiques pour le système de points
const fs = require('fs');
const path = require('path');
const { checkAndApplyMessageRewards, checkAndApplyRankingRewards, checkInactiveUsers, checkFillActivity, recalculateBadges } = require('./js/points.js');
// const { log, logToFile } = require('./logger.js');

// Chemins des fichiers
const USERS_PATH = path.join(__dirname, 'public', 'api', 'users.json');

// Variable pour suivre le dernier enregistrement de graphique
let lastGraphUpdate = null;

// Fonction pour enregistrer les points du jour dans graph_pt
function recordDailyPoints() {
    try {
        const now = new Date();
        const today = now.toISOString().split('T')[0]; // Format: YYYY-MM-DD
        
        // Vérifier si on a déjà enregistré aujourd'hui
        if (lastGraphUpdate === today) {
            return; // Déjà fait aujourd'hui
        }
        
        console.log(`[GRAPH] Enregistrement des points du jour : ${today}`);
        
        // Lire users.json
        const rawData = fs.readFileSync(USERS_PATH, 'utf8') || '[]';
        const users = JSON.parse(rawData);
        let updated = false;
        
        users.forEach(user => {
            // Initialiser graph_pt si nécessaire
            if (!Array.isArray(user.graph_pt)) {
                user.graph_pt = [];
            }
            
            // Vérifier si on a déjà un enregistrement pour aujourd'hui
            const existingEntry = user.graph_pt.find(entry => entry.date === today);
            
            if (!existingEntry) {
                // Ajouter les points du jour
                user.graph_pt.push({
                    date: today,
                    points: user.pt || 0
                });
                updated = true;
                console.log(`[GRAPH] ${user.username}: ${user.pt || 0} points enregistrés`);
            }
        });
        
        // Sauvegarder si modifié
        if (updated) {
            fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2), 'utf8');
            lastGraphUpdate = today;
            console.log(`[GRAPH] Enregistrement terminé pour ${today}`);
        }
        
    } catch (e) {
        console.error("[GRAPH] Erreur lors de l'enregistrement des points du jour :", e);
    }
}

// Fonction principale de vérifications
function startVerifications() {
    console.log("[VERIFICATIONS] Démarrage du service de vérifications de points...");

    // Enregistrer les points immédiatement au démarrage
    recordDailyPoints();
    
    // Vérifications immédiates au démarrage
    performVerifications();

    // Vérifications toutes les 5 secondes
    setInterval(() => {
        console.log("[VERIFICATIONS] Vérifications périodiques en cours...");
        performVerifications();
        
        // Enregistrer les points du jour (sera ignoré si déjà fait aujourd'hui)
        recordDailyPoints();
    }, 5000); // 5 secondes

    // Garder le processus en vie
    process.on('SIGINT', () => {
        console.log("[VERIFICATIONS] Arrêt du service de vérifications...");
        process.exit(0);
    });
}

// Fonction qui effectue toutes les vérifications
function performVerifications() {
    try {
        checkAndApplyMessageRewards();
        checkAndApplyRankingRewards();
        checkInactiveUsers();
        checkFillActivity();
        recalculateBadges();
    } catch (e) {
        console.error("[VERIFICATIONS] Erreur lors des vérifications :", e);
    }
}

// Démarrer les vérifications
startVerifications();