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

## External Model Visual Layer

- **Related lecture material:** Model Loading, Geometry Processing, Material
- **Where it appears in code:** `Player._loadExternalModel()`, `Player._useLoadedModel()`, `ObstacleManager._loadOptionalObstacleModels()`, `ObstacleManager._cloneObstacleModel()`
- **How it appears visually:** The player uses `public/models/player_fighter.glb` when available, normalized to a fixed visual size and restyled with dark metallic material plus neon engine/cockpit accents. Obstacle GLBs are optional; if they are absent, upgraded fallback geometry still displays readable plasma mines, laser fans, and security gates.
- **How to explain it in presentation:** External GLB meshes are visual assets only. The project normalizes model scale with `THREE.Box3`, restyles materials for the neon scene, and keeps gameplay collision separate from the loaded mesh shape.

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
- **How to explain it in presentation:** Bloom is applied after the main render pass. It simulates light bleeding from bright neon materials and connects gameplay state to image-space effects. The final bloom strength is clamped so post-processing improves feedback without destroying obstacle readability.

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

## Physics Debris Layer

- **Related lecture material:** Animation, Collision Response, Real-Time Rendering
- **Where it appears in code:** `PhysicsManager.js`, `Game._spawnImpactDebris()`, `Game._handleHit()`
- **How it appears visually:** Collisions and gameover spawn small physical shards that tumble away from the impact point and fade out. Plasma mines, laser fans, security gates, rift align failures, and gameover use different colors and strengths.
- **How to explain it in presentation:** `cannon-es` is used only for visual debris motion. Player movement and obstacle collision remain lane-based, so the gameplay is deterministic and fair while the impact response looks more physical.

## Collision Detection and Interaction

- **Related lecture material:** Collision Detection, Callback Functions
- **Where it appears in code:** `ObstacleManager._hitsPlayer()`, `_isNearMiss()`, `resolveTurnInput()`
- **How it appears visually:** Hitting an occupied lane reduces shield, passing beside a nearby obstacle triggers near miss, and rift gates require timed left/right input.
- **How to explain it in presentation:** Collision is simplified for gameplay: lane membership plus z-distance forms a fast hit test. Near miss uses adjacent-lane and distance checks.

## Obstacle Readability

- **Related lecture material:** Simple 3D Objects, Material, Interaction
- **Where it appears in code:** `ObstacleManager.setPalette()`, `_createBox()`, `_createBar()`, `_createGate()`, `Tunnel.update()`, `Game._updateBloomPulse()`
- **How it appears visually:** Hazard objects keep stable warm colors and thicker silhouettes, safe gate frames use cyan, and reward/rift objects use white or purple accents. Tunnel streaks, stars, bloom, and particle counts are reduced so hazards stay in the foreground.
- **How to explain it in presentation:** The project separates visual layers by gameplay meaning. Material color and geometry size are not only decoration: they encode danger, safety, and reward so the player can parse the scene while real-time rendering effects continue in the background.

## Mission-Driven Graphics Feedback

- **Related lecture material:** Interaction, Animation, Rendering Pipeline
- **Where it appears in code:** `MissionManager.getVisualState()`, `Game._syncMissions()`, `Game._handlePatternCue()`, `UIManager.setMissionFocus()`, `UIManager._renderMissions()`, `Tunnel.highlightSafeLane()`
- **How it appears visually:** Hard and elite missions influence HUD emphasis, tunnel palette blending, bloom strength, and particle feedback. Mission focus also guides play style: no-boost missions tint the boost HUD, near-miss missions strengthen lane cueing, rift streak missions emphasize turn prompts, and hyper-pass missions add extra feedback during Hyper Mode passes.
- **How to explain it in presentation:** Missions are not only game logic. They produce state-driven visual feedback. The same render loop that updates gameplay also changes HUD style, tunnel highlight opacity, bloom pulses, and particles based on the active objective.

## Risk Shard / Score Ring

