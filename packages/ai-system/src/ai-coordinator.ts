import { GameState, GameAction, PlayerId, ResourceType, ResourceCards, BUILDING_COSTS } from '@settlers/game-engine'
import { BoardAnalyzer, createBoardAnalyzer } from './board-analyzer'
import { GoalManager, ResourceManager, TurnPlanner, Goal, TurnPlan } from './goal-system'
import { VictoryAnalysis } from './victory-optimizer'
import { 
  ActionEvaluator, 
  PhaseStrategy, 
  AIConfig, 
  ActionScore, 
  ScoredAction 
} from './types/ai-interfaces'
import { PhaseStrategies } from './strategies'
import { ActionEvaluators } from './evaluators'

export class AICoordinator {
  private goalManager: GoalManager
  private resourceManager: ResourceManager
  private turnPlanner: TurnPlanner
  private currentTurnPlan: TurnPlan | null = null
  
  constructor(
    private strategies: Map<string, PhaseStrategy>,
    private evaluators: ActionEvaluator[],
    private config: AIConfig,
    private analyzer: BoardAnalyzer,
    private playerId: PlayerId
  ) {
    // Sort evaluators by priority
    this.evaluators.sort((a, b) => b.priority - a.priority)
    
    // Initialize goal system
    this.goalManager = new GoalManager(playerId)
    this.resourceManager = new ResourceManager()
    this.turnPlanner = new TurnPlanner(this.goalManager, this.resourceManager)
  }

  async getAction(state: GameState, playerId: PlayerId): Promise<GameAction> {
    // Use goal-driven decision making for main game phases
    if (state.phase === 'actions') {
      return this.getGoalDrivenAction(state, playerId)
    }
    
    // Fall back to traditional strategy for other phases
    const strategy = this.strategies.get(state.phase)
    if (!strategy) {
      throw new Error(`No strategy for phase: ${state.phase}`)
    }

    // 1. Generate possible actions for current phase
    const possibleActions = strategy.generateActions(state, playerId)
    
    if (possibleActions.length === 0) {
      throw new Error(`No actions generated for phase: ${state.phase}`)
    }

    // 2. Score each action using evaluator chain
    const scoredActions = possibleActions.map(action => {
      const actionScore = this.evaluateAction(state, action)
      return {
        action,
        score: Math.round(actionScore.value * actionScore.confidence),
        priority: Math.round(actionScore.value * actionScore.confidence),
        reasoning: actionScore.reasoning
      }
    })
    
    // 3. Apply strategy-specific selection
    return strategy.selectBestAction(scoredActions)
  }
  
