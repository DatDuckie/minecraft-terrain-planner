import { TerrainRenderer } from './renderer.js';
import { Builder } from './builder.js';
import { Controls } from './controls.js';
import { PaletteManager } from './palette.js';
import { SaveSystem } from './save-system.js';

class TerrainPlannerApp {
  constructor() {
    this.state = {
      tool: 'block',
      buildMenuOpen: true,
      activeColor: '#ff6f61',
      settings: {
        blockScale: 1,
        gridRadius: 32,
        airPlacementDistance: 4,
        textureSize: 16,
        noise: false
      },
      palette: ['#ff6f61', '#7ad1ff', '#9be16a', '#f7d06d', '#ff9f62', '#7f76ff', '#d18cff', '#f0f0f0', '#999999', '#1fbf74'],
      controllerConnected: false
    };

    this.ui = {};
    this.renderer = null;
    this.builder = null;
    this.controls = null;
    this.palette = null;
    this.saveSystem = null;
    this.lastFrame = performance.now();
  }

  cacheDom() {
    this.ui = {
      viewport: document.getElementById('viewport'),
      buildMenu: document.getElementById('buildMenu'),
      toggleMenuBtn: document.getElementById('toggleMenuBtn'),
      toolSelector: document.getElementById('toolSelector'),
      toolList: document.getElementById('toolList'),
      coords: document.getElementById('coords'),
      colorPicker: document.getElementById('colorPicker'),
      activeColorLabel: document.getElementById('activeColorLabel'),
      paletteSwatches: document.getElementById('paletteSwatches'),
      textureEditor: document.getElementById('textureEditor'),
      toggleTextureEditor: document.getElementById('toggleTextureEditor'),
      textureSize: document.getElementById('textureSize'),
      toggleNoise: document.getElementById('toggleNoise'),
      applyTexture: document.getElementById('applyTexture'),
      blockScale: document.getElementById('blockScale'),
      gridRadius: document.getElementById('gridRadius'),
      airDistance: document.getElementById('airDistance'),
      exportWorld: document.getElementById('exportWorld'),
      importWorld: document.getElementById('importWorld'),
      importFile: document.getElementById('importFile'),
      resetWorld: document.getElementById('resetWorld'),
      inputHints: document.getElementById('inputHints')
    };
  }

