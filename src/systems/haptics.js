// ══════════════════════════════════════════════════════════════
// Haptic Feedback — Capacitor Haptics with graceful web fallback
// ══════════════════════════════════════════════════════════════

import { eventBus } from '../core/eventBus.js';

let Haptics = null;
let ImpactStyle = null;
let ready = false;

// Async init — try to load Capacitor Haptics
(async () => {
  try {
    const cap = await import('@capacitor/haptics');
    Haptics = cap.Haptics;
    ImpactStyle = cap.ImpactStyle;
    ready = true;
  } catch {
    // Not in Capacitor — haptics silently disabled
  }
})();

function light() {
  if (ready) Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
}

function medium() {
  if (ready) Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
}

function heavy() {
  if (ready) Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
}

// Wire up game events → haptic feedback
eventBus.on('cardPicked', () => light());
eventBus.on('modulePlaced', () => medium());
eventBus.on('chipDamaged', () => heavy());
eventBus.on('bossSpawned', () => heavy());
eventBus.on('levelUp', () => light());
eventBus.on('ddosSwarmStart', () => medium());

export { light, medium, heavy };
