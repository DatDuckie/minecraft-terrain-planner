export class Builder {
  constructor(app) {
    this.app = app;
    this.world = new Map();
    this.worldGroup = null;
    this.previewGroup = null;
    this.activeTool = 'block';
    this.currentSelection = null;
    this.previewMesh = null;

    this.createWorldGroup();
    this.createPreviewGroup();
  }

  createWorldGroup() {
    this.worldGroup = document.createElement('div');
    this.worldGroup.style.display = 'none';
    this.app.renderer.scene.add(this.worldGroup);
  }

  createPreviewGroup() {
    this.previewGroup = new THREE.Group();
    this.app.renderer.scene.add(this.previewGroup);
  }

  setTool(tool) {
    this.activeTool = tool;
    this.currentSelection = null;
    this.clearPreview();
  }

  syncBlockScale(scale) {
    this.worldGroup?.traverse((child) => {
      if (child.isMesh) {
        child.scale.setScalar(scale);
      }
    });
  }

  updateFillColor(color) {
    this.app.state.activeColor = color;
  }

  applyTextureToSelection() {
    if (!this.currentSelection) return;
    const size = this.app.state.settings.textureSize;
    const noise = this.app.state.settings.noise;
    this.currentSelection.forEach((key) => {
      const block = this.world.get(key);
      if (block) {
        block.texture = { size, noise };
      }
    });
  }

  updatePreview(dt) {
    if (!this.currentSelection) {
      this.drawActiveCellPreview();
      return;
    }

    this.drawSelectionPreview();
  }

  clearPreview() {
    this.previewGroup.clear();
    this.previewMesh = null;
  }

  drawActiveCellPreview() {
    this.clearPreview();

    const target = this.app.renderer.getInteractionTarget();
    const cell = this.roundVectorToCell(target);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.96, 0.96, 0.96),
      new THREE.MeshStandardMaterial({
        color: '#ff4d4d',
        emissive: '#3d0d0d',
        transparent: true,
        opacity: 0.76,
      })
    );

    mesh.position.set(cell.x + 0.5, cell.y + 0.5, cell.z + 0.5);
    this.previewGroup.add(mesh);
    this.previewMesh = mesh;
  }

  drawSelectionPreview() {
    this.clearPreview();
    const { start, end } = this.currentSelection;
    const minX = Math.min(start.x, end.x), maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y), maxY = Math.max(start.y, end.y);
    const minZ = Math.min(start.z, end.z), maxZ = Math.max(start.z, end.z);

    const outline = new THREE.Mesh(
      new THREE.BoxGeometry(maxX - minX + 1, maxY - minY + 1, maxZ - minZ + 1),
      new THREE.MeshStandardMaterial({
        color: '#ff4d4d',
        wireframe: true,
        transparent: true,
        opacity: 0.9,
      })
    );
    outline.position.set((minX + maxX) / 2 + 0.5, (minY + maxY) / 2 + 0.5, (minZ + maxZ) / 2 + 0.5);
    this.previewGroup.add(outline);
  }

  roundVectorToCell(point) {
    return {
      x: Math.floor(point.x),
      y: Math.floor(point.y),
      z: Math.floor(point.z),
    };
  }

  setSelectionFromCurrentTarget() {
    const target = this.app.renderer.getInteractionTarget();
    const cell = this.roundVectorToCell(target);
    if (!this.currentSelection) {
      this.currentSelection = { start: cell, end: cell };
    } else {
      this.currentSelection.end = cell;
    }
  }

  confirmBuild() {
    if (!this.currentSelection) {
      this.setSelectionFromCurrentTarget();
      return;
    }

    const { start, end } = this.currentSelection;
    this.generateShape(start, end, this.activeTool);
    this.currentSelection = null;
    this.clearPreview();
  }

  cancelBuild() {
    this.currentSelection = null;
    this.clearPreview();
  }

  generateShape(start, end, tool) {
    const minX = Math.min(start.x, end.x), maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y), maxY = Math.max(start.y, end.y);
    const minZ = Math.min(start.z, end.z), maxZ = Math.max(start.z, end.z);

    switch (tool) {
      case 'block': {
        this.placeBlockAt(end.x, end.y, end.z); 
        break;
      }
      case 'wall': {
        for (let x = minX; x <= maxX; x++) {
          for (let y = minY; y <= maxY; y++) {
            for (let z = minZ; z <= maxZ; z++) {
              if (x === minX || x === maxX || z === minZ || z === maxZ || y === minY || y === maxY) {
                this.placeBlockAt(x, y, z);
              }
            }
          }
        }
        break;
      }
      case 'pillar': {
        for (let y = minY; y <= maxY; y++) {
          this.placeBlockAt(end.x, y, end.z);
        }
        break;
      }
      case 'diagonal': {
        const dx = Math.abs(end.x - start.x);
        const dz = Math.abs(end.z - start.z);
        const steps = Math.max(dx, dz, 1);
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const x = Math.round(start.x + (end.x - start.x) * t);
          const z = Math.round(start.z + (end.z - start.z) * t);
          this.placeBlockAt(x, start.y, z);
        }
        break;
      }
      case 'circle': {
        const radius = Math.max(1, Math.max(Math.abs(end.x - start.x), Math.abs(end.z - start.z)));
        for (let x = minX; x <= maxX; x++) {
          for (let z = minZ; z <= maxZ; z++) {
            const dx = x - ((minX + maxX) / 2);
            const dz = z - ((minZ + maxZ) / 2);
            if (dx * dx + dz * dz <= radius * radius) {
              for (let y = minY; y <= maxY; y++) this.placeBlockAt(x, y, z);
            }
          }
        }
        break;
      }
      case 'stair': {
        const height = Math.max(1, Math.abs(end.y - start.y) + 1);
        for (let i = 0; i < height; i++) {
          const x = start.x + i;
          const z = start.z + i;
          this.placeBlockAt(x, start.y + i, z);
        }
        break;
      }
      default:
        this.placeBlockAt(end.x, end.y, end.z);
    }
  }

  placeBlockAt(x, y, z) {
    const key = `${x},${y},${z}`;
    if (this.world.has(key)) return;

    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: this.app.state.activeColor, emissive: this.app.state.activeColor, roughness: 0.8 })
    );

    mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.app.renderer.scene.add(mesh);
    this.world.set(key, { x, y, z, color: this.app.state.activeColor, mesh });
  }

  removeBlockAt(x, y, z) {
    const key = `${x},${y},${z}`;
    const block = this.world.get(key);
    if (!block) return;
    this.app.renderer.scene.remove(block.mesh);
    this.world.delete(key);
  }

  breakSelected() {
    const target = this.app.renderer.getInteractionTarget();
    const cell = this.roundVectorToCell(target);
    this.removeBlockAt(cell.x, cell.y, cell.z);
  }

  updateCurrentSelection() {
    const target = this.app.renderer.getInteractionTarget();
    const cell = this.roundVectorToCell(target);
    if (!this.currentSelection) {
      this.currentSelection = { start: cell, end: cell };
    } else {
      this.currentSelection.end = cell;
    }
  }

  loadWorld(serializedWorld) {
    if (!Array.isArray(serializedWorld)) return;
    serializedWorld.forEach((block) => {
      this.placeBlockAt(block.x, block.y, block.z);
    });
  }

  exportWorld() {
    return Array.from(this.world.values()).map(({ x, y, z, color }) => ({ x, y, z, color }));
  }
}

