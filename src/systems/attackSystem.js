import { STATES } from '../core/config.js';
import { eventBus } from '../core/eventBus.js';
import { Projectile } from '../entities/projectile.js';

const POOL_SIZE = 50;
const TWO_PI = Math.PI * 2;

// ── Hit flash effect ────────────────────────────────────────
class HitFlash {
  constructor() {
    this.active = false;
  }

  init(x, y) {
    this.active = true;
    this.x = x;
    this.y = y;
    this.life = 0.15;
    this.maxLife = 0.15;
  }

  update(dt) {
    if (!this.active) return;
    this.life -= dt;
    if (this.life <= 0) this.active = false;
  }

  render(ctx) {
    if (!this.active) return;
    const progress = 1 - this.life / this.maxLife; // 0→1
    const radius = 2 + 6 * progress;
    const alpha = (1 - progress) * 0.9;

    ctx.beginPath();
    ctx.arc(Math.floor(this.x), Math.floor(this.y), radius, 0, TWO_PI);
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.fill();
  }
}

// ── Attack definition ───────────────────────────────────────
class Attack {
  constructor(config) {
    this.name = config.name;
    this.fireRate = config.fireRate;       // shots per second
    this.damage = config.damage;
    this.speed = config.speed;             // projectile px/sec
    this.range = config.range;             // px from chip
    this.size = config.size;               // projectile size
    this.color = config.color;
    this.cooldown = 0;
    this.projectilesPerShot = config.projectilesPerShot || 1;
    this.turretCount = config.turretCount || 1;
    this.bounces = config.bounces || 0;
    this.bounceDamageBonus = config.bounceDamageBonus || 0;
    this.flatDamageBonus = config.flatDamageBonus || 0;
  }

  get interval() {
    return 1 / this.fireRate;
  }
}

// ── Attack System ───────────────────────────────────────────
export class AttackSystem {
  constructor(chip, enemyManager) {
    this.chip = chip;
    this.enemyManager = enemyManager;
    this.gridManager = null; // set externally
    this.xpSystem = null;    // set externally for synergy checks

    // Attacks the chip currently has
    this.attacks = [
      new Attack({
        name: 'Ping Burst',
        fireRate: 3,
        damage: 4,
        speed: 200,
        range: 180,
        size: 3,
        color: '#00e5a0',
      }),
    ];

    // Projectile pool
    this.projectiles = [];
    for (let i = 0; i < POOL_SIZE; i++) {
      this.projectiles.push(new Projectile());
    }

    // Hit flash pool
    this.flashes = [];
    for (let i = 0; i < 30; i++) {
      this.flashes.push(new HitFlash());
    }

    // Boss projectiles (enemy → chip)
    this.bossProjectiles = [];
    eventBus.on('bossProjectile', (data) => {
      const proj = new Projectile();
      proj.init(data.x, data.y, data.targetX, data.targetY, 100, data.damage, 5, '#ffffff');
      proj.isBossProjectile = true;
      this.bossProjectiles.push(proj);
    });

    // Drone pool (airstrike modules)
    this.drones = [];

    // Tesla lightning arcs (visual only, damage applied instantly)
    this.lightningArcs = []; // [{points: [{x,y}], timer, maxTimer}]
  }

  createAttack(config) {
    return new Attack(config);
  }

  reset() {
    this.attacks = [
      new Attack({
        name: 'Ping Burst',
        fireRate: 3,
        damage: 4,
        speed: 200,
        range: 180,
        size: 3,
        color: '#00e5a0',
      }),
    ];
    for (const p of this.projectiles) p.active = false;
    for (const f of this.flashes) f.active = false;
    this.bossProjectiles = [];
    this.drones = [];
    this.lightningArcs = [];
  }

  getProjectile() {
    for (let i = 0; i < this.projectiles.length; i++) {
      if (!this.projectiles[i].active) return this.projectiles[i];
    }
    const p = new Projectile();
    this.projectiles.push(p);
    return p;
  }

  getFlash() {
    for (let i = 0; i < this.flashes.length; i++) {
      if (!this.flashes[i].active) return this.flashes[i];
    }
    const f = new HitFlash();
    this.flashes.push(f);
    return f;
  }

