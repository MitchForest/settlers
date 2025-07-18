#!/usr/bin/env bun
import { getBestActionForPlayer, getAIAnalysis } from './packages/core/src/ai/action-decision-engine'
import { GameState, Player, ResourceCards } from './packages/core/src/types'

// Create a test game state for victory optimization
const testGameState: Partial<GameState> = {
  phase: 'actions',
  currentPlayer: 'player1',
  turn: 25, // Mid-game
  developmentDeck: [
    {id: 'card1', type: 'knight'},
    {id: 'card2', type: 'knight'},
    {id: 'card3', type: 'victory'}
  ],
  players: new Map([
    ['player1', {
      id: 'player1',
      name: 'AI Player',
      resources: { wood: 2, brick: 2, ore: 2, wheat: 2, sheep: 2 }, // Balanced resources
      buildings: { settlements: 3, cities: 2, roads: 12 }, // Mid-game state
      score: { 
        total: 6, // Close to victory
        breakdown: { settlements: 2, cities: 4, longestRoad: 0, largestArmy: 0, devCards: 0 }
      },
      developmentCards: [
        { id: 'dev1', type: 'knight', playedTurn: null, purchasedTurn: 20 },
        { id: 'dev2', type: 'victory', playedTurn: null, purchasedTurn: 22 }
      ],
      knightsPlayed: 2,
      hasLongestRoad: false,
      hasLargestArmy: false
    } as Player],
    ['player2', {
      id: 'player2',
      name: 'Opponent',
      resources: { wood: 3, brick: 1, ore: 1, wheat: 2, sheep: 1 },
      buildings: { settlements: 2, cities: 1, roads: 8 },
      score: { 
        total: 5,
        breakdown: { settlements: 2, cities: 2, longestRoad: 0, largestArmy: 0, devCards: 1 }
      },
      developmentCards: [],
      knightsPlayed: 1,
      hasLongestRoad: false,
      hasLargestArmy: false
    } as Player]
  ]),
  board: {
    vertices: new Map([
      ['vertex1', {
        id: 'vertex1',
        position: { hexes: [] },
        building: { type: 'settlement', owner: 'player1' },
        port: { type: 'ore' } // 2:1 ore port
      }],
      ['vertex2', {
        id: 'vertex2',
        position: { hexes: [] },
        building: { type: 'settlement', owner: 'player1' }
      }]
    ]),
    edges: new Map(),
    hexes: new Map(),
    robberPosition: null
  }
}

console.log('🧪 Testing Victory-Optimized AI System')
console.log('=====================================')

console.log('Game State:')
console.log('- Turn:', testGameState.turn)
console.log('- AI Score:', testGameState.players?.get('player1')?.score.total, '/ 10 VP')
console.log('- AI Resources:', testGameState.players?.get('player1')?.resources)
console.log('- Dev Cards:', testGameState.players?.get('player1')?.developmentCards?.length)

try {
  // Get comprehensive AI analysis
  const analysis = getAIAnalysis(
    testGameState as GameState,
    'player1',
    'hard',
    'aggressive'
  )
  
  console.log('\n🎯 Victory Analysis')
  console.log('==================')
  
  if (analysis.victoryAnalysis) {
    const va = analysis.victoryAnalysis
    console.log(`📊 Current VP: ${va.currentVP} / 10`)
    console.log(`🎯 VP Needed: ${va.vpNeeded}`)
    console.log(`🚀 Fastest Path: ${va.fastestPath.description}`)
    console.log(`⏱️ Target Turns: ${va.fastestPath.targetTurns}`)
    console.log(`📈 Efficiency: ${va.fastestPath.efficiency.toFixed(2)} VP/turn`)
    console.log(`🎲 Probability: ${(va.fastestPath.probability * 100).toFixed(1)}%`)
    
    console.log('\n📋 Required Resources:')
    const remaining = va.fastestPath.remainingCost
    for (const [resource, amount] of Object.entries(remaining)) {
      if (amount > 0) {
        console.log(`  ${resource}: ${amount}`)
      }
    }
    
    if (va.bottlenecks.length > 0) {
      console.log('\n⚠️ Bottlenecks:')
      va.bottlenecks.forEach(bottleneck => console.log(`  - ${bottleneck}`))
    }
    
    if (va.recommendations.length > 0) {
      console.log('\n💡 Recommendations:')
      va.recommendations.forEach(rec => console.log(`  - ${rec}`))
    }
  }
  
  console.log('\n🎯 Multi-Turn Plan')
  console.log('==================')
  
  if (analysis.multiTurnPlan) {
    const plan = analysis.multiTurnPlan
    console.log(`🎯 Victory Path: ${plan.victoryPath.description}`)
    console.log(`⏱️ Total Estimated Turns: ${plan.totalEstimatedTurns}`)
    console.log(`🎲 Confidence: ${(plan.confidence * 100).toFixed(1)}%`)
    
    console.log('\n📅 Next 5 Turns:')
    plan.turns.forEach((turn: any, i: number) => {
      console.log(`  Turn ${turn.turnNumber}: ${turn.primaryGoal} (${turn.priority})`)
    })
  }
  
  console.log('\n🎯 Current Goals')
  console.log('===============')
  
  analysis.goals.allGoals.forEach(goal => {
    console.log(`🎯 ${goal.description} (Priority: ${goal.priority})`)
    console.log(`   Type: ${goal.type}, Value: ${goal.value}`)
  })
  
  console.log('\n🎯 AI Decision')
  console.log('==============')
  
  const action = getBestActionForPlayer(
    testGameState as GameState,
    'player1',
    'hard',
    'aggressive'
  )
  
  console.log('Action:', action)
  
  if (action?.type === 'build') {
    console.log('✅ AI chose to build!')
    console.log(`🏗️ Building: ${action.data.buildingType}`)
    console.log(`📍 Position: ${action.data.position}`)
  } else if (action?.type === 'playCard') {
    console.log('✅ AI chose to play development card!')
    console.log(`🎴 Card: ${action.data.cardId}`)
  } else if (action?.type === 'bankTrade' || action?.type === 'portTrade') {
    console.log('✅ AI chose to trade!')
    console.log(`📦 Offering: ${JSON.stringify(action.data.offering)}`)
    console.log(`📦 Requesting: ${JSON.stringify(action.data.requesting)}`)
  } else {
    console.log(`ℹ️ AI chose: ${action?.type}`)
  }
  
} catch (error) {
  console.error('❌ Error testing victory AI:', error)
  console.error(error.stack)
}