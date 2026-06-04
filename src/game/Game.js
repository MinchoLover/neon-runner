import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { AudioManager } from './AudioManager.js';
import { COLORS, GAME, TUNNEL_PALETTES } from './constants.js';
import { ObstacleManager } from './ObstacleManager.js';
import { ParticleManager } from './ParticleManager.js';
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
      hyperTime: 0,
      maxCombo: 0,
      nearMisses: 0,
      hyperCount: 0,
      riftTurns: 0,
      boostsUsed: 0,
      missions: [],
    };
    this.elapsed = 0;
    this.boostTimer = 0;
    this.boostCooldown = 0;
    this.hyperTimer = 0;
    this.nearMissChain = 0;
    this.invincibleTime = 0;
    this.hitFlashTime = 0;
    this.gameoverTimer = 0;
    this.countdownTimer = 0;
    this.countdownLabel = '';
    this.startPulseTimer = 0;
    this.crashSpeed = 0;
    this.shake = 0;
    this.turnPulseTimer = 0;
    this.activePalette = TUNNEL_PALETTES[0];
    this.tutorialCues = new Set();
    this.completedMissionIds = new Set();
    this.stats.missions = this._createMissions();

    this._setupScene();
    this._setupWorld();
    this._bindEvents();
    this.ui.update(this.stats);
    this.ui.setState(this.state, this.stats);
  }

  start() {
    this.renderer.setAnimationLoop((timestamp) => this._tick(timestamp));
  }

  _setupScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(COLORS.dark);
    this.scene.fog = new THREE.FogExp2(0x04000f, 0.028);

    this.camera = new THREE.PerspectiveCamera(66, window.innerWidth / window.innerHeight, 0.1, 150);
    this.camera.position.set(0, 1.34, 10.65);
    this.camera.lookAt(0, -0.8, -12);

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
  }

  _setupWorld() {
    this.scene.add(new THREE.AmbientLight(0x3b2f7a, 0.75));

    this.cyanLight = new THREE.PointLight(COLORS.cyan, 38, 22);
    this.cyanLight.position.set(-3.4, 2.2, 0);
    this.scene.add(this.cyanLight);

    this.magentaLight = new THREE.PointLight(COLORS.magenta, 42, 24);
    this.magentaLight.position.set(3.2, 1.4, -8);
    this.scene.add(this.magentaLight);

    this.tunnel = new Tunnel(this.scene);
    this.player = new Player();
    this.scene.add(this.player.group);
    this.obstacles = new ObstacleManager(this.scene);
    this.particles = new ParticleManager(this.scene);
    this._syncPalette(0.016);
  }

  _bindEvents() {
    window.addEventListener('resize', () => this._resize());
    window.addEventListener('keydown', (event) => this._onKeyDown(event));
    window.addEventListener('keyup', (event) => this.keys.delete(event.code));
  }

  _onKeyDown(event) {
    if (['ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    void this.audio.unlock();
    if (this.keys.has(event.code)) return;
    this.keys.add(event.code);

    if (event.code === 'Space') {
      if (this.state === 'ready' || this.state === 'gameover') {
        this._beginCountdown();
        this.audio.play('start');
        return;
      }
      if (this.state === 'playing') {
        this._tryBoost();
      }
    }

    if ((event.code === 'KeyP' || event.code === 'Escape') && (this.state === 'playing' || this.state === 'paused')) {
      this.state = this.state === 'paused' ? 'playing' : 'paused';
      this.ui.setState(this.state, this.stats);
      return;
    }

    if (this.state !== 'playing') return;
    if (event.code === 'KeyA' || event.code === 'ArrowLeft') {
      this._handleTurnInput(-1);
      this._movePlayer(-1);
    }
    if (event.code === 'KeyD' || event.code === 'ArrowRight') {
      this._handleTurnInput(1);
      this._movePlayer(1);
    }
  }

  _movePlayer(direction) {
    const previousLane = this.player.lane;
    this.player.move(direction);
    if (this.player.lane !== previousLane) this.audio.play('move');
  }

  _tryBoost() {
    if (this.boostCooldown > 0) return;
    this.boostTimer = GAME.boostDuration;
    this.boostCooldown = GAME.boostCooldown;
    this.stats.boostsUsed += 1;
    this.shake = Math.max(this.shake, 0.12);
    this.audio.play('boost');
  }

  _handleTurnInput(direction) {
    const result = this.obstacles.resolveTurnInput(direction);
    if (!result) return;
    if (result.success) {
      this._handleTurnGate(direction, result.obstacle.group.position);
    } else {
      this.audio.play('turnWarning');
    }
  }

  _beginCountdown() {
    this.state = 'countdown';
    this.elapsed = 0;
    this.boostTimer = 0;
    this.boostCooldown = 0;
    this.hyperTimer = 0;
    this.nearMissChain = 0;
    this.invincibleTime = 0;
    this.hitFlashTime = 0;
    this.gameoverTimer = 0;
    this.countdownTimer = 2.05;
    this.countdownLabel = '';
    this.startPulseTimer = 0;
    this.crashSpeed = 0;
    this.shake = 0;
    this.turnPulseTimer = 0;
    this.stats.score = 0;
    this.stats.combo = 0;
    this.stats.distance = 0;
    this.stats.speed = GAME.startSpeed;
    this.stats.shield = GAME.shield;
    this.stats.boostReady = true;
    this.stats.boostCooldown = 0;
    this.stats.hyperActive = false;
    this.stats.hyperTime = 0;
    this.stats.maxCombo = 0;
    this.stats.nearMisses = 0;
    this.stats.hyperCount = 0;
    this.stats.riftTurns = 0;
    this.stats.boostsUsed = 0;
    this.stats.missions = this._createMissions();
    this.tutorialCues.clear();
    this.completedMissionIds.clear();
    this.player.reset();
    this.obstacles.reset();
    this.particles.reset();
    this.tunnel.setTunnelPalette(0);
    this.activePalette = TUNNEL_PALETTES[0];
    this._syncPalette(0.016);
    this.ui.setState(this.state, this.stats);
    this._setCountdownLabel('3');
    this.ui.update(this.stats);
  }

  _tick(timestamp) {
    this.timer.update(timestamp);
    const delta = Math.min(this.timer.getDelta(), 0.033);
    this.invincibleTime = Math.max(this.invincibleTime - delta, 0);
    this.hitFlashTime = Math.max(this.hitFlashTime - delta, 0);
    if (this.state === 'playing') this._updatePlaying(delta);
    else if (this.state === 'countdown') this._updateCountdown(delta);
    else if (this.state === 'crashing') this._updateCrashing(delta);
    else if (this.state === 'paused') this._updatePaused(delta);
    else this._updateAttract(delta);

    this.particles.update(delta);
    this._updateCamera(delta);
    this._updateBloomPulse();
    this.composer.render();
  }

  _updateAttract(delta) {
    this._syncPalette(delta);
    this.tunnel.update(delta, GAME.startSpeed * 0.65);
    this.player.update(delta, 0, this.invincibleTime, this.hitFlashTime);
    this.player.group.rotation.y += delta * 0.15;
  }

  _updateCountdown(delta) {
    this.countdownTimer = Math.max(this.countdownTimer - delta, 0);
    this._syncPalette(delta);
    this.tunnel.update(delta, GAME.startSpeed * 0.78);
    this.player.update(delta, 0, 0, 0);

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
    this.turnPulseTimer = Math.max(this.turnPulseTimer - delta, 0);
    this.startPulseTimer = Math.max(this.startPulseTimer - delta, 0);
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
    this.tunnel.update(delta, this.stats.speed, this.stats.hyperActive ? 1 : 0);
    this.player.update(delta, boostFactor, this.invincibleTime, this.hitFlashTime);
    if (boostFactor || this.stats.hyperActive) this.particles.boostTrail(this.player.group.position, this.stats.hyperActive);
    this.obstacles.update(delta, this.stats.speed, this.elapsed, {
      playerLane: this.player.lane,
      onPattern: (safeLane) => this.tunnel.highlightSafeLane(safeLane),
      onHit: (position, obstacle) => this._handleHit(position, obstacle),
      onPassed: () => this._handlePassed(),
      onNearMiss: (position) => this._handleNearMiss(position),
      onTurnGateActive: (direction) => this._handleTurnGateActive(direction),
      onTurnGateMissed: (direction, position, obstacle) => this._handleTurnGateMissed(direction, position, obstacle),
      onTurnGate: (direction, position) => this._handleTurnGate(direction, position),
    });

    this._syncMissions();
    this.ui.update(this.stats);
  }

  _updatePaused(delta) {
    this._syncPalette(delta);
    this.tunnel.update(delta, GAME.startSpeed * 0.25, 0);
    this.player.update(delta, 0, this.invincibleTime, this.hitFlashTime);
  }

  _updateCrashing(delta) {
    this.gameoverTimer = Math.max(this.gameoverTimer - delta, 0);
    this.crashSpeed = THREE.MathUtils.damp(this.crashSpeed, 0, 5, delta);
    this._syncPalette(delta);
    this.tunnel.update(delta, this.crashSpeed);
    this.player.update(delta, 0, 0, this.hitFlashTime);
    this.stats.speed = this.crashSpeed;
    this.ui.update(this.stats);

    if (this.gameoverTimer <= 0) {
      this.state = 'gameover';
      this.ui.setState(this.state, this.stats);
    }
  }

  _handlePassed() {
    this.stats.combo += 1;
    this.stats.maxCombo = Math.max(this.stats.maxCombo, this.stats.combo);
    const multiplier = this.stats.hyperActive ? 2 : 1;
    this.stats.score += (125 + this.stats.combo * 35) * multiplier;
    this.particles.sparkle(this.player.group.position, this.stats.hyperActive ? 18 : 9);
    this.audio.play('pass');
    if (this.stats.combo > 0 && this.stats.combo % 4 === 0) this.audio.play('combo');
    this._maybeStartHyper();
  }

  _handleNearMiss(position) {
    this.nearMissChain += 1;
    this.stats.nearMisses += 1;
    this.stats.combo += 2;
    this.stats.maxCombo = Math.max(this.stats.maxCombo, this.stats.combo);
    const multiplier = this.stats.hyperActive ? 2 : 1;
    this.stats.score += (150 + this.stats.combo * 10) * multiplier;
    this.ui.showNearMiss();
    this.particles.nearMiss(position);
    this.audio.play('near');
    this.shake = Math.max(this.shake, 0.12);
    this._maybeStartHyper();
  }

  _maybeStartHyper() {
    if (this.stats.hyperActive) return;
    if (this.stats.combo >= GAME.hyperCombo || this.nearMissChain >= 4 || this.stats.distance > 650) {
      this.hyperTimer = GAME.hyperDuration;
      this.stats.hyperActive = true;
      this.stats.hyperCount += 1;
      this.startPulseTimer = 0.4;
      this.shake = Math.max(this.shake, 0.22);
      this.audio.play('hyperStart');
    }
  }

  _handleTurnGate(direction, position) {
    const nextIndex = this.tunnel.getNextPaletteIndex();
    const nextPalette = this.tunnel.startPaletteTransition(nextIndex, 0.82);
    this.activePalette = nextPalette;
    this.turnPulseTimer = 0.55;
    this.tunnel.setVisualMode('turnExit', 0.75);
    this.startPulseTimer = 0.42;
    this.shake = Math.max(this.shake, 0.08);
    this.stats.combo += 2;
    this.stats.maxCombo = Math.max(this.stats.maxCombo, this.stats.combo);
    this.stats.riftTurns += 1;
    this.stats.score += 260 * (this.stats.hyperActive ? 2 : 1);
    this.ui.showTurnResult('PERFECT TURN');
    window.setTimeout(() => {
      this.ui.showZone(nextPalette.name);
      this.audio.play('zoneEnter');
    }, 420);
    this.particles.riftBurst(new THREE.Vector3(0, -0.45, -6), 34);
    this.audio.play('turnSuccess');
    this.audio.play('tunnelTransition');
    this._maybeStartHyper();
  }

  _handleTurnGateActive(direction) {
    this.tunnel.setVisualMode('turnApproach', 1.2);
    this.ui.showTurnPrompt(direction);
    this.audio.play('turnWarning');
  }

  _handleTurnGateMissed(direction, position, obstacle) {
    this.tunnel.setVisualMode('straight', 0);
    this.ui.showTurnResult('MISSED TURN', true);
    this.audio.play('turnFail');
    this._handleHit(position, obstacle);
  }

  _syncPalette(delta) {
    const palette = this.tunnel.updatePaletteTransition(delta, this.stats.hyperActive);
    this.activePalette = palette;
    this.obstacles.setPalette(palette);
    this.particles.setPalette(palette, this.stats.hyperActive);
    this.player.setPalette(palette, this.stats.hyperActive);
    this.scene.background.lerp(new THREE.Color(palette.background), 0.08);
    this.scene.fog.color.lerp(new THREE.Color(palette.fog), 0.08);
    this.cyanLight.color.lerp(new THREE.Color(palette.light), 0.12);
    this.magentaLight.color.lerp(new THREE.Color(palette.secondary), 0.12);
  }

  _handleHit(position, obstacle = null) {
    if (this.invincibleTime > 0) return;

    this.stats.shield -= 1;
    this.stats.combo = 0;
    this.nearMissChain = 0;
    this.invincibleTime = 1;
    this.hitFlashTime = 0.22;
    this.shake = 0.5;
    this.particles.burst(position, 34);
    this.ui.flashHit();
    this.ui.flashShield();
    this.audio.play('hit');
    if (obstacle?.type === 'turnGate') {
      this.ui.showTurnResult('TURN MISSED', true);
      this.audio.play('warning');
    }
    this.ui.update(this.stats);

    if (this.stats.shield <= 0) {
      this.invincibleTime = 0;
      this.hitFlashTime = 0.32;
      this.hyperTimer = 0;
      this.stats.hyperActive = false;
      this.gameoverTimer = 0.55;
      this.crashSpeed = this.stats.speed;
      this.shake = 0.95;
      this.particles.burst(position, 58);
      this.audio.play('shieldBreak');
      this.audio.play('gameover');
      this.state = 'crashing';
    }
  }

  _createMissions() {
    const pool = [
      {
        id: 'distance-650',
        label: 'Reach 650M',
        target: 650,
        read: () => Math.floor(this.stats.distance),
      },
      {
        id: 'score-9000',
        label: 'Score 9,000',
        target: 9000,
        read: () => Math.floor(this.stats.score),
      },
      {
        id: 'combo-14',
        label: 'Hit X 14 Combo',
        target: 14,
        read: () => this.stats.maxCombo,
      },
      {
        id: 'near-5',
        label: 'Near Miss 5',
        target: 5,
        read: () => this.stats.nearMisses,
      },
      {
        id: 'hyper-1',
        label: 'Enter Hyper',
        target: 1,
        read: () => this.stats.hyperCount,
      },
      {
        id: 'rift-2',
        label: 'Perfect Turn 2',
        target: 2,
        read: () => this.stats.riftTurns,
      },
      {
        id: 'boost-4',
        label: 'Boost 4 Times',
        target: 4,
        read: () => this.stats.boostsUsed,
      },
    ];

    return pool
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map((mission) => ({
        id: mission.id,
        label: mission.label,
        target: mission.target,
        value: 0,
        complete: false,
        read: mission.read,
      }));
  }

  _syncMissions() {
    for (const mission of this.stats.missions) {
      mission.value = Math.min(mission.read(), mission.target);
      const wasComplete = mission.complete;
      mission.complete = mission.value >= mission.target;
      if (!wasComplete && mission.complete && !this.completedMissionIds.has(mission.id)) {
        this.completedMissionIds.add(mission.id);
        this.stats.score += 550;
        this.ui.showMissionComplete(mission.label);
        this.audio.play('zoneEnter');
      }
    }
  }

  _updateRunCues() {
    const cues = [
      { id: 'combo', at: 1.2, label: 'CHAIN DODGES', prefix: 'TIP' },
      { id: 'near', at: 5.5, label: 'NEAR MISS BUILDS HYPER', prefix: 'TIP' },
      { id: 'turn', at: 10.5, label: 'RIFT TURNS CHANGE THE ZONE', prefix: 'TIP' },
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
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, targetZ + startPush, 5, delta);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, targetY, 4, delta);
    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, this.player.group.position.x * 0.12, 5, delta);

    if (this.shake > 0) {
      this.shake = Math.max(this.shake - delta, 0);
      const amount = this.shake * this.shake * 0.42;
      this.camera.position.x += (Math.random() - 0.5) * amount;
      this.camera.position.y += (Math.random() - 0.5) * amount;
    }
    const targetFov =
      66 +
      (this.boostTimer > 0 ? 2.5 : 0) +
      (this.stats.hyperActive ? 3.5 : 0) +
      (this.startPulseTimer > 0 ? 2 : 0) +
      (this.turnPulseTimer > 0 ? 1.5 : 0);
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 5, delta);
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(this.player.group.position.x * 0.16, -0.75 + this.player.group.position.y * 0.08, -15);
  }

  _updateBloomPulse() {
    if (!this.bloomPass) return;
    const pulse = this.startPulseTimer > 0 ? (this.startPulseTimer / 0.4) * 0.32 : 0;
    const hyper = this.stats.hyperActive ? 0.18 : 0;
    this.bloomPass.strength = this.baseBloomStrength + pulse + hyper;
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
