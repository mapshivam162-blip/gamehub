import './style.css';
import {
  getGame, addTry, addPlay, addLike, deviceId, TRY_GOAL,
} from './firebase.js';

const $ = (id) => document.getElementById(id);
let gameId = new URLSearchParams(location.search).get('id');
let game = null;
let liked = false;
let coinSession = 0;
const COIN_CAP = 100; // ek session me max 100 coins (cheating guard)

function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2200);
}

// ---------- Sandboxed game ke liye localStorage shim + Khelog SDK ----------
// Sandbox me localStorage access SecurityError deta hai — isliye in-memory shim
// lagate hain, warna kai games crash ho jayenge. SDK postMessage se parent se
// baat karta hai (coins/score) — sandbox se data leak nahi ho sakta.
const SDK_SHIM = `<script>
(function () {
  var mem = {};
  var shim = {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
    setItem: function (k, v) { mem[k] = String(v); },
    removeItem: function (k) { delete mem[k]; },
    clear: function () { mem = {}; },
    key: function (i) { return Object.keys(mem)[i] || null; },
    get length() { return Object.keys(mem).length; }
  };
  try { window.localStorage.getItem('khelog_probe'); } catch (e) {
    try { Object.defineProperty(window, 'localStorage', { value: shim, configurable: true }); } catch (e2) {}
  }
  window.Khelog = {
    addCoins: function (n) {
      n = Math.max(0, Math.min(50, Math.floor(Number(n) || 0)));
      parent.postMessage({ type: 'khelog:coins', amount: n }, '*');
    },
    saveScore: function (n) {
      n = Math.floor(Number(n) || 0);
      parent.postMessage({ type: 'khelog:score', score: n }, '*');
    },
    gameOver: function () {
      parent.postMessage({ type: 'khelog:gameover' }, '*');
    }
  };
})();
<\/script>`;

function shimmedHtml(html) {
  // SDK sabse pehle inject karo (head ke andar ya body ke start me)
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m) => m + SDK_SHIM);
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html[^>]*>/i, (m) => m + SDK_SHIM);
  }
  return SDK_SHIM + html;
}

// ---------- Parent-side message handling ----------
function readCoins() {
  return parseInt(localStorage.getItem('coins') || '1500', 10);
}
function writeCoins(v) {
  localStorage.setItem('coins', String(v));
}

window.addEventListener('message', (e) => {
  const d = e.data || {};
  if (d.type === 'khelog:coins') {
    if (coinSession + d.amount > COIN_CAP) {
      d.amount = Math.max(0, COIN_CAP - coinSession);
      if (!d.amount) return;
    }
    coinSession += d.amount;
    writeCoins(readCoins() + d.amount);
    toast('🪙 +' + d.amount + ' coins!');
  } else if (d.type === 'khelog:score') {
    const key = 'khelog_cbest_' + gameId;
    const best = parseInt(localStorage.getItem(key) || '0', 10);
    if (d.score > best) {
      localStorage.setItem(key, String(d.score));
      // global best bhi update (home stats ke liye)
      const gbest = parseInt(localStorage.getItem('best_score') || '0', 10);
      if (d.score > gbest) localStorage.setItem('best_score', String(d.score));
    }
  } else if (d.type === 'khelog:gameover') {
    const played = parseInt(localStorage.getItem('games_played') || '0', 10) + 1;
    localStorage.setItem('games_played', String(played));
  }
});

// ---------- Like ----------
$('p-like').addEventListener('click', () => {
  if (liked) return;
  liked = true;
  addLike(gameId);
  const n = parseInt($('p-likes').textContent, 10) + 1;
  $('p-likes').textContent = n;
  $('p-like').innerHTML = '❤️ <span id="p-likes">' + n + '</span>';
  toast('❤️ Pasand kar diya!');
});

// ---------- Fullscreen ----------
$('p-fs').addEventListener('click', () => {
  const el = document.documentElement;
  if (!document.fullscreenElement) {
    (el.requestFullscreen || el.webkitRequestFullscreen || function () {}).call(el);
  } else {
    document.exitFullscreen();
  }
});

// ---------- Load ----------
// ⚡ Beautiful processing bar — smooth ramp + real download progress.
// Min 2 sec dikhta hai; bade game me real progress bar ko drive karta hai
const MIN_LOAD_MS = 2000;
let loadStart = Date.now();
let realPct = 0;
let fakePct = 0;
let barTimer = null;

