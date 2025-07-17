import { describe, test, expect, beforeEach } from 'vitest'
import {
  checkDistanceRule,
  isConnectedToPlayerNetwork,
  isEdgeConnectedToPlayer,
  checkSetupRoadPlacement,
  getAdjacentVertices,
  getVertexEdges,
  getEdgeVertices,
  getPlayerRoadNetwork,
  getPossibleSettlementPositions,
  getPossibleRoadPositions,
  calculateLongestRoad
} from '../adjacency-helpers'
import { GameState, Board, PlayerId } from '../../types'

// Test data factory functions
function createMockGameState(): GameState {
  return {
    id: 'test-game',
    phase: 'actions',
    turn: 1,
    currentPlayer: 'player1' as PlayerId,
    players: new Map(),
    board: createMockBoard(),
    dice: null,
    developmentDeck: [],
    discardPile: [],
    winner: null,
    activeTrades: [],
    startedAt: new Date(),
    updatedAt: new Date()
  }
}

function createMockBoard(): Board {
  return {
    hexes: new Map(),
    vertices: new Map([
      ['v1', {
        id: 'v1',
        position: {
          hexes: [
            { q: 0, r: 0, s: 0 },
            { q: 1, r: -1, s: 0 },
            { q: 0, r: -1, s: 1 }
          ],
          direction: 'N'
        },
        building: null,
        port: null
      }],
      ['v2', {
        id: 'v2', 
        position: {
          hexes: [
            { q: 0, r: 0, s: 0 },
            { q: 1, r: -1, s: 0 }
          ],
          direction: 'NE'
        },
        building: null,
        port: null
      }],
      ['v3', {
        id: 'v3',
        position: {
          hexes: [
            { q: 1, r: -1, s: 0 },
            { q: 2, r: -2, s: 0 }
          ],
          direction: 'N'
        },
        building: null,
        port: null
      }]
    ]),
    edges: new Map([
      ['e1', {
        id: 'e1',
        position: {
          hexes: [
            { q: 0, r: 0, s: 0 },
            { q: 1, r: -1, s: 0 }
          ],
          direction: 'NE'
        },
        connection: null
      }],
      ['e2', {
        id: 'e2',
        position: {
          hexes: [
            { q: 1, r: -1, s: 0 },
            { q: 2, r: -2, s: 0 }
          ],
          direction: 'NE'
        },
        connection: null
      }]
    ]),
    ports: [],
    robberPosition: null
  }
}

