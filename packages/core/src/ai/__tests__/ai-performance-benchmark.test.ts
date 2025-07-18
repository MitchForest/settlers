import { describe, test, expect } from 'vitest'
import { GameState, PlayerId } from '../../types'
import { GameFlowManager } from '../../engine/game-flow'
import { processAction } from '../../engine/action-processor-v2'
import { getBestActionForPlayer } from '../action-decision-engine'

interface BenchmarkResult {
  gameNumber: number
  playerCount: number
  winner: PlayerId | null
  turnCount: number
  finalScores: Map<PlayerId, number>
  winnerScore: number
  averageTurnDuration: number
  buildingStats: {
    cities: number
    settlements: number
    devCards: number
  }
  aiDifficulty: string
  aiPersonality: string
}

interface BenchmarkSummary {
  playerCount: number
  totalGames: number
  completedGames: number
  averageTurns: number
  winsUnder30Turns: number
  winPercentage: number
  averageWinnerScore: number
  fastestWin: number
  slowestWin: number
  timeouts: number
  configuration: string
}

/**
 * AI PERFORMANCE BENCHMARK
 * 
 * This benchmark measures AI vs AI performance across different game configurations:
 * - 3-player games (all AI)
 * - 4-player games (all AI) 
 * - Different AI difficulty/personality combinations
 * - Win rate and turn efficiency metrics
 * - Target: 30% of wins under 30 turns
 */
