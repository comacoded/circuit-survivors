import { eventBus } from '../core/eventBus.js';

// ══════════════════════════════════════════════════════════════
// Audio Manager — procedural chiptune/synth via Web Audio API
// ══════════════════════════════════════════════════════════════

export class AudioManager {
  constructor() {
    this.ctx = null;       // AudioContext — created on first interaction
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.muted = true;     // starts muted (mobile policy)
    this.initialized = false;
    this.masterVolume = 0.5;
    this.elapsedTime = 0;

    // Music layers
    this.padOsc = null;
    this.padGain = null;
    this.pulseInterval = null;
    this.bassInterval = null;
    this.tenseOsc = null;
    this.tenseGain = null;
    this.bossActive = false;

    // Layer state
    this.layer2Active = false;
    this.layer3Active = false;

    // Wire up events
    this.bindEvents();
  }

  // ── Initialization (on first user gesture) ──────────────
  init() {
    if (this.initialized) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch { return; }

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : this.masterVolume;
    this.masterGain.connect(this.ctx.destination);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.7;
    this.sfxGain.connect(this.masterGain);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.25;
    this.musicGain.connect(this.masterGain);

    this.initialized = true;

    // Start ambient pad immediately
    this.startPad();
  }

  ensureCtx() {
    if (!this.initialized) this.init();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  toggleMute() {
    this.ensureCtx();
    this.muted = !this.muted;
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(
        this.muted ? 0 : this.masterVolume, this.ctx.currentTime, 0.05
      );
    }
    return this.muted;
  }

