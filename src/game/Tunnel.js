import * as THREE from 'three';
import { COLORS, HYPER_PALETTE, LANE_COUNT, TUNNEL_PALETTES, getLaneAngle, getLanePosition } from './constants.js';

const MISSION_PALETTES = {
  hard: {
    primary: 0x00e5ff,
    secondary: 0xff31f7,
    accent: 0xffffff,
    obstacle: 0xff31f7,
    light: 0x00e5ff,
    fog: 0x080015,
    background: 0x050010,
  },
  elite: {
    primary: 0xffffff,
    secondary: 0xff31f7,
    accent: 0x00e5ff,
    obstacle: 0xffffff,
    light: 0xffffff,
    fog: 0x120018,
    background: 0x06000f,
  },
  failed: {
    primary: 0xff274f,
    secondary: 0xff8a00,
    accent: 0xffffff,
    obstacle: 0xff274f,
    light: 0xff274f,
    fog: 0x140208,
    background: 0x090106,
  },
};

export class Tunnel {
  constructor(scene) {
    this.group = new THREE.Group();
    this.rings = [];
    this.ringMaterials = [];
    this.accentMaterials = [];
    this.laneMarkers = [];
    this.railMaterials = [];
    this.streaks = [];
    this.streakMaterials = [];
    this.safeLaneMarkers = [];
    this.length = 14;
    this.spacing = 6;
    this.radius = 5.45;
    this.scene = scene;
    this.currentPaletteIndex = 0;
    this.currentPalette = TUNNEL_PALETTES[0];
    this.targetPalette = TUNNEL_PALETTES[0];
    this.displayPalette = { ...TUNNEL_PALETTES[0] };
    this.paletteFrom = TUNNEL_PALETTES[0];
    this.paletteTransitionTime = 0;
    this.paletteTransitionDuration = 0.75;
    this.isPaletteTransitioning = false;
    this.riftPulse = 0;
    this.hyperBlend = 0;
    this.missionBlend = 0;
    this.missionPulse = 0;
    this.missionTone = 'hard';
    this.visualMode = 'straight';
    this.visualModeTimer = 0;
    this._build();
    this.applyPaletteToMaterials(this.currentPalette);
    scene.add(this.group);
  }

