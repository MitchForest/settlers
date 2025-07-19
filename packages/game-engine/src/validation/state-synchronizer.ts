// ===== STATE SYNCHRONIZATION & REPAIR SYSTEM =====
// Complete state synchronization validation and repair mechanisms

import { GameState, PlayerId, Player } from '../types'
import { Result, ResultUtils, GameStateError } from '../errors'
import { GameStateValidator, GameStateValidationResult } from './game-state-validator'

/**
 * State synchronization result
 */
export interface StateSyncResult {
  isConsistent: boolean
  inconsistencies: StateInconsistency[]
  repairActions: RepairAction[]
  canRepair: boolean
  severity: 'low' | 'medium' | 'high' | 'critical'
}

/**
 * State inconsistency description
 */
export interface StateInconsistency {
  id: string
  type: InconsistencyType
  field: string
  frontendValue: any
  backendValue: any
  impact: 'visual' | 'functional' | 'critical'
  description: string
  context?: Record<string, unknown>
}

/**
 * Repair action that can be taken to fix inconsistencies
 */
export interface RepairAction {
  id: string
  type: RepairType
  description: string
  field: string
  newValue: any
  safe: boolean
  priority: number
  dependencies?: string[]
}

/**
 * Types of inconsistencies that can occur
 */
export type InconsistencyType = 
  | 'field_mismatch'
  | 'missing_data'
  | 'type_mismatch'
  | 'validation_error'
  | 'temporal_inconsistency'
  | 'reference_error'

/**
 * Types of repairs that can be performed
 */
export type RepairType =
  | 'sync_from_backend'
  | 'sync_from_frontend'
  | 'recalculate'
  | 'reset_to_default'
  | 'merge_values'
  | 'manual_intervention'
  | 'field_correction'
  | 'temporal_sync'
  | 'reference_correction'

/**
 * Comprehensive state synchronization and repair system
 */
export class StateSynchronizer {
  private validator: GameStateValidator
  private repairStrategies: Map<InconsistencyType, RepairStrategy>
  
  constructor() {
    this.validator = new GameStateValidator()
    this.repairStrategies = new Map()
    this.initializeRepairStrategies()
  }
  
  /**
   * Validate synchronization between frontend and backend states
   */
  async validateFrontendBackendSync(
    frontendState: any,
    backendState: GameState
  ): Promise<Result<StateSyncResult, GameStateError>> {
    try {
      const inconsistencies: StateInconsistency[] = []
      
      // Core field synchronization
      this.checkCoreFieldSync(frontendState, backendState, inconsistencies)
      
      // Player synchronization
      this.checkPlayerSync(frontendState, backendState, inconsistencies)
      
      // Board synchronization
      this.checkBoardSync(frontendState, backendState, inconsistencies)
      
      // Game state synchronization
      this.checkGameStateSync(frontendState, backendState, inconsistencies)
      
      // Generate repair actions
      const repairActions = this.generateRepairActions(inconsistencies)
      
      // Determine severity and repairability
      const severity = this.calculateSeverity(inconsistencies)
      const canRepair = this.canRepairInconsistencies(inconsistencies)
      
      const result: StateSyncResult = {
        isConsistent: inconsistencies.length === 0,
        inconsistencies,
        repairActions,
        canRepair,
        severity
      }
      
      return ResultUtils.success(result)
    } catch (error) {
      return ResultUtils.failure(
        GameStateError.gameStateError(
          backendState.id,
          'sync_validation_error',
          `State synchronization validation failed: ${error instanceof Error ? error.message : String(error)}`
        )
      )
    }
  }
  
  /**
   * Repair state inconsistencies
   */
  async repairStateInconsistencies(
    inconsistencies: StateInconsistency[],
    frontendState: any,
    backendState: GameState
  ): Promise<Result<{ repairedFrontendState: any; repairedBackendState: GameState }, GameStateError>> {
    try {
      let repairedFrontendState = { ...frontendState }
      let repairedBackendState = { ...backendState }
      
      // Sort inconsistencies by priority (critical first)
      const sortedInconsistencies = inconsistencies.sort((a, b) => {
        const priorityOrder = { critical: 0, functional: 1, visual: 2 }
        return priorityOrder[a.impact] - priorityOrder[b.impact]
      })
      
      // Apply repairs
      for (const inconsistency of sortedInconsistencies) {
        const strategy = this.repairStrategies.get(inconsistency.type)
        if (strategy) {
          const repairResult = await strategy.repair(
            inconsistency,
            repairedFrontendState,
            repairedBackendState
          )
          
          if (repairResult.success) {
            repairedFrontendState = repairResult.frontendState
            repairedBackendState = repairResult.backendState
          }
        }
      }
      
      return ResultUtils.success({
        repairedFrontendState,
        repairedBackendState
      })
    } catch (error) {
      return ResultUtils.failure(
        GameStateError.gameStateError(
          backendState.id,
          'repair_error',
          `State repair failed: ${error instanceof Error ? error.message : String(error)}`
        )
      )
    }
  }
  
