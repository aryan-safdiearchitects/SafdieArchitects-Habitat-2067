// Habitat EQ - 80s Synthwave Graphic Equalizer
// For Safdie Architects Holiday Party

let habitatImg;
let maskImg; // Alpha mask to limit glow to building only
let fft;
let audio;
let glitch;
let columns = [];
let numColumns = 64; // Number of EQ bands
let isPlaying = false;
let particles = [];

// Kaleidoscope mode
let kaleidoscopeMode = false;
let kaleidoscopeSegments = 8; // Number of mirror segments
let kaleidoscopeRotation = 0; // Slow rotation
let pg; // Off-screen graphics buffer

// Neon wireframe overlay
let neonMode = false;
let svgPaths = []; // Array of path data extracted from SVG
let activePaths = []; // Currently glowing paths
let pathRotationIndex = 0; // Which batch of paths to show
let numActivePaths = 50; // How many paths glow at once
let svgLoaded = false;
let svgViewBox = { width: 1280, height: 800 }; // Default, will be updated from SVG

// 3D Mode
let mode3D = false;
let tunnelDepth = 0; // For tunnel acceleration effect
let stripZPositions = []; // Z depth for each strip

// Tunnel mode for kaleidoscope
let tunnelMode = false;
let tunnelLayers = []; // Store previous frames for trail effect
let numTunnelLayers = 8; // Number of depth layers
let tunnelSpeed = 0; // Current tunnel speed
let tunnelPhase = 0; // Separate phase variable for tunnel kaleidoscope

// Particle Fountain modes
let particleMode = 0; // 0=off, 1=eq-rise, 2=explosion, 3=disintegration, 4=vortex, 5=fireworks
let particleModeNames = ['OFF', 'EQ RISE', 'EXPLOSION', 'DISINTEGRATE', 'VORTEX', 'FIREWORKS'];
let auraFountains = []; // Fountains for aura mode (unused now, kept for compatibility)
let explosionFountains = []; // Fountains for explosion mode
let vortexFountain = null; // Single vortex fountain
let fireworkFountains = []; // Firework burst fountains
let disintegrationParticles = []; // For disintegration mode
let eqParticles = []; // Square EQ-style particles that rise in columns

// Matter.js Physics Mode
let physicsMode = false;
let matterEngine = null;
let matterWorld = null;
let physicsBodies = []; // All physics bodies
let physicsUnits = [];  // UNITS layer bodies
let physicsSlabs = [];  // SLABS layer bodies
let originalPositions = []; // Store original positions for reassembly
let physicsInitialized = false;
let reassembling = false; // Whether pieces are being pulled back
let lastBassHit = 0; // Frame of last bass explosion
let pixelSvgLoaded = false;
let pixelSvgData = { units: [], slabs: [], sun: [] };
const PIXEL_SVG_VIEWBOX = { width: 5120, height: 3200 };

// Vertical Flow Mode
let verticalFlowMode = true; // ON by default
let numFloors = 20; // Number of horizontal bands (reduced from 40 to 20 for performance)
let floorEnergies = []; // Store energy for each floor
let flowSpeed = 0.25; // How fast energy propagates (increased for faster wave)
let floorSlices = []; // Pre-computed slices for each column x floor

// Touch Controls for Mobile
let touchModeIndex = 0; // Current mode in the cycle
let lastTouchTime = 0; // For double-tap detection
let touchHoldTimer = 0; // For touch-and-hold detection
let showModeOverlay = false; // Show current mode name
let modeOverlayTimer = 0; // Timer to hide overlay

// Synthwave color palette
const colors = {
  darkPurple: [13, 2, 33],
  magenta: [255, 0, 110],
  cyan: [0, 255, 255],
  orange: [255, 95, 31],
  pink: [255, 100, 200],
  gridCyan: [0, 255, 255, 150]
};

function preload() {
  // Load the Habitat image
  habitatImg = loadImage('habitat.png',
    () => console.log('Image loaded successfully'),
    (err) => console.error('Failed to load image:', err)
  );

  // Load the alpha mask
  maskImg = loadImage('Equalizer BW mask 2.png',
    () => console.log('Mask loaded successfully'),
    (err) => console.error('Failed to load mask:', err)
  );
}

function setup() {
  createCanvas(windowWidth, windowHeight);

  // Set framerate to 30fps for better performance
  frameRate(30);

  // Initialize audio context (will start on user click)
  fft = new p5.FFT(0.8, numColumns * 2);

  // Initialize glitch processor
  glitch = new Glitch();
  glitch.pixelate(1);
  glitch.loadType('jpeg');
  glitch.loadQuality(0.5);

  // Create column slices from the image
  createColumns();

  // Create off-screen buffer for kaleidoscope
  pg = createGraphics(windowWidth, windowHeight);

  // Create tunnel layer buffers for tunnel kaleidoscope effect
  for (let i = 0; i < numTunnelLayers; i++) {
    tunnelLayers.push(createGraphics(windowWidth, windowHeight));
  }

  // Load SVG for neon wireframe
  loadSVGPaths();

  // Load pixel SVG for physics mode
  loadPixelSVG();

  // Initialize particle fountains for each mode
  initializeParticleFountains();

  // Initialize floor energies for vertical flow mode
  initializeFloorEnergies();

  // Load mask pixels once in setup for better performance
  if (maskImg && maskImg.width > 0) {
    maskImg.loadPixels();
    console.log('Mask pixels loaded. Mask size:', maskImg.width, 'x', maskImg.height);
  } else {
    console.warn('Mask image not loaded yet');
  }

  // Instructions overlay
  textAlign(CENTER, CENTER);
  textSize(24);
}

// Initialize floor energy tracking
function initializeFloorEnergies() {
  floorEnergies = [];
  for (let i = 0; i < numFloors; i++) {
    floorEnergies.push({
      bassEnergy: 0,      // Bass flowing up from bottom
      trebleEnergy: 0,    // Treble flowing down from top
      midEnergy: 0,       // Mid meeting in middle
      totalEnergy: 0,     // Combined energy
      bassPhase: 0,       // How far bass wave has traveled
      treblePhase: 0,     // How far treble wave has traveled
      midPhase: 0         // How far mid wave has traveled
    });
  }

  // Pre-compute floor slices for performance
  precomputeFloorSlices();
}

// Pre-compute image slices for each column x floor combination
function precomputeFloorSlices() {
  floorSlices = [];
  let floorHeight = habitatImg.height / numFloors;

  for (let i = 0; i < columns.length; i++) {
    floorSlices[i] = [];
    let col = columns[i];

    for (let f = 0; f < numFloors; f++) {
      let floorY = floor(f * floorHeight);
      let sliceHeight = ceil(floorHeight);

      // Extract the slice once and store it
      let slice = col.slice.get(0, floorY, col.width, sliceHeight);
      floorSlices[i][f] = slice;
    }
  }
}

// Update vertical flow energies - bidirectional propagation
function updateVerticalFlow(bass, mid, treble) {
  let bassNorm = bass / 255;
  let midNorm = mid / 255;
  let trebleNorm = treble / 255;

  // Time-based wave for traveling effect
  let time = frameCount * 0.1;

  // Propagate bass upward from bottom (floor 0)
  for (let i = 0; i < numFloors; i++) {
    let floor = floorEnergies[i];

    // Bass flows UP from bottom - use sine wave with vertical offset
    let distFromBottom = i / (numFloors - 1);
    let bassWave = sin(time - distFromBottom * PI * 2); // Wave travels upward
    floor.bassEnergy = bassNorm * max(0, bassWave) * (1 - distFromBottom * 0.2); // Less attenuation

    // Treble flows DOWN from top
    let distFromTop = 1 - distFromBottom;
    let trebleWave = sin(time - distFromTop * PI * 2); // Wave travels downward
    floor.trebleEnergy = trebleNorm * max(0, trebleWave) * (1 - distFromTop * 0.2);

    // Mid frequencies emanate from center and spread both ways
    let distFromCenter = abs(i - numFloors / 2) / (numFloors / 2);
    let midWave = sin(time - distFromCenter * PI * 2);
    floor.midEnergy = midNorm * max(0, midWave) * (1 - distFromCenter * 0.1);

    // Combine all energies with boosted weights for more dramatic effect
    floor.totalEnergy = floor.bassEnergy * 0.5 + floor.trebleEnergy * 0.4 + floor.midEnergy * 0.4;

    // Add constructive interference where flows meet
    let interference = floor.bassEnergy * floor.trebleEnergy * 0.8; // Stronger interference
    floor.totalEnergy += interference;

    // Boost overall energy for more visible effect
    floor.totalEnergy = min(floor.totalEnergy * 1.5, 1);
  }
}

// Draw visualization with vertical flow mode
function drawVisualizationVerticalFlow(target, bass, mid, treble) {
  // Update the floor energies
  updateVerticalFlow(bass, mid, treble);

  // Calculate scale to FILL the screen
  let imgScale = max(target.width / habitatImg.width, target.height / habitatImg.height);
  let imgW = habitatImg.width * imgScale;
  let imgH = habitatImg.height * imgScale;
  let imgX = (target.width - imgW) / 2;
  let imgY = (target.height - imgH) / 2;

  // FIRST: Draw the static background image (no displacement)
  target.push();
  target.image(habitatImg, imgX, imgY, imgW, imgH);
  target.pop();

  // SECOND: Draw animated color waves on top
  target.push();
  target.translate(imgX, imgY);
  target.scale(imgScale);

  // Height of each floor band
  let floorHeight = habitatImg.height / numFloors;

  // OPTIMIZED: Batch draw energy waves by floor, masked by building shape
  target.blendMode(ADD);
  target.noStroke();

  // Check if mask is loaded and has pixels
  let useMask = maskImg && maskImg.width > 0 && maskImg.pixels && maskImg.pixels.length > 0;

  // Debug: log once
  if (frameCount === 100) {
    console.log('useMask:', useMask);
    if (maskImg) {
      console.log('maskImg dimensions:', maskImg.width, 'x', maskImg.height);
      console.log('maskImg pixels length:', maskImg.pixels ? maskImg.pixels.length : 'no pixels');
    }
  }

  for (let f = 0; f < numFloors; f++) {
    let floor = floorEnergies[f];
    let floorY = f * floorHeight;
    let sliceHeight = ceil(floorHeight);
    let energy = floor.totalEnergy;

    // Skip if no energy
    if (energy <= 0.05) continue;

    // Determine dominant color once per floor
    let dominantColor;
    if (floor.bassEnergy > floor.trebleEnergy && floor.bassEnergy > floor.midEnergy) {
      dominantColor = colors.magenta;
    } else if (floor.trebleEnergy > floor.bassEnergy && floor.trebleEnergy > floor.midEnergy) {
      dominantColor = colors.cyan;
    } else {
      dominantColor = colors.orange;
    }

    // Set glow for this floor (once per floor instead of per rectangle)
    // Reduced blur range from 20-80 to 10-50 for better performance
    let blur = map(energy, 0.05, 1, 10, 50);
    target.drawingContext.shadowBlur = blur;
    target.drawingContext.shadowColor = `rgba(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]}, 1.0)`;

    let alpha = map(energy, 0.05, 1, 60, 255); // Adjusted brightness - was 80-255, now 60-255
    target.fill(dominantColor[0], dominantColor[1], dominantColor[2], alpha);

    // Draw columns for this floor, with optional masking
    for (let i = 0; i < columns.length; i++) {
      let col = columns[i];

      let shouldDraw = true; // Default: draw everywhere

      if (useMask) {
        // Sample mask at center of this column/floor position
        // Scale coordinates from habitatImg to maskImg space
        let maskScaleX = maskImg.width / habitatImg.width;
        let maskScaleY = maskImg.height / habitatImg.height;

        let sampleX = Math.floor((col.x + col.width / 2) * maskScaleX);
        let sampleY = Math.floor((floorY + sliceHeight / 2) * maskScaleY);

        // Get pixel from mask (make sure it's in bounds)
        if (sampleX >= 0 && sampleX < maskImg.width && sampleY >= 0 && sampleY < maskImg.height) {
          let pixelIndex = (sampleY * maskImg.width + sampleX) * 4;
          let brightness = maskImg.pixels[pixelIndex]; // Red channel (grayscale)

          // If you inverted the mask, bright = building, dark = skip
          shouldDraw = brightness > 128; // Threshold: draw on bright areas (inverted mask)
        } else {
          shouldDraw = false; // Out of bounds = don't draw
        }
      }

      if (shouldDraw) {
        target.rect(col.x, floorY, col.width, sliceHeight);
      }
    }
  }

  target.blendMode(BLEND);
  target.drawingContext.shadowBlur = 0; // Reset shadow

  target.pop();

  // Draw grid floor
  let gridStartY = target.height * 0.8;
  drawBottomFadeTarget(target, gridStartY);
  drawGridTarget(target, bass, gridStartY);
}

