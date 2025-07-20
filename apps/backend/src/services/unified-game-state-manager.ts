/**
 * UNIFIED GAME STATE MANAGER
 * 
 * Integrates the lifecycle state machine with existing event sourcing
 * Replaces scattered flag-based state management with deterministic patterns
 */

import { GameLifecycleStateMachine, type GameLifecycleState, type GameLifecycleEvent, getRouteForGameState } from '../state-machines/game-lifecycle'
import { gameStateManager } from './game-state-manager'
import { turnOrchestrationService } from './turn-orchestration-service'
import { webSocketServer } from '../websocket/server'

interface GameStateSnapshot {
  gameId: string
  lifecycle: GameLifecycleState
  players: any[]
  gameData?: any
  lastUpdated: string
}

/**
 * ENTERPRISE PATTERN: Facade + State Machine + Event Sourcing
 */
export class UnifiedGameStateManager {
  private readonly stateMachines = new Map<string, GameLifecycleStateMachine>()
  private readonly stateSnapshots = new Map<string, GameStateSnapshot>()

  /**
   * GET OR CREATE STATE MACHINE FOR GAME
   */
  private getStateMachine(gameId: string): GameLifecycleStateMachine {
    if (!this.stateMachines.has(gameId)) {
      const machine = new GameLifecycleStateMachine(gameId)
      
      // Subscribe to state changes for WebSocket broadcasting
      machine.subscribe((state) => {
        this.onStateChange(gameId, state)
      })
      
      this.stateMachines.set(gameId, machine)
    }
    
    return this.stateMachines.get(gameId)!
  }

  /**
   * STATE CHANGE HANDLER (SIDE EFFECTS)
   */
  private async onStateChange(gameId: string, newState: GameLifecycleState): Promise<void> {
    console.log(`🎯 Game ${gameId} lifecycle changed:`, newState)

    // Update snapshot cache
    await this.updateStateSnapshot(gameId)

    // Broadcast to WebSocket clients
    const snapshot = this.stateSnapshots.get(gameId)
    if (snapshot) {
      await webSocketServer.broadcastToGame(gameId, {
        success: true,
        data: {
          type: 'gameStateChanged',
          gameState: snapshot,
          route: getRouteForGameState(gameId, newState)
        }
      })
    }

    // Handle specific state transitions
    await this.handleStateTransition(gameId, newState)
  }

  /**
   * HANDLE STATE-SPECIFIC SIDE EFFECTS
   */
  private async handleStateTransition(gameId: string, state: GameLifecycleState): Promise<void> {
    switch (state.status) {
      case 'active':
        // Game started - initialize turn system
        if (state.substatus === 'initial_placement_round_1') {
          await turnOrchestrationService.startGame(gameId)
        }
        break

      case 'paused':
        // Pause turn timers
        await turnOrchestrationService.pauseGame(gameId)
        break

      case 'ended':
        // Cleanup resources
        await turnOrchestrationService.endGame(gameId)
        await this.cleanup(gameId)
        break
    }
  }

  /**
   * PUBLIC API - GAME LIFECYCLE OPERATIONS
   */
  async createGame(gameId: string): Promise<GameStateSnapshot> {
    const machine = this.getStateMachine(gameId)
    await this.updateStateSnapshot(gameId)
    return this.getGameState(gameId)!
  }

  async hostJoinedGame(gameId: string): Promise<void> {
    const machine = this.getStateMachine(gameId)
    machine.send({ type: 'HOST_JOINED' })
  }

  async playerJoinedGame(gameId: string, playerId: string): Promise<void> {
    const machine = this.getStateMachine(gameId)
    machine.send({ type: 'PLAYER_JOINED', playerId })
    await this.updateStateSnapshot(gameId)
  }

  async playerLeftGame(gameId: string, playerId: string): Promise<void> {
    const machine = this.getStateMachine(gameId)
    machine.send({ type: 'PLAYER_LEFT', playerId })
    await this.updateStateSnapshot(gameId)
  }

  async startGame(gameId: string): Promise<{ success: boolean; error?: string }> {
    const machine = this.getStateMachine(gameId)
    const snapshot = this.getGameState(gameId)
    
    if (!snapshot) {
      return { success: false, error: 'Game not found' }
    }

    // Business rule validation
    if (!machine.canStart()) {
      return { success: false, error: 'Game cannot be started in current state' }
    }

    if (snapshot.players.length < 2) {
      return { success: false, error: 'Need at least 2 players to start' }
    }

    // Send events in sequence
    machine.send({ type: 'START_GAME' })
    
    // Simulate async game initialization
    setTimeout(() => {
      machine.send({ type: 'GAME_STARTED' })
    }, 1000)

    return { success: true }
  }

