import { GameState, GameAction, PlayerId, ResourceType } from '@settlers/game-engine'
import { BaseActionGenerator } from '../types/ai-interfaces'
import { ResourceAnalyzer } from '../utils/resource-analyzer'

export class BankTradeGenerator extends BaseActionGenerator {
  generate(state: GameState, playerId: PlayerId): GameAction[] {
    const player = state.players.get(playerId)
    if (!player) return []
    const actions: GameAction[] = []
    
    // Enhanced resource needs analysis
    const neededResources = ResourceAnalyzer.analyzeResourceNeeds(player)
    if (neededResources.length === 0) return []
    
    // Find tradeable resources (4+ for bank trade)
    const tradeableResources = ResourceAnalyzer.findTradeableResources(player)
    
    // Generate 4:1 bank trades
    for (const [giveResource, giveAmount] of Object.entries(tradeableResources)) {
      if (giveAmount < 4) continue
      
      for (const needResource of neededResources) {
        if (giveResource === needResource) continue
        
        actions.push({
          type: 'bankTrade',
          playerId,
          data: {
            offering: { [giveResource]: 4 },
            requesting: { [needResource]: 1 }
          }
        })
      }
    }
    
    return actions
  }
}

export class PortTradeGenerator extends BaseActionGenerator {
  generate(state: GameState, playerId: PlayerId): GameAction[] {
    const player = state.players.get(playerId)
    if (!player) return []
    const actions: GameAction[] = []
    const ports = this.getPlayerPorts(state, playerId)
    
    if (ports.length === 0) return []
    
    const neededResources = ResourceAnalyzer.analyzeResourceNeeds(player)
    if (neededResources.length === 0) return []
    
    for (const port of ports) {
      if (port.type === 'generic') {
        // 3:1 generic port - can trade any resource
        const resourceTypes = ['wood', 'brick', 'ore', 'wheat', 'sheep'] as const
        for (const resource of resourceTypes) {
          if (player.resources[resource] >= 3) {
            for (const needResource of neededResources) {
              if (needResource !== resource) {
                actions.push({
                  type: 'portTrade',
                  playerId,
                  data: {
                    offering: { [resource]: 3 },
                    requesting: { [needResource]: 1 },
                    portType: 'generic'
                  }
                })
              }
            }
          }
        }
      } else {
        // 2:1 specific port - best trade rate
        const specificResource = port.type as ResourceType
        if (player.resources[specificResource] >= 2) {
          for (const needResource of neededResources) {
            if (needResource !== specificResource) {
              actions.push({
                type: 'portTrade',
                playerId,
                data: {
                  offering: { [specificResource]: 2 },
                  requesting: { [needResource]: 1 },
                  portType: specificResource
                }
              })
            }
          }
        }
      }
    }
    
    return actions
  }
  
  private getPlayerPorts(state: GameState, playerId: PlayerId): Array<{type: string}> {
    const ports: Array<{type: string}> = []
    
    for (const [, vertex] of state.board.vertices) {
      if (vertex.building?.owner === playerId && vertex.port) {
        ports.push(vertex.port)
      }
    }
    
    return ports
  }
} 