// app.js
const API_BASE = 'https://vansono.onrender.com';
const SOCKET_URL = 'https://vansono.onrender.com';

let token = localStorage.getItem('token');
let socket;
let currentUser = {};
let pc; // WebRTC PeerConnection
let localStream;
let contacts = new Set(); // To track added contacts
let activeCall = {
    targetUserId: null,
    fromUserId: null,
    callType: 'video',
    pendingOffer: null
};

// DOM Elements
const authContainer = document.getElementById('auth-container');
const mainApp = document.getElementById('main-app');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const verifyForm = document.getElementById('verify-form');
const toggleAuth = document.getElementById('toggle-auth');
const toggleToLogin = document.getElementById('toggle-to-login');
const errorMsg = document.getElementById('error-msg');
const searchInput = document.getElementById('search-users');
const userList = document.getElementById('user-list');
const logoutBtn = document.getElementById('logout-btn');
const callModal = document.getElementById('call-modal');
const messageModal = document.getElementById('message-modal');
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');

// Utility Functions
function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.classList.remove('hidden');
}

function hideError() {
    errorMsg.classList.add('hidden');
}

function showSection(show, hide) {
    show.classList.remove('hidden');
    hide.classList.add('hidden');
}

function apiCall(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
    }).then(res => {
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        return res.json();
    });
}

// Auth Functions
async function handleLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    if (!email || !password) return showError('Заполните все поля');

    try {
        const data = await apiCall('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
        localStorage.setItem('token', data.token);
        token = data.token;
        currentUser = data.user;
        initApp();
    } catch (err) {
        showError('Ошибка входа: ' + err.message);
    }
}

