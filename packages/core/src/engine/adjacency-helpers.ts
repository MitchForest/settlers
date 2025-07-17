import { GameState, Board, VertexPosition, EdgePosition, HexCoordinate, PlayerId, Vertex, Edge } from '../types'
import { honeycombBridge } from '../geometry/honeycomb-bridge'

/**
 * Adjacency Helpers for Settlers Game Rules
 * 
 * This module provides comprehensive validation for placement rules in Settlers,
 * including distance restrictions, road network connectivity, and setup phase rules.
 * 
 * Critical for both game validation and AI decision making.
 */

// ============= Core Adjacency Functions =============

/**
 * Get vertex IDs that are adjacent to the given vertex
 * In Settlers, vertices are connected through hex edges
 */
export function getAdjacentVertices(board: Board, vertexId: string): string[] {
  const vertex = board.vertices.get(vertexId)
  if (!vertex) return []

  const adjacentVertices: Set<string> = new Set()
  
  // For each hex that this vertex touches
  for (const hexCoord of vertex.position.hexes) {
    // Get all neighbors of this hex
    const neighborHexes = honeycombBridge.getHexNeighbors(hexCoord)
    
    // Find vertices that share edges with our vertex
    board.vertices.forEach((otherVertex, otherVertexId) => {
      if (otherVertexId === vertexId) return
      
      // Check if this vertex shares an edge with our vertex
      // Two vertices are adjacent if they share exactly 2 hexes
      const sharedHexes = vertex.position.hexes.filter(hexA =>
        otherVertex.position.hexes.some(hexB =>
          hexA.q === hexB.q && hexA.r === hexB.r && hexA.s === hexB.s
        )
      )
      
      if (sharedHexes.length === 2) {
        adjacentVertices.add(otherVertexId)
      }
    })
  }
  
  return Array.from(adjacentVertices)
}

/**
 * Get edge IDs that connect to the given vertex
 * A vertex connects to 3 edges (the edges of its adjacent hexes)
 */
export function getVertexEdges(board: Board, vertexId: string): string[] {
  const vertex = board.vertices.get(vertexId)
  if (!vertex) return []

  const connectedEdges: string[] = []
  
  board.edges.forEach((edge, edgeId) => {
    // An edge connects to a vertex if they share exactly 2 hexes
    const sharedHexes = vertex.position.hexes.filter(hexA =>
      edge.position.hexes.some(hexB =>
        hexA.q === hexB.q && hexA.r === hexB.r && hexA.s === hexB.s
      )
    )
    
    if (sharedHexes.length === 2) {
      connectedEdges.push(edgeId)
    }
  })
  
  return connectedEdges
}

/**
 * Get vertex IDs that are connected to the given edge
 * Each edge connects exactly 2 vertices
 */
export function getEdgeVertices(board: Board, edgeId: string): string[] {
  const edge = board.edges.get(edgeId)
  if (!edge) return []

  const connectedVertices: string[] = []
  
  board.vertices.forEach((vertex, vertexId) => {
    // A vertex connects to an edge if they share exactly 2 hexes
    const sharedHexes = edge.position.hexes.filter(hexA =>
      vertex.position.hexes.some(hexB =>
        hexA.q === hexB.q && hexA.r === hexB.r && hexA.s === hexB.s
      )
    )
    
    if (sharedHexes.length === 2) {
      connectedVertices.push(vertexId)
    }
  })
  
  return connectedVertices
}

// ============= Distance Rule Validation =============

/**
 * Check the 2-hex distance rule for settlement placement
 * No settlement can be placed adjacent to another settlement
 * This is the core rule that prevents settlements from being too close
 */
export function checkDistanceRule(board: Board, vertexId: string): boolean {
  const adjacentVertices = getAdjacentVertices(board, vertexId)
  
  // Check if any adjacent vertex has a building
  for (const adjacentVertexId of adjacentVertices) {
    const adjacentVertex = board.vertices.get(adjacentVertexId)
    if (adjacentVertex?.building) {
      return false // Violation: adjacent vertex has a building
    }
  }
  
  return true // All adjacent vertices are clear
}

