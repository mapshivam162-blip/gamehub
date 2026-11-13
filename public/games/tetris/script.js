// Tetris — GameHub
const COLS = 10, ROWS = 20, CELL = 20;
const COLORS = {
  I: '#00f0f0', O: '#f0f000', T: '#a000f0', S: '#00f000',
  Z: '#f00000', J: '#0000f0', L: '#f0a000'
};

const PIECES = [
  { name:'I', color:COLORS.I, rot:[
    [[0,1],[1,1],[2,1],[3,1]],
    [[2,0],[2,1],[2,2],[2,3]],
    [[0,2],[1,2],[2,2],[3,2]],
    [[1,0],[1,1],[1,2],[1,3]],
  ]},
  { name:'O', color:COLORS.O, rot:[
    [[1,0],[2,0],[1,1],[2,1]],
    [[1,0],[2,0],[1,1],[2,1]],
    [[1,0],[2,0],[1,1],[2,1]],
    [[1,0],[2,0],[1,1],[2,1]],
  ]},
  { name:'T', color:COLORS.T, rot:[
    [[1,0],[0,1],[1,1],[2,1]],
    [[1,0],[1,1],[2,1],[1,2]],
    [[0,1],[1,1],[2,1],[1,2]],
    [[1,0],[0,1],[1,1],[1,2]],
  ]},
  { name:'S', color:COLORS.S, rot:[
    [[1,0],[2,0],[0,1],[1,1]],
    [[1,0],[1,1],[2,1],[2,2]],
    [[1,1],[2,1],[0,2],[1,2]],
    [[0,0],[0,1],[1,1],[1,2]],
  ]},
  { name:'Z', color:COLORS.Z, rot:[
    [[0,0],[1,0],[1,1],[2,1]],
    [[2,0],[1,1],[2,1],[1,2]],
    [[0,1],[1,1],[1,2],[2,2]],
    [[1,0],[0,1],[1,1],[0,2]],
  ]},
  { name:'J', color:COLORS.J, rot:[
    [[0,0],[0,1],[1,1],[2,1]],
    [[1,0],[2,0],[1,1],[1,2]],
    [[0,1],[1,1],[2,1],[2,2]],
    [[1,0],[1,1],[0,2],[1,2]],
  ]},
  { name:'L', color:COLORS.L, rot:[
    [[2,0],[0,1],[1,1],[2,1]],
    [[1,0],[1,1],[1,2],[2,2]],
    [[0,1],[1,1],[2,1],[0,2]],
    [[0,0],[1,0],[1,1],[1,2]],
  ]},
];

let board = []; // 2D array [row][col], null or color
let current = null; // { piece, rotIdx, x, y }
let nextPiece = null;
let holdPiece = null;
let canHold = true;
let score = 0, lines = 0, level = 1;
let best = parseInt(localStorage.getItem('best_score') || '0', 10);
let gameOver = false, paused = false, started = false;
let dropTimer = 0, dropInterval = 1000;
let lastTime = 0;
let rafId = null;

const boardCanvas = document.getElementById('board');
const bctx = boardCanvas.getContext('2d');
const nextCanvas = document.getElementById('next');
const nctx = nextCanvas.getContext('2d');
const holdCanvas = document.getElementById('hold');
const hctx = holdCanvas.getContext('2d');

const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const ovIcon = document.getElementById('ov-icon');
const ovTitle = document.getElementById('ov-title');
const ovSub = document.getElementById('ov-sub');
const startBtn = document.getElementById('start-btn');

bestEl.textContent = best;

function emptyBoard() {
  board = Array.from({length: ROWS}, () => Array(COLS).fill(null));
}

function randomPiece() {
  const p = PIECES[Math.floor(Math.random() * PIECES.length)];
  return { piece: p, rotIdx: 0, x: 3, y: 0 };
}

function cellsOf(p) {
  return p.piece.rot[p.rotIdx].map(([cx, cy]) => ({ x: p.x + cx, y: p.y + cy }));
}

function valid(p) {
  for (const {x, y} of cellsOf(p)) {
    if (x < 0 || x >= COLS || y >= ROWS) return false;
    if (y >= 0 && board[y][x]) return false;
  }
  return true;
}

