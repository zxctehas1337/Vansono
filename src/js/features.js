// ===== FEATURES MODULE =====
// Дополнительные функции: группы, каналы, секретные чаты, голосовые сообщения

// ===== GROUP CHATS FUNCTIONALITY =====

// Group chat management
let groups = JSON.parse(localStorage.getItem('groups') || '[]');
let selectedMembers = [];

// Group chat elements (with null checks)
let createGroupBtn = document.getElementById('create-group-btn-menu') || document.getElementById('create-group-btn');
let createGroupModal = document.getElementById('create-group-modal');
let closeGroupModal = document.getElementById('close-group-modal');
let cancelGroupBtn = document.getElementById('cancel-group-btn');
let createGroupConfirmBtn = document.getElementById('create-group-confirm-btn');
let groupNameInput = document.getElementById('group-name');
let groupDescriptionInput = document.getElementById('group-description');
let memberSearchInput = document.getElementById('member-search');
let membersList = document.getElementById('members-list');
let selectedMembersContainer = document.getElementById('selected-members');

// Initialize group chats
function initializeGroupChats() {
  setupGroupChatModal();
  loadGroups();
}

// Setup group chat modal
function setupGroupChatModal() {
  // Check if required elements exist
  if (!createGroupBtn || !createGroupModal) {
    console.warn('Group chat elements not found in DOM, skipping group chat initialization');
    return;
  }

  // Open create group modal
  createGroupBtn.addEventListener('click', () => {
    if (createGroupModal) {
      createGroupModal.classList.add('active');
      const menuOverlay = document.getElementById('menu-overlay');
      if (menuOverlay) menuOverlay.classList.remove('active');
      populateMembersList();
      if (groupNameInput) groupNameInput.focus();
    }
  });

  // Close group modal
  if (closeGroupModal) {
    closeGroupModal.addEventListener('click', () => {
      createGroupModal.classList.remove('active');
      resetGroupModal();
    });
  }

  if (cancelGroupBtn) {
    cancelGroupBtn.addEventListener('click', () => {
      createGroupModal.classList.remove('active');
      resetGroupModal();
    });
  }

  // Member search
  if (memberSearchInput) {
    memberSearchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      filterMembers(query);
    });
  }

  // Create group
  if (createGroupConfirmBtn) {
    createGroupConfirmBtn.addEventListener('click', () => {
      createGroup();
    });
  }
}

// Populate members list
function populateMembersList() {
  // Use server search to get all users
  if (window.Core.socket && window.Core.socket.connected) {
    window.Core.socket.emit('search_users', '');
  } else {
    // Fallback to localStorage
    let users = JSON.parse(localStorage.getItem('users') || '[]');
    
    // If no users exist, create some default users
    if (users.length === 0) {
      users = [
        { id: '1', name: 'John Doe', username: 'john', email: 'john@example.com', avatar: 'J' },
        { id: '2', name: 'Jane Smith', username: 'jane', email: 'jane@example.com', avatar: 'J' },
        { id: '3', name: 'Bob Johnson', username: 'bob', email: 'bob@example.com', avatar: 'B' },
        { id: '4', name: 'Alice Brown', username: 'alice', email: 'alice@example.com', avatar: 'A' },
        { id: '5', name: 'Charlie Wilson', username: 'charlie', email: 'charlie@example.com', avatar: 'C' },
        { id: '6', name: 'Diana Prince', username: 'diana', email: 'diana@example.com', avatar: 'D' },
        { id: '7', name: 'Eve Adams', username: 'eve', email: 'eve@example.com', avatar: 'E' },
        { id: '8', name: 'Frank Miller', username: 'frank', email: 'frank@example.com', avatar: 'F' }
      ];
      localStorage.setItem('users', JSON.stringify(users));
    }

    renderMembersList(users);
  }
}

// Render members list
function renderMembersList(users) {
  if (!membersList) {
    console.warn('Members list element not found');
    return;
  }
  membersList.innerHTML = '';
  
  if (users.length === 0) {
    membersList.innerHTML = '<div class="no-users">No users found</div>';
    return;
  }
  
  users.forEach(user => {
    const memberEl = document.createElement('div');
    memberEl.className = 'member-item';
    memberEl.dataset.userId = user.id;
    
    memberEl.innerHTML = `
      <div class="member-avatar">${user.avatar || user.name.charAt(0).toUpperCase()}</div>
      <div class="member-info">
        <div class="member-name">${user.name}</div>
        <div class="member-username">@${user.username}</div>
        ${user.email ? `<div class="member-email">${user.email}</div>` : ''}
      </div>
      <div class="member-checkbox">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style="display: none;">
          <path d="M2 6L4.5 8.5L10 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    `;

    memberEl.addEventListener('click', () => {
      toggleMemberSelection(user);
    });

    membersList.appendChild(memberEl);
  });
}

// Filter members based on search query
function filterMembers(query) {
  if (!query.trim()) {
    // If no query, get all users from server
    if (window.Core.socket && window.Core.socket.connected) {
      window.Core.socket.emit('search_users', '');
    } else {
      const users = JSON.parse(localStorage.getItem('users') || '[]');
      renderMembersList(users);
    }
    return;
  }
  
  // Use server search for better results
  if (window.Core.socket && window.Core.socket.connected) {
    window.Core.socket.emit('search_users', query);
  } else {
    // Fallback to localStorage
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const filteredUsers = users.filter(user => 
      user.name.toLowerCase().includes(query) ||
      user.username.toLowerCase().includes(query) ||
      (user.email && user.email.toLowerCase().includes(query))
    );
    renderMembersList(filteredUsers);
  }
}

