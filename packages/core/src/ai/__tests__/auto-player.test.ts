import { describe, test, expect } from 'vitest'
import { AutoPlayer, createAutoPlayer, AutoPlayerConfig } from '../auto-player'
import { GameFlowManager } from '../../engine/game-flow'
import { GameState, PlayerId } from '../../types'

describe('AutoPlayer', () => {
  test('should create AutoPlayer successfully', () => {
    // Create a basic game (Settlers requires 3-4 players)
    const gameFlow = GameFlowManager.createGame({
      playerNames: ['AI Player 1', 'AI Player 2', 'Human Player'],
      gameId: 'test-game'
    })

    const config: AutoPlayerConfig = {
      playerId: 'player1' as PlayerId,
      personality: 'balanced',
      difficulty: 'medium',
      thinkingTimeMs: 0, // No delay for tests
      maxActionsPerTurn: 10,
      enableLogging: false // Quiet tests
    }

    const autoPlayer = new AutoPlayer(gameFlow, config)
    
    expect(autoPlayer).toBeDefined()
    expect(autoPlayer.getStats).toBeDefined()
    expect(autoPlayer.canAct).toBeDefined()
    expect(autoPlayer.executeTurn).toBeDefined()
  })

  test('should create AutoPlayer with utility function', () => {
    const gameFlow = GameFlowManager.createGame({
      playerNames: ['AI Player 1', 'AI Player 2', 'Human Player'],
      gameId: 'test-game'
    })

    const autoPlayer = createAutoPlayer(gameFlow, 'player1' as PlayerId, {
      thinkingTimeMs: 0,
      enableLogging: false
    })
    
    expect(autoPlayer).toBeDefined()
    expect(autoPlayer.getStats().turnsPlayed).toBe(0)
  })

  test('should detect when it can act', () => {
    const gameFlow = GameFlowManager.createGame({
      playerNames: ['AI Player 1', 'AI Player 2', 'Human Player'],
      gameId: 'test-game'
    })

    const autoPlayer = createAutoPlayer(gameFlow, 'player1' as PlayerId, {
      enableLogging: false
    })

    // Should be able to act if it's the current player
    const canAct = autoPlayer.canAct()
    
    // The result depends on game state, but method should not throw
    expect(typeof canAct).toBe('boolean')
  })

  test('should get initial stats correctly', () => {
    const gameFlow = GameFlowManager.createGame({
      playerNames: ['AI Player 1', 'AI Player 2', 'Human Player'],
      gameId: 'test-game'
    })

    const autoPlayer = createAutoPlayer(gameFlow, 'player1' as PlayerId, {
      enableLogging: false
    })

    const stats = autoPlayer.getStats()
    
    expect(stats.turnsPlayed).toBe(0)
    expect(stats.actionsExecuted).toBe(0)
    expect(stats.successfulActions).toBe(0)
    expect(stats.failedActions).toBe(0)
    expect(stats.averageDecisionTime).toBe(0)
    expect(stats.lastActionTime).toBeInstanceOf(Date)
  })

  test('should preview next action without executing', () => {
    const gameFlow = GameFlowManager.createGame({
      playerNames: ['AI Player 1', 'AI Player 2', 'Human Player'],
      gameId: 'test-game'
    })

    const autoPlayer = createAutoPlayer(gameFlow, 'player1' as PlayerId, {
      enableLogging: false
    })

    const preview = autoPlayer.previewNextAction()
    
    // Preview might be null if player can't act, but should not throw
    expect(preview === null || typeof preview === 'object').toBe(true)
  })

  test('should handle different personality types', () => {
    const gameFlow = GameFlowManager.createGame({
      playerNames: ['AI Player 1', 'AI Player 2', 'Human Player'],
      gameId: 'test-game'
    })

    const personalities: Array<AutoPlayerConfig['personality']> = ['aggressive', 'balanced', 'defensive', 'economic']
    
    for (const personality of personalities) {
      const autoPlayer = createAutoPlayer(gameFlow, 'player1' as PlayerId, {
        personality,
        enableLogging: false
      })
      
      expect(autoPlayer).toBeDefined()
      expect(autoPlayer.getStats()).toBeDefined()
    }
  })

  test('should handle different difficulty levels', () => {
    const gameFlow = GameFlowManager.createGame({
      playerNames: ['AI Player 1', 'AI Player 2', 'Human Player'],
      gameId: 'test-game'
    })

    const difficulties: Array<AutoPlayerConfig['difficulty']> = ['easy', 'medium', 'hard']
    
    for (const difficulty of difficulties) {
      const autoPlayer = createAutoPlayer(gameFlow, 'player1' as PlayerId, {
        difficulty,
        enableLogging: false
      })
      
      expect(autoPlayer).toBeDefined()
      expect(autoPlayer.getStats()).toBeDefined()
    }
  })

  test('should allow configuration updates', () => {
    const gameFlow = GameFlowManager.createGame({
      playerNames: ['AI Player 1', 'AI Player 2', 'Human Player'],
      gameId: 'test-game'
    })

    const autoPlayer = createAutoPlayer(gameFlow, 'player1' as PlayerId, {
      personality: 'balanced',
      enableLogging: false
    })

    // Should not throw when updating config
    expect(() => {
      autoPlayer.updateConfig({
        personality: 'aggressive',
        difficulty: 'hard'
      })
    }).not.toThrow()
  })

  test('should provide force stop functionality', () => {
    const gameFlow = GameFlowManager.createGame({
      playerNames: ['AI Player 1', 'AI Player 2', 'Human Player'],
      gameId: 'test-game'
    })

    const autoPlayer = createAutoPlayer(gameFlow, 'player1' as PlayerId, {
      enableLogging: false
    })

    // Should not throw when force stopping
    expect(() => {
      autoPlayer.forceStop()
    }).not.toThrow()
  })
}) 