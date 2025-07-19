import { GameState, GamePhase, PlayerId, GameAction } from '@settlers/game-engine'
import { BasePhaseStrategy, ScoredAction } from '../types/ai-interfaces'
import { ActionGenerators } from '../generators'

export class MainPhaseStrategy extends BasePhaseStrategy {
  phase = 'actions' as GamePhase

  generateActions(state: GameState, playerId: PlayerId): GameAction[] {
    const actions: GameAction[] = []
    const generators = [
      new ActionGenerators.BuildingActionGenerator(),
      new ActionGenerators.DevelopmentCardGenerator(),
      new ActionGenerators.DevelopmentCardPlayGenerator(),
      new ActionGenerators.BankTradeGenerator(),
      new ActionGenerators.PortTradeGenerator(),
      new ActionGenerators.EndTurnGenerator()
    ]
    
    for (const generator of generators) {
      actions.push(...generator.generate(state, playerId))
    }
    
    return actions
  }

  selectBestAction(actions: ScoredAction[]): GameAction {
    // AGGRESSIVE BUILDING STRATEGY - Build when possible, trade when necessary
    
    // 1. Immediate victory actions
    const victoryActions = actions.filter(a => 
      a.reasoning.some(r => r.includes('VICTORY') || r.includes('🏆')) || a.score >= 95
    )
    if (victoryActions.length > 0) {
      return victoryActions.sort((a, b) => b.priority - a.priority)[0].action
    }
    
    // 2. Development card playing (knights, road building, etc.)
    const devCardPlayActions = actions.filter(a => a.action.type === 'playCard')
    if (devCardPlayActions.length > 0) {
      return devCardPlayActions.sort((a, b) => b.score - a.score)[0].action
    }
    
    // 3. Building actions (cities > settlements > roads)
    const cityActions = actions.filter(a => 
      a.action.type === 'build' && a.action.data.buildingType === 'city'
    )
    if (cityActions.length > 0) {
      return cityActions.sort((a, b) => b.score - a.score)[0].action
    }
    
    const settlementActions = actions.filter(a => 
      a.action.type === 'build' && a.action.data.buildingType === 'settlement'
    )
    if (settlementActions.length > 0) {
      return settlementActions.sort((a, b) => b.score - a.score)[0].action
    }
    
    // 4. AGGRESSIVE TRADING - Trade when we have resources but can't build
    const tradeActions = actions.filter(a => 
      a.action.type === 'bankTrade' || a.action.type === 'portTrade'
    )
    if (tradeActions.length > 0) {
      return tradeActions.sort((a, b) => b.score - a.score)[0].action
    }
    
    // 5. Development cards (VP potential + knights)
    const devCardActions = actions.filter(a => a.action.type === 'buyCard')
    if (devCardActions.length > 0) {
      return devCardActions.sort((a, b) => b.score - a.score)[0].action
    }
    
    // 6. Strategic roads for expansion
    const roadActions = actions.filter(a => 
      a.action.type === 'build' && a.action.data.buildingType === 'road'
    )
    if (roadActions.length > 0) {
      return roadActions.sort((a, b) => b.score - a.score)[0].action
    }
    
    // 7. ONLY end turn if absolutely nothing else possible
    const sortedActions = actions.sort((a, b) => b.score - a.score)
    return sortedActions[0].action
  }
} 