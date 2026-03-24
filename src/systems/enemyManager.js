import { CONFIG, STATES } from '../core/config.js';
import { Enemy, ENEMY_TYPES } from '../entities/enemy.js';
import { SPAWN_TABLE, SPECIAL_SPAWNS } from '../data/enemies.js';
import { eventBus } from '../core/eventBus.js';

const POOL_SIZE = 100;
const MAX_ENEMIES = 200;
const TWO_PI = Math.PI * 2;

// ── Simple particle (death burst + XP orb) ──────────────────
class Particle {
  constructor() { this.active = false; }

  initBurst(x, y, color) {
    this.active = true;
    this.x = x;
    this.y = y;
    this.type = 'burst';
    const angle = Math.random() * TWO_PI;
    const speed = 40 + Math.random() * 80;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = 0.3;
    this.maxLife = 0.3;
    this.size = 1 + Math.random() * 2.5;
    this.color = color;
  }

  initXpOrb(x, y, value) {
    this.active = true;
    this.x = x;
    this.y = y;
    this.type = 'xp';
    this.vx = 0;
    this.vy = 0;
    this.life = 30;
    this.maxLife = 30;
    this.size = 3;
    this.color = '#00e5a0';
    this.value = value;
    this.collecting = false;
    this.age = 0;
    this.vacuumDelay = 1.5;
  }

  initResourceDrop(x, y, value) {
    this.active = true;
    this.x = x + (Math.random() - 0.5) * 8; // slight offset from XP orb
    this.y = y + (Math.random() - 0.5) * 8;
    this.type = 'resource';
    this.vx = 0;
    this.vy = 0;
    this.life = 30;
    this.maxLife = 30;
    this.size = 3;
    this.color = '#ffd700';
    this.value = value;
    this.collecting = false;
    this.age = 0;
    this.vacuumDelay = 1.5;
  }

  update(dt, chip) {
    if (!this.active) return;

    if (this.type === 'burst') {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.life -= dt;
      if (this.life <= 0) this.active = false;
    }

    if (this.type === 'xp' || this.type === 'resource') {
      this.age += dt;

      if (!this.collecting) {
        if ((chip && chip.isInSignalRange(this.x, this.y)) || this.age >= this.vacuumDelay) {
          this.collecting = true;
        }
      }

      if (this.collecting) {
        const dx = chip.x - this.x;
        const dy = chip.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 6) {
          this.active = false;
          if (this.type === 'xp') {
            eventBus.emit('xpCollected', this.value);
            eventBus.emit('xpCollectedAt', { x: this.x, y: this.y, value: this.value });
          } else {
            eventBus.emit('resourceCollected', this.value);
            eventBus.emit('resourceCollectedAt', { x: this.x, y: this.y, value: this.value });
          }
          return;
        }
        const collectTime = this.age - this.vacuumDelay;
        const accel = Math.max(0, collectTime) * 300;
        const speed = 80 + accel;
        this.x += (dx / dist) * speed * dt;
        this.y += (dy / dist) * speed * dt;
      }

      this.life -= dt;
      if (this.life <= 0) this.active = false;
    }
  }

  render(ctx) {
    if (!this.active) return;

    if (this.type === 'burst') {
      const alpha = this.life / this.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = this.color;
      ctx.fillRect(
        Math.floor(this.x - this.size / 2),
        Math.floor(this.y - this.size / 2),
        Math.ceil(this.size),
        Math.ceil(this.size)
      );
      ctx.globalAlpha = 1;
    }

    if (this.type === 'xp') {
      const bob = Math.sin(this.age * 4) * 1.5;
      const drawY = Math.floor(this.y + bob);
      const pulse = 1 + Math.sin(this.age * 6) * 0.15;

      // Subtle glow
      ctx.fillStyle = 'rgba(0, 229, 160, 0.12)';
      ctx.beginPath();
      ctx.arc(Math.floor(this.x), drawY, (this.size + 3) * pulse, 0, TWO_PI);
      ctx.fill();

      // Orb
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(Math.floor(this.x), drawY, this.size * pulse, 0, TWO_PI);
      ctx.fill();
    }

    if (this.type === 'resource') {
      const bob = Math.sin(this.age * 3.5) * 1.5;
      const drawX = Math.floor(this.x);
      const drawY = Math.floor(this.y + bob);
      const s = 3.5;

      // Glow
      ctx.fillStyle = 'rgba(255, 215, 0, 0.1)';
      ctx.beginPath();
      ctx.arc(drawX, drawY, s + 3, 0, TWO_PI);
      ctx.fill();

      // Diamond shape
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.moveTo(drawX, drawY - s);
      ctx.lineTo(drawX + s, drawY);
      ctx.lineTo(drawX, drawY + s);
      ctx.lineTo(drawX - s, drawY);
      ctx.closePath();
      ctx.fill();
    }
  }
}

