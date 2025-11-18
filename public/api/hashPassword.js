// hashPassword.js

const bcrypt = require('bcryptjs');

const passwordEnClair = "test"; // 🚨 Change ça ! Ex: "sigma123"
const saltRounds = 10; // Niveau de complexité (10 est standard pour bcrypt)

console.log("PUTAIN, Hachage en cours...");

bcrypt.hash(passwordEnClair, saltRounds, (err, hash) => {
    if (err) {
        console.error("ERREUR DE HACHAGE :", err);
        return;
    }
    
    console.log("--- BORDEL, COPIE ÇA DANS db/users.json ! ---");
    console.log(`Hash pour '${passwordEnClair}' :`);
    console.log(hash);
    console.log("----------------------------------------------");
});