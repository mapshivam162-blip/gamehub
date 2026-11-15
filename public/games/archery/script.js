// Archery — Khelog (2-tap aiming: angle + power, wind, 5 teer)
(function () {
  'use strict';

  var canvas = document.getElementById('gameCanvas');
  var ctx = canvas.getContext('2d');
  var W = canvas.width, H = canvas.height;

  var setupEl = document.getElementById('setup');
  var gameEl = document.getElementById('game');
  var hintEl = document.getElementById('hint');
  var arrowCountEl = document.getElementById('arrow-count');
  var scoreEl = document.getElementById('score');
  var resultModal = document.getElementById('result-modal');

  // ===== Game state =====
  var state = 'idle'; // idle | angle | power | flying | done
  var arrows = [];
  var arrowsLeft = 5;
  var totalScore = 0;
  var lastPts = null;
  var wind = 0;

  // Bow (left side, neeche)
  var bow = { x: 60, y: H - 150 };
  var aimAngle = 0;        // -0.15 .. 1.15 rad (upar ke taraf)
  var angleDir = 1;
  var power = 0;           // 0..1
  var powerDir = 1;

  // Target (right side) — position per shot
  var target = { x: W - 70, y: 0, r: 60 };

  var arrow = null; // flying arrow { x, y, vx, vy }

  var ANGLE_SPEED = 1.35;  // rad/s
  var POWER_SPEED = 0.85;  // per s
  var GRAVITY = 620;       // px/s^2

  function pickTarget() {
    target.y = 80 + Math.random() * (H - 220);
    target.r = 46 + Math.random() * 22;
  }

  function newShot() {
    state = 'angle';
    aimAngle = -0.1;
    angleDir = 1;
    power = 0;
    powerDir = 1;
    wind = (Math.random() * 2 - 1) * (Math.random() < 0.5 ? 40 : 80);
    pickTarget();
    arrow = null;
    updateHUD();
    hintEl.textContent = '🌬️ Hawa: ' + (wind > 0 ? '→ ' : '← ') + Math.abs(Math.round(wind)) + ' · Tap karo — angle lock!';
  }

  function updateHUD() {
    arrowCountEl.textContent = '🏹 ' + arrowsLeft;
    scoreEl.textContent = '⭐ ' + totalScore;
  }

  // ===== Input (pointer + touch dono aate hain — debounce) =====
  var lastTap = 0;
  function onTap(e) {
    e.preventDefault();
    var now = Date.now();
    if (now - lastTap < 400) return;
    lastTap = now;
    if (state === 'angle') {
      state = 'power';
      hintEl.textContent = '⚡ Power lock karo — tap!';
    } else if (state === 'power') {
      shoot();
    }
  }
  canvas.addEventListener('pointerdown', onTap);
  canvas.addEventListener('touchstart', function (e) { e.preventDefault(); onTap(e); }, { passive: false });

  document.getElementById('start-btn').addEventListener('click', startGame);
  document.getElementById('again-btn').addEventListener('click', function () {
    resultModal.classList.remove('show');
    startGame();
  });
  document.getElementById('menu-btn').addEventListener('click', function () {
    resultModal.classList.remove('show');
    gameEl.style.display = 'none';
    setupEl.style.display = '';
  });

  function startGame() {
    arrowsLeft = 5;
    totalScore = 0;
    arrows = [];
    lastPts = null;
    setupEl.style.display = 'none';
    gameEl.style.display = '';
    newShot();
  }

  // ===== Shooting =====
  function shoot() {
    var power01 = Math.max(0.15, power);
    var speed = 300 + power01 * 520;
    arrow = {
      x: bow.x + 30,
      y: bow.y - 10,
      vx: Math.cos(aimAngle) * speed,
      vy: -Math.sin(aimAngle) * speed,
      stuck: false,
    };
    state = 'flying';
    hintEl.textContent = '🎯 ...';
    playThwack();
  }

  // WebAudio SFX
  var audioCtx = null;
  function ac() {
    if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
    return audioCtx;
  }
  function tone(freq, type, dur, gain, slide) {
    var a = ac(); if (!a) return;
    try {
      var o = a.createOscillator(), g = a.createGain();
      o.type = type; o.frequency.value = freq;
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, a.currentTime + dur);
      g.gain.value = gain;
      g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
      o.connect(g); g.connect(a.destination);
      o.start(); o.stop(a.currentTime + dur);
    } catch (e) {}
  }
  function playThwack() { tone(180, 'square', 0.12, 0.12, 90); }
  function playHit(pts) {
    if (pts >= 10) { tone(880, 'sine', 0.3, 0.2, 1200); tone(1320, 'sine', 0.35, 0.12); }
    else if (pts > 0) tone(520, 'sine', 0.2, 0.15, 700);
    else tone(140, 'sawtooth', 0.25, 0.12, 70);
  }

  // ===== Physics / loop =====
  var last = 0;
  function loop(t) {
    var dt = Math.min((t - last) / 1000, 0.05);
    last = t;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  function update(dt) {
    if (state === 'angle') {
      aimAngle += angleDir * ANGLE_SPEED * dt;
      if (aimAngle > 1.15) { aimAngle = 1.15; angleDir = -1; }
      if (aimAngle < -0.15) { aimAngle = -0.15; angleDir = 1; }
    } else if (state === 'power') {
      power += powerDir * POWER_SPEED * dt;
      if (power > 1) { power = 1; powerDir = -1; }
      if (power < 0) { power = 0; powerDir = 1; }
    } else if (state === 'flying' && arrow && !arrow.stuck) {
      arrow.vy += GRAVITY * dt;
      arrow.vx += wind * dt;          // hawa ka asar
      arrow.x += arrow.vx * dt;
      arrow.y += arrow.vy * dt;
      // Target hit?
      var dx = arrow.x - target.x, dy = arrow.y - target.y;
      var dist = Math.hypot(dx, dy);
      if (dist <= target.r) {
        arrow.stuck = true;
        var pts = dist <= target.r * 0.18 ? 10 : dist <= target.r * 0.45 ? 8 : dist <= target.r * 0.75 ? 5 : 2;
        totalScore += pts;
        lastPts = { x: arrow.x, y: arrow.y, pts: pts };
        playHit(pts);
        hintEl.textContent = pts >= 10 ? '💥 BULLSEYE! +10' : pts > 0 ? '🎯 +' + pts : '😤 Miss!';
        arrowDone();
      } else if (arrow.x > W + 40 || arrow.x < -40 || arrow.y > H + 40) {
        lastPts = null;
        hintEl.textContent = '😤 Miss! 0 points';
        playHit(0);
        arrowDone();
      }
    }
  }

  function arrowDone() {
    if (arrowsLeft <= 0) return;
    arrowsLeft--;
    updateHUD();
    if (arrowsLeft <= 0) {
      endGame();
    } else {
      setTimeout(newShot, 900);
    }
  }

  function endGame() {
    state = 'done';
    var note = '';
    try {
      var earned = Math.max(1, totalScore);
      var coins = parseInt(localStorage.getItem('coins') || '1500', 10);
      localStorage.setItem('coins', String(coins + earned));
      localStorage.setItem('games_played', String(parseInt(localStorage.getItem('games_played') || '0', 10) + 1));
      note = '<p class="coin-note">🪙 +' + earned + ' coins kamaye!</p>';
    } catch (e) { /* ignore */ }
    document.getElementById('result-emoji').textContent = totalScore >= 30 ? '🏆' : '🏹';
    document.getElementById('result-title').textContent = totalScore + ' Points!';
    document.getElementById('result-sub').innerHTML =
      (totalScore >= 40 ? 'Legend shooter! 🌟' : totalScore >= 25 ? 'Badhiya nishaana!' : 'Aur practice karo!') + note;
    setTimeout(function () { resultModal.classList.add('show'); }, 600);
  }

  // ===== Render =====
  function render() {
    // Sky
    ctx.fillStyle = '#87ceeb';
    ctx.fillRect(0, 0, W, H);
    // Ground
    ctx.fillStyle = '#7ec850';
    ctx.fillRect(0, H - 70, W, 70);
    ctx.fillStyle = '#5aa63a';
    ctx.fillRect(0, H - 70, W, 10);

    // Wind indicator (top)
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(8, 8, 90, 26);
    ctx.fillStyle = '#334155';
    ctx.font = 'bold 15px Fredoka, sans-serif';
    ctx.fillText('🌬️ ' + (wind > 0 ? '→' : '←') + ' ' + Math.abs(Math.round(wind)), 16, 27);

    // Target: stand + rings
    ctx.fillStyle = '#8b5e34';
    ctx.fillRect(target.x - 4, target.y, 8, H - 70 - target.y);
    var rings = [
      { r: target.r, c: '#f8fafc' },
      { r: target.r * 0.75, c: '#1e293b' },
      { r: target.r * 0.45, c: '#2563eb' },
      { r: target.r * 0.18, c: '#dc2626' },
    ];
    rings.forEach(function (ring) {
      ctx.beginPath();
      ctx.arc(target.x, target.y, ring.r, 0, Math.PI * 2);
      ctx.fillStyle = ring.c;
      ctx.fill();
    });

    // Bow (arc + string)
    ctx.strokeStyle = '#8b5e34';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(bow.x, bow.y, 40, -Math.PI / 2 + 0.4, Math.PI / 2 - 0.4);
    ctx.stroke();
    // string pull hoti hai power ke saath
    var pull = 10 + power * 22;
    var midX = bow.x - pull;
    ctx.strokeStyle = '#f5f5f4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bow.x + Math.cos(-Math.PI / 2 + 0.4) * 40 + bow.x - bow.x, bow.y + Math.sin(-Math.PI / 2 + 0.4) * 40);
    ctx.lineTo(midX, bow.y);
    ctx.lineTo(bow.x + Math.cos(Math.PI / 2 - 0.4) * 40, bow.y + Math.sin(Math.PI / 2 - 0.4) * 40);
    ctx.stroke();
    // Archer (simple)
    ctx.fillStyle = '#334155';
    ctx.beginPath(); ctx.arc(bow.x - 6, bow.y - 26, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(bow.x - 12, bow.y - 18, 12, 26);

    // Aim arrow (dikhata hai angle + power)
    if (state === 'angle' || state === 'power') {
      var len = 60 + power * 90;
      var ax = bow.x + 20 + Math.cos(aimAngle) * len;
      var ay = bow.y - 10 - Math.sin(aimAngle) * len;
      ctx.strokeStyle = state === 'angle' ? 'rgba(239,68,68,0.9)' : 'rgba(234,179,8,0.9)';
      ctx.lineWidth = 4;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(bow.x + 20, bow.y - 10);
      ctx.lineTo(ax, ay);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Flying arrows
    if (arrow) {
      drawArrow(arrow.x, arrow.y, Math.atan2(arrow.vy, arrow.vx));
    }
    // Stuck arrows isi shot me
    if (lastPts) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = 'bold 16px Fredoka, sans-serif';
      ctx.fillText('+' + lastPts.pts, lastPts.x - 10, lastPts.y - 14);
    }
    arrows.forEach(function (a) { drawArrow(a.x, a.y, a.angle); });
  }

  function drawArrow(x, y, angle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle); // canvas y-niche = positive, atan2(vy, vx) seedha match karta hai
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-18, 0);
    ctx.lineTo(12, 0);
    ctx.stroke();
    // tip
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.moveTo(16, 0); ctx.lineTo(8, -4); ctx.lineTo(8, 4);
    ctx.closePath(); ctx.fill();
    // feathers
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-18, -3, 7, 2);
    ctx.fillRect(-18, 1, 7, 2);
    ctx.restore();
  }

  // Pichle teer board pe rehne do (pure look ke liye)
  var _oldArrowDone = arrowDone;
  arrowDone = function () {
    if (arrow && arrow.stuck) arrows.push({ x: arrow.x, y: arrow.y, angle: Math.atan2(arrow.vy, arrow.vx) });
    if (arrows.length > 3) arrows.shift();
    _oldArrowDone();
  };

  requestAnimationFrame(function (t) { last = t; loop(t); });
})();
