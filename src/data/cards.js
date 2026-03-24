export const RARITY = {
  COMMON: 'common',
  UNCOMMON: 'uncommon',
  RARE: 'rare',
  LEGENDARY: 'legendary',
};

export const RARITY_COLORS = {
  common: '#777788',
  uncommon: '#ffd700',
  rare: '#00aaff',
  legendary: '#ff00ff',
  synergy: '#cc44ff',
};

// Base rarity weights (used at higher levels)
export const RARITY_WEIGHTS = {
  common: 55,
  uncommon: 35,
  rare: 10,
  legendary: 0, // legendaries only from synergies / special
};

/**
 * Level-scaled rarity weights.
 * - Levels 1-2: Commons only (no rare cards yet)
 * - Levels 3-4: Uncommons start appearing, rare still locked
 * - Level 5+: Rare unlocks at reduced weight, scales toward full weight by level 10
 * - Uncommon weight ramps from 10 at level 3 to full 35 by level 7
 */
export function getRarityWeights(level) {
  if (level <= 2) {
    return { common: 100, uncommon: 0, rare: 0, legendary: 0 };
  }
  if (level <= 4) {
    // Uncommon unlocks at 3, ramps up
    const uncommonW = 10 + (level - 3) * 8; // 10 at L3, 18 at L4
    return { common: 100 - uncommonW, uncommon: uncommonW, rare: 0, legendary: 0 };
  }
  // Level 5+: rare unlocks and ramps
  const rareRamp = Math.min(1, (level - 5) / 5); // 0→1 over levels 5-10
  const rareW = Math.round(2 + 8 * rareRamp);     // 2 at L5, 10 at L10+
  const uncommonW = 35;
  const commonW = 100 - uncommonW - rareW;
  return { common: commonW, uncommon: uncommonW, rare: rareW, legendary: 0 };
}

