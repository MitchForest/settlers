import { GameState, PlayerId, ResourceType } from '@settlers/game-engine'
import { PIP_VALUES, terrainToResource } from './index'

export interface ProductionSummary {
  wood: number
  brick: number
  sheep: number
  wheat: number
  ore: number
  total: number
}

export interface SettlementProduction {
  vertexId: string
  buildingType: 'settlement' | 'city'
  resources: Array<{
    type: ResourceType
    pips: number
    numberToken: number
  }>
  totalPips: number
  upgradeValue: number // Additional pips if upgraded to city
}

export interface UpgradeRecommendation {
  vertexId: string
  currentProduction: number
  upgradeGain: number
  priority: number
  reasoning: string
}

/**
 * Get current resource production for a player
 */
export function getPlayerProduction(gameState: GameState, playerId: PlayerId): ProductionSummary {
  const production: ProductionSummary = {
    wood: 0,
    brick: 0,
    sheep: 0,
    wheat: 0,
    ore: 0,
    total: 0
  }

  for (const [vertexId, vertex] of gameState.board.vertices) {
    if (vertex.building?.owner === playerId) {
      const settlementProduction = calculateSettlementProduction(gameState, vertexId)
      const multiplier = vertex.building.type === 'city' ? 2 : 1

      for (const resource of settlementProduction.resources) {
        production[resource.type] += resource.pips * multiplier
        production.total += resource.pips * multiplier
      }
    }
  }

  return production
}

/**
 * Predict resource income over specified turns
 */
export function predictResourceIncome(
  production: ProductionSummary,
  turns: number = 10
): ProductionSummary {
  // Simplified prediction - assumes average dice rolls
  // In reality, we'd factor in robber, ports, trades, etc.
  const avgRollsPerTurn = 1 // Simplification: 1 resource roll per turn on average
  
  return {
    wood: production.wood * turns * avgRollsPerTurn,
    brick: production.brick * turns * avgRollsPerTurn,
    sheep: production.sheep * turns * avgRollsPerTurn,
    wheat: production.wheat * turns * avgRollsPerTurn,
    ore: production.ore * turns * avgRollsPerTurn,
    total: production.total * turns * avgRollsPerTurn
  }
}

/**
 * Identify settlements with highest production potential
 */
export function identifyHighProducers(gameState: GameState, playerId: PlayerId): SettlementProduction[] {
  const settlements: SettlementProduction[] = []

  for (const [vertexId, vertex] of gameState.board.vertices) {
    if (vertex.building?.owner === playerId) {
      const production = calculateSettlementProduction(gameState, vertexId)
      settlements.push(production)
    }
  }

  return settlements.sort((a, b) => b.totalPips - a.totalPips)
}

/**
 * Suggest which settlements to upgrade to cities first
 */
export function suggestCityUpgrades(gameState: GameState, playerId: PlayerId): UpgradeRecommendation[] {
  const settlements = identifyHighProducers(gameState, playerId)
  const recommendations: UpgradeRecommendation[] = []

  for (const settlement of settlements) {
    // Only recommend upgrades for settlements (not already cities)
    if (settlement.buildingType === 'settlement') {
      const upgradeGain = settlement.upgradeValue
      let priority = upgradeGain * 10 // Base priority from production gain
      let reasoning = `Gains ${upgradeGain} additional pips per turn`

      // Bonus priority for high-value resources
      const hasHighValueResources = settlement.resources.some(r => 
        (r.type === 'wheat' || r.type === 'ore') && r.pips >= 4
      )
      if (hasHighValueResources) {
        priority += 20
        reasoning += '. Has high-value wheat/ore production'
      }

      // Bonus for settlements with many high-pip resources
      if (settlement.totalPips >= 12) {
        priority += 15
        reasoning += '. Excellent overall production'
      }

      recommendations.push({
        vertexId: settlement.vertexId,
        currentProduction: settlement.totalPips,
        upgradeGain,
        priority,
        reasoning
      })
    }
  }

  return recommendations.sort((a, b) => b.priority - a.priority)
}

/**
 * Calculate resource surplus after basic needs
 */
export function calculateResourceSurplus(
  production: ProductionSummary,
  turns: number = 5
): ProductionSummary {
  const income = predictResourceIncome(production, turns)
  
  // Estimate basic needs (roads, settlements, maintenance)
  const basicNeeds = {
    wood: 3,  // 1-2 roads per 5 turns
    brick: 3, // 1-2 roads per 5 turns  
    sheep: 2, // 1 settlement per 5 turns
    wheat: 2, // 1 settlement per 5 turns
    ore: 1,   // Minimal ore needs for basic expansion
    total: 0
  }
  basicNeeds.total = basicNeeds.wood + basicNeeds.brick + basicNeeds.sheep + basicNeeds.wheat + basicNeeds.ore

  return {
    wood: Math.max(0, income.wood - basicNeeds.wood),
    brick: Math.max(0, income.brick - basicNeeds.brick),
    sheep: Math.max(0, income.sheep - basicNeeds.sheep),
    wheat: Math.max(0, income.wheat - basicNeeds.wheat),
    ore: Math.max(0, income.ore - basicNeeds.ore),
    total: Math.max(0, income.total - basicNeeds.total)
  }
}

/**
 * Check if player has strong production of specific resources for city upgrades
 */
export function hasStrongProduction(
  production: ProductionSummary,
  resources: ResourceType[],
  threshold: number = 6
): boolean {
  return resources.every(resource => production[resource] >= threshold)
}

/**
 * Calculate production for a specific settlement
 */
function calculateSettlementProduction(gameState: GameState, vertexId: string): SettlementProduction {
  const vertex = gameState.board.vertices.get(vertexId)
  if (!vertex || !vertex.building) {
    return {
      vertexId,
      buildingType: 'settlement',
      resources: [],
      totalPips: 0,
      upgradeValue: 0
    }
  }

  const resources: Array<{ type: ResourceType, pips: number, numberToken: number }> = []
  let totalPips = 0

  for (const hexCoord of vertex.position.hexes) {
    const hex = Array.from(gameState.board.hexes.values()).find(
      h => h.position.q === hexCoord.q && h.position.r === hexCoord.r
    )

    if (hex && hex.numberToken && hex.terrain && hex.terrain !== 'desert' && hex.terrain !== 'sea') {
      const resourceType = terrainToResource(hex.terrain)
      const pips = PIP_VALUES[hex.numberToken as keyof typeof PIP_VALUES] || 0
      
      resources.push({
        type: resourceType,
        pips,
        numberToken: hex.numberToken
      })
      
      totalPips += pips
    }
  }

  // Calculate upgrade value (additional pips if upgraded to city)
  const currentMultiplier = vertex.building.type === 'city' ? 2 : 1
  const upgradeValue = vertex.building.type === 'settlement' ? totalPips : 0

  return {
    vertexId,
    buildingType: vertex.building.type as 'settlement' | 'city',
    resources,
    totalPips: totalPips * currentMultiplier,
    upgradeValue
  }
} 