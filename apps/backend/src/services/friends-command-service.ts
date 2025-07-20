// Unified event system - ZERO TECHNICAL DEBT
import { unifiedGameManager } from '../unified/core/unified-event-store'
import { webSocketServer } from '../websocket/server'
import { supabaseAdmin } from '../auth/supabase'

// **FRIENDS DOMAIN TYPES**

interface FriendsState {
  userId: string
  friends: Map<string, Friend>
  incomingRequests: Map<string, FriendRequest>
  outgoingRequests: Map<string, FriendRequest>
  presence: Map<string, UserPresence>
  lastUpdated: Date
}

interface Friend {
  id: string
  userId: string
  name: string
  email: string
  avatarEmoji: string | null
  friendshipId: string
  createdAt: Date
  lastInteractionAt: Date
  presence: UserPresence
}

interface FriendRequest {
  id: string
  fromUserId: string
  toUserId: string
  fromUser: UserBasicInfo
  toUser: UserBasicInfo
  message: string | null
  createdAt: Date
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled'
}

interface UserPresence {
  status: 'online' | 'away' | 'busy' | 'offline'
  lastSeenAt: Date
  currentGameId: string | null
}

interface UserBasicInfo {
  id: string
  name: string
  email: string
  avatarEmoji: string | null
}

interface UserSearchResult {
  id: string
  name: string
  email: string
  avatarEmoji: string | null
  friendshipStatus: 'none' | 'pending_sent' | 'pending_received' | 'friends'
}

// **COMMAND INTERFACES**

export interface SendFriendRequestCommand {
  fromUserId: string
  toUserId: string
  message?: string
}

export interface AcceptFriendRequestCommand {
  requestId: string
  acceptingUserId: string
}

export interface RejectFriendRequestCommand {
  requestId: string
  rejectingUserId: string
}

export interface CancelFriendRequestCommand {
  requestId: string
  cancellingUserId: string
}

export interface RemoveFriendCommand {
  friendshipId: string
  removingUserId: string
}

export interface UpdatePresenceCommand {
  userId: string
  status: 'online' | 'away' | 'busy' | 'offline'
  gameId?: string
}

interface CommandResult {
  success: boolean
  events: any[]
  state?: FriendsState
  error?: string
  data?: any
}

// **FRIENDS PROJECTOR** - Rebuilds state from events (NO DATABASE QUERIES)
class FriendsProjector {
  static projectFriendsState(
    userId: string,
    events: any[]
  ): FriendsState {
    let state: FriendsState = {
      userId,
      friends: new Map(),
      incomingRequests: new Map(),
      outgoingRequests: new Map(),
      presence: new Map(),
      lastUpdated: new Date()
    }

    // Apply events in sequence order
    const sortedEvents = [...events].sort((a, b) => (a.sequenceNumber || 0) - (b.sequenceNumber || 0))
    
    for (const event of sortedEvents) {
      state = this.applyEvent(state, event)
    }

    return state
  }

  static applyEvent(state: FriendsState, event: any): FriendsState {
    const newState = { ...state, lastUpdated: new Date(event.timestamp || Date.now()) }

    switch (event.eventType || event.type) {
      case 'friend_request_sent':
        return this.applyFriendRequestSent(newState, event.data)
      
      case 'friend_request_accepted':
        return this.applyFriendRequestAccepted(newState, event.data)
      
      case 'friend_request_rejected':
        return this.applyFriendRequestRejected(newState, event.data)
      
      case 'friend_request_cancelled':
        return this.applyFriendRequestCancelled(newState, event.data)
      
      case 'friend_removed':
        return this.applyFriendRemoved(newState, event.data)
      
      case 'presence_updated':
        return this.applyPresenceUpdated(newState, event.data)
      
      default:
        console.warn(`Unknown friend event type: ${(event as any).eventType}`)
        return newState
    }
  }