  private getGoalDrivenAction(state: GameState, playerId: PlayerId): GameAction {
    // 1. Plan the turn using goal system
    this.currentTurnPlan = this.turnPlanner.planTurn(state, playerId)
    
    // 2. COMPREHENSIVE AI PERFORMANCE LOGGING
    const player = state.players.get(playerId)!
    const resourceTotal = Object.values(player.resources).reduce((sum, n) => sum + n, 0)
    
    console.log(`\n🤖 === AI TURN ${state.turn} ANALYSIS (${playerId}) ===`)
    console.log(`🏆 Current VP: ${player.score.total}/10`)
    console.log(`💎 Resources: ${resourceTotal} total (${JSON.stringify(player.resources)})`)
    console.log(`🏠 Buildings: ${player.buildings.settlements} settlements, ${player.buildings.cities} cities, ${player.buildings.roads} roads`)
    
    if (this.currentTurnPlan.goal) {
      console.log(`🎯 AI Goal: ${this.currentTurnPlan.goal.description}`)
      console.log(`📊 Priority: ${this.currentTurnPlan.goal.priority}`)
      console.log(`💡 Strategy: ${this.currentTurnPlan.resourceStrategy}`)
      console.log(`📝 Planned Actions: ${this.currentTurnPlan.actions.length}`)
      
      // Log victory analysis if available
      const victoryAnalysis = this.goalManager.getCurrentVictoryAnalysis()
      if (victoryAnalysis) {
        console.log(`🏆 Victory Path: ${victoryAnalysis.fastestPath.description}`)
        console.log(`⏱️ Target Turns: ${victoryAnalysis.fastestPath.targetTurns}`)
        console.log(`🎲 Efficiency: ${victoryAnalysis.fastestPath.efficiency.toFixed(2)} VP/turn`)
      }
    } else {
      console.log(`⚠️ NO GOAL SET - AI may be stuck`)
    }
    
    // 3. Try to execute planned actions - BE MORE AGGRESSIVE
    for (const plannedAction of this.currentTurnPlan.actions) {
      console.log(`🔍 Checking planned action: ${plannedAction.action.type} - ${plannedAction.reason}`)
      
      if (this.canExecuteAction(plannedAction.action, state)) {
        console.log(`✅ Executing planned action: ${plannedAction.reason}`)
        return plannedAction.action
      } else {
        console.log(`❌ Cannot execute planned action: ${plannedAction.reason}`)
      }
    }
    
    // 3.5. If no planned actions work, try goal-specific fallbacks
    if (this.currentTurnPlan.goal) {
      const goalFallback = this.getGoalFallbackAction(state, playerId, this.currentTurnPlan.goal)
      if (goalFallback) {
        console.log(`🔄 Using goal fallback action: ${goalFallback.type}`)
        return goalFallback
      }
    }
    
    // 4. CRITICAL FIX: If goal system says "should trade" but provides endTurn, 
    //    fall back to normal action selection which will find the trades
    if (this.currentTurnPlan.actions.length > 0) {
      const goalAction = this.currentTurnPlan.actions[0]
      console.log(`🔍 Checking goal action: type=${goalAction.action.type}, reason="${goalAction.reason}"`)
      if (goalAction.action.type === 'endTurn' && goalAction.reason.includes('should trade')) {
        console.log(`🔄 Goal system says "should trade" but suggested endTurn - falling back to normal action selection`)
        return this.getFallbackAction(state, playerId)
      }
    }
    
    // 5. Fall back to traditional action generation if no planned actions work
    return this.getFallbackAction(state, playerId)
  }
  
  private getFallbackAction(state: GameState, playerId: PlayerId): GameAction {
    const strategy = this.strategies.get(state.phase)
    if (!strategy) {
      return { type: 'endTurn', playerId, data: {} }
    }

    const possibleActions = strategy.generateActions(state, playerId)
    if (possibleActions.length === 0) {
      return { type: 'endTurn', playerId, data: {} }
    }

    const scoredActions = possibleActions.map(action => {
      const actionScore = this.evaluateAction(state, action)
      return {
        action,
        score: Math.round(actionScore.value * actionScore.confidence),
        priority: Math.round(actionScore.value * actionScore.confidence),
        reasoning: actionScore.reasoning
      }
    })
    
    return strategy.selectBestAction(scoredActions)
  }
  
  private getGoalFallbackAction(state: GameState, playerId: PlayerId, goal: Goal): GameAction | null {
    // Goal-specific fallback actions when planned actions can't execute
    
    if (goal.type === 'victory' && goal.description.includes('settlement')) {
      // If settlement goal fails, try to trade for missing resources
      const player = state.players.get(playerId)!
      const settlementCost = BUILDING_COSTS.settlement
      
      for (const [resource, needed] of Object.entries(settlementCost)) {
        const have = player.resources[resource as ResourceType] || 0
        if (have < needed) {
          // Try to trade for this resource
          const tradeActions = this.generateTradeActionsForResource(state, playerId, resource as ResourceType)
          if (tradeActions.length > 0) {
            console.log(`🔄 Settlement goal fallback: trading for ${resource}`)
            return tradeActions[0]
          }
        }
      }
    }
    
    if (goal.type === 'victory' && goal.description.includes('city')) {
      // If city goal fails, try to trade for missing resources
      const player = state.players.get(playerId)!
      const cityCost = BUILDING_COSTS.city
      
      for (const [resource, needed] of Object.entries(cityCost)) {
        const have = player.resources[resource as ResourceType] || 0
        if (have < needed) {
          // Try to trade for this resource
          const tradeActions = this.generateTradeActionsForResource(state, playerId, resource as ResourceType)
          if (tradeActions.length > 0) {
            console.log(`🔄 City goal fallback: trading for ${resource}`)
            return tradeActions[0]
          }
        }
      }
    }
    
    return null // No specific fallback available
  }
  
