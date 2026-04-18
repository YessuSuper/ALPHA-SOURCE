window.loadInfoData = async function() {
    // currentUsername est la variable GLOBALE de script.js.
    const username = window.currentUsername || localStorage.getItem('source_username'); 
    
    if (!username) { 
        document.getElementById('individual-points').textContent = 'N/A';
        console.error("[LOG] : Utilisateur non défini.");
        return;
    }
    
    try {
        const API_URL = `/api/all.json`; // 🔥 MODIFIÉ : Lecture directe depuis all.json
        
        console.log(`[LOG] (TEST API) : Je tente de charger les points depuis l'API : ${API_URL}`);
        
        const response = await fetch(API_URL); 
        
        // 1. VÉRIFICATION DU STATUT DE LA REQUÊTE
        if (!response.ok) {
            console.error(`[ALERTE] RÉSEAU : Échec du chargement des points. Statut: ${response.status}.`);
            document.getElementById('individual-points').textContent = 'ERR_STAT';
            document.getElementById('collective-points').textContent = 'ERR_STAT';
            return;
        }

        // --- LECTURE DES DONNÉES DU SERVEUR (qui est l'objet complet all.json) ---
        const data = await response.json();

        // --- NOUVELLE LOGIQUE DE LECTURE ---
        
        // 2. Afficher les points collectifs (lus depuis collective_data)
        // On sécurise l'accès à la clé, au cas où.
        const collectivePoints = data.collective_data?.collective_points_pc ?? 0;
        document.getElementById('collective-points').textContent = collectivePoints;
        console.log(`[LOG] (COLLECTIF) : Total collectif chargé : ${collectivePoints}`);
        
        // 3. Afficher les points individuels (on doit chercher l'utilisateur dans user_ranking)
        const userRanking = Array.isArray(data.user_ranking) ? data.user_ranking : [];
        const currentUser = userRanking.find(u => u.username === username);
        
        // Si l'utilisateur est trouvé, on prend ses points, sinon 0
        const individualPoints = currentUser?.points ?? 0;
        
        document.getElementById('individual-points').textContent = individualPoints;
        console.log(`[LOG] (POINTS) : Points individuels chargés pour ${username} : ${individualPoints}`);

    } catch (error) {
        console.error("[LOG] : Erreur fatale lors du chargement des données SQL:", error);
        document.getElementById('individual-points').textContent = 'ERR_NET';
        document.getElementById('collective-points').textContent = 'ERR_NET';
    }
};


/**
 * Fonction vulgaire pour mettre à jour l'affichage après un POST (message envoyé).
 * Le code client DOIT appeler cette fonction après avoir reçu la réponse du serveur.
 * @param {number} newIndividualPoints - Le nouveau total de points renvoyé par le serveur.
 */
window.updatePointsDisplay = async function(newIndividualPoints) {
    const individualPointsElement = document.getElementById('individual-points');
    if (individualPointsElement && newIndividualPoints !== undefined) {
        individualPointsElement.textContent = newIndividualPoints;
    }

    // Notif points (toast discret)
    if (typeof newIndividualPoints === 'number' && typeof window.__recordPointsTotal === 'function') {
        try { window.__recordPointsTotal(newIndividualPoints, 'points'); } catch {}
    }
    
    // Pour les points collectifs, on préfère relancer loadInfoData pour rafraîchir le total
    console.log("[LOG] (RAFRAÎCHISSEMENT COLLECTIF) : Relance du loadInfoData pour l'affichage collectif.");
    await window.loadInfoData();
};


// ⭐⭐⭐ NOUVELLE FONCTION DEMANDÉE PAR LE SIGMA ⭐⭐⭐
/**
 * Reçoit la notification de 'communaute.js' et appelle la fonction d'affichage.
 * NOTE : La logique d'ajout de point est toujours faite par le serveur POST /api/community/post.
 * @param {number} newIndividualPoints - Le nouveau total de points renvoyé par le serveur.
 */
window.handlePointUpdate = function(newIndividualPoints) {
    // Ici, on pourrait ajouter une logique de vérification supplémentaire si on voulait.
    // Mais pour l'instant, on se contente de passer l'ordre d'affichage.
    console.log("[LOG] (INFO.JS) : Commande reçue de communaute.js. Mise à jour des points...");
    window.updatePointsDisplay(newIndividualPoints);
};


// =================================================================
// 🔥 GRAPHIQUE D'ÉVOLUTION DES POINTS 🔥
// =================================================================

let pointsChart = null; // Variable globale pour stocker l'instance du graphique

