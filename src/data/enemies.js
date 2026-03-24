// Spawn table: maps elapsed time thresholds to enemy type weights
// Each entry: { type, weight, minTime (seconds) }
// Weight determines relative spawn chance among eligible types

export const SPAWN_TABLE = [
  { type: 'bit',        weight: 100, minTime: 0 },
  { type: 'packet',     weight: 30,  minTime: 45 },     // 45s (earlier)
  { type: 'worm',       weight: 25,  minTime: 60 },     // 1 min
  { type: 'crawler',    weight: 25,  minTime: 90 },     // 1.5 min
  { type: 'virus',      weight: 15,  minTime: 120 },    // 2 min
  { type: 'rootkit',    weight: 15,  minTime: 150 },    // 2.5 min
  { type: 'trojan',     weight: 10,  minTime: 90 },     // 1.5 min
];

// Special spawns on timers (not from the weighted table)
export const SPECIAL_SPAWNS = {
  // DDoS swarm: massive burst from all directions
  ddosInterval: 60,        // every 60 seconds
  ddosMinTime: 90,         // starts at 1.5 min
  ddosCount: 80,           // 80 enemies — a real swarm
  ddosDuration: 3.5,       // spread over 3.5 seconds

  // Ransomware mini-boss: every ~2 minutes after 3 min
  ransomwareInterval: 120, // was 180
  ransomwareMinTime: 180,  // was 240

  // Logic Bomb boss: every ~4 minutes after 4 min
  logicBombInterval: 240,  // was 300
  logicBombMinTime: 240,   // was 300
};