function barUpdate() {
  const fill = $('load-fill');
  const pct = Math.min(100, Math.max(fakePct, realPct));
  if (fill) fill.style.width = pct.toFixed(1) + '%';
  const out = $('load-pct');
  if (out) out.textContent = Math.round(pct) + '%';
}

function loaderStart(emoji) {
  loadStart = Date.now();
  realPct = 0;
  fakePct = 0;
  const el = $('loading');
  el.classList.remove('done');
  el.style.display = 'flex';
  $('load-emoji').textContent = emoji || '🎮';
  $('load-title').textContent = 'Game khul raha hai…';
  barTimer = setInterval(() => {
    // smooth ramp 85% tak (ease-out) — 2 sec ka beautiful feel
    fakePct += (85 - fakePct) * 0.045 + 0.25;
    if (fakePct > 85) fakePct = 85;
    barUpdate();
  }, 100);
}

function loaderProgress(done, total) {
  realPct = (done / total) * 95; // chunk progress → bar (95 tak, 100 finalize pe)
  barUpdate();
}

function loaderTitle(t, emoji) {
  $('load-title').textContent = t;
  if (emoji) $('load-emoji').textContent = emoji;
}

function loaderFail(t) {
  clearInterval(barTimer); barTimer = null;
  $('load-title').textContent = t;
  $('load-emoji').textContent = '🤷';
}

async function loaderFinish() {
  clearInterval(barTimer); barTimer = null;
  realPct = 100;
  barUpdate();
  // 2 sec minimum — fast load pe bhi bar ka feel poora dikhe
  const elapsed = Date.now() - loadStart;
  if (elapsed < MIN_LOAD_MS) {
    await new Promise((r) => setTimeout(r, MIN_LOAD_MS - elapsed));
  }
  $('loading').classList.add('done');
  setTimeout(() => { $('loading').style.display = 'none'; }, 400);
}

async function load() {
  if (!gameId) {
    $('p-title').textContent = 'Game nahi mila';
    $('p-sub').textContent = 'Link adhura hai';
    loaderStart('🤷');
    loaderFail('Game ID nahi mili');
    return;
  }
  loaderStart('⬇️');
  game = null;
  for (let attempt = 0; attempt < 3 && !game; attempt++) {
    if (attempt) {
      loaderTitle('Dobara koshish kar rahe hain… (' + (attempt + 1) + ')', '⏳');
      await new Promise((r) => setTimeout(r, 1500));
    }
    try {
      game = await getGame(gameId, loaderProgress);
    } catch (e) {
      game = null;
    }
    if (!game || !game.html) game = null;
  }
  if (!game || !game.html) {
    loaderFail('Game nahi mila');
    $('p-title').textContent = 'Game nahi mila';
    return;
  }
  loaderTitle('Game taiyaar hai!', '✅');
  $('p-title').textContent = game.emoji + ' ' + game.title;
  $('p-sub').textContent = 'by ' + (game.author || 'Publisher') + ' · ' + (game.plays || 0) + ' plays';
  $('p-likes').textContent = game.likes || 0;

  // TRY mode banner + try count (ek device = ek try)
  if (game.status !== 'live') {
    const already = (game.tries || []).includes(deviceId);
    if (!already) {
      try { game = await addTry(gameId) || game; } catch (e) { /* offline OK */ }
      const tries = game.tryCount || 0;
      if (tries >= TRY_GOAL) {
        toast('🎉 Game LIVE ho gaya!');
      } else {
        toast('🧪 Tu try #' + tries + ' hai — ' + (TRY_GOAL - tries) + ' aur chahiye!');
      }
    }
    const tries = game.tryCount || 0;
    $('trybanner').style.display = 'block';
    $('trybanner').textContent =
      '🧪 BETA TEST — ' + tries + '/' + TRY_GOAL + ' try ho gaye. 20 pure hue to game sabke liye LIVE ho jayega!';
  }

  // Game chalao — sandboxed iframe (hamare data se alag, safe)
  // pehle game set karo, phir bar smooth 100% hoke fade out hoga
  $('gframe').srcdoc = shimmedHtml(game.html);
  await loaderFinish();
  addPlay(gameId).catch(() => {});
}

load();
