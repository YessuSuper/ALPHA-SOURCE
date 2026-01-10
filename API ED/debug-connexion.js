/**
 * Script de débogage pour tester la connexion brute
 */

const https = require('https');

const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36';

console.log('🔍 Test de connexion brute à EcoleDirecte...\n');

// Test 1: GET pour GTK
console.log('Test 1️⃣ : Récupération du GTK');
console.log('URL: https://api.ecoledirecte.com/v3/login.awp?gtk=1&v=4.75.0\n');

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
  console.log(`Headers:`, res.headers);
  console.log('\n📥 Réponse brute:\n');

  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('---START---');
    console.log(data);
    console.log('---END---\n');
    
    console.log(`Longueur: ${data.length} caractères`);
    console.log(`Premier caractère: ${data.charCodeAt(0)} (${String.fromCharCode(data.charCodeAt(0))})`);
    
    try {
      const json = JSON.parse(data);
      console.log('\n✅ JSON valide:');
      console.log(JSON.stringify(json, null, 2));
    } catch (e) {
      console.log('\n❌ Erreur JSON:', e.message);
      console.log('\nType de réponse:', typeof data);
      console.log('Commence par:', data.substring(0, 100));
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Erreur de requête:', error.message);
});

req.setTimeout(10000, () => {
  console.error('❌ Timeout');
  req.destroy();
});

req.end();
