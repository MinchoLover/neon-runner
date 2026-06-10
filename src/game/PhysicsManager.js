import * as CANNON from 'cannon-es';
import * as THREE from 'three';

const MAX_DEBRIS = 96;
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
    this.geometryShard = new THREE.TetrahedronGeometry(0.14, 0);
    this.geometryPlate = new THREE.BoxGeometry(0.22, 0.055, 0.16);
  }

  reset() {
    for (const item of this.debris) this._release(item);
    this.debris = [];
  }

  createDebris(position, color = 0xffffff, count = 14, strength = 4.8) {
    const origin = this._toVector3(position);
    const spawnCount = Math.min(count, MAX_DEBRIS - this.debris.length);

    for (let i = 0; i < spawnCount; i += 1) {
      const geometryType = i % 5 === 0 ? 'plate' : i % 3 === 0 ? 'shard' : 'box';
      const item = this._acquire(geometryType);
      const { mesh, body } = item;

      const size = 0.08 + Math.random() * 0.18;
      mesh.material.color.setHex(color);
      mesh.material.emissive.setHex(color);
      mesh.material.emissiveIntensity = geometryType === 'plate' ? 0.62 : 0.42;
      mesh.material.opacity = 0.96;
      mesh.visible = true;

      const scale = geometryType === 'plate' ? size / 0.18 : size / 0.14;
      mesh.scale.setScalar(scale);

      mesh.position.copy(origin);
      mesh.position.x += (Math.random() - 0.5) * 0.9;
      mesh.position.y += Math.random() * 0.56;
      mesh.position.z += (Math.random() - 0.5) * 0.5;

      this.scene.add(mesh);

      body.position.set(mesh.position.x, mesh.position.y, mesh.position.z);
      body.quaternion.set(0, 0, 0, 1);
      body.wakeUp();

      const burst = strength * (geometryType === 'plate' ? 1.15 : 1);
      body.velocity.set(
        (Math.random() - 0.5) * burst,
        Math.random() * burst * 0.75 + 1.4,
        2.8 + Math.random() * burst,
      );

      body.angularVelocity.set(
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 12,
      );

      this.world.addBody(body);

      item.life = 1.05 + Math.random() * 0.65;
      item.maxLife = item.life;
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
      item.mesh.quaternion.set(
        item.body.quaternion.x,
        item.body.quaternion.y,
        item.body.quaternion.z,
        item.body.quaternion.w,
      );

      const fade = Math.max(item.life / item.maxLife, 0);
      item.mesh.material.opacity = Math.min(0.96, fade);
      item.mesh.scale.multiplyScalar(0.993);

      if (item.life <= 0 || item.mesh.position.z > 15 || item.mesh.position.y < -8) {
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

    const geometry =
      geometryType === 'plate'
        ? this.geometryPlate
        : geometryType === 'shard'
          ? this.geometryShard
          : this.geometryBox;

    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.42,
      metalness: 0.38,
      roughness: 0.32,
      transparent: true,
      opacity: 0.96,
    });

    const mesh = new THREE.Mesh(geometry, material);

    const body = new CANNON.Body({
      mass: geometryType === 'plate' ? 0.06 : 0.08,
      material: this.material,
      shape: new CANNON.Box(new CANNON.Vec3(0.07, 0.07, 0.07)),
      linearDamping: 0.1,
      angularDamping: 0.07,
    });

    return { mesh, body, geometryType, life: 0, maxLife: 1.5 };
  }

  _release(item) {
    this.scene.remove(item.mesh);
    this.world.removeBody(item.body);
    item.mesh.visible = false;
    item.body.velocity.set(0, 0, 0);
    item.body.angularVelocity.set(0, 0, 0);
    if (this.pool.length < MAX_DEBRIS) this.pool.push(item);
  }
}
