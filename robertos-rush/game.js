// Game canvas setup
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
canvas.width = 800;
canvas.height = 600;
document.querySelector('.game-container').appendChild(canvas);

// Ground level based on the background image
const GROUND_LEVEL = 525; 

// Game state
const gameState = {
    bodies: 0,
    bodiesPiled: 0,
    time: 0, // Time elapsed in seconds
    level: 1,
    gameOver: false,
    paused: false,
    started: false,
    startButtonHover: false, // Track if mouse is over start button
    keysPressed: {}, // Track which keys are currently pressed for smooth movement
    showMessage: false, // For displaying temporary messages
    messageText: '', // Current message text
    messageTimer: 0, // Timer for message display
    showDropPrompt: false, // Show drop prompt when near morgue
    dropPromptText: '', // Text for drop prompt
    hearseTimer: 3000, // Time until next hearse arrival (starts at 3 seconds)
    hearseTimerBase: 3000, // Base timer for hearse arrivals
    hearseTimerIncrease: 500, // How much to increase timer each delivery
    hearseCount: 0, // Count of deliveries for timing calculation
    fadeState: 'none', // none, fadeOut, fadeIn
    fadeAlpha: 0, // 0-1 for fade effect
    fadeTimer: 0, // Timer for fade duration
    maxHearses: 1, // Start with 1 hearse, increase with bodies delivered
    themePlayedOnStartScreen: false, // Track if theme started on start screen
    // Intro video states
    introState: 'video', // video, fadeOut, wait, fadeIn, complete
    introVideo: null, // Video element
    introVideoLoaded: false, // Track if video is loaded
    showStartScreen: false, // Track when to show start screen
    introFadeAlpha: 0, // Separate fade alpha for intro transitions
    introWaitTimer: 0, // Timer for waiting between fades
    // Mobile controls
    isMobile: false, // Track if device is mobile
    touchControls: {
        leftPressed: false,
        rightPressed: false,
        upPressed: false,
        downPressed: false,
        pickupPressed: false,
        pushPressed: false
    }
};

// Audio objects
const audio = {
    theme: new Audio('theme.mp3'),
    start: new Audio('start.mp3')
};

// Setup audio
audio.theme.loop = true;
audio.theme.volume = 0.4; // Reasonable volume level
audio.start.volume = 0.6;

// Start button location and size
const startButton = {
    x: 300,
    y: 400,
    width: 200,
    height: 60
};

// Player (Roberto) object - INCREASED SIZE TO MATCH BACKGROUND SCALE
const player = {
    x: 400,
    y: GROUND_LEVEL - 68, // Position at ground level, adjusted for larger size
    width: 52,  // Increased from 42 for better scaling
    height: 68, // Increased from 58 for better scaling
    speed: 7,   // Increased speed for smoother movement
    direction: 'right',
    state: 'idle', // idle, running, carrying, pushing, tired, pickup, dropping, dying
    animationPhase: 'normal', // Used for multi-phase animations like dropping
    frameIndex: 0,
    tickCount: 0,
    ticksPerFrame: 5, // ADJUSTED for smoother carrying animation
    maxFrames: 1, // Will be set based on animation
    carrying: false,
    pushingGurney: false,
    interactionCooldown: 0, // Prevent too many rapid interactions
    stamina: 100, // 0-100 percentage
    staminaDecreaseRate: 0.08, // REDUCED base stamina loss
    staminaRecoveryRate: 0.05,
    tiredBlinkCounter: 0, // For tired animation blinking
    isDying: false,
    lastX: 400 // Track last position for stamina calculation
};

// Hearses array - now supports multiple hearses
const hearses = [];

// Game parameters - FIXED for precise door positioning at the blue doors based on background.png
// Background.png doors: top-left 995x618px, top-right 1270x620px - scaled to 800px canvas
const MORGUE_X = 750; // X position of blue morgue doors 
const MORGUE_DELIVERY_ZONE = { x: 650, width: 100 }; // Precise delivery zone at blue doors (scaled coordinates)
const HEARSE_PARKED_POSITIONS = [140, 240]; // Two parking positions: under squirrel and under "RICH" in billboard
const BODY_PILE_THRESHOLD = 5; // Game over when bodies pile up

// Array to store bodies/gurneys
const bodies = [];
const gurneys = [];

// UPDATED animation filenames for Roberto's states with all correct frames
const animations = {
    // Roberto animations with complete frame sequences
    idle: ['roberto_idle.png'],
    running: [
        'roberto_move01.png', 
        'roberto_move02.png', 
        'roberto_move03.png', 
        'roberto_move04.png', 
        'roberto_move05.png', 
        'roberto_move06.png', 
        'roberto_move07.png'
    ],
    carrying: [
        'roberto_carry01.png', 
        'roberto_carry02.png', 
        'roberto_carry03.png', 
        'roberto_carry04.png', 
        'roberto_carry05.png', 
        'roberto_carry06.png'
    ],
    pickup: [
        'roberto_pickup01.png', 
        'roberto_pickup02.png', 
        'roberto_pickup03.png'
    ],
    dropping: [
        'roberto_carry06.png', 
        'roberto_carry05.png', 
        'roberto_carry04.png', 
        'roberto_carry03.png', 
        'roberto_carry02.png', 
        'roberto_carry01.png',
        'roberto_pickup03.png',
        'roberto_pickup02.png',
        'roberto_pickup01.png'
    ],
    pushing: ['roberto_push02.png'],
    tired: ['roberto_tired01.png'],
    dying: [
        'roberto_idle.png',
        'roberto_tired01.png',
        'roberto_tired02.png'
    ],
    
    // Hearse animations
    hearseArriving: ['hearse01.png'],
    hearseParked: ['hearse02.png'],
    hearseOpen: ['hearse_open.png'], // FIXED: Correct filename
    hearseLeaving: ['hearse03.png'],
    
    // Props
    skeleton: ['skeleton.png'],
    gurneyEmpty: ['gurney_empty.png', 'gurney_empty02.png'],
    gurneyBody: ['gurney_body.png']
};

// Assets container
const assets = {
    background: new Image(),
    title: new Image(),
    startBackground: new Image(),
    frames: {},
    loaded: 0,
    required: 0  // This will be calculated
};

// Calculate required assets
assets.required = 3; // Background, title, and start background
for (const animType in animations) {
    assets.required += animations[animType].length;
}

// Function to detect mobile device
function detectMobile() {
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    return isMobileDevice || isTouchDevice;
}

// Function to show temporary message
function showMessage(text, duration = 3000) {
    gameState.showMessage = true;
    gameState.messageText = text;
    gameState.messageTimer = duration / 16; // Convert to frames (assuming ~60fps)
}

// Function to start fade transition
function startFadeTransition() {
    gameState.fadeState = 'fadeOut';
    gameState.fadeAlpha = 0;
    gameState.fadeTimer = 60; // 1 second at 60fps
}

// Function to load intro video
function loadIntroVideo() {
    gameState.introVideo = document.createElement('video');
    gameState.introVideo.src = 'inspiresoftwareintro.mp4';
    gameState.introVideo.muted = false; // Allow video audio
    gameState.introVideo.volume = 0.7; // Set reasonable volume
    gameState.introVideo.preload = 'auto';
    
    gameState.introVideo.onloadeddata = function() {
        console.log('Intro video loaded successfully');
        gameState.introVideoLoaded = true;
        // Try to play video automatically
        playIntroVideo();
    };
    
    gameState.introVideo.onerror = function(e) {
        console.error('Error loading intro video:', e);
        // Skip to start screen if video fails to load
        skipToStartScreen();
    };
    
    gameState.introVideo.onended = function() {
        console.log('Intro video finished playing');
        startIntroFadeOut();
    };
}

// Function to play intro video
function playIntroVideo() {
    if (gameState.introVideo && gameState.introVideoLoaded) {
        gameState.introVideo.play().then(() => {
            console.log('Intro video started playing');
        }).catch(e => {
            console.log('Intro video autoplay blocked, will play on user interaction:', e);
            // Add click listener to play video on first interaction
            const playOnInteraction = () => {
                gameState.introVideo.play();
                document.removeEventListener('click', playOnInteraction);
                document.removeEventListener('keydown', playOnInteraction);
            };
            document.addEventListener('click', playOnInteraction);
            document.addEventListener('keydown', playOnInteraction);
        });
    }
}

