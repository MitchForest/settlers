import { GameState, GameAction, PlayerId } from '@settlers/game-engine'
import { SimpleNextVPStrategy, InitialPlacementStrategy, getSimplePhaseAction } from '@settlers/ai-framework'
import { GameStateManager } from './game-state-manager'

/**
 * AI Integration Service
 * 
 * Bridges the gap between backend's game state management and the ai-framework bots.
 * Creates and manages AI bot instances for games.
 */
export class AIIntegrationService {
  private activeBots = new Map<string, AIBotInstance>()
  private gameStateManager: GameStateManager

  constructor(gameStateManager: GameStateManager) {
    this.gameStateManager = gameStateManager
  }

  /**
   * Initialize an AI bot for a game
   */
  async initializeBot(gameId: string, playerId: PlayerId, config: {
    difficulty?: 'easy' | 'medium' | 'hard'
    personality?: 'aggressive' | 'balanced' | 'defensive' | 'economic'
  }): Promise<void> {
    const botKey = `${gameId}:${playerId}`
    
    // Create bot instance with strategies
    const bot: AIBotInstance = {
      playerId,
      gameId,
      difficulty: config.difficulty || 'medium',
      personality: config.personality || 'balanced',
      setupStrategy: new InitialPlacementStrategy(),
      actionStrategy: new SimpleNextVPStrategy(),
      thinkingTimeMs: this.getThinkingTimeForDifficulty(config.difficulty || 'medium')
    }
    
    this.activeBots.set(botKey, bot)
    
    console.log(`🤖 Initialized AI bot ${playerId} for game ${gameId} (difficulty: ${config.difficulty})`)
  }

  /**
   * Get AI action for a player
   */
  async getAIAction(gameId: string, playerId: PlayerId, gameState: GameState): Promise<GameAction | null> {
    const botKey = `${gameId}:${playerId}`
    const bot = this.activeBots.get(botKey)
    
    if (!bot) {
      console.error(`No AI bot found for ${playerId} in game ${gameId}`)
      return null
    }

    // Validate game state before processing
    if (!this.isValidGameState(gameState)) {
      console.error(`[AI Integration] Invalid game state for ${playerId} in game ${gameId}`)
      return null
    }

    try {
      // Select action based on game phase
      const action = this.selectActionForPhase(bot, gameState)
      
      if (action) {
        console.log(`🤖 AI ${playerId} selected action: ${action.type}`)
      } else {
        console.log(`🤖 AI ${playerId} has no valid actions`)
      }
      
      return action
    } catch (error) {
      console.error(`Error getting AI action for ${playerId}:`, error)
      return null
    }
  }

  /**
   * Select action based on current game phase
   */
  private selectActionForPhase(bot: AIBotInstance, gameState: GameState): GameAction | null {
    const phase = gameState.phase

    // Setup phases - use setup strategy
    if (phase === 'setup1' || phase === 'setup2') {
      return this.selectSetupAction(bot, gameState, phase)
    }

    // Main game phase - use action strategy
    if (phase === 'actions') {
      return bot.actionStrategy.selectBestAction(gameState, bot.playerId)
    }

    // Other phases (roll, discard, moveRobber, steal) - use helper functions
    return getSimplePhaseAction(gameState, bot.playerId)
  }

  /**
   * Handle setup phase actions
   */
  private selectSetupAction(bot: AIBotInstance, gameState: GameState, phase: 'setup1' | 'setup2'): GameAction | null {
    const player = gameState.players.get(bot.playerId)
    if (!player) return null

    // Check if we need to place a settlement
    const needsSettlement = this.needsSettlementForPhase(player, phase)
    if (needsSettlement) {
      const vertexId = phase === 'setup1' 
        ? bot.setupStrategy.selectFirstSettlement(gameState, bot.playerId)
        : bot.setupStrategy.selectSecondSettlement(gameState, bot.playerId)
      
      return {
        type: 'build',
        playerId: bot.playerId,
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
      const lastSettlement = this.getLastPlacedSettlement(player)
      if (lastSettlement) {
        const edgeId = phase === 'setup1'
          ? bot.setupStrategy.selectFirstRoad(gameState, bot.playerId, lastSettlement)
          : bot.setupStrategy.selectSecondRoad(gameState, bot.playerId, lastSettlement)
        
        if (edgeId) {
          return {
            type: 'build',
            playerId: bot.playerId,
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

  // Helper methods for setup phase logic
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

  private getLastPlacedSettlement(player: any): string | null {
    const settlements = player.buildings?.settlements || []
    return settlements.length > 0 ? settlements[settlements.length - 1] : null
  }

  /**
   * Remove AI bot from a game
   */
  removeBot(gameId: string, playerId: PlayerId): void {
    const botKey = `${gameId}:${playerId}`
    this.activeBots.delete(botKey)
    console.log(`🤖 Removed AI bot ${playerId} from game ${gameId}`)
  }

  /**
   * Remove all bots from a game
   */
  removeAllBotsFromGame(gameId: string): void {
    for (const [botKey] of this.activeBots) {
      if (botKey.startsWith(`${gameId}:`)) {
        this.activeBots.delete(botKey)
      }
    }
    console.log(`🤖 Removed all AI bots from game ${gameId}`)
  }

  /**
   * Check if a player is an AI bot
   */
  isAIBot(gameId: string, playerId: PlayerId): boolean {
    const botKey = `${gameId}:${playerId}`
    return this.activeBots.has(botKey)
  }

  /**
   * Get stats for all active bots
   */
  getStats() {
    return {
      totalActiveBots: this.activeBots.size,
      activeBotsByGame: this.getActiveBotsByGame()
    }
  }

  private getActiveBotsByGame(): Record<string, string[]> {
    const result: Record<string, string[]> = {}
    
    for (const [botKey] of this.activeBots) {
      const [gameId, playerId] = botKey.split(':')
      if (!result[gameId]) {
        result[gameId] = []
      }
      result[gameId].push(playerId)
    }
    
    return result
  }

  /**
   * Validate game state for AI processing
   */
  private isValidGameState(gameState: GameState): boolean {
    if (!gameState) {
      console.error('[AI Integration] GameState is null or undefined')
      return false
    }

    if (!gameState.board) {
      console.error('[AI Integration] GameState missing board')
      return false
    }

    if (!gameState.board.vertices || !gameState.board.edges) {
      console.error('[AI Integration] GameState missing board vertices or edges')
      return false
    }

    if (!gameState.players || gameState.players.size === 0) {
      console.error('[AI Integration] GameState missing players')
      return false
    }

    if (!gameState.phase) {
      console.error('[AI Integration] GameState missing phase')
      return false
    }

    return true
  }

  private getThinkingTimeForDifficulty(difficulty: 'easy' | 'medium' | 'hard'): number {
    switch (difficulty) {
      case 'easy': return 2000   // 2 seconds
      case 'medium': return 1500 // 1.5 seconds  
      case 'hard': return 1000   // 1 second
      default: return 1500
    }
  }
}

/**
 * AI Bot Instance - represents a configured bot for a specific game
 */
interface AIBotInstance {
  playerId: PlayerId
  gameId: string
  difficulty: 'easy' | 'medium' | 'hard'
  personality: 'aggressive' | 'balanced' | 'defensive' | 'economic'
  setupStrategy: InitialPlacementStrategy
  actionStrategy: SimpleNextVPStrategy
  thinkingTimeMs: number
} 