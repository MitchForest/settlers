import { GameState, GameAction, PlayerId, GamePhase } from '../types'
import { AICoordinator, createAIDecisionSystem, ScoredAction, getTopActionsForPlayer } from './action-decision-engine'
import { GameFlowManager } from '../engine/game-flow'
import { ProcessResult } from '../engine/action-processor-v2'

/**
 * AutoPlayer - Complete AI Automation System
 * 
 * Combines our intelligent ActionDecisionEngine with the existing GameFlow
 * to provide fully automated AI players that can play complete games.
 * 
 * Features:
 * - Intelligent decision making using BoardAnalyzer
 * - Proper integration with existing game engine
 * - Configurable AI personality and difficulty
 * - Turn timing and delay management
 * - Error handling and fallback strategies
 */

export interface AutoPlayerConfig {
  playerId: PlayerId
  personality: 'aggressive' | 'balanced' | 'defensive' | 'economic'
  difficulty: 'easy' | 'medium' | 'hard'
  thinkingTimeMs: number    // Delay to simulate human thinking
  maxActionsPerTurn: number // Prevent infinite loops
  enableLogging: boolean    // Debug output
}

export interface AutoPlayerStats {
  turnsPlayed: number
  actionsExecuted: number
  averageDecisionTime: number
  successfulActions: number
  failedActions: number
  lastActionTime: Date
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

export class AutoPlayer {
  private readonly config: AutoPlayerConfig
  private readonly gameFlow: GameFlowManager
  private decisionEngine: AICoordinator
  private stats: AutoPlayerStats
  private isProcessing = false

  constructor(gameFlow: GameFlowManager, config: AutoPlayerConfig) {
    this.gameFlow = gameFlow
    this.config = config
    this.decisionEngine = createAIDecisionSystem(
      gameFlow.getState(), 
      config.difficulty, 
      config.personality
    )
    this.stats = {
      turnsPlayed: 0,
      actionsExecuted: 0,
      averageDecisionTime: 0,
      successfulActions: 0,
      failedActions: 0,
      lastActionTime: new Date()
    }
  }

  /**
   * Execute a complete AI turn
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

      this.log(`Starting turn in phase: ${initialState.phase}`)
      phaseTransitions.push(initialState.phase)

      // Update decision engine with current state
      this.decisionEngine = createAIDecisionSystem(
        this.gameFlow.getState(), 
        this.config.difficulty, 
        this.config.personality
      )

      // Execute actions until turn is complete or max actions reached
      let actionCount = 0
      let currentPhase = initialState.phase
      
      while (actionCount < this.config.maxActionsPerTurn) {
        const state = this.gameFlow.getState()
        
        // Check if it's still our turn
        if (state.currentPlayer !== this.config.playerId) {
          this.log(`Turn ended (current player: ${state.currentPlayer})`)
          break
        }

        // Track phase changes
        if (state.phase !== currentPhase) {
          currentPhase = state.phase
          phaseTransitions.push(currentPhase)
          this.log(`Phase changed to: ${currentPhase}`)
          
          // Update decision engine for new phase
              this.decisionEngine = createAIDecisionSystem(
      state, 
      this.config.difficulty, 
      this.config.personality
    )
        }

        // Get best action for current situation
        const bestAction = this.selectBestAction()
        if (!bestAction) {
          this.log('No valid actions available, turn complete')
          break
        }

        // Simulate thinking time
        if (this.config.thinkingTimeMs > 0) {
          await this.delay(this.config.thinkingTimeMs)
        }

        // Execute the action
        this.log(`Executing action: ${bestAction.type}`, bestAction.data)
        const result = this.gameFlow.processAction(bestAction)
        
        actionsExecuted.push(bestAction)
        actionCount++

        if (result.success) {
          this.stats.successfulActions++
          this.log(`Action successful: ${result.message || 'No message'}`)
          
          // Update decision engine with new state
          this.decisionEngine = createAIDecisionSystem(
            this.gameFlow.getState(), 
            this.config.difficulty, 
            this.config.personality
          )
        } else {
          this.stats.failedActions++
          this.log(`Action failed: ${result.error}`)
          
          // For failed actions, try to continue with a different action
          // unless it's a critical error
          if (this.isCriticalError(result.error)) {
            break
          }
        }

        // Check for game end conditions
        const newState = this.gameFlow.getState()
        if (newState.winner || newState.phase === 'ended') {
          this.log(`Game ended, winner: ${newState.winner}`)
          break
        }

        // Special handling for phases that require immediate response
        if (this.requiresImmediateAction(newState.phase)) {
          continue
        }

        // For most phases, one action per iteration is sufficient
        if (bestAction.type === 'endTurn') {
          this.log('Turn ended by endTurn action')
          break
        }
      }

      const decisionTimeMs = Date.now() - startTime
      this.updateStats(decisionTimeMs, actionsExecuted.length)

      const finalState = this.gameFlow.getState()
      this.log(`Turn complete. Final phase: ${finalState.phase}, Actions: ${actionsExecuted.length}`)

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
      this.log(`Turn failed with error: ${error}`)
      
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
   * Select the best action based on AI personality and game state
   */
  private selectBestAction(): GameAction | null {
    const actions = getTopActionsForPlayer(
      this.gameFlow.getState(),
      this.config.playerId,
      this.config.difficulty,
      this.config.personality,
      10
    )
    if (actions.length === 0) return null

    // Apply personality modifiers to action selection
    const modifiedActions = this.applyPersonalityModifiers(actions)
    
    // Apply difficulty-based selection strategy
    return this.selectActionByDifficulty(modifiedActions)
  }

