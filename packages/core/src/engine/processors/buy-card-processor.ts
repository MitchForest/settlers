import { GameState, GameAction, GameEvent, PlayerId } from '../../types'
import { BUILDING_COSTS } from '../../constants'
import { hasResources, subtractResources } from '../../calculations'
import { 
  BaseActionProcessor, 
  ProcessResult, 
  ValidationResult, 
  ValidationError,
  StateManager,
  EventFactory,
  PostProcessorChain
} from './index'

interface BuyCardAction extends GameAction {
  type: 'buyCard'
  data: { [key: string]: any }
}

export class BuyCardProcessor extends BaseActionProcessor<BuyCardAction> {
  readonly actionType = 'buyCard' as const
  
  constructor() {
    super(
      new StateManager(), 
      new EventFactory(''), // gameId will be set properly in registry
      new PostProcessorChain()
    )
  }

  canProcess(action: GameAction): action is BuyCardAction {
    return action.type === 'buyCard'
  }
  
  validate(state: GameState, action: BuyCardAction): ValidationResult {
    const errors: ValidationError[] = []
    
    // Validate turn and phase
    errors.push(...this.validatePlayerTurn(state, action.playerId))
    errors.push(...this.validateGamePhase(state, ['actions']))
    
    const player = state.players.get(action.playerId)
    if (!player) {
      errors.push({
        field: 'playerId',
        message: 'Player not found',
        code: 'PLAYER_NOT_FOUND'
      })
      return { isValid: false, errors }
    }

    // Check if player has resources for development card
    if (!hasResources(player.resources, BUILDING_COSTS.developmentCard)) {
      errors.push({
        field: 'resources',
        message: 'Insufficient resources to buy development card',
        code: 'INSUFFICIENT_RESOURCES'
      })
    }

    // Check if deck has cards
    if (state.developmentDeck.length === 0) {
      errors.push({
        field: 'developmentDeck',
        message: 'No development cards left in deck',
        code: 'DECK_EMPTY'
      })
    }

    return { isValid: errors.length === 0, errors }
  }

  executeCore(state: GameState, action: BuyCardAction): ProcessResult {
    const events: GameEvent[] = []
    let newState = { ...state }
    const player = newState.players.get(action.playerId)!
    
    // Deduct resources
    const updatedPlayer = { ...player }
    updatedPlayer.resources = subtractResources(player.resources, BUILDING_COSTS.developmentCard)
    
    // Draw card from deck
    const card = newState.developmentDeck.pop()!
    card.purchasedTurn = newState.turn
    
    // Add to player's development cards array
    updatedPlayer.developmentCards = [...updatedPlayer.developmentCards, card]
    
    // Update victory points if it's a VP card
    if (card.type === 'victory') {
      updatedPlayer.score = {
        ...updatedPlayer.score,
        hidden: updatedPlayer.score.hidden + 1,
        total: updatedPlayer.score.public + updatedPlayer.score.hidden + 1
      }
    }
    
    newState.players = new Map(newState.players)
    newState.players.set(action.playerId, updatedPlayer)
    
    // Create events
    events.push(this.createEvent('developmentCardBought', action.playerId, {
      cardType: card.type,
      cardId: card.id,
      remainingCards: newState.developmentDeck.length
    }))
    
    return {
      success: true,
      newState,
      events,
      message: 'Development card purchased'
    }
  }
} 