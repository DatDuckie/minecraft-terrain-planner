# Role & Objective
You are an expert full-stack web developer. Build a complete, single-file or multi-file Progressive Web App (PWA) HTML/JS/CSS tool for 3D Minecraft-style building and terrain planning, optimized for desktop and Xbox gamepad use. Keep the layout compact on small screens, but do not add a mobile touch-control mode.

Treat this README as the project specification; record future feature requests here before implementing them.

---

# Architecture & File Structure
Organize the codebase into the following file structure for modularity and maintainability:

/minecraft-terrain-planner/
│
├── index.html            # Main entry point, UI shell, HUD overlay elements, canvas wrapper
├── manifest.json         # Static PWA configuration for GitHub Pages and install
├── icon.svg              # Original scalable app icon used by the PWA manifest
├── sw.js                 # Service Worker for offline caching and PWA installation
│
├── styles.css            # Modern dark theme styles (deep black boxes, gray borders, crisp white text, striking red accents)
│
└── js/
    ├── app.js            # App initialization, main game loop, event listeners, state management
    ├── renderer.js       # Three.js setup, flight camera, skybox, raycasting logic, infinite ground grid
    ├── builder.js        # Building logic (diagonals, quarter circles, sloped stairs, wall extenders, volumes)
    ├── controls.js       # Keyboard and Xbox controller input
    ├── palette.js        # Color palette, generated texture options, procedural noise
    └── save-system.js    # LocalStorage persistence, JSON world export/import, master reset

---

# Core Feature Requirements

### 1. Web PWA & Icons
- Static `manifest.json` linked from the HTML entry point so GitHub Pages and mobile browsers can install the PWA.
- An isometric square logo canvas icon with three visible faces in distinct colors: Red (left), Blue (right), Green (top).

### 2. Modern Dark Theme UI Design (`styles.css`)
- Sleek, modern dark aesthetic featuring deep black background cards (`#0a0a0a`), clean dark-gray borders (`#262626`), and crisp high-contrast white text.
- Vibrant accent highlights (e.g., striking retro red highlights for active selection states).
- Remove the "LIVE PREVIEW" label from the 3D viewport HUD; keep useful world coordinates.
- Draw original block-silhouette icons for the tools using square cells (for example: a single square for Block, a horizontal row for Wall, a vertical stack for Pillar, and rising diagonal squares for Diagonal). Do not use generic text glyphs as the tool artwork.
- Keep the complete app within the visible screen without page or panel scrolling at common desktop and compact phone viewport sizes.
- Remove the bottom HUD bar. Put the three-card tool selector and gamepad action hints in a compact overlay at the top of the 3D viewport.
- Present the build menu as a dismissible right-side overlay, open by default. It must not reserve viewport space while closed.

### 3. 3D Engine, Infinite Ground Grid & Adaptive Placement (`renderer.js`)
- **Three.js WebGL Renderer:** Flight camera physics, crosshair, and skybox.
- **Flat Ground Grid:** A dark blue-charcoal (`#202832`) ground plane with high-contrast grid lines where every grid square represents the exact 1x1 dimensions of a block. Keep the sky color unchanged.
- **Adaptive Raycasting & Range:**
  - *Ground/Grid Targeted Placement:* Infinite raycast range when pointing at the ground/grid or existing blocks, allowing placement anywhere visible regardless of distance.
  - *Air Placement:* When looking into open air, placement targets a floating point directly in front of the player (default distance: 2 to 5 blocks, adjustable in settings).
- **Wireframe Preview:** Highlight the active box-based shape dimensions and show red block-cell previews before confirming placement.

### 4. Customizable Settings System
Comprehensive settings menu allowing users to configure:
- **Block Scale:** Adjustable multiplier for individual block size.
- **Grid Bounds:** Customizable grid render radius/extent.
- **Air Placement Distance:** Configurable offset distance for floating block placement.
- **Master Reset:** Option to wipe cached storage and restore defaults.

