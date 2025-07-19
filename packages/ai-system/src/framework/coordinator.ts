import { GameState, PlayerId } from '@settlers/game-engine'
import { 
  Decision, 
  DecisionContext, 
  DecisionTier, 
  PerformanceMetrics 
} from './types'

/**
 * Main AI Coordinator - Orchestrates all decision tiers
 * 
 * Decision Flow:
 * 1. Immediate Actions (no-brainer moves) - Fast execution
 * 2. Heuristic Decisions (pattern-based) - Medium speed
 * 3. MCTS Strategy (complex planning) - Slower, deeper analysis
 */
export class AICoordinator {
  private tiers: DecisionTier[] = []
  private decisionHistory: Decision[] = []
  private performanceTracker: PerformanceTracker

  constructor() {
    this.performanceTracker = new PerformanceTracker()
  }

  /**
   * Register a decision tier
   */
  registerTier(tier: DecisionTier): void {
    this.tiers.push(tier)
    // Sort by priority (highest first)
    this.tiers.sort((a, b) => b.priority - a.priority)
  }

  /**
   * Main decision-making method
   */
  async makeDecision(
    gameState: GameState, 
    playerId: PlayerId, 
    domain?: string,
    timeLimit: number = 5000
  ): Promise<Decision> {
    const startTime = Date.now()
    
    const context: DecisionContext = {
      gameState,
      playerId,
      timeLimit,
      domain
    }

    // Try each tier in priority order
    for (const tier of this.tiers) {
      if (!tier.canHandle(context)) {
        continue
      }

      try {
        const decision = await tier.decide(context)
        
        if (decision) {
          // Track execution time and store decision
          decision.executionTime = Date.now() - startTime
          this.decisionHistory.push(decision)
          
          // Update performance tracking
          this.performanceTracker.recordDecision(decision, context)
          
          console.log(`🤖 AI Decision (${tier.name}): ${decision.reasoning} [${decision.confidence.toFixed(2)} confidence]`)
          
          return decision
        }
      } catch (error) {
        console.warn(`❌ Tier ${tier.name} failed:`, error)
        // Continue to next tier
      }
    }

    // Fallback: End turn if no tier can handle the situation
    const fallbackDecision: Decision = {
      type: 'heuristic',
      action: { type: 'endTurn', playerId, data: {} },
      reasoning: 'No suitable action found - ending turn',
      confidence: 0.1,
      strategicGoal: 'FALLBACK',
      executionTime: Date.now() - startTime
    }

    this.decisionHistory.push(fallbackDecision)
    return fallbackDecision
  }

  /**
   * Get performance metrics for the current game
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return this.performanceTracker.getMetrics()
  }

  /**
   * Get decision history
   */
  getDecisionHistory(): Decision[] {
    return [...this.decisionHistory]
  }

  /**
   * Reset for new game
   */
  reset(): void {
    this.decisionHistory = []
    this.performanceTracker.reset()
  }
}

/**
 * Tracks AI performance during gameplay
 */
class PerformanceTracker {
  private decisions: Decision[] = []
  private startTime: number = Date.now()

  recordDecision(decision: Decision, context: DecisionContext): void {
    this.decisions.push(decision)
  }

  getMetrics(): PerformanceMetrics {
    const now = Date.now()
    const totalDecisions = this.decisions.length

    // Calculate decision distribution by tier
    const decisionsByTier: Record<string, number> = {}
    this.decisions.forEach(d => {
      decisionsByTier[d.type] = (decisionsByTier[d.type] || 0) + 1
    })

    // Calculate average confidence and thinking time
    const avgConfidence = totalDecisions > 0 
      ? this.decisions.reduce((sum, d) => sum + d.confidence, 0) / totalDecisions
      : 0

    const avgThinkingTime = totalDecisions > 0
      ? this.decisions.reduce((sum, d) => sum + (d.executionTime || 0), 0) / totalDecisions
      : 0

    return {
      gameOutcome: {
        finalScore: 0, // Will be filled by game simulator
        placement: 0,
        turnsToComplete: 0
      },
      resourceMetrics: {
        totalResourcesGenerated: 0,
        resourcesWasted: 0,
        efficiencyScore: 0,
        resourceUtilizationByType: {}
      },
      strategicMetrics: {
        orphanedRoads: [],
        unusedDevCards: [],
        missedOpportunities: [],
        strategicCoherence: 0
      },
      decisionMetrics: {
        averageConfidence: avgConfidence,
        decisionsByTier,
        averageThinkingTime: avgThinkingTime
      },
      improvementAreas: []
    }
  }

  reset(): void {
    this.decisions = []
    this.startTime = Date.now()
  }
} 