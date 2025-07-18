// ===== NEW MODULAR ACTION PROCESSOR ARCHITECTURE =====
// ZERO TECHNICAL DEBT - Clean, type-safe, extensible design

import { GameState, GameAction } from '../types'
import { ProcessResult } from './processors/index'
import { ProcessorRegistry } from './processors/processor-registry'

// ===== MAIN ENTRY POINT =====

/**
 * Process any game action using the new modular architecture
 * 
 * This replaces the old 1,372-line monolithic action-processor.ts
 * with a clean, extensible, type-safe system of individual processors.
 * 
 * @param state - Current game state
 * @param action - Action to process
 * @returns ProcessResult with success, new state, events, and optional error
 */
export function processAction(
  state: GameState,
  action: GameAction
): ProcessResult {
  const registry = new ProcessorRegistry(state.id)
  return registry.processAction(state, action)
}

// Re-export types for external usage
export type { ProcessResult } from './processors/index'

// Factory function for creating a reusable processor registry
export function createActionProcessor(gameId: string): ProcessorRegistry {
  return new ProcessorRegistry(gameId)
}

/**
 * MIGRATION STRATEGY:
 * 
 * 1. Create individual processors for each action type
 * 2. Test each processor independently  
 * 3. Gradually migrate game-flow.ts and other files to use new system
 * 4. Remove old action-processor.ts when migration is complete
 * 
 * BENEFITS OF NEW ARCHITECTURE:
 * 
 * ✅ Single Responsibility: Each processor handles one action type
 * ✅ Open/Closed: Easy to add new processors without modifying existing code
 * ✅ Type Safety: Each processor is strongly typed for its action
 * ✅ Testability: Individual processors can be unit tested in isolation
 * ✅ Maintainability: ~80 lines per processor vs 1,372-line monolith
 * ✅ Reusability: Processors can be reused across different game modes
 * ✅ Extensibility: Easy to add features like action queuing, undo/redo
 */ 