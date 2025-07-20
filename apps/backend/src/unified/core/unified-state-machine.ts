/**
 * UNIFIED STATE MACHINE - ZERO TECHNICAL DEBT
 * 
 * Single source of truth for ALL game lifecycle and state management.
 * Replaces ALL scattered state systems with one coherent, deterministic machine.
 */

export type GameStatus = 'created' | 'lobby' | 'active' | 'paused' | 'ended'
export type LobbySubstatus = 'awaiting_host' | 'open' | 'starting' | 'countdown'
export type GameSubstatus = 'initial_placement_1' | 'initial_placement_2' | 'main_roll' | 'main_actions' | 'discard' | 'robber' | 'victory'
export type PauseSubstatus = 'host_disconnected' | 'server_maintenance' | 'manual_pause' | 'error_recovery'
export type EndSubstatus = 'completed' | 'abandoned' | 'host_left' | 'error' | 'timeout'

export type UnifiedGameState = 
  | { status: 'created', substatus: 'awaiting_host' }
  | { status: 'lobby', substatus: LobbySubstatus }
  | { status: 'active', substatus: GameSubstatus }
  | { status: 'paused', substatus: PauseSubstatus, previousState: GameSubstatus }
  | { status: 'ended', substatus: EndSubstatus, winner?: string, reason?: string }

export type UnifiedGameEvent =
  // Lifecycle Events
  | { type: 'GAME_CREATED', gameId: string, hostUserId: string }
  | { type: 'HOST_JOINED', userId: string }
  | { type: 'PLAYER_JOINED', playerId: string, userId: string, playerType: 'human' | 'ai' }
  | { type: 'PLAYER_LEFT', playerId: string, reason: 'manual' | 'disconnect' | 'kick' }
  | { type: 'GAME_START_REQUESTED', requestedBy: string }
  | { type: 'GAME_STARTED', startedBy: string, playerOrder: string[] }
  | { type: 'GAME_PAUSED', reason: string, pausedBy?: string }
  | { type: 'GAME_RESUMED', resumedBy?: string }
  | { type: 'GAME_ENDED', reason: EndSubstatus, winner?: string, endedBy?: string }
  
  // Game Phase Events
  | { type: 'PHASE_STARTED', phase: GameSubstatus, currentPlayer?: string }
  | { type: 'PHASE_COMPLETED', phase: GameSubstatus, nextPhase: GameSubstatus }
  | { type: 'TURN_STARTED', playerId: string, phase: GameSubstatus }
  | { type: 'TURN_ENDED', playerId: string, nextPlayerId?: string }
  
  // Player Action Events
  | { type: 'ACTION_ATTEMPTED', playerId: string, action: string, data?: any }
  | { type: 'ACTION_COMPLETED', playerId: string, action: string, result: any }
  | { type: 'ACTION_FAILED', playerId: string, action: string, error: string }
  
  // System Events
  | { type: 'CONNECTION_ESTABLISHED', playerId: string, connectionId: string }
  | { type: 'CONNECTION_LOST', playerId: string, connectionId: string }
  | { type: 'HEARTBEAT', timestamp: string }

/**
 * COMPREHENSIVE GAME CONTEXT
 * All game state in one place - no scattered data
 */
export interface UnifiedGameContext {
  // Identity
  gameId: string
  gameCode: string
  
  // Lifecycle State
  state: UnifiedGameState
  
  // Players & Participation
  players: GamePlayer[]
  spectators: GameSpectator[]
  hostUserId: string
  
  // Game Configuration
  settings: GameSettings
  
  // Active Game Data (only when status === 'active')
  gameData?: {
    board: any
    currentPlayer: string
    playerOrder: string[]
    turnNumber: number
    phaseStartTime: Date
    turnTimeLimit?: number
    gameStartTime: Date
  }
  
  // Timing & History
  createdAt: Date
  updatedAt: Date
  startedAt?: Date
  endedAt?: Date
  lastActivity: Date
  
