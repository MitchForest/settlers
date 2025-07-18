// Export only the necessary types and functions for the new event-sourced architecture
export * from './types'
export * from './constants'
export * from './calculations'

// Export game engine components (still needed for actual game play)
export * from './engine'

// Export AI system (for AI vs human gameplay)
export * from './ai'

// Export geometry utilities
export * from './geometry/honeycomb-bridge'

// Export lobby types for frontend components
export * from './lobby-types'

// Export unified error handling system
export * from './shared/errors'

// Export comprehensive validation system
export * from './shared/validation' 