import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { GameFlowManager, GameAction, ActionType } from '@settlers/core'
import { games, players, gameEvents, gameObservers, db } from '../db'
import { desc, eq, and, count } from 'drizzle-orm'
import { prepareGameStateForDB, loadGameStateFromDB } from '../db/game-state-serializer'
import { 
  generateUniqueGameCode, 
  findActiveGameByCode, 
  normalizeGameCode,
  isValidGameCodeFormat 
} from '../utils/game-codes'
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth'
import { getUserProfile } from '../auth/supabase'

const app = new Hono()

// Validation schemas
const createGameSchema = z.object({
  playerNames: z.array(z.string().min(1)).min(3).max(4),
  settings: z.object({
    victoryPoints: z.number().default(10),
    boardLayout: z.string().default('standard'),
    randomizePlayerOrder: z.boolean().default(true),
    turnTimerSeconds: z.number().default(0)
  }).optional()
})

// Enhanced schema for lobby game creation
const createLobbyGameSchema = z.object({
  hostUserId: z.string().uuid(),
  maxPlayers: z.number().min(3).max(4).default(4),
  allowObservers: z.boolean().default(true),
  isPublic: z.boolean().default(true)
})

// Schema for joining by game code
const joinByCodeSchema = z.object({
  gameCode: z.string().length(6).transform(normalizeGameCode),
  playerName: z.string().min(1).max(50)
})

// Schema for starting a game
const startGameSchema = z.object({
  hostPlayerId: z.string().uuid()
})

const gameActionSchema = z.object({
  type: z.string(),
  playerId: z.string(),
  data: z.any().optional()
})

// Enhanced schema for setup actions
const setupActionSchema = z.object({
  type: z.enum(['rollForOrder', 'placeInitialSettlement', 'placeInitialRoad', 'confirmSetupComplete']),
  playerId: z.string(),
  data: z.object({
    position: z.any().optional(), // VertexPosition or EdgePosition
    roll: z.number().optional() // For rollForOrder
  }).optional()
})

/**
 * GET /games - List all games
 */
app.get('/', async (c) => {
  try {
    const allGames = await db
      .select({
        id: games.id,
        name: games.name,
        status: games.status,
        phase: games.phase,
        turn: games.turn,
        gameCode: games.gameCode,
        createdAt: games.createdAt
      })
      .from(games)
      .orderBy(desc(games.createdAt))
      .limit(50)

    return c.json({ 
      success: true, 
      games: allGames 
    })
  } catch (error) {
    console.error('Error fetching games:', error)
    return c.json({ 
      success: false, 
      error: 'Failed to fetch games' 
    }, 500)
  }
})

/**
 * GET /games/:id - Get specific game
 */
app.get('/:id', async (c) => {
  try {
    const gameId = c.req.param('id')
    
    const gameRecord = await db
      .select()
      .from(games)
      .where(eq(games.id, gameId))
      .limit(1)

    if (gameRecord.length === 0) {
      return c.json({ 
        success: false, 
        error: 'Game not found' 
      }, 404)
    }

    const gameState = await loadGameStateFromDB(gameRecord[0])
    
    return c.json({ 
      success: true,
      game: gameState 
    })
  } catch (error) {
    console.error('Error fetching game:', error)
    return c.json({ 
      success: false, 
      error: 'Failed to fetch game' 
    }, 500)
  }
})

/**
 * POST /games - Create new lobby game with game code
 */
