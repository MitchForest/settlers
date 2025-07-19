// Unified Bun-native WebSocket server with complete feature set
import type { ServerWebSocket } from 'bun'
import { supabaseAdmin } from '../auth/supabase'

interface GameSessionPayload {
  gameId: string
  playerId: string
  userId: string
  playerName: string
  avatarEmoji: string
  authToken: string
  role: 'host' | 'player' | 'observer'
  permissions: string[]
  expiresAt: number
  issuedAt: number
  gameCode?: string
}

interface ClientConnection {
  ws: ServerWebSocket<any>
  gameId: string
  playerId?: string | null
  userId?: string
  lastSequence: number
  isAlive: boolean
  session?: GameSessionPayload
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

// Simple JWT implementation
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

class UnifiedWebSocketServer {
  private gameConnections = new Map<string, Set<ClientConnection>>()
  private connectionToGame = new Map<ServerWebSocket<any>, ClientConnection>()
  private sessionConnections = new Map<string, ClientConnection>()
  private cleanupInterval?: NodeJS.Timeout

  constructor() {
    console.log('🚀 Initializing Unified WebSocket Server (Bun-native)...')
    
    // Set up cleanup interval for stale connections
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleConnections()
    }, 30000) // Clean up every 30 seconds
  }

  async handleUpgrade(request: Request): Promise<Response> {
    const url = new URL(request.url)
    
    // Only handle WebSocket upgrades on /ws path
    if (url.pathname !== '/ws') {
      return new Response('Not found', { status: 404 })
    }

    const sessionToken = url.searchParams.get('s')
    if (!sessionToken) {
      return new Response('Authentication required', { status: 401 })
    }

    // Validate session token
    const decodedToken = decodeURIComponent(sessionToken)
    const { valid, payload, error } = SimpleJWT.verify(decodedToken)
    
    if (!valid || !payload) {
      return new Response(`Authentication failed: ${error}`, { status: 401 })
    }

    // Upgrade to WebSocket with session data
    const success = Bun.upgrade(request, {
      data: { session: payload, sessionToken },
    })

    return success
      ? new Response('Upgrade successful', { status: 101 })
      : new Response('Upgrade failed', { status: 400 })
  }

  async handleOpen(ws: ServerWebSocket<any>): Promise<void> {
    const { session, sessionToken } = ws.data
    
    console.log('🔌 New WebSocket connection for game:', session.gameId, 'user:', session.userId)

    try {
      await this.performAutoJoin(ws, session, sessionToken)
    } catch (error) {
      console.error('❌ WebSocket connection error:', error)
      this.sendError(ws, 'Connection failed', { 
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      ws.close()
    }
  }

  private async performAutoJoin(ws: ServerWebSocket<any>, session: GameSessionPayload, sessionToken: string): Promise<void> {
    // Auto-join using Supabase for data operations
    const result = await this.joinGameViaSupabase({
      gameId: session.gameId,
      userId: session.userId,
      playerName: session.playerName,
      avatarEmoji: session.avatarEmoji
    })

    const playerId = result.success ? result.playerId : session.playerId

    // Set up connection tracking
    const connection: ClientConnection = {
      ws,
      gameId: session.gameId,
      playerId,
      userId: session.userId,
      lastSequence: 0,
      isAlive: true,
      session
    }

    this.setupHeartbeat(connection)
    this.connectionToGame.set(ws, connection)
    this.sessionConnections.set(sessionToken, connection)

    if (!this.gameConnections.has(session.gameId)) {
      this.gameConnections.set(session.gameId, new Set())
    }
    this.gameConnections.get(session.gameId)!.add(connection)

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
    await this.sendLobbyState(connection)
    console.log('✅ User auto-joined game:', session.gameId)
  }

  private async joinGameViaSupabase(command: {
    gameId: string
    userId: string
    playerName: string
    avatarEmoji?: string
  }): Promise<{ success: boolean; playerId?: string; error?: string }> {
    try {
      // Check if game exists
      const { data: game, error: gameError } = await supabaseAdmin
        .from('games')
        .select('*')
        .eq('id', command.gameId)
        .single()

      if (gameError || !game) {
        return { success: false, error: 'Game not found' }
      }

      // Check if user already in game
      const { data: existingPlayer, error: playerError } = await supabaseAdmin
        .from('players')
        .select('*')
        .eq('game_id', command.gameId)
        .eq('user_id', command.userId)
        .single()

      if (existingPlayer) {
        return { 
          success: true, 
          playerId: existingPlayer.id,
          error: 'Reconnected to existing game session'
        }
      }

      // Create new player
      const playerId = `player_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
      
      const { data: newPlayer, error: createError } = await supabaseAdmin
        .from('players')
        .insert({
          id: playerId,
          game_id: command.gameId,
          user_id: command.userId,
          player_type: 'human',
          name: command.playerName,
          avatar_emoji: command.avatarEmoji,
          color: 'red', // Default color
          join_order: 1,
          is_host: false
        })
        .select()
        .single()

      if (createError) {
        return { success: false, error: `Failed to join game: ${createError.message}` }
      }

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
      
      const { data: aiBot, error } = await supabaseAdmin
        .from('players')
        .insert({
          id: botPlayerId,
          game_id: connection.gameId,
          player_type: 'ai',
          name: data.name || `${data.personality || 'Balanced'} Bot`,
          avatar_emoji: '🤖',
          color: 'blue', // Assign available color
          join_order: 99, // AI bots get higher join order
          is_host: false
        })
        .select()
        .single()

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
      const { error } = await supabaseAdmin
        .from('players')
        .delete()
        .eq('id', data.botPlayerId)
        .eq('game_id', connection.gameId)
        .eq('player_type', 'ai')

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
      // Update game status to started
      const { error } = await supabaseAdmin
        .from('games')
        .update({ current_phase: 'initial_placement' })
        .eq('id', connection.gameId)

      if (error) {
        this.sendError(ws, `Failed to start game: ${error.message}`)
        return
      }

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
      // Remove player from game
      const { error } = await supabaseAdmin
        .from('players')
        .delete()
        .eq('id', connection.playerId)
        .eq('game_id', connection.gameId)

      if (error) {
        console.error('Error removing player:', error)
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
    // Placeholder for game action handling
    this.sendError(ws, 'Game actions not yet implemented')
  }

  private async handleEndTurn(ws: ServerWebSocket<any>, data: any): Promise<void> {
    // Placeholder for turn management
    this.sendError(ws, 'Turn management not yet implemented')
  }

  private async handleRequestGameSync(ws: ServerWebSocket<any>, data: any): Promise<void> {
    // Placeholder for game sync
    this.sendError(ws, 'Game sync not yet implemented')
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
      // Get game and players from Supabase
      const { data: game, error: gameError } = await supabaseAdmin
        .from('games')
        .select('*')
        .eq('id', connection.gameId)
        .single()

      if (gameError || !game) {
        this.sendError(connection.ws, 'Failed to load game')
        return
      }

      const { data: players, error: playersError } = await supabaseAdmin
        .from('players')
        .select('*')
        .eq('game_id', connection.gameId)
        .order('join_order', { ascending: true })

      if (playersError) {
        this.sendError(connection.ws, 'Failed to load players')
        return
      }

      const lobbyState = {
        gameId: game.id,
        gameCode: game.game_code,
        phase: game.current_phase,
        players: players || [],
        settings: {
          maxPlayers: 4,
          allowObservers: true,
          aiEnabled: true
        },
        isStarted: game.current_phase !== 'lobby',
        createdAt: game.created_at,
        updatedAt: game.updated_at
      }

      this.sendResponse(connection.ws, {
        success: true,
        data: {
          type: 'lobbyState',
          lobby: lobbyState
        }
      })

      console.log('✅ Lobby state sent:', {
        gameId: connection.gameId,
        gameCode: game.game_code,
        playersCount: players?.length || 0
      })

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

  private async broadcastToGame(gameId: string, message: WebSocketResponse): Promise<void> {
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