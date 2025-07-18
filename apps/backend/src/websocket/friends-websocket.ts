import { WebSocket } from 'ws'
import { FriendsService } from '../services/friends-service'

interface UserConnection {
  ws: WebSocket
  userId: string
  gameId?: string
  isAlive: boolean
}

interface FriendsNotification {
  type: 'friend_request_received' | 'friend_request_accepted' | 'friend_request_rejected' | 
        'friend_removed' | 'friend_presence_update' | 'game_invite_received' | 'game_invite_responded'
  data: any
  timestamp: string
}

export class FriendsWebSocketManager {
  private userConnections = new Map<string, Set<UserConnection>>() // userId -> connections
  private connectionToUser = new Map<WebSocket, UserConnection>()

  constructor() {
    // Clean up stale connections every 30 seconds
    setInterval(() => {
      this.cleanupStaleConnections()
    }, 30000)
  }

  /**
   * Register a WebSocket connection for a user
   */
  registerUserConnection(ws: WebSocket, userId: string, gameId?: string): void {
    const connection: UserConnection = {
      ws,
      userId,
      gameId,
      isAlive: true
    }

    // Add to user connections map
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set())
    }
    this.userConnections.get(userId)!.add(connection)

    // Add to connection lookup
    this.connectionToUser.set(ws, connection)

    // Set up heartbeat
    this.setupHeartbeat(connection)

    console.log(`👥 User ${userId} connected for friends notifications`)
  }

  /**
   * Unregister a WebSocket connection
   */
  unregisterUserConnection(ws: WebSocket): void {
    const connection = this.connectionToUser.get(ws)
    if (!connection) return

    // Remove from user connections
    const userConnections = this.userConnections.get(connection.userId)
    if (userConnections) {
      userConnections.delete(connection)
      if (userConnections.size === 0) {
        this.userConnections.delete(connection.userId)
      }
    }

    // Remove from connection lookup
    this.connectionToUser.delete(ws)

    console.log(`👥 User ${connection.userId} disconnected from friends notifications`)
  }

  /**
   * Broadcast a notification to a specific user
   */
  broadcastToUser(userId: string, notification: Omit<FriendsNotification, 'timestamp'>): void {
    const userConnections = this.userConnections.get(userId)
    if (!userConnections || userConnections.size === 0) {
      console.log(`👥 No active connections for user ${userId}`)
      return
    }

    const fullNotification: FriendsNotification = {
      ...notification,
      timestamp: new Date().toISOString()
    }

    const message = JSON.stringify({
      success: true,
      data: {
        type: 'friends_notification',
        notification: fullNotification
      }
    })

    userConnections.forEach(connection => {
      if (connection.ws.readyState === WebSocket.OPEN) {
        try {
          connection.ws.send(message)
        } catch (error) {
          console.error(`Error sending friends notification to user ${userId}:`, error)
        }
      }
    })

    console.log(`👥 Sent ${notification.type} notification to user ${userId}`)
  }

  /**
   * Broadcast a notification to multiple users
   */
  broadcastToUsers(userIds: string[], notification: Omit<FriendsNotification, 'timestamp'>): void {
    userIds.forEach(userId => {
      this.broadcastToUser(userId, notification)
    })
  }

  /**
   * Notify about a new friend request
   */
  async notifyFriendRequest(toUserId: string, fromUserId: string, requestId: string, message?: string): Promise<void> {
    try {
      // Get the friend request details
      const requests = await FriendsService.getFriendRequests(toUserId)
      const request = requests.find(r => r.id === requestId)
      
      if (!request) {
        console.error('Friend request not found for notification')
        return
      }

      this.broadcastToUser(toUserId, {
        type: 'friend_request_received',
        data: {
          request,
          fromUser: request.fromUser
        }
      })
    } catch (error) {
      console.error('Error notifying friend request:', error)
    }
  }

  /**
   * Notify when a friend request is accepted
   */
  async notifyFriendRequestAccepted(fromUserId: string, toUserId: string): Promise<void> {
    try {
      // Get the new friendship details
      const friends = await FriendsService.getFriends(fromUserId)
      const newFriend = friends.find(f => f.friendUser.id === toUserId)
      
      if (!newFriend) {
        console.error('New friendship not found for notification')
        return
      }

      this.broadcastToUser(fromUserId, {
        type: 'friend_request_accepted',
        data: {
          newFriend: newFriend.friendUser,
          friendship: newFriend
        }
      })
    } catch (error) {
      console.error('Error notifying friend request accepted:', error)
    }
  }

  /**
   * Notify when a friend request is rejected
   */
  notifyFriendRequestRejected(fromUserId: string, rejectedByName: string): void {
    this.broadcastToUser(fromUserId, {
      type: 'friend_request_rejected',
      data: {
        rejectedBy: rejectedByName
      }
    })
  }

  /**
   * Notify when a friend is removed
   */
  notifyFriendRemoved(userId: string, removedFriendName: string): void {
    this.broadcastToUser(userId, {
      type: 'friend_removed',
      data: {
        removedFriend: removedFriendName
      }
    })
  }

  /**
   * Broadcast presence updates to friends
   */
  async broadcastPresenceUpdate(userId: string, status: string, gameId?: string): Promise<void> {
    try {
      // Get user's friends
      const friends = await FriendsService.getFriends(userId)
      const friendIds = friends.map(f => f.friendUser.id)

      if (friendIds.length === 0) return

      // Get user info for the notification
      // Note: We'd need to add a method to get user basic info
      this.broadcastToUsers(friendIds, {
        type: 'friend_presence_update',
        data: {
          userId,
          presence: {
            status,
            gameId,
            lastSeen: new Date().toISOString()
          }
        }
      })
    } catch (error) {
      console.error('Error broadcasting presence update:', error)
    }
  }

  /**
   * Notify about a game invite
   */
  async notifyGameInvite(toUserId: string, inviteId: string, gameId: string, fromUserId: string, message?: string): Promise<void> {
    this.broadcastToUser(toUserId, {
      type: 'game_invite_received',
      data: {
        inviteId,
        gameId,
        fromUserId,
        message
      }
    })
  }

  /**
   * Set up heartbeat for a connection
   */
  private setupHeartbeat(connection: UserConnection): void {
    const heartbeatInterval = setInterval(() => {
      if (!connection.isAlive) {
        // Connection is stale, clean it up
        clearInterval(heartbeatInterval)
        this.unregisterUserConnection(connection.ws)
        connection.ws.terminate()
        return
      }

      connection.isAlive = false
      if (connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.ping()
      }
    }, 30000)

    // Handle pong responses
    connection.ws.on('pong', () => {
      connection.isAlive = true
    })

    // Clean up on close
    connection.ws.on('close', () => {
      clearInterval(heartbeatInterval)
      this.unregisterUserConnection(connection.ws)
    })
  }

  /**
   * Clean up stale connections
   */
  private cleanupStaleConnections(): void {
    this.connectionToUser.forEach((connection, ws) => {
      if (ws.readyState !== WebSocket.OPEN) {
        this.unregisterUserConnection(ws)
      }
    })
  }

  /**
   * Get connection count for a user
   */
  getUserConnectionCount(userId: string): number {
    return this.userConnections.get(userId)?.size || 0
  }

  /**
   * Get total active connections
   */
  getTotalConnections(): number {
    return this.connectionToUser.size
  }
}

// Export a singleton instance
export const friendsWebSocketManager = new FriendsWebSocketManager() 