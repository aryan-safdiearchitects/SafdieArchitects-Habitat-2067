# Habitat EQ - 80s Synthwave Graphic Equalizer

An audio-reactive visualization featuring Safdie Architects' Habitat 67 building, designed for the Holiday party. The visualization transforms the iconic brutalist architecture into a pulsing, neon-drenched synthwave experience.

## Features

### Core Visualization
- **64-column EQ strips** - The Habitat image is sliced into 64 vertical columns that respond to audio frequencies
- **12-step discrete quantization** - Columns move in discrete steps like vintage LED EQ meters
- **Wave-based audio distribution** - Bass/mid/treble frequencies distributed across columns in repeating patterns
- **Traveling wave animation** - Energy waves ripple across the columns

### Visual Effects
- **Neon glow** - Canvas shadow effects create authentic synthwave glow
- **Perspective grid floor** - 80s-style neon grid receding to horizon
- **Scanlines** - CRT monitor effect overlay
- **Vignette** - Dark edges for retro monitor feel
- **Glitch effects** - Triggered on heavy bass hits

### Display Modes

| Key | Mode | Description |
|-----|------|-------------|
| **V** | Vertical Flow Mode | **DEFAULT MODE** - Bidirectional energy waves flow through building (see below) |
| **K** | Kaleidoscope | Mirrors the visualization into rotating segments |
| **N** | Neon Wireframe | Glowing SVG outline overlay of the building |
| **3** | 3D Mode | Strips gain depth perspective, moving toward/away from viewer |
| **T** | Tunnel Mode | (Kaleidoscope only) Continuous zoom through wormhole effect |
| **M** | Physics Mode | Matter.js rigid body simulation with explosion/reassembly |
| **P** | Particle Mode | Cycles through 6 particle effects (see below) |

### Vertical Flow Mode (Press V - ON by default)

**Performance-optimized mode** featuring bidirectional energy wave propagation:

- **Bass (Magenta)** - Flows upward from the bottom of the building
- **Treble (Cyan)** - Flows downward from the top of the building
- **Mid (Orange)** - Emanates from the center and spreads both ways
- **20 horizontal floor bands** - Optimized from 40 for better performance
- **Constructive interference** - Energy creates dramatic patterns where flows meet
- **Alpha mask support** - Uses `Equalizer BW mask 2.png` to constrain glows to building structure only
- **Optimized rendering** - 30fps cap, reduced blur (10-50px), batch drawing with pre-loaded mask pixels
- **ADD blend mode** - Intense neon glow effect with color addition
- **Enhanced brightness** - Alpha range 60-255 for vibrant colors

**How it works:**
- Static building image stays in place (no movement)
- Colored energy waves animate over the building as glowing overlays
- Sine wave propagation with delays creates traveling wave effect
- Only draws glows where alpha mask is bright (white = building, black = background)

**Performance optimizations:**
- 30fps framerate cap for smooth rendering
- Reduced shadow blur range (10-50px instead of 20-80px)
- 20 floors instead of 40 (50% reduction in draw calls)
- Per-column masking with pre-loaded pixel data
- Scanlines and vignette disabled for performance

### Physics Mode (Press M)

Uses Matter.js physics engine with the `Equalizer_Pixel.svg` building representation:
- **UNITS layer** - Yellow rectangles representing building units (~1000+ pieces)
- **SLABS layer** - Cyan rectangles representing floor slabs
- **Bass-triggered explosions** - Strong bass hits scatter the building pieces outward
- **Reassembly** - When audio quiets, pieces are attracted back to original positions
- **Manual controls**: SPACE for explosion, R to reset positions
- **Synthwave glow** - Bodies glow based on velocity (yellow/orange for units, cyan/magenta for slabs)

### Particle Modes (Press P to cycle)

1. **OFF** - No particles
2. **EQ RISE** - Rectangular LED-style particles rise from columns
   - **Optimized particle shape**: Wide horizontal bars (height = 1/3 of width) for classic LED look
   - **Optimized spacing**: Reduced spawn rate (0.15) and increased velocity (-4 to -9) for smooth flow
   - **Spawn position**: Particles spawn 9% below middle of screen for optimal visual flow
   - **Color sampling**: Samples colors randomly from entire image height, filters out dark/grey tones (threshold 300)
   - **Vibrant fallback**: Dark colors replaced with synthwave magenta/orange/cyan based on frequency region
   - **Column range**: Particles spawn from columns 6-54 for focused coverage
   - In normal mode: Particles rise straight up in column-aligned lines
   - In kaleidoscope mode: Particles spawn radially matching kaleidoscope segments, expanding outward
