import { GameState, GameAction, PlayerId, Player, ResourceCards, ResourceType } from '../types'
import { BUILDING_COSTS } from '../constants'
import { hasResources } from '../calculations'
import { VictoryPathOptimizer, VictoryAnalysis, MultiTurnPlanner, MultiTurnPlan } from './victory-optimizer'

// ===== GOAL SYSTEM INTERFACES =====

export interface Goal {
  id: string
  type: 'victory' | 'strategic' | 'tactical' | 'defensive'
  priority: number // 0-100, higher = more important
  status: 'active' | 'completed' | 'abandoned'
  createdTurn: number
  targetCompletionTurn?: number
  requirements: ResourceRequirement[]
  prereqGoals?: string[] // Goal IDs that must complete first
  value: number // Expected VP or strategic value
  description: string
}

export interface ResourceRequirement {
  resources?: Partial<ResourceCards>
  buildings?: {
    settlements?: number
    cities?: number
    roads?: number
  }
  position?: {
    type: 'specific' | 'any'
    locations?: string[] // Vertex/edge IDs
  }
}

export interface VictoryGoal extends Goal {
  type: 'victory'
  targetVertex?: string
  resourcesNeeded: ResourceCards
  turnsToComplete: number
  vpValue: number
}

export interface TurnPlan {
  goal: Goal | null
  actions: PlannedAction[]
  fallbackActions: PlannedAction[]
  resourceStrategy: 'save' | 'spend' | 'trade'
  reasoning: string[]
}

export interface PlannedAction {
  action: GameAction
  priority: number
  reason: string
  goalId?: string
}

// ===== GOAL MANAGER =====

export class GoalManager {
  private goals: Map<string, Goal> = new Map()
  private completedGoals: Set<string> = new Set()
  private gameState!: GameState
  private playerId: PlayerId
  private goalIdCounter = 0
  private victoryOptimizer: VictoryPathOptimizer | null = null
  private multiTurnPlanner: MultiTurnPlanner | null = null
  private currentVictoryAnalysis: VictoryAnalysis | null = null

  constructor(playerId: PlayerId) {
    this.playerId = playerId
  }

  updateGoals(state: GameState): void {
    this.gameState = state
    
    // Initialize victory optimizer on first call
    if (!this.victoryOptimizer) {
      this.victoryOptimizer = new VictoryPathOptimizer(state, this.playerId)
      this.multiTurnPlanner = new MultiTurnPlanner(state, this.playerId)
    }
    
    // 1. Analyze victory paths for strategic planning
    this.currentVictoryAnalysis = this.victoryOptimizer.analyzeVictoryPaths()
    
    // 2. Review existing goals
    this.reviewExistingGoals()
    
    // 3. Generate new goals based on victory analysis
    this.generateVictoryOptimizedGoals()
    
    // 4. Prioritize goals
    this.prioritizeGoals()
    
    // 5. Abandon impossible goals
    this.pruneImpossibleGoals()
  }

  private reviewExistingGoals(): void {
    for (const [goalId, goal] of this.goals) {
      if (goal.status === 'completed') continue
      
      // Check if goal is now completed
      if (this.isGoalCompleted(goal)) {
        goal.status = 'completed'
        this.completedGoals.add(goalId)
        continue
      }
      
      // Check if goal is still feasible
      if (!this.isGoalFeasible(goal)) {
        goal.status = 'abandoned'
        this.goals.delete(goalId)
      }
    }
  }

  private generateVictoryOptimizedGoals(): void {
    const player = this.gameState.players.get(this.playerId)!
    
    if (!this.currentVictoryAnalysis) return
    
    // Generate goals based on the fastest victory path
    const fastestPath = this.currentVictoryAnalysis.fastestPath
    
    // Victory-focused goals based on optimal path
    if (player.score.total >= 7) {
      this.generateVictoryRushGoals(fastestPath)
    } else {
      this.generateOptimalPathGoals(fastestPath)
    }
    
    // Resource goals based on victory path bottlenecks
    this.generateResourceGoalsFromBottlenecks(this.currentVictoryAnalysis.bottlenecks)
    
    // Strategic goals only if they're part of the victory path
    this.generateStrategicGoalsFromPath(fastestPath)
  }

