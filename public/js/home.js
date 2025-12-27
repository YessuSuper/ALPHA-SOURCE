// /js/home.js

/**
 * Fonction principale pour initialiser la page d'accueil (message d'accueil et classement).
 */
window.initHomePage = function() {
    // ... (Reste de la fonction initHomePage inchangé) ...
    const greetingEl = document.getElementById('home-greeting');
    if (!greetingEl) return; 

    const username = localStorage.getItem('source_username') || "Utilisateur";

    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();
    const minutes = now.getMinutes();
    let messages = [];
    const timeString = `${hour}h${minutes < 10 ? '0' : ''}${minutes}`;
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

    // --- LOGIQUE DU MESSAGE D'ACCUEIL ---
    // ... (Logique du message d'accueil inchangée) ...
    if (hour >= 5 && hour < 12) { // Matin (5h - 11h59)
        messages = [
            `Bonne matinée ${username}`,
            `Salut ${username}, c'est le matin`,
            `La forme ${username} ?`,
            `Hey ${username} ! Il est exactement ${timeString}. Bonne journée !`,
            `Le soleil est levé. Prêt à commencer, ${username} ?`,
            `Déjà sur le pont, ${username} ? Belle énergie !`,
            `C'est une belle ${isWeekend ? 'matinée de week-end' : 'matinée de travail'} ! Courage, ${username}.`,
            `Bonjour ${username}. Quel est le programme de ce ${dayOfWeek === 1 ? 'Lundi' : 'jour'} ?`,
            `Bien réveillé, ${username} ? Le monde t'attend.`,
            `Un excellent début de journée à toi, ${username}.`
        ];
    } else if (hour >= 12 && hour < 17) { // Après-midi (12h - 16h59)
        messages = [
            `Bon après-midi ${username}`,
            `Ravi de te revoir ${username}`,
            `Bonjour ${username}, quoi de neuf?`,
            `C'est la mi-journée ! Bientôt l'heure du thé ou du café, ${username}.`,
            `Il est ${timeString}. Comment se passe ton après-midi, ${username} ?`,
            `Plein de réussite pour cette deuxième partie de journée, ${username}.`,
            `J'espère que ta pause déjeuner a été bonne, ${username}.`,
            `${username}, on tient bon jusqu'au soir. Moins de ${17 - hour} heures avant de souffler !`,
            `Un bel après-midi de ${isWeekend ? 'détente' : 'concentration'} à toi, ${username}.`,
            `Salut ${username}. L'après-midi, c'est le moment d'accélérer !`
        ];
    } else if (hour >= 17 && hour < 23) { // Soir (17h - 22h59)
        messages = [
            `Bonsoir ${username}`,
            `Bonne soirée ${username}`,
            `Quelque chose de prévu ce soir ${username} ?`,
            `Il est déjà ${timeString} ! Le travail est fini pour aujourd'hui, ${username} ?`,
            `Le crépuscule arrive... Profite bien de ta soirée, ${username}.`,
            `C'est le moment de décompresser, ${username}. Bonne fin de journée.`,
            `Que ce ${dayOfWeek === 5 ? 'vendredi soir' : 'soir'} t'apporte le repos mérité, ${username}.`,
            `Bonne soirée, ${username}. J'espère que tout s'est bien passé.`,
            `Tu as mérité cette soirée de repos, ${username}.`,
            `Salut ${username}. Quel plaisir de te revoir à cette heure !`
        ];
    } else { // Nuit (23h - 4h59)
        messages = [
            `Bonne nuit ${username}`,
            `Tu ne dors pas ${username} ?`,
            `Salut ${username}, il est tard`,
            `Attention, il est ${timeString} ! L'heure de la concentration (ou du sommeil), ${username}.`,
            `Hé ${username}, même les lève-tôt sont couchés à cette heure !`,
            `Veille tardive, ${username} ? N'oublie pas de te reposer.`,
            `C'est la nuit, ${username}. Prends soin de toi.`,
            `Le monde dort, mais pas toi ${username} ?`,
            `Il est très tard, ${username}. Pense à mettre ton téléphone en mode NPD !`,
            `Bonne nuit à toi, ${username}. J'espère que tu travailles sur quelque chose de cool.`
        ];
    }

    // Affiche le message d'accueil
    const message = messages[Math.floor(Math.random() * messages.length)];
    greetingEl.textContent = message;

    // Lancement des widgets et du classement
    window.loadLeaderboardData(); 
    window.loadBackpackData(); 

    // 💥 NOUVEL AJOUT : Initialisation du bouton de déconnexion
    window.initLogoutButton(); 
};


