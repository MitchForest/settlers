// Lightweight types for homepage and lobby - no game-engine dependencies
// These will be used until the game engine is dynamically loaded

export type PlayerId = string

export interface LobbyPlayer {
  id: PlayerId
  name: string
  avatarEmoji: string
  isHost: boolean
  isReady: boolean
  isAI: boolean
  aiDifficulty?: 'easy' | 'medium' | 'hard'
  aiPersonality?: 'aggressive' | 'balanced' | 'defensive' | 'economic'
  aiConfig?: AIBotConfig
  userId?: string | null
}

export interface GameInfo {
  id: string
  gameCode: string
  hostUserId?: string
  hostPlayerName: string
  hostAvatarEmoji: string
  playerCount: number
  maxPlayers: number
  isPublic: boolean
  createdAt: string
  phase: 'lobby' | 'initial_placement' | 'main_game' | 'ended'
  hostFriend?: {
    id: string
    name: string
    email: string
    avatarEmoji: string | null
  }
}

export interface AvailableGamesFilters {
  status?: 'waiting' | 'playing'
  phase?: 'lobby' | 'initial_placement' | 'main_game'
  minPlayers?: number
  maxPlayers?: number
  isPublic?: boolean
  hostFriend?: boolean
  search?: string
  limit?: number
  offset?: number
}

// Lightweight game action type for early loading
export interface LightGameAction {
  type: string
  playerId: PlayerId
  data?: unknown
}

// Connection status types
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error' | 'offline'

// Lobby state types
export type LobbyState = 'idle' | 'creating' | 'joining' | 'waiting' | 'starting'

// AI Bot configuration
export interface AIBotConfig {
  difficulty: 'easy' | 'medium' | 'hard'
  personality: 'aggressive' | 'balanced' | 'defensive' | 'economic'
} 