// ===== CORE PROCESSOR ARCHITECTURE =====
// Senior-level, type-safe action processing system with zero technical debt

import { GameState, GameAction, GameEvent, PlayerId } from '../../types'

// ===== CORE INTERFACES =====

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
}

export interface ValidationError {
  field: string
  message: string
  code: string
}

export interface ProcessResult {
  success: boolean
  newState: GameState
  events: GameEvent[]
  error?: string
  message?: string
}

export interface ActionProcessor<T extends GameAction = GameAction> {
  readonly actionType: T['type']
  canProcess(action: GameAction): action is T
  validate(state: GameState, action: T): ValidationResult
  execute(state: GameState, action: T): ProcessResult
}

// ===== ABSTRACT BASE PROCESSOR =====

export abstract class BaseActionProcessor<T extends GameAction> implements ActionProcessor<T> {
  abstract readonly actionType: T['type']
  abstract canProcess(action: GameAction): action is T
  abstract validate(state: GameState, action: T): ValidationResult
  abstract executeCore(state: GameState, action: T): ProcessResult

  constructor(
    protected stateManager: StateManager,
    protected eventFactory: EventFactory,
    protected postProcessor: PostProcessorChain
  ) {}

  execute(state: GameState, action: T): ProcessResult {
    // 1. Validate action
    const validation = this.validate(state, action)
    if (!validation.isValid) {
      return {
        success: false,
        newState: state,
        events: [],
        error: validation.errors.map(e => e.message).join(', ')
      }
    }

    // 2. Clone state for immutability
    const clonedState = this.stateManager.cloneState(state)
    
    // 3. Execute core logic
    const result = this.executeCore(clonedState, action)
    
    // 4. Post-process if successful
    if (result.success) {
      result.newState = this.postProcessor.process(result.newState)
    }
    
    return result
  }

  protected createEvent(type: string, playerId: PlayerId | undefined, data: any = {}): GameEvent {
    return this.eventFactory.create(type, playerId, data)
  }

  protected validatePlayerTurn(state: GameState, playerId: PlayerId): ValidationError[] {
    const errors: ValidationError[] = []
    
    if (state.currentPlayer !== playerId) {
      errors.push({
        field: 'playerId',
        message: 'Not your turn',
        code: 'INVALID_TURN'
      })
    }
    
    return errors
  }

  protected validateGamePhase(state: GameState, allowedPhases: string[]): ValidationError[] {
    const errors: ValidationError[] = []
    
    if (!allowedPhases.includes(state.phase)) {
      errors.push({
        field: 'phase',
        message: `Invalid phase: ${state.phase}. Expected: ${allowedPhases.join(', ')}`,
        code: 'INVALID_PHASE'
      })
    }
    
    return errors
  }
}

// ===== STATE MANAGER =====

export class StateManager {
  cloneState(state: GameState): GameState {
    // Deep clone that preserves Map structures
    const cloned = { ...state }
    
    // Clone the players Map
    cloned.players = new Map()
    for (const [playerId, player] of state.players) {
      cloned.players.set(playerId, { ...player })
    }
    
    // Clone board Maps
    cloned.board = { ...state.board }
    cloned.board.hexes = new Map(state.board.hexes)
    cloned.board.vertices = new Map(state.board.vertices)
    cloned.board.edges = new Map(state.board.edges)
    
    // Clone arrays by reference (they're generally immutable in our usage)
    cloned.developmentDeck = [...state.developmentDeck]
    cloned.activeTrades = [...state.activeTrades]
    
    return cloned
  }

  updatePlayer(state: GameState, playerId: PlayerId, updates: Partial<any>): GameState {
    const player = state.players.get(playerId)
    if (!player) return state

    const updatedPlayer = { ...player, ...updates }
    const newState = { ...state }
    newState.players = new Map(state.players)
    newState.players.set(playerId, updatedPlayer)
    
    return newState
  }
}

// ===== EVENT FACTORY =====

export class EventFactory {
  constructor(private gameId: string) {}
  
