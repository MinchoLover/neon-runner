# Graphics Notes for Neon Tunnel Runner

This document maps the computer graphics lecture topics to the actual code and visible behavior in Neon Tunnel Runner. It is written for presentation/report use, so each concept is tied to where it appears in the project.

## Rendering Pipeline

- **Related lecture material:** Introduction to OpenGL/WebGL, Rendering Pipeline
- **Where it appears in code:** `src/game/Game.js`, `_setupScene()`, `_tick()`
- **How it appears visually:** The game world is rendered from a Three.js `Scene` through a `PerspectiveCamera` into a WebGL canvas. The rendered image then passes through `EffectComposer` and `UnrealBloomPass` for the final neon glow.
- **How to explain it in presentation:** The project follows the common graphics pipeline: geometry is prepared as meshes, transformed into camera space, projected to the screen, rasterized by WebGL, then enhanced by a post-processing bloom pass.

## Geometry Processing

- **Related lecture material:** Simple 3D Objects, VAO/VBO/Buffer
- **Where it appears in code:** `Tunnel.js`, `Player.js`, `ObstacleManager.js`, `ParticleManager.js`
- **How it appears visually:** Tunnel rings use torus geometry, rails use box geometry, the fallback ship is assembled from boxes, cones, cylinders, and spheres, and particles use small spheres or streak boxes.
- **How to explain it in presentation:** Three.js mesh geometry is the high-level representation. Internally, Three.js converts `BufferGeometry` attributes such as vertex positions into WebGL buffers, similar to the VAO/VBO flow covered in class.

## Coordinate Systems

- **Related lecture material:** Camera Control, Translation/Rotation
- **Where it appears in code:** `constants.js`, `Player.js`, `Tunnel.js`, `ObstacleManager.js`, `Game.js`
- **How it appears visually:** The player moves between three x-axis lanes, obstacles move toward the camera along z, and the camera views the tunnel from behind the player.
- **How to explain it in presentation:** Each object has local/model coordinates inside its mesh. Three.js places those objects into world space using `position`, `rotation`, and `scale`. The camera then defines view space for projection.

## Perspective Projection

- **Related lecture material:** Camera Control
- **Where it appears in code:** `Game.js`, `new THREE.PerspectiveCamera(66, aspect, 0.1, 150)`
- **How it appears visually:** Far tunnel rings appear smaller and closer rings appear larger, creating depth and speed.
- **How to explain it in presentation:** The perspective camera uses field of view, aspect ratio, near plane, and far plane to create a frustum. This makes the tunnel feel deep instead of flat.

## Clipping and Screen Mapping

- **Related lecture material:** Rendering Pipeline, Camera Control
- **Where it appears in code:** `Game.js`, `_setupScene()`, `_resize()`
- **How it appears visually:** Objects outside the camera frustum are not visible, and resizing the browser keeps the projection correct.
- **How to explain it in presentation:** Three.js/WebGLRenderer handles clipping, normalized device coordinates, viewport mapping, and screen mapping internally. The project controls the camera parameters and canvas size.

## Geometry Transformation

- **Related lecture material:** Translation/Rotation
- **Where it appears in code:** `Tunnel.update()`, `Player.update()`, `ObstacleManager.update()`
- **How it appears visually:** Tunnel rings translate on z and rotate, obstacles translate toward the player, rotating bars spin, and the player interpolates between lane x positions.
- **How to explain it in presentation:** The game uses real-time model transformations. Translation creates motion through the tunnel, rotation makes obstacles dynamic, and scale changes particle/fx size over time.

## Material and Emissive Color

- **Related lecture material:** Light / Material / Texture Mapping / WebGL
- **Where it appears in code:** `ObstacleManager.setPalette()`, `Player.setPalette()`, `Tunnel.applyPaletteToMaterials()`
- **How it appears visually:** Obstacles, rails, player engine accents, and tunnel rings glow with cyan, magenta, white, or palette-specific colors.
- **How to explain it in presentation:** Materials define how surfaces appear. The project uses emissive colors and high-intensity neon palettes so bright fragments can be emphasized by bloom.

## Bloom Post-Processing

- **Related lecture material:** Rendering Pipeline, Light/Material
- **Where it appears in code:** `Game.js`, `UnrealBloomPass`, `_updateBloomPulse()`
- **How it appears visually:** Boost, Hyper Mode, collision, and hard/elite mission states subtly increase glow without hiding obstacles.
- **How to explain it in presentation:** Bloom is applied after the main render pass. It simulates light bleeding from bright neon materials and connects gameplay state to image-space effects.

## Real-Time Animation Loop

- **Related lecture material:** Callback Functions, Animation
- **Where it appears in code:** `Game.start()`, `renderer.setAnimationLoop()`, `_tick()`
- **How it appears visually:** The tunnel, player, obstacles, particles, camera, and HUD all update continuously.
- **How to explain it in presentation:** `setAnimationLoop` is a requestAnimationFrame-style callback. Every frame computes elapsed delta time, updates the simulation, then renders the scene.

## Delta Time Based Update

- **Related lecture material:** Animation
- **Where it appears in code:** `Game._tick()`, `Tunnel.update()`, `Player.update()`, `ObstacleManager.update()`, `ParticleManager.update()`
- **How it appears visually:** Movement stays smooth even if frame rate changes.
- **How to explain it in presentation:** Instead of moving objects by a fixed amount per frame, movement is multiplied by `delta`. That makes animation depend on real time, not frame count.

## Particle System Lifecycle

- **Related lecture material:** Animation, Simple 3D Objects
- **Where it appears in code:** `ParticleManager.js`
- **How it appears visually:** Boost trails, near-miss streaks, collision sparks, rift bursts, and mission warnings are spawned, move with velocity, fade, shrink, and get removed.
- **How to explain it in presentation:** Each particle is a small mesh with velocity, life, maxLife, scale fade, opacity fade, and cleanup. A max particle limit prevents performance spikes.

## Collision Detection and Interaction

- **Related lecture material:** Collision Detection, Callback Functions
- **Where it appears in code:** `ObstacleManager._hitsPlayer()`, `_isNearMiss()`, `resolveTurnInput()`
- **How it appears visually:** Hitting an occupied lane reduces shield, passing beside a nearby obstacle triggers near miss, and rift gates require timed left/right input.
- **How to explain it in presentation:** Collision is simplified for gameplay: lane membership plus z-distance forms a fast hit test. Near miss uses adjacent-lane and distance checks.

## Mission-Driven Graphics Feedback

- **Related lecture material:** Interaction, Animation, Rendering Pipeline
- **Where it appears in code:** `MissionManager.js`, `Game._handleMissionEvents()`, `Tunnel.updatePaletteTransition()`, `UIManager.setMissionFocus()`
- **How it appears visually:** Hard and elite missions influence HUD emphasis, tunnel palette blending, bloom strength, and particle feedback.
- **How to explain it in presentation:** Missions are not only game logic. They drive visual feedback, so user interaction and real-time rendering are connected through state-based graphics changes.
