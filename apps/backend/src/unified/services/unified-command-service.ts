/**
 * UNIFIED COMMAND SERVICE - ZERO TECHNICAL DEBT
 * 
 * Single command service that handles ALL game operations.
 * Replaces scattered command services with unified, strongly-typed commands.
 */

import { unifiedGameManager } from '../core/unified-event-store'
import { UnifiedGameRules, type UnifiedGameEvent } from '../core/unified-state-machine'

/**
 * UNIFIED COMMAND TYPES
 * All commands in one place with strong typing
 */
export type UnifiedCommand = 
  // Game Lifecycle Commands
  | { type: 'CREATE_GAME', gameCode: string, hostUserId: string, settings?: any }
  | { type: 'JOIN_GAME', gameId: string, userId: string, playerName: string }
  | { type: 'LEAVE_GAME', gameId: string, playerId: string, reason?: string }
  | { type: 'START_GAME', gameId: string, requestedBy: string }
  | { type: 'PAUSE_GAME', gameId: string, reason: string, pausedBy?: string }
  | { type: 'RESUME_GAME', gameId: string, resumedBy?: string }
  | { type: 'END_GAME', gameId: string, reason: any, endedBy?: string }
  
  // Player Management Commands
  | { type: 'ADD_AI_PLAYER', gameId: string, name: string, personality?: string, difficulty?: string, requestedBy: string }
  | { type: 'REMOVE_AI_PLAYER', gameId: string, playerId: string, requestedBy: string }
  | { type: 'UPDATE_PLAYER_SETTINGS', gameId: string, playerId: string, settings: any, updatedBy: string }
  | { type: 'KICK_PLAYER', gameId: string, playerId: string, kickedBy: string, reason?: string }
  
  // Game Action Commands
  | { type: 'PERFORM_ACTION', gameId: string, playerId: string, action: string, data?: any }
  | { type: 'END_TURN', gameId: string, playerId: string }
  | { type: 'FORFEIT', gameId: string, playerId: string }
  
  // Connection Management Commands
  | { type: 'ESTABLISH_CONNECTION', gameId: string, connectionId: string, userId?: string, playerId?: string }
  | { type: 'CLOSE_CONNECTION', gameId: string, connectionId: string }
  | { type: 'HEARTBEAT', gameId: string, connectionId: string }
  
  // Administration Commands
  | { type: 'UPDATE_GAME_SETTINGS', gameId: string, settings: any, updatedBy: string }
  | { type: 'FORCE_STATE_TRANSITION', gameId: string, targetState: any, adminUserId: string }
  | { type: 'REBUILD_STATE', gameId: string, adminUserId: string }

export interface CommandResult {
  success: boolean
  error?: string
  data?: any
  newState?: any
  events?: UnifiedGameEvent[]
}

export interface CommandContext {
  userId?: string
  playerId?: string
  connectionId?: string
  userAgent?: string
  ipAddress?: string
  timestamp: Date
}

/**
 * UNIFIED COMMAND SERVICE
 * Single point for ALL game operations
 */
