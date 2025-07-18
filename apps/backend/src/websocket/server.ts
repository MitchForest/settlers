import type { ServerWebSocket, WebSocketHandler } from 'bun'
import { 
  GameFlowManager, 
  GameAction, 
  ActionType, 
  GameEvent,
  LobbyManager,
  LobbyPlayer
} from '@settlers/core'
import { games, gameEvents, players, db } from '../db'
import { eq } from 'drizzle-orm'
import { prepareGameStateForDB, loadGameStateFromDB } from '../db/game-state-serializer'
import { loadGameOrLobbyState } from '../db/game-lobby-loader'
import { saveLobbyToDB } from '../db/lobby-serializer'
import { aiManager, handleAICommand, type AICommand } from './ai-handler'

// WebSocket data context - enhanced for lobby support
export interface WSData {
  sessionId: string
  gameId?: string
  playerId?: string
  isSpectator?: boolean
  isInLobby?: boolean // New field for lobby state
}

// Lobby room interface
interface LobbyRoom {
  gameId: string
  gameCode: string
  hostPlayerId: string
  players: Set<ServerWebSocket<WSData>>
  playerData: Map<string, { id: string; name: string; socket: ServerWebSocket<WSData> }>
  lastUpdate: Date
}

// Game room management with proper type safety
const gameRooms = new Map<string, {
  manager: GameFlowManager
  sockets: Set<ServerWebSocket<WSData>>
  lastUpdate: Date
}>()

// Lobby room management - new functionality
const lobbyRooms = new Map<string, LobbyRoom>()

// Player socket tracking
const playerSockets = new Map<string, ServerWebSocket<WSData>>()

// Request deduplication for AI operations
const pendingAIOperations = new Map<string, { operation: string; timestamp: number }>()

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
      isSpectator: !playerId,
      isInLobby: false
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
    
    // Don't automatically join game room - wait for explicit joinGame or joinLobby message
    // This prevents "Cannot join game room - game is not active" errors for lobby connections
    
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
    const { gameId, playerId, isInLobby } = ws.data
    
    console.log(`WebSocket disconnected: ${playerId || 'spectator'} from ${isInLobby ? 'lobby' : 'game'} ${gameId}`)
    
    if (gameId) {
      if (isInLobby) {
        await leaveLobbyRoom(ws, gameId)
      } else {
        await leaveGameRoom(ws, gameId)
      }
    }
    
    if (playerId) {
      playerSockets.delete(playerId)
    }
  }
}

/**
 * Handle incoming WebSocket messages - enhanced with lobby support
 */
