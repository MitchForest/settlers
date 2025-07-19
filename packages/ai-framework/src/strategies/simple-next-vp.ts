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
    
    console.log(`🤔 SimpleNextVP deciding for ${playerId} with resources:`, player.resources)
    
    // 1. Can I build a settlement? (1 VP)
    if (this.canAfford(player.resources, 'settlement')) {
      const spots = getPossibleSettlementPositions(gameState, playerId)
      if (spots.length > 0) {
        console.log(`🏠 Building settlement at ${spots[0]}`)
        return { 
          type: 'build', 
          playerId, 
          data: { buildingType: 'settlement', vertexId: spots[0] }
        }
      }
    }
    
    // 2. Can I upgrade to city? (1 VP + production boost)
    if (this.canAfford(player.resources, 'city')) {
      const settlements = this.getPlayerSettlements(gameState, playerId)
      if (settlements.length > 0) {
        console.log(`🏛️ Upgrading settlement to city at ${settlements[0]}`)
        return { 
          type: 'build', 
          playerId, 
          data: { buildingType: 'city', vertexId: settlements[0] }
        }
      }
    }
    
    // 3. Try 4:1 trade if close to affording settlement
    const tradeAction = this.tryBasicTrade(gameState, playerId)
    if (tradeAction) {
      console.log(`💱 Making 4:1 trade`)
      return tradeAction
    }
    
    // 4. Can I build strategic road toward settlement?
    if (this.canAfford(player.resources, 'road')) {
      const strategicRoad = this.selectStrategicRoad(gameState, playerId)
      if (strategicRoad) {
        console.log(`🛣️ Building strategic road: ${strategicRoad}`)
        return { 
          type: 'build', 
          playerId, 
          data: { buildingType: 'road', edgeId: strategicRoad }
        }
      }
    }
    
    // 5. Buy dev card (maybe VP card)
    if (this.canAfford(player.resources, 'devCard')) {
      console.log(`🃏 Buying development card`)
      return { type: 'buyCard', playerId, data: {} }
    }
    
    // 6. End turn
    console.log(`😴 Nothing to do, ending turn`)
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
   * Select strategic road that gets us closer to good settlement spots
   */
  private selectStrategicRoad(gameState: GameState, playerId: PlayerId): string | null {
    const possibleRoads = getPossibleRoadPositions(gameState, playerId)
    if (possibleRoads.length === 0) return null
    
    // For now, just take first available (can be improved with pathfinding later)
    // TODO: Score roads by distance to good settlement vertices
    return possibleRoads[0]
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