/**
 * Script de débogage - voir la réponse complète du login
 */

const https = require('https');

const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36';

let gtkCookie = null;

async function step1_getGTK() {
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.ecoledirecte.com',
      path: '/v3/login.awp?gtk=1&v=4.75.0',
      method: 'GET',
      headers: { 'User-Agent': userAgent },
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
    console.log('\n📌 LOGIN - Format: data={json}\n');

    const body = {
      identifiant: encodeURIComponent('even.henri'),
      motdepasse: encodeURIComponent('Superpitchu_8'),
      isRelogin: false,
      uuid: ""
    };

    const bodyString = 'data=' + JSON.stringify(body);
    console.log('Body envoyé:', bodyString.substring(0, 100) + '...');

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
      console.log(`Status: ${res.statusCode}, X-Code: ${res.headers['x-code']}`);
      console.log(`X-Token: ${res.headers['x-token'] ? 'Reçu' : 'Non reçu'}`);

      let data = '';
      res.on('data', (chunk) => data += chunk);
      
      res.on('end', () => {
        console.log('\n📥 RÉPONSE COMPLÈTE:\n');
        console.log(data);
        
        if (data) {
          try {
            const json = JSON.parse(data);
            console.log('\n✅ Parsed JSON:');
            console.log(JSON.stringify(json, null, 2));
            
            if (json.code === 200) {
              console.log('\n✅ SUCCÈS!');
              console.log('Clés de response.data:', Object.keys(json.data));
              if (json.data.accounts) {
                console.log('Nombre de comptes:', json.data.accounts.length);
                console.log('Premier compte:', JSON.stringify(json.data.accounts[0], null, 2).substring(0, 500));
              }
            }
          } catch (e) {
            console.log('\n❌ Erreur JSON:', e.message);
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
  }
}

main();