async function handleWebSocketMessage(ws: ServerWebSocket<WSData>, data: any) {
  const { type, ...payload } = data
  
  switch (type) {
    case 'joinLobby':
      await handleJoinLobby(ws, payload)
      break
      
    case 'startGame':
      await handleStartGame(ws, payload)
      break
      
    case 'joinGame':
      await handleJoinGame(ws, payload)
      break
      
    case 'gameAction':
      await handleGameAction(ws, payload)
      break
    
    case 'aiCommand':
      await handleAICommand(ws, payload as AICommand)
      break
      
    case 'addAIBot':
      await handleAddAIBot(ws, payload)
      break
      
    case 'removeAIBot':
      await handleRemoveAIBot(ws, payload)
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
 * Handle player joining a lobby - new functionality
 */
async function handleJoinLobby(ws: ServerWebSocket<WSData>, payload: { gameId: string; playerId: string }) {
  const { gameId, playerId } = payload
  
  try {
    // Update WebSocket data
    ws.data.gameId = gameId
    ws.data.playerId = playerId
    ws.data.isInLobby = true
    ws.data.isSpectator = false
    
    // Track player socket
    playerSockets.set(playerId, ws)
    
    // Load or create lobby room
    let lobbyRoom = lobbyRooms.get(gameId)
    if (!lobbyRoom) {
      // Load game from database to get lobby info
      const gameRecord = await db
        .select()
        .from(games)
        .where(eq(games.id, gameId))
        .limit(1)
      
      if (gameRecord.length === 0) {
        throw new Error('Game not found')
      }
      
      const game = gameRecord[0]
      if (game.status !== 'lobby') {
        throw new Error('Game is not in lobby state')
      }
      
      lobbyRoom = {
        gameId,
        gameCode: game.gameCode || '',
        hostPlayerId: game.hostPlayerId || '',
        players: new Set(),
        playerData: new Map(),
        lastUpdate: new Date()
      }
      
      lobbyRooms.set(gameId, lobbyRoom)
    }
    
    // Add player to lobby
    lobbyRoom.players.add(ws)
    lobbyRoom.lastUpdate = new Date()
    
    // Load current lobby state to get player list
    const loaded = await loadGameOrLobbyState(gameId)
    
    if (loaded.type !== 'lobby') {
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Game is not in lobby state'
      }))
      return
    }
    
    const lobbyState = loaded.state
    const players = Array.from(lobbyState.players.values())
    
    // Send lobby state to joining player
    ws.send(JSON.stringify({
      type: 'lobbyJoined',
      gameCode: lobbyRoom.gameCode,
      players,
      isHost: playerId === lobbyRoom.hostPlayerId,
      canStart: lobbyState.status === 'ready'
    }))
    
    // Broadcast player joined to other lobby members
    broadcastToLobby(gameId, {
      type: 'lobbyUpdate',
      players,
      canStart: lobbyState.status === 'ready'
    }, ws)
    
    console.log(`✅ Player ${playerId} joined lobby ${gameId} (${lobbyRoom.gameCode})`)
    
  } catch (error) {
    console.error('❌ Error joining lobby:', error)
    ws.send(JSON.stringify({
      type: 'error',
      error: error instanceof Error ? error.message : 'Failed to join lobby'
    }))
  }
}

/**
 * Handle host starting a game - new functionality
 */
