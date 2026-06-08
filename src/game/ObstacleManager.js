import * as THREE from 'three';
import { COLORS, GAME, LANE_COUNT, PLAYER_HIT_Z_RANGE, TUNNEL_PALETTES, getLaneAngle, getLanePosition } from './constants.js';

const DEBUG_HITBOX = false;

export class ObstacleManager {
  constructor(scene) {
    this.scene = scene;
    this.obstacles = [];
    this.spawnTimer = 0;
    this.patternIndex = 0;
    this.nextSpawnDelay = null;
    this.palette = TUNNEL_PALETTES[0];
    this.boxMaterial = new THREE.MeshStandardMaterial({
      color: 0x150022,
      emissive: COLORS.magenta,
      emissiveIntensity: 1.35,
      metalness: 0.25,
      roughness: 0.24,
    });
    this.barMaterial = new THREE.MeshStandardMaterial({
      color: 0x08152f,
      emissive: COLORS.cyan,
      emissiveIntensity: 1.45,
      metalness: 0.35,
      roughness: 0.18,
    });
    this.edgeMaterial = new THREE.LineBasicMaterial({
      color: COLORS.white,
      transparent: true,
      opacity: 0.8,
    });
    this.gateMaterial = new THREE.MeshStandardMaterial({
      color: 0x061226,
      emissive: COLORS.purple,
      emissiveIntensity: 1.15,
      metalness: 0.32,
      roughness: 0.2,
    });
  }

  reset() {
    for (const item of this.obstacles) this.scene.remove(item.group);
    for (const item of this.obstacles) {
      if (item.debugHelper) this.scene.remove(item.debugHelper);
    }
    this.obstacles = [];
    this.spawnTimer = 1.1;
    this.patternIndex = 0;
    this.nextSpawnDelay = null;
  }

  setPalette(palette) {
    this.palette = palette;
    const obstacleColor = palette.obstacle ?? palette.secondary;
    const primary = palette.primary ?? COLORS.cyan;
    const secondary = palette.secondary ?? COLORS.magenta;
    // Emissive color feeds the neon look before bloom exaggerates bright fragments.
    this.boxMaterial.color.setHex(obstacleColor).multiplyScalar(0.28);
    this.boxMaterial.emissive.setHex(obstacleColor);
    this.barMaterial.color.setHex(primary).multiplyScalar(0.22);
    this.barMaterial.emissive.setHex(primary);
    this.gateMaterial.color.setHex(secondary).multiplyScalar(0.2);
    this.gateMaterial.emissive.setHex(secondary);
    this.edgeMaterial.color.setHex(palette.accent ?? COLORS.white);
  }

  update(delta, speed, elapsed, callbacks) {
    const interval = this._spawnInterval(elapsed);
    this.spawnTimer -= delta;
    if (this.spawnTimer <= 0) {
      this.spawnPattern(elapsed);
      callbacks.onPattern?.(this.lastSafeLane);
      this.spawnTimer = this.nextSpawnDelay ?? interval;
      this.nextSpawnDelay = null;
    }

    for (let i = this.obstacles.length - 1; i >= 0; i -= 1) {
      const obstacle = this.obstacles[i];
      // Obstacles approach the camera by z-axis translation; bars add rotation transform.
      obstacle.group.position.z += speed * delta;
      if (obstacle.type === 'bar') {
        for (const rod of obstacle.rods) rod.rotation.z += obstacle.spinSpeed * delta;
      } else {
        obstacle.group.rotation[obstacle.spinAxis] += obstacle.spinSpeed * delta;
      }
      if (obstacle.debugHelper) obstacle.debugHelper.position.z = obstacle.group.position.z;

      if (obstacle.type === 'turnGate') {
        this._updateTurnGate(obstacle, callbacks);
      }

      if (!obstacle.hit && this._hitsPlayer(obstacle, callbacks)) {
        obstacle.hit = true;
        callbacks.onHit(obstacle.group.position, obstacle);
      }

      if (!obstacle.nearMissed && this._isNearMiss(obstacle, callbacks.playerLane)) {
        obstacle.nearMissed = true;
        callbacks.onNearMiss?.(obstacle.group.position);
      }

      if (!obstacle.hit && !obstacle.passed && obstacle.group.position.z > GAME.playerZ + 1.5) {
        obstacle.passed = true;
        if (obstacle.type !== 'turnGate') callbacks.onPassed();
      }

      if (obstacle.group.position.z > GAME.removeZ) {
        this.scene.remove(obstacle.group);
        if (obstacle.debugHelper) this.scene.remove(obstacle.debugHelper);
        this.obstacles.splice(i, 1);
      }
    }
  }

