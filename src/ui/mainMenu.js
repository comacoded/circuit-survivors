import { CONFIG, STATES } from '../core/config.js';
import { eventBus } from '../core/eventBus.js';
import { CHIP_VARIANTS, VARIANT_ORDER } from '../data/chipVariants.js';

const W = CONFIG.CANVAS_WIDTH;
const H = CONFIG.CANVAS_HEIGHT;
const CX = W / 2;

// Chip selector layout
const CHIP_ICON_SIZE = 48;
const CHIP_GAP = 10;
const CHIP_ROW_Y = 330;

export class MainMenu {
  constructor(game, meta, metaShop, startRunCallback) {
    this.game = game;
    this.meta = meta;
    this.metaShop = metaShop;
    this.startRunCallback = startRunCallback;
    this.pulsePhase = 0;
    this.scrollOffset = 0; // for horizontal scroll of chip row

    eventBus.on('pointerDown', (pos) => {
      if (this.game.state !== STATES.MENU) return;
      if (this.metaShop.visible) return;
      this.handleTap(pos);
    });
  }

  handleTap(pos) {
    const { x, y } = pos;

    // Chip selector icons
    const totalW = VARIANT_ORDER.length * (CHIP_ICON_SIZE + CHIP_GAP) - CHIP_GAP;
    const startX = CX - totalW / 2;
    for (let i = 0; i < VARIANT_ORDER.length; i++) {
      const ix = startX + i * (CHIP_ICON_SIZE + CHIP_GAP);
      if (x >= ix && x <= ix + CHIP_ICON_SIZE && y >= CHIP_ROW_Y && y <= CHIP_ROW_Y + CHIP_ICON_SIZE) {
        const variant = CHIP_VARIANTS[VARIANT_ORDER[i]];
        const unlocked = !variant.unlockCondition || variant.unlockCondition(this.meta);
        if (unlocked) {
          this.meta.selectVariant(variant.id);
        }
        return;
      }
    }

    // START RUN button
    if (x >= CX - 90 && x <= CX + 90 && y >= 480 && y <= 525) {
      this.startRunCallback();
      return;
    }

    // UPGRADES button
    if (x >= CX - 75 && x <= CX + 75 && y >= 545 && y <= 580) {
      this.metaShop.show();
      return;
    }
  }

  update(dt) {
    this.pulsePhase += dt * 2;
  }

  render(ctx) {
    if (this.game.state !== STATES.MENU) return;
    if (this.metaShop.visible) {
      this.metaShop.render(ctx);
      return;
    }

    // Background
    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, W, H);

    // Subtle grid
    ctx.strokeStyle = '#0a0a15';
    ctx.lineWidth = 1;
    for (let gx = 0; gx < W; gx += 32) {
      ctx.beginPath(); ctx.moveTo(gx + 0.5, 0); ctx.lineTo(gx + 0.5, H); ctx.stroke();
    }
    for (let gy = 0; gy < H; gy += 32) {
      ctx.beginPath(); ctx.moveTo(0, gy + 0.5); ctx.lineTo(W, gy + 0.5); ctx.stroke();
    }

    // Title with glow
    const pulse = Math.sin(this.pulsePhase) * 0.3 + 0.7;
    ctx.save();
    ctx.shadowColor = '#00e5a0';
    ctx.shadowBlur = 8 * pulse;
    ctx.fillStyle = '#00e5a0';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CIRCUIT', CX, 180);
    ctx.fillText('SURVIVORS', CX, 208);
    ctx.restore();

    // Subtitle
    ctx.fillStyle = '#555566';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Defend the chip. Survive the swarm.', CX, 228);

    // Best time
    const best = this.meta.data.lifetimeStats.bestTime;
    if (best > 0) {
      ctx.fillStyle = '#7777aa';
      ctx.font = '10px monospace';
      ctx.fillText(`BEST TIME: ${this.meta.formatTime(best)}`, CX, 252);
    }

    // ── CHIP SELECT label ─────────────────────────────────
    ctx.fillStyle = '#7777aa';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SELECT CHIP', CX, CHIP_ROW_Y - 14);

    // ── Chip selector row ─────────────────────────────────
    const selectedId = this.meta.getSelectedVariant();
    const totalW = VARIANT_ORDER.length * (CHIP_ICON_SIZE + CHIP_GAP) - CHIP_GAP;
    const startX = CX - totalW / 2;

