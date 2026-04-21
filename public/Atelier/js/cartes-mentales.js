// Cartes Mentales — Nodes spawning nodes and connecting infinitely
(function () {
    const canvas = document.getElementById('mindmap-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    const NODE_COLOR = 'rgba(100,230,180,';
    const LINE_COLOR = 'rgba(100,230,180,0.08)';
    const MAX_NODES = 80;

    class Node {
        constructor(x, y, parent) {
            this.x = x;
            this.y = y;
            this.r = 3 + Math.random() * 5;
            this.vx = (Math.random() - 0.5) * 0.4;
            this.vy = (Math.random() - 0.5) * 0.4;
            this.parent = parent;
            this.age = 0;
            this.maxAge = 400 + Math.random() * 600;
            this.spawnTimer = 80 + Math.random() * 200;
            this.opacity = 0;
        }
        update() {
            this.x += this.vx;
            this.y += this.vy;
            this.age++;
            this.spawnTimer--;

            // Fade in/out
            if (this.age < 60) this.opacity = this.age / 60;
            else if (this.age > this.maxAge - 60) this.opacity = Math.max(0, (this.maxAge - this.age) / 60);
            else this.opacity = 1;

            // Gentle boundary bounce
            if (this.x < 20 || this.x > canvas.width - 20) this.vx *= -1;
            if (this.y < 20 || this.y > canvas.height - 20) this.vy *= -1;
        }
        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
            ctx.fillStyle = NODE_COLOR + (0.25 * this.opacity) + ')';
            ctx.fill();
            // Glow
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.r + 4, 0, Math.PI * 2);
            ctx.fillStyle = NODE_COLOR + (0.06 * this.opacity) + ')';
            ctx.fill();
        }
        isDead() { return this.age >= this.maxAge; }
        shouldSpawn() { return this.spawnTimer <= 0 && this.opacity > 0.5; }
    }

    let nodes = [];

    function seed() {
        for (let i = 0; i < 8; i++) {
            nodes.push(new Node(
                100 + Math.random() * (canvas.width - 200),
                100 + Math.random() * (canvas.height - 200),
                null
            ));
        }
    }
    seed();

    function drawConnections() {
        ctx.strokeStyle = LINE_COLOR;
        ctx.lineWidth = 1;
        for (const n of nodes) {
            if (n.parent && !n.parent.isDead()) {
                ctx.globalAlpha = Math.min(n.opacity, n.parent.opacity) * 0.5;
                ctx.beginPath();
                ctx.moveTo(n.x, n.y);
                ctx.lineTo(n.parent.x, n.parent.y);
                ctx.stroke();
            }
        }
        // Connect nearby nodes
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const dx = nodes[i].x - nodes[j].x;
                const dy = nodes[i].y - nodes[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 120) {
                    ctx.globalAlpha = (1 - dist / 120) * 0.15 * Math.min(nodes[i].opacity, nodes[j].opacity);
                    ctx.beginPath();
                    ctx.moveTo(nodes[i].x, nodes[i].y);
                    ctx.lineTo(nodes[j].x, nodes[j].y);
                    ctx.stroke();
                }
            }
        }
        ctx.globalAlpha = 1;
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawConnections();

        const toSpawn = [];
        for (const n of nodes) {
            n.update();
            n.draw();
            if (n.shouldSpawn() && nodes.length + toSpawn.length < MAX_NODES) {
                n.spawnTimer = 150 + Math.random() * 300;
                const angle = Math.random() * Math.PI * 2;
                const dist = 40 + Math.random() * 60;
                toSpawn.push(new Node(
                    n.x + Math.cos(angle) * dist,
                    n.y + Math.sin(angle) * dist,
                    n
                ));
            }
        }

        nodes.push(...toSpawn);
        nodes = nodes.filter(n => !n.isDead());

        // Re-seed if too few
        if (nodes.length < 4) seed();

        animId = requestAnimationFrame(animate);
    }
    animate();

    window.__cartesMentalesCleanup = () => {
        cancelAnimationFrame(animId);
        window.removeEventListener('resize', resize);
    };
})();

