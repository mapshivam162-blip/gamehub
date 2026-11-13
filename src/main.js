import { games } from './games.js';
import './style.css';

// ---------- Game grid ----------
const grid = document.getElementById('game-grid');
const countEl = document.getElementById('game-count');

function renderGames() {
  grid.innerHTML = games
    .map((g) => {
      const ready = g.status === 'ready';
      const href = `/games/${g.id}/index.html`;
      const playerTag = g.players === 2 ? '👥 2P' : '👤 1P';
      const inner = `
        <div class="card-top">
          <span class="card-emoji">${g.emoji}</span>
          ${ready ? '' : '<span class="lock">🔒</span>'}
        </div>
        <h3 class="card-title">${g.title}</h3>
        <p class="card-desc">${g.desc}</p>
        <span class="card-tag">${ready ? '▶️ Khelo' : '🚧 Coming soon'} · ${playerTag}</span>`;
      return ready
        ? `<a class="card ready" href="${href}">${inner}</a>`
        : `<div class="card locked">${inner}</div>`;
    })
    .join('');
  const readyCount = games.filter((g) => g.status === 'ready').length;
  countEl.textContent = readyCount
    ? `${readyCount} ready · ${games.length - readyCount} coming soon`
    : `${games.length} coming soon`;
}
renderGames();

// ---------- Online / offline badge ----------
const netBadge = document.getElementById('net-badge');
function updateNet() {
  if (navigator.onLine) {
    netBadge.textContent = '🟢 Online';
    netBadge.classList.remove('offline');
  } else {
    netBadge.textContent = '🔌 Offline — phir bhi chalega!';
    netBadge.classList.add('offline');
  }
}
window.addEventListener('online', updateNet);
window.addEventListener('offline', updateNet);
updateNet();

// ---------- Install app (PWA) ----------
let deferredPrompt = null;
const installBtns = [
  document.getElementById('install-btn'),
  document.getElementById('install-btn2'),
].filter(Boolean);

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtns.forEach((b) => b.classList.remove('hidden'));
});

installBtns.forEach((btn) =>
  btn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtns.forEach((b) => b.classList.add('hidden'));
  })
);

// ---------- Card glow follow (mouse/touch position) ----------
grid.addEventListener('pointermove', (e) => {
  const card = e.target.closest('.card');
  if (!card) return;
  const r = card.getBoundingClientRect();
  card.style.setProperty('--mx', `${e.clientX - r.left}px`);
  card.style.setProperty('--my', `${e.clientY - r.top}px`);
});

// ---------- Service worker (offline support) ----------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* dev server me fail ho sakta hai, theek hai */
    });
  });
}
