import { CONFIG, STATES } from '../core/config.js';
import { eventBus } from '../core/eventBus.js';

const TWO_PI = Math.PI * 2;

export class GridManager {
  constructor(chip) {
    this.chip = chip;
    this.cols = CONFIG.GRID_COLS;
    this.rows = CONFIG.GRID_ROWS;
    this.ts = CONFIG.TILE_SIZE;

    // Pixel offset of the grid's top-left corner
    this.offsetX = Math.floor((CONFIG.CANVAS_WIDTH - this.cols * this.ts) / 2);
    this.offsetY = Math.floor((CONFIG.CANVAS_HEIGHT - this.rows * this.ts) / 2);

    // 2D grid: null = empty, 'chip' = core, or a Module object
    this.grid = [];
    for (let c = 0; c < this.cols; c++) {
      this.grid[c] = [];
      for (let r = 0; r < this.rows; r++) {
        this.grid[c][r] = null;
      }
    }

    // Mark chip center tile
    this.grid[chip.gridCol][chip.gridRow] = 'chip';

    // Connection state — parallel 2D array of booleans
    this.connected = [];
    for (let c = 0; c < this.cols; c++) {
      this.connected[c] = [];
      for (let r = 0; r < this.rows; r++) {
        this.connected[c][r] = false;
      }
    }
    this.connected[chip.gridCol][chip.gridRow] = true;

    // Trace pulse
    this.pulsePhase = 0;
    this.xpSystem = null; // set externally for Module Overclock
    this.metaProgression = null; // set externally for module durability
    this.totalModulesPlaced = 0;

    // Module regen listener
    eventBus.on('regenModules', (amount) => {
      for (const mod of this.getAllModules()) {
        if (mod.connected && !mod.destroyed) {
          mod.integrity = Math.min(mod.integrity + amount, mod.maxIntegrity);
        }
      }
    });
  }

  // ── Coordinate helpers ────────────────────────────────────
  /** Convert grid col,row to pixel center */
  gridToPixel(col, row) {
    return {
      x: this.offsetX + (col + 0.5) * this.ts,
      y: this.offsetY + (row + 0.5) * this.ts,
    };
  }

  /** Convert pixel position to grid col,row (floored) */
  pixelToGrid(px, py) {
    return {
      col: Math.floor((px - this.offsetX) / this.ts),
      row: Math.floor((py - this.offsetY) / this.ts),
    };
  }

  inBounds(col, row) {
    return col >= 0 && col < this.cols && row >= 0 && row < this.rows;
  }

  isChipTile(col, row) {
    return this.grid[col]?.[row] === 'chip';
  }

  isOccupied(col, row) {
    const cell = this.grid[col]?.[row];
    return cell != null && cell !== 'damaged';
  }

  isDamaged(col, row) {
    return this.grid[col]?.[row] === 'damaged';
  }

  // ── Adjacency ─────────────────────────────────────────────
  getOrthogonalNeighbors(col, row) {
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    const result = [];
    for (const [dc, dr] of dirs) {
      const nc = col + dc;
      const nr = row + dr;
      if (this.inBounds(nc, nr)) {
        result.push({ col: nc, row: nr });
      }
    }
    return result;
  }


  /** Get adjacent module objects (not 'chip', not null) */
  getAdjacentModules(col, row) {
    const modules = [];
    for (const n of this.getOrthogonalNeighbors(col, row)) {
      const cell = this.grid[n.col][n.row];
      if (cell && cell !== 'chip') modules.push(cell);
    }
    return modules;
  }

  // ── Placement ─────────────────────────────────────────────
  /** Returns array of {col, row} for all valid placeable tiles */
  getValidPlacements() {
    const valid = [];
    for (let c = 0; c < this.cols; c++) {
      for (let r = 0; r < this.rows; r++) {
        const cell = this.grid[c][r];
        // Can place on null or damaged tiles
        if (cell !== null && cell !== 'damaged') continue;
        if (this.isAdjacentToOccupied(c, r)) {
          valid.push({ col: c, row: r });
        }
      }
    }
    return valid;
  }

