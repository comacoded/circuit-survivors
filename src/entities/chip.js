import { CONFIG } from '../core/config.js';

const TWO_PI = Math.PI * 2;

export class Chip {
  constructor() {
    // Grid position — single center tile
    this.gridCol = Math.floor(CONFIG.GRID_COLS / 2);
    this.gridRow = Math.floor(CONFIG.GRID_ROWS / 2);

    // Pixel position of the play area grid
    this.gridOffsetX = Math.floor((CONFIG.CANVAS_WIDTH - CONFIG.GRID_COLS * CONFIG.TILE_SIZE) / 2);
    this.gridOffsetY = Math.floor((CONFIG.CANVAS_HEIGHT - CONFIG.GRID_ROWS * CONFIG.TILE_SIZE) / 2);

    // Center pixel position
    this.x = this.gridOffsetX + (this.gridCol + 0.5) * CONFIG.TILE_SIZE;
    this.y = this.gridOffsetY + (this.gridRow + 0.5) * CONFIG.TILE_SIZE;

    // Body bounds (1 tile)
    const ts = CONFIG.TILE_SIZE;
    this.bodyX = this.gridOffsetX + this.gridCol * ts;
    this.bodyY = this.gridOffsetY + this.gridRow * ts;
    this.bodyW = ts;
    this.bodyH = ts;

    // Stats (defaults — overridden by variant)
    this.maxIntegrity = 100;
    this.integrity = this.maxIntegrity;
    this.signalRange = 150;
    this.attackRange = 180;
    this.processingPower = 5;

    // Variant visual state
    this.variantId = 'standard';
    this.accentColor = '#00e5a0';
    this.pulseSpeed = 2;
    this.borderWidth = 1.5;

    // Visual state
    this.damageFlashTimer = 0;
    this.pulsePhase = 0;
    this.glitchTimer = 0; // for experimental variant
  }

  /** Apply a variant's base stats and visuals */
  applyVariant(variant) {
    this.variantId = variant.id;
    this.maxIntegrity = variant.integrity;
    this.integrity = variant.integrity;
    this.processingPower = variant.processing;
    this.signalRange = variant.signalRange;
    this.attackRange = variant.attackRange;
    this.accentColor = variant.color;
    this.pulseSpeed = variant.pulseSpeed;
    this.borderWidth = variant.borderWidth;

    // Handle grid size change (Quantum)
    if (variant.gridCols !== CONFIG.GRID_COLS || variant.gridRows !== CONFIG.GRID_ROWS) {
      this.gridCol = Math.floor(variant.gridCols / 2);
      this.gridRow = Math.floor(variant.gridRows / 2);
      this.gridOffsetX = Math.floor((CONFIG.CANVAS_WIDTH - variant.gridCols * CONFIG.TILE_SIZE) / 2);
      this.gridOffsetY = Math.floor((CONFIG.CANVAS_HEIGHT - variant.gridRows * CONFIG.TILE_SIZE) / 2);
      this.x = this.gridOffsetX + (this.gridCol + 0.5) * CONFIG.TILE_SIZE;
      this.y = this.gridOffsetY + (this.gridRow + 0.5) * CONFIG.TILE_SIZE;
      const ts = CONFIG.TILE_SIZE;
      this.bodyX = this.gridOffsetX + this.gridCol * ts;
      this.bodyY = this.gridOffsetY + this.gridRow * ts;
    }
  }

  takeDamage(amount) {
    this.integrity = Math.max(0, this.integrity - amount);
    this.damageFlashTimer = 0.2;
  }

