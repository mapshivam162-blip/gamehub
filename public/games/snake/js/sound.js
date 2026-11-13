// Sounds (MIT) — from devsargam/SnakeGame
// NOTE: plain string paths kyunki ye static files hain (Vite bundling nahi hoti)
const buttonSound = new Audio("assets/audio/buttonClick.mp3");
const foodSound = new Audio("assets/audio/food.mp3");
const gameOverSound = new Audio("assets/audio/gameover.mp3");
const moveSound = new Audio("assets/audio/move.mp3");

export const playButtonClickSound = () => {
  buttonSound.play();
};

export const playSnakeEatingSound = () => {
  foodSound.play();
};

export const playGameOverSound = () => {
  gameOverSound.play();
};

export const playMoveSound = () => {
  moveSound.play();
};
