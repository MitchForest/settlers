import { GameState, GamePhase, PlayerId, GameAction } from '@settlers/game-engine'
import { BasePhaseStrategy, ScoredAction } from '../types/ai-interfaces'
import { DiscardOptimizer } from '../utils/discard-optimizer'

export class DiscardPhaseStrategy extends BasePhaseStrategy {
  phase = 'discard' as GamePhase

  generateActions(state: GameState, playerId: PlayerId): GameAction[] {
    const player = state.players.get(playerId)
    if (!player) return []
    const totalResources = Object.values(player.resources).reduce((sum, n) => sum + n, 0)
    
    if (totalResources <= 7) {
      // Player doesn't need to discard - discard 0 resources
      return [{
        type: 'discard',
        playerId,
        data: { resources: { wood: 0, brick: 0, ore: 0, wheat: 0, sheep: 0 } }
      }]
    }
    
    const discardCount = Math.floor(totalResources / 2)
    const optimizer = new DiscardOptimizer()
    const optimalDiscard = optimizer.optimize(player.resources, discardCount)
    
    return [{
      type: 'discard',
      playerId,
      data: { resources: optimalDiscard }
    }]
  }

  selectBestAction(actions: ScoredAction[]): GameAction {
    return actions[0].action
  }
}

export class RollPhaseStrategy extends BasePhaseStrategy {
  phase = 'roll' as GamePhase

  generateActions(state: GameState, playerId: PlayerId): GameAction[] {
    return [{ type: 'roll', playerId, data: {} }]
  }

  selectBestAction(actions: ScoredAction[]): GameAction {
    return actions[0].action
  }
} 