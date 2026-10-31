export class PaletteManager {
  constructor(app) {
    this.app = app;
  }

  syncSwatches() {
    const paletteSwatches = this.app.ui.paletteSwatches;
    paletteSwatches.innerHTML = '';
    this.app.state.palette.forEach((color) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'swatch';
      button.style.background = color;
      button.dataset.color = color;
      button.title = color;
      button.addEventListener('click', () => this.setColor(color, true));
      paletteSwatches.appendChild(button);
    });
    this.refreshActiveSwatch();
  }

  refreshActiveSwatch() {
    const swatches = this.app.ui.paletteSwatches.querySelectorAll('.swatch');
    swatches.forEach((swatch) => {
      swatch.classList.toggle('active', swatch.dataset.color.toLowerCase() === this.app.state.activeColor.toLowerCase());
    });
  }

  setColor(color, rebuild = false) {
    this.app.state.activeColor = color;
    this.app.ui.colorPicker.value = color;
    this.app.ui.activeColorLabel.textContent = color.toUpperCase();
    this.refreshActiveSwatch();

    if (rebuild) {
      this.app.builder?.updateFillColor(color);
    }
  }
}