// ── Spawn Port ──────────────────────────────────────────────
class SpawnPort {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width = 20;
    this.height = 6;
    this.pulsePhase = Math.random() * TWO_PI;
    this.alertTimer = 0; // brightens before spawning
  }

  alert() {
    this.alertTimer = 0.5;
  }

  update(dt) {
    this.pulsePhase += dt * 4;
    if (this.pulsePhase > TWO_PI) this.pulsePhase -= TWO_PI;
    if (this.alertTimer > 0) this.alertTimer -= dt;
  }

  render(ctx) {
    const pulse = Math.sin(this.pulsePhase) * 0.5 + 0.5;
    const isAlert = this.alertTimer > 0;
    const alpha = isAlert ? 0.6 + 0.4 * pulse : 0.25 + 0.25 * pulse;

    ctx.fillStyle = `rgba(255, 51, 85, ${alpha})`;
    ctx.fillRect(
      Math.floor(this.x - this.width / 2),
      Math.floor(this.y - this.height / 2),
      this.width,
      this.height
    );

    // Bright center line
    ctx.fillStyle = `rgba(255, 120, 140, ${alpha * 0.6})`;
    ctx.fillRect(
      Math.floor(this.x - this.width / 2 + 2),
      Math.floor(this.y - 1),
      this.width - 4,
      2
    );
  }
}

// ── Enemy Manager ───────────────────────────────────────────
export class EnemyManager {
  constructor(chip) {
    this.chip = chip;

    // Play area grid offset (same calc as chip)
    const gridOffsetX = Math.floor((CONFIG.CANVAS_WIDTH - CONFIG.GRID_COLS * CONFIG.TILE_SIZE) / 2);
    const gridOffsetY = Math.floor((CONFIG.CANVAS_HEIGHT - CONFIG.GRID_ROWS * CONFIG.TILE_SIZE) / 2);
    const gridW = CONFIG.GRID_COLS * CONFIG.TILE_SIZE;
    const gridH = CONFIG.GRID_ROWS * CONFIG.TILE_SIZE;

    // Spawn edges — enemies spawn from random positions along all 4 sides
    this.spawnBounds = {
      left: gridOffsetX - 10,
      right: gridOffsetX + gridW + 10,
      top: gridOffsetY - 10,
      bottom: gridOffsetY + gridH + 10,
      gridOffsetX,
      gridOffsetY,
      gridW,
      gridH,
    };

    this.ports = [];
    this.gridManager = null; // set externally

    // Enemy object pool
    this.pool = [];
    for (let i = 0; i < POOL_SIZE; i++) {
      this.pool.push(new Enemy());
    }

    // Particle pool (death bursts + XP orbs)
    this.particles = [];
    for (let i = 0; i < 300; i++) {
      this.particles.push(new Particle());
    }

    // Continuous spawn state
    this.elapsedTime = 0;
    this.spawnTimer = 0;
    this.enemiesAlive = 0;
    this.totalKills = 0;

    // Special spawn timers
    this.ddosTimer = 0;
    this.ddosActive = false;
    this.ddosRemaining = 0;
    this.ddosSpawnTimer = 0;
    this.ransomwareTimer = 0;
    this.logicBombTimer = 0;
    this.logicBombCount = 0;

    // XP system reference
    this.xpSystem = null;

    // Threat escalation: immediate burst of enemies from all directions
    eventBus.on('threatEscalation', (data) => {
      const burstCount = 8 + data.milestone * 4; // 12, 16, 20, 24...
      for (let i = 0; i < burstCount; i++) {
        this.spawnEnemy();
      }
    });

    // Listen for firewall pulse
    eventBus.on('firewallPulse', (data) => this.handleFirewallPulse(data));

    // Listen for reactive armor pulse (same AOE logic as firewall pulse)
    eventBus.on('reactiveArmorPulse', (data) => this.handleFirewallPulse(data));

    // Listen for logic bomb strike — targeted AOE at nearest enemy
    eventBus.on('logicBombStrike', (data) => {
      // Find nearest enemy to chip
      let nearest = null;
      let nearestDistSq = Infinity;
      for (let i = 0; i < this.pool.length; i++) {
        const e = this.pool[i];
        if (!e.active) continue;
        const dx = e.x - this.chip.x;
        const dy = e.y - this.chip.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < nearestDistSq) {
          nearestDistSq = distSq;
          nearest = e;
        }
      }
      if (nearest) {
        this.handleFirewallPulse({
          x: nearest.x,
          y: nearest.y,
          radius: data.radius,
          damage: data.damage,
          knockback: 0,
        });
      }
    });

