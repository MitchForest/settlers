// WebSocket server implementation using Bun's native WebSocket
import type { ServerWebSocket, WebSocketHandler } from 'bun'
import { GameFlowManager, GameAction, ProcessResult } from '@settlers/core'
import { games, players, gameEvents, sessions, db } from '../db'
import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'

// WebSocket data context
export interface WSData {
  sessionId: string
  gameId?: string
  playerId?: string
  userId?: string
}

// Game rooms management
const gameRooms = new Map<string, GameFlowManager>()

// WebSocket upgrade handler
export function upgradeWebSocket(req: Request, server: any): Response | undefined {
  // Extract session info from query params
  const url = new URL(req.url)
  const sessionId = url.searchParams.get('sessionId') || uuidv4()
  const gameId = url.searchParams.get('gameId') || undefined
  
  // Upgrade the connection
  const success = server.upgrade(req, {
    data: {
      sessionId,
      gameId,
      playerId: undefined,
      userId: undefined
    }
  })
  
  if (success) {
    return undefined // Return undefined on successful upgrade
  }
  
  return new Response('WebSocket upgrade failed', { status: 400 })
}

// WebSocket handlers for Bun
export const websocketHandlers: WebSocketHandler<WSData> = {
  // Connection opened
  open(ws) {
    console.log(`WebSocket opened - Session: ${ws.data.sessionId}`)
    
    // If joining a game, subscribe to game room
    if (ws.data.gameId) {
      ws.subscribe(`game:${ws.data.gameId}`)
      console.log(`Session ${ws.data.sessionId} subscribed to game:${ws.data.gameId}`)
      
      // Send current game state if available
      const gameManager = gameRooms.get(ws.data.gameId)
      if (gameManager) {
        ws.send(JSON.stringify({
          type: 'gameState',
          data: gameManager.getState()
        }))
      }
    }
  },

  // Message received
  async message(ws, message) {
    const { sessionId, gameId, playerId } = ws.data

    try {
      const data = JSON.parse(message.toString())
      console.log(`Message from ${sessionId}:`, data.type)

      switch (data.type) {
        case 'createGame':
          await handleCreateGame(ws, data.data)
          break

        case 'joinGame':
          await handleJoinGame(ws, data.data)
          break

        case 'gameAction':
          if (gameId && playerId) {
            await handleGameAction(ws, gameId, playerId, data.data)
          }
          break

        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }))
          break

        default:
          console.warn(`Unknown message type: ${data.type}`)
      }
    } catch (error) {
      console.error('Error processing message:', error)
      ws.send(JSON.stringify({
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      }))
    }
  },

  // Connection closed
  async close(ws, code, reason) {
    const { sessionId, gameId } = ws.data
    console.log(`WebSocket closed - Session: ${sessionId}, Code: ${code}, Reason: ${reason}`)

    // Update session status
    try {
      await db
        .update(sessions)
        .set({
          isActive: false,
          disconnectedAt: new Date()
        })
        .where(eq(sessions.socketId, sessionId))
    } catch (error) {
      console.error('Error updating session on close:', error)
    }
  },

  // Configure compression
  perMessageDeflate: true,
  
  // Configure limits
  maxPayloadLength: 16 * 1024 * 1024, // 16 MB
  idleTimeout: 120, // 120 seconds
  backpressureLimit: 1024 * 1024, // 1 MB
}

