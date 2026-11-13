// Mobile controls for GameHub (touch + pause button)
// Original game was keyboard-only; ye file phone ke liye add ki gayi hai.

import { playMoveSound } from "./sound.js";
import { direction, directionEnum } from "./utils.js";

function setDirection(board, dir, opposite, velocity) {
  if (board.currDir === opposite) return; // reverse nahi
  if (!board.playing && !board.gameoverCooldown && !board.paused) {
    board.reset();
    return; // reset ke baad pehla swipe direction na le
  }
  if (board.changedDirection) return;
  board.changedDirection = true;
  if (board.soundOn) playMoveSound();
  board.snake.changeVelocity = velocity;
  board.currDir = dir;
}

function togglePause(board) {
  if (board.playing && !board.paused) {
    board.paused = true;
    board.playing = false;
  } else if (board.paused) {
    board.paused = false;
    board.playing = true;
  }
  board.toggleOverlay();
  board.toggleButton.innerText = board.paused ? "Resume" : "Start Game";
}

export function initTouch(board) {
  // ---------- Pause button ----------
  const pauseBtn = document.querySelector("#pauseBtn");
  if (pauseBtn) {
    pauseBtn.addEventListener("click", () => togglePause(board));
  }

  // ---------- Coins earn (game over pe score × 2) ----------
  const modalEl = document.querySelector(".modal");
  let awarded = false;
  if (modalEl) {
    new MutationObserver(() => {
      const shown = modalEl.style.display !== "none" && modalEl.style.display !== "";
      if (shown && !awarded) {
        awarded = true;
        const coins = parseInt(localStorage.getItem("coins") || "1500", 10);
        const earned = Math.max(1, board.score * 2);
        localStorage.setItem("coins", String(coins + earned));
        localStorage.setItem("games_played", String(
          parseInt(localStorage.getItem("games_played") || "0", 10) + 1
        ));
        const msg = modalEl.querySelector(".modal-text");
        if (msg) {
          msg.insertAdjacentHTML(
            "afterend",
            `<p style="margin-top:8px;font-size:0.95rem;font-weight:800;color:#b45309">🪙 +${earned} coins kamaye!</p>`
          );
        }
      } else if (!shown) {
        awarded = false;
        const coinNote = modalEl.querySelector("p[style]");
        if (coinNote) coinNote.remove();
      }
    }).observe(modalEl, { attributes: true, attributeFilter: ["style"] });
  }

  // ---------- Tap to restart (game over) ----------
  const modal = document.querySelector(".modal");
  modal?.addEventListener("click", () => {
    if (!board.playing && !board.gameoverCooldown) board.reset();
  });

  // ---------- Swipe controls ----------
  const boardEl = document.querySelector("#board");
  let sx = 0;
  let sy = 0;
  let swiped = false;

  boardEl.addEventListener(
    "touchstart",
    (e) => {
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
      swiped = false;
    },
    { passive: true }
  );

  boardEl.addEventListener(
    "touchmove",
    (e) => {
      if (swiped) return;
      const dx = e.touches[0].clientX - sx;
      const dy = e.touches[0].clientY - sy;
      const THRESHOLD = 26;
      if (Math.abs(dx) < THRESHOLD && Math.abs(dy) < THRESHOLD) return;
      swiped = true;
      if (Math.abs(dx) > Math.abs(dy)) {
        // horizontal
        if (dx > 0) setDirection(board, direction.RIGHT, direction.LEFT, directionEnum.RIGHT);
        else setDirection(board, direction.LEFT, direction.RIGHT, directionEnum.LEFT);
      } else {
        // vertical
        if (dy > 0) setDirection(board, direction.DOWN, direction.UP, directionEnum.DOWN);
        else setDirection(board, direction.UP, direction.DOWN, directionEnum.UP);
      }
    },
    { passive: true }
  );
}
