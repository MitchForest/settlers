import { GameState, PlayerId, GameFlowManager } from '@settlers/game-engine'
import { GameStateManager } from './game-state-manager'
import { AIIntegrationService } from './ai-integration-service'
import { gameConfig, getAIThinkingTime } from '../config/game-config'

// AI Player configuration interface
interface AIPlayerConfig {
  playerId: PlayerId
  difficulty: 'easy' | 'medium' | 'hard'
  personality: 'aggressive' | 'balanced' | 'defensive' | 'economic'
  thinkingTimeMs: number
  maxActionsPerTurn: number
  enableLogging: boolean
}

// Scheduled AI turn interface
interface ScheduledAITurn {
  gameId: string
  playerId: PlayerId
  timeoutId: NodeJS.Timeout
  scheduledAt: Date
}

export class AITurnOrchestrator {
  private aiPlayers = new Map<string, AIPlayerConfig>()
  private scheduledTurns = new Map<string, ScheduledAITurn>()
  private turnManager: any // Will be injected to avoid circular deps
  private aiIntegrationService: AIIntegrationService
  
  constructor(private gameStateManager: GameStateManager) {
    this.aiIntegrationService = new AIIntegrationService(gameStateManager)
  }

  /**
   * Set turn manager (to avoid circular dependencies)
   */
  setTurnManager(turnManager: any): void {
    this.turnManager = turnManager
  }

  /**
   * Initialize AI player for a game
   */
  async initializeAIPlayer(gameId: string, aiPlayerId: PlayerId, config: {
    difficulty: 'easy' | 'medium' | 'hard'
    personality: 'aggressive' | 'balanced' | 'defensive' | 'economic'
  }): Promise<void> {
    const aiKey = `${gameId}:${aiPlayerId}`
    
    const aiConfig: AIPlayerConfig = {
      playerId: aiPlayerId,
      personality: config.personality,
      difficulty: config.difficulty,
      thinkingTimeMs: getAIThinkingTime(config.difficulty),
      maxActionsPerTurn: 20,
      enableLogging: true
    }

    this.aiPlayers.set(aiKey, aiConfig)
    
    console.log(`🤖 Initialized AI player ${aiPlayerId} for game ${gameId} (${config.difficulty}/${config.personality})`)
  }

  /**
   * Schedule AI turn with thinking delay
   */
  async scheduleAITurn(gameId: string, aiPlayerId: PlayerId): Promise<void> {
    const aiKey = `${gameId}:${aiPlayerId}`
    const aiConfig = this.aiPlayers.get(aiKey)
    
    if (!aiConfig) {
      console.error(`AI player ${aiPlayerId} not initialized for game ${gameId}`)
      // Initialize with default config if not found
      await this.initializeAIPlayer(gameId, aiPlayerId, {
        difficulty: 'medium',
        personality: 'balanced'
      })
      return this.scheduleAITurn(gameId, aiPlayerId)
    }

    // Clear any existing scheduled turn
    const existingTurn = this.scheduledTurns.get(aiKey)
    if (existingTurn) {
      clearTimeout(existingTurn.timeoutId)
      this.scheduledTurns.delete(aiKey)
    }

    // Get thinking delay based on difficulty and add some randomness
    const baseDelay = aiConfig.thinkingTimeMs
    const randomFactor = 0.5 + Math.random() * 0.5 // 0.5x to 1.5x multiplier
    const thinkingDelay = Math.round(baseDelay * randomFactor)

    console.log(`🤖 Scheduling AI turn for ${aiPlayerId} in ${thinkingDelay}ms`)

    // Schedule AI action
    const timeoutId = setTimeout(async () => {
      await this.executeAITurn(gameId, aiPlayerId)
    }, thinkingDelay)

    const scheduledTurn: ScheduledAITurn = {
      gameId,
      playerId: aiPlayerId,
      timeoutId,
      scheduledAt: new Date()
    }

    this.scheduledTurns.set(aiKey, scheduledTurn)
  }