app.post('/', 
  authMiddleware,
  zValidator('json', createLobbyGameSchema),
  async (c) => {
    const { hostUserId, maxPlayers, allowObservers, isPublic } = c.req.valid('json')
    const authenticatedUserId = c.get('userId')
    const userProfile = c.get('userProfile')
    
    try {
      // Validate that hostUserId matches authenticated user
      if (hostUserId !== authenticatedUserId) {
        return c.json({ 
          success: false, 
          error: 'Host user ID must match authenticated user' 
        }, 403)
      }

      // Ensure user has a profile
      if (!userProfile) {
        return c.json({ 
          success: false, 
          error: 'User profile not found. Please complete your profile setup.' 
        }, 400)
      }
      
      // Generate unique game code
      const gameCode = await generateUniqueGameCode()
      
      // Create game with host player using their display name
      const hostPlayerName = userProfile.display_name || userProfile.username
      const gameManager = GameFlowManager.createGame({
        playerNames: [hostPlayerName],
        gameId: crypto.randomUUID(),
        randomizePlayerOrder: false // Will randomize when game starts
      })

      const gameState = gameManager.getState()
      const hostPlayerId = Array.from(gameState.players.keys())[0]
      const gameData = prepareGameStateForDB(gameState)

      // Save to database with new observer features
      await db.insert(games).values({
        ...gameData,
        gameCode,
        hostPlayerId,
        hostUserId: hostUserId,
        name: `${hostPlayerName}'s Game`,
        status: 'lobby',
        allowObservers,
        isPublic,
        maxObservers: 4, // Fixed at 4 as requested
        settings: {
          victoryPoints: 10,
          boardLayout: 'standard',
          randomizePlayerOrder: true,
          randomizeTerrain: true,
          randomizeNumbers: true
        }
      })

      // Update the host player record to include user information
      await db.update(players)
        .set({ 
          userId: hostUserId,
          avatarEmoji: userProfile.avatar_emoji
        })
        .where(eq(players.id, hostPlayerId))

      console.log(`✅ Created lobby game ${gameState.id} with code ${gameCode} for user ${hostUserId}`)

      return c.json({ 
        success: true,
        gameId: gameState.id,
        gameCode,
        hostPlayerId,
        maxPlayers,
        allowObservers,
        isPublic,
        hostPlayerName
      }, 201)
    } catch (error) {
      console.error('❌ Failed to create lobby game:', error)
      return c.json({ 
        success: false, 
        error: 'Failed to create game' 
      }, 500)
    }
  }
)

/**
 * POST /games/join-by-code - Join game by code
 */
app.post('/join-by-code',
  zValidator('json', joinByCodeSchema),
  async (c) => {
    const { gameCode, playerName } = c.req.valid('json')
    
    try {
      // Validate game code format
      if (!isValidGameCodeFormat(gameCode)) {
        return c.json({ 
          success: false, 
          error: 'Invalid game code format' 
        }, 400)
      }

      // Find active game by code
      const game = await findActiveGameByCode(gameCode)
      if (!game) {
        return c.json({ 
          success: false, 
          error: 'Game not found or no longer available' 
        }, 404)
      }
      
      if (game.status !== 'lobby') {
        return c.json({ 
          success: false, 
          error: 'Game has already started' 
        }, 400)
      }
      
      // Load current game state
      const gameState = await loadGameStateFromDB(game)
      
      // Check if room for more players
      if (gameState.players.size >= 4) {
        return c.json({ 
          success: false, 
          error: 'Game is full' 
        }, 400)
      }
      
      // Check if player name is already taken
      const existingNames = Array.from(gameState.players.values()).map(p => p.name.toLowerCase())
      if (existingNames.includes(playerName.toLowerCase())) {
        return c.json({ 
          success: false, 
          error: 'Player name already taken' 
        }, 400)
      }
      
      // Add new player to game
      const newPlayerId = crypto.randomUUID()
      const newPlayer = {
        id: newPlayerId,
        name: playerName,
        color: gameState.players.size as 0 | 1 | 2 | 3, // Assign next available color
        score: { public: 0, hidden: 0, total: 0 },
        resources: { wood: 0, brick: 0, ore: 0, wheat: 0, sheep: 0 },
        developmentCards: [],
        buildings: { settlements: 5, cities: 4, roads: 15 },
        knightsPlayed: 0,
        hasLongestRoad: false,
        hasLargestArmy: false,
        isConnected: true,
        isAI: false
      }
      
      gameState.players.set(newPlayerId, newPlayer)
      
      // Update database
      const gameData = prepareGameStateForDB(gameState)
      await db.update(games)
        .set(gameData)
        .where(eq(games.id, game.id))

      console.log(`✅ Player ${playerName} joined game ${game.id} (${gameCode})`)

      return c.json({
        success: true,
        gameId: game.id,
        playerId: newPlayerId,
        players: Array.from(gameState.players.values()),
        gameCode,
        canStart: gameState.players.size >= 3
      })
    } catch (error) {
      console.error('❌ Failed to join game:', error)
      return c.json({ 
        success: false, 
        error: 'Failed to join game' 
      }, 500)
    }
  }
)

/**
 * POST /games/:id/start - Start game from lobby (host only)
 */
