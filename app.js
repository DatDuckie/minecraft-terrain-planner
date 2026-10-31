import * as THREE from "three";
import { Builder, CATEGORIES, shapeCells } from "./builder.js";
import { Controls } from "./controls.js";
import { COLORS, clearTexture, createBlockMaterial, cycleColor, customColors, saveCustomColor, selectedColor, setColor, setCustomColors, setTexture } from "./palette.js";
import { normalizeSettings, DEFAULT_SETTINGS, SaveSystem } from "./save-system.js";
import { WorldRenderer } from "./renderer.js";

const $ = selector => document.querySelector(selector);
const canvas = $("#world-canvas");
const status = $("#save-status");
const saveSystem = new SaveSystem();
const TEXTURE_SIZES = [1, 8, 16, 32];
const FLAT_TOOLS = new Set(["floor", "circle", "quarter", "arc"]);
let settings = { ...DEFAULT_SETTINGS };
let renderer;
let builder;
let controls;
let currentCategory = 0;
let currentTool = 0;
let saveTimer;
let toastTimer;
let textureBuffer = [];
let textureBufferSize = 8;
let inputMode = null;
let placement = {
  phase: "first",
  first: null,
  second: null,
  bounds: null,
  cells: [],
  previewKey: ""
};

function showToast(message, duration = 2400) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), duration);
}

function showStatus(message, failed = false) {
  status.textContent = message;
  status.style.color = failed ? "#ff7777" : "";
}

function saveNow() {
  clearTimeout(saveTimer);
  try {
    saveSystem.save(settings, builder.exportData());
    showStatus("Saved locally");
  } catch (error) {
    console.error("Could not save the world.", error);
    showStatus("Save failed", true);
    showToast(`Save failed: ${error.message}`, 4000);
  }
}

function scheduleSave() {
  showStatus("Saving…");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 350);
}

function activeTool() {
  const category = CATEGORIES[currentCategory];
  return category.tools[currentTool] || category.tools[0];
}

function textureEditorOpen() {
  return !$("#build-panel").hidden && !$("#texture-section").hidden;
}

function updateControllerHints() {
  const editorOpen = textureEditorOpen();
  $("#action-hints").hidden = editorOpen;
  $("#texture-gamepad-hint").hidden = !editorOpen;
  document.querySelectorAll(".gamepad-hint").forEach(hint => { hint.hidden = inputMode !== "gamepad"; });
  document.querySelectorAll(".keyboard-hint").forEach(hint => { hint.hidden = inputMode !== "keyboard"; });
}

function setInputMode(mode) {
  if (inputMode === mode) return;
  inputMode = mode;
  updateControllerHints();
  refreshPlacementMessage();
}

function setTextureEditorOpen(open) {
  if (open && placement.phase !== "first") cancelPlacement();
  const section = $("#texture-section");
  section.hidden = !open;
  $("#build-panel").classList.toggle("texture-editor-open", open);
  $("#palette-tab").textContent = open ? "TOOLS" : "EDIT";
  updateControllerHints();
}

function setBuildMenuOpen(open) {
  if (open && !$("#settings-panel").hidden) setSettingsOpen(false);
  $("#build-panel").hidden = !open;
  $("#build-menu-toggle").setAttribute("aria-expanded", String(open));
  $("#build-menu-toggle").setAttribute("aria-label", `${open ? "Close" : "Open"} build menu`);
  updateControllerHints();
}

