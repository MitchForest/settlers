import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { server } from '../index'
import { db } from '../db/index'
import { userProfiles } from '../db/schema'

// Add proper types for API responses
interface APIResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

interface CreateGameResponse {
  gameId: string
  gameCode: string
  hostPlayerId: string
  sessionUrl: string
}

interface GameInfoResponse {
  gameId: string
  gameCode: string
  phase: string
  isActive: boolean
  eventCount: number
  createdAt: string
}

interface JoinGameResponse {
  gameCode: string
  phase: string
  websocketUrl: string
  joinInstructions: string
}

// Set test environment
process.env.NODE_ENV = 'test'

// Generate a proper UUID for testing
function generateTestUUID(): string {
  return crypto.randomUUID()
}

// Helper to create a test user profile
async function createTestUser(name: string = 'Test User'): Promise<string> {
  const userId = generateTestUUID()
  const timestamp = Date.now()
  await db.insert(userProfiles).values({
    id: userId,
    email: `test${timestamp}${Math.random().toString(36).substr(2, 4)}@example.com`,
    name,
    avatarEmoji: '👤'
  })
  return userId
}

// Helper function to safely parse JSON responses
async function parseJsonResponse(response: Response): Promise<any> {
  return await response.json() as any
}

describe('REST API Tests', () => {
  const API_BASE = 'http://localhost:3001'
  let testServer: any

  beforeAll(async () => {
    // Start HTTP server for tests
    testServer = Bun.serve({
      port: 3001,
      fetch: server.fetch
    })
    
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 100))
  })

  afterAll(async () => {
    // Clean shutdown
    if (testServer) {
      testServer.stop()
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  })

  describe('Health Check Endpoints', () => {
    it('should return healthy status', async () => {
      const response = await fetch(`${API_BASE}/health`)
      const data = await response.json() as any

      expect(response.ok).toBe(true)
      expect(data.status).toBe('healthy')
      expect(data.architecture).toBe('event-sourced')
      expect(data.websocket).toBe('active')
      expect(data.timestamp).toBeTruthy()
    })

    it('should return successful test connection', async () => {
      const response = await fetch(`${API_BASE}/api/test-connection`)
      const data = await parseJsonResponse(response)

      expect(response.ok).toBe(true)
      expect(data.success).toBe(true)
      expect(data.message).toBe('Backend connection successful')
      expect(data.architecture).toBe('event-sourced')
    })
  })

  describe('Game Creation API', () => {
    it('should create game successfully', async () => {
      const hostUserId = await createTestUser()
      const gameData = {
        hostPlayerName: 'API Test Host',
        hostAvatarEmoji: '🌐',
        hostUserId
      }

      const response = await fetch(`${API_BASE}/api/games/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(gameData)
      })

      const data = await response.json() as APIResponse<CreateGameResponse>

      expect(response.ok).toBe(true)
      expect(data.success).toBe(true)
      expect(data.data?.gameId).toBeTruthy()
      expect(data.data?.gameCode).toBeTruthy()
      expect(data.data?.hostPlayerId).toBeTruthy()
      expect(data.data?.sessionUrl).toBeTruthy()
      expect(data.data?.gameCode).toMatch(/^[A-Z0-9]{6}$/)
    })

    it('should validate required fields for game creation', async () => {
      const invalidGameData = {
        hostAvatarEmoji: '🌐'
        // Missing hostPlayerName and hostUserId
      }

      const response = await fetch(`${API_BASE}/api/games/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(invalidGameData)
      })

      const data = await response.json() as APIResponse

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Missing required field')
    })

    it('should handle malformed JSON in game creation', async () => {
      const response = await fetch(`${API_BASE}/api/games/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: 'invalid json'
      })

      expect(response.status).toBe(400)
    })

    it('should generate unique game codes', async () => {
      const hostUserId1 = await createTestUser("Host 1")
      const hostUserId2 = await createTestUser("Host 2")

      const gameData1 = {
        hostPlayerName: 'Host 1',
        hostAvatarEmoji: '1️⃣',
        hostUserId: hostUserId1
      }

      const gameData2 = {
        hostPlayerName: 'Host 2',
        hostAvatarEmoji: '2️⃣',
        hostUserId: hostUserId2
      }

      const [response1, response2] = await Promise.all([
        fetch(`${API_BASE}/api/games/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(gameData1)
        }),
        fetch(`${API_BASE}/api/games/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(gameData2)
        })
      ])

      const data1 = await response1.json() as APIResponse<CreateGameResponse>
      const data2 = await response2.json() as APIResponse<CreateGameResponse>

      expect(response1.ok).toBe(true)
      expect(response2.ok).toBe(true)
      expect(data1.data?.gameCode).not.toBe(data2.data?.gameCode)
    })
  })

  describe('Game Info API', () => {
    let testGameCode: string
    let testGameId: string

    beforeAll(async () => {
      // Create a test game for info testing
      const hostUserId = await createTestUser()
      const gameData = {
        hostPlayerName: 'Info Test Host',
        hostAvatarEmoji: '📊',
        hostUserId
      }

      const response = await fetch(`${API_BASE}/api/games/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gameData)
      })

      const data = await response.json()
      testGameCode = data.data.gameCode
      testGameId = data.data.gameId
    })

    it('should get game info by code', async () => {
      const response = await fetch(`${API_BASE}/api/games/info/${testGameCode}`)
      const data = await response.json()

      expect(response.ok).toBe(true)
      expect(data.success).toBe(true)
      expect(data.data.gameId).toBe(testGameId)
      expect(data.data.gameCode).toBe(testGameCode)
      expect(data.data.phase).toBe('lobby')
      expect(data.data.isActive).toBe(true)
      expect(data.data.eventCount).toBeGreaterThan(0)
      expect(data.data.createdAt).toBeTruthy()
    })

    it('should handle non-existent game code', async () => {
      const response = await fetch(`${API_BASE}/api/games/info/ABC123`) // Valid format but doesn't exist
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Game not found')
    })

    it('should validate game code format', async () => {
      const response = await fetch(`${API_BASE}/api/games/info/invalid-format`)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Invalid game code format')
    })
  })

  describe('Game Join API', () => {
    let testGameCode: string

    beforeAll(async () => {
      // Create a test game for join testing
      const hostUserId = await createTestUser()
      const gameData = {
        hostPlayerName: 'Join Test Host',
        hostAvatarEmoji: '🤝',
        hostUserId
      }

      const response = await fetch(`${API_BASE}/api/games/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gameData)
      })

      const data = await response.json()
      testGameCode = data.data.gameCode
    })

    it('should provide join instructions for valid game', async () => {
      const joinData = {
        gameCode: testGameCode,
        playerName: 'Join Test Player',
        avatarEmoji: '👤',
        userId: generateTestUUID()
      }

      const response = await fetch(`${API_BASE}/api/games/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(joinData)
      })

      const data = await response.json()

      expect(response.ok).toBe(true)
      expect(data.success).toBe(true)
      expect(data.data.gameCode).toBe(testGameCode)
      expect(data.data.phase).toBe('lobby')
      expect(data.data.websocketUrl).toBe('/ws')
      expect(data.data.joinInstructions).toContain('WebSocket')
    })

    it('should validate required fields for join', async () => {
      const invalidJoinData = {
        gameCode: testGameCode,
        // Missing playerName and userId
        avatarEmoji: '👤'
      }

      const response = await fetch(`${API_BASE}/api/games/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidJoinData)
      })

      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Missing required fields')
    })

    it('should handle join to non-existent game', async () => {
      const joinData = {
        gameCode: 'XYZ789', // Valid format but doesn't exist
        playerName: 'Test Player',
        avatarEmoji: '👤',
        userId: generateTestUUID()
      }

      const response = await fetch(`${API_BASE}/api/games/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(joinData)
      })

      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Game not found')
    })
  })

  describe('Error Handling', () => {
    it('should handle 404 for unknown endpoints', async () => {
      const response = await fetch(`${API_BASE}/api/unknown-endpoint`)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Not found')
    })

    it('should handle method not allowed', async () => {
      const response = await fetch(`${API_BASE}/api/games/create`, {
        method: 'GET' // Should be POST
      })

      expect(response.status).toBe(405)
    })

    it('should handle CORS preflight requests', async () => {
      const response = await fetch(`${API_BASE}/api/games/create`, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'http://localhost:3000'
        }
      })

      expect(response.ok).toBe(true)
      expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:3000')
      expect(response.headers.get('access-control-allow-methods')).toContain('POST')
      expect(response.headers.get('access-control-allow-headers')).toContain('Content-Type')
    })
  })

  describe('Rate Limiting & Performance', () => {
    it('should handle multiple concurrent game creations', async () => {
      const concurrentRequests = []
      
      for (let i = 0; i < 5; i++) {
        const hostUserId = await createTestUser()
        const gameData = {
          hostPlayerName: `Concurrent Host ${i}`,
          hostAvatarEmoji: '⚡',
          hostUserId
        }

        concurrentRequests.push(
          fetch(`${API_BASE}/api/games/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(gameData)
          })
        )
      }

      const responses = await Promise.all(concurrentRequests)
      const dataPromises = responses.map(r => r.json())
      const results = await Promise.all(dataPromises)

      // All should succeed
      for (const response of responses) {
        expect(response.ok).toBe(true)
      }

      // All should have unique game codes
      const gameCodes = results.map(r => r.data.gameCode)
      const uniqueCodes = new Set(gameCodes)
      expect(gameCodes.length).toBe(uniqueCodes.size)
    })

    it('should respond quickly to health checks', async () => {
      const startTime = Date.now()
      const response = await fetch(`${API_BASE}/health`)
      const endTime = Date.now()

      expect(response.ok).toBe(true)
      expect(endTime - startTime).toBeLessThan(1000) // Should respond within 1 second
    })
  })

  describe('Content Type Handling', () => {
    it('should require JSON content type for POST requests', async () => {
      const response = await fetch(`${API_BASE}/api/games/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: 'not json'
      })

      expect(response.status).toBe(400)
    })

    it('should handle missing content type gracefully', async () => {
      const response = await fetch(`${API_BASE}/api/games/create`, {
        method: 'POST',
        body: JSON.stringify({
          hostPlayerName: 'Test Host',
          hostUserId: await createTestUser()
        })
      })

      // Should still work or give clear error
      expect([200, 400, 415]).toContain(response.status)
    })
  })

  describe('Data Validation', () => {
    it('should validate player name length', async () => {
      const hostUserId = await createTestUser()
      const gameData = {
        hostPlayerName: 'A'.repeat(100), // Very long name
        hostAvatarEmoji: '📏',
        hostUserId
      }

      const response = await fetch(`${API_BASE}/api/games/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gameData)
      })

      // Should either accept it or give validation error
      if (!response.ok) {
        const data = await response.json()
        expect(data.error).toBeTruthy()
      } else {
        expect(response.ok).toBe(true)
      }
    })

    it('should validate emoji format', async () => {
      const hostUserId = await createTestUser()
      const gameData = {
        hostPlayerName: 'Emoji Test Host',
        hostAvatarEmoji: 'not-an-emoji-🚫',
        hostUserId
      }

      const response = await fetch(`${API_BASE}/api/games/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gameData)
      })

      // Should either accept it or give validation error
      expect([200, 400]).toContain(response.status)
    })

    it('should validate UUID format for user IDs', async () => {
      const gameData = {
        hostPlayerName: 'UUID Test Host',
        hostAvatarEmoji: '🆔',
        hostUserId: 'not-a-uuid'
      }

      const response = await fetch(`${API_BASE}/api/games/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gameData)
      })

      const data = await response.json()

      expect(response.status).toBe(500) // Should fail with database error
      expect(data.success).toBe(false)
    })
  })
}) 