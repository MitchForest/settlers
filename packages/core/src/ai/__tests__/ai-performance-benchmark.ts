import { describe, test, expect } from 'vitest'
import { getBestActionForPlayer } from '../action-decision-engine'
import { GameState, GameAction, PlayerId } from '../../types'

// Create a realistic game state for performance testing
function createPerformanceTestState(turn: number = 1): GameState {
  return {
    id: 'perf-test-game',
    phase: 'actions',
    turn,
    currentPlayer: 'ai-player' as PlayerId,
    players: new Map([
      ['ai-player', {
        id: 'ai-player',
        name: 'AI Test Player',
        color: 0,
        resources: { wood: 2, brick: 1, ore: 1, wheat: 2, sheep: 1 },
        developmentCards: [],
        score: { public: 2, hidden: 0, total: 2 },
        buildings: { settlements: 3, cities: 4, roads: 13 },
        knightsPlayed: 0,
        hasLongestRoad: false,
        hasLargestArmy: false,
        isConnected: true,
        isAI: true
      }],
      ['human-player', {
        id: 'human-player',
        name: 'Human Player',
        color: 1,
        resources: { wood: 1, brick: 2, ore: 1, wheat: 1, sheep: 2 },
        developmentCards: [],
        score: { public: 2, hidden: 0, total: 2 },
        buildings: { settlements: 3, cities: 4, roads: 13 },
        knightsPlayed: 0,
        hasLongestRoad: false,
        hasLargestArmy: false,
        isConnected: true,
        isAI: false
      }]
    ]),
    board: {
      hexes: new Map(),
      vertices: new Map([
        ['settlement1', {
          position: { hexes: [] },
          building: { type: 'settlement', owner: 'ai-player' },
          port: null
        }],
        ['settlement2', {
          position: { hexes: [] },
          building: { type: 'settlement', owner: 'ai-player' },
          port: null
        }]
      ]),
      edges: new Map(),
      ports: [],
      robberPosition: null
    },
    dice: null,
    developmentDeck: [],
    discardPile: [],
    winner: null,
    activeTrades: [],
    startedAt: new Date(),
    updatedAt: new Date()
  }
}

