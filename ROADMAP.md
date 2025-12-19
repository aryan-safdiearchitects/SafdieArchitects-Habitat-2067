# Habitat EQ - Development Roadmap

## Current Status (December 2025)

### Completed Features

#### Core Visualization ✅
- [x] 64-column EQ strip visualization
- [x] 12-step discrete quantization (LED meter style)
- [x] Wave-based frequency distribution across columns
- [x] Smooth spring physics for column movement
- [x] Image color sampling from Habitat photo

#### Display Modes ✅
- [x] **Normal Mode** - Base visualization with grid floor
- [x] **Kaleidoscope Mode** (K) - Mirrored segments with rotation
- [x] **Neon Wireframe Mode** (N) - Glowing SVG overlay
- [x] **3D Mode** (3) - Perspective depth for strips
- [x] **Tunnel Mode** (T) - Continuous zoom through kaleidoscope
- [x] **Physics Mode** (M) - Matter.js rigid body simulation
  - [x] Parses Equalizer_Pixel.svg for UNITS and SLABS layers
  - [x] Bass-triggered explosions scatter building pieces
  - [x] Spring-like reassembly when audio quiets
  - [x] Manual explosion with SPACE, reset with R
  - [x] Synthwave glow on physics bodies

#### Particle System ✅
- [x] Mode cycling with P key
- [x] **EQ Rise Mode** - Square particles rising in columns
  - [x] Column-aligned spawning in normal mode
  - [x] Radial spawning pattern in kaleidoscope mode
  - [x] Image color sampling for particles
  - [x] Synthwave color fallback for dark areas
- [x] **Explosion Mode** - Bass-triggered bursts
- [x] **Disintegration Mode** - Building dissolves into particles
- [x] **Vortex Mode** - Orbital spiral physics
- [x] **Fireworks Mode** - Rocket launch and burst

#### Audio ✅
- [x] Microphone input
- [x] Audio file drag-and-drop
- [x] FFT analysis (bass/mid/treble)
- [x] Audio-reactive rotation speeds (tunnel mode)

#### Visual Effects ✅
- [x] Neon glow (canvas shadows)
- [x] Perspective grid floor with scrolling
- [x] Scanlines overlay
- [x] Vignette effect
- [x] Glitch effects on bass hits
- [x] Level meters display

---

## Potential Future Enhancements

### Particle System Improvements
- [ ] Add radial variants for other particle modes (explosion, vortex, fireworks)
- [ ] Particle trails/afterimages
- [ ] Particle size variation based on frequency
- [ ] Particle color cycling with beat

### New Display Modes
- [ ] **Mirror Mode** - Horizontal/vertical mirror without kaleidoscope rotation
- [ ] **Zoom Pulse** - Entire image pulses in/out with bass
- [ ] **Slice Mode** - Horizontal slices instead of vertical columns
- [x] ~~**Scatter Mode** - Columns break apart and reassemble~~ (Implemented as Physics Mode)

### Audio Enhancements
- [ ] Beat detection for more precise triggers
- [ ] Multiple frequency band visualization (more than 3)
- [ ] Audio recording/playback
- [ ] Playlist support

### UI/UX
- [ ] On-screen control panel (show/hide)
- [ ] Mode indicator icons
- [ ] Preset save/load
- [ ] Fullscreen toggle (F key)
- [ ] Screenshot capture (S key)
- [ ] Video recording

### Performance
- [ ] WebGL renderer option for better performance
- [ ] Particle pooling to reduce garbage collection
- [ ] Frame rate limiting option
- [ ] Quality presets (low/medium/high)

### Additional Effects
- [ ] Chromatic aberration
- [ ] Bloom/HDR glow
- [ ] Film grain
- [ ] Color palette cycling
- [ ] Day/night color themes

---

## Session Notes

### Current Session - Performance Optimization & Refinements (December 18, 2025)
**Major performance improvements and visual refinements to sketch_v2.js:**

- **Performance Optimizations Applied:**
  - **30fps framerate cap** - Reduces rendering workload by 50%
  - **Reduced floor count** - 20 floors (down from 40) for 50% fewer draw calls
  - **Reduced shadow blur range** - 10-50px (down from 20-80px) for faster rendering
  - **Streamlined HTML** - `index_v2_streamlined.html` loads only 6 essential libraries instead of 20+
  - **Disabled scanlines/vignette** - Removed expensive overlay effects
  - **Updated mask** - Now uses `Equalizer BW mask 2.png`

- **Visual Enhancements:**
  - **Enhanced brightness** - Alpha range increased to 60-255 (from 40-200)
  - **ADD blend mode** - Maintained for intense neon glow effect
  - **Optimized particle spacing** - EQ Rise particles have better flow

- **EQ Rise Particle Improvements:**
  - **Rectangular particle shape** - Width remains full, height reduced to 1/3 for LED bar look
  - **Optimized spawn rate** - Reduced from 0.3 to 0.15 for better spacing
  - **Increased velocity** - Changed from -2 to -4 base, energy multiplier from 3 to 5
  - **Vertical spawn position** - Adjusted to 9% below middle after multiple iterations
  - **Smoother vertical flow** - Particles rise faster with more space between them
  - **Column range** - Limited to columns 6-54 for focused coverage
  - **Color sampling** - Random sampling from entire image height (not fixed position)
  - **Vibrant color filtering** - Increased threshold to 300 to filter out dark/grey tones
  - **Synthwave fallback** - Dark colors replaced with magenta/orange/cyan based on frequency region