function toolIconSvg(id) {
  const cells = {
    block: [[13, 13]],
    wall: [[2, 13], [8, 13], [14, 13], [20, 13], [26, 13]],
    floor: [[5, 5], [13, 5], [21, 5], [5, 13], [13, 13], [21, 13], [5, 21], [13, 21], [21, 21]],
    pillar: [[13, 1], [13, 8], [13, 15], [13, 22]],
    diagonal: [[2, 22], [8, 16], [14, 10], [20, 4]],
    stairs: [[2, 22], [8, 16], [14, 16], [20, 10], [26, 10]],
    ramp: [[2, 22], [8, 16], [14, 10], [20, 4]],
    extend: [[1, 13], [7, 13], [13, 13], [19, 13], [25, 13]],
    circle: [[9, 1], [17, 1], [1, 9], [9, 9], [17, 9], [25, 9], [1, 17], [9, 17], [17, 17], [25, 17], [9, 25], [17, 25]],
    quarter: [[17, 1], [25, 1], [9, 9], [17, 9], [25, 9], [1, 17], [9, 17], [17, 17], [25, 17]],
    arc: [[9, 1], [17, 1], [1, 9], [25, 9], [1, 17], [25, 17], [9, 25], [17, 25]],
    cylinder: [[9, 1], [17, 1], [1, 9], [9, 9], [17, 9], [25, 9], [1, 17], [9, 17], [17, 17], [25, 17], [9, 25], [17, 25]],
    sphere: [[9, 1], [17, 1], [1, 9], [9, 9], [17, 9], [25, 9], [1, 17], [9, 17], [17, 17], [25, 17], [9, 25], [17, 25]],
    hill: [[9, 1], [17, 1], [1, 9], [9, 9], [17, 9], [25, 9], [1, 17], [9, 17], [17, 17], [25, 17], [1, 25], [9, 25], [17, 25], [25, 25]],
    volume: [[5, 5], [13, 5], [21, 5], [5, 13], [13, 13], [21, 13], [5, 21], [13, 21], [21, 21]]
  }[id] || [[13, 13]];
  return `<svg viewBox="0 0 32 32" aria-hidden="true">${cells.map(([x, y]) =>
    `<rect x="${x}" y="${y}" width="5" height="5" rx=".45" fill="#281414" stroke="#ed5a5a" stroke-width="1.2"/>`
  ).join("")}</svg>`;
}

function renderCategories() {
  const list = $("#category-list");
  list.replaceChildren();
  CATEGORIES.forEach((category, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `category-button${index === currentCategory ? " active" : ""}`;
    button.setAttribute("aria-pressed", String(index === currentCategory));
    button.innerHTML = `${category.icon} ${category.name}<span>${category.caption}</span>`;
    button.addEventListener("click", () => selectCategory(index));
    list.append(button);
  });
}

function renderTools() {
  const list = $("#tool-list");
  const category = CATEGORIES[currentCategory];
  list.replaceChildren();
  category.tools.forEach((tool, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `tool-option${index === currentTool ? " active" : ""}`;
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", String(index === currentTool));
    button.innerHTML = `<span class="tool-icon">${toolIconSvg(tool.id)}</span><span>${tool.name}</span><span class="tool-index">${String(index + 1).padStart(2, "0")}</span>`;
    button.title = tool.detail;
    button.addEventListener("click", () => selectTool(index));
    list.append(button);
  });
  $("#tool-count").textContent = String(category.tools.length).padStart(2, "0");
  renderStack();
}

function renderStack() {
  const stack = $("#selection-stack");
  stack.replaceChildren();
  const category = CATEGORIES[currentCategory];
  const previous = category.tools[(currentTool - 1 + category.tools.length) % category.tools.length];
  const selected = activeTool();
  const next = category.tools[(currentTool + 1) % category.tools.length];
  const card = (tool, active = false) => `<div class="stack-card${active ? " active" : ""}"><span class="stack-icon">${toolIconSvg(tool.id)}</span><span class="stack-copy"><strong>${tool.name}</strong><small>${tool.detail}</small></span></div>`;
  stack.innerHTML = `<span class="stack-arrows">⌃</span>
    ${card(previous)}
    ${card(selected, true)}
    ${card(next)}
    <span class="stack-arrows">⌄</span>`;
}

function selectCategory(index) {
  if (placement.phase !== "first") cancelPlacement();
  currentCategory = (index + CATEGORIES.length) % CATEGORIES.length;
  currentTool = 0;
  if (CATEGORIES[currentCategory].id === "settings") setSettingsOpen(true);
  renderCategories();
  renderTools();
}