  create(type: string, playerId: PlayerId | undefined, data: any = {}): GameEvent {
    return {
      id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      gameId: this.gameId,
      playerId,
      data,
      timestamp: new Date()
    }
  }
}

// ===== POST PROCESSOR CHAIN =====

export interface PostProcessor {
  process(state: GameState): GameState
}

export class PostProcessorChain implements PostProcessor {
  private processors: PostProcessor[] = []

  add(processor: PostProcessor): this {
    this.processors.push(processor)
    return this
  }

  process(state: GameState): GameState {
    return this.processors.reduce((currentState, processor) => 
      processor.process(currentState), state)
  }
}

// ===== INDIVIDUAL POST PROCESSORS =====

export class VictoryChecker implements PostProcessor {
  process(state: GameState): GameState {
    for (const [playerId, player] of state.players) {
      if (player.score.total >= 10 && !state.winner) {
        return {
          ...state,
          winner: playerId,
          phase: 'ended' as any
        }
      }
    }
    return state
  }
}

export class LongestRoadUpdater implements PostProcessor {
  process(state: GameState): GameState {
    // Import the longest road calculation function
    const { calculateLongestRoad } = require('../adjacency-helpers')
    const { GAME_RULES } = require('../../constants')
    
    // Calculate longest road for each player
    const playerRoadLengths = new Map<PlayerId, number>()
    let longestRoadLength = 0
    let longestRoadHolder: PlayerId | null = null
    
    for (const [playerId, player] of state.players) {
      const roadLength = calculateLongestRoad(state, playerId)
      playerRoadLengths.set(playerId, roadLength)
      
      if (roadLength >= GAME_RULES.longestRoadMinimum && roadLength > longestRoadLength) {
        longestRoadLength = roadLength
        longestRoadHolder = playerId
      }
    }
    
    // Update player states
    const newState = { ...state }
    newState.players = new Map()
    
    for (const [playerId, player] of state.players) {
      const hasLongestRoad = playerId === longestRoadHolder
      const wasChanged = player.hasLongestRoad !== hasLongestRoad
      
      // Update player with longest road status
      const updatedPlayer = { ...player, hasLongestRoad }
      
      // Update score if longest road status changed
      if (wasChanged) {
        const scoreDelta = hasLongestRoad ? GAME_RULES.pointsFor.longestRoad : -GAME_RULES.pointsFor.longestRoad
        updatedPlayer.score = {
          ...player.score,
          public: player.score.public + scoreDelta,
          total: player.score.total + scoreDelta
        }
      }
      
      newState.players.set(playerId, updatedPlayer)
    }
    
    return newState
  }
}

export class LargestArmyUpdater implements PostProcessor {
  process(state: GameState): GameState {
    const { GAME_RULES } = require('../../constants')
    
    // Find player with largest army
    let largestArmySize = 0
    let largestArmyHolder: PlayerId | null = null
    
    for (const [playerId, player] of state.players) {
      if (player.knightsPlayed >= GAME_RULES.largestArmyMinimum && player.knightsPlayed > largestArmySize) {
        largestArmySize = player.knightsPlayed
        largestArmyHolder = playerId
      }
    }
    
    // Update player states
    const newState = { ...state }
    newState.players = new Map()
    
    for (const [playerId, player] of state.players) {
      const hasLargestArmy = playerId === largestArmyHolder
      const wasChanged = player.hasLargestArmy !== hasLargestArmy
      
      // Update player with largest army status
      const updatedPlayer = { ...player, hasLargestArmy }
      
      // Update score if largest army status changed
      if (wasChanged) {
        const scoreDelta = hasLargestArmy ? GAME_RULES.pointsFor.largestArmy : -GAME_RULES.pointsFor.largestArmy
        updatedPlayer.score = {
          ...player.score,
          public: player.score.public + scoreDelta,
          total: player.score.total + scoreDelta
        }
      }
      
      newState.players.set(playerId, updatedPlayer)
    }
    
    return newState
  }
}

// All classes and interfaces are exported at their declaration point above 