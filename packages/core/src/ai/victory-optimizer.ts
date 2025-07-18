import { GameState, Player, PlayerId, ResourceCards, ResourceType } from '../types'
import { BUILDING_COSTS } from '../constants'
import { hasResources } from '../calculations'

// ===== VICTORY PATH INTERFACES =====

export interface VictoryPath {
  id: string
  description: string
  targetTurns: number
  currentProgress: number
  totalCost: ResourceCards
  remainingCost: ResourceCards
  steps: VictoryStep[]
  probability: number // 0-1, likelihood of success
  efficiency: number // VP per turn
}

export interface VictoryStep {
  action: 'build_city' | 'build_settlement' | 'buy_dev_card' | 'play_knight' | 'build_road'
  target?: string // vertex/edge ID
  cost: ResourceCards
  vpGain: number
  description: string
  prerequisites: string[]
}

export interface VictoryAnalysis {
  currentVP: number
  vpNeeded: number
  fastestPath: VictoryPath
  alternativePaths: VictoryPath[]
  bottlenecks: string[]
  recommendations: string[]
}

// ===== VICTORY PATH OPTIMIZER =====

export class VictoryPathOptimizer {
  private gameState: GameState
  private playerId: PlayerId
  private player: Player

  constructor(gameState: GameState, playerId: PlayerId) {
    this.gameState = gameState
    this.playerId = playerId
    this.player = gameState.players.get(playerId)!
  }

  /**
   * Analyze all possible victory paths and recommend the fastest
   */
  analyzeVictoryPaths(): VictoryAnalysis {
    const currentVP = this.player.score.total
    const vpNeeded = 10 - currentVP
    
    // Generate all possible victory paths
    const allPaths = this.generateAllVictoryPaths(vpNeeded)
    
    // Score and sort paths by efficiency
    const scoredPaths = allPaths
      .map(path => this.scorePath(path))
      .sort((a, b) => b.efficiency - a.efficiency)
    
    const fastestPath = scoredPaths[0]
    const alternativePaths = scoredPaths.slice(1, 3)
    
    return {
      currentVP,
      vpNeeded,
      fastestPath,
      alternativePaths,
      bottlenecks: this.identifyBottlenecks(fastestPath),
      recommendations: this.generateRecommendations(fastestPath)
    }
  }

  /**
   * Generate all possible combinations of victory paths
   */
  private generateAllVictoryPaths(vpNeeded: number): VictoryPath[] {
    const paths: VictoryPath[] = []
    
    // Generate different combinations of VP sources
    for (let cities = 0; cities <= Math.min(vpNeeded / 2, this.getMaxCities()); cities++) {
      for (let settlements = 0; settlements <= Math.min(vpNeeded - cities * 2, this.getMaxSettlements()); settlements++) {
        const remainingVP = vpNeeded - cities * 2 - settlements
        
        if (remainingVP <= 0) {
          // Found a valid combination
          const path = this.createVictoryPath(cities, settlements, remainingVP)
          if (path) paths.push(path)
        } else if (remainingVP <= 4) {
          // Try to fill remaining VP with special achievements
          const pathWithSpecial = this.createVictoryPathWithSpecial(cities, settlements, remainingVP)
          if (pathWithSpecial) paths.push(pathWithSpecial)
        }
      }
    }
    
    return paths
  }

  /**
   * Create a victory path with buildings only
   */
  private createVictoryPath(cities: number, settlements: number, remainingVP: number): VictoryPath | null {
    const steps: VictoryStep[] = []
    let totalCost: ResourceCards = { wood: 0, brick: 0, ore: 0, wheat: 0, sheep: 0 }
    
    // Add city steps
    const availableSettlements = this.getAvailableSettlements()
    for (let i = 0; i < cities && i < availableSettlements.length; i++) {
      const cityStep: VictoryStep = {
        action: 'build_city',
        target: availableSettlements[i],
        cost: BUILDING_COSTS.city,
        vpGain: 2,
        description: `Build city at ${availableSettlements[i]}`,
        prerequisites: [`settlement_at_${availableSettlements[i]}`]
      }
      steps.push(cityStep)
      totalCost = this.addResourceCosts(totalCost, BUILDING_COSTS.city)
    }
    
    // Add settlement steps
    const expansionSpots = this.getExpansionSpots()
    for (let i = 0; i < settlements && i < expansionSpots.length; i++) {
      const settlementStep: VictoryStep = {
        action: 'build_settlement',
        target: expansionSpots[i],
        cost: BUILDING_COSTS.settlement,
        vpGain: 1,
        description: `Build settlement at ${expansionSpots[i]}`,
        prerequisites: [`road_to_${expansionSpots[i]}`]
      }
      steps.push(settlementStep)
      totalCost = this.addResourceCosts(totalCost, BUILDING_COSTS.settlement)
    }
    
    if (steps.length === 0) return null
    
    const remainingCost = this.calculateRemainingCost(totalCost)
    const estimatedTurns = this.estimateTurnsToResources(remainingCost)
    
    return {
      id: `path_${cities}c_${settlements}s`,
      description: `${cities} cities, ${settlements} settlements`,
      targetTurns: Math.max(30, estimatedTurns), // Aim for 30-60 turn wins
      currentProgress: 0,
      totalCost,
      remainingCost,
      steps,
      probability: this.calculatePathProbability(steps),
      efficiency: (cities * 2 + settlements) / estimatedTurns
    }
  }

