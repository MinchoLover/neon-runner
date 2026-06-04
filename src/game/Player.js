import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  COLORS,
  GAME,
  START_LANE_INDEX,
  getLaneAngle,
  getLanePosition,
  getWrappedLaneIndex,
} from './constants.js';

const PLAYER_MODEL_TARGET_WIDTH = 2.05;
const PLAYER_MODEL_MAX_HEIGHT = 1.12;
const PLAYER_MODEL_MAX_DEPTH = 2.45;
const PLAYER_MODEL_VERTICAL_OFFSET = 0.12;
const PLAYER_MODEL_Z_OFFSET = -0.04;
const PLAYER_MODEL_SCALE_MULTIPLIER = 1;
const FALLBACK_VISUAL_SCALE = 0.7;
const MODEL_ROTATION_OFFSET = { x: 0, y: Math.PI, z: 0 };

export class Player {
  constructor() {
    this.group = new THREE.Group();
    this.visualRoot = new THREE.Group();
    this.fallbackRoot = new THREE.Group();
    this.modelRoot = new THREE.Group();
    this.engineGlowGroup = new THREE.Group();
    this.lane = START_LANE_INDEX;
    this.targetPosition = new THREE.Vector3();
    this.laneMoveImpulse = 0;
    this.hitBox = new THREE.Box3();
    this.tmpBox = new THREE.Box3();
    this.fallbackMeshes = [];
    this.loadedMaterials = [];
    this.modelLoaded = false;
    this.modelBounds = {
      width: PLAYER_MODEL_TARGET_WIDTH,
      height: PLAYER_MODEL_MAX_HEIGHT,
      depth: PLAYER_MODEL_MAX_DEPTH,
    };
    this.modelLocalBounds = {
      width: PLAYER_MODEL_TARGET_WIDTH,
      height: PLAYER_MODEL_MAX_HEIGHT,
      depth: PLAYER_MODEL_MAX_DEPTH,
    };
    this.modelScaleFactor = 1;
    this.modelLocalOffset = new THREE.Vector3();
    this.group.add(this.visualRoot);
    this.visualRoot.add(this.fallbackRoot, this.modelRoot, this.engineGlowGroup);
    this._buildShip();
    this._buildSharedEngineGlow();
    this._loadExternalModel();
    this.reset();
  }

  _addFallback(object) {
    this.fallbackMeshes.push(object);
    this.fallbackRoot.add(object);
  }

