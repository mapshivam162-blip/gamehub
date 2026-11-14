// Doodle Jump — GameHub (3D look)
const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;
// 3D player character (AI generated, transparent PNG)
const player3dImg = new Image(); player3dImg.src = 'assets/player3d.png';

let player = { x: W/2, y: H - 40 - 32, vx: 0, vy: 0, w: 32, h: 32 };
let platforms = [];
let cameraY = 0;
let score = 0, best = parseInt(localStorage.getItem('best_score') || '0', 10);
let gameOver = false, started = false;
let rafId = null;
let moveDir = 0;

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
  player = { x: W/2, y: H - 40 - 32, vx: 0, vy: 0, w: 32, h: 32 }; // base platform ke UPAR khada
  cameraY = 0;
  score = 0; gameOver = false; started = true; moveDir = 0;
  scoreEl.textContent = '0';
  buildInitialPlatforms();
  player.vy = JUMP_VEL * 0.85; // pehla bounce
  ovIcon.textContent = '🐸'; ovTitle.textContent = 'Doodle Jump';
  ovSub.textContent = 'Tap left/right to move, platforms pe jump!';
  startBtn.textContent = '▶ Start Game';
  overlay.style.display = 'none';
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);
}

function update() {
  if (gameOver || !started) return;

  player.vx = moveDir * MOVE_SPEED;
  player.x += player.vx;
  if (player.x < 0) player.x = 0;
  if (player.x + player.w > W) player.x = W - player.w;

  const prevBottom = player.y + player.h;
  player.vy += GRAVITY;
  player.y += player.vy;
  const currBottom = player.y + player.h;

  if (player.vy > 0) {
    for (const p of platforms) {
      if (p.broken) continue;
      const py = p.y - cameraY;
      if (!(player.x + player.w > p.x && player.x < p.x + p.w)) continue;
      if (prevBottom <= py + 8 && currBottom >= py - 2) {
        if (p.type === 'breakable') { p.broken = true; continue; }
        player.y = py - player.h;
        player.vy = JUMP_VEL;
        break;
      }
    }
  }

  for (const p of platforms) {
    if (p.type === 'moving' && !p.broken) {
      p.x += p.vx;
      if (p.x < 0 || p.x + p.w > W) p.vx = -p.vx;
    }
  }

  const playerScreenY = player.y - cameraY;
  if (playerScreenY < H / 2) {
    cameraY += playerScreenY - H / 2;
  }

  let highestPlatform = Math.min(...platforms.map(p => p.y));
  while (highestPlatform > cameraY - 200) {
    const y = highestPlatform - (60 + Math.random() * 30);
    const x = Math.random() * (W - PLATFORM_W);
    const type = Math.random() < 0.15 ? 'moving' : (Math.random() < 0.1 ? 'breakable' : 'normal');
    platforms.push({ x, y, w: PLATFORM_W, h: PLATFORM_H, type, vx: type === 'moving' ? (Math.random() > 0.5 ? 1.5 : -1.5) : 0 });
    highestPlatform = y;
  }

  platforms = platforms.filter(p => p.y - cameraY < H + 50 && !p.broken);

  const height = Math.max(0, Math.floor((H - 60 - cameraY) / 10));
  if (height > score) { score = height; scoreEl.textContent = score; }

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

  // parallax clouds
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let i = 0; i < 6; i++) {
    const cx = (i * 97 + cameraY * 0.1) % (W + 60) - 30;
    const cy = 40 + (i * 67) % 120;
    ctx.beginPath();
    ctx.arc(cx, cy, 16, 0, Math.PI * 2);
    ctx.arc(cx + 18, cy, 20, 0, Math.PI * 2);
    ctx.arc(cx + 38, cy, 16, 0, Math.PI * 2);
    ctx.fill();
  }

  // platforms with 3D depth
  for (const p of platforms) {
    if (p.broken) continue;
    const py = p.y - cameraY;
    if (py < -20 || py > H + 20) continue;
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(p.x + 3, py + 4, p.w, p.h);
    // body
    if (p.type === 'moving') ctx.fillStyle = '#3498db';
    else if (p.type === 'breakable') ctx.fillStyle = '#e67e22';
    else ctx.fillStyle = '#27ae60';
    ctx.fillRect(p.x, py, p.w, p.h);
    // top highlight
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(p.x + 2, py + 1, p.w - 4, 3);
    // bottom shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(p.x + 2, py + p.h - 3, p.w - 4, 2);
    // breakable cracks
    if (p.type === 'breakable') {
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x + p.w * 0.3, py);
      ctx.lineTo(p.x + p.w * 0.5, py + p.h);
      ctx.stroke();
    }
  }

  // player (doodle) — 3D AI character image, gradient fallback
  const px = player.x, py = player.y - cameraY;
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(px + player.w/2, py + player.h + 2, player.w/2 - 2, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  if (player3dImg.complete && player3dImg.naturalWidth) {
    // slight lean in the move direction
    ctx.save();
    ctx.translate(px + player.w/2, py + player.h/2);
    ctx.rotate(moveDir * 0.08);
    const pw = player.w + 6, ph = (player.w + 6) * (player3dImg.naturalHeight / player3dImg.naturalWidth);
    ctx.drawImage(player3dImg, -pw/2, -ph/2 + 2, pw, ph);
    ctx.restore();
  } else {
  // body gradient
  const bodyGrad = ctx.createRadialGradient(px + 8, py + 8, 2, px + player.w/2, py + player.h/2, player.w/2);
  bodyGrad.addColorStop(0, '#f9e79f');
  bodyGrad.addColorStop(1, '#f1c40f');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.arc(px + player.w/2, py + player.h/2, player.w/2, 0, Math.PI * 2);
  ctx.fill();
  // eyes (look in move direction)
  const eyeX = moveDir >= 0 ? 2 : -2;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(px + 10 + eyeX, py + 12, 5, 0, Math.PI * 2);
  ctx.arc(px + 22 + eyeX, py + 12, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(px + 11 + eyeX, py + 13, 2.5, 0, Math.PI * 2);
  ctx.arc(px + 23 + eyeX, py + 13, 2.5, 0, Math.PI * 2);
  ctx.fill();
  // feet
  ctx.fillStyle = '#e67e22';
  ctx.fillRect(px + 4, py + 26, 8, 6);
  ctx.fillRect(px + 20, py + 26, 8, 6);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillRect(px + 4, py + 26, 8, 2);
  ctx.fillRect(px + 20, py + 26, 8, 2);
}

function loop() {
  if (gameOver) return;
  update();
  draw();
  rafId = requestAnimationFrame(loop);
}

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

bestEl.textContent = best;
overlay.style.display = 'flex';
ctx.fillStyle = '#87CEEB';
ctx.fillRect(0, 0, W, H);
