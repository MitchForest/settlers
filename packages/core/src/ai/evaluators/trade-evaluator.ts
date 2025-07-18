import { GameState, GameAction, ResourceType, Player } from '../../types'
import { BaseActionEvaluator, ActionScore } from '../types/ai-interfaces'
import { ResourceAnalyzer } from '../utils/resource-analyzer'

export class TradeEvaluator extends BaseActionEvaluator {
  priority = 75

  canEvaluate(state: GameState, action: GameAction): boolean {
    return action.type === 'bankTrade' || action.type === 'portTrade'
  }

  evaluate(state: GameState, action: GameAction): ActionScore {
    const player = state.players.get(action.playerId)!
    
    if (action.type === 'bankTrade') {
      return this.evaluateBankTrade(action, player)
    } else if (action.type === 'portTrade') {
      return this.evaluatePortTrade(action, player)
    }
    
    return { value: 0, confidence: 0, reasoning: ['Unknown trade type'] }
  }
  
  private evaluateBankTrade(action: GameAction, player: Player): ActionScore {
    const offering = action.data.offering || {}
    const requesting = action.data.requesting || {}
    
    // ULTRA-AGGRESSIVE TRADING - Much higher base value
    let value = 75
    
    // Bonus for getting resources we desperately need
    const resourceNeeds = ResourceAnalyzer.getResourcePriority(player)
    const requestedResource = Object.keys(requesting)[0] as ResourceType
    const resourcePriority = resourceNeeds[requestedResource] || 0
    value += resourcePriority * 25 // Higher bonus for needed resources
    
    // LESS penalty for poor trade rate - trading is better than hoarding
    value -= 5 // Bank trades are inefficient but still better than not trading
    
    // Bonus if we have excess resources (need to spend them)
    const offeringResource = Object.keys(offering)[0] as ResourceType
    const offeringAmount = offering[offeringResource] || 0
    const currentAmount = player.resources[offeringResource] || 0
    if (currentAmount >= offeringAmount + 2) {
      value += 15 // We have excess, trade it away
    }
    
    return {
      value: Math.max(0, Math.min(100, value)),
      confidence: 0.8,
      reasoning: [`Bank trade 4:1 for ${requestedResource}`, `Priority: ${resourcePriority}`, `Excess: ${currentAmount >= offeringAmount + 2}`]
    }
  }
  
  private evaluatePortTrade(action: GameAction, player: Player): ActionScore {
    const offering = action.data.offering || {}
    const requesting = action.data.requesting || {}
    const portType = action.data.portType
    
    // ULTRA-AGGRESSIVE PORT TRADING - Much higher base value
    let value = 85
    
    // Bonus for getting resources we desperately need
    const resourceNeeds = ResourceAnalyzer.getResourcePriority(player)
    const requestedResource = Object.keys(requesting)[0] as ResourceType
    const resourcePriority = resourceNeeds[requestedResource] || 0
    value += resourcePriority * 30 // Higher bonus for needed resources
    
    // Bonus for good trade rate
    const tradeRate = portType === 'generic' ? 3 : 2
    if (tradeRate === 2) {
      value += 25 // 2:1 is excellent
    } else if (tradeRate === 3) {
      value += 15 // 3:1 is good
    }
    
    // Bonus if we have excess resources (need to spend them)
    const offeringResource = Object.keys(offering)[0] as ResourceType
    const offeringAmount = offering[offeringResource] || 0
    const currentAmount = player.resources[offeringResource] || 0
    if (currentAmount >= offeringAmount + 1) {
      value += 10 // We have excess, trade it away
    }
    
    return {
      value: Math.max(0, Math.min(100, value)),
      confidence: 0.9,
      reasoning: [`Port trade ${tradeRate}:1 for ${requestedResource}`, `Priority: ${resourcePriority}`, `Excess: ${currentAmount >= offeringAmount + 1}`]
    }
  }
} 