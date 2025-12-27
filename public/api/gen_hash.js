const bcrypt = require('bcryptjs');
const passwordToHash = 'test';
const saltRounds = 10;

bcrypt.hash(passwordToHash, saltRounds, (err, hash) => {
    if (err) {
        console.error("Erreur hachage:", err);
    } else {
        console.log("\n🔑 NOUVEAU HASH POUR 'test' 🔑");
        console.log(hash);
        console.log("\nTEST DE COMPARAISON : DOIT ÊTRE TRUE");
        bcrypt.compare('test', hash, (e, res) => {
            console.log(res); 
        });
    }
});