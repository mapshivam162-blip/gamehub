/* Memory Match — GameHub (casual 3D style) */
(function () {
  'use strict';

  const DIFF = {
    easy:   { pairs: 8, cols: 4, coin: 30 },   // 16 cards
    medium: { pairs: 10, cols: 5, coin: 50 },  // 20 cards
    hard:   { pairs: 12, cols: 6, coin: 80 }   // 24 cards
  };
  const EMOJIS = ['🍕', '🚀', '🐼', '⚽', '🎸', '🍩', '🌈', '🦖', '🧊', '🐧', '🍄', '⚡'];

  const boardEl = document.getElementById('board');
  const movesEl = document.getElementById('moves');
  const timeEl = document.getElementById('time');
  const bestEl = document.getElementById('best');
  const overlay = document.getElementById('overlay');
  const ovIcon = document.getElementById('ov-icon');
  const ovTitle = document.getElementById('ov-title');
  const ovSub = document.getElementById('ov-sub');
  const startBtn = document.getElementById('start-btn');

  let diff = 'easy';
  let first = null, second = null, lock = false;
  let moves = 0, matched = 0, totalPairs = 8;
  let timer = null, seconds = 0, playing = false;

  function readInt(k, d) { try { const v = parseInt(localStorage.getItem(k), 10); return isNaN(v) ? d : v; } catch { return d; } }
  function write(k, v) { try { localStorage.setItem(k, String(v)); } catch { /* ignore */ } }
  function showBest() {
    const b = readInt('memory_best_' + diff, 0);
    bestEl.textContent = b > 0 ? b : '—';
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function startGame() {
    const cfg = DIFF[diff];
    totalPairs = cfg.pairs;
    boardEl.className = 'board ' + (diff === 'easy' ? '' : diff);
    boardEl.innerHTML = '';
    first = second = null; lock = false;
    moves = 0; matched = 0; seconds = 0;
    movesEl.textContent = '0';
    timeEl.textContent = '0s';
    showBest();

    const deck = shuffle([...EMOJIS.slice(0, cfg.pairs), ...EMOJIS.slice(0, cfg.pairs)]);
    deck.forEach((emoji) => {
      const card = document.createElement('div');
      card.className = 'card';
      card.dataset.emoji = emoji;
      card.innerHTML =
        '<div class="card-face card-back"></div>' +
        '<div class="card-face card-front">' + emoji + '</div>';
      card.addEventListener('click', () => onCard(card));
      boardEl.appendChild(card);
    });

    playing = true;
    clearInterval(timer);
    timer = setInterval(() => {
      seconds++;
      timeEl.textContent = seconds + 's';
    }, 1000);
    overlay.classList.add('hidden');
  }

  function onCard(card) {
    if (!playing || lock) return;
    if (card.classList.contains('flipped') || card.classList.contains('matched')) return;
    card.classList.add('flipped');

    if (!first) { first = card; return; }
    second = card;
    lock = true;
    moves++;
    movesEl.textContent = moves;

    if (first.dataset.emoji === second.dataset.emoji) {
      // Match!
      setTimeout(() => {
        first.classList.add('matched');
        second.classList.add('matched');
        matched++;
        first = second = null; lock = false;
        if (matched === totalPairs) endGame();
      }, 320);
    } else {
      setTimeout(() => {
        first.classList.remove('flipped');
        second.classList.remove('flipped');
        first = second = null; lock = false;
      }, 750);
    }
  }

  function endGame() {
    playing = false;
    clearInterval(timer);

    const bKey = 'memory_best_' + diff;
    const prevBest = readInt(bKey, 0);
    const isRecord = prevBest === 0 || moves < prevBest;
    if (isRecord) { write(bKey, moves); showBest(); }

    // GameHub rewards: coins + games_played
    const cfg = DIFF[diff];
    let coinsEarned = cfg.coin;
    if (isRecord) coinsEarned += 25;
    const c = readInt('coins', 1500) + coinsEarned;
    write('coins', c);
    const gp = readInt('games_played', 0) + 1;
    write('games_played', gp);

    ovIcon.textContent = '🏆';
    ovTitle.textContent = 'Sab Match! 🎉';
    ovSub.innerHTML =
      (isRecord ? '<b>NEW RECORD!</b> ' : '') +
      moves + ' moves · ' + seconds + 's';
    const reward = document.createElement('div');
    reward.className = 'reward-line';
    reward.textContent = '🪙 +' + coinsEarned + ' coins';
    ovSub.appendChild(document.createElement('br'));
    ovSub.appendChild(reward);
    startBtn.textContent = '▶ Phir Se';
    overlay.classList.remove('hidden');
  }

  document.querySelectorAll('.diff-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.diff-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      diff = btn.dataset.diff;
      showBest();
      // Restart with the new difficulty
      playing = false;
      clearInterval(timer);
      startGame();
    });
  });

  startBtn.addEventListener('click', startGame);
  showBest();
})();
