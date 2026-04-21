// Fiches de Révision — Canvas animation + Editor
(function () {
    /* ═══ CANVAS ANIMATION ═══ */
    const canvas = document.getElementById('fiches-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    const COLORS = [
        'rgba(130,160,255,0.18)',
        'rgba(100,140,255,0.14)',
        'rgba(160,180,255,0.10)',
        'rgba(80,120,255,0.12)',
    ];

    class TextLine {
        constructor() { this.reset(true); }
        reset(init) {
            this.w = 60 + Math.random() * 260;
            this.h = 4 + Math.random() * 4;
            this.x = 40 + Math.random() * (canvas.width - 120);
            this.y = init ? Math.random() * canvas.height : canvas.height + 20;
            this.speed = 0.3 + Math.random() * 0.5;
            this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
            this.radius = this.h / 2;
        }
        update() {
            this.y -= this.speed;
            if (this.y < -20) this.reset(false);
        }
        draw() {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.roundRect(this.x, this.y, this.w, this.h, this.radius);
            ctx.fill();
        }
    }

    const lines = [];
    const COUNT = 40;
    for (let i = 0; i < COUNT; i++) lines.push(new TextLine());

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (const l of lines) { l.update(); l.draw(); }
        animId = requestAnimationFrame(animate);
    }
    animate();

    let _bodyDropdowns = [];

    window.__fichesCleanup = () => {
        cancelAnimationFrame(animId);
        window.removeEventListener('resize', resize);
        _bodyDropdowns.forEach(dd => { if (dd.parentNode === document.body) dd.remove(); });
    };

    /* ═══ EDITOR ═══ */
    const page      = document.getElementById('fiches-page');
    const homeView  = page.querySelector('.fiches-home');
    const editorView = page.querySelector('.fiches-editor');
    const createBtn = page.querySelector('.fiches-btn-create');
    const toolbar   = page.querySelector('.fe-toolbar');
    const card      = page.querySelector('.fe-card');
    const area      = page.querySelector('.fe-area');
    if (!area) return;

    let currentSize  = 'normal';
    let currentBg    = 'sobre';
    let isDirty      = false;
    const modDot     = toolbar.querySelector('.fe-modified-dot');

    function markDirty() {
        if (!isDirty) { isDirty = true; modDot.classList.add('visible'); }
    }
    function markClean() {
        isDirty = false; modDot.classList.remove('visible');
    }

    area.addEventListener('input', markDirty);

    /* ── Show editor ── */
    createBtn.addEventListener('click', () => {
        homeView.style.display = 'none';
        editorView.style.display = 'flex';
        markClean();
        area.focus();
    });

    /* ── Back button override: go to home if in editor ── */
    const origBack = window.returnToAtelier;
    const backBtn  = page.querySelector('.asub-back');
    backBtn.addEventListener('click', (e) => {
        if (editorView.style.display !== 'none') {
            e.stopImmediatePropagation();
            e.preventDefault();
            if (isDirty && !confirm('Tu as des modifications non enregistrées. Quitter quand même ?')) return false;
            editorView.style.display = 'none';
            homeView.style.display = '';
            dlBtn.style.display = 'none';
            markClean();
            return false;
        }
    }, true);

    /* ── Size buttons ── */
    const SIZE_MAP = { normal: '3', subtitle: '5', title: '7' };
    const SIZE_REVERSE = { '3': 'normal', '5': 'subtitle', '7': 'title' };
    const sizeBtns = toolbar.querySelectorAll('.fe-size-btn');
    sizeBtns.forEach(btn => {
        btn.addEventListener('mousedown', e => e.preventDefault());
        btn.addEventListener('click', () => {
            sizeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentSize = btn.dataset.size;
            document.execCommand('fontSize', false, SIZE_MAP[currentSize]);
            area.focus();
        });
    });

    function getCurrentBlock() {
        const sel = window.getSelection();
        if (!sel.rangeCount) return null;
        let node = sel.anchorNode;
        while (node && node !== area) {
            if (node.nodeType === 1 && node.parentNode === area) return node;
            node = node.parentNode;
        }
        return null;
    }

    /* ── Format buttons (bold, italic, underline) ── */
    toolbar.querySelectorAll('.fe-format-btn').forEach(btn => {
        btn.addEventListener('mousedown', e => e.preventDefault());
        btn.addEventListener('click', () => {
            document.execCommand(btn.dataset.cmd, false, null);
            updateFormatState();
        });
    });

    /* ── Font dropdown ── */
    toolbar.querySelectorAll('[data-font]').forEach(btn => {
        btn.addEventListener('mousedown', e => e.preventDefault());
        btn.addEventListener('click', () => {
            document.execCommand('fontName', false, btn.dataset.font);
            closeAllDropdowns();
        });
    });

    /* ── Theme color map ── */
    const THEME_COLORS = {
        sobre: '#222', blocnote: '#4a3520', rose: '#5a1530',
        vert: '#14481a', bleu: '#0a3870'
    };

    function getThemeColor() { return THEME_COLORS[currentBg] || '#222'; }

    function updateThemeSwatch() {
        const ts = toolbar.querySelector('.fe-swatch-theme');
        if (ts) ts.style.background = getThemeColor();
    }

    /* ── Color dropdown ── */
    toolbar.querySelectorAll('.fe-color-item').forEach(btn => {
        btn.addEventListener('mousedown', e => e.preventDefault());
        btn.addEventListener('click', () => {
            const color = btn.dataset.color === 'theme' ? getThemeColor() : btn.dataset.color;
            document.execCommand('foreColor', false, color);
            const swatch = toolbar.querySelector('.fe-color-trigger .fe-swatch');
            swatch.style.background = color;
            swatch.dataset.currentColor = color;
            closeAllDropdowns();
        });
    });

    /* ── Background dropdown ── */
    toolbar.querySelectorAll('.fe-bg-item').forEach(btn => {
        btn.addEventListener('mousedown', e => e.preventDefault());
        btn.addEventListener('click', () => {
            currentBg = btn.dataset.bg;
            card.dataset.theme = currentBg;
            const swatch = toolbar.querySelector('.fe-swatch-bg');
            const mini = btn.querySelector('.fe-swatch-mini');
            swatch.style.background = mini ? mini.style.background : '';
            swatch.dataset.currentBg = currentBg;
            updateThemeSwatch();
            closeAllDropdowns();
        });
    });

    /* ── Separator button ── */
    toolbar.querySelector('.fe-sep-btn').addEventListener('mousedown', e => e.preventDefault());
    toolbar.querySelector('.fe-sep-btn').addEventListener('click', () => {
        const sep = document.createElement('div');
        sep.className = 'fe-separator';
        sep.contentEditable = 'false';
        sep.innerHTML = '<hr>';

        const after = document.createElement('div');
        after.className = 'fe-line';
        after.innerHTML = '<br>';

        const block = getCurrentBlock();
        if (block && block.nextSibling) {
            area.insertBefore(sep, block.nextSibling);
            area.insertBefore(after, sep.nextSibling);
        } else {
            area.appendChild(sep);
            area.appendChild(after);
        }

        // Place cursor in the new line after separator
        const sel = window.getSelection();
        const range = document.createRange();
        range.setStart(after, 0);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
    });

    /* ── Dropdown toggle logic ── */
    // Link triggers to their dropdowns BEFORE moving
    toolbar.querySelectorAll('.fe-dropdown-wrap').forEach(wrap => {
        const trigger = wrap.children[0];
        const dd = wrap.querySelector('.fe-dropdown');
        trigger._dropdown = dd;
    });

    // Move all dropdowns to document.body so backdrop-filter/transform don't trap them
    const allDropdowns = [...toolbar.querySelectorAll('.fe-dropdown')];
    allDropdowns.forEach(dd => {
        document.body.appendChild(dd);
        dd.addEventListener('click', e => e.stopPropagation());
    });
    _bodyDropdowns = allDropdowns;

    function positionDropdown(trigger, dd) {
        const rect = trigger.getBoundingClientRect();
        dd.style.top  = (rect.bottom + 6) + 'px';
        dd.style.left = (rect.left + rect.width / 2) + 'px';
        dd.style.transform = 'translateX(-50%)';
    }

    toolbar.querySelectorAll('.fe-dropdown-wrap').forEach(wrap => {
        const trigger = wrap.children[0];
        trigger.addEventListener('mousedown', e => e.preventDefault());
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const dd = trigger._dropdown;
            if (!dd) return;
            const isOpen = dd.classList.contains('show');
            closeAllDropdowns();
            if (!isOpen) {
                positionDropdown(trigger, dd);
                dd.classList.add('show');
            }
        });
    });

    function closeAllDropdowns() {
        allDropdowns.forEach(d => d.classList.remove('show'));
    }

    document.addEventListener('click', closeAllDropdowns);

    /* ── Undo / Redo buttons ── */
    const undoBtn = toolbar.querySelector('.fe-undo-btn');
    const redoBtn = toolbar.querySelector('.fe-redo-btn');
    undoBtn.addEventListener('mousedown', e => e.preventDefault());
    redoBtn.addEventListener('mousedown', e => e.preventDefault());
    undoBtn.addEventListener('click', () => { document.execCommand('undo'); area.focus(); });
    redoBtn.addEventListener('click', () => { document.execCommand('redo'); area.focus(); });

    /* ── Keyboard handling in editor ── */
    area.addEventListener('keydown', (e) => {
        // Ctrl+S → open save panel
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            openDownloadPanel();
            return;
        }
        // Ctrl+B/I/U handled natively by contentEditable

        // Enter: create new line with current size
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const newLine = document.createElement('div');
            newLine.className = 'fe-line';
            newLine.innerHTML = '<br>';

            const block = getCurrentBlock();
            if (block && block.nextSibling) {
                area.insertBefore(newLine, block.nextSibling);
            } else {
                area.appendChild(newLine);
            }

            const sel = window.getSelection();
            const range = document.createRange();
            range.setStart(newLine, 0);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
            return;
        }

        // Backspace: delete separator if cursor is right after one
        if (e.key === 'Backspace') {
            const block = getCurrentBlock();
            if (block && block.previousSibling &&
                block.previousSibling.classList &&
                block.previousSibling.classList.contains('fe-separator')) {
                // If current block is empty, delete both separator and this line
                const text = block.textContent || '';
                if (text.trim() === '') {
                    e.preventDefault();
                    const sep = block.previousSibling;
                    const prev = sep.previousSibling;
                    sep.remove();
                    block.remove();
                    if (prev) {
                        const sel = window.getSelection();
                        const range = document.createRange();
                        range.selectNodeContents(prev);
                        range.collapse(false);
                        sel.removeAllRanges();
                        sel.addRange(range);
                    }
                }
            }
        }
    });

    /* ── Track format state on selection change ── */
    area.addEventListener('keyup', updateFormatState);
    area.addEventListener('mouseup', updateFormatState);

    function updateFormatState() {
        // Sync size button active state via queryCommandValue
        const fsVal = document.queryCommandValue('fontSize');
        const sz = SIZE_REVERSE[fsVal] || 'normal';
        currentSize = sz;
        sizeBtns.forEach(b => b.classList.toggle('active', b.dataset.size === sz));

        // Sync format buttons
        toolbar.querySelectorAll('.fe-format-btn').forEach(btn => {
            btn.classList.toggle('active', document.queryCommandState(btn.dataset.cmd));
        });
    }

    /* ── .fiche format serialization ── */
    function htmlToFiche() {
        let out = '@bg:' + currentBg + '\n';
        const children = area.children;
        for (let i = 0; i < children.length; i++) {
            const el = children[i];
            if (el.classList.contains('fe-separator')) {
                out += '---\n';
                continue;
            }
            out += serializeInline(el) + '\n';
        }
        return out.trimEnd();
    }

    function serializeInline(el) {
        let result = '';
        el.childNodes.forEach(node => {
            if (node.nodeType === 3) {
                result += node.textContent;
                return;
            }
            if (node.nodeType !== 1) return;
            const tag = node.tagName.toLowerCase();
            let inner = serializeInline(node);

            if (tag === 'b' || tag === 'strong') inner = '**' + inner + '**';
            else if (tag === 'i' || tag === 'em') inner = '__' + inner + '__';
            else if (tag === 'u') inner = '~~' + inner + '~~';

            if (tag === 'font') {
                const size = node.getAttribute('size');
                const face = node.getAttribute('face');
                const color = node.getAttribute('color');
                if (size === '7') inner = '{s:7}' + inner + '{/s}';
                else if (size === '5') inner = '{s:5}' + inner + '{/s}';
                if (face) inner = '{f:' + face + '}' + inner + '{/f}';
                if (color) inner = '{c:' + color + '}' + inner + '{/c}';
            }

            if (tag === 'span') {
                const st = node.style;
                // font-weight (bold via span)
                if (st.fontWeight === 'bold' || parseInt(st.fontWeight) >= 700)
                    inner = '**' + inner + '**';
                // font-style (italic via span)
                if (st.fontStyle === 'italic') inner = '__' + inner + '__';
                // text-decoration (underline via span)
                if (st.textDecoration && st.textDecoration.includes('underline'))
                    inner = '~~' + inner + '~~';
                // font-size via span style
                if (st.fontSize) {
                    const px = parseFloat(st.fontSize);
                    if (px >= 32 || st.fontSize === 'xxx-large' || st.fontSize === '-webkit-xxx-large')
                        inner = '{s:7}' + inner + '{/s}';
                    else if (px >= 18 || st.fontSize === 'x-large' || st.fontSize === 'large')
                        inner = '{s:5}' + inner + '{/s}';
                }
                if (st.fontFamily) inner = '{f:' + st.fontFamily + '}' + inner + '{/f}';
                if (st.color) inner = '{c:' + st.color + '}' + inner + '{/c}';
            }

            result += inner;
        });
        return result;
    }

    function ficheToHtml(fiche) {
        const lines = fiche.split('\n');
        let html = '';
        for (const line of lines) {
            if (line.startsWith('@bg:')) {
                currentBg = line.slice(4).trim();
                card.dataset.theme = currentBg;
                continue;
            }
            if (line.trim() === '---') {
                html += '<div class="fe-separator" contenteditable="false"><hr></div>';
                continue;
            }
            const inner = parseInline(line);
            html += '<div class="fe-line">' + (inner || '<br>') + '</div>';
        }
        return html;
    }

    function parseInline(text) {
        // Escape HTML first
        text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        // Bold **text**
        text = text.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
        // Italic __text__
        text = text.replace(/__(.+?)__/g, '<i>$1</i>');
        // Underline ~~text~~
        text = text.replace(/~~(.+?)~~/g, '<u>$1</u>');
        // Inline size markers {s:7}text{/s} and {s:5}text{/s}
        text = text.replace(/\{s:7\}(.+?)\{\/s\}/g, '<font size="7">$1</font>');
        text = text.replace(/\{s:5\}(.+?)\{\/s\}/g, '<font size="5">$1</font>');
        // Backward compat: line-level # title and ## subtitle (old format)
        text = text.replace(/^## (.+)$/gm, '<font size="5">$1</font>');
        text = text.replace(/^# (.+)$/gm, '<font size="7">$1</font>');
        // Font {f:name}text{/f}
        text = text.replace(/\{f:([^}]+)\}(.+?)\{\/f\}/g, '<span style="font-family:$1">$2</span>');
        // Color {c:color}text{/c}
        text = text.replace(/\{c:([^}]+)\}(.+?)\{\/c\}/g, '<span style="color:$1">$2</span>');
        return text;
    }

    /* ═══ DOWNLOAD PANEL ═══ */
    const dlBtn     = page.querySelector('.fe-download-btn');
    const dlOverlay = page.querySelector('.fe-dl-overlay');
    const dlClose   = page.querySelector('.fe-dl-close');
    const dlPreview = page.querySelector('.fe-dl-preview');
    const saveForm  = page.querySelector('.fe-save-form');

    // Current fiche id when editing an existing one
    let currentFicheId = null;

    // Show download button only when editor is visible
    createBtn.addEventListener('click', () => { dlBtn.style.display = 'flex'; currentFicheId = null; });
    backBtn.addEventListener('click', () => { dlBtn.style.display = 'none'; }, true);

    function openDownloadPanel() {
        // Clone card for preview
        const clone = card.cloneNode(true);
        clone.classList.add('fe-dl-preview-card');
        clone.style.cssText = 'pointer-events:none; width:100%;';
        dlPreview.innerHTML = '';
        dlPreview.appendChild(clone);
        saveForm.style.display = 'none';
        dlOverlay.style.display = 'flex';
    }

    function closeDownloadPanel() {
        dlOverlay.style.display = 'none';
        dlPreview.innerHTML = '';
        saveForm.style.display = 'none';
    }

    dlBtn.addEventListener('click', openDownloadPanel);
    dlClose.addEventListener('click', closeDownloadPanel);
    dlOverlay.addEventListener('click', (e) => {
        if (e.target === dlOverlay) closeDownloadPanel();
    });

    // Load a script dynamically (returns promise)
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            if (document.querySelector('script[src="' + src + '"]')) return resolve();
            const s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }

    // Action handlers
    page.querySelectorAll('.fe-dl-action').forEach(btn => {
        btn.addEventListener('click', async () => {
            const action = btn.dataset.action;

            if (action === 'print') {
                closeDownloadPanel();
                // Temporarily mark the card for print CSS targeting
                card.classList.add('fiches-printing');
                window.print();
                card.classList.remove('fiches-printing');
                return;
            }

            if (action === 'alphasource') {
                // Toggle save form visibility
                if (saveForm.style.display === 'none') {
                    saveForm.style.display = 'flex';
                    // Pre-fill if editing existing
                    if (currentFicheId) {
                        // keep current values
                    } else {
                        document.getElementById('fe-save-name').value = '';
                        document.getElementById('fe-save-desc').value = '';
                        document.getElementById('fe-save-matiere').value = '';
                    }
                    document.getElementById('fe-save-name').focus();
                } else {
                    saveForm.style.display = 'none';
                }
                return;
            }

            if (action === 'save-confirm') {
                const nameEl = document.getElementById('fe-save-name');
                const name = nameEl.value.trim();
                if (!name) { nameEl.style.borderColor = '#ff6b6b'; nameEl.focus(); return; }
                nameEl.style.borderColor = '';

                const username = localStorage.getItem('source_username');
                if (!username) { alert('Connecte-toi pour sauvegarder.'); return; }

                const body = {
                    username,
                    name,
                    description: document.getElementById('fe-save-desc').value.trim(),
                    matiere: document.getElementById('fe-save-matiere').value,
                    content: htmlToFiche()
                };
                if (currentFicheId) body.id = currentFicheId;

                try {
                    const res = await fetch('/api/fiches/save', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body)
                    });
                    const data = await res.json();
                    if (data.success) {
                        currentFicheId = data.id;
                        markClean();
                        closeDownloadPanel();
                    } else {
                        alert(data.error || 'Erreur');
                    }
                } catch (e) {
                    console.error('Save failed:', e);
                    alert('Erreur réseau');
                }
                return;
            }

            if (action === 'png') {
                await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
                closeDownloadPanel();
                try {
                    const canvas = await html2canvas(card, { scale: 2, useCORS: true });
                    const link = document.createElement('a');
                    link.download = 'fiche-revision.png';
                    link.href = canvas.toDataURL('image/png');
                    link.click();
                } catch (err) {
                    console.error('PNG export failed:', err);
                }
            }

            if (action === 'pdf') {
                await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
                await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
                closeDownloadPanel();
                try {
                    const canvas = await html2canvas(card, { scale: 2, useCORS: true });
                    const imgData = canvas.toDataURL('image/png');
                    const JsPDF = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
                    const pxToMm = 0.264583;
                    const w = canvas.width * pxToMm;
                    const h = canvas.height * pxToMm;
                    const pdf = new JsPDF({
                        orientation: w > h ? 'landscape' : 'portrait',
                        unit: 'mm',
                        format: [w, h]
                    });
                    pdf.addImage(imgData, 'PNG', 0, 0, w, h);
                    pdf.save('fiche-revision.pdf');
                } catch (err) {
                    console.error('PDF export failed:', err);
                }
            }
        });
    });

    /* ═══ MES FICHES (list view) ═══ */
    const listView    = page.querySelector('.fiches-list-view');
    const listGrid    = page.querySelector('.fl-grid');
    const listEmpty   = page.querySelector('.fl-empty');
    const listSearch  = page.querySelector('.fl-search-input');
    const listFilter  = page.querySelector('.fl-matiere-filter');
    const listBtn     = page.querySelector('.fiches-btn-list');

    function showListView() {
        homeView.style.display = 'none';
        editorView.style.display = 'none';
        listView.style.display = 'flex';
        dlBtn.style.display = 'none';
        loadFiches();
    }

    listBtn.addEventListener('click', showListView);

    // Extended back handler: list view → home
    backBtn.addEventListener('click', (e) => {
        if (listView.style.display !== 'none') {
            e.stopImmediatePropagation();
            e.preventDefault();
            listView.style.display = 'none';
            homeView.style.display = '';
            return false;
        }
    }, true);

    let searchTimeout;
    listSearch.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(loadFiches, 300);
    });
    listFilter.addEventListener('change', loadFiches);

    async function loadFiches() {
        const username = localStorage.getItem('source_username');
        if (!username) { listGrid.innerHTML = ''; listEmpty.style.display = 'flex'; return; }

        const q = (listSearch.value || '').trim();
        const matiere = listFilter.value;
        const params = new URLSearchParams({ username });
        if (q) params.set('q', q);
        if (matiere) params.set('matiere', matiere);

        try {
            const res = await fetch('/api/fiches/list?' + params);
            const data = await res.json();
            if (!data.success || !data.fiches.length) {
                listGrid.innerHTML = '';
                listEmpty.style.display = 'flex';
                return;
            }
            listEmpty.style.display = 'none';
            renderFiches(data.fiches);
        } catch (e) {
            console.error('Load fiches failed:', e);
            listGrid.innerHTML = '';
            listEmpty.style.display = 'flex';
        }
    }

    const THEME_BG = {
        sobre: '#c8c8c8', blocnote: '#f5e6b8', rose: '#f4b8c8',
        vert: '#b8dfc0', bleu: '#b0d4f1',
    };

    function parsePreviewInline(text) {
        text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        // Bold / italic / underline
        text = text.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
        text = text.replace(/__(.+?)__/g, '<i>$1</i>');
        text = text.replace(/~~(.+?)~~/g, '<u>$1</u>');
        // Strip sizes (don't render them big)
        text = text.replace(/\{s:\d+\}(.+?)\{\/s\}/g, '$1');
        text = text.replace(/^## (.+)$/gm, '$1');
        text = text.replace(/^# (.+)$/gm, '$1');
        // Font family
        text = text.replace(/\{f:([^}]+)\}(.+?)\{\/f\}/g, '$2');
        // Keep colors
        text = text.replace(/\{c:([^}]+)\}(.+?)\{\/c\}/g, '<span style="color:$1">$2</span>');
        return text;
    }

    function fichePreviewHtml(f) {
        if (!f.content) return { html: '', bg: 'sobre' };
        const lines = f.content.split('\n');
        let html = '';
        let bg = 'sobre';
        let count = 0;
        for (const line of lines) {
            if (line.startsWith('@bg:')) { bg = line.slice(4).trim(); continue; }
            if (count >= 4) break;
            if (line.trim() === '---') { html += '<hr class="fl-pv-sep">'; count++; continue; }
            const inner = parsePreviewInline(line);
            html += '<div class="fl-pv-line">' + (inner || '&nbsp;') + '</div>';
            count++;
        }
        return { html, bg };
    }

    function renderFiches(fiches) {
        listGrid.innerHTML = fiches.map(f => {
            const date = new Date(f.updated_at || f.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
            const pv = fichePreviewHtml(f);
            const tc = { bg: THEME_BG[pv.bg] || '#c8c8c8', text: THEME_COLORS[pv.bg] || '#222' };
            return `<div class="fl-card" data-id="${f.id}">
                <div class="fl-card-name">${escHtml(f.name)}</div>
                ${f.description ? `<div class="fl-card-desc">${escHtml(f.description)}</div>` : ''}
                ${pv.html ? `<div class="fl-card-preview" style="background:${tc.bg};color:${tc.text}">${pv.html}</div>` : ''}
                <div class="fl-card-meta">
                    ${f.matiere ? `<span class="fl-card-matiere">${escHtml(f.matiere)}</span>` : '<span></span>'}
                    <span class="fl-card-date">${date}</span>
                </div>
                <div class="fl-card-actions">
                    <button class="fl-card-btn fl-open" title="Ouvrir">
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        Ouvrir
                    </button>
                    <button class="fl-card-btn fl-delete" title="Supprimer">
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                    </button>
                </div>
            </div>`;
        }).join('');

        // Open handler
        listGrid.querySelectorAll('.fl-open').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.closest('.fl-card').dataset.id;
                openFiche(id);
            });
        });

        // Card click also opens
        listGrid.querySelectorAll('.fl-card').forEach(c => {
            c.addEventListener('click', () => openFiche(c.dataset.id));
        });

        // Delete handler
        listGrid.querySelectorAll('.fl-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.closest('.fl-card').dataset.id;
                deleteFiche(id);
            });
        });
    }

    function escHtml(s) {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    async function openFiche(id) {
        const username = localStorage.getItem('source_username');
        if (!username) return;
        try {
            const res = await fetch('/api/fiches/get?' + new URLSearchParams({ id, username }));
            const data = await res.json();
            if (!data.success) return;

            currentFicheId = data.fiche.id;
            // Load content into editor
            area.innerHTML = ficheToHtml(data.fiche.content);
            updateThemeSwatch();
            // Pre-fill save form fields for future save
            document.getElementById('fe-save-name').value = data.fiche.name || '';
            document.getElementById('fe-save-desc').value = data.fiche.description || '';
            document.getElementById('fe-save-matiere').value = data.fiche.matiere || '';

            // Switch to editor
            listView.style.display = 'none';
            homeView.style.display = 'none';
            editorView.style.display = 'flex';
            dlBtn.style.display = 'flex';
            markClean();
            area.focus();
        } catch (e) {
            console.error('Open fiche failed:', e);
        }
    }

    async function deleteFiche(id) {
        if (!confirm('Supprimer cette fiche ?')) return;
        const username = localStorage.getItem('source_username');
        if (!username) return;
        try {
            await fetch('/api/fiches/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, username })
            });
            loadFiches();
        } catch (e) {
            console.error('Delete fiche failed:', e);
        }
    }

    /* ═══ AI GENERATION VIEW ═══ */
    const aiView       = page.querySelector('.fiches-ai-view');
    const aiBtn        = page.querySelector('.fiches-btn-ai');
    const aiImgGrid    = page.querySelector('.fai-images-grid');
    const aiAddBtn     = page.querySelector('.fai-add-btn');
    const aiFileInput  = page.querySelector('.fai-file-input');
    const aiSourceOvl  = page.querySelector('.fai-source-overlay');
    const aiSourceClose= page.querySelector('.fai-source-close');
    const aiSrcPhone   = page.querySelector('.fai-src-phone');
    const aiSrcAlpha   = page.querySelector('.fai-src-alpha');
    const aiCoursesList= page.querySelector('.fai-courses-list');
    const aiCoursesGrid= page.querySelector('.fai-courses-grid');
    const aiCoursesLoad= page.querySelector('.fai-courses-loading');
    const aiInstructions= page.querySelector('.fai-instructions');
    const aiGenerateBtn= page.querySelector('.fai-generate-btn');
    const aiLoadingOvl = page.querySelector('.fai-loading-overlay');
    const aiLoadingSub = page.querySelector('.fai-loading-sub');

    // Store images as {base64, mimeType, preview}
    let aiImages = [];

    // Show AI view
    if (aiBtn) {
        aiBtn.addEventListener('click', () => {
            homeView.style.display = 'none';
            editorView.style.display = 'none';
            listView.style.display = 'none';
            aiView.style.display = 'flex';
            dlBtn.style.display = 'none';
        });
    }

    // Back from AI view
    backBtn.addEventListener('click', (e) => {
        if (aiView && aiView.style.display !== 'none') {
            e.stopImmediatePropagation();
            e.preventDefault();
            aiView.style.display = 'none';
            homeView.style.display = '';
            return false;
        }
    }, true);

    function updateGenerateBtn() {
        if (aiGenerateBtn) aiGenerateBtn.disabled = aiImages.length === 0;
    }

    function renderAiThumbs() {
        aiImgGrid.innerHTML = '';
        aiImages.forEach((img, i) => {
            const div = document.createElement('div');
            div.className = 'fai-img-thumb';
            div.innerHTML = `<img src="${img.preview}"><button class="fai-img-remove" data-idx="${i}">&times;</button>`;
            aiImgGrid.appendChild(div);
        });
        updateGenerateBtn();
    }

    aiImgGrid.addEventListener('click', (e) => {
        const btn = e.target.closest('.fai-img-remove');
        if (!btn) return;
        const idx = parseInt(btn.dataset.idx, 10);
        aiImages.splice(idx, 1);
        renderAiThumbs();
    });

    // Add button → open source picker
    aiAddBtn.addEventListener('click', () => {
        aiSourceOvl.style.display = 'flex';
        aiCoursesList.style.display = 'none';
    });

    aiSourceClose.addEventListener('click', () => {
        aiSourceOvl.style.display = 'none';
    });
    aiSourceOvl.addEventListener('click', (e) => {
        if (e.target === aiSourceOvl) aiSourceOvl.style.display = 'none';
    });

    // From phone/device
    aiSrcPhone.addEventListener('click', () => {
        aiSourceOvl.style.display = 'none';
        aiFileInput.click();
    });

    aiFileInput.addEventListener('change', () => {
        const files = Array.from(aiFileInput.files);
        if (!files.length) return;
        let loaded = 0;
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = () => {
                const dataUrl = reader.result;
                const base64 = dataUrl.split(',')[1];
                const mimeType = file.type || 'image/jpeg';
                aiImages.push({ base64, mimeType, preview: dataUrl });
                loaded++;
                if (loaded === files.length) renderAiThumbs();
            };
            reader.readAsDataURL(file);
        });
        aiFileInput.value = '';
    });

    // From AlphaSource courses
    aiSrcAlpha.addEventListener('click', async () => {
        aiCoursesList.style.display = 'flex';
        aiCoursesLoad.style.display = 'block';
        aiCoursesGrid.innerHTML = '';

        try {
            const username = localStorage.getItem('source_username');
            const res = await fetch('/public/api/course/list?username=' + encodeURIComponent(username || ''));
            const data = await res.json();
            aiCoursesLoad.style.display = 'none';

            const courses = (data.courses || []).filter(c => !c.supprime);
            if (!courses.length) {
                aiCoursesGrid.innerHTML = '<div class="fai-courses-loading">Aucun cours disponible</div>';
                return;
            }

            const imgExts = ['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif'];
            const imgCourses = courses.filter(c => {
                const ext = (c.filePath || '').split('.').pop().toLowerCase();
                return imgExts.includes('.' + ext);
            });

            if (!imgCourses.length) {
                aiCoursesGrid.innerHTML = '<div class="fai-courses-loading">Aucun cours image trouvé</div>';
                return;
            }

            imgCourses.forEach(c => {
                const item = document.createElement('div');
                item.className = 'fai-course-item';
                item.innerHTML = `
                    <img class="fai-course-thumb" src="${c.filePath}" alt="">
                    <div class="fai-course-info">
                        <div class="fai-course-name">${escapeHtml(c.title || 'Sans titre')}</div>
                        <div class="fai-course-sub">${escapeHtml(c.subject || '')} · ${escapeHtml(c.uploaderName || '')}</div>
                    </div>`;
                item.addEventListener('click', async () => {
                    // Fetch as base64
                    try {
                        const resp = await fetch(c.filePath);
                        const blob = await resp.blob();
                        const reader = new FileReader();
                        reader.onload = () => {
                            const dataUrl = reader.result;
                            const base64 = dataUrl.split(',')[1];
                            aiImages.push({ base64, mimeType: blob.type || 'image/jpeg', preview: dataUrl });
                            renderAiThumbs();
                            aiSourceOvl.style.display = 'none';
                        };
                        reader.readAsDataURL(blob);
                    } catch (err) {
                        console.error('Failed to load course image:', err);
                    }
                });
                aiCoursesGrid.appendChild(item);
            });
        } catch (e) {
            console.error('Failed to load courses:', e);
            aiCoursesLoad.style.display = 'none';
            aiCoursesGrid.innerHTML = '<div class="fai-courses-loading">Erreur de chargement</div>';
        }
    });

    function escapeHtml(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // Generate!
    aiGenerateBtn.addEventListener('click', async () => {
        if (!aiImages.length) return;
        aiLoadingOvl.style.display = 'flex';
        aiLoadingSub.textContent = 'Analyse des images en cours';

        try {
            const username = localStorage.getItem('source_username');
            const instructions = aiInstructions.value.trim();

            const res = await fetch('/api/fiches/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username,
                    images: aiImages.map(img => ({ base64: img.base64, mimeType: img.mimeType })),
                    instructions
                })
            });

            const data = await res.json();
            aiLoadingOvl.style.display = 'none';

            if (!data.success) {
                alert(data.error || 'Erreur lors de la génération');
                return;
            }

            // Load generated fiche into editor
            currentFicheId = null;
            area.innerHTML = ficheToHtml(data.content);
            updateThemeSwatch();

            // Switch to editor
            aiView.style.display = 'none';
            editorView.style.display = 'flex';
            dlBtn.style.display = 'flex';
            markDirty(); // new unsaved content

            // Clear AI state
            aiImages = [];
            renderAiThumbs();
            aiInstructions.value = '';

        } catch (e) {
            console.error('AI generation failed:', e);
            aiLoadingOvl.style.display = 'none';
            alert('Erreur réseau lors de la génération');
        }
    });

})();
