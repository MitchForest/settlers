import { describe, it, expect, beforeEach } from 'vitest'
import { GameFlowManager } from '@settlers/game-engine'
import { VertexSetupNextVPBot, BotConfig } from '../bots/vertex-setup+next-vp'

describe('VertexSetupNextVPBot', () => {
  let gameFlow: GameFlowManager
  let bot: VertexSetupNextVPBot
  let config: BotConfig

  beforeEach(() => {
    // Create a test game
    gameFlow = new GameFlowManager()
    gameFlow.createGame({
      playerNames: ['TestBot', 'Human'],
      randomizePlayerOrder: false
    })

    config = {
      playerId: 'player_0',
      thinkingTimeMs: 0, // No delay for tests
      enableLogging: false
    }

    bot = new VertexSetupNextVPBot(gameFlow, config)
  })

  describe('Bot Configuration', () => {
    it('should create bot with correct config', () => {
      expect(bot).toBeDefined()
    })

    it('should use default config values when not provided', () => {
      const defaultBot = new VertexSetupNextVPBot(gameFlow, { playerId: 'test' })
      expect(defaultBot).toBeDefined()
    })
  })

  describe('Setup Strategy Testing', () => {
    it('should select first settlement in setup1 phase', () => {
      const gameState = gameFlow.getState()
      
      // Ensure we're in setup1 phase
      expect(gameState.phase).toBe('setup1')
      expect(gameState.currentPlayer).toBe('player_0')

      const action = bot.testSetupStrategy(gameState, 'setup1')
      
      expect(action).toBeDefined()
      expect(action?.type).toBe('build')
      expect(action?.data.buildingType).toBe('settlement')
      expect(action?.data.position).toBeDefined()
    })

    it('should select appropriate road after settlement placement', () => {
      // Place first settlement
      const settlementAction = bot.testSetupStrategy(gameFlow.getState(), 'setup1')
      expect(settlementAction).toBeDefined()
      
      if (settlementAction) {
        const result = gameFlow.processAction(settlementAction)
        expect(result.success).toBe(true)
      }

      // Now test road selection
      const roadAction = bot.testSetupStrategy(gameFlow.getState(), 'setup1')
      expect(roadAction).toBeDefined()
      expect(roadAction?.type).toBe('build')
      expect(roadAction?.data.buildingType).toBe('road')
    })
  })

  describe('Action Strategy Testing', () => {
    it('should select valid action in main game phase', () => {
      // Fast-forward to main game
      // This is a simplified test - in reality we'd set up the game state properly
      const gameState = gameFlow.getState()
      
      // Mock main game phase
      const mockMainGameState = {
        ...gameState,
        phase: 'actions' as const,
        currentPlayer: 'player_0'
      }

      const action = bot.testActionStrategy(mockMainGameState)
      
      // Should either return a valid action or null (if no good moves)
      if (action) {
        expect(action.type).toBeDefined()
        expect(action.playerId).toBe('player_0')
      }
    })
  })

  describe('Turn Execution', () => {
    it('should handle not being current player', async () => {
      // Change current player to someone else
      const gameState = gameFlow.getState()
      gameState.currentPlayer = 'player_1'

      const result = await bot.executeTurn()
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('Not this player\'s turn')
      expect(result.actionsExecuted).toHaveLength(0)
    })

    it('should prevent concurrent turn execution', async () => {
      // Start first turn execution
      const firstTurn = bot.executeTurn()
      
      // Try to start second turn immediately
      const secondTurn = await bot.executeTurn()
      
      expect(secondTurn.success).toBe(false)
      expect(secondTurn.error).toContain('already processing')
      
      // Wait for first turn to complete
      const firstResult = await firstTurn
      expect(firstResult.success).toBe(true)
    })
  })

  describe('Phase Detection', () => {
    it('should select correct action based on game phase', () => {
      const gameState = gameFlow.getState()
      
      // Test setup1 phase
      expect(gameState.phase).toBe('setup1')
      const setupAction = bot.getNextAction(gameState)
      expect(setupAction?.type).toBe('build')
      expect(setupAction?.data.buildingType).toBe('settlement')
    })
  })

  describe('Strategy Composition', () => {
    it('should use setup strategy for setup phases', () => {
      const gameState = gameFlow.getState()
      
      const setupAction = bot.testSetupStrategy(gameState, 'setup1')
      const nextAction = bot.getNextAction(gameState)
      
      // Both should return settlement placement in setup1
      expect(setupAction?.type).toBe('build')
      expect(nextAction?.type).toBe('build')
      expect(setupAction?.data.buildingType).toBe('settlement')
      expect(nextAction?.data.buildingType).toBe('settlement')
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid game state gracefully', () => {
      const invalidState = {
        ...gameFlow.getState(),
        players: new Map() // Empty players
      }

      const action = bot.getNextAction(invalidState)
      expect(action).toBeNull()
    })
  })
}) 