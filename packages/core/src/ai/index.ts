// ===== MAIN AI SYSTEM EXPORTS =====

// Core AI coordinator and factory functions
export { 
  AICoordinator,
  createAIDecisionSystem,
  getBestActionForPlayer,
  getTopActionsForPlayer,
  getAIGoalInfo,
  getAIAnalysis
} from './ai-coordinator'

// Complete AI automation system
export { 
  AutoPlayer,
  type AutoPlayerConfig,
  type AutoPlayerStats,
  type TurnResult
} from './auto-player'

// AI interfaces and types
export type {
  ActionEvaluator,
  PhaseStrategy,
  ActionGenerator,
  ActionScore,
  ScoredAction,
  AIConfig
} from './types/ai-interfaces'

export {
  BaseActionGenerator,
  BaseActionEvaluator,
  BasePhaseStrategy
} from './types/ai-interfaces'

// Strategies
export { PhaseStrategies } from './strategies'
export {
  SetupPhaseStrategy,
  MainPhaseStrategy,
  RobberPhaseStrategy,
  StealPhaseStrategy,
  DiscardPhaseStrategy,
  RollPhaseStrategy
} from './strategies'

// Action generators
export { ActionGenerators } from './generators'
export {
  BuildingActionGenerator,
  BankTradeGenerator,
  PortTradeGenerator,
  DevelopmentCardGenerator,
  DevelopmentCardPlayGenerator,
  EndTurnGenerator
} from './generators'

// Action evaluators
export { ActionEvaluators } from './evaluators'
export {
  VictoryEvaluator,
  ProductionEvaluator,
  TradeEvaluator,
  ResourceEvaluator,
  DevelopmentCardEvaluator,
  SetupEvaluator
} from './evaluators'

// Utilities
export { ResourceAnalyzer } from './utils/resource-analyzer'
export { DiscardOptimizer } from './utils/discard-optimizer'

// Core AI components (for advanced usage)
export { createBoardAnalyzer, type BoardAnalyzer } from './board-analyzer'
export { createInitialPlacementAI } from './initial-placement'
export { 
  GoalManager, 
  ResourceManager, 
  TurnPlanner,
  type Goal,
  type TurnPlan
} from './goal-system'
export type { VictoryAnalysis } from './victory-optimizer'

// ===== CONVENIENCE EXPORTS =====

// Main entry points for common usage
export { getBestActionForPlayer as getAIAction } from './ai-coordinator'
export { createAIDecisionSystem as createActionDecisionEngine } from './ai-coordinator' 