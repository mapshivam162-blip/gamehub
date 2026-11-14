import { games } from './games.js';
import './style.css';

// ---------- Player identity ----------
if (!localStorage.getItem('player_name')) {
  localStorage.setItem(
    'player_name',
    'Gamer_' + (1000 + Math.floor(Math.random() * 9000))
  );
}
const playerName = localStorage.getItem('player_name');
const nameEl = document.getElementById('player-name');
if (nameEl) nameEl.textContent = playerName;

// ---------- Avatar (settings me choose hota hai) ----------
const avatarEl = document.getElementById('home-avatar');
if (avatarEl) avatarEl.textContent = localStorage.getItem('player_avatar') || '😎';

// ---------- Coins (snake khelne pe kamte hain) ----------
const coinsEl = document.getElementById('coins');
if (coinsEl) {
  coinsEl.textContent = parseInt(
    localStorage.getItem('coins') || '1500',
    10
  ).toLocaleString('en-IN');
}

// ---------- Daily streak (har visit pe update) ----------
const today = new Date().toDateString();
const lastVisit = localStorage.getItem('last_visit');
let streak = parseInt(localStorage.getItem('streak') || '1', 10);
if (lastVisit !== today) {
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  streak = lastVisit === yesterday ? streak + 1 : 1;
  localStorage.setItem('streak', String(streak));
  localStorage.setItem('last_visit', today);
}

// ---------- Stats dashboard ----------
const best = parseInt(localStorage.getItem('best_score') || '0', 10);
const statBest = document.getElementById('stat-best');
const statPlayed = document.getElementById('stat-played');
if (statBest) statBest.textContent = best.toLocaleString('en-IN');
if (statPlayed) statPlayed.textContent = (
  parseInt(localStorage.getItem('games_played') || '0', 10)
);

// ---------- Games grid ----------
const grid = document.getElementById('games-grid');
const countEl = document.getElementById('games-count');
let filter = 'all';

// ---------- Lock system (first 5 free, baaki 800 coins) ----------
const UNLOCK_COUNT = 5;
const UNLOCK_PRICE = 800;
const FREE_IDS = games.slice(0, UNLOCK_COUNT).map((g) => g.id);

function readUnlocked() {
  try {
    const arr = JSON.parse(localStorage.getItem('unlocked_games') || '[]');
    return new Set([...FREE_IDS, ...arr]);
  } catch {
    return new Set(FREE_IDS);
  }
}
function addUnlocked(id) {
  try {
    const arr = JSON.parse(localStorage.getItem('unlocked_games') || '[]');
    if (!arr.includes(id)) arr.push(id);
    localStorage.setItem('unlocked_games', JSON.stringify(arr));
  } catch { /* ignore */ }
}
function readCoins() {
  return parseInt(localStorage.getItem('coins') || '1500', 10);
}
function writeCoins(v) {
  localStorage.setItem('coins', String(v));
  if (coinsEl) coinsEl.textContent = v.toLocaleString('en-IN');
}

// ---------- Earn coins modal (YouTube + Telegram) ----------
const YOUTUBE_URL = 'https://youtube.com/@Ankitmap';
const TELEGRAM_URL = 'https://t.me/Ankitmap';
const REWARD_COINS = 1000;

