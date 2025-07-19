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

// Trade offer structure stored in game state
interface TradeOffer {
  id: string
  offeringPlayerId: PlayerId
  targetPlayerId?: PlayerId // undefined means offer to all players
  offering: ResourceCards
  requesting: ResourceCards
  createdTurn: number
  expiresAfterTurns: number
}

interface CreateTradeOfferAction extends GameAction {
  type: 'createTradeOffer'
  data: {
    offering: Partial<ResourceCards>
    requesting: Partial<ResourceCards>
    targetPlayerId?: PlayerId // if undefined, offer to all players
    expiresAfterTurns?: number // defaults to 3 turns
  }
}

interface AcceptTradeAction extends GameAction {
  type: 'acceptTrade'
  data: {
    tradeOfferId: string
  }
}

interface RejectTradeAction extends GameAction {
  type: 'rejectTrade'
  data: {
    tradeOfferId: string
  }
}

interface CancelTradeAction extends GameAction {
  type: 'cancelTrade'
  data: {
    tradeOfferId: string
  }
}

// Base class for all player trade processors
abstract class PlayerTradeProcessor<T extends GameAction> extends BaseActionProcessor<T> {
  protected getTradeOffers(state: GameState): TradeOffer[] {
    return (state as any).tradeOffers || []
  }
  
  protected setTradeOffers(state: GameState, offers: TradeOffer[]): void {
    (state as any).tradeOffers = offers
  }
  
  protected findTradeOffer(state: GameState, tradeOfferId: string): TradeOffer | undefined {
    return this.getTradeOffers(state).find(offer => offer.id === tradeOfferId)
  }
  
  protected removeTradeOffer(state: GameState, tradeOfferId: string): void {
    const offers = this.getTradeOffers(state).filter(offer => offer.id !== tradeOfferId)
    this.setTradeOffers(state, offers)
  }
  
  protected isTradeOfferValid(state: GameState, offer: TradeOffer): boolean {
    // Check if offer has expired
    const turnsPassed = state.turn - offer.createdTurn
    return turnsPassed <= offer.expiresAfterTurns
  }
  
  protected cleanupExpiredOffers(state: GameState): void {
    const validOffers = this.getTradeOffers(state).filter(offer => this.isTradeOfferValid(state, offer))
    this.setTradeOffers(state, validOffers)
  }
}

export class CreateTradeOfferProcessor extends PlayerTradeProcessor<CreateTradeOfferAction> {
  readonly actionType = 'createTradeOffer' as const
  
  constructor(
    stateManager: StateManager,
    eventFactory: EventFactory,
    postProcessor: PostProcessorChain
  ) {
    super(stateManager, eventFactory, postProcessor)
  }

  canProcess(action: GameAction): action is CreateTradeOfferAction {
    return action.type === 'createTradeOffer'
  }
  
  validate(state: GameState, action: CreateTradeOfferAction): ValidationResult {
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

    // Validate player has resources to offer
    if (!hasResources(player.resources, offering)) {
      errors.push({
        field: 'offering',
        message: 'Player does not have enough resources to offer',
        code: 'INSUFFICIENT_RESOURCES'
      })
    }

    // Validate that we're offering something and requesting something
    const totalOffering = Object.values(offering).reduce((sum, val) => sum + val, 0)
    const totalRequesting = Object.values(action.data.requesting).reduce((sum, val) => sum + (val || 0), 0)
    
    if (totalOffering === 0) {
      errors.push({
        field: 'offering',
        message: 'Must offer at least one resource',
        code: 'NO_RESOURCES_OFFERED'
      })
    }
    
    if (totalRequesting === 0) {
      errors.push({
        field: 'requesting',
        message: 'Must request at least one resource',
        code: 'NO_RESOURCES_REQUESTED'
      })
    }

    // Validate target player exists (if specified)
    if (action.data.targetPlayerId && !state.players.has(action.data.targetPlayerId)) {
      errors.push({
        field: 'targetPlayerId',
        message: 'Target player not found',
        code: 'TARGET_PLAYER_NOT_FOUND'
      })
    }

    // Check if player already has too many active trade offers (limit to 3)
    const activeOffers = this.getTradeOffers(state).filter(offer => 
      offer.offeringPlayerId === action.playerId && this.isTradeOfferValid(state, offer)
    )
    
    if (activeOffers.length >= 3) {
      errors.push({
        field: 'tradeOffers',
        message: 'Player can only have 3 active trade offers at a time',
        code: 'TOO_MANY_ACTIVE_OFFERS'
      })
    }

    return { isValid: errors.length === 0, errors }
  }

