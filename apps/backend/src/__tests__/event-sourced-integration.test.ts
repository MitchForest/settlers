import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { eventStore } from '../db/event-store-repository'
import { lobbyCommandService } from '../services/lobby-command-service'
import { db } from '../db/index'
import { userProfiles } from '../db/schema'

// Generate a proper UUID for testing
function generateTestUUID(): string {
  return crypto.randomUUID()
}

describe('Event-Sourced Architecture Integration', () => {
  let testGameId: string
  let testHostPlayerId: string
  let testHostUserId: string

  beforeAll(async () => {
    // Create a test user profile first
    testHostUserId = generateTestUUID()
    const timestamp = Date.now()
    await db.insert(userProfiles).values({
      id: testHostUserId,
      email: `test${timestamp}@example.com`,
      name: 'Test Host',
      avatarEmoji: '👑'
    })

    // Create a test game with proper UUID
    const gameCode = `TEST${timestamp.toString().slice(-4)}`
    const result = await eventStore.createGame({
      id: `test_game_${Date.now()}`,
      gameCode,
      hostUserId: testHostUserId,
      hostPlayerName: 'Test Host',
      hostAvatarEmoji: '👑'
    })

    testGameId = result.game.id
    testHostPlayerId = result.hostPlayer.id
  })

  it('should create game with event sourcing', async () => {
    // Verify game was created
    const game = await eventStore.getGameById(testGameId)
    expect(game).toBeTruthy()
    expect(game?.id).toBe(testGameId)
    expect(game?.currentPhase).toBe('lobby')
    expect(game?.isActive).toBe(true)
  })

  it('should have initial player_joined event', async () => {
    // Get events for the game
    const events = await eventStore.getGameEvents(testGameId)
    
    expect(events.length).toBe(1)
    expect(events[0].eventType).toBe('player_joined')
    expect(events[0].data.playerId).toBe(testHostPlayerId)
    expect(events[0].data.name).toBe('Test Host')
    expect(events[0].data.isHost).toBe(true)
    expect(events[0].sequenceNumber).toBe(1)
  })

  it('should project lobby state correctly', async () => {
    const result = await lobbyCommandService.getLobbyState(testGameId)
    
    expect(result.success).toBe(true)
    expect(result.state).toBeTruthy()
    
    const state = result.state!
    expect(state.gameId).toBe(testGameId)
    expect(state.players.size).toBe(1)
    
    const hostPlayer = Array.from(state.players.values())[0]
    expect(hostPlayer.name).toBe('Test Host')
    expect(hostPlayer.isHost).toBe(true)
    expect(hostPlayer.playerType).toBe('human')
    expect(hostPlayer.color).toBe('red')
  })

  it('should add AI player via command service', async () => {
    const result = await lobbyCommandService.addAIPlayer({
      gameId: testGameId,
      name: 'Bot Alice',
      difficulty: 'medium',
      personality: 'balanced',
      requestedBy: testHostUserId
    })

    expect(result.success).toBe(true)
    expect(result.playerId).toBeTruthy()

    // Verify event was created
    const events = await eventStore.getGameEvents(testGameId)
    expect(events.length).toBe(2)
    
    const aiEvent = events[1]
    expect(aiEvent.eventType).toBe('ai_player_added')
    expect(aiEvent.data.playerName).toBe('Bot Alice') // Fix: Use playerName instead of name
    expect(aiEvent.data.aiSettings.difficulty).toBe('medium')
    expect(aiEvent.sequenceNumber).toBe(2)
  })

  it('should prevent adding too many players', async () => {
    // Add 2 more AI players to reach the limit (4 total)
    await lobbyCommandService.addAIPlayer({
      gameId: testGameId,
      name: 'Bot Bob',
      difficulty: 'easy',
      personality: 'aggressive',
      requestedBy: testHostUserId
    })

    await lobbyCommandService.addAIPlayer({
      gameId: testGameId,
      name: 'Bot Charlie',
      difficulty: 'hard',
      personality: 'defensive',
      requestedBy: testHostUserId
    })

    // Try to add 5th player - should fail
    const result = await lobbyCommandService.addAIPlayer({
      gameId: testGameId,
      name: 'Bot Delta',
      difficulty: 'medium',
      personality: 'economic',
      requestedBy: testHostUserId
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('full')
  })

  it('should project final lobby state correctly', async () => {
    const result = await lobbyCommandService.getLobbyState(testGameId)
    
    expect(result.success).toBe(true)
    expect(result.state?.players.size).toBe(4)
    
    const players = Array.from(result.state!.players.values())
    
    // Host player
    const host = players.find(p => p.isHost)
    expect(host?.name).toBe('Test Host')
    expect(host?.playerType).toBe('human')
    
    // AI players
    const aiPlayers = players.filter(p => p.playerType === 'ai')
    expect(aiPlayers.length).toBe(3)
    expect(aiPlayers.map(p => p.name)).toContain('Bot Alice')
    expect(aiPlayers.map(p => p.name)).toContain('Bot Bob')
    expect(aiPlayers.map(p => p.name)).toContain('Bot Charlie')
  })

  it('should handle event sequence numbers correctly', async () => {
    const events = await eventStore.getGameEvents(testGameId)
    
    // Should have 4 events total
    expect(events.length).toBe(4)
    
    // Sequence numbers should be in order
    for (let i = 0; i < events.length; i++) {
      expect(events[i].sequenceNumber).toBe(i + 1)
    }
    
    // Should be ordered by sequence
    for (let i = 1; i < events.length; i++) {
      expect(events[i].timestamp.getTime()).toBeGreaterThanOrEqual(
        events[i - 1].timestamp.getTime()
      )
    }
  })

  it('should validate business rules', async () => {
    const state = (await lobbyCommandService.getLobbyState(testGameId)).state!
    
    // Should have exactly one host
    const hosts = Array.from(state.players.values()).filter(p => p.isHost)
    expect(hosts.length).toBe(1)
    
    // Should have unique colors
    const colors = Array.from(state.players.values()).map(p => p.color)
    const uniqueColors = new Set(colors)
    expect(colors.length).toBe(uniqueColors.size)
    
    // Should have unique join orders
    const joinOrders = Array.from(state.players.values()).map(p => p.joinOrder)
    const uniqueJoinOrders = new Set(joinOrders)
    expect(joinOrders.length).toBe(uniqueJoinOrders.size)
  })

  it('should get current sequence correctly', async () => {
    const currentSequence = await eventStore.getCurrentSequence(testGameId)
    expect(currentSequence).toBe(4) // 4 events have been added
  })

  it('should get events since specific sequence', async () => {
    const events = await eventStore.getGameEvents(testGameId, {
      fromSequence: 3
    })
    
    expect(events.length).toBe(2) // Events 3 and 4
    expect(events[0].sequenceNumber).toBe(3)
    expect(events[1].sequenceNumber).toBe(4)
  })

  afterAll(async () => {
    // Clean up test data
    console.log(`Test completed for game ${testGameId}`)
  })
})

describe('Error Handling', () => {
  it('should handle non-existent game gracefully', async () => {
    const result = await lobbyCommandService.getLobbyState('non-existent-game')
    
    expect(result.success).toBe(false)
    expect(result.error).toBe('Game not found')
  })

  it('should validate required fields', async () => {
    // Test empty name validation
    const result1 = await lobbyCommandService.addAIPlayer({
      gameId: 'test-game',
      name: '', // Empty name should fail
      difficulty: 'medium',
      personality: 'balanced',
      requestedBy: generateTestUUID()
    })

    expect(result1.success).toBe(false)
    expect(result1.error).toBe('AI player name is required')

    // Test game not found
    const result2 = await lobbyCommandService.addAIPlayer({
      gameId: 'non-existent-game',
      name: 'Valid AI Name',
      difficulty: 'medium',
      personality: 'balanced',
      requestedBy: generateTestUUID()
    })

    expect(result2.success).toBe(false)
    expect(result2.error).toBe('Game not found')
  })
}) 