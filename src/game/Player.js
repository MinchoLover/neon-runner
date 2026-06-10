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

// GLB visibility bug 때문에 지금은 절차형 기체를 메인으로 사용한다.
const USE_PROCEDURAL_PLAYER = true;

const PLAYER_MODEL_TARGET_WIDTH = 2.2;
const PLAYER_MODEL_MAX_HEIGHT = 1.15;
const PLAYER_MODEL_MAX_DEPTH = 2.55;
const PLAYER_MODEL_VERTICAL_OFFSET = 0.22;
const PLAYER_MODEL_Z_OFFSET = -0.18;
const FALLBACK_VISUAL_SCALE = 1.02;

const PLAYER_MATERIAL_STYLE = {
  body: 0x53656d,
  panel: 0x253942,
  trim: 0x2b1907,
  cockpit: 0x9eeaff,
};

export class Player {
  constructor() {
    this.group = new THREE.Group();
    this.visualRoot = new THREE.Group();
    this.fallbackRoot = new THREE.Group();
    this.modelRoot = new THREE.Group();
    this.referenceShellRoot = new THREE.Group();
    this.engineGlowGroup = new THREE.Group();

    this.lane = START_LANE_INDEX;
    this.targetPosition = new THREE.Vector3();
    this.laneMoveImpulse = 0;
    this.hitBox = new THREE.Box3();
    this.tmpBox = new THREE.Box3();
    this.fallbackMeshes = [];
    this.loadedMaterials = [];
    this.modelLoaded = false;

    this.group.add(this.visualRoot);
    this.visualRoot.position.y = 0.82;
    this.visualRoot.scale.setScalar(1.02);

    this.visualRoot.add(
      this.fallbackRoot,
      this.modelRoot,
      this.referenceShellRoot,
      this.engineGlowGroup,
    );

    this._buildShip();
    this._buildReferenceShell();
    this._buildSharedEngineGlow();

    // 핵심: 단순 box/cone fallback은 끄고, 예전 간지나던 referenceShell을 메인으로 사용.
    this.fallbackRoot.visible = false;
    this.referenceShellRoot.visible = true;
    this.modelRoot.visible = false;

    this.reset();
  }

  _addFallback(object) {
    this.fallbackMeshes.push(object);
    this.fallbackRoot.add(object);
  }

  _createArmorPrism(points, height, material) {
    const halfHeight = height * 0.5;
    const vertices = [];

    for (const [x, z] of points) vertices.push(x, halfHeight, z);
    for (const [x, z] of points) vertices.push(x, -halfHeight, z);

    const contour = points.map(([x, z]) => new THREE.Vector2(x, z));
    const faces = THREE.ShapeUtils.triangulateShape(contour, []);
    const indices = [];

    for (const [a, b, c] of faces) {
      indices.push(a, c, b);
      indices.push(a + points.length, b + points.length, c + points.length);
    }

    for (let i = 0; i < points.length; i += 1) {
      const next = (i + 1) % points.length;
      indices.push(
        i,
        next,
        next + points.length,
        i,
        next + points.length,
        i + points.length,
      );
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    return new THREE.Mesh(geometry, material);
  }

  _addEdgeBar(group, start, end, y, material, width = 0.055, height = 0.045) {
    const dx = end[0] - start[0];
    const dz = end[1] - start[1];
    const length = Math.hypot(dx, dz);

    const bar = new THREE.Mesh(new THREE.BoxGeometry(width, height, length), material);
    bar.position.set((start[0] + end[0]) * 0.5, y, (start[1] + end[1]) * 0.5);
    bar.rotation.y = Math.atan2(dx, dz);
    group.add(bar);

    return bar;
  }

  _buildShip() {
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: PLAYER_MATERIAL_STYLE.body,
      metalness: 0.62,
      roughness: 0.24,
      emissive: 0x08121f,
      emissiveIntensity: 0.16,
    });

    const glass = new THREE.MeshStandardMaterial({
      color: PLAYER_MATERIAL_STYLE.cockpit,
      emissive: COLORS.cyan,
      emissiveIntensity: 0.95,
      metalness: 0.2,
      roughness: 0.08,
      transparent: true,
      opacity: 0.94,
    });

    const solarOrange = new THREE.MeshStandardMaterial({
      color: COLORS.solarOrange,
      emissive: COLORS.solarOrange,
      emissiveIntensity: 1,
    });

    this.materials = [bodyMaterial, glass, solarOrange];
    bodyMaterial.userData.kind = 'body';
    glass.userData.kind = 'cockpit';
    solarOrange.userData.kind = 'accent';

