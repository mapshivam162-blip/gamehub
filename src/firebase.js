// Khelog Community Games — Firebase setup
// ============================================================
// YAHAN APNA FIREBASE CONFIG DAALO (FIREBASE_SETUP.md dekho)
// Jab tak config nahi hai, app DEMO MODE me chalega
// (sab data localStorage me — sirf tumhare phone pe dikhega)
// ============================================================
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDU2ViPia-hJAix9Td4wpeXeIE_DlKZ_Rk',
  authDomain: 'khelog-9b4e3.firebaseapp.com',
  projectId: 'khelog-9b4e3',
  storageBucket: 'khelog-9b4e3.firebasestorage.app',
  messagingSenderId: '1083997786967',
  appId: '1:1083997786967:web:ad558520ecc38aaa33a412',
};

// Placeholder detection — agar paste nahi hua to demo mode
const CONFIGURED = !Object.values(FIREBASE_CONFIG).some(
  (v) => typeof v !== 'string' || v.includes('PASTE_')
);

// Device id — TRY dedupe ke liye (ek device = ek try)
if (!localStorage.getItem('khelog_device_id')) {
  localStorage.setItem(
    'khelog_device_id',
    'dev_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
  );
}
export const deviceId = localStorage.getItem('khelog_device_id');

// Community games ki local mirror (demo mode + cache dono ke liye)
const LS_KEY = 'khelog_community_games';
function readLocal() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
  } catch {
    return [];
  }
}
function writeLocal(arr) {
  localStorage.setItem(LS_KEY, JSON.stringify(arr));
}

let db = null;
let auth = null;
let fbMods = null;

export const mode = CONFIGURED ? 'firebase' : 'demo';
const listeners = [];

function notify() {
  listeners.forEach((fn) => {
    try { fn(); } catch { /* ignore */ }
  });
}

export function onGamesChange(fn) {
  listeners.push(fn);
  return () => {
    const i = listeners.indexOf(fn);
    if (i >= 0) listeners.splice(i, 1);
  };
}

if (CONFIGURED) {
  try {
    // Dynamic import — build me bundle hoga, demo mode me load hi nahi hoga
    fbMods = await Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
      import('firebase/firestore'),
    ]);
    const [appMod, authMod, fsMod] = fbMods;
    const app = appMod.initializeApp(FIREBASE_CONFIG);
    auth = authMod.getAuth(app);
    db = fsMod.getFirestore(app);
  } catch (e) {
    console.warn('Firebase init fail, demo mode:', e);
    db = null;
    auth = null;
  }
}

// ---------- AUTH ----------
// Auth session ka localStorage mirror — Firebase kabhi-kabhi restore
// skip karta hai (WebView/IndexedDB issue), isse login hamesha yaad rahega
function saveMirror(s) {
  if (s) localStorage.setItem('khelog_fb_session', JSON.stringify(s));
  else localStorage.removeItem('khelog_fb_session');
}

export async function signUp(name, email, pass) {
  if (mode === 'demo') {
    const users = JSON.parse(localStorage.getItem('khelog_users') || '{}');
    if (users[email]) throw new Error('Ye email pehle se hai — login karo');
    users[email] = { name, pass };
    localStorage.setItem('khelog_users', JSON.stringify(users));
    localStorage.setItem('khelog_session', JSON.stringify({ email, name }));
    return { email, name };
  }
  const [, authMod] = fbMods;
  const cred = await authMod.createUserWithEmailAndPassword(auth, email, pass);
  await authMod.updateProfile(cred.user, { displayName: name });
  saveMirror({ email: cred.user.email, name, uid: cred.user.uid });
  return { email: cred.user.email, name, uid: cred.user.uid };
}

export async function login(email, pass) {
  if (mode === 'demo') {
    const users = JSON.parse(localStorage.getItem('khelog_users') || '{}');
    if (!users[email] || users[email].pass !== pass) {
      throw new Error('Email ya password galat hai');
    }
    localStorage.setItem('khelog_session', JSON.stringify({ email, name: users[email].name }));
    return { email, name: users[email].name };
  }
  const [, authMod] = fbMods;
  const cred = await authMod.signInWithEmailAndPassword(auth, email, pass);
  const s = { email: cred.user.email, name: cred.user.displayName || email, uid: cred.user.uid };
  saveMirror(s);
  return s;
}

export async function logout() {
  if (mode === 'demo') {
    localStorage.removeItem('khelog_session');
    return;
  }
  const [, authMod] = fbMods;
  saveMirror(null);
  await authMod.signOut(auth);
}

export function getSession() {
  if (mode === 'demo') {
    try {
      return JSON.parse(localStorage.getItem('khelog_session') || 'null');
    } catch {
      return null;
    }
  }
  if (auth && auth.currentUser) {
    const u = auth.currentUser;
    return { email: u.email, name: u.displayName || u.email, uid: u.uid };
  }
  // Fallback: Firebase restore miss ho jaye to mirror se session dikhao
  try {
    return JSON.parse(localStorage.getItem('khelog_fb_session') || 'null');
  } catch {
    return null;
  }
}

