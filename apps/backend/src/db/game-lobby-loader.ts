// ============= Unified Game/Lobby State Loader =============
// Handles loading both lobby and game states from the new database schema

import { 
  LobbyState, 
  GameState,
  loadLobbyFromDB,
  LobbyPlayer
} from '@settlers/core'
import { loadGameStateFromDB } from './game-state-serializer'
import { games, players, db } from './index'
import { eq } from 'drizzle-orm'

export type LoadedState = 
  | { type: 'lobby'; state: LobbyState }
  | { type: 'game'; state: GameState }

/**
 * Load lobby state with current players from database
 * This ensures AI bots and other players added after lobby creation are included
 */
async function loadLobbyStateWithPlayers(gameRecord: any): Promise<LobbyState> {
  // Start with the base lobby state from JSON
  const baseLobbyState = loadLobbyFromDB(gameRecord)
  
  // Load current players from database
  const currentPlayers = await db
    .select()
    .from(players)
    .where(eq(players.gameId, gameRecord.id))
  
  // Convert database players to LobbyPlayer format
  const lobbyPlayers = new Map<string, LobbyPlayer>()
  
  for (const dbPlayer of currentPlayers) {
    const lobbyPlayer: LobbyPlayer = {
      id: dbPlayer.id,
      name: dbPlayer.name,
      userId: dbPlayer.userId || undefined,
      avatarEmoji: dbPlayer.avatarEmoji || '👤',
      isHost: dbPlayer.isHost,
      isAI: dbPlayer.isAI,
      isConnected: dbPlayer.isConnected,
      joinedAt: dbPlayer.joinedAt,
      aiConfig: dbPlayer.isAI ? {
        difficulty: dbPlayer.aiDifficulty as any || 'medium',
        personality: dbPlayer.aiPersonality as any || 'balanced',
        thinkingTimeMs: dbPlayer.aiThinkingTimeMs || 1000,
        maxActionsPerTurn: dbPlayer.aiMaxActionsPerTurn || 10
      } : undefined
    }
    lobbyPlayers.set(dbPlayer.id, lobbyPlayer)
  }
  
  // Update the lobby state with current players
  return {
    ...baseLobbyState,
    players: lobbyPlayers
  }
}

/**
 * Unified loader that determines whether to load lobby or game state
 * based on the game status and available data
 */
export async function loadGameOrLobbyState(gameId: string): Promise<LoadedState> {
  const gameRecord = await db
    .select()
    .from(games)
    .where(eq(games.id, gameId))
    .limit(1)

  if (gameRecord.length === 0) {
    throw new Error('Game not found')
  }

  const game = gameRecord[0]

  // Determine state type based on status and available data
  if (game.status === 'lobby') {
    if (!game.lobbyState) {
      throw new Error('Lobby state not found for lobby game')
    }
    const lobbyState = await loadLobbyStateWithPlayers(game)
    return { type: 'lobby', state: lobbyState }
  }
  
  if (game.status === 'playing' || game.status === 'ended') {
    if (!game.gameState) {
      throw new Error('Game state not found for active game')
    }
    
    // For game states, we need to construct the proper format for loadGameStateFromDB
    const gameStateRecord = {
      id: game.id,
      phase: game.phase,
      turn: game.turn || 0,
      currentPlayer: game.currentPlayer || '',
      winner: game.winner,
      startedAt: game.startedAt,
      updatedAt: game.updatedAt,
      gameState: game.gameState
    }
    
    const gameState = await loadGameStateFromDB(gameStateRecord)
    return { type: 'game', state: gameState }
  }
  
  throw new Error(`Unknown game status: ${game.status}`)
}

/**
 * Load lobby state specifically (throws if not a lobby)
 */
export async function loadLobbyState(gameId: string): Promise<LobbyState> {
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
    throw new Error(`Game ${gameId} is not a lobby (status: ${game.status})`)
  }

  return await loadLobbyStateWithPlayers(game)
}

/**
 * Load game state specifically (throws if not a game)
 */
export async function loadGameState(gameId: string): Promise<GameState> {
  const loaded = await loadGameOrLobbyState(gameId)
  if (loaded.type !== 'game') {
    throw new Error(`Game ${gameId} is not an active game (status: ${loaded.type})`)
  }
  return loaded.state
}

/**
 * Check if a game exists and return its status
 */
export async function getGameStatus(gameId: string): Promise<{ exists: boolean; status?: string; type?: 'lobby' | 'game' }> {
  try {
    const loaded = await loadGameOrLobbyState(gameId)
    return { exists: true, status: loaded.type === 'lobby' ? 'lobby' : 'playing', type: loaded.type }
  } catch (error) {
    return { exists: false }
  }
} 