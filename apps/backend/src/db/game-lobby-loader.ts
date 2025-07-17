// ============= Unified Game/Lobby State Loader =============
// Handles loading both lobby and game states from the new database schema

import { 
  LobbyState, 
  GameState,
  loadLobbyFromDB
} from '@settlers/core'
import { loadGameStateFromDB } from './game-state-serializer'
import { games, db } from './index'
import { eq } from 'drizzle-orm'

export type LoadedState = 
  | { type: 'lobby'; state: LobbyState }
  | { type: 'game'; state: GameState }

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
    const lobbyState = loadLobbyFromDB(game)
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
  const loaded = await loadGameOrLobbyState(gameId)
  if (loaded.type !== 'lobby') {
    throw new Error(`Game ${gameId} is not a lobby (status: ${loaded.type})`)
  }
  return loaded.state
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