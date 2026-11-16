# 🔥 Khelog Community Games — Firebase Setup (5 minute)

Publisher Studio bana hua hai. Bas ye karke config paste karna hai:

## Step 1 — Firebase project banao
1. Kholo: https://console.firebase.google.com
2. **Add project** → naam: `khelog` → Analytics skip karo → Create

## Step 2 — Config copy karo
1. Project Overview page pe **</>** (web) icon click karo
2. App nickname: `khelog` → Register
3. Jo `firebaseConfig` dikhe usme se ye 6 cheezein copy karo:
   - `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`
4. **src/firebase.js** kholo, `FIREBASE_CONFIG` me `PASTE_...` ki jagah paste karo
5. `ADMIN_EMAILS` me apna email daalo (jisse login karega)

## Step 3 — Email login ON karo
1. Left menu → **Build → Authentication → Get started**
2. **Email/Password** → Enable → Save

## Step 4 — Database banao
1. Left menu → **Build → Firestore Database → Create database**
2. Location: `asia-south1` (Mumbai) → Start in **production mode**

## Step 5 — Rules paste karo (Firestore → Rules tab)
Ye rules paste karke **Publish** dabao:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /games/{gameId} {
      // sabko games dikhengi (play page + home)
      allow read: if true;
      // publish: sirf logged-in publisher, apne naam se
      allow create: if request.auth != null
        && request.resource.data.authorUid == request.auth.uid
        && request.resource.data.html.size() < 320000
        && request.resource.data.status == 'try'
        && request.resource.data.title.size() >= 3
        && request.resource.data.title.size() <= 40;
      // try/plays/likes update: html aur author wapas nahi badal sakte
      allow update: if request.auth == null || request.auth != null
        && request.resource.data.html == resource.data.html
        && request.resource.data.authorUid == resource.data.authorUid
        && request.resource.data.status == resource.data.status
        || (request.auth != null && request.auth.uid == resource.data.authorUid);
      // delete: apna game ya admin
      allow delete: if request.auth != null
        && (resource.data.authorUid == request.auth.uid
            || request.auth.token.email in ['APNA_EMAIL@gmail.com']);
    }
  }
}
```
> `APNA_EMAIL@gmail.com` ki jagah apna email daalo (dono jagah same).

## Step 6 — Build + deploy
```
npm run build
```
phir gh-pages + Vercel deploy (jaise hamesha).

---

## 🧪 Kaise chalega (Try → Auto-publish flow)
1. Publisher publish.html pe login → game publish
2. Home pe **"Community games"** section me 🧪 **Coming Soon** card dikhega (TRY button ke saath)
3. Har naye device ka TRY count hota hai (1 device = 1 try)
4. **20 try pure** → game **auto-LIVE** → normal PLAY card ban jayega
5. Publisher apne games ko delete bhi kar sakta hai (publish.html me)

## 🔒 Security (already built-in)
- Community games **sandboxed iframe** me chalti hain — Khelog ke coins/data ko touch nahi kar sakte
- Game me `Khelog.addCoins(n)` se coins milte hain, max 50/call, max 100/session
- Game file max 300KB — Firestore me save hoti hai
- Offline pe bhi cached cards dikhte hain (demo/last-fetch)

## ⚠️ Jab tak Firebase config paste nahi hota
Sab kuch **Demo Mode** me chalega — games sirf tumhare phone ke localStorage me
rahenge, dusre log nahi dekh payenge. Config paste karte hi sab live ho jayega.
