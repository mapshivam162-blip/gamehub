// Space Invaders — GameHub
const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

const PLAYER_W = 30, PLAYER_H = 16;
const ALIEN_W = 24, ALIEN_H = 16;
const BULLET_W = 3, BULLET_H = 10;
const SHIELD_W = 40, SHIELD_H = 20;

let player = { x: W/2 - PLAYER_W/2, y: H - 40 };
let bullets = []; // player bullets
let alienBullets = [];
let aliens = [];
let shields = [];
let alienDir = 1;
let alienSpeed = 0.5;
let alienDropTimer = 0;
let score = 0, best = parseInt(localStorage.getItem('best_score') || '0', 10);
let lives = 3, level = 1;
let gameOver = false, started = false, won = false;
let rafId = null;
let shootCooldown = 0;
let moveDir = 0; // -1,0,1

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

const ALIEN_POINTS = [30, 20, 20, 10, 10];

function buildAliens() {
  aliens = [];
  const rows = 5, cols = 8;
  const startX = (W - cols * (ALIEN_W + 8)) / 2;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      aliens.push({
        x: startX + c * (ALIEN_W + 8),
        y: 40 + r * (ALIEN_H + 8),
        w: ALIEN_W, h: ALIEN_H,
        row: r, alive: true
      });
    }
  }
}

function buildShields() {
  shields = [];
  const count = 4;
  const spacing = W / (count + 1);
  for (let i = 0; i < count; i++) {
    shields.push({ x: spacing * (i + 1) - SHIELD_W / 2, y: H - 120, w: SHIELD_W, h: SHIELD_H, hp: 5 });
  }
}

function startGame() {
  score = 0; lives = 3; level = 1;
  scoreEl.textContent = '0'; livesEl.textContent = '❤️❤️❤️'; levelEl.textContent = '1';
  player.x = W/2 - PLAYER_W/2;
  bullets = []; alienBullets = [];
  buildAliens(); buildShields();
  alienDir = 1; alienSpeed = 0.5; alienDropTimer = 0;
  gameOver = false; won = false; started = true;
  shootCooldown = 0; moveDir = 0;
  ovIcon.textContent = '👾'; ovTitle.textContent = 'Space Invaders';
  ovSub.textContent = 'Aliens ko shoot karo, shields bache!';
  startBtn.textContent = '▶ Start Game';
  overlay.style.display = 'none';
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);
}

function shoot() {
  if (shootCooldown > 0) return;
  bullets.push({ x: player.x + PLAYER_W / 2 - BULLET_W / 2, y: player.y, vy: -7 });
  shootCooldown = 12;
}

