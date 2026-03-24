import { CONFIG, STATES } from '../core/config.js';
import { eventBus } from '../core/eventBus.js';

const W = CONFIG.CANVAS_WIDTH;
const H = CONFIG.CANVAS_HEIGHT;
const CX = W / 2;

export class GameOverScreen {
  constructor(game, chip, enemyManager, xpSystem, meta, metaShop, resetCallback, menuCallback) {
    this.game = game;
    this.chip = chip;
    this.enemyManager = enemyManager;
    this.xpSystem = xpSystem;
    this.meta = meta;
    this.metaShop = metaShop;
    this.resetCallback = resetCallback;
    this.menuCallback = menuCallback;

    this.fadeTimer = 0;
    this.glitchTimer = 0;
    this.visible = false;
    this.stats = {};
    this.runResult = null;

    eventBus.on('pointerDown', (pos) => {
      if (!this.visible || this.fadeTimer < 1.5) return;
      if (this.metaShop.visible) return;
      this.handleTap(pos);
    });
  }

  handleTap(pos) {
    const { x, y } = pos;
    const btnY = H * 0.82;

    // RUN AGAIN
    if (x >= 20 && x <= 130 && y >= btnY && y <= btnY + 32) {
      this.visible = false;
      this.resetCallback();
      return;
    }
    // UPGRADES
    if (x >= CX - 55 && x <= CX + 55 && y >= btnY && y <= btnY + 32) {
      this.metaShop.show();
      return;
    }
    // MENU
    if (x >= W - 130 && x <= W - 20 && y >= btnY && y <= btnY + 32) {
      this.visible = false;
      this.menuCallback();
      return;
    }
  }

  show(systems) {
    this.visible = true;
    this.fadeTimer = 0;
    this.glitchTimer = 0;

    const elapsed = this.enemyManager.elapsedTime;
    this.stats = {
      timeSurvived: this.meta.formatTime(elapsed),
      kills: this.enemyManager.totalKills,
      level: this.xpSystem.level,
      cards: Object.keys(this.xpSystem.heldCards).length,
    };

    // End run and get results
    this.runResult = this.meta.endRun(systems);
  }

  update(dt, state) {
    if (state !== STATES.GAME_OVER) return;
    this.fadeTimer += dt;
    this.glitchTimer += dt;
  }

  render(ctx, state) {
    if (state !== STATES.GAME_OVER) return;

    // If meta shop is visible, render it on top
    if (this.metaShop.visible) {
      this.renderBase(ctx);
      this.metaShop.render(ctx);
      return;
    }

    this.renderBase(ctx);
  }

  renderBase(ctx) {
    const fadeAlpha = Math.min(this.fadeTimer / 0.8, 1);

    // Dark overlay fade
    ctx.fillStyle = `rgba(5, 5, 16, ${fadeAlpha * 0.9})`;
    ctx.fillRect(0, 0, W, H);

    if (fadeAlpha < 0.3) return;

    // ── "SYSTEM FAILURE" with glitch ────────────────────
    const titleY = H * 0.12;
    const glitchIntensity = Math.max(0, 1 - this.fadeTimer * 0.5);
    const jx = (Math.random() - 0.5) * 6 * glitchIntensity;
    const jy = (Math.random() - 0.5) * 3 * glitchIntensity;
    const flicker = Math.sin(this.glitchTimer * 30) > 0.3 || this.fadeTimer > 1.5;

    if (flicker) {
      ctx.fillStyle = `rgba(255, 51, 85, ${0.3 * fadeAlpha})`;
      ctx.font = 'bold 22px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SYSTEM FAILURE', CX + jx + 2, titleY + jy + 1);
      ctx.fillStyle = `rgba(0, 170, 255, ${0.2 * fadeAlpha})`;
      ctx.fillText('SYSTEM FAILURE', CX + jx - 1, titleY + jy - 1);
      ctx.fillStyle = `rgba(255, 51, 85, ${fadeAlpha})`;
      ctx.fillText('SYSTEM FAILURE', CX + jx, titleY + jy);
    }

    if (this.fadeTimer < 0.6) return;
    const alpha = Math.min((this.fadeTimer - 0.6) / 0.4, 1);
    ctx.globalAlpha = alpha;

