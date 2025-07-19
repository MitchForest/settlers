import { GameState, PlayerId, ResourceType } from '@settlers/game-engine'
import { scoreVertices, ScoringWeights } from '../../helpers/vertex-scoring'
import { findBestExpansionRoad } from '../../helpers/expansion-tracker'
import { terrainToResource } from '../../helpers'

// Configurable weights for testing different strategies
const FIRST_SETTLEMENT_WEIGHTS: ScoringWeights = {
  pips: 1.0,        // Base pip value (6,8 = 5 pips, etc.)
  hexCount: 2.0,    // Heavily favor 3-hex intersections
  scarcity: 0.5,    // Light scarcity bonus
  diversity: 0.0,   // No diversity bonus for first settlement
  recipes: 0.0,     // No recipe bonus for first settlement
  ports: 0.0        // No port bonus for first settlement
}

const SECOND_SETTLEMENT_WEIGHTS: ScoringWeights = {
  pips: 1.0,        // Base pip value
  hexCount: 1.5,    // Still favor 3-hex but less than first
  scarcity: 0.8,    // More scarcity awareness
  diversity: 2.0,   // Heavily favor new resources
  recipes: 1.5,     // Bonus for completing building recipes
  ports: 2.5        // Strong bonus for port synergy with 6s/8s
}

/**
 * Extract all resource types from player's settlements
 */
function getPlayerResources(gameState: GameState, playerId: PlayerId): ResourceType[] {
  const allResources: Set<ResourceType> = new Set()

  for (const [vertexId, vertex] of gameState.board.vertices) {
    if (vertex.building?.owner === playerId && vertex.building.type === 'settlement') {
      const vertexResources = getVertexResources(gameState, vertexId)
      vertexResources.forEach(r => allResources.add(r))
    }
  }

  return Array.from(allResources)
}

/**
 * Extract resource types from a specific vertex
 */
function getVertexResources(gameState: GameState, vertexId: string): ResourceType[] {
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

export class InitialPlacementStrategy {
  
  /**
   * First settlement: Focus on raw value (pips + hex count)
   */
  selectFirstSettlement(gameState: GameState, playerId: PlayerId): string {
    const scores = scoreVertices(gameState, playerId, [], FIRST_SETTLEMENT_WEIGHTS)
    return scores[0].vertexId // Highest score
  }
  
  /**
   * Second settlement: Focus on diversity and recipe completion
   */
  selectSecondSettlement(gameState: GameState, playerId: PlayerId): string {
    const currentResources = getPlayerResources(gameState, playerId)
    const scores = scoreVertices(gameState, playerId, currentResources, SECOND_SETTLEMENT_WEIGHTS)
    return scores[0].vertexId // Highest score
  }
  
  /**
   * First road: Focus on future settlement potential
   */
  selectFirstRoad(gameState: GameState, playerId: PlayerId, settlementVertexId: string): string | null {
    console.log(`🛣️ Selecting first road from settlement: ${settlementVertexId}`)
    return findBestExpansionRoad(gameState, playerId, settlementVertexId)
  }
  
  /**
   * Second road: Focus on diversity + potential opponent blocking  
   */
  selectSecondRoad(gameState: GameState, playerId: PlayerId, settlementVertexId: string): string | null {
    console.log(`🛣️ Selecting second road from settlement: ${settlementVertexId}`)
    // For second road, use same logic but could add opponent blocking consideration
    return findBestExpansionRoad(gameState, playerId, settlementVertexId)
  }
} 