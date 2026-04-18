// moncompte.js - Gestion de la page Mon Compte
console.log('moncompte.js est chargé!');

// Palette de 4 couleurs dominantes par thème (cercle, triangle, carré, hexagone)
const themeColorPalettes = {
    "bleu basique":    ["#4a90e2", "#357abd", "#64b5f6", "#1976d2"],
    "skin-jaune":      ["#ffff00", "#ffdd00", "#00ffff", "#ff00ff"],
    "jaune basique":   ["#ffff00", "#ffdd00", "#00ffff", "#ff00ff"],
    "skin-verdure":    ["#bfe6b9", "#00ff88", "#00ffff", "#a3ff00"],
    "skin-obsidienne": ["#cba8ff", "#a06bff", "#8b58e6", "#ff77aa"],
    "skin-sunset":     ["#b967ff", "#01cdfe", "#ff71ce", "#fffb96"],
    "skin-grenat":     ["#ffcade", "#ff0099", "#ffdd00", "#ff33cc"],
    "skin-rose":       ["#a4133c", "#ff007f", "#800f2f", "#ff4d6d"],
    "skin-neon":       ["#3ae8ff", "#ff47c2", "#00ff41", "#ffe066"],
    "skin-chocolat":   ["#c99857", "#ff9900", "#ffdd00", "#ff6600"],
    "skin-indigo":     ["#9b7dd9", "#7b68ee", "#663399", "#cc99ff"],
    "skin-marbre":     ["#6b7280", "#00ddff", "#ffffff", "#ff00ff"],
    "skin-aurore":     ["#00ff88", "#ff00ff", "#00ffff", "#00dd77"],
    "skin-pastel":     ["#ffd1dc", "#b5ead7", "#c7ceea", "#ff7eb3"],
    "skin-cyberpunk":  ["#ff00c8", "#00fff7", "#fffb00", "#ff3366"],
    "skin-foret":      ["#7cb87a", "#a3b18a", "#c4d4a5", "#6b8a5e"],
    "skin-sable":      ["#e6c07b", "#ffb866", "#ffe29a", "#d4944a"],
    "skin-minuit":     ["#5a7aa0", "#bfcde0", "#8aa5c4", "#e0e8f0"],
    "skin-ocean":      ["#009688", "#00e5cc", "#64ffda", "#1de9b6"],
    "skin-lavande":    ["#b39ddb", "#ce93d8", "#e1bee7", "#9575cd"],
    "skin-cerise":     ["#f48fb1", "#f06292", "#fce4ec", "#ec407a"],
    "skin-arctique":   ["#b3e5fc", "#81d4fa", "#e1f5fe", "#29b6f6"]
};

// Génère un SVG carré avec 4 formes colorées (cercle, triangle, carré, hexagone)
function generateThemeSVG(skinId) {
    const colors = themeColorPalettes[skinId] || ["#888", "#aaa", "#ccc", "#666"];
    return `<svg viewBox="0 0 40 40" width="40" height="40" xmlns="http://www.w3.org/2000/svg">
        <circle cx="10" cy="10" r="7" fill="${colors[0]}"/>
        <polygon points="30,3 37,17 23,17" fill="${colors[1]}"/>
        <rect x="4" y="23" width="13" height="13" rx="2" fill="${colors[2]}"/>
        <polygon points="30,23 35,26 35,32 30,35 25,32 25,26" fill="${colors[3]}"/>
    </svg>`;
}

function getPaletteSkinId(activeSkinOverride) {
    const rawSkin = String(activeSkinOverride || document.documentElement.getAttribute('data-skin') || 'bleu basique')
        .trim()
        .toLowerCase();

    const aliasMap = {
        'bleu-basique': 'bleu basique',
        'skin-jaune': 'jaune basique'
    };

    const normalizedSkin = aliasMap[rawSkin] || rawSkin;
    if (themeColorPalettes[normalizedSkin]) return normalizedSkin;
    return 'bleu basique';
}

// Génère un aperçu animé de fond dans la palette du thème actif
function generateFondAnimatedPreview(fondId, activeSkinOverride) {
    const skinId = getPaletteSkinId(activeSkinOverride);
    const [c1, c2, c3, c4] = themeColorPalettes[skinId] || ["#4a90e2", "#357abd", "#64b5f6", "#1976d2"];
    const fondKey = String(fondId || 'Vagues').trim().toLowerCase().replace(/\s+/g, '-');

    return `
        <div class="fond-preview fond-preview-${fondKey}" style="--fond-c1:${c1}; --fond-c2:${c2}; --fond-c3:${c3}; --fond-c4:${c4};">
            <span class="fond-layer fond-layer-a"></span>
            <span class="fond-layer fond-layer-b"></span>
            <span class="fond-layer fond-layer-c"></span>
            <span class="fond-dot fond-dot-a"></span>
            <span class="fond-dot fond-dot-b"></span>
        </div>
    `;
}

const LEGACY_SOCIAL_BANNERS = {
    oceanic: 'skin-ocean',
    sunset: 'skin-sunset',
    'neon-grid': 'skin-neon',
    forest: 'skin-foret'
};

const SOCIAL_THEME_LABELS = {
    'bleu basique': 'Bleu Basique',
    'jaune basique': 'Jaune Basique',
    'skin-verdure': 'Verdure',
    'skin-obsidienne': 'Obsidienne Royale',
    'skin-sunset': 'Sunset Lofi',
    'skin-grenat': 'Grenat',
    'skin-rose': 'Rose Pale',
    'skin-neon': 'Neon',
    'skin-chocolat': 'Chocolat Velours',
    'skin-indigo': 'Reve Indigo',
    'skin-marbre': 'Marbre Anthracite',
    'skin-aurore': 'Aurore Boreale',
    'skin-pastel': 'Pastel',
    'skin-cyberpunk': 'Cyberpunk',
    'skin-foret': 'Foret',
    'skin-sable': 'Sable Chaud',
    'skin-minuit': 'Minuit',
    'skin-ocean': 'Ocean',
    'skin-lavande': 'Lavande',
    'skin-cerise': 'Cerise',
    'skin-arctique': 'Arctique'
};