/* ═══════════════════════════════════════════════════════════════
   MIND MAP EDITOR
   ═══════════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    const page = document.getElementById('cartes-mentales-page');
    if (!page) return;

    /* ── Constants ────────────────────────── */
    const MAX_CHILDREN = 15;
    const MAX_DEPTH = 5;

    const BUBBLE_COLORS = [
        { bg: '#dbeafe', border: '#3b82f6', name: 'Bleu' },
        { bg: '#dcfce7', border: '#22c55e', name: 'Vert' },
        { bg: '#fef9c3', border: '#eab308', name: 'Jaune' },
        { bg: '#fee2e2', border: '#ef4444', name: 'Rouge' },
        { bg: '#f3e8ff', border: '#a855f7', name: 'Violet' },
        { bg: '#ccfbf1', border: '#14b8a6', name: 'Teal' },
        { bg: '#ffe4e6', border: '#f43f5e', name: 'Rose' },
        { bg: '#f1f5f9', border: '#64748b', name: 'Gris' },
    ];

    const TEXT_COLORS = ['#222', '#888', '#e53935', '#43a047', '#1e88e5'];

    /* ── DOM refs ─────────────────────────── */
    const homeView    = page.querySelector('.cm-home');
    const editorView  = page.querySelector('.cm-editor');
    const aiView      = page.querySelector('.cm-ai-view');
    const canvasWrap  = page.querySelector('.cm-canvas-wrap');
    const canvas      = page.querySelector('.cm-canvas');
    const svgLayer    = page.querySelector('.cm-svg-layer');
    const toolbar     = page.querySelector('.cm-toolbar');
    const addBtn      = page.querySelector('.cm-add-bubble-btn');
    const deleteBtn   = page.querySelector('.cm-delete-btn');
    const bcolorTrigger = page.querySelector('.cm-bubble-color-trigger');
    const bcolorGrid  = page.querySelector('.cm-bcolor-grid');
    const colorTrigger  = page.querySelector('.cm-color-trigger');
    const colorDropdown = page.querySelector('.cm-color-dropdown');
    const bgTrigger     = page.querySelector('.cm-bg-trigger');
    const bgDropdown    = page.querySelector('.cm-bg-dropdown');
    const bcolorDropdown = page.querySelector('.cm-bcolor-dropdown');
    const swatchBg      = page.querySelector('.cm-swatch-bg');
    const swatchColor   = page.querySelector('.cm-swatch');

    /* ── State ────────────────────────────── */
    let nodes = new Map();   // id → { id, parentId, depth, colorIdx, x, y, el, childIds }
    let nextId = 1;
    let selectedId = null;
    let currentTextColor = '#222';

    /* drag state */
    let dragId = null;
    let dragOffX = 0, dragOffY = 0;
    let dragStartX = 0, dragStartY = 0;
    let didMove = false;
    let touchNodeId = null;

    /* ── Keep focus in contenteditable when clicking toolbar ── */
    toolbar.addEventListener('mousedown', (e) => {
        e.preventDefault();
    });

    /* ── Populate bubble color grid ───────── */
    BUBBLE_COLORS.forEach((c, i) => {
        const dot = document.createElement('button');
        dot.className = 'cm-bcolor-dot';
        dot.title = c.name;
        dot.style.setProperty('--dot-bg', c.bg);
        dot.style.setProperty('--dot-border', c.border);
        dot.dataset.idx = i;
        dot.addEventListener('click', () => setBubbleColor(i));
        bcolorGrid.appendChild(dot);
    });

    /* ── Navigation ───────────────────────── */
    const createBtn = page.querySelector('.cm-btn-create');
    if (createBtn) {
        createBtn.addEventListener('click', () => {
            homeView.style.display = 'none';
            editorView.style.display = 'flex';
            const dlb = page.querySelector('.cm-download-btn');
            if (dlb) dlb.style.display = 'flex';
            currentCarteId = null;
            mapDirty = false;
            if (nodes.size === 0) initMap();
        });
    }

    /* AI button → open AI view */
    const aiBtnHome = page.querySelector('.cm-btn-ai');
    if (aiBtnHome) {
        aiBtnHome.addEventListener('click', () => {
            homeView.style.display = 'none';
            if (aiView) aiView.style.display = 'flex';
        });
    }

    /* Back button override when in editor */
    const backBtn = page.querySelector('.asub-back');
    const origBack = backBtn ? backBtn.getAttribute('onclick') : null;
    if (backBtn) {
        backBtn.removeAttribute('onclick');
        backBtn.addEventListener('click', () => {
            const listView = page.querySelector('.cm-list-view');
            const dlb = page.querySelector('.cm-download-btn');
            if (editorView.style.display !== 'none') {
                if (mapDirty && !confirm('Ta carte n\'est pas enregistrée. Quitter quand même ?')) return;
                editorView.style.display = 'none';
                homeView.style.display = '';
                if (dlb) dlb.style.display = 'none';
                mapDirty = false;
            } else if (aiView && aiView.style.display !== 'none') {
                aiView.style.display = 'none';
                homeView.style.display = '';
            } else if (listView && listView.style.display !== 'none') {
                listView.style.display = 'none';
                homeView.style.display = '';
            } else if (window.returnToAtelier) {
                window.returnToAtelier();
            }
        });
    }

    /* ── Node creation ────────────────────── */
    function initMap() {
        nodes.clear();
        canvas.innerHTML = '';
        svgLayer.innerHTML = '';
        nextId = 1;
        selectedId = null;
        updateToolbarState();

        /* place root in center of visible area */
        const wrapW = canvasWrap.clientWidth || 800;
        const wrapH = canvasWrap.clientHeight || 500;
        const cx = Math.round(wrapW / 2);
        const cy = Math.round(wrapH / 2);
        createNode({ id: 0, parentId: null, depth: 0, colorIdx: 0, x: cx - 70, y: cy - 40, isRoot: true });
    }

    function createNode(opts) {
        const { id, parentId, depth, colorIdx, x, y, isRoot } = opts;
        const c = BUBBLE_COLORS[colorIdx % BUBBLE_COLORS.length];

        const el = document.createElement('div');
        el.className = 'cm-node' + (isRoot ? ' cm-root' : '');
        el.dataset.id = id;
        el.style.left = x + 'px';
        el.style.top = y + 'px';
        el.style.setProperty('--nbg', c.bg);
        el.style.setProperty('--nbdr', c.border);

        if (isRoot) {
            el.innerHTML =
                '<div class="cm-node-text" contenteditable="true">Titre</div>';
        } else {
            el.innerHTML =
                '<div class="cm-node-text" contenteditable="true">Texte ici</div>';
        }

        /* Events */
        el.addEventListener('mousedown', (e) => onNodeMouseDown(e, id));
        el.addEventListener('touchstart', (e) => onNodeTouchStart(e, id), { passive: false });

        canvas.appendChild(el);

        const node = { id, parentId, depth, colorIdx, x, y, el, childIds: [], isRoot: !!isRoot };
        nodes.set(id, node);

        if (parentId !== null) {
            const parent = nodes.get(parentId);
            if (parent) parent.childIds.push(id);
        }

        return node;
    }

    function addChild(parentId) {
        const parent = nodes.get(parentId);
        if (!parent) return;
        if (parent.childIds.length >= MAX_CHILDREN) return;
        if (parent.depth + 1 >= MAX_DEPTH) return;

        const angle = spreadAngle(parent);
        const dist = 180 + parent.depth * 30;
        const newX = parent.x + Math.cos(angle) * dist;
        const newY = parent.y + Math.sin(angle) * dist;
        const childColor = (parent.colorIdx + 1) % BUBBLE_COLORS.length;

        const id = nextId++;
        const clampedX = Math.max(20, newX);
        const clampedY = Math.max(20, newY);
        const child = createNode({
            id,
            parentId,
            depth: parent.depth + 1,
            colorIdx: childColor,
            x: clampedX,
            y: clampedY,
            isRoot: false,
        });
        expandCanvas(clampedX, clampedY, child.el);
        updateConnections();
        mapDirty = true;
    }

    function spreadAngle(parent) {
        const n = parent.childIds.length;
        /* base direction: away from grandparent, or right */
        let base = 0;
        if (parent.parentId !== null) {
            const gp = nodes.get(parent.parentId);
            if (gp) base = Math.atan2(parent.y - gp.y, parent.x - gp.x);
        }
        const spread = Math.PI / 3;
        const offset = (n - (parent.childIds.length - 1) / 2) * spread / Math.max(1, parent.childIds.length);
        return base + offset + (n % 2 === 0 ? spread / 4 : -spread / 4);
    }

    function removeNodeRecursive(id) {
        const node = nodes.get(id);
        if (!node) return;
        /* remove children first */
        [...node.childIds].forEach(cid => removeNodeRecursive(cid));
        /* detach from parent */
        if (node.parentId !== null) {
            const parent = nodes.get(node.parentId);
            if (parent) parent.childIds = parent.childIds.filter(c => c !== id);
        }
        node.el.remove();
        nodes.delete(id);
        if (selectedId === id) {
            selectedId = null;
            updateToolbarState();
        }
    }

    /* ── Selection ─────────────────────────── */
    function selectNode(id) {
        deselectAll();
        selectedId = id;
        const node = nodes.get(id);
        if (node) node.el.classList.add('cm-selected');
        updateToolbarState();
    }

    function deselectAll() {
        if (selectedId !== null) {
            const node = nodes.get(selectedId);
            if (node) node.el.classList.remove('cm-selected');
        }
        selectedId = null;
        updateToolbarState();
    }

    function updateToolbarState() {
        const hasSel = selectedId !== null;
        const selNode = hasSel ? nodes.get(selectedId) : null;
        addBtn.disabled = !hasSel || (selNode && (selNode.childIds.length >= MAX_CHILDREN || selNode.depth + 1 >= MAX_DEPTH));
        deleteBtn.disabled = !hasSel || (selNode && selNode.isRoot);
        bcolorTrigger.disabled = !hasSel;
    }

    /* ── Mouse / Touch — drag & select ────── */
    function focusEditable(el) {
        el.focus();
        /* Place a visible cursor inside the element (critical for empty fields) */
        const sel = window.getSelection();
        if (!sel.rangeCount || !el.contains(sel.anchorNode)) {
            const range = document.createRange();
            range.selectNodeContents(el);
            range.collapse(false); /* cursor at end */
            sel.removeAllRanges();
            sel.addRange(range);
        }
    }

    function onNodeMouseDown(e, id) {
        /* let clicks on contenteditable text go through for editing */
        const editable = e.target.closest('[contenteditable]');
        if (editable) {
            /* select the node but don't block text interaction */
            selectNode(id);
            /* Always ensure the contenteditable gets focus + cursor */
            focusEditable(editable);
            return;
        }
        e.preventDefault();
        const node = nodes.get(id);
        if (!node) return;

        dragId = id;
        const rect = canvasWrap.getBoundingClientRect();
        const px = e.clientX + canvasWrap.scrollLeft - rect.left;
        const py = e.clientY + canvasWrap.scrollTop - rect.top;
        dragOffX = px - node.x;
        dragOffY = py - node.y;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        didMove = false;

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    function onMouseMove(e) {
        if (dragId === null) return;
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;
        if (!didMove && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
        didMove = true;

        const node = nodes.get(dragId);
        if (!node) return;
        const rect = canvasWrap.getBoundingClientRect();
        let nx = e.clientX + canvasWrap.scrollLeft - rect.left - dragOffX;
        let ny = e.clientY + canvasWrap.scrollTop - rect.top - dragOffY;
        nx = Math.max(0, nx);
        ny = Math.max(0, ny);
        node.x = nx;
        node.y = ny;
        node.el.style.left = nx + 'px';
        node.el.style.top = ny + 'px';
        expandCanvas(nx, ny, node.el);
        updateConnections();
    }

    function onMouseUp(e) {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        if (dragId !== null && !didMove) {
            selectNode(dragId);
        }
        if (didMove) mapDirty = true;
        dragId = null;
    }

    /* Touch support — slide to drag, tap to select/edit */
    function onNodeTouchStart(e, id) {
        /* If this node is already selected AND touch started inside a focused
           contenteditable, let the browser handle text selection natively */
        const touchTarget = e.target;
        const editableTarget = touchTarget.closest?.('[contenteditable]');
        if (selectedId === id && editableTarget && editableTarget === document.activeElement) {
            /* Don't preventDefault → allows native word/phrase selection */
            return;
        }

        if (e.cancelable) e.preventDefault();

        const touch = e.touches[0];
        const node = nodes.get(id);
        if (!node) return;

        touchNodeId = id;
        dragId = id;
        dragStartX = touch.clientX;
        dragStartY = touch.clientY;
        didMove = false;

        const rect = canvasWrap.getBoundingClientRect();
        dragOffX = touch.clientX + canvasWrap.scrollLeft - rect.left - node.x;
        dragOffY = touch.clientY + canvasWrap.scrollTop - rect.top - node.y;

        document.addEventListener('touchmove', onTouchMove, { passive: false });
        document.addEventListener('touchend', onTouchEnd);
    }

    function onTouchMove(e) {
        if (dragId === null) return;
        const touch = e.touches[0];
        const dx = touch.clientX - dragStartX;
        const dy = touch.clientY - dragStartY;

        /* Small threshold to distinguish tap from drag */
        if (!didMove && Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        didMove = true;
        if (e.cancelable) e.preventDefault();

        const node = nodes.get(dragId);
        if (!node) return;

        const rect = canvasWrap.getBoundingClientRect();
        let nx = touch.clientX + canvasWrap.scrollLeft - rect.left - dragOffX;
        let ny = touch.clientY + canvasWrap.scrollTop - rect.top - dragOffY;
        nx = Math.max(0, nx);
        ny = Math.max(0, ny);
        node.x = nx;
        node.y = ny;
        node.el.style.left = nx + 'px';
        node.el.style.top = ny + 'px';
        expandCanvas(nx, ny, node.el);
        updateConnections();
    }

    function onTouchEnd(e) {
        document.removeEventListener('touchmove', onTouchMove);
        document.removeEventListener('touchend', onTouchEnd);

        /* Tap (no drag) → select or edit */
        if (!didMove && touchNodeId !== null) {
            if (selectedId === touchNodeId) {
                /* Already selected → focus text for editing */
                const node = nodes.get(touchNodeId);
                if (node) {
                    const editable = node.el.querySelector('[contenteditable]');
                    if (editable) focusEditable(editable);
                }
            } else {
                selectNode(touchNodeId);
            }
        }
        if (didMove) mapDirty = true;

        dragId = null;
        touchNodeId = null;
    }

    /* Deselect on canvas click */
    canvasWrap.addEventListener('mousedown', (e) => {
        if (e.target === canvas || e.target === canvasWrap) {
            deselectAll();
            closeAllDropdowns();
        }
    });

    /* Mark dirty on any text edit inside bubbles */
    canvas.addEventListener('input', () => { mapDirty = true; });

    /* ── Auto-expand canvas ───────────────── */
    function expandCanvas(x, y, el) {
        const right = x + (el ? el.offsetWidth : 200) + 40;
        const bottom = y + (el ? el.offsetHeight : 80) + 40;
        const curW = parseInt(canvas.style.minWidth) || canvas.offsetWidth;
        const curH = parseInt(canvas.style.minHeight) || canvas.offsetHeight;
        if (right > curW) canvas.style.minWidth = right + 'px';
        if (bottom > curH) canvas.style.minHeight = bottom + 'px';
    }

    /* ── SVG Connections ──────────────────── */
    function updateConnections() {
        svgLayer.innerHTML = '';
        nodes.forEach((node) => {
            if (node.parentId === null) return;
            const parent = nodes.get(node.parentId);
            if (!parent) return;

            /* centre of each bubble */
            const pw = parent.el.offsetWidth;
            const ph = parent.el.offsetHeight;
            const nw = node.el.offsetWidth;
            const nh = node.el.offsetHeight;

            const px = parent.x + pw / 2;
            const py = parent.y + ph / 2;
            const nx = node.x + nw / 2;
            const ny = node.y + nh / 2;

            /* edge points */
            const pEdge = edgePoint(parent.x, parent.y, pw, ph, nx, ny);
            const nEdge = edgePoint(node.x, node.y, nw, nh, px, py);

            /* control point for curve */
            const mx = (pEdge.x + nEdge.x) / 2;
            const my = (pEdge.y + nEdge.y) / 2;
            const dx = nEdge.x - pEdge.x;
            const dy = nEdge.y - pEdge.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            const curvature = Math.min(40, len * 0.15);
            const cx = mx + (-dy / len) * curvature;
            const cy = my + (dx / len) * curvature;

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', `M${pEdge.x},${pEdge.y} Q${cx},${cy} ${nEdge.x},${nEdge.y}`);
            path.setAttribute('stroke', BUBBLE_COLORS[node.colorIdx % BUBBLE_COLORS.length].border);
            path.setAttribute('opacity', '0.5');
            svgLayer.appendChild(path);
        });
    }

    function edgePoint(rx, ry, rw, rh, tx, ty) {
        const cx = rx + rw / 2;
        const cy = ry + rh / 2;
        const dx = tx - cx;
        const dy = ty - cy;
        const angle = Math.atan2(dy, dx);
        const hw = rw / 2 + 4;
        const hh = rh / 2 + 4;

        let ex, ey;
        const tanA = Math.abs(dy / (dx || 0.001));
        if (tanA < hh / hw) {
            ex = cx + Math.sign(dx) * hw;
            ey = cy + Math.sign(dx) * hw * (dy / (dx || 0.001));
        } else {
            ey = cy + Math.sign(dy) * hh;
            ex = cx + Math.sign(dy) * hh * (dx / (dy || 0.001));
        }
        return { x: ex, y: ey };
    }

    /* ── Toolbar Events ───────────────────── */

    /* Add bubble */
    addBtn.addEventListener('click', () => {
        if (selectedId !== null) addChild(selectedId);
    });

    /* Delete bubble */
    deleteBtn.addEventListener('click', () => {
        if (selectedId !== null && !nodes.get(selectedId)?.isRoot) {
            removeNodeRecursive(selectedId);
            updateConnections();
            mapDirty = true;
        }
    });

    /* Text size */
    toolbar.querySelectorAll('.cm-sz-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            toolbar.querySelectorAll('.cm-sz-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const size = btn.dataset.size === 'medium' ? '1.05rem' : '0.85rem';
            const sel = window.getSelection();
            if (!sel || !sel.rangeCount) return;

            if (!sel.isCollapsed) {
                /* Text is selected → wrap it via execCommand then fix the <font> tag */
                document.execCommand('fontSize', false, '4');
                const editable = sel.anchorNode?.parentElement?.closest?.('[contenteditable]')
                    || sel.focusNode?.parentElement?.closest?.('[contenteditable]');
                if (editable) {
                    editable.querySelectorAll('font[size]').forEach(font => {
                        const span = document.createElement('span');
                        span.style.fontSize = size;
                        span.innerHTML = font.innerHTML;
                        font.replaceWith(span);
                    });
                }
            } else {
                /* Cursor collapsed → insert a styled span so NEXT typed text gets the size */
                const range = sel.getRangeAt(0);
                const span = document.createElement('span');
                span.style.fontSize = size;
                span.appendChild(document.createTextNode('\u200B')); /* zero-width space */
                range.insertNode(span);
                /* move cursor inside the span, after the ZWS */
                range.setStart(span.firstChild, 1);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
            }
        });
    });

    /* Bold / Italic / Underline */
    toolbar.querySelectorAll('.cm-fmt-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.execCommand(btn.dataset.cmd);
        });
    });

    /* Text color dropdown */
    colorTrigger?.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDropdown(colorDropdown);
    });
    colorDropdown?.querySelectorAll('.cm-color-item').forEach(item => {
        item.addEventListener('click', () => {
            const c = item.dataset.color;
            currentTextColor = c;
            document.execCommand('foreColor', false, c);
            if (swatchColor) swatchColor.style.background = c;
            closeAllDropdowns();
        });
    });

    /* Background theme dropdown */
    bgTrigger?.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDropdown(bgDropdown);
    });
    bgDropdown?.querySelectorAll('.cm-bg-item').forEach(item => {
        item.addEventListener('click', () => {
            const bg = item.dataset.bg;
            canvasWrap.dataset.theme = bg;
            if (swatchBg) {
                const colors = { sobre: '#c8c8c8', blocnote: '#f5e6b8', rose: '#f4b8c8', vert: '#b8dfc0', bleu: '#b0d4f1' };
                swatchBg.style.background = colors[bg] || '#c8c8c8';
            }
            closeAllDropdowns();
            mapDirty = true;
        });
    });

    /* Bubble color dropdown */
    bcolorTrigger?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (bcolorTrigger.disabled) return;
        toggleDropdown(bcolorDropdown);
    });

    function setBubbleColor(idx) {
        if (selectedId === null) return;
        const node = nodes.get(selectedId);
        if (!node) return;
        const c = BUBBLE_COLORS[idx % BUBBLE_COLORS.length];
        node.colorIdx = idx;
        node.el.style.setProperty('--nbg', c.bg);
        node.el.style.setProperty('--nbdr', c.border);
        updateConnections();
        closeAllDropdowns();
        mapDirty = true;
    }

    /* Dropdown helpers */
    function toggleDropdown(dd) {
        const wasOpen = dd.classList.contains('open');
        closeAllDropdowns();
        if (!wasOpen) dd.classList.add('open');
    }

    function closeAllDropdowns() {
        page.querySelectorAll('.cm-dropdown.open').forEach(d => d.classList.remove('open'));
    }

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.cm-dropdown-wrap')) closeAllDropdowns();
    });

    /* Apply current text color on input */
    canvas.addEventListener('input', () => {
        if (currentTextColor && currentTextColor !== '#222') {
            document.execCommand('foreColor', false, currentTextColor);
        }
    });

    /* ══════════════════════════════════════════════════════════
       SERIALIZATION — convert nodes Map ↔ JSON
       ══════════════════════════════════════════════════════════ */
    function serializeMap() {
        const arr = [];
        nodes.forEach((n, id) => {
            arr.push({
                id,
                parentId: n.parentId,
                depth: n.depth,
                colorIdx: n.colorIdx,
                x: parseInt(n.el.style.left) || 0,
                y: parseInt(n.el.style.top) || 0,
                isRoot: !!n.isRoot,
                html: n.el.querySelector('.cm-node-text')?.innerHTML || '',
                childIds: [...n.childIds]
            });
        });
        return JSON.stringify({ theme: canvasWrap.dataset.theme || 'sobre', nodes: arr });
    }

    function deserializeMap(json) {
        const data = JSON.parse(json);
        /* clear current */
        nodes.clear();
        canvas.innerHTML = '';
        svgLayer.innerHTML = '';
        nextId = 1;
        selectedId = null;
        updateToolbarState();

        canvasWrap.dataset.theme = data.theme || 'sobre';
        const colors = { sobre: '#c8c8c8', blocnote: '#f5e6b8', rose: '#f4b8c8', vert: '#b8dfc0', bleu: '#b0d4f1' };
        if (swatchBg) swatchBg.style.background = colors[data.theme] || '#c8c8c8';

        /* recreate all nodes */
        data.nodes.forEach(n => {
            createNode({ id: n.id, parentId: n.parentId, depth: n.depth, colorIdx: n.colorIdx, x: n.x, y: n.y, isRoot: n.isRoot });
            const textEl = nodes.get(n.id)?.el?.querySelector('.cm-node-text');
            if (textEl) textEl.innerHTML = n.html;
            if (n.id >= nextId) nextId = n.id + 1;
        });
        /* rebuild childIds from parentId */
        nodes.forEach(n => { n.childIds = []; });
        nodes.forEach((n, id) => {
            if (n.parentId !== null && nodes.has(n.parentId)) {
                nodes.get(n.parentId).childIds.push(id);
            }
        });
        /* defer updateConnections so DOM has rendered and offsetWidth/Height are available */
        requestAnimationFrame(() => {
            /* expand canvas to fit all nodes */
            nodes.forEach(n => expandCanvas(n.x, n.y, n.el));
            updateConnections();
        });
    }

    /* ══════════════════════════════════════════════════════════
       EXPORT / DOWNLOAD PANEL
       ══════════════════════════════════════════════════════════ */
    let currentCarteId = null;
    let mapDirty = false;

    const dlOverlay  = page.querySelector('.cm-dl-overlay');
    const dlPanel    = page.querySelector('.cm-dl-panel');
    const dlPreview  = page.querySelector('.cm-dl-preview');
    const dlClose    = page.querySelector('.cm-dl-close');
    const dlBtn      = page.querySelector('.cm-download-btn');
    const saveForm   = page.querySelector('.cm-save-form');

    function loadLib(url) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${url}"]`)) return resolve();
            const s = document.createElement('script');
            s.src = url;
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }

    function openDownloadPanel() {
        if (!dlOverlay) return;
        deselectAll();
        /* capture canvas as image for preview */
        const h2c = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        loadLib(h2c).then(() => {
            html2canvas(canvasWrap, { scale: 2, useCORS: true, backgroundColor: null }).then(c => {
                dlPreview.innerHTML = '';
                const img = document.createElement('img');
                img.src = c.toDataURL('image/png');
                dlPreview.appendChild(img);
            });
        });
        /* pre-fill save form if editing */
        if (currentCarteId) {
            const nameEl = page.querySelector('#cm-save-name');
            /* fields may already have values from last open */
            if (nameEl && !nameEl.value) nameEl.value = '';
        }
        saveForm.style.display = 'none';
        dlOverlay.style.display = 'flex';
    }

    dlBtn?.addEventListener('click', openDownloadPanel);
    dlClose?.addEventListener('click', () => { dlOverlay.style.display = 'none'; });
    dlOverlay?.addEventListener('click', (e) => { if (e.target === dlOverlay) dlOverlay.style.display = 'none'; });

    /* Ctrl+S → open download panel */
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's' && editorView.style.display !== 'none') {
            e.preventDefault();
            openDownloadPanel();
        }
    });

    /* Action buttons */
    dlPanel?.addEventListener('click', async (e) => {
        const action = e.target.closest('[data-action]')?.dataset?.action;
        if (!action) return;

        const username = localStorage.getItem('source_username');

        if (action === 'alphasource') {
            saveForm.style.display = saveForm.style.display === 'none' ? 'flex' : 'none';
            return;
        }

        if (action === 'save-confirm') {
            const name = page.querySelector('#cm-save-name')?.value?.trim();
            const desc = page.querySelector('#cm-save-desc')?.value?.trim() || '';
            const matiere = page.querySelector('#cm-save-matiere')?.value || '';
            if (!name) { alert('Donne un nom à ta carte.'); return; }
            if (!username) { alert('Tu dois être connecté.'); return; }
            try {
                const body = { username, name, description: desc, matiere, content: serializeMap() };
                if (currentCarteId) body.id = currentCarteId;
                const res = await fetch('/api/cartes/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                const data = await res.json();
                if (data.success) {
                    currentCarteId = data.id;
                    mapDirty = false;
                    alert('Carte enregistrée !');
                    dlOverlay.style.display = 'none';
                } else {
                    alert(data.error || 'Erreur lors de la sauvegarde.');
                }
            } catch { alert('Erreur réseau.'); }
            return;
        }

        if (action === 'png') {
            const h2c = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
            await loadLib(h2c);
            const c = await html2canvas(canvasWrap, { scale: 2, useCORS: true, backgroundColor: null });
            const link = document.createElement('a');
            link.download = 'carte-mentale.png';
            link.href = c.toDataURL('image/png');
            link.click();
            return;
        }

        if (action === 'pdf') {
            const h2c = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
            const jpdf = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            await loadLib(h2c);
            await loadLib(jpdf);
            const c = await html2canvas(canvasWrap, { scale: 2, useCORS: true, backgroundColor: null });
            const imgData = c.toDataURL('image/png');
            const { jsPDF } = window.jspdf;
            const pxToMm = 0.264583;
            const w = c.width * pxToMm;
            const h = c.height * pxToMm;
            const pdf = new jsPDF({ orientation: w > h ? 'l' : 'p', unit: 'mm', format: [w, h] });
            pdf.addImage(imgData, 'PNG', 0, 0, w, h);
            pdf.save('carte-mentale.pdf');
            return;
        }
    });

    /* ══════════════════════════════════════════════════════════
       LIST VIEW — "Mes cartes"
       ══════════════════════════════════════════════════════════ */
    const listView   = page.querySelector('.cm-list-view');
    const listGrid   = page.querySelector('.cm-list-grid');
    const listEmpty  = page.querySelector('.cm-list-empty');
    const listSearch = page.querySelector('.cm-list-search-input');
    const listFilter = page.querySelector('.cm-list-matiere-filter');
    const listBtn    = page.querySelector('.cm-btn-list');

    function showListView() {
        homeView.style.display = 'none';
        editorView.style.display = 'none';
        listView.style.display = 'flex';
        loadCartes();
    }

    listBtn?.addEventListener('click', showListView);

    /* Search + filter */
    let searchTimer = null;
    listSearch?.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(loadCartes, 300);
    });
    listFilter?.addEventListener('change', loadCartes);

    async function loadCartes() {
        const username = localStorage.getItem('source_username');
        if (!username) { renderCartes([]); return; }
        const params = new URLSearchParams({ username });
        const q = listSearch?.value?.trim();
        if (q) params.set('q', q);
        const mat = listFilter?.value;
        if (mat) params.set('matiere', mat);
        try {
            const res = await fetch('/api/cartes/list?' + params);
            const data = await res.json();
            if (data.success) renderCartes(data.cartes);
            else renderCartes([]);
        } catch { renderCartes([]); }
    }

    function renderCartes(cartes) {
        listGrid.innerHTML = '';
        if (!cartes.length) {
            listGrid.style.display = 'none';
            listEmpty.style.display = 'flex';
            return;
        }
        listEmpty.style.display = 'none';
        listGrid.style.display = '';

        const THEME_BG = { sobre: '#e0e0e0', blocnote: '#f5e6b8', rose: '#f4b8c8', vert: '#b8dfc0', bleu: '#b0d4f1' };

        cartes.forEach(c => {
            const card = document.createElement('div');
            card.className = 'cm-list-card';
            const dateStr = c.updated_at ? new Date(c.updated_at).toLocaleDateString('fr-FR') : '';
            const preview = cartePreviewSvg(c.content, THEME_BG);
            card.innerHTML = `
                ${preview.svg ? `<div class="cm-list-card-preview" style="background:${preview.bg}">${preview.svg}</div>` : ''}
                <div class="cm-list-card-name">${escapeHtml(c.name)}</div>
                ${c.description ? `<div class="cm-list-card-desc">${escapeHtml(c.description)}</div>` : ''}
                <div class="cm-list-card-meta">
                    ${c.matiere ? `<span class="cm-list-card-matiere">${escapeHtml(c.matiere)}</span>` : '<span></span>'}
                    <span>${dateStr}</span>
                </div>
                <div class="cm-list-card-actions">
                    <button class="cm-list-card-btn cm-list-open">Ouvrir</button>
                    <button class="cm-list-card-btn cm-list-delete">Suppr.</button>
                </div>`;
            card.querySelector('.cm-list-open').addEventListener('click', (e) => { e.stopPropagation(); openCarte(c.id); });
            card.querySelector('.cm-list-delete').addEventListener('click', (e) => { e.stopPropagation(); deleteCarte(c.id); });
            card.addEventListener('click', () => openCarte(c.id));
            listGrid.appendChild(card);
        });
    }

    /* Build a mini SVG preview from a carte's serialized content */
    function cartePreviewSvg(contentStr, THEME_BG) {
        const fallback = { svg: '', bg: '#e0e0e0' };
        if (!contentStr) return fallback;
        try {
            const data = JSON.parse(contentStr);
            const nodeList = data.nodes;
            if (!nodeList || !nodeList.length) return fallback;
            const bg = THEME_BG[data.theme] || '#e0e0e0';

            /* find bounding box of all nodes */
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            nodeList.forEach(n => {
                const w = n.isRoot ? 140 : 100;
                const h = n.isRoot ? 50 : 34;
                if (n.x < minX) minX = n.x;
                if (n.y < minY) minY = n.y;
                if (n.x + w > maxX) maxX = n.x + w;
                if (n.y + h > maxY) maxY = n.y + h;
            });
            const pad = 20;
            minX -= pad; minY -= pad; maxX += pad; maxY += pad;
            const vw = maxX - minX;
            const vh = maxY - minY;

            /* build node lookup */
            const nodeMap = {};
            nodeList.forEach(n => { nodeMap[n.id] = n; });

            let paths = '';
            let rects = '';

            nodeList.forEach(n => {
                const c = BUBBLE_COLORS[n.colorIdx % BUBBLE_COLORS.length];
                const w = n.isRoot ? 140 : 100;
                const h = n.isRoot ? 50 : 34;
                const rx = n.isRoot ? 14 : 10;
                const cx = n.x + w / 2 - minX;
                const cy = n.y + h / 2 - minY;

                /* connection line to parent */
                if (n.parentId !== null && nodeMap[n.parentId]) {
                    const p = nodeMap[n.parentId];
                    const pw = p.isRoot ? 140 : 100;
                    const ph = p.isRoot ? 50 : 34;
                    const px = p.x + pw / 2 - minX;
                    const py = p.y + ph / 2 - minY;
                    const mx = (px + cx) / 2;
                    paths += `<path d="M${px},${py} C${mx},${py} ${mx},${cy} ${cx},${cy}" fill="none" stroke="${c.border}" stroke-width="2" opacity="0.6"/>`;
                }

                /* bubble rect */
                rects += `<rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="${rx}" fill="${c.bg}" stroke="${c.border}" stroke-width="${n.isRoot ? 3 : 1.5}"/>`;

                /* tiny text label — just a short line */
                const label = stripHtml(n.html).slice(0, 12);
                if (label) {
                    const fs = n.isRoot ? 10 : 7;
                    rects += `<text x="${cx}" y="${cy + fs * 0.35}" text-anchor="middle" font-size="${fs}" font-weight="${n.isRoot ? 700 : 400}" fill="#333" font-family="system-ui,sans-serif">${escapeHtml(label)}</text>`;
                }
            });

            const svg = `<svg viewBox="0 0 ${vw} ${vh}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">${paths}${rects}</svg>`;
            return { svg, bg };
        } catch { return fallback; }
    }

    function stripHtml(html) {
        const d = document.createElement('div');
        d.innerHTML = html || '';
        return d.textContent?.trim() || '';
    }

    function escapeHtml(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    async function openCarte(id) {
        const username = localStorage.getItem('source_username');
        if (!username) return;
        try {
            const res = await fetch('/api/cartes/get?' + new URLSearchParams({ id, username }));
            const data = await res.json();
            if (!data.success) { alert(data.error || 'Erreur'); return; }
            currentCarteId = data.carte.id;
            deserializeMap(data.carte.content);
            /* pre-fill save form fields */
            const nameEl = page.querySelector('#cm-save-name');
            const descEl = page.querySelector('#cm-save-desc');
            const matEl  = page.querySelector('#cm-save-matiere');
            if (nameEl) nameEl.value = data.carte.name || '';
            if (descEl) descEl.value = data.carte.description || '';
            if (matEl)  matEl.value  = data.carte.matiere || '';
            /* switch to editor */
            listView.style.display = 'none';
            homeView.style.display = 'none';
            editorView.style.display = 'flex';
            mapDirty = false;
            const dlb = page.querySelector('.cm-download-btn');
            if (dlb) dlb.style.display = 'flex';
        } catch { alert('Erreur réseau.'); }
    }

    async function deleteCarte(id) {
        if (!confirm('Supprimer cette carte ?')) return;
        const username = localStorage.getItem('source_username');
        if (!username) return;
        try {
            await fetch('/api/cartes/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, username })
            });
            loadCartes();
        } catch { alert('Erreur réseau.'); }
    }

    /* ── Reset currentCarteId on new map ── */
    const origCreateClick = createBtn?.onclick;
    createBtn?.addEventListener('click', () => {
        currentCarteId = null;
        const nameEl = page.querySelector('#cm-save-name');
        const descEl = page.querySelector('#cm-save-desc');
        const matEl  = page.querySelector('#cm-save-matiere');
        if (nameEl) nameEl.value = '';
        if (descEl) descEl.value = '';
        if (matEl)  matEl.value  = '';
    });

    /* ══════════════════════════════════════════════════════════
       AI GENERATION
       ══════════════════════════════════════════════════════════ */
    if (aiView) {
        let aiImages = [];
        const aiImgGrid     = aiView.querySelector('.cmai-images-grid');
        const aiAddBtn      = aiView.querySelector('.cmai-add-btn');
        const aiSourceOvl   = aiView.querySelector('.cmai-source-overlay');
        const aiSourceClose = aiView.querySelector('.cmai-source-close');
        const aiSrcPhone    = aiView.querySelector('.cmai-src-phone');
        const aiSrcAlpha    = aiView.querySelector('.cmai-src-alpha');
        const aiCoursesList = aiView.querySelector('.cmai-courses-list');
        const aiCoursesLoad = aiView.querySelector('.cmai-courses-loading');
        const aiCoursesGrid = aiView.querySelector('.cmai-courses-grid');
        const aiInstructions = aiView.querySelector('.cmai-instructions');
        const aiGenerateBtn = aiView.querySelector('.cmai-generate-btn');
        const aiLoadingOvl  = aiView.querySelector('.cmai-loading-overlay');
        const aiLoadingSub  = aiView.querySelector('.cmai-loading-sub');
        const aiFileInput   = aiView.querySelector('.cmai-file-input');

        function updateGenerateBtn() {
            if (aiGenerateBtn) aiGenerateBtn.disabled = aiImages.length === 0;
        }

        function renderAiThumbs() {
            aiImgGrid.innerHTML = '';
            aiImages.forEach((img, i) => {
                const div = document.createElement('div');
                div.className = 'cmai-img-thumb';
                div.innerHTML = `<img src="${img.preview}"><button class="cmai-img-remove" data-idx="${i}">&times;</button>`;
                aiImgGrid.appendChild(div);
            });
            updateGenerateBtn();
        }

        aiImgGrid.addEventListener('click', (e) => {
            const btn = e.target.closest('.cmai-img-remove');
            if (!btn) return;
            const idx = parseInt(btn.dataset.idx, 10);
            aiImages.splice(idx, 1);
            renderAiThumbs();
        });

        /* Add button → source picker */
        aiAddBtn.addEventListener('click', () => {
            aiSourceOvl.style.display = 'flex';
            aiCoursesList.style.display = 'none';
        });

        aiSourceClose.addEventListener('click', () => { aiSourceOvl.style.display = 'none'; });
        aiSourceOvl.addEventListener('click', (e) => { if (e.target === aiSourceOvl) aiSourceOvl.style.display = 'none'; });

        /* From device */
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

        /* From AlphaSource courses */
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
                    aiCoursesGrid.innerHTML = '<div class="cmai-courses-loading">Aucun cours disponible</div>';
                    return;
                }

                const imgExts = ['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif'];
                const imgCourses = courses.filter(c => {
                    const ext = (c.filePath || '').split('.').pop().toLowerCase();
                    return imgExts.includes('.' + ext);
                });

                if (!imgCourses.length) {
                    aiCoursesGrid.innerHTML = '<div class="cmai-courses-loading">Aucun cours image trouvé</div>';
                    return;
                }

                imgCourses.forEach(c => {
                    const item = document.createElement('div');
                    item.className = 'cmai-course-item';
                    item.innerHTML = `
                        <img class="cmai-course-thumb" src="${c.filePath}" alt="">
                        <div class="cmai-course-info">
                            <div class="cmai-course-name">${escapeHtml(c.title || 'Sans titre')}</div>
                            <div class="cmai-course-sub">${escapeHtml(c.subject || '')} · ${escapeHtml(c.uploaderName || '')}</div>
                        </div>`;
                    item.addEventListener('click', async () => {
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
                aiCoursesGrid.innerHTML = '<div class="cmai-courses-loading">Erreur de chargement</div>';
            }
        });

        /* Generate! */
        aiGenerateBtn.addEventListener('click', async () => {
            if (!aiImages.length) return;
            aiLoadingOvl.style.display = 'flex';
            aiLoadingSub.textContent = 'Analyse des images en cours';

            try {
                const username = localStorage.getItem('source_username');
                const instructions = aiInstructions.value.trim();

                const res = await fetch('/api/cartes/generate', {
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

                /* Load generated map into editor */
                currentCarteId = null;
                deserializeMap(data.content);

                /* Switch to editor */
                aiView.style.display = 'none';
                editorView.style.display = 'flex';
                const dlb = page.querySelector('.cm-download-btn');
                if (dlb) dlb.style.display = 'flex';
                mapDirty = true;

                /* Clear AI state */
                aiImages = [];
                renderAiThumbs();
                aiInstructions.value = '';

            } catch (e) {
                console.error('AI generation failed:', e);
                aiLoadingOvl.style.display = 'none';
                alert('Erreur réseau lors de la génération');
            }
        });
    }

})();
