import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

export class TerrainRenderer {
  constructor(app) {
    this.app = app;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0b1015');

    this.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 2000);
    this.camera.position.set(10, 8, 10);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    const viewport = document.getElementById('viewport');
    viewport.appendChild(this.renderer.domElement);

    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.raycaster = new THREE.Raycaster();
    this.pointerTarget = new THREE.Vector3();

    this.cameraYaw = -0.7;
    this.cameraPitch = -0.45;

    this.gridRadius = this.app.state.settings.gridRadius;
    this.grid = new THREE.GridHelper(this.gridRadius * 2, this.gridRadius * 2, '#7a8c9d', '#2d3640');
    this.grid.position.y = -0.5;
    this.scene.add(this.grid);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(this.gridRadius * 2, this.gridRadius * 2),
      new THREE.MeshStandardMaterial({ color: '#202832', side: THREE.DoubleSide })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.6;
    this.scene.add(ground);

    const hemi = new THREE.HemisphereLight('#cfe0ff', '#0d1118', 0.9);
    const sun = new THREE.DirectionalLight('#ffffff', 1.1);
    sun.position.set(18, 26, 14);
    this.scene.add(hemi, sun);
  }

  setup() {
    this.resize();
    this.app.updateControlHints();
  }

  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  updateGridRadius(value) {
    this.gridRadius = value;
    this.scene.remove(this.grid);
    this.grid = new THREE.GridHelper(value * 2, value * 2, '#7a8c9d', '#2d3640');
    this.grid.position.y = -0.5;
    this.scene.add(this.grid);
  }

  updateBlockScale() {
    const scale = this.app.state.settings.blockScale;
    this.app.builder?.updateBlockScale(scale);
  }

  update(dt) {
    const { camera } = this;
    const forward = new THREE.Vector3(
      Math.sin(this.cameraYaw) * Math.cos(this.cameraPitch),
      Math.sin(this.cameraPitch),
      Math.cos(this.cameraYaw) * Math.cos(this.cameraPitch)
    ).normalize();

    const right = new THREE.Vector3(Math.cos(this.cameraYaw), 0, -Math.sin(this.cameraYaw)).normalize();
    const up = new THREE.Vector3(0, 1, 0);

    const move = new THREE.Vector3();
    if (this.app.controls) {
      const input = this.app.controls.getMoveVector();
      move.addScaledVector(forward, input.z);
      move.addScaledVector(right, input.x);
      move.addScaledVector(up, input.y);
    }

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(8 * dt);
      camera.position.add(move);
    }

    const lookTarget = camera.position.clone().add(forward);
    camera.lookAt(lookTarget);

    this.updateRayTarget();
    this.renderer.render(this.scene, camera);
  }

  updateRayTarget() {
    const center = new THREE.Vector2(0, 0);
    this.raycaster.setFromCamera(center, this.camera);

    const meshList = this.app.builder ? this.app.builder.getWorldMeshes() : [];
    const intersections = this.raycaster.intersectObjects(meshList, false);

    if (intersections.length > 0) {
      const hit = intersections[0];
      const normal = hit.face ? hit.face.normal.clone() : new THREE.Vector3(0, 1, 0);
      const target = hit.point.clone().add(normal.multiplyScalar(0.5));
      this.pointerTarget.copy(target);
      const cell = this.app.builder.roundVectorToCell(target);
      this.app.setCoords(cell.x, cell.y, cell.z);
      return;
    }

    const airDistance = Number(this.app.state.settings.airPlacementDistance || 4);
    const forward = new THREE.Vector3(
      Math.sin(this.cameraYaw) * Math.cos(this.cameraPitch),
      Math.sin(this.cameraPitch),
      Math.cos(this.cameraYaw) * Math.cos(this.cameraPitch)
    ).normalize();

    const target = this.camera.position.clone().add(forward.multiplyScalar(airDistance));
    this.pointerTarget.copy(target);

    const cell = this.app.builder.roundVectorToCell(target);
    this.app.setCoords(cell.x, cell.y, cell.z);
  }

  getInteractionTarget() {
    return this.pointerTarget.clone();
  }
}
