// Global variables
let socket;
let currentRoomId;
let currentUsername;
let localStream;
let remoteStream;
let peerConnection;
let isInCall = false;
let isMuted = false;
let isVideoOff = false;
let incomingCallData = null;
let otherUsers = [];
let callTimeout = null;

// WebRTC configuration
const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

// DOM elements
const elements = {
  welcomeScreen: document.getElementById('welcome-screen'),
  chatInterface: document.getElementById('chat-interface'),
  callInterface: document.getElementById('call-interface'),
  incomingCallModal: document.getElementById('incoming-call-modal'),
  notification: document.getElementById('notification'),
  
  usernameInput: document.getElementById('username-input'),
  roomIdInput: document.getElementById('room-id-input'),
  joinRoomBtn: document.getElementById('join-room-btn'),
  shareLink: document.getElementById('share-link'),
  roomLink: document.getElementById('room-link'),
  copyLinkBtn: document.getElementById('copy-link-btn'),
  
  roomName: document.getElementById('room-name'),
  currentRoomId: document.getElementById('current-room-id'),
  shareRoomBtn: document.getElementById('share-room-btn'),
  leaveRoomBtn: document.getElementById('leave-room-btn'),
  
  usersList: document.getElementById('users-list'),
  messagesContainer: document.getElementById('messages-container'),
  messageInput: document.getElementById('message-input'),
  sendMessageBtn: document.getElementById('send-message-btn'),
  
  voiceCallBtn: document.getElementById('voice-call-btn'),
  videoCallBtn: document.getElementById('video-call-btn'),
  
  callStatus: document.getElementById('call-status'),
  callParticipant: document.getElementById('call-participant'),
  endCallBtn: document.getElementById('end-call-btn'),
  remoteVideo: document.getElementById('remote-video'),
  localVideo: document.getElementById('local-video'),
  muteBtn: document.getElementById('mute-btn'),
  videoBtn: document.getElementById('video-btn'),
  hangupBtn: document.getElementById('hangup-btn'),
  
  incomingCallerName: document.getElementById('incoming-caller-name'),
  incomingCallType: document.getElementById('incoming-call-type'),
  acceptCallBtn: document.getElementById('accept-call-btn'),
  rejectCallBtn: document.getElementById('reject-call-btn'),
  
  notificationText: document.getElementById('notification-text')
};

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  initializeSocket();
  setupEventListeners();
  generateRandomRoomId();
});

// Socket.IO initialization
function initializeSocket() {
  socket = io();
  
  socket.on('connect', () => {
    console.log('Connected to server');
    showNotification('Подключено к серверу', 'success');
  });
  
  socket.on('disconnect', () => {
    console.log('Disconnected from server');
    showNotification('Соединение потеряно', 'error');
  });
  
  socket.on('room-info', (data) => {
    otherUsers = data.users.filter(user => user.id !== socket.id);
    updateUsersList(data.users);
    displayMessages(data.messages);
    
    // If there's an active call, show call interface
    if (data.activeCall && data.activeCall.participants.includes(socket.id)) {
      showCallInterface(data.activeCall.callType);
    }
  });
  
  socket.on('user-joined', (data) => {
    showNotification(`${data.username} присоединился к комнате`, 'info');
    otherUsers = otherUsers.filter(user => user.id !== data.id);
    otherUsers.push(data);
    updateUsersList();
  });
  
  socket.on('user-left', (data) => {
    showNotification(`${data.username} покинул комнату`, 'info');
    otherUsers = otherUsers.filter(user => user.id !== data.id);
    updateUsersList();
  });
  
  socket.on('chat-message', (message) => {
    displayMessage(message);
  });
  
  // WebRTC signaling events
  socket.on('offer', handleOffer);
  socket.on('answer', handleAnswer);
  socket.on('ice-candidate', handleIceCandidate);
  
  // Call events
  socket.on('call-started', handleIncomingCall);
  socket.on('call-ended', handleCallEnded);
  socket.on('call-accepted', handleCallAccepted);
  socket.on('call-rejected', handleCallRejected);
  socket.on('call-error', (data) => {
    showNotification(data.message, 'error');
    if (isInCall) {
      endCall();
    }
  });
}

