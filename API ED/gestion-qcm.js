/**
 * Gestion complète de la double authentification (QCM)
 * Utilisé quand un QCM est requis lors de la connexion
 */

const readline = require('readline');
const EcoleDirecteAPI = require('./ecoledirecte-api');

const CREDENTIALS = {
  identifiant: process.env.ED_USERNAME || '',
  motdepasse: process.env.ED_PASSWORD || ''
};

// Interface pour lire l'entrée utilisateur
function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

function question(rl, prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function handleQCM() {
  const api = new EcoleDirecteAPI(CREDENTIALS.identifiant, CREDENTIALS.motdepasse);
  const rl = createReadlineInterface();

  try {
    console.log('='.repeat(50));
    console.log('🔐 GESTION DE LA DOUBLE AUTHENTIFICATION');
    console.log('='.repeat(50));

    // Étape 1: Récupérer le token GTK
    await api.getGTKToken();

    // Étape 2: Tentative de connexion simple
    const result = await api.loginSimple();

    if (!result.requireQCM) {
      console.log('✅ Connexion réussie sans QCM');
      rl.close();
      return result;
    }

    // Étape 3: QCM requis - Récupérer le QCM
    console.log('\n⚠️  QCM (Double Authentification) REQUIS');
    console.log('Cela signifie qu\'un nouvel appareil a été détecté.');
    
    const qcmData = await api.getQCM();

    // Étape 4: Afficher les propositions et demander la réponse
    console.log('\n' + '='.repeat(50));
    
    const choixStr = await question(rl, '\nEntrez le numéro de votre réponse (1-' + qcmData.propositions.length + '): ');
    const choixIndex = parseInt(choixStr) - 1;

    if (choixIndex < 0 || choixIndex >= qcmData.propositions.length) {
      throw new Error('Choix invalide');
    }

    const selectedAnswer = qcmData.raw.propositions[choixIndex];
    console.log(`\n✓ Réponse sélectionnée: ${qcmData.propositions[choixIndex]}`);

    // Étape 5: Envoyer la réponse
    const faAnswers = await api.answerQCM(selectedAnswer);

    // Étape 6: Connexion avec QCM
    const account = await api.loginWithQCM([
      {
        cn: faAnswers.cn,
        cv: faAnswers.cv
      }
    ]);

    console.log('\n' + '='.repeat(50));
    console.log('✅ CONNEXION RÉUSSIE');
    console.log('='.repeat(50));
    console.log(`👤 ${account.prenom} ${account.nom}`);
    console.log(`📚 Classe: ${account.profile.classe.libelle}`);
    console.log('='.repeat(50));

    rl.close();
    return account;

  } catch (error) {
    console.error('\n❌ ERREUR:', error.message);
    rl.close();
    process.exit(1);
  }
}

// Lancer si appelé directement
if (require.main === module) {
  handleQCM();
}

module.exports = { handleQCM };