  /**
   * Audit state consistency and generate report
   */
  async auditStateConsistency(
    frontendState: any,
    backendState: GameState,
    historicalStates?: { timestamp: Date; state: GameState }[]
  ): Promise<Result<StateAuditResult, GameStateError>> {
    try {
      // Validate current state consistency
      const syncResult = await this.validateFrontendBackendSync(frontendState, backendState)
      if (!syncResult.success) {
        return ResultUtils.failure(syncResult.error)
      }
      
      // Validate backend state integrity
      const backendValidation = this.validator.validateGameState(backendState)
      if (!backendValidation.success) {
        return ResultUtils.failure(backendValidation.error)
      }
      
      // Historical consistency check
      const historicalInconsistencies = historicalStates ? 
        this.checkHistoricalConsistency(historicalStates) : []
      
      const auditResult: StateAuditResult = {
        timestamp: new Date(),
        gameId: backendState.id,
        syncResult: syncResult.data,
        backendValidation: backendValidation.data,
        historicalInconsistencies,
        overallHealth: this.calculateOverallHealth(syncResult.data, backendValidation.data)
      }
      
      return ResultUtils.success(auditResult)
    } catch (error) {
      return ResultUtils.failure(
        GameStateError.gameStateError(
          backendState.id,
          'audit_error',
          `State audit failed: ${error instanceof Error ? error.message : String(error)}`
        )
      )
    }
  }
  
  // ===== PRIVATE METHODS =====
  
  private checkCoreFieldSync(
    frontendState: any,
    backendState: GameState,
    inconsistencies: StateInconsistency[]
  ): void {
    // Game ID check
    if (frontendState.id !== backendState.id) {
      inconsistencies.push({
        id: 'core_id_mismatch',
        type: 'field_mismatch',
        field: 'id',
        frontendValue: frontendState.id,
        backendValue: backendState.id,
        impact: 'critical',
        description: 'Game ID mismatch between frontend and backend'
      })
    }
    
    // Phase check
    if (frontendState.phase !== backendState.phase) {
      inconsistencies.push({
        id: 'core_phase_mismatch',
        type: 'field_mismatch',
        field: 'phase',
        frontendValue: frontendState.phase,
        backendValue: backendState.phase,
        impact: 'functional',
        description: 'Game phase mismatch between frontend and backend'
      })
    }
    
    // Turn check
    if (frontendState.turn !== backendState.turn) {
      inconsistencies.push({
        id: 'core_turn_mismatch',
        type: 'field_mismatch',
        field: 'turn',
        frontendValue: frontendState.turn,
        backendValue: backendState.turn,
        impact: 'functional',
        description: 'Turn number mismatch between frontend and backend'
      })
    }
    
    // Current player check
    if (frontendState.currentPlayer !== backendState.currentPlayer) {
      inconsistencies.push({
        id: 'core_current_player_mismatch',
        type: 'field_mismatch',
        field: 'currentPlayer',
        frontendValue: frontendState.currentPlayer,
        backendValue: backendState.currentPlayer,
        impact: 'functional',
        description: 'Current player mismatch between frontend and backend'
      })
    }
    
    // Winner check
    if (frontendState.winner !== backendState.winner) {
      inconsistencies.push({
        id: 'core_winner_mismatch',
        type: 'field_mismatch',
        field: 'winner',
        frontendValue: frontendState.winner,
        backendValue: backendState.winner,
        impact: 'critical',
        description: 'Winner mismatch between frontend and backend'
      })
    }
  }
  
