/**
 * Script de débogage pour le login
 */

const https = require('https');

const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36';

let gtkCookie = null;

async function step1_getGTK() {
  return new Promise((resolve) => {
    console.log('📌 ÉTAPE 1: Récupération du GTK\n');

    const options = {
      hostname: 'api.ecoledirecte.com',
      path: '/v3/login.awp?gtk=1&v=4.75.0',
      method: 'GET',
      headers: {
        'User-Agent': userAgent,
      },
      rejectUnauthorized: false
    };

    const req = https.request(options, (res) => {
      console.log(`Status: ${res.statusCode}`);
      
      if (res.headers['set-cookie']) {
        res.headers['set-cookie'].forEach(cookie => {
          const parts = cookie.split(';')[0].split('=');
          if (parts[0].trim() === 'GTK') {
            gtkCookie = parts[1].trim();
            console.log(`✅ GTK trouvé (${gtkCookie.length} caractères)`);
          }
        });
      }

      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve());
    });

    req.on('error', (e) => {
      console.error('❌ Erreur:', e.message);
      resolve();
    });

    req.end();
  });
}

async function step2_login(gtkToken) {
  return new Promise((resolve) => {
    console.log('\n📌 ÉTAPE 2: Tentative de login\n');

    const body = {
      identifiant: 'even.henri',
      motdepasse: 'Superpitchu_8',
      isRelogin: false,
      uuid: ""
    };

    const bodyString = JSON.stringify(body);
    console.log('Body JSON:', bodyString);
    console.log('Longueur body:', bodyString.length);
    console.log('Headers à envoyer:');
    
    const headers = {
      'User-Agent': userAgent,
      'Content-Type': 'application/json',
      'X-Gtk': gtkToken,
      'Cookie': `GTK=${gtkToken}`
    };

    console.log(JSON.stringify(headers, null, 2));

    const options = {
      hostname: 'api.ecoledirecte.com',
      path: '/v3/login.awp?v=4.75.0',
      method: 'POST',
      headers: headers,
      rejectUnauthorized: false
    };

    const req = https.request(options, (res) => {
      console.log(`\nStatus: ${res.statusCode}`);
      console.log('Response Headers:', res.headers);

      let data = '';
      res.on('data', (chunk) => data += chunk);
      
      res.on('end', () => {
        console.log('\n📥 Réponse:');
        console.log('---START---');
        console.log(data);
        console.log('---END---');
        
        if (data) {
          try {
            const json = JSON.parse(data);
            console.log('\n✅ JSON valide:');
            console.log(JSON.stringify(json, null, 2));
          } catch (e) {
            console.log('\n❌ Pas du JSON valide:', e.message);
          }
        }
        resolve();
      });
    });

    req.on('error', (e) => {
      console.error('❌ Erreur:', e.message);
      resolve();
    });

    req.write(bodyString);
    req.end();
  });
}

async function main() {
  await step1_getGTK();
  if (gtkCookie) {
    await step2_login(gtkCookie);
  } else {
    console.log('❌ GTK non trouvé!');
  }
}

main();
