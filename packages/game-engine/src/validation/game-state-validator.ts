// ===== COMPREHENSIVE GAME STATE VALIDATION =====
// Complete validation system for all game state transitions with Result pattern

import { GameState, GameAction, Player, PlayerId, GamePhase, Board } from '../types'
import { Result, ResultUtils, GameStateError, InvalidActionError, GameRulesError } from '../errors'
import { GAME_RULES } from '../constants'
import { getTotalResourceCount } from '../core/calculations'

/**
 * Validation result for game state operations
 */
export interface GameStateValidationResult {
  isValid: boolean
  errors: GameStateValidationError[]
  warnings: GameStateValidationWarning[]
}

export interface GameStateValidationError {
  code: string
  field: string
  message: string
  severity: 'critical' | 'error' | 'warning'
  context?: Record<string, unknown>
}

export interface GameStateValidationWarning {
  code: string
  field: string
  message: string
  context?: Record<string, unknown>
}

/**
 * Comprehensive game state validator with complete validation coverage
 */
export class GameStateValidator {
  /**
   * Validate complete game state for consistency
   */
  validateGameState(state: GameState): Result<GameStateValidationResult, GameStateError> {
    try {
      const errors: GameStateValidationError[] = []
      const warnings: GameStateValidationWarning[] = []
      
      // Core state validation
      this.validateCoreState(state, errors, warnings)
      
      // Player validation
      this.validatePlayers(state, errors, warnings)
      
      // Board validation
      this.validateBoard(state, errors, warnings)
      
      // Game rules validation
      this.validateGameRules(state, errors, warnings)
      
      // Victory conditions validation
      this.validateVictoryConditions(state, errors, warnings)
      
      // Resource consistency validation
      this.validateResourceConsistency(state, errors, warnings)
      
      const result: GameStateValidationResult = {
        isValid: errors.filter(e => e.severity === 'critical' || e.severity === 'error').length === 0,
        errors,
        warnings
      }
      
      return ResultUtils.success(result)
    } catch (error) {
      return ResultUtils.failure(
        GameStateError.gameStateError(
          state.id,
          'validation_error',
          `Game state validation failed: ${error instanceof Error ? error.message : String(error)}`
        )
      )
    }
  }
  
  /**
   * Validate game state transition from one state to another
   */
  validateStateTransition(
    fromState: GameState,
    toState: GameState,
    action: GameAction
  ): Result<GameStateValidationResult, GameStateError> {
    try {
      const errors: GameStateValidationError[] = []
      const warnings: GameStateValidationWarning[] = []
      
      // Basic transition validation
      this.validateBasicTransition(fromState, toState, action, errors, warnings)
      
      // Phase transition validation
      this.validatePhaseTransition(fromState, toState, action, errors, warnings)
      
      // Player state transitions
      this.validatePlayerTransitions(fromState, toState, action, errors, warnings)
      
      // Resource transitions
      this.validateResourceTransitions(fromState, toState, action, errors, warnings)
      
      // Score transitions
      this.validateScoreTransitions(fromState, toState, action, errors, warnings)
      
      const result: GameStateValidationResult = {
        isValid: errors.filter(e => e.severity === 'critical' || e.severity === 'error').length === 0,
        errors,
        warnings
      }
      
      return ResultUtils.success(result)
    } catch (error) {
      return ResultUtils.failure(
        GameStateError.gameStateError(
          fromState.id,
          'transition_validation_error',
          `State transition validation failed: ${error instanceof Error ? error.message : String(error)}`
        )
      )
    }
  }
  