  /** Place a module at col,row. Returns true if successful. */
  placeModule(col, row, module) {
    if (!this.inBounds(col, row)) return false;
    const existing = this.grid[col][row];
    if (existing !== null && existing !== 'damaged') return false;
    if (!this.isAdjacentToOccupied(col, row)) return false;

    module.col = col;
    module.row = row;
    const pos = this.gridToPixel(col, row);
    module.x = pos.x;
    module.y = pos.y;

    // Apply module durability bonus from meta progression
    if (this.metaProgression) {
      const durBonus = this.metaProgression.getModuleDurabilityBonus();
      if (durBonus > 0) {
        module.maxIntegrity = Math.floor(module.maxIntegrity * (1 + durBonus));
        module.integrity = module.maxIntegrity;
      }
    }

    this.grid[col][row] = module;
    this.totalModulesPlaced++;
    eventBus.emit('modulePlaced', { type: module.type, col, row });
    this.recalcConnections();

    // Apply defense adjacency bonus
    if (module.type === 'defense') {
      module.maxIntegrity = this.getDefenseModuleIntegrity(col, row, 80);
      module.integrity = module.maxIntegrity;
    }

    // Recalc adjacent defense modules too
    for (const adj of this.getAdjacentModules(col, row)) {
      if (adj.type === 'defense' && adj.connected) {
        const newMax = this.getDefenseModuleIntegrity(adj.col, adj.row, 80);
        const ratio = adj.integrity / adj.maxIntegrity;
        adj.maxIntegrity = newMax;
        adj.integrity = Math.floor(newMax * ratio);
      }
    }

    return true;
  }

  /** Remove a module at col,row. Returns the removed module or null. */
  removeModule(col, row) {
    if (!this.inBounds(col, row)) return null;
    const cell = this.grid[col][row];
    if (!cell || cell === 'chip' || cell === 'damaged') return null;

    this.grid[col][row] = null;
    this.recalcConnections();
    return cell;
  }

  /** Destroy a module — leaves a damaged tile scar */
  destroyModule(col, row) {
    if (!this.inBounds(col, row)) return null;
    const cell = this.grid[col][row];
    if (!cell || cell === 'chip' || cell === 'damaged') return null;

    const destroyed = cell;
    this.grid[col][row] = 'damaged';
    this.recalcConnections();
    return destroyed;
  }

  /** Get module object at grid col,row (not chip, not damaged, not null) */
  getModuleAt(col, row) {
    if (!this.inBounds(col, row)) return null;
    const cell = this.grid[col][row];
    if (!cell || cell === 'chip' || cell === 'damaged') return null;
    return cell;
  }

  /** Find a module that an enemy at pixel position (px,py) is colliding with.
   *  Returns the module or null. */
  getModuleAtPixel(px, py) {
    const grid = this.pixelToGrid(px, py);
    if (!this.inBounds(grid.col, grid.row)) return null;
    return this.getModuleAt(grid.col, grid.row);
  }

  /** Get rebuild cost for a damaged tile (50% of original module cost) */
  getDamagedTileCost(col, row) {
    // Damaged tiles can be rebuilt at half the cheapest module cost
    return 5; // flat 50% of relay (cheapest)
  }

  /** Check if adjacent tiles consider damaged tiles as "occupied" for adjacency */
  isAdjacentToOccupied(col, row) {
    for (const n of this.getOrthogonalNeighbors(col, row)) {
      const cell = this.grid[n.col][n.row];
      if (cell && cell !== 'damaged') return true;
    }
    return false;
  }

  // ── Connection flood fill ─────────────────────────────────
  recalcConnections() {
    // Reset all
    for (let c = 0; c < this.cols; c++) {
      for (let r = 0; r < this.rows; r++) {
        this.connected[c][r] = false;
      }
    }

    // BFS from chip tile
    const queue = [{ col: this.chip.gridCol, row: this.chip.gridRow }];
    this.connected[this.chip.gridCol][this.chip.gridRow] = true;

    while (queue.length > 0) {
      const { col, row } = queue.shift();

      for (const n of this.getOrthogonalNeighbors(col, row)) {
        if (this.connected[n.col][n.row]) continue;
        const cell = this.grid[n.col][n.row];
        if (cell && cell !== 'damaged') {
          this.connected[n.col][n.row] = true;
          queue.push(n);
        }
      }
    }

    // Update module connected state
    for (let c = 0; c < this.cols; c++) {
      for (let r = 0; r < this.rows; r++) {
        const cell = this.grid[c][r];
        if (cell && cell !== 'chip') {
          cell.connected = this.connected[c][r];
        }
      }
    }
  }

