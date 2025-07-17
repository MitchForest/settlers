import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createBunWebSocket } from 'hono/bun'

/**
 * WebSocket utilities with type support
 */
interface WSData {
  gameId: string | null
  playerId: string | null
}

const { upgradeWebSocket, websocket } = createBunWebSocket<WSData>()

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
 * Health check endpoint
 */
app.get('/health', (c) => {
  return c.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    message: 'Minimal backend is working'
  })
})

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
 * WebSocket endpoint
 */
app.get('/ws', upgradeWebSocket((c) => {
  const url = new URL(c.req.url)
  const gameId = url.searchParams.get('gameId')
  const playerId = url.searchParams.get('playerId')
  
  console.log(`🔌 WebSocket connection attempt: gameId=${gameId}, playerId=${playerId}`)
  
  return {
    onOpen(event, ws) {
      console.log(`🔌 WebSocket opened: ${playerId} joined game ${gameId}`)
      // Store connection metadata on the raw WebSocket
      if ('raw' in ws && ws.raw) {
        (ws.raw as any).data = { gameId, playerId }
      }
    },
    
    onMessage(event, ws) {
      try {
        const message = JSON.parse(event.data.toString())
        const wsData = ('raw' in ws && ws.raw) ? (ws.raw as any).data : null
        console.log(`📨 WebSocket message from ${wsData?.playerId}:`, message)
        
        // Echo back for now
        ws.send(JSON.stringify({
          type: 'echo',
          originalMessage: message,
          timestamp: new Date().toISOString()
        }))
      } catch (error) {
        console.error('❌ WebSocket message error:', error)
        ws.send(JSON.stringify({
          type: 'error',
          error: 'Invalid message format'
        }))
      }
    },
    
    onClose(event, ws) {
      const wsData = ('raw' in ws && ws.raw) ? (ws.raw as any).data : null
      console.log(`🔌 WebSocket closed: ${wsData?.playerId} left game ${wsData?.gameId}`)
    },
    
    onError(event, ws) {
      console.error('❌ WebSocket error:', event)
    }
  }
}))

/**
 * Add game routes dynamically
 */
setTimeout(async () => {
  try {
    const gameRoutes = await import('./routes/games')
    app.route('/api', gameRoutes.default)
    console.log('✅ Game routes loaded successfully')
  } catch (error) {
    console.error('❌ Failed to load game routes:', error)
  }
}, 100)

/**
 * Start minimal server
 */
const PORT = Number(process.env.PORT) || 4000

console.log(`🚀 Starting ULTRA MINIMAL backend on port ${PORT}`)

const server = Bun.serve({
  port: PORT,
  idleTimeout: 120,
  fetch: app.fetch,
  websocket
})

console.log(`✅ Server started at http://localhost:${PORT}`)
console.log(`🔌 WebSocket available at ws://localhost:${PORT}/ws`)

export default server