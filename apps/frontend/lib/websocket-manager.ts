// ===== RELIABLE WEBSOCKET CONNECTION MANAGER =====
// Implements exponential backoff reconnection, message queuing, and graceful degradation

export interface WebSocketMessage {
  type: string
  data?: unknown
  timestamp?: number
  id?: string
}

export interface WebSocketOptions {
  url: string
  reconnectInterval?: number
  maxReconnectAttempts?: number
  heartbeatInterval?: number
  messageTimeout?: number
  enableMessageQueue?: boolean
  maxQueueSize?: number
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error' | 'offline'

export interface WebSocketManagerEvents {
  onopen: (event: Event) => void
  onmessage: (message: WebSocketMessage) => void
  onclose: (event: CloseEvent) => void
  onerror: (error: Error) => void
  onstatuschange: (status: ConnectionStatus) => void
}

export class ReliableWebSocketManager {
  private ws: WebSocket | null = null
  private options: Required<WebSocketOptions>
  private events: Partial<WebSocketManagerEvents> = {}
  private status: ConnectionStatus = 'disconnected'
  private reconnectAttempts = 0
  private reconnectTimer: NodeJS.Timeout | null = null
  private heartbeatTimer: NodeJS.Timeout | null = null
  private messageQueue: WebSocketMessage[] = []
  private lastHeartbeat = 0
  private isManualDisconnect = false

  constructor(options: WebSocketOptions) {
    this.options = {
      reconnectInterval: 1000,
      maxReconnectAttempts: 5,
      heartbeatInterval: 30000,
      messageTimeout: 5000,
      enableMessageQueue: true,
      maxQueueSize: 50,
      ...options
    }
  }

  /**
   * Register event handlers
   */
  on<K extends keyof WebSocketManagerEvents>(
    event: K,
    handler: WebSocketManagerEvents[K]
  ): void {
    this.events[event] = handler
  }

  /**
   * Connect to WebSocket server
   */
  async connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return
    }

    this.isManualDisconnect = false
    this.setStatus('connecting')
    
    try {
      this.ws = new WebSocket(this.options.url)
      this.setupEventHandlers()
    } catch (error) {
      this.handleError(new Error(`Failed to create WebSocket: ${error}`))
      this.scheduleReconnect()
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.isManualDisconnect = true
    this.clearTimers()
    
    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect')
      this.ws = null
    }
    
    this.setStatus('disconnected')
  }

  /**
   * Send message to server
   */
  send(message: WebSocketMessage): boolean {
    // Add timestamp and ID if not present
    const messageWithMeta = {
      ...message,
      timestamp: message.timestamp || Date.now(),
      id: message.id || this.generateMessageId()
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(messageWithMeta))
        return true
      } catch (error) {
        this.handleError(new Error(`Failed to send message: ${error}`))
        this.queueMessage(messageWithMeta)
        return false
      }
    } else {
      this.queueMessage(messageWithMeta)
      return false
    }
  }

  /**
   * Get current connection status
   */
  getStatus(): ConnectionStatus {
    return this.status
  }

  /**
   * Check if connection is healthy
   */
  isHealthy(): boolean {
    return this.status === 'connected' && 
           this.ws?.readyState === WebSocket.OPEN &&
           (Date.now() - this.lastHeartbeat) < (this.options.heartbeatInterval * 2)
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.messageQueue.length
  }

  private setupEventHandlers(): void {
    if (!this.ws) return

    this.ws.onopen = (event) => {
      this.reconnectAttempts = 0
      this.setStatus('connected')
      this.startHeartbeat()
      this.flushMessageQueue()
      this.events.onopen?.(event)
    }

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        this.lastHeartbeat = Date.now()
        
        // Handle heartbeat responses
        if (message.type === 'pong') {
          return
        }
        
        this.events.onmessage?.(message)
      } catch (error) {
        this.handleError(new Error(`Failed to parse message: ${error}`))
      }
    }

    this.ws.onclose = (event) => {
      this.clearTimers()
      this.setStatus('disconnected')
      this.events.onclose?.(event)
      
      // Auto-reconnect if not a manual disconnect
      if (!this.isManualDisconnect) {
        this.scheduleReconnect()
      }
    }

    this.ws.onerror = (_event) => {
      this.handleError(new Error('WebSocket error occurred'))
    }
  }

  private setStatus(status: ConnectionStatus): void {
    if (this.status !== status) {
      this.status = status
      this.events.onstatuschange?.(status)
    }
  }

  private handleError(error: Error): void {
    console.error('WebSocket error:', error)
    this.setStatus('error')
    this.events.onerror?.(error)
  }

  private scheduleReconnect(): void {
    if (this.isManualDisconnect || this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      this.setStatus('offline')
      return
    }

    // Exponential backoff with jitter
    const delay = Math.min(
      this.options.reconnectInterval * Math.pow(2, this.reconnectAttempts),
      30000
    ) + Math.random() * 1000

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++
      this.connect()
    }, delay)

    console.log(`Reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts + 1}/${this.options.maxReconnectAttempts})`)
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' })
      }
    }, this.options.heartbeatInterval)
  }

  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private queueMessage(message: WebSocketMessage): void {
    if (!this.options.enableMessageQueue) return

    this.messageQueue.push(message)
    
    // Maintain queue size limit
    if (this.messageQueue.length > this.options.maxQueueSize) {
      this.messageQueue.shift()
    }
  }

  private flushMessageQueue(): void {
    if (this.messageQueue.length === 0) return

    console.log(`Flushing ${this.messageQueue.length} queued messages`)
    
    const messages = [...this.messageQueue]
    this.messageQueue = []
    
    messages.forEach(message => {
      this.send(message)
    })
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}