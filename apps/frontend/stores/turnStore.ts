import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { subscribeWithSelector } from 'zustand/middleware'
import type { PlayerId, GamePhase, GameAction } from '@settlers/game-engine'
import type { GameMessageError } from '../lib/types/game-message-types'

// Turn timing configuration
interface TurnTiming {
  phase: GamePhase
  startedAt: Date
  durationMs: number
  remainingMs: number
  lastUpdate: Date
}

// Turn history entry
interface TurnHistoryEntry {
  id: string
  turnNumber: number
  playerId: PlayerId
  phase: GamePhase
  actions: GameAction[]
  startedAt: Date
  endedAt?: Date
  durationMs?: number
  endReason: 'completed' | 'timeout' | 'forced' | 'disconnected'
  timeoutOccurred: boolean
}

// AI turn status
interface AITurnStatus {
  isAITurn: boolean
  aiPlayerId?: PlayerId
  aiThinking: boolean
  aiActionDescription?: string
  estimatedRemainingMs?: number
  aiDifficulty?: 'easy' | 'medium' | 'hard'
  aiPersonality?: 'aggressive' | 'balanced' | 'defensive' | 'economic'
}

// Current turn state
interface CurrentTurnState {
  isActive: boolean
  playerId: PlayerId | null
  phase: GamePhase | null
  turnNumber: number
  timing: TurnTiming | null
  availableActions: string[]
  actionsThisTurn: GameAction[]
  canEndTurn: boolean
  isMyTurn: boolean
  localPlayerId: PlayerId | null
}

// Turn notifications
interface TurnNotification {
  id: string
  type: 'turnStarted' | 'turnEnded' | 'turnTimeout' | 'phaseChanged' | 'actionCompleted' | 'error'
  message: string
  playerId?: PlayerId
  timestamp: Date
  acknowledged: boolean
  autoExpire?: boolean
  expireAfterMs?: number
}

interface TurnStore {
  // Current turn state
  currentTurn: CurrentTurnState
  
  // AI turn state
  aiTurn: AITurnStatus
  
  // Turn history
  turnHistory: TurnHistoryEntry[]
  maxHistorySize: number
  
  // Turn notifications
  notifications: TurnNotification[]
  maxNotifications: number
  
  // Connection state
  isConnected: boolean
  lastSyncTimestamp: Date | null
  syncError: GameMessageError | null
  
  // Game state references
  gameId: string | null
  localPlayerId: PlayerId | null
  
  // Timer management
  timerInterval: NodeJS.Timeout | null
  
  // Actions - Turn Management
  startTurn: (data: {
    playerId: PlayerId
    phase: GamePhase
    turnNumber?: number
    timeRemaining: number
    availableActions?: string[]
  }) => void
  
  endTurn: (data: {
    playerId: PlayerId
    endReason: TurnHistoryEntry['endReason']
    timeoutOccurred?: boolean
  }) => void
  
  updateTurnTimer: (remainingMs: number) => void
  
  // Actions - AI Management
  setAITurnStatus: (status: Partial<AITurnStatus>) => void
  
  // Actions - Turn History
  addTurnToHistory: (turn: Omit<TurnHistoryEntry, 'id'>) => void
  clearTurnHistory: () => void
  
  // Actions - Notifications
  addNotification: (notification: Omit<TurnNotification, 'id' | 'timestamp' | 'acknowledged'>) => void
  acknowledgeNotification: (id: string) => void
  clearNotifications: () => void
  clearExpiredNotifications: () => void
  
  // Actions - Connection Management
  setConnectionState: (connected: boolean, error?: GameMessageError) => void
  setSyncTimestamp: (timestamp: Date) => void
  
  // Actions - Game Management
  setGameInfo: (gameId: string, localPlayerId: PlayerId) => void
  addActionToTurn: (action: GameAction) => void
  setAvailableActions: (actions: string[]) => void
  setCanEndTurn: (canEnd: boolean) => void
  
  // Actions - Phase Management
  changePhase: (newPhase: GamePhase, newTimeRemaining?: number) => void
  
  // Utilities
  getRemainingTime: () => number
  getTurnDuration: () => number
  getIsMyTurn: () => boolean
  getCurrentTurnEntry: () => TurnHistoryEntry | null
  getUnacknowledgedNotifications: () => TurnNotification[]
  
  // Cleanup
  cleanup: () => void
  startTimerUpdates: () => void
  stopTimerUpdates: () => void
}

