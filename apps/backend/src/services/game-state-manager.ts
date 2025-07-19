import { GameState, GameAction, ProcessResult, GameFlowManager, PlayerId } from '@settlers/game-engine'
import { eventStore } from '../db/event-store-repository'
import { UnifiedWebSocketServer } from '../websocket/unified-server'
import { 
  SerializedGameState, 
  createGameStateUpdateMessage, 
  createActionResultMessage 
} from '../websocket/game-messages'
import { gameConfig } from '../config/game-config'

export class GameStateManager {
  private activeGames = new Map<string, GameFlowManager>()
  private lastCleanup = Date.now()
  
  constructor(private wsServer: UnifiedWebSocketServer) {
    // Start periodic cleanup
    this.startCleanupInterval()
  }

  /**
   * Load game state from events or cache
   */
  async loadGameState(gameId: string): Promise<GameState> {
    let gameFlow = this.activeGames.get(gameId)
    
    if (!gameFlow) {
      // Reconstruct game state from events
      gameFlow = await this.reconstructGameFromEvents(gameId)
      this.activeGames.set(gameId, gameFlow)
      
      console.log(`🎮 Loaded game ${gameId} from events`)
    }
    
    return gameFlow.getState()
  }

  /**
   * Process a player action and update game state
   */
  async processPlayerAction(gameId: string, playerId: PlayerId, action: GameAction): Promise<ProcessResult> {
    const gameFlow = this.activeGames.get(gameId)
    if (!gameFlow) {
      throw new Error(`Game ${gameId} not loaded`)
    }

    const currentState = gameFlow.getState()
    
    // Validate it's the player's turn
    if (currentState.currentPlayer !== playerId) {
      return {
        success: false,
        newState: currentState,
        events: [],
        error: `Not your turn. Current player: ${currentState.currentPlayer}`
      }
    }

    // Validate action is allowed in current phase
    const validActions = gameFlow.getValidActions()
    if (!validActions.includes(action.type)) {
      return {
        success: false,
        newState: currentState,
        events: [],
        error: `Action '${action.type}' not allowed in phase '${currentState.phase}'`
      }
    }

    // Process action through game engine
    console.log(`🎮 Processing action: ${action.type} by ${playerId} in game ${gameId}`)
    const result = gameFlow.processAction(action)
    
    if (result.success) {
      // Store events in database
      await this.storeGameEvents(gameId, result.events)
      
      // Broadcast state update to all players
      await this.broadcastGameState(gameId, result.newState)
      
      // Broadcast action result
      await this.broadcastActionResult(gameId, action, result)
      
      console.log(`✅ Action ${action.type} processed successfully`)
    } else {
      console.log(`❌ Action ${action.type} failed: ${result.error}`)
    }

    return result
  }

  /**
   * Update game state directly (used by turn manager for turn transitions)
   */
  async updateGameState(gameId: string, newState: GameState): Promise<void> {
    // Create new game flow with updated state
    const gameFlow = new GameFlowManager(newState)
    this.activeGames.set(gameId, gameFlow)
    
    // Broadcast updated state
    await this.broadcastGameState(gameId, newState)
  }

  /**
   * Broadcast game state to all connected players
   */
  async broadcastGameState(gameId: string, gameState: GameState): Promise<void> {
    const serializedState = this.serializeGameState(gameState)
    const sequence = await eventStore.getCurrentSequence(gameId)
    
    const message = createGameStateUpdateMessage(gameId, serializedState, sequence)
    
    // For now, use a placeholder - we'll add broadcastToGame method next
    await this.broadcastToGameConnections(gameId, {
      success: true,
      data: message.data
    })
  }

  /**
   * Broadcast action result to all players
   */
  async broadcastActionResult(gameId: string, action: GameAction, result: ProcessResult): Promise<void> {
    const sequence = await eventStore.getCurrentSequence(gameId)
    
    const message = createActionResultMessage(gameId, action, {
      success: result.success,
      error: result.error,
      message: result.message
    })
    
    // Set sequence number
    message.data.sequence = sequence
    
    // For now, use a placeholder - we'll add broadcastToGame method next
    await this.broadcastToGameConnections(gameId, {
      success: true,
      data: message.data
    })
  }

  /**
   * Get game state for synchronization
   */
  async getGameStateSync(gameId: string): Promise<{ gameState: GameState; sequence: number }> {
    const gameState = await this.loadGameState(gameId)
    const sequence = await eventStore.getCurrentSequence(gameId)
    
    return { gameState, sequence }
  }

  /**
   * Validate game state consistency
   */
  async validateGameState(gameId: string): Promise<{ valid: boolean; errors: string[] }> {
    try {
      const gameState = await this.loadGameState(gameId)
      const errors: string[] = []
      
      // Basic validation checks
      if (!gameState.players || gameState.players.size === 0) {
        errors.push('No players in game')
      }
      
      if (!gameState.players.has(gameState.currentPlayer)) {
        errors.push(`Current player ${gameState.currentPlayer} not found in players`)
      }
      
      if (gameState.turn < 0) {
        errors.push('Invalid turn number')
      }
      
      return { valid: errors.length === 0, errors }
    } catch (error) {
      return { 
        valid: false, 
        errors: [`Failed to validate game state: ${error instanceof Error ? error.message : 'Unknown error'}`]
      }
    }
  }