export const CARD_DEFS = [
  // ══════════════════════════════════════════════════════════
  // ATTACK CARDS
  // ══════════════════════════════════════════════════════════
  {
    id: 'ping_burst_plus',
    name: 'Ping Burst+',
    rarity: RARITY.COMMON,
    maxLevel: Infinity,
    getDescription(level) {
      const boost = Math.round((1 - 1 / (1 + level * 0.15)) * 100);
      return `+${boost}% Ping Burst fire rate`;
    },
    apply(level, systems) {
      const pb = systems.attackSystem.attacks.find(a => a.name === 'Ping Burst');
      if (pb) pb.fireRate = 3 * (1 + level * 0.15);
    },
  },
  {
    id: 'data_spike',
    name: 'Data Spike',
    rarity: RARITY.COMMON,
    maxLevel: Infinity,
    getDescription(level) {
      const dmg = 10 + level * 3;
      const rate = (0.6 + level * 0.2).toFixed(1);
      return `Heavy projectile. ${dmg} dmg, ${rate}/sec`;
    },
    apply(level, systems) {
      const existing = systems.attackSystem.attacks.find(a => a.name === 'Data Spike');
      const damage = 10 + level * 3;
      const fireRate = 0.6 + level * 0.2;
      if (existing) {
        existing.damage = damage;
        existing.fireRate = fireRate;
      } else {
        systems.attackSystem.attacks.push(
          systems.attackSystem.createAttack({
            name: 'Data Spike', fireRate, damage,
            speed: 150, range: 180, size: 5, color: '#00aaff',
          })
        );
      }
    },
  },
  {
    id: 'firewall_pulse',
    name: 'Firewall Pulse',
    rarity: RARITY.UNCOMMON,
    maxLevel: Infinity,
    getDescription(level) {
      const dmg = 6 + level * 2;
      const radius = 80 + level * 20;
      const cd = Math.max(0.8, 2 - level * 0.15).toFixed(1);
      return `Circular wave. ${dmg} dmg, ${radius}px, ${cd}s cd`;
    },
    apply(level, systems) {
      systems.xpSystem.firewallPulse = {
        damage: 6 + level * 2,
        radius: 80 + level * 20,
        cooldown: Math.max(0.8, 2 - level * 0.15),
        knockback: level >= 2 ? 30 + (level - 2) * 10 : 0,
        timer: 0,
      };
    },
  },
  {
    id: 'trace_route',
    name: 'Trace Route',
    rarity: RARITY.UNCOMMON,
    maxLevel: Infinity,
    getDescription(level) {
      const chains = 2 + level;
      const dmg = 5 + level;
      return `Bouncing bolt. ${dmg} dmg, chains ${chains} targets`;
    },
    apply(level, systems) {
      const existing = systems.attackSystem.attacks.find(a => a.name === 'Trace Route');
      const damage = 5 + level;
      const chains = 2 + level;
      if (existing) {
        existing.damage = damage;
        existing.bounces = chains;
        existing.bounceDamageBonus = Math.floor(level / 2);
      } else {
        systems.attackSystem.attacks.push(
          systems.attackSystem.createAttack({
            name: 'Trace Route', fireRate: 1.2, damage,
            speed: 250, range: 180, size: 3, color: '#aa55ff',
            bounces: chains, bounceDamageBonus: 0,
          })
        );
      }
    },
  },
  {
    id: 'buffer_overflow',
    name: 'Buffer Overflow',
    rarity: RARITY.RARE,
    maxLevel: Infinity,
    getDescription(level) {
      const range = 40 + level * 15;
      const dmg = 4 + level * 2;
      return `Enemies explode on death. ${dmg} dmg, ${range}px range`;
    },
    apply(level, systems) {
      systems.xpSystem.bufferOverflow = {
        range: 40 + level * 15,
        damage: 4 + level * 2,
        chain: level >= 3,
      };
    },
  },
  {
    id: 'rapid_packets',
    name: 'Rapid Packets',
    rarity: RARITY.UNCOMMON,
    maxLevel: Infinity,
    getDescription(level) {
      return `Ping Burst fires ${1 + level} parallel projectiles`;
    },
    apply(level, systems) {
      const pb = systems.attackSystem.attacks.find(a => a.name === 'Ping Burst');
      if (pb) pb.projectilesPerShot = 1 + level;
    },
  },
  {
    id: 'multi_turret',
    name: 'Multi-Turret',
    rarity: RARITY.UNCOMMON,
    maxLevel: Infinity,
    getDescription(level) {
      return `Ping Burst targets ${1 + level} enemies at once`;
    },
    apply(level, systems) {
      const pb = systems.attackSystem.attacks.find(a => a.name === 'Ping Burst');
      if (pb) pb.turretCount = 1 + level;
    },
  },
  {
    id: 'ricochet',
    name: 'Ricochet',
    rarity: RARITY.UNCOMMON,
    maxLevel: Infinity,
    getDescription(level) {
      return `Projectiles bounce to ${level} nearby ${level === 1 ? 'enemy' : 'enemies'}`;
    },
    apply(level, systems) {
      for (const a of systems.attackSystem.attacks) a.bounces = Math.max(a.bounces, level);
      systems.xpSystem.ricochetUnlocked = true;
    },
  },
  {
    id: 'ricochet_damage',
    name: 'Bounce Amplifier',
    rarity: RARITY.RARE,
    maxLevel: Infinity,
    requires: 'ricochet',
    getDescription(level) {
      return `+${level * 2} damage per bounce`;
    },
    apply(level, systems) {
      for (const a of systems.attackSystem.attacks) a.bounceDamageBonus = level * 2;
    },
  },
  {
    id: 'damage_boost',
    name: 'Overclock',
    rarity: RARITY.COMMON,
    maxLevel: Infinity,
    getDescription(level) {
      return `+${level * 2} base damage to all attacks`;
    },
    apply(level, systems) {
      for (const a of systems.attackSystem.attacks) a.flatDamageBonus = level * 2;
    },
  },
  {
    id: 'range_boost',
    name: 'Signal Boost',
    rarity: RARITY.COMMON,
    maxLevel: Infinity,
    getDescription(level) {
      return `+${level * 20}px signal & attack range`;
    },
    apply(level, systems) {
      const boost = level * 20;
      systems.chip.signalRange = 150 + boost;
      systems.chip.attackRange = 180 + boost;
      for (const a of systems.attackSystem.attacks) a.range = 180 + boost;
    },
  },

  // ══════════════════════════════════════════════════════════
  // DEFENSE CARDS
  // ══════════════════════════════════════════════════════════
  {
    id: 'error_correction',
    name: 'Error Correction',
    rarity: RARITY.COMMON,
    maxLevel: Infinity,
    getDescription(level) {
      const amt = Math.ceil(level / 2);
      const interval = Math.max(1, 5 - level * 0.5).toFixed(1);
      return `Regen ${amt} integrity every ${interval}s (chip + modules)`;
    },
    apply(level, systems) {
      systems.xpSystem.regenInterval = Math.max(1, 5 - level * 0.5);
      systems.xpSystem.regenAmount = Math.ceil(level / 2);
      systems.xpSystem.regenActive = true;
      systems.xpSystem.regenModules = level >= 2; // L2+: also heals modules
    },
  },
  {
    id: 'max_integrity',
    name: 'Hardened Core',
    rarity: RARITY.COMMON,
    maxLevel: Infinity,
    getDescription(level) {
      return `+${level * 15} max chip integrity`;
    },
    apply(level, systems) {
      systems.chip.maxIntegrity = 100 + level * 15;
      systems.chip.integrity = Math.min(systems.chip.integrity + 15, systems.chip.maxIntegrity);
    },
  },
  {
    id: 'redundancy',
    name: 'Redundancy',
    rarity: RARITY.COMMON,
    maxLevel: Infinity,
    getDescription(level) {
      return `All modules +${level * 20}% max integrity`;
    },
    apply(level, systems) {
      systems.xpSystem.redundancyBonus = level * 0.20;
    },
  },
  {
    id: 'encryption_shield',
    name: 'Encryption Shield',
    rarity: RARITY.RARE,
    maxLevel: Infinity,
    getDescription(level) {
      const absorb = 15 + level * 10;
      const reflect = level >= 3 ? Math.floor((level - 2) * 5) : 0;
      return `Outermost modules absorb ${absorb} dmg${reflect > 0 ? `, reflect ${reflect}%` : ''}`;
    },
    apply(level, systems) {
      systems.xpSystem.encryptionShield = {
        absorb: 15 + level * 10,
        reflectPct: level >= 3 ? (level - 2) * 0.05 : 0,
      };
    },
  },

  // ══════════════════════════════════════════════════════════
  // UTILITY CARDS
  // ══════════════════════════════════════════════════════════
  {
    id: 'garbage_collection',
    name: 'Garbage Collection',
    rarity: RARITY.COMMON,
    maxLevel: Infinity,
    getDescription(level) {
      return `+${level * 15}% resource drops`;
    },
    apply(level, systems) {
      systems.xpSystem.resourceBonus = level * 0.15;
    },
  },
  {
    id: 'compiler_optimization',
    name: 'Compiler Opt.',
    rarity: RARITY.COMMON,
    maxLevel: Infinity,
    getDescription(level) {
      return `+${level * 10}% XP gain`;
    },
    apply(level, systems) {
      systems.xpSystem.xpBonus = level * 0.10;
    },
  },
  {
    id: 'overclocked_bus',
    name: 'Overclocked Bus',
    rarity: RARITY.UNCOMMON,
    maxLevel: Infinity,
    getDescription(level) {
      return `Module adjacency bonuses x${1 + level}`;
    },
    apply(level, systems) {
      systems.xpSystem.adjacencyMultiplier = 1 + level;
    },
  },
  {
    id: 'reroll_protocol',
    name: 'Reroll Protocol',
    rarity: RARITY.UNCOMMON,
    maxLevel: Infinity,
    getDescription(level) {
      return `${level} reroll${level > 1 ? 's' : ''} per card pick`;
    },
    apply(level, systems) {
      systems.xpSystem.rerollsPerPick = level;
    },
  },

  // ══════════════════════════════════════════════════════════
  // NEW ATTACK CARDS
  // ══════════════════════════════════════════════════════════
  {
    id: 'packet_storm',
    name: 'Packet Storm',
    rarity: RARITY.UNCOMMON,
    maxLevel: Infinity,
    getDescription(level) {
      const count = 3 + level;
      const arc = 60 + level * 10;
      return `Burst of ${count} projectiles in ${arc}° arc`;
    },
    apply(level, systems) {
      const existing = systems.attackSystem.attacks.find(a => a.name === 'Packet Storm');
      const count = 3 + level;
      const arc = 60 + level * 10;
      const damage = 3 + level;
      if (existing) {
        existing.projectilesPerShot = count;
        existing.spreadArc = arc;
        existing.damage = damage;
      } else {
        const atk = systems.attackSystem.createAttack({
          name: 'Packet Storm', fireRate: 1.5, damage,
          speed: 180, range: 160, size: 3, color: '#55ccff',
        });
        atk.projectilesPerShot = count;
        atk.spreadArc = arc;
        systems.attackSystem.attacks.push(atk);
      }
    },
  },
  {
    id: 'logic_bomb_strike',
    name: 'Logic Bomb Strike',
    rarity: RARITY.RARE,
    maxLevel: Infinity,
    getDescription(level) {
      const dmg = 12 + level * 4;
      const radius = 50 + level * 15;
      return `Targeted AOE. ${dmg} dmg, ${radius}px radius, 3s cd`;
    },
    apply(level, systems) {
      systems.xpSystem.logicBombStrike = {
        damage: 12 + level * 4,
        radius: 50 + level * 15,
        cooldown: Math.max(1.5, 3 - level * 0.2),
        timer: 0,
      };
    },
  },
  {
    id: 'piercing_protocol',
    name: 'Piercing Protocol',
    rarity: RARITY.UNCOMMON,
    maxLevel: Infinity,
    getDescription(level) {
      const falloff = 30 + level * 5;
      return `Projectiles pierce ${level} enemies, -${falloff}% dmg per pierce`;
    },
    apply(level, systems) {
      systems.xpSystem.piercingProtocol = {
        pierceCount: level,
        damageFalloff: (30 + level * 5) / 100,
      };
    },
  },
  {
    id: 'cascade_failure',
    name: 'Cascade Failure',
    rarity: RARITY.RARE,
    maxLevel: Infinity,
    getDescription(level) {
      const bonus = 50 + level * 25;
      return `AOE kills deal +${bonus}% bonus death explosion dmg`;
    },
    apply(level, systems) {
      systems.xpSystem.cascadeFailure = {
        bonusPct: (50 + level * 25) / 100,
      };
    },
  },
  {
    id: 'slow_drain',
    name: 'Slow Drain',
    rarity: RARITY.UNCOMMON,
    maxLevel: Infinity,
    getDescription(level) {
      const range = 60 + level * 15;
      const dps = 1 + level;
      const slow = 10 + level * 3;
      return `Enemies within ${range}px: ${dps} dps, -${slow}% speed`;
    },
    apply(level, systems) {
      systems.xpSystem.slowDrain = {
        range: 60 + level * 15,
        dps: 1 + level,
        slowPct: (10 + level * 3) / 100,
      };
    },
  },

  // ══════════════════════════════════════════════════════════
  // NEW DEFENSE CARDS
  // ══════════════════════════════════════════════════════════
  {
    id: 'reactive_armor',
    name: 'Reactive Armor',
    rarity: RARITY.UNCOMMON,
    maxLevel: Infinity,
    getDescription(level) {
      const dmg = 3 + level * 2;
      const radius = 40 + level * 15;
      return `On chip damage: pulse ${dmg} dmg in ${radius}px`;
    },
    apply(level, systems) {
      systems.xpSystem.reactiveArmor = {
        damage: 3 + level * 2,
        radius: 40 + level * 15,
      };
    },
  },
  {
    id: 'integrity_siphon',
    name: 'Integrity Siphon',
    rarity: RARITY.RARE,
    maxLevel: Infinity,
    getDescription(level) {
      const heal = level;
      const bossHeal = level * 5;
      return `Kills restore ${heal} integrity. Bosses: ${bossHeal}`;
    },
    apply(level, systems) {
      systems.xpSystem.integritySiphon = {
        healPerKill: level,
        bossHeal: level * 5,
      };
    },
  },
  {
    id: 'firewall_hardening',
    name: 'Firewall Hardening',
    rarity: RARITY.COMMON,
    maxLevel: 10,
    getDescription(level) {
      const pct = Math.min(80, level * 8);
      return `Modules take ${pct}% less damage`;
    },
    apply(level, systems) {
      systems.xpSystem.firewallHardening = Math.min(0.80, level * 0.08);
    },
  },
  {
    id: 'countermeasure',
    name: 'Countermeasure',
    rarity: RARITY.UNCOMMON,
    maxLevel: Infinity,
    getDescription(level) {
      const dmg = 2 + level;
      const cd = Math.max(0.8, 3 - level * 0.3).toFixed(1);
      const range = 30 + level * 10;
      return `Defense modules pulse ${dmg} dmg every ${cd}s in ${range}px`;
    },
    apply(level, systems) {
      systems.xpSystem.countermeasure = {
        damage: 2 + level,
        cooldown: Math.max(0.8, 3 - level * 0.3),
        range: 30 + level * 10,
        timer: 0,
      };
    },
  },

  // ══════════════════════════════════════════════════════════
  // NEW UTILITY CARDS
  // ══════════════════════════════════════════════════════════
  {
    id: 'cache_hit',
    name: 'Cache Hit',
    rarity: RARITY.UNCOMMON,
    maxLevel: Infinity,
    getDescription(level) {
      const interval = Math.max(5, 15 - level * 2);
      const bonus = 3 + level * 2;
      return `Every ${interval} kills: bonus ${bonus} XP orb`;
    },
    apply(level, systems) {
      systems.xpSystem.cacheHit = {
        killInterval: Math.max(5, 15 - level * 2),
        bonusXp: 3 + level * 2,
        killCounter: systems.xpSystem.cacheHit ? systems.xpSystem.cacheHit.killCounter : 0,
      };
    },
  },
  {
    id: 'thread_pool',
    name: 'Thread Pool',
    rarity: RARITY.RARE,
    maxLevel: 7,
    getDescription(level) {
      const pct = Math.min(70, level * 10);
      return `All cooldown abilities ${pct}% faster`;
    },
    apply(level, systems) {
      systems.xpSystem.threadPool = Math.min(0.70, level * 0.10);
    },
  },

  // ══════════════════════════════════════════════════════════
  // NEW GRID/MODULE CARDS
  // ══════════════════════════════════════════════════════════
  {
    id: 'relay_amplifier',
    name: 'Relay Amplifier',
    rarity: RARITY.UNCOMMON,
    maxLevel: Infinity,
    getDescription(level) {
      const dmg = 3 + level;
      return `+${dmg} flat damage per connected relay module`;
    },
    apply(level, systems) {
      systems.xpSystem.relayAmplifier = 3 + level;
    },
  },
  {
    id: 'module_overclock',
    name: 'Module Overclock',
    rarity: RARITY.RARE,
    maxLevel: Infinity,
    getDescription(level) {
      const pct = 5 + level * 3;
      return `Attack modules +${pct}% fire rate per total connected module`;
    },
    apply(level, systems) {
      systems.xpSystem.moduleOverclock = (5 + level * 3) / 100;
    },
  },
];
