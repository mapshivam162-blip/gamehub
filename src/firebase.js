// Khelog Community Games — Firebase setup
// ============================================================
// YAHAN APNA FIREBASE CONFIG DAALO (publish me checklist dekho)
// Jab tak config nahi hai, app DEMO MODE me chalega
// (sab data localStorage me — sirf tumhare phone pe dikhega)
// ============================================================
const FIREBASE_CONFIG = {
  apiKey: 'PASTE_API_KEY',
  authDomain: 'PASTE_AUTH_DOMAIN',
  projectId: 'PASTE_PROJECT_ID',
  storageBucket: 'PASTE_STORAGE_BUCKET',
  messagingSenderId: 'PASTE_SENDER_ID',
  appId: 'PASTE_APP_ID',
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
  return { email: cred.user.email, name };
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
  return { email: cred.user.email, name: cred.user.displayName || email };
}

export async function logout() {
  if (mode === 'demo') {
    localStorage.removeItem('khelog_session');
    return;
  }
  const [, authMod] = fbMods;
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
  if (!auth) return null;
  const u = auth.currentUser;
  return u ? { email: u.email, name: u.displayName || u.email, uid: u.uid } : null;
}

// ---------- GAMES ----------
export const MAX_HTML = 300 * 1024; // 300KB limit per game
const REQUIRED_TAGS = /<html|<canvas|<body|<script/i;

export async function publishGame(data) {
  const { title, emoji, desc, html } = data;
  if (!title || title.trim().length < 3) throw new Error('Title kam se kam 3 letters ka ho');
  if (title.length > 40) throw new Error('Title 40 letters se chota rakho');
  if (!desc || desc.trim().length < 5) throw new Error('Description likho (5+ letters)');
  if (desc.length > 120) throw new Error('Description 120 letters se choti rakho');
  if (!html || html.length < 50) throw new Error('Game HTML paste karo');
  if (html.length > MAX_HTML) throw new Error('Game file ' + Math.round(MAX_HTML / 1024) + 'KB se choti honi chahiye (tumhari: ' + Math.round(html.length / 1024) + 'KB)');
  if (!REQUIRED_TAGS.test(html)) throw new Error('Ye valid HTML game nahi lag raha');

  const s = getSession();
  if (!s) throw new Error('Pehle login karo');

  const doc = {
    title: title.trim(),
    emoji: emoji || '🎮',
    desc: desc.trim(),
    html,
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
    doc.id = 'demo_' + Date.now().toString(36);
    arr.unshift(doc);
    writeLocal(arr);
    notify();
    return doc.id;
  }
  const [, , fsMod] = fbMods;
  const ref = await fsMod.addDoc(fsMod.collection(db, 'games'), doc);
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
// taaki offline pe bhi cards dikhen.
export function cachedGames() {
  return readLocal();
}

export async function fetchGames() {
  if (mode === 'demo') return readLocal();
  if (!db) return readLocal();
  const [, , fsMod] = fbMods;
  try {
    const snap = await fsMod.getDocs(
      fsMod.query(fsMod.collection(db, 'games'), fsMod.orderBy('createdAt', 'desc'))
    );
    const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    writeLocal(arr);
    return arr;
  } catch (e) {
    console.warn('fetchGames fail, cache se:', e);
    return readLocal();
  }
}

export async function getGame(id) {
  if (mode === 'demo') return readLocal().find((x) => x.id === id) || null;
  if (!db) return readLocal().find((x) => x.id === id) || null;
  const [, , fsMod] = fbMods;
  const snap = await fsMod.getDoc(fsMod.doc(db, 'games', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// Apne games delete karo (ya admin — email allowlist)
export const ADMIN_EMAILS = ['PASTE_ADMIN_EMAIL@gmail.com'];
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
  await fsMod.deleteDoc(fsMod.doc(db, 'games', gameId));
  notify();
}