describe('AI Performance Benchmark', () => {
  test('AI should make progress toward victory within reasonable turns', () => {
    console.log('🚀 Starting AI Performance Benchmark Test...')
    
    const maxTurns = 60
    const targetVP = 10
    let currentTurn = 1
    let gameState = createPerformanceTestState(currentTurn)
    let aiPlayer = gameState.players.get('ai-player')!
    let actionCount = 0
    let tradeCount = 0
    let buildCount = 0
    let endTurnCount = 0
    
    console.log(`📊 Initial State: ${aiPlayer.score.total} VP, Turn ${currentTurn}`)
    console.log(`🎯 Target: Reach ${targetVP} VP within ${maxTurns} turns`)
    console.log(`💰 Starting Resources:`, aiPlayer.resources)
    
    while (currentTurn <= maxTurns && aiPlayer.score.total < targetVP) {
      const action = getBestActionForPlayer(gameState, 'ai-player')
      
      if (!action) {
        console.log(`❌ No action available at turn ${currentTurn}`)
        break
      }
      
      actionCount++
      
      // Track action types
      switch (action.type) {
        case 'bankTrade':
          tradeCount++
          console.log(`💱 Turn ${currentTurn}: Bank trade ${JSON.stringify(action.data?.offering)} for ${JSON.stringify(action.data?.requesting)}`)
          
          // Simulate trade execution
          if (action.data?.offering && action.data?.requesting) {
            const offering = action.data.offering
            const requesting = action.data.requesting
            
            for (const [resource, amount] of Object.entries(offering)) {
              aiPlayer.resources[resource as keyof typeof aiPlayer.resources] -= amount
            }
            for (const [resource, amount] of Object.entries(requesting)) {
              aiPlayer.resources[resource as keyof typeof aiPlayer.resources] += amount
            }
          }
          break
          
        case 'build':
          buildCount++
          console.log(`🏗️ Turn ${currentTurn}: Build ${action.data?.buildingType} at ${action.data?.position}`)
          
          // Simulate building (simplified)
          if (action.data?.buildingType === 'city') {
            aiPlayer.score.total += 2
            aiPlayer.score.public += 2
            aiPlayer.buildings.cities -= 1
            // Deduct city costs
            aiPlayer.resources.ore -= 3
            aiPlayer.resources.wheat -= 2
          } else if (action.data?.buildingType === 'settlement') {
            aiPlayer.score.total += 1
            aiPlayer.score.public += 1
            aiPlayer.buildings.settlements -= 1
            // Deduct settlement costs
            aiPlayer.resources.wood -= 1
            aiPlayer.resources.brick -= 1
            aiPlayer.resources.wheat -= 1
            aiPlayer.resources.sheep -= 1
          }
          break
          
        case 'endTurn':
          endTurnCount++
          console.log(`⏭️ Turn ${currentTurn}: End turn (${aiPlayer.score.total} VP)`)
          
          // Simulate resource income (simplified)
          aiPlayer.resources.wood += Math.floor(Math.random() * 3)
          aiPlayer.resources.brick += Math.floor(Math.random() * 2)
          aiPlayer.resources.ore += Math.floor(Math.random() * 2)
          aiPlayer.resources.wheat += Math.floor(Math.random() * 3)
          aiPlayer.resources.sheep += Math.floor(Math.random() * 2)
          
          currentTurn++
          gameState.turn = currentTurn
          break
          
        default:
          console.log(`🤷 Turn ${currentTurn}: Unknown action ${action.type}`)
          break
      }
      
      // Safety check to prevent infinite loops
      if (actionCount > 200) {
        console.log('❌ Too many actions, breaking to prevent infinite loop')
        break
      }
    }
    
    // Performance Analysis
    console.log('\n📈 PERFORMANCE ANALYSIS:')
    console.log(`🏁 Final Turn: ${currentTurn}`)
    console.log(`🏆 Final VP: ${aiPlayer.score.total}`)
    console.log(`📊 Total Actions: ${actionCount}`)
    console.log(`💱 Trades: ${tradeCount}`)
    console.log(`🏗️ Builds: ${buildCount}`)
    console.log(`⏭️ End Turns: ${endTurnCount}`)
    console.log(`💰 Final Resources:`, aiPlayer.resources)
    
    // Determine result
    if (aiPlayer.score.total >= targetVP) {
      console.log(`✅ SUCCESS: AI reached ${targetVP} VP in ${currentTurn} turns!`)
      
      if (currentTurn >= 30 && currentTurn <= 60) {
        console.log(`🎯 PERFECT: Game completed within target range (30-60 turns)`)
      } else if (currentTurn < 30) {
        console.log(`⚡ FAST: Game completed faster than target (${currentTurn} < 30 turns)`)
      } else {
        console.log(`🐌 SLOW: Game took longer than target (${currentTurn} > 60 turns)`)
      }
    } else {
      console.log(`❌ FAILURE: AI only reached ${aiPlayer.score.total} VP in ${maxTurns} turns`)
      console.log(`🔍 ANALYSIS: AI needs improvement in building strategy`)
    }
    
    // Efficiency metrics
    const vpPerTurn = aiPlayer.score.total / currentTurn
    const tradeRatio = tradeCount / actionCount
    const buildRatio = buildCount / actionCount
    
    console.log(`📊 VP per Turn: ${vpPerTurn.toFixed(2)}`)
    console.log(`💱 Trade Ratio: ${(tradeRatio * 100).toFixed(1)}%`)
    console.log(`🏗️ Build Ratio: ${(buildRatio * 100).toFixed(1)}%`)
    
    // Assertions
    expect(aiPlayer.score.total).toBeGreaterThan(2) // Should make some progress
    expect(currentTurn).toBeLessThan(maxTurns) // Should not timeout
    expect(tradeCount).toBeGreaterThan(0) // Should use trading
    expect(actionCount).toBeGreaterThan(0) // Should take actions
    
    // Ideally, we want the AI to win within 30-60 turns
    if (aiPlayer.score.total >= targetVP) {
      expect(currentTurn).toBeLessThanOrEqual(60) // Should win within 60 turns
    }
  })
})