3. **EXPLOSION** - Bass hits trigger particle bursts from random building locations
4. **DISINTEGRATE** - Building slowly dissolves into drifting particles
5. **VORTEX** - Particles spiral around screen center with orbital physics
6. **FIREWORKS** - Bass triggers firework rockets that explode into colorful bursts

### Additional Controls

- **+/-** (in Kaleidoscope mode) - Adjust number of mirror segments (4-16)
- **Arrow Up/Down** (in Neon mode) - Adjust number of active glowing paths
- **Arrow Left/Right** (in Neon mode) - Rotate which paths are glowing
- **Click** - Start audio (microphone input)
- **Drag & Drop** - Load audio file

## Audio Input

- Click to start microphone input
- Drag and drop any audio file to play it through the visualizer
- FFT analysis extracts bass, mid, and treble frequencies

## Files

```
HABITAT_EQ/
├── index.html                   # Original version with all modes
├── index_v2.html                # Optimized version (loads all libraries)
├── index_v2_streamlined.html    # **RECOMMENDED** - Streamlined with only essential libraries
├── sketch.js                    # Original code (~2500 lines)
├── sketch_v2.js                 # **OPTIMIZED** - Vertical flow mode with performance tuning
├── sketch_v2_optimized.js       # Standalone streamlined version (experimental)
├── style.css                    # Minimal styling
├── habitat.png                  # Source image of Habitat 67 building
├── habitat.svg                  # Vector outline for neon wireframe mode
├── Equalizer_Pixel.svg          # Pixel-art SVG with UNITS/SLABS layers for physics
├── Equalizer BW mask 1.png      # Alpha mask (original)
├── Equalizer BW mask 2.png      # **ACTIVE MASK** - Defines where glows appear (white = building)
├── README.md                    # This file
├── ROADMAP.md                   # Development roadmap and future ideas
└── libraries/                   # p5.js and extensions
    ├── p5.min.js                # Core p5.js (loaded)
    ├── p5.sound.min.js          # Audio analysis (loaded)
    ├── p5.particle.js           # Fountain particle system (loaded)
    ├── p5.Polar.min.js          # Polar coordinate helpers (loaded)
    ├── p5.glitch.js             # Glitch effects (loaded)
    ├── p5.collide2d.min.js      # Collision detection (loaded)
    └── ... (other extensions - not loaded in streamlined version)
```

**Recommended Usage:** Open `index_v2_streamlined.html` for best performance with only essential libraries loaded.

**Note:** Matter.js physics engine is loaded via CDN in index.html.

## Technical Notes

### Color Palette
```javascript
const colors = {
  darkPurple: [13, 2, 33],      // Background
  magenta: [255, 0, 110],       // Bass response
  cyan: [0, 255, 255],          // Treble response
  orange: [255, 95, 31],        // Mid response
  pink: [255, 100, 200],        // Accent
};
```

### Key Variables (sketch_v2.js)
- `numColumns = 64` - Number of vertical EQ strips
- `numFloors = 20` - Number of horizontal floor bands (reduced from 40 for performance)
- `flowSpeed = 0.25` - Wave propagation speed
- `verticalFlowMode = true` - Vertical flow mode ON by default
- `frameRate(30)` - 30fps cap for performance
- `shadowBlur = map(energy, 0.05, 1, 10, 50)` - Blur range (reduced from 20-80)
- `alpha = map(energy, 0.05, 1, 60, 255)` - Fill opacity range
- `blendMode(ADD)` - Additive color blending for intense glow
- `kaleidoscopeSegments = 8` - Default mirror segments
- `numActivePaths = 50` - Neon wireframe paths shown at once
- `numTunnelLayers = 8` - Depth layers for tunnel effect

### EQ Rise Particle Parameters (sketch_v2.js)
- `particleSize = colWidth * 0.8` - Particle width
- `height = particleSize / 3` - Particle height (1/3 of width for LED bar look)
- `spawnChance = energy * 0.15` - Spawn rate (reduced for spacing)
- `vy = -4 - energy * 5` - Upward velocity (increased for smooth flow)

## Credits

- Building: Habitat 67 by Moshe Safdie (Safdie Architects)
- Visualization: Claude Code AI assistant
- Libraries: p5.js ecosystem
