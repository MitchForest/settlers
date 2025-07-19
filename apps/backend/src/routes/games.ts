import { Hono, type Context } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { generateGameCode, isValidGameCodeFormat, normalizeGameCode } from '../utils/game-codes'
import { eventStore } from '../db/event-store-repository'
import { optionalAuthMiddleware } from '../middleware/auth'
import { lobbyCommandService } from '../services/lobby-command-service'
import { AvailableGamesService } from '../services/available-games-service'

const app = new Hono()

// Apply optional auth middleware to all game routes
app.use('*', optionalAuthMiddleware)

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
function handleDomainError(error: Error, c: Context) {
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
 * Create a new game using event sourcing - supports both authenticated and guest users
 */
app.post('/create', async (c) => {
  try {
    const body = await c.req.json()
    const { hostPlayerName, hostAvatarEmoji, hostUserId } = body

    // For guest users, hostUserId might not be provided
    if (!hostPlayerName) {
      throw new ValidationError('Missing required field: hostPlayerName')
    }

    // Generate unique game ID and code
    const gameId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const gameCode = generateGameCode()

    // Get user info from middleware if authenticated
    const user = c.get('user')
    const userProfile = c.get('userProfile')
    
    // Use authenticated user info if available, otherwise use provided data
          const finalHostUserId = user?.id || hostUserId || null
      const finalHostPlayerName = userProfile?.name || hostPlayerName
      const finalHostAvatarEmoji = userProfile?.avatarEmoji || hostAvatarEmoji || '🧙‍♂️'

    console.log('Creating game:', {
      gameId,
      gameCode,
      hostUserId: finalHostUserId,
      hostPlayerName: finalHostPlayerName,
      isGuest: !user
    })

    // Create game using event store
    console.log('🔄 Calling eventStore.createGame...')
    const result = await eventStore.createGame({
      id: gameId,
      gameCode,
      hostUserId: finalHostUserId,
      hostPlayerName: finalHostPlayerName,
      hostAvatarEmoji: finalHostAvatarEmoji
    })
    console.log('✅ eventStore.createGame completed')

    // Generate proper session token for the host
    const authToken = c.req.header('Authorization')?.replace('Bearer ', '') || ''
    
    // Create session payload matching frontend format
    const sessionPayload = {
      gameId,
      playerId: result.hostPlayer.id,
      userId: finalHostUserId,
      playerName: finalHostPlayerName,
      avatarEmoji: finalHostAvatarEmoji,
      authToken,
      role: 'host' as const,
      permissions: ['start_game', 'add_ai_bots', 'remove_ai_bots', 'kick_players', 'game_actions'],
      expiresAt: Date.now() + (4 * 60 * 60 * 1000),
      issuedAt: Date.now(),
      gameCode
    }
    
    // Generate JWT token matching frontend SimpleJWT implementation
    const header = { alg: 'HS256', typ: 'JWT' }
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64')
    const encodedPayload = Buffer.from(JSON.stringify(sessionPayload)).toString('base64')
    
    const secret = process.env.JWT_SECRET || 'settlers-dev-secret-key'
    const signature = Buffer.from(`${encodedHeader}.${encodedPayload}.${secret}`).toString('base64')
    
    const sessionToken = `${encodedHeader}.${encodedPayload}.${signature}`
    
    const sessionUrl = `/lobby/${gameId}?s=${encodeURIComponent(sessionToken)}`

    return c.json({
      success: true,
      data: {
        gameId,
        gameCode,
        hostPlayerId: result.hostPlayer.id,
        sessionUrl,
        isGuest: !user
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
 * Get game info by code - no auth required
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
 * Join an existing game - supports both authenticated and guest users
 */
app.post('/join', async (c) => {
  try {
    const body = await c.req.json()
    const { gameCode, playerName, avatarEmoji, userId } = body

    if (!gameCode || !playerName) {
      throw new ValidationError('Missing required fields: gameCode, playerName')
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

    // Get user info from middleware if authenticated
    const user = c.get('user')
    const userProfile = c.get('userProfile')
    
    // Use authenticated user info if available, otherwise use provided data
    const finalUserId = user?.id || userId || null
          const finalPlayerName = userProfile?.name || playerName
      const finalAvatarEmoji = userProfile?.avatarEmoji || avatarEmoji || '🧙‍♂️'

    console.log('Joining game:', {
      gameCode: normalizedCode,
      userId: finalUserId,
      playerName: finalPlayerName,
      isGuest: !user
    })

    // Join game using lobby command service
    const result = await lobbyCommandService.joinGame({
      gameId: game.id,
      userId: finalUserId,
      playerName: finalPlayerName,
      avatarEmoji: finalAvatarEmoji
    })

    if (!result.success) {
      throw new ValidationError(result.error || 'Failed to join game')
    }

    // Generate session URL for the player
    const sessionUrl = `/lobby/${game.id}?player=${result.playerId}`

          return c.json({
        success: true,
        data: {
          gameId: game.id,
          gameCode: game.gameCode,
          playerId: result.playerId,
          sessionUrl,
          isGuest: !user
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
 * Get available games with social discovery
 * GET /api/games/available
 */
app.get('/available', 
  zValidator('query', z.object({
    phase: z.enum(['lobby', 'initial_placement', 'main_game']).optional(),
    minPlayers: z.coerce.number().min(0).max(8).optional(),
    maxPlayers: z.coerce.number().min(1).max(8).optional(), 
    search: z.string().min(1).max(50).optional(),
    limit: z.coerce.number().min(1).max(50).default(20),
    offset: z.coerce.number().min(0).default(0)
  })),
  async (c) => {
    try {
      const user = c.get('user')
      const filters = c.req.valid('query')

      const availableGames = await AvailableGamesService.getAvailableGames(user?.id, filters)

      return c.json({
        success: true,
        data: availableGames
      })

    } catch (error) {
      console.error('Error fetching available games:', error)
      return c.json({
        success: false,
        error: 'Failed to fetch available games'
      }, 500)
    }
  }
)

/**
 * Find game by code
 * GET /api/games/code/:gameCode
 */
app.get('/code/:gameCode', async (c) => {
  try {
    const gameCode = c.req.param('gameCode')

    if (!gameCode || gameCode.length !== 6) {
      return c.json({
        success: false,
        error: 'Invalid game code. Must be 6 characters.'
      }, 400)
    }

    const result = await AvailableGamesService.getGameByCode(gameCode)

    if (!result.success) {
      return c.json({
        success: false,
        error: result.error
      }, 404)
    }

    return c.json({
      success: true,
      data: result.game
    })

  } catch (error) {
    console.error('Error finding game by code:', error)
    return c.json({
      success: false,
      error: 'Failed to find game'
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