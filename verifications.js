// verifications.js - Vérifications périodiques pour le système de points
const fs = require('fs');
const path = require('path');
const { checkAndApplyMessageRewards, checkAndApplyRankingRewards, checkInactiveUsers, checkFillActivity } = require('./js/points.js');
// const { log, logToFile } = require('./logger.js');

// Chemins des fichiers
const USERS_PATH = path.join(__dirname, 'public', 'api', 'users.json');

// Fonction principale de vérifications
function startVerifications() {
    console.log("[VERIFICATIONS] Démarrage du service de vérifications de points...");

    // Vérifications immédiates au démarrage
    performVerifications();

    // Vérifications toutes les 5 secondes
    setInterval(() => {
        console.log("[VERIFICATIONS] Vérifications périodiques en cours...");
        performVerifications();
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
    } catch (e) {
        console.error("[VERIFICATIONS] Erreur lors des vérifications :", e);
    }
}

// Démarrer les vérifications
startVerifications();