import { CONFIG, STATES } from './core/config.js';
import { Game } from './core/game.js';
import { InputManager } from './core/input.js';
import { eventBus } from './core/eventBus.js';
import { Chip } from './entities/chip.js';
import { EnemyManager } from './systems/enemyManager.js';
import { AttackSystem } from './systems/attackSystem.js';
import { XpSystem } from './systems/xpSystem.js';
import { ParticleSystem } from './systems/particleSystem.js';
import { GridManager } from './systems/gridManager.js';
import { SynergySystem } from './systems/synergySystem.js';
import { MetaProgression } from './systems/metaProgression.js';
import { CardPickOverlay } from './ui/cardPickOverlay.js';
import { HUD } from './ui/hud.js';
import { GameOverScreen } from './ui/gameOverScreen.js';
import { BuildPalette } from './ui/buildPalette.js';
import { MetaShop } from './ui/metaShop.js';
import { MainMenu } from './ui/mainMenu.js';
import { CHIP_VARIANTS } from './data/chipVariants.js';
import { createModule } from './entities/module.js';
import { CARD_DEFS } from './data/cards.js';
import { AudioManager } from './systems/audioManager.js';
import './systems/haptics.js'; // binds haptic events — no-op on web

// ── Pre-render static background grid to offscreen canvas ───
function createBackgroundCanvas() {
  const bg = document.createElement('canvas');
  bg.width = CONFIG.CANVAS_WIDTH;
  bg.height = CONFIG.CANVAS_HEIGHT;
  const bgCtx = bg.getContext('2d');

  bgCtx.fillStyle = '#050510';
  bgCtx.fillRect(0, 0, bg.width, bg.height);

  bgCtx.strokeStyle = '#0a0a15';
  bgCtx.lineWidth = 1;
  for (let x = 0; x < bg.width; x += CONFIG.TILE_SIZE) {
    bgCtx.beginPath(); bgCtx.moveTo(x + 0.5, 0); bgCtx.lineTo(x + 0.5, bg.height); bgCtx.stroke();
  }
  for (let y = 0; y < bg.height; y += CONFIG.TILE_SIZE) {
    bgCtx.beginPath(); bgCtx.moveTo(0, y + 0.5); bgCtx.lineTo(bg.width, y + 0.5); bgCtx.stroke();
  }

  bgCtx.fillStyle = '#0e0e1a';
  for (let x = 0; x < bg.width; x += CONFIG.TILE_SIZE) {
    for (let y = 0; y < bg.height; y += CONFIG.TILE_SIZE) {
      bgCtx.fillRect(x, y, 1, 1);
    }
  }
  return bg;
}

function initCanvas() {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  canvas.width = CONFIG.CANVAS_WIDTH;
  canvas.height = CONFIG.CANVAS_HEIGHT;

  function resize() {
    const windowW = window.innerWidth;
    const windowH = window.innerHeight;
    const targetRatio = CONFIG.CANVAS_WIDTH / CONFIG.CANVAS_HEIGHT;
    const windowRatio = windowW / windowH;
    let displayW, displayH;
    if (windowRatio < targetRatio) { displayW = windowW; displayH = windowW / targetRatio; }
    else { displayH = windowH; displayW = windowH * targetRatio; }
    canvas.style.width = `${displayW}px`;
    canvas.style.height = `${displayH}px`;
    return { scaleX: displayW / CONFIG.CANVAS_WIDTH, scaleY: displayH / CONFIG.CANVAS_HEIGHT };
  }

  const scale = resize();
  ctx.imageSmoothingEnabled = false;
  window.addEventListener('resize', () => {
    const newScale = resize();
    if (window._inputManager) window._inputManager.updateScale(newScale.scaleX, newScale.scaleY);
  });
  return { canvas, ctx, scale };
}

