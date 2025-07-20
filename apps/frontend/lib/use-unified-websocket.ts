import { useEffect, useState, useCallback, useRef } from 'react'
import { useUnifiedAuth } from './unified-auth'
import { wsManager, type ConnectionStatus } from './websocket-connection-manager'

interface WebSocketMessage {
  type: string
  data?: any
  success?: boolean
  error?: string
}

interface UseUnifiedWebSocketOptions {
  gameId: string
  onLobbyJoined?: (data: { gameCode: string, players: any[], isHost: boolean, canStart: boolean }) => void
  onLobbyUpdate?: (players: any[], canStart: boolean) => void
  onGameStarted?: () => void
  onError?: (error: string) => void
  onMessage?: (message: WebSocketMessage) => void
}

export function useUnifiedWebSocket(options: UseUnifiedWebSocketOptions) {
  const auth = useUnifiedAuth()
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle')
  
  // Store connection reference outside React lifecycle
  const connectionRef = useRef<any>(null)
  const listenersSetupRef = useRef(false)
  
  const { gameId, onLobbyJoined, onLobbyUpdate, onGameStarted, onError, onMessage } = options

  // Set up message handlers using the singleton manager
  const setupMessageHandlers = useCallback((connection: any) => {
    if (listenersSetupRef.current) return
    listenersSetupRef.current = true

    console.log('🎯 Setting up message handlers for game:', gameId)

    // Add message route for lobby state updates
    wsManager.addMessageRoute(connection, 'lobbyState', (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data)
        console.log('📨 Lobby state message:', message)
        
        if (message.success && message.data?.lobby) {
          // Check if game is already started and redirect
          if (message.data.lobby.isStarted) {
            console.log('🚀 Game already started, triggering redirect...')
            onGameStarted?.()
            return
          }
          
          onLobbyJoined?.({
            gameCode: message.data.lobby.gameCode || '',
            players: message.data.lobby.players || [],
            isHost: message.data.lobby.isHost || false,
            canStart: message.data.lobby.canStart || false
          })
          
          onLobbyUpdate?.(
            message.data.lobby.players || [],
            message.data.lobby.canStart || false
          )
        }
      } catch (error) {
        console.error('❌ Error handling lobby state:', error)
      }
    }, 'Lobby state updates')

    // Add message route for joined lobby confirmation
    wsManager.addMessageRoute(connection, 'joinedLobby', (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data)
        console.log('📨 Joined lobby message:', message)
        
        if (message.success && message.data) {
          onLobbyJoined?.({
            gameCode: message.data.gameCode || '',
            players: message.data.players || [],
            isHost: message.data.isHost || false,
            canStart: message.data.canStart || false
          })
        }
      } catch (error) {
        console.error('❌ Error handling joined lobby:', error)
      }
    }, 'Joined lobby confirmation')

    // Add message route for game started
    wsManager.addMessageRoute(connection, 'gameStarted', (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data)
        console.log('📨 Game started message:', message)
        onGameStarted?.()
      } catch (error) {
        console.error('❌ Error handling game started:', error)
      }
    }, 'Game started notifications')

    // Add message route for social notifications
    wsManager.addMessageRoute(connection, 'socialNotification', (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data)
        console.log('📬 Social notification:', message.data?.notification)
      } catch (error) {
        console.error('❌ Error handling social notification:', error)
      }
    }, 'Social notifications')

    // Add wildcard route for all messages (for custom handler and errors)
    wsManager.addMessageRoute(connection, '*', (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data)
        
        // Handle errors
        if (message.error) {
          console.error('❌ WebSocket message error:', message.error)
          onError?.(message.error)
          setError(message.error)
        }
        
        // Call custom message handler
        onMessage?.(message)
        
      } catch (error) {
        console.error('❌ Failed to parse WebSocket message:', error)
      }
    }, 'Wildcard message handler')

  }, [gameId, onLobbyJoined, onLobbyUpdate, onGameStarted, onError, onMessage])

  // Connect using the singleton manager
  const connect = useCallback(async () => {
    const token = auth.getAccessToken()
    
    console.log('🔌 WebSocket connect attempt via singleton manager:', {
      hasToken: !!token,
      isAuthenticated: auth.isAuthenticated(),
      authLoading: auth.loading,
      gameId
    })
    
    if (!token || !auth.isAuthenticated()) {
      console.error('❌ WebSocket connect failed: No auth', { 
        token: !!token, 
        authenticated: auth.isAuthenticated() 
      })
      setError('Not authenticated')
      setConnectionStatus('error')
      return
    }

    if (!gameId) {
      setError('No game ID provided')
      setConnectionStatus('error')
      return
    }

    try {
      // Create/get connection using singleton manager
      const connection = wsManager.createGameConnection(
        gameId,
        token,
        (status) => {
          console.log('🔌 WebSocket status change:', status)
          setConnectionStatus(status)
          setIsConnected(status === 'connected')
          
          if (status === 'error' || status === 'failed') {
            setError('Connection failed')
          } else if (status === 'connected') {
            setError(null)
          }
        },
        false // not spectator mode
      )

      connectionRef.current = connection
      
      // Set up message handlers
      setupMessageHandlers(connection)
      
      // Connect using the manager
      await wsManager.connect(connection)
      
      console.log('✅ WebSocket connection initiated via singleton manager')
      
    } catch (error) {
      console.error('❌ Failed to connect via singleton manager:', error)
      setError('Connection failed')
      setConnectionStatus('error')
    }
  }, [auth, gameId, setupMessageHandlers])

  // Send message helper using singleton manager
  const sendMessage = useCallback(async (message: any) => {
    if (!connectionRef.current) {
      console.warn('⚠️ Cannot send message - no connection')
      return false
    }

    try {
      const success = await wsManager.send(connectionRef.current, message)
      if (success) {
        console.log('📤 Sent WebSocket message via singleton:', message.type)
      } else {
        console.warn('⚠️ Failed to send message via singleton')
      }
      return success
    } catch (error) {
      console.error('❌ Error sending message via singleton:', error)
      return false
    }
  }, [])

  // Game action helpers
  const addAIBot = useCallback((personality: string = 'balanced', name?: string) => {
    sendMessage({
      type: 'addAIBot',
      data: { personality, name: name || `${personality} Bot` }
    })
  }, [sendMessage])

  const removeAIBot = useCallback((botPlayerId: string) => {
    sendMessage({
      type: 'removeAIBot',
      data: { botPlayerId }
    })
  }, [sendMessage])

  const startGame = useCallback(() => {
    sendMessage({
      type: 'startGame',
      data: {}
    })
  }, [sendMessage])

  const leaveGame = useCallback(() => {
    sendMessage({
      type: 'leaveGame',
      data: {}
    })
  }, [sendMessage])

  // Connect when auth is ready and game ID is available
  useEffect(() => {
    console.log('🔌 WebSocket effect triggered:', {
      isAuthenticated: auth.isAuthenticated(),
      gameId,
      connectionStatus,
      authLoading: auth.loading
    })
    
    if (auth.isAuthenticated() && gameId && connectionStatus === 'idle') {
      console.log('🔌 Starting WebSocket connection via singleton manager...')
      connect()
    }
  }, [auth.isAuthenticated(), gameId, connect, connectionStatus])

  // Cleanup on unmount - disconnect from singleton manager
  useEffect(() => {
    return () => {
      if (connectionRef.current) {
        console.log('🧹 Cleaning up WebSocket connection via singleton manager')
        
        // Remove message routes
        const connection = connectionRef.current
        wsManager.removeMessageRoute(connection, 'lobbyState', () => {})
        wsManager.removeMessageRoute(connection, 'joinedLobby', () => {})
        wsManager.removeMessageRoute(connection, 'gameStarted', () => {})
        wsManager.removeMessageRoute(connection, 'socialNotification', () => {})
        wsManager.removeMessageRoute(connection, '*', () => {})
        
        // Disconnect
        wsManager.disconnect(connection)
        connectionRef.current = null
        listenersSetupRef.current = false
      }
    }
  }, [])

  return {
    isConnected,
    connectionStatus,
    error,
    sendMessage,
    addAIBot,
    removeAIBot,
    startGame,
    leaveGame,
    reconnect: connect
  }
}