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
    // ULTRA-AGGRESSIVE BUILDING STRATEGY - Prioritize VP generation above all else
    
    console.log(`\n🎯 MAIN STRATEGY: Evaluating ${actions.length} actions`)
    actions.forEach((a, i) => {
      console.log(`  ${i + 1}. ${a.action.type} (score: ${a.score}) - ${a.reasoning[0] || 'no reason'}`)
    })
    
    // 1. Immediate victory actions (score 95+)
    const victoryActions = actions.filter(a => 
      a.reasoning.some(r => r.includes('VICTORY') || r.includes('🏆')) || a.score >= 95
    )
    if (victoryActions.length > 0) {
      console.log(`✅ VICTORY ACTION: ${victoryActions[0].action.type}`)
      return victoryActions.sort((a, b) => b.priority - a.priority)[0].action
    }
    
    // 2. CRITICAL FIX: Building actions get HIGHEST priority (score 70+)
    const buildingActions = actions.filter(a => 
      a.action.type === 'build' && a.score >= 70
    )
    if (buildingActions.length > 0) {
      // Cities > settlements > roads
      const cityActions = buildingActions.filter(a => a.action.data.buildingType === 'city')
      const settlementActions = buildingActions.filter(a => a.action.data.buildingType === 'settlement')
      const roadActions = buildingActions.filter(a => a.action.data.buildingType === 'road')
      
      if (cityActions.length > 0) {
        console.log(`✅ BUILDING ACTION: City (score: ${cityActions[0].score})`)
        return cityActions.sort((a, b) => b.score - a.score)[0].action
      }
      if (settlementActions.length > 0) {
        console.log(`✅ BUILDING ACTION: Settlement (score: ${settlementActions[0].score})`)
        return settlementActions.sort((a, b) => b.score - a.score)[0].action
      }
      if (roadActions.length > 0) {
        console.log(`✅ BUILDING ACTION: Road (score: ${roadActions[0].score})`)
        return roadActions.sort((a, b) => b.score - a.score)[0].action
      }
    }
    
    // 3. AGGRESSIVE TRADING - Trade when we can't build (score 60+)
    const tradeActions = actions.filter(a => 
      (a.action.type === 'bankTrade' || a.action.type === 'portTrade') && a.score >= 60
    )
    if (tradeActions.length > 0) {
      console.log(`✅ TRADE ACTION: ${tradeActions[0].action.type} (score: ${tradeActions[0].score})`)
      return tradeActions.sort((a, b) => b.score - a.score)[0].action
    }
    
    // 4. LIMITED Development card playing (max 1 per turn unless high score)
    const devCardPlayActions = actions.filter(a => a.action.type === 'playCard' && a.score >= 80)
    if (devCardPlayActions.length > 0) {
      console.log(`✅ DEV CARD PLAY: ${devCardPlayActions[0].action.type} (score: ${devCardPlayActions[0].score})`)
      return devCardPlayActions.sort((a, b) => b.score - a.score)[0].action
    }
    
    // 5. Development card buying (only if score 70+)
    const devCardActions = actions.filter(a => a.action.type === 'buyCard' && a.score >= 70)
    if (devCardActions.length > 0) {
      console.log(`✅ BUY DEV CARD: (score: ${devCardActions[0].score})`)
      return devCardActions.sort((a, b) => b.score - a.score)[0].action
    }
    
    // 6. Lower priority building actions (score 50+)
    const lowerBuildingActions = actions.filter(a => 
      a.action.type === 'build' && a.score >= 50
    )
    if (lowerBuildingActions.length > 0) {
      console.log(`✅ LOWER BUILDING ACTION: ${lowerBuildingActions[0].action.data.buildingType} (score: ${lowerBuildingActions[0].score})`)
      return lowerBuildingActions.sort((a, b) => b.score - a.score)[0].action
    }
    
    // 7. Lower priority trades (score 40+)
    const lowerTradeActions = actions.filter(a => 
      (a.action.type === 'bankTrade' || a.action.type === 'portTrade') && a.score >= 40
    )
    if (lowerTradeActions.length > 0) {
      console.log(`✅ LOWER TRADE ACTION: ${lowerTradeActions[0].action.type} (score: ${lowerTradeActions[0].score})`)
      return lowerTradeActions.sort((a, b) => b.score - a.score)[0].action
    }
    
    // 8. ONLY end turn if absolutely nothing else scored above 40
    const sortedActions = actions.sort((a, b) => b.score - a.score)
    const bestAction = sortedActions[0]
    
    console.log(`⚠️ FALLBACK ACTION: ${bestAction.action.type} (score: ${bestAction.score})`)
    return bestAction.action
  }
} 