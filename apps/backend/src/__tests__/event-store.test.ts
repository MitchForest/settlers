import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { eventStore } from '../db/event-store-repository'
import { 
  createTestUser, 
  cleanupTestData, 
  setupTestEnvironment,
  generateTestUUID,
  type TestUser 
} from './test-helpers'

describe('Event Store Repository Tests', () => {
  beforeAll(async () => {
    await setupTestEnvironment()
  })

  afterAll(async () => {
    await cleanupTestData()
  })

  describe('Game Creation', () => {
    it('should create game with host player', async () => {
      const hostUser = await createTestUser({ displayName: 'Test Host' })
      const gameCode = `TEST${Math.random().toString(36).substr(2, 4).toUpperCase()}`
      
      const result = await eventStore.createGame({
        id: `test_game_${Date.now()}`,
        gameCode,
        hostUserId: hostUser.id,
        hostPlayerName: 'Test Host',
        hostAvatarEmoji: '👑'
      })

      expect(result.game).toBeTruthy()
      expect(result.game.gameCode).toBe(gameCode)
      expect(result.game.currentPhase).toBe('lobby')
      expect(result.game.isActive).toBe(true)
      
      expect(result.hostPlayer).toBeTruthy()
      expect(result.hostPlayer.playerType).toBe('human')
      expect(result.hostPlayer.name).toBe('Test Host')
    })

    it('should prevent duplicate game codes', async () => {
      const gameCode = `DUP${Math.random().toString(36).substr(2, 4).toUpperCase()}`
      const hostUser1 = await createTestUser({ displayName: 'Host 1' })
      const hostUser2 = await createTestUser({ displayName: 'Host 2' })

      // Create first game
      await eventStore.createGame({
        id: `dup_game_1_${Date.now()}`,
        gameCode,
        hostUserId: hostUser1.id,
        hostPlayerName: 'Host 1',
        hostAvatarEmoji: '1️⃣'
      })

      // Try to create second game with same code
      await expect(eventStore.createGame({
        id: `dup_game_2_${Date.now()}`,
        gameCode,
        hostUserId: hostUser2.id,
        hostPlayerName: 'Host 2',
        hostAvatarEmoji: '2️⃣'
      })).rejects.toThrow()
    })

    it('should initialize event sequence for new game', async () => {
      const hostUser = await createTestUser({ displayName: 'Sequence Host' })
      const gameCode = `SEQ${Math.random().toString(36).substr(2, 4).toUpperCase()}`
      
      const result = await eventStore.createGame({
        id: `seq_game_${Date.now()}`,
        gameCode,
        hostUserId: hostUser.id,
        hostPlayerName: 'Sequence Test Host',
        hostAvatarEmoji: '🔢'
      })

      const currentSequence = await eventStore.getCurrentSequence(result.game.id)
      expect(currentSequence).toBe(1) // Should have one initial event
    })
  })

  describe('Event Management', () => {
    let testGameId: string
    let testHostUserId: string

    beforeAll(async () => {
      const testHostUser = await createTestUser({ displayName: 'Event Test Host' })
      testHostUserId = testHostUser.id
      const gameCode = `EVENT${Math.random().toString(36).substr(2, 3).toUpperCase()}`
      
      const result = await eventStore.createGame({
        id: `event_test_game_${Date.now()}`,
        gameCode,
        hostUserId: testHostUserId,
        hostPlayerName: 'Event Test Host',
        hostAvatarEmoji: '📝'
      })
      
      testGameId = result.game.id
    })

    it('should append events with atomic sequence generation', async () => {
      const eventData = {
        gameId: testGameId,
        eventType: 'settings_changed' as const,
        data: {
          maxPlayers: 6,
          allowObservers: false,
          aiEnabled: true
        }
      }

      await eventStore.appendEvent(eventData)

      const events = await eventStore.getGameEvents(testGameId)
      const lastEvent = events[events.length - 1]
      
      expect(lastEvent.eventType).toBe('settings_changed')
      expect(lastEvent.data.maxPlayers).toBe(6)
      expect(lastEvent.sequenceNumber).toBeGreaterThan(0)
    })

    it('should maintain event ordering with concurrent appends', async () => {
      const concurrentEvents = []
      
      for (let i = 0; i < 5; i++) {
        concurrentEvents.push(
          eventStore.appendEvent({
            gameId: testGameId,
            eventType: 'dice_rolled',
            data: {
              playerId: `test-player-${i}`,
              dice1: Math.floor(Math.random() * 6) + 1,
              dice2: Math.floor(Math.random() * 6) + 1,
              total: 0
            }
          })
        )
      }

      await Promise.all(concurrentEvents)

      const events = await eventStore.getGameEvents(testGameId)
      
      // Verify sequence numbers are consecutive
      for (let i = 1; i < events.length; i++) {
        expect(events[i].sequenceNumber).toBe(events[i-1].sequenceNumber + 1)
      }
    })

    it('should filter events by sequence range', async () => {
      const currentSequence = await eventStore.getCurrentSequence(testGameId)
      
      // Get events from sequence 2 onwards
      const filteredEvents = await eventStore.getGameEvents(testGameId, {
        fromSequence: 2
      })

      expect(filteredEvents.length).toBe(currentSequence - 1)
      expect(filteredEvents[0].sequenceNumber).toBe(2)
    })

    it('should filter events by type', async () => {
      const playerEvents = await eventStore.getGameEvents(testGameId, {
        eventTypes: ['player_joined']
      })

      for (const event of playerEvents) {
        expect(event.eventType).toBe('player_joined')
      }
    })
  })

  describe('Game Lookup', () => {
          it('should find game by code', async () => {
        const hostUser = await createTestUser({ displayName: 'Lookup Host' })
        const gameCode = `LOOKUP${Math.random().toString(36).substr(2, 2).toUpperCase()}`
      
      const createResult = await eventStore.createGame({
        id: `lookup_game_${Date.now()}`,
        gameCode,
        hostUserId: hostUser.id,
        hostPlayerName: 'Lookup Test Host',
        hostAvatarEmoji: '🔍'
      })

      const foundGame = await eventStore.getGameByCode(gameCode)
      
      expect(foundGame).toBeTruthy()
      expect(foundGame?.id).toBe(createResult.game.id)
      expect(foundGame?.gameCode).toBe(gameCode)
    })

    it('should return null for non-existent game code', async () => {
      const nonExistentGame = await eventStore.getGameByCode('NONEXIST')
      expect(nonExistentGame).toBeNull()
    })

          it('should handle case-insensitive game code lookup', async () => {
        const hostUser = await createTestUser({ displayName: 'Case Host' })
        const gameCode = `CASE${Math.random().toString(36).substr(2, 2).toUpperCase()}`
      
      await eventStore.createGame({
        id: `case_game_${Date.now()}`,
        gameCode: gameCode.toUpperCase(),
        hostUserId: hostUser.id,
        hostPlayerName: 'Case Test Host',
        hostAvatarEmoji: '🔤'
      })

      const foundGame = await eventStore.getGameByCode(gameCode.toLowerCase())
      expect(foundGame).toBeTruthy()
    })
  })

  describe('Database Transactions', () => {
          it('should handle transaction rollback on error', async () => {
        const hostUser = await createTestUser({ displayName: 'Rollback Host' })
        const gameCode = `ROLLBACK${Math.random().toString(36).substr(2, 1).toUpperCase()}`
      
      try {
        // This should fail due to invalid UUID format
        await eventStore.createGame({
          id: `rollback_game_${Date.now()}`,
          gameCode,
          hostUserId: 'invalid-uuid-format',
          hostPlayerName: 'Rollback Test Host',
          hostAvatarEmoji: '↩️'
        })
      } catch (error) {
        // Expected to fail
      }

      // Verify no partial data was committed
      const foundGame = await eventStore.getGameByCode(gameCode)
      expect(foundGame).toBeNull()
    })
  })

  describe('Sequence Generation Edge Cases', () => {
    it('should handle rapid sequence generation without gaps', async () => {
      const hostUser = await createTestUser()
      const gameCode = `RAPID${Math.random().toString(36).substr(2, 2).toUpperCase()}`
      
      const result = await eventStore.createGame({
        id: `rapid_game_${Date.now()}`,
        gameCode,
        hostUserId: hostUser.id,
        hostPlayerName: 'Rapid Test Host',
        hostAvatarEmoji: '⚡'
      })

      // Add many events rapidly
      const rapidPromises = []
      for (let i = 0; i < 10; i++) {
        rapidPromises.push(
          eventStore.appendEvent({
            gameId: result.game.id,
            playerId: `rapid-player-${i}`,
            eventType: 'settings_changed',
            data: {
              changes: { setting: `value-${i}` }
            }
          })
        )
      }

      await Promise.all(rapidPromises)

      const events = await eventStore.getGameEvents(result.game.id)
      
      // Should have 1 initial + 10 rapid events = 11 total
      expect(events.length).toBe(11)
      
      // Verify no sequence gaps
      for (let i = 0; i < events.length; i++) {
        expect(events[i].sequenceNumber).toBe(i + 1)
      }
    })

    it('should maintain sequence consistency across multiple games', async () => {
      const hostUser1 = await createTestUser({ displayName: 'Host 1' })
      const hostUser2 = await createTestUser({ displayName: 'Host 2' })
      
      const game1Result = await eventStore.createGame({
        id: `multi_game_1_${Date.now()}`,
        gameCode: `MULTI1${Math.random().toString(36).substr(2, 1).toUpperCase()}`,
        hostUserId: hostUser1.id,
        hostPlayerName: 'Multi Host 1',
        hostAvatarEmoji: '1️⃣'
      })

      const game2Result = await eventStore.createGame({
        id: `multi_game_2_${Date.now()}`,
        gameCode: `MULTI2${Math.random().toString(36).substr(2, 1).toUpperCase()}`,
        hostUserId: hostUser2.id,
        hostPlayerName: 'Multi Host 2',
        hostAvatarEmoji: '2️⃣'
      })

      // Add events to both games concurrently
      const mixedPromises = []
      for (let i = 0; i < 5; i++) {
        mixedPromises.push(
          eventStore.appendEvent({
            gameId: game1Result.game.id,
            eventType: 'settings_changed',
            data: { changes: { game1Setting: i } }
          })
        )
        mixedPromises.push(
          eventStore.appendEvent({
            gameId: game2Result.game.id,
            eventType: 'settings_changed',
            data: { changes: { game2Setting: i } }
          })
        )
      }

      await Promise.all(mixedPromises)

      // Verify each game has consistent sequence numbering
      const game1Events = await eventStore.getGameEvents(game1Result.game.id)
      const game2Events = await eventStore.getGameEvents(game2Result.game.id)

      for (let i = 0; i < game1Events.length; i++) {
        expect(game1Events[i].sequenceNumber).toBe(i + 1)
      }

      for (let i = 0; i < game2Events.length; i++) {
        expect(game2Events[i].sequenceNumber).toBe(i + 1)
      }
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid event data gracefully', async () => {
      const hostUser = await createTestUser()
      const gameCode = `ERROR${Math.random().toString(36).substr(2, 3).toUpperCase()}`
      
      const result = await eventStore.createGame({
        id: `error_game_${Date.now()}`,
        gameCode,
        hostUserId: hostUser.id,
        hostPlayerName: 'Error Test Host',
        hostAvatarEmoji: '❌'
      })

      // Try to append event with missing required data
      await expect(eventStore.appendEvent({
        gameId: result.game.id,
        eventType: 'player_joined',
        data: null as any // Invalid data
      })).rejects.toThrow()
    })

    it('should handle non-existent game ID in event append', async () => {
      await expect(eventStore.appendEvent({
        gameId: 'non-existent-game-id',
        eventType: 'player_joined',
        data: { test: 'data' }
      })).rejects.toThrow()
    })
  })
}) 