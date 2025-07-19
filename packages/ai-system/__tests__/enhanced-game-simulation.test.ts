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

describe('Enhanced AI Game Simulation with Move Tracking', () => {
  let gameFlow: GameFlowManager
  let players: Map<PlayerId, AutoPlayer>
  let playerIds: PlayerId[]
  let playerNames: string[]

  beforeEach(() => {
    // Create a 3-player game
    playerNames = ['AI-Alpha', 'AI-Beta', 'AI-Gamma']
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
        thinkingTimeMs: 50, // Faster for testing
        maxActionsPerTurn: 8, // Reduced to prevent infinite loops
        enableLogging: false // Reduced logging
      },
      {
        playerId: playerIds[1],
        personality: 'economic' as const,
        difficulty: 'hard' as const,
        thinkingTimeMs: 50,
        maxActionsPerTurn: 8,
        enableLogging: false
      },
      {
        playerId: playerIds[2],
        personality: 'balanced' as const,
        difficulty: 'hard' as const,
        thinkingTimeMs: 50,
        maxActionsPerTurn: 8,
        enableLogging: false
      }
    ]

    players = createMultipleAutoPlayers(gameFlow, playerConfigs)

    console.log('🎮 Enhanced Game Setup Complete:')
    console.log(`🏆 Game ID: ${gameState.id}`)
    console.log(`👥 Players: ${playerNames.join(', ')}`)
    console.log(`🎯 AI Personalities: ${playerConfigs.map(p => p.personality).join(', ')}`)
    console.log(`⚡ AI Difficulties: ${playerConfigs.map(p => p.difficulty).join(', ')}`)
  })

  test('Complete 20-turn game with detailed move tracking and final scoring', async () => {
    console.log('\n🎲 === COMPLETE GAME SIMULATION WITH MOVE TRACKING ===')
    
    // Complete setup first
    await runGameUntilPhase('actions')
    
    const startState = gameFlow.getState()
    const startTurn = startState.turn
    const targetTurn = startTurn + 20
    
    console.log(`🚀 Starting enhanced simulation from turn ${startTurn} to ${targetTurn}`)
    
    // Enhanced tracking structures
    interface TurnRecord {
      turn: number
      player: PlayerId
      playerName: string
      phase: string
      actions: Array<{
        type: string
        details: string
        success: boolean
      }>
      playerState: {
        score: number
        resources: number
        buildings: { settlements: number, cities: number, roads: number }
        developmentCards: number
      }
    }

    const gameHistory: TurnRecord[] = []
    const finalMetrics = {
      totalTurns: 0,
      totalActions: 0,
      buildingsBuilt: 0,
      tradesExecuted: 0,
      cardsPlayed: 0,
      phases: new Set<string>()
    }

    // Player metrics
    const playerStats = new Map<PlayerId, {
      turnsPlayed: number
      actionsExecuted: number
      buildingsBuilt: number
      cardsPlayed: number
      successRate: number
      averageScore: number[]
    }>()

    playerIds.forEach(playerId => {
      playerStats.set(playerId, {
        turnsPlayed: 0,
        actionsExecuted: 0,
        buildingsBuilt: 0,
        cardsPlayed: 0,
        successRate: 0,
        averageScore: []
      })
    })

    // Main game loop with detailed tracking
    while (gameFlow.getState().turn < targetTurn) {
      const state = gameFlow.getState()
      
      // Check for early game end
      if (state.winner || state.phase === 'ended') {
        console.log(`\n🏆 Game ended early on turn ${state.turn} - Winner: ${state.winner}`)
        break
      }

      const currentPlayerId = state.currentPlayer
      const autoPlayer = players.get(currentPlayerId)!
      const playerName = playerNames[playerIds.indexOf(currentPlayerId)]
      
      finalMetrics.phases.add(state.phase)
      
      console.log(`\n📋 TURN ${state.turn}: ${playerName} (${currentPlayerId}) - Phase: ${state.phase}`)
      
      // Capture pre-turn state
      const prePlayer = state.players.get(currentPlayerId)!
      const preTurnScore = prePlayer.score.total
      const preTurnResources = Object.values(prePlayer.resources).reduce((a, b) => a + b, 0)
      
      // Execute AI turn
      const result = await autoPlayer.executeTurn()
      finalMetrics.totalTurns++
      
      // Capture post-turn state
      const newState = gameFlow.getState()
      const postPlayer = newState.players.get(currentPlayerId)!
      
      // Build detailed action log
      const actionLog: TurnRecord['actions'] = []
      let buildingsThisTurn = 0
      let cardsThisTurn = 0
      let tradesThisTurn = 0
      
      result.actionsExecuted.forEach((action, i) => {
        let details = ''
        
        switch (action.type) {
          case 'build':
            details = `${action.data.buildingType} at ${action.data.position || action.data.vertexId || action.data.edgeId}`
            buildingsThisTurn++
            finalMetrics.buildingsBuilt++
            break
          case 'bankTrade':
          case 'portTrade':
            details = `Give ${JSON.stringify(action.data.offering)} → Get ${JSON.stringify(action.data.requesting)}`
            tradesThisTurn++
            finalMetrics.tradesExecuted++
            break
          case 'playCard':
            details = `${action.data.cardType} card`
            cardsThisTurn++
            finalMetrics.cardsPlayed++
            break
          case 'roll':
            details = `${action.data.dice1} + ${action.data.dice2} = ${action.data.total}`
            break
          case 'moveRobber':
            details = `to ${action.data.hexPosition}`
            break
          case 'stealResource':
            details = `from ${action.data.targetPlayerId}`
            break
          default:
            details = JSON.stringify(action.data)
        }
        
        actionLog.push({
          type: action.type,
          details: details,
          success: true
        })
        
        console.log(`  ${i + 1}. ${action.type}: ${details}`)
      })
      
      finalMetrics.totalActions += result.actionsExecuted.length
      
      // Update player stats
      const playerStat = playerStats.get(currentPlayerId)!
      playerStat.turnsPlayed++
      playerStat.actionsExecuted += result.actionsExecuted.length
      playerStat.buildingsBuilt += buildingsThisTurn
      playerStat.cardsPlayed += cardsThisTurn
      playerStat.averageScore.push(postPlayer.score.total)
      
      // Count buildings on board for accurate tracking
      let settlementsOnBoard = 0, citiesOnBoard = 0, roadsOnBoard = 0
      for (const [, vertex] of newState.board.vertices) {
        if (vertex.building?.owner === currentPlayerId) {
          if (vertex.building.type === 'settlement') settlementsOnBoard++
          else if (vertex.building.type === 'city') citiesOnBoard++
        }
      }
      for (const [, edge] of newState.board.edges) {
        if (edge.connection?.owner === currentPlayerId && edge.connection.type === 'road') {
          roadsOnBoard++
        }
      }
      
      // Record this turn
      const turnRecord: TurnRecord = {
        turn: state.turn,
        player: currentPlayerId,
        playerName: playerName,
        phase: state.phase,
        actions: actionLog,
        playerState: {
          score: postPlayer.score.total,
          resources: Object.values(postPlayer.resources).reduce((a, b) => a + b, 0),
          buildings: { settlements: settlementsOnBoard, cities: citiesOnBoard, roads: roadsOnBoard },
          developmentCards: postPlayer.developmentCards.length
        }
      }
      
      gameHistory.push(turnRecord)
      
      console.log(`📊 Turn Summary: ${result.actionsExecuted.length} actions, Score: ${preTurnScore}→${postPlayer.score.total}, Resources: ${preTurnResources}→${turnRecord.playerState.resources}`)
      console.log(`🏗️ Buildings: ${turnRecord.playerState.buildings.settlements}S/${turnRecord.playerState.buildings.cities}C/${turnRecord.playerState.buildings.roads}R, DevCards: ${turnRecord.playerState.developmentCards}`)
      
      // Check if turn was successful
      expect(result.success).toBe(true)
    }

    // Final game analysis
    const finalState = gameFlow.getState()
    
    console.log('\n🏁 === FINAL GAME RESULTS ===')
    console.log(`🎯 Total Turns Played: ${finalMetrics.totalTurns}`)
    console.log(`⚡ Total Actions: ${finalMetrics.totalActions}`)
    console.log(`🏗️ Buildings Built: ${finalMetrics.buildingsBuilt}`)
    console.log(`💱 Trades Executed: ${finalMetrics.tradesExecuted}`)
    console.log(`🃏 Cards Played: ${finalMetrics.cardsPlayed}`)
    console.log(`🔄 Phases Encountered: ${Array.from(finalMetrics.phases).join(', ')}`)
    
    console.log('\n🏆 === FINAL PLAYER SCORES ===')
    const finalScores: Array<{playerId: PlayerId, name: string, score: number, data: any}> = []
    
    playerIds.forEach((playerId, index) => {
      const player = finalState.players.get(playerId)!
      const stats = playerStats.get(playerId)!
      const playerName = playerNames[index]
      
      // Count final buildings
      let settlements = 0, cities = 0, roads = 0
      for (const [, vertex] of finalState.board.vertices) {
        if (vertex.building?.owner === playerId) {
          if (vertex.building.type === 'settlement') settlements++
          else if (vertex.building.type === 'city') cities++
        }
      }
      for (const [, edge] of finalState.board.edges) {
        if (edge.connection?.owner === playerId && edge.connection.type === 'road') roads++
      }
      
      const finalScore = player.score.total
      const totalResources = Object.values(player.resources).reduce((a, b) => a + b, 0)
      
      finalScores.push({
        playerId,
        name: playerName,
        score: finalScore,
        data: {
          resources: totalResources,
          buildings: { settlements, cities, roads },
          developmentCards: player.developmentCards.length,
          knightsPlayed: player.knightsPlayed,
          hasLongestRoad: player.hasLongestRoad,
          hasLargestArmy: player.hasLargestArmy
        }
      })
      
      console.log(`\n👤 ${playerName} (${playerId}):`)
      console.log(`  🏆 FINAL SCORE: ${finalScore} Victory Points`)
      console.log(`  🏗️ Buildings: ${settlements} settlements, ${cities} cities, ${roads} roads`)
      console.log(`  💎 Resources: ${totalResources} cards`)
      console.log(`  🃏 Development Cards: ${player.developmentCards.length}`)
      console.log(`  ⚔️ Knights Played: ${player.knightsPlayed}`)
      console.log(`  🛤️ Longest Road: ${player.hasLongestRoad ? '✅' : '❌'}`)
      console.log(`  🏛️ Largest Army: ${player.hasLargestArmy ? '✅' : '❌'}`)
      console.log(`  📊 Performance: ${stats.turnsPlayed} turns, ${stats.actionsExecuted} actions, ${stats.buildingsBuilt} buildings built`)
    })
    
    // Sort by score for winner announcement
    finalScores.sort((a, b) => b.score - a.score)
    
    console.log('\n🥇 === FINAL RANKINGS ===')
    finalScores.forEach((player, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'
      console.log(`${medal} ${index + 1}. ${player.name}: ${player.score} VP`)
    })
    
    // Game winner
    if (finalState.winner) {
      const winnerName = playerNames[playerIds.indexOf(finalState.winner)]
      console.log(`\n🎉 GAME WINNER: ${winnerName} (${finalState.winner}) with ${finalScores[0].score} Victory Points!`)
    } else {
      console.log(`\n⏱️ Game completed ${finalMetrics.totalTurns} turns without a winner`)
    }
    
    // Detailed move history (last 10 turns for brevity)
    console.log('\n📜 === RECENT MOVE HISTORY (Last 10 Turns) ===')
    const recentHistory = gameHistory.slice(-10)
    recentHistory.forEach(turn => {
      console.log(`\nTurn ${turn.turn} - ${turn.playerName} (${turn.phase}):`)
      turn.actions.forEach((action, i) => {
        console.log(`  ${i + 1}. ${action.type}: ${action.details}`)
      })
      console.log(`  → Score: ${turn.playerState.score}, Resources: ${turn.playerState.resources}, Buildings: ${turn.playerState.buildings.settlements}S/${turn.playerState.buildings.cities}C/${turn.playerState.buildings.roads}R`)
    })
    
    // Test assertions
    expect(finalMetrics.totalActions).toBeGreaterThan(20) // Reasonable activity
    expect(finalMetrics.buildingsBuilt).toBeGreaterThan(3) // Some building progression
    expect(finalMetrics.phases.size).toBeGreaterThanOrEqual(2) // Multiple phases
    expect(finalScores[0].score).toBeGreaterThanOrEqual(2) // Someone should score points
    
    // Ensure all AIs performed
    playerIds.forEach(playerId => {
      const stats = playerStats.get(playerId)!
      expect(stats.turnsPlayed).toBeGreaterThan(3) // Each AI should play multiple turns
      expect(stats.actionsExecuted).toBeGreaterThan(5) // Each AI should execute actions
    })
    
    console.log('\n✅ Enhanced 20-turn simulation completed successfully!')
  }, 90000) // 90 second timeout for comprehensive test

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
})