  _buildShip() {
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0xf7fbff,
      metalness: 0.38,
      roughness: 0.18,
      emissive: 0xe8f4ff,
      emissiveIntensity: 0.22,
    });
    const panelMaterial = new THREE.MeshStandardMaterial({
      color: 0xdff8ff,
      metalness: 0.3,
      roughness: 0.22,
      emissive: 0xbdeeff,
      emissiveIntensity: 0.18,
    });
    const trimMaterial = new THREE.MeshStandardMaterial({
      color: 0xffe9fb,
      metalness: 0.32,
      roughness: 0.2,
      emissive: 0xffc4f2,
      emissiveIntensity: 0.24,
    });
    const cyan = new THREE.MeshStandardMaterial({
      color: COLORS.cyan,
      emissive: COLORS.cyan,
      emissiveIntensity: 1,
      metalness: 0.25,
      roughness: 0.2,
    });
    const magenta = new THREE.MeshStandardMaterial({
      color: COLORS.magenta,
      emissive: COLORS.magenta,
      emissiveIntensity: 1,
      metalness: 0.15,
      roughness: 0.18,
    });
    const purple = new THREE.MeshStandardMaterial({
      color: COLORS.purple,
      emissive: COLORS.purple,
      emissiveIntensity: 0.66,
      metalness: 0.2,
      roughness: 0.2,
    });
    const glass = new THREE.MeshStandardMaterial({
      color: 0xfbfdff,
      emissive: 0xe2f7ff,
      emissiveIntensity: 1,
      metalness: 0.2,
      roughness: 0.08,
      transparent: true,
      opacity: 0.94,
    });
    this.materials = [bodyMaterial, panelMaterial, trimMaterial, cyan, magenta, purple, glass];
    bodyMaterial.userData.flashScale = 0.35;
    panelMaterial.userData.flashScale = 0.25;
    trimMaterial.userData.flashScale = 0.35;
    cyan.userData.flashScale = 1;
    magenta.userData.flashScale = 1;
    purple.userData.flashScale = 0.7;
    glass.userData.flashScale = 0.8;
    this.baseEmissiveIntensities = this.materials.map((material) => material.emissiveIntensity);
    this.baseTransparency = this.materials.map((material) => material.transparent);
    this.baseOpacity = this.materials.map((material) => material.opacity);

    const core = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.22, 1.64), bodyMaterial);
    core.position.set(0, -0.02, 0.08);
    core.scale.set(0.82, 0.75, 1);
    this._addFallback(core);

    const upperDeck = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.9), panelMaterial);
    upperDeck.position.set(0, 0.12, -0.08);
    upperDeck.rotation.x = -0.08;
    this._addFallback(upperDeck);

    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.27, 0.88, 4), bodyMaterial);
    nose.rotation.x = -Math.PI / 2;
    nose.rotation.z = Math.PI / 4;
    nose.position.set(0, 0.01, -1.02);
    nose.scale.set(0.78, 0.55, 1.1);
    this._addFallback(nose);

    const lowerKeel = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 1.55), panelMaterial);
    lowerKeel.position.set(0, -0.17, 0.14);
    this._addFallback(lowerKeel);

    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.23, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.58), glass);
    cockpit.position.set(0, 0.24, -0.38);
    cockpit.scale.set(0.7, 0.4, 1.05);
    this._addFallback(cockpit);

    const cockpitRim = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.035, 0.09), trimMaterial);
    cockpitRim.position.set(0, 0.225, -0.02);
    this._addFallback(cockpitRim);

    const wingGeometry = new THREE.BoxGeometry(1.32, 0.075, 0.48);
    const leftWing = new THREE.Mesh(wingGeometry, bodyMaterial);
    leftWing.position.set(-0.82, -0.08, 0.1);
    leftWing.rotation.z = 0.18;
    leftWing.rotation.y = -0.48;
    this._addFallback(leftWing);

    const rightWing = leftWing.clone();
    rightWing.position.x = 0.82;
    rightWing.rotation.z = -0.18;
    rightWing.rotation.y = 0.48;
    this._addFallback(rightWing);

    const rearWingGeometry = new THREE.BoxGeometry(0.72, 0.09, 0.42);
    const leftRearWing = new THREE.Mesh(rearWingGeometry, panelMaterial);
    leftRearWing.position.set(-0.78, -0.05, 0.62);
    leftRearWing.rotation.z = -0.08;
    leftRearWing.rotation.y = 0.38;
    this._addFallback(leftRearWing);

    const rightRearWing = leftRearWing.clone();
    rightRearWing.position.x = 0.78;
    rightRearWing.rotation.z = 0.08;
    rightRearWing.rotation.y = -0.38;
    this._addFallback(rightRearWing);

    const finGeometry = new THREE.BoxGeometry(0.09, 0.42, 0.42);
    const leftFin = new THREE.Mesh(finGeometry, panelMaterial);
    leftFin.position.set(-0.5, 0.13, 0.72);
    leftFin.rotation.z = -0.42;
    leftFin.rotation.y = 0.12;
    this._addFallback(leftFin);

    const rightFin = leftFin.clone();
    rightFin.position.x = 0.5;
    rightFin.rotation.z = 0.42;
    rightFin.rotation.y = -0.12;
    this._addFallback(rightFin);

    const accentGeometry = new THREE.BoxGeometry(0.8, 0.028, 0.065);
    const leftAccent = new THREE.Mesh(accentGeometry, trimMaterial);
    leftAccent.position.set(-0.7, 0.015, 0.1);
    leftAccent.rotation.z = 0.18;
    leftAccent.rotation.y = -0.48;
    this._addFallback(leftAccent);

    const rightAccent = leftAccent.clone();
    rightAccent.position.x = 0.7;
    rightAccent.rotation.z = -0.18;
    rightAccent.rotation.y = 0.48;
    this._addFallback(rightAccent);

    const tipGeometry = new THREE.BoxGeometry(0.2, 0.05, 0.32);
    const leftTip = new THREE.Mesh(tipGeometry, cyan);
    leftTip.position.set(-1.38, -0.02, 0.2);
    leftTip.rotation.z = 0.18;
    leftTip.rotation.y = -0.48;
    this._addFallback(leftTip);

    const rightTip = leftTip.clone();
    rightTip.position.x = 1.38;
    rightTip.rotation.z = -0.18;
    rightTip.rotation.y = 0.48;
    this._addFallback(rightTip);

    const engineShellGeometry = new THREE.CylinderGeometry(0.18, 0.24, 0.42, 18);
    const engineCoreGeometry = new THREE.CylinderGeometry(0.11, 0.13, 0.08, 18);
    const flameGeometry = new THREE.ConeGeometry(0.13, 0.72, 18);
    this.flames = [];

    [-0.34, 0.34].forEach((x) => {
      const shell = new THREE.Mesh(engineShellGeometry, trimMaterial);
      shell.rotation.x = Math.PI / 2;
      shell.position.set(x, -0.06, 0.92);
      shell.scale.set(1, 0.86, 1);
      this._addFallback(shell);

      const coreGlow = new THREE.Mesh(engineCoreGeometry, cyan);
      coreGlow.rotation.x = Math.PI / 2;
      coreGlow.position.set(x, -0.06, 1.15);
      this._addFallback(coreGlow);

      const flame = new THREE.Mesh(flameGeometry, magenta);
      flame.rotation.x = -Math.PI / 2;
      flame.position.set(x, -0.06, 1.55);
      flame.name = 'engineFlame';
      this._addFallback(flame);
      this.flames.push(flame);
    });

    this.fallbackRoot.scale.setScalar(FALLBACK_VISUAL_SCALE);
  }

  _buildSharedEngineGlow() {
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: COLORS.cyan,
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const flameMaterial = new THREE.MeshBasicMaterial({
      color: COLORS.magenta,
      transparent: true,
      opacity: 0.46,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    this.engineGlowMaterials = [glowMaterial, flameMaterial];
    const glowGeometry = new THREE.CylinderGeometry(0.08, 0.13, 0.16, 18);
    const flameGeometry = new THREE.ConeGeometry(0.09, 0.48, 18);
    const stripGeometry = new THREE.BoxGeometry(0.46, 0.026, 0.055);
    const tipGeometry = new THREE.BoxGeometry(0.12, 0.042, 0.18);
    const canopyGeometry = new THREE.SphereGeometry(0.14, 18, 10);
    this.externalFlames = [];
    this.externalAccentMeshes = [];

    [-0.36, 0.36].forEach((x) => {
      const glow = new THREE.Mesh(glowGeometry, glowMaterial);
      glow.rotation.x = Math.PI / 2;
      glow.position.set(x, -0.08, 1.08);
      glow.userData.slot = 'engineGlow';
      glow.userData.side = Math.sign(x);
      this.engineGlowGroup.add(glow);

      const flame = new THREE.Mesh(flameGeometry, flameMaterial);
      flame.rotation.x = -Math.PI / 2;
      flame.position.set(x, -0.08, 1.46);
      flame.userData.slot = 'engineFlame';
      flame.userData.side = Math.sign(x);
      this.engineGlowGroup.add(flame);
      this.externalFlames.push(flame);
    });

    [-0.74, 0.74].forEach((x, index) => {
      const side = Math.sign(x);
      const strip = new THREE.Mesh(stripGeometry, index === 0 ? flameMaterial : glowMaterial);
      strip.position.set(x, 0.05, 0.1);
      strip.rotation.z = index === 0 ? 0.12 : -0.12;
      strip.rotation.y = index === 0 ? -0.36 : 0.36;
      strip.userData.slot = 'wingStrip';
      strip.userData.side = side;
      this.engineGlowGroup.add(strip);
      this.externalAccentMeshes.push(strip);

      const tip = new THREE.Mesh(tipGeometry, glowMaterial);
      tip.position.set(x * 1.25, -0.02, 0.16);
      tip.rotation.y = index === 0 ? -0.42 : 0.42;
      tip.userData.slot = 'wingTip';
      tip.userData.side = side;
      this.engineGlowGroup.add(tip);
      this.externalAccentMeshes.push(tip);
    });

    const canopy = new THREE.Mesh(canopyGeometry, glowMaterial);
    canopy.position.set(0, 0.22, -0.36);
    canopy.scale.set(0.95, 0.38, 1.15);
    canopy.userData.slot = 'cockpit';
    this.engineGlowGroup.add(canopy);
    this.externalAccentMeshes.push(canopy);
    this.engineGlowGroup.visible = false;
  }

  _loadExternalModel() {
    const loader = new GLTFLoader();
    this._tryLoadModel(loader, '/models/player_fighter.glb', () => {
      console.warn('Player GLB failed to load, trying GLTF fallback: /models/player_fighter.glb');
      this._tryLoadModel(loader, '/models/player_fighter/scene.gltf', () => {
        console.warn('Player GLTF failed to load. Using geometry fallback: /models/player_fighter/scene.gltf');
      });
    });
  }

  _tryLoadModel(loader, path, onError = null) {
    loader.load(
      path,
      (gltf) => this._useLoadedModel(gltf.scene),
      undefined,
      (error) => {
        console.warn(`Unable to load player model at ${path}`, error);
        onError?.();
      },
    );
  }

  _useLoadedModel(model) {
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const safeSize = new THREE.Vector3(Math.max(size.x, 0.001), Math.max(size.y, 0.001), Math.max(size.z, 0.001));
    const targetSize = new THREE.Vector3(PLAYER_MODEL_TARGET_WIDTH, PLAYER_MODEL_MAX_HEIGHT, PLAYER_MODEL_MAX_DEPTH);

    model.position.sub(center);
    const scaleFactor =
      Math.min(targetSize.x / safeSize.x, targetSize.y / safeSize.y, targetSize.z / safeSize.z) * PLAYER_MODEL_SCALE_MULTIPLIER;
    model.scale.setScalar(scaleFactor);
    model.rotation.set(MODEL_ROTATION_OFFSET.x, MODEL_ROTATION_OFFSET.y, MODEL_ROTATION_OFFSET.z);
    this.modelLocalOffset.copy(model.position);

    this.modelBounds = {
      width: safeSize.x * scaleFactor,
      height: safeSize.y * scaleFactor,
      depth: safeSize.z * scaleFactor,
    };
    this.modelLocalBounds = {
      width: safeSize.x,
      height: safeSize.y,
      depth: safeSize.z,
    };
    this.modelScaleFactor = scaleFactor;

    model.traverse((child) => {
      if (!child.isMesh) return;
      child.castShadow = false;
      child.receiveShadow = false;
      const source = child.material;
      const materials = Array.isArray(source) ? source : [source];
      child.material = materials.length > 1 ? materials.map((item) => this._restyleLoadedMaterial(item, child.name)) : this._restyleLoadedMaterial(source, child.name);
      const restyledMaterials = Array.isArray(child.material) ? child.material : [child.material];
      for (const item of restyledMaterials) this.loadedMaterials.push(item);
    });

    this.modelRoot.clear();
    this.modelRoot.add(model);
    this.modelRoot.position.set(0, PLAYER_MODEL_VERTICAL_OFFSET, PLAYER_MODEL_Z_OFFSET);
    this.modelRoot.scale.setScalar(1);
    this.engineGlowGroup.position.copy(this.modelLocalOffset);
    this.engineGlowGroup.rotation.set(MODEL_ROTATION_OFFSET.x, MODEL_ROTATION_OFFSET.y, MODEL_ROTATION_OFFSET.z);
    this.engineGlowGroup.scale.setScalar(scaleFactor);
    this.fallbackRoot.visible = false;
    this._positionExternalAccents();
    this.engineGlowGroup.visible = true;
    this.modelLoaded = true;
  }

  _restyleLoadedMaterial(sourceMaterial, meshName = '') {
    const name = `${meshName} ${sourceMaterial?.name ?? ''}`.toLowerCase();
    const isCockpit = /cockpit|canopy|glass|window|visor/.test(name);
    const isAccent = /wing|fin|tip|edge|stripe|stripe|panel|nose|body|hull|armor/.test(name);
    const accentColor = /wing|fin|tip|edge|nose/.test(name) ? 0xdff8ff : 0xffd6f4;
    const material = new THREE.MeshStandardMaterial({
      color: isCockpit ? 0xfbfdff : isAccent ? accentColor : 0xf7fbff,
      metalness: isCockpit ? 0.2 : isAccent ? 0.28 : 0.34,
      roughness: isCockpit ? 0.1 : isAccent ? 0.18 : 0.2,
      emissive: isCockpit ? 0xe7fbff : isAccent ? accentColor : 0xe8f2ff,
      emissiveIntensity: isCockpit ? 1.1 : isAccent ? 0.3 : 0.14,
      transparent: isCockpit,
      opacity: isCockpit ? 0.94 : 1,
    });
    material.userData.kind = isCockpit ? 'cockpit' : 'body';
    material.userData.baseEmissive = material.emissive.clone();
    material.userData.baseEmissiveIntensity = material.emissiveIntensity;
    material.userData.baseTransparent = material.transparent;
    material.userData.baseOpacity = material.opacity;
    return material;
  }

  _positionExternalAccents() {
    const halfWidth = Math.min(this.modelLocalBounds.width * 0.5, PLAYER_MODEL_TARGET_WIDTH * 0.5);
    const halfDepth = Math.min(this.modelLocalBounds.depth * 0.5, PLAYER_MODEL_MAX_DEPTH * 0.5);
    const engineX = Math.min(halfWidth * 0.14, 0.16);
    const wingX = Math.min(halfWidth * 0.5, 0.6);
    const rearZ = Math.min(halfDepth * 0.15, 0.2);

    this.engineGlowGroup.children.forEach((child) => {
      const slot = child.userData.slot;
      const side = child.userData.side ?? 0;
      if (slot === 'engineGlow') child.position.set(side * engineX, -0.01, rearZ);
      if (slot === 'engineFlame') child.position.set(side * engineX, -0.01, rearZ + 0.08);
      if (slot === 'wingStrip') {
        child.position.set(side * wingX * 0.34, 0.025, 0.0);
        child.rotation.y = side * 0.12;
      }
      if (slot === 'wingTip') {
        child.position.set(side * wingX, -0.005, 0.01);
        child.rotation.y = side * 0.18;
      }
      if (slot === 'cockpit') {
        child.position.set(0, Math.min(this.modelLocalBounds.height * 0.3, 0.28), -Math.min(halfDepth * 0.06, 0.08));
      }
    });
  }

  setPalette(palette, hyperActive = false) {
    const enginePrimary = hyperActive ? 0xffffff : palette.primary ?? COLORS.cyan;
    const engineSecondary = hyperActive ? COLORS.magenta : palette.secondary ?? COLORS.magenta;
    if (this.engineGlowMaterials?.[0]) this.engineGlowMaterials[0].color.setHex(enginePrimary);
    if (this.engineGlowMaterials?.[1]) this.engineGlowMaterials[1].color.setHex(engineSecondary);

    for (const material of this.loadedMaterials) {
      if (!material.emissive) continue;
      const base = material.userData.baseEmissive ?? new THREE.Color(0x000000);
      const isCockpit = material.userData.kind === 'cockpit';
      const bodyBlend = material.color?.getHex() === 0xdff8ff || material.color?.getHex() === 0xffd6f4 ? engineSecondary : enginePrimary;
      material.emissive.copy(base).lerp(new THREE.Color(isCockpit ? enginePrimary : bodyBlend), isCockpit ? 0.26 : 0.1);
      material.emissiveIntensity =
        (material.userData.baseEmissiveIntensity ?? 0) + (isCockpit ? (hyperActive ? 0.52 : 0.22) : hyperActive ? 0.08 : 0.02);
    }
  }

  reset() {
    this.lane = START_LANE_INDEX;
    this._updateTargetPosition();
    this.group.position.copy(this.targetPosition);
    this.group.rotation.set(-0.08, 0, this._targetRoll());
    this.laneMoveImpulse = 0;
    this.updateHitBox();
  }

  move(direction) {
    this.lane = getWrappedLaneIndex(this.lane + direction);
    this.laneMoveImpulse = direction;
    this._updateTargetPosition();
  }

  update(delta, boostFactor, invincibleTime = 0, hitFlashTime = 0) {
    this.group.position.x = THREE.MathUtils.damp(this.group.position.x, this.targetPosition.x, 10, delta);
    this.group.position.y = THREE.MathUtils.damp(this.group.position.y, this.targetPosition.y, 10, delta);
    this.group.position.z = THREE.MathUtils.damp(this.group.position.z, this.targetPosition.z, 8, delta);

    const hover = Math.sin(performance.now() * 0.006) * 0.035;
    this.group.position.y += hover;

    const targetRoll = this._targetRoll() + this.laneMoveImpulse * 0.18;
    this.group.rotation.z = this._dampAngle(this.group.rotation.z, targetRoll, 9, delta);
    this.group.rotation.y = THREE.MathUtils.damp(this.group.rotation.y, this.laneMoveImpulse * 0.08, 7, delta);
    this.group.rotation.x = THREE.MathUtils.damp(this.group.rotation.x, -0.08, 7, delta);
    this.visualRoot.position.z = THREE.MathUtils.damp(this.visualRoot.position.z, boostFactor > 0 ? -0.12 : 0, 8, delta);
    this.visualRoot.rotation.x = THREE.MathUtils.damp(this.visualRoot.rotation.x, boostFactor > 0 ? -0.035 : 0, 8, delta);
    this.laneMoveImpulse = THREE.MathUtils.damp(this.laneMoveImpulse, 0, 8, delta);

    if (this.flames) {
      const pulse = 1 + Math.sin(performance.now() * 0.02) * 0.1 + boostFactor * 0.38;
      for (const flame of this.flames) {
        flame.scale.set(pulse, pulse, 1 + boostFactor * 0.72);
      }
    }
    if (this.externalFlames) {
      const pulse = 1 + Math.sin(performance.now() * 0.024) * 0.08 + boostFactor * 0.2;
      for (const flame of this.externalFlames) flame.scale.set(pulse, pulse, 1 + boostFactor * 0.34);
      for (const mesh of this.externalAccentMeshes) mesh.scale.setScalar(1 + boostFactor * 0.04);
      for (const material of this.engineGlowMaterials) material.opacity = 0.4 + boostFactor * 0.24;
    }
    this._updateDamageVisual(invincibleTime, hitFlashTime);
    this.updateHitBox();
  }

  _updateTargetPosition() {
    const position = getLanePosition(this.lane, GAME.playerZ);
    this.targetPosition.set(position.x, position.y, position.z);
  }

  _targetRoll() {
    return getLaneAngle(this.lane);
  }

  _dampAngle(current, target, lambda, delta) {
    const diff = Math.atan2(Math.sin(target - current), Math.cos(target - current));
    return current + diff * (1 - Math.exp(-lambda * delta));
  }

  _updateDamageVisual(invincibleTime, hitFlashTime) {
    const hitFlash = hitFlashTime > 0;
    const invincible = invincibleTime > 0;
    const flicker = invincible ? Math.sin(performance.now() * 0.045) > 0 : false;
    this.materials.forEach((material, index) => {
      const flashScale = material.userData.flashScale ?? 1;
      const flashBoost = hitFlash ? 1.35 * flashScale : 0;
      material.transparent = invincible || this.baseTransparency[index];
      material.opacity = invincible ? (flicker ? 0.38 : 0.95) : this.baseOpacity[index];
      material.emissiveIntensity = this.baseEmissiveIntensities[index] + flashBoost;
    });
    this.loadedMaterials.forEach((material) => {
      if (!material.emissive) return;
      const base = material.userData.baseEmissive ?? new THREE.Color(0x000000);
      material.emissive.copy(base);
      if (hitFlash) material.emissive.lerp(new THREE.Color(COLORS.magenta), 0.85);
      material.emissiveIntensity = (material.userData.baseEmissiveIntensity ?? 0) + (hitFlash ? 0.75 : 0);
      material.transparent = invincible || material.userData.baseTransparent;
      material.opacity = invincible ? (flicker ? 0.42 : 0.96) : material.userData.baseOpacity;
    });
  }

  updateHitBox() {
    this.hitBox.setFromCenterAndSize(this.group.position, new THREE.Vector3(0.82, 0.58, 1.18));
  }
}
