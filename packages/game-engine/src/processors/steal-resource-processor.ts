import { GameState, GameAction } from '../types'
import { BaseActionProcessor, ValidationResult, ProcessResult } from './index'
import { randomChoice } from '../core/calculations'

interface StealResourceAction extends GameAction {
  type: 'stealResource'
  data: {
    targetPlayerId: string
  }
}

export class StealResourceProcessor extends BaseActionProcessor<StealResourceAction> {
  readonly actionType = 'stealResource' as const

  canProcess(action: GameAction): action is StealResourceAction {
    return action.type === 'stealResource'
  }

  validate(state: GameState, action: StealResourceAction): ValidationResult {
    const errors = [
      ...this.validatePlayerTurn(state, action.playerId),
      ...this.validateGamePhase(state, ['steal'])
    ]

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  executeCore(state: GameState, action: StealResourceAction): ProcessResult {
    const events = []
    const newState = { ...state }

    const targetPlayer = state.players.get(action.data.targetPlayerId)
    const currentPlayer = state.players.get(action.playerId)
    
    if (!targetPlayer || !currentPlayer) {
      return {
        success: false,
        newState: state,
        events: [],
        error: 'Invalid player'
      }
    }

    // Get available resources to steal
    const availableResources: string[] = []
    for (const [resourceType, count] of Object.entries(targetPlayer.resources)) {
      for (let i = 0; i < count; i++) {
        availableResources.push(resourceType)
      }
    }

    if (availableResources.length === 0) {
      // No resources to steal, just move to actions phase
      newState.phase = 'actions'
      return {
        success: true,
        newState,
        events: [],
        message: 'No resources to steal'
      }
    }

    // Randomly select a resource to steal
    const stolenResourceType = randomChoice(availableResources)
    
    // Update player resources
    const updatedTargetPlayer = { ...targetPlayer }
    const updatedCurrentPlayer = { ...currentPlayer }
    
    updatedTargetPlayer.resources = { ...targetPlayer.resources }
    updatedCurrentPlayer.resources = { ...currentPlayer.resources }
    
    // Transfer resource
    const resourceKey = stolenResourceType as keyof typeof updatedTargetPlayer.resources
    updatedTargetPlayer.resources[resourceKey] -= 1
    updatedCurrentPlayer.resources[resourceKey] += 1
    
    newState.players = new Map(state.players)
    newState.players.set(action.data.targetPlayerId, updatedTargetPlayer)
    newState.players.set(action.playerId, updatedCurrentPlayer)

    events.push(this.createEvent('resourceStolen', action.playerId, { 
      targetPlayerId: action.data.targetPlayerId,
      resourceType: stolenResourceType
    }))

    // Move to actions phase
    newState.phase = 'actions'

    return {
      success: true,
      newState,
      events,
      message: `Stole ${stolenResourceType} from ${action.data.targetPlayerId}`
    }
  }
} 