    // Listen for countermeasure pulse — defense modules emit AOE
    eventBus.on('countermeasurePulse', (data) => {
      if (!this.gridManager) return;
      const modules = this.gridManager.getAllModules();
      for (const mod of modules) {
        if (mod.type !== 'defense' || !mod.connected || mod.destroyed) continue;
        this.handleFirewallPulse({
          x: mod.x,
          y: mod.y,
          radius: data.range,
          damage: data.damage,
          knockback: 0,
        });
      }
    });
  }

  handleFirewallPulse(data) {
    const { x, y, radius, damage, knockback } = data;
    const radiusSq = radius * radius;

    for (let i = 0; i < this.pool.length; i++) {
      const e = this.pool[i];
      if (!e.active) continue;
      const dx = e.x - x;
      const dy = e.y - y;
      const distSq = dx * dx + dy * dy;

      if (distSq < radiusSq) {
        const killed = e.takeDamage(damage);

        // Knockback
        if (knockback > 0 && !killed) {
          const dist = Math.sqrt(distSq) || 1;
          e.x += (dx / dist) * knockback;
          e.y += (dy / dist) * knockback;
          // Break module attack if knocked
          e.attackingModule = null;
        }

        if (killed) this.killEnemy(e);
      }
    }

    // Visual pulse ring
    eventBus.emit('firewallPulseVisual', { x, y, radius });
  }

  // ── Pool helpers ─────────────────────────────────────────
  getEnemy() {
    for (let i = 0; i < this.pool.length; i++) {
      if (!this.pool[i].active) return this.pool[i];
    }
    const e = new Enemy();
    this.pool.push(e);
    return e;
  }

  getParticle() {
    for (let i = 0; i < this.particles.length; i++) {
      if (!this.particles[i].active) return this.particles[i];
    }
    const p = new Particle();
    this.particles.push(p);
    return p;
  }

  // ── Spawn logic ────────────────────────────────────────
  getRandomEdgePosition() {
    // Spawn in a circle around the chip, off-screen
    const angle = Math.random() * TWO_PI;
    const radius = Math.max(CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT) * 0.6;
    return {
      x: this.chip.x + Math.cos(angle) * radius,
      y: this.chip.y + Math.sin(angle) * radius,
    };
  }

  /** Seconds between spawns — starts slow, gets much faster over time */
  getSpawnInterval() {
    // Accelerates: 1.2s → 0.4s by 3min, → 0.12s by 8min
    return Math.max(0.12, 1.2 - this.elapsedTime * 0.005);
  }

  /** Enemy HP multiplier — ramps aggressively */
  getDifficultyMultiplier() {
    // Slow at first, then exponential ramp:
    // 1min: 1.3, 3min: 2.0, 5min: 3.5, 8min: 7.0, 10min: 12.0
    const t = this.elapsedTime;
    return 1 + t * 0.005 + Math.pow(t / 120, 2.2);
  }

  /** Enemy speed multiplier — significant acceleration over time */
  getSpeedMultiplier() {
    // +15% per minute, compounding
    const minutes = this.elapsedTime / 60;
    return 1 + minutes * 0.15 + Math.pow(minutes / 5, 1.5) * 0.2;
  }

  pickEnemyType() {
    const eligible = SPAWN_TABLE.filter(e => this.elapsedTime >= e.minTime);
    let totalWeight = 0;
    for (const e of eligible) totalWeight += e.weight;
    let roll = Math.random() * totalWeight;
    for (const e of eligible) {
      roll -= e.weight;
      if (roll <= 0) return e.type;
    }
    return 'bit';
  }

  spawnEnemy() {
    const type = this.pickEnemyType();

    // Cluster spawn: 15% chance after 2min, spawn 2-4 of the same type together
    if (this.elapsedTime > 120 && Math.random() < 0.15 && type !== 'trojan') {
      const clusterSize = 2 + Math.floor(Math.random() * 3); // 2-4
      const basePos = this.getRandomEdgePosition();
      for (let c = 0; c < clusterSize; c++) {
        this.spawnEnemyOfType(type, {
          x: basePos.x + (Math.random() - 0.5) * 25,
          y: basePos.y + (Math.random() - 0.5) * 25,
        });
      }
    } else {
      this.spawnEnemyOfType(type);
    }
  }

  spawnEnemyOfType(type, overridePos) {
    // Hard cap on active enemies to prevent unbounded accumulation
    if (this.enemiesAlive >= MAX_ENEMIES) return null;

    const pos = overridePos || this.getRandomEdgePosition();
    const diff = this.getDifficultyMultiplier();
    const spdMult = this.getSpeedMultiplier();
    const template = ENEMY_TYPES[type];
    if (!template) return null;

    const enemy = this.getEnemy();
    enemy.type = type;
    enemy.color = template.color;
    enemy.borderColor = template.borderColor;
    enemy.maxHp = Math.floor(template.hp * diff);
    enemy.speed = template.speed * spdMult;
    enemy.damage = Math.max(1, Math.floor(template.damage * Math.max(1, diff * 0.5)));
    enemy.xpValue = template.xpValue;
    enemy.ignoresModules = template.ignoresModules || false;
    enemy.canSplit = template.canSplit || false;
    enemy.opacity = template.opacity || 1;
    enemy.isBoss = template.isBoss || false;

    // Size scales slightly with HP multiplier (enemies get visibly bigger as they get tougher)
    // Base size grows ~20% at diff 3, ~40% at diff 6, caps at +60%
    const sizeScale = 1 + Math.min(0.6, (diff - 1) * 0.08);
    enemy.size = Math.round(template.size * sizeScale);

    // Trojan: stationary, disguised
    if (type === 'trojan') {
      enemy.speed = 0;
      enemy.revealed = false;
    }

    // Logic Bomb: scale HP with appearance count
    if (type === 'logic_bomb') {
      this.logicBombCount++;
      enemy.maxHp = Math.floor(190 * diff * Math.pow(1.5, this.logicBombCount - 1));
      enemy.bossAppearance = this.logicBombCount;
      enemy.bossFireTimer = 0;
      eventBus.emit('bossSpawned', { type, appearance: this.logicBombCount });
    }

    // Ransomware
    if (type === 'ransomware') {
      enemy.maxHp = Math.floor(100 * diff);
    }

    enemy.hp = enemy.maxHp;
    enemy.init(pos.x, pos.y);
    // Re-set stats that init resets
    enemy.canSplit = template.canSplit || false;
    enemy.opacity = template.opacity || 1;
    enemy.isBoss = template.isBoss || false;
    if (type === 'trojan') enemy.revealed = false;

    this.enemiesAlive++;
    return enemy;
  }

  killEnemy(enemy) {
    enemy.active = false;
    this.enemiesAlive--;
    this.totalKills++;

    // Death burst particles (6-8)
    const count = 6 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const p = this.getParticle();
      p.initBurst(enemy.x, enemy.y, enemy.color);
    }

    // XP orb
    const xp = this.getParticle();
    xp.initXpOrb(enemy.x, enemy.y, enemy.xpValue);

    // Resource drop (~30% chance, value 2-3)
    if (Math.random() < 0.30) {
      const res = this.getParticle();
      res.initResourceDrop(enemy.x, enemy.y, 2 + Math.floor(Math.random() * 2));
    }

    // Worm splitting
    if (enemy.type === 'worm' && enemy.canSplit) {
      for (let s = 0; s < 2; s++) {
        const offset = { x: enemy.x + (s === 0 ? -8 : 8), y: enemy.y };
        this.spawnEnemyOfType('wormlet', offset);
      }
    }

    // Ransomware: unlock modules on death
    if (enemy.type === 'ransomware' && enemy.lockedModules) {
      for (const mod of enemy.lockedModules) {
        if (mod && !mod.destroyed) mod.locked = false;
      }
      enemy.lockedModules = [];
    }

    // Virus: release latched module
    if (enemy.type === 'virus' && enemy.latchedModule) {
      enemy.latchedModule = null;
    }

    // Logic Bomb: guaranteed rare card drop
    if (enemy.type === 'logic_bomb') {
      eventBus.emit('bossKilled', { x: enemy.x, y: enemy.y });
    }

    eventBus.emit('enemyKilled', { x: enemy.x, y: enemy.y, type: enemy.type });

    // Buffer Overflow: death explosion (iterative queue to prevent stack overflow)
    if (this.xpSystem && this.xpSystem.bufferOverflow) {
      this._processBufferOverflow(enemy);
    }
  }

  /** Iterative Buffer Overflow chain — replaces recursive killEnemy calls */
  _processBufferOverflow(origin) {
    const bo = this.xpSystem.bufferOverflow;
    const cascadeBonus = this.xpSystem.cascadeFailure
      ? bo.damage * this.xpSystem.cascadeFailure.bonusPct
      : 0;
    const totalDmg = bo.damage + cascadeBonus;
    const rangeSq = bo.range * bo.range;

    // Queue of enemies whose explosions need processing
    const queue = [origin];
    const processed = new Set();
    processed.add(origin);

    // Cap chain iterations to prevent runaway freezes
    const MAX_CHAIN = 80;
    let chainCount = 0;

    while (queue.length > 0 && chainCount < MAX_CHAIN) {
      const source = queue.shift();
      chainCount++;

      const toKill = [];
      for (let i = 0; i < this.pool.length; i++) {
        const e2 = this.pool[i];
        if (!e2.active || processed.has(e2)) continue;
        const dx = e2.x - source.x;
        const dy = e2.y - source.y;
        if (dx * dx + dy * dy < rangeSq) {
          const killed = e2.takeDamage(totalDmg);
          if (killed) toKill.push(e2);
        }
      }

      // Explosion visual
      if (toKill.length > 0 || bo.damage > 0) {
        eventBus.emit('firewallPulseVisual', { x: source.x, y: source.y, radius: bo.range });
      }

      for (const e2 of toKill) {
        processed.add(e2);
        e2.active = false;
        this.enemiesAlive--;
        this.totalKills++;

        // Particles + drops for chained kills
        const c2 = 4 + Math.floor(Math.random() * 3);
        for (let j = 0; j < c2; j++) {
          const p = this.getParticle();
          p.initBurst(e2.x, e2.y, e2.color);
        }
        const xp2 = this.getParticle();
        xp2.initXpOrb(e2.x, e2.y, e2.xpValue);

        // If chain enabled, queue this kill's explosion for processing
        if (bo.chain) {
          queue.push(e2);
        }
      }
    }
  }

  // ── Per-frame ────────────────────────────────────────────
  update(dt, state) {
    if (state !== STATES.COMBAT) return;

    this.elapsedTime += dt;

    // ── Regular continuous spawning ────────────────────────
    this.spawnTimer += dt;
    const interval = this.getSpawnInterval();
    while (this.spawnTimer >= interval) {
      this.spawnTimer -= interval;
      this.spawnEnemy();
    }

    // ── Special spawn timers ────────────────────────────────
    const sp = SPECIAL_SPAWNS;

    // DDoS Swarm — scales with time, gets increasingly massive
    if (this.elapsedTime >= sp.ddosMinTime) {
      this.ddosTimer += dt;
      if (!this.ddosActive && this.ddosTimer >= sp.ddosInterval) {
        this.ddosTimer = 0;
        this.ddosActive = true;
        // Scale count: base 80, +20 per minute past 2min
        const extraMinutes = Math.max(0, (this.elapsedTime - 120) / 60);
        const totalCount = sp.ddosCount + Math.floor(extraMinutes * 20);
        this.ddosRemaining = totalCount;
        this.ddosSpawnRate = sp.ddosDuration / totalCount; // fixed interval
        this.ddosSpawnTimer = 0;
        // Alert!
        eventBus.emit('ddosSwarmStart', { count: totalCount });
      }
    }
    if (this.ddosActive) {
      this.ddosSpawnTimer += dt;
      while (this.ddosSpawnTimer >= this.ddosSpawnRate && this.ddosRemaining > 0) {
        this.ddosSpawnTimer -= this.ddosSpawnRate;
        this.ddosRemaining--;
        this.spawnEnemyOfType('ddos');
      }
      if (this.ddosRemaining <= 0) this.ddosActive = false;
    }

    // Ransomware mini-boss
    if (this.elapsedTime >= sp.ransomwareMinTime) {
      this.ransomwareTimer += dt;
      if (this.ransomwareTimer >= sp.ransomwareInterval) {
        this.ransomwareTimer = 0;
        this.spawnEnemyOfType('ransomware');
      }
    }

    // Logic Bomb boss
    if (this.elapsedTime >= sp.logicBombMinTime) {
      this.logicBombTimer += dt;
      if (this.logicBombTimer >= sp.logicBombInterval) {
        this.logicBombTimer = 0;
        this.spawnEnemyOfType('logic_bomb');
      }
    }

    // ── Update enemies ──────────────────────────────────────
    for (let i = 0; i < this.pool.length; i++) {
      const e = this.pool[i];
      if (!e.active) continue;

      // ── Per-type pre-update behaviors ──────────────────
      // Packet: sinusoidal zigzag offset
      if (e.type === 'packet') {
        const dx = this.chip.x - e.x;
        const dy = this.chip.y - e.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const perpX = -dy / dist;
        const perpY = dx / dist;
        const zigzag = Math.sin(e.age * 8) * 12;
        // Apply offset as a visual+real shift
        e.x += perpX * zigzag * dt * 3;
        e.y += perpY * zigzag * dt * 3;
      }

      // Trojan: reveal when chip signal range touches it
      if (e.type === 'trojan' && !e.revealed) {
        if (this.chip.isInSignalRange(e.x, e.y)) {
          e.revealed = true;
          e.speed = 60;
          e.color = '#9933cc';
          e.borderColor = '#661199';
        }
      }

      // Virus: latch onto a random module and drain it
      if (e.type === 'virus' && !e.latchedModule && !e.attackingModule && this.gridManager) {
        const modules = this.gridManager.getAllModules().filter(m => m.connected && !m.destroyed);
        if (modules.length > 0) {
          const target = modules[Math.floor(Math.random() * modules.length)];
          const dx = target.x - e.x;
          const dy = target.y - e.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 20) {
            e.latchedModule = target;
            e.speed = 0;
            e.x = target.x;
            e.y = target.y;
          }
        }
      }
      if (e.type === 'virus' && e.latchedModule) {
        if (e.latchedModule.destroyed || e.latchedModule.integrity <= 0) {
          e.latchedModule = null;
          e.speed = 35;
        } else {
          e.latchedModule.takeDamage(3 * dt);
          e.x = e.latchedModule.x;
          e.y = e.latchedModule.y;
        }
      }

      // Rootkit: becomes more visible near chip or modules
      if (e.type === 'rootkit') {
        const distToChip = Math.sqrt((e.x - this.chip.x) ** 2 + (e.y - this.chip.y) ** 2);
        e.opacity = distToChip < 40 ? 1 : 0.15;
      }

      // Ransomware: lock modules when reaches the grid area
      if (e.type === 'ransomware' && e.lockedModules.length === 0 && this.gridManager) {
        const grid = this.gridManager.pixelToGrid(e.x, e.y);
        if (this.gridManager.inBounds(grid.col, grid.row)) {
          // Lock modules within 3 tiles
          const modules = this.gridManager.getAllModules();
          for (const mod of modules) {
            const dc = Math.abs(mod.col - grid.col);
            const dr = Math.abs(mod.row - grid.row);
            if (dc <= 3 && dr <= 3 && !mod.destroyed) {
              mod.locked = true;
              e.lockedModules.push(mod);
            }
          }
        }
      }

      // Logic Bomb: stop at range and fire projectiles
      if (e.type === 'logic_bomb') {
        const distToChip = Math.sqrt((e.x - this.chip.x) ** 2 + (e.y - this.chip.y) ** 2);
        if (distToChip <= 120) {
          e.speed = 0; // stop at range
          e.bossFireTimer += dt;
          if (e.bossFireTimer >= 1.0) {
            e.bossFireTimer -= 1.0;
            eventBus.emit('bossProjectile', { x: e.x, y: e.y, targetX: this.chip.x, targetY: this.chip.y, damage: 8 });
          }
        }
      }

      // Slow Drain: DPS + speed reduction near chip
      if (this.xpSystem && this.xpSystem.slowDrain) {
        const sd = this.xpSystem.slowDrain;
        const sdx = e.x - this.chip.x;
        const sdy = e.y - this.chip.y;
        const sdDistSq = sdx * sdx + sdy * sdy;
        if (sdDistSq < sd.range * sd.range) {
          const killed = e.takeDamage(sd.dps * dt);
          if (!e._slowDrainApplied) {
            e._origSpeed = e.speed;
            e.speed *= (1 - sd.slowPct);
            e._slowDrainApplied = true;
          }
          if (killed) {
            this.killEnemy(e);
            continue;
          }
        } else if (e._slowDrainApplied) {
          e.speed = e._origSpeed || e.speed;
          e._slowDrainApplied = false;
        }
      }

      // ── Standard module collision & movement ──────────
      if (!e.attackingModule && !e.ignoresModules && e.type !== 'virus' && this.gridManager) {
        const mod = this.gridManager.getModuleAtPixel(e.x, e.y);
        if (mod && !mod.destroyed && !mod.locked) {
          e.attackingModule = mod;
          e.attackTimer = 0;
        }
      }

      e.update(dt, this.chip.x, this.chip.y);

      // Module destruction check
      if (e.attackingModule && (e.attackingModule.destroyed || e.attackingModule.integrity <= 0)) {
        const mod = e.attackingModule;
        e.attackingModule = null;
        e.attackTimer = 0;

        if (mod.destroyed && this.gridManager) {
          const destroyed = this.gridManager.destroyModule(mod.col, mod.row);
          if (destroyed) {
            const count = 10 + Math.floor(Math.random() * 3);
            const pixel = this.gridManager.gridToPixel(mod.col, mod.row);
            for (let j = 0; j < count; j++) {
              const p = this.getParticle();
              p.initBurst(pixel.x, pixel.y, destroyed.color);
            }
            eventBus.emit('moduleDestroyed', { col: mod.col, row: mod.row });

            if (this.xpSystem && this.xpSystem.synergies.deadMansSwitch) {
              const explodeRange = 60;
              const rangeSq = explodeRange * explodeRange;
              for (let k = 0; k < this.pool.length; k++) {
                const e3 = this.pool[k];
                if (!e3.active) continue;
                const edx = e3.x - pixel.x;
                const edy = e3.y - pixel.y;
                if (edx * edx + edy * edy < rangeSq) {
                  if (e3.takeDamage(15)) this.killEnemy(e3);
                }
              }
              eventBus.emit('firewallPulseVisual', { x: pixel.x, y: pixel.y, radius: explodeRange });
            }
          }
        }
      }

      // Chip collision
      if (!e.attackingModule && e.type !== 'virus' && e.hitsChip(this.chip)) {
        this.chip.takeDamage(e.damage);
        this.killEnemy(e);
        eventBus.emit('chipDamaged', e.damage);
      }
    }

    // Update particles
    for (let i = 0; i < this.particles.length; i++) {
      if (this.particles[i].active) {
        this.particles[i].update(dt, this.chip);
      }
    }
  }

  render(ctx, state) {
    if (state !== STATES.COMBAT && state !== STATES.LEVEL_UP && state !== STATES.BUILD_PHASE) return;

    // Enemies with per-type rendering
    for (let i = 0; i < this.pool.length; i++) {
      const e = this.pool[i];
      if (!e.active) continue;

      // Trojan: render as resource diamond when hidden
      if (e.type === 'trojan' && !e.revealed) {
        const s = 4;
        ctx.fillStyle = 'rgba(255, 215, 0, 0.1)';
        ctx.beginPath();
        ctx.arc(Math.floor(e.x), Math.floor(e.y), s + 3, 0, TWO_PI);
        ctx.fill();
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.moveTo(e.x, e.y - s);
        ctx.lineTo(e.x + s, e.y);
        ctx.lineTo(e.x, e.y + s);
        ctx.lineTo(e.x - s, e.y);
        ctx.closePath();
        ctx.fill();
        continue;
      }

      // Virus: render with tether to latched module
      if (e.type === 'virus' && e.latchedModule) {
        const pulse = Math.sin(e.age * 8) * 0.3 + 0.7;
        ctx.strokeStyle = `rgba(221, 51, 221, ${pulse})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(e.latchedModule.x, e.latchedModule.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Crawler X marks
      if (e.type === 'crawler') {
        e.render(ctx);
        const half = e.size / 2;
        ctx.strokeStyle = '#aa3344';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(e.x - half + 2, e.y - half + 2);
        ctx.lineTo(e.x + half - 2, e.y + half - 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(e.x + half - 2, e.y - half + 2);
        ctx.lineTo(e.x - half + 2, e.y + half - 2);
        ctx.stroke();
        continue;
      }

      // Logic Bomb: pulsing white glow
      if (e.type === 'logic_bomb') {
        ctx.save();
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 6 + Math.sin(e.age * 3) * 4;
        e.render(ctx);
        ctx.restore();
        // HP bar for bosses
        const barW = e.size + 8;
        const barH = 3;
        const barX = Math.floor(e.x - barW / 2);
        const barY = Math.floor(e.y - e.size / 2 - 6);
        ctx.fillStyle = '#111122';
        ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = '#ff3355';
        ctx.fillRect(barX, barY, barW * (e.hp / e.maxHp), barH);
        continue;
      }

      // Ransomware: gold/red glow + HP bar
      if (e.type === 'ransomware') {
        ctx.save();
        ctx.shadowColor = '#ffaa33';
        ctx.shadowBlur = 4;
        e.render(ctx);
        ctx.restore();
        const barW = e.size + 4;
        const barH = 3;
        const barX = Math.floor(e.x - barW / 2);
        const barY = Math.floor(e.y - e.size / 2 - 6);
        ctx.fillStyle = '#111122';
        ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = '#ffaa33';
        ctx.fillRect(barX, barY, barW * (e.hp / e.maxHp), barH);
        continue;
      }

      // Worm/wormlet: green with inner line
      if (e.type === 'worm' || e.type === 'wormlet') {
        e.render(ctx);
        ctx.strokeStyle = '#55ee77';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(Math.floor(e.x), Math.floor(e.y - e.size / 2 + 1));
        ctx.lineTo(Math.floor(e.x), Math.floor(e.y + e.size / 2 - 1));
        ctx.stroke();
        continue;
      }

      // Default render
      e.render(ctx);
    }

    // Particles (death bursts + XP orbs)
    for (let i = 0; i < this.particles.length; i++) {
      if (this.particles[i].active) {
        this.particles[i].render(ctx);
      }
    }

  }

  reset() {
    for (const e of this.pool) e.active = false;
    for (const p of this.particles) p.active = false;
    this.elapsedTime = 0;
    this.spawnTimer = 0;
    this.enemiesAlive = 0;
    this.totalKills = 0;
    this.ddosTimer = 0;
    this.ddosActive = false;
    this.ddosRemaining = 0;
    this.ddosSpawnTimer = 0;
    this.ransomwareTimer = 0;
    this.logicBombTimer = 0;
    this.logicBombCount = 0;
  }

  /** Get active enemies array (for attack targeting) */
  getActiveEnemies() {
    const result = [];
    for (let i = 0; i < this.pool.length; i++) {
      if (this.pool[i].active) result.push(this.pool[i]);
    }
    return result;
  }
}
