// Breakout — GameHub
const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

const PADDLE_W = 70, PADDLE_H = 12;
const BALL_R = 7;
const BRICK_COLS = 8, BRICK_ROWS = 5;
const BRICK_W = 36, BRICK_H = 14, BRICK_GAP = 4;
const BRICK_OFFSET_X = (W - (BRICK_COLS * BRICK_W + (BRICK_COLS - 1) * BRICK_GAP)) / 2;
const BRICK_OFFSET_Y = 40;

const BRICK_COLORS = ['#e74c3c','#e67e22','#f1c40f','#2ecc71','#3498db'];

let paddle = { x: W/2 - PADDLE_W/2, y: H - 30 };
let ball = { x: W/2, y: H - 60, vx: 3, vy: -4 };
let bricks = [];
let score = 0, best = parseInt(localStorage.getItem('best_score') || '0', 10);
let lives = 3, level = 1;
let gameOver = false, started = false, paused = false;
let rafId = null;
let ballLaunched = false;

const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const livesEl = document.getElementById('lives');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const ovIcon = document.getElementById('ov-icon');
const ovTitle = document.getElementById('ov-title');
const ovSub = document.getElementById('ov-sub');
const startBtn = document.getElementById('start-btn');

bestEl.textContent = best;

function buildBricks() {
  bricks = [];
  const rows = Math.min(BRICK_ROWS + Math.floor((level - 1) / 2), 8);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < BRICK_COLS; c++) {
      bricks.push({
        x: BRICK_OFFSET_X + c * (BRICK_W + BRICK_GAP),
        y: BRICK_OFFSET_Y + r * (BRICK_H + BRICK_GAP),
        w: BRICK_W, h: BRICK_H,
        color: BRICK_COLORS[r % BRICK_COLORS.length],
        alive: true
      });
    }
  }
}

function resetBall() {
  ball.x = paddle.x + PADDLE_W / 2;
  ball.y = paddle.y - BALL_R - 2;
  ball.vx = (Math.random() > 0.5 ? 1 : -1) * (3 + level * 0.3);
  ball.vy = -(4 + level * 0.3);
  ballLaunched = false;
}

function startGame() {
  score = 0; lives = 3; level = 1;
  scoreEl.textContent = '0'; livesEl.textContent = '❤️❤️❤️'; levelEl.textContent = '1';
  paddle.x = W / 2 - PADDLE_W / 2;
  buildBricks();
  resetBall();
  gameOver = false; started = true; paused = false;
  ovIcon.textContent = '🧱'; ovTitle.textContent = 'Breakout';
  ovSub.textContent = 'Paddle drag karke ball bounce karao!';
  startBtn.textContent = '▶ Start Game';
  overlay.style.display = 'none';
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);
}

function launchBall() {
  if (ballLaunched) return;
  ballLaunched = true;
  ball.vx = (Math.random() > 0.5 ? 1 : -1) * (3 + level * 0.3);
  ball.vy = -(4 + level * 0.3);
  ball.x = paddle.x + PADDLE_W / 2;
  ball.y = paddle.y - BALL_R - 2;
}

