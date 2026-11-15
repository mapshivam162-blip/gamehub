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
    // Saanp / seedhi markers
    Object.keys(LADDERS).forEach(function (from) {
      cells[from].classList.add('ladder-base');
      cells[from].insertAdjacentHTML('beforeend', '<span class="mark">🪜</span>');
      cells[LADDERS[from]].classList.add('ladder-top');
    });
    Object.keys(SNAKES).forEach(function (from) {
      cells[from].classList.add('snake-head');
      cells[from].insertAdjacentHTML('beforeend', '<span class="mark">🐍</span>');
      cells[SNAKES[from]].classList.add('snake-tail');
    });
    cells[WIN].insertAdjacentHTML('beforeend', '<span class="mark">🏁</span>');
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
      const boardRect = boardEl.getBoundingClientRect();
      target = {
        left: 8 + i * 22,
        top: 100 - 8,
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