// Firebase auth ASYNC restore hota hai (page load ke baad) — isliye
// UI ko subscribe karna padta hai, warna logged-in dikh hi nahi sakta
export function onAuthChange(fn) {
  if (mode === 'demo') { fn(); return () => {}; }
  if (!auth) { return () => {}; }
  const [, authMod] = fbMods;
  return authMod.onAuthStateChanged(auth, (u) => {
    const s = u ? { email: u.email, name: u.displayName || u.email, uid: u.uid } : null;
    if (u) saveMirror(s); else saveMirror(null);
    fn(s);
  });
}

// ---------- GAMES ----------
export const MAX_HTML = 30 * 1024 * 1024;    // 30MB game (chunks me store hota hai)
export const MAX_LOGO = 200 * 1024;          // 200KB logo (dataURL)
const CHUNK_SIZE = 900_000;                  // Firestore doc limit ~1MB, safe chunk
const REQUIRED_TAGS = /<html|<canvas|<body|<script/i;

function validateGame({ title, emoji, desc, html, logo }) {
  if (!title || title.trim().length < 3) throw new Error('Title kam se kam 3 letters ka ho');
  if (title.length > 40) throw new Error('Title 40 letters se chota rakho');
  if (!desc || desc.trim().length < 5) throw new Error('Description likho (5+ letters)');
  if (desc.length > 120) throw new Error('Description 120 letters se choti rakho');
  if (!html || html.length < 50) throw new Error('Game HTML paste karo');
  if (html.length > MAX_HTML) {
    throw new Error('Game ' + (html.length / 1024 / 1024).toFixed(1) + 'MB hai — max 30MB tak hi');
  }
  if (!REQUIRED_TAGS.test(html)) throw new Error('Ye valid HTML game nahi lag raha');
  if (logo) {
    if (typeof logo !== 'string' || !logo.startsWith('data:image/')) {
      throw new Error('Logo image file honi chahiye');
    }
    if (logo.length > MAX_LOGO) throw new Error('Logo 200KB se chota hono chahiye');
  }
}

// chunks: [{ id: gameId_i, text }] — gamehtml collection me ek doc per chunk
function splitChunks(gameId, html) {
  const parts = [];
  for (let i = 0; i < html.length; i += CHUNK_SIZE) {
    parts.push(html.slice(i, i + CHUNK_SIZE));
  }
  return parts;
}

export async function publishGame(data, onProgress) {
  const { title, emoji, desc, html, logo } = data;
  validateGame({ title, emoji, desc, html, logo });

  const s = getSession();
  if (!s) throw new Error('Pehle login karo');

  const base = {
    title: title.trim(),
    emoji: emoji || '🎮',
    logo: logo || '',
    desc: desc.trim(),
    author: s.name || s.email,
    authorEmail: s.email,
    authorUid: s.uid || s.email,
    status: 'try',          // 'try' | 'live'
    tryCount: 0,
    tries: [],              // deviceIds jinhone try kiya
    plays: 0,
    likes: 0,
    createdAt: Date.now(),
  };

  if (mode === 'demo') {
    const arr = readLocal();
    base.id = 'demo_' + Date.now().toString(36);
    base.html = html;
    try {
      arr.unshift(base);
      writeLocal(arr);
    } catch (e) {
      throw new Error('Demo mode ka storage bhar gaya! Firebase config paste karo (FIREBASE_SETUP.md) — 30MB games wahan hi chalenge');
    }
    notify();
    return base.id;
  }

  // Firebase: meta doc (games) + html chunks (gamehtml, ek doc ~900KB)
  const [, , fsMod] = fbMods;
  const parts = splitChunks('', html);
  base.size = html.length;
  base.chunks = parts.length;
  const ref = await fsMod.addDoc(fsMod.collection(db, 'games'), base);
  for (let i = 0; i < parts.length; i++) {
    await fsMod.setDoc(fsMod.doc(db, 'gamehtml', ref.id + '_' + i), {
      gameId: ref.id,
      idx: i,
      text: parts[i],
      authorUid: base.authorUid,
    });
    if (onProgress) onProgress(i + 1, parts.length);
  }
  notify();
  return ref.id;
}

// Ek device = ek try. tryCount >= 20 → auto live
export const TRY_GOAL = 20;

export async function addTry(gameId) {
  if (mode === 'demo') {
    const arr = readLocal();
    const g = arr.find((x) => x.id === gameId);
    if (!g) return null;
    if (!g.tries.includes(deviceId)) {
      g.tries.push(deviceId);
      g.tryCount = g.tries.length;
      if (g.tryCount >= TRY_GOAL) g.status = 'live';
      writeLocal(arr);
      notify();
    }
    return g;
  }
  const [, , fsMod] = fbMods;
  const ref = fsMod.doc(db, 'games', gameId);
  let result = null;
  await fsMod.runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const g = snap.data();
    if (!(g.tries || []).includes(deviceId)) {
      const tries = [...(g.tries || []), deviceId];
      const tryCount = tries.length;
      const status = tryCount >= TRY_GOAL ? 'live' : g.status;
      tx.update(ref, { tries, tryCount, status });
      result = { ...g, tries, tryCount, status };
    } else {
      result = g;
    }
  });
  notify();
  return result;
}

