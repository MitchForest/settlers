import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { GameFlowManager, GameAction, ActionType } from '@settlers/core'
import { games, players, gameEvents, db } from '../db'
import { desc, eq } from 'drizzle-orm'
import { prepareGameStateForDB, loadGameStateFromDB } from '../db/game-state-serializer'

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
 * GET /games/:id - Get game by ID with full state
 */
app.get('/:id', async (c) => {
  const gameId = c.req.param('id')
  
  try {
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
 * POST /games - Create new game
 */
app.post('/', 
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
        status: 'waiting'
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

export default app 