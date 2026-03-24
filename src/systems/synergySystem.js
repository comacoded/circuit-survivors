import { eventBus } from '../core/eventBus.js';

// ── Synergy Definitions ─────────────────────────────────────
export const SYNERGY_DEFS = [
  {
    id: 'botnet',
    name: 'Botnet',
    rarity: 'rare',
    description: 'All Attack modules fire Ping Bursts independently',
    condition(sys) {
      const attackMods = sys.gridManager.getAllModules().filter(m => m.type === 'attack' && m.connected);
      const hasPingBurst = (sys.xpSystem.heldCards['ping_burst_plus'] || 0) > 0;
      return attackMods.length >= 4 && hasPingBurst;
    },
    apply(sys) {
      sys.xpSystem.synergies.botnet = true;
      // Attack modules already fire via attackSystem — botnet doubles their fire rate
      // and makes them use the chip's Ping Burst stats
    },
  },
  {
    id: 'iron_curtain',
    name: 'Iron Curtain',
    rarity: 'rare',
    description: 'Defense ring: all Defense +50% integrity, reflect 10% dmg',
    condition(sys) {
      // Check all 8 tiles around chip [5,5] are Defense modules
      const chipCol = sys.chip.gridCol;
      const chipRow = sys.chip.gridRow;
      const offsets = [
        [-1,-1],[0,-1],[1,-1],
        [-1, 0],       [1, 0],
        [-1, 1],[0, 1],[1, 1],
      ];
      for (const [dc, dr] of offsets) {
        const cell = sys.gridManager.getModuleAt(chipCol + dc, chipRow + dr);
        if (!cell || cell.type !== 'defense') return false;
      }
      return true;
    },
    apply(sys) {
      sys.xpSystem.synergies.ironCurtain = true;
    },
  },
  {
    id: 'neural_network',
    name: 'Neural Network',
    rarity: 'legendary',
    description: '+8% attack dmg per connected Relay/Utility module',
    condition(sys) {
      const utilMods = sys.gridManager.getAllModules().filter(
        m => (m.type === 'relay' || m.type === 'utility') && m.connected
      );
      // Count distinct attack card types held
      const attackCardIds = ['ping_burst_plus', 'data_spike', 'firewall_pulse', 'trace_route', 'buffer_overflow', 'rapid_packets', 'multi_turret', 'ricochet', 'damage_boost', 'packet_storm', 'logic_bomb_strike', 'piercing_protocol', 'cascade_failure', 'slow_drain'];
      let attackCardCount = 0;
      for (const id of attackCardIds) {
        if ((sys.xpSystem.heldCards[id] || 0) > 0) attackCardCount++;
      }
      return utilMods.length >= 5 && attackCardCount >= 3;
    },
    apply(sys) {
      sys.xpSystem.synergies.neuralNetwork = true;
    },
  },
  {
    id: 'dead_mans_switch',
    name: "Dead Man's Switch",
    rarity: 'legendary',
    description: 'Destroyed modules explode for 15 dmg to nearby enemies',
    condition(sys) {
      const totalModules = sys.gridManager.getAllModules().length;
      return totalModules >= 8;
    },
    apply(sys) {
      sys.xpSystem.synergies.deadMansSwitch = true;
    },
  },
  {
    id: 'distributed_computing',
    name: 'Distributed Computing',
    rarity: 'legendary',
    description: 'All modules gain every adjacent type bonus',
    condition(sys) {
      const modules = sys.gridManager.getAllModules();
      if (modules.length < 12) return false;
      // Check all module types present (we have 3 currently: attack, defense, relay)
      const types = new Set(modules.map(m => m.type));
      return types.has('attack') && types.has('defense') && types.has('relay');
    },
    apply(sys) {
      sys.xpSystem.synergies.distributedComputing = true;
    },
  },
];

// ── Synergy System ──────────────────────────────────────────
export class SynergySystem {
  constructor(xpSystem, gridManager, chip, attackSystem) {
    this.xpSystem = xpSystem;
    this.gridManager = gridManager;
    this.chip = chip;
    this.attackSystem = attackSystem;

    // Track which synergies are active this run
    this.activeSynergies = new Set();
    // Queue of synergy IDs available to pick (shown as 4th card)
    this.pendingSynergies = [];
    // All-time discovered (for future codex)
    this.discoveredSynergies = new Set();

    // Ensure synergies object exists on xpSystem
    if (!xpSystem.synergies) xpSystem.synergies = {};
  }

  /** Get the systems bundle for condition checks */
  get sys() {
    return {
      xpSystem: this.xpSystem,
      gridManager: this.gridManager,
      chip: this.chip,
      attackSystem: this.attackSystem,
    };
  }

  /** Check all synergy conditions, queue any newly available ones */
  check() {
    for (const syn of SYNERGY_DEFS) {
      if (this.activeSynergies.has(syn.id)) continue;
      if (this.pendingSynergies.includes(syn.id)) continue;

      try {
        if (syn.condition(this.sys)) {
          this.pendingSynergies.push(syn.id);
        }
      } catch (e) {
        // Condition check failed — skip
      }
    }
  }

  /** Pop the next available synergy for card pick (or null) */
  getAvailableSynergy() {
    if (this.pendingSynergies.length === 0) return null;
    const id = this.pendingSynergies[0];
    return SYNERGY_DEFS.find(s => s.id === id) || null;
  }

  /** Activate a synergy by ID */
  activate(synergyId) {
    const syn = SYNERGY_DEFS.find(s => s.id === synergyId);
    if (!syn) return;

    this.activeSynergies.add(synergyId);
    this.discoveredSynergies.add(synergyId);
    this.pendingSynergies = this.pendingSynergies.filter(id => id !== synergyId);

    syn.apply(this.sys);
    eventBus.emit('synergyActivated', synergyId);
  }

  /** Check if a synergy is active */
  isActive(id) {
    return this.activeSynergies.has(id);
  }

  reset() {
    this.activeSynergies.clear();
    this.pendingSynergies = [];
    if (this.xpSystem) this.xpSystem.synergies = {};
  }
}
