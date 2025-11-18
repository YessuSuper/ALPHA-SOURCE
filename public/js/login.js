// public/js/login.js

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('error-message');
    
    // On masque les messages d'erreur précédents
    errorMessage.style.display = 'none';
    errorMessage.textContent = ''; 

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                // On s'assure que le serveur sait qu'on envoie du JSON
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            console.log("Connexion réussie, gros zinzin !");
            
            // 🚨 FIX : NOUVEAU IDENTIFIANT SOURCE 🚨
            if (data.user && data.user.username) {
                localStorage.setItem('source_username', data.user.username);
            }
            
            // Redirection vers la page principale du site
            window.location.href = data.redirect; 
        } else {
            // Statut 401 ou succès à false
            errorMessage.textContent = data.message || "Identifiants incorrects, espèce de gros zinzin.";
            errorMessage.style.display = 'block';
        }

    } catch (error) {
        // Erreur de réseau (serveur non lancé, etc.)
        errorMessage.textContent = "Erreur de réseau. Le serveur n'est peut-être pas lancé. BORDEL.";
        errorMessage.style.display = 'block';
        console.error("Erreur de connexion :", error);
    }
});