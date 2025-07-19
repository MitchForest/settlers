import { 
  GameState, 
  GameAction, 
  PlayerId, 
  ResourceCards,
  getPossibleSettlementPositions,
  getPossibleRoadPositions
} from '@settlers/game-engine'

const BUILDING_COSTS = {
  settlement: { wood: 1, brick: 1, sheep: 1, wheat: 1, ore: 0 },
  city: { wood: 0, brick: 0, sheep: 0, wheat: 2, ore: 3 },
  road: { wood: 1, brick: 1, sheep: 0, wheat: 0, ore: 0 },
  devCard: { wood: 0, brick: 0, sheep: 1, wheat: 1, ore: 1 }
}

/**
 * Simple "Next 1-2 VP" strategy for baseline testing
 * Focuses on building toward next victory points with basic strategy
 */
export class SimpleNextVPStrategy {
  selectBestAction(gameState: GameState, playerId: PlayerId): GameAction | null {
    const player = gameState.players.get(playerId)!
    
    console.log(`🤔 SimpleNextVP deciding for ${playerId}`)
    
    // 1. Can I upgrade to city? (1 VP + production boost) - Always prioritize if possible
    if (this.canAfford(player.resources, 'city')) {
      const settlements = this.getPlayerSettlements(gameState, playerId)
      if (settlements.length > 0) {
        console.log(`🏛️ Upgrading settlement to city at ${settlements[0]}`)
        return { 
          type: 'build', 
          playerId, 
          data: { buildingType: 'city', position: settlements[0] }
        }
      }
    }
    
    // 2. Strategic settlement planning
    const settlementPlan = this.planNextSettlement(gameState, playerId)
    
    if (settlementPlan.canBuildNow) {
      console.log(`🏠 Building settlement at ${settlementPlan.targetVertex}`)
      return { 
        type: 'build', 
        playerId, 
                  data: { buildingType: 'settlement', position: settlementPlan.targetVertex }
      }
    } else if (settlementPlan.needsRoadFirst && this.canAfford(player.resources, 'road')) {
      console.log(`🛣️ Building road toward future settlement: ${settlementPlan.nextRoadNeeded}`)
      return { 
        type: 'build', 
        playerId, 
                  data: { buildingType: 'road', position: settlementPlan.nextRoadNeeded }
      }
    } else if (settlementPlan.canTradeForSettlement) {
      const tradeAction = this.tryBasicTrade(gameState, playerId)
      if (tradeAction) {
        console.log(`💱 Trading to afford settlement`)
        return tradeAction
      }
    }
    
    // 3. Buy dev card (maybe VP card)
    if (this.canAfford(player.resources, 'devCard')) {
      console.log(`🃏 Buying development card`)
      return { type: 'buyCard', playerId, data: {} }
    }
    
    // 4. End turn and save resources
    console.log(`😴 Saving resources for settlement`)
    return { type: 'endTurn', playerId, data: {} }
  }

  /**
   * Check if player can afford a building type
   */
  private canAfford(resources: ResourceCards, buildingType: keyof typeof BUILDING_COSTS): boolean {
    const cost = BUILDING_COSTS[buildingType]
    if (!cost) return false
    
    return Object.entries(cost).every(([resource, needed]) => 
      resources[resource as keyof ResourceCards] >= (needed as number)
    )
  }

  /**
   * Try basic 4:1 trade if close to affording settlement
   */
  private tryBasicTrade(gameState: GameState, playerId: PlayerId): GameAction | null {
    const player = gameState.players.get(playerId)!
    
    // Check if we're 1 resource away from settlement (most valuable building)
    const settlementShortfall = this.calculateShortfall(player.resources, BUILDING_COSTS.settlement)
    const totalShortfall = Object.values(settlementShortfall).reduce((sum, n) => sum + n, 0)
    
    if (totalShortfall === 1) {
      const neededResource = Object.entries(settlementShortfall).find(([_, amount]) => amount > 0)?.[0]
      const excessResource = this.findResourceWithAmount(player.resources, 4)
      
      if (neededResource && excessResource && excessResource !== neededResource) {
        console.log(`💡 1 short of settlement: need ${neededResource}, have 4+ ${excessResource}`)
        return {
          type: 'bankTrade',
          playerId,
          data: {
            offering: { [excessResource]: 4 },
            requesting: { [neededResource]: 1 }
          }
        }
      }
    }
    
    return null
  }

  /**
   * Plan the next settlement: check if we can build now, need roads first, or should trade
   */
  private planNextSettlement(gameState: GameState, playerId: PlayerId): {
    canBuildNow: boolean
    needsRoadFirst: boolean
    canTradeForSettlement: boolean
    targetVertex?: string
    nextRoadNeeded?: string
  } {
    const player = gameState.players.get(playerId)!
    
    // Check if we can afford settlement right now
    const canAffordSettlement = this.canAfford(player.resources, 'settlement')
    const availableSpots = getPossibleSettlementPositions(gameState, playerId)
    
    if (canAffordSettlement && availableSpots.length > 0) {
      return {
        canBuildNow: true,
        needsRoadFirst: false,
        canTradeForSettlement: false,
        targetVertex: availableSpots[0]
      }
    }
    
    // Check if we can trade for settlement (1 resource short)
    const settlementShortfall = this.calculateShortfall(player.resources, BUILDING_COSTS.settlement)
    const totalShortfall = Object.values(settlementShortfall).reduce((sum, n) => sum + n, 0)
    const hasExcessFor4to1 = this.findResourceWithAmount(player.resources, 4) !== null
    
    if (totalShortfall === 1 && hasExcessFor4to1 && availableSpots.length > 0) {
      return {
        canBuildNow: false,
        needsRoadFirst: false,
        canTradeForSettlement: true,
        targetVertex: availableSpots[0]
      }
    }
    
    // Need to build roads first to reach settlement spots
    if (availableSpots.length === 0) {
      const possibleRoads = getPossibleRoadPositions(gameState, playerId)
      if (possibleRoads.length > 0) {
        return {
          canBuildNow: false,
          needsRoadFirst: true,
          canTradeForSettlement: false,
          nextRoadNeeded: possibleRoads[0] // TODO: Pick road toward best future settlement spot
        }
      }
    }
    
    // Can't do anything useful right now
    return {
      canBuildNow: false,
      needsRoadFirst: false,
      canTradeForSettlement: false
    }
  }

  /**
   * Get all settlement vertices owned by player
   */
  private getPlayerSettlements(gameState: GameState, playerId: PlayerId): string[] {
    const settlements: string[] = []
    
    for (const [vertexId, vertex] of gameState.board.vertices) {
      if (vertex.building?.owner === playerId && vertex.building.type === 'settlement') {
        settlements.push(vertexId)
      }
    }
    
    return settlements
  }

  /**
   * Calculate resource shortfall for a given cost
   */
  private calculateShortfall(resources: ResourceCards, cost: ResourceCards): ResourceCards {
    const shortfall: ResourceCards = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 }
    
    for (const [resource, needed] of Object.entries(cost)) {
      const available = resources[resource as keyof ResourceCards] || 0
      const requiredAmount = needed as number
      if (available < requiredAmount) {
        shortfall[resource as keyof ResourceCards] = requiredAmount - available
      }
    }
    
    return shortfall
  }

  /**
   * Find resource type with at least the specified amount
   */
  private findResourceWithAmount(resources: ResourceCards, minAmount: number): keyof ResourceCards | null {
    for (const [resource, amount] of Object.entries(resources)) {
      if (amount >= minAmount) {
        return resource as keyof ResourceCards
      }
    }
    return null
  }
} 