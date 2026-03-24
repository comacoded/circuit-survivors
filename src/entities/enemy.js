import { CONFIG } from '../core/config.js';

const TWO_PI = Math.PI * 2;

// ── Base Enemy ──────────────────────────────────────────────
export class Enemy {
  constructor() {
    this.active = false;
    this.x = 0;
    this.y = 0;
    this.hp = 0;
    this.maxHp = 0;
    this.speed = 0;
    this.damage = 0;
    this.size = 0;
    this.color = '#ff0000';
    this.borderColor = '#aa0000';
    this.xpValue = 1;
    this.type = 'base';
    this.ignoresModules = false;

    // Module attack state
    this.attackingModule = null;
    this.attackTimer = 0;

    // Subtype-specific state
    this.age = 0;              // lifetime counter
    this.canSplit = false;     // worm splitting
    this.revealed = false;     // trojan reveal
    this.latchedModule = null;  // virus module drain
    this.lockedModules = [];    // ransomware locked modules
    this.isBoss = false;
    this.bossFireTimer = 0;
    this.bossAppearance = 0;   // logic bomb appearance count
    this.opacity = 1;
  }

  init(x, y) {
    this.x = x;
    this.y = y;
    this.active = true;
    this.attackingModule = null;
    this.attackTimer = 0;
    this.age = 0;
    this.canSplit = false;
    this.revealed = false;
    this.latchedModule = null;
    this.lockedModules.length = 0; // reuse array, no allocation
    this.isBoss = false;
    this.bossFireTimer = 0;
    this.opacity = 1;
  }

  takeDamage(amount) {
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.active = false;
    }
    return this.hp <= 0;
  }

  update(dt, chipX, chipY) {
    if (!this.active) return;
    this.age += dt;

    // If attacking a module, don't move
    if (this.attackingModule) {
      if (this.attackingModule.destroyed || this.attackingModule.integrity <= 0) {
        this.attackingModule = null;
        this.attackTimer = 0;
        return;
      }
      this.attackTimer += dt;
      if (this.attackTimer >= 1.0) {
        this.attackTimer -= 1.0;
        this.attackingModule.takeDamage(this.damage);
      }
      return;
    }

    // Move toward chip
    const dx = chipX - this.x;
    const dy = chipY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 0) {
      this.x += (dx / dist) * this.speed * dt;
      this.y += (dy / dist) * this.speed * dt;
    }
  }

  render(ctx) {
    if (!this.active) return;
    const half = this.size / 2;
    const px = Math.floor(this.x - half);
    const py = Math.floor(this.y - half);

    if (this.opacity < 1) ctx.globalAlpha = this.opacity;

    ctx.fillStyle = this.borderColor;
    ctx.fillRect(px - 1, py - 1, this.size + 2, this.size + 2);
    ctx.fillStyle = this.color;
    ctx.fillRect(px, py, this.size, this.size);

    if (this.opacity < 1) ctx.globalAlpha = 1;
  }

  hitsChip(chip) {
    if (!this.active) return false;
    const dx = this.x - chip.x;
    const dy = this.y - chip.y;
    const halfBody = chip.bodyW / 2;
    return Math.abs(dx) < halfBody + 4 && Math.abs(dy) < halfBody + 4;
  }
}

// ── Bit (red, basic) ────────────────────────────────────────
// Configured at spawn time by enemyManager

// ── Crawler (dark red, ignores modules) ─────────────────────
// Configured at spawn time, render has X marks

// ── Packet (orange, zigzag) ─────────────────────────────────
// Uses sinusoidal offset in update

// ── Worm (green, splits on death) ───────────────────────────
// canSplit flag checked in killEnemy

// ── Trojan (disguised as resource diamond) ──────────────────
// Starts stationary, reveals when in signal range

// ── Virus (magenta, latches to module) ──────────────────────
// latchedModule drains integrity

// ── DDoS Mini-Bit (yellow, tiny) ────────────────────────────
// Just a small fast Bit variant

// ── Rootkit (near-invisible) ────────────────────────────────
// opacity = 0.15, reveals near chip/modules

// ── Ransomware (gold/red, mini-boss, locks modules) ─────────
// Locks modules in radius when reaches board

// ── Logic Bomb (white, boss, ranged attacker) ───────────────
// Stops at range, fires projectiles

// All enemy types are configured via ENEMY_TYPES data below
// and applied at spawn time. Custom behaviors are in update/render
// overrides handled by type checks in enemyManager.

export const ENEMY_TYPES = {
  bit: {
    size: 6, color: '#ff3355', borderColor: '#aa1133',
    hp: 7, speed: 24, damage: 5, xpValue: 1,
  },
  crawler: {
    size: 8, color: '#882233', borderColor: '#551122',
    hp: 19, speed: 32, damage: 8, xpValue: 2,
    ignoresModules: true,
  },
  packet: {
    size: 7, color: '#ff8833', borderColor: '#aa5511',
    hp: 10, speed: 55, damage: 4, xpValue: 1,
  },
  worm: {
    size: 6, color: '#33cc55', borderColor: '#228833',
    hp: 15, speed: 32, damage: 3, xpValue: 1,
    canSplit: true,
  },
  wormlet: {
    size: 4, color: '#33cc55', borderColor: '#228833',
    hp: 8, speed: 35, damage: 2, xpValue: 1,
    canSplit: false,
  },
  trojan: {
    size: 7, color: '#ffd700', borderColor: '#aa8800',
    hp: 25, speed: 0, damage: 10, xpValue: 3,
  },
  virus: {
    size: 5, color: '#dd33dd', borderColor: '#991199',
    hp: 10, speed: 45, damage: 0, xpValue: 2,
  },
  ddos: {
    size: 3, color: '#ffdd33', borderColor: '#aa9922',
    hp: 4, speed: 50, damage: 1, xpValue: 0,
  },
  rootkit: {
    size: 6, color: '#1a1a2e', borderColor: '#111120',
    hp: 19, speed: 38, damage: 7, xpValue: 2,
    opacity: 0.15,
  },
  ransomware: {
    size: 12, color: '#ffaa33', borderColor: '#cc3333',
    hp: 100, speed: 25, damage: 0, xpValue: 5,
    isBoss: true,
  },
  logic_bomb: {
    size: 16, color: '#ffffff', borderColor: '#aaaacc',
    hp: 190, speed: 18, damage: 0, xpValue: 8,
    isBoss: true,
  },
};