function init() {
  const { canvas, ctx, scale } = initCanvas();
  const inputManager = new InputManager(canvas, scale.scaleX, scale.scaleY);
  window._inputManager = inputManager;

  const bgCanvas = createBackgroundCanvas();

  const game = new Game(canvas, ctx);
  const chip = new Chip();
  const enemyManager = new EnemyManager(chip);
  const attackSystem = new AttackSystem(chip, enemyManager);
  const xpSystem = new XpSystem(game, chip);
  const particleSystem = new ParticleSystem();
  const gridManager = new GridManager(chip);
  const meta = new MetaProgression();
  meta.chip = chip;

  game.particleSystem = particleSystem;

  attackSystem.gridManager = gridManager;
  attackSystem.xpSystem = xpSystem;
  enemyManager.gridManager = gridManager;
  enemyManager.xpSystem = xpSystem;
  gridManager.xpSystem = xpSystem;
  gridManager.metaProgression = meta;

  const systems = { attackSystem, xpSystem, chip, gridManager, enemyManager };
  const synergySystem = new SynergySystem(xpSystem, gridManager, chip, attackSystem);
  const cardPickOverlay = new CardPickOverlay(game, xpSystem, systems);
  cardPickOverlay.synergySystem = synergySystem;
  cardPickOverlay.metaProgression = meta;

  const audio = new AudioManager();
  const hud = new HUD(chip, enemyManager, xpSystem, audio);
  const buildPalette = new BuildPalette(game, xpSystem, gridManager, cardPickOverlay);
  const metaShop = new MetaShop(meta);

  // ── Run management ──────────────────────────────────────
  function resetAndStartRun() {
    // Get selected variant before reset
    const variantId = meta.getSelectedVariant();
    const variant = CHIP_VARIANTS[variantId] || CHIP_VARIANTS.standard;

    // Handle Quantum grid override (must happen before gridManager.reset)
    if (variant.gridCols !== CONFIG.GRID_COLS || variant.gridRows !== CONFIG.GRID_ROWS) {
      CONFIG._origCols = CONFIG._origCols || CONFIG.GRID_COLS;
      CONFIG._origRows = CONFIG._origRows || CONFIG.GRID_ROWS;
      CONFIG.GRID_COLS = variant.gridCols;
      CONFIG.GRID_ROWS = variant.gridRows;
    } else if (CONFIG._origCols) {
      CONFIG.GRID_COLS = CONFIG._origCols;
      CONFIG.GRID_ROWS = CONFIG._origRows;
    }

    chip.reset();
    chip.applyVariant(variant);

    enemyManager.reset();
    attackSystem.reset();
    xpSystem.reset();
    particleSystem.reset();
    gridManager.reset();
    synergySystem.reset();
    buildPalette.reset();

    // Apply permanent upgrades (stacks on top of variant stats)
    meta.applyUpgrades(systems);
    meta.startRun();

    // Reset zoom and audio
    game.zoom = 1.0;
    game.zoomTarget = 1.0;
    audio.reset();

    // ── Variant start bonuses ──────────────────────────────
    if (variant.startBonus === 'extraCard') {
      // Overclocked: extra card pick at start
      game.setState(STATES.LEVEL_UP);
      cardPickOverlay.show();
      return; // don't set COMBAT yet — card pick will transition
    }

    if (variant.startBonus === 'preplacedRelays') {
      // Fortified: 2 relay modules north and south of chip
      const northMod = createModule('relay');
      const southMod = createModule('relay');
      gridManager.placeModule(chip.gridCol, chip.gridRow - 1, northMod);
      gridManager.placeModule(chip.gridCol, chip.gridRow + 1, southMod);
    }

    if (variant.startBonus === 'randomStart') {
      // Experimental: +10 resources, 1 random module, 2 random card picks
      xpSystem.resources += 10;
      // Place a random module adjacent to chip
      const modTypes = ['attack', 'relay', 'tesla'];
      const randomType = modTypes[Math.floor(Math.random() * modTypes.length)];
      const randomMod = createModule(randomType);
      const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
      const dir = dirs[Math.floor(Math.random() * dirs.length)];
      gridManager.placeModule(chip.gridCol + dir[0], chip.gridRow + dir[1], randomMod);

      // Apply 2 random cards
      const available = CARD_DEFS.filter(c => meta.isCardUnlocked(c.id));
      for (let i = 0; i < 2 && available.length > 0; i++) {
        const idx = Math.floor(Math.random() * available.length);
        const card = available.splice(idx, 1)[0];
        xpSystem.pickCard(card, systems);
      }
    }

    if (variant.startBonus === 'doubleModuleEffects') {
      // Quantum: flag for doubled module effects (read by gridManager/attackSystem)
      xpSystem.quantumDoubleEffects = true;
    }

    game.setState(STATES.COMBAT);
  }

  function goToMenu() {
    game.setState(STATES.MENU);
  }

  const gameOverScreen = new GameOverScreen(
    game, chip, enemyManager, xpSystem, meta, metaShop,
    resetAndStartRun, goToMenu
  );

  const mainMenu = new MainMenu(game, meta, metaShop, resetAndStartRun);

  // ── Background system ──────────────────────────────────
  game.addSystem({
    render(ctx) { ctx.drawImage(bgCanvas, 0, 0); },
  });

  // ── Main game system ──────────────────────────────────
  game.addSystem({
    update(dt, state) {
      if (state === STATES.COMBAT) {
        chip.update(dt);
        gridManager.update(dt);
        enemyManager.update(dt, state);
        attackSystem.update(dt, state);
        xpSystem.update(dt, state);
        particleSystem.update(dt, state);
        audio.updateMusic(dt, enemyManager.elapsedTime);

        if (chip.integrity <= 0) {
          audio.playGameOver();
          game.setState(STATES.GAME_OVER);
          gameOverScreen.show(systems);
        }
      }
      if (state === STATES.LEVEL_UP) {
        cardPickOverlay.update(dt, state);
        particleSystem.update(dt, state);
      }
      if (state === STATES.BUILD_PHASE) {
        chip.update(dt);
        gridManager.update(dt);
        buildPalette.update(dt, state);
        cardPickOverlay.update(dt, state);
      }
      if (state === STATES.GAME_OVER) {
        gameOverScreen.update(dt, state);
      }
      if (state === STATES.MENU) {
        mainMenu.update(dt);
      }
    },
    render(ctx, state) {
      if (state === STATES.COMBAT || state === STATES.LEVEL_UP || state === STATES.BUILD_PHASE) {
        gridManager.render(ctx, state);
        enemyManager.render(ctx, state);
        chip.render(ctx);
        attackSystem.render(ctx, state);
        particleSystem.render(ctx, state);
        hud.render(ctx, state);
        buildPalette.render(ctx, state);
      }
      if (state === STATES.LEVEL_UP || state === STATES.BUILD_PHASE) {
        cardPickOverlay.render(ctx, state);
      }
      if (state === STATES.GAME_OVER) {
        gridManager.render(ctx, STATES.COMBAT);
        enemyManager.render(ctx, STATES.COMBAT);
        chip.render(ctx);
        attackSystem.render(ctx, STATES.COMBAT);
        gameOverScreen.render(ctx, state);
      }
      if (state === STATES.MENU) {
        mainMenu.render(ctx);
      }
    },
  });

  // Initialize audio on first user interaction (mobile audio policy)
  eventBus.on('pointerDown', () => {
    if (!audio.initialized) {
      audio.init();
      audio.muted = false; // unmute on first tap
      if (audio.masterGain) {
        audio.masterGain.gain.setTargetAtTime(audio.masterVolume, audio.ctx.currentTime, 0.05);
      }
    }
  });

  // Boss killed → guaranteed bonus card pick
  eventBus.on('bossKilled', () => {
    if (game.state === STATES.COMBAT) {
      game.setState(STATES.LEVEL_UP);
      cardPickOverlay.show();
    }
  });

  // Every 5 levels: zoom out + threat escalation alert
  eventBus.on('levelUp', (level) => {
    if (level > 0 && level % 5 === 0) {
      // Zoom out one step — 5% smaller per milestone, down to 0.65x
      const milestone = Math.floor(level / 5);
      game.setZoomTarget(Math.max(0.65, 1.0 - milestone * 0.05));

      // Trigger threat alert
      eventBus.emit('threatEscalation', { level, milestone });
    }
  });

  game.start();
  window._game = game;
  window._chip = chip;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
