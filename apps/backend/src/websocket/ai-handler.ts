import type { ServerWebSocket } from 'bun'
import { 
  GameFlowManager, 
  createAutoPlayer, 
  AutoPlayer, 
  AutoPlayerConfig, 
  PlayerId,
  GameState,
  GamePhase 
} from '@settlers/core'
import { games, db } from '../db'
import { eq } from 'drizzle-orm'
import { prepareGameStateForDB, loadGameStateFromDB } from '../db/game-state-serializer'
import type { WSData } from './server'

/**
 * AI Player Management System for WebSocket Games
 * 
 * Handles:
 * - Auto-mode for players who request AI assistance
 * - Automatic AI takeover for disconnected players
 * - AI replacement for walkaway scenarios
 * - Real-time AI turn execution via WebSocket
 */

export interface AIPlayerEntry {
  autoPlayer: AutoPlayer
  gameId: string
  playerId: PlayerId
  isDisconnectedPlayer: boolean  // True if AI is covering for disconnected player
  isAutoMode: boolean           // True if player requested auto-mode
  lastActionTime: Date
}

export interface AIGameContext {
  gameManager: GameFlowManager
  gameId: string
  aiPlayers: Map<PlayerId, AIPlayerEntry>
  activeSocketsByPlayer: Map<PlayerId, ServerWebSocket<WSData>>
  lastAIProcessTime: Date
  isProcessing: boolean
}

// Global AI management
class AIManager {
  private aiGames = new Map<string, AIGameContext>()
  private processInterval: Timer | null = null
  private isRunning = false

  constructor() {
    this.startProcessLoop()
  }

  /**
   * Start the AI processing loop
   */
  private startProcessLoop(): void {
    if (this.isRunning) return
    
    this.isRunning = true
    this.processInterval = setInterval(async () => {
      await this.processAllAITurns()
    }, 1000) // Check every second for AI turns
    
    console.log('🤖 AI Manager started')
  }

  /**
   * Stop the AI processing loop
   */
  stopProcessLoop(): void {
    if (this.processInterval) {
      clearInterval(this.processInterval)
      this.processInterval = null
    }
    this.isRunning = false
    console.log('🤖 AI Manager stopped')
  }

  /**
   * Register a game for AI management
   */
  registerGame(gameId: string, gameManager: GameFlowManager): void {
    if (this.aiGames.has(gameId)) return

    const context: AIGameContext = {
      gameManager,
      gameId,
      aiPlayers: new Map(),
      activeSocketsByPlayer: new Map(),
      lastAIProcessTime: new Date(),
      isProcessing: false
    }

    this.aiGames.set(gameId, context)
    console.log(`🤖 Registered game ${gameId} for AI management`)
  }

  /**
   * Unregister a game from AI management
   */
  unregisterGame(gameId: string): void {
    const context = this.aiGames.get(gameId)
    if (!context) return

    // Clean up all AI players for this game
    for (const [playerId, aiEntry] of context.aiPlayers) {
      aiEntry.autoPlayer.forceStop()
    }

    this.aiGames.delete(gameId)
    console.log(`🤖 Unregistered game ${gameId} from AI management`)
  }

  /**
   * Enable auto-mode for a player
   */
  enableAutoMode(
    gameId: string, 
    playerId: PlayerId,
    config?: Partial<AutoPlayerConfig>
  ): boolean {
    const context = this.aiGames.get(gameId)
    if (!context) {
      console.error(`🤖 Cannot enable auto-mode: game ${gameId} not registered`)
      return false
    }

    try {
      // Create AI player with custom config
      const aiConfig: AutoPlayerConfig = {
        playerId,
        personality: 'balanced',
        difficulty: 'medium',
        thinkingTimeMs: 2000,     // 2 second thinking time for auto-mode
        maxActionsPerTurn: 15,
        enableLogging: true,
        ...config
      }

      const autoPlayer = createAutoPlayer(context.gameManager, playerId, aiConfig)

      const aiEntry: AIPlayerEntry = {
        autoPlayer,
        gameId,
        playerId,
        isDisconnectedPlayer: false,
        isAutoMode: true,
        lastActionTime: new Date()
      }

      context.aiPlayers.set(playerId, aiEntry)
      console.log(`🤖 Enabled auto-mode for player ${playerId} in game ${gameId}`)
      return true

    } catch (error) {
      console.error(`🤖 Failed to enable auto-mode for ${playerId}:`, error)
      return false
    }
  }

