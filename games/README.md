# games/ — Har game ka apna folder

Naya game banane ka pattern:

```
games/<game-id>/
  index.html   (game page)
  main.js      (game logic)
  style.css    (game styles)
```

Aur `src/games.js` me registry me entry add karo, status `'ready'` kar do —
portal ke grid me card live ho jayega aur offline me bhi chalega.

## Status
- [x] Snake 🐍 (live! based on devsargam/SnakeGame, MIT)
- [ ] Reaction Test ⚡

## Baad me
- 2048, Flappy, Memory Match, Tic-Tac-Toe (2P)
- High scores (localStorage)
- Online multiplayer (WebSocket server hone ke baad)