  isConnected(col, row) {
    if (!this.inBounds(col, row)) return false;
    return this.connected[col][row];
  }

  /** Get all placed modules as an array */
  getAllModules() {
    const modules = [];
    for (let c = 0; c < this.cols; c++) {
      for (let r = 0; r < this.rows; r++) {
        const cell = this.grid[c][r];
        if (cell && cell !== 'chip') modules.push(cell);
      }
    }
    return modules;
  }

  // ── Update ────────────────────────────────────────────────
  update(dt) {
    this.pulsePhase += dt * 2;
    if (this.pulsePhase > TWO_PI) this.pulsePhase -= TWO_PI;

    // Update all modules
    const fwHardening = this.xpSystem ? this.xpSystem.firewallHardening : 0;
    for (let c = 0; c < this.cols; c++) {
      for (let r = 0; r < this.rows; r++) {
        const cell = this.grid[c][r];
        if (cell && cell !== 'chip') {
          cell._firewallHardening = fwHardening;
          if (cell.update) cell.update(dt);
        }
      }
    }
  }

  /** Count adjacent modules of a given type */
  countAdjacentOfType(col, row, type) {
    let count = 0;
    for (const n of this.getOrthogonalNeighbors(col, row)) {
      const cell = this.grid[n.col][n.row];
      if (cell && cell !== 'chip' && cell.type === type && this.connected[n.col][n.row]) {
        count++;
      }
    }
    return count;
  }

  /** Check if any adjacent module is a connected relay */
  hasAdjacentRelay(col, row) {
    for (const n of this.getOrthogonalNeighbors(col, row)) {
      const cell = this.grid[n.col][n.row];
      if (cell && cell !== 'chip' && cell.type === 'relay' && this.connected[n.col][n.row]) {
        return true;
      }
    }
    return false;
  }

  /** Get effective fire rate for an attack module considering adjacency */
  getAttackModuleFireRate(col, row, baseRate) {
    const adjAttack = this.countAdjacentOfType(col, row, 'attack');
    let bonus = adjAttack * 0.10; // +10% per adjacent attack module
    if (this.hasAdjacentRelay(col, row)) bonus *= 1.25; // relay boosts by 25%

    // Module Overclock: +X% fire rate per total connected module
    if (this.xpSystem && this.xpSystem.moduleOverclock) {
      const totalConnected = this.getAllModules().filter(m => m.connected).length;
      bonus += this.xpSystem.moduleOverclock * totalConnected;
    }

    // Quantum chip: double all module bonuses
    if (this.xpSystem && this.xpSystem.quantumDoubleEffects) bonus *= 2;

    return baseRate * (1 + bonus);
  }

  /** Get effective max integrity for a defense module */
  getDefenseModuleIntegrity(col, row, baseIntegrity) {
    const adjDefense = this.countAdjacentOfType(col, row, 'defense');
    let bonus = adjDefense * 0.15;
    if (this.hasAdjacentRelay(col, row)) bonus *= 1.25;
    if (this.xpSystem && this.xpSystem.quantumDoubleEffects) bonus *= 2;
    return Math.floor(baseIntegrity * (1 + bonus));
  }

