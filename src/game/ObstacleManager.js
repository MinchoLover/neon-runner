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
  TUNNEL_PALETTES,
  getLaneAngle,
  getLanePosition,
} from './constants.js';

const DEBUG_HITBOX = false;
const PLAYER_HIT_X_RANGE = 1.05;
const SCORE_RING_X_RANGE = 0.9;
const DEBUG_OPENING = Boolean(import.meta.env?.DEV);
const WAVE_DURATION = 12;
const WAVE_SEQUENCE = ['warmup', 'pressure', 'risk', 'rift', 'cooldown'];
const READABILITY_COLORS = {
  blocker: 0xff6200,
  bar: 0xffb700,
  gateBlock: 0xff8c00,
  safe: 0x00e5ff,
  reward: 0xffffff,
};
const OBSTACLE_MODEL_PATHS = {
  energyBarricade: '/models/obstacles/energy_gate.glb',
  securityGate: '/models/obstacles/energy_gate.glb',
  laserFan: '/models/obstacles/laser_fan.glb',
  shutterTrap: '/models/obstacles/shutter_gate.glb',
  plasmaMine: '/models/obstacles/plasma_mine.glb',
};

export class ObstacleManager {
  constructor(scene) {
    this.scene = scene;
    this.obstacles = [];
    this.scoreRings = [];
    this.spawnTimer = 0;
    this.patternIndex = 0;
    this.nextSpawnDelay = null;
    this.currentWave = 'warmup';
    this.openingSpawnedIds = new Set();
    this.openingCueIds = new Set();
    this.openingComplete = false;
    this.modelCache = new Map();
    this._loadOptionalObstacleModels();
    this.palette = TUNNEL_PALETTES[0];
    this.boxMaterial = new THREE.MeshStandardMaterial({
      color: 0x110900,
      emissive: READABILITY_COLORS.blocker,
      emissiveIntensity: 0.78,
      metalness: 0.65,
      roughness: 0.34,
    });
    this.barMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a0d00,
      emissive: READABILITY_COLORS.bar,
      emissiveIntensity: 0.86,
      metalness: 0.75,
      roughness: 0.28,
    });
    this.edgeMaterial = new THREE.LineBasicMaterial({
      color: COLORS.solarGold,
      transparent: true,
      opacity: 0.62,
    });
    this.gateMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a0f05,
      emissive: READABILITY_COLORS.gateBlock,
      emissiveIntensity: 0.74,
      metalness: 0.62,
      roughness: 0.3,
    });
    this.safeFrameMaterial = new THREE.MeshStandardMaterial({
      color: 0x02191c,
      emissive: READABILITY_COLORS.safe,
      emissiveIntensity: 1.1,
      metalness: 0.2,
      roughness: 0.22,
    });
    this.scoreRingMaterial = new THREE.MeshBasicMaterial({
      color: COLORS.white,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
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
    for (const item of this.scoreRings) this._removeScoreRing(item);
    this.obstacles = [];
    this.scoreRings = [];
    this.spawnTimer = OPENING_MIN_SAFE_GAP;
    this.patternIndex = 0;
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
    this.scoreRingMaterial.color.setHex(READABILITY_COLORS.reward);
    this.openingPanelMaterial.emissive.setHex(0x26052f);
    this.openingFrameMaterial.color.setHex(READABILITY_COLORS.blocker).multiplyScalar(0.18);
    this.openingFrameMaterial.emissive.setHex(READABILITY_COLORS.blocker);
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
        this.spawnPattern(elapsed, this._normalSpawnZ(elapsed));
        callbacks.onPattern?.(this.lastSafeLane);
        this.spawnTimer = this.nextSpawnDelay ?? interval;
        this.nextSpawnDelay = null;
      }
    }

    for (let i = this.obstacles.length - 1; i >= 0; i -= 1) {
      const obstacle = this.obstacles[i];
      // Obstacles approach the camera by z-axis translation; bars add rotation transform.
      obstacle.group.position.z += speed * delta;
      if (obstacle.rods) {
        for (const rod of obstacle.rods) rod.rotation.z += obstacle.spinSpeed * delta;
      } else {
        obstacle.group.rotation[obstacle.spinAxis] += obstacle.spinSpeed * delta;
      }
      if (obstacle.debugHelper) obstacle.debugHelper.position.z = obstacle.group.position.z;

      if (!obstacle.hit && this._hitsPlayer(obstacle, callbacks)) {
        obstacle.hit = true;
        if (obstacle.userData) obstacle.userData.hit = true;
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

    this._updateScoreRings(delta, speed, callbacks);
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

    if (patternType === 'bar') {
      this._createBar(this._blockedExcept(safeLane), spawnZ - 7, elapsed);
    } else if (patternType === 'gate') {
      this._createGate(safeLane, spawnZ - 5);
    } else if (patternType === 'narrow') {
      this._createGate(safeLane, spawnZ - 4);
      this._createBar(this._blockedExcept(safeLane), spawnZ - 13, elapsed);
    } else {
      const blocked = this._blockedExcept(safeLane);
      for (const lane of blocked) this._createBox(lane, spawnZ - Math.random() * 4);
    }
    this._maybeCreateScoreRing(safeLane, patternType, elapsed, spawnZ);
    this.patternIndex += 1;
  }

  _updateScoreRings(delta, speed, callbacks) {
    for (let i = this.scoreRings.length - 1; i >= 0; i -= 1) {
      const ring = this.scoreRings[i];
      // Reward objects use the same z-axis motion and rotation transforms as obstacles.
      ring.group.position.z += speed * delta;
      ring.group.rotation.z += ring.spinSpeed * delta;
      ring.group.rotation.y += ring.spinSpeed * 0.5 * delta;
      const pulseOpacity = 0.72 + Math.sin(performance.now() * 0.012 + ring.phase) * 0.18;
      ring.materials[0].opacity = pulseOpacity;
      ring.materials[1].opacity = pulseOpacity * 0.52;

      const closeZ = Math.abs(ring.group.position.z - GAME.playerZ) < 1.05;
      const closeX = Math.abs(callbacks.playerX - LANE_X[ring.lane]) < SCORE_RING_X_RANGE;
      if (!ring.collected && closeZ && closeX) {
        ring.collected = true;
        callbacks.onScoreRing?.(ring.group.position, ring);
        this._removeScoreRing(ring);
        this.scoreRings.splice(i, 1);
        continue;
      }

      if (ring.group.position.z > GAME.removeZ) {
        this._removeScoreRing(ring);
        this.scoreRings.splice(i, 1);
      }
    }
  }

  _maybeCreateScoreRing(safeLane, patternType, elapsed, spawnZ = GAME.spawnZ) {
    if (elapsed < 12 || this.scoreRings.length >= 4) return;
    const wave = this._waveForElapsed(elapsed);

    // Significantly increase chance during risk and pressure waves
    const waveBoost = wave.name === 'risk' ? 0.35 : wave.name === 'pressure' ? 0.15 : wave.name === 'cooldown' ? -0.1 : 0;
    const baseChance = elapsed < 20 ? 0.15 : elapsed < 40 ? 0.25 : 0.35;
    const spawnChance = Math.max(0, baseChance + waveBoost);

    if (Math.random() > spawnChance) return;

    const adjacent = [safeLane - 1, safeLane + 1].filter((lane) => lane >= 0 && lane < LANE_COUNT);
    const riskyLane = adjacent.length > 0 ? adjacent[Math.floor(Math.random() * adjacent.length)] : safeLane;
    const lane = patternType === 'gate' || patternType === 'narrow' ? safeLane : riskyLane;
    const z = patternType === 'narrow' || patternType === 'bar' ? spawnZ - 18 : spawnZ - 9;

    this._createScoreRing(lane, z, lane !== safeLane || patternType === 'narrow' ? 'risk' : 'precision');

    // 30% chance to spawn a sequential ring in a contiguous pattern during pressure/risk
    if ((wave.name === 'risk' || wave.name === 'pressure') && Math.random() > 0.7) {
      const seqLane = patternType === 'narrow' ? safeLane : (lane === 0 ? 1 : lane === 2 ? 1 : lane);
      this._createScoreRing(seqLane, z - 12, 'risk');
    }
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
    if (elapsed < 10) return 'cube';
    const bias = this.palette?.bias;
    const pressureBoost = wave.name === 'pressure' ? 0.08 : 0;
    const riskBoost = wave.name === 'risk' ? 0.06 : 0;
    const cooldownEase = wave.name === 'cooldown' ? -0.08 : 0;
    const barBoost = (bias === 'bar' ? 0.1 : 0) + pressureBoost + cooldownEase;
    const gateBoost = (bias === 'gate' ? 0.1 : 0) + pressureBoost * 0.6;
    const fastBoost = (bias === 'fast' ? 0.05 : 0) + riskBoost;
    if (elapsed < 25) return roll < 0.2 + barBoost ? 'bar' : roll < 0.32 + gateBoost ? 'gate' : 'cube';
    if (elapsed < 45) return roll < 0.28 + barBoost ? 'bar' : roll < 0.46 + gateBoost ? 'gate' : roll < 0.58 + fastBoost ? 'narrow' : 'cube';
    return roll < 0.34 + barBoost ? 'bar' : roll < 0.54 + fastBoost ? 'narrow' : roll < 0.7 + gateBoost ? 'gate' : 'cube';
  }

  _spawnInterval(elapsed) {
    if (elapsed < 10) return 1.5;
    if (elapsed < 25) return THREE.MathUtils.lerp(1.45, 1.05, (elapsed - 10) / 15);
    const paletteBias = this.palette?.bias === 'fast' ? 0.08 : 0;
    const wave = this._waveForElapsed(elapsed);
    const waveBias = wave.name === 'pressure' ? 0.08 : wave.name === 'risk' ? 0.04 : wave.name === 'cooldown' ? -0.12 : 0;
    return THREE.MathUtils.clamp(1.05 - (elapsed - 25) * 0.018 - paletteBias - waveBias, 0.68, 1.18);
  }

  _waveForElapsed(elapsed) {
    if (elapsed < 10) return { name: 'warmup', index: 0, progress: elapsed / 10, intensity: 0.08 };
    const cycleTime = elapsed - 10;
    const index = Math.floor(cycleTime / WAVE_DURATION) % WAVE_SEQUENCE.length;
    const name = WAVE_SEQUENCE[index];
    const progress = (cycleTime % WAVE_DURATION) / WAVE_DURATION;
    const intensity = name === 'pressure' ? 0.42 : name === 'risk' ? 0.36 : name === 'rift' ? 0.32 : name === 'cooldown' ? 0.04 : 0.12;
    return { name, index, progress, intensity };
  }

  _hitsPlayer(obstacle, callbacks) {
    // Use the rendered x position so collision timing matches the visible lane transition.
    const overlapsBlockedLane = obstacle.blockedLanes.some(
      (lane) => Math.abs(callbacks.playerX - LANE_X[lane]) < PLAYER_HIT_X_RANGE,
    );
    const closeZ = Math.abs(obstacle.group.position.z - GAME.playerZ) < PLAYER_HIT_Z_RANGE;
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
    const group = new THREE.Group();
    group.position.z = z;
    const panelGeometry = new THREE.BoxGeometry(1.46, 1.18, 0.2);
    const horizontalGeometry = new THREE.BoxGeometry(1.62, 0.08, 0.28);
    const verticalGeometry = new THREE.BoxGeometry(0.08, 1.34, 0.28);

    for (const lane of blockedLanes) {
      const position = getLanePosition(lane, 0);
      const panel = new THREE.Mesh(panelGeometry, this.openingPanelMaterial);
      panel.position.set(position.x, position.y + 0.22, 0);
      const top = new THREE.Mesh(horizontalGeometry, this.openingFrameMaterial);
      const bottom = new THREE.Mesh(horizontalGeometry, this.openingFrameMaterial);
      const left = new THREE.Mesh(verticalGeometry, this.openingFrameMaterial);
      const right = new THREE.Mesh(verticalGeometry, this.openingFrameMaterial);
      top.position.set(position.x, position.y + 0.84, 0);
      bottom.position.set(position.x, position.y - 0.4, 0);
      left.position.set(position.x - 0.77, position.y + 0.22, 0);
      right.position.set(position.x + 0.77, position.y + 0.22, 0);
      group.add(panel, top, bottom, left, right);
    }

    if (pattern.openLane != null) {
      const safePosition = getLanePosition(pattern.openLane, 0);
      const safeFrame = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.045, 8, 28), this.safeFrameMaterial);
      safeFrame.position.set(safePosition.x, safePosition.y + 0.26, 0.02);
      safeFrame.scale.y = 0.72;
      group.add(safeFrame);
    }

    group.userData = {
      type: pattern.type,
      blockedLanes,
      counted: false,
      hit: false,
      nearMissCounted: false,
      openingPatternId: pattern.id,
    };
    this.scene.add(group);
    const obstacle = {
      type: pattern.type,
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
    
    const coreGeom = new THREE.IcosahedronGeometry(0.42, 0);
    const core = new THREE.Mesh(coreGeom, this.boxMaterial);
    
    const shellGeom = new THREE.IcosahedronGeometry(0.55, 1);
    const shellMaterial = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8, roughness: 0.2, wireframe: true });
    const shell = new THREE.Mesh(shellGeom, shellMaterial);
    
    const ringGeom = new THREE.TorusGeometry(0.65, 0.035, 8, 16);
    const ring1 = new THREE.Mesh(ringGeom, this.boxMaterial);
    ring1.rotation.x = Math.PI / 2;
    const ring2 = new THREE.Mesh(ringGeom, this.boxMaterial);
    ring2.rotation.y = Math.PI / 2;
    
    group.add(core, shell, ring1, ring2);

    const position = getLanePosition(lane, z);
    group.position.set(position.x, position.y, position.z);
    group.rotation.set(Math.random() * 0.4, Math.random() * 0.8, getLaneAngle(lane) + Math.PI / 2);
    group.userData = { type: 'plasmaMine', blockedLanes: [lane], counted: false, hit: false, nearMissCounted: false };
    this.scene.add(group);
    this.obstacles.push({
      type: 'plasmaMine',
      group,
      blockedLanes: [lane],
      spinAxis: 'y',
      spinSpeed: 1.8 + Math.random() * 1.2,
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
      const position = getLanePosition(lane, 0);
      const laneAngle = getLaneAngle(lane);
      const model = this._cloneObstacleModel('laserFan', 1.35);
      if (model) {
        model.position.set(position.x, position.y, 0);
        group.add(model);
        rods.push(model);
      } else {
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.2, 18), this.boxMaterial);
        hub.rotation.x = Math.PI / 2;
        hub.position.set(position.x, position.y, 0);
        group.add(hub);
        for (let i = 0; i < 4; i += 1) {
          const blade = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.08, 0.2), this.barMaterial);
          blade.position.copy(hub.position);
          blade.rotation.z = laneAngle + i * (Math.PI / 2);
          group.add(blade);
          rods.push(blade);
        }
      }
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

  _createGate(safeLane, z) {
    const group = new THREE.Group();
    group.position.z = z;
    const blockedLanes = this._blockedExcept(safeLane);
    const model = this._cloneObstacleModel('securityGate', 3.8);
    if (model) {
      group.add(model);
    }
    const postGeometry = new THREE.BoxGeometry(0.46, 1.34, 0.34);
    const capGeometry = new THREE.BoxGeometry(1.42, 0.3, 0.34);

    for (const lane of blockedLanes) {
      const position = getLanePosition(lane, 0);
      if (!model) {
        const post = new THREE.Mesh(postGeometry, this.gateMaterial);
        const cap = new THREE.Mesh(capGeometry, this.barMaterial);
        const panel = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.7, 0.18), this.gateMaterial);
        post.position.set(position.x, position.y + 0.1, 0);
        cap.position.set(position.x, position.y + 0.82, 0);
        panel.position.set(position.x, position.y + 0.18, 0);
        group.add(post, cap, panel);
      }
    }

    const safePosition = getLanePosition(safeLane, 0);
    const safeFrame = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.045, 8, 28), this.safeFrameMaterial);
    safeFrame.position.set(safePosition.x, safePosition.y + 0.26, 0);
    safeFrame.scale.y = 0.72;
    group.add(safeFrame);

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

  _createScoreRing(lane, z, riskType = 'risk') {
    const group = new THREE.Group();
    const ringMaterial = this.scoreRingMaterial.clone();
    const coreMaterial = this.scoreRingMaterial.clone();
    coreMaterial.opacity = 0.42;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.035, 10, 32), ringMaterial);
    const core = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.014, 8, 20), coreMaterial);
    ring.rotation.x = Math.PI / 2;
    core.rotation.x = Math.PI / 2;
    group.add(ring, core);
    const position = getLanePosition(lane, z);
    group.position.set(position.x, position.y + 0.32, position.z);
    group.rotation.z = getLaneAngle(lane);
    group.userData = { type: 'scoreRing', blockedLanes: [], counted: false, hit: false, nearMissCounted: true };
    this.scene.add(group);
    this.scoreRings.push({
      type: 'scoreRing',
      riskType,
      group,
      lane,
      materials: [ringMaterial, coreMaterial],
      spinSpeed: 1.8 + Math.random() * 0.7,
      phase: Math.random() * Math.PI * 2,
      collected: false,
    });
  }

  _removeScoreRing(ring) {
    this.scene.remove(ring.group);
    this._disposeGroupResources(ring.group);
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
      this.scoreRingMaterial,
      this.openingPanelMaterial,
      this.openingFrameMaterial,
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
