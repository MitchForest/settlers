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
  console.log(`[DEBUG] getValidSetupRoadPositions: targetSettlement = ${targetSettlement}`)
  if (!targetSettlement) return []
  
  // Get all edges connected to this specific settlement
  const connectedEdges = getVertexEdges(state.board, targetSettlement)
  console.log(`[DEBUG] getValidSetupRoadPositions: connectedEdges = ${connectedEdges.length}`)
  
  // Filter for unoccupied edges
  for (const edgeId of connectedEdges) {
    const edge = state.board.edges.get(edgeId)
    if (!edge?.connection) {
      validEdges.push(edgeId)
      console.log(`[DEBUG] getValidSetupRoadPositions: valid edge ${edgeId}`)
    } else {
      console.log(`[DEBUG] getValidSetupRoadPositions: edge ${edgeId} occupied by ${edge.connection?.owner}`)
    }
  }
  
  console.log(`[DEBUG] getValidSetupRoadPositions: returning ${validEdges.length} valid edges`)
  return validEdges
}

/**
 * Determine which settlement a road should connect to during setup phase
 * This uses the setup phase progression logic to identify the correct settlement
 */
function getSetupPhaseTargetSettlement(state: GameState, playerId: PlayerId): string | null {
  const playerIds = Array.from(state.players.keys())
  const playerCount = playerIds.length
  const currentIndex = playerIds.indexOf(playerId)
  
  if (currentIndex === -1) {
    console.log(`[DEBUG] getSetupPhaseTargetSettlement: Player ${playerId} not found in player list`)
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
  console.log(`[DEBUG] getSetupPhaseTargetSettlement: Not in setup phase (${state.phase})`)
  return null
}

/**
 * Enhanced helper: Check if a settlement has any adjacent roads from the specified player
 */
function settlementHasAdjacentPlayerRoad(state: GameState, playerId: PlayerId, vertexId: string): boolean {
  const connectedEdges = getVertexEdges(state.board, vertexId)
  return connectedEdges.some(edgeId => {
    const edge = state.board.edges.get(edgeId)
    return edge?.connection?.owner === playerId
  })
}

// ============= Advanced Network Analysis =============

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
  for (const vertex of roadNetwork.vertices) {
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
        
        network.edges.get(vertex1)!.push(vertex2)
        network.edges.get(vertex2)!.push(vertex1)
        
        network.roadCount++
      }
    }
  })

  return network
}

/**
 * Find endpoints (vertices with degree 1) in the road network
 */
function findNetworkEndpoints(network: RoadNetwork): string[] {
  const endpoints: string[] = []
  
  for (const vertex of network.vertices) {
    const connections = network.edges.get(vertex) || []
    if (connections.length === 1) {  // Degree 1 = endpoint
      endpoints.push(vertex)
    }
  }
  
  // If no endpoints (cycle), start from any vertex
  if (endpoints.length === 0 && network.vertices.size > 0) {
    endpoints.push(Array.from(network.vertices)[0])
  }
  
  return endpoints
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