  resolveTurnInput(direction) {
    const activeGate = this.obstacles.find(
      (obstacle) =>
        obstacle.type === 'turnGate' && !obstacle.resolved && Math.abs(obstacle.group.position.z - GAME.playerZ) <= obstacle.activeRange,
    );
    if (!activeGate) return null;
    if (activeGate.turnDirection !== direction) return { success: false, obstacle: activeGate };

    activeGate.resolved = true;
    activeGate.success = true;
    activeGate.passed = true;
    return { success: true, obstacle: activeGate };
  }

  _updateTurnGate(obstacle, callbacks) {
    const zDistance = Math.abs(obstacle.group.position.z - GAME.playerZ);
    const inRange = zDistance <= obstacle.activeRange;
    obstacle.isActive = inRange && !obstacle.resolved;
    if (!obstacle.resolved && zDistance <= obstacle.promptRange && !obstacle.warned) {
      obstacle.warned = true;
      callbacks.onTurnGateActive?.(obstacle.turnDirection, obstacle.group.position);
    }

    if (!obstacle.resolved && obstacle.group.position.z > GAME.playerZ + 4.5) {
      obstacle.resolved = true;
      obstacle.success = false;
      obstacle.hit = true;
      callbacks.onTurnGateMissed?.(obstacle.turnDirection, obstacle.group.position, obstacle);
    }
  }

  spawnPattern(elapsed) {
    const safeLane = this._pickSafeLaneForPattern(elapsed);
    const patternType = this._patternType(elapsed);
    this.lastSafeLane = safeLane;

    if (patternType === 'turn') {
      this._createTurnGate(safeLane, GAME.spawnZ + 16);
    } else if (patternType === 'bar') {
      this._createBar(this._blockedExcept(safeLane), GAME.spawnZ - 7, elapsed);
    } else if (patternType === 'gate') {
      this._createGate(safeLane, GAME.spawnZ - 5);
    } else if (patternType === 'narrow') {
      this._createGate(safeLane, GAME.spawnZ - 4);
      this._createBar(this._blockedExcept(safeLane), GAME.spawnZ - 13, elapsed);
    } else {
      const blocked = elapsed < 8 && Math.random() < 0.7 ? [this._singleBlockedLane(safeLane)] : this._blockedExcept(safeLane);
      for (const lane of blocked) this._createBox(lane, GAME.spawnZ - Math.random() * 4);
    }
    this.patternIndex += 1;
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
    if (elapsed > 9 && this.patternIndex > 0 && this.patternIndex % GAME.turnGateInterval === 0) return 'turn';
    if (elapsed < 10) return 'cube';
    const bias = this.palette?.bias;
    const barBoost = bias === 'bar' ? 0.1 : 0;
    const gateBoost = bias === 'gate' ? 0.1 : 0;
    const fastBoost = bias === 'fast' ? 0.05 : 0;
    if (elapsed < 25) return roll < 0.2 + barBoost ? 'bar' : roll < 0.32 + gateBoost ? 'gate' : 'cube';
    if (elapsed < 45) return roll < 0.28 + barBoost ? 'bar' : roll < 0.46 + gateBoost ? 'gate' : roll < 0.58 + fastBoost ? 'narrow' : 'cube';
    return roll < 0.34 + barBoost ? 'bar' : roll < 0.54 + fastBoost ? 'narrow' : roll < 0.7 + gateBoost ? 'gate' : 'cube';
  }

  _spawnInterval(elapsed) {
    if (elapsed < 10) return 1.5;
    if (elapsed < 25) return THREE.MathUtils.lerp(1.45, 1.05, (elapsed - 10) / 15);
    const paletteBias = this.palette?.bias === 'fast' ? 0.08 : 0;
    return THREE.MathUtils.clamp(1.05 - (elapsed - 25) * 0.018 - paletteBias, 0.68, 1.05);
  }

  _hitsPlayer(obstacle, callbacks) {
    if (obstacle.type === 'turnGate') return false;
    // Collision detection is simplified to lane overlap plus a narrow z-distance test.
    const sameLaneBlocked = obstacle.blockedLanes.includes(callbacks.playerLane);
    const closeZ = Math.abs(obstacle.group.position.z - GAME.playerZ) < PLAYER_HIT_Z_RANGE;
    return sameLaneBlocked && closeZ;
  }

  _isNearMiss(obstacle, playerLane) {
    if (obstacle.type === 'turnGate') return false;
    const zDistance = Math.abs(obstacle.group.position.z - GAME.playerZ);
    if (zDistance > 1.45 || obstacle.blockedLanes.includes(playerLane)) return false;
    const adjacentThreat = obstacle.blockedLanes.some((lane) => Math.abs(lane - playerLane) === 1);
    return adjacentThreat;
  }

