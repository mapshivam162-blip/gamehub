import './style.css';
import {
  mode, signUp, login, logout, getSession,
  publishGame, fetchGames, deleteGame, isAdmin, TRY_GOAL, MAX_HTML, MAX_LOGO,
} from './firebase.js';

const $ = (id) => document.getElementById(id);

// ---------- Toast ----------
let toastTimer;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

// ---------- Mode note ----------
if (mode === 'demo') {
  $('mode-note').textContent = '⚠️ Demo mode — Firebase config paste karo (src/firebase.js)';
  $('mode-note').classList.replace('text-slate-400', 'text-amber-500');
} else {
  $('mode-note').textContent = '🟢 Firebase live';
}

// ---------- Auth UI ----------
function renderSession() {
  const s = getSession();
  if (s) {
    $('auth-form').classList.add('hidden');
    $('auth-session').classList.remove('hidden');
    $('form-section').classList.remove('hidden');
    $('mygames-section').classList.remove('hidden');
    $('s-name').textContent = s.name || 'Publisher';
    $('s-email').textContent = s.email;
    if (isAdmin(s.email)) $('admin-section').classList.remove('hidden');
    loadMyGames();
  } else {
    $('auth-form').classList.remove('hidden');
    $('auth-session').classList.add('hidden');
    $('form-section').classList.add('hidden');
    $('mygames-section').classList.add('hidden');
    $('admin-section').classList.add('hidden');
  }
}

$('a-signup').addEventListener('click', async () => {
  const name = $('a-name').value.trim();
  const email = $('a-email').value.trim().toLowerCase();
  const pass = $('a-pass').value;
  if (!name) return toast('Naam likho pehle');
  if (!email.includes('@')) return toast('Sahi email likho');
  if (pass.length < 6) return toast('Password 6+ letters ka rakho');
  try {
    await signUp(name, email, pass);
    toast('🎉 Account ban gaya!');
    renderSession();
  } catch (e) {
    toast('❌ ' + e.message);
  }
});

$('a-login').addEventListener('click', async () => {
  const email = $('a-email').value.trim().toLowerCase();
  const pass = $('a-pass').value;
  try {
    await login(email, pass);
    toast('👋 Wapas aa gaya!');
    renderSession();
  } catch (e) {
    toast('❌ ' + e.message);
  }
});

$('s-logout').addEventListener('click', async () => {
  await logout();
  toast('Logout ho gaya');
  renderSession();
});

// ---------- Emoji quick picks ----------
document.querySelectorAll('.eq').forEach((b) => {
  b.addEventListener('click', () => { $('g-emoji').value = b.textContent; });
});

// ---------- Logo picker (card pe publisher ka logo dikhega) ----------
let logoData = '';
$('g-logo-file').addEventListener('change', async () => {
  const f = $('g-logo-file').files[0];
  if (!f) return;
  if (!f.type.startsWith('image/')) return toast('❌ Image file chuno (PNG/JPG)');
  try {
    logoData = await shrinkImage(f);
    $('g-logo-preview').src = logoData;
    $('g-logo-preview-wrap').classList.remove('hidden');
    $('g-logo-label').textContent = '✅ Logo set — badalna ho to phir chuno';
    toast('🖼️ Logo ready! (' + Math.round(logoData.length / 1024) + 'KB)');
  } catch (e) {
    toast('❌ Logo process nahi hua: ' + e.message);
  }
});
$('g-logo-remove').addEventListener('click', () => {
  logoData = '';
  $('g-logo-preview').src = '';
  $('g-logo-preview-wrap').classList.add('hidden');
  $('g-logo-label').textContent = '🖼️ Logo chuno (PNG/JPG)';
});

// Badi image ko 256x256 JPEG dataURL me shrink karo (200KB cap ke liye)
function shrinkImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const max = 256;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      // quality loop — 200KB me fit karo
      let q = 0.85;
      let out = c.toDataURL('image/jpeg', q);
      while (out.length > MAX_LOGO && q > 0.3) {
        q -= 0.15;
        out = c.toDataURL('image/jpeg', q);
      }
      if (out.length > MAX_LOGO) return reject(new Error('image bohot badi hai'));
      resolve(out);
    };
    img.onerror = () => reject(new Error('image load fail'));
    img.src = url;
  });
}

// ---------- HTML input (file ya paste) ----------
let htmlSize = 0;
$('g-file').addEventListener('change', async () => {
  const f = $('g-file').files[0];
  if (!f) return;
  if (f.size > MAX_HTML) {
    toast('❌ File ' + (f.size / 1024 / 1024).toFixed(1) + 'MB hai — max 30MB tak hi');
    return;
  }
  const text = await f.text();
  $('g-html').value = text;
  updateCount();
  toast('📄 ' + f.name + ' load ho gayi');
});