  /**
   * Create a victory path including special achievements
   */
  private createVictoryPathWithSpecial(cities: number, settlements: number, remainingVP: number): VictoryPath | null {
    const basePath = this.createVictoryPath(cities, settlements, 0)
    if (!basePath) return null
    
    const steps = [...basePath.steps]
    let totalCost = { ...basePath.totalCost }
    
    // Add special achievement steps
    if (remainingVP >= 2 && this.canGetLargestArmy()) {
      const knightsNeeded = Math.max(0, 3 - this.player.knightsPlayed)
      for (let i = 0; i < knightsNeeded; i++) {
        const knightStep: VictoryStep = {
          action: 'buy_dev_card',
          cost: BUILDING_COSTS.developmentCard,
          vpGain: i === knightsNeeded - 1 ? 2 : 0, // Only last knight gives VP
          description: `Buy development card for largest army`,
          prerequisites: []
        }
        steps.push(knightStep)
        totalCost = this.addResourceCosts(totalCost, BUILDING_COSTS.developmentCard)
      }
      remainingVP -= 2
    }
    
    if (remainingVP >= 2 && this.canGetLongestRoad()) {
      const roadsNeeded = Math.max(0, 5 - this.getCurrentRoadLength())
      for (let i = 0; i < roadsNeeded; i++) {
        const roadStep: VictoryStep = {
          action: 'build_road',
          cost: BUILDING_COSTS.road,
          vpGain: i === roadsNeeded - 1 ? 2 : 0, // Only last road gives VP
          description: `Build road for longest road`,
          prerequisites: []
        }
        steps.push(roadStep)
        totalCost = this.addResourceCosts(totalCost, BUILDING_COSTS.road)
      }
      remainingVP -= 2
    }
    
    // Fill remaining VP with development cards (hoping for VP cards)
    for (let i = 0; i < remainingVP && i < 4; i++) {
      const devCardStep: VictoryStep = {
        action: 'buy_dev_card',
        cost: BUILDING_COSTS.developmentCard,
        vpGain: 1, // Assume 25% chance of VP card
        description: `Buy development card for victory points`,
        prerequisites: []
      }
      steps.push(devCardStep)
      totalCost = this.addResourceCosts(totalCost, BUILDING_COSTS.developmentCard)
    }
    
    const remainingCost = this.calculateRemainingCost(totalCost)
    const estimatedTurns = this.estimateTurnsToResources(remainingCost)
    
    return {
      id: `path_${cities}c_${settlements}s_special`,
      description: `${cities} cities, ${settlements} settlements + special achievements`,
      targetTurns: Math.max(35, estimatedTurns), // Special achievements take longer
      currentProgress: 0,
      totalCost,
      remainingCost,
      steps,
      probability: this.calculatePathProbability(steps) * 0.7, // Less reliable
      efficiency: (cities * 2 + settlements + 4) / estimatedTurns
    }
  }

  /**
   * Score a victory path based on multiple criteria
   */
  private scorePath(path: VictoryPath): VictoryPath {
    let efficiency = path.efficiency
    
    // Bonus for achievable target turns (30-60)
    if (path.targetTurns >= 30 && path.targetTurns <= 60) {
      efficiency *= 1.2
    } else if (path.targetTurns > 60) {
      efficiency *= 0.8
    }
    
    // Bonus for high probability paths
    efficiency *= (0.5 + path.probability * 0.5)
    
    // Bonus for paths that use existing settlements
    const citySteps = path.steps.filter(s => s.action === 'build_city')
    if (citySteps.length > 0) {
      efficiency *= 1.1 // Cities are efficient
    }
    
    return { ...path, efficiency }
  }

