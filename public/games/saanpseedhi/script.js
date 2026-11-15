// Saanp Seedhi — Khelog (1 human + bots, dice, saanp-seedhi classic)
(function () {
  'use strict';

  // ===== Saanp & Seedhi map (head/base -> end) =====
  const LADDERS = { 3: 22, 8: 30, 28: 76, 36: 57, 43: 79, 51: 88, 65: 85, 71: 92 };
  const SNAKES = { 97: 61, 93: 42, 87: 24, 78: 15, 68: 45, 62: 19, 54: 31, 25: 5 };
  const WIN = 100;

  // ===== State =====
  let mode = '1p'; // '1p' = tum + 3 bot, '2p' = 2 bot duel (dekh ke maza)
  let players = [];
  let turn = 0;
  let busy = false;
  let over = false;

  const setupEl = document.getElementById('setup');
  const gameEl = document.getElementById('game');
  const boardEl = document.getElementById('board');
  const turnBar = document.getElementById('turn-bar');
  const diceBtn = document.getElementById('dice');
  const playersEl = document.getElementById('players');
  const resultModal = document.getElementById('result-modal');

  const COLORS = [
    { name: 'Tum', emoji: '🔴', c: '#ef4444' },
    { name: 'Bot 1', emoji: '🔵', c: '#3b82f6' },
    { name: 'Bot 2', emoji: '🟢', c: '#22c55e' },
    { name: 'Bot 3', emoji: '🟡', c: '#eab308' },
  ];

  // ===== Board build (10x10, boustrophedon numbering) =====
  const cells = {};
  function cellRC(n) {
    const idx = n - 1;
    const row = Math.floor(idx / 10); // 0 = bottom row
    let col = idx % 10;
    if (row % 2 === 1) col = 9 - col;
    return { row, col };
  }
  function buildBoard() {
    boardEl.innerHTML = '';
    for (let row = 9; row >= 0; row--) {
      for (let col = 0; col < 10; col++) {
        const colN = (row % 2 === 0) ? col : 9 - col;
        const n = row * 10 + colN + 1;
        const d = document.createElement('div');
        d.className = 'cell' + ((row + col) % 2 ? ' alt' : '');
        d.textContent = n;
        d.dataset.n = n;
        cells[n] = d;
        boardEl.appendChild(d);
      }
    }
    // Saanp / seedhi cell tints (art SVG me proper design draw hoga)
    Object.keys(LADDERS).forEach(function (from) {
      cells[from].classList.add('ladder-base');
      cells[LADDERS[from]].classList.add('ladder-top');
    });
    Object.keys(SNAKES).forEach(function (from) {
      cells[from].classList.add('snake-head');
      cells[SNAKES[from]].classList.add('snake-tail');
    });
    cells[WIN].insertAdjacentHTML('beforeend', '<span class="mark">🏁</span>');
    buildArt();
  }

  // ===== Real snake + ladder art (Snake game wala look) =====
  // Snake game colors: head #66ff8f -> #0eb85c, body rgba(46,224,120)->rgba(11,140,70)
  function cellCenter(n) {
    const rc = cellRC(n);
    const visRow = 9 - rc.row; // board DOM me row 9 sabse upar
    return { x: (rc.col + 0.5) * 10, y: (visRow + 0.5) * 10 };
  }

  function buildArt() {
    let svg = document.getElementById('art');
    if (!svg) {
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.id = 'art';
      svg.setAttribute('viewBox', '0 0 100 100');
      svg.setAttribute('preserveAspectRatio', 'none');
      boardEl.appendChild(svg);
    }
    svg.innerHTML = '';
    let defs = '';
    let body = '';
    let gi = 0;
    // --- Seedhi (proper rails + rungs) ---
    Object.keys(LADDERS).forEach(function (from) {
      const a = cellCenter(parseInt(from, 10));
      const b = cellCenter(LADDERS[from]);
      // seedhi ko base se thoda neeche aur top se thoda upar extend karo (real look)
      const dx = b.x - a.x, dy = b.y - a.y;
      const L = Math.hypot(dx, dy) || 1;
      const ux = dx / L, uy = dy / L;      // along ladder
      const px = -uy, py = ux;             // perpendicular
      const railOff = 1.5, ext = 1.2;
      const ax = a.x - ux * ext, ay = a.y - uy * ext;
      const bx = b.x + ux * ext, by = b.y + uy * ext;
      body += '<g opacity="0.96">';
      // shadow
      body += '<line x1="' + (ax + 0.4) + '" y1="' + (ay + 0.5) + '" x2="' + (bx + 0.4) + '" y2="' + (by + 0.5) + '" stroke="rgba(0,0,0,0.18)" stroke-width="3.4" stroke-linecap="round"/>';
      // rails (wood)
      body += '<line x1="' + (ax + px * railOff) + '" y1="' + (ay + py * railOff) + '" x2="' + (bx + px * railOff) + '" y2="' + (by + py * railOff) + '" stroke="#a06a35" stroke-width="1.15" stroke-linecap="round"/>';
      body += '<line x1="' + (ax - px * railOff) + '" y1="' + (ay - py * railOff) + '" x2="' + (bx - px * railOff) + '" y2="' + (by - py * railOff) + '" stroke="#a06a35" stroke-width="1.15" stroke-linecap="round"/>';
      // rungs har ~3 unit pe
      const step = 2.6;
      for (let t = 0.9; t < L + ext; t += step) {
        const cx = ax + ux * t, cy = ay + uy * t;
        body += '<line x1="' + (cx + px * railOff) + '" y1="' + (cy + py * railOff) + '" x2="' + (cx - px * railOff) + '" y2="' + (cy - py * railOff) + '" stroke="#c98a4b" stroke-width="0.85" stroke-linecap="round"/>';
      }
      body += '</g>';
    });
    // --- Saanp (curvy body, taper, head + eyes + tongue) ---
    Object.keys(SNAKES).forEach(function (from) {
      const head = cellCenter(parseInt(from, 10));
      const tail = cellCenter(SNAKES[from]);
      const dx = tail.x - head.x, dy = tail.y - head.y;
      const L = Math.hypot(dx, dy) || 1;
      const nx = -dy / L, ny = dx / L; // perpendicular
      const waves = 2.5;
      const amp = Math.min(3.6, L * 0.16);
      const N = Math.max(8, Math.round(L * 1.6));
      // per-snake gradient (head bright -> tail dark, Snake game wale colors)
      const gid = 'sg' + (gi++);
      defs += '<linearGradient id="' + gid + '" gradientUnits="userSpaceOnUse"' +
        ' x1="' + head.x + '" y1="' + head.y + '" x2="' + tail.x + '" y2="' + tail.y + '">' +
        '<stop offset="0" stop-color="#2ee078"/><stop offset="1" stop-color="#0b8c46"/>' +
        '</linearGradient>';
      body += '<g opacity="0.97">';
      // shadow path
      body += '<line x1="' + head.x + '" y1="' + (head.y + 0.5) + '" x2="' + tail.x + '" y2="' + (tail.y + 0.5) + '" stroke="rgba(0,0,0,0.15)" stroke-width="4.6" stroke-linecap="round"/>';
      // body circles — snake game ke segment blocks jaisa (rounded, gradient)
      const pts = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const wob = Math.sin(t * Math.PI * waves) * amp * (t > 0.08 && t < 0.95 ? 1 : 0.35);
        pts.push({ x: head.x + dx * t + nx * wob, y: head.y + dy * t + ny * wob, t: t });
      }
      // path smooth line (thick) as base
      const d = 'M ' + pts[0].x.toFixed(2) + ' ' + pts[0].y.toFixed(2) + ' ' +
        pts.slice(1).map(function (p) { return 'Q ' + p.x.toFixed(2) + ' ' + p.y.toFixed(2) + ' ' + p.x.toFixed(2) + ' ' + p.y.toFixed(2); }).join(' ');
      body += '<path d="' + d + '" fill="none" stroke="url(#' + gid + ')" stroke-width="3.1" stroke-linecap="round" stroke-linejoin="round"/>';
      // belly pattern (halki light dots, real snake scale feel)
      for (let i = 2; i < pts.length - 2; i += 2) {
        body += '<circle cx="' + pts[i].x.toFixed(2) + '" cy="' + pts[i].y.toFixed(2) + '" r="0.55" fill="rgba(255,255,255,0.35)"/>';
      }
      // taper tail
      body += '<circle cx="' + tail.x.toFixed(2) + '" cy="' + tail.y.toFixed(2) + '" r="1.05" fill="#0b8c46"/>';
      // HEAD (snake game jaisa — bright, eyes, tongue)
      const hx = head.x, hy = head.y;
      // head ko tail ki taraf thoda jhuka do
      const hdx = nx, hdy = ny;
      body += '<circle cx="' + hx + '" cy="' + hy + '" r="2.9" fill="#66ff8f"/>';
      body += '<circle cx="' + hx + '" cy="' + hy + '" r="2.9" fill="none" stroke="rgba(8,19,11,0.35)" stroke-width="0.3"/>';
      // highlight (snake game top highlight)
      body += '<circle cx="' + (hx - 0.6) + '" cy="' + (hy - 0.9) + '" r="1.1" fill="rgba(255,255,255,0.3)"/>';
      // eyes (tail ki taraf dekhte hue)
      const ex1 = hx + nx * 1.35, ey1 = hy + ny * 1.35;
      const ex2 = hx - nx * 1.35, ey2 = hy - ny * 1.35;
      body += '<circle cx="' + ex1 + '" cy="' + ey1 + '" r="0.8" fill="#fff"/><circle cx="' + ex1 + '" cy="' + ey1 + '" r="0.4" fill="#08130b"/>';
      body += '<circle cx="' + ex2 + '" cy="' + ey2 + '" r="0.8" fill="#fff"/><circle cx="' + ex2 + '" cy="' + ey2 + '" r="0.4" fill="#08130b"/>';
      // tongue (tail ki taraf, forked)
      const tx = hx - dx / L * 3.6, ty = hy - dy / L * 3.6;
      body += '<path d="M ' + hx + ' ' + hy + ' L ' + tx.toFixed(2) + ' ' + ty.toFixed(2) + '" stroke="#ff5252" stroke-width="0.5" fill="none"/>';
      body += '<path d="M ' + tx.toFixed(2) + ' ' + ty.toFixed(2) + ' l -0.7 -0.7 M ' + tx.toFixed(2) + ' ' + ty.toFixed(2) + ' l -0.7 0.7" stroke="#ff5252" stroke-width="0.4" fill="none"/>';
      body += '</g>';
    });
    svg.innerHTML = '<defs>' + defs + '</defs>' + body;
  }
  // ===== Tokens =====
  const tokenEls = [];
  function posOf(n) {
    if (n <= 0) { // start ke bahar — board ke neeche
      return null;
    }
    const rc = cellRC(n);
    // cell ka pixel offset
    const cell = cells[n];
    const boardRect = boardEl.getBoundingClientRect();
    const cellRect = cell.getBoundingClientRect();
    return {
      left: ((cellRect.left - boardRect.left) / boardRect.width) * 100 + 3.5,
      top: ((cellRect.top - boardRect.top) / boardRect.height) * 100 + 3.5,
    };
  }
  function stagger(i) {
    // 4 token ek cell pe thoda alag alag
    const offs = [[-4, -4], [4, -4], [-4, 4], [4, 4]];
    return offs[i % 4];
  }
  function placeToken(i, animate) {
    const p = players[i];
    const el = tokenEls[i];
    let target;
    if (p.pos <= 0) {
      // start line: board ke neeche queue
      target = {
        left: 6 + i * 7.5,
        top: 93,
      };
    } else {
      const base = posOf(Math.min(p.pos, WIN));
      const off = stagger(i);
      target = { left: base.left + off[0] * 0.6, top: base.top + off[1] * 0.6 };
    }
    if (!animate) el.style.transition = 'none';
    el.style.left = target.left + '%';
    el.style.top = target.top + '%';
    if (!animate) { void el.offsetWidth; el.style.transition = ''; }
  }

  function createTokens() {
    tokenEls.length = 0;
    boardEl.querySelectorAll('.token').forEach(function (t) { t.remove(); });
    players.forEach(function (p, i) {
      const t = document.createElement('div');
      t.className = 'token' + (p.isHuman ? ' me' : '');
      t.style.background = p.color;
      boardEl.appendChild(t);
      tokenEls.push(t);
      placeToken(i, false);
    });
  }

  // ===== Setup / start =====
  document.getElementById('mode-1p').addEventListener('click', function () {
    mode = '1p';
    this.classList.add('active');
    document.getElementById('mode-2p').classList.remove('active');
  });
  document.getElementById('mode-2p').addEventListener('click', function () {
    mode = '2p';
    this.classList.add('active');
    document.getElementById('mode-1p').classList.remove('active');
  });

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
    players = [];
    if (mode === '1p') {
      players.push({ pos: 0, color: COLORS[0].c, name: COLORS[0].name, isHuman: true });
      for (let i = 1; i < 4; i++) players.push({ pos: 0, color: COLORS[i].c, name: COLORS[i].name, isHuman: false });
    } else {
      players.push({ pos: 0, color: COLORS[1].c, name: 'Bot 🔵', isHuman: false });
      players.push({ pos: 0, color: COLORS[2].c, name: 'Bot 🟢', isHuman: false });
    }
    turn = 0;
    busy = false;
    over = false;
    setupEl.style.display = 'none';
    gameEl.style.display = '';
    buildBoard();
    createTokens();
    updatePlayersBar();
    updateTurnBar();
  }

  function updatePlayersBar() {
    playersEl.innerHTML = '';
    players.forEach(function (p, i) {
      const row = document.createElement('div');
      row.className = 'player-row' + (i === turn && !over ? ' turn' : '');
      row.innerHTML = '<span class="dot" style="background:' + p.color + '"></span>' + p.name + ' · ' + p.pos;
      playersEl.appendChild(row);
    });
  }

  function updateTurnBar() {
    const p = players[turn];
    turnBar.textContent = p.isHuman ? '🎲 Tumhari baari — dice dabao!' : '⏳ ' + p.name + ' chal raha hai...';
  }

  // ===== Dice =====
  diceBtn.addEventListener('click', rollDice);

  function rollDice() {
    if (busy || over || !players[turn].isHuman) return;
    doRoll();
  }

  function doRoll() {
    busy = true;
    diceBtn.disabled = true;
    diceBtn.classList.add('rolling');
    const val = 1 + Math.floor(Math.random() * 6);
    setTimeout(function () {
      diceBtn.classList.remove('rolling');
      diceBtn.textContent = ['🎲', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][val] || val;
      moveCurrent(val);
    }, 500);
  }

  function moveCurrent(val) {
    lastRollWasSix = (val === 6);
    const p = players[turn];
    let target = p.pos + val;
    // Win pe exact ya usse aage chal sakte (casual rule)
    if (target > WIN) target = WIN;
    animateMove(p, p.pos, target, function () {
      p.pos = target;
      // Seedhi / saanp
      if (LADDERS[p.pos]) {
        const to = LADDERS[p.pos];
        toast('🪜 Seedhi! ' + p.pos + ' → ' + to);
        animateMove(p, p.pos, to, function () { p.pos = to; endMove(true); });
        return;
      }
      if (SNAKES[p.pos]) {
        const to = SNAKES[p.pos];
        toast('🐍 Saanp! ' + p.pos + ' → ' + to);
        animateMove(p, p.pos, to, function () { p.pos = to; endMove(true); });
        return;
      }
      endMove(false);
    });
  }

  function animateMove(p, from, to, done) {
    const i = players.indexOf(p);
    p.pos = to;
    tokenEls[i].classList.add('jump');
    placeToken(i, true);
    updatePlayersBar();
    setTimeout(function () {
      tokenEls[i].classList.remove('jump');
      done();
    }, 380);
  }

  function endMove(fromBonus) {
    if (players[turn].pos >= WIN) {
      endGame(players[turn]);
      return;
    }
    // 6 aaya to extra turn (sirf normal move pe, seedhi/saanp pe nahi)
    if (!fromBonus && lastRollWasSix) {
      toast('⚡ 6! Extra turn!');
    }
    nextTurn(!fromBonus && lastRollWasSix);
  }

  let lastRollWasSix = false;
  function nextTurn(keepTurn) {
    if (!keepTurn) {
      turn = (turn + 1) % players.length;
    }
    busy = false;
    lastRollWasSix = false;
    diceBtn.disabled = players[turn].isHuman ? false : true;
    diceBtn.textContent = '🎲';
    updatePlayersBar();
    updateTurnBar();
    if (!players[turn].isHuman) {
      setTimeout(function () {
        if (!over) doRoll();
      }, 900);
    }
  }

  function toast(text) {
    turnBar.textContent = text;
  }

  // ===== End game + Khelog rewards =====
  function endGame(winner) {
    over = true;
    busy = true;
    let note = '';
    if (winner.isHuman) {
      try {
        const coins = parseInt(localStorage.getItem('coins') || '1500', 10);
        const earned = 15;
        localStorage.setItem('coins', String(coins + earned));
        localStorage.setItem('games_played', String(parseInt(localStorage.getItem('games_played') || '0', 10) + 1));
        note = '<p class="coin-note">🪙 +' + earned + ' coins kamaye!</p>';
      } catch (e) { /* ignore */ }
    } else {
      try {
        localStorage.setItem('games_played', String(parseInt(localStorage.getItem('games_played') || '0', 10) + 1));
      } catch (e) { /* ignore */ }
    }
    document.getElementById('result-emoji').textContent = winner.isHuman ? '🎉' : '🤖';
    document.getElementById('result-title').textContent = winner.isHuman ? 'Tum Jeet Gaye!' : winner.name + ' Jeet Gaya';
    document.getElementById('result-sub').innerHTML = '🏁 Pahunch gaya ' + winner.name + '!' + note;
    setTimeout(function () {
      resultModal.classList.add('show');
    }, 600);
  }
})();