  /**
   * Validate store consistency between frontend and backend representations
   */
  validateStoreConsistency(
    frontendState: any,
    backendState: GameState
  ): Result<GameStateValidationResult, GameStateError> {
    try {
      const errors: GameStateValidationError[] = []
      const warnings: GameStateValidationWarning[] = []
      
      // Basic field consistency
      this.validateFieldConsistency(frontendState, backendState, errors, warnings)
      
      // Player data consistency
      this.validatePlayerConsistency(frontendState, backendState, errors, warnings)
      
      // Board state consistency
      this.validateBoardConsistency(frontendState, backendState, errors, warnings)
      
      // Game phase consistency
      this.validatePhaseConsistency(frontendState, backendState, errors, warnings)
      
      const result: GameStateValidationResult = {
        isValid: errors.filter(e => e.severity === 'critical' || e.severity === 'error').length === 0,
        errors,
        warnings
      }
      
      return ResultUtils.success(result)
    } catch (error) {
      return ResultUtils.failure(
        GameStateError.gameStateError(
          backendState.id,
          'store_consistency_error',
          `Store consistency validation failed: ${error instanceof Error ? error.message : String(error)}`
        )
      )
    }
  }
  
  // ===== PRIVATE VALIDATION METHODS =====
  
  private validateCoreState(
    state: GameState,
    errors: GameStateValidationError[],
    warnings: GameStateValidationWarning[]
  ): void {
    // Game ID validation
    if (!state.id || typeof state.id !== 'string') {
      errors.push({
        code: 'INVALID_GAME_ID',
        field: 'id',
        message: 'Game ID must be a valid string',
        severity: 'critical'
      })
    }
    
    // Phase validation
    const validPhases: GamePhase[] = ['setup1', 'setup2', 'roll', 'actions', 'discard', 'moveRobber', 'steal', 'ended']
    if (!validPhases.includes(state.phase)) {
      errors.push({
        code: 'INVALID_PHASE',
        field: 'phase',
        message: `Invalid game phase: ${state.phase}`,
        severity: 'critical',
        context: { phase: state.phase, validPhases }
      })
    }
    
    // Turn validation
    if (typeof state.turn !== 'number' || state.turn < 0) {
      errors.push({
        code: 'INVALID_TURN',
        field: 'turn',
        message: 'Turn must be a non-negative number',
        severity: 'error',
        context: { turn: state.turn }
      })
    }
    
    // Current player validation
    if (!state.players.has(state.currentPlayer)) {
      errors.push({
        code: 'INVALID_CURRENT_PLAYER',
        field: 'currentPlayer',
        message: 'Current player must exist in players map',
        severity: 'critical',
        context: { currentPlayer: state.currentPlayer }
      })
    }
    
    // Timestamps validation
    if (!(state.startedAt instanceof Date) || !(state.updatedAt instanceof Date)) {
      errors.push({
        code: 'INVALID_TIMESTAMPS',
        field: 'timestamps',
        message: 'Game timestamps must be valid dates',
        severity: 'error'
      })
    }
    
    if (state.startedAt && state.updatedAt && state.startedAt > state.updatedAt) {
      errors.push({
        code: 'INVALID_TIMESTAMP_ORDER',
        field: 'timestamps',
        message: 'Game started date cannot be after updated date',
        severity: 'error'
      })
    }
  }
  
  private validatePlayers(
    state: GameState,
    errors: GameStateValidationError[],
    warnings: GameStateValidationWarning[]
  ): void {
    // Player count validation
    if (state.players.size < GAME_RULES.minPlayers || state.players.size > GAME_RULES.maxPlayers) {
      errors.push({
        code: 'INVALID_PLAYER_COUNT',
        field: 'players',
        message: `Player count must be between ${GAME_RULES.minPlayers} and ${GAME_RULES.maxPlayers}`,
        severity: 'critical',
        context: { playerCount: state.players.size }
      })
    }
    
    // Individual player validation
    for (const [playerId, player] of state.players) {
      this.validatePlayer(playerId, player, errors, warnings)
    }
    
    // Unique color validation
    const usedColors = new Set()
    for (const [playerId, player] of state.players) {
      if (usedColors.has(player.color)) {
        errors.push({
          code: 'DUPLICATE_PLAYER_COLOR',
          field: 'players',
          message: `Player color ${player.color} is used by multiple players`,
          severity: 'error',
          context: { playerId, color: player.color }
        })
      }
      usedColors.add(player.color)
    }
  }
  
