import { useEffect, useState, useCallback, useRef } from 'react'
import { wsManager, type ConnectionStatus } from './websocket-connection-manager'
import type { GameAction, PlayerId, GameState, GamePhase } from '@settlers/game-engine'
import type { 
  IncomingGameMessage,
  OutgoingGameMessage,
  GameTurnMessage,
  GameStateMessage,
  GameControlMessage,
  SerializedGameState,
  GameMessageError
} from './types/game-message-types'
import {
  createGameActionMessage,
  createEndTurnMessage,
  createGameSyncRequestMessage,
  createJoinSpectatorMessage,
  createLeaveSpectatorMessage,
  isIncomingGameMessage,
  isTurnMessage,
  isGameStateMessage,
  isGameControlMessage,
  isTurnStartedData,
  isTurnEndedData,
  isTurnTimeoutData,
  isGameStateUpdateData,
  isActionResultData,
  deserializeGameState,
  createGameMessageError
} from './types/game-message-types'

interface UseGameWebSocketOptions {
  sessionToken: string
  gameId: string
  playerId?: PlayerId
  spectatorMode?: boolean
  
  // Turn management callbacks
  onTurnStarted?: (data: {
    currentPlayer: PlayerId
    previousPlayer?: PlayerId
    timeRemaining: number
    phase: GamePhase
    availableActions?: string[]
  }) => void
  onTurnEnded?: (data: {
    currentPlayer: PlayerId
    previousPlayer: PlayerId
  }) => void
  onTurnTimeout?: (data: {
    currentPlayer: PlayerId
    phase: GamePhase
  }) => void
  
  // Game state callbacks
  onGameStateUpdate?: (gameState: GameState, sequence: number) => void
  onActionResult?: (result: {
    action: GameAction
    success: boolean
    error?: string
    message?: string
  }) => void
  
  // Game control callbacks
  onGamePaused?: (reason?: string) => void
  onGameResumed?: () => void
  onGameEnded?: (winner?: PlayerId, finalState?: GameState) => void
  
  // Connection callbacks
  onConnected?: () => void
  onDisconnected?: () => void
  onError?: (error: GameMessageError) => void
  onSyncComplete?: (gameState: GameState, sequence: number) => void
}

interface GameConnectionState {
  status: ConnectionStatus
  isConnected: boolean
  error: GameMessageError | null
  lastSequence: number
  currentTurn?: {
    currentPlayer: PlayerId
    phase: GamePhase
    timeRemaining: number
    startedAt: Date
  }
  gameState?: GameState
  spectatorMode: boolean
}

/**
 * 🎮 GAME WEBSOCKET HOOK (REAL-TIME GAME COMMUNICATION)
 * 
 * Handles all real-time game communication including:
 * - Turn management (start/end/timeout)
 * - Game state synchronization
 * - Action results and validation
 * - AI turn progress
 * - Spectator mode support
 * - Connection recovery with state sync
 */
