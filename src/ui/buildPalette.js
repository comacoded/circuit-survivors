import { CONFIG, STATES } from '../core/config.js';
import { eventBus } from '../core/eventBus.js';
import { MODULE_TYPES, createModule } from '../entities/module.js';

const PALETTE_H = 120;
const ICON_SIZE = 48;
const ICON_GAP = 14;
const DEPLOY_BTN_W = 110;
const DEPLOY_BTN_H = 34;
const BUILD_BTN_SIZE = 36;

// Module unlock requirements — must be met to place
const MODULE_UNLOCK_REQS = {
  attack: null, // always available
  relay: null,  // always available
  tesla: {
    desc: '2 Attack + 2 Relay + LV 3',
    check(gm, xp) {
      const mods = gm.getAllModules();
      const attacks = mods.filter(m => m.type === 'attack' && m.connected).length;
      const relays = mods.filter(m => m.type === 'relay' && m.connected).length;
      return attacks >= 2 && relays >= 2 && xp.level >= 3;
    },
  },
  airstrike: {
    desc: '3 Relay + 1 Tesla + LV 5',
    check(gm, xp) {
      const mods = gm.getAllModules();
      const relays = mods.filter(m => m.type === 'relay' && m.connected).length;
      const teslas = mods.filter(m => m.type === 'tesla' && m.connected).length;
      return relays >= 3 && teslas >= 1 && xp.level >= 5;
    },
  },
};

export class BuildPalette {
  constructor(game, xpSystem, gridManager, cardPickOverlay) {
    this.game = game;
    this.xpSystem = xpSystem;
    this.gridManager = gridManager;
    this.cardPickOverlay = cardPickOverlay;

    this.selectedType = null;
    this.slideProgress = 0;
    this.ghostCol = -1;
    this.ghostRow = -1;

    this.types = ['attack', 'relay', 'tesla', 'airstrike'];

    // Build button position
    this.buildBtnX = CONFIG.CANVAS_WIDTH - BUILD_BTN_SIZE - 10;
    this.buildBtnY = CONFIG.CANVAS_HEIGHT - 50 - BUILD_BTN_SIZE;

    // Placement flash effects
    this.placeFlashes = [];

    // Info tooltip
    this.showingInfo = null; // type string or null

    eventBus.on('pointerDown', (pos) => this.handlePointerDown(pos));
    eventBus.on('pointerMove', (pos) => this.handlePointerMove(pos));
  }

  isTypeUnlocked(type) {
    const req = MODULE_UNLOCK_REQS[type];
    if (!req) return true;
    return req.check(this.gridManager, this.xpSystem);
  }

  handlePointerDown(pos) {
    // Build button during combat
    if (this.game.state === STATES.COMBAT) {
      if (this.hitTestBuildBtn(pos.x, pos.y)) {
        this.selectedType = null;
        this.slideProgress = 0;
        this.waitingForCard = false;
        this.game.setState(STATES.BUILD_PHASE);
        return;
      }
    }

    if (this.game.state !== STATES.BUILD_PHASE) return;

    // Dismiss info tooltip on any tap
    if (this.showingInfo) {
      this.showingInfo = null;
      return;
    }

    // Deploy button
    if (this.hitTestDeployBtn(pos.x, pos.y)) {
      this.game.setState(STATES.COMBAT);
      this.selectedType = null;
      return;
    }

    // Palette icon tap + info button check
    const iconY = this.getPaletteY() + 14;
    const totalW = this.types.length * (ICON_SIZE + ICON_GAP) - ICON_GAP;
    const startX = (CONFIG.CANVAS_WIDTH - totalW) / 2;

    for (let i = 0; i < this.types.length; i++) {
      const ix = startX + i * (ICON_SIZE + ICON_GAP);

      // Info button (small "?" in top-right corner of icon)
      const infoX = ix + ICON_SIZE - 12;
      const infoY = iconY;
      if (pos.x >= infoX && pos.x <= infoX + 12 && pos.y >= infoY && pos.y <= infoY + 12) {
        this.showingInfo = this.types[i];
        return;
      }

      if (pos.x >= ix && pos.x <= ix + ICON_SIZE && pos.y >= iconY && pos.y <= iconY + ICON_SIZE) {
        const type = this.types[i];
        if (!this.isTypeUnlocked(type)) return; // locked — ignore tap
        if (this.selectedType === type) {
          this.selectedType = null;
        } else {
          this.selectedType = type;
        }
        return;
      }
    }

    // Grid tap — place module
    if (this.selectedType) {
      const grid = this.gridManager.pixelToGrid(pos.x, pos.y);
      const valid = this.gridManager.getValidPlacements();
      const isValid = valid.some(v => v.col === grid.col && v.row === grid.row);

      if (isValid) {
        const info = MODULE_TYPES[this.selectedType];
        // 50% cost on damaged tiles
        const isDamaged = this.gridManager.isDamaged(grid.col, grid.row);
        const cost = isDamaged ? Math.floor(info.cost / 2) : info.cost;

        if (this.xpSystem.resources >= cost) {
          const mod = createModule(this.selectedType);
          if (this.gridManager.placeModule(grid.col, grid.row, mod)) {
            this.xpSystem.resources -= cost;

            // Placement flash
            const pixel = this.gridManager.gridToPixel(grid.col, grid.row);
            this.placeFlashes.push({ x: pixel.x, y: pixel.y, timer: 0.25 });

            // Deselect if can't afford another
            if (this.xpSystem.resources < info.cost) {
              this.selectedType = null;
            }
          }
        }
      }
    }
  }

