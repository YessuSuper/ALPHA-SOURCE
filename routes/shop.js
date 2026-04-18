'use strict';
const express = require('express');
const router = express.Router();
const { db, stmts, buildUserObject, saveUserFromObject, readUsers } = require('./shared');

// === CATALOGUE DE PRIX SERVEUR (source de vérité) ===
const SHOP_CATALOG = {
    skin: {
        'bleu basique': 0, 'jaune basique': 0,
        'skin-verdure': 28, 'skin-obsidienne': 35, 'skin-sunset': 40,
        'skin-grenat': 26, 'skin-rose': 30, 'skin-neon': 38,
        'skin-chocolat': 24, 'skin-indigo': 36, 'skin-marbre': 34,
        'skin-aurore': 45, 'skin-pastel': 32, 'skin-cyberpunk': 38,
        'skin-foret': 30, 'skin-sable': 28, 'skin-minuit': 36,
        'skin-ocean': 32, 'skin-lavande': 30, 'skin-cerise': 34, 'skin-arctique': 36
    },
    fond: {
        'Vagues': 0, 'vagues-inversees': 30, 'lineaire': 28,
        'duel': 35, 'ondes': 22, 'pixel-art': 34,
        'aurora': 38, 'crumpled-paper': 26
    }
};

const SHOP_RARITIES = {
    skin: {
        'bleu basique': 'commun', 'jaune basique': 'commun',
        'skin-verdure': 'commun', 'skin-grenat': 'commun',
        'skin-chocolat': 'commun', 'skin-sable': 'commun',
        'skin-rose': 'rare', 'skin-foret': 'rare',
        'skin-lavande': 'rare', 'skin-ocean': 'rare',
        'skin-marbre': 'epique', 'skin-indigo': 'epique',
        'skin-neon': 'epique', 'skin-minuit': 'epique',
        'skin-cerise': 'epique', 'skin-arctique': 'epique',
        'skin-obsidienne': 'legendaire', 'skin-sunset': 'legendaire',
        'skin-aurore': 'legendaire', 'skin-pastel': 'legendaire',
        'skin-cyberpunk': 'mythique'
    },
    fond: {
        'Vagues': 'commun', 'vagues-inversees': 'rare',
        'lineaire': 'rare', 'ondes': 'rare',
        'crumpled-paper': 'epique', 'duel': 'epique',
        'pixel-art': 'legendaire', 'aurora': 'mythique'
    }
};

const SHOP_BUNDLES = [
    {
        id: 'starter-nature', title: 'Starter Nature',
        description: 'Verdure + Foret + fond Ondes', discountPercent: 12,
        items: [{ type: 'skin', itemId: 'skin-verdure' }, { type: 'skin', itemId: 'skin-foret' }, { type: 'fond', itemId: 'ondes' }]
    },
    {
        id: 'neo-lights', title: 'Neo Lights',
        description: 'Neon + Cyberpunk + Aurora', discountPercent: 15,
        items: [{ type: 'skin', itemId: 'skin-neon' }, { type: 'skin', itemId: 'skin-cyberpunk' }, { type: 'fond', itemId: 'aurora' }]
    },
    {
        id: 'arctic-serenity', title: 'Arctic Serenity',
        description: 'Arctique + Lavande + Vagues inversees', discountPercent: 10,
        items: [{ type: 'skin', itemId: 'skin-arctique' }, { type: 'skin', itemId: 'skin-lavande' }, { type: 'fond', itemId: 'vagues-inversees' }]
    }
];

function getRarity(type, itemId) {
    return (SHOP_RARITIES[type] || {})[itemId] || 'commun';
}

function appendPurchaseHistory(user, entry) {
    if (!Array.isArray(user.purchase_history)) user.purchase_history = [];
    user.purchase_history.unshift({ at: new Date().toISOString(), ...entry });
    user.purchase_history = user.purchase_history.slice(0, 100);
}