// Event listeners setup
function setupEventListeners() {
  // Welcome screen
  elements.joinRoomBtn.addEventListener('click', joinRoom);
  elements.copyLinkBtn.addEventListener('click', copyRoomLink);
  elements.usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') joinRoom();
  });
  elements.roomIdInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') joinRoom();
  });
  
  // Chat interface
  elements.shareRoomBtn.addEventListener('click', showShareLink);
  elements.leaveRoomBtn.addEventListener('click', leaveRoom);
  elements.sendMessageBtn.addEventListener('click', sendMessage);
  elements.messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
  
  // Call buttons
  elements.voiceCallBtn.addEventListener('click', () => startCall('audio'));
  elements.videoCallBtn.addEventListener('click', () => startCall('video'));
  
  // Call interface
  elements.endCallBtn.addEventListener('click', endCall);
  elements.muteBtn.addEventListener('click', toggleMute);
  elements.videoBtn.addEventListener('click', toggleVideo);
  elements.hangupBtn.addEventListener('click', endCall);
  
  // Incoming call modal
  elements.acceptCallBtn.addEventListener('click', acceptCall);
  elements.rejectCallBtn.addEventListener('click', rejectCall);
}

// Generate random room ID
function generateRandomRoomId() {
  const roomId = Math.random().toString(36).substring(2, 15);
  elements.roomIdInput.value = roomId;
}

// Join room functionality
async function joinRoom() {
  const username = elements.usernameInput.value.trim();
  const roomId = elements.roomIdInput.value.trim();
  
  if (!username) {
    showNotification('Введите ваше имя', 'error');
    return;
  }
  
  if (!roomId) {
    generateRandomRoomId();
    return;
  }
  
  currentUsername = username;
  currentRoomId = roomId;
  
  socket.emit('join-room', roomId, username);
  
  // Show chat interface
  elements.welcomeScreen.style.display = 'none';
  elements.chatInterface.style.display = 'flex';
  
  // Update room info
  elements.roomName.textContent = `Комната ${roomId}`;
  elements.currentRoomId.textContent = roomId;
  
  showNotification(`Присоединились к комнате ${roomId}`, 'success');
}

// Leave room functionality
function leaveRoom() {
  if (isInCall) {
    endCall();
  }
  
  socket.disconnect();
  socket.connect();
  
  elements.chatInterface.style.display = 'none';
  elements.welcomeScreen.style.display = 'flex';
  
  // Clear data
  currentRoomId = null;
  currentUsername = null;
  elements.messagesContainer.innerHTML = '';
  elements.usersList.innerHTML = '';
  
  showNotification('Покинули комнату', 'info');
}

// Share room link
function showShareLink() {
  const roomLink = `${window.location.origin}?room=${currentRoomId}`;
  elements.roomLink.value = roomLink;
  elements.shareLink.style.display = 'flex';
}

function copyRoomLink() {
  elements.roomLink.select();
  document.execCommand('copy');
  showNotification('Ссылка скопирована в буфер обмена', 'success');
}

// Chat functionality
function sendMessage() {
  const message = elements.messageInput.value.trim();
  if (!message) return;
  
  socket.emit('chat-message', { message });
  elements.messageInput.value = '';
}

function displayMessage(message) {
  const messageElement = document.createElement('div');
  messageElement.className = `message ${message.username === currentUsername ? 'own' : 'other'}`;
  
  const time = new Date(message.timestamp).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit'
  });
  
  messageElement.innerHTML = `
    <div class="message-header">
      <span class="username">${message.username}</span>
      <span class="timestamp">${time}</span>
    </div>
    <div class="message-content">${escapeHtml(message.message)}</div>
  `;
  
  elements.messagesContainer.appendChild(messageElement);
  elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
}

function displayMessages(messages) {
  elements.messagesContainer.innerHTML = '';
  messages.forEach(message => displayMessage(message));
}

