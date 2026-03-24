import { CONFIG, STATES } from '../core/config.js';
import { eventBus } from '../core/eventBus.js';
import { CARD_DEFS, RARITY_COLORS, RARITY_WEIGHTS, RARITY, getRarityWeights } from '../data/cards.js';

const CARD_W = 100;
const CARD_H = 150;
const CARD_GAP = 15;
const CARD_RADIUS = 8;
const CARD_Y_TARGET = (CONFIG.CANVAS_HEIGHT - CARD_H) / 2 - 20;
const SLIDE_DURATION = 0.3;
const REROLL_BTN_W = 90;
const REROLL_BTN_H = 28;

export class CardPickOverlay {
  constructor(game, xpSystem, systems) {
    this.game = game;
    this.xpSystem = xpSystem;
    this.systems = systems;

    this.visible = false;
    this.cards = [];
    this.slideTimer = 0;
    this.selectedIndex = -1;
    this.cardCount = 3;

    this.mode = 'levelup';
    this.bonusCallback = null;
    this.rerollsLeft = 0;
    this.synergySystem = null; // set externally
    this.metaProgression = null; // set externally for card unlocks + quality

    eventBus.on('levelUp', () => this.show());
    eventBus.on('pointerDown', (pos) => this.handleTap(pos));
  }

  show() {
    this.visible = true;
    this.slideTimer = 0;
    this.selectedIndex = -1;
    this.mode = 'levelup';
    this.bonusCallback = null;
    this.cardCount = 3;
    this.rerollsLeft = this.xpSystem.rerollsPerPick || 0;
    this.cards = this.drawCards(3);
    this.injectSynergy();
  }

  showBonus(count, callback) {
    this.visible = true;
    this.slideTimer = 0;
    this.selectedIndex = -1;
    this.mode = 'bonus';
    this.bonusCallback = callback || null;
    this.cardCount = count;
    this.rerollsLeft = this.xpSystem.rerollsPerPick || 0;
    this.cards = this.drawCards(count);
    this.injectSynergy();
  }

  /** If a synergy is available, add it as an extra card */
  injectSynergy() {
    if (!this.synergySystem) return;
    this.synergySystem.check();
    const syn = this.synergySystem.getAvailableSynergy();
    if (syn) {
      // Wrap synergy def as a card-like object
      this.cards.push({
        id: `synergy_${syn.id}`,
        name: syn.name,
        rarity: syn.rarity,
        maxLevel: 1,
        isSynergy: true,
        synergyId: syn.id,
        getDescription() { return syn.description; },
        apply(level, systems) {
          // applied via synergySystem.activate
        },
      });
    }
  }

  drawCards(count) {
    const available = CARD_DEFS.filter(c => {
      const held = this.xpSystem.heldCards[c.id] || 0;
      if (c.maxLevel !== Infinity && held >= c.maxLevel) return false;
      if (c.requires === 'ricochet' && !this.xpSystem.ricochetUnlocked) return false;
      // Meta progression: only show unlocked cards
      if (this.metaProgression && !this.metaProgression.isCardUnlocked(c.id)) return false;
      return true;
    });

    if (available.length === 0) return [];

    // Weighted rarity selection
    const picked = [];
    const used = new Set();

    for (let i = 0; i < count && used.size < available.length; i++) {
      const card = this.weightedPick(available, used);
      if (card) {
        picked.push(card);
        used.add(card.id);
      }
    }

    return picked;
  }