// Initialize all particle fountain configurations
function initializeParticleFountains() {
  // Synthwave colors for particles
  let synthwaveColors = [
    color(0, 255, 255),      // cyan
    color(0, 200, 255),      // light cyan
    color(255, 0, 110),      // magenta
    color(255, 50, 150),     // pink
    color(255, 95, 31),      // orange
    color(255, 200, 100)     // gold
  ];

  // AURA MODE - Create fountains for each column position (will be positioned dynamically)
  for (let i = 0; i < 16; i++) {
    let auraConfig = {
      x: 0.5,
      y: 0.5,
      angle: [-100, -80],  // Upward with spread
      speed: 3,
      speedx: 2,
      size: [3, 8],
      gravity: -0.02,  // Negative gravity - rises up
      sizePercent: 0.98,
      lifetime: 80,
      rate: [0, 3],
      color: ['#00ffff', '#00ccff', '#ff006e', '#ff64c8', '#ff5f1f']
    };
    auraFountains.push(new Fountain(null, auraConfig, width/2, height/2));
  }

  // VORTEX MODE - Central vortex with orbital acceleration
  let vortexConfig = {
    x: 0.5,
    y: 0.5,
    angle: [0, 360],
    speed: 2,
    speedx: 3,
    size: [2, 6],
    gravity: 0,
    acceleration: [0, 0],  // Will be modified dynamically
    sizePercent: 0.995,
    lifetime: 150,
    rate: [0, 5],
    color: ['#00ffff', '#ff006e', '#ff5f1f', '#00ffff']
  };
  vortexFountain = new Fountain(null, vortexConfig, width/2, height/2);
}

// Load and parse SVG paths for neon wireframe effect
function loadSVGPaths() {
  fetch('habitat.svg')
    .then(response => response.text())
    .then(svgText => {
      // Parse the SVG
      let parser = new DOMParser();
      let svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
      let svg = svgDoc.querySelector('svg');

      // Get viewBox dimensions
      let viewBox = svg.getAttribute('viewBox');
      if (viewBox) {
        let parts = viewBox.split(' ');
        svgViewBox.width = parseFloat(parts[2]);
        svgViewBox.height = parseFloat(parts[3]);
      }

      // Extract all path elements
      let paths = svgDoc.querySelectorAll('path');
      paths.forEach((path, index) => {
        let d = path.getAttribute('d');
        let className = path.getAttribute('class') || '';
        if (d) {
          svgPaths.push({
            d: d,
            className: className,
            index: index
          });
        }
      });

      svgLoaded = true;
      console.log(`Loaded ${svgPaths.length} SVG paths`);

      // Initialize active paths
      updateActivePaths();
    })
    .catch(err => console.error('Failed to load SVG:', err));
}

// Rotate which paths are currently active/glowing
function updateActivePaths() {
  if (svgPaths.length === 0) return;

  activePaths = [];
  for (let i = 0; i < numActivePaths; i++) {
    let idx = (pathRotationIndex + i) % svgPaths.length;
    activePaths.push(svgPaths[idx]);
  }
}

// Load and parse the Equalizer_Pixel.svg for physics mode
function loadPixelSVG() {
  console.log('Starting to load Equalizer_Pixel.svg...');
  fetch('Equalizer_Pixel.svg')
    .then(response => {
      console.log('Fetch response status:', response.status);
      if (!response.ok) {
        throw new Error('Failed to fetch SVG: ' + response.status);
      }
      return response.text();
    })
    .then(svgText => {
      console.log('SVG text length:', svgText.length);
      let parser = new DOMParser();
      let svgDoc = parser.parseFromString(svgText, 'image/svg+xml');

      // Check for parse errors
      let parseError = svgDoc.querySelector('parsererror');
      if (parseError) {
        console.error('SVG parse error:', parseError.textContent);
        return;
      }

      // Parse UNITS layer (yellow rectangles - st7)
      let unitsGroup = svgDoc.getElementById('UNITS');
      console.log('UNITS group found:', unitsGroup !== null);
      if (unitsGroup) {
        let rects = unitsGroup.querySelectorAll('rect');
        console.log('UNITS rects found:', rects.length);
        rects.forEach(rect => {
          pixelSvgData.units.push({
            x: parseFloat(rect.getAttribute('x')),
            y: parseFloat(rect.getAttribute('y')),
            width: parseFloat(rect.getAttribute('width')),
            height: parseFloat(rect.getAttribute('height')),
            color: [255, 255, 0] // Yellow
          });
        });
      }

      // Parse SLABS layer (cyan rectangles - st0, rotated 90°)
      let slabsGroup = svgDoc.getElementById('SLABS');
      console.log('SLABS group found:', slabsGroup !== null);
      if (slabsGroup) {
        let rects = slabsGroup.querySelectorAll('rect');
        console.log('SLABS rects found:', rects.length);
        rects.forEach(rect => {
          let x = parseFloat(rect.getAttribute('x'));
          let y = parseFloat(rect.getAttribute('y'));
          let w = parseFloat(rect.getAttribute('width'));
          let h = parseFloat(rect.getAttribute('height'));
          let transform = rect.getAttribute('transform');

          // SLABS are rotated 90°, so swap width/height and adjust position
          // The transform contains the rotation center info
          let angle = 0;
          if (transform && transform.includes('rotate(90)')) {
            angle = Math.PI / 2;
            // For 90° rotation, the rect dimensions swap
            let cx = x + w / 2;
            let cy = y + h / 2;
            pixelSvgData.slabs.push({
              x: cx,
              y: cy,
              width: h,  // Swapped due to rotation
              height: w,
              angle: angle,
              color: [0, 255, 255] // Cyan
            });
          } else {
            pixelSvgData.slabs.push({
              x: x + w / 2,
              y: y + h / 2,
              width: w,
              height: h,
              angle: 0,
              color: [0, 255, 255]
            });
          }
        });
      }

      // Parse SUN layer (orange paths - st3)
      let sunGroup = svgDoc.getElementById('SUN');
      if (sunGroup) {
        let paths = sunGroup.querySelectorAll('path');
        paths.forEach(path => {
          pixelSvgData.sun.push({
            d: path.getAttribute('d'),
            color: [255, 147, 30] // Orange
          });
        });
      }

      pixelSvgLoaded = true;
      console.log(`Loaded pixel SVG: ${pixelSvgData.units.length} units, ${pixelSvgData.slabs.length} slabs, ${pixelSvgData.sun.length} sun paths`);
    })
    .catch(err => console.error('Failed to load Equalizer_Pixel.svg:', err));
}

// Initialize Matter.js physics engine and create bodies from SVG data
function initializePhysics() {
  if (physicsInitialized) {
    console.log('Physics already initialized');
    return;
  }

  if (!pixelSvgLoaded) {
    console.log('SVG not loaded yet, retrying in 100ms...');
    setTimeout(initializePhysics, 100);
    return;
  }

  console.log('Initializing physics with', pixelSvgData.units.length, 'units and', pixelSvgData.slabs.length, 'slabs');

  // Create Matter.js engine
  matterEngine = Matter.Engine.create();
  matterWorld = matterEngine.world;

  // Reduce gravity for floaty feel
  matterEngine.world.gravity.y = 0.3;

  // Calculate scale to fit SVG to screen
  let scale = min(width / PIXEL_SVG_VIEWBOX.width, height / PIXEL_SVG_VIEWBOX.height);
  let offsetX = (width - PIXEL_SVG_VIEWBOX.width * scale) / 2;
  let offsetY = (height - PIXEL_SVG_VIEWBOX.height * scale) / 2;

  // Create bodies for UNITS
  pixelSvgData.units.forEach((unit, index) => {
    let x = offsetX + (unit.x + unit.width / 2) * scale;
    let y = offsetY + (unit.y + unit.height / 2) * scale;
    let w = unit.width * scale;
    let h = unit.height * scale;

    let body = Matter.Bodies.rectangle(x, y, w, h, {
      restitution: 0.6,
      friction: 0.1,
      frictionAir: 0.02,
      render: { fillStyle: '#ffff00' }
    });

    // Store original position for reassembly
    body.originalX = x;
    body.originalY = y;
    body.originalAngle = 0;
    body.colorType = 'yellow';
    body.layerType = 'unit';

    // Store SVG coordinates for color sampling (maps to image coordinates)
    body.svgX = unit.x + unit.width / 2;
    body.svgY = unit.y + unit.height / 2;

    Matter.World.add(matterWorld, body);
    physicsUnits.push(body);
    physicsBodies.push(body);
  });

  // Create bodies for SLABS
  pixelSvgData.slabs.forEach((slab, index) => {
    let x = offsetX + slab.x * scale;
    let y = offsetY + slab.y * scale;
    let w = slab.width * scale;
    let h = slab.height * scale;

    let body = Matter.Bodies.rectangle(x, y, w, h, {
      angle: slab.angle || 0,
      restitution: 0.6,
      friction: 0.1,
      frictionAir: 0.02,
      render: { fillStyle: '#00ffff' }
    });

    body.originalX = x;
    body.originalY = y;
    body.originalAngle = slab.angle || 0;
    body.colorType = 'cyan';
    body.layerType = 'slab';

    // Store SVG coordinates for color sampling (maps to image coordinates)
    body.svgX = slab.x;
    body.svgY = slab.y;

    Matter.World.add(matterWorld, body);
    physicsSlabs.push(body);
    physicsBodies.push(body);
  });

  // Add floor and walls to contain pieces
  let wallThickness = 100;
  let floor = Matter.Bodies.rectangle(width / 2, height + wallThickness / 2, width * 2, wallThickness, { isStatic: true });
  let leftWall = Matter.Bodies.rectangle(-wallThickness / 2, height / 2, wallThickness, height * 2, { isStatic: true });
  let rightWall = Matter.Bodies.rectangle(width + wallThickness / 2, height / 2, wallThickness, height * 2, { isStatic: true });
  let ceiling = Matter.Bodies.rectangle(width / 2, -wallThickness / 2, width * 2, wallThickness, { isStatic: true });

  Matter.World.add(matterWorld, [floor, leftWall, rightWall, ceiling]);

  physicsInitialized = true;
  console.log(`Physics initialized: ${physicsBodies.length} bodies created`);
}

// Apply explosion force to all physics bodies
function explodePhysics(strength) {
  if (!physicsInitialized) return;

  let cx = width / 2;
  let cy = height / 2;

  physicsBodies.forEach(body => {
    // Calculate direction from center
    let dx = body.position.x - cx;
    let dy = body.position.y - cy;
    let dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 0) {
      // Normalize and apply force
      let forceMagnitude = strength * (0.5 + Math.random() * 0.5);
      let fx = (dx / dist) * forceMagnitude;
      let fy = (dy / dist) * forceMagnitude - strength * 0.3; // Slight upward bias

      Matter.Body.applyForce(body, body.position, { x: fx, y: fy });

      // Add some spin
      Matter.Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.3);
    }
  });

  reassembling = false;
  lastBassHit = frameCount;
}

// Pull bodies back toward original positions
function reassemblePhysics(strength) {
  if (!physicsInitialized) return;

  physicsBodies.forEach(body => {
    let dx = body.originalX - body.position.x;
    let dy = body.originalY - body.position.y;
    let dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 1) {
      // Spring-like attraction force
      let forceMagnitude = strength * Math.min(dist / 100, 1);
      let fx = (dx / dist) * forceMagnitude;
      let fy = (dy / dist) * forceMagnitude;

      Matter.Body.applyForce(body, body.position, { x: fx, y: fy });

      // Gradually reduce angular velocity
      Matter.Body.setAngularVelocity(body, body.angularVelocity * 0.95);
    }

    // If close enough, snap to position
    if (dist < 5 && Math.abs(body.angularVelocity) < 0.01) {
      Matter.Body.setPosition(body, { x: body.originalX, y: body.originalY });
      Matter.Body.setAngle(body, body.originalAngle);
      Matter.Body.setVelocity(body, { x: 0, y: 0 });
      Matter.Body.setAngularVelocity(body, 0);
    }
  });
}

// Update and draw physics simulation
function updatePhysics(bassNorm, midNorm, trebleNorm) {
  if (!physicsInitialized) return;

  // Update physics engine
  Matter.Engine.update(matterEngine, 1000 / 60);

  // Trigger explosion on strong bass
  if (bassNorm > 0.75 && frameCount - lastBassHit > 30) {
    explodePhysics(0.02 + bassNorm * 0.03);
  }

  // Start reassembling when audio is quieter
  let overallAmp = (bassNorm * 0.5 + midNorm * 0.3 + trebleNorm * 0.2);
  if (overallAmp < 0.3 && frameCount - lastBassHit > 60) {
    reassembling = true;
  }

  // Apply reassembly forces
  if (reassembling) {
    reassemblePhysics(0.0005 + (1 - overallAmp) * 0.001);
  }

  // Draw all bodies with synthwave glow
  drawPhysicsBodies(bassNorm, midNorm, trebleNorm);
}

