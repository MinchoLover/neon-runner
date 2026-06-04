import * as THREE from 'three';
import { COLORS } from './constants.js';

export class ParticleManager {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.materials = [
      new THREE.MeshBasicMaterial({ color: COLORS.cyan, toneMapped: false }),
      new THREE.MeshBasicMaterial({ color: COLORS.magenta, toneMapped: false }),
      new THREE.MeshBasicMaterial({ color: COLORS.white, toneMapped: false }),
      new THREE.MeshBasicMaterial({ color: COLORS.purple, toneMapped: false }),
    ];
    this.geometry = new THREE.SphereGeometry(0.045, 8, 6);
    this.streakGeometry = new THREE.BoxGeometry(0.035, 0.035, 0.9);
    this.maxParticles = 180;
  }

  reset() {
    for (const particle of this.particles) this.scene.remove(particle.mesh);
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
      const mesh = new THREE.Mesh(this.geometry, this.materials[i % this.materials.length]);
      mesh.position.copy(position);
      mesh.position.y += Math.random() * 0.7 - 0.2;
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 5.2,
        Math.random() * 3.2,
        (Math.random() - 0.5) * 5.2 + 4,
      );
      this.scene.add(mesh);
      this.particles.push({ mesh, velocity, life: 0.52 + Math.random() * 0.28, maxLife: 0.8 });
    }
    this._trim();
  }

  nearMiss(position) {
    for (let i = 0; i < 18; i += 1) {
      const mesh = new THREE.Mesh(this.streakGeometry, this.materials[i % 2]);
      mesh.position.copy(position);
      mesh.position.x += (Math.random() - 0.5) * 1.6;
      mesh.position.y += (Math.random() - 0.5) * 0.8;
      const velocity = new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 1.4, 8 + Math.random() * 5);
      mesh.rotation.z = Math.random() * Math.PI;
      this.scene.add(mesh);
      this.particles.push({ mesh, velocity, life: 0.34 + Math.random() * 0.16, maxLife: 0.5 });
    }
    this._trim();
  }

  boostTrail(position, hyper = false) {
    const count = hyper ? 5 : 3;
    for (let i = 0; i < count; i += 1) {
      const mesh = new THREE.Mesh(this.streakGeometry, this.materials[(i + 1) % this.materials.length]);
      mesh.position.copy(position);
      mesh.position.x += (Math.random() - 0.5) * 0.9;
      mesh.position.y += (Math.random() - 0.5) * 0.35;
      mesh.position.z += 1.1 + Math.random() * 0.6;
      const velocity = new THREE.Vector3((Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.6, 6 + Math.random() * 3);
      this.scene.add(mesh);
      this.particles.push({ mesh, velocity, life: 0.28, maxLife: 0.28 });
    }
    this._trim();
  }

  sparkle(position, count = 12) {
    for (let i = 0; i < count; i += 1) {
      const mesh = new THREE.Mesh(this.geometry, this.materials[(i + 2) % this.materials.length]);
      mesh.position.copy(position);
      mesh.position.x += (Math.random() - 0.5) * 1.4;
      mesh.position.y += Math.random() * 0.9;
      const velocity = new THREE.Vector3((Math.random() - 0.5) * 2.2, Math.random() * 1.8, 2 + Math.random() * 3);
      this.scene.add(mesh);
      this.particles.push({ mesh, velocity, life: 0.38 + Math.random() * 0.18, maxLife: 0.56 });
    }
    this._trim();
  }

  riftBurst(position, count = 32) {
    for (let i = 0; i < count; i += 1) {
      const mesh = new THREE.Mesh(this.streakGeometry, this.materials[i % this.materials.length]);
      mesh.position.copy(position);
      mesh.position.x += (Math.random() - 0.5) * 4.2;
      mesh.position.y += (Math.random() - 0.5) * 1.8;
      mesh.position.z += (Math.random() - 0.5) * 1.5;
      mesh.rotation.z = Math.random() * Math.PI;
      const velocity = new THREE.Vector3((Math.random() - 0.5) * 3.8, (Math.random() - 0.5) * 1.8, 5 + Math.random() * 4);
      this.scene.add(mesh);
      this.particles.push({ mesh, velocity, life: 0.42 + Math.random() * 0.18, maxLife: 0.6 });
    }
    this._trim();
  }

  update(delta) {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const particle = this.particles[i];
      particle.life -= delta;
      particle.velocity.y -= delta * 5;
      particle.mesh.position.addScaledVector(particle.velocity, delta);
      const scale = Math.max(particle.life / particle.maxLife, 0);
      particle.mesh.scale.setScalar(scale);
      if (particle.life <= 0) {
        this.scene.remove(particle.mesh);
        this.particles.splice(i, 1);
      }
    }
  }

  _trim() {
    while (this.particles.length > this.maxParticles) {
      const particle = this.particles.shift();
      this.scene.remove(particle.mesh);
    }
  }
}
