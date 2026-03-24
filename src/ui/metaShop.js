import { CONFIG, STATES } from '../core/config.js';
import { eventBus } from '../core/eventBus.js';
import { UPGRADE_DEFS } from '../systems/metaProgression.js';

const W = CONFIG.CANVAS_WIDTH;
const H = CONFIG.CANVAS_HEIGHT;

export class MetaShop {
  constructor(meta) {
    this.meta = meta;
    this.visible = false;
    this.onClose = null; // callback when closing

    eventBus.on('pointerDown', (pos) => {
      if (!this.visible) return;
      this.handleTap(pos);
    });
  }

  show(onClose) {
    this.visible = true;
    this.onClose = onClose || null;
  }

  hide() {
    this.visible = false;
    if (this.onClose) this.onClose();
  }

  handleTap(pos) {
    const { x, y } = pos;

    // Back button
    if (x >= W / 2 - 50 && x <= W / 2 + 50 && y >= H - 60 && y <= H - 30) {
      this.hide();
      return;
    }

    // Upgrade buy buttons
    const startY = 140;
    const rowH = 72;
    for (let i = 0; i < UPGRADE_DEFS.length; i++) {
      const btnY = startY + i * rowH + 38;
      const btnX = W - 80;
      if (x >= btnX && x <= btnX + 60 && y >= btnY - 12 && y <= btnY + 12) {
        this.meta.buyUpgrade(UPGRADE_DEFS[i].id);
        return;
      }
    }
  }

  render(ctx) {
    if (!this.visible) return;

    // Full screen overlay
    ctx.fillStyle = 'rgba(5, 5, 16, 0.95)';
    ctx.fillRect(0, 0, W, H);

    // Title
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('UPGRADES', W / 2, 40);

    // Currency
    ctx.fillStyle = '#ffd700';
    ctx.font = '12px monospace';
    ctx.fillText(`${this.meta.data.metaCurrency}`, W / 2, 65);
    // Diamond icon
    const dx = W / 2 - ctx.measureText(`${this.meta.data.metaCurrency}`).width / 2 - 10;
    ctx.beginPath();
    ctx.moveTo(dx, 58); ctx.lineTo(dx + 4, 62);
    ctx.lineTo(dx, 66); ctx.lineTo(dx - 4, 62);
    ctx.closePath(); ctx.fill();

    // Subtitle
    ctx.fillStyle = '#555566';
    ctx.font = '9px monospace';
    ctx.fillText('Permanent upgrades persist between runs', W / 2, 85);

    // Upgrade rows
    const startY = 140;
    const rowH = 72;

    for (let i = 0; i < UPGRADE_DEFS.length; i++) {
      const def = UPGRADE_DEFS[i];
      const level = this.meta.getUpgradeLevel(def.id);
      const cost = this.meta.getUpgradeCost(def.id);
      const maxed = level >= def.maxLevel;
      const canBuy = !maxed && this.meta.data.metaCurrency >= cost;
      const ry = startY + i * rowH;

      // Row background
      ctx.fillStyle = '#0a0a18';
      ctx.fillRect(20, ry, W - 40, rowH - 8);
      ctx.strokeStyle = '#1a1a2e';
      ctx.lineWidth = 1;
      ctx.strokeRect(20, ry, W - 40, rowH - 8);

      // Name
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(def.name, 30, ry + 18);

      // Description
      ctx.fillStyle = '#7777aa';
      ctx.font = '9px monospace';
      ctx.fillText(def.desc, 30, ry + 32);

      // Level dots
      const dotX = 30;
      const dotY = ry + 46;
      for (let d = 0; d < def.maxLevel; d++) {
        ctx.fillStyle = d < level ? '#00e5a0' : '#222233';
        ctx.fillRect(dotX + d * 14, dotY, 10, 5);
      }

      // Level text
      ctx.fillStyle = '#555566';
      ctx.font = '8px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`LV ${level}/${def.maxLevel}`, dotX + def.maxLevel * 14 + 6, dotY + 5);

      // Buy button
      const btnX = W - 80;
      const btnY = ry + 38;
      if (maxed) {
        ctx.fillStyle = '#222233';
        ctx.fillRect(btnX, btnY - 12, 60, 24);
        ctx.fillStyle = '#555566';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('MAX', btnX + 30, btnY + 4);
      } else {
        ctx.fillStyle = canBuy ? '#1a2a1a' : '#1a1a1a';
        ctx.fillRect(btnX, btnY - 12, 60, 24);
        ctx.strokeStyle = canBuy ? '#00e5a0' : '#333344';
        ctx.lineWidth = 1;
        ctx.strokeRect(btnX, btnY - 12, 60, 24);
        ctx.fillStyle = canBuy ? '#00e5a0' : '#555566';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${cost}`, btnX + 30, btnY + 4);
      }
    }

    // Back button
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(W / 2 - 50, H - 60, 100, 30);
    ctx.strokeStyle = '#7777aa';
    ctx.lineWidth = 1;
    ctx.strokeRect(W / 2 - 50, H - 60, 100, 30);
    ctx.fillStyle = '#7777aa';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('BACK', W / 2, H - 41);
  }
}
