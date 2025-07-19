import { useEffect, useState, useCallback } from 'react'
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
 * 🎮 LOBBY WEBSOCKET HOOK
 * 
 * Uses external WebSocket manager - React just observes state.
 * The actual WebSocket lives outside React lifecycle.
 */
export function useLobbyWebSocket(options: UseLobbyWebSocketOptions) {
  const [status, setStatus] = useState<ConnectionStatus>('idle')
  const [isConnected, setIsConnected] = useState(false)
  
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

  // Message handler
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data)
      console.log('🎮 Lobby message:', data.type)
      
      switch (data.type) {
        case 'lobbyJoined':
          onLobbyJoined?.({
            gameCode: data.gameCode,
            players: data.players,
            isHost: data.isHost,
            canStart: data.canStart
          })
          break
          
        case 'lobbyUpdate':
          onLobbyUpdate?.(data.players, data.canStart)
          break
          
        case 'gameStarted':
          onGameStarted?.()
          break
          
        case 'error':
          const errorMessage = data?.error || 'Unknown error'
          console.error('🎮 Server error:', errorMessage)
          onError?.(errorMessage)
          break
          
        default:
          console.log('🎮 Unhandled message type:', data.type)
      }
    } catch (error) {
      console.error('🎮 Failed to parse message:', error)
    }
  }, [onLobbyJoined, onLobbyUpdate, onGameStarted, onError])

  // Status change handler
  const handleStatusChange = useCallback((newStatus: ConnectionStatus, ws?: WebSocket) => {
    console.log('🎮 Connection status changed:', newStatus)
    setStatus(newStatus)
    setIsConnected(newStatus === 'connected')

    // Set up message listener and auto-join when connected
    if (newStatus === 'connected' && ws) {
      // Remove any existing listener first
      ws.onmessage = handleMessage
      
      // Auto-join the game lobby
      console.log('🎮 Auto-joining game lobby:', gameId)
      ws.send(JSON.stringify({
        type: 'joinLobby',
        gameId: gameId
      }))
    }
  }, [handleMessage, gameId])

  // Connect effect - this is the ONLY thing React does
  useEffect(() => {
    if (!sessionToken) {
      console.log('🎮 No session token yet, skipping WebSocket connection')
      return
    }
    
    console.log('🎮 React effect: Getting connection for', gameId, 'with token length:', sessionToken.length)
    
    // Get or create connection (idempotent)
    const connection = wsManager.getOrCreateConnection(wsUrl, sessionToken, handleStatusChange)
    
    // Connect if needed (idempotent)
    wsManager.connect(connection)
    
    // Cleanup: just remove our listener
    return () => {
      console.log('🎮 React cleanup: Removing listener for', gameId)
      wsManager.removeListener(connection, handleStatusChange)
    }
  }, [wsUrl, sessionToken, gameId, handleStatusChange])

  // Send message function
  const send = useCallback((message: object) => {
    const connection = wsManager.getOrCreateConnection(wsUrl, sessionToken)
    return wsManager.send(connection, message)
  }, [wsUrl, sessionToken])

  // Game action helpers
  const startGame = useCallback(() => {
    return send({ type: 'startGame', gameId })
  }, [send, gameId])

  const addAIBot = useCallback((difficulty: 'easy' | 'medium' | 'hard', personality: 'aggressive' | 'balanced' | 'defensive' | 'economic') => {
    return send({ type: 'addAIBot', difficulty, personality })
  }, [send])

  const removeAIBot = useCallback((botPlayerId: string) => {
    return send({ type: 'removeAIBot', botPlayerId })
  }, [send])

  return {
    status,
    isConnected,
    send,
    startGame,
    addAIBot,
    removeAIBot
  }
} 