/**
 * ENHANCED LOBBY COMMAND SERVICE
 * 
 * Shows how to integrate lifecycle state machine with your existing command pattern.
 * This is a drop-in replacement that adds lifecycle awareness.
 */

import { LobbyCommandService } from './lobby-command-service'
import { getLifecycleIntegration } from '../integration/lifecycle-event-bridge'
import { GameBusinessRules } from '../state-machines/game-lifecycle'
import type { AddAIPlayerCommand, StartGameCommand } from '../types/commands'

/**
 * ENTERPRISE PATTERN: Decorator + State Machine Validation
 * 
 * Extends existing command service with lifecycle state validation
 */
export class EnhancedLobbyCommandService extends LobbyCommandService {
  private readonly lifecycleIntegration = getLifecycleIntegration()

  /**
   * ENHANCED ADD AI PLAYER
   * Now validates against lifecycle state before executing command
   */
  async addAIPlayer(command: AddAIPlayerCommand): Promise<{ success: boolean; playerId?: string; error?: string }> {
    // 1. Get current lifecycle state
    const lifecycleState = this.lifecycleIntegration.getGameLifecycleState(command.gameId)
    
    if (!lifecycleState) {
      return { success: false, error: 'Game not found' }
    }

    // 2. Validate against lifecycle state (NEW!)
    if (lifecycleState.status !== 'lobby') {
      return { 
        success: false, 
        error: `Cannot add AI players when game is ${lifecycleState.status}` 
      }
    }

    if (lifecycleState.substatus === 'starting') {
      return { 
        success: false, 
        error: 'Game is starting, cannot add players' 
      }
    }

    // 3. Get current player count for business rules
    const currentPlayerCount = await this.getCurrentPlayerCount(command.gameId)
    
    // 4. Apply business rules through state machine
    if (!GameBusinessRules.canAddPlayer(lifecycleState, currentPlayerCount)) {
      return { 
        success: false, 
        error: 'Cannot add player in current game state' 
      }
    }

    // 5. Execute original command logic
    const result = await super.addAIPlayer(command)
    
    // 6. The LifecycleEventBridge automatically handles the lifecycle update
    // when the 'ai_player_added' event is stored!
    
    return result
  }