  handlePointerMove(pos) {
    if (this.game.state !== STATES.BUILD_PHASE || !this.selectedType) return;
    const grid = this.gridManager.pixelToGrid(pos.x, pos.y);
    this.ghostCol = grid.col;
    this.ghostRow = grid.row;
  }

  hitTestBuildBtn(x, y) {
    return (
      x >= this.buildBtnX && x <= this.buildBtnX + BUILD_BTN_SIZE &&
      y >= this.buildBtnY && y <= this.buildBtnY + BUILD_BTN_SIZE
    );
  }

  hitTestDeployBtn(x, y) {
    const btnX = CONFIG.CANVAS_WIDTH - DEPLOY_BTN_W - 14;
    const btnY = this.getPaletteY() + PALETTE_H - DEPLOY_BTN_H - 10;
    return x >= btnX && x <= btnX + DEPLOY_BTN_W && y >= btnY && y <= btnY + DEPLOY_BTN_H;
  }

  getPaletteY() {
    const baseY = CONFIG.CANVAS_HEIGHT - PALETTE_H;
    const ease = 1 - Math.pow(1 - Math.min(this.slideProgress, 1), 3);
    return baseY + PALETTE_H * (1 - ease);
  }

  update(dt, state) {
    if (state === STATES.BUILD_PHASE) {
      this.slideProgress += dt * 3.3; // ~0.3s ease
    }

    // Update placement flashes
    for (let i = this.placeFlashes.length - 1; i >= 0; i--) {
      this.placeFlashes[i].timer -= dt;
      if (this.placeFlashes[i].timer <= 0) {
        this.placeFlashes.splice(i, 1);
      }
    }
  }

