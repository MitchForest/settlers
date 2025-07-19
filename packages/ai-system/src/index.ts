// AI System - Only loaded when AI players are added to games
export * from './auto-player'
export * from './ai-coordinator'  
export * from './goal-system'
export * from './initial-placement'

// Lightweight AI interface for lobby
export interface AIPlayerConfig {
  difficulty: 'easy' | 'medium' | 'hard'
  personality: 'aggressive' | 'balanced' | 'defensive' | 'economic'
  autoPlay: boolean
  thinkingTimeMs: number
}

// Factory function for creating AI players
export async function createAIPlayer(config: AIPlayerConfig) {
  // Implementation will be added when needed
  return null
} 