  weightedPick(available, usedIds) {
    // Build weighted pool
    const pool = available.filter(c => !usedIds.has(c.id));
    if (pool.length === 0) return null;

    // Level-scaled rarity weights + card quality meta bonus
    const levelWeights = { ...getRarityWeights(this.xpSystem.level) };
    if (this.metaProgression) {
      const bonus = this.metaProgression.getCardQualityBonus();
      if (bonus > 0) {
        const shift = Math.min(bonus, levelWeights.common);
        levelWeights.common -= shift;
        levelWeights.uncommon += Math.floor(shift * 0.6);
        levelWeights.rare += Math.ceil(shift * 0.4);
      }
    }

    // Calculate total weight
    let totalWeight = 0;
    const weights = pool.map(c => {
      const w = levelWeights[c.rarity] || 1;
      totalWeight += w;
      return w;
    });

    // Roll
    let roll = Math.random() * totalWeight;
    for (let i = 0; i < pool.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  }

  handleTap(pos) {
    if (!this.visible) return;
    if (this.slideTimer < SLIDE_DURATION) return;

    // Check reroll button
    if (this.rerollsLeft > 0 && this.hitTestRerollBtn(pos.x, pos.y)) {
      this.rerollsLeft--;
      // Preserve synergy card on reroll
      const synCard = this.cards.find(c => c.isSynergy);
      this.cards = this.drawCards(this.cardCount);
      if (synCard) this.cards.push(synCard);
      this.slideTimer = SLIDE_DURATION * 0.5;
      return;
    }

    // Check card taps
    for (let i = 0; i < this.cards.length; i++) {
      const rect = this.getCardRect(i);
      if (
        pos.x >= rect.x && pos.x <= rect.x + rect.w &&
        pos.y >= rect.y && pos.y <= rect.y + rect.h
      ) {
        this.selectCard(i);
        return;
      }
    }
  }

  hitTestRerollBtn(x, y) {
    const btnX = (CONFIG.CANVAS_WIDTH - REROLL_BTN_W) / 2;
    const btnY = CARD_Y_TARGET + CARD_H + 20;
    return x >= btnX && x <= btnX + REROLL_BTN_W && y >= btnY && y <= btnY + REROLL_BTN_H;
  }

  getCardRect(index) {
    const count = this.cards.length;
    const totalW = count * CARD_W + (count - 1) * CARD_GAP;
    const startX = (CONFIG.CANVAS_WIDTH - totalW) / 2;

    const slideProgress = Math.min(this.slideTimer / SLIDE_DURATION, 1);
    const ease = 1 - Math.pow(1 - slideProgress, 3);
    const yOffset = (1 - ease) * 200;

    return {
      x: startX + index * (CARD_W + CARD_GAP),
      y: CARD_Y_TARGET + yOffset,
      w: CARD_W,
      h: CARD_H,
    };
  }

  selectCard(index) {
    const cardDef = this.cards[index];
    if (!cardDef) return;
    this.visible = false;

    // Synergy card
    if (cardDef.isSynergy) {
      if (this.synergySystem) {
        this.synergySystem.activate(cardDef.synergyId);
      }
      if (this.mode === 'bonus') {
        if (this.bonusCallback) this.bonusCallback();
      } else {
        this.game.setState(STATES.COMBAT);
      }
      return;
    }

    if (this.mode === 'bonus') {
      const currentLevel = this.xpSystem.heldCards[cardDef.id] || 0;
      const newLevel = currentLevel + 1;
      this.xpSystem.heldCards[cardDef.id] = newLevel;
      cardDef.apply(newLevel, this.systems);
      if (this.bonusCallback) this.bonusCallback();
    } else {
      this.xpSystem.pickCard(cardDef, this.systems);
    }
  }

  update(dt, state) {
    if (!this.visible) return;
    this.slideTimer += dt;
  }

  render(ctx, state) {
    if (!this.visible) return;

    // Dim overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

    // Header
    if (this.mode === 'bonus') {
      ctx.fillStyle = '#ffd700';
      ctx.font = '18px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('BONUS CARD', CONFIG.CANVAS_WIDTH / 2, CARD_Y_TARGET - 30);

      ctx.fillStyle = '#7777aa';
      ctx.font = '11px monospace';
      ctx.fillText('Module placed! Pick a bonus', CONFIG.CANVAS_WIDTH / 2, CARD_Y_TARGET - 12);
    } else {
      ctx.fillStyle = '#00e5a0';
      ctx.font = '18px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('LEVEL UP', CONFIG.CANVAS_WIDTH / 2, CARD_Y_TARGET - 30);

      ctx.fillStyle = '#7777aa';
      ctx.font = '11px monospace';
      ctx.fillText('Choose a card', CONFIG.CANVAS_WIDTH / 2, CARD_Y_TARGET - 12);
    }

    // Draw cards
    for (let i = 0; i < this.cards.length; i++) {
      this.renderCard(ctx, i);
    }

    // Reroll button
    if (this.rerollsLeft > 0) {
      const btnX = (CONFIG.CANVAS_WIDTH - REROLL_BTN_W) / 2;
      const btnY = CARD_Y_TARGET + CARD_H + 20;

      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(btnX, btnY, REROLL_BTN_W, REROLL_BTN_H);
      ctx.strokeStyle = '#aa55ff';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(btnX, btnY, REROLL_BTN_W, REROLL_BTN_H);

      ctx.fillStyle = '#aa55ff';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`REROLL (${this.rerollsLeft})`, CONFIG.CANVAS_WIDTH / 2, btnY + 18);
    }
  }

