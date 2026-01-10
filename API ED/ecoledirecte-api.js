/**
 * EcoleDirecte API Client
 * Permet de se connecter et récupérer des données depuis EcoleDirecte
 * Documentation: https://github.com/EduWireApps/EcoleDirecte-API-Documentation
 */

const https = require('https');
const querystring = require('querystring');

class EcoleDirecteAPI {
  constructor(identifiant, motdepasse) {
    this.identifiant = identifiant;
    this.motdepasse = motdepasse;
    this.token = null;
    this.account = null;
    this.baseUrl = 'api.ecoledirecte.com';
    // Align with the current webapp version observed in DevTools.
    this.version = '4.92.1';
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36';
    this.gtkToken = null;
    this.host = null;
    this.cookies = {}; // Stocker les cookies
  }

  withVersion(path) {
    if (path.includes('?')) {
      return `${path}&v=${this.version}`;
    }
    return `${path}?v=${this.version}`;
  }

  withGet(path) {
    if (path.includes('?')) {
      return `${path}&verbe=get&v=${this.version}`;
    }
    return `${path}?verbe=get&v=${this.version}`;
  }

  withPut(path) {
    if (path.includes('?')) {
      return `${path}&verbe=put&v=${this.version}`;
    }
    return `${path}?verbe=put&v=${this.version}`;
  }