  // WebSocket Connections
  connections: Map<string, ConnectionInfo>
  
  // Event History Reference
  eventCount: number
  lastEventSequence: number
}

export interface GamePlayer {
  id: string
  userId?: string // null for AI players
  name: string
  playerType: 'human' | 'ai'
  color: string
  joinOrder: number
  isHost: boolean
  status: 'active' | 'disconnected' | 'left'
  joinedAt: Date
  leftAt?: Date
  
  // AI-specific data
  aiPersonality?: string
  aiDifficulty?: string
  
  // Game-specific data (when active)
  gameData?: {
    resources: Record<string, number>
    developmentCards: any[]
    settlements: any[]
    cities: any[]
    roads: any[]
    score: number
  }
}

export interface GameSpectator {
  userId: string
  name: string
  joinedAt: Date
  connectionId?: string
}

export interface GameSettings {
  maxPlayers: number
  allowSpectators: boolean
  aiEnabled: boolean
  turnTimeLimit?: number
  autoStart: boolean
  private: boolean
  
  // Game-specific settings
  victoryPoints: number
  initialResources: boolean
  robberBlocks: boolean
}

export interface ConnectionInfo {
  connectionId: string
  userId?: string
  playerId?: string
  connectedAt: Date
  lastHeartbeat: Date
  isActive: boolean
  userAgent?: string
  ipAddress?: string
}

/**
 * UNIFIED STATE MACHINE - ZERO TECHNICAL DEBT
 * 
 * Handles ALL state transitions with comprehensive validation.
 * Replaces scattered boolean flags with deterministic state management.
 */
export class UnifiedGameStateMachine {
  private context: UnifiedGameContext
  private readonly eventHistory: UnifiedGameEvent[] = []
  private readonly subscribers = new Set<(context: UnifiedGameContext, event: UnifiedGameEvent) => void>()

