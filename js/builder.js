export class Builder {
  constructor(app) {
    this.app = app;
    this.world = new Map();
    this.previewGroup = new THREE.Group();
    this.app.renderer.scene.add(this.previewGroup);
    this.selection = null;
    this.activeTool = 'block';
  }

  getWorldMeshes() {
    return Array.from(this.world.values()).map((entry) => entry.mesh);
  }

  setTool(tool) {
    this.activeTool = tool;
    this.selection = null;
    this.clearPreview();
  }

  updateBlockScale(scale) {
    this.getWorldMeshes().forEach((mesh) => {
      mesh.scale.setScalar(scale);
    });
  }

  updateFillColor(color) {
    this.app.state.activeColor = color;
  }

  roundVectorToCell(point) {
    return {
      x: Math.floor(point.x),
      y: Math.floor(point.y),
      z: Math.floor(point.z)
    };
  }

  clearPreview() {
    this.previewGroup.clear();
  }

  createPreviewMesh(color = '#ff4d4d', wireframe = false) {
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: '#260b0b',
      transparent: true,
      opacity: wireframe ? 0.9 : 0.75,
      wireframe
    });

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.96, 0.96), material);
    return mesh;
  }

  updatePreview() {
    this.clearPreview();

    const target = this.app.renderer.getInteractionTarget();
    const cell = this.roundVectorToCell(target);

    if (!this.selection) {
      const mesh = this.createPreviewMesh('#ff4d4d', false);
      mesh.position.set(cell.x + 0.5, cell.y + 0.5, cell.z + 0.5);
      this.previewGroup.add(mesh);
      return;
    }

    const start = this.selection.start;
    const end = this.selection.end;
    const minX = Math.min(start.x, end.x), maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y), maxY = Math.max(start.y, end.y);
    const minZ = Math.min(start.z, end.z), maxZ = Math.max(start.z, end.z);

    const outlineMesh = new THREE.Mesh(
      new THREE.BoxGeometry(maxX - minX + 1, maxY - minY + 1, maxZ - minZ + 1),
      new THREE.MeshStandardMaterial({
        color: '#ff4d4d',
        wireframe: true,
        transparent: true,
        opacity: 0.9,
        emissive: '#3a0b0b'
      })
    );
    outlineMesh.position.set((minX + maxX) / 2 + 0.5, (minY + maxY) / 2 + 0.5, (minZ + maxZ) / 2 + 0.5);
    this.previewGroup.add(outlineMesh);
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

  generateShape(start, end, tool) {
    const minX = Math.min(start.x, end.x), maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y), maxY = Math.max(start.y, end.y);
    const minZ = Math.min(start.z, end.z), maxZ = Math.max(start.z, end.z);

    switch (tool) {
      case 'block':
        this.placeBlock(end.x, end.y, end.z);
        break;
      case 'wall':
        for (let x = minX; x <= maxX; x++) {
          for (let y = minY; y <= maxY; y++) {
            for (let z = minZ; z <= maxZ; z++) {
              if (x === minX || x === maxX || y === minY || y === maxY || z === minZ || z === maxZ) {
                this.placeBlock(x, y, z);
              }
            }
          }
        }
        break;
      case 'pillar':
        for (let y = minY; y <= maxY; y++) {
          this.placeBlock(end.x, y, end.z);
        }
        break;
      case 'diagonal': {
        const dx = Math.abs(end.x - start.x);
        const dz = Math.abs(end.z - start.z);
        const steps = Math.max(dx, dz, 1);
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const x = Math.round(start.x + (end.x - start.x) * t);
          const z = Math.round(start.z + (end.z - start.z) * t);
          this.placeBlock(x, start.y, z);
        }
        break;
      }
      case 'circle':
        for (let x = minX; x <= maxX; x++) {
          for (let z = minZ; z <= maxZ; z++) {
            const dx = x - ((minX + maxX) / 2);
            const dz = z - ((minZ + maxZ) / 2);
            if (dx * dx + dz * dz <= Math.max(1, Math.max(maxX - minX, maxZ - minZ)) ** 2) {
              for (let y = minY; y <= maxY; y++) this.placeBlock(x, y, z);
            }
          }
        }
        break;
      case 'stair':
        for (let i = 0; i <= Math.max(1, Math.abs(end.y - start.y)); i++) {
          const x = start.x + i;
          const z = start.z + i;
          this.placeBlock(x, start.y + i, z);
        }
        break;
      default:
        this.placeBlock(end.x, end.y, end.z);
    }
  }

  placeBlock(x, y, z) {
    const key = `${x},${y},${z}`;
    if (this.world.has(key)) return;

    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({
        color: this.app.state.activeColor,
        emissive: this.app.state.activeColor,
        roughness: 0.8,
        metalness: 0.05
      })
    );

    mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.app.renderer.scene.add(mesh);
    this.world.set(key, { x, y, z, color: this.app.state.activeColor, mesh });
  }

  removeBlock(x, y, z) {
    const key = `${x},${y},${z}`;
    const entry = this.world.get(key);
    if (!entry) return;
    this.app.renderer.scene.remove(entry.mesh);
    this.world.delete(key);
  }

  breakAtTarget() {
    const target = this.app.renderer.getInteractionTarget();
    const cell = this.roundVectorToCell(target);
    this.removeBlock(cell.x, cell.y, cell.z);
  }

  exportWorld() {
    return Array.from(this.world.values()).map(({ x, y, z, color }) => ({ x, y, z, color }));
  }

  loadWorld(worldData) {
    if (!Array.isArray(worldData)) return;
    worldData.forEach((block) => {
      if (block && Number.isFinite(block.x) && Number.isFinite(block.y) && Number.isFinite(block.z)) {
        this.placeBlock(block.x, block.y, block.z);
      }
    });
  }
}