  /**
   * Execute AI turn immediately
   */
  async executeAITurn(gameId: string, aiPlayerId: PlayerId): Promise<void> {
    const aiKey = `${gameId}:${aiPlayerId}`
    const aiConfig = this.aiPlayers.get(aiKey)
    
    if (!aiConfig) {
      console.error(`AI player ${aiPlayerId} not found for game ${gameId}`)
      return
    }

    try {
      console.log(`🤖 Executing AI turn for ${aiPlayerId} in game ${gameId}`)

      // Clear the scheduled turn
      this.scheduledTurns.delete(aiKey)

      // Get current game state
      const gameState = await this.gameStateManager.loadGameState(gameId)
      
      // Verify it's actually this AI's turn
      if (gameState.currentPlayer !== aiPlayerId) {
        console.log(`🤖 Not ${aiPlayerId}'s turn anymore (current: ${gameState.currentPlayer}), skipping`)
        return
      }

      // Execute AI turn based on current phase
      await this.executeAIActionForPhase(gameId, aiPlayerId, gameState, aiConfig)
      
      console.log(`✅ AI turn completed for ${aiPlayerId}`)

    } catch (error) {
      console.error(`❌ Error executing AI turn for ${aiPlayerId}:`, error)
      await this.forceEndAITurn(gameId, aiPlayerId)
    }
  }

  /**
   * Pause AI for a game
   */
  async pauseAI(gameId: string, aiPlayerId: PlayerId): Promise<void> {
    const aiKey = `${gameId}:${aiPlayerId}`
    const scheduledTurn = this.scheduledTurns.get(aiKey)
    
    if (scheduledTurn) {
      console.log(`⏸️ Pausing AI ${aiPlayerId} for game ${gameId}`)
      clearTimeout(scheduledTurn.timeoutId)
      this.scheduledTurns.delete(aiKey)
    }
  }

  /**
   * Resume AI for a game  
   */
  async resumeAI(gameId: string, aiPlayerId: PlayerId): Promise<void> {
    console.log(`▶️ Resuming AI ${aiPlayerId} for game ${gameId}`)
    
    // Re-schedule AI turn if it's their turn
    const gameState = await this.gameStateManager.loadGameState(gameId)
    if (gameState.currentPlayer === aiPlayerId) {
      await this.scheduleAITurn(gameId, aiPlayerId)
    }
  }

  /**
   * Update AI configuration
   */
  async updateAIConfig(gameId: string, aiPlayerId: PlayerId, updates: Partial<AIPlayerConfig>): Promise<void> {
    const aiKey = `${gameId}:${aiPlayerId}`
    const aiConfig = this.aiPlayers.get(aiKey)
    
    if (aiConfig) {
      const updatedConfig = { ...aiConfig, ...updates }
      this.aiPlayers.set(aiKey, updatedConfig)
      console.log(`🔧 Updated AI config for ${aiPlayerId}:`, updates)
    }
  }

  /**
   * Remove AI player from orchestrator
   */
  removeAIPlayer(gameId: string, aiPlayerId: PlayerId): void {
    const aiKey = `${gameId}:${aiPlayerId}`
    
    // Clear any scheduled turn
    const scheduledTurn = this.scheduledTurns.get(aiKey)
    if (scheduledTurn) {
      clearTimeout(scheduledTurn.timeoutId)
      this.scheduledTurns.delete(aiKey)
    }
    
    // Remove AI config
    this.aiPlayers.delete(aiKey)
    
    console.log(`🗑️ Removed AI player ${aiPlayerId} from game ${gameId}`)
  }

  /**
   * Get AI statistics
   */
  getAIStats(): {
    totalAIPlayers: number
    scheduledTurns: number
    aiByDifficulty: Record<string, number>
    aiByPersonality: Record<string, number>
  } {
    const difficulties: Record<string, number> = {}
    const personalities: Record<string, number> = {}
    
    for (const aiConfig of this.aiPlayers.values()) {
      difficulties[aiConfig.difficulty] = (difficulties[aiConfig.difficulty] || 0) + 1
      personalities[aiConfig.personality] = (personalities[aiConfig.personality] || 0) + 1
    }
    
    return {
      totalAIPlayers: this.aiPlayers.size,
      scheduledTurns: this.scheduledTurns.size,
      aiByDifficulty: difficulties,
      aiByPersonality: personalities
    }
  }

  // ============= Private Methods =============

