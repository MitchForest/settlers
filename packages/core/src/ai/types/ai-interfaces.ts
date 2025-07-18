import { GameState, GameAction, PlayerId, GamePhase } from '../../types'

// ===== CORE AI INTERFACES =====

export interface ActionEvaluator {
  canEvaluate(state: GameState, action: GameAction): boolean
  evaluate(state: GameState, action: GameAction): ActionScore
  priority: number // Determines evaluation order
}

export interface PhaseStrategy {
  phase: GamePhase
  generateActions(state: GameState, playerId: PlayerId): GameAction[]
  selectBestAction(actions: ScoredAction[]): GameAction
}

export interface ActionGenerator {
  generate(state: GameState, playerId: PlayerId): GameAction[]
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
  abstract generate(state: GameState, playerId: PlayerId): GameAction[]
}

export abstract class BaseActionEvaluator implements ActionEvaluator {
  abstract priority: number
  abstract canEvaluate(state: GameState, action: GameAction): boolean
  abstract evaluate(state: GameState, action: GameAction): ActionScore
  
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
  abstract generateActions(state: GameState, playerId: PlayerId): GameAction[]
  abstract selectBestAction(actions: ScoredAction[]): GameAction
} 