- **Vertical Flow Mode** - NOW DEFAULT MODE (V key toggles, but starts ON)
  - Bass (magenta) flows UP from bottom
  - Treble (cyan) flows DOWN from top
  - Mid (orange) emanates from CENTER and spreads both ways
  - Sine wave propagation with time-based animation
  - Alpha mask support with pre-loaded pixels
  - ADD blend mode for color addition and intense glow

**Files created/updated:**
- `index_v2_streamlined.html` - **NEW RECOMMENDED** - Only loads essential libraries
- `sketch_v2.js` - Performance-tuned with all optimizations
- `README.md` - Updated with current specifications
- `ROADMAP.md` - This file

### Previous Session - Physics Mode (December 2025)
- Added Matter.js physics engine integration
- New Physics Mode (M key) for explosion/reassembly effects
- Parses Equalizer_Pixel.svg to extract UNITS and SLABS layer rectangles
- Creates rigid bodies for each building element (~1000+ pieces)
- Bass hits trigger explosive forces scattering the building
- Spring-like attraction reassembles pieces when audio quiets
- Synthwave glow effects on physics bodies (yellow/orange for units, cyan/magenta for slabs)

### Previous Session (December 2025)
- Implemented EQ Rise particle mode with square LED-style particles
- Added radial particle spawning for kaleidoscope mode
- Particles now sample colors from the Habitat image
- Particles in kaleidoscope mode expand outward from center
- Particles rotate with the kaleidoscope rotation

### Key Implementation Details

**Physics Mode (Matter.js):**
- Loads Equalizer_Pixel.svg and parses UNITS/SLABS layers
- Transforms SVG viewBox coordinates (5120x3200) to screen space
- Creates Matter.js rigid bodies with original positions stored
- Explosion applies radial force from center with upward bias
- Reassembly uses spring-like attraction (F = k * distance)
- Bodies snap to original position when close enough
- Glow intensity based on body velocity

**Radial Particle Spawning (Kaleidoscope Mode):**
- Spawns particles in 8 rings across each kaleidoscope segment
- Inner rings respond to bass, outer rings to treble
- Particles store polar coordinates (angle, radius)
- Outward velocity with slight acceleration
- Rotation synced with kaleidoscope rotation

**Column Particle Spawning (Normal Mode):**
- Particles spawn at top of displaced columns
- Locked to column X position (no horizontal drift)
- Rectangular shape: width full size, height = 1/3 width
- Increased upward velocity: -4 to -9 (was -2 to -5)
- Reduced spawn rate: 0.15 (was 0.3) for better spacing
- Negative gravity (-0.01) for continuous upward motion

**Vertical Flow Mode Implementation (sketch_v2.js):**
- `updateVerticalFlow()` - Sine wave propagation with time-based animation
- `drawVisualizationVerticalFlow()` - Static image + animated color overlays
- Alpha mask sampling with coordinate scaling (Math.floor for bounds)
- Batch rendering: set glow once per floor, draw all 64 columns
- Floor energy calculated per frame: bass/treble/mid with interference
- `initializeFloorEnergies()` - Initialize 20 floor objects with energy tracking (optimized from 40)
- 30fps framerate cap in setup()
- Shadow blur: 10-50px (optimized from 20-80px)
- Fill alpha: 60-255 (enhanced from 40-200)
- ADD blend mode for intense color mixing

---

## File Structure Reference

```
sketch_v2.js key sections (OPTIMIZED):
├── Lines 1-77      - Global variables, vertical flow mode vars, color palette
├── Lines 83-95     - preload() - Load habitat.png and Equalizer BW mask 2.png
├── Lines 97-145    - setup() - 30fps cap, load mask pixels, initialize floor energies
├── Lines 147-169   - initializeFloorEnergies() with precomputeFloorSlices()
├── Lines 184-222   - updateVerticalFlow() - Sine wave bidirectional propagation
├── Lines 224-334   - drawVisualizationVerticalFlow() - MAIN RENDERING with alpha mask
├── Lines 336+      - Particle fountains, physics, kaleidoscope (original modes)
├── Lines 2192-2299 - updateAuraModeColumns() - EQ Rise particle system
├── Lines 2700+     - keyPressed() - V key toggles vertical flow mode

Key function: drawVisualizationVerticalFlow() (Lines 224-334)
- Draws static habitat image first
- Sets ADD blend mode for intense glow
- Loops through 20 floors, calculates energy per floor
- Samples alpha mask (Equalizer BW mask 2.png) with coordinate scaling
- Shadow blur: 10-50px based on energy
- Fill alpha: 60-255 based on energy
- Batch draws all 64 columns per floor with same glow settings
- Resets blend mode to BLEND when done

Key optimization settings:
- frameRate(30) - 30fps cap
- numFloors = 20 - Half the original 40
- Scanlines/vignette disabled
- Only 6 essential libraries loaded in index_v2_streamlined.html
```