// Function to start intro fade out after video ends
function startIntroFadeOut() {
    gameState.introState = 'fadeOut';
    gameState.introFadeAlpha = 0;
}

// Function to skip to start screen if video fails
function skipToStartScreen() {
    gameState.introState = 'complete';
    gameState.showStartScreen = true;
}
function startThemeMusic() {
    if (!gameState.themePlayedOnStartScreen) {
        audio.theme.play().then(() => {
            console.log('Theme music started on start screen');
            gameState.themePlayedOnStartScreen = true;
        }).catch(e => {
            console.log('Theme music autoplay blocked:', e);
            // Try again on user interaction
            const playOnInteraction = () => {
                audio.theme.play().then(() => {
                    gameState.themePlayedOnStartScreen = true;
                });
                document.removeEventListener('click', playOnInteraction);
                document.removeEventListener('keydown', playOnInteraction);
            };
            document.addEventListener('click', playOnInteraction);
            document.addEventListener('keydown', playOnInteraction);
        });
    }
}

// Function to load all assets
function loadAssets() {
    console.log('Starting to load assets...');
    
    // Load background 
    assets.background.src = 'background.png';
    assets.background.onload = assetLoaded;
    assets.background.onerror = assetError;
    
    // Load start background
    assets.startBackground.src = 'background_01.png';
    assets.startBackground.onload = assetLoaded;
    assets.startBackground.onerror = function() {
        console.log('Start background not found, using backup');
        assets.startBackground.src = 'background.png'; // Use regular background as backup
        assets.startBackground.onload = assetLoaded;
    };
    
    // Load title
    assets.title.src = 'title.png';
    assets.title.onload = assetLoaded;
    assets.title.onerror = function() {
        console.log('Title image not found, using backup');
        assets.title.src = 'sprite01.png'; // Use a sprite as backup
        assets.title.onload = assetLoaded;
    };
    
    // Load all animation frames
    for (const animType in animations) {
        assets.frames[animType] = [];
        
        animations[animType].forEach(frameFile => {
            const img = new Image();
            img.src = frameFile;
            img.onload = function() {
                console.log(`Loaded: ${img.src}`);
                assetLoaded();
            };
            img.onerror = function() {
                console.error(`Failed to load: ${img.src}`);
                // Try to find an alternative file
                const backupFile = findAlternativeFile(frameFile);
                if (backupFile) {
                    console.log(`Trying backup file: ${backupFile}`);
                    img.src = backupFile;
                } else {
                    // If no alternative, just continue with loading process
                    assetLoaded();
                }
            };
            assets.frames[animType].push(img);
        });
    }
    
    console.log(`Need to load ${assets.required} assets`);
}

// Find alternative file for missing assets
function findAlternativeFile(filename) {
    // Map of fallback images
    const fallbacks = {
        'roberto_move01.png': 'roberto_idle.png',
        'roberto_move02.png': 'roberto_move01.png',
        'roberto_move03.png': 'roberto_move01.png',
        'roberto_move04.png': 'roberto_move01.png',
        'roberto_move05.png': 'roberto_move01.png',
        'roberto_move06.png': 'roberto_move01.png',
        'roberto_move07.png': 'roberto_move01.png',
        'roberto_carry01.png': 'roberto_idle.png',
        'roberto_carry02.png': 'roberto_carry01.png',
        'roberto_carry03.png': 'roberto_carry01.png',
        'roberto_carry04.png': 'roberto_carry01.png',
        'roberto_carry05.png': 'roberto_carry01.png',
        'roberto_carry06.png': 'roberto_carry01.png',
        'roberto_pickup01.png': 'roberto_idle.png',
        'roberto_pickup02.png': 'roberto_pickup01.png',
        'roberto_pickup03.png': 'roberto_pickup01.png',
        'roberto_tired01.png': 'roberto_idle.png',
        'roberto_tired02.png': 'roberto_tired01.png',
        'roberto_push02.png': 'roberto_idle.png',
        'hearse01.png': 'hearse02.png',
        'hearse_open.png': 'hearse02.png',
        'gurney_empty02.png': 'gurney_empty.png'
    };
    
    return fallbacks[filename];
}

// Asset loaded handler
function assetLoaded() {
    assets.loaded++;
    console.log(`Asset loaded: ${assets.loaded}/${assets.required}`);
    if (assets.loaded >= assets.required) {
        console.log('All assets loaded, initializing game...');
        init();
    }
}

// Asset error handler
function assetError(e) {
    console.error(`Error loading asset: ${e.target.src}`);
    // Continue loading process even if an asset fails
    assetLoaded();
}

// Game initialization
function init() {
    console.log('Game initialized');
    
    // Detect mobile device
    gameState.isMobile = detectMobile();
    
    // ONLY set up mobile features if mobile is detected
    if (gameState.isMobile) {
        setupMobileOptimizations();
    }
    
    // Add event listeners for smooth movement
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    // Mouse events for start button
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('click', handleMouseClick);
    
    // Load and play intro video first
    loadIntroVideo();
    
    // Start game loop
    requestAnimationFrame(gameLoop);
}

// Function to setup mobile-only optimizations
function setupMobileOptimizations() {
    // Add viewport meta tag for mobile optimization
    let viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) {
        viewport = document.createElement('meta');
        viewport.name = 'viewport';
        document.head.appendChild(viewport);
    }
    viewport.content = 'width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover';
    
    // Adjust canvas container for mobile
    const gameContainer = document.querySelector('.game-container');
    gameContainer.style.width = '100vw';
    gameContainer.style.height = 'calc(100vh - 120px)'; // Account for mobile controls
    gameContainer.style.maxWidth = '100vw';
    gameContainer.style.maxHeight = 'calc(100vh - 120px)';
    
    // Scale canvas to fit mobile screen while maintaining aspect ratio
    const scaleX = window.innerWidth / 800;
    const scaleY = (window.innerHeight - 120) / 600; // Subtract mobile controls height
    const scale = Math.min(scaleX, scaleY);
    
    canvas.style.width = `${800 * scale}px`;
    canvas.style.height = `${600 * scale}px`;
    canvas.style.imageRendering = 'pixelated';
    canvas.style.imageRendering = 'crisp-edges';
    
    // Center the canvas
    gameContainer.style.display = 'flex';
    gameContainer.style.justifyContent = 'center';
    gameContainer.style.alignItems = 'center';
    
    // Hide controls info on mobile
    const controlsInfo = document.querySelector('.controls-info');
    if (controlsInfo) {
        controlsInfo.style.display = 'none';
    }
    
    // Create mobile controls
    createMobileControls();
    
    // Force landscape orientation hint
    const orientationHint = document.createElement('div');
    orientationHint.id = 'orientation-hint';
    orientationHint.innerHTML = '📱 ↻<br>Please rotate your device to landscape mode for the best experience!';
    orientationHint.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.9);
        color: #FFD700;
        font-family: 'Press Start 2P', monospace;
        font-size: 14px;
        text-align: center;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        line-height: 1.5;
    `;
    
    // Show/hide orientation hint based on orientation
    function checkOrientation() {
        if (window.innerHeight > window.innerWidth) {
            document.body.appendChild(orientationHint);
        } else {
            if (orientationHint.parentNode) {
                orientationHint.parentNode.removeChild(orientationHint);
            }
        }
    }
    
    // Check orientation on load and resize
    checkOrientation();
    window.addEventListener('orientationchange', () => {
        setTimeout(checkOrientation, 100);
    });
    window.addEventListener('resize', checkOrientation);
}

// Function to create mobile controls
function createMobileControls() {
    if (!gameState.isMobile) return;
    
    // Create mobile controls container
    const mobileControls = document.createElement('div');
    mobileControls.id = 'mobile-controls';
    mobileControls.style.cssText = `
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        height: 120px;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 20px;
        z-index: 1000;
        user-select: none;
        -webkit-user-select: none;
        -webkit-touch-callout: none;
    `;
    
    // Action buttons (left side)
    const actionButtons = document.createElement('div');
    actionButtons.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 10px;
    `;
    
    // Pick up/Drop button
    const pickupButton = document.createElement('button');
    pickupButton.id = 'pickup-btn';
    pickupButton.innerHTML = 'PICKUP<br>DROP';
    pickupButton.style.cssText = `
        width: 80px;
        height: 45px;
        background-color: #DAA520;
        color: #000;
        border: 3px solid #000;
        font-family: 'Press Start 2P', monospace;
        font-size: 8px;
        font-weight: bold;
        text-align: center;
        line-height: 1.2;
        box-shadow: 3px 3px 0 #8B6914;
        border-radius: 5px;
        cursor: pointer;
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
    `;
    
    // Push/Pull button
    const pushButton = document.createElement('button');
    pushButton.id = 'push-btn';
    pushButton.innerHTML = 'PUSH<br>PULL';
    pushButton.style.cssText = `
        width: 80px;
        height: 45px;
        background-color: #DAA520;
        color: #000;
        border: 3px solid #000;
        font-family: 'Press Start 2P', monospace;
        font-size: 8px;
        font-weight: bold;
        text-align: center;
        line-height: 1.2;
        box-shadow: 3px 3px 0 #8B6914;
        border-radius: 5px;
        cursor: pointer;
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
    `;
    
    // Directional pad (right side)
    const dPad = document.createElement('div');
    dPad.style.cssText = `
        position: relative;
        width: 120px;
        height: 120px;
    `;
    
    // Left arrow
    const leftBtn = document.createElement('button');
    leftBtn.id = 'left-btn';
    leftBtn.innerHTML = '◀';
    leftBtn.style.cssText = `
        position: absolute;
        left: 0;
        top: 50%;
        transform: translateY(-50%);
        width: 40px;
        height: 40px;
        background-color: #DAA520;
        color: #000;
        border: 3px solid #000;
        font-family: 'Press Start 2P', monospace;
        font-size: 16px;
        font-weight: bold;
        text-align: center;
        box-shadow: 3px 3px 0 #8B6914;
        border-radius: 5px;
        cursor: pointer;
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
    `;
    
    // Right arrow
    const rightBtn = document.createElement('button');
    rightBtn.id = 'right-btn';
    rightBtn.innerHTML = '▶';
    rightBtn.style.cssText = `
        position: absolute;
        right: 0;
        top: 50%;
        transform: translateY(-50%);
        width: 40px;
        height: 40px;
        background-color: #DAA520;
        color: #000;
        border: 3px solid #000;
        font-family: 'Press Start 2P', monospace;
        font-size: 16px;
        font-weight: bold;
        text-align: center;
        box-shadow: 3px 3px 0 #8B6914;
        border-radius: 5px;
        cursor: pointer;
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
    `;
    
    // Assemble the controls
    actionButtons.appendChild(pickupButton);
    actionButtons.appendChild(pushButton);
    dPad.appendChild(leftBtn);
    dPad.appendChild(rightBtn);
    mobileControls.appendChild(actionButtons);
    mobileControls.appendChild(dPad);
    
    // Add to page
    document.body.appendChild(mobileControls);
    
    // Add touch event handlers
    setupMobileTouchEvents();
}