    for (let i = 0; i < VARIANT_ORDER.length; i++) {
      const vId = VARIANT_ORDER[i];
      const variant = CHIP_VARIANTS[vId];
      const ix = startX + i * (CHIP_ICON_SIZE + CHIP_GAP);
      const iy = CHIP_ROW_Y;
      const isSelected = selectedId === vId;
      const unlocked = !variant.unlockCondition || variant.unlockCondition(this.meta);

      // Icon background
      ctx.fillStyle = isSelected ? '#1a1a35' : '#0a0a14';
      ctx.fillRect(ix, iy, CHIP_ICON_SIZE, CHIP_ICON_SIZE);

      if (unlocked) {
        // Border
        ctx.strokeStyle = isSelected ? variant.color : '#2a2a3e';
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.strokeRect(ix + 0.5, iy + 0.5, CHIP_ICON_SIZE - 1, CHIP_ICON_SIZE - 1);

        // Selected glow
        if (isSelected) {
          ctx.save();
          ctx.shadowColor = variant.color;
          ctx.shadowBlur = 8;
          ctx.strokeStyle = variant.color;
          ctx.lineWidth = 1;
          ctx.strokeRect(ix + 1, iy + 1, CHIP_ICON_SIZE - 2, CHIP_ICON_SIZE - 2);
          ctx.restore();
        }

        // Chip color swatch (mini chip icon)
        const ccx = ix + CHIP_ICON_SIZE / 2;
        const ccy = iy + CHIP_ICON_SIZE / 2 - 3;
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(ccx - 8, ccy - 8, 16, 16);
        ctx.strokeStyle = variant.color;
        ctx.lineWidth = variant.borderWidth;
        ctx.strokeRect(ccx - 8, ccy - 8, 16, 16);
        // Die dot
        ctx.fillStyle = variant.color;
        ctx.fillRect(ccx - 2, ccy - 2, 4, 4);

        // Name below icon
        ctx.fillStyle = isSelected ? '#ccccdd' : '#777788';
        ctx.font = '7px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(variant.name, ix + CHIP_ICON_SIZE / 2, iy + CHIP_ICON_SIZE - 2);
      } else {
        // Locked — dark silhouette
        ctx.strokeStyle = '#1a1a25';
        ctx.lineWidth = 1;
        ctx.strokeRect(ix + 0.5, iy + 0.5, CHIP_ICON_SIZE - 1, CHIP_ICON_SIZE - 1);

        // Lock icon
        ctx.fillStyle = '#333344';
        ctx.font = '14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('?', ix + CHIP_ICON_SIZE / 2, iy + CHIP_ICON_SIZE / 2 + 2);

        // Unlock text
        ctx.fillStyle = '#333344';
        ctx.font = '6px monospace';
        ctx.fillText(variant.unlockDesc || '', ix + CHIP_ICON_SIZE / 2, iy + CHIP_ICON_SIZE - 2);
      }
    }

    // ── Selected chip stats ───────────────────────────────
    const selVariant = CHIP_VARIANTS[selectedId];
    if (selVariant) {
      const sy = CHIP_ROW_Y + CHIP_ICON_SIZE + 14;

      ctx.fillStyle = selVariant.color;
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(selVariant.name.toUpperCase(), CX, sy);

      ctx.fillStyle = '#7777aa';
      ctx.font = '9px monospace';
      ctx.fillText(selVariant.desc, CX, sy + 14);

      // Stat bars
      ctx.font = '8px monospace';
      ctx.textAlign = 'left';
      const statX = CX - 80;
      let statY = sy + 30;
      const stats = [
        ['INT', selVariant.integrity, 150],
        ['SPD', selVariant.processing, 7],
        ['RNG', selVariant.signalRange, 200],
      ];
      for (const [label, val, max] of stats) {
        ctx.fillStyle = '#555566';
        ctx.fillText(label, statX, statY);
        // Bar background
        ctx.fillStyle = '#111122';
        ctx.fillRect(statX + 30, statY - 7, 100, 6);
        // Bar fill
        ctx.fillStyle = selVariant.color;
        ctx.fillRect(statX + 30, statY - 7, 100 * (val / max), 6);
        // Value
        ctx.fillStyle = '#9999bb';
        ctx.textAlign = 'right';
        ctx.fillText(`${val}`, statX + 160, statY);
        ctx.textAlign = 'left';
        statY += 14;
      }
    }

    // ── START RUN button ──────────────────────────────────
    const startPulse = 0.8 + Math.sin(this.pulsePhase * 1.5) * 0.2;
    ctx.fillStyle = `rgba(0, 229, 160, ${0.15 * startPulse})`;
    ctx.fillRect(CX - 90, 480, 180, 45);
    ctx.strokeStyle = `rgba(0, 229, 160, ${startPulse})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(CX - 90, 480, 180, 45);
    ctx.fillStyle = '#00e5a0';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('START RUN', CX, 508);

    // ── UPGRADES button ──────────────────────────────────
    ctx.fillStyle = '#0d0d1a';
    ctx.fillRect(CX - 75, 545, 150, 35);
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 1;
    ctx.strokeRect(CX - 75, 545, 150, 35);
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('UPGRADES', CX, 567);

    ctx.fillStyle = '#aa8800';
    ctx.font = '9px monospace';
    ctx.fillText(`${this.meta.data.metaCurrency} available`, CX, 590);

    // ── CODEX button (placeholder) ────────────────────────
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(CX - 75, 610, 150, 35);
    ctx.strokeStyle = '#333344';
    ctx.lineWidth = 1;
    ctx.strokeRect(CX - 75, 610, 150, 35);
    ctx.fillStyle = '#444455';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('CODEX', CX, 632);
    ctx.fillStyle = '#333344';
    ctx.font = '8px monospace';
    ctx.fillText('COMING SOON', CX, 653);

    // ── Lifetime stats ────────────────────────────────────
    const ls = this.meta.data.lifetimeStats;
    ctx.fillStyle = '#333344';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    let lsy = H - 80;
    ctx.fillText(`${ls.totalRuns} runs  |  ${ls.totalKills} kills`, CX, lsy);
    lsy += 14;
    ctx.fillText(`${this.meta.data.unlockedCards.length}/32 cards  |  ${(this.meta.data.discoveredSynergies || []).length} synergies`, CX, lsy);

    // Version
    ctx.fillStyle = '#222233';
    ctx.font = '9px monospace';
    ctx.fillText('v0.5', CX, H - 30);
  }
}
