// ===== STATE MACHINE CONSISTENCY ENFORCER =====
// Validates game phase transitions and ensures state machine consistency

import { GameState, GameAction, GamePhase, PlayerId } from '../../types'
import { Result, GameStateError, InvalidActionError } from '../errors'

/**
 * State machine validation result
 */
export interface StateMachineValidationResult {
  isValid: boolean
  errors: StateMachineError[]
  allowedTransitions: GamePhase[]
  allowedActions: string[]
}

/**
 * State machine error
 */
export interface StateMachineError {
  code: string
  message: string
  currentPhase: GamePhase
  attemptedPhase?: GamePhase
  attemptedAction?: string
  context?: Record<string, unknown>
}

/**
 * State machine consistency enforcer
 */
export class StateMachineValidator {
  private phaseTransitions: Map<GamePhase, GamePhase[]>
  private phaseActions: Map<GamePhase, string[]>
  private actionPhases: Map<string, GamePhase[]>
  
  constructor() {
    this.initializeStateMachine()
  }
  
  /**
   * Validate phase transition
   */
  validatePhaseTransition(
    currentPhase: GamePhase,
    targetPhase: GamePhase,
    context?: Record<string, unknown>
  ): Result<StateMachineValidationResult, GameStateError> {
    try {
      const errors: StateMachineError[] = []
      const allowedTransitions = this.phaseTransitions.get(currentPhase) || []
      
      // Check if transition is allowed
      if (!allowedTransitions.includes(targetPhase)) {
        errors.push({
          code: 'INVALID_PHASE_TRANSITION',
          message: `Cannot transition from ${currentPhase} to ${targetPhase}`,
          currentPhase,
          attemptedPhase: targetPhase,
          context
        })
      }
      
      // Special validation for specific transitions
      this.validateSpecialTransitions(currentPhase, targetPhase, errors, context)
      
      const result: StateMachineValidationResult = {
        isValid: errors.length === 0,
        errors,
        allowedTransitions,
        allowedActions: this.phaseActions.get(currentPhase) || []
      }
      
      return Result.success(result)
    } catch (error) {
      return Result.failure(
        GameStateError.gameStateError(
          'unknown',
          'phase_transition_validation',
          `Phase transition validation failed: ${error instanceof Error ? error.message : String(error)}`
        )
      )
    }
  }
  
  /**
   * Validate action in current phase
   */
  validateActionInPhase(
    action: GameAction,
    currentPhase: GamePhase,
    gameState?: GameState
  ): Result<StateMachineValidationResult, InvalidActionError> {
    try {
      const errors: StateMachineError[] = []
      const allowedActions = this.phaseActions.get(currentPhase) || []
      const allowedTransitions = this.phaseTransitions.get(currentPhase) || []
      
      // Check if action is allowed in current phase
      if (!allowedActions.includes(action.type)) {
        errors.push({
          code: 'INVALID_ACTION_FOR_PHASE',
          message: `Action ${action.type} is not allowed in phase ${currentPhase}`,
          currentPhase,
          attemptedAction: action.type,
          context: { allowedActions }
        })
      }
      
      // Special validation for specific actions
      this.validateSpecialActions(action, currentPhase, errors, gameState)
      
      const result: StateMachineValidationResult = {
        isValid: errors.length === 0,
        errors,
        allowedTransitions,
        allowedActions
      }
      
      return Result.success(result)
    } catch (error) {
      return Result.failure(
        InvalidActionError.invalidActionForPhase(
          gameState?.id || 'unknown',
          action.playerId,
          action.type,
          currentPhase
        )
      )
    }
  }
  
