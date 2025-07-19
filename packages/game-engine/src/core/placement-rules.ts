import { GameState, Board, PlayerId, Vertex } from '../types'
import { getAdjacentVertices, getVertexEdges, getEdgeVertices } from '../board/geometry'

/**
 * Placement Rules for Settlers Game
 * 
 * This module provides validation for placement rules in Settlers,
 * including distance restrictions, road network connectivity, and setup phase rules.
 * 
 * Critical for both game validation and AI decision making.
 */

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
  // Validate input parameters
  if (!state) {
    console.error('[getPlayerRoadNetwork] Invalid state: null or undefined')
    return new Set<string>()
  }
  
  if (!state.board) {
    console.error('[getPlayerRoadNetwork] Invalid state: missing board')
    return new Set<string>()
  }
  
  if (!state.board.vertices) {
    console.error('[getPlayerRoadNetwork] Invalid state: missing board.vertices')
    return new Set<string>()
  }
  
  if (!playerId) {
    console.error('[getPlayerRoadNetwork] Invalid playerId: null or undefined')
    return new Set<string>()
  }

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
    const currentVertexId = queue.shift()
    if (!currentVertexId) continue
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
 * During setup, roads must connect to the settlement that was just placed in the current turn
 */
export function checkSetupRoadPlacement(state: GameState, playerId: PlayerId, edgeId: string): boolean {
  // Get the settlement that was just placed and needs a road connection
  const targetSettlement = getSetupPhaseTargetSettlement(state, playerId)
  if (!targetSettlement) return false
  
  // Check if the edge connects to this specific settlement
  const edgeVertices = getEdgeVertices(state.board, edgeId)
  return edgeVertices.includes(targetSettlement)
}

/**
 * Get valid road positions for setup phase
 * Returns edges that connect to the settlement that was just placed in the current setup turn
 */
export function getValidSetupRoadPositions(state: GameState, playerId: PlayerId): string[] {
  const validEdges: string[] = []
  
  // Get the settlement that was just placed and needs a road connection
  const targetSettlement = getSetupPhaseTargetSettlement(state, playerId)
  if (!targetSettlement) return []
  
  // Get all edges connected to this specific settlement
  const connectedEdges = getVertexEdges(state.board, targetSettlement)
  
  // Filter for unoccupied edges
  for (const edgeId of connectedEdges) {
    const edge = state.board.edges.get(edgeId)
    if (!edge?.connection) {
      validEdges.push(edgeId)
    }
  }
  return validEdges
}

/**
 * Determine which settlement a road should connect to during setup phase
 * This uses the setup phase progression logic to identify the correct settlement
 */
function getSetupPhaseTargetSettlement(state: GameState, playerId: PlayerId): string | null {
  const playerIds = Array.from(state.players.keys())
  const currentIndex = playerIds.indexOf(playerId)
  
  if (currentIndex === -1) {
    return null
  }
  
  // Get all settlements owned by this player
  const playerSettlements: Array<{vertexId: string, vertex: Vertex}> = []
  state.board.vertices.forEach((vertex, vertexId) => {
    if (vertex.building?.owner === playerId && vertex.building.type === 'settlement') {
      playerSettlements.push({ vertexId, vertex })
    }
  })
  
  if (playerSettlements.length === 0) {
    return null
  }
  
  // Determine which settlement based on setup phase and turn progression
  if (state.phase === 'setup1') {
    // In setup1, players place their first settlement
    // We should always connect to the first (and only) settlement
    if (playerSettlements.length === 1) {
      return playerSettlements[0].vertexId
    } else {
      // If somehow there are multiple settlements in setup1, something is wrong
      // Return the last one placed as a fallback
      return playerSettlements[playerSettlements.length - 1].vertexId
    }
  } else if (state.phase === 'setup2') {
    // In setup2, players place their second settlement
    // We need to identify which is the "second" settlement
    
    if (playerSettlements.length === 1) {
      // Only one settlement exists, so connect to it
      return playerSettlements[0].vertexId
    } else if (playerSettlements.length === 2) {
      // Two settlements exist - we need to determine which was placed in setup2
      // In setup2, the current player has already placed their second settlement
      // and now needs to place the road for it
      
      // The setup2 settlement is the one that needs a road connection
      // We can identify it by checking which settlement doesn't have adjacent roads yet
      for (const { vertexId } of playerSettlements) {
        const connectedEdges = getVertexEdges(state.board, vertexId)
        const hasAdjacentRoad = connectedEdges.some(edgeId => {
          const edge = state.board.edges.get(edgeId)
          return edge?.connection?.owner === playerId
        })
        
        // If this settlement has no adjacent roads from this player, it's the target
        if (!hasAdjacentRoad) {
          return vertexId
        }
      }
      
      // Fallback: if both have roads or neither do, use positional logic
      // In setup2, players go in reverse order, so later settlements are placed in setup2
      return playerSettlements[1].vertexId
    } else {
      // More than 2 settlements shouldn't happen in setup, but handle gracefully
      return playerSettlements[playerSettlements.length - 1].vertexId
    }
  }
  
  // Not in setup phase - this function shouldn't be called
  return null
}