    // ── Run Stats ─────────────────────────────────────────
    let sy = titleY + 50;

    ctx.strokeStyle = '#333344';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(W * 0.15, sy - 8); ctx.lineTo(W * 0.85, sy - 8); ctx.stroke();

    const statLines = [
      ['TIME SURVIVED', this.stats.timeSurvived],
      ['ENEMIES DESTROYED', `${this.stats.kills}`],
      ['LEVEL REACHED', `${this.stats.level}`],
      ['CARDS COLLECTED', `${this.stats.cards}`],
    ];

    for (const [label, value] of statLines) {
      ctx.fillStyle = '#7777aa';
      ctx.font = '9px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(label, W * 0.15, sy);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'right';
      ctx.fillText(value, W * 0.85, sy);
      sy += 22;
    }

    // ── Meta Currency Earned ──────────────────────────────
    if (this.runResult) {
      sy += 10;
      ctx.strokeStyle = '#333344';
      ctx.beginPath(); ctx.moveTo(W * 0.15, sy - 8); ctx.lineTo(W * 0.85, sy - 8); ctx.stroke();

      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`+${this.runResult.currency} CREDITS EARNED`, CX, sy + 4);

      // Breakdown
      sy += 22;
      ctx.fillStyle = '#aa8800';
      ctx.font = '8px monospace';
      const bd = this.runResult.breakdown;
      const parts = [];
      if (bd.time > 0) parts.push(`Time: ${bd.time}`);
      if (bd.kills > 0) parts.push(`Kills: ${bd.kills}`);
      if (bd.bosses > 0) parts.push(`Bosses: ${bd.bosses}`);
      if (bd.best > 0) parts.push(`New Best! +${bd.best}`);
      ctx.fillText(parts.join('  |  '), CX, sy);

      if (this.runResult.isNewBest) {
        sy += 16;
        ctx.fillStyle = '#00e5a0';
        ctx.font = 'bold 10px monospace';
        ctx.fillText('NEW PERSONAL BEST!', CX, sy);
      }

      // ── New Unlocks ────────────────────────────────────
      if (this.runResult.newUnlocks.length > 0) {
        sy += 24;
        ctx.fillStyle = '#00e5a0';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('CARDS UNLOCKED:', CX, sy);

        for (const ach of this.runResult.newUnlocks) {
          sy += 16;
          ctx.fillStyle = '#00aaff';
          ctx.font = '9px monospace';
          ctx.fillText(`${ach.name} — ${ach.unlocks}`, CX, sy);
        }
      }
    }

    ctx.globalAlpha = 1;

    // ── Buttons ────────────────────────────────────────────
    if (this.fadeTimer < 1.5) return;

    const btnY = H * 0.82;
    const btnH = 32;

    // RUN AGAIN
    ctx.fillStyle = '#0d1a0d';
    ctx.fillRect(20, btnY, 110, btnH);
    ctx.strokeStyle = '#00e5a0';
    ctx.lineWidth = 1;
    ctx.strokeRect(20, btnY, 110, btnH);
    ctx.fillStyle = '#00e5a0';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('RUN AGAIN', 75, btnY + 20);

    // UPGRADES
    ctx.fillStyle = '#1a1a0d';
    ctx.fillRect(CX - 55, btnY, 110, btnH);
    ctx.strokeStyle = '#ffd700';
    ctx.strokeRect(CX - 55, btnY, 110, btnH);
    ctx.fillStyle = '#ffd700';
    ctx.fillText('UPGRADES', CX, btnY + 20);

    // MENU
    ctx.fillStyle = '#0d0d1a';
    ctx.fillRect(W - 130, btnY, 110, btnH);
    ctx.strokeStyle = '#7777aa';
    ctx.strokeRect(W - 130, btnY, 110, btnH);
    ctx.fillStyle = '#7777aa';
    ctx.fillText('MENU', W - 75, btnY + 20);

    // Total credits
    ctx.fillStyle = '#aa8800';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`Total credits: ${this.meta.data.metaCurrency}`, CX, btnY + 50);
  }
}