async function handleRegisterSendCode() {
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    if (!email || !password) return showError('Заполните все поля');

    try {
        await apiCall('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
        showSection(verifyForm, registerForm);
        toggleToLogin.classList.remove('hidden');
        hideError();
    } catch (err) {
        showError('Ошибка регистрации: ' + err.message);
    }
}

async function handleVerify() {
    const email = document.getElementById('reg-email').value; // Reuse from reg
    const code = document.getElementById('verify-code').value;
    const password = document.getElementById('verify-password').value;
    const displayName = document.getElementById('display-name').value || email.split('@')[0];
    if (!email || !code || !password) return showError('Заполните все поля');

    try {
        const data = await apiCall('/auth/verify', {
            method: 'POST',
            body: JSON.stringify({ email, code, password, displayName }),
        });
        localStorage.setItem('token', data.token);
        token = data.token;
        currentUser = data.user;
        initApp();
    } catch (err) {
        showError('Ошибка подтверждения: ' + err.message);
    }
}

function toggleAuthMode() {
    if (loginForm.classList.contains('hidden')) {
        showSection(loginForm, registerForm);
        toggleAuth.textContent = 'Нет аккаунта? Зарегистрироваться';
        toggleToLogin.classList.add('hidden');
    } else {
        showSection(registerForm, loginForm);
        toggleAuth.textContent = 'Уже есть аккаунт? Войти';
        toggleToLogin.classList.add('hidden');
    }
    hideError();
}

function toggleToLoginMode() {
    showSection(loginForm, verifyForm);
    toggleAuth.textContent = 'Нет аккаунта? Зарегистрироваться';
    toggleToLogin.classList.add('hidden');
    hideError();
}

// App Init
async function initApp() {
    try {
        const data = await apiCall('/users/me');
        currentUser = data.user;
        showSection(mainApp, authContainer);
        initSocket();
        loadContacts();
        searchInput.addEventListener('input', handleSearch);
        logoutBtn.addEventListener('click', logout);
    } catch (err) {
        console.error('Init error:', err);
        logout();
    }
}

function logout() {
    localStorage.removeItem('token');
    token = null;
    if (socket) socket.disconnect();
    showSection(authContainer, mainApp);
    document.getElementById('login-email').value = '';
    document.getElementById('login-password').value = '';
}

// Socket and Calls
function initSocket() {
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 5;

    socket = io(SOCKET_URL, {
        auth: { token },
        reconnection: true,
        reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
        reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
        console.log('Socket connected');
    });

    socket.on('reconnect', (attempt) => {
        console.log('Reconnected after', attempt, 'attempts');
        reconnectAttempts = 0;
    });

    socket.on('reconnect_failed', () => {
        alert('Не удалось подключиться к серверу');
    });

    // Contact status updates
    socket.on('user:status', (data) => {
        updateUserStatus(data.userId, data.status);
    });

    socket.on('call:incoming', async (data) => {
        // Save who is calling and the offer to answer properly
        activeCall.fromUserId = data.fromUserId;
        activeCall.targetUserId = data.fromUserId; // for responses we target the caller
        activeCall.callType = data.callType || 'video';
        activeCall.pendingOffer = data.offer || null;
        document.getElementById('caller-name').textContent = data.fromUserEmail;
        callModal.classList.remove('hidden');
    });

    document.getElementById('accept-call').addEventListener('click', async () => {
        callModal.classList.add('hidden');
        await startCall(true); // Answer
    });

    document.getElementById('reject-call').addEventListener('click', () => {
        callModal.classList.add('hidden');
        if (activeCall.fromUserId) {
            socket.emit('call:reject', { targetUserId: activeCall.fromUserId });
        }
    });

    socket.on('call:answered', async (data) => {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        addIceCandidates();
    });

    socket.on('call:rejected', () => {
        alert('Звонок отклонен');
        endCall();
    });

    socket.on('call:ended', () => {
        endCall();
    });

    socket.on('ice-candidate', async (data) => {
        try {
            if (!pc) return;
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (err) {
            console.error('ICE add error:', err);
        }
    });
}

// Update UI user status badges (simple placeholder)
function updateUserStatus(userId, status) {
    // If users are rendered, mark status near action buttons
    const buttons = document.querySelectorAll('.user-item');
    buttons.forEach(item => {
        const callBtn = item.querySelector('button.btn.green');
        if (!callBtn) return;
        const onclick = callBtn.getAttribute('onclick');
        if (onclick && onclick.includes(`initiateCall(${userId})`)) {
            let badge = item.querySelector('.status-badge');
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'status-badge';
                badge.style.marginLeft = '8px';
                badge.style.fontSize = '12px';
                item.querySelector('.user-name').appendChild(badge);
            }
            badge.textContent = status === 'online' ? '• online' : '• offline';
            badge.style.color = status === 'online' ? '#10b981' : '#9ca3af';
        }
    });
}

async function initiateCall(targetUserId, callType = 'video') {
    try {
        activeCall.targetUserId = targetUserId;
        activeCall.fromUserId = currentUser.id;
        activeCall.callType = callType;

        pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' }
            ]
        });

        // Connection state handling
        pc.onconnectionstatechange = () => {
            console.log('Connection state:', pc.connectionState);
            if (pc.connectionState === 'failed') {
                alert('Ошибка соединения');
                endCall();
            }
        };

        localStream = await navigator.mediaDevices.getUserMedia({ video: callType === 'video', audio: true });
        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
        localVideo.srcObject = localStream;
        localVideo.classList.remove('hidden');

        pc.ontrack = (event) => {
            // Avoid flicker: only set if changed
            const incoming = event.streams[0];
            if (remoteVideo.srcObject !== incoming) remoteVideo.srcObject = incoming;
            remoteVideo.classList.remove('hidden');
        };

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice-candidate', { targetUserId, candidate: event.candidate });
            }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('call:initiate', { targetUserId, offer, callType });
        document.getElementById('call-controls').classList.remove('hidden');
        document.getElementById('btn-toggle-video').classList.add('pulsing');
    } catch (err) {
        console.error('Call init error:', err);
        alert('Ошибка доступа к камере/микрофону: ' + (err && err.message ? err.message : 'Unknown error'));
    }
}

