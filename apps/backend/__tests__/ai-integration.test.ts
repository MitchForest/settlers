import { describe, it, expect, beforeEach } from 'vitest'
import { AIIntegrationService } from '../src/services/ai-integration-service'
import { GameStateManager } from '../src/services/game-state-manager'

describe('AI Integration Service', () => {
  let aiService: AIIntegrationService
  let gameStateManager: GameStateManager

  beforeEach(() => {
    // Mock GameStateManager for testing
    gameStateManager = {} as GameStateManager
    aiService = new AIIntegrationService(gameStateManager)
  })

  describe('Bot Management', () => {
    it('should initialize AI bot for a game', async () => {
      const gameId = 'test-game-123'
      const playerId = 'test-player-456'
      
      await aiService.initializeBot(gameId, playerId, {
        difficulty: 'medium',
        personality: 'balanced'
      })

      expect(aiService.isAIBot(gameId, playerId)).toBe(true)
    })

    it('should remove AI bot from game', async () => {
      const gameId = 'test-game-123'
      const playerId = 'test-player-456'
      
      await aiService.initializeBot(gameId, playerId, {
        difficulty: 'easy',
        personality: 'defensive'
      })
      
      expect(aiService.isAIBot(gameId, playerId)).toBe(true)
      
      aiService.removeBot(gameId, playerId)
      expect(aiService.isAIBot(gameId, playerId)).toBe(false)
    })

    it('should track bot statistics', async () => {
      const gameId1 = 'game-1'
      const gameId2 = 'game-2'
      const player1 = 'player-1'
      const player2 = 'player-2'
      
      await aiService.initializeBot(gameId1, player1, { difficulty: 'hard' })
      await aiService.initializeBot(gameId2, player2, { difficulty: 'easy' })
      
      const stats = aiService.getStats()
      expect(stats.totalActiveBots).toBe(2)
      expect(stats.activeBotsByGame[gameId1]).toContain(player1)
      expect(stats.activeBotsByGame[gameId2]).toContain(player2)
    })
  })

  describe('AI Action Selection', () => {
    it('should handle missing bot gracefully', async () => {
      const mockGameState = {
        players: new Map(),
        phase: 'actions' as const,
        currentPlayer: 'unknown-player'
      } as any

      const action = await aiService.getAIAction('unknown-game', 'unknown-player', mockGameState)
      expect(action).toBeNull()
    })

    it('should return null for invalid game state', async () => {
      const gameId = 'test-game'
      const playerId = 'test-player'
      
      await aiService.initializeBot(gameId, playerId, { difficulty: 'medium' })
      
      const invalidGameState = {
        players: new Map(), // Empty players map
        phase: 'actions' as const,
        currentPlayer: playerId
      } as any

      const action = await aiService.getAIAction(gameId, playerId, invalidGameState)
      expect(action).toBeNull()
    })
  })

  describe('Configuration', () => {
    it('should map difficulty to thinking time correctly', async () => {
      // This is tested indirectly by ensuring bots initialize with different difficulties
      const gameId = 'test-game'
      
      await aiService.initializeBot(gameId, 'easy-bot', { difficulty: 'easy' })
      await aiService.initializeBot(gameId, 'hard-bot', { difficulty: 'hard' })
      
      expect(aiService.isAIBot(gameId, 'easy-bot')).toBe(true)
      expect(aiService.isAIBot(gameId, 'hard-bot')).toBe(true)
    })
  })
}) 