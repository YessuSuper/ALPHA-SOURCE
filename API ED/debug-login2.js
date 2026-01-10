/**
 * Script de débogage pour voir la réponse complète du login
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
      if (res.headers['set-cookie']) {
        res.headers['set-cookie'].forEach(cookie => {
          const parts = cookie.split(';')[0].split('=');
          if (parts[0].trim() === 'GTK') {
            gtkCookie = parts[1].trim();
            console.log(`✅ GTK trouvé`);
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
    console.log('\n📌 ÉTAPE 2: Tentative de login avec FORM-URLENCODED\n');

    const params = new URLSearchParams();
    params.append('identifiant', 'even.henri');
    params.append('motdepasse', 'Superpitchu_8');
    params.append('isRelogin', 'false');
    params.append('uuid', '');

    const bodyString = params.toString();
    console.log('Body form-urlencoded:', bodyString);
    console.log('Longueur:', bodyString.length);

    const options = {
      hostname: 'api.ecoledirecte.com',
      path: '/v3/login.awp?v=4.75.0',
      method: 'POST',
      headers: {
        'User-Agent': userAgent,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Gtk': gtkToken,
        'Cookie': `GTK=${gtkToken}`,
        'Content-Length': Buffer.byteLength(bodyString)
      },
      rejectUnauthorized: false
    };

    const req = https.request(options, (res) => {
      console.log(`\nStatus: ${res.statusCode}`);
      console.log('X-Code:', res.headers['x-code']);

      let data = '';
      res.on('data', (chunk) => data += chunk);
      
      res.on('end', () => {
        console.log('\n📥 Réponse brute:');
        console.log('---START---');
        console.log(data);
        console.log('---END---\n');
        
        if (data) {
          try {
            const json = JSON.parse(data);
            console.log('✅ JSON parsé:');
            console.log(JSON.stringify(json, null, 2));
          } catch (e) {
            console.log('❌ Erreur JSON:', e.message);
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