function updateUsersList(users) {
  if (!users) {
    // Request updated users list
    socket.emit('get-room-info');
    return;
  }
  
  elements.usersList.innerHTML = '';
  users.forEach(user => {
    const userElement = document.createElement('div');
    userElement.className = `user-item ${user.isInCall ? 'in-call' : ''}`;
    userElement.innerHTML = `
      <div class="user-avatar">
        <i class="fas fa-user"></i>
      </div>
      <div class="user-info">
        <span class="user-name">${user.username}</span>
        <span class="user-status">${user.isInCall ? 'В звонке' : 'Онлайн'}</span>
      </div>
    `;
    elements.usersList.appendChild(userElement);
  });
}

// WebRTC functionality
async function startCall(callType) {
  try {
    // Check if there are other users in the room
    if (otherUsers.length === 0) {
      showNotification('В комнате нет других пользователей', 'error');
      return;
    }
    
    // Check if already in a call
    if (isInCall) {
      showNotification('Вы уже в звонке', 'error');
      return;
    }
    
    console.log('Starting call, setting isInCall to true');
    isInCall = true;
    
    // Get user media with improved constraints
    const constraints = {
      audio: true,
      video: callType === 'video' ? {
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
        frameRate: { ideal: 30, max: 60 }
      } : false
    };
    
    try {
      localStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('Media stream obtained:', localStream.getTracks().map(t => t.kind));
    } catch (error) {
      console.warn('Failed to get media with constraints, trying basic constraints:', error);
      // Fallback to basic constraints
      const basicConstraints = {
        audio: true,
        video: callType === 'video'
      };
      localStream = await navigator.mediaDevices.getUserMedia(basicConstraints);
      console.log('Media stream obtained with basic constraints:', localStream.getTracks().map(t => t.kind));
    }
    
    // Create peer connection
    peerConnection = new RTCPeerConnection(rtcConfig);
    
    // Add local stream tracks
    localStream.getTracks().forEach(track => {
      console.log('Adding track:', track.kind, track.enabled);
      peerConnection.addTrack(track, localStream);
    });
    
    // Handle remote stream
    peerConnection.ontrack = (event) => {
      console.log('Received remote track:', event.track.kind);
      remoteStream = event.streams[0];
      elements.remoteVideo.srcObject = remoteStream;
      
      // Ensure audio is not muted for remote stream
      if (event.track.kind === 'audio') {
        console.log('Audio track received and enabled');
      }
    };
    
    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && otherUsers.length > 0) {
        socket.emit('ice-candidate', {
          target: otherUsers[0].id,
          candidate: event.candidate
        });
      }
    };
    
    // Handle ICE connection state changes
    peerConnection.oniceconnectionstatechange = () => {
      if (peerConnection && peerConnection.iceConnectionState) {
        console.log('ICE connection state:', peerConnection.iceConnectionState);
        if (peerConnection.iceConnectionState === 'failed') {
          showNotification('Ошибка ICE соединения', 'error');
          endCall();
        }
      }
    };
    
    // Handle ICE gathering state changes
    peerConnection.onicegatheringstatechange = () => {
      if (peerConnection && peerConnection.iceGatheringState) {
        console.log('ICE gathering state:', peerConnection.iceGatheringState);
      }
    };
    
    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      if (peerConnection && peerConnection.connectionState) {
        console.log('Connection state:', peerConnection.connectionState);
        if (peerConnection.connectionState === 'connected') {
          elements.callStatus.textContent = 'Подключено';
          showNotification('Соединение установлено', 'success');
        } else if (peerConnection.connectionState === 'failed') {
          showNotification('Ошибка соединения', 'error');
          endCall();
        }
      }
    };
    
    // Show call interface
    showCallInterface(callType);
    
    // Notify server about call start
    socket.emit('start-call', { callType });
    
    // Create and send offer
    try {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      
      socket.emit('offer', {
        target: otherUsers[0].id,
        offer: offer
      });
    } catch (error) {
      console.error('Error creating offer:', error);
      showNotification('Ошибка при создании предложения звонка', 'error');
    }
    
    // Set timeout for call
    callTimeout = setTimeout(() => {
      if (isInCall && peerConnection && peerConnection.connectionState !== 'connected') {
        showNotification('Не удалось установить соединение', 'error');
        endCall();
      }
    }, 30000); // 30 seconds timeout
    
  } catch (error) {
    console.error('Error starting call:', error);
    showNotification('Ошибка при запуске звонка: ' + error.message, 'error');
  }
}