  private generateTradeActionsForResource(state: GameState, playerId: PlayerId, targetResource: ResourceType): GameAction[] {
    const player = state.players.get(playerId)!
    const actions: GameAction[] = []
    
    // Try bank trades (4:1)
    const resourceTypes = ['wood', 'brick', 'ore', 'wheat', 'sheep'] as const
    for (const resource of resourceTypes) {
      if (resource === targetResource) continue
      if (player.resources[resource] >= 4) {
        actions.push({
          type: 'bankTrade',
          playerId,
          data: {
            offering: { [resource]: 4 },
            requesting: { [targetResource]: 1 }
          }
        })
      }
    }
    
    // Try port trades (3:1 or 2:1) - would need port detection logic
    // Simplified for now
    
    return actions
  }
  
  private canExecuteAction(action: GameAction, state: GameState): boolean {
    const player = state.players.get(action.playerId)!
    
    if (action.type === 'build') {
      const buildingType = action.data.buildingType
      const position = action.data.position
      
      if (buildingType === 'city') {
        // Layer 2: State validation - ensure settlement exists at target location
        if (position) {
          const vertex = state.board.vertices.get(position)
          
          if (!vertex?.building) {
            console.log(`🚫 AI Action Blocked: No building at ${position} for city upgrade`)
            return false
          }
          if (vertex.building.type !== 'settlement') {
            console.log(`🚫 AI Action Blocked: Cannot upgrade ${vertex.building.type} to city at ${position}`)
            return false
          }
          if (vertex.building.owner !== action.playerId) {
            console.log(`🚫 AI Action Blocked: Cannot upgrade opponent's building at ${position}`)
            return false
          }
          
          console.log(`✅ AI Action Validated: City upgrade at ${position} is valid`)
        }
        
        // Layer 3: Building inventory validation
        if (player.buildings.cities <= 0) {
          console.log(`🚫 AI Action Blocked: ${action.playerId} has no cities remaining`)
          return false
        }
        
        return true
        
      } else if (buildingType === 'settlement') {
        // AGGRESSIVE FIX: Minimal validation - let game engine handle everything
        // This prevents AI from getting stuck when it could trade for resources
        
        // Only check building inventory (not resources or placement rules)
        if (player.buildings.settlements <= 0) {
          console.log(`🚫 AI Action Blocked: ${action.playerId} has no settlements remaining`)
          return false
        }
        
        console.log(`✅ AI Action Allowed: Settlement build (let game engine validate)`)
        return true
        
      } else if (buildingType === 'road') {
        // AGGRESSIVE FIX: Minimal validation - let game engine handle everything
        
        // Only check building inventory (not resources or placement rules)
        if (player.buildings.roads <= 0) {
          console.log(`🚫 AI Action Blocked: ${action.playerId} has no roads remaining`)
          return false
        }
        
        console.log(`✅ AI Action Allowed: Road build (let game engine validate)`)
        return true
      }
      
    } else if (action.type === 'buyCard') {
      const devCardCost = { wood: 0, brick: 0, ore: 1, wheat: 1, sheep: 1 }
      return this.hasResources(player.resources, devCardCost)
    } else if (action.type === 'bankTrade') {
      const offering = action.data.offering || {}
      return Object.entries(offering).every(([resource, amount]) => 
        player.resources[resource as ResourceType] >= (amount as number)
      )
    } else if (action.type === 'portTrade') {
      const offering = action.data.offering || {}
      return Object.entries(offering).every(([resource, amount]) => 
        player.resources[resource as ResourceType] >= (amount as number)
      )
    }
    
    return true // Default to allowing action
  }

