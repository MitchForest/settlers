import { supabase } from './supabase'
import { SessionValidation } from './session-types'
import type { GameInfo, AvailableGamesFilters } from './types/lobby-types'

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

// Re-export types for convenience
export type { GameInfo, AvailableGamesFilters } from './types/lobby-types'

export async function testConnection() {
  try {
    const response = await fetch(`${API_URL}/api/test-connection`)
    const data = await response.json()
    return data
  } catch (error) {
    console.error('API connection failed:', error)
    throw error
  }
}

export async function healthCheck() {
  try {
    const response = await fetch(`${API_URL}/health`)
    const data = await response.json()
    return data
  } catch (error) {
    console.error('Health check failed:', error)
    throw error
  }
}

/**
 * Validate session token locally using JWT verification
 */
export async function validatePlayerSession(sessionToken: string): Promise<SessionValidation> {
  try {
    // Import parseSessionToken for local validation
    const { parseSessionToken } = await import('./session-utils')
    
    const { session, error } = parseSessionToken(sessionToken)
    
    if (error || !session) {
      return {
        valid: false,
        reason: error?.message || 'Invalid session token',
        permissions: []
      }
    }
    
    // Check if token is expired
    if (session.expiresAt < Date.now()) {
      return {
        valid: false,
        reason: 'Session expired',
        permissions: []
      }
    }
    
    return {
      valid: true,
      reason: 'Valid session',
      permissions: session.permissions || []
    }
  } catch (error) {
    console.error('Session validation failed:', error)
    return {
      valid: false,
      reason: 'Validation error',
      permissions: []
    }
  }
}

export async function createGame(gameData: {
  hostPlayerName: string
  hostAvatarEmoji: string
  hostUserId?: string | null
  maxPlayers: number
  allowObservers: boolean
  isPublic: boolean
}) {
  try {
    // Get current session for auth token
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.access_token) {
      throw new Error('No authentication token available')
    }
    
    const response = await fetch(`${API_URL}/api/games/create`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify(gameData)
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const data = await response.json()
    return data
  } catch (error) {
    console.error('Create game failed:', error)
    throw error
  }
}

/**
 * Get authentication headers for API requests
 */
async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`
  }
  
  return headers
}

/**
 * Get optional authentication headers for API requests (supports guest users)
 */
async function getOptionalAuthHeaders() {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`
    }
  } catch {
    // Guest users don't have auth, which is fine
  }
  
  return headers
}

// Friends API
export async function getFriends() {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_URL}/api/friends`, {
    headers
  })
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  
  return response.json()
}

export async function getFriendRequests() {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_URL}/api/friends/requests`, {
    headers
  })
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  
  return response.json()
}

export async function searchUsers(query: string, limit = 10) {
  const headers = await getAuthHeaders()
  const params = new URLSearchParams({ query, limit: limit.toString() })
  const response = await fetch(`${API_URL}/api/friends/search?${params}`, {
    method: 'GET',
    headers
  })
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  
  return response.json()
}

export async function sendFriendRequest(toUserId: string, message?: string) {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_URL}/api/friends/send-request`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ toUserId, message })
  })
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  
  return response.json()
}

export async function acceptFriendRequest(requestId: string) {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_URL}/api/friends/accept-request`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ requestId })
  })
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  
  return response.json()
}

export async function rejectFriendRequest(requestId: string) {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_URL}/api/friends/reject-request`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ requestId })
  })
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  
  return response.json()
}

export async function removeFriend(friendshipId: string) {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_URL}/api/friends/remove`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ friendshipId })
  })
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  
  return response.json()
}

// Game Invites API
export async function getGameInvites() {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_URL}/api/invites`, {
    headers
  })
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  
  return response.json()
}

export async function sendGameInvite(gameId: string, toUserId: string, message?: string) {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_URL}/api/invites/send`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ gameId, toUserId, message })
  })
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  
  return response.json()
}

