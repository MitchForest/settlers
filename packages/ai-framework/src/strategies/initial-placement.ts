import { GameState, PlayerId, ResourceType } from '@settlers/game-engine'
import { scoreVerticesWithScarcity, scoreVerticesWithDiversity, VertexScore } from '../algorithms/vertex-scoring'
import { findBestInitialRoadToTarget } from '../algorithms/road-pathfinding'

// Placement weight configurations
const PLACEMENT_CONFIGS = {
  firstSettlement: { number: 70, scarcity: 30 },
  firstRoad: { number: 50, diversity: 50 },
  secondSettlement: { number: 60, diversity: 40 },
  secondRoad: { number: 50, diversity: 50 }
} as const

/**
 * Extract resource types from a specific vertex
 */
function extractVertexResources(gameState: GameState, vertexId: string): ResourceType[] {
  const vertex = gameState.board.vertices.get(vertexId)
  if (!vertex) return []

  const resources: ResourceType[] = []

  for (const hexCoord of vertex.position.hexes) {
    const hex = Array.from(gameState.board.hexes.values()).find(
      h => h.position.q === hexCoord.q && h.position.r === hexCoord.r
    )

    if (hex?.terrain && hex.terrain !== 'desert' && hex.terrain !== 'sea') {
      const resource = terrainToResource(hex.terrain)
      if (!resources.includes(resource)) {
        resources.push(resource)
      }
    }
  }

  return resources
}

/**
 * Extract all resource types from player's settlements
 */
function extractPlayerResources(gameState: GameState, playerId: PlayerId): ResourceType[] {
  const allResources: Set<ResourceType> = new Set()

  for (const [vertexId, vertex] of gameState.board.vertices) {
    if (vertex.building?.owner === playerId && vertex.building.type === 'settlement') {
      const vertexResources = extractVertexResources(gameState, vertexId)
      vertexResources.forEach(r => allResources.add(r))
    }
  }

  return Array.from(allResources)
}

/**
 * Convert terrain to resource type
 */
function terrainToResource(terrain: string): ResourceType {
  const mapping: Record<string, ResourceType> = {
    forest: 'wood',
    hills: 'brick',
    pasture: 'sheep', 
    fields: 'wheat',
    mountains: 'ore'
  }
  return mapping[terrain] || 'wood'
}

export class InitialPlacementStrategy {
  
  /**
   * First settlement: 70% number weight, 30% scarcity
   */
  selectFirstSettlement(gameState: GameState, playerId: PlayerId): string {
    const { number, scarcity } = PLACEMENT_CONFIGS.firstSettlement
    const scores = scoreVerticesWithScarcity(gameState, playerId, number, scarcity)
    return scores[0].vertexId // Highest score
  }
  
  /**
   * First road: toward vertex with 50% number, 50% diversity (considering first settlement resources)
   */
  selectFirstRoad(gameState: GameState, playerId: PlayerId, firstSettlementVertexId: string): string | null {
    const { number, diversity } = PLACEMENT_CONFIGS.firstRoad
    // Get resources from first settlement
    const firstSettlementResources = extractVertexResources(gameState, firstSettlementVertexId)
    
    // Find road toward diversity-focused targets
    return findBestInitialRoadToTarget(
      gameState,
      firstSettlementVertexId,
      scoreVerticesWithDiversity,
      playerId,
      firstSettlementResources, // currentResources
      number, // numberWeightPercent
      diversity  // diversityWeightPercent
    )
  }
  
  /**
   * Second settlement: 60% number weight, 40% diversity (considering first settlement resources)
   */
  selectSecondSettlement(gameState: GameState, playerId: PlayerId): string {
    const { number, diversity } = PLACEMENT_CONFIGS.secondSettlement
    // Get resources from first settlement
    const firstSettlementResources = extractPlayerResources(gameState, playerId)
    const scores = scoreVerticesWithDiversity(gameState, playerId, firstSettlementResources, number, diversity)
    return scores[0].vertexId // Highest score
  }
  
  /**
   * Second road: toward vertex with 50% number, 50% diversity (considering both settlements)
   */
  selectSecondRoad(gameState: GameState, playerId: PlayerId, secondSettlementVertexId: string): string | null {
    const { number, diversity } = PLACEMENT_CONFIGS.secondRoad
    // Get resources from both settlements
    const allResources = extractPlayerResources(gameState, playerId)
    
    // Find road toward diversity-focused targets
    return findBestInitialRoadToTarget(
      gameState,
      secondSettlementVertexId,
      scoreVerticesWithDiversity,
      playerId,
      allResources, // currentResources
      number, // numberWeightPercent
      diversity  // diversityWeightPercent
    )
  }
} 