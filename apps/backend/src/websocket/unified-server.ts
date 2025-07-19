import { WebSocketServer, WebSocket } from 'ws'
import { IncomingMessage } from 'http'
import { URL } from 'url'
import { lobbyCommandService } from '../services/lobby-command-service'
import { eventStore } from '../db/event-store-repository'

// JWT Session Types
interface GameSessionPayload {
  gameId: string
  playerId: string
  authToken: string
  role: 'host' | 'player' | 'observer'
  permissions: string[]
  expiresAt: number
  issuedAt: number
  gameCode?: string
}

// Simple JWT implementation (matching frontend)
class SimpleJWT {
  private static readonly SECRET = process.env.JWT_SECRET || 'settlers-dev-secret-key'
  
  static verify(token: string): { valid: boolean; payload?: GameSessionPayload; error?: string } {
    try {
      const [headerB64, payloadB64, signature] = token.split('.')
      if (!headerB64 || !payloadB64 || !signature) {
        return { valid: false, error: 'Invalid token format' }
      }
      
      // Verify signature
      const expectedSignature = Buffer.from(`${headerB64}.${payloadB64}.${this.SECRET}`).toString('base64')
      if (signature !== expectedSignature) {
        return { valid: false, error: 'Invalid signature' }
      }
      
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString())
      
      // Check expiration
      if (payload.expiresAt && Date.now() > payload.expiresAt) {
        return { valid: false, error: 'Token expired' }
      }
      
      return { valid: true, payload }
    } catch {
      return { valid: false, error: 'Malformed token' }
    }
  }
}

interface ClientConnection {
  ws: WebSocket
  gameId: string
  playerId?: string
  userId?: string
  lastSequence: number
  heartbeatInterval?: NodeJS.Timeout
  isAlive: boolean
  session?: GameSessionPayload
}

// **PROPER MESSAGE TYPE INTERFACES**

// Base message interface
interface BaseMessage {
  type: string
  data?: Record<string, unknown>
}

// GAME ENTITY - Real game operations
interface GameMessage extends BaseMessage {
  type: 'joinGame' | 'leaveGame' | 'addAIBot' | 'removeAIBot' | 'startGame' | 'updateGameSettings'
  data: {
    gameId: string
    userId?: string
    playerName?: string
    avatarEmoji?: string
    // Additional fields based on message type
    [key: string]: unknown
  }
}

// SOCIAL ENTITY - Friends and social features  
interface SocialMessage extends BaseMessage {
  type: 'connectSocial' | 'sendFriendRequest' | 'acceptFriendRequest' | 'rejectFriendRequest' | 
        'removeFriend' | 'updatePresence' | 'sendGameInvite' | 'respondToGameInvite'
  data: {
    userId: string
    // Additional fields based on message type
    targetUserId?: string
    friendshipId?: string
    gameId?: string
    message?: string
    response?: 'accept' | 'decline'
    status?: 'online' | 'offline' | 'in_game'
    [key: string]: unknown
  }
}

// SYSTEM ENTITY - Infrastructure
interface SystemMessage extends BaseMessage {
  type: 'ping'
  data?: {
    [key: string]: unknown
  }
}

// Union type for all possible messages
type WebSocketMessage = GameMessage | SocialMessage | SystemMessage

interface ErrorResponse {
  error: string
  details?: Record<string, unknown>
}

interface SuccessResponse {
  success: true
  data?: Record<string, unknown>
}

type WebSocketResponse = ErrorResponse | SuccessResponse

export class UnifiedWebSocketServer {
  private wss: WebSocketServer
  private gameConnections = new Map<string, Set<ClientConnection>>()
  private connectionToGame = new Map<WebSocket, ClientConnection>()
  private cleanupInterval?: NodeJS.Timeout

