import { eventBus } from '../core/eventBus.js';

const SAVE_KEY = 'circuitSurvivors_meta';

const STARTING_CARDS = ['ping_burst_plus', 'damage_boost', 'range_boost', 'error_correction'];

const ATTACK_CARD_IDS = [
  'ping_burst_plus', 'data_spike', 'firewall_pulse', 'trace_route',
  'buffer_overflow', 'rapid_packets', 'multi_turret', 'ricochet',
  'ricochet_damage', 'damage_boost', 'range_boost',
  'packet_storm', 'logic_bomb_strike', 'piercing_protocol',
  'cascade_failure', 'slow_drain',
];

// ── Achievement Definitions ─────────────────────────────────
// Each achievement unlocks a card. check(stats) runs at end of run.
export const ACHIEVEMENTS = [
  // Time survived
  { id: 'survive_2min', name: 'Warming Up', desc: 'Survive 2 minutes', check: s => s.time >= 120, unlocks: 'data_spike' },
  { id: 'survive_3min', name: 'Getting Started', desc: 'Survive 3 minutes', check: s => s.time >= 180, unlocks: 'firewall_pulse' },
  { id: 'survive_5min', name: 'Holding Steady', desc: 'Survive 5 minutes', check: s => s.time >= 300, unlocks: 'trace_route' },
  { id: 'survive_7min', name: 'Deep Run', desc: 'Survive 7 minutes', check: s => s.time >= 420, unlocks: 'slow_drain' },
  { id: 'survive_8min', name: 'Endurance', desc: 'Survive 8 minutes', check: s => s.time >= 480, unlocks: 'logic_bomb_strike' },
  { id: 'survive_10min', name: 'Marathon', desc: 'Survive 10 minutes', check: s => s.time >= 600, unlocks: 'thread_pool' },

  // Kills
  { id: 'kill_50', name: 'First Blood', desc: 'Kill 50 enemies', check: s => s.kills >= 50, unlocks: 'garbage_collection' },
  { id: 'kill_100', name: 'Hunter', desc: 'Kill 100 enemies', check: s => s.kills >= 100, unlocks: 'ricochet' },
  { id: 'kill_150', name: 'Sharpshooter', desc: 'Kill 150 enemies', check: s => s.kills >= 150, unlocks: 'piercing_protocol' },
  { id: 'kill_200', name: 'Massacre', desc: 'Kill 200 enemies', check: s => s.kills >= 200, unlocks: 'buffer_overflow' },
  { id: 'kill_500_life', name: 'Veteran', desc: '500 lifetime kills', check: s => s.lifetimeKills >= 500, unlocks: 'cache_hit' },

  // Modules
  { id: 'build_5', name: 'Builder', desc: 'Place 5 modules', check: s => s.modules >= 5, unlocks: 'redundancy' },
  { id: 'build_8', name: 'Architect', desc: 'Place 8 modules', check: s => s.modules >= 8, unlocks: 'firewall_hardening' },
  { id: 'build_10', name: 'Grid Master', desc: 'Place 10 modules', check: s => s.modules >= 10, unlocks: 'overclocked_bus' },
  { id: 'build_3_relay', name: 'Connected', desc: 'Place 3 relays', check: s => s.relays >= 3, unlocks: 'relay_amplifier' },
  { id: 'build_3_def', name: 'Fortress', desc: 'Place 3 defense modules', check: s => s.defenses >= 3, unlocks: 'countermeasure' },
  { id: 'connected_6', name: 'Network', desc: '6 connected modules', check: s => s.connected >= 6, unlocks: 'module_overclock' },

  // Level
  { id: 'level_5', name: 'Leveling Up', desc: 'Reach level 5', check: s => s.level >= 5, unlocks: 'compiler_optimization' },
  { id: 'level_8', name: 'Powered Up', desc: 'Reach level 8', check: s => s.level >= 8, unlocks: 'packet_storm' },

  // Cards
  { id: 'cards_3_atk', name: 'Arsenal', desc: 'Hold 3 attack cards', check: s => s.atkCards >= 3, unlocks: 'rapid_packets' },
  { id: 'cards_5', name: 'Collector', desc: 'Hold 5 different cards', check: s => s.cardsHeld >= 5, unlocks: 'multi_turret' },
  { id: 'cards_10', name: 'Hoarder', desc: 'Pick 10 cards', check: s => s.cardsHeld >= 10, unlocks: 'reroll_protocol' },
  { id: 'have_bo', name: 'Chain Reaction', desc: 'Have Buffer Overflow', check: s => s.hasBO, unlocks: 'cascade_failure' },
  { id: 'rico_l2', name: 'Amplifier', desc: 'Ricochet level 2+', check: s => s.ricoLvl >= 2, unlocks: 'ricochet_damage' },

  // Combat / boss
  { id: 'boss_kill', name: 'Defused', desc: 'Kill a Logic Bomb', check: s => s.bosses >= 1, unlocks: 'encryption_shield' },
  { id: 'boss_low', name: 'Close Call', desc: 'Kill boss below 50% HP', check: s => s.bossLow, unlocks: 'integrity_siphon' },
  { id: 'dmg_100', name: 'Battle Scarred', desc: 'Take 100 damage', check: s => s.dmgTaken >= 100, unlocks: 'max_integrity' },
  { id: 'dmg_200', name: 'Punching Bag', desc: 'Take 200 damage', check: s => s.dmgTaken >= 200, unlocks: 'reactive_armor' },
];