// Function to setup mobile touch events
function setupMobileTouchEvents() {
    // Helper function to add button press effects
    function addButtonEffects(button) {
        button.addEventListener('touchstart', (e) => {
            e.preventDefault();
            button.style.backgroundColor = '#FFD700';
            button.style.transform = 'translate(2px, 2px)';
            button.style.boxShadow = '1px 1px 0 #8B6914';
        });
        
        button.addEventListener('touchend', (e) => {
            e.preventDefault();
            button.style.backgroundColor = '#DAA520';
            button.style.transform = 'translate(0, 0)';
            button.style.boxShadow = '3px 3px 0 #8B6914';
        });
    }
    
    // Directional controls
    const leftBtn = document.getElementById('left-btn');
    const rightBtn = document.getElementById('right-btn');
    const pickupBtn = document.getElementById('pickup-btn');
    const pushBtn = document.getElementById('push-btn');
    
    // Add visual effects to all buttons
    [leftBtn, rightBtn, pickupBtn, pushBtn].forEach(addButtonEffects);
    
    // Left button
    leftBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        gameState.touchControls.leftPressed = true;
        gameState.keysPressed['ArrowLeft'] = true;
    });
    
    leftBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        gameState.touchControls.leftPressed = false;
        delete gameState.keysPressed['ArrowLeft'];
    });
    
    // Right button
    rightBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        gameState.touchControls.rightPressed = true;
        gameState.keysPressed['ArrowRight'] = true;
    });
    
    rightBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        gameState.touchControls.rightPressed = false;
        delete gameState.keysPressed['ArrowRight'];
    });
    
    // Pickup/Drop button
    pickupBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (!player.pushingGurney && player.interactionCooldown <= 0) {
            handleBodyInteraction();
            player.interactionCooldown = 15;
        }
    });
    
    // Push/Pull button
    pushBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (player.interactionCooldown <= 0) {
            handleGurneyInteraction();
            player.interactionCooldown = 15;
        }
    });
    
    // Prevent context menu on long press
    document.addEventListener('contextmenu', (e) => {
        if (gameState.isMobile) {
            e.preventDefault();
        }
    });
    
    // Prevent scrolling on touch
    document.addEventListener('touchmove', (e) => {
        if (gameState.isMobile && e.target.closest('#mobile-controls')) {
            e.preventDefault();
        }
    }, { passive: false });
}

// Handle mouse movement (for button hover)
function handleMouseMove(e) {
    if (gameState.started) return;
    
    // Get canvas-relative coordinates (account for mobile scaling ONLY if mobile)
    const rect = canvas.getBoundingClientRect();
    let mouseX, mouseY;
    
    if (gameState.isMobile) {
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        mouseX = (e.clientX - rect.left) * scaleX;
        mouseY = (e.clientY - rect.top) * scaleY;
    } else {
        // Desktop - use original coordinate system
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;
    }
    
    // Check if mouse is over the start button
    gameState.startButtonHover = 
        mouseX >= startButton.x && 
        mouseX <= startButton.x + startButton.width &&
        mouseY >= startButton.y && 
        mouseY <= startButton.y + startButton.height;
}

// Handle mouse clicks
function handleMouseClick(e) {
    // Skip intro video on click (optional - allows users to skip)
    if (gameState.introState === 'video' && gameState.introVideoLoaded) {
        gameState.introVideo.pause();
        startIntroFadeOut();
        return;
    }
    
    if (gameState.started || !gameState.showStartScreen) return;
    
    // Get canvas-relative coordinates (account for mobile scaling ONLY if mobile)
    const rect = canvas.getBoundingClientRect();
    let mouseX, mouseY;
    
    if (gameState.isMobile) {
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        mouseX = (e.clientX - rect.left) * scaleX;
        mouseY = (e.clientY - rect.top) * scaleY;
    } else {
        // Desktop - use original coordinate system
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;
    }
    
    // Check if click is on the start button
    if (mouseX >= startButton.x && 
        mouseX <= startButton.x + startButton.width &&
        mouseY >= startButton.y && 
        mouseY <= startButton.y + startButton.height) {
        startGame();
    }
}

// Function to start the game - called when clicking start button or pressing ENTER
function startGame() {
    if (!gameState.started && gameState.fadeState === 'none' && gameState.showStartScreen) {
        // Play start sound effect IMMEDIATELY
        audio.start.play().then(() => {
            console.log('Start SFX played successfully');
        }).catch(e => {
            console.log('Start SFX play failed:', e);
        });
        
        // Start fade transition immediately after SFX starts
        startFadeTransition();
        
        console.log("Game starting with fade transition...");
    }
}

// Calculate max hearses based on bodies delivered
function calculateMaxHearses() {
    // Start with 1 hearse, add 1 more for every 5 bodies delivered (max 2)
    return Math.min(2, 1 + Math.floor(gameState.bodies / 5));
}

// Find available parking position for hearse - UPDATED for billboard positioning
function findAvailableParkingPosition() {
    for (let i = 0; i < HEARSE_PARKED_POSITIONS.length; i++) {
        const position = HEARSE_PARKED_POSITIONS[i];
        const occupied = hearses.some(hearse => 
            Math.abs(hearse.x - position) < 120 && // Increased distance check to prevent overlap
            (hearse.state === 'parked' || hearse.state === 'open')
        );
        if (!occupied) {
            return position;
        }
    }
    return null; // No available position
}

