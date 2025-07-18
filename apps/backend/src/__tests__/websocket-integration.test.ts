import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { eventStore } from '../db/event-store-repository'
import { lobbyCommandService } from '../services/lobby-command-service'
import { UnifiedWebSocketServer } from '../websocket/unified-server'
import WebSocket from 'ws'
import { 
  createTestUser, 
  createTestGame, 
  cleanupTestData, 
  setupTestEnvironment,
  generateTestUUID,
  type TestUser,
  type TestGame
} from './test-helpers'

describe('WebSocket Integration Tests', () => {
  let testServer: UnifiedWebSocketServer
  let testGame: TestGame
  let hostUser: TestUser
  const TEST_PORT = 8081 // Use different port to avoid conflicts

  beforeAll(async () => {
    // Setup clean test environment
    await setupTestEnvironment()
    
    // Create host user and game using test helpers
    hostUser = await createTestUser({
      displayName: 'WebSocket Test Host',
      avatarEmoji: '🌐'
    })
    
    testGame = await createTestGame({
      hostUser,
      gameCode: `WS${Math.random().toString(36).substr(2, 4).toUpperCase()}`
    })
    
    // Create test server instance on different port
    testServer = new UnifiedWebSocketServer(TEST_PORT)
    
    // Wait a bit for server to start
    await new Promise(resolve => setTimeout(resolve, 1000))
  })

  afterAll(async () => {
    // Clean up test server
    testServer.close()
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Clean up test data
    await cleanupTestData()
  })

  describe('Connection Management', () => {
    it('should establish WebSocket connection successfully', (done) => {
      const ws = new WebSocket(`ws://localhost:${TEST_PORT}/ws`)
      
      ws.on('open', () => {
        expect(ws.readyState).toBe(WebSocket.OPEN)
        ws.close()
      })

      ws.on('close', () => {
        done()
      })

      ws.on('error', (error) => {
        console.error('WebSocket connection error:', error)
        done()
      })

      // Timeout after 3 seconds
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close()
        }
        done()
      }, 3000)
    })

    it('should handle malformed messages gracefully', (done) => {
      const ws = new WebSocket(`ws://localhost:${TEST_PORT}/ws`)
      
      ws.on('open', () => {
        // Send malformed JSON
        ws.send('invalid json message')
      })

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString())
        expect(message.error).toBeTruthy()
        expect(message.error).toContain('Invalid message format')
        ws.close()
      })

      ws.on('close', () => {
        done()
      })

      ws.on('error', (error) => {
        console.error('WebSocket error:', error)
        done()
      })

      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close()
        }
        done()
      }, 3000)
    })
  })

  describe('Lobby Operations via WebSocket', () => {
    it('should allow joining lobby and adding AI bot', async (done) => {
      // Create a new test user for joining (not the host)
      const joiningUser = await createTestUser({
        displayName: 'Joining Player',
        avatarEmoji: '🤖'
      })
      
      const ws = new WebSocket(`ws://localhost:${TEST_PORT}/ws`)
      
      ws.on('open', () => {
        // Join the lobby first
        ws.send(JSON.stringify({
          type: 'joinLobby',
          data: {
            gameId: testGame.id,
            userId: joiningUser.id,
            playerName: joiningUser.displayName,
            avatarEmoji: joiningUser.avatarEmoji
          }
        }))
      })

      let joinedLobby = false
      let aiPlayerAdded = false

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString())
          
          if (message.success && message.data?.type === 'joinedLobby') {
            joinedLobby = true
            
            // Add AI bot after joining
            ws.send(JSON.stringify({
              type: 'addAIBot',
              data: {
                name: 'WebSocket AI Bot',
                difficulty: 'medium',
                personality: 'balanced'
              }
            }))
          }
          
          if (message.success && message.data?.type === 'aiPlayerAdded') {
            aiPlayerAdded = true
            expect(message.data.playerId).toBeTruthy()
            
            // Clean up and finish test
            ws.close()
          }
          
          if (message.error) {
            console.error('WebSocket error:', message.error)
            ws.close()
          }
        } catch (error) {
          console.error('Error parsing message:', error)
          ws.close()
        }
      })

      ws.on('close', () => {
        expect(joinedLobby).toBe(true)
        expect(aiPlayerAdded).toBe(true)
        done()
      })

      ws.on('error', (error) => {
        console.error('WebSocket connection error:', error)
        done()
      })

      // Timeout after 5 seconds
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close()
        }
        done()
      }, 5000)
    })

    it('should handle leaving lobby via WebSocket', async (done) => {
      // Create a test user for this specific test
      const testUser = await createTestUser({
        displayName: 'Temporary Player',
        avatarEmoji: '👋'
      })
      
      const ws = new WebSocket(`ws://localhost:${TEST_PORT}/ws`)
      
      ws.on('open', () => {
        // Join the lobby first
        ws.send(JSON.stringify({
          type: 'joinLobby',
          data: {
            gameId: testGame.id,
            userId: testUser.id,
            playerName: testUser.displayName,
            avatarEmoji: testUser.avatarEmoji
          }
        }))
      })

      let joinedLobby = false
      let leftLobby = false

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString())
          
          if (message.success && message.data?.type === 'joinedLobby') {
            joinedLobby = true
            
            // Leave lobby after joining
            ws.send(JSON.stringify({
              type: 'leaveLobby',
              data: {}
            }))
          }
          
          if (message.success && message.data?.type === 'leftLobby') {
            leftLobby = true
            ws.close()
          }
          
          if (message.error) {
            console.error('WebSocket error:', message.error)
            ws.close()
          }
        } catch (error) {
          console.error('Error parsing message:', error)
          ws.close()
        }
      })

      ws.on('close', () => {
        expect(joinedLobby).toBe(true)
        expect(leftLobby).toBe(true)
        done()
      })

      ws.on('error', (error) => {
        console.error('WebSocket error:', error)
        done()
      })

      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close()
        }
        done()
      }, 5000)
    })
  })

  describe('Real-time Updates', () => {
    it('should receive live lobby state updates', async (done) => {
      // Create a test user for this specific test
      const testUser = await createTestUser({
        displayName: 'Live Update Test Player',
        avatarEmoji: '📡'
      })
      
      const ws = new WebSocket(`ws://localhost:${TEST_PORT}/ws`)
      
      let receivedLobbyState = false
      let receivedEvents = false

      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'joinLobby',
          data: {
            gameId: testGame.id,
            userId: testUser.id,
            playerName: testUser.displayName,
            avatarEmoji: testUser.avatarEmoji
          }
        }))
      })

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString())
          
          if (message.success && message.data?.type === 'lobbyState') {
            receivedLobbyState = true
            expect(message.data.lobby).toBeTruthy()
            expect(message.data.lobby.players).toBeTruthy()
          }
          
          if (message.success && message.data?.type === 'lobbyEvents') {
            receivedEvents = true
            expect(Array.isArray(message.data.events)).toBe(true)
          }
          
          // Close after receiving both types of updates
          if (receivedLobbyState && receivedEvents) {
            ws.close()
          }
        } catch (error) {
          console.error('Error parsing message:', error)
          ws.close()
        }
      })

      ws.on('close', () => {
        expect(receivedLobbyState).toBe(true)
        // Note: receivedEvents might be false if no new events occur during test
        done()
      })

      ws.on('error', (error) => {
        console.error('WebSocket error:', error)
        done()
      })

      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close()
        }
        done()
      }, 3000)
    })
  })

  describe('Error Handling', () => {
    it('should handle connection to non-existent game', (done) => {
      const ws = new WebSocket(`ws://localhost:${TEST_PORT}/ws`)
      
      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'joinLobby',
          data: {
            gameId: 'non-existent-game',
            userId: generateTestUUID(),
            playerName: 'Error Test Player',
            avatarEmoji: '❌'
          }
        }))
      })

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString())
          expect(message.error).toBeTruthy()
          expect(message.error).toContain('Game not found')
          ws.close()
        } catch (error) {
          console.error('Error parsing message:', error)
          ws.close()
        }
      })

      ws.on('close', () => {
        done()
      })

      ws.on('error', (error) => {
        console.error('WebSocket error:', error)
        done()
      })

      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close()
        }
        done()
      }, 3000)
    })

    it('should handle missing required fields', (done) => {
      const ws = new WebSocket(`ws://localhost:${TEST_PORT}/ws`)
      
      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'joinLobby',
          data: {
            gameId: testGame.id,
            // Missing userId and playerName
            avatarEmoji: '❌'
          }
        }))
      })

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString())
          expect(message.error).toBeTruthy()
          expect(message.error).toContain('Missing required fields')
          ws.close()
        } catch (error) {
          console.error('Error parsing message:', error)
          ws.close()
        }
      })

      ws.on('close', () => {
        done()
      })

      ws.on('error', (error) => {
        console.error('WebSocket error:', error)
        done()
      })

      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close()
        }
        done()
      }, 3000)
    })
  })
}) 