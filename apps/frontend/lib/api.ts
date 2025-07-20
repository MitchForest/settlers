/**
 * UNIFIED API MODULE - ZERO TECHNICAL DEBT
 * 
 * This module provides a bridge between the component layer and the unified WebSocket system.
 * All legacy REST endpoints have been replaced with unified WebSocket communication.
 */

import { supabase } from './supabase'
import type { GameInfo, AvailableGamesFilters } from './types/lobby-types'

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

// Re-export types for convenience
export type { GameInfo, AvailableGamesFilters } from './types/lobby-types'

/**
 * UNIFIED CONNECTION & HEALTH CHECKS
 */
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
 * UNIFIED GAME CREATION
 * Uses the unified /api/unified/games endpoint
 */
export async function createGame(gameData: {
  hostPlayerName: string
  hostAvatarEmoji: string
  hostUserId?: string | null
  maxPlayers: number
  allowObservers: boolean
  isPublic: boolean
}) {
  try {
    const headers = await getOptionalAuthHeaders()
    
    const response = await fetch(`${API_URL}/api/unified/games`, {
      method: 'POST',
      headers,
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
 * AUTHENTICATION HELPERS
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

/**
 * UNIFIED WEBSOCKET SOCIAL FEATURES
 * All social features use the unified WebSocket messaging system
 */

import { wsManager } from './websocket-connection-manager'

// Get or create the unified WebSocket connection
async function ensureWebSocketConnection() {
  const token = await getAuthToken()
  if (!token) {
    throw new Error('Authentication required for social features')
  }
  
  // Connect to the unified WebSocket server
  const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000/ws'}?token=${encodeURIComponent(token)}&type=social`
  
  return wsManager.getOrCreateConnection(
    wsUrl,
    token,
    undefined,
    'social'
  )
}

async function getAuthToken(): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  } catch (error) {
    console.error('Failed to get auth token:', error)
    return null
  }
}

// Send WebSocket message and wait for response
async function sendUnifiedMessage(type: string, data: any, timeoutMs: number = 10000): Promise<any> {
  const connection = await ensureWebSocketConnection()
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`${type} request timed out`))
    }, timeoutMs)
    
    const messageId = `${type.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const message = {
      type,
      messageId,
      data,
      timestamp: new Date().toISOString()
    }
    
    // Set up response listener
    const responseHandler = (event: MessageEvent) => {
      try {
        const response = JSON.parse(event.data)
        
        if (response.messageId === messageId) {
          clearTimeout(timeout)
          wsManager.removeListener(connection, { onMessage: responseHandler })
          
          if (response.success !== false) {
            resolve(response)
          } else {
            reject(new Error(response.error || `${type} failed`))
          }
        }
      } catch (error) {
        console.error('Failed to parse WebSocket response:', error)
      }
    }
    
    // Add listener and send message
    wsManager.addMessageListener(connection, { onMessage: responseHandler })
    
    // Ensure connection is established then send
    wsManager.connect(connection).then(() => {
      return wsManager.send(connection, message)
    }).then(success => {
      if (!success) {
        clearTimeout(timeout)
        wsManager.removeListener(connection, { onMessage: responseHandler })
        reject(new Error(`Failed to send ${type} message`))
      }
    }).catch(error => {
      clearTimeout(timeout)
      wsManager.removeListener(connection, { onMessage: responseHandler })
      reject(error)
    })
  })
}

/**
 * FRIENDS MANAGEMENT - UNIFIED WEBSOCKET
 */
export async function getFriends(): Promise<any> {
  return sendUnifiedMessage('GET_FRIENDS', {})
}

export async function getFriendRequests(): Promise<any> {
  return sendUnifiedMessage('GET_FRIEND_REQUESTS', {})
}

export async function searchUsers(query: string, limit = 10): Promise<any> {
  return sendUnifiedMessage('SEARCH_USERS', { query, limit })
}

export async function sendFriendRequest(toUserId: string, message?: string): Promise<any> {
  return sendUnifiedMessage('SEND_FRIEND_REQUEST', { toUserId, message })
}

export async function acceptFriendRequest(requestId: string): Promise<any> {
  return sendUnifiedMessage('ACCEPT_FRIEND_REQUEST', { requestId })
}

export async function rejectFriendRequest(requestId: string): Promise<any> {
  return sendUnifiedMessage('REJECT_FRIEND_REQUEST', { requestId })
}

export async function removeFriend(friendshipId: string): Promise<any> {
  return sendUnifiedMessage('REMOVE_FRIEND', { friendshipId })
}

/**
 * GAME INVITES - UNIFIED WEBSOCKET
 */
export async function getGameInvites(): Promise<any> {
  return sendUnifiedMessage('GET_GAME_INVITES', {})
}

export async function sendGameInvite(gameId: string, toUserId: string, message?: string): Promise<any> {
  return sendUnifiedMessage('SEND_GAME_INVITE', { gameId, toUserId, message })
}

export async function sendGameInvites(gameId: string, friendIds: string[], message?: string): Promise<any> {
  // Send individual invites to each friend through WebSocket
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

export async function acceptGameInvite(inviteId: string): Promise<any> {
  return sendUnifiedMessage('ACCEPT_GAME_INVITE', { inviteId })
}

export async function declineGameInvite(inviteId: string): Promise<any> {
  return sendUnifiedMessage('DECLINE_GAME_INVITE', { inviteId })
}

/**
 * PRESENCE MANAGEMENT - WEBSOCKET BRIDGE
 */
export async function updatePresence(status: string, gameId?: string): Promise<any> {
  return sendUnifiedMessage('UPDATE_PRESENCE', { status, gameId })
}

export async function getFriendsPresence(): Promise<any> {
  return sendUnifiedMessage('GET_FRIENDS_PRESENCE', {})
}

/**
 * GAME DISCOVERY - WEBSOCKET BRIDGE
 */
export interface AvailableGamesResponse {
  friendsGames: GameInfo[]
  publicGames: GameInfo[]
  total: number
}

export async function getAvailableGames(filters: AvailableGamesFilters = {}): Promise<AvailableGamesResponse> {
  const response = await sendUnifiedMessage('GET_AVAILABLE_GAMES', { filters })
  return {
    friendsGames: response.data?.friendsGames || [],
    publicGames: response.data?.publicGames || [],
    total: response.data?.total || 0
  }
}

export async function getGameByCode(gameCode: string): Promise<GameInfo> {
  const response = await sendUnifiedMessage('GET_GAME_BY_CODE', { gameCode })
  if (response.data?.game) {
    return response.data.game
  }
  throw new Error('Game not found')
}