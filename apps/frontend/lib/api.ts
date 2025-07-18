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