// Schedule hearse arrival with progressive timing
function scheduleHearseArrival() {
    const maxHearses = calculateMaxHearses();
    
    // Don't schedule if we already have maximum hearses for current level
    if (hearses.length >= maxHearses) return;
    
    // Calculate progressive timing - gets faster over time but has minimum
    const timingMultiplier = Math.max(0.5, 1 - (gameState.hearseCount * 0.05));
    const arrivalTime = gameState.hearseTimerBase * timingMultiplier;
    
    setTimeout(() => {
        // Check if we can still add a hearse and have parking available
        if (hearses.length < maxHearses && findAvailableParkingPosition() !== null) {
            const parkingPosition = findAvailableParkingPosition();
            
            // Create new hearse
            const newHearse = {
                x: -250,
                y: GROUND_LEVEL - 78,
                width: 160,
                height: 80,
                speed: 2,
                state: 'arriving',
                frameIndex: 0,
                tickCount: 0,
                ticksPerFrame: 8,
                bounceOffset: 0,
                bounceDirection: 1,
                bodyDropped: false,
                bodyType: Math.random() > 0.5 ? 'skeleton' : 'gurney',
                facingDirection: 'right',
                targetParkingX: parkingPosition,
                active: true
            };
            
            hearses.push(newHearse);
            
            // Show "NEW BODY ARRIVED" message when hearse appears
            showMessage('NEW BODY ARRIVED', 2000);
            
            // Schedule next hearse if room available
            if (hearses.length < maxHearses) {
                scheduleHearseArrival();
            }
        }
    }, arrivalTime);
}

// Game loop
function gameLoop(timestamp) {
    update();
    render();
    requestAnimationFrame(gameLoop);
}

// UPDATED for smooth movement: Handle key down events
function handleKeyDown(e) {
    // Skip intro video with any key press (optional)
    if (gameState.introState === 'video' && gameState.introVideoLoaded) {
        gameState.introVideo.pause();
        startIntroFadeOut();
        return;
    }
    
    // Only allow ENTER key to start the game from title screen
    if (!gameState.started && gameState.showStartScreen) {
        if (e.key === 'Enter') {
            startGame();
        }
        return;
    }
    
    if (gameState.gameOver) return;
    if (gameState.paused && e.key !== 'p') return;
    
    // Track keys being pressed for smooth movement
    gameState.keysPressed[e.key] = true;
    
    // Don't handle movement during special animations
    if (player.state === 'pickup' || 
        player.state === 'dropping' || 
        player.state === 'dying' || 
        player.interactionCooldown > 0) return;
    
    // Handle specific key presses that are not directional movement
    switch(e.key) {
        case 'f': // Pick up/drop body
            if (!player.pushingGurney && player.interactionCooldown <= 0) {
                handleBodyInteraction();
                // Set cooldown to prevent rapid button presses
                player.interactionCooldown = 15; // REDUCED from 30 for better responsiveness
            }
            break;
            
        case 'g': // Toggle pushing gurney state
            if (player.interactionCooldown <= 0) {
                handleGurneyInteraction();
                // Set cooldown to prevent rapid button presses
                player.interactionCooldown = 15; // REDUCED from 30 for better responsiveness
            }
            break;
            
        case 'p': // Pause
            gameState.paused = !gameState.paused;
            break;
    }
}

// UPDATED for smooth movement: Handle key up events
function handleKeyUp(e) {
    // Remove key from pressed keys
    delete gameState.keysPressed[e.key];
    
    // Check if not moving anymore
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && 
        !gameState.keysPressed['ArrowLeft'] && 
        !gameState.keysPressed['ArrowRight'] && 
        !player.pushingGurney) {
        
        // Don't change state during special animations
        if (player.state !== 'pickup' && 
            player.state !== 'dropping' && 
            player.state !== 'dying') {
            // Return to appropriate idle state
            if (player.carrying) {
                player.state = 'carrying';
                player.frameIndex = 0; // Reset to first carrying frame when idle
            } else if (player.stamina < 20) {
                player.state = 'tired';
            } else {
                player.state = 'idle';
            }
        }
    }
}

// UPDATED: Process movement based on keys pressed (for smooth movement) with improved stamina mechanics
function processMovement() {
    // Don't process during special animations
    if (player.state === 'pickup' || 
        player.state === 'dropping' || 
        player.state === 'dying' || 
        player.interactionCooldown > 0) return;
    
    let moved = false;
    let distanceMoved = 0;
    
    if (gameState.keysPressed['ArrowLeft']) {
        player.direction = 'left';
        
        // Set state based on current activity
        if (player.carrying && player.state !== 'carrying') {
            player.state = 'carrying';
        } else if (player.pushingGurney && player.state !== 'pushing') {
            player.state = 'pushing';
        } else if (player.stamina < 20 && !player.carrying && !player.pushingGurney && player.state !== 'tired') {
            player.state = 'tired';
        } else if (!player.carrying && !player.pushingGurney && player.stamina >= 20 && player.state !== 'running') {
            player.state = 'running';
        }
        
        // Calculate movement speed and stamina cost
        let moveSpeed = player.stamina > 20 ? player.speed : player.speed / 2;
        if (player.pushingGurney) {
            moveSpeed *= 0.7; // SLOWER when pushing gurney
        }
        
        // Move player (and gurney if pushing one)
        if (!player.pushingGurney) {
            player.x -= moveSpeed;
            distanceMoved = moveSpeed;
        }
        
        moved = true;
    }
    
    if (gameState.keysPressed['ArrowRight']) {
        player.direction = 'right';
        
        // Set state based on current activity
        if (player.carrying && player.state !== 'carrying') {
            player.state = 'carrying';
        } else if (player.pushingGurney && player.state !== 'pushing') {
            player.state = 'pushing';
        } else if (player.stamina < 20 && !player.carrying && !player.pushingGurney && player.state !== 'tired') {
            player.state = 'tired';
        } else if (!player.carrying && !player.pushingGurney && player.stamina >= 20 && player.state !== 'running') {
            player.state = 'running';
        }
        
        // Calculate movement speed and stamina cost
        let moveSpeed = player.stamina > 20 ? player.speed : player.speed / 2;
        if (player.pushingGurney) {
            moveSpeed *= 0.7; // SLOWER when pushing gurney
        }
        
        // Move player (and gurney if pushing one)
        if (!player.pushingGurney) {
            player.x += moveSpeed;
            distanceMoved = moveSpeed;
        }
        
        moved = true;
    }
    
    // UPDATED STAMINA MECHANICS
    if (moved) {
        // Base stamina loss for movement
        let staminaLoss = player.staminaDecreaseRate;
        
        // Extra stamina loss when pushing gurney
        if (player.pushingGurney) {
            staminaLoss *= 2.5; // MUCH MORE stamina loss when pushing
        }
        
        // Extra stamina loss when carrying
        if (player.carrying) {
            staminaLoss *= 1.5;
        }
        
        depleteStamina(staminaLoss);
    }
    
    // Handle movement transitions if no keys pressed
    if (!moved && player.state === 'running') {
        player.state = 'idle';
    }
    
    // Keep player within canvas bounds
    if (player.x < 0) player.x = 0;
    if (player.x > canvas.width - player.width) player.x = canvas.width - player.width;
    
    // Update last position for stamina tracking
    player.lastX = player.x;
}

// Check if player is near morgue doors and update drop prompts
function updateDropPrompts() {
    // Check if player is in morgue delivery zone (precise blue door location)
    const inDeliveryZone = player.x > MORGUE_DELIVERY_ZONE.x && 
                          player.x < MORGUE_DELIVERY_ZONE.x + MORGUE_DELIVERY_ZONE.width;
    
    if (inDeliveryZone) {
        if (player.carrying) {
            gameState.showDropPrompt = true;
            gameState.dropPromptText = 'PRESS F TO DROP BODY';
        } else if (player.pushingGurney) {
            // Check if any gurney has a body
            let hasBodyOnGurney = false;
            gurneys.forEach(gurney => {
                if (gurney.pushedBy === player && gurney.hasBody) {
                    hasBodyOnGurney = true;
                }
            });
            if (hasBodyOnGurney) {
                gameState.showDropPrompt = true;
                gameState.dropPromptText = 'PRESS G TO DROP GURNEY';
            } else {
                gameState.showDropPrompt = false;
            }
        } else {
            gameState.showDropPrompt = false;
        }
    } else {
        gameState.showDropPrompt = false;
    }
}

// Find nearest hearse that can be interacted with
function findNearestHearse() {
    let nearestHearse = null;
    let minDistance = Infinity;
    
    hearses.forEach(hearse => {
        if (hearse.state === 'open' && !hearse.bodyDropped) {
            const distance = Math.abs(player.x - (hearse.x + hearse.width/2));
            if (distance < 60 && distance < minDistance) {
                minDistance = distance;
                nearestHearse = hearse;
            }
        }
    });
    
    return nearestHearse;
}