/**
 * Get all vertices that would violate the distance rule if a building were placed there
 * Useful for AI to understand blocked positions
 */
export function getDistanceRuleViolations(board: Board): string[] {
  const violatingVertices: string[] = []
  
  board.vertices.forEach((vertex, vertexId) => {
    if (!vertex.building && !checkDistanceRule(board, vertexId)) {
      violatingVertices.push(vertexId)
    }
  })
  
  return violatingVertices
}

// ============= Road Network Connectivity =============

/**
 * Get all vertices connected to a player's road network
 * Uses graph traversal to find all reachable positions
 */
export function getPlayerRoadNetwork(state: GameState, playerId: PlayerId): Set<string> {
  const reachableVertices = new Set<string>()
  const visitedEdges = new Set<string>()
  
  // Start from all vertices with player's buildings
  const startingVertices: string[] = []
  state.board.vertices.forEach((vertex, vertexId) => {
    if (vertex.building?.owner === playerId) {
      startingVertices.push(vertexId)
      reachableVertices.add(vertexId)
    }
  })
  
  // BFS through player's road network
  const queue = [...startingVertices]
  
  while (queue.length > 0) {
    const currentVertexId = queue.shift()!
    const connectedEdges = getVertexEdges(state.board, currentVertexId)
    
    for (const edgeId of connectedEdges) {
      if (visitedEdges.has(edgeId)) continue
      visitedEdges.add(edgeId)
      
      const edge = state.board.edges.get(edgeId)
      if (!edge?.connection || edge.connection.owner !== playerId) continue
      
      // Follow this road to the other end
      const edgeVertices = getEdgeVertices(state.board, edgeId)
      for (const vertexId of edgeVertices) {
        if (!reachableVertices.has(vertexId)) {
          reachableVertices.add(vertexId)
          queue.push(vertexId)
        }
      }
    }
  }
  
  return reachableVertices
}

/**
 * Check if a vertex is connected to a player's road network
 * Required for settlement placement outside of setup phase
 */
export function isConnectedToPlayerNetwork(state: GameState, playerId: PlayerId, vertexId: string): boolean {
  const networkVertices = getPlayerRoadNetwork(state, playerId)
  return networkVertices.has(vertexId)
}

/**
 * Check if an edge connects to a player's existing network
 * Required for road placement outside of setup phase
 */
export function isEdgeConnectedToPlayer(state: GameState, playerId: PlayerId, edgeId: string): boolean {
  const edgeVertices = getEdgeVertices(state.board, edgeId)
  const networkVertices = getPlayerRoadNetwork(state, playerId)
  
  // Edge is connected if either endpoint is in the player's network
  return edgeVertices.some(vertexId => networkVertices.has(vertexId))
}

// ============= Setup Phase Validation =============

/**
 * Check if a road placement is valid during setup phase
 * During setup, roads must connect to the settlement just placed by the same player
 */
export function checkSetupRoadPlacement(state: GameState, playerId: PlayerId, edgeId: string): boolean {
  // Find the most recently placed settlement by this player
  let mostRecentSettlement: string | null = null
  let highestTurn = -1
  
  state.board.vertices.forEach((vertex, vertexId) => {
    if (vertex.building?.owner === playerId && vertex.building.type === 'settlement') {
      // In setup, we assume the most recent building is the one to connect to
      // This would need tracking in a real implementation
      mostRecentSettlement = vertexId
    }
  })
  
  if (!mostRecentSettlement) return false
  
  // Check if the edge connects to this settlement
  const edgeVertices = getEdgeVertices(state.board, edgeId)
  return edgeVertices.includes(mostRecentSettlement)
}

/**
 * Get valid road positions for setup phase
 * Returns edges that connect to the player's most recent settlement
 */
export function getValidSetupRoadPositions(state: GameState, playerId: PlayerId): string[] {
  const validEdges: string[] = []
  
  // Find the most recently placed settlement
  let mostRecentSettlement: string | null = null
  state.board.vertices.forEach((vertex, vertexId) => {
    if (vertex.building?.owner === playerId && vertex.building.type === 'settlement') {
      mostRecentSettlement = vertexId
    }
  })
  
  if (!mostRecentSettlement) return []
  
  // Get all edges connected to this settlement
  const connectedEdges = getVertexEdges(state.board, mostRecentSettlement)
  
  // Filter for unoccupied edges
  for (const edgeId of connectedEdges) {
    const edge = state.board.edges.get(edgeId)
    if (!edge?.connection) {
      validEdges.push(edgeId)
    }
  }
  
  return validEdges
}

