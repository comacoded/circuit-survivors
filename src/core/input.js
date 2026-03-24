import { CONFIG } from './config.js';
import { eventBus } from './eventBus.js';

export class InputManager {
  constructor(canvas, scaleX, scaleY) {
    this.canvas = canvas;
    this.scaleX = scaleX;
    this.scaleY = scaleY;

    // Cache bounding rect — update on resize (avoids layout thrash per touch)
    this.rect = canvas.getBoundingClientRect();

    this.setupTouchInput();
    this.setupMouseInput();
    this.preventBrowserGestures();
  }

  getCanvasPos(clientX, clientY) {
    return {
      x: (clientX - this.rect.left) / this.scaleX,
      y: (clientY - this.rect.top) / this.scaleY,
    };
  }

  setupTouchInput() {
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const pos = this.getCanvasPos(touch.clientX, touch.clientY);
      eventBus.emit('pointerDown', pos);
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const pos = this.getCanvasPos(touch.clientX, touch.clientY);
      eventBus.emit('pointerMove', pos);
    }, { passive: false });

    this.canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      // Emit last known position from changedTouches for touch-up action
      if (e.changedTouches.length > 0) {
        const touch = e.changedTouches[0];
        const pos = this.getCanvasPos(touch.clientX, touch.clientY);
        eventBus.emit('pointerUp', pos);
      } else {
        eventBus.emit('pointerUp', {});
      }
    }, { passive: false });

    this.canvas.addEventListener('touchcancel', (e) => {
      e.preventDefault();
      eventBus.emit('pointerUp', {});
    }, { passive: false });
  }

  setupMouseInput() {
    this.canvas.addEventListener('mousedown', (e) => {
      const pos = this.getCanvasPos(e.clientX, e.clientY);
      eventBus.emit('pointerDown', pos);
    });

    this.canvas.addEventListener('mousemove', (e) => {
      const pos = this.getCanvasPos(e.clientX, e.clientY);
      eventBus.emit('pointerMove', pos);
    });

    this.canvas.addEventListener('mouseup', (e) => {
      const pos = this.getCanvasPos(e.clientX, e.clientY);
      eventBus.emit('pointerUp', pos);
    });
  }

  /** Prevent all browser-level gestures that interfere with the game */
  preventBrowserGestures() {
    // Prevent pinch zoom on the document level
    document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
    document.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false });
    document.addEventListener('gestureend', (e) => e.preventDefault(), { passive: false });

    // Prevent double-tap zoom
    let lastTap = 0;
    document.addEventListener('touchend', (e) => {
      const now = Date.now();
      if (now - lastTap < 300) e.preventDefault();
      lastTap = now;
    }, { passive: false });
  }

  updateScale(scaleX, scaleY) {
    this.scaleX = scaleX;
    this.scaleY = scaleY;
    // Recache bounding rect on resize
    this.rect = this.canvas.getBoundingClientRect();
  }
}
