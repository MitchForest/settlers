import { useEffect, useState, useCallback, useRef } from 'react'
import { wsManager, type ConnectionStatus } from './websocket-connection-manager'
import type { LobbyPlayer } from './types/lobby-types'

interface UseLobbyWebSocketOptions {
  sessionToken: string
  gameId: string
  onLobbyJoined?: (data: { gameCode: string, players: LobbyPlayer[], isHost: boolean, canStart: boolean }) => void
  onLobbyUpdate?: (players: LobbyPlayer[], canStart: boolean) => void
  onGameStarted?: () => void
  onError?: (error: string) => void
}

/**
 * 🎮 LOBBY WEBSOCKET HOOK (ROBUST VERSION)
 * 
 * Uses external WebSocket manager - React just observes state.
 * The actual WebSocket lives outside React lifecycle.
 * 
 * ✅ ROBUSTNESS FEATURES:
 * - Automatic timeout handling for game creation
 * - Proper message listener cleanup
 * - Connection health monitoring
 * - Error recovery with retry logic
 */
export function useLobbyWebSocket(options: UseLobbyWebSocketOptions) {
  const [status, setStatus] = useState<ConnectionStatus>('idle')
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Use refs to avoid stale closures in callbacks
  const optionsRef = useRef(options)
  optionsRef.current = options
  
  const {
    sessionToken,
    gameId,
    onLobbyJoined,
    onLobbyUpdate,
    onGameStarted,
    onError
  } = options

  // Build WebSocket URL - always encode the session token
  const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080/ws'}?s=${encodeURIComponent(sessionToken)}`

  // Message handler with type safety
  const messageListener = useRef({
    onMessage: (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data)
        console.log('🎮 Lobby message:', data.type, data)
        
        // Get current callbacks to avoid stale closures
        const currentOptions = optionsRef.current
        
        if (data.error) {
          const errorMessage = data.error || 'Unknown server error'
          console.error('🎮 Server error:', errorMessage, data.details)
          setError(errorMessage)
          currentOptions.onError?.(errorMessage)
          return
        }
        
        switch (data.type) {
          case 'lobbyState':
            // Handle initial lobby state after auto-join
            const lobbyData = data.data?.lobby
            if (lobbyData) {
              console.log('🎮 Received lobby state:', lobbyData)
              currentOptions.onLobbyJoined?.({
                gameCode: lobbyData.gameCode,
                players: lobbyData.players || [],
                isHost: lobbyData.players?.some((p: any) => p.isHost) || false,
                canStart: lobbyData.players?.length >= 2 || false
              })
            }
            break
            
          case 'lobbyEvents':
            // Handle live updates
            const events = data.data?.events
            if (events && Array.isArray(events)) {
              console.log('🎮 Received lobby events:', events.length)
              // For now, just trigger a generic update
              // In the future, we could process individual events
              currentOptions.onLobbyUpdate?.([], false)
            }
            break
            
          case 'lobbyJoined':
            currentOptions.onLobbyJoined?.({
              gameCode: data.gameCode,
              players: data.players,
              isHost: data.isHost,
              canStart: data.canStart
            })
            break
            
          case 'lobbyUpdate':
            currentOptions.onLobbyUpdate?.(data.players, data.canStart)
            break
            
          case 'gameStarted':
            currentOptions.onGameStarted?.()
            break
            
          case 'pong':
            // Health check response
            console.log('🎮 Received pong')
            break
            
          default:
            console.log('🎮 Unhandled message type:', data.type)
        }
      } catch (error) {
        console.error('🎮 Failed to parse message:', error)
        setError('Failed to parse server message')
        optionsRef.current.onError?.('Failed to parse server message')
      }
    }
  })

  // Status change handler with timeout for auto-join
  const handleStatusChange = useCallback((newStatus: ConnectionStatus, ws?: WebSocket) => {
    console.log('🎮 Connection status changed:', newStatus)
    setStatus(newStatus)
    setIsConnected(newStatus === 'connected')

    // Clear error on successful connection
    if (newStatus === 'connected') {
      setError(null)
    }

    // Set error state for failed connections
    if (newStatus === 'failed' || newStatus === 'error') {
      const health = wsManager.getConnectionHealth(wsUrl, sessionToken)
      if (health?.lastError) {
        setError(health.lastError)
        optionsRef.current.onError?.(health.lastError)
      }
    }

    // Auto-join when connected with timeout
    if (newStatus === 'connected' && ws) {
      console.log('🎮 Auto-joining game lobby:', gameId)
      
      // Set up timeout for auto-join
      const joinTimeout = window.setTimeout(() => {
        console.error('🎮 Auto-join timeout - game creation may be stuck', {
          gameId,
          status: newStatus,
          wsUrl,
          hasSessionToken: !!sessionToken
        })
        setError('Connection timeout during game join - check backend logs')
        optionsRef.current.onError?.('Connection timeout during game join')
      }, 20000) // 20 second timeout for game join (increased from 15s)
      
      // The backend now auto-joins on connection, so we don't need to send joinLobby
      // Just clear the timeout when we receive the first lobby state
      const originalOnLobbyJoined = optionsRef.current.onLobbyJoined
      optionsRef.current.onLobbyJoined = (data) => {
        window.clearTimeout(joinTimeout)
        originalOnLobbyJoined?.(data)
        // Restore original callback
        optionsRef.current.onLobbyJoined = originalOnLobbyJoined
      }
    }
  }, [gameId, wsUrl, sessionToken])

  // Connection effect with proper cleanup
  useEffect(() => {
    if (!sessionToken) {
      console.log('🎮 No session token yet, skipping WebSocket connection')
      return
    }
    
    console.log('🎮 React effect: Setting up connection for', gameId, 'with token length:', sessionToken.length)
    
    // Get or create connection (idempotent)
    const connection = wsManager.getOrCreateConnection(wsUrl, sessionToken, handleStatusChange)
    
    // Add message listener
    wsManager.addMessageListener(connection, messageListener.current)
    
    // Connect with timeout handling (returns Promise now)
    wsManager.connect(connection).catch(error => {
      console.error('🎮 Connection failed:', error)
      setError(error.message)
      optionsRef.current.onError?.(error.message)
    })
    
    // Cleanup: remove listeners
    return () => {
      console.log('🎮 React cleanup: Removing listeners for', gameId)
      wsManager.removeListener(connection, handleStatusChange)
      wsManager.removeListener(connection, messageListener.current)
    }
  }, [wsUrl, sessionToken, gameId, handleStatusChange])

  // Send message function with timeout and error handling
  const send = useCallback(async (message: object, timeoutMs: number = 10000) => {
    const connection = wsManager.getOrCreateConnection(wsUrl, sessionToken)
    
    try {
      const success = await wsManager.send(connection, message, timeoutMs)
      if (!success) {
        const errorMsg = 'Failed to send message - connection not ready'
        setError(errorMsg)
        optionsRef.current.onError?.(errorMsg)
      }
      return success
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Send timeout'
      console.error('🎮 Send failed:', errorMsg)
      setError(errorMsg)
      optionsRef.current.onError?.(errorMsg)
      return false
    }
  }, [wsUrl, sessionToken])

  // Game action helpers with timeout handling
  const startGame = useCallback(async () => {
    console.log('🎮 Starting game...')
    return await send({ type: 'startGame', gameId }, 15000) // Longer timeout for game start
  }, [send, gameId])

  const addAIBot = useCallback(async (difficulty: 'easy' | 'medium' | 'hard', personality: 'aggressive' | 'balanced' | 'defensive' | 'economic') => {
    // Generate a name automatically based on personality
    const name = `${personality.charAt(0).toUpperCase() + personality.slice(1)} Bot`
    console.log('🎮 Adding AI bot:', name, difficulty, personality)
    return await send({ 
      type: 'addAIBot', 
      data: { name, difficulty, personality }
    })
  }, [send])

  const removeAIBot = useCallback(async (botPlayerId: string) => {
    console.log('🎮 Removing AI bot:', botPlayerId)
    return await send({ 
      type: 'removeAIBot', 
      data: { botPlayerId }
    })
  }, [send])

  // Connection health monitoring
  const getConnectionHealth = useCallback(() => {
    return wsManager.getConnectionHealth(wsUrl, sessionToken)
  }, [wsUrl, sessionToken])

  return {
    status,
    isConnected,
    error,
    send,
    startGame,
    addAIBot,
    removeAIBot,
    getConnectionHealth
  }
} 