  private static applyFriendRequestSent(state: FriendsState, data: any): FriendsState {
    const newState = { ...state }
    
    const request: FriendRequest = {
      id: data.requestId,
      fromUserId: data.fromUserId,
      toUserId: data.toUserId,
      fromUser: data.fromUser,
      toUser: data.toUser,
      message: data.message || null,
      createdAt: new Date(data.timestamp),
      status: 'pending'
    }

    // Add to outgoing requests if this user sent it
    if (data.fromUserId === state.userId) {
      newState.outgoingRequests = new Map(newState.outgoingRequests)
      newState.outgoingRequests.set(request.id, request)
    }
    
    // Add to incoming requests if this user received it
    if (data.toUserId === state.userId) {
      newState.incomingRequests = new Map(newState.incomingRequests)
      newState.incomingRequests.set(request.id, request)
    }

    return newState
  }

  private static applyFriendRequestAccepted(state: FriendsState, data: any): FriendsState {
    const newState = { ...state }
    
    // Remove from requests
    if (newState.incomingRequests.has(data.requestId)) {
      newState.incomingRequests = new Map(newState.incomingRequests)
      newState.incomingRequests.delete(data.requestId)
    }
    
    if (newState.outgoingRequests.has(data.requestId)) {
      newState.outgoingRequests = new Map(newState.outgoingRequests)
      newState.outgoingRequests.delete(data.requestId)
    }
    
    // Add to friends
    const friendUserId = data.fromUserId === state.userId ? data.toUserId : data.fromUserId
    const friendUser = data.fromUserId === state.userId ? data.toUser : data.fromUser
    
    const friend: Friend = {
      id: friendUserId,
      userId: friendUserId,
      name: friendUser.name,
      email: friendUser.email,
      avatarEmoji: friendUser.avatarEmoji,
      friendshipId: data.friendshipId,
      createdAt: new Date(data.timestamp),
      lastInteractionAt: new Date(data.timestamp),
      presence: {
        status: 'offline',
        lastSeenAt: new Date(data.timestamp),
        currentGameId: null
      }
    }
    
    newState.friends = new Map(newState.friends)
    newState.friends.set(friendUserId, friend)

    return newState
  }

  private static applyFriendRequestRejected(state: FriendsState, data: any): FriendsState {
    const newState = { ...state }
    
    // Remove from requests
    if (newState.incomingRequests.has(data.requestId)) {
      newState.incomingRequests = new Map(newState.incomingRequests)
      newState.incomingRequests.delete(data.requestId)
    }
    
    if (newState.outgoingRequests.has(data.requestId)) {
      newState.outgoingRequests = new Map(newState.outgoingRequests)
      newState.outgoingRequests.delete(data.requestId)
    }

    return newState
  }

  private static applyFriendRequestCancelled(state: FriendsState, data: any): FriendsState {
    const newState = { ...state }
    
    // Remove from outgoing requests
    if (newState.outgoingRequests.has(data.requestId)) {
      newState.outgoingRequests = new Map(newState.outgoingRequests)
      newState.outgoingRequests.delete(data.requestId)
    }

    return newState
  }

  private static applyFriendRemoved(state: FriendsState, data: any): FriendsState {
    const newState = { ...state }
    
    // Remove from friends
    const friendUserId = data.removedUserId === state.userId ? data.removedByUserId : data.removedUserId
    
    if (newState.friends.has(friendUserId)) {
      newState.friends = new Map(newState.friends)
      newState.friends.delete(friendUserId)
    }

    return newState
  }

  private static applyPresenceUpdated(state: FriendsState, data: any): FriendsState {
    const newState = { ...state }
    
    const presence: UserPresence = {
      status: data.status,
      lastSeenAt: new Date(data.timestamp),
      currentGameId: data.gameId || null
    }
    
    newState.presence = new Map(newState.presence)
    newState.presence.set(data.userId, presence)
    
    // Update friend's presence if they're in our friends list
    if (newState.friends.has(data.userId)) {
      const friend = newState.friends.get(data.userId)!
      newState.friends = new Map(newState.friends)
      newState.friends.set(data.userId, {
        ...friend,
        presence
      })
    }

    return newState
  }
}