const SOCIAL_THEME_BANNER_DATA = {
    /* ── Vagues + bulles ── */
    'bleu basique': {
        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40"><path d="M0 20Q15 8 30 20T60 20T90 20T120 20" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="2"/><path d="M0 32Q15 20 30 32T60 32T90 32T120 32" fill="none" stroke="rgba(255,255,255,0.14)" stroke-width="1.5"/><circle cx="50" cy="10" r="3" fill="rgba(255,255,255,0.18)"/><circle cx="100" cy="5" r="2" fill="rgba(255,255,255,0.13)"/><circle cx="15" cy="6" r="1.5" fill="rgba(255,255,255,0.1)"/></svg>`,
        gradient: 'linear-gradient(to bottom, #0a2d6e 0%, #1a5cb5 50%, #68c0ea 100%)'
    },
    /* ── Soleil + rayons ── */
    'jaune basique': {
        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="150"><circle cx="150" cy="80" r="28" fill="rgba(255,245,200,0.55)"/><circle cx="150" cy="80" r="40" fill="none" stroke="rgba(255,245,200,0.15)" stroke-width="1" stroke-dasharray="4 6"/><g stroke="rgba(255,245,180,0.3)" stroke-width="1.5"><line x1="150" y1="20" x2="150" y2="40"/><line x1="150" y1="120" x2="150" y2="140"/><line x1="90" y1="80" x2="110" y2="80"/><line x1="190" y1="80" x2="210" y2="80"/><line x1="108" y1="38" x2="122" y2="52"/><line x1="178" y1="108" x2="192" y2="122"/><line x1="192" y1="38" x2="178" y2="52"/><line x1="122" y1="108" x2="108" y2="122"/></g><ellipse cx="60" cy="115" rx="30" ry="8" fill="rgba(255,230,130,0.12)"/><ellipse cx="245" cy="105" rx="25" ry="6" fill="rgba(255,230,130,0.1)"/></svg>`,
        size: 'cover',
        gradient: 'linear-gradient(to bottom, #ffe580 0%, #ffce44 40%, #ffb700 100%)'
    },
    /* ── Feuilles + tiges ── */
    'skin-verdure': {
        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="80"><ellipse cx="35" cy="30" rx="13" ry="5" transform="rotate(-35 35 30)" fill="rgba(160,230,140,0.22)"/><line x1="35" y1="30" x2="22" y2="39" stroke="rgba(100,180,80,0.2)" stroke-width="1"/><ellipse cx="100" cy="20" rx="15" ry="5" transform="rotate(25 100 20)" fill="rgba(160,230,140,0.19)"/><line x1="100" y1="20" x2="88" y2="29" stroke="rgba(100,180,80,0.18)" stroke-width="1"/><ellipse cx="70" cy="58" rx="11" ry="4" transform="rotate(-20 70 58)" fill="rgba(160,230,140,0.16)"/><line x1="70" y1="58" x2="60" y2="65" stroke="rgba(100,180,80,0.15)" stroke-width="1"/><circle cx="120" cy="70" r="1.5" fill="rgba(200,255,180,0.15)"/><circle cx="15" cy="65" r="2" fill="rgba(200,255,180,0.12)"/></svg>`,
        gradient: 'linear-gradient(140deg, #142e1a 0%, #2a5e32 45%, #72b55e 100%)'
    },
    /* ── Diamants / cristaux ── */
    'skin-obsidienne': {
        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="80"><polygon points="50,5 65,25 50,45 35,25" fill="none" stroke="rgba(180,140,255,0.16)" stroke-width="1"/><line x1="50" y1="5" x2="50" y2="45" stroke="rgba(180,140,255,0.08)" stroke-width="0.5"/><line x1="35" y1="25" x2="65" y2="25" stroke="rgba(180,140,255,0.08)" stroke-width="0.5"/><polygon points="20,40 32,55 20,70 8,55" fill="none" stroke="rgba(180,140,255,0.1)" stroke-width="0.8"/><polygon points="80,40 92,55 80,70 68,55" fill="none" stroke="rgba(180,140,255,0.1)" stroke-width="0.8"/><circle cx="50" cy="25" r="2" fill="rgba(200,170,255,0.3)"/><circle cx="85" cy="10" r="1" fill="rgba(200,170,255,0.2)"/><circle cx="15" cy="12" r="1.5" fill="rgba(200,170,255,0.15)"/></svg>`,
        gradient: 'linear-gradient(125deg, #0e0e1a 0%, #2a1854 52%, #7040b0 100%)'
    },
    /* ── Coucher de soleil + nuages ── */
    'skin-sunset': {
        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="180"><circle cx="200" cy="105" r="35" fill="rgba(255,220,100,0.6)"/><circle cx="200" cy="105" r="48" fill="rgba(255,200,80,0.12)"/><rect x="0" y="108" width="400" height="72" fill="rgba(80,50,140,0.45)"/><ellipse cx="100" cy="48" rx="40" ry="12" fill="rgba(255,200,150,0.15)"/><ellipse cx="310" cy="62" rx="48" ry="11" fill="rgba(255,180,140,0.12)"/><ellipse cx="80" cy="72" rx="28" ry="8" fill="rgba(255,190,160,0.1)"/><ellipse cx="260" cy="40" rx="20" ry="6" fill="rgba(255,210,170,0.08)"/></svg>`,
        size: 'cover',
        gradient: 'linear-gradient(to bottom, #f0c84a 0%, #e88a5a 35%, #cf5c8f 55%, #6b3fa0 75%, #2a2070 100%)'
    },
    /* ── Facettes de grenat ── */
    'skin-grenat': {
        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="70"><polygon points="40,5 55,20 50,40 30,40 25,20" fill="none" stroke="rgba(255,100,130,0.18)" stroke-width="1"/><polygon points="40,5 50,40 30,40" fill="rgba(255,100,130,0.06)"/><line x1="40" y1="5" x2="40" y2="40" stroke="rgba(255,130,150,0.08)" stroke-width="0.5"/><polygon points="15,45 30,55 25,68 10,65 5,52" fill="none" stroke="rgba(255,120,150,0.12)" stroke-width="0.8"/><polygon points="60,42 75,52 70,65 55,62 50,50" fill="none" stroke="rgba(255,120,150,0.12)" stroke-width="0.8"/><circle cx="40" cy="22" r="2" fill="rgba(255,200,220,0.35)"/></svg>`,
        gradient: 'linear-gradient(120deg, #3a0015 0%, #8a0030 48%, #d22058 100%)'
    },
    /* ── Fleurs de sakura ── */
    'skin-rose': {
        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"><ellipse cx="30" cy="25" rx="8" ry="4" transform="rotate(-30 30 25)" fill="rgba(255,200,220,0.25)"/><ellipse cx="38" cy="22" rx="8" ry="4" transform="rotate(30 38 22)" fill="rgba(255,200,220,0.22)"/><ellipse cx="34" cy="18" rx="8" ry="4" transform="rotate(90 34 18)" fill="rgba(255,200,220,0.2)"/><circle cx="34" cy="22" r="2.5" fill="rgba(255,150,180,0.35)"/><ellipse cx="112" cy="55" rx="7" ry="3.5" transform="rotate(-40 112 55)" fill="rgba(255,200,220,0.2)"/><ellipse cx="118" cy="52" rx="7" ry="3.5" transform="rotate(20 118 52)" fill="rgba(255,200,220,0.18)"/><circle cx="115" cy="53" r="2" fill="rgba(255,150,180,0.28)"/><ellipse cx="75" cy="75" rx="5" ry="2.5" transform="rotate(15 75 75)" fill="rgba(255,200,220,0.13)"/><ellipse cx="142" cy="18" rx="4" ry="2" transform="rotate(-50 142 18)" fill="rgba(255,200,220,0.1)"/></svg>`,
        gradient: 'linear-gradient(120deg, #5a0c2a 0%, #b0286a 50%, #ff80a8 100%)'
    },
    /* ── Grille néon + noeuds lumineux ── */
    'skin-neon': {
        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="80"><line x1="0" y1="40" x2="100" y2="40" stroke="rgba(0,255,200,0.12)" stroke-width="0.5"/><line x1="50" y1="0" x2="50" y2="80" stroke="rgba(0,255,200,0.12)" stroke-width="0.5"/><circle cx="50" cy="40" r="5" fill="rgba(255,240,70,0.35)"/><circle cx="50" cy="40" r="9" fill="none" stroke="rgba(255,240,70,0.1)" stroke-width="0.5"/><circle cx="0" cy="0" r="4" fill="rgba(255,90,200,0.3)"/><circle cx="100" cy="80" r="4" fill="rgba(80,160,255,0.3)"/><circle cx="0" cy="80" r="3" fill="rgba(0,255,200,0.25)"/><circle cx="100" cy="0" r="3" fill="rgba(0,255,200,0.25)"/><rect x="22" y="35" width="6" height="6" rx="1" fill="none" stroke="rgba(255,90,200,0.15)" stroke-width="0.5"/><polygon points="72,38 76,40 72,42 68,40" fill="rgba(80,160,255,0.2)"/></svg>`,
        extraLayers: 'repeating-linear-gradient(90deg, transparent 0 48px, rgba(0,255,180,0.05) 48px 50px, transparent 50px 100px), repeating-linear-gradient(0deg, transparent 0 38px, rgba(0,255,180,0.05) 38px 40px, transparent 40px 80px)',
        gradient: 'linear-gradient(120deg, #06070c 0%, #111828 100%)'
    },
    /* ── Tablette de chocolat + gouttes ── */
    'skin-chocolat': {
        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect x="10" y="18" width="25" height="18" rx="3" fill="rgba(180,120,60,0.2)" stroke="rgba(140,80,30,0.15)" stroke-width="1"/><rect x="45" y="18" width="25" height="18" rx="3" fill="rgba(180,120,60,0.17)" stroke="rgba(140,80,30,0.13)" stroke-width="1"/><rect x="80" y="18" width="25" height="18" rx="3" fill="rgba(180,120,60,0.15)" stroke="rgba(140,80,30,0.12)" stroke-width="1"/><rect x="10" y="44" width="25" height="18" rx="3" fill="rgba(180,120,60,0.15)" stroke="rgba(140,80,30,0.12)" stroke-width="1"/><rect x="45" y="44" width="25" height="18" rx="3" fill="rgba(180,120,60,0.13)" stroke="rgba(140,80,30,0.1)" stroke-width="1"/><rect x="80" y="44" width="25" height="18" rx="3" fill="rgba(180,120,60,0.11)" stroke="rgba(140,80,30,0.1)" stroke-width="1"/><path d="M22 0Q24 8 20 11Q24 14 22 18L24 0Z" fill="rgba(120,70,20,0.18)"/><path d="M62 0Q65 10 60 13Q64 16 62 20L65 0Z" fill="rgba(120,70,20,0.14)"/><path d="M97 0Q99 6 96 9Q99 12 98 15L100 0Z" fill="rgba(120,70,20,0.11)"/></svg>`,
        gradient: 'linear-gradient(125deg, #2e1808 0%, #5c3018 45%, #8a5530 100%)'
    },
    /* ── Constellation + étoiles ── */
    'skin-indigo': {
        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><circle cx="30" cy="20" r="2" fill="rgba(255,255,255,0.5)"/><circle cx="80" cy="45" r="1.5" fill="rgba(255,255,255,0.4)"/><circle cx="150" cy="15" r="2.5" fill="rgba(255,255,255,0.5)"/><circle cx="120" cy="70" r="1" fill="rgba(255,255,255,0.35)"/><circle cx="50" cy="80" r="1.5" fill="rgba(255,255,255,0.3)"/><circle cx="175" cy="60" r="2" fill="rgba(255,255,255,0.4)"/><circle cx="10" cy="58" r="1" fill="rgba(255,255,255,0.25)"/><circle cx="190" cy="90" r="1" fill="rgba(255,255,255,0.2)"/><line x1="30" y1="20" x2="80" y2="45" stroke="rgba(255,255,255,0.07)" stroke-width="0.5"/><line x1="80" y1="45" x2="120" y2="70" stroke="rgba(255,255,255,0.07)" stroke-width="0.5"/><line x1="150" y1="15" x2="175" y2="60" stroke="rgba(255,255,255,0.06)" stroke-width="0.5"/><polygon points="150,9 151.8,13 156,13.5 152.5,16 153.8,20.2 150,17.5 146.2,20.2 147.5,16 144,13.5 148.2,13" fill="rgba(255,255,255,0.4)"/></svg>`,
        gradient: 'linear-gradient(125deg, #1a0d3a 0%, #382068 50%, #6a48b0 100%)'
    },
    /* ── Veines de marbre ── */
    'skin-marbre': {
        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><path d="M0 50Q30 20 60 55Q90 85 120 40Q150 10 180 45Q200 65 200 50" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="1.5"/><path d="M0 30Q40 60 80 25Q110 5 140 35Q170 60 200 30" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="1"/><path d="M0 70Q25 50 50 72Q80 92 110 65Q140 45 170 72Q190 82 200 68" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="2"/><circle cx="60" cy="55" r="1.5" fill="rgba(255,255,255,0.15)"/><circle cx="140" cy="35" r="1.5" fill="rgba(255,255,255,0.12)"/><circle cx="25" cy="40" r="1" fill="rgba(255,255,255,0.1)"/></svg>`,
        gradient: 'linear-gradient(115deg, #2a2c34 0%, #454a56 45%, #7a818e 100%)'
    },
    /* ── Aurore boréale (rideaux) ── */
    'skin-aurore': {
        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="120"><path d="M0 30Q50 10 100 35Q150 60 200 25Q250 5 300 30L300 50Q250 25 200 45Q150 75 100 50Q50 25 0 50Z" fill="rgba(16,216,159,0.15)"/><path d="M0 50Q60 30 120 55Q180 80 240 45Q280 25 300 55L300 70Q280 42 240 60Q180 90 120 65Q60 42 0 65Z" fill="rgba(126,91,255,0.12)"/><path d="M0 70Q40 55 80 72Q130 92 180 65Q230 45 300 72L300 85Q230 60 180 78Q130 100 80 82Q40 68 0 82Z" fill="rgba(0,200,180,0.1)"/><circle cx="50" cy="15" r="1" fill="rgba(255,255,255,0.3)"/><circle cx="180" cy="20" r="1.5" fill="rgba(255,255,255,0.25)"/><circle cx="260" cy="10" r="1" fill="rgba(255,255,255,0.2)"/></svg>`,
        size: 'cover',
        gradient: 'linear-gradient(to bottom, #071820 0%, #0a3540 40%, #0d4a48 70%, #1a3060 100%)'
    },
    /* ── Bulles pastel ── */
    'skin-pastel': {
        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="100"><circle cx="30" cy="30" r="18" fill="rgba(255,180,210,0.22)"/><circle cx="30" cy="30" r="18" fill="none" stroke="rgba(255,180,210,0.15)" stroke-width="1"/><circle cx="100" cy="60" r="22" fill="rgba(180,210,255,0.2)"/><circle cx="100" cy="60" r="22" fill="none" stroke="rgba(180,210,255,0.12)" stroke-width="1"/><circle cx="155" cy="25" r="14" fill="rgba(200,240,220,0.22)"/><circle cx="155" cy="25" r="14" fill="none" stroke="rgba(200,240,220,0.15)" stroke-width="1"/><circle cx="65" cy="85" r="10" fill="rgba(230,200,255,0.17)"/><circle cx="140" cy="82" r="8" fill="rgba(255,220,200,0.14)"/><circle cx="24" cy="24" r="3" fill="rgba(255,255,255,0.3)"/><circle cx="92" cy="52" r="2.5" fill="rgba(255,255,255,0.25)"/></svg>`,
        gradient: 'linear-gradient(130deg, #ffd8e8 0%, #c9f3e7 48%, #d6d9ff 100%)'
    },
    /* ── Circuits cyberpunk ── */
    'skin-cyberpunk': {
        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="80"><path d="M0 20L30 20L40 10L70 10L80 20L100 20" fill="none" stroke="rgba(0,200,255,0.22)" stroke-width="1"/><path d="M50 55L70 55L80 45L110 45L120 55L150 55" fill="none" stroke="rgba(255,50,170,0.2)" stroke-width="1"/><path d="M0 68L20 68L28 58L50 58" fill="none" stroke="rgba(0,200,255,0.14)" stroke-width="1"/><path d="M100 72L120 72L130 62L150 62" fill="none" stroke="rgba(255,50,170,0.14)" stroke-width="1"/><circle cx="40" cy="10" r="3" fill="rgba(0,200,255,0.35)"/><circle cx="80" cy="45" r="3" fill="rgba(255,50,170,0.3)"/><circle cx="30" cy="20" r="1.5" fill="rgba(0,255,200,0.25)"/><circle cx="120" cy="55" r="2" fill="rgba(255,255,0,0.22)"/><rect x="95" y="15" width="5" height="5" fill="rgba(0,200,255,0.22)"/><rect x="22" y="50" width="4" height="4" fill="rgba(255,50,170,0.2)"/></svg>`,
        gradient: 'linear-gradient(130deg, #0d0218 0%, #380a5a 40%, #00a0d0 70%, #e02890 100%)'
    },
    /* ── Sapins / forêt ── */
    'skin-foret': {
        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120"><polygon points="30,120 42,50 54,120" fill="rgba(20,60,30,0.4)"/><polygon points="36,120 42,62 48,120" fill="rgba(35,90,45,0.25)"/><rect x="40" y="110" width="4" height="10" fill="rgba(80,50,20,0.25)"/><polygon points="80,120 95,28 110,120" fill="rgba(20,60,30,0.5)"/><polygon points="88,120 95,42 102,120" fill="rgba(35,90,45,0.3)"/><rect x="93" y="110" width="4" height="10" fill="rgba(80,50,20,0.3)"/><polygon points="145,120 155,55 165,120" fill="rgba(25,70,35,0.35)"/><polygon points="150,120 155,68 160,120" fill="rgba(35,85,45,0.2)"/><polygon points="185,120 192,70 199,120" fill="rgba(20,55,28,0.3)"/><polygon points="0,120 8,75 16,120" fill="rgba(20,55,28,0.25)"/><circle cx="125" cy="20" r="1.5" fill="rgba(200,255,200,0.2)"/><circle cx="60" cy="15" r="1" fill="rgba(200,255,200,0.15)"/></svg>`,
        size: 'cover',
        position: 'center bottom',
        gradient: 'linear-gradient(to bottom, #1a3324 0%, #2a5038 50%, #6a9a6f 100%)'
    },
    /* ── Dunes de sable ── */
    'skin-sable': {
        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="120"><path d="M0 80Q50 50 100 75Q150 95 200 65Q250 40 300 70L300 120L0 120Z" fill="rgba(200,160,80,0.2)"/><path d="M0 95Q60 70 120 90Q180 108 240 85Q270 70 300 88L300 120L0 120Z" fill="rgba(180,140,60,0.15)"/><path d="M0 60Q40 40 80 58Q130 78 180 50Q230 30 300 55L300 65Q230 40 180 58Q130 82 80 62Q40 48 0 68Z" fill="rgba(240,210,140,0.1)"/><circle cx="240" cy="25" r="18" fill="rgba(255,240,200,0.2)"/><circle cx="50" cy="40" r="1" fill="rgba(255,240,200,0.2)"/><circle cx="150" cy="35" r="1.5" fill="rgba(255,240,200,0.15)"/></svg>`,
        size: 'cover',
        gradient: 'linear-gradient(to bottom, #b08840 0%, #c49a48 40%, #e8c878 80%, #f0d88a 100%)'
    },
    /* ── Lune + étoiles ── */
    'skin-minuit': {
        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="130"><circle cx="58" cy="42" r="20" fill="rgba(200,215,245,0.25)"/><circle cx="66" cy="36" r="16" fill="rgb(7,13,36)"/><polygon points="200,36 201.8,40 205.5,40 202.5,42.5 203.5,46 200,43.5 196.5,46 197.5,42.5 194.5,40 198.2,40" fill="rgba(255,255,255,0.45)"/><polygon points="130,22 131.2,24.8 134.2,25 131.8,27 132.5,30 130,28 127.5,30 128.2,27 125.8,25 128.8,24.8" fill="rgba(255,255,255,0.38)"/><circle cx="260" cy="20" r="1.5" fill="rgba(255,255,255,0.4)"/><circle cx="90" cy="68" r="1" fill="rgba(255,255,255,0.35)"/><circle cx="170" cy="82" r="1.5" fill="rgba(255,255,255,0.3)"/><circle cx="40" cy="92" r="1" fill="rgba(255,255,255,0.25)"/><circle cx="230" cy="72" r="1" fill="rgba(255,255,255,0.3)"/><circle cx="280" cy="88" r="1.5" fill="rgba(255,255,255,0.2)"/><circle cx="115" cy="50" r="1" fill="rgba(255,255,255,0.22)"/><circle cx="155" cy="105" r="1" fill="rgba(255,255,255,0.18)"/></svg>`,
        size: 'cover',
        gradient: 'linear-gradient(to bottom, #060d24 0%, #152050 50%, #2a4080 85%, #4a6098 100%)'
    },
    /* ── Vagues océan + poisson ── */
    'skin-ocean': {
        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><path d="M0 25Q25 10 50 25T100 25T150 25T200 25" fill="none" stroke="rgba(100,230,220,0.22)" stroke-width="2"/><path d="M0 45Q30 30 60 45T120 45T180 45" fill="none" stroke="rgba(80,200,200,0.16)" stroke-width="1.5"/><path d="M0 65Q20 55 40 65T80 65T120 65T160 65T200 65" fill="none" stroke="rgba(60,180,180,0.1)" stroke-width="1"/><ellipse cx="140" cy="55" rx="8" ry="4" fill="rgba(100,220,210,0.22)"/><polygon points="150,55 157,50 157,60" fill="rgba(100,220,210,0.22)"/><circle cx="136" cy="54" r="1" fill="rgba(255,255,255,0.35)"/><circle cx="50" cy="80" r="2.5" fill="rgba(100,220,210,0.12)"/><circle cx="80" cy="90" r="1.5" fill="rgba(100,220,210,0.1)"/><circle cx="30" cy="86" r="1" fill="rgba(100,220,210,0.08)"/></svg>`,
        gradient: 'linear-gradient(to bottom, #003847 0%, #016a80 40%, #00a5a0 72%, #60e0cc 100%)'
    },
    /* ── Tiges de lavande ── */
    'skin-lavande': {
        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><line x1="25" y1="120" x2="28" y2="40" stroke="rgba(140,100,180,0.22)" stroke-width="1.5"/><circle cx="28" cy="40" r="3.5" fill="rgba(170,130,210,0.25)"/><circle cx="27" cy="33" r="3" fill="rgba(170,130,210,0.22)"/><circle cx="29" cy="27" r="2.5" fill="rgba(170,130,210,0.2)"/><circle cx="28" cy="22" r="2" fill="rgba(170,130,210,0.17)"/><line x1="60" y1="120" x2="57" y2="48" stroke="rgba(140,100,180,0.18)" stroke-width="1.5"/><circle cx="57" cy="48" r="3.5" fill="rgba(170,130,210,0.22)"/><circle cx="58" cy="41" r="3" fill="rgba(170,130,210,0.2)"/><circle cx="57" cy="35" r="2.5" fill="rgba(170,130,210,0.17)"/><line x1="95" y1="120" x2="93" y2="55" stroke="rgba(140,100,180,0.15)" stroke-width="1"/><circle cx="93" cy="55" r="3" fill="rgba(170,130,210,0.18)"/><circle cx="94" cy="49" r="2.5" fill="rgba(170,130,210,0.15)"/><circle cx="93" cy="44" r="2" fill="rgba(170,130,210,0.12)"/></svg>`,
        gradient: 'linear-gradient(128deg, #2a204a 0%, #5a3d8a 50%, #a882d6 100%)'
    },
    /* ── Coeurs / cerises ── */
    'skin-cerise': {
        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="80"><path d="M30 28C30 20 20 18 20 25C20 32 30 40 30 40C30 40 40 32 40 25C40 18 30 20 30 28Z" fill="rgba(255,140,180,0.24)"/><path d="M100 50C100 42 90 40 90 47C90 54 100 62 100 62C100 62 110 54 110 47C110 40 100 42 100 50Z" fill="rgba(255,140,180,0.18)"/><path d="M68 15C68 10 62 9 62 13C62 17 68 21 68 21C68 21 74 17 74 13C74 9 68 10 68 15Z" fill="rgba(255,160,190,0.14)"/><circle cx="50" cy="62" r="6" fill="rgba(200,30,80,0.2)"/><circle cx="58" cy="60" r="6" fill="rgba(200,30,80,0.18)"/><path d="M54 62Q54 54 52 46" stroke="rgba(100,60,40,0.15)" fill="none" stroke-width="1"/><circle cx="122" cy="20" r="1.5" fill="rgba(255,200,210,0.2)"/></svg>`,
        gradient: 'linear-gradient(128deg, #4a0f25 0%, #8a2550 50%, #e878a0 100%)'
    },
    /* ── Flocons de neige ── */
    'skin-arctique': {
        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="100"><g stroke="rgba(255,255,255,0.22)" stroke-width="1" transform="translate(40,30)"><line x1="0" y1="-12" x2="0" y2="12"/><line x1="-10" y1="-6" x2="10" y2="6"/><line x1="-10" y1="6" x2="10" y2="-6"/><line x1="-3" y1="-10" x2="3" y2="-10"/><line x1="-3" y1="10" x2="3" y2="10"/><line x1="-8" y1="-2" x2="-8" y2="2"/><line x1="8" y1="-2" x2="8" y2="2"/></g><g stroke="rgba(255,255,255,0.16)" stroke-width="0.8" transform="translate(120,68)"><line x1="0" y1="-10" x2="0" y2="10"/><line x1="-8" y1="-5" x2="8" y2="5"/><line x1="-8" y1="5" x2="8" y2="-5"/><line x1="-2.5" y1="-8" x2="2.5" y2="-8"/><line x1="-2.5" y1="8" x2="2.5" y2="8"/></g><g stroke="rgba(255,255,255,0.12)" stroke-width="0.7" transform="translate(85,18)"><line x1="0" y1="-8" x2="0" y2="8"/><line x1="-7" y1="-4" x2="7" y2="4"/><line x1="-7" y1="4" x2="7" y2="-4"/></g><circle cx="20" cy="72" r="2" fill="rgba(255,255,255,0.16)"/><circle cx="145" cy="30" r="1.5" fill="rgba(255,255,255,0.13)"/><circle cx="70" cy="82" r="1" fill="rgba(255,255,255,0.1)"/></svg>`,
        gradient: 'linear-gradient(128deg, #0a2548 0%, #1d5888 45%, #78c8f0 100%)'
    }
};

