import { GameState, GameAction, PlayerId, GameEvent } from '../types'
import { rollDice } from '../core/calculations'
import { getPossibleRoadPositions } from '../core/placement-rules'
import { BaseActionProcessor, ValidationResult, ProcessResult, StateManager, EventFactory, PostProcessorChain } from './processor-base'

interface PlayCardAction extends GameAction {
  type: 'playCard'
  data: {
    cardType: string
    cardId?: string
    targetPlayerId?: PlayerId
    resources?: Record<string, number>
    roadPositions?: string[]
  }
}

export class PlayCardProcessor extends BaseActionProcessor<PlayCardAction> {
  readonly actionType = 'playCard' as const

  canProcess(action: GameAction): action is PlayCardAction {
    return action.type === 'playCard'
  }

  validate(state: GameState, action: PlayCardAction): ValidationResult {
    const errors = [
      ...this.validatePlayerTurn(state, action.playerId),
      ...this.validateGamePhase(state, ['actions'])
    ]

    const player = state.players.get(action.playerId)
    if (!player) {
      errors.push({
        field: 'playerId',
        message: 'Player not found',
        code: 'PLAYER_NOT_FOUND'
      })
      return { isValid: false, errors }
    }

    // Validate player has the card
    const hasCard = player.developmentCards.some(card => 
      card.type === action.data.cardType && 
      (!action.data.cardId || card.id === action.data.cardId) &&
      card.purchasedTurn < state.turn // Can't play cards bought this turn
    )

    if (!hasCard) {
      errors.push({
        field: 'cardType',
        message: `Player does not have ${action.data.cardType} card available to play`,
        code: 'CARD_NOT_AVAILABLE'
      })
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  executeCore(state: GameState, action: PlayCardAction): ProcessResult {
    const player = state.players.get(action.playerId)!
    const events = []
    let newState = { ...state }

    // Clone players map
    newState.players = new Map(state.players)
    
    // Find and remove the card
    const cardIndex = player.developmentCards.findIndex(card => 
      card.type === action.data.cardType && 
      (!action.data.cardId || card.id === action.data.cardId) &&
      card.purchasedTurn < state.turn
    )

    if (cardIndex === -1) {
      return {
        success: false,
        newState: state,
        events: [],
        error: 'Card not found or not playable'
      }
    }

    const card = player.developmentCards[cardIndex]
    const updatedPlayer = { ...player }
    updatedPlayer.developmentCards = [...player.developmentCards]
    updatedPlayer.developmentCards.splice(cardIndex, 1)

    // Handle different card types
    switch (action.data.cardType) {
      case 'knight':
        // Move knight to discard and increment knights played
        updatedPlayer.knightsPlayed = player.knightsPlayed + 1
        newState.discardPile = [...state.discardPile, card]
        
        // Move to robber phase
        newState.phase = 'moveRobber'
        
        events.push(this.createEvent('knightPlayed', action.playerId, {
          cardId: card.id,
          knightsPlayed: updatedPlayer.knightsPlayed
        }))
        break

      case 'roadBuilding':
        // Validate that player can place at least one road
        const possibleRoadPositions = getPossibleRoadPositions(state, action.playerId)
        if (possibleRoadPositions.length === 0) {
          return {
            success: false,
            newState: state,
            events: [],
            error: 'No valid road positions available for Road Building card'
          }
        }

        // Validate that player has enough road pieces
        const playerRoadsBuilt = player.buildings.roads
        const maxRoads = 15 // Standard Catan limit
        const availableRoads = maxRoads - playerRoadsBuilt
        
        if (availableRoads === 0) {
          return {
            success: false,
            newState: state,
            events: [],
            error: 'No road pieces remaining to build'
          }
        }

        // Set up road building state (can build up to 2 roads, but limited by available pieces)
        const roadsToPlace = Math.min(2, availableRoads, possibleRoadPositions.length)
        
        newState.pendingRoadBuilding = {
          playerId: action.playerId,
          roadsRemaining: roadsToPlace
        }
        newState.discardPile = [...state.discardPile, card]
        
        events.push(this.createEvent('roadBuildingPlayed', action.playerId, {
          cardId: card.id,
          roadsRemaining: roadsToPlace,
          availablePositions: possibleRoadPositions.slice(0, 10) // Limit for performance
        }))
        break

      case 'yearOfPlenty':
        // Player gets 2 free resources from the bank
        if (action.data.resources) {
          const resourceCount = Object.values(action.data.resources).reduce((sum, count) => sum + count, 0)
          if (resourceCount === 2) {
            // Check if bank has enough resources
            const bankHasResources = Object.entries(action.data.resources).every(([resource, amount]) => {
              const bankAmount = state.bankResources[resource as keyof typeof state.bankResources]
              return bankAmount >= amount
            })

            if (!bankHasResources) {
              return {
                success: false,
                newState: state,
                events: [],
                error: 'Bank does not have enough resources for Year of Plenty'
              }
            }

            // Execute the card
            for (const [resource, amount] of Object.entries(action.data.resources)) {
              updatedPlayer.resources[resource as keyof typeof updatedPlayer.resources] += amount
              newState.bankResources[resource as keyof typeof newState.bankResources] -= amount
            }
            newState.discardPile = [...state.discardPile, card]
            
            events.push(this.createEvent('yearOfPlentyPlayed', action.playerId, {
              cardId: card.id,
              resources: action.data.resources
            }))
          } else {
            return {
              success: false,
              newState: state,
              events: [],
              error: 'Year of Plenty must select exactly 2 resources'
            }
          }
        } else {
          return {
            success: false,
            newState: state,
            events: [],
            error: 'Year of Plenty requires resource selection'
          }
        }
        break

      case 'monopoly':
        // Player steals all of one resource type from all players
        if (action.data.resources) {
          const resourceType = Object.keys(action.data.resources)[0]
          let totalStolen = 0
          
          // Take from all other players
          const updatedPlayers = new Map(newState.players)
          for (const [otherPlayerId, otherPlayer] of state.players) {
            if (otherPlayerId !== action.playerId) {
              const stolenAmount = otherPlayer.resources[resourceType as keyof typeof otherPlayer.resources]
              if (stolenAmount > 0) {
                const updatedOtherPlayer = { ...otherPlayer }
                updatedOtherPlayer.resources = { ...otherPlayer.resources }
                updatedOtherPlayer.resources[resourceType as keyof typeof updatedOtherPlayer.resources] = 0
                updatedPlayers.set(otherPlayerId, updatedOtherPlayer)
                totalStolen += stolenAmount
              }
            }
          }
          
          // Give to current player
          updatedPlayer.resources = { ...updatedPlayer.resources }
          updatedPlayer.resources[resourceType as keyof typeof updatedPlayer.resources] += totalStolen
          newState.players = updatedPlayers
          newState.discardPile = [...state.discardPile, card]
          
          events.push(this.createEvent('monopolyPlayed', action.playerId, {
            cardId: card.id,
            resourceType,
            amountStolen: totalStolen
          }))
        } else {
          return {
            success: false,
            newState: state,
            events: [],
            error: 'Monopoly requires resource type selection'
          }
        }
        break

      case 'victory':
        // Victory point cards are not "played" - they are revealed automatically when calculating score
        // However, a player may choose to reveal them manually for strategic reasons
        // or they are revealed at game end
        
        const victoryCardEvent: GameEvent = {
          id: `card_revealed_${Date.now()}`,
          type: 'cardRevealed',
          timestamp: new Date(),
          gameId: state.id,
          data: {
            playerId: action.playerId,
            cardId: action.data.cardId,
            cardType: 'victory'
          }
        }

        // Mark card as revealed but not removed (it stays for scoring)
        card.playedTurn = state.turn
        
        return {
          success: true,
          newState: state,
          events: [victoryCardEvent]
        }

      default:
        return {
          success: false,
          newState: state,
          events: [],
          error: `Unknown card type: ${action.data.cardType}`
        }
    }

    // Update player in state
    newState.players.set(action.playerId, updatedPlayer)

    return {
      success: true,
      newState,
      events,
      message: `Played ${action.data.cardType} card`
    }
  }
}