function openEarnModal() {
  let modal = document.getElementById('earn-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
}
function closeEarnModal() {
  const modal = document.getElementById('earn-modal');
  if (modal) modal.classList.add('hidden');
}
function markRewardPending() {
  localStorage.setItem('reward_pending', String(Date.now()));
}
// Award 1000 coins when the user comes back to the app
// Rule: ek device pe hafte me sirf EK baar (7 din cooldown)
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
function checkRewardReturn() {
  const pending = localStorage.getItem('reward_pending');
  if (!pending) return;
  const elapsed = Date.now() - parseInt(pending, 10);
  // 5s se kam me wapas aaya? Abhi award mat karo, flag rakho
  if (elapsed < 5000) return;
  localStorage.removeItem('reward_pending');
  const lastClaim = parseInt(localStorage.getItem('last_reward_claim') || '0', 10);
  if (Date.now() - lastClaim < WEEK_MS) {
    const daysLeft = Math.ceil((WEEK_MS - (Date.now() - lastClaim)) / 86400000);
    toast('⏳ Channel reward ' + daysLeft + ' din baad phir milega!');
    return;
  }
  localStorage.setItem('last_reward_claim', String(Date.now()));
  writeCoins(readCoins() + REWARD_COINS);
  toast('🎁 Welcome back! +' + REWARD_COINS + ' coins');
}
window.addEventListener('focus', checkRewardReturn);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) checkRewardReturn();
});
// Page reload ke baad bhi (agar user tab band karke wapas aaya)
if (localStorage.getItem('reward_pending')) {
  setTimeout(checkRewardReturn, 1500);
}

function tryUnlock(gameId) {
  const c = readCoins();
  if (c >= UNLOCK_PRICE) {
    writeCoins(c - UNLOCK_PRICE);
    addUnlocked(gameId);
    unlocked = readUnlocked();
    renderGames();
    toast('🎉 ' + UNLOCK_PRICE + ' coins me unlock ho gaya!');
    window.location.href = 'games/' + gameId + '/index.html';
  } else {
    openEarnModal();
  }
}

function renderGames() {
  unlocked = readUnlocked();
  const list = games.filter((g) => {
    if (filter === 'all') return true;
    if (filter === '1p') return g.players === 1;
    return g.players === 2;
  });
  const ready = games.filter((g) => g.status === 'ready').length;

  grid.innerHTML = list
    .map((g, i) => {
      const isReady = g.status === 'ready';
      const isUnlocked = unlocked.has(g.id);
      const href = `games/${g.id}/index.html`;
      const heat = Array.from({ length: 3 }, (_, k) =>
        k < g.heat ? '🔥' : '<span class="text-slate-300">🔥</span>'
      ).join(' ');
      let btn;
      if (isReady && isUnlocked) {
        btn = `<a href="${href}" class="card-play block w-full py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-clay-btn tactile-press text-center">Play</a>`;
      } else if (isReady) {
        btn = `<button class="lock-btn block w-full py-1.5 rounded-full bg-amber-400 hover:bg-amber-500 text-amber-950 font-black text-xs shadow-clay-btn tactile-press text-center" data-lock-id="${g.id}">🔒 800 🪙</button>`;
      } else {
        btn = `<button class="w-full py-1.5 rounded-full bg-slate-200 text-slate-500 font-black text-xs" disabled>🔒 Soon</button>`;
      }
      const metric = isReady ? best.toLocaleString('en-IN') : '—';
      const rate = isReady ? '98%' : '—';
      const lockOverlay = isReady && !isUnlocked
        ? `<div class="absolute inset-0 rounded-[20px] bg-slate-900/55 flex items-center justify-center"><span class="text-xl drop-shadow">🔒</span></div>`
        : '';
      return `
        <div class="bg-white rounded-[28px] p-3 shadow-clay-card border border-white flex flex-col items-center text-center fade-up" style="animation-delay:${i * 60}ms">
          <div class="w-16 h-16 rounded-[22px] bg-gradient-to-tr ${g.grad} shadow-md p-0.5 mb-2.5 overflow-hidden relative">
            <div class="w-full h-full rounded-[20px] flex flex-col items-center justify-center gap-0.5 relative" style="background:${g.tile}">
              ${g.img
                ? `<img src="${g.img}" alt="${g.title}" class="w-full h-full object-cover rounded-[20px]">`
                : `<span class="text-xl leading-none">${g.emoji}</span>
              <span class="text-[7px] tracking-tighter uppercase font-extrabold text-white/80 leading-none">${g.title.split(' ')[0]}</span>`}
              ${lockOverlay}
            </div>
          </div>
          <h3 class="text-[13px] font-black text-slate-900 truncate w-full">${g.title}</h3>
          <div class="flex items-center space-x-2 text-[10px] font-bold text-slate-400 mt-0.5">
            <span><i class="fa-solid fa-thumbs-up text-slate-400 text-[9px]"></i> ${rate}</span>
            <span>${metric}</span>
          </div>
          <div class="flex items-center space-x-1 my-2">${heat}</div>
          ${btn}
        </div>`;
    })
    .join('');

  countEl.textContent = `${ready} live · ${games.length - UNLOCK_COUNT} locked`;
}
let unlocked = readUnlocked();
renderGames();