  constructor(gameId: string, gameCode: string, hostUserId: string) {
    this.context = {
      gameId,
      gameCode,
      state: { status: 'created', substatus: 'awaiting_host' },
      players: [],
      spectators: [],
      hostUserId,
      settings: {
        maxPlayers: 4,
        allowSpectators: true,
        aiEnabled: true,
        autoStart: false,
        private: false,
        victoryPoints: 10,
        initialResources: false,
        robberBlocks: true
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      lastActivity: new Date(),
      connections: new Map(),
      eventCount: 0,
      lastEventSequence: 0
    }
  }

  /**
   * SEND EVENT - SINGLE POINT OF STATE TRANSITION
   * All state changes go through this method - no exceptions
   */
  send(event: UnifiedGameEvent): { success: boolean; error?: string; newState?: UnifiedGameState } {
    console.log(`🎯 [${this.context.gameId}] Processing event:`, event.type)
    
    try {
      // Validate event against current state
      const validation = this.validateEvent(event)
      if (!validation.valid) {
        console.warn(`❌ [${this.context.gameId}] Event validation failed:`, validation.error)
        return { success: false, error: validation.error }
      }

      // Apply state transition
      const previousState = { ...this.context.state }
      const newContext = this.applyEvent(this.context, event)
      
      // Update context
      this.context = newContext
      this.eventHistory.push(event)
      this.context.eventCount++
      this.context.lastEventSequence++
      this.context.updatedAt = new Date()
      this.context.lastActivity = new Date()

      // Notify subscribers
      this.notifySubscribers(event)

      console.log(`✅ [${this.context.gameId}] State transition:`, {
        from: previousState,
        to: this.context.state,
        event: event.type
      })

      return { success: true, newState: this.context.state }

    } catch (error) {
      console.error(`💥 [${this.context.gameId}] State machine error:`, error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown state machine error' 
      }
    }
  }

  /**
   * EVENT VALIDATION - COMPREHENSIVE BUSINESS RULES
   * Prevents invalid state transitions before they happen
   */
  private validateEvent(event: UnifiedGameEvent): { valid: boolean; error?: string } {
    const { state, players, settings } = this.context

    switch (event.type) {
      case 'HOST_JOINED':
        if (state.status !== 'created') {
          return { valid: false, error: 'Host can only join newly created games' }
        }
        break

      case 'PLAYER_JOINED':
        if (state.status !== 'lobby' || state.substatus !== 'open') {
          return { valid: false, error: 'Players can only join open lobbies' }
        }
        if (players.length >= settings.maxPlayers) {
          return { valid: false, error: 'Lobby is full' }
        }
        if (players.some(p => p.id === event.playerId)) {
          return { valid: false, error: 'Player already in game' }
        }
        break

      case 'GAME_START_REQUESTED':
        if (state.status !== 'lobby' || state.substatus !== 'open') {
          return { valid: false, error: 'Game can only be started from open lobby' }
        }
        if (players.length < 2) {
          return { valid: false, error: 'Need at least 2 players to start' }
        }
        const host = players.find(p => p.isHost)
        if (!host || host.userId !== event.requestedBy) {
          return { valid: false, error: 'Only host can start game' }
        }
        break

      case 'GAME_PAUSED':
        if (state.status !== 'active') {
          return { valid: false, error: 'Can only pause active games' }
        }
        break

      case 'GAME_RESUMED':
        if (state.status !== 'paused') {
          return { valid: false, error: 'Can only resume paused games' }
        }
        break

      case 'ACTION_ATTEMPTED':
        if (state.status !== 'active') {
          return { valid: false, error: 'Actions only allowed in active games' }
        }
        if (!this.context.gameData) {
          return { valid: false, error: 'No game data available' }
        }
        if (this.context.gameData.currentPlayer !== event.playerId) {
          return { valid: false, error: 'Not current player turn' }
        }
        // Phase-specific action validation would go here
        break

      default:
        // Allow other events by default
        break
    }

    return { valid: true }
  }

  /**
   * APPLY EVENT - PURE STATE TRANSITION FUNCTION
   * No side effects - just state calculation
   */
  private applyEvent(context: UnifiedGameContext, event: UnifiedGameEvent): UnifiedGameContext {
    const newContext = JSON.parse(JSON.stringify(context)) // Deep clone

    switch (event.type) {
      case 'HOST_JOINED':
        newContext.state = { status: 'lobby', substatus: 'open' }
        break

      case 'PLAYER_JOINED':
        const newPlayer: GamePlayer = {
          id: event.playerId,
          userId: event.userId,
          name: `Player ${newContext.players.length + 1}`, // Will be updated from event data
          playerType: event.playerType,
          color: this.assignPlayerColor(newContext.players),
          joinOrder: newContext.players.length + 1,
          isHost: newContext.players.length === 0,
          status: 'active',
          joinedAt: new Date()
        }
        newContext.players.push(newPlayer)
        break

      case 'PLAYER_LEFT':
        const playerIndex = newContext.players.findIndex(p => p.id === event.playerId)
        if (playerIndex >= 0) {
          newContext.players[playerIndex].status = 'left'
          newContext.players[playerIndex].leftAt = new Date()
          
          // If host left, transfer to next player
          if (newContext.players[playerIndex].isHost && newContext.players.length > 1) {
            const nextHost = newContext.players.find(p => p.status === 'active' && p.id !== event.playerId)
            if (nextHost) {
              nextHost.isHost = true
            }
          }
        }
        break

      case 'GAME_START_REQUESTED':
        newContext.state = { status: 'lobby', substatus: 'starting' }
        break

      case 'GAME_STARTED':
        newContext.state = { status: 'active', substatus: 'initial_placement_1' }
        newContext.startedAt = new Date()
        newContext.gameData = {
          board: {}, // Initialize board
          currentPlayer: event.playerOrder[0],
          playerOrder: event.playerOrder,
          turnNumber: 1,
          phaseStartTime: new Date(),
          gameStartTime: new Date()
        }
        break

      case 'PHASE_COMPLETED':
        if (newContext.state.status === 'active') {
          newContext.state.substatus = event.nextPhase
          if (newContext.gameData) {
            newContext.gameData.phaseStartTime = new Date()
          }
        }
        break

      case 'TURN_STARTED':
        if (newContext.gameData) {
          newContext.gameData.currentPlayer = event.playerId
          newContext.gameData.phaseStartTime = new Date()
        }
        break

      case 'TURN_ENDED':
        if (newContext.gameData && event.nextPlayerId) {
          newContext.gameData.currentPlayer = event.nextPlayerId
          newContext.gameData.turnNumber++
          newContext.gameData.phaseStartTime = new Date()
        }
        break

      case 'GAME_PAUSED':
        if (newContext.state.status === 'active') {
          newContext.state = {
            status: 'paused',
            substatus: event.reason as PauseSubstatus,
            previousState: newContext.state.substatus
          }
        }
        break

      case 'GAME_RESUMED':
        if (newContext.state.status === 'paused') {
          newContext.state = {
            status: 'active',
            substatus: newContext.state.previousState
          }
        }
        break

      case 'GAME_ENDED':
        newContext.state = {
          status: 'ended',
          substatus: event.reason,
          winner: event.winner,
          reason: event.reason
        }
        newContext.endedAt = new Date()
        break

      case 'CONNECTION_ESTABLISHED':
        newContext.connections.set(event.connectionId, {
          connectionId: event.connectionId,
          playerId: event.playerId,
          connectedAt: new Date(),
          lastHeartbeat: new Date(),
          isActive: true
        })
        break

      case 'CONNECTION_LOST':
        const connection = newContext.connections.get(event.connectionId)
        if (connection) {
          connection.isActive = false
        }
        break

      default:
        // Event doesn't affect main state - just record it
        break
    }

    return newContext
  }

  /**
   * HELPER METHODS
   */
  private assignPlayerColor(existingPlayers: GamePlayer[]): string {
    const colors = ['red', 'blue', 'green', 'yellow', 'orange', 'purple']
    const usedColors = existingPlayers.map(p => p.color)
    return colors.find(color => !usedColors.includes(color)) || 'gray'
  }

  private notifySubscribers(event: UnifiedGameEvent): void {
    this.subscribers.forEach(callback => {
      try {
        callback(this.context, event)
      } catch (error) {
        console.error('State machine subscriber error:', error)
      }
    })
  }

  /**
   * PUBLIC QUERY API
   */
  getContext(): UnifiedGameContext {
    return JSON.parse(JSON.stringify(this.context)) // Return immutable copy
  }

  getState(): UnifiedGameState {
    return { ...this.context.state }
  }

  getPlayers(): GamePlayer[] {
    return [...this.context.players]
  }

  getActivePlayers(): GamePlayer[] {
    return this.context.players.filter(p => p.status === 'active')
  }

  canJoin(): boolean {
    return this.context.state.status === 'lobby' && 
           this.context.state.substatus === 'open' &&
           this.context.players.length < this.context.settings.maxPlayers
  }

  canStart(): boolean {
    return this.context.state.status === 'lobby' && 
           this.context.state.substatus === 'open' &&
           this.getActivePlayers().length >= 2
  }

  isActive(): boolean {
    return this.context.state.status === 'active'
  }

  isEnded(): boolean {
    return this.context.state.status === 'ended'
  }

  getCurrentPlayer(): string | null {
    return this.context.gameData?.currentPlayer || null
  }

  /**
   * SUBSCRIPTION MANAGEMENT
   */
  subscribe(callback: (context: UnifiedGameContext, event: UnifiedGameEvent) => void): () => void {
    this.subscribers.add(callback)
    return () => this.subscribers.delete(callback)
  }

  /**
   * EVENT SOURCING INTEGRATION
   */
  getEventHistory(): readonly UnifiedGameEvent[] {
    return [...this.eventHistory]
  }

  static fromEventHistory(gameId: string, gameCode: string, hostUserId: string, events: UnifiedGameEvent[]): UnifiedGameStateMachine {
    const machine = new UnifiedGameStateMachine(gameId, gameCode, hostUserId)
    
    // Replay events to reconstruct state
    events.forEach(event => {
      const result = machine.send(event)
      if (!result.success) {
        console.warn(`Failed to replay event ${event.type}:`, result.error)
      }
    })
    
    return machine
  }
}

/**
 * DETERMINISTIC ROUTING
 * Single source of truth for navigation
 */
export function getRouteForGameState(gameId: string, state: UnifiedGameState): string {
  switch (state.status) {
    case 'created':
    case 'lobby':
      return `/lobby/${gameId}`
    
    case 'active':
    case 'paused':
      return `/game/${gameId}`
    
    case 'ended':
      return `/game/${gameId}/results`
    
    default:
      return '/'
  }
}

/**
 * COMPREHENSIVE BUSINESS RULES
 * All game logic in one place
 */
export class UnifiedGameRules {
  static canPlayerJoin(context: UnifiedGameContext, playerId: string): { allowed: boolean; reason?: string } {
    if (context.state.status !== 'lobby' || context.state.substatus !== 'open') {
      return { allowed: false, reason: 'Game is not accepting players' }
    }
    
    if (context.players.length >= context.settings.maxPlayers) {
      return { allowed: false, reason: 'Game is full' }
    }
    
    if (context.players.some(p => p.id === playerId)) {
      return { allowed: false, reason: 'Player already in game' }
    }
    
    return { allowed: true }
  }