  constructor(port: number = 8080) {
    this.wss = new WebSocketServer({ 
      port,
      path: '/ws'
    })

    this.wss.on('connection', this.handleConnection.bind(this))
    
    // Set up cleanup interval for stale connections
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleConnections()
    }, 30000) // Clean up every 30 seconds

    console.log(`🌐 WebSocket server listening on port ${port}`)
  }

  private handleConnection(ws: WebSocket, request: IncomingMessage): void {
    console.log('🔌 New WebSocket connection')

    // Extract session token from URL parameter
    const url = new URL(request.url || '', 'ws://localhost')
    const sessionToken = url.searchParams.get('s')
    
    if (!sessionToken) {
      console.log('❌ No session token provided')
      ws.close(4001, 'Authentication required')
      return
    }

    // Validate session token
    const { valid, payload, error } = SimpleJWT.verify(decodeURIComponent(sessionToken))
    
    if (!valid || !payload) {
      console.log('❌ Invalid session token:', error)
      ws.close(4002, `Authentication failed: ${error}`)
      return
    }

    console.log('✅ Session validated for user:', payload.playerId, 'game:', payload.gameId)

    // Auto-join game based on session
    this.handleAuthenticatedConnection(ws, payload)
  }

  private async handleAuthenticatedConnection(ws: WebSocket, session: GameSessionPayload): Promise<void> {
    try {
      // Auto-join the game using session data
      const result = await lobbyCommandService.joinGame({
        gameId: session.gameId,
        userId: session.playerId.split('_')[1] || session.playerId, // Extract userId from playerId
        playerName: session.playerId, // For now, use playerId as name
        avatarEmoji: '👤'
      })

      if (!result.success) {
        console.log('❌ Failed to auto-join game:', result.error)
        ws.close(4003, `Join failed: ${result.error}`)
        return
      }

      // Set up connection tracking with session
      const connection: ClientConnection = {
        ws,
        gameId: session.gameId,
        playerId: result.playerId,
        userId: session.playerId.split('_')[1] || session.playerId,
        lastSequence: 0,
        isAlive: true,
        session
      }

      this.setupHeartbeat(connection)
      this.connectionToGame.set(ws, connection)

      if (!this.gameConnections.has(session.gameId)) {
        this.gameConnections.set(session.gameId, new Set())
      }
      this.gameConnections.get(session.gameId)!.add(connection)

      // Send success response
      this.sendResponse(ws, {
        success: true,
        data: { message: 'Auto-joined game successfully' }
      })

      console.log('✅ User auto-joined game:', session.gameId)

    } catch (error) {
      console.error('❌ Error in auto-join:', error)
      ws.close(4004, 'Server error during join')
    }

    ws.on('message', async (data: Buffer) => {
      try {
        const message: WebSocketMessage = JSON.parse(data.toString())
        await this.handleMessage(ws, message)
      } catch (error) {
        console.error('❌ Error parsing message:', error)
        this.sendError(ws, 'Invalid message format')
      }
    })

    ws.on('close', () => {
      this.handleDisconnection(ws)
    })

    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error)
      this.handleDisconnection(ws)
    })

    // Handle ping/pong for connection health
    ws.on('pong', () => {
      const conn = this.connectionToGame.get(ws)
      if (conn) {
        conn.isAlive = true
      }
    })
  }

  private setupHeartbeat(connection: ClientConnection): void {
    connection.heartbeatInterval = setInterval(() => {
      if (!connection.isAlive) {
        console.log('💀 Connection failed heartbeat, closing')
        this.handleDisconnection(connection.ws)
        return
      }

      connection.isAlive = false
      if (connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.ping()
      }
    }, 30000) // Ping every 30 seconds
  }

  private cleanupStaleConnections(): void {
    let cleaned = 0
    
    for (const ws of this.connectionToGame.keys()) {
      if (ws.readyState !== WebSocket.OPEN) {
        this.handleDisconnection(ws)
        cleaned++
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} stale connections`)
    }
  }

  private async handleMessage(ws: WebSocket, message: WebSocketMessage): Promise<void> {
    const messageType = message.type
    try {
      console.log(`📨 Received message: ${messageType}`)

      switch (messageType) {
        // **GAME ENTITY** - Real game operations
        // joinGame is now automatic via session authentication
        case 'leaveGame':
          await this.handleLeaveGame(ws, message.data)
          break
        case 'addAIBot':
          await this.handleAddAIBot(ws, message.data)
          break
        case 'removeAIBot':
          await this.handleRemoveAIBot(ws, message.data)
          break
        case 'startGame':
          await this.handleStartGame(ws, message.data)
          break
        case 'updateGameSettings':
          await this.handleUpdateGameSettings(ws, message.data)
          break

        // **SOCIAL ENTITY** - Friends and social features
        case 'connectSocial':
          await this.handleConnectSocial(ws, message.data)
          break
        case 'sendFriendRequest':
          await this.handleSendFriendRequest(ws, message.data)
          break
        case 'acceptFriendRequest':
          await this.handleAcceptFriendRequest(ws, message.data)
          break
        case 'rejectFriendRequest':
          await this.handleRejectFriendRequest(ws, message.data)
          break
        case 'removeFriend':
          await this.handleRemoveFriend(ws, message.data)
          break
        case 'updatePresence':
          await this.handleUpdatePresence(ws, message.data)
          break
        case 'sendGameInvite':
          await this.handleSendGameInvite(ws, message.data)
          break
        case 'respondToGameInvite':
          await this.handleRespondToGameInvite(ws, message.data)
          break

        // **SYSTEM ENTITY** - Infrastructure
        case 'ping':
          this.sendResponse(ws, { success: true, data: { type: 'pong' } })
          break

        default:
          this.sendError(ws, `Unknown message type: ${messageType}`)
      }
    } catch (error) {
      console.error(`❌ Error handling message ${messageType}:`, error)
      this.sendError(ws, 'Internal server error', { 
        messageType: messageType,
        timestamp: new Date().toISOString()
      })
    }
  }

  /**
   * GAME ENTITY: Join a real game
   */
  private async handleJoinGame(ws: WebSocket, data: GameMessage['data']): Promise<void> {
    const { gameId, userId, playerName, avatarEmoji } = data

    if (!gameId || !userId || !playerName) {
      this.sendError(ws, 'Missing required fields: gameId, userId, playerName')
      return
    }

    try {
      // Join using command service
      const result = await lobbyCommandService.joinGame({
        gameId,
        userId,
        playerName,
        avatarEmoji
      })

      if (!result.success) {
        this.sendError(ws, result.error!)
        return
      }

      // Set up connection tracking
      const connection: ClientConnection = {
        ws,
        gameId,
        playerId: result.playerId,
        userId,
        lastSequence: 0,
        isAlive: true
      }

      this.setupHeartbeat(connection)
      this.connectionToGame.set(ws, connection)

      if (!this.gameConnections.has(gameId)) {
        this.gameConnections.set(gameId, new Set())
      }
      this.gameConnections.get(gameId)!.add(connection)

      // Friends notifications now handled by unified server social connections

      // Send success response
      this.sendResponse(ws, {
        success: true,
        data: {
          playerId: result.playerId,
          type: 'joinedLobby'
        }
      })

      // Send current lobby state and start live updates
      await this.sendLobbyState(connection)
      await this.startLiveUpdates(connection)

    } catch (error) {
      console.error('Error in handleJoinLobby:', error)
      this.sendError(ws, 'Failed to join lobby', { error: error instanceof Error ? error.message : 'Unknown error' })
    }
  }

  private async handleAddAIBot(ws: WebSocket, data: GameMessage['data']): Promise<void> {
    const connection = this.connectionToGame.get(ws)
    if (!connection) {
      this.sendError(ws, 'Not connected to a lobby')
      return
    }

    const name = data.name as string
    const difficultyValue = (data.difficulty as string) || 'medium'
    const personalityValue = (data.personality as string) || 'balanced'
    
    const difficulty = ['easy', 'medium', 'hard'].includes(difficultyValue) ? difficultyValue as 'easy' | 'medium' | 'hard' : 'medium'
    const personality = ['aggressive', 'balanced', 'defensive', 'economic'].includes(personalityValue) ? personalityValue as 'aggressive' | 'balanced' | 'defensive' | 'economic' : 'balanced'

    if (!name || typeof name !== 'string') {
      this.sendError(ws, 'AI bot name is required')
      return
    }

    try {
      // Add AI using command service
      const result = await lobbyCommandService.addAIPlayer({
        gameId: connection.gameId,
        name,
        difficulty,
        personality,
        requestedBy: connection.userId!
      })

      if (!result.success) {
        this.sendError(ws, result.error!)
        return
      }

      // Success response will be sent via live updates
      this.sendResponse(ws, {
        success: true,
        data: {
          playerId: result.playerId,
          type: 'aiPlayerAdded'
        }
      })

    } catch (error) {
      console.error('Error in handleAddAIBot:', error)
      this.sendError(ws, 'Failed to add AI bot', { error: error instanceof Error ? error.message : 'Unknown error' })
    }
  }

  /**
   * GAME ENTITY: Leave current game
   */
  private async handleLeaveGame(ws: WebSocket, _data: GameMessage['data']): Promise<void> {
    const connection = this.connectionToGame.get(ws)
    if (!connection?.playerId) {
      this.sendError(ws, 'Not connected to a lobby')
      return
    }

    try {
      // Leave using command service
      const result = await lobbyCommandService.leaveGame({
        gameId: connection.gameId,
        playerId: connection.playerId,
        reason: 'voluntary'
      })

      if (!result.success) {
        this.sendError(ws, result.error!)
        return
      }

      // Clean up connection
      this.handleDisconnection(ws)

      this.sendResponse(ws, {
        success: true,
        data: { type: 'leftLobby' }
      })

    } catch (error) {
      console.error('Error in handleLeaveLobby:', error)
      this.sendError(ws, 'Failed to leave lobby', { error: error instanceof Error ? error.message : 'Unknown error' })
    }
  }

  private async handleStartGame(ws: WebSocket, _data: unknown): Promise<void> {
    const connection = this.connectionToGame.get(ws)
    if (!connection) {
      this.sendError(ws, 'Not connected to a lobby')
      return
    }

    try {
      // Start game using command service
      const result = await lobbyCommandService.startGame({
        gameId: connection.gameId,
        requestedBy: connection.userId!
      })

      if (!result.success) {
        this.sendError(ws, result.error!)
        return
      }

      // Success response will be sent via live updates
      this.sendResponse(ws, {
        success: true,
        data: { type: 'gameStarted' }
      })

    } catch (error) {
      console.error('Error in handleStartGame:', error)
      this.sendError(ws, 'Failed to start game', { error: error instanceof Error ? error.message : 'Unknown error' })
    }
  }

  private async sendLobbyState(connection: ClientConnection): Promise<void> {
    try {
      const result = await lobbyCommandService.getLobbyState(connection.gameId)
      
      if (!result.success || !result.state) {
        this.sendError(connection.ws, 'Failed to load lobby state')
        return
      }

      // Convert Map to object for JSON serialization
      const playersArray = Array.from(result.state.players.values())
      
      this.sendResponse(connection.ws, {
        success: true,
        data: {
          type: 'lobbyState',
          lobby: {
            ...result.state,
            players: playersArray // Send as array instead of Map
          }
        }
      })

      // Update last sequence
      const currentSequence = await eventStore.getCurrentSequence(connection.gameId)
      connection.lastSequence = currentSequence

    } catch (error) {
      console.error('Error sending lobby state:', error)
      this.sendError(connection.ws, 'Failed to send lobby state', { 
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  private async startLiveUpdates(connection: ClientConnection): Promise<void> {
    // Poll for new events every 1 second
    const pollInterval = setInterval(async () => {
      try {
        if (connection.ws.readyState !== WebSocket.OPEN) {
          clearInterval(pollInterval)
          return
        }

        const result = await lobbyCommandService.getEventsSince(
          connection.gameId, 
          connection.lastSequence
        )

        if (result.success && result.events && result.events.length > 0) {
          // Send new events
          this.sendResponse(connection.ws, {
            success: true,
            data: {
              type: 'lobbyEvents',
              events: result.events
            }
          })

          // Update sequence
          const lastEvent = result.events[result.events.length - 1]
          connection.lastSequence = lastEvent.sequenceNumber

          // Also send updated state
          await this.sendLobbyState(connection)
        }
      } catch (error) {
        console.error('Error in live updates:', error)
        clearInterval(pollInterval)
      }
    }, 1000)

    // Clean up on disconnect
    connection.ws.on('close', () => {
      clearInterval(pollInterval)
    })
  }

  private handleDisconnection(ws: WebSocket): void {
    const connection = this.connectionToGame.get(ws)
    if (connection) {
      // Clear heartbeat
      if (connection.heartbeatInterval) {
        clearInterval(connection.heartbeatInterval)
      }

      // Friends connections now handled by unified server cleanup

      // Remove from game connections
      const gameConnections = this.gameConnections.get(connection.gameId)
      if (gameConnections) {
        gameConnections.delete(connection)
        if (gameConnections.size === 0) {
          this.gameConnections.delete(connection.gameId)
        }
      }

      // Mark player as disconnected (but don't remove from game)
      if (connection.playerId) {
        lobbyCommandService.leaveGame({
          gameId: connection.gameId,
          playerId: connection.playerId,
          reason: 'disconnected'
        }).catch(error => {
          console.error('Error marking player as disconnected:', error)
        })
      }

      this.connectionToGame.delete(ws)
    }

    console.log('🔌 Client disconnected')
  }

  private sendResponse(ws: WebSocket, response: WebSocketResponse): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(response))
      } catch (error) {
        console.error('Error sending WebSocket response:', error)
      }
    }
  }

  private sendError(ws: WebSocket, error: string, details?: any): void {
    this.sendResponse(ws, { error, details })
  }

  // ============================================================================
  // **NEW MESSAGE HANDLERS** - Implementing the proper message type architecture
  // ============================================================================

  /**
   * NOTIFICATION SYSTEM: Send notifications to users connected for social features
   */
  public sendSocialNotification(userId: string, notification: any): void {
    const socialConnections = this.gameConnections.get('social')
    if (!socialConnections) return

    for (const connection of socialConnections) {
      if (connection.userId === userId && connection.ws.readyState === WebSocket.OPEN) {
        this.sendResponse(connection.ws, {
          success: true,
          data: {
            type: 'notification',
            notification
          }
        })
      }
    }
  }

  /**
   * NOTIFICATION SYSTEM: Broadcast to all users connected for social features
   */
  public broadcastSocialNotification(notification: any): void {
    const socialConnections = this.gameConnections.get('social')
    if (!socialConnections) return

    for (const connection of socialConnections) {
      if (connection.ws.readyState === WebSocket.OPEN) {
        this.sendResponse(connection.ws, {
          success: true,
          data: {
            type: 'notification',
            notification
          }
        })
      }
    }
  }

  /**
   * SOCIAL ENTITY: Send game invite to friend
   */
  private async handleSendGameInvite(ws: WebSocket, data: SocialMessage['data']): Promise<void> {
    const fromUserId = (data.fromUserId || data.userId) as string
    const toUserId = (data.toUserId || data.targetUserId) as string
    const gameId = data.gameId as string
    const message = data.message as string | undefined

    if (!fromUserId || !toUserId || !gameId) {
      this.sendError(ws, 'Missing required fields: fromUserId, toUserId, gameId')
      return
    }

    try {
      const { gameInviteCommandService } = await import('../services/game-invite-command-service')
      
      const result = await gameInviteCommandService.sendGameInvite({
        fromUserId,
        toUserId,
        gameId,
        message
      })

      if (result.success) {
        this.sendResponse(ws, {
          success: true,
          data: {
            type: 'game_invite_sent',
            inviteId: result.data?.inviteId
          }
        })
      } else {
        this.sendError(ws, result.error || 'Failed to send game invite')
      }
    } catch (error) {
      console.error('Error in handleSendGameInvite:', error)
      this.sendError(ws, 'Failed to send game invite')
    }
  }

  /**
   * SOCIAL ENTITY: Respond to game invite
   */
  private async handleRespondToGameInvite(ws: WebSocket, data: SocialMessage['data']): Promise<void> {
    const userId = data.userId as string
    const inviteId = data.inviteId as string
    const response = data.response as 'accept' | 'decline'

    if (!userId || !inviteId || !response) {
      this.sendError(ws, 'Missing required fields: userId, inviteId, response')
      return
    }

    if (!['accept', 'decline'].includes(response)) {
      this.sendError(ws, 'Invalid response. Must be "accept" or "decline"')
      return
    }

    try {
      const { gameInviteCommandService } = await import('../services/game-invite-command-service')
      
      let result
      if (response === 'accept') {
        result = await gameInviteCommandService.acceptGameInvite({
          inviteId,
          acceptingUserId: userId
        })
      } else {
        result = await gameInviteCommandService.declineGameInvite({
          inviteId,
          decliningUserId: userId
        })
      }

      if (result.success) {
        this.sendResponse(ws, {
          success: true,
          data: {
            type: 'game_invite_responded',
            response,
            gameId: result.data?.gameId
          }
        })
      } else {
        this.sendError(ws, result.error || `Failed to ${response} game invite`)
      }
    } catch (error) {
      console.error('Error in handleRespondToGameInvite:', error)
      this.sendError(ws, `Failed to ${response} game invite`)
    }
  }

  /**
   * GAME ENTITY: Remove AI bot from game
   */
  private async handleRemoveAIBot(ws: WebSocket, _data: GameMessage['data']): Promise<void> {
    // TODO: Implement AI bot removal when AI system is built
    this.sendError(ws, 'Remove AI bot not yet implemented')
  }

  /**
   * GAME ENTITY: Update game settings
   */
  private async handleUpdateGameSettings(ws: WebSocket, _data: GameMessage['data']): Promise<void> {
    // TODO: Implement game settings update when settings system is built
    this.sendError(ws, 'Update game settings not yet implemented')
  }

  /**
   * SOCIAL ENTITY: Connect for social features (friends, presence, etc.)
   */
  private async handleConnectSocial(ws: WebSocket, data: SocialMessage['data']): Promise<void> {
    const { userId } = data

    if (!userId) {
      this.sendError(ws, 'Missing required field: userId')
      return
    }

    try {
      // Set up social connection tracking  
      const connection: ClientConnection = {
        ws,
        userId,
        gameId: 'social', // Special gameId for social connections
        isAlive: true,
        lastSequence: 0
      }

      this.connectionToGame.set(ws, connection)
      
      // Track social connections separately
      if (!this.gameConnections.has('social')) {
        this.gameConnections.set('social', new Set())
      }
      this.gameConnections.get('social')!.add(connection)

      // Set up heartbeat
      this.setupHeartbeat(connection)

      // Send success response
      this.sendResponse(ws, {
        success: true,
        data: {
          type: 'socialConnected',
          userId
        }
      })
      
      console.log(`👥 User ${userId} connected for social features`)
    } catch (error) {
      console.error('Error in handleConnectSocial:', error)
      this.sendError(ws, 'Failed to connect for social features')
    }
  }

  /**
   * SOCIAL ENTITY: Send friend request
   */
  private async handleSendFriendRequest(ws: WebSocket, data: SocialMessage['data']): Promise<void> {
    const userId = data.userId as string
    const targetUserId = data.targetUserId as string
    const message = data.message as string | undefined

    if (!userId || !targetUserId) {
      this.sendError(ws, 'Missing required fields: userId, targetUserId')
      return
    }

    try {
      // Import the friends command service dynamically to avoid circular imports
      const { friendsCommandService } = await import('../services/friends-command-service')
      
      const result = await friendsCommandService.sendFriendRequest({
        fromUserId: userId,
        toUserId: targetUserId,
        message
      })

      if (result.success) {
        this.sendResponse(ws, {
          success: true,
          data: {
            type: 'friend_request_sent',
            requestId: result.data?.requestId
          }
        })
      } else {
        this.sendError(ws, result.error || 'Failed to send friend request')
      }
    } catch (error) {
      console.error('Error in handleSendFriendRequest:', error)
      this.sendError(ws, 'Failed to send friend request')
    }
  }

  /**
   * SOCIAL ENTITY: Accept friend request
   */
  private async handleAcceptFriendRequest(ws: WebSocket, data: SocialMessage['data']): Promise<void> {
    const userId = data.userId as string
    const requestId = data.requestId as string

    if (!userId || !requestId) {
      this.sendError(ws, 'Missing required fields: userId, requestId')
      return
    }

    try {
      const { friendsCommandService } = await import('../services/friends-command-service')
      
      const result = await friendsCommandService.acceptFriendRequest({
        requestId,
        acceptingUserId: userId
      })

      if (result.success) {
        this.sendResponse(ws, {
          success: true,
          data: {
            type: 'friend_request_accepted',
            friendshipId: result.data?.friendshipId
          }
        })
      } else {
        this.sendError(ws, result.error || 'Failed to accept friend request')
      }
    } catch (error) {
      console.error('Error in handleAcceptFriendRequest:', error)
      this.sendError(ws, 'Failed to accept friend request')
    }
  }

  /**
   * SOCIAL ENTITY: Reject friend request  
   */
  private async handleRejectFriendRequest(ws: WebSocket, data: SocialMessage['data']): Promise<void> {
    const userId = data.userId as string
    const requestId = data.requestId as string

    if (!userId || !requestId) {
      this.sendError(ws, 'Missing required fields: userId, requestId')
      return
    }

    try {
      const { friendsCommandService } = await import('../services/friends-command-service')
      
      const result = await friendsCommandService.rejectFriendRequest({
        requestId,
        rejectingUserId: userId
      })

      if (result.success) {
        this.sendResponse(ws, {
          success: true,
          data: {
            type: 'friend_request_rejected'
          }
        })
      } else {
        this.sendError(ws, result.error || 'Failed to reject friend request')
      }
    } catch (error) {
      console.error('Error in handleRejectFriendRequest:', error)
      this.sendError(ws, 'Failed to reject friend request')
    }
  }

  /**
   * SOCIAL ENTITY: Remove friend
   */
  private async handleRemoveFriend(ws: WebSocket, data: SocialMessage['data']): Promise<void> {
    const userId = data.userId as string
    const friendshipId = data.friendshipId as string

    if (!userId || !friendshipId) {
      this.sendError(ws, 'Missing required fields: userId, friendshipId')
      return
    }

    try {
      const { friendsCommandService } = await import('../services/friends-command-service')
      
      const result = await friendsCommandService.removeFriend({
        friendshipId,
        removingUserId: userId
      })

      if (result.success) {
        this.sendResponse(ws, {
          success: true,
          data: {
            type: 'friend_removed'
          }
        })
      } else {
        this.sendError(ws, result.error || 'Failed to remove friend')
      }
    } catch (error) {
      console.error('Error in handleRemoveFriend:', error)
      this.sendError(ws, 'Failed to remove friend')
    }
  }

  /**
   * SOCIAL ENTITY: Update presence status
   */
  private async handleUpdatePresence(ws: WebSocket, data: SocialMessage['data']): Promise<void> {
    const userId = data.userId as string
    const status = data.status as 'online' | 'away' | 'busy' | 'offline'
    const gameId = data.gameId as string | undefined

    if (!userId || !status) {
      this.sendError(ws, 'Missing required fields: userId, status')
      return
    }

    try {
      const { friendsCommandService } = await import('../services/friends-command-service')
      
      const result = await friendsCommandService.updatePresence({
        userId,
        status,
        gameId
      })

      if (result.success) {
        this.sendResponse(ws, {
          success: true,
          data: {
            type: 'presence_updated',
            status,
            gameId
          }
        })
      } else {
        this.sendError(ws, result.error || 'Failed to update presence')
      }
    } catch (error) {
      console.error('Error in handleUpdatePresence:', error)
      this.sendError(ws, 'Failed to update presence')
    }
  }



  public close(): void {
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

    this.wss.close()
    console.log('🛑 WebSocket server closed')
  }
}

// Create and export the server instance
export const server = new UnifiedWebSocketServer() 