  private generateVictoryRushGoals(fastestPath: any): void {
    const player = this.gameState.players.get(this.playerId)!
    const currentVP = player.score.total
    const vpNeeded = 10 - currentVP
    
    if (vpNeeded <= 3) {
      // Close to victory - create high-priority victory goals based on optimal path
      const victoryGoal: VictoryGoal = {
        id: this.generateGoalId('victory-rush'),
        type: 'victory',
        priority: 95,
        status: 'active',
        createdTurn: this.gameState.turn,
        targetCompletionTurn: this.gameState.turn + Math.min(5, fastestPath.targetTurns - this.gameState.turn),
        requirements: this.calculateVictoryRequirements(vpNeeded),
        value: 100,
        description: `Execute ${fastestPath.description} for victory`,
        resourcesNeeded: fastestPath.remainingCost,
        turnsToComplete: Math.min(5, fastestPath.targetTurns - this.gameState.turn),
        vpValue: vpNeeded
      }
      
      this.goals.set(victoryGoal.id, victoryGoal)
    }
  }
  
  private generateOptimalPathGoals(fastestPath: any): void {
    // Generate goals for each step in the optimal victory path
    for (let i = 0; i < Math.min(2, fastestPath.steps.length); i++) {
      const step = fastestPath.steps[i]
      const goalId = this.generateGoalId(`path-step-${i}`)
      
      if (this.goals.has(goalId)) continue
      
      const stepGoal: Goal = {
        id: goalId,
        type: step.vpGain > 0 ? 'victory' : 'tactical',
        priority: 90 - i * 10, // Earlier steps have higher priority
        status: 'active',
        createdTurn: this.gameState.turn,
        targetCompletionTurn: this.gameState.turn + 3 + i,
        requirements: [{ resources: step.cost }],
        value: step.vpGain * 10,
        description: step.description
      }
      
      this.goals.set(stepGoal.id, stepGoal)
    }
  }
  
  private generateResourceGoalsFromBottlenecks(bottlenecks: string[]): void {
    for (const bottleneck of bottlenecks) {
      if (bottleneck.includes('shortage')) {
        const resource = bottleneck.split(' ')[0].toLowerCase() as ResourceType
        const goalId = this.generateGoalId(`resource-${resource}`)
        
        if (this.goals.has(goalId)) continue
        
        const resourceGoal: Goal = {
          id: goalId,
          type: 'tactical',
          priority: 75,
          status: 'active',
          createdTurn: this.gameState.turn,
          requirements: [{ resources: { [resource]: 4 } }],
          value: 15,
          description: `Secure ${resource} production or trading`
        }
        
        this.goals.set(resourceGoal.id, resourceGoal)
      }
    }
  }
  
  private generateStrategicGoalsFromPath(fastestPath: any): void {
    // Only generate strategic goals if they're part of the victory path
    const hasLargestArmyStep = fastestPath.steps.some((step: any) => step.description.includes('largest army'))
    const hasLongestRoadStep = fastestPath.steps.some((step: any) => step.description.includes('longest road'))
    
    if (hasLargestArmyStep) {
      const largestArmyGoal: Goal = {
        id: this.generateGoalId('largest-army-path'),
        type: 'strategic',
        priority: 85,
        status: 'active',
        createdTurn: this.gameState.turn,
        requirements: [{ resources: { ore: 2, wheat: 2, sheep: 2 } }],
        value: 20,
        description: 'Achieve largest army (victory path)'
      }
      
      this.goals.set(largestArmyGoal.id, largestArmyGoal)
    }
    
    if (hasLongestRoadStep) {
      const longestRoadGoal: Goal = {
        id: this.generateGoalId('longest-road-path'),
        type: 'strategic',
        priority: 80,
        status: 'active',
        createdTurn: this.gameState.turn,
        requirements: [{ resources: { wood: 6, brick: 6 } }],
        value: 20,
        description: 'Achieve longest road (victory path)'
      }
      
      this.goals.set(longestRoadGoal.id, longestRoadGoal)
    }
  }