app.post('/:id/start',
  zValidator('json', startGameSchema),
  async (c) => {
    const gameId = c.req.param('id')
    const { hostPlayerId } = c.req.valid('json')
    
    try {
      // Find game
      const gameRecord = await db
        .select()
        .from(games)
        .where(eq(games.id, gameId))
        .limit(1)
      
      if (gameRecord.length === 0) {
        return c.json({ 
          success: false, 
          error: 'Game not found' 
        }, 404)
      }
      
      const game = gameRecord[0]
      
      // Verify host permission
      if (game.hostPlayerId !== hostPlayerId) {
        return c.json({ 
          success: false, 
          error: 'Only the host can start the game' 
        }, 403)
      }
      
      // Verify game is in lobby state
      if (game.status !== 'lobby') {
        return c.json({ 
          success: false, 
          error: 'Game is not in lobby state' 
        }, 400)
      }
      
      // Load game state and check player count
      const gameState = await loadGameStateFromDB(game)
      if (gameState.players.size < 3) {
        return c.json({ 
          success: false, 
          error: 'Need at least 3 players to start' 
        }, 400)
      }
      
      // Update game status to playing
      await db.update(games)
        .set({ 
          status: 'playing',
          startedAt: new Date()
        })
        .where(eq(games.id, gameId))
      
      console.log(`✅ Started game ${gameId} with ${gameState.players.size} players`)
      
      return c.json({ 
        success: true,
        message: 'Game started successfully'
      })
    } catch (error) {
      console.error('❌ Failed to start game:', error)
      return c.json({ 
        success: false, 
        error: 'Failed to start game' 
      }, 500)
    }
  }
)

/**
 * POST /games (Legacy) - Create new game with immediate start
 */
app.post('/legacy', 
  zValidator('json', createGameSchema),
  async (c) => {
    const data = c.req.valid('json')
    
    try {
      // Create game using GameFlowManager
      const gameManager = GameFlowManager.createGame({
        playerNames: data.playerNames,
        randomizePlayerOrder: data.settings?.randomizePlayerOrder ?? true
      })

      const gameState = gameManager.getState()
      const gameData = prepareGameStateForDB(gameState)

      // Save to database using comprehensive schema
      await db.insert(games).values({
        ...gameData,
        name: `Game ${gameState.id.slice(0, 8)}`,
        settings: {
          victoryPoints: data.settings?.victoryPoints ?? 10,
          boardLayout: data.settings?.boardLayout ?? 'standard',
          randomizePlayerOrder: data.settings?.randomizePlayerOrder ?? true,
          randomizeTerrain: true,
          randomizeNumbers: true
        },
        status: 'playing' // Start immediately
      })

      return c.json({ 
        success: true,
        game: gameState 
      }, 201)
    } catch (error) {
      console.error('Error creating game:', error)
      return c.json({ 
        success: false, 
        error: 'Failed to create game' 
      }, 500)
    }
  }
)

/**
 * POST /games/:id/actions - Process game action
 */
app.post('/:id/actions',
  zValidator('json', gameActionSchema),
  async (c) => {
    const gameId = c.req.param('id')
    const actionData = c.req.valid('json')
    
    try {
      // Load current game state
      const gameRecord = await db
        .select()
        .from(games)
        .where(eq(games.id, gameId))
        .limit(1)

      if (gameRecord.length === 0) {
        return c.json({ 
          success: false, 
          error: 'Game not found' 
        }, 404)
      }

      const gameState = await loadGameStateFromDB(gameRecord[0])
      
      // Create game manager and process action
      const gameManager = new GameFlowManager(gameState)
      
      const action: GameAction = {
        type: actionData.type as ActionType,
        playerId: actionData.playerId,
        ...actionData.data
      }

      const result = gameManager.processAction(action)
      
      if (!result.success) {
        return c.json({ 
          success: false, 
          error: result.error 
        }, 400)
      }

      // Save updated game state
      const updatedGameState = gameManager.getState()
      const updatedGameData = prepareGameStateForDB(updatedGameState)
      
      await db
        .update(games)
        .set(updatedGameData)
        .where(eq(games.id, gameId))

      // Log the action
      await db.insert(gameEvents).values({
        id: crypto.randomUUID(),
        gameId,
        playerId: actionData.playerId,
        type: actionData.type,
        data: actionData.data || {},
        timestamp: new Date()
      })

      return c.json({ 
        success: true,
        game: updatedGameState,
        events: result.events || []
      })
    } catch (error) {
      console.error('Error processing action:', error)
      return c.json({ 
        success: false, 
        error: 'Failed to process action' 
      }, 500)
    }
  }
)

