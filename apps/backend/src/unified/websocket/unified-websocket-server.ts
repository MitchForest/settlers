/**
 * UNIFIED WEBSOCKET SERVER - ZERO TECHNICAL DEBT
 * 
 * Single WebSocket server that integrates with unified state management.
 * Replaces scattered WebSocket handling with unified, deterministic messaging.
 */

import type { ServerWebSocket } from 'bun'
import { unifiedCommandService, type UnifiedCommand, type CommandContext } from '../services/unified-command-service'
import { unifiedGameManager } from '../core/unified-event-store'
import { getRouteForGameState, type UnifiedGameContext, type UnifiedGameEvent } from '../core/unified-state-machine'
import { SupabaseJWTValidator, type ValidatedUser } from '../../auth/jwt-validator'

/**
 * CONNECTION MANAGEMENT
 */
interface UnifiedConnection {
  ws: ServerWebSocket<any>
  connectionId: string
  gameId: string
  userId?: string
  playerId?: string
  user: ValidatedUser
  connectedAt: Date
  lastHeartbeat: Date
  isAlive: boolean
  metadata: {
    userAgent?: string
    ipAddress?: string
  }
}

interface WebSocketMessage {
  type: string
  data?: any
  messageId?: string
  timestamp?: string
}

interface WebSocketResponse {
  success: boolean
  messageId?: string
  data?: any
  error?: string
  timestamp: string
}

/**
 * UNIFIED WEBSOCKET SERVER
 * Single point for ALL WebSocket operations
 */
export class UnifiedWebSocketServer {
  private readonly connections = new Map<string, UnifiedConnection>()
  private readonly gameConnections = new Map<string, Set<string>>() // gameId -> connectionIds
  private readonly userConnections = new Map<string, Set<string>>() // userId -> connectionIds
  private readonly cleanupInterval: NodeJS.Timeout