// Handler functions
async function handleCreateGame(ws: ServerWebSocket<WSData>, data: any) {
  try {
    const { playerNames, settings } = data
    
    // Create game using GameFlowManager
    const gameManager = GameFlowManager.createGame({
      playerNames,
      settings
    })
    
    const gameState = gameManager.getState()
    const gameId = gameState.id
    
    // Store game manager
    gameRooms.set(gameId, gameManager)
    
    // Save to database
    await db.insert(games).values({
      id: gameId,
      state: gameState,
      phase: gameState.phase,
      turn: gameState.turn,
      currentPlayerIndex: gameState.currentPlayerIndex,
      maxPlayers: playerNames.length,
      status: 'waiting'
    })
    
    // Get first player ID for the creator
    const firstPlayerId = gameState.playerOrder[0]
    
    // Update WebSocket data
    ws.data.gameId = gameId
    ws.data.playerId = firstPlayerId
    
    // Subscribe to game room
    ws.subscribe(`game:${gameId}`)
    
    // Send success response
    ws.send(JSON.stringify({
      type: 'gameCreated',
      data: {
        gameId,
        playerId: firstPlayerId,
        state: gameState
      }
    }))
  } catch (error) {
    console.error('Error creating game:', error)
    ws.send(JSON.stringify({
      type: 'error',
      error: error instanceof Error ? error.message : 'Failed to create game'
    }))
  }
}

async function handleJoinGame(ws: ServerWebSocket<WSData>, data: any) {
  try {
    const { gameId, playerName } = data
    
    // Get game manager
    const gameManager = gameRooms.get(gameId)
    if (!gameManager) {
      throw new Error('Game not found')
    }
    
    // Find available player slot
    const gameState = gameManager.getState()
    const players = Array.from(gameState.players.values())
    const availablePlayer = players.find(p => !p.isConnected)
    
    if (!availablePlayer) {
      throw new Error('Game is full')
    }
    
    // Update WebSocket data
    ws.data.gameId = gameId
    ws.data.playerId = availablePlayer.id
    
    // Subscribe to game room
    ws.subscribe(`game:${gameId}`)
    
    // Mark player as connected
    availablePlayer.isConnected = true
    
    // Send success response
    ws.send(JSON.stringify({
      type: 'gameJoined',
      data: {
        gameId,
        playerId: availablePlayer.id,
        state: gameState
      }
    }))
    
    // Broadcast player joined to other players
    ws.publish(`game:${gameId}`, JSON.stringify({
      type: 'playerJoined',
      data: {
        playerId: availablePlayer.id,
        playerName: availablePlayer.name
      }
    }))
  } catch (error) {
    console.error('Error joining game:', error)
    ws.send(JSON.stringify({
      type: 'error',
      error: error instanceof Error ? error.message : 'Failed to join game'
    }))
  }
}

async function handleGameAction(
  ws: ServerWebSocket<WSData>,
  gameId: string,
  playerId: string,
  action: GameAction
) {
  try {
    // Get game manager
    const gameManager = gameRooms.get(gameId)
    if (!gameManager) {
      throw new Error('Game not found')
    }
    
    // Process action
    const result = gameManager.processAction(action)
    
    if (!result.success) {
      // Send error to player
      ws.send(JSON.stringify({
        type: 'actionError',
        error: result.error
      }))
      return
    }
    
    // Save events to database
    const gameState = gameManager.getState()
    for (const event of result.events) {
      await db.insert(gameEvents).values({
        gameId,
        playerId: event.playerId || null,
        type: event.type,
        data: event.data,
        turn: gameState.turn,
        phase: gameState.phase,
        timestamp: new Date()
      })
    }
    
    // Update game state in database
    await db
      .update(games)
      .set({
        state: gameState,
        phase: gameState.phase,
        turn: gameState.turn,
        currentPlayerIndex: gameState.currentPlayerIndex,
        lastActivityAt: new Date()
      })
      .where(eq(games.id, gameId))
    
    // Broadcast state update to all players
    ws.publish(`game:${gameId}`, JSON.stringify({
      type: 'gameUpdate',
      data: {
        state: gameState,
        events: result.events
      }
    }))
    
    // Also send to the acting player
    ws.send(JSON.stringify({
      type: 'actionSuccess',
      data: {
        state: gameState,
        events: result.events
      }
    }))
  } catch (error) {
    console.error('Error processing game action:', error)
    ws.send(JSON.stringify({
      type: 'error',
      error: error instanceof Error ? error.message : 'Failed to process action'
    }))
  }
} 