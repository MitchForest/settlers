import { GameState, GameAction } from '@settlers/game-engine'
import { BaseActionEvaluator, ActionScore } from '../types/ai-interfaces'

export class ResourceEvaluator extends BaseActionEvaluator {
  priority = 70

  canEvaluate(): boolean {
    return true
  }

  evaluate(state: GameState, action: GameAction): ActionScore {
    const player = state.players.get(action.playerId)
    if (!player) {
      return { value: 0, confidence: 0, reasoning: ['Player not found'] }
    }
    const resourceTotal = Object.values(player.resources).reduce((sum, n) => sum + n, 0)
    
    if (action.type === 'endTurn') {
      // ULTRA-AGGRESSIVE: Almost never end turn if we have resources
      const currentTurn = state.turn
      
      // Check if we're close to any building
      const closeToCity = player.resources.ore >= 2 && player.resources.wheat >= 1
      const closeToSettlement = 
        (player.resources.wood + player.resources.brick + 
         player.resources.sheep + player.resources.wheat) >= 3
      const closeToDevCard = 
        (player.resources.ore + player.resources.wheat + player.resources.sheep) >= 2
      
      // Turn-based urgency for ending turns
      let endTurnPenalty = 1.0
      if (currentTurn > 60) endTurnPenalty = 3.0      // Almost never end turn late game
      else if (currentTurn > 40) endTurnPenalty = 2.0 // Strongly discourage ending turn mid game
      else if (currentTurn > 20) endTurnPenalty = 1.5 // Moderately discourage ending turn
      
      if (resourceTotal === 0) {
        return { value: Math.max(5, 80 / endTurnPenalty), confidence: 0.9, reasoning: ['No resources - must end turn'] }
      } else if (closeToCity || closeToSettlement || closeToDevCard) {
        return { 
          value: Math.max(1, 5 / endTurnPenalty), 
          confidence: 0.9, 
          reasoning: [`NEVER END T${currentTurn} - Trade for missing resources!`] 
        }
      } else if (resourceTotal >= 4) {
        return { 
          value: Math.max(1, 10 / endTurnPenalty), 
          confidence: 0.9, 
          reasoning: [`NEVER END T${currentTurn} - Trade ${resourceTotal} resources!`] 
        }
      } else if (resourceTotal >= 2) {
        return { 
          value: Math.max(1, 20 / endTurnPenalty), 
          confidence: 0.8, 
          reasoning: [`Avoid ending T${currentTurn} - Try trading first`] 
        }
      } else {
        return { value: Math.max(5, 40 / endTurnPenalty), confidence: 0.7, reasoning: ['Low resources, limited options'] }
      }
    }
    
    // Building action with resource management context
    if (resourceTotal >= 6) {
      return {
        value: 95,
        confidence: 0.9,
        reasoning: ['URGENT: Risk of robber discard']
      }
    }
    
    return {
      value: 70,
      confidence: 0.7,
      reasoning: ['Take action!']
    }
  }
}

export class DevelopmentCardEvaluator extends BaseActionEvaluator {
  priority = 85

  canEvaluate(state: GameState, action: GameAction): boolean {
    return action.type === 'playCard' || action.type === 'buyCard'
  }

  evaluate(state: GameState, action: GameAction): ActionScore {
    const player = state.players.get(action.playerId)
    if (!player) {
      return { value: 0, confidence: 0, reasoning: ['Player not found'] }
    }
    
    if (action.type === 'playCard') {
      const card = player.developmentCards.find(c => c.id === action.data.cardId)
      if (!card) return { value: 0, confidence: 0, reasoning: ['Card not found'] }
      
      switch (card.type) {
        case 'knight': {
          // High value - works toward largest army
          const knightValue = player.knightsPlayed >= 2 ? 85 : 70
          return {
            value: knightValue,
            confidence: 0.9,
            reasoning: [`Knight #${player.knightsPlayed + 1} - toward largest army`]
          }
        }
          
        case 'victory':
          // Only if winning
          if (player.score.total + 1 >= 10) {
            return {
              value: 100,
              confidence: 1.0,
              reasoning: ['VICTORY POINT - WIN THE GAME!']
            }
          }
          return { value: 0, confidence: 1.0, reasoning: ['Save victory card'] }
          
        case 'yearOfPlenty':
          return {
            value: 80,
            confidence: 0.9,
            reasoning: ['Year of Plenty - get needed resources']
          }
          
        case 'monopoly':
          return {
            value: 75,
            confidence: 0.8,
            reasoning: ['Monopoly - steal opponent resources']
          }
          
        case 'roadBuilding':
          return {
            value: 70,
            confidence: 0.8,
            reasoning: ['Road Building - free expansion']
          }
          
        default:
          return {
            value: 75,
            confidence: 0.8,
            reasoning: [`Play ${card.type} for advantage`]
          }
      }
    }
    
    // Buying development cards
    if (action.type === 'buyCard') {
      const baseValue = 60
      const vpBonus = player.score.total >= 7 ? 25 : 0 // Higher value when close to winning
      
      return {
        value: baseValue + vpBonus,
        confidence: 0.8,
        reasoning: [
          'Development card - 25% VP chance',
          'Knights for largest army',
          player.score.total >= 7 ? 'ENDGAME - hidden VPs critical' : ''
        ].filter(r => r)
      }
    }
    
    return { value: 50, confidence: 0.5, reasoning: [] }
  }
}

export class SetupEvaluator extends BaseActionEvaluator {
  priority = 110 // Higher than victory for setup phases

  canEvaluate(state: GameState, action: GameAction): boolean {
    return (state.phase === 'setup1' || state.phase === 'setup2') && 
           (action.type === 'placeBuilding' || action.type === 'placeRoad')
  }

  evaluate(_state: GameState, _action: GameAction): ActionScore {
    return {
      value: 100,
      confidence: 1.0,
      reasoning: ['Setup phase - critical initial placement']
    }
  }
} 