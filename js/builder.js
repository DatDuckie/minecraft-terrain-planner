export class Builder {
  constructor(app) {
    this.app = app;
    this.world = new Map();
    this.previewGroup = new THREE.Group();
    this.previewMesh = null;
    this.selection = null;
    this.activeTool = 'block';

    this.app.renderer?.scene?.add(this.previewGroup);
  }

  setTool(tool) {
    this.activeTool = tool;
    this.clearPreview();
    this.selection = null;
  }

  getWorldMeshes() {
    return Array.from(this.world.values()).map((entry) => entry.mesh);
  }

  clearPreview() {
    this.previewGroup.clear();
    this.previewMesh = null;
  }

  roundVectorToCell(point) {
    if (!point || typeof point.x !== 'number') {
      return { x: 0, y: 0, z: 0 };
    }

    return {
      x: Math.floor(point.x),
      y: Math.floor(point.y),
      z: Math.floor(point.z),
    };
  }

  cellToWorld(cell) {
    return {
      x: cell.x + 0.5,
      y: cell.y + 0.5,
      z: cell.z + 0.5,
    };
  }

  beginSelection() {
    const target = this.app.renderer.getInteractionTarget();
    const cell = this.roundVectorToCell(target);
    this.selection = { start: cell, end: cell };
  }

  updateSelection() {
    const target = this.app.renderer.getInteractionTarget();
    const cell = this.roundVectorToCell(target);
    if (!this.selection) {
      this.selection = { start: cell, end: cell };
    } else {
      this.selection.end = cell;
    }
  }

  cancelSelection() {
    this.selection = null;
    this.clearPreview();
  }

  confirmSelection() {
    if (!this.selection) {
      this.beginSelection();
      return;
    }

    const { start, end } = this.selection;
    this.generateShape(start, end, this.activeTool);
    this.selection = null;
    this.clearPreview();
  }

  updatePreview() {
    if (!this.selection) {
      this.drawActiveCellPreview();
      return;
    }
    this.drawSelectionPreview();
  }

  drawActiveCellPreview() {
    this.clearPreview();
    const target = this.app.renderer.getInteractionTarget();
    const cell = this.roundVectorToCell(target);
    const center = this.cellToWorld(cell);

    const preview = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({
        color: '#ff5a5f',
        emissive: '#3f0e18',
        transparent: true,
        opacity: 0.75,
        wireframe: true,
      })
    );

    preview.position.set(center.x, center.y, center.z);
    this.previewGroup.add(preview);
    this.previewMesh = preview;
  }

  drawSelectionPreview() {
    this.clearPreview();
    const { start, end } = this.selection || {
      start: { x: 0, y: 0, z: 0 },
      end: { x: 0, y: 0, z: 0 },
    };

    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);
    const minZ = Math.min(start.z, end.z);
    const maxZ = Math.max(start.z, end.z);

    const width = Math.max(1, maxX - minX + 1);
    const height = Math.max(1, maxY - minY + 1);
    const depth = Math.max(1, maxZ - minZ + 1);

    const outline = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      new THREE.MeshStandardMaterial({
        color: '#ff5a5f',
        wireframe: true,
        transparent: true,
        opacity: 0.9,
      })
    );

    outline.position.set(
      minX + width / 2,
      minY + height / 2,
      minZ + depth / 2
    );

    this.previewGroup.add(outline);
    this.previewMesh = outline;
  }

  getBoxBounds(start, end) {
    return {
      minX: Math.min(start.x, end.x),
      maxX: Math.max(start.x, end.x),
      minY: Math.min(start.y, end.y),
      maxY: Math.max(start.y, end.y),
      minZ: Math.min(start.z, end.z),
      maxZ: Math.max(start.z, end.z),
    };
  }

  addCell(x, y, z) {
    const cell = {
      x: Math.floor(x),
      y: Math.floor(y),
      z: Math.floor(z),
    };

    const key = `${cell.x},${cell.y},${cell.z}`;
    if (this.world.has(key)) return false;

    const color = this.app.state.activeColor || '#ff6f61';
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        roughness: 0.72,
        metalness: 0.05,
      })
    );

    const center = this.cellToWorld(cell);
    mesh.position.set(center.x, center.y, center.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.app.renderer.scene.add(mesh);
    this.world.set(key, { x: cell.x, y: cell.y, z: cell.z, color, mesh });
    return true;
  }

  removeCell(x, y, z) {
    const cell = {
      x: Math.floor(x),
      y: Math.floor(y),
      z: Math.floor(z),
    };

    const key = `${cell.x},${cell.y},${cell.z}`;
    const block = this.world.get(key);
    if (!block) return;
    this.app.renderer.scene.remove(block.mesh);
    this.world.delete(key);
  }

  breakAtTarget() {
    const target = this.app.renderer.getInteractionTarget();
    const cell = this.roundVectorToCell(target);
    this.removeCell(cell.x, cell.y, cell.z);
  }

  placeBlockAt(x, y, z) {
    this.addCell(x, y, z);
  }

  lineCells(start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dz = end.z - start.z;
    const steps = Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz), 1);

    const cells = [];
    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps;
      const x = Math.round(start.x + dx * t);
      const y = Math.round(start.y + dy * t);
      const z = Math.round(start.z + dz * t);
      cells.push({ x, y, z });
    }

    return cells;
  }

  rectFill(start, end) {
    const bounds = this.getBoxBounds(start, end);
    const cells = [];
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      for (let y = bounds.minY; y <= bounds.maxY; y++) {
        for (let z = bounds.minZ; z <= bounds.maxZ; z++) {
          cells.push({ x, y, z });
        }
      }
    }
    return cells;
  }

  shellCells(start, end) {
    const bounds = this.getBoxBounds(start, end);
    const cells = [];
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      for (let y = bounds.minY; y <= bounds.maxY; y++) {
        for (let z = bounds.minZ; z <= bounds.maxZ; z++) {
          const onOuterBoundary =
            x === bounds.minX || x === bounds.maxX ||
            y === bounds.minY || y === bounds.maxY ||
            z === bounds.minZ || z === bounds.maxZ;
          if (onOuterBoundary) {
            cells.push({ x, y, z });
          }
        }
      }
    }
    return cells;
  }

  circleCells(start, end) {
    const bounds = this.getBoxBounds(start, end);
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cy = (bounds.minY + bounds.maxY) / 2;
    const cz = (bounds.minZ + bounds.maxZ) / 2;
    const rx = Math.max(1, (bounds.maxX - bounds.minX + 1) / 2);
    const ry = Math.max(1, (bounds.maxY - bounds.minY + 1) / 2);
    const rz = Math.max(1, (bounds.maxZ - bounds.minZ + 1) / 2);
    const cells = [];

    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      for (let y = bounds.minY; y <= bounds.maxY; y++) {
        for (let z = bounds.minZ; z <= bounds.maxZ; z++) {
          const nx = (x - cx) / rx;
          const ny = (y - cy) / ry;
          const nz = (z - cz) / rz;
          if (nx * nx + ny * ny + nz * nz <= 1) {
            cells.push({ x, y, z });
          }
        }
      }
    }
    return cells;
  }

  stairCells(start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dz = end.z - start.z;
    const steps = Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz), 1);
    const cells = [];

    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const x = Math.round(start.x + dx * u);
      const y = Math.round(start.y + dy * u);
      const z = Math.round(start.z + dz * u);
      cells.push({ x, y, z });
    }

    return cells;
  }

  generateShape(start, end, tool) {
    const tools = {
      block: () => this.addCell(end.x, end.y, end.z),
      wall: () => {
        const cells = this.shellCells(start, end);
        cells.forEach((cell) => this.addCell(cell.x, cell.y, cell.z));
      },
      floor: () => {
        const cells = this.rectFill(start, end);
        cells.forEach((cell) => this.addCell(cell.x, cell.y, cell.z));
      },
      pillar: () => {
        const dx = end.x - start.x;
        const dz = end.z - start.z;
        const x = start.x + Math.sign(dx || 1) * Math.abs(dx || 0);
        const z = start.z + Math.sign(dz || 1) * Math.abs(dz || 0);
        const { minY, maxY } = this.getBoxBounds(start, end);
        for (let y = minY; y <= maxY; y++) {
          this.addCell(x, y, z);
        }
      },
      diagonal: () => {
        const cells = this.lineCells(start, end);
        cells.forEach((cell) => this.addCell(cell.x, cell.y, cell.z));
      },
      stair: () => {
        const cells = this.stairCells(start, end);
        cells.forEach((cell) => this.addCell(cell.x, cell.y, cell.z));
      },
      ramp: () => {
        const cells = this.lineCells(start, end);
        cells.forEach((cell) => this.addCell(cell.x, cell.y, cell.z));
      },
      circle: () => {
        const cells = this.circleCells(start, end);
        cells.forEach((cell) => this.addCell(cell.x, cell.y, cell.z));
      },
      default: () => this.addCell(end.x, end.y, end.z),
    };

    const fn = tools[tool] || tools.default;
    fn();
  }

  exportWorld() {
    return Array.from(this.world.values()).map(({ x, y, z, color }) => ({ x, y, z, color }));
  }

  loadWorld(serialized) {
    if (!Array.isArray(serialized)) return;
    serialized.forEach((block) => {
      if (block && Number.isFinite(block.x) && Number.isFinite(block.y) && Number.isFinite(block.z)) {
        this.addCell(block.x, block.y, block.z);
      }
    });
  }
}

export default Builder;
