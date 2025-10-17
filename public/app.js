const api = {
    async post(path, body, token){
        const res = await fetch(`/api${path}`, { method:'POST', headers:{ 'Content-Type':'application/json', ...(token?{Authorization:`Bearer ${token}`}:{}) }, body: JSON.stringify(body||{}) });
        if(!res.ok) throw new Error((await res.json()).error||'Request failed');
        return res.json();
    },
    async get(path, token){
        const res = await fetch(`/api${path}`, { headers:{ ...(token?{Authorization:`Bearer ${token}`}:{}) } });
        if(!res.ok) throw new Error((await res.json()).error||'Request failed');
        return res.json();
    }
};

const state = {
    token: localStorage.getItem('token') || null,
    me: null,
    currentChatId: null,
    currentPeer: null,
    micStream: null,
};

const els = {
    authView: document.getElementById('auth-view'),
    appView: document.getElementById('app-view'),
    emailInput: document.getElementById('email-input'),
    getCodeBtn: document.getElementById('get-code-btn'),
    codeInput: document.getElementById('code-input'),
    verifyBtn: document.getElementById('verify-btn'),
    usernameInput: document.getElementById('username-input'),
    setUsernameBtn: document.getElementById('set-username-btn'),
    authError: document.getElementById('auth-error'),
    searchInput: document.getElementById('search-input'),
    searchResults: document.getElementById('search-results'),
    chatsList: document.getElementById('chats-list'),
    messages: document.getElementById('messages'),
    messageInput: document.getElementById('message-input'),
    chatTitle: document.getElementById('chat-title'),
    callBtn: document.getElementById('call-btn'),
    callModal: document.getElementById('call-modal'),
    callStatus: document.getElementById('call-status'),
    acceptCall: document.getElementById('accept-call'),
    rejectCall: document.getElementById('reject-call'),
    hangupCall: document.getElementById('hangup-call'),
    toggleMic: document.getElementById('toggle-mic'),
};

const socket = io();

// Handle Google OAuth redirect
if(location.hash.includes('#oauth=1')){
    const params = new URLSearchParams(location.hash.slice(1));
    const token = params.get('token');
    const needs = params.get('needs')==='1';
    location.hash='';
    if(token){ onAuthSuccess(token, needs).catch(()=>{}); }
}

function show(view){
    els.authView.style.display = view==='auth' ? 'flex' : 'none';
    els.appView.style.display = view==='app' ? 'flex' : 'none';
}

async function onAuthSuccess(token, needsUsername){
    state.token = token; localStorage.setItem('token', token);
    if(needsUsername){
        document.getElementById('step-email').style.display='none';
        document.getElementById('step-code').style.display='none';
        document.getElementById('step-username').style.display='block';
    } else {
        await enterApp();
    }
}

async function enterApp(){
    show('app');
    // A minimal decode of JWT to extract userId
    try {
        const payload = JSON.parse(atob(state.token.split('.')[1]));
        state.me = payload.userId;
        socket.emit('auth', state.me);
    } catch {}
    await loadChats();
}

function renderChats(chats){
    els.chatsList.innerHTML = '';
    for(const chat of chats){
        const item = document.createElement('div');
        item.className='item';
        const other = (chat.participants||[]).find(p=>p.id!==state.me) || { username:'unknown' };
        item.innerHTML = `<div class="avatar"></div><div><div>@${other.username||'unknown'}</div><div style="color:#93a1ad;font-size:12px;">${chat.last_text||''}</div></div>`;
        item.onclick=()=>openChat(chat.chat_id, other);
        els.chatsList.appendChild(item);
    }
}

function renderMessages(messages){
    els.messages.innerHTML = '';
    for(const m of messages){
        const div = document.createElement('div');
        div.className = 'msg' + (m.sender_id===state.me?' me':'');
        div.textContent = m.text;
        els.messages.appendChild(div);
    }
    els.messages.scrollTop = els.messages.scrollHeight;
}

async function loadChats(){
    const data = await api.get('/chats', state.token);
    renderChats(data.chats||[]);
}

async function openChat(chatId, other){
    state.currentChatId = chatId;
    els.chatTitle.textContent = `@${other.username}`;
    const data = await api.get(`/chats/${chatId}/messages`, state.token);
    renderMessages(data.messages||[]);
}

async function sendMessage(text){
    if(!state.currentChatId) return;
    socket.emit('message:send', { chatId: state.currentChatId, senderId: state.me, text });
}

// Auth flow
els.getCodeBtn.onclick = async ()=>{
    try{
        els.authError.textContent='';
        await api.post('/auth/request-code', { email: els.emailInput.value.trim() });
        document.getElementById('step-email').style.display='none';
        document.getElementById('step-code').style.display='block';
    }catch(e){ els.authError.textContent = e.message; }
};

els.verifyBtn.onclick = async ()=>{
    try{
        els.authError.textContent='';
        const r = await api.post('/auth/verify-code', { email: els.emailInput.value.trim(), code: els.codeInput.value.trim() });
        await onAuthSuccess(r.token, r.needsUsername);
    }catch(e){ els.authError.textContent = e.message; }
};

els.setUsernameBtn.onclick = async ()=>{
    try{
        await api.post('/auth/username', { username: els.usernameInput.value.trim() }, state.token);
        await enterApp();
    }catch(e){ els.authError.textContent = e.message; }
};