  findNearestEnemies(range, count) {
    const rangeSq = range * range;
    const candidates = [];

    for (let i = 0; i < this.enemyManager.pool.length; i++) {
      const e = this.enemyManager.pool[i];
      if (!e.active) continue;

      const dx = e.x - this.chip.x;
      const dy = e.y - this.chip.y;
      const distSq = dx * dx + dy * dy;

      if (distSq < rangeSq) {
        candidates.push({ enemy: e, distSq });
      }
    }

    candidates.sort((a, b) => a.distSq - b.distSq);
    return candidates.slice(0, count).map(c => c.enemy);
  }

  findNearestEnemy(range) {
    const results = this.findNearestEnemies(range, 1);
    return results.length > 0 ? results[0] : null;
  }

  getNeuralNetworkMultiplier() {
    if (!this.xpSystem?.synergies?.neuralNetwork || !this.gridManager) return 1;
    const utilCount = this.gridManager.getAllModules().filter(
      m => (m.type === 'relay' || m.type === 'utility') && m.connected
    ).length;
    return 1 + utilCount * 0.08;
  }

  findNearestEnemyFrom(x, y, range) {
    const rangeSq = range * range;
    let nearest = null;
    let nearestDist = rangeSq;

    for (let i = 0; i < this.enemyManager.pool.length; i++) {
      const e = this.enemyManager.pool[i];
      if (!e.active) continue;
      const dx = e.x - x;
      const dy = e.y - y;
      const distSq = dx * dx + dy * dy;
      if (distSq < nearestDist) {
        nearestDist = distSq;
        nearest = e;
      }
    }
    return nearest;
  }

