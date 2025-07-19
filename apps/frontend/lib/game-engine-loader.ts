// Dynamic Game Engine Loader - Only loads heavy game logic when needed

let gameEnginePromise: Promise<unknown> | null = null
let aiSystemPromise: Promise<unknown> | null = null

/**
 * Loads the game engine package dynamically when entering a game
 * This avoids loading ~300KB of game logic on the homepage
 */
export async function loadGameEngine() {
  if (!gameEnginePromise) {
    console.log('🎮 Loading game engine...')
    // Dynamic import will be resolved at runtime when packages are built
    gameEnginePromise = import('@settlers/game-engine' as string).catch(() => {
      console.warn('Game engine not available yet')
      return {}
    })
  }
  return gameEnginePromise
}

/**
 * Loads the AI system package dynamically when adding AI players
 * This avoids loading ~400KB of AI logic unless AI is actually used
 */
export async function loadAISystem() {
  if (!aiSystemPromise) {
    console.log('🤖 Loading AI system...')
    aiSystemPromise = import('@settlers/ai-system' as string).catch(() => {
      console.warn('AI system not available yet')
      return {}
    })
  }
  return aiSystemPromise
}

/**
 * Loads the core calculations package when needed
 * This is lighter but still only loaded when needed
 */
export async function loadCoreLite() {
  // Use the main game engine for now, since game-engine-lite doesn't exist
  return loadGameEngine().catch(() => {
    console.warn('Core lite not available yet')
    return {}
  })
}

/**
 * Checks if AI players are present in the game
 */
export function hasAIPlayers(players: unknown[]): boolean {
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
  
  const aiSystemPromise = hasAIPlayers(players) 
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