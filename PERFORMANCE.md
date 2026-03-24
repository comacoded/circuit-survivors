# Performance Notes — Circuit Survivors

## Current Optimizations (Canvas 2D)

### Object Pools (zero-alloc hot path)
- **Projectiles**: Pool of 50+ Projectile objects. `hitEnemies` array reused via `.length = 0` (no new array per init).
- **Enemies**: Pool of 100+ Enemy objects. `lockedModules` array reused. All per-enemy state reset in `init()`.
- **Particles**: FxParticle pool (200+) in particleSystem, death burst Particle pool (300+) in enemyManager.
- **No allocations per frame** in hot loops — all entity state is pre-allocated on construction.

### Rendering Batching
- **Projectiles**: Sorted/batched by color before render — reduces `ctx.fillStyle` switches.
- **Projectile render**: Uses bitwise-OR truncation (`| 0`) instead of `Math.floor()`.
- **Background grid**: Pre-rendered to offscreen canvas (`createBackgroundCanvas()`), blitted once per frame.
- **Static text**: HUD text rendered with minimal font changes.

### Draw Call Reduction
- Enemy death burst particles use simple `fillRect` (no arcs).
- Projectiles are square `fillRect` (fastest Canvas 2D primitive).
- Grid traces rendered in a single pass with one `strokeStyle`.

### Touch Performance
- Bounding rect cached on InputManager — recalculated only on resize.
- Touch events use `{ passive: false }` where needed, true otherwise.
- No layout thrash in the input path.

## Where Pixi.js Migration Would Help

### Top Bottlenecks (profiled scenario: 80+ enemies, 20+ modules, 50+ projectiles)

1. **Enemy rendering (per-type branching)**: Each enemy type has unique rendering code in enemyManager.render(). With 80+ enemies, this means 80+ individual draw calls with ctx state changes. **Pixi.js fix**: Use sprite sheets with pre-rendered enemy type frames. One batch draw call for all enemies of same type.

2. **Projectile rendering**: Even with color batching, 50+ fillRect calls add up. **Pixi.js fix**: Particle container with shared texture. Single GPU draw call for all projectiles.

3. **Lightning arcs (Tesla)**: jagged multi-segment lines with shadowBlur are expensive on Canvas 2D. **Pixi.js fix**: Pre-rendered lightning sprites or Graphics objects with GPU-accelerated blur.

4. **Module grid rendering**: Each module has a detailed render with multiple fillRect/strokeRect/arc calls. With 20+ modules this is 100+ draw calls. **Pixi.js fix**: Render each module type to a RenderTexture once, then sprite-batch all instances.

5. **Pulse rings / glow effects**: `shadowBlur` and radial gradients are CPU-expensive on Canvas 2D. **Pixi.js fix**: Pre-blurred glow sprites, GPU shader filters.

### Migration Difficulty: Medium
- Game logic is cleanly separated from rendering (each entity/system has its own `render()` method).
- Could migrate incrementally: start with projectile/enemy sprite batching, keep UI in Canvas 2D overlay.
- Main blocker: all coordinates are already in screen-space pixels, so no coordinate system changes needed.

### Estimated Impact
- **Canvas 2D current**: 60fps with ~60 enemies on iPhone SE 2. Drops below 60 at 100+.
- **With Pixi.js**: Estimated 60fps with 200+ enemies due to GPU batching.

## Test Checklist

- [ ] 60fps with 80+ enemies on iPhone SE 2nd gen / iPhone 8
- [ ] Touch input responsive, no missed taps
- [ ] Audio works after first interaction
- [ ] localStorage save/load works correctly
- [ ] No console errors
- [ ] Portrait orientation locked
- [ ] Safe area respected (notch + home indicator)
- [ ] No crash on background/foreground cycle
- [ ] No memory growth over 10+ minute run (check Safari Web Inspector)