  /**
   * Validate turn order
   */
  validateTurnOrder(
    currentPlayer: PlayerId,
    nextPlayer: PlayerId,
    gameState: GameState
  ): Result<boolean, InvalidActionError> {
    try {
      // Get turn order from game state
      const playerIds = Array.from(gameState.players.keys())
      const currentIndex = playerIds.indexOf(currentPlayer)
      const nextIndex = playerIds.indexOf(nextPlayer)
      
      if (currentIndex === -1) {
        return Result.failure(
          InvalidActionError.invalidPlayerAction(
            gameState.id,
            currentPlayer,
            'turn_order_validation'
          )
        )
      }
      
      if (nextIndex === -1) {
        return Result.failure(
          InvalidActionError.invalidPlayerAction(
            gameState.id,
            nextPlayer,
            'turn_order_validation'
          )
        )
      }
      
      // In setup phases, turn order is different
      if (gameState.phase === 'setup1' || gameState.phase === 'setup2') {
        return this.validateSetupTurnOrder(currentPlayer, nextPlayer, gameState)
      }
      
      // Normal turn order: next player in sequence
      const expectedNextIndex = (currentIndex + 1) % playerIds.length
      const isValidTransition = nextIndex === expectedNextIndex
      
      return Result.success(isValidTransition)
    } catch (error) {
      return Result.failure(
        InvalidActionError.invalidPlayerAction(
          gameState.id,
          currentPlayer,
          'turn_order_validation'
        )
      )
    }
  }
  
  /**
   * Get next valid phase for current state
   */
  getNextValidPhase(
    currentPhase: GamePhase,
    gameState: GameState
  ): GamePhase | null {
    const allowedTransitions = this.phaseTransitions.get(currentPhase) || []
    
    // Logic to determine the most appropriate next phase
    switch (currentPhase) {
      case 'setup1':
        return 'setup2'
      
      case 'setup2':
        return 'roll'
      
      case 'roll':
        // Check if anyone needs to discard (7 was rolled)
        if (gameState.dice?.sum === 7) {
          const needsDiscard = Array.from(gameState.players.values())
            .some(player => this.getTotalResourceCount(player.resources) > 7)
          if (needsDiscard) {
            return 'discard'
          }
          return 'moveRobber'
        }
        return 'actions'
      
      case 'actions':
        // Check for game end
        const winner = Array.from(gameState.players.values())
          .find(player => player.score.total >= 10)
        if (winner) {
          return 'ended'
        }
        return 'roll'
      
      case 'discard':
        return 'moveRobber'
      
      case 'moveRobber':
        return 'steal'
      
      case 'steal':
        return 'roll'
      
      case 'ended':
        return 'ended'
      
      default:
        return allowedTransitions[0] || null
    }
  }
  
  /**
   * Get allowed actions for current phase
   */
  getAllowedActions(currentPhase: GamePhase): string[] {
    return this.phaseActions.get(currentPhase) || []
  }
  
  /**
   * Check if game state is in valid state machine state
   */
  validateGameStateMachine(gameState: GameState): Result<StateMachineValidationResult, GameStateError> {
    try {
      const errors: StateMachineError[] = []
      
      // Validate current phase is valid
      const validPhases: GamePhase[] = ['setup1', 'setup2', 'roll', 'actions', 'discard', 'moveRobber', 'steal', 'ended']
      if (!validPhases.includes(gameState.phase)) {
        errors.push({
          code: 'INVALID_GAME_PHASE',
          message: `Invalid game phase: ${gameState.phase}`,
          currentPhase: gameState.phase,
          context: { validPhases }
        })
      }
      
      // Validate phase consistency with game state
      this.validatePhaseConsistency(gameState, errors)
      
      // Validate turn consistency
      this.validateTurnConsistency(gameState, errors)
      
      const result: StateMachineValidationResult = {
        isValid: errors.length === 0,
        errors,
        allowedTransitions: this.phaseTransitions.get(gameState.phase) || [],
        allowedActions: this.phaseActions.get(gameState.phase) || []
      }
      
      return Result.success(result)
    } catch (error) {
      return Result.failure(
        GameStateError.gameStateError(
          gameState.id,
          'state_machine_validation',
          `State machine validation failed: ${error instanceof Error ? error.message : String(error)}`
        )
      )
    }
  }
  
