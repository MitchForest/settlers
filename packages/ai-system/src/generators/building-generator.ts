import { 
  GameState, 
  GameAction, 
  PlayerId,
  getPossibleSettlementPositions,
  getPossibleRoadPositions,
  getEdgeVertices,
  canPlaceSettlement,
  hasResources,
  BUILDING_COSTS
} from '@settlers/game-engine'
import { BaseActionGenerator } from '../types/ai-interfaces'

export class BuildingActionGenerator extends BaseActionGenerator {
  generate(state: GameState, playerId: PlayerId): GameAction[] {
    const actions: GameAction[] = []
    const player = state.players.get(playerId)
    if (!player) return []
    
    // AGGRESSIVE BUILDING - Always build when possible
    
    // Cities (highest priority - immediate VP + double production)
    if (hasResources(player.resources, BUILDING_COSTS.city)) {
      const citySpots = this.getCityBuildingSpots(state, playerId)
      for (const spot of citySpots) {
        actions.push({
          type: 'build' as const,
          playerId,
          data: { buildingType: 'city', position: spot }
        })
      }
    }
    
    // Settlements (VP expansion)
    if (hasResources(player.resources, BUILDING_COSTS.settlement) && player.buildings.settlements > 0) {
      const settlementSpots = this.getSettlementSpots(state, playerId)
      for (const spot of settlementSpots.slice(0, 5)) { // Consider more spots
        actions.push({
          type: 'build' as const,
          playerId,
          data: { buildingType: 'settlement', position: spot }
        })
      }
    }
    
    // Roads (strategic expansion)
    if (hasResources(player.resources, BUILDING_COSTS.road) && player.buildings.roads > 0) {
      const strategicRoads = this.getStrategicRoads(state, playerId)
      for (const road of strategicRoads.slice(0, 3)) { // Consider more roads
        actions.push({
          type: 'build' as const,
          playerId,
          data: { buildingType: 'road', position: road }
        })
      }
    }
    
    return actions
  }

  private getCityBuildingSpots(state: GameState, playerId: PlayerId): string[] {
    // SENIOR ARCHITECT FIX: Ensure we're using current state and add validation logging
    const citySpots: string[] = []
    
    // Scanning for city upgrade opportunities
    
    for (const [vertexId, vertex] of state.board.vertices) {
      if (vertex.building?.owner === playerId) {
        if (vertex.building.type === 'settlement') {
          citySpots.push(vertexId)
        }
      }
    }
    
    // Found city upgrade opportunities
    return citySpots
  }

  private getSettlementSpots(state: GameState, playerId: PlayerId): string[] {
    return getPossibleSettlementPositions(state, playerId)
  }

  private getStrategicRoads(state: GameState, playerId: PlayerId): string[] {
    const strategicRoads: string[] = []
    const possibleRoads = getPossibleRoadPositions(state, playerId)
    
    for (const roadId of possibleRoads) {
      if (this.roadEnablesNewSettlement(state, roadId, playerId)) {
        strategicRoads.push(roadId)
      }
    }
    
    // If no strategic roads, return some roads anyway (expansion)
    if (strategicRoads.length === 0) {
      return possibleRoads.slice(0, 2)
    }
    
    return strategicRoads
  }

  private roadEnablesNewSettlement(state: GameState, edgeId: string, playerId: PlayerId): boolean {
    const connectedVertices = getEdgeVertices(state.board, edgeId)
    
    for (const vertexId of connectedVertices) {
      const vertex = state.board.vertices.get(vertexId)
      if (vertex && !vertex.building) {
        if (canPlaceSettlement(state, playerId, vertexId).isValid) {
          return true
        }
      }
    }
    
    return false
  }
} 