// **FRIENDS COMMAND SERVICE** - Event-Sourced Commands (NO DIRECT DATABASE QUERIES)
export class FriendsCommandService {
  
  /**
   * Send a friend request - creates friend_request_sent event
   */
  async sendFriendRequest(command: SendFriendRequestCommand): Promise<CommandResult> {
    try {
      // 1. Validate command
      if (command.fromUserId === command.toUserId) {
        return {
          success: false,
          events: [],
          error: 'Cannot send friend request to yourself'
        }
      }

      // 2. Get current state to check for existing relationships
      const fromUserState = await this.getFriendsState(command.fromUserId)
      if (!fromUserState.success || !fromUserState.state) {
        return {
          success: false,
          events: [],
          error: 'Could not validate current friendship state'
        }
      }

      // Check if already friends or request pending
      if (fromUserState.state.friends.has(command.toUserId)) {
        return {
          success: false,
          events: [],
          error: 'Already friends with this user'
        }
      }

      // Check for existing outgoing request
      const existingOutgoing = Array.from(fromUserState.state.outgoingRequests.values())
        .find(req => req.toUserId === command.toUserId)
      if (existingOutgoing) {
        return {
          success: false,
          events: [],
          error: 'Friend request already sent'
        }
      }

      // 3. Get user details for event data
      const [fromUser, toUser] = await Promise.all([
        this.getUserBasicInfo(command.fromUserId),
        this.getUserBasicInfo(command.toUserId)
      ])

      if (!fromUser || !toUser) {
        return {
          success: false,
          events: [],
          error: 'User not found'
        }
      }

      // 4. Create and append event
      const requestId = `freq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const eventData = {
        requestId,
        fromUserId: command.fromUserId,
        toUserId: command.toUserId,
        fromUser,
        toUser,
        message: command.message,
        timestamp: new Date().toISOString()
      }

      // Create friend request event for unified system
      const friendEvent = {
        type: 'FRIEND_REQUEST_SENT',
        userId: command.fromUserId,
        friendData: eventData
      }

      const result = await unifiedGameManager.sendEvent(
        `friends_${command.fromUserId}`,
        friendEvent,
        { userId: command.fromUserId }
      )

      if (!result.success) {
        return {
          success: false,
          events: [],
          error: result.error || 'Failed to store friend request event'
        }
      }

      // 5. Project new state
      const updatedState = await this.getFriendsState(command.fromUserId)

      // 6. Send real-time notification to the recipient via unified WebSocket
      try {
        webSocketServer.sendSocialNotification(command.toUserId, {
          type: 'friend_request_received',
          data: {
            fromUserId: command.fromUserId,
            fromUser,
            requestId,
            message: command.message
          },
          timestamp: new Date().toISOString()
        })
      } catch (wsError) {
        console.error('Failed to send friend request WebSocket notification:', wsError)
        // Don't fail the command if WebSocket fails
      }

      return {
        success: true,
        events: [friendEvent],
        state: updatedState.state,
        data: { requestId, request: eventData }
      }

    } catch (error) {
      console.error('Error sending friend request:', error)
      return {
        success: false,
        events: [],
        error: 'Failed to send friend request'
      }
    }
  }

  /**
   * Accept a friend request - creates friend_request_accepted event and friendship
   */
  async acceptFriendRequest(command: AcceptFriendRequestCommand): Promise<CommandResult> {
    try {
      // 1. Get current state to find the request
      const userState = await this.getFriendsState(command.acceptingUserId)
      if (!userState.success || !userState.state) {
        return {
          success: false,
          events: [],
          error: 'Could not validate current friendship state'
        }
      }

      const request = userState.state.incomingRequests.get(command.requestId)
      if (!request) {
        return {
          success: false,
          events: [],
          error: 'Friend request not found'
        }
      }

      // 2. Create friendship and append acceptance event
      const friendshipId = `friendship_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const eventData = {
        requestId: command.requestId,
        friendshipId,
        fromUserId: request.fromUserId,
        toUserId: request.toUserId,
        fromUser: request.fromUser,
        toUser: request.toUser,
        timestamp: new Date().toISOString()
      }

      // Create acceptance events for both users in unified system
      const acceptEvent = {
        type: 'FRIEND_REQUEST_ACCEPTED',
        userId: command.acceptingUserId,
        friendData: eventData
      }

      const results = await Promise.all([
        unifiedGameManager.sendEvent(
          `friends_${request.fromUserId}`,
          acceptEvent,
          { userId: request.fromUserId }
        ),
        unifiedGameManager.sendEvent(
          `friends_${request.toUserId}`,
          acceptEvent,
          { userId: request.toUserId }
        )
      ])

      if (results.some(r => !r.success)) {
        return {
          success: false,
          events: [],
          error: 'Failed to store friend acceptance events'
        }
      }

      // 3. Project new state
      const updatedState = await this.getFriendsState(command.acceptingUserId)

      // 4. Send real-time notification to the original requester
      try {
        webSocketServer.sendSocialNotification(request.fromUserId, {
          type: 'friend_request_accepted',
          data: {
            acceptedByUserId: command.acceptingUserId,
            acceptedByUser: request.toUser,
            friendshipId
          },
          timestamp: new Date().toISOString()
        })
      } catch (wsError) {
        console.error('Failed to send friend request accepted WebSocket notification:', wsError)
        // Don't fail the command if WebSocket fails
      }

      return {
        success: true,
        events: [acceptEvent],
        state: updatedState.state,
        data: { friendshipId, friendship: eventData }
      }

    } catch (error) {
      console.error('Error accepting friend request:', error)
      return {
        success: false,
        events: [],
        error: 'Failed to accept friend request'
      }
    }
  }