  _createBox(lane, z) {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.86, 0.86), this.boxMaterial);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), this.edgeMaterial);
    group.add(mesh, edges);
    const position = getLanePosition(lane, z);
    group.position.set(position.x, position.y, position.z);
    group.rotation.set(Math.random() * 0.4, Math.random() * 0.8, getLaneAngle(lane) + Math.PI / 2);
    this.scene.add(group);
    this.obstacles.push({
      type: 'cube',
      group,
      blockedLanes: [lane],
      spinAxis: 'y',
      spinSpeed: 1.4 + Math.random() * 1.1,
      hit: false,
      passed: false,
      nearMissed: false,
    });
  }

  _createBar(blockedLanes, z, elapsed = 0) {
    const group = new THREE.Group();
    group.position.z = z;
    const rods = [];

    for (const lane of blockedLanes) {
      const position = getLanePosition(lane, 0);
      const laneAngle = getLaneAngle(lane);
      const rod = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.16, 0.2), this.barMaterial);
      rod.position.set(position.x, position.y, 0);
      rod.rotation.z = laneAngle;
      const hub = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 8), this.boxMaterial);
      hub.position.copy(rod.position);
      group.add(rod, hub);
      rods.push(rod);
    }

    this.scene.add(group);
    this.obstacles.push({
      type: 'bar',
      group,
      blockedLanes,
      rods,
      spinSpeed: 1.6 + Math.random() * 0.6 + Math.min(elapsed * 0.018, 0.9),
      hit: false,
      passed: false,
      nearMissed: false,
      debugHelper: this._createBarDebugHelper(blockedLanes, z),
    });
  }

  _createGate(safeLane, z) {
    const group = new THREE.Group();
    group.position.z = z;
    const blockedLanes = this._blockedExcept(safeLane);
    const postGeometry = new THREE.BoxGeometry(0.38, 1.28, 0.32);
    const capGeometry = new THREE.BoxGeometry(1.35, 0.24, 0.32);

    for (const lane of blockedLanes) {
      const position = getLanePosition(lane, 0);
      const post = new THREE.Mesh(postGeometry, this.gateMaterial);
      const cap = new THREE.Mesh(capGeometry, this.barMaterial);
      post.position.set(position.x, position.y + 0.1, 0);
      cap.position.set(position.x, position.y + 0.82, 0);
      group.add(post, cap);
    }

    const safePosition = getLanePosition(safeLane, 0);
    const safeFrame = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.035, 8, 28), this.barMaterial);
    safeFrame.position.set(safePosition.x, safePosition.y + 0.26, 0);
    safeFrame.scale.y = 0.72;
    group.add(safeFrame);

    this.scene.add(group);
    this.obstacles.push({
      type: 'gate',
      group,
      blockedLanes,
      spinAxis: 'z',
      spinSpeed: 0.12,
      hit: false,
      passed: false,
      nearMissed: false,
    });
  }

  _createTurnGate(safeLane, z) {
    const group = new THREE.Group();
    group.position.z = z;
    const blockedLanes = [];
    const direction = Math.random() > 0.5 ? 1 : -1;
    const frameMaterial = this.barMaterial;
    const warningMaterial = this.boxMaterial;
    const postGeometry = new THREE.BoxGeometry(0.32, 1.55, 0.36);
    const arrowGeometry = new THREE.ConeGeometry(0.3, 0.68, 3);

    for (let lane = 0; lane < LANE_COUNT; lane += 1) {
      const position = getLanePosition(lane, 0);
      const post = new THREE.Mesh(postGeometry, lane === 1 ? frameMaterial : warningMaterial);
      post.position.set(position.x, position.y + 0.18, 0);
      group.add(post);
    }

    const safePosition = getLanePosition(1, 0);
    const arch = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.055, 8, 32), frameMaterial);
    arch.position.set(safePosition.x, safePosition.y + 0.34, 0);
    arch.scale.y = 0.7;
    group.add(arch);

    for (let i = 0; i < 3; i += 1) {
      const arrow = new THREE.Mesh(arrowGeometry, frameMaterial);
      arrow.position.set(safePosition.x + (i - 1) * 0.45, safePosition.y + 1.08, 0);
      arrow.rotation.z = direction > 0 ? -Math.PI / 2 : Math.PI / 2;
      arrow.scale.set(0.8, 0.8, 1);
      group.add(arrow);
    }

    this.scene.add(group);
    this.obstacles.push({
      type: 'turnGate',
      group,
      blockedLanes,
      safeLane: 1,
      turnDirection: direction,
      directionLabel: direction < 0 ? 'left' : 'right',
      activeRange: 24,
      promptRange: 36,
      resolved: false,
      success: false,
      warned: false,
      isActive: false,
      spinAxis: 'z',
      spinSpeed: 0.06 * direction,
      hit: false,
      passed: false,
      nearMissed: true,
    });
    this.nextSpawnDelay = 2.6;
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
