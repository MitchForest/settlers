import { GameFlowManager, GameAction, PlayerId, GamePhase } from '@settlers/game-engine'
import { SimpleNextVPStrategy } from '../strategies/simple-next-vp'
import { getSimplePhaseAction } from '../helpers/game-helpers'

export interface SimpleAutoPlayerConfig {
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
 * Simple Next VP Auto Player
 * 
 * Integrates the SimpleNextVPStrategy with the game flow for real gameplay.
 * Designed to be a baseline AI that can play complete games.
 */
export class SimpleNextVPAutoPlayer {
  private readonly config: SimpleAutoPlayerConfig
  private readonly gameFlow: GameFlowManager
  private readonly strategy: SimpleNextVPStrategy
  private isProcessing = false

  constructor(gameFlow: GameFlowManager, config: SimpleAutoPlayerConfig) {
    this.gameFlow = gameFlow
    this.config = {
      thinkingTimeMs: 1000,
      enableLogging: true,
      ...config
    }
    this.strategy = new SimpleNextVPStrategy()
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
        error: 'AutoPlayer is already processing a turn',
        stats: { decisionTimeMs: 0, actionsCount: 0, phaseTransitions: [] }
      }
    }

    this.isProcessing = true
    const startTime = Date.now()
    const actionsExecuted: GameAction[] = []
    const phaseTransitions: GamePhase[] = []
    const maxActions = 20 // Prevent infinite loops
    
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

        // Track phase changes
        if (state.phase !== currentPhase) {
          this.log(`📋 Phase transition: ${currentPhase} → ${state.phase}`)
          phaseTransitions.push(state.phase)
          currentPhase = state.phase
        }

        // Get action from appropriate strategy
        const action = await this.selectAction(state)
        
        if (!action) {
          this.log(`❌ No action available in phase ${state.phase}`)
          break
        }

        this.log(`🎯 Executing: ${action.type} in phase ${state.phase}`)
        
        // Execute the action
        const result = await this.gameFlow.processAction(action)
        
        if (!result.success) {
          this.log(`❌ Action failed: ${result.error}`)
          return {
            success: false,
            actionsExecuted,
            finalPhase: state.phase,
            error: result.error,
            stats: {
              decisionTimeMs: Date.now() - startTime,
              actionsCount: actionCount,
              phaseTransitions
            }
          }
        }

        actionsExecuted.push(action)
        actionCount++
        
        this.log(`✅ Action succeeded: ${action.type}`)

        // Small delay between actions
        await this.sleep(100)
      }

      if (actionCount >= maxActions) {
        this.log(`⚠️ Reached maximum actions limit (${maxActions})`)
      }

      const finalState = this.gameFlow.getState()
      this.log(`🏁 Turn complete - final phase: ${finalState.phase}`)

      return {
        success: true,
        actionsExecuted,
        finalPhase: finalState.phase,
        stats: {
          decisionTimeMs: Date.now() - startTime,
          actionsCount: actionCount,
          phaseTransitions
        }
      }

    } catch (error) {
      this.log(`💥 Error during turn: ${error}`)
      return {
        success: false,
        actionsExecuted,
        finalPhase: this.gameFlow.getState().phase,
        error: error instanceof Error ? error.message : 'Unknown error',
        stats: {
          decisionTimeMs: Date.now() - startTime,
          actionsCount: actionsExecuted.length,
          phaseTransitions
        }
      }
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * Select appropriate action based on game phase
   */
  private async selectAction(state: any): Promise<GameAction | null> {
    const phase = state.phase
    
    // Use main strategy for actions phase
    if (phase === 'actions') {
      return this.strategy.selectBestAction(state, this.config.playerId)
    }
    
    // Use simple helpers for other phases (setup, roll, discard, etc.)
    return getSimplePhaseAction(state, this.config.playerId)
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Log message if logging is enabled
   */
  private log(message: string): void {
    if (this.config.enableLogging) {
      console.log(`[SimpleAI-${this.config.playerId}] ${message}`)
    }
  }

  /**
   * Get current game state
   */
  getState() {
    return this.gameFlow.getState()
  }

  /**
   * Check if this AI is currently processing
   */
  isActive(): boolean {
    return this.isProcessing
  }
} 