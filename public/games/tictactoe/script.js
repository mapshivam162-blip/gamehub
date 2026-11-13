// Tic-Tac-Toe — GameHub (modern casual 3D style)
// Supports 1 Player (vs CPU: Easy/Medium/Hard) and 2 Player (same device)

const WIN_PATTERNS = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6]
];

let mode = '1p';       // '1p' | '2p'
let difficulty = 'medium';
let playerMark = 'X';  // player 1's mark
let board = Array(9).fill(null);
let current = 'X';
let gameOver = false;
let scores = { X: 0, tie: 0, O: 0 };

const cells = [...document.querySelectorAll('.cell')];
const turnIcon = document.getElementById('turn-icon');
const turnText = document.getElementById('turn-text');
const scoreX = document.getElementById('score-x');
const scoreO = document.getElementById('score-o');
const scoreTie = document.getElementById('score-tie');
const p1Label = document.getElementById('p1-label');
const p2Label = document.getElementById('p2-label');
const resultModal = document.getElementById('result-modal');
const modalIcon = document.getElementById('modal-icon');
const modalTitle = document.getElementById('modal-title');
const modalSub = document.getElementById('modal-sub');

// ===== Menu wiring =====
document.querySelectorAll('.mode-btn').forEach(b => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    mode = b.dataset.mode;
    document.getElementById('diff-card').style.display = mode === '1p' ? '' : 'none';
  });
});

document.querySelectorAll('.diff-btn').forEach(b => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.diff-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    difficulty = b.dataset.diff;
  });
});

document.querySelectorAll('.mark-btn').forEach(b => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.mark-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    playerMark = b.dataset.mark;
  });
});

document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('restart-btn').addEventListener('click', resetBoard);
document.getElementById('menu-btn').addEventListener('click', () => {
  document.getElementById('game-screen').classList.remove('active');
  document.getElementById('menu-screen').classList.add('active');
});
document.getElementById('next-round-btn').addEventListener('click', () => {
  hideModal();
  resetBoard();
});
document.getElementById('quit-btn').addEventListener('click', () => {
  hideModal();
  scores = { X: 0, tie: 0, O: 0 };
  updateScoreboard();
  document.getElementById('game-screen').classList.remove('active');
  document.getElementById('menu-screen').classList.add('active');
});

cells.forEach(c => c.addEventListener('click', () => onCellClick(+c.dataset.i)));

function startGame() {
  scores = { X: 0, tie: 0, O: 0 };
  updateScoreboard();
  document.getElementById('menu-screen').classList.remove('active');
  document.getElementById('game-screen').classList.add('active');

  // Labels
  if (mode === '1p') {
    const cpuMark = playerMark === 'X' ? 'O' : 'X';
    p1Label.textContent = `${playerMark} (You)`;
    p2Label.textContent = `${cpuMark} (CPU)`;
  } else {
    p1Label.textContent = 'X (P1)';
    p2Label.textContent = 'O (P2)';
  }

  resetBoard();
}

function resetBoard() {
  board = Array(9).fill(null);
  gameOver = false;
  current = 'X';
  cells.forEach(c => {
    c.textContent = '';
    c.classList.remove('x', 'o', 'win');
    c.disabled = false;
  });
  updateTurn();
  // If CPU goes first
  if (mode === '1p' && playerMark === 'O') {
    setTimeout(cpuMove, 350);
  }
}

function onCellClick(i) {
  if (gameOver || board[i]) return;
  // In 1P mode, only allow player's turn
  if (mode === '1p') {
    const cpuMark = playerMark === 'X' ? 'O' : 'X';
    if (current !== playerMark) return;
  }
  place(i, current);
  const result = checkEnd();
  if (result) { endGame(result); return; }
  current = current === 'X' ? 'O' : 'X';
  updateTurn();
  // CPU turn
  if (mode === '1p') {
    const cpuMark = playerMark === 'X' ? 'O' : 'X';
    if (current === cpuMark && !gameOver) {
      setTimeout(cpuMove, 350);
    }
  }
}

function place(i, mark) {
  board[i] = mark;
  const cell = cells[i];
  cell.textContent = mark === 'X' ? '✖' : '⭕';
  cell.classList.add(mark === 'X' ? 'x' : 'o');
}