// Search users function
function searchUsers(query) {
  const users = JSON.parse(localStorage.getItem('users') || '[]');
  
  return users.filter(user => 
    user.name.toLowerCase().includes(query.toLowerCase()) ||
    user.username.toLowerCase().includes(query.toLowerCase()) ||
    (user.email && user.email.toLowerCase().includes(query.toLowerCase()))
  );
}

// Toggle member selection
function toggleMemberSelection(user) {
  const memberEl = document.querySelector(`[data-user-id="${user.id}"]`);
  const isSelected = memberEl.classList.contains('selected');
  
  if (isSelected) {
    // Remove from selection
    memberEl.classList.remove('selected');
    memberEl.querySelector('.member-checkbox svg').style.display = 'none';
    selectedMembers = selectedMembers.filter(member => member.id !== user.id);
  } else {
    // Add to selection
    memberEl.classList.add('selected');
    memberEl.querySelector('.member-checkbox svg').style.display = 'block';
    selectedMembers.push(user);
  }
  
  updateSelectedMembersDisplay();
}

// Update selected members display
function updateSelectedMembersDisplay() {
  if (!selectedMembersContainer) {
    console.warn('Selected members container not found');
    return;
  }
  selectedMembersContainer.innerHTML = '';
  
  selectedMembers.forEach(member => {
    const selectedEl = document.createElement('div');
    selectedEl.className = 'selected-member';
    selectedEl.innerHTML = `
      <div class="selected-member-avatar">${member.name.charAt(0).toUpperCase()}</div>
      <span>${member.name}</span>
      <button class="remove-member" onclick="removeSelectedMember('${member.id}')">×</button>
    `;
    selectedMembersContainer.appendChild(selectedEl);
  });
}

// Remove selected member
function removeSelectedMember(userId) {
  selectedMembers = selectedMembers.filter(member => member.id !== userId);
  
  // Update UI
  const memberEl = document.querySelector(`[data-user-id="${userId}"]`);
  if (memberEl) {
    memberEl.classList.remove('selected');
    memberEl.querySelector('.member-checkbox svg').style.display = 'none';
  }
  
  updateSelectedMembersDisplay();
}

// Create group
function createGroup() {
  const name = groupNameInput.value.trim();
  const description = groupDescriptionInput.value.trim();
  
  if (!name) {
    window.Core.showNotification('Please enter group name', 'error');
    return;
  }
  
  if (selectedMembers.length === 0) {
    window.Core.showNotification('Please select at least one member', 'error');
    return;
  }
  
  const group = {
    id: Date.now().toString(),
    name: name,
    description: description,
    members: [...selectedMembers, { id: window.Core.currentUser.id, name: window.Core.currentUser.name, username: window.Core.currentUser.username }],
    createdBy: window.Core.currentUser.id,
    createdAt: Date.now(),
    isGroup: true
  };
  
  groups.push(group);
  localStorage.setItem('groups', JSON.stringify(groups));
  
  // Add group to chats list
  addGroupToChatsList(group);
  
  // Close modal
  createGroupModal.classList.remove('active');
  resetGroupModal();
  
  window.Core.showNotification('Group created successfully', 'success');
}

// Add group to chats list
function addGroupToChatsList(group) {
  const chatItem = document.createElement('div');
  chatItem.className = 'chat-item group-chat';
  chatItem.dataset.groupId = group.id;
  
  const memberCount = group.members.length;
  const groupInitials = group.name.split(' ').map(word => word.charAt(0)).join('').substring(0, 2);
  
  chatItem.innerHTML = `
    <div class="group-chat-header">
      <div class="group-avatar ${memberCount > 2 ? 'multiple' : ''}">
        ${groupInitials}
      </div>
      <div class="group-info">
        <h3>${group.name}</h3>
        <span class="group-members-count">${memberCount} members</span>
      </div>
    </div>
  `;
  
  chatItem.addEventListener('click', () => openGroupChat(group));
  document.getElementById('chats-list').appendChild(chatItem);
}

// Open group chat
function openGroupChat(group) {
  window.Core.currentChatUser = group;
  
  // Update active state
  document.querySelectorAll('.chat-item').forEach(item => {
    item.classList.remove('active');
  });
  document.querySelector(`[data-group-id="${group.id}"]`)?.classList.add('active');
  
  // Show chat container
  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('chat-container').style.display = 'flex';
  
  // Update chat header
  document.getElementById('chat-name').textContent = group.name;
  document.getElementById('chat-avatar').textContent = group.name.split(' ').map(word => word.charAt(0)).join('').substring(0, 2);
  document.getElementById('chat-status').textContent = `${group.members.length} members`;
  document.getElementById('chat-status').style.color = 'var(--text-secondary)';
  
  // Load group messages
  loadGroupMessages(group.id);
}

// Load group messages
function loadGroupMessages(groupId) {
  const messages = JSON.parse(localStorage.getItem(`groupMessages_${groupId}`) || '[]');
  document.getElementById('messages-container').innerHTML = '';
  
  messages.forEach(msg => {
    displayGroupMessage(msg, groupId);
  });
  window.Core.scrollToBottom();
}