async function handleStartGame(ws: ServerWebSocket<WSData>, payload: { gameId: string }) {
  const { gameId } = payload
  const { playerId } = ws.data
  
  if (!playerId) {
    ws.send(JSON.stringify({
      type: 'error',
      error: 'No player ID provided'
    }))
    return
  }
  
  try {
    const lobbyRoom = lobbyRooms.get(gameId)
    if (!lobbyRoom) {
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Lobby not found'
      }))
      return
    }
    
    // Verify player is the host
    if (lobbyRoom.hostPlayerId !== playerId) {
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Only the host can start the game'
      }))
      return
    }
    
    // Load current lobby state to check if ready to start
    const loaded = await loadGameOrLobbyState(gameId)
    
    if (loaded.type !== 'lobby') {
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Game is not in lobby state'
      }))
      return
    }
    
    const lobbyState = loaded.state
    const lobbyManager = new LobbyManager(lobbyState)
    const validation = lobbyManager.canStartGame()
    
    if (!validation.canStart) {
      ws.send(JSON.stringify({
        type: 'error',
        error: validation.reason || 'Cannot start game'
      }))
      return
    }
    
    // Convert lobby to game state
    const gameState = lobbyManager.convertToGameState()
    const gameManager = new GameFlowManager(gameState)
    
    // Update database with game state
    const gameData = prepareGameStateForDB(gameState)
    await db.update(games)
      .set({
        status: 'playing',
        phase: gameState.phase,
        currentPlayer: gameState.currentPlayer,
        turn: gameState.turn,
        gameState: gameData.gameState,
        lobbyState: null // Clear lobby state
      })
      .where(eq(games.id, gameId))
    
    // Move from lobby room to game room
    const currentLobbyRoom = lobbyRooms.get(gameId)
    if (currentLobbyRoom) {
      gameRooms.set(gameId, {
        manager: gameManager,
        sockets: currentLobbyRoom.players, // LobbyRoom uses players set, not sockets
        lastUpdate: new Date()
      })
      lobbyRooms.delete(gameId)
    }
    
    // Broadcast game starting to all members
    broadcastToGameRoom(gameId, {
      type: 'gameStarted',
      gameState: gameState
    })
    
    console.log(`✅ Game ${gameId} started by host ${playerId}`)
    
  } catch (error) {
    console.error('❌ Error starting game:', error)
    ws.send(JSON.stringify({
      type: 'error',
      error: error instanceof Error ? error.message : 'Failed to start game'
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
    ws.data.isInLobby = false // Ensure this is set to false for actual games
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
    
    // Load state - should be an active game for joining game room
    const loaded = await loadGameOrLobbyState(gameId)
    
    if (loaded.type !== 'game') {
      throw new Error('Cannot join game room - game is not active')
    }
    
    const gameState = loaded.state
    const gameManager = new GameFlowManager(gameState)
    
    gameRoom = {
      manager: gameManager,
      sockets: new Set(),
      lastUpdate: new Date()
    }
    
    gameRooms.set(gameId, gameRoom)
    
    // Register game with AI manager
    aiManager.registerGame(gameId, gameManager)
  }
  
  // Add socket to room
  gameRoom.sockets.add(ws)
  
  // Update AI manager with player socket
  const { playerId } = ws.data
  if (playerId) {
    aiManager.updatePlayerSocket(gameId, playerId, ws)
  }
  
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
  
  // Handle AI for disconnected player
  const { playerId } = ws.data
  if (playerId) {
    aiManager.handlePlayerDisconnection(gameId, playerId)
  }
  
  // Notify other players of the disconnection
  broadcastToGameRoom(gameId, {
    type: 'playerDisconnected',
    playerId: ws.data.playerId,
    isSpectator: ws.data.isSpectator
  })
  
  // Clean up empty rooms
  if (gameRoom.sockets.size === 0) {
    // Unregister game from AI manager
    aiManager.unregisterGame(gameId)
    gameRooms.delete(gameId)
    console.log(`Cleaned up empty game room: ${gameId}`)
  }
}

/**
 * Leave a lobby room - new functionality
 */
async function leaveLobbyRoom(ws: ServerWebSocket<WSData>, gameId: string) {
  const lobbyRoom = lobbyRooms.get(gameId)
  if (!lobbyRoom) return
  
  // Remove socket from lobby
  lobbyRoom.players.delete(ws)
  
  // If this was the last player, clean up the lobby
  if (lobbyRoom.players.size === 0) {
    lobbyRooms.delete(gameId)
    console.log(`Cleaned up empty lobby room: ${gameId}`)
    return
  }
  
  // Notify remaining players of the disconnection
  try {
    // Load current game state to get updated player list
    const gameRecord = await db
      .select()
      .from(games)
      .where(eq(games.id, gameId))
      .limit(1)
    
    if (gameRecord.length > 0) {
      const loaded = await loadGameOrLobbyState(gameId)
      
      if (loaded.type === 'lobby') {
        const lobbyState = loaded.state
        const players = Array.from(lobbyState.players.values())
        
        broadcastToLobby(gameId, {
          type: 'lobbyUpdate',
          players,
          canStart: lobbyState.status === 'ready'
        })
      }
    }
  } catch (error) {
    console.error('Error updating lobby after player left:', error)
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
 * Broadcast message to all sockets in a lobby room - new functionality
 */
function broadcastToLobby(gameId: string, message: any, excludeSocket?: ServerWebSocket<WSData>) {
  const lobbyRoom = lobbyRooms.get(gameId)
  if (!lobbyRoom) return
  
  const messageStr = JSON.stringify(message)
  
  for (const socket of lobbyRoom.players) {
    if (socket !== excludeSocket && socket.readyState === 1) {
      try {
        socket.send(messageStr)
      } catch (error) {
        console.error('Error broadcasting to lobby socket:', error)
        // Remove broken socket
        lobbyRoom.players.delete(socket)
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
 * Get active lobby rooms count - new functionality
 */
export function getActiveLobbyCount(): number {
  return lobbyRooms.size
}

/**
 * Get connected players count
 */
export function getConnectedPlayersCount(): number {
  return playerSockets.size
}

/**
 * Get lobby statistics - new functionality
 */
export function getLobbyStatistics() {
  const lobbies = Array.from(lobbyRooms.values()).map(lobby => ({
    gameId: lobby.gameId,
    gameCode: lobby.gameCode,
    hostPlayerId: lobby.hostPlayerId,
    playerCount: lobby.players.size,
    lastUpdate: lobby.lastUpdate
  }))
  
  return {
    totalLobbies: lobbyRooms.size,
    lobbies
  }
}

/**
 * Handle adding an AI bot to a lobby
 */
async function handleAddAIBot(ws: ServerWebSocket<WSData>, payload: { gameId: string; difficulty: string; personality: string }) {
  const { gameId, difficulty, personality } = payload
  const { playerId } = ws.data
  
  if (!playerId) {
    ws.send(JSON.stringify({
      type: 'error',
      error: 'No player ID provided'
    }))
    return
  }

  // Prevent duplicate requests within 2 seconds
  const operationKey = `addAI-${gameId}-${playerId}`
  const now = Date.now()
  const existing = pendingAIOperations.get(operationKey)
  
  if (existing && (now - existing.timestamp) < 2000) {
    console.log(`🚫 Duplicate AI bot add request ignored for ${playerId} in ${gameId}`)
    return
  }
  
  pendingAIOperations.set(operationKey, { operation: 'addAI', timestamp: now })
  
  // Clean up old operations (older than 10 seconds)
  for (const [key, op] of pendingAIOperations) {
    if (now - op.timestamp > 10000) {
      pendingAIOperations.delete(key)
    }
  }
  
  try {
    // Verify host permissions
    const lobbyRoom = lobbyRooms.get(gameId)
    if (!lobbyRoom) {
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Lobby not found'
      }))
      return
    }
    
    if (lobbyRoom.hostPlayerId !== playerId) {
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Only the host can add AI bots'
      }))
      return
    }
    
    // Load current game state to check player count
    const gameRecord = await db
      .select()
      .from(games)
      .where(eq(games.id, gameId))
      .limit(1)
    
    if (gameRecord.length === 0) {
      throw new Error('Game not found')
    }
    
    // Load state - should be a lobby for adding AI bots
    const loaded = await loadGameOrLobbyState(gameId)
    
    if (loaded.type !== 'lobby') {
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Cannot add AI bots to active games'
      }))
      return
    }
    
    const lobbyState = loaded.state
    if (lobbyState.players.size >= lobbyState.settings.maxPlayers) {
      ws.send(JSON.stringify({
        type: 'error',
        error: `Lobby is full (maximum ${lobbyState.settings.maxPlayers} players)`
      }))
      return
    }
    
    // Generate AI bot player
    const botName = generateAIBotName()
    const botAvatar = generateAIBotAvatar()
    const botPlayerId = `ai-${crypto.randomUUID()}`
    const botColor = getNextAvailableColor(lobbyState)
    
    // Add AI player to database
    await db.insert(players).values({
      id: botPlayerId,
      gameId,
      userId: null,
      name: botName,
      avatarEmoji: botAvatar,
      color: botColor,
      isAI: true,
      aiPersonality: personality as any,
      aiDifficulty: difficulty as any,
      aiIsAutoMode: true,
      aiThinkingTimeMs: getDifficultyThinkingTime(difficulty),
      isConnected: true
    })
    
    // Broadcast update to lobby
    broadcastToLobby(gameId, {
      type: 'aiBotAdded',
      bot: { 
        id: botPlayerId, 
        name: botName, 
        avatarEmoji: botAvatar, 
        difficulty, 
        personality,
        color: botColor,
        isAI: true
      }
    })
    
    console.log(`🤖 Added AI bot ${botName} to lobby ${gameId}`)
    
  } catch (error) {
    console.error('❌ Error adding AI bot:', error)
    ws.send(JSON.stringify({
      type: 'error',
      error: error instanceof Error ? error.message : 'Failed to add AI bot'
    }))
  }
}