  update(dt, state) {
    if (state !== STATES.COMBAT) return;

    // Fire attacks
    for (const attack of this.attacks) {
      attack.cooldown -= dt;
      if (attack.cooldown <= 0) {
        const turrets = attack.turretCount || 1;
        const targets = this.findNearestEnemies(attack.range, turrets);
        if (targets.length > 0) {
          for (let t = 0; t < turrets; t++) {
            // Each turret picks a different target, wrapping if fewer targets than turrets
            const target = targets[t % targets.length];
            const count = attack.projectilesPerShot || 1;
            const baseAngle = Math.atan2(target.y - this.chip.y, target.x - this.chip.x);
            const perpX = -Math.sin(baseAngle);
            const perpY = Math.cos(baseAngle);
            const spacing = 6;

            for (let p = 0; p < count; p++) {
              // Packet Storm: angular spread instead of parallel offset
              let aimAngle = baseAngle;
              let startX, startY;
              if (attack.spreadArc && count > 1) {
                const arcRad = attack.spreadArc * Math.PI / 180;
                aimAngle = baseAngle - arcRad / 2 + (p / (count - 1)) * arcRad;
                startX = this.chip.x;
                startY = this.chip.y;
              } else {
                const offset = (p - (count - 1) / 2) * spacing;
                startX = this.chip.x + perpX * offset;
                startY = this.chip.y + perpY * offset;
              }

              const aimDist = 200;
              const aimX = attack.spreadArc ? startX + Math.cos(aimAngle) * aimDist : target.x + perpX * ((p - (count - 1) / 2) * spacing);
              const aimY = attack.spreadArc ? startY + Math.sin(aimAngle) * aimDist : target.y + perpY * ((p - (count - 1) / 2) * spacing);

              // Relay Amplifier: bonus flat damage per connected relay
              let relayBonus = 0;
              if (this.xpSystem?.relayAmplifier && this.gridManager) {
                const relayCount = this.gridManager.getAllModules().filter(
                  m => m.type === 'relay' && m.connected
                ).length;
                relayBonus = this.xpSystem.relayAmplifier * relayCount;
              }

              const proj = this.getProjectile();
              proj.init(
                startX, startY,
                aimX, aimY,
                attack.speed, Math.floor((attack.damage + attack.flatDamageBonus + relayBonus) * this.getNeuralNetworkMultiplier()),
                attack.size, attack.color
              );
              proj.maxRange = attack.range;
              proj.bouncesLeft = attack.bounces;
              proj.bounceDamageBonus = attack.bounceDamageBonus;
            }
          }
          attack.cooldown = attack.interval;
          eventBus.emit('projectileFired', attack.name);
        } else {
          // No target — don't burn cooldown, try again next frame
          attack.cooldown = 0;
        }
      }
    }

    // Fire from attack modules
    if (this.gridManager) {
      const modules = this.gridManager.getAllModules();
      for (const mod of modules) {
        if (mod.type !== 'attack' || !mod.connected || mod.destroyed) continue;

        mod.fireTimer = (mod.fireTimer || 0) - dt;
        if (mod.fireTimer <= 0) {
          const fireRate = this.gridManager.getAttackModuleFireRate(
            mod.col, mod.row, mod.baseFireRate
          );
          // Attack modules always fire independently
          // Base stats scale with chip's Ping Burst if available
          const pb = this.attacks.find(a => a.name === 'Ping Burst');
          const botnet = this.xpSystem && this.xpSystem.synergies && this.xpSystem.synergies.botnet;
          let modDmg = pb ? Math.floor((pb.damage + pb.flatDamageBonus) * 0.6) : 3;
          let modSpeed = pb ? pb.speed * 0.8 : 180;
          let modRange = pb ? pb.range * 0.7 : 120;
          let modColor = '#ff6677';

          // Botnet synergy: full chip stats instead of reduced
          if (botnet && pb) {
            modDmg = pb.damage + pb.flatDamageBonus;
            modSpeed = pb.speed;
            modRange = pb.range;
            modColor = '#00e5a0';
          }

          const target = this.findNearestEnemyFrom(mod.x, mod.y, modRange);
          if (target) {
            const proj = this.getProjectile();
            proj.init(mod.x, mod.y, target.x, target.y, modSpeed, modDmg, 3, modColor);
            proj.maxRange = modRange;
            if (pb) {
              proj.bouncesLeft = pb.bounces;
              proj.bounceDamageBonus = pb.bounceDamageBonus;
            }
            mod.fireTimer = 1 / fireRate;
          } else {
            mod.fireTimer = 0;
          }
        }
      }
    }

    // ── Airstrike modules — launch drones ──────────────────
    if (this.gridManager) {
      const allMods = this.gridManager.getAllModules();
      for (const mod of allMods) {
        if (mod.type !== 'airstrike' || !mod.connected || mod.destroyed) continue;
        mod.launchTimer = (mod.launchTimer || 0) - dt;
        if (mod.launchTimer <= 0) {
          // Find a target cluster
          const target = this.findNearestEnemyFrom(mod.x, mod.y, 200);
          if (target) {
            this.drones.push({
              x: mod.x, y: mod.y,
              homeX: mod.x, homeY: mod.y,
              targetX: target.x, targetY: target.y,
              speed: 120,
              damage: 8,
              splashRadius: 40,
              phase: 'outbound', // 'outbound' → 'bomb' → 'return'
              angle: Math.atan2(target.y - mod.y, target.x - mod.x),
              bombTimer: 0,
            });
            mod.launchTimer = mod.baseLaunchInterval;
          } else {
            mod.launchTimer = 0.5; // retry soon
          }
        }
      }
    }

    // Update drones
    for (let i = this.drones.length - 1; i >= 0; i--) {
      const d = this.drones[i];

      if (d.phase === 'outbound') {
        d.x += Math.cos(d.angle) * d.speed * dt;
        d.y += Math.sin(d.angle) * d.speed * dt;
        const dx = d.targetX - d.x;
        const dy = d.targetY - d.y;
        if (dx * dx + dy * dy < 15 * 15) {
          d.phase = 'bomb';
          d.bombTimer = 0.15;
          // Deal splash damage
          eventBus.emit('firewallPulse', {
            x: d.x, y: d.y,
            radius: d.splashRadius,
            damage: d.damage,
            knockback: 10,
          });
        }
      } else if (d.phase === 'bomb') {
        d.bombTimer -= dt;
        if (d.bombTimer <= 0) {
          d.phase = 'return';
          d.angle = Math.atan2(d.homeY - d.y, d.homeX - d.x);
        }
      } else if (d.phase === 'return') {
        d.x += Math.cos(d.angle) * d.speed * 1.5 * dt;
        d.y += Math.sin(d.angle) * d.speed * 1.5 * dt;
        const dx = d.homeX - d.x;
        const dy = d.homeY - d.y;
        if (dx * dx + dy * dy < 10 * 10) {
          this.drones.splice(i, 1);
        }
      }
    }

    // ── Tesla modules — chain lightning ──────────────────
    if (this.gridManager) {
      const allMods = this.gridManager.getAllModules();
      for (const mod of allMods) {
        if (mod.type !== 'tesla' || !mod.connected || mod.destroyed) continue;
        mod.zapTimer = (mod.zapTimer || 0) - dt;
        if (mod.zapTimer <= 0) {
          const firstTarget = this.findNearestEnemyFrom(mod.x, mod.y, mod.zapRange);
          if (firstTarget) {
            // Build chain
            const chainPoints = [{ x: mod.x, y: mod.y }];
            const hit = new Set();
            let current = firstTarget;
            let chainDmg = mod.zapDamage;

            for (let c = 0; c < mod.chainCount && current; c++) {
              chainPoints.push({ x: current.x, y: current.y });
              const killed = current.takeDamage(chainDmg);
              hit.add(current);
              if (killed) this.enemyManager.killEnemy(current);

              chainDmg = Math.floor(chainDmg * 0.7); // 30% falloff per chain

              // Find next chain target
              let next = null;
              let nextDist = 60 * 60; // chain range 60px
              for (let j = 0; j < this.enemyManager.pool.length; j++) {
                const e = this.enemyManager.pool[j];
                if (!e.active || hit.has(e)) continue;
                const cdx = e.x - current.x;
                const cdy = e.y - current.y;
                const distSq = cdx * cdx + cdy * cdy;
                if (distSq < nextDist) {
                  nextDist = distSq;
                  next = e;
                }
              }
              current = next;
            }

            // Visual lightning arc
            this.lightningArcs.push({
              points: chainPoints,
              timer: 0.25,
              maxTimer: 0.25,
            });

            mod.zapTimer = mod.baseZapInterval;
          } else {
            mod.zapTimer = 0.3;
          }
        }
      }
    }

    // Update lightning arc timers
    for (let i = this.lightningArcs.length - 1; i >= 0; i--) {
      this.lightningArcs[i].timer -= dt;
      if (this.lightningArcs[i].timer <= 0) {
        this.lightningArcs.splice(i, 1);
      }
    }

    // Update projectiles
    for (let i = 0; i < this.projectiles.length; i++) {
      const p = this.projectiles[i];
      if (!p.active) continue;
      p.update(dt);
    }

    // Update flashes
    for (let i = 0; i < this.flashes.length; i++) {
      if (this.flashes[i].active) this.flashes[i].update(dt);
    }

    // Update boss projectiles (enemy → chip)
    for (let i = this.bossProjectiles.length - 1; i >= 0; i--) {
      const bp = this.bossProjectiles[i];
      if (!bp.active) {
        this.bossProjectiles.splice(i, 1);
        continue;
      }
      bp.update(dt);
      // Check collision with chip
      const dx = bp.x - this.chip.x;
      const dy = bp.y - this.chip.y;
      if (Math.abs(dx) < this.chip.bodyW / 2 + 4 && Math.abs(dy) < this.chip.bodyH / 2 + 4) {
        this.chip.takeDamage(bp.damage);
        bp.active = false;
        const flash = this.getFlash();
        flash.init(bp.x, bp.y);
        eventBus.emit('chipDamaged', bp.damage);
      }
    }

    // Check projectile-enemy collisions
    this.checkCollisions();
  }

