/**
 * End-to-End AI Integration Test
 * 
 * Tests the complete AI integration pipeline:
 * 1. Game creation with AI players
 * 2. AI decision making
 * 3. Game state progression
 * 4. Complete game flow
 */

import { describe, test, expect, beforeEach } from 'vitest'
import { AIIntegrationService } from '../src/services/ai-integration-service'
import { GameStateManager } from '../src/services/game-state-manager'
import { GameFlowManager } from '@settlers/game-engine'

describe('AI Integration End-to-End', () => {
  let gameStateManager: GameStateManager
  let aiIntegrationService: AIIntegrationService
  let gameFlow: GameFlowManager

  beforeEach(() => {
    gameFlow = new GameFlowManager()
    gameStateManager = new GameStateManager()
    aiIntegrationService = new AIIntegrationService(gameStateManager)
  })

  test('should create game with AI players and run basic gameplay loop', async () => {
    console.log('🎮 Testing AI Integration E2E')

    // 1. Create a new game
    const gameId = 'test-game-' + Date.now()
    const player1Id = 'ai-player-1'
    const player2Id = 'ai-player-2'
    
    // Initialize game flow
    const initialState = gameFlow.getState()
    expect(initialState).toBeDefined()
    expect(initialState.phase).toBe('setup1')

    // 2. Add AI players
    gameFlow.addPlayer({ playerId: player1Id, name: 'AI Bot 1' })
    gameFlow.addPlayer({ playerId: player2Id, name: 'AI Bot 2' })

    // 3. Initialize AI bots
    await aiIntegrationService.initializeBot(gameId, player1Id, {
      difficulty: 'medium',
      personality: 'balanced'
    })

    await aiIntegrationService.initializeBot(gameId, player2Id, {
      difficulty: 'medium', 
      personality: 'aggressive'
    })

    // 4. Verify AI bots are created
    expect(aiIntegrationService.isAIBot(gameId, player1Id)).toBe(true)
    expect(aiIntegrationService.isAIBot(gameId, player2Id)).toBe(true)

    // 5. Test AI decision making in setup phase
    const gameState = gameFlow.getState()
    console.log(`📋 Game phase: ${gameState.phase}`)
    console.log(`👤 Current player: ${gameState.currentPlayer}`)

    // Get AI action for current player
    const currentPlayerId = gameState.currentPlayer
    const aiAction = await aiIntegrationService.getAIAction(gameId, currentPlayerId, gameState)

    console.log(`🤖 AI action for ${currentPlayerId}:`, aiAction)

    // 6. Verify AI produces valid actions
    expect(aiAction).toBeDefined()
    expect(aiAction!.playerId).toBe(currentPlayerId)
    expect(aiAction!.type).toBeDefined()

    // 7. Execute AI action and verify game state progression
    const result = gameFlow.processAction(aiAction!)
    expect(result.success).toBe(true)

    const newGameState = gameFlow.getState()
    console.log(`📋 New game phase: ${newGameState.phase}`)
    console.log(`👤 New current player: ${newGameState.currentPlayer}`)

    // 8. Verify game progressed appropriately
    expect(newGameState.turn).toBeGreaterThanOrEqual(gameState.turn)

    console.log('✅ AI Integration E2E test completed successfully')
  }, 10000) // 10 second timeout

  test('should handle AI bot cleanup', async () => {
    const gameId = 'cleanup-test-' + Date.now()
    const playerId = 'ai-player-cleanup'

    // Create bot
    await aiIntegrationService.initializeBot(gameId, playerId, {
      difficulty: 'easy'
    })

    expect(aiIntegrationService.isAIBot(gameId, playerId)).toBe(true)

    // Remove bot
    aiIntegrationService.removeBot(gameId, playerId)
    expect(aiIntegrationService.isAIBot(gameId, playerId)).toBe(false)

    // Remove all bots from game
    await aiIntegrationService.initializeBot(gameId, 'bot1', { difficulty: 'easy' })
    await aiIntegrationService.initializeBot(gameId, 'bot2', { difficulty: 'easy' })
    
    aiIntegrationService.removeAllBotsFromGame(gameId)
    expect(aiIntegrationService.isAIBot(gameId, 'bot1')).toBe(false)
    expect(aiIntegrationService.isAIBot(gameId, 'bot2')).toBe(false)
  })

  test('should provide meaningful AI stats', async () => {
    const gameId = 'stats-test-' + Date.now()
    
    await aiIntegrationService.initializeBot(gameId, 'bot1', { difficulty: 'easy' })
    await aiIntegrationService.initializeBot(gameId, 'bot2', { difficulty: 'hard' })

    const stats = aiIntegrationService.getStats()
    
    expect(stats.totalActiveBots).toBeGreaterThanOrEqual(2)
    expect(stats.activeBotsByGame[gameId]).toContain('bot1')
    expect(stats.activeBotsByGame[gameId]).toContain('bot2')

    console.log('📊 AI Integration Stats:', stats)
  })
})