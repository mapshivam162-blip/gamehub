// Minesweeper — GameHub
const ROWS = 9, COLS = 9, MINES = 10;
let grid = []; // { mine, revealed, flagged, count }
let gameOver = false, started = false, firstClick = true;
let flagsLeft = MINES;
let time = 0, timerInterval = null;
let best = parseInt(localStorage.getItem('best_score') || '0', 10);
let flagMode = false;

const board = document.getElementById('board');
const minesEl = document.getElementById('mines');
const timeEl = document.getElementById('time');
const bestEl = document.getElementById('best');
const overlay = document.getElementById('overlay');
const ovIcon = document.getElementById('ov-icon');
const ovTitle = document.getElementById('ov-title');
const ovSub = document.getElementById('ov-sub');
const startBtn = document.getElementById('start-btn');
const flagToggle = document.getElementById('flag-toggle');

bestEl.textContent = best;
minesEl.textContent = MINES;

function initGrid() {
  grid = [];
  for (let r = 0; r < ROWS; r++) {
    const row = [];
    for (let c = 0; c < COLS; c++) {
      row.push({ mine: false, revealed: false, flagged: false, count: 0 });
    }
    grid.push(row);
  }
  flagsLeft = MINES;
  minesEl.textContent = flagsLeft;
  time = 0;
  timeEl.textContent = '0';
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
  firstClick = true;
  gameOver = false;
}

function placeMines(safeR, safeC) {
  let placed = 0;
  while (placed < MINES) {
    const r = Math.floor(Math.random() * ROWS);
    const c = Math.floor(Math.random() * COLS);
    if (grid[r][c].mine) continue;
    if (Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1) continue; // safe zone
    grid[r][c].mine = true;
    placed++;
  }
  // compute counts
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c].mine) continue;
      let cnt = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && grid[nr][nc].mine) cnt++;
        }
      }
      grid[r][c].count = cnt;
    }
  }
}

function render() {
  board.innerHTML = '';
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = grid[r][c];
      const div = document.createElement('div');
      div.className = 'cell';
      div.dataset.r = r;
      div.dataset.c = c;
      if (cell.revealed) {
        div.classList.add('revealed');
        if (cell.mine) {
          div.classList.add('mine');
          div.textContent = '💣';
        } else if (cell.count > 0) {
          div.textContent = cell.count;
          div.classList.add('num-' + cell.count);
        }
      } else if (cell.flagged) {
        div.classList.add('flag');
        div.textContent = '🚩';
      }
      div.addEventListener('click', () => onCellClick(r, c));
      board.appendChild(div);
    }
  }
}

function onCellClick(r, c) {
  if (gameOver || !started) return;
  const cell = grid[r][c];
  if (cell.revealed) return;

  if (flagMode) {
    toggleFlag(r, c);
    return;
  }

  if (cell.flagged) return;

  if (firstClick) {
    firstClick = false;
    placeMines(r, c);
    timerInterval = setInterval(() => {
      time++;
      timeEl.textContent = time;
    }, 1000);
  }

  if (cell.mine) {
    // game over
    cell.revealed = true;
    revealAllMines();
    endGame(false);
    return;
  }

  reveal(r, c);
  checkWin();
}

function toggleFlag(r, c) {
  const cell = grid[r][c];
  if (cell.revealed) return;
  if (cell.flagged) {
    cell.flagged = false;
    flagsLeft++;
  } else {
    if (flagsLeft <= 0) return;
    cell.flagged = true;
    flagsLeft--;
  }
  minesEl.textContent = flagsLeft;
  render();
}

function reveal(r, c) {
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;
  const cell = grid[r][c];
  if (cell.revealed || cell.flagged || cell.mine) return;
  cell.revealed = true;
  if (cell.count === 0) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        reveal(r + dr, c + dc);
      }
    }
  }
  render();
}

function revealAllMines() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c].mine) grid[r][c].revealed = true;
    }
  }
  render();
}

function checkWin() {
  let revealedCount = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c].revealed && !grid[r][c].mine) revealedCount++;
    }
  }
  if (revealedCount === ROWS * COLS - MINES) {
    // win
    // flag remaining mines
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c].mine) grid[r][c].flagged = true;
      }
    }
    minesEl.textContent = '0';
    endGame(true);
  }
}

function endGame(win) {
  gameOver = true;
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  if (win) {
    const score = Math.max(1, 100 - time);
    if (score > best) { best = score; localStorage.setItem('best_score', String(best)); bestEl.textContent = best; }
    try {
      const c = parseInt(localStorage.getItem('coins') || '1500', 10) + 20;
      localStorage.setItem('coins', String(c));
      const gp = parseInt(localStorage.getItem('games_played') || '0', 10) + 1;
      localStorage.setItem('games_played', String(gp));
    } catch (e) {}
    ovIcon.textContent = '🏆';
    ovTitle.textContent = 'You Win!';
    ovSub.textContent = `Time: ${time}s · Best: ${best}`;
  } else {
    try {
      const gp = parseInt(localStorage.getItem('games_played') || '0', 10) + 1;
      localStorage.setItem('games_played', String(gp));
    } catch (e) {}
    ovIcon.textContent = '💥';
    ovTitle.textContent = 'Game Over!';
    ovSub.textContent = `You hit a mine! Time: ${time}s`;
  }
  startBtn.textContent = '🔁 New Game';
  overlay.style.display = 'flex';
}

function startGame() {
  initGrid();
  render();
  started = true;
  gameOver = false;
  flagMode = false;
  flagToggle.classList.remove('active');
  flagToggle.textContent = '🚩 Flag Mode: OFF';
  ovIcon.textContent = '💣';
  ovTitle.textContent = 'Minesweeper';
  ovSub.textContent = 'Tap = reveal · Flag Mode = flag karo';
  startBtn.textContent = '▶ New Game';
  overlay.style.display = 'none';
}

flagToggle.addEventListener('click', () => {
  flagMode = !flagMode;
  flagToggle.classList.toggle('active', flagMode);
  flagToggle.textContent = flagMode ? '🚩 Flag Mode: ON' : '🚩 Flag Mode: OFF';
});

startBtn.addEventListener('click', startGame);

// Init
bestEl.textContent = best;
initGrid();
render();
overlay.style.display = 'flex';
