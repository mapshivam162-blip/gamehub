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