- **Related lecture material:** Simple 3D Objects, Translation/Rotation, Collision Detection, Light/Material, Rendering Pipeline
- **Where it appears in code:** `ObstacleManager._createScoreRing()`, `ObstacleManager._updateScoreRings()`, `Game._handleScoreRing()`, `ParticleManager.scoreRingBurst()`, `UIManager.update()`
- **How it appears visually:** A glowing torus reward appears near risky lanes or narrow passages. It moves along the z-axis with the tunnel, rotates every frame, glows through additive neon material, pulses both outer and inner ring opacity, updates the HUD ring count, and produces a particle burst when collected.
- **How to explain it in presentation:** The score ring is a risk/reward object built from `TorusGeometry`. It demonstrates geometry construction, model transformation, lane/z-distance collision detection, bloom-friendly material color, and particle feedback. The player must choose between the safe path and a more dangerous route with a higher score/combo reward.

## Pattern Rhythm / Wave Director

- **Related lecture material:** Animation, Callback Functions, Translation/Rotation, Rendering Pipeline
- **Where it appears in code:** `ObstacleManager._waveForElapsed()`, `_patternType()`, `_spawnInterval()`, `Game._handleWaveChange()`, `Tunnel.setWaveFeedback()`, `Tunnel.update()`, `UIManager.update()`
- **How it appears visually:** The run cycles through warmup, pressure, risk, rift, and cooldown waves. Pressure and risk waves subtly increase obstacle rhythm, score-ring opportunities, speed streaks, and bloom. Cooldown reduces visual tension so the player gets a short recovery phase. The compact FLOW HUD block exposes the current wave without changing the main layout.
- **How to explain it in presentation:** The wave director is a time-based state machine driven by the animation loop. It does not replace random procedural spawning; it modulates probabilities, spawn timing, palette interpolation, and camera/bloom feedback so gameplay has rhythm instead of feeling purely random.

## Gameplay State HUD Polish

- **Related lecture material:** Interaction, Callback Functions, Real-Time Rendering
- **Where it appears in code:** `UIManager.update()`, `UIManager.setMissionFocus()`, `Game._handleWaveChange()`, `Game._updateBloomPulse()`
- **How it appears visually:** FLOW shows the current wave, RINGS shows collected risk rewards, boost/missions still keep the existing cyber HUD style, and mission focus states subtly tint related UI blocks.
- **How to explain it in presentation:** Real-time interaction is not only object movement. Gameplay state is converted into readable screen-space UI and carefully bounded camera/bloom feedback so the player understands risk, reward, and mission intent while the 3D scene remains playable.

## Rift Rotation / Alignment

- **Related lecture material:** Translation/Rotation, Camera Control, Coordinate Systems, Collision Detection, Animation
- **Where it appears in code:** `ObstacleManager._createRiftAlignGate()`, `ObstacleManager.resolveRiftAlignInput()`, `Game._handleRiftAlignInput()`, `Tunnel.setRiftAlignmentFeedback()`, `UIManager.showRiftAlignPrompt()`
- **How it appears visually:** During an ALIGN RIFT section, A/D no longer moves the ship. The input rotates the rift alignment cursor and the tunnel subtly rolls until the highlighted lane matches the target gate. Correct alignment produces a rift burst, score/combo reward, and camera/bloom pulse; wrong alignment causes warning feedback and shield damage.
- **How to explain it in presentation:** This changes the core gameplay from only translating the player between lanes to also rotating a coordinate frame. The tunnel roll is a rotation transform driven by real-time input, while the rift gate uses a discrete alignment test similar to lane-based collision logic. It makes the graphics concept of transformation part of the game rule, not just a visual decoration.

## Near Miss and Boost Feel

- **Related lecture material:** Collision Detection, Camera Control, Animation, Particle System
- **Where it appears in code:** `ObstacleManager._isNearMiss()`, `Game._handleNearMiss()`, `Game._updateCamera()`, `ParticleManager.nearMiss()`, `ParticleManager.boostTrail()`, `Player.update()`
- **How it appears visually:** Near miss chains increase HUD emphasis, particle count, bloom/FOV pulse, and camera shake slightly. Boost strengthens engine glow and trail particles while the perspective camera briefly widens the field of view.
- **How to explain it in presentation:** The gameplay feel is created without changing simulation time. Collision thresholds trigger visual feedback, camera FOV changes demonstrate perspective projection control, and particles show velocity/lifetime based animation.
