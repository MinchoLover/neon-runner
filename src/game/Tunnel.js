import * as THREE from 'three';
import { 
  COLORS, 
  HYPER_PALETTE, 
  LANE_COUNT, 
  TUNNEL_PALETTES,
  SOLAR_CORE_BASE_INTENSITY,
  SOLAR_CORE_SURGE_INTENSITY,
  getLaneAngle, 
  getLanePosition 
} from './constants.js';

const MISSION_PALETTES = {
  hard: {
    primary: 0x00e5ff,
    secondary: 0xffb700,
    accent: 0xffffff,
    obstacle: 0xffb700,
    light: 0x00e5ff,
    fog: 0x010206,
    background: 0x020308,
  },
  elite: {
    primary: 0xffffff,
    secondary: 0xffb700,
    accent: 0x00e5ff,
    obstacle: 0xffffff,
    light: 0xffffff,
    fog: 0x020305,
    background: 0x030408,
  },
  failed: {
    primary: 0xff6200,
    secondary: 0x00e5ff,
    accent: 0xffffff,
    obstacle: 0xff6200,
    light: 0xff6200,
    fog: 0x080101,
    background: 0x0a0101,
  },
};

const WAVE_PALETTES = {
  pressure: {
    primary: 0xffb700,
    secondary: 0xff6200,
    accent: 0xffffff,
    obstacle: 0xff6200,
    light: 0xffb700,
    fog: 0x030201,
    background: 0x040301,
  },
  risk: {
    primary: 0x0055ff,
    secondary: 0x00e5ff,
    accent: 0xffb700,
    obstacle: 0x00e5ff,
    light: 0x0055ff,
    fog: 0x010208,
    background: 0x02030a,
  },
  rift: {
    primary: 0xff6200,
    secondary: 0x00e5ff,
    accent: 0xffffff,
    obstacle: 0xff6200,
    light: 0xff6200,
    fog: 0x080101,
    background: 0x0a0101,
  },
  cooldown: {
    primary: 0xffffff,
    secondary: 0x00e5ff,
    accent: 0xffb700,
    obstacle: 0x00e5ff,
    light: 0xffffff,
    fog: 0x020305,
    background: 0x030408,
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
    this.waveBlend = 0;
    this.wavePulse = 0;
    this.waveState = { name: 'warmup', intensity: 0, progress: 0 };
    
    this._buildSolarCore();
    this._build();
    this.applyPaletteToMaterials(this.currentPalette);
    scene.add(this.group);
  }

  _buildSolarCore() {
    this.solarCoreGroup = new THREE.Group();
    this.solarCoreGroup.position.set(0, 0, -110);

    const coreGeometry = new THREE.CircleGeometry(8, 32);
    this.solarCoreMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    this.solarCore = new THREE.Mesh(coreGeometry, this.solarCoreMaterial);
    
    const haloGeometry = new THREE.CircleGeometry(16, 32);
    this.solarHaloMaterial = new THREE.MeshBasicMaterial({
      color: COLORS.solarOrange,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    this.solarHalo = new THREE.Mesh(haloGeometry, this.solarHaloMaterial);

    this.solarCoreGroup.add(this.solarCore);
    this.solarCoreGroup.add(this.solarHalo);
    this.group.add(this.solarCoreGroup);
  }

  _neonMaterial(color, intensity = 2.2) {
    return new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: true, opacity: 1 });
  }

  _build() {
    const ringGeometry = new THREE.TorusGeometry(this.radius, 0.015, 8, 96);
    const accentGeometry = new THREE.TorusGeometry(this.radius * 0.82, 0.012, 8, 96, Math.PI * 1.18);
    const colors = [COLORS.solarGold, COLORS.cyan, COLORS.solarOrange];

    for (let i = 0; i < this.length; i += 1) {
      const ring = new THREE.Group();
      const mainMaterial = this._neonMaterial(colors[i % colors.length]);
      mainMaterial.opacity = 0.35;
      const main = new THREE.Mesh(ringGeometry, mainMaterial);
      main.rotation.z = i * 0.22;
      ring.add(main);
      this.ringMaterials.push(mainMaterial);

      const accentMaterial = this._neonMaterial(colors[(i + 1) % colors.length]);
      accentMaterial.opacity = 0.45;
      const accent = new THREE.Mesh(accentGeometry, accentMaterial);
      accent.rotation.z = i * 0.55;
      ring.add(accent);
      this.accentMaterials.push(accentMaterial);

      ring.position.z = -i * this.spacing;
      this.rings.push(ring);
      this.group.add(ring);
    }

    const railMaterialA = this._neonMaterial(COLORS.solarGold);
    const railMaterialB = this._neonMaterial(COLORS.cyan);
    this.railMaterials.push(railMaterialA, railMaterialB);
    const railGeometry = new THREE.BoxGeometry(0.15, 0.1, this.length * this.spacing * 1.5);

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
    for (let i = 0; i < LANE_COUNT; i += 1) {
      const position = getLanePosition(i, -2);
      const mesh = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.08, 8, 32), safeMaterial.clone());
      mesh.position.set(position.x, position.y + 0.22, position.z);
      mesh.scale.y = 0.62;
      this.group.add(mesh);
      this.safeLaneMarkers.push({ mesh, timer: 0 });
    }

    const starGeometry = new THREE.BufferGeometry();
    const starCount = 350;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const r = this.radius + 3 + Math.random() * 8;
      positions[i * 3] = Math.cos(angle) * r;
      positions[i * 3 + 1] = Math.sin(angle) * r;
      positions[i * 3 + 2] = -95 + Math.random() * 105;
    }
    starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const stars = new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({ color: COLORS.white, size: 0.12, transparent: true, opacity: 0.42 }),
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

    for (let i = 0; i < 60; i += 1) {
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

  pulseMissionFeedback(tier) {
    this.missionTone = tier === 'elite' || tier === 'failed' ? tier : 'hard';
    this.missionPulse = tier === 'elite' ? 0.85 : 0.55;
  }

  setWaveFeedback(wave) {
    this.waveState = wave;
    this.wavePulse = wave.name === 'cooldown' ? 0.15 : 0.45;
  }

  highlightSafeLane(lane, intensity = 1) {
    const marker = this.safeLaneMarkers[lane];
    if (!marker) return;
    marker.timer = 1.15 * intensity;
    marker.mesh.material.opacity = Math.min(0.72, 0.58 * intensity);
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

  updatePaletteTransition(delta, hyperActive = false, missionVisual = null, wave = null) {
    this.riftPulse = Math.max(this.riftPulse - delta * 1.8, 0);
    this.missionPulse = Math.max(this.missionPulse - delta * 1.5, 0);
    this.wavePulse = Math.max(this.wavePulse - delta * 0.8, 0);

    const missionIntensity = missionVisual?.intensity ?? 0;
    const isElite = missionVisual?.eliteActive ?? false;
    const missionTarget = isElite ? 1 : missionIntensity * 0.45;
    this.missionBlend = THREE.MathUtils.damp(this.missionBlend, missionTarget + this.missionPulse * 0.35, 3, delta);

    const waveTarget = wave ? (wave.name === 'risk' || wave.name === 'rift' ? 0.65 : wave.name === 'pressure' ? 0.35 : wave.name === 'cooldown' ? 0.45 : 0) : 0;
    this.waveBlend = THREE.MathUtils.damp(this.waveBlend, waveTarget + this.wavePulse * 0.25, 2, delta);

    if (this.isPaletteTransitioning) {
      this.paletteTransitionTime += delta;
      const progress = Math.min(this.paletteTransitionTime / this.paletteTransitionDuration, 1);
      const ease = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      this.displayPalette.primary = new THREE.Color(this.paletteFrom.primary).lerp(new THREE.Color(this.targetPalette.primary), ease).getHex();
      this.displayPalette.secondary = new THREE.Color(this.paletteFrom.secondary).lerp(new THREE.Color(this.targetPalette.secondary), ease).getHex();
      this.displayPalette.accent = new THREE.Color(this.paletteFrom.accent).lerp(new THREE.Color(this.targetPalette.accent), ease).getHex();
      this.displayPalette.obstacle = new THREE.Color(this.paletteFrom.obstacle).lerp(new THREE.Color(this.targetPalette.obstacle), ease).getHex();
      this.displayPalette.light = new THREE.Color(this.paletteFrom.light).lerp(new THREE.Color(this.targetPalette.light), ease).getHex();
      this.displayPalette.fog = new THREE.Color(this.paletteFrom.fog).lerp(new THREE.Color(this.targetPalette.fog), ease).getHex();
      this.displayPalette.background = new THREE.Color(this.paletteFrom.background).lerp(new THREE.Color(this.targetPalette.background), ease).getHex();

      if (progress >= 1) {
        this.isPaletteTransitioning = false;
        this.currentPalette = this.targetPalette;
      }
    } else {
      this.displayPalette = { ...this.currentPalette };
    }

    this.hyperBlend = THREE.MathUtils.damp(this.hyperBlend, hyperActive ? 1 : 0, 6, delta);

    const finalPalette = { ...this.displayPalette };
    if (this.hyperBlend > 0.01) {
      this._blendPalette(finalPalette, HYPER_PALETTE, this.hyperBlend);
    }
    if (this.missionBlend > 0.01) {
      const missionPal = MISSION_PALETTES[this.missionTone] ?? MISSION_PALETTES.hard;
      this._blendPalette(finalPalette, missionPal, this.missionBlend);
    }
    if (this.waveBlend > 0.01 && wave) {
      const wavePal = WAVE_PALETTES[wave.name] ?? WAVE_PALETTES.pressure;
      this._blendPalette(finalPalette, wavePal, this.waveBlend);
    }

    if (this.riftPulse > 0.01) {
      finalPalette.primary = new THREE.Color(finalPalette.primary).lerp(new THREE.Color(0xffffff), this.riftPulse * 0.8).getHex();
      finalPalette.light = new THREE.Color(finalPalette.light).lerp(new THREE.Color(0xffffff), this.riftPulse * 0.6).getHex();
    }

    this.applyPaletteToMaterials(finalPalette);
    return finalPalette;
  }

  _blendPalette(base, overlay, alpha) {
    base.primary = new THREE.Color(base.primary).lerp(new THREE.Color(overlay.primary), alpha).getHex();
    base.secondary = new THREE.Color(base.secondary).lerp(new THREE.Color(overlay.secondary), alpha).getHex();
    base.accent = new THREE.Color(base.accent).lerp(new THREE.Color(overlay.accent), alpha).getHex();
    base.obstacle = new THREE.Color(base.obstacle).lerp(new THREE.Color(overlay.obstacle), alpha).getHex();
    base.light = new THREE.Color(base.light).lerp(new THREE.Color(overlay.light), alpha).getHex();
    base.fog = new THREE.Color(base.fog).lerp(new THREE.Color(overlay.fog), alpha).getHex();
    base.background = new THREE.Color(base.background).lerp(new THREE.Color(overlay.background), alpha).getHex();
  }

  applyPaletteToMaterials(palette) {
    const isHyper = this.hyperBlend > 0.5;
    for (let i = 0; i < this.ringMaterials.length; i += 1) {
      const mat = this.ringMaterials[i];
      if (palette.bias === 'hyper') mat.color.setHex(i % 2 === 0 ? palette.primary : palette.accent);
      else if (palette.bias === 'fast') mat.color.setHex(i % 3 === 0 ? palette.primary : palette.secondary);
      else mat.color.setHex(i % 2 === 0 ? palette.primary : palette.secondary);
    }
    for (let i = 0; i < this.accentMaterials.length; i += 1) {
      const mat = this.accentMaterials[i];
      if (palette.bias === 'hyper') mat.color.setHex(palette.secondary);
      else mat.color.setHex(i % 3 === 0 ? palette.accent : palette.secondary);
    }
    if (this.railMaterials.length >= 2) {
      this.railMaterials[0].color.setHex(palette.primary);
      this.railMaterials[1].color.setHex(palette.secondary);
    }
    for (let i = 0; i < this.streakMaterials.length; i += 1) {
      const mat = this.streakMaterials[i];
      if (isHyper) mat.color.setHex(i % 2 === 0 ? palette.primary : 0xffffff);
      else mat.color.setHex(i % 3 === 0 ? palette.accent : i % 2 === 0 ? palette.primary : palette.secondary);
    }
    if (this.starMaterial) {
      this.starMaterial.color.setHex(isHyper ? palette.primary : COLORS.white);
      this.starMaterial.opacity = isHyper ? 0.72 : 0.42;
    }
  }

  update(delta, speed, hyper = 0, wave = null) {
    if (wave) this.waveState = wave;
    this.group.rotation.z = THREE.MathUtils.damp(this.group.rotation.z, 0, 6, delta);
    const movement = speed * delta;
    const waveMotion = this.waveState?.name === 'pressure' || this.waveState?.name === 'risk' ? 0.25 : this.waveState?.name === 'cooldown' ? -0.14 : 0;
    
    for (const ring of this.rings) {
      ring.position.z += movement;
      ring.rotation.z += delta * (0.12 + hyper * 0.34);
      if (ring.position.z > 8) {
        ring.position.z -= this.length * this.spacing;
      }
    }

    for (const rail of this.laneMarkers) {
      rail.material.opacity = 0.64;
      rail.position.z += movement;
      if (rail.position.z > 4) {
        rail.position.z -= this.length * this.spacing * 0.5;
      }
    }

    for (const streak of this.streaks) {
      streak.position.z += movement * (1.55 + hyper * 0.45 + waveMotion);
      streak.scale.z = THREE.MathUtils.damp(streak.scale.z, hyper ? 1.9 : 1.05 + Math.max(waveMotion, 0) * 0.55, 3, delta);
      if (streak.position.z > 9) this._resetStreak(streak);
    }

    for (const marker of this.safeLaneMarkers) {
      marker.timer = Math.max(marker.timer - delta, 0);
      marker.mesh.material.opacity = THREE.MathUtils.damp(marker.mesh.material.opacity, marker.timer > 0 ? 0.24 : 0, 6, delta);
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

    if (this.solarCoreGroup) {
      const targetIntensity = hyper > 0 ? SOLAR_CORE_SURGE_INTENSITY : SOLAR_CORE_BASE_INTENSITY;
      this.solarCoreMaterial.opacity = THREE.MathUtils.damp(this.solarCoreMaterial.opacity, targetIntensity, 3, delta);
      this.solarHaloMaterial.opacity = THREE.MathUtils.damp(this.solarHaloMaterial.opacity, targetIntensity * 0.5 + Math.sin(performance.now() * 0.005) * 0.1, 3, delta);
      
      const pulseScale = hyper > 0 ? 1.2 + Math.sin(performance.now() * 0.02) * 0.05 : 1.0;
      this.solarCoreGroup.scale.setScalar(THREE.MathUtils.damp(this.solarCoreGroup.scale.x, pulseScale, 4, delta));
      this.solarHalo.rotation.z += delta * 0.1;
    }
  }
}