  /**
   * Calculate the remaining resource cost after accounting for current resources
   */
  private calculateRemainingCost(totalCost: ResourceCards): ResourceCards {
    const remaining: ResourceCards = { wood: 0, brick: 0, ore: 0, wheat: 0, sheep: 0 }
    
    for (const [resource, needed] of Object.entries(totalCost)) {
      const have = this.player.resources[resource as ResourceType]
      const deficit = Math.max(0, needed - have)
      remaining[resource as ResourceType] = deficit
    }
    
    return remaining
  }

  /**
   * Estimate how many turns it will take to acquire the needed resources
   */
  private estimateTurnsToResources(needed: ResourceCards): number {
    const totalNeeded = Object.values(needed).reduce((sum, val) => sum + val, 0)
    
    // Estimate based on current production and trading capability
    const estimatedResourcesPerTurn = 2.5 // Simplified estimate
    const baseTurns = Math.ceil(totalNeeded / estimatedResourcesPerTurn)
    
    // Add buffer for game complexity
    return Math.max(20, baseTurns + 5)
  }

  /**
   * Calculate the probability of successfully executing a path
   */
  private calculatePathProbability(steps: VictoryStep[]): number {
    let probability = 1.0
    
    for (const step of steps) {
      if (step.action === 'buy_dev_card') {
        probability *= 0.9 // Dev cards might not be what we need
      } else if (step.action === 'build_settlement') {
        probability *= 0.85 // Expansion spots might get blocked
      } else {
        probability *= 0.95 // Building actions are quite reliable
      }
    }
    
    return Math.max(0.1, probability)
  }

  /**
   * Identify bottlenecks in the victory path
   */
  private identifyBottlenecks(path: VictoryPath): string[] {
    const bottlenecks: string[] = []
    
    // Resource bottlenecks
    const resourceTotals = path.remainingCost
    if (resourceTotals.ore > 6) bottlenecks.push('Ore shortage - need port or trading')
    if (resourceTotals.wheat > 6) bottlenecks.push('Wheat shortage - need port or trading')
    if (resourceTotals.wood > 8) bottlenecks.push('Wood shortage - need production')
    if (resourceTotals.brick > 8) bottlenecks.push('Brick shortage - need production')
    if (resourceTotals.sheep > 8) bottlenecks.push('Sheep shortage - need production')
    
    // Time bottlenecks
    if (path.targetTurns > 50) bottlenecks.push('Path too slow - consider alternative strategy')
    
    // Probability bottlenecks
    if (path.probability < 0.5) bottlenecks.push('Path too risky - high chance of failure')
    
    return bottlenecks
  }

  /**
   * Generate recommendations for executing the victory path
   */
  private generateRecommendations(path: VictoryPath): string[] {
    const recommendations: string[] = []
    
    // Resource recommendations
    const remaining = path.remainingCost
    if (remaining.ore > 3) recommendations.push('Prioritize ore: build on ore hexes or find ore port')
    if (remaining.wheat > 3) recommendations.push('Prioritize wheat: build on wheat hexes or find wheat port')
    
    // Strategic recommendations
    const citySteps = path.steps.filter(s => s.action === 'build_city').length
    if (citySteps > 0) {
      recommendations.push(`Focus on cities: ${citySteps} cities give ${citySteps * 2} VP efficiently`)
    }
    
    const devCardSteps = path.steps.filter(s => s.action === 'buy_dev_card').length
    if (devCardSteps > 2) {
      recommendations.push('Buy development cards early for knights and potential VP cards')
    }
    
    // Timing recommendations
    if (path.targetTurns <= 40) {
      recommendations.push('Aggressive strategy: trade frequently, build immediately')
    } else if (path.targetTurns <= 50) {
      recommendations.push('Balanced strategy: build when possible, trade for essentials')
    } else {
      recommendations.push('Conservative strategy: focus on resource production first')
    }
    
    return recommendations
  }

  // ===== HELPER METHODS =====

  private getMaxCities(): number {
    // Can upgrade existing settlements to cities
    return this.getAvailableSettlements().length
  }

  private getMaxSettlements(): number {
    // Available settlement pieces
    return this.player.buildings.settlements
  }

