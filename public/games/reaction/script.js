/* Reaction Test — GameHub (casual 3D style) */
(function () {
  'use strict';

  const TOTAL_ROUNDS = 5;

  const roundEl = document.getElementById('round');
  const avgEl = document.getElementById('avg');
  const bestEl = document.getElementById('best');
  const historyEl = document.getElementById('history');
  const overlay = document.getElementById('overlay');
  const ovIcon = document.getElementById('ov-icon');
  const ovTitle = document.getElementById('ov-title');
  const ovSub = document.getElementById('ov-sub');
  const startBtn = document.getElementById('start-btn');

  // Re-queried each round (pad innerHTML is rebuilt after fast taps)
  let padIcon, padText, padSub;
  function refreshPadRefs() {
    padIcon = document.getElementById('pad-icon');
    padText = document.getElementById('pad-text');
    padSub = document.getElementById('pad-sub');
  }
  refreshPadRefs();

  let state = 'idle'; // idle | wait | go | result
  let round = 0;
  let times = [];
  let goAt = 0;
  let goTimer = null;
  let playing = false;

  function readInt(k, d) { try { const v = parseInt(localStorage.getItem(k), 10); return isNaN(v) ? d : v; } catch { return d; } }
  function write(k, v) { try { localStorage.setItem(k, String(v)); } catch { /* ignore */ } }
  function showBest() {
    const b = readInt('reaction_best', 0);
    bestEl.textContent = b > 0 ? b + 'ms' : '—';
  }

  function renderHistory() {
    historyEl.textContent = times.length ? times.map((t) => t + 'ms').join(' · ') : '— — — — —';
  }

  function startGame() {
    round = 0;
    times = [];
    playing = true;
    renderHistory();
    avgEl.textContent = '—';
    roundEl.textContent = '0/' + TOTAL_ROUNDS;
    overlay.classList.add('hidden');
    nextRound();
  }

  function nextRound() {
    round++;
    roundEl.textContent = round + '/' + TOTAL_ROUNDS;
    state = 'wait';
    pad.className = 'pad wait';
    padIcon.textContent = '🔴';
    padText.textContent = 'WAIT...';
    padSub.textContent = 'Green hone ka wait karo';
    // Random delay 1.5s - 4s
    goTimer = setTimeout(activateGo, 1500 + Math.random() * 2500);
  }

  function activateGo() {
    state = 'go';
    goAt = performance.now();
    pad.className = 'pad go';
    padIcon.textContent = '🟢';
    padText.textContent = 'TAP NOW!';
    padSub.textContent = '';
  }

  function onPad() {
    if (!playing) return;
    if (state === 'wait') {
      // Too early — miss this round
      clearTimeout(goTimer);
      state = 'result';
      pad.className = 'pad result-miss';
      padIcon.textContent = '😅';
      padText.textContent = 'TOO EARLY!';
      padSub.textContent = 'Round skip ho gaya';
      times.push(null);
      renderHistory();
      setTimeout(finishRound, 900);
      return;
    }
    if (state === 'go') {
      const ms = Math.round(performance.now() - goAt);
      times.push(ms);
      state = 'result';
      pad.className = 'pad result-ok';
      pad.innerHTML =
        '<div class="big-ms">' + ms + '<span style="font-size:22px">ms</span></div>' +
        '<div class="pad-sub">' + grade(ms) + '</div>';
      renderHistory();
      setTimeout(finishRound, 1000);
      return;
    }
  }

  function grade(ms) {
    if (ms < 200) return '⚡ SUPERHUMAN!';
    if (ms < 250) return '🔥 Bahut fast!';
    if (ms < 320) return '👍 Good!';
    if (ms < 420) return '🙂 Okay hai';
    return '🐢 Thoda slow...';
  }

  function finishRound() {
    // Restore pad DOM (innerHTML was replaced after fast taps)
    pad.innerHTML =
      '<div class="pad-icon" id="pad-icon">👆</div>' +
      '<div class="pad-text" id="pad-text">Tap to Start</div>' +
      '<div class="pad-sub" id="pad-sub">Green dikhte hi tap karo!</div>';
    refreshPadRefs();
    if (round < TOTAL_ROUNDS) {
      nextRound();
    } else {
      endGame();
    }
  }

  function endGame() {
    playing = false;
    state = 'idle';
    const valid = times.filter((t) => t !== null);
    const misses = TOTAL_ROUNDS - valid.length;
    const avg = valid.length ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : null;

    if (avg !== null) avgEl.textContent = avg + 'ms';

    const prevBest = readInt('reaction_best', 0);
    const isRecord = avg !== null && (prevBest === 0 || avg < prevBest);
    if (isRecord) { write('reaction_best', avg); showBest(); }

    // GameHub rewards: coins + games_played
    let coinsEarned = 0;
    if (avg !== null) {
      coinsEarned = Math.max(5, Math.min(60, Math.round((500 - avg) / 10)));
      const c = readInt('coins', 1500) + coinsEarned;
      write('coins', c);
    }
    const gp = readInt('games_played', 0) + 1;
    write('games_played', gp);

    pad.className = 'pad idle';
    padIcon.textContent = '⚡';
    padText.textContent = 'Done!';
    padSub.textContent = avg !== null ? 'Average: ' + avg + 'ms' : 'Sab rounds miss ho gaye!';

    ovIcon.textContent = misses >= 3 ? '😵' : '⚡';
    ovTitle.textContent = avg !== null ? (isRecord ? 'NEW RECORD! 🎉' : 'Ho gaya!') : 'Oops!';
    ovSub.innerHTML = (avg !== null ? 'Average: <b>' + avg + 'ms</b> · Misses: ' + misses : '5 rounds me sab miss!');
    if (coinsEarned > 0) {
      const reward = document.createElement('div');
      reward.className = 'reward-line';
      reward.textContent = '🪙 +' + coinsEarned + ' coins';
      ovSub.appendChild(document.createElement('br'));
      ovSub.appendChild(reward);
    }
    startBtn.textContent = '▶ Phir Se';
    overlay.classList.remove('hidden');
  }

  pad.addEventListener('click', onPad);
  pad.addEventListener('touchstart', function (e) { e.preventDefault(); onPad(); }, { passive: false });
  startBtn.addEventListener('click', startGame);
  showBest();
})();
