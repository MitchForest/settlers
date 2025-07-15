import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { sql } from 'drizzle-orm'
import { db } from './db'

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
 * Error handling middleware
 */
app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return c.json({ error: 'Internal server error' }, 500)
})

/**
 * Start server
 */
const PORT = Number(process.env.PORT) || 4000

console.log(`🚀 Starting Settlers backend server on port ${PORT}`)
console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`)

export default {
  port: PORT,
  fetch: app.fetch
}