# Minecraft Terrain Planner

A compact desktop-first PWA for 3D block building and terrain planning, built to work as a static GitHub Pages app with keyboard and Xbox controller support.

## Quick start

Open `index.html` in a browser, or publish this folder to GitHub Pages/any static host with HTTPS enabled.

## Feature overview

- 3D block placement preview with flight camera controls
- Dark modern UI with compact HUD and overlay build menu
- Keyboard and Xbox gamepad input support
- Procedural color palette and texture generation
- Local JSON export/import with persistent localStorage state
- PWA install support with service worker and manifest

## Future feature requests

The following ideas are queued for future iterations and recorded here before implementation:

- Terrain sculpting brushes with height/noise-based terrain generation
- Multi-layer world materials and textured block faces
- Clipboard / copy-paste selection volumes between builds
- Undo / redo history with snapshots for large edits
- Saved building templates and common structure library
- Multi-zone map management and named planning areas
- Improved controller vibration and custom rebinding profiles

## Project structure

- `index.html` — main UI shell and overlay layout
- `styles.css` — dark theme styling and HUD overlays
- `manifest.json` — PWA metadata for installability
- `icon.svg` — app icon used by install manifest
- `sw.js` — service worker for offline caching
- `js/` — modular app logic for rendering, input, and world building

## Deployment notes

- Keep `manifest.json` and `icon.svg` next to `index.html` for GitHub Pages compatibility.
- Use HTTPS to enable install prompts and service worker support on mobile devices.
