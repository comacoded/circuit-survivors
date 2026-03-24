import { CONFIG, STATES } from '../core/config.js';
import { eventBus } from '../core/eventBus.js';

const POOL_SIZE = 200;
const TWO_PI = Math.PI * 2;

class FxParticle {
  constructor() {
    this.active = false;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.life = 0;
    this.maxLife = 0;
    this.color = '#fff';
    this.size = 2;
    this.type = 'rect'; // 'rect' | 'text' | 'streak'
    this.text = '';
    this.font = '9px monospace';
  }

  initRect(x, y, vx, vy, life, color, size) {
    this.active = true;
    this.type = 'rect';
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.life = life;
    this.maxLife = life;
    this.color = color;
    this.size = size;
  }

  initText(x, y, text, color, font) {
    this.active = true;
    this.type = 'text';
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = -30; // float upward
    this.life = 0.6;
    this.maxLife = 0.6;
    this.color = color;
    this.text = text;
    this.font = font || '9px monospace';
  }

  initStreak(x, vy, life, color) {
    this.active = true;
    this.type = 'streak';
    this.x = x;
    this.y = CONFIG.CANVAS_HEIGHT;
    this.vx = 0;
    this.vy = vy;
    this.life = life;
    this.maxLife = life;
    this.color = color;
    this.size = 1 + Math.random() * 2;
  }

  update(dt) {
    if (!this.active) return;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0) this.active = false;
  }

  render(ctx) {
    if (!this.active) return;
    const alpha = Math.max(0, this.life / this.maxLife);

    if (this.type === 'rect') {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = this.color;
      const half = this.size / 2;
      ctx.fillRect(
        Math.floor(this.x - half),
        Math.floor(this.y - half),
        Math.ceil(this.size),
        Math.ceil(this.size)
      );
      ctx.globalAlpha = 1;
    }

    if (this.type === 'text') {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = this.color;
      ctx.font = this.font;
      ctx.textAlign = 'center';
      ctx.fillText(this.text, Math.floor(this.x), Math.floor(this.y));
      ctx.globalAlpha = 1;
    }

    if (this.type === 'streak') {
      ctx.globalAlpha = alpha * 0.6;
      ctx.fillStyle = this.color;
      ctx.fillRect(Math.floor(this.x), Math.floor(this.y), this.size, 20 + Math.random() * 15);
      ctx.globalAlpha = 1;
    }
  }
}

export class ParticleSystem {
  constructor() {
    this.pool = [];
    for (let i = 0; i < POOL_SIZE; i++) {
      this.pool.push(new FxParticle());
    }

    // Screen shake
    this.shakeX = 0;
    this.shakeY = 0;
    this.shakeTimer = 0;
    this.shakeIntensity = 0;

    // Level-up flash
    this.levelFlashTimer = 0;

    // Listen for events
    eventBus.on('chipDamaged', () => this.triggerShake(3, 0.2));
    eventBus.on('xpCollected', (data) => {
      // data is the value number — we need position from somewhere
      // We'll handle this via a separate event with position
    });
    eventBus.on('xpCollectedAt', (data) => {
      this.spawnXpText(data.x, data.y, data.value);
    });
    eventBus.on('resourceCollectedAt', (data) => {
      this.spawnResourceText(data.x, data.y, data.value);
    });
    eventBus.on('levelUp', () => this.triggerLevelUpFlash());
    eventBus.on('firewallPulseVisual', (data) => this.spawnPulseRing(data));

    // Pulse rings (expanding circles)
    this.pulseRings = [];

    // DDoS swarm alert
    this.ddosAlertTimer = 0;
    this.ddosAlertDuration = 3.0;
    this.ddosAlertCount = 0;

    eventBus.on('ddosSwarmStart', (data) => {
      this.ddosAlertTimer = this.ddosAlertDuration;
      this.ddosAlertCount = data.count;
      this.triggerShake(6, 0.5);
    });

    // Threat escalation alert (every 5 levels)
    this.threatAlertTimer = 0;
    this.threatAlertDuration = 3.5;
    this.threatMilestone = 0;

    eventBus.on('threatEscalation', (data) => {
      this.threatAlertTimer = this.threatAlertDuration;
      this.threatMilestone = data.milestone;
      this.triggerShake(4, 0.6);
    });
  }

  get() {
    for (let i = 0; i < this.pool.length; i++) {
      if (!this.pool[i].active) return this.pool[i];
    }
    const p = new FxParticle();
    this.pool.push(p);
    return p;
  }

  triggerShake(intensity, duration) {
    this.shakeIntensity = intensity;
    this.shakeTimer = duration;
  }

  triggerLevelUpFlash() {
    this.levelFlashTimer = 0.3;

    // Spawn ascending light streaks
    for (let i = 0; i < 8; i++) {
      const p = this.get();
      const x = 30 + Math.random() * (CONFIG.CANVAS_WIDTH - 60);
      p.initStreak(x, -(300 + Math.random() * 400), 0.5 + Math.random() * 0.3, '#ffffff');
    }
  }

  spawnXpText(x, y, value) {
    const p = this.get();
    p.initText(x, y, `+${value}`, '#00e5a0', 'bold 9px monospace');
  }

  spawnResourceText(x, y, value) {
    const p = this.get();
    p.initText(x, y - 8, `+${value}`, '#ffd700', 'bold 9px monospace');
  }