export async function addPlay(gameId) {
  if (mode === 'demo') {
    const arr = readLocal();
    const g = arr.find((x) => x.id === gameId);
    if (g) { g.plays = (g.plays || 0) + 1; writeLocal(arr); notify(); }
    return;
  }
  const [, , fsMod] = fbMods;
  try {
    await fsMod.updateDoc(fsMod.doc(db, 'games', gameId), { plays: fsMod.increment(1) });
  } catch { /* ignore */ }
  notify();
}

export async function addLike(gameId) {
  if (mode === 'demo') {
    const arr = readLocal();
    const g = arr.find((x) => x.id === gameId);
    if (g && !g._likedBy?.includes(deviceId)) {
      g.likes = (g.likes || 0) + 1;
      g._likedBy = [...(g._likedBy || []), deviceId];
      writeLocal(arr);
      notify();
    }
    return;
  }
  const [, , fsMod] = fbMods;
  try {
    await fsMod.updateDoc(fsMod.doc(db, 'games', gameId), { likes: fsMod.increment(1) });
  } catch { /* ignore */ }
  notify();
}

// Community games list (live + try dono). LocalStorage cache bhi rakhta hai
// taaki offline pe bhi cards dikhen. HTML chunks cache me NAHI jaate (heavy).
export function cachedGames() {
  return readLocal().map((g) => {
    const c = { ...g };
    delete c.html;
    return c;
  });
}

function stripHtml(list) {
  return list.map((g) => {
    const c = { ...g };
    delete c.html;
    return c;
  });
}

export async function fetchGames() {
  if (mode === 'demo') return stripHtml(readLocal());
  if (!db) return cachedGames();
  const [, , fsMod] = fbMods;
  try {
    const snap = await fsMod.getDocs(
      fsMod.query(fsMod.collection(db, 'games'), fsMod.orderBy('createdAt', 'desc'))
    );
    const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    writeLocal(stripHtml(arr));
    return stripHtml(arr);
  } catch (e) {
    console.warn('fetchGames fail, cache se:', e);
    return cachedGames();
  }
}

// Pura game meta + html (chunks reassemble). onProgress(done, total) optional
export async function getGame(id, onProgress) {
  if (mode === 'demo' || !db) {
    const g = readLocal().find((x) => x.id === id);
    return g || null;
  }
  const [, , fsMod] = fbMods;
  const snap = await fsMod.getDoc(fsMod.doc(db, 'games', id));
  if (!snap.exists()) return null;
  const meta = { id: snap.id, ...snap.data() };

  // Legacy: purane docs me html seedha tha
  if (meta.html) return meta;
  if (!meta.chunks) return null;

  // ⚡ Chunks parallel download hote hain (6 ek saath) — 30MB game bhi jaldi
  const parts = new Array(meta.chunks);
  let done = 0;
  const queue = Array.from({ length: meta.chunks }, (_, i) => i);
  async function chunkWorker() {
    while (queue.length) {
      const i = queue.shift();
      const cs = await fsMod.getDoc(fsMod.doc(db, 'gamehtml', id + '_' + i));
      // text string hi hona chahiye — adhoora/corrupt chunk to fail karo
      if (!cs.exists() || typeof cs.data().text !== 'string') {
        throw new Error('chunk ' + i + ' missing/corrupt');
      }
      parts[i] = cs.data().text;
      done++;
      if (onProgress) onProgress(done, meta.chunks);
    }
  }
  const workers = Array.from({ length: Math.min(6, meta.chunks) }, chunkWorker);
  await Promise.all(workers);
  meta.html = parts.join('');
  return meta;
}

// Apne games delete karo (ya admin — email allowlist)
export const ADMIN_EMAILS = ['ankitmovie648@gmail.com'];
export function isAdmin(email) {
  return email && ADMIN_EMAILS.includes(email);
}
export async function deleteGame(gameId, session) {
  if (mode === 'demo') {
    const s = getSession();
    const arr = readLocal().filter(
      (g) => !(g.id === gameId && (g.authorEmail === s?.email || isAdmin(s?.email)))
    );
    writeLocal(arr);
    notify();
    return;
  }
  const [, , fsMod] = fbMods;
  const snap = await fsMod.getDoc(fsMod.doc(db, 'games', gameId));
  if (!snap.exists()) return;
  const g = snap.data();
  const s = session || getSession();
  if (g.authorUid !== s?.uid && !isAdmin(s?.email)) {
    throw new Error('Ye game tumhara nahi hai');
  }
  // chunks delete
  const q = await fsMod.getDocs(
    fsMod.query(fsMod.collection(db, 'gamehtml'), fsMod.where('gameId', '==', gameId))
  );
  for (const d of q.docs) await fsMod.deleteDoc(d.ref);
  await fsMod.deleteDoc(fsMod.doc(db, 'games', gameId));
  notify();
}