/**
 * Handle removing an AI bot from a lobby
 */
async function handleRemoveAIBot(ws: ServerWebSocket<WSData>, payload: { gameId: string; botPlayerId: string }) {
  const { gameId, botPlayerId } = payload
  const { playerId } = ws.data
  
  if (!playerId) {
    ws.send(JSON.stringify({
      type: 'error',
      error: 'No player ID provided'
    }))
    return
  }

  // Prevent duplicate requests within 2 seconds
  const operationKey = `removeAI-${gameId}-${playerId}-${botPlayerId}`
  const now = Date.now()
  const existing = pendingAIOperations.get(operationKey)
  
  if (existing && (now - existing.timestamp) < 2000) {
    console.log(`🚫 Duplicate AI bot remove request ignored for ${playerId} removing ${botPlayerId} in ${gameId}`)
    return
  }
  
  pendingAIOperations.set(operationKey, { operation: 'removeAI', timestamp: now })
  
  // Clean up old operations (older than 10 seconds)
  for (const [key, op] of pendingAIOperations) {
    if (now - op.timestamp > 10000) {
      pendingAIOperations.delete(key)
    }
  }
  
  try {
    // Verify host permissions
    const lobbyRoom = lobbyRooms.get(gameId)
    if (!lobbyRoom) {
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Lobby not found'
      }))
      return
    }
    
    if (lobbyRoom.hostPlayerId !== playerId) {
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Only the host can remove AI bots'
      }))
      return
    }
    
    // Remove AI player from database
    await db.delete(players)
      .where(eq(players.id, botPlayerId))
    
    // Broadcast update to lobby
    broadcastToLobby(gameId, {
      type: 'aiBotRemoved',
      botPlayerId
    })
    
    console.log(`🤖 Removed AI bot ${botPlayerId} from lobby ${gameId}`)
    
  } catch (error) {
    console.error('❌ Error removing AI bot:', error)
    ws.send(JSON.stringify({
      type: 'error',
      error: error instanceof Error ? error.message : 'Failed to remove AI bot'
    }))
  }
}

