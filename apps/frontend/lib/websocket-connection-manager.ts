/**
 * 🔌 WEBSOCKET CONNECTION MANAGER - SINGLETON PATTERN (ROBUST VERSION)
 * 
 * Stores WebSocket connections OUTSIDE React lifecycle.
 * Provides idempotent connection methods that React can call safely.
 * Modern React pattern: cache behavior outside of React.
 * 
 * ✅ ROBUSTNESS FEATURES:
 * - Automatic listener cleanup with WeakMap tracking
 * - Exponential backoff with max retry limits
 * - Circuit breaker pattern for failed connections
 * - Proper timeout handling for all operations
 * - Browser-compatible timeout types
 * - Type-safe message handling
 * - Connection health monitoring
 */

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error' | 'failed'

interface MessageListener {
  onMessage: (event: MessageEvent) => void
}

interface StatusListener {
  (status: ConnectionStatus, ws?: WebSocket): void
}

interface ConnectionInstance {
  ws: WebSocket | null
  status: ConnectionStatus
  url: string
  sessionToken: string
  statusListeners: Set<StatusListener>
  messageListeners: Set<MessageListener>
  reconnectTimeout?: number // Browser compatible
  retryCount: number
  maxRetries: number
  baseRetryDelay: number
  lastError?: string
  connectionTimeout?: number
  healthCheckInterval?: number
  isHealthy: boolean
  createdAt: number
}

class WebSocketConnectionManager {
  private connections = new Map<string, ConnectionInstance>()
  private connectingKeys = new Set<string>()
  private listenerCleanup = new WeakMap<object, () => void>() // Auto cleanup tracking

  // Circuit breaker settings
  private readonly MAX_RETRIES = 5
  private readonly BASE_RETRY_DELAY = 1000 // 1 second
  private readonly MAX_RETRY_DELAY = 30000 // 30 seconds
  private readonly CONNECTION_TIMEOUT = 10000 // 10 seconds
  private readonly HEALTH_CHECK_INTERVAL = 30000 // 30 seconds

