// Doodle Jump — GameHub
const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

let player = { x: W/2, y: H - 60, vx: 0, vy: 0, w: 32, h: 32 };
let platforms = [];
let cameraY = 0;
let score = 0, best = parseInt(localStorage.getItem('best_score') || '0', 10);
let gameOver = false, started = false;
let rafId = null;
let moveDir = 0; // -1 left, 1 right

const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const overlay = document.getElementById('overlay');
const ovIcon = document.getElementById('ov-icon');
const ovTitle = document.getElementById('ov-title');
const ovSub = document.getElementById('ov-sub');
const startBtn = document.getElementById('start-btn');

bestEl.textContent = best;

const PLATFORM_W = 60, PLATFORM_H = 12;
const GRAVITY = 0.4;
const JUMP_VEL = -11;
const MOVE_SPEED = 5;

function buildInitialPlatforms() {
  platforms = [];
  // ground platform
  platforms.push({ x: W/2 - PLATFORM_W/2, y: H - 40, w: PLATFORM_W, h: PLATFORM_H, type: 'normal' });
  let y = H - 100;
  while (y > -H) {
    const x = Math.random() * (W - PLATFORM_W);
    const type = Math.random() < 0.15 ? 'moving' : (Math.random() < 0.1 ? 'breakable' : 'normal');
    platforms.push({ x, y, w: PLATFORM_W, h: PLATFORM_H, type, vx: type === 'moving' ? (Math.random() > 0.5 ? 1.5 : -1.5) : 0 });
    y -= 60 + Math.random() * 30;
  }
}

function startGame() {
  player = { x: W/2, y: H - 60, vx: 0, vy: 0, w: 32, h: 32 };
  cameraY = 0;
  score = 0; gameOver = false; started = true; moveDir = 0;
  scoreEl.textContent = '0';
  buildInitialPlatforms();
  ovIcon.textContent = '🐸'; ovTitle.textContent = 'Doodle Jump';
  ovSub.textContent = 'Tap left/right to move, platforms pe jump!';
  startBtn.textContent = '▶ Start Game';
  overlay.style.display = 'none';
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);
}

function update() {
  if (gameOver || !started) return;

  // horizontal movement
  player.vx = moveDir * MOVE_SPEED;
  player.x += player.vx;
  if (player.x < 0) player.x = 0;
  if (player.x + player.w > W) player.x = W - player.w;

  // gravity
  player.vy += GRAVITY;
  player.y += player.vy;

  // platform collision (only when falling)
  if (player.vy > 0) {
    for (const p of platforms) {
      const py = p.y - cameraY;
      if (player.x + player.w > p.x && player.x < p.x + p.w &&
          player.y + player.h >= py && player.y + player.h <= py + p.h + 8) {
        if (p.type === 'breakable') {
          p.broken = true;
          continue;
        }
        player.y = py - player.h;
        player.vy = JUMP_VEL;
        break;
      }
    }
  }

  // moving platforms
  for (const p of platforms) {
    if (p.type === 'moving' && !p.broken) {
      p.x += p.vx;
      if (p.x < 0 || p.x + p.w > W) p.vx = -p.vx;
    }
  }

  // camera follows player (scroll up when player goes above middle)
  const playerScreenY = player.y - cameraY;
  if (playerScreenY < H / 2) {
    cameraY += playerScreenY - H / 2;
  }

  // generate new platforms above
  const topY = cameraY; // top of screen in world coords
  let highestPlatform = Math.min(...platforms.map(p => p.y));
  while (highestPlatform > topY - 200) {
    const y = highestPlatform - (60 + Math.random() * 30);
    const x = Math.random() * (W - PLATFORM_W);
    const type = Math.random() < 0.15 ? 'moving' : (Math.random() < 0.1 ? 'breakable' : 'normal');
    platforms.push({ x, y, w: PLATFORM_W, h: PLATFORM_H, type, vx: type === 'moving' ? (Math.random() > 0.5 ? 1.5 : -1.5) : 0 });
    highestPlatform = y;
  }

  // remove platforms below screen
  platforms = platforms.filter(p => p.y - cameraY < H + 50 && !p.broken);

  // score = height climbed
  const height = Math.max(0, Math.floor((H - 60 - cameraY) / 10));
  if (height > score) { score = height; scoreEl.textContent = score; }

  // game over: player falls below screen
  if (player.y - cameraY > H + 40) {
    endGame();
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
  ovSub.textContent = `Height: ${score} · Best: ${best}`;
  startBtn.textContent = '🔁 Play Again';
  overlay.style.display = 'flex';
}

function draw() {
  // sky gradient
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#87CEEB');
  grad.addColorStop(1, '#b8e6ff');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // platforms
  for (const p of platforms) {
    if (p.broken) continue;
    const py = p.y - cameraY;
    if (py < -20 || py > H + 20) continue;
    if (p.type === 'moving') ctx.fillStyle = '#3498db';
    else if (p.type === 'breakable') ctx.fillStyle = '#e67e22';
    else ctx.fillStyle = '#27ae60';
    ctx.fillRect(p.x, py, p.w, p.h);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillRect(p.x + 2, py + 2, p.w - 4, 3);
  }

  // player (doodle)
  const px = player.x, py = player.y - cameraY;
  ctx.fillStyle = '#f1c40f';
  ctx.beginPath();
  ctx.arc(px + player.w/2, py + player.h/2, player.w/2, 0, Math.PI * 2);
  ctx.fill();
  // eyes
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(px + 10, py + 12, 3, 0, Math.PI * 2);
  ctx.arc(px + 22, py + 12, 3, 0, Math.PI * 2);
  ctx.fill();
  // feet
  ctx.fillStyle = '#e67e22';
  ctx.fillRect(px + 4, py + 28, 8, 6);
  ctx.fillRect(px + 20, py + 28, 8, 6);
}

function loop() {
  if (gameOver) return;
  update();
  draw();
  rafId = requestAnimationFrame(loop);
}

// Input
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const r = canvas.getBoundingClientRect();
  const t = e.touches[0];
  const x = (t.clientX - r.left) * (W / r.width);
  moveDir = x < W / 2 ? -1 : 1;
}, { passive: false });
canvas.addEventListener('touchend', (e) => { e.preventDefault(); moveDir = 0; }, { passive: false });
canvas.addEventListener('touchmove', (e) => { e.preventDefault(); }, { passive: false });

document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') moveDir = -1;
  else if (e.key === 'ArrowRight') moveDir = 1;
});
document.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') moveDir = 0;
});

startBtn.addEventListener('click', startGame);

// Init
bestEl.textContent = best;
overlay.style.display = 'flex';
ctx.fillStyle = '#87CEEB';
ctx.fillRect(0, 0, W, H);
