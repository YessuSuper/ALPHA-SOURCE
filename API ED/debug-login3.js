/**
 * Script de débogage - essayer avec query string
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

async function step2_login_querystring(gtkToken) {
  return new Promise((resolve) => {
    console.log('\n📌 OPTION A: Query string dans l\'URL\n');

    const params = new URLSearchParams();
    params.append('identifiant', 'even.henri');
    params.append('motdepasse', 'Superpitchu_8');
    params.append('isRelogin', 'false');
    params.append('uuid', '');

    const path = `/v3/login.awp?v=4.75.0&${params.toString()}`;
    console.log('Chemin:', path);

    const options = {
      hostname: 'api.ecoledirecte.com',
      path: path,
      method: 'POST',
      headers: {
        'User-Agent': userAgent,
        'X-Gtk': gtkToken,
        'Cookie': `GTK=${gtkToken}`,
      },
      rejectUnauthorized: false
    };

    const req = https.request(options, (res) => {
      console.log(`Status: ${res.statusCode}, X-Code: ${res.headers['x-code']}`);

      let data = '';
      res.on('data', (chunk) => data += chunk);
      
      res.on('end', () => {
        console.log('Réponse:', data);
        if (data) {
          try {
            const json = JSON.parse(data);
            if (json.code === 200) {
              console.log('\n✅ SUCCÈS! Données reçues:');
              console.log('ID:', json.data.id);
              console.log('Nom:', json.data.prenom, json.data.nom);
            } else {
              console.log('\n❌ Erreur code:', json.code);
            }
          } catch (e) {
            console.log('Erreur:', e.message);
          }
        }
        resolve();
      });
    });

    req.on('error', (e) => {
      console.error('❌ Erreur:', e.message);
      resolve();
    });

    req.end();
  });
}

async function step3_login_json(gtkToken) {
  return new Promise((resolve) => {
    console.log('\n\n📌 OPTION B: JSON dans le body\n');

    const body = JSON.stringify({
      identifiant: 'even.henri',
      motdepasse: 'Superpitchu_8',
      isRelogin: false,
      uuid: ""
    });

    console.log('Body JSON:', body);

    const options = {
      hostname: 'api.ecoledirecte.com',
      path: '/v3/login.awp?v=4.75.0',
      method: 'POST',
      headers: {
        'User-Agent': userAgent,
        'Content-Type': 'application/json',
        'X-Gtk': gtkToken,
        'Cookie': `GTK=${gtkToken}`,
        'Content-Length': Buffer.byteLength(body)
      },
      rejectUnauthorized: false
    };

    const req = https.request(options, (res) => {
      console.log(`Status: ${res.statusCode}, X-Code: ${res.headers['x-code']}`);

      let data = '';
      res.on('data', (chunk) => data += chunk);
      
      res.on('end', () => {
        console.log('Réponse:', data);
        if (data) {
          try {
            const json = JSON.parse(data);
            if (json.code === 200) {
              console.log('\n✅ SUCCÈS! Données reçues:');
              console.log('ID:', json.data.id);
              console.log('Nom:', json.data.prenom, json.data.nom);
            } else {
              console.log('\n❌ Erreur code:', json.code);
            }
          } catch (e) {
            console.log('Erreur:', e.message);
          }
        }
        resolve();
      });
    });

    req.on('error', (e) => {
      console.error('❌ Erreur:', e.message);
      resolve();
    });

    req.write(body);
    req.end();
  });
}

async function main() {
  await step1_getGTK();
  if (gtkCookie) {
    await step2_login_querystring(gtkCookie);
    await step3_login_json(gtkCookie);
  } else {
    console.log('❌ GTK non trouvé!');
  }
}

main();