function handleIncomingCall(data) {
  console.log('Incoming call received, current isInCall state:', isInCall);
  
  // If already in call, reject automatically
  if (isInCall) {
    console.log('Already in call, rejecting incoming call');
    socket.emit('call-rejected', { target: data.caller });
    return;
  }
  
  incomingCallData = data;
  elements.incomingCallerName.textContent = data.callerName;
  elements.incomingCallType.textContent = data.callType === 'video' ? 'Видеозвонок' : 'Голосовой звонок';
  elements.incomingCallModal.style.display = 'flex';
}

async function acceptCall() {
  try {
    const callType = incomingCallData.callType;
    
    // Check if already in a call
    if (isInCall) {
      showNotification('Вы уже в звонке', 'error');
      elements.incomingCallModal.style.display = 'none';
      incomingCallData = null;
      return;
    }
    
    console.log('Accepting call, setting isInCall to true');
    isInCall = true;
    
    // Get user media with improved constraints
    const constraints = {
      audio: true,
      video: callType === 'video' ? {
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
        frameRate: { ideal: 30, max: 60 }
      } : false
    };
    
    try {
      localStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('Media stream obtained:', localStream.getTracks().map(t => t.kind));
    } catch (error) {
      console.warn('Failed to get media with constraints, trying basic constraints:', error);
      // Fallback to basic constraints
      const basicConstraints = {
        audio: true,
        video: callType === 'video'
      };
      localStream = await navigator.mediaDevices.getUserMedia(basicConstraints);
      console.log('Media stream obtained with basic constraints:', localStream.getTracks().map(t => t.kind));
    }
    
    // Create peer connection
    peerConnection = new RTCPeerConnection(rtcConfig);
    
    // Add local stream tracks
    localStream.getTracks().forEach(track => {
      console.log('Adding track:', track.kind, track.enabled);
      peerConnection.addTrack(track, localStream);
    });
    
    // Handle remote stream
    peerConnection.ontrack = (event) => {
      console.log('Received remote track:', event.track.kind);
      remoteStream = event.streams[0];
      elements.remoteVideo.srcObject = remoteStream;
      
      // Ensure audio is not muted for remote stream
      if (event.track.kind === 'audio') {
        console.log('Audio track received and enabled');
      }
    };
    
    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', {
          target: incomingCallData.caller,
          candidate: event.candidate
        });
      }
    };
    
    // Handle ICE connection state changes
    peerConnection.oniceconnectionstatechange = () => {
      if (peerConnection && peerConnection.iceConnectionState) {
        console.log('ICE connection state:', peerConnection.iceConnectionState);
        if (peerConnection.iceConnectionState === 'failed') {
          showNotification('Ошибка ICE соединения', 'error');
          endCall();
        }
      }
    };
    
    // Handle ICE gathering state changes
    peerConnection.onicegatheringstatechange = () => {
      if (peerConnection && peerConnection.iceGatheringState) {
        console.log('ICE gathering state:', peerConnection.iceGatheringState);
      }
    };
    
    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      if (peerConnection && peerConnection.connectionState) {
        console.log('Connection state:', peerConnection.connectionState);
        if (peerConnection.connectionState === 'connected') {
          elements.callStatus.textContent = 'Подключено';
          showNotification('Соединение установлено', 'success');
        } else if (peerConnection.connectionState === 'failed') {
          showNotification('Ошибка соединения', 'error');
          endCall();
        }
      }
    };
    
    // Accept call
    socket.emit('call-accepted', { target: incomingCallData.caller });
    
    // Show call interface
    showCallInterface(callType);
    
    // Hide incoming call modal
    elements.incomingCallModal.style.display = 'none';
    
    // Wait for offer from caller
    console.log('Waiting for offer from caller...');
    
  } catch (error) {
    console.error('Error accepting call:', error);
    showNotification('Ошибка при принятии звонка: ' + error.message, 'error');
  }
}

