import { CONFIG } from '../core/config.js';

export class Projectile {
  constructor() {
    this.active = false;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.speed = 0;
    this.damage = 0;
    this.size = 3;
    this.color = '#00e5a0';
    this.bouncesLeft = 0;
    this.bounceRange = 120;
    this.bounceDamageBonus = 0;
    this.hitEnemies = [];  // reused — cleared on init, never reallocated
    this.pierceCount = 0;
    this.originX = 0;
    this.originY = 0;
    this.maxRange = 0;  // 0 = no range limit
  }

  init(x, y, targetX, targetY, speed, damage, size, color) {
    this.active = true;
    this.x = x;
    this.y = y;
    this.originX = x;
    this.originY = y;
    this.maxRange = 0;
    this.damage = damage;
    this.speed = speed;
    this.size = size;
    this.color = color;
    this.bouncesLeft = 0;
    this.bounceDamageBonus = 0;
    this.pierceCount = 0;
    // Reuse array — clear without allocating
    this.hitEnemies.length = 0;

    const dx = targetX - x;
    const dy = targetY - y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0) {
      this.vx = (dx / dist) * speed;
      this.vy = (dy / dist) * speed;
    } else {
      this.vx = 0;
      this.vy = -speed;
    }
  }

  redirect(targetX, targetY) {
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0) {
      this.vx = (dx / dist) * this.speed;
      this.vy = (dy / dist) * this.speed;
    }
  }

  update(dt) {
    if (!this.active) return;

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Despawn if past max range
    if (this.maxRange > 0) {
      const dx = this.x - this.originX;
      const dy = this.y - this.originY;
      if (dx * dx + dy * dy > this.maxRange * this.maxRange) {
        this.active = false;
        return;
      }
    }

    // Despawn if off-screen
    if (
      this.x < -20 ||
      this.x > CONFIG.CANVAS_WIDTH + 20 ||
      this.y < -20 ||
      this.y > CONFIG.CANVAS_HEIGHT + 20
    ) {
      this.active = false;
    }
  }

  render(ctx) {
    if (!this.active) return;
    ctx.fillRect(
      (this.x - this.size * 0.5) | 0,
      (this.y - this.size * 0.5) | 0,
      this.size, this.size
    );
  }
}