  reset() {
    this.maxIntegrity = 100;
    this.integrity = this.maxIntegrity;
    this.signalRange = 150;
    this.attackRange = 180;
    this.processingPower = 5;
    this.damageFlashTimer = 0;
    this.pulsePhase = 0;
    this.glitchTimer = 0;
    this.variantId = 'standard';
    this.accentColor = '#00e5a0';
    this.pulseSpeed = 2;
    this.borderWidth = 1.5;

    // Reset grid position to default
    this.gridCol = Math.floor(CONFIG.GRID_COLS / 2);
    this.gridRow = Math.floor(CONFIG.GRID_ROWS / 2);
    this.gridOffsetX = Math.floor((CONFIG.CANVAS_WIDTH - CONFIG.GRID_COLS * CONFIG.TILE_SIZE) / 2);
    this.gridOffsetY = Math.floor((CONFIG.CANVAS_HEIGHT - CONFIG.GRID_ROWS * CONFIG.TILE_SIZE) / 2);
    this.x = this.gridOffsetX + (this.gridCol + 0.5) * CONFIG.TILE_SIZE;
    this.y = this.gridOffsetY + (this.gridRow + 0.5) * CONFIG.TILE_SIZE;
    const ts = CONFIG.TILE_SIZE;
    this.bodyX = this.gridOffsetX + this.gridCol * ts;
    this.bodyY = this.gridOffsetY + this.gridRow * ts;
    this.bodyW = ts;
    this.bodyH = ts;
  }

  isInSignalRange(px, py) {
    const dx = px - this.x;
    const dy = py - this.y;
    return dx * dx + dy * dy <= this.signalRange * this.signalRange;
  }

  update(dt) {
    this.pulsePhase += dt * this.pulseSpeed;
    if (this.pulsePhase > TWO_PI) this.pulsePhase -= TWO_PI;

    if (this.damageFlashTimer > 0) this.damageFlashTimer -= dt;

    // Experimental glitch timer
    if (this.variantId === 'experimental') {
      this.glitchTimer += dt;
    }
  }

  render(ctx) {
    const { bodyX, bodyY, bodyW, bodyH } = this;
    const ts = CONFIG.TILE_SIZE;
    const healthPct = this.integrity / this.maxIntegrity;
    const pulseIntensity = 0.3 + 0.7 * healthPct;
    const pulse = Math.sin(this.pulsePhase) * 0.5 + 0.5;
    const glowAlpha = 0.08 + 0.12 * pulse * pulseIntensity;
    const isFlashing = this.damageFlashTimer > 0;
    const accent = this.accentColor;

    const cx = bodyX + bodyW / 2;
    const cy = bodyY + bodyH / 2;

    // Parse accent color for rgba usage
    const r = parseInt(accent.slice(1, 3), 16);
    const g = parseInt(accent.slice(3, 5), 16);
    const b = parseInt(accent.slice(5, 7), 16);
    const rgba = (a) => `rgba(${r}, ${g}, ${b}, ${a})`;

    // --- Quantum prismatic shimmer ---
    let renderAccent = accent;
    if (this.variantId === 'quantum') {
      const hue = (this.pulsePhase * 60) % 360;
      renderAccent = `hsl(${hue}, 80%, 70%)`;
    }

    // --- Experimental glitch offset ---
    let gx = 0, gy = 0;
    if (this.variantId === 'experimental' && Math.random() < 0.05) {
      gx = (Math.random() - 0.5) * 3;
      gy = (Math.random() - 0.5) * 2;
    }

    ctx.save();
    if (gx !== 0 || gy !== 0) ctx.translate(gx, gy);

    // --- Range circle ---
    const displayRange = Math.max(this.signalRange, this.attackRange);
    ctx.beginPath();
    ctx.arc(this.x, this.y, displayRange, 0, TWO_PI);
    ctx.fillStyle = 'rgba(200, 200, 220, 0.04)';
    ctx.fill();
    ctx.strokeStyle = `rgba(200, 200, 220, ${0.08 + 0.04 * pulse})`;
    ctx.lineWidth = 1;
    ctx.stroke();

    // --- Outer glow ---
    ctx.save();
    ctx.shadowColor = isFlashing ? '#ff3355' : (this.variantId === 'quantum' ? renderAccent : accent);
    ctx.shadowBlur = 6 + 4 * pulse * pulseIntensity;
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fillRect(bodyX - 2, bodyY - 2, bodyW + 4, bodyH + 4);
    ctx.restore();

    // --- Gold pins (3 per side) ---
    const pinW = 4;
    const pinH = 2;
    ctx.fillStyle = '#ffd700';
    for (let i = 0; i < 3; i++) {
      const off = 5 + i * 9;
      ctx.fillRect(bodyX + off, bodyY - pinH, pinW, pinH);
      ctx.fillRect(bodyX + off, bodyY + bodyH, pinW, pinH);
      ctx.fillRect(bodyX - pinH, bodyY + off, pinH, pinW);
      ctx.fillRect(bodyX + bodyW, bodyY + off, pinH, pinW);
    }

    // --- Silicon body ---
    ctx.fillStyle = isFlashing ? '#3a1020' : '#1a1a2e';
    ctx.fillRect(bodyX, bodyY, bodyW, bodyH);

    // --- Border (variant width + color) ---
    ctx.strokeStyle = isFlashing ? '#ff3355' : (this.variantId === 'quantum' ? renderAccent : accent);
    ctx.lineWidth = this.borderWidth;
    ctx.strokeRect(bodyX + 0.5, bodyY + 0.5, bodyW - 1, bodyH - 1);

    // --- Inner circuit traces ---
    const traceAlpha = isFlashing
      ? 0.3 + 0.2 * pulse
      : 0.15 + 0.1 * pulse * pulseIntensity;
    ctx.strokeStyle = isFlashing
      ? `rgba(255, 51, 85, ${traceAlpha})`
      : rgba(traceAlpha);
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(bodyX + 4, cy - 4);
    ctx.lineTo(cx - 2, cy - 4);
    ctx.lineTo(cx + 4, cy - 8);
    ctx.lineTo(bodyX + bodyW - 4, cy - 8);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(bodyX + 4, cy + 5);
    ctx.lineTo(cx - 4, cy + 5);
    ctx.lineTo(cx + 2, cy + 9);
    ctx.lineTo(bodyX + bodyW - 4, cy + 9);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx - 6, bodyY + 4);
    ctx.lineTo(cx - 6, cy - 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx + 6, bodyY + bodyH - 4);
    ctx.lineTo(cx + 6, cy + 2);
    ctx.stroke();

