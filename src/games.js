// GameHub game registry
// Naya game add karna? Yahan ek entry + games/<id>/index.html banao.
// status: 'ready' = Play button live | 'soon' = 🔒 Soon button
// grad: Tailwind gradient classes for the app-icon tile
// tile: dark inner color of the icon tile

export const games = [
  {
    id: 'snake',
    title: 'Snake',
    emoji: '🐍',
    desc: 'Classic wala snek. Khana khao, lamba bano.',
    status: 'ready',
    players: 1,
    grad: 'from-emerald-500 to-green-700',
    tile: '#14402a',
    heat: 3,
    img: 'games/snake/assets/snake-graphics.png',
    imgStyle: 'background-size: 320px 256px; background-position: 0 0; image-rendering: pixelated;',
  },
  {
    id: '2048',
    title: '2048',
    emoji: '🔢',
    desc: 'Tiles slide karo, merge karo, 2048 banao.',
    status: 'ready',
    players: 1,
    grad: 'from-amber-400 to-orange-500',
    tile: '#3d2407',
    heat: 3,
  },
  {
    id: 'flappy',
    title: 'Flappy Bird',
    emoji: '🐤',
    desc: 'Real bird wala classic! Tap karo, pipes cross karo.',
    status: 'ready',
    players: 1,
    grad: 'from-sky-400 to-blue-600',
    tile: '#0b3a5e',
    heat: 3,
    // Real bird sprite (original Flappy Bird art, floppybird assets)
    img: 'games/flappy/assets/bird.png',
    imgStyle: 'background-size: 68px 192px; background-position: center -64px; image-rendering: pixelated;',
  },
  {
    id: 'memory',
    title: 'Memory Match',
    emoji: '🧠',
    desc: 'Cards yaad rakho, sab match karo.',
    status: 'soon',
    players: 1,
    grad: 'from-fuchsia-500 to-purple-700',
    tile: '#3b1053',
    heat: 1,
  },
  {
    id: 'tictactoe',
    title: 'Tic-Tac-Toe',
    emoji: '❌⭕',
    desc: '2 player same-phone duel! X vs O.',
    status: 'ready',
    players: 2,
    grad: 'from-blue-600 to-indigo-700',
    tile: '#1e2a78',
    heat: 3,
  },
  {
    id: 'reaction',
    title: 'Reaction Test',
    emoji: '⚡',
    desc: 'Kitne fast ho? Speed test karo.',
    status: 'soon',
    players: 1,
    grad: 'from-rose-500 to-red-600',
    tile: '#4a0d1a',
    heat: 1,
  },
];