  _neonMaterial(color, intensity = 2.2) {
    return new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: true, opacity: 1 });
  }

  _build() {
    const ringGeometry = new THREE.TorusGeometry(this.radius, 0.045, 8, 96);
    const accentGeometry = new THREE.TorusGeometry(this.radius * 0.82, 0.032, 8, 96, Math.PI * 1.18);
    const colors = [COLORS.magenta, COLORS.cyan, COLORS.purple];

    for (let i = 0; i < this.length; i += 1) {
      const ring = new THREE.Group();
      const mainMaterial = this._neonMaterial(colors[i % colors.length]);
      const main = new THREE.Mesh(ringGeometry, mainMaterial);
      main.rotation.z = i * 0.22;
      ring.add(main);
      this.ringMaterials.push(mainMaterial);

      const accentMaterial = this._neonMaterial(colors[(i + 1) % colors.length]);
      const accent = new THREE.Mesh(accentGeometry, accentMaterial);
      accent.rotation.z = i * 0.55;
      ring.add(accent);
      this.accentMaterials.push(accentMaterial);

      ring.position.z = -i * this.spacing;
      this.rings.push(ring);
      this.group.add(ring);
    }

    const railMaterialA = this._neonMaterial(COLORS.magenta);
    const railMaterialB = this._neonMaterial(COLORS.cyan);
    this.railMaterials.push(railMaterialA, railMaterialB);
    const railGeometry = new THREE.BoxGeometry(0.055, 0.055, this.length * this.spacing * 1.5);

    [-3.25, -1.08, 1.08, 3.25].forEach((x, index) => {
      const rail = new THREE.Mesh(railGeometry, index % 2 ? railMaterialB : railMaterialA);
      rail.position.set(x, -1.72, -this.length * this.spacing * 0.45);
      this.laneMarkers.push(rail);
      this.group.add(rail);
    });

    const safeMaterial = new THREE.MeshBasicMaterial({
      color: COLORS.cyan,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const safeGeometry = new THREE.BoxGeometry(0.34, 0.035, 18);
    for (let lane = 0; lane < LANE_COUNT; lane += 1) {
      const marker = new THREE.Mesh(safeGeometry, safeMaterial.clone());
      const position = getLanePosition(lane, -32);
      marker.position.set(position.x, position.y, position.z);
      marker.rotation.z = getLaneAngle(lane) + Math.PI / 2;
      this.safeLaneMarkers.push({ mesh: marker, timer: 0 });
      this.group.add(marker);
    }

    const starGeometry = new THREE.BufferGeometry();
    const positions = [];
    for (let i = 0; i < 500; i += 1) {
      const radius = 6 + Math.random() * 9;
      const angle = Math.random() * Math.PI * 2;
      positions.push(Math.cos(angle) * radius, Math.sin(angle) * radius, -Math.random() * 95);
    }
    // BufferGeometry stores vertex attributes that Three.js uploads to WebGL buffers.
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const stars = new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({
        color: COLORS.purple,
        size: 0.045,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.group.add(stars);
    this.stars = stars;
    this.starMaterial = stars.material;

    this._buildSpeedStreaks(colors);
  }

  _buildSpeedStreaks(colors) {
    const geometry = new THREE.BoxGeometry(0.045, 0.045, 1.7);
    const materials = colors.map((color) => this._neonMaterial(color));
    this.streakMaterials = materials;

    for (let i = 0; i < 58; i += 1) {
      const streak = new THREE.Mesh(geometry, materials[i % materials.length]);
      this._resetStreak(streak, -Math.random() * 100);
      this.streaks.push(streak);
      this.group.add(streak);
    }
  }

  _resetStreak(streak, z = -96 - Math.random() * 24) {
    const angle = Math.random() * Math.PI * 2;
    const bottomBias = Math.random() > 0.36;
    const radius = bottomBias ? 4.15 + Math.random() * 1.15 : 4.8 + Math.random() * 0.55;
    const yOffset = bottomBias ? -0.95 - Math.random() * 1.25 : 0;
    streak.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius + yOffset, z);
    streak.rotation.z = angle;
    streak.rotation.x = Math.random() * 0.35;
    streak.scale.z = 0.75 + Math.random() * 1.5;
  }

  setVisualMode(mode, duration = 0.8) {
    this.visualMode = mode;
    this.visualModeTimer = duration;
  }

  pulseMissionFeedback(tier) {
    this.missionTone = tier === 'elite' || tier === 'failed' ? tier : 'hard';
    this.missionPulse = tier === 'elite' ? 0.85 : 0.55;
  }

  highlightSafeLane(lane) {
    const marker = this.safeLaneMarkers[lane];
    if (!marker) return;
    marker.timer = 1.15;
    marker.mesh.material.opacity = 0.58;
  }

  getNextPaletteIndex() {
    return (this.currentPaletteIndex + 1 + Math.floor(Math.random() * (TUNNEL_PALETTES.length - 1))) % TUNNEL_PALETTES.length;
  }

  startPaletteTransition(nextIndex, duration = 0.75) {
    this.currentPaletteIndex = nextIndex;
    this.paletteFrom = { ...this.displayPalette };
    this.targetPalette = TUNNEL_PALETTES[nextIndex];
    this.paletteTransitionTime = 0;
    this.paletteTransitionDuration = duration;
    this.isPaletteTransitioning = true;
    this.riftPulse = 0.75;
    return this.targetPalette;
  }

  setTunnelPalette(index) {
    this.currentPaletteIndex = index;
    this.currentPalette = TUNNEL_PALETTES[index];
    this.targetPalette = this.currentPalette;
    this.displayPalette = { ...this.currentPalette };
    this.isPaletteTransitioning = false;
    this.applyPaletteToMaterials(this.displayPalette);
    return this.currentPalette;
  }

  updatePaletteTransition(delta, hyperActive = false, missionVisual = null) {
    if (this.isPaletteTransitioning) {
      this.paletteTransitionTime += delta;
      const t = THREE.MathUtils.smoothstep(
        Math.min(this.paletteTransitionTime / this.paletteTransitionDuration, 1),
        0,
        1,
      );
      this.displayPalette = this._lerpPalette(this.paletteFrom, this.targetPalette, t);
      if (t >= 1) {
        this.currentPalette = this.targetPalette;
        this.displayPalette = { ...this.targetPalette };
        this.isPaletteTransitioning = false;
      }
    }

    this.riftPulse = Math.max(this.riftPulse - delta, 0);
    this.missionPulse = Math.max(this.missionPulse - delta, 0);
    this.hyperBlend = THREE.MathUtils.damp(this.hyperBlend, hyperActive ? 0.72 : 0, 5, delta);
    // Palette interpolation turns gameplay state into material color changes without a hard cut.
    const targetMissionBlend =
      (missionVisual?.eliteActive ? 0.22 : missionVisual?.intensity ? missionVisual.intensity * 0.12 : 0) +
      (missionVisual?.urgent ? 0.045 : 0);
    this.missionBlend = THREE.MathUtils.damp(this.missionBlend, targetMissionBlend + this.missionPulse * 0.18, 4, delta);
    let palette = this.hyperBlend > 0.01 ? this._lerpPalette(this.displayPalette, HYPER_PALETTE, this.hyperBlend) : this.displayPalette;
    if (this.missionBlend > 0.01) {
      const missionPalette = MISSION_PALETTES[this.missionTone] ?? MISSION_PALETTES.hard;
      palette = this._lerpPalette(palette, missionPalette, Math.min(this.missionBlend, 0.38));
    }
    this.applyPaletteToMaterials(palette);
    return palette;
  }

  applyPaletteToMaterials(palette) {
    const primary = new THREE.Color(palette.primary);
    const secondary = new THREE.Color(palette.secondary);
    const accent = new THREE.Color(palette.accent);
    const pulse = this.riftPulse > 0 ? this.riftPulse * 0.55 : 0;

    // Material color interpolation is the visible palette transition across tunnel meshes.
    this.ringMaterials.forEach((material, index) => {
      material.color.copy(index % 2 ? secondary : primary).lerp(accent, pulse);
    });
    this.accentMaterials.forEach((material, index) => {
      material.color.copy(index % 2 ? accent : secondary).lerp(primary, pulse * 0.7);
    });
    this.railMaterials.forEach((material, index) => {
      material.color.copy(index % 2 ? primary : secondary);
    });
    this.streakMaterials.forEach((material, index) => {
      material.color.copy(index % 3 === 0 ? primary : index % 3 === 1 ? secondary : accent);
    });
    for (const marker of this.safeLaneMarkers) marker.mesh.material.color.copy(accent);
    if (this.starMaterial) this.starMaterial.color.copy(secondary);
  }

  _lerpPalette(from, to, t) {
    const result = { ...to };
    for (const key of ['primary', 'secondary', 'accent', 'obstacle', 'light', 'fog', 'background']) {
      result[key] = new THREE.Color(from[key]).lerp(new THREE.Color(to[key]), t).getHex();
    }
    return result;
  }

  update(delta, speed, hyper = 0) {
    const movement = speed * delta;
    for (const ring of this.rings) {
      // Geometry transformation: advancing position.z and rotation.z moves mesh vertices
      // through the camera view while the GPU applies model-view-projection matrices.
      ring.position.z += movement;
      ring.rotation.z += delta * (0.12 + hyper * 0.34);
      if (ring.position.z > 8) {
        ring.position.z -= this.length * this.spacing;
      }
    }

    for (const rail of this.laneMarkers) {
      rail.material.opacity = 0.85;
      rail.position.z += movement;
      if (rail.position.z > 4) {
        rail.position.z -= this.length * this.spacing * 0.5;
      }
    }

    for (const streak of this.streaks) {
      streak.position.z += movement * (1.85 + hyper * 0.6);
      streak.scale.z = THREE.MathUtils.damp(streak.scale.z, hyper ? 2.4 : 1.25, 3, delta);
      if (streak.position.z > 9) this._resetStreak(streak);
    }

    for (const marker of this.safeLaneMarkers) {
      marker.timer = Math.max(marker.timer - delta, 0);
      marker.mesh.material.opacity = THREE.MathUtils.damp(marker.mesh.material.opacity, marker.timer > 0 ? 0.36 : 0, 6, delta);
      marker.mesh.position.z += movement;
      if (marker.mesh.position.z > 2) marker.mesh.position.z = -38;
    }

    if (this.stars) {
      const position = this.stars.geometry.attributes.position;
      for (let i = 2; i < position.array.length; i += 3) {
        position.array[i] += movement * 0.9;
        if (position.array[i] > 8) position.array[i] = -95;
      }
      position.needsUpdate = true;
    }

    if (this.visualMode !== 'straight') {
      this.visualModeTimer = Math.max(this.visualModeTimer - delta, 0);
      if (this.visualModeTimer <= 0) this.visualMode = 'straight';
    }
  }
}