describe('AI Performance Benchmark', () => {
  test('4-player AI games - mixed difficulties', async () => {
    const config: BenchmarkConfig = {
      playerCount: 4 as const,
      gameCount: 8,
      aiConfigs: [
        { difficulty: 'hard' as const, personality: 'aggressive' as const },
        { difficulty: 'hard' as const, personality: 'balanced' as const },
        { difficulty: 'medium' as const, personality: 'balanced' as const },
        { difficulty: 'medium' as const, personality: 'economic' as const }
      ]
    }
    
    const summary = await runBenchmarkSuite(config)
    console.log(`\n🎯 4-Player AI Benchmark Results:`)
    printBenchmarkSummary(summary)
    
    // Performance assertions
    expect(summary.completedGames).toBeGreaterThan(0)
    expect(summary.averageTurns).toBeLessThan(50)
    
    // Primary target: 30% of games under 30 turns
    const under30Percentage = summary.winsUnder30Turns / Math.max(1, summary.completedGames)
    console.log(`\n📊 Under-30-turn performance: ${Math.round(under30Percentage * 100)}%`)
    
    // Don't fail yet - just measure baseline
    // expect(under30Percentage).toBeGreaterThanOrEqual(0.3)
  }, 180000) // 3 minute timeout

  test('3-player AI games - competitive', async () => {
    const config: BenchmarkConfig = {
      playerCount: 3 as const,
      gameCount: 6,
      aiConfigs: [
        { difficulty: 'hard' as const, personality: 'aggressive' as const },
        { difficulty: 'hard' as const, personality: 'balanced' as const },
        { difficulty: 'hard' as const, personality: 'economic' as const }
      ]
    }
    
    const summary = await runBenchmarkSuite(config)
    console.log(`\n🎯 3-Player AI Benchmark Results:`)
    printBenchmarkSummary(summary)
    
    // 3-player games should be faster
    expect(summary.completedGames).toBeGreaterThan(0)
    expect(summary.averageTurns).toBeLessThan(45)
  }, 120000) // 2 minute timeout

  test('4-player AI games - all aggressive', async () => {
    const config: BenchmarkConfig = {
      playerCount: 4 as const,
      gameCount: 5,
      aiConfigs: [
        { difficulty: 'hard' as const, personality: 'aggressive' as const },
        { difficulty: 'hard' as const, personality: 'aggressive' as const },
        { difficulty: 'hard' as const, personality: 'aggressive' as const },
        { difficulty: 'hard' as const, personality: 'aggressive' as const }
      ]
    }
    
    const summary = await runBenchmarkSuite(config)
    console.log(`\n🎯 All-Aggressive AI Benchmark Results:`)
    printBenchmarkSummary(summary)
    
    // Aggressive games should be fastest
    expect(summary.completedGames).toBeGreaterThan(0)
    expect(summary.averageTurns).toBeLessThan(40)
  }, 120000)

  test('AI Diagnostic - Single Game Analysis', async () => {
    const gameManager = GameFlowManager.createGame({
      playerNames: ['AI_1', 'AI_2', 'AI_3'],
      gameId: 'diagnostic-game',
      randomizePlayerOrder: false
    })
    
    let gameState = gameManager.getState()
    const maxTurns = 50 // Shorter for diagnostics
    let turnCount = 0
    let winner: PlayerId | null = null
    
    const playerIds = Array.from(gameState.players.keys())
    console.log(`\n🔍 DIAGNOSTIC: 3-Player AI Game`)
    console.log(`Players: ${playerIds.join(', ')}`)
    
    while (!winner && turnCount < maxTurns) {
      turnCount++
      const currentPlayer = gameState.currentPlayer
      
      // Log detailed turn info every 5 turns
      if (turnCount % 5 === 0 || turnCount <= 10) {
        console.log(`\n--- Turn ${turnCount} ---`)
        console.log(`Phase: ${gameState.phase}, Current Player: ${currentPlayer}`)
        
        // Log all player scores and resources
        for (const [playerId, player] of gameState.players) {
          const resources = Object.values(player.resources).reduce((sum, n) => sum + n, 0)
          const citiesBuilt = 4 - (player.buildings?.cities || 4) // Inverted: 4 means 0 built, 0 means 4 built
          const settlementsBuilt = 5 - (player.buildings?.settlements || 5) // Inverted: 5 means 0 built, 0 means 5 built
          console.log(`  ${playerId}: Score=${player.score.total}, Resources=${resources}, Built=${citiesBuilt}C/${settlementsBuilt}S`)
          
          // Debug individual resources
          const { wood, brick, sheep, wheat, ore } = player.resources
          console.log(`    Resources: W${wood} B${brick} S${sheep} W${wheat} O${ore}`)
        }
      }
      
      try {
        // Get AI action
        const action = getBestActionForPlayer(gameState, currentPlayer, 'hard', 'aggressive')
        
        if (!action) {
          console.log(`❌ No action for ${currentPlayer} in phase ${gameState.phase}`)
          break
        }
        
        // Log interesting actions
        if (action.type === 'build' || action.type === 'placeBuilding') {
          console.log(`  🏗️ ${currentPlayer} builds ${action.data.buildingType}`)
        }
        
        // Apply action
        const result = processAction(gameState, action)
        if (!result.success) {
          console.log(`❌ Action failed: ${result.error}`)
          break
        }
        
        gameState = result.newState
        
        // Check for winner
        for (const [playerId, player] of gameState.players) {
          if (player.score.total >= 10) {
            winner = playerId
            console.log(`🏆 WINNER: ${playerId} with ${player.score.total} points in ${turnCount} turns!`)
            break
          }
        }
        
      } catch (error) {
        console.log(`💥 Error in turn ${turnCount}:`, error)
        break
      }
    }
    
    if (!winner) {
      console.log(`\n⏰ Game timed out after ${turnCount} turns`)
      console.log(`Final scores:`)
      for (const [playerId, player] of gameState.players) {
        console.log(`  ${playerId}: ${player.score.total} points`)
      }
    }
    
    // This test is just for diagnostics - always pass
    expect(turnCount).toBeGreaterThan(0)
  }, 60000)
})

interface BenchmarkConfig {
  playerCount: 3 | 4
  gameCount: number
  aiConfigs: Array<{ difficulty: 'easy' | 'medium' | 'hard', personality: 'aggressive' | 'balanced' | 'defensive' | 'economic' }>
}