// Handle body pickup/drop
function handleBodyInteraction() {
    // Check if player is near any hearse and hearse has a body to pick up
    if (!player.carrying) {
        const nearestHearse = findNearestHearse();
        
        if (nearestHearse) {
            if (nearestHearse.bodyType === 'skeleton') {
                // Start pickup animation sequence
                startPickupAnimation(() => {
                    nearestHearse.bodyDropped = true;
                    // Skeleton hearse leaves immediately after player picks up body
                    setTimeout(() => {
                        nearestHearse.state = 'leaving';
                    }, 1000);
                });
            } else {
                // Add gurney with body near hearse
                gurneys.push({
                    x: nearestHearse.x + 40, // ADJUSTED position for left-facing hearse
                    y: GROUND_LEVEL - 35, // INCREASED size
                    width: 74, // INCREASED from 64 for better scaling
                    height: 35, // INCREASED from 30 for better scaling
                    hasBody: true,
                    pushedBy: null
                });
                nearestHearse.bodyDropped = true;
                // Gurney hearse leaves automatically after dropping gurney
                setTimeout(() => {
                    nearestHearse.state = 'leaving';
                }, 3000); // Give player some time to start moving gurney
            }
            
            return;
        }
    }
    
    // Check if player is near a body on the ground
    if (!player.carrying) {
        for (let i = 0; i < bodies.length; i++) {
            const body = bodies[i];
            if (!body.delivered && Math.abs(player.x - body.x) < 40) {
                // Start pickup animation
                startPickupAnimation(() => {
                    player.carrying = true;
                    bodies.splice(i, 1); // Remove from bodies array while carried
                    depleteStamina(5); // Extra stamina cost for picking up
                });
                return;
            }
        }
    } else {
        // Drop body - start dropping animation
        startDroppingAnimation(() => {
            // Check if player is in front of morgue delivery zone (precise blue door location)
            if (player.x > MORGUE_DELIVERY_ZONE.x && 
                player.x < MORGUE_DELIVERY_ZONE.x + MORGUE_DELIVERY_ZONE.width) {
                // Successfully delivered to morgue
                gameState.bodies++;
                gameState.hearseCount++; // Increment for timing progression
                
                // Update max hearses based on new delivery count
                gameState.maxHearses = calculateMaxHearses();
                
                // GAIN STAMINA for successful delivery
                player.stamina += 25;
                if (player.stamina > 100) player.stamina = 100;
                showMessage('BODY DELIVERED! +25 STAMINA', 1500);
                
                // Schedule next hearse if available
                if (hearses.length < gameState.maxHearses) {
                    scheduleHearseArrival();
                }
            } else {
                // Drop body on the ground - it becomes a standing skeleton
                bodies.push({
                    x: player.x + (player.direction === 'right' ? 20 : -20),
                    y: GROUND_LEVEL - 58, // INCREASED height for better scaling
                    width: 42, // INCREASED from 32 for better scaling
                    height: 58, // INCREASED from 48 for better scaling
                    direction: player.direction, // Remember which way the skeleton is facing
                    delivered: false
                });
                
                // Check if too many bodies are piled up
                if (bodies.length >= BODY_PILE_THRESHOLD) {
                    startDyingAnimation();
                }
            }
            
            player.carrying = false;
        });
    }
}

// Start the pickup animation sequence
function startPickupAnimation(onComplete) {
    player.state = 'pickup';
    player.frameIndex = 0;
    player.maxFrames = animations.pickup.length;
    
    // Play the sequence and then switch to carrying state
    const animationDuration = player.maxFrames * player.ticksPerFrame * 16; // Approx time for animation
    
    setTimeout(() => {
        player.carrying = true;
        player.state = 'carrying';
        player.frameIndex = 0;
        
        // Call onComplete callback if provided
        if (onComplete) onComplete();
    }, animationDuration);
}

// Start the dropping animation sequence (carrying in reverse + pickup in reverse)
function startDroppingAnimation(onComplete) {
    player.state = 'dropping';
    player.frameIndex = 0;
    player.maxFrames = animations.dropping.length;
    
    // Play the sequence and then return to idle state
    const animationDuration = player.maxFrames * player.ticksPerFrame * 16; // Approx time for animation
    
    setTimeout(() => {
        player.state = player.stamina < 20 ? 'tired' : 'idle';
        player.frameIndex = 0;
        
        // Call onComplete callback if provided
        if (onComplete) onComplete();
    }, animationDuration);
}

// Start the dying animation sequence
function startDyingAnimation() {
    player.state = 'dying';
    player.frameIndex = 0;
    player.maxFrames = animations.dying.length;
    player.isDying = true;
    
    // Play the sequence and then end the game
    const animationDuration = player.maxFrames * player.ticksPerFrame * 24; // Slower dying animation
    
    setTimeout(() => {
        gameState.gameOver = true;
        player.isDying = false;
    }, animationDuration);
}

// UPDATED: Handle gurney interaction - toggle pushing mode
function handleGurneyInteraction() {
    // Check for gurneys nearby
    for (let i = 0; i < gurneys.length; i++) {
        const gurney = gurneys[i];
        if (Math.abs(player.x - gurney.x) < 40) {
            if (!player.pushingGurney) {
                // Start pushing gurney
                player.pushingGurney = true;
                player.state = 'pushing';
                gurney.pushedBy = player;
            } else {
                // Stop pushing if already pushing
                // Check if at morgue and gurney has body, deliver it (precise blue door location)
                if (gurney.x > MORGUE_DELIVERY_ZONE.x && 
                    gurney.x < MORGUE_DELIVERY_ZONE.x + MORGUE_DELIVERY_ZONE.width && 
                    gurney.hasBody) {
                    
                    gurney.hasBody = false;
                    gameState.bodies++;
                    gameState.hearseCount++; // Increment for timing progression
                    
                    // Update max hearses based on new delivery count
                    gameState.maxHearses = calculateMaxHearses();
                    
                    // GAIN STAMINA for successful delivery
                    player.stamina += 25;
                    if (player.stamina > 100) player.stamina = 100;
                    showMessage('GURNEY DELIVERED! +25 STAMINA', 1500);
                    
                    // Remove gurney if delivered to morgue
                    gurneys.splice(i, 1);
                    
                    // Schedule next hearse if available
                    if (hearses.length < gameState.maxHearses) {
                        scheduleHearseArrival();
                    }
                } else {
                    // Check if pushing empty gurney back to any hearse (optional - gurney can be left anywhere)
                    // Gurneys disappear when body is delivered, no need to return them
                }
                
                // Stop pushing
                player.pushingGurney = false;
                player.state = player.stamina < 20 ? 'tired' : 'idle';
                gurney.pushedBy = null;
            }
            return;
        }
    }
}

// Update stamina
function depleteStamina(amount = 0.1) {
    player.stamina -= amount;
    if (player.stamina < 0) player.stamina = 0;
    
    // Show tired animation when stamina is low
    if (player.stamina < 20 && 
        player.state !== 'tired' && 
        player.state !== 'pickup' && 
        player.state !== 'dropping' && 
        player.state !== 'dying' && 
        !player.carrying && 
        !player.pushingGurney) {
        player.state = 'tired';
    }
}

function recoverStamina() {
    if (player.state === 'idle') {
        player.stamina += player.staminaRecoveryRate;
        if (player.stamina > 100) player.stamina = 100;
        
        // Recover from tired state
        if (player.stamina > 30 && player.state === 'tired') {
            player.state = 'idle';
        }
    }
}

// Update intro transitions
function updateIntroTransitions() {
    switch (gameState.introState) {
        case 'video':
            // Video is playing, no updates needed
            break;
            
        case 'fadeOut':
            gameState.introFadeAlpha += 1/60; // Fade out over 1 second
            if (gameState.introFadeAlpha >= 1) {
                gameState.introFadeAlpha = 1;
                gameState.introState = 'wait';
                gameState.introWaitTimer = 60; // Wait 1 second (60 frames at 60fps)
            }
            break;
            
        case 'wait':
            gameState.introWaitTimer--;
            if (gameState.introWaitTimer <= 0) {
                gameState.introState = 'fadeIn';
            }
            break;
            
        case 'fadeIn':
            gameState.introFadeAlpha -= 1/60; // Fade in over 1 second
            if (gameState.introFadeAlpha <= 0) {
                gameState.introFadeAlpha = 0;
                gameState.introState = 'complete';
                gameState.showStartScreen = true;
                // Start theme music when start screen appears
                startThemeMusic();
            }
            break;
            
        case 'complete':
            // Intro sequence complete, normal game flow
            break;
    }
}
function updateFadeTransition() {
    if (gameState.fadeState === 'fadeOut') {
        gameState.fadeAlpha += 1/60; // Fade out over 1 second
        if (gameState.fadeAlpha >= 1) {
            gameState.fadeAlpha = 1;
            gameState.fadeState = 'fadeIn';
            // Actually start the game now
            gameState.started = true;
            scheduleHearseArrival();
        }
    } else if (gameState.fadeState === 'fadeIn') {
        gameState.fadeAlpha -= 1/60; // Fade in over 1 second
        if (gameState.fadeAlpha <= 0) {
            gameState.fadeAlpha = 0;
            gameState.fadeState = 'none';
        }
    }
}

