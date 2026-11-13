// Fruit Ninja — GameHub (canvas, swipe to slice)
const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

const FRUIT_TYPES = [
  { name:'apple', color:'#e74c3c', inner:'#c0392b', leaf:true },
  { name:'orange', color:'#f39c12', inner:'#e67e22', leaf:false },
  { name:'watermelon', color:'#27ae60', inner:'#c0392b', leaf:true },
  { name:'lemon', color:'#f1c40f', inner:'#f39c12', leaf:true },
  { name:'plum', color:'#8e44ad', inner:'#6c3483', leaf:false },
];

let fruits = [];      // active fruits
let halves = [];      // sliced halves
let particles = [];   // splash
let bombs = [];
let score = 0, best = parseInt(localStorage.getItem('best_score') || '0', 10);
let lives = 3;
let gameOver = false, started = false, paused = false;
let spawnTimer = 0, spawnInterval = 70;
let frameCount = 0;
let combo = 0, comboTimer = 0;
let trail = [];       // swipe trail points
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

// ---------- Spawning ----------
function spawnFruit() {
  const type = FRUIT_TYPES[Math.floor(Math.random() * FRUIT_TYPES.length)];
  const r = 26 + Math.random() * 6;
  const fromLeft = Math.random() < 0.5;
  const x = fromLeft ? -r : W + r;
  const targetX = W * (0.2 + Math.random() * 0.6);
  const vx = (targetX - x) / 60 + (Math.random() - 0.5) * 2;
  const vy = -(11 + Math.random() * 3 + difficulty);
  fruits.push({ x, y: H + r, vx, vy, r, type, sliced: false, rot: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 0.1 });
}

function spawnBomb() {
  const r = 28;
  const fromLeft = Math.random() < 0.5;
  const x = fromLeft ? -r : W + r;
  const targetX = W * (0.2 + Math.random() * 0.6);
  const vx = (targetX - x) / 60 + (Math.random() - 0.5) * 2;
  const vy = -(11 + Math.random() * 3 + difficulty);
  bombs.push({ x, y: H + r, vx, vy, r, sliced: false, rot: 0, vr: (Math.random() - 0.5) * 0.15 });
}

// ---------- Drawing ----------
function drawFruit(f) {
  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.rotate(f.rot);
  // body
  const grad = ctx.createRadialGradient(-f.r * 0.3, -f.r * 0.3, 2, 0, 0, f.r);
  grad.addColorStop(0, lighten(f.type.color, 30));
  grad.addColorStop(1, f.type.color);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, f.r, 0, Math.PI * 2);
  ctx.fill();
  // inner highlight
  ctx.fillStyle = f.type.inner;
  ctx.beginPath();
  ctx.arc(0, 0, f.r * 0.55, 0, Math.PI * 2);
  ctx.globalAlpha = 0.35;
  ctx.fill();
  ctx.globalAlpha = 1;
  // leaf
  if (f.type.leaf) {
    ctx.fillStyle = '#27ae60';
    ctx.beginPath();
    ctx.ellipse(f.r * 0.2, -f.r * 0.9, f.r * 0.35, f.r * 0.18, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1e8449';
    ctx.fillRect(-2, -f.r * 0.85, 4, f.r * 0.4);
  }
  ctx.restore();
}

function drawBomb(b) {
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.rot);
  const grad = ctx.createRadialGradient(-b.r * 0.3, -b.r * 0.3, 2, 0, 0, b.r);
  grad.addColorStop(0, '#555');
  grad.addColorStop(1, '#111');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, b.r, 0, Math.PI * 2);
  ctx.fill();
  // fuse
  ctx.strokeStyle = '#8B4513';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -b.r);
  ctx.quadraticCurveTo(8, -b.r - 12, 4, -b.r - 20);
  ctx.stroke();
  // spark
  ctx.fillStyle = '#f1c40f';
  ctx.beginPath();
  ctx.arc(4, -b.r - 20, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e74c3c';
  ctx.beginPath();
  ctx.arc(4, -b.r - 20, 2, 0, Math.PI * 2);
  ctx.fill();
  // skull-ish mark
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('!', 0, 2);
  ctx.restore();
}

function drawHalf(h) {
  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.rotate(h.rot);
  const grad = ctx.createRadialGradient(-h.r * 0.3, -h.r * 0.3, 2, 0, 0, h.r);
  grad.addColorStop(0, lighten(h.color, 30));
  grad.addColorStop(1, h.color);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, h.r, h.startAngle, h.endAngle);
  ctx.lineTo(0, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function lighten(hex, amt) {
  const c = hex.replace('#', '');
  const num = parseInt(c, 16);
  let r = (num >> 16) + amt, g = ((num >> 8) & 0xff) + amt, b = (num & 0xff) + amt;
  r = Math.min(255, Math.max(0, r)); g = Math.min(255, Math.max(0, g)); b = Math.min(255, Math.max(0, b));
  return '#' + (r << 16 | g << 8 | b).toString(16).padStart(6, '0');
}

// ---------- Slicing ----------
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
  if (distPointToSegment(f.x, f.y, x1, y1, x2, y2) <= f.r + 6) {
    f.sliced = true;
    // create halves
    const angle = Math.atan2(y2 - y1, x2 - x1);
    halves.push({ x: f.x, y: f.y, r: f.r, color: f.type.color, rot: f.rot, vr: -0.15, vx: Math.cos(angle + Math.PI/2) * 4, vy: Math.sin(angle + Math.PI/2) * 4 - 2, startAngle: angle, endAngle: angle + Math.PI, life: 60 });
    halves.push({ x: f.x, y: f.y, r: f.r, color: f.type.color, rot: f.rot, vr: 0.15, vx: Math.cos(angle - Math.PI/2) * 4, vy: Math.sin(angle - Math.PI/2) * 4 - 2, startAngle: angle + Math.PI, endAngle: angle + Math.PI * 2, life: 60 });
    // splash particles
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 3;
      particles.push({ x: f.x, y: f.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 2 + Math.random() * 3, color: f.type.color, life: 30, maxLife: 30 });
    }
    score++;
    combo++;
    comboTimer = 40;
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
    score += combo - 1; // bonus
    scoreEl.textContent = score;
  } else {
    if (comboTimer <= 0) comboEl.textContent = '';
  }
}

