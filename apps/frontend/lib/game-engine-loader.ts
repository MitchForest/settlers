// Dynamic Game Engine Loader - Only loads heavy game logic when needed
/* eslint-disable @typescript-eslint/no-explicit-any */

import { logPackageLoad } from './package-loading-monitor'

let gameEnginePromise: Promise<any> | null = null
let aiSystemPromise: Promise<any> | null = null

// Cache for loaded modules
let gameEngineModule: any | null = null
let aiSystemModule: any | null = null

/**
 * Loads the game engine package dynamically when entering a game
 * This avoids loading ~300KB of game logic on the homepage
 */
export async function loadGameEngine(): Promise<any> {
  if (!gameEnginePromise) {
    logPackageLoad('game-engine', 'Game logic required')
    console.log('🎮 Loading game engine...')
    
    gameEnginePromise = import('@settlers/game-engine').then((module) => {
      console.log('✅ Game engine loaded successfully')
      gameEngineModule = module
      return gameEngineModule
    }).catch((error) => {
      console.warn('⚠️ Game engine not available:', error)
      // Return empty module for graceful degradation
      const emptyModule = {}
      gameEngineModule = emptyModule
      return emptyModule
    })
  }
  return gameEnginePromise
}

/**
 * Loads the AI system package dynamically when adding AI players
 * This avoids loading ~400KB of AI logic unless AI is actually used
 */
export async function loadAISystem(): Promise<any> {
  if (!aiSystemPromise) {
    logPackageLoad('ai-system', 'AI players detected')
    console.log('🤖 Loading AI system...')
    
    aiSystemPromise = import('@settlers/ai-system').then((module) => {
      console.log('✅ AI system loaded successfully')
      aiSystemModule = module
      return aiSystemModule
    }).catch((error) => {
      console.warn('⚠️ AI system not available:', error)
      // Return empty module for graceful degradation
      const emptyModule = {}
      aiSystemModule = emptyModule
      return emptyModule
    })
  }
  return aiSystemPromise
}

/**
 * Loads the core calculations package when needed
 * This is lighter but still only loaded when needed
 */
export async function loadCoreLite(): Promise<any> {
  // Use the main game engine for now, since game-engine-lite doesn't exist
  return loadGameEngine().catch(() => {
    console.warn('Core lite not available yet')
    return {}
  })
}

/**
 * Check if game engine is already loaded (synchronous)
 */
export function isGameEngineLoaded(): boolean {
  return gameEngineModule !== null
}

/**
 * Check if AI system is already loaded (synchronous)
 */
export function isAISystemLoaded(): boolean {
  return aiSystemModule !== null
}

/**
 * Get the cached game engine module if already loaded
 * Returns null if not loaded yet
 */
export function getCachedGameEngine(): any | null {
  return gameEngineModule
}

/**
 * Get the cached AI system module if already loaded
 * Returns null if not loaded yet
 */
export function getCachedAISystem(): any | null {
  return aiSystemModule
}

/**
 * Reset the loading state (useful for testing or reloading)
 */
export function resetLoaders() {
  gameEnginePromise = null
  aiSystemPromise = null
  gameEngineModule = null
  aiSystemModule = null
}

/**
 * React hook for loading game engine with loading states
 */
export function useGameEngine() {
  return {
    loadGameEngine,
    isLoaded: isGameEngineLoaded(),
    module: getCachedGameEngine()
  }
}

/**
 * React hook for loading AI system with loading states
 */
export function useAISystem() {
  return {
    loadAISystem,
    isLoaded: isAISystemLoaded(),
    module: getCachedAISystem()
  }
}

/**
 * Checks if AI players are present in the game
 */
export function hasAIPlayers(players: Array<{ isAI?: boolean }>): boolean {
  return players.some(player => player.isAI === true)
}

/**
 * Loads game engine types and runtime together
 */
export async function loadGameEngineWithTypes() {
  if (!gameEnginePromise) {
    console.log('🎮 Loading game engine with types...')
    gameEnginePromise = import('@settlers/game-engine' as string).catch(() => {
      console.warn('Game engine not available yet')
      return {}
    })
  }
  return gameEnginePromise
}

/**
 * Loads AI system with proper conditional logic
 */
export async function loadAISystemConditionally(players: Array<{ isAI?: boolean }>) {
  if (!hasAIPlayers(players)) {
    console.log('🚫 No AI players detected, skipping AI system load')
    return null
  }
  
  return loadAISystem()
}

/**
 * Load packages based on route and game state
 */
export function hasAIPlayersLegacy(players: unknown[]): boolean {
  return players.some((player: unknown) => {
    if (typeof player !== 'object' || player === null) return false
    
    const playerObj = player as Record<string, unknown>
    return (playerObj.playerType === 'ai') || (playerObj.isAI === true)
  })
}

/**
 * Load game packages based on actual game requirements
 * Only loads AI system if AI players are actually present
 */
export async function loadGamePackages(players: unknown[]) {
  console.log('🎮 Loading game engine...')
  const gameEnginePromise = loadGameEngine()
  
  const aiSystemPromise = hasAIPlayersLegacy(players) 
    ? loadAISystem()
    : Promise.resolve(null)
  
  const [gameEngine, aiSystem] = await Promise.all([
    gameEnginePromise,
    aiSystemPromise
  ])
  
  return { gameEngine, aiSystem }
}

/**
 * Creates an AI player with dynamic loading
 */
export async function createAIPlayer(config: unknown) {
  const [_gameEngine, aiSystem] = await Promise.all([
    loadGameEngine(),
    loadAISystem()
  ])
  
  return (aiSystem as { createAIPlayer: (config: unknown) => unknown }).createAIPlayer(config)
} 