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
    setupEventListeners(); // Сначала навесим все слушатели, чтобы элементы были доступны
    initializeApp();
});

// Инициализация приложения
function initializeApp() {
    // Подключение к Socket.io серверу
    socket = io();
    
    // Настройка обработчиков событий Socket.io
    setupSocketListeners();
    
    // Установка темы по умолчанию (без использования #theme-select, если его нет)
    applyTheme('nordwind');
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Форма входа
    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    
    // Автоматическое добавление @ к username
    const usernameInput = document.getElementById('username');
    if (usernameInput) {
        usernameInput.addEventListener('input', function(e) {
            let value = e.target.value;
            // Удаляем все символы кроме букв, цифр и @
            value = value.replace(/[^a-zA-Z0-9@]/g, '');
            // Если не начинается с @, добавляем его
            if (!value.startsWith('@')) {
                value = '@' + value.replace(/@/g, '');
            } else {
                // Удаляем все @ кроме первого
                value = '@' + value.slice(1).replace(/@/g, '');
            }
            // Ограничиваем длину (@ + 12 символов)
            if (value.length > 13) {
                value = value.slice(0, 13);
            }
            e.target.value = value;
        });
        
        // Устанавливаем @ при фокусе, если поле пустое
        usernameInput.addEventListener('focus', function(e) {
            if (!e.target.value) {
                e.target.value = '@';
            }
        });
    }
    
    // Валидация никнейма (только английские буквы и цифры)
    const nicknameInput = document.getElementById('nickname');
    if (nicknameInput) {
        nicknameInput.addEventListener('input', function(e) {
            let value = e.target.value;
            // Удаляем все символы кроме английских букв и цифр
            value = value.replace(/[^a-zA-Z0-9]/g, '');
            // Ограничиваем длину до 12 символов
            if (value.length > 12) {
                value = value.slice(0, 12);
            }
            e.target.value = value;
        });
    }

    // Форма отправки сообщений
    const messageForm = document.getElementById('message-form');
    if (messageForm) messageForm.addEventListener('submit', handleSendMessage);

    
    // Кнопки звонков
    const callBtn = document.getElementById('call-btn');
    if (callBtn) callBtn.addEventListener('click', startCall);
    const endCallBtn = document.getElementById('end-call-btn');
    if (endCallBtn) endCallBtn.addEventListener('click', endCall);
    const acceptCallBtn = document.getElementById('accept-call-btn');
    if (acceptCallBtn) acceptCallBtn.addEventListener('click', acceptCall);
    const rejectCallBtn = document.getElementById('reject-call-btn');
    if (rejectCallBtn) rejectCallBtn.addEventListener('click', rejectCall);

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);

    // Видео
    const closeVideoBtn = document.getElementById('close-video-btn');
    if (closeVideoBtn) closeVideoBtn.addEventListener('click', closeVideo);

    // Кнопка Share
    const shareBtn = document.getElementById('share-btn');
    if (shareBtn) shareBtn.addEventListener('click', shareRoom);

    // Закрытие модального окна при клике вне его
    const incomingCallModal = document.getElementById('incoming-call-modal');
    if (incomingCallModal) {
        incomingCallModal.addEventListener('click', function(e) {
            if (e.target === this) {
                hideIncomingCallModal();
            }
        });
    }
}

// Настройка обработчиков Socket.io
function setupSocketListeners() {
    // Подключение к серверу
    socket.on('connect', function() {
    });
    
    // История комнаты
    socket.on('room-history', function(data) {
        currentRoom = data.roomId;
        const currentRoomIdEl = document.getElementById('current-room-id');
        if (currentRoomIdEl) currentRoomIdEl.textContent = data.roomId;

        // ID user-count может отсутствовать на странице, поэтому делаем безопасную замену
        const userCountEl = document.getElementById('user-count');
        if (userCountEl) userCountEl.textContent = data.users.length;
        
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
        showNotification(`${data.nickname} присоединился к чату`, 'success');
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
        showNotification('Звонок отклонен', 'warning');
    });
    
    socket.on('call-ended', function() {
        endCall();
        showNotification('Звонок завершен', 'info');
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
    
    // Валидация nickname (только английские буквы и цифры, макс 12 символов)
    const nicknameRegex = /^[a-zA-Z0-9]{1,12}$/;
    if (!nicknameRegex.test(nickname)) {
        alert('Никнейм должен содержать только английские буквы и цифры (максимум 12 символов)');
        return;
    }
    
    // Валидация username (начинается с @, английские буквы и цифры, макс 12 символов после @)
    const usernameRegex = /^@[a-zA-Z0-9]{1,12}$/;
    if (!usernameRegex.test(username)) {
        alert('Юзернейм должен начинаться с @ и содержать только английские буквы и цифры (максимум 12 символов после @)');
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
    
    showNotification('Добро пожаловать в чат!', 'success');
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
    
    // Добавляем класс для анимации
    messageElement.style.opacity = '0';
    messageElement.style.transform = isOwnMessage ? 'translateX(20px)' : 'translateX(-20px)';
    
    const timestamp = new Date(message.timestamp).toLocaleTimeString();
    
    messageElement.innerHTML = `
        <div class="message-header">${message.nickname}</div>
        <div class="message-text">${escapeHtml(message.text)}</div>
        <div class="message-time">${timestamp}</div>
    `;
    
    messagesList.appendChild(messageElement);
    
    // Запускаем анимацию после добавления в DOM
    requestAnimationFrame(() => {
        messageElement.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
        messageElement.style.opacity = '1';
        messageElement.style.transform = 'translateX(0)';
    });
    
    // Плавная прокрутка к новому сообщению
    setTimeout(() => {
        messagesList.scrollTo({
            top: messagesList.scrollHeight,
            behavior: 'smooth'
        });
    }, 100);
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
        // Проверка поддержки getUserMedia
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('getUserMedia не поддерживается');
        }

        console.log('Запрос доступа к медиа-устройствам...');
        
        // Сначала проверяем доступные устройства
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasVideo = devices.some(device => device.kind === 'videoinput');
        const hasAudio = devices.some(device => device.kind === 'audioinput');
        
        console.log('Найдено устройств:', { hasVideo, hasAudio });
        
        if (!hasVideo && !hasAudio) {
            throw new Error('Не найдено ни одного медиа-устройства');
        }

        // Запрос разрешений с более гибкими настройками
        const constraints = {
            video: hasVideo ? {
                width: { ideal: 1280, min: 640 },
                height: { ideal: 720, min: 480 },
                facingMode: 'user'
            } : false,
            audio: hasAudio ? {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            } : false
        };
        
        // Если нет ни видео, ни аудио, показываем ошибку
        if (!constraints.video && !constraints.audio) {
            throw new Error('Необходима камера или микрофон для звонка');
        }

        console.log('Запрос с настройками:', constraints);
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('Медиа-поток получен успешно');
        
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
        console.error('Имя ошибки:', error.name);
        console.error('Сообщение:', error.message);
        
        // Более подробная обработка ошибок
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            alert('Пожалуйста, разрешите доступ к камере и микрофону в настройках браузера');
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
            alert('Камера или микрофон не найдены. Проверьте подключение устройств.');
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
            alert('Не удалось получить доступ к камере/микрофону. Возможно, они используются другим приложением.');
        } else if (error.name === 'OverconstrainedError' || error.name === 'ConstraintNotSatisfiedError') {
            alert('Текущие настройки камеры не поддерживаются. Попробуйте другое устройство.');
        } else if (error.name === 'TypeError') {
            alert('Ошибка конфигурации. Проверьте настройки медиа-устройств.');
        } else if (error.name === 'SecurityError') {
            alert('Доступ заблокирован по соображениям безопасности. Используйте HTTPS.');
        } else {
            alert('Не удалось получить доступ к камере и микрофону: ' + error.message);
        }
    }
}

