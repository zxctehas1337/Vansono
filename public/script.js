// Глобальные переменные
let socket;
let currentUser = null;
let currentRoom = null;
let localStream = null;
let remoteStream = null;
let peerConnection = null;
let isInCall = false;

// WebRTC конфигурация
const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    loadSettings();
});

// Инициализация приложения
function initializeApp() {
    // Подключение к Socket.io серверу
    socket = io();
    
    // Настройка обработчиков событий Socket.io
    setupSocketListeners();
    
    // Установка темы по умолчанию
    applyTheme('dark');
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Форма входа
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    
    // Форма отправки сообщений
    document.getElementById('message-form').addEventListener('submit', handleSendMessage);
    
    // Кнопки звонков
    document.getElementById('call-btn').addEventListener('click', startCall);
    document.getElementById('end-call-btn').addEventListener('click', endCall);
    document.getElementById('accept-call-btn').addEventListener('click', acceptCall);
    document.getElementById('reject-call-btn').addEventListener('click', rejectCall);
    
    // Настройки
    document.getElementById('settings-btn').addEventListener('click', toggleSettings);
    document.getElementById('theme-select').addEventListener('change', handleThemeChange);
    document.getElementById('font-size').addEventListener('change', handleFontSizeChange);
    document.getElementById('logout-btn').addEventListener('click', logout);
    
    // Видео
    document.getElementById('close-video-btn').addEventListener('click', closeVideo);
    
    // Закрытие модального окна при клике вне его
    document.getElementById('incoming-call-modal').addEventListener('click', function(e) {
        if (e.target === this) {
            hideIncomingCallModal();
        }
    });
}

// Настройка обработчиков Socket.io
function setupSocketListeners() {
    // Подключение к серверу
    socket.on('connect', function() {
    });
    
    // История комнаты
    socket.on('room-history', function(data) {
        currentRoom = data.roomId;
        document.getElementById('current-room-id').textContent = data.roomId;
        document.getElementById('user-count').textContent = data.users.length;
        
        // Отображение истории сообщений
        data.messages.forEach(message => {
            displayMessage(message);
        });
        
        // Отображение списка пользователей
        updateUsersList(data.users);
    });
    
    // Новое сообщение
    socket.on('new-message', function(message) {
        displayMessage(message);
    });
    
    // Пользователь присоединился
    socket.on('user-joined', function(data) {
        updateUserCount();
        addUserToList(data);
        showNotification(`${data.nickname} присоединился к чату`);
    });
    
    // Пользователь покинул
    socket.on('user-left', function(data) {
        updateUserCount();
        removeUserFromList(data.userId);
        showNotification(`${data.username} покинул чат`);
    });
    
    // WebRTC события
    socket.on('incoming-call', function(data) {
        showIncomingCallModal(data.fromUser);
    });
    
    socket.on('call-rejected', function() {
        hideIncomingCallModal();
        showNotification('Звонок отклонен');
    });
    
    socket.on('call-ended', function() {
        endCall();
        showNotification('Звонок завершен');
    });
    
    socket.on('webrtc-offer', function(data) {
        handleWebRTCOffer(data.offer, data.from);
    });
    
    socket.on('webrtc-answer', function(data) {
        handleWebRTCAnswer(data.answer, data.from);
    });
    
    socket.on('webrtc-ice-candidate', function(data) {
        handleWebRTCIceCandidate(data.candidate, data.from);
    });
}

// Обработка входа
function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const nickname = document.getElementById('nickname').value.trim();
    const roomId = document.getElementById('room-id').value.trim();
    
    if (!username || !nickname) {
        alert('Пожалуйста, заполните все обязательные поля');
        return;
    }
    
    currentUser = { username, nickname };
    
    // Присоединение к комнате
    socket.emit('join-room', {
        username,
        nickname,
        roomId: roomId || null
    });
    
    // Переход к экрану чата
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('chat-screen').classList.add('active');
}

// Обработка отправки сообщения
function handleSendMessage(e) {
    e.preventDefault();
    
    const messageInput = document.getElementById('message-input');
    const messageText = messageInput.value.trim();
    
    if (!messageText) return;
    
    socket.emit('send-message', {
        text: messageText
    });
    
    messageInput.value = '';
}