  // ── Rendering ─────────────────────────────────────────────
  render(ctx, state) {
    const isBuild = state === STATES.BUILD_PHASE;
    const pulse = Math.sin(this.pulsePhase) * 0.5 + 0.5;
    const validPlacements = isBuild ? this.getValidPlacements() : null;
    const validSet = new Set();
    if (validPlacements) {
      for (const v of validPlacements) {
        validSet.add(`${v.col},${v.row}`);
      }
    }

    // Draw grid tiles
    for (let c = 0; c < this.cols; c++) {
      for (let r = 0; r < this.rows; r++) {
        const cell = this.grid[c][r];
        if (cell === 'chip') continue; // chip renders itself

        const px = this.offsetX + c * this.ts;
        const py = this.offsetY + r * this.ts;

        if (cell === 'damaged') {
          // Damaged tile scar
          ctx.fillStyle = '#0a0a12';
          ctx.fillRect(px + 1, py + 1, this.ts - 2, this.ts - 2);
          // Crack marks
          ctx.strokeStyle = '#151520';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(px + 4, py + 4);
          ctx.lineTo(px + this.ts - 8, py + this.ts / 2);
          ctx.lineTo(px + this.ts - 4, py + this.ts - 4);
          ctx.stroke();
          // Valid placement highlight during build
          if (validSet.has(`${c},${r}`)) {
            ctx.strokeStyle = `rgba(255, 170, 0, ${0.4 + 0.3 * pulse})`;
            ctx.lineWidth = 1;
            this.drawDashedRect(ctx, px + 1, py + 1, this.ts - 2, this.ts - 2, [3, 3]);
          }
        } else if (cell === null) {
          // Empty tile — subtle dotted outline
          const isValid = validSet.has(`${c},${r}`);
          if (isValid) {
            ctx.strokeStyle = `rgba(42, 42, 62, ${0.6 + 0.3 * pulse})`;
            ctx.lineWidth = 1;
            this.drawDashedRect(ctx, px + 1, py + 1, this.ts - 2, this.ts - 2, [3, 3]);
          } else {
            ctx.strokeStyle = 'rgba(26, 26, 46, 0.5)';
            ctx.lineWidth = 1;
            this.drawDashedRect(ctx, px + 1, py + 1, this.ts - 2, this.ts - 2, [2, 4]);
          }
        } else {
          // Module — it renders itself (will be implemented in module entity)
          if (cell.render) {
            cell.render(ctx, this.connected[c][r]);
          }
        }
      }
    }

    // Draw traces between connected modules/chip
    this.renderTraces(ctx, pulse);
  }

  drawDashedRect(ctx, x, y, w, h, dash) {
    ctx.setLineDash(dash);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
  }

  renderTraces(ctx, pulse) {
    const traceAlpha = 0.2 + 0.15 * pulse;
    ctx.strokeStyle = `rgba(0, 229, 160, ${traceAlpha})`;
    ctx.lineWidth = 1;

    // Draw a trace line between every adjacent pair of connected tiles
    // (including chip tile). Use a Set to avoid drawing duplicates.
    const drawn = new Set();

    for (let c = 0; c < this.cols; c++) {
      for (let r = 0; r < this.rows; r++) {
        if (!this.connected[c][r]) continue;
        const cell = this.grid[c][r];
        if (!cell) continue;

        const from = this.gridToPixel(c, r);

        // Check right and down neighbors only to avoid duplicates
        const neighbors = [
          { dc: 1, dr: 0 },
          { dc: 0, dr: 1 },
        ];

        for (const { dc, dr } of neighbors) {
          const nc = c + dc;
          const nr = r + dr;
          if (!this.inBounds(nc, nr)) continue;
          if (!this.connected[nc][nr]) continue;
          const neighbor = this.grid[nc][nr];
          if (!neighbor) continue;

          const key = `${c},${r}-${nc},${nr}`;
          if (drawn.has(key)) continue;
          drawn.add(key);

          const to = this.gridToPixel(nc, nr);

          ctx.beginPath();
          ctx.moveTo(Math.floor(from.x) + 0.5, Math.floor(from.y) + 0.5);
          ctx.lineTo(Math.floor(to.x) + 0.5, Math.floor(to.y) + 0.5);
          ctx.stroke();
        }
      }
    }
  }

  reset() {
    for (let c = 0; c < this.cols; c++) {
      for (let r = 0; r < this.rows; r++) {
        this.grid[c][r] = null;
        this.connected[c][r] = false;
      }
    }
    this.grid[this.chip.gridCol][this.chip.gridRow] = 'chip';
    this.connected[this.chip.gridCol][this.chip.gridRow] = true;
    this.pulsePhase = 0;
    this.totalModulesPlaced = 0;
  }
}
