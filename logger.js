// logger.js - Module de logging
const fs = require('fs');
const path = require('path');

const LOGS_PATH = path.join(__dirname, 'python admin', 'logs.json');

function logToFile(level, message, source = 'server') {
    const logData = {
        timestamp: new Date().toISOString(),
        level: level,
        message: message,
        source: source
    };
    try {
        let logs = { logs: [] };
        if (fs.existsSync(LOGS_PATH)) {
            const content = fs.readFileSync(LOGS_PATH, 'utf8');
            if (content.trim()) {
                logs = JSON.parse(content);
            }
        }
        logs.logs.push(logData);
        fs.writeFileSync(LOGS_PATH, JSON.stringify(logs, null, 2), 'utf8');
    } catch (e) {
        console.error('Erreur écriture logs:', e);
    }
}

function log(level, message, source = 'server') {
    if (level === 'info' || level === 'error' || level === 'warn') {
        console.log(`[${level.toUpperCase()}] ${message}`);
    } else {
        // Logs détaillés vont dans le fichier
        logToFile(level, message, source);
    }
}

module.exports = { log, logToFile };