function cpuMove() {
  if (gameOver) return;
  const cpuMark = playerMark === 'X' ? 'O' : 'X';
  let idx;
  if (difficulty === 'easy') {
    idx = randomMove();
  } else if (difficulty === 'medium') {
    idx = Math.random() < 0.5 ? bestMove(cpuMark) : randomMove();
  } else {
    idx = bestMove(cpuMark);
  }
  if (idx === -1) return;
  place(idx, cpuMark);
  const result = checkEnd();
  if (result) { endGame(result); return; }
  current = current === 'X' ? 'O' : 'X';
  updateTurn();
}

function randomMove() {
  const empty = board.map((v,i) => v ? null : i).filter(v => v !== null);
  if (!empty.length) return -1;
  return empty[Math.floor(Math.random() * empty.length)];
}

function bestMove(me) {
  // Minimax
  const opp = me === 'X' ? 'O' : 'X';
  let bestScore = -Infinity;
  let move = -1;
  for (let i = 0; i < 9; i++) {
    if (!board[i]) {
      board[i] = me;
      const s = minimax(board, 0, false, me, opp);
      board[i] = null;
      if (s > bestScore) { bestScore = s; move = i; }
    }
  }
  return move;
}

function minimax(b, depth, isMax, me, opp) {
  const w = winnerOf(b);
  if (w === me) return 10 - depth;
  if (w === opp) return depth - 10;
  if (b.every(c => c)) return 0;
  if (isMax) {
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (!b[i]) { b[i] = me; best = Math.max(best, minimax(b, depth+1, false, me, opp)); b[i] = null; }
    }
    return best;
  } else {
    let best = Infinity;
    for (let i = 0; i < 9; i++) {
      if (!b[i]) { b[i] = opp; best = Math.min(best, minimax(b, depth+1, true, me, opp)); b[i] = null; }
    }
    return best;
  }
}

function winnerOf(b) {
  for (const [a,c,d] of WIN_PATTERNS) {
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
  }
  return null;
}

function checkEnd() {
  const w = winnerOf(board);
  if (w) {
    const pat = WIN_PATTERNS.find(([a,c,d]) => board[a] === w && board[a] === board[c] && board[a] === board[d]);
    pat.forEach(i => cells[i].classList.add('win'));
    cells.forEach(c => c.disabled = true);
    gameOver = true;
    return { type: 'win', winner: w };
  }
  if (board.every(c => c)) {
    cells.forEach(c => c.disabled = true);
    gameOver = true;
    return { type: 'draw' };
  }
  return null;
}

function endGame(result) {
  if (result.type === 'win') {
    const w = result.winner;
    scores[w]++;
    const isPlayerWin = (mode === '1p' && w === playerMark);
    modalIcon.textContent = w === 'X' ? '✖' : '⭕';
    modalTitle.textContent = `${w} WINS!`;
    modalSub.textContent = mode === '1p'
      ? (isPlayerWin ? 'Shabash! Tu jeet gaya 🎉' : 'CPU jeet gaya, phir try kar!')
      : (w === 'X' ? 'Player 1 (X) jeeta!' : 'Player 2 (O) jeeta!');
    // GameHub rewards (1P mode, player win)
    if (mode === '1p' && isPlayerWin) {
      try {
        const c = parseInt(localStorage.getItem('coins') || '1500', 10) + 10;
        localStorage.setItem('coins', String(c));
      } catch (e) {}
    }
  } else {
    scores.tie++;
    modalIcon.textContent = '🤝';
    modalTitle.textContent = 'ROUND TIED!';
    modalSub.textContent = 'Koi nahi jeeta, phir khelo!';
  }
  // games_played increment
  try {
    const gp = parseInt(localStorage.getItem('games_played') || '0', 10) + 1;
    localStorage.setItem('games_played', String(gp));
  } catch (e) {}
  updateScoreboard();
  showModal();
}

function updateTurn() {
  turnIcon.textContent = current === 'X' ? '✖' : '⭕';
  turnIcon.className = 'turn-mark ' + (current === 'X' ? 'x-mark' : 'o-mark');
  if (mode === '1p') {
    const cpuMark = playerMark === 'X' ? 'O' : 'X';
    if (current === playerMark) turnText.textContent = 'Tera turn';
    else turnText.textContent = 'CPU soch raha hai...';
  } else {
    turnText.textContent = current === 'X' ? 'Player 1 (X)' : 'Player 2 (O)';
  }
}

function updateScoreboard() {
  scoreX.textContent = scores.X;
  scoreO.textContent = scores.O;
  scoreTie.textContent = scores.tie;
}

function showModal() { resultModal.classList.add('show'); }
function hideModal() { resultModal.classList.remove('show'); }