  /**
   * Execute AI action based on current game phase
   */
  private async executeAIActionForPhase(
    gameId: string, 
    aiPlayerId: PlayerId, 
    gameState: GameState, 
    aiConfig: AIPlayerConfig
  ): Promise<void> {
    
    switch (gameState.phase) {
      case 'roll':
        await this.executeAIRoll(gameId, aiPlayerId)
        break
        
      case 'actions':
        await this.executeAIMainActions(gameId, aiPlayerId, aiConfig)
        break
        
      case 'setup1':
      case 'setup2':
        await this.executeAISetupActions(gameId, aiPlayerId, gameState.phase)
        break
        
      case 'discard':
        await this.executeAIDiscard(gameId, aiPlayerId, gameState)
        break
        
      case 'moveRobber':
        await this.executeAIMoveRobber(gameId, aiPlayerId)
        break
        
      case 'steal':
        await this.executeAISteal(gameId, aiPlayerId)
        break
        
      default:
        console.log(`🤖 AI ${aiPlayerId}: Unknown phase ${gameState.phase}, ending turn`)
        await this.endAITurn(gameId, aiPlayerId)
    }
  }

  /**
   * Execute AI dice roll
   */
  private async executeAIRoll(gameId: string, aiPlayerId: PlayerId): Promise<void> {
    const rollAction = {
      type: 'roll' as const,
      playerId: aiPlayerId,
      data: {}
    }
    
    const result = await this.gameStateManager.processPlayerAction(gameId, aiPlayerId, rollAction)
    if (!result.success) {
      console.error(`🤖 AI roll failed for ${aiPlayerId}: ${result.error}`)
    }
  }

  /**
   * Execute AI main game actions
   */
  private async executeAIMainActions(gameId: string, aiPlayerId: PlayerId, aiConfig: AIPlayerConfig): Promise<void> {
    let actionCount = 0
    const maxActions = aiConfig.maxActionsPerTurn
    
    while (actionCount < maxActions) {
      // Get current game state
      const gameState = await this.gameStateManager.loadGameState(gameId)
      
      // Check if still our turn
      if (gameState.currentPlayer !== aiPlayerId) {
        console.log(`🤖 Turn ended for ${aiPlayerId}`)
        break
      }
      
      // Get AI decision using the AI system
      const action = await this.getAIDecision(gameId, aiPlayerId, gameState, aiConfig)
      
      if (!action || action.type === 'endTurn') {
        console.log(`🤖 AI ${aiPlayerId} ending turn`)
        await this.endAITurn(gameId, aiPlayerId)
        break
      }
      
      // Execute the action
      const result = await this.gameStateManager.processPlayerAction(gameId, aiPlayerId, action)
      
      if (result.success) {
        console.log(`🤖 AI ${aiPlayerId} executed: ${action.type}`)
        actionCount++
        
        // Add small delay between actions for realism
        if (actionCount < maxActions) {
          await this.delay(500 + Math.random() * 1000) // 0.5-1.5s delay
        }
      } else {
        console.log(`🤖 AI action failed for ${aiPlayerId}: ${result.error}`)
        // If action failed, try to end turn
        await this.endAITurn(gameId, aiPlayerId)
        break
      }
    }
    
    // If we've reached max actions, end turn
    if (actionCount >= maxActions) {
      console.log(`🤖 AI ${aiPlayerId} reached max actions (${maxActions}), ending turn`)
      await this.endAITurn(gameId, aiPlayerId)
    }
  }

  /**
   * Execute AI setup actions (initial placement)
   */
  private async executeAISetupActions(gameId: string, aiPlayerId: PlayerId, phase: 'setup1' | 'setup2'): Promise<void> {
    // For setup phases, AI needs to place settlement + road
    // This is a simplified implementation - in reality, we'd use the full AI system
    
    // Try to place settlement first
    const settlementAction = {
      type: 'build' as const,
      playerId: aiPlayerId,
      data: {
        buildingType: 'settlement',
        position: this.getRandomVertexPosition() // Simplified - should use AI logic
      }
    }
    
    const settlementResult = await this.gameStateManager.processPlayerAction(gameId, aiPlayerId, settlementAction)
    
    if (settlementResult.success) {
      // Small delay
      await this.delay(1000)
      
      // Try to place road
      const roadAction = {
        type: 'build' as const,
        playerId: aiPlayerId,
        data: {
          buildingType: 'road',
          position: this.getRandomEdgePosition() // Simplified - should use AI logic
        }
      }
      
      await this.gameStateManager.processPlayerAction(gameId, aiPlayerId, roadAction)
    }
    
    // Setup turns auto-advance, no need to explicitly end turn
  }

