// ===== CALL MODULE =====
// Управление голосовыми и видеозвонками

// Call buttons
const endCallBtn = document.getElementById('end-call-btn');
const muteBtn = document.getElementById('mute-btn');
const cameraBtn = document.getElementById('camera-btn');

// Call elements
const callUserName = document.getElementById('call-user-name');
const callAvatar = document.getElementById('call-avatar');
const callStatus = document.getElementById('call-status');
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');

// Call control elements
const incomingCallControls = document.getElementById('incoming-call-controls');
const activeCallControls = document.getElementById('active-call-controls');
const acceptCallBtn = document.getElementById('accept-call-btn');
const declineCallBtn = document.getElementById('decline-call-btn');

// Call state
let isMuted = false;
let isCameraOn = true;


// ===== CALL INITIATION =====

async function initiateCall(video) {
  try {
    
    // Check if SimplePeer is available
    if (typeof SimplePeer === 'undefined') {
      window.Core.showNotification('Call functionality not available', 'error');
      return;
    }

    // Check if user is already in a call
    if (window.Core.peer || window.Core.localStream) {
      window.Core.showNotification('You are already in a call', 'error');
      return;
    }

    window.Core.localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: video || false
    });

    localVideo.srcObject = window.Core.localStream;
    
    // Show/hide video based on call type
    if (video) {
      localVideo.style.display = 'block';
      remoteVideo.style.display = 'block';
    } else {
      localVideo.style.display = 'none';
      remoteVideo.style.display = 'none';
    }

    window.Core.peer = new SimplePeer({
      initiator: true,
      stream: window.Core.localStream,
      trickle: false
    });

    window.Core.peer.on('signal', (signal) => {
      window.Core.socket.emit('call:initiate', {
        to: window.Core.currentChatUser.id,
        signal,
        callType: video ? 'video' : 'voice'
      });
    });

    window.Core.peer.on('stream', (remoteStream) => {
      remoteVideo.srcObject = remoteStream;
      startAudioVisualization(remoteStream, null);
    });

    window.Core.peer.on('error', (err) => {
      console.error('Peer connection error:', err);
      window.Core.showNotification('Call connection error', 'error');
      endCall();
    });

    showCallScreen(window.Core.currentChatUser.name, 'Calling...', false);
    startAudioVisualization(window.Core.localStream, null);
    
    // Track call start time
    window.Core.callStartTime = Date.now();
    
    window.Core.showNotification(`Initiating ${video ? 'video' : 'voice'} call...`, 'info');
  } catch (error) {
    console.error('Error initiating call:', error);
    window.Core.showNotification('Unable to access camera/microphone', 'error');
    endCall();
  }
}

// ===== INCOMING CALL HANDLING =====

window.Core.socket.on('call:incoming', (data) => {
  // Play ringtone for incoming call
  playNotificationSound('rington');
  
  showIncomingCall(data.caller.name, data.callType);
  window.Core.currentCallData = data;
  
});

function showIncomingCall(callerName, callType) {
  document.getElementById('chat-screen').classList.remove('active');
  document.getElementById('call-screen').classList.add('active');
  
  callUserName.textContent = callerName;
  callAvatar.textContent = callerName.charAt(0).toUpperCase();
  callStatus.textContent = `Incoming ${callType} call...`;
  
  // Show incoming call controls
  incomingCallControls.style.display = 'flex';
  activeCallControls.style.display = 'none';
  
  // Add ringing animation
  document.querySelector('.call-info').classList.add('ringing');
}

// Accept call
acceptCallBtn.addEventListener('click', async () => {
  if (!window.Core.currentCallData) return;
  
  try {
    // Check if SimplePeer is available
    if (typeof SimplePeer === 'undefined') {
      window.Core.showNotification('Call functionality not available', 'error');
      return;
    }

    // Check if user is already in a call
    if (window.Core.peer || window.Core.localStream) {
      window.Core.showNotification('You are already in a call', 'error');
      return;
    }

    const isVideoCall = window.Core.currentCallData.callType === 'video';
    
    window.Core.localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: isVideoCall
    });

    localVideo.srcObject = window.Core.localStream;
    
    // Show/hide video based on call type
    if (isVideoCall) {
      localVideo.style.display = 'block';
      remoteVideo.style.display = 'block';
    } else {
      localVideo.style.display = 'none';
      remoteVideo.style.display = 'none';
    }

    window.Core.peer = new SimplePeer({
      initiator: false,
      stream: window.Core.localStream,
      trickle: false
    });

    window.Core.peer.on('signal', (answerSignal) => {
      window.Core.socket.emit('call:accept', {
        to: window.Core.currentCallData.from,
        signal: answerSignal
      });
    });

    window.Core.peer.on('stream', (remoteStream) => {
      remoteVideo.srcObject = remoteStream;
      startAudioVisualization(remoteStream, null);
    });

    window.Core.peer.on('error', (err) => {
      console.error('Peer connection error:', err);
      window.Core.showNotification('Call connection error', 'error');
      endCall();
    });

    window.Core.peer.signal(window.Core.currentCallData.signal);
    
    // Switch to active call controls
    incomingCallControls.style.display = 'none';
    activeCallControls.style.display = 'flex';
    document.querySelector('.call-info').classList.remove('ringing');
    
    callStatus.textContent = 'Connected';
    startAudioVisualization(window.Core.localStream, null);
    
    // Track call start time for accepted calls
    window.Core.callStartTime = Date.now();
    
    window.Core.showNotification(`Accepted ${isVideoCall ? 'video' : 'voice'} call`, 'success');
  } catch (error) {
    console.error('Error accepting call:', error);
    window.Core.showNotification('Error answering call', 'error');
    endCall();
  }
});

