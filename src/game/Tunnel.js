import * as THREE from 'three';
import {
  COLORS, 
  HYPER_PALETTE, 
  LANE_COUNT, 
  TUNNEL_PALETTES,
  TUNNEL_VISUALS,
  SOLAR_CORE_BASE_INTENSITY,
  SOLAR_CORE_SURGE_INTENSITY,
  getLaneAngle, 
  getLanePosition 
} from './constants.js';

const CYAN_HIGHLIGHT = new THREE.Color(0x79efff);
const GOLD_HIGHLIGHT = new THREE.Color(0xffe083);

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
    this.railDashes = [];
    this.guideRails = [];
    this.wallPanelMaterials = [];
    this.wallLightMaterials = [];
    this.streaks = [];
    this.streakMaterials = [];
    this.safeLaneMarkers = [];
    this.length = TUNNEL_VISUALS.ringCount;
    this.spacing = TUNNEL_VISUALS.ringSpacing;
    this.radius = TUNNEL_VISUALS.radius;
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
    this.paletteCyan = new THREE.Color();
    this.paletteGold = new THREE.Color();
    this.wallUniforms = null;
    
    this._buildSolarCore();
    this._build();
    this.applyPaletteToMaterials(this.currentPalette);
    scene.add(this.group);
  }


  _buildSolarCore() {
    this.solarCoreGroup = new THREE.Group();
    this.solarCoreGroup.position.set(0, 0.15, TUNNEL_VISUALS.solarCoreZ);

    const coreGeometry = new THREE.CircleGeometry(1.72, 64);
    this.solarCoreMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.98,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      depthWrite: false,
      fog: false,
    });
    this.solarCore = new THREE.Mesh(coreGeometry, this.solarCoreMaterial);
    this.solarCore.position.z = 0.36;

    const innerGlowGeometry = new THREE.CircleGeometry(4.2, 72);
    this.solarInnerMaterial = new THREE.MeshBasicMaterial({
      color: COLORS.solarGold,
      transparent: true,
      opacity: 0.52,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      depthWrite: false,
      fog: false,
    });
    this.solarInnerGlow = new THREE.Mesh(innerGlowGeometry, this.solarInnerMaterial);
    this.solarInnerGlow.position.z = 0.28;

    const midGlowGeometry = new THREE.CircleGeometry(6.8, 72);
    this.solarMidMaterial = new THREE.MeshBasicMaterial({
      color: COLORS.solarGold,
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      depthWrite: false,
      fog: false,
    });
    this.solarMidGlow = new THREE.Mesh(midGlowGeometry, this.solarMidMaterial);
    this.solarMidGlow.position.z = 0.2;

    const haloGeometry = new THREE.CircleGeometry(10.8, 96);
    this.solarHaloMaterial = new THREE.MeshBasicMaterial({
      color: COLORS.solarOrange,
      transparent: true,
      opacity: 0.105,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      depthWrite: false,
      fog: false,
    });
    this.solarHalo = new THREE.Mesh(haloGeometry, this.solarHaloMaterial);
    this.solarHalo.position.z = 0.12;

    this.solarCoronaMaterial = new THREE.MeshBasicMaterial({
      color: COLORS.solarGold,
      transparent: true,
      opacity: 0.56,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      depthWrite: false,
      fog: false,
    });
    this.solarCorona = new THREE.Mesh(new THREE.TorusGeometry(4.95, 0.085, 8, 96), this.solarCoronaMaterial);
    this.solarCorona.position.z = 0.34;

    this.solarOuterCoronaMaterial = new THREE.MeshBasicMaterial({
      color: COLORS.solarOrange,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      depthWrite: false,
      fog: false,
    });
    this.solarOuterCorona = new THREE.Mesh(new THREE.TorusGeometry(7.05, 0.045, 8, 96), this.solarOuterCoronaMaterial);
    this.solarOuterCorona.position.z = 0.24;

    const rayGeometry = new THREE.BoxGeometry(0.045, 2.55, 0.02);
    this.solarRayMaterial = new THREE.MeshBasicMaterial({
      color: COLORS.solarGold,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      depthWrite: false,
      fog: false,
    });

    this.solarRays = new THREE.Group();
    for (let i = 0; i < 28; i += 1) {
      const angle = (i / 28) * Math.PI * 2;
      const ray = new THREE.Mesh(rayGeometry, this.solarRayMaterial);
      ray.position.set(Math.cos(angle) * 7.4, Math.sin(angle) * 7.4, 0.16);
      ray.rotation.z = angle - Math.PI / 2;
      ray.scale.y = i % 7 === 0 ? 1.45 : i % 3 === 0 ? 0.95 : 0.48;
      this.solarRays.add(ray);
    }

    this.solarCoreGroup.add(
      this.solarHalo,
      this.solarRays,
      this.solarOuterCorona,
      this.solarCorona,
      this.solarMidGlow,
      this.solarInnerGlow,
      this.solarCore,
    );

    this.group.add(this.solarCoreGroup);
  }


  _neonMaterial(color, intensity = 2.2) {
    const material = new THREE.MeshBasicMaterial({
      color,
      toneMapped: false,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    material.userData.intensity = intensity;
    return material;
  }


  _build() {
    const colors = [COLORS.cyan, COLORS.solarGold, COLORS.solarOrange];

    // 1) Cinematic tunnel rings: fewer noisy panels, stronger readable silhouettes.
    const ringGeometry = new THREE.TorusGeometry(this.radius, 0.045, 8, 128);
    const innerRingGeometry = new THREE.TorusGeometry(this.radius * 0.86, 0.018, 8, 128);
    const outerRingGeometry = new THREE.TorusGeometry(this.radius * 1.075, 0.018, 8, 128);
    const accentArcGeometry = new THREE.TorusGeometry(this.radius * 0.97, 0.075, 8, 96, Math.PI * 0.42);
    const smallArcGeometry = new THREE.TorusGeometry(this.radius * 0.74, 0.038, 8, 72, Math.PI * 0.34);
    const ribGeometry = new THREE.BoxGeometry(0.055, 0.17, 1.05);
    const ribGlowGeometry = new THREE.BoxGeometry(0.035, 0.065, 1.5);

    for (let i = 0; i < this.length; i += 1) {
      const ring = new THREE.Group();

      const mainMaterial = this._neonMaterial(i % 4 === 0 ? COLORS.solarGold : COLORS.cyan);
      mainMaterial.userData.channel = i % 4 === 0 ? 'gold' : 'cyan';
      mainMaterial.opacity = i % 4 === 0 ? 0.58 : 0.42;

      const main = new THREE.Mesh(ringGeometry, mainMaterial);
      main.rotation.z = i * 0.08;
      ring.add(main);
      this.ringMaterials.push(mainMaterial);

      const innerMaterial = this._neonMaterial(i % 3 === 0 ? COLORS.solarGold : COLORS.cyan);
      innerMaterial.userData.channel = i % 3 === 0 ? 'gold' : 'cyan';
      innerMaterial.opacity = 0.16;

      const innerRing = new THREE.Mesh(innerRingGeometry, innerMaterial);
      innerRing.rotation.z = -i * 0.05;
      ring.add(innerRing);
      this.ringMaterials.push(innerMaterial);

      const outerMaterial = this._neonMaterial(i % 5 === 0 ? COLORS.solarOrange : COLORS.cyan);
      outerMaterial.userData.channel = i % 5 === 0 ? 'orange' : 'cyan';
      outerMaterial.opacity = i % 5 === 0 ? 0.16 : 0.11;

      const outerRing = new THREE.Mesh(outerRingGeometry, outerMaterial);
      outerRing.rotation.z = i * 0.04;
      ring.add(outerRing);
      this.accentMaterials.push(outerMaterial);

      // Big asymmetric arcs make the tunnel look designed, not randomly tiled.
      for (let a = 0; a < 2; a += 1) {
        const arcMaterial = this._neonMaterial(a === 0 ? COLORS.solarGold : COLORS.cyan);
        arcMaterial.userData.channel = a === 0 ? 'gold' : 'cyan';
        arcMaterial.opacity = i % 3 === 0 ? 0.5 : 0.28;

        const arc = new THREE.Mesh(accentArcGeometry, arcMaterial);
        arc.rotation.z = i * 0.42 + a * Math.PI + (i % 2) * 0.28;
        ring.add(arc);
        this.accentMaterials.push(arcMaterial);
      }

      // Inner rotating technical arcs.
      for (let a = 0; a < 2; a += 1) {
        const smallArcMaterial = this._neonMaterial(a === 0 ? COLORS.cyan : COLORS.solarGold);
        smallArcMaterial.userData.channel = a === 0 ? 'cyan' : 'gold';
        smallArcMaterial.opacity = 0.18;

        const smallArc = new THREE.Mesh(smallArcGeometry, smallArcMaterial);
        smallArc.rotation.z = -i * 0.31 + a * Math.PI * 0.82;
        ring.add(smallArc);
        this.accentMaterials.push(smallArcMaterial);
      }

      // A few large structural ribs instead of many tiny wall plates.
      const ribCount = 8;
      for (let segment = 0; segment < ribCount; segment += 1) {
        const angle = (segment / ribCount) * Math.PI * 2 + i * 0.08;
        const isBottom = Math.sin(angle) < -0.25;
        const ribMaterial = this._neonMaterial(segment % 2 === 0 ? COLORS.cyan : COLORS.solarGold);
        ribMaterial.userData.channel = segment % 2 === 0 ? 'cyan' : 'gold';
        ribMaterial.opacity = isBottom ? 0.18 : 0.08;

        const rib = new THREE.Mesh(ribGeometry, ribMaterial);
        rib.position.set(Math.cos(angle) * this.radius * 0.98, Math.sin(angle) * this.radius * 0.98, 0.05);
        rib.rotation.set(0, 0, angle + Math.PI / 2);
        rib.scale.set(isBottom ? 1.6 : 0.9, 1, isBottom ? 1.25 : 0.85);
        ring.add(rib);
        this.wallLightMaterials.push(ribMaterial);

        if (segment % 2 === 0) {
          const glow = new THREE.Mesh(ribGlowGeometry, ribMaterial);
          glow.position.set(Math.cos(angle) * this.radius * 0.82, Math.sin(angle) * this.radius * 0.82, 0.08);
          glow.rotation.set(0, 0, angle + Math.PI / 2);
          glow.scale.set(0.75, 1, 1);
          ring.add(glow);
        }
      }

      ring.position.z = -i * this.spacing;
      this.rings.push(ring);
      this.group.add(ring);
    }

    // 2) Solar highway deck: readable 3-lane road, more premium and less noisy.
    const deckMaterial = new THREE.MeshStandardMaterial({
      color: 0x02080d,
      emissive: 0x021018,
      emissiveIntensity: 0.24,
      metalness: 0.82,
      roughness: 0.32,
      transparent: true,
      opacity: 0.9,
    });

    const laneDeckGeometry = new THREE.BoxGeometry(2.55, 0.055, TUNNEL_VISUALS.wallLength);
    for (const x of [-3, 0, 3]) {
      const deck = new THREE.Mesh(laneDeckGeometry, deckMaterial);
      deck.position.set(x, -2.34, -52);
      this.group.add(deck);
    }

    const railGeometry = new THREE.BoxGeometry(0.08, 0.085, TUNNEL_VISUALS.wallLength);
    const railGlowGeometry = new THREE.BoxGeometry(0.25, 0.03, TUNNEL_VISUALS.wallLength);
    const sideRailGeometry = new THREE.BoxGeometry(0.12, 0.16, TUNNEL_VISUALS.wallLength);

    const railPositions = [-4.38, -1.5, 1.5, 4.38];
    railPositions.forEach((x, index) => {
      const channel = index === 0 || index === railPositions.length - 1 ? 'gold' : 'cyan';

      const railMaterial = this._neonMaterial(channel === 'gold' ? COLORS.solarGold : COLORS.cyan);
      railMaterial.userData.channel = channel;
      railMaterial.opacity = channel === 'gold' ? 0.82 : 0.76;

      const glowMaterial = this._neonMaterial(channel === 'gold' ? COLORS.solarOrange : COLORS.cyan);
      glowMaterial.userData.channel = channel;
      glowMaterial.opacity = channel === 'gold' ? 0.12 : 0.1;

      this.railMaterials.push(railMaterial, glowMaterial);

      const rail = new THREE.Mesh(railGeometry, railMaterial);
      const glow = new THREE.Mesh(railGlowGeometry, glowMaterial);
      rail.position.set(x, -2.2, -52);
      glow.position.copy(rail.position);

      this.laneMarkers.push(rail);
      this.group.add(glow, rail);
    });

    // Outer guard rails make the scene look like a track, not just a void.
    for (const x of [-5.18, 5.18]) {
      const mat = this._neonMaterial(COLORS.solarGold);
      mat.userData.channel = 'gold';
      mat.opacity = 0.24;

      const sideRail = new THREE.Mesh(sideRailGeometry, mat);
      sideRail.position.set(x, -1.92, -52);
      this.guideRails.push(sideRail);
      this.railMaterials.push(mat);
      this.group.add(sideRail);
    }

    // Flow dashes on lane center, long and clean.
    const dashGeometry = new THREE.BoxGeometry(0.12, 0.055, 1.75);
    for (let lane = 0; lane < LANE_COUNT; lane += 1) {
      const x = [-3, 0, 3][lane];
      for (let i = 0; i < 22; i += 1) {
        const material = this._neonMaterial(i % 6 === 0 ? COLORS.solarGold : COLORS.cyan);
        material.opacity = i % 6 === 0 ? 0.48 : 0.24;
        material.userData.channel = i % 6 === 0 ? 'gold' : 'cyan';

        const dash = new THREE.Mesh(dashGeometry, material);
        dash.position.set(x, -2.14, -i * 5.4 - lane * 1.15);
        dash.scale.z = i % 6 === 0 ? 1.35 : 1;
        this.railDashes.push(dash);
        this.railMaterials.push(material);
        this.group.add(dash);
      }
    }

    // Subtle lane edge glow below the player area.
    const guideGeometry = new THREE.BoxGeometry(0.035, 0.035, TUNNEL_VISUALS.wallLength);
    for (const x of [-3, 0, 3]) {
      const mat = this._neonMaterial(COLORS.cyan);
      mat.userData.channel = 'cyan';
      mat.userData.baseOpacity = 0.18;
      mat.opacity = 0.18;

      const guide = new THREE.Mesh(guideGeometry, mat);
      guide.position.set(x, -2.05, -52);
      this.guideRails.push(guide);
      this.railMaterials.push(mat);
      this.group.add(guide);
    }

    // 3) Safe lane marker remains gameplay-readable but not visually loud.
    const safeMaterial = new THREE.MeshBasicMaterial({
      color: COLORS.cyan,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      depthWrite: false,
    });

    for (let i = 0; i < LANE_COUNT; i += 1) {
      const position = getLanePosition(i, -2);
      const mesh = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.055, 8, 40), safeMaterial.clone());
      mesh.position.set(position.x, position.y + 0.34, position.z);
      mesh.scale.y = 0.58;
      this.group.add(mesh);
      this.safeLaneMarkers.push({ mesh, timer: 0 });
    }

    // 4) Deep space star field: layered depth, less glitter noise.
    const starGeometry = new THREE.BufferGeometry();
    const starCount = 520;
    const positions = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const r = this.radius + 4.5 + Math.random() * 13;
      const bottomBias = Math.random() > 0.78;
      positions[i * 3] = Math.cos(angle) * r;
      positions[i * 3 + 1] = Math.sin(angle) * r + (bottomBias ? -1.8 : 0);
      positions[i * 3 + 2] = -112 + Math.random() * 125;
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const stars = new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({
        color: COLORS.white,
        size: 0.105,
        transparent: true,
        opacity: 0.36,
        depthWrite: false,
      }),
    );

    this.group.add(stars);
    this.stars = stars;
    this.starMaterial = stars.material;

    // 5) Distant nebula bands: cinematic depth without adding texture assets.
    const nebulaMaterialA = new THREE.MeshBasicMaterial({
      color: 0x062a38,
      transparent: true,
      opacity: 0.105,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    const nebulaMaterialB = new THREE.MeshBasicMaterial({
      color: 0x4a2404,
      transparent: true,
      opacity: 0.075,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    });

    const nebulaGeometry = new THREE.PlaneGeometry(16, 4.5);
    const nebulaA = new THREE.Mesh(nebulaGeometry, nebulaMaterialA);
    nebulaA.position.set(-5.2, 2.6, -72);
    nebulaA.rotation.z = -0.28;

    const nebulaB = new THREE.Mesh(nebulaGeometry, nebulaMaterialB);
    nebulaB.position.set(5.7, 1.4, -88);
    nebulaB.rotation.z = 0.22;

    this.wallLightMaterials.push(nebulaMaterialA, nebulaMaterialB);
    this.group.add(nebulaA, nebulaB);

    this._buildSpeedStreaks(colors);
  }


  _buildSpeedStreaks(colors) {
    const geometry = new THREE.BoxGeometry(0.022, 0.022, 4.4);
    const materials = colors.map((color, index) => {
      const material = this._neonMaterial(color);
      material.opacity = index === 0 ? 0.34 : index === 1 ? 0.28 : 0.22;
      material.userData.baseOpacity = material.opacity;
      return material;
    });

    this.streakMaterials = materials;

    for (let i = 0; i < TUNNEL_VISUALS.streakCount; i += 1) {
      const streak = new THREE.Mesh(geometry, materials[i % materials.length]);
      streak.userData.surgeOnly = i % 4 === 0;
      this._resetStreak(streak, -Math.random() * 116);
      this.streaks.push(streak);
      this.group.add(streak);
    }
  }


  _resetStreak(streak, z = -110 - Math.random() * 28) {
    const angle = Math.random() * Math.PI * 2;
    const bottomBias = Math.random() > 0.42;
    const radius = bottomBias ? 3.7 + Math.random() * 1.55 : 5.15 + Math.random() * 1.85;
    const yOffset = bottomBias ? -0.72 - Math.random() * 1.25 : Math.random() * 0.5;

    streak.position.set(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius + yOffset,
      z,
    );

    streak.rotation.set(0, 0, 0);
    streak.scale.z = 1.05 + Math.random() * 2.9;
    streak.userData.baseLength = streak.scale.z;
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
    const cyan = this.paletteCyan.setHex(palette.primary).lerp(CYAN_HIGHLIGHT, 0.08).getHex();
    const gold = this.paletteGold.setHex(palette.secondary).lerp(GOLD_HIGHLIGHT, 0.2).getHex();
    for (let i = 0; i < this.ringMaterials.length; i += 1) {
      const mat = this.ringMaterials[i];
      if (palette.bias === 'hyper') mat.color.setHex(i % 2 === 0 ? palette.primary : palette.accent);
      else if (mat.userData.channel === 'gold') mat.color.setHex(gold);
      else mat.color.setHex(cyan);
    }
    for (let i = 0; i < this.accentMaterials.length; i += 1) {
      const mat = this.accentMaterials[i];
      if (palette.bias === 'hyper') mat.color.setHex(palette.secondary);
      else mat.color.setHex(mat.userData.channel === 'orange' ? palette.accent : gold);
    }
    for (const material of this.railMaterials) {
      material.color.setHex(material.userData.channel === 'gold' ? gold : cyan);
    }
    if (this.wallPanelMaterials.length >= 2) {
      this.wallPanelMaterials[0].emissive.setHex(cyan);
      this.wallPanelMaterials[1].emissive.setHex(gold);
    }
    if (this.wallUniforms) {
      this.wallUniforms.uCyan.value.setHex(cyan);
      this.wallUniforms.uGold.value.setHex(gold);
    }
    for (const material of this.wallLightMaterials) {
      material.color.setHex(material.userData.channel === 'gold' ? gold : cyan);
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
    if (this.solarInnerMaterial) this.solarInnerMaterial.color.setHex(palette.secondary ?? COLORS.solarGold);
    if (this.solarMidMaterial) this.solarMidMaterial.color.setHex(palette.secondary ?? COLORS.solarGold);
    if (this.solarHaloMaterial) this.solarHaloMaterial.color.setHex(palette.accent ?? COLORS.solarOrange);
    if (this.solarCoronaMaterial) this.solarCoronaMaterial.color.setHex(palette.secondary ?? COLORS.solarGold);
    if (this.solarOuterCoronaMaterial) this.solarOuterCoronaMaterial.color.setHex(palette.accent ?? COLORS.solarOrange);
    if (this.solarRayMaterial) this.solarRayMaterial.color.setHex(palette.secondary ?? COLORS.solarGold);
  }

  update(delta, speed, hyper = 0, wave = null, boost = 0, now = performance.now()) {
    if (wave) this.waveState = wave;
    this.group.rotation.z = THREE.MathUtils.damp(this.group.rotation.z, 0, 6, delta);
    const movement = speed * delta;
    const waveMotion = this.waveState?.name === 'pressure' || this.waveState?.name === 'risk' ? 0.25 : this.waveState?.name === 'cooldown' ? -0.14 : 0;
    if (this.wallUniforms) this.wallUniforms.uTime.value += delta;
    
    for (const ring of this.rings) {
      ring.position.z += movement;
      ring.rotation.z += delta * (0.12 + hyper * 0.34);
      if (ring.position.z > 8) {
        ring.position.z -= this.length * this.spacing;
      }
    }

    for (const rail of this.laneMarkers) {
      rail.material.opacity = 0.68 + Math.sin(now * 0.004 + rail.position.x) * 0.04;
    }

    for (const guide of this.guideRails) {
      const baseOpacity = guide.material.userData.baseOpacity ?? 0.28;
      guide.material.opacity = baseOpacity + Math.sin(now * 0.0035 + guide.position.x) * 0.035;
    }

    for (const dash of this.railDashes) {
      dash.position.z += movement * (1.22 + hyper * 0.32);
      if (dash.position.z > 8) dash.position.z -= this.length * this.spacing;
    }

    const streakEnergy = 1 + hyper * 0.55 + boost * 0.32 + Math.max(waveMotion, 0) * 0.28;
    for (const material of this.streakMaterials) {
      const baseOpacity = material.userData.baseOpacity ?? 0.3;
      material.opacity = Math.min(0.66, baseOpacity * streakEnergy);
    }
    for (const streak of this.streaks) {
      streak.visible = !streak.userData.surgeOnly || hyper > 0 || boost > 0;
      if (!streak.visible) continue;
      streak.position.z += movement * (1.55 + hyper * 0.45 + boost * 0.28 + waveMotion);
      const baseLength = streak.userData.baseLength ?? 1;
      const targetLength = baseLength * (1 + hyper * 0.58 + boost * 0.35 + Math.max(waveMotion, 0) * 0.25);
      streak.scale.z = THREE.MathUtils.damp(streak.scale.z, targetLength, 4, delta);
      if (streak.position.z > TUNNEL_VISUALS.streakRecycleZ) this._resetStreak(streak);
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
      const pulse = Math.sin(now * 0.005) * 0.04;
      this.solarCoreMaterial.opacity = THREE.MathUtils.damp(this.solarCoreMaterial.opacity, Math.min(1, targetIntensity + 0.34), 3, delta);
      this.solarInnerMaterial.opacity = THREE.MathUtils.damp(this.solarInnerMaterial.opacity, 0.48 + targetIntensity * 0.18 + pulse, 3, delta);
      this.solarMidMaterial.opacity = THREE.MathUtils.damp(this.solarMidMaterial.opacity, 0.16 + targetIntensity * 0.12 + pulse * 0.55, 3, delta);
      this.solarHaloMaterial.opacity = THREE.MathUtils.damp(this.solarHaloMaterial.opacity, 0.09 + targetIntensity * 0.12 + pulse * 0.5, 3, delta);
      this.solarCoronaMaterial.opacity = THREE.MathUtils.damp(this.solarCoronaMaterial.opacity, 0.48 + targetIntensity * 0.16, 3, delta);
      this.solarOuterCoronaMaterial.opacity = THREE.MathUtils.damp(this.solarOuterCoronaMaterial.opacity, 0.18 + targetIntensity * 0.1, 3, delta);
      this.solarRayMaterial.opacity = THREE.MathUtils.damp(this.solarRayMaterial.opacity, 0.12 + targetIntensity * 0.12, 3, delta);

      const pulseScale = hyper > 0
        ? 1.12 + Math.sin(now * 0.02) * 0.045
        : 1 + pulse * 0.25 + boost * 0.035;
      this.solarCoreGroup.scale.setScalar(THREE.MathUtils.damp(this.solarCoreGroup.scale.x, pulseScale, 4, delta));
      this.solarHalo.rotation.z += delta * 0.06;
      this.solarCorona.rotation.z -= delta * (0.08 + hyper * 0.12);
      this.solarOuterCorona.rotation.z += delta * (0.045 + hyper * 0.07);
      this.solarRays.rotation.z += delta * (0.025 + hyper * 0.05);
    }
  }
}
