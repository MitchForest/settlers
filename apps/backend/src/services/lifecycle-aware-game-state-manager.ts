/**
 * LIFECYCLE-AWARE GAME STATE MANAGER
 * 
 * Integrates your existing GameStateManager with the lifecycle state machine.
 * Maintains all existing functionality while adding lifecycle awareness.
 */

import { gameStateManager, GameStateManager } from './game-state-manager'
import { getLifecycleIntegration } from '../integration/lifecycle-event-bridge'
import { GameBusinessRules } from '../state-machines/game-lifecycle'
import type { PlayerId, GameAction } from '../types/game'

/**
 * ENTERPRISE PATTERN: Proxy + State Machine Validation
 * 
 * Wraps existing GameStateManager with lifecycle state validation
 */
export class LifecycleAwareGameStateManager {
  constructor(
    private readonly baseGameStateManager: GameStateManager,
    private readonly lifecycleIntegration = getLifecycleIntegration()
  ) {}

  /**
   * ENHANCED PROCESS PLAYER ACTION
   * Validates action against both game rules AND lifecycle state
   */
  async processPlayerAction(
    gameId: string, 
    playerId: PlayerId, 
    action: GameAction
  ): Promise<{ success: boolean; error?: string; gameState?: any }> {
    
    // 1. Get current lifecycle state
    const lifecycleState = this.lifecycleIntegration.getGameLifecycleState(gameId)
    
    if (!lifecycleState) {
      return { success: false, error: 'Game not found' }
    }

    // 2. Validate against lifecycle state
    if (!this.isActionAllowedInLifecycleState(lifecycleState, action)) {
      return { 
        success: false, 
        error: `Action ${action.type} not allowed in game state ${lifecycleState.status}:${lifecycleState.substatus}` 
      }
    }

    // 3. Validate game is actually active
    if (lifecycleState.status !== 'active') {
      return { 
        success: false, 
        error: 'Game is not active' 
      }
    }

    // 4. Process through existing game engine
    const result = await this.baseGameStateManager.processPlayerAction(gameId, playerId, action)
    
    // 5. Handle lifecycle transitions based on game result
    if (result.success && result.gameState) {
      await this.handleGameStateTransitions(gameId, result.gameState, action)
    }
    
    return result
  }

  /**
   * ACTION VALIDATION AGAINST LIFECYCLE STATE
   */
  private isActionAllowedInLifecycleState(lifecycleState: any, action: GameAction): boolean {
    // Game must be active for most actions
    if (lifecycleState.status !== 'active') {
      return false
    }

    // Phase-specific validation
    const currentPhase = lifecycleState.substatus
    
    switch (currentPhase) {
      case 'initial_placement_round_1':
      case 'initial_placement_round_2':
        // Only allow placement actions during setup
        return ['place_settlement', 'place_road'].includes(action.type)
      
      case 'main_game_roll':
        // Only allow dice roll
        return action.type === 'roll_dice'
      
      case 'main_game_actions':
        // Allow all main game actions
        return [
          'build_settlement', 'build_city', 'build_road',
          'buy_development_card', 'play_development_card',
          'propose_trade', 'accept_trade', 'decline_trade',
          'end_turn'
        ].includes(action.type)
      
      case 'main_game_discard':
        // Only allow discard during discard phase
        return action.type === 'discard_cards'
      
      case 'main_game_robber':
        // Only allow robber actions
        return ['move_robber', 'steal_resource'].includes(action.type)
      
      default:
        return false
    }
  }

  /**
   * HANDLE GAME STATE TRANSITIONS
   * Update lifecycle state based on game engine results
   */
  private async handleGameStateTransitions(gameId: string, gameState: any, action: GameAction): Promise<void> {
    const currentLifecycleState = this.lifecycleIntegration.getGameLifecycleState(gameId)
    
    if (!currentLifecycleState) return

    // Check for victory condition
    if (gameState.winner) {
      await this.lifecycleIntegration.sendLifecycleEvent(gameId, {
        type: 'GAME_ENDED',
        reason: 'completed',
        winner: gameState.winner
      })
      return
    }

    // Check for phase transitions
    const newPhase = this.determineLifecyclePhase(gameState)
    
    if (newPhase && newPhase !== currentLifecycleState.substatus) {
      await this.lifecycleIntegration.sendLifecycleEvent(gameId, {
        type: 'PHASE_COMPLETED',
        nextPhase: newPhase
      })
    }
  }

