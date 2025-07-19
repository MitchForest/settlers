/**
 * 🔌 WEBSOCKET CONNECTION MANAGER - SINGLETON PATTERN
 * 
 * Stores WebSocket connections OUTSIDE React lifecycle.
 * Provides idempotent connection methods that React can call safely.
 * Modern React pattern: cache behavior outside of React.
 */

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error'

interface ConnectionInstance {
  ws: WebSocket | null
  status: ConnectionStatus
  url: string
  sessionToken: string
  listeners: Set<(status: ConnectionStatus, ws?: WebSocket) => void>
  reconnectTimeout?: NodeJS.Timeout
}

class WebSocketConnectionManager {
  private connections = new Map<string, ConnectionInstance>()
  private connectingKeys = new Set<string>()

  /**
   * 🔗 GET OR CREATE CONNECTION (IDEMPOTENT)
   * 
   * This is the key method - it's idempotent and can be called
   * multiple times safely from React effects.
   */
  getOrCreateConnection(
    url: string, 
    sessionToken: string,
    onStatusChange?: (status: ConnectionStatus, ws?: WebSocket) => void
  ): ConnectionInstance {
    if (!sessionToken) {
      console.error('🔌 ERROR: No session token provided to getOrCreateConnection')
      throw new Error('Session token is required')
    }
    
    const connectionKey = `${url}#${sessionToken}`
    
    let connection = this.connections.get(connectionKey)
    
    if (!connection) {
      console.log('🔌 Creating new connection instance for:', connectionKey.substring(0, 80) + '...')
      connection = {
        ws: null,
        status: 'idle',
        url,
        sessionToken,
        listeners: new Set(),
        reconnectTimeout: undefined
      }
      this.connections.set(connectionKey, connection)
    }
    
    // Add status listener if provided
    if (onStatusChange) {
      connection.listeners.add(onStatusChange)
    }
    
    return connection
  }

  /**
   * 🔌 CONNECT (IDEMPOTENT)
   * 
   * Safe to call multiple times - will only connect if needed.
   */
  connect(connection: ConnectionInstance): void {
    const connectionKey = `${connection.url}#${connection.sessionToken}`
    
    // 🚫 GLOBAL SEMAPHORE: Prevent race conditions from multiple React effects
    if (this.connectingKeys.has(connectionKey)) {
      console.log('🔌 Already connecting globally, skipping')
      return
    }
    
    // 🚫 IDEMPOTENT GUARD: Only connect if we need to
    if (connection.ws && 
        (connection.ws.readyState === WebSocket.OPEN || connection.ws.readyState === WebSocket.CONNECTING)) {
      console.log('🔌 Connection already exists/connecting, skipping')
      return
    }
    
    if (connection.status === 'connecting') {
      console.log('🔌 Already connecting via status, skipping')
      return
    }

    console.log('🔌 Starting connection to:', connection.url.substring(0, 80) + '...')
    this.connectingKeys.add(connectionKey)
    this.setStatus(connection, 'connecting')
    
    try {
      const ws = new WebSocket(connection.url)
      connection.ws = ws
      
      ws.onopen = () => {
        console.log('🔌 WebSocket opened')
        this.connectingKeys.delete(connectionKey)
        this.setStatus(connection, 'connected', ws)
      }
      
      ws.onmessage = (event) => {
        // Notify all listeners of messages
        connection.listeners.forEach(listener => {
          if (typeof (listener as any).onMessage === 'function') {
            (listener as any).onMessage(event)
          }
        })
      }
      
      ws.onclose = (event) => {
        console.log('🔌 WebSocket closed:', event.code, event.reason)
        this.connectingKeys.delete(connectionKey)
        connection.ws = null
        this.setStatus(connection, 'disconnected')
        
        // Auto-reconnect for unexpected closures
        if (event.code !== 1000 && event.code !== 1001 && event.code !== 1005) {
          console.log('🔄 Scheduling reconnect...')
          connection.reconnectTimeout = setTimeout(() => {
            this.connect(connection)
          }, 2000)
        }
      }
      
      ws.onerror = (error) => {
        console.error('🔌 WebSocket error:', error)
        this.connectingKeys.delete(connectionKey)
        connection.ws = null
        this.setStatus(connection, 'error')
      }
      
    } catch (error) {
      console.error('🔌 Failed to create WebSocket:', error)
      this.connectingKeys.delete(connectionKey)
      this.setStatus(connection, 'error')
    }
  }

  /**
   * 📤 SEND MESSAGE (SAFE)
   */
  send(connection: ConnectionInstance, message: object): boolean {
    if (!connection.ws || connection.ws.readyState !== WebSocket.OPEN) {
      console.warn('🔌 Cannot send - connection not open')
      return false
    }
    
    try {
      connection.ws.send(JSON.stringify(message))
      return true
    } catch (error) {
      console.error('🔌 Send failed:', error)
      return false
    }
  }

  /**
   * 🔌 DISCONNECT (IDEMPOTENT)
   */
  disconnect(connection: ConnectionInstance): void {
    if (connection.reconnectTimeout) {
      clearTimeout(connection.reconnectTimeout)
      connection.reconnectTimeout = undefined
    }
    
    if (connection.ws && connection.ws.readyState === WebSocket.OPEN) {
      console.log('🔌 Closing connection')
      connection.ws.close(1000, 'Manual disconnect')
    }
    
    connection.ws = null
    this.setStatus(connection, 'disconnected')
  }

  /**
   * 🗑️ REMOVE CONNECTION
   */
  removeConnection(url: string, sessionToken: string): void {
    const connectionKey = `${url}#${sessionToken}`
    const connection = this.connections.get(connectionKey)
    
    if (connection) {
      this.disconnect(connection)
      this.connections.delete(connectionKey)
      console.log('🔌 Connection removed from manager')
    }
  }

  /**
   * 🔔 REMOVE LISTENER
   */
  removeListener(
    connection: ConnectionInstance, 
    listener: (status: ConnectionStatus, ws?: WebSocket) => void
  ): void {
    connection.listeners.delete(listener)
  }

  private setStatus(connection: ConnectionInstance, status: ConnectionStatus, ws?: WebSocket): void {
    connection.status = status
    
    // Notify all listeners
    connection.listeners.forEach(listener => {
      try {
        listener(status, ws)
      } catch (error) {
        console.error('🔌 Listener error:', error)
      }
    })
  }
}

// 🏗️ SINGLETON INSTANCE - Stored outside React
export const wsManager = new WebSocketConnectionManager() 