// Update game state
function update() {
    // Always update intro transitions first
    updateIntroTransitions();
    
    // Always update fade transition
    updateFadeTransition();
    
    // Try to start theme music on start screen if not started yet
    if (!gameState.started && gameState.showStartScreen && gameState.fadeState === 'none') {
        startThemeMusic();
    }
    
    if (!gameState.started || gameState.gameOver || gameState.paused) return;
    
    // Update game time
    gameState.time += 1/60; // Assuming 60 FPS
    
    // Process movement for smooth real-time control
    processMovement();
    
    // Update drop prompts
    updateDropPrompts();
    
    // Update message timer
    if (gameState.showMessage && gameState.messageTimer > 0) {
        gameState.messageTimer--;
        if (gameState.messageTimer <= 0) {
            gameState.showMessage = false;
        }
    }
    
    // Update stamina
    recoverStamina();
    
    // Decrease interaction cooldown
    if (player.interactionCooldown > 0) {
        player.interactionCooldown--;
    }
    
    // Update tired blinking animation if player is tired
    if (player.state === 'tired' && !player.carrying && !player.pushingGurney) {
        player.tiredBlinkCounter++;
        if (player.tiredBlinkCounter >= 30) { // Blink every half second
            player.tiredBlinkCounter = 0;
            // Alternate between idle and tired
            player.frameIndex = player.frameIndex === 0 ? 0 : 0;
        }
    }
    
    // Update player animation
    updateAnimation(player);
    
    // Update hearses animations and logic
    hearses.forEach(hearse => {
        updateAnimation(hearse);
        updateHearse(hearse);
    });
    
    // Remove hearses that have left the screen
    for (let i = hearses.length - 1; i >= 0; i--) {
        if (hearses[i].x <= -300) {
            hearses.splice(i, 1);
            // Schedule next hearse if room available
            if (hearses.length < gameState.maxHearses) {
                scheduleHearseArrival();
            }
        }
    }
    
    // Update pushed gurneys
    updateGurneys();
    
    // Check for morgue deliveries (for skeletons dropped near the morgue)
    checkMorgueDeliveries();
}

// Check for bodies delivered near morgue (precise blue door location)
function checkMorgueDeliveries() {
    for (let i = bodies.length - 1; i >= 0; i--) {
        const body = bodies[i];
        // Check if body is in the morgue delivery zone (precise blue door location)
        if (!body.delivered && 
            body.x > MORGUE_DELIVERY_ZONE.x && 
            body.x < MORGUE_DELIVERY_ZONE.x + MORGUE_DELIVERY_ZONE.width) {
            
            // Mark as delivered, increment score
            body.delivered = true;
            gameState.bodies++;
            gameState.hearseCount++; // Increment for timing progression
            
            // Update max hearses based on new delivery count
            gameState.maxHearses = calculateMaxHearses();
            
            // Remove body after a short delay to show it being "processed"
            setTimeout(() => {
                // Find the body again (it may have moved in the array)
                const index = bodies.findIndex(b => b === body);
                if (index !== -1) {
                    bodies.splice(index, 1);
                }
            }, 1000);
            
            // Schedule next hearse if available
            if (hearses.length < gameState.maxHearses) {
                scheduleHearseArrival();
            }
        }
    }
}

// UPDATED: Update animation frames with smoother carrying animation
function updateAnimation(entity) {
    entity.tickCount++;
    
    if (entity.tickCount > entity.ticksPerFrame) {
        entity.tickCount = 0;
        
        // Get correct animation set and max frames
        let frames;
        let maxFrames = 1;
        
        if (entity === player) {
            switch (player.state) {
                case 'idle': 
                    frames = assets.frames.idle; 
                    maxFrames = frames.length;
                    break;
                case 'running': 
                    frames = assets.frames.running; 
                    maxFrames = frames.length;
                    break;
                case 'carrying': 
                    frames = assets.frames.carrying; 
                    maxFrames = frames.length;
                    // ENSURE SMOOTH CARRYING ANIMATION - reset flicker prevention
                    if (player.frameIndex >= maxFrames) {
                        player.frameIndex = 0;
                    }
                    break;
                case 'pickup': 
                    frames = assets.frames.pickup; 
                    maxFrames = frames.length;
                    break;
                case 'dropping': 
                    frames = assets.frames.dropping; 
                    maxFrames = frames.length;
                    break;
                case 'pushing': 
                    frames = assets.frames.pushing; 
                    maxFrames = frames.length;
                    break;
                case 'tired': 
                    frames = assets.frames.tired; 
                    maxFrames = frames.length;
                    break;
                case 'dying': 
                    frames = assets.frames.dying; 
                    maxFrames = frames.length;
                    break;
                default: 
                    frames = assets.frames.idle; 
                    maxFrames = frames.length;
            }
            
            // Special animations don't loop
            if (player.state === 'pickup' || player.state === 'dropping' || player.state === 'dying') {
                player.frameIndex = Math.min(player.frameIndex + 1, maxFrames - 1);
            } else {
                // SMOOTH LOOPING for carrying and other states
                player.frameIndex = (player.frameIndex + 1) % maxFrames;
            }
        } else {
            // Handle hearse animations
            switch (entity.state) {
                case 'arriving': frames = assets.frames.hearseArriving; break;
                case 'parked': frames = assets.frames.hearseParked; break;
                case 'open': frames = assets.frames.hearseOpen; break; // FIXED: Uses hearse_open.png
                case 'leaving': frames = assets.frames.hearseLeaving; break;
                default: frames = assets.frames.hearseParked;
            }
            
            if (frames && frames.length > 0) {
                entity.frameIndex = (entity.frameIndex + 1) % frames.length;
            }
            
            // Update hearse bounce animation
            if (entity.state === 'arriving' || entity.state === 'leaving') {
                entity.bounceOffset += entity.bounceDirection * 0.5;
                if (Math.abs(entity.bounceOffset) > 2) {
                    entity.bounceDirection *= -1;
                }
            } else {
                entity.bounceOffset = 0;
            }
        }
    }
}

// Update hearse logic
function updateHearse(hearse) {
    switch (hearse.state) {
        case 'arriving':
            hearse.x += hearse.speed;
            if (hearse.x >= hearse.targetParkingX) {
                hearse.x = hearse.targetParkingX;
                hearse.state = 'parked';
                
                // After parking, open the hearse and drop a body/gurney
                // Also change direction to face left (back toward morgue)
                setTimeout(() => {
                    hearse.state = 'open'; // FIXED: This will now use hearse_open.png
                    hearse.facingDirection = 'left'; // UPDATE hearse to face left when open
                    
                    // Automatically drop body/gurney after 1 second
                    setTimeout(() => {
                        if (!hearse.bodyDropped) {
                            dropBodyFromHearse(hearse);
                        }
                    }, 1000);
                }, 1000);
            }
            break;
            
        case 'leaving':
            // Reset facing direction to right when leaving
            hearse.facingDirection = 'right';
            hearse.x -= hearse.speed;
            // Hearse will be removed when it reaches x <= -300 in the main update loop
            break;
    }
}

