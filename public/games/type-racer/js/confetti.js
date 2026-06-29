/* Canvas confetti system */
class ConfettiSystem {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.particles = [];
    this.running = false;
    this.rafId = null;
  }

  launch(duration = 4500) {
    if (!this.canvas || !this.ctx) return;
    this.canvas.style.display = 'block';
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.particles = [];

    const colors = ['#FF416C', '#FCD34D', '#10B981', '#A78BFA', '#F59E0B', '#3B82F6', '#EC4899', '#14B8A6'];
    const shapes = ['rect', 'circle', 'triangle'];

    for (let i = 0; i < 180; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: this.canvas.height + Math.random() * 200,
        vx: (Math.random() - 0.5) * 10,
        vy: -(Math.random() * 18 + 8),
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 12 + 5,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 12,
        shape: shapes[Math.floor(Math.random() * shapes.length)],
        gravity: 0.35,
        drag: 0.985,
        alpha: 1,
      });
    }

    this.running = true;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this._animate();

    setTimeout(() => this.stop(), duration);
  }

  stop() {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.canvas) this.canvas.style.display = 'none';
    this.particles = [];
  }

  _animate() {
    if (!this.running) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.particles.forEach(p => {
      p.vy += p.gravity;
      p.vx *= p.drag;
      p.x  += p.vx;
      p.y  += p.vy;
      p.rotation += p.rotationSpeed;
      p.alpha = Math.max(0, 1 - Math.max(0, p.y - this.canvas.height * 0.7) / (this.canvas.height * 0.3));

      this.ctx.save();
      this.ctx.globalAlpha = p.alpha;
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate(p.rotation * Math.PI / 180);
      this.ctx.fillStyle = p.color;

      if (p.shape === 'rect') {
        this.ctx.fillRect(-p.size / 2, -p.size * 0.3, p.size, p.size * 0.6);
      } else if (p.shape === 'circle') {
        this.ctx.beginPath();
        this.ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        this.ctx.fill();
      } else {
        this.ctx.beginPath();
        this.ctx.moveTo(0, -p.size / 2);
        this.ctx.lineTo(p.size / 2, p.size / 2);
        this.ctx.lineTo(-p.size / 2, p.size / 2);
        this.ctx.closePath();
        this.ctx.fill();
      }
      this.ctx.restore();
    });

    this.rafId = requestAnimationFrame(() => this._animate());
  }
}

/* Star burst: GSAP emoji particles at a point */
function starBurst(x, y, count = 6) {
  const stars = ['⭐', '✨', '💫', '🌟', '⚡', '🎉'];
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'star-particle';
    el.textContent = stars[i % stars.length];
    el.style.left = x + 'px';
    el.style.top  = y + 'px';
    document.body.appendChild(el);

    const angle    = (i / count) * 360;
    const distance = 50 + Math.random() * 40;
    gsap.fromTo(el,
      { scale: 1.2, opacity: 1, x: 0, y: 0 },
      {
        x: Math.cos(angle * Math.PI / 180) * distance,
        y: Math.sin(angle * Math.PI / 180) * distance,
        scale: 0,
        opacity: 0,
        duration: 0.7,
        ease: 'power2.out',
        onComplete: () => el.remove(),
      }
    );
  }
}
