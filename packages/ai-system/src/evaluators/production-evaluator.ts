import { GameState, GameAction } from '@settlers/game-engine'
import { BaseActionEvaluator, ActionScore } from '../types/ai-interfaces'

export class ProductionEvaluator extends BaseActionEvaluator {
  priority = 80

  canEvaluate(state: GameState, action: GameAction): boolean {
    return (action.type === 'build' || action.type === 'placeBuilding') && 
           (action.data.buildingType === 'settlement' || action.data.buildingType === 'city')
  }

  evaluate(state: GameState, action: GameAction): ActionScore {
    const position = action.data.position || action.data.vertexId
    const productionValue = this.calculateProductionValue(state, position)
    const multiplier = action.data.buildingType === 'city' ? 2 : 1
    
    return {
      value: Math.min(100, productionValue * 8 * multiplier),
      confidence: 0.8,
      reasoning: [`Production value: ${(productionValue * multiplier).toFixed(1)}`]
    }
  }

  private calculateProductionValue(state: GameState, position: string): number {
    const vertex = state.board.vertices.get(position)
    if (!vertex) return 0
    
    let totalValue = 0
    
    for (const hexCoord of vertex.position.hexes) {
      const hex = Array.from(state.board.hexes.values())
        .find(h => h.position.q === hexCoord.q && h.position.r === hexCoord.r)
      
      if (hex && hex.terrain && hex.terrain !== 'desert' && hex.numberToken) {
        const probability = this.getNumberProbability(hex.numberToken)
        const resourceValue = this.getResourceValue(hex.terrain)
        totalValue += probability * resourceValue
      }
    }
    
    return totalValue
  }

  private getNumberProbability(number: number): number {
    const probabilities: Record<number, number> = {
      2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6,
      8: 5, 9: 4, 10: 3, 11: 2, 12: 1
    }
    return probabilities[number] || 0
  }

  private getResourceValue(terrain: string): number {
    const values: Record<string, number> = {
      'forest': 3, 'hills': 3, 'mountains': 4, 'fields': 4, 'pasture': 3,
      'desert': 0, 'sea': 0
    }
    return values[terrain] || 0
  }
} 