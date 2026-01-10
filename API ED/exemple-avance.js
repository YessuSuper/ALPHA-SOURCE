/**
 * Récupération spécifique des différentes données EcoleDirecte
 * Exemples avancés
 */

const EcoleDirecteAPI = require('./ecoledirecte-api');

const CREDENTIALS = {
  identifiant: 'even.henri',
  motdepasse: 'Superpitchu_8'
};

async function afficherNotes(api) {
  console.log('\n' + '='.repeat(50));
  console.log('📊 NOTES PAR MATIÈRE');
  console.log('='.repeat(50));
  
  try {
    const notes = await api.getNotes();
    
    if (notes.periodes && notes.periodes.length > 0) {
      // Afficher la dernière période
      const periode = notes.periodes[notes.periodes.length - 1];
      
      console.log(`\n📌 ${periode.periode}`);
      console.log(`Moyenne générale: ${periode.ensembleMatieres.moyenneGenerale}`);
      console.log(`Moyenne classe: ${periode.ensembleMatieres.moyenneClasse}`);
      
      console.log('\n📚 Par matière:');
      periode.ensembleMatieres.disciplines.forEach(disc => {
        const rang = disc.rang > 0 ? ` (Rang: ${disc.rang})` : '';
        console.log(`  ${disc.discipline.padEnd(30)} ${disc.moyenne.padStart(5)}/20${rang}`);
      });
    }
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

async function afficherCahierTexte(api, date) {
  console.log('\n' + '='.repeat(50));
  console.log(`📖 CAHIER DE TEXTE - ${date}`);
  console.log('='.repeat(50));
  
  try {
    const cahier = await api.getCahierDeTexte(date);
    
    cahier.matieres.forEach(matiere => {
      console.log(`\n📚 ${matiere.matiere} (${matiere.nomProf})`);
      
      if (matiere.aFaire && matiere.aFaire.contenu) {
        const contenuDecoded = Buffer.from(matiere.aFaire.contenu, 'base64').toString('utf-8');
        console.log(`   À faire: ${contenuDecoded.substring(0, 100)}...`);
      }
      
      if (matiere.aFaire && matiere.aFaire.documents && matiere.aFaire.documents.length > 0) {
        console.log(`   Documents:`, matiere.aFaire.documents.map(d => d.libelle).join(', '));
      }
    });
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

async function afficherVieScolaire(api) {
  console.log('\n' + '='.repeat(50));
  console.log('📋 VIE SCOLAIRE');
  console.log('='.repeat(50));
  
  try {
    const vieScolaire = await api.getVieScolaire();
    
    console.log('\n🚫 Absences et Retards:');
    vieScolaire.absencesRetards.forEach(abs => {
      const justifie = abs.justifie ? '✓ Justifiée' : '✗ Non justifiée';
      console.log(`  ${abs.date}: ${abs.libelle} (${justifie})`);
    });
    
    console.log('\n⚠️  Sanctions et Encouragements:');
    vieScolaire.sanctionsEncouragements.forEach(sanc => {
      console.log(`  ${sanc.date}: ${sanc.libelle} - ${sanc.motif}`);
    });
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

async function afficherDocuments(api) {
  console.log('\n' + '='.repeat(50));
  console.log('📄 DOCUMENTS ADMINISTRATIFS');
  console.log('='.repeat(50));
  
  try {
    const docs = await api.getDocuments();
    
    console.log('\n📋 Notes:');
    docs.notes.forEach(note => {
      console.log(`  - ${note.libelle} (${note.date})`);
    });
    
    console.log('\n📋 Documents administratifs:');
    docs.administratifs.forEach(doc => {
      console.log(`  - ${doc.libelle} (${doc.date})`);
    });
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

async function main() {
  const api = new EcoleDirecteAPI(CREDENTIALS.identifiant, CREDENTIALS.motdepasse);

  try {
    console.log('🔗 Connexion à EcoleDirecte...');
    const account = await api.login();

    if (account.requireQCM) {
      console.log('⚠️  QCM requis - exécutez gestion-qcm.js');
      return;
    }

    console.log(`✅ Connecté en tant que ${account.prenom} ${account.nom}`);

    // Récupérer différentes données
    await afficherNotes(api);
    
    const today = new Date().toISOString().split('T')[0];
    await afficherCahierTexte(api, today);
    
    await afficherVieScolaire(api);
    
    await afficherDocuments(api);

    console.log('\n' + '='.repeat(50));
    console.log('✅ RÉCUPÉRATION COMPLÈTE');
    console.log('='.repeat(50));

  } catch (error) {
    console.error('❌ ERREUR:', error.message);
    process.exit(1);
  }
}

// Lancer si appelé directement
if (require.main === module) {
  main();
}

module.exports = { afficherNotes, afficherCahierTexte, afficherVieScolaire, afficherDocuments };
