// Flappy Bird — Khelog (9:16 portrait, difficulty levels)
const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

const BIRD_R = 18;
const PIPE_W = 52;
const GRAVITY = 0.45;
const FLAP_VEL = -7.5;

const DIFF = {
  easy:   { gap: 170, speed: 2.0, spawn: 100 },
  medium: { gap: 130, speed: 2.8, spawn: 90 },
  hard:   { gap: 95,  speed: 3.6, spawn: 80 },
};

let difficulty = 'medium';
let bird = { x: 70, y: H/2, vy: 0, rot: 0 };
let pipes = [];
let score = 0, best = parseInt(localStorage.getItem('best_score') || '0', 10);
let gameOver = false, started = false;
let rafId = null;
let pipeTimer = 0;
let groundX = 0;

// bird sprite (3 frames vertical)
const birdImg = new Image();
birdImg.src = 'assets/bird.png';

// bird frame animation
let birdFrame = 1; // 0,1,2
let birdFrameTimer = 0;
const bestEl = document.getElementById("best");
const scoreEl = document.getElementById("score");
const overlay = document.getElementById('overlay');
const ovIcon = document.getElementById('ov-icon');
const ovTitle = document.getElementById('ov-title');
const ovSub = document.getElementById('ov-sub');
const startBtn = document.getElementById('start-btn');

bestEl.textContent = best;

document.querySelectorAll('.diff-btn').forEach(b => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.diff-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    difficulty = b.dataset.diff;
  });
});

function resetPipes() {
  pipes = [];
  pipeTimer = 0;
}

function spawnPipe() {
  const gap = DIFF[difficulty].gap;
  const topH = 60 + Math.random() * (H - gap - 160);
  pipes.push({ x: W, topH, gap, scored: false });
}

function startGame() {
  score = 0; gameOver = false; started = true;
  bird = { x: 70, y: H/2, vy: 0, rot: 0 };
  resetPipes();
  scoreEl.textContent = '0';
  ovIcon.textContent = '🐤'; ovTitle.textContent = 'Flappy Bird';
  ovSub.textContent = 'Tap karke bird ko upar rakho!';
  startBtn.textContent = '▶ Start Game';
  overlay.style.display = 'none';
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);
}

function flap() {
  if (gameOver || !started) return;
  bird.vy = FLAP_VEL;
  bird.rot = -0.5;
}

function update() {
  if (gameOver || !started) return;

  const cfg = DIFF[difficulty];

  // bird physics
  bird.vy += GRAVITY;
  bird.y += bird.vy;
  bird.rot = Math.min(Math.max(bird.vy * 0.08, -0.6), 1.2);
  // bird frame animation
  birdFrameTimer++;
  if (birdFrameTimer > 6) { birdFrameTimer = 0; birdFrame = (birdFrame + 1) % 3; }

  // ground / ceiling
  if (bird.y + 12 > H - 40) { bird.y = H - 40 - 12; endGame(); return; }
  if (bird.y - 12 < 0) { bird.y = 12; bird.vy = 0; }

  // pipes
  pipeTimer++;
  if (pipeTimer >= cfg.spawn) { pipeTimer = 0; spawnPipe(); }
  for (let i = pipes.length - 1; i >= 0; i--) {
    const p = pipes[i];
    p.x -= cfg.speed;
    // score
    if (!p.scored && p.x + PIPE_W < bird.x) {
      p.scored = true;
      score++;
      scoreEl.textContent = score;
    }
    // collision
    if (bird.x + 12 > p.x && bird.x - 12 < p.x + PIPE_W) {
      if (bird.y - 12 < p.topH || bird.y + 12 > p.topH + p.gap) {
        endGame(); return;
      }
    }
    if (p.x + PIPE_W < 0) pipes.splice(i, 1);
  }

  groundX = (groundX - cfg.speed) % 24;
}

function endGame() {
  gameOver = true;
  if (score > best) { best = score; localStorage.setItem('best_score', String(best)); bestEl.textContent = best; }
  try {
    const c = parseInt(localStorage.getItem('coins') || '1500', 10) + score * 2;
    localStorage.setItem('coins', String(c));
    const gp = parseInt(localStorage.getItem('games_played') || '0', 10) + 1;
    localStorage.setItem('games_played', String(gp));
  } catch (e) {}
  const medal = score >= 40 ? '🏆' : score >= 20 ? '🥈' : score >= 10 ? '🥉' : '💀';
  ovIcon.textContent = medal;
  ovTitle.textContent = 'Game Over!';
  ovSub.textContent = `Score: ${score} · Best: ${best}`;
  startBtn.textContent = '🔁 Play Again';
  overlay.style.display = 'flex';
}

