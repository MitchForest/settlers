import { GameState, GameAction, ResourceCards } from '../types'
import { BaseActionProcessor, ValidationResult, ProcessResult } from './index'
import { subtractResources, getTotalResourceCount } from '../core/calculations'
import { GAME_RULES } from '../constants'

interface DiscardAction extends GameAction {
  type: 'discard'
  data: {
    resources: ResourceCards
  }
}

export class DiscardProcessor extends BaseActionProcessor<DiscardAction> {
  readonly actionType = 'discard' as const

  canProcess(action: GameAction): action is DiscardAction {
    return action.type === 'discard'
  }

  validate(state: GameState, action: DiscardAction): ValidationResult {
    const errors = [
      ...this.validatePlayerTurn(state, action.playerId),
      ...this.validateGamePhase(state, ['discard']),
      ...this.validateDiscardAmount(state, action)
    ]

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  executeCore(state: GameState, action: DiscardAction): ProcessResult {
    const events = []
    const newState = { ...state }

    const player = state.players.get(action.playerId)!
    const updatedPlayer = { ...player }
    
    // Remove discarded resources
    updatedPlayer.resources = subtractResources(player.resources, action.data.resources)
    
    newState.players = new Map(state.players)
    newState.players.set(action.playerId, updatedPlayer)

    events.push(this.createEvent('resourcesDiscarded', action.playerId, { 
      resources: action.data.resources 
    }))

    // Check if all players have completed discarding
    const playersNeedingDiscard = this.getPlayersNeedingDiscard(newState)
    
    if (playersNeedingDiscard.length === 0) {
      // All players done discarding, move to moveRobber phase
      newState.phase = 'moveRobber'
    } else {
      // Still have players that need to discard
      // Move to next player who needs to discard
      const nextPlayer = playersNeedingDiscard.find(pid => pid !== action.playerId)
      if (nextPlayer) {
        newState.currentPlayer = nextPlayer
      }
    }

    return {
      success: true,
      newState,
      events,
      message: 'Resources discarded successfully'
    }
  }

  private validateDiscardAmount(state: GameState, action: DiscardAction): any[] {
    const errors = []
    const player = state.players.get(action.playerId)!
    
    const playerResourceCount = getTotalResourceCount(player.resources)
    const discardResourceCount = getTotalResourceCount(action.data.resources)
    const expectedDiscardCount = Math.floor(playerResourceCount / 2)
    
    if (playerResourceCount > GAME_RULES.handLimitBeforeDiscard) {
      if (discardResourceCount !== expectedDiscardCount) {
        errors.push({
          field: 'resources',
          message: `Must discard exactly ${expectedDiscardCount} resources`,
          code: 'INVALID_DISCARD_COUNT'
        })
      }
    } else {
      // Player doesn't need to discard
      if (discardResourceCount !== 0) {
        errors.push({
          field: 'resources',
          message: 'Player does not need to discard',
          code: 'UNNECESSARY_DISCARD'
        })
      }
    }

    // Check if player has the resources they're trying to discard
    for (const [resourceType, count] of Object.entries(action.data.resources)) {
      const playerCount = player.resources[resourceType as keyof ResourceCards]
      if (count > playerCount) {
        errors.push({
          field: 'resources',
          message: `Insufficient ${resourceType} to discard`,
          code: 'INSUFFICIENT_RESOURCES'
        })
      }
    }
    
    return errors
  }

  private getPlayersNeedingDiscard(state: GameState): string[] {
    const playersNeedingDiscard: string[] = []
    
    for (const [playerId, player] of state.players) {
      const resourceCount = getTotalResourceCount(player.resources)
      if (resourceCount > GAME_RULES.handLimitBeforeDiscard) {
        playersNeedingDiscard.push(playerId)
      }
    }
    
    return playersNeedingDiscard
  }
} 