// ---------- Update ----------
function update() {
  if (gameOver || !started) return;
  frameCount++;

  // spawn
  spawnTimer++;
  if (spawnTimer >= spawnInterval) {
    spawnTimer = 0;
    spawnFruit();
    if (Math.random() < 0.12 + difficulty * 0.03) spawnBomb();
    if (Math.random() < 0.3 + difficulty * 0.05) spawnFruit();
  }
  // ramp difficulty
  difficulty = 1 + Math.floor(score / 15) * 0.3;

  const gravity = 0.25;

  // fruits
  for (let i = fruits.length - 1; i >= 0; i--) {
    const f = fruits[i];
    f.x += f.vx;
    f.y += f.vy;
    f.vy += gravity;
    f.rot += f.vr;
    // missed fruit (fell off bottom) -> lose life
    if (f.y > H + f.r && !f.sliced) {
      fruits.splice(i, 1);
      loseLife();
    }
  }
  // bombs
  for (let i = bombs.length - 1; i >= 0; i--) {
    const b = bombs[i];
    b.x += b.vx;
    b.y += b.vy;
    b.vy += gravity;
    b.rot += b.vr;
    if (b.y > H + b.r) bombs.splice(i, 1);
  }
  // halves
  for (let i = halves.length - 1; i >= 0; i--) {
    const h = halves[i];
    h.x += h.vx; h.y += h.vy; h.vy += gravity; h.rot += h.vr;
    h.life--;
    if (h.life <= 0) halves.splice(i, 1);
  }
  // particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }

  // combo timer
  if (comboTimer > 0) {
    comboTimer--;
    if (comboTimer === 0) {
      combo = 0;
      comboEl.textContent = '';
    }
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
  score = 0; lives = 3; gameOver = false; started = true; paused = false;
  spawnTimer = 0; spawnInterval = 70; frameCount = 0; difficulty = 1; combo = 0; comboTimer = 0; trail = [];
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
  // background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#87CEEB');
  grad.addColorStop(1, '#98D8C8');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  // ground
  ctx.fillStyle = '#7ec850';
  ctx.fillRect(0, H - 12, W, 12);

  // fruits
  for (const f of fruits) if (!f.sliced) drawFruit(f);
  for (const b of bombs) if (!b.sliced) drawBomb(b);
  for (const h of halves) drawHalf(h);
  drawParticles();

  // trail
  if (trail.length > 1) {
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(trail[0].x, trail[0].y);
    for (let i = 1; i < trail.length; i++) ctx.lineTo(trail[i].x, trail[i].y);
    ctx.stroke();
  }
}

// ---------- Input ----------
function handleSlice(x, y) {
  if (!started || gameOver) return;
  // add to trail
  trail.push({ x, y });
  if (trail.length > 12) trail.shift();
  // check fruits
  const prev = trail.length >= 2 ? trail[trail.length - 2] : { x, y };
  for (const f of fruits) {
    if (!f.sliced && sliceFruit(f, prev.x, prev.y, x, y)) {
      // sliced
    }
  }
  // bombs
  for (const b of bombs) {
    if (!b.sliced) {
      if (distPointToSegment(b.x, b.y, prev.x, prev.y, x, y) <= b.r + 6) {
        b.sliced = true;
        // explosion particles
        for (let i = 0; i < 16; i++) {
          const a = Math.random() * Math.PI * 2;
          const sp = 3 + Math.random() * 4;
          particles.push({ x: b.x, y: b.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 3 + Math.random() * 4, color: '#111', life: 40, maxLife: 40 });
        }
        endGame();
        return;
      }
    }
  }
}

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const r = canvas.getBoundingClientRect();
  const t = e.touches[0];
  const x = (t.clientX - r.left) * (W / r.width);
  const y = (t.clientY - r.top) * (H / r.height);
  trail = [{ x, y }];
  combo = 0;
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  const r = canvas.getBoundingClientRect();
  const t = e.touches[0];
  const x = (t.clientX - r.left) * (W / r.width);
  const y = (t.clientY - r.top) * (H / r.height);
  handleSlice(x, y);
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  trail = [];
  combo = 0;
  comboEl.textContent = '';
}, { passive: false });

// Mouse (desktop)
let mouseDown = false;
canvas.addEventListener('mousedown', (e) => {
  mouseDown = true;
  const r = canvas.getBoundingClientRect();
  const x = (e.clientX - r.left) * (W / r.width);
  const y = (e.clientY - r.top) * (H / r.height);
  trail = [{ x, y }];
  combo = 0;
});
canvas.addEventListener('mousemove', (e) => {
  if (!mouseDown) return;
  const r = canvas.getBoundingClientRect();
  const x = (e.clientX - r.left) * (W / r.width);
  const y = (e.clientY - r.top) * (H / r.height);
  handleSlice(x, y);
});
canvas.addEventListener('mouseup', () => { mouseDown = false; trail = []; combo = 0; comboEl.textContent = ''; });
canvas.addEventListener('mouseleave', () => { mouseDown = false; trail = []; });

startBtn.addEventListener('click', startGame);

// Init
bestEl.textContent = best;
overlay.style.display = 'flex';
ctx.fillStyle = '#87CEEB';
ctx.fillRect(0, 0, W, H);