// AI Name Generation (Xbox Live style)
function generateAIBotName(): string {
  const adjectives = [
    'Swift', 'Clever', 'Bold', 'Crafty', 'Wise', 'Fierce', 'Silent', 'Noble',
    'Quick', 'Sharp', 'Brave', 'Sly', 'Keen', 'Wild', 'Calm', 'Strong'
  ]
  
  const nouns = [
    'Builder', 'Trader', 'Explorer', 'Merchant', 'Pioneer', 'Settler', 'Farmer',
    'Miner', 'Shepherd', 'Crafter', 'Navigator', 'Strategist', 'Commander', 'Ruler'
  ]
  
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)]
  const noun = nouns[Math.floor(Math.random() * nouns.length)]
  const number = Math.floor(Math.random() * 999) + 1
  
  return `${adjective}${noun}${number}`
}

function generateAIBotAvatar(): string {
  const botAvatars = ['🤖', '👾', '🎮', '⚡', '🔥', '⭐', '💎', '🚀', '🎯', '🏆']
  return botAvatars[Math.floor(Math.random() * botAvatars.length)]
}

function getDifficultyThinkingTime(difficulty: string): number {
  const timings = {
    easy: 1500,
    medium: 2500,
    hard: 3500
  }
  return timings[difficulty as keyof typeof timings] || timings.medium
}

function getNextAvailableColor(state: any): number {
  const usedColors = new Set(
    Array.from(state.players.values()).map((p: any) => p.color)
  )
  
  for (let color = 0; color < 4; color++) {
    if (!usedColors.has(color)) {
      return color
    }
  }
  
  return 0
}

/**
 * Cleanup inactive game rooms and lobbies (optional maintenance) - enhanced
 */
export function cleanupInactiveRooms(maxAgeMinutes: number = 60) {
  const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000)
  
  // Clean up inactive game rooms
  for (const [gameId, room] of gameRooms.entries()) {
    if (room.lastUpdate < cutoffTime && room.sockets.size === 0) {
      gameRooms.delete(gameId)
      console.log(`Cleaned up inactive game room: ${gameId}`)
    }
  }
  
  // Clean up inactive lobby rooms
  for (const [gameId, lobby] of lobbyRooms.entries()) {
    if (lobby.lastUpdate < cutoffTime && lobby.players.size === 0) {
      lobbyRooms.delete(gameId)
      console.log(`Cleaned up inactive lobby room: ${gameId}`)
    }
  }
} 