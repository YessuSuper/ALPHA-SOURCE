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

	// ----- Création d’une carte cours -----
	function createCourseCard(course) {
		const card = document.createElement('div');
		card.classList.add('course-file-card');
		card.dataset.id = course.id;

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
			const url = `/public/api/course/list`; 
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

		detailsContent.innerHTML = `
			<div class="course-detail-item"><strong>Matière:</strong> <span>${escapeHtml(course.subject || '—')}</span></div>
			<div class="course-detail-item"><strong>Description:</strong> <p>${escapeHtml(course.description || 'Aucune description')}</p></div>
			<div class="course-detail-item"><strong>Fichier:</strong> <a href="${escapeHtmlAttr(fileUrl)}" target="_blank" rel="noopener">Ouvrir / Télécharger</a></div>
			<div class="course-detail-item"><strong>ID:</strong> <span>${escapeHtml(String(course.id || '—'))}</span></div>
			<hr>
			<div id="delete-btn-container" class="timer-container" style="display:flex; justify-content:center; align-items:center; min-height:40px;"></div>
		`;
		setupTemporaryDeleteButton(String(course.id), course.deleteTimer || 0);
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

			try {
				const url = `/public/api/course/upload`; 
				const response = await fetch(url, { method:'POST', body: formData, headers:{ 'Accept':'application/json' }});
				if (response.ok) {
					await safeJson(response);
					await fetchCoursesAndDisplay();
					if (depositModalOverlay) depositModalOverlay.classList.remove('active');
				} else {
					const err = await safeJson(response);
					alert(`Erreur lors du dépôt : ${err?.message || response.statusText}`);
				}
			} catch (e) {
				console.error('Erreur lors du dépôt :', e);
				alert('Erreur réseau lors du dépôt.');
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
			if (!confirm(`Êtes-vous sûr de vouloir supprimer le cours ${courseId} ?`)) return;

			cleanupDeleteButton();

			try {
				const url = `/public/api/course/delete/${encodeURIComponent(courseId)}`; 
				const response = await fetch(url, { method: 'DELETE', headers: { 'Accept':'application/json'} });
				if (response.ok) await safeJson(response);
				else {
					const err = await safeJson(response);
					alert(`Erreur lors de la suppression : ${err?.message || response.statusText}`);
				}
				if (detailsModal) detailsModal.classList.remove('active');
				await fetchCoursesAndDisplay();
			} catch(e) {
				console.error('Erreur lors de la suppression :', e);
				alert('Erreur réseau lors de la suppression.');
			}
		}, { passive: true });
	}

	// ----- Initialisation -----
	function initCoursePage() {
		console.log('initCoursePage lancé');

		fileGrid = document.getElementById('file-grid');
		courseCounterBox = document.getElementById('course-counter-box');
		depositModalOverlay = document.getElementById('deposit-modal');
		detailsModal = document.getElementById('details-modal');
		detailsContent = document.getElementById('details-content');
		detailsTitle = document.getElementById('details-title');

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

	document.addEventListener('DOMContentLoaded', initCoursePage);

	// ----- Expose pour debug -----
	window.__CourseModule = { fetchCoursesAndDisplay, displayCourses, applyFilters };
	window.__CourseModuleInit = initCoursePage;

})();