  findBounceTarget(projectile, hitEnemy) {
    const rangeSq = projectile.bounceRange * projectile.bounceRange;
    let nearest = null;
    let nearestDist = rangeSq;

    for (let i = 0; i < this.enemyManager.pool.length; i++) {
      const e = this.enemyManager.pool[i];
      if (!e.active || e === hitEnemy || projectile.hitEnemies.includes(e)) continue;

      const dx = e.x - projectile.x;
      const dy = e.y - projectile.y;
      const distSq = dx * dx + dy * dy;

      if (distSq < nearestDist) {
        nearestDist = distSq;
        nearest = e;
      }
    }
    return nearest;
  }

  checkCollisions() {
    for (let i = 0; i < this.projectiles.length; i++) {
      const p = this.projectiles[i];
      if (!p.active) continue;

      for (let j = 0; j < this.enemyManager.pool.length; j++) {
        const e = this.enemyManager.pool[j];
        if (!e.active || p.hitEnemies.includes(e)) continue;

        const dx = p.x - e.x;
        const dy = p.y - e.y;
        const hitDist = (p.size + e.size) / 2;

        if (dx * dx + dy * dy < hitDist * hitDist) {
          // Hit
          const killed = e.takeDamage(p.damage);

          // Spawn hit flash
          const flash = this.getFlash();
          flash.init(p.x, p.y);

          // Try to bounce
          p.hitEnemies.push(e);
          // Piercing Protocol: projectile passes through enemies
          const pierce = this.xpSystem?.piercingProtocol;
          if (pierce && p.pierceCount === undefined) {
            p.pierceCount = 0;
          }

          if (pierce && p.pierceCount < pierce.pierceCount) {
            p.pierceCount++;
            p.damage = Math.floor(p.damage * (1 - pierce.damageFalloff));
            // Don't deactivate — projectile continues
          } else if (p.bouncesLeft > 0) {
            const bounceTarget = this.findBounceTarget(p, e);
            if (bounceTarget) {
              p.bouncesLeft--;
              p.damage += p.bounceDamageBonus;
              p.redirect(bounceTarget.x, bounceTarget.y);
            } else {
              p.active = false;
            }
          } else {
            p.active = false;
          }

          if (killed) {
            this.enemyManager.killEnemy(e);
          }

          break; // projectile is spent
        }
      }
    }
  }

