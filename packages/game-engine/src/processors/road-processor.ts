import { GameState, GameAction } from '../types'
import { BaseActionProcessor, ValidationResult, ProcessResult } from './index'
import { BUILDING_COSTS } from '../constants'
import { subtractResources, hasResources } from '../core/calculations'

interface RoadAction extends GameAction {
  type: 'placeRoad'
  data: {
    edgeId: string
  }
}

export class RoadProcessor extends BaseActionProcessor<RoadAction> {
  readonly actionType = 'placeRoad' as const

  canProcess(action: GameAction): action is RoadAction {
    return action.type === 'placeRoad'
  }

  validate(state: GameState, action: RoadAction): ValidationResult {
    const errors = [
      ...this.validatePlayerTurn(state, action.playerId),
      ...this.validateGamePhase(state, ['setup1', 'setup2', 'actions']),
      ...this.validateRoadPlacement(state, action)
    ]

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  executeCore(state: GameState, action: RoadAction): ProcessResult {
    const { edgeId } = action.data
    const player = state.players.get(action.playerId)!
    const events = []
    
    const newState = { ...state }
    const newPlayer = { ...player }
    
    // Deduct resources for road cost (only if not in setup)
    if (state.phase !== 'setup1' && state.phase !== 'setup2') {
      const cost = BUILDING_COSTS.road
      newPlayer.resources = subtractResources(player.resources, cost)
    }
    
    // Update building inventory
    newPlayer.buildings.roads -= 1
    
    // Place road on board
    const edge = newState.board.edges.get(edgeId)
    if (edge) {
      edge.connection = {
        type: 'road',
        owner: action.playerId,
        position: edge.position
      }
    }
    
    newState.players.set(action.playerId, newPlayer)
    
    events.push(this.createEvent('roadPlaced', action.playerId, { 
      edgeId 
    }))
    
    return {
      success: true,
      newState,
      events,
      message: 'Road placed successfully'
    }
  }

  private validateRoadPlacement(state: GameState, action: RoadAction): any[] {
    const errors = []
    const { edgeId } = action.data
    const player = state.players.get(action.playerId)!
    
    // Check if edge exists and is available
    const edge = state.board.edges.get(edgeId)
    if (!edge) {
      errors.push({
        field: 'edgeId',
        message: 'Invalid edge position',
        code: 'INVALID_EDGE'
      })
      return errors
    }
    
    if (edge.connection) {
      errors.push({
        field: 'edge',
        message: 'Edge already occupied',
        code: 'EDGE_OCCUPIED'
      })
    }
    
    // Check resource requirements (only if not in setup)
    if (state.phase !== 'setup1' && state.phase !== 'setup2') {
      const cost = BUILDING_COSTS.road
      if (!hasResources(player.resources, cost)) {
        errors.push({
          field: 'resources',
          message: 'Insufficient resources for road',
          code: 'INSUFFICIENT_RESOURCES'
        })
      }
    }
    
    // Check building inventory
    if (player.buildings.roads <= 0) {
      errors.push({
        field: 'buildings',
        message: 'No roads available',
        code: 'NO_BUILDINGS_AVAILABLE'
      })
    }
    
    return errors
  }
} 