  /**
   * Reject a friend request - creates friend_request_rejected event
   */
  async rejectFriendRequest(command: RejectFriendRequestCommand): Promise<CommandResult> {
    try {
      // Get current state to find the request
      const userState = await this.getFriendsState(command.rejectingUserId)
      if (!userState.success || !userState.state) {
        return {
          success: false,
          events: [],
          error: 'Could not validate current friendship state'
        }
      }

      const request = userState.state.incomingRequests.get(command.requestId)
      if (!request) {
        return {
          success: false,
          events: [],
          error: 'Friend request not found'
        }
      }

      const eventData = {
        requestId: command.requestId,
        fromUserId: request.fromUserId,
        toUserId: request.toUserId,
        rejectingUserId: command.rejectingUserId,
        timestamp: new Date().toISOString()
      }

      // Create rejection events for both users in unified system
      const rejectEvent = {
        type: 'FRIEND_REQUEST_REJECTED',
        userId: command.rejectingUserId,
        friendData: eventData
      }

      const results = await Promise.all([
        unifiedGameManager.sendEvent(
          `friends_${request.fromUserId}`,
          rejectEvent,
          { userId: request.fromUserId }
        ),
        unifiedGameManager.sendEvent(
          `friends_${request.toUserId}`,
          rejectEvent,
          { userId: request.toUserId }
        )
      ])

      if (results.some(r => !r.success)) {
        return {
          success: false,
          events: [],
          error: 'Failed to store friend rejection events'
        }
      }

      const updatedState = await this.getFriendsState(command.rejectingUserId)

      // Send notification
      try {
        webSocketServer.sendSocialNotification(request.fromUserId, {
          type: 'friend_request_rejected',
          data: {
            rejectedByUserId: command.rejectingUserId
          },
          timestamp: new Date().toISOString()
        })
      } catch (wsError) {
        console.error('Failed to send friend request rejected notification:', wsError)
      }

      return {
        success: true,
        events: [rejectEvent],
        state: updatedState.state,
        data: { rejection: eventData }
      }

    } catch (error) {
      console.error('Error rejecting friend request:', error)
      return {
        success: false,
        events: [],
        error: 'Failed to reject friend request'
      }
    }
  }

