export class Controls {
  constructor(app) {
    this.app = app;
    this.keys = {};
    this.mouseDown = false;
  }

  onKeyDown(event) {
    this.keys[event.code] = true;

    if (event.code === 'KeyB') {
      this.app.toggleBuildMenu();
    }

    if (event.code === 'KeyT') {
      const hidden = this.app.ui.textureEditor.classList.toggle('hidden');
      this.app.ui.toggleTextureEditor.textContent = hidden ? 'Texture Editor' : 'Hide Texture Editor';
    }

    if (event.code === 'KeyP' || event.code === 'KeyE') {
      this.app.builder.confirmSelection();
    }

    if (event.code === 'KeyM' || event.code === 'KeyQ') {
      this.app.builder.breakAtTarget();
    }

    if (event.code === 'Escape' || event.code === 'Digit0' || event.code === 'Numpad0') {
      this.app.builder.cancelSelection();
    }

    if (event.code === 'KeyI') {
      this.app.state.settings.noise = !this.app.state.settings.noise;
      this.app.ui.toggleNoise.textContent = `Noise: ${this.app.state.settings.noise ? 'On' : 'Off'}`;
    }

    if (event.code === 'KeyO' || event.code === 'KeyL') {
      const options = [1, 8, 16, 32];
      const current = Number(this.app.state.settings.textureSize || 16);
      const idx = options.indexOf(current);
      const next = options[(idx + 1) % options.length];
      this.app.state.settings.textureSize = next;
      this.app.ui.textureSize.value = String(next);
    }
  }

  onKeyUp(event) {
    this.keys[event.code] = false;
  }

  onMouseMove(event) {
    if (!this.mouseDown) return;
    this.app.renderer.cameraYaw -= event.movementX * 0.005;
    this.app.renderer.cameraPitch = Math.max(-1.4, Math.min(1.4, this.app.renderer.cameraPitch - event.movementY * 0.004));
  }

  onMouseDown(event) {
    if (event.button === 0) {
      this.mouseDown = true;
      this.app.builder.confirmSelection();
    }
  }

  update(dt) {
    const renderer = this.app.renderer;
    const move = { x: 0, y: 0, z: 0 };

    if (this.keys.KeyW) move.z += 1;
    if (this.keys.KeyS) move.z -= 1;
    if (this.keys.KeyA) move.x -= 1;
    if (this.keys.KeyD) move.x += 1;
    if (this.keys.Space) move.y += 1;
    if (this.keys.ShiftLeft || this.keys.ShiftRight) move.y -= 1;

    if (this.keys.KeyI) renderer.cameraPitch += 0.03;
    if (this.keys.KeyK) renderer.cameraPitch -= 0.03;
    if (this.keys.KeyL) renderer.cameraYaw += 0.03;
    if (this.keys.KeyO) renderer.cameraYaw -= 0.03;

    const gamepad = navigator.getGamepads ? navigator.getGamepads()[0] : null;
    if (gamepad) {
      this.app.state.controllerConnected = true;
      this.app.updateControlHints();

      const [lx, ly] = gamepad.axes;
      move.x += lx;
      move.z -= ly;

      if (gamepad.buttons[5]?.pressed) {
        this.app.builder.breakAtTarget();
      }

      if (gamepad.buttons[7]?.pressed) {
        this.app.toggleBuildMenu();
      }

      if (gamepad.buttons[0]?.pressed) {
        this.app.builder.confirmSelection();
      }

      if (gamepad.buttons[1]?.pressed) {
        this.app.builder.cancelSelection();
      }

      renderer.cameraYaw += (gamepad.axes[2] || 0) * 0.05;
      renderer.cameraPitch = Math.max(-1.4, Math.min(1.4, renderer.cameraPitch + (gamepad.axes[3] || 0) * 0.045));
    } else {
      this.app.state.controllerConnected = false;
      this.app.updateControlHints();
    }

    const forward = new THREE.Vector3(
      Math.sin(renderer.cameraYaw) * Math.cos(renderer.cameraPitch),
      Math.sin(renderer.cameraPitch),
      Math.cos(renderer.cameraYaw) * Math.cos(renderer.cameraPitch)
    ).normalize();

    const right = new THREE.Vector3(Math.cos(renderer.cameraYaw), 0, -Math.sin(renderer.cameraYaw)).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const velo = new THREE.Vector3();
    velo.addScaledVector(forward, move.z * dt * 8);
    velo.addScaledVector(right, move.x * dt * 8);
    velo.addScaledVector(up, move.y * dt * 8);
    renderer.camera.position.add(velo);

    if (this.keys.KeyP || this.keys.KeyE) {
      this.app.builder.confirmSelection();
      this.keys.KeyP = false;
      this.keys.KeyE = false;
    }

    if (this.keys.KeyM || this.keys.KeyQ) {
      this.app.builder.breakAtTarget();
      this.keys.KeyM = false;
      this.keys.KeyQ = false;
    }
  }

  getMoveVector() {
    const result = { x: 0, y: 0, z: 0 };

    if (this.keys.KeyW) result.z += 1;
    if (this.keys.KeyS) result.z -= 1;
    if (this.keys.KeyA) result.x -= 1;
    if (this.keys.KeyD) result.x += 1;
    if (this.keys.Space) result.y += 1;
    if (this.keys.ShiftLeft || this.keys.ShiftRight) result.y -= 1;

    return result;
  }
}
