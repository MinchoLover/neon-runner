import * as THREE from 'three';
import { COLORS } from './constants.js';

export class ParticleManager {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.materials = [
      new THREE.MeshBasicMaterial({ color: COLORS.cyan, transparent: true, opacity: 1, toneMapped: false }),
      new THREE.MeshBasicMaterial({ color: COLORS.magenta, transparent: true, opacity: 1, toneMapped: false }),
      new THREE.MeshBasicMaterial({ color: COLORS.white, transparent: true, opacity: 1, toneMapped: false }),
      new THREE.MeshBasicMaterial({ color: COLORS.purple, transparent: true, opacity: 1, toneMapped: false }),
    ];
    this.geometry = new THREE.SphereGeometry(0.045, 8, 6);
    this.streakGeometry = new THREE.BoxGeometry(0.035, 0.035, 0.9);
    this.maxParticles = 180;
  }

  reset() {
    for (const particle of this.particles) this._removeParticle(particle);
    this.particles = [];
  }

  setPalette(palette, hyperActive = false) {
    const colors = hyperActive
      ? [0xff274f, 0x8a35ff, 0xffffff, 0xff31f7]
      : [palette.primary, palette.secondary, palette.accent, palette.light ?? palette.primary];
    this.materials.forEach((material, index) => {
      material.color.setHex(colors[index % colors.length]);
    });
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

  nearMiss(position) {
    for (let i = 0; i < 18; i += 1) {
      const mesh = this._createParticleMesh(this.streakGeometry, i % 2);
      mesh.position.copy(position);
      mesh.position.x += (Math.random() - 0.5) * 1.6;
      mesh.position.y += (Math.random() - 0.5) * 0.8;
      const velocity = new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 1.4, 8 + Math.random() * 5);
      mesh.rotation.z = Math.random() * Math.PI;
      this._spawn(mesh, velocity, 0.34 + Math.random() * 0.16, 0.5);
    }
    this._trim();
  }

  boostTrail(position, hyper = false) {
    const count = hyper ? 5 : 3;
    for (let i = 0; i < count; i += 1) {
      const mesh = this._createParticleMesh(this.streakGeometry, (i + 1) % this.materials.length);
      mesh.position.copy(position);
      mesh.position.x += (Math.random() - 0.5) * 0.9;
      mesh.position.y += (Math.random() - 0.5) * 0.35;
      mesh.position.z += 1.1 + Math.random() * 0.6;
      const velocity = new THREE.Vector3((Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.6, 6 + Math.random() * 3);
      this._spawn(mesh, velocity, 0.28, 0.28);
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
        this._removeParticle(particle);
        this.particles.splice(i, 1);
      }
    }
  }

  _createParticleMesh(geometry, materialIndex) {
    const material = this.materials[materialIndex % this.materials.length].clone();
    material.transparent = true;
    material.opacity = 1;
    return new THREE.Mesh(geometry, material);
  }

  _spawn(mesh, velocity, life, maxLife = life) {
    // Spawn step: each particle is a small mesh with its own material opacity.
    this.scene.add(mesh);
    this.particles.push({ mesh, velocity, life, maxLife });
  }

  _removeParticle(particle) {
    this.scene.remove(particle.mesh);
    particle.mesh.material?.dispose?.();
  }

  _trim() {
    while (this.particles.length > this.maxParticles) {
      const particle = this.particles.shift();
      this._removeParticle(particle);
    }
  }
}
