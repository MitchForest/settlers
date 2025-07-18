import { GameState, GameAction } from '../../types'
import { BaseActionEvaluator, ActionScore } from '../types/ai-interfaces'

export class VictoryEvaluator extends BaseActionEvaluator {
  priority = 100

  canEvaluate(state: GameState, action: GameAction): boolean {
    return action.type === 'build' || action.type === 'buyCard' || action.type === 'placeBuilding'
  }

  evaluate(state: GameState, action: GameAction): ActionScore {
    const player = state.players.get(action.playerId)!
    const currentScore = player.score.total
    
    // Immediate victory check
    if (currentScore >= 9) {
      if ((action.type === 'build' && 
          (action.data.buildingType === 'city' || action.data.buildingType === 'settlement')) ||
          (action.type === 'placeBuilding' && action.data.buildingType === 'settlement')) {
        return {
          value: 100,
          confidence: 1.0,
          reasoning: ['🏆 IMMEDIATE VICTORY!']
        }
      }
    }
    
    // Score based on VP value and urgency
    let vpValue = 0
    if (action.type === 'build' || action.type === 'placeBuilding') {
      vpValue = action.data.buildingType === 'city' ? 2 : 
                action.data.buildingType === 'settlement' ? 1 : 0
    } else if (action.type === 'buyCard') {
      vpValue = 0.25 // 25% chance of VP card
    }
    
    const urgencyMultiplier = currentScore >= 7 ? 2.0 : currentScore >= 5 ? 1.5 : 1.0
    const score = 50 + (vpValue * 30 * urgencyMultiplier) + (currentScore * 2)
    
    return {
      value: Math.min(100, score),
      confidence: 0.9,
      reasoning: [`Progress toward victory: ${currentScore + vpValue}/10`]
    }
  }
} 