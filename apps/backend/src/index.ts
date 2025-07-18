import { Hono } from 'hono'
import { cors } from 'hono/cors'
import gameRoutes from './routes/games'
import { websocketHandler, upgradeWebSocket as wsUpgrade, type WSData } from './websocket/server'

/**
 * Initialize Hono app - ULTRA MINIMAL VERSION
 */
const app = new Hono()

// Enable CORS
app.use('/*', cors({
  origin: 'http://localhost:3000',
  credentials: true
}))

/**
 * Test endpoint
 */
app.get('/api/test', (c) => {
  return c.json({ 
    message: 'Ultra minimal backend is working!',
    timestamp: new Date().toISOString()
  })
})

/**
 * Health check endpoint with database
 */
app.get('/health', async (c) => {
  try {
    // Import db dynamically to avoid circular dependency
    const { db } = await import('./db')
    const { sql } = await import('drizzle-orm')
    
    // Test database connection with timeout
    const dbTest = await Promise.race([
      db.execute(sql`SELECT 1`),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database timeout')), 5000)
      )
    ])
    
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
 * Mount game routes
 */
app.route('/api/games', gameRoutes)
console.log('✅ Game routes mounted successfully')

/**
 * Start minimal server
 */
const PORT = Number(process.env.PORT) || 4000

console.log(`🚀 Starting ULTRA MINIMAL backend on port ${PORT}`)

const server = Bun.serve({
  port: PORT,
  idleTimeout: 120,
  fetch(req: Request): Response | Promise<Response> {
    // Handle WebSocket upgrade
    if (req.url.includes('/ws')) {
      const upgrade = wsUpgrade(req, server)
      if (upgrade) return upgrade
    }
    
    // Handle regular HTTP requests
    return app.fetch(req)
  },
  websocket: websocketHandler
})

console.log(`✅ Server started at http://localhost:${PORT}`)
console.log(`🔌 WebSocket available at ws://localhost:${PORT}/ws`)

export { server }