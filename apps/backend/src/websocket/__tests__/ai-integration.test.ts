import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { aiManager, stopAIManager } from '../ai-handler'
import { GameFlowManager, PlayerId } from '@settlers/core'

describe('AI WebSocket Integration', () => {
  beforeEach(() => {
    // Clean slate for each test
  })

  afterEach(() => {
    // Clean up any registered games
    const summary = aiManager.getAISummary()
    for (const game of summary.games) {
      aiManager.unregisterGame(game.gameId)
    }
  })

  test('should register and unregister games', () => {
    const gameFlow = GameFlowManager.createGame({
      playerNames: ['AI Player 1', 'AI Player 2', 'Human Player'],
      gameId: 'test-game'
    })

    // Register game
    aiManager.registerGame('test-game', gameFlow)
    
    let summary = aiManager.getAISummary()
    expect(summary.totalGames).toBe(1)
    expect(summary.games[0].gameId).toBe('test-game')

    // Unregister game
    aiManager.unregisterGame('test-game')
    
    summary = aiManager.getAISummary()
    expect(summary.totalGames).toBe(0)
  })

  test('should enable and disable auto-mode', () => {
    const gameFlow = GameFlowManager.createGame({
      playerNames: ['AI Player 1', 'AI Player 2', 'Human Player'],
      gameId: 'test-game'
    })

    aiManager.registerGame('test-game', gameFlow)
    
    // Enable auto-mode
    const enabled = aiManager.enableAutoMode('test-game', 'player1' as PlayerId)
    expect(enabled).toBe(true)
    
    // Check AI is registered
    expect(aiManager.isPlayerAI('test-game', 'player1' as PlayerId)).toBe(true)
    
    let summary = aiManager.getAISummary()
    expect(summary.totalAIPlayers).toBe(1)
    expect(summary.autoModePlayers).toBe(1)
    expect(summary.disconnectedPlayers).toBe(0)
    
    // Disable auto-mode
    const disabled = aiManager.disableAutoMode('test-game', 'player1' as PlayerId)
    expect(disabled).toBe(true)
    
    // Check AI is removed
    expect(aiManager.isPlayerAI('test-game', 'player1' as PlayerId)).toBe(false)
    
    summary = aiManager.getAISummary()
    expect(summary.totalAIPlayers).toBe(0)
  })

  test('should handle disconnections and reconnections', () => {
    const gameFlow = GameFlowManager.createGame({
      playerNames: ['AI Player 1', 'AI Player 2', 'Human Player'],
      gameId: 'test-game'
    })

    aiManager.registerGame('test-game', gameFlow)
    
    // Simulate disconnection - should create AI takeover
    aiManager.handlePlayerDisconnection('test-game', 'player1' as PlayerId)
    
    expect(aiManager.isPlayerAI('test-game', 'player1' as PlayerId)).toBe(true)
    
    let summary = aiManager.getAISummary()
    expect(summary.totalAIPlayers).toBe(1)
    expect(summary.autoModePlayers).toBe(0)
    expect(summary.disconnectedPlayers).toBe(1)
    
    // Simulate reconnection - should remove AI takeover
    const mockSocket = { 
      readyState: 1,
      send: () => {},
      data: { playerId: 'player1' }
    } as any
    
    aiManager.handlePlayerReconnection('test-game', 'player1' as PlayerId, mockSocket)
    
    expect(aiManager.isPlayerAI('test-game', 'player1' as PlayerId)).toBe(false)
    
    summary = aiManager.getAISummary()
    expect(summary.totalAIPlayers).toBe(0)
  })

  test('should preserve auto-mode on reconnection', () => {
    const gameFlow = GameFlowManager.createGame({
      playerNames: ['AI Player 1', 'AI Player 2', 'Human Player'],
      gameId: 'test-game'
    })

    aiManager.registerGame('test-game', gameFlow)
    
    // Enable auto-mode first
    aiManager.enableAutoMode('test-game', 'player1' as PlayerId)
    expect(aiManager.isPlayerAI('test-game', 'player1' as PlayerId)).toBe(true)
    
    // Simulate reconnection - should keep auto-mode AI
    const mockSocket = { 
      readyState: 1,
      send: () => {},
      data: { playerId: 'player1' }
    } as any
    
    aiManager.handlePlayerReconnection('test-game', 'player1' as PlayerId, mockSocket)
    
    // Auto-mode should still be active
    expect(aiManager.isPlayerAI('test-game', 'player1' as PlayerId)).toBe(true)
    
    const summary = aiManager.getAISummary()
    expect(summary.autoModePlayers).toBe(1)
    expect(summary.disconnectedPlayers).toBe(0)
  })

  test('should get AI configuration and stats', () => {
    const gameFlow = GameFlowManager.createGame({
      playerNames: ['AI Player 1', 'AI Player 2', 'Human Player'],
      gameId: 'test-game'
    })

    aiManager.registerGame('test-game', gameFlow)
    
    // Enable auto-mode with custom config
    const enabled = aiManager.enableAutoMode('test-game', 'player1' as PlayerId, {
      personality: 'aggressive',
      difficulty: 'hard'
    })
    expect(enabled).toBe(true)
    
    // Get AI configuration
    const config = aiManager.getAIConfig('test-game', 'player1' as PlayerId)
    expect(config).toBeDefined()
    expect(config?.personality).toBe('aggressive')
    expect(config?.difficulty).toBe('hard')
    
    // Get AI stats
    const stats = aiManager.getAIStats('test-game', 'player1' as PlayerId)
    expect(stats).toBeDefined()
    expect(stats?.turnsPlayed).toBe(0)
    expect(stats?.actionsExecuted).toBe(0)
  })

  test('should update AI configuration', () => {
    const gameFlow = GameFlowManager.createGame({
      playerNames: ['AI Player 1', 'AI Player 2', 'Human Player'],
      gameId: 'test-game'
    })

    aiManager.registerGame('test-game', gameFlow)
    aiManager.enableAutoMode('test-game', 'player1' as PlayerId)
    
    // Update configuration
    const updated = aiManager.updateAIConfig('test-game', 'player1' as PlayerId, {
      personality: 'economic',
      thinkingTimeMs: 5000
    })
    expect(updated).toBe(true)
    
    // Verify update
    const config = aiManager.getAIConfig('test-game', 'player1' as PlayerId)
    expect(config?.personality).toBe('economic')
    expect(config?.thinkingTimeMs).toBe(5000)
  })

  test('should handle non-existent games gracefully', () => {
    // Try to enable auto-mode on non-existent game
    const enabled = aiManager.enableAutoMode('non-existent', 'player1' as PlayerId)
    expect(enabled).toBe(false)
    
    // Try to disable auto-mode on non-existent game  
    const disabled = aiManager.disableAutoMode('non-existent', 'player1' as PlayerId)
    expect(disabled).toBe(false)
    
    // Check player AI status on non-existent game
    expect(aiManager.isPlayerAI('non-existent', 'player1' as PlayerId)).toBe(false)
  })

  test('should provide comprehensive summary', () => {
    // Create multiple games with different AI setups
    const gameFlow1 = GameFlowManager.createGame({
      playerNames: ['AI Player 1', 'AI Player 2', 'Human Player'],
      gameId: 'game1'
    })
    const gameFlow2 = GameFlowManager.createGame({
      playerNames: ['AI Player 1', 'AI Player 2', 'Human Player'],
      gameId: 'game2'
    })

    aiManager.registerGame('game1', gameFlow1)
    aiManager.registerGame('game2', gameFlow2)
    
    // Set up different AI types
    aiManager.enableAutoMode('game1', 'player1' as PlayerId)  // Auto-mode
    aiManager.enableAutoMode('game1', 'player2' as PlayerId)  // Auto-mode
    aiManager.handlePlayerDisconnection('game2', 'player1' as PlayerId)  // Disconnected
    
    const summary = aiManager.getAISummary()
    
    expect(summary.totalGames).toBe(2)
    expect(summary.totalAIPlayers).toBe(3)
    expect(summary.autoModePlayers).toBe(2)
    expect(summary.disconnectedPlayers).toBe(1)
    expect(summary.games).toHaveLength(2)
    
    // Check game-specific data
    const game1Data = summary.games.find(g => g.gameId === 'game1')
    const game2Data = summary.games.find(g => g.gameId === 'game2')
    
    expect(game1Data?.aiPlayers).toBe(2)
    expect(game1Data?.autoMode).toBe(2)
    expect(game1Data?.disconnected).toBe(0)
    
    expect(game2Data?.aiPlayers).toBe(1)
    expect(game2Data?.autoMode).toBe(0)
    expect(game2Data?.disconnected).toBe(1)
  })
}) 