// ⭐ FONCTION : Charge, trie et affiche le Top 3 et le rang de l'utilisateur actuel
window.loadLeaderboardData = async function() {
    // ... (Fonction loadLeaderboardData inchangée) ...
    // Éléments du TOP 1
    const leaderEl = document.getElementById('leader-username');
    const leaderPointsEl = document.getElementById('leader-points');

    // Nouveaux éléments du TOP 2 & 3
    const secondEl = document.getElementById('second-username');
    const secondPointsEl = document.getElementById('second-points');
    const thirdEl = document.getElementById('third-username');
    const thirdPointsEl = document.getElementById('third-points');

    // Nouveaux éléments du rang utilisateur
    const userRankEl = document.getElementById('user-rank');
    const userScoreEl = document.getElementById('user-score');
    
    // Utilisateur actuel (pour trouver son rang)
    const currentUsername = localStorage.getItem('source_username'); 

    if (!leaderEl || !leaderPointsEl) {
        console.error("PUTAIN LOG : Éléments du classement (TOP 1) introuvables. Vérifiez vos ID HTML.");
        return;
    }

    try {
        const API_URL = `/api/all.json`; 
        const response = await fetch(API_URL); 
        
        if (!response.ok) {
            leaderEl.textContent = 'ERR_API';
            [leaderPointsEl, secondEl, secondPointsEl, thirdEl, thirdPointsEl, userRankEl, userScoreEl].forEach(el => {
                if (el) el.textContent = 'N/A';
            });
            return;
        }

        const data = await response.json(); 
        let userRanking = data.user_ranking;

        if (!userRanking || userRanking.length === 0) {
            [leaderEl, secondEl, thirdEl, userRankEl].forEach(el => {
                if (el) el.textContent = 'Aucun user';
            });
            return;
        }

        // 1. Trier le tableau par 'points' en ordre décroissant
        userRanking.sort((a, b) => b.points - a.points);
        
        // --- 2. AFFICHAGE DU TOP 3 ---
        
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

        // --- 3. AFFICHAGE DU RANG DE L'UTILISATEUR ACTUEL ---
        
        if (currentUsername && userRankEl && userScoreEl) {
            const userIndex = userRanking.findIndex(user => user.username === currentUsername);

            if (userIndex !== -1) {
                const userRank = userIndex + 1;
                const userScore = userRanking[userIndex].points || 0;
                
                userRankEl.textContent = `#${userRank}`;
                userScoreEl.textContent = `${userScore} pts`;
            } else {
                userRankEl.textContent = 'N/A (Non trouvé)';
                userScoreEl.textContent = '';
            }
        }
        
    } catch (error) {
        console.error("PUTAIN LOG : Erreur fatale lors du traitement du classement:", error);
        leaderEl.textContent = 'ERR_NET';
        [leaderPointsEl, secondEl, secondPointsEl, thirdEl, thirdPointsEl, userRankEl, userScoreEl].forEach(el => {
            if (el) el.textContent = 'ERR_NET';
        });
    }
};

// ---

