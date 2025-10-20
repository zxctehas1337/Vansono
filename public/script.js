    // Глобальные переменные
let socket;
let currentUser = null;
let currentRoom = null;
let localStream = null;
let remoteStream = null;
let peerConnection = null;
let isInCall = false;
let incomingCallData = null; // Новая переменная для хранения данных входящего звонка

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
        // Если уже в звонке, отклоняем
        if (isInCall) {
            socket.emit('reject-call', { to: data.from });
            return;
        }

        // Сохраняем данные входящего звонка
        incomingCallData = data;
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

// Функция генерации аватара
function generateAvatar(username, size = 100) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Генерация случайного цвета на основе username
    const hash = username.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
    const hue = hash % 360;
    const saturation = 50 + (hash % 20);
    const lightness = 50 + (hash % 20);

    // Заливка фона
    ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    ctx.fillRect(0, 0, size, size);

    // Текст аватара (первая буква)
    ctx.fillStyle = 'white';
    ctx.font = `${size * 0.6}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(username[0].toUpperCase(), size / 2, size / 2);

    return canvas.toDataURL();
}

// Обновление функции updateUsersList для добавления аватаров
function updateUsersList(users) {
    const usersList = document.getElementById('users-list');
    usersList.innerHTML = '';
    
    users.forEach(user => {
        const li = document.createElement('li');
        
        // Создаем элемент аватара
        const avatarImg = document.createElement('img');
        avatarImg.src = generateAvatar(user.nickname, 40);
        avatarImg.className = 'user-avatar';
        avatarImg.style.width = '40px';
        avatarImg.style.height = '40px';
        avatarImg.style.borderRadius = '50%';
        avatarImg.style.marginRight = '10px';

        li.appendChild(avatarImg);
        
        const nameSpan = document.createElement('span');
        nameSpan.textContent = `${user.nickname}`;
        li.appendChild(nameSpan);
        
        li.dataset.userId = user.userId;
        usersList.appendChild(li);
    });
}

// Обновление функции addUserToList для добавления аватаров
function addUserToList(userData) {
    const usersList = document.getElementById('users-list');
    const li = document.createElement('li');
    
    // Создаем элемент аватара
    const avatarImg = document.createElement('img');
    avatarImg.src = generateAvatar(userData.nickname, 40);
    avatarImg.className = 'user-avatar';
    avatarImg.style.width = '40px';
    avatarImg.style.height = '40px';
    avatarImg.style.borderRadius = '50%';
    avatarImg.style.marginRight = '10px';

    li.appendChild(avatarImg);
    
    const nameSpan = document.createElement('span');
    nameSpan.textContent = `${userData.nickname}`;
    li.appendChild(nameSpan);
    
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
    // Проверка наличия пользователей в комнате
    const usersList = document.getElementById('users-list');
    if (usersList.children.length <= 1) {
        showNotification('Нужно больше пользователей для звонка', 'warning');
        return;
    }

    if (isInCall) return;

    let localVideo, remoteVideo, videoContainer, callBtn, endCallBtn;

    try {
        // Кэшируем ссылки на элементы, чтобы не было ошибок если их нет
        localVideo = document.getElementById('local-video');
        remoteVideo = document.getElementById('remote-video');
        videoContainer = document.getElementById('video-container');
        callBtn = document.getElementById('call-btn');
        endCallBtn = document.getElementById('end-call-btn');

        // Проверка наличия всех нужных DOM-элементов
        if (!localVideo || !remoteVideo || !videoContainer || !callBtn || !endCallBtn) {
            throw new Error('Некоторые элементы интерфейса звонка не найдены');
        }

        // Проверка поддержки getUserMedia
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('getUserMedia не поддерживается');
        }

        console.log('Запрос доступа к медиа-устройствам...');

        // Проверяем доступные устройства
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

        localVideo.srcObject = localStream;

        // Создание peer connection
        peerConnection = new RTCPeerConnection(rtcConfig);

        // Добавление локального потока
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });

        // Обработка удаленного потока
        peerConnection.ontrack = function(event) {
            remoteStream = event.streams[0];
            remoteVideo.srcObject = remoteStream;
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

        // Показать видео контейнер, скрыть кнопку звонка и показать крестик завершения
        videoContainer.classList.remove('hidden');
        callBtn.classList.add('hidden');
        endCallBtn.classList.remove('hidden');

        // Обработчик завершения звонка по "крестику"
        endCallBtn.onclick = endCall;

        isInCall = true;

    } catch (error) {
        console.error('Ошибка при начале звонка:', error);
        console.error('Имя ошибки:', error.name);
        console.error('Сообщение:', error.message);

        // Если на старте не найден хотя бы один элемент управления звонком, показываем alert
        if (error.message && error.message.includes('элементы интерфейса звонка')) {
            alert('Ошибка интерфейса: ' + error.message);
            return;
        }

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
            alert('Ошибка конфигурации или интерфейса. Проверьте наличие необходимых элементов на странице и настройки медиа-устройств.');
        } else if (error.name === 'SecurityError') {
            alert('Доступ заблокирован по соображениям безопасности. Используйте HTTPS.');
        } else {
            alert('Не удалось получить доступ к камере и микрофону: ' + error.message);
        }

        // Если был начат звонок, но упали на показе интерфейса, делаем откат визуального состояния (грубый механизм)
        try {
            if (videoContainer && videoContainer.classList) videoContainer.classList.add('hidden');
            if (callBtn && callBtn.classList) callBtn.classList.remove('hidden');
            if (endCallBtn && endCallBtn.classList) endCallBtn.classList.add('hidden');
        } catch (_) { }
    }
}

// Реализация завершения звонка (крестик), чтобы он работал всегда
function endCall() {
    // Сброс соединения и потоков
    if (peerConnection) {
        peerConnection.ontrack = null;
        peerConnection.onicecandidate = null;
        peerConnection.close();
        peerConnection = null;
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    if (remoteStream) {
        remoteStream = null;
    }

    // Скрытие видеоблоков и возврат кнопок в исходное состояние
    const videoContainer = document.getElementById('video-container');
    const callBtn = document.getElementById('call-btn');
    const endCallBtn = document.getElementById('end-call-btn');
    const localVideo = document.getElementById('local-video');
    const remoteVideo = document.getElementById('remote-video');

    if (videoContainer && videoContainer.classList) videoContainer.classList.add('hidden');
    if (callBtn && callBtn.classList) callBtn.classList.remove('hidden');
    if (endCallBtn && endCallBtn.classList) endCallBtn.classList.add('hidden');
    if (localVideo) localVideo.srcObject = null;
    if (remoteVideo) remoteVideo.srcObject = null;

    isInCall = false;
    socket.emit('end-call');
}

// Принятие звонка
async function acceptCall() {
    if (isInCall || !incomingCallData) return;
    
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
        
        // Добавляем идентификатор удаленного пользователя
        peerConnection.remoteUserId = incomingCallData.from;

        // Сбрасываем данные входящего звонка
        incomingCallData = null;

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
    if (!incomingCallData) return;

    socket.emit('reject-call', { to: incomingCallData.from });
    incomingCallData = null;
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
    
    // Очистка видео элементов
    const localVideo = document.getElementById('local-video');
    const remoteVideo = document.getElementById('remote-video');
    const localAvatar = document.getElementById('local-avatar');
    const remoteAvatar = document.getElementById('remote-avatar');

    if (localVideo) localVideo.srcObject = null;
    if (remoteVideo) remoteVideo.srcObject = null;
    if (localAvatar) localAvatar.innerHTML = '';
    if (remoteAvatar) remoteAvatar.innerHTML = '';

    socket.emit('end-call');
    isInCall = false;
    incomingCallData = null;
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
    const incomingCallModal = document.getElementById('incoming-call-modal');
    const callerNameEl = document.getElementById('caller-name');
    const callerAvatarEl = document.getElementById('caller-avatar');
    const acceptCallBtn = document.getElementById('accept-call-btn');
    const declineCallBtn = document.getElementById('decline-call-btn');

    // Установка имени и аватара звонящего
    callerNameEl.textContent = callerUser.nickname;
    
    // Создание аватара звонящего
    const callerAvatar = document.createElement('img');
    callerAvatar.src = generateAvatar(callerUser.nickname, 150);
    callerAvatar.style.width = '150px';
    callerAvatar.style.height = '150px';
    callerAvatar.style.borderRadius = '50%';
    callerAvatarEl.innerHTML = '';
    callerAvatarEl.appendChild(callerAvatar);

    // Обработчики кнопок
    const handleAccept = () => {
        acceptCall();
        incomingCallModal.classList.add('hidden');
        acceptCallBtn.removeEventListener('click', handleAccept);
        declineCallBtn.removeEventListener('click', handleDecline);
    };

    const handleDecline = () => {
        rejectCall();
        incomingCallModal.classList.add('hidden');
        acceptCallBtn.removeEventListener('click', handleAccept);
        declineCallBtn.removeEventListener('click', handleDecline);
    };

    acceptCallBtn.addEventListener('click', handleAccept);
    declineCallBtn.addEventListener('click', handleDecline);

    incomingCallModal.classList.remove('hidden');
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
