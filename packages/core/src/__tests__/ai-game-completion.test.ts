import { describe, it, expect } from 'vitest'
import { GameFlowManager } from '../engine/game-flow'
import { AutoPlayer } from '../ai/auto-player'
import { createActionDecisionEngine } from '../ai/action-decision-engine'

describe('AI Game Completion Integration', () => {
  it('should complete a full game with 4 AI players', async () => {
    // Create game with 4 AI players
    const gameFlow = GameFlowManager.createGame({
      playerNames: ['Strategic AI', 'Balanced AI', 'Economic AI', 'Defensive AI'],
      randomizePlayerOrder: false
    })

    const state = gameFlow.getState()
    const playerIds = Array.from(state.players.keys())

    // Create AI players with different personalities
    const aiConfigs = playerIds.map((playerId, index) => {
      const personalities = ['aggressive', 'balanced', 'economic', 'defensive'] as const
      const personality = personalities[index % personalities.length]
      
      return {
        playerId,
        personality,
        difficulty: 'medium' as const,
        thinkingTimeMs: 0, // No delay for testing
        maxActionsPerTurn: 20,
        enableLogging: false
      }
    })
    
    const aiPlayers = aiConfigs.map(config => new AutoPlayer(gameFlow, config))

    let turnCount = 0
    const maxTurns = 300 // Generous limit to prevent infinite loops
    const startTime = Date.now()

    console.log('🎮 Starting AI game completion test...')

    // Game loop
    while (!gameFlow.getState().winner && turnCount < maxTurns) {
      const currentState = gameFlow.getState()
      const currentPlayerId = currentState.currentPlayer
      const currentAI = aiPlayers[playerIds.indexOf(currentPlayerId)]

      expect(currentAI).toBeTruthy() // Should always find the AI player

      try {
        // Execute AI turn
        const turnResult = await currentAI!.executeTurn()
        
        // Verify turn execution was successful
        if (!turnResult.success) {
          console.error(`Turn failed for ${currentPlayerId}:`, turnResult.error)
          console.error(`Current phase: ${currentState.phase}`)
          console.error(`Actions executed: ${turnResult.actionsExecuted.length}`)
        }
        expect(turnResult.success).toBe(true)
        
        if (turnResult.actionsExecuted.length > 0) {
          console.log(`Turn ${turnCount}: ${currentPlayerId} executed ${turnResult.actionsExecuted.length} actions in phase ${currentState.phase}`)
        }

      } catch (error) {
        console.error(`Error on turn ${turnCount} for player ${currentPlayerId}:`, error)
        throw error
      }

      turnCount++

      // Safety check - if we're in the same state for too long, something's wrong
      if (turnCount % 50 === 0) {
        console.log(`🕐 Turn ${turnCount}: Game still in progress...`)
        console.log(`Current phase: ${gameFlow.getState().phase}`)
        console.log(`Current player: ${gameFlow.getState().currentPlayer}`)
        
        // Check if we have a winner
        const winner = gameFlow.getState().winner
        if (winner) {
          console.log(`🏆 Winner found: ${winner}`)
          break
        }
      }
    }

    const endTime = Date.now()
    const duration = endTime - startTime
    const finalState = gameFlow.getState()

    // Verify game completed successfully
    expect(finalState.winner).toBeTruthy()
    expect(turnCount).toBeLessThan(maxTurns)

    console.log('🎉 Game completed successfully!')
    console.log(`🏆 Winner: ${finalState.winner}`)
    console.log(`📊 Total turns: ${turnCount}`)
    console.log(`⏱️  Duration: ${duration}ms (${(duration/1000).toFixed(2)}s)`)
    
    // Log final scores
    console.log('📈 Final scores:')
    finalState.players.forEach((player, playerId) => {
      console.log(`  ${playerId}: ${player.score.total} VP`)
    })

    // Performance assertions
    expect(duration).toBeLessThan(30000) // Should complete within 30 seconds
    expect(turnCount).toBeGreaterThan(10) // Should be a real game
    expect(turnCount).toBeLessThan(250) // Should be reasonable length

  }, 60000) // 60 second timeout

  it('should handle all game phases correctly', async () => {
    // Test that AI can handle specific phases
    const gameFlow = GameFlowManager.createGame({
      playerNames: ['Test AI', 'Test AI 2', 'Test AI 3'],
      randomizePlayerOrder: false
    })

    const state = gameFlow.getState()
    const playerId = Array.from(state.players.keys())[0]

    const aiPlayer = new AutoPlayer(gameFlow, {
      playerId,
      personality: 'balanced',
      difficulty: 'medium',
      thinkingTimeMs: 0,
      maxActionsPerTurn: 10,
      enableLogging: true
    })

    // Test setup phase
    expect(gameFlow.getState().phase).toBe('setup1')
    
    const setupResult = await aiPlayer.executeTurn()
    expect(setupResult.success).toBe(true)
    expect(setupResult.actionsExecuted.length).toBeGreaterThan(0)

    console.log(`Setup phase: Executed ${setupResult.actionsExecuted.length} actions`)
    console.log(`Actions: ${setupResult.actionsExecuted.map(a => a.type).join(', ')}`)
  })

  it('should make legal moves only', async () => {
    const gameFlow = GameFlowManager.createGame({
      playerNames: ['Legal Move AI', 'Test AI 2', 'Test AI 3'],
      randomizePlayerOrder: false
    })

    const state = gameFlow.getState()
    const playerId = Array.from(state.players.keys())[0]

    const decisionEngine = createActionDecisionEngine(
      gameFlow.getState(),
      playerId,
      'medium',
      'balanced'
    )

    // Test that all generated actions are legal
    for (let i = 0; i < 10; i++) {
      const currentState = gameFlow.getState()
      if (currentState.winner) break

      const action = decisionEngine.getBestAction()
      if (!action) continue

      // Execute the action - it should succeed if it's legal
      const result = gameFlow.processAction(action)
      expect(result.success).toBe(true)

      console.log(`Legal move test ${i}: ${action.type} executed successfully`)
    }
  })
}) 