// ── Permanent Upgrade Definitions ───────────────────────────
export const UPGRADE_DEFS = [
  { id: 'maxIntegrity', name: 'Max Integrity', desc: '+5% chip HP', maxLevel: 10, baseCost: 5 },
  { id: 'startingResources', name: 'Start Resources', desc: '+5 resources', maxLevel: 10, baseCost: 3 },
  { id: 'cardQuality', name: 'Card Quality', desc: '+2% rare chance', maxLevel: 10, baseCost: 8 },
  { id: 'moduleDurability', name: 'Module HP', desc: '+5% module HP', maxLevel: 10, baseCost: 6 },
  { id: 'xpGain', name: 'XP Gain', desc: '+5% XP', maxLevel: 10, baseCost: 4 },
];

// ── Default save data ───────────────────────────────────────
function defaultSave() {
  return {
    unlockedCards: [...STARTING_CARDS],
    chipVariant: 'standard',
    permanentUpgrades: { maxIntegrity: 0, startingResources: 0, cardQuality: 0, moduleDurability: 0, xpGain: 0 },
    lifetimeStats: { totalRuns: 0, bestTime: 0, totalKills: 0, totalModulesBuilt: 0, totalCardsCollected: 0 },
    completedAchievements: [],
    discoveredSynergies: [],
    metaCurrency: 0,
  };
}

// ── MetaProgression System ──────────────────────────────────
export class MetaProgression {
  constructor() {
    this.data = this.load();
    this.chip = null; // set externally

    // Per-run tracking (reset each run)
    this.runActive = false;
    this.runBosses = 0;
    this.runBossLow = false;
    this.runDmg = 0;
    this.runRes = 0;

    eventBus.on('bossKilled', () => {
      if (!this.runActive) return;
      this.runBosses++;
      if (this.chip && this.chip.integrity / this.chip.maxIntegrity < 0.5) {
        this.runBossLow = true;
      }
    });

    eventBus.on('chipDamaged', (amount) => {
      if (!this.runActive) return;
      this.runDmg += amount;
    });

    eventBus.on('resourceCollected', (value) => {
      if (!this.runActive) return;
      this.runRes += value;
    });

    // Track synergy discoveries persistently
    eventBus.on('synergyActivated', (synergyId) => {
      if (!this.data.discoveredSynergies) this.data.discoveredSynergies = [];
      if (!this.data.discoveredSynergies.includes(synergyId)) {
        this.data.discoveredSynergies.push(synergyId);
        this.save();
      }
    });
  }

