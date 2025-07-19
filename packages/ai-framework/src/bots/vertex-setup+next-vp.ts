import { GameFlowManager, GameAction, PlayerId, GamePhase, GameState } from '@settlers/game-engine'
import { SimpleNextVPStrategy } from '../strategies/action/simple-next-vp'
import { InitialPlacementStrategy } from '../strategies/setup/simple-vertex'
import { getSimplePhaseAction } from '../helpers/game-helpers'

export interface BotConfig {
  playerId: PlayerId
  thinkingTimeMs?: number
  enableLogging?: boolean
}

export interface TurnResult {
  success: boolean
  actionsExecuted: GameAction[]
  finalPhase: GamePhase
  error?: string
  stats: {
    decisionTimeMs: number
    actionsCount: number
    phaseTransitions: GamePhase[]
  }
}

/**
 * Vertex Setup + Next VP Bot
 * 
 * Composes SimpleVertexSetupStrategy + SimpleNextVPStrategy for complete gameplay.
 * This is our baseline AI bot that can play full games intelligently.
 */
export class VertexSetupNextVPBot {
  private readonly config: BotConfig
  private readonly gameFlow: GameFlowManager
  private readonly setupStrategy: InitialPlacementStrategy
  private readonly actionStrategy: SimpleNextVPStrategy
  private isProcessing = false

  constructor(gameFlow: GameFlowManager, config: BotConfig) {
    this.gameFlow = gameFlow
    this.config = {
      thinkingTimeMs: 1000,
      enableLogging: true,
      ...config
    }
    this.setupStrategy = new InitialPlacementStrategy()
    this.actionStrategy = new SimpleNextVPStrategy()
  }