function selectTool(index) {
  if (placement.phase !== "first") cancelPlacement();
  const tools = CATEGORIES[currentCategory].tools;
  currentTool = (index + tools.length) % tools.length;
  if (CATEGORIES[currentCategory].id === "settings") {
    selectCategory(0);
    return;
  }
  renderTools();
}

function setSettingsOpen(open) {
  if (open) {
    if (placement.phase !== "first") cancelPlacement();
    $("#build-panel").hidden = true;
    $("#build-menu-toggle").setAttribute("aria-expanded", "false");
    $("#build-menu-toggle").setAttribute("aria-label", "Open build menu");
  }
  $("#settings-panel").hidden = !open;
  $("#settings-toggle").setAttribute("aria-expanded", String(open));
  updateControllerHints();
}

function renderPalette() {
  const container = $("#palette-swatches");
  container.replaceChildren();
  [...COLORS, ...customColors].forEach(color => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `swatch${color.toLowerCase() === selectedColor.toLowerCase() ? " active" : ""}`;
    button.style.background = color;
    button.setAttribute("aria-label", `Select ${color}`);
    button.setAttribute("aria-pressed", String(color.toLowerCase() === selectedColor.toLowerCase()));
    button.addEventListener("click", () => {
      setColor(color);
      $("#custom-color").value = color;
      if (textureEditorOpen()) setTextureEditorSize(textureBufferSize);
      renderPalette();
    });
    container.append(button);
  });
}

function setWorldSettings(next) {
  settings = normalizeSettings(next);
  setCustomColors(settings.customColors);
  if (settings.activeTexture) {
    setTexture([...settings.activeTexture.pixels], settings.activeTexture.size);
    builder.setTexture({ pixels: [...settings.activeTexture.pixels], size: settings.activeTexture.size });
  } else {
    clearTexture();
    builder.setTexture(null);
  }
  renderer.setScale(settings.blockScale);
  renderer.setGridRadius(settings.gridRadius);
  renderer.setAirDistance(settings.airDistance);
  $("#block-scale").value = String(settings.blockScale);
  $("#block-scale-value").textContent = `${settings.blockScale.toFixed(1)}×`;
  $("#grid-radius").value = String(settings.gridRadius);
  $("#grid-radius-value").textContent = `${settings.gridRadius} blocks`;
  $("#air-distance").value = String(settings.airDistance);
  $("#air-distance-value").textContent = `${settings.airDistance} blocks`;
}

function placementBounds(first, second, topY) {
  return {
    min: {
      x: Math.min(first.x, second.x),
      y: first.y,
      z: Math.min(first.z, second.z)
    },
    max: {
      x: Math.max(first.x, second.x),
      y: Math.max(first.y, topY),
      z: Math.max(first.z, second.z)
    }
  };
}

function boundsDescription(bounds, count) {
  const width = bounds.max.x - bounds.min.x + 1;
  const height = bounds.max.y - bounds.min.y + 1;
  const depth = bounds.max.z - bounds.min.z + 1;
  return `${width} × ${depth} × ${height} · ${count} block${count === 1 ? "" : "s"}`;
}

function setPlacementMessage(message) {
  $("#placement-status").textContent = message;
  const dimensions = $("#placement-dimensions");
  if (!placement.bounds || !["height", "confirm"].includes(placement.phase)) {
    dimensions.hidden = true;
    dimensions.textContent = "";
    return;
  }
  const { min, max } = placement.bounds;
  const width = max.x - min.x + 1;
  const height = max.y - min.y + 1;
  const depth = max.z - min.z + 1;
  const count = placement.cells.length;
  dimensions.hidden = false;
  dimensions.textContent = `X ${min.x}–${max.x}  ·  Y ${min.y}–${max.y}  ·  Z ${min.z}–${max.z}    ${width} × ${depth} × ${height}  ·  ${count} block${count === 1 ? "" : "s"}`;
}

function placeActionHint() {
  return inputMode === "gamepad" ? "RT" : "P / E";
}