const _bannerBgCache = {};
function _buildBannerBackground(themeId) {
    if (_bannerBgCache[themeId]) return _bannerBgCache[themeId];
    const data = SOCIAL_THEME_BANNER_DATA[themeId];
    if (!data) return null;
    const encoded = 'url("data:image/svg+xml,' + encodeURIComponent(data.svg) + '")';
    const sizeHint = data.size ? ' center/' + data.size + ' no-repeat' : '';
    const posHint = data.position && !data.size ? ' ' + data.position + ' no-repeat' : '';
    const svgLayer = encoded + sizeHint + posHint;
    const layers = [svgLayer];
    if (data.extraLayers) layers.push(data.extraLayers);
    layers.push(data.gradient);
    _bannerBgCache[themeId] = layers.join(', ');
    return _bannerBgCache[themeId];
}

function normalizeSocialBannerThemeId(rawThemeId) {
    const candidate = String(rawThemeId || '').trim().toLowerCase();
    if (!candidate) return '';
    if (LEGACY_SOCIAL_BANNERS[candidate]) return LEGACY_SOCIAL_BANNERS[candidate];
    if (candidate === 'bleu-basique') return 'bleu basique';
    if (candidate === 'skin-jaune') return 'jaune basique';
    if (SOCIAL_THEME_BANNER_DATA[candidate]) return candidate;
    return '';
}

function getOwnedBannerThemes(ownedSkins) {
    const rawSkins = Array.isArray(ownedSkins) ? ownedSkins : [];
    const normalizedSkins = rawSkins
        .map(normalizeSocialBannerThemeId)
        .filter(Boolean);
    const unique = Array.from(new Set(normalizedSkins));
    if (unique.length === 0) unique.push('bleu basique');
    return unique;
}

function getSafeSocialBannerTheme(themeId, ownedSkins) {
    const ownedThemes = getOwnedBannerThemes(ownedSkins || window.__moncompteOwnedSkins || []);
    const normalized = normalizeSocialBannerThemeId(themeId);
    if (normalized && ownedThemes.includes(normalized)) return normalized;
    return ownedThemes[0] || 'bleu basique';
}

function getSocialBannerBackground(themeId) {
    const safeTheme = normalizeSocialBannerThemeId(themeId) || 'bleu basique';
    return _buildBannerBackground(safeTheme) || _buildBannerBackground('bleu basique');
}

function buildSocialBannerLabel(themeId) {
    const safeTheme = normalizeSocialBannerThemeId(themeId) || 'bleu basique';
    return SOCIAL_THEME_LABELS[safeTheme] || safeTheme;
}

function populateSocialBannerSelector(selectElement, ownedSkins, selectedThemeId) {
    if (!selectElement) return;
    const options = getOwnedBannerThemes(ownedSkins);
    const selected = getSafeSocialBannerTheme(selectedThemeId, options);

    selectElement.innerHTML = '';
    options.forEach((themeId) => {
        const option = document.createElement('option');
        option.value = themeId;
        option.textContent = buildSocialBannerLabel(themeId);
        selectElement.appendChild(option);
    });

    selectElement.value = selected;
}

function renderHeaderBadgesPreview(showcaseBadgeIds, currentBadgeIds) {
    const badgesContainer = document.getElementById('user-current-badges');
    if (!badgesContainer) return;

    const showcase = Array.isArray(showcaseBadgeIds) ? showcaseBadgeIds.filter(Boolean) : [];
    const fallback = Array.isArray(currentBadgeIds) ? currentBadgeIds.filter(Boolean) : [];
    const toRender = (showcase.length > 0 ? showcase : fallback).slice(0, 5);

    badgesContainer.innerHTML = '';
    toRender.forEach((badgeId) => {
        try {
            const badgeIcons = (typeof BADGE_ICONS !== 'undefined')
                ? BADGE_ICONS
                : (window.BADGE_ICONS || null);
            const badge = badgeIcons ? badgeIcons[badgeId] : null;
            if (!badge) return;

            if (badge.type === 'image') {
                const img = document.createElement('img');
                img.src = badge.src;
                img.alt = badge.alt || badgeId;
                img.className = 'user-badge-icon';
                badgesContainer.appendChild(img);
            } else if (badge.type === 'emoji') {
                const span = document.createElement('span');
                span.className = 'user-badge-emoji';
                span.textContent = badge.emoji || '';
                badgesContainer.appendChild(span);
            }
        } catch (e) {
            // ignore badge render errors
        }
    });
}

function applyHeaderSocialBanner(bannerName) {
    const header = document.getElementById('user-profile-header');
    if (!header) return;
    const safeTheme = getSafeSocialBannerTheme(bannerName);
    header.style.setProperty('--header-social-banner', getSocialBannerBackground(safeTheme));
}