function updateCount() {
  htmlSize = $('g-html').value.length;
  $('g-count').textContent =
    htmlSize > 1024 * 1024
      ? (htmlSize / 1024 / 1024).toFixed(1) + ' MB / 30 MB'
      : (htmlSize / 1024).toFixed(1) + ' KB / 30 MB';
  $('g-count').classList.toggle('text-rose-500', htmlSize > MAX_HTML);
}
$('g-html').addEventListener('input', updateCount);

// ---------- Preview ----------
$('g-preview').addEventListener('click', () => {
  const html = $('g-html').value.trim();
  if (!html) return toast('Pehle HTML to daalo 😅');
  $('preview-title').textContent = '▶️ ' + ($('g-title').value || 'Preview');
  $('preview-frame').srcdoc = html;
  $('preview-modal').classList.remove('hidden');
});
$('preview-close').addEventListener('click', () => {
  $('preview-frame').srcdoc = '';
  $('preview-modal').classList.add('hidden');
});

// ---------- Publish ----------
let publishing = false;
$('g-publish').addEventListener('click', async () => {
  if (publishing) return toast('⏳ Publish chal raha hai, ruko...');
  publishing = true;
  $('g-publish').textContent = '⏳ Uploading...';
  try {
    const id = await publishGame({
      title: $('g-title').value,
      emoji: $('g-emoji').value.trim() || '🎮',
      desc: $('g-desc').value,
      html: $('g-html').value,
      logo: logoData,
    }, (done, total) => {
      if (total > 1) {
        $('g-publish').textContent = '⏳ Uploading ' + done + '/' + total + '…';
      }
    });
    toast('🎉 Publish ho gaya! Ab 20 try ka intezaar...');
    $('g-title').value = ''; $('g-desc').value = ''; $('g-html').value = '';
    $('g-file').value = '';
    logoData = '';
    $('g-logo-preview-wrap').classList.add('hidden');
    $('g-logo-label').textContent = '🖼️ Logo chuno (PNG/JPG)';
    updateCount();
    loadMyGames();
  } catch (e) {
    toast('❌ ' + e.message);
  } finally {
    publishing = false;
    $('g-publish').textContent = '🚀 Publish karo';
  }
});

// ---------- My games ----------
function gameRow(g, mine) {
  const isLive = g.status === 'live';
  const tries = g.tryCount || 0;
  const pct = Math.min(100, Math.round((tries / TRY_GOAL) * 100));
  const badge = isLive
    ? '<span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black">✅ LIVE</span>'
    : '<span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-black">🧪 TRY ' + tries + '/' + TRY_GOAL + '</span>';
  const bar = isLive ? '' :
    '<div class="w-full h-1.5 rounded-full bg-slate-100 mt-1.5 overflow-hidden"><div class="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500" style="width:' + pct + '%"></div></div>';
  return '<div class="bg-white rounded-[22px] p-3.5 shadow-clay-card border border-white flex items-center gap-3">' +
    '<div class="w-11 h-11 rounded-[16px] bg-gradient-to-tr from-slate-700 to-slate-900 flex items-center justify-center text-lg shadow-sm overflow-hidden">' +
    (g.logo
      ? '<img src="' + g.logo + '" class="w-full h-full object-cover" alt="">'
      : g.emoji) +
    '</div>' +
    '<div class="flex-1 min-w-0">' +
      '<p class="text-[13px] font-black text-slate-900 truncate">' + g.title + '</p>' +
      '<p class="text-[10px] font-bold text-slate-400 truncate">' + (mine ? g.author : g.desc || g.author) + ' · ' + (g.plays || 0) + ' plays</p>' +
      '<div class="flex items-center gap-2 mt-1">' + badge + bar +
    '</div></div>' +
    '<button class="del-btn w-9 h-9 rounded-full bg-rose-50 text-rose-500 font-black tactile-press" data-del="' + g.id + '">🗑️</button>' +
  '</div>';
}

async function loadMyGames() {
  const all = await fetchGames();
  const s = getSession();
  const mine = all.filter((g) => (g.authorEmail === s.email) || (s.uid && g.authorUid === s.uid));
  $('mygames-count').textContent = mine.length + ' game' + (mine.length === 1 ? '' : 's');
  $('mygames-list').innerHTML = mine.length
    ? mine.map((g) => gameRow(g, true)).join('')
    : '<p class="text-center text-[11px] font-bold text-slate-400 py-6">Abhi tak koi game nahi — upar se publish karo! 🚀</p>';

  // Admin: sab games
  if (isAdmin(s.email)) {
    const others = all.map((g) => gameRow(g, false)).join('');
    $('admin-list').innerHTML = others || '<p class="text-[11px] font-bold text-rose-300">Khali hai</p>';
  }
}

// Delete buttons (event delegation)
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('.del-btn');
  if (!btn) return;
  const id = btn.dataset.del;
  if (!confirm('Ye game delete karna hai? Wapas nahi aayega!')) return;
  try {
    await deleteGame(id);
    toast('🗑️ Delete ho gaya');
    loadMyGames();
  } catch (err) {
    toast('❌ ' + err.message);
  }
});

// Init
renderSession();