async function runBenchmarkSuite(config: BenchmarkConfig): Promise<BenchmarkSummary> {
  const results: BenchmarkResult[] = []
  
  console.log(`\n🎯 Running ${config.playerCount}-Player AI Benchmark (${config.gameCount} games)`)
  console.log('='.repeat(60))
  
  for (let gameNum = 1; gameNum <= config.gameCount; gameNum++) {
    console.log(`\n🎮 Game ${gameNum}/${config.gameCount}`)
    
    const result = await runAIOnlyGame(gameNum, config)
    results.push(result)
    
    // Log individual game result
    if (result.winner) {
      const isUnder30 = result.turnCount <= 30
      const status = isUnder30 ? '✅' : '❌'
      console.log(`${status} Winner: ${result.winner} in ${result.turnCount} turns (Score: ${result.winnerScore})`)
    } else {
      console.log(`❌ Timeout - no winner after ${result.turnCount} turns`)
    }
  }
  
  return analyzeBenchmarkResults(results, config)
}

async function runAIOnlyGame(gameNumber: number, config: BenchmarkConfig): Promise<BenchmarkResult> {
  // Create player names based on config
  const playerNames = config.aiConfigs.map((_, i) => `AI_${i + 1}`)
  
  const gameManager = GameFlowManager.createGame({
    playerNames,
    gameId: `benchmark-${gameNumber}-${config.playerCount}p`,
    randomizePlayerOrder: true // Add variety
  })
  
  let gameState = gameManager.getState()
  const maxTurns = 100 // Prevent infinite games
  
  let turnCount = 0
  let winner: PlayerId | null = null
  const turnDurations: number[] = []
  
  // Extract player IDs from the actual game state
  const playerIds = Array.from(gameState.players.keys())
  
  while (!winner && turnCount < maxTurns) {
    turnCount++
    const currentPlayer = gameState.currentPlayer
    
    // DEBUG: Log early turns for troubleshooting
    if (turnCount <= 10) {
      console.log(`  Turn ${turnCount}: Phase=${gameState.phase}, Player=${currentPlayer}`)
    }
    
    const turnStartTime = Date.now()
    
    try {
      // Get AI configuration for current player
      const playerIndex = playerIds.indexOf(currentPlayer)
      const aiConfig = config.aiConfigs[playerIndex] || config.aiConfigs[0]
      
      // AI makes decision
      const action = getBestActionForPlayer(
        gameState, 
        currentPlayer, 
        aiConfig.difficulty, 
        aiConfig.personality
      )
      
      if (!action) {
        console.log(`  ⚠️ No action from AI ${currentPlayer} in phase ${gameState.phase}`)
        break
      }
      
      // Apply action
      const actionResult = processAction(gameState, action)
      if (!actionResult.success) {
        console.log(`  ❌ Invalid action from ${currentPlayer}: ${actionResult.error}`)
        break
      }
      
      gameState = actionResult.newState
      
      // Check for winner
      for (const [playerId, player] of gameState.players) {
        if (player.score.total >= 10) {
          winner = playerId
          break
        }
      }
      
      const turnDuration = Date.now() - turnStartTime
      turnDurations.push(turnDuration)
      
    } catch (error) {
      console.log(`  💥 Error in turn ${turnCount}:`, error)
      break
    }
  }
  
  // Collect final statistics
  const finalScores = new Map(
    Array.from(gameState.players.entries()).map(([id, player]) => [id, player.score.total])
  )
  
  const buildingStats = calculateBuildingStats(gameState)
  const averageTurnDuration = turnDurations.length > 0 ? 
    turnDurations.reduce((sum, t) => sum + t, 0) / turnDurations.length : 0
  
  return {
    gameNumber,
    playerCount: config.playerCount,
    winner,
    turnCount,
    finalScores,
    winnerScore: winner ? (finalScores.get(winner) || 0) : 0,
    averageTurnDuration,
    buildingStats,
    aiDifficulty: config.aiConfigs[0].difficulty,
    aiPersonality: config.aiConfigs[0].personality
  }
}