  private generateCityGoals(): void {
    const player = this.gameState.players.get(this.playerId)!
    
    // Find settlements that can be upgraded to cities
    const settlementVertices = this.findPlayerSettlements()
    
    for (const vertexId of settlementVertices) {
      const goalId = this.generateGoalId(`city-${vertexId}`)
      if (this.goals.has(goalId)) continue // Already have this goal
      
      const cityGoal: Goal = {
        id: goalId,
        type: 'victory',
        priority: 85,
        status: 'active',
        createdTurn: this.gameState.turn,
        targetCompletionTurn: this.gameState.turn + 5,
        requirements: [{
          resources: BUILDING_COSTS.city,
          position: { type: 'specific', locations: [vertexId] }
        }],
        value: 20, // 2 VP + double production
        description: `Build city at ${vertexId}`
      }
      
      this.goals.set(cityGoal.id, cityGoal)
    }
  }

  private generateSettlementGoals(): void {
    const player = this.gameState.players.get(this.playerId)!
    
    if (player.buildings.settlements <= 0) return // No settlements left
    
    // Find good settlement locations (simplified)
    const expansionSpots = this.findExpansionOpportunities()
    
    for (const spot of expansionSpots.slice(0, 2)) { // Limit to 2 expansion goals
      const goalId = this.generateGoalId(`settlement-${spot}`)
      if (this.goals.has(goalId)) continue
      
      const settlementGoal: Goal = {
        id: goalId,
        type: 'strategic',
        priority: 70,
        status: 'active',
        createdTurn: this.gameState.turn,
        targetCompletionTurn: this.gameState.turn + 4,
        requirements: [{
          resources: BUILDING_COSTS.settlement,
          position: { type: 'specific', locations: [spot] }
        }],
        value: 15, // 1 VP + expansion
        description: `Build settlement at ${spot}`
      }
      
      this.goals.set(settlementGoal.id, settlementGoal)
    }
  }

  private generateStrategicGoals(): void {
    const player = this.gameState.players.get(this.playerId)!
    
    // Largest Army Goal
    if (player.knightsPlayed >= 2 && !player.hasLargestArmy) {
      const largestArmyGoal: Goal = {
        id: this.generateGoalId('largest-army'),
        type: 'strategic',
        priority: 80,
        status: 'active',
        createdTurn: this.gameState.turn,
        requirements: [{
          resources: { ore: 2, wheat: 2, sheep: 2 } // For 2 more dev cards
        }],
        value: 20, // 2 VP
        description: 'Achieve largest army'
      }
      
      this.goals.set(largestArmyGoal.id, largestArmyGoal)
    }
  }

  private generateResourceGoals(): void {
    const player = this.gameState.players.get(this.playerId)!
    
    // Create resource stability goals if consistently lacking certain resources
    const resourceDeficits = this.analyzeResourceDeficits(player)
    
    for (const [resource, severity] of Object.entries(resourceDeficits)) {
      if (severity > 3) { // Significant deficit
        const resourceGoal: Goal = {
          id: this.generateGoalId(`resource-${resource}`),
          type: 'tactical',
          priority: 60,
          status: 'active',
          createdTurn: this.gameState.turn,
          requirements: [{
            resources: { [resource]: 3 } // Stockpile 3 of this resource
          }],
          value: 10,
          description: `Secure ${resource} production`
        }
        
        this.goals.set(resourceGoal.id, resourceGoal)
      }
    }
  }

  private prioritizeGoals(): void {
    const player = this.gameState.players.get(this.playerId)!
    
    // Boost priorities based on game state
    for (const [goalId, goal] of this.goals) {
      if (goal.status !== 'active') continue
      
      // Boost victory goals when close to winning
      if (goal.type === 'victory' && player.score.total >= 8) {
        goal.priority = Math.min(100, goal.priority + 20)
      }
      
      // Boost goals we're close to completing
      if (this.isCloseToCompletion(goal)) {
        goal.priority = Math.min(100, goal.priority + 15)
      }
    }
  }

