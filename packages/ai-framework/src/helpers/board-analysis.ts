import { GameState, ResourceType, TerrainType, PlayerId, getPossibleSettlementPositions } from '@settlers/game-engine'

// Number token scoring: 6/8 = 4, 5/9 = 3, 4/10 = 2, 3/11 = 1, 2/12 = 0
const NUMBER_SCORES: Record<number, number> = {
  6: 4, 8: 4,
  5: 3, 9: 3,
  4: 2, 10: 2,
  3: 1, 11: 1,
  2: 0, 12: 0
}

export interface VertexAnalysis {
  vertexId: string
  numberScore: number
  hexData: Array<{
    resource: ResourceType
    number: number
    terrain: TerrainType
  }>
}

export interface ResourceScarcity {
  resource: ResourceType
  totalScore: number
  abundance: 'scarce' | 'moderate' | 'abundant'
}

/**
 * Analyze only valid settlement positions for a specific player
 */
export function analyzeValidVertices(gameState: GameState, playerId: PlayerId): {
  vertices: VertexAnalysis[]
  resourceScarcity: ResourceScarcity[]
} {
  // Use game engine to get only valid positions (handles distance rule, etc.)
  const validVertexIds = getPossibleSettlementPositions(gameState, playerId)
  
  const vertices = analyzeVertices(gameState, validVertexIds)
  const resourceScarcity = analyzeResourceScarcity(gameState)
  
  return { vertices, resourceScarcity }
}

/**
 * Calculate how many resources a placement would generate over specified dice rolls
 */
export function simulateResourceGeneration(gameState: GameState, vertexId: string, rolls: number = 100): Record<ResourceType, number> {
  const vertex = gameState.board.vertices.get(vertexId)
  if (!vertex) return { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 }

  const production: Record<ResourceType, number> = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 }

  for (let i = 0; i < rolls; i++) {
    const roll = rollDice()
    
    for (const hexCoord of vertex.position.hexes) {
      const hex = Array.from(gameState.board.hexes.values()).find(
        h => h.position.q === hexCoord.q && h.position.r === hexCoord.r
      )
      
      if (hex?.numberToken === roll && hex.terrain && hex.terrain !== 'desert') {
        const resourceType = terrainToResource(hex.terrain)
        if (resourceType) {
          production[resourceType]++
        }
      }
    }
  }

  return production
}

function analyzeVertices(gameState: GameState, validVertexIds: string[]): VertexAnalysis[] {
  const analyses: VertexAnalysis[] = []

  for (const vertexId of validVertexIds) {
    const vertex = gameState.board.vertices.get(vertexId)
    if (!vertex) continue

    let numberScore = 0
    const hexData: Array<{ resource: ResourceType, number: number, terrain: TerrainType }> = []

    for (const hexCoord of vertex.position.hexes) {
      const hex = Array.from(gameState.board.hexes.values()).find(
        h => h.position.q === hexCoord.q && h.position.r === hexCoord.r
      )

      if (hex?.numberToken && hex.terrain && hex.terrain !== 'desert') {
        numberScore += NUMBER_SCORES[hex.numberToken] || 0
        
        const resourceType = terrainToResource(hex.terrain)
        if (resourceType) {
          hexData.push({
            resource: resourceType,
            number: hex.numberToken,
            terrain: hex.terrain
          })
        }
      }
    }

    analyses.push({
      vertexId,
      numberScore,
      hexData
    })
  }

  return analyses
}

function analyzeResourceScarcity(gameState: GameState): ResourceScarcity[] {
  const resourceTotals: Record<ResourceType, number> = {
    wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0
  }

  for (const hex of Array.from(gameState.board.hexes.values())) {
    if (hex.numberToken && hex.terrain && hex.terrain !== 'desert') {
      const resourceType = terrainToResource(hex.terrain)
      if (resourceType) {
        resourceTotals[resourceType] += NUMBER_SCORES[hex.numberToken] || 0
      }
    }
  }

  const allTotals = Object.values(resourceTotals)
  const maxTotal = Math.max(...allTotals)
  const minTotal = Math.min(...allTotals)
  const range = maxTotal - minTotal

  return Object.entries(resourceTotals).map(([resource, totalScore]) => {
    let abundance: 'scarce' | 'moderate' | 'abundant'
    
    if (range === 0) {
      abundance = 'moderate'
    } else {
      const normalized = (totalScore - minTotal) / range
      if (normalized < 0.33) abundance = 'scarce'
      else if (normalized > 0.66) abundance = 'abundant'
      else abundance = 'moderate'
    }

    return {
      resource: resource as ResourceType,
      totalScore,
      abundance
    }
  })
}

function terrainToResource(terrain: TerrainType): ResourceType | null {
  switch (terrain) {
    case 'forest': return 'wood'
    case 'hills': return 'brick'
    case 'pasture': return 'sheep'
    case 'fields': return 'wheat'
    case 'mountains': return 'ore'
    default: return null
  }
}

function rollDice(): number {
  return Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1
} 