function buildShopRarityBadge(type, itemId) {
    const rarityMap = {
        skin: {
            'bleu basique': 'commun', 'jaune basique': 'commun',
            'skin-verdure': 'commun', 'skin-grenat': 'commun', 'skin-chocolat': 'commun', 'skin-sable': 'commun',
            'skin-rose': 'rare', 'skin-foret': 'rare', 'skin-lavande': 'rare', 'skin-ocean': 'rare',
            'skin-marbre': 'epique', 'skin-indigo': 'epique', 'skin-neon': 'epique', 'skin-minuit': 'epique', 'skin-cerise': 'epique', 'skin-arctique': 'epique',
            'skin-obsidienne': 'legendaire', 'skin-sunset': 'legendaire', 'skin-aurore': 'legendaire', 'skin-pastel': 'legendaire',
            'skin-cyberpunk': 'mythique'
        },
        fond: {
            'Vagues': 'commun', 'vagues-inversees': 'rare', 'lineaire': 'rare', 'ondes': 'rare',
            'crumpled-paper': 'epique', 'duel': 'epique', 'pixel-art': 'legendaire', 'aurora': 'mythique'
        }
    };

    const rarity = (rarityMap[type] && rarityMap[type][itemId]) || 'commun';
    const labelMap = {
        commun: 'Commun',
        rare: 'Rare',
        epique: 'Epique',
        legendaire: 'Legendaire',
        mythique: 'Mythique'
    };
    return `<span class="shop-item-rarity rarity-${rarity}">${labelMap[rarity] || 'Commun'}</span>`;
}

function setupModalAccessibility() {
    const focusableSelectors = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    document.querySelectorAll('.modal-overlay').forEach((modal) => {
        if (modal.dataset.a11yReady === 'true') return;
        modal.dataset.a11yReady = 'true';

        if (!modal.hasAttribute('role')) modal.setAttribute('role', 'dialog');
        if (!modal.hasAttribute('aria-modal')) modal.setAttribute('aria-modal', 'true');
        if (!modal.hasAttribute('tabindex')) modal.setAttribute('tabindex', '-1');

        const observer = new MutationObserver(() => {
            if (!modal.classList.contains('active')) return;
            const firstFocusable = modal.querySelector(focusableSelectors);
            if (firstFocusable) firstFocusable.focus();
            else modal.focus();
        });

        observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
    });

    if (!document.body.dataset.modalA11yHandler) {
        document.body.dataset.modalA11yHandler = 'true';
        document.addEventListener('keydown', (e) => {
            const openModals = Array.from(document.querySelectorAll('.modal-overlay.active'));
            if (openModals.length === 0) return;

            const activeModal = openModals[openModals.length - 1];
            if (e.key === 'Escape') {
                const closeBtn = activeModal.querySelector('.close-modal-btn');
                if (closeBtn) closeBtn.click();
                else activeModal.classList.remove('active');
                return;
            }

            if (e.key !== 'Tab') return;
            const focusables = Array.from(activeModal.querySelectorAll(focusableSelectors));
            if (focusables.length === 0) {
                e.preventDefault();
                activeModal.focus();
                return;
            }

            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        });
    }
}

function renderSocialBannerPreview(bannerName) {
    const safeTheme = getSafeSocialBannerTheme(bannerName);
    const background = getSocialBannerBackground(safeTheme);
    const targets = [
        document.getElementById('social-banner-preview'),
        document.getElementById('profile-summary-banner')
    ].filter(Boolean);

    targets.forEach((preview) => {
        preview.style.setProperty('--social-banner-bg', background);
        preview.style.background = background;
    });

    applyHeaderSocialBanner(safeTheme);
}

function renderSocialBadgeShowcase(badgeIds) {
    const list = Array.isArray(badgeIds) ? badgeIds.slice(0, 3) : [];

    const renderIn = (container) => {
        if (!container) return;
        container.innerHTML = '';

        if (list.length === 0) {
            container.innerHTML = '<span class="social-badge-pill">Aucun badge epingle</span>';
            return;
        }

        list.forEach((badgeId) => {
            const badge = (typeof BADGE_ICONS !== 'undefined' && BADGE_ICONS[badgeId]) ? BADGE_ICONS[badgeId] : null;
            const info = (typeof BADGE_DESCRIPTIONS !== 'undefined' && BADGE_DESCRIPTIONS[badgeId]) ? BADGE_DESCRIPTIONS[badgeId] : null;
            const label = info ? info.name : badgeId;
            const pill = document.createElement('span');
            pill.className = 'social-badge-pill';
            if (badge && badge.type === 'emoji') pill.textContent = `${badge.emoji || '🏅'} ${label}`;
            else pill.textContent = `🏅 ${label}`;
            container.appendChild(pill);
        });
    };

    renderIn(document.getElementById('social-badge-showcase'));
    renderIn(document.getElementById('profile-summary-badges'));
    renderHeaderBadgesPreview(list, window.__moncompteBadgesCurrent || []);
}

function populateBadgeShowcaseSelectors(availableBadges, selectedBadges) {
    const slots = [
        document.getElementById('social-badge-slot-1'),
        document.getElementById('social-badge-slot-2'),
        document.getElementById('social-badge-slot-3')
    ];

    const choices = Array.isArray(availableBadges) ? availableBadges : [];
    const selected = Array.isArray(selectedBadges) ? selectedBadges : [];

    slots.forEach((slot, index) => {
        if (!slot) return;
        slot.innerHTML = '<option value="">Aucun</option>';

        choices.forEach((badgeId) => {
            const info = (typeof BADGE_DESCRIPTIONS !== 'undefined' && BADGE_DESCRIPTIONS[badgeId]) ? BADGE_DESCRIPTIONS[badgeId] : null;
            const option = document.createElement('option');
            option.value = badgeId;
            option.textContent = info ? info.name : badgeId;
            slot.appendChild(option);
        });

        slot.value = selected[index] || '';
    });
}

function initSocialProfilePanel() {
    const bannerSelect = document.getElementById('social-banner-select');
    const saveBannerBtn = document.getElementById('save-social-banner-btn');
    const saveShowcaseBtn = document.getElementById('save-social-showcase-btn');
    const slot1 = document.getElementById('social-badge-slot-1');
    const slot2 = document.getElementById('social-badge-slot-2');
    const slot3 = document.getElementById('social-badge-slot-3');

    if (saveBannerBtn && bannerSelect) {
        saveBannerBtn.addEventListener('click', async () => {
            const selectedBanner = getSafeSocialBannerTheme(bannerSelect.value);
            renderSocialBannerPreview(selectedBanner);
            await saveSocialProfile({ banner: selectedBanner });
        });

        bannerSelect.addEventListener('change', () => {
            const selectedBanner = getSafeSocialBannerTheme(bannerSelect.value);
            renderSocialBannerPreview(selectedBanner);
        });
    }

    if (saveShowcaseBtn && slot1 && slot2 && slot3) {
        saveShowcaseBtn.addEventListener('click', async () => {
            const showcase = [slot1.value, slot2.value, slot3.value].filter(Boolean);
            renderSocialBadgeShowcase(showcase);

            const selectedBanner = getSafeSocialBannerTheme(bannerSelect && bannerSelect.value);

            await saveSocialProfile({
                banner: selectedBanner,
                badge_showcase: showcase
            });
        });

        const refreshLiveShowcase = () => {
            const showcase = [slot1.value, slot2.value, slot3.value].filter(Boolean);
            renderSocialBadgeShowcase(showcase);
        };
        slot1.addEventListener('change', refreshLiveShowcase);
        slot2.addEventListener('change', refreshLiveShowcase);
        slot3.addEventListener('change', refreshLiveShowcase);
    }
}

async function saveSocialProfile(payload) {
    const username = localStorage.getItem('source_username');
    if (!username) return;

    try {
        const response = await fetch('/api/user-social-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username,
                socialProfile: {
                    status: payload.status || '',
                    banner: getSafeSocialBannerTheme(payload.banner),
                    badge_showcase: Array.isArray(payload.badge_showcase) ? payload.badge_showcase : undefined
                }
            })
        });

        if (!response.ok) {
            await showModal('Impossible de sauvegarder le profil social pour le moment.');
        }
    } catch (error) {
        console.error('Erreur sauvegarde social profile:', error);
    }
}

function getUserColorStorageKey(username) {
    return `AS_USER_COLOR_${username}`;
}

function applyHeaderColor(color) {
    const headerEl = document.getElementById('user-profile-header');
    if (!headerEl || !color) return;
    headerEl.style.background = color;
    headerEl.style.backgroundImage = 'none';

    // Forcer un rendu lisible (texte blanc + éclat noir) quel que soit le fond
    headerEl.style.setProperty('--header-text', '#ffffff');
    headerEl.style.setProperty('--header-muted', 'rgba(255,255,255,0.85)');
    headerEl.style.setProperty('--header-text-shadow', '0 0 2px rgba(0,0,0,0.95), 0 0 10px rgba(0,0,0,0.65), 0 2px 14px rgba(0,0,0,0.55)');
}

