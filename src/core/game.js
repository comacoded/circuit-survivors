import { CONFIG, STATES } from './config.js';
import { eventBus } from './eventBus.js';

export class Game {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.state = STATES.MENU;
    this.previousState = null;
    this.lastTime = 0;
    this.deltaTime = 0;
    this.running = false;
    this.systems = [];
    this.particleSystem = null; // set externally for shake access

    // Zoom system — steps out at level milestones
    this.zoom = 1.0;
    this.zoomTarget = 1.0;
    this.zoomSpeed = 1.2; // lerp speed per second
  }

  addSystem(system) {
    this.systems.push(system);
  }

  setState(newState) {
    this.previousState = this.state;
    this.state = newState;
    eventBus.emit('stateChange', { from: this.previousState, to: newState });
  }

  start() {
    this.running = true;
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  stop() {
    this.running = false;
  }

  loop(timestamp) {
    if (!this.running) return;

    this.deltaTime = (timestamp - this.lastTime) / 1000;
    if (this.deltaTime > 0.1) this.deltaTime = 0.1;
    this.lastTime = timestamp;

    this.update(this.deltaTime);
    this.render();

    requestAnimationFrame((t) => this.loop(t));
  }

  setZoomTarget(z) {
    this.zoomTarget = Math.max(0.5, Math.min(1.0, z));
  }

  update(dt) {
    // Smooth zoom lerp
    if (Math.abs(this.zoom - this.zoomTarget) > 0.001) {
      this.zoom += (this.zoomTarget - this.zoom) * Math.min(1, this.zoomSpeed * dt);
    } else {
      this.zoom = this.zoomTarget;
    }

    for (const system of this.systems) {
      if (system.update) {
        system.update(dt, this.state);
      }
    }
  }

  render() {
    const { ctx } = this;
    const W = CONFIG.CANVAS_WIDTH;
    const H = CONFIG.CANVAS_HEIGHT;
    ctx.clearRect(0, 0, W, H);

    // Apply zoom + screen shake
    const shakeX = this.particleSystem ? this.particleSystem.shakeX : 0;
    const shakeY = this.particleSystem ? this.particleSystem.shakeY : 0;
    const needsTransform = this.zoom !== 1 || shakeX !== 0 || shakeY !== 0;

    if (needsTransform) {
      ctx.save();
      // Zoom from canvas center
      if (this.zoom !== 1) {
        ctx.translate(W / 2, H / 2);
        ctx.scale(this.zoom, this.zoom);
        ctx.translate(-W / 2, -H / 2);
      }
      if (shakeX !== 0 || shakeY !== 0) {
        ctx.translate(Math.round(shakeX), Math.round(shakeY));
      }
    }

    for (const system of this.systems) {
      if (system.render) {
        system.render(ctx, this.state);
      }
    }

    if (needsTransform) {
      ctx.restore();
    }
  }
}
