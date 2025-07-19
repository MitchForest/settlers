import { GameState, GameAction } from '../types'
import { 
  ActionProcessor, 
  ProcessResult, 
  StateManager, 
  EventFactory, 
  PostProcessorChain,
  VictoryChecker,
  LongestRoadUpdater,
  LargestArmyUpdater
} from './index'
import { RollDiceProcessor } from './roll-dice-processor'
import { BuildingProcessor } from './building-processor'
import { RoadProcessor } from './road-processor'
import { EndTurnProcessor } from './end-turn-processor'
import { BuildActionProcessor } from './build-action-processor'
import { MoveRobberProcessor } from './move-robber-processor'
import { StealResourceProcessor } from './steal-resource-processor'
import { DiscardProcessor } from './discard-processor'
import { BuyCardProcessor } from './buy-card-processor'
import { BankTradeProcessor } from './bank-trade-processor'
import { PortTradeProcessor } from './port-trade-processor'
import { CreateTradeOfferProcessor, AcceptTradeProcessor, RejectTradeProcessor, CancelTradeProcessor } from './player-trade-processor'
import { PlayCardProcessor } from './play-card-processor'

export class ProcessorRegistry {
  private processors: ActionProcessor[] = []
  private stateManager: StateManager
  private eventFactory: EventFactory
  private postProcessor: PostProcessorChain

  constructor(gameId: string) {
    // Initialize core services
    this.stateManager = new StateManager()
    this.eventFactory = new EventFactory(gameId)
    this.postProcessor = new PostProcessorChain()
      .add(new VictoryChecker())
      .add(new LongestRoadUpdater())
      .add(new LargestArmyUpdater())

    // Register all processors
    this.registerProcessors()
  }

  processAction(state: GameState, action: GameAction): ProcessResult {
    // Find the appropriate processor
    const processor = this.processors.find(p => p.canProcess(action))
    
    if (!processor) {
      return {
        success: false,
        newState: state,
        events: [],
        error: `No processor found for action type: ${action.type}`
      }
    }

    // Execute the action
    return processor.execute(state, action)
  }

  private registerProcessors(): void {
    // Core game action processors
    this.processors.push(
      new RollDiceProcessor(this.stateManager, this.eventFactory, this.postProcessor),
      new BuildingProcessor(this.stateManager, this.eventFactory, this.postProcessor),
      new RoadProcessor(this.stateManager, this.eventFactory, this.postProcessor),
      new BuildActionProcessor(this.stateManager, this.eventFactory, this.postProcessor),
      new EndTurnProcessor(this.stateManager, this.eventFactory, this.postProcessor),
      new MoveRobberProcessor(this.stateManager, this.eventFactory, this.postProcessor),
      new StealResourceProcessor(this.stateManager, this.eventFactory, this.postProcessor),
      new DiscardProcessor(this.stateManager, this.eventFactory, this.postProcessor),
      new BuyCardProcessor(),
      new BankTradeProcessor(this.stateManager, this.eventFactory, this.postProcessor),
      new PortTradeProcessor(this.stateManager, this.eventFactory, this.postProcessor),
      new CreateTradeOfferProcessor(this.stateManager, this.eventFactory, this.postProcessor),
      new AcceptTradeProcessor(this.stateManager, this.eventFactory, this.postProcessor),
      new RejectTradeProcessor(this.stateManager, this.eventFactory, this.postProcessor),
      new CancelTradeProcessor(this.stateManager, this.eventFactory, this.postProcessor),
      new PlayCardProcessor(this.stateManager, this.eventFactory, this.postProcessor)
      // Core game processors complete!
    )
  }

  // For testing and debugging
  getProcessorForAction(actionType: string): ActionProcessor | undefined {
    return this.processors.find(p => p.actionType === actionType)
  }

  getAllProcessors(): ActionProcessor[] {
    return [...this.processors]
  }
}

// ===== MAIN ENTRY POINT =====

// This replaces the old processAction function with a clean, modular approach
export function createActionProcessor(gameId: string) {
  return new ProcessorRegistry(gameId)
}

// Legacy compatibility wrapper - will be removed after migration
export function processAction(state: GameState, action: GameAction): ProcessResult {
  const registry = new ProcessorRegistry(state.id)
  return registry.processAction(state, action)
} 