// Fonction d'initialisation appelée depuis script.js quand la page se charge
function initMonComptePage() {
    console.log('Mon Compte - Initialisation');
    console.log('=== INIT MONCOMPTE PAGE ===');

    // Charger les informations utilisateur
    loadUserInfo();

    // Initialiser le modal des infos du compte
    initAccountInfoModal();

    // Initialiser le modal des badges
    initBadgesModal();

    // Initialiser le modal de l'inventaire
    initInventoryModal();

    // Initialiser le modal de la boutique
    initShopModal();

    // Accessibilite clavier et focus des modals
    setupModalAccessibility();

    // Profil social (banniere, statut, vitrine)
    initSocialProfilePanel();

    // Modal "Modifier profil"
    const openProfileEditorBtn = document.getElementById('open-profile-editor-btn');
    const profileEditorModal = document.getElementById('profile-editor-modal');
    const closeProfileEditorBtn = document.getElementById('close-profile-editor-btn');

    if (openProfileEditorBtn && profileEditorModal) {
        openProfileEditorBtn.addEventListener('click', () => {
            profileEditorModal.classList.add('active');
        });
    }

    if (closeProfileEditorBtn && profileEditorModal) {
        closeProfileEditorBtn.addEventListener('click', () => {
            profileEditorModal.classList.remove('active');
        });
    }

    if (profileEditorModal) {
        profileEditorModal.addEventListener('click', (e) => {
            if (e.target === profileEditorModal) {
                profileEditorModal.classList.remove('active');
            }
        });
    }

    // Éléments du DOM
    // const changeAvatarBtn = document.getElementById('change-avatar-btn'); // Supprimé
    const userAvatarWrapper = document.getElementById('user-avatar-wrapper'); // Nouvelle cible (wrapper)
    const avatarModal = document.getElementById('avatar-modal');
    const closeModalBtn = avatarModal.querySelector('.close-modal-btn');
    const selectAvatarBtn = document.getElementById('select-avatar-btn');
    const validateAvatarBtn = document.getElementById('validate-avatar-btn');
    const avatarFileInput = document.getElementById('avatar-file-input');
    const avatarPreview = document.getElementById('avatar-preview');

    // Variable pour stocker le fichier sélectionné
    let selectedFile = null;

    // Gestionnaire pour ouvrir le modal avatar (au clic sur l'image de profil)
    if (userAvatarWrapper) {
        userAvatarWrapper.addEventListener('click', function() {
            // Recharger l'aperçu actuel avant d'ouvrir
            loadCurrentAvatarPreview();
            avatarModal.classList.add('active');
        });

        userAvatarWrapper.addEventListener('keydown', function(e) {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            loadCurrentAvatarPreview();
            avatarModal.classList.add('active');
        });
    }

    // Gestionnaire pour fermer le modal
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', function() {
            avatarModal.classList.remove('active');
            // Reset du fichier sélectionné
            selectedFile = null;
            avatarFileInput.value = '';
            loadCurrentAvatarPreview();
        });
    }

    // Fermer le modal en cliquant sur l'overlay
    if (avatarModal) {
        avatarModal.addEventListener('click', function(e) {
            if (e.target === avatarModal) {
                avatarModal.classList.remove('active');
                // Reset du fichier sélectionné
                selectedFile = null;
                avatarFileInput.value = '';
                loadCurrentAvatarPreview();
            }
        });
    }

    // Gestionnaire pour le bouton "Sélectionner une photo"
    if (selectAvatarBtn) {
        selectAvatarBtn.addEventListener('click', function() {
            avatarFileInput.click();
        });
    }

    // Gestionnaire pour la sélection de fichier
    if (avatarFileInput) {
        avatarFileInput.addEventListener('change', async function(e) {
            const file = e.target.files[0];
            if (file) {
                // Vérifier que c'est une image
                if (!file.type.startsWith('image/')) {
                    await showModal('Veuillez sélectionner une image valide.');
                    return;
                }

                // Vérifier la taille (max 5MB)
                if (file.size > 5 * 1024 * 1024) {
                    await showModal('L\'image ne doit pas dépasser 5MB.');
                    return;
                }

                selectedFile = file;

                // Prévisualiser l'image sélectionnée
                const reader = new FileReader();
                reader.onload = function(e) {
                    avatarPreview.src = e.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Gestionnaire pour le bouton "Valider"
    if (validateAvatarBtn) {
        validateAvatarBtn.addEventListener('click', async function() {
            console.log('Bouton Valider cliqué');
            
            if (!selectedFile) {
                await showModal('Veuillez d\'abord sélectionner une photo.');
                return;
            }

            console.log('Fichier sélectionné:', selectedFile);

            // Désactiver le bouton pendant l'upload
            validateAvatarBtn.disabled = true;
            validateAvatarBtn.textContent = 'Upload en cours...';

            try {
                const username = localStorage.getItem('source_username') || 'testuser'; // Username de test
                console.log('Username utilisé:', username);

                // Créer FormData pour l'upload
                const formData = new FormData();
                formData.append('username', username);
                formData.append('avatar', selectedFile);

                console.log('Envoi de la requête...');

                // Envoyer au serveur
                const response = await fetch('/public/api/profile/upload-avatar', {
                    method: 'POST',
                    body: formData
                });

                console.log('Réponse brute:', response);
                console.log('Status:', response.status);
                console.log('StatusText:', response.statusText);
                console.log('Headers:', [...response.headers.entries()]);

                const result = await response.json();
                console.log('Résultat parsé:', result);

                if (result.success) {
                    await showModal('Photo de profil mise à jour avec succès !');
                    avatarModal.classList.remove('active');

                    // Recharger la photo de profil dans la page
                    loadUserAvatar();

                    // Mettre à jour le cache des avatars dans toutes les pages
                    if (window.updateAvatarsCache) {
                        window.updateAvatarsCache({ [username]: result.avatarPath });
                    }
                    
                    // Mettre à jour le cache des couleurs si une nouvelle couleur a été extraite
                    if (result.color && window.updateUsersColorsCache) {
                        window.updateUsersColorsCache({ [username]: result.color });
                    }

                    // Appliquer la nouvelle couleur au header si disponible
                    if (result.color) {
                        applyHeaderColor(result.color);
                        try {
                            localStorage.setItem(getUserColorStorageKey(username), result.color);
                        } catch (e) {
                            // ignore storage errors
                        }
                    }

                    // Reset
                    selectedFile = null;
                    avatarFileInput.value = '';

                } else {
                    await showModal('Erreur lors de la mise à jour: ' + result.message);
                }

            } catch (error) {
                console.error('Erreur upload:', error);
                await showModal('Erreur réseau lors de l\'upload.');
            } finally {
                // Réactiver le bouton
                validateAvatarBtn.disabled = false;
                validateAvatarBtn.textContent = 'Valider';
            }
        });
    }

    // Gestionnaire pour le bouton de déconnexion
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', async function() {
            if (await showModal('Êtes-vous sûr de vouloir vous déconnecter ?', { type: 'confirm' })) {
                if (window.logoutAndRedirect) {
                    window.logoutAndRedirect();
                } else {
                    console.error('Fonction logoutAndRedirect non trouvée');
                    // Fallback manuel
                    localStorage.removeItem('source_username');
                    window.location.href = '/pages/login.html';
                }
            }
        });
    }

    // Gestionnaire pour le bouton de déconnexion EcoleDirecte
    const logoutEdButton = document.getElementById('logout-ed-btn');
    if (logoutEdButton) {
        logoutEdButton.addEventListener('click', async function() {
            if (await showModal('Êtes-vous sûr de vouloir vous déconnecter d\'EcoleDirecte ?', { type: 'confirm' })) {
                try {
                    const siteUser = (localStorage.getItem('source_username') || '').trim().toLowerCase();
                    // Vide les caches Cartable (ils sont en localStorage)
                    try {
                        // Legacy
                        localStorage.removeItem('ED_NOTES');
                        localStorage.removeItem('ED_DEVOIRS');
                        localStorage.removeItem('ED_DEV_RANGE');
                        // Par user
                        if (siteUser) {
                            localStorage.removeItem('ED_NOTES:' + siteUser);
                            localStorage.removeItem('ED_DEVOIRS:' + siteUser);
                            localStorage.removeItem('ED_DEV_RANGE:' + siteUser);
                        }
                    } catch {}
                    
                    // Appelle la route de logout ED
                    const siteUserHeader = localStorage.getItem('source_username') || '';
                    await fetch('/ed/logout', {
                        method: 'GET',
                        headers: siteUserHeader ? { 'x-source-user': siteUserHeader } : undefined
                    });
                    
                    await showModal('Déconnecté d\'EcoleDirecte avec succès. Rechargez la page Cartable pour vous reconnecter.');
                } catch (error) {
                    console.error('Erreur lors de la déconnexion ED:', error);
                    await showModal('Erreur lors de la déconnexion');
                }
            }
        });
    }

    // Gestion du modal mot de passe
    const changePasswordBtn = document.getElementById('change-password-btn');
    const passwordModal = document.getElementById('password-modal');
    const passwordCloseModalBtn = passwordModal.querySelector('.close-modal-btn');
    const validatePasswordBtn = document.getElementById('validate-password-btn');

    // Gestionnaire pour ouvrir le modal mot de passe
    if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', function() {
            passwordModal.classList.add('active');
        });
    }

    // Gestionnaire pour fermer le modal mot de passe
    if (passwordCloseModalBtn) {
        passwordCloseModalBtn.addEventListener('click', function() {
            passwordModal.classList.remove('active');
        });
    }

    // Fermer le modal en cliquant sur l'overlay
    if (passwordModal) {
        passwordModal.addEventListener('click', function(e) {
            if (e.target === passwordModal) {
                passwordModal.classList.remove('active');
            }
        });
    }

    // Gestionnaire pour le bouton valider
    if (validatePasswordBtn) {
        validatePasswordBtn.addEventListener('click', async function() {
            const newPassword = document.getElementById('new-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;

            if (!newPassword || !confirmPassword) {
                await showModal('Veuillez remplir tous les champs.');
                return;
            }

            if (newPassword !== confirmPassword) {
                await showModal('Les mots de passe ne correspondent pas.');
                return;
            }

            if (newPassword.length < 3) {
                await showModal('Le mot de passe doit contenir au moins 3 caractères.');
                return;
            }

            // Désactiver le bouton pendant la requête
            validatePasswordBtn.disabled = true;
            validatePasswordBtn.textContent = 'Changement en cours...';

            try {
                const username = localStorage.getItem('source_username');
                if (!username) {
                    await showModal('Utilisateur non connecté.');
                    return;
                }

                const response = await fetch('/api/change-password', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        username: username,
                        newPassword: newPassword
                    })
                });

                const result = await response.json();

                if (result.success) {
                    await showModal('Mot de passe changé avec succès !');
                    passwordModal.classList.remove('active');
                    // Reset des champs
                    document.getElementById('new-password').value = '';
                    document.getElementById('confirm-password').value = '';
                } else {
                    await showModal('Erreur: ' + result.message);
                }

            } catch (error) {
                console.error('Erreur:', error);
                await showModal('Erreur réseau lors du changement de mot de passe.');
            } finally {
                // Réactiver le bouton
                validatePasswordBtn.disabled = false;
                validatePasswordBtn.textContent = 'Valider';
            }
        });
    }

    // Charger les informations utilisateur
    loadUserInfo();
}

// Fonction pour charger les informations utilisateur
function loadUserInfo() {
    // Charger le nom d'utilisateur depuis localStorage
    const userName = localStorage.getItem('source_username') || 'Utilisateur';
    const userNameElement = document.getElementById('user-name');
    if (userNameElement) {
        userNameElement.textContent = userName;
    }

    // Appliquer immédiatement la couleur en cache (persistance au rechargement)
    try {
        const cachedColor = localStorage.getItem(getUserColorStorageKey(userName));
        if (cachedColor) applyHeaderColor(cachedColor);
    } catch (e) {
        // ignore storage errors
    }

    // Charger la photo de profil
    loadUserAvatar();

    // Charger l'âge depuis le serveur
    loadUserAge();
}

// Fonction pour charger et calculer l'âge de l'utilisateur
async function loadUserAge() {
    try {
        const username = localStorage.getItem('source_username');
        if (!username) return;

        const response = await fetch(`/api/user-info/${username}`);
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.user.birth_date) {
                const birthDate = new Date(data.user.birth_date);
                const today = new Date();
                let age = today.getFullYear() - birthDate.getFullYear();
                const monthDiff = today.getMonth() - birthDate.getMonth();
                
                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                    age--;
                }
                
                const userAgeElement = document.getElementById('user-age');
                if (userAgeElement) {
                    userAgeElement.textContent = `${age} ans`;
                }
            }

            // Afficher la note moyenne (étoiles) des cours de l'utilisateur
            try {
                const starsWrap = document.getElementById('user-course-stars');
                const starsValue = document.getElementById('user-course-stars-value');
                const avg = data?.user?.course_stars_avg;
                const count = data?.user?.course_stars_count;
                const hasAny = typeof count === 'number' ? (count > 0) : (typeof avg === 'number');
                if (starsWrap && typeof window.renderQuarterStarsHtml === 'function') {
                    starsWrap.innerHTML = hasAny && typeof avg === 'number' ? window.renderQuarterStarsHtml(avg, 'badge') : window.renderQuarterStarsHtml(0, 'badge');
                }
                if (starsValue) {
                    if (hasAny && typeof avg === 'number') starsValue.textContent = avg.toFixed(2);
                    else starsValue.textContent = '—';
                }
            } catch (e) {
                // ignore
            }

            // Appliquer la couleur utilisateur au header
            const userColor = data?.user?.color;
            if (userColor) {
                applyHeaderColor(userColor);
                try {
                    localStorage.setItem(getUserColorStorageKey(username), userColor);
                } catch (e) {
                    // ignore storage errors
                }
            }

            // Afficher les badges actuels à côté du nom
            const badgesCurrent = data?.user?.badges_current;
            window.__moncompteBadgesCurrent = Array.isArray(badgesCurrent) ? badgesCurrent.slice() : [];
            window.__moncompteOwnedSkins = Array.isArray(data?.user?.skins_obtenus)
                ? data.user.skins_obtenus.slice()
                : ['bleu basique'];

            // Profil social
            const socialProfile = (data && data.user && data.user.social_profile) || {};
            const socialBanner = getSafeSocialBannerTheme(socialProfile.banner, window.__moncompteOwnedSkins);
            const socialBadgeShowcase = Array.isArray(socialProfile.badge_showcase) && socialProfile.badge_showcase.length > 0
                ? socialProfile.badge_showcase
                : (Array.isArray(badgesCurrent) ? badgesCurrent.slice(0, 3) : []);

            const bannerSelect = document.getElementById('social-banner-select');
            if (bannerSelect) populateSocialBannerSelector(bannerSelect, window.__moncompteOwnedSkins, socialBanner);
            renderSocialBannerPreview(socialBanner);
            renderSocialBadgeShowcase(socialBadgeShowcase);
            renderHeaderBadgesPreview(socialBadgeShowcase, window.__moncompteBadgesCurrent || []);
            populateBadgeShowcaseSelectors(Array.isArray(badgesCurrent) ? badgesCurrent : [], socialBadgeShowcase);

            const contributionsEl = document.getElementById('stat-contributions');
            const likesReceivedEl = document.getElementById('stat-likes-received');
            const likesGivenEl = document.getElementById('stat-likes-given');
            if (contributionsEl) contributionsEl.textContent = String((data && data.user && data.user.contributions_count) || 0);
            if (likesReceivedEl) likesReceivedEl.textContent = String((data && data.user && data.user.likes_received) || 0);
            if (likesGivenEl) likesGivenEl.textContent = String((data && data.user && data.user.likes_given) || 0);
        }
    } catch (error) {
        console.warn('Erreur chargement âge:', error);
    }
}

// Fonction pour charger la photo de profil de l'utilisateur
async function loadUserAvatar() {
    try {
        const username = localStorage.getItem('source_username');
        if (!username) return;

        // Charger pp.json pour trouver la photo de l'utilisateur
        const response = await fetch('/api/community/ressources/pp/pp.json');
        if (response.ok) {
            const ppData = await response.json();
            const avatarPath = ppData[username];

            if (avatarPath) {
                const avatarImg = document.getElementById('user-avatar');
                if (avatarImg) {
                    avatarImg.src = avatarPath;
                }
            }
        }
    } catch (error) {
        console.warn('Erreur chargement avatar:', error);
    }
}