function lock() {
  for (const {x, y} of cellsOf(current)) {
    if (y >= 0) board[y][x] = current.piece.color;
  }
  // clear lines
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(c => c)) {
      board.splice(r, 1);
      board.unshift(Array(COLS).fill(null));
      cleared++;
      r++; // re-check same row index
    }
  }
  if (cleared > 0) {
    const pts = [0, 100, 300, 500, 800][cleared] * level;
    score += pts;
    lines += cleared;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 80);
  }
  scoreEl.textContent = score;
  linesEl.textContent = lines;
  levelEl.textContent = level;

  // next piece
  current = nextPiece;
  nextPiece = randomPiece();
  canHold = true;
  if (!valid(current)) {
    // game over
    endGame();
  }
}

function move(dx, dy) {
  if (gameOver || paused) return false;
  const np = { ...current, x: current.x + dx, y: current.y + dy };
  if (valid(np)) { current = np; return true; }
  return false;
}

function rotate() {
  if (gameOver || paused) return;
  const np = { ...current, rotIdx: (current.rotIdx + 1) % 4 };
  if (valid(np)) current = np;
  else {
    // wall kick simple
    for (const k of [-1, 1, -2, 2]) {
      const kp = { ...np, x: np.x + k };
      if (valid(kp)) { current = kp; return; }
    }
  }
}

function hardDrop() {
  if (gameOver || paused) return;
  while (move(0, 1)) {}
  lock();
}

function softDrop() {
  if (gameOver || paused) return;
  if (!move(0, 1)) lock();
  else score += 1;
  scoreEl.textContent = score;
}

function hold() {
  if (gameOver || paused || !canHold) return;
  if (holdPiece) {
    const tmp = holdPiece;
    holdPiece = current.piece;
    current = { piece: tmp, rotIdx: 0, x: 3, y: 0 };
  } else {
    holdPiece = current.piece;
    current = nextPiece;
    nextPiece = randomPiece();
  }
  canHold = false;
  if (!valid(current)) endGame();
}

function drawCell(ctx, x, y, color, size = CELL) {
  ctx.fillStyle = color;
  ctx.fillRect(x * size, y * size, size, size);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x * size + 0.5, y * size + 0.5, size - 1, size - 1);
  // highlight
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(x * size + 1, y * size + 1, size - 2, 3);
}

function draw() {
  // board
  bctx.fillStyle = '#161a36';
  bctx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);
  // grid
  bctx.strokeStyle = 'rgba(255,255,255,0.05)';
  bctx.lineWidth = 1;
  for (let c = 0; c <= COLS; c++) {
    bctx.beginPath(); bctx.moveTo(c * CELL, 0); bctx.lineTo(c * CELL, ROWS * CELL); bctx.stroke();
  }
  for (let r = 0; r <= ROWS; r++) {
    bctx.beginPath(); bctx.moveTo(0, r * CELL); bctx.lineTo(COLS * CELL, r * CELL); bctx.stroke();
  }
  // locked
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c]) drawCell(bctx, c, r, board[r][c]);
    }
  }
  // ghost
  if (current && !gameOver) {
    let gy = current.y;
    while (true) {
      const test = { ...current, y: gy + 1 };
      if (valid(test)) gy++; else break;
    }
    if (gy !== current.y) {
      bctx.globalAlpha = 0.25;
      for (const {x, y} of cellsOf({ ...current, y: gy })) {
        if (y >= 0) drawCell(bctx, x, y, current.piece.color);
      }
      bctx.globalAlpha = 1;
    }
    // current piece
    for (const {x, y} of cellsOf(current)) {
      if (y >= 0) drawCell(bctx, x, y, current.piece.color);
    }
  }
  // next
  nctx.fillStyle = '#161a36';
  nctx.fillRect(0, 0, 80, 80);
  if (nextPiece) drawMini(nctx, nextPiece.piece, 4, 4, 16);
  // hold
  hctx.fillStyle = '#161a36';
  hctx.fillRect(0, 0, 80, 80);
  if (holdPiece) drawMini(hctx, holdPiece, 4, 4, 16);
}