// Search users
let searchTimer;
els.searchInput.addEventListener('input', ()=>{
    clearTimeout(searchTimer);
    const q = els.searchInput.value.trim();
    if(!q){ els.searchResults.style.display='none'; els.searchResults.innerHTML=''; return; }
    searchTimer = setTimeout(async ()=>{
        try{
            const data = await api.get(`/users/search?q=${encodeURIComponent(q)}`, state.token);
            els.searchResults.innerHTML='';
            for(const u of data.users||[]){
                const item = document.createElement('div');
                item.className='item';
                item.innerHTML = `<div class="avatar"></div><div>@${u.username}</div>`;
                item.onclick = async ()=>{
                    const r = await api.post('/chats/open', { targetUserId: u.id }, state.token);
                    await openChat(r.chatId, u);
                    els.searchResults.style.display='none';
                    els.searchInput.value='';
                    await loadChats();
                };
                els.searchResults.appendChild(item);
            }
            els.searchResults.style.display='block';
        }catch(e){ console.error(e); }
    }, 300);
});

// Composer
els.messageInput.addEventListener('keydown', (e)=>{
    if(e.key==='Enter'){
        const text = els.messageInput.value.trim();
        if(text){ sendMessage(text); els.messageInput.value=''; }
    }
});

// Socket listeners
socket.on('message:new', ({ chatId, message })=>{
    if(chatId === state.currentChatId){
        const div = document.createElement('div');
        div.className = 'msg' + (message.sender_id===state.me?' me':'');
        div.textContent = message.text;
        els.messages.appendChild(div);
        els.messages.scrollTop = els.messages.scrollHeight;
    }
});
socket.on('chats:update', ()=>{ loadChats().catch(()=>{}); });

// Call signaling (audio only)
async function startCall(toUserId){
    state.micStream = await navigator.mediaDevices.getUserMedia({ audio:true });
    const Peer = window.SimplePeer.default || window.SimplePeer;
    const peer = new Peer({ initiator:true, trickle:true, stream: state.micStream });
    state.currentPeer = peer;
    els.callModal.style.display='flex';
    els.callStatus.textContent='Звонок...';
    els.acceptCall.style.display='none';
    els.rejectCall.style.display='block';
    els.hangupCall.style.display='block';
    els.toggleMic.style.display='block';
    peer.on('signal', data=>{
        if(data.type==='offer') socket.emit('call:offer', { toUserId, fromUserId: state.me, sdp: data });
        if(data.candidate) socket.emit('call:ice', { toUserId, fromUserId: state.me, candidate: data });
    });
    socket.on('call:answer', ({ fromUserId, sdp })=>{ peer.signal(sdp); });
    socket.on('call:ice', ({ candidate })=>{ peer.signal(candidate); });
    peer.on('connect', ()=>{ els.callStatus.textContent='Разговор'; });
    peer.on('error', ()=>{ endCall(); });
    els.hangupCall.onclick = ()=>{ socket.emit('call:hangup', { toUserId, fromUserId: state.me }); endCall(); };
    els.toggleMic.onclick = ()=>{
        for(const t of state.micStream.getAudioTracks()) t.enabled = !t.enabled;
    };
    els.rejectCall.onclick = ()=>{ socket.emit('call:hangup', { toUserId, fromUserId: state.me }); endCall(); };
}

function endCall(){
    if(state.currentPeer){ try{ state.currentPeer.destroy(); }catch{} }
    if(state.micStream){ for(const t of state.micStream.getTracks()) t.stop(); }
    state.currentPeer=null; state.micStream=null;
    els.callModal.style.display='none';
}

// Incoming call
socket.on('call:offer', async ({ fromUserId, sdp })=>{
    els.callModal.style.display='flex';
    els.callStatus.textContent=`Входящий звонок`;
    els.acceptCall.style.display='inline-block';
    els.rejectCall.style.display='inline-block';
    els.hangupCall.style.display='none';
    els.toggleMic.style.display='none';
    els.acceptCall.onclick = async ()=>{
        els.acceptCall.style.display='none';
        els.hangupCall.style.display='inline-block';
        els.toggleMic.style.display='inline-block';
        state.micStream = await navigator.mediaDevices.getUserMedia({ audio:true });
        const Peer = window.SimplePeer.default || window.SimplePeer;
        const peer = new Peer({ initiator:false, trickle:true, stream: state.micStream });
        state.currentPeer = peer;
        peer.on('signal', data=>{
            if(data.type==='answer') socket.emit('call:answer', { toUserId: fromUserId, fromUserId: state.me, sdp: data });
            if(data.candidate) socket.emit('call:ice', { toUserId: fromUserId, fromUserId: state.me, candidate: data });
        });
        peer.signal(sdp);
        socket.on('call:ice', ({ candidate })=>{ peer.signal(candidate); });
        peer.on('connect', ()=>{ els.callStatus.textContent='Разговор'; });
        peer.on('error', ()=>{ endCall(); });
        els.hangupCall.onclick = ()=>{ socket.emit('call:hangup', { toUserId: fromUserId, fromUserId: state.me }); endCall(); };
        els.toggleMic.onclick = ()=>{
            for(const t of state.micStream.getAudioTracks()) t.enabled = !t.enabled;
        };
    };
    els.rejectCall.onclick = ()=>{ socket.emit('call:hangup', { toUserId: fromUserId, fromUserId: state.me }); endCall(); };
});
socket.on('call:hangup', ()=>{ endCall(); });

// Call button tries to call other participant of current chat
els.callBtn.onclick = async ()=>{
    if(!state.currentChatId) return;
    // naive fetch of chat to get other user id
    const chats = await api.get('/chats', state.token);
    const chat = (chats.chats||[]).find(c=>c.chat_id===state.currentChatId);
    const other = (chat?.participants||[]).find(p=>p.id!==state.me);
    if(other) startCall(other.id);
};

// Auto-login if token exists
if(state.token){ enterApp().catch(()=>{ show('auth'); }); } else { show('auth'); }