// Draw physics bodies with neon glow effect
function drawPhysicsBodies(bassNorm, midNorm, trebleNorm) {
  push();
  rectMode(CENTER);

  // Calculate image to SVG mapping for color sampling
  // SVG viewBox is 5120x3200, image is habitatImg.width x habitatImg.height
  let svgToImgScaleX = habitatImg.width / PIXEL_SVG_VIEWBOX.width;
  let svgToImgScaleY = habitatImg.height / PIXEL_SVG_VIEWBOX.height;

  physicsBodies.forEach(body => {
    let pos = body.position;
    let angle = body.angle;
    let vertices = body.vertices;

    // Sample color from the habitat image at the body's original SVG position
    let imgX = Math.floor(body.svgX * svgToImgScaleX);
    let imgY = Math.floor(body.svgY * svgToImgScaleY);
    imgX = constrain(imgX, 0, habitatImg.width - 1);
    imgY = constrain(imgY, 0, habitatImg.height - 1);

    let sampledColor = habitatImg.get(imgX, imgY);
    let r = sampledColor[0];
    let g = sampledColor[1];
    let b = sampledColor[2];

    // If the sampled color is too dark, use synthwave fallback
    let brightness = (r + g + b) / 3;
    if (brightness < 30) {
      if (body.colorType === 'yellow') {
        // Units - yellow/orange fallback
        r = 255;
        g = 200 - bassNorm * 100;
        b = bassNorm * 50;
      } else {
        // Slabs - cyan/magenta fallback
        r = trebleNorm * 200;
        g = 255 - trebleNorm * 100;
        b = 255;
      }
    } else {
      // Boost the sampled color slightly for visibility
      r = min(255, r * 1.2);
      g = min(255, g * 1.2);
      b = min(255, b * 1.2);
    }

    // Calculate glow intensity based on velocity
    let speed = Math.sqrt(body.velocity.x * body.velocity.x + body.velocity.y * body.velocity.y);
    let glowIntensity = min(20 + speed * 5, 40);

    // Set glow
    drawingContext.shadowBlur = glowIntensity;
    drawingContext.shadowColor = `rgba(${r}, ${g}, ${b}, 0.8)`;

    // Draw the body
    noStroke();
    fill(r, g, b, 220);

    push();
    translate(pos.x, pos.y);
    rotate(angle);

    // Get width and height from vertices (rectangle)
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    vertices.forEach(v => {
      let localX = v.x - pos.x;
      let localY = v.y - pos.y;
      // Rotate back to get local coordinates
      let cos_a = Math.cos(-angle);
      let sin_a = Math.sin(-angle);
      let rx = localX * cos_a - localY * sin_a;
      let ry = localX * sin_a + localY * cos_a;
      minX = Math.min(minX, rx);
      maxX = Math.max(maxX, rx);
      minY = Math.min(minY, ry);
      maxY = Math.max(maxY, ry);
    });
    let w = maxX - minX;
    let h = maxY - minY;

    rect(0, 0, w, h);
    pop();
  });

  drawingContext.shadowBlur = 0;
  pop();
}

// Reset physics bodies to original positions
function resetPhysics() {
  if (!physicsInitialized) return;

  physicsBodies.forEach(body => {
    Matter.Body.setPosition(body, { x: body.originalX, y: body.originalY });
    Matter.Body.setAngle(body, body.originalAngle);
    Matter.Body.setVelocity(body, { x: 0, y: 0 });
    Matter.Body.setAngularVelocity(body, 0);
  });
  reassembling = false;
}

function createColumns() {
  columns = [];
  stripZPositions = [];
  let colWidth = habitatImg.width / numColumns;

  for (let i = 0; i < numColumns; i++) {
    let x = i * colWidth;
    // Extract a vertical slice of the image
    let slice = habitatImg.get(x, 0, colWidth, habitatImg.height);
    columns.push({
      slice: slice,
      x: x,
      width: colWidth,
      height: habitatImg.height,
      targetY: 0,
      currentY: 0,
      velocity: 0,
      // 3D properties
      zOffset: 0,
      rotationX: 0,
      rotationY: 0
    });
    // Initialize Z positions for 3D mode
    stripZPositions.push(0);
  }
}

function draw() {
  // Get audio data
  let spectrum = fft.analyze();
  let bass = fft.getEnergy("bass");
  let mid = fft.getEnergy("mid");
  let treble = fft.getEnergy("treble");

  // Normalized values for physics
  let bassNorm = bass / 255;
  let midNorm = mid / 255;
  let trebleNorm = treble / 255;

  // Physics mode takes over rendering
  if (physicsMode) {
    background(colors.darkPurple);

    // Draw the habitat image behind the physics bodies
    let imgScale = min(width / habitatImg.width, height / habitatImg.height);
    let imgW = habitatImg.width * imgScale;
    let imgH = habitatImg.height * imgScale;
    let imgX = (width - imgW) / 2;
    let imgY = (height - imgH) / 2;

    push();
    tint(255, 100); // Semi-transparent
    image(habitatImg, imgX, imgY, imgW, imgH);
    pop();

    // Show loading state if physics not ready
    if (!physicsInitialized) {
      fill(255);
      textAlign(CENTER, CENTER);
      textSize(24);
      text('Loading physics...', width / 2, height / 2);
      text('pixelSvgLoaded: ' + pixelSvgLoaded, width / 2, height / 2 + 40);
      text('Units: ' + pixelSvgData.units.length + ', Slabs: ' + pixelSvgData.slabs.length, width / 2, height / 2 + 80);
    } else {
      updatePhysics(bassNorm, midNorm, trebleNorm);
    }

    // Scanlines and vignette disabled for performance
    // drawScanlines();
    // drawVignette();

    // Still show UI
    if (!isPlaying) {
      drawStartPrompt();
    }
    drawLevelMeter(bass, mid, treble);
    drawPhysicsModeIndicators();
    return;
  }

  if (kaleidoscopeMode) {
    if (tunnelMode) {
      // Tunnel kaleidoscope - accelerating through wormhole
      background(colors.darkPurple);
      drawTunnelKaleidoscope(bass, mid, treble);
    } else {
      // Regular kaleidoscope - render to off-screen buffer
      pg.background(colors.darkPurple);
      pg.push();
      if (verticalFlowMode) {
        drawVisualizationVerticalFlow(pg, bass, mid, treble);
      } else if (mode3D) {
        drawVisualization3D(pg, bass, mid, treble);
      } else {
        drawVisualization(pg, bass, mid, treble);
      }
      pg.pop();

      // Draw kaleidoscope effect from buffer
      background(colors.darkPurple);
      drawKaleidoscope(bass);
    }

    // Draw UI elements on top (not kaleidoscoped)
    // Scanlines and vignette disabled for performance
    // drawScanlines();
    // drawVignette();

    // Draw particle effects on top
    updateParticleFountains(bass, mid, treble);
  } else {
    // Normal rendering to main canvas
    background(colors.darkPurple);

    if (verticalFlowMode) {
      drawVisualizationVerticalFlow(this, bass, mid, treble);
      // Draw neon wireframe overlay if enabled
      if (neonMode && svgLoaded) {
        drawNeonWireframe(bass, mid, treble);
      }
    } else if (mode3D) {
      drawVisualization3D(this, bass, mid, treble);
      // Draw 3D neon wireframe overlay if enabled
      if (neonMode && svgLoaded) {
        drawNeonWireframe3D(bass, mid, treble);
      }
    } else {
      drawVisualization(this, bass, mid, treble);
      // Draw neon wireframe overlay if enabled
      if (neonMode && svgLoaded) {
        drawNeonWireframe(bass, mid, treble);
      }
    }

    // Draw particle effects
    updateParticleFountains(bass, mid, treble);

    // Scanlines and vignette disabled for performance
    // drawScanlines();
    // drawVignette();
  }

  // Draw UI if not playing
  if (!isPlaying) {
    drawStartPrompt();
  }

  // Draw audio levels display
  drawLevelMeter(bass, mid, treble);

  // Draw mode indicators
  if (kaleidoscopeMode) {
    push();
    fill(colors.magenta);
    noStroke();
    textSize(14);
    textAlign(RIGHT, TOP);
    text("KALEIDOSCOPE MODE [K]", width - 20, 20);
    pop();
  }

  if (neonMode) {
    push();
    fill(colors.cyan);
    noStroke();
    textSize(14);
    textAlign(RIGHT, TOP);
    let yPos = kaleidoscopeMode ? 40 : 20;
    text("NEON WIREFRAME [N]", width - 20, yPos);
    pop();
  }

  if (mode3D) {
    push();
    fill(colors.orange);
    noStroke();
    textSize(14);
    textAlign(RIGHT, TOP);
    let yPos = 20;
    if (kaleidoscopeMode) yPos += 20;
    if (neonMode) yPos += 20;
    text("3D MODE [3]", width - 20, yPos);
    pop();
  }

  if (verticalFlowMode) {
    push();
    fill(255, 255, 100); // Yellow-white for vertical flow
    noStroke();
    textSize(14);
    textAlign(RIGHT, TOP);
    let yPos = 20;
    if (kaleidoscopeMode) yPos += 20;
    if (neonMode) yPos += 20;
    if (mode3D) yPos += 20;
    text("VERTICAL FLOW [V]", width - 20, yPos);
    pop();
  }

  if (tunnelMode && kaleidoscopeMode) {
    push();
    fill(colors.pink);
    noStroke();
    textSize(14);
    textAlign(RIGHT, TOP);
    let yPos = 20;
    if (kaleidoscopeMode) yPos += 20;
    if (neonMode) yPos += 20;
    if (mode3D) yPos += 20;
    if (verticalFlowMode) yPos += 20;
    text("TUNNEL MODE [T]", width - 20, yPos);
    pop();
  }

  if (particleMode > 0) {
    push();
    // Cycle colors based on mode
    let modeColors = [colors.cyan, colors.magenta, colors.orange, colors.pink, colors.cyan];
    let c = modeColors[(particleMode - 1) % modeColors.length];
    fill(c[0], c[1], c[2]);
    noStroke();
    textSize(14);
    textAlign(RIGHT, TOP);
    let yPos = 20;
    if (kaleidoscopeMode) yPos += 20;
    if (neonMode) yPos += 20;
    if (mode3D) yPos += 20;
    if (verticalFlowMode) yPos += 20;
    if (tunnelMode && kaleidoscopeMode) yPos += 20;
    text("PARTICLES: " + particleModeNames[particleMode] + " [P]", width - 20, yPos);
    pop();
  }

  // Draw touch mode overlay (for mobile users)
  drawModeOverlay();
}

// Draw physics mode indicators (called when physics mode is active)
function drawPhysicsModeIndicators() {
  push();
  fill(255, 255, 0); // Yellow for physics
  noStroke();
  textSize(14);
  textAlign(RIGHT, TOP);
  text("PHYSICS MODE [M]", width - 20, 20);

  // Show reassembly status
  fill(reassembling ? colors.cyan : colors.magenta);
  text(reassembling ? "REASSEMBLING..." : "EXPLODING!", width - 20, 40);

  // Show body count
  fill(255);
  textSize(12);
  text(`Bodies: ${physicsBodies.length}`, width - 20, 60);

  // Instructions
  textAlign(LEFT, BOTTOM);
  fill(200);
  textSize(12);
  text("[R] Reset  [SPACE] Manual Explode  [M] Exit Physics", 20, height - 20);
  pop();
}