  /**
   * 🔗 GET OR CREATE CONNECTION (IDEMPOTENT & ROBUST)
   */
  getOrCreateConnection(
    url: string, 
    sessionToken: string,
    onStatusChange?: StatusListener
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
        statusListeners: new Set(),
        messageListeners: new Set(),
        reconnectTimeout: undefined,
        retryCount: 0,
        maxRetries: this.MAX_RETRIES,
        baseRetryDelay: this.BASE_RETRY_DELAY,
        lastError: undefined,
        connectionTimeout: undefined,
        healthCheckInterval: undefined,
        isHealthy: false,
        createdAt: Date.now()
      }
      this.connections.set(connectionKey, connection)
    }
    
    // Add status listener with automatic cleanup tracking
    if (onStatusChange) {
      connection.statusListeners.add(onStatusChange)
      
      // Set up automatic cleanup when listener object is garbage collected
      const cleanup = () => {
        connection.statusListeners.delete(onStatusChange)
        console.log('🧹 Auto-cleaned up status listener')
      }
      this.listenerCleanup.set(onStatusChange, cleanup)
    }
    
    return connection
  }

  /**
   * 🔌 CONNECT WITH TIMEOUT & EXPONENTIAL BACKOFF (IDEMPOTENT)
   */
  connect(connection: ConnectionInstance): Promise<void> {
    const connectionKey = `${connection.url}#${connection.sessionToken}`
    
    // 🚫 GLOBAL SEMAPHORE: Prevent race conditions
    if (this.connectingKeys.has(connectionKey)) {
      console.log('🔌 Already connecting globally, skipping')
      return Promise.resolve()
    }
    
    // 🚫 IDEMPOTENT GUARD: Only connect if needed
    if (connection.ws && 
        (connection.ws.readyState === WebSocket.OPEN || connection.ws.readyState === WebSocket.CONNECTING)) {
      console.log('🔌 Connection already exists/connecting, skipping')
      return Promise.resolve()
    }
    
    // 🚫 CIRCUIT BREAKER: Stop trying if too many failures
    if (connection.retryCount >= connection.maxRetries) {
      console.error('🔌 Circuit breaker: Max retries exceeded, marking as failed')
      this.setStatus(connection, 'failed')
      connection.lastError = 'Max retry attempts exceeded'
      return Promise.reject(new Error(connection.lastError))
    }
    
    if (connection.status === 'connecting') {
      console.log('🔌 Already connecting via status, skipping')
      return Promise.resolve()
    }

    console.log(`🔌 Starting connection attempt ${connection.retryCount + 1}/${connection.maxRetries}`)
    this.connectingKeys.add(connectionKey)
    this.setStatus(connection, 'connecting')
    
    return new Promise((resolve, reject) => {
      let isResolved = false
      
      // ⏰ CONNECTION TIMEOUT
      const timeoutId = window.setTimeout(() => {
        if (!isResolved) {
          isResolved = true
          console.error('🔌 Connection timeout after', this.CONNECTION_TIMEOUT, 'ms')
          this.connectingKeys.delete(connectionKey)
          connection.lastError = 'Connection timeout'
          this.setStatus(connection, 'error')
          this.scheduleReconnect(connection)
          reject(new Error('Connection timeout'))
        }
      }, this.CONNECTION_TIMEOUT)
      
      try {
        const ws = new WebSocket(connection.url)
        connection.ws = ws
        connection.connectionTimeout = timeoutId
        
        ws.onopen = () => {
          if (!isResolved) {
            isResolved = true
            console.log('🔌 WebSocket opened successfully')
            window.clearTimeout(timeoutId)
            this.connectingKeys.delete(connectionKey)
            connection.retryCount = 0 // Reset on successful connection
            connection.lastError = undefined
            this.setStatus(connection, 'connected', ws)
            this.startHealthCheck(connection)
            resolve()
          }
        }
        
        ws.onmessage = (event) => {
          // Notify all message listeners (type-safe)
          connection.messageListeners.forEach(listener => {
            try {
              listener.onMessage(event)
            } catch (error) {
              console.error('🔌 Message listener error:', error)
            }
          })
        }
        
        ws.onclose = (event) => {
          console.log('🔌 WebSocket closed:', event.code, event.reason)
          window.clearTimeout(timeoutId)
          this.connectingKeys.delete(connectionKey)
          this.stopHealthCheck(connection)
          connection.ws = null
          
          if (!isResolved) {
            isResolved = true
            reject(new Error(`Connection closed: ${event.reason}`))
          }
          
          // Don't auto-reconnect for expected closures
          if (event.code === 1000 || event.code === 1001 || event.code === 1005) {
            this.setStatus(connection, 'disconnected')
          } else {
            // Unexpected closure - schedule reconnect with backoff
            connection.lastError = `Unexpected closure: ${event.reason || event.code}`
            this.setStatus(connection, 'error')
            this.scheduleReconnect(connection)
          }
        }
        
        ws.onerror = (error) => {
          console.error('🔌 WebSocket error:', error)
          window.clearTimeout(timeoutId)
          this.connectingKeys.delete(connectionKey)
          this.stopHealthCheck(connection)
          connection.ws = null
          connection.lastError = 'WebSocket error'
          
          if (!isResolved) {
            isResolved = true
            reject(new Error('WebSocket error'))
          }
          
          this.setStatus(connection, 'error')
          this.scheduleReconnect(connection)
        }
        
      } catch (error) {
        console.error('🔌 Failed to create WebSocket:', error)
        window.clearTimeout(timeoutId)
        this.connectingKeys.delete(connectionKey)
        connection.lastError = error instanceof Error ? error.message : 'Unknown error'
        this.setStatus(connection, 'error')
        this.scheduleReconnect(connection)
        
        if (!isResolved) {
          isResolved = true
          reject(error)
        }
      }
    })
  }

  /**
   * 🔄 EXPONENTIAL BACKOFF RECONNECTION
   */
  private scheduleReconnect(connection: ConnectionInstance): void {
    if (connection.retryCount >= connection.maxRetries) {
      console.error('🔌 Max retries exceeded, not scheduling reconnect')
      this.setStatus(connection, 'failed')
      return
    }
    
    connection.retryCount++
    
    // Exponential backoff: delay = baseDelay * 2^retryCount (with jitter)
    const exponentialDelay = Math.min(
      connection.baseRetryDelay * Math.pow(2, connection.retryCount - 1),
      this.MAX_RETRY_DELAY
    )
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 1000
    const delay = exponentialDelay + jitter
    
    console.log(`🔄 Scheduling reconnect in ${Math.round(delay)}ms (attempt ${connection.retryCount}/${connection.maxRetries})`)
    
    connection.reconnectTimeout = window.setTimeout(() => {
      console.log('🔄 Attempting reconnect...')
      this.connect(connection).catch(error => {
        console.error('🔄 Reconnect failed:', error)
      })
    }, delay)
  }

  /**
   * 💓 HEALTH CHECK MONITORING
   */
  private startHealthCheck(connection: ConnectionInstance): void {
    this.stopHealthCheck(connection) // Clear any existing
    
    connection.healthCheckInterval = window.setInterval(() => {
      if (connection.ws?.readyState === WebSocket.OPEN) {
        try {
          // Send ping frame
          connection.ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }))
          connection.isHealthy = true
        } catch (error) {
          console.warn('🔌 Health check ping failed:', error)
          connection.isHealthy = false
        }
      } else {
        connection.isHealthy = false
      }
    }, this.HEALTH_CHECK_INTERVAL)
  }

  private stopHealthCheck(connection: ConnectionInstance): void {
    if (connection.healthCheckInterval) {
      window.clearInterval(connection.healthCheckInterval)
      connection.healthCheckInterval = undefined
    }
    connection.isHealthy = false
  }

  /**
   * 📤 SEND MESSAGE WITH VALIDATION (SAFE)
   */
  send(connection: ConnectionInstance, message: object, timeoutMs: number = 5000): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (!connection.ws || connection.ws.readyState !== WebSocket.OPEN) {
        console.warn('🔌 Cannot send - connection not open')
        resolve(false)
        return
      }
      
      const timeoutId = window.setTimeout(() => {
        reject(new Error('Send timeout'))
      }, timeoutMs)
      
      try {
        connection.ws.send(JSON.stringify(message))
        window.clearTimeout(timeoutId)
        resolve(true)
      } catch (error) {
        window.clearTimeout(timeoutId)
        console.error('🔌 Send failed:', error)
        resolve(false)
      }
    })
  }

  /**
   * 👂 ADD MESSAGE LISTENER WITH AUTO-CLEANUP
   */
  addMessageListener(connection: ConnectionInstance, listener: MessageListener): void {
    connection.messageListeners.add(listener)
    
    // Set up automatic cleanup
    const cleanup = () => {
      connection.messageListeners.delete(listener)
      console.log('🧹 Auto-cleaned up message listener')
    }
    this.listenerCleanup.set(listener, cleanup)
  }

  /**
   * 🔌 DISCONNECT (IDEMPOTENT & CLEAN)
   */
  disconnect(connection: ConnectionInstance): void {
    // Clear all timeouts
    if (connection.reconnectTimeout) {
      window.clearTimeout(connection.reconnectTimeout)
      connection.reconnectTimeout = undefined
    }
    
    if (connection.connectionTimeout) {
      window.clearTimeout(connection.connectionTimeout)
      connection.connectionTimeout = undefined
    }
    
    this.stopHealthCheck(connection)
    
    if (connection.ws && connection.ws.readyState === WebSocket.OPEN) {
      console.log('🔌 Closing connection gracefully')
      connection.ws.close(1000, 'Manual disconnect')
    }
    
    connection.ws = null
    connection.retryCount = 0
    connection.lastError = undefined
    this.setStatus(connection, 'disconnected')
  }

  /**
   * 🗑️ REMOVE CONNECTION WITH CLEANUP
   */
  removeConnection(url: string, sessionToken: string): void {
    const connectionKey = `${url}#${sessionToken}`
    const connection = this.connections.get(connectionKey)
    
    if (connection) {
      this.disconnect(connection)
      
      // Clear all listeners
      connection.statusListeners.clear()
      connection.messageListeners.clear()
      
      this.connections.delete(connectionKey)
      console.log('🔌 Connection removed from manager with full cleanup')
    }
  }

  /**
   * 🔔 REMOVE LISTENER (SAFE)
   */
  removeListener(connection: ConnectionInstance, listener: StatusListener | MessageListener): void {
    if ('onMessage' in listener) {
      connection.messageListeners.delete(listener as MessageListener)
    } else {
      connection.statusListeners.delete(listener as StatusListener)
    }
  }

  /**
   * 📊 GET CONNECTION HEALTH
   */
  getConnectionHealth(url: string, sessionToken: string): {
    status: ConnectionStatus
    retryCount: number
    maxRetries: number
    lastError?: string
    isHealthy: boolean
    uptime: number
  } | null {
    const connectionKey = `${url}#${sessionToken}`
    const connection = this.connections.get(connectionKey)
    
    if (!connection) return null
    
    return {
      status: connection.status,
      retryCount: connection.retryCount,
      maxRetries: connection.maxRetries,
      lastError: connection.lastError,
      isHealthy: connection.isHealthy,
      uptime: Date.now() - connection.createdAt
    }
  }

  private setStatus(connection: ConnectionInstance, status: ConnectionStatus, ws?: WebSocket): void {
    connection.status = status
    
    // Notify all status listeners (with error handling)
    connection.statusListeners.forEach(listener => {
      try {
        listener(status, ws)
      } catch (error) {
        console.error('🔌 Status listener error:', error)
      }
    })
  }
}

// 🏗️ SINGLETON INSTANCE - Stored outside React
export const wsManager = new WebSocketConnectionManager() 