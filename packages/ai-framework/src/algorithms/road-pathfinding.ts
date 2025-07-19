import { GameState, PlayerId, getPossibleRoadPositions } from '@settlers/game-engine'
import { VertexScore } from './vertex-scoring'

/**
 * Shared road simulation utilities
 */

/**
 * Simulate placing a road (simple clone with road added)
 */
function simulateRoadPlacement(gameState: GameState, roadId: string, playerId: PlayerId): GameState {
  const simulated = structuredClone(gameState)
  const edge = simulated.board.edges.get(roadId)
  if (edge) {
    edge.connection = { 
      type: 'road', 
      owner: playerId, 
      position: edge.position 
    }
  }
  return simulated
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
 * Get the endpoint vertex of a road that's not the specified starting vertex
 */
function getRoadEndpointVertex(gameState: GameState, roadId: string, excludeVertexId: string): string | null {
  const connectedVertices = findConnectedVertices(gameState, roadId)
  return connectedVertices.find(v => v !== excludeVertexId) || null
}

/**
 * Find best initial road by looking 2 road segments ahead at potential settlement locations
 */
export function findBestInitialRoadToTarget(
  gameState: GameState,
  fromVertexId: string,
  targetScoringFunction: (gameState: GameState, playerId: PlayerId, ...args: any[]) => VertexScore[],
  playerId: PlayerId,
  ...scoringArgs: any[]
): string | null {
  // Get the 1-3 immediate road options from current settlement
  const possibleFirstRoads = getPossibleRoadPositions(gameState, playerId)
  
  let bestRoad: string | null = null
  let bestScore = -1
  
  for (const firstRoadId of possibleFirstRoads) {
    // Get the endpoint vertex of this first road (not our current settlement)
    const firstRoadEndVertex = getRoadEndpointVertex(gameState, firstRoadId, fromVertexId)
    if (!firstRoadEndVertex) continue
    
    // Simulate placing this first road to see what 2nd roads become available
    const simulatedGameState = simulateRoadPlacement(gameState, firstRoadId, playerId)
    const possibleSecondRoads = getPossibleRoadPositions(simulatedGameState, playerId)
    
    // For each potential 2nd road, find the settlement vertices we could reach
    let totalChainScore = 0
    let chainCount = 0
    
    for (const secondRoadId of possibleSecondRoads) {
      if (secondRoadId === firstRoadId) continue // Skip the road we just placed
      
      const secondRoadEndVertex = getRoadEndpointVertex(simulatedGameState, secondRoadId, firstRoadEndVertex)
      if (!secondRoadEndVertex) continue
      
      // Score the potential settlement vertices around this 2nd road endpoint
      const potentialSettlements = getVerticesAroundPosition(simulatedGameState, secondRoadEndVertex)
      
      for (const settlementVertex of potentialSettlements) {
        const vertexScores = targetScoringFunction(simulatedGameState, playerId, ...scoringArgs)
        const vertexScore = vertexScores.find(vs => vs.vertexId === settlementVertex)
        
        if (vertexScore) {
          totalChainScore += vertexScore.score
          chainCount++
        }
      }
    }
    
    // Average score for this chain
    const averageChainScore = chainCount > 0 ? totalChainScore / chainCount : 0
    
    if (averageChainScore > bestScore) {
      bestScore = averageChainScore
      bestRoad = firstRoadId
    }
  }
  
  return bestRoad
}

/**
 * Find best road from a vertex toward highest scoring target vertices
 */
export function findBestRoadToTarget(
  gameState: GameState,
  fromVertexId: string,
  targetScoringFunction: (gameState: GameState, playerId: PlayerId, ...args: any[]) => VertexScore[],
  playerId: PlayerId,
  ...scoringArgs: any[]
): string | null {
  // Get all possible roads we can build
  const possibleRoads = getPossibleRoadPositions(gameState, playerId)
  
  // Get target vertices ranked by scoring algorithm
  const targetVertices = targetScoringFunction(gameState, playerId, ...scoringArgs)
  
  // Find roads that connect from our vertex toward high-scoring targets
  for (const target of targetVertices) {
    for (const edgeId of possibleRoads) {
      if (roadConnectsVertices(gameState, edgeId, fromVertexId, target.vertexId)) {
        return edgeId
      }
    }
  }
  
  return null // No viable road found
}

/**
 * Check if a road connects two specific vertices
 */
function roadConnectsVertices(gameState: GameState, edgeId: string, vertex1: string, vertex2: string): boolean {
  const edge = gameState.board.edges.get(edgeId)
  if (!edge) return false
  
  // Find vertices connected to this edge
  const connectedVertices: string[] = []
  
  for (const [vertexId, vertex] of gameState.board.vertices) {
    // Check if vertex shares 2 hexes with the edge (indicating connection)
    const sharedHexes = edge.position.hexes.filter(edgeHex =>
      vertex.position.hexes.some(vertexHex =>
        edgeHex.q === vertexHex.q && edgeHex.r === vertexHex.r && edgeHex.s === vertexHex.s
      )
    )
    
    if (sharedHexes.length === 2) {
      connectedVertices.push(vertexId)
    }
  }
  
  // Check if this edge connects our two target vertices
  return connectedVertices.includes(vertex1) && connectedVertices.includes(vertex2)
} 

/**
 * Get vertices that could be reached for settlement building around a position
 */
function getVerticesAroundPosition(gameState: GameState, centerVertexId: string): string[] {
  const centerVertex = gameState.board.vertices.get(centerVertexId)
  if (!centerVertex) return []
  
  const nearbyVertices: string[] = []
  
  // Find vertices that share hexes with our center vertex (potential settlement locations)
  for (const [vertexId, vertex] of gameState.board.vertices) {
    if (vertexId === centerVertexId) continue
    
    // Check if vertices share at least one hex (adjacent)
    const sharedHexes = centerVertex.position.hexes.filter(centerHex =>
      vertex.position.hexes.some(vertexHex =>
        centerHex.q === vertexHex.q && centerHex.r === vertexHex.r && centerHex.s === vertexHex.s
      )
    )
    
    if (sharedHexes.length > 0) {
      nearbyVertices.push(vertexId)
    }
  }
  
  return nearbyVertices
} 