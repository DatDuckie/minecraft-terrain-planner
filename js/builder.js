export const CATEGORIES = [
  { id: "build", name: "Build", caption: "BLOCKS", icon: "▣", tools: [
    { id: "block", name: "Block", detail: "Fill selected box", icon: "■" },
    { id: "wall", name: "Wall", detail: "Box-sized wall plane", icon: "▤" },
    { id: "floor", name: "Floor", detail: "Flat box-sized platform", icon: "▦" },
    { id: "pillar", name: "Pillar", detail: "Centered vertical column", icon: "▥" },
    { id: "diagonal", name: "Diagonal", detail: "Box-fitted diagonal wall", icon: "╱" },
    { id: "stairs", name: "Stairs", detail: "Box-fitted steps", icon: "▱" },
    { id: "ramp", name: "Ramp", detail: "Box-fitted slope", icon: "◢" },
    { id: "extend", name: "Wall extender", detail: "Box-sized wall plane", icon: "↔" }
  ] },
  { id: "shapes", name: "Shapes", caption: "GEOMETRY", icon: "◇", tools: [
    { id: "circle", name: "Circle", detail: "Flat box-fitted disk", icon: "◯" },
    { id: "quarter", name: "Quarter circle", detail: "Flat box-fitted curve", icon: "◔" },
    { id: "arc", name: "Curved arc", detail: "Flat box-fitted arc", icon: "⌒" },
    { id: "cylinder", name: "Cylinder", detail: "Box-fitted cylinder", icon: "▤" },
    { id: "sphere", name: "Sphere", detail: "Box-fitted sphere", icon: "●" }
  ] },
  { id: "terrain", name: "Terrain", caption: "LANDSCAPE", icon: "⌁", tools: [
    { id: "hill", name: "Hill", detail: "Box-fitted voxel mound", icon: "⌂" },
    { id: "volume", name: "Volume", detail: "Fill selected box", icon: "▧" }
  ] },
  { id: "settings", name: "Settings", caption: "OPTIONS", icon: "⚙", tools: [
    { id: "block", name: "Return to building", detail: "Block placement", icon: "■" }
  ] }
];

function cellKey(cell) {
  return `${cell.x},${cell.y},${cell.z}`;
}

function addCell(cells, x, y, z) {
  if ([x, y, z].every(Number.isFinite)) cells.set(cellKey({ x, y, z }), { x, y, z });
}