function update() {
  if (gameOver || !started) return;

  // player movement
  player.x += moveDir * 4;
  if (player.x < 0) player.x = 0;
  if (player.x + PLAYER_W > W) player.x = W - PLAYER_W;

  if (shootCooldown > 0) shootCooldown--;

  // bullets
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.y += b.vy;
    if (b.y < 0) { bullets.splice(i, 1); continue; }
    // hit alien
    for (const a of aliens) {
      if (!a.alive) continue;
      if (b.x < a.x + a.w && b.x + BULLET_W > a.x &&
          b.y < a.y + a.h && b.y + BULLET_H > a.y) {
        a.alive = false;
        bullets.splice(i, 1);
        score += ALIEN_POINTS[a.row];
        scoreEl.textContent = score;
        break;
      }
    }
    // hit shield
    for (const s of shields) {
      if (s.hp <= 0) continue;
      if (b.x < s.x + s.w && b.x + BULLET_W > s.x &&
          b.y < s.y + s.h && b.y + BULLET_H > s.y) {
        s.hp--;
        bullets.splice(i, 1);
        break;
      }
    }
  }

  // alien movement
  let hitWall = false;
  for (const a of aliens) {
    if (!a.alive) continue;
    a.x += alienDir * alienSpeed;
    if (a.x <= 0 || a.x + a.w >= W) hitWall = true;
  }
  if (hitWall) {
    alienDir = -alienDir;
    for (const a of aliens) {
      if (a.alive) a.y += 12;
    }
  }

  // alien shooting (random)
  if (Math.random() < 0.02 + level * 0.005) {
    const alive = aliens.filter(a => a.alive);
    if (alive.length) {
      const shooter = alive[Math.floor(Math.random() * alive.length)];
      alienBullets.push({ x: shooter.x + ALIEN_W/2 - 2, y: shooter.y + ALIEN_H, vy: 3 + level * 0.3 });
    }
  }

  // alien bullets
  for (let i = alienBullets.length - 1; i >= 0; i--) {
    const b = alienBullets[i];
    b.y += b.vy;
    if (b.y > H) { alienBullets.splice(i, 1); continue; }
    // hit player
    if (b.x < player.x + PLAYER_W && b.x + 4 > player.x &&
        b.y < player.y + PLAYER_H && b.y + 8 > player.y) {
      alienBullets.splice(i, 1);
      lives--;
      livesEl.textContent = '❤️'.repeat(Math.max(0, lives)) + '🖤'.repeat(Math.max(0, 3 - lives));
      if (lives <= 0) { endGame(); return; }
    }
    // hit shield
    for (const s of shields) {
      if (s.hp <= 0) continue;
      if (b.x < s.x + s.w && b.x + 4 > s.x &&
          b.y < s.y + s.h && b.y + 8 > s.y) {
        s.hp--;
        alienBullets.splice(i, 1);
        break;
      }
    }
  }

  // aliens reach bottom -> game over
  for (const a of aliens) {
    if (a.alive && a.y + a.h >= player.y) { endGame(); return; }
  }

  // all aliens cleared -> next level
  if (aliens.every(a => !a.alive)) {
    level++;
    levelEl.textContent = level;
    alienSpeed += 0.2;
    buildAliens();
    buildShields();
    bullets = []; alienBullets = [];
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
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, W, H);
  // stars
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  for (let i = 0; i < 30; i++) {
    const sx = (i * 37 + 13) % W;
    const sy = (i * 73 + 7) % H;
    ctx.fillRect(sx, sy, 1, 1);
  }
  // shields
  for (const s of shields) {
    if (s.hp <= 0) continue;
    ctx.fillStyle = `rgba(39, 174, 96, ${0.3 + s.hp * 0.14})`;
    ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.strokeStyle = '#27ae60';
    ctx.strokeRect(s.x + 0.5, s.y + 0.5, s.w - 1, s.h - 1);
  }
  // aliens
  for (const a of aliens) {
    if (!a.alive) continue;
    ctx.fillStyle = a.row < 1 ? '#e74c3c' : (a.row < 3 ? '#f39c12' : '#2ecc71');
    ctx.fillRect(a.x, a.y, a.w, a.h);
    // eyes
    ctx.fillStyle = '#000';
    ctx.fillRect(a.x + 5, a.y + 5, 4, 4);
    ctx.fillRect(a.x + a.w - 9, a.y + 5, 4, 4);
  }
  // player
  ctx.fillStyle = '#0084ff';
  ctx.fillRect(player.x, player.y, PLAYER_W, PLAYER_H);
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillRect(player.x + 2, player.y + 2, PLAYER_W - 4, 3);
  // bullets
  ctx.fillStyle = '#f1c40f';
  for (const b of bullets) ctx.fillRect(b.x, b.y, BULLET_W, BULLET_H);
  ctx.fillStyle = '#e74c3c';
  for (const b of alienBullets) ctx.fillRect(b.x, b.y, 4, 8);
}

function loop() {
  if (gameOver) return;
  update();
  draw();
  rafId = requestAnimationFrame(loop);
}

// Input
document.getElementById('btn-left').addEventListener('click', () => { moveDir = -1; setTimeout(() => moveDir = 0, 120); });
document.getElementById('btn-right').addEventListener('click', () => { moveDir = 1; setTimeout(() => moveDir = 0, 120); });
document.getElementById('btn-shoot').addEventListener('click', shoot);

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const r = canvas.getBoundingClientRect();
  const t = e.touches[0];
  const x = (t.clientX - r.left) * (W / r.width);
  if (x < W / 3) moveDir = -1;
  else if (x > W * 2 / 3) moveDir = 1;
  else shoot();
}, { passive: false });
canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  const r = canvas.getBoundingClientRect();
  const t = e.touches[0];
  player.x = (t.clientX - r.left) * (W / r.width) - PLAYER_W / 2;
  if (player.x < 0) player.x = 0;
  if (player.x + PLAYER_W > W) player.x = W - PLAYER_W;
}, { passive: false });
canvas.addEventListener('touchend', (e) => { e.preventDefault(); moveDir = 0; }, { passive: false });

document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') moveDir = -1;
  else if (e.key === 'ArrowRight') moveDir = 1;
  else if (e.key === ' ' || e.key === 'Spacebar') shoot();
});
document.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') moveDir = 0;
});

startBtn.addEventListener('click', startGame);

// Init
bestEl.textContent = best;
buildAliens(); buildShields();
draw();
overlay.style.display = 'flex';