  private checkPlayerSync(
    frontendState: any,
    backendState: GameState,
    inconsistencies: StateInconsistency[]
  ): void {
    // Convert frontend players to Map if needed
    const frontendPlayers = frontendState.players instanceof Map ? 
      frontendState.players : new Map(Object.entries(frontendState.players || {}))
    
    // Check player count
    if (frontendPlayers.size !== backendState.players.size) {
      inconsistencies.push({
        id: 'player_count_mismatch',
        type: 'field_mismatch',
        field: 'players.size',
        frontendValue: frontendPlayers.size,
        backendValue: backendState.players.size,
        impact: 'critical',
        description: 'Player count mismatch between frontend and backend'
      })
    }
    
    // Check individual players
    for (const [playerId, backendPlayer] of backendState.players) {
      const frontendPlayer = frontendPlayers.get(playerId)
      
      if (!frontendPlayer) {
        inconsistencies.push({
          id: `player_missing_${playerId}`,
          type: 'missing_data',
          field: `players.${playerId}`,
          frontendValue: undefined,
          backendValue: backendPlayer,
          impact: 'critical',
          description: `Player ${playerId} missing from frontend state`,
          context: { playerId }
        })
        continue
      }
      
      // Check player fields
      this.checkPlayerFieldSync(playerId, frontendPlayer, backendPlayer, inconsistencies)
    }
    
    // Check for extra players in frontend
    for (const [playerId, frontendPlayer] of frontendPlayers) {
      if (!backendState.players.has(playerId)) {
        inconsistencies.push({
          id: `player_extra_${playerId}`,
          type: 'reference_error',
          field: `players.${playerId}`,
          frontendValue: frontendPlayer,
          backendValue: undefined,
          impact: 'functional',
          description: `Extra player ${playerId} in frontend state`,
          context: { playerId }
        })
      }
    }
  }
  
  private checkPlayerFieldSync(
    playerId: PlayerId,
    frontendPlayer: any,
    backendPlayer: Player,
    inconsistencies: StateInconsistency[]
  ): void {
    // Resource sync
    if (frontendPlayer.resources) {
      for (const resource of ['wood', 'brick', 'ore', 'wheat', 'sheep'] as const) {
        if (frontendPlayer.resources[resource] !== backendPlayer.resources[resource]) {
          inconsistencies.push({
            id: `player_resource_${playerId}_${resource}`,
            type: 'field_mismatch',
            field: `players.${playerId}.resources.${resource}`,
            frontendValue: frontendPlayer.resources[resource],
            backendValue: backendPlayer.resources[resource],
            impact: 'functional',
            description: `Resource ${resource} mismatch for player ${playerId}`,
            context: { playerId, resource }
          })
        }
      }
    }
    
    // Score sync
    if (frontendPlayer.score) {
      if (frontendPlayer.score.total !== backendPlayer.score.total) {
        inconsistencies.push({
          id: `player_score_${playerId}`,
          type: 'field_mismatch',
          field: `players.${playerId}.score.total`,
          frontendValue: frontendPlayer.score.total,
          backendValue: backendPlayer.score.total,
          impact: 'functional',
          description: `Score total mismatch for player ${playerId}`,
          context: { playerId }
        })
      }
      
      if (frontendPlayer.score.public !== backendPlayer.score.public) {
        inconsistencies.push({
          id: `player_public_score_${playerId}`,
          type: 'field_mismatch',
          field: `players.${playerId}.score.public`,
          frontendValue: frontendPlayer.score.public,
          backendValue: backendPlayer.score.public,
          impact: 'visual',
          description: `Public score mismatch for player ${playerId}`,
          context: { playerId }
        })
      }
    }
    
    // Special achievements sync
    if (frontendPlayer.hasLongestRoad !== backendPlayer.hasLongestRoad) {
      inconsistencies.push({
        id: `player_longest_road_${playerId}`,
        type: 'field_mismatch',
        field: `players.${playerId}.hasLongestRoad`,
        frontendValue: frontendPlayer.hasLongestRoad,
        backendValue: backendPlayer.hasLongestRoad,
        impact: 'functional',
        description: `Longest road status mismatch for player ${playerId}`,
        context: { playerId }
      })
    }
    
    if (frontendPlayer.hasLargestArmy !== backendPlayer.hasLargestArmy) {
      inconsistencies.push({
        id: `player_largest_army_${playerId}`,
        type: 'field_mismatch',
        field: `players.${playerId}.hasLargestArmy`,
        frontendValue: frontendPlayer.hasLargestArmy,
        backendValue: backendPlayer.hasLargestArmy,
        impact: 'functional',
        description: `Largest army status mismatch for player ${playerId}`,
        context: { playerId }
      })
    }
  }
  
