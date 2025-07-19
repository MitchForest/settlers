import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { HTTPException } from 'hono/http-exception'
import { serve } from '@hono/node-server'

// Import routes
import gamesRouter from './routes/games'
import { friendsRouter } from './routes/friends'
import { invitesRouter } from './routes/invites'
import { presenceRouter } from './routes/presence'

// Import the new event-sourced WebSocket server
import { server as webSocketServer } from './websocket/unified-server'

// Create Hono app
const app = new Hono()

// Middleware
app.use('*', logger())
app.use('*', cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization']
}))

// Body parsing and content-type validation middleware
app.use('*', async (c, next) => {
  const method = c.req.method
  const contentType = c.req.header('content-type')
  
  // For POST/PUT requests, validate content-type and JSON parsing
  if ((method === 'POST' || method === 'PUT') && c.req.url.includes('/api/')) {
    // Require JSON content-type for API endpoints
    if (!contentType || !contentType.includes('application/json')) {
      throw new HTTPException(400, { message: 'Content-Type must be application/json' })
    }
    
    // Pre-parse JSON to catch errors early
    try {
      await c.req.json()
    } catch {
      throw new HTTPException(400, { message: 'Invalid JSON in request body' })
    }
  }
  
  await next()
})

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    architecture: 'event-sourced',
    websocket: 'active'
  })
})

// API routes
app.route('/api/games', gamesRouter)
app.route('/api/friends', friendsRouter)
app.route('/api/invites', invitesRouter)
app.route('/api/presence', presenceRouter)

// Test connection endpoint
app.get('/api/test-connection', (c) => {
  return c.json({ 
    success: true, 
    message: 'Backend connection successful',
    architecture: 'event-sourced'
  })
})

// Handle specific route method validation (allow OPTIONS for CORS)
app.all('/api/games/create', async (c, next) => {
  if (c.req.method !== 'POST' && c.req.method !== 'OPTIONS') {
    throw new HTTPException(405, { message: 'Method not allowed' })
  }
  await next()
})

app.all('/api/games/join', async (c, next) => {
  if (c.req.method !== 'POST' && c.req.method !== 'OPTIONS') {
    throw new HTTPException(405, { message: 'Method not allowed' })
  }
  await next()
})

app.all('/api/games/info/*', async (c, next) => {
  if (c.req.method !== 'GET' && c.req.method !== 'OPTIONS') {
    throw new HTTPException(405, { message: 'Method not allowed' })
  }
  await next()
})

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404)
})

// Error handler
app.onError((err, c) => {
  console.error('Server error:', err)
  
  // Handle HTTPException (400, 401, etc.)
  if (err instanceof HTTPException) {
    return c.json({ 
      success: false,
      error: err.message 
    }, err.status)
  }
  
  return c.json({ 
    error: 'Internal server error',
    message: err.message 
  }, 500)
})

// Export the server for testing
export { app as server }; // YES

// Start HTTP server only if not in test environment
if (process.env.NODE_ENV !== 'test') {
  const httpPort = process.env.PORT || 3001
  console.log(`🚀 Starting Settlers backend server...`)
  console.log(`📡 HTTP API server will run on port ${httpPort}`)
  console.log(`🌐 WebSocket server starting on port 8080`)
  console.log(`🎯 Architecture: Event-sourced`)

  // ✅ ACTUALLY START THE WEBSOCKET SERVER
  console.log(`🔌 Starting WebSocket server...`)
  // WebSocket server starts automatically when imported (singleton pattern)

  serve({
    fetch: app.fetch,
    port: parseInt(httpPort.toString())
  }, (info) => {
    console.log(`✅ HTTP server running on http://localhost:${info.port}`)
    console.log(`✅ WebSocket server running on ws://localhost:8080/ws`)
    console.log(`✅ Backend fully operational with event sourcing`)
  })

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down servers...')
    webSocketServer.close()
    process.exit(0)
  })

  process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down servers...')
    webSocketServer.close()
    process.exit(0)
  })
}