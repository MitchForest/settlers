// Export only the necessary types and functions for the new event-sourced architecture
export * from './types'
export * from './constants'
export * from './calculations'

// Export game engine components (still needed for actual game play)
export * from './engine'

// Export geometry utilities
export * from './geometry/honeycomb-bridge'

// Export lobby types for frontend components
export * from './lobby-types'

// Remove lobby exports - now handled by event sourcing
// export * from './lobby' // ❌ Old lobby manager - removed 