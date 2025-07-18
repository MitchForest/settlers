#!/usr/bin/env bun
import { createAIDecisionSystem, getBestActionForPlayer, getAIGoalInfo } from './packages/core/src/ai/action-decision-engine'
import { GameState, Player, ResourceCards } from './packages/core/src/types'

// Create a simple test game state with port access
const testGameState: Partial<GameState> = {
  phase: 'actions',
  currentPlayer: 'player1',
  turn: 10,
  developmentDeck: [{id: 'card1', type: 'knight'}], // Add development deck
  players: new Map([
    ['player1', {
      id: 'player1',
      name: 'AI Player',
      resources: { wood: 8, brick: 2, ore: 0, wheat: 0, sheep: 1 }, // Lots of wood, missing ore/wheat
      buildings: { settlements: 3, cities: 0, roads: 10 },
      score: { total: 4, breakdown: { settlements: 2, cities: 0, longestRoad: 0, largestArmy: 0, devCards: 0 } },
      developmentCards: [],
      knightsPlayed: 0,
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
        port: { type: 'generic' } // 3:1 port
      }]
    ]),
    edges: new Map(),
    hexes: new Map(),
    robberPosition: null
  }
}

console.log('🧪 Testing Enhanced AI Trading System')
console.log('=====================================')

console.log('Player Resources:', testGameState.players?.get('player1')?.resources)
console.log('Player has 8 wood - should want to trade for city building resources')

try {
  // Test goal-driven AI
  console.log('\n🎯 Testing Goal-Driven AI System')
  console.log('================================')
  
  const goalInfo = getAIGoalInfo(
    testGameState as GameState,
    'player1',
    'hard',
    'aggressive'
  )
  
  console.log('📋 Active Goals:', goalInfo.allGoals.length)
  if (goalInfo.currentGoal) {
    console.log('🎯 Current Goal:', goalInfo.currentGoal.description)
    console.log('📊 Priority:', goalInfo.currentGoal.priority)
    console.log('🏷️ Type:', goalInfo.currentGoal.type)
  }
  
  const action = getBestActionForPlayer(
    testGameState as GameState,
    'player1',
    'hard',
    'aggressive'
  )
  
  console.log('\n🎯 AI Decision:', action)
  
  if (action?.type === 'bankTrade') {
    console.log('✅ AI successfully chose bank trade!')
    console.log('📦 Offering:', action.data.offering)
    console.log('📦 Requesting:', action.data.requesting)
  } else if (action?.type === 'portTrade') {
    console.log('✅ AI successfully chose port trade!')
    console.log('📦 Offering:', action.data.offering)
    console.log('📦 Requesting:', action.data.requesting)
  } else if (action?.type === 'build') {
    console.log('✅ AI chose to build!')
    console.log('🏗️ Building:', action.data.buildingType)
    console.log('📍 Position:', action.data.position)
  } else {
    console.log('ℹ️ AI chose different action:', action?.type)
  }
  
} catch (error) {
  console.error('❌ Error testing AI trading:', error)
}