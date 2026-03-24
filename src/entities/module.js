import { CONFIG } from '../core/config.js';

const TWO_PI = Math.PI * 2;
const ts = CONFIG.TILE_SIZE;

// ── Base Module ─────────────────────────────────────────────
export class Module {
  constructor(type, color, maxIntegrity, cost) {
    this.type = type;          // 'attack' | 'defense' | 'utility' | 'relay' | 'specialty'
    this.color = color;
    this.col = 0;
    this.row = 0;
    this.x = 0;               // pixel center (set by gridManager)
    this.y = 0;
    this.maxIntegrity = maxIntegrity;
    this.integrity = maxIntegrity;
    this.cost = cost;
    this.connected = true;
    this.damageFlashTimer = 0;
    this.destroyed = false;
    this.locked = false; // ransomware lockdown
  }

  get alive() {
    return !this.destroyed && this.integrity > 0;
  }

  takeDamage(amount) {
    if (this.destroyed) return;
    // Firewall Hardening: reduce incoming damage
    const reduced = this._firewallHardening
      ? amount * (1 - this._firewallHardening)
      : amount;
    this.integrity = Math.max(0, this.integrity - reduced);
    this.damageFlashTimer = 0.15;
    if (this.integrity <= 0) {
      this.destroyed = true;
    }
  }

  update(dt) {
    if (this.damageFlashTimer > 0) this.damageFlashTimer -= dt;
  }

  /** Top-left pixel of tile */
  get px() { return this.x - ts / 2; }
  get py() { return this.y - ts / 2; }

  render(ctx, isConnected) {
    const px = this.px;
    const py = this.py;
    const isFlashing = this.damageFlashTimer > 0;
    const hpPct = this.integrity / this.maxIntegrity;

    // Disconnected, locked, or low-hp dimming
    let baseColor = this.color;
    let alpha = 1;
    if (!isConnected || this.locked) {
      baseColor = '#333340';
      alpha = 0.5;
    }

    ctx.globalAlpha = alpha;

    // Body fill
    ctx.fillStyle = isFlashing ? '#ffffff' : baseColor;
    ctx.fillRect(px + 1, py + 1, ts - 2, ts - 2);

    // Darker inner body
    const darken = isFlashing ? baseColor : this.darkenColor(baseColor, 0.4);
    ctx.fillStyle = darken;
    ctx.fillRect(px + 3, py + 3, ts - 6, ts - 6);

    // Module-specific detail (overridden by subclasses)
    this.renderDetail(ctx, px, py, isConnected, isFlashing);

    // Border
    ctx.strokeStyle = isFlashing ? '#ffffff' : baseColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, ts - 1, ts - 1);

    // Damage cracks
    if (hpPct < 0.7 && !this.destroyed) {
      ctx.strokeStyle = `rgba(0, 0, 0, ${0.3 + (1 - hpPct) * 0.4})`;
      ctx.lineWidth = 1;
      // Crack 1
      ctx.beginPath();
      ctx.moveTo(px + 6, py + 4);
      ctx.lineTo(px + ts / 2, py + ts / 2);
      ctx.stroke();
      if (hpPct < 0.4) {
        // Crack 2
        ctx.beginPath();
        ctx.moveTo(px + ts - 5, py + ts - 6);
        ctx.lineTo(px + ts / 2, py + ts / 2);
        ctx.stroke();
      }
    }

    // HP bar under module
    if (hpPct < 1 && !this.destroyed) {
      const barW = ts - 4;
      const barH = 2;
      const barX = px + 2;
      const barY = py + ts - 3;
      ctx.fillStyle = '#111122';
      ctx.fillRect(barX, barY, barW, barH);
      let hpColor = '#00e5a0';
      if (hpPct < 0.25) hpColor = '#ff3355';
      else if (hpPct < 0.5) hpColor = '#ffcc00';
      ctx.fillStyle = hpColor;
      ctx.fillRect(barX, barY, barW * hpPct, barH);
    }

    ctx.globalAlpha = 1;
  }

  renderDetail(ctx, px, py, isConnected, isFlashing) {
    // Override in subclasses
  }

  darkenColor(hex, factor) {
    // Simple hex darken
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const dr = Math.floor(r * factor);
    const dg = Math.floor(g * factor);
    const db = Math.floor(b * factor);
    return `rgb(${dr},${dg},${db})`;
  }
}

// ── Attack Module ───────────────────────────────────────────
export class AttackModule extends Module {
  constructor() {
    super('attack', '#ff3355', 30, 20);
    this.fireTimer = 0;
    this.baseFireRate = 1.5; // shots per second
  }

  renderDetail(ctx, px, py, isConnected, isFlashing) {
    const cx = px + ts / 2;
    const cy = py + ts / 2;
    const color = isConnected ? (isFlashing ? '#fff' : '#ff8899') : '#555560';

    // Cannon barrel
    ctx.fillStyle = color;
    ctx.fillRect(cx - 1, py + 5, 3, ts / 2 - 3);

    // Cannon base circle
    ctx.beginPath();
    ctx.arc(cx, cy + 2, 5, 0, TWO_PI);
    ctx.fillStyle = isConnected ? (isFlashing ? '#fff' : '#cc2244') : '#444450';
    ctx.fill();

    // Center dot
    ctx.beginPath();
    ctx.arc(cx, cy + 2, 2, 0, TWO_PI);
    ctx.fillStyle = color;
    ctx.fill();
  }
}

// ── Defense Module ──────────────────────────────────────────
export class DefenseModule extends Module {
  constructor() {
    super('defense', '#3355ff', 80, 30);
  }