  private getAvailableSettlements(): string[] {
    const settlements: string[] = []
    
    for (const [vertexId, vertex] of this.gameState.board.vertices) {
      if (vertex.building?.owner === this.playerId && vertex.building.type === 'settlement') {
        settlements.push(vertexId)
      }
    }
    
    return settlements
  }

  private getExpansionSpots(): string[] {
    // Simplified - return mock expansion spots
    return ['expansion1', 'expansion2', 'expansion3', 'expansion4']
  }

  private canGetLargestArmy(): boolean {
    // Check if largest army is achievable
    const currentLargest = this.getCurrentLargestArmy()
    return this.player.knightsPlayed + 2 > currentLargest // Need 2 more dev cards
  }

  private canGetLongestRoad(): boolean {
    // Check if longest road is achievable
    const currentLongest = this.getCurrentLongestRoad()
    return this.getCurrentRoadLength() + 3 > currentLongest // Need 3 more roads
  }

  private getCurrentLargestArmy(): number {
    // Find current largest army holder
    let maxKnights = 2 // Minimum for largest army
    
    for (const [playerId, player] of this.gameState.players) {
      if (playerId !== this.playerId && player.hasLargestArmy) {
        maxKnights = Math.max(maxKnights, player.knightsPlayed)
      }
    }
    
    return maxKnights
  }

  private getCurrentLongestRoad(): number {
    // Find current longest road holder
    let maxRoadLength = 4 // Minimum for longest road
    
    for (const [playerId, player] of this.gameState.players) {
      if (playerId !== this.playerId && player.hasLongestRoad) {
        maxRoadLength = Math.max(maxRoadLength, 5) // Simplified
      }
    }
    
    return maxRoadLength
  }

  private getCurrentRoadLength(): number {
    // Calculate current road length - simplified
    return 15 - this.player.buildings.roads // Approximate based on roads used
  }

  private addResourceCosts(cost1: ResourceCards, cost2: ResourceCards): ResourceCards {
    return {
      wood: cost1.wood + cost2.wood,
      brick: cost1.brick + cost2.brick,
      ore: cost1.ore + cost2.ore,
      wheat: cost1.wheat + cost2.wheat,
      sheep: cost1.sheep + cost2.sheep
    }
  }
}

// ===== MULTI-TURN STRATEGIC PLANNER =====

export class MultiTurnPlanner {
  private victoryOptimizer: VictoryPathOptimizer
  private gameState: GameState
  private playerId: PlayerId

  constructor(gameState: GameState, playerId: PlayerId) {
    this.gameState = gameState
    this.playerId = playerId
    this.victoryOptimizer = new VictoryPathOptimizer(gameState, playerId)
  }

  /**
   * Plan the next N turns to optimize for victory
   */
  planNextTurns(turnCount: number = 5): MultiTurnPlan {
    const victoryAnalysis = this.victoryOptimizer.analyzeVictoryPaths()
    const fastestPath = victoryAnalysis.fastestPath
    
    const turns: TurnPlan[] = []
    let currentResources = { ...this.gameState.players.get(this.playerId)!.resources }
    
    for (let i = 0; i < turnCount; i++) {
      const turnPlan = this.planSingleTurn(fastestPath, currentResources, i + 1)
      turns.push(turnPlan)
      
      // Simulate resource changes
      currentResources = this.simulateResourceChanges(currentResources, turnPlan)
    }
    
    return {
      victoryPath: fastestPath,
      turns,
      totalEstimatedTurns: fastestPath.targetTurns,
      confidence: fastestPath.probability
    }
  }

  private planSingleTurn(path: VictoryPath, resources: ResourceCards, turnNumber: number): TurnPlan {
    // Find the next step in the victory path we can work toward
    const nextStep = this.findNextAchievableStep(path.steps, resources)
    
    if (nextStep && hasResources(resources, nextStep.cost)) {
      // Can complete this step
      return {
        turnNumber,
        primaryGoal: `Execute: ${nextStep.description}`,
        actions: [nextStep.action],
        resourceTarget: nextStep.cost,
        expectedVPGain: nextStep.vpGain,
        priority: 'execute'
      }
    } else if (nextStep) {
      // Need to work toward this step
      const deficit = this.calculateResourceDeficit(resources, nextStep.cost)
      return {
        turnNumber,
        primaryGoal: `Prepare for: ${nextStep.description}`,
        actions: ['trade', 'collect'],
        resourceTarget: nextStep.cost,
        expectedVPGain: 0,
        priority: 'prepare'
      }
    } else {
      // No clear next step - opportunistic play
      return {
        turnNumber,
        primaryGoal: 'Opportunistic development',
        actions: ['build', 'trade'],
        resourceTarget: { wood: 0, brick: 0, ore: 0, wheat: 0, sheep: 0 },
        expectedVPGain: 0,
        priority: 'opportunistic'
      }
    }
  }

