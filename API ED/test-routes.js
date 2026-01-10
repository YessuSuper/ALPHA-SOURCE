#!/usr/bin/env node

/**
 * Script utilitaire pour tester différentes routes de l'API
 * Usage: node test-routes.js <route>
 */

const EcoleDirecteAPI = require('./ecoledirecte-api');

const CREDENTIALS = {
  identifiant: 'even.henri',
  motdepasse: 'Superpitchu_8'
};

async function testRoutes(routeName) {
  const api = new EcoleDirecteAPI(CREDENTIALS.identifiant, CREDENTIALS.motdepasse);

  try {
    console.log(`🔐 Connexion...`);
    const account = await api.login();

    if (account.requireQCM) {
      console.log('❌ QCM requis');
      return;
    }

    console.log(`✅ Connecté\n`);

    const routes = {
      'account': async () => {
        const acc = await api.getAccount();
        console.log('📌 ACCOUNT:', JSON.stringify(acc, null, 2));
      },

      'timeline': async () => {
        const timeline = await api.getTimeline();
        console.log('📌 TIMELINE:', JSON.stringify(timeline.slice(0, 3), null, 2));
      },

      'notes': async () => {
        const notes = await api.getNotes();
        console.log('📌 NOTES:', JSON.stringify({
          periodes: notes.periodes.length,
          notes: notes.notes.length
        }, null, 2));
      },

      'emploidutemps': async () => {
        const today = new Date().toISOString().split('T')[0];
        const edt = await api.getEmploiDuTemps(today, today);
        console.log('📌 EMPLOI DU TEMPS:', JSON.stringify(edt.slice(0, 2), null, 2));
      },

      'viescolaire': async () => {
        const vs = await api.getVieScolaire();
        console.log('📌 VIE SCOLAIRE:', JSON.stringify({
          absences: vs.absencesRetards.length,
          sanctions: vs.sanctionsEncouragements.length
        }, null, 2));
      },

      'documents': async () => {
        const docs = await api.getDocuments();
        console.log('📌 DOCUMENTS:', JSON.stringify({
          notes: docs.notes.length,
          administratifs: docs.administratifs.length
        }, null, 2));
      },

      'espacestravail': async () => {
        const et = await api.getEspacesTravail();
        console.log('📌 ESPACES DE TRAVAIL:', JSON.stringify(et.slice(0, 2), null, 2));
      },

      'cahierdetexte': async () => {
        const today = new Date().toISOString().split('T')[0];
        const cahier = await api.getCahierDeTexte(today);
        console.log('📌 CAHIER DE TEXTE:', JSON.stringify({
          date: cahier.date,
          matieres: cahier.matieres.length
        }, null, 2));
      },

      'all': async () => {
        console.log('📊 Test de toutes les routes...\n');
        await routes.account();
        console.log('');
        await routes.timeline();
        console.log('');
        await routes.notes();
        console.log('');
        await routes.emploidutemps();
        console.log('');
        await routes.viescolaire();
        console.log('');
        await routes.documents();
        console.log('');
        await routes.espacestravail();
      }
    };

    if (routeName === 'help' || routeName === '-h' || routeName === '--help') {
      console.log('Routes disponibles:');
      Object.keys(routes).forEach(r => console.log(`  - ${r}`));
      return;
    }

    if (routeName && routes[routeName]) {
      await routes[routeName]();
    } else {
      console.log('❌ Route non trouvée:', routeName);
      console.log('Routes disponibles:', Object.keys(routes).join(', '));
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

const route = process.argv[2] || 'all';
testRoutes(route);
