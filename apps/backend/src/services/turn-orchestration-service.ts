import { GameStateManager } from './game-state-manager'
import { TurnManager } from './turn-manager'
import { AITurnOrchestrator } from './ai-turn-orchestrator'
// WebSocket server type (avoid circular dependency)
import type { UnifiedWebSocketServer } from '../websocket/server'
import { GameState, PlayerId } from '@settlers/game-engine'
import { gameConfig } from '../config/game-config'

/**
 * Turn Orchestration Service
 * 
 * This is the main service that coordinates all turn management components:
 * - GameStateManager: Handles game state loading, processing, and broadcasting
 * - TurnManager: Manages turn timers, transitions, and player controls
 * - AITurnOrchestrator: Manages AI players and their automated turns
 * 
 * This service provides a unified interface for all turn-related operations
 * and ensures proper initialization and lifecycle management.
 */
export class TurnOrchestrationService {
  private gameStateManager: GameStateManager
  private turnManager: TurnManager
  private aiOrchestrator: AITurnOrchestrator
  private isInitialized = false

  constructor(private wsServer: UnifiedWebSocketServer) {
    // Initialize all components
    this.gameStateManager = new GameStateManager(wsServer)
    this.turnManager = new TurnManager(this.gameStateManager, wsServer)
    this.aiOrchestrator = new AITurnOrchestrator(this.gameStateManager)
    
    // Set up cross-references to avoid circular dependencies
    this.turnManager.setAIOrchestrator(this.aiOrchestrator)
    this.aiOrchestrator.setTurnManager(this.turnManager)
  }

