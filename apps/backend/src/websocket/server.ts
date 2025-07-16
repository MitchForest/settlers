import type { ServerWebSocket, WebSocketHandler } from 'bun'
import { GameFlowManager, GameAction, ActionType, GameEvent } from '@settlers/core'
import { games, gameEvents, db } from '../db'
import { eq } from 'drizzle-orm'
import { prepareGameStateForDB, loadGameStateFromDB } from '../db/game-state-serializer'

// WebSocket data context
export interface WSData {
  sessionId: string
  gameId?: string
  playerId?: string
  isSpectator?: boolean
}

// Game room management with proper type safety
const gameRooms = new Map<string, {
  manager: GameFlowManager
  sockets: Set<ServerWebSocket<WSData>>
  lastUpdate: Date
}>()

// Player socket tracking
const playerSockets = new Map<string, ServerWebSocket<WSData>>()

/**
 * WebSocket upgrade handler
 */
export function upgradeWebSocket(req: Request, server: any): Response | undefined {
  const url = new URL(req.url)
  const sessionId = url.searchParams.get('sessionId') || crypto.randomUUID()
  const gameId = url.searchParams.get('gameId') || undefined
  const playerId = url.searchParams.get('playerId') || undefined
  
  const success = server.upgrade(req, {
    data: {
      sessionId,
      gameId,
      playerId,
      isSpectator: !playerId
    } satisfies WSData
  })

  return success ? undefined : new Response('WebSocket upgrade failed', { status: 400 })
}

/**
 * WebSocket message handlers
 */
export const websocketHandler: WebSocketHandler<WSData> = {
  async open(ws) {
    const { gameId, playerId, isSpectator } = ws.data
    
    console.log(`WebSocket connected: ${playerId || 'spectator'} to game ${gameId}`)
    
    if (gameId) {
      await joinGameRoom(ws, gameId)
    }
    
    if (playerId && !isSpectator) {
      playerSockets.set(playerId, ws)
    }
  },

  async message(ws, message) {
    try {
      const data = JSON.parse(message.toString())
      await handleWebSocketMessage(ws, data)
    } catch (error) {
      console.error('Error handling WebSocket message:', error)
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Invalid message format'
      }))
    }
  },

  async close(ws, code, reason) {
    const { gameId, playerId } = ws.data
    
    console.log(`WebSocket disconnected: ${playerId || 'spectator'} from game ${gameId}`)
    
    if (gameId) {
      await leaveGameRoom(ws, gameId)
    }
    
    if (playerId) {
      playerSockets.delete(playerId)
    }
  }
}

/**
 * Handle incoming WebSocket messages
 */
async function handleWebSocketMessage(ws: ServerWebSocket<WSData>, data: any) {
  const { type, ...payload } = data
  
  switch (type) {
    case 'joinGame':
      await handleJoinGame(ws, payload)
      break
      
    case 'gameAction':
      await handleGameAction(ws, payload)
      break
      
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong' }))
      break
      
    default:
      ws.send(JSON.stringify({
        type: 'error',
        error: `Unknown message type: ${type}`
      }))
  }
}

/**
 * Handle player joining a game
 */
async function handleJoinGame(ws: ServerWebSocket<WSData>, payload: { gameId: string; playerId?: string }) {
  const { gameId, playerId } = payload
  
  try {
    // Update WebSocket data
    ws.data.gameId = gameId
    if (playerId) {
      ws.data.playerId = playerId
      ws.data.isSpectator = false
      playerSockets.set(playerId, ws)
    }
    
    await joinGameRoom(ws, gameId)
    
    ws.send(JSON.stringify({
      type: 'joinedGame',
      gameId,
      playerId
    }))
  } catch (error) {
    console.error('Error joining game:', error)
    ws.send(JSON.stringify({
      type: 'error',
      error: 'Failed to join game'
    }))
  }
}

/**
 * Handle game actions from players
 */