    this.baseEmissiveIntensities = this.materials.map((m) => m.emissiveIntensity);
    this.baseTransparency = this.materials.map((m) => m.transparent);
    this.baseOpacity = this.materials.map((m) => m.opacity);

    const core = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.22, 1.64), bodyMaterial);
    core.position.set(0, -0.02, 0.08);
    this._addFallback(core);

    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.27, 0.88, 4), bodyMaterial);
    nose.rotation.x = -Math.PI / 2;
    nose.rotation.z = Math.PI / 4;
    nose.position.set(0, 0.01, -1.02);
    this._addFallback(nose);

    const cockpit = new THREE.Mesh(
      new THREE.SphereGeometry(0.23, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.58),
      glass,
    );
    cockpit.position.set(0, 0.24, -0.38);
    cockpit.scale.set(0.7, 0.4, 1.05);
    this._addFallback(cockpit);

    this.fallbackRoot.scale.setScalar(FALLBACK_VISUAL_SCALE);
  }

  _buildReferenceShell() {
    const armorDark = new THREE.MeshStandardMaterial({
      color: 0x1a2a34,
      emissive: 0x061018,
      emissiveIntensity: 0.1,
      metalness: 0.58,
      roughness: 0.42,
      transparent: false,
      opacity: 1,
    });

    const armorMid = new THREE.MeshStandardMaterial({
      color: 0x304a56,
      emissive: 0x061d26,
      emissiveIntensity: 0.12,
      metalness: 0.52,
      roughness: 0.38,
      transparent: false,
      opacity: 1,
    });

    const armorGold = new THREE.MeshStandardMaterial({
      color: 0x6b3c08,
      emissive: COLORS.solarGold,
      emissiveIntensity: 0.58,
      metalness: 0.45,
      roughness: 0.3,
      transparent: false,
      opacity: 1,
    });

    const armorCyan = new THREE.MeshStandardMaterial({
      color: 0x08394a,
      emissive: COLORS.cyan,
      emissiveIntensity: 0.66,
      metalness: 0.36,
      roughness: 0.28,
      transparent: false,
      opacity: 1,
    });

    const canopyMaterial = new THREE.MeshStandardMaterial({
      color: 0x102b36,
      emissive: 0x009cc0,
      emissiveIntensity: 0.34,
      metalness: 0.42,
      roughness: 0.22,
      transparent: false,
      opacity: 1,
    });

    const shellMaterials = [armorDark, armorMid, armorGold, armorCyan, canopyMaterial];
    this.materials.push(...shellMaterials);

    this.referenceEnergyMaterials = [armorGold, armorCyan, canopyMaterial];
    armorGold.userData.referenceKind = 'gold';
    armorCyan.userData.referenceKind = 'cyan';
    canopyMaterial.userData.referenceKind = 'canopy';

    const shell = this.referenceShellRoot;
    shell.position.set(0, 0.07, -0.03);
    shell.scale.setScalar(0.82);

    const centralHull = this._createArmorPrism(
      [
        [-0.38, 1.15],
        [-0.52, 0.22],
        [-0.31, -0.98],
        [0, -1.55],
        [0.31, -0.98],
        [0.52, 0.22],
        [0.38, 1.15],
      ],
      0.3,
      armorDark,
    );
    centralHull.position.y = 0.05;
    shell.add(centralHull);

    const upperSpine = this._createArmorPrism(
      [
        [-0.22, 0.78],
        [-0.31, -0.38],
        [0, -1.37],
        [0.31, -0.38],
        [0.22, 0.78],
      ],
      0.24,
      armorMid,
    );
    upperSpine.position.y = 0.24;
    shell.add(upperSpine);

    const mirrorPoints = (points) => points.map(([x, z]) => [-x, z]).reverse();

    const innerWingPoints = [
      [-0.25, -0.7],
      [-0.72, -0.62],
      [-1.34, 0.2],
      [-1.18, 0.74],
      [-0.5, 0.4],
    ];

    const outerWingPoints = [
      [-0.62, -0.38],
      [-1.1, -0.12],
      [-1.88, 0.77],
      [-1.57, 1.23],
      [-0.85, 0.7],
    ];

    const cyanPanelPoints = [
      [-0.95, 0.04],
      [-1.52, 0.62],
      [-1.35, 0.82],
      [-0.86, 0.42],
    ];

    for (const side of [-1, 1]) {
      const innerPoints = side < 0 ? innerWingPoints : mirrorPoints(innerWingPoints);
      const outerPoints = side < 0 ? outerWingPoints : mirrorPoints(outerWingPoints);
      const panelPoints = side < 0 ? cyanPanelPoints : mirrorPoints(cyanPanelPoints);

      const innerWing = this._createArmorPrism(innerPoints, 0.18, armorMid);
      innerWing.position.y = 0.05;

      const outerWing = this._createArmorPrism(outerPoints, 0.16, armorDark);
      outerWing.position.y = -0.01;

      const cyanPanel = this._createArmorPrism(panelPoints, 0.055, armorCyan);
      cyanPanel.position.y = 0.11;

      const goldPanelPoints =
        side < 0
          ? [
              [-0.47, -0.45],
              [-0.68, -0.34],
              [-1.48, 0.72],
              [-1.34, 0.83],
              [-0.6, 0.05],
            ]
          : [
              [0.6, 0.05],
              [1.34, 0.83],
              [1.48, 0.72],
              [0.68, -0.34],
              [0.47, -0.45],
            ];

      const goldPanel = this._createArmorPrism(goldPanelPoints, 0.04, armorGold);
      goldPanel.position.y = 0.145;

      shell.add(innerWing, outerWing, cyanPanel, goldPanel);

      const sx = side < 0 ? -1 : 1;
      this._addEdgeBar(shell, [sx * 0.62, -0.38], [sx * 1.88, 0.77], 0.13, armorGold, 0.062, 0.052);
      this._addEdgeBar(shell, [sx * 0.92, 0.08], [sx * 1.46, 0.63], 0.15, armorCyan, 0.04, 0.04);

      const enginePod = this._createArmorPrism(
        side < 0
          ? [
              [-0.32, 0.18],
              [-0.62, 0.28],
              [-0.67, 1.22],
              [-0.37, 1.36],
              [-0.25, 0.78],
            ]
          : [
              [0.25, 0.78],
              [0.37, 1.36],
              [0.67, 1.22],
              [0.62, 0.28],
              [0.32, 0.18],
            ],
        0.26,
        armorDark,
      );
      enginePod.position.y = 0.12;
      shell.add(enginePod);

      const engineBell = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.3, 18), armorGold);
      engineBell.rotation.x = Math.PI / 2;
      engineBell.position.set(side * 0.47, 0.08, 1.3);
      shell.add(engineBell);
    }

    const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.28, 24, 12), canopyMaterial);
    canopy.position.set(0, 0.34, -0.47);
    canopy.scale.set(0.58, 0.34, 1.35);
    shell.add(canopy);

    this.baseEmissiveIntensities = this.materials.map((m) => m.emissiveIntensity);
    this.baseTransparency = this.materials.map((m) => m.transparent);
    this.baseOpacity = this.materials.map((m) => m.opacity);
  }

  _buildSharedEngineGlow() {
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: COLORS.cyan,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });

    const flameMaterial = new THREE.MeshBasicMaterial({
      color: COLORS.solarOrange,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });

    this.engineGlowMaterials = [glowMaterial, flameMaterial];

    const glowGeo = new THREE.CylinderGeometry(0.07, 0.1, 0.16, 12);
    const flameGeo = new THREE.ConeGeometry(0.055, 0.58, 12);

    // 3개 구슬 엔진이 짜쳐 보여서 2개 메인 엔진으로 정리.
    [-0.39, 0.39].forEach((x) => {
      const glow = new THREE.Mesh(glowGeo, glowMaterial);
      glow.rotation.x = Math.PI / 2;
      glow.position.set(x, 0.09, 1.08);
      glow.userData.enginePart = 'core';
      this.engineGlowGroup.add(glow);

      const flame = new THREE.Mesh(flameGeo, flameMaterial);
      flame.rotation.x = -Math.PI / 2;
      flame.position.set(x, 0.09, 1.42);
      flame.userData.enginePart = 'flame';
      this.engineGlowGroup.add(flame);
    });

    this.engineGlowGroup.visible = true;
  }

  setPalette(palette, hyperActive = false) {
    const enginePrimary = hyperActive ? 0xffffff : palette.primary ?? COLORS.cyan;
    const engineSecondary = hyperActive ? COLORS.solarOrange : palette.secondary ?? COLORS.solarOrange;

    if (this.engineGlowMaterials?.[0]) this.engineGlowMaterials[0].color.setHex(enginePrimary);
    if (this.engineGlowMaterials?.[1]) this.engineGlowMaterials[1].color.setHex(engineSecondary);
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
    this.laneMoveImpulse = direction * 1.15;
    this._updateTargetPosition();
  }

  update(
    delta,
    boostFactor,
    invincibleTime = 0,
    hitFlashTime = 0,
    hyperActive = false,
    combo = 0,
    hyperCharge = 0,
  ) {
    this.group.position.x = THREE.MathUtils.damp(this.group.position.x, this.targetPosition.x, 10, delta);
    this.group.position.y = THREE.MathUtils.damp(this.group.position.y, this.targetPosition.y, 10, delta);
    this.group.position.z = THREE.MathUtils.damp(this.group.position.z, this.targetPosition.z, 8, delta);

    const hover = Math.sin(performance.now() * 0.006) * 0.035;
    this.group.position.y += hover;

    this.laneMoveImpulse = THREE.MathUtils.damp(this.laneMoveImpulse, 0, 10, delta);

    const targetRoll = this._targetRoll() + this.laneMoveImpulse * 0.22;
    this.group.rotation.z = this._dampAngle(this.group.rotation.z, targetRoll, 10, delta);
    this.group.rotation.y = THREE.MathUtils.damp(this.group.rotation.y, this.laneMoveImpulse * 0.1, 8, delta);
    this.group.rotation.x = THREE.MathUtils.damp(this.group.rotation.x, -0.08, 7, delta);

    const comboFactor = Math.min(combo / 10, 1);
    const chargeFactor = THREE.MathUtils.clamp(hyperCharge / 100, 0, 1);
    const visualEnergy = hyperActive ? 1 : Math.max(comboFactor * 0.35, (chargeFactor - 0.5) * 2);
    const readyPulse = chargeFactor >= 0.9 ? 0.5 + Math.sin(performance.now() * 0.018) * 0.5 : 0;

    this._updateReferenceShellEnergy(boostFactor, visualEnergy, readyPulse, hyperActive, hitFlashTime);
    this._updateEngineGlow(boostFactor, hyperActive, readyPulse);
    this._updateDamageVisual(invincibleTime, hitFlashTime);
    this.updateHitBox();
  }

  _updateReferenceShellEnergy(boostFactor, visualEnergy, readyPulse, hyperActive, hitFlashTime) {
    if (!this.referenceEnergyMaterials) return;

    const energy = boostFactor * 0.22 + visualEnergy * 0.28 + readyPulse * 0.14 + (hyperActive ? 0.34 : 0);

    for (const material of this.referenceEnergyMaterials) {
      const kind = material.userData.referenceKind;
      const base = kind === 'gold' ? 0.42 : kind === 'cyan' ? 0.5 : 0.24;
      material.emissiveIntensity = base + energy * 0.46 + (hitFlashTime > 0 ? 0.32 : 0);
    }
  }

  _updateEngineGlow(boostFactor, hyperActive, readyPulse) {
    const glowOpacity = 0.18 + boostFactor * 0.05 + (hyperActive ? 0.12 : 0) + readyPulse * 0.025;
    const flameOpacity = 0.13 + boostFactor * 0.07 + (hyperActive ? 0.13 : 0) + readyPulse * 0.025;

    if (this.engineGlowMaterials?.[0]) this.engineGlowMaterials[0].opacity = Math.min(glowOpacity, 0.34);
    if (this.engineGlowMaterials?.[1]) this.engineGlowMaterials[1].opacity = Math.min(flameOpacity, 0.32);

    const flameScaleZ = 1 + boostFactor * 0.22 + (hyperActive ? 0.38 : 0);

    for (const child of this.engineGlowGroup.children) {
      if (child.userData.enginePart === 'flame') child.scale.set(1, flameScaleZ, 1);
      else child.scale.setScalar(1 + boostFactor * 0.08 + (hyperActive ? 0.12 : 0));
    }
  }

  _updateDamageVisual(invincibleTime, hitFlashTime) {
    const hitFlash = hitFlashTime > 0;

    // 핵심: 업데이트 중 fallbackRoot가 다시 켜지지 않게 고정.
    this.fallbackRoot.visible = false;
    this.modelRoot.visible = false;
    this.referenceShellRoot.visible = true;
    this.engineGlowGroup.visible = true;

    this.materials.forEach((material, index) => {
      material.transparent = false;
      material.opacity = 1;
      material.depthWrite = true;
      material.depthTest = true;
      material.blending = THREE.NormalBlending;
      material.emissiveIntensity = (this.baseEmissiveIntensities[index] ?? 0) + (hitFlash ? 0.62 : 0);
    });
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

  updateHitBox() {
    this.hitBox.setFromCenterAndSize(this.group.position, new THREE.Vector3(0.82, 0.58, 1.18));
  }
}