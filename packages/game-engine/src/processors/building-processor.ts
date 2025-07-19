import { GameState, GameAction, ResourceCards } from '../types'
import { BaseActionProcessor, ValidationResult, ProcessResult } from './index'
import { BUILDING_COSTS, VICTORY_POINTS } from '../constants'
import { subtractResources, addResources, hasResources } from '../core/calculations'

interface BuildingAction extends GameAction {
  type: 'placeBuilding'
  data: {
    buildingType: 'settlement' | 'city'
    vertexId: string
  }
}

export class BuildingProcessor extends BaseActionProcessor<BuildingAction> {
  readonly actionType = 'placeBuilding' as const

  canProcess(action: GameAction): action is BuildingAction {
    return action.type === 'placeBuilding'
  }

  validate(state: GameState, action: BuildingAction): ValidationResult {
    const errors = [
      ...this.validatePlayerTurn(state, action.playerId),
      ...this.validateGamePhase(state, ['setup1', 'setup2', 'actions']),
      ...this.validateBuildingPlacement(state, action)
    ]

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  executeCore(state: GameState, action: BuildingAction): ProcessResult {
    const { buildingType, vertexId } = action.data
    const player = state.players.get(action.playerId)!
    const events = []
    
    // Debug logging for building placement
    const vertex = state.board.vertices.get(vertexId)
    if (buildingType === 'city' && vertex?.building) {
      console.log(`🏗️ Upgrading settlement to city at ${vertexId} for player ${action.playerId}`)
      console.log(`  Before: building=${vertex.building.type}, owner=${vertex.building.owner}`)
    } else if (buildingType === 'settlement') {
      console.log(`🏡 Placing new settlement at ${vertexId} for player ${action.playerId}`)
    }
    
    const newState = { ...state }
    const newPlayer = { ...player }
    
    // Deduct resources for building cost (only if not in setup)
    if (state.phase !== 'setup1' && state.phase !== 'setup2') {
      const cost = BUILDING_COSTS[buildingType as keyof typeof BUILDING_COSTS]
      newPlayer.resources = subtractResources(player.resources, cost)
    }
    
    // Update building inventory and score
    const vpBefore = newPlayer.score.total
    if (buildingType === 'settlement') {
      newPlayer.buildings.settlements -= 1
      newPlayer.score = {
        ...newPlayer.score,
        public: newPlayer.score.public + VICTORY_POINTS.settlement
      }
      console.log(`🏆 VP CHANGE: ${action.playerId} ${vpBefore} → ${vpBefore + VICTORY_POINTS.settlement} (+${VICTORY_POINTS.settlement}) - settlement built`)
    } else if (buildingType === 'city') {
      newPlayer.buildings.cities -= 1
      newPlayer.buildings.settlements += 1 // Return settlement to inventory
      // FIXED: Only add net +1 VP for settlement→city upgrade
      // City = 2 VP, Settlement = 1 VP, Net gain = 1 VP
      const vpGain = VICTORY_POINTS.city - VICTORY_POINTS.settlement
      newPlayer.score = {
        ...newPlayer.score,
        public: newPlayer.score.public + vpGain
      }
      console.log(`🏆 VP CHANGE: ${action.playerId} ${vpBefore} → ${vpBefore + vpGain} (+${vpGain}) - settlement upgraded to city`)
      
      // Validate VP change makes sense
      if (vpGain !== 1) {
        console.error(`🚨 VP BUG: Expected +1 VP for city upgrade, got +${vpGain}`)
      }
    }
    
    newPlayer.score.total = newPlayer.score.public + newPlayer.score.hidden
    
    // Place building on board
    const targetVertex = newState.board.vertices.get(vertexId)
    if (targetVertex) {
      targetVertex.building = {
        type: buildingType,
        owner: action.playerId,
        position: targetVertex.position
      }
    }
    
    newState.players.set(action.playerId, newPlayer)
    
    events.push(this.createEvent('buildingPlaced', action.playerId, { 
      buildingType, 
      vertexId 
    }))
    
    // Give initial resources from second settlement during setup2
    if (state.phase === 'setup2' && buildingType === 'settlement') {
      const initialResources = this.calculateInitialResources(newState, action.playerId, vertexId)
      if (Object.values(initialResources).some((count: number) => count > 0)) {
        const currentPlayer = newState.players.get(action.playerId)!
        const updatedPlayer = { ...currentPlayer }
        updatedPlayer.resources = addResources(currentPlayer.resources, initialResources)
        newState.players.set(action.playerId, updatedPlayer)
        
        events.push(this.createEvent('initialResourcesDistributed', action.playerId, { 
          resources: initialResources,
          settlement: vertexId
        }))
      }
    }
    
    return {
      success: true,
      newState,
      events,
      message: `${buildingType} placed successfully`
    }
  }

  private validateBuildingPlacement(state: GameState, action: BuildingAction): any[] {
    const errors = []
    const { buildingType, vertexId } = action.data
    const player = state.players.get(action.playerId)!
    
    // Check if vertex exists and is available
    const vertex = state.board.vertices.get(vertexId)
    if (!vertex) {
      errors.push({
        field: 'vertexId',
        message: 'Invalid vertex position',
        code: 'INVALID_VERTEX'
      })
      return errors
    }
    
    // Check resource requirements (only if not in setup)
    if (state.phase !== 'setup1' && state.phase !== 'setup2') {
      const cost = BUILDING_COSTS[buildingType as keyof typeof BUILDING_COSTS]
      if (!hasResources(player.resources, cost)) {
        errors.push({
          field: 'resources',
          message: `Insufficient resources for ${buildingType}`,
          code: 'INSUFFICIENT_RESOURCES'
        })
      }
    }
    
    // Check building inventory
    if (buildingType === 'settlement' && player.buildings.settlements <= 0) {
      errors.push({
        field: 'buildings',
        message: 'No settlements available',
        code: 'NO_BUILDINGS_AVAILABLE'
      })
    } else if (buildingType === 'city' && player.buildings.cities <= 0) {
      errors.push({
        field: 'buildings',
        message: 'No cities available',
        code: 'NO_BUILDINGS_AVAILABLE'
      })
    }
    
    // SENIOR ARCHITECT FIX: Enhanced city upgrade validation with comprehensive logging
    if (buildingType === 'city') {
      console.log(`🔍 VALIDATION: City upgrade attempt at ${vertexId} by ${action.playerId}`)
      
      if (!vertex.building) {
        console.error(`🚨 VALIDATION FAILED: No building exists at ${vertexId}`)
        errors.push({
          field: 'building',
          message: 'No building exists at this position to upgrade',
          code: 'NO_BUILDING_TO_UPGRADE'
        })
      } else if (vertex.building.type !== 'settlement') {
        console.error(`🚨 VALIDATION FAILED: Attempted to upgrade ${vertex.building.type} to city at ${vertexId}`)
        console.error(`   Building owner: ${vertex.building.owner}`)
        console.error(`   Requesting player: ${action.playerId}`)
        console.error(`   This indicates a critical bug - buildings can only be upgraded once!`)
        errors.push({
          field: 'building',
          message: `Cannot upgrade ${vertex.building.type} to city - only settlements can be upgraded`,
          code: 'INVALID_BUILDING_TYPE'
        })
      } else if (vertex.building.owner !== action.playerId) {
        console.error(`🚨 VALIDATION FAILED: Player ${action.playerId} tried to upgrade building owned by ${vertex.building.owner}`)
        errors.push({
          field: 'building',
          message: 'Can only upgrade your own settlements to cities',
          code: 'NOT_YOUR_BUILDING'
        })
      } else {
        console.log(`✅ VALIDATION PASSED: Valid settlement found at ${vertexId} for city upgrade`)
      }
    } else {
      // Placing new settlement
      if (vertex.building) {
        errors.push({
          field: 'building',
          message: 'Vertex already occupied',
          code: 'VERTEX_OCCUPIED'
        })
      }
    }
    
    return errors
  }

  private calculateInitialResources(state: GameState, playerId: string, vertexId: string): ResourceCards {
    const resources: ResourceCards = { wood: 0, brick: 0, ore: 0, wheat: 0, sheep: 0 }
    
    // Terrain to resource mapping
    const terrainToResource: Record<string, keyof ResourceCards | undefined> = {
      'forest': 'wood',
      'hills': 'brick', 
      'pasture': 'sheep',
      'fields': 'wheat',
      'mountains': 'ore',
      'desert': undefined
    }
    
    const vertex = state.board.vertices.get(vertexId)
    if (!vertex) return resources
    
    // Check each hex adjacent to this settlement
    for (const hexCoord of vertex.position.hexes) {
      const hex = Array.from(state.board.hexes.values())
        .find(h => h.position.q === hexCoord.q && h.position.r === hexCoord.r)
      
      if (hex && hex.terrain && hex.terrain !== 'desert') {
        const resourceType = terrainToResource[hex.terrain]
        if (resourceType) {
          resources[resourceType] += 1
        }
      }
    }
    
    return resources
  }
} 