export const COLORS = [
  "#d84646", "#e98a4a", "#e2c34c", "#75b968",
  "#4f9bd2", "#7868c8", "#ce72a5", "#e8e4d8",
  "#a87852", "#777777", "#363636", "#f0f0f0"
];

export let selectedColor = COLORS[0];
export let texturePixels = null;
export let textureSize = 0;
export let customColors = [];

export function setColor(color) {
  selectedColor = color;
}

export function setCustomColors(colors) {
  customColors = [...new Set(colors)];
}

export function saveCustomColor(color) {
  if (!customColors.includes(color) && !COLORS.includes(color)) customColors = [...customColors, color].slice(-12);
}

export function cycleColor() {
  const index = COLORS.indexOf(selectedColor);
  selectedColor = COLORS[(index + 1 + COLORS.length) % COLORS.length];
  return selectedColor;
}

export function setTexture(pixels, size) {
  texturePixels = pixels;
  textureSize = size;
}

export function clearTexture() {
  texturePixels = null;
  textureSize = 0;
}

export function createBlockMaterial(THREE, color = selectedColor, savedTexture = null) {
  const textureData = savedTexture || (texturePixels ? { pixels: texturePixels, size: textureSize } : null);
  if (!textureData) return new THREE.MeshStandardMaterial({ color, roughness: 0.88, metalness: 0.02 });

  const canvas = document.createElement("canvas");
  canvas.width = textureData.size;
  canvas.height = textureData.size;
  const context = canvas.getContext("2d");
  const image = context.createImageData(textureData.size, textureData.size);
  for (let i = 0; i < textureData.pixels.length; i++) {
    const hex = textureData.pixels[i] || color;
    const value = Number.parseInt(hex.slice(1), 16);
    image.data[i * 4] = (value >> 16) & 255;
    image.data[i * 4 + 1] = (value >> 8) & 255;
    image.data[i * 4 + 2] = value & 255;
    image.data[i * 4 + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  const map = new THREE.CanvasTexture(canvas);
  map.magFilter = THREE.NearestFilter;
  map.minFilter = THREE.NearestFilter;
  map.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ color: "#ffffff", map, roughness: 0.88, metalness: 0.02 });
}
