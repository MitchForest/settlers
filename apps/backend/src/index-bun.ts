// Bun-native unified server with HTTP + WebSocket support
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { HTTPException } from 'hono/http-exception'

// Import routes
import gamesRouter from './routes/games'
import { friendsRouter } from './routes/friends'
import { invitesRouter } from './routes/invites'
import { presenceRouter } from './routes/presence'

// Import the Bun unified server
import { bunUnifiedServer } from './bun-unified-server'

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
    architecture: 'bun-native-unified',
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
    message: 'Bun unified server connection successful',
    architecture: 'bun-native-unified'
  })
})

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404)
})

// Error handler
app.onError((err, c) => {
  console.error('Server error:', err)
  
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

// Start unified Bun server with HTTP + WebSocket
if (process.env.NODE_ENV !== 'test') {
  const port = parseInt(process.env.PORT || '4000')
  
  console.log('🚀 Starting Bun unified server...')
  console.log('📡 HTTP + WebSocket server on port', port)
  console.log('🎯 Architecture: Bun-native unified')

  const server = Bun.serve({
    port,
    async fetch(req, server) {
      const url = new URL(req.url)
      
      // Handle WebSocket upgrade requests
      if (url.pathname === '/ws') {
        return await bunUnifiedServer.handleUpgrade(req)
      }
      
      // Handle regular HTTP requests with Hono
      return app.fetch(req)
    },
    
    websocket: {
      open: async (ws) => {
        await bunUnifiedServer.handleOpen(ws)
      },
      
      message: async (ws, message) => {
        await bunUnifiedServer.handleMessage(ws, message.toString())
      },
      
      close: (ws) => {
        bunUnifiedServer.handleClose(ws)
      },
    },
  })

  console.log(`✅ Bun unified server running on http://localhost:${port}`)
  console.log(`✅ WebSocket endpoint: ws://localhost:${port}/ws`)
  console.log(`✅ Architecture: Bun-native unified server`)

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down Bun unified server...')
    server.stop()
    process.exit(0)
  })

  process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down Bun unified server...')
    server.stop()
    process.exit(0)
  })
}

export { app }