  init() {
    this.cacheDom();
    this.renderer = new TerrainRenderer(this);
    this.builder = new Builder(this);
    this.controls = new Controls(this);
    this.palette = new PaletteManager(this);
    this.saveSystem = new SaveSystem(this);

    this.bindEvents();
    this.updateControlHints();
    this.palette.syncSwatches();
    this.palette.setColor(this.state.activeColor, true);
    this.syncSettingsControls();
    this.renderer.setup();

    const saved = this.saveSystem.load();
    if (saved) {
      if (saved.settings) Object.assign(this.state.settings, saved.settings);
      if (saved.color) this.palette.setColor(saved.color, true);
      if (saved.world) this.builder.loadWorld(saved.world);
      this.syncSettingsControls();
    }

    this.setTool(this.state.tool, true);
    this.updateBuildMenuVisibility();
    this.startLoop();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch((error) => console.warn('SW registration failed:', error));
    }
  }

  bindEvents() {
    document.querySelectorAll('.tool-box, .menu-tool').forEach((button) => {
      button.addEventListener('click', () => this.setTool(button.dataset.tool));
    });

    this.ui.toggleMenuBtn.addEventListener('click', () => this.toggleBuildMenu());
    this.ui.colorPicker.addEventListener('input', (event) => this.palette.setColor(event.target.value, true));

    this.ui.toggleTextureEditor.addEventListener('click', () => {
      const hidden = this.ui.textureEditor.classList.toggle('hidden');
      this.ui.toggleTextureEditor.textContent = hidden ? 'Texture Editor' : 'Hide Texture Editor';
    });

    this.ui.textureSize.addEventListener('change', (event) => {
      this.state.settings.textureSize = Number(event.target.value);
    });

    this.ui.toggleNoise.addEventListener('click', () => {
      this.state.settings.noise = !this.state.settings.noise;
      this.ui.toggleNoise.textContent = `Noise: ${this.state.settings.noise ? 'On' : 'Off'}`;
    });

    this.ui.applyTexture.addEventListener('click', () => {
      // texture generation is intentionally lightweight in this version
      this.saveSystem.save();
    });

    this.ui.blockScale.addEventListener('input', (event) => {
      this.state.settings.blockScale = Number(event.target.value);
      this.renderer.updateBlockScale();
    });

    this.ui.gridRadius.addEventListener('input', (event) => {
      this.state.settings.gridRadius = Number(event.target.value);
      this.renderer.updateGridRadius(this.state.settings.gridRadius);
    });

    this.ui.airDistance.addEventListener('input', (event) => {
      this.state.settings.airPlacementDistance = Number(event.target.value);
    });

    this.ui.exportWorld.addEventListener('click', () => this.saveSystem.exportWorld());
    this.ui.importWorld.addEventListener('click', () => this.ui.importFile.click());
    this.ui.importFile.addEventListener('change', (event) => this.saveSystem.importWorld(event.target.files[0]));
    this.ui.resetWorld.addEventListener('click', () => this.saveSystem.masterReset());

    window.addEventListener('keydown', (event) => this.controls.onKeyDown(event));
    window.addEventListener('keyup', (event) => this.controls.onKeyUp(event));
    window.addEventListener('mousemove', (event) => this.controls.onMouseMove(event));
    window.addEventListener('mousedown', (event) => this.controls.onMouseDown(event));
    window.addEventListener('mouseup', () => { this.controls.mouseDown = false; });
    window.addEventListener('contextmenu', (event) => event.preventDefault());
    window.addEventListener('resize', () => this.renderer.resize());
    window.addEventListener('gamepadconnected', () => this.updateControlHints());
    window.addEventListener('gamepaddisconnected', () => this.updateControlHints());
  }

  setTool(toolName, skipUi = false) {
    this.state.tool = toolName;
    this.builder.setTool(toolName);

    if (!skipUi) {
      document.querySelectorAll('.tool-box, .menu-tool').forEach((button) => {
        const active = button.dataset.tool === toolName;
        button.classList.toggle('active', active);
      });
    }
  }

  toggleBuildMenu(forceState) {
    this.state.buildMenuOpen = typeof forceState === 'boolean' ? forceState : !this.state.buildMenuOpen;
    this.updateBuildMenuVisibility();
  }

  updateBuildMenuVisibility() {
    this.ui.buildMenu.classList.toggle('open', this.state.buildMenuOpen);
    this.ui.toggleMenuBtn.textContent = this.state.buildMenuOpen ? 'Hide' : 'Show';
  }

  syncSettingsControls() {
    this.ui.blockScale.value = String(this.state.settings.blockScale);
    this.ui.gridRadius.value = String(this.state.settings.gridRadius);
    this.ui.airDistance.value = String(this.state.settings.airPlacementDistance);
    this.ui.textureSize.value = String(this.state.settings.textureSize);
    this.ui.toggleNoise.textContent = `Noise: ${this.state.settings.noise ? 'On' : 'Off'}`;
  }

  updateControlHints() {
    if (this.state.controllerConnected || navigator.getGamepads?.().some(Boolean)) {
      this.ui.inputHints.innerHTML = `
        <div class="hint-row"><span class="hint-key">LS</span><span>Fly</span></div>
        <div class="hint-row"><span class="hint-key">RS</span><span>Look</span></div>
        <div class="hint-row"><span class="hint-key">RT</span><span>Place</span></div>
        <div class="hint-row"><span class="hint-key">LT</span><span>Break</span></div>
      `;
    } else {
      this.ui.inputHints.innerHTML = `
        <div class="hint-row"><span class="hint-key">WASD</span><span>Fly</span></div>
        <div class="hint-row"><span class="hint-key">I/K/O/L</span><span>Look</span></div>
        <div class="hint-row"><span class="hint-key">P / E</span><span>Place</span></div>
        <div class="hint-row"><span class="hint-key">M / Q</span><span>Break</span></div>
      `;
    }
  }

  startLoop() {
    const tick = (time) => {
      const dt = Math.min((time - this.lastFrame) / 1000, 0.033);
      this.lastFrame = time;
      this.controls.update(dt);
      this.renderer.update(dt);
      this.builder.updatePreview();
      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }

  setCoords(x, y, z) {
    this.ui.coords.textContent = `X:${Math.round(x)} Y:${Math.round(y)} Z:${Math.round(z)}`;
  }
}

window.app = new TerrainPlannerApp();
window.app.init();