// Display group message
function displayGroupMessage(message, groupId) {
  const isSent = message.from === window.Core.currentUser.id;
  const messageEl = document.createElement('div');
  messageEl.className = `message ${isSent ? 'sent' : ''}`;

  const time = new Date(message.timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const sender = message.sender || { name: 'Unknown' };
  const senderName = isSent ? window.Core.currentUser.name : sender.name;

  messageEl.innerHTML = `
    <div class="message-avatar">${senderName.charAt(0).toUpperCase()}</div>
    <div class="message-content">
      ${!isSent ? `<div class="message-sender">${senderName}</div>` : ''}
      <div class="message-bubble">${window.Core.escapeHtml(message.text)}</div>
      <div class="message-meta">
        <div class="message-time">${time}</div>
      </div>
    </div>
  `;

  document.getElementById('messages-container').appendChild(messageEl);
}

// Send group message
function sendGroupMessage() {
  const text = document.getElementById('message-input').value.trim();
  
  if (!text || !window.Core.currentChatUser || !window.Core.currentChatUser.isGroup) return;

  const message = {
    id: Date.now().toString(),
    from: window.Core.currentUser.id,
    sender: window.Core.currentUser.name,
    text: text,
    timestamp: Date.now(),
    groupId: window.Core.currentChatUser.id
  };

  // Save to localStorage
  const messages = JSON.parse(localStorage.getItem(`groupMessages_${window.Core.currentChatUser.id}`) || '[]');
  messages.push(message);
  localStorage.setItem(`groupMessages_${window.Core.currentChatUser.id}`, JSON.stringify(messages));

  displayGroupMessage(message, window.Core.currentChatUser.id);
  document.getElementById('message-input').value = '';
  window.Core.scrollToBottom();
}

// Reset group modal
function resetGroupModal() {
  if (groupNameInput) groupNameInput.value = '';
  if (groupDescriptionInput) groupDescriptionInput.value = '';
  if (memberSearchInput) memberSearchInput.value = '';
  selectedMembers = [];
  if (selectedMembersContainer) selectedMembersContainer.innerHTML = '';
  
  // Reset member selections
  document.querySelectorAll('.member-item').forEach(item => {
    item.classList.remove('selected');
    const checkbox = item.querySelector('.member-checkbox svg');
    if (checkbox) checkbox.style.display = 'none';
  });
}

// Load groups
function loadGroups() {
  groups.forEach(group => {
    addGroupToChatsList(group);
  });
}

// ===== VOICE MESSAGES FUNCTIONALITY =====

// Voice recording management
let mediaRecorder = null;
let audioChunks = [];
let recordingStartTime = null;
let recordingTimer = null;
let isRecording = false;

// Voice recording elements (with null checks)
let voiceMessageBtn = document.getElementById('voice-message-btn');
let voiceRecordingPanel = document.getElementById('voice-recording-panel');
let voiceRecordingStatus = document.getElementById('voice-recording-status');
let voiceRecordingTime = document.getElementById('voice-recording-time');
let voiceRecordingVisualizer = document.getElementById('voice-recording-visualizer');
let voiceCancelBtn = document.getElementById('voice-cancel-btn');
let voiceStopBtn = document.getElementById('voice-stop-btn');
let voiceSendBtn = document.getElementById('voice-send-btn');

// Initialize voice messages
function initializeVoiceMessages() {
  setupVoiceRecording();
}

// Setup voice recording
function setupVoiceRecording() {
  // Check if voice elements exist
  if (!voiceMessageBtn) {
    console.warn('Voice recording elements not found, skipping voice recording initialization');
    return;
  }
  
  // Start voice recording
  voiceMessageBtn.addEventListener('click', () => {
    if (!isRecording) {
      startVoiceRecording();
    }
  });

  // Cancel recording
  if (voiceCancelBtn) {
    voiceCancelBtn.addEventListener('click', () => {
      cancelVoiceRecording();
    });
  }

  // Stop recording
  if (voiceStopBtn) {
    voiceStopBtn.addEventListener('click', () => {
      stopVoiceRecording();
    });
  }

  // Send voice message
  if (voiceSendBtn) {
    voiceSendBtn.addEventListener('click', () => {
      sendVoiceMessage();
    });
  }
}

// Start voice recording
async function startVoiceRecording() {
  try {
    // Check if MediaRecorder is supported
    if (!window.MediaRecorder) {
      window.Core.showNotification('Voice recording not supported in this browser', 'error');
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    
    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data);
    };
    
    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Show send button
      if (voiceStopBtn) voiceStopBtn.style.display = 'none';
      if (voiceSendBtn) voiceSendBtn.style.display = 'flex';
      if (voiceRecordingStatus) voiceRecordingStatus.textContent = 'Recording complete';
      
      // Store audio for sending
      if (voiceSendBtn) {
        voiceSendBtn.dataset.audioUrl = audioUrl;
        voiceSendBtn.dataset.audioBlob = audioBlob;
      }
    };
    
    mediaRecorder.start();
    isRecording = true;
    recordingStartTime = Date.now();
    
    // Show recording panel
    if (voiceRecordingPanel) voiceRecordingPanel.style.display = 'block';
    const messageInput = document.getElementById('message-input');
    if (messageInput) messageInput.style.display = 'none';
    
    // Start timer
    startRecordingTimer();
    
    // Start visualizer animation
    startVisualizerAnimation();
    
    window.Core.showNotification('Voice recording started', 'info');
    
  } catch (error) {
    console.error('Error accessing microphone:', error);
    window.Core.showNotification('Unable to access microphone', 'error');
  }
}

// Stop voice recording
function stopVoiceRecording() {
  if (mediaRecorder && isRecording) {
    mediaRecorder.stop();
    isRecording = false;
    
    // Stop timer
    if (recordingTimer) {
      clearInterval(recordingTimer);
    }
    
    // Stop visualizer
    stopVisualizerAnimation();
    
    window.Core.showNotification('Voice recording stopped', 'info');
  }
}