// Fonction pour charger l'aperçu actuel dans le modal
async function loadCurrentAvatarPreview() {
    try {
        const username = localStorage.getItem('source_username');
        if (!username) return;

        const avatarPreview = document.getElementById('avatar-preview');
        if (!avatarPreview) return;

        // Charger pp.json pour trouver la photo actuelle
        const response = await fetch('/api/community/ressources/pp/pp.json');
        if (response.ok) {
            const ppData = await response.json();
            const avatarPath = ppData[username];

            if (avatarPath) {
                avatarPreview.src = avatarPath;
            } else {
                // Photo par défaut
                avatarPreview.src = '/ressources/user-icon.png';
            }
        } else {
            // Photo par défaut
            avatarPreview.src = '/ressources/user-icon.png';
        }
    } catch (error) {
        console.warn('Erreur chargement aperçu avatar:', error);
        // Photo par défaut
        const avatarPreview = document.getElementById('avatar-preview');
        if (avatarPreview) {
            avatarPreview.src = '/ressources/user-icon.png';
        }
    }
}

// Gestion du modal des informations du compte
async function initAccountInfoModal() {
    const accountInfoBtn = document.getElementById('account-info-btn');
    const accountInfoModal = document.getElementById('account-info-modal');
    const closeModalBtn = accountInfoModal.querySelector('.close-modal-btn');

    // Ouvrir le modal
    if (accountInfoBtn) {
        accountInfoBtn.addEventListener('click', async function() {
            await loadAccountInfo();
            accountInfoModal.classList.add('active');
        });
    }

    // Fermer le modal
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', function() {
            accountInfoModal.classList.remove('active');
        });
    }

    // Fermer le modal en cliquant sur l'overlay
    if (accountInfoModal) {
        accountInfoModal.addEventListener('click', function(e) {
            if (e.target === accountInfoModal) {
                accountInfoModal.classList.remove('active');
            }
        });
    }
}

// Charger et afficher les informations du compte
async function loadAccountInfo() {
    try {
        const username = localStorage.getItem('source_username');
        if (!username) return;

        const response = await fetch(`/api/user-info/${username}`);
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.user) {
                // Remplir les champs
                document.getElementById('info-username').textContent = data.user.username || 'N/A';
                document.getElementById('info-birthdate').textContent = data.user.birth_date || 'Non définie';
                document.getElementById('info-connexions').textContent = data.user.connexions || 0;
                
                // Formater la dernière connexion
                let lastConnexionText = 'Jamais';
                if (data.user.last_connexion) {
                    const date = new Date(data.user.last_connexion);
                    lastConnexionText = date.toLocaleString('fr-FR');
                }
                document.getElementById('info-last-connexion').textContent = lastConnexionText;

                // Charger le chemin de la photo depuis pp.json
                const ppResponse = await fetch('/api/community/ressources/pp/pp.json');
                if (ppResponse.ok) {
                    const ppData = await ppResponse.json();
                    const profilePicPath = ppData[username] || 'Aucune photo définie';
                    document.getElementById('info-profile-pic').textContent = profilePicPath;
                }
            }
        }
    } catch (error) {
        console.warn('Erreur chargement infos compte:', error);
    }
}

// Exposer la fonction globalement pour que script.js puisse l'appeler
window.initMonComptePage = initMonComptePage;

// ========================================================================
// --- Modal Badges ---
// ========================================================================

// Initialiser le modal badges
function initBadgesModal() {
    console.log('initBadgesModal - Initialisation');
    const badgesBtn = document.getElementById('badges-btn');
    const badgesModal = document.getElementById('badges-modal');
    const closeBtn = document.getElementById('close-badges-modal');

    console.log('badgesBtn:', badgesBtn);
    console.log('badgesModal:', badgesModal);
    console.log('closeBtn:', closeBtn);

    if (badgesBtn) {
        badgesBtn.addEventListener('click', async () => {
            console.log('Clic sur bouton badges!');
            await loadBadgesData();
            console.log('Adding active class to modal');
            badgesModal.classList.add('active');
            console.log('Modal classes:', badgesModal.className);
        });
    } else {
        console.error('badgesBtn introuvable!');
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            console.log('Clic sur fermer badges');
            badgesModal.classList.remove('active');
        });
    }

    if (badgesModal) {
        badgesModal.addEventListener('click', (e) => {
            if (e.target === badgesModal) {
                console.log('Clic sur overlay badges');
                badgesModal.classList.remove('active');
            }
        });
    }
}

// Charger les données de badges de l'utilisateur
async function loadBadgesData() {
    try {
        console.log('Chargement des données badges');
        const username = localStorage.getItem('source_username');
        console.log('Username:', username);
        if (!username) {
            console.error('Username non trouvé');
            return;
        }

        const response = await fetch(`/api/user-info/${username}`);
        console.log('Response status:', response.status);
        if (!response.ok) {
            console.error('Response not ok');
            return;
        }

        const data = await response.json();
        console.log('User data:', data);
        if (!data.success || !data.user) {
            console.error('Data not success or no user');
            return;
        }

        const badgesCurrent = data.user.badges_current || [];
        const badgesObtained = data.user.badges_obtained || [];

        console.log('badgesCurrent:', badgesCurrent);
        console.log('badgesObtained:', badgesObtained);

        // Fetch badge progression data
        let progressData = {};
        try {
            const progRes = await fetch(`/api/badge-progress/${encodeURIComponent(username)}`);
            if (progRes.ok) {
                const progJson = await progRes.json();
                if (progJson.success) progressData = progJson.progress || {};
            }
        } catch (e) {}

        // Afficher les badges actuels
        renderBadgesList('current-badges-list', badgesCurrent, badgesCurrent, progressData);

        // Afficher les badges obtenus (historique)
        renderBadgesList('obtained-badges-list', badgesObtained, badgesObtained, progressData);

        // Afficher tous les badges
        const allBadgeIds = Object.keys(BADGE_ICONS);
        renderBadgesList('all-badges-list', allBadgeIds, badgesObtained, progressData);

    } catch (error) {
        console.error('Erreur chargement badges:', error);
    }
}

// Afficher une liste de badges
function renderBadgesList(containerId, badgeIds, obtainedBadges, progressData) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';

    if (badgeIds.length === 0) {
        container.innerHTML = '<p class="no-badges-text">Aucun badge</p>';
        return;
    }

    badgeIds.forEach(badgeId => {
        const badge = (typeof BADGE_ICONS !== 'undefined' && BADGE_ICONS[badgeId]) ? BADGE_ICONS[badgeId] : null;
        const badgeInfo = (typeof BADGE_DESCRIPTIONS !== 'undefined' && BADGE_DESCRIPTIONS[badgeId]) ? BADGE_DESCRIPTIONS[badgeId] : null;
        // If config missing, render a fallback placeholder so the UI shows the badge id
        const fallback = {
            name: badgeInfo ? badgeInfo.name : (badgeId || 'Badge'),
            description: badgeInfo ? badgeInfo.description : 'Description non définie.'
        };
        const effectiveBadge = badge || { type: 'emoji', emoji: '❓' };

        const isObtained = obtainedBadges.includes(badgeId);
        const card = document.createElement('div');
        card.className = 'badge-card' + (badge.large ? ' large-badge' : '') + (!isObtained ? ' unobtained' : '');
        card.setAttribute('data-badge-id', badgeId);
        card.setAttribute('data-obtained', isObtained);

        // Afficher soit l'image soit l'emoji
        if (effectiveBadge.type === 'image' && effectiveBadge.src) {
            const img = document.createElement('img');
            img.src = effectiveBadge.src;
            img.alt = fallback.name;
            card.appendChild(img);
        } else {
            const emoji = document.createElement('span');
            emoji.className = 'badge-emoji-large';
            emoji.textContent = effectiveBadge.emoji || '?';
            card.appendChild(emoji);
        }

        const name = document.createElement('p');
        name.className = 'badge-card-name';
        name.textContent = fallback.name;
        card.appendChild(name);

        // Progress bar (only for non-obtained badges that have progression)
        const prog = progressData && progressData[badgeId];
        if (prog && !isObtained && prog.target > 0) {
            const pct = Math.min(100, Math.round((prog.current / prog.target) * 100));
            const bar = document.createElement('div');
            bar.className = 'badge-progress-bar';
            bar.innerHTML = `<div class="badge-progress-fill" style="width:${pct}%"></div>`;
            card.appendChild(bar);
            const label = document.createElement('span');
            label.className = 'badge-progress-label';
            label.textContent = `${prog.current}/${prog.target}`;
            card.appendChild(label);
        }

        // Événement clic pour afficher le tooltip
        card.addEventListener('click', (e) => {
            showBadgeTooltip(e, fallback, isObtained);
        });

        container.appendChild(card);
    });
}

// Afficher le tooltip
let tooltipTimeout = null;
function showBadgeTooltip(event, badgeInfo, isObtained) {
    const tooltip = document.getElementById('badge-tooltip-moncompte');
    if (!tooltip) return;

    if (tooltipTimeout) clearTimeout(tooltipTimeout);

    document.getElementById('badge-tooltip-name-moncompte').textContent = badgeInfo.name;
    document.getElementById('badge-tooltip-description-moncompte').textContent = badgeInfo.description;

    // Réinitialiser
    tooltip.classList.remove('show', 'unobtained');
    if (!isObtained) {
        tooltip.classList.add('unobtained');
    }

    tooltip.style.opacity = '0';
    tooltip.style.display = 'block';
    tooltip.style.visibility = 'visible';

    const x = event.clientX || event.pageX;
    const y = event.clientY || event.pageY;

    const padding = 12;
    const tooltipWidth = tooltip.offsetWidth || 250;
    const tooltipHeight = tooltip.offsetHeight || 80;
    const left = Math.max(padding, Math.min(x + padding, window.innerWidth - tooltipWidth - padding));
    const top = Math.max(padding, Math.min(y + padding, window.innerHeight - tooltipHeight - padding));

    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';

    requestAnimationFrame(() => {
        tooltip.classList.add('show');
        tooltip.style.opacity = isObtained ? '1' : '0.7';
    });

    tooltipTimeout = setTimeout(() => {
        tooltip.style.opacity = '0';
        setTimeout(() => {
            tooltip.style.display = 'none';
        }, 300);
    }, 3000);
}

// Initialiser le modal de la boutique
function initShopModal() {
    console.log('initShopModal - Initialisation');
    const shopBtn = document.getElementById('shop-btn');
    const shopModal = document.getElementById('shop-modal');
    const closeBtn = document.getElementById('close-shop-modal');

    const tabButtons = shopModal ? shopModal.querySelectorAll('.shop-tab-btn') : [];
    const tabPanels = shopModal ? shopModal.querySelectorAll('.shop-tab-panel') : [];

    function setShopTab(tabId) {
        tabButtons.forEach(btn => {
            const isActive = btn.dataset.shopTab === tabId;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });

        tabPanels.forEach(panel => {
            const isActive = panel.dataset.shopTabPanel === tabId;
            panel.classList.toggle('active', isActive);
        });
    }

    console.log('shopBtn:', shopBtn);
    console.log('shopModal:', shopModal);
    console.log('closeBtn:', closeBtn);

    if (shopBtn) {
        shopBtn.addEventListener('click', async () => {
            console.log('Clic sur bouton boutique!');
            await loadShopData();

            // Par défaut: onglet Thèmes
            setShopTab('themes');

            shopModal.classList.add('active');
            console.log('Modal classes:', shopModal.className);
        });
    } else {
        console.error('shopBtn introuvable!');
    }

    // Switch onglets
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.shopTab;
            if (tabId) setShopTab(tabId);
        });
    });

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            console.log('Clic sur fermer boutique');
            shopModal.classList.remove('active');
        });
    }

    if (shopModal) {
        shopModal.addEventListener('click', (e) => {
            if (e.target === shopModal) {
                console.log('Clic sur overlay boutique');
                shopModal.classList.remove('active');
            }
        });
    }

    // Gestionnaire pour les boutons d'achat
    if (shopModal) {
        shopModal.addEventListener('click', async (e) => {
            const bundleBtn = e.target.closest('.shop-bundle-buy-btn');
            if (bundleBtn && !bundleBtn.disabled) {
                const bundleId = bundleBtn.dataset.bundleId;
                if (!bundleId) return;
                await purchaseBundle(bundleId, bundleBtn);
                return;
            }

            if (e.target.classList.contains('shop-buy-btn') && !e.target.classList.contains('purchased')) {
                const shopItem = e.target.closest('.shop-item');
                if (!shopItem) return;
                const itemId = shopItem.dataset.itemId;
                const itemPrice = parseInt(shopItem.dataset.itemPrice);
                const itemType = shopItem.dataset.itemType;
                
                await purchaseItem(itemId, itemPrice, itemType, e.target);
            }
        });
    }
}