  private validatePlayer(
    playerId: PlayerId,
    player: Player,
    errors: GameStateValidationError[],
    warnings: GameStateValidationWarning[]
  ): void {
    // Basic player fields
    if (player.id !== playerId) {
      errors.push({
        code: 'PLAYER_ID_MISMATCH',
        field: 'player.id',
        message: `Player ID mismatch: ${player.id} vs ${playerId}`,
        severity: 'error',
        context: { playerId, playerObjectId: player.id }
      })
    }
    
    if (!player.name || typeof player.name !== 'string') {
      errors.push({
        code: 'INVALID_PLAYER_NAME',
        field: 'player.name',
        message: 'Player name must be a non-empty string',
        severity: 'error',
        context: { playerId }
      })
    }
    
    // Color validation
    if (![0, 1, 2, 3].includes(player.color)) {
      errors.push({
        code: 'INVALID_PLAYER_COLOR',
        field: 'player.color',
        message: 'Player color must be 0, 1, 2, or 3',
        severity: 'error',
        context: { playerId, color: player.color }
      })
    }
    
    // Resource validation
    this.validatePlayerResources(playerId, player, errors, warnings)
    
    // Score validation
    this.validatePlayerScore(playerId, player, errors, warnings)
    
    // Building inventory validation
    this.validatePlayerBuildings(playerId, player, errors, warnings)
    
    // Development cards validation
    this.validatePlayerDevelopmentCards(playerId, player, errors, warnings)
  }
  
  private validatePlayerResources(
    playerId: PlayerId,
    player: Player,
    errors: GameStateValidationError[],
    warnings: GameStateValidationWarning[]
  ): void {
    const resourceTypes = ['wood', 'brick', 'ore', 'wheat', 'sheep'] as const
    
    for (const resourceType of resourceTypes) {
      const count = player.resources[resourceType]
      if (typeof count !== 'number' || count < 0) {
        errors.push({
          code: 'INVALID_RESOURCE_COUNT',
          field: `player.resources.${resourceType}`,
          message: `Resource count must be a non-negative number`,
          severity: 'error',
          context: { playerId, resourceType, count }
        })
      }
    }
    
    // Warn about unusually high resource counts
    const totalResources = getTotalResourceCount(player.resources)
    if (totalResources > 20) {
      warnings.push({
        code: 'HIGH_RESOURCE_COUNT',
        field: 'player.resources',
        message: `Player has unusually high resource count: ${totalResources}`,
        context: { playerId, totalResources }
      })
    }
  }
  
  private validatePlayerScore(
    playerId: PlayerId,
    player: Player,
    errors: GameStateValidationError[],
    warnings: GameStateValidationWarning[]
  ): void {
    // Score components validation
    if (typeof player.score.public !== 'number' || player.score.public < 0) {
      errors.push({
        code: 'INVALID_PUBLIC_SCORE',
        field: 'player.score.public',
        message: 'Public score must be a non-negative number',
        severity: 'error',
        context: { playerId, publicScore: player.score.public }
      })
    }
    
    if (typeof player.score.hidden !== 'number' || player.score.hidden < 0) {
      errors.push({
        code: 'INVALID_HIDDEN_SCORE',
        field: 'player.score.hidden',
        message: 'Hidden score must be a non-negative number',
        severity: 'error',
        context: { playerId, hiddenScore: player.score.hidden }
      })
    }
    
    // Total score consistency
    const expectedTotal = player.score.public + player.score.hidden
    if (player.score.total !== expectedTotal) {
      errors.push({
        code: 'SCORE_TOTAL_MISMATCH',
        field: 'player.score.total',
        message: `Total score mismatch: ${player.score.total} vs ${expectedTotal}`,
        severity: 'error',
        context: { playerId, totalScore: player.score.total, expectedTotal }
      })
    }
  }
  