  /**
   * Disable auto-mode for a player
   */
  disableAutoMode(gameId: string, playerId: PlayerId): boolean {
    const context = this.aiGames.get(gameId)
    if (!context) return false

    const aiEntry = context.aiPlayers.get(playerId)
    if (!aiEntry || !aiEntry.isAutoMode) return false

    // Stop AI processing
    aiEntry.autoPlayer.forceStop()
    context.aiPlayers.delete(playerId)

    console.log(`🤖 Disabled auto-mode for player ${playerId} in game ${gameId}`)
    return true
  }

  /**
   * Handle player disconnection - enable AI takeover
   */
  handlePlayerDisconnection(gameId: string, playerId: PlayerId): void {
    const context = this.aiGames.get(gameId)
    if (!context) return

    // Remove from active sockets
    context.activeSocketsByPlayer.delete(playerId)

    // Don't create AI for players already in auto-mode
    if (context.aiPlayers.has(playerId)) return

    try {
      // Create AI to cover for disconnected player
      const aiConfig: AutoPlayerConfig = {
        playerId,
        personality: 'balanced',
        difficulty: 'easy',       // Use easy mode for disconnected players
        thinkingTimeMs: 3000,     // 3 second thinking time
        maxActionsPerTurn: 12,
        enableLogging: true
      }

      const autoPlayer = createAutoPlayer(context.gameManager, playerId, aiConfig)

      const aiEntry: AIPlayerEntry = {
        autoPlayer,
        gameId,
        playerId,
        isDisconnectedPlayer: true,
        isAutoMode: false,
        lastActionTime: new Date()
      }

      context.aiPlayers.set(playerId, aiEntry)
      console.log(`🤖 AI takeover for disconnected player ${playerId} in game ${gameId}`)

    } catch (error) {
      console.error(`🤖 Failed to create AI for disconnected player ${playerId}:`, error)
    }
  }

  /**
   * Handle player reconnection - disable AI takeover if needed
   */
  handlePlayerReconnection(gameId: string, playerId: PlayerId, socket: ServerWebSocket<WSData>): void {
    const context = this.aiGames.get(gameId)
    if (!context) return

    // Update active socket tracking
    context.activeSocketsByPlayer.set(playerId, socket)

    // If AI was covering for disconnected player, remove it
    const aiEntry = context.aiPlayers.get(playerId)
    if (aiEntry && aiEntry.isDisconnectedPlayer) {
      aiEntry.autoPlayer.forceStop()
      context.aiPlayers.delete(playerId)
      console.log(`🤖 Removed AI takeover for reconnected player ${playerId} in game ${gameId}`)
    }
    // Keep auto-mode AI if player had requested it
  }

  /**
   * Update socket tracking for a player
   */
  updatePlayerSocket(gameId: string, playerId: PlayerId, socket: ServerWebSocket<WSData>): void {
    const context = this.aiGames.get(gameId)
    if (context) {
      context.activeSocketsByPlayer.set(playerId, socket)
    }
  }

  /**
   * Remove socket tracking for a player
   */
  removePlayerSocket(gameId: string, playerId: PlayerId): void {
    const context = this.aiGames.get(gameId)
    if (context) {
      context.activeSocketsByPlayer.delete(playerId)
    }
  }

  /**
   * Check if a player has AI enabled
   */
  isPlayerAI(gameId: string, playerId: PlayerId): boolean {
    const context = this.aiGames.get(gameId)
    return context?.aiPlayers.has(playerId) || false
  }