async function startCall(isAnswer = false) {
    if (isAnswer) {
        try {
            pc = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' }
                ]
            });

            pc.onconnectionstatechange = () => {
                console.log('Connection state:', pc.connectionState);
                if (pc.connectionState === 'failed') {
                    alert('Ошибка соединения');
                    endCall();
                }
            };

            localStream = await navigator.mediaDevices.getUserMedia({ video: activeCall.callType === 'video', audio: true });
            localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
            localVideo.srcObject = localStream;
            localVideo.classList.remove('hidden');

            pc.ontrack = (event) => {
                remoteVideo.srcObject = event.streams[0];
                remoteVideo.classList.remove('hidden');
            };

            pc.onicecandidate = (event) => {
                if (event.candidate && activeCall.fromUserId) {
                    socket.emit('ice-candidate', { targetUserId: activeCall.fromUserId, candidate: event.candidate });
                }
            };

            // Apply caller's offer before creating answer
            if (activeCall.pendingOffer) {
                await pc.setRemoteDescription(new RTCSessionDescription(activeCall.pendingOffer));
            }

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            if (activeCall.fromUserId) {
                socket.emit('call:answer', { targetUserId: activeCall.fromUserId, answer });
            }
            document.getElementById('call-controls').classList.remove('hidden');
            document.getElementById('btn-toggle-video').classList.add('pulsing');
        } catch (err) {
            console.error('Answer error:', err);
            alert('Ошибка ответа на звонок: ' + (err && err.message ? err.message : 'Unknown error'));
        }
    }
}

function addIceCandidates() {
    // Handle ICE after remote desc
}

function endCall() {
    if (pc) pc.close();
    if (localStream) localStream.getTracks().forEach(track => track.stop());
    localVideo.srcObject = null;
    remoteVideo.srcObject = null;
    localVideo.classList.add('hidden');
    remoteVideo.classList.add('hidden');
    activeCall = { targetUserId: null, fromUserId: null, callType: 'video', pendingOffer: null };
    const controls = document.getElementById('call-controls');
    if (controls) controls.classList.add('hidden');
    const pulseBtn = document.getElementById('btn-toggle-video');
    if (pulseBtn) pulseBtn.classList.remove('pulsing');
}

// Media controls
function toggleVideo() {
    if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
        }
    }
}

function toggleAudio() {
    if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
        }
    }
}

async function switchCamera() {
    try {
        if (!localStream) return;
        const constraints = { video: { facingMode: 'user' }, audio: true };
        const currentVideoTrack = localStream.getVideoTracks()[0];
        const currentFacing = currentVideoTrack && currentVideoTrack.getSettings().facingMode;
        if (currentFacing === 'user') constraints.video.facingMode = { exact: 'environment' };

        const newStream = await navigator.mediaDevices.getUserMedia(constraints);
        const newVideoTrack = newStream.getVideoTracks()[0];
        if (pc && newVideoTrack) {
            const senders = pc.getSenders();
            const videoSender = senders.find(s => s.track && s.track.kind === 'video');
            if (videoSender) {
                await videoSender.replaceTrack(newVideoTrack);
            }
        }
        // Stop old video track, keep audio
        if (currentVideoTrack) currentVideoTrack.stop();
        // Update localStream tracks and video element
        localStream.removeTrack(currentVideoTrack);
        localStream.addTrack(newVideoTrack);
        localVideo.srcObject = localStream;
    } catch (err) {
        console.error('Switch camera error:', err);
        alert('Не удалось переключить камеру');
    }
}

// Hook up UI buttons
const controls = document.getElementById('call-controls');
if (controls) {
    const btnVideo = document.getElementById('btn-toggle-video');
    const btnAudio = document.getElementById('btn-toggle-audio');
    const btnSwitch = document.getElementById('btn-switch-camera');
    const btnEnd = document.getElementById('btn-end-call');
    if (btnVideo) btnVideo.onclick = toggleVideo;
    if (btnAudio) btnAudio.onclick = toggleAudio;
    if (btnSwitch) btnSwitch.onclick = switchCamera;
    if (btnEnd) btnEnd.onclick = () => {
        if (activeCall.targetUserId) {
            socket.emit('call:end', { targetUserId: activeCall.targetUserId });
        } else if (activeCall.fromUserId) {
            socket.emit('call:end', { targetUserId: activeCall.fromUserId });
        }
        endCall();
    };
}