  /**
   * MAP GAME ENGINE PHASES TO LIFECYCLE PHASES
   */
  private determineLifecyclePhase(gameState: any): string | null {
    // Map your game engine's internal phase to lifecycle phase
    const phaseMapping: Record<string, string> = {
      'setup1': 'initial_placement_round_1',
      'setup2': 'initial_placement_round_2',
      'roll': 'main_game_roll',
      'actions': 'main_game_actions',
      'discard': 'main_game_discard',
      'moveRobber': 'main_game_robber',
      'steal': 'main_game_robber'
    }
    
    return phaseMapping[gameState.currentPhase] || null
  }

  /**
   * ENHANCED LOAD GAME STATE
   * Returns both game state and lifecycle state
   */
  async loadGameState(gameId: string): Promise<{
    gameState: any
    lifecycleState: any
    canPerformActions: boolean
    validActions: string[]
  } | null> {
    
    const [gameState, lifecycleState] = await Promise.all([
      this.baseGameStateManager.loadGameState(gameId),
      Promise.resolve(this.lifecycleIntegration.getGameLifecycleState(gameId))
    ])
    
    if (!gameState || !lifecycleState) {
      return null
    }
    
    return {
      gameState,
      lifecycleState,
      canPerformActions: lifecycleState.status === 'active',
      validActions: this.getValidActionsForPhase(lifecycleState.substatus)
    }
  }

  /**
   * GET VALID ACTIONS FOR CURRENT PHASE
   */
  private getValidActionsForPhase(phase: string): string[] {
    const validActionsMap: Record<string, string[]> = {
      'initial_placement_round_1': ['place_settlement', 'place_road'],
      'initial_placement_round_2': ['place_settlement', 'place_road'],
      'main_game_roll': ['roll_dice'],
      'main_game_actions': [
        'build_settlement', 'build_city', 'build_road',
        'buy_development_card', 'play_development_card',
        'propose_trade', 'accept_trade', 'decline_trade',
        'end_turn'
      ],
      'main_game_discard': ['discard_cards'],
      'main_game_robber': ['move_robber', 'steal_resource']
    }
    
    return validActionsMap[phase] || []
  }

  /**
   * PAUSE/RESUME GAME
   * Admin operations that affect lifecycle
   */
  async pauseGame(gameId: string, reason: string): Promise<{ success: boolean; error?: string }> {
    const lifecycleState = this.lifecycleIntegration.getGameLifecycleState(gameId)
    
    if (!lifecycleState || lifecycleState.status !== 'active') {
      return { success: false, error: 'Can only pause active games' }
    }
    
    const success = await this.lifecycleIntegration.sendLifecycleEvent(gameId, {
      type: 'GAME_PAUSED',
      reason
    })
    
    return { success }
  }

  async resumeGame(gameId: string): Promise<{ success: boolean; error?: string }> {
    const lifecycleState = this.lifecycleIntegration.getGameLifecycleState(gameId)
    
    if (!lifecycleState || lifecycleState.status !== 'paused') {
      return { success: false, error: 'Can only resume paused games' }
    }
    
    const success = await this.lifecycleIntegration.sendLifecycleEvent(gameId, {
      type: 'GAME_RESUMED'
    })
    
    return { success }
  }

  /**
   * DELEGATE TO BASE MANAGER
   * All other methods pass through unchanged
   */
  async getAllActiveGames(): Promise<string[]> {
    return this.baseGameStateManager.getAllActiveGames()
  }

  async removeGame(gameId: string): Promise<void> {
    return this.baseGameStateManager.removeGame(gameId)
  }

  // Add other delegation methods as needed...
}

/**
 * FACTORY FUNCTION
 * Creates lifecycle-aware wrapper around existing game state manager
 */
export function createLifecycleAwareGameStateManager(): LifecycleAwareGameStateManager {
  return new LifecycleAwareGameStateManager(gameStateManager)
}

// Singleton instance
export const lifecycleAwareGameStateManager = createLifecycleAwareGameStateManager()