function drawMini(ctx, piece, ox, oy, size) {
  const rot = piece.rot[0];
  const xs = rot.map(c => c[0]), ys = rot.map(c => c[1]);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const w = Math.max(...xs) - minX + 1, h = Math.max(...ys) - minY + 1;
  const offX = ox + (4 - w) * size / 2 - minX * size;
  const offY = oy + (4 - h) * size / 2 - minY * size;
  ctx.fillStyle = piece.color;
  for (const [cx, cy] of rot) {
    ctx.fillRect(offX + cx * size, offY + cy * size, size - 1, size - 1);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.strokeRect(offX + cx * size + 0.5, offY + cy * size + 0.5, size - 2, size - 2);
  }
}

function endGame() {
  gameOver = true;
  if (score > best) { best = score; localStorage.setItem('best_score', String(best)); bestEl.textContent = best; }
  // GameHub rewards
  try {
    const c = parseInt(localStorage.getItem('coins') || '1500', 10) + Math.floor(score / 10);
    localStorage.setItem('coins', String(c));
    const gp = parseInt(localStorage.getItem('games_played') || '0', 10) + 1;
    localStorage.setItem('games_played', String(gp));
  } catch (e) {}
  ovIcon.textContent = '💀';
  ovTitle.textContent = 'Game Over!';
  ovSub.textContent = `Score: ${score} · Lines: ${lines}`;
  const btn = document.getElementById('start-btn');
  btn.textContent = '🔁 Play Again';
  overlay.style.display = 'flex';
}

function startGame() {
  emptyBoard();
  score = 0; lines = 0; level = 1;
  dropInterval = 1000; dropTimer = 0;
  holdPiece = null; canHold = true;
  gameOver = false; paused = false; started = true;
  scoreEl.textContent = '0'; linesEl.textContent = '0'; levelEl.textContent = '1';
  current = randomPiece();
  nextPiece = randomPiece();
  ovIcon.textContent = '🧱';
  ovTitle.textContent = 'Tetris';
  ovSub.textContent = 'Arrow keys / buttons se khelo';
  document.getElementById('start-btn').textContent = '▶ Start Game';
  overlay.style.display = 'none';
  lastTime = performance.now();
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);
}

function loop(ts) {
  if (gameOver) return;
  const dt = ts - lastTime;
  lastTime = ts;
  if (!paused) {
    dropTimer += dt;
    if (dropTimer >= dropInterval) {
      dropTimer = 0;
      if (!move(0, 1)) lock();
    }
  }
  draw();
  rafId = requestAnimationFrame(loop);
}

// Controls
document.getElementById('btn-left').addEventListener('click', () => move(-1, 0) && draw());
document.getElementById('btn-right').addEventListener('click', () => move(1, 0) && draw());
document.getElementById('btn-rot').addEventListener('click', () => { rotate(); draw(); });
document.getElementById('btn-soft').addEventListener('click', () => { softDrop(); draw(); });
document.getElementById('btn-drop').addEventListener('click', () => { hardDrop(); draw(); });
startBtn.addEventListener('click', startGame);

// Keyboard
document.addEventListener('keydown', (e) => {
  if (gameOver) return;
  if (e.key === 'ArrowLeft') { move(-1, 0); draw(); e.preventDefault(); }
  else if (e.key === 'ArrowRight') { move(1, 0); draw(); e.preventDefault(); }
  else if (e.key === 'ArrowDown') { softDrop(); draw(); e.preventDefault(); }
  else if (e.key === 'ArrowUp') { rotate(); draw(); e.preventDefault(); }
  else if (e.code === 'Space') { hardDrop(); draw(); e.preventDefault(); }
});

// Touch swipe on board
const boardEl = document.getElementById('board');
let tsx = 0, tsy = 0, tswiped = false;
boardEl.addEventListener('touchstart', (e) => {
  tsx = e.touches[0].clientX; tsy = e.touches[0].clientY; tswiped = false;
}, { passive: true });
boardEl.addEventListener('touchmove', (e) => {
  if (tswiped) return;
  const dx = e.touches[0].clientX - tsx;
  const dy = e.touches[0].clientY - tsy;
  if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
  tswiped = true;
  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx > 0) move(1, 0); else move(-1, 0);
  } else {
    if (dy > 0) softDrop(); else rotate();
  }
  draw();
}, { passive: true });

// Init
emptyBoard();
draw();
bestEl.textContent = best;
overlay.style.display = 'flex';
