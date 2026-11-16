// Chess Online — PeerJS room-code multiplayer + chat (Khelog)
// Host = WHITE ('w'), Guest = BLACK ('b'). Protocol:
//   { t: 'move', fr, fc, tr, tc }
//   { t: 'chat', msg }
//   { t: 'restart' }
//   { t: 'hi' }

(function () {
    'use strict';

    let peer = null;
    let conn = null;
    let isHost = false;
    let unread = 0;
    let netOpen = false;

    const onlineBtn = document.getElementById('mode-online');
    const onlineCard = document.getElementById('online-card');
    const createBtn = document.getElementById('chess-create');
    const joinBtn = document.getElementById('chess-join');
    const codeInput = document.getElementById('chess-code');
    const statusEl = document.getElementById('chess-status');
    const chatFab = document.getElementById('chat-fab');
    const chatPanel = document.getElementById('chat-panel');
    const chatMsgs = document.getElementById('chat-msgs');
    const chatInput = document.getElementById('chat-input');
    const chatSendBtn = document.getElementById('chat-send');
    const chatBadge = document.getElementById('chat-badge');

    const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    function makeRoomCode() {
        return Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
    }
    function peerIdFor(code) { return 'khelog-chess-' + code; }

    function netStatus(text, cls) {
        if (!statusEl) return;
        statusEl.textContent = text;
        statusEl.className = 'net-status' + (cls ? ' ' + cls : '');
    }

    // ===== Copy code button =====
    function copyText(txt) {
        const done = () => netStatus('✅ Copy ho gaya! Dost ko bhejo', 'ok');
        const fallback = () => {
            try {
                const ta = document.createElement('textarea');
                ta.value = txt;
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                done();
            } catch (e) { netStatus('Copy nahi hua — code yaad rakho', 'err'); }
        };
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(txt).then(done, fallback);
            } else fallback();
        } catch (e) { fallback(); }
    }

    // ===== Mode switching =====
    if (onlineBtn) {
        onlineBtn.addEventListener('click', () => {
            document.querySelectorAll('.mode-btn').forEach(x => x.classList.remove('active'));
            onlineBtn.classList.add('active');
            const diffRow = document.getElementById('diff-row');
            if (diffRow) diffRow.style.display = 'none';
            if (onlineCard) onlineCard.style.display = '';
            chatFab.classList.remove('show');
        });
    }
    // Doosre modes pe online session band
    ['mode-2p', 'mode-ai'].forEach(id => {
        const b = document.getElementById(id);
        if (b) b.addEventListener('click', () => {
            if (onlineCard) onlineCard.style.display = 'none';
            endOnlineSession(true);
        });
    });

    if (createBtn) createBtn.addEventListener('click', createRoom);
    if (joinBtn) joinBtn.addEventListener('click', joinRoom);
    if (codeInput) codeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') joinRoom(); });

    chatFab.addEventListener('click', () => {
        chatPanel.classList.add('show');
        unread = 0;
        chatBadge.classList.add('hidden');
        chatMsgs.scrollTop = chatMsgs.scrollHeight;
    });
    document.getElementById('chat-close').addEventListener('click', () => chatPanel.classList.remove('show'));
    chatSendBtn.addEventListener('click', sendChat);
    chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(); });

    // ===== Room create / join =====
    function createRoom() {
        closeNet();
        isHost = true;
        const code = makeRoomCode();
        netStatus('Room ban raha hai...', '');
        try {
            peer = new Peer(peerIdFor(code));
        } catch (e) { netStatus('Network error! Internet check karo', 'err'); return; }
        peer.on('open', () => {
            statusEl.innerHTML = 'Room Code: <span class="room-code-big">' + code + '</span><br><button id="copy-code-btn" class="copy-code-btn">📋 Code Copy Karo</button><br>Dost ka wait...';
            statusEl.className = 'net-status';
            const cp = document.getElementById('copy-code-btn');
            if (cp) cp.addEventListener('click', () => copyText(code));
        });
        peer.on('connection', (c) => { conn = c; wireConn(); });
        peer.on('error', (e) => netStatus('Error: ' + e.type, 'err'));
    }

    function joinRoom() {
        const code = (codeInput.value || '').trim().toUpperCase();
        if (code.length < 4) { netStatus('Poora code likho (5 letters)', 'err'); return; }
        closeNet();
        isHost = false;
        netStatus('Dost se jud rahe hain...', '');
        try {
            peer = new Peer();
        } catch (e) { netStatus('Network error! Internet check karo', 'err'); return; }
        peer.on('open', () => {
            conn = peer.connect(peerIdFor(code), { reliable: true });
            wireConn();
        });
        peer.on('error', (e) => {
            netStatus(e.type === 'peer-unavailable' ? 'Room nahi mila! Code check karo' : 'Error: ' + e.type, 'err');
        });
    }

    function wireConn() {
        if (!conn) return;
        conn.on('open', () => {
            netOpen = true;
            netStatus('✅ Dost jud gaya! Khel shuru', 'ok');
            startOnlineChess();
            sendNet({ t: 'hi' });
        });
        conn.on('data', onNetMsg);
        conn.on('close', () => {
            netOpen = false;
            addChat('sys', 'Dost chala gaya 😢');
            netStatus('Dost disconnect ho gaya', 'err');
        });
        conn.on('error', () => { netOpen = false; netStatus('Connection error', 'err'); });
    }

    function sendNet(obj) {
        if (conn && conn.open) {
            try { conn.send(obj); } catch (e) { /* ignore */ }
        }
    }
    window.chessSendNet = sendNet;

    function onNetMsg(data) {
        if (!data || typeof data !== 'object') return;
        if (data.t === 'move') {
            if (netOpen) window.makeMove(data.fr, data.fc, data.tr, data.tc, true);
        } else if (data.t === 'chat') {
            addChat('them', String(data.msg).slice(0, 120));
        } else if (data.t === 'restart') {
            if (window.resetGame) window.resetGame();
            addChat('sys', 'Naya game shuru!');
        } else if (data.t === 'hi') {
            addChat('sys', 'Dost online hai 👋');
        }
    }

    function startOnlineChess() {
        const myColor = isHost ? 'w' : 'b';
        if (window.chessSetOnlineColor) window.chessSetOnlineColor(myColor);
        if (window.resetGame) window.resetGame();
        chatFab.classList.add('show');
        addChat('sys', 'Tum ' + (myColor === 'w' ? '⚪ White' : '⚫ Black') + ' khel rahe ho. Shubhkamnayein!');
        chatMsgs.scrollTop = chatMsgs.scrollHeight;
    }

    function endOnlineSession(silent) {
        closeNet();
        chatFab.classList.remove('show');
        chatPanel.classList.remove('show');
        unread = 0;
        chatBadge.classList.add('hidden');
        chatMsgs.innerHTML = '';
        if (window.chessSetOnlineColor) window.chessSetOnlineColor(null);
        if (!silent) netStatus('Room band ho gaya', '');
    }

    function closeNet() {
        netOpen = false;
        try { if (conn) conn.close(); } catch (e) {}
        try { if (peer) peer.destroy(); } catch (e) {}
        conn = null;
        peer = null;
    }

    // ===== Chat =====
    function sendChat() {
        const msg = chatInput.value.trim();
        if (!msg) return;
        addChat('me', msg);
        sendNet({ t: 'chat', msg });
        chatInput.value = '';
        chatInput.focus();
    }

    function addChat(kind, text) {
        const d = document.createElement('div');
        d.className = 'chat-msg ' + kind;
        d.textContent = text;
        chatMsgs.appendChild(d);
        chatMsgs.scrollTop = chatMsgs.scrollHeight;
        if (kind === 'them' && !chatPanel.classList.contains('show')) {
            unread++;
            chatBadge.textContent = unread > 9 ? '9+' : unread;
            chatBadge.classList.remove('hidden');
        }
    }
})();
