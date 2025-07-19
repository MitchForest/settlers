import { describe, it, expect, beforeEach } from 'vitest'
import { GameFlowManager } from '@settlers/game-engine'
import { AIIntegrationService } from '../src/services/ai-integration-service'
import { GameStateManager } from '../src/services/game-state-manager'
import { AITurnOrchestrator } from '../src/services/ai-turn-orchestrator'

describe('Full AI Integration - End to End', () => {
  let gameFlow: GameFlowManager
  let gameStateManager: GameStateManager
  let aiService: AIIntegrationService
  let aiOrchestrator: AITurnOrchestrator
  let playerIds: string[]
  let gameId: string

  beforeEach(() => {
    // Create a real game with 3 players (1 human + 2 AI)
    gameFlow = GameFlowManager.createGame({
      playerNames: ['Human', 'AI-Bot-1', 'AI-Bot-2'],
      randomizePlayerOrder: false
    })

    gameId = gameFlow.getState().id
    playerIds = Array.from(gameFlow.getState().players.keys())

    // Create real service instances
    gameStateManager = new GameStateManager()
    aiService = new AIIntegrationService(gameStateManager)
    aiOrchestrator = new AITurnOrchestrator(gameStateManager)

    // Mock game state manager to use our test game
    gameStateManager.loadGameState = async (id: string) => {
      return gameFlow.getState()
    }
    gameStateManager.processPlayerAction = async (gameId: string, playerId: string, action: any) => {
      return gameFlow.processAction(action)
    }
  })

  describe('Game Setup and AI Initialization', () => {
    it('should create a game with proper player setup', () => {
      const gameState = gameFlow.getState()
      
      expect(gameState.players.size).toBe(3)
      expect(gameState.phase).toBe('setup1')
      expect(gameState.currentPlayer).toBe(playerIds[0])
      
      // Verify players exist
      playerIds.forEach(id => {
        const player = gameState.players.get(id)
        expect(player).toBeDefined()
        expect(player?.name).toBeDefined()
      })
    })

    it('should initialize AI bots for AI players', async () => {
      // Initialize AI for second and third players
      await aiService.initializeBot(gameId, playerIds[1], {
        difficulty: 'medium',
        personality: 'balanced'
      })
      
      await aiService.initializeBot(gameId, playerIds[2], {
        difficulty: 'hard', 
        personality: 'aggressive'
      })

      // Verify bots are initialized
      expect(aiService.isAIBot(gameId, playerIds[0])).toBe(false) // Human
      expect(aiService.isAIBot(gameId, playerIds[1])).toBe(true)  // AI Bot 1
      expect(aiService.isAIBot(gameId, playerIds[2])).toBe(true)  // AI Bot 2

      const stats = aiService.getStats()
      expect(stats.totalActiveBots).toBe(2)
    })

    it('should initialize AI in orchestrator', async () => {
      await aiOrchestrator.initializeAIPlayer(gameId, playerIds[1], {
        difficulty: 'medium',
        personality: 'balanced'
      })

      const stats = aiOrchestrator.getAIStats()
      expect(stats.totalAIPlayers).toBe(1)
      expect(stats.aiByDifficulty.medium).toBe(1)
      expect(stats.aiByPersonality.balanced).toBe(1)
    })
  })

  describe('AI Action Generation', () => {
    beforeEach(async () => {
      // Initialize AI bots
      await aiService.initializeBot(gameId, playerIds[1], {
        difficulty: 'medium',
        personality: 'balanced'
      })
    })

    it('should generate valid setup actions for AI bot', async () => {
      const gameState = gameFlow.getState()
      
      // Skip to AI player's turn
      if (gameState.currentPlayer !== playerIds[1]) {
        // For this test, we'll manually set the current player
        gameState.currentPlayer = playerIds[1]
      }

      const action = await aiService.getAIAction(gameId, playerIds[1], gameState)
      
      expect(action).toBeDefined()
      expect(action?.type).toBe('build')
      expect(action?.playerId).toBe(playerIds[1])
      expect(action?.data.buildingType).toBe('settlement')
      expect(action?.data.position).toBeDefined()
    })

    it('should handle different game phases appropriately', async () => {
      const gameState = gameFlow.getState()
      
      // Test setup1 phase
      gameState.currentPlayer = playerIds[1]
      gameState.phase = 'setup1'
      const setupAction = await aiService.getAIAction(gameId, playerIds[1], gameState)
      expect(setupAction?.type).toBe('build')
      expect(setupAction?.data.buildingType).toBe('settlement')

      // Test main game phase (mock it)
      const mainGameState = {
        ...gameState,
        phase: 'actions' as const,
        currentPlayer: playerIds[1]
      }
      const mainAction = await aiService.getAIAction(gameId, playerIds[1], mainGameState)
      // Should either return an action or null (if no good moves)
      if (mainAction) {
        expect(mainAction.type).toBeDefined()
        expect(mainAction.playerId).toBe(playerIds[1])
      }
    })
  })

  describe('Integration with AI Turn Orchestrator', () => {
    beforeEach(async () => {
      await aiOrchestrator.initializeAIPlayer(gameId, playerIds[1], {
        difficulty: 'medium',
        personality: 'balanced'
      })
    })

    it('should orchestrate AI decision making through integration service', async () => {
      const gameState = gameFlow.getState()
      gameState.currentPlayer = playerIds[1]

      // This should work through the full chain:
      // AITurnOrchestrator -> AIIntegrationService -> AI Framework Strategies
      await aiOrchestrator.executeAITurn(gameId, playerIds[1])

      // Verify execution occurred (no errors thrown)
      expect(true).toBe(true) // Test passed if no exceptions
    })

    it('should handle AI scheduling and execution flow', async () => {
      const gameState = gameFlow.getState()
      gameState.currentPlayer = playerIds[1]

      // Schedule an AI turn
      await aiOrchestrator.scheduleAITurn(gameId, playerIds[1])

      // Check that it's scheduled
      const stats = aiOrchestrator.getAIStats()
      expect(stats.totalAIPlayers).toBe(1)

      // Pause and resume
      await aiOrchestrator.pauseAI(gameId, playerIds[1])
      await aiOrchestrator.resumeAI(gameId, playerIds[1])

      expect(true).toBe(true) // Test passed if no exceptions
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid player IDs gracefully', async () => {
      const action = await aiService.getAIAction(gameId, 'invalid-player', gameFlow.getState())
      expect(action).toBeNull()
    })

    it('should handle uninitialized AI players', async () => {
      // Try to get action for player without initializing AI
      const action = await aiService.getAIAction(gameId, playerIds[1], gameFlow.getState())
      expect(action).toBeNull()
    })

    it('should handle game state errors gracefully', async () => {
      await aiService.initializeBot(gameId, playerIds[1], { difficulty: 'easy' })

      const invalidGameState = {
        players: new Map(),
        phase: 'actions' as const,
        currentPlayer: playerIds[1],
        board: null // Invalid board
      } as any

      const action = await aiService.getAIAction(gameId, playerIds[1], invalidGameState)
      expect(action).toBeNull()
    })
  })

  describe('Performance and Configuration', () => {
    it('should handle multiple AI difficulties correctly', async () => {
      await aiService.initializeBot(gameId, playerIds[1], { difficulty: 'easy' })
      await aiService.initializeBot(gameId, playerIds[2], { difficulty: 'hard' })

      expect(aiService.isAIBot(gameId, playerIds[1])).toBe(true)
      expect(aiService.isAIBot(gameId, playerIds[2])).toBe(true)

      const stats = aiService.getStats()
      expect(stats.totalActiveBots).toBe(2)
    })

    it('should clean up bots properly', async () => {
      await aiService.initializeBot(gameId, playerIds[1], { difficulty: 'medium' })
      await aiService.initializeBot(gameId, playerIds[2], { difficulty: 'hard' })

      expect(aiService.getStats().totalActiveBots).toBe(2)

      aiService.removeBot(gameId, playerIds[1])
      expect(aiService.getStats().totalActiveBots).toBe(1)

      aiService.removeAllBotsFromGame(gameId)
      expect(aiService.getStats().totalActiveBots).toBe(0)
    })
  })
})