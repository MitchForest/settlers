export const gameConfig = {
  // Turn timing
  defaultTurnTimeMs: 120000,     // 2 minutes
  aiThinkingTimeMs: {
    easy: 2000,                  // 2 seconds
    medium: 3000,                // 3 seconds  
    hard: 1000                   // 1 second (quick decisions)
  },
  maxActionsPerTurn: 20,
  
  // Game limits
  maxPlayersPerGame: 4,
  maxSpectatorsPerGame: 10,
  maxGamesPerServer: 100,
  
  // Timeouts
  disconnectionTimeoutMs: 300000,  // 5 minutes
  gameTimeoutMs: 14400000,        // 4 hours
  reconnectionTimeoutMs: 600000,  // 10 minutes
  
  // AI settings
  maxAIPlayersPerGame: 3,
  aiActionDelayRange: [1000, 5000] as [number, number],
  
  // Performance
  gameStateCleanupIntervalMs: 300000,  // 5 minutes
  maxCachedGames: 50,
  eventsBatchSize: 100,
  
  // Phase-specific timeouts
  phaseTimeouts: {
    setup1: 180000,              // 3 minutes for initial placement
    setup2: 180000,              // 3 minutes for second placement
    roll: 30000,                 // 30 seconds to roll dice
    actions: 120000,             // 2 minutes for main actions
    discard: 60000,              // 1 minute to discard cards
    moveRobber: 60000,           // 1 minute to move robber
    steal: 30000                 // 30 seconds to steal
  }
} as const

export type GameConfig = typeof gameConfig

// Helper functions for configuration
export function getTurnTimeout(phase: keyof typeof gameConfig.phaseTimeouts): number {
  return gameConfig.phaseTimeouts[phase] || gameConfig.defaultTurnTimeMs
}

export function getAIThinkingTime(difficulty: 'easy' | 'medium' | 'hard'): number {
  return gameConfig.aiThinkingTimeMs[difficulty]
}

export function isValidGameConfig(): boolean {
  return (
    gameConfig.defaultTurnTimeMs > 0 &&
    gameConfig.maxPlayersPerGame >= 2 &&
    gameConfig.maxPlayersPerGame <= 6 &&
    gameConfig.maxAIPlayersPerGame < gameConfig.maxPlayersPerGame
  )
} 