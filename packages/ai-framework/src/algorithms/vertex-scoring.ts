import { GameState, ResourceType, TerrainType, getPossibleSettlementPositions, PlayerId } from '@settlers/game-engine'
import { NUMBER_WEIGHTS } from '../configs/number-weights'

// Base vertex scoring types
export interface VertexEvaluator {
  evaluate(vertexData: VertexHexData[], gameState: GameState, playerId: PlayerId): number
}

export interface VertexHexData {
  resource: ResourceType
  numberToken: number
  weight: number
  terrain: TerrainType
}

export interface VertexScore {
  vertexId: string
  score: number
  numberWeight?: number
  scarcityBonus?: number  
  diversityBonus?: number
  portBonus?: number
  hexData: VertexHexData[]
  resourcesProvided: ResourceType[]
}

export interface PlayerResourceProduction {
  wood: number
  brick: number  
  sheep: number
  wheat: number
  ore: number
}

/**
 * Base vertex scoring function using composable evaluators
 */
export function scoreVertices(
  gameState: GameState,
  playerId: PlayerId,
  evaluators: VertexEvaluator[]
): VertexScore[] {
  const validVertices = getPossibleSettlementPositions(gameState, playerId)
  
  return validVertices.map(vertexId => {
    const hexData = getVertexHexData(gameState, vertexId)
    const resourcesProvided = [...new Set(hexData.map(h => h.resource))]
    
    // Calculate score using all evaluators
    const score = evaluators.reduce((total, evaluator) => 
      total + evaluator.evaluate(hexData, gameState, playerId), 0
    )
    
    return {
      vertexId,
      score,
      hexData,
      resourcesProvided
    }
  }).sort((a, b) => b.score - a.score) // Highest score first
}

/**
 * Number weight evaluator
 */
export const NumberWeightEvaluator = (weight: number): VertexEvaluator => ({
  evaluate: (hexData: VertexHexData[]) => {
    const numberWeight = hexData.reduce((sum, hex) => sum + hex.weight, 0)
    return numberWeight * weight / 100
  }
})

/**
 * Resource scarcity evaluator
 */
export const ScarcityEvaluator = (weight: number): VertexEvaluator => ({
  evaluate: (hexData: VertexHexData[], gameState: GameState) => {
    const globalScarcity = calculateGlobalScarcity(gameState)
    const scarcityBonus = calculateScarcityBonus(hexData, globalScarcity)
    return scarcityBonus * weight / 100
  }
})

/**
 * Resource diversity evaluator  
 */
export const DiversityEvaluator = (weight: number, currentResources: ResourceType[]): VertexEvaluator => ({
  evaluate: (hexData: VertexHexData[]) => {
    const currentResourceSet = new Set(currentResources)
    const diversityBonus = calculateDiversityBonus(hexData, currentResourceSet)
    return diversityBonus * weight / 100
  }
})

/**
 * Port utility evaluator
 */
export const PortEvaluator = (weight: number, playerProduction: PlayerResourceProduction): VertexEvaluator => ({
  evaluate: (hexData: VertexHexData[], gameState: GameState, playerId: PlayerId) => {
    // TODO: Implement when port data is available from game engine
    // const portBonus = calculatePortBonus(gameState, playerId, playerProduction)
    const portBonus = 0
    return portBonus * weight / 100
  }
})

/**
 * Get hex data for a vertex with weights
 */
function getVertexHexData(gameState: GameState, vertexId: string) {
  const vertex = gameState.board.vertices.get(vertexId)!
  const hexData: VertexHexData[] = []
  
  for (const hexCoord of vertex.position.hexes) {
    const hex = Array.from(gameState.board.hexes.values()).find(
      h => h.position.q === hexCoord.q && h.position.r === hexCoord.r
    )
    
    if (hex && hex.numberToken && hex.terrain && hex.terrain !== 'desert' && hex.terrain !== 'sea') {
      hexData.push({
        resource: terrainToResource(hex.terrain as TerrainType),
        numberToken: hex.numberToken,
        weight: NUMBER_WEIGHTS[hex.numberToken as keyof typeof NUMBER_WEIGHTS] || 0,
        terrain: hex.terrain as TerrainType
      })
    }
  }
  
  return hexData
}

/**
 * Calculate global scarcity - sum of weights for each resource
 */
function calculateGlobalScarcity(gameState: GameState) {
  const totals = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 }

  for (const hex of gameState.board.hexes.values()) {
    if (hex.numberToken && hex.terrain && hex.terrain !== 'desert' && hex.terrain !== 'sea') {
      const resource = terrainToResource(hex.terrain)
      const weight = NUMBER_WEIGHTS[hex.numberToken as keyof typeof NUMBER_WEIGHTS] || 0
      totals[resource] += weight
    }
  }

  return totals
}

