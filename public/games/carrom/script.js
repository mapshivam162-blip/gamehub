// Carrom — Khelog (slingshot striker, physics, vs bot)
(function () {
  'use strict';

  var canvas = document.getElementById('gameCanvas');
  var ctx = canvas.getContext('2d');
  var W = canvas.width, H = canvas.height; // 420x420

  var setupEl = document.getElementById('setup');
  var gameEl = document.getElementById('game');
  var msgEl = document.getElementById('msg');
  var p1InfoEl = document.getElementById('p1-info');
  var botInfoEl = document.getElementById('bot-info');
  var turnInfoEl = document.getElementById('turn-info');
  var resultModal = document.getElementById('result-modal');

  // ===== Board geometry =====
  var M = 42;                    // border margin
  var PR = 24;                   // pocket radius
  var POCKETS = [
    { x: M, y: M }, { x: W - M, y: M }, { x: M, y: H - M }, { x: W - M, y: H - M }
  ];
  var CR = 11;                   // coin radius
  var SR = 14;                   // striker radius
  var FRICTION = 0.9855;
  var STOP = 0.12;

  // ===== State =====
  var state = 'idle'; // idle | place | aim | shot | settling | over
  var myTurn = true;
  var coins = [];     // { x, y, vx, vy, type: 'w'|'b'|'q', active }
  var striker = { x: W / 2, y: H - M - 14, vx: 0, vy: 0 };
  var aim = null;     // { dx, dy } drag vector
  var potCounts = { me: 0, bot: 0 };
  var queen = { onBoard: true, owner: null };
  var foulQueue = []; // coins to return
  var shotInfo = null;

  function msg(t) { msgEl.textContent = t; }

  // ===== Setup coins (standard carrom formation) =====
  function setupBoard() {
    coins = [];
    var cx = W / 2, cy = H / 2;
    var d = CR * 2 + 0.5;
    // center coin = queen
    coins.push({ x: cx, y: cy, vx: 0, vy: 0, type: 'q', active: true });
    // ring 1 (6 coins alternating)
    var ring1 = [];
    for (var i = 0; i < 6; i++) {
      var a = Math.PI / 6 + i * Math.PI / 3;
      ring1.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d });
    }
    var types1 = ['w', 'b', 'w', 'b', 'w', 'b'];
    ring1.forEach(function (p, i) { coins.push({ x: p.x, y: p.y, vx: 0, vy: 0, type: types1[i], active: true }); });
    // ring 2 (outer)
    var types2 = ['b', 'w', 'w', 'b', 'b', 'w', 'w', 'b', 'w', 'b', 'b', 'w'];
    for (var j = 0; j < 12; j++) {
      var a2 = j * Math.PI / 6;
      var r2 = d * 2;
      coins.push({ x: cx + Math.cos(a2) * r2, y: cy + Math.sin(a2) * r2, vx: 0, vy: 0, type: types2[j], active: true });
    }
    queen = { onBoard: true, owner: null };
    potCounts = { me: 0, bot: 0 };
    foulQueue = [];
    resetStriker();
  }

  function resetStriker() {
    striker.x = W / 2;
    striker.y = myTurn ? H - M - 14 : M + 14;
    striker.vx = 0; striker.vy = 0;
  }

  // ===== Turn flow =====
  function startTurn() {
    shotInfo = null;
    if (myTurn) {
      state = 'aim';
      msg('🔴 Striker ko NEECHE kheencho, chhodo — upar marega!');
    } else {
      state = 'settling';
      msg('🤖 Bot soch raha hai...');
      setTimeout(botShoot, 900);
    }
    updateTopBar();
  }

  function updateTopBar() {
    p1InfoEl.textContent = '🔴 Tum: ' + potCounts.me + (queen.owner === 'me' ? ' 👑' : '');
    botInfoEl.textContent = '🤖 Bot: ' + potCounts.bot + (queen.owner === 'bot' ? ' 👑' : '');
    turnInfoEl.textContent = myTurn ? 'Tumhari baari' : 'Bot ki baari';
  }

  function allPotted(color) {
    return !coins.some(function (c) { return c.active && c.type === color; });
  }

  function checkWin() {
    // Queen ko kisi ne jeeta?
    if (!queen.onBoard && queen.owner) {
      var own = queen.owner;
      if (allPotted(own === 'me' ? 'w' : 'b')) {
        endGame(own);
        return true;
      }
    }
    if (allPotted('w') && allPotted('b')) {
      var winner = potCounts.me >= potCounts.bot ? 'me' : 'bot';
      endGame(winner);
      return true;
    }
    if (allPotted('w')) { endGame('me'); return true; }
    if (allPotted('b')) { endGame('bot'); return true; }
    return false;
  }

  // ===== Physics =====
  function step() {
    var moving = false;
    var bodies = coins.filter(function (c) { return c.active; }).concat([striker]);
    bodies.forEach(function (b) {
      if (Math.abs(b.vx) < STOP && Math.abs(b.vy) < STOP) { b.vx = 0; b.vy = 0; return; }
      moving = true;
      b.x += b.vx; b.y += b.vy;
      b.vx *= FRICTION; b.vy *= FRICTION;
      // walls
      var r = b === striker ? SR : CR;
      if (b.x < M + r) { b.x = M + r; b.vx = Math.abs(b.vx) * 0.75; }
      if (b.x > W - M - r) { b.x = W - M - r; b.vx = -Math.abs(b.vx) * 0.75; }
      if (b.y < M + r) { b.y = M + r; b.vy = Math.abs(b.vy) * 0.75; }
      if (b.y > H - M - r) { b.y = H - M - r; b.vy = -Math.abs(b.vy) * 0.75; }
      // pocket check
      for (var i = 0; i < 4; i++) {
        var p = POCKETS[i];
        if (Math.hypot(b.x - p.x, b.y - p.y) < PR - 2) {
          pocketBody(b);
          break;
        }
      }
    });
    // collisions (pairwise)
    for (var i = 0; i < bodies.length; i++) {
      for (var j = i + 1; j < bodies.length; j++) {
        var a = bodies[i], b = bodies[j];
        if (!a.active && a !== striker) continue;
        if (!b.active && b !== striker) continue;
        if (!bodiesAlive(a) || !bodiesAlive(b)) continue;
        var ra = a === striker ? SR : CR;
        var rb = b === striker ? SR : CR;
        var dx = b.x - a.x, dy = b.y - a.y;
        var dist = Math.hypot(dx, dy);
        var minD = ra + rb;
        if (dist < minD && dist > 0.0001) {
          var nx = dx / dist, ny = dy / dist;
          // separate
          var overlap = (minD - dist) / 2;
          a.x -= nx * overlap; a.y -= ny * overlap;
          b.x += nx * overlap; b.y += ny * overlap;
          // impulse
          var va = { x: a.vx || 0, y: a.vy || 0 };
          var vb = { x: b.vx || 0, y: b.vy || 0 };
          var rel = (vb.x - va.x) * nx + (vb.y - va.y) * ny;
          if (rel < 0) {
            var imp = -rel * 0.92;
            va.x -= nx * imp * 0.9; va.y -= ny * imp * 0.9;
            vb.x += nx * imp * 0.9; vb.y += ny * imp * 0.9;
            a.vx = va.x; a.vy = va.y;
            b.vx = vb.x; b.vy = vb.y;
            if (imp > 1.5) playClick();
          }
        }
      }
    }
    return moving;
  }

  function bodiesAlive(b) {
    if (b === striker) return true;
    return b.active !== false;
  }

  function pocketBody(b) {
    if (b === striker) {
      striker.vx = 0; striker.vy = 0;
      striker.x = -999; striker.y = -999;
      striker.pocketed = true;
      return;
    }
    b.active = false;
    if (b.type === 'q') {
      queen.onBoard = false;
      queen.owner = myTurn ? 'me' : 'bot';
    } else {
      potCounts[myTurn ? 'me' : 'bot']++;
    }
    playPot();
  }

  // ===== Player aiming (slingshot) =====
  var dragging = false, dragStart = null;

  function canvasPos(e) {
    var rect = canvas.getBoundingClientRect();
    var scale = W / rect.width;
    return {
      x: (e.clientX - rect.left) * scale,
      y: (e.clientY - rect.top) * scale,
    };
  }

  function onDown(e) {
    if (state !== 'aim' || !myTurn) return;
    var p = canvasPos(e);
    if (Math.hypot(p.x - striker.x, p.y - striker.y) < 48) {
      dragging = true;
      dragStart = p;
    }
  }
  function onMove(e) {
    if (!dragging) return;
    e.preventDefault();
    var p = canvasPos(e);
    aim = { dx: p.x - striker.x, dy: p.y - striker.y };
    // striker ko baseline pe slide karo (aim direction ke hisaab se)
    var maxSlide = W / 2 - M - SR;
    var slide = Math.max(-maxSlide, Math.min(maxSlide, aim.dx * 0.6));
    striker.x = W / 2 + slide;
  }
  function onUp(e) {
    if (!dragging) return;
    dragging = false;
    if (!aim) return;
    var power = Math.hypot(aim.dx, aim.dy);
    if (power < 18) { aim = null; return; } // tap — cancel
    var powerCap = Math.min(power, 160);
    var speed = powerCap * 0.62;
    // True slingshot: jis taraf se kheencha, ulti taraf marega
    var ang = Math.atan2(-aim.dy, -aim.dx);
    striker.vx = Math.cos(ang) * speed;
    striker.vy = Math.sin(ang) * speed;
    aim = null;
    state = 'shot';
    shotInfo = { pottedMine: 0, pottedBot: 0, strikerFell: false };
    playStrike();
  }
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', function () { dragging = false; });

  // ===== Bot AI =====
  function botShoot() {
    if (state === 'over') return;
    // apni (black) coin chuno jo striker line se asaani se lagti hai
    var targets = coins.filter(function (c) { return c.active && (c.type === 'b' || (c.type === 'q' && Math.random() < 0.4)); });
    if (!targets.length) targets = coins.filter(function (c) { return c.active; });
    if (!targets.length) { nextTurn(false); return; }
    var t = targets[Math.floor(Math.random() * targets.length)];
    // striker ko coin ke theek neeche line pe rakho
    var sx = Math.max(M + SR + 4, Math.min(W - M - SR - 4, t.x));
    striker.x = sx;
    striker.y = M + 14;
    var dx = t.x - sx, dy = t.y - striker.y;
    var dist = Math.hypot(dx, dy);
    var err = (Math.random() - 0.5) * 0.14;
    var ang = Math.atan2(dy, dx) + err;
    var speed = Math.min(95, 55 + dist * 0.22);
    striker.vx = Math.cos(ang) * speed;
    striker.vy = Math.sin(ang) * speed;
    state = 'shot';
    shotInfo = {};
    playStrike();
  }

  // ===== Shot settle → turn resolution =====
  function settleShot() {
    var s = shotInfo || {};
    var myPotW = potCounts.me, myPotB = potCounts.bot;
    // counts se pata karo kya pot hua — simpler: event log
    // Use logged info
    var mine = s.mine || 0, theirs = s.others || 0;
    // striker foul?
    var foul = !!s.strikerFell;
    var keepTurn = false;
    if (foul) {
      // ek pot hui apni coin wapas
      var returned = returnOneCoin(myTurn ? 'w' : 'b');
      msg(myTurn ? '😵 Striker giri! Foul — ek goti wapas.' : '🤖 Striker giri! Foul.');
      keepTurn = false;
      if (returned) { // jisne striker mari uski potted coin wapas aayi already handled in returnOneCoin
      }
    } else if (mine > 0) {
      keepTurn = true;
      msg(myTurn ? '🎯 Shardul! Turn chalta rahega!' : '🤖 Bot ne pot kiya!');
    } else if (theirs === 0 && mine === 0) {
      msg(myTurn ? '😐 Miss! Bot ki baari.' : '🤖 Miss! Tumhari baari.');
    }
    if (checkWin()) return;
    // queen cover check (simplified: jisne potti, agle turn tak cover nahi kiya to queen wapas center me) — skip complexity
    myTurn = keepTurn ? myTurn : !myTurn;
    striker.pocketed = false;
    resetStriker();
    setTimeout(startTurn, 800);
  }

  function returnOneCoin(color) {
    // potted hui coin wapas center ke paas
    for (var i = 0; i < coins.length; i++) {
      var c = coins[i];
      if (c.type === color && !c.active) {
        // owner ke pot count kam karo
        if (color === 'w') potCounts.me = Math.max(0, potCounts.me - 1);
        else potCounts.bot = Math.max(0, potCounts.bot - 1);
        c.active = true;
        c.x = W / 2 + (Math.random() * 40 - 20);
        c.y = H / 2 + (Math.random() * 40 - 20);
        c.vx = 0; c.vy = 0;
        return true;
      }
    }
    return false;
  }

  // ===== Loop =====
  var last = 0;
  function loop(t) {
    var dt = Math.min((t - last) / 1000, 0.05);
    last = t;
    if (state === 'shot') {
      // track pots during shot (accumulate)
      var beforeMine = potCounts.me, beforeBot = potCounts.bot;
      var moving = step();
      if (shotInfo) {
        shotInfo.mine = (shotInfo.mine || 0) + (potCounts.me - beforeMine);
        shotInfo.others = (shotInfo.others || 0) + (potCounts.bot - beforeBot);
      }
      if (striker.pocketed) { shotInfo.strikerFell = true; }
      if (!moving) {
        state = 'settling';
        settleShot();
      }
    } else if (state === 'settling') {
      step();
    }
    try { render(); } catch (e) { window.__renderErr = (e.message || String(e)) + ' @' + (e.lineNumber || '?'); }
    requestAnimationFrame(loop);
  }

  // ===== End + rewards =====
  function endGame(winner) {
    state = 'over';
    var note = '';
    var iWon = winner === 'me';
    try {
      var earned = iWon ? 25 : 5;
      var coinsC = parseInt(localStorage.getItem('coins') || '1500', 10);
      localStorage.setItem('coins', String(coinsC + earned));
      localStorage.setItem('games_played', String(parseInt(localStorage.getItem('games_played') || '0', 10) + 1));
      note = '<p class="coin-note">🪙 +' + earned + ' coins kamaye!</p>';
    } catch (e) { /* ignore */ }
    document.getElementById('result-emoji').textContent = iWon ? '🏆' : '🤖';
    document.getElementById('result-title').textContent = iWon ? 'Tum Jeet Gaye!' : 'Bot Jeet Gaya';
    document.getElementById('result-sub').innerHTML = 'Tum ' + potCounts.me + ' · Bot ' + potCounts.bot + note;
    setTimeout(function () { resultModal.classList.add('show'); }, 700);
  }

  // ===== SFX =====
  var audioCtx = null;
  function ac() {
    if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
    return audioCtx;
  }
  function playClick() {
    var a = ac(); if (!a) return;
    try {
      var o = a.createOscillator(), g = a.createGain();
      o.type = 'triangle'; o.frequency.value = 900;
      g.gain.value = 0.06;
      g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.06);
      o.connect(g); g.connect(a.destination);
      o.start(); o.stop(a.currentTime + 0.06);
    } catch (e) {}
  }
  function playStrike() { tone(240, 'square', 0.08, 0.12, 130); }
  function playPot() { tone(660, 'sine', 0.25, 0.18, 990); }
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

  // ===== Render =====
  function render() {
    // board
    ctx.fillStyle = '#c68642';
    ctx.fillRect(0, 0, W, H);
    // wood grain halka
    ctx.fillStyle = 'rgba(0,0,0,0.04)';
    for (var g = 0; g < 8; g++) ctx.fillRect(0, g * 52 + 10, W, 3);
    // border
    ctx.strokeStyle = '#5d2e0d';
    ctx.lineWidth = 10;
    ctx.strokeRect(M - 10, M - 10, W - 2 * (M - 10), H - 2 * (M - 10));
    // pockets
    POCKETS.forEach(function (p) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, PR, 0, Math.PI * 2);
      ctx.fillStyle = '#1a1208';
      ctx.fill();
    });
    // center circle
    ctx.strokeStyle = 'rgba(90, 40, 10, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 38, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, CR + 2, 0, Math.PI * 2);
    ctx.stroke();
    // baselines
    ctx.strokeStyle = 'rgba(90, 40, 10, 0.5)';
    ctx.lineWidth = 2;
    [H - M - 14, M + 14].forEach(function (yy) {
      ctx.beginPath();
      ctx.moveTo(M + 40, yy);
      ctx.lineTo(W - M - 40, yy);
      ctx.stroke();
      // arrows on baseline
      ctx.beginPath();
      ctx.arc(M + 40, yy, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(W - M - 40, yy, 10, 0, Math.PI * 2);
      ctx.stroke();
    });

    // coins
    coins.forEach(function (c) {
      if (!c.active) return;
      ctx.beginPath();
      ctx.arc(c.x, c.y, CR, 0, Math.PI * 2);
      ctx.fillStyle = c.type === 'q' ? '#dc2626' : c.type === 'w' ? '#f5f0e1' : '#1e293b';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2;
      ctx.stroke();
      if (c.type === 'q') {
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 10px Fredoka, sans-serif';
        ctx.fillText('★', c.x - 3.5, c.y + 3.5);
      }
    });

    // striker
    if (striker.x > -100) {
      ctx.beginPath();
      ctx.arc(striker.x, striker.y, SR, 0, Math.PI * 2);
      ctx.fillStyle = '#f8fafc';
      ctx.fill();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(striker.x, striker.y, SR - 6, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(71,85,105,0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // aim guide
    if (dragging && aim) {
      var ang = Math.atan2(aim.dy, aim.dx);
      var len = Math.min(Math.hypot(aim.dx, aim.dy), 160) * 1.4;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 7]);
      ctx.beginPath();
      ctx.moveTo(striker.x, striker.y);
      ctx.lineTo(striker.x + Math.cos(ang) * len, striker.y + Math.sin(ang) * len);
      ctx.stroke();
      ctx.setLineDash([]);
      // power meter
      var pw = Math.min(Math.hypot(aim.dx, aim.dy), 160) / 160;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(10, H - 26, 100, 12);
      ctx.fillStyle = pw > 0.75 ? '#ef4444' : pw > 0.4 ? '#eab308' : '#4ade80';
      ctx.fillRect(10, H - 26, 100 * pw, 12);
    }
  }

  // Debug hook
  if (typeof window !== 'undefined') {
    window.__CC = function () {
      return {
        state: state, myTurn: myTurn,
        coins: coins.length, active: coins.filter(function (c) { return c.active; }).length,
        sx: striker.x, sy: striker.y,
        pots: potCounts, queenOn: queen.onBoard,
        c0: coins.slice(0, 4).map(function (c) { return [Math.round(c.x), Math.round(c.y), c.type]; })
      };
    };
  }

  // ===== Init =====
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
    setupEl.style.display = 'none';
    gameEl.style.display = '';
    setupBoard();
    myTurn = true;
    state = 'idle';
    setTimeout(startTurn, 400);
    if (!window.__carromLoop) {
      window.__carromLoop = true;
      requestAnimationFrame(function (t) { last = t; loop(t); });
    }
  }
})();
