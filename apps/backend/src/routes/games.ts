import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { generateGameCode, isValidGameCodeFormat, normalizeGameCode } from '../utils/game-codes'
import { eventStore } from '../db/event-store-repository'

const app = new Hono()

// Domain error types
class GameCodeFormatError extends Error {
  constructor(message: string = 'Invalid game code format. Must be 6 uppercase letters/numbers.') {
    super(message)
    this.name = 'GameCodeFormatError'
  }
}

class GameNotFoundError extends Error {
  constructor(message: string = 'Game not found') {
    super(message)
    this.name = 'GameNotFoundError'
  }
}

class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

// Helper function to map domain errors to HTTP responses
function handleDomainError(error: Error, c: any) {
  if (error instanceof GameCodeFormatError) {
    return c.json({ success: false, error: error.message }, 400)
  }
  if (error instanceof GameNotFoundError) {
    return c.json({ success: false, error: error.message }, 404)
  }
  if (error instanceof ValidationError) {
    return c.json({ success: false, error: error.message }, 400)
  }
  // Unknown error - log and return 500
  console.error('Unexpected error:', error)
  return c.json({ success: false, error: 'Internal server error' }, 500)
}

/**
 * Create a new game using event sourcing
 */
app.post('/create', async (c) => {
  try {
    const body = await c.req.json()
    const { hostPlayerName, hostAvatarEmoji, hostUserId } = body

    if (!hostPlayerName) {
      throw new ValidationError('Missing required field: hostPlayerName')
    }

    // Generate unique game ID and code
    const gameId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const gameCode = generateGameCode()

    // Create game using event store
    const result = await eventStore.createGame({
      id: gameId,
      gameCode,
      hostUserId,
      hostPlayerName,
      hostAvatarEmoji
    })

    // Generate session URL for the host
    const sessionUrl = `/lobby/${gameId}?player=${result.hostPlayer.id}`

    return c.json({
      success: true,
      data: {
        gameId,
        gameCode,
        hostPlayerId: result.hostPlayer.id,
        sessionUrl
      }
    })

  } catch (error) {
    // Handle domain errors
    if (error instanceof ValidationError) {
      return handleDomainError(error, c)
    }
    
    console.error('Error creating game:', error)
    return c.json({ 
      success: false, 
      error: 'Failed to create game' 
    }, 500)
  }
})

/**
 * Get game info by code
 */
app.get('/info/:gameCode', async (c) => {
  try {
    const gameCode = c.req.param('gameCode')
    
    if (!gameCode) {
      throw new ValidationError('Game code is required')
    }

    // Validate and normalize game code format
    const normalizedCode = normalizeGameCode(gameCode)
    if (!isValidGameCodeFormat(normalizedCode)) {
      throw new GameCodeFormatError()
    }

    const game = await eventStore.getGameByCode(normalizedCode)
    
    if (!game) {
      throw new GameNotFoundError()
    }

    // Get current events to determine state
    const events = await eventStore.getGameEvents(game.id)
    
    return c.json({
      success: true,
      data: {
        gameId: game.id,
        gameCode: game.gameCode,
        phase: game.currentPhase,
        isActive: game.isActive,
        eventCount: events.length,
        createdAt: game.createdAt
      }
    })

  } catch (error) {
    // Handle domain errors with proper mapping
    if (error instanceof GameCodeFormatError || 
        error instanceof GameNotFoundError || 
        error instanceof ValidationError) {
      return handleDomainError(error, c)
    }
    
    console.error('Error getting game info:', error)
    return c.json({ 
      success: false, 
      error: 'Failed to get game info' 
    }, 500)
  }
})

/**
 * Join an existing game
 */
app.post('/join', async (c) => {
  try {
    const body = await c.req.json()
    const { gameCode, playerName, avatarEmoji, userId } = body

    if (!gameCode || !playerName || !userId) {
      throw new ValidationError('Missing required fields: gameCode, playerName, userId')
    }

    // Validate and normalize game code format
    const normalizedCode = normalizeGameCode(gameCode)
    if (!isValidGameCodeFormat(normalizedCode)) {
      throw new GameCodeFormatError()
    }

    const game = await eventStore.getGameByCode(normalizedCode)
    
    if (!game) {
      throw new GameNotFoundError()
    }

    // For now, we don't actually join via REST API
    // Instead, we return the game info and let the WebSocket connection handle joining
    // This ensures proper event ordering and real-time updates

    return c.json({
      success: true,
      data: {
        gameId: game.id,
        gameCode: game.gameCode,
        phase: game.currentPhase,
        // Frontend should connect to WebSocket and send joinLobby message
        websocketUrl: `/ws`,
        joinInstructions: 'Connect to WebSocket and send joinLobby message'
      }
    })

  } catch (error) {
    // Handle domain errors with proper mapping
    if (error instanceof GameCodeFormatError || 
        error instanceof GameNotFoundError || 
        error instanceof ValidationError) {
      return handleDomainError(error, c)
    }
    
    console.error('Error joining game:', error)
    return c.json({ 
      success: false, 
      error: 'Failed to join game' 
    }, 500)
  }
})

/**
 * Health check endpoint
 */
app.get('/health', (c) => {
  return c.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      eventStore: 'active',
      architecture: 'event-sourced'
    }
  })
})

export default app 