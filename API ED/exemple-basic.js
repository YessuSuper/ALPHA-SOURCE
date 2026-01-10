/**
 * Exemple d'utilisation du client EcoleDirecte
 * Connexion et récupération de données
 */

const EcoleDirecteAPI = require('./ecoledirecte-api');
require('dotenv').config();

const CREDENTIALS = {
  identifiant: process.env.IDENTIFIANT || 'even.henri',
  motdepasse: process.env.MOTDEPASSE || 'Superpitchu_8'
};

async function main() {
  const api = new EcoleDirecteAPI(CREDENTIALS.identifiant, CREDENTIALS.motdepasse);

  try {
    console.log('='.repeat(50));
    console.log('🔗 CONNEXION À ECOLEDIRECTE');
    console.log('='.repeat(50));
    
    // Connexion
    const account = await api.login();

    if (account.requireQCM) {
      console.log('\n⚠️  QCM requis - voir gestion-qcm.js pour la gestion complète');
      return;
    }

    // Affichage des infos du compte
    console.log('\n' + '='.repeat(50));
    console.log('👤 INFORMATIONS DU COMPTE');
    console.log('='.repeat(50));
    console.log(`ID: ${account?.id ?? '-'}`);
    console.log(`Identifiant: ${account?.identifiant ?? '-'}`);
    console.log(`Nom: ${account?.prenom ?? '-'} ${account?.nom ?? '-'}`);
    console.log(`Email: ${account?.email ?? '-'}`);
    console.log(`Établissement: ${account?.nomEtablissement ?? '-'}`);
    console.log(`Classe: ${account?.profile?.classe?.libelle ?? '-'}`);
    console.log(`Année scolaire: ${account?.anneeScolaireCourante ?? '-'}`);
    console.log(`Modules actifs: ${Array.isArray(account?.modules) ? account.modules.filter(m => m.enable).length : 0}`);

    // Récupération de données supplémentaires
    console.log('\n' + '='.repeat(50));
    console.log('📊 RÉCUPÉRATION DE DONNÉES');
    console.log('='.repeat(50));

    try {
      const timeline = await api.getTimeline();
      console.log('\n📅 Derniers événements:');
      timeline.slice(0, 3).forEach(evt => {
        console.log(`  - [${evt.date}] ${evt.titre}`);
      });
    } catch (e) {
      console.log('⚠️  Timeline non disponible');
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      const edt = await api.getEmploiDuTemps(today, tomorrow);
      console.log(`\n📚 Emploi du temps (${today}):`, edt.length, 'cours');
      edt.forEach(cours => {
        console.log(`  - ${cours.start_date} : ${cours.text} (${cours.prof})`);
      });
    } catch (e) {
      console.log('⚠️  Emploi du temps non disponible');
    }

    try {
      const notes = await api.getNotes();
      if (notes.periodes && notes.periodes.length > 0) {
        const derniere = notes.periodes[notes.periodes.length - 1];
        console.log(`\n📊 Notes (${derniere.periode}):`);
        console.log(`  - Moyenne générale: ${derniere.ensembleMatieres.moyenneGenerale}`);
      }
    } catch (e) {
      console.log('⚠️  Notes non disponibles');
    }

    try {
      const vieScolaire = await api.getVieScolaire();
      console.log('\n📋 Vie scolaire:');
      console.log(`  - ${vieScolaire.absencesRetards.length} absences/retards`);
      console.log(`  - ${vieScolaire.sanctionsEncouragements.length} sanctions/encouragements`);
    } catch (e) {
      console.log('⚠️  Vie scolaire non disponible');
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ DONNÉES RÉCUPÉRÉES AVEC SUCCÈS');
    console.log('='.repeat(50));

  } catch (error) {
    console.error('\n❌ ERREUR:', error.message);
    process.exit(1);
  }
}

// Lancer si appelé directement
if (require.main === module) {
  main();
}

module.exports = { main };