  renderCard(ctx, index) {
    const cardDef = this.cards[index];
    const isSynergy = cardDef.isSynergy;
    const heldLevel = isSynergy ? 0 : (this.xpSystem.heldCards[cardDef.id] || 0);
    const nextLevel = heldLevel + 1;
    const isUpgrade = !isSynergy && heldLevel > 0;
    const rect = this.getCardRect(index);
    const { x, y, w, h } = rect;
    const borderColor = isSynergy ? '#cc44ff' : (RARITY_COLORS[cardDef.rarity] || '#777788');

    // Card background
    ctx.save();
    this.roundRect(ctx, x, y, w, h, CARD_RADIUS);
    ctx.fillStyle = '#0d0d1a';
    ctx.fill();

    // Border
    this.roundRect(ctx, x, y, w, h, CARD_RADIUS);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner highlight
    ctx.fillStyle = borderColor;
    ctx.globalAlpha = 0.15;
    this.roundRect(ctx, x + 2, y + 2, w - 4, 30, CARD_RADIUS - 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Synergy glow
    if (isSynergy) {
      ctx.shadowColor = '#cc44ff';
      ctx.shadowBlur = 12;
      this.roundRect(ctx, x, y, w, h, CARD_RADIUS);
      ctx.strokeStyle = '#cc44ff';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    ctx.restore();

    // Synergy label
    if (isSynergy) {
      ctx.fillStyle = '#cc44ff';
      ctx.font = 'bold 7px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SYNERGY', x + w / 2, y + 16);
    }

    // Upgrade badge
    if (isUpgrade) {
      ctx.fillStyle = '#00e5a0';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`LV ${nextLevel}`, x + w - 6, y + 16);
    }

    // Rarity label (not for synergies — they show SYNERGY label above)
    if (!isSynergy) {
      ctx.fillStyle = borderColor;
      ctx.font = '7px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(cardDef.rarity.toUpperCase(), x + 6, y + 16);
    }

    // Card name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(cardDef.name, x + w / 2, y + 38);

    // Icon placeholder
    const iconSize = 18;
    const iconX = x + (w - iconSize) / 2;
    const iconY = y + 46;
    ctx.fillStyle = borderColor;
    ctx.globalAlpha = 0.3;
    ctx.fillRect(iconX, iconY, iconSize, iconSize);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(iconX, iconY, iconSize, iconSize);

    // Description
    const desc = cardDef.getDescription
      ? cardDef.getDescription(nextLevel)
      : '';
    ctx.fillStyle = '#9999bb';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    this.wrapText(ctx, desc, x + w / 2, y + 82, w - 14, 11);
  }

  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let lineY = y;

    for (const word of words) {
      const test = line + (line ? ' ' : '') + word;
      const metrics = ctx.measureText(test);
      if (metrics.width > maxWidth && line) {
        ctx.fillText(line, x, lineY);
        line = word;
        lineY += lineHeight;
      } else {
        line = test;
      }
    }
    if (line) {
      ctx.fillText(line, x, lineY);
    }
  }
}
