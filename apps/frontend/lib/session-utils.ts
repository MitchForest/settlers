import { 
  GameSessionPayload, 
  SessionError, 
  GameSessionURL, 
  RecoveryAction,
  SessionPermission 
} from './session-types'

// Simple JWT implementation (for production, consider using a library like jose)
class SimpleJWT {
  private static readonly SECRET = process.env.NEXT_PUBLIC_JWT_SECRET || 'settlers-dev-secret-key'
  
  static sign(payload: GameSessionPayload): string {
    const header = { alg: 'HS256', typ: 'JWT' }
    const encodedHeader = btoa(JSON.stringify(header))
    const encodedPayload = btoa(JSON.stringify(payload))
    
    // Simple HMAC signature (for production, use crypto.subtle or a proper library)
    const signature = btoa(`${encodedHeader}.${encodedPayload}.${this.SECRET}`)
    
    return `${encodedHeader}.${encodedPayload}.${signature}`
  }
  
  static verify(token: string): { valid: boolean; payload?: GameSessionPayload; error?: string } {
    try {
      const [headerB64, payloadB64, signature] = token.split('.')
      if (!headerB64 || !payloadB64 || !signature) {
        return { valid: false, error: 'Invalid token format' }
      }
      
      // Verify signature
      const expectedSignature = btoa(`${headerB64}.${payloadB64}.${this.SECRET}`)
      if (signature !== expectedSignature) {
        return { valid: false, error: 'Invalid signature' }
      }
      
      const payload = JSON.parse(atob(payloadB64))
      
      // Check expiration
      if (payload.expiresAt && Date.now() > payload.expiresAt) {
        return { valid: false, error: 'Token expired' }
      }
      
      return { valid: true, payload }
    } catch {
      return { valid: false, error: 'Malformed token' }
    }
  }
}

/**
 * Generate a signed session JWT token
 */
export function generateSessionToken(
  gameId: string,
  playerId: string,
  authToken: string,
  role: 'host' | 'player' | 'observer',
  gameCode?: string
): string {
  const permissions: SessionPermission[] = role === 'host' 
    ? ['start_game', 'add_ai_bots', 'remove_ai_bots', 'kick_players', 'game_actions']
    : role === 'player'
    ? ['game_actions', 'add_ai_bots']
    : ['observe_only']
  
  const payload: GameSessionPayload = {
    gameId,
    playerId,
    authToken,
    role,
    permissions,
    expiresAt: Date.now() + (4 * 60 * 60 * 1000), // 4 hours
    issuedAt: Date.now(),
    gameCode
  }
  
  return SimpleJWT.sign(payload)
}

/**
 * Parse and validate a session token
 */
export function parseSessionToken(token: string): { session: GameSessionPayload | null; error: SessionError | null } {
  const result = SimpleJWT.verify(token)
  
  if (!result.valid) {
    const errorType = result.error === 'Token expired' ? 'expired' 
                    : result.error === 'Invalid signature' ? 'invalid_signature'
                    : 'malformed_token'
    
    return {
      session: null,
      error: {
        type: errorType,
        message: result.error || 'Invalid token',
        canRecover: errorType === 'expired',
        suggestedAction: errorType === 'expired' 
          ? { type: 'refresh_session', message: 'Your session has expired', buttonText: 'Refresh Session' }
          : { type: 'redirect_home', message: 'Invalid session', buttonText: 'Go Home' }
      }
    }
  }
  
  return { session: result.payload as GameSessionPayload, error: null }
}

/**
 * Build a complete game URL with session token
 */
export function buildGameURL(
  path: 'lobby' | 'game',
  gameId: string,
  sessionToken: string,
  baseUrl?: string
): GameSessionURL {
  const base = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '')
  const urlPath = `/${path}/${gameId}`
  const fullUrl = `${base}${urlPath}?s=${encodeURIComponent(sessionToken)}`
  
  return {
    path: urlPath,
    sessionToken,
    fullUrl
  }
}

/**
 * Extract session token from current URL
 */
export function extractSessionFromURL(): { token: string | null; session: GameSessionPayload | null; error: SessionError | null } {
  if (typeof window === 'undefined') {
    return { token: null, session: null, error: null }
  }
  
  const urlParams = new URLSearchParams(window.location.search)
  const token = urlParams.get('s')
  
  if (!token) {
    return { 
      token: null, 
      session: null, 
      error: {
        type: 'malformed_token',
        message: 'No session token in URL',
        canRecover: true,
        suggestedAction: { 
          type: 'redirect_home', 
          message: 'No valid session found', 
          buttonText: 'Go Home' 
        }
      }
    }
  }
  
  const { session, error } = parseSessionToken(token)
  return { token, session, error }
}

/**
 * Check if session has specific permission
 */
export function hasPermission(session: GameSessionPayload | null, permission: SessionPermission): boolean {
  return session?.permissions.includes(permission) ?? false
}

/**
 * Refresh session token with new auth token
 */
export function refreshSessionToken(
  currentSession: GameSessionPayload,
  newAuthToken: string
): string {
  const refreshedSession: GameSessionPayload = {
    ...currentSession,
    authToken: newAuthToken,
    expiresAt: Date.now() + (4 * 60 * 60 * 1000), // Extend expiration
    issuedAt: Date.now()
  }
  
  return SimpleJWT.sign(refreshedSession)
}

/**
 * Analyze session error and suggest recovery action
 */
export function analyzeSessionError(error: SessionError, _gameId?: string): RecoveryAction {
  switch (error.type) {
    case 'expired':
      return {
        type: 'refresh_session',
        message: 'Your session has expired. Would you like to refresh it?',
        buttonText: 'Refresh Session'
      }
    
    case 'game_not_found':
      return {
        type: 'redirect_home',
        message: 'This game no longer exists.',
        buttonText: 'Go Home'
      }
    
    case 'player_not_found':
      return {
        type: 'rejoin_by_code',
        message: 'You are no longer in this game. You can try rejoining with the game code.',
        buttonText: 'Rejoin Game'
      }
    
    case 'permission_denied':
      return {
        type: 'rejoin_lobby',
        message: 'You don\'t have permission for this action.',
        buttonText: 'Return to Lobby'
      }
    
    default:
      return {
        type: 'redirect_home',
        message: 'Something went wrong with your session.',
        buttonText: 'Go Home'
      }
  }
}

/**
 * Clean session parameter from URL without page reload
 */
export function cleanSessionFromURL(): void {
  if (typeof window === 'undefined') return
  
  const url = new URL(window.location.href)
  url.searchParams.delete('s')
  
  // Update URL without reload
  window.history.replaceState({}, '', url.toString())
}

/**
 * Validate session format without verification (for quick checks)
 */
export function isValidSessionFormat(token: string): boolean {
  const parts = token.split('.')
  return parts.length === 3 && parts.every(part => part.length > 0)
} 