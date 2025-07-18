import { getBestActionForPlayer, getTopActionsForPlayer } from '../action-decision-engine'
import { GameState, PlayerId } from '../../types'

// Create a test game state you can modify
function createTestGameState(): GameState {
  return {
    id: 'interactive-test',
    phase: 'actions',
    turn: 5,
    currentPlayer: 'ai-player' as PlayerId,
    players: new Map([
      ['ai-player', {
        id: 'ai-player',
        name: 'AI Player',
        color: 0,
        // Try different resource combinations here:
        resources: { wood: 1, brick: 0, ore: 0, wheat: 5, sheep: 2 }, // 5 wheat = should trade
        developmentCards: [],
        score: { public: 4, hidden: 0, total: 4 },
        buildings: { settlements: 2, cities: 3, roads: 10 },
        knightsPlayed: 0,
        hasLongestRoad: false,
        hasLargestArmy: false,
        isConnected: true,
        isAI: true
      }]
    ]),
    board: {
      hexes: new Map(),
      vertices: new Map([
        ['settlement1', {
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

// Test different scenarios
function testAIDecisions() {
  console.log('🤖 INTERACTIVE AI TESTING')
  console.log('========================\n')
  
  // Test 1: AI with excess wheat
  console.log('TEST 1: AI with 5 wheat (should trade)')
  const state1 = createTestGameState()
  state1.players.get('ai-player')!.resources = { wood: 1, brick: 0, ore: 0, wheat: 5, sheep: 2 }
  
  const actions1 = getTopActionsForPlayer(state1, 'ai-player', 'hard', 'aggressive', 5)
  const best1 = getBestActionForPlayer(state1, 'ai-player')
  
  console.log('Resources:', state1.players.get('ai-player')!.resources)
  console.log('Best Action:', best1)
  console.log('Top Actions:', actions1.map(a => ({ type: a.action.type, score: a.score })))
  console.log()
  
  // Test 2: AI with balanced resources
  console.log('TEST 2: AI with balanced resources')
  const state2 = createTestGameState()
  state2.players.get('ai-player')!.resources = { wood: 2, brick: 2, ore: 2, wheat: 2, sheep: 2 }
  
  const actions2 = getTopActionsForPlayer(state2, 'ai-player', 'hard', 'aggressive', 5)
  const best2 = getBestActionForPlayer(state2, 'ai-player')
  
  console.log('Resources:', state2.players.get('ai-player')!.resources)
  console.log('Best Action:', best2)
  console.log('Top Actions:', actions2.map(a => ({ type: a.action.type, score: a.score })))
  console.log()
  
  // Test 3: AI with city resources
  console.log('TEST 3: AI with city resources (3 ore, 2 wheat)')
  const state3 = createTestGameState()
  state3.players.get('ai-player')!.resources = { wood: 1, brick: 1, ore: 3, wheat: 2, sheep: 1 }
  
  const actions3 = getTopActionsForPlayer(state3, 'ai-player', 'hard', 'aggressive', 5)
  const best3 = getBestActionForPlayer(state3, 'ai-player')
  
  console.log('Resources:', state3.players.get('ai-player')!.resources)
  console.log('Best Action:', best3)
  console.log('Top Actions:', actions3.map(a => ({ type: a.action.type, score: a.score })))
  console.log()
  
  // Test 4: AI with no resources
  console.log('TEST 4: AI with minimal resources')
  const state4 = createTestGameState()
  state4.players.get('ai-player')!.resources = { wood: 0, brick: 0, ore: 0, wheat: 1, sheep: 0 }
  
  const actions4 = getTopActionsForPlayer(state4, 'ai-player', 'hard', 'aggressive', 5)
  const best4 = getBestActionForPlayer(state4, 'ai-player')
  
  console.log('Resources:', state4.players.get('ai-player')!.resources)
  console.log('Best Action:', best4)
  console.log('Top Actions:', actions4.map(a => ({ type: a.action.type, score: a.score })))
  console.log()
}

// Run the tests
testAIDecisions()