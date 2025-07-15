import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { sql } from 'drizzle-orm'

// Import db first to avoid circular dependencies
import { db } from './db'

// Import modules that depend on db after db is imported
import { websocketHandlers, upgradeWebSocket } from './websocket/server'
import gameRoutes from './routes/games'

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

// Create Bun server with WebSocket support
const server = Bun.serve({
  port: PORT,
  fetch(req, server) {
    // Handle WebSocket upgrade
    const url = new URL(req.url)
    if (url.pathname === '/ws') {
      return upgradeWebSocket(req, server) || new Response('Upgrade failed', { status: 400 })
    }
    
    // Handle regular HTTP requests with Hono
    return app.fetch(req, server)
  },
  websocket: websocketHandlers
})

console.log(`🚀 Starting Settlers backend server on port ${PORT}`)
console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`)
console.log(`🔌 WebSocket endpoint: ws://localhost:${PORT}/ws`)
console.log(`📡 API endpoints: http://localhost:${PORT}/api/*`)

export default server