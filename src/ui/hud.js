import { CONFIG, STATES } from '../core/config.js';
import { eventBus } from '../core/eventBus.js';

const MUTE_BTN_SIZE = 20;
const MUTE_BTN_X = CONFIG.CANVAS_WIDTH - MUTE_BTN_SIZE - 6;
const MUTE_BTN_Y = 56;

export class HUD {
  constructor(chip, enemyManager, xpSystem, audioManager) {
    this.chip = chip;
    this.enemyManager = enemyManager;
    this.xpSystem = xpSystem;
    this.audio = audioManager;

    // Mute button tap handler
    eventBus.on('pointerDown', (pos) => {
      if (!this.audio) return;
      if (pos.x >= MUTE_BTN_X && pos.x <= MUTE_BTN_X + MUTE_BTN_SIZE &&
          pos.y >= MUTE_BTN_Y && pos.y <= MUTE_BTN_Y + MUTE_BTN_SIZE) {
        this.audio.toggleMute();
      }
    });
  }

  render(ctx, state) {
    if (state !== STATES.COMBAT && state !== STATES.LEVEL_UP && state !== STATES.BUILD_PHASE) return;

    const W = CONFIG.CANVAS_WIDTH;

    // ── Integrity bar (top center) ──────────────────────────
    const barW = 200;
    const barH = 8;
    const barX = (W - barW) / 2;
    const barY = 14;
    const pct = this.chip.integrity / this.chip.maxIntegrity;

    ctx.fillStyle = '#111122';
    ctx.fillRect(barX, barY, barW, barH);

    let fillColor = '#00e5a0';
    if (pct < 0.25) fillColor = '#ff3355';
    else if (pct < 0.5) fillColor = '#ffcc00';

    ctx.fillStyle = fillColor;
    ctx.fillRect(barX, barY, barW * Math.max(0, pct), barH);

    ctx.strokeStyle = '#2a2a3e';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);

    ctx.fillStyle = '#7777aa';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(
      `${Math.ceil(this.chip.integrity)} / ${this.chip.maxIntegrity}`,
      W / 2, barY + barH + 11
    );

    // ── Time survived (top left) ────────────────────────────
    const elapsed = this.enemyManager.elapsedTime;
    const mins = Math.floor(elapsed / 60);
    const secs = Math.floor(elapsed % 60);
    const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;

    ctx.fillStyle = '#7777aa';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(timeStr, 10, 20);

    // ── Kills (top right) ───────────────────────────────────
    ctx.textAlign = 'right';
    ctx.fillText(`${this.enemyManager.totalKills} kills`, W - 10, 20);

    // ── Enemies on screen ──────────────────────────────────
    ctx.fillStyle = '#555566';
    ctx.font = '9px monospace';
    ctx.fillText(`${this.enemyManager.enemiesAlive} active`, W - 10, 32);

    // ── XP bar (bottom center) ──────────────────────────────
    const xpBarH = 6;
    const xpBarY = CONFIG.CANVAS_HEIGHT - xpBarH - 4;
    const xpBarX = 10;
    const xpBarW = W - 20;
    const xpFill = this.xpSystem.xpToNext > 0 ? this.xpSystem.xp / this.xpSystem.xpToNext : 0;

    ctx.fillStyle = '#111122';
    ctx.fillRect(xpBarX, xpBarY, xpBarW, xpBarH);
    ctx.fillStyle = '#00e5a0';
    ctx.fillRect(xpBarX, xpBarY, xpBarW * xpFill, xpBarH);
    ctx.strokeStyle = '#2a2a3e';
    ctx.lineWidth = 1;
    ctx.strokeRect(xpBarX, xpBarY, xpBarW, xpBarH);

    // ── Level (bottom left) ─────────────────────────────────
    ctx.fillStyle = '#7777aa';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`LV ${this.xpSystem.level}`, 10, xpBarY - 4);

    // ── Cards held (bottom right) ───────────────────────────
    const cardCount = Object.keys(this.xpSystem.heldCards).length;
    ctx.textAlign = 'right';
    ctx.fillText(`${cardCount} cards`, W - 10, xpBarY - 4);

    // ── Resources ──────────────────────────────────────────
    ctx.fillStyle = '#ffd700';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${this.xpSystem.resources}`, W - 10, 44);

    const dx = W - 18 - ctx.measureText(`${this.xpSystem.resources}`).width;
    const dy = 40;
    ctx.beginPath();
    ctx.moveTo(dx, dy - 3);
    ctx.lineTo(dx + 3, dy);
    ctx.lineTo(dx, dy + 3);
    ctx.lineTo(dx - 3, dy);
    ctx.closePath();
    ctx.fill();

    // ── Mute/Unmute button (speaker icon) ──────────────────
    if (this.audio) {
      const bx = MUTE_BTN_X;
      const by = MUTE_BTN_Y;
      const isMuted = this.audio.muted;

      // Button background
      ctx.fillStyle = 'rgba(10, 10, 20, 0.6)';
      ctx.fillRect(bx, by, MUTE_BTN_SIZE, MUTE_BTN_SIZE);
      ctx.strokeStyle = isMuted ? '#555566' : '#00e5a0';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, MUTE_BTN_SIZE, MUTE_BTN_SIZE);

      // Speaker icon
      const sx = bx + 5;
      const sy = by + MUTE_BTN_SIZE / 2;
      ctx.fillStyle = isMuted ? '#555566' : '#00e5a0';

      // Speaker body
      ctx.fillRect(sx, sy - 3, 4, 6);
      // Speaker cone
      ctx.beginPath();
      ctx.moveTo(sx + 4, sy - 3);
      ctx.lineTo(sx + 8, sy - 6);
      ctx.lineTo(sx + 8, sy + 6);
      ctx.lineTo(sx + 4, sy + 3);
      ctx.closePath();
      ctx.fill();

      if (isMuted) {
        // X through speaker
        ctx.strokeStyle = '#ff3355';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(sx + 10, sy - 4);
        ctx.lineTo(sx + 14, sy + 4);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(sx + 14, sy - 4);
        ctx.lineTo(sx + 10, sy + 4);
        ctx.stroke();
      } else {
        // Sound waves
        ctx.strokeStyle = '#00e5a0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(sx + 9, sy, 3, -0.6, 0.6);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(sx + 9, sy, 6, -0.5, 0.5);
        ctx.stroke();
      }
    }
  }
}