/**
 * GET /games/:id/events - Get game events history
 */
app.get('/:id/events', async (c) => {
  const gameId = c.req.param('id')
  
  try {
    const events = await db
      .select()
      .from(gameEvents)
      .where(eq(gameEvents.gameId, gameId))
      .orderBy(gameEvents.timestamp)

    return c.json({ 
      success: true,
      events 
    })
  } catch (error) {
    console.error('Error fetching events:', error)
    return c.json({ 
      success: false, 
      error: 'Failed to fetch events' 
    }, 500)
  }
})

/**
 * DELETE /games/:id - Delete game
 */
app.delete('/:id', async (c) => {
  const gameId = c.req.param('id')
  
  try {
    await db.delete(games).where(eq(games.id, gameId))
    
    return c.json({ 
      success: true,
      message: 'Game deleted successfully' 
    })
  } catch (error) {
    console.error('Error deleting game:', error)
    return c.json({ 
      success: false, 
      error: 'Failed to delete game' 
    }, 500)
  }
})

/**
 * POST /games/:id/observers - Join as observer
 */
app.post('/:id/observers',
  authMiddleware,
  async (c) => {
    const gameId = c.req.param('id')
    const userId = c.get('userId')
    const userProfile = c.get('userProfile')
    
    try {
      // Check if game exists and allows observers
      const game = await db
        .select({
          id: games.id,
          allowObservers: games.allowObservers,
          maxObservers: games.maxObservers,
          status: games.status
        })
        .from(games)
        .where(eq(games.id, gameId))
        .limit(1)
      
      if (game.length === 0) {
        return c.json({ 
          success: false, 
          error: 'Game not found' 
        }, 404)
      }
      
      const gameData = game[0]
      
      if (!gameData.allowObservers) {
        return c.json({ 
          success: false, 
          error: 'This game does not allow observers' 
        }, 403)
      }
      
      // Check if user is already a player in this game
      const existingPlayer = await db
        .select()
        .from(players)
        .where(and(eq(players.gameId, gameId), eq(players.userId, userId)))
        .limit(1)
      
      if (existingPlayer.length > 0) {
        return c.json({ 
          success: false, 
          error: 'You are already a player in this game' 
        }, 400)
      }
      
      // Check if user is already observing
      const existingObserver = await db
        .select()
        .from(gameObservers)
        .where(and(eq(gameObservers.gameId, gameId), eq(gameObservers.userId, userId)))
        .limit(1)
      
      if (existingObserver.length > 0) {
        return c.json({ 
          success: false, 
          error: 'You are already observing this game' 
        }, 400)
      }
      
      // Check observer limit
      const observerCount = await db
        .select({ count: count() })
        .from(gameObservers)
        .where(eq(gameObservers.gameId, gameId))
      
      if (observerCount[0].count >= gameData.maxObservers) {
        return c.json({ 
          success: false, 
          error: `Maximum ${gameData.maxObservers} observers allowed` 
        }, 400)
      }
      
      // Add user as observer
      await db.insert(gameObservers).values({
        gameId,
        userId
      })
      
      console.log(`👀 User ${userId} joined game ${gameId} as observer`)
      
      return c.json({ 
        success: true,
        message: 'Successfully joined as observer',
        observerCount: observerCount[0].count + 1
      })
    } catch (error) {
      console.error('Error joining as observer:', error)
      return c.json({ 
        success: false, 
        error: 'Failed to join as observer' 
      }, 500)
    }
  }
)

/**
 * DELETE /games/:id/observers - Leave as observer (or remove observer if host)
 */
