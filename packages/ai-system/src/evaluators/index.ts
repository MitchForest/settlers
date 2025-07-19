import { VictoryEvaluator } from './victory-evaluator'
import { ProductionEvaluator } from './production-evaluator'
import { TradeEvaluator } from './trade-evaluator'
import { 
  ResourceEvaluator, 
  DevelopmentCardEvaluator, 
  SetupEvaluator 
} from './resource-evaluator'

export { VictoryEvaluator } from './victory-evaluator'
export { ProductionEvaluator } from './production-evaluator'
export { TradeEvaluator } from './trade-evaluator'
export { 
  ResourceEvaluator, 
  DevelopmentCardEvaluator, 
  SetupEvaluator 
} from './resource-evaluator'

// Convenience export for all evaluators
export const ActionEvaluators = {
  VictoryEvaluator,
  ProductionEvaluator,
  TradeEvaluator,
  ResourceEvaluator,
  DevelopmentCardEvaluator,
  SetupEvaluator
} as const 