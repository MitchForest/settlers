// Game management routes
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db, games, players } from '../db'
import { eq, desc } from 'drizzle-orm'
import { GameFlowManager } from '@settlers/core'

const app = new Hono()

// Validation schemas
const createGameSchema = z.object({
  playerNames: z.array(z.string().min(1)).min(3).max(4),
  settings: z.object({
    victoryPoints: z.number().default(10),
    boardLayout: z.string().default('standard'),
    randomizeBoard: z.boolean().default(true),
    randomizePlayerOrder: z.boolean().default(true),
    allowUndo: z.boolean().default(false),
    turnTimerSeconds: z.number().default(0),
    privateTradeEnabled: z.boolean().default(true),
    developmentCardLimit: z.number().default(25)
  }).optional()
})

// Get all games
app.get('/', async (c) => {
  try {
    const allGames = await db
      .select({
        id: games.id,
        status: games.status,
        phase: games.phase,
        turn: games.turn,
        createdAt: games.createdAt
      })
      .from(games)
      .orderBy(desc(games.createdAt))
      .limit(50)

    return c.json({ games: allGames })
  } catch (error) {
    console.error('Error fetching games:', error)
    return c.json({ error: 'Failed to fetch games' }, 500)
  }
})

// Get game by ID
app.get('/:id', async (c) => {
  const gameId = c.req.param('id')
  
  try {
    const [game] = await db
      .select()
      .from(games)
      .where(eq(games.id, gameId))
      .limit(1)

    if (!game) {
      return c.json({ error: 'Game not found' }, 404)
    }

    // Get players
    const gamePlayers = await db
      .select()
      .from(players)
      .where(eq(players.gameId, gameId))

    return c.json({ 
      game,
      players: gamePlayers
    })
  } catch (error) {
    console.error('Error fetching game:', error)
    return c.json({ error: 'Failed to fetch game' }, 500)
  }
})

// Create a new game
app.post('/', 
  zValidator('json', createGameSchema),
  async (c) => {
    const data = c.req.valid('json')
    
    try {
      // Create game using GameFlowManager
      const gameManager = GameFlowManager.createGame({
        playerNames: data.playerNames
      })

      const gameState = gameManager.getState()
      const gameId = gameState.id

      // Save to database
      await db.insert(games).values({
        id: gameId,
        name: `Game ${gameId.slice(0, 8)}`,
        settings: {
          victoryPoints: 10,
          boardLayout: 'standard',
          randomizePlayerOrder: true,
          randomizeTerrain: true,
          randomizeNumbers: true
        },
        board: {
          hexes: [],
          ports: [],
          robberPosition: { q: 0, r: 0, s: 0 }
        },
        phase: gameState.phase,
        turn: gameState.turn,
        currentPlayerIndex: 0, // Convert from PlayerId to index later
        status: 'waiting'
      })

      // Create player records
      let playerIndex = 0
      for (const [playerId, player] of gameState.players) {
        await db.insert(players).values({
          id: playerId,
          gameId,
          name: player.name,
          color: playerIndex, // Use index as color for now
          isHost: playerIndex === 0,
          resources: {
            wood: player.resources.wood,
            brick: player.resources.brick,
            sheep: player.resources.sheep,
            wheat: player.resources.wheat,
            ore: player.resources.ore
          },
          score: {
            public: player.score.public,
            hidden: player.score.hidden,
            total: player.score.total
          },
          knightsPlayed: player.knightsPlayed || 0,
          hasLongestRoad: player.hasLongestRoad || false,
          hasLargestArmy: player.hasLargestArmy || false
        })
        playerIndex++
      }

      return c.json({ 
        success: true,
        gameId,
        message: 'Game created successfully'
      }, 201)
    } catch (error) {
      console.error('Error creating game:', error)
      return c.json({ error: 'Failed to create game' }, 500)
    }
  }
)

// Delete a game
app.delete('/:id', async (c) => {
  const gameId = c.req.param('id')
  
  try {
    // Check if game exists
    const [game] = await db
      .select()
      .from(games)
      .where(eq(games.id, gameId))
      .limit(1)

    if (!game) {
      return c.json({ error: 'Game not found' }, 404)
    }

    // Delete game (cascade will delete related records)
    await db.delete(games).where(eq(games.id, gameId))

    return c.json({ 
      success: true,
      message: 'Game deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting game:', error)
    return c.json({ error: 'Failed to delete game' }, 500)
  }
})

export default app 