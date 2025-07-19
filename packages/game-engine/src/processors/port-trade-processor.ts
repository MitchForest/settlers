import { GameState, GameAction, GameEvent, PlayerId, ResourceCards, ResourceType } from '../types'
import { hasResources, subtractResources, addResources, getAvailablePortTrades, isValidPortTrade } from '../core/calculations'
import { 
  BaseActionProcessor, 
  ProcessResult, 
  ValidationResult, 
  ValidationError,
  StateManager,
  EventFactory,
  PostProcessorChain
} from './index'

interface PortTradeAction extends GameAction {
  type: 'portTrade'
  data: {
    offering: Partial<ResourceCards>
    requesting: Partial<ResourceCards>
    portType?: string // 'generic' for 3:1, or specific resource for 2:1
  }
}

export class PortTradeProcessor extends BaseActionProcessor<PortTradeAction> {
  readonly actionType = 'portTrade' as const
  
  constructor(
    stateManager: StateManager,
    eventFactory: EventFactory,
    postProcessor: PostProcessorChain
  ) {
    super(stateManager, eventFactory, postProcessor)
  }

  canProcess(action: GameAction): action is PortTradeAction {
    return action.type === 'portTrade'
  }
  
  validate(state: GameState, action: PortTradeAction): ValidationResult {
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

    // Validate only one resource type is being offered
    const offeringTypes = Object.entries(offering).filter(([_, amount]) => amount > 0)
    if (offeringTypes.length !== 1) {
      errors.push({
        field: 'offering',
        message: 'Can only offer one type of resource in port trade',
        code: 'MULTIPLE_RESOURCE_TYPES'
      })
    }

    // Validate only one resource type is being requested
    const requestingTypes = Object.entries(requesting).filter(([_, amount]) => amount > 0)
    if (requestingTypes.length !== 1) {
      errors.push({
        field: 'requesting',
        message: 'Can only request one type of resource in port trade',
        code: 'MULTIPLE_RESOURCE_TYPES'
      })
    }

    // Validate that exactly 1 resource is being requested
    const totalRequesting = Object.values(requesting).reduce((sum, val) => sum + val, 0)
    if (totalRequesting !== 1) {
      errors.push({
        field: 'requesting',
        message: 'Port trades must request exactly 1 resource',
        code: 'INVALID_REQUEST_AMOUNT'
      })
    }

    // Get available port trades for this player
    const availablePortTrades = getAvailablePortTrades(state, action.playerId)
    
    // Determine the trade ratio based on portType or player's available ports
    const portType = action.data.portType || 'generic'
    const totalOffering = Object.values(offering).reduce((sum, val) => sum + val, 0)
    
    // Validate trade ratio and port access
    let expectedRatio = 4 // Default bank ratio
    let hasPortAccess = false
    
    if (portType === 'generic') {
      // 3:1 generic port
      expectedRatio = 3
      hasPortAccess = availablePortTrades.some(trade => trade.ratio === 3)
    } else {
      // 2:1 specific resource port
      expectedRatio = 2
      hasPortAccess = availablePortTrades.some(trade => 
        trade.ratio === 2 && trade.portType === portType
      )
    }
    
    if (!hasPortAccess) {
      errors.push({
        field: 'portType',
        message: `Player does not have access to ${portType} port`,
        code: 'NO_PORT_ACCESS'
      })
    }
    
    if (totalOffering !== expectedRatio) {
      errors.push({
        field: 'tradeRatio',
        message: `Port trade must offer ${expectedRatio} resources for this port type`,
        code: 'INVALID_TRADE_RATIO'
      })
    }

    // Additional validation using the calculation utility
    if (!isValidPortTrade(offering, requesting, expectedRatio, portType)) {
      errors.push({
        field: 'trade',
        message: 'Invalid port trade combination',
        code: 'INVALID_PORT_TRADE'
      })
    }

    return { isValid: errors.length === 0, errors }
  }

  executeCore(state: GameState, action: PortTradeAction): ProcessResult {
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
    
    // Create events
    const events: GameEvent[] = [
      this.createEvent('PORT_TRADE', action.playerId, {
        offering: action.data.offering,
        requesting: action.data.requesting,
        portType: action.data.portType
      })
    ]
    
    return {
      success: true,
      newState,
      events,
      message: `Player ${action.playerId} traded with port`
    }
  }
} 