  /**
   * Apply AI personality modifiers to action scores
   */
  private applyPersonalityModifiers(actions: ScoredAction[]): ScoredAction[] {
    return actions.map(action => {
      let scoreModifier = 1.0

      switch (this.config.personality) {
        case 'aggressive':
          // Boost blocking moves and competitive actions
          if (action.reasoning.some(r => r.includes('block') || r.includes('Block'))) {
            scoreModifier = 1.3
          }
          // Boost development cards (knights for largest army)
          if (action.action.type === 'buyCard' || action.action.type === 'playCard') {
            scoreModifier = 1.2
          }
          break

        case 'economic':
          // Boost resource production and trading
          if (action.reasoning.some(r => r.includes('production') || r.includes('trade'))) {
            scoreModifier = 1.4
          }
          // Boost cities over settlements
          if (action.action.type === 'build' && action.action.data?.buildingType === 'city') {
            scoreModifier = 1.3
          }
          break

        case 'defensive':
          // Boost secure positions and conservative moves
          if (action.reasoning.some(r => r.includes('safe') || r.includes('secure'))) {
            scoreModifier = 1.2
          }
          // Prefer settlements over risky expansions
          if (action.action.type === 'build' && action.action.data?.buildingType === 'settlement') {
            scoreModifier = 1.1
          }
          break

        case 'balanced':
        default:
          // No significant modifiers, maintain balance
          break
      }

      return {
        ...action,
        score: action.score * scoreModifier
      }
    }).sort((a, b) => b.score - a.score)
  }

  /**
   * Select action based on difficulty level
   */
  private selectActionByDifficulty(actions: ScoredAction[]): GameAction | null {
    if (actions.length === 0) return null

    switch (this.config.difficulty) {
      case 'easy':
        // Pick from top 50% with some randomness
        const easyOptions = actions.slice(0, Math.max(1, Math.ceil(actions.length * 0.5)))
        return this.randomSelect(easyOptions).action

      case 'medium':
        // Pick from top 25% with slight randomness
        const mediumOptions = actions.slice(0, Math.max(1, Math.ceil(actions.length * 0.25)))
        return this.randomSelect(mediumOptions).action

      case 'hard':
        // Always pick the best action, or occasionally second best for unpredictability
        if (Math.random() < 0.1 && actions.length > 1) {
          return actions[1].action
        }
        return actions[0].action

      default:
        return actions[0].action
    }
  }

  /**
   * Randomly select from a list of actions with score-based weighting
   */
  private randomSelect(actions: ScoredAction[]): ScoredAction {
    if (actions.length === 1) return actions[0]

    // Weight selection by score
    const totalScore = actions.reduce((sum, action) => sum + action.score, 0)
    const random = Math.random() * totalScore

    let currentSum = 0
    for (const action of actions) {
      currentSum += action.score
      if (random <= currentSum) {
        return action
      }
    }

    // Fallback to first action
    return actions[0]
  }

  /**
   * Check if a phase requires immediate action continuation
   */
  private requiresImmediateAction(phase: GamePhase): boolean {
    return ['discard', 'moveRobber', 'steal'].includes(phase)
  }

  /**
   * Check if an error should stop the turn immediately
   */
  private isCriticalError(error?: string): boolean {
    if (!error) return false
    
    const criticalErrors = [
      'game has ended',
      'not your turn',
      'invalid player',
      'game not found'
    ]
    
    return criticalErrors.some(critical => 
      error.toLowerCase().includes(critical.toLowerCase())
    )
  }