  render(ctx, state) {
    // Build button during combat
    if (state === STATES.COMBAT) {
      this.renderBuildButton(ctx);
      return;
    }

    if (state !== STATES.BUILD_PHASE) return;

    // Dim overlay for calm build feel
    ctx.fillStyle = 'rgba(0, 0, 10, 0.35)';
    ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

    // Placement flashes
    for (const flash of this.placeFlashes) {
      const progress = 1 - flash.timer / 0.25;
      const radius = 8 + 20 * progress;
      const alpha = (1 - progress) * 0.6;
      ctx.beginPath();
      ctx.arc(flash.x, flash.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.fill();
    }

    // Ghost preview on grid
    if (this.selectedType && this.ghostCol >= 0 && this.ghostRow >= 0 && !this.waitingForCard) {
      this.renderGhost(ctx);
    }

    const paletteY = this.getPaletteY();

    // Palette background
    ctx.fillStyle = 'rgba(8, 8, 18, 0.95)';
    ctx.fillRect(0, paletteY, CONFIG.CANVAS_WIDTH, PALETTE_H);

    // Top border
    ctx.strokeStyle = '#2a2a3e';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, paletteY);
    ctx.lineTo(CONFIG.CANVAS_WIDTH, paletteY);
    ctx.stroke();

    // Resource count (prominent, top of palette)
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${this.xpSystem.resources}`, CONFIG.CANVAS_WIDTH / 2 + 8, paletteY - 8);
    // Diamond icon
    const rdx = CONFIG.CANVAS_WIDTH / 2 - 8;
    const rdy = paletteY - 12;
    ctx.beginPath();
    ctx.moveTo(rdx, rdy - 4);
    ctx.lineTo(rdx + 4, rdy);
    ctx.lineTo(rdx, rdy + 4);
    ctx.lineTo(rdx - 4, rdy);
    ctx.closePath();
    ctx.fill();

    // Module icons
    const totalW = this.types.length * (ICON_SIZE + ICON_GAP) - ICON_GAP;
    const startX = (CONFIG.CANVAS_WIDTH - totalW) / 2;
    const iconY = paletteY + 14;

    for (let i = 0; i < this.types.length; i++) {
      const type = this.types[i];
      const info = MODULE_TYPES[type];
      const ix = startX + i * (ICON_SIZE + ICON_GAP);
      const unlocked = this.isTypeUnlocked(type);
      const canAfford = unlocked && this.xpSystem.resources >= info.cost;
      const isSelected = this.selectedType === type;

      // Icon background
      ctx.fillStyle = isSelected ? '#1a1a35' : '#0d0d1a';
      ctx.fillRect(ix, iconY, ICON_SIZE, ICON_SIZE);

      // Border
      ctx.strokeStyle = isSelected ? info.color : (canAfford ? '#3a3a4e' : '#1a1a25');
      ctx.lineWidth = isSelected ? 2.5 : 1;
      ctx.strokeRect(ix + 0.5, iconY + 0.5, ICON_SIZE - 1, ICON_SIZE - 1);

      // Selected glow
      if (isSelected) {
        ctx.save();
        ctx.shadowColor = info.color;
        ctx.shadowBlur = 8;
        ctx.strokeStyle = info.color;
        ctx.lineWidth = 1;
        ctx.strokeRect(ix + 1, iconY + 1, ICON_SIZE - 2, ICON_SIZE - 2);
        ctx.restore();
      }

      // Module color swatch
      ctx.fillStyle = canAfford ? info.color : '#282830';
      ctx.fillRect(ix + 6, iconY + 6, ICON_SIZE - 12, ICON_SIZE - 22);

      // Module name
      ctx.fillStyle = canAfford ? '#ccccdd' : '#444455';
      ctx.font = '8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(info.name, ix + ICON_SIZE / 2, iconY + ICON_SIZE - 5);

      // Cost below icon (or lock requirement)
      if (unlocked) {
        ctx.fillStyle = canAfford ? '#ffd700' : '#444430';
        ctx.font = 'bold 9px monospace';
        ctx.fillText(`${info.cost}`, ix + ICON_SIZE / 2, iconY + ICON_SIZE + 10);
      } else {
        // Locked overlay
        ctx.fillStyle = 'rgba(5, 5, 16, 0.6)';
        ctx.fillRect(ix, iconY, ICON_SIZE, ICON_SIZE);
        // Lock icon
        ctx.fillStyle = '#555566';
        ctx.font = 'bold 12px monospace';
        ctx.fillText('\u{1F512}', ix + ICON_SIZE / 2, iconY + ICON_SIZE / 2 + 4);
        // Requirement text
        const req = MODULE_UNLOCK_REQS[type];
        ctx.fillStyle = '#555566';
        ctx.font = '7px monospace';
        ctx.fillText(req ? req.desc : '', ix + ICON_SIZE / 2, iconY + ICON_SIZE + 10);
      }

      // Info "?" button (top-right corner of icon)
      const qx = ix + ICON_SIZE - 11;
      const qy = iconY + 1;
      ctx.fillStyle = 'rgba(100, 100, 140, 0.6)';
      ctx.fillRect(qx, qy, 10, 10);
      ctx.fillStyle = '#ccccdd';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('?', qx + 5, qy + 8);
    }

    // Info tooltip overlay
    if (this.showingInfo) {
      const info = MODULE_TYPES[this.showingInfo];
      if (info) {
        const tipW = CONFIG.CANVAS_WIDTH - 40;
        const tipH = 60;
        const tipX = 20;
        const tipY = paletteY - tipH - 14;

        // Background
        ctx.fillStyle = 'rgba(8, 8, 20, 0.95)';
        ctx.fillRect(tipX, tipY, tipW, tipH);
        ctx.strokeStyle = info.color;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(tipX, tipY, tipW, tipH);

        // Title
        ctx.fillStyle = info.color;
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`${info.name} Module`, tipX + 10, tipY + 16);

        // Cost
        ctx.fillStyle = '#ffd700';
        ctx.font = '9px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`Cost: ${info.cost}`, tipX + tipW - 10, tipY + 16);

        // Description
        ctx.fillStyle = '#9999bb';
        ctx.font = '9px monospace';
        ctx.textAlign = 'left';
        this.wrapText(ctx, info.desc, tipX + 10, tipY + 32, tipW - 20, 12);

        // Dismiss hint
        ctx.fillStyle = '#555566';
        ctx.font = '7px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('tap anywhere to close', tipX + tipW / 2, tipY + tipH - 4);
      }
    }

    // Deploy button (right side, more prominent when no resources)
    const noResources = this.xpSystem.resources === 0;
    const cantAffordAny = !this.types.some(t => this.xpSystem.resources >= MODULE_TYPES[t].cost);
    const btnW = cantAffordAny ? DEPLOY_BTN_W + 20 : DEPLOY_BTN_W;
    const btnX = CONFIG.CANVAS_WIDTH - btnW - 14;
    const btnY = paletteY + PALETTE_H - DEPLOY_BTN_H - 10;

    // Button glow when prominent
    if (cantAffordAny) {
      ctx.save();
      ctx.shadowColor = '#00e5a0';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#00e5a0';
      ctx.fillRect(btnX, btnY, btnW, DEPLOY_BTN_H);
      ctx.restore();
    } else {
      ctx.fillStyle = '#00e5a0';
      ctx.fillRect(btnX, btnY, btnW, DEPLOY_BTN_H);
    }

    ctx.fillStyle = '#050510';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('DEPLOY', btnX + btnW / 2, btnY + 22);

    // "BUILD MODE" label top of screen
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('BUILD MODE', CONFIG.CANVAS_WIDTH / 2, 18);

    ctx.fillStyle = '#555566';
    ctx.font = '9px monospace';
    ctx.fillText('Select a module, then tap the grid', CONFIG.CANVAS_WIDTH / 2, 32);
  }

  renderBuildButton(ctx) {
    const x = this.buildBtnX;
    const y = this.buildBtnY;
    const hasResources = this.xpSystem.resources > 0;

    // Pulse if player has resources
    let pulseAlpha = 0;
    if (hasResources) {
      pulseAlpha = Math.sin(Date.now() * 0.004) * 0.3 + 0.3;
    }

    // Button background
    ctx.fillStyle = hasResources ? `rgba(20, 20, 10, 0.85)` : 'rgba(10, 10, 20, 0.7)';
    ctx.fillRect(x, y, BUILD_BTN_SIZE, BUILD_BTN_SIZE);

    // Border (pulse if has resources)
    ctx.strokeStyle = hasResources ? '#ffd700' : '#555550';
    ctx.lineWidth = hasResources ? 1.5 : 1;
    ctx.strokeRect(x + 0.5, y + 0.5, BUILD_BTN_SIZE - 1, BUILD_BTN_SIZE - 1);

    if (hasResources && pulseAlpha > 0) {
      ctx.save();
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 6;
      ctx.strokeStyle = `rgba(255, 215, 0, ${pulseAlpha})`;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 1, y + 1, BUILD_BTN_SIZE - 2, BUILD_BTN_SIZE - 2);
      ctx.restore();
    }

    // Grid icon
    ctx.fillStyle = hasResources ? '#ffd700' : '#555550';
    const cx = x + BUILD_BTN_SIZE / 2;
    const cy = y + BUILD_BTN_SIZE / 2;
    const s = 5;
    const g = 2;
    ctx.fillRect(cx - s - g / 2, cy - s - g / 2, s, s);
    ctx.fillRect(cx + g / 2, cy - s - g / 2, s, s);
    ctx.fillRect(cx - s - g / 2, cy + g / 2, s, s);
    ctx.fillRect(cx + g / 2, cy + g / 2, s, s);

    // Label
    ctx.fillStyle = hasResources ? '#ffd700' : '#555550';
    ctx.font = '7px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('BUILD', cx, y + BUILD_BTN_SIZE + 9);
  }

  renderGhost(ctx) {
    const gm = this.gridManager;
    if (!gm.inBounds(this.ghostCol, this.ghostRow)) return;

    const valid = gm.getValidPlacements();
    const isValid = valid.some(v => v.col === this.ghostCol && v.row === this.ghostRow);
    const info = MODULE_TYPES[this.selectedType];
    const isDamaged = gm.isDamaged(this.ghostCol, this.ghostRow);
    const cost = isDamaged ? Math.floor(info.cost / 2) : info.cost;
    const canAfford = this.xpSystem.resources >= cost;
    const isGood = isValid && canAfford;

    const px = gm.offsetX + this.ghostCol * gm.ts;
    const py = gm.offsetY + this.ghostRow * gm.ts;

    ctx.globalAlpha = 0.45;
    ctx.fillStyle = isGood ? info.color : '#ff3355';
    ctx.fillRect(px + 1, py + 1, gm.ts - 2, gm.ts - 2);
    ctx.globalAlpha = 1;

    // Cost label above ghost
    ctx.fillStyle = isGood ? '#ffd700' : '#ff5566';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    const label = canAfford ? `${cost}${isDamaged ? ' (50%)' : ''}` : 'NO $';
    ctx.fillText(label, px + gm.ts / 2, py - 3);
  }

  wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let lineY = y;
    for (const word of words) {
      const test = line + (line ? ' ' : '') + word;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, lineY);
        line = word;
        lineY += lineHeight;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x, lineY);
  }

  reset() {
    this.selectedType = null;
    this.slideProgress = 0;
    this.ghostCol = -1;
    this.ghostRow = -1;
    this.placeFlashes = [];
    this.showingInfo = null;
  }
}