  private hasResources(playerResources: ResourceCards, requiredResources: ResourceCards): boolean {
    return Object.entries(requiredResources).every(([resource, required]) => 
      playerResources[resource as ResourceType] >= (required as number)
    )
  }

  private evaluateAction(state: GameState, action: GameAction): ActionScore {
    const scores: ActionScore[] = []
    
    // Run through evaluator chain
    for (const evaluator of this.evaluators) {
      if (evaluator.canEvaluate(state, action)) {
        scores.push(evaluator.evaluate(state, action))
      }
    }
    
    // Combine scores (weighted by confidence)
    return this.combineScores(scores)
  }

  private combineScores(scores: ActionScore[]): ActionScore {
    if (scores.length === 0) {
      return { value: 0, confidence: 0, reasoning: ['No evaluators matched'] }
    }
    
    const totalConfidence = scores.reduce((sum, s) => sum + s.confidence, 0)
    const weightedValue = scores.reduce((sum, s) => sum + s.value * s.confidence, 0)
    
    return {
      value: Math.min(100, weightedValue / totalConfidence),
      confidence: Math.min(1.0, totalConfidence / scores.length),
      reasoning: scores.flatMap(s => s.reasoning)
    }
  }

  // Public method for synchronous usage
  getActionSync(state: GameState, playerId: PlayerId): GameAction | null {
    try {
      // Use goal-driven decision making for main game phases
      if (state.phase === 'actions') {
        return this.getGoalDrivenAction(state, playerId)
      }
      
      // Fall back to traditional strategy for other phases
      const strategy = this.strategies.get(state.phase)
      if (!strategy) return null
      
      const actions = strategy.generateActions(state, playerId)
      if (actions.length === 0) return null
      
      const scoredActions = actions.map(action => {
        const actionScore = this.evaluateAction(state, action)
        return { 
          action, 
          score: Math.round(actionScore.value * actionScore.confidence),
          priority: Math.round(actionScore.value * actionScore.confidence),
          reasoning: actionScore.reasoning
        }
      })
      
      return strategy.selectBestAction(scoredActions)
    } catch (error) {
      console.error('AI decision error:', error)
      return null
    }
  }
  
  // Public method to get current goal information
  getCurrentGoal(): Goal | null {
    return this.currentTurnPlan?.goal || null
  }
  
  // Public method to get all active goals
  getActiveGoals(): Goal[] {
    return this.goalManager.getActiveGoals()
  }
  
  // Public method to get victory analysis
  getVictoryAnalysis(): VictoryAnalysis | null {
    return this.goalManager.getCurrentVictoryAnalysis()
  }
  
  // Public method to get multi-turn plan
  getMultiTurnPlan(): unknown {
    return this.goalManager.getMultiTurnPlan()
  }
  
  // Legacy interface methods for backward compatibility
  getBestAction(): GameAction | null {
    // This would need the current state passed in, but for now return null
    // The proper usage is getActionSync(state, playerId)
    return null
  }
  
  getAllScoredActions(): ScoredAction[] {
    // This would need the current state passed in, but for now return empty array
    // The proper usage is getBestActionForPlayer(state, playerId)
    return []
  }
}

// ===== FACTORY FUNCTION =====

