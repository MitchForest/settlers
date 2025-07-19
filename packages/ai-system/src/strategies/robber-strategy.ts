import { GameState, GamePhase, PlayerId, GameAction } from '@settlers/game-engine'
import { BasePhaseStrategy, ScoredAction } from '../types/ai-interfaces'

export class RobberPhaseStrategy extends BasePhaseStrategy {
  phase = 'moveRobber' as GamePhase

  generateActions(state: GameState, playerId: PlayerId): GameAction[] {
    const actions: GameAction[] = []
    
    // Simple robber strategy: target high-production hexes with opponents
    for (const [, hex] of state.board.hexes) {
      if (hex.hasRobber) continue
      
      actions.push({
        type: 'moveRobber',
        playerId,
        data: { hexPosition: hex.position }
      })
    }
    
    return actions.slice(0, 5) // Limit choices
  }

  selectBestAction(actions: ScoredAction[]): GameAction {
    return actions.sort((a, b) => b.score - a.score)[0].action
  }
}

export class StealPhaseStrategy extends BasePhaseStrategy {
  phase = 'steal' as GamePhase

  generateActions(state: GameState, playerId: PlayerId): GameAction[] {
    const adjacentPlayers = this.getPlayersAdjacentToRobber(state, playerId)
      .filter(targetId => {
        const player = state.players.get(targetId)
        if (!player) return false
        const resourceCount = Object.values(player.resources).reduce((sum, count) => sum + count, 0)
        return resourceCount > 0
      })
    
    if (adjacentPlayers.length === 0) {
      return [{ type: 'endTurn', playerId, data: {} }]
    }
    
    return adjacentPlayers.map(targetId => ({
      type: 'stealResource',
      playerId,
      data: { targetPlayerId: targetId }
    }))
  }

  selectBestAction(actions: ScoredAction[]): GameAction {
    return actions.sort((a, b) => b.score - a.score)[0].action
  }

  private getPlayersAdjacentToRobber(state: GameState, playerId: PlayerId): string[] {
    const robberPosition = state.board.robberPosition
    if (!robberPosition) return []
    
    const adjacentPlayers: string[] = []
    
    for (const [, vertex] of state.board.vertices) {
      if (!vertex.building || vertex.building.owner === playerId) continue
      
      const isAdjacent = vertex.position.hexes.some(hex => 
        hex.q === robberPosition.q && 
        hex.r === robberPosition.r && 
        hex.s === robberPosition.s
      )
      
      if (isAdjacent && !adjacentPlayers.includes(vertex.building.owner)) {
        adjacentPlayers.push(vertex.building.owner)
      }
    }
    
    return adjacentPlayers
  }
} 