  /**
   * Remove game from cache (cleanup)
   */
  removeGame(gameId: string): void {
    this.activeGames.delete(gameId)
    console.log(`🧹 Removed game ${gameId} from cache`)
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { 
    activeGames: number; 
    maxGames: number; 
    lastCleanup: Date;
    memoryUsage: string;
  } {
    return {
      activeGames: this.activeGames.size,
      maxGames: gameConfig.maxCachedGames,
      lastCleanup: new Date(this.lastCleanup),
      memoryUsage: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`
    }
  }

  // ============= Private Methods =============

  /**
   * Temporary method to broadcast to game connections - will be replaced with wsServer.broadcastToGame
   */
  private async broadcastToGameConnections(gameId: string, message: any): Promise<void> {
    // This is a temporary implementation
    // In the next step, we'll add the proper broadcastToGame method to UnifiedWebSocketServer
    console.log(`🎮 Would broadcast to game ${gameId}:`, message.data?.type || 'unknown')
    // For now, just log the message - we'll implement proper broadcasting next
  }

  /**
   * Reconstruct game flow from stored events
   */
  private async reconstructGameFromEvents(gameId: string): Promise<GameFlowManager> {
    // Get game metadata
    const game = await eventStore.getGameById(gameId)
    if (!game) {
      throw new Error(`Game ${gameId} not found`)
    }

    // Get all events for the game
    const events = await eventStore.getGameEvents(gameId)
    
    if (events.length === 0) {
      throw new Error(`No events found for game ${gameId}`)
    }

    // Find game_started event to get initial state
    const gameStartedEvent = events.find(e => e.eventType === 'game_started')
    if (!gameStartedEvent) {
      throw new Error(`Game ${gameId} has not been started yet`)
    }

    // Create initial game state from lobby data
    // This is a simplified version - in a full implementation, 
    // we'd need to convert lobby state to game state
    const playerNames = events
      .filter(e => e.eventType === 'player_joined')
      .map(e => e.data.name as string)
    
    if (playerNames.length === 0) {
      throw new Error(`No players found for game ${gameId}`)
    }

    // Create game flow manager with reconstructed state
    const gameFlow = GameFlowManager.createGame({
      playerNames,
      gameId,
      randomizePlayerOrder: true
    })

    // Apply all events after game_started to reconstruct current state
    const gameEvents = events.filter(e => 
      e.eventType !== 'player_joined' && 
      e.eventType !== 'ai_player_added' &&
      e.sequenceNumber > gameStartedEvent.sequenceNumber
    )

    for (const event of gameEvents) {
      // Convert event to game action and apply
      // This is simplified - we'd need proper event -> action conversion
      if (event.eventType === 'turn_ended') {
        // Handle turn transitions
        continue
      }
      
      // Apply other game events...
    }

    return gameFlow
  }

  /**
   * Store game events in the database
   */
  private async storeGameEvents(gameId: string, events: any[]): Promise<void> {
    if (events.length === 0) return

    try {
      for (const event of events) {
        await eventStore.appendEvent({
          gameId,
          eventType: event.type,
          data: event.data,
          playerId: event.playerId,
          contextPlayerId: event.contextPlayerId
        })
      }
    } catch (error) {
      console.error(`Failed to store events for game ${gameId}:`, error)
      throw error
    }
  }

  /**
   * Serialize game state for transmission
   */
  private serializeGameState(gameState: GameState): SerializedGameState {
    return {
      id: gameState.id,
      phase: gameState.phase,
      turn: gameState.turn,
      currentPlayer: gameState.currentPlayer,
      players: Array.from(gameState.players.entries()),
      board: this.serializeBoard(gameState.board),
      dice: gameState.dice,
      developmentDeck: gameState.developmentDeck,
      discardPile: gameState.discardPile,
      winner: gameState.winner,
      activeTrades: gameState.activeTrades,
      startedAt: gameState.startedAt.toISOString(),
      updatedAt: gameState.updatedAt.toISOString()
    }
  }

  /**
   * Serialize board for transmission (handles Map conversion)
   */
  private serializeBoard(board: any): any {
    return {
      ...board,
      hexes: Array.from(board.hexes.entries()),
      vertices: Array.from(board.vertices.entries()),
      edges: Array.from(board.edges.entries())
    }
  }

  /**
   * Start periodic cleanup of inactive games
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      this.cleanupInactiveGames()
    }, gameConfig.gameStateCleanupIntervalMs)
  }

  /**
   * Clean up inactive or completed games from cache
   */
  private cleanupInactiveGames(): void {
    const now = Date.now()
    const gamesToRemove: string[] = []
    
    // Check if we're over the cache limit
    if (this.activeGames.size > gameConfig.maxCachedGames) {
      // Remove oldest games first (simple LRU)
      const gameIds = Array.from(this.activeGames.keys())
      const excess = this.activeGames.size - gameConfig.maxCachedGames
      
      for (let i = 0; i < excess; i++) {
        gamesToRemove.push(gameIds[i])
      }
    }

    // Remove marked games
    for (const gameId of gamesToRemove) {
      this.removeGame(gameId)
    }
    
    this.lastCleanup = now
    
    if (gamesToRemove.length > 0) {
      console.log(`🧹 Cleaned up ${gamesToRemove.length} games from cache`)
    }
  }
} 