  // ===== PRIVATE METHODS =====
  
  private initializeStateMachine(): void {
    // Initialize phase transitions
    this.phaseTransitions = new Map([
      ['setup1', ['setup2']],
      ['setup2', ['roll']],
      ['roll', ['actions', 'discard']],
      ['actions', ['roll', 'ended']],
      ['discard', ['moveRobber']],
      ['moveRobber', ['steal', 'roll']],
      ['steal', ['roll']],
      ['ended', ['ended']]
    ])
    
    // Initialize phase actions
    this.phaseActions = new Map([
      ['setup1', ['placeInitialSettlement', 'placeInitialRoad']],
      ['setup2', ['placeInitialSettlement', 'placeInitialRoad']],
      ['roll', ['roll']],
      ['actions', ['build', 'bankTrade', 'portTrade', 'createTradeOffer', 'acceptTrade', 'rejectTrade', 'cancelTrade', 'playCard', 'buyCard', 'endTurn']],
      ['discard', ['discard']],
      ['moveRobber', ['moveRobber']],
      ['steal', ['stealResource']],
      ['ended', []]
    ])
    
    // Initialize action phases (reverse mapping)
    this.actionPhases = new Map()
    for (const [phase, actions] of this.phaseActions) {
      for (const action of actions) {
        if (!this.actionPhases.has(action)) {
          this.actionPhases.set(action, [])
        }
        this.actionPhases.get(action)!.push(phase)
      }
    }
  }
  
  private validateSpecialTransitions(
    currentPhase: GamePhase,
    targetPhase: GamePhase,
    errors: StateMachineError[],
    context?: Record<string, unknown>
  ): void {
    // Special validation for setup phases
    if (currentPhase === 'setup1' && targetPhase === 'setup2') {
      // Validate that setup1 is complete
      if (context && !context.setup1Complete) {
        errors.push({
          code: 'SETUP1_INCOMPLETE',
          message: 'Cannot transition to setup2 until setup1 is complete',
          currentPhase,
          attemptedPhase: targetPhase,
          context
        })
      }
    }
    
    if (currentPhase === 'setup2' && targetPhase === 'roll') {
      // Validate that setup2 is complete
      if (context && !context.setup2Complete) {
        errors.push({
          code: 'SETUP2_INCOMPLETE',
          message: 'Cannot transition to roll until setup2 is complete',
          currentPhase,
          attemptedPhase: targetPhase,
          context
        })
      }
    }
    
    // Special validation for discard phase
    if (currentPhase === 'roll' && targetPhase === 'discard') {
      // Validate that 7 was rolled
      if (context && context.diceSum !== 7) {
        errors.push({
          code: 'DISCARD_PHASE_INVALID',
          message: 'Cannot enter discard phase unless 7 was rolled',
          currentPhase,
          attemptedPhase: targetPhase,
          context
        })
      }
    }
    
    // Special validation for game end
    if (targetPhase === 'ended') {
      // Validate that someone has won
      if (context && !context.hasWinner) {
        errors.push({
          code: 'GAME_END_INVALID',
          message: 'Cannot end game unless someone has won',
          currentPhase,
          attemptedPhase: targetPhase,
          context
        })
      }
    }
  }
  
  private validateSpecialActions(
    action: GameAction,
    currentPhase: GamePhase,
    errors: StateMachineError[],
    gameState?: GameState
  ): void {
    // Special validation for setup actions
    if (currentPhase === 'setup1' || currentPhase === 'setup2') {
      if (action.type === 'placeInitialRoad' && gameState) {
        // Validate that settlement was placed first
        // This would require checking the game state to ensure proper setup order
      }
    }
    
    // Special validation for dice rolling
    if (action.type === 'roll' && currentPhase === 'roll') {
      // Validate that it's the current player's turn
      if (gameState && action.playerId !== gameState.currentPlayer) {
        errors.push({
          code: 'INVALID_TURN_ORDER',
          message: 'Only the current player can roll dice',
          currentPhase,
          attemptedAction: action.type,
          context: { currentPlayer: gameState.currentPlayer, actionPlayer: action.playerId }
        })
      }
    }
    
    // Special validation for ending turn
    if (action.type === 'endTurn' && currentPhase === 'actions') {
      // Validate that it's the current player's turn
      if (gameState && action.playerId !== gameState.currentPlayer) {
        errors.push({
          code: 'INVALID_TURN_ORDER',
          message: 'Only the current player can end their turn',
          currentPhase,
          attemptedAction: action.type,
          context: { currentPlayer: gameState.currentPlayer, actionPlayer: action.playerId }
        })
      }
    }
  }
  