// Отображение сообщения
function displayMessage(message) {
    const messagesList = document.getElementById('messages-list');
    const messageElement = document.createElement('div');
    
    const isOwnMessage = message.userId === socket.id;
    messageElement.className = `message ${isOwnMessage ? 'own' : 'other'}`;
    
    const timestamp = new Date(message.timestamp).toLocaleTimeString();
    
    messageElement.innerHTML = `
        <div class="message-header">${message.nickname}</div>
        <div class="message-text">${escapeHtml(message.text)}</div>
        <div class="message-time">${timestamp}</div>
    `;
    
    messagesList.appendChild(messageElement);
    messagesList.scrollTop = messagesList.scrollHeight;
}

// Экранирование HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Обновление списка пользователей
function updateUsersList(users) {
    const usersList = document.getElementById('users-list');
    usersList.innerHTML = '';
    
    users.forEach(user => {
        const li = document.createElement('li');
        li.textContent = `${user.nickname}`;
        li.dataset.userId = user.userId;
        usersList.appendChild(li);
    });
}

// Добавление пользователя в список
function addUserToList(userData) {
    const usersList = document.getElementById('users-list');
    const li = document.createElement('li');
    li.textContent = `${userData.nickname}`;
    li.dataset.userId = userData.userId;
    usersList.appendChild(li);
}

// Удаление пользователя из списка
function removeUserFromList(userId) {
    const usersList = document.getElementById('users-list');
    const userElement = usersList.querySelector(`[data-user-id="${userId}"]`);
    if (userElement) {
        userElement.remove();
    }
}

// Обновление счетчика пользователей
function updateUserCount() {
    const usersList = document.getElementById('users-list');
    const count = usersList.children.length;
    document.getElementById('user-count').textContent = count;
}

// Начало звонка
async function startCall() {
    if (isInCall) return;
    
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });
        
        document.getElementById('local-video').srcObject = localStream;
        
        // Создание peer connection
        peerConnection = new RTCPeerConnection(rtcConfig);
        
        // Добавление локального потока
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
        
        // Обработка удаленного потока
        peerConnection.ontrack = function(event) {
            remoteStream = event.streams[0];
            document.getElementById('remote-video').srcObject = remoteStream;
        };
        
        // Обработка ICE кандидатов
        peerConnection.onicecandidate = function(event) {
            if (event.candidate) {
                socket.emit('webrtc-ice-candidate', {
                    candidate: event.candidate,
                    to: 'all'
                });
            }
        };
        
        // Создание offer
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        socket.emit('webrtc-offer', { offer });
        socket.emit('start-call');
        
        // Показать видео контейнер
        document.getElementById('video-container').classList.remove('hidden');
        document.getElementById('call-btn').classList.add('hidden');
        document.getElementById('end-call-btn').classList.remove('hidden');
        
        isInCall = true;
        
    } catch (error) {
        console.error('Ошибка при начале звонка:', error);
        alert('Не удалось получить доступ к камере и микрофону');
    }
}

// Принятие звонка
async function acceptCall() {
    if (isInCall) return;
    
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });
        
        document.getElementById('local-video').srcObject = localStream;
        
        // Создание peer connection
        peerConnection = new RTCPeerConnection(rtcConfig);
        
        // Добавление локального потока
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
        
        // Обработка удаленного потока
        peerConnection.ontrack = function(event) {
            remoteStream = event.streams[0];
            document.getElementById('remote-video').srcObject = remoteStream;
        };
        
        // Обработка ICE кандидатов
        peerConnection.onicecandidate = function(event) {
            if (event.candidate) {
                socket.emit('webrtc-ice-candidate', {
                    candidate: event.candidate,
                    to: 'all'
                });
            }
        };
        
        // Создание answer
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        socket.emit('webrtc-answer', { 
            answer,
            to: 'all'
        });
        
        // Показать видео контейнер
        document.getElementById('video-container').classList.remove('hidden');
        document.getElementById('call-btn').classList.add('hidden');
        document.getElementById('end-call-btn').classList.remove('hidden');
        
        hideIncomingCallModal();
        isInCall = true;
        
    } catch (error) {
        console.error('Ошибка при принятии звонка:', error);
        alert('Не удалось получить доступ к камере и микрофону');
    }
}

// Отклонение звонка
function rejectCall() {
    socket.emit('reject-call', { to: 'all' });
    hideIncomingCallModal();
}