  /**
   * Initialize the turn orchestration service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('🎮 Turn orchestration service already initialized')
      return
    }

    console.log('🚀 Initializing turn orchestration service...')

    // Validate configuration using the helper function
    const { isValidGameConfig } = await import('../config/game-config')
    if (!isValidGameConfig()) {
      throw new Error('Invalid game configuration detected')
    }

    // Log initialization details
    console.log('📊 Turn Management Configuration:')
    console.log(`  - Default turn timeout: ${gameConfig.defaultTurnTimeMs}ms`)
    console.log(`  - Max players per game: ${gameConfig.maxPlayersPerGame}`)
    console.log(`  - Max AI players: ${gameConfig.maxAIPlayersPerGame}`)
    console.log(`  - Max cached games: ${gameConfig.maxCachedGames}`)

    this.isInitialized = true
    console.log('✅ Turn orchestration service initialized successfully')
  }

  /**
   * Start a new game and initialize turn management
   */
  async startGameTurnManagement(gameId: string, initialPlayerId: PlayerId): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Turn orchestration service not initialized')
    }

    console.log(`🎮 Starting turn management for game ${gameId}`)

    try {
      // Load initial game state
      const gameState = await this.gameStateManager.loadGameState(gameId)
      
      // Initialize AI players in the game
      await this.initializeAIPlayers(gameId, gameState)
      
      // Start first turn
      await this.turnManager.startTurn(gameId, initialPlayerId)
      
      console.log(`✅ Turn management started for game ${gameId}`)
    } catch (error) {
      console.error(`❌ Failed to start turn management for game ${gameId}:`, error)
      throw error
    }
  }

  /**
   * Handle player action (called from WebSocket handlers)
   */
  async handlePlayerAction(gameId: string, playerId: PlayerId, action: any): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('Turn orchestration service not initialized')
    }

    return this.gameStateManager.processPlayerAction(gameId, playerId, action)
  }

  /**
   * Handle turn end (called from WebSocket handlers)
   */
  async handleTurnEnd(gameId: string, playerId: PlayerId, finalAction?: any): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Turn orchestration service not initialized')
    }

    await this.turnManager.endTurn(gameId, playerId, finalAction)
  }

  /**
   * Get game state synchronization data
   */
  async getGameSync(gameId: string): Promise<{ gameState: GameState; sequence: number }> {
    if (!this.isInitialized) {
      throw new Error('Turn orchestration service not initialized')
    }

    return this.gameStateManager.getGameStateSync(gameId)
  }

  /**
   * Pause game turn management
   */
  async pauseGame(gameId: string, reason: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Turn orchestration service not initialized')
    }

    console.log(`⏸️ Pausing game ${gameId}: ${reason}`)
    await this.turnManager.pauseGame(gameId, reason)
  }

  /**
   * Resume game turn management
   */
  async resumeGame(gameId: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Turn orchestration service not initialized')
    }

    console.log(`▶️ Resuming game ${gameId}`)
    await this.turnManager.resumeGame(gameId)
  }

  /**
   * Add AI player to a game
   */
  async addAIPlayerToGame(gameId: string, aiPlayerId: PlayerId, config: {
    difficulty: 'easy' | 'medium' | 'hard'
    personality: 'aggressive' | 'balanced' | 'defensive' | 'economic'
  }): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Turn orchestration service not initialized')
    }

    await this.aiOrchestrator.initializeAIPlayer(gameId, aiPlayerId, config)
    console.log(`🤖 Added AI player ${aiPlayerId} to game ${gameId}`)
  }

  /**
   * Remove AI player from a game
   */
  async removeAIPlayerFromGame(gameId: string, aiPlayerId: PlayerId): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Turn orchestration service not initialized')
    }

    this.aiOrchestrator.removeAIPlayer(gameId, aiPlayerId)
    console.log(`🗑️ Removed AI player ${aiPlayerId} from game ${gameId}`)
  }

  /**
   * Get comprehensive status of turn management
   */
  getStatus(): {
    initialized: boolean
    gameStateCache: any
    aiStats: any
    config: typeof gameConfig
  } {
    return {
      initialized: this.isInitialized,
      gameStateCache: this.gameStateManager.getCacheStats(),
      aiStats: this.aiOrchestrator.getAIStats(),
      config: gameConfig
    }
  }

  /**
   * Get turn state for a specific game
   */
  getTurnState(gameId: string): any {
    if (!this.isInitialized) {
      return null
    }

    return {
      turnState: this.turnManager.getTurnState(gameId),
      remainingTime: this.turnManager.getRemainingTime(gameId)
    }
  }

  /**
   * Validate game state consistency
   */
  async validateGameState(gameId: string): Promise<{ valid: boolean; errors: string[] }> {
    if (!this.isInitialized) {
      return { valid: false, errors: ['Turn orchestration service not initialized'] }
    }

    return this.gameStateManager.validateGameState(gameId)
  }

  /**
   * Clean up game resources (called when game ends)
   */
  async cleanupGame(gameId: string): Promise<void> {
    if (!this.isInitialized) {
      return
    }

    console.log(`🧹 Cleaning up turn management for game ${gameId}`)

    try {
      // Remove from game state cache
      this.gameStateManager.removeGame(gameId)
      
      // Clean up AI players
      const gameState = await this.gameStateManager.loadGameState(gameId).catch(() => null)
      if (gameState) {
        for (const [playerId, player] of gameState.players.entries()) {
          if (player.isAI) {
            this.aiOrchestrator.removeAIPlayer(gameId, playerId)
          }
        }
      }
      
      console.log(`✅ Cleaned up game ${gameId}`)
    } catch (error) {
      console.error(`❌ Error cleaning up game ${gameId}:`, error)
    }
  }

  /**
   * Shutdown the turn orchestration service
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return
    }

    console.log('🛑 Shutting down turn orchestration service...')

    // Clean up any remaining resources
    // The individual services will handle their own cleanup

    this.isInitialized = false
    console.log('✅ Turn orchestration service shut down')
  }

  // ============= Private Methods =============

  /**
   * Initialize AI players found in the game state
   */
  private async initializeAIPlayers(gameId: string, gameState: GameState): Promise<void> {
    for (const [playerId, player] of gameState.players.entries()) {
      if (player.isAI) {
        // Extract AI configuration from player data or use defaults
        // For now, use default values - in the future, these would be stored in player metadata
        const difficulty = 'medium' as 'easy' | 'medium' | 'hard'
        const personality = 'balanced' as 'aggressive' | 'balanced' | 'defensive' | 'economic'
        
        await this.aiOrchestrator.initializeAIPlayer(gameId, playerId, {
          difficulty,
          personality
        })
        
        console.log(`🤖 Initialized existing AI player ${playerId} (${difficulty}/${personality})`)
      }
    }
  }
}

// Singleton instance for the turn orchestration service
let turnOrchestrationInstance: TurnOrchestrationService | null = null

/**
 * Get or create the turn orchestration service instance
 */
export function getTurnOrchestrationService(wsServer?: UnifiedWebSocketServer): TurnOrchestrationService {
  if (!turnOrchestrationInstance) {
    if (!wsServer) {
      throw new Error('WebSocket server required to create turn orchestration service')
    }
    turnOrchestrationInstance = new TurnOrchestrationService(wsServer)
  }
  return turnOrchestrationInstance
}

/**
 * Initialize the global turn orchestration service
 */
export async function initializeTurnOrchestration(wsServer: UnifiedWebSocketServer): Promise<TurnOrchestrationService> {
  const service = getTurnOrchestrationService(wsServer)
  await service.initialize()
  return service
} 