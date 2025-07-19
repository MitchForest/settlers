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
  private turnManager: any // Will be injected to avoid circular dependencies
  
  constructor(private wsServer: UnifiedWebSocketServer) {
    // Start periodic cleanup
    this.startCleanupInterval()
  }

  /**
   * Set turn manager (to avoid circular dependencies)
   */
  setTurnManager(turnManager: any): void {
    this.turnManager = turnManager
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
      
      // Check for game end conditions
      await this.checkGameEndConditions(gameId, result.newState)
      
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
   * Broadcast message to all game connections via WebSocket server
   */
  private async broadcastToGameConnections(gameId: string, message: any): Promise<void> {
    try {
      console.log(`📢 Broadcasting to game ${gameId}:`, message.data?.type || 'unknown')
      await this.wsServer.broadcastToGame(gameId, message)
    } catch (error) {
      console.error(`❌ Failed to broadcast to game ${gameId}:`, error)
    }
  }

  /**
   * Reconstruct game flow from stored events
   */
  private async reconstructGameFromEvents(gameId: string): Promise<GameFlowManager> {
    console.log(`🔄 Reconstructing game ${gameId} from events`)
    
    // Get game metadata
    const game = await eventStore.getGameById(gameId)
    if (!game) {
      throw new Error(`Game ${gameId} not found`)
    }

    // Get all events for the game in chronological order
    const events = await eventStore.getGameEvents(gameId)
    
    if (events.length === 0) {
      throw new Error(`No events found for game ${gameId}`)
    }

    console.log(`📚 Found ${events.length} events to replay`)

    // Sort events by sequence number to ensure proper order
    const sortedEvents = events.sort((a, b) => a.sequenceNumber - b.sequenceNumber)

    // Find all player_joined events to build player list
    const playerJoinedEvents = sortedEvents.filter(e => e.eventType === 'player_joined')
    if (playerJoinedEvents.length === 0) {
      throw new Error(`No players found for game ${gameId}`)
    }

    // Extract player names in join order
    const playerNames = playerJoinedEvents
      .sort((a, b) => (a.data.joinOrder as number) - (b.data.joinOrder as number))
      .map(e => e.data.name as string)

    console.log(`👥 Players: ${playerNames.join(', ')}`)

    // Check if game has been started
    const gameStartedEvent = sortedEvents.find(e => e.eventType === 'game_started')
    if (!gameStartedEvent) {
      // Game is still in lobby phase - create minimal game flow for lobby
      console.log(`🏠 Game still in lobby phase`)
      return GameFlowManager.createGame({
        playerNames,
        gameId,
        randomizePlayerOrder: false // Preserve join order during reconstruction
      })
    }

    console.log(`🎮 Game started at sequence ${gameStartedEvent.sequenceNumber}`)

    // Create initial game state
    const gameFlow = GameFlowManager.createGame({
      playerNames,
      gameId,
      randomizePlayerOrder: false // Use deterministic order for replay consistency
    })

    // Apply all events after game_started to reconstruct current state
    const gameEvents = sortedEvents.filter(e => 
      e.sequenceNumber > gameStartedEvent.sequenceNumber &&
      e.eventType !== 'player_joined' && 
      e.eventType !== 'ai_player_added'
    )

    console.log(`⚙️ Applying ${gameEvents.length} game events`)

    let appliedEvents = 0
    let failedEvents = 0

    for (const event of gameEvents) {
      try {
        const gameAction = this.convertEventToGameAction(event)
        if (gameAction) {
          console.log(`  📝 Applying event ${event.sequenceNumber}: ${event.eventType}`)
          const result = gameFlow.processAction(gameAction)
          
          if (!result.success) {
            console.warn(`  ⚠️ Event ${event.sequenceNumber} failed to apply: ${result.error}`)
            failedEvents++
          } else {
            appliedEvents++
          }
        } else {
          // Some events (like turn_ended) might not map directly to game actions
          console.log(`  ⏭️ Skipping non-action event ${event.sequenceNumber}: ${event.eventType}`)
        }
      } catch (error) {
        console.error(`  ❌ Error applying event ${event.sequenceNumber}:`, error)
        failedEvents++
      }
    }

    console.log(`✅ Event replay complete: ${appliedEvents} applied, ${failedEvents} failed`)

    // Validate final state
    const finalState = gameFlow.getState()
    if (finalState.turn < 0) {
      console.warn(`⚠️ Reconstructed game has invalid turn number: ${finalState.turn}`)
    }

    return gameFlow
  }

  /**
   * Convert a stored event back to a game action for replay
   */
  private convertEventToGameAction(event: any): any | null {
    switch (event.eventType) {
      case 'building_placed':
        return {
          type: 'placeBuilding',
          playerId: event.contextPlayerId || event.playerId,
          data: {
            buildingType: event.data.buildingType,
            vertexId: event.data.vertexId
          }
        }

      case 'road_placed':
        return {
          type: 'placeRoad',
          playerId: event.contextPlayerId || event.playerId,
          data: {
            edgeId: event.data.edgeId
          }
        }

      case 'dice_rolled':
        return {
          type: 'rollDice',
          playerId: event.contextPlayerId || event.playerId,
          data: {}
        }

      case 'card_drawn':
        return {
          type: 'buyCard',
          playerId: event.contextPlayerId || event.playerId,
          data: {}
        }

      case 'card_played':
        return {
          type: 'playCard',
          playerId: event.contextPlayerId || event.playerId,
          data: {
            cardType: event.data.cardType,
            cardData: event.data.cardData
          }
        }

      case 'trade_proposed':
        return {
          type: 'createTradeOffer',
          playerId: event.contextPlayerId || event.playerId,
          data: {
            offering: event.data.offering,
            requesting: event.data.requesting,
            targetPlayerId: event.data.targetPlayerId
          }
        }

      case 'trade_accepted':
        return {
          type: 'acceptTrade',
          playerId: event.contextPlayerId || event.playerId,
          data: {
            tradeOfferId: event.data.tradeOfferId
          }
        }

      case 'robber_moved':
        return {
          type: 'moveRobber',
          playerId: event.contextPlayerId || event.playerId,
          data: {
            hexId: event.data.hexId,
            targetPlayerId: event.data.targetPlayerId
          }
        }

      case 'turn_ended':
        return {
          type: 'endTurn',
          playerId: event.contextPlayerId || event.playerId,
          data: event.data.finalAction || {}
        }

      // Events that don't directly map to actions
      case 'resource_produced':
      case 'resources_stolen':
      case 'game_ended':
        return null

      default:
        console.warn(`⚠️ Unknown event type for replay: ${event.eventType}`)
        return null
    }
  }

  /**
   * Replay events from a specific sequence number (for incremental updates)
   */
  async replayEventsFromSequence(gameId: string, fromSequence: number): Promise<GameFlowManager> {
    console.log(`🔄 Performing incremental replay for game ${gameId} from sequence ${fromSequence}`)

    // Load current game state
    const currentGameFlow = this.activeGames.get(gameId)
    if (!currentGameFlow) {
      // No current state, do full replay
      console.log(`📚 No cached state found, performing full replay`)
      return this.reconstructGameFromEvents(gameId)
    }

    // Get events since the specified sequence
    const events = await eventStore.getGameEvents(gameId, {
      fromSequence: fromSequence + 1 // Get events after the specified sequence
    })

    if (events.length === 0) {
      console.log(`📭 No new events since sequence ${fromSequence}`)
      return currentGameFlow
    }

    console.log(`📜 Found ${events.length} new events to apply`)

    // Sort events by sequence number
    const sortedEvents = events.sort((a, b) => a.sequenceNumber - b.sequenceNumber)

    let appliedEvents = 0
    let failedEvents = 0

    for (const event of sortedEvents) {
      try {
        const gameAction = this.convertEventToGameAction(event)
        if (gameAction) {
          console.log(`  📝 Applying incremental event ${event.sequenceNumber}: ${event.eventType}`)
          const result = currentGameFlow.processAction(gameAction)
          
          if (!result.success) {
            console.warn(`  ⚠️ Incremental event ${event.sequenceNumber} failed: ${result.error}`)
            failedEvents++
          } else {
            appliedEvents++
          }
        }
      } catch (error) {
        console.error(`  ❌ Error applying incremental event ${event.sequenceNumber}:`, error)
        failedEvents++
      }
    }

    console.log(`✅ Incremental replay complete: ${appliedEvents} applied, ${failedEvents} failed`)

    return currentGameFlow
  }

  /**
   * Validate event replay integrity by comparing reconstructed state
   */
  async validateEventReplayIntegrity(gameId: string): Promise<{ valid: boolean; errors: string[] }> {
    console.log(`🔍 Validating event replay integrity for game ${gameId}`)

    try {
      // Get current cached state
      const cachedGameFlow = this.activeGames.get(gameId)
      const cachedState = cachedGameFlow?.getState()

      // Reconstruct state from scratch
      const reconstructedGameFlow = await this.reconstructGameFromEvents(gameId)
      const reconstructedState = reconstructedGameFlow.getState()

      const errors: string[] = []

      if (!cachedState) {
        // No cached state to compare
        console.log(`ℹ️ No cached state to validate against`)
        return { valid: true, errors: [] }
      }

      // Compare key game state properties
      if (cachedState.turn !== reconstructedState.turn) {
        errors.push(`Turn mismatch: cached=${cachedState.turn}, reconstructed=${reconstructedState.turn}`)
      }

      if (cachedState.currentPlayer !== reconstructedState.currentPlayer) {
        errors.push(`Current player mismatch: cached=${cachedState.currentPlayer}, reconstructed=${reconstructedState.currentPlayer}`)
      }

      if (cachedState.phase !== reconstructedState.phase) {
        errors.push(`Phase mismatch: cached=${cachedState.phase}, reconstructed=${reconstructedState.phase}`)
      }

      // Compare player scores
      for (const [playerId, cachedPlayer] of cachedState.players) {
        const reconstructedPlayer = reconstructedState.players.get(playerId)
        if (!reconstructedPlayer) {
          errors.push(`Player ${playerId} missing from reconstructed state`)
          continue
        }

        if (cachedPlayer.score.total !== reconstructedPlayer.score.total) {
          errors.push(`Player ${playerId} score mismatch: cached=${cachedPlayer.score.total}, reconstructed=${reconstructedPlayer.score.total}`)
        }
      }

      // Compare board state (simplified check - count buildings and roads)
      const cachedBuildings = Array.from(cachedState.board.vertices.values()).filter(v => v.building).length
      const reconstructedBuildings = Array.from(reconstructedState.board.vertices.values()).filter(v => v.building).length
      
      if (cachedBuildings !== reconstructedBuildings) {
        errors.push(`Building count mismatch: cached=${cachedBuildings}, reconstructed=${reconstructedBuildings}`)
      }

      const cachedRoads = Array.from(cachedState.board.edges.values()).filter(e => e.connection).length
      const reconstructedRoads = Array.from(reconstructedState.board.edges.values()).filter(e => e.connection).length
      
      if (cachedRoads !== reconstructedRoads) {
        errors.push(`Road count mismatch: cached=${cachedRoads}, reconstructed=${reconstructedRoads}`)
      }

      const isValid = errors.length === 0
      
      if (isValid) {
        console.log(`✅ Event replay integrity validation passed`)
      } else {
        console.warn(`⚠️ Event replay integrity validation failed with ${errors.length} errors`)
        errors.forEach(error => console.warn(`  - ${error}`))
      }

      return { valid: isValid, errors }

    } catch (error) {
      const errorMessage = `Event replay validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      console.error(`❌ ${errorMessage}`)
      return { valid: false, errors: [errorMessage] }
    }
  }

  /**
   * Force refresh game state from events (useful for debugging or corruption recovery)
   */
  async forceRefreshFromEvents(gameId: string): Promise<void> {
    console.log(`🔄 Force refreshing game ${gameId} from events`)

    try {
      // Remove from cache
      this.activeGames.delete(gameId)

      // Reconstruct from events
      const gameFlow = await this.reconstructGameFromEvents(gameId)
      this.activeGames.set(gameId, gameFlow)

      // Broadcast updated state to all connected clients
      await this.broadcastGameState(gameId, gameFlow.getState())

      console.log(`✅ Successfully refreshed game ${gameId} from events`)
    } catch (error) {
      console.error(`❌ Failed to refresh game ${gameId} from events:`, error)
      throw error
    }
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

  /**
   * Check for game end conditions and handle cleanup
   */
  private async checkGameEndConditions(gameId: string, gameState: GameState): Promise<void> {
    try {
      // Check if any player has won (reached victory points threshold)
      for (const [playerId, player] of gameState.players) {
        if (player.score.total >= 10) {
          console.log(`🏆 Game ${gameId} ended - ${playerId} wins with ${player.score.total} points!`)
          
          // Notify turn manager of game end
          if (this.turnManager) {
            await this.turnManager.endGame(gameId, playerId)
          }
          
          // Broadcast game end to all players
          await this.broadcastGameEnd(gameId, playerId, gameState)
          
          // Clean up game from active cache
          this.removeGame(gameId)
          return
        }
      }
      
    } catch (error) {
      console.error('Error checking game end conditions:', error)
    }
  }

  /**
   * Broadcast game end to all players
   */
  private async broadcastGameEnd(gameId: string, winnerId: string, finalState: GameState): Promise<void> {
    const message = {
      success: true,
      data: {
        type: 'gameEnded',
        gameId,
        winner: winnerId,
        finalState: this.serializeGameState(finalState),
        timestamp: new Date().toISOString()
      }
    }
    
    try {
      console.log(`🏆 Broadcasting game end for ${gameId} - winner: ${winnerId}`)
      await this.wsServer.broadcastToGame(gameId, message)
    } catch (error) {
      console.error(`❌ Failed to broadcast game end for ${gameId}:`, error)
    }
  }
} 