async function handleGameAction(ws: ServerWebSocket<WSData>, payload: any) {
  const { gameId, playerId } = ws.data
  
  if (!gameId || !playerId) {
    ws.send(JSON.stringify({
      type: 'error',
      error: 'Not connected to a game'
    }))
    return
  }
  
  try {
    const gameRoom = gameRooms.get(gameId)
    if (!gameRoom) {
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Game room not found'
      }))
      return
    }
    
    // Create the action
    const action: GameAction = {
      type: payload.type as ActionType,
      playerId,
      ...payload.data
    }
    
    // Process the action
    const result = gameRoom.manager.processAction(action)
    
    if (!result.success) {
      ws.send(JSON.stringify({
        type: 'actionFailed',
        error: result.error
      }))
      return
    }
    
    // Save updated game state to database
    const updatedGameState = gameRoom.manager.getState()
    const gameData = prepareGameStateForDB(updatedGameState)
    
    await db
      .update(games)
      .set(gameData)
      .where(eq(games.id, gameId))
    
    // Log the action
    await db.insert(gameEvents).values({
      id: crypto.randomUUID(),
      gameId,
      playerId,
      type: payload.type,
      data: payload.data || {},
      timestamp: new Date()
    })
    
    // Update room metadata
    gameRoom.lastUpdate = new Date()
    
    // Broadcast the updated game state to all players
    broadcastToGameRoom(gameId, {
      type: 'gameStateUpdate',
      gameState: updatedGameState,
      events: result.events || []
    })
    
    // Send success confirmation to the acting player
    ws.send(JSON.stringify({
      type: 'actionSuccess',
      action: action,
      events: result.events || []
    }))
    
  } catch (error) {
    console.error('Error processing game action:', error)
    ws.send(JSON.stringify({
      type: 'error',
      error: 'Failed to process action'
    }))
  }
}

/**
 * Join a game room, loading game state if needed
 */
async function joinGameRoom(ws: ServerWebSocket<WSData>, gameId: string) {
  let gameRoom = gameRooms.get(gameId)
  
  if (!gameRoom) {
    // Load game from database
    const gameRecord = await db
      .select()
      .from(games)
      .where(eq(games.id, gameId))
      .limit(1)
    
    if (gameRecord.length === 0) {
      throw new Error('Game not found')
    }
    
    const gameState = await loadGameStateFromDB(gameRecord[0])
    const gameManager = new GameFlowManager(gameState)
    
    gameRoom = {
      manager: gameManager,
      sockets: new Set(),
      lastUpdate: new Date()
    }
    
    gameRooms.set(gameId, gameRoom)
  }
  
  // Add socket to room
  gameRoom.sockets.add(ws)
  
  // Send current game state to the joining player/spectator
  const currentGameState = gameRoom.manager.getState()
  ws.send(JSON.stringify({
    type: 'gameStateUpdate',
    gameState: currentGameState
  }))
  
  // Notify other players of the connection
  broadcastToGameRoom(gameId, {
    type: 'playerConnected',
    playerId: ws.data.playerId,
    isSpectator: ws.data.isSpectator
  }, ws)
}

/**
 * Leave a game room
 */
async function leaveGameRoom(ws: ServerWebSocket<WSData>, gameId: string) {
  const gameRoom = gameRooms.get(gameId)
  if (!gameRoom) return
  
  // Remove socket from room
  gameRoom.sockets.delete(ws)
  
  // Notify other players of the disconnection
  broadcastToGameRoom(gameId, {
    type: 'playerDisconnected',
    playerId: ws.data.playerId,
    isSpectator: ws.data.isSpectator
  })
  
  // Clean up empty rooms
  if (gameRoom.sockets.size === 0) {
    gameRooms.delete(gameId)
    console.log(`Cleaned up empty game room: ${gameId}`)
  }
}

/**
 * Broadcast message to all sockets in a game room
 */
function broadcastToGameRoom(gameId: string, message: any, excludeSocket?: ServerWebSocket<WSData>) {
  const gameRoom = gameRooms.get(gameId)
  if (!gameRoom) return
  
  const messageStr = JSON.stringify(message)
  
  for (const socket of gameRoom.sockets) {
    if (socket !== excludeSocket && socket.readyState === 1) {
      try {
        socket.send(messageStr)
      } catch (error) {
        console.error('Error broadcasting to socket:', error)
        // Remove broken socket
        gameRoom.sockets.delete(socket)
      }
    }
  }
}

/**
 * Send message to specific player
 */
export function sendToPlayer(playerId: string, message: any) {
  const socket = playerSockets.get(playerId)
  if (socket && socket.readyState === 1) {
    try {
      socket.send(JSON.stringify(message))
    } catch (error) {
      console.error('Error sending to player:', error)
      playerSockets.delete(playerId)
    }
  }
}

/**
 * Get active game rooms count
 */
export function getActiveRoomsCount(): number {
  return gameRooms.size
}

/**
 * Get connected players count
 */
export function getConnectedPlayersCount(): number {
  return playerSockets.size
}

/**
 * Cleanup inactive game rooms (optional maintenance)
 */
export function cleanupInactiveRooms(maxAgeMinutes: number = 60) {
  const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000)
  
  for (const [gameId, room] of gameRooms.entries()) {
    if (room.lastUpdate < cutoffTime && room.sockets.size === 0) {
      gameRooms.delete(gameId)
      console.log(`Cleaned up inactive game room: ${gameId}`)
    }
  }
} 