  /**
   * Execute a complete AI turn - handles all phases until turn ends
   */
  async executeTurn(): Promise<TurnResult> {
    if (this.isProcessing) {
      return {
        success: false,
        actionsExecuted: [],
        finalPhase: this.gameFlow.getState().phase,
        error: 'Bot is already processing a turn',
        stats: { decisionTimeMs: 0, actionsCount: 0, phaseTransitions: [] }
      }
    }

    this.isProcessing = true
    const startTime = Date.now()
    const actionsExecuted: GameAction[] = []
    const phaseTransitions: GamePhase[] = []
    const maxActions = 10 // Prevent infinite loops - reduced for performance
    
    try {
      const initialState = this.gameFlow.getState()
      
      // Verify it's this player's turn
      if (initialState.currentPlayer !== this.config.playerId) {
        this.log(`Not my turn (current: ${initialState.currentPlayer}, me: ${this.config.playerId})`)
        return {
          success: false,
          actionsExecuted: [],
          finalPhase: initialState.phase,
          error: 'Not this player\'s turn',
          stats: { decisionTimeMs: 0, actionsCount: 0, phaseTransitions: [] }
        }
      }

      this.log(`🚀 Starting turn in phase: ${initialState.phase}`)
      phaseTransitions.push(initialState.phase)

      // Add thinking delay to simulate human behavior
      if (this.config.thinkingTimeMs! > 0) {
        await this.sleep(this.config.thinkingTimeMs!)
      }

      // Execute actions until turn is complete or max actions reached
      let actionCount = 0
      let currentPhase = initialState.phase
      
      while (actionCount < maxActions) {
        const state = this.gameFlow.getState()
        
        // Check if it's still our turn
        if (state.currentPlayer !== this.config.playerId) {
          this.log(`✅ Turn ended - current player is now: ${state.currentPlayer}`)
          break
        }

        // Track phase transitions
        if (state.phase !== currentPhase) {
          this.log(`📋 Phase transition: ${currentPhase} → ${state.phase}`)
          phaseTransitions.push(state.phase)
          currentPhase = state.phase
        }

        // Get appropriate action based on current phase
        const action = this.selectAction(state)
        
        if (!action) {
          this.log(`🔄 No valid action found, ending turn`)
          break
        }

        this.log(`🎯 Executing action: ${action.type}`)
        
        // Execute the action through game flow
        const result = this.gameFlow.processAction(action)
        
        if (result.success) {
          actionsExecuted.push(action)
          actionCount++
          
          // Add small delay between actions for realism
          if (this.config.thinkingTimeMs! > 0 && actionCount < maxActions) {
            await this.sleep(Math.min(this.config.thinkingTimeMs! / 2, 500))
          }
        } else {
          this.log(`❌ Action failed: ${result.error}`)
          break
        }
      }

      const finalState = this.gameFlow.getState()
      const decisionTimeMs = Date.now() - startTime
      
      this.log(`✅ Turn complete: ${actionsExecuted.length} actions in ${decisionTimeMs}ms`)
      
      return {
        success: true,
        actionsExecuted,
        finalPhase: finalState.phase,
        stats: {
          decisionTimeMs,
          actionsCount: actionsExecuted.length,
          phaseTransitions
        }
      }

    } catch (error) {
      const decisionTimeMs = Date.now() - startTime
      this.log(`💥 Turn failed: ${error}`)
      
      return {
        success: false,
        actionsExecuted,
        finalPhase: this.gameFlow.getState().phase,
        error: error instanceof Error ? error.message : 'Unknown error',
        stats: {
          decisionTimeMs,
          actionsCount: actionsExecuted.length,
          phaseTransitions
        }
      }
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * Select appropriate action based on current game phase
   */
  private selectAction(gameState: GameState): GameAction | null {
    const phase = gameState.phase

    // Use setup strategy for initial placement phases
    if (phase === 'setup1' || phase === 'setup2') {
      return this.selectSetupAction(gameState, phase)
    }

    // For main game, use action strategy
    if (phase === 'actions') {
      return this.actionStrategy.selectBestAction(gameState, this.config.playerId)
    }

    // For other phases (roll, discard, moveRobber, steal), use helper functions
    return getSimplePhaseAction(gameState, this.config.playerId)
  }

  /**
   * Get the next action this bot would take (for testing/analysis)
   */
  getNextAction(gameState: GameState): GameAction | null {
    return this.selectAction(gameState)
  }

  /**
   * Test the bot's setup strategy in isolation
   */
  testSetupStrategy(gameState: GameState, phase: 'setup1' | 'setup2'): GameAction | null {
    return this.selectSetupAction(gameState, phase)
  }

  /**
   * Adapter method to convert setup strategy calls to the appropriate actions
   */
  private selectSetupAction(gameState: GameState, phase: 'setup1' | 'setup2'): GameAction | null {
    const player = gameState.players.get(this.config.playerId)
    if (!player) return null

    // Check if we need to place a settlement
    const needsSettlement = this.needsSettlementForPhase(player, phase)
    if (needsSettlement) {
      const vertexId = phase === 'setup1' 
        ? this.setupStrategy.selectFirstSettlement(gameState, this.config.playerId)
        : this.setupStrategy.selectSecondSettlement(gameState, this.config.playerId)
      
      return {
        type: 'build',
        playerId: this.config.playerId,
        data: {
          buildingType: 'settlement',
          position: vertexId
        }
      }
    }

    // Check if we need to place a road
    const needsRoad = this.needsRoadForPhase(player, phase)
    if (needsRoad) {
      // Find the settlement we just placed
      const lastSettlement = this.getLastPlacedSettlement(gameState, player)
      if (lastSettlement) {
        const edgeId = phase === 'setup1'
          ? this.setupStrategy.selectFirstRoad(gameState, this.config.playerId, lastSettlement)
          : this.setupStrategy.selectSecondRoad(gameState, this.config.playerId, lastSettlement)
        
        if (edgeId) {
          return {
            type: 'build',
            playerId: this.config.playerId,
            data: {
              buildingType: 'road',
              position: edgeId
            }
          }
        }
      }
    }

    return null
  }

  private needsSettlementForPhase(player: any, phase: 'setup1' | 'setup2'): boolean {
    const settlementCount = player.buildings?.settlements?.length || 0
    return (phase === 'setup1' && settlementCount === 0) || 
           (phase === 'setup2' && settlementCount === 1)
  }

  private needsRoadForPhase(player: any, phase: 'setup1' | 'setup2'): boolean {
    const roadCount = player.buildings?.roads?.length || 0
    const settlementCount = player.buildings?.settlements?.length || 0
    return (phase === 'setup1' && roadCount === 0 && settlementCount === 1) ||
           (phase === 'setup2' && roadCount === 1 && settlementCount === 2)
  }

  private getLastPlacedSettlement(gameState: GameState, player: any): string | null {
    const settlements = player.buildings?.settlements || []
    return settlements.length > 0 ? settlements[settlements.length - 1] : null
  }

  /**
   * Test the bot's action strategy in isolation
   */
  testActionStrategy(gameState: GameState): GameAction | null {
    return this.actionStrategy.selectBestAction(gameState, this.config.playerId)
  }

  private log(message: string): void {
    if (this.config.enableLogging) {
      console.log(`🤖 [${this.config.playerId}] ${message}`)
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
} 