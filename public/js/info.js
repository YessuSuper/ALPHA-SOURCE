window.loadInfoData = async function() {
    // currentUsername est la variable GLOBALE de script.js.
    const username = window.currentUsername || localStorage.getItem('source_username'); 
    
    if (!username) { 
        document.getElementById('individual-points').textContent = 'N/A';
        console.error("PUTAIN LOG : Utilisateur non défini.");
        return;
    }
    
    try {
        const API_URL = `/api/all.json`; // 🔥 MODIFIÉ : Lecture directe depuis all.json
        
        console.log(`PUTAIN LOG (TEST API) : Je tente de charger les points depuis l'API : ${API_URL}`);
        
        const response = await fetch(API_URL); 
        
        // 1. VÉRIFICATION DU STATUT DE LA REQUÊTE
        if (!response.ok) {
            console.error(`PUTAIN ALERTE RÉSEAU : Échec du chargement des points. Statut: ${response.status}.`);
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
        console.log(`PUTAIN LOG (COLLECTIF) : Total collectif chargé : ${collectivePoints}`);
        
        // 3. Afficher les points individuels (on doit chercher l'utilisateur dans user_ranking)
        const userRanking = Array.isArray(data.user_ranking) ? data.user_ranking : [];
        const currentUser = userRanking.find(u => u.username === username);
        
        // Si l'utilisateur est trouvé, on prend ses points, sinon 0
        const individualPoints = currentUser?.points ?? 0;
        
        document.getElementById('individual-points').textContent = individualPoints;
        console.log(`PUTAIN LOG (POINTS) : Points individuels chargés pour ${username} : ${individualPoints}`);

    } catch (error) {
        console.error("PUTAIN LOG : Erreur fatale lors du chargement des données SQL:", error);
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
    
    // Pour les points collectifs, on préfère relancer loadInfoData pour rafraîchir le total
    console.log("PUTAIN LOG (RAFRAÎCHISSEMENT COLLECTIF) : Relance du loadInfoData pour l'affichage collectif.");
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
    console.log("PUTAIN LOG (INFO.JS) : Commande reçue de communaute.js. Mise à jour des points...");
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
        console.error("PUTAIN LOG (GRAPH) : Utilisateur non défini.");
        return;
    }
    
    try {
        // Charger les données utilisateur depuis users.json
        const response = await fetch('/api/users.json');
        if (!response.ok) {
            console.error("PUTAIN LOG (GRAPH) : Erreur lors du chargement de users.json");
            return;
        }
        
        const users = await response.json();
        const currentUser = users.find(u => u.username === username);
        
        if (!currentUser || !Array.isArray(currentUser.graph_pt) || currentUser.graph_pt.length === 0) {
            console.warn(`PUTAIN LOG (GRAPH) : Aucune donnée graph_pt pour ${username}`);
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
        
        console.log(`PUTAIN LOG (GRAPH) : Graphique chargé avec ${currentUser.graph_pt.length} points de données`);
        
    } catch (error) {
        console.error("PUTAIN LOG (GRAPH) : Erreur lors du chargement du graphique:", error);
    }
};