    // --- Central die ---
    const dieSize = 8;
    const dieX = cx - dieSize / 2;
    const dieY = cy - dieSize / 2;

    ctx.fillStyle = isFlashing ? '#5a1525' : '#0d0d1a';
    ctx.fillRect(dieX, dieY, dieSize, dieSize);

    const dieAlpha = isFlashing ? 0.5 + 0.3 * pulse : 0.3 + 0.2 * pulse * pulseIntensity;
    ctx.strokeStyle = isFlashing ? `rgba(255, 51, 85, ${dieAlpha})` : rgba(dieAlpha);
    ctx.lineWidth = 1;
    ctx.strokeRect(dieX, dieY, dieSize, dieSize);

    ctx.beginPath();
    ctx.moveTo(dieX + dieSize / 2, dieY + 2);
    ctx.lineTo(dieX + dieSize / 2, dieY + dieSize - 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(dieX + 2, dieY + dieSize / 2);
    ctx.lineTo(dieX + dieSize - 2, dieY + dieSize / 2);
    ctx.stroke();

    // --- Corner dots ---
    ctx.fillStyle = isFlashing
      ? `rgba(255, 51, 85, ${0.4 + 0.3 * pulse})`
      : rgba(0.3 + 0.2 * pulse * pulseIntensity);
    const dotR = 1.5;
    const corners = [
      [bodyX + 4, bodyY + 4],
      [bodyX + bodyW - 4, bodyY + 4],
      [bodyX + 4, bodyY + bodyH - 4],
      [bodyX + bodyW - 4, bodyY + bodyH - 4],
    ];
    for (const [dx, dy] of corners) {
      ctx.beginPath();
      ctx.arc(dx, dy, dotR, 0, TWO_PI);
      ctx.fill();
    }

    // --- Glow overlay ---
    ctx.fillStyle = isFlashing
      ? `rgba(255, 51, 85, ${0.06 + 0.08 * pulse})`
      : rgba(glowAlpha);
    ctx.fillRect(bodyX, bodyY, bodyW, bodyH);

    ctx.restore();
  }
}