function rejectCall() {
  socket.emit('call-rejected', { target: incomingCallData.caller });
  elements.incomingCallModal.style.display = 'none';
  incomingCallData = null;
}

async function handleOffer(data) {
  try {
    // Only handle offer if we're not already in a call
    if (isInCall) {
      console.log('Already in call, ignoring offer');
      return;
    }
    
    // Get user media for answering
    const constraints = {
      audio: true,
      video: data.offer.sdp.includes('m=video') ? {
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
        frameRate: { ideal: 30, max: 60 }
      } : false
    };
    
    try {
      localStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      console.warn('Failed to get media with constraints, trying basic constraints:', error);
      const basicConstraints = {
        audio: true,
        video: data.offer.sdp.includes('m=video')
      };
      localStream = await navigator.mediaDevices.getUserMedia(basicConstraints);
    }
    
    // Create peer connection
    peerConnection = new RTCPeerConnection(rtcConfig);
    
    // Add local stream tracks
    localStream.getTracks().forEach(track => {
      console.log('Adding track:', track.kind, track.enabled);
      peerConnection.addTrack(track, localStream);
    });
    
    // Handle remote stream
    peerConnection.ontrack = (event) => {
      console.log('Received remote track:', event.track.kind);
      remoteStream = event.streams[0];
      elements.remoteVideo.srcObject = remoteStream;
      
      // Ensure audio is not muted for remote stream
      if (event.track.kind === 'audio') {
        console.log('Audio track received and enabled');
      }
    };
    
    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', {
          target: data.sender,
          candidate: event.candidate
        });
      }
    };
    
    // Handle ICE connection state changes
    peerConnection.oniceconnectionstatechange = () => {
      if (peerConnection && peerConnection.iceConnectionState) {
        console.log('ICE connection state:', peerConnection.iceConnectionState);
        if (peerConnection.iceConnectionState === 'failed') {
          showNotification('Ошибка ICE соединения', 'error');
          endCall();
        }
      }
    };
    
    // Handle ICE gathering state changes
    peerConnection.onicegatheringstatechange = () => {
      if (peerConnection && peerConnection.iceGatheringState) {
        console.log('ICE gathering state:', peerConnection.iceGatheringState);
      }
    };
    
    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      if (peerConnection && peerConnection.connectionState) {
        console.log('Connection state:', peerConnection.connectionState);
        if (peerConnection.connectionState === 'connected') {
          elements.callStatus.textContent = 'Подключено';
          showNotification('Соединение установлено', 'success');
        } else if (peerConnection.connectionState === 'failed') {
          showNotification('Ошибка соединения', 'error');
          endCall();
        }
      }
    };
    
    // Set remote description
    await peerConnection.setRemoteDescription(data.offer);
    
    // Show call interface
    const callType = data.offer.sdp.includes('m=video') ? 'video' : 'audio';
    console.log('Detected call type from offer:', callType);
    showCallInterface(callType);
    
    // Create answer
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    
    // Send answer
    socket.emit('answer', {
      target: data.sender,
      answer: answer
    });
    
  } catch (error) {
    console.error('Error handling offer:', error);
    showNotification('Ошибка при обработке предложения звонка', 'error');
  }
}

async function handleAnswer(data) {
  try {
    if (peerConnection && peerConnection.signalingState !== 'closed') {
      await peerConnection.setRemoteDescription(data.answer);
      console.log('Answer set successfully');
    } else {
      console.warn('Cannot set answer: peerConnection is null or closed');
    }
  } catch (error) {
    console.error('Error handling answer:', error);
    showNotification('Ошибка при обработке ответа звонка', 'error');
  }
}

async function handleIceCandidate(data) {
  try {
    if (peerConnection && peerConnection.signalingState !== 'closed') {
      await peerConnection.addIceCandidate(data.candidate);
      console.log('ICE candidate added successfully');
    } else {
      console.warn('Cannot add ICE candidate: peerConnection is null or closed');
    }
  } catch (error) {
    console.error('Error handling ICE candidate:', error);
    // Don't show error notification for ICE candidate errors as they're often not critical
  }
}

