import { GameState, PlayerId, ResourceType, getPossibleSettlementPositions } from '@settlers/game-engine'
import { PIP_VALUES, HEX_COUNT_BONUS, terrainToResource, BUILD_COSTS } from '.'

export interface VertexScore {
  vertexId: string
  totalScore: number
  pipScore: number
  hexCountBonus: number
  scarcityBonus: number
  diversityBonus: number
  recipeBonus: number
  portBonus: number
  resources: ResourceType[]
  hexCount: number
}

export interface ScoringWeights {
  pips: number           // Base pip value weight
  hexCount: number       // Bonus for 3-hex vs 2-hex intersections  
  scarcity: number       // Scarcity multiplier weight
  diversity: number      // Bonus for new resources not owned
  recipes: number        // Bonus for completing building recipes
  ports: number          // Bonus for port access synergy
}

// ============= SCARCITY CALCULATION =============

/**
 * Calculate total pips available for each resource type on the board
 */
export function calculateResourcePips(gameState: GameState): Record<ResourceType, number> {
  const pipTotals: Record<ResourceType, number> = {
    wood: 0,
    brick: 0,
    sheep: 0,
    wheat: 0,
    ore: 0
  }

  for (const hex of gameState.board.hexes.values()) {
    if (hex.numberToken && hex.terrain && hex.terrain !== 'desert' && hex.terrain !== 'sea') {
      const resource = terrainToResource(hex.terrain)
      const pips = PIP_VALUES[hex.numberToken as keyof typeof PIP_VALUES] || 0
      pipTotals[resource] += pips
    }
  }

  return pipTotals
}

/**
 * Calculate scarcity multipliers for each resource based on pip availability
 * Lower pip totals = higher scarcity = higher multiplier
 */
export function calculateScarcityMultipliers(gameState: GameState): Record<ResourceType, number> {
  const pipTotals = calculateResourcePips(gameState)
  
  // Find the maximum pip total to use as baseline
  const maxPips = Math.max(...Object.values(pipTotals))
  
  // Calculate scarcity multipliers (inverse relationship)
  const scarcityMultipliers: Record<ResourceType, number> = {} as Record<ResourceType, number>
  
  for (const [resource, pips] of Object.entries(pipTotals) as [ResourceType, number][]) {
    // Square root scaling: meaningful but not overwhelming scarcity premium
    scarcityMultipliers[resource] = Math.round(Math.sqrt(maxPips / pips) * 10) / 10
  }
  
  return scarcityMultipliers
}

// ============= VERTEX SCORING =============

/**
 * Score all valid settlement vertices for a player
 */
export function scoreVertices(
  gameState: GameState, 
  playerId: PlayerId, 
  currentResources: ResourceType[],
  weights: ScoringWeights
): VertexScore[] {
  const validVertices = getPossibleSettlementPositions(gameState, playerId)
  const scarcityMultipliers = calculateScarcityMultipliers(gameState)
  const currentResourceSet = new Set(currentResources)
  
  return validVertices.map(vertexId => {
    const vertexData = getVertexData(gameState, vertexId)
    
    // Base pip score
    const pipScore = vertexData.hexData.reduce((sum, hex) => sum + hex.pips, 0)
    
    // Hex count bonus (3-hex intersections are much better)
    const hexCountBonus = HEX_COUNT_BONUS[vertexData.hexCount as keyof typeof HEX_COUNT_BONUS] || 0
    
    // Scarcity bonus - multiply by scarcity of resources this vertex provides
    const scarcityBonus = vertexData.hexData.reduce((sum, hex) => {
      const multiplier = scarcityMultipliers[hex.resource] || 1.0
      return sum + (hex.pips * (multiplier - 1.0)) // Only count the scarcity premium
    }, 0)
    
    // Diversity bonus - extra value for new resource types
    const diversityBonus = vertexData.hexData.reduce((sum, hex) => {
      return currentResourceSet.has(hex.resource) ? sum : sum + 2
    }, 0)
    
    // Recipe completion bonus
    const recipeBonus = calculateRecipeBonus(vertexData.resources, currentResources)
    
    // Port bonus - placeholder for now
    const portBonus = 0 // TODO: Implement when game engine supports ports
    
    // Calculate total weighted score
    const totalScore = 
      (pipScore * weights.pips) +
      (hexCountBonus * weights.hexCount) +
      (scarcityBonus * weights.scarcity) +
      (diversityBonus * weights.diversity) +
      (recipeBonus * weights.recipes) +
      (portBonus * weights.ports)
    
    return {
      vertexId,
      totalScore,
      pipScore,
      hexCountBonus,
      scarcityBonus,
      diversityBonus,
      recipeBonus,
      portBonus,
      resources: vertexData.resources,
      hexCount: vertexData.hexCount
    }
  }).sort((a, b) => b.totalScore - a.totalScore)
}

/**
 * Get vertex data including adjacent hexes and resources
 */
function getVertexData(gameState: GameState, vertexId: string) {
  const vertex = gameState.board.vertices.get(vertexId)
  if (!vertex) {
    throw new Error(`Vertex ${vertexId} not found`)
  }
  
  const hexData: Array<{ resource: ResourceType, pips: number, numberToken: number }> = []
  const resources: ResourceType[] = []
  
  // Get adjacent hexes
  for (const hexCoord of vertex.position.hexes) {
    for (const [hexId, hex] of gameState.board.hexes) {
      if (hex.position.q === hexCoord.q && 
          hex.position.r === hexCoord.r && 
          hex.position.s === hexCoord.s) {
        
        if (hex.terrain && hex.numberToken && hex.terrain !== 'desert' && hex.terrain !== 'sea') {
          const resource = terrainToResource(hex.terrain)
          const pips = PIP_VALUES[hex.numberToken as keyof typeof PIP_VALUES] || 0
          
          hexData.push({
            resource,
            pips,
            numberToken: hex.numberToken
          })
          resources.push(resource)
        }
        break
      }
    }
  }
  
  return {
    hexData,
    resources,
    hexCount: hexData.length
  }
}

/**
 * Calculate bonus for completing building recipes
 */
function calculateRecipeBonus(vertexResources: ResourceType[], currentResources: ResourceType[]): number {
  const combinedResources = [...new Set([...vertexResources, ...currentResources])]
  let bonus = 0
  
  // Settlement recipe bonus (wood, brick, sheep, wheat)
  const settlementResources = ['wood', 'brick', 'sheep', 'wheat'] as ResourceType[]
  const settlementCount = settlementResources.filter(r => combinedResources.includes(r)).length
  if (settlementCount >= 4) bonus += 3 // Complete settlement recipe
  else if (settlementCount === 3) bonus += 1 // Almost complete
  
  // City recipe bonus (wheat x2, ore x3)
  const cityResources = ['wheat', 'ore'] as ResourceType[]
  const cityCount = cityResources.filter(r => combinedResources.includes(r)).length
  if (cityCount >= 2) bonus += 2 // Has both wheat and ore
  else if (cityCount === 1) bonus += 0.5 // Has one city resource
  
  return bonus
} 