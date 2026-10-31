const STORAGE_KEY = "blockscape-world-v1";

export const DEFAULT_SETTINGS = Object.freeze({
  blockScale: 1,
  gridRadius: 40,
  airDistance: 4,
  customColors: [],
  activeTexture: null,
  textureSize: 1,
  textureNoise: false
});

export function normalizeSettings(value = {}) {
  const numberInRange = (candidate, min, max, fallback) =>
    Number.isFinite(Number(candidate)) && Number(candidate) >= min && Number(candidate) <= max ? Number(candidate) : fallback;
  const customColors = Array.isArray(value.customColors)
    ? [...new Set(value.customColors.filter(color => typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color)))].slice(-12)
    : [];
  let activeTexture = null;
  const texture = value.activeTexture;
  if (texture && Number.isInteger(texture.size) && texture.size >= 1 && texture.size <= 64 &&
      Array.isArray(texture.pixels) && texture.pixels.length === texture.size * texture.size &&
      texture.pixels.every(color => typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color))) {
    activeTexture = { size: texture.size, pixels: [...texture.pixels] };
  }
  const allowedTextureSizes = [1, 8, 16, 32];
  const requestedSize = Number(value.textureSize);
  const textureSize = allowedTextureSizes.includes(requestedSize)
    ? requestedSize
    : activeTexture
      ? allowedTextureSizes.reduce((closest, candidate) =>
        Math.abs(candidate - activeTexture.size) < Math.abs(closest - activeTexture.size) ? candidate : closest
      , allowedTextureSizes[0])
      : DEFAULT_SETTINGS.textureSize;
  if (activeTexture && activeTexture.size !== textureSize) {
    const source = activeTexture;
    activeTexture = {
      size: textureSize,
      pixels: Array.from({ length: textureSize * textureSize }, (_, index) => {
        const x = index % textureSize;
        const y = Math.floor(index / textureSize);
        const sourceX = Math.min(source.size - 1, Math.floor(x * source.size / textureSize));
        const sourceY = Math.min(source.size - 1, Math.floor(y * source.size / textureSize));
        return source.pixels[sourceY * source.size + sourceX];
      })
    };
  }
  return {
    blockScale: numberInRange(value.blockScale, 0.5, 2, DEFAULT_SETTINGS.blockScale),
    gridRadius: Math.round(numberInRange(value.gridRadius, 10, 100, DEFAULT_SETTINGS.gridRadius) / 5) * 5,
    airDistance: numberInRange(value.airDistance, 2, 5, DEFAULT_SETTINGS.airDistance),
    customColors,
    activeTexture,
    textureSize,
    textureNoise: value.textureNoise === true
  };
}

export class SaveSystem {
  read() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1 || !Array.isArray(data.world)) throw new Error("Saved world data is invalid.");
    return { settings: normalizeSettings(data.settings), world: data.world };
  }

  save(settings, world) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      savedAt: new Date().toISOString(),
      settings: normalizeSettings(settings),
      world
    }));
  }

  clear() {
    localStorage.removeItem(STORAGE_KEY);
    if (window.caches) caches.delete("blockscape-v11").catch(error => {
      console.error("Could not clear the Blockscape offline cache.", error);
    });
  }

  exportFile(settings, world) {
    const data = {
      app: "Blockscape",
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: normalizeSettings(settings),
      world
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `blockscape-world-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  parseImport(text) {
    const data = JSON.parse(text);
    if (!data || data.version !== 1 || !Array.isArray(data.world)) throw new Error("This is not a supported Blockscape world file.");
    return { settings: normalizeSettings(data.settings), world: data.world };
  }
}