// Function to drop body or gurney from hearse
function dropBodyFromHearse(hearse) {
    if (hearse.bodyType === 'skeleton') {
        // Drop skeleton body - ADJUSTED for left-facing hearse
        bodies.push({
            x: hearse.x + 40, // Adjusted for left-facing hearse
            y: GROUND_LEVEL - 58, // INCREASED size
            width: 42, // INCREASED from 32 for better scaling
            height: 58, // INCREASED from 48 for better scaling
            direction: 'right', // Start facing right
            delivered: false
        });
        
        // Skeleton hearse can leave immediately after auto-dropping
        setTimeout(() => {
            if (hearse.state === 'open') {
                hearse.state = 'leaving';
            }
        }, 2000); // Give player time to pick up
    } else {
        // Drop gurney with body - ADJUSTED for left-facing hearse
        gurneys.push({
            x: hearse.x + 40, // Adjusted for left-facing hearse
            y: GROUND_LEVEL - 35, // INCREASED size
            width: 74, // INCREASED from 64 for better scaling
            height: 35, // INCREASED from 30 for better scaling
            hasBody: true,
            pushedBy: null
        });
        // Gurney hearse leaves automatically after dropping gurney
        setTimeout(() => {
            if (hearse.state === 'open') {
                hearse.state = 'leaving';
            }
        }, 3000); // Give player time to start moving gurney
    }
    hearse.bodyDropped = true;
}

// UPDATED: Update gurneys to improve pushing/pulling mechanics
function updateGurneys() {
    gurneys.forEach(gurney => {
        if (gurney.pushedBy) {
            // Only move gurney if arrow keys are pressed
            if (gameState.keysPressed['ArrowLeft'] || gameState.keysPressed['ArrowRight']) {
                const moveSpeed = player.stamina > 20 ? player.speed * 0.7 : player.speed * 0.4; // SLOWER when pushing
                
                if (gameState.keysPressed['ArrowLeft']) {
                    gurney.x -= moveSpeed;
                    player.x = gurney.x + gurney.width - 20; // Position player in front of gurney
                    player.direction = 'left';
                } else if (gameState.keysPressed['ArrowRight']) {
                    gurney.x += moveSpeed;
                    player.x = gurney.x - 20; // Position player behind gurney
                    player.direction = 'right';
                }
            }
            
            // Keep gurney and player within screen bounds
            if (gurney.x < 0) {
                gurney.x = 0;
                player.x = gurney.x + (player.direction === 'right' ? -20 : gurney.width - 10);
            }
            if (gurney.x > canvas.width - gurney.width) {
                gurney.x = canvas.width - gurney.width;
                player.x = gurney.x + (player.direction === 'right' ? -20 : gurney.width - 10);
            }
        }
    });
}

// Draw pixelated button with shadow effect
function drawPixelButton(x, y, width, height, text, isHovered) {
    // Button colors - gold theme
    const buttonColor = isHovered ? '#FFD700' : '#DAA520'; // Gold
    const shadowColor = '#8B6914'; // Darker gold for shadow
    const textColor = '#000000'; // Black text
    
    // Draw button shadow (offset down and right)
    ctx.fillStyle = shadowColor;
    ctx.fillRect(x + 4, y + 4, width, height);
    
    // Draw main button
    ctx.fillStyle = buttonColor;
    ctx.fillRect(x, y, width, height);
    
    // Draw button border - pixelated style
    ctx.fillStyle = '#000000';
    ctx.fillRect(x, y, width, 4); // Top
    ctx.fillRect(x, y, 4, height); // Left
    ctx.fillRect(x + width - 4, y, 4, height); // Right
    ctx.fillRect(x, y + height - 4, width, 4); // Bottom
    
    // Draw button text
    ctx.fillStyle = textColor;
    ctx.font = '24px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + width / 2, y + height / 2 + 4);
}

// Draw message at top of screen
function drawMessage(text, y = 80) {
    // Draw background for message
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, y - 15, canvas.width, 30);
    
    // Draw message text
    ctx.fillStyle = '#FFD700'; // Gold
    ctx.font = '16px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(text, canvas.width / 2, y);
}