  /**
   * Execute AI discard action
   */
  private async executeAIDiscard(gameId: string, aiPlayerId: PlayerId, gameState: GameState): Promise<void> {
    const player = gameState.players.get(aiPlayerId)
    if (!player) return
    
    const totalResources = Object.values(player.resources).reduce((a, b) => a + b, 0)
    const mustDiscard = Math.floor(totalResources / 2)
    
    if (mustDiscard > 0) {
      // Simple random discard - in reality, we'd use AI logic
      const discardAction = {
        type: 'discard' as const,
        playerId: aiPlayerId,
        data: {
          resources: this.generateRandomDiscard(player.resources, mustDiscard)
        }
      }
      
      await this.gameStateManager.processPlayerAction(gameId, aiPlayerId, discardAction)
    }
  }

  /**
   * Execute AI move robber action
   */
  private async executeAIMoveRobber(gameId: string, aiPlayerId: PlayerId): Promise<void> {
    // Simplified implementation
    const moveRobberAction = {
      type: 'moveRobber' as const,
      playerId: aiPlayerId,
      data: {
        position: this.getRandomHexPosition() // Should use AI logic
      }
    }
    
    await this.gameStateManager.processPlayerAction(gameId, aiPlayerId, moveRobberAction)
  }

  /**
   * Execute AI steal action
   */
  private async executeAISteal(gameId: string, aiPlayerId: PlayerId): Promise<void> {
    // Simplified implementation
    const stealAction = {
      type: 'stealResource' as const,
      playerId: aiPlayerId,
      data: {
        targetPlayerId: 'opponent1' // Should use AI logic to pick target
      }
    }
    
    const result = await this.gameStateManager.processPlayerAction(gameId, aiPlayerId, stealAction)
    
    if (!result.success) {
      // If steal fails, end turn
      await this.endAITurn(gameId, aiPlayerId)
    }
  }

  /**
   * Get AI decision using the AI system
   */
  private async getAIDecision(
    gameId: string, 
    aiPlayerId: PlayerId, 
    gameState: GameState, 
    aiConfig: AIPlayerConfig
  ): Promise<any> {
    try {
      // Use the new AI integration service instead of placeholder logic
      return await this.aiIntegrationService.getAIAction(gameId, aiPlayerId, gameState)
    } catch (error) {
      console.error(`Error getting AI decision for ${aiPlayerId}:`, error)
      return { type: 'endTurn', playerId: aiPlayerId, data: {} }
    }
  }

  /**
   * End AI turn
   */
  private async endAITurn(gameId: string, aiPlayerId: PlayerId): Promise<void> {
    if (this.turnManager) {
      await this.turnManager.endTurn(gameId, aiPlayerId)
    } else {
      console.error('Turn manager not set, cannot end AI turn')
    }
  }

  /**
   * Force end AI turn in case of errors
   */
  private async forceEndAITurn(gameId: string, aiPlayerId: PlayerId): Promise<void> {
    try {
      await this.endAITurn(gameId, aiPlayerId)
    } catch (error) {
      console.error(`Failed to force end AI turn for ${aiPlayerId}:`, error)
    }
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // Simplified helper methods - would be replaced with proper game logic
  private getRandomVertexPosition(): string {
    return `vertex_${Math.floor(Math.random() * 54)}` // 54 vertices on standard board
  }

  private getRandomEdgePosition(): string {
    return `edge_${Math.floor(Math.random() * 72)}` // 72 edges on standard board
  }

  private getRandomHexPosition(): string {
    return `hex_${Math.floor(Math.random() * 19)}` // 19 hexes on standard board
  }

  private generateRandomDiscard(resources: any, count: number): any {
    const discard: any = {}
    const resourceTypes = Object.keys(resources).filter(r => resources[r] > 0)
    
    for (let i = 0; i < count && resourceTypes.length > 0; i++) {
      const randomResource = resourceTypes[Math.floor(Math.random() * resourceTypes.length)]
      discard[randomResource] = (discard[randomResource] || 0) + 1
      resources[randomResource]--
      
      if (resources[randomResource] === 0) {
        resourceTypes.splice(resourceTypes.indexOf(randomResource), 1)
      }
    }
    
    return discard
  }
} 