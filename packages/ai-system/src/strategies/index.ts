import { SetupPhaseStrategy } from './setup-strategy'
import { MainPhaseStrategy } from './main-strategy'
import { RobberPhaseStrategy, StealPhaseStrategy } from './robber-strategy'
import { DiscardPhaseStrategy, RollPhaseStrategy } from './discard-strategy'
import { PhaseStrategy } from '../types/ai-interfaces'
import { GamePhase } from '@settlers/game-engine'

export { SetupPhaseStrategy } from './setup-strategy'
export { MainPhaseStrategy } from './main-strategy'
export { RobberPhaseStrategy, StealPhaseStrategy } from './robber-strategy'
export { DiscardPhaseStrategy, RollPhaseStrategy } from './discard-strategy'

// Convenience factory for creating all strategies
export class PhaseStrategies {
  static createAll(): Map<GamePhase, PhaseStrategy> {
    return new Map([
      ['setup1', new SetupPhaseStrategy(1)],
      ['setup2', new SetupPhaseStrategy(2)],
      ['roll', new RollPhaseStrategy()],
      ['actions', new MainPhaseStrategy()],
      ['discard', new DiscardPhaseStrategy()],
      ['moveRobber', new RobberPhaseStrategy()],
      ['steal', new StealPhaseStrategy()]
    ])
  }
} 