// Draw intro fade overlay
function drawIntroFadeOverlay() {
    if (gameState.introState === 'fadeOut' || gameState.introState === 'wait' || gameState.introState === 'fadeIn') {
        ctx.fillStyle = `rgba(0, 0, 0, ${gameState.introFadeAlpha})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}
function drawFadeOverlay() {
    if (gameState.fadeState !== 'none') {
        ctx.fillStyle = `rgba(0, 0, 0, ${gameState.fadeAlpha})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

// Render game
function render() {
    // Clear canvas with black to prevent flicker
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Handle intro video phase
    if (gameState.introState === 'video' && gameState.introVideo && gameState.introVideoLoaded) {
        // Draw video to canvas
        ctx.drawImage(gameState.introVideo, 0, 0, canvas.width, canvas.height);
        drawIntroFadeOverlay();
        return;
    }
    
    // Handle intro transitions (fade out, wait, fade in)
    if (gameState.introState !== 'complete') {
        // Show black screen during transitions
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        drawIntroFadeOverlay();
        return;
    }
    
    if (!gameState.showStartScreen && gameState.fadeState === 'none') {
        // Still in intro phase, show black screen
        return;
    }
    
    if (!gameState.started && gameState.fadeState === 'none') {
        // Draw start screen
        if (assets.startBackground.complete && assets.startBackground.naturalWidth !== 0) {
            ctx.drawImage(assets.startBackground, 0, 0, canvas.width, canvas.height);
        } else {
            // Fallback background
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        
        // Draw game title text in gold
        ctx.fillStyle = '#FFD700'; // Gold color
        ctx.font = '48px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText("ROBERTO'S RUSH", canvas.width/2, 200);
        
        // Draw subtitle
        ctx.fillStyle = '#DAA520'; // Darker gold
        ctx.font = '20px "Press Start 2P", monospace';
        ctx.fillText("MORTICIAN ON DUTY", canvas.width/2, 250);
        
        // Draw start button
        drawPixelButton(
            startButton.x, 
            startButton.y, 
            startButton.width, 
            startButton.height, 
            "START", 
            gameState.startButtonHover
        );
        
        // Draw instructions
        ctx.fillStyle = '#FFD700';
        ctx.font = '12px "Press Start 2P", monospace';
        ctx.fillText("PRESS ENTER OR CLICK START", canvas.width/2, 500);
        ctx.fillText("ARROWS: MOVE   F: PICKUP/DROP   G: PUSH/PULL", canvas.width/2, 530);
        
        return;
    }
    
    // Draw background if available (only during game)
    if (gameState.started || gameState.fadeState !== 'none') {
        if (assets.background.complete && assets.background.naturalWidth !== 0) {
            ctx.drawImage(assets.background, 0, 0, canvas.width, canvas.height);
        } else {
            // Fallback background
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        
        if (gameState.started) {
            // Draw gurneys first (behind the player)
            drawGurneys();
            
            // Draw bodies
            drawBodies();
            
            // Draw hearses
            drawHearses();
            
            // Draw player (Roberto)
            drawPlayer();
            
            // Draw UI
            drawUI();
            
            // Draw temporary messages (like "NEW BODY ARRIVED")
            if (gameState.showMessage) {
                drawMessage(gameState.messageText, 80);
            }
            
            // Draw drop prompts when near morgue
            if (gameState.showDropPrompt) {
                drawMessage(gameState.dropPromptText, 110);
            }
            
            // Draw pause or game over screen if needed
            if (gameState.paused) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#FFD700'; // Gold
                ctx.font = '30px "Press Start 2P", monospace';
                ctx.textAlign = 'center';
                ctx.fillText('PAUSED', canvas.width/2, canvas.height/2);
                ctx.font = '16px "Press Start 2P", monospace';
                ctx.fillText('Press P to continue', canvas.width/2, canvas.height/2 + 50);
            }
            
            if (gameState.gameOver) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#FFD700'; // Gold
                ctx.font = '30px "Press Start 2P", monospace';
                ctx.textAlign = 'center';
                ctx.fillText('GAME OVER', canvas.width/2, canvas.height/2 - 80);
                ctx.font = '16px "Press Start 2P", monospace';
                ctx.fillText('Too many bodies piled up!', canvas.width/2, canvas.height/2 - 30);
                ctx.fillText(`Bodies Delivered: ${gameState.bodies}`, canvas.width/2, canvas.height/2 + 20);
                
                // Draw restart button
                drawPixelButton(
                    canvas.width/2 - 100, 
                    canvas.height/2 + 60, 
                    200, 
                    50, 
                    "RESTART", 
                    false
                );
            }
        }
    }
    
    // Always draw fade overlay last
    drawFadeOverlay();
}

// FIXED: Draw player with correct animation frame - smoother carrying animation
function drawPlayer() {
    // Get correct animation set based on state
    let frames;
    let frameIndex = Math.min(player.frameIndex, animations[player.state] ? animations[player.state].length - 1 : 0);
    
    switch (player.state) {
        case 'idle': frames = assets.frames.idle; break;
        case 'running': frames = assets.frames.running; break;
        case 'carrying': frames = assets.frames.carrying; break;
        case 'pickup': frames = assets.frames.pickup; break;
        case 'dropping': frames = assets.frames.dropping; break;
        case 'pushing': frames = assets.frames.pushing; break;
        case 'tired': frames = assets.frames.tired; break;
        case 'dying': frames = assets.frames.dying; break;
        default: frames = assets.frames.idle;
    }
    
    if (!frames || frames.length === 0) {
        frames = assets.frames.idle;
        frameIndex = 0;
    }
    
    // ENSURE VALID FRAME INDEX for smooth animation
    if (frameIndex >= frames.length) {
        frameIndex = 0;
    }
    
    const img = frames[frameIndex];
    
    if (!img || !img.complete || img.naturalWidth === 0) {
        console.warn(`Image not loaded for player state: ${player.state}`);
        // Draw a placeholder rectangle
        ctx.fillStyle = 'red';
        ctx.fillRect(player.x, player.y, player.width, player.height);
        return;
    }
    
    // Draw with proper orientation (and with transparency)
    ctx.save();
    if (player.direction === 'left') {
        // Flip horizontally for left direction
        ctx.translate(player.x + player.width, player.y);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0, player.width, player.height);
    } else {
        ctx.drawImage(img, player.x, player.y, player.width, player.height);
    }
    ctx.restore();
}

// UPDATED: Draw hearses with correct orientation - FIXED to use hearse_open.png
function drawHearses() {
    hearses.forEach(hearse => {
        let frames;
        switch (hearse.state) {
            case 'arriving': frames = assets.frames.hearseArriving; break;
            case 'parked': frames = assets.frames.hearseParked; break;
            case 'open': frames = assets.frames.hearseOpen; break; // FIXED: Now properly uses hearse_open.png
            case 'leaving': frames = assets.frames.hearseLeaving; break;
            default: frames = assets.frames.hearseParked;
        }
        
        if (!frames || frames.length === 0) {
            console.error(`No frames found for hearse state: ${hearse.state}`);
            return;
        }
        
        const img = frames[hearse.frameIndex % frames.length];
        
        if (!img || !img.complete || img.naturalWidth === 0) {
            // Draw a placeholder rectangle
            ctx.fillStyle = 'blue';
            ctx.fillRect(hearse.x, hearse.y, hearse.width, hearse.height);
            return;
        }
        
        // Draw hearse with proper orientation (facing left when open)
        ctx.save();
        if (hearse.facingDirection === 'left') {
            // Flip horizontally for left direction
            ctx.translate(hearse.x + hearse.width, hearse.y + hearse.bounceOffset);
            ctx.scale(-1, 1);
            ctx.drawImage(img, 0, 0, hearse.width, hearse.height);
        } else {
            ctx.drawImage(
                img, 
                hearse.x, 
                hearse.y + hearse.bounceOffset, 
                hearse.width, 
                hearse.height
            );
        }
        ctx.restore();
    });
}

// Draw bodies
function drawBodies() {
    bodies.forEach(body => {
        const img = assets.frames.skeleton[0];
        if (img && img.complete && img.naturalWidth !== 0) {
            // Draw with proper orientation based on body's direction
            ctx.save();
            if (body.direction === 'left') {
                // Flip horizontally for left direction
                ctx.translate(body.x + body.width, body.y);
                ctx.scale(-1, 1);
                ctx.drawImage(img, 0, 0, body.width, body.height);
            } else {
                ctx.drawImage(img, body.x, body.y, body.width, body.height);
            }
            ctx.restore();
        } else {
            // Placeholder
            ctx.fillStyle = 'white';
            ctx.fillRect(body.x, body.y, body.width, body.height);
        }
    });
}

// Draw gurneys
function drawGurneys() {
    gurneys.forEach((gurney, index) => {
        // Alternate between the two gurney frames for slight animation
        const frameIndex = Math.floor(gameState.time * 2 + index) % 2;
        const img = gurney.hasBody ? 
            assets.frames.gurneyBody[0] : 
            assets.frames.gurneyEmpty[Math.min(frameIndex, assets.frames.gurneyEmpty.length - 1)];
            
        if (img && img.complete && img.naturalWidth !== 0) {
            ctx.drawImage(img, gurney.x, gurney.y, gurney.width, gurney.height);
        } else {
            // Placeholder
            ctx.fillStyle = 'gray';
            ctx.fillRect(gurney.x, gurney.y, gurney.width, gurney.height);
        }
    });
}

// Draw UI with pixel font
function drawUI() {
    // Draw stats box in top left
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(10, 10, 200, 60);
    
    // Use pixel font for UI text
    ctx.fillStyle = '#FFD700'; // Gold text
    ctx.font = '16px "Press Start 2P", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Bodies: ${gameState.bodies}`, 20, 30);
    
    // Format time as MM:SS
    const minutes = Math.floor(gameState.time / 60);
    const seconds = Math.floor(gameState.time % 60);
    const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    ctx.fillText(`Time: ${formattedTime}`, 20, 55);
    
    // Draw stamina bar in top right (exact position as in your screenshot)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(canvas.width - 210, 10, 200, 25);
    
    // Red stamina bar as shown in your screenshot
    const staminaColor = '#f33';
    ctx.fillStyle = staminaColor;
    ctx.fillRect(canvas.width - 210, 10, player.stamina * 2, 25);
    
    ctx.strokeStyle = 'white';
    ctx.strokeRect(canvas.width - 210, 10, 200, 25);
    
    // Retro pixel text for stamina
    ctx.fillStyle = '#FFD700'; // Gold
    ctx.font = '12px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('STAMINA', canvas.width - 110, 26);
}

// Handle restart on game over
window.addEventListener('keydown', (e) => {
    if (gameState.gameOver && e.key === 'r') {
        restartGame();
    }
});

// Click handler for restart button
canvas.addEventListener('click', (e) => {
    if (!gameState.gameOver) return;
    
    // Get canvas-relative coordinates
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Check if click is on the restart button
    const restartButton = {
        x: canvas.width/2 - 100,
        y: canvas.height/2 + 60,
        width: 200,
        height: 50
    };
    
    if (mouseX >= restartButton.x && 
        mouseX <= restartButton.x + restartButton.width &&
        mouseY >= restartButton.y && 
        mouseY <= restartButton.y + restartButton.height) {
        restartGame();
    }
});

// Restart game function
function restartGame() {
    // Reset game state
    Object.assign(gameState, {
        bodies: 0,
        bodiesPiled: 0,
        time: 0,
        level: 1,
        gameOver: false,
        paused: false,
        started: true, // Start immediately on restart
        keysPressed: {}, // Reset pressed keys
        showMessage: false,
        messageText: '',
        messageTimer: 0,
        showDropPrompt: false,
        dropPromptText: '',
        hearseTimer: 3000,
        hearseTimerBase: 3000,
        hearseTimerIncrease: 500,
        hearseCount: 0,
        fadeState: 'none',
        fadeAlpha: 0,
        fadeTimer: 0,
        maxHearses: 1,
        themePlayedOnStartScreen: true // Keep theme playing on restart
    });
    
    // Reset player
    Object.assign(player, {
        x: 400,
        y: GROUND_LEVEL - 68, // Adjusted for increased size
        direction: 'right',
        state: 'idle',
        frameIndex: 0,
        tickCount: 0,
        carrying: false,
        pushingGurney: false,
        interactionCooldown: 0,
        stamina: 100,
        tiredBlinkCounter: 0,
        isDying: false,
        lastX: 400
    });
    
    // Clear bodies and gurneys
    bodies.length = 0;
    gurneys.length = 0;
    
    // Clear hearses
    hearses.length = 0;
    
    // Start new hearse arrival
    scheduleHearseArrival();
}

// Handle visibility change (pause when tab is not active)
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        gameState.paused = true;
    }
});

// Add debugging info to help troubleshoot
console.log("Roberto's Rush - Game Script Loaded");

// Try to load the pixel font for 8-bit style text
// This creates a link to a Google Font that looks similar to 8-bit text
const fontLink = document.createElement('link');
fontLink.href = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap';
fontLink.rel = 'stylesheet';
document.head.appendChild(fontLink);

// Start loading assets
loadAssets();