  private findNextAchievableStep(steps: VictoryStep[], resources: ResourceCards): VictoryStep | null {
    // Find the first step we can work toward
    for (const step of steps) {
      // Check if prerequisites are met (simplified)
      if (step.prerequisites.length === 0 || this.checkPrerequisites(step.prerequisites)) {
        return step
      }
    }
    
    return null
  }

  private checkPrerequisites(prerequisites: string[]): boolean {
    // Simplified prerequisite checking
    return true
  }

  private calculateResourceDeficit(current: ResourceCards, target: ResourceCards): ResourceCards {
    return {
      wood: Math.max(0, target.wood - current.wood),
      brick: Math.max(0, target.brick - current.brick),
      ore: Math.max(0, target.ore - current.ore),
      wheat: Math.max(0, target.wheat - current.wheat),
      sheep: Math.max(0, target.sheep - current.sheep)
    }
  }

  private simulateResourceChanges(current: ResourceCards, plan: TurnPlan): ResourceCards {
    // Simplified resource simulation
    const result = { ...current }
    
    // Add some resources each turn (simplified)
    result.wood += 1
    result.brick += 1
    result.ore += 1
    result.wheat += 1
    result.sheep += 1
    
    return result
  }
}

// ===== INTERFACES =====

export interface MultiTurnPlan {
  victoryPath: VictoryPath
  turns: TurnPlan[]
  totalEstimatedTurns: number
  confidence: number
}

export interface TurnPlan {
  turnNumber: number
  primaryGoal: string
  actions: string[]
  resourceTarget: ResourceCards
  expectedVPGain: number
  priority: 'execute' | 'prepare' | 'opportunistic'
}

// ===== FACTORY FUNCTIONS =====

export function createVictoryOptimizer(gameState: GameState, playerId: PlayerId): VictoryPathOptimizer {
  return new VictoryPathOptimizer(gameState, playerId)
}

export function createMultiTurnPlanner(gameState: GameState, playerId: PlayerId): MultiTurnPlanner {
  return new MultiTurnPlanner(gameState, playerId)
}

// ===== PERFORMANCE BENCHMARKING =====

export class AIPerformanceBenchmarker {
  /**
   * Benchmark AI performance against target turn ranges
   */
  static benchmarkTurnPerformance(
    gameResults: Array<{ turns: number; winner: PlayerId; aiPlayers: PlayerId[] }>,
    targetRange: [number, number] = [30, 60]
  ): PerformanceBenchmark {
    const aiWins = gameResults.filter(result => result.aiPlayers.includes(result.winner))
    const aiWinTurns = aiWins.map(result => result.turns)
    
    const inTargetRange = aiWinTurns.filter(turns => turns >= targetRange[0] && turns <= targetRange[1])
    const avgTurns = aiWinTurns.reduce((sum, turns) => sum + turns, 0) / aiWinTurns.length
    
    return {
      totalGames: gameResults.length,
      aiWins: aiWins.length,
      winRate: aiWins.length / gameResults.length,
      averageTurns: avgTurns,
      targetRangeHits: inTargetRange.length,
      targetRangePercentage: inTargetRange.length / aiWins.length,
      fastestWin: Math.min(...aiWinTurns),
      slowestWin: Math.max(...aiWinTurns),
      recommendation: this.generatePerformanceRecommendation(avgTurns, targetRange)
    }
  }

  private static generatePerformanceRecommendation(avgTurns: number, targetRange: [number, number]): string {
    if (avgTurns < targetRange[0]) {
      return 'AI is winning too quickly - consider balancing difficulty'
    } else if (avgTurns > targetRange[1]) {
      return 'AI is too slow - improve trading and building efficiency'
    } else {
      return 'AI performance is within target range'
    }
  }
}

export interface PerformanceBenchmark {
  totalGames: number
  aiWins: number
  winRate: number
  averageTurns: number
  targetRangeHits: number
  targetRangePercentage: number
  fastestWin: number
  slowestWin: number
  recommendation: string
}