### 5. Retro Box-Scrolling D-Pad UI & Controller Integration (`controls.js`)
- **Stacked Retro Box HUD:** 
  - Positioned in a compact overlay at the top of the viewport, featuring three selection boxes with visual up/down arrows.
  - The active selection box is highlighted in a striking red accent color.
- Build menu overlay can be opened/closed from its visible toggle; gamepad View/Back or keyboard B also toggles it.
- **D-Pad & Controller Mapping (Xbox Gamepad API):**
  - **D-Pad Left / Right:** Scroll horizontally through primary tool categories.
  - **D-Pad Up / Down:** Scroll vertically through subcategory boxes with live visual feedback.
  - **LT:** Break block | **RT:** Place block
  - **Y:** Cycle active block colors/palette
  - **X:** Toggle main settings menu
  - **LB:** Toggle texture options; with the editor open, D-Pad Left/Right selects texture size, A toggles procedural noise, and B applies the texture.
  - **View/Back:** Toggle the build menu overlay. Keyboard B toggles the build menu and T opens/closes texture options while the build menu is open.
  - **Left Stick:** Flight movement | **Right Stick:** Camera look
- **Computer Controls:** WASD to fly, mouse or I/K/O/L to look, P/E to place/advance the shape-placement steps, M/Q to break, and 0, Escape, or Numpad 0 to cancel an unfinished shape. I/K/O/L provide keyboard camera look from the right-hand key cluster.
- **Xbox Controls:** Left stick to fly, right stick to look, RT to place/advance the shape-placement steps, LT to break, and B to cancel an unfinished shape. Keep the same placement sequence on keyboard and controller. Show keyboard hints by default and switch the HUD hints to Xbox when a gamepad is connected.
- **Keyboard Texture Controls:** T opens/closes texture options, O/L selects texture size, I toggles noise, and P applies the texture. These keys act contextually while the texture editor is open.

### 6. Advanced Building Tools & Complex Geometries (`builder.js`)
- **Box-Based Placement:** Every building mode begins with two points: RT/P/E selects a first base corner, then an opposite X/Z corner on that same Y level. Floor, Circle, Quarter circle, and Curved arc are flat: the second point shows their preview, and another RT/P/E builds them without a height step. Other modes aim at the desired top Y and press RT/P/E to lock a bright-red shape preview inside a bounding-box outline; press RT/P/E again to build it. Escape/0/Numpad 0 (keyboard) or B (Xbox) cancels. The selected mode defines the shape inside the user-sized box, rather than using fixed preset dimensions.
- **Preview Accuracy:** The red block preview and bounding-box outline must match the cells that will actually be placed for the active mode. Keep a larger white wireframe marker on the currently targeted cell, and show readable X/Y/Z coordinate ranges, dimensions, and block count while sizing or confirming.
- **Control Hint Styling:** Automatically show keyboard hints by default and Xbox hints when a gamepad is connected. Use a subtle translucent dark backing behind each hint row and translucent white backplates behind the key/controller badges.
- **Expanded Diagonals & Curves:** Dedicated tools for smooth 45-degree diagonal walls, sloped stairs/ramps, and precise **quarter circles** and smooth curved arcs for organic building.
- **Wall Extender & Volume Shapes:** Solid wall extensions along cardinal axes, plus circles, cylinders, and spheres.

### 7. Palette, Textures & Procedural Noise (`palette.js`)
- Color picker with custom palette saving and active color selection.
- Controller-friendly texture editor with four size choices: 1x1, 8x8, 16x16, and 32x32. Procedural noise is an explicit on/off toggle and starts off.
- Do not offer individual pixel editing; generate the selected texture from the active block color and optional procedural noise.

### 8. Storage & Export (`save-system.js`)
- Automatic persistent saving of settings and worlds to LocalStorage.
- Export world to JSON file and import JSON file to restore builds.
- Master clear option to wipe cached storage.

### GitHub Pages Deployment
- Keep `manifest.json` and `icon.svg` beside `index.html`; their relative URLs and the manifest's `./` start URL and scope work on both project Pages URLs and custom domains.
- Publish over HTTPS for mobile installation and service-worker/offline support.
- On a phone, open the published site in the browser and choose its install/add-to-home-screen action.