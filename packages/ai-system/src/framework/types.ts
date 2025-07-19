import { GameState, GameAction, PlayerId } from '@settlers/game-engine'

// ===== DECISION FRAMEWORK TYPES =====

export interface Decision {
  type: 'immediate' | 'heuristic' | 'mcts'
  action: GameAction
  reasoning: string
  confidence: number // 0-1
  strategicGoal?: string
  executionTime?: number // milliseconds
}

export interface DecisionContext {
  gameState: GameState
  playerId: PlayerId
  timeLimit?: number
  domain?: string // e.g., 'initial_placement', 'trade_evaluation'
}

export interface DecisionTier {
  name: string
  priority: number // Higher = earlier execution
  canHandle(context: DecisionContext): boolean
  decide(context: DecisionContext): Promise<Decision | null>
}

// ===== PERFORMANCE METRICS =====

export interface PerformanceMetrics {
  // Game outcome metrics
  gameOutcome: {
    finalScore: number
    placement: number // 1st, 2nd, 3rd, 4th
    turnsToComplete: number
    winRate?: number // From multiple games
  }
  
  // Resource efficiency
  resourceMetrics: {
    totalResourcesGenerated: number
    resourcesWasted: number // End-game leftovers
    efficiencyScore: number // 0-1
    resourceUtilizationByType: Record<string, number>
  }
  
  // Strategic coherence
  strategicMetrics: {
    orphanedRoads: string[] // Roads not leading to settlements
    unusedDevCards: string[] // Cards held too long
    missedOpportunities: string[] // Could build but didn't
    strategicCoherence: number // 0-1, moves working together
  }
  
  // Decision quality
  decisionMetrics: {
    averageConfidence: number
    decisionsByTier: Record<string, number>
    averageThinkingTime: number
    optimalityScore?: number // Compared to perfect play
  }
  
  // Specific errors/improvements
  improvementAreas: string[]
}

// ===== MODULE INTERFACES =====

export interface AIModule {
  name: string
  domain: string // e.g., 'initial_placement', 'trade_evaluation'
  
  canHandle(context: DecisionContext): boolean
  decide(context: DecisionContext): Promise<Decision>
  
  // For testing and evaluation
  getTestScenarios?(): TestScenario[]
  validateDecision?(decision: Decision, context: DecisionContext): boolean
}

export interface TestScenario {
  id: string
  description: string
  gameState: GameState
  expectedDecisionType?: string
  expectedConfidence?: number
  expertRating?: number // 1-10 for comparison
}

// ===== EVALUATION INTERFACES =====

export interface EvaluationResult {
  moduleId: string
  scenarioId: string
  decision: Decision
  performance: {
    correctness: number // 0-1
    efficiency: number // 0-1
    strategicSoundness: number // 0-1
  }
  comparison?: {
    expertRating: number
    aiRating: number
    delta: number
  }
}

export interface BenchmarkResult {
  moduleId: string
  totalScenarios: number
  averagePerformance: {
    correctness: number
    efficiency: number
    strategicSoundness: number
    confidence: number
  }
  performanceByDifficulty: Record<string, number>
  improvementRecommendations: string[]
}

// ===== SIMULATION TYPES =====

export interface SimulationConfig {
  playerCount: 3 | 4
  gameCount: number
  aiConfigs: AIPlayerConfig[]
  boardConfigs?: string[] // Different board types to test
  timeLimit?: number
}

export interface AIPlayerConfig {
  playerId: string
  difficulty: 'easy' | 'medium' | 'hard'
  personality: 'aggressive' | 'balanced' | 'defensive' | 'economic'
  modules: string[] // Which AI modules to use
}

export interface SimulationResult {
  config: SimulationConfig
  games: GameResult[]
  aggregateMetrics: {
    winRates: Record<string, number>
    averageScores: Record<string, number>
    performanceByModule: Record<string, PerformanceMetrics>
  }
  insights: string[]
}

export interface GameResult {
  gameId: string
  winner: PlayerId
  finalScores: Record<PlayerId, number>
  turns: number
  playerMetrics: Record<PlayerId, PerformanceMetrics>
  keyDecisions: Decision[] // Important decisions for analysis
} 