  private checkBoardSync(
    frontendState: any,
    backendState: GameState,
    inconsistencies: StateInconsistency[]
  ): void {
    // Board sync validation would go here
    // This is complex and depends on the frontend board representation
    
    // Robber position check
    if (frontendState.board?.robberPosition) {
      const frontendRobber = frontendState.board.robberPosition
      const backendRobber = backendState.board.robberPosition
      
      if (!backendRobber || 
          frontendRobber.q !== backendRobber.q ||
          frontendRobber.r !== backendRobber.r ||
          frontendRobber.s !== backendRobber.s) {
        inconsistencies.push({
          id: 'board_robber_position_mismatch',
          type: 'field_mismatch',
          field: 'board.robberPosition',
          frontendValue: frontendRobber,
          backendValue: backendRobber,
          impact: 'functional',
          description: 'Robber position mismatch between frontend and backend'
        })
      }
    }
  }
  
  private checkGameStateSync(
    frontendState: any,
    backendState: GameState,
    inconsistencies: StateInconsistency[]
  ): void {
    // Dice sync
    if (frontendState.dice && backendState.dice) {
      if (frontendState.dice.sum !== backendState.dice.sum) {
        inconsistencies.push({
          id: 'dice_sum_mismatch',
          type: 'field_mismatch',
          field: 'dice.sum',
          frontendValue: frontendState.dice.sum,
          backendValue: backendState.dice.sum,
          impact: 'functional',
          description: 'Dice sum mismatch between frontend and backend'
        })
      }
    }
    
    // Active trades sync
    if (frontendState.activeTrades && backendState.activeTrades) {
      if (frontendState.activeTrades.length !== backendState.activeTrades.length) {
        inconsistencies.push({
          id: 'active_trades_count_mismatch',
          type: 'field_mismatch',
          field: 'activeTrades.length',
          frontendValue: frontendState.activeTrades.length,
          backendValue: backendState.activeTrades.length,
          impact: 'functional',
          description: 'Active trades count mismatch between frontend and backend'
        })
      }
    }
  }
  
  private generateRepairActions(inconsistencies: StateInconsistency[]): RepairAction[] {
    const repairActions: RepairAction[] = []
    
    for (const inconsistency of inconsistencies) {
      const strategy = this.repairStrategies.get(inconsistency.type)
      if (strategy) {
        const action = strategy.generateRepairAction(inconsistency)
        if (action) {
          repairActions.push(action)
        }
      }
    }
    
    return repairActions.sort((a, b) => b.priority - a.priority)
  }
  
  private calculateSeverity(inconsistencies: StateInconsistency[]): 'low' | 'medium' | 'high' | 'critical' {
    const criticalCount = inconsistencies.filter(i => i.impact === 'critical').length
    const functionalCount = inconsistencies.filter(i => i.impact === 'functional').length
    const visualCount = inconsistencies.filter(i => i.impact === 'visual').length
    
    if (criticalCount > 0) return 'critical'
    if (functionalCount > 3) return 'high'
    if (functionalCount > 0) return 'medium'
    if (visualCount > 0) return 'low'
    return 'low'
  }
  
  private canRepairInconsistencies(inconsistencies: StateInconsistency[]): boolean {
    return inconsistencies.every(inconsistency => {
      const strategy = this.repairStrategies.get(inconsistency.type)
      return strategy && strategy.canRepair(inconsistency)
    })
  }
  
  private checkHistoricalConsistency(
    historicalStates: { timestamp: Date; state: GameState }[]
  ): StateInconsistency[] {
    // Historical consistency validation would go here
    // This involves checking that state transitions are valid over time
    return []
  }
  
  private calculateOverallHealth(
    syncResult: StateSyncResult,
    backendValidation: GameStateValidationResult
  ): StateHealth {
    const syncScore = syncResult.isConsistent ? 100 : Math.max(0, 100 - syncResult.inconsistencies.length * 10)
    const validationScore = backendValidation.isValid ? 100 : Math.max(0, 100 - backendValidation.errors.length * 15)
    
    const overallScore = (syncScore + validationScore) / 2
    
    return {
      score: overallScore,
      status: overallScore >= 90 ? 'healthy' : overallScore >= 70 ? 'warning' : overallScore >= 50 ? 'degraded' : 'critical',
      syncHealth: syncScore,
      validationHealth: validationScore,
      recommendations: this.generateHealthRecommendations(syncResult, backendValidation)
    }
  }
  
  private generateHealthRecommendations(
    syncResult: StateSyncResult,
    backendValidation: GameStateValidationResult
  ): string[] {
    const recommendations: string[] = []
    
    if (!syncResult.isConsistent) {
      recommendations.push('Repair frontend-backend synchronization inconsistencies')
    }
    
    if (!backendValidation.isValid) {
      recommendations.push('Fix backend state validation errors')
    }
    
    if (syncResult.severity === 'critical') {
      recommendations.push('Immediate attention required - critical state inconsistencies detected')
    }
    
    return recommendations
  }
  