  render(ctx, state) {
    if (state !== STATES.COMBAT && state !== STATES.LEVEL_UP && state !== STATES.BUILD_PHASE) return;

    // Projectiles — batch by color to reduce fillStyle switches
    let lastColor = '';
    for (let i = 0; i < this.projectiles.length; i++) {
      const p = this.projectiles[i];
      if (!p.active) continue;
      if (p.color !== lastColor) {
        lastColor = p.color;
        ctx.fillStyle = p.color;
      }
      p.render(ctx);
    }

    // Hit flashes
    for (let i = 0; i < this.flashes.length; i++) {
      if (this.flashes[i].active) this.flashes[i].render(ctx);
    }

    // Boss projectiles
    for (const bp of this.bossProjectiles) {
      if (bp.active) bp.render(ctx);
    }

    // Drones (tiny pixel planes)
    for (const d of this.drones) {
      ctx.save();
      ctx.translate(Math.floor(d.x), Math.floor(d.y));
      ctx.rotate(d.angle);

      // Shadow underneath
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(-2, 4, 5, 2);

      // Fuselage
      ctx.fillStyle = d.phase === 'bomb' ? '#ffdd00' : '#ff8800';
      ctx.fillRect(-2, -1, 6, 3);
      // Wings
      ctx.fillRect(-1, -4, 3, 9);
      // Tail
      ctx.fillRect(-4, -2, 3, 5);
      // Nose highlight
      ctx.fillStyle = '#ffcc66';
      ctx.fillRect(3, 0, 2, 1);

      ctx.restore();

      // Bomb flash
      if (d.phase === 'bomb') {
        const progress = 1 - d.bombTimer / 0.15;
        const r = d.splashRadius * progress;
        const a = (1 - progress) * 0.5;
        ctx.beginPath();
        ctx.arc(d.x, d.y, r, 0, TWO_PI);
        ctx.fillStyle = `rgba(255, 180, 50, ${a})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(255, 120, 30, ${a})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // Lightning arcs
    for (const arc of this.lightningArcs) {
      const alpha = arc.timer / arc.maxTimer;
      if (arc.points.length < 2) continue;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#44ddff';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#44ddff';
      ctx.shadowBlur = 8;

      // Draw jagged lightning between each pair of points
      for (let s = 0; s < arc.points.length - 1; s++) {
        const from = arc.points[s];
        const to = arc.points[s + 1];
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);

        // 3-4 jagged segments between each pair
        const segs = 3 + Math.floor(Math.random() * 2);
        for (let j = 1; j <= segs; j++) {
          const t = j / segs;
          const mx = from.x + (to.x - from.x) * t;
          const my = from.y + (to.y - from.y) * t;
          const jitter = j < segs ? (Math.random() - 0.5) * 12 : 0;
          ctx.lineTo(mx + jitter, my + jitter);
        }
        ctx.stroke();
      }

      // Bright core line (thinner, white)
      ctx.strokeStyle = 'rgba(200, 240, 255, 0.7)';
      ctx.lineWidth = 1;
      ctx.shadowBlur = 0;
      for (let s = 0; s < arc.points.length - 1; s++) {
        ctx.beginPath();
        ctx.moveTo(arc.points[s].x, arc.points[s].y);
        ctx.lineTo(arc.points[s + 1].x, arc.points[s + 1].y);
        ctx.stroke();
      }

      ctx.restore();
    }
  }
}
