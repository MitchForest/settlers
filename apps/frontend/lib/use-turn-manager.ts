import { useEffect, useCallback, useRef } from 'react'
import { useGameWebSocket } from './use-game-websocket'
import { useTurnStore } from '@/stores/turnStore'
import { useGameStore } from '@/stores/gameStore'
import { toast } from 'sonner'
import type { GameAction, PlayerId, GameState, GamePhase } from '@settlers/game-engine'
import type { GameMessageError } from './types/game-message-types'

interface TurnManagerOptions {
  gameId: string
  sessionToken: string
  playerId?: PlayerId
  spectatorMode?: boolean
  autoStartTimer?: boolean
  enableNotifications?: boolean
  enableToasts?: boolean
}

interface TurnManagerState {
  isReady: boolean
  isConnected: boolean
  currentPhase: GamePhase | null
  isMyTurn: boolean
  canActionsExecute: boolean
  timeRemaining: number
  hasUnacknowledgedNotifications: boolean
  error: GameMessageError | null
}

/**
 * 🎮 TURN MANAGER HOOK - UNIFIED TURN MANAGEMENT
 * 
 * High-level turn management interface that integrates:
 * - Game WebSocket for real-time communication
 * - Turn Store for turn state management  
 * - Game Store for game state management
 * - Automatic timer management
 * - Notification handling
 * - Action execution with validation
 */
