import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCallStore } from '../stores/callStore'
import { Phone, Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react'

const CallPage = () => {
  const navigate = useNavigate()
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  
  const {
    callState,
    currentCall,
    localStream,
    remoteStream,
    toggleMute,
    toggleVideo,
    endCall
  } = useCallStore()

  useEffect(() => {
    if (callState === 'idle') {
      navigate('/dashboard')
    }
  }, [callState, navigate])

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream
    }
  }, [localStream])

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream
    }
  }, [remoteStream])

  const handleEndCall = () => {
    endCall()
    navigate('/dashboard')
  }

  if (callState === 'idle') {
    return null
  }

  return (
    <div className="h-screen bg-black text-white flex flex-col">
      {/* Call Header */}
      <div className="flex items-center justify-between p-6 bg-gray-900/50 backdrop-blur-sm">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
            <span className="text-xl font-bold">
              {currentCall?.fromUserEmail?.charAt(0).toUpperCase() || 'U'}
            </span>
          </div>
          <div>
            <h1 className="text-xl font-semibold">
              {currentCall?.fromUserEmail || 'Unknown'}
            </h1>
            <p className="text-gray-400">
              {callState === 'calling' && 'Calling...'}
              {callState === 'incoming' && 'Incoming call'}
              {callState === 'connected' && 'Connected'}
            </p>
          </div>
        </div>
        
        <div className="text-right">
          <p className="text-sm text-gray-400">Vansono</p>
        </div>
      </div>

      {/* Video Area */}
      <div className="flex-1 relative bg-gray-900">
        {/* Remote Video */}
        {callState === 'connected' && remoteStream && (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        )}
        
        {/* Local Video */}
        {callState === 'connected' && localStream && (
          <div className="absolute top-6 right-6 w-64 h-48 bg-gray-800 rounded-xl overflow-hidden shadow-2xl">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          </div>
        )}
        
        {/* Call Status Overlay */}
        {callState === 'calling' && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <div className="text-center">
              <div className="w-32 h-32 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <div className="animate-pulse text-6xl">📞</div>
              </div>
              <h2 className="text-2xl font-semibold mb-2">Calling...</h2>
              <p className="text-gray-400">Waiting for answer</p>
            </div>
          </div>
        )}
        
        {callState === 'incoming' && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <div className="text-center">
              <div className="w-32 h-32 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <div className="animate-bounce text-6xl">📱</div>
              </div>
              <h2 className="text-2xl font-semibold mb-2">Incoming Call</h2>
              <p className="text-gray-400">from {currentCall?.fromUserEmail}</p>
            </div>
          </div>
        )}
      </div>

      {/* Call Controls */}
      <div className="flex items-center justify-center space-x-6 p-8 bg-gray-900/50 backdrop-blur-sm">
        {callState === 'connected' && (
          <>
            <button
              onClick={toggleMute}
              className="p-4 bg-gray-700 rounded-full hover:bg-gray-600 transition-colors"
            >
              <Mic className="h-6 w-6" />
            </button>
            
            <button
              onClick={toggleVideo}
              className="p-4 bg-gray-700 rounded-full hover:bg-gray-600 transition-colors"
            >
              <Video className="h-6 w-6" />
            </button>
          </>
        )}
        
        <button
          onClick={handleEndCall}
          className="p-4 bg-red-600 rounded-full hover:bg-red-700 transition-colors"
        >
          <PhoneOff className="h-6 w-6" />
        </button>
      </div>
    </div>
  )
}

export default CallPage