function resetPlacement(message = `${placeActionHint()}: Select first base corner`) {
  placement = { phase: "first", first: null, second: null, bounds: null, cells: [], previewKey: "" };
  renderer.setBuildPreview([], null);
  setPlacementMessage(message);
}

function cancelPlacementHint() {
  return inputMode === "gamepad" ? "B / 0: Cancel" : "0 / Esc: Cancel";
}

function refreshPlacementMessage() {
  const place = placeActionHint();
  const cancel = cancelPlacementHint();
  if (placement.phase === "first") {
    setPlacementMessage(`${place}: Select first base corner`);
  } else if (placement.phase === "second") {
    setPlacementMessage(`Select opposite X / Z corner on this Y · ${place} · ${cancel}`);
  } else if (placement.phase === "height") {
    placement.previewKey = "";
    updatePlacementPreview(renderer?.getTarget());
  } else {
    const previewType = FLAT_TOOLS.has(activeTool().id) ? "Flat preview" : "Preview locked";
    setPlacementMessage(`${previewType} · ${place}: Build · ${boundsDescription(placement.bounds, placement.cells.length)} · ${cancel}`);
  }
}

function cancelPlacement() {
  if (placement.phase === "first") return;
  resetPlacement(`Shape canceled · ${placeActionHint()}: Select first base corner`);
}

function updatePlacementPreview(target) {
  if (placement.phase !== "height" || !placement.first || !placement.second || !target) return;
  const bounds = placementBounds(placement.first, placement.second, target.y);
  const key = `${activeTool().id}:${bounds.min.x},${bounds.min.y},${bounds.min.z}:${bounds.max.x},${bounds.max.y},${bounds.max.z}`;
  if (key === placement.previewKey) return;
  placement.previewKey = key;
  try {
    placement.cells = shapeCells(bounds, activeTool().id);
    placement.bounds = bounds;
    renderer.setBuildPreview(placement.cells, bounds);
    setPlacementMessage(`Aim top Y · ${placeActionHint()}: Lock preview · ${cancelPlacementHint()}`);
  } catch (error) {
    placement.bounds = null;
    placement.cells = [];
    renderer.setBuildPreview([], null);
    setPlacementMessage(`${error.message} · ${cancelPlacementHint()}`);
  }
}

function placeBlock() {
  const target = renderer.getTarget();
  if (!target) return;
  if (placement.phase === "first") {
    placement.first = { ...target };
    placement.phase = "second";
    setPlacementMessage(`Select opposite X / Z corner on this Y · ${placeActionHint()} · ${cancelPlacementHint()}`);
    return;
  }
  if (placement.phase === "second") {
    placement.second = { x: target.x, y: placement.first.y, z: target.z };
    if (FLAT_TOOLS.has(activeTool().id)) {
      const bounds = placementBounds(placement.first, placement.second, placement.first.y);
      try {
        placement.cells = shapeCells(bounds, activeTool().id);
        placement.bounds = bounds;
        placement.phase = "confirm";
        renderer.setBuildPreview(placement.cells, bounds);
        setPlacementMessage(`Flat preview · ${placeActionHint()}: Build · ${cancelPlacementHint()}`);
      } catch (error) {
        placement.second = null;
        showToast(error.message, 3500);
        setPlacementMessage(`Choose a smaller base · ${placeActionHint()} · ${cancelPlacementHint()}`);
      }
      return;
    }
    placement.phase = "height";
    placement.previewKey = "";
    updatePlacementPreview(target);
    return;
  }
  if (placement.phase === "height") {
    updatePlacementPreview(target);
    if (!placement.bounds || !placement.cells.length) {
      showToast("Aim at a valid height to preview this shape");
      return;
    }
    placement.phase = "confirm";
    setPlacementMessage(`Preview locked · ${placeActionHint()}: Build · ${cancelPlacementHint()}`);
    return;
  }
  try {
    const count = builder.place(placement.bounds, activeTool().id, selectedColor, createBlockMaterial);
    resetPlacement();
    showToast(count ? `${count} block${count === 1 ? "" : "s"} placed` : "No new blocks; selected cells are occupied");
  } catch (error) {
    showToast(error.message, 3500);
  }
}