  private pruneImpossibleGoals(): void {
    const goalsToRemove: string[] = []
    
    for (const [goalId, goal] of this.goals) {
      if (goal.status !== 'active') continue
      
      if (!this.isGoalFeasible(goal)) {
        goalsToRemove.push(goalId)
      }
    }
    
    for (const goalId of goalsToRemove) {
      this.goals.delete(goalId)
    }
  }

  // ===== HELPER METHODS =====

  private isGoalCompleted(goal: Goal): boolean {
    // Simplified completion check - would need full game state analysis
    return false
  }

  private isGoalFeasible(goal: Goal): boolean {
    // Check if goal can still be achieved given current game state
    return true // Simplified
  }

  private isCloseToCompletion(goal: Goal): boolean {
    const player = this.gameState.players.get(this.playerId)!
    
    for (const req of goal.requirements) {
      if (req.resources) {
        // Check if we're close to having required resources
        const deficit = this.calculateResourceDeficit(player.resources, req.resources)
        const totalDeficit = Object.values(deficit).reduce((sum, val) => sum + val, 0)
        
        if (totalDeficit <= 2) { // Within 2 resources of completion
          return true
        }
      }
    }
    
    return false
  }

  private calculateVictoryRequirements(vpNeeded: number): ResourceRequirement[] {
    const requirements: ResourceRequirement[] = []
    
    if (vpNeeded === 1) {
      // Need 1 VP - prefer city if possible
      requirements.push({
        resources: BUILDING_COSTS.city,
        buildings: { cities: 1 }
      })
    } else if (vpNeeded === 2) {
      // Need 2 VP - one city is optimal
      requirements.push({
        resources: BUILDING_COSTS.city,
        buildings: { cities: 1 }
      })
    } else {
      // Need 3+ VP - mix of cities and settlements
      requirements.push({
        resources: { ore: 6, wheat: 4, wood: 1, brick: 1, sheep: 1 },
        buildings: { cities: 1, settlements: 1 }
      })
    }
    
    return requirements
  }

  private calculateResourcesForVictory(vpNeeded: number): ResourceCards {
    if (vpNeeded === 1) {
      return BUILDING_COSTS.city
    } else if (vpNeeded === 2) {
      return BUILDING_COSTS.city
    } else {
      return {
        ore: 6,
        wheat: 4,
        wood: 1,
        brick: 1,
        sheep: 1
      }
    }
  }

  private findPlayerSettlements(): string[] {
    const settlements: string[] = []
    
    for (const [vertexId, vertex] of this.gameState.board.vertices) {
      if (vertex.building?.owner === this.playerId && vertex.building.type === 'settlement') {
        settlements.push(vertexId)
      }
    }
    
    return settlements
  }

  private findExpansionOpportunities(): string[] {
    // Simplified - return some mock expansion spots
    return ['expansion1', 'expansion2', 'expansion3']
  }

  private analyzeResourceDeficits(player: Player): Record<string, number> {
    // Simplified resource deficit analysis
    const deficits: Record<string, number> = {}
    
    // Check against common building costs
    if (player.resources.ore < 2) deficits.ore = 3 - player.resources.ore
    if (player.resources.wheat < 2) deficits.wheat = 3 - player.resources.wheat
    if (player.resources.wood < 1) deficits.wood = 2 - player.resources.wood
    if (player.resources.brick < 1) deficits.brick = 2 - player.resources.brick
    if (player.resources.sheep < 1) deficits.sheep = 2 - player.resources.sheep
    
    return deficits
  }

  private calculateResourceDeficit(current: ResourceCards, required: Partial<ResourceCards>): ResourceCards {
    const deficit: ResourceCards = { wood: 0, brick: 0, ore: 0, wheat: 0, sheep: 0 }
    
    for (const [resource, needed] of Object.entries(required)) {
      const have = current[resource as keyof ResourceCards] || 0
      const need = needed || 0
      if (have < need) {
        deficit[resource as keyof ResourceCards] = need - have
      }
    }
    
    return deficit
  }

