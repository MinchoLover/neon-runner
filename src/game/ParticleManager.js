import * as THREE from 'three';
import { COLORS } from './constants.js';

export class ParticleManager {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.pool = [];
    this.boostEmission = 0;
    this.maxParticles = 260;

    this.materials = [
      this._makeMaterial(COLORS.cyan),
      this._makeMaterial(COLORS.solarOrange),
      this._makeMaterial(COLORS.white),
      this._makeMaterial(COLORS.solarGold),
    ];

    this.geometry = new THREE.SphereGeometry(0.045, 8, 6);
    this.sparkGeometry = new THREE.OctahedronGeometry(0.075, 0);
    this.streakGeometry = new THREE.BoxGeometry(0.035, 0.035, 1.15);
    this.shardGeometry = new THREE.TetrahedronGeometry(0.085, 0);
    this.ringGeometry = new THREE.TorusGeometry(0.5, 0.018, 8, 36);
  }

  _makeMaterial(color) {
    return new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 1,
      toneMapped: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }

  reset() {
    for (const particle of this.particles) this._releaseParticle(particle);
    this.particles = [];
    this.boostEmission = 0;
  }

  setPalette(palette, hyperActive = false) {
    const colors = hyperActive
      ? [0xffffff, 0xffd45b, 0xff7a18, 0x79efff]
      : [palette.primary, palette.secondary, palette.accent, palette.light ?? palette.primary];

    this.materials.forEach((material, index) => {
      material.color.setHex(colors[index % colors.length]);
    });

    for (const particle of [...this.particles, ...this.pool]) {
      particle.mesh.material.color.copy(this.materials[particle.materialIndex].color);
    }
  }

  burst(position, count = 30) {
    for (let i = 0; i < count; i += 1) {
      const geometry = i % 4 === 0 ? this.shardGeometry : this.geometry;
      const mesh = this._createParticleMesh(geometry, i % this.materials.length);
      mesh.position.copy(position);
      mesh.position.x += (Math.random() - 0.5) * 0.45;
      mesh.position.y += Math.random() * 0.55 - 0.16;
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);

      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 6.6,
        Math.random() * 4.2 + 0.8,
        (Math.random() - 0.2) * 5.2 + 4.2,
      );

      this._spawn(mesh, velocity, 0.5 + Math.random() * 0.34, {
        scale: 1.05,
        drag: 0.96,
        gravity: 5.6,
        spin: 7,
      });
    }

    this._shockRing(position, 0.8, 0.26, 0.42, 3);
    this._trim();
  }

  nearMiss(position, chain = 1) {
    const count = 14 + Math.min(chain, 4) * 6;

    for (let i = 0; i < count; i += 1) {
      const materialIndex = chain >= 4 ? (i % 3 === 0 ? 2 : 1) : i % 2;
      const mesh = this._createParticleMesh(this.streakGeometry, materialIndex);
      mesh.position.copy(position);
      mesh.position.x += (Math.random() - 0.5) * 1.9;
      mesh.position.y += (Math.random() - 0.5) * 0.9;
      mesh.position.z += Math.random() * 0.7;
      mesh.rotation.z = Math.random() * Math.PI;

      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * (2.4 + chain * 0.32),
        Math.random() * 1.5,
        10 + Math.random() * (7 + chain * 1.2),
      );

      this._spawn(mesh, velocity, 0.28 + Math.random() * 0.18, {
        scale: 0.7 + chain * 0.08,
        drag: 0.985,
        gravity: 1.4,
        stretch: 1 + chain * 0.12,
      });
    }

    this._shockRing(position, 0.72 + chain * 0.08, 0.16, 0.26, chain >= 3 ? 2 : 0);
    this._trim();
  }

  boostTrail(position, hyper = false, boostFactor = 0, delta = 1 / 60) {
    const emissionRate = hyper ? 128 : boostFactor > 0 ? 96 : 48;
    this.boostEmission += emissionRate * delta;

    const count = Math.min(Math.floor(this.boostEmission), hyper ? 7 : 5);
    this.boostEmission -= count;

    for (let i = 0; i < count; i += 1) {
      const materialIndex = hyper ? i % this.materials.length : (i + 1) % this.materials.length;
      const mesh = this._createParticleMesh(i % 5 === 0 ? this.sparkGeometry : this.streakGeometry, materialIndex);

      mesh.position.copy(position);
      mesh.position.x += (Math.random() - 0.5) * (hyper ? 1.35 : 0.9);
      mesh.position.y += (Math.random() - 0.5) * 0.38;
      mesh.position.z += 1.08 + Math.random() * 0.8;
      mesh.rotation.z = Math.random() * Math.PI;

      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * (hyper ? 1.35 : 0.85),
        (Math.random() - 0.5) * 0.7,
        7.5 + boostFactor * 3.2 + (hyper ? 3.8 : 0) + Math.random() * 4,
      );

      this._spawn(mesh, velocity, hyper ? 0.42 : boostFactor > 0 ? 0.34 : 0.26, {
        scale: hyper ? 1.15 : 0.82,
        drag: 0.985,
        gravity: 0.2,
        stretch: hyper ? 1.7 : 1.2,
      });
    }

    this._trim();
  }

  boostBurst(position, count = 24) {
    for (let i = 0; i < count; i += 1) {
      const mesh = this._createParticleMesh(this.streakGeometry, i % this.materials.length);
      mesh.position.copy(position);
      mesh.position.x += (Math.random() - 0.5) * 0.8;
      mesh.position.y += (Math.random() - 0.5) * 0.45;
      mesh.position.z += 0.9 + Math.random() * 0.8;
      mesh.rotation.z = Math.random() * Math.PI;

      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 2.2,
        (Math.random() - 0.5) * 1.1,
        8 + Math.random() * 7,
      );

      this._spawn(mesh, velocity, 0.24 + Math.random() * 0.16, {
        scale: 1.05,
        drag: 0.97,
        gravity: 0.4,
        stretch: 1.8,
      });
    }

    this._shockRing(position, 0.65, 0.18, 0.3, 0);
    this._trim();
  }

  sparkle(position, count = 12) {
    for (let i = 0; i < count; i += 1) {
      const mesh = this._createParticleMesh(i % 3 === 0 ? this.sparkGeometry : this.geometry, (i + 2) % this.materials.length);
      mesh.position.copy(position);
      mesh.position.x += (Math.random() - 0.5) * 1.4;
      mesh.position.y += Math.random() * 0.95;
      mesh.position.z += (Math.random() - 0.5) * 0.35;

      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 2.5,
        Math.random() * 2,
        2.5 + Math.random() * 3.3,
      );

      this._spawn(mesh, velocity, 0.36 + Math.random() * 0.18, {
        scale: 0.8,
        drag: 0.96,
        gravity: 2.8,
      });
    }

    this._trim();
  }

  solarCore(position, count = 18, target = null) {
    const targetPosition = target?.isVector3 ? target.clone() : null;

    for (let i = 0; i < count; i += 1) {
      const geometry = i % 4 === 0 ? this.streakGeometry : i % 5 === 0 ? this.sparkGeometry : this.geometry;
      const materialIndex = i % 4 === 0 ? 0 : i % 3 === 0 ? 2 : 3;
      const mesh = this._createParticleMesh(geometry, materialIndex);
      mesh.position.copy(position);

      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.32;
      const speed = 1.7 + Math.random() * 2.8;
      const velocity = new THREE.Vector3(
        Math.cos(angle) * speed,
        Math.sin(angle) * speed * 0.75 + 0.25,
        4.4 + Math.random() * 3.8,
      );

      this._spawn(mesh, velocity, 0.36 + Math.random() * 0.18, {
        scale: i % 4 === 0 ? 1.1 : 0.85,
        drag: 0.95,
        gravity: 0.4,
        target: targetPosition,
        seek: targetPosition ? 5.5 : 0,
        stretch: i % 4 === 0 ? 1.25 : 1,
      });
    }

    this._shockRing(position, 0.92, 0.2, 0.36, 3);
    this._trim();
  }

  surgeBreak(position, count = 36) {
    for (let i = 0; i < count; i += 1) {
      const geometry = i % 5 === 0 ? this.sparkGeometry : i % 4 === 0 ? this.geometry : this.streakGeometry;
      const materialIndex = i % 5 === 0 ? 2 : i % 2 === 0 ? 3 : 1;
      const mesh = this._createParticleMesh(geometry, materialIndex);

      mesh.position.copy(position);
      mesh.position.x += (Math.random() - 0.5) * 0.72;
      mesh.position.y += (Math.random() - 0.5) * 0.56;
      mesh.position.z += (Math.random() - 0.5) * 0.5;
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);

      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.26;
      const radialSpeed = 3.4 + Math.random() * 6.4;
      const velocity = new THREE.Vector3(
        Math.cos(angle) * radialSpeed,
        Math.sin(angle) * radialSpeed * 0.8 + 1.2,
        8.5 + Math.random() * 7.5,
      );

      this._spawn(mesh, velocity, 0.42 + Math.random() * 0.24, {
        scale: 1.25,
        drag: 0.945,
        gravity: 3.8,
        spin: 9,
        stretch: geometry === this.streakGeometry ? 1.65 : 1,
      });
    }

    this._shockRing(position, 1.0, 0.22, 0.4, 3);
    this._shockRing(position, 1.45, 0.18, 0.48, 1);
    this._trim();
  }

  riftBurst(position, count = 42) {
    for (let i = 0; i < count; i += 1) {
      const mesh = this._createParticleMesh(i % 5 === 0 ? this.sparkGeometry : this.streakGeometry, i % this.materials.length);
      mesh.position.copy(position);
      mesh.position.x += (Math.random() - 0.5) * 4.8;
      mesh.position.y += (Math.random() - 0.5) * 2.1;
      mesh.position.z += (Math.random() - 0.5) * 1.8;
      mesh.rotation.z = Math.random() * Math.PI;

      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 4.6,
        (Math.random() - 0.5) * 2.2,
        6 + Math.random() * 5.5,
      );

      this._spawn(mesh, velocity, 0.44 + Math.random() * 0.22, {
        scale: 1.2,
        drag: 0.97,
        gravity: 0.6,
        stretch: 1.8,
      });
    }

    this._shockRing(position, 1.5, 0.28, 0.62, 0);
    this._trim();
  }

  warningBurst(position, count = 18) {
    for (let i = 0; i < count; i += 1) {
      const mesh = this._createParticleMesh(this.streakGeometry, i % 2 ? 2 : 1);
      mesh.position.copy(position);
      mesh.position.x += (Math.random() - 0.5) * 2.2;
      mesh.position.y += Math.random() * 0.9;
      mesh.position.z += 0.8 + Math.random() * 0.8;
      mesh.rotation.z = Math.random() * Math.PI;

      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 2.8,
        Math.random() * 1.25,
        4.5 + Math.random() * 4.2,
      );

      this._spawn(mesh, velocity, 0.24 + Math.random() * 0.14, {
        scale: 0.85,
        drag: 0.97,
        gravity: 1.2,
        stretch: 1.35,
      });
    }

    this._trim();
  }

  energyBurst(position, count = 24) {
    for (let i = 0; i < count; i += 1) {
      const geometry = i % 3 === 0 ? this.sparkGeometry : this.streakGeometry;
      const mesh = this._createParticleMesh(geometry, i % this.materials.length);

      mesh.position.copy(position);
      mesh.position.x += (Math.random() - 0.5) * 0.9;
      mesh.position.y += (Math.random() - 0.5) * 0.78;
      mesh.rotation.z = Math.random() * Math.PI;

      const angle = Math.random() * Math.PI * 2;
      const velocity = new THREE.Vector3(
        Math.cos(angle) * (2.2 + Math.random() * 3.2),
        Math.sin(angle) * (1.4 + Math.random() * 2.2),
        5.8 + Math.random() * 5.2,
      );

      this._spawn(mesh, velocity, 0.38 + Math.random() * 0.2, {
        scale: 1.05,
        drag: 0.965,
        gravity: 1.2,
        stretch: geometry === this.streakGeometry ? 1.45 : 1,
      });
    }

    this._shockRing(position, 0.9, 0.18, 0.34, 0);
    this._trim();
  }

  update(delta) {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const particle = this.particles[i];

      particle.life -= delta;

      if (particle.target && particle.seek > 0) {
        const desired = particle.target.clone().sub(particle.mesh.position).multiplyScalar(particle.seek * delta);
        particle.velocity.add(desired);
      }

      particle.velocity.y -= delta * particle.gravity;
      particle.velocity.multiplyScalar(Math.pow(particle.drag, delta * 60));
      particle.mesh.position.addScaledVector(particle.velocity, delta);

      particle.mesh.rotation.x += particle.spin.x * delta;
      particle.mesh.rotation.y += particle.spin.y * delta;
      particle.mesh.rotation.z += particle.spin.z * delta;

      const t = Math.max(particle.life / particle.maxLife, 0);
      const fade = particle.fadeOut ? t : 1;
      const scale = Math.max(t, 0);

      particle.mesh.scale.set(
        particle.baseScale * scale,
        particle.baseScale * scale,
        particle.baseScale * scale * particle.stretch,
      );
      particle.mesh.material.opacity = fade;

      if (particle.life <= 0) {
        this._releaseParticle(particle);
        this.particles.splice(i, 1);
      }
    }
  }

  _shockRing(position, radius = 1, life = 0.22, maxScale = 0.4, materialIndex = 0) {
    const mesh = this._createParticleMesh(this.ringGeometry, materialIndex);
    mesh.position.copy(position);
    mesh.position.z += 0.08;
    mesh.rotation.x = Math.PI / 2;
    mesh.scale.setScalar(radius * 0.15);

    this._spawn(mesh, new THREE.Vector3(0, 0, 5.5), life, {
      scale: radius,
      grow: maxScale,
      drag: 1,
      gravity: 0,
      fadeOut: true,
    });
  }

  _geometryKey(geometry) {
    if (geometry === this.streakGeometry) return 'streak';
    if (geometry === this.sparkGeometry) return 'spark';
    if (geometry === this.shardGeometry) return 'shard';
    if (geometry === this.ringGeometry) return 'ring';
    return 'sphere';
  }

  _createParticleMesh(geometry, materialIndex) {
    const normalizedIndex = materialIndex % this.materials.length;
    const geometryType = this._geometryKey(geometry);
    const pooledIndex = this.pool.findIndex(
      (particle) => particle.geometryType === geometryType && particle.materialIndex === normalizedIndex,
    );

    if (pooledIndex >= 0) {
      const particle = this.pool.splice(pooledIndex, 1)[0];
      particle.mesh.visible = true;
      particle.mesh.material.opacity = 1;
      particle.mesh.scale.setScalar(1);
      particle.mesh.rotation.set(0, 0, 0);
      return particle.mesh;
    }

    const material = this.materials[normalizedIndex].clone();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.particleMaterialIndex = normalizedIndex;
    mesh.userData.geometryType = geometryType;
    return mesh;
  }

  _spawn(mesh, velocity, life, options = {}) {
    const materialIndex = mesh.userData.particleMaterialIndex ?? 0;
    const geometryType = mesh.userData.geometryType ?? this._geometryKey(mesh.geometry);
    const maxLife = options.maxLife ?? life;

    this.scene.add(mesh);

    this.particles.push({
      mesh,
      velocity,
      life,
      maxLife,
      materialIndex: Math.max(materialIndex, 0),
      geometryType,
      baseScale: options.scale ?? 1,
      stretch: options.stretch ?? 1,
      drag: options.drag ?? 0.96,
      gravity: options.gravity ?? 4.8,
      target: options.target ?? null,
      seek: options.seek ?? 0,
      fadeOut: options.fadeOut ?? true,
      spin: new THREE.Vector3(
        (Math.random() - 0.5) * (options.spin ?? 2),
        (Math.random() - 0.5) * (options.spin ?? 2),
        (Math.random() - 0.5) * (options.spin ?? 2),
      ),
    });
  }

  _releaseParticle(particle) {
    this.scene.remove(particle.mesh);
    particle.mesh.visible = false;
    particle.velocity.set(0, 0, 0);
    particle.target = null;

    if (this.pool.length < this.maxParticles) this.pool.push(particle);
    else particle.mesh.material?.dispose?.();
  }

  _trim() {
    while (this.particles.length > this.maxParticles) {
      const particle = this.particles.shift();
      this._releaseParticle(particle);
    }
  }
}
