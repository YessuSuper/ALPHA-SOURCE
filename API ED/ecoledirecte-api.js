/**
 * EcoleDirecte API Client
 * Permet de se connecter et rÃ©cupÃ©rer des donnÃ©es depuis EcoleDirecte
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
   * Effectue une requÃªte HTTPS
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
        // Format: data={"clÃ©":"valeur"}
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

        // Extraire les cookies de la rÃ©ponse
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
              reject(new Error(`RÃ©ponse vide du serveur (HTTP ${res.statusCode}) - ${method} ${path} - Headers: ${hdr}`));
              return;
            }
            const jsonData = JSON.parse(data);
            // Attacher les headers pour rÃ©cupÃ©rer X-Token si prÃ©sent
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
   * RequÃªte HTTPS brute (binaire) â€” utile pour tÃ©lÃ©charger des piÃ¨ces jointes.
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
   * RÃ©cupÃ¨re le token GTK nÃ©cessaire pour la connexion
   */
  async getGTKToken() {
    console.log('ðŸ“Œ RÃ©cupÃ©ration du token GTK...');
    try {
      const response = await this.request(`/v3/login.awp?gtk=1&v=${this.version}`, 'GET', null, {}, true);
      
      // VÃ©rifier si GTK est dans les cookies
      if (this.cookies['GTK'] || this.cookies['gtk']) {
        this.gtkToken = this.cookies['GTK'] || this.cookies['gtk'];
        console.log('âœ… Token GTK obtenu depuis les cookies');
        return this.gtkToken;
      } else if (response.token) {
        this.gtkToken = response.token;
        console.log('âœ… Token GTK obtenu');
        return this.gtkToken;
      } else {
        throw new Error('Pas de GTK reÃ§u');
      }
    } catch (error) {
      throw new Error(`Erreur lors de la rÃ©cupÃ©ration du token GTK: ${error.message}`);
    }
  }

  /**
   * RÃ©cupÃ¨re le QCM pour la double authentification
   */
  async getQCM() {
    console.log('ðŸ“‹ RÃ©cupÃ©ration du QCM...');
    try {
      const response = await this.request('/v3/connexion/doubleauth.awp', 'POST', {});
      
      if (response.code === 200) {
        const question = Buffer.from(response.data.question, 'base64').toString('utf-8');
        const propositions = response.data.propositions.map(p => 
          Buffer.from(p, 'base64').toString('utf-8')
        );
        
        console.log('\nâ“ Question: ' + question);
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
      throw new Error(`Erreur lors de la rÃ©cupÃ©ration du QCM: ${error.message}`);
    }
  }

  /**
   * RÃ©pond au QCM
   */
  async answerQCM(answerBase64) {
    console.log('ðŸ“¤ Envoi de la rÃ©ponse au QCM...');
    try {
      const response = await this.request('/v3/connexion/doubleauth.awp', 'POST', {
        choix: answerBase64
      });
      
      if (response.code === 200) {
        console.log('âœ… QCM validÃ©');
        return {
          cn: response.data.cn,
          cv: response.data.cv
        };
      } else {
        throw new Error(`Erreur rÃ©ponse QCM: Code ${response.code}`);
      }
    } catch (error) {
      throw new Error(`Erreur lors de la rÃ©ponse au QCM: ${error.message}`);
    }
  }

  /**
   * Effectue la connexion simple sans QCM
   */
  async loginSimple() {
    console.log('ðŸ” Tentative de connexion...');
    try {
      const body = {
        identifiant: this.identifiant,
        motdepasse: this.motdepasse,
        isRelogin: false,
        uuid: ""
      };

      const response = await this.request(`/v3/login.awp?v=${this.version}`, 'POST', body);
      
      if (response.code === 200) {
        // RÃ©cupÃ©rer le token depuis les headers si prÃ©sent
        this.token = (response._headers && (response._headers['x-token'] || response._headers['X-Token'])) || response.token || null;
        this.host = response.host || (response._headers && response._headers['x-http-host']) || null;

        // SÃ©lectionner le premier compte non-prof, sinon le premier
        const accounts = response.data && response.data.accounts ? response.data.accounts : [];
        if (accounts.length === 0) {
          throw new Error('Liste des comptes vide dans la rÃ©ponse');
        }
        const selected = accounts.find(acc => acc.typeCompte !== 'P') || accounts[0];
        this.account = selected;
        console.log('âœ… Connexion rÃ©ussie!');
        console.log(`ðŸ‘¤ Utilisateur: ${selected.prenom || '-'} ${selected.nom || '-'}`);
        return this.account;
      } else if (response.code === 250) {
        console.log('âš ï¸  Double authentification requise (QCM)');
        return { requireQCM: true, token: response.token };
      } else {
        throw new Error(`Code erreur: ${response.code} - ${response.message || 'Connexion Ã©chouÃ©e'}`);
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Connexion avec QCM si nÃ©cessaire
   */
  async loginWithQCM(faAnswers) {
    console.log('ðŸ” Connexion avec QCM...');
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
          throw new Error('Liste des comptes vide dans la rÃ©ponse');
        }
        const selected = accounts.find(acc => acc.typeCompte !== 'P') || accounts[0];
        this.account = selected;
        console.log('âœ… Connexion avec QCM rÃ©ussie!');
        console.log(`ðŸ‘¤ Utilisateur: ${selected.prenom || '-'} ${selected.nom || '-'}`);
        return this.account;
      } else {
        throw new Error(`Code erreur: ${response.code} - ${response.message}`);
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Connexion complÃ¨te (avec gestion du QCM si nÃ©cessaire)
   */
  async login() {
    try {
      // Ã‰tape 1: RÃ©cupÃ©rer le token GTK
      await this.getGTKToken();

      // Ã‰tape 2: Tentative de connexion simple
      const result = await this.loginSimple();

      if (result.requireQCM) {
        // Ã‰tape 3: Si QCM requis, rÃ©cupÃ©rer le QCM
        this.token = result.token;
        console.log('\nðŸ“ Connexion nÃ©cessite une rÃ©ponse au QCM');
        console.log('âš ï¸  ATTENTION: Cette rÃ©ponse doit Ãªtre fournie manuellement dans un vrai environnement');
        return {
          requireQCM: true,
          message: 'QCM required - manual input needed'
        };
      }

      return this.account;
    } catch (error) {
      console.error('âŒ Erreur de connexion:', error.message);
      throw error;
    }
  }

  /**
   * RÃ©cupÃ¨re les informations du compte
   */
  async getAccount() {
    if (!this.account) {
      throw new Error('Non connectÃ©. Appelez login() d\'abord.');
    }
    return this.account;
  }

  /**
   * RÃ©cupÃ¨re la timeline de l'Ã©lÃ¨ve
   */
  async getTimeline() {
    if (!this.account) throw new Error('Non connectÃ©');
    
    console.log('ðŸ“… RÃ©cupÃ©ration de la timeline...');
    try {
      const response = await this.request(this.withGet(`/v3/eleves/${this.account.id}/timeline.awp`), 'POST', {});
      if (response.code === 200) {
        console.log(`âœ… Timeline: ${response.data.length} Ã©vÃ©nements`);
        return response.data;
      } else {
        throw new Error(`Code ${response.code}`);
      }
    } catch (error) {
      console.error('âŒ Erreur timeline:', error.message);
      throw error;
    }
  }

  /**
   * RÃ©cupÃ¨re l'emploi du temps
   */
  async getEmploiDuTemps(dateDebut, dateFin) {
    if (!this.account) throw new Error('Non connectÃ©');
    
    console.log(`ðŸ“š RÃ©cupÃ©ration de l'emploi du temps (${dateDebut} au ${dateFin})...`);
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
                console.log(`âœ… Emploi du temps: ${response.data.length} cours`);
                return response.data;
            } else {
                lastError = new Error(`Code ${response.code}`);
            }
        } catch (e) {
            lastError = e;
            // console.warn(`âš ï¸ Echec sur ${p}: ${e.message}`);
        }
    }
    
    console.error('âŒ Erreur emploi du temps (tous endpoints Ã©chouÃ©s):', lastError ? lastError.message : 'Inconnue');
    throw lastError || new Error('Impossible de rÃ©cupÃ©rer l\'emploi du temps');
  }

  /**
   * RÃ©cupÃ¨re les notes
   */
  async getNotes(anneeScolaire = '') {
    if (!this.account) throw new Error('Non connectÃ©');
    
    console.log('ðŸ“Š RÃ©cupÃ©ration des notes...');
    try {
      const body = { anneeScolaire };
      const response = await this.request(this.withGet(`/v3/eleves/${this.account.id}/notes.awp`), 'POST', body);
      
      if (response.code === 200) {
        console.log(`âœ… Notes: ${response.data.periodes.length} pÃ©riodes`);
        return response.data;
      } else {
        throw new Error(`Code ${response.code}`);
      }
    } catch (error) {
      console.error('âŒ Erreur notes:', error.message);
      throw error;
    }
  }

  /**
   * RÃ©cupÃ¨re le cahier de texte (travail Ã  faire)
   */
  async getCahierDeTexte(date) {
    if (!this.account) throw new Error('Non connectÃ©');
    
    console.log(`ðŸ“– RÃ©cupÃ©ration du cahier de texte (${date})...`);
    try {
      // IMPORTANT: Sur certains comptes, l'endpoint cahier de texte fonctionne uniquement sur /v3/Eleves (E majuscule)
      // et en POST (mÃªme si on utilise verbe=get). En minuscules, on peut obtenir un 403.
      const response = await this.request(this.withGet(`/v3/Eleves/${this.account.id}/cahierdetexte/${date}.awp`), 'POST', {});
      
      if (response.code === 200) {
        console.log(`âœ… Cahier de texte: ${response.data.matieres.length} matiÃ¨res`);
        return response.data;
      } else {
        throw new Error(`Code ${response.code}`);
      }
    } catch (error) {
      console.error('âŒ Erreur cahier de texte:', error.message);
      throw error;
    }
  }

  /**
   * RÃ©cupÃ¨re tout le travail Ã  faire (Devoirs) en une seule requÃªte.
   * C'est beaucoup plus efficace que d'itÃ©rer jour par jour.
   */
  async getTravailAFaire() {
    if (!this.account) throw new Error('Non connectÃ©');
    
    console.log('ðŸ“ RÃ©cupÃ©ration globale du travail Ã  faire...');
    try {
      // Endpoint global pour le travail Ã  faire
      const response = await this.request(this.withGet(`/v3/Eleves/${this.account.id}/cahierdetexte.awp`), 'POST', {});
      
      if (response.code === 200) {
        // La rÃ©ponse contient un objet avec les dates comme clÃ©s
        // ex: { "2026-01-06": [ ... ], "2026-01-07": [ ... ] }
        console.log(`âœ… Travail Ã  faire rÃ©cupÃ©rÃ© avec succÃ¨s`);
        return response.data;
      } else {
        throw new Error(`Code ${response.code}`);
      }
    } catch (error) {
      console.error('âŒ Erreur travail Ã  faire global:', error.message);
      throw error;
    }
  }

  /**
   * RÃ©cupÃ¨re la liste des messages (messagerie) en lecture seule.
   * Endpoint observÃ© (web):
   *  /v3/eleves/<id>/messages.awp?verbe=get&mode=destinataire&v=...
   */
  async getMessagesList(mode, anneeMessages) {
    if (!this.account) throw new Error('Non connectÃ©');

    const safeMode = (mode === 'destinataire' || mode === 'expediteur') ? mode : 'destinataire';
    const safeAnnee = (typeof anneeMessages === 'string' && anneeMessages.trim()) ? anneeMessages.trim() : '';

    console.log(`ðŸ’¬ RÃ©cupÃ©ration de la liste des messages (${safeMode})...`);
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

    throw new Error(`Impossible de rÃ©cupÃ©rer la liste des messages. Endpoints tentÃ©s: ${tried.join(' | ')}`);
  }

  /**
   * RÃ©cupÃ¨re le dÃ©tail d'un message.
   * Endpoint observÃ© (web):
   *  /v3/eleves/<id>/messages/<ID_MESSAGE>.awp?verbe=get&mode=destinataire&v=...
   * Body: { anneeMessages: "2025-2026" }
   */
  async getMessageById(idMessage, mode, anneeMessages) {
    if (!this.account) throw new Error('Non connectÃ©');

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

    throw new Error(`Impossible de rÃ©cupÃ©rer le message ${safeId}. Endpoints tentÃ©s: ${tried.join(' | ')}`);
  }

  /**
   * TÃ©lÃ©charge une piÃ¨ce jointe d'un message.
   * IMPORTANT: les endpoints varient selon les versions/Ã©tablissements, donc on essaie plusieurs chemins.
   */
  async downloadMessageAttachment(idMessage, idFile, mode, anneeMessages) {
    if (!this.account) throw new Error('Non connectÃ©');

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

    throw new Error(`Impossible de tÃ©lÃ©charger la piÃ¨ce jointe. Endpoints tentÃ©s: ${tried.join(' | ')}`);
  }

  /**
   * Met Ã  jour l'Ã©tat "effectuÃ©" des devoirs.
   * Endpoint web: /v3/Eleves/<id>/cahierdetexte.awp?verbe=put
   * Payload: { idDevoirsEffectues: number[], idDevoirsNonEffectues: number[] }
   */
  async setDevoirsEffectues(idDevoirsEffectues, idDevoirsNonEffectues) {
    if (!this.account) throw new Error('Non connectÃ©');

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

    console.log('âœ… Mise Ã  jour devoirs effectuÃ©...');
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
        // Mettre Ã  jour le token si renvoyÃ©.
        this.token = (response._headers && (response._headers['x-token'] || response._headers['X-Token'])) || response.token || this.token;
        this.host = response.host || (response._headers && response._headers['x-http-host']) || this.host;
        return response;
      }
      throw new Error(`Code ${response.code}`);
    } catch (error) {
      console.error('âŒ Erreur mise Ã  jour devoirs effectue:', error.message);
      throw error;
    }
  }

  /**
   * RÃ©cupÃ¨re la vie scolaire (absences, sanctions, etc.)
   */
  async getVieScolaire() {
    if (!this.account) throw new Error('Non connectÃ©');
    
    console.log('ðŸ“‹ RÃ©cupÃ©ration de la vie scolaire...');
    try {
      const response = await this.request(this.withGet(`/v3/eleves/${this.account.id}/viescolaire.awp`), 'POST', {});
      
      if (response.code === 200) {
        console.log(`âœ… Vie scolaire:`);
        console.log(`   - ${response.data.absencesRetards.length} absences/retards`);
        console.log(`   - ${response.data.sanctionsEncouragements.length} sanctions/encouragements`);
        return response.data;
      } else {
        throw new Error(`Code ${response.code}`);
      }
    } catch (error) {
      console.error('âŒ Erreur vie scolaire:', error.message);
      throw error;
    }
  }

  /**
   * RÃ©cupÃ¨re les documents administratifs
   */
  async getDocuments(archive = '') {
    if (!this.account) throw new Error('Non connectÃ©');
    
    console.log('ðŸ“„ RÃ©cupÃ©ration des documents administratifs...');
    try {
      const path = this.withGet(`/v3/elevesDocuments.awp?archive=${archive}`);
      const response = await this.request(path, 'POST', {});
      
      if (response.code === 200) {
        console.log(`âœ… Documents: ${response.data.notes.length} notes, ${response.data.administratifs.length} administratifs`);
        return response.data;
      } else {
        throw new Error(`Code ${response.code}`);
      }
    } catch (error) {
      console.error('âŒ Erreur documents:', error.message);
      throw error;
    }
  }

  /**
   * RÃ©cupÃ¨re les espaces de travail
   */
  async getEspacesTravail() {
    if (!this.account) throw new Error('Non connectÃ©');
    
    console.log('ðŸ¢ RÃ©cupÃ©ration des espaces de travail...');
    try {
      const response = await this.request(this.withGet(`/v3/E/${this.account.id}/espacestravail.awp`), 'POST', {});
      
      if (response.code === 200) {
        console.log(`âœ… Espaces de travail: ${response.data.length}`);
        return response.data;
      } else {
        throw new Error(`Code ${response.code}`);
      }
    } catch (error) {
      console.error('âŒ Erreur espaces de travail:', error.message);
      throw error;
    }
  }
}

module.exports = EcoleDirecteAPI;

