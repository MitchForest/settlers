// ============= Backend Lobby Serialization =============
// Database integration layer for lobby state management

import { 
  LobbyState, 
  LobbyPlayer, 
  prepareLobbyForDB,
  loadLobbyFromDB,
  serializeLobbyState,
  deserializeLobbyState
} from '@settlers/core'
import { games, players, db } from './index'
import { eq } from 'drizzle-orm'

/**
 * Save lobby state to database
 * Creates both games record and player records
 */
export async function saveLobbyToDB(lobbyState: LobbyState, gameCode: string) {
  const lobbyData = prepareLobbyForDB(lobbyState)
  
  // Insert/update games record
  await db.insert(games).values({
    ...lobbyData,
    gameCode,
    name: `${getLobbyHost(lobbyState).name}'s Game`
  }).onConflictDoUpdate({
    target: games.id,
    set: {
      lobbyState: lobbyData.lobbyState,
      updatedAt: new Date()
    }
  })

  // Insert/update player records
  const lobbyPlayers = Array.from(lobbyState.players.values())
  for (const player of lobbyPlayers) {
    await db.insert(players).values({
      id: player.id,
      gameId: lobbyState.id,
      userId: player.userId || null,
      name: player.name,
      avatarEmoji: player.avatarEmoji,
      isHost: player.isHost,
      isAI: player.isAI,
      isConnected: player.isConnected,
      joinedAt: player.joinedAt,
      // AI configuration
      aiPersonality: player.aiConfig?.personality || null,
      aiDifficulty: player.aiConfig?.difficulty || null,
      aiThinkingTimeMs: player.aiConfig?.thinkingTimeMs || 2000,
      aiMaxActionsPerTurn: player.aiConfig?.maxActionsPerTurn || 15,
      // Lobby phase - no game data yet
      color: null,
      score: { public: 0, hidden: 0, total: 0 },
      resources: { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 },
      buildings: { settlements: 5, cities: 4, roads: 15 },
      knightsPlayed: 0,
      hasLongestRoad: false,
      hasLargestArmy: false
    }).onConflictDoUpdate({
      target: players.id,
      set: {
        name: player.name,
        avatarEmoji: player.avatarEmoji,
        isConnected: player.isConnected,
        aiPersonality: player.aiConfig?.personality || null,
        aiDifficulty: player.aiConfig?.difficulty || null
      }
    })
  }
}

/**
 * Load lobby state from database
 */
export async function loadLobbyFromDatabase(gameId: string): Promise<LobbyState> {
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
    throw new Error(`Game is not in lobby state (status: ${game.status})`)
  }

  return loadLobbyFromDB(game)
}

/**
 * Update lobby player in database
 */
export async function updateLobbyPlayerInDB(
  gameId: string, 
  playerId: string, 
  updates: Partial<LobbyPlayer>
) {
  const dbUpdates: any = {}
  
  if (updates.name) dbUpdates.name = updates.name
  if (updates.avatarEmoji) dbUpdates.avatarEmoji = updates.avatarEmoji
  if (updates.isConnected !== undefined) dbUpdates.isConnected = updates.isConnected
  if (updates.aiConfig) {
    dbUpdates.aiPersonality = updates.aiConfig.personality
    dbUpdates.aiDifficulty = updates.aiConfig.difficulty
    dbUpdates.aiThinkingTimeMs = updates.aiConfig.thinkingTimeMs
    dbUpdates.aiMaxActionsPerTurn = updates.aiConfig.maxActionsPerTurn
  }

  await db.update(players)
    .set(dbUpdates)
    .where(eq(players.id, playerId))
}

/**
 * Remove player from database
 */
export async function removeLobbyPlayerFromDB(playerId: string) {
  await db.delete(players)
    .where(eq(players.id, playerId))
}

/**
 * Helper to get lobby host player
 */
function getLobbyHost(lobbyState: LobbyState): LobbyPlayer {
  const host = lobbyState.players.get(lobbyState.hostPlayerId)
  if (!host) {
    throw new Error('Lobby host not found')
  }
  return host
}

/**
 * Convert games record to minimal lobby info for listings
 */
export function gameRecordToLobbyInfo(gameRecord: any) {
  return {
    id: gameRecord.id,
    gameCode: gameRecord.gameCode,
    name: gameRecord.name,
    status: gameRecord.status,
    playerCount: 0, // Will be filled by caller
    maxPlayers: 4, // Default, will be filled from lobby state
    isPublic: gameRecord.isPublic,
    allowObservers: gameRecord.allowObservers,
    createdAt: gameRecord.createdAt,
    updatedAt: gameRecord.updatedAt
  }
} 