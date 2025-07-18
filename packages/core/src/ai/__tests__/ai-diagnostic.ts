import { describe, test, expect } from 'vitest'
import { getBestActionForPlayer, getTopActionsForPlayer } from '../action-decision-engine'
import { GameState, PlayerId } from '../../types'

// Test different scenarios that might cause the AI to fail
function createTestState(scenario: string): GameState {
  const baseState = {
    id: 'diagnostic-test',
    phase: 'actions' as const,
    turn: 10,
    currentPlayer: 'ai-player' as PlayerId,
    players: new Map([
      ['ai-player', {
        id: 'ai-player',
        name: 'AI Player',
        color: 0,
        resources: { wood: 0, brick: 0, ore: 0, wheat: 0, sheep: 0 },
        developmentCards: [],
        score: { public: 6, hidden: 0, total: 6 },
        buildings: { settlements: 2, cities: 2, roads: 10 },
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
          building: { type: 'settlement' as const, owner: 'ai-player' },
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
      edges: new Map([
        ['road1', {
          position: { vertices: ['settlement1', 'expansion1'] },
          building: { type: 'road' as const, owner: 'ai-player' }
        }],
        ['road2', {
          position: { vertices: ['expansion1', 'expansion2'] },
          building: null
        }]
      ]),
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

  // Modify resources based on scenario
  const aiPlayer = baseState.players.get('ai-player')!
  switch (scenario) {
    case 'no-resources':
      aiPlayer.resources = { wood: 0, brick: 0, ore: 0, wheat: 0, sheep: 0 }
      break
    case 'excess-wheat':
      aiPlayer.resources = { wood: 1, brick: 0, ore: 0, wheat: 8, sheep: 1 }
      break
    case 'city-ready':
      aiPlayer.resources = { wood: 1, brick: 1, ore: 3, wheat: 2, sheep: 1 }
      break
    case 'balanced':
      aiPlayer.resources = { wood: 2, brick: 2, ore: 2, wheat: 2, sheep: 2 }
      break
    case 'lots-of-everything':
      aiPlayer.resources = { wood: 10, brick: 10, ore: 10, wheat: 10, sheep: 10 }
      break
  }

  return baseState
}

describe('AI Diagnostic Tests', () => {
  test('AI should handle no resources scenario', () => {
    const state = createTestState('no-resources')
    const action = getBestActionForPlayer(state, 'ai-player')
    
    console.log('NO RESOURCES scenario:')
    console.log('Resources:', state.players.get('ai-player')!.resources)
    console.log('Best action:', action)
    
    expect(action).toBeDefined()
    expect(action?.type).toBe('endTurn')
  })

  test('AI should trade excess wheat', () => {
    const state = createTestState('excess-wheat')
    const actions = getTopActionsForPlayer(state, 'ai-player', 'hard', 'aggressive', 5)
    const action = getBestActionForPlayer(state, 'ai-player')
    
    console.log('EXCESS WHEAT scenario:')
    console.log('Resources:', state.players.get('ai-player')!.resources)
    console.log('Top actions:', actions.map(a => ({ type: a.action.type, score: a.score })))
    console.log('Best action:', action)
    
    expect(action).toBeDefined()
    // Should trade, not end turn
    expect(action?.type).toBe('bankTrade')
  })

  test('AI should build city when ready', () => {
    const state = createTestState('city-ready')
    const actions = getTopActionsForPlayer(state, 'ai-player', 'hard', 'aggressive', 5)
    const action = getBestActionForPlayer(state, 'ai-player')
    
    console.log('CITY READY scenario:')
    console.log('Resources:', state.players.get('ai-player')!.resources)
    console.log('Top actions:', actions.map(a => ({ type: a.action.type, score: a.score })))
    console.log('Best action:', action)
    
    expect(action).toBeDefined()
    // Should build city
    expect(action?.type).toBe('build')
  })

  test('AI should make productive decisions with balanced resources', () => {
    const state = createTestState('balanced')
    const actions = getTopActionsForPlayer(state, 'ai-player', 'hard', 'aggressive', 5)
    const action = getBestActionForPlayer(state, 'ai-player')
    
    console.log('BALANCED scenario:')
    console.log('Resources:', state.players.get('ai-player')!.resources)
    console.log('Top actions:', actions.map(a => ({ type: a.action.type, score: a.score })))
    console.log('Best action:', action)
    
    expect(action).toBeDefined()
    // Should do something productive, not just end turn
    expect(action?.type).not.toBe('endTurn')
  })

  test('AI should handle abundant resources', () => {
    const state = createTestState('lots-of-everything')
    const actions = getTopActionsForPlayer(state, 'ai-player', 'hard', 'aggressive', 5)
    const action = getBestActionForPlayer(state, 'ai-player')
    
    console.log('ABUNDANT RESOURCES scenario:')
    console.log('Resources:', state.players.get('ai-player')!.resources)
    console.log('Top actions:', actions.map(a => ({ type: a.action.type, score: a.score })))
    console.log('Best action:', action)
    
    expect(action).toBeDefined()
    // Should definitely build something
    expect(action?.type).toBe('build')
  })

  test('AI should not get stuck in infinite loops', () => {
    const state = createTestState('excess-wheat')
    let actionCount = 0
    let endTurnCount = 0
    
    // Simulate multiple decision cycles
    for (let i = 0; i < 10; i++) {
      const action = getBestActionForPlayer(state, 'ai-player')
      if (action) {
        actionCount++
        if (action.type === 'endTurn') {
          endTurnCount++
        }
      }
    }
    
    console.log('LOOP TEST:')
    console.log(`Total actions: ${actionCount}`)
    console.log(`End turn actions: ${endTurnCount}`)
    console.log(`End turn ratio: ${((endTurnCount / actionCount) * 100).toFixed(1)}%`)
    
    expect(actionCount).toBe(10)
    expect(endTurnCount).toBeLessThan(10) // Should not always end turn
  })
})