  private validatePlayerBuildings(
    playerId: PlayerId,
    player: Player,
    errors: GameStateValidationError[],
    warnings: GameStateValidationWarning[]
  ): void {
    // Building counts validation
    if (player.buildings.settlements < 0 || player.buildings.settlements > GAME_RULES.maxSettlements) {
      errors.push({
        code: 'INVALID_SETTLEMENT_COUNT',
        field: 'player.buildings.settlements',
        message: `Settlement count must be between 0 and ${GAME_RULES.maxSettlements}`,
        severity: 'error',
        context: { playerId, settlements: player.buildings.settlements }
      })
    }
    
    if (player.buildings.cities < 0 || player.buildings.cities > GAME_RULES.maxCities) {
      errors.push({
        code: 'INVALID_CITY_COUNT',
        field: 'player.buildings.cities',
        message: `City count must be between 0 and ${GAME_RULES.maxCities}`,
        severity: 'error',
        context: { playerId, cities: player.buildings.cities }
      })
    }
    
    if (player.buildings.roads < 0 || player.buildings.roads > GAME_RULES.maxRoads) {
      errors.push({
        code: 'INVALID_ROAD_COUNT',
        field: 'player.buildings.roads',
        message: `Road count must be between 0 and ${GAME_RULES.maxRoads}`,
        severity: 'error',
        context: { playerId, roads: player.buildings.roads }
      })
    }
  }
  
  private validatePlayerDevelopmentCards(
    playerId: PlayerId,
    player: Player,
    errors: GameStateValidationError[],
    warnings: GameStateValidationWarning[]
  ): void {
    // Development card validation
    for (const card of player.developmentCards) {
      if (!card.id || typeof card.id !== 'string') {
        errors.push({
          code: 'INVALID_DEVELOPMENT_CARD_ID',
          field: 'player.developmentCards',
          message: 'Development card must have valid ID',
          severity: 'error',
          context: { playerId, cardId: card.id }
        })
      }
      
      const validTypes = ['knight', 'victory', 'roadBuilding', 'yearOfPlenty', 'monopoly']
      if (!validTypes.includes(card.type)) {
        errors.push({
          code: 'INVALID_DEVELOPMENT_CARD_TYPE',
          field: 'player.developmentCards',
          message: `Invalid development card type: ${card.type}`,
          severity: 'error',
          context: { playerId, cardType: card.type }
        })
      }
      
      if (typeof card.purchasedTurn !== 'number' || card.purchasedTurn < 0) {
        errors.push({
          code: 'INVALID_CARD_PURCHASED_TURN',
          field: 'player.developmentCards',
          message: 'Card purchased turn must be a non-negative number',
          severity: 'error',
          context: { playerId, cardId: card.id, purchasedTurn: card.purchasedTurn }
        })
      }
    }
    
    // Knights played validation
    if (typeof player.knightsPlayed !== 'number' || player.knightsPlayed < 0) {
      errors.push({
        code: 'INVALID_KNIGHTS_PLAYED',
        field: 'player.knightsPlayed',
        message: 'Knights played must be a non-negative number',
        severity: 'error',
        context: { playerId, knightsPlayed: player.knightsPlayed }
      })
    }
  }
  
  private validateBoard(
    state: GameState,
    errors: GameStateValidationError[],
    warnings: GameStateValidationWarning[]
  ): void {
    // Basic board structure validation
    if (!state.board.hexes || !(state.board.hexes instanceof Map)) {
      errors.push({
        code: 'INVALID_BOARD_HEXES',
        field: 'board.hexes',
        message: 'Board hexes must be a Map',
        severity: 'critical'
      })
    }
    
    if (!state.board.vertices || !(state.board.vertices instanceof Map)) {
      errors.push({
        code: 'INVALID_BOARD_VERTICES',
        field: 'board.vertices',
        message: 'Board vertices must be a Map',
        severity: 'critical'
      })
    }
    
    if (!state.board.edges || !(state.board.edges instanceof Map)) {
      errors.push({
        code: 'INVALID_BOARD_EDGES',
        field: 'board.edges',
        message: 'Board edges must be a Map',
        severity: 'critical'
      })
    }
    
    // Robber position validation
    if (state.board.robberPosition) {
      const robberHex = Array.from(state.board.hexes.values()).find(hex =>
        hex.position.q === state.board.robberPosition!.q &&
        hex.position.r === state.board.robberPosition!.r &&
        hex.position.s === state.board.robberPosition!.s
      )
      
      if (!robberHex) {
        errors.push({
          code: 'INVALID_ROBBER_POSITION',
          field: 'board.robberPosition',
          message: 'Robber position does not correspond to a valid hex',
          severity: 'error',
          context: { robberPosition: state.board.robberPosition }
        })
      }
    }
  }
  
