import { GameState, GameAction, PlayerId } from '../types'
import { BaseActionProcessor, ValidationResult, ProcessResult } from './index'

interface EndTurnAction extends GameAction {
  type: 'endTurn'
}

export class EndTurnProcessor extends BaseActionProcessor<EndTurnAction> {
  readonly actionType = 'endTurn' as const

  canProcess(action: GameAction): action is EndTurnAction {
    return action.type === 'endTurn'
  }

  validate(state: GameState, action: EndTurnAction): ValidationResult {
    const errors = [
      ...this.validatePlayerTurn(state, action.playerId),
      ...this.validateGamePhase(state, ['actions', 'setup1', 'setup2'])
    ]

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  executeCore(state: GameState, action: EndTurnAction): ProcessResult {
    const events = []
    let newState = { ...state }

    // Increment turn counter
    newState.turn += 1

    // Handle phase transitions
    if (state.phase === 'setup1' || state.phase === 'setup2') {
      newState = this.progressSetupPhase(newState)
    } else {
      // Regular game turn transition
      newState = this.advanceToNextPlayer(newState)
      newState.phase = 'roll'
    }

    events.push(this.createEvent('turnEnded', action.playerId))
    events.push(this.createEvent('turnStarted', newState.currentPlayer))

    return {
      success: true,
      newState,
      events,
      message: 'Turn ended'
    }
  }

  private progressSetupPhase(state: GameState): GameState {
    const playerIds = Array.from(state.players.keys())
    const currentIndex = playerIds.indexOf(state.currentPlayer)
    
    if (state.phase === 'setup1') {
      // First round: go in order
      if (currentIndex < playerIds.length - 1) {
        return {
          ...state,
          currentPlayer: playerIds[currentIndex + 1]
        }
      } else {
        // End of setup1, start setup2 with last player
        return {
          ...state,
          phase: 'setup2'
          // Keep same current player (last player starts setup2)
        }
      }
    } else if (state.phase === 'setup2') {
      // Second round: go in reverse order
      if (currentIndex > 0) {
        return {
          ...state,
          currentPlayer: playerIds[currentIndex - 1]
        }
      } else {
        // End of setup2, start main game
        return {
          ...state,
          phase: 'roll',
          currentPlayer: playerIds[0] // First player starts main game
        }
      }
    }
    
    return state
  }

  private advanceToNextPlayer(state: GameState): GameState {
    const playerIds = Array.from(state.players.keys())
    const currentIndex = playerIds.indexOf(state.currentPlayer)
    const nextIndex = (currentIndex + 1) % playerIds.length
    
    return {
      ...state,
      currentPlayer: playerIds[nextIndex]
    }
  }
} 