function renderShopBundles(bundles, userData) {
    const passGrid = document.getElementById('pass-grid');
    if (!passGrid) return;

    const obtainedSkins = (userData && userData.user && userData.user.skins_obtenus) || [];
    const obtainedFonds = (userData && userData.user && userData.user.fonds_obtenus) || [];

    if (!Array.isArray(bundles) || bundles.length === 0) {
        passGrid.innerHTML = '<p class="coming-soon-text">Aucun bundle disponible.</p>';
        return;
    }

    passGrid.innerHTML = '';
    bundles.forEach((bundle) => {
        const items = Array.isArray(bundle.items) ? bundle.items : [];
        let baseTotal = 0;
        const missingItems = items.filter((item) => {
            if (!item || !item.type || !item.itemId) return false;
            const isOwned = item.type === 'skin'
                ? obtainedSkins.includes(item.itemId)
                : obtainedFonds.includes(item.itemId);
            if (!isOwned) {
                const priceNode = document.querySelector(`.shop-item[data-item-id="${item.itemId}"]`);
                const price = Number(priceNode ? priceNode.dataset.itemPrice : 0) || 0;
                baseTotal += price;
            }
            return !isOwned;
        });

        const discount = Number(bundle.discountPercent || 0);
        const finalPrice = Math.max(1, Math.floor(baseTotal * (100 - discount) / 100));
        const isFullyOwned = missingItems.length === 0;

        const card = document.createElement('div');
        card.className = 'bundle-card';
        card.innerHTML = `
            <div class="bundle-head">
                <span class="bundle-title">${bundle.title || 'Bundle'}</span>
                <span class="bundle-discount">-${discount}%</span>
            </div>
            <div class="bundle-desc">${bundle.description || ''}</div>
            <div class="bundle-price-row">
                <span class="bundle-price">${isFullyOwned ? 'Deja possede' : `${finalPrice} pts`}</span>
                <button type="button" class="shop-buy-btn shop-bundle-buy-btn" data-bundle-id="${bundle.id}" ${isFullyOwned ? 'disabled' : ''}>
                    ${isFullyOwned ? 'Complet' : 'Acheter'}
                </button>
            </div>
        `;
        passGrid.appendChild(card);
    });
}

function renderShopHistory(history) {
    const shopContent = document.getElementById('shop-content');
    if (!shopContent) return;

    let historyContainer = document.getElementById('shop-history');
    if (!historyContainer) {
        historyContainer = document.createElement('div');
        historyContainer.id = 'shop-history';
        historyContainer.className = 'shop-history';
        historyContainer.innerHTML = '<h4 class="shop-history-title">Historique d\'achats</h4><div id="shop-history-list" class="shop-history-list"></div>';
        shopContent.appendChild(historyContainer);
    }

    const listEl = document.getElementById('shop-history-list');
    if (!listEl) return;

    const entries = Array.isArray(history) ? history.slice(0, 12) : [];
    if (entries.length === 0) {
        listEl.innerHTML = '<div class="shop-history-item">Aucun achat pour le moment.</div>';
        return;
    }

    listEl.innerHTML = entries.map((entry) => {
        const dateLabel = entry && entry.at ? new Date(entry.at).toLocaleString('fr-FR') : 'Date inconnue';
        if (entry && entry.source === 'bundle') {
            return `<div class="shop-history-item">${dateLabel} - Bundle ${entry.bundleTitle || entry.bundleId} (${entry.price} pts)</div>`;
        }
        return `<div class="shop-history-item">${dateLabel} - ${entry.type || 'item'} ${entry.itemId || ''} (${entry.price || 0} pts)</div>`;
    }).join('');
}

function applyShopVisualMeta(dailyOffers) {
    const offersMap = new Map();
    if (Array.isArray(dailyOffers)) {
        dailyOffers.forEach((offer) => {
            if (!offer || !offer.type || !offer.itemId) return;
            offersMap.set(`${offer.type}:${offer.itemId}`, offer);
        });
    }

    document.querySelectorAll('.shop-item[data-item-id][data-item-type]').forEach((itemElement) => {
        const itemId = itemElement.dataset.itemId;
        const itemType = itemElement.dataset.itemType;
        if (!itemId || !itemType) return;

        if (!itemElement.querySelector('.shop-item-rarity')) {
            const info = itemElement.querySelector('.shop-item-info');
            if (info) info.insertAdjacentHTML('afterbegin', buildShopRarityBadge(itemType, itemId));
        }

        const offer = offersMap.get(`${itemType}:${itemId}`);
        const existingOffer = itemElement.querySelector('.shop-item-offer-badge');
        if (offer && !existingOffer) {
            const info = itemElement.querySelector('.shop-item-info');
            if (info) {
                info.insertAdjacentHTML('beforeend', `<span class="shop-item-offer-badge">Offre du jour: -${offer.discountPercent}%</span>`);
            }
            const priceEl = itemElement.querySelector('.shop-item-price');
            if (priceEl) priceEl.textContent = `${offer.discountedPrice} pts`;
            itemElement.dataset.itemPrice = String(offer.discountedPrice);
        }

        const buyBtn = itemElement.querySelector('.shop-buy-btn');
        if (buyBtn) {
            const itemName = itemElement.querySelector('.shop-item-name');
            const label = itemName ? itemName.textContent.trim() : itemId;
            buyBtn.setAttribute('aria-label', `${buyBtn.textContent.trim()} ${label}`);
        }
    });
}

// Charger les données de la boutique
async function loadShopData() {
    try {
        console.log('Chargement des données boutique');
        const username = localStorage.getItem('source_username');
        console.log('Username:', username);
        
        if (!username) {
            console.error('Username non trouvé');
            return;
        }

        // Récupérer les informations utilisateur pour les points
        const response = await fetch(`/api/user-info/${username}`);
        if (!response.ok) {
            console.error('Erreur lors de la récupération des infos utilisateur');
            return;
        }

        const userData = await response.json();
        const userPoints = (userData && userData.user && userData.user.pt) || 0;
        
        // Afficher les points
        const pointsDisplay = document.getElementById('shop-user-points');
        if (pointsDisplay) {
            pointsDisplay.textContent = userPoints;
        }

        const purchasedSkins = (userData && userData.user && userData.user.skins_obtenus) || [];
        const purchasedFonds = (userData && userData.user && userData.user.fonds_obtenus) || [];
        const activeSkin = (userData && userData.user && userData.user.active_skin) || 'bleu basique';

        let shopMeta = null;
        let shopHistory = null;
        try {
            const [metaRes, historyRes] = await Promise.all([
                fetch(`/api/shop-meta/${encodeURIComponent(username)}`),
                fetch(`/api/shop-history/${encodeURIComponent(username)}`)
            ]);
            shopMeta = metaRes.ok ? await metaRes.json() : null;
            shopHistory = historyRes.ok ? await historyRes.json() : null;
        } catch (metaError) {
            console.warn('Impossible de charger shop meta/history:', metaError);
        }

        console.log('Skins achetés:', purchasedSkins);
        console.log('Fonds achetés:', purchasedFonds);

        applyShopVisualMeta(shopMeta && shopMeta.dailyOffers);
        renderShopBundles(shopMeta && shopMeta.bundles, userData);
        renderShopHistory(shopHistory && shopHistory.history);

        // Marquer les items comme achetés dans l'interface
        document.querySelectorAll('.shop-item[data-item-id][data-item-type]').forEach(itemElement => {
            const itemId = itemElement.dataset.itemId;
            const itemType = itemElement.dataset.itemType;

            // Remplacer les emojis par les icônes SVG pour les skins
            if (itemType === 'skin') {
                const iconEl = itemElement.querySelector('.shop-item-icon');
                if (iconEl) iconEl.innerHTML = generateThemeSVG(itemId);
            }

            // Remplacer les emojis par les aperçus animés pour les fonds
            if (itemType === 'fond') {
                const iconEl = itemElement.querySelector('.shop-item-icon');
                if (iconEl) iconEl.innerHTML = generateFondAnimatedPreview(itemId, activeSkin);
            }

            const isPurchased = (itemType === 'skin' && purchasedSkins.includes(itemId))
                || (itemType === 'fond' && purchasedFonds.includes(itemId));

            if (!isPurchased) return;

            const buyButton = itemElement.querySelector('.shop-buy-btn');
            if (buyButton) {
                buyButton.textContent = 'Acheté';
                buyButton.classList.add('purchased');
            }
        });
        
    } catch (error) {
        console.error('Erreur lors du chargement de la boutique:', error);
    }
}

// Acheter un item
async function purchaseItem(itemId, price, type, buttonElement) {
    try {
        const username = localStorage.getItem('source_username');
        if (!username) {
            await showModal('Erreur: utilisateur non connecté');
            return;
        }

        // Confirmer l'achat
        const confirmPurchase = await showModal(`Voulez-vous acheter cet item pour ${price} points ?`, { type: 'confirm' });
        if (!confirmPurchase) {
            return;
        }

        // Appeler l'API pour effectuer l'achat
        const response = await fetch('/api/shop-purchase', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: username,
                itemId: itemId,
                price: price,
                type: type
            })
        });

        const result = await response.json();

        if (response.ok && result.success) {
            // Achat réussi
            if (String(type) === 'fond') {
                await showModal(`✅ Achat réussi ! Tu peux l'équiper dans Inventaire Fonds. Il te reste ${result.newPoints} points.`);
            } else {
                await showModal(`✅ Achat réussi ! Il vous reste ${result.newPoints} points.`);
            }
            
            // Mettre à jour l'affichage des points
            const pointsDisplay = document.getElementById('shop-user-points');
            if (pointsDisplay) {
                pointsDisplay.textContent = result.newPoints;
            }

            // Marquer le bouton comme acheté
            buttonElement.textContent = 'Acheté';
            buttonElement.classList.add('purchased');
            
            // Appliquer le thème du skin actif (un achat de skin équipe le skin)
            if (String(type) === 'skin' && typeof window.applySkinTheme === 'function' && result.active_skin) {
                window.applySkinTheme(result.active_skin);
            }
            // IMPORTANT: un achat de fond ne doit pas équiper automatiquement le fond.
            
        } else {
            // Achat échoué
            await showModal(`❌ ${result.message || 'Erreur lors de l\'achat'}`);
        }

    } catch (error) {
        console.error('Erreur lors de l\'achat:', error);
        await showModal('❌ Erreur lors de l\'achat. Veuillez réessayer.');
    }
}

async function purchaseBundle(bundleId, buttonElement) {
    try {
        const username = localStorage.getItem('source_username');
        if (!username) {
            await showModal('Erreur: utilisateur non connecté');
            return;
        }

        const confirmPurchase = await showModal('Confirmer l\'achat de ce bundle ? Les objets deja possedes ne seront pas repayes.', { type: 'confirm' });
        if (!confirmPurchase) return;

        buttonElement.disabled = true;
        const response = await fetch('/api/shop-purchase-bundle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, bundleId })
        });
        const result = await response.json();

        if (response.ok && result.success) {
            await showModal(`✅ Bundle achete ! Il te reste ${result.newPoints} points.`);
            await loadShopData();
            loadInventory();
        } else {
            await showModal(`❌ ${result.message || 'Erreur lors de l\'achat du bundle'}`);
        }
    } catch (error) {
        console.error('Erreur achat bundle:', error);
        await showModal('❌ Erreur lors de l\'achat du bundle.');
    } finally {
        if (buttonElement) buttonElement.disabled = false;
    }
}

