/**
 * ENTERPRISE GAME LIFECYCLE STATE MACHINE
 * 
 * Hierarchical state machine following XState patterns used by:
 * - Discord (voice/text channel states)
 * - Figma (collaboration states) 
 * - Linear (issue workflow states)
 * 
 * Single source of truth for ALL game lifecycle concerns.
 */

export type GameLifecycleState = 
  | { status: 'created', substatus: 'awaiting_host' }
  | { status: 'lobby', substatus: 'open' | 'starting' | 'countdown' }
  | { status: 'active', substatus: GamePhase }
  | { status: 'paused', substatus: 'host_disconnected' | 'server_maintenance' | 'manual_pause' }
  | { status: 'ended', substatus: 'completed' | 'abandoned' | 'error' }

export type GamePhase = 
  | 'initial_placement_round_1'
  | 'initial_placement_round_2' 
  | 'main_game_roll'
  | 'main_game_actions'
  | 'main_game_discard'
  | 'main_game_robber'
  | 'victory'

export type GameLifecycleEvent =
  | { type: 'HOST_JOINED' }
  | { type: 'PLAYER_JOINED', playerId: string }
  | { type: 'PLAYER_LEFT', playerId: string }
  | { type: 'START_GAME' }
  | { type: 'GAME_STARTED' }
  | { type: 'PHASE_COMPLETED', nextPhase: GamePhase }
  | { type: 'GAME_PAUSED', reason: string }
  | { type: 'GAME_RESUMED' }
  | { type: 'GAME_ENDED', reason: 'completed' | 'abandoned' | 'error', winner?: string }

/**
 * ENTERPRISE STATE MACHINE CLASS
 * 
 * Patterns from:
 * - XState (state management library)
 * - Redux Toolkit (state transitions)
 * - Temporal.io (workflow state machines)
 */
export class GameLifecycleStateMachine {
  private state: GameLifecycleState
  private readonly gameId: string
  private readonly eventHistory: GameLifecycleEvent[] = []
  private readonly subscribers = new Set<(state: GameLifecycleState) => void>()

  constructor(gameId: string, initialState?: GameLifecycleState) {
    this.gameId = gameId
    this.state = initialState || { status: 'created', substatus: 'awaiting_host' }
  }

  /**
   * PURE STATE TRANSITION FUNCTION
   * No side effects - just state calculation
   */
  private transition(
    currentState: GameLifecycleState, 
    event: GameLifecycleEvent
  ): GameLifecycleState {
    // Hierarchical state machine logic
    switch (currentState.status) {
      case 'created':
        switch (event.type) {
          case 'HOST_JOINED':
            return { status: 'lobby', substatus: 'open' }
          default:
            return currentState
        }

      case 'lobby':
        switch (event.type) {
          case 'START_GAME':
            if (currentState.substatus === 'open') {
              return { status: 'lobby', substatus: 'starting' }
            }
            return currentState
          case 'GAME_STARTED':
            return { status: 'active', substatus: 'initial_placement_round_1' }
          case 'PLAYER_LEFT':
            // Could transition back to 'awaiting_host' if host leaves
            return currentState
          default:
            return currentState
        }

      case 'active':
        switch (event.type) {
          case 'PHASE_COMPLETED':
            return { status: 'active', substatus: event.nextPhase }
          case 'GAME_PAUSED':
            return { status: 'paused', substatus: 'manual_pause' }
          case 'GAME_ENDED':
            return { status: 'ended', substatus: event.reason }
          default:
            return currentState
        }

      case 'paused':
        switch (event.type) {
          case 'GAME_RESUMED':
            // Return to the previous active phase (would need to track this)
            return { status: 'active', substatus: 'main_game_roll' } // Simplified
          case 'GAME_ENDED':
            return { status: 'ended', substatus: event.reason }
          default:
            return currentState
        }

      case 'ended':
        // Terminal state - no transitions
        return currentState

      default:
        return currentState
    }
  }

  /**
   * SEND EVENT (PUBLIC API)
   * Handles state transition + side effects
   */
  send(event: GameLifecycleEvent): boolean {
    const previousState = this.state
    const newState = this.transition(this.state, event)
    
    // Only update if state actually changed
    if (this.statesEqual(previousState, newState)) {
      return false
    }

    // Update state
    this.state = newState
    this.eventHistory.push(event)

    // Notify subscribers (WebSocket, UI, etc.)
    this.notifySubscribers(newState)

    console.log(`🎯 Game ${this.gameId} state transition:`, {
      from: previousState,
      to: newState,
      event
    })

    return true
  }

  /**
   * QUERY CURRENT STATE
   */
  getState(): GameLifecycleState {
    return this.state
  }

  /**
   * STATE PREDICATES (BUSINESS LOGIC)
   */
  canJoin(): boolean {
    return this.state.status === 'lobby' && this.state.substatus === 'open'
  }

  canStart(): boolean {
    return this.state.status === 'lobby' && this.state.substatus === 'open'
  }

  isInGame(): boolean {
    return this.state.status === 'active'
  }

  isInLobby(): boolean {
    return this.state.status === 'lobby'
  }

  isGameStarted(): boolean {
    return this.state.status === 'active' || this.state.status === 'paused' || this.state.status === 'ended'
  }

  getCurrentPhase(): GamePhase | null {
    return this.state.status === 'active' ? this.state.substatus : null
  }

  /**
   * SUBSCRIPTION MANAGEMENT
   */
  subscribe(callback: (state: GameLifecycleState) => void): () => void {
    this.subscribers.add(callback)
    return () => this.subscribers.delete(callback)
  }

  private notifySubscribers(state: GameLifecycleState): void {
    this.subscribers.forEach(callback => {
      try {
        callback(state)
      } catch (error) {
        console.error('State machine subscriber error:', error)
      }
    })
  }

  private statesEqual(a: GameLifecycleState, b: GameLifecycleState): boolean {
    return a.status === b.status && a.substatus === b.substatus
  }

  /**
   * EVENT SOURCING INTEGRATION
   */
  getEventHistory(): readonly GameLifecycleEvent[] {
    return this.eventHistory
  }

  /**
   * PERSISTENCE/RECOVERY
   */
  static fromEventHistory(gameId: string, events: GameLifecycleEvent[]): GameLifecycleStateMachine {
    const machine = new GameLifecycleStateMachine(gameId)
    
    // Replay all events to reconstruct state
    events.forEach(event => machine.send(event))
    
    return machine
  }
}

/**
 * ROUTING LOGIC (DETERMINISTIC)
 * Single source of truth for UI navigation
 */
export function getRouteForGameState(gameId: string, state: GameLifecycleState): string {
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
      return `/`
  }
}

/**
 * BUSINESS RULES (CENTRALIZED)
 */
export class GameBusinessRules {
  static canAddPlayer(state: GameLifecycleState, currentPlayerCount: number): boolean {
    return state.status === 'lobby' && 
           state.substatus === 'open' && 
           currentPlayerCount < 4
  }

  static canRemovePlayer(state: GameLifecycleState): boolean {
    return state.status === 'lobby'
  }

  static canStartGame(state: GameLifecycleState, playerCount: number): boolean {
    return state.status === 'lobby' && 
           state.substatus === 'open' && 
           playerCount >= 2
  }

  static shouldAllowSpectators(state: GameLifecycleState): boolean {
    return state.status === 'active' || state.status === 'paused'
  }
}