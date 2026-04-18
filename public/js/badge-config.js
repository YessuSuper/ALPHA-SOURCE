// badge-config.js - Configuration globale des badges avec icônes et descriptions

// Définition globale des icônes de badges
const BADGE_ICONS = {
    // Anciens badges - avec images PNG
    delegue: { type: 'image', src: '/ressources/badges/délégué.png', emoji: '🎖️', large: false },
    sociable: { type: 'image', src: '/ressources/badges/sociable.png', emoji: '💬', large: false },
    rank1: { type: 'image', src: '/ressources/badges/1rank.png', emoji: '🏆', large: true },
    rank2: { type: 'image', src: '/ressources/badges/2rank.png', emoji: '🥈', large: true },
    rank3: { type: 'image', src: '/ressources/badges/3rank.png', emoji: '🥉', large: true },
    robot: { type: 'image', src: '/ressources/badges/robot.png', emoji: '🤖', large: false },
    actif: { type: 'image', src: '/ressources/badges/actif.png', emoji: '⚡', large: false },
    inactif: { type: 'image', src: '/ressources/badges/inactif.png', emoji: '😴', large: false },
    nouveau: { type: 'image', src: '/ressources/badges/nouveau.png', emoji: '🆕', large: false },
    depenseur: { type: 'image', src: '/ressources/badges/dépenseur.png', emoji: '💸', large: false },
    fantome: { type: 'image', src: '/ressources/badges/fantome.png', emoji: '👻', large: false },
    
    // Nouveaux badges
    ecolo: { type: 'image', src: '/ressources/badges/ecolo.png', emoji: '🌱', large: false },
    lent: { type: 'image', src: '/ressources/badges/lent.png', emoji: '🐢', large: false },
    sauveur: { type: 'emoji', emoji: '🦸', large: false },
    leveTot: { type: 'emoji', emoji: '🌅', large: false },
    nocturne: { type: 'emoji', emoji: '🌙', large: false },
    ami: { type: 'image', src: '/ressources/badges/ami.png', emoji: '💕', large: false },
    puni: { type: 'image', src: '/ressources/badges/puni.png', emoji: '⚠️', large: false },
    banni: { type: 'image', src: '/ressources/details/banned.png', emoji: '🚫', large: false },
    police: { type: 'image', src: '/ressources/badges/police.png', emoji: '👮', large: false },
    chefEtoile: { type: 'emoji', emoji: '⭐', large: false },
    juge: { type: 'image', src: '/ressources/badges/juge.png', emoji: '⚖️', large: false }
};

// Additional badges used by server-side logic but missing from the config
BADGE_ICONS.marathonien = { type: 'image', src: '/ressources/badges/Marathonien.png', emoji: '🏅', large: false };
BADGE_ICONS.collectionneur = { type: 'image', src: '/ressources/badges/collectionneur.png', emoji: '🎯', large: false };
BADGE_ICONS.pilier = { type: 'emoji', emoji: '🪨', large: false };
BADGE_ICONS.explorateur = { type: 'emoji', emoji: '🧭', large: false };
BADGE_ICONS.vestimentaire = { type: 'emoji', emoji: '👗', large: false };

