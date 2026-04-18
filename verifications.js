// verifications.js - Vérifications périodiques pour le système de points
const fs = require('fs');
const path = require('path');
const { checkAndApplyMessageRewards, checkAndApplyRankingRewards, checkInactiveUsers, checkFillActivity, recalculateBadges } = require('./js/points.js');
const { log, logToFile } = require('./logger.js');
const { readUsers, writeUsers } = require('./routes/shared');

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
