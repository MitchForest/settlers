import { 
  GameFlowManager, 
  createPlayer,
  GameState,
  PlayerId 
} from '@settlers/game-engine'
import { 
  AutoPlayer, 
  createAutoPlayer, 
  runAutoGame,
  createMultipleAutoPlayers 
} from '../src/auto-player'
import { 
  createAIDecisionSystem,
  getBestActionForPlayer 
} from '../src/ai-coordinator'

describe('Comprehensive AI Game Simulation', () => {
  let gameFlow: GameFlowManager
  let players: Map<PlayerId, AutoPlayer>
  let playerIds: PlayerId[]

  beforeEach(() => {
    // Create a 3-player game
    const playerNames = ['AI-Alice', 'AI-Bob', 'AI-Charlie']
    gameFlow = GameFlowManager.createGame({
      playerNames,
      randomizePlayerOrder: true
    })

    // Get the actual player IDs from the created game
    const gameState = gameFlow.getState()
    playerIds = Array.from(gameState.players.keys())

    // Create AutoPlayers with different personalities and difficulties
    const playerConfigs = [
      {
        playerId: playerIds[0],
        personality: 'aggressive' as const,
        difficulty: 'hard' as const,
        thinkingTimeMs: 100, // Fast for testing
        maxActionsPerTurn: 15,
        enableLogging: true
      },
      {
        playerId: playerIds[1],
        personality: 'economic' as const,
        difficulty: 'medium' as const,
        thinkingTimeMs: 100,
        maxActionsPerTurn: 15,
        enableLogging: true
      },
      {
        playerId: playerIds[2],
        personality: 'balanced' as const,
        difficulty: 'hard' as const,
        thinkingTimeMs: 100,
        maxActionsPerTurn: 15,
        enableLogging: true
      }
    ]

    players = createMultipleAutoPlayers(gameFlow, playerConfigs)

    console.log('🎮 Game Setup Complete:')
    console.log(`🏆 Game ID: ${gameState.id}`)
    console.log(`👥 Players: ${playerNames.join(', ')}`)
    console.log(`🎯 AI Personalities: ${playerConfigs.map(p => p.personality).join(', ')}`)
    console.log(`⚡ AI Difficulties: ${playerConfigs.map(p => p.difficulty).join(', ')}`)
  })

  test('AI can complete setup phase (initial placements)', async () => {
    console.log('\n🏗️ === SETUP PHASE TEST ===')
    
    let setupTurns = 0
    const maxSetupTurns = 20 // Safety limit

    while (setupTurns < maxSetupTurns) {
      const state = gameFlow.getState()
      
      // Check if setup is complete
      if (!state.phase.startsWith('setup')) {
        console.log(`✅ Setup phase completed after ${setupTurns} turns`)
        console.log(`🎯 Current phase: ${state.phase}`)
        break
      }

      const currentPlayerId = state.currentPlayer
      const autoPlayer = players.get(currentPlayerId)

      console.log(`\n🔄 Setup Turn ${setupTurns + 1}: Player ${currentPlayerId} (${state.phase})`)
      
      expect(autoPlayer).toBeDefined()
      expect(autoPlayer!.canAct()).toBe(true)

      // Execute AI turn
      const result = await autoPlayer!.executeTurn()
      setupTurns++

      console.log(`📊 Turn result: ${result.success ? 'SUCCESS' : 'FAILED'}`)
      console.log(`🎬 Actions executed: ${result.actionsExecuted.length}`)
      
      if (result.actionsExecuted.length > 0) {
        result.actionsExecuted.forEach((action, i) => {
          console.log(`  ${i + 1}. ${action.type} ${JSON.stringify(action.data)}`)
        })
      }

      expect(result.success).toBe(true)
      expect(result.actionsExecuted.length).toBeGreaterThan(0)

      // Verify state progression
      const newState = gameFlow.getState()
      expect(newState.turn).toBeGreaterThanOrEqual(state.turn)
    }

    // Verify all players have completed setup
    const finalState = gameFlow.getState()
    expect(finalState.phase).not.toMatch(/setup/)
    
    // Verify each player has their initial buildings
    playerIds.forEach(playerId => {
      const player = finalState.players.get(playerId)!
      
      // Count buildings on board
      let settlementsOnBoard = 0
      let roadsOnBoard = 0
      
      for (const [, vertex] of finalState.board.vertices) {
        if (vertex.building?.owner === playerId && vertex.building.type === 'settlement') {
          settlementsOnBoard++
        }
      }
      
      for (const [, edge] of finalState.board.edges) {
        if (edge.connection?.owner === playerId && edge.connection.type === 'road') {
          roadsOnBoard++
        }
      }

      console.log(`👤 ${playerId}: ${settlementsOnBoard} settlements, ${roadsOnBoard} roads on board`)
      expect(settlementsOnBoard).toBe(2) // Each player should have 2 settlements
      expect(roadsOnBoard).toBe(2)       // Each player should have 2 roads
    })

    console.log(`🎯 Setup phase completed successfully in ${setupTurns} turns!`)
  }, 30000) // 30 second timeout

  test('AI can play main game for 20 turns with sophisticated decision making', async () => {
    console.log('\n🎲 === MAIN GAME SIMULATION (20 TURNS) ===')
    
    // First complete setup
    await runGameUntilPhase('actions')
    
    const startState = gameFlow.getState()
    const startTurn = startState.turn
    const targetTurn = startTurn + 20
    
    console.log(`🚀 Starting main game simulation from turn ${startTurn} to ${targetTurn}`)
    
    let gameMetrics = {
      totalActions: 0,
      buildingsBuilt: 0,
      tradesExecuted: 0,
      cardsPlayed: 0,
      phaseTransitions: new Set<string>()
    }

    // Track each player's progress
    const playerMetrics = new Map<PlayerId, {
      actionsExecuted: number,
      successfulTurns: number,
      failedTurns: number,
      resourcesGained: number,
      buildingsBuilt: number
    }>()

    playerIds.forEach(playerId => {
      playerMetrics.set(playerId, {
        actionsExecuted: 0,
        successfulTurns: 0,
        failedTurns: 0,
        resourcesGained: 0,
        buildingsBuilt: 0
      })
    })

    while (gameFlow.getState().turn < targetTurn) {
      const state = gameFlow.getState()
      
      // Safety check for game end
      if (state.winner || state.phase === 'ended') {
        console.log(`🏆 Game ended early - Winner: ${state.winner}`)
        break
      }

      const currentPlayerId = state.currentPlayer
      const autoPlayer = players.get(currentPlayerId)

      console.log(`\n🎯 Turn ${state.turn}: Player ${currentPlayerId} (Phase: ${state.phase})`)
      gameMetrics.phaseTransitions.add(state.phase)

      expect(autoPlayer).toBeDefined()
      expect(autoPlayer!.canAct()).toBe(true)

      // Get AI analysis before action
      const aiAnalysis = await analyzeAIDecision(state, currentPlayerId)
      console.log(`🧠 AI Analysis: ${aiAnalysis}`)

      // Execute AI turn with detailed logging
      const result = await autoPlayer!.executeTurn()
      
      // Update metrics
      const playerMetric = playerMetrics.get(currentPlayerId)!
      playerMetric.actionsExecuted += result.actionsExecuted.length
      if (result.success) {
        playerMetric.successfulTurns++
      } else {
        playerMetric.failedTurns++
      }

      gameMetrics.totalActions += result.actionsExecuted.length

      // Analyze actions executed
      result.actionsExecuted.forEach((action, i) => {
        console.log(`  📋 Action ${i + 1}: ${action.type}`)
        
        if (action.type === 'build') {
          gameMetrics.buildingsBuilt++
          playerMetric.buildingsBuilt++
          console.log(`    🏗️ Building: ${action.data.buildingType} at ${action.data.position || action.data.vertexId || action.data.edgeId}`)
        } else if (action.type === 'bankTrade' || action.type === 'portTrade') {
          gameMetrics.tradesExecuted++
          console.log(`    💱 Trade: Give ${JSON.stringify(action.data.offering)} → Get ${JSON.stringify(action.data.requesting)}`)
        } else if (action.type === 'playCard') {
          gameMetrics.cardsPlayed++
          console.log(`    🃏 Played: ${action.data.cardType}`)
        } else if (action.type === 'roll') {
          console.log(`    🎲 Rolled: ${action.data.dice1} + ${action.data.dice2} = ${action.data.total}`)
        } else {
          console.log(`    ⚡ Data: ${JSON.stringify(action.data)}`)
        }
      })

      console.log(`📊 Turn Result: ${result.success ? '✅ SUCCESS' : '❌ FAILED'} (${result.actionsExecuted.length} actions, ${result.stats.decisionTimeMs}ms)`)
      
      if (!result.success && result.error) {
        console.log(`❌ Error: ${result.error}`)
      }

      expect(result.success).toBe(true)

      // Verify game state progression
      const newState = gameFlow.getState()
      
      // Log player status every few turns
      if (state.turn % 5 === 0) {
        logPlayerStatus(newState)
      }
    }

    // Final analysis
    const finalState = gameFlow.getState()
    console.log('\n📈 === FINAL GAME ANALYSIS ===')
    console.log(`🎯 Turns completed: ${finalState.turn - startTurn}`)
    console.log(`⚡ Total actions: ${gameMetrics.totalActions}`)
    console.log(`🏗️ Buildings built: ${gameMetrics.buildingsBuilt}`)
    console.log(`💱 Trades executed: ${gameMetrics.tradesExecuted}`)
    console.log(`🃏 Cards played: ${gameMetrics.cardsPlayed}`)
    console.log(`🔄 Phases encountered: ${Array.from(gameMetrics.phaseTransitions).join(', ')}`)

    // Player performance analysis
    console.log('\n👥 === PLAYER PERFORMANCE ===')
    playerIds.forEach(playerId => {
      const metrics = playerMetrics.get(playerId)!
      const player = finalState.players.get(playerId)!
      const successRate = (metrics.successfulTurns / (metrics.successfulTurns + metrics.failedTurns) * 100).toFixed(1)
      
      console.log(`👤 ${playerId}:`)
      console.log(`  🎯 Success Rate: ${successRate}%`)
      console.log(`  ⚡ Actions: ${metrics.actionsExecuted}`)
      console.log(`  🏗️ Buildings: ${metrics.buildingsBuilt}`)
      console.log(`  🏆 Victory Points: ${player.score.total}`)
      console.log(`  💎 Resources: ${Object.values(player.resources).reduce((a, b) => a + b, 0)}`)
    })

    // Test expectations
    expect(gameMetrics.totalActions).toBeGreaterThan(40) // At least 2 actions per turn on average
    expect(gameMetrics.buildingsBuilt).toBeGreaterThan(5) // Some building activity
    expect(gameMetrics.phaseTransitions.size).toBeGreaterThanOrEqual(3) // Multiple game phases

    // Ensure all AIs are playing actively
    playerIds.forEach(playerId => {
      const metrics = playerMetrics.get(playerId)!
      expect(metrics.successfulTurns).toBeGreaterThan(5) // Each AI should have several successful turns
      expect(metrics.actionsExecuted).toBeGreaterThan(10) // Each AI should execute many actions
    })

    console.log('\n🎉 20-turn simulation completed successfully!')
  }, 60000) // 60 second timeout

  test('AI demonstrates strategic goal-driven behavior', async () => {
    console.log('\n🧠 === AI STRATEGIC ANALYSIS TEST ===')
    
    // Complete setup first
    await runGameUntilPhase('actions')
    
    // Run a few turns to see strategic behavior
    for (let i = 0; i < 5; i++) {
      const state = gameFlow.getState()
      
      if (state.winner || state.phase === 'ended') break
      
      const currentPlayerId = state.currentPlayer
      const autoPlayer = players.get(currentPlayerId)!
      
      console.log(`\n🎯 Strategic Analysis Turn ${i + 1}: ${currentPlayerId}`)
      
      // Get AI's current goals and strategy
      const aiDecisionSystem = createAIDecisionSystem(state, currentPlayerId, 'hard', 'balanced')
      const goalInfo = aiDecisionSystem.getCurrentGoal()
      const victoryAnalysis = aiDecisionSystem.getVictoryAnalysis()
      
      console.log(`🎯 Current Goal: ${goalInfo?.description || 'No specific goal'}`)
      if (goalInfo) {
        console.log(`📊 Goal Priority: ${goalInfo.priority}`)
        console.log(`🏆 Goal Value: ${goalInfo.value}`)
      }
      
      if (victoryAnalysis) {
        console.log(`🚀 Victory Strategy: ${victoryAnalysis.fastestPath.description}`)
        console.log(`⏱️ Target Turns: ${victoryAnalysis.fastestPath.targetTurns}`)
        console.log(`🎲 Efficiency: ${victoryAnalysis.fastestPath.efficiency.toFixed(2)} VP/turn`)
      }
      
      // Get preview of next action
      const nextAction = autoPlayer.previewNextAction()
      if (nextAction) {
        console.log(`🔍 Next Action Preview: ${nextAction.action.type} (Score: ${nextAction.score})`)
        console.log(`💭 Reasoning: ${nextAction.reasoning.slice(0, 2).join(', ')}`)
      }
      
      // Execute the turn
      const result = await autoPlayer.executeTurn()
      expect(result.success).toBe(true)
      
      // Verify strategic behavior indicators
      if (goalInfo) {
        expect(goalInfo.priority).toBeGreaterThan(0)
        expect(goalInfo.description).toBeTruthy()
      }
      
      if (nextAction) {
        expect(nextAction.score).toBeGreaterThan(0)
        expect(nextAction.reasoning.length).toBeGreaterThan(0)
      }
    }
    
    console.log('✅ AI demonstrates strategic goal-driven behavior')
  }, 30000)

  // Helper function to run game until specific phase
  async function runGameUntilPhase(targetPhase: string, maxTurns: number = 50): Promise<void> {
    let turns = 0
    
    while (turns < maxTurns) {
      const state = gameFlow.getState()
      
      if (state.phase === targetPhase) {
        console.log(`✅ Reached phase '${targetPhase}' after ${turns} turns`)
        return
      }
      
      if (state.winner || state.phase === 'ended') {
        throw new Error(`Game ended before reaching '${targetPhase}' phase`)
      }
      
      const currentPlayerId = state.currentPlayer
      const autoPlayer = players.get(currentPlayerId)
      
      if (!autoPlayer || !autoPlayer.canAct()) {
        throw new Error(`No AI player available for ${currentPlayerId}`)
      }
      
      const result = await autoPlayer.executeTurn()
      if (!result.success) {
        throw new Error(`AI turn failed: ${result.error}`)
      }
      
      turns++
    }
    
    throw new Error(`Failed to reach '${targetPhase}' phase within ${maxTurns} turns`)
  }

  // Helper function to analyze AI decision making
  async function analyzeAIDecision(state: GameState, playerId: PlayerId): Promise<string> {
    const bestAction = getBestActionForPlayer(state, playerId, 'hard', 'balanced')
    if (!bestAction) return 'No action available'
    
    return `${bestAction.type} action chosen`
  }

  // Helper function to log player status
  function logPlayerStatus(state: GameState): void {
    console.log('\n📊 === PLAYER STATUS ===')
    playerIds.forEach(playerId => {
      const player = state.players.get(playerId)!
      const totalResources = Object.values(player.resources).reduce((a, b) => a + b, 0)
      
      console.log(`👤 ${playerId}: ${player.score.total} VP, ${totalResources} resources, ${player.developmentCards.length} dev cards`)
    })
  }
})