  /**
   * Get AI player configuration
   */
  getAIConfig(gameId: string, playerId: PlayerId): AutoPlayerConfig | null {
    const context = this.aiGames.get(gameId)
    const aiEntry = context?.aiPlayers.get(playerId)
    return aiEntry ? { ...aiEntry.autoPlayer['config'] } : null
  }

  /**
   * Update AI player configuration
   */
  updateAIConfig(gameId: string, playerId: PlayerId, config: Partial<AutoPlayerConfig>): boolean {
    const context = this.aiGames.get(gameId)
    const aiEntry = context?.aiPlayers.get(playerId)
    
    if (!aiEntry) return false

    aiEntry.autoPlayer.updateConfig(config)
    console.log(`🤖 Updated AI config for player ${playerId} in game ${gameId}`)
    return true
  }

  /**
   * Get AI statistics for a player
   */
  getAIStats(gameId: string, playerId: PlayerId) {
    const context = this.aiGames.get(gameId)
    const aiEntry = context?.aiPlayers.get(playerId)
    return aiEntry ? aiEntry.autoPlayer.getStats() : null
  }

  /**
   * Process all AI turns across all games
   */
  private async processAllAITurns(): Promise<void> {
    const activeGames = Array.from(this.aiGames.values())
    
    // Process games in parallel
    await Promise.allSettled(
      activeGames.map(context => this.processAITurnsForGame(context))
    )
  }

  /**
   * Process AI turns for a specific game
   */
  private async processAITurnsForGame(context: AIGameContext): Promise<void> {
    if (context.isProcessing) return
    if (context.aiPlayers.size === 0) return

    context.isProcessing = true
    
    try {
      const gameState = context.gameManager.getState()
      
      // Check if game has ended
      if (gameState.winner || gameState.phase === 'ended') {
        return
      }

      const currentPlayer = gameState.currentPlayer
      const aiEntry = context.aiPlayers.get(currentPlayer)
      
      // If current player is not AI, nothing to do
      if (!aiEntry) return

      // Check if AI can act
      if (!aiEntry.autoPlayer.canAct()) return

      console.log(`🤖 Processing AI turn for ${currentPlayer} in game ${context.gameId}`)

      // Execute AI turn
      const result = await aiEntry.autoPlayer.executeTurn()
      
      if (result.success) {
        // Save game state to database
        await this.saveGameState(context)
        
        // Broadcast updates to connected players
        await this.broadcastGameUpdate(context, result.actionsExecuted)
        
        aiEntry.lastActionTime = new Date()
        
        console.log(`🤖 AI turn completed for ${currentPlayer}: ${result.actionsExecuted.length} actions`)
      } else {
        console.error(`🤖 AI turn failed for ${currentPlayer}:`, result.error)
        
        // For critical failures, disable the AI
        if (result.error?.includes('not your turn') || result.error?.includes('game has ended')) {
          context.aiPlayers.delete(currentPlayer)
          console.log(`🤖 Removed failing AI for ${currentPlayer}`)
        }
      }

    } catch (error) {
      console.error(`🤖 Error processing AI turns for game ${context.gameId}:`, error)
    } finally {
      context.isProcessing = false
      context.lastAIProcessTime = new Date()
    }
  }

  /**
   * Save game state to database
   */
  private async saveGameState(context: AIGameContext): Promise<void> {
    try {
      const gameState = context.gameManager.getState()
      const gameData = prepareGameStateForDB(gameState)
      
      await db
        .update(games)
        .set(gameData)
        .where(eq(games.id, context.gameId))
        
    } catch (error) {
      console.error(`🤖 Failed to save game state for ${context.gameId}:`, error)
    }
  }

