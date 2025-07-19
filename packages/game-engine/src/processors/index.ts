// ===== CORE PROCESSOR ARCHITECTURE =====
// Re-export everything from processor-base to maintain API compatibility

export * from './processor-base'

// ===== REGISTRY EXPORTS =====
export { processAction, createActionProcessor, ProcessorRegistry } from './processor-registry' 