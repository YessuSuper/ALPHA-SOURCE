// public/js/cours.js
// Version propre et corrigée - Affichage persistant des cours
console.log('Script chargé !');
console.log('document.readyState =', document.readyState);

(() => {
	'use strict';

	// ----- Variables globales locales au module -----
	let fileGrid = null;
	let courseCounterBox = null;
	let depositModalOverlay = null;
	let depositForm = null;

	let detailsModal = null;
	let detailsContent = null;
	let detailsTitle = null;

	let deleteTimerInterval = null;
	let deleteTimerTimeout = null;
	let currentDeleteButton = null;

	let coursesData = [];
	let filteredCourses = []; // 🚨 C'EST CE TABLEAU QUI SERA AFFICHÉ 🚨
	let starVoteModal = null;
	let starVoteStars = null;
	let starVoteRating = null;
	let starVoteCount = null;
	let selectedStarCourseId = null;

	// ----- Helpers -----
	const safeJson = async (response) => {
		try { return await response.json(); } 
		catch (_) { return null; }
	};

	const getExtensionFromUrl = (url) => {
		if (!url || typeof url !== 'string') return 'file';
		const last = url.split('.').pop();
		if (!last) return 'file';
		return last.split(/[?#]/)[0].toLowerCase();
	};

	function escapeHtml(str) {
		if (str == null) return '';
		return String(str)
			.replace(/&/g, '&amp;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;');
	}

	function escapeHtmlAttr(str) {
		return escapeHtml(str).replace(/"/g, '&quot;');
	}

	const cleanupDeleteButton = () => {
		if (deleteTimerInterval) clearInterval(deleteTimerInterval);
		if (deleteTimerTimeout) clearTimeout(deleteTimerTimeout);
		if (currentDeleteButton) {
			currentDeleteButton.classList.remove('visible');
			setTimeout(() => {
				if (currentDeleteButton && currentDeleteButton.parentNode) currentDeleteButton.remove();
			}, 600);
		}
		deleteTimerInterval = null;
		deleteTimerTimeout = null;
	};

	function roundedQuarter(value) {
		return Math.max(0, Math.min(5, Math.round(value * 4) / 4));
	}

	function computeStarsFromCourse(course) {
		const totalVotes = Number(course.votes_total || 0);
		if (course && (course.hide_stars === true || course.stars === null)) {
			return { stars: 0, totalVotes: Number(course.votes_total || 0), hidden: true };
		}
		if (totalVotes > 0 && typeof course.stars === 'number') {
			return { stars: roundedQuarter(course.stars), totalVotes, hidden: false };
		}
		if (!totalVotes) return { stars: 0, totalVotes: 0, hidden: false };
		const scoreSum = Number(course.score_sum || 0);
		const avg = scoreSum / totalVotes; // avg in [-1,1]
		const mapped = ((avg + 1) / 2) * 5; // map to [0,5]
		return { stars: roundedQuarter(mapped), totalVotes, hidden: false };
	}

	let starMaskUid = 0;
	function renderQuarterStarsHtml(rating, variant) {
		const clamped = Math.max(0, Math.min(5, Number(rating) || 0));
		const totalQuarters = Math.round(clamped * 4);
		const klass = variant === 'badge' ? 'sstars sstars--badge' : 'sstars sstars--modal';
		const fillRank = { tl: 1, bl: 2, br: 3, tr: 4 }; // TL=0.25, BL=0.50, BR=0.75, TR=1.0
		const stars = [];

		// Chemin étoile (5 branches) dans un viewBox 24x24
		const starPath = 'M12 2.1l2.93 6.4 6.92.6-5.24 4.54 1.56 6.76L12 16.98 5.83 20.4l1.56-6.76L2.15 9.1l6.92-.6L12 2.1z';

		for (let starIndex = 0; starIndex < 5; starIndex++) {
			const uid = ++starMaskUid;
			const maskId = `star-mask-${variant}-${uid}`;
			const starQuarters = Math.max(0, Math.min(4, totalQuarters - starIndex * 4));

			const rect = (pos, x, y) => {
				const filled = starQuarters >= fillRank[pos];
				return `<rect class="sstar-q ${filled ? 'filled' : ''} sstar-q--${pos}" x="${x}" y="${y}" width="12" height="12" />`;
			};

			stars.push(
				`<span class="sstar" aria-hidden="true">
					<svg class="sstar-svg" viewBox="0 0 24 24" focusable="false" aria-hidden="true">
						<defs>
							<mask id="${maskId}">
								<rect x="0" y="0" width="24" height="24" fill="black" />
								<path d="${starPath}" fill="white" />
							</mask>
						</defs>
						<path class="sstar-bg" d="${starPath}" />
						<g mask="url(#${maskId})">
							${rect('tl', 0, 0)}
							${rect('tr', 12, 0)}
							${rect('bl', 0, 12)}
							${rect('br', 12, 12)}
						</g>
						<path class="sstar-outline" d="${starPath}" />
					</svg>
				</span>`
			);
		}
		return `<span class="${klass}" aria-label="Note ${clamped.toFixed(2)} sur 5">${stars.join('')}</span>`;
	}

	function renderStars(container, rating) {
		if (!container) return;
		container.innerHTML = renderQuarterStarsHtml(rating, 'modal');
	}

	let modalJustOpened = false;
	function closeStarVoteModal() {
		if (!starVoteModal) return;
		starVoteModal.classList.remove('active');
	}

	function openStarVoteModal(course) {
		if (!course) return;
		setupStarVoteModal();
		if (!starVoteModal) return;
		console.log('Open star modal for course', course.id);
		selectedStarCourseId = course.id;
		const { stars, totalVotes, hidden } = computeStarsFromCourse(course);
		renderStars(starVoteStars, stars);
		if (starVoteRating) starVoteRating.textContent = hidden ? '—' : (stars ? stars.toFixed(2) : '—');
		if (starVoteCount) starVoteCount.textContent = totalVotes;

		const username = localStorage.getItem('source_username') || '';
		const canVote = Boolean(course.can_vote) || (Boolean(username) && !course.has_voted && String(course.uploaderName || '').toLowerCase() !== String(username).toLowerCase());
		const voteButtons = starVoteModal.querySelectorAll('.vote-btn');
		voteButtons.forEach(btn => {
			btn.disabled = !canVote;
			btn.setAttribute('aria-disabled', String(!canVote));
		});
		starVoteModal.classList.add('active');
		modalJustOpened = true;
		setTimeout(() => { modalJustOpened = false; }, 120);
	}

	// ----- Création d’une carte cours -----
	function createCourseCard(course) {
		const card = document.createElement('div');
		card.classList.add('course-file-card');
		card.dataset.id = course.id;

		const { stars, totalVotes, hidden } = computeStarsFromCourse(course);

		const fileUrl = course.filePath || course.filepath || course.file || '';
		const extension = getExtensionFromUrl(fileUrl);
		const isImage = ['jpg','jpeg','png','gif','webp'].includes(extension);

		const previewArea = document.createElement('div');
		previewArea.classList.add('file-preview-area');

		if (isImage) {
			const img = document.createElement('img');
			img.classList.add('file-image-preview');
			img.src = fileUrl;
			img.alt = course.title || 'Aperçu';
			previewArea.appendChild(img);
		} else {
			const placeholder = document.createElement('div');
			placeholder.classList.add('no-image-placeholder');
			placeholder.innerHTML = `
				<div style="text-align:center; padding: 10px;">
					<div style="font-size: 18px;">📂 ${escapeHtml(course.subject || '—')}</div>
					<div style="font-weight:600; margin-top:6px;">${escapeHtml(course.title || 'Sans titre')}</div>
					<div style="opacity:0.8; margin-top:4px;">.${escapeHtml(extension.toUpperCase())}</div>
				</div>
			`;
			previewArea.appendChild(placeholder);
		}

		card.appendChild(previewArea);

		// Badge étoiles (en haut à droite)
		const starBadge = document.createElement('button');
		starBadge.type = 'button';
		starBadge.className = 'course-star-badge';
		starBadge.innerHTML = `
			<div class="star-badge-stars">${renderQuarterStarsHtml(stars || 0, 'badge')}</div>
			<span class="star-badge-value">${hidden ? '—' : (totalVotes ? stars.toFixed(2) : '—')}</span>
		`;
		starBadge.addEventListener('click', (e) => {
			e.stopPropagation();
			e.preventDefault();
			openStarVoteModal(course);
			console.log('Star badge clicked', course.id);
		});
		card.appendChild(starBadge);

		// --- Overlay avec Titre/Matière + Actions ---
		const infoOverlay = document.createElement('div');
		infoOverlay.classList.add('file-info-overlay');

		const fileInfoHeader = document.createElement('div');
		fileInfoHeader.classList.add('file-info-header');
		fileInfoHeader.innerHTML = `
			<div class="file-title">${escapeHtml(course.title || 'Sans titre')}</div>
			<div class="file-subject">${escapeHtml(course.subject || '—')}</div>
		`;
		infoOverlay.appendChild(fileInfoHeader);

		const safeTitleForFile = (course.title || 'download').replace(/[^a-zA-Z0-9-_\.]/g, '_');
		const downloadFileName = `${safeTitleForFile}.${extension}`;

		const fileActions = document.createElement('div');
		fileActions.classList.add('file-actions');
		fileActions.innerHTML = `
			<button class="detail-button" data-course-id="${escapeHtml(String(course.id))}">DÉTAILS</button>
			<a href="${escapeHtmlAttr(fileUrl)}" download="${escapeHtmlAttr(downloadFileName)}" class="download-button">TÉLÉCHARGER</a>
		`;
		infoOverlay.appendChild(fileActions);

		card.appendChild(infoOverlay); 

		const detailBtn = fileActions.querySelector('.detail-button');
		if (detailBtn) {
			detailBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				showCourseDetails(course);
			}, { passive: true });
		}

		return card;
	}

	// ----- Filtres des cours 🚨 FONCTION DÉPLACÉE ET CORRIGÉE 🚨 -----
	function applyFilters() {
		// 🚨 CORRECTION 1: Utilisation des IDs corrects de ton HTML 🚨
		const titleSearchText = document.getElementById('search-title-input')?.value?.toLowerCase() || "";
		const idSearchText = document.getElementById('search-id-input')?.value || "";
		const subjectValue = document.getElementById('filter-subject-select')?.value || "";

		filteredCourses = coursesData.filter(course => {
			const titleMatch = (course.title || "").toLowerCase().includes(titleSearchText);
			const idMatch = idSearchText === "" || String(course.id || "").includes(idSearchText);
			const subjectMatch = subjectValue === "" || course.subject === subjectValue;

			// Retourne TRUE si le cours correspond aux critères de recherche ET de matière
			return (titleMatch && idMatch) && subjectMatch;
		});

		// 🚨 CORRECTION 2: On ne fait qu'afficher les cours, on n'appelle PAS applyFilters ici ! 🚨
		displayCourses(); 
	}
	
	// ----- Affichage des cours -----
	function displayCourses() {
		const fileGridEl = document.getElementById('file-grid');
		const courseCounterBoxEl = document.getElementById('course-counter-box');
		if (!fileGridEl) return;

		// 🚨 Utilise filteredCourses pour l'affichage 🚨
		if (courseCounterBoxEl) courseCounterBoxEl.textContent = `Cours : ${filteredCourses.length}`;

		fileGridEl.innerHTML = '';
		if (!filteredCourses.length) {
			const p = document.createElement('p');
			p.className = 'no-course-message';
			p.textContent = "Aucun cours disponible pour le moment. Dépêche-toi d'en uploader !";
			fileGridEl.appendChild(p);
			return;
		}

		const fragment = document.createDocumentFragment();
		filteredCourses.forEach(c => fragment.appendChild(createCourseCard(c)));
		fileGridEl.appendChild(fragment);
	}


	// ----- Fetch des cours -----
	async function fetchCoursesAndDisplay() {
		try {
			const username = localStorage.getItem('source_username') || '';
			const url = `/public/api/course/list?username=${encodeURIComponent(username)}`;
			const response = await fetch(url, { headers: { 'Accept': 'application/json' }});
			
			const data = response.ok ? await safeJson(response) : { courses: [] };
			coursesData = Array.isArray(data.courses) ? data.courses : [];
			
			// 🚨 CORRECTION 3: Lancement initial du filtre après le fetch 🚨
			applyFilters(); // Ceci affiche les cours non filtrés au départ
		} catch (err) {
			console.error('Erreur fetch courses :', err);
			coursesData = [];
			filteredCourses = [];
			displayCourses();
		}
	}

	// ----- Détails d’un cours -----
	function showCourseDetails(course) {
		if (!detailsModal || !detailsContent || !detailsTitle) return;

		detailsTitle.textContent = course.title || 'Détails';
		const fileUrl = course.filePath || course.filepath || course.file || '#';

		// Formatage de la date
		let dateStr = 'Date inconnue';
		let relDateStr = dateStr;
		if (course.uploadedAt) {
			try {
				const date = new Date(course.uploadedAt);
				dateStr = date.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
				relDateStr = typeof window.timeAgo === 'function' ? window.timeAgo(date) : dateStr;
			} catch (e) { console.error(e); }
		}

		detailsContent.innerHTML = `
			<div class="course-detail-item"><strong>Matière:</strong> <span>${escapeHtml(course.subject || '—')}</span></div>
			<div class="course-detail-item"><strong>Description:</strong> <p>${escapeHtml(course.description || 'Aucune description')}</p></div>
			<div class="course-detail-item"><strong>Ajouté par:</strong> <span>${escapeHtml(course.uploaderName || 'Anonyme')}</span></div>
			<div class="course-detail-item"><strong>Date d'ajout:</strong> <span class="relative-time" title="${escapeHtml(dateStr)}">${escapeHtml(relDateStr)}</span></div>
			
			<div class="course-detail-actions" style="margin-top: 20px; text-align: center;">
				<a href="${escapeHtmlAttr(fileUrl)}" target="_blank" rel="noopener" class="modal-download-btn">
					Ouvrir / Télécharger le fichier
				</a>
			</div>

			<div class="course-id-highlight" style="margin-top: 25px; padding: 15px; background: #f5f5f5; border-left: 4px solid #007bff; border-radius: 4px; display: flex; align-items: center; justify-content: space-between;">
				<div>
					<strong style="font-size: 0.9em; color: #666;">Identifiant du cours</strong>
					<div style="font-size: 1.3em; font-weight: bold; color: #000; margin-top: 4px; font-family: monospace;">${escapeHtml(String(course.id || '—'))}</div>
				</div>
				<button class="copy-id-btn" data-id="${escapeHtml(String(course.id || ''))}" style="padding: 8px 12px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9em; white-space: nowrap; margin-left: 10px;">📋 Copier</button>
			</div>
			<hr>
			<div id="delete-btn-container" class="timer-container" style="display:flex; justify-content:center; align-items:center; min-height:40px;"></div>
		`;
		setupTemporaryDeleteButton(String(course.id), course.deleteTimer || 0);
		
		// Setup copy button listener
		const copyBtn = detailsContent.querySelector('.copy-id-btn');
		if (copyBtn) {
			copyBtn.addEventListener('click', async (e) => {
				e.preventDefault();
				const courseId = copyBtn.getAttribute('data-id');
				try {
					await navigator.clipboard.writeText(courseId);
					const originalText = copyBtn.textContent;
					copyBtn.textContent = '✓ Copié!';
					copyBtn.style.background = '#28a745';
					setTimeout(() => {
						copyBtn.textContent = originalText;
						copyBtn.style.background = '#007bff';
					}, 2000);
				} catch (err) {
					console.error('Erreur lors de la copie:', err);
					copyBtn.textContent = '✗ Erreur';
					setTimeout(() => {
						copyBtn.textContent = '📋 Copier';
					}, 2000);
				}
			}, { passive: false });
		}
		
		detailsModal.classList.add('active');
	}

	// ----- Modals -----
	function setupModalListeners() {
		depositModalOverlay = depositModalOverlay || document.getElementById('deposit-modal');
		const openModalButton = document.getElementById('deposit-course-button');
		if (openModalButton && depositModalOverlay) {
			openModalButton.addEventListener('click', () => depositModalOverlay.classList.add('active'), { passive: true });
		}

		document.querySelectorAll('.close-modal-btn').forEach(btn => {
			btn.addEventListener('click', () => {
				if (depositModalOverlay) depositModalOverlay.classList.remove('active');
				if (detailsModal) {
					detailsModal.classList.remove('active');
					cleanupDeleteButton();
				}
			}, { passive: true });
		});

		if (depositModalOverlay) {
			depositModalOverlay.addEventListener('click', e => {
				if (e.target === depositModalOverlay) depositModalOverlay.classList.remove('active');
			});
		}
	}

	// ----- Upload form -----
	function setupFormSubmission() {
		depositForm = depositForm || document.getElementById('deposit-form');
		if (!depositForm || depositForm.dataset.listenerAdded === 'true') return;

		depositForm.dataset.listenerAdded = 'true';

		depositForm.addEventListener('submit', async (event) => {
			event.preventDefault();
			const submitButton = document.getElementById('submit-deposit-btn');
			if (submitButton) { submitButton.disabled = true; submitButton.textContent = 'Chargement…'; }
			const formData = new FormData(depositForm);
			
			// Ajout du nom d'utilisateur
			const username = localStorage.getItem('source_username') || 'Anonyme';
			formData.append('uploaderName', username);

			try {
				const url = `/public/api/course/upload`; 
				const response = await fetch(url, { method:'POST', body: formData, headers:{ 'Accept':'application/json' }});
				if (response.ok) {
					await safeJson(response);
					await fetchCoursesAndDisplay();
					if (depositModalOverlay) depositModalOverlay.classList.remove('active');
				} else {
					const err = await safeJson(response);
					await showModal(`Erreur lors du dépôt : ${err?.message || response.statusText}`);
				}
			} catch (e) {
				console.error('Erreur lors du dépôt :', e);
				await showModal('Erreur réseau lors du dépôt.');
			} finally {
				if (submitButton) { submitButton.disabled = false; submitButton.textContent = 'Déposer le cours'; }
				depositForm.reset();
				const preview = document.getElementById('file-preview-thumbnail');
				if (preview) preview.innerHTML = '', preview.style.display = 'none';
				const status = document.querySelector('.file-status-text');
				if (status) status.textContent = 'Aucun fichier sélectionné.';
			}
		});
	}

	// ----- Prévisualisation fichier -----
	function setupFilePreview() {
		const fileInput = document.getElementById('deposit-file-upload');
		const previewContainer = document.getElementById('file-preview-thumbnail');
		const statusText = document.querySelector('.file-status-text');
		if (!fileInput || !previewContainer) return;
		if (fileInput.dataset.listenerAdded === 'true') return;

		fileInput.dataset.listenerAdded = 'true';

		fileInput.addEventListener('change', (event) => {
			const file = event.target.files?.[0];
			previewContainer.innerHTML = '';
			previewContainer.style.display = 'none';
			if (!statusText) return;

			if (file) {
				statusText.textContent = `Fichier sélectionné : ${file.name}`;
				if (file.type?.startsWith('image/')) {
					const reader = new FileReader();
					reader.onload = e => {
						previewContainer.style.display = 'block';
						previewContainer.innerHTML = `<img src="${e.target.result}" alt="Aperçu" style="width:100%;height:auto;border-radius:8px;">`;
					};
					reader.readAsDataURL(file);
				} else {
					previewContainer.style.display = 'block';
					previewContainer.innerHTML = `<p style="color:#bbb;text-align:center;padding:10px;">Aperçu non disponible. Type: ${file.type || 'inconnu'}</p>`;
				}
			} else {
				statusText.textContent = 'Aucun fichier sélectionné.';
			}
		}, { passive: true });
	}

	async function sendStarVote(value) {
		if (!selectedStarCourseId) return;
		try {
			const username = localStorage.getItem('source_username') || '';
			const res = await fetch('/public/api/course/vote', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ courseId: selectedStarCourseId, vote: value, username })
			});
			const data = await safeJson(res) || {};
			if (!data.success) throw new Error(data.message || 'Vote refusé');

			// Notif points (discret, haut de l'écran)
			if (typeof data.pointsAwarded === 'number') {
				try {
					if (typeof window.__applyPointsDelta === 'function') window.__applyPointsDelta(data.pointsAwarded, 'vote');
					else if (typeof window.showPointsToast === 'function') window.showPointsToast(data.pointsAwarded);
				} catch {}
			}

			const updated = data.course;
			coursesData = coursesData.map(c => c.id === updated.id ? updated : c);
			filteredCourses = filteredCourses.map(c => c.id === updated.id ? updated : c);
			applyFilters();
			openStarVoteModal(updated);
		} catch (e) {
			console.error('Vote étoile échoué:', e);
			showModal(`Erreur vote: ${e.message || e}`);
		}
	}

	function setupStarVoteModal() {
		if (starVoteModal && starVoteModal.dataset.bound === 'true') return;

		starVoteModal = document.getElementById('star-vote-modal');
		starVoteStars = document.getElementById('vote-modal-stars');
		starVoteRating = document.getElementById('vote-modal-rating');
		starVoteCount = document.getElementById('vote-modal-count');
		if (!starVoteModal) return;

		// Close button
		const closeBtn = document.getElementById('close-star-vote-btn');
		if (closeBtn && closeBtn.dataset.bound !== 'true') {
			closeBtn.dataset.bound = 'true';
			closeBtn.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();
				closeStarVoteModal();
			});
		}

		// Click outside modal-content closes
		starVoteModal.addEventListener('click', (e) => {
			if (modalJustOpened) return;
			if (e.target === starVoteModal) closeStarVoteModal();
		});

		// Stop propagation inside content
		const modalContent = starVoteModal.querySelector('.star-vote-content');
		if (modalContent) {
			modalContent.addEventListener('click', (e) => e.stopPropagation());
			// Vote buttons (delegation)
			modalContent.addEventListener('click', (e) => {
				const btn = e.target.closest('.vote-btn');
				if (!btn) return;
				const val = Number(btn.dataset.value);
				if (isNaN(val)) return;
				sendStarVote(val);
			});
		}

		starVoteModal.dataset.bound = 'true';
	}

	// ----- Delete temporaire -----
	function setupTemporaryDeleteButton(courseId, initialDurationSeconds) {
		cleanupDeleteButton();
		const duration = Number(initialDurationSeconds) || 0;
		if (duration <= 0) return;

		const deleteBtnContainer = document.getElementById('delete-btn-container');
		if (!deleteBtnContainer || !detailsModal) return;

		const deleteButton = document.createElement('button');
		deleteButton.id = `delete-course-btn-${courseId}`;
		deleteButton.className = 'delete-button-ephemeral';
		deleteButton.textContent = `❌ SUPPRIMER (${duration}s)`;

		currentDeleteButton = deleteButton;
		deleteBtnContainer.appendChild(deleteButton);

		setTimeout(() => deleteButton.classList.add('visible'), 50);

		let remaining = duration;
		deleteTimerInterval = setInterval(() => {
			remaining -= 1;
			if (remaining >= 0) deleteButton.textContent = `❌ SUPPRIMER (${remaining}s)`;
		}, 1000);

		deleteTimerTimeout = setTimeout(() => cleanupDeleteButton(), duration*1000);

		deleteButton.addEventListener('click', async () => {
			if (!deleteButton.parentNode) return;
			if (!await showModal(`Êtes-vous sûr de vouloir supprimer le cours ${courseId} ?`, { type: 'confirm' })) return;

			cleanupDeleteButton();

			try {
				const url = `/public/api/course/delete/${encodeURIComponent(courseId)}`; 
				const response = await fetch(url, { method: 'DELETE', headers: { 'Accept':'application/json'} });
				if (response.ok) await safeJson(response);
				else {
					const err = await safeJson(response);
					await showModal(`Erreur lors de la suppression : ${err?.message || response.statusText}`);
				}
				if (detailsModal) detailsModal.classList.remove('active');
				await fetchCoursesAndDisplay();
			} catch(e) {
				console.error('Erreur lors de la suppression :', e);
				await showModal('Erreur réseau lors de la suppression.');
			}
		}, { passive: true });
	}

	// ----- Initialisation -----
	function initCoursePage() {
		console.log('initCoursePage lancé');

		const pendingCourseFilterId = (() => {
			try {
				return (localStorage.getItem('alpha_course_filter_id') || '').trim();
			} catch (_) {
				return '';
			}
		})();

		fileGrid = document.getElementById('file-grid');
		courseCounterBox = document.getElementById('course-counter-box');
		depositModalOverlay = document.getElementById('deposit-modal');
		detailsModal = document.getElementById('details-modal');
		detailsContent = document.getElementById('details-content');
		detailsTitle = document.getElementById('details-title');
		setupStarVoteModal();

		setupModalListeners();

		const closeDetailsBtn = document.getElementById('close-details-btn');
		if (closeDetailsBtn && detailsModal) {
			closeDetailsBtn.addEventListener('click', () => {
				detailsModal.classList.remove('active');
				cleanupDeleteButton();
			}, { passive: true });
		}

		if (detailsModal) {
			detailsModal.addEventListener('click', e => {
				if (e.target === detailsModal) {
					detailsModal.classList.remove('active');
					cleanupDeleteButton();
				}
			});
		}

		const waitForFileGrid = () => {
			fileGrid = document.getElementById('file-grid');
			courseCounterBox = document.getElementById('course-counter-box');
			if (!fileGrid) {
				console.log('file-grid introuvable, retry dans 50ms');
				setTimeout(waitForFileGrid, 50);
				return;
			}
			console.log('file-grid trouvé, fetch des cours');

			// Si on arrive depuis un clic "ID de cours" (messagerie), on pré-remplit les filtres
			if (pendingCourseFilterId) {
				const searchTitleInput = document.getElementById('search-title-input');
				const searchIdInput = document.getElementById('search-id-input');
				const subjectFilterSelect = document.getElementById('filter-subject-select');
				if (searchTitleInput) searchTitleInput.value = '';
				if (subjectFilterSelect) subjectFilterSelect.value = '';
				if (searchIdInput) searchIdInput.value = pendingCourseFilterId;
			}

			fetchCoursesAndDisplay().then(() => {
				// Une fois que le DOM de la page cours est injecté, on setup le formulaire et preview
				setupFormSubmission();
				setupFilePreview();
				
				// 🚨 CORRECTION 4: Ajout des listeners pour les nouveaux filtres 🚨
				const searchTitleInput = document.getElementById('search-title-input');
				const searchIdInput = document.getElementById('search-id-input');
				const subjectFilterSelect = document.getElementById('filter-subject-select');
				const resetFiltersBtn = document.getElementById('reset-filters-btn');

				if (searchTitleInput) searchTitleInput.addEventListener('input', applyFilters);
				if (searchIdInput) searchIdInput.addEventListener('input', applyFilters);
				if (subjectFilterSelect) subjectFilterSelect.addEventListener('change', applyFilters);
				
				// Listener pour réinitialiser
				if (resetFiltersBtn) resetFiltersBtn.addEventListener('click', () => {
					if (searchTitleInput) searchTitleInput.value = '';
					if (searchIdInput) searchIdInput.value = '';
					if (subjectFilterSelect) subjectFilterSelect.value = '';
					applyFilters();
				});

				// Scroll + highlight du cours ciblé
				if (pendingCourseFilterId) {
					setTimeout(() => {
						const selector = `.course-file-card[data-id="${String(pendingCourseFilterId)}"]`;
						const card = document.querySelector(selector);
						if (card) {
							card.classList.add('course-target');
							try { card.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) {}
							setTimeout(() => card.classList.remove('course-target'), 4500);
						}
						try { localStorage.removeItem('alpha_course_filter_id'); } catch (_) {}
					}, 60);
				}

			});
		};
		waitForFileGrid();
	}

	// ----- Ré-affichage courses quand l’onglet redevient actif -----
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'visible') {
			fetchCoursesAndDisplay(); // On refait un fetch pour être sûr d'avoir les derniers cours
		}
	});

	// initCoursePage est appelé par renderPage via window.__CourseModuleInit

	// ----- Expose pour debug -----
	window.__CourseModule = { fetchCoursesAndDisplay, displayCourses, applyFilters };
	window.__CourseModuleInit = initCoursePage;

})();