// Users and Contacts
async function loadContacts() {
    try {
        const data = await apiCall('/contacts');
        data.contacts.forEach(c => contacts.add(c.id));
    } catch (err) {
        console.error('Load contacts error:', err);
    }
}

async function handleSearch() {
    const q = searchInput.value.trim();
    if (q.length < 1) {
        userList.innerHTML = '<p>Введите запрос для поиска пользователей.</p>';
        return;
    }
    try {
        const data = await apiCall(`/users/search?q=${encodeURIComponent(q)}`);
        renderUserList(data.users);
    } catch (err) {
        console.error('Search error:', err);
        userList.innerHTML = '<p>Ошибка поиска.</p>';
    }
}

function renderUserList(users) {
    userList.innerHTML = users.map(user => `
        <div class="user-item">
            <div class="user-info">
                <div class="user-name">${user.display_name || user.email}</div>
                <div class="user-email">${user.email}</div>
            </div>
            <div class="user-actions">
                <button class="btn blue" onclick="openChat(${user.id}, '${user.display_name || user.email}')">Написать</button>
                <button class="btn green" onclick="initiateCall(${user.id})">Позвонить</button>
                ${!contacts.has(user.id) ? `<button class="btn" onclick="addContact(${user.id})">Добавить</button>` : ''}
            </div>
        </div>
    `).join('');
}

async function addContact(contactId) {
    try {
        await apiCall('/contacts', {
            method: 'POST',
            body: JSON.stringify({ contactId }),
        });
        contacts.add(contactId);
        handleSearch(); // Refresh list
    } catch (err) {
        alert('Ошибка добавления контакта');
    }
}

function openChat(userId, userName) {
    document.getElementById('chat-user-name').textContent = userName;
    document.getElementById('chat-messages').innerHTML = '<p>Чат пуст.</p>';
    messageModal.classList.remove('hidden');
    document.getElementById('send-message').onclick = () => {
        const msg = document.getElementById('message-input').value;
        if (msg) {
            document.getElementById('chat-messages').innerHTML += `<p><strong>Вы:</strong> ${msg}</p>`;
            document.getElementById('message-input').value = '';
            if (socket) {
                socket.emit('chat:send', { targetUserId: userId, message: msg });
            }
        }
    };
}

// Incoming chat messages
if (typeof io !== 'undefined') {
    // When socket initialized, this handler will be active
    const ensureChatHandler = () => {
        if (!socket || socket._chatHandlerSet) return;
        socket.on('chat:message', (data) => {
            const box = document.getElementById('chat-messages');
            if (box) {
                const time = new Date(data.timestamp).toLocaleTimeString();
                box.innerHTML += `<p><strong>${data.fromUserId}:</strong> ${data.message} <span style="color:#999;font-size:12px;">${time}</span></p>`;
            }
        });
        socket._chatHandlerSet = true;
    };
    // Hook into socket creation
    const originalInitSocket = initSocket;
    initSocket = function() {
        originalInitSocket.apply(this, arguments);
        ensureChatHandler();
    };
}

// Event Listeners
document.getElementById('login-btn').addEventListener('click', handleLogin);
document.getElementById('reg-send-code').addEventListener('click', handleRegisterSendCode);
document.getElementById('verify-btn').addEventListener('click', handleVerify);
toggleAuth.addEventListener('click', toggleAuthMode);
toggleToLogin.addEventListener('click', toggleToLoginMode);

// Modals close
[callModal, messageModal].forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.add('hidden');
    });
});

// Init
if (token) {
    initApp();
} else {
    showSection(authContainer, mainApp);
}