// Main visualization rendering (can target main canvas or buffer)
function drawVisualization(target, bass, mid, treble) {
  // Calculate scale to FILL the screen (cover, not fit)
  let imgScale = max(target.width / habitatImg.width, target.height / habitatImg.height);
  let imgW = habitatImg.width * imgScale;
  let imgH = habitatImg.height * imgScale;
  // Center the scaled image (some may be cropped off edges)
  let imgX = (target.width - imgW) / 2;
  let imgY = (target.height - imgH) / 2;

  // Grid starts at 80% down the screen
  let gridStartY = target.height * 0.8;

  target.push();
  target.translate(imgX, imgY);
  target.scale(imgScale);

  // Get audio energy levels
  let bassNorm = bass / 255;
  let midNorm = mid / 255;
  let trebleNorm = treble / 255;
  let overallAmp = (bassNorm * 0.5 + midNorm * 0.3 + trebleNorm * 0.2);

  // Time for animation
  let time = frameCount * 0.05;

  // Number of discrete steps for EQ look (like LED segments)
  let numSteps = 12;

  // Draw each column as an EQ bar
  for (let i = 0; i < columns.length; i++) {
    let col = columns[i];

    // Normalize column position to 0-1 across full width
    let t = i / (columns.length - 1);

    // Divide the spectrum into regions that respond to different frequencies
    // But spread across ALL columns using modular/repeating patterns
    let region = floor(t * 8) % 3; // 0=bass, 1=mid, 2=treble, repeating

    // Base energy from the frequency region
    let baseEnergy;
    if (region === 0) {
      baseEnergy = bassNorm;
    } else if (region === 1) {
      baseEnergy = midNorm;
    } else {
      baseEnergy = trebleNorm;
    }

    // Add variation within each column using noise (seeded by column index)
    let columnVariation = noise(i * 0.5, time) * 0.4;

    // Add a traveling wave that moves across columns
    let travelWave = sin(t * PI * 6 - time * 2) * 0.3 * overallAmp;

    // Combine: base frequency response + variation + traveling wave
    let energy = baseEnergy * 0.6 + columnVariation * overallAmp + travelWave + overallAmp * 0.2;
    energy = constrain(energy, 0, 1);

    // QUANTIZE to discrete steps (the key to the EQ look!)
    energy = floor(energy * numSteps) / numSteps;

    // Map to vertical displacement
    let maxDisplacement = habitatImg.height * 0.45;
    let targetDisplacement = -energy * maxDisplacement;

    // Smooth the movement
    col.targetY = targetDisplacement;
    col.velocity += (col.targetY - col.currentY) * 0.15;
    col.velocity *= 0.75; // Damping
    col.currentY += col.velocity;

    // Draw the column slice with displacement
    target.push();
    target.translate(col.x, col.currentY);

    // Add glow effect based on energy (now 0-1 scale)
    if (energy > 0.4) {
      target.drawingContext.shadowBlur = map(energy, 0.4, 1, 0, 30);
      target.drawingContext.shadowColor = energy > 0.7 ?
        `rgba(255, 0, 110, 0.8)` : `rgba(0, 255, 255, 0.5)`;
    }

    target.image(col.slice, 0, 0);

    // Draw colored overlay on high energy
    if (energy > 0.5) {
      target.blendMode(ADD);
      target.noStroke();
      target.fill(colors.cyan[0], colors.cyan[1], colors.cyan[2], map(energy, 0.5, 1, 0, 60));
      target.rect(0, 0, col.width, col.height);
      target.blendMode(BLEND);
    }

    target.pop();

    // Spawn particles on peaks (only in normal mode)
    if (!kaleidoscopeMode && energy > 0.75 && random() > 0.7) {
      spawnParticle(
        imgX + (col.x + col.width/2) * imgScale,
        imgY + col.currentY * imgScale + 100,
        energy * 255
      );
    }
  }

  target.pop();

  // Draw gradient fade at bottom of image (fades DOWN from horizon)
  drawBottomFadeTarget(target, gridStartY);

  // Draw the neon grid floor ON TOP of the faded image
  drawGridTarget(target, bass, gridStartY);

  // Apply glitch effect on heavy bass
  if (bass > 200 && isPlaying) {
    applyGlitchEffectTarget(target, bass);
  }

  // Update and draw particles (only in normal mode)
  if (!kaleidoscopeMode) {
    updateParticles();
  }
}

// Kaleidoscope effect
function drawKaleidoscope(bass) {
  let cx = width / 2;
  let cy = height / 2;
  let radius = max(width, height);

  // Rotate slowly, speed up with bass
  let bassNorm = bass / 255;
  kaleidoscopeRotation += 0.002 + bassNorm * 0.01;

  push();
  translate(cx, cy);
  rotate(kaleidoscopeRotation);

  // Draw each segment
  let angleStep = TWO_PI / kaleidoscopeSegments;

  for (let i = 0; i < kaleidoscopeSegments; i++) {
    push();
    rotate(i * angleStep);

    // Flip every other segment for mirror effect
    if (i % 2 === 1) {
      scale(-1, 1);
    }

    // Clip to a triangular wedge
    drawingContext.save();
    drawingContext.beginPath();
    drawingContext.moveTo(0, 0);
    drawingContext.lineTo(radius * cos(-angleStep/2), radius * sin(-angleStep/2));
    drawingContext.lineTo(radius * cos(angleStep/2), radius * sin(angleStep/2));
    drawingContext.closePath();
    drawingContext.clip();

    // Draw the buffer image offset to show interesting content
    // Offset from center to capture more of the visualization
    let offsetX = -cx + width * 0.3;
    let offsetY = -cy + height * 0.2;
    image(pg, offsetX, offsetY);

    drawingContext.restore();
    pop();
  }

  pop();
}

// Tunnel kaleidoscope - continuous zoom effect
function drawTunnelKaleidoscope(bass, mid, treble) {
  // First, render the visualization to buffer
  pg.background(colors.darkPurple);
  pg.push();
  if (mode3D) {
    drawVisualization3D(pg, bass, mid, treble);
  } else {
    drawVisualization(pg, bass, mid, treble);
  }
  pg.pop();

  let bassNorm = bass / 255;
  let midNorm = mid / 255;
  let trebleNorm = treble / 255;

  // Update zoom speed - bass accelerates
  tunnelSpeed += ((0.004 + bassNorm * 0.015) - tunnelSpeed) * 0.1;

  // Rotation speed varies with audio
  // Bass = slow heavy rotation, mid = medium, treble = fast twitchy rotation
  let baseRotationSpeed = 0.001;
  let audioRotationSpeed = bassNorm * 0.008 + midNorm * 0.004 + trebleNorm * 0.002;

  // Add some direction variation - treble can cause direction wobble
  let rotationDirection = 1 + sin(frameCount * 0.05) * trebleNorm * 0.3;

  kaleidoscopeRotation += (baseRotationSpeed + audioRotationSpeed) * rotationDirection;
  tunnelPhase = (tunnelPhase + tunnelSpeed) % 1;

  let cx = width / 2;
  let cy = height / 2;

  // Many more rings with heavy overlap for seamless continuous effect
  let numRings = 24;

  // Scale range - exponential for natural depth perception
  let minScale = 0.3;
  let maxScale = 2.5;

  for (let ring = numRings - 1; ring >= 0; ring--) {
    // Each ring is offset in phase - closer spacing means more overlap
    let ringPhase = (tunnelPhase + ring / numRings) % 1;

    // Exponential scale for more natural zoom feel (faster growth at distance)
    let ringScale = minScale * pow(maxScale / minScale, ringPhase);

    // Wider alpha curve - use smoothstep for gradual fade that keeps
    // multiple rings visible simultaneously
    // This creates a plateau in the middle where rings are fully visible
    let fadeIn = smoothstep(0, 0.3, ringPhase);
    let fadeOut = smoothstep(1, 0.7, ringPhase);
    let alpha = fadeIn * fadeOut * 255;

    // Per-ring rotation offset - varies with audio for spiral effect
    // Deeper rings (higher ringPhase) rotate more, creating spiral depth
    let spiralIntensity = 0.15 + midNorm * 0.2;
    let ringRotation = kaleidoscopeRotation + ringPhase * spiralIntensity;

    push();
    translate(cx, cy);
    rotate(ringRotation);
    scale(ringScale);
    translate(-cx, -cy);

    tint(255, alpha);
    drawKaleidoscopeSegments(cx, cy, pg);
    noTint();

    pop();
  }
}

