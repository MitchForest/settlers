import { GameState, GameAction, GameEvent, PlayerId, ResourceCards, ResourceType } from '../types'
import { hasResources, subtractResources, addResources } from '../core/calculations'
import { 
  BaseActionProcessor, 
  ProcessResult, 
  ValidationResult, 
  ValidationError,
  StateManager,
  EventFactory,
  PostProcessorChain
} from './index'

interface BankTradeAction extends GameAction {
  type: 'bankTrade'
  data: {
    offering: Partial<ResourceCards>
    requesting: Partial<ResourceCards>
  }
}

export class BankTradeProcessor extends BaseActionProcessor<BankTradeAction> {
  readonly actionType = 'bankTrade' as const
  
  constructor(
    stateManager: StateManager,
    eventFactory: EventFactory,
    postProcessor: PostProcessorChain
  ) {
    super(stateManager, eventFactory, postProcessor)
  }

  canProcess(action: GameAction): action is BankTradeAction {
    return action.type === 'bankTrade'
  }
  
  validate(state: GameState, action: BankTradeAction): ValidationResult {
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

    // Validate trade data
    if (!action.data.offering || !action.data.requesting) {
      errors.push({
        field: 'data',
        message: 'Trade must specify offering and requesting resources',
        code: 'INVALID_TRADE_DATA'
      })
      return { isValid: false, errors }
    }

    // Convert partial resource cards to full resource cards
    const offering: ResourceCards = {
      wood: action.data.offering.wood || 0,
      brick: action.data.offering.brick || 0,
      ore: action.data.offering.ore || 0,
      wheat: action.data.offering.wheat || 0,
      sheep: action.data.offering.sheep || 0
    }

    const requesting: ResourceCards = {
      wood: action.data.requesting.wood || 0,
      brick: action.data.requesting.brick || 0,
      ore: action.data.requesting.ore || 0,
      wheat: action.data.requesting.wheat || 0,
      sheep: action.data.requesting.sheep || 0
    }

    // Validate player has resources to offer
    if (!hasResources(player.resources, offering)) {
      errors.push({
        field: 'offering',
        message: 'Player does not have enough resources to offer',
        code: 'INSUFFICIENT_RESOURCES'
      })
    }

    // Validate bank has resources to give
    if (!hasResources(state.bankResources, requesting)) {
      const requestedType = Object.entries(requesting).find(([_, amount]) => amount > 0)?.[0]
      errors.push({
        field: 'requesting',
        message: `Bank does not have enough ${requestedType} resources for this trade`,
        code: 'BANK_INSUFFICIENT_RESOURCES'
      })
    }

    // Validate trade ratio (4:1 for bank trades)
    const totalOffering = Object.values(offering).reduce((sum, val) => sum + val, 0)
    const totalRequesting = Object.values(requesting).reduce((sum, val) => sum + val, 0)
    
    if (totalOffering !== 4 || totalRequesting !== 1) {
      errors.push({
        field: 'tradeRatio',
        message: 'Bank trades must be 4:1 ratio',
        code: 'INVALID_TRADE_RATIO'
      })
    }

    // Validate only one resource type is being offered
    const offeringTypes = Object.entries(offering).filter(([_, amount]) => amount > 0)
    if (offeringTypes.length !== 1) {
      errors.push({
        field: 'offering',
        message: 'Can only offer one type of resource to bank',
        code: 'MULTIPLE_RESOURCE_TYPES'
      })
    }

    // Validate only one resource type is being requested
    const requestingTypes = Object.entries(requesting).filter(([_, amount]) => amount > 0)
    if (requestingTypes.length !== 1) {
      errors.push({
        field: 'requesting',
        message: 'Can only request one type of resource from bank',
        code: 'MULTIPLE_RESOURCE_TYPES'
      })
    }

    return { isValid: errors.length === 0, errors }
  }

  executeCore(state: GameState, action: BankTradeAction): ProcessResult {
    const newState = this.stateManager.cloneState(state)
    const player = newState.players.get(action.playerId)!
    
    // Convert partial resource cards to full resource cards
    const offering: ResourceCards = {
      wood: action.data.offering.wood || 0,
      brick: action.data.offering.brick || 0,
      ore: action.data.offering.ore || 0,
      wheat: action.data.offering.wheat || 0,
      sheep: action.data.offering.sheep || 0
    }

    const requesting: ResourceCards = {
      wood: action.data.requesting.wood || 0,
      brick: action.data.requesting.brick || 0,
      ore: action.data.requesting.ore || 0,
      wheat: action.data.requesting.wheat || 0,
      sheep: action.data.requesting.sheep || 0
    }

    // Execute the trade
    player.resources = subtractResources(player.resources, offering)
    player.resources = addResources(player.resources, requesting)
    
    // Update bank resources (reverse of player trade)
    newState.bankResources = addResources(newState.bankResources, offering)
    newState.bankResources = subtractResources(newState.bankResources, requesting)
    
    // Create events
    const events: GameEvent[] = [
      this.createEvent('BANK_TRADE', action.playerId, {
        offering: action.data.offering,
        requesting: action.data.requesting
      })
    ]
    
    return {
      success: true,
      newState,
      events,
      message: `Player ${action.playerId} traded with bank`
    }
  }
}