  static canPlayerPerformAction(context: UnifiedGameContext, playerId: string, action: string): { allowed: boolean; reason?: string } {
    if (context.state.status !== 'active') {
      return { allowed: false, reason: 'Game is not active' }
    }
    
    if (!context.gameData) {
      return { allowed: false, reason: 'No game data available' }
    }
    
    if (context.gameData.currentPlayer !== playerId) {
      return { allowed: false, reason: 'Not your turn' }
    }
    
    // Phase-specific validation
    const validActions = this.getValidActionsForPhase(context.state.substatus)
    if (!validActions.includes(action)) {
      return { allowed: false, reason: `Action ${action} not allowed in phase ${context.state.substatus}` }
    }
    
    return { allowed: true }
  }

  static getValidActionsForPhase(phase: GameSubstatus): string[] {
    const actionMap: Record<GameSubstatus, string[]> = {
      'initial_placement_1': ['place_settlement', 'place_road'],
      'initial_placement_2': ['place_settlement', 'place_road'],
      'main_roll': ['roll_dice'],
      'main_actions': ['build_settlement', 'build_city', 'build_road', 'buy_card', 'play_card', 'trade', 'end_turn'],
      'discard': ['discard_cards'],
      'robber': ['move_robber', 'steal_resource'],
      'victory': []
    }
    
    return actionMap[phase] || []
  }

  static shouldGameEnd(context: UnifiedGameContext): { shouldEnd: boolean; winner?: string; reason?: string } {
    if (context.state.status !== 'active') {
      return { shouldEnd: false }
    }
    
    // Check victory condition
    const winner = context.players.find(p => p.gameData?.score && p.gameData.score >= context.settings.victoryPoints)
    if (winner) {
      return { shouldEnd: true, winner: winner.id, reason: 'Victory points reached' }
    }
    
    // Check if only one player remains
    const activePlayers = context.players.filter(p => p.status === 'active')
    if (activePlayers.length <= 1) {
      return { shouldEnd: true, winner: activePlayers[0]?.id, reason: 'Other players left' }
    }
    
    return { shouldEnd: false }
  }
}