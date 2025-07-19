import { GameState, GameAction, PlayerId, GamePhase } from '@settlers/game-engine'

// ===== CORE AI INTERFACES =====

export interface ActionEvaluator {
  canEvaluate(_state: GameState, _action: GameAction): boolean
  evaluate(_state: GameState, _action: GameAction): ActionScore
  priority: number // Determines evaluation order
}

export interface PhaseStrategy {
  phase: GamePhase
  generateActions(_state: GameState, _playerId: PlayerId): GameAction[]
  selectBestAction(_actions: ScoredAction[]): GameAction
}

export interface ActionGenerator {
  generate(_state: GameState, _playerId: PlayerId): GameAction[]
}

export interface ActionScore {
  value: number       // 0-100
  confidence: number  // 0-1
  reasoning: string[]
}

export interface ScoredAction {
  action: GameAction
  score: number           // 0-100, higher = better
  priority: number        // 0-100, higher = more urgent
  reasoning: string[]     // Human-readable explanation
}

export interface AIConfig {
  timeLimit: number
  maxActionsToConsider: number
  randomnessFactor: number
  difficulty: 'easy' | 'medium' | 'hard'
  personality: 'aggressive' | 'balanced' | 'defensive' | 'economic'
}

// Base classes for extensibility
export abstract class BaseActionGenerator implements ActionGenerator {
  abstract generate(_state: GameState, _playerId: PlayerId): GameAction[]
}

export abstract class BaseActionEvaluator implements ActionEvaluator {
  abstract priority: number
  abstract canEvaluate(_state: GameState, _action: GameAction): boolean
  abstract evaluate(_state: GameState, _action: GameAction): ActionScore
  
  protected combineScores(scores: ActionScore[]): ActionScore {
    if (scores.length === 0) {
      return { value: 0, confidence: 0, reasoning: ['No evaluators matched'] }
    }
    
    const totalConfidence = scores.reduce((sum, s) => sum + s.confidence, 0)
    const weightedValue = scores.reduce((sum, s) => sum + s.value * s.confidence, 0)
    
    return {
      value: Math.min(100, weightedValue / totalConfidence),
      confidence: Math.min(1.0, totalConfidence / scores.length),
      reasoning: scores.flatMap(s => s.reasoning)
    }
  }
}

export abstract class BasePhaseStrategy implements PhaseStrategy {
  abstract phase: GamePhase
  abstract generateActions(_state: GameState, _playerId: PlayerId): GameAction[]
  abstract selectBestAction(_actions: ScoredAction[]): GameAction
} 