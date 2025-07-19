// ============= Lobby System Types =============
// Separate from game types to maintain clear separation of concerns

import { PlayerId, GameState } from '../types'

// AI configuration for lobby players
export interface LobbyAIConfig {
  difficulty: 'easy' | 'medium' | 'hard'
  personality: 'balanced' | 'aggressive' | 'defensive' | 'economic'
  thinkingTimeMs?: number
  maxActionsPerTurn?: number
}

// Lobby player - simpler than game Player, focused on pre-game state
export interface LobbyPlayer {
  id: PlayerId
  name: string
  userId?: string // null for AI players
  avatarEmoji: string
  isHost: boolean
  isAI: boolean
  aiConfig?: LobbyAIConfig
  isConnected: boolean
  joinedAt: Date
}

// Lobby-specific settings
export interface LobbySettings {
  maxPlayers: number // 3-4
  allowObservers: boolean
  isPublic: boolean
  gameSettings: {
    victoryPoints: number
    boardLayout: 'standard' | 'random'
    randomizePlayerOrder: boolean
    turnTimerSeconds: number
  }
}

// Main lobby state
export interface LobbyState {
  id: string
  gameCode: string
  hostPlayerId: PlayerId
  players: Map<PlayerId, LobbyPlayer>
  settings: LobbySettings
  status: 'waiting' | 'ready' | 'starting'
  createdAt: Date
  updatedAt: Date
}

// Lobby validation results
export interface LobbyValidation {
  isValid: boolean
  canStart: boolean
  errors: string[]
  warnings: string[]
}

// Lobby events for WebSocket communication
export type LobbyEvent = 
  | { type: 'playerJoined'; player: LobbyPlayer }
  | { type: 'playerLeft'; playerId: PlayerId }
  | { type: 'playerUpdated'; playerId: PlayerId; updates: Partial<LobbyPlayer> }
  | { type: 'aiBotAdded'; player: LobbyPlayer }
  | { type: 'aiBotRemoved'; playerId: PlayerId }
  | { type: 'settingsUpdated'; settings: Partial<LobbySettings> }
  | { type: 'statusChanged'; status: LobbyState['status'] }
  | { type: 'gameStarting'; gameId: string }
  | { type: 'lobbyError'; error: string }

// Operation results
export interface LobbyOperationResult {
  success: boolean
  error?: string
  data?: any
}

// Serialized lobby state for database storage
export interface SerializedLobbyState {
  id: string
  gameCode: string
  hostPlayerId: PlayerId
  players: Record<PlayerId, LobbyPlayer> // Map → Record for JSON
  settings: LobbySettings
  status: LobbyState['status']
  createdAt: string // Date → ISO string
  updatedAt: string // Date → ISO string
} 