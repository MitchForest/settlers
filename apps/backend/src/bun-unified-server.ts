// Unified Bun.serve server with native WebSocket support
// This replaces both the HTTP server and WebSocket server with a single, more performant solution

import type { ServerWebSocket } from 'bun'
import { lobbyCommandService } from './services/lobby-command-service'
import { eventStore } from './db/event-store-repository'

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

class BunUnifiedServer {
  private gameConnections = new Map<string, Set<ClientConnection>>()
  private connectionToGame = new Map<ServerWebSocket<any>, ClientConnection>()
  private sessionConnections = new Map<string, ClientConnection>()

  constructor() {
    console.log('🚀 Initializing Bun unified server...')
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

    // Validate session token (simplified for now)
    const decodedToken = decodeURIComponent(sessionToken)
    const session = this.parseSession(decodedToken)
    
    if (!session) {
      return new Response('Invalid session', { status: 401 })
    }

    // Upgrade to WebSocket
    const success = Bun.upgrade(request, {
      data: { session, sessionToken },
    })

    return success
      ? new Response('Upgrade successful', { status: 101 })
      : new Response('Upgrade failed', { status: 400 })
  }

  private parseSession(token: string): GameSessionPayload | null {
    try {
      // Simple base64 decode for now (in production, use proper JWT)
      const payload = JSON.parse(atob(token.split('.')[1]))
      
      if (payload.expiresAt && Date.now() > payload.expiresAt) {
        return null
      }
      
      return payload
    } catch {
      return null
    }
  }

  async handleOpen(ws: ServerWebSocket<any>): Promise<void> {
    const { session, sessionToken } = ws.data
    
    console.log('🔌 New WebSocket connection for game:', session.gameId)

    try {
      // Perform auto-join
      const result = await lobbyCommandService.joinGame({
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

      this.connectionToGame.set(ws, connection)
      this.sessionConnections.set(sessionToken, connection)

      if (!this.gameConnections.has(session.gameId)) {
        this.gameConnections.set(session.gameId, new Set())
      }
      this.gameConnections.get(session.gameId)!.add(connection)

      // Send join confirmation
      ws.send(JSON.stringify({
        success: true,
        data: {
          type: 'joinedLobby',
          playerId,
          gameId: session.gameId,
          message: 'Connected successfully'
        }
      }))

      // Send lobby state
      await this.sendLobbyState(connection)

    } catch (error) {
      console.error('❌ WebSocket connection error:', error)
      ws.send(JSON.stringify({
        error: 'Connection failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }))
      ws.close()
    }
  }

  async handleMessage(ws: ServerWebSocket<any>, message: string): Promise<void> {
    const connection = this.connectionToGame.get(ws)
    if (!connection) {
      ws.send(JSON.stringify({ error: 'Connection not found' }))
      return
    }

    try {
      const data = JSON.parse(message)
      console.log('📨 Received message:', data.type)

      switch (data.type) {
        case 'addAIBot':
          await this.handleAddAIBot(ws, data.data)
          break
        case 'removeAIBot':
          await this.handleRemoveAIBot(ws, data.data)
          break
        case 'startGame':
          await this.handleStartGame(ws, data.data)
          break
        case 'ping':
          ws.send(JSON.stringify({ success: true, data: { type: 'pong' } }))
          break
        default:
          ws.send(JSON.stringify({ error: `Unknown message type: ${data.type}` }))
      }
    } catch (error) {
      console.error('❌ Error handling message:', error)
      ws.send(JSON.stringify({ error: 'Message processing failed' }))
    }
  }

  private async handleAddAIBot(ws: ServerWebSocket<any>, data: any): Promise<void> {
    const connection = this.connectionToGame.get(ws)
    if (!connection) return

    console.log('🤖 Adding AI bot:', data)

    try {
      const result = await lobbyCommandService.addAIPlayer({
        gameId: connection.gameId,
        name: data.name || 'AI Bot',
        difficulty: data.difficulty || 'medium',
        personality: data.personality || 'balanced',
        requestedBy: connection.userId!
      })

      if (result.success) {
        ws.send(JSON.stringify({
          success: true,
          data: { type: 'aiPlayerAdded', playerId: result.playerId }
        }))
        
        // Broadcast updated lobby state to all connections
        await this.broadcastLobbyStateToGame(connection.gameId)
      } else {
        ws.send(JSON.stringify({ error: result.error }))
      }
    } catch (error) {
      ws.send(JSON.stringify({ error: 'Failed to add AI bot' }))
    }
  }

  private async handleRemoveAIBot(ws: ServerWebSocket<any>, data: any): Promise<void> {
    // Implementation similar to handleAddAIBot
    ws.send(JSON.stringify({ error: 'Remove AI bot not yet implemented' }))
  }

  private async handleStartGame(ws: ServerWebSocket<any>, data: any): Promise<void> {
    // Implementation for starting the game
    ws.send(JSON.stringify({ error: 'Start game not yet implemented' }))
  }

  private async sendLobbyState(connection: ClientConnection): Promise<void> {
    try {
      const result = await lobbyCommandService.getLobbyState(connection.gameId)
      
      if (!result.success || !result.state) {
        connection.ws.send(JSON.stringify({ error: 'Failed to load lobby state' }))
        return
      }

      const playersArray = Array.from(result.state.players.values())
      
      connection.ws.send(JSON.stringify({
        success: true,
        data: {
          type: 'lobbyState',
          lobby: {
            ...result.state,
            players: playersArray
          }
        }
      }))

      console.log('✅ Lobby state sent:', {
        gameId: connection.gameId,
        gameCode: result.state.gameCode,
        playersCount: playersArray.length
      })

    } catch (error) {
      console.error('❌ Error sending lobby state:', error)
    }
  }

  private async broadcastLobbyStateToGame(gameId: string): Promise<void> {
    const connections = this.gameConnections.get(gameId)
    if (!connections) return

    for (const connection of connections) {
      await this.sendLobbyState(connection)
    }
  }

  handleClose(ws: ServerWebSocket<any>): void {
    const connection = this.connectionToGame.get(ws)
    if (connection) {
      console.log('🔌 WebSocket connection closed:', connection.gameId)
      
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
}

export const bunUnifiedServer = new BunUnifiedServer()