// Decline call
declineCallBtn.addEventListener('click', () => {
  if (window.Core.currentCallData) {
    window.Core.socket.emit('call:decline', { to: window.Core.currentCallData.from });
    
  }
  endCall();
});

// ===== CALL EVENTS =====

// Call accepted
window.Core.socket.on('call:accepted', (data) => {
  window.Core.peer.signal(data.signal);
  callStatus.textContent = 'Connected';
});

// Call declined
window.Core.socket.on('call:declined', () => {
  callStatus.textContent = 'Call declined';
  
  
  setTimeout(() => endCall(), 2000);
});

// Call answered
window.Core.socket.on('call:answered', (data) => {
  window.Core.peer.signal(data.signal);
  callStatus.textContent = 'Connected';
});

// End call
endCallBtn.addEventListener('click', () => {
  endCall();
  if (window.Core.currentChatUser) {
    window.Core.socket.emit('call:end', { to: window.Core.currentChatUser.id });
  }
});

window.Core.socket.on('call:ended', () => {
  endCall();
});

function endCall() {
  
  if (window.Core.peer) {
    window.Core.peer.destroy();
    window.Core.peer = null;
  }

  if (window.Core.localStream) {
    window.Core.localStream.getTracks().forEach(track => track.stop());
    window.Core.localStream = null;
  }

  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
  
  // Stop audio visualization
  stopAudioVisualization();

  // Reset UI
  incomingCallControls.style.display = 'none';
  activeCallControls.style.display = 'flex';
  document.querySelector('.call-info').classList.remove('ringing');
  
  // Reset call tracking variables
  window.Core.currentCallData = null;
  window.Core.callStartTime = null;
  window.Core.callEndTime = null;
  window.Core.callDuration = null;

  document.getElementById('call-screen').classList.remove('active');
  document.getElementById('chat-screen').classList.add('active');
}

// ===== CALL CONTROLS =====

// Mute/unmute
muteBtn.addEventListener('click', () => {
  if (window.Core.localStream) {
    isMuted = !isMuted;
    window.Core.localStream.getAudioTracks()[0].enabled = !isMuted;
    muteBtn.style.opacity = isMuted ? '0.5' : '1';
  }
});

// Camera on/off
cameraBtn.addEventListener('click', () => {
  if (window.Core.localStream) {
    isCameraOn = !isCameraOn;
    const videoTrack = window.Core.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = isCameraOn;
      cameraBtn.style.opacity = isCameraOn ? '1' : '0.5';
      
      // Only show/hide local video if it's a video call
      const isVideoCall = window.Core.currentCallData && window.Core.currentCallData.callType === 'video';
      if (isVideoCall) {
        localVideo.style.display = isCameraOn ? 'block' : 'none';
      }
      
      // Update camera button icon based on state
      const cameraIcon = cameraBtn.querySelector('svg path');
      if (cameraIcon && !isCameraOn) {
        // Add visual indication that camera is off
        cameraBtn.classList.add('camera-off');
      } else {
        cameraBtn.classList.remove('camera-off');
      }
      
      window.Core.showNotification(`Camera ${isCameraOn ? 'enabled' : 'disabled'}`, 'info');
    }
  }
});

function showCallScreen(name, status, showControls = true) {
  document.getElementById('chat-screen').classList.remove('active');
  document.getElementById('call-screen').classList.add('active');
  
  callUserName.textContent = name;
  callAvatar.textContent = name.charAt(0).toUpperCase();
  callStatus.textContent = status;
  
  if (showControls) {
    incomingCallControls.style.display = 'none';
    activeCallControls.style.display = 'flex';
  }
}

// ===== AUDIO VISUALIZATION =====

// Audio visualization - DISABLED (pulsating circles removed)
let audioContext = null;
let localAnalyser = null;
let remoteAnalyser = null;
let animationId = null;

function startAudioVisualization(stream, circleElement) {
  // Audio visualization disabled - no pulsating circles
  return;
}

function stopAudioVisualization() {
  // Audio visualization disabled - no pulsating circles
  return;
}

function animateAudioVisualization() {
  // Audio visualization disabled - no pulsating circles
  return;
}

// ===== AUDIO NOTIFICATIONS =====

// Play notification sound
function playNotificationSound(type) {
  try {
    const audio = new Audio(`src/${type}.mp3`);
    audio.volume = 0.5;
    audio.play().catch(error => {
    });
  } catch (error) {
  }
}

// ===== INITIALIZATION =====

function initializeCall() {
}

// Export functions for other modules
window.Call = {
  initiateCall,
  showIncomingCall,
  endCall,
  showCallScreen,
  playNotificationSound,
  initializeCall
};

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', initializeCall);