function calculateBuildingStats(gameState: GameState): { cities: number, settlements: number, devCards: number } {
  let cities = 0
  let settlements = 0
  let devCards = 0
  
  for (const [, vertex] of gameState.board.vertices) {
    if (vertex.building) {
      if (vertex.building.type === 'city') cities++
      else if (vertex.building.type === 'settlement') settlements++
    }
  }
  
  for (const [, player] of gameState.players) {
    devCards += player.developmentCards.length
  }
  
  return { cities, settlements, devCards }
}

function analyzeBenchmarkResults(results: BenchmarkResult[], config: BenchmarkConfig): BenchmarkSummary {
  const completedGames = results.filter(r => r.winner !== null)
  const timeouts = results.length - completedGames.length
  
  if (completedGames.length === 0) {
    return {
      playerCount: config.playerCount,
      totalGames: results.length,
      completedGames: 0,
      averageTurns: 0,
      winsUnder30Turns: 0,
      winPercentage: 0,
      averageWinnerScore: 0,
      fastestWin: 0,
      slowestWin: 0,
      timeouts,
      configuration: `${config.aiConfigs[0].difficulty}-${config.aiConfigs[0].personality}`
    }
  }
  
  const turnCounts = completedGames.map(r => r.turnCount)
  const winsUnder30 = completedGames.filter(r => r.turnCount <= 30).length
  const winnerScores = completedGames.map(r => r.winnerScore)
  
  return {
    playerCount: config.playerCount,
    totalGames: results.length,
    completedGames: completedGames.length,
    averageTurns: turnCounts.reduce((sum, t) => sum + t, 0) / turnCounts.length,
    winsUnder30Turns: winsUnder30,
    winPercentage: (completedGames.length / results.length) * 100,
    averageWinnerScore: winnerScores.reduce((sum, s) => sum + s, 0) / winnerScores.length,
    fastestWin: Math.min(...turnCounts),
    slowestWin: Math.max(...turnCounts),
    timeouts,
    configuration: `${config.aiConfigs[0].difficulty}-${config.aiConfigs[0].personality}`
  }
}

function printBenchmarkSummary(summary: BenchmarkSummary): void {
  console.log('\n📊 BENCHMARK SUMMARY')
  console.log('='.repeat(50))
  console.log(`🎮 Player Count: ${summary.playerCount}`)
  console.log(`🎯 Games Completed: ${summary.completedGames}/${summary.totalGames}`)
  console.log(`⏱️ Average Turns: ${summary.averageTurns.toFixed(1)}`)
  console.log(`🏆 Completion Rate: ${summary.winPercentage.toFixed(1)}%`)
  console.log(`⚡ Wins Under 30 Turns: ${summary.winsUnder30Turns}`)
  console.log(`📈 Average Winner Score: ${summary.averageWinnerScore.toFixed(1)}`)
  console.log(`🏃 Fastest Win: ${summary.fastestWin} turns`)
  console.log(`🐌 Slowest Win: ${summary.slowestWin} turns`)
  console.log(`⏰ Timeouts: ${summary.timeouts}`)
  console.log(`🤖 AI Config: ${summary.configuration}`)
  
  const under30Percentage = summary.winsUnder30Turns / Math.max(1, summary.completedGames)
  console.log(`\n🎯 TARGET METRIC: ${Math.round(under30Percentage * 100)}% games under 30 turns`)
  
  if (under30Percentage >= 0.3) {
    console.log(`✅ EXCELLENT: AI is meeting performance targets!`)
  } else if (under30Percentage >= 0.2) {
    console.log(`⚠️ GOOD: AI performance is promising but needs improvement`)
  } else {
    console.log(`❌ NEEDS WORK: AI needs optimization for faster wins`)
  }
} 