  private initializeRepairStrategies(): void {
    // Initialize repair strategies for different inconsistency types
    this.repairStrategies.set('field_mismatch', new FieldMismatchRepairStrategy())
    this.repairStrategies.set('missing_data', new MissingDataRepairStrategy())
    this.repairStrategies.set('type_mismatch', new TypeMismatchRepairStrategy())
    this.repairStrategies.set('validation_error', new ValidationErrorRepairStrategy())
    this.repairStrategies.set('temporal_inconsistency', new TemporalInconsistencyRepairStrategy())
    this.repairStrategies.set('reference_error', new ReferenceErrorRepairStrategy())
  }
}

// ===== INTERFACES =====

export interface StateAuditResult {
  timestamp: Date
  gameId: string
  syncResult: StateSyncResult
  backendValidation: GameStateValidationResult
  historicalInconsistencies: StateInconsistency[]
  overallHealth: StateHealth
}

export interface StateHealth {
  score: number
  status: 'healthy' | 'warning' | 'degraded' | 'critical'
  syncHealth: number
  validationHealth: number
  recommendations: string[]
}

export interface RepairStrategy {
  canRepair(inconsistency: StateInconsistency): boolean
  generateRepairAction(inconsistency: StateInconsistency): RepairAction | null
  repair(
    inconsistency: StateInconsistency,
    frontendState: any,
    backendState: GameState
  ): Promise<{ success: boolean; frontendState: any; backendState: GameState }>
}

// ===== REPAIR STRATEGIES =====

class FieldMismatchRepairStrategy implements RepairStrategy {
  canRepair(inconsistency: StateInconsistency): boolean {
    return inconsistency.type === 'field_mismatch'
  }
  
  generateRepairAction(inconsistency: StateInconsistency): RepairAction {
    return {
      id: `repair_${inconsistency.id}`,
      type: 'sync_from_backend',
      description: `Sync ${inconsistency.field} from backend to frontend`,
      field: inconsistency.field,
      newValue: inconsistency.backendValue,
      safe: inconsistency.impact !== 'critical',
      priority: inconsistency.impact === 'critical' ? 100 : 50
    }
  }
  
  async repair(
    inconsistency: StateInconsistency,
    frontendState: any,
    backendState: GameState
  ): Promise<{ success: boolean; frontendState: any; backendState: GameState }> {
    // Sync from backend to frontend
    const newFrontendState = { ...frontendState }
    this.setNestedProperty(newFrontendState, inconsistency.field, inconsistency.backendValue)
    
    return {
      success: true,
      frontendState: newFrontendState,
      backendState
    }
  }
  
  private setNestedProperty(obj: any, path: string, value: any): void {
    const keys = path.split('.')
    let current = obj
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i]
      if (!(key in current)) {
        current[key] = {}
      }
      current = current[key]
    }
    
    current[keys[keys.length - 1]] = value
  }
}

class MissingDataRepairStrategy implements RepairStrategy {
  canRepair(inconsistency: StateInconsistency): boolean {
    return inconsistency.type === 'missing_data' && inconsistency.backendValue !== undefined
  }
  
  generateRepairAction(inconsistency: StateInconsistency): RepairAction {
    return {
      id: `repair_${inconsistency.id}`,
      type: 'sync_from_backend',
      description: `Add missing ${inconsistency.field} from backend`,
      field: inconsistency.field,
      newValue: inconsistency.backendValue,
      safe: true,
      priority: 80
    }
  }
  
  async repair(
    inconsistency: StateInconsistency,
    frontendState: any,
    backendState: GameState
  ): Promise<{ success: boolean; frontendState: any; backendState: GameState }> {
    // Add missing data from backend
    const newFrontendState = { ...frontendState }
    this.setNestedProperty(newFrontendState, inconsistency.field, inconsistency.backendValue)
    
    return {
      success: true,
      frontendState: newFrontendState,
      backendState
    }
  }
  
  private setNestedProperty(obj: any, path: string, value: any): void {
    const keys = path.split('.')
    let current = obj
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i]
      if (!(key in current)) {
        current[key] = {}
      }
      current = current[key]
    }
    
    current[keys[keys.length - 1]] = value
  }
}