function update() {
  if (gameOver || !started) return;
  if (!ballLaunched) {
    ball.x = paddle.x + PADDLE_W / 2;
    ball.y = paddle.y - BALL_R - 2;
    return;
  }
  // ball movement
  ball.x += ball.vx;
  ball.y += ball.vy;

  // wall bounce
  if (ball.x - BALL_R < 0) { ball.x = BALL_R; ball.vx = Math.abs(ball.vx); }
  if (ball.x + BALL_R > W) { ball.x = W - BALL_R; ball.vx = -Math.abs(ball.vx); }
  if (ball.y - BALL_R < 0) { ball.y = BALL_R; ball.vy = Math.abs(ball.vy); }

  // paddle collision
  if (ball.vy > 0 &&
      ball.y + BALL_R >= paddle.y &&
      ball.y + BALL_R <= paddle.y + PADDLE_H + 4 &&
      ball.x >= paddle.x - BALL_R &&
      ball.x <= paddle.x + PADDLE_W + BALL_R) {
    ball.y = paddle.y - BALL_R;
    // angle based on hit position
    const hit = (ball.x - (paddle.x + PADDLE_W / 2)) / (PADDLE_W / 2);
    const speed = Math.hypot(ball.vx, ball.vy);
    const angle = hit * (Math.PI / 3);
    ball.vx = speed * Math.sin(angle);
    ball.vy = -speed * Math.cos(angle);
    if (Math.abs(ball.vy) < 2) ball.vy = -2;
  }

  // brick collision
  for (const b of bricks) {
    if (!b.alive) continue;
    if (ball.x + BALL_R > b.x && ball.x - BALL_R < b.x + b.w &&
        ball.y + BALL_R > b.y && ball.y - BALL_R < b.y + b.h) {
      b.alive = false;
      score += 10 * level;
      scoreEl.textContent = score;
      // bounce
      const overlapLeft = (ball.x + BALL_R) - b.x;
      const overlapRight = (b.x + b.w) - (ball.x - BALL_R);
      const overlapTop = (ball.y + BALL_R) - b.y;
      const overlapBottom = (b.y + b.h) - (ball.y - BALL_R);
      const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
      if (minOverlap === overlapTop || minOverlap === overlapBottom) ball.vy = -ball.vy;
      else ball.vx = -ball.vx;
      break;
    }
  }

  // ball falls
  if (ball.y - BALL_R > H) {
    lives--;
    livesEl.textContent = '❤️'.repeat(Math.max(0, lives)) + '🖤'.repeat(Math.max(0, 3 - lives));
    if (lives <= 0) { endGame(); return; }
    resetBall();
  }

  // all bricks cleared -> next level
  if (bricks.every(b => !b.alive)) {
    level++;
    levelEl.textContent = level;
    buildBricks();
    resetBall();
  }
}

function endGame() {
  gameOver = true;
  if (score > best) { best = score; localStorage.setItem('best_score', String(best)); bestEl.textContent = best; }
  try {
    const c = parseInt(localStorage.getItem('coins') || '1500', 10) + Math.floor(score / 10);
    localStorage.setItem('coins', String(c));
    const gp = parseInt(localStorage.getItem('games_played') || '0', 10) + 1;
    localStorage.setItem('games_played', String(gp));
  } catch (e) {}
  ovIcon.textContent = '💀';
  ovTitle.textContent = 'Game Over!';
  ovSub.textContent = `Score: ${score} · Level: ${level}`;
  startBtn.textContent = '🔁 Play Again';
  overlay.style.display = 'flex';
}

function draw() {
  // bg
  ctx.fillStyle = '#161a36';
  ctx.fillRect(0, 0, W, H);
  // bricks
  for (const b of bricks) {
    if (!b.alive) continue;
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(b.x + 2, b.y + 2, b.w - 4, 3);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
  }
  // paddle
  ctx.fillStyle = '#0084ff';
  ctx.fillRect(paddle.x, paddle.y, PADDLE_W, PADDLE_H);
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillRect(paddle.x + 2, paddle.y + 2, PADDLE_W - 4, 3);
  // ball
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.arc(ball.x - 2, ball.y - 2, BALL_R * 0.4, 0, Math.PI * 2);
  ctx.fill();
}

function loop() {
  if (gameOver) return;
  update();
  draw();
  rafId = requestAnimationFrame(loop);
}

// Input: touch drag paddle
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  launchBall();
  const r = canvas.getBoundingClientRect();
  const t = e.touches[0];
  paddle.x = (t.clientX - r.left) * (W / r.width) - PADDLE_W / 2;
  clampPaddle();
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  const r = canvas.getBoundingClientRect();
  const t = e.touches[0];
  paddle.x = (t.clientX - r.left) * (W / r.width) - PADDLE_W / 2;
  clampPaddle();
}, { passive: false });

function clampPaddle() {
  if (paddle.x < 0) paddle.x = 0;
  if (paddle.x + PADDLE_W > W) paddle.x = W - PADDLE_W;
}

// Keyboard
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') { paddle.x -= 20; clampPaddle(); e.preventDefault(); }
  else if (e.key === 'ArrowRight') { paddle.x += 20; clampPaddle(); e.preventDefault(); }
  else if (e.key === ' ' || e.key === 'Spacebar') { launchBall(); e.preventDefault(); }
});

startBtn.addEventListener('click', startGame);

// Init
bestEl.textContent = best;
buildBricks();
resetBall();
draw();
overlay.style.display = 'flex';
