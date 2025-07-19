import { GameState, GameAction, PlayerId, GamePhase } from '@settlers/game-engine'
import { GameStateManager } from './game-state-manager'
import { UnifiedWebSocketServer } from '../websocket/unified-server'
import { 
  createTurnStartedMessage, 
  createTurnEndedMessage, 
  createGamePausedMessage, 
  createGameResumedMessage,
  createGameEndedMessage 
} from '../websocket/game-messages'
import { gameConfig, getTurnTimeout, getAIThinkingTime } from '../config/game-config'

interface TurnTimer {
  gameId: string
  playerId: PlayerId
  startTime: Date
  timeoutMs: number
  timeoutId: NodeJS.Timeout
}

interface GameTurnState {
  gameId: string
  currentPlayer: PlayerId
  phase: GamePhase
  turnStartTime: Date
  timeRemainingMs: number
  isPaused: boolean
  pauseReason?: string
}

export class TurnManager {
  private turnTimers = new Map<string, TurnTimer>()
  private gameTurnStates = new Map<string, GameTurnState>()
  private aiOrchestrator: any // Will be injected later
  
  constructor(
    private gameStateManager: GameStateManager,
    private wsServer: UnifiedWebSocketServer
  ) {}

  /**
   * Set AI orchestrator (to avoid circular dependencies)
   */
  setAIOrchestrator(aiOrchestrator: any): void {
    this.aiOrchestrator = aiOrchestrator
  }

  /**
   * Start a new turn for a player
   */
  async startTurn(gameId: string, playerId: PlayerId, timeoutMs?: number): Promise<void> {
    const gameState = await this.gameStateManager.loadGameState(gameId)
    const player = gameState.players.get(playerId)
    
    if (!player) {
      throw new Error(`Player ${playerId} not found in game ${gameId}`)
    }

    console.log(`🎮 Starting turn for ${playerId} in game ${gameId} (phase: ${gameState.phase})`)

    // Clear any existing timer for this game
    this.clearTurnTimer(gameId)

    // Get appropriate timeout for current phase
    const turnTimeout = timeoutMs || getTurnTimeout(gameState.phase as keyof typeof gameConfig.phaseTimeouts)
    
    const turnState: GameTurnState = {
      gameId,
      currentPlayer: playerId,
      phase: gameState.phase,
      turnStartTime: new Date(),
      timeRemainingMs: turnTimeout,
      isPaused: false
    }

    this.gameTurnStates.set(gameId, turnState)

    if (player.isAI) {
      console.log(`🤖 Scheduling AI turn for ${playerId}`)
      // Schedule AI turn with thinking delay
      if (this.aiOrchestrator) {
        await this.aiOrchestrator.scheduleAITurn(gameId, playerId)
      } else {
        console.warn('AI orchestrator not set, skipping AI turn')
      }
    } else {
      console.log(`👤 Starting human player timer for ${playerId} (${turnTimeout}ms)`)
      // Start human player timer
      this.startTurnTimer(gameId, playerId, turnTimeout)
    }

    // Get available actions for this phase
    const availableActions = this.getAvailableActionsForPhase(gameState.phase)

    // Broadcast turn start to all players
    await this.broadcastTurnStart(gameId, playerId, turnTimeout, gameState.phase, availableActions)
  }

  /**
   * End the current turn and advance to next player
   */
  async endTurn(gameId: string, playerId: PlayerId, finalAction?: GameAction): Promise<void> {
    const gameState = await this.gameStateManager.loadGameState(gameId)
    
    // Validate it's actually this player's turn
    if (gameState.currentPlayer !== playerId) {
      throw new Error(`Cannot end turn: not ${playerId}'s turn (current: ${gameState.currentPlayer})`)
    }

    console.log(`🎮 Ending turn for ${playerId} in game ${gameId}`)

    // Process final action if provided
    if (finalAction) {
      console.log(`🎯 Processing final action: ${finalAction.type}`)
      const result = await this.gameStateManager.processPlayerAction(gameId, playerId, finalAction)
      if (!result.success) {
        console.error(`❌ Final action failed: ${result.error}`)
        // Don't prevent turn ending due to failed final action
      }
    }

    // Clear turn timer
    this.clearTurnTimer(gameId)

    // Get updated game state after any final action
    const updatedGameState = await this.gameStateManager.loadGameState(gameId)
    
    // Check if game ended
    if (updatedGameState.winner || updatedGameState.phase === 'ended') {
      await this.handleGameEnd(gameId, updatedGameState)
      return
    }

    // Get next player and start their turn
    const nextPlayer = this.getNextPlayer(updatedGameState)
    console.log(`🔄 Advancing from ${playerId} to ${nextPlayer}`)
    
    // Update the game state to reflect turn change
    await this.advanceToNextPlayer(gameId, nextPlayer)
    
    // Start next player's turn
    await this.startTurn(gameId, nextPlayer)

    // Broadcast turn change
    await this.broadcastTurnEnd(gameId, playerId, nextPlayer)
  }

