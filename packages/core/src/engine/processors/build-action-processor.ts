import { GameState, GameAction } from '../../types'
import { BaseActionProcessor, ValidationResult, ProcessResult } from './index'
import { BuildingProcessor } from './building-processor'
import { RoadProcessor } from './road-processor'

interface BuildAction extends GameAction {
  type: 'build'
  data: {
    buildingType: 'settlement' | 'city' | 'road'
    position?: string
  }
}

interface BuildingAction extends GameAction {
  type: 'placeBuilding'
  data: {
    buildingType: 'settlement' | 'city'
    vertexId: string
  }
}

interface RoadAction extends GameAction {
  type: 'placeRoad'
  data: {
    edgeId: string
  }
}

export class BuildActionProcessor extends BaseActionProcessor<BuildAction> {
  readonly actionType = 'build' as const

  canProcess(action: GameAction): action is BuildAction {
    return action.type === 'build'
  }

  validate(state: GameState, action: BuildAction): ValidationResult {
    const errors = [
      ...this.validatePlayerTurn(state, action.playerId),
      ...this.validateGamePhase(state, ['actions'])
    ]

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  executeCore(state: GameState, action: BuildAction): ProcessResult {
    const { buildingType, position } = action.data
    
    // If no position specified, this is entering "placement mode"
    if (!position) {
      // The UI will handle the placement interaction
      return {
        success: true,
        newState: state,
        events: [this.createEvent('placementModeStarted', action.playerId, { buildingType })],
        message: `Select where to place your ${buildingType}`
      }
    }
    
    // Route to specific building placement handlers with position
    if (buildingType === 'settlement' || buildingType === 'city') {
      // Forward to building processor
      const buildingProcessor = new BuildingProcessor(this.stateManager, this.eventFactory, this.postProcessor)
      const buildingAction: BuildingAction = {
        type: 'placeBuilding' as const,
        playerId: action.playerId,
        data: { buildingType, vertexId: position }
      }
      
      return buildingProcessor.execute(state, buildingAction)
    } else if (buildingType === 'road') {
      // Forward to road processor
      const roadProcessor = new RoadProcessor(this.stateManager, this.eventFactory, this.postProcessor)
      const roadAction: RoadAction = {
        type: 'placeRoad' as const,
        playerId: action.playerId,
        data: { edgeId: position }
      }
      
      return roadProcessor.execute(state, roadAction)
    }
    
    return {
      success: false,
      newState: state,
      events: [],
      error: 'Invalid building type'
    }
  }
} 