// Attempt to use a smoothstep function for smoother transitions
function smoothstep(edge0, edge1, x) {
  let t = constrain((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

// Helper to draw kaleidoscope segments without the buffer rendering
function drawKaleidoscopeSegments(cx, cy, sourceBuffer) {
  let radius = max(width, height);
  let angleStep = TWO_PI / kaleidoscopeSegments;

  push();
  translate(cx, cy);

  for (let i = 0; i < kaleidoscopeSegments; i++) {
    push();
    rotate(i * angleStep);

    if (i % 2 === 1) {
      scale(-1, 1);
    }

    // Clip to wedge using canvas API
    drawingContext.save();
    drawingContext.beginPath();
    drawingContext.moveTo(0, 0);
    drawingContext.lineTo(radius * cos(-angleStep/2), radius * sin(-angleStep/2));
    drawingContext.lineTo(radius * cos(angleStep/2), radius * sin(angleStep/2));
    drawingContext.closePath();
    drawingContext.clip();

    // Draw source buffer
    let offsetX = -cx + width * 0.3;
    let offsetY = -cy + height * 0.2;
    image(sourceBuffer, offsetX, offsetY);

    drawingContext.restore();
    pop();
  }

  pop();
}

// Draw central vortex glow for tunnel effect
function drawTunnelVortex(cx, cy, bassNorm, overallAmp) {
  push();
  translate(cx, cy);

  // Pulsing central glow
  let glowSize = 50 + bassNorm * 100;
  let pulsePhase = frameCount * 0.1;

  // Multiple layered glows
  for (let i = 5; i >= 0; i--) {
    let size = glowSize * (1 + i * 0.5);
    let alpha = map(i, 0, 5, 100, 10) * overallAmp;

    // Color cycles through synthwave palette
    let colorPhase = (pulsePhase + i * 0.3) % 3;
    let r, g, b;
    if (colorPhase < 1) {
      r = lerp(colors.cyan[0], colors.magenta[0], colorPhase);
      g = lerp(colors.cyan[1], colors.magenta[1], colorPhase);
      b = lerp(colors.cyan[2], colors.magenta[2], colorPhase);
    } else if (colorPhase < 2) {
      r = lerp(colors.magenta[0], colors.orange[0], colorPhase - 1);
      g = lerp(colors.magenta[1], colors.orange[1], colorPhase - 1);
      b = lerp(colors.magenta[2], colors.orange[2], colorPhase - 1);
    } else {
      r = lerp(colors.orange[0], colors.cyan[0], colorPhase - 2);
      g = lerp(colors.orange[1], colors.cyan[1], colorPhase - 2);
      b = lerp(colors.orange[2], colors.cyan[2], colorPhase - 2);
    }

    noStroke();
    fill(r, g, b, alpha);

    // Glow effect
    drawingContext.shadowBlur = 30 + bassNorm * 20;
    drawingContext.shadowColor = `rgba(${r}, ${g}, ${b}, 0.8)`;

    ellipse(0, 0, size, size);
  }

  drawingContext.shadowBlur = 0;
  pop();
}

// Draw streaking light rays for speed effect
function drawLightRays(cx, cy, overallAmp, bassNorm) {
  push();
  translate(cx, cy);

  let numRays = 12 + floor(bassNorm * 8);
  let rayLength = 100 + overallAmp * 300;

  for (let i = 0; i < numRays; i++) {
    let angle = (TWO_PI / numRays) * i + frameCount * 0.02;
    let rayAlpha = random(50, 150) * overallAmp;

    // Alternate colors
    let rayColor = i % 3 === 0 ? colors.cyan :
                   (i % 3 === 1 ? colors.magenta : colors.orange);

    stroke(rayColor[0], rayColor[1], rayColor[2], rayAlpha);
    strokeWeight(1 + random(2));

    // Glow
    drawingContext.shadowBlur = 10;
    drawingContext.shadowColor = `rgba(${rayColor[0]}, ${rayColor[1]}, ${rayColor[2]}, 0.5)`;

    // Ray starts from center area and extends outward
    let startDist = 30 + random(50);
    let endDist = startDist + rayLength * (0.5 + random(0.5));

    let x1 = cos(angle) * startDist;
    let y1 = sin(angle) * startDist;
    let x2 = cos(angle) * endDist;
    let y2 = sin(angle) * endDist;

    line(x1, y1, x2, y2);
  }

  drawingContext.shadowBlur = 0;
  pop();
}

// Draw neon wireframe overlay from SVG paths
function drawNeonWireframe(bass, mid, treble) {
  if (!svgLoaded || activePaths.length === 0) return;

  let bassNorm = bass / 255;
  let midNorm = mid / 255;
  let trebleNorm = treble / 255;
  let overallAmp = (bassNorm * 0.5 + midNorm * 0.3 + trebleNorm * 0.2);

  // Calculate scaling to match image position
  let imgScale = max(width / habitatImg.width, height / habitatImg.height);
  // SVG viewbox to image scaling
  let svgToImgScale = habitatImg.width / svgViewBox.width;
  let totalScale = imgScale * svgToImgScale;

  let imgW = habitatImg.width * imgScale;
  let imgH = habitatImg.height * imgScale;
  let imgX = (width - imgW) / 2;
  let imgY = (height - imgH) / 2;

  push();
  translate(imgX, imgY);
  scale(totalScale);

  // Rotate active paths on beat
  if (bassNorm > 0.7 && frameCount % 10 === 0) {
    pathRotationIndex = (pathRotationIndex + 5) % svgPaths.length;
    updateActivePaths();
  }

  // Draw active paths as glowing strokes
  noFill();

  for (let i = 0; i < activePaths.length; i++) {
    let pathData = activePaths[i];

    // Vary color based on path index and audio
    let t = i / activePaths.length;
    let colorPhase = (t + frameCount * 0.01) % 1;

    // Choose color based on frequency bands
    let r, g, b;
    if (colorPhase < 0.33) {
      // Cyan to magenta
      let blend = colorPhase / 0.33;
      r = lerp(colors.cyan[0], colors.magenta[0], blend);
      g = lerp(colors.cyan[1], colors.magenta[1], blend);
      b = lerp(colors.cyan[2], colors.magenta[2], blend);
    } else if (colorPhase < 0.66) {
      // Magenta to orange
      let blend = (colorPhase - 0.33) / 0.33;
      r = lerp(colors.magenta[0], colors.orange[0], blend);
      g = lerp(colors.magenta[1], colors.orange[1], blend);
      b = lerp(colors.magenta[2], colors.orange[2], blend);
    } else {
      // Orange back to cyan
      let blend = (colorPhase - 0.66) / 0.34;
      r = lerp(colors.orange[0], colors.cyan[0], blend);
      g = lerp(colors.orange[1], colors.cyan[1], blend);
      b = lerp(colors.orange[2], colors.cyan[2], blend);
    }

    // Intensity varies per path
    let intensity = 0.5 + 0.5 * sin(i * 0.5 + frameCount * 0.1);
    intensity *= (0.5 + overallAmp * 0.5);

    // Set glow
    let glowAmount = 8 + bassNorm * 15;
    drawingContext.shadowBlur = glowAmount * intensity;
    drawingContext.shadowColor = `rgba(${r}, ${g}, ${b}, ${intensity})`;

    // Stroke style
    stroke(r, g, b, 200 * intensity);
    strokeWeight(0.8 + bassNorm * 0.5);

    // Draw the path using canvas Path2D
    let path2D = new Path2D(pathData.d);
    drawingContext.stroke(path2D);
  }

  // Reset shadow
  drawingContext.shadowBlur = 0;

  pop();
}

// 3D visualization for strips - creates depth and perspective
function drawVisualization3D(target, bass, mid, treble) {
  // Calculate scale to FILL the screen
  let imgScale = max(target.width / habitatImg.width, target.height / habitatImg.height);
  let imgW = habitatImg.width * imgScale;
  let imgH = habitatImg.height * imgScale;
  let imgX = (target.width - imgW) / 2;
  let imgY = (target.height - imgH) / 2;

  let gridStartY = target.height * 0.8;

  // Get audio energy levels
  let bassNorm = bass / 255;
  let midNorm = mid / 255;
  let trebleNorm = treble / 255;
  let overallAmp = (bassNorm * 0.5 + midNorm * 0.3 + trebleNorm * 0.2);

  // Time for animation
  let time = frameCount * 0.05;

  // Tunnel depth increases continuously, reset for looping
  tunnelDepth += 2 + bassNorm * 5;
  if (tunnelDepth > 500) tunnelDepth = 0;

  // Number of discrete steps for EQ look
  let numSteps = 12;

  // Vanishing point (center of screen, at horizon)
  let vanishX = target.width / 2;
  let vanishY = gridStartY;

  // Sort columns by Z depth (back to front) for proper rendering
  let sortedIndices = [];
  for (let i = 0; i < columns.length; i++) {
    sortedIndices.push(i);
  }

  // Calculate Z positions based on energy and wave pattern
  for (let i = 0; i < columns.length; i++) {
    let t = i / (columns.length - 1);

    // Wave pattern creates depth variation across columns
    let waveZ = sin(t * PI * 4 - time * 1.5) * 150 * overallAmp;

    // Columns in center are closer (lower Z = closer)
    let centerDist = abs(t - 0.5) * 2;
    let baseZ = centerDist * 200;

    // Add energy-based depth push
    let region = floor(t * 8) % 3;
    let regionEnergy = region === 0 ? bassNorm : (region === 1 ? midNorm : trebleNorm);
    let energyZ = -regionEnergy * 100;

    let targetZ = baseZ + waveZ + energyZ;
    stripZPositions[i] += (targetZ - stripZPositions[i]) * 0.1;
  }

  // Sort by Z (back to front for proper occlusion)
  sortedIndices.sort((a, b) => stripZPositions[b] - stripZPositions[a]);

  // Draw each column with 3D perspective
  for (let idx of sortedIndices) {
    let i = idx;
    let col = columns[i];

    // Normalize column position
    let t = i / (columns.length - 1);

    // Calculate energy for this column
    let region = floor(t * 8) % 3;
    let baseEnergy;
    if (region === 0) baseEnergy = bassNorm;
    else if (region === 1) baseEnergy = midNorm;
    else baseEnergy = trebleNorm;

    let columnVariation = noise(i * 0.5, time) * 0.4;
    let travelWave = sin(t * PI * 6 - time * 2) * 0.3 * overallAmp;
    let energy = baseEnergy * 0.6 + columnVariation * overallAmp + travelWave + overallAmp * 0.2;
    energy = constrain(energy, 0, 1);
    energy = floor(energy * numSteps) / numSteps;

    // Vertical displacement
    let maxDisplacement = habitatImg.height * 0.45;
    let targetDisplacement = -energy * maxDisplacement;
    col.targetY = targetDisplacement;
    col.velocity += (col.targetY - col.currentY) * 0.15;
    col.velocity *= 0.75;
    col.currentY += col.velocity;

    // 3D perspective calculation
    let z = stripZPositions[i];
    let perspectiveFactor = 800 / (800 + z); // Perspective divide

    // Calculate screen position with perspective
    let stripCenterX = imgX + (col.x + col.width / 2) * imgScale;
    let stripCenterY = imgY + (habitatImg.height / 2 + col.currentY) * imgScale;

    // Move toward/away from vanishing point based on Z
    let screenX = vanishX + (stripCenterX - vanishX) * perspectiveFactor;
    let screenY = vanishY + (stripCenterY - vanishY) * perspectiveFactor;

    // Scale based on distance
    let scaleW = col.width * imgScale * perspectiveFactor;
    let scaleH = col.height * imgScale * perspectiveFactor;

    // Alpha based on distance (further = more transparent)
    let depthAlpha = map(perspectiveFactor, 0.4, 1.2, 100, 255);
    depthAlpha = constrain(depthAlpha, 50, 255);

    target.push();
    target.translate(screenX, screenY);

    // Slight rotation based on position and energy
    let rotAngle = (t - 0.5) * 0.3 * (1 - perspectiveFactor) + sin(time + i * 0.2) * 0.05 * energy;
    target.rotate(rotAngle);

    // Apply tint for depth fading
    target.tint(255, depthAlpha);

    // Glow effect based on energy and proximity
    if (energy > 0.4) {
      target.drawingContext.shadowBlur = map(energy, 0.4, 1, 0, 40) * perspectiveFactor;
      target.drawingContext.shadowColor = energy > 0.7 ?
        `rgba(255, 0, 110, ${0.8 * perspectiveFactor})` :
        `rgba(0, 255, 255, ${0.5 * perspectiveFactor})`;
    }

    // Draw the strip centered
    target.image(col.slice, -scaleW / 2, -scaleH / 2, scaleW, scaleH);

    // Colored overlay on high energy
    if (energy > 0.5) {
      target.blendMode(ADD);
      target.noStroke();
      target.fill(colors.cyan[0], colors.cyan[1], colors.cyan[2],
                  map(energy, 0.5, 1, 0, 60) * perspectiveFactor);
      target.rect(-scaleW / 2, -scaleH / 2, scaleW, scaleH);
      target.blendMode(BLEND);
    }

    target.noTint();
    target.pop();

    // Spawn particles on peaks
    if (!kaleidoscopeMode && energy > 0.75 && random() > 0.7) {
      spawnParticle(screenX, screenY - scaleH / 4, energy * 255);
    }
  }

  // Reset shadow
  target.drawingContext.shadowBlur = 0;

  // Draw gradient fade at bottom
  drawBottomFadeTarget(target, gridStartY);

  // Draw the neon grid floor
  drawGridTarget(target, bass, gridStartY);

  // Apply glitch effect on heavy bass
  if (bass > 200 && isPlaying) {
    applyGlitchEffectTarget(target, bass);
  }

  // Update and draw particles
  if (!kaleidoscopeMode) {
    updateParticles();
  }
}

// 3D neon wireframe with depth layers
function drawNeonWireframe3D(bass, mid, treble) {
  if (!svgLoaded || activePaths.length === 0) return;

  let bassNorm = bass / 255;
  let midNorm = mid / 255;
  let trebleNorm = treble / 255;
  let overallAmp = (bassNorm * 0.5 + midNorm * 0.3 + trebleNorm * 0.2);

  // Calculate scaling
  let imgScale = max(width / habitatImg.width, height / habitatImg.height);
  let svgToImgScale = habitatImg.width / svgViewBox.width;
  let totalScale = imgScale * svgToImgScale;

  let imgW = habitatImg.width * imgScale;
  let imgX = (width - imgW) / 2;
  let imgY = (height - imgW * (habitatImg.height / habitatImg.width)) / 2;

  // Number of depth layers
  let numLayers = 5;

  // Draw paths at multiple depth levels
  for (let layer = numLayers - 1; layer >= 0; layer--) {
    let layerT = layer / (numLayers - 1);

    // Z depth for this layer (0 = front, 1 = back)
    let zDepth = layerT * 300;
    let perspectiveFactor = 800 / (800 + zDepth);

    // Scale and offset for perspective
    let layerScale = totalScale * perspectiveFactor;
    let offsetX = imgX + (1 - perspectiveFactor) * width / 2;
    let offsetY = imgY + (1 - perspectiveFactor) * height * 0.4;

    // Tunnel scroll effect
    let scrollOffset = (tunnelDepth * (1 - layerT * 0.5)) % 100;
    offsetY -= scrollOffset * perspectiveFactor;

    push();
    translate(offsetX, offsetY);
    scale(layerScale);

    // Rotate active paths on beat
    if (bassNorm > 0.7 && frameCount % 10 === 0 && layer === 0) {
      pathRotationIndex = (pathRotationIndex + 5) % svgPaths.length;
      updateActivePaths();
    }

    noFill();

    // Only draw a subset of paths per layer
    let pathsPerLayer = floor(activePaths.length / numLayers);
    let startIdx = layer * pathsPerLayer;
    let endIdx = min(startIdx + pathsPerLayer, activePaths.length);

    for (let i = startIdx; i < endIdx; i++) {
      let pathData = activePaths[i];

      let t = (i - startIdx) / pathsPerLayer;
      let colorPhase = (t + frameCount * 0.01 + layer * 0.2) % 1;

      // Color based on phase
      let r, g, b;
      if (colorPhase < 0.33) {
        let blend = colorPhase / 0.33;
        r = lerp(colors.cyan[0], colors.magenta[0], blend);
        g = lerp(colors.cyan[1], colors.magenta[1], blend);
        b = lerp(colors.cyan[2], colors.magenta[2], blend);
      } else if (colorPhase < 0.66) {
        let blend = (colorPhase - 0.33) / 0.33;
        r = lerp(colors.magenta[0], colors.orange[0], blend);
        g = lerp(colors.magenta[1], colors.orange[1], blend);
        b = lerp(colors.magenta[2], colors.orange[2], blend);
      } else {
        let blend = (colorPhase - 0.66) / 0.34;
        r = lerp(colors.orange[0], colors.cyan[0], blend);
        g = lerp(colors.orange[1], colors.cyan[1], blend);
        b = lerp(colors.orange[2], colors.cyan[2], blend);
      }

      // Intensity varies by layer and audio
      let intensity = perspectiveFactor * (0.5 + 0.5 * sin(i * 0.5 + frameCount * 0.1));
      intensity *= (0.5 + overallAmp * 0.5);

      // Stronger glow for front layers
      let glowAmount = (8 + bassNorm * 15) * perspectiveFactor;
      drawingContext.shadowBlur = glowAmount * intensity;
      drawingContext.shadowColor = `rgba(${r}, ${g}, ${b}, ${intensity})`;

      // Stroke with depth-based alpha
      let strokeAlpha = 200 * intensity * perspectiveFactor;
      stroke(r, g, b, strokeAlpha);
      strokeWeight((0.8 + bassNorm * 0.5) * perspectiveFactor);

      let path2D = new Path2D(pathData.d);
      drawingContext.stroke(path2D);
    }

    drawingContext.shadowBlur = 0;
    pop();
  }
}

function drawBottomFade(horizonY) {
  drawBottomFadeTarget(this, horizonY);
}

function drawBottomFadeTarget(target, horizonY) {
  target.push();
  target.noStroke();

  // Fade from horizon line down to bottom of screen
  let fadeStartY = horizonY;
  let fadeHeight = target.height - horizonY;

  // Draw gradient using multiple rectangles
  let numSteps = 60;
  for (let i = 0; i < numSteps; i++) {
    let t = i / numSteps;
    let y = fadeStartY + t * fadeHeight;
    let stepHeight = fadeHeight / numSteps + 1; // +1 to avoid gaps

    // Alpha starts high (opaque) at horizon, fades to full opaque at bottom
    // This covers the image so the grid can be drawn on top
    let alpha = map(t, 0, 1, 180, 255);

    // Use the dark purple background color
    target.fill(colors.darkPurple[0], colors.darkPurple[1], colors.darkPurple[2], alpha);
    target.rect(0, y, target.width, stepHeight);
  }

  target.pop();
}

function drawGrid(bass, groundY) {
  drawGridTarget(this, bass, groundY);
}

function drawGridTarget(target, bass, groundY) {
  target.push();

  // Grid parameters
  let numHorizLines = 20;
  let numVertLines = 40;
  let gridDepth = target.height - groundY;
  let horizonY = groundY;

  // Pulse effect based on bass
  let pulse = map(bass, 0, 255, 0.7, 1.3);

  // Glow intensity based on bass
  let glowIntensity = map(bass, 0, 255, 8, 25);

  // Animate grid scrolling toward viewer
  let scrollSpeed = 3;
  let scrollOffset = (frameCount * scrollSpeed) % (gridDepth / numHorizLines);

  // Draw HORIZONTAL lines (parallel, getting closer together near horizon)
  for (let i = 0; i <= numHorizLines + 1; i++) {
    // Use exponential spacing for perspective effect
    let t = i / numHorizLines;
    let perspectiveT = pow(t, 1.8); // Exponential for perspective
    let y = horizonY + perspectiveT * gridDepth + scrollOffset * pow(t, 1.5);

    if (y > target.height || y < horizonY) continue;

    // Line width extends beyond screen
    let lineWidth = target.width * 2;
    let x1 = -lineWidth / 2 + target.width / 2;
    let x2 = lineWidth / 2 + target.width / 2;

    // Fade and thin lines near horizon
    let alpha = map(y, horizonY, target.height, 30, 255);
    let weight = map(y, horizonY, target.height, 0.5, 2.5);

    // Glow increases for lines closer to viewer
    let lineGlow = map(y, horizonY, target.height, glowIntensity * 0.3, glowIntensity);

    // Every 4th line is pink/magenta
    let isMagenta = (i % 4 === 0);
    if (isMagenta) {
      target.stroke(colors.magenta[0], colors.magenta[1], colors.magenta[2], alpha * pulse);
      target.drawingContext.shadowColor = `rgba(${colors.magenta[0]}, ${colors.magenta[1]}, ${colors.magenta[2]}, 0.8)`;
    } else {
      target.stroke(colors.cyan[0], colors.cyan[1], colors.cyan[2], alpha * pulse);
      target.drawingContext.shadowColor = `rgba(${colors.cyan[0]}, ${colors.cyan[1]}, ${colors.cyan[2]}, 0.8)`;
    }
    target.drawingContext.shadowBlur = lineGlow;
    target.strokeWeight(weight);

    target.line(x1, y, x2, y);
  }

  // Draw VERTICAL lines (parallel to each other, converging to horizon LINE)
  let gridTotalWidth = target.width * 1.8;
  let spacingAtBottom = gridTotalWidth / numVertLines;

  for (let i = 0; i <= numVertLines; i++) {
    // X position at bottom of screen
    let xBottom = (target.width - gridTotalWidth) / 2 + i * spacingAtBottom;

    // X position at horizon (same as bottom - lines are parallel/vertical)
    // But we compress toward center for perspective
    let centerX = target.width / 2;
    let distFromCenter = xBottom - centerX;
    let xHorizon = centerX + distFromCenter * 0.1; // Compress at horizon

    // Alpha based on distance from center
    let normalizedDist = abs(distFromCenter) / (gridTotalWidth / 2);
    let alpha = map(normalizedDist, 0, 1, 255, 80);

    // Glow stronger near center
    let lineGlow = map(normalizedDist, 0, 1, glowIntensity, glowIntensity * 0.4);

    // Every 5th line is pink/magenta
    let isMagenta = (i % 5 === 0);
    if (isMagenta) {
      target.stroke(colors.magenta[0], colors.magenta[1], colors.magenta[2], alpha * pulse * 0.8);
      target.drawingContext.shadowColor = `rgba(${colors.magenta[0]}, ${colors.magenta[1]}, ${colors.magenta[2]}, 0.7)`;
    } else {
      target.stroke(colors.cyan[0], colors.cyan[1], colors.cyan[2], alpha * pulse * 0.7);
      target.drawingContext.shadowColor = `rgba(${colors.cyan[0]}, ${colors.cyan[1]}, ${colors.cyan[2]}, 0.7)`;
    }
    target.drawingContext.shadowBlur = lineGlow;
    target.strokeWeight(map(normalizedDist, 0, 1, 1.5, 0.8));

    target.line(xHorizon, horizonY, xBottom, target.height);
  }

  // Reset shadow
  target.drawingContext.shadowBlur = 0;

  target.pop();
}

function spawnParticle(x, y, energy) {
  particles.push({
    x: x,
    y: y,
    vx: random(-2, 2),
    vy: random(-5, -2),
    size: random(3, 8),
    life: 1,
    color: energy > 220 ? colors.magenta : colors.cyan
  });
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];

    // Update position
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.1; // Gravity
    p.life -= 0.02;

    // Draw particle with glow
    if (p.life > 0) {
      push();
      drawingContext.shadowBlur = 15;
      drawingContext.shadowColor = `rgba(${p.color[0]}, ${p.color[1]}, ${p.color[2]}, ${p.life})`;
      noStroke();
      fill(p.color[0], p.color[1], p.color[2], p.life * 255);
      ellipse(p.x, p.y, p.size * p.life);
      pop();
    } else {
      particles.splice(i, 1);
    }
  }
}

// ============================================
// PARTICLE FOUNTAIN MODES
// ============================================

// Update and draw all particle fountain modes
function updateParticleFountains(bass, mid, treble) {
  if (particleMode === 0) return;

  let bassNorm = bass / 255;
  let midNorm = mid / 255;
  let trebleNorm = treble / 255;
  let overallAmp = (bassNorm * 0.5 + midNorm * 0.3 + trebleNorm * 0.2);

  // Add glow effect for particles
  push();
  drawingContext.shadowBlur = 15;

  switch (particleMode) {
    case 1: // AURA MODE
      updateAuraMode(bassNorm, midNorm, trebleNorm, overallAmp);
      break;
    case 2: // EXPLOSION MODE
      updateExplosionMode(bassNorm, midNorm, trebleNorm, overallAmp);
      break;
    case 3: // DISINTEGRATION MODE
      updateDisintegrationMode(bassNorm, midNorm, trebleNorm, overallAmp);
      break;
    case 4: // VORTEX MODE
      updateVortexMode(bassNorm, midNorm, trebleNorm, overallAmp);
      break;
    case 5: // FIREWORKS MODE
      updateFireworksMode(bassNorm, midNorm, trebleNorm, overallAmp);
      break;
  }

  drawingContext.shadowBlur = 0;
  pop();
}

// MODE 1: EQ RISE - Square LED-style particles rise in columns like vintage EQ meters
// In kaleidoscope mode, particles spawn radially matching the kaleidoscope pattern
function updateAuraMode(bassNorm, midNorm, trebleNorm, overallAmp) {
  let time = frameCount * 0.05;
  let cx = width / 2;
  let cy = height / 2;

  if (kaleidoscopeMode) {
    // RADIAL MODE - particles spawn in kaleidoscope-matching radial pattern
    updateAuraModeRadial(bassNorm, midNorm, trebleNorm, overallAmp, time, cx, cy);
  } else {
    // COLUMN MODE - original column-based spawning
    updateAuraModeColumns(bassNorm, midNorm, trebleNorm, overallAmp, time);
  }
}

// Radial particle spawning for kaleidoscope mode
function updateAuraModeRadial(bassNorm, midNorm, trebleNorm, overallAmp, time, cx, cy) {
  let numRings = 8; // Radial rings of particles
  let particleSize = 12 + overallAmp * 8;
  let maxRadius = max(width, height) * 0.4;

  // Spawn particles in radial pattern matching kaleidoscope segments
  for (let seg = 0; seg < kaleidoscopeSegments; seg++) {
    // Angle for this segment (matches kaleidoscope rotation)
    let segAngle = (TWO_PI / kaleidoscopeSegments) * seg + kaleidoscopeRotation;

    // Spawn across multiple radial distances
    for (let ring = 0; ring < numRings; ring++) {
      let t = ring / (numRings - 1);

      // Energy based on ring position - inner = bass, outer = treble
      let baseEnergy;
      if (t < 0.33) baseEnergy = bassNorm;
      else if (t < 0.66) baseEnergy = midNorm;
      else baseEnergy = trebleNorm;

      // Wave variation
      let waveEnergy = sin(t * PI * 3 - time + seg * 0.5) * 0.3;
      let energy = baseEnergy * 0.7 + waveEnergy * overallAmp + overallAmp * 0.2;
      energy = constrain(energy, 0, 1);

      // Spawn chance
      let spawnChance = energy * 0.15; // Lower chance since more spawn points

      if (energy > 0.3 && random() < spawnChance && eqParticles.length < 1200) {
        // Radial distance from center
        let radius = 50 + t * maxRadius;

        // Slight angle variation within segment
        let angleSpread = (TWO_PI / kaleidoscopeSegments) * 0.3;
        let angle = segAngle + random(-angleSpread, angleSpread);

        // Spawn position
        let x = cx + cos(angle) * radius;
        let y = cy + sin(angle) * radius;

        // Sample color from image at approximate position
        let imgScale = max(width / habitatImg.width, height / habitatImg.height);
        let imgX = (width - habitatImg.width * imgScale) / 2;
        let imgY = (height - habitatImg.height * imgScale) / 2;
        let imgPx = floor((x - imgX) / imgScale);
        let imgPy = floor((y - imgY) / imgScale);
        imgPx = constrain(imgPx, 0, habitatImg.width - 1);
        imgPy = constrain(imgPy, 0, habitatImg.height - 1);
        let c = habitatImg.get(imgPx, imgPy);

        // Brighten the color
        let r = min(255, c[0] * 1.5 + 50);
        let g = min(255, c[1] * 1.5 + 50);
        let b = min(255, c[2] * 1.5 + 50);

        // Fallback to synthwave colors if too dark
        if (r + g + b < 150) {
          let colorChoice = (seg + ring) % 3;
          if (colorChoice === 0) {
            r = colors.magenta[0]; g = colors.magenta[1]; b = colors.magenta[2];
          } else if (colorChoice === 1) {
            r = colors.cyan[0]; g = colors.cyan[1]; b = colors.cyan[2];
          } else {
            r = colors.orange[0]; g = colors.orange[1]; b = colors.orange[2];
          }
        }

        eqParticles.push({
          x: x,
          y: y,
          angle: angle, // Store angle for radial movement
          radius: radius, // Current radius from center
          vr: 2 + energy * 4, // Outward radial velocity
          size: particleSize * (0.8 + energy * 0.4),
          width: particleSize * (0.8 + energy * 0.4), // Keep original width
          height: particleSize * (0.8 + energy * 0.4) / 3, // Reduce height to 1/3
          life: 1,
          color: [r, g, b],
          energy: energy,
          isRadial: true // Flag for radial mode
        });
      }
    }
  }

  // Update and draw radial particles
  rectMode(CENTER);
  for (let i = eqParticles.length - 1; i >= 0; i--) {
    let p = eqParticles[i];

    if (p.isRadial) {
      // Radial movement - expand outward from center
      p.radius += p.vr;
      p.vr += 0.05; // Slight acceleration outward

      // Rotate with kaleidoscope
      p.angle += 0.005 + overallAmp * 0.01;

      // Update position based on polar coordinates
      p.x = cx + cos(p.angle) * p.radius;
      p.y = cy + sin(p.angle) * p.radius;

      // Fade out
      p.life -= 0.015;

      // Draw if alive and on screen
      let maxDist = max(width, height) * 0.7;
      if (p.life > 0 && p.radius < maxDist) {
        let alpha = p.life * 255;

        // Glow effect
        drawingContext.shadowBlur = 12 + p.energy * 8;
        drawingContext.shadowColor = `rgba(${p.color[0]}, ${p.color[1]}, ${p.color[2]}, ${p.life * 0.8})`;

        noStroke();
        fill(p.color[0], p.color[1], p.color[2], alpha);

        // Rotate rectangle to align with radial direction
        push();
        translate(p.x, p.y);
        rotate(p.angle + HALF_PI);
        rect(0, 0, p.width, p.height);
        pop();
      } else {
        eqParticles.splice(i, 1);
      }
    } else {
      // Column mode particle (shouldn't happen in kaleidoscope, but handle it)
      p.y += p.vy;
      p.vy -= 0.01;
      p.life -= 0.012;

      if (p.life > 0 && p.y > -p.height) {
        let alpha = p.life * 255;
        drawingContext.shadowBlur = 12 + p.energy * 8;
        drawingContext.shadowColor = `rgba(${p.color[0]}, ${p.color[1]}, ${p.color[2]}, ${p.life * 0.8})`;
        noStroke();
        fill(p.color[0], p.color[1], p.color[2], alpha);
        rect(p.x, p.y, p.width, p.height);
      } else {
        eqParticles.splice(i, 1);
      }
    }
  }
  rectMode(CORNER);
}

// Column-based particle spawning (original mode)
function updateAuraModeColumns(bassNorm, midNorm, trebleNorm, overallAmp, time) {
  // Calculate image positioning (same as visualization)
  let imgScale = max(width / habitatImg.width, height / habitatImg.height);
  let imgW = habitatImg.width * imgScale;
  let imgH = habitatImg.height * imgScale;
  let imgX = (width - imgW) / 2;
  let imgY = (height - imgH) / 2;

  // Particle size matches column width for grid alignment
  let colWidth = imgW / numColumns;
  let particleSize = colWidth * 0.8; // Slightly smaller than column for gaps

  // Spawn new EQ particles from active columns (limited to columns 6-54)
  for (let i = 0; i < numColumns; i++) {
    // Skip columns outside the range 6-54
    if (i < 6 || i > 54) continue;

    let col = columns[i];
    let t = i / (numColumns - 1);

    // Get energy for this column (same logic as main visualization)
    let region = floor(t * 8) % 3;
    let baseEnergy;
    if (region === 0) baseEnergy = bassNorm;
    else if (region === 1) baseEnergy = midNorm;
    else baseEnergy = trebleNorm;

    // Add wave variation
    let waveEnergy = sin(t * PI * 4 - time) * 0.3;
    let energy = baseEnergy * 0.7 + waveEnergy * overallAmp + overallAmp * 0.2;
    energy = constrain(energy, 0, 1);

    // Spawn rate based on energy - reduced for more spacing between particles
    let spawnChance = energy * 0.15; // Reduced from 0.3 to 0.15

    if (energy > 0.25 && random() < spawnChance && eqParticles.length < 800) {
      // X position aligned to column center
      let x = imgX + (col.x + col.width / 2) * imgScale;

      // Y position at top of the displaced column - 9% below middle
      let y = imgY + (habitatImg.height / 2 + col.currentY) * imgScale + imgH * 0.09;

      // Sample color from the image at this column position
      let imgPx = floor(col.x + col.width / 2);
      let imgPy = floor(random(habitatImg.height)); // Sample randomly from entire image height
      imgPx = constrain(imgPx, 0, habitatImg.width - 1);
      imgPy = constrain(imgPy, 0, habitatImg.height - 1);
      let c = habitatImg.get(imgPx, imgPy);

      // Brighten the color for the glowing effect
      let r = min(255, c[0] * 1.5 + 50);
      let g = min(255, c[1] * 1.5 + 50);
      let b = min(255, c[2] * 1.5 + 50);

      // If too dark or grey, use synthwave colors based on region
      if (r + g + b < 300) {
        if (region === 0) {
          r = colors.magenta[0]; g = colors.magenta[1]; b = colors.magenta[2];
        } else if (region === 1) {
          r = colors.orange[0]; g = colors.orange[1]; b = colors.orange[2];
        } else {
          r = colors.cyan[0]; g = colors.cyan[1]; b = colors.cyan[2];
        }
      }

      eqParticles.push({
        x: x,
        y: y,
        columnIndex: i, // Lock to this column
        vy: -4 - energy * 5, // Increased upward velocity for more spacing (was -2 - energy * 3)
        size: particleSize,
        width: particleSize, // Keep original width
        height: particleSize / 3, // Reduce height to 1/3
        life: 1,
        color: [r, g, b],
        energy: energy,
        isRadial: false
      });
    }
  }

  // Update and draw EQ particles
  rectMode(CENTER);
  for (let i = eqParticles.length - 1; i >= 0; i--) {
    let p = eqParticles[i];

    // Move straight up (no horizontal drift - locked to column)
    p.y += p.vy;

    // Very slight upward acceleration (negative gravity - they keep rising)
    p.vy -= 0.01;

    // Fade out over time
    p.life -= 0.012;

    // Draw particle as a rectangle (wide and short)
    if (p.life > 0 && p.y > -p.height) {
      let alpha = p.life * 255;

      // Glow effect
      drawingContext.shadowBlur = 12 + p.energy * 8;
      drawingContext.shadowColor = `rgba(${p.color[0]}, ${p.color[1]}, ${p.color[2]}, ${p.life * 0.8})`;

      noStroke();
      fill(p.color[0], p.color[1], p.color[2], alpha);
      // Draw with separate width and height
      rect(p.x, p.y, p.width, p.height);
    } else {
      eqParticles.splice(i, 1);
    }
  }
  rectMode(CORNER);
}

// MODE 2: EXPLOSION - Bass hits cause particle bursts from building
function updateExplosionMode(bassNorm, midNorm, trebleNorm, overallAmp) {
  // Spawn new explosion on strong bass
  if (bassNorm > 0.7 && random() < 0.3) {
    // Random position on the building
    let imgScale = max(width / habitatImg.width, height / habitatImg.height);
    let imgW = habitatImg.width * imgScale;
    let imgH = habitatImg.height * imgScale;
    let imgX = (width - imgW) / 2;
    let imgY = (height - imgH) / 2;

    let x = imgX + random(imgW * 0.2, imgW * 0.8);
    let y = imgY + random(imgH * 0.2, imgH * 0.6);

    // Create explosion fountain
    let explosionConfig = {
      x: 0.5,
      y: 0.5,
      angle: [0, 360],  // All directions
      speed: 5 + bassNorm * 10,
      speedx: 3,
      size: [4, 12],
      gravity: 0.15,
      sizePercent: 0.96,
      lifetime: 60,
      limit: 30 + floor(bassNorm * 40),  // Limited particles per burst
      rate: [0, 30],
      color: ['#00ffff', '#ff006e', '#ff5f1f', '#ffffff']
    };

    let explosion = new Fountain(null, explosionConfig, x, y);
    explosion.CreateN(x, y, 0);
    explosionFountains.push(explosion);
  }

  // Update and draw all explosions
  for (let i = explosionFountains.length - 1; i >= 0; i--) {
    let fountain = explosionFountains[i];
    fountain.Step();

    if (fountain.done) {
      explosionFountains.splice(i, 1);
    } else {
      drawingContext.shadowColor = 'rgba(255, 0, 110, 0.8)';
      fountain.Draw();
    }
  }
}

// MODE 3: DISINTEGRATION - Building slowly dissolves into particles
function updateDisintegrationMode(bassNorm, midNorm, trebleNorm, overallAmp) {
  let imgScale = max(width / habitatImg.width, height / habitatImg.height);
  let imgW = habitatImg.width * imgScale;
  let imgH = habitatImg.height * imgScale;
  let imgX = (width - imgW) / 2;
  let imgY = (height - imgH) / 2;

  // Spawn rate based on overall amplitude
  let spawnRate = floor(overallAmp * 10) + 1;

  // Create new disintegration particles from random building positions
  for (let i = 0; i < spawnRate; i++) {
    if (disintegrationParticles.length < 500) {
      // Sample a random pixel from the building area
      let px = random(imgW * 0.1, imgW * 0.9);
      let py = random(imgH * 0.1, imgH * 0.7);

      // Get color from image at this position
      let imgPx = floor(px / imgScale);
      let imgPy = floor(py / imgScale);
      imgPx = constrain(imgPx, 0, habitatImg.width - 1);
      imgPy = constrain(imgPy, 0, habitatImg.height - 1);
      let c = habitatImg.get(imgPx, imgPy);

      // Only create particle if not too dark
      if (brightness(color(c[0], c[1], c[2])) > 30) {
        disintegrationParticles.push({
          x: imgX + px,
          y: imgY + py,
          origX: imgX + px,
          origY: imgY + py,
          vx: random(-1, 1) + (bassNorm - 0.5) * 4,
          vy: random(-2, 0) - trebleNorm * 3,
          size: random(2, 6),
          life: 1,
          color: c,
          driftAngle: random(TWO_PI)
        });
      }
    }
  }

  // Update and draw disintegration particles
  for (let i = disintegrationParticles.length - 1; i >= 0; i--) {
    let p = disintegrationParticles[i];

    // Drift motion influenced by audio
    p.driftAngle += 0.05 + midNorm * 0.1;
    p.vx += cos(p.driftAngle) * 0.1 * overallAmp;
    p.vy += sin(p.driftAngle) * 0.05 - 0.02; // Slight upward drift

    p.x += p.vx;
    p.y += p.vy;
    p.life -= 0.008;

    // Draw particle
    if (p.life > 0) {
      let alpha = p.life * 255;
      drawingContext.shadowColor = `rgba(${p.color[0]}, ${p.color[1]}, ${p.color[2]}, ${p.life})`;
      noStroke();
      fill(p.color[0], p.color[1], p.color[2], alpha);
      ellipse(p.x, p.y, p.size * p.life);
    } else {
      disintegrationParticles.splice(i, 1);
    }
  }
}

// MODE 4: VORTEX - Particles spiral around center
function updateVortexMode(bassNorm, midNorm, trebleNorm, overallAmp) {
  let cx = width / 2;
  let cy = height / 2;

  // Spawn particles at edges, spiraling inward
  if (overallAmp > 0.2) {
    let spawnCount = floor(overallAmp * 8);
    for (let i = 0; i < spawnCount; i++) {
      let angle = random(TWO_PI);
      let dist = random(200, max(width, height) * 0.6);
      let x = cx + cos(angle) * dist;
      let y = cy + sin(angle) * dist;

      vortexFountain.Create(x, y, degrees(angle) + 90);
    }
  }

  // Custom vortex physics - apply orbital force to each particle
  for (let i = 0; i < vortexFountain.particles.length; i++) {
    let p = vortexFountain.particles[i];

    // Vector from particle to center
    let dx = cx - p.location.x;
    let dy = cy - p.location.y;
    let dist = sqrt(dx * dx + dy * dy);

    if (dist > 10) {
      // Normalize
      dx /= dist;
      dy /= dist;

      // Inward pull (stronger with bass)
      let inwardForce = 0.1 + bassNorm * 0.3;
      p.velocity.x += dx * inwardForce;
      p.velocity.y += dy * inwardForce;

      // Tangential force (orbital motion, stronger with treble)
      let tangentForce = 0.15 + trebleNorm * 0.2;
      p.velocity.x += -dy * tangentForce;
      p.velocity.y += dx * tangentForce;

      // Damping
      p.velocity.mult(0.98);
    }
  }

  vortexFountain.Step();

  // Draw with rotating color glow
  let glowPhase = (frameCount * 0.05) % 1;
  if (glowPhase < 0.33) {
    drawingContext.shadowColor = 'rgba(0, 255, 255, 0.8)';
  } else if (glowPhase < 0.66) {
    drawingContext.shadowColor = 'rgba(255, 0, 110, 0.8)';
  } else {
    drawingContext.shadowColor = 'rgba(255, 95, 31, 0.8)';
  }
  vortexFountain.Draw();
}

// MODE 5: FIREWORKS - Bass triggers firework bursts from bottom
function updateFireworksMode(bassNorm, midNorm, trebleNorm, overallAmp) {
  // Launch new firework on bass hit
  if (bassNorm > 0.6 && random() < 0.2) {
    let launchX = random(width * 0.2, width * 0.8);
    let targetY = random(height * 0.2, height * 0.5);

    // Create rising rocket
    let rocketConfig = {
      x: 0.5,
      y: 1,
      angle: [-95, -85],
      speed: 8 + bassNorm * 5,
      speedx: 1,
      size: [3, 5],
      gravity: 0.1,
      sizePercent: 0.99,
      lifetime: 40,
      limit: 1,
      rate: [0, 1],
      color: ['#ffffff', '#ffff00']
    };

    let rocket = new Fountain(null, rocketConfig, launchX, height);
    rocket.targetY = targetY;
    rocket.Create(launchX, height, -90);
    fireworkFountains.push({ type: 'rocket', fountain: rocket, launchX: launchX });
  }

  // Update fireworks
  for (let i = fireworkFountains.length - 1; i >= 0; i--) {
    let fw = fireworkFountains[i];

    if (fw.type === 'rocket') {
      fw.fountain.Step();

      // Check if rocket reached apex (velocity changed direction or reached target)
      if (fw.fountain.particles.length > 0) {
        let p = fw.fountain.particles[0];
        if (p.velocity.y >= 0 || p.location.y < fw.fountain.targetY) {
          // Explode!
          let explodeX = p.location.x;
          let explodeY = p.location.y;

          // Create explosion burst
          let burstColors = [
            ['#00ffff', '#00ccff', '#ffffff'],
            ['#ff006e', '#ff64c8', '#ffffff'],
            ['#ff5f1f', '#ffcc00', '#ffffff']
          ];
          let colorSet = random(burstColors);

          let burstConfig = {
            x: 0.5,
            y: 0.5,
            angle: [0, 360],
            speed: 4 + random(4),
            speedx: 2,
            size: [2, 6],
            gravity: 0.08,
            sizePercent: 0.97,
            lifetime: 50,
            limit: 50 + floor(random(30)),
            rate: [0, 50],
            color: colorSet
          };

          let burst = new Fountain(null, burstConfig, explodeX, explodeY);
          burst.CreateN(explodeX, explodeY, 0);
          fireworkFountains.push({ type: 'burst', fountain: burst });

          // Remove rocket
          fireworkFountains.splice(i, 1);
          continue;
        }
      }

      // Draw rocket trail
      drawingContext.shadowColor = 'rgba(255, 255, 255, 0.9)';
      fw.fountain.Draw();
    } else if (fw.type === 'burst') {
      fw.fountain.Step();

      if (fw.fountain.done) {
        fireworkFountains.splice(i, 1);
      } else {
        // Colorful glow based on burst color
        drawingContext.shadowColor = 'rgba(255, 100, 200, 0.8)';
        fw.fountain.Draw();
      }
    }
  }
}

// Clear all particle fountains when switching modes
function clearParticleFountains() {
  // Clear EQ rise particles
  eqParticles = [];

  // Clear aura fountains
  for (let f of auraFountains) {
    f.Stop();
  }

  // Clear explosions
  explosionFountains = [];

  // Clear disintegration
  disintegrationParticles = [];

  // Clear vortex
  if (vortexFountain) {
    vortexFountain.Stop();
  }

  // Clear fireworks
  fireworkFountains = [];
}

function applyGlitchEffect(intensity) {
  applyGlitchEffectTarget(this, intensity);
}

function applyGlitchEffectTarget(target, intensity) {
  // Apply random byte glitching based on intensity
  let glitchAmount = floor(map(intensity, 200, 255, 1, 5));

  // This would be applied to a graphics buffer in a more complete implementation
  // For now, we'll do visual glitch effects
  target.push();
  target.blendMode(DIFFERENCE);
  target.noStroke();
  target.fill(random(255), 0, random(255), map(intensity, 200, 255, 10, 50));

  // Random horizontal glitch bars
  for (let i = 0; i < glitchAmount; i++) {
    let y = random(target.height);
    let h = random(5, 30);
    target.rect(0, y, target.width, h);
  }
  target.blendMode(BLEND);
  target.pop();
}

function drawScanlines() {
  push();
  stroke(0, 0, 0, 30);
  strokeWeight(1);
  for (let y = 0; y < height; y += 3) {
    line(0, y, width, y);
  }
  pop();
}

function drawVignette() {
  push();
  noFill();
  for (let i = 0; i < 50; i++) {
    let alpha = map(i, 0, 50, 0, 100);
    stroke(0, 0, 0, alpha);
    strokeWeight(20);
    rect(i * -10, i * -10, width + i * 20, height + i * 20, 100);
  }
  pop();
}

function drawStartPrompt() {
  push();
  fill(255, 255, 255, 200);
  noStroke();
  textSize(32);
  textAlign(CENTER, CENTER);

  // Pulsing effect
  let pulse = sin(frameCount * 0.05) * 0.3 + 0.7;
  fill(colors.cyan[0], colors.cyan[1], colors.cyan[2], 255 * pulse);
  text("CLICK TO START", width/2, height - 80);

  textSize(16);
  fill(255, 200);
  text("Drop an audio file or use microphone", width/2, height - 50);
  pop();
}

function drawLevelMeter(bass, mid, treble) {
  push();
  let meterWidth = 150;
  let meterHeight = 10;
  let x = 20;
  let y = height - 80;

  textSize(12);
  textAlign(LEFT, CENTER);

  // Bass meter
  fill(colors.magenta);
  noStroke();
  rect(x + 50, y, map(bass, 0, 255, 0, meterWidth), meterHeight);
  fill(255);
  text("BASS", x, y + 5);

  // Mid meter
  fill(colors.orange);
  rect(x + 50, y + 20, map(mid, 0, 255, 0, meterWidth), meterHeight);
  fill(255);
  text("MID", x, y + 25);

  // Treble meter
  fill(colors.cyan);
  rect(x + 50, y + 40, map(treble, 0, 255, 0, meterWidth), meterHeight);
  fill(255);
  text("HIGH", x, y + 45);

  pop();
}

function mousePressed() {
  if (!isPlaying) {
    // Start audio context
    userStartAudio().then(() => {
      // Try to use microphone as input
      audio = new p5.AudioIn();
      audio.start();
      fft.setInput(audio);
      isPlaying = true;
    });
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  // Resize the kaleidoscope buffer too
  pg = createGraphics(windowWidth, windowHeight);
  // Resize tunnel layer buffers
  for (let i = 0; i < numTunnelLayers; i++) {
    tunnelLayers[i] = createGraphics(windowWidth, windowHeight);
  }
}

function keyPressed() {
  // Toggle kaleidoscope mode with 'K'
  if (key === 'k' || key === 'K') {
    kaleidoscopeMode = !kaleidoscopeMode;
    // Clear the buffer when switching modes
    if (kaleidoscopeMode) {
      pg.background(colors.darkPurple);
    }
  }

  // Toggle neon wireframe mode with 'N'
  if (key === 'n' || key === 'N') {
    neonMode = !neonMode;
    if (neonMode && svgLoaded) {
      updateActivePaths();
    }
  }

  // Toggle 3D mode with '3'
  if (key === '3') {
    mode3D = !mode3D;
    // Reset tunnel depth when toggling
    tunnelDepth = 0;
    // Reset Z positions
    for (let i = 0; i < stripZPositions.length; i++) {
      stripZPositions[i] = 0;
    }
  }

  // Toggle vertical flow mode with 'V'
  if (key === 'v' || key === 'V') {
    verticalFlowMode = !verticalFlowMode;
    // Reset floor energies when toggling
    if (verticalFlowMode) {
      initializeFloorEnergies();
    }
  }

  // Toggle tunnel mode with 'T' (only works in kaleidoscope mode)
  if (key === 't' || key === 'T') {
    tunnelMode = !tunnelMode;
    // Reset tunnel speed
    tunnelSpeed = 0.02;
  }

  // Cycle particle modes with 'P'
  if (key === 'p' || key === 'P') {
    // Clear current particles before switching
    clearParticleFountains();
    // Cycle through modes: 0=off, 1=aura, 2=explosion, 3=disintegration, 4=vortex, 5=fireworks
    particleMode = (particleMode + 1) % 6;
  }

  // Toggle physics mode with 'M'
  if (key === 'm' || key === 'M') {
    physicsMode = !physicsMode;
    if (physicsMode && !physicsInitialized) {
      initializePhysics();
    }
    if (physicsMode) {
      // Disable other modes when entering physics
      kaleidoscopeMode = false;
      neonMode = false;
      mode3D = false;
      tunnelMode = false;
    }
  }

  // Physics mode controls
  if (physicsMode) {
    // Reset physics with 'R'
    if (key === 'r' || key === 'R') {
      resetPhysics();
    }
    // Manual explosion with SPACE
    if (key === ' ') {
      explodePhysics(0.05);
    }
  }

  // Adjust kaleidoscope segments with +/-
  if (kaleidoscopeMode) {
    if (key === '+' || key === '=') {
      kaleidoscopeSegments = min(kaleidoscopeSegments + 2, 16);
    }
    if (key === '-' || key === '_') {
      kaleidoscopeSegments = max(kaleidoscopeSegments - 2, 4);
    }
  }

  // Adjust number of active neon paths with arrow keys
  if (neonMode) {
    if (keyCode === UP_ARROW) {
      numActivePaths = min(numActivePaths + 10, 200);
      updateActivePaths();
    }
    if (keyCode === DOWN_ARROW) {
      numActivePaths = max(numActivePaths - 10, 10);
      updateActivePaths();
    }
    // Manually rotate paths with left/right
    if (keyCode === LEFT_ARROW) {
      pathRotationIndex = (pathRotationIndex - 20 + svgPaths.length) % svgPaths.length;
      updateActivePaths();
    }
    if (keyCode === RIGHT_ARROW) {
      pathRotationIndex = (pathRotationIndex + 20) % svgPaths.length;
      updateActivePaths();
    }
  }
}

// Touch Controls for Mobile Devices
// Define preset mode combinations for easy cycling
function cycleTouchMode() {
  // Define mode presets (each preset is an object with mode states)
  const modePresets = [
    { name: 'VERTICAL FLOW', setup: () => {
      verticalFlowMode = true;
      kaleidoscopeMode = false;
      neonMode = false;
      mode3D = false;
      tunnelMode = false;
      particleMode = 0;
      physicsMode = false;
    }},
    { name: 'KALEIDOSCOPE', setup: () => {
      verticalFlowMode = false;
      kaleidoscopeMode = true;
      neonMode = false;
      mode3D = false;
      tunnelMode = false;
      particleMode = 0;
      physicsMode = false;
      pg.background(colors.darkPurple);
    }},
    { name: 'NEON WIREFRAME', setup: () => {
      verticalFlowMode = false;
      kaleidoscopeMode = false;
      neonMode = true;
      mode3D = false;
      tunnelMode = false;
      particleMode = 0;
      physicsMode = false;
      if (svgLoaded) updateActivePaths();
    }},
    { name: '3D MODE', setup: () => {
      verticalFlowMode = false;
      kaleidoscopeMode = false;
      neonMode = false;
      mode3D = true;
      tunnelMode = false;
      particleMode = 0;
      physicsMode = false;
      tunnelDepth = 0;
      for (let i = 0; i < stripZPositions.length; i++) {
        stripZPositions[i] = 0;
      }
    }},
    { name: 'KALEIDOSCOPE + TUNNEL', setup: () => {
      verticalFlowMode = false;
      kaleidoscopeMode = true;
      neonMode = false;
      mode3D = false;
      tunnelMode = true;
      particleMode = 0;
      physicsMode = false;
      tunnelSpeed = 0.02;
      pg.background(colors.darkPurple);
    }},
    { name: 'PARTICLES: FIREWORKS', setup: () => {
      verticalFlowMode = false;
      kaleidoscopeMode = false;
      neonMode = false;
      mode3D = false;
      tunnelMode = false;
      particleMode = 5;
      physicsMode = false;
      clearParticleFountains();
    }},
    { name: 'PARTICLES: VORTEX', setup: () => {
      verticalFlowMode = false;
      kaleidoscopeMode = false;
      neonMode = false;
      mode3D = false;
      tunnelMode = false;
      particleMode = 4;
      physicsMode = false;
      clearParticleFountains();
    }},
    { name: 'PHYSICS MODE', setup: () => {
      verticalFlowMode = false;
      kaleidoscopeMode = false;
      neonMode = false;
      mode3D = false;
      tunnelMode = false;
      particleMode = 0;
      physicsMode = true;
      if (!physicsInitialized) {
        initializePhysics();
      }
    }}
  ];

  // Cycle to next mode
  touchModeIndex = (touchModeIndex + 1) % modePresets.length;
  modePresets[touchModeIndex].setup();

  // Show overlay with mode name
  showModeOverlay = true;
  modeOverlayTimer = 90; // Show for 3 seconds at 30fps

  return modePresets[touchModeIndex].name;
}

// Handle touch/click events (works on both mobile and desktop)
function touchStarted() {
  // Check for double-tap (within 300ms)
  let currentTime = millis();
  if (currentTime - lastTouchTime < 300) {
    // Double tap - reset to first mode (Vertical Flow)
    touchModeIndex = -1; // Will become 0 after cycling
    cycleTouchMode();
  } else {
    // Single tap - cycle to next mode
    cycleTouchMode();
  }
  lastTouchTime = currentTime;

  // Prevent default behavior (avoid issues on mobile)
  return false;
}

// Draw mode overlay if active
function drawModeOverlay() {
  if (showModeOverlay && modeOverlayTimer > 0) {
    push();

    // Semi-transparent background
    fill(0, 0, 0, 150);
    noStroke();
    let boxWidth = 400;
    let boxHeight = 80;
    rectMode(CENTER);
    rect(width / 2, height / 2, boxWidth, boxHeight, 10);

    // Mode name text
    fill(colors.cyan);
    textAlign(CENTER, CENTER);
    textSize(32);
    textFont('Arial Black');
    text(getCurrentModeName(), width / 2, height / 2 - 5);

    // Instruction text
    fill(255, 255, 255, 180);
    textSize(14);
    textFont('Arial');
    text('Tap to cycle modes • Double-tap to reset', width / 2, height / 2 + 25);

    pop();

    // Countdown timer
    modeOverlayTimer--;
    if (modeOverlayTimer <= 0) {
      showModeOverlay = false;
    }
  }
}

// Get current mode name for display
function getCurrentModeName() {
  const modeNames = [
    'VERTICAL FLOW',
    'KALEIDOSCOPE',
    'NEON WIREFRAME',
    '3D MODE',
    'KALEIDOSCOPE + TUNNEL',
    'PARTICLES: FIREWORKS',
    'PARTICLES: VORTEX',
    'PHYSICS MODE'
  ];
  return modeNames[touchModeIndex] || 'VERTICAL FLOW';
}

// Handle dropped audio files
function drop(file) {
  if (file.type === 'audio') {
    if (audio) {
      audio.stop();
    }
    audio = loadSound(file.data, () => {
      audio.loop();
      fft.setInput(audio);
      isPlaying = true;
    });
  }
}