// Cancel voice recording
function cancelVoiceRecording() {
  if (mediaRecorder && isRecording) {
    mediaRecorder.stop();
    isRecording = false;
  }
  
  // Stop timer
  if (recordingTimer) {
    clearInterval(recordingTimer);
  }
  
  // Stop visualizer
  stopVisualizerAnimation();
  
  // Hide recording panel
  voiceRecordingPanel.style.display = 'none';
  document.getElementById('message-input').style.display = 'block';
  
  // Reset UI
  voiceStopBtn.style.display = 'flex';
  voiceSendBtn.style.display = 'none';
  voiceRecordingStatus.textContent = 'Recording...';
  voiceRecordingTime.textContent = '00:00';
  
  window.Core.showNotification('Voice recording cancelled', 'info');
}

// Start recording timer
function startRecordingTimer() {
  recordingTimer = setInterval(() => {
    const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    voiceRecordingTime.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, 1000);
}

// Start visualizer animation
function startVisualizerAnimation() {
  const bars = voiceRecordingVisualizer.querySelectorAll('.visualizer-bar');
  bars.forEach((bar, index) => {
    bar.style.animation = `visualizerPulse ${0.5 + Math.random() * 0.5}s ease-in-out infinite alternate`;
    bar.style.animationDelay = `${index * 0.1}s`;
  });
}

// Stop visualizer animation
function stopVisualizerAnimation() {
  const bars = voiceRecordingVisualizer.querySelectorAll('.visualizer-bar');
  bars.forEach(bar => {
    bar.style.animation = 'none';
    bar.style.height = '4px';
  });
}

// Send voice message
function sendVoiceMessage() {
  const audioUrl = voiceSendBtn.dataset.audioUrl;
  const audioBlob = voiceSendBtn.dataset.audioBlob;
  
  if (!audioUrl || !audioBlob) {
    window.Core.showNotification('No voice recording to send', 'error');
    return;
  }
  
  // Create voice message
  const voiceMessage = {
    id: Date.now().toString(),
    from: window.Core.currentUser.id,
    to: window.Core.currentChatUser.id,
    type: 'voice',
    audioUrl: audioUrl,
    duration: Math.floor((Date.now() - recordingStartTime) / 1000),
    timestamp: Date.now(),
    read: false
  };
  
  // Save to localStorage for both sender and receiver
  const senderMessages = JSON.parse(localStorage.getItem(`messages_${window.Core.currentChatUser.id}`) || '[]');
  senderMessages.push(voiceMessage);
  localStorage.setItem(`messages_${window.Core.currentChatUser.id}`, JSON.stringify(senderMessages));
  
  // Also save to receiver's messages (simulating real-time sync)
  const receiverMessages = JSON.parse(localStorage.getItem(`messages_${window.Core.currentUser.id}`) || '[]');
  const receiverMessage = { ...voiceMessage, from: window.Core.currentUser.id, to: window.Core.currentChatUser.id };
  receiverMessages.push(receiverMessage);
  localStorage.setItem(`messages_${window.Core.currentUser.id}`, JSON.stringify(receiverMessages));
  
  // Send via socket for real-time delivery
  if (window.Core.socket && window.Core.socket.connected) {
    window.Core.socket.emit('message:send', {
      to: window.Core.currentChatUser.id,
      text: `[Voice Message - ${window.Core.formatDuration(voiceMessage.duration)}]`,
      type: 'voice',
      audioUrl: audioUrl,
      duration: voiceMessage.duration
    });
  }
  
  // Display voice message
  displayVoiceMessage(voiceMessage);
  
  // Hide recording panel
  voiceRecordingPanel.style.display = 'none';
  document.getElementById('message-input').style.display = 'block';
  
  // Reset UI
  voiceStopBtn.style.display = 'flex';
  voiceSendBtn.style.display = 'none';
  voiceRecordingStatus.textContent = 'Recording...';
  voiceRecordingTime.textContent = '00:00';
  
  window.Core.showNotification('Voice message sent', 'success');
}

// Display voice message
function displayVoiceMessage(message) {
  const isSent = message.from === window.Core.currentUser.id;
  const messageEl = document.createElement('div');
  messageEl.className = `message voice-message ${isSent ? 'sent' : ''}`;

  const time = new Date(message.timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const senderName = isSent ? window.Core.currentUser.name : window.Core.currentChatUser.name;
  const duration = window.Core.formatDuration(message.duration);

  messageEl.innerHTML = `
    <div class="message-avatar">${senderName.charAt(0).toUpperCase()}</div>
    <div class="message-content">
      <div class="voice-message">
        <div class="voice-message-icon">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 1C6.34 1 5 2.34 5 4V8C5 9.66 6.34 11 8 11C9.66 11 11 9.66 11 8V4C11 2.34 9.66 1 8 1Z" stroke="currentColor" stroke-width="1.5"/>
            <path d="M6 6V8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <path d="M10 6V8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <path d="M8 6V8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="voice-message-info">
          <div class="voice-message-duration">${duration}</div>
          <div class="voice-message-waveform" id="waveform-${message.id}">
            ${generateWaveform()}
          </div>
        </div>
        <button class="voice-message-play-btn" onclick="playVoiceMessage('${message.id}', '${message.audioUrl}')">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 2L9 6L3 10V2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
      <div class="message-meta">
        <div class="message-time">${time}</div>
      </div>
    </div>
  `;

  document.getElementById('messages-container').appendChild(messageEl);
  window.Core.scrollToBottom();
}

// Generate waveform visualization
function generateWaveform() {
  let waveform = '';
  for (let i = 0; i < 20; i++) {
    const height = Math.random() * 20 + 4;
    waveform += `<div class="waveform-bar" style="height: ${height}px;"></div>`;
  }
  return waveform;
}

// Voice message playback management
let currentPlayingAudio = null;
let currentPlayingMessageId = null;

// Play voice message
function playVoiceMessage(messageId, audioUrl) {
  const playBtn = document.querySelector(`[onclick="playVoiceMessage('${messageId}', '${audioUrl}')"]`);
  const waveform = document.getElementById(`waveform-${messageId}`);
  
  // Stop any currently playing audio
  if (currentPlayingAudio && !currentPlayingAudio.paused) {
    currentPlayingAudio.pause();
    const currentPlayBtn = document.querySelector(`[onclick="playVoiceMessage('${currentPlayingMessageId}', '${currentPlayingAudio.src}')"]`);
    if (currentPlayBtn) {
      currentPlayBtn.classList.remove('playing');
      currentPlayBtn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M3 2L9 6L3 10V2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
        </svg>
      `;
    }
    const currentWaveform = document.getElementById(`waveform-${currentPlayingMessageId}`);
    if (currentWaveform) {
      stopWaveformAnimation(currentWaveform);
    }
  }
  
  // If clicking the same message, toggle play/pause
  if (currentPlayingMessageId === messageId && currentPlayingAudio) {
    if (currentPlayingAudio.paused) {
      currentPlayingAudio.play();
      playBtn.classList.add('playing');
      playBtn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <rect x="2" y="2" width="3" height="8" stroke="currentColor" stroke-width="1.5"/>
          <rect x="7" y="2" width="3" height="8" stroke="currentColor" stroke-width="1.5"/>
        </svg>
      `;
      animateWaveform(waveform);
    } else {
      currentPlayingAudio.pause();
      playBtn.classList.remove('playing');
      playBtn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M3 2L9 6L3 10V2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
        </svg>
      `;
      stopWaveformAnimation(waveform);
    }
    return;
  }
  
  // Start playing new audio
  const audio = new Audio(audioUrl);
  currentPlayingAudio = audio;
  currentPlayingMessageId = messageId;
  
  audio.play();
  playBtn.classList.add('playing');
  playBtn.innerHTML = `
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <rect x="2" y="2" width="3" height="8" stroke="currentColor" stroke-width="1.5"/>
      <rect x="7" y="2" width="3" height="8" stroke="currentColor" stroke-width="1.5"/>
    </svg>
  `;
  
  // Animate waveform
  animateWaveform(waveform);
  
  audio.onended = () => {
    playBtn.classList.remove('playing');
    playBtn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M3 2L9 6L3 10V2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
      </svg>
    `;
    stopWaveformAnimation(waveform);
    currentPlayingAudio = null;
    currentPlayingMessageId = null;
  };
  
  audio.onerror = () => {
    playBtn.classList.remove('playing');
    playBtn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M3 2L9 6L3 10V2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
      </svg>
    `;
    stopWaveformAnimation(waveform);
    currentPlayingAudio = null;
    currentPlayingMessageId = null;
    window.Core.showNotification('Error playing voice message', 'error');
  };
}

// Animate waveform
function animateWaveform(waveform) {
  const bars = waveform.querySelectorAll('.waveform-bar');
  bars.forEach((bar, index) => {
    bar.style.animation = `visualizerPulse ${0.3 + Math.random() * 0.4}s ease-in-out infinite alternate`;
    bar.style.animationDelay = `${index * 0.05}s`;
  });
}

// Stop waveform animation
function stopWaveformAnimation(waveform) {
  const bars = waveform.querySelectorAll('.waveform-bar');
  bars.forEach(bar => {
    bar.style.animation = 'none';
  });
}

// ===== SETUP MENU HANDLERS =====

// Secret Chat Modal
const secretChatModal = document.getElementById('secret-chat-modal');
const closeSecretModal = document.getElementById('close-secret-modal');
const cancelSecretBtn = document.getElementById('cancel-secret-btn');
const createSecretChatBtnMenu = document.getElementById('create-secret-chat-btn-menu');

if (createSecretChatBtnMenu) {
  createSecretChatBtnMenu.addEventListener('click', () => {
    if (secretChatModal) {
      secretChatModal.classList.add('active');
      document.getElementById('menu-overlay').classList.remove('active');
    }
  });
}

if (closeSecretModal) {
  closeSecretModal.addEventListener('click', () => {
    if (secretChatModal) secretChatModal.classList.remove('active');
  });
}

if (cancelSecretBtn) {
  cancelSecretBtn.addEventListener('click', () => {
    if (secretChatModal) secretChatModal.classList.remove('active');
  });
}

// Folder Modal
const folderModal = document.getElementById('folder-modal');
const closeFolderModal = document.getElementById('close-folder-modal');
const cancelFolderBtn = document.getElementById('cancel-folder-btn');
const createFolderBtnMenu = document.getElementById('create-folder-btn-menu');

if (createFolderBtnMenu) {
  createFolderBtnMenu.addEventListener('click', () => {
    if (folderModal) {
      folderModal.classList.add('active');
      document.getElementById('menu-overlay').classList.remove('active');
    }
  });
}

if (closeFolderModal) {
  closeFolderModal.addEventListener('click', () => {
    if (folderModal) folderModal.classList.remove('active');
  });
}

if (cancelFolderBtn) {
  cancelFolderBtn.addEventListener('click', () => {
    if (folderModal) folderModal.classList.remove('active');
  });
}

// Channel Modal
const channelModal = document.getElementById('create-channel-modal');
const closeChannelModal = document.getElementById('close-channel-modal');
const cancelChannelBtn = document.getElementById('cancel-channel-btn');
const createChannelBtnMenu = document.getElementById('create-channel-btn-menu');

if (createChannelBtnMenu) {
  createChannelBtnMenu.addEventListener('click', () => {
    if (channelModal) {
      channelModal.classList.add('active');
      document.getElementById('menu-overlay').classList.remove('active');
    }
  });
}

if (closeChannelModal) {
  closeChannelModal.addEventListener('click', () => {
    if (channelModal) channelModal.classList.remove('active');
  });
}

if (cancelChannelBtn) {
  cancelChannelBtn.addEventListener('click', () => {
    if (channelModal) channelModal.classList.remove('active');
  });
}

// ===== CHANNELS FUNCTIONALITY =====

// Channel creation
const channelNameInput = document.getElementById('channel-name');
const channelDescriptionInput = document.getElementById('channel-description');
const createChannelConfirmBtn = document.getElementById('create-channel-confirm-btn');

if (createChannelConfirmBtn) {
  createChannelConfirmBtn.addEventListener('click', () => {
    createChannel();
  });
}

function createChannel() {
  if (!window.Core.currentUser) {
    window.Core.showNotification('Please log in first', 'error');
    return;
  }
  
  const name = channelNameInput ? channelNameInput.value.trim() : '';
  const description = channelDescriptionInput ? channelDescriptionInput.value.trim() : '';

  if (!name) {
    window.Core.showNotification('Please enter a channel name', 'error');
    return;
  }

  const channel = {
    id: `channel_${Date.now()}`,
    name: name,
    description: description,
    type: 'channel',
    isChannel: true,
    creator: window.Core.currentUser.id,
    creatorName: window.Core.currentUser.name,
    members: [window.Core.currentUser.id],
    created: Date.now()
  };

  // Save channel to localStorage
  const channels = JSON.parse(localStorage.getItem('channels') || '[]');
  channels.push(channel);
  localStorage.setItem('channels', JSON.stringify(channels));

  // Add channel to chats list
  addChannelToChatsList(channel);

  // Close modal
  const channelModal = document.getElementById('create-channel-modal');
  if (channelModal) channelModal.classList.remove('active');

  // Reset form
  if (channelNameInput) channelNameInput.value = '';
  if (channelDescriptionInput) channelDescriptionInput.value = '';

  window.Core.showNotification('Channel created successfully', 'success');
}

// Add channel to chats list
function addChannelToChatsList(channel) {
  const chatsList = document.getElementById('chats-list');
  if (!chatsList) return;

  const channelItem = document.createElement('div');
  channelItem.className = 'chat-item';
  channelItem.dataset.channelId = channel.id;

  channelItem.innerHTML = `
    <div style="position: relative;">
      <div class="avatar" style="width: 48px; height: 48px; font-size: 18px; background: linear-gradient(135deg, #667eea, #764ba2);">
        #
      </div>
    </div>
    <div class="chat-item-info">
      <div class="chat-item-header">
        <span class="chat-item-name">${channel.name}</span>
        <span class="chat-item-time">now</span>
      </div>
      <div class="chat-item-preview">Channel • ${channel.members.length} members</div>
    </div>
  `;

  channelItem.addEventListener('click', () => openChannelChat(channel));
  chatsList.appendChild(channelItem);
}

// Open channel chat
function openChannelChat(channel) {
  window.Core.currentChatUser = channel;
  
  // Update active state
  document.querySelectorAll('.chat-item').forEach(item => {
    item.classList.remove('active');
  });
  document.querySelector(`[data-channel-id="${channel.id}"]`)?.classList.add('active');

  // Show chat container
  const emptyState = document.getElementById('empty-state');
  const chatContainer = document.getElementById('chat-container');
  if (emptyState) emptyState.style.display = 'none';
  if (chatContainer) chatContainer.style.display = 'flex';

  // Update chat header
  const chatName = document.getElementById('chat-name');
  const chatAvatar = document.getElementById('chat-avatar');
  const chatStatus = document.getElementById('chat-status');
  
  if (chatName) chatName.textContent = channel.name;
  if (chatAvatar) {
    chatAvatar.textContent = '#';
    chatAvatar.style.background = 'linear-gradient(135deg, #667eea, #764ba2)';
  }
  if (chatStatus) {
    chatStatus.textContent = `Channel • ${channel.members.length} members`;
    chatStatus.style.color = 'var(--text-tertiary)';
  }

  // Load channel messages
  const messagesContainer = document.getElementById('messages-container');
  if (messagesContainer) {
    messagesContainer.innerHTML = '';
    loadChannelMessages(channel.id);
  }
}

// Load channel messages
function loadChannelMessages(channelId) {
  const messages = JSON.parse(localStorage.getItem(`channelMessages_${channelId}`) || '[]');
  messages.forEach(message => displayChannelMessage(message, channelId));
  window.Core.scrollToBottom();
}

// Display channel message
function displayChannelMessage(message, channelId) {
  const messagesContainer = document.getElementById('messages-container');
  if (!messagesContainer) return;

  const messageEl = document.createElement('div');
  messageEl.className = `message ${message.from === window.Core.currentUser.id ? 'sent' : ''}`;

  const time = new Date(message.timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  messageEl.innerHTML = `
    <div class="message-avatar">${message.sender.charAt(0).toUpperCase()}</div>
    <div class="message-content">
      <div class="message-text">${window.Core.escapeHtml(message.text)}</div>
      <div class="message-meta">
        <div class="message-sender">${message.sender}</div>
        <div class="message-time">${time}</div>
      </div>
    </div>
  `;

  messagesContainer.appendChild(messageEl);
}

// Send channel message
function sendChannelMessage() {
  const text = document.getElementById('message-input').value.trim();
  
  if (!text || !window.Core.currentChatUser || !window.Core.currentChatUser.isChannel) return;

  const message = {
    id: Date.now().toString(),
    from: window.Core.currentUser.id,
    sender: window.Core.currentUser.name,
    text: text,
    timestamp: Date.now(),
    channelId: window.Core.currentChatUser.id
  };

  // Save to localStorage
  const messages = JSON.parse(localStorage.getItem(`channelMessages_${window.Core.currentChatUser.id}`) || '[]');
  messages.push(message);
  localStorage.setItem(`channelMessages_${window.Core.currentChatUser.id}`, JSON.stringify(messages));

  displayChannelMessage(message, window.Core.currentChatUser.id);
  document.getElementById('message-input').value = '';
  window.Core.scrollToBottom();
}

// ===== SECRET CHATS FUNCTIONALITY =====

// Secret chat creation
const secretUserSearch = document.getElementById('secret-user-search');
const secretUserDropdown = document.getElementById('secret-user-dropdown');
const createSecretBtn = document.getElementById('create-secret-btn');
let selectedSecretUser = null;
let selectedTimer = 0;

if (createSecretBtn) {
  createSecretBtn.addEventListener('click', () => {
    createSecretChat();
  });
}

// Timer option selection
const timerOptions = document.querySelectorAll('.timer-option');
timerOptions.forEach(option => {
  option.addEventListener('click', () => {
    // Remove active class from all options
    timerOptions.forEach(opt => opt.classList.remove('active'));
    // Add active class to selected option
    option.classList.add('active');
    selectedTimer = parseInt(option.dataset.timer);
  });
});

// Secret user search
if (secretUserSearch) {
  secretUserSearch.addEventListener('input', window.Core.debounce((e) => {
    const query = e.target.value.trim();
    if (query.length < 2) {
      secretUserDropdown.innerHTML = '';
      return;
    }
    
    // Search users via socket
    if (window.Core.socket && window.Core.socket.connected) {
      window.Core.socket.emit('search_users', query);
    } else {
      // Use stored users as fallback
      const users = JSON.parse(localStorage.getItem('users') || '[]');
      const filteredUsers = users.filter(user => {
        if (!user || !user.id || !user.name) return false;
        // Don't include current user
        if (window.Core.currentUser && user.id === window.Core.currentUser.id) return false;
        return user.name.toLowerCase().includes(query.toLowerCase()) || 
               (user.username && user.username.toLowerCase().includes(query.toLowerCase()));
      });
      
      displaySecretUserResults(filteredUsers);
    }
  }, 300));
}

// Listen for user search results
if (window.Core.socket) {
  window.Core.socket.on('search_results', (users) => {
    // Update group members list if we're in group creation modal
    if (createGroupModal && createGroupModal.classList.contains('active')) {
      renderMembersList(users);
    }
    
    // Update secret chat user search if we're searching for secret chat users
    if (secretUserSearch && secretUserSearch === document.activeElement) {
      displaySecretUserResults(users);
    }
  });
}

// Display secret user search results
function displaySecretUserResults(users) {
  if (!secretUserDropdown) return;
  
  const filteredUsers = users.filter(user => {
    if (!user || !user.id || !user.name) return false;
    // Don't include current user
    if (window.Core.currentUser && user.id === window.Core.currentUser.id) return false;
    return true;
  });
  
  secretUserDropdown.innerHTML = filteredUsers.map(user => `
    <div class="user-option" data-user-id="${user.id}" data-user-name="${user.name}" data-username="${user.username || '@unknown'}">
      <div class="avatar">${user.name.charAt(0)}</div>
      <div class="user-info">
        <div class="user-name">${user.name}</div>
        <div class="username">${user.username || '@unknown'}</div>
      </div>
    </div>
  `).join('');
  
  // Add click handlers
  document.querySelectorAll('.user-option').forEach(option => {
    option.addEventListener('click', () => {
      selectedSecretUser = {
        id: option.dataset.userId,
        name: option.dataset.userName,
        username: option.dataset.username
      };
      secretUserSearch.value = selectedSecretUser.name;
      secretUserDropdown.innerHTML = '';
    });
  });
}

function createSecretChat() {
  if (!window.Core.currentUser) {
    window.Core.showNotification('Please log in first', 'error');
    return;
  }
  
  if (!selectedSecretUser) {
    window.Core.showNotification('Please select a user', 'error');
    return;
  }

  const secretChat = {
    id: `secret_${Date.now()}`,
    name: `🔒 ${selectedSecretUser.name}`,
    type: 'secret',
    isSecret: true,
    user: selectedSecretUser,
    creator: window.Core.currentUser.id,
    timer: selectedTimer,
    created: Date.now()
  };

  // Save secret chat to localStorage
  const secretChats = JSON.parse(localStorage.getItem('secretChats') || '[]');
  secretChats.push(secretChat);
  localStorage.setItem('secretChats', JSON.stringify(secretChats));

  // Add secret chat to chats list
  addSecretChatToChatsList(secretChat);

  // Close modal
  const secretModal = document.getElementById('secret-chat-modal');
  if (secretModal) secretModal.classList.remove('active');

  // Reset form
  if (secretUserSearch) secretUserSearch.value = '';
  selectedSecretUser = null;
  selectedTimer = 0;
  timerOptions.forEach(opt => opt.classList.remove('active'));

  window.Core.showNotification('Secret chat created successfully', 'success');
}

// Add secret chat to chats list
function addSecretChatToChatsList(secretChat) {
  const chatsList = document.getElementById('chats-list');
  if (!chatsList) return;

  const secretItem = document.createElement('div');
  secretItem.className = 'chat-item';
  secretItem.dataset.secretId = secretChat.id;

  secretItem.innerHTML = `
    <div style="position: relative;">
      <div class="avatar" style="width: 48px; height: 48px; font-size: 18px; background: linear-gradient(135deg, #8B5CF6, #EC4899);">
        🔒
      </div>
    </div>
    <div class="chat-item-info">
      <div class="chat-item-header">
        <span class="chat-item-name">${secretChat.name}</span>
        <span class="chat-item-time">now</span>
      </div>
      <div class="chat-item-preview">Secret chat • Timer: ${formatTimer(secretChat.timer)}</div>
    </div>
  `;

  secretItem.addEventListener('click', () => openSecretChat(secretChat));
  chatsList.appendChild(secretItem);
}

// Format timer display
function formatTimer(seconds) {
  if (seconds === 0) return 'No timer';
  if (seconds < 3600) return `${seconds / 60}m`;
  if (seconds < 86400) return `${seconds / 3600}h`;
  return `${seconds / 86400}d`;
}

// Open secret chat
function openSecretChat(secretChat) {
  window.Core.currentChatUser = secretChat;
  
  // Update active state
  document.querySelectorAll('.chat-item').forEach(item => {
    item.classList.remove('active');
  });
  document.querySelector(`[data-secret-id="${secretChat.id}"]`)?.classList.add('active');

  // Show chat container
  const emptyState = document.getElementById('empty-state');
  const chatContainer = document.getElementById('chat-container');
  if (emptyState) emptyState.style.display = 'none';
  if (chatContainer) chatContainer.style.display = 'flex';

  // Update chat header
  const chatName = document.getElementById('chat-name');
  const chatAvatar = document.getElementById('chat-avatar');
  const chatStatus = document.getElementById('chat-status');
  
  if (chatName) chatName.textContent = secretChat.name;
  if (chatAvatar) {
    chatAvatar.textContent = '🔒';
    chatAvatar.style.background = 'linear-gradient(135deg, #8B5CF6, #EC4899)';
  }
  if (chatStatus) {
    chatStatus.textContent = `Secret chat • Timer: ${formatTimer(secretChat.timer)}`;
    chatStatus.style.color = 'var(--accent)';
  }

  // Load secret chat messages
  const messagesContainer = document.getElementById('messages-container');
  if (messagesContainer) {
    messagesContainer.innerHTML = '';
    loadSecretMessages(secretChat.id);
  }
}

// Load secret messages
function loadSecretMessages(secretId) {
  const messages = JSON.parse(localStorage.getItem(`secretMessages_${secretId}`) || '[]');
  const currentTime = Date.now();
  
  // Filter out expired messages
  const validMessages = messages.filter(message => {
    const secretChat = JSON.parse(localStorage.getItem('secretChats') || '[]')
      .find(chat => chat.id === secretId);
    if (!secretChat || secretChat.timer === 0) return true;
    return (currentTime - message.timestamp) < (secretChat.timer * 1000);
  });
  
  // Save filtered messages back
  localStorage.setItem(`secretMessages_${secretId}`, JSON.stringify(validMessages));
  
  validMessages.forEach(message => displaySecretMessage(message, secretId));
  window.Core.scrollToBottom();
}

// Display secret message
function displaySecretMessage(message, secretId) {
  const messagesContainer = document.getElementById('messages-container');
  if (!messagesContainer) return;

  const messageEl = document.createElement('div');
  messageEl.className = `message ${message.from === window.Core.currentUser.id ? 'sent' : ''}`;

  const time = new Date(message.timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  messageEl.innerHTML = `
    <div class="message-avatar">🔒</div>
    <div class="message-content">
      <div class="message-text">${window.Core.escapeHtml(message.text)}</div>
      <div class="message-meta">
        <div class="message-time">${time}</div>
        <div class="secret-indicator">🔒 Encrypted</div>
      </div>
    </div>
  `;

  messagesContainer.appendChild(messageEl);
}

// Send secret message
function sendSecretMessage() {
  const text = document.getElementById('message-input').value.trim();
  
  if (!text || !window.Core.currentChatUser || !window.Core.currentChatUser.isSecret) return;

  const message = {
    id: Date.now().toString(),
    from: window.Core.currentUser.id,
    sender: window.Core.currentUser.name,
    text: text,
    timestamp: Date.now(),
    secretId: window.Core.currentChatUser.id,
    encrypted: true
  };

  // Save to localStorage
  const messages = JSON.parse(localStorage.getItem(`secretMessages_${window.Core.currentChatUser.id}`) || '[]');
  messages.push(message);
  localStorage.setItem(`secretMessages_${window.Core.currentChatUser.id}`, JSON.stringify(messages));

  displaySecretMessage(message, window.Core.currentChatUser.id);
  document.getElementById('message-input').value = '';
  window.Core.scrollToBottom();
}

// ===== INITIALIZATION =====

function initializeFeatures() {
  initializeGroupChats();
  initializeVoiceMessages();
  loadStoredChannels();
  loadStoredSecretChats();
  console.log('Features module initialized');
}

// Load stored channels and secret chats on startup
function loadStoredChannels() {
  const channels = JSON.parse(localStorage.getItem('channels') || '[]');
  channels.forEach(channel => addChannelToChatsList(channel));
}

function loadStoredSecretChats() {
  const secretChats = JSON.parse(localStorage.getItem('secretChats') || '[]');
  secretChats.forEach(secretChat => addSecretChatToChatsList(secretChat));
}

// Export functions for other modules
window.Features = {
  initializeGroupChats,
  initializeVoiceMessages,
  createGroup,
  openGroupChat,
  sendGroupMessage,
  createChannel,
  openChannelChat,
  sendChannelMessage,
  createSecretChat,
  openSecretChat,
  sendSecretMessage,
  startVoiceRecording,
  stopVoiceRecording,
  cancelVoiceRecording,
  sendVoiceMessage,
  displayVoiceMessage,
  playVoiceMessage,
  initializeFeatures
};

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', initializeFeatures);