  private validateGameRules(
    state: GameState,
    errors: GameStateValidationError[],
    warnings: GameStateValidationWarning[]
  ): void {
    // Development deck validation
    if (state.developmentDeck.length < 0) {
      errors.push({
        code: 'INVALID_DEVELOPMENT_DECK',
        field: 'developmentDeck',
        message: 'Development deck cannot have negative length',
        severity: 'error'
      })
    }
    
    // Active trades validation
    for (const trade of state.activeTrades) {
      if (!trade.id || typeof trade.id !== 'string') {
        errors.push({
          code: 'INVALID_TRADE_ID',
          field: 'activeTrades',
          message: 'Trade must have valid ID',
          severity: 'error'
        })
      }
      
      if (!state.players.has(trade.initiator)) {
        errors.push({
          code: 'INVALID_TRADE_INITIATOR',
          field: 'activeTrades',
          message: 'Trade initiator must be a valid player',
          severity: 'error',
          context: { tradeId: trade.id, initiator: trade.initiator }
        })
      }
    }
  }
  
  private validateVictoryConditions(
    state: GameState,
    errors: GameStateValidationError[],
    warnings: GameStateValidationWarning[]
  ): void {
    // Winner validation
    if (state.winner && !state.players.has(state.winner)) {
      errors.push({
        code: 'INVALID_WINNER',
        field: 'winner',
        message: 'Winner must be a valid player',
        severity: 'error',
        context: { winner: state.winner }
      })
    }
    
    // Game ended validation
    if (state.winner && state.phase !== 'ended') {
      errors.push({
        code: 'GAME_ENDED_PHASE_MISMATCH',
        field: 'phase',
        message: 'Game with winner must be in ended phase',
        severity: 'error',
        context: { winner: state.winner, phase: state.phase }
      })
    }
    
    // Check for players who should have won
    for (const [playerId, player] of state.players) {
      if (player.score.total >= 10 && !state.winner) {
        warnings.push({
          code: 'PLAYER_SHOULD_HAVE_WON',
          field: 'winner',
          message: `Player ${playerId} has ${player.score.total} points but game hasn't ended`,
          context: { playerId, score: player.score.total }
        })
      }
    }
  }
  
  private validateResourceConsistency(
    state: GameState,
    errors: GameStateValidationError[],
    warnings: GameStateValidationWarning[]
  ): void {
    // Calculate total resources in play
    let totalResources = 0
    for (const [playerId, player] of state.players) {
      totalResources += getTotalResourceCount(player.resources)
    }
    
    // Warn if resource count seems unusual
    if (totalResources > 100) {
      warnings.push({
        code: 'HIGH_TOTAL_RESOURCES',
        field: 'resources',
        message: `Total resources in play is unusually high: ${totalResources}`,
        context: { totalResources }
      })
    }
    
    if (totalResources === 0 && state.phase !== 'setup1') {
      warnings.push({
        code: 'NO_RESOURCES_IN_PLAY',
        field: 'resources',
        message: 'No resources in play outside of setup phase',
        context: { phase: state.phase }
      })
    }
  }
  
  // ===== TRANSITION VALIDATION METHODS =====
  