export function createAIDecisionSystem(
  gameState: GameState,
  playerId: PlayerId,
  difficulty: 'easy' | 'medium' | 'hard' = 'medium',
  personality: 'aggressive' | 'balanced' | 'defensive' | 'economic' = 'balanced'
): AICoordinator {
  // Configure strategies for each phase
  const strategies = PhaseStrategies.createAll()
  
  // Configure evaluators based on difficulty/personality
  const evaluators: ActionEvaluator[] = [
    new ActionEvaluators.SetupEvaluator(),
    new ActionEvaluators.VictoryEvaluator(),
    new ActionEvaluators.ProductionEvaluator(),
    new ActionEvaluators.DevelopmentCardEvaluator(),
    new ActionEvaluators.TradeEvaluator(),
    new ActionEvaluators.ResourceEvaluator()
  ]
  
  const config: AIConfig = {
    timeLimit: difficulty === 'easy' ? 100 : 500,
    maxActionsToConsider: difficulty === 'easy' ? 10 : 50,
    randomnessFactor: difficulty === 'easy' ? 0.2 : 0.05,
    difficulty,
    personality
  }
  
  const analyzer = createBoardAnalyzer(gameState)
  
  return new AICoordinator(strategies, evaluators, config, analyzer, playerId)
}

// ===== CLEAN PUBLIC API =====

export function getBestActionForPlayer(
  gameState: GameState, 
  playerId: PlayerId,
  difficulty: 'easy' | 'medium' | 'hard' = 'medium',
  personality: 'aggressive' | 'balanced' | 'defensive' | 'economic' = 'balanced'
): GameAction | null {
  const ai = createAIDecisionSystem(gameState, playerId, difficulty, personality)
  return ai.getActionSync(gameState, playerId)
}

export function getTopActionsForPlayer(
  gameState: GameState, 
  playerId: PlayerId,
  difficulty: 'easy' | 'medium' | 'hard' = 'medium',
  personality: 'aggressive' | 'balanced' | 'defensive' | 'economic' = 'balanced',
  count: number = 5
): ScoredAction[] {
  try {
    const ai = createAIDecisionSystem(gameState, playerId, difficulty, personality)
    const strategies = (ai as unknown as { strategies: Map<string, PhaseStrategy> }).strategies
    const evaluateAction = (ai as unknown as { evaluateAction: (state: GameState, action: GameAction) => ActionScore }).evaluateAction.bind(ai)
    
    const strategy = strategies.get(gameState.phase)
    if (!strategy) return []
    
    const actions = strategy.generateActions(gameState, playerId)
    const scoredActions = actions.map(action => {
      const actionScore = evaluateAction(gameState, action)
      return { 
        action, 
        score: Math.round(actionScore.value * actionScore.confidence),
        priority: Math.round(actionScore.value * actionScore.confidence),
        reasoning: actionScore.reasoning
      }
    })
    
    return scoredActions
      .sort((a, b) => b.score - a.score)
      .slice(0, count)
  } catch (error) {
    console.error('AI decision error:', error)
    return []
  }
}

// New function to get AI's current goal information
export function getAIGoalInfo(
  gameState: GameState,
  playerId: PlayerId,
  difficulty: 'easy' | 'medium' | 'hard' = 'medium',
  personality: 'aggressive' | 'balanced' | 'defensive' | 'economic' = 'balanced'
): { currentGoal: Goal | null; allGoals: Goal[] } {
  const ai = createAIDecisionSystem(gameState, playerId, difficulty, personality)
  return {
    currentGoal: ai.getCurrentGoal(),
    allGoals: ai.getActiveGoals()
  }
}

// New function to get comprehensive AI analysis
export function getAIAnalysis(
  gameState: GameState,
  playerId: PlayerId,
  difficulty: 'easy' | 'medium' | 'hard' = 'medium',
  personality: 'aggressive' | 'balanced' | 'defensive' | 'economic' = 'balanced'
): { 
  goals: { currentGoal: Goal | null; allGoals: Goal[] },
  victoryAnalysis: VictoryAnalysis | null,
  multiTurnPlan: unknown
} {
  const ai = createAIDecisionSystem(gameState, playerId, difficulty, personality)
  return {
    goals: {
      currentGoal: ai.getCurrentGoal(),
      allGoals: ai.getActiveGoals()
    },
    victoryAnalysis: ai.getVictoryAnalysis(),
    multiTurnPlan: ai.getMultiTurnPlan()
  }
}

// Export alias for backward compatibility
export { createAIDecisionSystem as createActionDecisionEngine } 