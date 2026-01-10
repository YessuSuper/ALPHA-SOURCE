/**
 * Script de débogage - essayer avec data encodé
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

async function step2_login_with_data_param(gtkToken) {
  return new Promise((resolve) => {
    console.log('\n📌 OPTION C: Paramètre "data" encodé\n');

    const jsonData = JSON.stringify({
      identifiant: 'even.henri',
      motdepasse: 'Superpitchu_8',
      isRelogin: false,
      uuid: ""
    });

    const encodedData = encodeURIComponent(jsonData);
    const bodyParams = `data=${encodedData}`;

    console.log('JSON:', jsonData);
    console.log('Body params:', bodyParams);

    const options = {
      hostname: 'api.ecoledirecte.com',
      path: '/v3/login.awp?v=4.75.0',
      method: 'POST',
      headers: {
        'User-Agent': userAgent,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Gtk': gtkToken,
        'Cookie': `GTK=${gtkToken}`,
        'Content-Length': Buffer.byteLength(bodyParams)
      },
      rejectUnauthorized: false
    };

    const req = https.request(options, (res) => {
      console.log(`Status: ${res.statusCode}, X-Code: ${res.headers['x-code']}`);

      let data = '';
      res.on('data', (chunk) => data += chunk);
      
      res.on('end', () => {
        console.log('Réponse:', data.substring(0, 200));
        if (data) {
          try {
            const json = JSON.parse(data);
            if (json.code === 200) {
              console.log('\n✅ SUCCÈS!');
              console.log('ID:', json.data.id);
              console.log('Nom:', json.data.prenom, json.data.nom);
              console.log('Token:', json.token ? '✓' : '✗');
            } else {
              console.log('\n❌ Code:', json.code, '-', json.message);
            }
          } catch (e) {
            console.log('Erreur JSON:', e.message);
          }
        }
        resolve();
      });
    });

    req.on('error', (e) => {
      console.error('❌ Erreur:', e.message);
      resolve();
    });

    req.write(bodyParams);
    req.end();
  });
}

async function main() {
  await step1_getGTK();
  if (gtkCookie) {
    await step2_login_with_data_param(gtkCookie);
  } else {
    console.log('❌ GTK non trouvé!');
  }
}

main();