  spawnPulseRing(data) {
    this.pulseRings.push({
      x: data.x,
      y: data.y,
      maxRadius: data.radius,
      timer: 0,
      duration: 0.3,
    });
  }

  update(dt, state) {
    // Update shake
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      const t = this.shakeTimer / 0.2;
      this.shakeX = (Math.random() - 0.5) * 2 * this.shakeIntensity * t;
      this.shakeY = (Math.random() - 0.5) * 2 * this.shakeIntensity * t;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }

    // Level-up flash decay
    if (this.levelFlashTimer > 0) {
      this.levelFlashTimer -= dt;
    }

    // DDoS alert decay
    if (this.ddosAlertTimer > 0) {
      this.ddosAlertTimer -= dt;
    }

    // Threat escalation alert decay
    if (this.threatAlertTimer > 0) {
      this.threatAlertTimer -= dt;
    }

    // Update particles
    for (let i = 0; i < this.pool.length; i++) {
      if (this.pool[i].active) this.pool[i].update(dt);
    }

    // Update pulse rings
    for (let i = this.pulseRings.length - 1; i >= 0; i--) {
      this.pulseRings[i].timer += dt;
      if (this.pulseRings[i].timer >= this.pulseRings[i].duration) {
        this.pulseRings.splice(i, 1);
      }
    }
  }

  render(ctx, state) {
    // Particles
    for (let i = 0; i < this.pool.length; i++) {
      if (this.pool[i].active) this.pool[i].render(ctx);
    }

    // Pulse rings
    for (const ring of this.pulseRings) {
      const progress = ring.timer / ring.duration;
      const radius = ring.maxRadius * progress;
      const alpha = (1 - progress) * 0.5;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0, 229, 160, ${alpha})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Level-up white flash overlay
    if (this.levelFlashTimer > 0) {
      const alpha = (this.levelFlashTimer / 0.3) * 0.3;
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
    }

    // DDoS Swarm alert overlay
    if (this.ddosAlertTimer > 0) {
      const W = CONFIG.CANVAS_WIDTH;
      const H = CONFIG.CANVAS_HEIGHT;
      const t = this.ddosAlertTimer;
      const progress = 1 - t / this.ddosAlertDuration;

      // Pulsing red edge vignette (strongest in first second)
      const edgeAlpha = Math.min(1, t / 1.5) * (0.15 + 0.1 * Math.sin(t * 12));
      const grad = ctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, H * 0.65);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, `rgba(255, 50, 50, ${edgeAlpha})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // Pulsing "DDoS SWARM!" text (visible for full duration, pulses hard)
      const textAlpha = Math.min(1, t / 0.5) * (0.6 + 0.4 * Math.sin(t * 8));
      const scale = 1 + Math.sin(t * 10) * 0.08;

      ctx.save();
      ctx.translate(W / 2, 75);
      ctx.scale(scale, scale);

      // Glow shadow
      ctx.shadowColor = '#ff3355';
      ctx.shadowBlur = 15 + Math.sin(t * 12) * 8;

      // Warning text
      ctx.globalAlpha = textAlpha;
      ctx.fillStyle = '#ff3355';
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('DDoS SWARM!', 0, 0);

      ctx.shadowBlur = 0;

      // Subtext with count (fades in)
      if (progress > 0.1) {
        ctx.fillStyle = '#ffaa33';
        ctx.font = '10px monospace';
        ctx.globalAlpha = textAlpha * 0.7;
        ctx.fillText(`${this.ddosAlertCount} incoming`, 0, 18);
      }

      ctx.restore();
      ctx.globalAlpha = 1;
    }

    // Threat escalation alert
    if (this.threatAlertTimer > 0) {
      const W = CONFIG.CANVAS_WIDTH;
      const H = CONFIG.CANVAS_HEIGHT;
      const t = this.threatAlertTimer;

      // Orange/red edge pulse
      const edgeAlpha = Math.min(1, t / 1.0) * (0.08 + 0.06 * Math.sin(t * 6));
      const grad = ctx.createRadialGradient(W / 2, H / 2, 80, W / 2, H / 2, H * 0.7);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, `rgba(255, 100, 20, ${edgeAlpha})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // "THREAT LEVEL INCREASED" text
      const textAlpha = Math.min(1, t / 0.4) * (0.5 + 0.5 * Math.sin(t * 5));
      const textScale = 1 + Math.sin(t * 7) * 0.05;

      ctx.save();
      ctx.translate(W / 2, H * 0.15);
      ctx.scale(textScale, textScale);
      ctx.globalAlpha = textAlpha;

      ctx.shadowColor = '#ff6622';
      ctx.shadowBlur = 12 + Math.sin(t * 8) * 6;

      ctx.fillStyle = '#ff6622';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('THREAT LEVEL INCREASED', 0, 0);

      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffaa44';
      ctx.font = '10px monospace';
      ctx.fillText(`ZONE EXPANDING \u2022 MORE HOSTILES`, 0, 18);

      // Milestone indicator
      ctx.fillStyle = '#ff4422';
      ctx.font = 'bold 18px monospace';
      ctx.globalAlpha = textAlpha * 0.6;
      const bars = '\u2588'.repeat(this.threatMilestone);
      ctx.fillText(bars, 0, 42);

      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  reset() {
    for (const p of this.pool) p.active = false;
    this.shakeTimer = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.levelFlashTimer = 0;
    this.pulseRings = [];
    this.ddosAlertTimer = 0;
    this.threatAlertTimer = 0;
  }
}