/**
 * Charge et affiche le graphique d'évolution des points de l'utilisateur
 */
window.loadPointsChart = async function() {
    const username = window.currentUsername || localStorage.getItem('source_username');
    
    if (!username) {
        console.error("[LOG] (GRAPH) : Utilisateur non défini.");
        return;
    }
    
    try {
        // Charger les données utilisateur depuis users.json
        const response = await fetch('/api/users.json');
        if (!response.ok) {
            console.error("[LOG] (GRAPH) : Erreur lors du chargement de users.json");
            return;
        }
        
        const users = await response.json();
        const currentUser = users.find(u => u.username === username);
        
        if (!currentUser || !Array.isArray(currentUser.graph_pt) || currentUser.graph_pt.length === 0) {
            console.warn(`[LOG] (GRAPH) : Aucune donnée graph_pt pour ${username}`);
            // Afficher un message si pas de données
            const canvas = document.getElementById('points-chart');
            if (canvas) {
                const ctx = canvas.getContext('2d');
                ctx.font = '16px Arial';
                ctx.fillStyle = '#666';
                ctx.textAlign = 'center';
                ctx.fillText('Pas encore de données de progression...', canvas.width / 2, canvas.height / 2);
            }
            return;
        }
        
        // Préparer les données pour Chart.js
        const labels = currentUser.graph_pt.map(entry => {
            const date = new Date(entry.date);
            return `${date.getDate()}/${date.getMonth() + 1}`;
        });
        
        const data = currentUser.graph_pt.map(entry => entry.points);
        
        // Calcul d'une échelle adaptative pour l'axe Y
        const maxPoints = Math.max(...data);
        const paddedMax = Math.max(10, Math.ceil(maxPoints * 1.2));
        const yStep = Math.max(1, Math.ceil(paddedMax / 6));

        // Détruire l'ancien graphique s'il existe
        if (pointsChart) {
            pointsChart.destroy();
        }
        
        // Créer le graphique
        const ctx = document.getElementById('points-chart').getContext('2d');
        pointsChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Points',
                    data: data,
                    borderColor: 'rgb(75, 192, 192)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    tension: 0.3,
                    fill: true,
                    pointRadius: 5,
                    pointHoverRadius: 7
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: '#fff',
                            font: {
                                size: 14
                            }
                        }
                    },
                    title: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: '#fff',
                            stepSize: yStep
                        },
                        suggestedMax: paddedMax,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    },
                    x: {
                        ticks: {
                            color: '#fff'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    }
                }
            }
        });
        
        console.log(`[LOG] (GRAPH) : Graphique chargé avec ${currentUser.graph_pt.length} points de données`);
        
    } catch (error) {
        console.error("[LOG] (GRAPH) : Erreur lors du chargement du graphique:", error);
    }
};

// ==========================
// WIDGET CAMEMBERT POINTS
// ==========================
window.loadPointsPieChart = async function() {
    // Exemple de répartition (à remplacer par les vraies sources si dispo)
    // Tu peux remplacer ces valeurs par un fetch si tu as une API !
    const pieData = [
        { label: 'Devoirs', value: 40, color: '#4bc0c0' },
        { label: 'Participation', value: 25, color: '#ffcd56' },
        { label: 'Aide/entraide', value: 20, color: '#36a2eb' },
        { label: 'Bonus', value: 15, color: '#ff6384' }
    ];
    const canvas = document.getElementById('points-pie-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (window.pointsPieChart) window.pointsPieChart.destroy();
    window.pointsPieChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: pieData.map(d => d.label),
            datasets: [{
                data: pieData.map(d => d.value),
                backgroundColor: pieData.map(d => d.color),
                borderWidth: 1
            }]
        },
        options: {
            plugins: {
                legend: { display: false }
            }
        }
    });
    // Légende custom
    const legend = pieData.map(d => `<span style="display:inline-block;width:14px;height:14px;background:${d.color};border-radius:3px;margin-right:6px;vertical-align:middle;"></span>${d.label} (${d.value}%)`).join('<br>');
    document.getElementById('points-pie-legend').innerHTML = legend;
};