export function shapeCells(bounds, tool) {
  const min = {};
  const max = {};
  for (const axis of ["x", "y", "z"]) {
    min[axis] = bounds?.min?.[axis];
    max[axis] = bounds?.max?.[axis];
    if (!Number.isInteger(min[axis]) || !Number.isInteger(max[axis]) ||
        Math.abs(min[axis]) > 100000 || Math.abs(max[axis]) > 100000 || min[axis] > max[axis]) {
      throw new Error("Shape bounds must be valid whole block coordinates.");
    }
  }
  const size = {
    x: max.x - min.x + 1,
    y: max.y - min.y + 1,
    z: max.z - min.z + 1
  };
  if (size.x * size.y * size.z > 100000) throw new Error("Shape preview exceeds the 100,000 block limit.");

  const cells = new Map();
  const add = (x, y, z) => addCell(cells, x, y, z);
  const xCenter = Math.floor((min.x + max.x) / 2);
  const zCenter = Math.floor((min.z + max.z) / 2);
  const xProgress = x => size.x === 1 ? 0 : (x - min.x) / (size.x - 1);
  const xRadius = x => size.x === 1 ? 0 : xProgress(x) * 2 - 1;
  const zRadius = z => size.z === 1 ? 0 : (z - min.z) / (size.z - 1) * 2 - 1;

  if (tool === "wall" || tool === "extend") {
    if (size.x >= size.z) {
      const z = Math.floor((min.z + max.z) / 2);
      for (let x = min.x; x <= max.x; x++) for (let y = min.y; y <= max.y; y++) add(x, y, z);
    } else {
      const x = xCenter;
      for (let z = min.z; z <= max.z; z++) for (let y = min.y; y <= max.y; y++) add(x, y, z);
    }
  } else if (tool === "floor") {
    for (let x = min.x; x <= max.x; x++) for (let z = min.z; z <= max.z; z++) add(x, min.y, z);
  } else if (tool === "pillar") {
    for (let y = min.y; y <= max.y; y++) add(xCenter, y, zCenter);
  } else if (tool === "diagonal") {
    if (size.x >= size.z) {
      for (let x = min.x; x <= max.x; x++) {
        const z = min.z + Math.round(xProgress(x) * (size.z - 1));
        for (let y = min.y; y <= max.y; y++) add(x, y, z);
      }
    } else {
      for (let z = min.z; z <= max.z; z++) {
        const x = min.x + Math.round((z - min.z) / (size.z - 1) * (size.x - 1));
        for (let y = min.y; y <= max.y; y++) add(x, y, z);
      }
    }
  } else if (tool === "stairs" || tool === "ramp") {
    const fillRun = (progress, x, z) => {
      const top = min.y + Math.round(progress * (size.y - 1));
      if (tool === "ramp") {
        for (let y = min.y; y <= top; y++) add(x, y, z);
      } else {
        add(x, top, z);
      }
    };
    if (size.x >= size.z) {
      for (let x = min.x; x <= max.x; x++) {
        for (let z = min.z; z <= max.z; z++) fillRun(xProgress(x), x, z);
      }
    } else {
      for (let z = min.z; z <= max.z; z++) {
        const progress = size.z === 1 ? 0 : (z - min.z) / (size.z - 1);
        for (let x = min.x; x <= max.x; x++) fillRun(progress, x, z);
      }
    }
  } else if (tool === "cylinder") {
    for (let x = min.x; x <= max.x; x++) for (let z = min.z; z <= max.z; z++) {
      if (xRadius(x) ** 2 + zRadius(z) ** 2 <= 1) {
        for (let y = min.y; y <= max.y; y++) add(x, y, z);
      }
    }
  } else if (tool === "sphere") {
    for (let x = min.x; x <= max.x; x++) for (let y = min.y; y <= max.y; y++) for (let z = min.z; z <= max.z; z++) {
      const yRadius = size.y === 1 ? 0 : (y - min.y) / (size.y - 1) * 2 - 1;
      if (xRadius(x) ** 2 + yRadius ** 2 + zRadius(z) ** 2 <= 1) add(x, y, z);
    }
  } else if (tool === "hill") {
    for (let y = min.y; y <= max.y; y++) {
      const height = size.y === 1 ? 0 : (y - min.y) / (size.y - 1);
      const radius = 1 - height;
      for (let x = min.x; x <= max.x; x++) for (let z = min.z; z <= max.z; z++) {
        if (xRadius(x) ** 2 + zRadius(z) ** 2 <= radius ** 2) add(x, y, z);
      }
    }
  } else if (tool === "circle" || tool === "quarter" || tool === "arc") {
    for (let x = min.x; x <= max.x; x++) for (let z = min.z; z <= max.z; z++) {
      const xr = xRadius(x);
      const zr = zRadius(z);
      const distance = xr ** 2 + zr ** 2;
      const inQuarter = xr >= 0 && zr >= 0;
      const inArc = distance >= 0.55 && distance <= 1.15;
      if (distance <= 1 && (tool !== "quarter" || inQuarter) && (tool !== "arc" || inArc)) add(x, min.y, z);
    }
  } else {
    for (let x = min.x; x <= max.x; x++) for (let y = min.y; y <= max.y; y++) {
      for (let z = min.z; z <= max.z; z++) add(x, y, z);
    }
  }
  if (!cells.size) add(xCenter, min.y, zCenter);
  return [...cells.values()];
}

export class Builder {
  constructor(THREE, scene, changed) {
    this.THREE = THREE;
    this.scene = scene;
    this.changed = changed;
    this.blocks = new Map();
    this.scale = 1;
    this.texture = null;
  }