  constructor() {
    console.log('🚀 Initializing Unified WebSocket Server...')
    
    // Subscribe to game state changes
    unifiedGameManager.subscribe((gameId, context, event) => {
      this.handleGameStateChange(gameId, context, event)
    })
    
    // Cleanup interval for stale connections
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleConnections()
    }, 30000)
  }

  /**
   * HANDLE NEW CONNECTION
   */
  async handleOpen(ws: ServerWebSocket<any>): Promise<void> {
    const { session, token } = ws.data
    
    console.log(`🔌 New unified WebSocket connection for game: ${session.gameId}, user: ${session.user.email}`)

    try {
      const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
      
      // Create unified connection
      const connection: UnifiedConnection = {
        ws,
        connectionId,
        gameId: session.gameId,
        userId: session.user.id,
        user: session.user,
        connectedAt: new Date(),
        lastHeartbeat: new Date(),
        isAlive: true,
        metadata: {
          userAgent: ws.data.userAgent,
          ipAddress: ws.data.ipAddress
        }
      }
      
      // Store connection
      this.connections.set(connectionId, connection)
      
      // Index by game
      if (!this.gameConnections.has(session.gameId)) {
        this.gameConnections.set(session.gameId, new Set())
      }
      this.gameConnections.get(session.gameId)!.add(connectionId)
      
      // Index by user
      if (!this.userConnections.has(session.user.id)) {
        this.userConnections.set(session.user.id, new Set())
      }
      this.userConnections.get(session.user.id)!.add(connectionId)
      
      // Send connection established command
      await this.executeCommand({
        type: 'ESTABLISH_CONNECTION',
        gameId: session.gameId,
        connectionId,
        userId: session.user.id
      }, {
        userId: session.user.id,
        connectionId,
        timestamp: new Date()
      })
      
      // Auto-join game
      await this.handleAutoJoin(connection)
      
    } catch (error) {
      console.error('❌ Failed to handle WebSocket connection:', error)
      this.sendError(ws, 'Connection failed', { 
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      ws.close()
    }
  }

  /**
   * HANDLE INCOMING MESSAGE
   */
  async handleMessage(ws: ServerWebSocket<any>, messageData: string): Promise<void> {
    const connection = this.getConnectionByWebSocket(ws)
    
    if (!connection) {
      this.sendError(ws, 'Connection not found')
      return
    }

    try {
      const message: WebSocketMessage = JSON.parse(messageData)
      console.log(`📨 [${connection.connectionId}] Received:`, message.type)
      
      // Update heartbeat
      connection.lastHeartbeat = new Date()
      connection.isAlive = true
      
      // Route message to appropriate handler
      await this.routeMessage(connection, message)
      
    } catch (error) {
      console.error(`❌ [${connection.connectionId}] Message handling error:`, error)
      this.sendError(ws, 'Message processing failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  /**
   * HANDLE CONNECTION CLOSE
   */
  handleClose(ws: ServerWebSocket<any>): void {
    const connection = this.getConnectionByWebSocket(ws)
    
    if (!connection) {
      return
    }
    
    console.log(`🔌 [${connection.connectionId}] Connection closed`)
    
    try {
      // Send connection lost command
      this.executeCommand({
        type: 'CLOSE_CONNECTION',
        gameId: connection.gameId,
        connectionId: connection.connectionId
      }, {
        connectionId: connection.connectionId,
        timestamp: new Date()
      }).catch(error => {
        console.warn('Failed to process connection close:', error)
      })
      
      // Clean up connection tracking
      this.cleanupConnection(connection.connectionId)
      
    } catch (error) {
      console.error('Error handling connection close:', error)
    }
  }

  /**
   * MESSAGE ROUTING
   */
  private async routeMessage(connection: UnifiedConnection, message: WebSocketMessage): Promise<void> {
    const context: CommandContext = {
      userId: connection.userId,
      playerId: connection.playerId,
      connectionId: connection.connectionId,
      timestamp: new Date()
    }

    switch (message.type) {
      // Game Lifecycle Messages
      case 'joinGame':
        await this.handleJoinGameMessage(connection, message, context)
        break
      
      case 'leaveGame':
        await this.handleLeaveGameMessage(connection, message, context)
        break
      
      case 'startGame':
        await this.handleStartGameMessage(connection, message, context)
        break
      
      // Player Management Messages
      case 'addAIBot':
        await this.handleAddAIBotMessage(connection, message, context)
        break
      
      case 'removeAIBot':
        await this.handleRemoveAIBotMessage(connection, message, context)
        break
      
      // Game Action Messages
      case 'gameAction':
        await this.handleGameActionMessage(connection, message, context)
        break
      
      case 'endTurn':
        await this.handleEndTurnMessage(connection, message, context)
        break
      
      // System Messages
      case 'ping':
        await this.handlePingMessage(connection, message)
        break
      
      case 'requestGameState':
        await this.handleRequestGameStateMessage(connection, message)
        break
      
      default:
        this.sendError(connection.ws, `Unknown message type: ${message.type}`)
    }
  }

  /**
   * MESSAGE HANDLERS
   */
  private async handleJoinGameMessage(connection: UnifiedConnection, message: WebSocketMessage, context: CommandContext): Promise<void> {
    const command: UnifiedCommand = {
      type: 'JOIN_GAME',
      gameId: connection.gameId,
      userId: connection.userId!,
      playerName: message.data?.playerName || connection.user.email.split('@')[0]
    }
    
    const result = await this.executeCommand(command, context)
    
    if (result.success && result.data?.playerId) {
      // Update connection with player ID
      connection.playerId = result.data.playerId
      
      // Send success response
      this.sendResponse(connection.ws, {
        success: true,
        messageId: message.messageId,
        data: {
          type: 'joinedLobby',
          playerId: result.data.playerId,
          isHost: result.data.isHost,
          gameId: connection.gameId
        }
      })
    } else {
      this.sendResponse(connection.ws, {
        success: false,
        messageId: message.messageId,
        error: result.error || 'Failed to join game'
      })
    }
  }

  private async handleLeaveGameMessage(connection: UnifiedConnection, message: WebSocketMessage, context: CommandContext): Promise<void> {
    if (!connection.playerId) {
      this.sendError(connection.ws, 'Not in game')
      return
    }
    
    const command: UnifiedCommand = {
      type: 'LEAVE_GAME',
      gameId: connection.gameId,
      playerId: connection.playerId,
      reason: message.data?.reason || 'manual'
    }
    
    const result = await this.executeCommand(command, context)
    
    this.sendResponse(connection.ws, {
      success: result.success,
      messageId: message.messageId,
      data: result.success ? { type: 'leftLobby' } : undefined,
      error: result.error
    })
  }

  private async handleStartGameMessage(connection: UnifiedConnection, message: WebSocketMessage, context: CommandContext): Promise<void> {
    const command: UnifiedCommand = {
      type: 'START_GAME',
      gameId: connection.gameId,
      requestedBy: connection.userId!
    }
    
    const result = await this.executeCommand(command, context)
    
    this.sendResponse(connection.ws, {
      success: result.success,
      messageId: message.messageId,
      data: result.success ? { type: 'gameStarting' } : undefined,
      error: result.error
    })
  }

  private async handleAddAIBotMessage(connection: UnifiedConnection, message: WebSocketMessage, context: CommandContext): Promise<void> {
    const command: UnifiedCommand = {
      type: 'ADD_AI_PLAYER',
      gameId: connection.gameId,
      name: message.data?.name || 'AI Bot',
      personality: message.data?.personality || 'balanced',
      difficulty: message.data?.difficulty || 'normal',
      requestedBy: connection.userId!
    }
    
    const result = await this.executeCommand(command, context)
    
    this.sendResponse(connection.ws, {
      success: result.success,
      messageId: message.messageId,
      data: result.success ? { 
        type: 'aiPlayerAdded', 
        playerId: result.data?.playerId 
      } : undefined,
      error: result.error
    })
  }

  private async handleRemoveAIBotMessage(connection: UnifiedConnection, message: WebSocketMessage, context: CommandContext): Promise<void> {
    const command: UnifiedCommand = {
      type: 'REMOVE_AI_PLAYER',
      gameId: connection.gameId,
      playerId: message.data?.botPlayerId,
      requestedBy: connection.userId!
    }
    
    const result = await this.executeCommand(command, context)
    
    this.sendResponse(connection.ws, {
      success: result.success,
      messageId: message.messageId,
      data: result.success ? { 
        type: 'aiPlayerRemoved', 
        playerId: message.data?.botPlayerId 
      } : undefined,
      error: result.error
    })
  }

  private async handleGameActionMessage(connection: UnifiedConnection, message: WebSocketMessage, context: CommandContext): Promise<void> {
    if (!connection.playerId) {
      this.sendError(connection.ws, 'Not in game')
      return
    }
    
    const command: UnifiedCommand = {
      type: 'PERFORM_ACTION',
      gameId: connection.gameId,
      playerId: connection.playerId,
      action: message.data?.action,
      data: message.data?.actionData
    }
    
    const result = await this.executeCommand(command, context)
    
    this.sendResponse(connection.ws, {
      success: result.success,
      messageId: message.messageId,
      data: result.success ? { 
        type: 'actionResult', 
        result: result.data 
      } : undefined,
      error: result.error
    })
  }

  private async handleEndTurnMessage(connection: UnifiedConnection, message: WebSocketMessage, context: CommandContext): Promise<void> {
    if (!connection.playerId) {
      this.sendError(connection.ws, 'Not in game')
      return
    }
    
    const command: UnifiedCommand = {
      type: 'END_TURN',
      gameId: connection.gameId,
      playerId: connection.playerId
    }
    
    const result = await this.executeCommand(command, context)
    
    this.sendResponse(connection.ws, {
      success: result.success,
      messageId: message.messageId,
      data: result.success ? { type: 'turnEnded' } : undefined,
      error: result.error
    })
  }

  private async handlePingMessage(connection: UnifiedConnection, message: WebSocketMessage): Promise<void> {
    // Send heartbeat command
    await this.executeCommand({
      type: 'HEARTBEAT',
      gameId: connection.gameId,
      connectionId: connection.connectionId
    }, {
      connectionId: connection.connectionId,
      timestamp: new Date()
    })
    
    this.sendResponse(connection.ws, {
      success: true,
      messageId: message.messageId,
      data: { type: 'pong', timestamp: new Date().toISOString() }
    })
  }

  private async handleRequestGameStateMessage(connection: UnifiedConnection, message: WebSocketMessage): Promise<void> {
    try {
      const gameState = await unifiedCommandService.getGameState(connection.gameId)
      
      if (gameState) {
        this.sendResponse(connection.ws, {
          success: true,
          messageId: message.messageId,
          data: {
            type: 'gameState',
            state: gameState
          }
        })
      } else {
        this.sendError(connection.ws, 'Game state not found')
      }
      
    } catch (error) {
      this.sendError(connection.ws, 'Failed to load game state')
    }
  }

  /**
   * AUTO-JOIN LOGIC
   */
  private async handleAutoJoin(connection: UnifiedConnection): Promise<void> {
    try {
      // Check if user is already a player in this game
      const gameState = await unifiedCommandService.getGameState(connection.gameId)
      
      if (!gameState) {
        this.sendError(connection.ws, 'Game not found')
        return
      }
      
      // Find existing player
      const existingPlayer = gameState.players.find((p: any) => p.userId === connection.userId && p.status === 'active')
      
      if (existingPlayer) {
        // Reconnection
        connection.playerId = existingPlayer.id
        
        this.sendResponse(connection.ws, {
          success: true,
          data: {
            type: 'reconnectedToGame',
            playerId: existingPlayer.id,
            isHost: existingPlayer.isHost,
            gameId: connection.gameId
          }
        })
      } else {
        // New player - trigger join
        await this.handleJoinGameMessage(connection, {
          type: 'joinGame',
          data: { playerName: connection.user.email.split('@')[0] }
        }, {
          userId: connection.userId,
          connectionId: connection.connectionId,
          timestamp: new Date()
        })
      }
      
      // Send current game state
      await this.sendGameState(connection)
      
    } catch (error) {
      console.error('Auto-join failed:', error)
      this.sendError(connection.ws, 'Failed to join game')
    }
  }

  /**
   * GAME STATE BROADCASTING
   */
  private async handleGameStateChange(gameId: string, context: UnifiedGameContext, event: UnifiedGameEvent): Promise<void> {
    console.log(`🔄 [${gameId}] Broadcasting state change: ${event.type}`)
    
    try {
      // Get connections for this game
      const connectionIds = this.gameConnections.get(gameId) || new Set()
      
      // Broadcast state change to all connections
      for (const connectionId of connectionIds) {
        const connection = this.connections.get(connectionId)
        
        if (connection && connection.ws.readyState === 1) { // OPEN
          await this.sendGameState(connection, context)
          
          // Send specific event notifications
          this.sendResponse(connection.ws, {
            success: true,
            data: {
              type: 'gameStateChanged',
              event: event.type,
              state: context.state,
              route: getRouteForGameState(gameId, context.state)
            }
          })
        }
      }
      
    } catch (error) {
      console.error(`Failed to broadcast state change for ${gameId}:`, error)
    }
  }

  private async sendGameState(connection: UnifiedConnection, gameContext?: UnifiedGameContext): Promise<void> {
    try {
      const context = gameContext || await unifiedCommandService.getGameState(connection.gameId)
      
      if (!context) {
        this.sendError(connection.ws, 'Game state not available')
        return
      }
      
      this.sendResponse(connection.ws, {
        success: true,
        data: {
          type: 'lobbyState',
          lobby: {
            gameId: context.gameId,
            gameCode: context.gameCode,
            phase: context.state.status,
            substatus: context.state.substatus,
            players: context.players,
            isHost: context.players.find(p => p.userId === connection.userId)?.isHost || false,
            canStart: context.state.status === 'lobby' && context.players.filter(p => p.status === 'active').length >= 2,
            settings: context.settings,
            isStarted: context.state.status !== 'lobby',
            createdAt: context.createdAt,
            updatedAt: context.updatedAt
          }
        }
      })
      
    } catch (error) {
      console.error('Failed to send game state:', error)
      this.sendError(connection.ws, 'Failed to load game state')
    }
  }

  /**
   * UTILITY METHODS
   */
  private async executeCommand(command: UnifiedCommand, context: CommandContext): Promise<any> {
    return unifiedCommandService.executeCommand(command, context)
  }

  private getConnectionByWebSocket(ws: ServerWebSocket<any>): UnifiedConnection | undefined {
    for (const connection of this.connections.values()) {
      if (connection.ws === ws) {
        return connection
      }
    }
    return undefined
  }

  private cleanupConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId)
    
    if (connection) {
      // Remove from game connections
      const gameConnections = this.gameConnections.get(connection.gameId)
      if (gameConnections) {
        gameConnections.delete(connectionId)
        if (gameConnections.size === 0) {
          this.gameConnections.delete(connection.gameId)
        }
      }
      
      // Remove from user connections
      const userConnections = this.userConnections.get(connection.userId!)
      if (userConnections) {
        userConnections.delete(connectionId)
        if (userConnections.size === 0) {
          this.userConnections.delete(connection.userId!)
        }
      }
      
      // Remove main connection
      this.connections.delete(connectionId)
    }
  }

  private cleanupStaleConnections(): void {
    const now = Date.now()
    const STALE_THRESHOLD = 5 * 60 * 1000 // 5 minutes
    
    let cleaned = 0
    
    for (const [connectionId, connection] of this.connections.entries()) {
      const lastHeartbeat = connection.lastHeartbeat.getTime()
      
      if (now - lastHeartbeat > STALE_THRESHOLD || connection.ws.readyState !== 1) {
        this.cleanupConnection(connectionId)
        cleaned++
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} stale connections`)
    }
  }

  private sendResponse(ws: ServerWebSocket<any>, response: WebSocketResponse): void {
    if (ws.readyState === 1) { // OPEN
      try {
        response.timestamp = new Date().toISOString()
        ws.send(JSON.stringify(response))
      } catch (error) {
        console.error('Failed to send WebSocket response:', error)
      }
    }
  }

  private sendError(ws: ServerWebSocket<any>, error: string, details?: any): void {
    this.sendResponse(ws, {
      success: false,
      error,
      data: details,
      timestamp: new Date().toISOString()
    })
  }

  /**
   * PUBLIC API
   */
  async broadcastToGame(gameId: string, message: any): Promise<void> {
    const connectionIds = this.gameConnections.get(gameId) || new Set()
    
    for (const connectionId of connectionIds) {
      const connection = this.connections.get(connectionId)
      
      if (connection && connection.ws.readyState === 1) {
        this.sendResponse(connection.ws, {
          success: true,
          data: message,
          timestamp: new Date().toISOString()
        })
      }
    }
  }

  async broadcastToUser(userId: string, message: any): Promise<void> {
    const connectionIds = this.userConnections.get(userId) || new Set()
    
    for (const connectionId of connectionIds) {
      const connection = this.connections.get(connectionId)
      
      if (connection && connection.ws.readyState === 1) {
        this.sendResponse(connection.ws, {
          success: true,
          data: message,
          timestamp: new Date().toISOString()
        })
      }
    }
  }

  getConnectionsCount(): { total: number; byGame: Record<string, number>; byUser: Record<string, number> } {
    const byGame: Record<string, number> = {}
    const byUser: Record<string, number> = {}
    
    for (const [gameId, connections] of this.gameConnections.entries()) {
      byGame[gameId] = connections.size
    }
    
    for (const [userId, connections] of this.userConnections.entries()) {
      byUser[userId] = connections.size
    }
    
    return {
      total: this.connections.size,
      byGame,
      byUser
    }
  }

  close(): void {
    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
    
    // Close all connections
    for (const connection of this.connections.values()) {
      connection.ws.close(1000, 'Server shutdown')
    }
    
    console.log('🛑 Unified WebSocket server closed')
  }
}

// Singleton instance
export const unifiedWebSocketServer = new UnifiedWebSocketServer()