  /**
   * Remove a friend - creates friend_removed event
   */
  async removeFriend(command: RemoveFriendCommand): Promise<CommandResult> {
    try {
      // Get current state to find the friendship
      const userState = await this.getFriendsState(command.removingUserId)
      if (!userState.success || !userState.state) {
        return {
          success: false,
          events: [],
          error: 'Could not validate current friendship state'
        }
      }

      const friend = Array.from(userState.state.friends.values())
        .find(f => f.friendshipId === command.friendshipId)
      
      if (!friend) {
        return {
          success: false,
          events: [],
          error: 'Friendship not found'
        }
      }

      const eventData = {
        friendshipId: command.friendshipId,
        removedUserId: friend.userId,
        removedByUserId: command.removingUserId,
        timestamp: new Date().toISOString()
      }

      // Create removal events for both users in unified system
      const removeEvent = {
        type: 'FRIEND_REMOVED',
        userId: command.removingUserId,
        friendData: eventData
      }

      const results = await Promise.all([
        unifiedGameManager.sendEvent(
          `friends_${command.removingUserId}`,
          removeEvent,
          { userId: command.removingUserId }
        ),
        unifiedGameManager.sendEvent(
          `friends_${friend.userId}`,
          removeEvent,
          { userId: friend.userId }
        )
      ])

      if (results.some(r => !r.success)) {
        return {
          success: false,
          events: [],
          error: 'Failed to store friend removal events'
        }
      }

      const updatedState = await this.getFriendsState(command.removingUserId)

      // Send real-time notification to the removed friend
      try {
        webSocketServer.sendSocialNotification(friend.userId, {
          type: 'friend_removed',
          data: {
            removedByUserId: command.removingUserId,
            friendshipId: command.friendshipId
          },
          timestamp: new Date().toISOString()
        })
      } catch (wsError) {
        console.error('Failed to send friend removed WebSocket notification:', wsError)
        // Don't fail the command if WebSocket fails
      }

      return {
        success: true,
        events: [removeEvent],
        state: updatedState.state,
        data: { removal: eventData }
      }

    } catch (error) {
      console.error('Error removing friend:', error)
      return {
        success: false,
        events: [],
        error: 'Failed to remove friend'
      }
    }
  }

  /**
   * Update user presence - creates presence_updated event
   */
  async updatePresence(command: UpdatePresenceCommand): Promise<CommandResult> {
    try {
      const eventData = {
        userId: command.userId,
        status: command.status,
        gameId: command.gameId,
        timestamp: new Date().toISOString()
      }

      // Create presence update event in unified system
      const presenceEvent = {
        type: 'PRESENCE_UPDATED',
        userId: command.userId,
        friendData: eventData
      }

      const result = await unifiedGameManager.sendEvent(
        `friends_${command.userId}`,
        presenceEvent,
        { userId: command.userId }
      )

      if (!result.success) {
        return {
          success: false,
          events: [],
          error: result.error || 'Failed to store presence update event'
        }
      }

      const updatedState = await this.getFriendsState(command.userId)

      // Broadcast presence update to all friends via unified WebSocket
      try {
        webSocketServer.broadcastSocialNotification({
          type: 'friend_presence_update',
          data: {
            userId: command.userId,
            status: command.status,
            gameId: command.gameId
          },
          timestamp: new Date().toISOString()
        })
      } catch (wsError) {
        console.error('Failed to broadcast presence update WebSocket notification:', wsError)
        // Don't fail the command if WebSocket fails
      }

      return {
        success: true,
        events: [presenceEvent],
        state: updatedState.state,
        data: { presence: eventData }
      }

    } catch (error) {
      console.error('Error updating presence:', error)
      return {
        success: false,
        events: [],
        error: 'Failed to update presence'
      }
    }
  }