function handleCallAccepted(data) {
  if (isInCall) {
    elements.callStatus.textContent = 'Подключено';
    elements.callParticipant.textContent = data.acceptorName || 'Участник';
    showNotification('Звонок принят', 'success');
  }
}

function handleCallRejected(data) {
  if (isInCall) {
    endCall();
    showNotification('Звонок отклонен', 'info');
  }
}

function handleCallEnded(data) {
  if (isInCall) {
    endCall();
    const reason = data.reason === 'user-disconnected' ? 'Участник покинул звонок' : 'Звонок завершен';
    showNotification(reason, 'info');
  }
}

function showCallInterface(callType) {
  // Don't set isInCall here as it should already be set by caller
  elements.chatInterface.style.display = 'none';
  elements.callInterface.style.display = 'flex';
  
  // Set up local video
  if (localStream) {
    elements.localVideo.srcObject = localStream;
    console.log('Local video set up with stream');
  } else {
    console.warn('No local stream available for video setup');
  }
  
  // Update call status
  elements.callStatus.textContent = callType === 'video' ? 'Видеозвонок' : 'Голосовой звонок';
  elements.callParticipant.textContent = 'Подключение...';
  
  // Show/hide video elements based on call type
  if (callType === 'video') {
    elements.remoteVideo.style.display = 'block';
    elements.localVideo.style.display = 'block';
    console.log('Video call interface shown');
  } else {
    elements.remoteVideo.style.display = 'none';
    elements.localVideo.style.display = 'none';
    console.log('Audio call interface shown');
  }
}

function endCall() {
  console.log('Ending call, current isInCall state:', isInCall);
  
  // Always reset state, even if not in call
  isInCall = false;
  
  // Clear timeout
  if (callTimeout) {
    clearTimeout(callTimeout);
    callTimeout = null;
  }
  
  // Close peer connection
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  
  // Stop local stream
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  
  // Clear video elements
  elements.remoteVideo.srcObject = null;
  elements.localVideo.srcObject = null;
  
  // Hide call interface
  elements.callInterface.style.display = 'none';
  elements.chatInterface.style.display = 'flex';
  
  // Hide incoming call modal if open
  elements.incomingCallModal.style.display = 'none';
  incomingCallData = null;
  
  // Reset call controls
  isMuted = false;
  isVideoOff = false;
  
  // Notify server
  socket.emit('end-call');
  
  console.log('Call ended, isInCall reset to:', isInCall);
}

function toggleMute() {
  if (localStream) {
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      isMuted = !audioTrack.enabled;
      
      const icon = elements.muteBtn.querySelector('i');
      icon.className = isMuted ? 'fas fa-microphone-slash' : 'fas fa-microphone';
      
      elements.muteBtn.classList.toggle('active', isMuted);
    }
  }
}

function toggleVideo() {
  if (localStream) {
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      isVideoOff = !videoTrack.enabled;
      
      const icon = elements.videoBtn.querySelector('i');
      icon.className = isVideoOff ? 'fas fa-video-slash' : 'fas fa-video';
      
      elements.videoBtn.classList.toggle('active', isVideoOff);
    }
  }
}


// Utility functions
function showNotification(message, type = 'info') {
  elements.notificationText.textContent = message;
  elements.notification.className = `notification ${type}`;
  elements.notification.style.display = 'flex';
  
  setTimeout(() => {
    elements.notification.style.display = 'none';
  }, 3000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Handle URL parameters
window.addEventListener('load', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const roomParam = urlParams.get('room');
  if (roomParam) {
    elements.roomIdInput.value = roomParam;
  }
});
document.getElementById('share-room-btn').addEventListener('click', () => {
  const roomUrl = encodeURIComponent(window.location.href);
  const message = encodeURIComponent("Присоединяйся ко мне в комнате: " + window.location.href);

  document.getElementById('share-telegram').href = `https://t.me/share/url?url=${roomUrl}&text=${message}`;
  document.getElementById('share-whatsapp').href = `https://wa.me/?text=${message}`;
  document.getElementById('share-viber').href = `viber://forward?text=${message}`;

  document.getElementById('share-options').style.display = 'block';
});
