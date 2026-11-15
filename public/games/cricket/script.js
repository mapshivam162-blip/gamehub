// Cricket — Khelog (timing batting: 10 balls, tap = shot)
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
  var ballObj = null;   // { x, y, vx, vy }
  var swingAnim = 0;    // bat swing animation timer
  var outcome = null;
  var fx = [];          // particles / effects

  var PITCH_TOP = 150, BAT_Y = 430, BAT_X = W / 2;
  var bowlSpeed = 0;    // px/frame
  var canHit = false;
  var timeoutId = null;

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
  function playBat() { tone(320, 'square', 0.08, 0.15, 180); }
  function playBowl() { tone(120, 'sine', 0.1, 0.08); }
  function playSix() { tone(700, 'sine', 0.4, 0.2, 1400); setTimeout(function(){ tone(1050, 'sine', 0.3, 0.15); }, 120); }
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
    ball = 0; runs = 0; fx = [];
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
    swingAnim = 0;
    commentaryEl.textContent = 'Bowler daal raha hai... TAP KARO jab ball aaye!';
    bowlSpeed = 6 + ball * 0.55 + Math.random() * 1.2; // har ball tez
    var delay = 700 + Math.random() * 1600;
    timeoutId = setTimeout(function () {
      // bowl!
      ballObj = { x: W / 2 + (Math.random() * 60 - 30), y: PITCH_TOP, wobble: 0 };
      state = 'bowling';
      canHit = true;
      playBowl();
    }, delay);
  }

  var lastTapC = 0;
  function onTap(e) {
    e.preventDefault();
    var now = Date.now();
    if (now - lastTapC < 400) return;
    lastTapC = now;
    if (state === 'bowling' && canHit && ballObj) {
      canHit = false;
      var dist = Math.abs(ballObj.y - BAT_Y);
      var err = dist; // jitna kam, utna perfect
      if (err < 26) outcome = { runs: 6, text: '💥 SIX! Out of the park!' };
      else if (err < 60) outcome = { runs: 4, text: '🎇 CHAUKA! +4' };
      else if (err < 105) outcome = { runs: 2, text: '👍 2 runs' };
      else if (err < 150) outcome = { runs: 1, text: '👌 1 run' };
      else outcome = { runs: -1, text: '😱 BOWLED! Tim khatam!' };
      swingAnim = 0.4;
      resolveBall();
    } else if (state === 'wait') {
      // bahut jaldi swing — miss!
      canHit = false;
      clearTimeout(timeoutId);
      outcome = { runs: -1, text: '😶 Too early — BOWLED!' };
      swingAnim = 0.4;
      playOut();
      ballObj = { x: W / 2, y: PITCH_TOP, wobble: 0 };
      resolveBall(true);
    }
  }
  canvas.addEventListener('pointerdown', onTap);
  canvas.addEventListener('touchstart', function (e) { e.preventDefault(); onTap(e); }, { passive: false });

  function resolveBall(instant) {
    state = 'result';
    var isOut = outcome.runs < 0;
    if (!isOut) {
      runs += outcome.runs;
      if (outcome.runs === 6) playSix(); else playBat();
      // ball ko maarna — bahar ki taraf uda do
      if (ballObj) {
        ballObj.vx = (Math.random() * 2 - 1) * 8;
        ballObj.vy = outcome.runs === 6 ? -16 : -9;
      }
      for (var i = 0; i < 12; i++) {
        fx.push({ x: BAT_X, y: BAT_Y, vx: Math.random() * 10 - 5, vy: Math.random() * 10 - 6, life: 1 });
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
    }, instant ? 1400 : 1400);
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
        // miss — bowled!
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
      // chhaka ball udi ja rahi
      ballObj.x += ballObj.vx || 0;
      ballObj.y += ballObj.vy || 0;
      (ballObj.vy = (ballObj.vy || 0) + 0.25);
    }
    if (swingAnim > 0) swingAnim -= dt;
    fx.forEach(function (p) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.4; p.life -= 0.03;
    });
    fx = fx.filter(function (p) { return p.life > 0; });
  }

  function render() {
    // Maidan
    ctx.fillStyle = '#3fa33f';
    ctx.fillRect(0, 0, W, H);
    // pitch (halki)
    ctx.fillStyle = '#c9a876';
    ctx.fillRect(W / 2 - 36, PITCH_TOP - 20, 72, H - PITCH_TOP - 60);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    ctx.strokeRect(W / 2 - 36, PITCH_TOP - 20, 72, H - PITCH_TOP - 60);

    // Bowler (top)
    ctx.fillStyle = '#1e3a8a';
    ctx.beginPath(); ctx.arc(W / 2, PITCH_TOP - 55, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(W / 2 - 10, PITCH_TOP - 44, 20, 26);

    // Stumps
    ctx.fillStyle = '#e7d3a1';
    ctx.fillRect(BAT_X - 1, BAT_Y - 34, 3, 34);
    ctx.fillRect(BAT_X + 9, BAT_Y - 34, 3, 34);
    ctx.fillRect(BAT_X - 11, BAT_Y - 34, 3, 34);

    // Ball
    if (ballObj) {
      ctx.fillStyle = '#dc2626';
      ctx.beginPath(); ctx.arc(ballObj.x, ballObj.y, 8, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(ballObj.x, ballObj.y, 8, 0.6, 2.2); ctx.stroke();
    }

    // Batsman + bat swing
    var swing = swingAnim > 0 ? (0.4 - swingAnim) / 0.4 : 0;
    ctx.fillStyle = '#1d4ed8';
    ctx.beginPath(); ctx.arc(BAT_X + 22, BAT_Y - 40, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(BAT_X + 14, BAT_Y - 30, 16, 30);
    // bat
    ctx.save();
    ctx.translate(BAT_X + 30, BAT_Y - 8);
    ctx.rotate(-0.9 + swing * 2.4);
    ctx.fillStyle = '#c8a165';
    ctx.fillRect(-4, -6, 8, 40);
    ctx.restore();

    // Timing zone marker (green line jahan perfect hai)
    if (state === 'bowling') {
      ctx.strokeStyle = 'rgba(74, 222, 128, 0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(BAT_X - 45, BAT_Y);
      ctx.lineTo(BAT_X + 45, BAT_Y);
      ctx.stroke();
    }

    // FX
    fx.forEach(function (p) {
      ctx.fillStyle = 'rgba(250, 204, 21,' + p.life + ')';
      ctx.fillRect(p.x, p.y, 5, 5);
    });
  }

  requestAnimationFrame(function (t) { last = t; loop(t); });
})();