app.delete('/:id/observers',
  authMiddleware,
  async (c) => {
    const gameId = c.req.param('id')
    const userId = c.get('userId')
    const targetUserId = c.req.query('userId') || userId // Allow host to remove specific observer
    
    try {
      // Check if game exists
      const game = await db
        .select({
          id: games.id,
          hostUserId: games.hostUserId
        })
        .from(games)
        .where(eq(games.id, gameId))
        .limit(1)
      
      if (game.length === 0) {
        return c.json({ 
          success: false, 
          error: 'Game not found' 
        }, 404)
      }
      
      const isHost = game[0].hostUserId === userId
      const isSelfRemoval = targetUserId === userId
      
      // Only allow self-removal or host removing others
      if (!isSelfRemoval && !isHost) {
        return c.json({ 
          success: false, 
          error: 'You can only remove yourself or, if host, remove other observers' 
        }, 403)
      }
      
      // Remove observer
      const result = await db
        .delete(gameObservers)
        .where(and(
          eq(gameObservers.gameId, gameId),
          eq(gameObservers.userId, targetUserId)
        ))
      
      // Check if observer was found and removed by checking if result is truthy
      console.log(`👋 User ${targetUserId} left game ${gameId} as observer`)
      
      return c.json({ 
        success: true,
        message: isSelfRemoval ? 'Left as observer' : 'Observer removed'
      })
    } catch (error) {
      console.error('Error removing observer:', error)
      return c.json({ 
        success: false, 
        error: 'Failed to remove observer' 
      }, 500)
    }
  }
)

/**
 * GET /games/:id/observers - List game observers
 */
app.get('/:id/observers',
  optionalAuthMiddleware,
  async (c) => {
    const gameId = c.req.param('id')
    
    try {
      // Check if game exists and is public or user has access
      const game = await db
        .select({
          id: games.id,
          isPublic: games.isPublic,
          hostUserId: games.hostUserId,
          allowObservers: games.allowObservers
        })
        .from(games)
        .where(eq(games.id, gameId))
        .limit(1)
      
      if (game.length === 0) {
        return c.json({ 
          success: false, 
          error: 'Game not found' 
        }, 404)
      }
      
      const gameData = game[0]
      const userId = c.get('userId')
      
      // Check access permissions
      if (!gameData.isPublic && gameData.hostUserId !== userId) {
        // Check if user is a player or observer
        const hasAccess = await db
          .select()
          .from(players)
          .where(and(eq(players.gameId, gameId), eq(players.userId, userId || '')))
          .limit(1)
        
        if (hasAccess.length === 0) {
          const isObserver = await db
            .select()
            .from(gameObservers)
            .where(and(eq(gameObservers.gameId, gameId), eq(gameObservers.userId, userId || '')))
            .limit(1)
          
          if (isObserver.length === 0) {
            return c.json({ 
              success: false, 
              error: 'Access denied to private game' 
            }, 403)
          }
        }
      }
      
      // Get observers list
      const observers = await db
        .select({
          userId: gameObservers.userId,
          joinedAt: gameObservers.joinedAt
        })
        .from(gameObservers)
        .where(eq(gameObservers.gameId, gameId))
        .orderBy(gameObservers.joinedAt)
      
      return c.json({ 
        success: true,
        observers,
        count: observers.length,
        maxObservers: 4,
        allowObservers: gameData.allowObservers
      })
    } catch (error) {
      console.error('Error fetching observers:', error)
      return c.json({ 
        success: false, 
        error: 'Failed to fetch observers' 
      }, 500)
    }
  }
)

/**
 * GET /games/public - List public games
 */
app.get('/public',
  optionalAuthMiddleware,
  async (c) => {
    try {
      const publicGames = await db
        .select({
          id: games.id,
          name: games.name,
          status: games.status,
          gameCode: games.gameCode,
          allowObservers: games.allowObservers,
          maxObservers: games.maxObservers,
          createdAt: games.createdAt
        })
        .from(games)
        .where(and(
          eq(games.isPublic, true),
          eq(games.status, 'lobby') // Only show games in lobby status
        ))
        .orderBy(desc(games.createdAt))
        .limit(20)
      
      // Get player counts for each game
      const gamesWithCounts = await Promise.all(
        publicGames.map(async (game) => {
          const playerCount = await db
            .select({ count: count() })
            .from(players)
            .where(eq(players.gameId, game.id))
          
          const observerCount = await db
            .select({ count: count() })
            .from(gameObservers)
            .where(eq(gameObservers.gameId, game.id))
          
          return {
            ...game,
            playerCount: playerCount[0].count,
            observerCount: observerCount[0].count
          }
        })
      )
      
      return c.json({ 
        success: true,
        games: gamesWithCounts
      })
    } catch (error) {
      console.error('Error fetching public games:', error)
      return c.json({ 
        success: false, 
        error: 'Failed to fetch public games' 
      }, 500)
    }
  }
)

export default app 