describe('Adjacency Helpers', () => {
  let gameState: GameState
  let board: Board

  beforeEach(() => {
    gameState = createMockGameState()
    board = gameState.board
  })

  describe('Core Adjacency Functions', () => {
    test('getAdjacentVertices finds vertices sharing edges', () => {
      const adjacent = getAdjacentVertices(board, 'v1')
      expect(adjacent).toContain('v2')
    })

    test('getVertexEdges finds connected edges', () => {
      const edges = getVertexEdges(board, 'v1')
      expect(edges).toContain('e1')
    })

    test('getEdgeVertices finds connected vertices', () => {
      const vertices = getEdgeVertices(board, 'e1')
      expect(vertices).toContain('v1')
      expect(vertices).toContain('v2')
    })
  })

  describe('Distance Rule Validation', () => {
    test('checkDistanceRule passes when no adjacent buildings', () => {
      const result = checkDistanceRule(board, 'v1')
      expect(result).toBe(true)
    })

    test('checkDistanceRule fails when adjacent vertex has building', () => {
      // Place a building on adjacent vertex
      const adjacentVertex = board.vertices.get('v2')!
      adjacentVertex.building = {
        type: 'settlement',
        owner: 'player1' as PlayerId,
        position: adjacentVertex.position
      }

      const result = checkDistanceRule(board, 'v1')
      expect(result).toBe(false)
    })

    test('checkDistanceRule allows building on non-adjacent vertices', () => {
      // Place building on non-adjacent vertex
      const farVertex = board.vertices.get('v3')!
      farVertex.building = {
        type: 'settlement',
        owner: 'player1' as PlayerId,
        position: farVertex.position
      }

      const result = checkDistanceRule(board, 'v1')
      expect(result).toBe(true)
    })
  })

  describe('Road Network Connectivity', () => {
    test('getPlayerRoadNetwork includes vertices with player buildings', () => {
      // Place player settlement
      const vertex = board.vertices.get('v1')!
      vertex.building = {
        type: 'settlement',
        owner: 'player1' as PlayerId,
        position: vertex.position
      }

      const network = getPlayerRoadNetwork(gameState, 'player1' as PlayerId)
      expect(network.has('v1')).toBe(true)
    })

    test('getPlayerRoadNetwork extends through player roads', () => {
      // Place settlement and road
      const vertex1 = board.vertices.get('v1')!
      vertex1.building = {
        type: 'settlement',
        owner: 'player1' as PlayerId,
        position: vertex1.position
      }

      const edge = board.edges.get('e1')!
      edge.connection = {
        type: 'road',
        owner: 'player1' as PlayerId,
        position: edge.position
      }

      const network = getPlayerRoadNetwork(gameState, 'player1' as PlayerId)
      expect(network.has('v1')).toBe(true)
      expect(network.has('v2')).toBe(true) // Connected via road
    })

    test('isConnectedToPlayerNetwork correctly identifies connected vertices', () => {
      // Setup network
      const vertex = board.vertices.get('v1')!
      vertex.building = {
        type: 'settlement',
        owner: 'player1' as PlayerId,
        position: vertex.position
      }

      const edge = board.edges.get('e1')!
      edge.connection = {
        type: 'road',
        owner: 'player1' as PlayerId,
        position: edge.position
      }

      expect(isConnectedToPlayerNetwork(gameState, 'player1' as PlayerId, 'v1')).toBe(true)
      expect(isConnectedToPlayerNetwork(gameState, 'player1' as PlayerId, 'v2')).toBe(true)
      expect(isConnectedToPlayerNetwork(gameState, 'player1' as PlayerId, 'v3')).toBe(false)
    })

    test('isEdgeConnectedToPlayer validates road placement connectivity', () => {
      // Place settlement at v1
      const vertex = board.vertices.get('v1')!
      vertex.building = {
        type: 'settlement',
        owner: 'player1' as PlayerId,
        position: vertex.position
      }

      // e1 connects to v1, so should be valid
      expect(isEdgeConnectedToPlayer(gameState, 'player1' as PlayerId, 'e1')).toBe(true)
      
      // e2 doesn't connect to player network, so should be invalid
      expect(isEdgeConnectedToPlayer(gameState, 'player1' as PlayerId, 'e2')).toBe(false)
    })
  })

  describe('Setup Phase Validation', () => {
    test('checkSetupRoadPlacement finds most recent settlement', () => {
      // Place settlement for player
      const vertex = board.vertices.get('v1')!
      vertex.building = {
        type: 'settlement',
        owner: 'player1' as PlayerId,
        position: vertex.position
      }

      // Road connecting to this settlement should be valid
      const result = checkSetupRoadPlacement(gameState, 'player1' as PlayerId, 'e1')
      expect(result).toBe(true)

      // Road not connecting should be invalid
      const result2 = checkSetupRoadPlacement(gameState, 'player1' as PlayerId, 'e2')
      expect(result2).toBe(false)
    })
  })

  describe('Advanced Network Analysis', () => {
    test('calculateLongestRoad computes correct road length', () => {
      // Create a simple 2-road chain
      const v1 = board.vertices.get('v1')!
      v1.building = {
        type: 'settlement',
        owner: 'player1' as PlayerId,
        position: v1.position
      }

      const e1 = board.edges.get('e1')!
      e1.connection = {
        type: 'road',
        owner: 'player1' as PlayerId,
        position: e1.position
      }

      const e2 = board.edges.get('e2')!
      e2.connection = {
        type: 'road',
        owner: 'player1' as PlayerId,
        position: e2.position
      }

      const longestRoad = calculateLongestRoad(gameState, 'player1' as PlayerId)
      expect(longestRoad).toBeGreaterThanOrEqual(1) // Should find at least 1 road
    })

    test('getPossibleSettlementPositions respects distance rule', () => {
      // Place a settlement
      const vertex = board.vertices.get('v1')!
      vertex.building = {
        type: 'settlement',
        owner: 'player2' as PlayerId,
        position: vertex.position
      }

      const positions = getPossibleSettlementPositions(gameState, 'player1' as PlayerId)
      
      // v2 should be blocked by distance rule (adjacent to v1)
      expect(positions).not.toContain('v2')
      
      // v3 should be allowed (not adjacent to v1)
      expect(positions).toContain('v3')
    })

    test('getPossibleRoadPositions respects connectivity requirements', () => {
      // Place settlement to establish network
      const vertex = board.vertices.get('v1')!
      vertex.building = {
        type: 'settlement',
        owner: 'player1' as PlayerId,
        position: vertex.position
      }

      const positions = getPossibleRoadPositions(gameState, 'player1' as PlayerId)
      
      // e1 connects to player settlement, should be valid
      expect(positions).toContain('e1')
      
      // e2 doesn't connect to player network, should be invalid in normal play
      expect(positions).not.toContain('e2')
    })
  })

  describe('Edge Cases and Error Handling', () => {
    test('handles invalid vertex IDs gracefully', () => {
      expect(getAdjacentVertices(board, 'invalid')).toEqual([])
      expect(getVertexEdges(board, 'invalid')).toEqual([])
      expect(checkDistanceRule(board, 'invalid')).toBe(true) // No adjacent = valid
    })

    test('handles invalid edge IDs gracefully', () => {
      expect(getEdgeVertices(board, 'invalid')).toEqual([])
      expect(isEdgeConnectedToPlayer(gameState, 'player1' as PlayerId, 'invalid')).toBe(false)
    })

    test('handles player with no network', () => {
      const network = getPlayerRoadNetwork(gameState, 'nonexistent' as PlayerId)
      expect(network.size).toBe(0)
      
      expect(isConnectedToPlayerNetwork(gameState, 'nonexistent' as PlayerId, 'v1')).toBe(false)
    })

    test('handles empty board gracefully', () => {
      const emptyBoard: Board = {
        hexes: new Map(),
        vertices: new Map(),
        edges: new Map(),
        ports: [],
        robberPosition: null
      }

      expect(getAdjacentVertices(emptyBoard, 'v1')).toEqual([])
      expect(checkDistanceRule(emptyBoard, 'v1')).toBe(true)
    })
  })

  describe('Performance Considerations', () => {
    test('network calculation scales with moderate board size', () => {
      // Create larger test board
      const largeBoard = createMockBoard()
      
      // Add more vertices and edges
      for (let i = 4; i <= 20; i++) {
        largeBoard.vertices.set(`v${i}`, {
          id: `v${i}`,
          position: {
            hexes: [{ q: i, r: -i, s: 0 }],
            direction: 'N'
          },
          building: null,
          port: null
        })
      }

      const largeGameState = { ...gameState, board: largeBoard }
      
      // Should complete in reasonable time
      const start = Date.now()
      const network = getPlayerRoadNetwork(largeGameState, 'player1' as PlayerId)
      const elapsed = Date.now() - start
      
      expect(elapsed).toBeLessThan(100) // Should be very fast for this size
      expect(typeof network.size).toBe('number')
    })
  })
})