function breakBlock() {
  const target = renderer.getBreakTarget();
  if (builder.break(target)) showToast("Block removed");
}

function setTextureEditorSize(size, pixels = null) {
  textureBufferSize = size;
  textureBuffer = pixels && pixels.length === size * size
    ? [...pixels]
    : createTexturePixels(size, selectedColor, settings.textureNoise);
  drawTexture();
  renderTextureControls();
}

function syncTextureEditor(texture) {
  const size = TEXTURE_SIZES.includes(settings.textureSize) ? settings.textureSize : 1;
  const pixels = texture?.size === size ? texture.pixels : null;
  $("#texture-noise").setAttribute("aria-pressed", String(settings.textureNoise));
  setTextureEditorSize(size, pixels);
}

function createTexturePixels(size, color, noise) {
  const value = Number.parseInt(color.slice(1), 16);
  const base = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  return Array.from({ length: size * size }, () => {
    const shade = noise ? 0.76 + Math.random() * 0.42 : 1;
    return `#${base.map(channel => Math.min(255, Math.max(0, Math.round(channel * shade))).toString(16).padStart(2, "0")).join("")}`;
  });
}

function renderTextureControls() {
  document.querySelectorAll(".texture-size-option").forEach(button => {
    const selected = Number(button.dataset.size) === textureBufferSize;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  const noise = $("#texture-noise");
  noise.setAttribute("aria-pressed", String(settings.textureNoise));
  noise.innerHTML = `NOISE ${settings.textureNoise ? "ON" : "OFF"} <kbd>A</kbd>`;
}

function selectTextureSize(size) {
  if (!TEXTURE_SIZES.includes(size)) return;
  settings.textureSize = size;
  setTextureEditorSize(size);
  scheduleSave();
}

function toggleTextureNoise() {
  settings.textureNoise = !settings.textureNoise;
  setTextureEditorSize(textureBufferSize);
  scheduleSave();
}

function applyTexture() {
  const texture = { pixels: [...textureBuffer], size: textureBufferSize };
  settings.textureSize = textureBufferSize;
  settings.activeTexture = texture;
  setTexture([...texture.pixels], texture.size);
  builder.setTexture(texture);
  scheduleSave();
  showToast("Texture applied to new blocks");
}

function drawTexture() {
  const editor = $("#texture-canvas");
  const context = editor.getContext("2d");
  const cellSize = editor.width / textureBufferSize;
  context.clearRect(0, 0, editor.width, editor.height);
  context.imageSmoothingEnabled = false;
  textureBuffer.forEach((color, index) => {
    context.fillStyle = color;
    context.fillRect((index % textureBufferSize) * cellSize, Math.floor(index / textureBufferSize) * cellSize, cellSize, cellSize);
  });
}

function createManifest() {
  const drawIcon = size => {
    const icon = document.createElement("canvas");
    icon.width = size;
    icon.height = size;
    const ctx = icon.getContext("2d");
    const scale = size / 192;
    const polygon = (points, color) => {
      ctx.beginPath();
      points.forEach(([x, y], i) => i ? ctx.lineTo(x * scale, y * scale) : ctx.moveTo(x * scale, y * scale));
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = "#ffffff55";
      ctx.lineWidth = 3 * scale;
      ctx.stroke();
    };
    ctx.fillStyle = "#101010";
    ctx.fillRect(0, 0, size, size);
    polygon([[96, 27], [157, 60], [96, 94], [35, 60]], "#45a85a");
    polygon([[35, 60], [96, 94], [96, 166], [35, 132]], "#d84646");
    polygon([[96, 94], [157, 60], [157, 132], [96, 166]], "#4188d2");
    return icon;
  };
  const icon192 = drawIcon(192);
  const brand = $("#brand-icon");
  brand.getContext("2d").drawImage(icon192, 0, 0, brand.width, brand.height);
}

function bindInterface() {
  $("#build-menu-toggle").addEventListener("click", () => setBuildMenuOpen($("#build-panel").hidden));
  $("#build-menu-close").addEventListener("click", () => setBuildMenuOpen(false));
  $("#settings-toggle").addEventListener("click", () => setSettingsOpen($("#settings-panel").hidden));
  $(".panel-close").addEventListener("click", () => setSettingsOpen(false));
  $("#block-scale").addEventListener("input", event => {
    setWorldSettings({ ...settings, blockScale: Number(event.target.value) });
    scheduleSave();
  });
  $("#grid-radius").addEventListener("input", event => {
    setWorldSettings({ ...settings, gridRadius: Number(event.target.value) });
    scheduleSave();
  });
  $("#air-distance").addEventListener("input", event => {
    setWorldSettings({ ...settings, airDistance: Number(event.target.value) });
    scheduleSave();
  });
  $("#toggle-grid").addEventListener("click", event => {
    const button = event.currentTarget;
    button.classList.toggle("active");
    renderer.setGridVisible(button.classList.contains("active"));
  });
  $("#focus-player").addEventListener("click", () => renderer.resetCamera());
  $("#custom-color").addEventListener("input", event => {
    setColor(event.target.value);
    if (textureEditorOpen()) setTextureEditorSize(textureBufferSize);
    renderPalette();
  });
  $("#save-custom-color").addEventListener("click", () => {
    saveCustomColor(selectedColor);
    setWorldSettings({ ...settings, customColors: [...customColors] });
    renderPalette();
    scheduleSave();
    showToast("Color saved to palette");
  });
  $("#palette-tab").addEventListener("click", () => {
    setTextureEditorOpen($("#texture-section").hidden);
  });
  $("#texture-close").addEventListener("click", () => {
    setTextureEditorOpen(false);
  });
  document.querySelectorAll(".texture-size-option").forEach(button =>
    button.addEventListener("click", () => selectTextureSize(Number(button.dataset.size)))
  );
  $("#texture-noise").addEventListener("click", toggleTextureNoise);
  $("#texture-apply").addEventListener("click", applyTexture);
  $("#export-world").addEventListener("click", () => {
    try {
      saveSystem.exportFile(settings, builder.exportData());
      showToast("World exported");
    } catch (error) {
      showToast(`Export failed: ${error.message}`, 4000);
    }
  });
  $("#import-world").addEventListener("click", () => $("#import-file").click());
  $("#import-file").addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error("World files must be smaller than 20 MB.");
      const imported = saveSystem.parseImport(await file.text());
      resetPlacement();
      builder.importData(imported.world, createBlockMaterial);
      setWorldSettings(imported.settings);
      syncTextureEditor(imported.settings.activeTexture);
      renderPalette();
      saveNow();
      showToast("World imported");
    } catch (error) {
      console.error("Could not import world.", error);
      showToast(`Import failed: ${error.message}`, 5000);
    } finally {
      event.target.value = "";
    }
  });
  $("#master-reset").addEventListener("click", () => {
    if (!window.confirm("Clear this world and restore default settings? This cannot be undone.")) return;
    resetPlacement();
    builder.clear();
    clearTexture();
    setColor(COLORS[0]);
    $("#custom-color").value = COLORS[0];
    setWorldSettings({ ...DEFAULT_SETTINGS });
    syncTextureEditor(null);
    renderPalette();
    clearTimeout(saveTimer);
    saveSystem.clear();
    showStatus("Ready");
    showToast("World and settings reset");
  });
  window.addEventListener("keydown", event => {
    if (event.repeat) return;
    if (textureEditorOpen()) {
      if (event.code === "KeyT" || event.code === "Escape") setTextureEditorOpen(false);
      if (event.code === "KeyO") selectTextureSize(TEXTURE_SIZES[(TEXTURE_SIZES.indexOf(textureBufferSize) - 1 + TEXTURE_SIZES.length) % TEXTURE_SIZES.length]);
      if (event.code === "KeyL") selectTextureSize(TEXTURE_SIZES[(TEXTURE_SIZES.indexOf(textureBufferSize) + 1) % TEXTURE_SIZES.length]);
      if (event.code === "KeyI") toggleTextureNoise();
      if (event.code === "KeyP" || event.code === "Enter") applyTexture();
      return;
    }
    if (event.code === "Digit0" || event.code === "Numpad0") {
      if (placement.phase !== "first") {
        event.preventDefault();
        cancelPlacement();
      }
      return;
    }
    if (event.code === "KeyE" || event.code === "KeyP") placeBlock();
    if (event.code === "KeyQ" || event.code === "KeyM") breakBlock();
    if (event.code === "Escape" && placement.phase !== "first") cancelPlacement();
    if (event.code === "KeyY") {
      setColor(cycleColor());
      $("#custom-color").value = selectedColor;
      if (textureEditorOpen()) setTextureEditorSize(textureBufferSize);
      renderPalette();
    }
    if (event.code === "KeyX") setSettingsOpen($("#settings-panel").hidden);
    if (event.code === "KeyB") setBuildMenuOpen($("#build-panel").hidden);
    if (event.code === "KeyT" && !$("#build-panel").hidden) {
      setTextureEditorOpen($("#texture-section").hidden);
    }
  });
}

