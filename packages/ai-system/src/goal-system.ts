import { 
  GameState, 
  GameAction, 
  PlayerId, 
  Player, 
  ResourceCards, 
  ResourceType,
  BUILDING_COSTS,
  hasResources,
  canPlaceSettlement,
  getEdgeVertices
} from '@settlers/game-engine'
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
    
    // CRITICAL FIX: Always generate settlement goals for expansion
    this.generateSettlementGoals()
    
    // Always generate city goals to upgrade existing settlements
    this.generateCityGoals()
    
    // Generate road goals to support expansion
    this.generateRoadGoals()
    
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
    } else {
      // Always generate victory pursuit goals - not just when close
      const victoryGoal: VictoryGoal = {
        id: this.generateGoalId('victory-pursuit'),
        type: 'victory',
        priority: 90,
        status: 'active',
        createdTurn: this.gameState.turn,
        targetCompletionTurn: this.gameState.turn + fastestPath.targetTurns - this.gameState.turn,
        requirements: this.calculateVictoryRequirements(vpNeeded),
        value: 80,
        description: `Work toward ${fastestPath.description}`,
        resourcesNeeded: fastestPath.remainingCost,
        turnsToComplete: fastestPath.targetTurns - this.gameState.turn,
        vpValue: vpNeeded
      }
      
      this.goals.set(victoryGoal.id, victoryGoal)
    }
  }
  
  private generateOptimalPathGoals(fastestPath: any): void {
    // Generate goals for each step in the optimal victory path
    // FIXED: Generate more goals, not just 2
    const maxGoals = Math.min(5, fastestPath.steps.length) // Up to 5 goals instead of 2
    for (let i = 0; i < maxGoals; i++) {
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
    // const player = this.gameState.players.get(this.playerId)!
    
    // Find settlements that can be upgraded to cities
    const settlementVertices = this.findPlayerSettlements()
    
    for (const vertexId of settlementVertices) {
      const goalId = this.generateGoalId(`city-${vertexId}`)
      if (this.goals.has(goalId)) continue // Already have this goal
      
      const cityGoal: Goal = {
        id: goalId,
        type: 'victory',
        priority: this.applyTurnBasedUrgency(85), // Apply urgency to city goals
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
    
    // CRITICAL: Settlement building is key to victory - always consider it
    const expansionSpots = this.findExpansionOpportunities()
    
    // Generate settlement goals with high priority if player needs more VP
    const currentVP = player.score.total
    const vpGap = 10 - currentVP
    
    // Prioritize settlements when we need VP and have building capacity
    let settlementPriority = vpGap > 6 ? 85 : 75 // High priority when far from victory
    
    // AGGRESSIVE ENDGAME: Add turn-based urgency multiplier
    settlementPriority = this.applyTurnBasedUrgency(settlementPriority)
    
    for (const spot of expansionSpots.slice(0, 3)) { // Up to 3 expansion goals
      const goalId = this.generateGoalId(`settlement-${spot}`)
      if (this.goals.has(goalId)) continue
      
      const settlementGoal: Goal = {
        id: goalId,
        type: 'victory', // Make it victory type for higher priority
        priority: settlementPriority,
        status: 'active',
        createdTurn: this.gameState.turn,
        targetCompletionTurn: this.gameState.turn + 6,
        requirements: [{
          resources: BUILDING_COSTS.settlement,
          position: { type: 'specific', locations: [spot] }
        }],
        value: 20, // 1 VP + future city potential (2 VP) = 3 VP total value
        description: `Build settlement at ${spot}`
      }
      
      this.goals.set(settlementGoal.id, settlementGoal)
    }
    
    console.log(`🎯 Generated ${expansionSpots.length > 0 ? Math.min(3, expansionSpots.length) : 0} settlement goals for AI (${expansionSpots.length} valid spots found)`)
  }

  private generateRoadGoals(): void {
    const player = this.gameState.players.get(this.playerId)!
    
    if (player.buildings.roads <= 0) return // No roads left
    
    // Find strategic road placements for expansion
    const strategicRoads = this.findStrategicRoadPlacements()
    
    for (const roadSpot of strategicRoads.slice(0, 2)) { // Limit to 2 road goals
      const goalId = this.generateGoalId(`road-${roadSpot}`)
      if (this.goals.has(goalId)) continue
      
      const roadGoal: Goal = {
        id: goalId,
        type: 'tactical',
        priority: 70, // Medium priority - supports other goals
        status: 'active',
        createdTurn: this.gameState.turn,
        targetCompletionTurn: this.gameState.turn + 3,
        requirements: [{
          resources: BUILDING_COSTS.road,
          position: { type: 'specific', locations: [roadSpot] }
        }],
        value: 10, // Enables settlement building (high strategic value)
        description: `Build road at ${roadSpot}`
      }
      
      this.goals.set(roadGoal.id, roadGoal)
    }
    
    console.log(`🛣️ Generated ${strategicRoads.length > 0 ? Math.min(2, strategicRoads.length) : 0} road goals for AI`)
  }
  
  private findStrategicRoadPlacements(): string[] {
    const strategicRoads: string[] = []
    
    // Find roads that would enable settlement placement
    for (const [edgeId, edge] of this.gameState.board.edges) {
      // Skip if edge is already occupied
      if (edge.connection) continue
      
      // Check if this road would connect to our existing network
      const vertices = getEdgeVertices(this.gameState.board, edgeId)
      let connectsToOurNetwork = false
      let enablesSettlement = false
      
      for (const vertexId of vertices) {
        // Check if this vertex is connected to our road network
        if (this.hasRoadConnection(vertexId, this.playerId)) {
          connectsToOurNetwork = true
        }
        
        // Check if the other vertex could be a good settlement spot
        const otherVertices = vertices.filter(v => v !== vertexId)
        for (const otherVertex of otherVertices) {
          const vertex = this.gameState.board.vertices.get(otherVertex)
          if (vertex && !vertex.building && !this.hasNearbySettlement(otherVertex)) {
            enablesSettlement = true
          }
        }
      }
      
      // This road is strategic if it connects to our network and enables settlement
      if (connectsToOurNetwork && enablesSettlement) {
        strategicRoads.push(edgeId)
      }
    }
    
    return strategicRoads.slice(0, 5) // Limit to avoid performance issues
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
    for (const [, goal] of this.goals) {
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
    // Check if goal is completed based on actual game state
    
    // City building goals
    if (goal.description.includes('Build city at')) {
      const vertexId = goal.description.split('Build city at ')[1]
      const vertex = this.gameState.board.vertices.get(vertexId)
      
      // Goal is completed if the vertex now has a city owned by this player
      if (vertex?.building?.owner === this.playerId && vertex.building.type === 'city') {
        console.log(`✅ Goal completed: ${goal.description}`)
        return true
      }
      
      // Goal is impossible if the vertex no longer has a settlement
      if (!vertex?.building || vertex.building.type !== 'settlement' || vertex.building.owner !== this.playerId) {
        console.log(`❌ Goal impossible: ${goal.description} - no settlement found`)
        return false
      }
    }
    
    // Settlement building goals
    if (goal.description.includes('Build settlement at')) {
      const vertexId = goal.description.split('Build settlement at ')[1]
      const vertex = this.gameState.board.vertices.get(vertexId)
      
      // Goal is completed if the vertex now has a settlement owned by this player
      if (vertex?.building?.owner === this.playerId && vertex.building.type === 'settlement') {
        console.log(`✅ Goal completed: ${goal.description}`)
        return true
      }
    }
    
    // Strategic goals (simplified)
    if (goal.description.includes('largest army')) {
      const player = this.gameState.players.get(this.playerId)!
      if (player.hasLargestArmy) {
        console.log(`✅ Goal completed: ${goal.description}`)
        return true
      }
    }
    
    if (goal.description.includes('longest road')) {
      const player = this.gameState.players.get(this.playerId)!
      if (player.hasLongestRoad) {
        console.log(`✅ Goal completed: ${goal.description}`)
        return true
      }
    }
    
    return false
  }

  private isGoalFeasible(goal: Goal): boolean {
    // Check if goal can still be achieved given current game state
    
    // City building goals
    if (goal.description.includes('Build city at')) {
      const vertexId = goal.description.split('Build city at ')[1]
      const vertex = this.gameState.board.vertices.get(vertexId)
      
      // Goal is feasible only if the vertex has a settlement owned by this player
      if (vertex?.building?.owner === this.playerId && vertex.building.type === 'settlement') {
        const player = this.gameState.players.get(this.playerId)!
        // Also check if player has cities available
        return player.buildings.cities > 0
      }
      
      // Goal is not feasible if no settlement or wrong owner
      return false
    }
    
    // Settlement building goals
    if (goal.description.includes('Build settlement at')) {
      const vertexId = goal.description.split('Build settlement at ')[1]
      const vertex = this.gameState.board.vertices.get(vertexId)
      
      // Goal is feasible if the vertex is empty and player has settlements
      if (!vertex?.building) {
        const player = this.gameState.players.get(this.playerId)!
        return player.buildings.settlements > 0
      }
      
      return false
    }
    
    // Strategic goals are generally feasible
    return true
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
    // Find actual valid settlement locations on the game board
    const validSpots: string[] = []
    const potentialSpots: string[] = [] // Spots that would be valid with road building
    
    for (const [vertexId, vertex] of this.gameState.board.vertices) {
      // Skip if already occupied
      if (vertex.building) continue
      
      // Check distance rule - no settlements within 1 edge
      const hasNearbySettlement = this.hasNearbySettlement(vertexId)
      if (hasNearbySettlement) continue
      
      // For main game phase, check road connectivity
      if (this.gameState.phase === 'actions') {
        const hasRoadConnection = this.hasRoadConnection(vertexId, this.playerId)
        if (hasRoadConnection) {
          validSpots.push(vertexId) // Can build immediately
        } else {
          const canBuildRoadTo = this.canBuildRoadTo(vertexId)
          if (canBuildRoadTo) {
            potentialSpots.push(vertexId) // Can build with road first
          }
        }
      } else {
        // Setup phase - all spots are valid
        validSpots.push(vertexId)
      }
    }
    
    // Include some potential spots that require road building
    const allSpots = [...validSpots, ...potentialSpots.slice(0, 3)]
    
    console.log(`🔍 EXPANSION ANALYSIS: ${validSpots.length} immediate spots, ${potentialSpots.length} potential spots (with roads)`)
    console.log(`📍 Immediate spots: [${validSpots.slice(0, 5).join(', ')}]`)
    console.log(`🛤️ Potential spots: [${potentialSpots.slice(0, 5).join(', ')}]`)
    
    if (validSpots.length === 0 && potentialSpots.length === 0) {
      console.log(`🚨 CRITICAL: No expansion opportunities found - AI may be blocked!`)
    }
    
    return allSpots.slice(0, 10) // Limit to avoid performance issues
  }

  private hasNearbySettlement(vertexId: string): boolean {
    // FIXED: Use game engine validation instead of custom distance checks
    // This ensures we follow the exact same rules as the game engine
    try {
      const result = canPlaceSettlement(this.gameState, this.playerId, vertexId)
      if (!result.isValid && result.reason?.includes('distance')) {
        console.log(`🚫 Settlement blocked at ${vertexId}: ${result.reason}`)
        return true
      }
      console.log(`✅ Settlement allowed at ${vertexId}: passed game engine validation`)
      return false
    } catch (error) {
      console.log(`⚠️ Settlement validation error at ${vertexId}: ${error}`)
      return true // Assume blocked on error
    }
  }
  
  private hasRoadConnection(vertexId: string, playerId: PlayerId): boolean {
    // For setup phase, always allow placement
    if (this.gameState.phase.startsWith('setup')) return true
    
    // Check if player has a road connected to this vertex
    for (const [edgeId, edge] of this.gameState.board.edges) {
      if (!edge.connection) continue
      if (edge.connection.owner !== playerId) continue
      
      // Check if this edge connects to the target vertex
      const edgeVertices = getEdgeVertices(this.gameState.board, edgeId)
      if (edgeVertices.includes(vertexId)) return true
    }
    
    return false
  }
  
  private canBuildRoadTo(vertexId: string): boolean {
    // Check if we can build a road chain (up to 2 roads) that would connect to this vertex
    // This allows for more strategic expansion planning
    
    // First check: direct connection (1 road)
    for (const [edgeId, edge] of this.gameState.board.edges) {
      // Skip if edge is already occupied
      if (edge.connection) continue
      
      // Check if this edge connects to our target vertex
      const edgeVertices = getEdgeVertices(this.gameState.board, edgeId)
      const connectsToTarget = edgeVertices.includes(vertexId)
      if (!connectsToTarget) continue
      
      // Check if the other vertex of this edge is connected to our road network
      const otherVertices = edgeVertices.filter(v => v !== vertexId)
      for (const otherVertex of otherVertices) {
        if (this.hasRoadConnection(otherVertex, this.playerId)) {
          return true // We can build a road on this edge to connect
        }
      }
    }
    
    // Second check: 2-road chain (more ambitious expansion)
    for (const [edgeId1, edge1] of this.gameState.board.edges) {
      if (edge1.connection) continue
      
      const edge1Vertices = getEdgeVertices(this.gameState.board, edgeId1)
      const connectsToTarget = edge1Vertices.includes(vertexId)
      if (!connectsToTarget) continue
      
      const otherVertices1 = edge1Vertices.filter(v => v !== vertexId)
      for (const intermediateVertex of otherVertices1) {
        // Check if we can connect to the intermediate vertex with another road
        for (const [edgeId2, edge2] of this.gameState.board.edges) {
          if (edge2.connection || edgeId2 === edgeId1) continue
          
          const edge2Vertices = getEdgeVertices(this.gameState.board, edgeId2)
          const connectsToIntermediate = edge2Vertices.includes(intermediateVertex)
          if (!connectsToIntermediate) continue
          
          const otherVertices2 = edge2Vertices.filter(v => v !== intermediateVertex)
          for (const networkVertex of otherVertices2) {
            if (this.hasRoadConnection(networkVertex, this.playerId)) {
              return true // We can build 2 roads to connect
            }
          }
        }
      }
    }
    
    return false
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
  
  private applyTurnBasedUrgency(basePriority: number): number {
    const currentTurn = this.gameState.turn
    let urgencyMultiplier = 1.0
    
    if (currentTurn > 80) urgencyMultiplier = 2.0      // CRITICAL: Game going too long
    else if (currentTurn > 60) urgencyMultiplier = 1.8 // URGENT: Speed up significantly  
    else if (currentTurn > 40) urgencyMultiplier = 1.5 // FASTER: Increase aggression
    else if (currentTurn > 20) urgencyMultiplier = 1.2 // MODERATE: Slight speed increase
    
    const adjustedPriority = Math.min(100, basePriority * urgencyMultiplier)
    
    if (urgencyMultiplier > 1.0) {
      console.log(`⏰ Turn ${currentTurn}: Urgency boost ${urgencyMultiplier}x - Priority ${basePriority} → ${adjustedPriority}`)
    }
    
    return adjustedPriority
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
    goal: Goal | null
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

  private estimateTurnsToResources(needed: ResourceCards): number {
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
        primaryGoal
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