export function useGameWebSocket(options: UseGameWebSocketOptions) {
  const [connectionState, setConnectionState] = useState<GameConnectionState>({
    status: 'idle',
    isConnected: false,
    error: null,
    lastSequence: 0,
    spectatorMode: options.spectatorMode || false
  })
  
  // Use refs to avoid stale closures in callbacks
  const optionsRef = useRef(options)
  optionsRef.current = options
  
  const {
    sessionToken,
    gameId,
    playerId,
    spectatorMode = false
  } = options

  // Message handlers with proper routing
  const messageHandlers = useRef({
    // Turn management message handler
    onTurnMessage: (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data) as GameTurnMessage
        if (!isTurnMessage(message)) return

        console.log('🎮 Turn message received:', message.type, message.data)
        
        const currentOptions = optionsRef.current
        
        if (isTurnStartedData(message)) {
          // Update local turn state
          setConnectionState(prev => ({
            ...prev,
            currentTurn: {
              currentPlayer: message.data.currentPlayer,
              phase: message.data.phase,
              timeRemaining: message.data.timeRemaining,
              startedAt: new Date()
            }
          }))
          
          currentOptions.onTurnStarted?.({
            currentPlayer: message.data.currentPlayer,
            previousPlayer: message.data.previousPlayer,
            timeRemaining: message.data.timeRemaining,
            phase: message.data.phase,
            availableActions: message.data.availableActions
          })
        } else if (isTurnEndedData(message)) {
          currentOptions.onTurnEnded?.({
            currentPlayer: message.data.currentPlayer,
            previousPlayer: message.data.previousPlayer!
          })
        } else if (isTurnTimeoutData(message)) {
          currentOptions.onTurnTimeout?.({
            currentPlayer: message.data.currentPlayer,
            phase: message.data.phase
          })
        }
      } catch (error) {
        console.error('🎮 Error handling turn message:', error)
        const gameError = createGameMessageError('validation', 'Failed to process turn message')
        setConnectionState(prev => ({ ...prev, error: gameError }))
        optionsRef.current.onError?.(gameError)
      }
    },

    // Game state message handler
    onGameStateMessage: (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data) as GameStateMessage
        if (!isGameStateMessage(message)) return

        console.log('🎮 Game state message received:', message.type)
        
        const currentOptions = optionsRef.current
        
        if (isGameStateUpdateData(message) && message.data.gameState) {
          // Update sequence number
          setConnectionState(prev => ({
            ...prev,
            lastSequence: message.data.sequence,
            error: null
          }))
          
          // Deserialize and provide game state
          const gameState = deserializeGameState(message.data.gameState) as GameState
          
          // Update local game state
          setConnectionState(prev => ({
            ...prev,
            gameState
          }))
          
          currentOptions.onGameStateUpdate?.(gameState, message.data.sequence)
          
          // Check if this is a sync response
          if (message.data.sequence > 0) {
            currentOptions.onSyncComplete?.(gameState, message.data.sequence)
          }
        } else if (isActionResultData(message) && message.data.lastAction && message.data.actionResult) {
          currentOptions.onActionResult?.({
            action: message.data.lastAction,
            success: message.data.actionResult.success,
            error: message.data.actionResult.error,
            message: message.data.actionResult.message
          })
        }
      } catch (error) {
        console.error('🎮 Error handling game state message:', error)
        const gameError = createGameMessageError('validation', 'Failed to process game state message')
        setConnectionState(prev => ({ ...prev, error: gameError }))
        optionsRef.current.onError?.(gameError)
      }
    },

    // Game control message handler
    onGameControlMessage: (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data) as GameControlMessage
        if (!isGameControlMessage(message)) return

        console.log('🎮 Game control message received:', message.type)
        
        const currentOptions = optionsRef.current
        
        switch (message.type) {
          case 'gamePaused':
            currentOptions.onGamePaused?.(message.data.reason)
            break
          case 'gameResumed':
            currentOptions.onGameResumed?.()
            break
          case 'gameEnded':
            const finalState = message.data.finalState ? 
              deserializeGameState(message.data.finalState) as GameState : 
              undefined
            currentOptions.onGameEnded?.(message.data.winner, finalState)
            break
        }
      } catch (error) {
        console.error('🎮 Error handling game control message:', error)
        const gameError = createGameMessageError('validation', 'Failed to process game control message')
        setConnectionState(prev => ({ ...prev, error: gameError }))
        optionsRef.current.onError?.(gameError)
      }
    }
  })

  // Game action methods (declared early to avoid hoisting issues)
  const requestGameSync = useCallback(async (): Promise<boolean> => {
    const message = createGameSyncRequestMessage(gameId, playerId)
    const connection = wsManager.createGameConnection(gameId, sessionToken)
    
    try {
      console.log('🎮 Requesting game sync')
      const success = await wsManager.send(connection, message, 10000)
      
      if (!success) {
        const error = createGameMessageError('connection', 'Failed to request sync - connection not ready')
        setConnectionState(prev => ({ ...prev, error }))
        optionsRef.current.onError?.(error)
      }
      
      return success
    } catch (error) {
      const gameError = createGameMessageError('timeout', error instanceof Error ? error.message : 'Sync request timeout')
      console.error('🎮 Sync request failed:', gameError.message)
      setConnectionState(prev => ({ ...prev, error: gameError }))
      optionsRef.current.onError?.(gameError)
      return false
    }
  }, [gameId, playerId, sessionToken])

  // Status change handler
  const handleStatusChange = useCallback((newStatus: ConnectionStatus) => {
    console.log('🎮 Game connection status changed:', newStatus)
    
    setConnectionState(prev => ({
      ...prev,
      status: newStatus,
      isConnected: newStatus === 'connected'
    }))

    const currentOptions = optionsRef.current

    // Handle status changes
    if (newStatus === 'connected') {
      setConnectionState(prev => ({ ...prev, error: null }))
      currentOptions.onConnected?.()
      
      // Request game sync when connecting
      requestGameSync()
    } else if (newStatus === 'disconnected' || newStatus === 'error' || newStatus === 'failed') {
      currentOptions.onDisconnected?.()
      
      if (newStatus === 'error' || newStatus === 'failed') {
        const error = createGameMessageError('connection', `Connection ${newStatus}`)
        setConnectionState(prev => ({ ...prev, error }))
        currentOptions.onError?.(error)
      }
    }
  }, [])

  // Connection effect
  useEffect(() => {
    if (!sessionToken || !gameId) {
      console.log('🎮 Missing session token or game ID, skipping connection')
      return
    }
    
    console.log('🎮 Setting up game WebSocket connection for:', gameId)
    
    // Create game connection
    const connection = wsManager.createGameConnection(
      gameId,
      sessionToken,
      handleStatusChange,
      spectatorMode
    )
    
    // Add message route handlers
    wsManager.addMessageRoute(connection, /^turn/, messageHandlers.current.onTurnMessage, 'Turn messages')
    wsManager.addMessageRoute(connection, /^gameState/, messageHandlers.current.onGameStateMessage, 'Game state messages')
    wsManager.addMessageRoute(connection, 'actionResult', messageHandlers.current.onGameStateMessage, 'Action results')
    wsManager.addMessageRoute(connection, /^game(Paused|Resumed|Ended)/, messageHandlers.current.onGameControlMessage, 'Game control messages')
    
    // Connect
    wsManager.connect(connection).catch(error => {
      console.error('🎮 Game connection failed:', error)
      const gameError = createGameMessageError('connection', error.message)
      setConnectionState(prev => ({ ...prev, error: gameError }))
      optionsRef.current.onError?.(gameError)
    })
    
    // Cleanup
    return () => {
      console.log('🎮 Cleaning up game WebSocket connection')
      
      // Remove message routes
      wsManager.removeMessageRoute(connection, /^turn/, messageHandlers.current.onTurnMessage)
      wsManager.removeMessageRoute(connection, /^gameState/, messageHandlers.current.onGameStateMessage)
      wsManager.removeMessageRoute(connection, 'actionResult', messageHandlers.current.onGameStateMessage)
      wsManager.removeMessageRoute(connection, /^game(Paused|Resumed|Ended)/, messageHandlers.current.onGameControlMessage)
      
      // Disconnect
      wsManager.disconnect(connection)
    }
  }, [gameId, sessionToken, spectatorMode, handleStatusChange])

  // Send message function with validation
  const sendMessage = useCallback(async (message: OutgoingGameMessage, timeoutMs: number = 10000): Promise<boolean> => {
    const connection = wsManager.createGameConnection(gameId, sessionToken)
    
    try {
      console.log('🎮 Sending game message:', message.type, message.data)
      const success = await wsManager.send(connection, message, timeoutMs)
      
      if (!success) {
        const error = createGameMessageError('connection', 'Failed to send message - connection not ready')
        setConnectionState(prev => ({ ...prev, error }))
        optionsRef.current.onError?.(error)
      }
      
      return success
    } catch (error) {
      const gameError = createGameMessageError('timeout', error instanceof Error ? error.message : 'Send timeout')
      console.error('🎮 Send failed:', gameError.message)
      setConnectionState(prev => ({ ...prev, error: gameError }))
      optionsRef.current.onError?.(gameError)
      return false
    }
  }, [gameId, sessionToken])

  // Game action methods
  const sendGameAction = useCallback(async (action: GameAction): Promise<boolean> => {
    if (!playerId) {
      console.error('🎮 Cannot send action: no player ID')
      return false
    }
    
    const message = createGameActionMessage(gameId, playerId, action)
    return await sendMessage(message, 15000) // Longer timeout for actions
  }, [gameId, playerId, sendMessage])

  const endTurn = useCallback(async (finalAction?: GameAction): Promise<boolean> => {
    if (!playerId) {
      console.error('🎮 Cannot end turn: no player ID')
      return false
    }
    
    const message = createEndTurnMessage(gameId, playerId, finalAction)
    return await sendMessage(message, 10000)
  }, [gameId, playerId, sendMessage])

  // requestGameSync already declared above to avoid hoisting issues

  // Spectator methods
  const joinAsSpectator = useCallback(async (userId: string, userName?: string): Promise<boolean> => {
    const message = createJoinSpectatorMessage(gameId, userId, userName)
    return await sendMessage(message)
  }, [gameId, sendMessage])

  const leaveAsSpectator = useCallback(async (userId: string): Promise<boolean> => {
    const message = createLeaveSpectatorMessage(gameId, userId)
    return await sendMessage(message)
  }, [gameId, sendMessage])

  // Connection health monitoring
  const getConnectionHealth = useCallback(() => {
    const gameUrl = wsManager.createGameConnection(gameId, sessionToken)
    return wsManager.getConnectionHealth(gameUrl.url, sessionToken)
  }, [gameId, sessionToken])

  // Get remaining time for current turn
  const getRemainingTurnTime = useCallback((): number => {
    if (!connectionState.currentTurn) return 0
    
    const elapsed = Date.now() - connectionState.currentTurn.startedAt.getTime()
    return Math.max(0, connectionState.currentTurn.timeRemaining - elapsed)
  }, [connectionState.currentTurn])

  return {
    // Connection state
    status: connectionState.status,
    isConnected: connectionState.isConnected,
    error: connectionState.error,
    spectatorMode: connectionState.spectatorMode,
    
    // Game state
    gameState: connectionState.gameState,
    lastSequence: connectionState.lastSequence,
    currentTurn: connectionState.currentTurn,
    
    // Action methods
    sendGameAction,
    endTurn,
    requestGameSync,
    
    // Spectator methods
    joinAsSpectator,
    leaveAsSpectator,
    
    // Utility methods
    getConnectionHealth,
    getRemainingTurnTime,
    
    // Raw send for custom messages
    sendMessage
  }
} 