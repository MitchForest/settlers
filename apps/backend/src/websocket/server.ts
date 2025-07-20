// LEGACY WEBSOCKET SERVER - TO BE REMOVED
// ❌ REPLACED BY: /unified/websocket/unified-websocket-server.ts
// ❌ TECHNICAL DEBT: Scattered state management, boolean flags
// 
// Unified Bun-native WebSocket server with complete feature set
import type { ServerWebSocket } from 'bun'
import { db, games, players } from '../db/index'
import { eq, and } from 'drizzle-orm'

interface GameSessionPayload {
  gameId: string
  playerId?: string
  user: ValidatedUser
  playerName?: string
  avatarEmoji?: string
  role: 'host' | 'player' | 'observer'
  permissions: string[]
}

interface ClientConnection {
  ws: ServerWebSocket<any>
  gameId: string
  playerId?: string | null
  user: ValidatedUser
  lastSequence: number
  isAlive: boolean
  session: GameSessionPayload
  heartbeatInterval?: NodeJS.Timeout
  isSpectator?: boolean
}

interface WebSocketMessage {
  type: string
  data?: any
  gameId?: string
}

interface WebSocketResponse {
  success?: boolean
  error?: string
  details?: any
  data?: any
}

// Import Supabase JWT validator
import { SupabaseJWTValidator, ValidatedUser } from '../auth/jwt-validator'

export class UnifiedWebSocketServer {
  private gameConnections = new Map<string, Set<ClientConnection>>()
  private connectionToGame = new Map<ServerWebSocket<any>, ClientConnection>()
  private sessionConnections = new Map<string, ClientConnection>()
  private userConnections = new Map<string, Set<ClientConnection>>() // userId -> connections
  private cleanupInterval?: NodeJS.Timeout

