// Snake polish — Khelog
// Classes (js/classes/*) ko touch kiye bina visuals upgrade:
// - glossy apple food (radial gradient + shine + stem + leaf)
// - snake body rounded + gradient, head with eyes
// - floating "+1" popup jab khana khaya jaye
import { BetterBoard } from "./classes/betterboard.js";

const CELL = 20;

// ---------- Glossy apple food ----------
BetterBoard.prototype.drawFood = function () {
  const f = this.food.getFood;
  const cx = f.x * CELL + CELL / 2;
  const cy = f.y * CELL + CELL / 2;
  const r = 8.5;
  const ctx = this.ctx;

  // soft glow
  ctx.save();
  const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, 13);
  glow.addColorStop(0, "rgba(255,80,80,0.35)");
  glow.addColorStop(1, "rgba(255,80,80,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(cx - 13, cy - 13, 26, 26);

  // apple body
  const body = ctx.createRadialGradient(cx - 3, cy - 3, 1, cx, cy, r);
  body.addColorStop(0, "#ff8a80");
  body.addColorStop(0.55, "#e53935");
  body.addColorStop(1, "#b71c1c");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // outline
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // shine
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.beginPath();
  ctx.ellipse(cx - 3.2, cy - 3.5, 2.2, 1.4, -0.6, 0, Math.PI * 2);
  ctx.fill();

  // stem
  ctx.strokeStyle = "#5d4037";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r + 1);
  ctx.quadraticCurveTo(cx + 1, cy - r - 2.5, cx + 2.5, cy - r - 3.5);
  ctx.stroke();

  // leaf
  ctx.fillStyle = "#43a047";
  ctx.beginPath();
  ctx.ellipse(cx + 4.5, cy - r - 2, 3.2, 1.6, 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

// ---------- Rounded gradient snake ----------
BetterBoard.prototype.drawSnake = function () {
  const ctx = this.ctx;
  const body = this.snake.getSnakeBody;
  const head = body[0];

  for (let i = body.length - 1; i >= 0; i--) {
    const box = body[i];
    const x = box.x * CELL;
    const y = box.y * CELL;
    const isHead = i === 0;
    const inset = isHead ? 0.5 : 1.5;
    const s = CELL - inset * 2;
    const radius = isHead ? 7 : 6;

    // tail pieces a bit smaller for taper feel
    const shrink = i > body.length - 3 && body.length > 4 ? 2.5 : 0;
    const size = s - shrink;
    const off = inset + shrink / 2;

    ctx.save();
    const g = ctx.createLinearGradient(x, y, x + CELL, y + CELL);
    if (isHead) {
      g.addColorStop(0, "#66ff8f");
      g.addColorStop(1, "#0eb85c");
    } else {
      const shade = Math.max(0.35, 1 - i * 0.015);
      g.addColorStop(0, `rgba(46,224,120,${shade})`);
      g.addColorStop(1, `rgba(11,140,70,${shade})`);
    }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(x + off, y + off, size, size, radius);
    ctx.fill();
    // top highlight
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.beginPath();
    ctx.roundRect(x + off + 2.5, y + off + 2, size - 5, 3.5, 2);
    ctx.fill();
    ctx.restore();
  }

  // head eyes (direction-aware)
  if (head) {
    const hx = head.x * CELL;
    const hy = head.y * CELL;
    const ctx2 = this.ctx;
    const dir = this.currDir || { x: 1, y: 0 };
    const fx = (dir.x || 0), fy = (dir.y || 0);
    const e1 = { x: hx + 10 + fx * 3.5 - fy * 4, y: hy + 10 + fy * 3.5 - fx * 4 };
    const e2 = { x: hx + 10 + fx * 3.5 + fy * 4, y: hy + 10 + fy * 3.5 + fx * 4 };
    ctx2.fillStyle = "#fff";
    for (const e of [e1, e2]) {
      ctx2.beginPath();
      ctx2.arc(e.x, e.y, 3.1, 0, Math.PI * 2);
      ctx2.fill();
    }
    ctx2.fillStyle = "#08130b";
    for (const e of [e1, e2]) {
      ctx2.beginPath();
      ctx2.arc(e.x + fx * 1.1, e.y + fy * 1.1, 1.5, 0, Math.PI * 2);
      ctx2.fill();
    }
    // tongue
    if (Math.random() < 0.25) {
      ctx2.strokeStyle = "#ff5252";
      ctx2.lineWidth = 1.4;
      ctx2.beginPath();
      ctx2.moveTo(hx + 10 + fx * 9, hy + 10 + fy * 9);
      ctx2.lineTo(hx + 10 + fx * 13, hy + 10 + fy * 13);
      ctx2.stroke();
    }
  }
};

// ---------- "+1" popup ----------
function spawnPopup(cellX, cellY) {
  const wrap = document.getElementById("board-wrap") || document.querySelector(".board-container") || document.querySelector("#board")?.parentElement;
  if (!wrap) return;
  const pop = document.createElement("div");
  pop.textContent = "+1";
  pop.style.cssText = `
    position:absolute; left:${cellX * CELL + 10}px; top:${cellY * CELL + 4}px;
    font: 900 15px Fredoka, 'Nunito Sans', sans-serif; color:#fff;
    text-shadow:0 2px 3px rgba(0,0,0,.5); pointer-events:none; z-index:20;
    animation: snake-pop 0.8s ease-out forwards;`;
  wrap.style.position = wrap.style.position || "relative";
  wrap.appendChild(pop);
  setTimeout(() => pop.remove(), 850);
}
const styleTag = document.createElement("style");
styleTag.textContent = `@keyframes snake-pop { 0%{opacity:0;transform:translateY(0) scale(.6)} 20%{opacity:1} 100%{opacity:0;transform:translateY(-26px) scale(1.15)} }`;
document.head.appendChild(styleTag);

// food khane ka event: score element change observe karo
BetterBoard.prototype._ghUpdateScore = BetterBoard.prototype.updateScore;
BetterBoard.prototype.updateScore = function () {
  const prev = this.score;
  this._ghUpdateScore();
  if (this.score > prev && this.snake?.getSnakeBody?.[0]) {
    const h = this.snake.getSnakeBody[0];
    spawnPopup(h.x, h.y);
  }
};