// State repair strategies
class TypeMismatchRepairStrategy implements RepairStrategy {
  canRepair(inconsistency: StateInconsistency): boolean {
    return inconsistency.type === 'field_mismatch' && 
           inconsistency.field.includes('resources') ||
           inconsistency.field.includes('phase') ||
           inconsistency.field.includes('currentPlayer')
  }

  generateRepairAction(inconsistency: StateInconsistency): RepairAction | null {
    if (!this.canRepair(inconsistency)) return null

    // Prefer backend value for critical game state
    return {
      id: `repair_${inconsistency.id}`,
      type: 'sync_from_backend',
      description: `Fix type mismatch in ${inconsistency.field} by syncing from authoritative backend`,
      field: inconsistency.field,
      newValue: inconsistency.backendValue,
      safe: true,
      priority: inconsistency.impact === 'critical' ? 10 : 5
    }
  }

  async repair(inconsistency: StateInconsistency, frontendState: any, backendState: GameState) {
    try {
      const repairAction = this.generateRepairAction(inconsistency)
      if (!repairAction) {
        return { success: false, frontendState, backendState }
      }

      // Deep clone frontend state to avoid mutations
      const repairedState = JSON.parse(JSON.stringify(frontendState))
      
      // Apply the repair by setting the field to backend value
      this.setNestedField(repairedState, inconsistency.field, inconsistency.backendValue)

      return { 
        success: true, 
        frontendState: repairedState, 
        backendState 
      }
    } catch (error) {
      console.error('TypeMismatchRepairStrategy failed:', error)
      return { success: false, frontendState, backendState }
    }
  }

  private setNestedField(obj: any, path: string, value: any): void {
    const parts = path.split('.')
    let current = obj
    
    for (let i = 0; i < parts.length - 1; i++) {
      if (!(parts[i] in current)) {
        current[parts[i]] = {}
      }
      current = current[parts[i]]
    }
    
    current[parts[parts.length - 1]] = value
  }
}

class ValidationErrorRepairStrategy implements RepairStrategy {
  canRepair(inconsistency: StateInconsistency): boolean {
    return inconsistency.type === 'validation_error' && 
           inconsistency.impact !== 'critical'
  }

  generateRepairAction(inconsistency: StateInconsistency): RepairAction | null {
    if (!this.canRepair(inconsistency)) return null

    return {
      id: `validation_repair_${inconsistency.id}`,
      type: 'field_correction',
      description: `Fix validation error in ${inconsistency.field}`,
      field: inconsistency.field,
      newValue: this.getSafeValue(inconsistency),
      safe: true,
      priority: 7
    }
  }

  async repair(inconsistency: StateInconsistency, frontendState: any, backendState: GameState) {
    try {
      const repairAction = this.generateRepairAction(inconsistency)
      if (!repairAction) {
        return { success: false, frontendState, backendState }
      }

      const repairedState = JSON.parse(JSON.stringify(frontendState))
      
      // Apply validation-specific fixes
      if (inconsistency.field.includes('resources')) {
        this.repairResourceValidation(repairedState, inconsistency)
      } else if (inconsistency.field.includes('buildings')) {
        this.repairBuildingValidation(repairedState, inconsistency)
      } else {
        // Generic field correction
        this.setNestedField(repairedState, inconsistency.field, repairAction.newValue)
      }

      return { 
        success: true, 
        frontendState: repairedState, 
        backendState 
      }
    } catch (error) {
      console.error('ValidationErrorRepairStrategy failed:', error)
      return { success: false, frontendState, backendState }
    }
  }

  private getSafeValue(inconsistency: StateInconsistency): any {
    // Use backend value if available and valid
    if (inconsistency.backendValue !== null && inconsistency.backendValue !== undefined) {
      return inconsistency.backendValue
    }

    // Provide safe defaults based on field type
    if (inconsistency.field.includes('resources')) {
      return { wood: 0, brick: 0, ore: 0, grain: 0, wool: 0 }
    } else if (inconsistency.field.includes('buildings')) {
      return { settlements: [], cities: [], roads: [] }
    } else if (inconsistency.field.includes('cards')) {
      return []
    }

    return null
  }

  private repairResourceValidation(state: any, inconsistency: StateInconsistency): void {
    const resources = this.getNestedField(state, inconsistency.field)
    if (resources && typeof resources === 'object') {
      // Ensure all resource values are non-negative integers
      for (const [resource, amount] of Object.entries(resources)) {
        if (typeof amount !== 'number' || amount < 0 || !Number.isInteger(amount)) {
          resources[resource] = 0
        }
      }
    }
  }

