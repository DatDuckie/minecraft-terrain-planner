export class Controls {
  constructor({ renderer, callbacks, indicator }) {
    this.renderer = renderer;
    this.callbacks = callbacks;
    this.indicator = indicator;
    this.input = { forward: 0, right: 0, vertical: 0, lookX: 0, lookY: 0 };
    this.gamepadInput = { forward: 0, right: 0, vertical: 0, lookX: 0, lookY: 0 };
    this.previousButtons = [];
    this.lastGamepad = null;
    this.activeInputMode = null;
  }

  setInputMode(mode) {
    if (this.activeInputMode === mode) return;
    this.activeInputMode = mode;
    this.callbacks.inputMode(mode);
  }

  pressed(gamepad, index) {
    return Boolean(gamepad.buttons[index] && (gamepad.buttons[index].pressed || gamepad.buttons[index].value > 0.55));
  }

  edge(gamepad, index) {
    const value = this.pressed(gamepad, index);
    const rising = value && !this.previousButtons[index];
    this.previousButtons[index] = value;
    return rising;
  }

  update() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gamepad = [...gamepads].find(pad => pad && pad.connected);
    if (!gamepad) {
      this.setInputMode("keyboard");
      this.lastGamepad = null;
      this.previousButtons = [];
      this.indicator?.classList.remove("connected");
      this.gamepadInput = { forward: 0, right: 0, vertical: 0, lookX: 0, lookY: 0 };
      return this.combineInput();
    }
    this.setInputMode("gamepad");
    this.lastGamepad = gamepad;
    this.indicator?.classList.add("connected");
    const deadzone = value => Math.abs(value || 0) < 0.16 ? 0 : value;
    const axes = gamepad.axes || [];
    this.gamepadInput.right = deadzone(axes[0]);
    this.gamepadInput.forward = -deadzone(axes[1]);
    this.gamepadInput.lookX = deadzone(axes[2]);
    this.gamepadInput.lookY = deadzone(axes[3]);
    const textureEditorOpen = this.callbacks.textureEditorOpen();
    const placementPending = this.callbacks.placementPending();
    this.gamepadInput.vertical =
      (this.pressed(gamepad, 0) && !textureEditorOpen ? 1 : 0) -
      (this.pressed(gamepad, 1) && !textureEditorOpen && !placementPending ? 1 : 0);

    if (this.edge(gamepad, 14)) {
      if (textureEditorOpen) this.callbacks.textureSize(-1);
      else this.callbacks.category(-1);
    }
    if (this.edge(gamepad, 15)) {
      if (textureEditorOpen) this.callbacks.textureSize(1);
      else this.callbacks.category(1);
    }
    if (this.edge(gamepad, 12)) this.callbacks.tool(-1);
    if (this.edge(gamepad, 13)) this.callbacks.tool(1);
    if (this.edge(gamepad, 6)) this.callbacks.breakBlock();
    if (this.edge(gamepad, 7)) this.callbacks.placeBlock();
    if (this.edge(gamepad, 0) && textureEditorOpen) this.callbacks.toggleTextureNoise();
    if (this.edge(gamepad, 1)) {
      if (textureEditorOpen) this.callbacks.applyTexture();
      else if (this.callbacks.placementPending()) this.callbacks.cancelPlacement();
    }
    if (this.edge(gamepad, 3)) this.callbacks.cycleColor();
    if (this.edge(gamepad, 2)) this.callbacks.settings();
    if (this.edge(gamepad, 4)) this.callbacks.textureEditor();
    if (this.edge(gamepad, 8)) this.callbacks.buildMenu();
    return this.combineInput();
  }

  combineInput() {
    const clamp = value => Math.max(-1, Math.min(1, value));
    for (const axis of ["forward", "right", "vertical"]) {
      this.input[axis] = clamp(this.gamepadInput[axis]);
    }
    this.input.lookX = this.gamepadInput.lookX;
    this.input.lookY = this.gamepadInput.lookY;
    return this.input;
  }
}