function initialize() {
  createManifest();
  let initial = null;
  try {
    initial = saveSystem.read();
  } catch (error) {
    console.error("Could not read the saved world.", error);
    showStatus("Saved data invalid", true);
    showToast(`Saved world could not be loaded: ${error.message}`, 5000);
  }

  renderer = new WorldRenderer(THREE, canvas, null);
  builder = new Builder(THREE, renderer.scene, scheduleSave);
  renderer.builder = builder;
  controls = new Controls({
    renderer,
    indicator: $(".controller-note"),
    callbacks: {
      category: delta => selectCategory(currentCategory + delta),
      tool: delta => selectTool(currentTool + delta),
      placeBlock,
      breakBlock,
      placementPending: () => placement.phase !== "first",
      cancelPlacement,
      inputMode: setInputMode,
      cycleColor: () => {
        setColor(cycleColor());
        $("#custom-color").value = selectedColor;
        if (textureEditorOpen()) setTextureEditorSize(textureBufferSize);
        renderPalette();
      },
      settings: () => setSettingsOpen($("#settings-panel").hidden)
      ,      buildMenu: () => setBuildMenuOpen($("#build-panel").hidden),
      textureEditor: () => {
        if ($("#build-panel").hidden) setBuildMenuOpen(true);
        setTextureEditorOpen($("#texture-section").hidden);
      },
      textureEditorOpen,
      textureSize: delta => {
        const index = TEXTURE_SIZES.indexOf(textureBufferSize);
        const next = (index + delta + TEXTURE_SIZES.length) % TEXTURE_SIZES.length;
        selectTextureSize(TEXTURE_SIZES[next]);
      },
      toggleTextureNoise,
      applyTexture
    }
  });
  setWorldSettings(initial?.settings || DEFAULT_SETTINGS);
  if (initial) {
    try {
      builder.importData(initial.world, createBlockMaterial);
      showStatus("Loaded locally");
    } catch (error) {
      console.error("Could not restore the saved world.", error);
      showStatus("Saved world invalid", true);
      showToast(`Saved world could not be restored: ${error.message}`, 5000);
    }
  }
  renderCategories();
  renderTools();
  renderPalette();
  syncTextureEditor(initial?.settings.activeTexture || null);
  bindInterface();

  const frame = () => {
    renderer.update(controls.update());
    const target = renderer.getTarget();
    if (target) {
      $("#world-coordinates").textContent = `X ${target.x} · Y ${target.y} · Z ${target.z}`;
      updatePlacementPreview(target);
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("./sw.js").catch(error => {
      console.error("Could not register the offline app worker.", error);
      showToast("Offline caching is unavailable in this browser context.");
    });
  }
}

try {
  initialize();
} catch (error) {
  console.error("Blockscape could not start.", error);
  showStatus("Startup failed", true);
  showToast(`App could not start: ${error.message}`, 6000);
}
