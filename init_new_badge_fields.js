// Script pour initialiser les nouveaux champs des badges
const fs = require('fs');
const path = require('path');

const USERS_PATH = path.join(__dirname, 'public', 'api', 'users.json');

function initNewBadgeFields() {
    try {
        const rawData = fs.readFileSync(USERS_PATH, 'utf8');
        const users = JSON.parse(rawData);
        
        let updated = false;
        
        users.forEach(user => {
            // messages_ai_count
            if (typeof user.messages_ai_count !== 'number') {
                user.messages_ai_count = 0;
                updated = true;
            }
            
            // avg_pm_response_time
            if (typeof user.avg_pm_response_time !== 'number') {
                user.avg_pm_response_time = 0;
                updated = true;
            }
            
            // validated_rescues
            if (typeof user.validated_rescues !== 'number') {
                user.validated_rescues = 0;
                updated = true;
            }
            
            // connection_hours
            if (!Array.isArray(user.connection_hours)) {
                user.connection_hours = [];
                updated = true;
            }
            
            // pm_messages_count
            if (typeof user.pm_messages_count !== 'number') {
                user.pm_messages_count = 0;
                updated = true;
            }
            
            // pm_response_count (interne pour calcul moyenne)
            if (typeof user.pm_response_count !== 'number') {
                user.pm_response_count = 0;
                updated = true;
            }
        });
        
        if (updated) {
            fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2), 'utf8');
            console.log('✅ Tous les utilisateurs ont été initialisés avec les nouveaux champs!');
            console.log(`Champs initialisés:`);
            console.log('  - messages_ai_count (écolo)');
            console.log('  - avg_pm_response_time (lent)');
            console.log('  - validated_rescues (sauveur)');
            console.log('  - connection_hours (lève tôt/nocturne)');
            console.log('  - pm_messages_count (ami)');
        } else {
            console.log('ℹ️  Les champs sont déjà initialisés.');
        }
    } catch (e) {
        console.error('❌ Erreur:', e);
    }
}

initNewBadgeFields();
