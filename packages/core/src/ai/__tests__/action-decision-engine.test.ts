import { describe, test, expect } from 'vitest'
import { ActionDecisionEngine, createActionDecisionEngine, getBestActionForPlayer } from '../action-decision-engine'
import { GameState, GameAction, PlayerId } from '../../types'

// Mock a simple game state for testing
function createMockGameState(): GameState {
  return {
    id: 'test-game',
    phase: 'roll',
    turn: 1,
    currentPlayer: 'player1' as PlayerId,
    players: new Map([
      ['player1', {
        id: 'player1',
        name: 'Test Player',
        color: 0,
        resources: { wood: 2, brick: 1, ore: 0, wheat: 1, sheep: 1 },
        developmentCards: [],
        score: { public: 2, hidden: 0, total: 2 },
        buildings: { settlements: 4, cities: 4, roads: 13 },
        knightsPlayed: 0,
        hasLongestRoad: false,
        hasLargestArmy: false,
        isConnected: true,
        isAI: true
      }]
    ]),
    board: {
      hexes: new Map(),
      vertices: new Map(),
      edges: new Map(),
      ports: [],
      robberPosition: null
    },
    dice: null,
    developmentDeck: [],
    discardPile: [],
    activeTrades: [],
    winner: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    startedAt: new Date()
  } as GameState
}

describe('ActionDecisionEngine', () => {
  test('should create engine successfully', () => {
    const state = createMockGameState()
    const engine = createActionDecisionEngine(state, 'player1')
    
    expect(engine).toBeDefined()
    expect(engine.getBestAction).toBeDefined()
    expect(engine.getAllScoredActions).toBeDefined()
  })

  test('should generate roll action in roll phase', () => {
    const state = createMockGameState()
    state.phase = 'roll'
    
    const engine = createActionDecisionEngine(state, 'player1')
    const bestAction = engine.getBestAction()
    
    expect(bestAction).toBeDefined()
    expect(bestAction?.type).toBe('roll')
    expect(bestAction?.playerId).toBe('player1')
  })

  test('should generate actions with proper data structure', () => {
    const state = createMockGameState()
    state.phase = 'roll'
    
    const engine = createActionDecisionEngine(state, 'player1')
    const actions = engine.getAllScoredActions()
    
    expect(actions.length).toBeGreaterThan(0)
    
    const action = actions[0]
    expect(action.action).toBeDefined()
    expect(action.score).toBeDefined()
    expect(action.priority).toBeDefined()
    expect(action.reasoning).toBeDefined()
    expect(Array.isArray(action.reasoning)).toBe(true)
  })

  test('getBestActionForPlayer utility function works', () => {
    const state = createMockGameState()
    state.phase = 'roll'
    
    const bestAction = getBestActionForPlayer(state, 'player1')
    
    expect(bestAction).toBeDefined()
    expect(bestAction?.type).toBe('roll')
  })

  test('should return null when no actions available', () => {
    const state = createMockGameState()
    state.phase = 'ended'
    
    const bestAction = getBestActionForPlayer(state, 'player1')
    
    expect(bestAction).toBeNull()
  })
}) 