// image assets
const skyImg = new Image(); skyImg.src = 'assets/sky.png';
const landImg = new Image(); landImg.src = 'assets/land.png';
const pipeImg = new Image(); pipeImg.src = 'assets/pipe.png';
const birdImg2 = new Image(); birdImg2.src = 'assets/bird.png';
// 3D bird character (AI generated, transparent PNG)
const bird3dImg = new Image(); bird3dImg.src = 'assets/bird3d.png';

function draw() {
  // sky background
  if (skyImg.complete && skyImg.naturalWidth) {
    ctx.drawImage(skyImg, 0, 0, W, H);
  } else {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#4ec0ca');
    grad.addColorStop(0.6, '#87e0d4');
    grad.addColorStop(1, '#a8e6cf');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }
  // ceiling
  const ceilingImg = new Image(); ceilingImg.src = 'assets/ceiling.png';
  if (ceilingImg.complete && ceilingImg.naturalWidth) {
    const cw = ceilingImg.naturalWidth;
    for (let i = 0; i < Math.ceil(W / cw) + 1; i++) {
      ctx.drawImage(ceilingImg, i * cw + (groundX % cw) - cw, 0);
    }
  } else {
    ctx.fillStyle = '#ded895';
    ctx.fillRect(0, 0, W, 16);
  }

  // clouds
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let i = 0; i < 4; i++) {
    const cx = (i * 120 + 30) % W;
    const cy = 60 + (i * 47) % 80;
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.arc(cx + 20, cy, 22, 0, Math.PI * 2);
    ctx.arc(cx + 42, cy, 18, 0, Math.PI * 2);
    ctx.fill();
  }
  // pipes
  for (const p of pipes) {
    // top pipe
    if (pipeImg.complete && pipeImg.naturalWidth) {
      // draw pipe texture (vertical repeat) + cap
      ctx.save();
      ctx.translate(p.x, 0);
      // top pipe body
      ctx.fillStyle = '#5cb85c';
      ctx.fillRect(0, 0, PIPE_W, p.topH);
      // texture
      ctx.drawImage(pipeImg, 0, 0, pipeImg.naturalWidth, pipeImg.naturalHeight, 0, 0, PIPE_W, p.topH);
      // cap
      ctx.fillStyle = '#4cae4c';
      ctx.fillRect(-3, p.topH - 20, PIPE_W + 6, 20);
      ctx.restore();
      // bottom pipe
      const bottomY = p.topH + p.gap;
      ctx.save();
      ctx.translate(p.x, bottomY);
      ctx.fillStyle = '#5cb85c';
      ctx.fillRect(0, 0, PIPE_W, H - bottomY - 40);
      ctx.drawImage(pipeImg, 0, 0, pipeImg.naturalWidth, pipeImg.naturalHeight, 0, 0, PIPE_W, H - bottomY - 40);
      ctx.fillStyle = '#4cae4c';
      ctx.fillRect(-3, 0, PIPE_W + 6, 20);
      ctx.restore();
    } else {
      ctx.fillStyle = '#5cb85c';
      ctx.fillRect(p.x, 0, PIPE_W, p.topH);
      ctx.fillRect(p.x, p.topH + p.gap, PIPE_W, H - (p.topH + p.gap) - 40);
    }
  }
  // ground
  if (landImg.complete && landImg.naturalWidth) {
    ctx.drawImage(landImg, groundX, H - 40, W + 24, 40);
    ctx.drawImage(landImg, groundX + W, H - 40, W + 24, 40);
  } else {
    ctx.fillStyle = '#ded895';
    ctx.fillRect(0, H - 40, W, 40);
  }
  // bird
  ctx.save();
  ctx.translate(bird.x, bird.y);
  ctx.rotate(bird.rot);
  if (bird3dImg.complete && bird3dImg.naturalWidth) {
    // wing flap: slight squash on the middle frame
    const squash = birdFrame === 1 ? 0.92 : 1;
    const bw = 46, bh = 39 * squash;
    ctx.drawImage(bird3dImg, -bw / 2, -bh / 2, bw, bh);
  } else if (birdImg2.complete && birdImg2.naturalWidth) {
    ctx.drawImage(birdImg2, 0, birdFrame * 32, 34, 32, -17, -16, 34, 32);
  } else if (birdImg.complete && birdImg.naturalWidth) {
    ctx.drawImage(birdImg, 0, birdFrame * 32, 34, 32, -17, -16, 34, 32);
  } else {
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.arc(0, 0, BIRD_R, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // score
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 40px Fredoka, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 4;
  ctx.strokeText(score, W/2, 30);
  ctx.fillText(score, W/2, 30);
}

function loop() {
  if (gameOver) return;
  update();
  draw();
  rafId = requestAnimationFrame(loop);
}

// Input
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); flap(); }, { passive: false });
canvas.addEventListener('touchend', (e) => { e.preventDefault(); }, { passive: false });
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.key === 'ArrowUp') { flap(); e.preventDefault(); }
});

startBtn.addEventListener('click', startGame);

// Init
bestEl.textContent = best;
draw();
overlay.style.display = 'flex';
