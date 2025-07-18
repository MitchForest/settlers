import { WebSocketServer, WebSocket } from 'ws'
import { IncomingMessage } from 'http'
import { lobbyCommandService } from '../services/lobby-command-service'
import { eventStore } from '../db/event-store-repository'
import { friendsWebSocketManager } from './friends-websocket'

interface ClientConnection {
  ws: WebSocket
  gameId: string
  playerId?: string
  userId?: string
  lastSequence: number
  heartbeatInterval?: NodeJS.Timeout
  isAlive: boolean
}

interface WebSocketMessage {
  type: string
  data?: any
}

interface ErrorResponse {
  error: string
  details?: any
}

interface SuccessResponse {
  success: true
  data?: any
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

    const connection: Partial<ClientConnection> = {
      ws,
      isAlive: true
    }

    // Set up heartbeat
    this.setupHeartbeat(connection as ClientConnection)

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
    
    for (const [ws, connection] of this.connectionToGame.entries()) {
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
    try {
      console.log(`📨 Received message: ${message.type}`)

      switch (message.type) {
        case 'joinLobby':
          await this.handleJoinLobby(ws, message.data)
          break
        case 'addAIBot':
          await this.handleAddAIBot(ws, message.data)
          break
        case 'leaveLobby':
          await this.handleLeaveLobby(ws, message.data)
          break
        case 'startGame':
          await this.handleStartGame(ws, message.data)
          break
        case 'ping':
          this.sendResponse(ws, { success: true, data: { type: 'pong' } })
          break
        default:
          this.sendError(ws, `Unknown message type: ${message.type}`)
      }
    } catch (error) {
      console.error(`❌ Error handling message ${message.type}:`, error)
      this.sendError(ws, 'Internal server error', { 
        messageType: message.type,
        timestamp: new Date().toISOString()
      })
    }
  }

  private async handleJoinLobby(ws: WebSocket, data: any): Promise<void> {
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

      // Register with friends manager for real-time notifications
      friendsWebSocketManager.registerUserConnection(ws, userId, gameId)

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

  private async handleAddAIBot(ws: WebSocket, data: any): Promise<void> {
    const connection = this.connectionToGame.get(ws)
    if (!connection) {
      this.sendError(ws, 'Not connected to a lobby')
      return
    }

    const { name, difficulty = 'medium', personality = 'balanced' } = data

    if (!name) {
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

  private async handleLeaveLobby(ws: WebSocket, data: any): Promise<void> {
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

  private async handleStartGame(ws: WebSocket, data: any): Promise<void> {
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

      // Unregister from friends manager
      friendsWebSocketManager.unregisterUserConnection(ws)

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