  private repairBuildingValidation(state: any, inconsistency: StateInconsistency): void {
    const buildings = this.getNestedField(state, inconsistency.field)
    if (buildings && typeof buildings === 'object') {
      // Ensure building arrays exist and are valid
      if (!Array.isArray(buildings.settlements)) buildings.settlements = []
      if (!Array.isArray(buildings.cities)) buildings.cities = []
      if (!Array.isArray(buildings.roads)) buildings.roads = []
    }
  }

  private setNestedField(obj: any, path: string, value: any): void {
    const parts = path.split('.')
    let current = obj
    
    for (let i = 0; i < parts.length - 1; i++) {
      if (!(parts[i] in current)) {
        current[parts[i]] = {}
      }
      current = current[parts[i]]
    }
    
    current[parts[parts.length - 1]] = value
  }

  private getNestedField(obj: any, path: string): any {
    const parts = path.split('.')
    let current = obj
    
    for (const part of parts) {
      if (current && part in current) {
        current = current[part]
      } else {
        return undefined
      }
    }
    
    return current
  }
}

class TemporalInconsistencyRepairStrategy implements RepairStrategy {
  canRepair(inconsistency: StateInconsistency): boolean {
    return inconsistency.type === 'temporal_inconsistency' || 
           (inconsistency.field.includes('turn') || 
            inconsistency.field.includes('phase') ||
            inconsistency.field.includes('sequence'))
  }

  generateRepairAction(inconsistency: StateInconsistency): RepairAction | null {
    if (!this.canRepair(inconsistency)) return null

    return {
      id: `temporal_repair_${inconsistency.id}`,
      type: 'temporal_sync',
      description: `Sync temporal inconsistency in ${inconsistency.field}`,
      field: inconsistency.field,
      newValue: inconsistency.backendValue, // Backend is authoritative for timing
      safe: true,
      priority: 9 // High priority for turn/phase sync
    }
  }

  async repair(inconsistency: StateInconsistency, frontendState: any, backendState: GameState) {
    try {
      const repairAction = this.generateRepairAction(inconsistency)
      if (!repairAction) {
        return { success: false, frontendState, backendState }
      }

      const repairedState = JSON.parse(JSON.stringify(frontendState))
      
      // Handle temporal-specific repairs
      if (inconsistency.field.includes('turn')) {
        this.repairTurnState(repairedState, backendState)
      } else if (inconsistency.field.includes('phase')) {
        this.repairPhaseState(repairedState, backendState)
      } else if (inconsistency.field.includes('sequence')) {
        this.repairSequenceState(repairedState, backendState)
      } else {
        // Generic field sync
        this.setNestedField(repairedState, inconsistency.field, inconsistency.backendValue)
      }

      return { 
        success: true, 
        frontendState: repairedState, 
        backendState 
      }
    } catch (error) {
      console.error('TemporalInconsistencyRepairStrategy failed:', error)
      return { success: false, frontendState, backendState }
    }
  }

  private repairTurnState(frontendState: any, backendState: GameState): void {
    // Sync turn-related fields
    frontendState.turn = backendState.turn
    frontendState.currentPlayer = backendState.currentPlayer
    // Note: turnOrder is not part of GameState - commenting out
    // if (backendState.turnOrder) {
    //   frontendState.turnOrder = [...backendState.turnOrder]
    // }
  }

  private repairPhaseState(frontendState: any, backendState: GameState): void {
    // Sync phase and related state
    frontendState.phase = backendState.phase
    // Note: phaseData is not part of GameState - commenting out
    // if (backendState.phaseData) {
    //   frontendState.phaseData = JSON.parse(JSON.stringify(backendState.phaseData))
    // }
  }

  private repairSequenceState(frontendState: any, backendState: GameState): void {
    // Sync sequence numbers for event ordering
    // Note: sequence and lastEventId are not part of GameState - commenting out
    // if (backendState.sequence !== undefined) {
    //   frontendState.sequence = backendState.sequence
    // }
    // if (backendState.lastEventId) {
    //   frontendState.lastEventId = backendState.lastEventId
    // }
  }

  private setNestedField(obj: any, path: string, value: any): void {
    const parts = path.split('.')
    let current = obj
    
    for (let i = 0; i < parts.length - 1; i++) {
      if (!(parts[i] in current)) {
        current[parts[i]] = {}
      }
      current = current[parts[i]]
    }
    
    current[parts[parts.length - 1]] = value
  }
}

