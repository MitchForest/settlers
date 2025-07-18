import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { eventStore } from '../db/event-store-repository'
import { lobbyCommandService } from '../services/lobby-command-service'
import { 
  createTestUser, 
  createTestGame, 
  cleanupTestData, 
  setupTestEnvironment,
  generateTestUUID,
  type TestUser,
  type TestGame
} from './test-helpers'

describe('AI Command Service Tests', () => {
  let testGame: TestGame
  let hostUser: TestUser

  beforeAll(async () => {
    // Setup clean test environment
    await setupTestEnvironment()
    
    // Create host user and game using test helpers
    hostUser = await createTestUser({
      displayName: 'AI Test Host',
      avatarEmoji: '🤖'
    })
    
    testGame = await createTestGame({
      hostUser,
      gameCode: `AI${Math.random().toString(36).substr(2, 4).toUpperCase()}`
    })
  })

  afterAll(async () => {
    // Clean up test data
    await cleanupTestData()
  })

  describe('AI Player Addition', () => {
    it('should add AI player with correct configuration', async () => {
      const result = await lobbyCommandService.addAIPlayer({
        gameId: testGame.id,
        name: 'Strategic Bot',
        difficulty: 'hard',
        personality: 'aggressive',
        requestedBy: hostUser.id
      })

      expect(result.success).toBe(true)
      expect(result.playerId).toBeTruthy()

      // Verify event was created
      const events = await eventStore.getGameEvents(testGame.id)
      const aiEvent = events.find(e => e.eventType === 'ai_player_added')
      
      expect(aiEvent).toBeTruthy()
      expect(aiEvent?.data.playerName).toBe('Strategic Bot')
      expect(aiEvent?.data.difficulty).toBe('hard')
      expect(aiEvent?.data.personality).toBe('aggressive')
      expect(aiEvent?.data.playerType).toBe('ai')
    })

    it('should add multiple AI players with different personalities', async () => {
      // Create a fresh game for this test to avoid interference
      const personalitiesTestUser = await createTestUser({
        displayName: 'Personalities Test Host',
        avatarEmoji: '🎭'
      })
      
      const personalitiesTestGame = await createTestGame({
        hostUser: personalitiesTestUser,
        gameCode: `PER${Math.random().toString(36).substr(2, 3).toUpperCase()}`
      })

      const personalities = ['balanced', 'defensive', 'economic'] // Fix: Changed 'trader' to 'economic'
      const addedPlayers = []

      for (const personality of personalities) {
        const result = await lobbyCommandService.addAIPlayer({
          gameId: personalitiesTestGame.id,
          name: `${personality.charAt(0).toUpperCase() + personality.slice(1)} Bot`,
          difficulty: 'medium',
          personality: personality as 'balanced' | 'defensive' | 'aggressive' | 'economic',
          requestedBy: personalitiesTestUser.id
        })

        expect(result.success).toBe(true)
        addedPlayers.push(result.playerId)
      }

      // Verify all players were added
      const events = await eventStore.getGameEvents(personalitiesTestGame.id)
      const aiEvents = events.filter(e => e.eventType === 'ai_player_added')
      
      expect(aiEvents.length).toBeGreaterThanOrEqual(personalities.length)
    })

    it('should prevent adding AI player when lobby is full', async () => {
      // First, add AI players to fill the lobby (assuming max 4 players)
      const maxAttempts = 5 // Try to exceed limit
      let successCount = 0

      for (let i = 0; i < maxAttempts; i++) {
        const result = await lobbyCommandService.addAIPlayer({
          gameId: testGame.id,
          name: `Overflow Bot ${i}`,
          difficulty: 'easy',
          personality: 'balanced',
          requestedBy: hostUser.id
        })

        if (result.success) {
          successCount++
        } else {
          expect(result.error).toContain('full')
          break
        }
      }

      // Should not have been able to add all players
      expect(successCount).toBeLessThan(maxAttempts)
    })

    it('should validate AI player name is required', async () => {
      const result = await lobbyCommandService.addAIPlayer({
        gameId: testGame.id,
        name: '',
        difficulty: 'medium',
        personality: 'balanced',
        requestedBy: hostUser.id
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('name')
    })

    it('should validate AI player name is not just whitespace', async () => {
      const result = await lobbyCommandService.addAIPlayer({
        gameId: testGame.id,
        name: '   ',
        difficulty: 'medium', 
        personality: 'balanced',
        requestedBy: hostUser.id
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('name')
    })

    it('should handle non-existent game', async () => {
      const result = await lobbyCommandService.addAIPlayer({
        gameId: 'non-existent-game',
        name: 'Test Bot',
        difficulty: 'medium',
        personality: 'balanced',
        requestedBy: hostUser.id
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })
  })

  describe('AI Player Removal', () => {
    it('should remove AI player successfully', async () => {
      // Create a fresh game for this test
      const removalTestUser = await createTestUser({
        displayName: 'Removal Test Host',
        avatarEmoji: '🗑️'
      })
      
      const removalTestGame = await createTestGame({
        hostUser: removalTestUser,
        gameCode: `REM${Math.random().toString(36).substr(2, 3).toUpperCase()}`
      })

      // First add an AI player
      const addResult = await lobbyCommandService.addAIPlayer({
        gameId: removalTestGame.id,
        name: 'Removable Bot',
        difficulty: 'easy',
        personality: 'defensive',
        requestedBy: removalTestUser.id
      })

      expect(addResult.success).toBe(true)
      const aiPlayerId = addResult.playerId!

      // Then remove it
      const removeResult = await lobbyCommandService.leaveGame({
        gameId: removalTestGame.id,
        playerId: aiPlayerId,
        reason: 'voluntary'
      })

      expect(removeResult.success).toBe(true)

      // Verify removal event was created
      const events = await eventStore.getGameEvents(removalTestGame.id)
      const removeEvent = events.find(e => 
        e.eventType === 'ai_player_removed' && // Fix: AI players should generate ai_player_removed events
        e.data.playerId === aiPlayerId
      )
      
      expect(removeEvent).toBeTruthy()
    })

    it('should handle removal of non-existent player', async () => {
      const result = await lobbyCommandService.leaveGame({
        gameId: testGame.id,
        playerId: 'non-existent-player',
        reason: 'voluntary'
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Player not found in lobby')
    })
  })

  describe('AI Configuration Validation', () => {
    it('should assign unique colors to AI players', async () => {
      // Create a new game for this test to avoid conflicts
      const colorTestUser = await createTestUser({
        displayName: 'Color Test Host',
        avatarEmoji: '🎨'
      })
      
      const colorTestGame = await createTestGame({
        hostUser: colorTestUser,
        gameCode: `CLR${Math.random().toString(36).substr(2, 3).toUpperCase()}`
      })

      // Add multiple AI players
      const aiNames = ['Red Bot', 'Blue Bot', 'Green Bot']
      const addedPlayers = []

      for (const name of aiNames) {
        const result = await lobbyCommandService.addAIPlayer({
          gameId: colorTestGame.id,
          name,
          difficulty: 'medium',
          personality: 'balanced',
          requestedBy: colorTestUser.id
        })
        
        expect(result.success).toBe(true)
        addedPlayers.push(result.playerId)
      }

      // Get lobby state and verify unique colors
      const lobbyState = await lobbyCommandService.getLobbyState(colorTestGame.id)
      expect(lobbyState.success).toBe(true)
      
      const players = Array.from(lobbyState.state!.players.values())
      const colors = players.map(p => p.color).filter(c => c !== undefined)
      const uniqueColors = new Set(colors)
      
      expect(uniqueColors.size).toBe(colors.length) // All colors should be unique
    })

    it('should assign sequential join orders', async () => {
      // Create a new game for this test
      const orderTestUser = await createTestUser({
        displayName: 'Order Test Host',
        avatarEmoji: '📊'
      })
      
      const orderTestGame = await createTestGame({
        hostUser: orderTestUser,
        gameCode: `ORD${Math.random().toString(36).substr(2, 3).toUpperCase()}`
      })

      // Add AI players and track join order
      const aiCount = 3
      const addedPlayers = []

      for (let i = 0; i < aiCount; i++) {
        const result = await lobbyCommandService.addAIPlayer({
          gameId: orderTestGame.id,
          name: `Order Bot ${i + 1}`,
          difficulty: 'medium',
          personality: 'balanced',
          requestedBy: orderTestUser.id
        })
        
        expect(result.success).toBe(true)
        addedPlayers.push(result.playerId)
      }

      // Verify join orders are sequential
      const events = await eventStore.getGameEvents(orderTestGame.id)
      const aiEvents = events.filter(e => e.eventType === 'ai_player_added')
        .sort((a, b) => a.sequenceNumber - b.sequenceNumber)
      
      for (let i = 0; i < aiEvents.length; i++) {
        expect(aiEvents[i].data.joinOrder).toBeGreaterThan(0)
        if (i > 0) {
          expect(aiEvents[i].data.joinOrder).toBeGreaterThan(aiEvents[i-1].data.joinOrder)
        }
      }
    })
  })

  describe('Concurrent Operations', () => {
    it('should handle rapid AI bot additions with atomic sequence generation', async () => {
      // Create a new game for concurrency testing
      const concurrentTestUser = await createTestUser({
        displayName: 'Concurrency Test Host',
        avatarEmoji: '⚡'
      })
      
      const concurrentTestGame = await createTestGame({
        hostUser: concurrentTestUser,
        gameCode: `CON${Math.random().toString(36).substr(2, 3).toUpperCase()}`
      })

      // Try to add multiple AI players simultaneously
      const addPromises = []
      for (let i = 0; i < 3; i++) {
        addPromises.push(
          lobbyCommandService.addAIPlayer({
            gameId: concurrentTestGame.id,
            name: `Concurrent Bot ${i}`,
            difficulty: 'medium',
            personality: 'balanced',
            requestedBy: concurrentTestUser.id
          })
        )
      }

      const results = await Promise.all(addPromises)
      const successful = results.filter(r => r.success)
      
      // At least some should succeed
      expect(successful.length).toBeGreaterThan(0)
      
      // Verify sequence numbers are unique
      const events = await eventStore.getGameEvents(concurrentTestGame.id)
      const sequences = events.map(e => e.sequenceNumber)
      const uniqueSequences = new Set(sequences)
      
      expect(uniqueSequences.size).toBe(sequences.length)
    })
  })

  describe('Event Structure Validation', () => {
    it('should create properly structured AI player events', async () => {
      // Create a new game for event testing
      const eventTestUser = await createTestUser({
        displayName: 'Event Test Host',
        avatarEmoji: '📋'
      })
      
      const eventTestGame = await createTestGame({
        hostUser: eventTestUser,
        gameCode: `EVT${Math.random().toString(36).substr(2, 3).toUpperCase()}`
      })

      const result = await lobbyCommandService.addAIPlayer({
        gameId: eventTestGame.id,
        name: 'Structure Test Bot',
        difficulty: 'hard',
        personality: 'aggressive',
        requestedBy: eventTestUser.id
      })

      expect(result.success).toBe(true)

      // Verify event structure
      const events = await eventStore.getGameEvents(eventTestGame.id)
      const aiEvent = events.find(e => e.eventType === 'ai_player_added')
      
      expect(aiEvent).toBeTruthy()
      expect(aiEvent!.data).toHaveProperty('playerId')
      expect(aiEvent!.data).toHaveProperty('playerName')
      expect(aiEvent!.data).toHaveProperty('difficulty')
      expect(aiEvent!.data).toHaveProperty('personality')
      expect(aiEvent!.data).toHaveProperty('playerType', 'ai')
      expect(aiEvent!.data).toHaveProperty('joinOrder')
      expect(aiEvent!.data).toHaveProperty('color')
    })
  })
}) 