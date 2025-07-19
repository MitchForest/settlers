import { Player, ResourceCards, ResourceType, BUILDING_COSTS } from '@settlers/game-engine'

export class ResourceAnalyzer {
  static analyzeResourceNeeds(player: Player): ResourceType[] {
    const needs = new Set<ResourceType>()
    
    // Priority 1: City building (2 VP + double production) - AGGRESSIVE
    if (this.hasSettlementsToUpgrade(player)) {
      if (player.resources.ore < 3) needs.add('ore')
      if (player.resources.wheat < 2) needs.add('wheat')
    }
    
    // Priority 2: Settlement building (1 VP + expansion) - AGGRESSIVE
    if (player.buildings.settlements > 0) {
      if (player.resources.wood < 1) needs.add('wood')
      if (player.resources.brick < 1) needs.add('brick')
      if (player.resources.sheep < 1) needs.add('sheep')
      if (player.resources.wheat < 1) needs.add('wheat')
    }
    
    // Priority 3: Development cards (25% VP chance + knights) - AGGRESSIVE
    if (player.resources.ore < 1) needs.add('ore')
    if (player.resources.wheat < 1) needs.add('wheat')
    if (player.resources.sheep < 1) needs.add('sheep')
    
    return Array.from(needs)
  }

  static getResourcePriority(player: Player): Record<ResourceType, number> {
    const priorities: Record<ResourceType, number> = {
      wood: 0, brick: 0, ore: 0, wheat: 0, sheep: 0
    }
    
    // City building priority (highest VP)
    if (player.buildings.settlements > 0) {
      if (player.resources.ore < 3) priorities.ore = 5
      if (player.resources.wheat < 2) priorities.wheat = 5
    }
    
    // Settlement building priority
    if (player.buildings.settlements > 0) {
      if (player.resources.wood < 1) priorities.wood = 3
      if (player.resources.brick < 1) priorities.brick = 3
      if (player.resources.sheep < 1) priorities.sheep = 3
      if (player.resources.wheat < 1) priorities.wheat = Math.max(priorities.wheat, 3)
    }
    
    // Development card priority
    if (player.resources.ore < 1) priorities.ore = Math.max(priorities.ore, 2)
    if (player.resources.wheat < 1) priorities.wheat = Math.max(priorities.wheat, 2)
    if (player.resources.sheep < 1) priorities.sheep = Math.max(priorities.sheep, 2)
    
    return priorities
  }

  static findTradeableResources(player: Player): Record<string, number> {
    const tradeable: Record<string, number> = {}
    const resourceTypes = ['wood', 'brick', 'ore', 'wheat', 'sheep'] as const
    
    for (const resource of resourceTypes) {
      const amount = player.resources[resource]
      // AGGRESSIVE TRADING: Trade even smaller amounts if we have them
      if (amount >= 4) {
        tradeable[resource] = amount
      }
    }
    
    return tradeable
  }

  static calculateBuildingNeeds(resources: ResourceCards): ResourceCards {
    const needs: ResourceCards = { wood: 0, brick: 0, ore: 0, wheat: 0, sheep: 0 }
    
    // Priority: Settlement
    const settlementCost = BUILDING_COSTS.settlement
    for (const [resource, cost] of Object.entries(settlementCost)) {
      if (typeof cost === 'number') {
        const shortage = Math.max(0, cost - (resources[resource as keyof ResourceCards] || 0))
        needs[resource as keyof ResourceCards] = Math.max(needs[resource as keyof ResourceCards], shortage)
      }
    }
    
    return needs
  }

  static calculateStrategicValue(): ResourceCards {
    return { wood: 3, brick: 3, ore: 4, wheat: 4, sheep: 3 }
  }

  private static hasSettlementsToUpgrade(player: Player): boolean {
    // Check if player has settlements that can be upgraded to cities
    return player.buildings.settlements > 0 // Simplified - would need board analysis for real check
  }
} 