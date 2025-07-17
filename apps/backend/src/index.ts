import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createBunWebSocket } from 'hono/bun'
import { sql } from 'drizzle-orm'
import type { ServerWebSocket } from 'bun'
import type { Context } from 'hono'

// Import db first to avoid circular dependencies
import { db } from './db'

// Import modules that depend on db after db is imported
import { websocketHandler } from './websocket/server'
import gameRoutes from './routes/games'

/**
 * Create Bun WebSocket utilities
 */
const { upgradeWebSocket, websocket } = createBunWebSocket<ServerWebSocket>()

/**
 * CORS configuration
 */
const CORS_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001', 
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:3004',
  process.env.FRONTEND_URL || 'http://localhost:3000'
]

/**
 * Initialize Hono app
 */
const app = new Hono()

// Enable CORS for HTTP routes
app.use('/*', cors({
  origin: CORS_ORIGINS,
  credentials: true
}))

/**
 * Health check endpoint
 */
app.get('/health', async (c) => {
  try {
    // Test database connection
    await db.execute(sql`SELECT 1`)
    
    return c.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      database: true,
      message: 'Backend is healthy'
    })
  } catch (error) {
    console.error('Health check failed:', error)
    return c.json({ 
      status: 'error', 
      timestamp: new Date().toISOString(),
      database: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

/**
 * Test endpoint
 */
app.get('/api/test', (c) => {
  return c.json({ 
    message: 'Settlers backend is working!',
    timestamp: new Date().toISOString()
  })
})

/**
 * Game routes
 */
app.route('/api/games', gameRoutes)

/**
 * WebSocket endpoint - now handled by Hono
 */
app.get('/ws', upgradeWebSocket((c: Context) => {
  const url = new URL(c.req.url)
  const sessionId = url.searchParams.get('sessionId') || crypto.randomUUID()
  const gameId = url.searchParams.get('gameId') || undefined
  const playerId = url.searchParams.get('playerId') || undefined
  
  return {
    onOpen(event: Event, ws: any) {
      // Set up WebSocket data context using Bun's native data property
      if (ws.raw) {
        ws.raw.data = {
          sessionId,
          gameId,
          playerId,
          isSpectator: false,
          isInLobby: false
        }
      }
      
      // Call the existing WebSocket handler's open logic
      if (websocketHandler.open && ws.raw) {
        websocketHandler.open(ws.raw)
      }
    },
    onMessage(event: MessageEvent, ws: any) {
      // Call the existing WebSocket handler's message logic
      if (websocketHandler.message && ws.raw) {
        websocketHandler.message(ws.raw, event.data)
      }
    },
    onClose(event: CloseEvent, ws: any) {
      // Call the existing WebSocket handler's close logic
      if (websocketHandler.close && ws.raw) {
        websocketHandler.close(ws.raw, event.code, event.reason)
      }
    },
    onError(event: Event, ws: any) {
      console.error('WebSocket error:', event)
    }
  }
}))

/**
 * Error handling middleware
 */
app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return c.json({ error: 'Internal server error' }, 500)
})

/**
 * Start server with WebSocket support
 */
const PORT = Number(process.env.PORT) || 4000

console.log(`🚀 Starting Settlers backend server on port ${PORT}`)
console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`)
console.log(`🔌 WebSocket endpoint: ws://localhost:${PORT}/ws`)
console.log(`📡 API endpoints: http://localhost:${PORT}/api/*`)
console.log(`Started development server: http://localhost:${PORT}`)

export default {
  port: PORT,
  fetch: app.fetch,
  websocket
}