  private validateSetupTurnOrder(
    currentPlayer: PlayerId,
    nextPlayer: PlayerId,
    gameState: GameState
  ): Result<boolean, InvalidActionError> {
    // Setup turn order is more complex - depends on setup phase and round
    // This is a simplified validation
    const playerIds = Array.from(gameState.players.keys())
    const currentIndex = playerIds.indexOf(currentPlayer)
    const nextIndex = playerIds.indexOf(nextPlayer)
    
    if (gameState.phase === 'setup1') {
      // Setup1: normal order (0 -> 1 -> 2 -> 3)
      const expectedNextIndex = (currentIndex + 1) % playerIds.length
      return Result.success(nextIndex === expectedNextIndex)
    }
    
    if (gameState.phase === 'setup2') {
      // Setup2: reverse order (3 -> 2 -> 1 -> 0)
      const expectedNextIndex = currentIndex - 1 < 0 ? playerIds.length - 1 : currentIndex - 1
      return Result.success(nextIndex === expectedNextIndex)
    }
    
    return Result.success(true)
  }
  
  private validatePhaseConsistency(gameState: GameState, errors: StateMachineError[]): void {
    // Validate that game state is consistent with current phase
    
    // Winner should only be set in ended phase
    if (gameState.winner && gameState.phase !== 'ended') {
      errors.push({
        code: 'WINNER_PHASE_INCONSISTENCY',
        message: 'Winner is set but game is not in ended phase',
        currentPhase: gameState.phase,
        context: { winner: gameState.winner }
      })
    }
    
    // Ended phase should have a winner
    if (gameState.phase === 'ended' && !gameState.winner) {
      errors.push({
        code: 'ENDED_PHASE_NO_WINNER',
        message: 'Game is in ended phase but no winner is set',
        currentPhase: gameState.phase
      })
    }
    
    // Discard phase should have players who need to discard
    if (gameState.phase === 'discard') {
      const needsDiscard = Array.from(gameState.players.values())
        .some(player => this.getTotalResourceCount(player.resources) > 7)
      
      if (!needsDiscard) {
        errors.push({
          code: 'DISCARD_PHASE_UNNECESSARY',
          message: 'Game is in discard phase but no players need to discard',
          currentPhase: gameState.phase
        })
      }
    }
  }
  
  private validateTurnConsistency(gameState: GameState, errors: StateMachineError[]): void {
    // Validate that current player exists
    if (!gameState.players.has(gameState.currentPlayer)) {
      errors.push({
        code: 'INVALID_CURRENT_PLAYER',
        message: 'Current player does not exist in game',
        currentPhase: gameState.phase,
        context: { currentPlayer: gameState.currentPlayer }
      })
    }
    
    // Validate turn number
    if (gameState.turn < 0) {
      errors.push({
        code: 'INVALID_TURN_NUMBER',
        message: 'Turn number cannot be negative',
        currentPhase: gameState.phase,
        context: { turn: gameState.turn }
      })
    }
  }
  
  private getTotalResourceCount(resources: any): number {
    return Object.values(resources).reduce((sum: number, count: any) => sum + (count || 0), 0)
  }
}

// ===== FACTORY FUNCTION =====

export function createStateMachineValidator(): StateMachineValidator {
  return new StateMachineValidator()
}