  /**
   * Effectue une requête HTTPS
   */
  async request(path, method = 'POST', body = null, headers = {}, acceptEmpty = false) {
    return new Promise((resolve, reject) => {
      const defaultHeaders = {
        'User-Agent': this.userAgent,
        'Accept': 'application/json, text/plain, */*',
        'Origin': 'https://www.ecoledirecte.com',
        'Referer': 'https://www.ecoledirecte.com/',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
        ...headers
      };

      if (this.token) {
        defaultHeaders['X-Token'] = this.token;
      }

      if (this.gtkToken) {
        defaultHeaders['X-Gtk'] = this.gtkToken;
      }

      // Ajouter les cookies
      if (Object.keys(this.cookies).length > 0) {
        const cookieString = Object.entries(this.cookies)
          .map(([key, value]) => `${key}=${value}`)
          .join('; ');
        defaultHeaders['Cookie'] = cookieString;
      }

      let bodyToSend = null;

      if (body) {
        // Format: data={"clé":"valeur"}
        const formBody = querystring.stringify({ data: JSON.stringify(body) });
        defaultHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
        defaultHeaders['Content-Length'] = Buffer.byteLength(formBody);
        bodyToSend = formBody;
      }

      const options = {
        hostname: this.baseUrl,
        path: path,
        method: method,
        headers: defaultHeaders,
        rejectUnauthorized: false
      };

      const req = https.request(options, (res) => {
        let data = '';

        // Extraire les cookies de la réponse
        if (res.headers['set-cookie']) {
          res.headers['set-cookie'].forEach(cookie => {
            const parts = cookie.split(';')[0].split('=');
            if (parts.length === 2) {
              this.cookies[parts[0].trim()] = parts[1].trim();
            }
          });
        }

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            if (!data || data.trim() === '') {
              if (acceptEmpty) {
                resolve({ code: 200, data: {}, token: '', message: '', _headers: res.headers });
                return;
              }
              const hdr = JSON.stringify(res.headers);
              reject(new Error(`Réponse vide du serveur (HTTP ${res.statusCode}) - ${method} ${path} - Headers: ${hdr}`));
              return;
            }
            const jsonData = JSON.parse(data);
            // Attacher les headers pour récupérer X-Token si présent
            jsonData._headers = res.headers;
            resolve(jsonData);
          } catch (e) {
            reject(new Error(`Failed to parse JSON: ${e.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Erreur de connexion: ${error.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Timeout de connexion'));
      });

      req.setTimeout(10000);

      if (bodyToSend) {
        req.write(bodyToSend);
      }

      req.end();
    });
  }

  /**
   * Requête HTTPS brute (binaire) — utile pour télécharger des pièces jointes.
   * Retourne: { statusCode, headers, buffer }
   */
  async requestRaw(path, method = 'GET', body = null, headers = {}) {
    return new Promise((resolve, reject) => {
      const defaultHeaders = {
        'User-Agent': this.userAgent,
        'Accept': '*/*',
        'Origin': 'https://www.ecoledirecte.com',
        'Referer': 'https://www.ecoledirecte.com/',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
        ...headers
      };

      if (this.token) {
        defaultHeaders['X-Token'] = this.token;
      }

      if (this.gtkToken) {
        defaultHeaders['X-Gtk'] = this.gtkToken;
      }

      if (Object.keys(this.cookies).length > 0) {
        const cookieString = Object.entries(this.cookies)
          .map(([key, value]) => `${key}=${value}`)
          .join('; ');
        defaultHeaders['Cookie'] = cookieString;
      }

      let bodyToSend = null;
      if (body) {
        const formBody = querystring.stringify({ data: JSON.stringify(body) });
        defaultHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
        defaultHeaders['Content-Length'] = Buffer.byteLength(formBody);
        bodyToSend = formBody;
      }

      const options = {
        hostname: this.baseUrl,
        path: path,
        method: method,
        headers: defaultHeaders,
        rejectUnauthorized: false
      };

      const req = https.request(options, (res) => {
        const chunks = [];

        if (res.headers['set-cookie']) {
          res.headers['set-cookie'].forEach(cookie => {
            const parts = cookie.split(';')[0].split('=');
            if (parts.length === 2) {
              this.cookies[parts[0].trim()] = parts[1].trim();
            }
          });
        }

        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          resolve({ statusCode: res.statusCode || 0, headers: res.headers || {}, buffer });
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Erreur de connexion: ${error.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Timeout de connexion'));
      });

      req.setTimeout(20000);

      if (bodyToSend) {
        req.write(bodyToSend);
      }

      req.end();
    });
  }

  /**
   * Récupère le token GTK nécessaire pour la connexion
   */
  async getGTKToken() {
    console.log('📌 Récupération du token GTK...');
    try {
      const response = await this.request(`/v3/login.awp?gtk=1&v=${this.version}`, 'GET', null, {}, true);
      
      // Vérifier si GTK est dans les cookies
      if (this.cookies['GTK'] || this.cookies['gtk']) {
        this.gtkToken = this.cookies['GTK'] || this.cookies['gtk'];
        console.log('✅ Token GTK obtenu depuis les cookies');
        return this.gtkToken;
      } else if (response.token) {
        this.gtkToken = response.token;
        console.log('✅ Token GTK obtenu');
        return this.gtkToken;
      } else {
        throw new Error('Pas de GTK reçu');
      }
    } catch (error) {
      throw new Error(`Erreur lors de la récupération du token GTK: ${error.message}`);
    }
  }

  /**
   * Récupère le QCM pour la double authentification
   */
  async getQCM() {
    console.log('📋 Récupération du QCM...');
    try {
      const response = await this.request('/v3/connexion/doubleauth.awp', 'POST', {});
      
      if (response.code === 200) {
        const question = Buffer.from(response.data.question, 'base64').toString('utf-8');
        const propositions = response.data.propositions.map(p => 
          Buffer.from(p, 'base64').toString('utf-8')
        );
        
        console.log('\n❓ Question: ' + question);
        console.log('Propositions:');
        propositions.forEach((prop, index) => {
          console.log(`  ${index + 1}. ${prop}`);
        });
        
        return {
          question,
          propositions,
          raw: response.data
        };
      } else {
        throw new Error(`Erreur QCM: Code ${response.code}`);
      }
    } catch (error) {
      throw new Error(`Erreur lors de la récupération du QCM: ${error.message}`);
    }
  }

  /**
   * Répond au QCM
   */
  async answerQCM(answerBase64) {
    console.log('📤 Envoi de la réponse au QCM...');
    try {
      const response = await this.request('/v3/connexion/doubleauth.awp', 'POST', {
        choix: answerBase64
      });
      
      if (response.code === 200) {
        console.log('✅ QCM validé');
        return {
          cn: response.data.cn,
          cv: response.data.cv
        };
      } else {
        throw new Error(`Erreur réponse QCM: Code ${response.code}`);
      }
    } catch (error) {
      throw new Error(`Erreur lors de la réponse au QCM: ${error.message}`);
    }
  }

  /**
   * Effectue la connexion simple sans QCM
   */
  async loginSimple() {
    console.log('🔐 Tentative de connexion...');
    try {
      const body = {
        identifiant: encodeURIComponent(this.identifiant),
        motdepasse: encodeURIComponent(this.motdepasse),
        isRelogin: false,
        uuid: ""
      };

      const response = await this.request(`/v3/login.awp?v=${this.version}`, 'POST', body);
      
      if (response.code === 200) {
        // Récupérer le token depuis les headers si présent
        this.token = (response._headers && (response._headers['x-token'] || response._headers['X-Token'])) || response.token || null;
        this.host = response.host || (response._headers && response._headers['x-http-host']) || null;

        // Sélectionner le premier compte non-prof, sinon le premier
        const accounts = response.data && response.data.accounts ? response.data.accounts : [];
        if (accounts.length === 0) {
          throw new Error('Liste des comptes vide dans la réponse');
        }
        const selected = accounts.find(acc => acc.typeCompte !== 'P') || accounts[0];
        this.account = selected;
        console.log('✅ Connexion réussie!');
        console.log(`👤 Utilisateur: ${selected.prenom || '-'} ${selected.nom || '-'}`);
        return this.account;
      } else if (response.code === 250) {
        console.log('⚠️  Double authentification requise (QCM)');
        return { requireQCM: true, token: response.token };
      } else {
        throw new Error(`Code erreur: ${response.code} - ${response.message || 'Connexion échouée'}`);
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Connexion avec QCM si nécessaire
   */
  async loginWithQCM(faAnswers) {
    console.log('🔐 Connexion avec QCM...');
    try {
      const body = {
        identifiant: this.identifiant,
        motdepasse: this.motdepasse,
        isRelogin: false,
        uuid: "",
        fa: faAnswers
      };

      const response = await this.request(`/v3/login.awp?v=${this.version}`, 'POST', body);
      
      if (response.code === 200) {
        this.token = (response._headers && (response._headers['x-token'] || response._headers['X-Token'])) || response.token || null;
        this.host = response.host || (response._headers && response._headers['x-http-host']) || null;
        const accounts = response.data && response.data.accounts ? response.data.accounts : [];
        if (accounts.length === 0) {
          throw new Error('Liste des comptes vide dans la réponse');
        }
        const selected = accounts.find(acc => acc.typeCompte !== 'P') || accounts[0];
        this.account = selected;
        console.log('✅ Connexion avec QCM réussie!');
        console.log(`👤 Utilisateur: ${selected.prenom || '-'} ${selected.nom || '-'}`);
        return this.account;
      } else {
        throw new Error(`Code erreur: ${response.code} - ${response.message}`);
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Connexion complète (avec gestion du QCM si nécessaire)
   */
  async login() {
    try {
      // Étape 1: Récupérer le token GTK
      await this.getGTKToken();

      // Étape 2: Tentative de connexion simple
      const result = await this.loginSimple();

      if (result.requireQCM) {
        // Étape 3: Si QCM requis, récupérer le QCM
        this.token = result.token;
        console.log('\n📝 Connexion nécessite une réponse au QCM');
        console.log('⚠️  ATTENTION: Cette réponse doit être fournie manuellement dans un vrai environnement');
        return {
          requireQCM: true,
          message: 'QCM required - manual input needed'
        };
      }

      return this.account;
    } catch (error) {
      console.error('❌ Erreur de connexion:', error.message);
      throw error;
    }
  }

  /**
   * Récupère les informations du compte
   */
  async getAccount() {
    if (!this.account) {
      throw new Error('Non connecté. Appelez login() d\'abord.');
    }
    return this.account;
  }

  /**
   * Récupère la timeline de l'élève
   */
  async getTimeline() {
    if (!this.account) throw new Error('Non connecté');
    
    console.log('📅 Récupération de la timeline...');
    try {
      const response = await this.request(this.withGet(`/v3/eleves/${this.account.id}/timeline.awp`), 'POST', {});
      if (response.code === 200) {
        console.log(`✅ Timeline: ${response.data.length} événements`);
        return response.data;
      } else {
        throw new Error(`Code ${response.code}`);
      }
    } catch (error) {
      console.error('❌ Erreur timeline:', error.message);
      throw error;
    }
  }

  /**
   * Récupère l'emploi du temps
   */
  async getEmploiDuTemps(dateDebut, dateFin) {
    if (!this.account) throw new Error('Non connecté');
    
    console.log(`📚 Récupération de l'emploi du temps (${dateDebut} au ${dateFin})...`);
    const body = {
      dateDebut,
      dateFin,
      avecTrous: false
    };

    const paths = [
        `/v3/E/${this.account.id}/emploidutemps.awp`,
        `/v3/Eleves/${this.account.id}/emploidutemps.awp`,
        `/v3/eleves/${this.account.id}/emploidutemps.awp`
    ];

    let lastError = null;

    for (const p of paths) {
        try {
            const response = await this.request(this.withGet(p), 'POST', body);
            if (response.code === 200) {
                console.log(`✅ Emploi du temps: ${response.data.length} cours`);
                return response.data;
            } else {
                lastError = new Error(`Code ${response.code}`);
            }
        } catch (e) {
            lastError = e;
            // console.warn(`⚠️ Echec sur ${p}: ${e.message}`);
        }
    }
    
    console.error('❌ Erreur emploi du temps (tous endpoints échoués):', lastError ? lastError.message : 'Inconnue');
    throw lastError || new Error('Impossible de récupérer l\'emploi du temps');
  }

  /**
   * Récupère les notes
   */
  async getNotes(anneeScolaire = '') {
    if (!this.account) throw new Error('Non connecté');
    
    console.log('📊 Récupération des notes...');
    try {
      const body = { anneeScolaire };
      const response = await this.request(this.withGet(`/v3/eleves/${this.account.id}/notes.awp`), 'POST', body);
      
      if (response.code === 200) {
        console.log(`✅ Notes: ${response.data.periodes.length} périodes`);
        return response.data;
      } else {
        throw new Error(`Code ${response.code}`);
      }
    } catch (error) {
      console.error('❌ Erreur notes:', error.message);
      throw error;
    }
  }

  /**
   * Récupère le cahier de texte (travail à faire)
   */
  async getCahierDeTexte(date) {
    if (!this.account) throw new Error('Non connecté');
    
    console.log(`📖 Récupération du cahier de texte (${date})...`);
    try {
      // IMPORTANT: Sur certains comptes, l'endpoint cahier de texte fonctionne uniquement sur /v3/Eleves (E majuscule)
      // et en POST (même si on utilise verbe=get). En minuscules, on peut obtenir un 403.
      const response = await this.request(this.withGet(`/v3/Eleves/${this.account.id}/cahierdetexte/${date}.awp`), 'POST', {});
      
      if (response.code === 200) {
        console.log(`✅ Cahier de texte: ${response.data.matieres.length} matières`);
        return response.data;
      } else {
        throw new Error(`Code ${response.code}`);
      }
    } catch (error) {
      console.error('❌ Erreur cahier de texte:', error.message);
      throw error;
    }
  }

  /**
   * Récupère tout le travail à faire (Devoirs) en une seule requête.
   * C'est beaucoup plus efficace que d'itérer jour par jour.
   */
  async getTravailAFaire() {
    if (!this.account) throw new Error('Non connecté');
    
    console.log('📝 Récupération globale du travail à faire...');
    try {
      // Endpoint global pour le travail à faire
      const response = await this.request(this.withGet(`/v3/Eleves/${this.account.id}/cahierdetexte.awp`), 'POST', {});
      
      if (response.code === 200) {
        // La réponse contient un objet avec les dates comme clés
        // ex: { "2026-01-06": [ ... ], "2026-01-07": [ ... ] }
        console.log(`✅ Travail à faire récupéré avec succès`);
        return response.data;
      } else {
        throw new Error(`Code ${response.code}`);
      }
    } catch (error) {
      console.error('❌ Erreur travail à faire global:', error.message);
      throw error;
    }
  }

  /**
   * Récupère la liste des messages (messagerie) en lecture seule.
   * Endpoint observé (web):
   *  /v3/eleves/<id>/messages.awp?verbe=get&mode=destinataire&v=...
   */
  async getMessagesList(mode, anneeMessages) {
    if (!this.account) throw new Error('Non connecté');

    const safeMode = (mode === 'destinataire' || mode === 'expediteur') ? mode : 'destinataire';
    const safeAnnee = (typeof anneeMessages === 'string' && anneeMessages.trim()) ? anneeMessages.trim() : '';

    console.log(`💬 Récupération de la liste des messages (${safeMode})...`);
    const body = { anneeMessages: safeAnnee };

    const tried = [];
    const paths = [
      `/v3/eleves/${this.account.id}/messages.awp?mode=${encodeURIComponent(safeMode)}`,
      `/v3/Eleves/${this.account.id}/messages.awp?mode=${encodeURIComponent(safeMode)}`
    ];

    for (let i = 0; i < paths.length; i++) {
      const p = paths[i];
      tried.push(this.withGet(p));
      try {
        const response = await this.request(this.withGet(p), 'POST', body);
        if (response.code === 200) {
          return response.data;
        }
      } catch (e) {
        // try next
      }
    }

    throw new Error(`Impossible de récupérer la liste des messages. Endpoints tentés: ${tried.join(' | ')}`);
  }

  /**
   * Récupère le détail d'un message.
   * Endpoint observé (web):
   *  /v3/eleves/<id>/messages/<ID_MESSAGE>.awp?verbe=get&mode=destinataire&v=...
   * Body: { anneeMessages: "2025-2026" }
   */
  async getMessageById(idMessage, mode, anneeMessages) {
    if (!this.account) throw new Error('Non connecté');

    const safeId = parseInt(idMessage, 10);
    if (isNaN(safeId) || !isFinite(safeId) || safeId <= 0) {
      throw new Error('idMessage invalide');
    }

    const safeMode = (mode === 'destinataire' || mode === 'expediteur') ? mode : 'destinataire';
    const safeAnnee = (typeof anneeMessages === 'string' && anneeMessages.trim()) ? anneeMessages.trim() : '';

    const body = { anneeMessages: safeAnnee };
    const tried = [];
    const paths = [
      `/v3/eleves/${this.account.id}/messages/${safeId}.awp?mode=${encodeURIComponent(safeMode)}`,
      `/v3/Eleves/${this.account.id}/messages/${safeId}.awp?mode=${encodeURIComponent(safeMode)}`
    ];

    for (let i = 0; i < paths.length; i++) {
      const p = paths[i];
      tried.push(this.withGet(p));
      try {
        const response = await this.request(this.withGet(p), 'POST', body);
        if (response.code === 200) {
          return response.data;
        }
      } catch (e) {
        // try next
      }
    }

    throw new Error(`Impossible de récupérer le message ${safeId}. Endpoints tentés: ${tried.join(' | ')}`);
  }

  /**
   * Télécharge une pièce jointe d'un message.
   * IMPORTANT: les endpoints varient selon les versions/établissements, donc on essaie plusieurs chemins.
   */
  async downloadMessageAttachment(idMessage, idFile, mode, anneeMessages) {
    if (!this.account) throw new Error('Non connecté');

    const safeMsg = parseInt(idMessage, 10);
    const safeFile = parseInt(idFile, 10);
    if (isNaN(safeMsg) || !isFinite(safeMsg) || safeMsg <= 0) throw new Error('idMessage invalide');
    if (isNaN(safeFile) || !isFinite(safeFile) || safeFile <= 0) throw new Error('idFile invalide');

    const safeMode = (mode === 'destinataire' || mode === 'expediteur') ? mode : 'destinataire';
    const safeAnnee = (typeof anneeMessages === 'string' && anneeMessages.trim()) ? anneeMessages.trim() : '';

    // Some endpoints require the same body as message detail.
    const body = safeAnnee ? { anneeMessages: safeAnnee } : {};

    // EcoleDirecte-Plus uses this endpoint for all downloads.
    // https://api.ecoledirecte.com/v3/telechargement.awp?verbe=get&fichierId=<id>&leTypeDeFichier=<type>
    // method POST with body { forceDownload: 0 }
    try {
      // Infer file type from message detail when possible.
      let fileType = 'PIECE_JOINTE';
      try {
        const msg = await this.getMessageById(safeMsg, safeMode, safeAnnee);
        const files = msg && Array.isArray(msg.files) ? msg.files : [];
        for (let i = 0; i < files.length; i++) {
          const f = files[i] || {};
          const fid = parseInt(f.id, 10);
          if (!isNaN(fid) && isFinite(fid) && fid === safeFile) {
            if (typeof f.type === 'string' && f.type.trim()) {
              fileType = f.type.trim();
            }
            break;
          }
        }
      } catch (e) {
        // ignore, keep default type
      }

      const dlPath = this.withGet(`/v3/telechargement.awp?fichierId=${encodeURIComponent(String(safeFile))}&leTypeDeFichier=${encodeURIComponent(String(fileType))}`);
      const r0 = await this.requestRaw(dlPath, 'POST', { forceDownload: 0 }, {});
      const ct0 = (r0.headers && (r0.headers['content-type'] || r0.headers['Content-Type'])) || '';
      if (r0.statusCode === 200 && r0.buffer && r0.buffer.length > 0 && String(ct0).toLowerCase().indexOf('application/json') === -1) {
        return r0;
      }
    } catch (e) {
      // fallback below
    }

    const tried = [];

    // Most likely patterns observed in ED APIs (not guaranteed).
    const candidates = [
      // piece jointe under message
      { method: 'GET', path: `/v3/eleves/${this.account.id}/messages/${safeMsg}/piecesjointes/${safeFile}.awp?mode=${encodeURIComponent(safeMode)}` },
      { method: 'GET', path: `/v3/Eleves/${this.account.id}/messages/${safeMsg}/piecesjointes/${safeFile}.awp?mode=${encodeURIComponent(safeMode)}` },
      { method: 'GET', path: `/v3/eleves/${this.account.id}/messages/${safeMsg}/piecejointe/${safeFile}.awp?mode=${encodeURIComponent(safeMode)}` },
      { method: 'GET', path: `/v3/Eleves/${this.account.id}/messages/${safeMsg}/piecejointe/${safeFile}.awp?mode=${encodeURIComponent(safeMode)}` },
      // attachment endpoint (sometimes /fichiers)
      { method: 'GET', path: `/v3/eleves/${this.account.id}/messages/${safeMsg}/fichiers/${safeFile}.awp?mode=${encodeURIComponent(safeMode)}` },
      { method: 'GET', path: `/v3/Eleves/${this.account.id}/messages/${safeMsg}/fichiers/${safeFile}.awp?mode=${encodeURIComponent(safeMode)}` }
    ];

    // Try GET first (no body). If it fails, try POST with body.
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const p = this.withVersion(c.path);
      tried.push(`${c.method} ${p}`);
      try {
        const r = await this.requestRaw(p, c.method, null, {});
        if (r.statusCode === 200 && r.buffer && r.buffer.length > 0) {
          return r;
        }
      } catch (e) {
        // try next
      }
    }

    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const p = this.withVersion(c.path);
      tried.push(`POST ${p}`);
      try {
        const r = await this.requestRaw(p, 'POST', body, {});
        if (r.statusCode === 200 && r.buffer && r.buffer.length > 0) {
          return r;
        }
      } catch (e) {
        // try next
      }
    }

    throw new Error(`Impossible de télécharger la pièce jointe. Endpoints tentés: ${tried.join(' | ')}`);
  }

  /**
   * Met à jour l'état "effectué" des devoirs.
   * Endpoint web: /v3/Eleves/<id>/cahierdetexte.awp?verbe=put
   * Payload: { idDevoirsEffectues: number[], idDevoirsNonEffectues: number[] }
   */
  async setDevoirsEffectues(idDevoirsEffectues, idDevoirsNonEffectues) {
    if (!this.account) throw new Error('Non connecté');

    function toIdList(v) {
      const arr = Array.isArray(v) ? v : [];
      const out = [];
      for (let i = 0; i < arr.length; i++) {
        const n = parseInt(arr[i], 10);
        if (!isNaN(n) && isFinite(n)) out.push(n);
      }
      return out;
    }

    const effectues = toIdList(idDevoirsEffectues);
    const nonEffectues = toIdList(idDevoirsNonEffectues);

    console.log('✅ Mise à jour devoirs effectué...');
    try {
      const response = await this.request(
        this.withPut(`/v3/Eleves/${this.account.id}/cahierdetexte.awp`),
        'POST',
        {
          idDevoirsEffectues: effectues,
          idDevoirsNonEffectues: nonEffectues
        }
      );

      if (response.code === 200) {
        // Mettre à jour le token si renvoyé.
        this.token = (response._headers && (response._headers['x-token'] || response._headers['X-Token'])) || response.token || this.token;
        this.host = response.host || (response._headers && response._headers['x-http-host']) || this.host;
        return response;
      }
      throw new Error(`Code ${response.code}`);
    } catch (error) {
      console.error('❌ Erreur mise à jour devoirs effectue:', error.message);
      throw error;
    }
  }

  /**
   * Récupère la vie scolaire (absences, sanctions, etc.)
   */
  async getVieScolaire() {
    if (!this.account) throw new Error('Non connecté');
    
    console.log('📋 Récupération de la vie scolaire...');
    try {
      const response = await this.request(this.withGet(`/v3/eleves/${this.account.id}/viescolaire.awp`), 'POST', {});
      
      if (response.code === 200) {
        console.log(`✅ Vie scolaire:`);
        console.log(`   - ${response.data.absencesRetards.length} absences/retards`);
        console.log(`   - ${response.data.sanctionsEncouragements.length} sanctions/encouragements`);
        return response.data;
      } else {
        throw new Error(`Code ${response.code}`);
      }
    } catch (error) {
      console.error('❌ Erreur vie scolaire:', error.message);
      throw error;
    }
  }

  /**
   * Récupère les documents administratifs
   */
  async getDocuments(archive = '') {
    if (!this.account) throw new Error('Non connecté');
    
    console.log('📄 Récupération des documents administratifs...');
    try {
      const path = this.withGet(`/v3/elevesDocuments.awp?archive=${archive}`);
      const response = await this.request(path, 'POST', {});
      
      if (response.code === 200) {
        console.log(`✅ Documents: ${response.data.notes.length} notes, ${response.data.administratifs.length} administratifs`);
        return response.data;
      } else {
        throw new Error(`Code ${response.code}`);
      }
    } catch (error) {
      console.error('❌ Erreur documents:', error.message);
      throw error;
    }
  }

  /**
   * Récupère les espaces de travail
   */
  async getEspacesTravail() {
    if (!this.account) throw new Error('Non connecté');
    
    console.log('🏢 Récupération des espaces de travail...');
    try {
      const response = await this.request(this.withGet(`/v3/E/${this.account.id}/espacestravail.awp`), 'POST', {});
      
      if (response.code === 200) {
        console.log(`✅ Espaces de travail: ${response.data.length}`);
        return response.data;
      } else {
        throw new Error(`Code ${response.code}`);
      }
    } catch (error) {
      console.error('❌ Erreur espaces de travail:', error.message);
      throw error;
    }
  }
}

module.exports = EcoleDirecteAPI;