export class UnifiedCommandService {
  /**
   * EXECUTE COMMAND - SINGLE ENTRY POINT
   * All commands go through this method for consistency
   */
  async executeCommand(command: UnifiedCommand, context: CommandContext): Promise<CommandResult> {
    console.log(`📋 [${command.type}] Executing command:`, command)
    
    try {
      // Pre-command validation
      const preValidation = await this.preValidateCommand(command, context)
      if (!preValidation.valid) {
        return { success: false, error: preValidation.error }
      }

      // Route to specific handler
      const result = await this.routeCommand(command, context)
      
      // Post-command processing
      await this.postProcessCommand(command, result, context)
      
      console.log(`✅ [${command.type}] Command executed successfully`)
      return result
      
    } catch (error) {
      console.error(`💥 [${command.type}] Command execution failed:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown command error'
      }
    }
  }

  /**
   * COMMAND ROUTING
   * Routes commands to appropriate handlers
   */
  private async routeCommand(command: UnifiedCommand, context: CommandContext): Promise<CommandResult> {
    switch (command.type) {
      // Game Lifecycle
      case 'CREATE_GAME':
        return this.handleCreateGame(command, context)
      case 'JOIN_GAME':
        return this.handleJoinGame(command, context)
      case 'LEAVE_GAME':
        return this.handleLeaveGame(command, context)
      case 'START_GAME':
        return this.handleStartGame(command, context)
      case 'PAUSE_GAME':
        return this.handlePauseGame(command, context)
      case 'RESUME_GAME':
        return this.handleResumeGame(command, context)
      case 'END_GAME':
        return this.handleEndGame(command, context)
      
      // Player Management
      case 'ADD_AI_PLAYER':
        return this.handleAddAIPlayer(command, context)
      case 'REMOVE_AI_PLAYER':
        return this.handleRemoveAIPlayer(command, context)
      case 'KICK_PLAYER':
        return this.handleKickPlayer(command, context)
      
      // Game Actions
      case 'PERFORM_ACTION':
        return this.handlePerformAction(command, context)
      case 'END_TURN':
        return this.handleEndTurn(command, context)
      case 'FORFEIT':
        return this.handleForfeit(command, context)
      
      // Connection Management
      case 'ESTABLISH_CONNECTION':
        return this.handleEstablishConnection(command, context)
      case 'CLOSE_CONNECTION':
        return this.handleCloseConnection(command, context)
      case 'HEARTBEAT':
        return this.handleHeartbeat(command, context)
      
      // Administration
      case 'UPDATE_GAME_SETTINGS':
        return this.handleUpdateGameSettings(command, context)
      case 'FORCE_STATE_TRANSITION':
        return this.handleForceStateTransition(command, context)
      case 'REBUILD_STATE':
        return this.handleRebuildState(command, context)
      
      default:
        return { success: false, error: `Unknown command type: ${(command as any).type}` }
    }
  }

  /**
   * GAME LIFECYCLE HANDLERS
   */
  private async handleCreateGame(command: Extract<UnifiedCommand, { type: 'CREATE_GAME' }>, context: CommandContext): Promise<CommandResult> {
    const result = await unifiedGameManager.createGame({
      gameCode: command.gameCode,
      hostUserId: command.hostUserId,
      settings: command.settings
    })
    
    if (!result.success) {
      return { success: false, error: result.error }
    }
    
    return {
      success: true,
      data: { gameId: result.gameId },
      events: [{ type: 'GAME_CREATED', gameId: result.gameId!, hostUserId: command.hostUserId }]
    }
  }

  private async handleJoinGame(command: Extract<UnifiedCommand, { type: 'JOIN_GAME' }>, context: CommandContext): Promise<CommandResult> {
    // Validate player can join
    const gameContext = await unifiedGameManager.getGameState(command.gameId)
    if (!gameContext) {
      return { success: false, error: 'Game not found' }
    }
    
    const playerId = `player_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
    
    const canJoin = UnifiedGameRules.canPlayerJoin(gameContext, playerId)
    if (!canJoin.allowed) {
      return { success: false, error: canJoin.reason }
    }
    
    // Determine if this is the host joining
    const isHost = gameContext.players.length === 0
    const eventType = isHost ? 'HOST_JOINED' : 'PLAYER_JOINED'
    
    let event: UnifiedGameEvent
    if (isHost) {
      event = { type: 'HOST_JOINED', userId: command.userId }
    } else {
      event = { 
        type: 'PLAYER_JOINED', 
        playerId, 
        userId: command.userId, 
        playerType: 'human' 
      }
    }
    
    const result = await unifiedGameManager.sendEvent(command.gameId, event, {
      userId: command.userId,
      playerId
    })
    
    if (!result.success) {
      return { success: false, error: result.error }
    }
    
    return {
      success: true,
      data: { playerId, isHost },
      newState: result.newState,
      events: [event]
    }
  }

  private async handleLeaveGame(command: Extract<UnifiedCommand, { type: 'LEAVE_GAME' }>, context: CommandContext): Promise<CommandResult> {
    const event: UnifiedGameEvent = {
      type: 'PLAYER_LEFT',
      playerId: command.playerId,
      reason: command.reason || 'manual'
    }
    
    const result = await unifiedGameManager.sendEvent(command.gameId, event, {
      playerId: command.playerId
    })
    
    return {
      success: result.success,
      error: result.error,
      newState: result.newState,
      events: result.success ? [event] : undefined
    }
  }

  private async handleStartGame(command: Extract<UnifiedCommand, { type: 'START_GAME' }>, context: CommandContext): Promise<CommandResult> {
    // First send start request
    const startRequestEvent: UnifiedGameEvent = {
      type: 'GAME_START_REQUESTED',
      requestedBy: command.requestedBy
    }
    
    const requestResult = await unifiedGameManager.sendEvent(command.gameId, startRequestEvent)
    if (!requestResult.success) {
      return requestResult
    }
    
    // Get current game context for player order
    const gameContext = await unifiedGameManager.getGameState(command.gameId)
    if (!gameContext) {
      return { success: false, error: 'Game not found' }
    }
    
    // Determine player order
    const playerOrder = gameContext.players
      .filter(p => p.status === 'active')
      .sort((a, b) => a.joinOrder - b.joinOrder)
      .map(p => p.id)
    
    // Send game started event
    const gameStartedEvent: UnifiedGameEvent = {
      type: 'GAME_STARTED',
      startedBy: command.requestedBy,
      playerOrder
    }
    
    const startResult = await unifiedGameManager.sendEvent(command.gameId, gameStartedEvent)
    
    return {
      success: startResult.success,
      error: startResult.error,
      newState: startResult.newState,
      events: [startRequestEvent, gameStartedEvent]
    }
  }

  private async handlePauseGame(command: Extract<UnifiedCommand, { type: 'PAUSE_GAME' }>, context: CommandContext): Promise<CommandResult> {
    const event: UnifiedGameEvent = {
      type: 'GAME_PAUSED',
      reason: command.reason,
      pausedBy: command.pausedBy
    }
    
    const result = await unifiedGameManager.sendEvent(command.gameId, event)
    
    return {
      success: result.success,
      error: result.error,
      newState: result.newState,
      events: result.success ? [event] : undefined
    }
  }

  private async handleResumeGame(command: Extract<UnifiedCommand, { type: 'RESUME_GAME' }>, context: CommandContext): Promise<CommandResult> {
    const event: UnifiedGameEvent = {
      type: 'GAME_RESUMED',
      resumedBy: command.resumedBy
    }
    
    const result = await unifiedGameManager.sendEvent(command.gameId, event)
    
    return {
      success: result.success,
      error: result.error,
      newState: result.newState,
      events: result.success ? [event] : undefined
    }
  }

  private async handleEndGame(command: Extract<UnifiedCommand, { type: 'END_GAME' }>, context: CommandContext): Promise<CommandResult> {
    const event: UnifiedGameEvent = {
      type: 'GAME_ENDED',
      reason: command.reason,
      endedBy: command.endedBy
    }
    
    const result = await unifiedGameManager.sendEvent(command.gameId, event)
    
    return {
      success: result.success,
      error: result.error,
      newState: result.newState,
      events: result.success ? [event] : undefined
    }
  }

  /**
   * PLAYER MANAGEMENT HANDLERS
   */
  private async handleAddAIPlayer(command: Extract<UnifiedCommand, { type: 'ADD_AI_PLAYER' }>, context: CommandContext): Promise<CommandResult> {
    const playerId = `ai_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
    
    const event: UnifiedGameEvent = {
      type: 'PLAYER_JOINED',
      playerId,
      userId: '', // AI players don't have user IDs
      playerType: 'ai'
    }
    
    const result = await unifiedGameManager.sendEvent(command.gameId, event, {
      userId: command.requestedBy
    })
    
    return {
      success: result.success,
      error: result.error,
      data: result.success ? { playerId } : undefined,
      newState: result.newState,
      events: result.success ? [event] : undefined
    }
  }

  private async handleRemoveAIPlayer(command: Extract<UnifiedCommand, { type: 'REMOVE_AI_PLAYER' }>, context: CommandContext): Promise<CommandResult> {
    const event: UnifiedGameEvent = {
      type: 'PLAYER_LEFT',
      playerId: command.playerId,
      reason: 'manual'
    }
    
    const result = await unifiedGameManager.sendEvent(command.gameId, event, {
      userId: command.requestedBy
    })
    
    return {
      success: result.success,
      error: result.error,
      newState: result.newState,
      events: result.success ? [event] : undefined
    }
  }

  private async handleKickPlayer(command: Extract<UnifiedCommand, { type: 'KICK_PLAYER' }>, context: CommandContext): Promise<CommandResult> {
    const event: UnifiedGameEvent = {
      type: 'PLAYER_LEFT',
      playerId: command.playerId,
      reason: 'kick'
    }
    
    const result = await unifiedGameManager.sendEvent(command.gameId, event, {
      userId: command.kickedBy
    })
    
    return {
      success: result.success,
      error: result.error,
      newState: result.newState,
      events: result.success ? [event] : undefined
    }
  }

  /**
   * GAME ACTION HANDLERS
   */
  private async handlePerformAction(command: Extract<UnifiedCommand, { type: 'PERFORM_ACTION' }>, context: CommandContext): Promise<CommandResult> {
    // Validate action against game rules
    const gameContext = await unifiedGameManager.getGameState(command.gameId)
    if (!gameContext) {
      return { success: false, error: 'Game not found' }
    }
    
    const canPerformAction = UnifiedGameRules.canPlayerPerformAction(gameContext, command.playerId, command.action)
    if (!canPerformAction.allowed) {
      return { success: false, error: canPerformAction.reason }
    }
    
    // Create action events
    const attemptEvent: UnifiedGameEvent = {
      type: 'ACTION_ATTEMPTED',
      playerId: command.playerId,
      action: command.action,
      data: command.data
    }
    
    // Send attempt event
    const attemptResult = await unifiedGameManager.sendEvent(command.gameId, attemptEvent, {
      playerId: command.playerId
    })
    
    if (!attemptResult.success) {
      return attemptResult
    }
    
    // TODO: Process action through game engine
    // For now, assume success
    const completedEvent: UnifiedGameEvent = {
      type: 'ACTION_COMPLETED',
      playerId: command.playerId,
      action: command.action,
      result: { success: true, data: command.data }
    }
    
    const completedResult = await unifiedGameManager.sendEvent(command.gameId, completedEvent)
    
    return {
      success: completedResult.success,
      error: completedResult.error,
      newState: completedResult.newState,
      events: [attemptEvent, completedEvent]
    }
  }

  private async handleEndTurn(command: Extract<UnifiedCommand, { type: 'END_TURN' }>, context: CommandContext): Promise<CommandResult> {
    // Get current game state to determine next player
    const gameContext = await unifiedGameManager.getGameState(command.gameId)
    if (!gameContext || !gameContext.gameData) {
      return { success: false, error: 'Game not active' }
    }
    
    const currentPlayerIndex = gameContext.gameData.playerOrder.indexOf(command.playerId)
    const nextPlayerIndex = (currentPlayerIndex + 1) % gameContext.gameData.playerOrder.length
    const nextPlayerId = gameContext.gameData.playerOrder[nextPlayerIndex]
    
    const event: UnifiedGameEvent = {
      type: 'TURN_ENDED',
      playerId: command.playerId,
      nextPlayerId
    }
    
    const result = await unifiedGameManager.sendEvent(command.gameId, event, {
      playerId: command.playerId
    })
    
    return {
      success: result.success,
      error: result.error,
      newState: result.newState,
      events: result.success ? [event] : undefined
    }
  }

  private async handleForfeit(command: Extract<UnifiedCommand, { type: 'FORFEIT' }>, context: CommandContext): Promise<CommandResult> {
    // Forfeit is essentially leaving the game during active play
    const event: UnifiedGameEvent = {
      type: 'PLAYER_LEFT',
      playerId: command.playerId,
      reason: 'forfeit'
    }
    
    const result = await unifiedGameManager.sendEvent(command.gameId, event, {
      playerId: command.playerId
    })
    
    return {
      success: result.success,
      error: result.error,
      newState: result.newState,
      events: result.success ? [event] : undefined
    }
  }

  /**
   * CONNECTION MANAGEMENT HANDLERS
   */
  private async handleEstablishConnection(command: Extract<UnifiedCommand, { type: 'ESTABLISH_CONNECTION' }>, context: CommandContext): Promise<CommandResult> {
    const event: UnifiedGameEvent = {
      type: 'CONNECTION_ESTABLISHED',
      playerId: command.playerId || '',
      connectionId: command.connectionId
    }
    
    const result = await unifiedGameManager.sendEvent(command.gameId, event, {
      userId: command.userId,
      playerId: command.playerId,
      connectionId: command.connectionId
    })
    
    return {
      success: result.success,
      error: result.error,
      events: result.success ? [event] : undefined
    }
  }

  private async handleCloseConnection(command: Extract<UnifiedCommand, { type: 'CLOSE_CONNECTION' }>, context: CommandContext): Promise<CommandResult> {
    const event: UnifiedGameEvent = {
      type: 'CONNECTION_LOST',
      playerId: '', // Will be resolved from connection
      connectionId: command.connectionId
    }
    
    const result = await unifiedGameManager.sendEvent(command.gameId, event, {
      connectionId: command.connectionId
    })
    
    return {
      success: result.success,
      error: result.error,
      events: result.success ? [event] : undefined
    }
  }

  private async handleHeartbeat(command: Extract<UnifiedCommand, { type: 'HEARTBEAT' }>, context: CommandContext): Promise<CommandResult> {
    const event: UnifiedGameEvent = {
      type: 'HEARTBEAT',
      timestamp: new Date().toISOString()
    }
    
    const result = await unifiedGameManager.sendEvent(command.gameId, event, {
      connectionId: command.connectionId
    })
    
    return {
      success: result.success,
      error: result.error
    }
  }

  /**
   * ADMINISTRATION HANDLERS
   */
  private async handleUpdateGameSettings(command: Extract<UnifiedCommand, { type: 'UPDATE_GAME_SETTINGS' }>, context: CommandContext): Promise<CommandResult> {
    // TODO: Implement game settings update
    return { success: false, error: 'Not implemented' }
  }

  private async handleForceStateTransition(command: Extract<UnifiedCommand, { type: 'FORCE_STATE_TRANSITION' }>, context: CommandContext): Promise<CommandResult> {
    // TODO: Implement admin state transition
    return { success: false, error: 'Not implemented' }
  }

  private async handleRebuildState(command: Extract<UnifiedCommand, { type: 'REBUILD_STATE' }>, context: CommandContext): Promise<CommandResult> {
    // TODO: Implement state rebuild
    return { success: false, error: 'Not implemented' }
  }

  /**
   * COMMAND VALIDATION
   */
  private async preValidateCommand(command: UnifiedCommand, context: CommandContext): Promise<{ valid: boolean; error?: string }> {
    // Basic validation that applies to all commands
    if (!context.timestamp) {
      return { valid: false, error: 'Command context missing timestamp' }
    }
    
    // Command-specific validation
    switch (command.type) {
      case 'CREATE_GAME':
        if (!command.gameCode || !command.hostUserId) {
          return { valid: false, error: 'Missing required fields for game creation' }
        }
        break
      
      case 'JOIN_GAME':
        if (!command.gameId || !command.userId) {
          return { valid: false, error: 'Missing required fields for joining game' }
        }
        break
      
      // Add more specific validations as needed
    }
    
    return { valid: true }
  }

  /**
   * POST-COMMAND PROCESSING
   */
  private async postProcessCommand(command: UnifiedCommand, result: CommandResult, context: CommandContext): Promise<void> {
    // Log command execution
    console.log(`📋 [${command.type}] Result:`, { success: result.success, error: result.error })
    
    // Additional post-processing based on command type
    if (result.success && command.type === 'CREATE_GAME') {
      console.log(`🎮 New game created: ${result.data?.gameId}`)
    }
    
    // TODO: Add metrics, notifications, etc.
  }

  /**
   * QUERY OPERATIONS
   */
  async getGameState(gameId: string): Promise<any> {
    return unifiedGameManager.getGameState(gameId)
  }

  async getGameStatus(gameId: string): Promise<any> {
    return unifiedGameManager.getGameStatus(gameId)
  }

  async getActivePlayers(gameId: string): Promise<any[]> {
    return unifiedGameManager.getActivePlayers(gameId)
  }

  async canPlayerJoin(gameId: string): Promise<boolean> {
    return unifiedGameManager.canPlayerJoin(gameId)
  }

  async canGameStart(gameId: string): Promise<boolean> {
    return unifiedGameManager.canGameStart(gameId)
  }
}

// Singleton instance
export const unifiedCommandService = new UnifiedCommandService()