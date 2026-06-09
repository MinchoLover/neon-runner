import * as THREE from 'three';
import { COLORS } from './constants.js';

export class ParticleManager {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.pool = [];
    this.boostEmission = 0;
    this.materials = [
      new THREE.MeshBasicMaterial({ color: COLORS.cyan, transparent: true, opacity: 1, toneMapped: false }),
      new THREE.MeshBasicMaterial({ color: COLORS.solarOrange, transparent: true, opacity: 1, toneMapped: false }),
      new THREE.MeshBasicMaterial({ color: COLORS.white, transparent: true, opacity: 1, toneMapped: false }),
      new THREE.MeshBasicMaterial({ color: COLORS.solarGold, transparent: true, opacity: 1, toneMapped: false }),
    ];
    this.geometry = new THREE.SphereGeometry(0.045, 8, 6);
    this.streakGeometry = new THREE.BoxGeometry(0.035, 0.035, 0.9);
    this.maxParticles = 130;
  }

  reset() {
    for (const particle of this.particles) this._releaseParticle(particle);
    this.particles = [];
    this.boostEmission = 0;
  }

  setPalette(palette, hyperActive = false) {
    const colors = hyperActive
      ? [0xffffff, 0xffb700, 0xff6200, 0x00e5ff] // Solar Surge: White, Gold, Orange, Cyan
      : [palette.primary, palette.secondary, palette.accent, palette.light ?? palette.primary];
    this.materials.forEach((material, index) => {
      material.color.setHex(colors[index % colors.length]);
    });
    for (const particle of [...this.particles, ...this.pool]) {
      particle.mesh.material.color.copy(this.materials[particle.materialIndex].color);
    }
  }

  burst(position, count = 28) {
    for (let i = 0; i < count; i += 1) {
      const mesh = this._createParticleMesh(this.geometry, i);
      mesh.position.copy(position);
      mesh.position.y += Math.random() * 0.7 - 0.2;
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 5.2,
        Math.random() * 3.2,
        (Math.random() - 0.5) * 5.2 + 4,
      );
      this._spawn(mesh, velocity, 0.52 + Math.random() * 0.28, 0.8);
    }
    this._trim();
  }

  nearMiss(position, chain = 1) {
    const count = 10 + Math.min(chain, 4) * 4;
    for (let i = 0; i < count; i += 1) {
      const materialIndex = chain >= 4 ? (i % 3 === 0 ? 2 : 1) : i % 2;
      const mesh = this._createParticleMesh(this.streakGeometry, materialIndex);
      mesh.position.copy(position);
      mesh.position.x += (Math.random() - 0.5) * 1.6;
      mesh.position.y += (Math.random() - 0.5) * 0.8;
      const velocity = new THREE.Vector3((Math.random() - 0.5) * (2 + chain * 0.25), Math.random() * 1.4, 8 + Math.random() * (5 + chain));
      mesh.rotation.z = Math.random() * Math.PI;
      this._spawn(mesh, velocity, 0.32 + Math.random() * 0.16, 0.5);
    }
    this._trim();
  }

  boostTrail(position, hyper = false, boostFactor = 0, delta = 1 / 60) {
    const emissionRate = hyper ? 84 : boostFactor > 0 ? 66 : 42;
    this.boostEmission += emissionRate * delta;
    const count = Math.min(Math.floor(this.boostEmission), 4);
    this.boostEmission -= count;
    for (let i = 0; i < count; i += 1) {
      const mesh = this._createParticleMesh(this.streakGeometry, (i + 1) % this.materials.length);
      mesh.position.copy(position);
      mesh.position.x += (Math.random() - 0.5) * 0.9;
      mesh.position.y += (Math.random() - 0.5) * 0.35;
      mesh.position.z += 1.1 + Math.random() * 0.6;
      const velocity = new THREE.Vector3((Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.6, 6 + boostFactor * 2 + Math.random() * 3);
      this._spawn(mesh, velocity, boostFactor > 0 ? 0.32 : 0.28, boostFactor > 0 ? 0.32 : 0.28);
    }
    this._trim();
  }

  sparkle(position, count = 12) {
    for (let i = 0; i < count; i += 1) {
      const mesh = this._createParticleMesh(this.geometry, (i + 2) % this.materials.length);
      mesh.position.copy(position);
      mesh.position.x += (Math.random() - 0.5) * 1.4;
      mesh.position.y += Math.random() * 0.9;
      const velocity = new THREE.Vector3((Math.random() - 0.5) * 2.2, Math.random() * 1.8, 2 + Math.random() * 3);
      this._spawn(mesh, velocity, 0.38 + Math.random() * 0.18, 0.56);
    }
    this._trim();
  }

  riftBurst(position, count = 32) {
    for (let i = 0; i < count; i += 1) {
      const mesh = this._createParticleMesh(this.streakGeometry, i % this.materials.length);
      mesh.position.copy(position);
      mesh.position.x += (Math.random() - 0.5) * 4.2;
      mesh.position.y += (Math.random() - 0.5) * 1.8;
      mesh.position.z += (Math.random() - 0.5) * 1.5;
      mesh.rotation.z = Math.random() * Math.PI;
      const velocity = new THREE.Vector3((Math.random() - 0.5) * 3.8, (Math.random() - 0.5) * 1.8, 5 + Math.random() * 4);
      this._spawn(mesh, velocity, 0.42 + Math.random() * 0.18, 0.6);
    }
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
      const velocity = new THREE.Vector3((Math.random() - 0.5) * 2.6, Math.random() * 1.2, 4 + Math.random() * 4);
      this._spawn(mesh, velocity, 0.24 + Math.random() * 0.12, 0.36);
    }
    this._trim();
  }

  scoreRingBurst(position, count = 20) {
    for (let i = 0; i < count; i += 1) {
      const mesh = this._createParticleMesh(i % 3 === 0 ? this.geometry : this.streakGeometry, i % this.materials.length);
      mesh.position.copy(position);
      mesh.position.x += (Math.random() - 0.5) * 0.8;
      mesh.position.y += (Math.random() - 0.5) * 0.7;
      mesh.rotation.z = Math.random() * Math.PI;
      const angle = Math.random() * Math.PI * 2;
      const velocity = new THREE.Vector3(Math.cos(angle) * (1.5 + Math.random() * 2.5), Math.random() * 1.8, 5 + Math.random() * 4);
      this._spawn(mesh, velocity, 0.34 + Math.random() * 0.18, 0.52);
    }
    this._trim();
  }

  update(delta) {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const particle = this.particles[i];
      // Particle lifecycle: velocity integrates position, life drives scale fade,
      // and expired meshes are removed from the scene to keep real-time rendering light.
      particle.life -= delta;
      particle.velocity.y -= delta * 5;
      particle.mesh.position.addScaledVector(particle.velocity, delta);
      const scale = Math.max(particle.life / particle.maxLife, 0);
      particle.mesh.scale.setScalar(scale);
      particle.mesh.material.opacity = scale;
      if (particle.life <= 0) {
        this._releaseParticle(particle);
        this.particles.splice(i, 1);
      }
    }
  }

  _createParticleMesh(geometry, materialIndex) {
    const normalizedIndex = materialIndex % this.materials.length;
    const geometryType = geometry === this.streakGeometry ? 'streak' : 'sphere';
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
    return mesh;
  }

  _spawn(mesh, velocity, life, maxLife = life) {
    const materialIndex = mesh.userData.particleMaterialIndex ?? 0;
    const geometryType = mesh.geometry === this.streakGeometry ? 'streak' : 'sphere';
    this.scene.add(mesh);
    this.particles.push({ mesh, velocity, life, maxLife, materialIndex: Math.max(materialIndex, 0), geometryType });
  }

  _releaseParticle(particle) {
    this.scene.remove(particle.mesh);
    particle.mesh.visible = false;
    particle.velocity.set(0, 0, 0);
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
