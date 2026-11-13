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

function renderGames() {
  const list = games.filter((g) => {
    if (filter === 'all') return true;
    if (filter === '1p') return g.players === 1;
    return g.players === 2;
  });
  const ready = games.filter((g) => g.status === 'ready').length;

  grid.innerHTML = list
    .map((g, i) => {
      const isReady = g.status === 'ready';
      const href = `games/${g.id}/index.html`;
      const heat = Array.from({ length: 3 }, (_, k) =>
        k < g.heat ? '🔥' : '<span class="text-slate-300">🔥</span>'
      ).join(' ');
      const btn = isReady
        ? `<a href="${href}" class="card-play block w-full py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-clay-btn tactile-press text-center">Play</a>`
        : `<button class="w-full py-1.5 rounded-full bg-slate-200 text-slate-500 font-black text-xs" disabled>🔒 Soon</button>`;
      const metric = isReady ? best.toLocaleString('en-IN') : '—';
      const rate = isReady ? '98%' : '—';
      return `
        <div class="bg-white rounded-[28px] p-3 shadow-clay-card border border-white flex flex-col items-center text-center fade-up" style="animation-delay:${i * 60}ms">
          <div class="w-16 h-16 rounded-[22px] bg-gradient-to-tr ${g.grad} shadow-md p-0.5 mb-2.5 overflow-hidden">
            <div class="w-full h-full rounded-[20px] flex flex-col items-center justify-center gap-0.5" style="background:${g.tile}">
              ${g.img
                ? `<div style="width:100%;height:100%;background-image:url('${g.img}');background-repeat:no-repeat;${g.imgStyle || ''}"></div>`
                : `<span class="text-xl leading-none">${g.emoji}</span>
              <span class="text-[7px] tracking-tighter uppercase font-extrabold text-white/80 leading-none">${g.title.split(' ')[0]}</span>`}
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

  countEl.textContent = `${ready} live · ${games.length - ready} soon`;
}
renderGames();

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

// ---------- Games played counter ----------
grid.addEventListener('click', (e) => {
  const link = e.target.closest('a.card-play');
  if (!link) return;
  const played = parseInt(localStorage.getItem('games_played') || '0', 10) + 1;
  localStorage.setItem('games_played', String(played));
  const el = document.getElementById('stat-played');
  if (el) el.textContent = played;
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
