import { GameState, GameAction, PlayerId, Player, ResourceType } from '../../types'
import { BaseActionGenerator } from '../types/ai-interfaces'
import { ResourceAnalyzer } from '../utils/resource-analyzer'
import { hasResources } from '../../calculations'
import { canBuyDevelopmentCard } from '../../engine/state-validator'
import { BUILDING_COSTS } from '../../constants'

export class DevelopmentCardGenerator extends BaseActionGenerator {
  generate(state: GameState, playerId: PlayerId): GameAction[] {
    const player = state.players.get(playerId)!
    const devCardCost = { wood: 0, brick: 0, ore: 1, wheat: 1, sheep: 1 }
    
    if (hasResources(player.resources, devCardCost) && canBuyDevelopmentCard(state, playerId).isValid) {
      return [{
        type: 'buyCard',
        playerId,
        data: {}
      }]
    }
    
    return []
  }
}

export class DevelopmentCardPlayGenerator extends BaseActionGenerator {
  generate(state: GameState, playerId: PlayerId): GameAction[] {
    const player = state.players.get(playerId)!
    const actions: GameAction[] = []
    
    // Check each unplayed development card
    for (const card of player.developmentCards) {
      // Can't play cards bought this turn
      if (card.playedTurn || card.purchasedTurn === state.turn) continue
      
      switch (card.type) {
        case 'knight':
          // Always play knights - work toward largest army
          actions.push({
            type: 'playCard',
            playerId,
            data: { cardId: card.id }
          })
          break
          
        case 'roadBuilding':
          // Play if we have 2+ roads available
          if (player.buildings.roads >= 2) {
            actions.push({
              type: 'playCard',
              playerId,
              data: { cardId: card.id }
            })
          }
          break
          
        case 'yearOfPlenty':
          // Play to get needed resources
          const needs = this.getResourceNeeds(player)
          if (needs.length >= 2) {
            actions.push({
              type: 'playCard',
              playerId,
              data: { 
                cardId: card.id,
                resources: { [needs[0]]: 1, [needs[1]]: 1 }
              }
            })
          }
          break
          
        case 'monopoly':
          // Play if opponents have resources we need
          const bestResource = this.findBestMonopolyResource(state, player)
          if (bestResource) {
            actions.push({
              type: 'playCard',
              playerId,
              data: { 
                cardId: card.id,
                resourceType: bestResource
              }
            })
          }
          break
          
        case 'victory':
          // Only reveal if it wins the game
          if (player.score.total + 1 >= 10) {
            actions.push({
              type: 'playCard',
              playerId,
              data: { cardId: card.id }
            })
          }
          break
      }
    }
    
    return actions
  }
  
  private getResourceNeeds(player: Player): ResourceType[] {
    return ResourceAnalyzer.analyzeResourceNeeds(player)
  }
  
  private findBestMonopolyResource(state: GameState, player: Player): ResourceType | null {
    const needs = this.getResourceNeeds(player)
    if (needs.length === 0) return null
    
    // Count opponent resources
    const resourceCounts: Record<ResourceType, number> = {
      wood: 0, brick: 0, ore: 0, wheat: 0, sheep: 0
    }
    
    for (const [opponentId, opponent] of state.players) {
      if (opponentId === player.id) continue
      
      for (const resource of needs) {
        resourceCounts[resource] += opponent.resources[resource]
      }
    }
    
    // Find resource with highest opponent count
    let bestResource: ResourceType | null = null
    let bestCount = 0
    
    for (const [resource, count] of Object.entries(resourceCounts)) {
      if (count > bestCount) {
        bestCount = count
        bestResource = resource as ResourceType
      }
    }
    
    return bestCount >= 2 ? bestResource : null
  }
}

export class EndTurnGenerator extends BaseActionGenerator {
  generate(state: GameState, playerId: PlayerId): GameAction[] {
    // Always provide endTurn as an option for the main phase
    return [{
      type: 'endTurn',
      playerId,
      data: {}
    }]
  }
} 