export const useTurnStore = create<TurnStore>()(
  subscribeWithSelector(
    immer((set, get) => ({
      // Initial state
      currentTurn: {
        isActive: false,
        playerId: null,
        phase: null,
        turnNumber: 0,
        timing: null,
        availableActions: [],
        actionsThisTurn: [],
        canEndTurn: false,
        isMyTurn: false,
        localPlayerId: null
      },
      
      aiTurn: {
        isAITurn: false,
        aiThinking: false
      },
      
      turnHistory: [],
      maxHistorySize: 50,
      
      notifications: [],
      maxNotifications: 20,
      
      isConnected: false,
      lastSyncTimestamp: null,
      syncError: null,
      
      gameId: null,
      localPlayerId: null,
      
      timerInterval: null,
      
      // Actions - Turn Management
      startTurn: (data) => set((state) => {
        const { playerId, phase, turnNumber = state.currentTurn.turnNumber + 1, timeRemaining, availableActions = [] } = data
        
        console.log(`🎮 Turn started: ${playerId} (phase: ${phase}, ${timeRemaining}ms)`)
        
        // End previous turn if exists
        if (state.currentTurn.isActive && state.currentTurn.playerId) {
          const prevTurnEntry: TurnHistoryEntry = {
            id: `turn_${state.currentTurn.turnNumber}_${state.currentTurn.playerId}_${Date.now()}`,
            turnNumber: state.currentTurn.turnNumber,
            playerId: state.currentTurn.playerId,
            phase: state.currentTurn.phase!,
            actions: [...state.currentTurn.actionsThisTurn],
            startedAt: state.currentTurn.timing!.startedAt,
            endedAt: new Date(),
            endReason: 'completed',
            timeoutOccurred: false
          }
                     prevTurnEntry.durationMs = prevTurnEntry.endedAt!.getTime() - prevTurnEntry.startedAt.getTime()
          
          // Add to history
          state.turnHistory.unshift(prevTurnEntry)
          if (state.turnHistory.length > state.maxHistorySize) {
            state.turnHistory = state.turnHistory.slice(0, state.maxHistorySize)
          }
        }
        
        // Set up new turn
        const now = new Date()
        const isMyTurn = playerId === state.localPlayerId
        const isAITurn = playerId.startsWith('ai_') || playerId.includes('bot')
        
        state.currentTurn = {
          isActive: true,
          playerId,
          phase,
          turnNumber,
          timing: {
            phase,
            startedAt: now,
            durationMs: timeRemaining,
            remainingMs: timeRemaining,
            lastUpdate: now
          },
          availableActions: [...availableActions],
          actionsThisTurn: [],
          canEndTurn: availableActions.includes('endTurn'),
          isMyTurn,
          localPlayerId: state.localPlayerId
        }
        
        // Update AI turn status
        state.aiTurn = {
          isAITurn,
          aiPlayerId: isAITurn ? playerId : undefined,
          aiThinking: isAITurn,
          estimatedRemainingMs: isAITurn ? Math.min(timeRemaining, 5000) : undefined // AI usually acts within 5s
        }
        
        // Add notification
        const notification: TurnNotification = {
          id: `turn_start_${playerId}_${Date.now()}`,
          type: 'turnStarted',
          message: isMyTurn ? 'Your turn!' : `${playerId}'s turn`,
          playerId,
          timestamp: now,
          acknowledged: false,
          autoExpire: true,
          expireAfterMs: 3000
        }
        
        state.notifications.unshift(notification)
        if (state.notifications.length > state.maxNotifications) {
          state.notifications = state.notifications.slice(0, state.maxNotifications)
        }
      }),
      
      endTurn: (data) => set((state) => {
        const { playerId, endReason, timeoutOccurred = false } = data
        
        if (!state.currentTurn.isActive || state.currentTurn.playerId !== playerId) {
          console.warn(`🎮 Cannot end turn: no active turn for ${playerId}`)
          return
        }
        
        console.log(`🎮 Turn ended: ${playerId} (reason: ${endReason})`)
        
        const now = new Date()
        const turnEntry: TurnHistoryEntry = {
          id: `turn_${state.currentTurn.turnNumber}_${playerId}_${Date.now()}`,
          turnNumber: state.currentTurn.turnNumber,
          playerId,
          phase: state.currentTurn.phase!,
          actions: [...state.currentTurn.actionsThisTurn],
          startedAt: state.currentTurn.timing!.startedAt,
          endedAt: now,
          endReason,
          timeoutOccurred
        }
                 turnEntry.durationMs = turnEntry.endedAt!.getTime() - turnEntry.startedAt.getTime()
        
        // Add to history
        state.turnHistory.unshift(turnEntry)
        if (state.turnHistory.length > state.maxHistorySize) {
          state.turnHistory = state.turnHistory.slice(0, state.maxHistorySize)
        }
        
        // Clear current turn
        state.currentTurn.isActive = false
        state.currentTurn.playerId = null
        state.currentTurn.phase = null
        state.currentTurn.timing = null
        state.currentTurn.actionsThisTurn = []
        state.currentTurn.canEndTurn = false
        state.currentTurn.isMyTurn = false
        
        // Clear AI turn status
        state.aiTurn.isAITurn = false
        state.aiTurn.aiPlayerId = undefined
        state.aiTurn.aiThinking = false
        state.aiTurn.aiActionDescription = undefined
        state.aiTurn.estimatedRemainingMs = undefined
        
        // Add notification
        const isMyTurn = playerId === state.localPlayerId
        const notification: TurnNotification = {
          id: `turn_end_${playerId}_${Date.now()}`,
          type: 'turnEnded',
          message: timeoutOccurred ? 
            (isMyTurn ? 'Your turn timed out!' : `${playerId}'s turn timed out`) :
            (isMyTurn ? 'Turn completed' : `${playerId} completed their turn`),
          playerId,
          timestamp: now,
          acknowledged: false,
          autoExpire: true,
          expireAfterMs: 2000
        }
        
        state.notifications.unshift(notification)
        if (state.notifications.length > state.maxNotifications) {
          state.notifications = state.notifications.slice(0, state.maxNotifications)
        }
      }),
      
      updateTurnTimer: (remainingMs) => set((state) => {
        if (state.currentTurn.timing) {
          state.currentTurn.timing.remainingMs = remainingMs
          state.currentTurn.timing.lastUpdate = new Date()
        }
      }),
      
      // Actions - AI Management
      setAITurnStatus: (status) => set((state) => {
        Object.assign(state.aiTurn, status)
      }),
      
      // Actions - Turn History
      addTurnToHistory: (turn) => set((state) => {
        const turnEntry: TurnHistoryEntry = {
          ...turn,
          id: `turn_${turn.turnNumber}_${turn.playerId}_${Date.now()}`
        }
        
        state.turnHistory.unshift(turnEntry)
        if (state.turnHistory.length > state.maxHistorySize) {
          state.turnHistory = state.turnHistory.slice(0, state.maxHistorySize)
        }
      }),
      
      clearTurnHistory: () => set((state) => {
        state.turnHistory = []
      }),
      
      // Actions - Notifications
      addNotification: (notification) => set((state) => {
        const fullNotification: TurnNotification = {
          ...notification,
          id: `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date(),
          acknowledged: false
        }
        
        state.notifications.unshift(fullNotification)
        if (state.notifications.length > state.maxNotifications) {
          state.notifications = state.notifications.slice(0, state.maxNotifications)
        }
      }),
      
      acknowledgeNotification: (id) => set((state) => {
        const notification = state.notifications.find(n => n.id === id)
        if (notification) {
          notification.acknowledged = true
        }
      }),
      
      clearNotifications: () => set((state) => {
        state.notifications = []
      }),
      
      clearExpiredNotifications: () => set((state) => {
        const now = Date.now()
        state.notifications = state.notifications.filter(notification => {
          if (!notification.autoExpire || !notification.expireAfterMs) return true
          const expireTime = notification.timestamp.getTime() + notification.expireAfterMs
          return now < expireTime
        })
      }),
      
      // Actions - Connection Management
      setConnectionState: (connected, error) => set((state) => {
        state.isConnected = connected
        state.syncError = error || null
        if (connected) {
          state.lastSyncTimestamp = new Date()
        }
      }),
      
      setSyncTimestamp: (timestamp) => set((state) => {
        state.lastSyncTimestamp = timestamp
      }),
      
      // Actions - Game Management
      setGameInfo: (gameId, localPlayerId) => set((state) => {
        state.gameId = gameId
        state.localPlayerId = localPlayerId
        state.currentTurn.localPlayerId = localPlayerId
      }),
      
      addActionToTurn: (action) => set((state) => {
        if (state.currentTurn.isActive) {
          state.currentTurn.actionsThisTurn.push(action)
          
          // Add notification for completed action
          const notification: TurnNotification = {
            id: `action_${action.type}_${Date.now()}`,
            type: 'actionCompleted',
            message: `Action completed: ${action.type}`,
            timestamp: new Date(),
            acknowledged: false,
            autoExpire: true,
            expireAfterMs: 1500
          }
          
          state.notifications.unshift(notification)
          if (state.notifications.length > state.maxNotifications) {
            state.notifications = state.notifications.slice(0, state.maxNotifications)
          }
        }
      }),
      
      setAvailableActions: (actions) => set((state) => {
        state.currentTurn.availableActions = [...actions]
        state.currentTurn.canEndTurn = actions.includes('endTurn')
      }),
      
      setCanEndTurn: (canEnd) => set((state) => {
        state.currentTurn.canEndTurn = canEnd
      }),
      
      // Actions - Phase Management
      changePhase: (newPhase, newTimeRemaining) => set((state) => {
        if (state.currentTurn.timing) {
          const oldPhase = state.currentTurn.phase
          state.currentTurn.phase = newPhase
          state.currentTurn.timing.phase = newPhase
          
          if (newTimeRemaining !== undefined) {
            state.currentTurn.timing.remainingMs = newTimeRemaining
            state.currentTurn.timing.durationMs = newTimeRemaining
            state.currentTurn.timing.lastUpdate = new Date()
          }
          
          // Add notification for phase change
          const notification: TurnNotification = {
            id: `phase_change_${newPhase}_${Date.now()}`,
            type: 'phaseChanged',
            message: `Phase changed: ${oldPhase} → ${newPhase}`,
            timestamp: new Date(),
            acknowledged: false,
            autoExpire: true,
            expireAfterMs: 2000
          }
          
          state.notifications.unshift(notification)
          if (state.notifications.length > state.maxNotifications) {
            state.notifications = state.notifications.slice(0, state.maxNotifications)
          }
        }
      }),
      
      // Utilities
      getRemainingTime: () => {
        const state = get()
        if (!state.currentTurn.timing) return 0
        
        const now = Date.now()
        const lastUpdate = state.currentTurn.timing.lastUpdate.getTime()
        const elapsed = now - lastUpdate
        return Math.max(0, state.currentTurn.timing.remainingMs - elapsed)
      },
      
      getTurnDuration: () => {
        const state = get()
        if (!state.currentTurn.timing) return 0
        
        const now = Date.now()
        const started = state.currentTurn.timing.startedAt.getTime()
        return now - started
      },
      
      getIsMyTurn: () => {
        const state = get()
        return state.currentTurn.isMyTurn
      },
      
      getCurrentTurnEntry: () => {
        const state = get()
        if (!state.currentTurn.isActive || !state.currentTurn.playerId || !state.currentTurn.timing) {
          return null
        }
        
        return {
          id: `current_turn_${state.currentTurn.turnNumber}_${state.currentTurn.playerId}`,
          turnNumber: state.currentTurn.turnNumber,
          playerId: state.currentTurn.playerId,
          phase: state.currentTurn.phase!,
          actions: [...state.currentTurn.actionsThisTurn],
          startedAt: state.currentTurn.timing.startedAt,
          endReason: 'completed' as const,
          timeoutOccurred: false
        }
      },
      
      getUnacknowledgedNotifications: () => {
        const state = get()
        return state.notifications.filter(n => !n.acknowledged)
      },
      
      // Cleanup
      cleanup: () => set((state) => {
        if (state.timerInterval) {
          clearInterval(state.timerInterval)
          state.timerInterval = null
        }
        
        state.currentTurn.isActive = false
        state.currentTurn.playerId = null
        state.aiTurn.isAITurn = false
        state.aiTurn.aiThinking = false
        state.notifications = []
      }),
      
      startTimerUpdates: () => set((state) => {
        if (state.timerInterval) {
          clearInterval(state.timerInterval)
        }
        
        state.timerInterval = setInterval(() => {
          const currentState = get()
          if (currentState.currentTurn.timing) {
            const remainingTime = currentState.getRemainingTime()
            currentState.updateTurnTimer(remainingTime)
            
            // Auto-clear expired notifications
            currentState.clearExpiredNotifications()
            
            // Check for turn timeout
            if (remainingTime <= 0 && currentState.currentTurn.isActive) {
              console.log('🎮 Turn timer expired')
              const notification: TurnNotification = {
                id: `timeout_${currentState.currentTurn.playerId}_${Date.now()}`,
                type: 'turnTimeout',
                message: currentState.currentTurn.isMyTurn ? 
                  'Your turn has timed out!' : 
                  `${currentState.currentTurn.playerId}'s turn timed out`,
                playerId: currentState.currentTurn.playerId!,
                timestamp: new Date(),
                acknowledged: false
              }
              currentState.addNotification(notification)
            }
          }
        }, 100) // Update every 100ms for smooth countdown
      }),
      
      stopTimerUpdates: () => set((state) => {
        if (state.timerInterval) {
          clearInterval(state.timerInterval)
          state.timerInterval = null
        }
      })
    }))
  )
)

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    useTurnStore.getState().cleanup()
  })
} 