  private generateGoalId(prefix: string): string {
    return `${prefix}-${this.goalIdCounter++}`
  }

  // ===== PUBLIC API =====

  getActiveGoals(): Goal[] {
    return Array.from(this.goals.values())
      .filter(g => g.status === 'active')
      .sort((a, b) => b.priority - a.priority)
  }

  getImmediateGoal(): Goal | null {
    const goals = this.getActiveGoals()
    return goals.length > 0 ? goals[0] : null
  }
  
  getCurrentVictoryAnalysis(): VictoryAnalysis | null {
    return this.currentVictoryAnalysis
  }
  
  getMultiTurnPlan(): MultiTurnPlan | null {
    if (!this.multiTurnPlanner) return null
    return this.multiTurnPlanner.planNextTurns(5)
  }

  getGoalById(id: string): Goal | null {
    return this.goals.get(id) || null
  }

  completeGoal(id: string): void {
    const goal = this.goals.get(id)
    if (goal) {
      goal.status = 'completed'
      this.completedGoals.add(id)
    }
  }

  abandonGoal(id: string): void {
    const goal = this.goals.get(id)
    if (goal) {
      goal.status = 'abandoned'
      this.goals.delete(id)
    }
  }
}

// ===== RESOURCE MANAGER =====

export class ResourceManager {
  private reservedResources: ResourceCards = { wood: 0, brick: 0, ore: 0, wheat: 0, sheep: 0 }

  shouldSaveResources(
    currentResources: ResourceCards,
    goal: Goal | null,
    state: GameState
  ): boolean {
    if (!goal) return false
    
    // AGGRESSIVE STRATEGY: Only save if we can complete the goal THIS TURN
    const needed = this.calculateResourceDeficit(currentResources, goal)
    const totalNeeded = Object.values(needed).reduce((sum, val) => sum + val, 0)
    
    // Only save if we can complete the goal immediately (0 resource deficit)
    if (totalNeeded === 0) {
      this.reservedResources = needed
      return true
    }
    
    // NEVER save resources if we need more than 0 resources
    // Instead, we should trade to get what we need
    return false
  }

  private calculateResourceDeficit(current: ResourceCards, goal: Goal): ResourceCards {
    const deficit: ResourceCards = { wood: 0, brick: 0, ore: 0, wheat: 0, sheep: 0 }
    
    for (const req of goal.requirements) {
      if (req.resources) {
        for (const [resource, needed] of Object.entries(req.resources)) {
          const have = current[resource as keyof ResourceCards] || 0
          const need = needed || 0
          if (have < need) {
            deficit[resource as keyof ResourceCards] = Math.max(
              deficit[resource as keyof ResourceCards],
              need - have
            )
          }
        }
      }
    }
    
    return deficit
  }

  private estimateTurnsToResources(needed: ResourceCards, state: GameState): number {
    // Simplified estimation - assume we get 1-2 resources per turn
    const totalNeeded = Object.values(needed).reduce((sum, val) => sum + val, 0)
    return Math.ceil(totalNeeded / 1.5)
  }
}

// ===== TURN PLANNER =====

export class TurnPlanner {
  private goalManager: GoalManager
  private resourceManager: ResourceManager

  constructor(goalManager: GoalManager, resourceManager: ResourceManager) {
    this.goalManager = goalManager
    this.resourceManager = resourceManager
  }

