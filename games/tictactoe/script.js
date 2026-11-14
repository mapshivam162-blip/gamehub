// Tic-Tac-Toe — Khelog (modern casual 3D style)
// Supports 1 Player (vs CPU: Easy/Medium/Hard) and 2 Player (same device)

const WIN_PATTERNS = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6]
];

let mode = '1p';       // '1p' | '2p' | 'online'
let difficulty = 'medium';
let playerMark = 'X';  // player 1's mark
let board = Array(9).fill(null);
let current = 'X';
let gameOver = false;
let scores = { X: 0, tie: 0, O: 0 };

// ===== Online (PeerJS room) =====
let peer = null;
let conn = null;
let myMark = 'X';      // host = X, guest = O
let isHost = false;
let unread = 0;

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
    document.getElementById('mark-card').style.display = mode === 'online' ? 'none' : '';
    document.getElementById('online-card').style.display = mode === 'online' ? '' : 'none';
    document.getElementById('start-btn').style.display = mode === 'online' ? 'none' : '';
    if (mode !== 'online') endOnlineSession(true);
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
document.getElementById('restart-btn').addEventListener('click', () => {
  resetBoard();
  if (mode === 'online') { sendNet({ t: 'restart' }); addChat('sys', 'Naya round shuru!'); }
});
document.getElementById('menu-btn').addEventListener('click', () => {
  if (mode === 'online') endOnlineSession(true);
  document.getElementById('game-screen').classList.remove('active');
  document.getElementById('menu-screen').classList.add('active');
});
document.getElementById('next-round-btn').addEventListener('click', () => {
  hideModal();
  resetBoard();
  if (mode === 'online') { sendNet({ t: 'restart' }); addChat('sys', 'Naya round shuru!'); }
});
document.getElementById('quit-btn').addEventListener('click', () => {
  hideModal();
  scores = { X: 0, tie: 0, O: 0 };
  updateScoreboard();
  if (mode === 'online') endOnlineSession(true);
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
  // Online: sirf apne mark ki turn me
  if (mode === 'online') {
    if (current !== myMark) return;
    place(i, current);
    sendNet({ t: 'move', i });
    const result = checkEnd();
    if (result) { endGame(result); return; }
    current = current === 'X' ? 'O' : 'X';
    updateTurn();
    return;
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
    modalSub.textContent = mode === 'online'
      ? (w === myMark ? 'Tu jeet gaya! 🎉' : 'Dost jeet gaya, phir try kar!')
      : (mode === '1p'
        ? (isPlayerWin ? 'Shabash! Tu jeet gaya 🎉' : 'CPU jeet gaya, phir try kar!')
        : (w === 'X' ? 'Player 1 (X) jeeta!' : 'Player 2 (O) jeeta!'));
    // Khelog rewards (1P + online win)
    if ((mode === '1p' && isPlayerWin) || (mode === 'online' && w === myMark)) {
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
  } else if (mode === 'online') {
    if (current === myMark) turnText.textContent = 'Tera turn';
    else turnText.textContent = 'Dost ki turn...';
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

// ================= ONLINE MULTIPLAYER (PeerJS) =================
const netStatusEl = document.getElementById('net-status');
const chatFab = document.getElementById('chat-fab');
const chatPanel = document.getElementById('chat-panel');
const chatMsgs = document.getElementById('chat-msgs');
const chatInput = document.getElementById('chat-input');
const chatSendBtn = document.getElementById('chat-send');
const chatBadge = document.getElementById('chat-badge');

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function makeRoomCode() {
  return Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
}
function peerIdFor(code) { return 'khelog-ttt-' + code; }

function netStatus(text, cls) {
  netStatusEl.textContent = text;
  netStatusEl.className = 'net-status' + (cls ? ' ' + cls : '');
}

document.getElementById('create-room-btn').addEventListener('click', createRoom);
document.getElementById('join-room-btn').addEventListener('click', joinRoom);
document.getElementById('join-code').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') joinRoom();
});
chatFab.addEventListener('click', () => { openChat(); });
document.getElementById('chat-close').addEventListener('click', () => chatPanel.classList.remove('show'));
chatSendBtn.addEventListener('click', sendChat);
chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(); });

