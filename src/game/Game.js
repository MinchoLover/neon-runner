import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { RGBShiftShader } from 'three/examples/jsm/shaders/RGBShiftShader.js';
import { AudioManager } from './AudioManager.js';
import {
  COLORS,
  GAME,
  TUNNEL_PALETTES,
  NEAR_MISS_FEEDBACK_DURATION,
  HYPER_READY_PULSE_DURATION,
  HYPER_START_FOV_PULSE,
  HITSTOP_DURATION,
  HITSTOP_COOLDOWN,
  HIT_SHAKE_INTENSITY,
  GAME_OVER_SHAKE_INTENSITY,
  NEAR_MISS_SHAKE_INTENSITY,
  HYPER_SHAKE_INTENSITY,
  AUDIO_EVENT_COOLDOWN,
  SHIELD_PICKUP,
} from './constants.js';
import { MissionManager } from './MissionManager.js';
import { ObstacleManager } from './ObstacleManager.js';
import { ParticleManager } from './ParticleManager.js';
import { PhysicsManager } from './PhysicsManager.js';
import { Player } from './Player.js';
import { Tunnel } from './Tunnel.js';
import { UIManager } from './UIManager.js';

export class Game {
  constructor(root) {
    this.root = root;
    this.ui = new UIManager(root);
    this.canvas = this.ui.canvas;
    this.timer = new THREE.Timer();
    this.timer.connect(document);
    this.audio = new AudioManager();
    this.audio.load().catch((err) => console.warn('AudioManager.load failed:', err));
    this.state = 'ready';
    this.keys = new Set();
    this.stats = {
      score: 0,
      combo: 0,
      distance: 0,
      speed: GAME.startSpeed,
      shield: GAME.shield,
      maxShield: GAME.shield,
      boostReady: true,
      boostCooldown: 0,
      hyperActive: false,
      hyperReady: false,
      hyperCharge: 0,
      hyperTime: 0,
      maxCombo: 0,
      nearMisses: 0,
      hyperCount: 0,
      boostsUsed: 0,
      hitsTaken: 0,
      solarCores: 0,
      surgeBreaks: 0,
      completedMissions: 0,
      missions: [],
      missionVisual: {
        intensity: 0,
        eliteActive: false,
        urgent: false,
      },
      wave: {
        name: 'warmup',
        intensity: 0,
        progress: 0,
      },
    };
    this.elapsed = 0;
    this.boostTimer = 0;
    this.boostCooldown = 0;
    this.hyperTimer = 0;
    this.hyperReadyTimer = 0;
    this.nearMissChain = 0;
    this.surgeBreakChain = 0;
    this.lastLaneChange = null;
    this.invincibleTime = 0;
    this.hitFlashTime = 0;
    this.gameoverTimer = 0;
    this.countdownTimer = 0;
    this.countdownLabel = '';
    this.startPulseTimer = 0;
    this.crashSpeed = 0;
    this.shake = 0;
    this.missionPulseTimer = 0;
    this.solarCorePulseTimer = 0;
    this.wavePulseTimer = 0;
    this.nearMissPulseTimer = 0;
    this.hitstopTimer = 0;
    this.cameraRollImpulse = 0;
    this.cameraKickImpulse = 0;
    this.cameraFovImpulse = 0;
    this.cameraSideImpulse = 0;
    this.afterimagePool = [];
    this.afterimageCursor = 0;
    this.afterimageTimer = 0;
    this.lastStyleMilestone = 0;
    this.lastChainCallout = 0;
    this.lastSurgeChainCallout = 0;
    this.activePalette = TUNNEL_PALETTES[0];
    this.tutorialCues = new Set();
    this.missionManager = new MissionManager();
    this.stats.missions = this.missionManager.reset(this.stats);

    this._setupScene();
    this._setupWorld();
    this.ui.setCompactMode(this._isCompactViewport());
    this._resize();
    this._bindEvents();
    this.ui.update(this.stats);
    this.ui.setState(this.state, this.stats);
  }

  start() {
    // setAnimationLoop is Three.js' requestAnimationFrame-backed real-time loop.
    // Each tick uses delta time so movement remains stable across frame rates.
    this.renderer.setAnimationLoop((timestamp) => this._tick(timestamp));
  }

  _setupScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(COLORS.dark);
    this.scene.fog = new THREE.FogExp2(0x01040a, 0.016);