  constructor() {
    console.log('🚀 Initializing Unified WebSocket Server (Bun-native)...')
    
    // Set up cleanup interval for stale connections
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleConnections()
    }, 30000) // Clean up every 30 seconds
  }


  async handleOpen(ws: ServerWebSocket<any>): Promise<void> {
    const { session, token } = ws.data
    
    console.log('🔌 New WebSocket connection for game:', session.gameId, 'user:', session.user.email)

    try {
      await this.performAutoJoin(ws, session, token)
    } catch (error) {
      console.error('❌ WebSocket connection error:', error)
      this.sendError(ws, 'Connection failed', { 
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      ws.close()
    }
  }

  private async performAutoJoin(ws: ServerWebSocket<any>, session: GameSessionPayload, token: string): Promise<void> {
    // Auto-join using Supabase for data operations
    const result = await this.joinGameViaDrizzle({
      gameId: session.gameId,
      userId: session.user.id,
      playerName: session.playerName || session.user.email.split('@')[0],
      avatarEmoji: session.avatarEmoji || '🎮'
    })

    const playerId = result.success ? result.playerId : session.playerId

    // Set up connection tracking
    const connection: ClientConnection = {
      ws,
      gameId: session.gameId,
      playerId,
      user: session.user,
      lastSequence: 0,
      isAlive: true,
      session: {
        ...session,
        playerId
      }
    }

    this.setupHeartbeat(connection)
    this.connectionToGame.set(ws, connection)
    // Use user ID + game ID as session key instead of token
    this.sessionConnections.set(`${session.user.id}-${session.gameId}`, connection)

    if (!this.gameConnections.has(session.gameId)) {
      this.gameConnections.set(session.gameId, new Set())
    }
    this.gameConnections.get(session.gameId)!.add(connection)

    // Track user connections for social notifications
    if (!this.userConnections.has(session.user.id)) {
      this.userConnections.set(session.user.id, new Set())
    }
    this.userConnections.get(session.user.id)!.add(connection)

    // Send join confirmation
    this.sendResponse(ws, {
      success: true,
      data: {
        type: 'joinedLobby',
        playerId,
        gameId: session.gameId,
        message: 'Connected successfully'
      }
    })

    // Send lobby state
    try {
      await this.sendLobbyState(connection)
      console.log('✅ User auto-joined game:', session.gameId)
    } catch (error) {
      console.error('❌ Failed to send lobby state:', error)
    }
  }

  private async joinGameViaDrizzle(command: {
    gameId: string
    userId: string
    playerName: string
    avatarEmoji?: string
  }): Promise<{ success: boolean; playerId?: string; error?: string }> {
    try {
      // Check if game exists using Drizzle ORM
      const [game] = await db.select().from(games).where(eq(games.id, command.gameId)).limit(1)

      if (!game) {
        return { success: false, error: 'Game not found' }
      }

      // Check if user already in game using Drizzle ORM
      const [existingPlayer] = await db.select().from(players)
        .where(and(
          eq(players.gameId, command.gameId),
          eq(players.userId, command.userId)
        )).limit(1)

      if (existingPlayer) {
        return { 
          success: true, 
          playerId: existingPlayer.id,
          error: 'Reconnected to existing game session'
        }
      }

      // Create new player using Drizzle ORM
      const playerId = `player_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
      
      // Get next available join order and color for new human player
      const gamePlayersCount = await db.select().from(players).where(eq(players.gameId, command.gameId))
      const maxJoinOrder = Math.max(...gamePlayersCount.map(p => p.joinOrder), 0)
      const nextJoinOrder = maxJoinOrder + 1
      
      // Assign an available color for human player
      const availableColors = ['red', 'blue', 'green', 'yellow', 'orange', 'purple']
      const usedColors = gamePlayersCount.map(p => p.color)
      const availableColor = availableColors.find(color => !usedColors.includes(color)) || 'red'
      
      const [newPlayer] = await db.insert(players).values({
        id: playerId,
        gameId: command.gameId,
        userId: command.userId,
        playerType: 'human',
        name: command.playerName,
        avatarEmoji: command.avatarEmoji,
        color: availableColor,
        joinOrder: nextJoinOrder,
        isHost: false
      }).returning()

      return { success: true, playerId }

    } catch (error) {
      console.error('Error joining game:', error)
      return { success: false, error: 'Failed to join game' }
    }
  }

  async handleMessage(ws: ServerWebSocket<any>, message: string): Promise<void> {
    const connection = this.connectionToGame.get(ws)
    if (!connection) {
      this.sendError(ws, 'Connection not found')
      return
    }

    try {
      const data: WebSocketMessage = JSON.parse(message)
      console.log('📨 Received message:', data.type)

      switch (data.type) {
        // **GAME LOBBY OPERATIONS**
        case 'addAIBot':
          await this.handleAddAIBot(ws, data.data)
          break
        case 'removeAIBot':
          await this.handleRemoveAIBot(ws, data.data)
          break
        case 'startGame':
          await this.handleStartGame(ws, data.data)
          break
        case 'leaveGame':
          await this.handleLeaveGame(ws, data.data)
          break

        // **GAME ACTIONS**
        case 'gameAction':
          await this.handleGameAction(ws, data.data)
          break
        case 'endTurn':
          await this.handleEndTurn(ws, data.data)
          break
        case 'requestGameSync':
          await this.handleRequestGameSync(ws, data.data)
          break

        // **SOCIAL FEATURES**
        case 'connectSocial':
          await this.handleConnectSocial(ws, data.data)
          break
        case 'sendFriendRequest':
          await this.handleSendFriendRequest(ws, data.data)
          break

        // **SYSTEM**
        case 'ping':
          this.sendResponse(ws, { success: true, data: { type: 'pong' } })
          break

        default:
          this.sendError(ws, `Unknown message type: ${data.type}`)
      }
    } catch (error) {
      console.error('❌ Error handling message:', error)
      this.sendError(ws, 'Message processing failed')
    }
  }

  private async handleAddAIBot(ws: ServerWebSocket<any>, data: any): Promise<void> {
    const connection = this.connectionToGame.get(ws)
    if (!connection) return

    console.log('🤖 Adding AI bot:', data)

    try {
      const botPlayerId = `player_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
      
      // Get the next available join order and color for this game
      const existingPlayers = await db.select().from(players).where(eq(players.gameId, connection.gameId))
      const maxJoinOrder = Math.max(...existingPlayers.map(p => p.joinOrder), 0)
      const nextJoinOrder = maxJoinOrder + 1
      
      // Assign an available color
      const availableColors = ['red', 'blue', 'green', 'yellow', 'orange', 'purple']
      const usedColors = existingPlayers.map(p => p.color)
      const availableColor = availableColors.find(color => !usedColors.includes(color)) || 'gray'
      
      // Use Drizzle ORM for consistent schema and permissions
      const [aiBot] = await db.insert(players).values({
        id: botPlayerId,
        gameId: connection.gameId,
        playerType: 'ai',
        name: data.name || `${data.personality || 'Balanced'} Bot`,
        avatarEmoji: '🤖',
        color: availableColor,
        joinOrder: nextJoinOrder,
        isHost: false
      }).returning()

      const error = null // Drizzle throws on error instead of returning it

      if (error) {
        this.sendError(ws, `Failed to add AI bot: ${error.message}`)
        return
      }

      this.sendResponse(ws, {
        success: true,
        data: { type: 'aiPlayerAdded', playerId: botPlayerId }
      })
      
      // Broadcast updated lobby state to all connections
      await this.broadcastLobbyStateToGame(connection.gameId)

    } catch (error) {
      console.error('Error adding AI bot:', error)
      this.sendError(ws, 'Failed to add AI bot')
    }
  }

  private async handleRemoveAIBot(ws: ServerWebSocket<any>, data: any): Promise<void> {
    const connection = this.connectionToGame.get(ws)
    if (!connection) return

    try {
      // Use Drizzle ORM for consistent schema and permissions
      await db.delete(players)
        .where(and(
          eq(players.id, data.botPlayerId),
          eq(players.gameId, connection.gameId),
          eq(players.playerType, 'ai')
        ))

      const error = null // Drizzle throws on error instead of returning it

      if (error) {
        this.sendError(ws, `Failed to remove AI bot: ${error.message}`)
        return
      }

      this.sendResponse(ws, {
        success: true,
        data: { type: 'aiPlayerRemoved', playerId: data.botPlayerId }
      })
      
      await this.broadcastLobbyStateToGame(connection.gameId)

    } catch (error) {
      console.error('Error removing AI bot:', error)
      this.sendError(ws, 'Failed to remove AI bot')
    }
  }

  private async handleStartGame(ws: ServerWebSocket<any>, data: any): Promise<void> {
    const connection = this.connectionToGame.get(ws)
    if (!connection) return

    try {
      // Update game status to started using Drizzle ORM
      await db.update(games)
        .set({ currentPhase: 'initial_placement' })
        .where(eq(games.id, connection.gameId))

      // Broadcast game started to all players
      await this.broadcastToGame(connection.gameId, {
        success: true,
        data: { type: 'gameStarted' }
      })

    } catch (error) {
      console.error('Error starting game:', error)
      this.sendError(ws, 'Failed to start game')
    }
  }

  private async handleLeaveGame(ws: ServerWebSocket<any>, data: any): Promise<void> {
    const connection = this.connectionToGame.get(ws)
    if (!connection) return

    try {
      // Remove player from game using Drizzle ORM
      if (connection.playerId) {
        await db.delete(players)
          .where(and(
            eq(players.id, connection.playerId),
            eq(players.gameId, connection.gameId)
          ))
      }

      this.sendResponse(ws, {
        success: true,
        data: { type: 'leftLobby' }
      })

      // Clean up connection
      this.handleClose(ws)

    } catch (error) {
      console.error('Error leaving game:', error)
      this.sendError(ws, 'Failed to leave game')
    }
  }

  private async handleGameAction(ws: ServerWebSocket<any>, data: any): Promise<void> {
    const connection = this.connectionToGame.get(ws)
    if (!connection) return

    try {
      // Import game state manager dynamically to avoid circular dependency
      const { gameStateManager } = await import('../services/game-state-manager')
      
      const result = await gameStateManager.processPlayerAction(
        connection.gameId,
        connection.playerId!,
        data.action
      )

      if (result.success) {
        this.sendResponse(ws, {
          success: true,
          data: { type: 'actionProcessed', result }
        })
      } else {
        this.sendError(ws, result.error || 'Action failed')
      }

    } catch (error) {
      console.error('Error processing game action:', error)
      this.sendError(ws, 'Failed to process game action')
    }
  }

  private async handleEndTurn(ws: ServerWebSocket<any>, data: any): Promise<void> {
    // Placeholder for turn management
    this.sendError(ws, 'Turn management not yet implemented')
  }

  private async handleRequestGameSync(ws: ServerWebSocket<any>, data: any): Promise<void> {
    const connection = this.connectionToGame.get(ws)
    if (!connection) return

    try {
      // Import game state manager dynamically to avoid circular dependency
      const { gameStateManager } = await import('../services/game-state-manager')
      
      const gameState = await gameStateManager.loadGameState(connection.gameId)
      
      this.sendResponse(ws, {
        success: true,
        data: {
          type: 'gameSync',
          gameState,
          lastSequence: connection.lastSequence
        }
      })

    } catch (error) {
      console.error('Error syncing game state:', error)
      this.sendError(ws, 'Failed to sync game state')
    }
  }

  private async handleConnectSocial(ws: ServerWebSocket<any>, data: any): Promise<void> {
    // Placeholder for social features
    this.sendError(ws, 'Social features not yet implemented')
  }

  private async handleSendFriendRequest(ws: ServerWebSocket<any>, data: any): Promise<void> {
    // Placeholder for friend requests
    this.sendError(ws, 'Friend requests not yet implemented')
  }

  private async sendLobbyState(connection: ClientConnection): Promise<void> {
    try {
      console.log('🔍 Loading lobby state for game:', connection.gameId)
      
      // Get game using Drizzle ORM (has proper permissions)
      const [game] = await db.select().from(games).where(eq(games.id, connection.gameId)).limit(1)

      console.log('🔍 Database query result:', { 
        gameId: connection.gameId, 
        found: !!game, 
        gameObject: game
      })

      if (!game) {
        console.error('❌ Game not found in database:', { gameId: connection.gameId })
        this.sendError(connection.ws, 'Failed to load game')
        return
      }

      // Get players using Drizzle ORM (has proper permissions)
      const playersResult = await db.select().from(players).where(eq(players.gameId, connection.gameId))

      console.log('🔍 Players query result:', { 
        gameId: connection.gameId, 
        playersCount: playersResult.length 
      })

      // Determine if current user is host (first player or game host)
      const isHost = game.hostUserId === connection.user.id || 
                     (playersResult && playersResult.length > 0 && playersResult[0].userId === connection.user.id)
      
      const lobbyState = {
        gameId: game.id,
        gameCode: game.gameCode,
        phase: game.currentPhase,
        players: playersResult || [],
        isHost,
        canStart: (playersResult?.length || 0) >= 2,
        settings: {
          maxPlayers: 4,
          allowObservers: true,
          aiEnabled: true
        },
        isStarted: game.currentPhase !== 'lobby',
        createdAt: game.createdAt,
        updatedAt: game.updatedAt
      }

      console.log('🔍 Actual lobbyState being sent:', lobbyState)

      this.sendResponse(connection.ws, {
        success: true,
        data: {
          type: 'lobbyState',
          lobby: lobbyState
        }
      })

      console.log('✅ Lobby state sent successfully')

    } catch (error) {
      console.error('❌ Error sending lobby state:', error)
      this.sendError(connection.ws, 'Failed to send lobby state')
    }
  }

  private async broadcastLobbyStateToGame(gameId: string): Promise<void> {
    const connections = this.gameConnections.get(gameId)
    if (!connections) return

    for (const connection of connections) {
      await this.sendLobbyState(connection)
    }
  }

  async broadcastToGame(gameId: string, message: WebSocketResponse): Promise<void> {
    const connections = this.gameConnections.get(gameId)
    if (!connections) return

    console.log(`📢 Broadcasting to game ${gameId} (${connections.size} connections)`)
    
    for (const connection of connections) {
      if (connection.ws.readyState === 1) { // OPEN
        this.sendResponse(connection.ws, message)
      }
    }
  }

  private setupHeartbeat(connection: ClientConnection): void {
    connection.heartbeatInterval = setInterval(() => {
      if (!connection.isAlive) {
        console.log('💀 Connection failed heartbeat, closing')
        this.handleClose(connection.ws)
        return
      }

      connection.isAlive = false
      if (connection.ws.readyState === 1) { // OPEN
        connection.ws.ping()
      }
    }, 30000) // Ping every 30 seconds
  }

  private cleanupStaleConnections(): void {
    let cleaned = 0
    
    for (const ws of this.connectionToGame.keys()) {
      if (ws.readyState !== 1) { // Not OPEN
        this.handleClose(ws)
        cleaned++
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} stale connections`)
    }
  }

  handleClose(ws: ServerWebSocket<any>): void {
    const connection = this.connectionToGame.get(ws)
    if (connection) {
      console.log('🔌 WebSocket connection closed:', connection.gameId)
      
      // Clear heartbeat
      if (connection.heartbeatInterval) {
        clearInterval(connection.heartbeatInterval)
      }

      // Clean up connection tracking
      this.connectionToGame.delete(ws)
      
      const gameConnections = this.gameConnections.get(connection.gameId)
      if (gameConnections) {
        gameConnections.delete(connection)
        if (gameConnections.size === 0) {
          this.gameConnections.delete(connection.gameId)
        }
      }

      // Clean up user connections
      if (connection.user) {
        const userConnections = this.userConnections.get(connection.user.id)
        if (userConnections) {
          userConnections.delete(connection)
          if (userConnections.size === 0) {
            this.userConnections.delete(connection.user.id)
          }
        }
      }

      // Remove session connection
      for (const [token, conn] of this.sessionConnections.entries()) {
        if (conn === connection) {
          this.sessionConnections.delete(token)
          break
        }
      }
    }
  }

  private sendResponse(ws: ServerWebSocket<any>, response: WebSocketResponse): void {
    if (ws.readyState === 1) { // OPEN
      try {
        ws.send(JSON.stringify(response))
      } catch (error) {
        console.error('Error sending WebSocket response:', error)
      }
    }
  }

  private sendError(ws: ServerWebSocket<any>, error: string, details?: any): void {
    this.sendResponse(ws, { error, details })
  }

  // **SOCIAL NOTIFICATION METHODS**
  
  /**
   * Send notification to a specific user across all their connections
   */
  sendSocialNotification(userId: string, notification: {
    type: string
    data: any
    timestamp?: string
  }): void {
    const userConnections = this.userConnections.get(userId)
    if (!userConnections || userConnections.size === 0) {
      console.log(`📭 No active connections for user ${userId}`)
      return
    }

    const message = {
      success: true,
      data: {
        type: 'socialNotification',
        notification: {
          ...notification,
          timestamp: notification.timestamp || new Date().toISOString()
        }
      }
    }

    console.log(`📬 Sending social notification to user ${userId} (${userConnections.size} connections)`)
    
    for (const connection of userConnections) {
      if (connection.ws.readyState === 1) { // OPEN
        this.sendResponse(connection.ws, message)
      }
    }
  }

  /**
   * Broadcast social notification to multiple users
   */
  broadcastSocialNotification(notification: {
    type: string
    data: any
    timestamp?: string
    targetUserIds?: string[]
  }): void {
    const { targetUserIds, ...notificationData } = notification
    
    if (targetUserIds && targetUserIds.length > 0) {
      // Send to specific users
      for (const userId of targetUserIds) {
        this.sendSocialNotification(userId, notificationData)
      }
    } else {
      // Broadcast to all connected users
      for (const userId of this.userConnections.keys()) {
        this.sendSocialNotification(userId, notificationData)
      }
    }
  }

  close(): void {
    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }

    // Close all connections
    for (const connection of this.connectionToGame.values()) {
      if (connection.heartbeatInterval) {
        clearInterval(connection.heartbeatInterval)
      }
      connection.ws.close()
    }

    console.log('🛑 WebSocket server closed')
  }
}

// Create and export the server instance
export const webSocketServer = new UnifiedWebSocketServer()