  /**
   * Handle turn timeout
   */
  async handleTurnTimeout(gameId: string, playerId: PlayerId): Promise<void> {
    console.log(`⏰ Turn timeout for ${playerId} in game ${gameId}`)
    
    const gameState = await this.gameStateManager.loadGameState(gameId)
    const player = gameState.players.get(playerId)

    if (!player) {
      console.error(`Player ${playerId} not found for timeout handling`)
      return
    }

    if (player.isAI) {
      // AI should have already acted, but force end turn if needed
      console.log(`🤖 AI timeout - forcing end turn for ${playerId}`)
      await this.endTurn(gameId, playerId)
    } else {
      // Human player timeout - handle based on phase
      console.log(`👤 Human timeout - handling for ${playerId}`)
      await this.handleHumanTimeout(gameId, playerId, gameState)
    }

    // Broadcast timeout message
    await this.broadcastTurnTimeout(gameId, playerId)
  }

  /**
   * Pause game functionality
   */
  async pauseGame(gameId: string, reason: string): Promise<void> {
    const turnState = this.gameTurnStates.get(gameId)
    if (!turnState || turnState.isPaused) {
      console.log(`Game ${gameId} already paused or not found`)
      return
    }

    console.log(`⏸️ Pausing game ${gameId}: ${reason}`)

    turnState.isPaused = true
    turnState.pauseReason = reason

    // Clear active timer and calculate remaining time
    const timer = this.turnTimers.get(gameId)
    if (timer) {
      const elapsed = Date.now() - timer.startTime.getTime()
      turnState.timeRemainingMs = Math.max(0, timer.timeoutMs - elapsed)
      this.clearTurnTimer(gameId)
    }

    // Pause AI if needed
    if (this.aiOrchestrator) {
      await this.aiOrchestrator.pauseAI(gameId, turnState.currentPlayer)
    }

    // Broadcast pause to all players
    const message = createGamePausedMessage(gameId, reason)
    await this.broadcastToGame(gameId, message)
  }

  async resumeGame(gameId: string): Promise<void> {
    const turnState = this.gameTurnStates.get(gameId)
    if (!turnState || !turnState.isPaused) {
      console.log(`Game ${gameId} is not paused or not found`)
      return
    }

    console.log(`▶️ Resuming game ${gameId}`)

    turnState.isPaused = false
    delete turnState.pauseReason

    // Restart turn with remaining time
    const gameState = await this.gameStateManager.loadGameState(gameId)
    const player = gameState.players.get(turnState.currentPlayer)

    if (player && !player.isAI) {
      this.startTurnTimer(gameId, turnState.currentPlayer, turnState.timeRemainingMs)
    } else if (player?.isAI && this.aiOrchestrator) {
      await this.aiOrchestrator.resumeAI(gameId, turnState.currentPlayer)
    }

    // Broadcast resume
    const message = createGameResumedMessage(gameId)
    await this.broadcastToGame(gameId, message)
  }

  /**
   * Get turn state for a game
   */
  getTurnState(gameId: string): GameTurnState | null {
    return this.gameTurnStates.get(gameId) || null
  }

  /**
   * Get remaining time for current turn
   */
  getRemainingTime(gameId: string): number {
    const turnState = this.gameTurnStates.get(gameId)
    if (!turnState || turnState.isPaused) return 0

    const timer = this.turnTimers.get(gameId)
    if (!timer) return 0

    const elapsed = Date.now() - timer.startTime.getTime()
    return Math.max(0, timer.timeoutMs - elapsed)
  }

  // ============= Private Methods =============

  /**
   * Start turn timer for human players
   */
  private startTurnTimer(gameId: string, playerId: PlayerId, timeoutMs: number): void {
    // Clear any existing timer
    this.clearTurnTimer(gameId)

    const timeoutId = setTimeout(() => {
      this.handleTurnTimeout(gameId, playerId).catch(error => {
        console.error(`Error handling turn timeout for ${playerId}:`, error)
      })
    }, timeoutMs)

    const timer: TurnTimer = {
      gameId,
      playerId,
      startTime: new Date(),
      timeoutMs,
      timeoutId
    }

    this.turnTimers.set(gameId, timer)
  }

  /**
   * Clear turn timer for a game
   */
  private clearTurnTimer(gameId: string): void {
    const timer = this.turnTimers.get(gameId)
    if (timer) {
      clearTimeout(timer.timeoutId)
      this.turnTimers.delete(gameId)
    }
  }

