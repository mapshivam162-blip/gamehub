// Hill Climb Racing — 2D Physics Driving Engine
// Built for Khelog

(function () {
  'use strict';

  // --- Canvas & Context ---
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  // --- UI Elements ---
  const hudCoins = document.getElementById('hud-coins');
  const hudGems = document.getElementById('hud-gems');
  const hudDist = document.getElementById('hud-dist');
  const fuelBar = document.getElementById('fuel-bar');
  const fuelPct = document.getElementById('fuel-pct');
  const speedMeter = document.getElementById('speed-meter');
  const airBonusEl = document.getElementById('air-bonus');

  const startOverlay = document.getElementById('start-overlay');
  const gameoverOverlay = document.getElementById('gameover-overlay');
  const gameoverTitle = document.getElementById('gameover-title');
  const gameoverReason = document.getElementById('gameover-reason');
  const resDist = document.getElementById('res-dist');
  const resCoins = document.getElementById('res-coins');
  const resBest = document.getElementById('res-best');

  const playBtn = document.getElementById('play-btn');
  const retryBtn = document.getElementById('retry-btn');
  const restartBtn = document.getElementById('restart-btn');
  const cheatBtn = document.getElementById('cheat-btn');
  const garageCheatBtn = document.getElementById('garage-cheat-btn');
  const garageBtn = document.getElementById('garage-btn');
  const openGarageStart = document.getElementById('open-garage-start');
  const openGarageEnd = document.getElementById('open-garage-end');
  const closeGarage = document.getElementById('close-garage');
  const garageModal = document.getElementById('garage-modal');
  const garageStartDrive = document.getElementById('garage-start-drive');
  const soundBtn = document.getElementById('sound-btn');

  const pedalGas = document.getElementById('pedal-gas');
  const pedalBrake = document.getElementById('pedal-brake');

  // Garage wallet & buttons
  const garageCoins = document.getElementById('garage-coins');
  const garageGems = document.getElementById('garage-gems');

  // --- Audio Engine (Web Audio API) ---
  let audioCtx = null;
  let soundEnabled = true;
  let engineOsc = null;
  let engineGain = null;

  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
        createEngineSound();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function createEngineSound() {
    if (!audioCtx || engineOsc) return;
    try {
      engineOsc = audioCtx.createOscillator();
      engineGain = audioCtx.createGain();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.setValueAtTime(55, audioCtx.currentTime);

      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(350, audioCtx.currentTime);

      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(audioCtx.destination);
      engineGain.gain.setValueAtTime(0, audioCtx.currentTime);
      engineOsc.start();
    } catch (e) {
      console.warn('Audio init error', e);
    }
  }

  function updateEngineSound(throttle, speed, airborne) {
    if (!soundEnabled || !engineGain || !engineOsc) return;
    const baseFreq = 50;
    const maxFreq = 220;
    const targetFreq = baseFreq + Math.abs(speed) * 4 + (throttle ? 60 : 0);
    const targetGain = throttle ? 0.08 : 0.03;

    engineOsc.frequency.setTargetAtTime(Math.min(targetFreq, maxFreq), audioCtx.currentTime, 0.05);
    engineGain.gain.setTargetAtTime(targetGain, audioCtx.currentTime, 0.05);
  }

  function stopEngineSound() {
    if (engineGain) {
      engineGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.1);
    }
  }

  function playTone(freq, type, duration, vol = 0.1) {
    if (!soundEnabled || !audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(vol, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {}
  }

  function playCoinSound() {
    initAudio();
    playTone(987, 'sine', 0.12, 0.15);
    setTimeout(() => playTone(1318, 'sine', 0.18, 0.15), 60);
  }

  function playGemSound() {
    initAudio();
    [523, 659, 784, 1046].forEach((f, i) => {
      setTimeout(() => playTone(f, 'triangle', 0.15, 0.12), i * 50);
    });
  }

  function playFuelSound() {
    initAudio();
    playTone(220, 'sine', 0.1, 0.2);
    setTimeout(() => playTone(440, 'sine', 0.2, 0.25), 80);
  }

  function playBonusSound() {
    initAudio();
    [440, 554, 659, 880].forEach((f, i) => {
      setTimeout(() => playTone(f, 'sine', 0.2, 0.15), i * 60);
    });
  }

  function playCrashSound() {
    initAudio();
    playTone(90, 'sawtooth', 0.4, 0.3);
  }

  // --- Persistent Storage & Stats ---
  const saveKey = 'gamehub_hillclimb_data';
  let gameData = {
    coins: 1500,
    gems: 10,
    bestDist: 0,
    vehicle: 'jeep',
    ownedVehicles: ['jeep'],
    upgrades: {
      engine: 1,
      suspension: 1,
      tires: 1,
      fourwd: 1,
    },
  };

  // --- Vehicles ---
  const VEHICLES = {
    jeep: {
      name: 'Offroad Jeep',
      emoji: '🚙',
      color: '#dc2626',
      dark: '#991b1b',
      wheelRadius: 16,
      wheelBase: 44,
      powerMul: 1,
      price: 0,
    },
    monster: {
      name: 'Monster Truck',
      emoji: '🛻',
      color: '#2563eb',
      dark: '#1e40af',
      wheelRadius: 22,
      wheelBase: 52,
      powerMul: 1.3,
      price: 2500,
    },
  };

  function applyVehicle() {
    const v = VEHICLES[gameData.vehicle] || VEHICLES.jeep;
    car.wheelRadius = v.wheelRadius;
    car.wheelBase = v.wheelBase;
  }

  function loadData() {
    try {
      const raw = localStorage.getItem(saveKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        gameData = { ...gameData, ...parsed };
      }
    } catch (e) {}
    updateHUD();
  }

  function saveData() {
    try {
      localStorage.setItem(saveKey, JSON.stringify(gameData));
    } catch (e) {}
    updateHUD();
  }

  function updateHUD() {
    if (hudCoins) hudCoins.textContent = gameData.coins.toLocaleString('en-IN');
    if (hudGems) hudGems.textContent = gameData.gems.toLocaleString('en-IN');
    if (garageCoins) garageCoins.textContent = gameData.coins.toLocaleString('en-IN');
    if (garageGems) garageGems.textContent = gameData.gems.toLocaleString('en-IN');
    renderGarage();
  }

  // --- Cheats Feature (999,999 Coins & Gems) ---
  function applyCheat999k() {
    gameData.coins = 999999;
    gameData.gems = 999999;
    saveData();
    playGemSound();
    showBonus('⚡ 999,999 COINS & GEMS!');
  }

  cheatBtn.addEventListener('click', applyCheat999k);
  garageCheatBtn.addEventListener('click', applyCheat999k);

  // --- Upgrade Prices & Config ---
  const upgradeConfig = {
    engine: { name: 'Engine', max: 10, baseCost: 500, mult: 1.8, currency: 'coins' },
    suspension: { name: 'Suspension', max: 10, baseCost: 400, mult: 1.7, currency: 'coins' },
    tires: { name: 'Tires', max: 10, baseCost: 450, mult: 1.75, currency: 'coins' },
    fourwd: { name: '4WD', max: 10, baseCost: 5, mult: 2.0, currency: 'gems' },
  };

  function getUpgradeCost(type) {
    const cfg = upgradeConfig[type];
    const lvl = gameData.upgrades[type];
    if (lvl >= cfg.max) return null;
    return Math.round(cfg.baseCost * Math.pow(cfg.mult, lvl - 1));
  }

  function buyUpgrade(type) {
    const cost = getUpgradeCost(type);
    if (cost === null) return;
    const cfg = upgradeConfig[type];

    if (cfg.currency === 'coins' && gameData.coins >= cost) {
      gameData.coins -= cost;
      gameData.upgrades[type]++;
      saveData();
      playCoinSound();
    } else if (cfg.currency === 'gems' && gameData.gems >= cost) {
      gameData.gems -= cost;
      gameData.upgrades[type]++;
      saveData();
      playGemSound();
    } else {
      showBonus('NOT ENOUGH ' + cfg.currency.toUpperCase() + '!');
    }
  }

  function renderGarage() {
    ['engine', 'suspension', 'tires', 'fourwd'].forEach((type) => {
      const lvl = gameData.upgrades[type];
      const cfg = upgradeConfig[type];
      const lvlEl = document.getElementById(`lvl-${type}`);
      const barEl = document.getElementById(`bar-${type}`);
      const costEl = document.getElementById(`cost-${type}`);
      const btnEl = document.getElementById(`btn-up-${type}`);

      if (lvlEl) lvlEl.textContent = `Level ${lvl} / ${cfg.max}`;
      if (barEl) barEl.style.width = `${(lvl / cfg.max) * 100}%`;

      const cost = getUpgradeCost(type);
      if (cost === null) {
        if (costEl) costEl.textContent = 'MAXED';
        if (btnEl) btnEl.disabled = true;
      } else {
        if (costEl) costEl.textContent = cost.toLocaleString('en-IN');
        if (btnEl) {
          btnEl.disabled = false;
          btnEl.onclick = () => buyUpgrade(type);
        }
      }
    });
  }

  // --- Terrain Generator ---
  function getTerrainHeight(x) {
    if (x < 0) return 320;
    // Layered sine curves that get steeper further out
    const difficulty = 1 + Math.min(x / 4000, 1.8);
    const hill1 = Math.sin(x * 0.003) * 65 * difficulty;
    const hill2 = Math.sin(x * 0.009) * 40;
    const hill3 = Math.sin(x * 0.0012) * 85 * difficulty;
    const bumps = Math.sin(x * 0.04) * 5;
    return 330 + hill1 + hill2 + hill3 + bumps;
  }

  function getTerrainAngle(x) {
    const dx = 4;
    const y1 = getTerrainHeight(x - dx);
    const y2 = getTerrainHeight(x + dx);
    return Math.atan2(y2 - y1, dx * 2);
  }

  // --- Physics & Vehicle State ---
  let isPlaying = false;
  let isGameOver = false;
  let runCoinsEarned = 0;
  let runDistance = 0;
  let fuel = 100;

  // Car Body State
  const car = {
    x: 100,
    y: 200,
    vx: 0,
    vy: 0,
    angle: 0,
    vAngle: 0,
    wheelBase: 44,
    wheelRadius: 16,
    airTime: 0,
    airRotation: 0,
    // Driver head
    headOffset: { x: -6, y: -26 },
    headDamperY: 0,
    rearGrounded: false,
    frontGrounded: false,
  };

  // Particles
  const particles = [];
  function addDirt(x, y, vx, vy) {
    if (particles.length > 80) return;
    particles.push({
      x,
      y,
      vx: vx + (Math.random() - 0.5) * 2,
      vy: vy - Math.random() * 2,
      radius: 2 + Math.random() * 3,
      alpha: 1,
      color: '#8b5a2b',
    });
  }

  // Collectibles along track
  let items = [];
  function generateItems() {
    items = [];
    // Generate coins, gems, fuels from 0m to 10,000m
    for (let x = 180; x < 15000; x += 18) {
      const groundY = getTerrainHeight(x);

      // Fuel cans every ~95 meters (950 px)
      if (x > 300 && Math.floor(x) % 920 < 25) {
        items.push({ type: 'fuel', x, y: groundY - 32, taken: false });
        x += 80;
        continue;
      }

      // Gems in steep dips/peaks every ~450 px
      if (x > 200 && Math.floor(x) % 460 < 20) {
        items.push({ type: 'gem', x, y: groundY - 35, taken: false });
        x += 40;
        continue;
      }

      // Coins in arcs
      if (Math.floor(x) % 180 < 100) {
        const arc = Math.sin(((x % 180) / 100) * Math.PI) * 25;
        items.push({ type: 'coin', val: 25, x, y: groundY - 26 - arc, taken: false });
      }
    }
  }

  // --- Input State ---
  const input = {
    gas: false,
    brake: false,
  };

  // Touch pedals
  function bindTouch(btn, prop) {
    const activate = (e) => {
      e.preventDefault();
      input[prop] = true;
      btn.classList.add('active');
      initAudio();
    };
    const deactivate = (e) => {
      e.preventDefault();
      input[prop] = false;
      btn.classList.remove('active');
    };
    btn.addEventListener('pointerdown', activate);
    btn.addEventListener('pointerup', deactivate);
    btn.addEventListener('pointercancel', deactivate);
    // touch fallback (kuch phones pe pointer events scroll cancel ho jate hain)
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); activate(e); }, { passive: false });
    btn.addEventListener('touchend', (e) => { e.preventDefault(); deactivate(e); }, { passive: false });
    btn.addEventListener('touchcancel', (e) => { e.preventDefault(); deactivate(e); }, { passive: false });
  }
  bindTouch(pedalGas, 'gas');
  bindTouch(pedalBrake, 'brake');

  // Keyboard controls
  window.addEventListener('keydown', (e) => {
    initAudio();
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') input.gas = true;
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') input.brake = true;
    if (e.key === ' ') input.brake = true;
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') input.gas = false;
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') input.brake = false;
    if (e.key === ' ') input.brake = false;
  });

  // Sound toggle
  soundBtn.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    soundBtn.textContent = soundEnabled ? '🔊' : '🔇';
    if (!soundEnabled) stopEngineSound();
  });

  // Popups / Bonus UI
  let bonusTimer = null;
  function showBonus(text) {
    if (!airBonusEl) return;
    airBonusEl.textContent = text;
    airBonusEl.classList.add('show');
    clearTimeout(bonusTimer);
    bonusTimer = setTimeout(() => {
      airBonusEl.classList.remove('show');
    }, 1200);
  }

  // --- Reset & Start Game ---
  function startGame() {
    initAudio();
    applyVehicle();
    car.x = 80;
    car.y = getTerrainHeight(80) - 40;
    car.vx = 0;
    car.vy = 0;
    car.angle = 0;
    car.vAngle = 0;
    car.airTime = 0;
    car.airRotation = 0;
    car.headDamperY = 0;
    car.safeTimer = 1.0;

    fuel = 100;
    runCoinsEarned = 0;
    runDistance = 0;
    isGameOver = false;
    isPlaying = true;

    generateItems();
    startOverlay.classList.remove('active');
    gameoverOverlay.classList.remove('active');
    garageModal.classList.remove('active');
  }

  function triggerGameOver(reason) {
    if (isGameOver) return;
    isGameOver = true;
    isPlaying = false;
    stopEngineSound();
    playCrashSound();

    // Save earned stats
    gameData.coins += runCoinsEarned;
    if (runDistance > gameData.bestDist) {
      gameData.bestDist = runDistance;
    }
    saveData();

    // Populate modal
    gameoverTitle.textContent = reason.includes('Fuel') ? 'OUT OF FUEL!' : 'DRIVER DOWN!';
    gameoverReason.textContent = reason;
    resDist.textContent = `${runDistance}m`;
    resCoins.textContent = `+${runCoinsEarned}`;
    resBest.textContent = `${gameData.bestDist}m`;

    setTimeout(() => {
      gameoverOverlay.classList.add('active');
    }, 400);
  }

  // Modal interactions
  playBtn.addEventListener('click', startGame);
  retryBtn.addEventListener('click', startGame);
  restartBtn.addEventListener('click', startGame);

  function openGarageView() {
    garageModal.classList.add('active');
    renderGarage();
    refreshVehicleUI();
  }
  garageBtn.addEventListener('click', openGarageView);

  // --- Vehicle selection ---
  function refreshVehicleUI() {
    document.querySelectorAll('.vehicle-card').forEach((card) => {
      const vid = card.dataset.vehicle;
      const v = VEHICLES[vid];
      const owned = gameData.ownedVehicles.includes(vid);
      const selected = gameData.vehicle === vid;
      card.classList.toggle('selected', selected);
      card.classList.toggle('locked', !owned);
      const priceEl = card.querySelector('[data-role="price"]');
      if (priceEl) priceEl.textContent = selected ? '✓ SELECTED' : (owned ? 'OWNED' : '🪙 ' + v.price.toLocaleString('en-IN'));
    });
  }
  document.querySelectorAll('.vehicle-card').forEach((card) => {
    card.addEventListener('click', () => {
      const vid = card.dataset.vehicle;
      const v = VEHICLES[vid];
      if (!v) return;
      if (gameData.ownedVehicles.includes(vid)) {
        gameData.vehicle = vid;
      } else if (gameData.coins >= v.price) {
        gameData.coins -= v.price;
        gameData.ownedVehicles.push(vid);
        gameData.vehicle = vid;
      } else {
        const priceEl = card.querySelector('[data-role="price"]');
        if (priceEl) {
          priceEl.textContent = ' Coins kam!';
          priceEl.style.color = '#f87171';
          setTimeout(() => { priceEl.style.color = ''; refreshVehicleUI(); }, 1200);
        }
        return;
      }
      saveData();
      updateHUD();
      refreshVehicleUI();
      applyVehicle();
    });
  });
  openGarageStart.addEventListener('click', openGarageView);
  openGarageEnd.addEventListener('click', openGarageView);
  closeGarage.addEventListener('click', () => garageModal.classList.remove('active'));
  garageStartDrive.addEventListener('click', () => {
    garageModal.classList.remove('active');
    startGame();
  });

  // --- Physics Update Loop ---
  function updatePhysics(dt) {
    if (!isPlaying) return;

    // Upgrades modifiers
    const enginePower = (0.38 + gameData.upgrades.engine * 0.055) * ((VEHICLES[gameData.vehicle] || VEHICLES.jeep).powerMul || 1);
    const suspStiffness = 0.18 + gameData.upgrades.suspension * 0.02;
    const tireGrip = 0.88 + gameData.upgrades.tires * 0.02;
    const is4WD = gameData.upgrades.fourwd > 1;

    // Gravity
    car.vy += 0.28;

    // Compute wheel positions
    const cosA = Math.cos(car.angle);
    const sinA = Math.sin(car.angle);

    const rearOffset = -car.wheelBase * 0.5;
    const frontOffset = car.wheelBase * 0.5;

    const rwx = car.x + rearOffset * cosA - 12 * -sinA;
    const rwy = car.y + rearOffset * sinA + 12 * cosA;

    const fwx = car.x + frontOffset * cosA - 12 * -sinA;
    const fwy = car.y + frontOffset * sinA + 12 * cosA;

    const rGround = getTerrainHeight(rwx);
    const fGround = getTerrainHeight(fwx);

    // Wheel-Ground Collision with Hard Penetration Resolution
    const rPen = (rwy + car.wheelRadius) - rGround;
    const fPen = (fwy + car.wheelRadius) - fGround;

    car.rearGrounded = rPen >= 0;
    car.frontGrounded = fPen >= 0;

    if (car.rearGrounded) {
      // Hard clamp: push chassis up directly so wheel stays above ground
      car.y -= rPen * 0.7;
      if (car.vy > 0) car.vy *= 0.2;
      car.vy -= rPen * 0.15;

      // Traction on slope
      const rSlope = getTerrainAngle(rwx);
      if (input.gas && fuel > 0) {
        const drive = enginePower * tireGrip * 1.25;
        car.vx += Math.cos(rSlope) * drive;
        car.vy += Math.sin(rSlope) * drive;
        addDirt(rwx, rGround, -Math.cos(rSlope) * 3, -2);
      }
      if (input.brake) {
        car.vx *= 0.92;
      }
    }

    if (car.frontGrounded) {
      // Hard clamp: push chassis up directly so wheel stays above ground
      car.y -= fPen * 0.7;
      if (car.vy > 0) car.vy *= 0.2;
      car.vy -= fPen * 0.15;

      // 4WD Traction on slope
      const fSlope = getTerrainAngle(fwx);
      if (input.gas && is4WD && fuel > 0) {
        const drive = enginePower * 0.7 * tireGrip * 1.25;
        car.vx += Math.cos(fSlope) * drive;
        car.vy += Math.sin(fSlope) * drive;
        addDirt(fwx, fGround, -Math.cos(fSlope) * 3, -2);
      }
      if (input.brake) {
        car.vx *= 0.92;
      }
    }

    // Chassis angle alignment when wheels touch ground
    if (car.rearGrounded && car.frontGrounded) {
      const groundPitch = Math.atan2((fGround - car.wheelRadius) - (rGround - car.wheelRadius), car.wheelBase);
      car.angle += (groundPitch - car.angle) * 0.25;
      car.vAngle *= 0.4;
    } else if (car.rearGrounded) {
      const rSlope = getTerrainAngle(rwx);
      car.vAngle += (rSlope - car.angle) * 0.12;
    } else if (car.frontGrounded) {
      const fSlope = getTerrainAngle(fwx);
      car.vAngle += (fSlope - car.angle) * 0.12;
    }

    // Absolute Floor Guard (Prevents sinking under any circumstance!)
    const midGround = getTerrainHeight(car.x);
    if (car.y > midGround - car.wheelRadius - 6) {
      car.y = midGround - car.wheelRadius - 6;
      if (car.vy > 0) car.vy = 0;
    }

    // In-Air Tilt Controls & Flip Detection
    const bothAir = !car.rearGrounded && !car.frontGrounded;
    if (bothAir) {
      car.airTime += dt;
      const airTorque = 0.038;
      if (input.gas) car.vAngle += airTorque;
      if (input.brake) car.vAngle -= airTorque;

      // Flip counter
      car.airRotation += car.vAngle;
      if (car.airRotation >= Math.PI * 2) {
        car.airRotation -= Math.PI * 2;
        runCoinsEarned += 1000;
        playBonusSound();
        showBonus('🔥 FRONTFLIP! +1,000');
      } else if (car.airRotation <= -Math.PI * 2) {
        car.airRotation += Math.PI * 2;
        runCoinsEarned += 1000;
        playBonusSound();
        showBonus('⭐ BACKFLIP! +1,000');
      }
    } else {
      if (car.airTime > 1.2) {
        const airReward = Math.round(car.airTime * 200);
        runCoinsEarned += airReward;
        showBonus(`AIR TIME ${car.airTime.toFixed(1)}s! +${airReward}`);
      }
      car.airTime = 0;
      car.airRotation = 0;
    }

    // Damping & Position integrate
    car.vx *= 0.992;
    car.vy *= 0.995;
    car.vAngle *= 0.94;

    car.x += car.vx;
    car.y += car.vy;
    car.angle += car.vAngle;

    if (car.safeTimer > 0) {
      car.safeTimer -= dt;
    }

    // Driver Head & Crash Check (Only when upside down / rolled over!)
    const currentCos = Math.cos(car.angle);
    const currentSin = Math.sin(car.angle);
    const headX = car.x + car.headOffset.x * currentCos - car.headOffset.y * currentSin;
    const headY = car.y + car.headOffset.x * currentSin + car.headOffset.y * currentCos + car.headDamperY;
    const headGround = getTerrainHeight(headX);

    // Springy head damping
    car.headDamperY = Math.sin(Date.now() * 0.015) * 1.5;

    // Neck break collision: only if vehicle is actually upside down
    const isUpsideDown = currentCos < 0.25;
    if (car.safeTimer <= 0 && isUpsideDown && headY >= headGround - 4) {
      triggerGameOver('DRIVER DOWN! Neck snap!');
      return;
    }

    // Fuel depletion
    if (fuel > 0) {
      fuel -= dt * 2.8 * (input.gas ? 1.6 : 0.8);
      if (fuel < 0) fuel = 0;
    } else {
      // Out of fuel
      if (Math.abs(car.vx) < 0.25 && car.rearGrounded) {
        triggerGameOver('OUT OF FUEL! Tank is empty.');
        return;
      }
    }

    // Item pickups
    const collectDist = 34;
    items.forEach((item) => {
      if (item.taken) return;
      const dx = car.x - item.x;
      const dy = car.y - item.y;
      if (Math.hypot(dx, dy) < collectDist) {
        item.taken = true;
        if (item.type === 'coin') {
          runCoinsEarned += item.val;
          playCoinSound();
        } else if (item.type === 'gem') {
          runCoinsEarned += 2500;
          gameData.gems += 1;
          saveData();
          playGemSound();
          showBonus('💎 GEM COLLECTED! +1 GEM');
        } else if (item.type === 'fuel') {
          fuel = 100;
          playFuelSound();
          showBonus('⛽ FUEL 100%!');
        }
      }
    });

    // Distance calculation
    runDistance = Math.max(runDistance, Math.round(car.x / 10));

    // Engine Audio
    updateEngineSound(input.gas, car.vx, bothAir);

    // Update HUD
    hudDist.textContent = `${runDistance}m`;
    hudCoins.textContent = (gameData.coins + runCoinsEarned).toLocaleString('en-IN');
    fuelBar.style.width = `${fuel}%`;
    fuelPct.textContent = `${Math.round(fuel)}%`;
    if (fuel < 20) {
      fuelBar.classList.add('critical');
    } else {
      fuelBar.classList.remove('critical');
    }

    const kmh = Math.round(Math.abs(car.vx) * 12);
    speedMeter.textContent = kmh;
  }

  // --- Rendering Loop ---
  function render() {
    ctx.clearRect(0, 0, 800, 450);

    const cameraX = car.x - 800 * 0.32;
    const cameraY = car.y - 450 * 0.62;

    ctx.save();
    ctx.translate(-cameraX, -cameraY);

    // 1. Sky & Parallax Mountains
    drawSkyAndMountains(cameraX, cameraY, 800, 450);

    // 2. Terrain & Ground
    drawTerrain(cameraX, cameraY, 800, 450);

    // 3. Items / Collectibles
    drawItems(cameraX, 800);

    // 4. Particles (dirt smoke)
    drawParticles();

    // 5. Car Body, Wheels & Driver
    drawCar();

    ctx.restore();
  }

  function drawSkyAndMountains(camX, camY, viewW, viewH) {
    // 1. Sky Gradient
    const skyGrad = ctx.createLinearGradient(0, camY, 0, camY + viewH);
    skyGrad.addColorStop(0, '#38bdf8');
    skyGrad.addColorStop(0.6, '#7dd3fc');
    skyGrad.addColorStop(1, '#bae6fd');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(camX, camY, viewW, viewH);

    // 2. Cartoon Sun
    const sunX = camX + viewW * 0.82;
    const sunY = camY + 45;
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(253, 224, 71, 0.25)';
    ctx.beginPath();
    ctx.arc(sunX, sunY, 38, 0, Math.PI * 2);
    ctx.fill();

    // 3. Fluffy Clouds (parallax)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
    [0.1, 0.45, 0.8, 1.2, 1.6, 2.0].forEach((f, i) => {
      const cx = ((camX * 0.25 + f * 950) % (viewW + 200)) + camX - 100;
      const cy = camY + 30 + (i % 3) * 18;
      drawCloud(cx, cy, 26 + (i % 2) * 12);
    });

    // 4. Distant Green Hills Parallax
    ctx.fillStyle = '#86efac';
    ctx.beginPath();
    ctx.moveTo(camX, camY + viewH);
    for (let x = camX; x <= camX + viewW + 100; x += 50) {
      const my = camY + viewH * 0.55 + Math.sin(x * 0.0015) * 35;
      ctx.lineTo(x, my);
    }
    ctx.lineTo(camX + viewW, camY + viewH);
    ctx.closePath();
    ctx.fill();

    // 5. Midground Hills Parallax
    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.moveTo(camX, camY + viewH);
    for (let x = camX; x <= camX + viewW + 60; x += 35) {
      const hy = camY + viewH * 0.65 + Math.sin(x * 0.0025 + 2) * 28;
      ctx.lineTo(x, hy);
    }
    ctx.lineTo(camX + viewW, camY + viewH);
    ctx.closePath();
    ctx.fill();
  }

  function drawCloud(x, y, size) {
    ctx.beginPath();
    ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
    ctx.arc(x + size * 0.35, y - size * 0.2, size * 0.45, 0, Math.PI * 2);
    ctx.arc(x + size * 0.7, y, size * 0.4, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
  }

  function drawTerrain(camX, camY, viewW, viewH) {
    const startX = Math.floor(camX - 50);
    const endX = Math.ceil(camX + viewW + 50);
    const step = 8;
    const bottomY = camY + viewH + 400;

    // 1. Rich Brown Soil Fill
    ctx.fillStyle = '#854d0e';
    ctx.beginPath();
    ctx.moveTo(startX, bottomY);
    for (let x = startX; x <= endX; x += step) {
      ctx.lineTo(x, getTerrainHeight(x));
    }
    ctx.lineTo(endX, bottomY);
    ctx.closePath();
    ctx.fill();

    // 2. Darker Deep Bedrock Layer
    ctx.fillStyle = '#543306';
    ctx.beginPath();
    ctx.moveTo(startX, bottomY);
    for (let x = startX; x <= endX; x += step) {
      ctx.lineTo(x, getTerrainHeight(x) + 35);
    }
    ctx.lineTo(endX, bottomY);
    ctx.closePath();
    ctx.fill();

    // 3. Thick Lush Green Grass Top Ribbon
    ctx.strokeStyle = '#16a34a';
    ctx.lineWidth = 12;
    ctx.beginPath();
    for (let x = startX; x <= endX; x += step) {
      const y = getTerrainHeight(x);
      if (x === startX) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Bright lime highlight on grass edge
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    for (let x = startX; x <= endX; x += step) {
      const y = getTerrainHeight(x) - 3;
      if (x === startX) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Checkpoint poles at milestone markers
    [100, 250, 500, 1000, 2000, 5000].forEach((dist) => {
      const flagX = dist * 10;
      if (flagX >= startX && flagX <= endX) {
        const flagY = getTerrainHeight(flagX);
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(flagX, flagY - 60, 4, 60);

        // Checkered flag
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(flagX + 4, flagY - 60);
        ctx.lineTo(flagX + 30, flagY - 48);
        ctx.lineTo(flagX + 4, flagY - 36);
        ctx.fill();

        ctx.fillStyle = '#1e293b';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(`${dist}m`, flagX - 8, flagY - 65);
      }
    });
  }

  function drawItems(camX, viewW) {
    const minX = camX - 30;
    const maxX = camX + viewW + 30;

    items.forEach((item) => {
      if (item.taken || item.x < minX || item.x > maxX) return;

      ctx.save();
      ctx.translate(item.x, item.y);

      if (item.type === 'coin') {
        // Glowing gold coin
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#78350f';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', 0, 0);
      } else if (item.type === 'gem') {
        // Shiny Diamond Gem
        ctx.fillStyle = '#ec4899';
        ctx.beginPath();
        ctx.moveTo(0, -12);
        ctx.lineTo(10, -4);
        ctx.lineTo(6, 10);
        ctx.lineTo(-6, 10);
        ctx.lineTo(-10, -4);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else if (item.type === 'fuel') {
        // Red Gas Canister
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-8, -12, 16, 20);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-8, -12, 16, 20);

        // Handle & Cap
        ctx.fillStyle = '#334155';
        ctx.fillRect(-4, -16, 8, 4);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 8px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('GAS', 0, -2);
      }

      ctx.restore();
    });
  }

  function drawParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.03;
      p.radius *= 0.96;

      if (p.alpha <= 0) {
        particles.splice(i, 1);
        continue;
      }

      ctx.fillStyle = `rgba(139, 90, 43, ${p.alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCar() {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);

    // 1. Suspension Spring Arms to Wheels
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 4;
    ctx.beginPath();
    // To rear wheel
    ctx.moveTo(-car.wheelBase * 0.5, 0);
    ctx.lineTo(-car.wheelBase * 0.5, 12);
    // To front wheel
    ctx.moveTo(car.wheelBase * 0.5, 0);
    ctx.lineTo(car.wheelBase * 0.5, 12);
    ctx.stroke();

    // 2. Wheels
    drawWheel(-car.wheelBase * 0.5, 12, car.x * 0.1);
    drawWheel(car.wheelBase * 0.5, 12, car.x * 0.1);

    // 3. Driver (Helmet & Torso)
    const hx = car.headOffset.x;
    const hy = car.headOffset.y + car.headDamperY;

    // Body
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(hx - 6, hy + 12, 12, 14);

    // Helmet (Round head)
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(hx, hy + 4, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Helmet Visor
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(hx + 1, hy + 2, 7, 4);

    // 4. Chassis Body (vehicle-specific)
    const veh = VEHICLES[gameData.vehicle] || VEHICLES.jeep;
    ctx.fillStyle = veh.color;
    ctx.beginPath();
    if (gameData.vehicle === 'monster') {
      // badi, bulbous monster truck body
      ctx.moveTo(-30, 8);
      ctx.lineTo(30, 8);
      ctx.lineTo(29, -8);
      ctx.lineTo(14, -12);
      ctx.lineTo(4, -26);
      ctx.lineTo(-22, -26);
      ctx.lineTo(-29, -8);
    } else {
      ctx.moveTo(-28, 6);
      ctx.lineTo(28, 6);
      ctx.lineTo(26, -6);
      ctx.lineTo(12, -8);
      ctx.lineTo(2, -20);
      ctx.lineTo(-20, -20);
      ctx.lineTo(-26, -6);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = veh.dark;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Roll cage bar
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (gameData.vehicle === 'monster') {
      ctx.moveTo(-19, 8);
      ctx.lineTo(-19, -25);
      ctx.lineTo(3, -25);
      ctx.lineTo(13, -11);
    } else {
      ctx.moveTo(-18, 6);
      ctx.lineTo(-18, -19);
      ctx.lineTo(2, -19);
      ctx.lineTo(12, -7);
    }
    ctx.stroke();

    // Headlight
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(27, -2, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Tail light
    ctx.fillStyle = '#f87171';
    ctx.fillRect(-28, -2, 3, 5);

    ctx.restore();
  }

  function drawWheel(x, y, rotation) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);

    // Outer Tire Rubber with Tread
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(0, 0, car.wheelRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Inner Chrome Rim
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.arc(0, 0, car.wheelRadius * 0.55, 0, Math.PI * 2);
    ctx.fill();

    // Rim Spokes
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-car.wheelRadius * 0.5, 0);
    ctx.lineTo(car.wheelRadius * 0.5, 0);
    ctx.moveTo(0, -car.wheelRadius * 0.5);
    ctx.lineTo(0, car.wheelRadius * 0.5);
    ctx.stroke();

    ctx.restore();
  }

  // --- Main Animation Loop ---
  let lastTime = performance.now();
  function gameLoop(time) {
    const dt = Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;

    updatePhysics(dt);
    render();

    requestAnimationFrame(gameLoop);
  }

  // Lock canvas internal resolution to crisp 800x450
  canvas.width = 800;
  canvas.height = 450;

  // Initialize
  loadData();
  if (!gameData.ownedVehicles.includes(gameData.vehicle)) gameData.vehicle = 'jeep';
  applyVehicle();
  refreshVehicleUI();
  renderGarage();
  requestAnimationFrame(gameLoop);
})();