  setVolume(v) {
    this.masterVolume = Math.max(0, Math.min(1, v));
    if (this.masterGain && !this.muted) {
      this.masterGain.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.05);
    }
  }

  // ── Helpers ─────────────────────────────────────────────
  now() { return this.ctx ? this.ctx.currentTime : 0; }

  tone(type, freq, duration, volume = 0.3, startTime) {
    if (!this.ctx) return;
    const t = startTime || this.now();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + duration + 0.01);
  }

  noise(duration, volume = 0.3, filterFreq, filterType = 'bandpass', startTime) {
    if (!this.ctx) return;
    const t = startTime || this.now();
    const bufferSize = Math.ceil(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    if (filterFreq) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.setValueAtTime(filterFreq, t);
      filter.Q.setValueAtTime(5, t);
      src.connect(filter);
      filter.connect(gain);
    } else {
      src.connect(gain);
    }

    gain.connect(this.sfxGain);
    src.start(t);
    src.stop(t + duration + 0.01);
    return { gain, src };
  }

  // ── SFX ─────────────────────────────────────────────────
  playPingBurst() {
    this.ensureCtx();
    this.tone('sine', 800, 0.05, 0.15);
  }

  playDataSpike() {
    this.ensureCtx();
    this.tone('triangle', 200, 0.1, 0.2);
  }

  playEnemyDeath() {
    this.ensureCtx();
    this.noise(0.03, 0.25, 2000, 'bandpass');
  }

  playXpCollect() {
    this.ensureCtx();
    const t = this.now();
    this.tone('sine', 600, 0.05, 0.12, t);
    this.tone('sine', 900, 0.05, 0.12, t + 0.05);
  }

  playResourceCollect() {
    this.ensureCtx();
    this.tone('sine', 400, 0.02, 0.1);
  }

  playLevelUp() {
    this.ensureCtx();
    const t = this.now();
    this.tone('sine', 400, 0.08, 0.2, t);
    this.tone('sine', 600, 0.08, 0.2, t + 0.07);
    this.tone('sine', 800, 0.08, 0.2, t + 0.14);
    this.tone('sine', 1000, 0.12, 0.25, t + 0.21);
  }

  playCardPick() {
    this.ensureCtx();
    const t = this.now();
    this.tone('sine', 500, 0.1, 0.15, t);
    this.tone('sine', 750, 0.1, 0.15, t);
  }

  playModulePlace() {
    this.ensureCtx();
    const t = this.now();
    this.noise(0.04, 0.2, 3000, 'highpass', t);
    this.tone('sine', 300, 0.08, 0.15, t + 0.01);
  }

  playModuleDestroy() {
    this.ensureCtx();
    if (!this.ctx) return;
    const t = this.now();
    const n = this.noise(0.2, 0.3, 4000, 'lowpass', t);
    if (n && n.src) {
      // Descending filter — ramp the filter frequency down via a separate filter
    }
    this.tone('sawtooth', 200, 0.15, 0.1, t);
  }

  playChipDamage() {
    this.ensureCtx();
    if (!this.ctx) return;
    const t = this.now();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, t);
    // Vibrato
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.setValueAtTime(20, t);
    lfoGain.gain.setValueAtTime(15, t);
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    lfo.start(t);
    lfo.stop(t + 0.2);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.21);
  }

  playBossSpawn() {
    this.ensureCtx();
    if (!this.ctx) return;
    const t = this.now();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(80, t);
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.3, t + 0.15); // slow attack
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.51);
  }

  playThreatEscalation() {
    this.ensureCtx();
    const t = this.now();
    this.tone('sine', 500, 0.12, 0.2, t);
    this.tone('sine', 700, 0.12, 0.2, t + 0.15);
  }

  playDdosSwarm() {
    this.ensureCtx();
    if (!this.ctx) return;
    const t = this.now();
    // Low rumble
    this.tone('triangle', 60, 0.6, 0.25, t);
    // Alarm pings
    this.tone('square', 600, 0.05, 0.1, t + 0.1);
    this.tone('square', 600, 0.05, 0.1, t + 0.25);
    this.tone('square', 600, 0.05, 0.1, t + 0.4);
  }

  playGameOver() {
    this.ensureCtx();
    const t = this.now();
    this.tone('sine', 800, 0.25, 0.2, t);
    this.tone('sine', 400, 0.25, 0.2, t + 0.25);
    this.tone('sine', 200, 0.4, 0.2, t + 0.5);
  }

  // ── Background Music ────────────────────────────────────

  startPad() {
    if (!this.ctx || this.padOsc) return;
    const t = this.now();
    this.padOsc = this.ctx.createOscillator();
    this.padGain = this.ctx.createGain();
    this.padOsc.type = 'sine';
    this.padOsc.frequency.setValueAtTime(55, t); // low A
    this.padGain.gain.setValueAtTime(0.06, t);
    this.padOsc.connect(this.padGain);
    this.padGain.connect(this.musicGain);
    this.padOsc.start(t);
  }

  startRhythmicPulse() {
    if (this.layer2Active || !this.ctx) return;
    this.layer2Active = true;
    // 120bpm = 500ms per beat
    this.pulseInterval = setInterval(() => {
      if (!this.ctx || this.muted) return;
      this.noise(0.06, 0.06, 800, 'bandpass');
    }, 500);
  }

  startBassLine() {
    if (this.layer3Active || !this.ctx) return;
    this.layer3Active = true;
    const notes = [55, 55, 73, 55, 82, 55, 73, 82]; // simple bass pattern
    let idx = 0;
    this.bassInterval = setInterval(() => {
      if (!this.ctx || this.muted) return;
      const t = this.now();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(notes[idx % notes.length], t);
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start(t);
      osc.stop(t + 0.31);
      idx++;
    }, 500);
  }

  startTenseLayer() {
    if (this.bossActive || !this.ctx) return;
    this.bossActive = true;
    const t = this.now();
    this.tenseOsc = this.ctx.createOscillator();
    this.tenseGain = this.ctx.createGain();
    this.tenseOsc.type = 'sawtooth';
    this.tenseOsc.frequency.setValueAtTime(440, t);
    this.tenseGain.gain.setValueAtTime(0, t);
    this.tenseGain.gain.linearRampToValueAtTime(0.04, t + 1);
    this.tenseOsc.connect(this.tenseGain);
    this.tenseGain.connect(this.musicGain);
    this.tenseOsc.start(t);
  }

  stopTenseLayer() {
    if (!this.bossActive || !this.tenseOsc) return;
    this.bossActive = false;
    try {
      const t = this.now();
      this.tenseGain.gain.linearRampToValueAtTime(0, t + 0.5);
      this.tenseOsc.stop(t + 0.6);
    } catch { /* already stopped */ }
    this.tenseOsc = null;
    this.tenseGain = null;
  }

  // Update music layers based on elapsed time
  updateMusic(dt, elapsedTime) {
    this.elapsedTime = elapsedTime;

    // Layer 2: rhythmic pulse after 2.5 min
    if (elapsedTime >= 150 && !this.layer2Active) {
      this.startRhythmicPulse();
    }

    // Layer 3: bass line after 7.5 min
    if (elapsedTime >= 450 && !this.layer3Active) {
      this.startBassLine();
    }
  }

  stopMusic() {
    if (this.padOsc) { try { this.padOsc.stop(); } catch {} this.padOsc = null; }
    if (this.pulseInterval) { clearInterval(this.pulseInterval); this.pulseInterval = null; }
    if (this.bassInterval) { clearInterval(this.bassInterval); this.bassInterval = null; }
    this.stopTenseLayer();
    this.layer2Active = false;
    this.layer3Active = false;
    this.padGain = null;
  }

  reset() {
    this.stopMusic();
    this.elapsedTime = 0;
    // Restart pad if initialized
    if (this.initialized) {
      this.startPad();
    }
  }

  // ── Event Bindings ──────────────────────────────────────
  bindEvents() {
    // SFX triggers
    eventBus.on('enemyKilled', () => this.playEnemyDeath());
    eventBus.on('xpCollectedAt', () => this.playXpCollect());
    eventBus.on('resourceCollectedAt', () => this.playResourceCollect());
    eventBus.on('levelUp', () => this.playLevelUp());
    eventBus.on('chipDamaged', () => this.playChipDamage());
    eventBus.on('moduleDestroyed', () => this.playModuleDestroy());
    eventBus.on('ddosSwarmStart', () => this.playDdosSwarm());
    eventBus.on('threatEscalation', () => this.playThreatEscalation());

    // Boss
    eventBus.on('bossKilled', () => this.stopTenseLayer());

    // Throttled fire sounds
    this.lastFireSound = 0;
    eventBus.on('projectileFired', (name) => {
      if (!this.ctx) return;
      const t = this.now();
      if (t - this.lastFireSound < 0.08) return; // 80ms throttle
      this.lastFireSound = t;
      if (name === 'Ping Burst') this.playPingBurst();
      else if (name === 'Data Spike') this.playDataSpike();
      else this.playPingBurst(); // fallback blip
    });

    // Module placed / card picked
    eventBus.on('modulePlaced', () => this.playModulePlace());
    eventBus.on('cardPicked', () => this.playCardPick());

    // Boss spawned
    eventBus.on('bossSpawned', () => {
      this.playBossSpawn();
      this.startTenseLayer();
    });
  }
}
