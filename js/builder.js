import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

export class TerrainRenderer {
  constructor(app) {
    this.app = app;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0b1015');

    this.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 2000);
    this.camera.position.set(12, 8, 12);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    const viewport = document.getElementById('viewport');
    viewport.appendChild(this.renderer.domElement);

    this.gridRadius = this.app.state.settings.gridRadius;
    this.grid = new THREE.GridHelper(this.gridRadius * 2, this.gridRadius * 2, '#778592', '#2d3640');
    this.grid.position.y = -0.5;
    this.scene.add(this.grid);

    const baseGround = new THREE.Mesh(
      new THREE.PlaneGeometry(this.gridRadius * 4, this.gridRadius * 4),
      new THREE.MeshStandardMaterial({ color: '#202832', side: THREE.DoubleSide })
    );
    baseGround.rotation.x = -Math.PI / 2;
    baseGround.position.y = -0.6;
    this.scene.add(baseGround);

    const hemi = new THREE.HemisphereLight('#cad9ea', '#0d1118', 0.85);
    const sun = new THREE.DirectionalLight('#ffffff', 1.1);
    sun.position.set(18, 26, 16);
    this.scene.add(hemi, sun);

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2(0, 0);
    this.pointerTarget = new THREE.Vector3();

    this.cameraYaw = -0.85;
    this.cameraPitch = -0.65;
    this.cameraVelocity = new THREE.Vector3();
    this.cameraLookTarget = new THREE.Vector3(0, 0, 0);
  }

  setup() {
    this.resize();
  }

  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  updateBlockScale() {
    const blockScale = this.app.state.settings.blockScale;
    this.app.builder?.syncBlockScale(blockScale);
  }

  updateGridRadius(value) {
    this.gridRadius = value;
    this.scene.remove(this.grid);
    this.grid = new THREE.GridHelper(value * 2, value * 2, '#778592', '#2d3640');
    this.grid.position.y = -0.5;
    this.scene.add(this.grid);
  }

  update(dt) {
    const { camera } = this;
    const viewDir = new THREE.Vector3(Math.sin(this.cameraYaw), 0, Math.cos(this.cameraYaw));
    const rightDir = new THREE.Vector3(Math.cos(this.cameraYaw), 0, -Math.sin(this.cameraYaw));
    const move = new THREE.Vector3();

    if (this.app.controls) {
      const input = this.app.controls.getMoveVector();
      move.addScaledVector(viewDir, input.z);
      move.addScaledVector(rightDir, input.x);
      move.y = input.y;
    }

    if (move.lengthSq() > 0) {
      move.normalize();
      camera.position.addScaledVector(move, 9 * dt);
    }

    const lookTarget = new THREE.Vector3(
      camera.position.x + Math.sin(this.cameraYaw) * Math.cos(this.cameraPitch),
      camera.position.y + Math.sin(this.cameraPitch),
      camera.position.z + Math.cos(this.cameraYaw) * Math.cos(this.cameraPitch)
    );

    camera.lookAt(lookTarget);

    this.raycastTarget();
    this.renderer.render(this.scene, camera);
  }

  raycastTarget() {
    const center = new THREE.Vector2(0, 0);
    this.raycaster.setFromCamera(center, this.camera);
    const intersection = this.raycaster.intersectObjects(this.app.builder?.worldGroup?.children || [], true);

    let target = null;
    if (intersection.length > 0) {
      const hit = intersection[0];
      target = hit.point.clone();
      const normal = hit.face.normal.clone();
      target.addScaledVector(normal, 0.5);
      this.pointerTarget.copy(target);

      const gridPos = new THREE.Vector3(
        Math.round(target.x - 0.5),
        Math.round(target.y - 0.5),
        Math.round(target.z - 0.5)
      );
      this.app.setCoords(gridPos.x, gridPos.y, gridPos.z);
      return;
    }

    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const point = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(plane, point);
    this.pointerTarget.copy(point);

    const airTarget = this.pointerTarget.clone();
    const airDistance = this.app.state.settings.airPlacementDistance || 4;
    const offset = new THREE.Vector3(Math.sin(this.cameraYaw), 0, Math.cos(this.cameraYaw)).multiplyScalar(airDistance);
    airTarget.add(offset);

    this.app.setCoords(airTarget.x, airTarget.y, airTarget.z);
  }

  getInteractionTarget() {
    return this.pointerTarget.clone();
  }
}

