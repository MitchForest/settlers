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
        maxPlayers: games.maxPlayers,
        createdAt: games.createdAt,
        startedAt: games.startedAt
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
        playerNames: data.playerNames,
        settings: data.settings
      })

      const gameState = gameManager.getState()
      const gameId = gameState.id

      // Save to database
      await db.insert(games).values({
        id: gameId,
        state: gameState,
        phase: gameState.phase,
        turn: gameState.turn,
        currentPlayerIndex: gameState.currentPlayerIndex,
        maxPlayers: data.playerNames.length,
        status: 'waiting'
      })

      // Create player records
      for (const [playerId, player] of gameState.players) {
        await db.insert(players).values({
          id: playerId,
          gameId,
          name: player.name,
          color: player.color.toString(),
          playerIndex: gameState.playerOrder.indexOf(playerId),
          resource1: player.resources.resource1,
          resource2: player.resources.resource2,
          resource3: player.resources.resource3,
          resource4: player.resources.resource4,
          resource5: player.resources.resource5,
          publicScore: player.score.public,
          hiddenScore: player.score.hidden,
          knightsPlayed: player.knightsPlayed,
          hasLongestPath: player.hasLongestPath,
          hasLargestForce: player.hasLargestForce,
          isAI: player.isAI,
          isConnected: false
        })
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