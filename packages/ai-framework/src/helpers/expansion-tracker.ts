import { GameState, PlayerId, getPossibleSettlementPositions, getPossibleRoadPositions } from '@settlers/game-engine'

export interface RoadEndpoint {
  edgeId: string
  vertexId: string
  canPlaceSettlement: boolean
  blockedByOpponent: boolean
  distanceFromSettlement: number
}

export interface ExpansionPath {
  startingSettlement: string
  currentEndpoints: RoadEndpoint[]
  status: 'READY' | 'BUILDING' | 'BLOCKED' | 'DEAD_END'
  priority: number
}

/**
 * Get all roads owned by a player
 */
export function getPlayerRoads(gameState: GameState, playerId: PlayerId): string[] {
  const roads: string[] = []
  
  for (const [edgeId, edge] of gameState.board.edges) {
    if (edge.connection?.owner === playerId && edge.connection.type === 'road') {
      roads.push(edgeId)
    }
  }
  
  return roads
}

/**
 * Find all endpoints of player's road network
 */
export function findRoadEndpoints(gameState: GameState, playerId: PlayerId): RoadEndpoint[] {
  const playerRoads = getPlayerRoads(gameState, playerId)
  const endpoints: RoadEndpoint[] = []
  
  // For each road, find its connected vertices
  for (const edgeId of playerRoads) {
    const connectedVertices = findConnectedVertices(gameState, edgeId)
    
    for (const vertexId of connectedVertices) {
      // Check if this vertex is at the end of a road chain (expansion point)
      if (isRoadEndpoint(gameState, playerId, vertexId)) {
        const canPlace = canPlaceSettlement(gameState, vertexId)
        const blocked = isBlockedByOpponent(gameState, vertexId)
        const distance = calculateDistanceFromNearestSettlement(gameState, playerId, vertexId)
        
        endpoints.push({
          edgeId,
          vertexId,
          canPlaceSettlement: canPlace,
          blockedByOpponent: blocked,
          distanceFromSettlement: distance
        })
      }
    }
  }
  
  return endpoints
}

/**
 * Check if player can place a settlement at a vertex
 */
export function canPlaceSettlement(gameState: GameState, vertexId: string): boolean {
  const vertex = gameState.board.vertices.get(vertexId)
  if (!vertex) return false
  
  // Check if vertex already has a building
  if (vertex.building) return false
  
  // Check distance rule (no settlements within 2 edges)
  return checkDistanceRule(gameState, vertexId)
}

/**
 * Check if expansion path is blocked by opponents
 */
export function isPathBlocked(gameState: GameState, fromVertexId: string, toVertexId: string): boolean {
  // This is a simplified check - in a full implementation we'd pathfind
  // For now, just check if the target vertex is occupied or blocked
  const targetVertex = gameState.board.vertices.get(toVertexId)
  if (!targetVertex) return true
  
  return !!targetVertex.building || !checkDistanceRule(gameState, toVertexId)
}

/**
 * Find new expansion paths when current ones are blocked
 */
export function findNewExpansionPaths(gameState: GameState, playerId: PlayerId): ExpansionPath[] {
  const playerSettlements = getPlayerSettlements(gameState, playerId)
  const paths: ExpansionPath[] = []
  
  for (const settlementVertex of playerSettlements) {
    const endpoints = findRoadEndpointsFromSettlement(gameState, playerId, settlementVertex)
    
    let status: ExpansionPath['status'] = 'DEAD_END'
    if (endpoints.some(ep => ep.canPlaceSettlement)) {
      status = 'READY'
    } else if (endpoints.some(ep => !ep.blockedByOpponent)) {
      status = 'BUILDING'
    } else if (endpoints.length > 0) {
      status = 'BLOCKED'
    }
    
    paths.push({
      startingSettlement: settlementVertex,
      currentEndpoints: endpoints,
      status,
      priority: calculatePathPriority(endpoints, status)
    })
  }
  
  return paths.sort((a, b) => b.priority - a.priority)
}

/**
 * Get vertices where player has settlements
 */
function getPlayerSettlements(gameState: GameState, playerId: PlayerId): string[] {
  // Validate input parameters
  if (!gameState?.board?.vertices) {
    console.error('[getPlayerSettlements] Invalid game state: missing board or vertices')
    return []
  }
  
  if (!playerId) {
    console.error('[getPlayerSettlements] Invalid playerId')
    return []
  }

  const settlements: string[] = []
  
  for (const [vertexId, vertex] of gameState.board.vertices) {
    if (vertex.building?.owner === playerId && vertex.building.type === 'settlement') {
      settlements.push(vertexId)
    }
  }
  
  return settlements
}

/**
 * Find connected vertices for an edge
 */