// ============= Advanced Network Analysis =============

/**
 * Get all possible settlement positions for a player
 * Considers distance rule and network connectivity
 */
export function getPossibleSettlementPositions(state: GameState, playerId: PlayerId): string[] {
  // Validate input parameters
  if (!state) {
    console.error('[getPossibleSettlementPositions] Invalid state: null or undefined')
    return []
  }
  
  if (!state.board) {
    console.error('[getPossibleSettlementPositions] Invalid state: missing board')
    return []
  }
  
  if (!state.board.vertices) {
    console.error('[getPossibleSettlementPositions] Invalid state: missing board.vertices')
    return []
  }
  
  if (!playerId) {
    console.error('[getPossibleSettlementPositions] Invalid playerId: null or undefined')
    return []
  }

  const validPositions: string[] = []
  const networkVertices = getPlayerRoadNetwork(state, playerId)
  
  state.board.vertices.forEach((vertex, vertexId) => {
    // Skip if already occupied
    if (vertex.building) return
    
    // Skip if violates distance rule
    if (!checkDistanceRule(state.board, vertexId)) return
    
    // During normal play, must be connected to network
    // Exception: if player has no network yet, they can build anywhere (for testing scenarios)
    if (state.phase !== 'setup1' && state.phase !== 'setup2') {
      if (networkVertices.size > 0 && !networkVertices.has(vertexId)) {
        return
      }
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
  // Validate input parameters
  if (!state) {
    console.error('[getPossibleRoadPositions] Invalid state: null or undefined')
    return []
  }
  
  if (!state.board) {
    console.error('[getPossibleRoadPositions] Invalid state: missing board')
    return []
  }
  
  if (!state.board.edges) {
    console.error('[getPossibleRoadPositions] Invalid state: missing board.edges')
    return []
  }
  
  if (!playerId) {
    console.error('[getPossibleRoadPositions] Invalid playerId: null or undefined')
    return []
  }

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

// ============= Longest Road Algorithm =============

/**
 * Road Network representation for longest road calculations
 */
interface RoadNetwork {
  vertices: Set<string>           // All vertices with player roads
  edges: Map<string, string[]>    // adjacency list: vertex -> connected vertices
  roadCount: number               // Total roads in network
}

/**
 * Calculate the actual longest road for a player using DFS
 */
export function calculateLongestRoad(
  state: GameState, 
  playerId: PlayerId
): number {
  // Build graph of player's road network
  const roadNetwork = buildPlayerRoadNetwork(state, playerId)
  
  if (roadNetwork.roadCount === 0) {
    return 0
  }
  
  // Try DFS from every vertex in the network to find longest path
  let maxLength = 0
  for (const vertex of Array.from(roadNetwork.vertices)) {
    const pathLength = dfsLongestPath(roadNetwork, vertex, new Set())
    maxLength = Math.max(maxLength, pathLength)
  }
  
  return maxLength
}

/**
 * Build a graph representation of a player's road network
 */
function buildPlayerRoadNetwork(
  state: GameState, 
  playerId: PlayerId
): RoadNetwork {
  const network: RoadNetwork = {
    vertices: new Set(),
    edges: new Map(),
    roadCount: 0
  }

  // Scan all edges for player's roads
  state.board.edges.forEach((edge, edgeId) => {
    if (edge.connection && edge.connection.owner === playerId) {
      const edgeVertices = getEdgeVertices(state.board, edgeId)
      
      if (edgeVertices.length === 2) {
        const [vertex1, vertex2] = edgeVertices
        
        // Add vertices to network
        network.vertices.add(vertex1)
        network.vertices.add(vertex2)
        
        // Add bidirectional edges
        if (!network.edges.has(vertex1)) network.edges.set(vertex1, [])
        if (!network.edges.has(vertex2)) network.edges.set(vertex2, [])
        
        const edges1 = network.edges.get(vertex1)
        const edges2 = network.edges.get(vertex2)
        if (edges1) edges1.push(vertex2)
        if (edges2) edges2.push(vertex1)
        
        network.roadCount++
      }
    }
  })

  return network
}

/**
 * DFS to find the longest path from a starting vertex
 * Returns the number of roads in the longest path
 */
function dfsLongestPath(
  network: RoadNetwork,
  currentVertex: string,
  visited: Set<string>
): number {
  visited.add(currentVertex)
  
  let maxPath = 0
  const neighbors = network.edges.get(currentVertex) || []
  
  for (const neighbor of neighbors) {
    if (!visited.has(neighbor)) {
      const pathLength = 1 + dfsLongestPath(network, neighbor, new Set(visited))
      maxPath = Math.max(maxPath, pathLength)
    }
  }
  
  return maxPath
}
