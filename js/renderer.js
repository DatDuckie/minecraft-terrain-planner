export class WorldRenderer {
  constructor(THREE, canvas, builder, onTarget) {
    this.THREE = THREE;
    this.canvas = canvas;
    this.builder = builder;
    this.onTarget = onTarget;
    this.scale = 1;
    this.gridRadius = 40;
    this.airDistance = 4;
    this.gridVisible = true;
    this.target = null;
    this.breakTarget = null;
    this.buildPreviewCells = [];
    this.buildPreviewBounds = null;
    this.keys = new Set();
    this.yaw = Math.PI * 0.75;
    this.pitch = -0.45;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#9bb4c5");
    this.scene.fog = new THREE.Fog("#9bb4c5", 70, 260);
    this.camera = new THREE.PerspectiveCamera(65, 1, 0.05, 2000);
    this.camera.rotation.order = "YXZ";
    this.camera.position.set(12, 9, 12);
    this.camera.lookAt(0, 0, 0);
    this.yaw = this.camera.rotation.y;
    this.pitch = this.camera.rotation.x;
    this.scene.add(new THREE.HemisphereLight("#e3f2ff", "#596052", 2.2));
    const sun = new THREE.DirectionalLight("#fff2db", 2.4);
    sun.position.set(-35, 60, 25);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    this.scene.add(sun);
    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(20000, 20000),
      new THREE.MeshStandardMaterial({ color: "#202832", roughness: 1 })
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.5 * this.scale;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);
    this.grid = null;
    this.createGrid();

    const previewGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.32, 1.32, 1.32));
    this.preview = new THREE.LineSegments(previewGeometry, new THREE.LineBasicMaterial({ color: "#ffffff", transparent: true, opacity: 1 }));
    this.preview.visible = false;
    this.scene.add(this.preview);
    this.buildPreviewGeometry = new THREE.BoxGeometry(0.94, 0.94, 0.94);
    this.buildPreviewMaterial = new THREE.MeshBasicMaterial({
      color: "#ff1717",
      transparent: true,
      opacity: 0.68,
      depthWrite: false
    });
    this.buildPreviewMesh = null;
    this.previewTransform = new THREE.Object3D();
    const outlineGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
    this.buildPreviewOutline = new THREE.LineSegments(
      outlineGeometry,
      new THREE.LineBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.95 })
    );
    this.buildPreviewOutline.visible = false;
    this.scene.add(this.buildPreviewOutline);
    this.raycaster = new THREE.Raycaster();
    this.center = new THREE.Vector2(0, 0);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement);
    this.resize();

    window.addEventListener("keydown", event => this.keys.add(event.code));
    window.addEventListener("keyup", event => this.keys.delete(event.code));
    canvas.addEventListener("click", () => {
      if (window.matchMedia("(min-width: 761px)").matches && document.pointerLockElement !== canvas) {
        canvas.requestPointerLock?.();
      }
    });
    document.addEventListener("pointerlockchange", () => {
      const hint = document.getElementById("hint");
      if (hint) hint.classList.toggle("locked", document.pointerLockElement === canvas);
    });
    document.addEventListener("mousemove", event => {
      if (document.pointerLockElement === canvas) this.look(event.movementX, event.movementY);
    });
    this.resize();
  }

  resize() {
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  createGrid() {
    if (this.grid) {
      this.scene.remove(this.grid);
      this.grid.geometry.dispose();
      this.grid.material.dispose();
    }
    const size = this.gridRadius * 2 * this.scale;
    this.grid = new this.THREE.GridHelper(size, this.gridRadius * 2, "#bac7cb", "#758189");
    this.grid.position.y = -0.5 * this.scale + 0.006 * this.scale;
    this.grid.material.transparent = true;
    this.grid.material.opacity = 0.55;
    this.grid.visible = this.gridVisible;
    this.scene.add(this.grid);
  }

  setScale(scale) {
    this.scale = scale;
    this.builder.setScale(scale);
    this.ground.position.y = -0.5 * scale;
    this.ground.scale.setScalar(scale);
    this.createGrid();
    this.setBuildPreview(this.buildPreviewCells, this.buildPreviewBounds);
  }

  setBuildPreview(cells, bounds) {
    this.buildPreviewCells = cells || [];
    this.buildPreviewBounds = bounds || null;
    this.buildPreviewOutline.visible = Boolean(bounds);
    if (!bounds) {
      if (this.buildPreviewMesh) this.buildPreviewMesh.visible = false;
      return;
    }

    if (this.buildPreviewCells.length) {
      if (!this.buildPreviewMesh || this.buildPreviewMesh.instanceMatrix.count < this.buildPreviewCells.length) {
        if (this.buildPreviewMesh) this.scene.remove(this.buildPreviewMesh);
        this.buildPreviewMesh = new this.THREE.InstancedMesh(
          this.buildPreviewGeometry,
          this.buildPreviewMaterial,
          this.buildPreviewCells.length
        );
        this.scene.add(this.buildPreviewMesh);
      }
      this.buildPreviewMesh.count = this.buildPreviewCells.length;
      this.buildPreviewCells.forEach((cell, index) => {
        this.previewTransform.position.set(cell.x * this.scale, cell.y * this.scale, cell.z * this.scale);
        this.previewTransform.scale.setScalar(this.scale);
        this.previewTransform.updateMatrix();
        this.buildPreviewMesh.setMatrixAt(index, this.previewTransform.matrix);
      });
      this.buildPreviewMesh.instanceMatrix.needsUpdate = true;
      this.buildPreviewMesh.computeBoundingSphere();
      this.buildPreviewMesh.visible = true;
    } else if (this.buildPreviewMesh) {
      this.buildPreviewMesh.visible = false;
    }
    this.buildPreviewOutline.position.set(
      (bounds.min.x + bounds.max.x) * 0.5 * this.scale,
      (bounds.min.y + bounds.max.y) * 0.5 * this.scale,
      (bounds.min.z + bounds.max.z) * 0.5 * this.scale
    );
    this.buildPreviewOutline.scale.set(
      (bounds.max.x - bounds.min.x + 1) * this.scale,
      (bounds.max.y - bounds.min.y + 1) * this.scale,
      (bounds.max.z - bounds.min.z + 1) * this.scale
    );
  }

  setGridRadius(radius) {
    this.gridRadius = radius;
    this.createGrid();
  }

  setGridVisible(visible) {
    this.gridVisible = visible;
    this.grid.visible = visible;
  }

  setAirDistance(distance) {
    this.airDistance = distance;
  }

  look(deltaX, deltaY) {
    this.yaw -= deltaX * 0.0025;
    this.pitch = Math.max(-Math.PI / 2 + 0.02, Math.min(Math.PI / 2 - 0.02, this.pitch - deltaY * 0.0025));
    this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
  }

  resetCamera() {
    this.camera.position.set(12, 9, 12);
    this.camera.lookAt(0, 0, 0);
    this.yaw = this.camera.rotation.y;
    this.pitch = this.camera.rotation.x;
  }

  update(input = {}) {
    const forward = (input.forward || 0) + (this.keys.has("KeyW") || this.keys.has("ArrowUp") ? 1 : 0) - (this.keys.has("KeyS") || this.keys.has("ArrowDown") ? 1 : 0);
    const side = (input.right || 0) + (this.keys.has("KeyD") ? 1 : 0) - (this.keys.has("KeyA") ? 1 : 0);
    const vertical = (input.vertical || 0) + (this.keys.has("Space") ? 1 : 0) - (this.keys.has("ShiftLeft") || this.keys.has("ControlLeft") ? 1 : 0);
    if (input.lookX || input.lookY) this.look((input.lookX || 0) * 8, (input.lookY || 0) * 8);
    const buildPanel = document.getElementById("build-panel");
    const textureSection = document.getElementById("texture-section");
    const textureEditorOpen = buildPanel && !buildPanel.hidden && textureSection && !textureSection.hidden;
    if (!textureEditorOpen) {
      const lookSpeed = 0.035;
      this.yaw += ((this.keys.has("KeyO") ? 1 : 0) - (this.keys.has("KeyL") ? 1 : 0)) * lookSpeed;
      this.pitch += ((this.keys.has("KeyI") ? 1 : 0) - (this.keys.has("KeyK") ? 1 : 0)) * lookSpeed;
      this.pitch = Math.max(-Math.PI / 2 + 0.02, Math.min(Math.PI / 2 - 0.02, this.pitch));
      this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
    }
    const length = Math.hypot(forward, side);
    const speed = this.scale * 10 / 60;
    if (length > 0) {
      const f = forward / Math.max(1, length);
      const s = side / Math.max(1, length);
      this.camera.position.x += (-Math.sin(this.yaw) * f + Math.cos(this.yaw) * s) * speed;
      this.camera.position.z += (-Math.cos(this.yaw) * f - Math.sin(this.yaw) * s) * speed;
    }
    this.camera.position.y += vertical * speed;
    this.updateTarget();
    this.renderer.render(this.scene, this.camera);
  }

  updateTarget() {
    this.raycaster.setFromCamera(this.center, this.camera);
    const blockMeshes = [...this.builder.blocks.values()];
    const blockHit = this.raycaster.intersectObjects(blockMeshes, false)[0];
    const groundHit = this.raycaster.intersectObject(this.ground, false)[0];
    const direction = new this.THREE.Vector3();
    this.camera.getWorldDirection(direction);
    let target;
    this.breakTarget = blockHit ? blockHit.object : null;
    if (blockHit) {
      const normal = blockHit.face.normal.clone().transformDirection(blockHit.object.matrixWorld);
      const step = new this.THREE.Vector3(
        Math.round(normal.x), Math.round(normal.y), Math.round(normal.z)
      );
      const cell = blockHit.object.userData.cell;
      target = { x: cell.x + step.x, y: cell.y + step.y, z: cell.z + step.z };
    } else if (groundHit) {
      target = {
        x: Math.round(groundHit.point.x / this.scale),
        y: 0,
        z: Math.round(groundHit.point.z / this.scale)
      };
    } else {
      const point = this.camera.position.clone().addScaledVector(direction, this.airDistance * this.scale);
      target = {
        x: Math.round(point.x / this.scale),
        y: Math.max(0, Math.round(point.y / this.scale)),
        z: Math.round(point.z / this.scale)
      };
    }
    this.target = target;
    this.preview.position.set(target.x * this.scale, target.y * this.scale, target.z * this.scale);
    this.preview.scale.setScalar(this.scale);
    this.preview.visible = true;
    if (this.onTarget) this.onTarget(target, this.breakTarget);
  }

  getTarget() {
    return this.target;
  }

  getBreakTarget() {
    return this.breakTarget;
  }
}
