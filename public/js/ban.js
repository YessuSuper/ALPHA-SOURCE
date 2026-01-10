// ban.js - Affiche les infos du ban

function updateBanInfo() {
    const banUntil = localStorage.getItem('ban_until');
    const banReason = localStorage.getItem('ban_reason');
    
    const durationElement = document.getElementById('ban-duration');
    const motifElement = document.getElementById('ban-motif');
    
    if (banUntil) {
        const now = Date.now();
        const banTime = parseInt(banUntil);
        const remaining = banTime - now;
        
        if (remaining > 0) {
            // Calculer la durée restante
            const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
            const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
            const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
            const seconds = Math.floor((remaining % (60 * 1000)) / 1000);
            
            let durationText = 'Tu as été suspendu pour ';
            
            if (days > 0) {
                durationText += `${days} jour${days > 1 ? 's' : ''}`;
                if (hours > 0) durationText += ` et ${hours}h`;
            } else if (hours > 0) {
                durationText += `${hours} heure${hours > 1 ? 's' : ''}`;
                if (minutes > 0) durationText += ` et ${minutes}min`;
            } else if (minutes > 0) {
                durationText += `${minutes} minute${minutes > 1 ? 's' : ''}`;
                if (seconds > 0) durationText += ` et ${seconds}s`;
            } else {
                durationText += `${seconds} seconde${seconds > 1 ? 's' : ''}`;
            }
            
            durationElement.textContent = durationText;
        } else {
            durationElement.textContent = 'Ton ban a expiré - tu peux te reconnecter';
        }
    } else {
        durationElement.textContent = 'Tu as été suspendu';
    }
    
    if (banReason) {
        motifElement.textContent = `Motif : ${banReason}`;
        motifElement.style.display = 'block';
    } else {
        motifElement.style.display = 'none';
    }
}

// Mettre à jour immédiatement
updateBanInfo();

// Mettre à jour chaque seconde pour le compte à rebours
setInterval(updateBanInfo, 1000);