  async pauseGame(gameId: string, reason: string): Promise<void> {
    const machine = this.getStateMachine(gameId)
    machine.send({ type: 'GAME_PAUSED', reason })
  }

  async resumeGame(gameId: string): Promise<void> {
    const machine = this.getStateMachine(gameId)
    machine.send({ type: 'GAME_RESUMED' })
  }

  async endGame(gameId: string, reason: 'completed' | 'abandoned' | 'error', winner?: string): Promise<void> {
    const machine = this.getStateMachine(gameId)
    machine.send({ type: 'GAME_ENDED', reason, winner })
  }

  /**
   * QUERY API - DETERMINISTIC STATE ACCESS
   */
  getGameState(gameId: string): GameStateSnapshot | null {
    return this.stateSnapshots.get(gameId) || null
  }

  getLifecycleState(gameId: string): GameLifecycleState | null {
    const machine = this.stateMachines.get(gameId)
    return machine ? machine.getState() : null
  }

  canJoinGame(gameId: string): boolean {
    const machine = this.stateMachines.get(gameId)
    return machine ? machine.canJoin() : false
  }

  canStartGame(gameId: string): boolean {
    const machine = this.stateMachines.get(gameId)
    const snapshot = this.getGameState(gameId)
    return machine && snapshot ? 
      machine.canStart() && snapshot.players.length >= 2 : false
  }

  isGameInProgress(gameId: string): boolean {
    const machine = this.stateMachines.get(gameId)
    return machine ? machine.isInGame() : false
  }

  getExpectedRoute(gameId: string): string {
    const machine = this.stateMachines.get(gameId)
    if (!machine) return '/'
    
    return getRouteForGameState(gameId, machine.getState())
  }

  /**
   * INTERNAL STATE MANAGEMENT
   */
  private async updateStateSnapshot(gameId: string): Promise<void> {
    const machine = this.stateMachines.get(gameId)
    if (!machine) return

    // Get players from database/existing services
    const players = await this.loadPlayersForGame(gameId)
    
    // Get additional game data if game is active
    let gameData = null
    if (machine.isInGame()) {
      try {
        gameData = await gameStateManager.loadGameState(gameId)
      } catch (error) {
        console.warn(`Could not load game data for ${gameId}:`, error)
      }
    }

    const snapshot: GameStateSnapshot = {
      gameId,
      lifecycle: machine.getState(),
      players,
      gameData,
      lastUpdated: new Date().toISOString()
    }

    this.stateSnapshots.set(gameId, snapshot)
  }

  private async loadPlayersForGame(gameId: string): Promise<any[]> {
    // Integration with existing player loading logic
    // This would use your existing Drizzle queries
    try {
      const { db, players } = await import('../db/index')
      const { eq } = await import('drizzle-orm')
      return await db.select().from(players).where(eq(players.gameId, gameId))
    } catch (error) {
      console.error('Failed to load players:', error)
      return []
    }
  }

  /**
   * CLEANUP AND RESOURCE MANAGEMENT
   */
  private async cleanup(gameId: string): Promise<void> {
    // Remove from active caches
    this.stateMachines.delete(gameId)
    this.stateSnapshots.delete(gameId)
    
    console.log(`🧹 Cleaned up game state for ${gameId}`)
  }

  /**
   * EVENT SOURCING INTEGRATION
   */
  async restoreFromEvents(gameId: string, events: GameLifecycleEvent[]): Promise<void> {
    const machine = GameLifecycleStateMachine.fromEventHistory(gameId, events)
    
    // Subscribe to future changes
    machine.subscribe((state) => {
      this.onStateChange(gameId, state)
    })
    
    this.stateMachines.set(gameId, machine)
    await this.updateStateSnapshot(gameId)
  }

  /**
   * HEALTH AND MONITORING
   */
  getActiveGamesCount(): number {
    return this.stateMachines.size
  }

  getGameHealth(gameId: string): { status: string; lastUpdated?: string } {
    const snapshot = this.getGameState(gameId)
    const machine = this.stateMachines.get(gameId)
    
    return {
      status: machine ? `${machine.getState().status}:${machine.getState().substatus}` : 'not_found',
      lastUpdated: snapshot?.lastUpdated
    }
  }
}

// Singleton instance
export const unifiedGameStateManager = new UnifiedGameStateManager()