function findConnectedVertices(gameState: GameState, edgeId: string): string[] {
  const edge = gameState.board.edges.get(edgeId)
  if (!edge) return []

  const connectedVertices: string[] = []
  
  for (const [vertexId, vertex] of gameState.board.vertices) {
    // Check if vertex is connected to this edge (shares 2 hexes)
    const sharedHexes = edge.position.hexes.filter(edgeHex =>
      vertex.position.hexes.some(vertexHex =>
        edgeHex.q === vertexHex.q && edgeHex.r === vertexHex.r && edgeHex.s === vertexHex.s
      )
    )
    
    if (sharedHexes.length === 2) {
      connectedVertices.push(vertexId)
    }
  }
  
  return connectedVertices
}

/**
 * Check if a vertex is at the end of a road chain (potential expansion point)
 */
function isRoadEndpoint(gameState: GameState, playerId: PlayerId, vertexId: string): boolean {
  const vertex = gameState.board.vertices.get(vertexId)
  if (!vertex) return false
  
  // If vertex has player's settlement, it's not an endpoint for expansion
  if (vertex.building?.owner === playerId) return false
  
  // Count adjacent roads owned by player
  let adjacentPlayerRoads = 0
  
  // Check all edges connected to this vertex
  for (const [edgeId, edge] of gameState.board.edges) {
    if (edge.connection?.owner === playerId && edge.connection.type === 'road') {
      // Check if this edge is connected to our vertex
      const edgeVertices = findConnectedVertices(gameState, edgeId)
      if (edgeVertices.includes(vertexId)) {
        adjacentPlayerRoads++
      }
    }
  }
  
  // Endpoint has exactly 1 adjacent road (not 0 and not 2+)
  return adjacentPlayerRoads === 1
}

/**
 * Check distance rule for settlement placement
 */
function checkDistanceRule(gameState: GameState, vertexId: string): boolean {
  // Simplified distance check - use game engine's getPossibleSettlementPositions instead
  const possiblePositions = getPossibleSettlementPositions(gameState, 'temp-player-id')
  return possiblePositions.includes(vertexId)
}

/**
 * Check if vertex is blocked by opponent building
 */
function isBlockedByOpponent(gameState: GameState, vertexId: string): boolean {
  const vertex = gameState.board.vertices.get(vertexId)
  if (!vertex) return true
  
  return !!vertex.building // Any building blocks it
}

/**
 * Calculate distance from nearest settlement
 */
function calculateDistanceFromNearestSettlement(gameState: GameState, playerId: PlayerId, vertexId: string): number {
  // Find player's settlements
  const playerSettlements: string[] = []
  for (const [vertexId, vertex] of gameState.board.vertices) {
    if (vertex.building?.owner === playerId && vertex.building.type === 'settlement') {
      playerSettlements.push(vertexId)
    }
  }
  
  if (playerSettlements.length === 0) return Infinity
  
  // Simple distance calculation (could be enhanced with proper pathfinding)
  // For now, assume most expansion points are 1-3 roads away
  let minDistance = Infinity
  
  for (const settlementId of playerSettlements) {
    // Simplified: estimate distance based on coordinate proximity
    // In full implementation, we'd use road pathfinding
    const distance = estimateDistance(gameState, settlementId, vertexId)
    minDistance = Math.min(minDistance, distance)
  }
  
  return minDistance
}

/**
 * Estimate distance between vertices (simplified)
 */
function estimateDistance(gameState: GameState, vertex1: string, vertex2: string): number {
  // Very simplified distance estimate
  // In practice, we'd use actual road pathfinding
  return Math.abs(vertex1.length - vertex2.length) / 10 + 1 // Rough approximation
}

/**
 * Find road endpoints from a specific settlement
 */
function findRoadEndpointsFromSettlement(gameState: GameState, playerId: PlayerId, _settlementVertex: string): RoadEndpoint[] {
  // Simplified implementation - return endpoints connected to this settlement
  return findRoadEndpoints(gameState, playerId).filter(endpoint => 
    endpoint.distanceFromSettlement <= 3 // Rough proximity filter
  )
}

/**
 * Calculate priority score for an expansion path
 */
function calculatePathPriority(endpoints: RoadEndpoint[], status: ExpansionPath['status']): number {
  let priority = 0
  
  // Base priority by status
  switch (status) {
    case 'READY': priority = 100; break
    case 'BUILDING': priority = 60; break
    case 'BLOCKED': priority = 20; break
    case 'DEAD_END': priority = 0; break
  }
  
  // Bonus for endpoints that can place settlements
  priority += endpoints.filter(ep => ep.canPlaceSettlement).length * 20
  
  // Penalty for blocked endpoints
  priority -= endpoints.filter(ep => ep.blockedByOpponent).length * 10
  
  return priority
} 

