// public/js/cartable.js

(function(){
    const API_BASE = '/ed';

    function getSiteUser(){
        try { return (localStorage.getItem('source_username') || '').trim(); } catch { return ''; }
    }

    function byId(id){ return document.getElementById(id); }

    async function safeJson(res) {
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) return res.json();
        const text = await res.text();
        throw new Error('Réponse non JSON: ' + text.slice(0,200));
    }

    // Helper: fetch with abort timeout to avoid UI hanging when backend blocks
    async function fetchWithTimeout(url, opts = {}, timeoutMs = 6000) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const merged = Object.assign({}, opts, { signal: controller.signal });
            const res = await fetch(url, merged);
            clearTimeout(id);
            return res;
        } catch (e) {
            clearTimeout(id);
            // Normalize abort error
            if (e && e.name === 'AbortError') throw new Error('Timeout');
            throw e;
        }
    }

    function show(el){ if (el) el.style.display = ''; }
    function hide(el){ if (el) el.style.display = 'none'; }
    function setText(el, msg){ if (el) { if (msg) { el.textContent = msg; el.style.display = 'block'; } else { el.textContent=''; el.style.display='none'; } } }

    function todayYmd(){ return new Date().toISOString().slice(0,10); }

    // Formatte une date AAAA-MM-JJ en 'Jour Nombre' (ex: mercredi 13)
    function formatJourNombre(dateStr) {
        if (!dateStr) return '';
        const jours = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
        const d = new Date(dateStr + 'T00:00:00');
        if (isNaN(d.getTime())) return dateStr;
        const jour = jours[d.getDay()];
        const num = d.getDate();
        return `${jour} ${num}`;
    }
    function addDaysYmd(ymd, days){
        const d = new Date(ymd + 'T00:00:00Z');
        d.setUTCDate(d.getUTCDate() + days);
        return d.toISOString().slice(0,10);
    }

    const POLE_COLOR_CLASS = {
        'littéraire': 'pole-lettres',
        'litteraire': 'pole-lettres',
        'scientifique': 'pole-sciences',
        'artistique': 'pole-arts',
        'artistique et sportif': 'pole-arts',
        'sport': 'pole-sport',
        'autre': 'pole-autres',
        'autres': 'pole-autres'
    };

    // Couleurs des matières (badges visuels)
    const SUBJECT_COLORS = {
        'HISTOIRE-GEOGRAPHIE': '#ffcc99',
        'ESPAGNOL LV2': '#fff59d',
        'LCA LATIN': '#e0f7fa',
        'GREC': '#e0f7fa',
        'ED.PHYSIQUE & SPORT.': '#d1c4e9',
        'SCIENCES VIE & TERRE': '#a5d6a7',
        'ANGLAIS LV1': '#ffab91',
        'MATHEMATIQUES': '#ffccbc',
        'FRANCAIS': '#90caf9',
        'VIE DE CLASSE': '#cfd8dc',
        'PHYSIQUE-CHIMIE': '#f48fb1',
        'EDUCATION MUSICALE': '#ce93d8',
        'ARTS PLASTIQUES': '#f8bbd0',
        'TECHNOLOGIE': '#ef5350',
        'CAMBRIDGE': '#2e7d32',
        'DEVOIR SURVEILLE': '#b0bec5'
    };

    function getSubjectColor(matiere){
        if (!matiere) return null;
        const u = matiere.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
        for (const [k,c] of Object.entries(SUBJECT_COLORS)){ if (u === k) return c; }
        if (u.includes('HISTOIRE') || u.includes('GEOGRAPHIE')) return SUBJECT_COLORS['HISTOIRE-GEOGRAPHIE'];
        if (u.includes('ESPAGNOL')) return SUBJECT_COLORS['ESPAGNOL LV2'];
        if (u.includes('LATIN') || u.includes('LCA')) return SUBJECT_COLORS['LCA LATIN'];
        if (u.includes('GREC')) return SUBJECT_COLORS['GREC'];
        if (u.includes('SPORT') || u.includes('EPS') || u.includes('ED.PHYSIQUE')) return SUBJECT_COLORS['ED.PHYSIQUE & SPORT.'];
        if (u.includes('SVT') || u.includes('VIE & TERRE') || u.includes('VIE ET TERRE')) return SUBJECT_COLORS['SCIENCES VIE & TERRE'];
        if (u.includes('ANGLAIS')) return SUBJECT_COLORS['ANGLAIS LV1'];
        if (u.includes('MATH')) return SUBJECT_COLORS['MATHEMATIQUES'];
        if (u.includes('FRANCAIS')) return SUBJECT_COLORS['FRANCAIS'];
        if (u.includes('PHYSIQUE') && !u.includes('SPORT')) return SUBJECT_COLORS['PHYSIQUE-CHIMIE'];
        if (u.includes('MUSIQUE') || u.includes('MUSICALE')) return SUBJECT_COLORS['EDUCATION MUSICALE'];
        if (u.includes('PLASTIQUE') || u.includes('ARTS PL')) return SUBJECT_COLORS['ARTS PLASTIQUES'];
        if (u.includes('TECHNO')) return SUBJECT_COLORS['TECHNOLOGIE'];
        if (u.includes('CAMBRIDGE')) return SUBJECT_COLORS['CAMBRIDGE'];
        if (u.includes('VIE DE CLASSE')) return SUBJECT_COLORS['VIE DE CLASSE'];
        return null;
    }

    function matiereBadgeHtml(matiere){
        const safe = String(matiere || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        const color = getSubjectColor(matiere);
        if (!color) return safe;
        const isDark = (color === '#2e7d32' || color === '#ef5350');
        const tc = isDark ? '#fff' : '#1a1a1a';
        return `<span class="matiere-badge" style="background:${color};color:${tc}">${safe}</span>`;
    }

    function normalizeNumber(val){
        if (val === null || val === undefined) return null;
        const s = String(val).replace(/[^\d.,\-]/g, '').replace(',', '.');
        const n = parseFloat(s);
        return Number.isFinite(n) ? n : null;
    }

    function fmt(num){ 
        if (num === null || num === undefined || Number.isNaN(num)) return '-'; 
        return (Math.round(num * 100) / 100).toString();
    }

    function renderNotes(data, periodeId = '') {
        const container = byId('notes-container');
        if (!container) return;

        // Cherche la structure reçue de l'API ED
        let structure = data;
        if (data?.data && typeof data.data === 'object') structure = data.data;

        // Stocke la structure globalement pour accès dans les handlers d'événement
        window.cartableCurrentStructure = structure;

        // Stocke aussi la période actuelle globalement
        window.cartableCurrentPeriodeId = periodeId || (structure?.periodes?.[0]?.idPeriode);

        // Cherche la période demandée
        let periode = null;
        if (structure?.periodes && Array.isArray(structure.periodes)) {
            if (periodeId) {
                // Cherche la période avec cet ID
                periode = structure.periodes.find(p => p.idPeriode === periodeId || p.codePeriode === periodeId);
            }
            // Si pas trouvée ou pas d'ID, prendre la première
            if (!periode) periode = structure.periodes[0];
        }

        if (!periode || !periode.ensembleMatieres) {
            container.textContent = 'Aucune donnée de notes trouvée.';
            return;
        }

        const ensemble = periode.ensembleMatieres;

        // Cherche la moyenne générale dans l'ensemble
        let moyGenerale = null;
        if (ensemble?.moyenneGenerale !== undefined) moyGenerale = normalizeNumber(ensemble.moyenneGenerale);

        // Cherche les disciplines (les pôles ET les matières) dans l'ensemble
        let disciplines = [];
        if (ensemble?.disciplines && Array.isArray(ensemble.disciplines)) {
            disciplines = ensemble.disciplines;
        }

        if (!disciplines.length && !moyGenerale) { 
            container.textContent = 'Aucune donnée de notes trouvée.'; 
            return; 
        }

        // Sépare les pôles (groupeMatiere=true) des matières (groupeMatiere=false)
        const poles = disciplines.filter(d => d.groupeMatiere === true);
        const matieres = disciplines.filter(d => d.groupeMatiere === false);

        const wrapper = document.createElement('div');
        wrapper.className = 'notes-wrapper';

        // Moyenne générale en haut
        if (moyGenerale !== null) {
            const genDiv = document.createElement('div');
            genDiv.className = 'moyenne-generale';
            genDiv.innerHTML = `
                <div class="moy-label">Moyenne générale</div>
                <div class="moy-value">${fmt(moyGenerale)}</div>
            `;
            wrapper.appendChild(genDiv);
        }

        // Pôles
        poles.forEach(pole => {
            // Utilise pole.discipline qui contient "Pôle littéraire", "Pôle scientifique", etc.
            const poleNom = pole.discipline || pole.nom || pole.name || 'Pôle';
            const poleMoy = normalizeNumber(pole.moyenne ?? pole.moyenneGenerale ?? pole['Moyenne']);
            const poleMoyClasse = normalizeNumber(pole.moyenneClasse ?? pole.moy_classe ?? pole.moyClasse ?? pole['Moy.Classe']);
            const poleMin = normalizeNumber(pole.min ?? pole['Min']);
            const poleMax = normalizeNumber(pole.max ?? pole['Max']);

            const poleBlock = document.createElement('div');
            poleBlock.className = 'pole-block';

            const colorClass = POLE_COLOR_CLASS[poleNom.toLowerCase()] || 'pole-autres';
            const poleHeader = document.createElement('div');
            poleHeader.className = `pole-header ${colorClass}`;
            poleHeader.innerHTML = `
                <div class="pole-title">${poleNom}</div>
                <div class="pole-stats">
                    ${poleMoy !== null ? `<span>Élève: <strong>${fmt(poleMoy)}</strong></span>` : ''}
                    ${poleMoyClasse !== null ? `<span>Classe: <strong>${fmt(poleMoyClasse)}</strong></span>` : ''}
                    ${poleMax !== null ? `<span>Max: <strong>${fmt(poleMax)}</strong></span>` : ''}
                    ${poleMin !== null ? `<span>Min: <strong>${fmt(poleMin)}</strong></span>` : ''}
                </div>
            `;
            poleBlock.appendChild(poleHeader);

            // Filtre les matières du pôle depuis le tableau disciplines plat
            // Les matières ont groupeMatiere=false et idGroupeMatiere qui pointe vers le pôle
            const poleId = pole.idGroupeMatiere || pole.id;
            const matieresDuPole = matieres.filter(m => 
                m.idGroupeMatiere === poleId || 
                m.id_groupe_matiere === poleId
            );

            if (matieresDuPole.length) {
                const matieresContainer = document.createElement('div');
                matieresContainer.className = 'matieres-grid';
                matieresDuPole.forEach(mat => {
                    const matNom = mat.discipline || mat.nom || mat.name || mat.matiere || mat['Nom'] || 'Matière';
                    const matMoy = normalizeNumber(mat.moyenne ?? mat.moyenneEleve ?? mat['Moyenne']);
                    const matMoyClasse = normalizeNumber(mat.moyenneClasse ?? mat.moy_classe ?? mat.moyClasse ?? mat['Moy.Classe']);
                    // Ajout de plus de clés pour tenter de trouver min/max
                    const matMin = normalizeNumber(mat.min ?? mat.minClasse ?? mat.moyenneMin ?? mat['Min']);
                    const matMax = normalizeNumber(mat.max ?? mat.maxClasse ?? mat.moyenneMax ?? mat['Max']);
                    const coef = mat.coef ?? mat.coefficient ?? mat['Coef'];
                    const prof = (mat.professeurs && mat.professeurs.length > 0) ? mat.professeurs[0].nom : (mat.professeur ?? mat.prof ?? mat['Professeur'] ?? '');

                    const matCard = document.createElement('div');
                    matCard.className = 'matiere-card';
                    matCard.style.cursor = 'pointer';
                    matCard.innerHTML = `
                        <div class="matiere-header">
                            <div>${matiereBadgeHtml(matNom)}</div>
                            ${coef ? `<div class="coef-badge">Coef ${coef}</div>` : ''}
                        </div>
                        ${prof ? `<div class="prof-name">${prof}</div>` : ''}
                        <div class="matiere-stats">
                            ${matMoy !== null ? `<span>Élève: <strong>${fmt(matMoy)}</strong></span>` : ''}
                            ${matMoyClasse !== null ? `<span>Classe: <strong>${fmt(matMoyClasse)}</strong></span>` : ''}
                            ${matMax !== null ? `<span>Max: <strong>${fmt(matMax)}</strong></span>` : ''}
                            ${matMin !== null ? `<span>Min: <strong>${fmt(matMin)}</strong></span>` : ''}
                        </div>
                    `;

                    // Ajoute un événement pour ouvrir le modal avec les notes
                    matCard.addEventListener('click', () => {
                        openNotesModal(matNom, mat);
                    });

                    matieresContainer.appendChild(matCard);
                });
                poleBlock.appendChild(matieresContainer);
            }

            wrapper.appendChild(poleBlock);
        });

        container.innerHTML = '';
        container.appendChild(wrapper);
    }

    function sanitizeHtml(str){
        try { return DOMPurify.sanitize(str || ''); } catch { return str || ''; }
    }

    function extractTitleFromHtml(html) {
        try {
            const tmp = document.createElement('div');
            tmp.innerHTML = String(html || '');
            const text = (tmp.textContent || '').replace(/\s+/g, ' ').trim();
            if (!text) return 'Devoir';
            return text.length > 120 ? (text.slice(0, 117) + '...') : text;
        } catch {
            return 'Devoir';
        }
    }

    function closeDevoirModal() {
        const modal = byId('devoir-modal');
        if (modal) modal.classList.remove('active');
    }

    async function setDevoirEffectue(idDevoir, effectue) {
        const siteUser = localStorage.getItem('source_username') || '';
        const res = await fetch('/ed/devoirs/effectue', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(siteUser ? { 'x-source-user': siteUser } : {})
            },
            body: JSON.stringify({ idDevoir, effectue })
        });
        return res;
    }

    function updateDevoirInCache(idDevoir, effectue) {
        try {
            const cached = loadDevoirsCache();
            if (!cached || !cached.data || !Array.isArray(cached.data.devoirs)) return;
            const target = cached.data.devoirs.find(x => (x && (x.idDevoir || x.id)) == idDevoir);
            if (target) target.effectue = effectue;
            if (cached.range) saveDevoirsCache(cached.range, cached.data);
        } catch {}
    }

    function openDevoirModal(devoir, onToggle) {
        const modal = byId('devoir-modal');
        const titleEl = byId('devoir-modal-title');
        const bodyEl = byId('devoir-modal-body');
        if (!modal || !titleEl || !bodyEl) return;

        const donneLe = devoir.donneLe || '';
        const matiere = devoir.matiere || 'Matière';
        const prof = devoir.nomProf || '';
        const idDevoir = devoir.idDevoir || devoir.id;
        const effectue = !!devoir.effectue;
        const contenu = sanitizeHtml(devoir.contenu || '');
        const pieces = Array.isArray(devoir.piecesJointes) ? devoir.piecesJointes : [];
        const isControle = !!(devoir.isControle || devoir.interrogation);

        // Pas de titre "devoir": on met la matière
        titleEl.textContent = '';
        titleEl.appendChild(document.createTextNode(matiere));
        if (isControle) {
            const badge = document.createElement('span');
            badge.className = 'devoir-badge-controle';
            badge.textContent = 'CONTRÔLE';
            titleEl.appendChild(badge);
        }

        bodyEl.innerHTML = '';

        // 1) Case "effectué" en haut
        const top = document.createElement('div');
        top.className = 'devoir-modal-top';
        const chkWrap = document.createElement('div');
        chkWrap.style.display = 'flex';
        chkWrap.style.alignItems = 'center';
        chkWrap.style.gap = '10px';
        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.className = 'devoir-checkbox';
        chk.checked = effectue;
        if (!idDevoir) {
            chk.disabled = true;
            chk.title = "Impossible de modifier ce devoir (idDevoir manquant)";
        }
        chk.addEventListener('change', async () => {
            if (!idDevoir) return;
            const desired = chk.checked;
            try {
                const res = await setDevoirEffectue(idDevoir, desired);
                if (!res.ok) throw new Error('HTTP ' + res.status);
                updateDevoirInCache(idDevoir, desired);
                if (typeof onToggle === 'function') onToggle(desired);
            } catch (e) {
                chk.checked = !desired;
            }
        });
        chkWrap.appendChild(chk);
        top.appendChild(chkWrap);
        bodyEl.appendChild(top);

        // 2) Prof en gros en bas + date à côté (petit)
        const bottomLine = document.createElement('div');
        bottomLine.className = 'devoir-modal-bottomline';
        const profEl = document.createElement('div');
        profEl.className = 'devoir-modal-prof';
        profEl.textContent = prof || '';
        const dateEl = document.createElement('div');
        dateEl.className = 'devoir-modal-date';
        dateEl.textContent = donneLe || '';
        bottomLine.appendChild(profEl);
        bottomLine.appendChild(dateEl);
        bodyEl.appendChild(bottomLine);

        // 3) Petite ligne séparatrice avec padding gauche/droite
        const sep = document.createElement('div');
        sep.className = 'devoir-modal-sep';
        bodyEl.appendChild(sep);

        // 4) Devoir (description)
        const desc = document.createElement('div');
        desc.className = 'devoir-pj';
        desc.innerHTML = `<div>${contenu || '<i>Aucune description</i>'}</div>`;
        bodyEl.appendChild(desc);

        // 5) Pièces jointes
        const pj = document.createElement('div');
        pj.className = 'devoir-pj';
        const pjTitle = document.createElement('div');
        pjTitle.style.fontWeight = '800';
        pjTitle.style.marginTop = '12px';
        pjTitle.style.marginBottom = '6px';
        pjTitle.textContent = 'Pièces jointes:';
        pj.appendChild(pjTitle);

        if (pieces.length === 0) {
            const none = document.createElement('div');
            none.innerHTML = '<i>Aucune</i>';
            pj.appendChild(none);
        } else {
            const list = document.createElement('div');
            pieces.forEach((p, idx) => {
                const item = document.createElement('div');
                item.style.marginBottom = '8px';
                const label = p.libelle || 'Document';
                const fileId = p.id || p.idPJ || p.fileId || idx;
                
                // Crée une URL de téléchargement via le backend
                const downloadUrl = `/ed/devoir/download/${idDevoir}/${fileId}`;
                
                console.log(`PJ ${idx}:`, { label, fileId, downloadUrl, hasUrl: !!p.url, hasId: !!p.id });
                
                if (fileId) {
                    const link = document.createElement('a');
                    link.href = 'javascript:void(0)';
                    link.textContent = label;
                    link.style.cursor = 'pointer';
                    link.style.color = '#0066cc';
                    link.style.textDecoration = 'underline';
                    link.style.display = 'inline-block';
                    link.style.fontWeight = '500';
                    link.style.padding = '4px 8px';
                    link.style.borderRadius = '3px';
                    link.style.transition = 'background-color 0.2s';
                    link.style.backgroundColor = 'transparent';
                    
                    link.addEventListener('mouseenter', () => {
                        link.style.backgroundColor = '#e7f1ff';
                    });
                    link.addEventListener('mouseleave', () => {
                        link.style.backgroundColor = '';
                    });
                    
                    link.addEventListener('click', async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('Clic sur:', label, downloadUrl);
                        const originalText = link.textContent;
                        link.textContent = '⏳ Téléchargement...';
                        link.style.opacity = '0.6';
                        link.style.pointerEvents = 'none';
                        
                        try {
                            const siteUser = localStorage.getItem('source_username') || '';
                            const response = await fetch(downloadUrl, {
                                headers: siteUser ? { 'x-source-user': siteUser } : {}
                            });
                            if (!response.ok) throw new Error(`HTTP ${response.status}`);
                            const blob = await response.blob();
                            const blobUrl = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = blobUrl;
                            a.download = label;
                            document.body.appendChild(a);
                            a.click();
                            setTimeout(() => {
                                window.URL.revokeObjectURL(blobUrl);
                                document.body.removeChild(a);
                            }, 100);
                            
                            console.log('Téléchargement réussi:', label);
                            // Succès
                            link.textContent = '✓ Téléchargé';
                            setTimeout(() => {
                                link.textContent = originalText;
                                link.style.opacity = '1';
                                link.style.pointerEvents = 'auto';
                            }, 2000);
                        } catch (err) {
                            console.error('Erreur lors du téléchargement:', err);
                            link.textContent = '✗ Erreur';
                            link.style.color = '#dc3545';
                            setTimeout(() => {
                                link.textContent = originalText;
                                link.style.color = '#0066cc';
                                link.style.opacity = '1';
                                link.style.pointerEvents = 'auto';
                            }, 2000);
                        }
                    });
                    item.appendChild(link);
                } else {
                    item.textContent = label;
                    item.style.color = '#999';
                    console.log('PJ sans ID:', label);
                }
                list.appendChild(item);
            });
            pj.appendChild(list);
        }
        bodyEl.appendChild(pj);

        modal.classList.add('active');
    }

    // Fonctions pour gérer le modal des notes
    function openNotesModal(matNom, matiere) {
        const modal = byId('notes-modal');
        const modalTitle = byId('modal-matiere-name');
        const modalList = byId('modal-notes-list');
        const graphBtn = byId('modal-graph-btn');
        const simBtn = byId('modal-sim-btn');

        if (!modal) return;

        modalTitle.textContent = matNom;
        modalList.innerHTML = '';

        // Estimation "prochaine date" à côté du nom de la matière
        let estimateEl = byId('modal-matiere-estimation');
        if (!estimateEl && modalTitle) {
            estimateEl = document.createElement('span');
            estimateEl.id = 'modal-matiere-estimation';
            estimateEl.className = 'matiere-estimation';
            modalTitle.insertAdjacentElement('afterend', estimateEl);
        }

        // Récupère les notes de la matière depuis la structure globale
        const structure = window.cartableCurrentStructure;
        let notes = [];
        
        if (structure && structure.notes && Array.isArray(structure.notes)) {
            // Filtre les notes pour cette matière par code matière ou libellé
            const matCode = matiere.code || matiere.codeMatiere || matiere.codeDisc;
            const matLibelle = matiere.discipline || matiere.libelle || matiere.libelleMatiere;
            
            // Récupère le code de période actuel
            const currentPeriodeId = window.cartableCurrentPeriodeId;
            let codePeriodeActuel = '';
            if (currentPeriodeId && structure?.periodes) {
                const periodeFound = structure.periodes.find(p => p.idPeriode === currentPeriodeId);
                if (periodeFound) codePeriodeActuel = periodeFound.codePeriode;
            }
            
            // Filtre les notes qui correspondent à cette matière ET cette période
            notes = structure.notes.filter(n => {
                const matchMat = (matCode && n.codeMatiere === matCode) || (matLibelle && n.libelleMatiere === matLibelle);
                const matchPeriode = !codePeriodeActuel || n.codePeriode === codePeriodeActuel;
                return matchMat && matchPeriode;
            });
        }

        // Configuration du bouton graphique
        if (graphBtn) {
            graphBtn.onclick = () => {
                modal.classList.remove('active');
                openGraphModal(matNom, notes, matiere);
            };
            // Cache le bouton s'il n'y a pas au moins 2 notes
            graphBtn.style.display = (notes && notes.length >= 2) ? 'flex' : 'none';
        }

        // Bouton simulation: ouvre un panneau dédié (modal), comme le bouton Graphique
        if (simBtn) {
            simBtn.onclick = () => {
                modal.classList.remove('active');
                openSimModal(matNom, notes, matiere);
            };
            simBtn.style.display = 'flex';
        }

        if (estimateEl) {
            const est = computeAverageEstimation(notes);
            if (est === null) {
                estimateEl.textContent = '';
                estimateEl.style.display = 'none';
            } else {
                const target = computeTargetEstimationDate(new Date());
                const dateLabel = target.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
                estimateEl.textContent = `Estimation pour le ${dateLabel} : ${est.toFixed(2)}`;
                estimateEl.style.display = 'inline-block';
            }
        }

        if (!notes || notes.length === 0) {
            modalList.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">Aucune note trouvée pour cette période.</p>';
            modal.classList.add('active');
            return;
        }

        // Trie les notes du plus récent au plus ancien
        notes.sort((a, b) => {
            const dateA = new Date(a.date || a.dateSaisie || a.dateDevoir || '0');
            const dateB = new Date(b.date || b.dateSaisie || b.dateDevoir || '0');
            return dateA - dateB;
        });

        // Crée les éléments pour chaque note (Vue simplifiée)
        notes.forEach(note => {
            const noteItem = document.createElement('div');
            noteItem.className = 'note-item';
            
            const sujet = note.sujet || note.libelle || note.devoir || note.description || 'Note';
            const date = note.date || note.dateSaisie || note.dateDevoir || '-';
            const noteVal = normalizeNumber(note.valeur ?? note.note ?? note.value);
            const coef = note.coef ?? note.coefficient ?? '-';
            const noteSur = normalizeNumber(note.noteSur ?? note.max ?? note['NoteSur']) || 20;
            const moyClasse = normalizeNumber(note.moyenneClasse ?? note.moy_classe ?? note['Moy.Classe']);
            const noteMax = normalizeNumber(note.maxClasse ?? note.noteSur ?? note.max ?? note['NoteSur']);
            const noteMin = normalizeNumber(note.minClasse ?? note.min ?? note['Min']);

            // Format de la note: "15.5" avec "/20" en petit
            const noteDisplay = noteVal !== null ? `${fmt(noteVal)}<sup>/${noteSur}</sup>` : `Abs<sup>/${noteSur}</sup>`;

            // Calcul de la couleur de fond (Pâle) selon le pourcentage
            let bgColor = '#ffffff'; // Blanc par défaut (ou pour Abs)
            let textColor = '#000000'; // Noir par défaut pour lisibilité
            let coefColor = '#444444'; // Gris foncé pour le coef

            if (noteVal !== null && noteSur > 0) {
                const pct = (noteVal / noteSur) * 100;
                
                if (pct < 25) {
                    bgColor = '#ffb3b3'; // Rouge (plus visible)
                } else if (pct < 50) {
                    bgColor = '#ffcc80'; // Orange (plus visible)
                } else if (pct < 65) {
                    bgColor = '#fff176'; // Jaune (plus visible)
                } else if (pct < 90) {
                    bgColor = '#90caf9'; // Bleu (plus visible)
                } else {
                    bgColor = '#a5d6a7'; // Vert (plus visible)
                }
            }

            // Contenu simplifié : Note + Coef
            noteItem.style.background = bgColor;
            noteItem.style.borderColor = 'rgba(0,0,0,0.05)'; // Bordure discrète
            
            noteItem.innerHTML = `
                <div class="note-item-value" style="color: ${textColor}">${noteDisplay}</div>
                <div class="note-item-coef" style="color: ${coefColor}">Coef ${coef}</div>
            `;

            // Ajoute un événement pour afficher les détails au clic
            noteItem.addEventListener('click', (e) => {
                e.stopPropagation();
                showNoteDetail(e.pageX, e.pageY, {
                    sujet: sujet,
                    date: date,
                    note: noteVal,
                    noteSur: noteSur,
                    coef: coef,
                    moyClasse: moyClasse,
                    noteMax: noteMax,
                    noteMin: noteMin
                });
            });

            modalList.appendChild(noteItem);
        });

        modal.classList.add('active');
    }

    function closeNotesModal() {
        const modal = byId('notes-modal');
        if (modal) modal.classList.remove('active');
        // Ferme aussi le détail si ouvert
        const existing = document.querySelector('.note-detail-popover');
        if (existing) existing.remove();
    }

    // Variable globale pour stocker l'instance du graphique
    let currentChartInstance = null;

    function computeWeightedAverage20(notes, extra) {
        const items = Array.isArray(notes) ? notes.slice() : [];
        if (extra) items.push(extra);

        let wSum = 0;
        let vSum = 0;

        for (const n of items) {
            const valRaw = normalizeNumber(n.valeur ?? n.note ?? n.value);
            const surRaw = normalizeNumber(n.noteSur ?? n.max ?? n['NoteSur']) || 20;
            if (valRaw === null || !surRaw || surRaw <= 0) continue;

            const coef = normalizeNumber(n.coef ?? n.coefficient ?? n['Coef']) || 1;
            const v20 = (valRaw / surRaw) * 20;

            vSum += v20 * coef;
            wSum += coef;
        }

        if (wSum <= 0) return null;
        return vSum / wSum;
    }

    function computeNoteV20(n) {
        const valRaw = normalizeNumber(n.valeur ?? n.note ?? n.value);
        const surRaw = normalizeNumber(n.noteSur ?? n.max ?? n['NoteSur']) || 20;
        if (valRaw === null || !surRaw || surRaw <= 0) return null;
        return (valRaw / surRaw) * 20;
    }

    function computeClassAvgV20(n) {
        const c = normalizeNumber(n.moyenneClasse ?? n.moyClasse ?? n.moy_classe ?? n['Moy.Classe']);
        const surRaw = normalizeNumber(n.noteSur ?? n.max ?? n['NoteSur']) || 20;
        if (c === null || !surRaw || surRaw <= 0) return null;
        return (c / surRaw) * 20;
    }

    function computeTargetEstimationDate(now = new Date()) {
        const d = new Date(now);
        const day = d.getDate();
        const month = d.getMonth();
        const year = d.getFullYear();

        const makeDate = (y, m, targetDay) => {
            const lastDay = new Date(y, m + 1, 0).getDate();
            const safeDay = Math.min(targetDay, lastDay);
            return new Date(y, m, safeDay);
        };

        // Quadrillage simple: projection au 14 ou au 29
        if (day <= 14) return makeDate(year, month, 14);
        if (day <= 29) return makeDate(year, month, 29);
        return makeDate(year, month + 1, 14);
    }

    function computeAverageEstimation(notes) {
        const avg = computeWeightedAverage20(notes);
        if (avg === null) return null;

        const sorted = (Array.isArray(notes) ? notes.slice() : []).sort((a, b) => {
            const da = new Date(a.date || a.dateSaisie || a.dateDevoir || '0');
            const db = new Date(b.date || b.dateSaisie || b.dateDevoir || '0');
            return da - db;
        });

        const v = sorted.map(computeNoteV20).filter(x => typeof x === 'number' && Number.isFinite(x));
        const n = v.length;
        const k = Math.min(3, Math.floor(n / 2));

        let trendAdj = 0;
        if (k >= 1) {
            const prev = v.slice(Math.max(0, n - 2 * k), Math.max(0, n - k));
            const last = v.slice(Math.max(0, n - k));
            const mean = (arr) => arr.length ? (arr.reduce((s, x) => s + x, 0) / arr.length) : null;
            const prevMean = mean(prev);
            const lastMean = mean(last);
            if (prevMean !== null && lastMean !== null) {
                const delta = lastMean - prevMean;
                // Petit ajustement pour suivre la tendance sans sur-estimer
                trendAdj = Math.max(-0.25, Math.min(0.25, delta * 0.10));
            }
        }

        // Si l'élève est au-dessus d'une classe "basse", il est probablement solide
        const withClass = sorted
            .map(n0 => {
                const s20 = computeNoteV20(n0);
                const c20 = computeClassAvgV20(n0);
                if (s20 === null || c20 === null) return null;
                return { s20, c20 };
            })
            .filter(Boolean);

        const recent = withClass.slice(-3);
        let classAdj = 0;
        if (recent.length) {
            const diffs = recent.map(x => x.s20 - x.c20);
            const diffMean = diffs.reduce((s, x) => s + x, 0) / diffs.length;
            if (diffMean > 2) classAdj = 0.2;
            else if (diffMean > 1) classAdj = 0.12;
            else if (diffMean > 0.5) classAdj = 0.06;
        }

        let est = avg + trendAdj + classAdj;

        // Effet "yo-yo": si ça alterne (bonne/mauvaise) on évite de projeter trop haut
        // Exemple: une bonne note vient de tomber => estimation un peu plus basse.
        if (v.length >= 3) {
            const window = v.slice(-6);
            const diffs = [];
            for (let i = 1; i < window.length; i++) diffs.push(window[i] - window[i - 1]);
            const signs = diffs.map(d => Math.sign(d)).filter(s => s !== 0);

            let signChanges = 0;
            for (let i = 1; i < signs.length; i++) {
                if (signs[i] !== signs[i - 1]) signChanges++;
            }

            const oscillation = signs.length >= 2 ? (signChanges / (signs.length - 1)) : 0;

            const lastDelta = (window.length >= 2) ? (window[window.length - 1] - window[window.length - 2]) : 0;

            // Volatilité (écart-type) pour réduire les estimations quand c'est irrégulier
            const meanW = window.reduce((s, x) => s + x, 0) / window.length;
            const variance = window.reduce((s, x) => s + Math.pow(x - meanW, 2), 0) / window.length;
            const sd = Math.sqrt(variance);

            // Si oscillation forte: on préfère revenir vers la moyenne
            if (oscillation >= 0.6) {
                // Si la dernière note est montée, on anticipe une possible redescente
                if (lastDelta > 0) {
                    est -= Math.min(0.28, 0.08 + Math.abs(lastDelta) * 0.08);
                } else if (lastDelta < 0) {
                    // Si la dernière a chuté, on n'augmente que très peu (conservateur)
                    est += Math.min(0.10, Math.abs(lastDelta) * 0.03);
                }
            }

            // Shrink global selon volatilité (plus c'est instable, plus on colle à avg)
            if (Number.isFinite(sd) && sd > 0.9) {
                const shrink = Math.max(0.55, 1 - Math.min(0.45, (sd / 5) * 0.45));
                est = avg + (est - avg) * shrink;
            }
        }
        // Reste proche de la moyenne actuelle
        const maxDelta = 0.35;
        est = Math.max(avg - maxDelta, Math.min(avg + maxDelta, est));

        // Ne dépasse pas un "max historique" (l'élève n'a pas eu de 18 => on évite 18)
        if (v.length) {
            const maxHist = Math.max(...v);
            est = Math.min(est, maxHist + 0.15);
        }

        est = Math.max(0, Math.min(20, est));
        return est;
    }

    function openSimModal(matNom, notes, matiere) {
        const modal = byId('sim-modal');
        const titleEl = byId('sim-modal-title');
        const closeBtn = byId('sim-modal-close');
        const bodyEl = byId('sim-modal-body');

        if (!modal || !bodyEl) return;

        if (titleEl) titleEl.textContent = `Simulation - ${matNom}`;
        bodyEl.innerHTML = '';

        const panel = document.createElement('div');
        panel.className = 'graph-sim-panel';
        bodyEl.appendChild(panel);

        const avgCurrent = computeWeightedAverage20(notes);

        panel.innerHTML = `
            <div class="graph-sim-title">${matNom}</div>
            <div class="graph-sim-form">
                <label class="graph-sim-field">
                    <span>Note</span>
                    <input id="sim-note" type="number" step="0.01" inputmode="decimal" placeholder="ex: 15.5" />
                </label>
                <label class="graph-sim-field">
                    <span>Sur</span>
                    <input id="sim-sur" type="number" step="0.01" inputmode="decimal" value="20" />
                </label>
                <label class="graph-sim-field">
                    <span>Coef</span>
                    <input id="sim-coef" type="number" step="0.1" inputmode="decimal" value="1" />
                </label>
                <button id="sim-validate" type="button" class="graph-sim-validate">Valider</button>
            </div>
            <div class="graph-sim-caption">Moyenne</div>
            <div id="sim-result" class="graph-sim-result" style="display:none;"></div>
        `;

        const noteInput = byId('sim-note');
        const surInput = byId('sim-sur');
        const coefInput = byId('sim-coef');
        const validateBtn = byId('sim-validate');
        const resultEl = byId('sim-result');

        const renderResult = (newAvg) => {
            if (!resultEl) return;
            if (avgCurrent === null || newAvg === null) {
                resultEl.style.display = 'none';
                return;
            }
            resultEl.style.display = 'flex';
            resultEl.innerHTML = `
                <span class="sim-avg">${avgCurrent.toFixed(2)}</span>
                <span class="sim-arrow">→</span>
                <span class="sim-avg sim-avg-new">${newAvg.toFixed(2)}</span>
            `;
        };

        if (validateBtn) {
            validateBtn.onclick = () => {
                const v = normalizeNumber(noteInput?.value);
                const s = normalizeNumber(surInput?.value) || 20;
                const c = normalizeNumber(coefInput?.value) || 1;
                if (v === null || !s || s <= 0) {
                    if (resultEl) resultEl.style.display = 'none';
                    return;
                }
                const extra = { valeur: v, noteSur: s, coef: c };
                const newAvg = computeWeightedAverage20(notes, extra);
                renderResult(newAvg);
            };
        }

        const closeModal = () => {
            modal.classList.remove('active');
            if (matiere) openNotesModal(matNom, matiere);
        };

        if (closeBtn) closeBtn.onclick = closeModal;
        modal.onclick = (e) => {
            if (e.target === modal) closeModal();
        };

        modal.classList.add('active');
    }

    function openGraphModal(matNom, notes, matiere) {
        const modal = byId('graph-modal');
        const modalTitle = byId('graph-modal-title');
        const closeBtn = byId('graph-modal-close');
        const canvas = byId('notes-chart');

        if (!modal || !canvas) return;

        // Mini légende (toggle) : discrète mais utile
        const headerEl = closeBtn ? closeBtn.closest('.modal-header') : null;

        // Regroupe les actions à droite (sinon justify-content: space-between écarte tout)
        let actionsEl = byId('graph-modal-actions');
        if (!actionsEl && headerEl) {
            actionsEl = document.createElement('div');
            actionsEl.id = 'graph-modal-actions';
            actionsEl.className = 'graph-modal-actions';

            // Place le groupe d'actions après le titre
            headerEl.appendChild(actionsEl);

            // Déplace le bouton close dans le groupe
            if (closeBtn) actionsEl.appendChild(closeBtn);
        }


        let legendToggleBtn = byId('graph-legend-toggle');
        if (!legendToggleBtn && actionsEl) {
            legendToggleBtn = document.createElement('button');
            legendToggleBtn.id = 'graph-legend-toggle';
            legendToggleBtn.type = 'button';
            // On réutilise le style des boutons de modal pour un rendu cohérent
            legendToggleBtn.className = 'modal-close graph-legend-toggle';
            legendToggleBtn.title = 'Légende';
            legendToggleBtn.textContent = '≡';
            actionsEl.insertBefore(legendToggleBtn, closeBtn || null);
        }

        const graphContainer = canvas.closest('.graph-container');
        let legendEl = byId('graph-mini-legend');
        if (!legendEl && graphContainer) {
            legendEl = document.createElement('div');
            legendEl.id = 'graph-mini-legend';
            legendEl.className = 'graph-mini-legend';
            legendEl.style.display = 'none';
            graphContainer.appendChild(legendEl);
        }


        modalTitle.textContent = `Évolution - ${matNom}`;

        // Gestion fermeture
        const closeModal = () => {
            modal.classList.remove('active');
            if (legendEl) legendEl.style.display = 'none';
            if (matiere) {
                openNotesModal(matNom, matiere);
            }
        };
        closeBtn.onclick = closeModal;
        modal.onclick = (e) => {
            if (e.target === modal) closeModal();
        };

        if (legendToggleBtn && legendEl) {
            legendToggleBtn.onclick = () => {
                legendEl.style.display = (legendEl.style.display === 'none') ? 'block' : 'none';
            };
        }


        // Préparation des données
        // On filtre les notes numériques valides
        const validNotes = notes.filter(n => {
            const val = normalizeNumber(n.valeur ?? n.note ?? n.value);
            const sur = normalizeNumber(n.noteSur ?? n.max ?? n['NoteSur']) || 20;
            return val !== null && sur > 0;
        });

        // Tri chronologique (ancien -> récent)
        validNotes.sort((a, b) => {
            const dateA = new Date(a.date || a.dateSaisie || a.dateDevoir || '0');
            const dateB = new Date(b.date || b.dateSaisie || b.dateDevoir || '0');
            return dateA - dateB;
        });

        const labels = validNotes.map(n => {
            const d = n.date || n.dateSaisie || n.dateDevoir;
            return d ? d.split('-').reverse().join('/') : ''; // Format JJ/MM/AAAA si possible
        });

        const dataPoints = validNotes.map(n => {
            const val = normalizeNumber(n.valeur ?? n.note ?? n.value);
            const sur = normalizeNumber(n.noteSur ?? n.max ?? n['NoteSur']) || 20;
            return (val / sur) * 20; // Normalisation sur 20
        });


        // Courbe moyenne de classe + bande (min/max) centrée autour de la moyenne
        const classAvgPoints = validNotes.map(n => {
            const c = normalizeNumber(n.moyenneClasse ?? n.moyClasse ?? n.moy_classe ?? n['Moy.Classe']);
            const sur = normalizeNumber(n.noteSur ?? n.max ?? n['NoteSur']) || 20;
            if (c === null || sur <= 0) return null;
            return (c / sur) * 20;
        });

        const bandLowPoints = validNotes.map(n => {
            const b = normalizeNumber(n.minClasse ?? n.min ?? n['Min']);
            const c = normalizeNumber(n.moyenneClasse ?? n.moyClasse ?? n.moy_classe ?? n['Moy.Classe']);
            const sur = normalizeNumber(n.noteSur ?? n.max ?? n['NoteSur']) || 20;
            if (b === null || c === null || sur <= 0) return null;
            const b20 = (b / sur) * 20;
            const c20 = (c / sur) * 20;
            return (b20 + c20) / 2;
        });

        const bandHighPoints = validNotes.map(n => {
            const h = normalizeNumber(n.maxClasse ?? n.max ?? n['Max']);
            const c = normalizeNumber(n.moyenneClasse ?? n.moyClasse ?? n.moy_classe ?? n['Moy.Classe']);
            const sur = normalizeNumber(n.noteSur ?? n.max ?? n['NoteSur']) || 20;
            if (h === null || c === null || sur <= 0) return null;
            const h20 = (h / sur) * 20;
            const c20 = (c / sur) * 20;
            return (h20 + c20) / 2;
        });

        const pointColors = validNotes.map(n => {
            const val = normalizeNumber(n.valeur ?? n.note ?? n.value);
            const sur = normalizeNumber(n.noteSur ?? n.max ?? n['NoteSur']) || 20;
            const pct = (val / sur) * 100;
            
            if (pct < 25) return '#ffb3b3';
            if (pct < 50) return '#ffcc80';
            if (pct < 65) return '#fff176';
            if (pct < 90) return '#90caf9';
            return '#a5d6a7';
        });

        // Destruction de l'ancien graphique s'il existe
        if (currentChartInstance) {
            currentChartInstance.destroy();
        }

        // Création du nouveau graphique
        const ctx = canvas.getContext('2d');

        // Remplit la mini légende (si dispo)
        if (legendEl) {
            legendEl.innerHTML = `
                <div class="graph-mini-legend-row"><span class="swatch swatch-notes"></span><span>Élève</span></div>
                <div class="graph-mini-legend-row"><span class="swatch swatch-classe"></span><span>Moy. classe</span></div>
                <div class="graph-mini-legend-row"><span class="swatch swatch-band"></span><span>Zone moyenne</span></div>
            `;
        }

        currentChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    // Bande basse (point bas = (b+c)/2)
                    {
                        label: 'Bande basse',
                        data: bandLowPoints,
                        borderColor: 'rgba(255, 241, 118, 0.9)',
                        borderWidth: 1,
                        pointRadius: 0,
                        tension: 0.3,
                        order: 0
                    },
                    // Bande haute (point haut = (h+c)/2) + remplissage vers la bande basse
                    {
                        label: 'Bande haute',
                        data: bandHighPoints,
                        borderColor: 'rgba(255, 241, 118, 0.9)',
                        borderWidth: 1,
                        pointRadius: 0,
                        tension: 0.3,
                        fill: '-1',
                        backgroundColor: 'rgba(255, 241, 118, 0.35)',
                        order: 0
                    },
                    // Moyenne classe (ligne noire, derrière)
                    {
                        label: 'Moyenne classe',
                        data: classAvgPoints,
                        borderColor: 'rgba(0,0,0,0.85)',
                        borderWidth: 2,
                        pointRadius: 0,
                        tension: 0.3,
                        order: 5
                    },
                    // Tes notes (par-dessus)
                    {
                        label: 'Note / 20',
                        data: dataPoints,
                        borderColor: '#888',
                        borderWidth: 3,
                        pointBackgroundColor: pointColors,
                        pointBorderColor: '#666',
                        pointRadius: 6,
                        pointHoverRadius: 8,
                        fill: false,
                        tension: 0.3,
                        segment: {
                            borderColor: (segmentCtx) => {
                                try {
                                    const i0 = segmentCtx.p0DataIndex;
                                    const i1 = segmentCtx.p1DataIndex;
                                    const c0 = pointColors[i0] || '#888';
                                    const c1 = pointColors[i1] || c0;
                                    const g = segmentCtx.chart.ctx.createLinearGradient(
                                        segmentCtx.p0.x,
                                        segmentCtx.p0.y,
                                        segmentCtx.p1.x,
                                        segmentCtx.p1.y
                                    );
                                    g.addColorStop(0, c0);
                                    g.addColorStop(1, c1);
                                    return g;
                                } catch (_) {
                                    return '#888';
                                }
                            }
                        },
                        order: 1000
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 20,
                        grid: {
                            color: 'rgba(0,0,0,0.05)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                if (context.dataset && context.dataset.label === 'Note / 20') {
                                    return `Note: ${context.parsed.y.toFixed(2)}/20`;
                                }
                                if (context.dataset && context.dataset.label === 'Moyenne classe') {
                                    return `Moyenne classe: ${context.parsed.y.toFixed(2)}/20`;
                                }
                                return null;
                            }
                        }
                    }
                }
            },
            plugins: [
                {
                    id: 'studentLineOnTop',
                    afterDatasetsDraw(chart) {
                        // Redessine le dataset "Note / 20" en dernier pour qu'il passe devant la zone jaune
                        const datasets = chart?.data?.datasets || [];
                        const idx = datasets.findIndex(d => d && d.label === 'Note / 20');
                        if (idx < 0) return;
                        const meta = chart.getDatasetMeta(idx);
                        if (!meta || meta.hidden) return;
                        if (meta.controller && typeof meta.controller.draw === 'function') {
                            meta.controller.draw();
                        }
                    }
                }
            ]
        });

        modal.classList.add('active');
    }

    function showNoteDetail(x, y, noteData) {
        // Supprime tout détail existant
        const existing = document.querySelector('.note-detail-popover');
        if (existing) existing.remove();

        const popover = document.createElement('div');
        popover.className = 'note-detail-popover';
        
        // Contenu détaillé demandé
        popover.innerHTML = `
            <div class="note-detail-title">${noteData.sujet}</div>
            
            <div class="note-detail-row">
                <span class="note-detail-label">Date</span>
                <span class="note-detail-val">${noteData.date}</span>
            </div>
            
            <div class="note-detail-row">
                <span class="note-detail-label">Ta note</span>
                <span class="note-detail-val highlight">${noteData.note !== null ? fmt(noteData.note) : 'Abs'}<span style="font-size:0.8em; opacity:0.7">/${noteData.noteSur}</span></span>
            </div>
            
            <div class="note-detail-row">
                <span class="note-detail-label">Coefficient</span>
                <span class="note-detail-val">${noteData.coef}</span>
            </div>
            
            <div style="height:1px; background:rgba(255,255,255,0.1); margin: 8px 0;"></div>
            
            <div class="note-detail-row">
                <span class="note-detail-label">Moyenne classe</span>
                <span class="note-detail-val">${noteData.moyClasse !== null ? fmt(noteData.moyClasse) : '-'}</span>
            </div>
            
            <div class="note-detail-row">
                <span class="note-detail-label">Max</span>
                <span class="note-detail-val">${noteData.noteMax !== null ? fmt(noteData.noteMax) : '-'}</span>
            </div>
            
            <div class="note-detail-row">
                <span class="note-detail-label">Min</span>
                <span class="note-detail-val">${noteData.noteMin !== null ? fmt(noteData.noteMin) : '-'}</span>
            </div>
        `;

        document.body.appendChild(popover);

        // Positionnement intelligent (Clamp to Viewport)
        const rect = popover.getBoundingClientRect();
        
        // Position par défaut : à droite du curseur
        let left = x + 15;
        let top = y - 10;

        // 1. Gestion horizontale (X)
        // Si ça dépasse à droite de l'écran
        if (left + rect.width > window.innerWidth - 10) {
            // On essaie de mettre à gauche du curseur
            left = x - rect.width - 15;
        }
        
        // Si ça dépasse maintenant à gauche de l'écran (ou si c'était déjà le cas)
        if (left < 10) {
            left = 10; // On colle au bord gauche
        }
        // Vérification finale droite (si l'écran est tout petit)
        if (left + rect.width > window.innerWidth - 10) {
            left = window.innerWidth - rect.width - 10; // On colle au bord droit
        }

        // 2. Gestion verticale (Y)
        // Si ça dépasse en bas
        if (top + rect.height > window.innerHeight - 10) {
            top = window.innerHeight - rect.height - 10; // On remonte
        }
        // Si ça dépasse en haut
        if (top < 10) {
            top = 10;
        }

        popover.style.left = left + 'px';
        popover.style.top = top + 'px';

        // Fermeture au clic ailleurs
        setTimeout(() => {
            const closeHandler = (e) => {
                popover.remove();
                document.removeEventListener('click', closeHandler);
            };
            document.addEventListener('click', closeHandler);
        }, 10);
    }

    function renderDevoirs(payload){
        const container = byId('devoirs-container');
        if (!container) return;
        if (!payload || !Array.isArray(payload.devoirs)) {
            container.textContent = 'Aucun devoir trouvé.';
            return;
        }

        console.log('[Devoirs] Total devoirs reçus:', payload.devoirs.length);

        // Filtre pour ne garder que les devoirs à venir (date >= aujourd'hui)
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Début de la journée (minuit)

        const devoirsAVenir = payload.devoirs.filter(d => {
            if (!d.date) return true; // Garde les devoirs sans date
            const devoirDate = new Date(d.date + 'T00:00:00');
            const isAVenir = devoirDate >= today;
            if (!isAVenir) {
                console.log('[Devoirs] Filtré (passé):', d.matiere, d.date);
            }
            return isAVenir; // Inclut le jour même
        });

        console.log('[Devoirs] Devoirs à venir:', devoirsAVenir.length);

        if (devoirsAVenir.length === 0) {
            container.textContent = 'Aucun devoir à venir.';
            return;
        }

        const ul = document.createElement('ul');
        devoirsAVenir.forEach(d => {
            const li = document.createElement('li');
            const mat = d.matiere || 'Matière';
            const donneLe = d.donneLe || '';
            const idDevoir = d.idDevoir || d.id;
            const effectue = d.effectue || false;
            const isControle = !!(d.isControle || d.interrogation);
            const dateAffichage = d.date ? formatJourNombre(d.date) : '';

            // Création de la case à cocher
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'devoir-checkbox';
            checkbox.checked = effectue;
            if (!idDevoir) {
                checkbox.disabled = true;
                checkbox.title = "Impossible de modifier ce devoir (idDevoir manquant)";
            }
            checkbox.addEventListener('click', (e) => e.stopPropagation());
            checkbox.addEventListener('change', async () => {
                if (!idDevoir) return;
                const desired = checkbox.checked;
                try {
                    const res = await setDevoirEffectue(idDevoir, desired);
                    if (!res.ok) throw new Error('HTTP ' + res.status);
                    updateDevoirInCache(idDevoir, desired);
                } catch {
                    checkbox.checked = !desired;
                }
            });

            // Contenu du devoir
            const contentDiv = document.createElement('div');
            contentDiv.className = 'devoir-content';

            const item = document.createElement('div');
            item.className = 'devoir-item';
            const top = document.createElement('div');
            top.className = 'devoir-topline';
            const title = document.createElement('div');
            title.className = 'devoir-title';
            // Pas de titre: on met la matière
            title.textContent = '';
            const matBadge = document.createElement('span');
            matBadge.textContent = mat;
            const matColor = getSubjectColor(mat);
            if (matColor) {
                matBadge.className = 'matiere-badge';
                matBadge.style.background = matColor;
                const isDark = (matColor === '#2e7d32' || matColor === '#ef5350');
                matBadge.style.color = isDark ? '#fff' : '#1a1a1a';
            }
            title.appendChild(matBadge);
            if (isControle) {
                const badge = document.createElement('span');
                badge.className = 'devoir-badge-controle';
                badge.textContent = 'CONTRÔLE';
                title.appendChild(badge);
            }
            top.appendChild(title);

            const meta = document.createElement('div');
            meta.className = 'devoir-meta';
            // Affiche le jour et le numéro du jour (ex: mercredi 13)
            meta.textContent = dateAffichage;
            // Affiche la date d'upload (donneLe) en tooltip au survol/clic
            if (donneLe) {
                meta.title = 'Date d\'upload : ' + donneLe;
                meta.style.cursor = 'pointer';
                meta.addEventListener('click', (e) => {
                    e.stopPropagation();
                    alert('Date d\'upload : ' + donneLe);
                });
            }

            item.appendChild(top);
            item.appendChild(meta);
            contentDiv.appendChild(item);

            // Ouvre le détail au clic sur la ligne
            li.addEventListener('click', () => {
                openDevoirModal(d, (newValue) => {
                    checkbox.checked = newValue;
                });
            });

            li.appendChild(checkbox);
            li.appendChild(contentDiv);
            ul.appendChild(li);
        });
        container.innerHTML = '';
        container.appendChild(ul);
    }

    // --- Cache using localStorage for persistence across reloads ---
    // IMPORTANT: cache par compte AlphaSource, sinon changement d'utilisateur => fuite des données.
    const CACHE_KEYS = {
        notes: 'ED_NOTES',
        devoirs: 'ED_DEVOIRS',
        devRange: 'ED_DEV_RANGE'
    };

    function cacheKey(base){
        const u = getSiteUser().toLowerCase();
        if (!u) return '';
        return base + ':' + u;
    }
    
    function saveNotesCache(data){ 
        try { 
            const key = cacheKey(CACHE_KEYS.notes);
            if (!key) return;
            const payload = { timestamp: Date.now(), data: data };
            localStorage.setItem(key, JSON.stringify(payload)); 
        } catch{} 
    }
    
    function loadNotesCache(){ 
        try { 
            const key = cacheKey(CACHE_KEYS.notes);
            if (!key) return null;
            const s = localStorage.getItem(key); 
            if (!s) return null;
            const p = JSON.parse(s);
            // Supporte format {timestamp, data} ou direct data (legacy)
            return p.data || p; 
        } catch{ return null; } 
    }

    function saveDevoirsCache(range, data){ 
        try { 
            const devoirsKey = cacheKey(CACHE_KEYS.devoirs);
            const rangeKey = cacheKey(CACHE_KEYS.devRange);
            if (!devoirsKey || !rangeKey) return;
            const payload = { timestamp: Date.now(), range: range, data: data };
            localStorage.setItem(devoirsKey, JSON.stringify(payload)); 
            // On garde devRange séparé si besoin, ou on l'intègre. 
            // Pour compatibilité script.js, on garde la clé séparée aussi si script.js l'utilise.
            // script.js utilise ED_DEV_RANGE pour stocker {start, end}.
            localStorage.setItem(rangeKey, JSON.stringify(range)); 
        } catch{} 
    }

    function loadDevoirsCache(){ 
        try { 
            const devoirsKey = cacheKey(CACHE_KEYS.devoirs);
            const rangeKey = cacheKey(CACHE_KEYS.devRange);
            if (!devoirsKey || !rangeKey) return { range:null, data:null };
            const dStr = localStorage.getItem(devoirsKey); 
            const rStr = localStorage.getItem(rangeKey); 
            
            let data = null;
            let range = null;

            if (dStr) {
                const p = JSON.parse(dStr);
                data = p.data || p; // Handle wrapped or raw
            }
            if (rStr) {
                range = JSON.parse(rStr);
            }
            
            return { range, data }; 
        } catch{ return { range:null, data:null }; } 
    }

    async function renderNotesCachedOrFetch(force=false, periodeId = ''){
        const cached = loadNotesCache();
        if (cached && !force) {
            console.log('[Cartable] Notes loaded from cache instantly.');
            renderNotes(cached, periodeId);
            // Background refresh if needed could go here
            return;
        }
        console.log('[Cartable] No notes cache, fetching...');
        await loadNotes('', periodeId);
    }

    async function renderDevoirsCachedOrFetch(force=false){
        const desiredStart = todayYmd();
        const desiredEnd = addDaysYmd(desiredStart, 30);
        const cached = loadDevoirsCache();

        const cachedStart = cached && cached.range ? cached.range.start : null;
        const cachedEnd = cached && cached.range ? cached.range.end : null;
        const hasDevoirsData = cached && cached.data && Array.isArray(cached.data.devoirs) && cached.data.devoirs.length > 0;
        const hasValidCache = !!(cached && cached.data && cachedStart && cachedEnd && hasDevoirsData);
        
        // On est moins strict sur la range exacte pour l'affichage immédiat
        // Si on a des données, on affiche.
        if (hasValidCache && !force) {
            console.log('[Cartable] Devoirs loaded from cache instantly.');
            renderDevoirs(cached.data);
            
            // Vérification silencieuse de la fraîcheur / range
            const rangeMatches = cachedStart === desiredStart && cachedEnd === desiredEnd;
            if (!rangeMatches) {
                console.log('[Cartable] Cache range mismatch (background update)...');
                loadDevoirs().catch(e => console.error('[Cartable] Background update failed', e));
            }
            return;
        }

        console.log('[Cartable] No devoirs cache or empty, fetching...');
        await loadDevoirs();
    }

    async function loadPeriodes() {
        // Try cache first to avoid unnecessary network call
        const cached = loadNotesCache();
        if (cached && Array.isArray(cached.periodes)) {
            console.log('[Cartable] Periodes loaded from cache.');
            return cached.periodes;
        }

        try {
            const siteUser = localStorage.getItem('source_username') || '';
            const res = await fetchWithTimeout(API_BASE + '/notes', {
                method: 'GET',
                headers: siteUser ? { 'x-source-user': siteUser } : undefined
            }, 6000);
            if (!res.ok) return [];
            const data = await safeJson(res);
            // Update cache since we fetched it
            saveNotesCache(data);
            // Les périodes sont directement dans la réponse
            return Array.isArray(data.periodes) ? data.periodes : [];
        } catch (err) {
            console.warn('[Cartable] loadPeriodes failed:', err.message || err);
            return [];
        }
    }

    async function loadNotes(anneeScolaire = '', periodeId = '') {
        let url = API_BASE + '/notes';
        if (anneeScolaire) url += '?anneeScolaire=' + encodeURIComponent(anneeScolaire);
        const siteUser = localStorage.getItem('source_username') || '';
        let res;
        try {
            res = await fetchWithTimeout(url, {
                method: 'GET',
                headers: siteUser ? { 'x-source-user': siteUser } : undefined
            }, 8000);
        } catch (e) {
            throw new Error('Timeout ou erreur réseau lors de la récupération des notes');
        }
        if (!res.ok) throw new Error('Erreur notes: ' + res.status);
        const data = await safeJson(res);
        renderNotes(data, periodeId);
        saveNotesCache(data);
        return data;
    }

    async function loadDevoirs() {
        // Charge automatiquement les devoirs pour les 30 prochains jours
        const start = todayYmd();
        const end = addDaysYmd(start, 30);
        const url = `${API_BASE}/devoirs?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
        const siteUser = localStorage.getItem('source_username') || '';
        let res;
        try {
            res = await fetchWithTimeout(url, {
                method: 'GET',
                headers: siteUser ? { 'x-source-user': siteUser } : undefined
            }, 10000);
        } catch (e) {
            throw new Error('Timeout ou erreur réseau lors de la récupération des devoirs');
        }
        if (!res.ok) throw new Error('Erreur devoirs: ' + res.status);
        const data = await safeJson(res);
        renderDevoirs(data);
        saveDevoirsCache({ start, end }, data);
    }

    function setDefaultDevoirsRange(){
        const s = byId('devoirs-start');
        const e = byId('devoirs-end');
        if (s && !s.value) s.value = todayYmd();
        if (e && !e.value) e.value = addDaysYmd(s.value, 14);
    }

    function activateTab(tab){
        const tabs = document.querySelectorAll('.cartable-tab');
        const panels = document.querySelectorAll('.cartable-panel');
        tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
        panels.forEach(p => p.classList.toggle('active', p.dataset.tab === tab));
    }

    // Check if ED session is alive by attempting to load notes
    async function isConnected(){
        try {
            const siteUser = localStorage.getItem('source_username') || '';
            const res = await fetch(API_BASE + '/ping', {
                method:'GET',
                headers: siteUser ? { 'x-source-user': siteUser } : undefined
            });
            return res.ok;
        } catch {
            return false;
        }
    }

    function wireEvents(){
        const periodeSelect = byId('notes-periode');
        if (periodeSelect) {
            periodeSelect.addEventListener('change', () => {
                closeNotesModal(); // Ferme le modal quand on change de période
                const periodeId = periodeSelect.value;
                console.log('Changement de période:', periodeId);
                byId('notes-container').textContent = 'Chargement…';
                // Rerender avec la période sélectionnée
                const cached = loadNotesCache();
                if (cached) {
                    renderNotes(cached, periodeId);
                } else {
                    loadNotes('', periodeId).catch(err => {
                        byId('notes-container').textContent = 'Erreur: ' + err.message;
                    });
                }
            });
        }

        // Gestion du modal
        const modalCloseBtn = byId('modal-close-btn');
        if (modalCloseBtn) {
            modalCloseBtn.addEventListener('click', closeNotesModal);
        }

        const modal = byId('notes-modal');
        if (modal) {
            // Ferme le modal quand on clique sur l'overlay (pas sur le contenu)
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    closeNotesModal();
                }
            });
        }

        // Modal devoir
        const devoirCloseBtn = byId('devoir-modal-close');
        if (devoirCloseBtn) {
            devoirCloseBtn.addEventListener('click', closeDevoirModal);
        }
        const devoirModal = byId('devoir-modal');
        if (devoirModal) {
            devoirModal.addEventListener('click', (e) => {
                if (e.target === devoirModal) closeDevoirModal();
            });
        }

        const tabs = document.querySelectorAll('.cartable-tab');
        tabs.forEach(t => {
            t.addEventListener('click', () => {
                closeNotesModal(); // Ferme le modal quand on change d'onglet
                activateTab(t.dataset.tab);
            });
        });

        // Bouton EDT → ouvre le panneau EDT (défini dans home.js)
        const edtBtn = byId('cartable-edt-btn');
        if (edtBtn) {
            edtBtn.addEventListener('click', () => {
                if (typeof window.openEdtPanel === 'function') {
                    window.openEdtPanel();
                }
            });
        }
    }

    window.initCartablePage = async function(){
        try {
            // Prépare les panneaux
            const loginPanel = byId('cartable-login-panel');
            const content = byId('cartable-content');
            const errorEl = byId('cartable-login-error');
            const form = byId('cartable-login-form');
            const ident = byId('ed-identifiant');
            const mdp = byId('ed-motdepasse');
            const statusEl = byId('cartable-login-status');
            const connectingScreen = byId('cartable-connecting');
            setDefaultDevoirsRange();
            wireEvents();
            // Toujours repartir d'un état propre (sinon l'écran "Connexion en cours" peut rester)
            hide(connectingScreen);
            if (errorEl) { errorEl.style.display = 'none'; errorEl.textContent = ''; }

            const showContentFast = async (forceRefresh=false) => {
                hide(loginPanel);
                hide(connectingScreen);
                show(content);
                // Active l'onglet Notes par défaut si aucun n'est actif
                const anyActiveTab = document.querySelector('.cartable-tab.active');
                if (!anyActiveTab) activateTab('notes');
                
                // Charger les périodes
                const periodeSelect = byId('notes-periode');
                if (periodeSelect) {
                    const periodes = await loadPeriodes();
                    console.log('Périodes chargées:', periodes.length);
                    periodeSelect.innerHTML = '';
                    
                    // Trouve la période actuelle (celle qui contient la date d'aujourd'hui)
                    const today = new Date();
                    let currentPeriodeCode = '';
                    
                    // Logique simple pour déterminer la période active si les dates sont dispos
                    // Sinon on prend la dernière de la liste (souvent la plus récente)
                    let defaultPeriode = null;
                    
                    if (periodes.length) {
                        // Cherche la période active par date
                        const activeP = periodes.find(p => {
                            if (p.dateDebut && p.dateFin) {
                                const d = new Date(p.dateDebut);
                                const f = new Date(p.dateFin);
                                return today >= d && today <= f;
                            }
                            return false;
                        });
                        
                        defaultPeriode = activeP || periodes[periodes.length - 1]; // Fallback sur la dernière
                        
                        periodes.forEach(p => {
                            const opt = document.createElement('option');
                            opt.value = p.idPeriode || p.codePeriode || '';
                            const label = p.periode || p.libelle || p.name || 'Période';
                            opt.textContent = label;
                            if (defaultPeriode && (p.idPeriode === defaultPeriode.idPeriode)) {
                                opt.selected = true;
                            }
                            periodeSelect.appendChild(opt);
                        });
                    } else {
                        const opt = document.createElement('option');
                        opt.value = '';
                        opt.textContent = 'Pas de périodes';
                        periodeSelect.appendChild(opt);
                    }
                }

                // Notes: toujours filtrées par la période sélectionnée dans le <select>
                const selectedPeriodeId = (periodeSelect && periodeSelect.value) ? periodeSelect.value : '';
                try { await renderNotesCachedOrFetch(forceRefresh, selectedPeriodeId); } catch (e) { console.warn('Cartable notes render skip:', e?.message || e); }
                try { await renderDevoirsCachedOrFetch(forceRefresh); } catch (e) { console.warn('Cartable devoirs render skip:', e?.message || e); }

                // Focus demandé depuis l'accueil (clic widget)
                try {
                    const raw = sessionStorage.getItem('alpha_cartable_focus');
                    if (raw) {
                        sessionStorage.removeItem('alpha_cartable_focus');
                        const focus = JSON.parse(raw);
                        if (focus && focus.type === 'devoir' && focus.idDevoir) {
                            const cached = loadDevoirsCache();
                            const list = (cached && cached.data && Array.isArray(cached.data.devoirs)) ? cached.data.devoirs : [];
                            const target = list.find(d => (d && (d.idDevoir || d.id)) == focus.idDevoir);
                            if (target) {
                                activateTab('devoirs');
                                openDevoirModal(target);
                            } else {
                                // Fallback: ouvre l'onglet devoirs
                                activateTab('devoirs');
                            }
                        } else if (focus && focus.type === 'notes') {
                            const structure = window.cartableCurrentStructure;
                            const periodeId = window.cartableCurrentPeriodeId;
                            let periode = null;
                            if (structure?.periodes && Array.isArray(structure.periodes)) {
                                periode = structure.periodes.find(p => p.idPeriode === periodeId) || structure.periodes[0];
                            }
                            const disciplines = periode?.ensembleMatieres?.disciplines;
                            if (Array.isArray(disciplines)) {
                                const matieres = disciplines.filter(d => d && d.groupeMatiere === false);
                                const match = matieres.find(m => {
                                    const name = m.discipline || m.libelle || m.nom || '';
                                    const code = m.code || m.codeMatiere || m.codeDisc || '';
                                    if (focus.codeMatiere && code && String(code) === String(focus.codeMatiere)) return true;
                                    return focus.libelleMatiere && name && String(name).toLowerCase() === String(focus.libelleMatiere).toLowerCase();
                                });
                                if (match) {
                                    activateTab('notes');
                                    const matNom = match.discipline || match.libelle || match.nom || focus.libelleMatiere || 'Matière';
                                    openNotesModal(matNom, match);
                                } else {
                                    activateTab('notes');
                                }
                            }
                        }
                    }
                } catch {}
            };

            // Affiche d'abord les caches si dispo pour éviter le flash de la page de login
            await showContentFast(false);
            setText(statusEl, 'Vérification de la connexion...');

            const siteUser = getSiteUser();
            if (!siteUser) {
                // Pas de session AlphaSource: retour login (évite tout fallback serveur)
                window.location.href = '/pages/login.html';
                return;
            }

            // 1) Déjà connecté ?
            try {
                if (await isConnected()) {
                    setText(statusEl, 'Connecté automatiquement');
                    // Pas besoin de showContentFast(false) ici: déjà affiché au-dessus
                    setTimeout(()=> setText(statusEl, ''), 800);
                    return;
                }
            } catch {}

            // 2) Pas connecté : tentative d'auto-login en arrière-plan
            try {
                const siteUser = localStorage.getItem('source_username') || '';
                const cfgRes = await fetch('/api/mdped?username=' + encodeURIComponent(siteUser), {
                    method: 'GET',
                    headers: siteUser ? { 'x-source-user': siteUser } : undefined
                });
                if (cfgRes && cfgRes.ok) {
                    const cfg = await cfgRes.json();
                    if (cfg && cfg.id && cfg.mdp) {
                        setText(statusEl, 'Connexion automatique...');
                        const lr = await fetch(API_BASE + '/login', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                ...(siteUser ? { 'x-source-user': siteUser } : {})
                            },
                            body: JSON.stringify({ identifiant: cfg.id, motdepasse: cfg.mdp, username: siteUser })
                        });
                        const ljson = await safeJson(lr);
                        if (lr.ok && ljson && ljson.success) {
                            setText(statusEl, 'Connecté automatiquement');
                            await showContentFast(true);
                            setTimeout(()=> setText(statusEl, ''), 800);
                            return;
                        }
                        setText(statusEl, '');
                    }
                }
            } catch {}

            // 3) Échec auto → afficher le formulaire manuel
            hide(content);
            hide(connectingScreen);
            show(loginPanel);
            setText(statusEl, '');

            if (form) {
                form.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    if (!ident || !mdp) return;
                    const siteUser = localStorage.getItem('source_username') || '';
                    const payload = { identifiant: ident.value.trim(), motdepasse: mdp.value, username: siteUser };
                    if (!payload.identifiant || !payload.motdepasse) return;

                    // Afficher l'écran de connexion en cours et cacher le formulaire
                    hide(loginPanel);
                    show(connectingScreen);
                    if (errorEl) errorEl.style.display = 'none';

                    try {
                        const res = await fetch(API_BASE + '/login', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                ...(siteUser ? { 'x-source-user': siteUser } : {})
                            },
                            body: JSON.stringify(payload)
                        });
                        const data = await safeJson(res);
                        if (!res.ok || !data.success) {
                            const msg = data && (data.message || data.error) ? (data.message || data.error) : 'Échec de connexion';
                            // Réafficher le formulaire avec erreur
                            hide(connectingScreen);
                            show(loginPanel);
                            if (errorEl) { errorEl.textContent = msg; errorEl.style.display = 'block'; }
                            return;
                        }

                        // Save credentials to server storage for auto-login next visits
                        try {
                            await fetch('/api/mdped', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    username: siteUser,
                                    id: payload.identifiant,
                                    mdp: payload.motdepasse,
                                    accountId: (data && data.account && data.account.id) ? String(data.account.id) : ''
                                })
                            });
                        } catch {}

                        // Cacher l'écran de connexion et afficher le contenu
                        hide(connectingScreen);
                        hide(loginPanel);
                        show(content);
                        setText(statusEl, 'Connecté');
                        await showContentFast(true);
                        setTimeout(()=> setText(statusEl, ''), 800);
                    } catch (err) {
                        console.error('Login error:', err);
                        hide(connectingScreen);
                        show(loginPanel);
                        if (errorEl) {
                            const hint = 'Échec de connexion à l\'API (même origine). Assure-toi que le serveur principal écoute et que les routes /ed/* sont actives.';
                            errorEl.textContent = (err && err.message ? err.message : 'Failed to fetch') + ' — ' + hint;
                            errorEl.style.display = 'block';
                        }
                    }
                }, { once: true });
            }
        } catch (e) {
            console.error('Cartable init error:', e);
        }
    };
})();
