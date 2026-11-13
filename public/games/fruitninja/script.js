// Fruit Ninja — GameHub (real fruit images, swipe to slice)
const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

const FRUIT_NAMES = ['apple', 'banana', 'peach', 'strawberry', 'watermelon'];
const fruitImgs = {};
const halfImgs = {};
const bombImg = new Image();
let imagesLoaded = 0, totalImages = 0;

function loadImage(src) {
  const img = new Image();
  img.src = src;
  totalImages++;
  img.onload = () => { imagesLoaded++; };
  return img;
}

for (const name of FRUIT_NAMES) {
  fruitImgs[name] = loadImage(`images/${name}.png`);
  halfImgs[name] = [loadImage(`images/${name}-1.png`), loadImage(`images/${name}-2.png`)];
}
bombImg.src = 'images/boom.png';
totalImages++;
bombImg.onload = () => { imagesLoaded++; };

let fruits = [];
let halves = [];
let particles = [];
let bombs = [];
let score = 0, best = parseInt(localStorage.getItem('best_score') || '0', 10);
let lives = 3;
let gameOver = false, started = false;
let spawnTimer = 0, spawnInterval = 60;
let frameCount = 0;
let combo = 0, comboTimer = 0;
let trail = [];
let rafId = null;
let difficulty = 1;

const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const livesEl = document.getElementById('lives');
const comboEl = document.getElementById('combo');
const overlay = document.getElementById('overlay');
const ovIcon = document.getElementById('ov-icon');
const ovTitle = document.getElementById('ov-title');
const ovSub = document.getElementById('ov-sub');
const startBtn = document.getElementById('start-btn');

bestEl.textContent = best;

function spawnFruit() {
  const name = FRUIT_NAMES[Math.floor(Math.random() * FRUIT_NAMES.length)];
  const r = 34;
  const fromLeft = Math.random() < 0.5;
  const x = fromLeft ? -r : W + r;
  const targetX = W * (0.15 + Math.random() * 0.7);
  const vx = (targetX - x) / 70 + (Math.random() - 0.5) * 1.5;
  const vy = -(12 + Math.random() * 2 + difficulty);
  fruits.push({ x, y: H + r, vx, vy, r, name, sliced: false, rot: (Math.random() - 0.5) * 0.3, vr: (Math.random() - 0.5) * 0.08 });
}

function spawnBomb() {
  const r = 34;
  const fromLeft = Math.random() < 0.5;
  const x = fromLeft ? -r : W + r;
  const targetX = W * (0.2 + Math.random() * 0.6);
  const vx = (targetX - x) / 70 + (Math.random() - 0.5) * 1.5;
  const vy = -(12 + Math.random() * 2 + difficulty);
  bombs.push({ x, y: H + r, vx, vy, r, sliced: false, rot: 0, vr: (Math.random() - 0.5) * 0.12 });
}

function distPointToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx, cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function sliceFruit(f, x1, y1, x2, y2) {
  if (f.sliced) return false;
  if (distPointToSegment(f.x, f.y, x1, y1, x2, y2) <= f.r + 10) {
    f.sliced = true;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    halves.push({ x: f.x, y: f.y, name: f.name, r: f.r, imgIdx: 0, vx: Math.cos(angle + Math.PI/2) * 5, vy: Math.sin(angle + Math.PI/2) * 5 - 3, rot: f.rot, vr: -0.2, life: 50 });
    halves.push({ x: f.x, y: f.y, name: f.name, r: f.r, imgIdx: 1, vx: Math.cos(angle - Math.PI/2) * 5, vy: Math.sin(angle - Math.PI/2) * 5 - 3, rot: f.rot, vr: 0.2, life: 50 });
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 4;
      particles.push({ x: f.x, y: f.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 3 + Math.random() * 3, color: '#ff6b6b', life: 30, maxLife: 30 });
    }
    score++;
    combo++;
    comboTimer = 50;
    updateCombo();
    scoreEl.textContent = score;
    return true;
  }
  return false;
}

function updateCombo() {
  if (combo >= 2) {
    comboEl.textContent = `${combo} COMBO! +${combo - 1}`;
    comboEl.classList.add('pop');
    setTimeout(() => comboEl.classList.remove('pop'), 200);
    score += combo - 1;
    scoreEl.textContent = score;
  }
}

function update() {
  if (gameOver || !started) return;
  frameCount++;
  spawnTimer++;
  if (spawnTimer >= spawnInterval) {
    spawnTimer = 0;
    spawnFruit();
    if (Math.random() < 0.10 + difficulty * 0.02) spawnBomb();
    if (Math.random() < 0.35 + difficulty * 0.05) spawnFruit();
  }
  difficulty = 1 + Math.floor(score / 12) * 0.25;
  spawnInterval = Math.max(40, 70 - Math.floor(score / 8) * 2);

  const gravity = 0.22;

  for (let i = fruits.length - 1; i >= 0; i--) {
    const f = fruits[i];
    f.x += f.vx; f.y += f.vy; f.vy += gravity; f.rot += f.vr;
    if (f.y > H + f.r && !f.sliced) {
      fruits.splice(i, 1);
      loseLife();
    } else if (f.y > H + f.r * 2) {
      fruits.splice(i, 1);
    }
  }
  for (let i = bombs.length - 1; i >= 0; i--) {
    const b = bombs[i];
    b.x += b.vx; b.y += b.vy; b.vy += gravity; b.rot += b.vr;
    if (b.y > H + b.r * 2) bombs.splice(i, 1);
  }
  for (let i = halves.length - 1; i >= 0; i--) {
    const h = halves[i];
    h.x += h.vx; h.y += h.vy; h.vy += 0.25; h.rot += h.vr; h.life--;
    if (h.life <= 0) halves.splice(i, 1);
  }
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }
  if (comboTimer > 0) {
    comboTimer--;
    if (comboTimer === 0) { combo = 0; comboEl.textContent = ''; }
  }
}

