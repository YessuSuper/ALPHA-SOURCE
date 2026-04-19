// Présentations — Floating squares and rectangles
(function () {
    const canvas = document.getElementById('slides-canvas');
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
        'rgba(255,190,80,0.12)',
        'rgba(255,160,40,0.10)',
        'rgba(255,210,120,0.08)',
        'rgba(245,158,11,0.14)',
    ];

    class Slide {
        constructor() { this.reset(); }
        reset() {
            this.w = 40 + Math.random() * 100;
            this.h = 30 + Math.random() * 70;
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.vx = (Math.random() - 0.5) * 0.3;
            this.vy = (Math.random() - 0.5) * 0.3;
            this.rotation = Math.random() * Math.PI * 2;
            this.vr = (Math.random() - 0.5) * 0.003;
            this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
            this.borderColor = this.color.replace(/[\d.]+\)$/, (m) => (parseFloat(m) * 2.5) + ')');
            this.radius = 4 + Math.random() * 6;
        }
        update() {
            this.x += this.vx;
            this.y += this.vy;
            this.rotation += this.vr;

            // Wrap around
            if (this.x < -this.w) this.x = canvas.width + this.w;
            if (this.x > canvas.width + this.w) this.x = -this.w;
            if (this.y < -this.h) this.y = canvas.height + this.h;
            if (this.y > canvas.height + this.h) this.y = -this.h;
        }
        draw() {
            ctx.save();
            ctx.translate(this.x + this.w / 2, this.y + this.h / 2);
            ctx.rotate(this.rotation);
            ctx.fillStyle = this.color;
            ctx.strokeStyle = this.borderColor;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(-this.w / 2, -this.h / 2, this.w, this.h, this.radius);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }
    }

    const slides = [];
    const COUNT = 25;
    for (let i = 0; i < COUNT; i++) slides.push(new Slide());

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (const s of slides) { s.update(); s.draw(); }
        animId = requestAnimationFrame(animate);
    }
    animate();

    window.__presentationsCleanup = () => {
        cancelAnimationFrame(animId);
        window.removeEventListener('resize', resize);
    };
})();