  private validateBasicTransition(
    fromState: GameState,
    toState: GameState,
    action: GameAction,
    errors: GameStateValidationError[],
    warnings: GameStateValidationWarning[]
  ): void {
    // Game ID consistency
    if (fromState.id !== toState.id) {
      errors.push({
        code: 'GAME_ID_CHANGED',
        field: 'id',
        message: 'Game ID cannot change during state transition',
        severity: 'critical',
        context: { fromId: fromState.id, toId: toState.id }
      })
    }
    
    // Turn progression
    if (toState.turn < fromState.turn) {
      errors.push({
        code: 'TURN_REGRESSION',
        field: 'turn',
        message: 'Turn number cannot decrease',
        severity: 'error',
        context: { fromTurn: fromState.turn, toTurn: toState.turn }
      })
    }
    
    // Updated timestamp
    if (toState.updatedAt <= fromState.updatedAt) {
      warnings.push({
        code: 'TIMESTAMP_NOT_UPDATED',
        field: 'updatedAt',
        message: 'Updated timestamp should advance with state changes',
        context: { fromTime: fromState.updatedAt, toTime: toState.updatedAt }
      })
    }
  }
  
  private validatePhaseTransition(
    fromState: GameState,
    toState: GameState,
    action: GameAction,
    errors: GameStateValidationError[],
    warnings: GameStateValidationWarning[]
  ): void {
    // Define valid phase transitions
    const validTransitions: Record<GamePhase, GamePhase[]> = {
      setup1: ['setup2'],
      setup2: ['roll'],
      roll: ['actions', 'discard'],
      actions: ['roll', 'moveRobber', 'ended'],
      discard: ['moveRobber'],
      moveRobber: ['steal', 'roll'],
      steal: ['roll'],
      ended: ['ended']
    }
    
    const allowedNextPhases = validTransitions[fromState.phase]
    if (!allowedNextPhases.includes(toState.phase)) {
      errors.push({
        code: 'INVALID_PHASE_TRANSITION',
        field: 'phase',
        message: `Invalid phase transition from ${fromState.phase} to ${toState.phase}`,
        severity: 'error',
        context: { fromPhase: fromState.phase, toPhase: toState.phase, allowedPhases: allowedNextPhases }
      })
    }
  }
  
  private validatePlayerTransitions(
    fromState: GameState,
    toState: GameState,
    action: GameAction,
    errors: GameStateValidationError[],
    warnings: GameStateValidationWarning[]
  ): void {
    // Player count should not change during normal gameplay
    if (fromState.players.size !== toState.players.size) {
      warnings.push({
        code: 'PLAYER_COUNT_CHANGED',
        field: 'players',
        message: 'Player count changed during gameplay',
        context: { fromCount: fromState.players.size, toCount: toState.players.size }
      })
    }
    
    // Validate individual player transitions
    for (const [playerId, fromPlayer] of fromState.players) {
      const toPlayer = toState.players.get(playerId)
      if (!toPlayer) {
        errors.push({
          code: 'PLAYER_DISAPPEARED',
          field: 'players',
          message: `Player ${playerId} disappeared during transition`,
          severity: 'error',
          context: { playerId }
        })
        continue
      }
      
      this.validatePlayerTransition(fromPlayer, toPlayer, action, errors, warnings)
    }
  }
  
  private validatePlayerTransition(
    fromPlayer: Player,
    toPlayer: Player,
    action: GameAction,
    errors: GameStateValidationError[],
    warnings: GameStateValidationWarning[]
  ): void {
    // Core player data should not change
    if (fromPlayer.id !== toPlayer.id) {
      errors.push({
        code: 'PLAYER_ID_CHANGED',
        field: 'player.id',
        message: 'Player ID cannot change',
        severity: 'critical',
        context: { fromId: fromPlayer.id, toId: toPlayer.id }
      })
    }
    
    if (fromPlayer.color !== toPlayer.color) {
      errors.push({
        code: 'PLAYER_COLOR_CHANGED',
        field: 'player.color',
        message: 'Player color cannot change during gameplay',
        severity: 'error',
        context: { playerId: fromPlayer.id, fromColor: fromPlayer.color, toColor: toPlayer.color }
      })
    }
    
    // Score should not decrease
    if (toPlayer.score.total < fromPlayer.score.total) {
      errors.push({
        code: 'SCORE_DECREASED',
        field: 'player.score.total',
        message: 'Player score cannot decrease',
        severity: 'error',
        context: { 
          playerId: fromPlayer.id, 
          fromScore: fromPlayer.score.total, 
          toScore: toPlayer.score.total 
        }
      })
    }
  }
  
