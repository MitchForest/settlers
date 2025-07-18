import { describe, test, expect } from 'vitest'
import { getBestActionForPlayer } from '../action-decision-engine'
import { GameState, GameAction, PlayerId } from '../../types'

// Create a more realistic game state for performance testing
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
        }],
        ['expansion1', {
          position: { hexes: [] },
          building: null,
          port: null
        }],
        ['expansion2', {
          position: { hexes: [] },
          building: null,
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

// Simulate resource costs properly
function deductBuildingCosts(resources: any, buildingType: string): boolean {
  switch (buildingType) {
    case 'city':
      if (resources.ore >= 3 && resources.wheat >= 2) {
        resources.ore -= 3
        resources.wheat -= 2
        return true
      }
      return false
    case 'settlement':
      if (resources.wood >= 1 && resources.brick >= 1 && resources.wheat >= 1 && resources.sheep >= 1) {
        resources.wood -= 1
        resources.brick -= 1
        resources.wheat -= 1
        resources.sheep -= 1
        return true
      }
      return false
    case 'road':
      if (resources.wood >= 1 && resources.brick >= 1) {
        resources.wood -= 1
        resources.brick -= 1
        return true
      }
      return false
    default:
      return false
  }
}

// More realistic resource income simulation
function simulateResourceIncome(resources: any, turn: number): void {
  // Simulate dice rolls and resource production
  const baseIncome = Math.max(1, Math.floor(Math.random() * 3)) // 1-3 resources per turn
  const resourceTypes = ['wood', 'brick', 'ore', 'wheat', 'sheep']
  
  for (let i = 0; i < baseIncome; i++) {
    const randomResource = resourceTypes[Math.floor(Math.random() * resourceTypes.length)]
    resources[randomResource] += 1
  }
  
  // Occasional bonus resources
  if (turn % 5 === 0) {
    resources.wheat += 1
    resources.ore += 1
  }
}

describe('AI Performance Benchmark (Fixed)', () => {
  test('AI should make consistent progress without getting stuck', () => {
    console.log('🚀 Starting Fixed AI Performance Benchmark...')
    
    const maxTurns = 80
    const targetVP = 10
    let currentTurn = 1
    let gameState = createPerformanceTestState(currentTurn)
    let aiPlayer = gameState.players.get('ai-player')!
    let actionCount = 0
    let tradeCount = 0
    let buildCount = 0
    let endTurnCount = 0
    let consecutiveEndTurns = 0
    let lastAction = ''
    
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
      
      // Track consecutive end turns to detect infinite loops
      if (action.type === 'endTurn') {
        consecutiveEndTurns++
        if (consecutiveEndTurns > 5) {
          console.log(`⚠️ AI stuck in endTurn loop at turn ${currentTurn}`)
          console.log(`💰 Current Resources:`, aiPlayer.resources)
          break
        }
      } else {
        consecutiveEndTurns = 0
      }
      
      // Track action types
      switch (action.type) {
        case 'bankTrade':
          tradeCount++
          console.log(`💱 Turn ${currentTurn}: Bank trade ${JSON.stringify(action.data?.offering)} for ${JSON.stringify(action.data?.requesting)}`)
          
          // Simulate trade execution with validation
          if (action.data?.offering && action.data?.requesting) {
            const offering = action.data.offering
            const requesting = action.data.requesting
            
            // Validate trade is possible
            let canTrade = true
            for (const [resource, amount] of Object.entries(offering)) {
              if (aiPlayer.resources[resource as keyof typeof aiPlayer.resources] < amount) {
                canTrade = false
                break
              }
            }
            
            if (canTrade) {
              for (const [resource, amount] of Object.entries(offering)) {
                aiPlayer.resources[resource as keyof typeof aiPlayer.resources] -= amount
              }
              for (const [resource, amount] of Object.entries(requesting)) {
                aiPlayer.resources[resource as keyof typeof aiPlayer.resources] += amount
              }
            } else {
              console.log(`❌ Invalid trade attempted at turn ${currentTurn}`)
            }
          }
          break
          
        case 'build':
          buildCount++
          console.log(`🏗️ Turn ${currentTurn}: Build ${action.data?.buildingType} at ${action.data?.position}`)
          
          // Simulate building with proper cost deduction
          if (action.data?.buildingType) {
            const success = deductBuildingCosts(aiPlayer.resources, action.data.buildingType)
            if (success) {
              if (action.data.buildingType === 'city') {
                aiPlayer.score.total += 2
                aiPlayer.score.public += 2
                aiPlayer.buildings.cities -= 1
              } else if (action.data.buildingType === 'settlement') {
                aiPlayer.score.total += 1
                aiPlayer.score.public += 1
                aiPlayer.buildings.settlements -= 1
              }
            } else {
              console.log(`❌ Invalid build attempted at turn ${currentTurn} - insufficient resources`)
            }
          }
          break
          
        case 'endTurn':
          endTurnCount++
          console.log(`⏭️ Turn ${currentTurn}: End turn (${aiPlayer.score.total} VP)`)
          
          // Simulate resource income
          simulateResourceIncome(aiPlayer.resources, currentTurn)
          
          currentTurn++
          gameState.turn = currentTurn
          break
          
        default:
          console.log(`🤷 Turn ${currentTurn}: Unknown action ${action.type}`)
          break
      }
      
      lastAction = action.type
      
      // Safety check to prevent infinite loops
      if (actionCount > 300) {
        console.log(`❌ Too many actions (${actionCount}), breaking to prevent infinite loop`)
        break
      }
      
      // Progress check every 10 turns
      if (currentTurn % 10 === 0) {
        console.log(`📊 Turn ${currentTurn}: ${aiPlayer.score.total} VP, Resources:`, aiPlayer.resources)
      }
    }
    
    // Performance Analysis
    console.log('\n📈 PERFORMANCE ANALYSIS:')
    console.log(`🏁 Final Turn: ${currentTurn}`)
    console.log(`🏆 Final VP: ${aiPlayer.score.total}`)
    console.log(`📊 Total Actions: ${actionCount}`)
    console.log(`💱 Trades: ${tradeCount} (${((tradeCount / actionCount) * 100).toFixed(1)}%)`)
    console.log(`🏗️ Builds: ${buildCount} (${((buildCount / actionCount) * 100).toFixed(1)}%)`)
    console.log(`⏭️ End Turns: ${endTurnCount} (${((endTurnCount / actionCount) * 100).toFixed(1)}%)`)
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
      console.log(`🔍 DIAGNOSIS: AI may be stuck in trading loops or unable to build`)
    }
    
    // Efficiency metrics
    const vpPerTurn = aiPlayer.score.total / Math.max(1, currentTurn)
    console.log(`📊 VP per Turn: ${vpPerTurn.toFixed(2)}`)
    
    // Assertions for test success
    expect(aiPlayer.score.total).toBeGreaterThan(2) // Should make some progress
    expect(consecutiveEndTurns).toBeLessThan(6) // Should not get stuck in endTurn loops
    expect(tradeCount).toBeGreaterThan(0) // Should use trading
    expect(actionCount).toBeGreaterThan(0) // Should take actions
    expect(actionCount).toBeLessThan(300) // Should not take too many actions
    
    // If the AI reaches 10 VP, it should do so in reasonable time
    if (aiPlayer.score.total >= targetVP) {
      expect(currentTurn).toBeLessThanOrEqual(maxTurns) // Should win within max turns
    }
  })
})