// ==========================
// WIDGET CLASSEMENT INFOS
// ==========================
window.initInfoWidgets = function() {
        // Debug uniquement dans la console
    // Classement (version infos, utilise une fonction dédiée pour éviter les conflits d'ID)
    function loadLeaderboardDataInfosRetry(retry = 0) {
        const leaderEl = document.getElementById('leader-username-infos');
        const leaderPointsEl = document.getElementById('leader-points-infos');
        const secondEl = document.getElementById('second-username-infos');
        const secondPointsEl = document.getElementById('second-points-infos');
        const thirdEl = document.getElementById('third-username-infos');
        const thirdPointsEl = document.getElementById('third-points-infos');
        const userRankEl = document.getElementById('user-rank-infos');
        const userScoreEl = document.getElementById('user-score-infos');
        // debugDiv supprimé (plus de debug visuel)
        const currentUsername = localStorage.getItem('source_username');
        // Si les éléments ne sont pas encore dans le DOM, retry jusqu'à 10 fois
        if (!leaderEl || !leaderPointsEl || !secondEl || !secondPointsEl || !thirdEl || !thirdPointsEl || !userRankEl || !userScoreEl) {
            if (retry < 10) {
                setTimeout(() => loadLeaderboardDataInfosRetry(retry + 1), 100);
            } else {
                // rien
            }
            return;
        }
        // ... logique normale ...
        (async () => {
            try {
                const API_URL = `/api/all.json`;
                const response = await fetch(API_URL);
                if (!response.ok) {
                    leaderEl.textContent = 'ERR_API';
                    [leaderPointsEl, secondEl, secondPointsEl, thirdEl, thirdPointsEl, userRankEl, userScoreEl].forEach(el => { if (el) el.textContent = 'N/A'; });
                    return;
                }
                const data = await response.json();
                let userRanking = data.user_ranking;
                if (!userRanking || userRanking.length === 0) {
                    [leaderEl, secondEl, thirdEl, userRankEl].forEach(el => { if (el) el.textContent = 'Aucun user'; });
                    return;
                }
                userRanking.sort((a, b) => b.points - a.points);
                const top1 = userRanking[0];
                leaderEl.textContent = top1.username || 'Inconnu';
                leaderPointsEl.textContent = `${top1.points || 0} pts`;
                const top2 = userRanking[1];
                if (secondEl && secondPointsEl) {
                    secondEl.textContent = top2 ? (top2.username || 'Inconnu') : 'N/A';
                    secondPointsEl.textContent = top2 ? (`${top2.points || 0} pts`) : '';
                }
                const top3 = userRanking[2];
                if (thirdEl && thirdPointsEl) {
                    thirdEl.textContent = top3 ? (top3.username || 'Inconnu') : 'N/A';
                    thirdPointsEl.textContent = top3 ? (`${top3.points || 0} pts`) : '';
                }
                if (currentUsername && userRankEl && userScoreEl) {
                    // Recherche insensible à la casse et aux accents
                    const normalize = s => (s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
                    const userIndex = userRanking.findIndex(user => normalize(user.username) === normalize(currentUsername));
                    if (userIndex !== -1) {
                        const userRank = userIndex + 1;
                        const userScore = userRanking[userIndex].points || 0;
                        userRankEl.textContent = `#${userRank}`;
                        userScoreEl.textContent = `${userScore} pts`;
                    } else {
                        userRankEl.textContent = 'Utilisateur non trouvé dans le classement';
                        userScoreEl.textContent = '';
                    }
                }
            } catch (error) {
                if (leaderEl) leaderEl.textContent = 'ERR_NET';
                [leaderPointsEl, secondEl, secondPointsEl, thirdEl, thirdPointsEl, userRankEl, userScoreEl].forEach(el => { if (el) el.textContent = 'ERR_NET'; });
                // rien
            }
        })();
    }
    // Recharge le classement à chaque affichage de la page (SPA friendly)
    if (window.matchMedia('(display-mode: standalone)').matches || document.visibilityState === 'visible') {
        loadLeaderboardDataInfosRetry();
    }
    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'visible') loadLeaderboardDataInfosRetry();
    });
    // Camembert retiré
};

// Lancement auto sur la page infos
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('info-layout')) {
        window.initInfoWidgets();
    }
});
// Si le DOM est déjà prêt (SPA ou rechargement partiel), force aussi l'init
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    if (document.getElementById('info-layout')) {
        window.initInfoWidgets();
    }
}

// Sécurité : force l'init des widgets infos seulement si la page info est affichée
try {
    if (typeof window.initInfoWidgets === 'function' && document.getElementById('info-layout')) {
        window.initInfoWidgets();
        console.log('[CLASSEMENT INFOS] Appel forcé window.initInfoWidgets à la fin du script');
    }
} catch (e) {
    console.error('[CLASSEMENT INFOS] Erreur lors de l\'appel forcé window.initInfoWidgets', e);
}