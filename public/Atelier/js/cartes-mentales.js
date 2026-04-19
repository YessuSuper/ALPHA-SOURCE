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