export function useTurnManager(options: TurnManagerOptions) {
  const {
    gameId,
    sessionToken,
    playerId,
    spectatorMode = false,
    autoStartTimer = true,
    enableNotifications = true,
    enableToasts = true
  } = options

  // Store references
  const turnStore = useTurnStore()
  const gameStore = useGameStore()

  // Track initialization
  const isInitialized = useRef(false)

  // WebSocket connection with comprehensive callbacks
  const gameWebSocket = useGameWebSocket({
    sessionToken,
    gameId,
    playerId,
    spectatorMode,
    
    // Turn management callbacks
         onTurnStarted: useCallback((data: {
       currentPlayer: PlayerId
       previousPlayer?: PlayerId
       timeRemaining: number
       phase: GamePhase
       availableActions?: string[]
     }) => {
      console.log('🎮 Turn started callback:', data)
      
      turnStore.startTurn({
        playerId: data.currentPlayer,
        phase: data.phase,
        timeRemaining: data.timeRemaining,
        availableActions: data.availableActions
      })
      
      // Update available actions in game state if needed
      if (data.availableActions) {
        turnStore.setAvailableActions(data.availableActions)
      }
      
      // Show toast notification
      if (enableToasts) {
        const isMyTurn = data.currentPlayer === playerId
        toast.info(
          isMyTurn ? 
            `Your turn! Phase: ${data.phase}` : 
            `${data.currentPlayer}'s turn (${data.phase})`
        )
      }
    }, [turnStore, playerId, enableToasts]),
    
         onTurnEnded: useCallback((data: {
       currentPlayer: PlayerId
       previousPlayer: PlayerId
     }) => {
      console.log('🎮 Turn ended callback:', data)
      
      turnStore.endTurn({
        playerId: data.previousPlayer,
        endReason: 'completed'
      })
      
      // Show toast notification
      if (enableToasts) {
        const wasMyTurn = data.previousPlayer === playerId
        toast.success(
          wasMyTurn ? 
            'Turn completed!' : 
            `${data.previousPlayer} completed their turn`
        )
      }
    }, [turnStore, playerId, enableToasts]),
    
         onTurnTimeout: useCallback((data: {
       currentPlayer: PlayerId
       phase: GamePhase
     }) => {
       console.log('🎮 Turn timeout callback:', data)
       
       turnStore.endTurn({
         playerId: data.currentPlayer,
         endReason: 'timeout',
         timeoutOccurred: true
       })
       
       // Show warning toast
       if (enableToasts) {
         const isMyTurn = data.currentPlayer === playerId
         toast.error(
           isMyTurn ? 
             'Your turn timed out!' : 
             `${data.currentPlayer}'s turn timed out`
         )
       }
     }, [turnStore, playerId, enableToasts]),
     
     // Game state callbacks
     onGameStateUpdate: useCallback((gameState: GameState, sequence: number) => {
       console.log('🎮 Game state update:', { sequence, currentPlayer: gameState.currentPlayer })
       
       // Update game store
       gameStore.setGameState(gameState)
       
       // Update turn store sync timestamp
       turnStore.setSyncTimestamp(new Date())
       
       // Check if current turn info matches
       if (gameState.currentPlayer !== turnStore.currentTurn.playerId) {
         console.warn('🎮 Turn state mismatch detected, syncing...')
         // Could trigger a re-sync here if needed
       }
     }, [gameStore, turnStore]),
     
     onActionResult: useCallback((result: {
       action: GameAction
       success: boolean
       error?: string
       message?: string
     }) => {
      console.log('🎮 Action result:', result)
      
      // Add action to turn history
      turnStore.addActionToTurn(result.action)
      
      // Show result toast
      if (enableToasts) {
        if (result.success) {
          toast.success(result.message || `${result.action.type} completed`)
        } else {
          toast.error(result.error || `${result.action.type} failed`)
        }
      }
      
      // Add notification to turn store
      if (enableNotifications) {
        turnStore.addNotification({
          type: result.success ? 'actionCompleted' : 'error',
          message: result.success ? 
            (result.message || `${result.action.type} completed`) :
            (result.error || `${result.action.type} failed`),
          autoExpire: true,
          expireAfterMs: result.success ? 2000 : 5000
        })
      }
    }, [turnStore, enableToasts, enableNotifications]),
    
    // Game control callbacks
         onGamePaused: useCallback((reason?: string) => {
       console.log('🎮 Game paused:', reason)
       turnStore.stopTimerUpdates()
       
       if (enableToasts) {
         toast.warning(`Game paused${reason ? `: ${reason}` : ''}`)
       }
     }, [turnStore, enableToasts]),
     
     onGameResumed: useCallback(() => {
       console.log('🎮 Game resumed')
       if (autoStartTimer) {
         turnStore.startTimerUpdates()
       }
       
       if (enableToasts) {
         toast.success('Game resumed')
       }
     }, [turnStore, autoStartTimer, enableToasts]),
     
     onGameEnded: useCallback((winner?: PlayerId, finalState?: GameState) => {
      console.log('🎮 Game ended:', { winner })
      turnStore.stopTimerUpdates()
      turnStore.cleanup()
      
      if (enableToasts) {
        if (winner) {
          const isWinner = winner === playerId
          toast.success(
            isWinner ? 
              'Congratulations! You won!' : 
              `Game Over - ${winner} wins!`
          )
        } else {
          toast.info('Game ended')
        }
      }
      
      if (finalState) {
        gameStore.setGameState(finalState)
      }
    }, [turnStore, gameStore, playerId, enableToasts]),
    
    // Connection callbacks
    onConnected: useCallback(() => {
      console.log('🎮 Game WebSocket connected')
      turnStore.setConnectionState(true)
      
      if (enableToasts) {
        toast.success('Connected to game')
      }
    }, [turnStore, enableToasts]),
    
    onDisconnected: useCallback(() => {
      console.log('🎮 Game WebSocket disconnected')
      turnStore.setConnectionState(false)
      turnStore.stopTimerUpdates()
      
      if (enableToasts) {
        toast.warning('Disconnected from game')
      }
    }, [turnStore, enableToasts]),
    
    onError: useCallback((error: GameMessageError) => {
      console.error('🎮 Game WebSocket error:', error)
      turnStore.setConnectionState(false, error)
      
      if (enableToasts) {
        toast.error(`Connection error: ${error.message}`)
      }
      
      if (enableNotifications) {
        turnStore.addNotification({
          type: 'error',
          message: `Connection error: ${error.message}`,
          autoExpire: false
        })
      }
    }, [turnStore, enableToasts, enableNotifications]),
    
         onSyncComplete: useCallback((gameState: GameState, sequence: number) => {
      console.log('🎮 Game sync complete:', { sequence })
      turnStore.setSyncTimestamp(new Date())
      
      if (enableToasts) {
        toast.success('Game state synchronized')
      }
    }, [turnStore, enableToasts])
  })

  // Initialize turn store with game info
  useEffect(() => {
    if (!isInitialized.current && gameId && playerId) {
      console.log('🎮 Initializing turn manager:', { gameId, playerId })
      
      turnStore.setGameInfo(gameId, playerId)
      
      if (autoStartTimer) {
        turnStore.startTimerUpdates()
      }
      
      isInitialized.current = true
    }
  }, [gameId, playerId, turnStore, autoStartTimer])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('🎮 Turn manager cleanup')
      turnStore.stopTimerUpdates()
      turnStore.cleanup()
    }
  }, [turnStore])

  // Action execution with validation
  const executeAction = useCallback(async (action: GameAction): Promise<boolean> => {
    console.log('🎮 Executing action:', action)
    
    // Validate turn state
    if (!turnStore.currentTurn.isActive) {
      const error = 'No active turn'
      console.error('🎮 Action validation failed:', error)
      
      if (enableToasts) {
        toast.error(error)
      }
      return false
    }
    
    if (!turnStore.currentTurn.isMyTurn) {
      const error = 'Not your turn'
      console.error('🎮 Action validation failed:', error)
      
      if (enableToasts) {
        toast.error(error)
      }
      return false
    }
    
    // Check if action is available
    const availableActions = turnStore.currentTurn.availableActions
    if (availableActions.length > 0 && !availableActions.includes(action.type)) {
      const error = `Action ${action.type} not available in current phase`
      console.error('🎮 Action validation failed:', error)
      
      if (enableToasts) {
        toast.error(error)
      }
      return false
    }
    
    // Execute action via WebSocket
    try {
      const success = await gameWebSocket.sendGameAction(action)
      
      if (!success) {
        if (enableToasts) {
          toast.error('Failed to send action')
        }
      }
      
      return success
    } catch (error) {
      console.error('🎮 Action execution error:', error)
      
      if (enableToasts) {
        toast.error('Action execution failed')
      }
      return false
    }
  }, [turnStore, gameWebSocket, enableToasts])

  // End turn with validation
  const endTurn = useCallback(async (finalAction?: GameAction): Promise<boolean> => {
    console.log('🎮 Ending turn:', { finalAction })
    
    // Validate turn state
    if (!turnStore.currentTurn.isActive || !turnStore.currentTurn.isMyTurn) {
      const error = 'Cannot end turn: not your active turn'
      console.error('🎮 End turn validation failed:', error)
      
      if (enableToasts) {
        toast.error(error)
      }
      return false
    }
    
    if (!turnStore.currentTurn.canEndTurn) {
      const error = 'Cannot end turn: pending actions required'
      console.error('🎮 End turn validation failed:', error)
      
      if (enableToasts) {
        toast.error(error)
      }
      return false
    }
    
    try {
      const success = await gameWebSocket.endTurn(finalAction)
      
      if (!success) {
        if (enableToasts) {
          toast.error('Failed to end turn')
        }
      }
      
      return success
    } catch (error) {
      console.error('🎮 End turn error:', error)
      
      if (enableToasts) {
        toast.error('End turn failed')
      }
      return false
    }
  }, [turnStore, gameWebSocket, enableToasts])

  // Request game state sync
  const requestSync = useCallback(async (): Promise<boolean> => {
    console.log('🎮 Requesting game sync')
    
    try {
      const success = await gameWebSocket.requestGameSync()
      
      if (!success && enableToasts) {
        toast.error('Failed to sync game state')
      }
      
      return success
    } catch (error) {
      console.error('🎮 Sync request error:', error)
      
      if (enableToasts) {
        toast.error('Sync request failed')
      }
      return false
    }
  }, [gameWebSocket, enableToasts])

  // Get current turn manager state
  const getTurnManagerState = useCallback((): TurnManagerState => {
    return {
      isReady: isInitialized.current && gameWebSocket.isConnected,
      isConnected: gameWebSocket.isConnected,
      currentPhase: turnStore.currentTurn.phase,
      isMyTurn: turnStore.currentTurn.isMyTurn,
      canActionsExecute: turnStore.currentTurn.isActive && turnStore.currentTurn.isMyTurn,
      timeRemaining: turnStore.getRemainingTime(),
      hasUnacknowledgedNotifications: turnStore.getUnacknowledgedNotifications().length > 0,
      error: gameWebSocket.error || turnStore.syncError
    }
  }, [gameWebSocket, turnStore])

  // Notification management
  const acknowledgeNotification = useCallback((id: string) => {
    turnStore.acknowledgeNotification(id)
  }, [turnStore])

  const clearAllNotifications = useCallback(() => {
    turnStore.clearNotifications()
  }, [turnStore])

  // Timer management
  const startTimer = useCallback(() => {
    turnStore.startTimerUpdates()
  }, [turnStore])

  const stopTimer = useCallback(() => {
    turnStore.stopTimerUpdates()
  }, [turnStore])

  return {
    // State
    ...getTurnManagerState(),
    
    // Turn store data
    currentTurn: turnStore.currentTurn,
    aiTurn: turnStore.aiTurn,
    turnHistory: turnStore.turnHistory,
    notifications: turnStore.notifications,
    
    // Game WebSocket data
    gameState: gameWebSocket.gameState,
    lastSequence: gameWebSocket.lastSequence,
    spectatorMode: gameWebSocket.spectatorMode,
    
    // Actions
    executeAction,
    endTurn,
    requestSync,
    
    // Notification management
    acknowledgeNotification,
    clearAllNotifications,
    getUnacknowledgedNotifications: turnStore.getUnacknowledgedNotifications,
    
    // Timer management
    startTimer,
    stopTimer,
    getRemainingTime: turnStore.getRemainingTime,
    getTurnDuration: turnStore.getTurnDuration,
    
    // Spectator actions (if in spectator mode)
    joinAsSpectator: gameWebSocket.joinAsSpectator,
    leaveAsSpectator: gameWebSocket.leaveAsSpectator,
    
    // Raw WebSocket access for advanced usage
    sendMessage: gameWebSocket.sendMessage,
    getConnectionHealth: gameWebSocket.getConnectionHealth
  }
} 