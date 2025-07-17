// ============= Lobby Serialization =============
// Handles serialization/deserialization of lobby state for database storage

import { 
  LobbyState, 
  LobbyPlayer, 
  SerializedLobbyState 
} from '../lobby-types'
import { PlayerId } from '../types'

/**
 * Serializes a LobbyState for database storage
 * Converts Maps to Records and Dates to ISO strings
 */
export function serializeLobbyState(lobbyState: LobbyState): SerializedLobbyState {
  // Convert Map<PlayerId, LobbyPlayer> to Record<PlayerId, LobbyPlayer>
  const playersRecord: Record<PlayerId, LobbyPlayer> = {}
  for (const [playerId, player] of lobbyState.players) {
    playersRecord[playerId] = player
  }

  return {
    id: lobbyState.id,
    gameCode: lobbyState.gameCode,
    hostPlayerId: lobbyState.hostPlayerId,
    players: playersRecord,
    settings: lobbyState.settings,
    status: lobbyState.status,
    createdAt: lobbyState.createdAt.toISOString(),
    updatedAt: lobbyState.updatedAt.toISOString()
  }
}

/**
 * Deserializes a LobbyState from database storage
 * Converts Records to Maps and ISO strings to Dates
 */
export function deserializeLobbyState(serialized: SerializedLobbyState): LobbyState {
  // Convert Record<PlayerId, LobbyPlayer> to Map<PlayerId, LobbyPlayer>
  const playersMap = new Map<PlayerId, LobbyPlayer>()
  for (const [playerId, player] of Object.entries(serialized.players)) {
    playersMap.set(playerId as PlayerId, player)
  }

  return {
    id: serialized.id,
    gameCode: serialized.gameCode,
    hostPlayerId: serialized.hostPlayerId,
    players: playersMap,
    settings: serialized.settings,
    status: serialized.status,
    createdAt: new Date(serialized.createdAt),
    updatedAt: new Date(serialized.updatedAt)
  }
}

/**
 * Type-safe database lobby state preparation
 * Returns flattened structure for database insertion
 */
export function prepareLobbyForDB(lobbyState: LobbyState) {
  return {
    id: lobbyState.id,
    gameCode: lobbyState.gameCode,
    hostPlayerId: lobbyState.hostPlayerId,
    status: 'lobby' as const,
    lobbyState: serializeLobbyState(lobbyState),
    createdAt: lobbyState.createdAt,
    updatedAt: lobbyState.updatedAt
  }
}

/**
 * Type-safe database lobby state retrieval
 * Reconstructs LobbyState from database record
 */
export function loadLobbyFromDB(gameRecord: {
  id: string
  gameCode: string | null
  hostPlayerId: string | null
  status: string
  lobbyState: any
  createdAt: Date
  updatedAt: Date
}): LobbyState {
  if (!gameRecord.lobbyState) {
    throw new Error('No lobby state found in database record')
  }

  if (gameRecord.status !== 'lobby') {
    throw new Error(`Expected lobby status, got: ${gameRecord.status}`)
  }

  const serializedLobby = gameRecord.lobbyState as SerializedLobbyState
  return deserializeLobbyState(serializedLobby)
} 