    // PerspectiveCamera defines the view frustum. Three.js projects visible 3D geometry
    // through this camera; clipping and viewport/screen mapping are handled by WebGLRenderer.
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 160);
    this.baseCameraFov = 62;
    this.camera.position.set(0, 1.06, 10.2);
    this.camera.lookAt(0, -1.7, -18);

    // Rendering pipeline: scene + camera are rendered into a WebGL canvas, then routed
    // through EffectComposer so bloom can be applied as a post-processing pass.
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this._isCompactViewport() ? 1.5 : 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.92;

    const renderPass = new RenderPass(this.scene, this.camera);
    const ssaoPass = new SSAOPass(this.scene, this.camera, window.innerWidth, window.innerHeight);
    ssaoPass.kernelRadius = 3;
    ssaoPass.minDistance = 0.006;
    ssaoPass.maxDistance = 0.035;
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.68,
      0.26,
      0.42,
    );
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(renderPass);
    this.composer.addPass(ssaoPass);
    this.composer.addPass(bloomPass);
    const rgbShiftPass = new ShaderPass(RGBShiftShader);
    rgbShiftPass.uniforms.amount.value = 0;
    this.composer.addPass(rgbShiftPass);
    this.ssaoPass = ssaoPass;
    this.ssaoPass.enabled = !this._isCompactViewport();
    this.rgbShiftPass = rgbShiftPass;
    this.bloomPass = bloomPass;
    this.baseBloomStrength = bloomPass.strength;
    this.baseBloomRadius = bloomPass.radius;
    this.baseBloomThreshold = bloomPass.threshold;
  }

  _setupWorld() {
    this.scene.add(new THREE.AmbientLight(0x07111b, 0.52));
    this.scene.add(new THREE.HemisphereLight(COLORS.cyan, 0x130700, 0.48));

    const shipKeyLight = new THREE.DirectionalLight(0xffd27a, 1.35);
    shipKeyLight.position.set(1.8, 4.5, 8);
    this.scene.add(shipKeyLight);

    const shipCyanRim = new THREE.PointLight(COLORS.cyan, 12, 14);
    shipCyanRim.position.set(-2.4, -0.6, 7.5);
    this.scene.add(shipCyanRim);

    const shipSolarRim = new THREE.PointLight(COLORS.solarGold, 15, 16);
    shipSolarRim.position.set(2.5, -0.4, 6.8);
    this.scene.add(shipSolarRim);

    this.cyanLight = new THREE.PointLight(COLORS.cyan, 28, 25);
    this.cyanLight.position.set(-3.5, 1.4, 2.5);
    this.scene.add(this.cyanLight);

    this.solarLight = new THREE.PointLight(COLORS.solarOrange, 34, 34);
    this.solarLight.position.set(3.4, 0.6, -5);
    this.scene.add(this.solarLight);

    this.tunnel = new Tunnel(this.scene);
    this.player = new Player();
    this.scene.add(this.player.group);
    this._setupAfterimages();
    this.obstacles = new ObstacleManager(this.scene);
    this.particles = new ParticleManager(this.scene);
    this.physics = new PhysicsManager(this.scene);
    this._syncPalette(0.016);
  }


  _setupAfterimages() {
    this.afterimagePool = [];
    this.afterimageCursor = 0;
    this.afterimageTimer = 0;

    const bodyGeometry = new THREE.BoxGeometry(0.62, 0.13, 1.04);
    const wingGeometry = new THREE.BoxGeometry(0.72, 0.055, 0.46);
    const spineGeometry = new THREE.BoxGeometry(0.13, 0.075, 1.34);
    const flareGeometry = new THREE.PlaneGeometry(1.35, 0.46);

    const createGhostMaterial = (opacity = 0.2) =>
      new THREE.MeshBasicMaterial({
        color: COLORS.cyan,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });

    for (let i = 0; i < 18; i += 1) {
      const ghost = new THREE.Group();
      ghost.visible = false;
      ghost.renderOrder = 7;
      ghost.userData.life = 0;
      ghost.userData.maxLife = 0.28;
      ghost.userData.baseOpacity = 0.25;
      ghost.userData.driftZ = 1.5;
      ghost.userData.driftY = 0.02;
      ghost.userData.spin = 0;

      const body = new THREE.Mesh(bodyGeometry, createGhostMaterial(0));
      body.userData.opacityMul = 0.9;
      body.position.set(0, 0.02, 0.02);
      ghost.add(body);

      const spine = new THREE.Mesh(spineGeometry, createGhostMaterial(0));
      spine.userData.opacityMul = 1.2;
      spine.position.set(0, 0.08, -0.02);
      ghost.add(spine);

      const leftWing = new THREE.Mesh(wingGeometry, createGhostMaterial(0));
      leftWing.userData.opacityMul = 0.65;
      leftWing.position.set(-0.48, -0.025, 0.13);
      leftWing.rotation.z = -0.23;
      ghost.add(leftWing);

      const rightWing = new THREE.Mesh(wingGeometry, createGhostMaterial(0));
      rightWing.userData.opacityMul = 0.65;
      rightWing.position.set(0.48, -0.025, 0.13);
      rightWing.rotation.z = 0.23;
      ghost.add(rightWing);

      const flare = new THREE.Mesh(flareGeometry, createGhostMaterial(0));
      flare.userData.opacityMul = 0.42;
      flare.position.set(0, 0.01, 0.42);
      flare.rotation.x = Math.PI * 0.5;
      ghost.add(flare);

      this.scene.add(ghost);
      this.afterimagePool.push(ghost);
    }
  }

  _emitAfterimage(delta, boostFactor, hyperFactor) {
    if (!this.afterimagePool?.length || this.state !== 'playing') return;

    const active = boostFactor > 0 || hyperFactor > 0;
    const laneMotion = Math.abs(this.cameraSideImpulse || 0) > 0.035;

    if (!active && !laneMotion) {
      this.afterimageTimer = Math.min(this.afterimageTimer, 0.04);
      return;
    }

    const interval = hyperFactor > 0 ? 0.038 : boostFactor > 0 ? 0.05 : 0.07;
    this.afterimageTimer -= delta;

    while (this.afterimageTimer <= 0) {
      const strength = hyperFactor > 0 ? 1.35 : boostFactor > 0 ? 1.0 : 0.45;
      this._spawnAfterimage(strength, hyperFactor > 0, laneMotion ? 0.16 : 0);
      this.afterimageTimer += interval;
    }
  }

  _burstAfterimages(count = 4, hyper = false) {
    if (!this.afterimagePool?.length) return;

    for (let i = 0; i < count; i += 1) {
      const strength = Math.max((hyper ? 1.5 : 1.0) - i * 0.08, 0.45);
      this._spawnAfterimage(strength, hyper, i * 0.055);
    }
  }

  _spawnAfterimage(strength = 1, hyper = false, extraOffset = 0) {
    if (!this.afterimagePool?.length || !this.player?.group) return;

    const ghost = this.afterimagePool[this.afterimageCursor];
    this.afterimageCursor = (this.afterimageCursor + 1) % this.afterimagePool.length;

    ghost.visible = true;
    ghost.position.copy(this.player.group.position);
    ghost.position.z += 0.26 + extraOffset;
    ghost.position.y += hyper ? 0.015 : 0;
    ghost.rotation.copy(this.player.group.rotation);

    const laneStretch = Math.min(Math.abs(this.cameraSideImpulse || 0) * 1.8, 0.35);
    const scale = hyper ? 1.13 + laneStretch : 1.03 + laneStretch;
    ghost.scale.set(scale, scale * 0.96, hyper ? 1.24 : 1.1);

    ghost.userData.life = hyper ? 0.28 : 0.2;
    ghost.userData.maxLife = ghost.userData.life;
    ghost.userData.baseOpacity = (hyper ? 0.3 : 0.2) * strength;
    ghost.userData.driftZ = hyper ? 2.65 : 1.85;
    ghost.userData.driftY = hyper ? 0.045 : 0.018;
    ghost.userData.spin = (Math.random() - 0.5) * (hyper ? 0.22 : 0.12);

    const color = hyper ? COLORS.solarGold : COLORS.cyan;
    const rimColor = hyper ? COLORS.solarOrange : 0x5ab7ff;

    ghost.children.forEach((child, index) => {
      if (!child.material) return;
      child.material.color.set(index === 4 ? rimColor : color);
      child.material.opacity = 0;
    });
  }

  _updateAfterimages(delta) {
    if (!this.afterimagePool?.length) return;

    for (const ghost of this.afterimagePool) {
      if (!ghost.visible) continue;

      ghost.userData.life -= delta;

      if (ghost.userData.life <= 0) {
        ghost.visible = false;
        ghost.children.forEach((child) => {
          if (child.material) child.material.opacity = 0;
        });
        continue;
      }

      const t = ghost.userData.life / ghost.userData.maxLife;
      const fade = t * t;
      const stretch = 1 + (1 - t) * 0.34;

      ghost.position.z += ghost.userData.driftZ * delta;
      ghost.position.y += ghost.userData.driftY * delta;
      ghost.rotation.z += ghost.userData.spin * delta;
      ghost.scale.z *= 1 + delta * 0.75;
      ghost.scale.x *= 1 + delta * 0.08;
      ghost.scale.y *= 1 + delta * 0.04;

      ghost.children.forEach((child) => {
        if (!child.material) return;
        const opacityMul = child.userData.opacityMul ?? 1;
        child.material.opacity = THREE.MathUtils.clamp(
          ghost.userData.baseOpacity * fade * opacityMul * stretch,
          0,
          0.5,
        );
      });
    }
  }

  _resetAfterimages() {
    this.afterimageTimer = 0;

    if (!this.afterimagePool?.length) return;

    for (const ghost of this.afterimagePool) {
      ghost.visible = false;
      ghost.userData.life = 0;
      ghost.children.forEach((child) => {
        if (child.material) child.material.opacity = 0;
      });
    }
  }

  _bindEvents() {
    window.addEventListener('resize', () => this._resize());
    window.addEventListener('keydown', (event) => this._onKeyDown(event));
    window.addEventListener('keyup', (event) => this.keys.delete(event.code));
    window.addEventListener('blur', () => this._onWindowBlur());
    document.addEventListener('visibilitychange', () => this._onVisibilityChange());
    this.ui.mobileControls?.addEventListener('pointerdown', (event) => this._onPointerInput(event));
  }

  _onWindowBlur() {
    this.keys.clear();
  }

  _onVisibilityChange() {
    if (document.hidden) {
      this.keys.clear();
      this.audio.stopEngine();
      return;
    }

    if (this.state === 'playing') {
      this.audio.playEngine();
    }
  }

  _onPointerInput(event) {
    const button = event.target.closest('button[data-action]');
    if (!button || button.disabled) return;
    event.preventDefault();
    void this.audio.unlock();
    const action = button.dataset.action;
    if (action === 'primary') this._handlePrimaryAction();
    if (action === 'left') this._handleDirectionInput(-1);
    if (action === 'right') this._handleDirectionInput(1);
  }

  _onKeyDown(event) {
    if (['ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    void this.audio.unlock();
    if (this.keys.has(event.code)) return;
    this.keys.add(event.code);

    if (event.code === 'Space') {
      this._handlePrimaryAction();
      return;
    }

    if ((event.code === 'KeyP' || event.code === 'Escape') && (this.state === 'playing' || this.state === 'paused')) {
      this.state = this.state === 'paused' ? 'playing' : 'paused';
      if (this.state === 'paused') this.audio.stopEngine();
      else this.audio.playEngine();
      this.ui.setState(this.state, this.stats);
      return;
    }

    if (this.state !== 'playing') return;
    if (event.code === 'KeyA' || event.code === 'ArrowLeft') {
      this._handleDirectionInput(-1);
    }
    if (event.code === 'KeyD' || event.code === 'ArrowRight') {
      this._handleDirectionInput(1);
    }
  }

  _handlePrimaryAction() {
    if (this.state === 'ready' || this.state === 'gameover') {
      this._beginCountdown();
      this.audio.play('start');
      return;
    }
    if (this.state === 'playing') {
      if (this.stats.hyperReady) {
        this._startHyper();
      } else {
        this._tryBoost();
      }
    }
  }

  _handleDirectionInput(direction) {
    if (this.state !== 'playing') return;
    this._movePlayer(direction);
  }

  _movePlayer(direction) {
    const previousLane = this.player.lane;
    this.player.move(direction);
    if (this.player.lane !== previousLane) {
      this.lastLaneChange = {
        at: this.elapsed,
        from: previousLane,
        to: this.player.lane,
      };
      this.cameraRollImpulse += -direction * 0.092;
      this.cameraSideImpulse += direction * 0.14;
      this.audio.play('move');
    }
  }

  _tryBoost() {
    if (this.boostCooldown > 0) return;
    this.boostTimer = GAME.boostDuration;
    this.boostCooldown = GAME.boostCooldown;
    this.stats.boostsUsed += 1;
    this.shake = Math.max(this.shake, 0.12);
    this.cameraKickImpulse = Math.max(this.cameraKickImpulse, 0.34);
    this.cameraFovImpulse = Math.max(this.cameraFovImpulse, 3.8);
    this.audio.play('boost');
    this.particles.boostBurst(this.player.group.position, 24);
    this._burstAfterimages(3, false);
    this._recordMissionEvent('boost');
  }

  _beginCountdown() {
    this.state = 'countdown';
    this.audio.playEngine();
    this.elapsed = 0;
    this.boostTimer = 0;
    this.boostCooldown = 0;
    this.hyperTimer = 0;
    this.hyperReadyTimer = 0;
    this.nearMissChain = 0;
    this.lastChainCallout = 0;
    this.lastLaneChange = null;
    this.invincibleTime = 0;
    this.hitFlashTime = 0;
    this.gameoverTimer = 0;
    this.countdownTimer = 2.05;
    this.countdownLabel = '';
    this.startPulseTimer = 0;
    this.crashSpeed = 0;
    this.shake = 0;
    this.missionPulseTimer = 0;
    this.solarCorePulseTimer = 0;
    this.wavePulseTimer = 0;
    this.nearMissPulseTimer = 0;
    this.stats.score = 0;
    this.stats.combo = 0;
    this.stats.distance = 0;
    this.stats.speed = GAME.startSpeed;
    this.stats.shield = GAME.shield;
    this.stats.boostReady = true;
    this.stats.boostCooldown = 0;
    this.stats.hyperActive = false;
    this.stats.hyperReady = false;
    this.stats.hyperCharge = 0;
    this.stats.hyperTime = 0;
    this.stats.maxCombo = 0;
    this.stats.nearMisses = 0;
    this.stats.hyperCount = 0;
    this.stats.boostsUsed = 0;
    this.stats.hitsTaken = 0;
    this.stats.solarCores = 0;
    this.stats.surgeBreaks = 0;
    this.surgeBreakChain = 0;
    this.lastStyleMilestone = 0;
    this.lastChainCallout = 0;
    this.lastSurgeChainCallout = 0;
    this.stats.completedMissions = 0;
    this.stats.missionVisual = {
      intensity: 0,
      eliteActive: false,
      urgent: false,
    };
    this.stats.wave = {
      name: 'warmup',
      intensity: 0,
      progress: 0,
    };
    this.stats.missions = this.missionManager.reset(this.stats);
    this.ui.setMissionFocus(this.stats.missionVisual);
    this.tutorialCues.clear();
    this.player.reset();
    this.obstacles.reset();
    this.obstacles.setPreviewVisible(false);
    this.particles.reset();
    this.physics.reset();
    this._resetAfterimages();
    this.tunnel.setTunnelPalette(0);
    this.activePalette = TUNNEL_PALETTES[0];
    this._syncPalette(0.016);
    this.ui.setState(this.state, this.stats);
    this._setCountdownLabel('3');
    this.ui.update(this.stats);
  }

  _tick(timestamp) {
    this.timer.update(timestamp);
    const rawDelta = Math.min(this.timer.getDelta(), 0.033);

    this.hitstopTimer = Math.max((this.hitstopTimer || 0) - rawDelta, 0);
    const delta = this.hitstopTimer > 0 ? rawDelta * 0.1 : rawDelta;

    this.invincibleTime = Math.max(this.invincibleTime - delta, 0);
    this.hitFlashTime = Math.max(this.hitFlashTime - delta, 0);
    if (this.state === 'playing') this._updatePlaying(delta);
    else if (this.state === 'countdown') this._updateCountdown(delta);
    else if (this.state === 'crashing') this._updateCrashing(delta);
    else if (this.state === 'paused') this._updatePaused(delta);
    else this._updateAttract(delta);

    this.particles.update(delta);
    this.physics.update(delta);
    this._updateAfterimages(delta);
    this._updateCamera(delta);
    this._updateBloomPulse();
    this.composer.render();
  }

  _updateAttract(delta) {
    this._syncPalette(delta);
    this.tunnel.update(delta, GAME.startSpeed * 0.65);
    this.player.update(delta, 0, this.invincibleTime, this.hitFlashTime, false, 0);
    this.player.group.rotation.y += delta * 0.15;
  }

  _updateCountdown(delta) {
    this.countdownTimer = Math.max(this.countdownTimer - delta, 0);
    this._syncPalette(delta);
    this.tunnel.update(delta, GAME.startSpeed * 0.78);
    this.player.update(delta, 0, 0, 0, false, 0);

    if (this.countdownTimer > 1.5) this._setCountdownLabel('3');
    else if (this.countdownTimer > 1) this._setCountdownLabel('2');
    else if (this.countdownTimer > 0.5) this._setCountdownLabel('1');
    else if (this.countdownTimer > 0) this._setCountdownLabel('GO');

    if (this.countdownTimer <= 0) {
      this.state = 'playing';
      this.startPulseTimer = 0.4;
      this.boostTimer = 0.45;
      this.shake = 0.18;
      this.audio.play('boost');
      this.audio.play('go');
      this.ui.setState(this.state, this.stats);
    }
  }

  _setCountdownLabel(label) {
    if (this.countdownLabel === label) return;
    this.countdownLabel = label;
    this.ui.setCountdown(label);
    this.audio.play(label === 'GO' ? 'go' : 'countdown');
  }

  _updatePlaying(delta) {
    this.elapsed += delta;
    this.boostTimer = Math.max(this.boostTimer - delta, 0);
    this.boostCooldown = Math.max(this.boostCooldown - delta, 0);
    this.hyperTimer = Math.max(this.hyperTimer - delta, 0);
    this.startPulseTimer = Math.max(this.startPulseTimer - delta, 0);
    this.missionPulseTimer = Math.max(this.missionPulseTimer - delta, 0);
    this.solarCorePulseTimer = Math.max(this.solarCorePulseTimer - delta, 0);
    this.wavePulseTimer = Math.max(this.wavePulseTimer - delta, 0);
    this.nearMissPulseTimer = Math.max(this.nearMissPulseTimer - delta, 0);
    this.hyperReadyTimer = Math.max(this.hyperReadyTimer - delta, 0);
    const wasHyper = this.stats.hyperActive;
    this.stats.hyperActive = this.hyperTimer > 0;
    this.stats.hyperTime = this.hyperTimer;
    if (wasHyper && !this.stats.hyperActive) {
      this.surgeBreakChain = 0;
      this.audio.play('hyperEnd');
    }
    const boostFactor = this.boostTimer > 0 ? 1 : 0;
    const hyperFactor = this.stats.hyperActive ? 1 : 0;
    const speedRamp = this._isCompactViewport() ? 0.72 : 0.58;
    const baseSpeed = Math.min(GAME.startSpeed + this.elapsed * speedRamp, GAME.maxSpeed);
    this.stats.speed = baseSpeed + boostFactor * GAME.boostSpeed + hyperFactor * 4;
    this.stats.distance += this.stats.speed * delta * 1.35;
    const multiplier = this.stats.hyperActive ? 2 : 1;
    this.stats.score += delta * (85 + this.stats.speed * 7 + this.stats.combo * 18) * multiplier;
    this.stats.boostReady = this.boostCooldown <= 0;
    this.stats.boostCooldown = this.boostCooldown;
    this.stats.maxCombo = Math.max(this.stats.maxCombo, this.stats.combo);

    this._syncPalette(delta);
    this._updateRunCues();
    this.tunnel.update(
      delta,
      this.stats.speed,
      this.stats.hyperActive ? 1 : 0,
      this.stats.wave,
      this.boostTimer > 0 ? 1 : 0,
    );
    this.player.update(
      delta,
      boostFactor,
      this.invincibleTime,
      this.hitFlashTime,
      this.stats.hyperActive,
      this.stats.combo,
      this.stats.hyperCharge,
    );
    if (boostFactor || this.stats.hyperActive) {
      this.particles.boostTrail(this.player.group.position, this.stats.hyperActive, boostFactor, delta);
    }
    this._emitAfterimage(delta, boostFactor, this.stats.hyperActive ? 1 : 0);
    this.obstacles.update(delta, this.stats.speed, this.elapsed, {
      playerX: this.player.group.position.x,
      playerLane: this.player.lane,
      laneChange: this.lastLaneChange,
      surgeActive: this.stats.hyperActive,
      onPattern: (safeLane) => this._handlePatternCue(safeLane),
      onOpeningCue: (pattern) => this._handleOpeningCue(pattern),
      onWaveChange: (wave) => this._handleWaveChange(wave),
      onHit: (position, obstacle) => this._handleHit(position, obstacle),
      onSurgeBreak: (position, obstacle) => this._handleSurgeBreak(position, obstacle),
      onPassed: (obstacle) => this._handlePassed(obstacle),
      onNearMiss: (position) => this._handleNearMiss(position),
      onSolarCore: (position, core) => this._handleSolarCore(position, core),
      onShieldPickup: (position, pickup) => this._handleShieldPickup(position, pickup),
      onSolarCoreCue: (pattern) => this._handleSolarCoreCue(pattern),
    });

    this._syncMissions(delta);
    this.ui.update(this.stats);
  }

  _updatePaused(delta) {
    this._syncPalette(delta);
    this.tunnel.update(delta, GAME.startSpeed * 0.25, 0);
    this.player.update(
      delta,
      0,
      this.invincibleTime,
      this.hitFlashTime,
      this.stats.hyperActive,
      this.stats.combo,
      this.stats.hyperCharge,
    );
  }

  _updateCrashing(delta) {
    this.gameoverTimer = Math.max(this.gameoverTimer - delta, 0);
    this.crashSpeed = THREE.MathUtils.damp(this.crashSpeed, 0, 5, delta);
    this._syncPalette(delta);
    this.tunnel.update(delta, this.crashSpeed);
    this.player.update(delta, 0, 0, this.hitFlashTime, false, this.stats.combo, this.stats.hyperCharge);
    this.stats.speed = this.crashSpeed;
    this.ui.update(this.stats);

    if (this.gameoverTimer <= 0) {
      this.state = 'gameover';
      this.ui.setState(this.state, this.stats);
    }
  }

  _handlePassed(obstacle = null) {
    if (!obstacle?.nearMissed) this.nearMissChain = 0;
    const openingPattern = obstacle?.openingPattern;
    this.stats.combo += 1;
    this.stats.maxCombo = Math.max(this.stats.maxCombo, this.stats.combo);
    this._handleStyleMoment('pass');
    const multiplier = this.stats.hyperActive ? 2 : 1;
    this.stats.score += (125 + this.stats.combo * 35) * multiplier;
    this.particles.sparkle(this.player.group.position, this.stats.hyperActive ? 12 : 5);
    if (this.stats.hyperActive && this.stats.missionVisual?.focus?.hyper) {
      this.particles.energyBurst(this.player.group.position, 12);
      this.missionPulseTimer = Math.max(this.missionPulseTimer, 0.28);
    }
    if (openingPattern?.id === 'move' && !this.tutorialCues.has('opening-good-dodge')) {
      this.tutorialCues.add('opening-good-dodge');
      this.ui.showStatus('GOOD DODGE');
      this.audio.play('openingDodge');
    } else {
      this.audio.play('pass');
    }
    if (this.stats.combo > 0 && this.stats.combo % 4 === 0) this.audio.play('combo');
    this._recordMissionEvent('passed');
    this._addHyperCharge(openingPattern ? GAME.openingPassChargeGain : GAME.hyperPassGain);
    if (this.stats.combo % GAME.hyperComboMilestone === 0) {
      this._addHyperCharge(GAME.hyperComboMilestoneGain);
    }
  }

  _handleNearMiss(position) {
    this.nearMissChain += 1;
    this.stats.nearMisses += 1;
    this.stats.combo += 2;
    this.stats.maxCombo = Math.max(this.stats.maxCombo, this.stats.combo);
    const multiplier = this.stats.hyperActive ? 2 : 1;
    this.stats.score += (150 + this.stats.combo * 10) * multiplier;
    const chainLevel = Math.min(this.nearMissChain, 4);
    this._handleNearMissStyle(chainLevel);
    
    // Feedback
    this.nearMissPulseTimer = NEAR_MISS_FEEDBACK_DURATION;
    this.shake = Math.max(this.shake, NEAR_MISS_SHAKE_INTENSITY);
    this.cameraRollImpulse += (Math.random() > 0.5 ? 1 : -1) * 0.026;
    this.cameraKickImpulse = Math.max(this.cameraKickImpulse, 0.18);
    this.cameraFovImpulse = Math.max(this.cameraFovImpulse, 1.45);
    
    const hyperGain = this._addHyperCharge(GAME.hyperNearMissGain);
    this.ui.showNearMiss(chainLevel, hyperGain);
    this.particles.nearMiss(position, chainLevel);
    this._spawnAfterimage(this.stats.hyperActive ? 1.25 : 0.75, this.stats.hyperActive, 0.18);
    this.audio.playNearMiss();
    
    this._recordMissionEvent('nearMiss');
  }

  _handleSolarCore(position, core) {
    const reward = Math.round(core.scoreGain * (this.stats.hyperActive ? 1.5 : 1));
    this.stats.score += reward;
    this.stats.combo += core.comboGain;
    this.stats.maxCombo = Math.max(this.stats.maxCombo, this.stats.combo);
    this.stats.solarCores += 1;
    this.solarCorePulseTimer = 0.48;
    this.startPulseTimer = Math.max(this.startPulseTimer, 0.18);
    this.shake = Math.max(this.shake, core.riskLevel === 'safe' ? 0.05 : 0.09);
    const chargeGain = this._addHyperCharge(core.chargeGain);
    this.ui.showSolarCore(reward, chargeGain, core.riskLevel, this.stats.hyperReady);
    this.particles.solarCore(position, core.riskLevel === 'safe' ? 22 : 30, this.player.group.position);
    this.audio.play('solarCore');
  }

  _handleShieldPickup(position, pickup) {
    if (this.stats.shield >= this.stats.maxShield) return;

    this.stats.shield = Math.min(this.stats.shield + 1, this.stats.maxShield);
    this.stats.score += SHIELD_PICKUP.scoreGain;
    this.startPulseTimer = Math.max(this.startPulseTimer, 0.12);
    this.solarCorePulseTimer = Math.max(this.solarCorePulseTimer, 0.16);
    this.shake = Math.max(this.shake, 0.04);
    this.ui.flashShield();
    this.ui.showStatus('SHIELD RESTORED');
    this.particles.solarCore(position, 14, this.player.group.position);
    this.audio.play('solarCore');
    this.ui.update(this.stats);
  }

  _handleSurgeBreak(position, obstacle) {
    this.surgeBreakChain += 1;
    this.stats.surgeBreaks += 1;
    this.stats.combo += GAME.surgeBreakComboGain;
    this.stats.maxCombo = Math.max(this.stats.maxCombo, this.stats.combo);
    this._handleStyleMoment('surge');
    this._handleSurgeChainStyle();
    const chainBonus = Math.min(this.surgeBreakChain - 1, 5) * 50;
    const reward = GAME.surgeBreakScore + chainBonus;
    this.stats.score += reward;
    this.startPulseTimer = Math.max(this.startPulseTimer, 0.16);
    this.solarCorePulseTimer = Math.max(this.solarCorePulseTimer, 0.22);
    this.shake = Math.max(this.shake, 0.12);
    this.particles.surgeBreak(position, 40 + Math.min(this.surgeBreakChain, 4) * 6);
    this.physics.createDebris(position, COLORS.solarGold, 18 + Math.min(this.surgeBreakChain, 4) * 3, 9.2);
    this.ui.showSurgeBreak(this.surgeBreakChain, reward);
    this.audio.playSurgeBreak();
    this._recordMissionEvent('passed');
  }


  _handleStyleMoment(source = 'combo') {
    const milestone = Math.floor(this.stats.combo / 10) * 10;

    if (milestone < 10 || milestone <= (this.lastStyleMilestone || 0)) return;

    this.lastStyleMilestone = milestone;

    const elite = milestone >= 30;
    const hyper = this.stats.hyperActive;
    const label =
      milestone >= 50 ? `GOD RUN X${milestone}` :
      milestone >= 40 ? `OVERDRIVE COMBO X${milestone}` :
      milestone >= 30 ? `STYLE COMBO X${milestone}` :
      `COMBO X${milestone}`;

    this.ui.showStatus(label);

    this.startPulseTimer = Math.max(this.startPulseTimer, elite ? 0.32 : 0.22);
    this.missionPulseTimer = Math.max(this.missionPulseTimer, elite ? 0.45 : 0.26);
    this.shake = Math.max(this.shake, elite ? 0.18 : 0.1);

    this.cameraKickImpulse = Math.max(this.cameraKickImpulse, elite ? 0.34 : 0.18);
    this.cameraFovImpulse = Math.max(this.cameraFovImpulse, elite ? 1.75 : 0.95);
    this.cameraRollImpulse += (Math.random() > 0.5 ? 1 : -1) * (elite ? 0.055 : 0.032);

    this.particles.energyBurst(this.player.group.position, elite ? 26 : 16);
    this.particles.sparkle(this.player.group.position, elite ? 18 : 10);

    if (elite || hyper || source === 'surge') {
      this.particles.riftBurst(this.player.group.position, elite ? 24 : 14);
      this._burstAfterimages(elite ? 5 : 3, hyper || source === 'surge');
    }

    this.audio.play(elite ? 'zoneEnter' : 'combo');
  }

  _handleNearMissStyle(chainLevel) {
    if (chainLevel < 2 || chainLevel <= (this.lastChainCallout || 0)) return;

    this.lastChainCallout = chainLevel;

    const label =
      chainLevel >= 4 ? 'RAZOR LINE' :
      chainLevel === 3 ? 'THREAD THE NEEDLE' :
      'CLOSE CALL';

    this.ui.showStatus(label);

    this.cameraKickImpulse = Math.max(this.cameraKickImpulse, chainLevel >= 3 ? 0.22 : 0.12);
    this.cameraFovImpulse = Math.max(this.cameraFovImpulse, chainLevel >= 3 ? 1.25 : 0.7);
    this.cameraRollImpulse += (Math.random() > 0.5 ? 1 : -1) * (chainLevel >= 3 ? 0.06 : 0.035);

    if (chainLevel >= 3) {
      this.startPulseTimer = Math.max(this.startPulseTimer, 0.18);
      this.particles.energyBurst(this.player.group.position, 12 + chainLevel * 3);
      this._spawnAfterimage(this.stats.hyperActive ? 1.2 : 0.8, this.stats.hyperActive, 0.08);
      this.audio.play('warning');
    }
  }

  _handleSurgeChainStyle() {
    if (this.surgeBreakChain < 3) return;
    if (this.surgeBreakChain % 3 !== 0) return;
    if (this.surgeBreakChain <= (this.lastSurgeChainCallout || 0)) return;

    this.lastSurgeChainCallout = this.surgeBreakChain;

    this.ui.showStatus(`SURGE CHAIN X${this.surgeBreakChain}`);

    this.startPulseTimer = Math.max(this.startPulseTimer, 0.3);
    this.solarCorePulseTimer = Math.max(this.solarCorePulseTimer, 0.28);
    this.shake = Math.max(this.shake, 0.2);

    this.cameraKickImpulse = Math.max(this.cameraKickImpulse, 0.42);
    this.cameraFovImpulse = Math.max(this.cameraFovImpulse, 2.0);
    this.cameraRollImpulse += (Math.random() > 0.5 ? 1 : -1) * 0.07;

    this.particles.energyBurst(this.player.group.position, 32);
    this.particles.riftBurst(this.player.group.position, 30);
    this._burstAfterimages(6, true);
    this.audio.play('zoneEnter');
  }

  _handleSolarCoreCue(pattern) {
    if (!pattern?.tutorialText || this.tutorialCues.has(pattern.id)) return;
    this.tutorialCues.add(pattern.id);
    this.ui.showStatus(pattern.tutorialText);
    this.audio.play('openingCue');
  }

  _handleWaveChange(wave) {
    this.stats.wave = wave;
    this.wavePulseTimer = 0.65;
    const nextPalette = this.tunnel.startPaletteTransition(this.tunnel.getNextPaletteIndex(), 0.82);
    this.activePalette = nextPalette;
    if (wave.name === 'pressure' || wave.name === 'risk' || wave.name === 'rift') {
      this.ui.showZone(`WAVE: ${wave.name.toUpperCase()}`, 'FLOW');
    } else {
      this.ui.showZone(nextPalette.name);
    }
    this.tunnel.setWaveFeedback(wave);
    this.audio.play('zoneEnter');
  }

  _addHyperCharge(amount) {
    if (this.stats.hyperActive || this.stats.hyperReady || amount <= 0) return 0;
    const previousCharge = this.stats.hyperCharge;
    this.stats.hyperCharge = Math.min(previousCharge + amount, GAME.hyperChargeMax);
    if (
      this.elapsed < 10 &&
      previousCharge < 50 &&
      this.stats.hyperCharge >= 50 &&
      !this.tutorialCues.has('opening-hyper-charging')
    ) {
      this.tutorialCues.add('opening-hyper-charging');
      this.ui.showStatus('SOLAR CHARGE RISING');
      this.audio.play('hyperCharge');
    }
    if (previousCharge < 90 && this.stats.hyperCharge >= 90 && this.stats.hyperCharge < GAME.hyperChargeMax) {
      this.ui.showStatus('SOLAR SURGE NEAR');
    }
    if (previousCharge < GAME.hyperChargeMax && this.stats.hyperCharge >= GAME.hyperChargeMax) {
      this.stats.hyperReady = true;
      this.hyperReadyTimer = HYPER_READY_PULSE_DURATION;
      this.startPulseTimer = Math.max(this.startPulseTimer, 0.22);
      this.shake = Math.max(this.shake, 0.05); // Subtle shake for ready
      this.ui.showStatus('SOLAR SURGE READY');
      this.audio.playHyperReady();
    }
    return this.stats.hyperCharge - previousCharge;
  }

  _startHyper() {
    if (this.stats.hyperActive || !this.stats.hyperReady) return;
    this.hyperReadyTimer = 0;
    this.hyperTimer = GAME.hyperDuration;
    this.stats.hyperReady = false;
    this.stats.hyperCharge = 0;
    this.stats.hyperActive = true;
    this.stats.hyperTime = this.hyperTimer;
    this.stats.hyperCount += 1;
    this.surgeBreakChain = 0;
    this.startPulseTimer = Math.max(this.startPulseTimer, HYPER_START_FOV_PULSE);
    this.shake = Math.max(this.shake, HYPER_SHAKE_INTENSITY);
    this.cameraKickImpulse = Math.max(this.cameraKickImpulse, 0.95);
    this.cameraFovImpulse = Math.max(this.cameraFovImpulse, 5.2);
    this.cameraRollImpulse += (Math.random() > 0.5 ? 1 : -1) * 0.078;
    this.particles.energyBurst(this.player.group.position, 42);
    this.particles.riftBurst(this.player.group.position, 72);
    this.particles.boostBurst(this.player.group.position, 36);
    this._burstAfterimages(8, true);
    this.audio.playHyperStart();
    this.ui.showStatus('SOLAR SURGE: RAM THROUGH');
  }

  _handlePatternCue(safeLane) {
    this.tunnel.highlightSafeLane(safeLane, this.stats.missionVisual?.focus?.near ? 1.35 : 1);
  }

  _handleOpeningCue(pattern) {
    if (!pattern?.tutorialText) return;
    this.ui.showStatus(pattern.tutorialText);
    this.audio.play(pattern.isNearMissOpportunity ? 'warning' : 'openingCue');
  }

  _syncPalette(delta) {
    const palette = this.tunnel.updatePaletteTransition(delta, this.stats.hyperActive, this.stats.missionVisual, this.stats.wave);
    this.activePalette = palette;
    this.obstacles.setPalette(palette);
    this.particles.setPalette(palette, this.stats.hyperActive);
    this.player.setPalette(palette, this.stats.hyperActive);
    this.scene.background.lerp(new THREE.Color(palette.background), 0.08);
    this.scene.fog.color.lerp(new THREE.Color(palette.fog), 0.08);
    this.cyanLight.color.lerp(new THREE.Color(palette.light), 0.12);
    this.solarLight.color.lerp(new THREE.Color(palette.secondary), 0.12);
  }

  _handleHit(position, obstacle = null) {
    if (this.invincibleTime > 0) return;

    this.stats.shield -= 1;
    this.stats.hitsTaken += 1;
    this.stats.combo = 0;
    this.nearMissChain = 0;
    this.lastLaneChange = null;
    this.hyperReadyTimer = 0;
    this.stats.hyperReady = false;
    this.stats.hyperCharge = Math.max(this.stats.hyperCharge - GAME.hyperHitLoss, 0);
    this.invincibleTime = 1;
    this.hitFlashTime = 0.22;
    
    // Feedback
    const now = performance.now();
    if (!this.lastHitstop || now - this.lastHitstop > HITSTOP_COOLDOWN * 1000) {
       this.hitstopTimer = HITSTOP_DURATION;
       this.lastHitstop = now;
    }
    this.shake = Math.max(this.shake, HIT_SHAKE_INTENSITY);
    this.cameraKickImpulse = Math.max(this.cameraKickImpulse, 0.44);
    this.cameraFovImpulse = Math.max(this.cameraFovImpulse, 2.15);
    this.cameraRollImpulse += (Math.random() > 0.5 ? 1 : -1) * 0.105;
    
    this.particles.burst(position, obstacle?.type === 'plasmaMine' ? 42 : 30);
    this._burstAfterimages(4, this.stats.hyperActive);
    this._spawnImpactDebris(position, obstacle);
    this.ui.flashHit();
    this.ui.flashShield();

    // Boost or high Solar Charge collision gets an extra break layer.
    // This does not change damage logic; it only makes the impact feel heavier.
    const boostImpact = this.boostTimer > 0;
    const chargedImpact = this.stats.hyperCharge >= GAME.hyperChargeMax * 0.7 || this.stats.hyperReady;

    this.audio.playHit();

    if (boostImpact || chargedImpact) {
      this.particles.surgeBreak(position, boostImpact ? 26 : 20);
      this.physics.createDebris(position, COLORS.solarGold, boostImpact ? 14 : 10, boostImpact ? 7.4 : 6.2);
      this.audio.playSurgeBreak();
    }

    this._recordMissionEvent('hit');
    this.ui.update(this.stats);

    if (this.stats.shield <= 0) {
      this.invincibleTime = 0;
      this.hitFlashTime = 0.32;
      this.hyperTimer = 0;
      this.hyperReadyTimer = 0;
      this.stats.hyperActive = false;
      this.stats.hyperReady = false;
      this.stats.hyperCharge = 0;
      this.gameoverTimer = 0.55;
      this.crashSpeed = this.stats.speed;
      
      // Feedback
      this.shake = GAME_OVER_SHAKE_INTENSITY; // Game Over shake
      this.cameraKickImpulse = Math.max(this.cameraKickImpulse, 1.05);
      this.cameraFovImpulse = Math.max(this.cameraFovImpulse, 4.1);
      this.cameraRollImpulse += (Math.random() > 0.5 ? 1 : -1) * 0.13;
      this.particles.burst(position, 58);
      this.particles.riftBurst(position, 50);
      this.physics.createDebris(this.player.group.position, 0xffffff, 48, 9.5);
      
      this.ui.flashGameOver();
      this.audio.stopEngine();
      this.audio.playHit();
      this.audio.playSurgeBreak();
      this.audio.playGameOver();
      this.state = 'crashing';
    }
  }

  _spawnImpactDebris(position, obstacle = null) {
    const type = obstacle?.type ?? obstacle?.userData?.type ?? 'impact';
    const config =
      {
        plasmaMine: { color: COLORS.solarGold, count: 24, strength: 7.2 },
        laserFan: { color: COLORS.solarOrange, count: 18, strength: 6.4 },
        securityGate: { color: COLORS.amber, count: 18, strength: 5.6 },
      }[type] ?? { color: 0xffffff, count: 14, strength: 5 };
    this.physics.createDebris(position, config.color, config.count, config.strength);
  }

  _recordMissionEvent(eventName) {
    this._handleMissionEvents(this.missionManager.record(eventName, this.stats));
  }

  _syncMissions(delta) {
    const result = this.missionManager.update(delta, this.stats);
    this.stats.missions = result.missions;
    this.stats.missionVisual = result.visual;
    this.ui.setMissionFocus(result.visual);
    this._handleMissionEvents(result.events);
  }

  _handleMissionEvents(events) {
    for (const event of events) {
      if (event.type === 'complete') {
        const { mission } = event;
        this.stats.completedMissions += 1;
        this.stats.score += mission.reward;
        if (mission.tier === 'elite') {
          this.stats.shield = Math.min(this.stats.shield + 1, this.stats.maxShield);
          this.boostCooldown = 0;
        }
        this.missionPulseTimer = 0.85;
        this.startPulseTimer = Math.max(this.startPulseTimer, 0.28);
        this.shake = Math.max(this.shake, mission.tier === 'elite' ? 0.28 : 0.16);
        this.particles.riftBurst(new THREE.Vector3(0, -0.45, -6), mission.tier === 'elite' ? 46 : 28);
        this.ui.showMissionComplete(mission.label, mission.reward, mission.tier);
        this.tunnel.pulseMissionFeedback(mission.tier);
        this.audio.play('zoneEnter');
      }

      if (event.type === 'fail') {
        this.missionPulseTimer = 0.35;
        this.shake = Math.max(this.shake, 0.14);
        this.particles.warningBurst(this.player.group.position, event.mission.tier === 'elite' ? 24 : 16);
        this.ui.showMissionFailed(event.mission.label);
        this.tunnel.pulseMissionFeedback('failed');
        this.audio.play('warning');
      }
    }
  }

  _updateRunCues() {
    const cues = [
      { id: 'cores', at: 18.5, label: 'SOLAR CORES BUILD SURGE', prefix: 'TIP' },
    ];

    for (const cue of cues) {
      if (this.elapsed >= cue.at && !this.tutorialCues.has(cue.id)) {
        this.tutorialCues.add(cue.id);
        this.ui.showZone(cue.label, cue.prefix);
      }
    }
  }


  _updateCamera(delta) {
    this.cameraRollImpulse = THREE.MathUtils.damp(this.cameraRollImpulse || 0, 0, 5.2, delta);
    this.cameraKickImpulse = THREE.MathUtils.damp(this.cameraKickImpulse || 0, 0, 5.8, delta);
    this.cameraFovImpulse = THREE.MathUtils.damp(this.cameraFovImpulse || 0, 0, 4.6, delta);
    this.cameraSideImpulse = THREE.MathUtils.damp(this.cameraSideImpulse || 0, 0, 5.4, delta);

    const boostPush = this.boostTimer > 0 ? -0.5 : 0;
    const hyperPush = this.stats.hyperActive ? -0.36 : 0;
    const impulsePush = -(this.cameraKickImpulse || 0);
    const startPush = this.startPulseTimer > 0 ? -0.55 * (this.startPulseTimer / 0.4) : 0;
    const targetZ = 10.2 + boostPush + hyperPush + impulsePush;

    this.tunnel.group.rotation.y = THREE.MathUtils.damp(this.tunnel.group.rotation.y, 0, 6, delta);

    const activeRun = this.state === 'playing' || this.state === 'crashing';
    const targetY = activeRun ? 1.04 + this.player.group.position.y * 0.045 : 1.18;
    const targetX = this.player.group.position.x * 0.09 + (this.cameraSideImpulse || 0);

    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, targetZ + startPush, 5, delta);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, targetY, 4, delta);
    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, targetX, 5, delta);

    if (this.shake > 0) {
      this.shake = Math.max(this.shake - delta, 0);
      const amount = this.shake * this.shake * 0.42;
      this.camera.position.x += (Math.random() - 0.5) * amount;
      this.camera.position.y += (Math.random() - 0.5) * amount;
    }

    const targetFov = THREE.MathUtils.clamp(
      62 +
      (this.boostTimer > 0 ? 2.5 : 0) +
      (this.stats.hyperActive ? 3.5 : 0) +
      (this.startPulseTimer > 0 ? 2 : 0) +
      (this.solarCorePulseTimer > 0 ? 1.1 : 0) +
      (this.nearMissPulseTimer > 0 ? 0.6 * (this.nearMissPulseTimer / NEAR_MISS_FEEDBACK_DURATION) : 0) +
      (this.hitFlashTime > 0 ? 1.2 : 0) +
      ((this.stats.missionVisual?.eliteActive ? 0.7 : 0) + (this.stats.missionVisual?.urgent ? 0.5 : 0)) +
      (this.cameraFovImpulse || 0),
      60.5,
      75,
    );

    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 5, delta);
    this.camera.updateProjectionMatrix();

    this.camera.lookAt(this.player.group.position.x * 0.12, -1.7 + this.player.group.position.y * 0.02, -18);

    const laneRoll = -this.player.group.position.x * 0.018;
    const impulseRoll = this.cameraRollImpulse || 0;
    const targetRoll = THREE.MathUtils.clamp(laneRoll + impulseRoll, -0.145, 0.145);
    this.camera.rotation.z = THREE.MathUtils.damp(this.camera.rotation.z, targetRoll, 8, delta);
  }

  _updateBloomPulse() {
    if (!this.bloomPass) return;
    const pulse = this.startPulseTimer > 0 ? (this.startPulseTimer / 0.4) * 0.32 : 0;
    const boost = this.boostTimer > 0 ? 0.1 : 0;
    const hyper = this.stats.hyperActive ? 0.18 : 0;
    const hit = this.hitFlashTime > 0 ? 0.16 : 0;
    const wave = (this.stats.wave?.intensity ?? 0) * 0.09;
    const wavePulse = this.wavePulseTimer > 0 ? this.wavePulseTimer * 0.08 : 0;
    const mission = (this.stats.missionVisual?.intensity ?? 0) * 0.16;
    const missionPulse = this.missionPulseTimer > 0 ? this.missionPulseTimer * 0.2 : 0;
    const solarCore = this.solarCorePulseTimer > 0 ? this.solarCorePulseTimer * 0.16 : 0;
    const nearMiss = this.nearMissPulseTimer > 0 ? this.nearMissPulseTimer * 0.13 : 0;
    const urgent = this.stats.missionVisual?.urgent ? 0.08 : 0;
    // Bloom post-processing brightens emissive neon surfaces after the scene render pass.
    const strength = this.baseBloomStrength + pulse + boost + hyper + hit + wave + wavePulse + mission + missionPulse + solarCore + nearMiss + urgent;
    this.bloomPass.strength = THREE.MathUtils.clamp(strength, this.baseBloomStrength, 0.92);
    this.bloomPass.radius = THREE.MathUtils.clamp(
      this.baseBloomRadius + (this.stats.hyperActive ? 0.04 : 0) + (this.stats.missionVisual?.eliteActive ? 0.03 : 0),
      this.baseBloomRadius,
      0.34,
    );
    this.bloomPass.threshold = THREE.MathUtils.clamp(this.baseBloomThreshold - (this.boostTimer > 0 || this.stats.hyperActive ? 0.025 : 0), 0.36, 0.46);

    if (this.rgbShiftPass) {
      // Chromatic Aberration for Hits and Hyper mode
      let shiftAmount = 0;
      if (this.stats.hyperActive) shiftAmount += 0.003;
      if (this.hitFlashTime > 0) shiftAmount += 0.008 * (this.hitFlashTime / 0.22);

      this.rgbShiftPass.uniforms['amount'].value = THREE.MathUtils.damp(
          this.rgbShiftPass.uniforms['amount'].value,
          shiftAmount,
          10,
          0.016
      );
      this.rgbShiftPass.uniforms['angle'].value = Math.sin(performance.now() * 0.01) * Math.PI;
    }
  }

  _resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const compact = this._isCompactViewport();
    const portrait = height > width;
    const targetFov = compact ? (portrait ? 70 : 66) : this.baseCameraFov;
    const targetY = compact && portrait ? 1.0 : 1.06;
    const targetZ = compact && portrait ? 10.8 : 10.2;

    this.camera.aspect = width / height;
    this.camera.fov = targetFov;
    this.camera.updateProjectionMatrix();
    this.camera.position.set(0, targetY, targetZ);
    this.camera.lookAt(0, -1.7, -18);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, compact ? 1.5 : 2));
    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);
    this.ssaoPass?.setSize(width, height);
    this.bloomPass.setSize(width, height);
    if (this.ssaoPass) this.ssaoPass.enabled = !compact;
    this.ui?.setCompactMode(compact);
    this.player?.setDeviceScale(compact ? 0.84 : 1);
  }

  _isCompactViewport() {
    return window.matchMedia?.('(max-width: 920px), (hover: none) and (pointer: coarse)')?.matches ?? false;
  }
}
