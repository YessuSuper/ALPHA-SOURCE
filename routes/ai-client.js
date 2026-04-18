'use strict';
const Groq = require('groq-sdk');
const dotenv = require('dotenv');
dotenv.config();

// ── Rotation de clés API Groq ────────────────────────────────────────────────
const GROQ_KEYS = [
    process.env.GROQ_API_KEY,
    process.env.GROQ_API_KEY_2,
    process.env.GROQ_API_KEY_3,
    process.env.GROQ_API_KEY_4
].filter(Boolean);

const clients = GROQ_KEYS.map(k => new Groq({ apiKey: k }));
let currentKeyIndex = 0;

function getClient() { return clients[currentKeyIndex]; }

/**
 * Wrapper qui appelle Groq et rotate automatiquement sur 429 (rate limit).
 * Essaie chaque clé une fois avant d'abandonner.
 */
async function groqCall(createFn) {
    const tried = new Set();
    while (tried.size < clients.length) {
        const client = clients[currentKeyIndex];
        tried.add(currentKeyIndex);
        try {
            return await createFn(client);
        } catch (e) {
            const isRateLimit = e.status === 429 || (e.error?.code === 'rate_limit_exceeded') || (e.message && e.message.includes('rate_limit'));
            if (isRateLimit && tried.size < clients.length) {
                const oldIdx = currentKeyIndex;
                currentKeyIndex = (currentKeyIndex + 1) % clients.length;
                console.log(`[GROQ] Clé #${oldIdx + 1} rate-limited → rotation vers clé #${currentKeyIndex + 1}/${clients.length}`);
                continue;
            }
            throw e; // pas un rate limit, ou toutes les clés épuisées
        }
    }
}

// Compatibilité : exporter ai = premier client fonctionnel
const ai = clients[0] || null;
const model = "llama-3.3-70b-versatile";
const visionModel = "meta-llama/llama-4-scout-17b-16e-instruct";
const routerModel = "llama-3.1-8b-instant";
module.exports = { ai, model, visionModel, routerModel, groqCall, clients, getClient };