  /**
   * ENHANCED START GAME
   * Validates readiness and triggers proper lifecycle transitions
   */
  async startGame(command: StartGameCommand): Promise<{ success: boolean; error?: string }> {
    // 1. Get lifecycle state
    const lifecycleState = this.lifecycleIntegration.getGameLifecycleState(command.gameId)
    
    if (!lifecycleState) {
      return { success: false, error: 'Game not found' }
    }

    // 2. Validate state machine allows starting
    if (!GameBusinessRules.canStartGame(lifecycleState, await this.getCurrentPlayerCount(command.gameId))) {
      return { 
        success: false, 
        error: `Cannot start game in state ${lifecycleState.status}:${lifecycleState.substatus}` 
      }
    }

    // 3. Send lifecycle event to begin transition
    const stateChanged = await this.lifecycleIntegration.sendLifecycleEvent(command.gameId, {
      type: 'START_GAME'
    })

    if (!stateChanged) {
      return { success: false, error: 'Invalid state transition' }
    }

    // 4. Execute domain logic (your existing code)
    // This would typically involve:
    // - Validating player setup
    // - Initializing game board
    // - Setting turn order
    // - Storing 'game_started' event

    try {
      // Your existing game start logic here
      await this.executeGameStartLogic(command.gameId)
      
      // The 'game_started' event will automatically trigger 
      // the GAME_STARTED lifecycle event through the bridge!
      
      return { success: true }
      
    } catch (error) {
      // Rollback lifecycle state on failure
      await this.lifecycleIntegration.sendLifecycleEvent(command.gameId, {
        type: 'GAME_ENDED',
        reason: 'error'
      })
      
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Game start failed' 
      }
    }
  }

  /**
   * NEW: Lifecycle-aware player removal
   */
  async removePlayer(gameId: string, playerId: string): Promise<{ success: boolean; error?: string }> {
    const lifecycleState = this.lifecycleIntegration.getGameLifecycleState(gameId)
    
    if (!lifecycleState) {
      return { success: false, error: 'Game not found' }
    }

    // Business rule: can only remove players in lobby
    if (!GameBusinessRules.canRemovePlayer(lifecycleState)) {
      return { 
        success: false, 
        error: 'Cannot remove players once game has started' 
      }
    }

    // Execute removal (your existing logic)
    const result = await this.executePlayerRemoval(gameId, playerId)
    
    // The 'player_left' event will automatically update lifecycle state
    
    return result
  }

  /**
   * QUERY: Get comprehensive lobby state
   * Combines domain state with lifecycle state
   */
  async getLobbyState(gameId: string): Promise<{
    lifecycleState: any
    players: any[]
    gameCode: string
    canStart: boolean
    canJoin: boolean
    expectedRoute: string
  } | null> {
    const lifecycleState = this.lifecycleIntegration.getGameLifecycleState(gameId)
    
    if (!lifecycleState) {
      return null
    }

    // Get domain state using your existing projector
    const domainState = await this.projectLobbyStateFromEvents(gameId)
    
    return {
      lifecycleState,
      players: domainState.players,
      gameCode: domainState.gameCode,
      canStart: GameBusinessRules.canStartGame(lifecycleState, domainState.players.length),
      canJoin: GameBusinessRules.canAddPlayer(lifecycleState, domainState.players.length),
      expectedRoute: this.getExpectedRoute(gameId, lifecycleState)
    }
  }

  /**
   * HELPER METHODS
   */
  private async getCurrentPlayerCount(gameId: string): Promise<number> {
    const playerEvents = await this.eventStore.getPlayerEvents(gameId)
    
    // Count active players (joined but not left)
    const activePlayersMap = new Map<string, boolean>()
    
    for (const event of playerEvents) {
      if (event.eventType === 'player_joined' || event.eventType === 'ai_player_added') {
        activePlayersMap.set(event.playerId, true)
      } else if (event.eventType === 'player_left' || event.eventType === 'ai_player_removed') {
        activePlayersMap.set(event.playerId, false)
      }
    }
    
    return Array.from(activePlayersMap.values()).filter(active => active).length
  }

  private async executeGameStartLogic(gameId: string): Promise<void> {
    // Your existing game initialization logic
    // This would typically store a 'game_started' event
    await this.eventStore.appendEvent({
      gameId,
      eventType: 'game_started',
      data: {
        startedAt: new Date().toISOString(),
        phase: 'initial_placement'
      },
      contextPlayerId: null
    })
  }

  private async executePlayerRemoval(gameId: string, playerId: string): Promise<{ success: boolean; error?: string }> {
    // Your existing player removal logic
    try {
      await this.eventStore.appendEvent({
        gameId,
        playerId,
        eventType: 'player_left',
        data: {
          leftAt: new Date().toISOString(),
          reason: 'manual'
        }
      })
      
      return { success: true }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to remove player' 
      }
    }
  }

  private async projectLobbyStateFromEvents(gameId: string): Promise<any> {
    // Use your existing LocalLobbyProjector
    const gameEvents = await this.eventStore.getGameEvents(gameId)
    const playerEvents = await this.eventStore.getPlayerEvents(gameId)
    
    // Your existing projection logic
    return {
      players: playerEvents.filter(e => e.eventType === 'player_joined' || e.eventType === 'ai_player_added'),
      gameCode: 'GAME123', // Extract from events
      settings: { maxPlayers: 4 }
    }
  }

  private getExpectedRoute(gameId: string, lifecycleState: any): string {
    // Deterministic routing logic
    switch (lifecycleState.status) {
      case 'lobby': return `/lobby/${gameId}`
      case 'active': return `/game/${gameId}`
      case 'ended': return `/game/${gameId}/results`
      default: return '/'
    }
  }
}

/**
 * FACTORY: Create enhanced service with lifecycle integration
 */
export function createEnhancedLobbyCommandService(eventStore: any): EnhancedLobbyCommandService {
  // Initialize lifecycle integration if needed
  getLifecycleIntegration(eventStore)
  
  return new EnhancedLobbyCommandService()
}