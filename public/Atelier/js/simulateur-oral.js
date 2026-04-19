// Simulateur d'Oral — Fullscreen equalizer bars (like the card background)
(function () {
    const canvas = document.getElementById('oral-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    const BAR_WIDTH = 10;
    const GAP = 6;
    const COLOR = [190, 140, 255];
    let time = 0;

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        time += 0.012;

        const totalBars = Math.ceil(canvas.width / (BAR_WIDTH + GAP)) + 2;
        const startX = (canvas.width - totalBars * (BAR_WIDTH + GAP)) / 2;
        const maxH = canvas.height * 0.85;
        const baseY = canvas.height;

        for (let i = 0; i < totalBars; i++) {
            const x = startX + i * (BAR_WIDTH + GAP);
            const n = i / totalBars;

            // Multiple sine waves — mimics the card's equalizer pulsing
            const s1 = Math.sin(n * 3.5 + time * 1.1) * 0.35;
            const s2 = Math.sin(n * 7.2 - time * 0.7) * 0.22;
            const s3 = Math.sin(n * 12.0 + time * 1.8) * 0.12;
            const s4 = Math.sin(n * 1.8 + time * 0.4) * 0.18;
            const s5 = Math.sin(n * 20.0 - time * 2.5) * 0.06;
            const raw = Math.abs(s1 + s2 + s3 + s4 + s5);

            // Scale: bars go from ~5% to ~85% of screen height
            const height = maxH * (0.05 + raw * 0.95);

            // Opacity: taller bars are more visible
            const opacity = 0.10 + raw * 0.22;

            // Main bar — rounded top, grows from bottom
            const rx = BAR_WIDTH / 2;
            ctx.fillStyle = `rgba(${COLOR[0]},${COLOR[1]},${COLOR[2]},${opacity})`;
            ctx.beginPath();
            ctx.roundRect(x, baseY - height, BAR_WIDTH, height, [rx, rx, 0, 0]);
            ctx.fill();

            // Soft glow behind
            ctx.fillStyle = `rgba(${COLOR[0]},${COLOR[1]},${COLOR[2]},${opacity * 0.25})`;
            ctx.beginPath();
            ctx.roundRect(x - 2, baseY - height - 3, BAR_WIDTH + 4, height + 3, [rx + 2, rx + 2, 0, 0]);
            ctx.fill();
        }

        animId = requestAnimationFrame(animate);
    }
    animate();

    window.__oralCleanup = () => {
        cancelAnimationFrame(animId);
        window.removeEventListener('resize', resize);
    };
})();
