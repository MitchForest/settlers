import { supabase } from './supabase'
import { SessionValidation } from './session-types'

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export async function testConnection() {
  try {
    const response = await fetch(`${API_URL}/api/test`)
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
 * Validate session token with backend
 */
export async function validatePlayerSession(sessionToken: string): Promise<SessionValidation> {
  try {
    const response = await fetch(`${API_URL}/api/session/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sessionToken })
    })
    
    const data = await response.json()
    
    if (!response.ok) {
      return {
        valid: false,
        reason: data.error || 'Validation failed',
        permissions: []
      }
    }
    
    return data
  } catch (error) {
    console.error('Session validation failed:', error)
    return {
      valid: false,
      reason: 'Network error during validation',
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
    
    const response = await fetch(`${API_URL}/api/games`, {
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
  const response = await fetch(`${API_URL}/api/friends/search`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, limit })
  })
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  
  return response.json()
}

export async function sendFriendRequest(toUserId: string, message?: string) {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_URL}/api/friends/request`, {
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
  const response = await fetch(`${API_URL}/api/friends/request/${requestId}/accept`, {
    method: 'POST',
    headers
  })
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  
  return response.json()
}

export async function rejectFriendRequest(requestId: string) {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_URL}/api/friends/request/${requestId}/reject`, {
    method: 'POST',
    headers
  })
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  
  return response.json()
}

export async function removeFriend(friendshipId: string) {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_URL}/api/friends/${friendshipId}`, {
    method: 'DELETE',
    headers
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

export async function sendGameInvites(gameId: string, friendIds: string[], message?: string) {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_URL}/api/invites`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ gameId, friendIds, message })
  })
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  
  return response.json()
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