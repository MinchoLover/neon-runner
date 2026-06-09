import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
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
  AUDIO_EVENT_COOLDOWN
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
      scoreRings: 0,
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
    this.scoreRingPulseTimer = 0;
    this.wavePulseTimer = 0;
    this.nearMissPulseTimer = 0;
    this.hitstopTimer = 0;
    this.activePalette = TUNNEL_PALETTES[0];
    this.tutorialCues = new Set();
    this.missionManager = new MissionManager();
    this.stats.missions = this.missionManager.reset(this.stats);

    this._setupScene();
    this._setupWorld();
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
    this.scene.fog = new THREE.FogExp2(0x04000f, 0.028);

    // PerspectiveCamera defines the view frustum. Three.js projects visible 3D geometry
    // through this camera; clipping and viewport/screen mapping are handled by WebGLRenderer.
    this.camera = new THREE.PerspectiveCamera(66, window.innerWidth / window.innerHeight, 0.1, 150);
    this.camera.position.set(0, 1.34, 10.65);
    this.camera.lookAt(0, -0.8, -12);

    // Rendering pipeline: scene + camera are rendered into a WebGL canvas, then routed
    // through EffectComposer so bloom can be applied as a post-processing pass.
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    const renderPass = new RenderPass(this.scene, this.camera);
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.88,
      0.48,
      0.22,
    );
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(renderPass);
    this.composer.addPass(bloomPass);
    this.bloomPass = bloomPass;
    this.baseBloomStrength = bloomPass.strength;
    this.baseBloomRadius = bloomPass.radius;
    this.baseBloomThreshold = bloomPass.threshold;
  }

  _setupWorld() {
    this.scene.add(new THREE.AmbientLight(0x020308, 0.5));

    this.cyanLight = new THREE.PointLight(COLORS.cyan, 38, 22);
    this.cyanLight.position.set(-3.4, 2.2, 0);
    this.scene.add(this.cyanLight);

    this.solarLight = new THREE.PointLight(COLORS.solarOrange, 42, 24);
    this.solarLight.position.set(3.2, 1.4, -8);
    this.scene.add(this.solarLight);

    this.tunnel = new Tunnel(this.scene);
    this.player = new Player();
    this.scene.add(this.player.group);
    this.obstacles = new ObstacleManager(this.scene);
    this.particles = new ParticleManager(this.scene);
    this.physics = new PhysicsManager(this.scene);
    this._syncPalette(0.016);
  }

  _bindEvents() {
    window.addEventListener('resize', () => this._resize());
    window.addEventListener('keydown', (event) => this._onKeyDown(event));
    window.addEventListener('keyup', (event) => this.keys.delete(event.code));
    this.ui.mobileControls?.addEventListener('pointerdown', (event) => this._onPointerInput(event));
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
    if (this.state === 'playing') this._tryBoost();
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
      this.audio.play('move');
    }
  }

  _tryBoost() {
    if (this.boostCooldown > 0) return;
    this.boostTimer = GAME.boostDuration;
    this.boostCooldown = GAME.boostCooldown;
    this.stats.boostsUsed += 1;
    this.shake = Math.max(this.shake, 0.12);
    this.audio.play('boost');
    this._recordMissionEvent('boost');
  }

  _beginCountdown() {
    this.state = 'countdown';
    this.elapsed = 0;
    this.boostTimer = 0;
    this.boostCooldown = 0;
    this.hyperTimer = 0;
    this.hyperReadyTimer = 0;
    this.nearMissChain = 0;
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
    this.scoreRingPulseTimer = 0;
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
    this.stats.scoreRings = 0;
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
    this.particles.reset();
    this.physics.reset();
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
    this.scoreRingPulseTimer = Math.max(this.scoreRingPulseTimer - delta, 0);
    this.wavePulseTimer = Math.max(this.wavePulseTimer - delta, 0);
    this.nearMissPulseTimer = Math.max(this.nearMissPulseTimer - delta, 0);
    this.hyperReadyTimer = Math.max(this.hyperReadyTimer - delta, 0);
    if (this.stats.hyperReady && this.hyperReadyTimer <= 0) this._startHyper();
    const wasHyper = this.stats.hyperActive;
    this.stats.hyperActive = this.hyperTimer > 0;
    this.stats.hyperTime = this.hyperTimer;
    if (wasHyper && !this.stats.hyperActive) this.audio.play('hyperEnd');
    const boostFactor = this.boostTimer > 0 ? 1 : 0;
    const hyperFactor = this.stats.hyperActive ? 1 : 0;
    const baseSpeed = Math.min(GAME.startSpeed + this.elapsed * 0.55, GAME.maxSpeed);
    this.stats.speed = baseSpeed + boostFactor * GAME.boostSpeed + hyperFactor * 4;
    this.stats.distance += this.stats.speed * delta * 1.35;
    const multiplier = this.stats.hyperActive ? 2 : 1;
    this.stats.score += delta * (85 + this.stats.speed * 7 + this.stats.combo * 18) * multiplier;
    this.stats.boostReady = this.boostCooldown <= 0;
    this.stats.boostCooldown = this.boostCooldown;
    this.stats.maxCombo = Math.max(this.stats.maxCombo, this.stats.combo);

    this._syncPalette(delta);
    this._updateRunCues();
    this.tunnel.update(delta, this.stats.speed, this.stats.hyperActive ? 1 : 0, this.stats.wave);
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
    this.obstacles.update(delta, this.stats.speed, this.elapsed, {
      playerX: this.player.group.position.x,
      playerLane: this.player.lane,
      laneChange: this.lastLaneChange,
      onPattern: (safeLane) => this._handlePatternCue(safeLane),
      onOpeningCue: (pattern) => this._handleOpeningCue(pattern),
      onWaveChange: (wave) => this._handleWaveChange(wave),
      onHit: (position, obstacle) => this._handleHit(position, obstacle),
      onPassed: (obstacle) => this._handlePassed(obstacle),
      onNearMiss: (position) => this._handleNearMiss(position),
      onScoreRing: (position, ring) => this._handleScoreRing(position, ring),
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
    const multiplier = this.stats.hyperActive ? 2 : 1;
    this.stats.score += (125 + this.stats.combo * 35) * multiplier;
    this.particles.sparkle(this.player.group.position, this.stats.hyperActive ? 12 : 5);
    if (this.stats.hyperActive && this.stats.missionVisual?.focus?.hyper) {
      this.particles.scoreRingBurst(this.player.group.position, 12);
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
    
    // Feedback
    this.nearMissPulseTimer = NEAR_MISS_FEEDBACK_DURATION;
    this.shake = Math.max(this.shake, NEAR_MISS_SHAKE_INTENSITY);
    
    const hyperGain = this._addHyperCharge(GAME.hyperNearMissGain);
    this.ui.showNearMiss(chainLevel, hyperGain);
    this.particles.nearMiss(position, chainLevel);
    this.audio.playNearMiss();
    
    this._recordMissionEvent('nearMiss');
  }

  _handleScoreRing(position, ring) {
    const reward = Math.round(450 * (this.stats.hyperActive ? 1.5 : 1));
    this.stats.score += reward;
    this.stats.combo += 1;
    this.stats.maxCombo = Math.max(this.stats.maxCombo, this.stats.combo);
    this.stats.scoreRings += 1;
    this.scoreRingPulseTimer = 0.48;
    this.startPulseTimer = Math.max(this.startPulseTimer, 0.18);
    this.shake = Math.max(this.shake, ring.riskType === 'risk' ? 0.12 : 0.08);
    this.ui.showStatus(`RISK RING +${reward}`);
    this.particles.scoreRingBurst(position, ring.riskType === 'risk' ? 18 : 14);
    this.audio.play('combo');
    this._addHyperCharge(GAME.hyperRingGain);
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
      this.ui.showStatus('HYPER CHARGING');
      this.audio.play('hyperCharge');
    }
    if (previousCharge < 90 && this.stats.hyperCharge >= 90 && this.stats.hyperCharge < GAME.hyperChargeMax) {
      this.ui.showStatus('ALMOST HYPER');
    }
    if (previousCharge < GAME.hyperChargeMax && this.stats.hyperCharge >= GAME.hyperChargeMax) {
      this.stats.hyperReady = true;
      this.hyperReadyTimer = HYPER_READY_PULSE_DURATION;
      this.startPulseTimer = Math.max(this.startPulseTimer, 0.22);
      this.shake = Math.max(this.shake, 0.05); // Subtle shake for ready
      this.ui.showStatus('HYPER READY');
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
    this.startPulseTimer = Math.max(this.startPulseTimer, HYPER_START_FOV_PULSE);
    this.shake = Math.max(this.shake, HYPER_SHAKE_INTENSITY);
    this.particles.scoreRingBurst(this.player.group.position, 24);
    this.particles.riftBurst(this.player.group.position, 40); // extra burst for hyper start
    this.audio.playHyperStart();
    this.ui.showStatus('HYPER MODE');
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
    
    this.particles.burst(position, obstacle?.type === 'plasmaMine' ? 42 : 30);
    this._spawnImpactDebris(position, obstacle);
    this.ui.flashHit();
    this.ui.flashShield();
    this.audio.playHit();
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
      this.particles.burst(position, 58);
      this.particles.riftBurst(position, 50);
      this.physics.createDebris(this.player.group.position, 0xffffff, 36, 8.5);
      
      this.ui.flashGameOver();
      this.audio.playHit();
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
      { id: 'rings', at: 12.5, label: 'RISK RINGS REWARD LATE MOVES', prefix: 'TIP' },
    ];

    for (const cue of cues) {
      if (this.elapsed >= cue.at && !this.tutorialCues.has(cue.id)) {
        this.tutorialCues.add(cue.id);
        this.ui.showZone(cue.label, cue.prefix);
      }
    }
  }

  _updateCamera(delta) {
    const boostPush = this.boostTimer > 0 ? -0.35 : 0;
    const hyperPush = this.stats.hyperActive ? -0.22 : 0;
    const startPush = this.startPulseTimer > 0 ? -0.55 * (this.startPulseTimer / 0.4) : 0;
    const targetZ = 10.65 + boostPush + hyperPush;
    this.tunnel.group.rotation.y = THREE.MathUtils.damp(this.tunnel.group.rotation.y, 0, 6, delta);
    const activeRun = this.state === 'playing' || this.state === 'crashing';
    const targetY = activeRun ? 1.3 + this.player.group.position.y * 0.08 : 1.54;
    // Camera motion changes the view transform, while each mesh keeps its own model transform.
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, targetZ + startPush, 5, delta);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, targetY, 4, delta);
    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, this.player.group.position.x * 0.12, 5, delta);

    if (this.shake > 0) {
      this.shake = Math.max(this.shake - delta, 0);
      const amount = this.shake * this.shake * 0.42;
      this.camera.position.x += (Math.random() - 0.5) * amount;
      this.camera.position.y += (Math.random() - 0.5) * amount;
    }
    const targetFov = THREE.MathUtils.clamp(
      66 +
      (this.boostTimer > 0 ? 2.5 : 0) +
      (this.stats.hyperActive ? 3.5 : 0) +
      (this.startPulseTimer > 0 ? 2 : 0) +
      (this.scoreRingPulseTimer > 0 ? 1.1 : 0) +
      (this.nearMissPulseTimer > 0 ? 0.6 * (this.nearMissPulseTimer / NEAR_MISS_FEEDBACK_DURATION) : 0) +
      (this.hitFlashTime > 0 ? 1.2 : 0) +
      ((this.stats.missionVisual?.eliteActive ? 0.7 : 0) + (this.stats.missionVisual?.urgent ? 0.5 : 0)),
      64,
      73.5,
    );
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 5, delta);
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(this.player.group.position.x * 0.16, -0.75 + this.player.group.position.y * 0.08, -15);
    this.camera.rotation.z = THREE.MathUtils.damp(this.camera.rotation.z, 0, 5, delta);
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
    const scoreRing = this.scoreRingPulseTimer > 0 ? this.scoreRingPulseTimer * 0.16 : 0;
    const nearMiss = this.nearMissPulseTimer > 0 ? this.nearMissPulseTimer * 0.13 : 0;
    const urgent = this.stats.missionVisual?.urgent ? 0.08 : 0;
    // Bloom post-processing brightens emissive neon surfaces after the scene render pass.
    const strength = this.baseBloomStrength + pulse + boost + hyper + hit + wave + wavePulse + mission + missionPulse + scoreRing + nearMiss + urgent;
    this.bloomPass.strength = THREE.MathUtils.clamp(strength, this.baseBloomStrength, 1.5);
    this.bloomPass.radius = THREE.MathUtils.clamp(
      this.baseBloomRadius + (this.stats.hyperActive ? 0.04 : 0) + (this.stats.missionVisual?.eliteActive ? 0.03 : 0),
      this.baseBloomRadius,
      0.52,
    );
    this.bloomPass.threshold = THREE.MathUtils.clamp(this.baseBloomThreshold - (this.boostTimer > 0 || this.stats.hyperActive ? 0.02 : 0), 0.16, 0.24);

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
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);
    this.bloomPass.setSize(width, height);
  }
}