  /**
   * Get next player in turn order
   */
  private getNextPlayer(gameState: GameState): PlayerId {
    const playerIds = Array.from(gameState.players.keys())
    const currentIndex = playerIds.indexOf(gameState.currentPlayer)
    const nextIndex = (currentIndex + 1) % playerIds.length
    return playerIds[nextIndex]
  }

  /**
   * Advance game state to next player
   */
  private async advanceToNextPlayer(gameId: string, nextPlayerId: PlayerId): Promise<void> {
    // For now, we'll let the game engine handle turn advancement
    // In a full implementation, we'd update the game state directly
    console.log(`🔄 Would advance game ${gameId} to player ${nextPlayerId}`)
  }

  /**
   * Handle human player timeout based on game phase
   */
  private async handleHumanTimeout(gameId: string, playerId: PlayerId, gameState: GameState): Promise<void> {
    switch (gameState.phase) {
      case 'roll':
        // Auto-roll dice for player
        const rollAction: GameAction = { type: 'roll', playerId, data: {} }
        await this.gameStateManager.processPlayerAction(gameId, playerId, rollAction)
        break
        
      case 'actions':
        // Auto-end turn
        await this.endTurn(gameId, playerId)
        break
        
      case 'discard':
        // Auto-discard random cards
        const player = gameState.players.get(playerId)
        if (player) {
          const totalResources = Object.values(player.resources).reduce((a, b) => a + b, 0)
          const mustDiscard = Math.floor(totalResources / 2)
          
          if (mustDiscard > 0) {
            // Simple random discard logic
            const discardAction: GameAction = { 
              type: 'discard', 
              playerId, 
              data: { resources: {} } // Would implement proper random discard
            }
            await this.gameStateManager.processPlayerAction(gameId, playerId, discardAction)
          }
        }
        break
        
      default:
        // For other phases, just end the turn
        await this.endTurn(gameId, playerId)
    }
  }

  /**
   * Handle game end
   */
  private async handleGameEnd(gameId: string, gameState: GameState): Promise<void> {
    console.log(`🏆 Game ${gameId} ended. Winner: ${gameState.winner}`)
    
    // Clear timers and state
    this.clearTurnTimer(gameId)
    this.gameTurnStates.delete(gameId)

    // Broadcast game end
    const message = createGameEndedMessage(gameId, gameState.winner)
    await this.broadcastToGame(gameId, message)
  }

  /**
   * Get available actions for a game phase
   */
  private getAvailableActionsForPhase(phase: GamePhase): string[] {
    switch (phase) {
      case 'setup1':
      case 'setup2':
        return ['placeBuilding', 'placeRoad']
      case 'roll':
        return ['roll']
      case 'actions':
        return ['build', 'bankTrade', 'portTrade', 'buyCard', 'playCard', 'createTradeOffer', 'endTurn']
      case 'discard':
        return ['discard']
      case 'moveRobber':
        return ['moveRobber']
      case 'steal':
        return ['stealResource', 'endTurn']
      default:
        return []
    }
  }

  /**
   * Broadcast turn start to all players
   */
  private async broadcastTurnStart(
    gameId: string, 
    playerId: PlayerId, 
    timeoutMs: number, 
    phase: GamePhase,
    availableActions: string[]
  ): Promise<void> {
    const message = createTurnStartedMessage(gameId, playerId, timeoutMs, phase, availableActions)
    await this.broadcastToGame(gameId, message)
  }

  /**
   * Broadcast turn end to all players
   */
  private async broadcastTurnEnd(gameId: string, previousPlayer: PlayerId, nextPlayer: PlayerId): Promise<void> {
    const message = createTurnEndedMessage(gameId, previousPlayer, nextPlayer)
    await this.broadcastToGame(gameId, message)
  }

  /**
   * Broadcast turn timeout to all players
   */
  private async broadcastTurnTimeout(gameId: string, playerId: PlayerId): Promise<void> {
    const message = {
      type: 'turnTimeout',
      data: {
        gameId,
        currentPlayer: playerId,
        timeRemaining: 0,
        phase: 'actions' as GamePhase, // Will be updated with actual phase
        timestamp: new Date().toISOString()
      }
    }
    await this.broadcastToGame(gameId, message)
  }

  /**
   * Temporary broadcast method - will be replaced with proper WebSocket broadcasting
   */
  private async broadcastToGame(gameId: string, message: any): Promise<void> {
    // This is a temporary implementation
    console.log(`🎮 Would broadcast to game ${gameId}:`, message.type || message.data?.type || 'unknown')
    // In the next step, we'll add proper broadcasting via the WebSocket server
  }
} 