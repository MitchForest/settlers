import { GameState, PlayerId, ResourceType } from '@settlers/game-engine'
import { NUMBER_WEIGHTS } from '../configs/number-weights'

export interface PlacementEvaluation {
  playerId: PlayerId
  productionScore: number
  diversityScore: number
  totalScore: number
  productionStrength: number
  uniqueResources: number
  settlements: Array<{
    vertexId: string
    resources: string[]
    productionValue: number
  }>
}

/**
 * Evaluate a player's initial placement performance (0-100 score)
 * 50% production strength + 50% resource diversity
 */
export function evaluateInitialPlacement(gameState: GameState, playerId: PlayerId): PlacementEvaluation {
  const playerSettlements = getPlayerSettlements(gameState, playerId)
  
  // Calculate production strength (0-50 points)
  const productionStrength = calculateProductionStrength(gameState, playerSettlements)
  const maxProduction = 30 // Approximate max for two settlements on triple 6/8 intersections
  const productionScore = Math.min((productionStrength / maxProduction) * 50, 50)
  
  // Calculate resource diversity (0-50 points) 
  const uniqueResources = calculateResourceDiversity(gameState, playerSettlements)
  const maxResources = 5 // wood, brick, sheep, wheat, ore
  const diversityScore = (uniqueResources / maxResources) * 50
  
  // Total score
  const totalScore = productionScore + diversityScore
  
  return {
    playerId,
    productionScore: Math.round(productionScore),
    diversityScore: Math.round(diversityScore),
    totalScore: Math.round(totalScore),
    productionStrength: Math.round(productionStrength * 10) / 10,
    uniqueResources,
    settlements: playerSettlements.map(s => ({
      vertexId: s.vertexId,
      resources: s.resources.map(r => `${getResourceAbbreviation(r)}-${s.hexData.find(h => h.resource === r)?.numberToken || 0}`),
      productionValue: Math.round(s.productionValue * 10) / 10
    }))
  }
}

/**
 * Get all settlements owned by a player
 */
function getPlayerSettlements(gameState: GameState, playerId: PlayerId) {
  const settlements: Array<{
    vertexId: string
    resources: ResourceType[]
    productionValue: number
    hexData: Array<{ resource: ResourceType, numberToken: number, weight: number }>
  }> = []
  
  for (const [vertexId, vertex] of gameState.board.vertices) {
    if (vertex.building?.owner === playerId && vertex.building.type === 'settlement') {
      const hexData = getSettlementHexData(gameState, vertexId)
      const resources = [...new Set(hexData.map(h => h.resource))]
      const productionValue = hexData.reduce((sum, hex) => sum + hex.weight, 0)
      
      settlements.push({
        vertexId,
        resources,
        productionValue,
        hexData
      })
    }
  }
  
  return settlements
}

/**
 * Calculate total production strength from all settlements
 */
function calculateProductionStrength(gameState: GameState, settlements: ReturnType<typeof getPlayerSettlements>): number {
  return settlements.reduce((total, settlement) => total + settlement.productionValue, 0)
}

/**
 * Calculate unique resource types from all settlements
 */
function calculateResourceDiversity(gameState: GameState, settlements: ReturnType<typeof getPlayerSettlements>): number {
  const allResources = new Set<ResourceType>()
  settlements.forEach(settlement => {
    settlement.resources.forEach(resource => allResources.add(resource))
  })
  return allResources.size
}

/**
 * Get hex data for a settlement vertex
 */
function getSettlementHexData(gameState: GameState, vertexId: string) {
  const vertex = gameState.board.vertices.get(vertexId)
  if (!vertex) return []

  const hexData: Array<{ resource: ResourceType, numberToken: number, weight: number }> = []

  for (const hexCoord of vertex.position.hexes) {
    const hex = Array.from(gameState.board.hexes.values()).find(
      h => h.position.q === hexCoord.q && h.position.r === hexCoord.r
    )

    if (hex && hex.numberToken && hex.terrain && hex.terrain !== 'desert' && hex.terrain !== 'sea') {
      hexData.push({
        resource: terrainToResource(hex.terrain),
        numberToken: hex.numberToken,
        weight: NUMBER_WEIGHTS[hex.numberToken as keyof typeof NUMBER_WEIGHTS] || 0
      })
    }
  }

  return hexData
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

/**
 * Get resource abbreviation for display
 */
function getResourceAbbreviation(resource: ResourceType): string {
  const mapping: Record<ResourceType, string> = {
    wood: 'WO',
    brick: 'BR', 
    sheep: 'SH',
    wheat: 'WH',
    ore: 'OR'
  }
  return mapping[resource] || resource.toUpperCase()
} 