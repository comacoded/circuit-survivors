// ══════════════════════════════════════════════════════════════
// Chip Variant Definitions
// ══════════════════════════════════════════════════════════════

export const CHIP_VARIANTS = {
  standard: {
    id: 'standard',
    name: 'Standard',
    desc: 'Balanced chip. No frills.',
    color: '#00e5a0',
    integrity: 100,
    processing: 5,
    signalRange: 150,
    attackRange: 180,
    pulseSpeed: 2,
    borderWidth: 1.5,
    gridCols: 11,
    gridRows: 11,
    unlockCondition: null, // always unlocked
    unlockDesc: null,
    startBonus: null,
  },

  overclocked: {
    id: 'overclocked',
    name: 'Overclocked',
    desc: 'Fast processing. Fragile.',
    color: '#00ffff',
    integrity: 70,
    processing: 7,
    signalRange: 150,
    attackRange: 180,
    pulseSpeed: 3.5,
    borderWidth: 1.5,
    gridCols: 11,
    gridRows: 11,
    unlockCondition: (meta) => meta.data.lifetimeStats.bestTime >= 450,
    unlockDesc: 'Survive 7:30',
    startBonus: 'extraCard', // 1 extra card pick at run start
  },

  fortified: {
    id: 'fortified',
    name: 'Fortified',
    desc: 'Tanky. Short range.',
    color: '#3355ff',
    integrity: 150,
    processing: 4,
    signalRange: 120,
    attackRange: 150,
    pulseSpeed: 1.2,
    borderWidth: 2.5,
    gridCols: 11,
    gridRows: 11,
    unlockCondition: (meta) => meta.data.lifetimeStats.totalModulesBuilt >= 20,
    unlockDesc: 'Build 20 modules (lifetime)',
    startBonus: 'preplacedRelays', // 2 relay modules pre-placed north/south
  },

  experimental: {
    id: 'experimental',
    name: 'Experimental',
    desc: 'Random start. Long range.',
    color: '#aa55ff',
    integrity: 90,
    processing: 5,
    signalRange: 200,
    attackRange: 220,
    pulseSpeed: 2,
    borderWidth: 1.5,
    gridCols: 11,
    gridRows: 11,
    unlockCondition: (meta) => (meta.data.discoveredSynergies || []).length >= 3,
    unlockDesc: 'Discover 3 synergies',
    startBonus: 'randomStart', // 2 random cards + 1 random module + 10 resources
  },

  quantum: {
    id: 'quantum',
    name: 'Quantum',
    desc: 'Compact grid. 2x effects.',
    color: '#ffffff',
    integrity: 80,
    processing: 6,
    signalRange: 140,
    attackRange: 160,
    pulseSpeed: 4,
    borderWidth: 1,
    gridCols: 9,
    gridRows: 9,
    unlockCondition: (meta) => meta.data.lifetimeStats.bestTime >= 900,
    unlockDesc: 'Survive 15:00',
    startBonus: 'doubleModuleEffects', // all module effects doubled
  },
};

export const VARIANT_ORDER = ['standard', 'overclocked', 'fortified', 'experimental', 'quantum'];
