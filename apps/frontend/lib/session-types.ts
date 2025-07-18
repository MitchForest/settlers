// JWT Session Types for Robust Game Session Management

export interface GameSessionPayload {
  gameId: string
  playerId: string
  authToken: string // Supabase auth token
  role: 'host' | 'player' | 'observer'
  permissions: SessionPermission[]
  expiresAt: number // Unix timestamp
  issuedAt: number // Unix timestamp
  gameCode?: string // Optional game code for easier debugging
}

export type SessionPermission = 
  | 'start_game'       // Can start the game (host only)
  | 'add_ai_bots'      // Can add AI players
  | 'remove_ai_bots'   // Can remove AI players
  | 'kick_players'     // Can kick other players (host only)
  | 'game_actions'     // Can perform game actions
  | 'observe_only'     // Read-only observer

export interface SessionValidation {
  valid: boolean
  reason?: string
  permissions: SessionPermission[]
  refreshedToken?: string // For automatic token refresh
  gameState?: 'lobby' | 'playing' | 'ended'
  playerData?: {
    id: string
    name: string
    isConnected: boolean
    isHost: boolean
  }
}

export interface SessionError {
  type: 'expired' | 'invalid_signature' | 'game_not_found' | 'player_not_found' | 'permission_denied' | 'malformed_token'
  message: string
  gameId?: string
  playerId?: string
  canRecover: boolean
  suggestedAction?: RecoveryAction
}

export interface RecoveryAction {
  type: 'rejoin_lobby' | 'rejoin_by_code' | 'redirect_home' | 'create_new_game' | 'refresh_session'
  gameCode?: string
  redirectUrl?: string
  message: string
  buttonText: string
}

export interface GameSessionURL {
  path: string // e.g., '/lobby/gameId' or '/game/gameId'
  sessionToken: string // JWT containing all session data
  fullUrl: string // Complete URL with session token
}

// For backward compatibility during migration
export interface LegacySessionData {
  gameId: string
  playerId: string
  isHost: boolean
  gameCode?: string
}

// Session context for React components
export interface SessionContext {
  session: GameSessionPayload | null
  validation: SessionValidation | null
  loading: boolean
  error: SessionError | null
  refreshSession: () => Promise<void>
  clearSession: () => void
  hasPermission: (permission: SessionPermission) => boolean
} 