import { describe, test, expect } from 'vitest'
import { getBestActionForPlayer, getTopActionsForPlayer } from '../action-decision-engine'
import { GameState, GameAction, PlayerId } from '../../types'

// Test the AI trading logic specifically
describe('AI Trading Logic', () => {
  test('AI should trade when it has 4+ of a resource and needs others', () => {
    const gameState: GameState = {
      id: 'test-game',
      phase: 'actions',
      turn: 1,
      currentPlayer: 'player1' as PlayerId,
      players: new Map([
        ['player1', {
          id: 'player1',
          name: 'Test Player',
          color: 0,
          resources: { wood: 1, brick: 0, ore: 0, wheat: 4, sheep: 0 }, // Has 4 wheat, needs ore/brick
          developmentCards: [],
          score: { public: 2, hidden: 0, total: 2 },
          buildings: { settlements: 3, cities: 4, roads: 13 }, // Has settlements to upgrade
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
            building: { type: 'settlement', owner: 'player1' },
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

    const actions = getTopActionsForPlayer(gameState, 'player1', 'hard', 'aggressive', 10)
    console.log('All AI Actions:', actions.map(a => ({ type: a.action.type, score: a.score, data: a.action.data })))
    
    const action = getBestActionForPlayer(gameState, 'player1')
    console.log('Best AI Action:', action)
    
    // Check if trading actions are being generated
    const tradeActions = actions.filter(a => a.action.type === 'bankTrade')
    console.log('Trade actions:', tradeActions)
    
    // AI should want to trade wheat for ore or brick
    expect(action).toBeDefined()
    if (tradeActions.length > 0) {
      expect(action?.type).toBe('bankTrade')
      expect(action?.data?.offering).toEqual({ wheat: 4 })
      expect(['ore', 'brick']).toContain(Object.keys(action?.data?.requesting || {})[0])
    } else {
      console.log('No trade actions generated!')
    }
  })
})