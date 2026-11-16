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
async function load() {
  if (!gameId) {
    $('p-title').textContent = 'Game nahi mila';
    $('p-sub').textContent = 'Link adhura hai';
    $('loading').innerHTML = '🤷<br>Game ID nahi mili';
    return;
  }
  game = await getGame(gameId);
  if (!game) {
    $('loading').innerHTML = '🤷<br>Game nahi mila';
    $('p-title').textContent = 'Game nahi mila';
    return;
  }
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
  $('gframe').srcdoc = shimmedHtml(game.html);
  $('loading').style.display = 'none';
  addPlay(gameId).catch(() => {});
}

load();