// Принятие звонка
async function acceptCall() {
    if (isInCall) return;
    
    try {
        console.log('Принятие звонка...');
        
        // Проверяем доступные устройства
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasVideo = devices.some(device => device.kind === 'videoinput');
        const hasAudio = devices.some(device => device.kind === 'audioinput');
        
        const constraints = {
            video: hasVideo ? {
                width: { ideal: 1280, min: 640 },
                height: { ideal: 720, min: 480 }
            } : false,
            audio: hasAudio ? {
                echoCancellation: true,
                noiseSuppression: true
            } : false
        };
        
        if (!constraints.video && !constraints.audio) {
            throw new Error('Необходима камера или микрофон для звонка');
        }
        
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('Медиа-поток получен при принятии звонка');
        
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
        console.error('Имя ошибки:', error.name);
        
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            alert('Пожалуйста, разрешите доступ к камере и микрофону в настройках браузера');
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
            alert('Камера или микрофон не найдены. Проверьте подключение устройств.');
        } else if (error.name === 'NotReadableError') {
            alert('Не удалось получить доступ к камере/микрофону. Возможно, они используются другим приложением.');
        } else {
            alert('Не удалось получить доступ к камере и микрофону: ' + error.message);
        }
        
        hideIncomingCallModal();
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


// Применение темы
function applyTheme(theme) {
    document.body.className = `theme-${theme}`;
    const themeSelector = document.getElementById('theme-selector')
    if (!themeSelector) {
        console.error('Theme selector not found');
        return;
    }
    themeSelector.value = theme;
}



// Загрузка настроек

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
function showNotification(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        console.log('Уведомление:', message);
        return;
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Иконка в зависимости от типа
    let icon = 'ℹ️'; // info
    if (type === 'success') icon = '✅';
    else if (type === 'error') icon = '❌';
    else if (type === 'warning') icon = '⚠️';
    
    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <span class="toast-message">${escapeHtml(message)}</span>
    `;
    
    toastContainer.appendChild(toast);
    
    // Автоматическое удаление через 3 секунды
    setTimeout(() => {
        toast.remove();
    }, 3000);
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

// Функция для обмена комнатой
function shareRoom() {
    const currentRoomId = document.getElementById('current-room-id').textContent;
    
    // Проверка поддержки Web Share API
    if (navigator.share) {
        navigator.share({
            title: 'Присоединяйся к чату',
            text: 'Присоединись к моей комнате в Kik Messenger',
            url: `${window.location.origin}?room=${currentRoomId}`
        }).catch(console.error);
    } else {
        // Резервный метод копирования ссылки
        const shareUrl = `${window.location.origin}?room=${currentRoomId}`;
        navigator.clipboard.writeText(shareUrl).then(() => {
            showNotification('Ссылка на комнату скопирована', 'success');
        }).catch(err => {
            console.error('Не удалось скопировать ссылку:', err);
            showNotification('Не удалось скопировать ссылку', 'error');
        });
    }
}

// Обновление присутствия пользователей
function updateUserPresence() {
    if (socket && currentRoom) {
        socket.emit('update-presence', {
            roomId: currentRoom,
            lastActive: new Date().toISOString()
        });
    }
}

// Периодическое обновление присутствия каждые 30 секунд
setInterval(updateUserPresence, 30000);
