import { GameState, GameAction } from '../../types'
import { BaseActionProcessor, ValidationResult, ProcessResult } from './index'

interface MoveRobberAction extends GameAction {
  type: 'moveRobber'
  data: {
    hexPosition: { q: number; r: number; s: number }
  }
}

export class MoveRobberProcessor extends BaseActionProcessor<MoveRobberAction> {
  readonly actionType = 'moveRobber' as const

  canProcess(action: GameAction): action is MoveRobberAction {
    return action.type === 'moveRobber'
  }

  validate(state: GameState, action: MoveRobberAction): ValidationResult {
    const errors = [
      ...this.validatePlayerTurn(state, action.playerId),
      ...this.validateGamePhase(state, ['moveRobber'])
    ]

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  executeCore(state: GameState, action: MoveRobberAction): ProcessResult {
    const events = []
    let newState = { ...state }

    // Move robber to new position
    newState.board = { ...state.board }
    newState.board.robberPosition = action.data.hexPosition

    // Update hex robber status
    newState.board.hexes = new Map(state.board.hexes)
    for (const [hexId, hex] of newState.board.hexes) {
      const updatedHex = { ...hex }
      if (hex.position.q === action.data.hexPosition.q && 
          hex.position.r === action.data.hexPosition.r &&
          hex.position.s === action.data.hexPosition.s) {
        updatedHex.hasRobber = true
      } else {
        updatedHex.hasRobber = false
      }
      newState.board.hexes.set(hexId, updatedHex)
    }

    events.push(this.createEvent('robberMoved', action.playerId, { 
      hexPosition: action.data.hexPosition 
    }))

    // Check if there are players adjacent to the robber to steal from
    const adjacentPlayers = this.getPlayersAdjacentToRobber(newState, action.playerId)
    
    if (adjacentPlayers.length > 0) {
      // Move to steal phase
      newState.phase = 'steal'
    } else {
      // No one to steal from, move to actions phase
      newState.phase = 'actions'
    }

    return {
      success: true,
      newState,
      events,
      message: 'Robber moved successfully'
    }
  }

  private getPlayersAdjacentToRobber(state: GameState, currentPlayerId: string): string[] {
    const robberPosition = state.board.robberPosition
    if (!robberPosition) return []
    
    const adjacentPlayers: string[] = []
    
    for (const [, vertex] of state.board.vertices) {
      if (!vertex.building || vertex.building.owner === currentPlayerId) continue
      
      const isAdjacent = vertex.position.hexes.some(hex => 
        hex.q === robberPosition.q && 
        hex.r === robberPosition.r && 
        hex.s === robberPosition.s
      )
      
      if (isAdjacent && !adjacentPlayers.includes(vertex.building.owner)) {
        // Check if player has resources to steal
        const player = state.players.get(vertex.building.owner)
        if (player) {
          const resourceCount = Object.values(player.resources).reduce((sum, count) => sum + count, 0)
          if (resourceCount > 0) {
            adjacentPlayers.push(vertex.building.owner)
          }
        }
      }
    }
    
    return adjacentPlayers
  }
} 