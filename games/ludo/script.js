/* Ludo Champion — Khelog
   Vs Bot (1 human + 3 bots) & Pass&Play (2-4). Rules: 6 pe niklo, capture pe extra turn,
   3 six pe turn khatam, exact number se ghar. */
(function () {
  'use strict';

  // ---------- Constants ----------
  const CELL = 30, OFF = 10; // 15x15 board -> 470px canvas
  const COLORS = ['red', 'green', 'yellow', 'blue'];
  const COL = {
    red:    { main: '#ef4444', dark: '#b91c1c', light: '#fee2e2', yard: '#ef4444' },
    green:  { main: '#22c55e', dark: '#15803d', light: '#dcfce7', yard: '#22c55e' },
    yellow: { main: '#facc15', dark: '#a16207', light: '#fef9c3', yard: '#facc15' },
    blue:   { main: '#3b82f6', dark: '#1d4ed8', light: '#dbeafe', yard: '#3b82f6' },
  };
  const START = { red: 0, green: 13, yellow: 26, blue: 39 };
  const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
  const YARD_RECT = { red: [0, 0], green: [9, 0], yellow: [9, 9], blue: [0, 9] }; // [col,row] of 6x6 yard

  // 52-cell main track, index 0 = red start (clockwise)
  const TRACK = [
    [1,6],[2,6],[3,6],[4,6],[5,6],[6,5],[6,4],[6,3],[6,2],[6,1],[6,0],[7,0],[8,0],
    [8,1],[8,2],[8,3],[8,4],[8,5],[9,6],[10,6],[11,6],[12,6],[13,6],[14,6],[14,7],[14,8],
    [13,8],[12,8],[11,8],[10,8],[9,8],[8,9],[8,10],[8,11],[8,12],[8,13],[8,14],[7,14],[6,14],
    [6,13],[6,12],[6,11],[6,10],[6,9],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8],[0,7],[0,6],
  ];
  // 5 home-lane cells per color (start se center ki taraf)
  const HOME_LANE = {
    red:    [[1,7],[2,7],[3,7],[4,7],[5,7]],
    green:  [[7,1],[7,2],[7,3],[7,4],[7,5]],
    yellow: [[13,7],[12,7],[11,7],[10,7],[9,7]],
    blue:   [[7,13],[7,12],[7,11],[7,10],[7,9]],
  };
  const YARD_SLOTS = [[2,2],[4,2],[2,4],[4,4]]; // yard ke andar 4 gaddhe (cell units)

  // ---------- Assets (real 3D goti + dice images) ----------
  const TOKEN_IMGS = {};
  const DICE_BG = {}; // color -> tinted dice dataURL
  const DICE_IMG = new Image();
  function loadAssets() {
    for (const c of COLORS) {
      const im = new Image();
      im.src = 'assets/token-' + c + '.png';
      TOKEN_IMGS[c] = im;
    }
    DICE_IMG.onload = () => {
      for (const c of COLORS) DICE_BG[c] = tintDice(c);
      players.forEach((p) => applyDieBg(p));
    };
    DICE_IMG.src = 'assets/dice.png';
  }
  // white dice image ko player ke color me tint karo
  function tintDice(color) {
    try {
      const c = document.createElement('canvas');
      c.width = DICE_IMG.naturalWidth; c.height = DICE_IMG.naturalHeight;
      const x = c.getContext('2d');
      x.drawImage(DICE_IMG, 0, 0);
      x.globalCompositeOperation = 'multiply';
      x.fillStyle = COL[color].main;
      x.fillRect(0, 0, c.width, c.height);
      x.globalCompositeOperation = 'destination-in';
      x.drawImage(DICE_IMG, 0, 0);
      return c.toDataURL('image/png');
    } catch (e) { return null; }
  }

  // ---------- DOM ----------
  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d');
  const diceTray = document.getElementById('dice-tray');
  const diceHint = document.getElementById('dice-hint');
  const turnEl = document.getElementById('turn');
  const progEl = document.getElementById('prog');
  const overlay = document.getElementById('overlay');
  const ovSub = document.getElementById('ov-sub');
  const modeSelect = document.getElementById('mode-select');
  const ppCount = document.getElementById('pp-count');
  const startBtn = document.getElementById('start-btn');

  // ---------- Sound ----------
  let audioCtx = null;
  function beep(freq, dur, type, vol) {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = type || 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.12, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(); o.stop(audioCtx.currentTime + dur);
    } catch (e) { /* silent */ }
  }
  const sndRoll = () => beep(300, 0.08, 'square', 0.08);
  const sndMove = () => beep(500, 0.06, 'sine');
  const sndCapture = () => { beep(200, 0.15, 'sawtooth', 0.15); setTimeout(() => beep(120, 0.2, 'sawtooth', 0.15), 90); };
  const sndFinish = () => { beep(660, 0.1); setTimeout(() => beep(880, 0.12), 90); };
  const sndWin = () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.18), i * 130));
  const sndNope = () => beep(180, 0.12, 'triangle');

  // ---------- Game state ----------
  let players = [];       // {color,name,isBot,tokens:[pos,...],done}
  let turnIdx = 0;
  let dice = 0;
  let sixStreak = 0;
  let state = 'menu';     // menu | roll | pick | anim | over
  let movable = [];       // token indexes jo is dice pe chal sakte hain
  let gameId = 0;         // stale timeout guard
  let pendingTimeouts = [];

  function later(fn, ms) {
    const id = gameId;
    const t = setTimeout(() => { if (id === gameId) fn(); }, ms);
    pendingTimeouts.push(t);
  }
  function clearTimers() { gameId++; pendingTimeouts.forEach(clearTimeout); pendingTimeouts = []; }

  // ---------- Setup ----------
  function startGame(mode, ppCount2) {
    clearTimers();
    const order = mode === 'pass' && ppCount2 === 2 ? ['red', 'yellow'] : COLORS.slice(0, mode === 'pass' ? ppCount2 : 4);
    players = order.map((c, i) => ({
      color: c,
      name: mode === 'vsbot' ? (i === 0 ? 'Tum' : 'Bot ' + i) : 'Player ' + (i + 1),
      isBot: mode === 'vsbot' ? i !== 0 : false,
      tokens: [-1, -1, -1, -1],
      done: 0,
    }));
    turnIdx = 0; dice = 0; sixStreak = 0; movable = []; state = 'roll';
    overlay.classList.add('hidden');
    startBtn.classList.add('hidden');
    buildTray();
    render();
    beginTurn();
  }

  // ---------- Dice tray (har player ka apna dice) ----------
  function buildTray() {
    diceTray.innerHTML = '';
    players.forEach((p, idx) => {
      const wrap = document.createElement('div');
      wrap.className = 'die-wrap';
      const die = document.createElement('div');
      die.className = 'die noimg';
      die.dataset.idx = idx;
      die.style.setProperty('--die-col', COL[p.color].main);
      applyDieBg(p, die);
      const name = document.createElement('div');
      name.className = 'die-name';
      name.textContent = (p.isBot ? '🤖 ' : '🧑 ') + p.name;
      wrap.appendChild(die);
      wrap.appendChild(name);
      diceTray.appendChild(wrap);
      p._dieEl = die;
    });
    refreshTray();
  }
  function applyDieBg(p, dieEl) {
    const die = dieEl || p._dieEl;
    if (!die) return;
    const bg = DICE_BG[p.color];
    if (bg) {
      die.style.backgroundImage = `url(${bg})`;
      die.classList.remove('noimg');
    } else {
      die.style.backgroundImage = '';
      die.classList.add('noimg');
    }
  }
  function refreshTray() {
    players.forEach((p, idx) => {
      const die = p._dieEl;
      if (!die) return;
      die.classList.toggle('active', idx === turnIdx && state !== 'menu' && state !== 'over');
      die.classList.toggle('can-roll', idx === turnIdx && !p.isBot && state === 'roll');
    });
  }
  function setFace(die, n) {
    die.querySelectorAll('.pip').forEach((e) => e.remove());
    if (!n) return;
    const P = {
      1: [[50, 50]],
      2: [[27, 27], [73, 73]],
      3: [[27, 27], [50, 50], [73, 73]],
      4: [[27, 27], [73, 27], [27, 73], [73, 73]],
      5: [[27, 27], [73, 27], [50, 50], [27, 73], [73, 73]],
      6: [[27, 25], [73, 25], [27, 50], [73, 50], [27, 75], [73, 75]],
    };
    for (const [x, y] of P[n]) {
      const d = document.createElement('span');
      d.className = 'pip';
      d.style.left = x + '%';
      d.style.top = y + '%';
      die.appendChild(d);
    }
  }

  function beginTurn() {
    state = 'roll';
    const p = players[turnIdx];
    turnEl.textContent = (p.isBot ? '🤖 ' : '🧑 ') + p.name;
    diceHint.textContent = p.isBot ? p.name + ' apna dice roll kar raha hai...' : 'Apna dice dabaao!';
    refreshTray();
    render();
    if (p.isBot) later(botRoll, 700);
  }

  // ---------- Dice ----------
  function rollDiceAnim(done) {
    state = 'anim';
    const die = players[turnIdx]._dieEl;
    die.classList.add('rolling');
    let n = 0;
    const iv = setInterval(() => {
      setFace(die, 1 + Math.floor(Math.random() * 6));
      if (++n >= 8) {
        clearInterval(iv);
        die.classList.remove('rolling');
        dice = 1 + Math.floor(Math.random() * 6);
        setFace(die, dice);
        sndRoll();
        done();
      }
    }, 75);
  }

  function afterRoll() {
    const p = players[turnIdx];
    sixStreak = dice === 6 ? sixStreak + 1 : 0;
    if (sixStreak >= 3) {
      diceHint.textContent = '3 six lag gaye — turn khatam! 😅';
      sndNope();
      later(nextTurn, 900);
      return;
    }
    movable = getMovable();
    if (movable.length === 0) {
      diceHint.textContent = dice === 6 ? 'Koi move nahi — phir roll karo! 🎲' : 'Koi move nahi 😐';
      later(dice === 6 ? beginRoll : nextTurn, 850);
      return;
    }
    if (p.isBot) {
      state = 'pick';
      later(() => doMove(pickBotMove()), 450);
    } else if (movable.length === 1) {
      state = 'pick';
      diceHint.textContent = 'Auto move...';
      later(() => doMove(movable[0]), 500);
    } else {
      state = 'pick';
      diceHint.textContent = 'Apna token tap karo 👆';
      render(); // highlight start
    }
  }

  function beginRoll() {
    const p = players[turnIdx];
    if (p.isBot) { later(botRoll, 500); return; }
    state = 'roll';
    diceHint.textContent = 'Extra turn — dice dobara dabao! 🎲';
    refreshTray();
  }

  function botRoll() { rollDiceAnim(afterRoll); }

  function getMovable() {
    const p = players[turnIdx];
    const out = [];
    for (let i = 0; i < 4; i++) {
      const pos = p.tokens[i];
      if (pos === -1) { if (dice === 6) out.push(i); }
      else if (pos < 56 && pos + dice <= 56) out.push(i);
    }
    return out;
  }

  // ---------- Move ----------
  function tokenAbs(p, pos) { return (START[p.color] + pos) % 52; }

  function doMove(tokIdx) {
    if (state === 'anim' || state === 'over' || state === 'menu') return; // double-fire guard
    state = 'anim';
    refreshTray();
    const p = players[turnIdx];
    const from = p.tokens[tokIdx];
    let target;
    if (from === -1) target = 0; // bahar niklo -> start cell
    else target = from + dice;
    const steps = from === -1 ? 1 : dice;

    // step-by-step animation
    let cur = from === -1 ? -1 : from;
    let step = 0;
    const iv = setInterval(() => {
      if (cur !== -1) cur++;
      if (from === -1) { cur = 0; }
      p.tokens[tokIdx] = cur;
      sndMove();
      render();
      if (cur === target || (++step >= steps && cur === target)) {
        clearInterval(iv);
        resolveLanding(tokIdx, from, target);
      } else if (step >= steps && cur !== target) {
        clearInterval(iv);
        resolveLanding(tokIdx, from, target);
      }
    }, 90);
  }

  function resolveLanding(tokIdx, from, target) {
    const p = players[turnIdx];
    p.tokens[tokIdx] = target;
    let extra = dice === 6;
    let captured = false;
    let finished = false;

    if (target <= 50) {
      const abs = tokenAbs(p, target);
      if (!SAFE.has(abs)) {
        for (const q of players) {
          if (q === p) continue;
          for (let i = 0; i < 4; i++) {
            if (q.tokens[i] >= 0 && q.tokens[i] <= 50 && tokenAbs(q, q.tokens[i]) === abs) {
              q.tokens[i] = -1;
              captured = true;
            }
          }
        }
      }
    }
    if (target === 56) {
      p.done++;
      finished = true;
      extra = true;
    }
    render();

    if (captured) { sndCapture(); diceHint.textContent = '💥 Dushman ka token kat!'; }
    else if (finished) { sndFinish(); diceHint.textContent = '🏠 Ghar pahunch gaya!'; }
    else if (extra) { diceHint.textContent = '6! Extra turn 🎲'; }

    // win check
    if (p.done === 4) { gameOver(p); return; }

    if (extra) later(beginRoll, captured || finished ? 750 : 350);
    else later(nextTurn, 500);
  }

  function nextTurn() {
    sixStreak = 0;
    turnIdx = (turnIdx + 1) % players.length;
    beginTurn();
  }

  // ---------- Bot AI ----------
  function pickBotMove() {
    const p = players[turnIdx];
    let best = movable[0], bestScore = -1e9;
    const onTrack = p.tokens.filter((t) => t >= 0 && t <= 50).length;
    for (const i of movable) {
      const pos = p.tokens[i];
      let s = Math.random() * 5; // thoda randomness
      const target = pos === -1 ? 0 : pos + dice;
      if (target === 56) s += 100;
      if (pos === -1) s += onTrack < 2 ? 45 : 10;
      if (target <= 50) {
        const abs = tokenAbs(p, target);
        // capture?
        let cap = false;
        for (const q of players) {
          if (q === p) continue;
          for (const t of q.tokens) if (t >= 0 && t <= 50 && tokenAbs(q, t) === abs) cap = true;
        }
        if (cap && !SAFE.has(abs)) s += 85;
        if (SAFE.has(abs)) s += 15;
        // danger: peeche 1-6 me dushman
        if (!SAFE.has(abs)) {
          for (const q of players) {
            if (q === p) continue;
            for (const t of q.tokens) {
              if (t < 0 || t > 50) continue;
              const qa = tokenAbs(q, t);
              const d = (abs - qa + 52) % 52;
              if (d >= 1 && d <= 6) s -= 22;
            }
          }
        }
        // escape current danger
        if (pos >= 0 && pos <= 50) {
          const cur = tokenAbs(p, pos);
          if (!SAFE.has(cur)) {
            for (const q of players) {
              if (q === p) continue;
              for (const t of q.tokens) {
                if (t < 0 || t > 50) continue;
                const d = (cur - tokenAbs(q, t) + 52) % 52;
                if (d >= 1 && d <= 6) s += 25;
              }
            }
          }
        }
      }
      s += pos * 0.4; // aage wale token ko prefer
      if (s > bestScore) { bestScore = s; best = i; }
    }
    return best;
  }

  // ---------- Tap input ----------
  function tokenPixel(p, tokIdx) {
    const pos = p.tokens[tokIdx];
    let cx, cy;
    if (pos === -1) {
      const [yc, yr] = YARD_RECT[p.color];
      const [sc, sr] = YARD_SLOTS[tokIdx];
      cx = OFF + (yc + sc) * CELL + CELL / 2;
      cy = OFF + (yr + sr) * CELL + CELL / 2;
    } else if (pos <= 50) {
      const [c, r] = TRACK[tokenAbs(p, pos)];
      cx = OFF + c * CELL + CELL / 2;
      cy = OFF + r * CELL + CELL / 2;
    } else if (pos <= 55) {
      const [c, r] = HOME_LANE[p.color][pos - 51];
      cx = OFF + c * CELL + CELL / 2;
      cy = OFF + r * CELL + CELL / 2;
    } else {
      const t = TRI_POS[p.color];
      cx = OFF + t[0] * CELL; cy = OFF + t[1] * CELL;
    }
    return [cx, cy];
  }
  const TRI_POS = { red: [6.5, 7.5], green: [7.5, 6.5], yellow: [8.5, 7.5], blue: [7.5, 8.5] };

  canvas.addEventListener('pointerdown', (e) => {
    if (state !== 'pick') return;
    const p = players[turnIdx];
    if (p.isBot) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    let hit = -1, hd = 1e9;
    for (const i of movable) {
      const [tx, ty] = tokenPixel(p, i);
      const d = Math.hypot(x - tx, y - ty);
      if (d < 26 && d < hd) { hd = d; hit = i; }
    }
    if (hit >= 0) doMove(hit);
    else sndNope();
  });

  // ---------- Rendering ----------
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function render() {
    // bg
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // yards
    for (const c of COLORS) {
      const [yc, yr] = YARD_RECT[c];
      const x = OFF + yc * CELL, y = OFF + yr * CELL, s = 6 * CELL;
      ctx.fillStyle = COL[c].main;
      roundRect(x + 2, y + 2, s - 4, s - 4, 16); ctx.fill();
      ctx.fillStyle = '#fff';
      roundRect(x + 30, y + 30, s - 60, s - 60, 12); ctx.fill();
      // slots
      for (const [sc, sr] of YARD_SLOTS) {
        ctx.beginPath();
        ctx.arc(x + sc * CELL + CELL / 2, y + sr * CELL + CELL / 2, 11, 0, Math.PI * 2);
        ctx.strokeStyle = COL[c].main; ctx.lineWidth = 3; ctx.stroke();
      }
    }
    // track cells
    for (let i = 0; i < 52; i++) {
      const [c, r] = TRACK[i];
      const x = OFF + c * CELL, y = OFF + r * CELL;
      ctx.fillStyle = '#fff';
      ctx.fillRect(x, y, CELL, CELL);
      ctx.strokeStyle = '#d8c9b4'; ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1);
      const owner = Object.keys(START).find((k) => START[k] === i);
      if (owner) { // start cell
        ctx.fillStyle = COL[owner].light;
        ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
        ctx.fillStyle = COL[owner].main;
        ctx.font = '13px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('➜', x + CELL / 2, y + CELL / 2 + 1);
      } else if (SAFE.has(i)) {
        ctx.fillStyle = '#fbbf24';
        ctx.font = '14px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('★', x + CELL / 2, y + CELL / 2 + 1);
      }
    }
    // home lanes
    for (const c of COLORS) {
      for (const [c2, r2] of HOME_LANE[c]) {
        ctx.fillStyle = COL[c].main;
        ctx.fillRect(OFF + c2 * CELL + 1, OFF + r2 * CELL + 1, CELL - 2, CELL - 2);
      }
    }
    // center triangles
    const cx0 = OFF + 6 * CELL, cy0 = OFF + 6 * CELL, cs = 3 * CELL;
    const tris = [
      { c: 'red', pts: [[cx0, cy0], [cx0 + cs, cy0 + cs / 2], [cx0, cy0 + cs]] },
      { c: 'green', pts: [[cx0, cy0], [cx0 + cs / 2, cy0], [cx0 + cs, cy0 + cs / 2]] },
      { c: 'yellow', pts: [[cx0 + cs, cy0], [cx0 + cs, cy0 + cs], [cx0 + cs / 2, cy0 + cs]] },
      { c: 'blue', pts: [[cx0, cy0 + cs], [cx0 + cs, cy0 + cs], [cx0 + cs / 2, cy0]] },
    ];
    // fix triangle geometry: 4 triangles meeting at center point
    const midX = cx0 + cs / 2, midY = cy0 + cs / 2;
    tris[0].pts = [[cx0, cy0], [midX, midY], [cx0, cy0 + cs]];
    tris[1].pts = [[cx0, cy0], [cx0 + cs, cy0], [midX, midY]];
    tris[2].pts = [[cx0 + cs, cy0], [cx0 + cs, cy0 + cs], [midX, midY]];
    tris[3].pts = [[cx0, cy0 + cs], [cx0 + cs, cy0 + cs], [midX, midY]];
    for (const t of tris) {
      ctx.fillStyle = COL[t.c].main;
      ctx.beginPath();
      ctx.moveTo(t.pts[0][0], t.pts[0][1]);
      ctx.lineTo(t.pts[1][0], t.pts[1][1]);
      ctx.lineTo(t.pts[2][0], t.pts[2][1]);
      ctx.closePath(); ctx.fill();
    }
    // tokens (stack offset)
    const groups = {};
    for (const p of players) {
      for (let i = 0; i < 4; i++) {
        const key = tokenKey(p, i);
        (groups[key] = groups[key] || []).push([p, i]);
      }
    }
    for (const key in groups) {
      const g = groups[key];
      g.forEach(([p, i], gi) => {
        let [x, y] = tokenPixel(p, i);
        if (g.length > 1 && p.tokens[i] !== -1 && p.tokens[i] !== 56) {
          const a = (gi / g.length) * Math.PI * 2;
          x += Math.cos(a) * 7; y += Math.sin(a) * 7;
        }
        drawToken(x, y, p, i, g.length);
      });
    }
    // highlight movable (human pick state)
    if (state === 'pick' && movable.length && !players[turnIdx].isBot) {
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 180);
      for (const i of movable) {
        const [x, y] = tokenPixel(players[turnIdx], i);
        ctx.beginPath();
        ctx.arc(x, y, 15 + pulse * 3, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(251,191,36,${0.5 + pulse * 0.5})`;
        ctx.lineWidth = 3.5;
        ctx.stroke();
      }
      requestAnimationFrame(render);
    }
    // progress HUD
    if (players.length) {
      progEl.textContent = players.map((p) => emojiOf(p.color) + p.done).join(' ');
    }
  }

  function tokenKey(p, i) {
    const pos = p.tokens[i];
    if (pos === -1 || pos === 56) return p.color + ':' + i;
    if (pos <= 50) return 't' + tokenAbs(p, pos);
    return 'h' + p.color + ':' + pos;
  }
  function emojiOf(c) { return { red: '🔴', green: '🟢', yellow: '🟡', blue: '🔵' }[c]; }

  function drawToken(x, y, p, i, stack) {
    const img = TOKEN_IMGS[p.color];
    const loaded = img && img.complete && img.naturalWidth > 0;
    ctx.save();
    // ground shadow
    ctx.beginPath();
    ctx.ellipse(x, y + 8, 9, 3.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    ctx.fill();
    if (loaded) {
      const s = p.tokens[i] === 56 ? 0.62 : 1; // ghar pahunchi goti chhoti
      const w = 26 * s, h = 32 * s;
      ctx.drawImage(img, x - w / 2, y + 8 - h, w, h);
    } else {
      // fallback: circle token
      ctx.beginPath();
      ctx.arc(x, y - 3, 11, 0, Math.PI * 2);
      ctx.fillStyle = COL[p.color].main;
      ctx.fill();
      ctx.strokeStyle = COL[p.color].dark;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x - 3.5, y - 6.5, 3.2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      ctx.fill();
    }
    if (stack > 1 && p.tokens[i] !== -1 && p.tokens[i] !== 56) {
      ctx.beginPath();
      ctx.arc(x + 10, y - 12, 7.5, 0, Math.PI * 2);
      ctx.fillStyle = '#1e293b';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = '900 9px Nunito Sans';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(stack, x + 10, y - 11);
    }
    ctx.restore();
  }

  // ---------- Game over ----------
  function gameOver(winner) {
    state = 'over';
    clearTimers();
    sndWin();
    const humanWon = winner.isBot === false;
    let reward = '';
    if (humanWon) {
      try {
        const c = parseInt(localStorage.getItem('coins') || '0', 10) + 100;
        localStorage.setItem('coins', String(c));
        const gp = parseInt(localStorage.getItem('games_played') || '0', 10) + 1;
        localStorage.setItem('games_played', String(gp));
        reward = ' · 🎁 +100 coins!';
      } catch (e) { /* ignore */ }
    } else {
      try {
        const gp = parseInt(localStorage.getItem('games_played') || '0', 10) + 1;
        localStorage.setItem('games_played', String(gp));
      } catch (e) { /* ignore */ }
    }
    ovSub.innerHTML = `🏆 <b style="color:${COL[winner.color].dark}">${winner.name}</b> jeet gaya!${reward}`;
    ovSub.style.fontSize = '15px';
    overlay.classList.remove('hidden');
    startBtn.classList.remove('hidden');
    diceHint.textContent = 'Khel khatam!';
    refreshTray();
  }

  // ---------- Menu wiring ----------
  document.getElementById('btn-vsbot').addEventListener('click', () => startGame('vsbot'));
  document.getElementById('btn-passplay').addEventListener('click', () => {
    ppCount.classList.toggle('hidden');
  });
  ppCount.querySelectorAll('button').forEach((b) => {
    b.addEventListener('click', () => startGame('pass', parseInt(b.dataset.n, 10)));
  });
  startBtn.addEventListener('click', () => {
    const n = players.length;
    const isVs = players.some((p) => p.isBot);
    startGame(isVs ? 'vsbot' : 'pass', isVs ? undefined : (n === 2 && players[0].color === 'red' && players[1].color === 'yellow' ? 2 : n));
  });

  // apna dice dabaao -> roll
  diceTray.addEventListener('click', (e) => {
    const die = e.target.closest('.die');
    if (!die) return;
    const idx = parseInt(die.dataset.idx, 10);
    if (state !== 'roll' || idx !== turnIdx) return;
    if (players[idx].isBot) return;
    rollDiceAnim(afterRoll);
  });

  loadAssets();
  render();
  // debug hook (testing)
  window.__ludo = () => ({ state, dice, turnIdx, movable, players: players.map((p) => ({ color: p.color, isBot: p.isBot, tokens: p.tokens.slice(), done: p.done })) });
})();
