import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  COLORS,
  GAME,
  LANE_COUNT,
  LANE_X,
  NEAR_MISS_DANGER_DISTANCE,
  NEAR_MISS_TIME_WINDOW,
  NEAR_MISS_Z_WINDOW,
  OPENING_MIN_SAFE_GAP,
  OPENING_PATTERNS,
  OPENING_SEQUENCE_DURATION,
  OPENING_TRANSITION_DURATION,
  OPENING_TRANSITION_SPAWN_Z,
  PLAYER_HIT_Z_RANGE,
  SOLAR_CORE,
  SOLAR_CORE_PATTERNS,
  SHIELD_PICKUP,
  TUNNEL_PALETTES,
  getLaneAngle,
  getLanePosition,
} from './constants.js';

const DEBUG_HITBOX = false;
const PLAYER_HIT_X_RANGE = 1.05;
const DEBUG_OPENING = Boolean(import.meta.env?.DEV);
const WAVE_DURATION = 10.5;
const WAVE_SEQUENCE = ['warmup', 'pressure', 'risk', 'rift', 'cooldown'];
const READABILITY_COLORS = {
  blocker: 0xff6200,
  bar: 0xffb700,
  gateBlock: 0xff8c00,
  safe: 0x00e5ff,
  reward: 0xffffff,
};
const OBSTACLE_MODEL_PATHS = {
  energyBarricade: '/assets/models/obstacles/energy_pylon.glb',
  securityGate: '/assets/models/obstacles/energy_pylon.glb',
  laserFan: '/assets/models/obstacles/turret_arm.glb',
  shutterTrap: '/assets/models/obstacles/energy_pylon.glb',
  plasmaMine: '/assets/models/obstacles/solar_crate.glb',
};