function createRoom() {
  closeNet();
  isHost = true;
  myMark = 'X';
  const code = makeRoomCode();
  netStatus('Room ban raha hai...', '');
  try {
    peer = new Peer(peerIdFor(code));
  } catch (e) { netStatus('Network error! Internet check karo', 'err'); return; }
  peer.on('open', () => {
    netStatusEl.innerHTML = `Room Code: <span class="room-code-big">${code}</span><br>Dost ka wait...`;
    netStatusEl.className = 'net-status';
  });
  peer.on('connection', (c) => { conn = c; wireConn(); });
  peer.on('error', (e) => netStatus('Error: ' + e.type, 'err'));
}

function joinRoom() {
  const code = (document.getElementById('join-code').value || '').trim().toUpperCase();
  if (code.length < 4) { netStatus('Poora code likho (5 letters)', 'err'); return; }
  closeNet();
  isHost = false;
  myMark = 'O';
  netStatus('Dost se jud rahe hain...', '');
  try {
    peer = new Peer();
  } catch (e) { netStatus('Network error! Internet check karo', 'err'); return; }
  peer.on('open', () => {
    conn = peer.connect(peerIdFor(code), { reliable: true });
    wireConn();
  });
  peer.on('error', (e) => {
    netStatus(e.type === 'peer-unavailable' ? 'Room nahi mila! Code check karo' : 'Error: ' + e.type, 'err');
  });
}

function wireConn() {
  if (!conn) return;
  conn.on('open', () => {
    netStatus('✅ Dost jud gaya! Khel shuru', 'ok');
    startOnlineGame();
    sendNet({ t: 'hi' });
  });
  conn.on('data', onNetMsg);
  conn.on('close', () => {
    addChat('sys', 'Dost chala gaya 😢');
    netStatus('Dost disconnect ho gaya', 'err');
    gameOver = true;
    setTimeout(() => endOnlineSession(true), 1200);
  });
}

function sendNet(obj) {
  if (conn && conn.open) {
    try { conn.send(obj); } catch (e) { /* ignore */ }
  }
}

function onNetMsg(data) {
  if (!data || typeof data !== 'object') return;
  if (data.t === 'move') handleRemoteMove(data.i);
  else if (data.t === 'chat') addChat('them', String(data.msg).slice(0, 120));
  else if (data.t === 'restart') { resetBoard(); addChat('sys', 'Naya round shuru!'); }
  else if (data.t === 'hi') addChat('sys', 'Dost online hai 👋');
}

function handleRemoteMove(i) {
  if (gameOver || board[i] || current === myMark) return;
  place(i, current);
  const result = checkEnd();
  if (result) { endGame(result); return; }
  current = current === 'X' ? 'O' : 'X';
  updateTurn();
}

function startOnlineGame() {
  scores = { X: 0, tie: 0, O: 0 };
  updateScoreboard();
  document.getElementById('menu-screen').classList.remove('active');
  document.getElementById('game-screen').classList.add('active');
  p1Label.textContent = `${myMark} (Tum)`;
  p2Label.textContent = `${myMark === 'X' ? 'O' : 'X'} (Dost)`;
  chatFab.classList.add('show');
  addChat('sys', 'Chat khula — dost se baat karo!');
  resetBoard();
}

function endOnlineSession(silent) {
  closeNet();
  chatFab.classList.remove('show');
  chatPanel.classList.remove('show');
  unread = 0;
  chatBadge.classList.add('hidden');
  chatMsgs.innerHTML = '';
  document.getElementById('game-screen').classList.remove('active');
  document.getElementById('menu-screen').classList.add('active');
  if (!silent) netStatus('Room band ho gaya', '');
}

function closeNet() {
  try { if (conn) conn.close(); } catch (e) {}
  try { if (peer) peer.destroy(); } catch (e) {}
  conn = null;
  peer = null;
}

// ================= CHAT =================
function openChat() {
  chatPanel.classList.add('show');
  unread = 0;
  chatBadge.classList.add('hidden');
  chatMsgs.scrollTop = chatMsgs.scrollHeight;
}

function sendChat() {
  const msg = chatInput.value.trim();
  if (!msg) return;
  addChat('me', msg);
  sendNet({ t: 'chat', msg });
  chatInput.value = '';
  chatInput.focus();
}

function addChat(kind, text) {
  const d = document.createElement('div');
  d.className = 'chat-msg ' + kind;
  d.textContent = text;
  chatMsgs.appendChild(d);
  chatMsgs.scrollTop = chatMsgs.scrollHeight;
  if (kind === 'them' && !chatPanel.classList.contains('show')) {
    unread++;
    chatBadge.textContent = unread > 9 ? '9+' : unread;
    chatBadge.classList.remove('hidden');
  }
}