  /**
   * Get friends state by projecting events from unified store
   */
  async getFriendsState(userId: string): Promise<{ success: boolean; state?: FriendsState; error?: string }> {
    try {
      // Get game state from unified manager for this user's friends aggregate
      const gameState = await unifiedGameManager.getGameState(`friends_${userId}`)
      
      if (!gameState) {
        // No events yet - return empty friends state
        const emptyState: FriendsState = {
          userId,
          friends: new Map(),
          incomingRequests: new Map(),
          outgoingRequests: new Map(),
          presence: new Map(),
          lastUpdated: new Date()
        }
        
        return {
          success: true,
          state: emptyState
        }
      }
      
      // Extract friend events from the game state
      // The unified system stores friend events in the game context
      const friendEvents = gameState.events?.filter((e: any) => 
        e.type?.startsWith('FRIEND_') || e.type?.startsWith('PRESENCE_')
      ) || []
      
      // Project state from events
      const state = FriendsProjector.projectFriendsState(userId, friendEvents)
      
      return {
        success: true,
        state
      }
    } catch (error) {
      console.error('Error getting friends state:', error)
      return {
        success: false,
        error: 'Failed to get friends state'
      }
    }
  }

  /**
   * Search users with relationship status - ONLY for search, not for state
   */
  async searchUsers(currentUserId: string, query: string, limit: number = 20): Promise<UserSearchResult[]> {
    try {
      // This is allowed because it's a search operation, not state reconstruction
      const searchQuery = `%${query.toLowerCase()}%`
      
      const { data: users, error } = await supabaseAdmin
        .from('user_profiles')
        .select('id, name, email, avatar_emoji')
        .or(`name.ilike.${searchQuery},email.ilike.${searchQuery}`)
        .neq('id', currentUserId)
        .limit(limit)
      
      if (error) {
        throw new Error(`Failed to search users: ${error.message}`)
      }

      if (users.length === 0) {
        return []
      }

      // Get current user's friends state to determine relationships
      const friendsState = await this.getFriendsState(currentUserId)
      if (!friendsState.success || !friendsState.state) {
        return users.map(user => ({
          ...user,
          avatarEmoji: user.avatar_emoji,
          friendshipStatus: 'none' as const
        }))
      }

      // Map relationship status from event-sourced state
      return users.map(user => {
        let friendshipStatus: UserSearchResult['friendshipStatus'] = 'none'
        
        if (friendsState.state!.friends.has(user.id)) {
          friendshipStatus = 'friends'
        } else if (Array.from(friendsState.state!.outgoingRequests.values()).some(r => r.toUserId === user.id)) {
          friendshipStatus = 'pending_sent'
        } else if (Array.from(friendsState.state!.incomingRequests.values()).some(r => r.fromUserId === user.id)) {
          friendshipStatus = 'pending_received'
        }

        return {
          ...user,
          avatarEmoji: user.avatar_emoji,
          friendshipStatus
        }
      })

    } catch (error) {
      console.error('Error searching users:', error)
      return []
    }
  }

  /**
   * Helper to get basic user info (allowed for event data enrichment)
   */
  private async getUserBasicInfo(userId: string): Promise<UserBasicInfo | null> {
    try {
      const { data: user, error } = await supabaseAdmin
        .from('user_profiles')
        .select('id, name, email, avatar_emoji')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error getting user basic info:', error)
        return null
      }

      return user ? {
        ...user,
        avatarEmoji: user.avatar_emoji
      } : null
    } catch (error) {
      console.error('Error getting user basic info:', error)
      return null
    }
  }
}

// Export singleton instance
export const friendsCommandService = new FriendsCommandService() 