import { GameState, GameAction, PlayerId } from '../types'
import { BaseActionProcessor, ValidationResult, ProcessResult } from './index'
import { rollDice, getTotalResourceCount } from '../core/calculations'
import { GAME_RULES } from '../constants'

interface RollAction extends GameAction {
  type: 'roll'
}

export class RollDiceProcessor extends BaseActionProcessor<RollAction> {
  readonly actionType = 'roll' as const

  canProcess(action: GameAction): action is RollAction {
    return action.type === 'roll'
  }

  validate(state: GameState, action: RollAction): ValidationResult {
    const errors = [
      ...this.validatePlayerTurn(state, action.playerId),
      ...this.validateGamePhase(state, ['roll'])
    ]

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  executeCore(state: GameState, action: RollAction): ProcessResult {
    const dice = rollDice()
    const events = []
    let newState = { ...state }

    // Create dice rolled event
    events.push(this.createEvent('diceRolled', action.playerId, { dice }))

    // Update state with dice
    newState.dice = dice

    if (dice.sum === 7) {
      // Handle robber - check who needs to discard
      const playersToDiscard: PlayerId[] = []
      
      state.players.forEach((player, playerId) => {
        const total = getTotalResourceCount(player.resources)
        if (total > GAME_RULES.handLimitBeforeDiscard) {
          playersToDiscard.push(playerId)
        }
      })

      if (playersToDiscard.length > 0) {
        newState.phase = 'discard'
        events.push(this.createEvent('discardPhaseStarted', undefined, { 
          playersToDiscard 
        }))
      } else {
        newState.phase = 'moveRobber'
        events.push(this.createEvent('robberMoveRequired', action.playerId))
      }
    } else {
      // Distribute resources
      const distribution = this.calculateResourceDistribution(state, dice.sum)
      newState = this.distributeResources(newState, distribution)
      
      if (distribution.size > 0) {
        events.push(this.createEvent('resourcesDistributed', undefined, { 
          dice: dice.sum, 
          distribution: Object.fromEntries(distribution) 
        }))
      }

      // Move to actions phase
      newState.phase = 'actions'
    }

    return {
      success: true,
      newState,
      events,
      message: `Rolled ${dice.die1} + ${dice.die2} = ${dice.sum}`
    }
  }

  private calculateResourceDistribution(state: GameState, diceValue: number): Map<PlayerId, any> {
    const distribution = new Map<PlayerId, any>()
    
    // Find all hexes with this number
    for (const [hexId, hex] of state.board.hexes) {
      if (hex.numberToken === diceValue && !hex.hasRobber && hex.terrain !== 'desert') {
        // Find adjacent settlements/cities
        for (const [vertexId, vertex] of state.board.vertices) {
          if (vertex.building) {
            const isAdjacent = vertex.position.hexes.some(hexCoord => 
              hexCoord.q === hex.position.q && 
              hexCoord.r === hex.position.r && 
              hexCoord.s === hex.position.s
            )
            
            if (isAdjacent && hex.terrain) {
              const playerId = vertex.building.owner
              const resourceType = this.getResourceFromTerrain(hex.terrain)
              const amount = vertex.building.type === 'city' ? 2 : 1
              
              if (!distribution.has(playerId)) {
                distribution.set(playerId, {})
              }
              
              const playerResources = distribution.get(playerId)!
              playerResources[resourceType] = (playerResources[resourceType] || 0) + amount
            }
          }
        }
      }
    }
    
    return distribution
  }

  private distributeResources(state: GameState, distribution: Map<PlayerId, any>): GameState {
    const newState = { ...state }
    newState.players = new Map(state.players)
    
    for (const [playerId, resources] of distribution) {
      const player = newState.players.get(playerId)
      if (player) {
        const updatedPlayer = { ...player }
        for (const [resourceType, amount] of Object.entries(resources)) {
          if (typeof amount === 'number') {
            updatedPlayer.resources[resourceType as keyof typeof updatedPlayer.resources] += amount
          }
        }
        newState.players.set(playerId, updatedPlayer)
      }
    }
    
    return newState
  }

  private getResourceFromTerrain(terrain: string): string {
    const terrainToResource: Record<string, string> = {
      'forest': 'wood',
      'hills': 'brick',
      'pasture': 'sheep',
      'fields': 'wheat',
      'mountains': 'ore'
    }
    return terrainToResource[terrain] || 'wood'
  }
} 