  setScale(scale) {
    this.scale = scale;
    for (const mesh of this.blocks.values()) {
      const { x, y, z } = mesh.userData.cell;
      mesh.position.set(x * scale, y * scale, z * scale);
      mesh.scale.setScalar(scale);
    }
  }

  setTexture(texture) {
    this.texture = texture;
  }

  place(bounds, tool, color, materialFactory) {
    const cells = shapeCells(bounds, tool);
    if (this.blocks.size + cells.length > 100000) throw new Error("World block limit reached (100,000).");
    const material = materialFactory(this.THREE, color, this.texture);
    material.userData.worldColor = color;
    material.userData.worldTexture = this.texture ? { size: this.texture.size, pixels: [...this.texture.pixels] } : null;
    let added = 0;
    for (const cell of cells) {
      const key = cellKey(cell);
      if (this.blocks.has(key)) continue;
      const mesh = new this.THREE.Mesh(new this.THREE.BoxGeometry(0.985, 0.985, 0.985), material);
      mesh.position.set(cell.x * this.scale, cell.y * this.scale, cell.z * this.scale);
      mesh.scale.setScalar(this.scale);
      mesh.userData.cell = cell;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.blocks.set(key, mesh);
      added++;
    }
    if (added) this.changed();
    return added;
  }

  break(mesh) {
    if (!mesh || !mesh.userData.cell) return false;
    const cell = mesh.userData.cell;
    const key = cellKey(cell);
    const block = this.blocks.get(key);
    if (!block) return false;
    this.scene.remove(block);
    block.geometry.dispose();
    this.blocks.delete(key);
    this.changed();
    return true;
  }

  exportData() {
    return [...this.blocks.values()].map(mesh => ({
      cell: mesh.userData.cell,
      color: mesh.material.userData.worldColor || `#${mesh.material.color.getHexString()}`,
      texture: mesh.material.userData.worldTexture || null
    }));
  }

  importData(blocks, materialFactory) {
    if (!Array.isArray(blocks) || blocks.length > 100000) throw new Error("Invalid world file or block limit exceeded.");
    const validated = blocks.map(item => {
      const cell = item && item.cell;
      if (!cell || !["x", "y", "z"].every(axis => Number.isInteger(cell[axis]) && Math.abs(cell[axis]) <= 100000)) {
        throw new Error("World file contains an invalid block position.");
      }
      if (typeof item.color !== "string" || !/^#[0-9a-f]{6}$/i.test(item.color)) throw new Error("World file contains an invalid block color.");
      if (item.texture !== null && item.texture !== undefined) {
        if (!item.texture || !Number.isInteger(item.texture.size) || item.texture.size < 1 || item.texture.size > 64 ||
            !Array.isArray(item.texture.pixels) || item.texture.pixels.length !== item.texture.size * item.texture.size ||
            item.texture.pixels.some(color => typeof color !== "string" || !/^#[0-9a-f]{6}$/i.test(color))) {
          throw new Error("World file contains an invalid block texture.");
        }
      }
      return item;
    });
    this.clear(false);
    for (const item of validated) {
      const cell = item.cell;
      const key = cellKey(cell);
      if (this.blocks.has(key)) continue;
      const texture = item.texture || null;
      const material = materialFactory(this.THREE, item.color, texture);
      material.userData.worldColor = item.color;
      material.userData.worldTexture = texture;
      const mesh = new this.THREE.Mesh(new this.THREE.BoxGeometry(0.985, 0.985, 0.985), material);
      mesh.position.set(cell.x * this.scale, cell.y * this.scale, cell.z * this.scale);
      mesh.scale.setScalar(this.scale);
      mesh.userData.cell = { x: cell.x, y: cell.y, z: cell.z };
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.blocks.set(key, mesh);
    }
    this.changed();
  }

  clear(notify = true) {
    for (const mesh of this.blocks.values()) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      if (mesh.material.map) mesh.material.map.dispose();
      mesh.material.dispose();
    }
    this.blocks.clear();
    if (notify) this.changed();
  }
}