  planTurn(state: GameState, playerId: PlayerId): TurnPlan {
    // 1. Update goals for current state
    this.goalManager.updateGoals(state)
    
    // 2. Get primary goal
    const primaryGoal = this.goalManager.getImmediateGoal()
    
    // 3. Determine resource strategy
    const player = state.players.get(playerId)!
    const saveResources = primaryGoal ? 
      this.resourceManager.shouldSaveResources(
        player.resources, 
        primaryGoal, 
        state
      ) : false
    
    // 4. Generate action plan
    const plan: TurnPlan = {
      goal: primaryGoal,
      actions: [],
      fallbackActions: [],
      resourceStrategy: saveResources ? 'save' : 'spend',
      reasoning: []
    }
    
    if (primaryGoal) {
      plan.reasoning.push(`Goal: ${primaryGoal.description}`)
      plan.reasoning.push(`Priority: ${primaryGoal.priority}`)
      plan.reasoning.push(`Strategy: ${saveResources ? 'save resources' : 'spend resources'}`)
      
      // Goal-oriented actions
      plan.actions = this.generateGoalActions(primaryGoal, state, saveResources)
      
      // Fallback if goal actions fail
      plan.fallbackActions = this.generateFallbackActions(state, player)
    } else {
      plan.reasoning.push('No specific goal - opportunistic play')
      // No specific goal - opportunistic play
      plan.actions = this.generateOpportunisticActions(state, player)
    }
    
    return plan
  }

  private generateGoalActions(
    goal: Goal, 
    state: GameState,
    saveResources: boolean
  ): PlannedAction[] {
    const actions: PlannedAction[] = []
    
    // Can we complete the goal this turn?
    if (this.canCompleteGoal(goal, state)) {
      const completionAction = this.createGoalCompletionAction(goal, state)
      if (completionAction) {
        actions.push({
          action: completionAction,
          priority: 100,
          reason: `Complete goal: ${goal.description}`,
          goalId: goal.id
        })
      }
      return actions
    }
    
    // AGGRESSIVE STRATEGY: Only save if we can complete the goal immediately
    // Otherwise, we should trade or do something productive
    if (saveResources) {
      actions.push({
        action: { type: 'endTurn', playerId: state.currentPlayer, data: {} },
        priority: 80,
        reason: `Ready to complete goal: ${goal.description}`,
        goalId: goal.id
      })
    } else {
      // CRITICAL FIX: Don't provide endTurn actions when we should be trading
      // Let the normal action selection handle this
      // Return empty actions to fall back to normal action selection
    }
    
    return actions
  }

  private generateFallbackActions(state: GameState, player: Player): PlannedAction[] {
    // Generate basic fallback actions
    return [{
      action: { type: 'endTurn', playerId: player.id, data: {} },
      priority: 10,
      reason: 'Fallback - end turn'
    }]
  }

  private generateOpportunisticActions(state: GameState, player: Player): PlannedAction[] {
    // Generate opportunistic actions when no specific goal
    return [{
      action: { type: 'endTurn', playerId: player.id, data: {} },
      priority: 20,
      reason: 'Opportunistic play'
    }]
  }

  private canCompleteGoal(goal: Goal, state: GameState): boolean {
    const player = state.players.get(state.currentPlayer)!
    
    // Check if we have the resources to complete the goal
    for (const req of goal.requirements) {
      if (req.resources) {
        const fullResources: ResourceCards = {
          wood: req.resources.wood || 0,
          brick: req.resources.brick || 0,
          ore: req.resources.ore || 0,
          wheat: req.resources.wheat || 0,
          sheep: req.resources.sheep || 0
        }
        if (!hasResources(player.resources, fullResources)) {
          return false
        }
      }
    }
    
    return true
  }

  private createGoalCompletionAction(goal: Goal, state: GameState): GameAction | null {
    // Create the action that completes the goal
    if (goal.type === 'victory' && goal.description.includes('city')) {
      // Find the settlement to upgrade
      const settlements = this.findPlayerSettlements(state)
      if (settlements.length > 0) {
        return {
          type: 'build',
          playerId: state.currentPlayer,
          data: { buildingType: 'city', position: settlements[0] }
        }
      }
    }
    
    return null
  }

  private findPlayerSettlements(state: GameState): string[] {
    const settlements: string[] = []
    
    for (const [vertexId, vertex] of state.board.vertices) {
      if (vertex.building?.owner === state.currentPlayer && vertex.building.type === 'settlement') {
        settlements.push(vertexId)
      }
    }
    
    return settlements
  }
}