  // ── Persistence ─────────────────────────────────────────
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return defaultSave();
      const saved = JSON.parse(raw);
      const def = defaultSave();
      return {
        ...def, ...saved,
        permanentUpgrades: { ...def.permanentUpgrades, ...(saved.permanentUpgrades || {}) },
        lifetimeStats: { ...def.lifetimeStats, ...(saved.lifetimeStats || {}) },
      };
    } catch { return defaultSave(); }
  }

  save() { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); }

  resetSave() { this.data = defaultSave(); this.save(); }

  // ── Card unlock queries ─────────────────────────────────
  isCardUnlocked(cardId) { return this.data.unlockedCards.includes(cardId); }

  // ── Upgrade queries ─────────────────────────────────────
  getUpgradeLevel(id) { return this.data.permanentUpgrades[id] || 0; }

  getUpgradeCost(id) {
    const def = UPGRADE_DEFS.find(u => u.id === id);
    if (!def) return Infinity;
    const level = this.getUpgradeLevel(id);
    if (level >= def.maxLevel) return Infinity;
    return def.baseCost * (level + 1);
  }

  buyUpgrade(id) {
    const cost = this.getUpgradeCost(id);
    if (this.data.metaCurrency < cost) return false;
    this.data.metaCurrency -= cost;
    this.data.permanentUpgrades[id]++;
    this.save();
    return true;
  }

  // ── Run lifecycle ───────────────────────────────────────
  startRun() {
    this.runActive = true;
    this.runBosses = 0;
    this.runBossLow = false;
    this.runDmg = 0;
    this.runRes = 0;
  }

  /** Call at end of run. Returns summary object for the run screen. */
  endRun(systems) {
    this.runActive = false;
    const { enemyManager, xpSystem, gridManager } = systems;

    const time = enemyManager.elapsedTime;
    const kills = enemyManager.totalKills;
    const level = xpSystem.level;
    const held = xpSystem.heldCards;
    const cardsHeld = Object.keys(held).length;
    const mods = gridManager.getAllModules();
    const connected = mods.filter(m => m.connected).length;
    const modules = gridManager.totalModulesPlaced || mods.length;
    const relays = mods.filter(m => m.type === 'relay').length;
    const defenses = mods.filter(m => m.type === 'defense').length;
    let atkCards = 0;
    for (const id of ATTACK_CARD_IDS) { if ((held[id] || 0) > 0) atkCards++; }

    const stats = {
      time, kills, level, cardsHeld, atkCards,
      modules, relays, defenses, connected,
      lifetimeKills: this.data.lifetimeStats.totalKills + kills,
      bosses: this.runBosses,
      bossLow: this.runBossLow,
      dmgTaken: this.runDmg,
      ricoLvl: held['ricochet'] || 0,
      hasBO: (held['buffer_overflow'] || 0) > 0,
    };

    // Check achievements
    const newUnlocks = [];
    for (const ach of ACHIEVEMENTS) {
      if (this.data.completedAchievements.includes(ach.id)) continue;
      try {
        if (ach.check(stats)) {
          this.data.completedAchievements.push(ach.id);
          if (ach.unlocks && !this.data.unlockedCards.includes(ach.unlocks)) {
            this.data.unlockedCards.push(ach.unlocks);
            newUnlocks.push(ach);
          }
        }
      } catch { /* skip broken check */ }
    }

    // Meta currency: 1 per 30s survived, 0.1 per kill, 2 per boss, +5 for new best
    const timeCurrency = Math.floor(time / 30);
    const killCurrency = Math.floor(kills * 0.1);
    const bossCurrency = this.runBosses * 2;
    const isNewBest = time > this.data.lifetimeStats.bestTime;
    const bestBonus = isNewBest ? 5 : 0;
    const totalCurrency = timeCurrency + killCurrency + bossCurrency + bestBonus;

    this.data.metaCurrency += totalCurrency;

    // Lifetime stats
    this.data.lifetimeStats.totalRuns++;
    this.data.lifetimeStats.totalKills += kills;
    this.data.lifetimeStats.totalModulesBuilt += modules;
    this.data.lifetimeStats.totalCardsCollected += cardsHeld;
    if (isNewBest) this.data.lifetimeStats.bestTime = time;

    this.save();

    return {
      stats, newUnlocks, isNewBest,
      currency: totalCurrency,
      breakdown: { time: timeCurrency, kills: killCurrency, bosses: bossCurrency, best: bestBonus },
    };
  }

  /** Apply permanent upgrades at start of run */
  applyUpgrades(systems) {
    const { chip, xpSystem } = systems;
    const u = this.data.permanentUpgrades;

    if (u.maxIntegrity > 0) {
      chip.maxIntegrity = Math.floor(chip.maxIntegrity * (1 + u.maxIntegrity * 0.05));
      chip.integrity = chip.maxIntegrity;
    }
    if (u.startingResources > 0) {
      xpSystem.resources = u.startingResources * 5;
    }
    if (u.xpGain > 0) {
      xpSystem.xpBonus += u.xpGain * 0.05;
    }
  }

  // ── Chip variant ───────────────────────────────────────
  getSelectedVariant() { return this.data.chipVariant || 'standard'; }
  selectVariant(id) { this.data.chipVariant = id; this.save(); }

  getCardQualityBonus() { return this.data.permanentUpgrades.cardQuality * 2; }
  getModuleDurabilityBonus() { return this.data.permanentUpgrades.moduleDurability * 0.05; }

  formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }
}
