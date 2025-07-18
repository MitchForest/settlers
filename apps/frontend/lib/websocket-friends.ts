'use client'

import { toast } from 'sonner'

interface FriendsNotification {
  type: 'friend_request_received' | 'friend_request_accepted' | 'friend_request_rejected' | 
        'friend_removed' | 'friend_presence_update' | 'game_invite_received' | 'game_invite_responded'
  data: Record<string, unknown>
  timestamp: string
}

interface WebSocketMessage {
  success: boolean
  data?: {
    type: string
    notification?: FriendsNotification
    [key: string]: any
  }
  error?: string
}

export class FriendsWebSocketClient {
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private pingInterval: NodeJS.Timeout | null = null
  private isConnecting = false
  private listeners: Map<string, Set<(data: any) => void>> = new Map()

  constructor(private wsUrl: string) {
    // Initialize event listener maps
    this.listeners.set('friend_request_received', new Set())
    this.listeners.set('friend_request_accepted', new Set())
    this.listeners.set('friend_request_rejected', new Set())
    this.listeners.set('friend_removed', new Set())
    this.listeners.set('friend_presence_update', new Set())
    this.listeners.set('game_invite_received', new Set())
  }

  /**
   * Connect to the WebSocket server
   */
  connect(userId: string, gameId?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
        resolve()
        return
      }

      this.isConnecting = true

      try {
        this.ws = new WebSocket(this.wsUrl)

        this.ws.onopen = () => {
          console.log('👥 Connected to friends WebSocket')
          this.isConnecting = false
          this.reconnectAttempts = 0
          
          // **NEW: Use proper 'connectSocial' message type**
          this.sendMessage({
            type: 'connectSocial',
            data: {
              userId
            }
          })

          this.startPing()
          resolve()
        }

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data)
            this.handleMessage(message)
          } catch (error) {
            console.error('Error parsing WebSocket message:', error)
          }
        }

        this.ws.onclose = (event) => {
          console.log('👥 Friends WebSocket disconnected')
          this.isConnecting = false
          this.stopPing()

          if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnect(userId, gameId)
          }
        }

        this.ws.onerror = (error) => {
          console.error('👥 Friends WebSocket error:', error)
          this.isConnecting = false
          reject(error)
        }

      } catch (error) {
        this.isConnecting = false
        reject(error)
      }
    })
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    if (this.ws) {
      this.stopPing()
      this.ws.close()
      this.ws = null
    }
  }

  /**
   * Add an event listener for a specific notification type
   */
  on(eventType: string, callback: (data: any) => void): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set())
    }
    this.listeners.get(eventType)!.add(callback)
  }

  /**
   * Remove an event listener
   */
  off(eventType: string, callback: (data: any) => void): void {
    const listeners = this.listeners.get(eventType)
    if (listeners) {
      listeners.delete(callback)
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(message: WebSocketMessage): void {
    if (!message.success) {
      console.error('WebSocket error:', message.error)
      return
    }

    if (message.data?.type === 'friends_notification' && message.data.notification) {
      this.handleFriendsNotification(message.data.notification)
    } else if (message.data?.type === 'pong') {
      // Handle ping/pong
    } else {
      // Handle other WebSocket messages (game events, etc.)
      console.log('Received WebSocket message:', message)
    }
  }

  /**
   * Handle friends notifications
   */
  private handleFriendsNotification(notification: FriendsNotification): void {
    console.log('👥 Received friends notification:', notification)

    // Emit to listeners
    const listeners = this.listeners.get(notification.type)
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(notification.data)
        } catch (error) {
          console.error('Error in notification callback:', error)
        }
      })
    }

    // Show toast notifications
    this.showToastNotification(notification)
  }

  /**
   * Show toast notifications for friends events
   */
  private showToastNotification(notification: FriendsNotification): void {
    switch (notification.type) {
      case 'friend_request_received':
        const fromUser = notification.data.fromUser as { name: string }
        toast.success(`🤝 Friend request from ${fromUser.name}`, {
          description: (notification.data.request as { message?: string }).message || 'Wants to be your friend',
          action: {
            label: 'View',
            onClick: () => {
              // This could open the friends section or navigate to profile
              console.log('Open friends requests')
            }
          }
        })
        break

      case 'friend_request_accepted':
        const newFriend = notification.data.newFriend as { name: string }
        toast.success(`🎉 ${newFriend.name} accepted your friend request!`, {
          description: 'You are now friends'
        })
        break

      case 'friend_request_rejected':
        toast.info(`😔 ${notification.data.rejectedBy} declined your friend request`)
        break

      case 'friend_removed':
        toast.info(`👋 ${notification.data.removedFriend} removed you from their friends`)
        break

      case 'friend_presence_update':
        // Don't show toast for presence updates (too noisy)
        // Just emit to listeners for UI updates
        break

      case 'game_invite_received':
        toast.success(`🎮 Game invite received!`, {
          description: 'Someone invited you to join their game',
          action: {
            label: 'View',
            onClick: () => {
              console.log('Open game invites')
            }
          }
        })
        break

      default:
        console.log('Unknown notification type:', notification.type)
    }
  }

  /**
   * Send a message to the WebSocket server
   */
  private sendMessage(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    }
  }

  /**
   * Start ping interval to keep connection alive
   */
  private startPing(): void {
    this.pingInterval = setInterval(() => {
      this.sendMessage({ type: 'ping' })
    }, 30000) // Ping every 30 seconds
  }

  /**
   * Stop ping interval
   */
  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
  }

  /**
   * Attempt to reconnect
   */
  private reconnect(userId: string, gameId?: string): void {
    this.reconnectAttempts++
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)

    console.log(`👥 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms`)

    setTimeout(() => {
      if (this.reconnectAttempts <= this.maxReconnectAttempts) {
        this.connect(userId, gameId).catch(error => {
          console.error('Reconnection failed:', error)
        })
      }
    }, delay)
  }

  /**
   * Get connection status
   */
  get isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }
}

// Create and export a singleton instance
let friendsWebSocket: FriendsWebSocketClient | null = null

export function getFriendsWebSocket(): FriendsWebSocketClient {
  if (!friendsWebSocket) {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080/ws'
    friendsWebSocket = new FriendsWebSocketClient(wsUrl)
  }
  return friendsWebSocket
} 