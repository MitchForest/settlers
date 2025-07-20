// Bun-native unified server with HTTP + WebSocket support
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { HTTPException } from 'hono/http-exception'

// Import UNIFIED routes ONLY (ZERO TECHNICAL DEBT)
import unifiedGamesRouter from './unified/routes/unified-games-routes'

// Import the UNIFIED WebSocket server (ZERO TECHNICAL DEBT)
import { unifiedWebSocketServer } from './unified/websocket/unified-websocket-server'

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

// UNIFIED API routes (ZERO TECHNICAL DEBT)
app.route('/api/unified/games', unifiedGamesRouter)

// Redirect legacy routes to unified endpoints
app.all('/api/friends', (c) => {
  return c.json({ 
    error: 'Legacy route deprecated. Use unified WebSocket system for friend management.',
    migration: 'All friend operations now handled through real-time WebSocket connections.'
  }, 410)
})

app.all('/api/friends/*', (c) => {
  return c.json({ 
    error: 'Legacy route deprecated. Use unified WebSocket system for friend management.',
    migration: 'All friend operations now handled through real-time WebSocket connections.'
  }, 410)
})

app.all('/api/invites', (c) => {
  return c.json({ 
    error: 'Legacy route deprecated. Use unified game system for invites.',
    migration: 'Game invites now handled through unified game management system.'
  }, 410)
})

app.all('/api/invites/*', (c) => {
  return c.json({ 
    error: 'Legacy route deprecated. Use unified game system for invites.',
    migration: 'Game invites now handled through unified game management system.'
  }, 410)
})

app.all('/api/presence', (c) => {
  return c.json({ 
    error: 'Legacy route deprecated. Use unified WebSocket system for presence.',
    migration: 'User presence now handled through real-time WebSocket connections.'
  }, 410)
})

app.all('/api/presence/*', (c) => {
  return c.json({ 
    error: 'Legacy route deprecated. Use unified WebSocket system for presence.',
    migration: 'User presence now handled through real-time WebSocket connections.'
  }, 410)
})

app.all('/api/games', (c) => {
  return c.json({ 
    error: 'Legacy route deprecated. Use /api/unified/games',
    migration: 'All game operations migrated to unified event-sourced system.'
  }, 410)
})

app.all('/api/games/*', (c) => {
  return c.json({ 
    error: 'Legacy route deprecated. Use /api/unified/games',
    migration: 'All game operations migrated to unified event-sourced system.'
  }, 410)
})

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
        console.log('🔌 WebSocket upgrade request received:', { pathname: url.pathname, params: Array.from(url.searchParams.entries()) })
        
        const token = url.searchParams.get('token')
        const gameId = url.searchParams.get('gameId')
        
        console.log('🔌 WebSocket parameters:', { hasToken: !!token, hasGameId: !!gameId, gameId })
        
        if (!token || !gameId) {
          console.error('❌ WebSocket upgrade rejected: Missing token or gameId')
          return new Response('Missing token or gameId', { status: 401 })
        }

        // Validate Supabase JWT token
        const { SupabaseJWTValidator } = await import('./auth/jwt-validator')
        const { valid, user, error } = await SupabaseJWTValidator.validateToken(token)
        
        if (!valid || !user) {
          return new Response(`Authentication failed: ${error}`, { status: 401 })
        }

        // Create session payload with validated user
        const sessionPayload = {
          gameId,
          user,
          role: 'player' as const,
          permissions: ['game_actions']
        }

        // Upgrade the connection with validated session data
        console.log('🔌 Attempting WebSocket upgrade...')
        const success = server.upgrade(req, { data: { session: sessionPayload, token } })
        console.log('🔌 WebSocket upgrade result:', success)
        
        if (success) {
          console.log('✅ WebSocket upgrade successful')
          return // Connection upgraded successfully
        } else {
          console.error('❌ WebSocket upgrade failed')
          return new Response('Upgrade failed', { status: 400 })
        }
      }
      
      // Handle regular HTTP requests with Hono
      return app.fetch(req)
    },
    
    websocket: {
      open: async (ws) => {
        console.log('🔌 Unified WebSocket opened successfully')
        await unifiedWebSocketServer.handleOpen(ws)
      },
      
      message: async (ws, message) => {
        console.log('🔌 Unified WebSocket message received:', message.toString())
        await unifiedWebSocketServer.handleMessage(ws, message.toString())
      },
      
      close: (ws) => {
        console.log('🔌 Unified WebSocket closed')
        unifiedWebSocketServer.handleClose(ws)
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