class ReferenceErrorRepairStrategy implements RepairStrategy {
  canRepair(inconsistency: StateInconsistency): boolean {
    return inconsistency.type === 'reference_error' ||
           inconsistency.field.includes('playerId') ||
           inconsistency.field.includes('gameId') ||
           inconsistency.field.includes('vertex') ||
           inconsistency.field.includes('edge') ||
           inconsistency.field.includes('hex')
  }

  generateRepairAction(inconsistency: StateInconsistency): RepairAction | null {
    if (!this.canRepair(inconsistency)) return null

    return {
      id: `reference_repair_${inconsistency.id}`,
      type: 'reference_correction',
      description: `Fix reference error in ${inconsistency.field}`,
      field: inconsistency.field,
      newValue: this.getValidReference(inconsistency),
      safe: false, // Reference repairs may have side effects
      priority: 8
    }
  }

  async repair(inconsistency: StateInconsistency, frontendState: any, backendState: GameState) {
    try {
      const repairAction = this.generateRepairAction(inconsistency)
      if (!repairAction) {
        return { success: false, frontendState, backendState }
      }

      const repairedState = JSON.parse(JSON.stringify(frontendState))
      
      // Handle reference-specific repairs
      if (inconsistency.field.includes('playerId')) {
        this.repairPlayerReferences(repairedState, backendState, inconsistency)
      } else if (inconsistency.field.includes('vertex') || 
                 inconsistency.field.includes('edge') || 
                 inconsistency.field.includes('hex')) {
        this.repairBoardReferences(repairedState, backendState, inconsistency)
      } else {
        // Generic reference correction
        this.setNestedField(repairedState, inconsistency.field, repairAction.newValue)
      }

      return { 
        success: true, 
        frontendState: repairedState, 
        backendState 
      }
    } catch (error) {
      console.error('ReferenceErrorRepairStrategy failed:', error)
      return { success: false, frontendState, backendState }
    }
  }

  private getValidReference(inconsistency: StateInconsistency): any {
    // Prefer backend value if it exists and is valid
    if (inconsistency.backendValue && this.isValidReference(inconsistency.backendValue)) {
      return inconsistency.backendValue
    }

    // Return null for invalid references - safer than keeping broken ones
    return null
  }

  private isValidReference(value: any): boolean {
    if (value === null || value === undefined) return false
    if (typeof value === 'string' && value.trim() === '') return false
    if (Array.isArray(value) && value.length === 0) return false
    return true
  }

  private repairPlayerReferences(frontendState: any, backendState: GameState, inconsistency: StateInconsistency): void {
    // Validate player references against backend player list
    const validPlayerIds = new Set(backendState.players.keys())
    
    if (inconsistency.field === 'currentPlayer') {
      if (!validPlayerIds.has(frontendState.currentPlayer)) {
        frontendState.currentPlayer = backendState.currentPlayer
      }
    } else {
      // Fix other player reference fields
      const playerRef = this.getNestedField(frontendState, inconsistency.field)
      if (playerRef && !validPlayerIds.has(playerRef)) {
        this.setNestedField(frontendState, inconsistency.field, null)
      }
    }
  }

  private repairBoardReferences(frontendState: any, backendState: GameState, inconsistency: StateInconsistency): void {
    // Validate board references against backend board
    const boardRef = this.getNestedField(frontendState, inconsistency.field)
    
    if (inconsistency.field.includes('vertex')) {
      if (boardRef && !backendState.board.vertices.has(boardRef)) {
        this.setNestedField(frontendState, inconsistency.field, null)
      }
    } else if (inconsistency.field.includes('edge')) {
      if (boardRef && !backendState.board.edges.has(boardRef)) {
        this.setNestedField(frontendState, inconsistency.field, null)
      }
    } else if (inconsistency.field.includes('hex')) {
      if (boardRef && !backendState.board.hexes.has(boardRef)) {
        this.setNestedField(frontendState, inconsistency.field, null)
      }
    }
  }

  private setNestedField(obj: any, path: string, value: any): void {
    const parts = path.split('.')
    let current = obj
    
    for (let i = 0; i < parts.length - 1; i++) {
      if (!(parts[i] in current)) {
        current[parts[i]] = {}
      }
      current = current[parts[i]]
    }
    
    current[parts[parts.length - 1]] = value
  }

  private getNestedField(obj: any, path: string): any {
    const parts = path.split('.')
    let current = obj
    
    for (const part of parts) {
      if (current && part in current) {
        current = current[part]
      } else {
        return undefined
      }
    }
    
    return current
  }
}

// ===== FACTORY FUNCTION =====

export function createStateSynchronizer(): StateSynchronizer {
  return new StateSynchronizer()
}