function loseLife() {
  lives--;
  livesEl.textContent = '❤️'.repeat(Math.max(0, lives)) + '🖤'.repeat(Math.max(0, 3 - lives));
  if (lives <= 0) endGame();
}

function endGame() {
  gameOver = true;
  if (score > best) { best = score; localStorage.setItem('best_score', String(best)); bestEl.textContent = best; }
  try {
    const c = parseInt(localStorage.getItem('coins') || '1500', 10) + score;
    localStorage.setItem('coins', String(c));
    const gp = parseInt(localStorage.getItem('games_played') || '0', 10) + 1;
    localStorage.setItem('games_played', String(gp));
  } catch (e) {}
  ovIcon.textContent = '💀';
  ovTitle.textContent = 'Game Over!';
  ovSub.textContent = `Score: ${score} · Best: ${best}`;
  startBtn.textContent = '🔁 Play Again';
  overlay.style.display = 'flex';
}

function startGame() {
  fruits = []; halves = []; particles = []; bombs = [];
  score = 0; lives = 3; gameOver = false; started = true;
  spawnTimer = 0; spawnInterval = 60; frameCount = 0; difficulty = 1; combo = 0; comboTimer = 0; trail = [];
  scoreEl.textContent = '0';
  livesEl.textContent = '❤️❤️❤️';
  comboEl.textContent = '';
  ovIcon.textContent = '🍉';
  ovTitle.textContent = 'Fruit Ninja';
  ovSub.textContent = 'Swipe karke fruits slice karo! Bombs se bache.';
  startBtn.textContent = '▶ Start Game';
  overlay.style.display = 'none';
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);
}

function loop() {
  if (gameOver) return;
  update();
  render();
  rafId = requestAnimationFrame(loop);
}

function render() {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#87CEEB');
  grad.addColorStop(1, '#98D8C8');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#7ec850';
  ctx.fillRect(0, H - 8, W, 8);

  // fruits
  for (const f of fruits) {
    if (f.sliced) continue;
    const img = fruitImgs[f.name];
    if (img && img.complete) {
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rot);
      const size = f.r * 2.2;
      ctx.drawImage(img, -size/2, -size/2, size, size);
      ctx.restore();
    }
  }
  // bombs
  for (const b of bombs) {
    if (b.sliced) continue;
    if (bombImg.complete) {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rot);
      const size = b.r * 2.2;
      ctx.drawImage(bombImg, -size/2, -size/2, size, size);
      ctx.restore();
    }
  }
  // halves
  for (const h of halves) {
    const img = halfImgs[h.name] && halfImgs[h.name][h.imgIdx];
    if (img && img.complete) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, h.life / 50);
      ctx.translate(h.x, h.y);
      ctx.rotate(h.rot);
      const size = h.r * 2.2;
      ctx.drawImage(img, -size/2, -size/2, size, size);
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
  // particles
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // trail
  if (trail.length > 1) {
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(trail[0].x, trail[0].y);
    for (let i = 1; i < trail.length; i++) ctx.lineTo(trail[i].x, trail[i].y);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,80,80,0.5)';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(trail[0].x, trail[0].y);
    for (let i = 1; i < trail.length; i++) ctx.lineTo(trail[i].x, trail[i].y);
    ctx.stroke();
  }
}

function getPos(e) {
  const r = canvas.getBoundingClientRect();
  const src = e.touches ? e.touches[0] : e;
  return {
    x: (src.clientX - r.left) * (W / r.width),
    y: (src.clientY - r.top) * (H / r.height)
  };
}

function handleSlice(x, y) {
  if (!started || gameOver) return;
  trail.push({ x, y });
  if (trail.length > 16) trail.shift();
  const prev = trail.length >= 2 ? trail[trail.length - 2] : { x, y };
  for (const f of fruits) {
    if (!f.sliced) sliceFruit(f, prev.x, prev.y, x, y);
  }
  for (const b of bombs) {
    if (!b.sliced && distPointToSegment(b.x, b.y, prev.x, prev.y, x, y) <= b.r + 10) {
      b.sliced = true;
      for (let i = 0; i < 20; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 3 + Math.random() * 5;
        particles.push({ x: b.x, y: b.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 3 + Math.random() * 4, color: '#111', life: 40, maxLife: 40 });
      }
      endGame();
      return;
    }
  }
}

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (!started || gameOver) return;
  const p = getPos(e);
  trail = [p];
  combo = 0;
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (!started || gameOver) return;
  const p = getPos(e);
  handleSlice(p.x, p.y);
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  trail = [];
  combo = 0;
  comboEl.textContent = '';
}, { passive: false });

let mouseDown = false;
canvas.addEventListener('mousedown', (e) => {
  if (!started || gameOver) return;
  mouseDown = true;
  const p = getPos(e);
  trail = [p];
  combo = 0;
});
canvas.addEventListener('mousemove', (e) => {
  if (!mouseDown || gameOver) return;
  const p = getPos(e);
  handleSlice(p.x, p.y);
});
canvas.addEventListener('mouseup', () => { mouseDown = false; trail = []; combo = 0; comboEl.textContent = ''; });
canvas.addEventListener('mouseleave', () => { mouseDown = false; trail = []; });

startBtn.addEventListener('click', startGame);

// Init
bestEl.textContent = best;
overlay.style.display = 'flex';
ctx.fillStyle = '#87CEEB';
ctx.fillRect(0, 0, W, H);
