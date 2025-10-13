import { create } from 'zustand'
import { io } from 'socket.io-client'

export const useCallStore = create((set, get) => ({
  socket: null,
  isConnected: false,
  localStream: null,
  remoteStream: null,
  peerConnection: null,
  callState: 'idle', // idle, calling, incoming, connected, ended
  currentCall: null,
  contacts: [],
  onlineUsers: new Set(),
  
  initializeSocket: (token) => {
    const socket = io('http://localhost:3000', {
      auth: { token }
    })
    
    socket.on('connect', () => {
      set({ isConnected: true })
      console.log('Connected to server')
    })
    
    socket.on('disconnect', () => {
      set({ isConnected: false })
      console.log('Disconnected from server')
    })
    
    socket.on('call:incoming', (data) => {
      set({ 
        callState: 'incoming',
        currentCall: data
      })
    })
    
    socket.on('call:answered', (data) => {
      set({ callState: 'connected' })
    })
    
    socket.on('call:rejected', () => {
      set({ 
        callState: 'idle',
        currentCall: null
      })
    })
    
    socket.on('call:ended', () => {
      set({ 
        callState: 'idle',
        currentCall: null
      })
      get().endCall()
    })
    
    socket.on('ice-candidate', (data) => {
      const { peerConnection } = get()
      if (peerConnection) {
        peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate))
      }
    })
    
    socket.on('user:status', (data) => {
      const { onlineUsers } = get()
      const newOnlineUsers = new Set(onlineUsers)
      if (data.status === 'online') {
        newOnlineUsers.add(data.userId)
      } else {
        newOnlineUsers.delete(data.userId)
      }
      set({ onlineUsers: newOnlineUsers })
    })
    
    set({ socket })
  },
  
  disconnectSocket: () => {
    const { socket } = get()
    if (socket) {
      socket.disconnect()
      set({ socket: null, isConnected: false })
    }
  },
  
  initiateCall: async (targetUserId, callType = 'video') => {
    const { socket } = get()
    if (!socket) return
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: callType === 'video',
        audio: true
      })
      
      const peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      })
      
      stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream)
      })
      
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('ice-candidate', {
            targetUserId,
            candidate: event.candidate
          })
        }
      }
      
      peerConnection.ontrack = (event) => {
        set({ remoteStream: event.streams[0] })
      }
      
      const offer = await peerConnection.createOffer()
      await peerConnection.setLocalDescription(offer)
      
      socket.emit('call:initiate', {
        targetUserId,
        offer,
        callType
      })
      
      set({ 
        localStream: stream,
        peerConnection,
        callState: 'calling'
      })
      
    } catch (error) {
      console.error('Failed to initiate call:', error)
    }
  },
  
  answerCall: async () => {
    const { socket, currentCall } = get()
    if (!socket || !currentCall) return
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: currentCall.callType === 'video',
        audio: true
      })
      
      const peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      })
      
      stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream)
      })
      
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('ice-candidate', {
            targetUserId: currentCall.fromUserId,
            candidate: event.candidate
          })
        }
      }
      
      peerConnection.ontrack = (event) => {
        set({ remoteStream: event.streams[0] })
      }
      
      await peerConnection.setRemoteDescription(currentCall.offer)
      const answer = await peerConnection.createAnswer()
      await peerConnection.setLocalDescription(answer)
      
      socket.emit('call:answer', {
        targetUserId: currentCall.fromUserId,
        answer
      })
      
      set({ 
        localStream: stream,
        peerConnection,
        callState: 'connected'
      })
      
    } catch (error) {
      console.error('Failed to answer call:', error)
    }
  },
  
  rejectCall: () => {
    const { socket, currentCall } = get()
    if (socket && currentCall) {
      socket.emit('call:reject', {
        targetUserId: currentCall.fromUserId
      })
    }
    set({ 
      callState: 'idle',
      currentCall: null
    })
  },
  
  endCall: () => {
    const { socket, peerConnection, localStream } = get()
    
    if (peerConnection) {
      peerConnection.close()
    }
    
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop())
    }
    
    if (socket && get().currentCall) {
      socket.emit('call:end', {
        targetUserId: get().currentCall.fromUserId
      })
    }
    
    set({ 
      peerConnection: null,
      localStream: null,
      remoteStream: null,
      callState: 'idle',
      currentCall: null
    })
  },
  
  setContacts: (contacts) => {
    set({ contacts })
  },
  
  toggleMute: () => {
    const { localStream } = get()
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
      }
    }
  },
  
  toggleVideo: () => {
    const { localStream } = get()
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
      }
    }
  }
}))
