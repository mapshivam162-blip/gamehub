// GameHub game registry
// Naya game add karna? Yahan ek entry + games/<id>/ folder banao.
// status: 'ready' = portal se link khulega | 'soon' = locked card dikhega

export const games = [
  {
    id: 'snake',
    title: 'Snake',
    emoji: '🐍',
    desc: 'Classic wala snek. Khana khao, lamba bano.',
    status: 'soon',
    players: 1,
  },
  {
    id: '2048',
    title: '2048',
    emoji: '🔢',
    desc: 'Tiles slide karo, merge karo, 2048 banao.',
    status: 'soon',
    players: 1,
  },
  {
    id: 'flappy',
    title: 'Flappy Bird',
    emoji: '🐤',
    desc: 'Tap tap, pipes ke beech se niklo.',
    status: 'soon',
    players: 1,
  },
  {
    id: 'memory',
    title: 'Memory Match',
    emoji: '🧠',
    desc: 'Cards yaad rakho, sab match karo.',
    status: 'soon',
    players: 1,
  },
  {
    id: 'tictactoe',
    title: 'Tic-Tac-Toe',
    emoji: '❌⭕',
    desc: '2 player same-phone duel!',
    status: 'soon',
    players: 2,
  },
  {
    id: 'reaction',
    title: 'Reaction Test',
    emoji: '⚡',
    desc: 'Kitne fast ho? Speed test karo.',
    status: 'soon',
    players: 1,
  },
];