describe('Integration Tests', () => {
  test('complete settlement placement workflow', () => {
    const gameState = createMockGameState()
    const board = gameState.board
    
    // 1. Check initial placement is valid
    expect(checkDistanceRule(board, 'v1')).toBe(true)
    
    // 2. Place settlement
    const vertex = board.vertices.get('v1')!
    vertex.building = {
      type: 'settlement',
      owner: 'player1' as PlayerId,
      position: vertex.position
    }
    
    // 3. Check adjacent placement is now blocked
    expect(checkDistanceRule(board, 'v2')).toBe(false)
    
    // 4. Check road can connect to settlement
    expect(isEdgeConnectedToPlayer(gameState, 'player1' as PlayerId, 'e1')).toBe(true)
    
    // 5. Place road
    const edge = board.edges.get('e1')!
    edge.connection = {
      type: 'road',
      owner: 'player1' as PlayerId,
      position: edge.position
    }
    
    // 6. Verify network expansion
    const network = getPlayerRoadNetwork(gameState, 'player1' as PlayerId)
    expect(network.has('v1')).toBe(true)
    expect(network.has('v2')).toBe(true)
    
    // 7. Check second settlement can now be placed at end of road
    expect(isConnectedToPlayerNetwork(gameState, 'player1' as PlayerId, 'v2')).toBe(true)
  })
}) 