/**
 * Calculate scarcity bonus for a vertex based on global scarcity
 */
function calculateScarcityBonus(hexData: VertexHexData[], globalScarcity: Record<ResourceType, number>): number {
  if (hexData.length === 0) return 0
  
  // Find max global score to normalize
  const maxGlobalScore = Math.max(...Object.values(globalScarcity))
  
  // Sum up scarcity bonus for each hex
  const scarcityScore = hexData.reduce((sum, hex) => {
    const globalScore = globalScarcity[hex.resource] || 0
    // Invert: lower global score = higher scarcity value
    const scarcityValue = (maxGlobalScore - globalScore) / maxGlobalScore
    return sum + (scarcityValue * hex.weight)
  }, 0)
  
  return scarcityScore
}

/**
 * Calculate diversity bonus - weighted value of missing resources only
 */
function calculateDiversityBonus(hexData: VertexHexData[], currentResources: Set<ResourceType>): number {
  // Sum weights only for hexes that provide resources you don't currently have
  return hexData.reduce((sum, hex) => {
    if (!currentResources.has(hex.resource)) {
      return sum + hex.weight
    }
    return sum
  }, 0)
}

/**
 * Calculate port utility bonus - production divided by trade ratio
 */
function calculatePortBonus(gameState: GameState, vertexId: string, playerProduction: PlayerResourceProduction): number {
  // TODO: Need to check if vertex has a port and get port info
  // For now return 0 - will implement when port data is available
  const port = getPortAtVertex(gameState, vertexId)
  if (!port) return 0
  
  if (port.ratio === 2 && port.resource) {
    // 2:1 specific resource port
    return playerProduction[port.resource] / 2
  } else if (port.ratio === 3) {
    // 3:1 general port - use highest resource production
    const maxProduction = Math.max(...Object.values(playerProduction))
    return maxProduction / 3
  }
  
  return 0
}

/**
 * Get port information at a vertex (placeholder - needs game engine integration)
 */
function getPortAtVertex(gameState: GameState, vertexId: string): { ratio: number, resource?: ResourceType } | null {
  // TODO: Implement based on game engine's port system
  return null
}

/**
 * Convert terrain type to resource type
 */
function terrainToResource(terrain: TerrainType): ResourceType {
  const mapping: Record<TerrainType, ResourceType> = {
    forest: 'wood',
    hills: 'brick', 
    pasture: 'sheep',
    fields: 'wheat',
    mountains: 'ore',
    desert: 'wood', // fallback
    sea: 'wood' // fallback
  }
  return mapping[terrain]
} 

// Convenience functions for existing API compatibility

/**
 * ALGORITHM 1: Number weight only
 */
export function scoreVerticesNumberOnly(gameState: GameState, playerId: PlayerId): VertexScore[] {
  return scoreVertices(gameState, playerId, [
    NumberWeightEvaluator(100)
  ])
}

/**
 * ALGORITHM 2: Number weight + scarcity
 */
export function scoreVerticesWithScarcity(
  gameState: GameState,
  playerId: PlayerId,
  numberWeightPercent: number = 80,
  scarcityWeightPercent: number = 20
): VertexScore[] {
  return scoreVertices(gameState, playerId, [
    NumberWeightEvaluator(numberWeightPercent),
    ScarcityEvaluator(scarcityWeightPercent)
  ])
}

/**
 * ALGORITHM 3: Number weight + diversity
 */
export function scoreVerticesWithDiversity(
  gameState: GameState,
  playerId: PlayerId,
  currentResources: ResourceType[],
  numberWeightPercent: number = 70,
  diversityWeightPercent: number = 30
): VertexScore[] {
  return scoreVertices(gameState, playerId, [
    NumberWeightEvaluator(numberWeightPercent),
    DiversityEvaluator(diversityWeightPercent, currentResources)
  ])
}

/**
 * ALGORITHM 4: Number weight + scarcity + diversity + ports
 */
export function scoreVerticesWithAll(
  gameState: GameState,
  playerId: PlayerId,
  currentResources: ResourceType[],
  playerProduction: PlayerResourceProduction,
  numberWeightPercent: number = 50,
  scarcityWeightPercent: number = 20,
  diversityWeightPercent: number = 20,
  portWeightPercent: number = 10
): VertexScore[] {
  return scoreVertices(gameState, playerId, [
    NumberWeightEvaluator(numberWeightPercent),
    ScarcityEvaluator(scarcityWeightPercent),
    DiversityEvaluator(diversityWeightPercent, currentResources),
    PortEvaluator(portWeightPercent, playerProduction)
  ])
}

// ============= Helper Functions ============= 