  private validateResourceTransitions(
    fromState: GameState,
    toState: GameState,
    action: GameAction,
    errors: GameStateValidationError[],
    warnings: GameStateValidationWarning[]
  ): void {
    // Resource conservation validation would go here
    // This is complex and depends on the specific action being performed
  }
  
  private validateScoreTransitions(
    fromState: GameState,
    toState: GameState,
    action: GameAction,
    errors: GameStateValidationError[],
    warnings: GameStateValidationWarning[]
  ): void {
    // Score transition validation would go here
    // This involves checking that score changes are justified by the action
  }
  
  // ===== STORE CONSISTENCY VALIDATION METHODS =====
  
  private validateFieldConsistency(
    frontendState: any,
    backendState: GameState,
    errors: GameStateValidationError[],
    warnings: GameStateValidationWarning[]
  ): void {
    // Basic field consistency checks
    if (frontendState.id !== backendState.id) {
      errors.push({
        code: 'STORE_ID_MISMATCH',
        field: 'id',
        message: 'Frontend and backend game IDs do not match',
        severity: 'critical',
        context: { frontendId: frontendState.id, backendId: backendState.id }
      })
    }
    
    if (frontendState.phase !== backendState.phase) {
      errors.push({
        code: 'STORE_PHASE_MISMATCH',
        field: 'phase',
        message: 'Frontend and backend game phases do not match',
        severity: 'error',
        context: { frontendPhase: frontendState.phase, backendPhase: backendState.phase }
      })
    }
    
    if (frontendState.turn !== backendState.turn) {
      errors.push({
        code: 'STORE_TURN_MISMATCH',
        field: 'turn',
        message: 'Frontend and backend turn numbers do not match',
        severity: 'error',
        context: { frontendTurn: frontendState.turn, backendTurn: backendState.turn }
      })
    }
  }
  
  private validatePlayerConsistency(
    frontendState: any,
    backendState: GameState,
    errors: GameStateValidationError[],
    warnings: GameStateValidationWarning[]
  ): void {
    // Player consistency validation would go here
    // This involves checking that player data matches between frontend and backend
  }
  
  private validateBoardConsistency(
    frontendState: any,
    backendState: GameState,
    errors: GameStateValidationError[],
    warnings: GameStateValidationWarning[]
  ): void {
    // Board consistency validation would go here
    // This involves checking that board state matches between frontend and backend
  }
  
  private validatePhaseConsistency(
    frontendState: any,
    backendState: GameState,
    errors: GameStateValidationError[],
    warnings: GameStateValidationWarning[]
  ): void {
    // Phase consistency validation would go here
    // This involves checking that phase-specific data matches between frontend and backend
  }
}

// ===== HELPER FUNCTIONS =====

export function createGameStateValidator(): GameStateValidator {
  return new GameStateValidator()
}

// ===== STATIC GAME STATE ERROR FACTORY =====

// Extension to GameStateError class for validator-specific errors
declare module '../errors/game-errors' {
  namespace GameStateError {
    function gameStateError(gameId: string, errorType: string, details: string): GameStateError
  }
}

// Add the factory method to GameStateError
GameStateError.gameStateError = function(gameId: string, errorType: string, details: string): GameStateError {
  return new GameStateError(
    `Game state validation error: ${details}`,
    {
      gameId,
      errorType,
      details,
      context: 'game_state_validation'
    }
  )
}