// ============= Advanced Network Analysis =============

/**
 * Calculate the longest road for a player
 * Used for longest road bonus determination
 */
export function calculateLongestRoad(state: GameState, playerId: PlayerId): number {
  const playerRoads = new Set<string>()
  const roadGraph = new Map<string, string[]>() // vertex -> connected vertices through player roads
  
  // Build graph of player's roads
  state.board.edges.forEach((edge, edgeId) => {
    if (edge.connection?.owner === playerId) {
      playerRoads.add(edgeId)
      const vertices = getEdgeVertices(state.board, edgeId)
      if (vertices.length === 2) {
        const [v1, v2] = vertices
        if (!roadGraph.has(v1)) roadGraph.set(v1, [])
        if (!roadGraph.has(v2)) roadGraph.set(v2, [])
        roadGraph.get(v1)!.push(v2)
        roadGraph.get(v2)!.push(v1)
      }
    }
  })
  
  // Find longest path using DFS from each vertex
  let maxLength = 0
  
  roadGraph.forEach((_, startVertex) => {
    const visited = new Set<string>()
    const length = dfsLongestPath(roadGraph, startVertex, visited, state.board, playerId)
    maxLength = Math.max(maxLength, length)
  })
  
  return maxLength
}

/**
 * DFS helper for longest road calculation
 * Accounts for settlements/cities that may break the road
 */
function dfsLongestPath(
  roadGraph: Map<string, string[]>,
  vertex: string,
  visited: Set<string>,
  board: Board,
  playerId: PlayerId
): number {
  visited.add(vertex)
  let maxLength = 0
  
  const neighbors = roadGraph.get(vertex) || []
  for (const neighbor of neighbors) {
    if (visited.has(neighbor)) continue
    
    // Check if this vertex blocks the road (opponent's building)
    const vertexObj = board.vertices.get(vertex)
    if (vertexObj?.building && vertexObj.building.owner !== playerId) {
      continue // Road is blocked by opponent's building
    }
    
    const length = 1 + dfsLongestPath(roadGraph, neighbor, visited, board, playerId)
    maxLength = Math.max(maxLength, length)
  }
  
  visited.delete(vertex) // Backtrack for other paths
  return maxLength
}

/**
 * Get all possible settlement positions for a player
 * Considers distance rule and network connectivity
 */
export function getPossibleSettlementPositions(state: GameState, playerId: PlayerId): string[] {
  const validPositions: string[] = []
  const networkVertices = getPlayerRoadNetwork(state, playerId)
  
  state.board.vertices.forEach((vertex, vertexId) => {
    // Skip if already occupied
    if (vertex.building) return
    
    // Skip if violates distance rule
    if (!checkDistanceRule(state.board, vertexId)) return
    
    // During normal play, must be connected to network
    if (state.phase !== 'setup1' && state.phase !== 'setup2') {
      if (!networkVertices.has(vertexId)) return
    }
    
    validPositions.push(vertexId)
  })
  
  return validPositions
}

/**
 * Get all possible road positions for a player
 * Considers network connectivity and setup phase rules
 */
export function getPossibleRoadPositions(state: GameState, playerId: PlayerId): string[] {
  const validPositions: string[] = []
  
  state.board.edges.forEach((edge, edgeId) => {
    // Skip if already occupied
    if (edge.connection) return
    
    // Check connectivity based on game phase
    if (state.phase === 'setup1' || state.phase === 'setup2') {
      if (checkSetupRoadPlacement(state, playerId, edgeId)) {
        validPositions.push(edgeId)
      }
    } else {
      if (isEdgeConnectedToPlayer(state, playerId, edgeId)) {
        validPositions.push(edgeId)
      }
    }
  })
  
  return validPositions
}

// Functions are already exported above - no need to re-export 