export class ObstacleManager {
  constructor(scene) {
    this.scene = scene;
    this.obstacles = [];
    this.solarCores = [];
    this.shieldPickups = [];
    this.spawnTimer = 0;
    this.patternIndex = 0;
    this.solarCorePatternIndex = 0;
    this.nextSolarCoreTime = SOLAR_CORE_PATTERNS[0].minElapsed;
    this.nextShieldPickupTime = 16;
    this.nextSpawnDelay = null;
    this.currentWave = 'warmup';
    this.openingSpawnedIds = new Set();
    this.openingCueIds = new Set();
    this.openingComplete = false;
    this.modelCache = new Map();
    this._loadOptionalObstacleModels();
    this.palette = TUNNEL_PALETTES[0];
    this.boxMaterial = new THREE.MeshStandardMaterial({
      color: 0x000000,
      emissive: READABILITY_COLORS.blocker,
      emissiveIntensity: 0.88,
      metalness: 0.82,
      roughness: 0.24,
    });
    this.barMaterial = new THREE.MeshStandardMaterial({
      color: 0x000000,
      emissive: READABILITY_COLORS.bar,
      emissiveIntensity: 0.95,
      metalness: 0.9,
      roughness: 0.2,
    });
    this.edgeMaterial = new THREE.LineBasicMaterial({
      color: COLORS.solarGold,
      transparent: true,
      opacity: 0.72,
    });
    this.gateMaterial = new THREE.MeshStandardMaterial({
      color: 0x000000,
      emissive: READABILITY_COLORS.gateBlock,
      emissiveIntensity: 0.84,
      metalness: 0.8,
      roughness: 0.22,
    });
    this.safeFrameMaterial = new THREE.MeshStandardMaterial({
      color: 0x02191c,
      emissive: READABILITY_COLORS.safe,
      emissiveIntensity: 1.1,
      metalness: 0.2,
      roughness: 0.22,
    });
    this.solarCoreWhiteMaterial = new THREE.MeshBasicMaterial({
      color: COLORS.white,
      transparent: true,
      opacity: 0.96,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      depthWrite: false,
    });
    this.solarCoreGoldMaterial = new THREE.MeshBasicMaterial({
      color: COLORS.solarGold,
      transparent: true,
      opacity: 0.52,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      depthWrite: false,
    });
    this.solarCoreCyanMaterial = new THREE.MeshBasicMaterial({
      color: COLORS.cyan,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      depthWrite: false,
    });
    this.openingPanelMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a0800,
      emissive: 0x4a1200,
      emissiveIntensity: 0.44,
      metalness: 0.62,
      roughness: 0.3,
      transparent: true,
      opacity: 0.88,
    });
    this.openingFrameMaterial = new THREE.MeshStandardMaterial({
      color: 0x221100,
      emissive: READABILITY_COLORS.blocker,
      emissiveIntensity: 1.05,
      metalness: 0.64,
      roughness: 0.2,
    });
    this.laserCoreMaterial = new THREE.MeshBasicMaterial({
      color: READABILITY_COLORS.bar,
      toneMapped: false,
    });
    this.mineShellMaterial = new THREE.MeshBasicMaterial({
      color: READABILITY_COLORS.blocker,
      wireframe: true,
      transparent: true,
      opacity: 0.58,
      toneMapped: false,
    });
    this.mechanicalMaterial = new THREE.MeshStandardMaterial({
      color: 0x101820,
      emissive: 0x301600,
      emissiveIntensity: 0.18,
      metalness: 0.9,
      roughness: 0.24,
    });
    this.solarTrimMaterial = new THREE.MeshStandardMaterial({
      color: 0x3a2104,
      emissive: COLORS.solarGold,
      emissiveIntensity: 0.9,
      metalness: 0.72,
      roughness: 0.18,
    });
    this.warningLightMaterial = new THREE.MeshBasicMaterial({
      color: COLORS.solarOrange,
      toneMapped: false,
    });
    this._buildAttractPreview();
  }

  _buildAttractPreview() {
    this.previewGroup = new THREE.Group();
    this.previewGroup.userData.decorative = true;

    const leftBarricade = new THREE.Group();
    leftBarricade.position.z = -15;
    leftBarricade.scale.setScalar(0.92);
    this._addEnergyBarricade(leftBarricade, 0);

    const rightFan = new THREE.Group();
    rightFan.position.z = -21;
    this._addLaserFan(rightFan, 2);

    const centerGate = new THREE.Group();
    centerGate.position.z = -34;
    centerGate.scale.setScalar(0.9);
    this._addSecurityGatePanel(centerGate, 1);

    const rightBarricade = new THREE.Group();
    rightBarricade.position.z = -9.5;
    rightBarricade.scale.setScalar(1.08);
    this._addEnergyBarricade(rightBarricade, 2);

    this.previewGroup.add(leftBarricade, rightFan, centerGate, rightBarricade);
    this.scene.add(this.previewGroup);
  }

  setPreviewVisible(visible) {
    if (this.previewGroup) this.previewGroup.visible = Boolean(visible);
  }

  _loadOptionalObstacleModels() {
    const loader = new GLTFLoader();
    const typesByPath = new Map();
    for (const [type, path] of Object.entries(OBSTACLE_MODEL_PATHS)) {
      const types = typesByPath.get(path) ?? [];
      types.push(type);
      typesByPath.set(path, types);
    }

    for (const [path, types] of typesByPath) {
      fetch(path, { method: 'HEAD' })
        .then((response) => {
          if (!this._isObstacleModelResponse(response)) return;
          loader.load(
            path,
            (gltf) => {
              const model = gltf.scene;
              this._prepareObstacleModel(model);
              for (const type of types) this.modelCache.set(type, model);
            },
            undefined,
            () => {
              // Optional model load failures keep the procedural fallback active.
            },
          );
        })
        .catch(() => {
          // Optional obstacle GLBs are allowed to be absent; geometry fallback remains active.
        });
    }
  }

  _isObstacleModelResponse(response) {
    if (!response.ok) return false;
    const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
    return contentType.includes('model/gltf-binary') || contentType.includes('application/octet-stream');
  }

  _prepareObstacleModel(model) {
    model.traverse((child) => {
      if (!child.isMesh) return;
      child.castShadow = false;
      child.receiveShadow = false;
      if (child.material) {
        const source = Array.isArray(child.material) ? child.material : [child.material];
        child.material = source.length > 1 ? source.map((material) => this._restyleObstacleMaterial(material)) : this._restyleObstacleMaterial(source[0]);
      }
    });
  }

  _restyleObstacleMaterial(source = null) {
    const material = new THREE.MeshStandardMaterial({
      color: source?.color?.getHex?.() ?? 0x1b1026,
      metalness: 0.42,
      roughness: 0.28,
      emissive: READABILITY_COLORS.gateBlock,
      emissiveIntensity: 0.58,
      transparent: source?.transparent ?? false,
      opacity: source?.opacity ?? 1,
    });
    return material;
  }

  _cloneObstacleModel(type, targetWidth = 1.4) {
    const source = this.modelCache.get(type);
    if (!source) return null;
    const clone = source.clone(true);
    clone.traverse((child) => {
      if (child.isMesh) child.userData.sharedObstacleModelResource = true;
    });
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const safeWidth = Math.max(size.x, 0.001);
    clone.position.sub(center);
    clone.scale.setScalar(targetWidth / safeWidth);
    return clone;
  }

  reset() {
    for (const item of this.obstacles) this._removeObstacle(item);
    for (const item of this.solarCores) this._removeSolarCore(item);
    for (const item of this.shieldPickups) this._removeShieldPickup(item);
    this.obstacles = [];
    this.solarCores = [];
    this.shieldPickups = [];
    this.spawnTimer = OPENING_MIN_SAFE_GAP;
    this.patternIndex = 0;
    this.solarCorePatternIndex = 0;
    this.nextSolarCoreTime = SOLAR_CORE_PATTERNS[0].minElapsed;
    this.nextShieldPickupTime = 16;
    this.nextSpawnDelay = null;
    this.currentWave = 'warmup';
    this.openingSpawnedIds.clear();
    this.openingCueIds.clear();
    this.openingComplete = false;
  }

  setPalette(palette) {
    this.palette = palette;
    // Readability rule: hazards keep stable warm colors, while palette changes stay
    // mostly in tunnel/reward layers. This separates "danger" from background glow.
    this.boxMaterial.color.setHex(READABILITY_COLORS.blocker).multiplyScalar(0.18);
    this.boxMaterial.emissive.setHex(READABILITY_COLORS.blocker);
    this.barMaterial.color.setHex(READABILITY_COLORS.bar).multiplyScalar(0.2);
    this.barMaterial.emissive.setHex(READABILITY_COLORS.bar);
    this.gateMaterial.color.setHex(READABILITY_COLORS.gateBlock).multiplyScalar(0.22);
    this.gateMaterial.emissive.setHex(READABILITY_COLORS.gateBlock);
    this.safeFrameMaterial.color.setHex(READABILITY_COLORS.safe).multiplyScalar(0.18);
    this.safeFrameMaterial.emissive.setHex(READABILITY_COLORS.safe);
    this.edgeMaterial.color.setHex(palette.accent ?? COLORS.white);
    this.solarCoreWhiteMaterial.color.setHex(READABILITY_COLORS.reward);
    this.solarCoreGoldMaterial.color.setHex(COLORS.solarGold);
    this.solarCoreCyanMaterial.color.setHex(COLORS.cyan);
    this.openingPanelMaterial.color.setHex(0x120b04);
    this.openingPanelMaterial.emissive.setHex(0x2a1202);
    this.openingFrameMaterial.color.setHex(READABILITY_COLORS.blocker).multiplyScalar(0.18);
    this.openingFrameMaterial.emissive.setHex(READABILITY_COLORS.blocker);
    this.laserCoreMaterial.color.setHex(READABILITY_COLORS.bar);
    this.mineShellMaterial.color.setHex(READABILITY_COLORS.blocker);
    this.mechanicalMaterial.emissive.setHex(0x301600);
    this.solarTrimMaterial.color.setHex(READABILITY_COLORS.blocker).multiplyScalar(0.24);
    this.solarTrimMaterial.emissive.setHex(READABILITY_COLORS.blocker);
  }

  update(delta, speed, elapsed, callbacks) {
    const wave = this._waveForElapsed(elapsed);
    if (wave.name !== this.currentWave) {
      this.currentWave = wave.name;
      callbacks.onWaveChange?.(wave);
    }
    this._updateOpeningSequence(elapsed, callbacks);
    if (elapsed >= OPENING_SEQUENCE_DURATION) {
      if (!this.openingComplete) {
        this.openingComplete = true;
        this.spawnTimer = OPENING_MIN_SAFE_GAP;
      }
      const interval = this._spawnInterval(elapsed);
      this.spawnTimer -= delta;
      if (this.spawnTimer <= 0) {
        const spawnZ = this._normalSpawnZ(elapsed);
        const spawnedSolarCorePattern = this._maybeSpawnSolarCorePattern(elapsed, spawnZ, callbacks);
        if (!spawnedSolarCorePattern) this.spawnPattern(elapsed, spawnZ);
        callbacks.onPattern?.(this.lastSafeLane);
        this.spawnTimer = this.nextSpawnDelay ?? interval;
        this.nextSpawnDelay = null;
      }
    }

    for (let i = this.obstacles.length - 1; i >= 0; i -= 1) {
      const obstacle = this.obstacles[i];
      const previousZ = obstacle.group.position.z;
      // Obstacles approach the camera by z-axis translation; bars add rotation transform.
      obstacle.group.position.z += speed * delta;
      if (obstacle.rods) {
        for (const rod of obstacle.rods) rod.rotation.z += obstacle.spinSpeed * delta;
      } else {
        obstacle.group.rotation[obstacle.spinAxis] += obstacle.spinSpeed * delta;
      }
      if (obstacle.debugHelper) obstacle.debugHelper.position.z = obstacle.group.position.z;

      if (!obstacle.hit && this._hitsPlayer(obstacle, callbacks, previousZ)) {
        obstacle.hit = true;
        if (obstacle.userData) obstacle.userData.hit = true;
        if (callbacks.surgeActive) {
          if (obstacle.userData) obstacle.userData.destroyed = true;
          obstacle.group.userData.destroyed = true;
          const impactPosition = obstacle.group.position.clone();
          impactPosition.x = callbacks.playerX;
          impactPosition.y = GAME.playerY + 0.35;
          callbacks.onSurgeBreak?.(impactPosition, obstacle);
          this._removeObstacle(obstacle);
          this.obstacles.splice(i, 1);
          continue;
        }
        this._debugOpeningOutcome('hit', obstacle, elapsed);
        callbacks.onHit(obstacle.group.position, obstacle);
      }

      if (!obstacle.hit && !obstacle.nearMissed && this._isNearMiss(obstacle, callbacks, elapsed, speed)) {
        obstacle.nearMissed = true;
        if (obstacle.userData) obstacle.userData.nearMissCounted = true;
        callbacks.onNearMiss?.(obstacle.group.position);
      }

      if (!obstacle.hit && !obstacle.passed && obstacle.group.position.z > GAME.playerZ + 1.5) {
        obstacle.passed = true;
        if (obstacle.userData) obstacle.userData.counted = true;
        this._debugOpeningOutcome('pass', obstacle, elapsed);
        callbacks.onPassed(obstacle);
      }

      if (obstacle.group.position.z > GAME.removeZ) {
        this._removeObstacle(obstacle);
        this.obstacles.splice(i, 1);
      }
    }

    this._updateSolarCores(delta, speed, callbacks);
    this._updateShieldPickups(delta, speed, elapsed, callbacks);
  }

  _updateOpeningSequence(elapsed, callbacks) {
    const openingTime = Math.min(elapsed, OPENING_SEQUENCE_DURATION);
    for (const pattern of OPENING_PATTERNS) {
      if (!this.openingSpawnedIds.has(pattern.id) && openingTime >= pattern.triggerTime) {
        const spawnZ = this._openingSpawnZ(pattern);
        const obstacle = this._createOpeningGate(pattern, spawnZ, elapsed);
        this.openingSpawnedIds.add(pattern.id);
        if (pattern.openLane != null) callbacks.onPattern?.(pattern.openLane);
        if (DEBUG_OPENING) {
          console.debug('[Opening] spawn', {
            id: pattern.id,
            type: pattern.type,
            spawnTime: Number(elapsed.toFixed(2)),
            expectedArrivalTime: pattern.targetArrivalTime,
            spawnZ: Number(spawnZ.toFixed(2)),
            blockedLanes: obstacle.blockedLanes,
          });
        }
      }

      if (!this.openingCueIds.has(pattern.id) && openingTime >= pattern.cueTime) {
        this.openingCueIds.add(pattern.id);
        callbacks.onOpeningCue?.(pattern);
      }
    }
  }

  _openingSpawnZ(pattern) {
    return GAME.playerZ - this._baseTravelDistance(pattern.triggerTime, pattern.targetArrivalTime);
  }

  _baseTravelDistance(fromTime, toTime) {
    const rampRate = 0.55;
    const rampEnd = (GAME.maxSpeed - GAME.startSpeed) / rampRate;
    const integratedDistance = (time) => {
      const rampTime = Math.min(Math.max(time, 0), rampEnd);
      const rampDistance = GAME.startSpeed * rampTime + rampRate * rampTime * rampTime * 0.5;
      return rampDistance + Math.max(time - rampEnd, 0) * GAME.maxSpeed;
    };
    return integratedDistance(toTime) - integratedDistance(fromTime);
  }

  _normalSpawnZ(elapsed) {
    const transitionProgress = THREE.MathUtils.clamp(
      (elapsed - OPENING_SEQUENCE_DURATION) / OPENING_TRANSITION_DURATION,
      0,
      1,
    );
    return THREE.MathUtils.lerp(OPENING_TRANSITION_SPAWN_Z, GAME.spawnZ, transitionProgress);
  }

  _debugOpeningOutcome(outcome, obstacle, elapsed) {
    if (!DEBUG_OPENING || !obstacle.openingPattern) return;
    console.debug(`[Opening] ${outcome}`, {
      id: obstacle.openingPattern.id,
      spawnTime: Number(obstacle.openingSpawnTime.toFixed(2)),
      expectedArrivalTime: obstacle.openingPattern.targetArrivalTime,
      [`actual${outcome === 'pass' ? 'Pass' : 'Hit'}Time`]: Number(elapsed.toFixed(2)),
    });
  }


  spawnPattern(elapsed, spawnZ = GAME.spawnZ) {
    const safeLane = this._pickSafeLaneForPattern(elapsed);
    const patternType = this._patternType(elapsed);
    this.lastSafeLane = safeLane;

    if (patternType === 'single') {
      const blockedLane = this._singleBlockedLane(safeLane);
      this._createBox(blockedLane, spawnZ - 3.5);
      this.nextSpawnDelay = Math.max(0.82, this._spawnInterval(elapsed) * 0.84);
    } else if (patternType === 'bar') {
      this._createBar(this._blockedExcept(safeLane), spawnZ - 7, elapsed);
    } else if (patternType === 'gate') {
      this._createGate(safeLane, spawnZ - 5);
    } else if (patternType === 'narrow') {
      this._createGate(safeLane, spawnZ - 4);
      this._createBar(this._blockedExcept(safeLane), spawnZ - 13, elapsed);
      this.nextSpawnDelay = Math.max(0.92, this._spawnInterval(elapsed) * 1.18);
    } else {
      const blocked = this._blockedExcept(safeLane);
      for (const lane of blocked) this._createBox(lane, spawnZ - Math.random() * 4);
    }

    this.patternIndex += 1;
  }

  _updateSolarCores(delta, speed, callbacks) {
    for (let i = this.solarCores.length - 1; i >= 0; i -= 1) {
      const core = this.solarCores[i];
      core.group.position.z += speed * delta;
      core.group.rotation.z += core.spinSpeed * delta;
      core.orbit.rotation.x += core.spinSpeed * 0.45 * delta;
      core.orbit.rotation.y += core.spinSpeed * 0.72 * delta;
      const pulse = 1 + Math.sin(performance.now() * 0.012 + core.phase) * 0.09;
      core.glow.scale.setScalar(pulse);
      core.materials[1].opacity = 0.46 + (pulse - 1) * 1.4;

      const closeZ = Math.abs(core.group.position.z - GAME.playerZ) < SOLAR_CORE.collectZRange;
      const sameLane = callbacks.playerLane === core.lane;
      const closeX = Math.abs(callbacks.playerX - LANE_X[core.lane]) < SOLAR_CORE.collectXRange;
      if (!core.collected && sameLane && closeZ && closeX) {
        core.collected = true;
        core.group.userData.collected = true;
        callbacks.onSolarCore?.(core.group.position.clone(), core);
        this._removeSolarCore(core);
        this.solarCores.splice(i, 1);
        continue;
      }

      if (core.group.position.z > GAME.removeZ) {
        this._removeSolarCore(core);
        this.solarCores.splice(i, 1);
      }
    }
  }

  _updateShieldPickups(delta, speed, elapsed, callbacks) {
    for (let i = this.shieldPickups.length - 1; i >= 0; i -= 1) {
      const pickup = this.shieldPickups[i];
      pickup.group.position.z += speed * delta;
      pickup.group.rotation.y += pickup.spinSpeed * delta;
      pickup.ring.rotation.z += pickup.spinSpeed * 0.5 * delta;
      pickup.halo.rotation.y += pickup.spinSpeed * 0.25 * delta;
      const pulse = 1 + Math.sin(performance.now() * 0.014 + pickup.phase) * 0.08;
      pickup.glow.scale.setScalar(pulse);
      pickup.core.scale.setScalar(0.92 + pulse * 0.1);
      pickup.materials[0].opacity = 0.76 + (pulse - 1) * 0.5;
      pickup.materials[1].opacity = 0.5 + (pulse - 1) * 0.7;
      pickup.materials[2].opacity = 0.9;

      const closeZ = Math.abs(pickup.group.position.z - GAME.playerZ) < SHIELD_PICKUP.collectZRange;
      const sameLane = callbacks.playerLane === pickup.lane;
      const closeX = Math.abs(callbacks.playerX - LANE_X[pickup.lane]) < SHIELD_PICKUP.collectXRange;
      if (!pickup.collected && sameLane && closeZ && closeX) {
        pickup.collected = true;
        pickup.group.userData.collected = true;
        callbacks.onShieldPickup?.(pickup.group.position.clone(), pickup);
        this._removeShieldPickup(pickup);
        this.shieldPickups.splice(i, 1);
        continue;
      }

      if (pickup.group.position.z > GAME.removeZ) {
        this._removeShieldPickup(pickup);
        this.shieldPickups.splice(i, 1);
      }
    }

    if (
      elapsed < this.nextShieldPickupTime ||
      this.shieldPickups.length >= SHIELD_PICKUP.maxActive
    ) {
      return;
    }

    if (this._maybeSpawnShieldPickup(elapsed, callbacks)) {
      this.nextShieldPickupTime = elapsed + 11 + Math.random() * 7;
    } else {
      this.nextShieldPickupTime = elapsed + 1.2;
    }
  }


  _maybeSpawnSolarCorePattern(elapsed, spawnZ, callbacks) {
    if (elapsed < this.nextSolarCoreTime || this.solarCores.length >= SOLAR_CORE.maxActive) return false;

    const pattern = SOLAR_CORE_PATTERNS[this.solarCorePatternIndex];
    if (!pattern || elapsed < pattern.minElapsed) return false;

    if (!this._spawnSolarCorePattern(pattern, spawnZ, callbacks)) {
      this.nextSolarCoreTime = elapsed + 0.95;
      return false;
    }

    this.solarCorePatternIndex = this.solarCorePatternIndex >= SOLAR_CORE_PATTERNS.length - 1
      ? 1
      : this.solarCorePatternIndex + 1;

    this.nextSolarCoreTime = elapsed + pattern.cooldown + Math.random() * 0.75;
    this.nextSpawnDelay = Math.max(0.95, this._spawnInterval(elapsed) * 1.12);
    this.patternIndex += 1;

    callbacks.onSolarCoreCue?.(pattern);
    return true;
  }

  _spawnSolarCorePattern(pattern, spawnZ, callbacks) {
    const playerLane = callbacks.playerLane ?? 1;
    const adjacent = this._adjacentLanes(playerLane);
    const coreZ = spawnZ + pattern.coreZOffset;
    const clearAdjacent = adjacent.filter((lane) => this._canPlaceSolarCore(lane, coreZ));
    const coreLane = clearAdjacent[Math.floor(Math.random() * clearAdjacent.length)];
    if (coreLane == null) return false;

    if (pattern.type === 'safeCore') {
      const blockerLane = [0, 1, 2].find((lane) => lane !== playerLane && lane !== coreLane);
      if (blockerLane == null) return false;
      this._createBox(blockerLane, spawnZ + pattern.obstacleZOffset);
    } else if (pattern.type === 'riskCore') {
      // The hazard reaches the player first. Waiting for it to pass before entering
      // the core lane is optional; staying in another lane remains fully safe.
      this._createBox(coreLane, spawnZ + pattern.obstacleZOffset);
    } else if (pattern.type === 'lateDodgeCore') {
      // The current lane becomes dangerous while the adjacent core marks the dodge lane.
      // Moving late can trigger the existing Near Miss check without changing its rules.
      this._createBox(playerLane, spawnZ + pattern.obstacleZOffset);
    } else {
      return false;
    }

    this._createSolarCore(coreLane, coreZ, pattern);
    this.lastSafeLane = pattern.type === 'riskCore' ? playerLane : coreLane;
    return true;
  }

  _maybeSpawnShieldPickup(elapsed, callbacks) {
    const spawnZ = this._normalSpawnZ(elapsed);
    const lanes = [0, 1, 2].filter((lane) => this._canPlaceShieldPickup(lane, spawnZ));
    if (!lanes.length) return false;

    const preferredLane = callbacks.playerLane ?? 1;
    const lane = lanes.includes(preferredLane)
      ? preferredLane
      : lanes[Math.floor(Math.random() * lanes.length)];

    this._createShieldPickup(lane, spawnZ - 4.5);
    return true;
  }

  _canPlaceShieldPickup(lane, z) {
    const obstacleConflict = this.obstacles.some(
      (obstacle) => obstacle.blockedLanes.includes(lane) && Math.abs(obstacle.group.position.z - z) < SHIELD_PICKUP.minObstacleGap,
    );
    if (obstacleConflict) return false;

    const coreConflict = this.solarCores.some(
      (core) => core.lane === lane && Math.abs(core.group.position.z - z) < SHIELD_PICKUP.minObstacleGap * 1.2,
    );
    if (coreConflict) return false;

    return this.shieldPickups.every(
      (pickup) => pickup.lane !== lane || Math.abs(pickup.group.position.z - z) >= SHIELD_PICKUP.minObstacleGap * 1.5,
    );
  }

  _createShieldPickup(lane, z) {
    const group = new THREE.Group();
    const whiteMaterial = this.solarCoreWhiteMaterial.clone();
    const cyanMaterial = this.solarCoreCyanMaterial.clone();
    const goldMaterial = this.solarCoreGoldMaterial.clone();

    for (const material of [whiteMaterial, cyanMaterial, goldMaterial]) {
      material.transparent = true;
      material.depthWrite = false;
      material.blending = THREE.AdditiveBlending;
      material.toneMapped = false;
    }

    const position = getLanePosition(lane, z);
    group.position.set(position.x, position.y + 0.62, position.z);
    group.rotation.z = getLaneAngle(lane);
    group.scale.setScalar(1.4);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 8, 36), cyanMaterial);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.4, 18, 12), goldMaterial);
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), whiteMaterial);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.022, 8, 40), cyanMaterial);
    halo.rotation.x = Math.PI / 2;

    group.add(glow, ring, halo, core);
    group.renderOrder = 2;
    glow.renderOrder = 2;
    ring.renderOrder = 2;
    halo.renderOrder = 2;
    core.renderOrder = 3;

    group.userData = {
      type: 'shieldPickup',
      kind: 'shieldPickup',
      laneIndex: lane,
      collected: false,
      blockedLanes: [],
      counted: false,
      hit: false,
    };

    this.scene.add(group);
    this.shieldPickups.push({
      type: 'shieldPickup',
      group,
      lane,
      ring,
      glow,
      core,
      halo,
      materials: [whiteMaterial, cyanMaterial, goldMaterial],
      spinSpeed: 1.8 + Math.random() * 0.7,
      phase: Math.random() * Math.PI * 2,
      collected: false,
    });
  }

  _removeShieldPickup(pickup) {
    this.scene.remove(pickup.group);
    this._disposeGroupResources(pickup.group);
  }

  _adjacentLanes(lane) {
    return [lane - 1, lane + 1].filter((candidate) => candidate >= 0 && candidate < LANE_COUNT);
  }

  _canPlaceSolarCore(lane, z) {
    const obstacleConflict = this.obstacles.some(
      (obstacle) => obstacle.blockedLanes.includes(lane) && Math.abs(obstacle.group.position.z - z) < SOLAR_CORE.minObstacleGap,
    );
    if (obstacleConflict) return false;
    return this.solarCores.every(
      (core) => core.lane !== lane || Math.abs(core.group.position.z - z) >= SOLAR_CORE.minObstacleGap * 1.5,
    );
  }

  _pickSafeLaneForPattern(elapsed) {
    if (elapsed < 8) return THREE.MathUtils.randInt(0, LANE_COUNT - 1);
    return (this.patternIndex + THREE.MathUtils.randInt(1, 2)) % LANE_COUNT;
  }

  _blockedExcept(safeLane) {
    return [0, 1, 2].filter((lane) => lane !== safeLane);
  }

  _singleBlockedLane(safeLane) {
    const lanes = this._blockedExcept(safeLane);
    return lanes[Math.floor(Math.random() * lanes.length)];
  }


  _patternType(elapsed) {
    const roll = Math.random();
    const wave = this._waveForElapsed(elapsed);
    const bias = this.palette?.bias;

    if (elapsed < 10) return 'cube';

    const pressureBoost = wave.name === 'pressure' ? 0.1 : 0;
    const riskBoost = wave.name === 'risk' ? 0.08 : 0;
    const riftBoost = wave.name === 'rift' ? 0.08 : 0;
    const cooldownEase = wave.name === 'cooldown' ? -0.1 : 0;

    const barBoost = (bias === 'bar' ? 0.08 : 0) + pressureBoost + cooldownEase;
    const gateBoost = (bias === 'gate' ? 0.08 : 0) + pressureBoost * 0.55;
    const narrowBoost = (bias === 'fast' ? 0.08 : 0) + riskBoost + riftBoost;

    if (elapsed < 16) {
      if (roll < 0.34) return 'single';
      return 'cube';
    }

    if (elapsed < 28) {
      if (roll < 0.22) return 'single';
      if (roll < 0.42 + barBoost) return 'bar';
      if (roll < 0.56 + gateBoost) return 'gate';
      return 'cube';
    }

    if (elapsed < 48) {
      if (roll < 0.28 + barBoost) return 'bar';
      if (roll < 0.48 + gateBoost) return 'gate';
      if (roll < 0.64 + narrowBoost) return 'narrow';
      return 'cube';
    }

    if (roll < 0.32 + barBoost) return 'bar';
    if (roll < 0.56 + narrowBoost) return 'narrow';
    if (roll < 0.74 + gateBoost) return 'gate';
    return 'cube';
  }


  _spawnInterval(elapsed) {
    if (elapsed < 10) return 1.45;
    if (elapsed < 22) return THREE.MathUtils.lerp(1.34, 1.08, (elapsed - 10) / 12);

    const paletteBias = this.palette?.bias === 'fast' ? 0.06 : 0;
    const wave = this._waveForElapsed(elapsed);
    const waveBias =
      wave.name === 'pressure'
        ? 0.08
        : wave.name === 'risk'
          ? 0.05
          : wave.name === 'rift'
            ? 0.04
            : wave.name === 'cooldown'
              ? -0.14
              : 0;

    if (elapsed < 48) {
      return THREE.MathUtils.clamp(1.08 - (elapsed - 22) * 0.011 - paletteBias - waveBias, 0.78, 1.14);
    }

    return THREE.MathUtils.clamp(0.9 - (elapsed - 48) * 0.004 - paletteBias - waveBias, 0.68, 0.98);
  }


  _waveForElapsed(elapsed) {
    if (elapsed < 10) {
      return { name: 'warmup', index: 0, progress: elapsed / 10, intensity: 0.08 };
    }

    const cycleTime = elapsed - 10;
    const index = Math.floor(cycleTime / WAVE_DURATION) % WAVE_SEQUENCE.length;
    const name = WAVE_SEQUENCE[index];
    const progress = (cycleTime % WAVE_DURATION) / WAVE_DURATION;

    const intensity =
      name === 'pressure'
        ? 0.46
        : name === 'risk'
          ? 0.42
          : name === 'rift'
            ? 0.38
            : name === 'cooldown'
              ? 0.05
              : 0.14;

    return { name, index, progress, intensity };
  }

  _hitsPlayer(obstacle, callbacks, previousZ = obstacle.group.position.z) {
    // Use the rendered x position so collision timing matches the visible lane transition.
    const overlapsBlockedLane = obstacle.blockedLanes.some(
      (lane) => Math.abs(callbacks.playerX - LANE_X[lane]) < PLAYER_HIT_X_RANGE,
    );
    const currentZ = obstacle.group.position.z;
    const hitWindowMin = GAME.playerZ - PLAYER_HIT_Z_RANGE;
    const hitWindowMax = GAME.playerZ + PLAYER_HIT_Z_RANGE;
    const zMin = Math.min(previousZ, currentZ);
    const zMax = Math.max(previousZ, currentZ);
    const closeZ = zMax >= hitWindowMin && zMin <= hitWindowMax;
    return overlapsBlockedLane && closeZ;
  }

  _isNearMiss(obstacle, callbacks, elapsed, speed) {
    const laneChange = callbacks.laneChange;
    if (!laneChange || callbacks.playerLane == null) return false;

    const zDistance = Math.abs(obstacle.group.position.z - GAME.playerZ);
    if (zDistance > NEAR_MISS_Z_WINDOW) return false;

    const timeSinceLaneChange = elapsed - laneChange.at;
    if (timeSinceLaneChange < 0 || timeSinceLaneChange > NEAR_MISS_TIME_WINDOW) return false;
    if (laneChange.to !== callbacks.playerLane) return false;
    if (!obstacle.blockedLanes.includes(laneChange.from)) return false;
    if (obstacle.blockedLanes.includes(callbacks.playerLane)) return false;

    const obstacleZAtLaneChange = obstacle.group.position.z - speed * timeSinceLaneChange;
    if (Math.abs(obstacleZAtLaneChange - GAME.playerZ) > NEAR_MISS_DANGER_DISTANCE) return false;

    return obstacle.blockedLanes.every(
      (lane) => Math.abs(callbacks.playerX - LANE_X[lane]) >= PLAYER_HIT_X_RANGE,
    );
  }

  _createOpeningGate(pattern, z, spawnTime) {
    const blockedLanes = pattern.blockedLanes ?? this._blockedExcept(pattern.openLane);
    const visualType = pattern.type === 'securityGate' || pattern.type === 'hyperChargeGate'
      ? 'securityGate'
      : 'energyBarricade';
    const group = new THREE.Group();
    group.position.z = z;

    for (const lane of blockedLanes) {
      if (visualType === 'securityGate') this._addSecurityGatePanel(group, lane);
      else this._addEnergyBarricade(group, lane);
    }

    group.userData = {
      type: visualType,
      blockedLanes,
      counted: false,
      hit: false,
      nearMissCounted: false,
      openingPatternId: pattern.id,
    };
    this.scene.add(group);
    const obstacle = {
      type: visualType,
      group,
      blockedLanes,
      spinAxis: 'z',
      spinSpeed: 0,
      hit: false,
      passed: false,
      nearMissed: false,
      userData: group.userData,
      openingPattern: pattern,
      openingSpawnTime: spawnTime,
    };
    this.obstacles.push(obstacle);
    return obstacle;
  }


  _createBox(lane, z) {
    const group = new THREE.Group();
    const position = getLanePosition(lane, z);

    // Floating barricade: keep collision lane-based, but lift the visual so it does not look buried.
    group.position.set(position.x, position.y + 0.92, position.z);
    group.rotation.set(0, 0, getLaneAngle(lane));

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.92, 0.48), this.mechanicalMaterial);
    body.position.z = -0.05;

    const face = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.72, 0.16), this.openingPanelMaterial);
    face.position.z = 0.22;

    const top = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.09, 0.28), this.solarTrimMaterial);
    const bottom = top.clone();
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.9, 0.28), this.solarTrimMaterial);
    const right = left.clone();

    top.position.set(0, 0.49, 0.28);
    bottom.position.set(0, -0.49, 0.28);
    left.position.set(-0.66, 0, 0.28);
    right.position.set(0.66, 0, 0.28);

    const braceA = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.07, 0.18), this.barMaterial);
    const braceB = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.07, 0.18), this.barMaterial);
    braceA.position.z = 0.39;
    braceB.position.z = 0.4;
    braceA.rotation.z = 0.58;
    braceB.rotation.z = -0.58;

    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), this.warningLightMaterial);
    core.position.z = 0.52;

    const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.54, 0.62), this.mechanicalMaterial);
    const sideR = sideL.clone();
    sideL.position.set(-0.77, 0, -0.02);
    sideR.position.set(0.77, 0, -0.02);

    const padL = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.06, 0.18), this.safeFrameMaterial);
    const padR = padL.clone();
    padL.position.set(-0.38, -0.58, 0.05);
    padR.position.set(0.38, -0.58, 0.05);

    group.add(
      body,
      face,
      top,
      bottom,
      left,
      right,
      braceA,
      braceB,
      core,
      sideL,
      sideR,
      padL,
      padR,
    );

    group.userData = {
      type: 'solarBarricade',
      blockedLanes: [lane],
      counted: false,
      hit: false,
      nearMissCounted: false,
    };

    this.scene.add(group);

    this.obstacles.push({
      type: 'solarBarricade',
      group,
      blockedLanes: [lane],
      spinAxis: 'y',
      spinSpeed: 0.18,
      hit: false,
      passed: false,
      nearMissed: false,
      userData: group.userData,
    });
  }

  _createBar(blockedLanes, z, elapsed = 0) {
    const group = new THREE.Group();
    group.position.z = z;
    const rods = [];

    for (const lane of blockedLanes) {
      const fan = this._addLaserFan(group, lane);
      rods.push(fan);
    }

    group.userData = { type: 'laserFan', blockedLanes, counted: false, hit: false, nearMissCounted: false };
    this.scene.add(group);
    this.obstacles.push({
      type: 'laserFan',
      group,
      blockedLanes,
      rods,
      spinSpeed: 1.6 + Math.random() * 0.6 + Math.min(elapsed * 0.018, 0.9),
      hit: false,
      passed: false,
      nearMissed: false,
      userData: group.userData,
      debugHelper: this._createBarDebugHelper(blockedLanes, z),
    });
  }


  _addLaserFan(group, lane) {
    const position = getLanePosition(lane, 0);
    const fan = new THREE.Group();

    // Hovering cutter: raised and simplified so it does not look like a toy fan on the floor.
    fan.position.set(position.x, position.y + 0.98, 0);
    fan.rotation.z = getLaneAngle(lane);

    const mount = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.42, 0.38), this.mechanicalMaterial);
    mount.position.set(0, -0.34, -0.04);

    const mountStripe = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.045, 0.4), this.solarTrimMaterial);
    mountStripe.position.set(0, -0.22, 0.1);

    const hubShell = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.24, 20), this.mechanicalMaterial);
    hubShell.rotation.x = Math.PI / 2;

    const hubCore = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.3, 20), this.laserCoreMaterial);
    hubCore.rotation.x = Math.PI / 2;
    hubCore.position.z = 0.04;

    const hubRing = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.045, 8, 28), this.solarTrimMaterial);
    hubRing.position.z = 0.08;

    const warningCap = new THREE.Mesh(new THREE.SphereGeometry(0.095, 14, 10), this.warningLightMaterial);
    warningCap.position.set(0, -0.34, 0.24);

    fan.add(mount, mountStripe, hubShell, hubCore, hubRing, warningCap);

    // Two-blade cutter: clearer and less toy-like than the old 3-arm fan.
    for (let i = 0; i < 2; i += 1) {
      const arm = new THREE.Group();
      arm.rotation.z = i * Math.PI;

      const casing = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.12, 0.24), this.mechanicalMaterial);
      casing.position.x = 0.62;

      const laser = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.035, 0.28), this.laserCoreMaterial);
      laser.position.x = 0.64;
      laser.position.z = 0.08;

      const rail = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.055, 0.3), this.solarTrimMaterial);
      rail.position.x = 0.64;
      rail.position.z = 0.02;

      const tipHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.24, 14), this.mechanicalMaterial);
      tipHousing.rotation.x = Math.PI / 2;
      tipHousing.position.x = 1.22;

      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 10), this.openingFrameMaterial);
      tip.position.x = 1.22;
      tip.position.z = 0.1;

      arm.add(casing, rail, laser, tipHousing, tip);
      fan.add(arm);
    }

    const sensor = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.24), this.warningLightMaterial);
    sensor.position.set(0, 0.38, 0.1);
    fan.add(sensor);

    group.add(fan);
    return fan;
  }

  _createGate(safeLane, z) {
    const group = new THREE.Group();
    group.position.z = z;
    const blockedLanes = this._blockedExcept(safeLane);

    for (const lane of blockedLanes) {
      this._addSecurityGatePanel(group, lane);
    }

    group.userData = { type: 'securityGate', blockedLanes, counted: false, hit: false, nearMissCounted: false };
    this.scene.add(group);
    this.obstacles.push({
      type: 'securityGate',
      group,
      blockedLanes,
      spinAxis: 'z',
      spinSpeed: 0.04,
      hit: false,
      passed: false,
      nearMissed: false,
      userData: group.userData,
    });
  }


  _addEnergyBarricade(group, lane) {
    const position = getLanePosition(lane, 0);
    const assembly = new THREE.Group();

    // Lifted from the floor: reads as a hovering barricade, not a buried wall.
    assembly.position.set(position.x, position.y + 0.96, 0);
    assembly.rotation.z = getLaneAngle(lane);

    const housing = new THREE.Mesh(new THREE.BoxGeometry(1.58, 1.18, 0.52), this.mechanicalMaterial);
    housing.position.z = -0.08;

    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.88, 0.18), this.openingPanelMaterial);
    panel.position.z = 0.22;

    const inset = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.58, 0.08), this.mechanicalMaterial);
    inset.position.z = 0.35;

    const top = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.1, 0.34), this.openingFrameMaterial);
    const bottom = top.clone();
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.14, 0.34), this.openingFrameMaterial);
    const right = left.clone();

    top.position.set(0, 0.58, 0.08);
    bottom.position.set(0, -0.58, 0.08);
    left.position.set(-0.72, 0, 0.08);
    right.position.set(0.72, 0, 0.08);

    const braceA = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.075, 0.28), this.barMaterial);
    const braceB = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.075, 0.28), this.barMaterial);
    braceA.rotation.z = 0.58;
    braceB.rotation.z = -0.58;
    braceA.position.z = 0.36;
    braceB.position.z = 0.37;

    const warningCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), this.warningLightMaterial);
    warningCore.position.z = 0.52;

    const header = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.16, 0.48), this.mechanicalMaterial);
    header.position.set(0, 0.74, -0.01);

    const headerLight = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.5), this.warningLightMaterial);
    headerLight.position.set(0, 0.75, 0.11);

    const footL = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 0.22), this.safeFrameMaterial);
    const footR = footL.clone();
    footL.position.set(-0.42, -0.72, 0.06);
    footR.position.set(0.42, -0.72, 0.06);

    assembly.add(
      housing,
      panel,
      inset,
      top,
      bottom,
      left,
      right,
      braceA,
      braceB,
      warningCore,
      header,
      headerLight,
      footL,
      footR,
    );

    const cornerGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.42);
    for (const [x, y] of [
      [-0.68, -0.52],
      [-0.68, 0.52],
      [0.68, -0.52],
      [0.68, 0.52],
    ]) {
      const corner = new THREE.Mesh(cornerGeometry, this.mechanicalMaterial);
      corner.position.set(x, y, 0.05);
      corner.rotation.z = Math.PI / 4;
      assembly.add(corner);
    }

    group.add(assembly);
  }


  _addSecurityGatePanel(group, lane) {
    const position = getLanePosition(lane, 0);
    const assembly = new THREE.Group();

    // Raised gate panel: reads as an aerial blocking device.
    assembly.position.set(position.x, position.y + 1.02, 0);
    assembly.rotation.z = getLaneAngle(lane);

    const housing = new THREE.Mesh(new THREE.BoxGeometry(1.58, 1.42, 0.5), this.mechanicalMaterial);
    housing.position.z = -0.1;

    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.18, 1.04, 0.16), this.openingPanelMaterial);
    panel.position.z = 0.18;

    const innerFrame = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.78, 0.08), this.mechanicalMaterial);
    innerFrame.position.z = 0.31;

    const top = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.16, 0.36), this.gateMaterial);
    const bottom = top.clone();
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.42, 0.36), this.gateMaterial);
    const right = left.clone();

    top.position.set(0, 0.7, 0.06);
    bottom.position.set(0, -0.7, 0.06);
    left.position.set(-0.74, 0, 0.06);
    right.position.set(0.74, 0, 0.06);

    const controlHead = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.2, 0.46), this.mechanicalMaterial);
    controlHead.position.set(0, 0.88, -0.02);

    const controlLight = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.055, 0.48), this.warningLightMaterial);
    controlLight.position.set(0, 0.89, 0.1);

    assembly.add(housing, panel, innerFrame, top, bottom, left, right, controlHead, controlLight);

    for (const y of [-0.33, 0, 0.33]) {
      const shutter = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.07, 0.28), this.barMaterial);
      shutter.position.set(0, y, 0.22);
      assembly.add(shutter);
    }

    for (const x of [-0.46, 0.46]) {
      const piston = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.0, 10), this.solarTrimMaterial);
      piston.position.set(x, 0, 0.26);
      assembly.add(piston);
    }

    const lock = new THREE.Mesh(new THREE.OctahedronGeometry(0.15, 0), this.openingFrameMaterial);
    lock.position.z = 0.38;
    assembly.add(lock);

    const hoverPad = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.055, 0.18), this.safeFrameMaterial);
    hoverPad.position.set(0, -0.86, 0.05);
    assembly.add(hoverPad);

    group.add(assembly);
  }

  _createSolarCore(lane, z, pattern) {
    const group = new THREE.Group();
    const whiteMaterial = this.solarCoreWhiteMaterial.clone();
    const goldMaterial = this.solarCoreGoldMaterial.clone();
    const cyanMaterial = this.solarCoreCyanMaterial.clone();
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 18, 12), whiteMaterial);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.36, 18, 12), goldMaterial);
    const goldRing = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.026, 8, 32), goldMaterial);
    const orbit = new THREE.Group();
    const cyanOrbit = new THREE.Mesh(new THREE.TorusGeometry(0.53, 0.018, 8, 36), cyanMaterial);
    const cyanCrossOrbit = cyanOrbit.clone();
    cyanOrbit.rotation.x = Math.PI / 2.8;
    cyanCrossOrbit.rotation.y = Math.PI / 2.5;
    orbit.add(cyanOrbit, cyanCrossOrbit);
    group.add(glow, goldRing, orbit, orb);
    const position = getLanePosition(lane, z);
    group.position.set(position.x, position.y + 0.32, position.z);
    group.rotation.z = getLaneAngle(lane);
    group.userData = {
      type: 'solarCore',
      kind: 'solarCore',
      laneIndex: lane,
      riskLevel: pattern.riskLevel,
      collected: false,
      blockedLanes: [],
      counted: false,
      hit: false,
      nearMissCounted: true,
    };
    this.scene.add(group);
    this.solarCores.push({
      type: 'solarCore',
      patternId: pattern.id,
      riskLevel: pattern.riskLevel,
      chargeGain: pattern.chargeGain ?? SOLAR_CORE.chargeGain,
      scoreGain: pattern.scoreGain ?? SOLAR_CORE.scoreGain,
      comboGain: pattern.comboGain ?? SOLAR_CORE.comboGain,
      group,
      lane,
      materials: [whiteMaterial, goldMaterial, cyanMaterial],
      glow,
      orbit,
      spinSpeed: 1.8 + Math.random() * 0.7,
      phase: Math.random() * Math.PI * 2,
      collected: false,
    });
  }

  _removeSolarCore(core) {
    this.scene.remove(core.group);
    this._disposeGroupResources(core.group);
  }

  _removeObstacle(obstacle) {
    this.scene.remove(obstacle.group);
    this._disposeGroupResources(obstacle.group);
    if (obstacle.debugHelper) {
      this.scene.remove(obstacle.debugHelper);
      this._disposeGroupResources(obstacle.debugHelper);
    }
  }

  _disposeGroupResources(group) {
    const disposedGeometries = new Set();
    const disposedMaterials = new Set();
    group.traverse((child) => {
      if (child.userData.sharedObstacleModelResource) return;
      if (child.geometry && !disposedGeometries.has(child.geometry)) {
        child.geometry.dispose();
        disposedGeometries.add(child.geometry);
      }
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) {
        if (!material || this._isSharedMaterial(material) || disposedMaterials.has(material)) continue;
        material.dispose();
        disposedMaterials.add(material);
      }
    });
  }

  _isSharedMaterial(material) {
    return [
      this.boxMaterial,
      this.barMaterial,
      this.edgeMaterial,
      this.gateMaterial,
      this.safeFrameMaterial,
      this.solarCoreWhiteMaterial,
      this.solarCoreGoldMaterial,
      this.solarCoreCyanMaterial,
      this.openingPanelMaterial,
      this.openingFrameMaterial,
      this.laserCoreMaterial,
      this.mineShellMaterial,
      this.mechanicalMaterial,
      this.solarTrimMaterial,
      this.warningLightMaterial,
    ].includes(material);
  }

  _createBarDebugHelper(blockedLanes, z) {
    if (!DEBUG_HITBOX) return null;

    const geometry = new THREE.BoxGeometry(0.9, 0.9, PLAYER_HIT_Z_RANGE * 2);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      wireframe: true,
      transparent: true,
      opacity: 0.45,
    });
    const group = new THREE.Group();
    group.position.z = z;
    for (const lane of blockedLanes) {
      const position = getLanePosition(lane, 0);
      const helper = new THREE.Mesh(geometry, material);
      helper.position.set(position.x, position.y, 0);
      group.add(helper);
    }
    this.scene.add(group);
    return group;
  }
}
