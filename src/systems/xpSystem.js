import { CONFIG, STATES } from '../core/config.js';
import { eventBus } from '../core/eventBus.js';

const TWO_PI = Math.PI * 2;

export class XpSystem {
  constructor(game, chip) {
    this.game = game;
    this.chip = chip;

    this.xp = 0;
    this.level = 1;
    this.xpToNext = 5;

    // Error Correction regen
    this.regenActive = false;
    this.regenInterval = 5;
    this.regenAmount = 1;
    this.regenTimer = 0;
    this.regenModules = false;

    // Card inventory
    this.heldCards = {};

    // Resources
    this.resources = 0;

    // Card effect state
    this.ricochetUnlocked = false;
    this.resourceBonus = 0;       // Garbage Collection
    this.xpBonus = 0;             // Compiler Optimization
    this.adjacencyMultiplier = 1; // Overclocked Bus
    this.rerollsPerPick = 0;      // Reroll Protocol
    this.redundancyBonus = 0;     // Redundancy
    this.encryptionShield = null;  // Encryption Shield
    this.firewallPulse = null;     // Firewall Pulse
    this.bufferOverflow = null;    // Buffer Overflow
    this.synergies = {};           // Active synergy flags

    // New card effect state
    this.logicBombStrike = null;   // Logic Bomb Strike
    this.slowDrain = null;         // Slow Drain
    this.reactiveArmor = null;     // Reactive Armor
    this.integritySiphon = null;   // Integrity Siphon
    this.firewallHardening = 0;    // Firewall Hardening (pct reduction)
    this.countermeasure = null;    // Countermeasure
    this.cacheHit = null;          // Cache Hit
    this.threadPool = 0;           // Thread Pool (cooldown reduction pct)
    this.cascadeFailure = null;    // Cascade Failure
    this.piercingProtocol = null;  // Piercing Protocol
    this.relayAmplifier = 0;       // Relay Amplifier (flat dmg per relay)
    this.moduleOverclock = 0;      // Module Overclock (fire rate pct per module)
    this.quantumDoubleEffects = false; // Quantum chip variant flag

    eventBus.on('xpCollected', (value) => {
      this.addXp(Math.round(value * (1 + this.xpBonus)));
    });
    eventBus.on('resourceCollected', (value) => {
      this.resources += Math.round(value * (1 + this.resourceBonus));
    });

    // Reactive Armor: retaliatory pulse on chip damage
    eventBus.on('chipDamaged', () => {
      if (this.reactiveArmor) {
        eventBus.emit('reactiveArmorPulse', {
          x: this.chip.x,
          y: this.chip.y,
          radius: this.reactiveArmor.radius,
          damage: this.reactiveArmor.damage,
        });
      }
    });

    // Integrity Siphon: heal on kill
    eventBus.on('enemyKilled', (data) => {
      if (this.integritySiphon) {
        const heal = data.type === 'logic_bomb'
          ? this.integritySiphon.bossHeal
          : this.integritySiphon.healPerKill;
        this.chip.integrity = Math.min(
          this.chip.integrity + heal,
          this.chip.maxIntegrity
        );
      }
      // Cache Hit: bonus XP on kill interval
      if (this.cacheHit) {
        this.cacheHit.killCounter++;
        if (this.cacheHit.killCounter >= this.cacheHit.killInterval) {
          this.cacheHit.killCounter = 0;
          eventBus.emit('xpCollected', this.cacheHit.bonusXp);
        }
      }
    });
  }

  addXp(amount) {
    this.xp += amount;
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level++;
      this.xpToNext = 5 + (this.level - 1) * 3;
      this.game.setState(STATES.LEVEL_UP);
      eventBus.emit('levelUp', this.level);
    }
  }

  pickCard(cardDef, systems) {
    const currentLevel = this.heldCards[cardDef.id] || 0;
    const newLevel = currentLevel + 1;
    this.heldCards[cardDef.id] = newLevel;
    cardDef.apply(newLevel, systems);
    eventBus.emit('cardPicked', cardDef.id);
    this.game.setState(STATES.COMBAT);
  }

  update(dt, state) {
    if (state !== STATES.COMBAT) return;

    // Regen (chip)
    if (this.regenActive) {
      this.regenTimer += dt;
      if (this.regenTimer >= this.regenInterval) {
        this.regenTimer -= this.regenInterval;
        this.chip.integrity = Math.min(
          this.chip.integrity + this.regenAmount,
          this.chip.maxIntegrity
        );

        // Heal modules too if L2+
        if (this.regenModules && this.game.systems) {
          // Modules are on gridManager — access via systems reference
          eventBus.emit('regenModules', this.regenAmount);
        }
      }
    }

    // Firewall Pulse
    if (this.firewallPulse) {
      const fp = this.firewallPulse;
      const cdMult = 1 - this.threadPool;
      fp.timer += dt;
      if (fp.timer >= fp.cooldown * cdMult) {
        fp.timer -= fp.cooldown * cdMult;
        eventBus.emit('firewallPulse', {
          x: this.chip.x,
          y: this.chip.y,
          radius: fp.radius,
          damage: fp.damage,
          knockback: fp.knockback,
        });
      }
    }

    // Logic Bomb Strike — targeted AOE at nearest enemy
    if (this.logicBombStrike) {
      const lb = this.logicBombStrike;
      const cdMult = 1 - this.threadPool;
      lb.timer += dt;
      if (lb.timer >= lb.cooldown * cdMult) {
        lb.timer -= lb.cooldown * cdMult;
        eventBus.emit('logicBombStrike', {
          damage: lb.damage,
          radius: lb.radius,
        });
      }
    }

    // Slow Drain — aura effect handled by enemyManager via event check
    // (enemyManager reads xpSystem.slowDrain directly)

    // Countermeasure — defense module pulse
    if (this.countermeasure) {
      const cm = this.countermeasure;
      const cdMult = 1 - this.threadPool;
      cm.timer += dt;
      if (cm.timer >= cm.cooldown * cdMult) {
        cm.timer -= cm.cooldown * cdMult;
        eventBus.emit('countermeasurePulse', {
          damage: cm.damage,
          range: cm.range,
        });
      }
    }
  }

  reset() {
    this.xp = 0;
    this.level = 1;
    this.xpToNext = 5;
    this.regenActive = false;
    this.regenInterval = 5;
    this.regenAmount = 1;
    this.regenTimer = 0;
    this.regenModules = false;
    this.heldCards = {};
    this.ricochetUnlocked = false;
    this.resources = 0;
    this.resourceBonus = 0;
    this.xpBonus = 0;
    this.adjacencyMultiplier = 1;
    this.rerollsPerPick = 0;
    this.redundancyBonus = 0;
    this.encryptionShield = null;
    this.firewallPulse = null;
    this.bufferOverflow = null;
    this.synergies = {};
    this.logicBombStrike = null;
    this.slowDrain = null;
    this.reactiveArmor = null;
    this.integritySiphon = null;
    this.firewallHardening = 0;
    this.countermeasure = null;
    this.cacheHit = null;
    this.threadPool = 0;
    this.cascadeFailure = null;
    this.piercingProtocol = null;
    this.bandwidthUpgrade = 0;
    this.relayAmplifier = 0;
    this.moduleOverclock = 0;
    this.quantumDoubleEffects = false;
  }
}