// Завершение звонка
function endCall() {
    if (!isInCall) return;
    
    // Закрытие потоков
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop());
        remoteStream = null;
    }
    
    // Закрытие peer connection
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    
    // Скрытие видео контейнера
    document.getElementById('video-container').classList.add('hidden');
    document.getElementById('call-btn').classList.remove('hidden');
    document.getElementById('end-call-btn').classList.add('hidden');
    
    socket.emit('end-call');
    isInCall = false;
}

// Закрытие видео
function closeVideo() {
    endCall();
}

// Обработка WebRTC offer
async function handleWebRTCOffer(offer, from) {
    if (isInCall) return;
    
    try {
        peerConnection = new RTCPeerConnection(rtcConfig);
        
        // Обработка удаленного потока
        peerConnection.ontrack = function(event) {
            remoteStream = event.streams[0];
            document.getElementById('remote-video').srcObject = remoteStream;
        };
        
        // Обработка ICE кандидатов
        peerConnection.onicecandidate = function(event) {
            if (event.candidate) {
                socket.emit('webrtc-ice-candidate', {
                    candidate: event.candidate,
                    to: from
                });
            }
        };
        
        await peerConnection.setRemoteDescription(offer);
        
        // Создание answer
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        socket.emit('webrtc-answer', { 
            answer,
            to: from
        });
        
    } catch (error) {
        console.error('Ошибка при обработке offer:', error);
    }
}

// Обработка WebRTC answer
async function handleWebRTCAnswer(answer, from) {
    if (!peerConnection) return;
    
    try {
        await peerConnection.setRemoteDescription(answer);
    } catch (error) {
        console.error('Ошибка при обработке answer:', error);
    }
}

// Обработка ICE кандидата
async function handleWebRTCIceCandidate(candidate, from) {
    if (!peerConnection) return;
    
    try {
        await peerConnection.addIceCandidate(candidate);
    } catch (error) {
        console.error('Ошибка при добавлении ICE кандидата:', error);
    }
}

// Показ модального окна входящего звонка
function showIncomingCallModal(callerUser) {
    document.getElementById('caller-name').textContent = callerUser.nickname;
    document.getElementById('incoming-call-modal').classList.remove('hidden');
}

// Скрытие модального окна входящего звонка
function hideIncomingCallModal() {
    document.getElementById('incoming-call-modal').classList.add('hidden');
}

// Переключение настроек
function toggleSettings() {
    const settingsPanel = document.getElementById('settings-panel');
    settingsPanel.classList.toggle('hidden');
}

// Обработка изменения темы
function handleThemeChange(e) {
    const theme = e.target.value;
    applyTheme(theme);
    saveSettings();
}

// Применение темы
function applyTheme(theme) {
    document.body.className = `theme-${theme}`;
    document.getElementById('theme-select').value = theme;
}

// Обработка изменения размера шрифта
function handleFontSizeChange(e) {
    const fontSize = e.target.value;
    document.body.className = document.body.className.replace(/font-\w+/g, '');
    document.body.classList.add(`font-${fontSize}`);
    saveSettings();
}

// Сохранение настроек
function saveSettings() {
    const theme = document.getElementById('theme-select').value;
    const fontSize = document.getElementById('font-size').value;
    
    const settings = {
        theme,
        fontSize
    };
    
    localStorage.setItem('messenger-settings', JSON.stringify(settings));
}

// Загрузка настроек
function loadSettings() {
    const savedSettings = localStorage.getItem('messenger-settings');
    
    if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        applyTheme(settings.theme || 'dark');
        document.getElementById('font-size').value = settings.fontSize || 'medium';
        document.body.classList.add(`font-${settings.fontSize || 'medium'}`);
    }
}

// Выход из чата
function logout() {
    if (isInCall) {
        endCall();
    }
    
    if (socket) {
        socket.disconnect();
    }
    
    currentUser = null;
    currentRoom = null;
    
    document.getElementById('chat-screen').classList.remove('active');
    document.getElementById('login-screen').classList.add('active');
    
    // Очистка формы
    document.getElementById('login-form').reset();
}

// Показ уведомлений
function showNotification(message) {
    // Простое уведомление через alert
    // В реальном приложении можно использовать toast уведомления
    console.log('Уведомление:', message);
}

// Обработка ошибок
window.addEventListener('error', function(e) {
    console.error('Ошибка:', e.error);
});

// Обработка закрытия страницы
window.addEventListener('beforeunload', function() {
    if (isInCall) {
        endCall();
    }
    if (socket) {
        socket.disconnect();
    }
});