export async function sendGameInvites(gameId: string, friendIds: string[], message?: string) {
  // Send individual invites to each friend
  const invitePromises = friendIds.map(friendId => 
    sendGameInvite(gameId, friendId, message)
  )
  
  const results = await Promise.allSettled(invitePromises)
  
  // Return summary of results
  const successful = results.filter(r => r.status === 'fulfilled').length
  const failed = results.filter(r => r.status === 'rejected').length
  
  return {
    success: failed === 0,
    successful,
    failed,
    total: friendIds.length
  }
}

export async function acceptGameInvite(inviteId: string) {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_URL}/api/invites/${inviteId}/accept`, {
    method: 'POST',
    headers
  })
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  
  return response.json()
}

export async function declineGameInvite(inviteId: string) {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_URL}/api/invites/${inviteId}/decline`, {
    method: 'POST',
    headers
  })
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  
  return response.json()
}

// Presence API
export async function updatePresence(status: string, gameId?: string) {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_URL}/api/presence/update`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ status, gameId })
  })
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  
  return response.json()
}

export async function getFriendsPresence() {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_URL}/api/presence/friends`, {
    headers
  })
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  
  return response.json()
}

// Available Games API

export interface AvailableGamesResponse {
  friendsGames: GameInfo[]
  publicGames: GameInfo[]
  total: number
}

export async function getAvailableGames(filters: AvailableGamesFilters = {}): Promise<AvailableGamesResponse> {
  try {
    const headers = await getOptionalAuthHeaders() // Support both auth and guest users
    
    // Build query string
    const searchParams = new URLSearchParams()
    if (filters.phase) searchParams.append('phase', filters.phase)
    if (filters.minPlayers) searchParams.append('minPlayers', filters.minPlayers.toString())
    if (filters.maxPlayers) searchParams.append('maxPlayers', filters.maxPlayers.toString())
    if (filters.search) searchParams.append('search', filters.search)
    if (filters.limit) searchParams.append('limit', filters.limit.toString())
    if (filters.offset) searchParams.append('offset', filters.offset.toString())
    
    const queryString = searchParams.toString()
    const url = `${API_URL}/api/games/available${queryString ? `?${queryString}` : ''}`
    
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(10000) // 10 second timeout
    })
    
    if (!response.ok) {
      let errorMessage = `Failed to fetch available games (${response.status})`
      
      if (response.status === 401) {
        errorMessage = 'Authentication required'
      } else if (response.status === 403) {
        errorMessage = 'Access denied'
      } else if (response.status === 404) {
        errorMessage = 'Games service not found'
      } else if (response.status >= 500) {
        errorMessage = 'Server error - please try again later'
      }
      
      throw new Error(errorMessage)
    }
    
    const result = await response.json()
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch available games')
    }
    
    return result.data
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Network error - please check your connection')
    }
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new Error('Request timed out - please try again')
    }
    throw error
  }
}

export async function getGameByCode(gameCode: string): Promise<GameInfo> {
  try {
    const headers = await getOptionalAuthHeaders()
    const response = await fetch(`${API_URL}/api/games/code/${gameCode}`, {
      headers,
      signal: AbortSignal.timeout(8000) // 8 second timeout
    })
    
    if (!response.ok) {
      let errorMessage = `Failed to find game (${response.status})`
      
      if (response.status === 404) {
        errorMessage = 'Game not found'
      } else if (response.status === 401) {
        errorMessage = 'Authentication required'
      } else if (response.status === 403) {
        errorMessage = 'Access denied'
      } else if (response.status >= 500) {
        errorMessage = 'Server error - please try again later'
      }
      
      throw new Error(errorMessage)
    }
    
    const result = await response.json()
    if (!result.success) {
      throw new Error(result.error || 'Failed to find game')
    }
    
    return result.data
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Network error - please check your connection')
    }
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new Error('Request timed out - please try again')
    }
    throw error
  }
}