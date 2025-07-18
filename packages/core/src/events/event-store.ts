// Core event interface - matches database segregated architecture
export interface GameEvent {
  id: string
  gameId: string
  playerId?: string  // Always populated for player events, optional for game events
  contextPlayerId?: string  // Only for game events - the player who triggered the event
  eventType: EventType
  data: Record<string, any>
  sequenceNumber: number
  timestamp: Date
  eventTable: 'player_events' | 'game_events'  // Track which table this came from
}

// Event type mappings for segregated architecture
export const PLAYER_EVENT_TYPES = ['player_joined', 'player_left', 'ai_player_added', 'ai_player_removed'] as const
export const GAME_EVENT_TYPES = [
  'game_started', 'settings_changed', 'dice_rolled', 'resource_produced', 
  'building_placed', 'road_placed', 'card_drawn', 'card_played', 
  'trade_proposed', 'trade_accepted', 'trade_declined', 'robber_moved', 
  'resources_stolen', 'turn_ended', 'game_ended'
] as const

export type PlayerEventType = typeof PLAYER_EVENT_TYPES[number]
export type GameEventType = typeof GAME_EVENT_TYPES[number]

// Event types enum - segregated for better domain separation
export type EventType = PlayerEventType | GameEventType

export function isPlayerEvent(eventType: EventType): eventType is PlayerEventType {
  return PLAYER_EVENT_TYPES.includes(eventType as PlayerEventType)
}

export function isGameEvent(eventType: EventType): eventType is GameEventType {
  return GAME_EVENT_TYPES.includes(eventType as GameEventType)
}

export interface EventStream {
  gameId: string
  events: GameEvent[]
  currentSequence: number
}

// Event sourcing projections
export interface LobbyState {
  gameId: string
  gameCode: string
  phase: 'lobby' | 'initial_placement' | 'main_game' | 'ended'
  players: Map<string, LobbyPlayer>
  settings: GameSettings
  isStarted: boolean
  createdAt: Date
  updatedAt: Date
}

export interface LobbyPlayer {
  id: string
  userId?: string // null for AI players
  playerType: 'human' | 'ai'
  name: string
  avatarEmoji?: string
  color: string
  joinOrder: number
  isHost: boolean
  isConnected: boolean
  aiSettings?: AISettings
}

export interface GameSettings {
  maxPlayers: number
  allowObservers: boolean
  aiEnabled: boolean
  customRules?: Record<string, any>
}

export interface AISettings {
  difficulty: 'easy' | 'medium' | 'hard'
  personality: 'aggressive' | 'balanced' | 'defensive' | 'economic'
  autoPlay: boolean
  thinkingTimeMs: number
}

// Event data interfaces for type safety
export interface PlayerJoinedData {
  playerId: string
  userId?: string
  playerType: 'human' | 'ai'
  name: string
  avatarEmoji?: string
  color: string
  joinOrder: number
  isHost: boolean
  aiSettings?: AISettings
}

export interface PlayerLeftData {
  playerId: string
  reason: 'voluntary' | 'disconnected' | 'kicked'
}

export interface AIPlayerAddedData {
  playerId: string
  name: string
  color: string
  aiSettings: AISettings
  joinOrder: number
}

export interface GameStartedData {
  startedAt: Date
  playerOrder: string[]
  initialBoardState: any // Will be defined by game engine
}

export interface SettingsChangedData {
  changes: Partial<GameSettings>
  changedBy: string
}

// Event validation
export function validateEventData(eventType: string, data: any): boolean {
  switch (eventType) {
    case 'player_joined':
      return validatePlayerJoinedData(data)
    case 'player_left':
      return validatePlayerLeftData(data)
    case 'ai_player_added':
      return validateAIPlayerAddedData(data)
    case 'game_started':
      return validateGameStartedData(data)
    case 'settings_changed':
      return validateSettingsChangedData(data)
    default:
      return true // Other events validated elsewhere
  }
}

function validatePlayerJoinedData(data: any): data is PlayerJoinedData {
  return (
    typeof data.playerId === 'string' &&
    ['human', 'ai'].includes(data.playerType) &&
    typeof data.name === 'string' &&
    typeof data.color === 'string' &&
    typeof data.joinOrder === 'number' &&
    typeof data.isHost === 'boolean'
  )
}

function validatePlayerLeftData(data: any): data is PlayerLeftData {
  return (
    typeof data.playerId === 'string' &&
    ['voluntary', 'disconnected', 'kicked'].includes(data.reason)
  )
}

function validateAIPlayerAddedData(data: any): data is AIPlayerAddedData {
  return (
    typeof data.playerId === 'string' &&
    typeof data.name === 'string' &&
    typeof data.color === 'string' &&
    typeof data.joinOrder === 'number' &&
    data.aiSettings &&
    typeof data.aiSettings === 'object'
  )
}

function validateGameStartedData(data: any): data is GameStartedData {
  return (
    data.startedAt instanceof Date &&
    Array.isArray(data.playerOrder) &&
    data.playerOrder.every((id: any) => typeof id === 'string')
  )
}

function validateSettingsChangedData(data: any): data is SettingsChangedData {
  return (
    typeof data.changes === 'object' &&
    typeof data.changedBy === 'string'
  )
}

// Utility functions
export function createEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export function createPlayerId(): string {
  return `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
} 