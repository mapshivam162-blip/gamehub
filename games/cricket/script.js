// Cricket Black — Khelog (minimal dark style + swipe batting: jahan swipe, wahan shot)
(function () {
  'use strict';

  var canvas = document.getElementById('gameCanvas');
  var ctx = canvas.getContext('2d');
  var W = canvas.width, H = canvas.height;

  var setupEl = document.getElementById('setup');
  var gameEl = document.getElementById('game');
  var commentaryEl = document.getElementById('commentary');
  var ballCountEl = document.getElementById('ball-count');
  var scoreEl = document.getElementById('score');
  var resultModal = document.getElementById('result-modal');

  // ===== State =====
  var state = 'idle'; // idle | wait | bowling | result | done
  var ball = 0, TOTAL_BALLS = 10;
  var runs = 0;
  var ballObj = null;   // { x, y, vx, vy, fdx, fdy }
  var swingAnim = 0;
  var outcome = null;
  var fx = [];          // particles
  var shotDir = null;   // hit hone ke baad direction dikhane ke liye

  var PITCH_TOP = 150, BAT_Y = 430, BAT_X = W / 2;
  var bowlSpeed = 0;
  var canHit = false;
  var timeoutId = null;

  // ===== Swipe tracking =====
  var swiping = false, swDown = null, swCur = null;

  // WebAudio
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
  function playBat() { tone(340, 'square', 0.07, 0.16, 190); }
  function playBowl() { tone(120, 'sine', 0.1, 0.07); }
  function playSix() { tone(700, 'sine', 0.4, 0.2, 1400); setTimeout(function () { tone(1050, 'sine', 0.3, 0.15); }, 120); }
  function playOut() { tone(200, 'sawtooth', 0.4, 0.15, 60); }

  // ===== Start / reset =====
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
    ball = 0; runs = 0; fx = []; shotDir = null;
    setupEl.style.display = 'none';
    gameEl.style.display = '';
    updateHUD();
    setTimeout(nextBall, 600);
  }

  function updateHUD() {
    ballCountEl.textContent = 'Ball ' + Math.min(ball + 1, TOTAL_BALLS) + '/' + TOTAL_BALLS;
    scoreEl.textContent = runs + ' run' + (runs === 1 ? '' : 's');
  }

  // ===== Bowling =====
  function nextBall() {
    if (ball >= TOTAL_BALLS) { endGame(); return; }
    state = 'wait';
    outcome = null;
    ballObj = null;
    shotDir = null;
    swingAnim = 0;
    commentaryEl.textContent = 'Ball aate hi SWIPE karo! 👆';
    bowlSpeed = 6 + ball * 0.55 + Math.random() * 1.2;
    var delay = 700 + Math.random() * 1600;
    timeoutId = setTimeout(function () {
      ballObj = { x: W / 2 + (Math.random() * 60 - 30), y: PITCH_TOP, fdx: 0, fdy: 0 };
      state = 'bowling';
      canHit = true;
      playBowl();
    }, delay);
  }

  // ===== Swipe input =====
  function evPos(e) {
    var rect = canvas.getBoundingClientRect();
    var scale = W / rect.width;
    return { x: (e.clientX - rect.left) * scale, y: (e.clientY - rect.top) * scale };
  }
  function startSwipe(e) {
    if (state === 'wait' || state === 'bowling') {
      swiping = true;
      swDown = evPos(e);
      swCur = swDown;
    }
  }
  function moveSwipe(e) {
    if (!swiping) return;
    e.preventDefault();
    swCur = evPos(e);
  }
  function endSwipe(e) {
    if (!swiping) return;
    swiping = false;
    var up = evPos(e);
    attemptShot(up.x - swDown.x, up.y - swDown.y, Math.hypot(up.x - swDown.x, up.y - swDown.y));
  }
  function resetSwipe() { swiping = false; swDown = null; swCur = null; }

  canvas.addEventListener('pointerdown', function (e) { e.preventDefault(); startSwipe(e); });
  canvas.addEventListener('pointermove', moveSwipe);
  canvas.addEventListener('pointerup', function (e) { e.preventDefault(); endSwipe(e); });
  canvas.addEventListener('pointercancel', resetSwipe);

  // ===== Shot logic (swipe direction + timing) =====
  function attemptShot(dx, dy, dist) {
    // Bola hi nahi aur swipe maar diya — too early!
    if (state === 'wait' && !ballObj) {
      clearTimeout(timeoutId);
      canHit = false;
      outcome = { runs: -1, text: '😶 Too early — BOWLED!' };
      swingAnim = 0.4;
      playOut();
      ballObj = { x: W / 2, y: PITCH_TOP, fdx: 0, fdy: 0 };
      resolveBall();
      return;
    }
    if (state !== 'bowling' || !canHit || !ballObj) return;
    canHit = false;

    var err = Math.abs(ballObj.y - BAT_Y);
    // direction: straight (upar) | off (right) | leg (left)
    var dir = 'straight', dirName = 'Straight';
    if (dist > 24) {
      if (dy < -Math.abs(dx) * 1.1) { dir = 'straight'; dirName = 'Straight'; }
      else if (dx > 0) { dir = 'off'; dirName = 'Off side'; }
      else { dir = 'leg'; dirName = 'Leg side'; }
    }
    ballObj.fdx = dx; ballObj.fdy = dy;
    shotDir = { dx: dx, dy: dy, dist: dist };

    var r;
    if (err < 26) r = dir === 'straight' ? 6 : 4;
    else if (err < 60) r = dir === 'straight' ? 4 : 2;
    else if (err < 105) r = 2;
    else if (err < 150) r = 1;
    else r = -1;

    if (r < 0) outcome = { runs: -1, text: '😱 BOWLED! Timing miss!' };
    else if (r === 6) outcome = { runs: 6, text: '💥 SIX! ' + dirName + ' pe chhakka!' };
    else if (r === 4) outcome = { runs: 4, text: '🎇 CHAUKA — ' + dirName + '!' };
    else outcome = { runs: r, text: '👍 ' + r + ' run (' + dirName + ')' };

    swingAnim = 0.4;
    resolveBall();
  }

  function resolveBall() {
    state = 'result';
    var isOut = outcome.runs < 0;
    if (!isOut) {
      runs += outcome.runs;
      if (outcome.runs === 6) playSix(); else playBat();
      // ball swipe direction me ud jaye
      if (ballObj) {
        var ddx = ballObj.fdx || 0, ddy = ballObj.fdy || 0;
        var dl = Math.hypot(ddx, ddy) || 1;
        var sp = outcome.runs === 6 ? 15 : outcome.runs === 4 ? 11 : 7;
        ballObj.vx = ddx / dl * sp;
        ballObj.vy = ddy / dl * sp;
        if (ballObj.vy > -2.5) ballObj.vy = -2.5; // kam se kam upar
      }
      for (var i = 0; i < 12; i++) {
        fx.push({ x: BAT_X, y: BAT_Y - 10, vx: Math.random() * 10 - 5, vy: Math.random() * 10 - 6, life: 1 });
      }
    } else {
      playOut();
    }
    commentaryEl.textContent = outcome.text;
    updateHUD();
    setTimeout(function () {
      ball++;
      if (ball >= TOTAL_BALLS) endGame();
      else { updateHUD(); nextBall(); }
    }, 1400);
  }

  function endGame() {
    state = 'done';
    var note = '';
    try {
      var earned = Math.max(1, runs);
      var coins = parseInt(localStorage.getItem('coins') || '1500', 10);
      localStorage.setItem('coins', String(coins + earned));
      localStorage.setItem('games_played', String(parseInt(localStorage.getItem('games_played') || '0', 10) + 1));
      note = '<p class="coin-note">🪙 +' + earned + ' coins kamaye!</p>';
    } catch (e) { /* ignore */ }
    var emoji = runs >= 40 ? '🏆' : runs >= 20 ? '🏏' : '🥺';
    document.getElementById('result-emoji').textContent = emoji;
    document.getElementById('result-title').textContent = runs + ' Runs!';
    document.getElementById('result-sub').innerHTML =
      (runs >= 40 ? 'Dhoni se bhi bade! 🌟' : runs >= 20 ? 'Solid batting!' : 'Aur practice karo!') + note;
    setTimeout(function () { resultModal.classList.add('show'); }, 700);
  }

  // ===== Loop =====
  var last = 0;
  function loop(t) {
    var dt = Math.min((t - last) / 1000, 0.05);
    last = t;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  function update(dt) {
    if (state === 'bowling' && ballObj && canHit) {
      ballObj.y += bowlSpeed;
      ballObj.x += Math.sin(ballObj.y * 0.08) * 1.2; // swing
      if (ballObj.y > BAT_Y + 150) {
        canHit = false;
        outcome = { runs: -1, text: '😵 BOWLED! Ball nikal gayi!' };
        playOut();
        state = 'result';
        commentaryEl.textContent = outcome.text;
        setTimeout(function () {
          ball++;
          if (ball >= TOTAL_BALLS) endGame();
          else { updateHUD(); nextBall(); }
        }, 1400);
      }
    } else if (state === 'result' && ballObj && !canHit && outcome && outcome.runs >= 0) {
      ballObj.x += ballObj.vx || 0;
      ballObj.y += ballObj.vy || 0;
      ballObj.vy = (ballObj.vy || 0) + 0.25;
    }
    if (swingAnim > 0) swingAnim -= dt;
    fx.forEach(function (p) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.4; p.life -= 0.03;
    });
    fx = fx.filter(function (p) { return p.life > 0; });
  }

  // ===== Render (Cricket Black minimal style) =====
  function render() {
    // black bg
    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(0, 0, W, H);

    // pitch (dark strip)
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(W / 2 - 34, PITCH_TOP - 30, 68, H - PITCH_TOP - 70);
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(W / 2 - 34, PITCH_TOP - 30, 68, H - PITCH_TOP - 70);

    // bowler (minimal white)
    ctx.fillStyle = '#f5f5f5';
    ctx.beginPath(); ctx.arc(W / 2, PITCH_TOP - 60, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(W / 2 - 6, PITCH_TOP - 52, 12, 22);

    // timing zone (faint dashed line)
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 6]);
    ctx.beginPath();
    ctx.moveTo(BAT_X - 55, BAT_Y);
    ctx.lineTo(BAT_X + 55, BAT_Y);
    ctx.stroke();
    ctx.setLineDash([]);

    // stumps (white minimal)
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(BAT_X - 12, BAT_Y - 36, 2.5, 36);
    ctx.fillRect(BAT_X - 1, BAT_Y - 36, 2.5, 36);
    ctx.fillRect(BAT_X + 10, BAT_Y - 36, 2.5, 36);

    // batsman (white minimal)
    var swing = swingAnim > 0 ? (0.4 - swingAnim) / 0.4 : 0;
    ctx.fillStyle = '#f5f5f5';
    ctx.beginPath(); ctx.arc(BAT_X + 22, BAT_Y - 42, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(BAT_X + 15, BAT_Y - 33, 14, 33);
    // bat
    ctx.save();
    ctx.translate(BAT_X + 29, BAT_Y - 6);
    ctx.rotate(-0.9 + swing * 2.4);
    ctx.fillStyle = '#e5e5e5';
    ctx.fillRect(-3, -6, 6, 40);
    ctx.restore();

    // swipe trail (live)
    if (swiping && swDown && swCur) {
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(swDown.x, swDown.y);
      ctx.lineTo(swCur.x, swCur.y);
      ctx.stroke();
      // arrow head
      var adx = swCur.x - swDown.x, ady = swCur.y - swDown.y;
      var al = Math.hypot(adx, ady) || 1;
      var ux = adx / al, uy = ady / al;
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.moveTo(swCur.x, swCur.y);
      ctx.lineTo(swCur.x - ux * 12 - uy * 6, swCur.y - uy * 12 + ux * 6);
      ctx.lineTo(swCur.x - ux * 12 + uy * 6, swCur.y - uy * 12 - ux * 6);
      ctx.closePath(); ctx.fill();
    }

    // ball (white — Cricket Black look)
    if (ballObj) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(ballObj.x, ballObj.y, 7.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#9ca3af';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(ballObj.x, ballObj.y, 4, 0.6, 2.4); ctx.stroke();
    }

    // shot direction indicator (hit ke baad thodi der)
    if (shotDir && swingAnim > 0 && shotDir.dist > 24) {
      var tl = 40 + Math.min(shotDir.dist, 120) * 0.4;
      var tl2 = Math.hypot(shotDir.dx, shotDir.dy) || 1;
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(BAT_X + 29, BAT_Y - 10);
      ctx.lineTo(BAT_X + 29 + shotDir.dx / tl2 * tl, BAT_Y - 10 + shotDir.dy / tl2 * tl);
      ctx.stroke();
    }

    // FX (white sparks)
    fx.forEach(function (p) {
      ctx.fillStyle = 'rgba(255,255,255,' + p.life + ')';
      ctx.fillRect(p.x, p.y, 4, 4);
    });

    // footer hint (canvas me chhota)
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = 'bold 12px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('swipe = shot direction', W / 2, H - 14);
    ctx.textAlign = 'start';
  }

  // Debug hook (testing ke liye, harmless)
  if (typeof window !== 'undefined') {
    window.__CB = function () {
      return { state: state, ball: ball, runs: runs, by: ballObj ? Math.round(ballObj.y) : null, canHit: canHit };
    };
  }

  requestAnimationFrame(function (t) { last = t; loop(t); });
})();
