window.loadInfoData = async function() {
    // currentUsername est la variable GLOBALE de script.js.
    const username = window.currentUsername || localStorage.getItem('source_username'); 
    
    if (!username) { 
        document.getElementById('individual-points').textContent = 'N/A';
        console.error("PUTAIN LOG : Utilisateur non défini.");
        return;
    }
    
    try {
        const API_URL = `/public/api/points/${username}`; 
        
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