// Descriptions détaillées des badges
const BADGE_DESCRIPTIONS = {
    // Anciens badges
    delegue: {
        name: 'Délégué',
        description: 'Tu es délégué de classe. Les modos ont confiance en toi!'
    },
    sociable: {
        name: 'Sociable',
        description: 'Top 3 des utilisateurs les plus bavards. Tu es très actif dans les conversations!'
    },
    rank1: {
        name: 'Champion',
        description: 'N°1 au classement des points. Tu domines! 👑'
    },
    rank2: {
        name: 'Finaliste',
        description: 'N°2 au classement des points. Tu es très proche du top!'
    },
    rank3: {
        name: 'Podium',
        description: 'N°3 au classement des points. Impressionnant!'
    },
    robot: {
        name: 'Robot',
        description: 'Tu fais partie des 2 plus gros utilisateurs de l\'IA. T\'aimes bien discuter avec GPT!'
    },
    actif: {
        name: 'Hyperactif',
        description: 'Tu es le plus actif en ce moment. Tu te connectes régulièrement et tu discutes beaucoup!'
    },
    inactif: {
        name: 'Fantôme discret',
        description: 'Tu es le moins actif en ce moment. À bientôt on espère!'
    },
    nouveau: {
        name: 'Nouveau',
        description: 'Bienvenue! Tu es nouveau sur la plateforme. Explore et amuse-toi bien!'
    },
    depenseur: {
        name: 'Dépensier',
        description: 'Tu dépenses le plus de points cette semaine. Sacrées courses!'
    },
    fantome: {
        name: 'Fantôme',
        description: 'Tu es discret en ce moment. Moins de messages que les autres ces 5 derniers jours.'
    },
    
    // Nouveaux badges
    ecolo: {
        name: 'Écolo',
        description: 'Tu parles le moins à l\'IA. Bravo pour respecter le règlement!'
    },
    lent: {
        name: 'Lent',
        description: 'Tu réponds lentement aux messages privés. Pas grave, on attendra! 🐢'
    },
    sauveur: {
        name: 'Sauveur',
        description: 'Tu as été validé sur le plus de sauvetages! Merci pour ton aide!'
    },
    leveTot: {
        name: 'Lève-Tôt',
        description: 'Tu te connectes très tôt le matin. Les lever tôt, c\'est pas pour tout le monde!'
    },
    nocturne: {
        name: 'Nocturne',
        description: 'Tu es plutôt actif tard la nuit. Travaille pas trop tard! 🌙'
    },
    ami: {
        name: 'Ami',
        description: 'Tu as le plus de messages privés. Tu es très sociable!'
    },
    puni: {
        name: 'Puni',
        description: 'Tu as reçu un ou plusieurs avertissements. Attention à ton comportement!'
    },
    banni: {
        name: 'Banni',
        description: 'Tu es actuellement banni de la plateforme. Respecte les règles!'
    },
    police: {
        name: 'Police',
        description: 'Tu signales le plus de messages. Merci de veiller sur la communauté!'
    },
    chefEtoile: {
        name: 'Chef étoilé',
        description: 'Tu as la meilleure note moyenne sur tes cours postés.'
    },
    juge: {
        name: 'Juge',
        description: 'Tu notes le plus de cours. Merci pour les avis!'
    }
};

// Descriptions manquantes pour les nouveaux badges ajoutés dynamiquement
BADGE_DESCRIPTIONS.marathonien = {
    name: 'Marathonien',
    description: 'Présent sur une longue période : tu te connectes et participes régulièrement.'
};
BADGE_DESCRIPTIONS.collectionneur = {
    name: 'Collectionneur',
    description: 'Tu as rassemblé de nombreux objets et thèmes. Ta collection est impressionnante !'
};
BADGE_DESCRIPTIONS.pilier = {
    name: 'Pilier',
    description: 'Pilier de la communauté : fiable, aidant et présent pour les autres.'
};
BADGE_DESCRIPTIONS.explorateur = {
    name: 'Explorateur',
    description: 'Tu découvres et testes souvent de nouvelles fonctionnalités du site.'
};
BADGE_DESCRIPTIONS.vestimentaire = {
    name: 'Vestimentaire',
    description: 'Tu as débloqué plusieurs skins/thèmes : tu as du style !'
};

// Fonction pour obtenir l'emoji d'un badge
function getBadgeEmoji(badgeId) {
    const badge = BADGE_ICONS[badgeId];
    return badge ? badge.emoji : '❓';
}

// Fonction pour obtenir la description d'un badge
function getBadgeDescription(badgeId) {
    const desc = BADGE_DESCRIPTIONS[badgeId];
    return desc || { name: 'Badge inconnu', description: 'Ce badge n\'existe pas.' };
}

// Fonction pour rendre un badge en HTML
function renderBadgeHtml(badgeId, large = false) {
    const emoji = getBadgeEmoji(badgeId);
    const desc = getBadgeDescription(badgeId);
    return `
        <div class="badge-item" data-badge-id="${badgeId}" title="${desc.name}: ${desc.description}">
            <span class="badge-emoji ${large ? 'badge-emoji-large' : ''}">${emoji}</span>
        </div>
    `;
}
