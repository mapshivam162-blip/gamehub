import { randRange } from "../utils.js";

export class Food {
  constructor() {
    this.randomFood();
  }

  randomFood() {
    this.food = {
      x: randRange(0, 29),
      y: randRange(0, 29),
    };
  }

  get getFood() {
    return structuredClone(this.food);
  }
}