// ⭐ FONCTION : Charge l'emploi du temps pour Aujourd'hui et Demain
window.loadBackpackData = async function() {
    const backpackElToday = document.getElementById('backpack-today-subjects');
    const backpackElTomorrow = document.getElementById('backpack-tomorrow-subjects');
    const titleElToday = document.getElementById('backpack-title-today');
    const titleElTomorrow = document.getElementById('backpack-title-tomorrow');
    const backpackElTitle = document.getElementById('backpack-title');
    
    if (!backpackElToday || !backpackElTomorrow || !backpackElTitle || !titleElToday || !titleElTomorrow) {
        console.error("PUTAIN LOG : Éléments du Sac à Dos introuvables. Vérifiez vos ID HTML.");
        return;
    }

    try {
        const API_URL = `/api/all.json`;
        const response = await fetch(API_URL); 
        
        if (!response.ok) {
            [backpackElToday, backpackElTomorrow].forEach(el => el.textContent = 'Erreur API');
            return;
        }

        const data = await response.json(); 
        const schedule = data.weekly_schedule;
        const userRanking = data.user_ranking;
        const currentUsername = localStorage.getItem('source_username'); 

        // 1. Déterminer le jour d'aujourd'hui et de demain
        const now = new Date();
        const frenchDays = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
        let dayIndex = now.getDay(); // 0 (Dimanche) à 6 (Samedi)
        let tomorrowIndex = (dayIndex === 6) ? 1 : dayIndex + 1; // Demain (si samedi, c'est lundi)

        const daysMap = {
            1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 
            6: 'Saturday', 0: 'Sunday'
        };

        const todayName = daysMap[dayIndex];
        let tomorrowName = daysMap[tomorrowIndex];
        
        // CORRECTION DE L'EMPLOI DU TEMPS POUR LE WEEKEND : 
        if (dayIndex === 6 || dayIndex === 0 || dayIndex === 5) { // Si c'est Samedi, Dimanche ou Vendredi, le prochain jour d'école est Lundi
            tomorrowName = 'Monday';
            tomorrowIndex = 1;
        }


        // On affiche les noms des jours dans le titre 
        titleElToday.textContent = `Aujourd'hui (${frenchDays[dayIndex]})`;
        titleElTomorrow.textContent = `Prochain jour d'école (${frenchDays[tomorrowIndex]})`;
        backpackElTitle.textContent = '🎒 Sac à Dos'; 

        // 2. Identifier les options de l'utilisateur
        const currentUserData = userRanking.find(user => user.username === currentUsername);
        
        if (!currentUserData) {
            backpackElTitle.textContent = 'Utilisateur inconnu... 🤷‍♂️';
            return;
        }
        
        const hasLatin = currentUserData.latin;
        const hasGrec = currentUserData.grec;
        const hasEspagnol = currentUserData.espagnol; // true = Espagnol, false = Allemand

        // 3. Fonction pour filtrer et nettoyer l'emploi du temps 
        const filterSchedule = (dayKey, hasLatin, hasGrec, hasEspagnol) => {
            const dayArray = schedule[dayKey];
            if (!dayArray) return ['LIBRE / Aucun cours'];
            
            let finalSubjects = new Set();
            
            // Itérer sur les matières de la journée
            dayArray.forEach(subject => {
                if (subject.includes('REPAS') || subject.includes('LIBRE') || !subject) return;

                let isOptionCourse = false;
                let optionName = '';

                // --- 🚨 NOUVELLE LOGIQUE POUR LES OPTIONS 🚨 ---
                
                // GESTION Latin/Grec (qui partagent un créneau)
                if (subject.includes('Latin') || subject.includes('Grec')) {
                    isOptionCourse = true;
                    if (hasLatin) optionName = 'Latin';
                    else if (hasGrec) optionName = 'Grec';
                    // S'il n'a ni Latin ni Grec, on saute.
                    if (!optionName) return; 
                }

                // GESTION LV2 (Espagnol/Allemand - qui partagent un créneau)
                else if (subject.includes('Espagnol LV2') || subject.includes('Allemand')) {
                    isOptionCourse = true;
                    if (hasEspagnol && subject.includes('Espagnol LV2')) {
                        optionName = 'Espagnol';
                    } else if (!hasEspagnol && subject.includes('Espagnol LV2')) {
                        // Si le cours est Espagnol LV2 mais l'utilisateur a Allemand (hasEspagnol: false), on met Allemand
                        optionName = 'Allemand';
                    } else if (!hasEspagnol && subject.includes('Allemand')) {
                        optionName = 'Allemand';
                    } else if (hasEspagnol && subject.includes('Allemand')) {
                        // Si l'utilisateur a Espagnol (hasEspagnol: true) mais le cours est Allemand, on saute.
                        return;
                    } else {
                        // Cas par défaut ou erreur, on saute
                        return;
                    }
                }
                
                // Si c'est un cours à option et qu'on a trouvé l'option de l'utilisateur, on l'ajoute.
                if (isOptionCourse && optionName) {
                    finalSubjects.add(optionName);
                    return;
                }
                
                // --- FIN LOGIQUE OPTIONS ---

                // Simplification des noms pour les matières non-options
                let cleanSubject = subject;
                if (subject.includes('Histoire & Géographie')) cleanSubject = 'Histoire-Géo';
                if (subject.includes('Anglais LV1')) cleanSubject = 'Anglais';
                if (subject.includes('Éducation Musicale')) cleanSubject = 'Musique';
                if (subject.includes('Devoir Surveillé')) cleanSubject = 'DS';
                if (subject.includes('EPS')) cleanSubject = 'Sport';
                if (subject.includes('Technologie')) cleanSubject = 'Techno';
                if (subject.includes('SVT')) cleanSubject = 'SVT';
                if (subject.includes('Physique-Chimie')) cleanSubject = 'Physique-Chimie';
                if (subject.includes('Arts Plastiques')) cleanSubject = 'Arts Plastiques';
                if (subject.includes('Français')) cleanSubject = 'Français';
                if (subject.includes('Mathématiques')) cleanSubject = 'Maths';

                finalSubjects.add(cleanSubject.trim());
            });

            // GESTION FINALE : Pour Even (Latin: true, Grec: false)
            // LUNDI 16H-17H: Le créneau est "Grec". Comme Even a Latin (et pas Grec), on doit afficher Latin
            // MERCREDI 8H-10H: Le créneau est "Latin". Even l'a, on affiche Latin
            // VENDREDI 16H-17H: Le créneau est "Latin". Even l'a, on affiche Latin
            
            // 🚨 Re-parcourir pour injecter les options manquantes si elles sont en créneau partagé
            const allHours = schedule['hours'];
            const dayHours = schedule[dayKey];
            
            if (dayHours) {
                dayHours.forEach((subject, index) => {
                    const hour = allHours[index];
                    
                    // LUNDI (index 8: 16h-17h) : La matière est "Grec", mais Even doit avoir Latin
                    // C'est un peu "sale" mais ça gère la structure actuelle de ton JSON où une seule matière optionnelle est listée.
                    if (dayKey === 'Monday' && index === 8 && subject === 'Grec' && hasLatin) {
                        finalSubjects.add('Latin');
                    }
                });
            }


            const uniqueSubjects = Array.from(finalSubjects);
            
            // Gestion des jours sans cours (Weekend/Jours non renseignés)
            if (uniqueSubjects.length === 0) {
                 return [(dayKey === 'Saturday' || dayKey === 'Sunday' ? 'R.A.S. (Weekend)' : 'Inconnu / Rien')];
            }
            
            return uniqueSubjects;
        };

        // 4. Afficher le Sac à Dos (Aujourd'hui et Demain)
        
        // On passe les options de l'utilisateur à la fonction de filtrage
        const todaySubjects = filterSchedule(todayName, hasLatin, hasGrec, hasEspagnol);
        backpackElToday.innerHTML = todaySubjects.map(s => `<li>${s}</li>`).join('');

        const tomorrowSubjects = filterSchedule(tomorrowName, hasLatin, hasGrec, hasEspagnol);
        backpackElTomorrow.innerHTML = tomorrowSubjects.map(s => `<li>${s}</li>`).join('');
        
    } catch (error) {
        console.error("PUTAIN LOG : Erreur fatale lors du chargement du Sac à Dos:", error);
        [backpackElToday, backpackElTomorrow].forEach(el => el.textContent = 'ERR_NET');
    }
};

// ⭐ NOUVELLE FONCTION : Gestionnaire de l'action de déconnexion
window.initLogoutButton = function() {
    const logoutButton = document.getElementById('logout-button');
    
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            console.log("PUTAIN LOG : Bouton Déconnexion cliqué. Appel de 'logoutAndRedirect()'.");
            
            // On appelle ta fonction exactement comme elle est définie dans script.js
            if (window.logoutAndRedirect) {
                 window.logoutAndRedirect(); 
            } else {
                 console.error("PUTAIN LOG : La fonction 'logoutAndRedirect' est introuvable. Vérifiez que script.js est chargé AVANT home.js.");
            }
        });
    } else {
        console.error("PUTAIN LOG : Bouton de déconnexion introuvable (#logout-button).");
    }
};

// Lancement de l'initialisation quand le DOM est prêt
document.addEventListener('DOMContentLoaded', window.initHomePage);