// === INVENTAIRE ===
function initInventoryModal() {
    console.log('Initialisation de l\'inventaire');
    
    const inventoryBtn = document.getElementById('inventory-btn');
    const inventoryModal = document.getElementById('inventory-modal');
    const closeInventoryModalBtn = document.getElementById('close-inventory-modal');

    const tabButtons = inventoryModal ? inventoryModal.querySelectorAll('.inventory-tab-btn') : [];
    const tabPanels = inventoryModal ? inventoryModal.querySelectorAll('.inventory-tab-panel') : [];

    function setInventoryTab(tabId) {
        tabButtons.forEach(btn => {
            const isActive = btn.dataset.inventoryTab === tabId;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });

        tabPanels.forEach(panel => {
            const isActive = panel.dataset.inventoryTabPanel === tabId;
            panel.classList.toggle('active', isActive);
        });
    }
    
    // Ouvrir le modal (dernier onglet sélectionné ou Thèmes par défaut)
    if (inventoryBtn) {
        inventoryBtn.addEventListener('click', function() {
            loadInventory();
            // Retenir le dernier onglet sélectionné (localStorage), sinon 'themes'
            let lastTab = localStorage.getItem('AS_LAST_INVENTORY_TAB') || 'themes';
            setInventoryTab(lastTab);
            inventoryModal.classList.add('active');
        });
    }

    // Switch onglets
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.inventoryTab;
            if (tabId) {
                setInventoryTab(tabId);
                localStorage.setItem('AS_LAST_INVENTORY_TAB', tabId);
            }
        });
    });
    
    // Fermer le modal
    if (closeInventoryModalBtn) {
        closeInventoryModalBtn.addEventListener('click', function() {
            inventoryModal.classList.remove('active');
        });
    }
    
    // Fermer en cliquant sur l'overlay
    if (inventoryModal) {
        inventoryModal.addEventListener('click', function(e) {
            if (e.target === inventoryModal) {
                inventoryModal.classList.remove('active');
            }
        });
    }
}

function loadInventory() {
    console.log('Chargement de l\'inventaire');
    
    const skinsData = [
        { id: 'bleu basique', name: 'Bleu Basique', description: 'Thème classique et intemporel', price: 0 },
        { id: 'jaune basique', name: 'Jaune Basique', description: 'Chaleur ensoleillée et rayonnante', price: 0 },
        { id: 'skin-verdure', name: 'Verdure', description: 'Un thème naturel et apaisant', price: 28 },
        { id: 'skin-obsidienne', name: 'Obsidienne Royale', description: 'L\'élégance des profondeurs', price: 35 },
        { id: 'skin-sunset', name: 'Sunset Lofi', description: 'Ambiance crépusculaire relaxante', price: 40 },
        { id: 'skin-grenat', name: 'Grenat', description: 'Rouge profond et chaleureux', price: 26 },
        { id: 'skin-rose', name: 'Rose Pâle', description: 'Douceur et délicatesse', price: 30 },
        { id: 'skin-neon', name: 'Néon', description: 'Vivacité électrique et moderne', price: 38 },
        { id: 'skin-chocolat', name: 'Chocolat Velours', description: 'Douceur riche et enveloppante du chocolat pur', price: 24 },
        { id: 'skin-indigo', name: 'Rêve Indigo', description: 'Profondeur mystérieuse des rêves nocturnes', price: 36 },
        { id: 'skin-marbre', name: 'Marbre Anthracite', description: 'Élégance minimaliste et sophistiquée', price: 34 },
        { id: 'skin-aurore', name: 'Aurore Boréale', description: 'Magie fluorescente des lumières célestes', price: 45 }
        ,{ id: 'skin-pastel', name: 'Pastel', description: 'Couleurs douces et ambiance légère', price: 32 }
        ,{ id: 'skin-cyberpunk', name: 'Cyberpunk', description: 'Violet, bleu néon, rose flashy, effet lumineux', price: 38 }
        ,{ id: 'skin-foret', name: 'Forêt', description: 'Tons verts et bruns, ambiance nature', price: 30 }
        ,{ id: 'skin-sable', name: 'Sable chaud', description: 'Jaune doré, orange, effet granuleux', price: 28 }
        ,{ id: 'skin-minuit', name: 'Minuit', description: 'Bleu nuit profond, touches argentées', price: 36 }
        ,{ id: 'skin-ocean', name: 'Océan', description: 'Profondeurs marines et lueurs bioluminescentes', price: 32 }
        ,{ id: 'skin-lavande', name: 'Lavande', description: 'Violet doux et apaisant, ambiance zen', price: 30 }
        ,{ id: 'skin-cerise', name: 'Cerise', description: 'Fleurs de cerisier, esthétique japonaise', price: 34 }
        ,{ id: 'skin-arctique', name: 'Arctique', description: 'Bleu glacé et givre, froid élégant', price: 36 }
    ];

    const fondsData = [
        { id: 'Vagues', name: 'Vagues', description: 'Fond par défaut', price: 0 },
        { id: 'vagues-inversees', name: 'Vagues inversées', description: 'Les vagues en haut, retournées', price: 30 },
        { id: 'lineaire', name: 'Linéaire', description: 'Lignes diagonales qui grossissent puis rétrécissent', price: 28 },
        { id: 'duel', name: 'Duel', description: 'Deux points qui se déplacent et changent de couleur', price: 35 },
        { id: 'ondes', name: 'Ondes', description: 'Cercles qui partent du centre et s\'agrandissent', price: 22 },
        { id: 'pixel-art', name: 'Pixel Art', description: 'Effet mosaïque animée façon pixels rétro', price: 34 },
        { id: 'aurora', name: 'Aurore', description: 'Dégradés mouvants façon aurores boréales', price: 38 },
        { id: 'crumpled-paper', name: 'Papier froissé', description: 'Texture animée de papier froissé', price: 26 }
    ];
    
    // Récupérer le username depuis localStorage
    const username = localStorage.getItem('source_username');
    if (!username) {
        console.error('Username non trouvé');
        return;
    }
    
    // Récupérer les données utilisateur
    fetch(`/api/user-info/${username}`)
        .then(response => response.json())
        .then(data => {
            if (!data.success || !data.user) {
                console.error('Erreur lors du chargement des données utilisateur');
                return;
            }
            
            const activeSkin = data.user.active_skin || 'bleu basique';
            const obtainedSkins = data.user.skins_obtenus || [];

            const activeFond = data.user.active_fond || 'Vagues';
            const obtainedFonds = data.user.fonds_obtenus || [];
            
            // Afficher le skin actuellement équipé
            const currentSkinCard = document.getElementById('current-skin-card');
            if (currentSkinCard) {
                currentSkinCard.innerHTML = '';
                
                let currentSkinName = 'Bleu Basique';
                let currentSkinId = 'bleu basique';
                
                const foundSkin = skinsData.find(s => s.id === activeSkin);
                if (foundSkin) {
                    currentSkinName = foundSkin.name;
                    currentSkinId = foundSkin.id;
                }
                
                currentSkinCard.innerHTML = `
                    <div class="inventory-item-icon">${generateThemeSVG(currentSkinId)}</div>
                    <div class="inventory-item-info">
                        <p class="inventory-item-name">${currentSkinName}</p>
                        <p class="inventory-item-status">Actuellement équipé</p>
                    </div>
                `;
            }
            
            // Afficher les skins achetés
            const skinsGrid = document.getElementById('inventory-skins-grid');
            if (skinsGrid) {
                skinsGrid.innerHTML = '';
                
                // Afficher tous les skins obtenus (gratuits et achetés)
                skinsData.forEach(skin => {
                    if (obtainedSkins.includes(skin.id)) {
                        const isActive = activeSkin === skin.id;
                        const skinHTML = `
                            <div class="inventory-item ${isActive ? 'active' : ''}">
                                <div class="inventory-item-icon">${generateThemeSVG(skin.id)}</div>
                                <p class="inventory-item-name">${skin.name}</p>
                                <button class="inventory-equip-btn ${isActive ? 'equipped' : ''}" 
                                        data-skin-id="${skin.id}">
                                    ${isActive ? '✓ Équipé' : 'Équiper'}
                                </button>
                            </div>
                        `;
                        skinsGrid.innerHTML += skinHTML;
                    }
                });
                
                // Ajouter les événements click aux boutons
                skinsGrid.querySelectorAll('.inventory-equip-btn').forEach(btn => {
                    console.log('🎨 [INVENTORY] Attachement event listener au bouton:', btn.dataset.skinId);
                    btn.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        const skinId = this.dataset.skinId;
                        console.log('🎨 [INVENTORY] Bouton cliqué pour skin:', skinId);
                        equipSkin(skinId);
                    });
                });
                console.log('🎨 [INVENTORY] Total de boutons trouvés:', skinsGrid.querySelectorAll('.inventory-equip-btn').length);
            }

            // Afficher le fond actuellement équipé
            const currentFondCard = document.getElementById('current-fond-card');
            if (currentFondCard) {
                currentFondCard.innerHTML = '';

                let currentFondName = 'Vagues';
                const foundFond = fondsData.find(f => f.id === activeFond);
                if (foundFond) currentFondName = foundFond.name;

                currentFondCard.innerHTML = `
                    <div class="inventory-item-icon">${generateFondAnimatedPreview(activeFond, activeSkin)}</div>
                    <div class="inventory-item-info">
                        <p class="inventory-item-name">${currentFondName}</p>
                        <p class="inventory-item-status">Actuellement équipé</p>
                    </div>
                `;
            }

            // Afficher les fonds possédés
            const fondsGrid = document.getElementById('inventory-fonds-grid');
            if (fondsGrid) {
                fondsGrid.innerHTML = '';

                fondsData.forEach(fond => {
                    if (obtainedFonds.includes(fond.id)) {
                        const isActive = activeFond === fond.id;
                        const fondHTML = `
                            <div class="inventory-item ${isActive ? 'active' : ''}">
                                <div class="inventory-item-icon">${generateFondAnimatedPreview(fond.id, activeSkin)}</div>
                                <p class="inventory-item-name">${fond.name}</p>
                                <button class="inventory-equip-btn ${isActive ? 'equipped' : ''}" 
                                        data-fond-id="${fond.id}">
                                    ${isActive ? '✓ Équipé' : 'Équiper'}
                                </button>
                            </div>
                        `;
                        fondsGrid.innerHTML += fondHTML;
                    }
                });

                fondsGrid.querySelectorAll('.inventory-equip-btn').forEach(btn => {
                    const fondId = btn.dataset.fondId;
                    if (!fondId) return;
                    btn.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        equipFond(fondId);
                    });
                });
            }
        })
        .catch(error => console.error('Erreur lors du chargement de l\'inventaire:', error));
}

async function equipSkin(skinId) {
    console.log('🎨 [EQUIP] Équipement du skin:', skinId);
    
    // Récupérer le username depuis localStorage
    const username = localStorage.getItem('source_username');
    
    console.log('🎨 [EQUIP] Username:', username);
    
    if (!username) {
        console.error('❌ [EQUIP] Erreur: utilisateur non identifié');
        await showModal('❌ Erreur: utilisateur non identifié');
        return;
    }
    
    console.log('🎨 [EQUIP] Envoi de la requête avec:', { username, skinId });
    
    try {
        const response = await fetch('/api/equip-skin', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username: username, skinId: skinId })
        });

        console.log('🎨 [EQUIP] Réponse reçue:', response.status);
        const result = await response.json();
        console.log('🎨 [EQUIP] Résultat JSON:', result);
        
        if (result.success) {
            console.log('✅ [EQUIP] Skin équipé avec succès');
            
            // Recharger l'inventaire
            loadInventory();
            
            // Appliquer le thème
            if (typeof window.applySkinTheme === 'function') {
                console.log('🎨 [EQUIP] Application du thème:', skinId);
                window.applySkinTheme(skinId);
            } else {
                console.error('❌ [EQUIP] applySkinTheme non disponible');
            }
        } else {
            console.error('❌ [EQUIP] Erreur:', result.message);
            await showModal('❌ Erreur lors de l\'équipement du skin: ' + (result.message || 'Erreur inconnue'));
        }
    } catch (error) {
        console.error('❌ [EQUIP] Erreur de fetch:', error);
        await showModal('❌ Erreur lors de l\'équipement du skin. Veuillez réessayer.');
    }
}

async function equipFond(fondId) {
    console.log('🖼️ [EQUIP] Équipement du fond:', fondId);
    const username = localStorage.getItem('source_username');

    if (!username) {
        console.error('❌ [EQUIP] Erreur: utilisateur non identifié');
        await showModal('❌ Erreur: utilisateur non identifié');
        return;
    }

    try {
        const response = await fetch('/api/equip-fond', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username: username, fondId: fondId })
        });

        const result = await response.json();

        if (result.success) {
            loadInventory();
            if (typeof window.applyFondTheme === 'function') {
                window.applyFondTheme(fondId);
            }
        } else {
            await showModal('❌ Erreur lors de l\'équipement du fond: ' + (result.message || 'Erreur inconnue'));
        }
    } catch (error) {
        console.error('❌ [EQUIP] Erreur de fetch:', error);
        await showModal('❌ Erreur lors de l\'équipement du fond. Veuillez réessayer.');
    }
}

// Exposer la fonction globalement
window.initMonComptePage = initMonComptePage;