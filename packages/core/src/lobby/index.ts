// ============= Lobby System Exports =============
// Central export point for all lobby-related functionality

export * from '../lobby-types'
export * from './lobby-manager'
// Note: lobby-serializer moved to apps/backend/src/infrastructure/persistence/

// Re-export commonly used types for convenience
export type {
  LobbyState,
  LobbyPlayer,
  LobbySettings,
  LobbyAIConfig,
  LobbyEvent,
  LobbyValidation,
  LobbyOperationResult,
  SerializedLobbyState
} from '../lobby-types'

export { LobbyManager } from './lobby-manager'
// Note: serialization functions moved to apps/backend/src/infrastructure/persistence/ 