  /**
   * Update player statistics
   */
  private updateStats(decisionTimeMs: number, actionsCount: number): void {
    this.stats.turnsPlayed++
    this.stats.actionsExecuted += actionsCount
    this.stats.lastActionTime = new Date()
    
    // Update average decision time
    const totalDecisionTime = this.stats.averageDecisionTime * (this.stats.turnsPlayed - 1) + decisionTimeMs
    this.stats.averageDecisionTime = totalDecisionTime / this.stats.turnsPlayed
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Logging utility
   */
  private log(message: string, data?: any): void {
    if (!this.config.enableLogging) return
    
    const timestamp = new Date().toISOString()
    const prefix = `[AutoPlayer ${this.config.playerId}]`
    
    if (data) {
      console.log(`${timestamp} ${prefix} ${message}`, data)
    } else {
      console.log(`${timestamp} ${prefix} ${message}`)
    }
  }

  // ============= Public API =============

  /**
   * Get current player statistics
   */
  getStats(): AutoPlayerStats {
    return { ...this.stats }
  }

  /**
   * Update AI configuration
   */
  updateConfig(newConfig: Partial<AutoPlayerConfig>): void {
    Object.assign(this.config, newConfig)
    this.log('Configuration updated', newConfig)
  }

  /**
   * Check if player can act in current game state
   */
  canAct(): boolean {
    const state = this.gameFlow.getState()
    return !this.isProcessing && 
           state.currentPlayer === this.config.playerId &&
           !state.winner &&
           state.phase !== 'ended'
  }

  /**
   * Get preview of next action without executing
   */
  previewNextAction(): ScoredAction | null {
    if (!this.canAct()) return null
    
    this.decisionEngine = createAIDecisionSystem(
      this.gameFlow.getState(), 
      this.config.difficulty, 
      this.config.personality
    )
    const actions = getTopActionsForPlayer(
      this.gameFlow.getState(),
      this.config.playerId,
      this.config.difficulty,
      this.config.personality,
      10
    )
    const modifiedActions = this.applyPersonalityModifiers(actions)
    
    if (modifiedActions.length === 0) return null
    
    return modifiedActions[0]
  }

  /**
   * Force stop current processing (emergency brake)
   */
  forceStop(): void {
    this.isProcessing = false
    this.log('Force stopped by external request')
  }
}

// ============= Utility Functions =============

/**
 * Create an AutoPlayer with default configuration
 */
export function createAutoPlayer(
  gameFlow: GameFlowManager, 
  playerId: PlayerId, 
  overrides: Partial<AutoPlayerConfig> = {}
): AutoPlayer {
  const defaultConfig: AutoPlayerConfig = {
    playerId,
    personality: 'balanced',
    difficulty: 'medium',
    thinkingTimeMs: 1000,    // 1 second thinking time
    maxActionsPerTurn: 20,   // Prevent infinite loops
    enableLogging: true
  }

  const config = { ...defaultConfig, ...overrides }
  return new AutoPlayer(gameFlow, config)
}

/**
 * Create multiple AutoPlayers for testing
 */
export function createMultipleAutoPlayers(
  gameFlow: GameFlowManager,
  playerConfigs: Array<{ playerId: PlayerId } & Partial<AutoPlayerConfig>>
): Map<PlayerId, AutoPlayer> {
  const autoPlayers = new Map<PlayerId, AutoPlayer>()
  
  for (const config of playerConfigs) {
    const autoPlayer = createAutoPlayer(gameFlow, config.playerId, config)
    autoPlayers.set(config.playerId, autoPlayer)
  }
  
  return autoPlayers
}

/**
 * Execute a complete game with all AI players
 */
export async function runAutoGame(
  gameFlow: GameFlowManager,
  autoPlayers: Map<PlayerId, AutoPlayer>,
  maxTurns: number = 100
): Promise<{
  winner: PlayerId | null,
  totalTurns: number,
  playerStats: Map<PlayerId, AutoPlayerStats>,
  gameEndReason: string
}> {
  let totalTurns = 0
  const playerStats = new Map<PlayerId, AutoPlayerStats>()

  while (totalTurns < maxTurns) {
    const state = gameFlow.getState()
    
    // Check for game end
    if (state.winner || state.phase === 'ended') {
      break
    }

    const currentPlayer = state.currentPlayer
    const autoPlayer = autoPlayers.get(currentPlayer)
    
    if (!autoPlayer) {
      // Skip non-AI players or handle human players
      console.log(`Skipping non-AI player: ${currentPlayer}`)
      // In a real implementation, you'd wait for human input or skip
      break
    }

    if (!autoPlayer.canAct()) {
      console.log(`Player ${currentPlayer} cannot act, skipping`)
      totalTurns++
      continue
    }

    // Execute AI turn
    const result = await autoPlayer.executeTurn()
    totalTurns++

    if (!result.success) {
      console.error(`AI turn failed for ${currentPlayer}:`, result.error)
      break
    }

    // Collect stats
    playerStats.set(currentPlayer, autoPlayer.getStats())
  }

  const finalState = gameFlow.getState()
  let gameEndReason = 'Unknown'
  
  if (finalState.winner) {
    gameEndReason = `Player ${finalState.winner} won`
  } else if (totalTurns >= maxTurns) {
    gameEndReason = 'Maximum turns reached'
  } else {
    gameEndReason = 'Game stopped due to error or invalid state'
  }

  return {
    winner: finalState.winner,
    totalTurns,
    playerStats,
    gameEndReason
  }
} 