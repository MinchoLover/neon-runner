import * as CANNON from 'cannon-es';
import * as THREE from 'three';

const MAX_DEBRIS = 72;
const FIXED_TIME_STEP = 1 / 60;

export class PhysicsManager {
  constructor(scene) {
    this.scene = scene;
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -7.2, 0),
    });
    this.world.broadphase = new CANNON.NaiveBroadphase();
    this.world.allowSleep = true;
    this.debris = [];
    this.pool = [];
    this.material = new CANNON.Material('visual-debris');
    this.geometryBox = new THREE.BoxGeometry(0.14, 0.14, 0.14);
    this.geometryShard = new THREE.TetrahedronGeometry(0.13, 0);
    this.tmpQuaternion = new THREE.Quaternion();
  }

  reset() {
    for (const item of this.debris) this._release(item);
    this.debris = [];
  }

  createDebris(position, color = 0xffffff, count = 14, strength = 4.8) {
    const origin = this._toVector3(position);
    const spawnCount = Math.min(count, MAX_DEBRIS - this.debris.length);
    for (let i = 0; i < spawnCount; i += 1) {
      const size = 0.08 + Math.random() * 0.16;
      const geometryType = i % 3 === 0 ? 'shard' : 'box';
      const item = this._acquire(geometryType);
      const { mesh, body } = item;
      mesh.material.color.setHex(color);
      mesh.material.emissive.setHex(color);
      mesh.material.opacity = 0.95;
      mesh.scale.setScalar(size / 0.14);
      mesh.position.copy(origin);
      mesh.position.x += (Math.random() - 0.5) * 0.7;
      mesh.position.y += Math.random() * 0.45;
      this.scene.add(mesh);

      body.position.set(mesh.position.x, mesh.position.y, mesh.position.z);
      body.quaternion.set(0, 0, 0, 1);
      body.wakeUp();
      body.velocity.set(
        (Math.random() - 0.5) * strength,
        Math.random() * strength * 0.65 + 1.2,
        2.2 + Math.random() * strength,
      );
      body.angularVelocity.set(
        (Math.random() - 0.5) * 9,
        (Math.random() - 0.5) * 9,
        (Math.random() - 0.5) * 9,
      );
      this.world.addBody(body);
      item.life = 0.95 + Math.random() * 0.55;
      item.maxLife = 1.5;
      this.debris.push(item);
    }
  }

  update(delta) {
    if (this.debris.length === 0) return;
    this.world.step(FIXED_TIME_STEP, Math.min(delta, 0.033), 2);

    for (let i = this.debris.length - 1; i >= 0; i -= 1) {
      const item = this.debris[i];
      item.life -= delta;
      item.mesh.position.set(item.body.position.x, item.body.position.y, item.body.position.z);
      item.mesh.quaternion.set(item.body.quaternion.x, item.body.quaternion.y, item.body.quaternion.z, item.body.quaternion.w);
      const fade = Math.max(item.life / item.maxLife, 0);
      item.mesh.material.opacity = Math.min(0.95, fade);
      item.mesh.scale.multiplyScalar(0.992);
      if (item.life <= 0 || item.mesh.position.z > 14 || item.mesh.position.y < -8) {
        this._release(item);
        this.debris.splice(i, 1);
      }
    }
  }

  _toVector3(position) {
    if (position?.isVector3) return position;
    return new THREE.Vector3(position?.x ?? 0, position?.y ?? 0, position?.z ?? 0);
  }

  _acquire(geometryType) {
    const pooledIndex = this.pool.findIndex((item) => item.geometryType === geometryType);
    if (pooledIndex >= 0) return this.pool.splice(pooledIndex, 1)[0];
    const geometry = geometryType === 'shard' ? this.geometryShard : this.geometryBox;
    const material = new THREE.MeshStandardMaterial({
      emissiveIntensity: 0.38,
      metalness: 0.28,
      roughness: 0.34,
      transparent: true,
      opacity: 0.95,
    });
    const mesh = new THREE.Mesh(geometry, material);
    const body = new CANNON.Body({
      mass: 0.08,
      material: this.material,
      shape: new CANNON.Box(new CANNON.Vec3(0.07, 0.07, 0.07)),
      linearDamping: 0.12,
      angularDamping: 0.08,
    });
    return { mesh, body, geometryType, life: 0, maxLife: 1.5 };
  }

  _release(item) {
    this.scene.remove(item.mesh);
    this.world.removeBody(item.body);
    item.mesh.visible = false;
    item.body.velocity.set(0, 0, 0);
    item.body.angularVelocity.set(0, 0, 0);
    this.pool.push(item);
  }
}