function buildDailyOffers(username) {
    const allItems = [];
    for (const [type, items] of Object.entries(SHOP_CATALOG)) {
        for (const [itemId, price] of Object.entries(items)) {
            if (price <= 0) continue;
            allItems.push({ type, itemId });
        }
    }

    const seedText = `\${new Date().toISOString().slice(0, 10)}:\${String(username || '').toLowerCase()}`;
    let seed = 0;
    for (let i = 0; i < seedText.length; i += 1) {
        seed = (seed * 31 + seedText.charCodeAt(i)) % 2147483647;
    }

    const picks = [];
    const used = new Set();
    while (picks.length < 3 && used.size < allItems.length) {
        seed = (seed * 1103515245 + 12345) % 2147483647;
        const idx = seed % allItems.length;
        const candidate = allItems[idx];
        const key = `\${candidate.type}:\${candidate.itemId}`;
        if (used.has(key)) continue;
        used.add(key);

        const basePrice = SHOP_CATALOG[candidate.type][candidate.itemId];
        const discountPercent = 10 + (seed % 11);
        const discountedPrice = Math.max(1, Math.floor(basePrice * (100 - discountPercent) / 100));
        picks.push({ ...candidate, basePrice, discountPercent, discountedPrice });
    }
    return picks;
}

router.get('/api/shop-meta/:username', express.json(), async (req, res) => {
    const username = String(req.params.username || '').trim();
    if (!username) return res.status(400).json({ success: false, message: 'Username requis' });
    try {
        return res.json({ success: true, bundles: SHOP_BUNDLES, dailyOffers: buildDailyOffers(username) });
    } catch (error) {
        console.error('[SHOP] Erreur shop-meta:', error);
        return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

router.get('/api/shop-history/:username', express.json(), async (req, res) => {
    const username = String(req.params.username || '').trim();
    if (!username) return res.status(400).json({ success: false, message: 'Username requis' });
    try {
        const userRow = stmts.getUserLower.get(username.toLowerCase());
        if (!userRow) return res.status(404).json({ success: false, message: 'Utilisateur non trouv\u00E9' });
        const user = buildUserObject(userRow);
        return res.json({ success: true, history: Array.isArray(user.purchase_history) ? user.purchase_history : [] });
    } catch (error) {
        console.error('[SHOP] Erreur shop-history:', error);
        return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// === SHOP PURCHASE ===
router.post('/api/shop-purchase', express.json(), async (req, res) => {
    try {
        const { username, itemId, type } = req.body;
        if (!username || !itemId || !type) return res.status(400).json({ success: false, message: 'Param\u00E8tres manquants' });

        const catalog = SHOP_CATALOG[type];
        if (!catalog || catalog[itemId] === undefined) return res.status(400).json({ success: false, message: 'Item inconnu dans le catalogue' });

        const basePrice = catalog[itemId];
        const dailyOffer = buildDailyOffers(username).find(o => o.type === type && o.itemId === itemId) || null;
        const numericPrice = dailyOffer ? dailyOffer.discountedPrice : basePrice;

        console.log(`[SHOP] Tentative d'achat par \${username}: \${itemId} (\${numericPrice} pts)`);

        const userRow = stmts.getUserLower.get(username.toLowerCase());
        if (!userRow) return res.status(404).json({ success: false, message: 'Utilisateur non trouv\u00E9' });
        const user = buildUserObject(userRow);

        const currentPoints = user.pt || 0;
        if (currentPoints < numericPrice) {
            return res.status(400).json({ success: false, message: `Vous n'avez pas assez de points. Il vous faut \${numericPrice} pts mais vous n'en avez que \${currentPoints}.` });
        }

        const isSkinPurchase = String(type) === 'skin';
        const isFondPurchase = String(type) === 'fond';
        if (!isSkinPurchase && !isFondPurchase) return res.status(400).json({ success: false, message: "Type d'item invalide" });

        if (isSkinPurchase) {
            if (!user.skins_obtenus || !Array.isArray(user.skins_obtenus)) user.skins_obtenus = ['bleu basique', 'jaune basique'];
            if (user.skins_obtenus.includes(itemId)) return res.status(400).json({ success: false, message: 'Vous avez d\u00E9j\u00E0 achet\u00E9 cet item' });
        }
        if (isFondPurchase) {
            if (!user.fonds_obtenus || !Array.isArray(user.fonds_obtenus)) user.fonds_obtenus = ['Vagues'];
            if (user.fonds_obtenus.includes(itemId)) return res.status(400).json({ success: false, message: 'Vous avez d\u00E9j\u00E0 achet\u00E9 cet item' });
        }

        user.pt = currentPoints - numericPrice;
        user.depenses = (user.depenses || 0) + numericPrice;

        if (isSkinPurchase) { user.skins_obtenus.push(itemId); user.active_skin = itemId; }
        if (isFondPurchase) { user.fonds_obtenus.push(itemId); }

        appendPurchaseHistory(user, {
            source: 'single', type, itemId, rarity: getRarity(type, itemId),
            price: numericPrice, basePrice, offerApplied: !!dailyOffer
        });

        saveUserFromObject(user);

        console.log(`[SHOP] Achat r\u00E9ussi pour \${username}: \${itemId}. Points restants: \${user.pt}`);
        return res.json({
            success: true, message: 'Achat r\u00E9ussi !', newPoints: user.pt,
            rarity: getRarity(type, itemId), offerApplied: !!dailyOffer,
            active_skin: user.active_skin, active_fond: user.active_fond
        });
    } catch (error) {
        console.error('[SHOP] Erreur achat:', error);
        return res.status(500).json({ success: false, message: "Erreur serveur lors de l'achat" });
    }
});

router.post('/api/shop-purchase-bundle', express.json(), async (req, res) => {
    try {
        const username = String((req.body && req.body.username) || '').trim();
        const bundleId = String((req.body && req.body.bundleId) || '').trim();
        if (!username || !bundleId) return res.status(400).json({ success: false, message: 'Param\u00E8tres manquants' });

        const bundle = SHOP_BUNDLES.find(b => b.id === bundleId);
        if (!bundle) return res.status(404).json({ success: false, message: 'Bundle introuvable' });

        const userRow = stmts.getUserLower.get(username.toLowerCase());
        if (!userRow) return res.status(404).json({ success: false, message: 'Utilisateur non trouv\u00E9' });
        const user = buildUserObject(userRow);

        if (!Array.isArray(user.skins_obtenus)) user.skins_obtenus = ['bleu basique', 'jaune basique'];
        if (!Array.isArray(user.fonds_obtenus)) user.fonds_obtenus = ['Vagues'];

        const missingItems = [];
        let baseTotal = 0;
        for (const item of bundle.items) {
            if (!item || !item.type || !item.itemId) continue;
            const cat = SHOP_CATALOG[item.type];
            if (!cat || cat[item.itemId] === undefined) continue;
            const owned = item.type === 'skin' ? user.skins_obtenus.includes(item.itemId) : user.fonds_obtenus.includes(item.itemId);
            if (!owned) { missingItems.push(item); baseTotal += cat[item.itemId]; }
        }

        if (missingItems.length === 0) return res.status(400).json({ success: false, message: 'Tu poss\u00E8des d\u00E9j\u00E0 tous les items de ce bundle.' });

        const discountPercent = Number(bundle.discountPercent || 0);
        const finalPrice = Math.max(1, Math.floor(baseTotal * (100 - discountPercent) / 100));
        if ((user.pt || 0) < finalPrice) {
            return res.status(400).json({ success: false, message: `Pas assez de points pour ce bundle (\${finalPrice} pts requis).` });
        }

        user.pt = (user.pt || 0) - finalPrice;
        user.depenses = (user.depenses || 0) + finalPrice;

        for (const item of missingItems) {
            if (item.type === 'skin' && !user.skins_obtenus.includes(item.itemId)) user.skins_obtenus.push(item.itemId);
            else if (item.type === 'fond' && !user.fonds_obtenus.includes(item.itemId)) user.fonds_obtenus.push(item.itemId);
        }

        appendPurchaseHistory(user, {
            source: 'bundle', bundleId: bundle.id, bundleTitle: bundle.title,
            price: finalPrice, discountPercent,
            items: missingItems.map(item => ({ type: item.type, itemId: item.itemId, rarity: getRarity(item.type, item.itemId) }))
        });

        saveUserFromObject(user);

        return res.json({
            success: true, message: 'Bundle achet\u00E9 avec succ\u00E8s !', newPoints: user.pt,
            purchasedItems: missingItems,
            bundle: { id: bundle.id, title: bundle.title, discountPercent, finalPrice }
        });
    } catch (error) {
        console.error('[SHOP] Erreur achat bundle:', error);
        return res.status(500).json({ success: false, message: "Erreur serveur lors de l'achat du bundle" });
    }
});

// === EQUIP SKIN ===
router.post('/api/equip-skin', express.json(), async (req, res) => {
    try {
        const { username, skinId } = req.body;
        if (!username || !skinId) return res.status(400).json({ success: false, message: 'Username ou Skin ID manquant' });
        console.log(`[EQUIP] \${username} \u00E9quipe le skin: \${skinId}`);

        const userRow = stmts.getUserLower.get(username.toLowerCase());
        if (!userRow) return res.status(404).json({ success: false, message: 'Utilisateur non trouv\u00E9' });
        const user = buildUserObject(userRow);

        if (!user.skins_obtenus || !Array.isArray(user.skins_obtenus)) user.skins_obtenus = ['bleu basique', 'jaune basique'];
        const isSkinAvailable = (skinId === 'bleu basique' || skinId === 'jaune basique') || user.skins_obtenus.includes(skinId);
        if (!isSkinAvailable) return res.status(403).json({ success: false, message: "Vous n'avez pas ce skin" });

        user.active_skin = skinId;
        saveUserFromObject(user);
        console.log(`[EQUIP] Skin \u00E9quip\u00E9 pour \${username}: \${skinId}`);
        return res.json({ success: true, message: 'Skin \u00E9quip\u00E9 avec succ\u00E8s !', active_skin: skinId });
    } catch (error) {
        console.error('[EQUIP] Erreur skin:', error);
        return res.status(500).json({ success: false, message: "Erreur serveur lors de l'\u00E9quipement du skin" });
    }
});

// === EQUIP FOND ===
router.post('/api/equip-fond', express.json(), async (req, res) => {
    try {
        const { username, fondId } = req.body;
        if (!username || !fondId) return res.status(400).json({ success: false, message: 'Username ou Fond ID manquant' });
        console.log(`[EQUIP] \${username} \u00E9quipe le fond: \${fondId}`);

        const userRow = stmts.getUserLower.get(username.toLowerCase());
        if (!userRow) return res.status(404).json({ success: false, message: 'Utilisateur non trouv\u00E9' });
        const user = buildUserObject(userRow);

        if (!user.fonds_obtenus || !Array.isArray(user.fonds_obtenus)) user.fonds_obtenus = ['Vagues'];
        const isFondAvailable = (fondId === 'Vagues') || user.fonds_obtenus.includes(fondId);
        if (!isFondAvailable) return res.status(403).json({ success: false, message: "Vous n'avez pas ce fond" });

        user.active_fond = fondId;
        saveUserFromObject(user);
        console.log(`[EQUIP] Fond \u00E9quip\u00E9 pour \${username}: \${fondId}`);
        return res.json({ success: true, message: 'Fond \u00E9quip\u00E9 avec succ\u00E8s !', active_fond: fondId });
    } catch (error) {
        console.error('[EQUIP] Erreur fond:', error);
        return res.status(500).json({ success: false, message: "Erreur serveur lors de l'\u00E9quipement du fond" });
    }
});

module.exports = router;