// Locked game buttons -> purchase / earn modal
grid.addEventListener('click', (e) => {
  const lockBtn = e.target.closest('button.lock-btn');
  if (lockBtn && lockBtn.dataset.lockId) {
    e.preventDefault();
    tryUnlock(lockBtn.dataset.lockId);
    return;
  }
  const link = e.target.closest('a.card-play');
  if (!link) return;
  const played = parseInt(localStorage.getItem('games_played') || '0', 10) + 1;
  localStorage.setItem('games_played', String(played));
  const el = document.getElementById('stat-played');
  if (el) el.textContent = played;
});

// ---------- Earn modal buttons ----------
document.addEventListener('click', (e) => {
  const yt = e.target.closest('#earn-youtube');
  if (yt) {
    markRewardPending();
    // real <a target="_blank"> navigation — popup blocker bypass, return detect hoga
    return;
  }
  const tg = e.target.closest('#earn-telegram');
  if (tg) {
    markRewardPending();
    return;
  }
  if (e.target.closest('#earn-close')) closeEarnModal();
  // "How to earn?" link bhi earn modal khole
  const earnLink = e.target.closest('[data-purpose="earn-link"]');
  if (earnLink) {
    e.preventDefault();
    openEarnModal();
  }
});

// ---------- Filter pills ----------
document.querySelectorAll('.filter-pill').forEach((pill) => {
  pill.addEventListener('click', () => {
    filter = pill.dataset.filter;
    document.querySelectorAll('.filter-pill').forEach((p) => {
      p.classList.remove('border-2', 'border-pink-200/80', 'bg-white', 'shadow-pill-soft');
      p.classList.add('bg-white/70', 'border', 'border-slate-200/50');
    });
    pill.classList.remove('bg-white/70', 'border', 'border-slate-200/50');
    pill.classList.add('border-2', 'border-pink-200/80', 'bg-white', 'shadow-pill-soft');
    renderGames();
  });
});

// ---------- Online / offline ----------
const netDot = document.getElementById('net-dot');
const netBadge = document.getElementById('net-badge');
function updateNet() {
  if (navigator.onLine) {
    netDot.classList.remove('offline');
    netBadge.innerHTML =
      '<i class="fa-solid fa-wifi text-[10px] text-blue-500"></i><span>Online</span>';
  } else {
    netDot.classList.add('offline');
    netBadge.innerHTML =
      '<i class="fa-solid fa-wifi text-[10px] text-rose-500"></i><span>Offline — phir bhi chalega!</span>';
  }
}
window.addEventListener('online', updateNet);
window.addEventListener('offline', updateNet);
updateNet();

// ---------- Toast ----------
const toastEl = document.getElementById('toast');
let toastTimer;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
}
document.querySelectorAll('[data-toast]').forEach((el) => {
  el.addEventListener('click', () => toast(el.dataset.toast));
});

// ---------- Install app (PWA) ----------
let deferredPrompt = null;
const installBtn = document.getElementById('install-btn');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.classList.remove('hidden');
  installBtn.classList.add('flex');
});

installBtn.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBtn.classList.add('hidden');
});

// ---------- Service worker (offline support) ----------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* dev me fail ho sakta hai, theek hai */
    });
  });
}