/**
 * Find the best road to build from a settlement for future expansion
 */
export function findBestExpansionRoad(
  gameState: GameState, 
  playerId: PlayerId, 
  settlementVertexId: string
): string | null {
  const possibleRoads = getPossibleRoadPositions(gameState, playerId)
  
  if (possibleRoads.length === 0) {
    return null
  }
  
  // Score each road based on future settlement potential
  const roadScores: Array<{ edgeId: string, score: number, reasoning: string }> = []
  
  for (const edgeId of possibleRoads) {
    // Check if this road is connected to our settlement
    const connectedVertices = findConnectedVertices(gameState, edgeId)
    if (!connectedVertices.includes(settlementVertexId)) {
      continue // Skip roads not connected to this settlement
    }
    
    // Find the other vertex (not our settlement)
    const otherVertex = connectedVertices.find(v => v !== settlementVertexId)
    if (!otherVertex) continue
    
    let score = 0
    let reasoning = ''
    
    // Score based on future settlement potential at the other end
    const futureScore = scoreFutureSettlementPotential(gameState, otherVertex, playerId)
    score += futureScore.score
    reasoning += futureScore.reasoning
    
    // Bonus for opening new areas
    const isNewDirection = checkIfNewDirection(gameState, playerId, settlementVertexId, edgeId)
    if (isNewDirection) {
      score += 2
      reasoning += ', new direction'
    }
    
    roadScores.push({ edgeId, score, reasoning })
  }
  
  if (roadScores.length === 0) {
    // Fallback: any road connected to settlement
    const fallbackRoad = possibleRoads.find(edgeId => {
      const connectedVertices = findConnectedVertices(gameState, edgeId)
      return connectedVertices.includes(settlementVertexId)
    })
    return fallbackRoad ?? possibleRoads[0] ?? null
  }
  
  // Sort by score and return best
  roadScores.sort((a, b) => b.score - a.score)
  const bestRoad = roadScores[0]
  if (!bestRoad) {
    return null
  }
  
  console.log(`🛣️ Best road from ${settlementVertexId}: ${bestRoad.edgeId} (score: ${bestRoad.score}, ${bestRoad.reasoning})`)
  
  return bestRoad.edgeId
}

/**
 * Score the potential for placing a settlement at a future vertex
 */
function scoreFutureSettlementPotential(gameState: GameState, vertexId: string, _playerId: PlayerId) {
  let score = 0
  let reasoning = ''
  
  // Check if we can eventually place a settlement here
  const vertex = gameState.board.vertices.get(vertexId)
  if (!vertex) {
    return { score: 0, reasoning: 'invalid vertex' }
  }
  
  // Penalty if already occupied
  if (vertex.building) {
    return { score: -5, reasoning: 'occupied' }
  }
  
  // Score based on adjacent hexes (simplified version of vertex scoring)
  let pipScore = 0
  let hexCount = 0
  
  for (const hexCoord of vertex.position.hexes) {
    for (const [_hexId, hex] of gameState.board.hexes) {
      if (hex.position.q === hexCoord.q && 
          hex.position.r === hexCoord.r && 
          hex.position.s === hexCoord.s) {
        
        if (hex.terrain && hex.numberToken && hex.terrain !== 'desert' && hex.terrain !== 'sea') {
          // Simple pip scoring
          const pips = [6, 8].includes(hex.numberToken) ? 5 : 
                      [5, 9].includes(hex.numberToken) ? 4 :
                      [4, 10].includes(hex.numberToken) ? 3 :
                      [3, 11].includes(hex.numberToken) ? 2 : 1
          pipScore += pips
          hexCount++
        }
        break
      }
    }
  }
  
  score += pipScore
  reasoning += `${pipScore} pips, ${hexCount} hexes`
  
  // Bonus for 3-hex intersections
  if (hexCount === 3) {
    score += 3
    reasoning += ', 3-hex bonus'
  }
  
  return { score, reasoning }
}

/**
 * Check if this road opens a new direction from the settlement
 */
function checkIfNewDirection(gameState: GameState, playerId: PlayerId, settlementVertexId: string, _newEdgeId: string): boolean {
  // Get existing roads from this settlement
  const existingRoads = getPlayerRoads(gameState, playerId)
  const connectedRoads = existingRoads.filter(edgeId => {
    const connectedVertices = findConnectedVertices(gameState, edgeId)
    return connectedVertices.includes(settlementVertexId)
  })
  
  // If this is the first road from settlement, it's definitely new
  if (connectedRoads.length === 0) {
    return true
  }
  
  // More sophisticated direction checking could be added here
  // For now, assume it's new if we don't already have 3+ roads from this settlement
  return connectedRoads.length < 3
} 