  executeCore(state: GameState, action: CreateTradeOfferAction): ProcessResult {
    const newState = this.stateManager.cloneState(state)
    
    // Clean up expired offers first
    this.cleanupExpiredOffers(newState)
    
    // Create new trade offer
    const tradeOffer: TradeOffer = {
      id: `trade-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      offeringPlayerId: action.playerId,
      targetPlayerId: action.data.targetPlayerId,
      offering: {
        wood: action.data.offering.wood || 0,
        brick: action.data.offering.brick || 0,
        ore: action.data.offering.ore || 0,
        wheat: action.data.offering.wheat || 0,
        sheep: action.data.offering.sheep || 0
      },
      requesting: {
        wood: action.data.requesting.wood || 0,
        brick: action.data.requesting.brick || 0,
        ore: action.data.requesting.ore || 0,
        wheat: action.data.requesting.wheat || 0,
        sheep: action.data.requesting.sheep || 0
      },
      createdTurn: newState.turn,
      expiresAfterTurns: action.data.expiresAfterTurns || 3
    }
    
    // Add to trade offers
    const currentOffers = this.getTradeOffers(newState)
    this.setTradeOffers(newState, [...currentOffers, tradeOffer])
    
    // Create events
    const events: GameEvent[] = [
      this.createEvent('TRADE_OFFER_CREATED', action.playerId, {
        tradeOfferId: tradeOffer.id,
        offering: tradeOffer.offering,
        requesting: tradeOffer.requesting,
        targetPlayerId: tradeOffer.targetPlayerId
      })
    ]
    
    return {
      success: true,
      newState,
      events,
      message: `Player ${action.playerId} created trade offer ${tradeOffer.id}`
    }
  }
}

export class AcceptTradeProcessor extends PlayerTradeProcessor<AcceptTradeAction> {
  readonly actionType = 'acceptTrade' as const
  
  constructor(
    stateManager: StateManager,
    eventFactory: EventFactory,
    postProcessor: PostProcessorChain
  ) {
    super(stateManager, eventFactory, postProcessor)
  }

  canProcess(action: GameAction): action is AcceptTradeAction {
    return action.type === 'acceptTrade'
  }
  
  validate(state: GameState, action: AcceptTradeAction): ValidationResult {
    const errors: ValidationError[] = []
    
    // Note: Accept trade can happen on any player's turn (not just current player)
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

    // Find the trade offer
    const tradeOffer = this.findTradeOffer(state, action.data.tradeOfferId)
    if (!tradeOffer) {
      errors.push({
        field: 'tradeOfferId',
        message: 'Trade offer not found',
        code: 'TRADE_OFFER_NOT_FOUND'
      })
      return { isValid: false, errors }
    }

    // Validate offer hasn't expired
    if (!this.isTradeOfferValid(state, tradeOffer)) {
      errors.push({
        field: 'tradeOfferId',
        message: 'Trade offer has expired',
        code: 'TRADE_OFFER_EXPIRED'
      })
      return { isValid: false, errors }
    }

    // Player can't accept their own trade offer
    if (tradeOffer.offeringPlayerId === action.playerId) {
      errors.push({
        field: 'tradeOfferId',
        message: 'Cannot accept your own trade offer',
        code: 'CANNOT_ACCEPT_OWN_OFFER'
      })
      return { isValid: false, errors }
    }

    // If trade is targeted, only the target can accept
    if (tradeOffer.targetPlayerId && tradeOffer.targetPlayerId !== action.playerId) {
      errors.push({
        field: 'tradeOfferId',
        message: 'This trade offer is not available to you',
        code: 'NOT_TRADE_TARGET'
      })
      return { isValid: false, errors }
    }

    // Validate accepting player has the requested resources
    if (!hasResources(player.resources, tradeOffer.requesting)) {
      errors.push({
        field: 'resources',
        message: 'You do not have enough resources to accept this trade',
        code: 'INSUFFICIENT_RESOURCES'
      })
    }

    // Validate offering player still has the offered resources
    const offeringPlayer = state.players.get(tradeOffer.offeringPlayerId)!
    if (!hasResources(offeringPlayer.resources, tradeOffer.offering)) {
      errors.push({
        field: 'offeringPlayer',
        message: 'Offering player no longer has the resources for this trade',
        code: 'OFFERING_PLAYER_INSUFFICIENT_RESOURCES'
      })
    }

    return { isValid: errors.length === 0, errors }
  }

  executeCore(state: GameState, action: AcceptTradeAction): ProcessResult {
    const newState = this.stateManager.cloneState(state)
    
    const tradeOffer = this.findTradeOffer(newState, action.data.tradeOfferId)!
    const acceptingPlayer = newState.players.get(action.playerId)!
    const offeringPlayer = newState.players.get(tradeOffer.offeringPlayerId)!
    
    // Execute the trade
    // Accepting player gives the requested resources and receives the offered resources
    acceptingPlayer.resources = subtractResources(acceptingPlayer.resources, tradeOffer.requesting)
    acceptingPlayer.resources = addResources(acceptingPlayer.resources, tradeOffer.offering)
    
    // Offering player gives the offered resources and receives the requested resources
    offeringPlayer.resources = subtractResources(offeringPlayer.resources, tradeOffer.offering)
    offeringPlayer.resources = addResources(offeringPlayer.resources, tradeOffer.requesting)
    
    // Remove the trade offer
    this.removeTradeOffer(newState, action.data.tradeOfferId)
    
    // Create events
    const events: GameEvent[] = [
      this.createEvent('TRADE_ACCEPTED', action.playerId, {
        tradeOfferId: action.data.tradeOfferId,
        offeringPlayerId: tradeOffer.offeringPlayerId,
        acceptingPlayerId: action.playerId,
        offeredResources: tradeOffer.offering,
        requestedResources: tradeOffer.requesting
      })
    ]
    
    return {
      success: true,
      newState,
      events,
      message: `Player ${action.playerId} accepted trade offer from ${tradeOffer.offeringPlayerId}`
    }
  }
}

export class RejectTradeProcessor extends PlayerTradeProcessor<RejectTradeAction> {
  readonly actionType = 'rejectTrade' as const
  
  constructor(
    stateManager: StateManager,
    eventFactory: EventFactory,
    postProcessor: PostProcessorChain
  ) {
    super(stateManager, eventFactory, postProcessor)
  }

  canProcess(action: GameAction): action is RejectTradeAction {
    return action.type === 'rejectTrade'
  }
  
  validate(state: GameState, action: RejectTradeAction): ValidationResult {
    const errors: ValidationError[] = []
    
    // Note: Reject trade can happen on any player's turn
    errors.push(...this.validateGamePhase(state, ['actions']))
    
    const tradeOffer = this.findTradeOffer(state, action.data.tradeOfferId)
    if (!tradeOffer) {
      errors.push({
        field: 'tradeOfferId',
        message: 'Trade offer not found',
        code: 'TRADE_OFFER_NOT_FOUND'
      })
    }

    return { isValid: errors.length === 0, errors }
  }

  executeCore(state: GameState, action: RejectTradeAction): ProcessResult {
    const newState = this.stateManager.cloneState(state)
    
    // For reject, we just log the rejection but don't remove the offer
    // The offer can still be accepted by other players or expire naturally
    
    const events: GameEvent[] = [
      this.createEvent('TRADE_REJECTED', action.playerId, {
        tradeOfferId: action.data.tradeOfferId
      })
    ]
    
    return {
      success: true,
      newState,
      events,
      message: `Player ${action.playerId} rejected trade offer ${action.data.tradeOfferId}`
    }
  }
}

export class CancelTradeProcessor extends PlayerTradeProcessor<CancelTradeAction> {
  readonly actionType = 'cancelTrade' as const
  
  constructor(
    stateManager: StateManager,
    eventFactory: EventFactory,
    postProcessor: PostProcessorChain
  ) {
    super(stateManager, eventFactory, postProcessor)
  }

  canProcess(action: GameAction): action is CancelTradeAction {
    return action.type === 'cancelTrade'
  }
  
  validate(state: GameState, action: CancelTradeAction): ValidationResult {
    const errors: ValidationError[] = []
    
    // Only the offering player can cancel their own trade
    errors.push(...this.validatePlayerTurn(state, action.playerId))
    errors.push(...this.validateGamePhase(state, ['actions']))
    
    const tradeOffer = this.findTradeOffer(state, action.data.tradeOfferId)
    if (!tradeOffer) {
      errors.push({
        field: 'tradeOfferId',
        message: 'Trade offer not found',
        code: 'TRADE_OFFER_NOT_FOUND'
      })
      return { isValid: false, errors }
    }

    // Only the offering player can cancel
    if (tradeOffer.offeringPlayerId !== action.playerId) {
      errors.push({
        field: 'tradeOfferId',
        message: 'You can only cancel your own trade offers',
        code: 'NOT_TRADE_OWNER'
      })
    }

    return { isValid: errors.length === 0, errors }
  }

  executeCore(state: GameState, action: CancelTradeAction): ProcessResult {
    const newState = this.stateManager.cloneState(state)
    
    // Remove the trade offer
    this.removeTradeOffer(newState, action.data.tradeOfferId)
    
    const events: GameEvent[] = [
      this.createEvent('TRADE_CANCELLED', action.playerId, {
        tradeOfferId: action.data.tradeOfferId
      })
    ]
    
    return {
      success: true,
      newState,
      events,
      message: `Player ${action.playerId} cancelled trade offer ${action.data.tradeOfferId}`
    }
  }
} 