  /**
   * Broadcast game updates to connected players
   */
  private async broadcastGameUpdate(context: AIGameContext, actions: any[]): Promise<void> {
    try {
      const gameState = context.gameManager.getState()
      
      const updateMessage = {
        type: 'gameStateUpdate',
        gameState,
        events: actions,
        aiAction: true  // Flag to indicate this was an AI action
      }

      // Send to all connected players
      const messageStr = JSON.stringify(updateMessage)
      
      for (const [playerId, socket] of context.activeSocketsByPlayer) {
        if (socket.readyState === 1) {
          try {
            socket.send(messageStr)
          } catch (error) {
            console.error(`🤖 Failed to send update to ${playerId}:`, error)
            // Remove broken socket
            context.activeSocketsByPlayer.delete(playerId)
          }
        }
      }
      
    } catch (error) {
      console.error(`🤖 Failed to broadcast game update for ${context.gameId}:`, error)
    }
  }

  /**
   * Get summary of AI activity across all games
   */
  getAISummary() {
    const summary = {
      totalGames: this.aiGames.size,
      totalAIPlayers: 0,
      autoModePlayers: 0,
      disconnectedPlayers: 0,
      games: [] as any[]
    }

    for (const [gameId, context] of this.aiGames) {
      summary.totalAIPlayers += context.aiPlayers.size
      
      let autoMode = 0
      let disconnected = 0
      
      for (const aiEntry of context.aiPlayers.values()) {
        if (aiEntry.isAutoMode) autoMode++
        if (aiEntry.isDisconnectedPlayer) disconnected++
      }
      
      summary.autoModePlayers += autoMode
      summary.disconnectedPlayers += disconnected
      
      summary.games.push({
        gameId,
        aiPlayers: context.aiPlayers.size,
        autoMode,
        disconnected,
        lastProcessed: context.lastAIProcessTime,
        isProcessing: context.isProcessing
      })
    }

    return summary
  }
}

// Global AI manager instance
export const aiManager = new AIManager()

// Export for cleanup in tests or shutdown
export function stopAIManager(): void {
  aiManager.stopProcessLoop()
}

/**
 * WebSocket AI Commands for client interaction
 */

export interface AICommand {
  type: 'enableAutoMode' | 'disableAutoMode' | 'updateAIConfig' | 'getAIStats' | 'getAISummary'
  gameId?: string
  playerId?: PlayerId
  config?: Partial<AutoPlayerConfig>
}

/**
 * Handle AI-related WebSocket commands
 */
export async function handleAICommand(
  ws: ServerWebSocket<WSData>, 
  command: AICommand
): Promise<void> {
  const { type } = command
  const gameId = command.gameId || ws.data.gameId
  const playerId = command.playerId || ws.data.playerId

  if (!gameId || !playerId) {
    ws.send(JSON.stringify({
      type: 'error',
      error: 'Missing gameId or playerId for AI command'
    }))
    return
  }

  try {
    switch (type) {
      case 'enableAutoMode':
        const enabled = aiManager.enableAutoMode(gameId, playerId, command.config)
        ws.send(JSON.stringify({
          type: 'aiAutoModeEnabled',
          success: enabled,
          playerId
        }))
        break

      case 'disableAutoMode':
        const disabled = aiManager.disableAutoMode(gameId, playerId)
        ws.send(JSON.stringify({
          type: 'aiAutoModeDisabled',
          success: disabled,
          playerId
        }))
        break

      case 'updateAIConfig':
        if (!command.config) {
          throw new Error('No config provided for updateAIConfig')
        }
        const updated = aiManager.updateAIConfig(gameId, playerId, command.config)
        ws.send(JSON.stringify({
          type: 'aiConfigUpdated',
          success: updated,
          playerId
        }))
        break

      case 'getAIStats':
        const stats = aiManager.getAIStats(gameId, playerId)
        ws.send(JSON.stringify({
          type: 'aiStats',
          playerId,
          stats
        }))
        break

      case 'getAISummary':
        const summary = aiManager.getAISummary()
        ws.send(JSON.stringify({
          type: 'aiSummary',
          summary
        }))
        break

      default:
        throw new Error(`Unknown AI command: ${type}`)
    }

  } catch (error) {
    console.error('🤖 Error handling AI command:', error)
    ws.send(JSON.stringify({
      type: 'error',
      error: error instanceof Error ? error.message : 'Failed to process AI command'
    }))
  }
} 