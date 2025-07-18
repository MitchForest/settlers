import { BuildingActionGenerator } from './building-generator'
import { BankTradeGenerator, PortTradeGenerator } from './trade-generator'
import { 
  DevelopmentCardGenerator, 
  DevelopmentCardPlayGenerator,
  EndTurnGenerator 
} from './dev-card-generator'

export { BuildingActionGenerator } from './building-generator'
export { BankTradeGenerator, PortTradeGenerator } from './trade-generator'
export { 
  DevelopmentCardGenerator, 
  DevelopmentCardPlayGenerator,
  EndTurnGenerator 
} from './dev-card-generator'

// Convenience export for all generators
export const ActionGenerators = {
  BuildingActionGenerator,
  BankTradeGenerator,
  PortTradeGenerator,
  DevelopmentCardGenerator,
  DevelopmentCardPlayGenerator,
  EndTurnGenerator
} as const 