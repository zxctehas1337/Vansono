import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { useCallStore } from '../stores/callStore'
import { 
  Phone, 
  Video, 
  Search, 
  UserPlus, 
  LogOut, 
  Users,
  Mic,
  MicOff,
  VideoOff,
  PhoneOff
} from 'lucide-react'

const Dashboard = () => {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [showSearch, setShowSearch] = useState(false)
  const [selectedContact, setSelectedContact] = useState(null)
  
  const navigate = useNavigate()
  const { user, token, clearAuth } = useAuthStore()
  const { 
    contacts, 
    onlineUsers, 
    callState, 
    currentCall,
    initializeSocket,
    disconnectSocket,
    initiateCall,
    answerCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    setContacts,
    localStream,
    remoteStream
  } = useCallStore()

  useEffect(() => {
    if (token) {
      initializeSocket(token)
      loadContacts()
    }
    
    return () => {
      disconnectSocket()
    }
  }, [token, initializeSocket, disconnectSocket])

  const loadContacts = async () => {
    try {
      const response = await fetch('/api/contacts', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const data = await response.json()
      if (response.ok) {
        setContacts(data.contacts)
      }
    } catch (error) {
      console.error('Failed to load contacts:', error)
    }
  }

  const searchUsers = async (query) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }

    try {
      const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const data = await response.json()
      if (response.ok) {
        setSearchResults(data.users)
      }
    } catch (error) {
      console.error('Search failed:', error)
    }
  }

  const addContact = async (userId) => {
    try {
      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ contactId: userId })
      })

      if (response.ok) {
        loadContacts()
        setSearchResults([])
        setSearchQuery('')
        setShowSearch(false)
      }
    } catch (error) {
      console.error('Failed to add contact:', error)
    }
  }

  const handleLogout = () => {
    clearAuth()
    navigate('/login')
  }

  const handleCall = (contact, type) => {
    setSelectedContact(contact)
    initiateCall(contact.id, type)
  }

  const handleAnswerCall = () => {
    answerCall()
  }

  const handleRejectCall = () => {
    rejectCall()
  }

  const handleEndCall = () => {
    endCall()
    setSelectedContact(null)
  }

  // Call interface
  if (callState === 'calling' || callState === 'incoming' || callState === 'connected') {
    return (
      <div className="h-screen bg-black text-white flex flex-col">
        {/* Call Header */}
        <div className="flex items-center justify-between p-4 bg-gray-900">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
              <span className="text-lg font-bold">
                {currentCall?.fromUserEmail?.charAt(0).toUpperCase() || 
                 selectedContact?.displayName?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <div>
              <h3 className="font-semibold">
                {currentCall?.fromUserEmail || selectedContact?.displayName || 'Unknown'}
              </h3>
              <p className="text-sm text-gray-400">
                {callState === 'calling' && 'Calling...'}
                {callState === 'incoming' && 'Incoming call'}
                {callState === 'connected' && 'Connected'}
              </p>
            </div>
          </div>
          
          {callState === 'incoming' && (
            <div className="flex space-x-2">
              <button
                onClick={handleRejectCall}
                className="p-3 bg-red-600 rounded-full hover:bg-red-700"
              >
                <PhoneOff className="h-6 w-6" />
              </button>
              <button
                onClick={handleAnswerCall}
                className="p-3 bg-green-600 rounded-full hover:bg-green-700"
              >
                <Phone className="h-6 w-6" />
              </button>
            </div>
          )}
        </div>

        {/* Video Area */}
        <div className="flex-1 relative bg-gray-800">
          {callState === 'connected' && (
            <>
              {/* Remote Video */}
              {remoteStream && (
                <video
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                  ref={(video) => {
                    if (video && remoteStream) {
                      video.srcObject = remoteStream
                    }
                  }}
                />
              )}
              
              {/* Local Video */}
              {localStream && (
                <div className="absolute top-4 right-4 w-48 h-36 bg-gray-700 rounded-lg overflow-hidden">
                  <video
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                    ref={(video) => {
                      if (video && localStream) {
                        video.srcObject = localStream
                      }
                    }}
                  />
                </div>
              )}
            </>
          )}
          
          {/* Call Status */}
          {callState === 'calling' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-pulse text-4xl mb-4">📞</div>
                <p className="text-xl">Calling...</p>
              </div>
            </div>
          )}
        </div>

        {/* Call Controls */}
        {callState === 'connected' && (
          <div className="flex items-center justify-center space-x-4 p-6 bg-gray-900">
            <button
              onClick={toggleMute}
              className="p-4 bg-gray-700 rounded-full hover:bg-gray-600"
            >
              <Mic className="h-6 w-6" />
            </button>
            <button
              onClick={toggleVideo}
              className="p-4 bg-gray-700 rounded-full hover:bg-gray-600"
            >
              <Video className="h-6 w-6" />
            </button>
            <button
              onClick={handleEndCall}
              className="p-4 bg-red-600 rounded-full hover:bg-red-700"
            >
              <PhoneOff className="h-6 w-6" />
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="h-screen bg-background flex">
      {/* Sidebar */}
      <div className="w-80 bg-card border-r border-border flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-primary to-purple-600 rounded-full flex items-center justify-center">
                <span className="text-sm font-bold text-white">V</span>
              </div>
              <h1 className="text-xl font-bold">Vansono</h1>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-accent rounded-lg"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
          
          <div className="mt-4">
            <p className="text-sm text-muted-foreground">Welcome back,</p>
            <p className="font-semibold">{user?.displayName || user?.email}</p>
          </div>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search users..."
              className="input pl-10"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                searchUsers(e.target.value)
                setShowSearch(true)
              }}
            />
          </div>
          
          {showSearch && searchQuery && (
            <div className="mt-2 space-y-1">
              {searchResults.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-2 hover:bg-accent rounded">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                      <span className="text-xs font-bold text-white">
                        {user.displayName?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">{user.displayName || user.email}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => addContact(user.id)}
                    className="p-1 hover:bg-accent rounded"
                  >
                    <UserPlus className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Contacts */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">Contacts</h3>
            <div className="space-y-2">
              {contacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center justify-between p-3 hover:bg-accent rounded-lg cursor-pointer"
                  onClick={() => setSelectedContact(contact)}
                >
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                        <span className="text-sm font-bold text-white">
                          {contact.displayName?.charAt(0).toUpperCase() || contact.email.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      {onlineUsers.has(contact.id) && (
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-background"></div>
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{contact.displayName || contact.email}</p>
                      <p className="text-sm text-muted-foreground">
                        {onlineUsers.has(contact.id) ? 'Online' : 'Offline'}
                      </p>
                    </div>
                  </div>
                  
                  {onlineUsers.has(contact.id) && (
                    <div className="flex space-x-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleCall(contact, 'audio')
                        }}
                        className="p-2 hover:bg-accent rounded"
                      >
                        <Phone className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleCall(contact, 'video')
                        }}
                        className="p-2 hover:bg-accent rounded"
                      >
                        <Video className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center">
        {selectedContact ? (
          <div className="text-center space-y-6">
            <div className="w-24 h-24 bg-primary rounded-full flex items-center justify-center mx-auto">
              <span className="text-3xl font-bold text-white">
                {selectedContact.displayName?.charAt(0).toUpperCase() || selectedContact.email.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h2 className="text-2xl font-bold">{selectedContact.displayName || selectedContact.email}</h2>
              <p className="text-muted-foreground">
                {onlineUsers.has(selectedContact.id) ? 'Online' : 'Offline'}
              </p>
            </div>
            
            {onlineUsers.has(selectedContact.id) && (
              <div className="flex justify-center space-x-4">
                <button
                  onClick={() => handleCall(selectedContact, 'audio')}
                  className="btn btn-primary btn-lg"
                >
                  <Phone className="h-5 w-5 mr-2" />
                  Voice Call
                </button>
                <button
                  onClick={() => handleCall(selectedContact, 'video')}
                  className="btn btn-secondary btn-lg"
                >
                  <Video className="h-5 w-5 mr-2" />
                  Video Call
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-gradient-to-r from-primary to-purple-600 rounded-full flex items-center justify-center mx-auto">
              <Users className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-xl font-semibold">Select a contact to start calling</h2>
            <p className="text-muted-foreground">Choose from your contacts or search for new users</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard
