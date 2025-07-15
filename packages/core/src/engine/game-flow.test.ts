import { describe, it, expect } from 'vitest'
import { GameFlowManager } from './game-flow'
import { GamePhase } from '../types'

describe('GameFlowManager', () => {
  it('should create a new game with correct initial state', () => {
    const game = GameFlowManager.createGame({
      playerNames: ['Alice', 'Bob', 'Charlie']
    })
    
    const state = game.getState()
    
    expect(state.players.size).toBe(3)
    expect(state.phase).toBe('setup1' as GamePhase)
    expect(state.turn).toBe(0)
    expect(state.currentPlayerIndex).toBe(0)
    expect(state.winner).toBeNull()
  })
  
  it('should have correct player setup', () => {
    const game = GameFlowManager.createGame({
      playerNames: ['Alice', 'Bob', 'Charlie']
    })
    
    const state = game.getState()
    const firstPlayerId = state.playerOrder[0]
    const firstPlayer = state.players.get(firstPlayerId)
    
    expect(firstPlayer).toBeDefined()
    expect(firstPlayer?.name).toBe('Alice')
    expect(firstPlayer?.color).toBe(0)
    expect(firstPlayer?.buildings.settlements).toBe(5)
    expect(firstPlayer?.buildings.cities).toBe(4)
    expect(firstPlayer?.buildings.connections).toBe(15)
    expect(firstPlayer?.score.total).toBe(0)
  })
  
  it('should generate a valid board', () => {
    const game = GameFlowManager.createGame({
      playerNames: ['Alice', 'Bob', 'Charlie']
    })
    
    const state = game.getState()
    
    expect(state.board.hexes.size).toBe(19)
    expect(state.board.vertices.size).toBeGreaterThan(0)
    expect(state.board.edges.size).toBeGreaterThan(0)
    
    // Check for desert hex
    let desertCount = 0
    state.board.hexes.forEach(hex => {
      if (hex.terrain === 'desert') {
        desertCount++
        expect(hex.hasBlocker).toBe(true)
      }
    })
    expect(desertCount).toBe(1)
  })
  
  it('should create development deck', () => {
    const game = GameFlowManager.createGame({
      playerNames: ['Alice', 'Bob', 'Charlie']
    })
    
    const state = game.getState()
    
    expect(state.developmentDeck.length).toBe(25) // Total development cards
    
    // Check card distribution
    const cardCounts = state.developmentDeck.reduce((acc, card) => {
      acc[card.type] = (acc[card.type] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    expect(cardCounts['knight']).toBe(14)
    expect(cardCounts['victory']).toBe(5)
    expect(cardCounts['progress1']).toBe(2)
    expect(cardCounts['progress2']).toBe(2)
    expect(cardCounts['progress3']).toBe(2)
  })
  
  it('should handle player actions', () => {
    const game = GameFlowManager.createGame({
      playerNames: ['Alice', 'Bob', 'Charlie']
    })
    
    const validActions = game.getValidActions()
    
    // In setup phase, can only place settlements and connections
    expect(validActions).toContain('placeSettlement')
    expect(validActions).toContain('placeConnection')
    expect(validActions).not.toContain('roll')
    expect(validActions).not.toContain('trade')
  })
}) 