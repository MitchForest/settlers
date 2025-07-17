import { supabase } from './supabase'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

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

export async function createGame(gameData: {
  hostUserId: string
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