  renderDetail(ctx, px, py, isConnected, isFlashing) {
    const cx = px + ts / 2;
    const cy = py + ts / 2;
    const color = isConnected ? (isFlashing ? '#fff' : '#6688ff') : '#555560';

    // Shield shape — chevron/bracket
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 7, cy - 7);
    ctx.lineTo(cx - 7, cy + 4);
    ctx.lineTo(cx, cy + 9);
    ctx.lineTo(cx + 7, cy + 4);
    ctx.lineTo(cx + 7, cy - 7);
    ctx.closePath();
    ctx.stroke();

    // Inner cross
    ctx.strokeStyle = isConnected ? (isFlashing ? '#fff' : '#4466cc') : '#444450';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 4);
    ctx.lineTo(cx, cy + 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 4, cy);
    ctx.lineTo(cx + 4, cy);
    ctx.stroke();
  }
}

// ── Relay Module ────────────────────────────────────────────
export class RelayModule extends Module {
  constructor() {
    super('relay', '#ffd700', 20, 10);
  }

  renderDetail(ctx, px, py, isConnected, isFlashing) {
    const cx = px + ts / 2;
    const cy = py + ts / 2;
    const color = isConnected ? (isFlashing ? '#fff' : '#ffee55') : '#555560';

    // Node circle
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, TWO_PI);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Inner dot
    ctx.beginPath();
    ctx.arc(cx, cy, 2, 0, TWO_PI);
    ctx.fillStyle = color;
    ctx.fill();

    // Four extending lines (junction/node look)
    ctx.strokeStyle = isConnected ? (isFlashing ? '#fff' : '#ccaa00') : '#444450';
    ctx.lineWidth = 1;
    const reach = 5;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 6); ctx.lineTo(cx, cy - 6 - reach);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy + 6); ctx.lineTo(cx, cy + 6 + reach);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 6, cy); ctx.lineTo(cx - 6 - reach, cy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 6, cy); ctx.lineTo(cx + 6 + reach, cy);
    ctx.stroke();
  }
}

// ── Airstrike Module ───────────────────────────────────────
export class AirstrikeModule extends Module {
  constructor() {
    super('airstrike', '#ff8800', 25, 35);
    this.launchTimer = 0;
    this.baseLaunchInterval = 4.0; // seconds between sorties
  }

  renderDetail(ctx, px, py, isConnected, isFlashing) {
    const cx = px + ts / 2;
    const cy = py + ts / 2;
    const color = isConnected ? (isFlashing ? '#fff' : '#ffaa44') : '#555560';

    // Runway lines
    ctx.strokeStyle = isConnected ? '#aa6622' : '#444450';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy + 4); ctx.lineTo(cx + 8, cy + 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 6, cy + 7); ctx.lineTo(cx + 6, cy + 7);
    ctx.stroke();

    // Tiny plane icon
    ctx.fillStyle = color;
    // Fuselage
    ctx.fillRect(cx - 1, cy - 6, 3, 8);
    // Wings
    ctx.fillRect(cx - 5, cy - 3, 11, 2);
    // Tail
    ctx.fillRect(cx - 3, cy - 6, 7, 2);
  }
}

// ── Tesla Module ───────────────────────────────────────────
export class TeslaModule extends Module {
  constructor() {
    super('tesla', '#44ddff', 35, 30);
    this.zapTimer = 0;
    this.baseZapInterval = 1.8; // seconds between zaps
    this.zapRange = 100;
    this.zapDamage = 6;
    this.chainCount = 3;
  }

  renderDetail(ctx, px, py, isConnected, isFlashing) {
    const cx = px + ts / 2;
    const cy = py + ts / 2;
    const color = isConnected ? (isFlashing ? '#fff' : '#66eeff') : '#555560';

    // Tower base
    ctx.fillStyle = isConnected ? '#225566' : '#444450';
    ctx.fillRect(cx - 5, cy + 2, 11, 6);

    // Tower shaft
    ctx.fillStyle = color;
    ctx.fillRect(cx - 2, cy - 7, 5, 12);

    // Lightning bolt on top
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 8);
    ctx.lineTo(cx - 3, cy - 4);
    ctx.lineTo(cx + 1, cy - 4);
    ctx.lineTo(cx - 2, cy);
    ctx.stroke();

    // Arc circle
    ctx.beginPath();
    ctx.arc(cx, cy - 6, 4, 0, TWO_PI);
    ctx.strokeStyle = isConnected ? 'rgba(68, 221, 255, 0.4)' : '#333340';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

// ── Factory ─────────────────────────────────────────────────
export const MODULE_TYPES = {
  attack: {
    class: AttackModule, name: 'Attack', color: '#ff3355', cost: 20,
    desc: 'Fires projectiles at nearby enemies. +10% fire rate per adjacent Attack module.',
  },
  defense: {
    class: DefenseModule, name: 'Defense', color: '#3355ff', cost: 30,
    desc: 'High-HP barrier that blocks enemies. +15% integrity per adjacent Defense module.',
  },
  relay: {
    class: RelayModule, name: 'Relay', color: '#ffd700', cost: 10,
    desc: 'Boosts adjacent module bonuses by 25%. Cheap but fragile. Extends the board.',
  },
  airstrike: {
    class: AirstrikeModule, name: 'Airstrike', color: '#ff8800', cost: 35,
    desc: 'Launches pixel drones on bombing runs. Splash damage to enemy clusters.',
  },
  tesla: {
    class: TeslaModule, name: 'Tesla', color: '#44ddff', cost: 30,
    desc: 'Zaps nearest enemy with chain lightning. Chains to 3 nearby targets.',
  },
};

export function createModule(type) {
  const info = MODULE_TYPES[type];
  if (!info) return null;
  return new info.class();
}
